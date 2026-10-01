import { createHmac } from 'node:crypto';
import type { APIRequestContext, BrowserContext, Cookie } from '@playwright/test';
import { connecter, type Membre } from './session';

/**
 * ─── LE JEU DE DONNÉES DES ÉCRANS SERVICES, CRÉÉ PAR LES SEULES ROUTES ──────
 *
 * ── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────────────
 *
 * `session.ts` ouvre une session de MEMBRE, et c'est tout ce dont le module Compte
 * avait besoin : ses dix écrans lisent `/me` et ses satellites, qu'un membre neuf
 * remplit déjà. Les dix écrans de Services lisent des ANNONCES, des OFFRES et des
 * FICHES — il n'y en a aucune sur un compte neuf, et une liste vide ne prouve pas
 * qu'une liste s'affiche.
 *
 * Il est à part de `session.ts` plutôt qu'ajouté dedans : ce fichier-là est partagé
 * par quatre suites, et deux autres lots travaillent en parallèle sur le même
 * dépôt. Un helper propre à un module vit chez lui.
 *
 * ── TOUT PASSE PAR LES ROUTES DU PRODUIT, Y COMPRIS LA MONTÉE EN NIVEAU ─────
 *
 * Publier un logement exige **L2** « sans exception » (10 §2.1), et un membre créé
 * par OTP est **L0**. Il aurait été tentant d'écrire `verificationLevel: 'L2'`
 * directement en base — c'est ce que font les tests d'intégration de l'API, qui en
 * ont le droit. Un test de bout en bout qui le ferait éprouverait un état que le
 * produit ne sait pas atteindre, et ne dirait rien le jour où le chemin casse.
 *
 * Le chemin complet existe, et il est suivi ici tel quel (01 §7.2) :
 *
 *   1. `POST /auth/otp/request` + `/verify` → le membre est **L0** ;
 *   2. `POST /me/kyc/session` ouvre une session chez le fournisseur FICTIF, puis un
 *      `POST /webhooks/didit` SIGNÉ en HMAC-SHA256 la passe à `APPROVED` → **L1**.
 *      La signature est celle que le service attend, sur les octets bruts du corps ;
 *   3. `POST /me/phones` + `/verify` sur un numéro français → **L2**, parce que
 *      « L2 = L1 + un numéro d'un pays de destination actif ».
 *
 * CHAQUE MONTÉE PÉRIME LE JETON — le niveau est dans le jeton, et le serveur répond
 * `401 TOKEN_STALE`. Le navigateur s'en sort seul (son jeton meurt au
 * rechargement, le transport rafraîchit par le cookie), mais ce fichier appelle
 * l'API sans transport : il rouvre donc une session après chaque montée. C'est la
 * même mécanique, à la main.
 *
 * ── CE QUE LES ROUTES NE SAVENT PAS FAIRE, ET QUI EST REMONTÉ AU PORTEUR ────
 *
 * IL N'EXISTE AUCUNE ROUTE D'ENVOI DE MÉDIA dans toute l'API — aucun contrôleur ne
 * mentionne `MediaAsset`, et `find apps/api/src -name '*media*'` ne rend rien.
 * Conséquence directe et mesurée :
 *
 *   · `POST /housing` exige `photoAssetIds` avec AU MOINS une photo pour un kind
 *     d'OFFRE (§2.1). **Une annonce d'offre est donc impossible à publier par
 *     l'API.** Ce fichier publie une RECHERCHE (`SEEKING_HOUSING`), le seul kind
 *     qui n'exige ni photo ni prix ;
 *   · `PUT /me/pro-profile` exige `proofAssetId` à la création (§4.1). **Une fiche
 *     pro est donc impossible à créer par l'API**, et S07 n'a pas de fiche à
 *     montrer. Le jeu lit alors `GET /pros` et prend la première fiche existante ;
 *     s'il n'y en a aucune, `idFiche` vaut `null` et le test qui en dépend ÉCHOUE
 *     EN LE DISANT, au lieu de se taire.
 */

