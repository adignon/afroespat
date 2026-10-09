/**
 * Système de mouvement — source de vérité unique.
 *
 * Les maquettes n'en contiennent aucun : une image ne peut pas exprimer le
 * mouvement. Les specs n'en décrivent pas davantage. Il est donc CONÇU, et il
 * obéit au principe de T1 §1 :
 *
 *   « familier comme un réseau social, PLUS CALME. Les membres sont souvent en
 *     situation de stress administratif : l'interface rassure, elle ne stimule pas. »
 *
 * D'où un système délibérément pauvre : cinq mouvements, pas un de plus. Chaque
 * ajout ici doit se défendre, comme pour les jetons de couleur — et le garde-fou
 * `check-motion.mjs` refuse toute animation hors de cette table.
 *
 * Ce qu'on s'interdit, explicitement : rebond, élasticité, parallaxe,
 * apparition au défilement, pulsation, rotation décorative, animation
 * d'attention. Rien de tout cela ne rassure qui que ce soit.
 */

/**
 * Durées. Le plafond est 300 ms : au-delà, un mouvement se subit plutôt qu'il
 * ne s'observe, et l'interface paraît lente.
 */
const duration = {
  /** Survol, focus, bascule d'onglet, changement d'état d'un contrôle. */
  instant: '120ms',
  /** Voile d'overlay, modale centrée. */
  quick: '180ms',
  /** Toast entrant. */
  base: '200ms',
  /** Feuille du bas : elle parcourt plus de distance, donc un peu plus de temps. */
  sheet: '220ms',
};

/**
 * Courbes. Deux seulement.
 *
 * `out` décélère : l'élément arrive et se pose. C'est ce qu'on veut pour une
 * entrée — l'objet vient à vous. `linear` pour les fondus, où une courbe se
 * verrait comme un scintillement.
 */
const easing = {
  out: 'cubic-bezier(0.16, 1, 0.3, 1)',
  linear: 'linear',
};

/**
 * Les cinq mouvements. Tout ce qui bouge dans l'application est l'un d'eux.
 */
const motion = {
  /** Feuille du bas, sur mobile (T1 §4.4). */
  sheetIn: { duration: duration.sheet, easing: easing.out, from: 'translateY(100%)' },
  /** Modale centrée, sur ordinateur. Huit pixels : assez pour se voir, pas pour distraire. */
  modalIn: { duration: duration.quick, easing: easing.out, from: 'translateY(8px)', fade: true },
  /** Voile sombre derrière une feuille ou une modale. */
  overlayIn: { duration: duration.quick, easing: easing.linear, fade: true },
  /** Toast : il vient du bas, il repart de même. */
  toastIn: { duration: duration.base, easing: easing.out, from: 'translateY(12px)', fade: true },
  /** Tout le reste : survol, focus, onglet actif, fond d'un bouton. */
  stateChange: { duration: duration.instant, easing: easing.linear },
};

/**
 * `prefers-reduced-motion` coupe TOUT, sans exception.
 *
 * Ce n'est pas une option d'accessibilité qu'on dégrade : c'est la même
 * interface, sans transition. L'état final est identique, il est simplement
 * atteint tout de suite. Un membre qui souffre de troubles vestibulaires doit
 * voir la même application, pas une version amoindrie.
 */
const REDUCED_MOTION_CSS = `
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}`;

/**
 * LES MOMENTS SIGNATURE.
 *
 * Les cinq mouvements ci-dessus sont la mécanique. Ceux-ci sont les endroits où
 * le mouvement DIT quelque chose — et la thèse tient en une phrase :
 *
 *   le mouvement marque l'AVANCEMENT et la RÉSOLUTION, jamais l'attention.
 *
 * C'est une conséquence directe de §1 : « le produit optimise le problème
 * résolu, pas le temps passé ». Animer le fil en ferait une machine à
 * attention — exactement ce que le produit refuse. Animer une étape franchie,
 * au contraire, rend sensible la seule chose qui compte : on avance.
 */
