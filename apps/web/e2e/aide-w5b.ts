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
