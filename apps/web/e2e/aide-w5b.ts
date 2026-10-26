import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { APIRequestContext, Browser, BrowserContext, Playwright } from '@playwright/test';
import { connecter, type Membre } from './session';
import { monterEnL2 } from './niveau';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE DÉCOR DES SPECS : DES DONNÉES CRÉÉES PAR LES VRAIES ROUTES              ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Pourquoi ce fichier existe (lot w5b, « rendre la batterie verte »).
 *
 * Une grande part des cas rouges d'une base FRAÎCHE ne l'étaient pas par un défaut du
 * produit : ils SUPPOSAIENT des données que seule la base de développement d'un autre
 * temps portait — le guide « visale-sans-cdi », le réseau « beninois-en-france », un
 * parrain « amina », une demande d'entraide « abc », un fil assez long pour défiler. Sur
 * une base neuve, ces écrans répondent à raison « introuvable » ou « aucun résultat », et
 * le test accuse l'écran.
 *
 * La règle retenue : CHAQUE SPEC CRÉE SES DONNÉES, par les routes que le produit emploie
 * (code OTP de développement, numéros neufs valides, montée de niveau par KYC et numéro de
 * destination — voir `niveau.ts`). Aucune écriture directe en base : un décor fabriqué
 * autrement produirait un état que le produit n'aurait jamais créé, et un test vert qui ne
 * prouve rien.
 *
 * ── CE QUI RESTE À SAVOIR ─────────────────────────────────────────────────────
 *
 *  · UN CONTEXTE DE REQUÊTES PAR MEMBRE. `dp_refresh` TOURNE à chaque usage et porte un
 *    numéro de génération : deux membres dans le même pot à cookies, et c'est le dernier
 *    inscrit qui gagne — le jeton de rafraîchissement du premier serait rejoué et la
 *    chaîne révoquée (voir `session.ts`). Chaque `MembreDecor` porte donc le sien.
 *  · LES SLUGS NE SONT PAS PRÉVISIBLES. Le serveur dérive le slug du titre et ajoute un
 *    suffixe quand il est pris : sur une base qui a déjà vu « Obtenir la garantie Visale
 *    sans CDI », le suivant ne s'appellera plus pareil. Les helpers rendent donc le slug
 *    RÉEL, et les specs naviguent vers lui.
 *  · LES PLAFONDS JOURNALIERS. Trois guides publiés par jour et par membre : un membre
 *    NEUF par guide, jamais un membre partagé.
 */

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1';

/** Un membre créé pour le décor : sa session, son jeton frais, et son propre contexte d'API. */
export interface MembreDecor extends Membre {
  /** Le jeton d'accès FRAIS (périmé par chaque changement de niveau). */
  readonly jeton: string;
  readonly request: APIRequestContext;
  /** Libère le contexte d'API et le contexte navigateur qui ont porté la création. */
  readonly fermer: () => Promise<void>;
}

export interface OptionsMembreDecor {
  /** `L2` : KYC approuvé + numéro de destination vérifié (rédiger un guide, créer un événement, signaler). */
  readonly niveau?: 'L0' | 'L2';
  readonly bio?: string;
}

/**
 * Crée un membre avec sa propre session d'API. `niveau: 'L2'` par défaut est faux exprès :
 * un décor ne monte que ce dont il a besoin, chaque montée coûtant des allers-retours.
 */
export async function creerMembreDecor(
  browser: Browser,
  playwright: Playwright,
  displayName: string,
  options: OptionsMembreDecor = {},
): Promise<MembreDecor> {
  const contexte: BrowserContext = await browser.newContext();
  const request = await playwright.request.newContext();
  const membre = await connecter(contexte, request, {
    displayName,
    ...(options.bio === undefined ? {} : { bio: options.bio }),
  });
  let jeton = membre.accessToken;
  if (options.niveau === 'L2') {
    jeton = (await monterEnL2(contexte, request, membre.accessToken)).accessToken;
  }
  return {
    ...membre,
    jeton,
    request,
    fermer: async () => {
      await request.dispose();
      await contexte.close();
    },
  };
}

function entete(membre: MembreDecor): { authorization: string } {
  return { authorization: `Bearer ${membre.jeton}` };
}

async function lire<T>(reponse: Awaited<ReturnType<APIRequestContext['post']>>, quoi: string): Promise<T> {
  if (!reponse.ok()) throw new Error(`${quoi} ${reponse.status()} : ${await reponse.text()}`);
  return (await reponse.json()) as T;
}