/**
 * L'adresse de l'API, la MÊME que celle du navigateur.
 *
 * Exportée parce qu'un test de règle dure a besoin d'interroger l'API DIRECTEMENT
 * pour comparer ce qu'elle promet à ce que l'écran affiche — voir la pastille
 * « Sponsorisée » de §11, dont la borne porte sur la TÊTE et non sur la page.
 */
export const API_SERVICES = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1';
const API = API_SERVICES;
const CODE = process.env['SMS_FAKE_FIXED_CODE'] ?? '123456';

/**
 * Le secret du webhook KYC, en développement.
 *
 * Il est LU dans l'environnement d'abord : `.env.example` le pose à cette valeur,
 * et un arbre qui le changerait verrait le test échouer sur une signature invalide
 * — avec un message qui le dit, plutôt qu'un `401` sans cause nommée.
 */
const SECRET_DIDIT = process.env['DIDIT_WEBHOOK_SECRET'] ?? 'dev-didit-webhook-secret-change-me';

export interface JeuServices {
  /** Le membre créé, promu L2 par les routes. Les tests affirment sur SES valeurs. */
  readonly membre: Membre;
  /** Le cookie `dp_refresh` de sa dernière session, à reposer dans chaque contexte. */
  readonly cookie: Cookie;
  /** Une RECHERCHE de logement publiée par lui (`SEEKING_HOUSING`). */
  readonly idAnnonce: string;
  /** Le titre de cette annonce, tel qu'il a été envoyé. L'écran doit l'afficher. */
  readonly titreAnnonce: string;
  /** Une offre d'emploi publiée par lui. */
  readonly idOffre: string;
  readonly titreOffre: string;
  readonly entrepriseOffre: string;
  /** La première fiche de l'annuaire, ou `null` : aucune route ne sait en créer. */
  readonly idFiche: string | null;
  /**
   * Le nom affiché de cette fiche, LU SUR L'API.
   *
   * Le test affirme que le `<h1>` de S07 commence par ce nom — et non qu'il vaut un
   * libellé que la suite composerait elle-même. Recopier ici la table des paliers
   * (« Pro », « Pro+ ») en ferait une seconde source, qui divergerait de celle de
   * `screens/services/appels.ts` au premier palier ajouté.
   */
  readonly nomFiche: string | null;
  readonly ville: string;
}

/** Le nom du membre créé. Il ne doit RESSEMBLER à aucun nom de la maquette. */
export const NOM_MEMBRE = 'Awa Konaté';
export const INITIALES_MEMBRE = 'AK';
export const PRENOM_MEMBRE = 'Awa';

/** Le titre de l'annonce publiée : il ne figure dans AUCUNE planche. */
export const TITRE_ANNONCE = 'Recherche studio proche des facultés';
/** Celui de l'offre : il figure dans la maquette, donc il ne prouve rien seul. */
export const TITRE_OFFRE = 'Chargée de clientèle bilingue';
export const ENTREPRISE_OFFRE = 'Coopérative Sankofa';

/**
 * Le jeu, construit UNE FOIS par processus de travail.
 *
 * Playwright crée un `request` et un `context` par test. Reconstruire le jeu à
 * chaque test coûterait une quinzaine d'appels — dont deux SMS fictifs et un
 * webhook — pour une centaine de tests. Le jeu est donc mémoïsé, et seul le COOKIE
 * est reposé dans chaque contexte de navigateur.
 */
let memo: Promise<JeuServices> | null = null;

export function jeuDeServices(
  context: BrowserContext,
  request: APIRequestContext,
): Promise<JeuServices> {
  memo ??= construire(context, request);
  return memo;
}

/**
 * Repose la session dans ce contexte de navigateur.
 *
 * À appeler AVANT le premier `page.goto` de chaque test : sans elle, les dix
 * écrans n'affichent plus que « Chargement… » puis une invitation à se reconnecter,
 * et un test mesurerait l'écran d'erreur en croyant mesurer l'écran.
 */
export async function installerSession(
  context: BrowserContext,
  jeu: JeuServices,
): Promise<void> {
  await context.addCookies([jeu.cookie]);
}

