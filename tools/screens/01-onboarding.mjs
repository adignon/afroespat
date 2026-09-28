/**
 * Les écrans de `docs/template/01 Accès et Onboarding.dc.html`.
 *
 * UN FICHIER PAR MAQUETTE, et c'est une décision d'outillage plutôt que de goût :
 * les quatre-vingt-sept sections qui restent seront transcodées par plusieurs
 * personnes — ou plusieurs agents — en parallèle. Tant que les déclarations
 * vivaient dans un seul tableau, chacune de ces contributions se disputait le même
 * fichier, et chaque fusion demandait une résolution à la main. Un fichier par
 * maquette supprime le conflit au lieu de le résoudre.
 */

/**
 * Les huit sections partagent UN SEUL jeu de données et UN SEUL état, comme
 * dans la maquette : un unique `renderVals()` les sert toutes. Les séparer
 * donnerait huit copies de `seg()` et des barres de progression qui
 * divergeraient.
 */
export const screens = [
  { section: 'P01', frames: [1440, 390] },
  { section: 'P02', frames: [1440, 390] },
  // 560 px : la variante « Ressources », pas un mobile.
  { section: 'P03', frames: [1440, 560], names: ['Desktop', 'Ressources'] },
  { section: 'O01', frames: [1440, 390] },
  { section: 'O02', frames: [1440, 390] },
  { section: 'O03', frames: [1440, 390] },
  { section: 'O04', frames: [1440, 390] },
  // O05 n'a pas de cadre mobile : deux variantes de 700 px, « avec parcours »
  // et « sans parcours » — les deux atterrissages de §5, écran 6.
  { section: 'O05', frames: [700, 700], names: ['AvecParcours', 'SansParcours'] },
].map((s) => ({
  file: 'docs/template/01 Accès et Onboarding.dc.html',
  section: s.section,
  out: `apps/web/src/screens/${s.section.toLowerCase()}`,
  dataModule: '../onboarding/data',
  dataType: 'OnboardingVals',
  frames: s.frames.map((width, i) => ({
    width,
    name: s.names?.[i] ?? (i === 0 ? 'Desktop' : 'Mobile'),
    // Deux cadres de MÊME largeur dans une section : il faut prendre le
    // second, pas rechercher la même ouverture deux fois.
    occurrence: s.frames.indexOf(width) === i ? 0 : i,
  })),
}));
