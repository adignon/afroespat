import type { APIRequestContext, BrowserContext } from '@playwright/test';
import { connecter, type Membre } from './session';

/**
 * UN PARCOURS RÉEL, MONTÉ PAR SES VRAIES ROUTES, POUR ÉPROUVER UN ÉCRAN QUI LIT.
 *
 * ── POURQUOI CE FICHIER EXISTE ──────────────────────────────────────────────
 *
 * Les trente-deux cadres de J01 et J05 à J11 lisaient la maquette : « Mes études
 * à Lyon », « 7 / 12 étapes », « Aïcha Diop ». La suite d'alors affirmait sur ces
 * textes-là, et elle passait SANS session — elle mesurait une image.
 *
 * Depuis que ces écrans lisent l'API, un test qui cherche encore « Mes études à
 * Lyon » échouerait, et c'est le bon sens : le titre affiché doit venir du
 * serveur. D'où ce montage, qui rend les valeurs qu'il a écrites — les tests
 * affirment sur ELLES, jamais sur celles de la planche.
 *
 * ── CE QU'IL MONTE, ET POURQUOI CHAQUE PIÈCE ────────────────────────────────
 *
 * 1. le PROPRIÉTAIRE, par le vrai parcours OTP (`connecter`), avec sa ville et son
 *    pays d'origine — sans quoi `POST /journeys` répond `LOCATION_REQUIRED` ;
 * 2. un parcours du modèle `STUDIES`, titre et date cible POSÉS par nous : c'est
 *    ce qui rend vérifiable « l'écran affiche ce que le serveur envoie » plutôt
 *    que « l'écran affiche quelque chose » ;
 * 3. la première étape COMMENCÉE puis FRANCHIE, la seconde commencée avec une
 *    échéance. Sans cela le journal (§3.8) est vide, la frise est vide, et trois
 *    écrans n'auraient rien à montrer — un succès qui ne prouverait rien ;
 * 4. un ACCOMPAGNANT invité ET acceptant : §3.4 distingue `INVITED` d'`ACTIVE`, et
 *    l'équipe de J05 doit montrer les deux états ;
 * 5. un AUTRE membre avec un parcours PUBLIC, pour que `/parcours/publics` ait
 *    quelque chose à lister. §3.7 n'y montre que les parcours d'AUTRES membres :
 *    le nôtre n'y apparaîtrait jamais.
 *
 * ── LES NOMBRES QUE LES TESTS ÉCRIVENT EN DUR ───────────────────────────────
 *
 * `STUDIES` version 3 porte QUINZE étapes, dont UNE facultative, donc
 * `totalCount` vaut QUATORZE. Ces deux nombres viennent du seed et sont figés
 * dans `packages/shared/src/__tests__/journeys-responses.test.ts` sur une charge
 * relevée. Les tests les écrivent EN DUR — jamais `attendu = donnée.length`, qui
 * ne peut pas échouer.
 */

export const ETAPES_STUDIES = 15;
/** §3.2 — l'étape facultative ne compte pas dans l'avancement. */
export const ETAPES_COMPTEES = 14;

export interface MontageParcours {
  readonly proprietaire: Membre;
  readonly accompagnant: Membre;
  /** Le propriétaire d'un parcours PUBLIC, pour J09. */
  readonly inconnu: Membre;
  readonly journeyId: string;
  readonly titre: string;
  /** L'étape FRANCHIE (la première du modèle). */
  readonly etapeFranchie: { readonly id: string; readonly titre: string };
  /** L'étape EN COURS (la seconde), avec son échéance. */
  readonly etapeCourante: { readonly id: string; readonly titre: string; readonly rang: number };
  readonly journeyPublicId: string;
}

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1';

async function json<T>(
  request: APIRequestContext,
  method: 'get' | 'post' | 'patch',
  chemin: string,
  token: string,
  data?: unknown,
): Promise<T> {
  const res = await request[method](`${API}${chemin}`, {
    headers: { authorization: `Bearer ${token}` },
    ...(data === undefined ? {} : { data }),
  });
  if (!res.ok()) throw new Error(`${method.toUpperCase()} ${chemin} ${res.status()} : ${await res.text()}`);
  return (await res.json()) as T;
}

