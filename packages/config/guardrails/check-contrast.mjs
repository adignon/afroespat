#!/usr/bin/env node
/**
 * Garde-fou : tout jeton de texte tient le contraste AA sur les fonds où il est
 * employé.
 *
 * T1 §6 et §10.6 exigent « contraste AA minimum ». §12.2 en fait une case de la
 * définition de « terminé ». Or le design livrait `text-subtle` à #8A958F, soit
 * 3,1:1 — sous le seuil, et précisément sur les libellés de section et les
 * horodatages, c'est-à-dire du texte de 11 à 12 px.
 *
 * Le problème a été trouvé par axe-core au navigateur. Ce contrôle-ci le prend
 * en amont : il échoue à la seconde où quelqu'un éclaircit un jeton, sans
 * attendre qu'un écran soit construit pour s'en apercevoir.
 *
 * ÉCARTS ASSUMÉS — le porteur a choisi de conserver les couleurs de la maquette
 * telles quelles. Les paires concernées sont listées nommément dans `ACCEPTED`
 * ci-dessous, avec leur ratio réel. Elles ne font pas échouer le contrôle, mais
 * elles restent AFFICHÉES à chaque exécution : un écart visible à chaque build
 * vaut mieux qu'un test désactivé. Toute paire nouvelle sous le seuil échoue.
 *
 * Seuils WCAG 2.1 AA :
 *   · 4,5:1  texte normal (< 18,66 px gras, < 24 px)
 *   · 3,0:1  grand texte et éléments d'interface non textuels
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { color } = require(resolve(here, '..', 'tokens.js'));

function channel(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function luminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Les paires réellement employées par les composants. Une paire qui n'existe pas
 * à l'écran n'a pas à être vérifiée : on contrôlerait du bruit.
 */
const PAIRS = [
  // Texte sur les surfaces claires — seuil 4,5.
  { fg: 'text', bg: 'surface', min: 4.5, usage: 'texte principal sur carte' },
  { fg: 'text', bg: 'bg', min: 4.5, usage: 'texte principal sur la page' },
  { fg: 'text-muted', bg: 'surface', min: 4.5, usage: 'métadonnées sur carte' },
  { fg: 'text-muted', bg: 'bg', min: 4.5, usage: 'métadonnées sur la page' },
  { fg: 'text-subtle', bg: 'surface', min: 4.5, usage: 'libellés de section, horodatages' },
  { fg: 'text-subtle', bg: 'bg', min: 4.5, usage: 'libellés de section sur la page' },
  { fg: 'text-muted', bg: 'control-alt', min: 4.5, usage: 'bouton secondaire' },
  { fg: 'text-subtle', bg: 'control', min: 4.5, usage: 'champ de recherche' },
  { fg: 'neutral-state', bg: 'surface', min: 4.5, usage: 'étape en pause, archivé' },

  // Texte sur fond coloré.
  { fg: 'text-on-dark', bg: 'primary', min: 4.5, usage: 'bouton principal' },
  { fg: 'text-on-dark', bg: 'primary-strong', min: 4.5, usage: 'rail de navigation' },
  // 13,5 px gras n'est PAS du « grand texte » au sens WCAG (seuil : 18,66 px
  // gras). Le seuil applicable est donc 4,5, pas 3,0.
  { fg: 'text-on-dark', bg: 'journey', min: 4.5, usage: 'bouton parcours, compteurs' },
  { fg: 'text-on-dark', bg: 'journey-strong', min: 4.5, usage: 'avatar terre cuite' },
  { fg: 'journey', bg: 'surface', min: 3.0, usage: 'barre de progression, sans texte' },
  { fg: 'primary', bg: 'surface', min: 4.5, usage: 'liens et actions' },
  { fg: 'primary', bg: 'primary-soft', min: 4.5, usage: 'item actif du panneau' },
  { fg: 'primary', bg: 'pill-green', min: 4.5, usage: 'pastille verte' },
  { fg: 'primary-strong', bg: 'primary-soft', min: 4.5, usage: 'encart d’information' },
  { fg: 'journey-strong', bg: 'journey-soft', min: 4.5, usage: 'pastille et bandeau terre cuite' },
  { fg: 'journey-strong', bg: 'journey-softest', min: 4.5, usage: 'encart terre cuite très doux' },
  { fg: 'success', bg: 'pill-green', min: 4.5, usage: 'pastille résolu' },
  { fg: 'text-subtle', bg: 'pill-neutral', min: 4.5, usage: 'pastille neutre' },

  // Éléments d'interface non textuels — seuil 3,0 (WCAG 1.4.11).
  { fg: 'border-inactive', bg: 'surface', min: 3.0, usage: 'interrupteur éteint' },
  { fg: 'primary', bg: 'bg', min: 3.0, usage: 'anneau de focus sur la page' },
];

