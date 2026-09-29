// GÉNÉRÉ depuis docs/template/09 Messages et transverse.dc.html, section X03, cadre 360 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 360 px, ce qui ne
// serait pas responsive.
import type { MessagesData } from '../messages/data';

export function X03MobileConfirmation(_props: MessagesData) {
  return (
    <>
<div style={{ position: "fixed", inset: "0", background: "rgba(22,33,29,.55)" }} data-modal-overlay=""></div><div style={{ position: "fixed", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: "360px", background: "#fff", border: "1px solid #DDE3E0", borderRadius: "28px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px", flexShrink: "0" }} data-modal-panel=""><span style={{ width: "52px", height: "52px", borderRadius: "16px", background: "#16785E", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4.5 4.5L19 7" /></svg></span><h2 id="x03-titre" style={{ margin: "0", fontSize: "19px", fontWeight: "800" }}>Merci.</h2><div style={{ fontSize: "14px", color: "#5D6B66" }}>Nous regardons sous 24 heures.</div></div>
    </>
  );
}
