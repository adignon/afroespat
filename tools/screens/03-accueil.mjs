/**
 * Les écrans de `docs/template/03 Accueil v2.dc.html`.
 *
 * Un fichier par maquette : voir l'en-tête de `01-onboarding.mjs` pour la raison.
 *
 * Il reste dix-sept sections à déclarer dans ce fichier — A02, A03 à A12, A13,
 * A14, A08T, A12T, MOB, MOB2. Les ajouter ici ne demande rien d'autre : le
 * générateur lit tout ce répertoire.
 */
export const screens = [
  {
    file: 'docs/template/03 Accueil v2.dc.html',
    section: 'A01',
    out: 'apps/web/src/screens/a01',
    dataModule: './data',
    dataType: 'A01Data',
    /**
     * Les deux fenêtres que le fil ouvre, et que la maquette nomme sous ses
     * planches : « Commentaires — ouverts depuis « Commenter » » et « Partager ».
     *
     * Le libellé du bouton de commentaire est une DONNÉE (`p.comment`), pas un
     * texte en dur : le marqueur porte donc l'interpolation du dialecte, telle
     * qu'elle est dans la maquette.
     */
    triggers: [
      { marker: '</svg>{{ p.comment }}', modal: 'A01C' },
      { marker: '</svg>Partager', modal: 'A01P' },
    ],
    frames: [
      { width: 1440, name: 'Desktop' },
      { width: 390, name: 'Mobile' },
    ],
  },

  /**
   * ── Lot 1 · les quatre modales du fil (03 Accueil v2.dc.html) ──────────────
   *
   * La maquette les annonce elle-même : « fenêtre sur web, feuille sur mobile ».
   * Elle DESSINE les deux formes — fenêtre centrée de 720 px sur ordinateur,
   * feuille du bas à 88 % avec sa poignée sur mobile — donc il n'y a aucune forme
   * à inventer, seulement le comportement à brancher (`Modal`).
   *
   * Elles partagent les données de A01, parce que la maquette les met dans le
   * MÊME `renderVals()` : le fil de commentaires et les contacts de partage
   * cohabitent avec les stories et le fil. Les séparer donnerait deux sources
   * pour un seul écran.
   */
  ...[
    { section: 'A01C', modalTitle: 'Commentaires' },
    { section: 'A01P', modalTitle: 'Partager' },
    { section: 'A01G', modalTitle: 'Lier un guide' },
    { section: 'A01S', modalTitle: 'Créer un sondage' },
  ].map((m) => ({
    file: 'docs/template/03 Accueil v2.dc.html',
    section: m.section,
    out: `apps/web/src/screens/${m.section.toLowerCase()}`,
    dataModule: '../a01/data',
    dataType: 'A01Data',
    modal: true,
    modalTitle: m.modalTitle,
    frames: [
      { width: 1440, name: 'Desktop' },
      { width: 390, name: 'Mobile' },
    ],
  })),
];