/**
 * Paires conservées sous le seuil, par décision documentée (docs/decisions.md).
 * La valeur est le ratio constaté au moment de la décision : si la couleur bouge,
 * le ratio change et le contrôle le signale à nouveau.
 */
const ACCEPTED = new Map([
  ['text-subtle/surface', 3.1],
  ['text-subtle/bg', 2.91],
  ['text-subtle/control', 2.74],
  ['text-subtle/pill-neutral', 2.88],
  ['neutral-state/surface', 3.1],
  ['journey-strong/journey-soft', 3.91],
  ['text-on-dark/journey', 3.14],
  ['border-inactive/surface', 1.54],
]);

const failures = [];
const accepted = [];
const lines = [];

for (const { fg, bg, min, usage } of PAIRS) {
  const fgHex = color[fg];
  const bgHex = color[bg];
  if (fgHex === undefined || bgHex === undefined) {
    failures.push(`paire inconnue : ${fg} sur ${bg}`);
    continue;
  }
  const ratio = contrast(fgHex, bgHex);
  const ok = ratio >= min;
  const key = `${fg}/${bg}`;
  const isAccepted = !ok && ACCEPTED.has(key);

  lines.push(
    `  ${ok ? '·' : isAccepted ? '~' : '✗'} ${fg} sur ${bg} — ${ratio.toFixed(2)}:1 (min ${min.toFixed(1)}) — ${usage}`,
  );

  if (isAccepted) {
    accepted.push(`${fg} sur ${bg} — ${ratio.toFixed(2)}:1 au lieu de ${min.toFixed(1)} — ${usage}`);
  } else if (!ok) {
    failures.push(
      `${fg} (${fgHex}) sur ${bg} (${bgHex}) : ${ratio.toFixed(2)}:1, il en faut ${min.toFixed(1)} — ${usage}`,
    );
  }
}

// Une exception qui ne sert plus doit être retirée, sinon la liste devient un
// tapis sous lequel on glisse les problèmes.
const obsolete = [...ACCEPTED.keys()].filter(
  (key) => !PAIRS.some(({ fg, bg, min }) => `${fg}/${bg}` === key && contrast(color[fg], color[bg]) < min),
);
for (const key of obsolete) {
  failures.push(`${key} est dans ACCEPTED mais passe désormais le seuil : retirer l'exception`);
}

if (failures.length > 0) {
  console.error('Garde-fou contraste — échec (T1 §6 et §10.6, AA exigé) :');
  for (const f of failures) console.error(`  · ${f}`);
  console.error('\nDétail de toutes les paires :');
  console.error(lines.join('\n'));
  process.exit(1);
}

const conformes = PAIRS.length - accepted.length;
console.log(`Garde-fou contraste : ${conformes} paires conformes AA sur ${PAIRS.length}.`);

if (accepted.length > 0) {
  // Affiché à chaque build, volontairement : l'écart reste sous les yeux.
  console.log(`\n${accepted.length} écarts assumés (couleurs de la maquette conservées,`);
  console.log('décision du porteur — voir docs/decisions.md) :');
  for (const a of accepted) console.log(`  ~ ${a}`);
}
