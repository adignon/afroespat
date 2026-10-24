// GÉNÉRÉ depuis docs/template/06 Services.dc.html, section S05, cadre 440 px.
// AJOUT : feuille basse DÉRIVÉE du cadre d'ordinateur (voir tools/adaptations/feuilles-mobiles.mjs).
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 440 px, ce qui ne
// serait pas responsive.
import type { S05Data } from '../s05/data';

export function S05LienExterneFeuille(props: S05Data) {
  const { offre, vivant } = props;

  return (
    <>
<div style={{ position: "fixed", inset: "0", background: "rgba(22,33,29,.55)" }} data-modal-overlay=""></div><div style={{ position: "fixed", left: "0", right: "0", bottom: "0", height: "auto", background: "#fff", borderRadius: "28px 28px 0 0", padding: "10px 16px 28px", display: "flex", flexDirection: "column", gap: "14px", maxHeight: "calc(100vh - 24px)", overflow: "hidden" }} data-modal-panel="">
<button type="button" aria-label="Fermer" data-modal-close="" style={{ alignSelf: "center", width: "40px", height: "5px", borderRadius: "999px", background: "#DDE3E0", border: "none", padding: "10px 24px", font: "inherit", cursor: "pointer", boxSizing: "content-box", marginTop: "0", backgroundClip: "content-box", flexShrink: "0" }}></button><div style={{ display: "flex", alignItems: "center" }}><div style={{ flex: "1" }}><h2 id="s05-titre" style={{ margin: "0", fontSize: "18px", fontWeight: "800" }}>Vous quittez la plateforme</h2></div></div><div data-fenetre-contenu="" style={{ flex: "1", minHeight: "0", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}><div style={{ fontSize: "14px", lineHeight: "1.6", color: "#5D6B66" }}>Vous allez sur <strong style={{ color: "#16211D" }}>{offre.domaine}</strong>. Ne communiquez jamais de coordonnées bancaires pour une candidature.</div></div><div style={{ display: "flex", gap: "8px" }}><button type="button" data-modal-close="" style={{ height: "44px", padding: "0 18px", borderRadius: "14px", background: "#F2F5F4", color: "#16211D", border: "none", font: "inherit", fontSize: "13.5px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", whiteSpace: "nowrap", flexShrink: "0" }}>Annuler</button><button type="button" onClick={vivant.onContinuer} style={{ height: "44px", padding: "0 18px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "13.5px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", whiteSpace: "nowrap", flexShrink: "0", flex: "1" }}>Continuer</button></div></div>
    </>
  );
}