async function construire(
  context: BrowserContext,
  request: APIRequestContext,
): Promise<JeuServices> {
  const membre = await connecter(context, request, { displayName: NOM_MEMBRE, phase: 'SETTLED' });

  // ── L0 → L1 : session KYC fictive, puis webhook SIGNÉ (01 §4.3) ───────────
  const session = (await corps(
    await request.post(`${API}/me/kyc/session`, { headers: auth(membre.accessToken), data: {} }),
    'POST /me/kyc/session',
  )) as { sessionId: string };

  const charge = JSON.stringify({
    sessionId: session.sessionId,
    status: 'APPROVED',
    isAdult: true,
  });
  /**
   * LA SIGNATURE PORTE SUR LES OCTETS BRUTS, et c'est pourquoi le corps est
   * sérialisé une seule fois puis envoyé tel quel : `JSON.stringify` d'un objet
   * déjà analysé ne reproduit pas les mêmes octets (ordre des clés, échappements),
   * et le service le dit en toutes lettres dans son propre commentaire.
   */
  const signature = createHmac('sha256', SECRET_DIDIT)
    .update(Buffer.from(charge, 'utf8'))
    .digest('hex');
  const hook = await request.post(`${API}/webhooks/didit`, {
    headers: { 'content-type': 'application/json', 'x-signature': signature },
    data: charge,
  });
  if (!hook.ok()) {
    throw new Error(
      `webhook KYC refusé (${hook.status()}) : ${await hook.text()} — le secret ` +
        '`DIDIT_WEBHOOK_SECRET` de cet arbre ne correspond pas à celui de la suite.',
    );
  }

  // Le niveau est DANS le jeton : il est périmé, on rouvre une session.
  let jeton = await rouvrir(request, membre.phone);

  // ── L1 → L2 : un numéro français vérifié (01 §7.2) ───────────────────────
  const ajout = (await corps(
    await request.post(`${API}/me/phones`, {
      headers: auth(jeton),
      data: { phone: numeroFrancais(), countryIso2: 'FR', captchaToken: 'fake' },
    }),
    'POST /me/phones',
  )) as { challengeId: string };
  await corps(
    await request.post(`${API}/me/phones/verify`, {
      headers: auth(jeton),
      data: { challengeId: ajout.challengeId, code: CODE },
    }),
    'POST /me/phones/verify',
  );
  jeton = await rouvrir(request, membre.phone);

  const moi = (await corps(
    await request.get(`${API}/me`, { headers: auth(jeton) }),
    'GET /me',
  )) as { user: { verificationLevel: string; cityId: string | null } };
  if (moi.user.verificationLevel !== 'L2') {
    throw new Error(
      `le membre est resté en ${moi.user.verificationLevel} : le chemin L0 → L2 des ` +
        'routes du produit a changé, et publier un logement exige L2 sans exception (10 §2.1).',
    );
  }

  // ── Ce qu'on publie, et ce qu'on ne PEUT pas publier ─────────────────────
  const villes = (await corps(
    await request.get(`${API}/places/cities?limit=5`),
    'GET /places/cities',
  )) as { items: { id: string; name: string }[] };
  const ville = villes.items.find((v) => v.id === moi.user.cityId) ?? villes.items[0];
  if (ville === undefined) throw new Error('aucune ville active : le seed n’a pas tourné.');

  /**
   * UNE RECHERCHE, ET NON UNE OFFRE, et ce n'est pas un choix de confort : §2.1
   * exige au moins une photo sur un kind d'offre, et AUCUNE ROUTE DE L'API NE SAIT
   * recevoir un média. Remonté au porteur ; voir l'en-tête de ce fichier.
   */
  const annonce = (await corps(
    await request.post(`${API}/housing`, {
      headers: auth(jeton),
      data: {
        kind: 'SEEKING_HOUSING',
        title: TITRE_ANNONCE,
        description:
          'Étudiante en master, je cherche un studio ou une colocation calme pour la rentrée. ' +
          'Visite sur place possible en semaine, dossier complet avec garant.',
        cityId: ville.id,
        district: '7e · Jean Macé',
        photoAssetIds: [],
      },
    }),
    'POST /housing',
  )) as { id: string };

  const offre = (await corps(
    await request.post(`${API}/jobs`, {
      headers: auth(jeton),
      data: {
        kind: 'JOB',
        title: TITRE_OFFRE,
        description:
          'Accueil et suivi des adhérents, en français et en bambara. Débutant·e accepté·e, ' +
          'formation assurée sur place pendant le premier mois.',
        companyName: ENTREPRISE_OFFRE,
        cityId: ville.id,
        contractType: 'CDI',
        sector: 'Services',
        externalUrl: 'https://sankofa.example/offre',
      },
    }),
    'POST /jobs',
  )) as { id: string };

  /**
   * LA FICHE PRO NE PEUT PAS ÊTRE CRÉÉE : `proofAssetId` est obligatoire à la
   * création (§4.1) et aucune route ne sait recevoir un justificatif. On prend donc
   * la première fiche existante, et `null` si l'annuaire est vide — le test qui en
   * dépend échoue alors en NOMMANT la cause, au lieu de se taire.
   */
  const annuaire = (await corps(
    await request.get(`${API}/pros?limit=5`, { headers: auth(jeton) }),
    'GET /pros',
  )) as {
    items: { id: string; displayName: string }[];
    featured: { id: string; displayName: string }[];
  };
  const fiche = annuaire.featured[0] ?? annuaire.items[0] ?? null;

  /**
   * LE COOKIE EST REPRIS DU CONTEXTE D'API, jamais reconstruit — même raison que
   * dans `session.ts` : le recomposer reviendrait à recopier la politique de
   * `dp_refresh` dans un fichier de test, et elle changerait un jour sans le dire.
   *
   * C'est celui de la DERNIÈRE session, donc celui d'un membre L2.
   */
  const etat = await request.storageState();
  const cookie = etat.cookies.filter((c) => c.name === 'dp_refresh').at(-1);
  if (cookie === undefined) {
    throw new Error('le cookie dp_refresh n’a pas été posé : la session ne survivrait pas.');
  }
  await context.addCookies([cookie]);

  return {
    membre,
    cookie: cookie as Cookie,
    idAnnonce: annonce.id,
    titreAnnonce: TITRE_ANNONCE,
    idOffre: offre.id,
    titreOffre: TITRE_OFFRE,
    entrepriseOffre: ENTREPRISE_OFFRE,
    idFiche: fiche === null ? null : fiche.id,
    nomFiche: fiche === null ? null : fiche.displayName,
    ville: ville.name,
  };
}

