// GÉNÉRÉ depuis docs/template/04 Parcours.dc.html, section J02, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import type { ParcoursData } from '../parcours/data';

export function J02MobileRegulariser(props: ParcoursData) {
  const { onContinue } = props;

  return (
    <>
      <main style={{ display: "contents" }}>
<div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 12px) 12px 10px", display: "flex", alignItems: "center", gap: "8px", background: "#fff", borderBottom: "1px solid #E6EBE9", flexShrink: "0" }}><span style={{ width: "40px", height: "40px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg></span><h1 style={{ margin: "0", fontSize: "16px", fontWeight: "700", flex: "1", minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Régulariser ma situation</h1></div><div style={{ overflow: "visible", padding: "12px 16px", display: "flex", flexDirection: "column", gap: "12px" }}><div style={{ fontSize: "14px", fontWeight: "700" }}>Précisez votre situation</div><div style={{ display: "flex", gap: "10px", alignItems: "center", padding: "12px 14px", borderRadius: "14px", background: "#fff", border: "1px solid #E6EBE9", flexShrink: "0" }}><span style={{ width: "18px", height: "18px", borderRadius: "999px", border: "1.5px solid #CBD5D1" }}></span><span style={{ fontSize: "13.5px", fontWeight: "600" }}>Régularisation</span></div><div style={{ display: "flex", gap: "10px", alignItems: "center", padding: "12px 14px", borderRadius: "14px", background: "#EFF7F3", border: "1.5px solid #16785E", flexShrink: "0" }}><span style={{ width: "18px", height: "18px", borderRadius: "999px", border: "5px solid #16785E" }}></span><span style={{ fontSize: "13.5px", fontWeight: "600" }}>Changement de statut</span></div><div style={{ display: "flex", gap: "10px", alignItems: "center", padding: "12px 14px", borderRadius: "14px", background: "#fff", border: "1px solid #E6EBE9", flexShrink: "0" }}><span style={{ width: "18px", height: "18px", borderRadius: "999px", border: "1.5px solid #CBD5D1" }}></span><span style={{ fontSize: "13.5px", fontWeight: "600" }}>Renouvellement</span></div><div style={{ fontSize: "12.5px", color: "#5D6B66", lineHeight: "1.5" }}>Les étapes s'adaptent à votre situation.</div></div><div style={{ flexShrink: "0", background: "#fff", borderTop: "1px solid #E6EBE9", padding: "12px 16px 28px", display: "flex", gap: "8px" }}><button style={{ height: "44px", padding: "0 18px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "13.5px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", whiteSpace: "nowrap", flexShrink: "0", flex: "1" }} onClick={onContinue}>Continuer</button></div>
      </main>
    </>
  );
}
