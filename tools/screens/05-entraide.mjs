/**
 * Les écrans de `docs/template/05 Entraide.dc.html`.
 *
 * Un fichier par maquette : voir l'en-tête de `01-onboarding.mjs` pour la raison.
 *
 * ─── CETTE MAQUETTE N'A PAS DE DIALECTE ────────────────────────────────────────
 *
 * `01 Accès et Onboarding` et `03 Accueil v2` écrivent leurs valeurs dans un
 * `renderVals()` et les interpolent — `{{ p.comment }}`, `<sc-for>`. Les sept
 * autres maquettes, dont celle-ci, ne le font PAS : leur `renderVals()` rend `{}`
 * et tout le contenu est écrit en clair dans le HTML.
 *
 * Conséquence directe et vérifiable : ces quatorze cadres n'ont AUCUNE donnée à
 * reprendre. Le fichier `apps/web/src/screens/entraide/data.ts` n'en invente donc
 * pas — il porte un type vide, et les composants générés reçoivent `_props`.
 * Recopier « à l'identique » un `renderVals()` vide, c'est n'écrire aucune donnée ;
 * en écrire une serait en inventer.
 *
 * ─── LE TITRE DE CHAQUE CADRE EST DÉCLARÉ ──────────────────────────────────────
 *
 * Aucune section de cette maquette ne contient de `<h2>` : son unique `<h1>` est
 * celui de la planche de documentation, hors section. Le titre de page est donc
 * déclaré ici, avec son TEXTE VISIBLE, et le générateur promeut l'élément qui le
 * porte en `<h1>` (voir `titleFor` et `promoteTitle` : `title` répond à LEQUEL des
 * titres, son discriminant à QUEL texte promouvoir).
 *
 * Les deux cadres d'un même écran ne le disent pas toujours pareil, et c'est la
 * maquette qui en décide : H09 titre « Mes demandes » sur ordinateur, mais
 * « Fil d'entraide » sur mobile — parce que le mobile range « Mes demandes » dans
 * une pastille sous un en-tête commun. Un titre déduit aurait gommé cet écart.
 */

/** Les deux cadres que chaque section dessine, ordinateur puis mobile. */
const both = (desktop, mobile) => [
  { width: 1440, name: 'Desktop', title: desktop },
  { width: 390, name: 'Mobile', title: mobile },
];

export const screens = [
  { section: 'H01', frames: both('Fil d’entraide', 'Fil d’entraide') },

  /**
   * Le titre d'un détail est celui de la demande affichée — la maquette n'en met
   * pas d'autre, et en ajouter un (« Demande ») serait exactement le titre inventé
   * qui a coûté A01.
   *
   * L'apostrophe de « l'installation » est DROITE ici, alors que « Fil d’entraide »
   * porte la courbe. C'est la maquette qui mélange les deux ; la déclaration la
   * recopie sans la corriger, sans quoi le titre ne serait plus trouvé.
   */
  { section: 'H02', frames: both("Un lit et une table pour l'installation", "Un lit et une table pour l'installation") },

  { section: 'H03', frames: both('Publier une demande', 'Publier une demande') },
  { section: 'H04', frames: both('Vous pouvez aider', 'Vous pouvez aider') },
  { section: 'H05', frames: both('Parrainage', 'Parrainage') },

  /**
   * H06 N'A PAS DE CADRE MOBILE, et ce n'est pas un oubli de déclaration.
   *
   * La section dessine quatre planches : la FICHE (cadre de 1440 px), la FEUILLE DE
   * DEMANDE (carte nue de 540 px), APRÈS ENVOI (carte de 420 px) et MOBILE — qui
   * n'est pas la fiche sur téléphone, mais la FEUILLE DE DEMANDE posée sur un voile.
   *
   * Autrement dit, la maquette ne dessine pas la fiche du parrain sur mobile, et
   * elle ne dessine pas la feuille de demande sur ordinateur avec son voile. La
   * feuille n'est donc pas transcodable en modale ici : son cadre d'ordinateur est
   * une carte sans voile et sans panneau marqué, et `extractFrame` en retirerait de
   * surcroît la boîte blanche elle-même, puisque c'est le conteneur extérieur.
   *
   * La fiche est donc livrée seule, sur son unique cadre — `ScreenFrames` la sert
   * alors à toutes les largeurs, comme il le fait pour O05. La feuille de demande
   * est signalée dans le rapport plutôt que d'être à moitié montée.
   */
  { section: 'H06', frames: [{ width: 1440, name: 'Desktop', title: 'Aïcha Diop' }] },

  { section: 'H07', frames: both('Mes parrainages', 'Mes parrainages') },
  { section: 'H08', frames: both('Devenir parrain', 'Devenir parrain') },

  // H09 et H10 ne figurent pas dans T5 ; la maquette et l'API les portent
  // (`/help/mine`, `/help/my-responses`, §5 « Panneau Entraide »). Leurs routes
  // sont celles que la maquette écrit sous leur numéro de planche.
  { section: 'H09', frames: both('Mes demandes', 'Fil d’entraide') },
  { section: 'H10', frames: both('Mes réponses', 'Fil d’entraide') },
].map((s) => ({
  file: 'docs/template/05 Entraide.dc.html',
  section: s.section,
  out: `apps/web/src/screens/${s.section.toLowerCase()}`,
  dataModule: '../entraide/data',
  dataType: 'EntraideData',
  frames: s.frames,
}));