/** La première ville ACTIVE du référentiel : celle où `connecter()` installe ses membres. */
export async function villeActive(
  request: APIRequestContext,
): Promise<{ id: string; name: string; slug: string }> {
  const villes = await lire<{ items: { id: string; name: string; slug: string; isActive: boolean }[] }>(
    await request.get(`${API}/places/cities?limit=50`),
    'GET /places/cities',
  );
  const ville = villes.items.find((v) => v.isActive);
  if (ville === undefined) throw new Error('aucune ville active dans le référentiel');
  return ville;
}

// ── Guides ───────────────────────────────────────────────────────────────────

/** 300 caractères au moins : `GUIDE_BODY_MIN` est exigé à la PUBLICATION. */
const CORPS_DE_GUIDE =
  'Pour constituer ce dossier, rassemblez vos pièces d’identité, vos trois derniers justificatifs de ressources et une attestation d’hébergement. Déposez ensuite la demande en ligne, puis conservez l’accusé de réception : la plateforme le redemande parfois au moment de l’instruction. Comptez deux à trois semaines avant la réponse, et relancez par écrit si rien n’est venu au bout de ce délai. Gardez une copie de chaque pièce envoyée, elle vous évitera de tout reconstituer en cas de rejet ou de demande de complément.';

export interface GuideDecor {
  readonly id: string;
  readonly slug: string;
  readonly titre: string;
  /** L'auteur — un membre NEUF, L2 : il peut modifier son guide et lire ses propositions. */
  readonly auteur: MembreDecor;
}

/**
 * Publie un guide universel par un membre L2 neuf. L'appelant ferme `auteur` quand il a fini
 * (ou le laisse : les contextes meurent avec le processus de test).
 */
export async function publierGuide(
  browser: Browser,
  playwright: Playwright,
  titre: string,
  options: { readonly auteur?: string; readonly corps?: string } = {},
): Promise<GuideDecor> {
  const auteur = await creerMembreDecor(browser, playwright, options.auteur ?? 'Awa Konaté', {
    niveau: 'L2',
  });
  const guide = await lire<{ id: string; slug: string }>(
    await auteur.request.post(`${API}/guides`, {
      headers: entete(auteur),
      data: {
        title: titre,
        body: options.corps ?? CORPS_DE_GUIDE,
        category: 'DAILY_LIFE',
        scope: 'UNIVERSAL',
      },
    }),
    'POST /guides',
  );
  await lire(
    await auteur.request.post(`${API}/guides/${guide.id}/publish`, { headers: entete(auteur) }),
    'POST /guides/:id/publish',
  );
  return { id: guide.id, slug: guide.slug, titre, auteur };
}

// ── Réseaux ──────────────────────────────────────────────────────────────────

export interface ReseauDecor {
  readonly id: string;
  readonly slug: string;
  readonly nom: string;
  readonly sujet: { readonly id: string; readonly titre: string };
  /** Le créateur (propriétaire) : L2, il épingle, modère et gère. */
  readonly proprietaire: MembreDecor;
}

/**
 * Crée un réseau d'intérêt PUBLIC avec un sujet. Un réseau veut cinq invités au moins
 * (§2.2) : cinq membres neufs sont créés pour la circonstance. La ville du créateur doit
 * compter assez de membres (réglage `community_city_threshold`) — l'échec est nommé.
 */
export async function creerReseau(
  browser: Browser,
  playwright: Playwright,
  nom: string,
  titreSujet: string,
): Promise<ReseauDecor> {
  const invites: MembreDecor[] = [];
  for (let i = 0; i < 5; i += 1) {
    invites.push(await creerMembreDecor(browser, playwright, `Invité Réseau ${i + 1}`));
  }
  const proprietaire = await creerMembreDecor(browser, playwright, 'Awa Konaté', { niveau: 'L2' });
  const reponse = await proprietaire.request.post(`${API}/communities`, {
    headers: entete(proprietaire),
    data: {
      name: nom,
      description: 'Réseau créé par la suite de bout en bout.',
      category: 'cuisine',
      visibility: 'PUBLIC',
      inviteHandles: invites.map((m) => m.handle),
    },
  });
  const cree = await lire<{ id: string; slug: string }>(reponse, 'POST /communities');
  for (const invite of invites) await invite.fermer();

  const sujet = await lire<{ id: string }>(
    await proprietaire.request.post(`${API}/communities/${cree.id}/topics`, {
      headers: entete(proprietaire),
      data: {
        title: titreSujet,
        body: 'Quelqu’un a-t-il déjà fait la démarche récemment ? Je cherche les pièces à fournir.',
      },
    }),
    'POST /communities/:id/topics',
  );
  return { id: cree.id, slug: cree.slug, nom, sujet: { id: sujet.id, titre: titreSujet }, proprietaire };
}