interface ReponseDetail {
  readonly journey: { readonly id: string };
  readonly steps: readonly { readonly id: string; readonly title: string; readonly position: number }[];
}

/** Crée un parcours `STUDIES` pour ce membre, et rend son identifiant. */
async function creerParcours(
  request: APIRequestContext,
  token: string,
  titre: string,
  visibilite: 'PRIVATE' | 'PUBLIC',
): Promise<ReponseDetail> {
  const modeles = await json<{ items: readonly { id: string; code: string }[] }>(
    request,
    'get',
    '/journey-templates',
    token,
  );
  const etudes = modeles.items.find((m) => m.code === 'STUDIES');
  if (etudes === undefined) throw new Error('le modèle STUDIES manque au seed');
  const cree = await json<ReponseDetail>(request, 'post', '/journeys', token, {
    templateId: etudes.id,
  });
  await json(request, 'patch', `/journeys/${cree.journey.id}`, token, {
    title: titre,
    targetArrivalDate: '2027-09-12',
    visibility: visibilite,
  });
  return json<ReponseDetail>(request, 'get', `/journeys/${cree.journey.id}`, token);
}

/**
 * Monte tout, et installe la session du PROPRIÉTAIRE dans le navigateur.
 *
 * Le navigateur ne reçoit qu'UNE session — celle du propriétaire. Les deux autres
 * membres existent côté serveur et servent à poser de la donnée ou à éprouver un
 * refus par l'API ; leur faire ouvrir le navigateur aurait fait TOURNER le jeton
 * de rafraîchissement du propriétaire dans un second contexte, ce qui révoque la
 * chaîne entière (`token_generation`, détection de rejeu).
 */
export async function monterParcours(
  context: BrowserContext,
  request: APIRequestContext,
): Promise<MontageParcours> {
  const inconnu = await connecter(context, request, { displayName: 'Ibrahim Inconnu' });
  const publique = await creerParcours(request, inconnu.accessToken, 'Son chemin à lui', 'PUBLIC');
  // Une étape franchie, pour que la frise publique de §3.7 ne soit pas vide.
  const premierePublique = publique.steps[0];
  if (premierePublique !== undefined) {
    await json(request, 'patch', `/journeys/${publique.journey.id}/steps/${premierePublique.id}`, inconnu.accessToken, { status: 'IN_PROGRESS' });
    await json(request, 'patch', `/journeys/${publique.journey.id}/steps/${premierePublique.id}`, inconnu.accessToken, { status: 'DONE' });
  }

  const accompagnant = await connecter(context, request, { displayName: 'Aicha Accompagnante' });

  /**
   * LE PROPRIÉTAIRE EN DERNIER, et ce n'est pas un détail : `connecter` installe
   * le cookie `dp_refresh` dans le CONTEXTE du navigateur, et le dernier appel
   * gagne. La session que la page reprendra est donc bien la sienne.
   */
  const proprietaire = await connecter(context, request, { displayName: 'Awa Porteuse' });
  const titre = 'Mon chemin vers Lyon';
  const detail = await creerParcours(request, proprietaire.accessToken, titre, 'PRIVATE');

  const e1 = detail.steps[0];
  const e2 = detail.steps[1];
  if (e1 === undefined || e2 === undefined) throw new Error('le modèle STUDIES n’a pas deux étapes');

  const jeton = proprietaire.accessToken;
  const base = `/journeys/${detail.journey.id}`;
  await json(request, 'patch', `${base}/steps/${e1.id}`, jeton, { status: 'IN_PROGRESS' });
  await json(request, 'patch', `${base}/steps/${e1.id}`, jeton, { status: 'DONE' });
  await json(request, 'patch', `${base}/steps/${e2.id}`, jeton, {
    status: 'IN_PROGRESS',
    dueDate: '2027-02-24',
  });

  await json(request, 'post', `${base}/members`, jeton, {
    userHandle: accompagnant.handle,
    role: 'SUPPORTER',
  });
  await json(request, 'post', `${base}/members/accept`, accompagnant.accessToken);

  return {
    proprietaire,
    accompagnant,
    inconnu,
    journeyId: detail.journey.id,
    titre,
    etapeFranchie: { id: e1.id, titre: e1.title },
    etapeCourante: { id: e2.id, titre: e2.title, rang: e2.position },
    journeyPublicId: publique.journey.id,
  };
}
