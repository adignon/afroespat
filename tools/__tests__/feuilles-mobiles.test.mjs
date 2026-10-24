/**
 * Test du convertisseur `enFeuille` (W3A) : fenêtre centrée de la maquette → feuille basse.
 * Lancé par `pnpm guardrails` : `node tools/__tests__/feuilles-mobiles.test.mjs`.
 */
import assert from 'node:assert/strict';
import { FEUILLES_MOBILES, enFeuille } from '../adaptations/feuilles-mobiles.mjs';

const FENETRE = `// GÉNÉRÉ depuis x
// Ne pas modifier à la main : relancer.
export function K02Ajout(props: K02Data) {
  return (
    <>
<div style={{ position: "fixed", inset: "0", background: "rgba(22,33,29,.55)" }} data-modal-overlay="">
</div>
<div style={{ position: "fixed", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: "420px", background: "#fff", border: "1px solid #DDE3E0", borderRadius: "28px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px", flexShrink: "0", maxHeight: "calc(100vh - 48px)", overflow: "hidden" }} data-modal-panel="">
<div style={{ display: "flex", alignItems: "center" }}><div style={{ flex: "1" }}><h2 id="k02-titre" style={{ margin: "0", fontSize: "20px", fontWeight: "800", letterSpacing: "-0.5px" }}>Titre</h2></div>
<button type="button" aria-label="Fermer" data-modal-close="" style={{ width: "40px", height: "40px", borderRadius: "999px", background: "#F2F5F4", display: "flex", alignItems: "center", justifyContent: "center", border: "none", padding: "0", font: "inherit", cursor: "pointer" }}>
<svg width="16" height="16"><path d="M1 1" /></svg>
</button></div>
<div data-fenetre-contenu="">corps</div>
</div>
    </>
  );
}
`;

const feuille = enFeuille(FENETRE, 'K02AjoutFeuille');
assert.ok(feuille !== null, 'une fenêtre de la maquette doit être convertie');
// Le panneau est collé en bas, pleine largeur, arrondi en haut seulement.
assert.match(feuille, /left: "0", right: "0", bottom: "0"/);
assert.match(feuille, /borderRadius: "28px 28px 0 0"/);
assert.match(feuille, /padding: "10px 16px 28px"/);
assert.doesNotMatch(feuille, /translate\(-50%/, 'plus de centrage');
assert.doesNotMatch(feuille, /width: "420px"/, 'plus de largeur fixe');
// Le débordement d'origine est conservé (le contenu défile dans `data-fenetre-contenu`).
assert.match(feuille, /overflow: "hidden" \}\} data-modal-panel/);
// Le rond « Fermer » cède la place à la poignée, qui porte `data-modal-close` (un seul).
assert.equal((feuille.match(/data-modal-close/g) ?? []).length, 1);
assert.match(feuille, /width: "40px", height: "5px"/);
// Le titre passe à 18 px sans resserrement ; le nom exporté change ; le contenu est intact.
assert.match(feuille, /fontSize: "18px", fontWeight: "800"\}?/);
assert.doesNotMatch(feuille, /letterSpacing: "-0.5px"/);
assert.match(feuille, /export function K02AjoutFeuille\(/);
assert.match(feuille, /data-fenetre-contenu="">corps/);
// Un cadre qui n'a pas la forme attendue n'est PAS converti en silence.
assert.equal(enFeuille('<div>rien</div>', 'X'), null);
// Un menu au débordement vertical garde `overflowY: "auto"`.
const menu = FENETRE.replace('overflow: "hidden" }} data-modal-panel', 'overflowY: "auto" }} data-modal-panel');
assert.match(enFeuille(menu, 'M'), /overflowY: "auto" \}\} data-modal-panel/);
// Les cinq fenêtres déclarées.
assert.deepEqual(
  [...FEUILLES_MOBILES].sort(),
  ['k02contact', 'k08suppression', 'm01menu', 's05lien', 's05recommander'],
);
console.log('feuilles-mobiles : OK');