// ── Entraide et parrainage ───────────────────────────────────────────────────

/** Publie une demande d'entraide au nom d'un membre, dans la première ville active. */
export async function publierDemande(
  membre: MembreDecor,
  titre: string,
  corps: string,
): Promise<string> {
  const ville = await villeActive(membre.request);
  const cree = await lire<{ request: { id: string } }>(
    await membre.request.post(`${API}/help`, {
      headers: entete(membre),
      data: { kind: 'REQUEST', type: 'PAPERWORK', title: titre, body: corps, cityId: ville.id },
    }),
    'POST /help',
  );
  return cree.request.id;
}

/**
 * Un PARRAIN, par le chemin du produit : installé depuis plus de douze mois (`arrivalDate`
 * + phase `SETTLED`, c'est la condition « SETTLED depuis 12 mois » de §2.1), niveau N2, puis
 * `PUT /me/mentor-profile`. Aucune écriture en base.
 */
export async function creerParrain(
  browser: Browser,
  playwright: Playwright,
  displayName: string,
): Promise<MembreDecor> {
  const contexte = await browser.newContext();
  const request = await playwright.request.newContext();
  const membre = await connecter(contexte, request, { displayName, phase: 'SETTLED' });

  const il_y_a_dix_huit_mois = new Date(Date.now() - 548 * 86_400_000).toISOString().slice(0, 10);
  const patch = await request.patch(`${API}/me`, {
    headers: { authorization: `Bearer ${membre.accessToken}` },
    data: { arrivalDate: il_y_a_dix_huit_mois, phase: 'SETTLED' },
  });
  if (!patch.ok()) throw new Error(`PATCH /me (arrivalDate) ${patch.status()} : ${await patch.text()}`);

  const { accessToken } = await monterEnL2(contexte, request, membre.accessToken);
  const parrain: MembreDecor = {
    ...membre,
    jeton: accessToken,
    request,
    fermer: async () => {
      await request.dispose();
      await contexte.close();
    },
  };
  await lire(
    await request.put(`${API}/me/mentor-profile`, {
      headers: entete(parrain),
      data: {
        bio: 'Arrivée comme étudiante, aujourd’hui installée : je peux accompagner les premiers pas.',
        maxMentees: 3,
        isAvailable: true,
      },
    }),
    'PUT /me/mentor-profile',
  );
  return parrain;
}

// ── Ce qu'aucune route de membre ne crée : une sanction ──────────────────────

/**
 * L'adresse de la base que l'API interroge : `DATABASE_URL` de l'environnement, sinon celle du
 * `.env` de la racine (le même fichier que l'API lit). Le `?schema=` de Prisma n'est pas une
 * option de `psql`.
 */
function adresseDeLaBase(): string {
  let url = process.env['DATABASE_URL'];
  if (url === undefined) {
    const env = readFileSync(resolve(__dirname, '../../../.env'), 'utf8');
    url = /^DATABASE_URL=(.+)$/m.exec(env)?.[1]?.trim().replace(/^"|"$/g, '');
  }
  if (url === undefined) throw new Error('DATABASE_URL introuvable : ni environnement ni .env');
  return url.replace(/\?.*$/, '');
}

/**
 * POSE UNE SANCTION À UN MEMBRE — par SQL, et c'est le SEUL décor écrit ainsi.
 *
 * Une sanction n'a pas de route de membre : elle naît d'une décision de l'équipe (modération,
 * `POST /admin/moderation/cases/:id/act`), derrière un compte d'équipe protégé par mot de passe
 * ET code TOTP. Ces comptes se provisionnent hors application (jeu d'essai, CLI) ; aucun
 * chemin de test ne les crée. Le décor insère donc UN compte d'équipe de test (idempotent, sur
 * l'adresse `e2e-w5b@equipe.test`) puis la sanction. Le MEMBRE, lui, lit la sanction et la
 * conteste par les vraies routes (`GET /me/sanctions`, `POST /me/sanctions/:id/appeal`).
 *
 * `psql` doit être sur le PATH (c'est le cas partout où la base de test tourne).
 */
