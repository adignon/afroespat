// GÉNÉRÉ depuis docs/template/06 Services.dc.html, section S05, cadre 440 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 440 px, ce qui ne
// serait pas responsive.
import type { S05Data } from '../s05/data';

export function S05LienExterne(props: S05Data) {
  const { offre } = props;

  return (
    <>
<div style={{ position: "fixed", inset: "0", background: "rgba(22,33,29,.55)" }} data-modal-overlay=""></div><div style={{ position: "fixed", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: "440px", background: "#fff", border: "1px solid #DDE3E0", borderRadius: "28px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px", flexShrink: "0", maxHeight: "calc(100vh - 48px)", overflow: "hidden" }} data-modal-panel=""><div style={{ display: "flex", alignItems: "center" }}><div style={{ flex: "1" }}><h2 id="s05-titre" style={{ margin: "0", fontSize: "20px", fontWeight: "800", letterSpacing: "-0.5px" }}>Vous quittez la plateforme</h2></div><button type="button" aria-label="Fermer" data-modal-close="" style={{ width: "40px", height: "40px", borderRadius: "999px", background: "#F2F5F4", display: "flex", alignItems: "center", justifyContent: "center", border: "none", padding: "0", font: "inherit", cursor: "pointer" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button></div><div data-fenetre-contenu="" style={{ flex: "1", minHeight: "0", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}><div style={{ fontSize: "14px", lineHeight: "1.6", color: "#5D6B66" }}>Vous allez sur <strong style={{ color: "#16211D" }}>{offre.domaine}</strong>. Ne communiquez jamais de coordonnées bancaires pour une candidature.</div></div><div style={{ display: "flex", gap: "8px" }}><button style={{ height: "44px", padding: "0 18px", borderRadius: "14px", background: "#F2F5F4", color: "#16211D", border: "none", font: "inherit", fontSize: "13.5px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", whiteSpace: "nowrap", flexShrink: "0" }}>Annuler</button><button style={{ height: "44px", padding: "0 18px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "13.5px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", whiteSpace: "nowrap", flexShrink: "0", flex: "1" }}>Continuer</button></div></div>
    </>
  );
}
