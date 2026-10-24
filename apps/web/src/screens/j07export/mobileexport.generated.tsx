// GÉNÉRÉ depuis docs/template/04 Parcours.dc.html, section J07, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import { FAct } from '@/components/parcours/feuille-dessinee';
import type { ParcoursData } from '../parcours/data';

export function J07MobileExport(_props: ParcoursData) {
  return (
    <>
<div style={{ position: "fixed", inset: "0", background: "rgba(22,33,29,.55)" }} data-modal-overlay=""></div><div style={{ position: "fixed", left: "0", right: "0", bottom: "0", height: "auto", background: "#fff", borderRadius: "28px 28px 0 0", padding: "10px 16px 28px", display: "flex", flexDirection: "column", gap: "14px", maxHeight: "calc(100vh - 24px)", overflow: "hidden" }} data-modal-panel=""><button type="button" aria-label="Fermer" data-modal-close="" style={{ alignSelf: "center", width: "40px", height: "5px", borderRadius: "999px", background: "#DDE3E0", border: "none", padding: "10px 24px", font: "inherit", cursor: "pointer", boxSizing: "content-box", marginTop: "0", backgroundClip: "content-box" }}></button><h2 id="j07-titre" style={{ margin: "0", fontSize: "18px", fontWeight: "800" }}>Exporter mon parcours</h2><div data-fenetre-contenu="" style={{ flex: "1", minHeight: "0", overflowY: "auto", display: "flex", flexDirection: "column", gap: "14px" }}><div style={{ background: "#E3F0EB", borderRadius: "16px", padding: "14px" }}><div style={{ fontSize: "13.5px", fontWeight: "700", color: "#0F5C48" }}>Prêt à imprimer</div><div style={{ fontSize: "12.5px", lineHeight: "1.5", marginTop: "4px" }}>Un PDF avec vos étapes et leurs durées réelles. Vos notes n’y figurent pas.</div></div><FAct k="exporter" style={{ height: "44px", padding: "0 18px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "13.5px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", whiteSpace: "nowrap", flexShrink: "0", width: "100%" }}>Exporter</FAct></div><FAct k="plusTard" style={{ height: "44px", padding: "0 18px", borderRadius: "14px", background: "#F2F5F4", color: "#16211D", border: "none", font: "inherit", fontSize: "13.5px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", whiteSpace: "nowrap", flexShrink: "0", width: "100%" }}>Plus tard</FAct></div>
    </>
  );
}