export function poserSanction(
  userId: string,
  options: { readonly type?: 'WARNING' | 'SUSPENSION' | 'BAN'; readonly motif?: string } = {},
): void {
  const type = options.type ?? 'WARNING';
  const motif = (options.motif ?? 'Propos déplacés envers un autre membre, relevés par la modération.').replace(/'/g, "''");
  /**
   * UN DOSSIER DE MODÉRATION EST LIÉ À LA SANCTION : `appealable` vaut « la sanction vient d'un
   * dossier et n'a pas déjà été contestée » (`moderation.service.ts`). Sans dossier, la page
   * affiche la sanction sans bouton « Contester » — comme une sanction posée à la main.
   */
  const sql = `
    INSERT INTO staff_users (id, updated_at, email, display_name, password_hash, totp_secret_encrypted, role, is_active)
    VALUES (gen_random_uuid(), now(), 'e2e-w5b@equipe.test', 'Équipe e2e', 'x', '\\x00', 'MODERATOR', true)
    ON CONFLICT (email) DO NOTHING;
    WITH dossier AS (
      INSERT INTO moderation_cases (id, updated_at, subject_type, subject_id, subject_author_user_id, source, priority, status, sla_due_at, resolution, resolved_at)
      VALUES (gen_random_uuid(), now(), 'POST', gen_random_uuid(), '${userId}', 'REPORT', 3, 'RESOLVED', now() + interval '1 day', NULL, now())
      RETURNING id
    )
    INSERT INTO sanctions (id, updated_at, user_id, type, reason, starts_at, ends_at, issued_by_staff_id, case_id)
    SELECT gen_random_uuid(), now(), '${userId}', '${type}', '${motif}', now(), ${type === 'SUSPENSION' ? "now() + interval '7 days'" : 'NULL'}, s.id, d.id
    FROM staff_users s, dossier d WHERE s.email = 'e2e-w5b@equipe.test';
  `;
  execFileSync('psql', [adresseDeLaBase(), '-v', 'ON_ERROR_STOP=1', '-q', '-c', sql], { stdio: 'pipe' });
}

// ── Ouvrir, dans le navigateur, la session d'un membre du décor ─────────────

/**
 * Installe dans `context` le cookie `dp_refresh` du membre : le navigateur reprend alors SA
 * session, exactement comme après une connexion. On prend le DERNIER cookie du pot du membre
 * (`dp_refresh` tourne ; voir `session.ts`).
 */
export async function ouvrirSessionDe(context: BrowserContext, membre: MembreDecor): Promise<void> {
  const pot = await membre.request.storageState();
  const refresh = pot.cookies.filter((c) => c.name === 'dp_refresh').at(-1);
  if (refresh === undefined) throw new Error('aucun dp_refresh : la session du membre serait muette');
  await context.clearCookies();
  await context.addCookies([refresh]);
}

// ── Contenus de décor courants ───────────────────────────────────────────────

/** Une publication (type `QUESTION`) d'un membre N2 ; rend son identifiant. */
export async function publierPublication(membre: MembreDecor, texte: string): Promise<string> {
  const cree = await lire<{ post: { id: string } }>(
    await membre.request.post(`${API}/posts`, {
      headers: entete(membre),
      data: { type: 'QUESTION', body: texte },
    }),
    'POST /posts',
  );
  return cree.post.id;
}

/** Un événement de demain dans la première ville active, réservé ou non à un réseau. */
export async function creerEvenementDeDemain(
  membre: MembreDecor,
  titre: string,
  options: { readonly communityId?: string } = {},
): Promise<string> {
  const ville = await villeActive(membre.request);
  const jour = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Europe/Paris',
  }).format(new Date(Date.now() + 26 * 3_600_000));
  const cree = await lire<{ id: string }>(
    await membre.request.post(`${API}/events`, {
      headers: entete(membre),
      data: {
        type: 'COOKING',
        title: titre,
        description: 'Chacun apporte un plat du pays.',
        cityId: ville.id,
        venueName: 'Maison des Associations',
        addressText: '28 rue Denfert-Rochereau',
        startsAt: `${jour}T12:00:00+02:00`,
        endsAt: `${jour}T16:00:00+02:00`,
        capacity: 40,
        ...(options.communityId === undefined ? {} : { communityId: options.communityId }),
      },
    }),
    'POST /events',
  );
  return cree.id;
}

/** Un budget partagé sur la fiche d'une ville (`kind: 'BUDGET'`, montant obligatoire). */
export async function ajouterBudget(
  membre: MembreDecor,
  villeSlug: string,
  libelle: string,
  montantCentimes: number,
): Promise<void> {
  await lire(
    await membre.request.post(`${API}/cities/${encodeURIComponent(villeSlug)}/tips`, {
      headers: entete(membre),
      data: { kind: 'BUDGET', body: libelle, amountCents: montantCentimes },
    }),
    'POST /cities/:slug/tips',
  );
}
