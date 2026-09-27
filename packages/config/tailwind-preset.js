const { color, radius, fontSize, layout } = require('./tokens');

/**
 * Preset Tailwind partagé par apps/web, apps/admin et packages/ui.
 * Les couleurs sont émises en variables CSS pour permettre un thème sombre
 * plus tard sans toucher aux composants (T1 §2.1).
 */
const cssVars = Object.fromEntries(
  Object.entries(color).map(([name, hex]) => [name, `var(--c-${name}, ${hex})`]),
);

module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    // Palette fermée : on remplace, on n'étend pas. Aucun rouge, aucune couleur hors table.
    colors: { transparent: 'transparent', current: 'currentColor', inherit: 'inherit', ...cssVars },
    borderRadius: radius,
    fontSize,
    fontFamily: {
      sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
    },
    extend: {
      spacing: { touch: layout.touchTarget, rail: layout.rail, sidebar: layout.sidebar },
      maxWidth: { content: layout.content, right: layout.rightColumn },
      // Jamais d'ombre portée (T1 §2.3). Seules exceptions : carte en déplacement, carte sélectionnée.
      boxShadow: { none: 'none', drag: '0 8px 24px rgba(22,33,29,.12)' },
      ringWidth: { DEFAULT: '2px' },
    },
  },
  plugins: [],
};
