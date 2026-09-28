/**
 * Les écrans de `docs/template/07 Agenda.dc.html`.
 *
 * Un fichier par maquette : voir l'en-tête de `01-onboarding.mjs` pour la raison.
 *
 * Comme `05 Entraide`, cette maquette n'emploie pas le dialecte : son `renderVals()`
 * rend `{}` et tout le contenu est écrit en clair. Il n'y a donc aucune donnée à
 * reprendre — voir l'en-tête de `05-entraide.mjs`, qui détaille la conséquence.
 */

const both = (desktop, mobile) => [
  { width: 1440, name: 'Desktop', title: desktop },
  { width: 390, name: 'Mobile', title: mobile },
];

export const screens = [
  /**
   * L'ordinateur titre le JOUR SÉLECTIONNÉ — « Samedi 21 septembre » — et le mobile
   * la section, « Agenda ». C'est exactement ce que la spec décrit (09 §3.5 :
   * « titre du jour sélectionné » sur la page, « bande horizontale de dates
   * défilante sous le titre » sur mobile) : le mobile porte son sélecteur de date
   * en bande, donc son titre ne peut pas être la date.
   */
  { section: 'E01', frames: both('Samedi 21 septembre', 'Agenda') },

  { section: 'E02', frames: both('Repas partagé béninois', 'Repas partagé béninois') },
  { section: 'E03', frames: both('Créer un événement', 'Créer un événement') },

  /**
   * Le cadre mobile titre « Présence · 18 / 23 » — le compteur est DANS le titre,
   * parce que l'en-tête mobile n'a pas la place du sous-titre que l'ordinateur
   * affiche à côté. Le titre déclaré le reprend tel quel : le raccourcir donnerait
   * un `<h1>` que la maquette n'écrit pas.
   */
  { section: 'E04', frames: both('Présence', 'Présence · 18 / 23') },
].map((s) => ({
  file: 'docs/template/07 Agenda.dc.html',
  section: s.section,
  out: `apps/web/src/screens/${s.section.toLowerCase()}`,
  dataModule: '../agenda/data',
  dataType: 'AgendaData',
  frames: s.frames,
}));
