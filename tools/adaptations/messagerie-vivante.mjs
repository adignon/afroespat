/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LOT « MESSAGERIE VIVANTE » — M01, X01, X02, X04, K07 (heures calmes, résumé)║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le lot F rend vivants la messagerie, le temps réel, les notifications et la
 * recherche. Ce fichier tient ce que le JSX transcodé ne portait pas : un endroit
 * pour les gestes par bulle, un pied de fil, une croix sur le menu de la
 * conversation, et — plus bas — les gestes des notifications et de la recherche.
 *
 * Appliqué AVANT l'en-tête global et les zones de mise en page (voir
 * `generate-screens.mjs`) : ses motifs lisent le JSX des cadres tel que les
 * adaptations précédentes l'ont laissé, et l'en-tête global lit ensuite la barre.
 *
 * ⚠ ÉCARTS À LA MAQUETTE (AJOUTS, remontés au porteur) :
 *   · « Supprimer » / « Signaler » sous chaque bulle — `components/messagerie/actions-bulle` ;
 *   · le pied du fil (demande à accepter/ignorer, attente de réponse, « écrit… ») —
 *     `components/messagerie/pied-conversation` ;
 *   · une croix de fermeture sur le menu de la conversation, que la maquette ne dessine pas.
 */

/** Remplace la première occurrence d'un motif ; `null` si absent. */
function remplacerUn(jsx, motif, vers) {
  const m = motif.exec(jsx);
  if (m === null) return null;
  const neuf = typeof vers === 'function' ? vers(m) : vers;
  return jsx.slice(0, m.index) + neuf + jsx.slice(m.index + m[0].length);
}

const FIL = '{(messages ?? []).map(';

/**
 * ── 1. LE FIL : REPÈRE, DÉFILEMENT, PIED ─────────────────────────────────────
 *
 * Le conteneur des bulles reçoit `data-fil-messages` (le front y défile vers le bas
 * quand un message arrive) ; sur 390 px il était en `overflow: hidden`, c'est-à-dire
 * qu'une conversation plus longue que l'écran était COUPÉE — il devient défilable.
 * Après lui, `{pied}` : demande de conversation, attente, « écrit… ».
 */
export const MV_FIL = {
  screens: ['M01'],
  nom: 'MV_FIL',
  why: 'Le fil de la conversation portait un conteneur muet : on y pose le repère de défilement, le défilement mobile (il était coupé), et le pied (demande à accepter, attente, « écrit… »).',
  provides: ['pied'],
  apply(jsx) {
    const i = jsx.indexOf(FIL);
    if (i < 0) return { jsx, applied: false };
    const debut = jsx.lastIndexOf('<div style={{', i);
    const fin = jsx.indexOf('))}</div>', i);
    if (debut < 0 || fin < 0) return { jsx, applied: false };
    const finOuvrante = jsx.indexOf('>', debut);
    let ouvrante = jsx.slice(debut, finOuvrante);
    // Défilable : `overflow: "hidden"` coupait les longues conversations sur 390 px.
    ouvrante = ouvrante.replace('overflow: "hidden"', 'overflowY: "auto", minHeight: "0"');
    const neuf =
      '<div data-fil-messages=""' +
      ouvrante.slice('<div'.length) +
      jsx.slice(finOuvrante, fin + '))}</div>'.length) +
      '{pied ?? null}';
    return { jsx: jsx.slice(0, debut) + neuf + jsx.slice(fin + '))}</div>'.length), applied: true };
  },
};

/**
 * ── 2. L'HEURE DEVIENT UNE RANGÉE : HEURE (· Vu) + GESTE ────────────────────
 */
export const MV_BULLE_ACTIONS = {
  screens: ['M01'],
  nom: 'MV_BULLE_ACTIONS',
  why: 'Sous chaque bulle, « Supprimer » (la mienne) ou « Signaler » (celle de l’autre) : la maquette ne dessinait que l’heure.',
  provides: [],
  apply(jsx) {
    const out = remplacerUn(
      jsx,
      /\{m\.mention \? \(<>(<span style=\{\{ [^}]*\}\}>)\{m\.mention\}<\/span><\/>\) : null\}/,
      (m) =>
        '{m.mention || m.actions ? (<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>' +
        `{m.mention ? (${m[1]}{m.mention}</span>) : null}` +
        '{m.actions ?? null}</div>) : null}',
    );
    return out === null ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

/**
 * ── 3. UNE CROIX SUR LE MENU DE LA CONVERSATION ─────────────────────────────
 *
 * Le menu (carte de 300 px) n'avait ni croix ni poignée : il ne se fermait qu'au
 * voile, ce qu'un téléphone tenu d'une main rend peu évident. La croix est celle de
 * la fenêtre « Signaler » de X03 (même maquette), 40 px sur `#F2F5F4`, avec la
 * zone de clic de 44 px que les boutons ronds de cette maquette ont déjà.
 */
const CROIX =
  '<button type="button" aria-label="Fermer" data-modal-close="" style={{ width: "40px", height: "40px", borderRadius: "999px", background: "#F2F5F4", display: "flex", alignItems: "center", justifyContent: "center", border: "none", font: "inherit", cursor: "pointer", flexShrink: "0", boxSizing: "content-box", padding: "2px", margin: "-2px", backgroundClip: "content-box" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button>';

export const MV_MENU_CROIX = {
  screens: ['M01'],
  nom: 'MV_MENU_CROIX',
  why: 'Le menu de la conversation n’avait aucune fermeture visible : une croix, celle de la fenêtre « Signaler » de la même maquette.',
  provides: [],
  apply(jsx) {
    const out = remplacerUn(
      jsx,
      /<div style=\{\{ [^}]*\}\}>MENU DE LA CONVERSATION<\/div>/,
      (m) =>
        `<div style={{ display: "flex", alignItems: "center", gap: "12px" }}><div style={{ flex: "1" }}>${m[0]}</div>${CROIX}</div>`,
    );
    return out === null ? { jsx, applied: false } : { jsx: out, applied: true };
  },
};

export const ADAPTATIONS_MESSAGERIE_VIVANTE = [MV_FIL, MV_BULLE_ACTIONS, MV_MENU_CROIX];

/** Les composants que ces adaptations posent, pour le registre d'imports. */
export const AJOUTS_MESSAGERIE_VIVANTE = {};