const auth = (jeton: string) => ({ authorization: `Bearer ${jeton}` });

async function corps(
  reponse: { ok: () => boolean; status: () => number; text: () => Promise<string> },
  label: string,
): Promise<unknown> {
  const texte = await reponse.text();
  if (!reponse.ok()) throw new Error(`${label} → ${reponse.status()} : ${texte}`);
  return texte === '' ? null : JSON.parse(texte);
}

/** Rouvre une session sur le MÊME numéro : le jeton reprend le niveau courant. */
async function rouvrir(request: APIRequestContext, phone: string): Promise<string> {
  const demande = (await corps(
    await request.post(`${API}/auth/otp/request`, {
      data: { phone, countryIso2: 'BJ', captchaToken: 'fake', acceptTerms: true },
    }),
    'POST /auth/otp/request',
  )) as { challengeId: string };
  const session = (await corps(
    await request.post(`${API}/auth/otp/verify`, {
      data: { challengeId: demande.challengeId, code: CODE },
    }),
    'POST /auth/otp/verify',
  )) as { accessToken: string };
  return session.accessToken;
}

/**
 * Un numéro français neuf.
 *
 * L'horodatage ET un compteur, pour la raison que `session.ts` a déjà payée : deux
 * appels dans la même milliseconde donneraient deux fois le même numéro, et le
 * second échouerait sur un numéro déjà pris par le premier membre.
 */
let compteur = 0;
function numeroFrancais(): string {
  compteur += 1;
  const suffixe = String((Date.now() % 1_000_000) * 10 + (compteur % 10)).padStart(8, '0');
  return `+336${suffixe.slice(-8)}`;
}
