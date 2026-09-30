/**
 * Données de l'écran A06 — les propositions reçues, et « Proposer une correction ».
 *
 * ── QUATRE CADRES, TROIS PRISES ─────────────────────────────────────────────
 *
 * Les quatre cadres de A06 — la page « Propositions reçues » de l'auteur et le
 * panneau « Proposer une correction », chacun en ordinateur et en mobile — ne
 * lisent que la NAVIGATION : le rail, le panneau de section et les raccourcis.
 *
 * Tout le reste est du balisage statique dans la maquette : le passage visé, le
 * remplacement proposé, le motif, le nom du proposant, le délai avant escalade,
 * les trois boutons de décision. Le transcodeur les a écrits en dur dans
 * `*.generated.tsx`, et ces fichiers ne se modifient pas à la main.
 *
 * C'est la limite du lot pour cet écran, et elle est structurelle : brancher A06
 * demande que la maquette pose des marqueurs sur sa planche avant/après, puis une
 * régénération. Remonté au rapport de lot.
 *
 * Ce qui EST fait : `screens/guides/api.ts` porte les cinq appels de §2.4 —
 * `fetchProposals`, `createProposal`, `acceptProposal`, `amendProposal`,
 * `rejectProposal` — tous validés par les schémas de `@app/shared`, et
 * `from-api.ts` sait déjà composer l'avant/après et le délai restant avant
 * escalade. Le jour où le cadre expose ses prises, il ne reste qu'à les relier.
 */
import { panel, rail, shortcuts } from '../a01/data';

export { panel, rail, shortcuts };

export const panelGuides = panel(1);

/** Ce que les quatre cadres générés de A06 consomment. */
export interface A06Data {
  rail: typeof rail;
  panelGuides: typeof panelGuides;
  shortcuts: typeof shortcuts;
}
