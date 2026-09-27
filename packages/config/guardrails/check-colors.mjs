#!/usr/bin/env node
/**
 * Garde-fou : la palette est fermée, et il n'y a AUCUN ROUGE.
 *
 * RÈGLE DURE (00-fondations.md §1.2, T1 §2.1) : aucun rouge dans l'interface.
 * Un parcours migratoire n'a pas d'état d'échec — une étape se met en pause. Le
 * rouge porterait une connotation que le produit refuse.
 *
 * La détection se fait sur la TEINTE en HSL, pas sur les composantes RVB : le
 * terre cuite `#E0733A` a un rouge dominant mais une teinte de 23° — c'est un
 * orange, et il est autorisé (réservé au parcours). Un test naïf sur R > G et
 * R > B le rejetterait à tort.
 *
 * Lancé par `pnpm guardrails`, bloquant en CI.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { color } = require(resolve(here, '..', 'tokens.js'));

/** Teinte en degrés (0–360), saturation et luminosité en pourcentage. */
function toHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  return { hue, saturation: saturation * 100, lightness: lightness * 100 };
}

/**
 * Rouge = teinte dans [345°, 360°] ∪ [0°, 15°], avec une saturation qui se voit.
 * La borne à 15° laisse passer le terre cuite (23°) et refuse le rouge vif (0°)
 * comme le rouge-rose (350°).
 */
function isRed({ hue, saturation, lightness }) {
  if (saturation < 25) return false; // gris ou quasi gris
  if (lightness > 92 || lightness < 8) return false; // quasi blanc ou quasi noir
  return hue >= 345 || hue <= 15;
}

const failures = [];

for (const [name, value] of Object.entries(color)) {
  if (!/^#[0-9A-Fa-f]{6}$/.test(value)) {
    failures.push(`${name} : « ${value} » n'est pas un hexadécimal à 6 chiffres`);
    continue;
  }
  const hsl = toHsl(value);
  if (isRed(hsl)) {
    failures.push(
      `${name} = ${value} est un rouge (teinte ${hsl.hue.toFixed(0)}°) — interdit par la règle dure §1.2`,
    );
  }
}

// Le terre cuite doit rester dans la famille orange : s'il dérivait vers le rouge,
// la règle dure tomberait sans que personne ne le remarque.
for (const name of ['journey', 'journey-strong']) {
  const hsl = toHsl(color[name]);
  if (hsl.hue < 16 || hsl.hue > 45) {
    failures.push(
      `${name} = ${color[name]} sort de la famille orange (teinte ${hsl.hue.toFixed(0)}°, attendue 16–45°)`,
    );
  }
}

if (failures.length > 0) {
  console.error('Garde-fou couleurs — échec :');
  for (const f of failures) console.error(`  · ${f}`);
  process.exit(1);
}

const count = Object.keys(color).length;
console.log(`Garde-fou couleurs : ${count} jetons, aucun rouge, terre cuite dans la famille orange.`);