const moments = {
  /**
   * LE moment du produit. Une étape franchie, et la barre monte.
   * Elle ne saute pas : on doit voir le chemin parcouru, c'est tout le sujet.
   */
  journeyProgress: { duration: '600ms', easing: easing.out, property: 'width', exempt: true },

  /** La coche de « Étape franchie » se trace, elle n'apparaît pas. */
  stepDoneCheck: { duration: '280ms', easing: easing.out, property: 'stroke-dashoffset' },

  /**
   * « Je suis bloqué » — les trois volets glissent latéralement.
   * Le mouvement dit : vous avancez dans une démarche, vous ne sautez pas
   * d'un écran à l'autre.
   */
  panelAdvance: { duration: '240ms', easing: easing.out, from: 'translateX(16px)', fade: true },

  /**
   * Un panneau qui RECOUVRE sa section en glissant depuis la droite.
   *
   * Le porteur, pour le choix du pays d'origine : « il faut afficher un slide left
   * modal quand on clique sur le pays […] Il faut pas que ce soit comme les autres
   * modals mais plutôt un modal dans la section qui cache tout le contenu de la
   * section. »
   *
   * Ce n'est donc ni `modalIn` (une fenêtre de page, qui monte de 8 px avec un
   * voile) ni `panelAdvance` (une avance de 16 px à l'intérieur d'un contenu) :
   * c'est un panneau PLEIN qui prend la place de sa section. D'où un déplacement
   * complet, et la durée de `sheet` — la même que la feuille du bas, parce que
   * c'est le même geste, couché.
   */
  sectionPanelIn: { duration: duration.sheet, easing: easing.out, from: 'translateX(100%)' },

  /**
   * ╔════════════════════════════════════════════════════════════════════════════╗
   * ║ LA BARRE D'UNE STORY — QUINZE SECONDES, ET CE N'EST PAS UNE TRANSITION    ║
   * ╚════════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « La barre de progression doit progresser pendant 15 s et
   * automatiquement slide right pour aller vers le story suivant. »
   *
   * `exempt: true` parce que ce n'est PAS un mouvement d'interface : c'est une
   * DURÉE DE LECTURE rendue visible. Le plafond de 300 ms existe pour qu'aucune
   * transition ne fasse attendre ; ici, l'attente EST le propos — la barre dit
   * combien de temps il reste avant la story suivante, exactement comme le fait
   * n'importe quel lecteur de stories.
   *
   * `linear` et non une courbe : une barre qui ralentit en fin de course
   * mentirait sur le temps restant.
   */
  storyProgress: { duration: '15000ms', easing: 'linear', exempt: true },

  /**
   * LE FOND D'UNE STORY QUI DEVIENT CELUI DE LA SUIVANTE.
   *
   * Le porteur : « il faut que le background se change avec une animation de
   * fade ». La traversée change d'identifiant dans l'ÉTAT, donc le même nœud
   * reste en place et sa couleur sautait d'un coup — d'un vert profond à un rouge
   * sombre, sans transition.
   *
   * Même durée et même courbe que le reste des passages d'écran : c'est le même
   * geste — on passe d'un contenu à un autre — et rien ne justifie qu'il ait sa
   * propre grammaire.
   */
  storyFond: { duration: duration.sheet, easing: easing.out, fade: true },

  /** L'onboarding emploie la MÊME grammaire : cinq écrans, un seul chemin. */
  onboardingStep: { duration: '240ms', easing: easing.out, from: 'translateX(16px)', fade: true },

  /** Une demande d'entraide passe en « résolue ». La boucle se ferme. */
  helpResolved: { duration: '280ms', easing: easing.out, fade: true },

  /** Réaction : l'icône se remplit, le compteur monte d'un cran. */
  reactionTick: { duration: '160ms', easing: easing.out },

  /** L'anneau d'une story passe d'épais à fin : elle est vue. */
  storyRingSeen: { duration: '200ms', easing: easing.linear, property: 'border-color' },

  /** Squelette → contenu. Un fondu, jamais un saut. */
  contentReveal: { duration: '180ms', easing: easing.out, fade: true },

  /** Un compteur de réputation qui monte. Le chiffre compte, pas l'effet. */
  counterTick: { duration: '280ms', easing: easing.out },
};

/**
 * CE QU'ON REFUSE, nommément.
 *
 * La discipline d'ici est ce qui donne leur poids aux moments ci-dessus. Un
 * produit où tout bouge est un produit où rien ne signifie.
 */
const FORBIDDEN_MOTION = [
  'apparition au défilement (scroll reveal)',
  'parallaxe',
  'rebond, élasticité',
  'boucle d’attention — pulsation, clignotement, halo',
  'animation dans le FIL : ce serait une machine à attention (§1)',
  'illustration animée',
  'transition de page plein écran',
];

/**
 * Plafond contrôlé par le garde-fou.
 *
 * UN seul moment le dépasse volontairement et porte `exempt` : la barre de
 * progression de parcours, à 600 ms. On doit VOIR le chemin parcouru — c'est la
 * raison d'être du produit, et 300 ms ne suffisent pas à la rendre sensible.
 */
const MAX_DURATION_MS = 300;

/**
 * COMMENT EMPLOYER UN MOMENT EXEMPTÉ.
 *
 * Le garde-fou lit `exempt`, mais il ne devine pas qu'une durée de 600 ms trouvée
 * dans une feuille de style EST la barre de progression. Autoriser toute durée de
 * 600 ms ferait de l'exception une porte ouverte : n'importe quelle animation lente
 * qui tomberait sur ce chiffre passerait.
 *
 * La ligne doit donc NOMMER le moment :
 *
 *     transition: width 600ms cubic-bezier(0.16, 1, 0.3, 1);  // motion:journeyProgress
 *
 * Le nom doit correspondre à un moment `exempt`, ET sa durée doit être celle qui est
 * déclarée ici. Un `motion:journeyProgress` posé à côté de 900 ms est refusé.
 *
 * Même discipline que partout dans ce dépôt : déclaré, jamais deviné. Et le nom écrit
 * à côté de la valeur permet de retrouver d'un `grep` tous les endroits qui emploient
 * ce moment.
 */

module.exports = {
  duration, easing, motion, moments,
  REDUCED_MOTION_CSS, MAX_DURATION_MS, FORBIDDEN_MOTION,
};
