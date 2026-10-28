/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT (W3A) — LES FENÊTRES SANS CADRE MOBILE DEVIENNENT DES FEUILLES BASSES ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Cinq fenêtres de la maquette n'existent qu'en cadre d'ordinateur — une carte
 * centrée de 300 à 440 px : « Ajouter aux contacts » (K02CONTACT), « Supprimer mon
 * compte » (K08SUPPRESSION), le menu de conversation (M01MENU), « Vous quittez la
 * plateforme » (S05LIEN) et « Recommander un membre » (S05RECOMMANDER). Montées sur
 * un téléphone (`modales={{ … mobile: <K02Ajout/> }}`), elles gardaient donc leur
 * largeur fixe : 440 px de fenêtre dans 390 px d'écran, bord droit coupé.
 *
 * Aucune planche mobile n'existe pour elles. On ne leur en INVENTE pas une de
 * toutes pièces : on DÉRIVE du cadre d'ordinateur, mécaniquement, la feuille basse
 * que la maquette dessine pour toutes les autres fenêtres du dépôt (J08 « Arrêter
 * ce parcours » est la référence, relevée valeur pour valeur) :
 *
 *   · le panneau : collé en bas, pleine largeur, rayon `28px 28px 0 0`, gouttières
 *     `10px 16px 28px`, hauteur bornée à `calc(100vh - 24px)` ;
 *   · la POIGNÉE (barre de 40 × 5 px `#DDE3E0`) remplace le rond « Fermer » du coin :
 *     c'est elle qui porte `data-modal-close`, comme sur toutes les feuilles ;
 *   · le titre passe à 18 px (`letterSpacing` retiré), comme celui des feuilles.
 *
 * LES CHAMPS, LES GESTES, LES DONNÉES ET LES TEXTES SONT CEUX DE LA FENÊTRE : la
 * dérivation ne touche que l'enveloppe. Aucune couleur nouvelle. Le fichier produit
 * s'appelle `<cadre>feuille.generated.tsx` et exporte `<Section><Cadre>Feuille` ;
 * l'écran qui monte la fenêtre passe l'un en `desktop` et l'autre en `mobile`.
 */
export const FEUILLES_MOBILES = new Set([
  'k02contact',
  'k08suppression',
  'm01menu',
  's05lien',
  's05recommander',
]);

const PANNEAU =
  /style=\{\{ position: "fixed", left: "50%", top: "50%", transform: "translate\(-50%,-50%\)", width: "\d+px", background: "#fff", border: "1px solid #DDE3E0", borderRadius: "28px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px", flexShrink: "0", maxHeight: "calc\(100vh - 48px\)", (overflow(?:Y)?: "(?:hidden|auto)") \}\} data-modal-panel=""/;

const POIGNEE =
  '<button type="button" aria-label="Fermer" data-modal-close="" style={{ alignSelf: "center", width: "40px", height: "5px", borderRadius: "999px", background: "#DDE3E0", border: "none", padding: "20px 24px", font: "inherit", cursor: "pointer", boxSizing: "content-box", marginTop: "-10px", marginBottom: "-10px", backgroundClip: "content-box", flexShrink: "0" }}></button>';

/** Rend `null` si le cadre n'a pas la forme attendue : le générateur le dit alors. */
export function enFeuille(body, nom) {
  const m = PANNEAU.exec(body);
  if (m === null) return null;
  let sortie = body.replace(
    PANNEAU,
    `style={{ position: "fixed", left: "0", right: "0", bottom: "0", height: "auto", background: "#fff", borderRadius: "28px 28px 0 0", padding: "10px 16px 28px", display: "flex", flexDirection: "column", gap: "14px", maxHeight: "calc(100vh - 24px)", ${m[1]} }} data-modal-panel=""`,
  );

  // Le rond « Fermer » du coin cède la place à la poignée, posée AVANT l'en-tête.
  const FERMER =
    /<button type="button" aria-label="Fermer" data-modal-close="" style=\{\{ width: "40px", height: "40px"[^}]*\}\}>\s*<svg[\s\S]*?<\/svg>\s*<\/button>/;
  if (!FERMER.test(sortie)) return null;
  sortie = sortie.replace(FERMER, '');
  sortie = sortie.replace('data-modal-panel="">', `data-modal-panel="">\n${POIGNEE}`);

  // Le titre des feuilles : 18 px, sans resserrement.
  sortie = sortie.replace(
    /(<h2 id="[^"]+" style=\{\{ margin: "0", fontSize: )"20px", fontWeight: "800", letterSpacing: "-0\.5px"/,
    '$1"18px", fontWeight: "800"',
  );

  // Le nom de la fonction exportée, et l'en-tête qui dit d'où vient le fichier.
  sortie = sortie.replace(/export function (\w+)\(/, `export function ${nom}(`);
  sortie = sortie.replace(
    '// Ne pas modifier à la main',
    '// AJOUT : feuille basse DÉRIVÉE du cadre d\'ordinateur (voir tools/adaptations/feuilles-mobiles.mjs).\n// Ne pas modifier à la main',
  );
  return sortie;
}
