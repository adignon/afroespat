/**
 * Jetons de design — source de vérité unique.
 *
 * Extraits des maquettes « v2 » de docs/template (Bibliothèque UI v2, Fil d'actualité v2),
 * qui sont la sortie itérée du brief T1-design-system.md dans Claude Design.
 * Voir docs/decisions.md D2 : en cas de divergence, les maquettes v2 gagnent sur T1 §2.
 *
 * Toute couleur hors de cette table est interdite (T1 §2.1). Aucun rouge. Aucune ombre portée.
 *
 * ÉCART ASSUMÉ — contraste. Ces valeurs sont celles de la maquette, à l'identique,
 * par décision du porteur. Trois paires n'atteignent pas le seuil AA que T1 §6 et
 * §10.6 demandent :
 *
 *   text-subtle sur blanc              3,10:1   (il en faudrait 4,5)
 *   journey-strong sur journey-soft    3,91:1   (il en faudrait 4,5)
 *   border-inactive sur blanc          1,54:1   (il en faudrait 3,0)
 *
 * guardrails/check-contrast.mjs les connaît et les laisse passer nommément : il
 * échoue sur toute paire NOUVELLE qui manquerait le seuil. Voir docs/decisions.md.
 */

const color = {
  // Vert — actions, éléments actifs, vérification
  primary: '#16785E',
  'primary-strong': '#0F5C48', // rail de navigation, survol, titres de section
  'primary-soft': '#E3F0EB', // fonds de pastille active, encarts d'information
  'primary-alt': '#2FA37D', // accents légers, point de présence

  // Terre cuite — RÉSERVÉ au parcours (T1 §2.1, règle dure)
  // Usages autorisés : étape en cours, jalon, échéance, barre de progression,
  // badge Premium, compteur d'entraide non lue.
  journey: '#E0733A',
  'journey-soft': '#FBE3D4',
  'journey-softest': '#FFFBF8', // encart terre cuite très doux, avec bordure journey
  'journey-strong': '#B4581F',

  // Surfaces
  bg: '#F6F8F7', // fond de page
  surface: '#FFFFFF', // cartes, panneaux
  'surface-inset': '#FAFBFB', // sous-carte encastrée dans une carte
  'surface-tonal': '#F3F7F5', // encart tonal doux
  control: '#EEF2F0', // pilule de recherche et boutons ronds de la barre haute
  'control-alt': '#F2F5F4', // bouton ou pilule secondaire neutre

  // Bordures — 1 px, jamais d'ombre portée
  border: '#E6EBE9',
  'border-strong': '#DDE3E0',
  'border-inactive': '#C9D2CE', // interrupteur éteint, élément inactif

  // Texte
  text: '#16211D',
  'text-muted': '#5D6B66',
  'text-subtle': '#8A958F',
  'text-on-dark': '#FFFFFF',
  'text-on-rail': '#CFE3DA', // libellés inactifs du rail vert foncé

  // Pastilles
  'pill-green': '#E9F3EE',
  'pill-neutral': '#EDF1EF',

  // États — jamais de rouge (règle dure §1.2)
  success: '#1F7A55', // résolu, présent, validé
  'neutral-state': '#8A958F', // étape en pause, archivé

  // Liens de référence dans les contenus techniques (viewer) uniquement
  link: '#4B3FA8',
};

const radius = {
  none: '0px',
  sm: '10px', // petits contrôles
  md: '12px',
  lg: '14px', // boutons, champs, petites cartes
  xl: '18px', // encarts, sous-cartes
  '2xl': '22px', // cartes, panneaux, rail
  full: '999px', // pastilles, avatars, pilules
};

const fontSize = {
  // [taille, { lineHeight, letterSpacing, fontWeight }]
  pill: ['10.5px', { lineHeight: '1.2', letterSpacing: '0.4px', fontWeight: '700' }],
  label: ['11px', { lineHeight: '1.2', letterSpacing: '1px', fontWeight: '700' }],
  meta: ['12.5px', { lineHeight: '1.45', fontWeight: '500' }],
  body: ['14px', { lineHeight: '1.45', fontWeight: '400' }],
  'body-lg': ['15px', { lineHeight: '1.45', fontWeight: '400' }],
  'card-title': ['15px', { lineHeight: '1.3', fontWeight: '700' }],
  'card-title-lg': ['17px', { lineHeight: '1.3', fontWeight: '700' }],
  'page-title': ['25px', { lineHeight: '1.2', letterSpacing: '-0.6px', fontWeight: '800' }],
  'page-title-lg': ['30px', { lineHeight: '1.2', letterSpacing: '-0.9px', fontWeight: '800' }],
};

/** Gabarit de navigation — T1 §3, coquille de Fil d'actualité v2. */
const layout = {
  sidebar: '352px', // colonne gauche complète (rail + panneau)
  rail: '76px', // rail d'icônes, carte arrondie 22 px
  topbar: '64px',
  content: '660px', // largeur maximale du contenu
  rightColumn: '316px', // masquée sous 1280 px
  gutter: '24px',
  cardGap: '12px',
  touchTarget: '44px', // minimum absolu sur tout élément cliquable
  mobileTabBar: '48px',
};

/**
 * Les seuls composants autorisés à écrire le terre cuite en dur.
 * Contrôlé par packages/ui/scripts/check-journey-color.mjs (règle dure T1 §2.1).
 *
 * T1 §2.1 énumère six usages : étape en cours, jalon, échéance, barre de
 * progression, badge Premium, compteur d'entraide non lue. En portant les
 * maquettes, quatre usages de plus sont apparus, que le design pratique et que
 * T1 n'avait pas listés. Ils sont admis ici explicitement, avec leur raison —
 * plutôt que tolérés en silence.
 */
const journeyColorAllowlist = [
  // ── Les six usages énumérés par T1 §2.1 ──────────────────────────────────
  'JourneyProgress',
  'ProgressBar', // la barre de progression de parcours ; n'a pas d'autre emploi
  'StepCurrentCard',
  'MilestoneBadge',
  'DeadlineLabel',
  'PremiumBadge',
  'PlanLimitPrompt', // famille Premium : l'invitation qui accompagne le badge
  'SafetyBanner',
  'ScamAlert',
  'JourneyPanelCard',
  'BlockedButton',
  'UnreadHelpCount',

  // ── Quatre usages pratiqués par les maquettes, absents de T1 §2.1 ────────
  // Le point terre cuite du logo (helper `logo` de gen-helpers.js).
  'Logo',
  // Fond d'avatar #B4581F (helper `av`, employé dans toute la barre haute).
  'Avatar',
  // Compteur de panneau et de barre haute #E0733A (helpers `menuCard`, `topbar`).
  // T1 ne citait que le compteur d'entraide ; le design le généralise.
  'CountBadge',
  // Pastille de notification non lue de la barre haute (helper `topbar`).
  'RoundButton',
];

module.exports = { color, radius, fontSize, layout, journeyColorAllowlist };
