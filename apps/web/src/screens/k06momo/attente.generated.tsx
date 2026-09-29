// GÉNÉRÉ depuis docs/template/08 Compte.dc.html, section K06, cadre 380 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 380 px, ce qui ne
// serait pas responsive.
import type { CompteData } from '../compte/data';

export function K06Attente(_props: CompteData) {
  return (
    <>
<div style={{ position: "fixed", inset: "0", background: "rgba(22,33,29,.55)" }} data-modal-overlay=""></div><div style={{ position: "fixed", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: "380px", background: "#fff", border: "1px solid #DDE3E0", borderRadius: "28px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px", flexShrink: "0" }} data-modal-panel=""><div style={{ display: "flex", alignItems: "center" }}><div style={{ flex: "1" }}><div style={{ fontSize: "12px", fontWeight: "700", color: "#8A958F" }}>Étape 2 sur 3</div><h2 id="k06-titre" style={{ margin: "0", fontSize: "20px", fontWeight: "800", letterSpacing: "-0.5px" }}>Payer avec Mobile Money</h2></div><button type="button" aria-label="Fermer" data-modal-close="" style={{ width: "40px", height: "40px", borderRadius: "999px", background: "#F2F5F4", display: "flex", alignItems: "center", justifyContent: "center", border: "none", padding: "0", font: "inherit", cursor: "pointer" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button></div><div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "16px 0" }}><span style={{ width: "64px", height: "64px", borderRadius: "999px", border: "5px solid #E3F0EB", borderTopColor: "#16785E" }}></span><div style={{ fontSize: "15px", fontWeight: "700" }}>Validez sur votre téléphone</div><div style={{ fontSize: "13px", color: "#5D6B66", textAlign: "center" }}>Composez *880# et confirmez. Temps restant : 4:12</div></div></div>
    </>
  );
}
