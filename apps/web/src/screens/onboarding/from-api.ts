import type { JourneyTemplatesResponse } from '@app/shared';

/**
 * DE LA RÉPONSE DE L'API AUX PRISES DU JSX TRANSCODÉ — et rien d'autre.
 *
 * Un fichier par domaine d'écrans, et il ne contient que des conversions : pas
 * d'appel, pas d'état, pas de composant. Ce qui entre est ce que le schéma de
 * `@app/shared` a validé ; ce qui sort est exactement ce que les cadres générés
 * consomment.
 *
 * ── POURQUOI CE FICHIER EXISTE SÉPARÉMENT ───────────────────────────────────
 *
 * Ces fonctions vivaient dans `data.ts`, au milieu des couleurs et des
 * gestionnaires de la maquette. Elles y étaient PURES mais introuvables, et
 * surtout inéprouvables sans monter un navigateur : la règle « le nombre d'étapes
 * vient du serveur, jamais de la maquette » n'était gardée que par un test de bout
 * en bout, qui demande une API, une base, une inscription et quarante secondes.
 *
 * Isolées, elles se testent en quinze millisecondes — et c'est ce test rapide qui
 * dira, au prochain lot, que la promesse faite au membre correspond au parcours
 * qu'on lui livre.
 *
 * ── CE QUI RESTE DE LA MAQUETTE, ET CE QUI N'EN VIENT PLUS ──────────────────
 *
 * `01 Accès et Onboarding.dc.html` dessine quatre cartes d'objectif : « Étudier ·
 * 12 étapes », « Travailler · 10 étapes »… Ce sont des ILLUSTRATIONS. L'API répond
 * « Étudier en France · 15 étapes », parce que le modèle `STUDIES` a été rechargé
 * en version 3. Les deux se ressemblent assez pour qu'une relecture ne voie rien.
 *
 * Ne survit donc de la maquette que ce que l'API ne fournit pas : le TRACÉ
 * D'ICÔNE. Mesuré sur l'API qui tourne — `journey_templates.icon` vaut `null` sur
 * les quatre modèles.
 */

/**
 * Les tracés d'icône de la maquette, appariés par CODE de modèle.
 *
 * Par le code et non par le rang : les quatre codes sortent aujourd'hui dans
 * l'ordre de la maquette, mais l'ordre d'une liste d'API n'est pas un contrat. Le
 * jour où `journey_templates.sort_order` change, un appariement positionnel
 * mettrait l'icône du diplôme sur « Régulariser ma situation ».
 */
const GOAL_ICONS: Readonly<Record<string, string>> = {
  STUDIES: 'M2 9 12 4l10 5-10 5zM6 11v5c3 2 9 2 12 0v-5',
  WORK: 'M3 7h18v13H3zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  FAMILY:
    'M9 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 11a2.5 2.5 0 1 0 0-5M16 20h5a5 5 0 0 0-4-5',
  SETTLEMENT: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5',
};

/**
 * L'icône d'un modèle que la maquette n'a pas dessiné.
 *
 * La maquette en dessine quatre, l'API en sert quatre — mais rien ne garantit que
 * cela durera, et un `<path d="">` vide laisserait une pastille verte sans dessin.
 * On reprend le tracé de document de « Régulariser », le plus neutre des quatre,
 * plutôt que d'en inventer un cinquième : dessiner à la place du porteur de la
 * maquette n'est pas notre travail.
 */
const GOAL_ICON_FALLBACK = GOAL_ICONS['SETTLEMENT'] as string;

/**
 * LES QUATRE TITRES DE LA MAQUETTE, pour l'instant où la liste n'est pas arrivée.
 *
 * Sans nombre d'étapes : c'est la seule chose qu'on ne peut pas afficher sans
 * mentir. Le sous-titre est un simple texte gris dans les deux cadres, donc le
 * laisser vide ne creuse aucun trou dans la mise en page — alors qu'un écran sans
 * cartes serait le piège du sélecteur vide, celui qui a déjà coûté une heure ici.
 */
const CARTES_DESSINEES: readonly { readonly title: string; readonly code: string }[] = [
  { title: 'Étudier', code: 'STUDIES' },
  { title: 'Travailler', code: 'WORK' },
  { title: 'Rejoindre ma famille', code: 'FAMILY' },
  { title: 'Régulariser ma situation', code: 'SETTLEMENT' },
];

/** Un modèle de parcours, tel que O03 a besoin de le montrer (03 §2.1). */
export interface JourneyTemplateChoice {
  readonly id: string;
  /** Le code du modèle : c'est lui qui apparie l'icône de la maquette. */
  readonly code: string;
  readonly nameFr: string;
  /** Le nombre d'étapes de la VERSION servie, jamais celui de la maquette. */
  readonly stepCount: number;
}

/** Une carte d'objectif, telle que le cadre transcodé de O03 la consomme. */
export interface GoalCard {
  readonly title: string;
  readonly steps: string;
  readonly icon: string;
  readonly on: boolean;
}

/**
 * `GET /journey-templates` → les modèles que l'écran retient.
 *
 * `version.stepCount` et non un champ de premier niveau : le nombre d'étapes
 * appartient à la VERSION du modèle, pas au modèle. Un parcours déjà créé reste
 * sur sa version, et c'est celle qui est servie ici qui sera créée.
 */
export function toTemplateChoices(
  response: JourneyTemplatesResponse,
): readonly JourneyTemplateChoice[] {
  return response.items.map((t) => ({
    id: t.id,
    code: t.code,
    nameFr: t.nameFr,
    stepCount: t.version.stepCount,
  }));
}

/** Le pluriel suit le nombre : « 1 étape » et non « 1 étapes ». */
function etapes(n: number): string {
  return n === 1 ? '1 étape' : `${n} étapes`;
}

/**
 * Les cartes d'objectif de O03.
 *
 * La première est mise en avant, exactement comme la maquette la dessine — et
 * c'est le seul état qu'elle porte, puisqu'elle ne rend PAS ces cartes cliquables :
 * ni le cadre de 1440 px ni celui de 390 px ne les dessine en bouton.
 */
export function goalCards(templates: readonly JourneyTemplateChoice[]): readonly GoalCard[] {
  if (templates.length === 0) {
    return CARTES_DESSINEES.map((carte, i) => ({
      title: carte.title,
      steps: '',
      icon: GOAL_ICONS[carte.code] ?? GOAL_ICON_FALLBACK,
      on: i === 0,
    }));
  }
  return templates.map((t, i) => ({
    title: t.nameFr,
    steps: etapes(t.stepCount),
    icon: GOAL_ICONS[t.code] ?? GOAL_ICON_FALLBACK,
    on: i === 0,
  }));
}

/**
 * La phrase sous la case « Créer mon parcours maintenant ».
 *
 * C'est un ENGAGEMENT — elle annonce ce qui va être créé — donc elle se dérive de
 * la réponse. La maquette écrit « Le parcours « Étudier » (12 étapes) sera créé »,
 * et son nombre est faux depuis que `STUDIES` est en version 3.
 *
 * Tant que la liste n'est pas arrivée, on annonce le parcours SANS le chiffrer :
 * promettre un nombre qu'on ne connaît pas est exactement la faute qu'on corrige.
 */
export function createAnnounce(templates: readonly JourneyTemplateChoice[]): string {
  const premier = templates[0];
  if (premier === undefined) return 'Un parcours sera créé à la fin de l’inscription.';
  return `Le parcours « ${premier.nameFr} » (${etapes(premier.stepCount)}) sera créé à la fin de l’inscription.`;
}
