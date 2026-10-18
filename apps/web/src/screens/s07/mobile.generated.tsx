// GÉNÉRÉ depuis docs/template/06 Services.dc.html, section S07, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import type { S07Data } from './data';

export function S07Mobile(props: S07Data) {
  const { pro } = props;

  return (
    <>

      <main style={{ display: "contents" }}>
<div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 12px) 12px 10px", display: "flex", alignItems: "center", gap: "8px", background: "#fff", borderBottom: "1px solid #E6EBE9", flexShrink: "0" }}><span style={{ width: "40px", height: "40px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg></span><span style={{ fontSize: "16px", fontWeight: "700", flex: "1", minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Fiche pro</span><span style={{ width: "40px", height: "40px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg></span></div><div style={{ flexGrow: "1", overflow: "visible", padding: "12px 16px", display: "flex", flexDirection: "column", gap: "12px" }}><div style={{ display: "flex", alignItems: "center", gap: "12px" }}><span style={{ width: "60px", height: "60px", borderRadius: "999px", background: "#0F5C48", color: "#fff", fontSize: "19px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>{pro.initiales}</span><div><h1 style={{ margin: "0", display: "flex", alignItems: "center", gap: "6px", fontSize: "18px", fontWeight: "800" }}>{pro.nom}<span style={{ background: "#16785E", color: "#fff", fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "999px", whiteSpace: "nowrap" }}>{pro.palier}</span></h1><div style={{ fontSize: "12.5px", color: "#5D6B66" }}>{pro.metier}</div></div></div><div style={{ fontSize: "13.5px", lineHeight: "1.6" }}>{pro.description}</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}><div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "18px", padding: "16px" }}><div style={{ fontSize: "24px", fontWeight: "800", letterSpacing: "-0.6px", color: "#16211D" }}>{pro.tarif}</div><div style={{ fontSize: "12px", color: "#5D6B66", marginTop: "2px" }}>consultation</div></div><div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "18px", padding: "16px" }}><div style={{ fontSize: "24px", fontWeight: "800", letterSpacing: "-0.6px", color: "#16211D" }}>{pro.recos}</div><div style={{ fontSize: "12px", color: "#5D6B66", marginTop: "2px" }}>recommandations</div></div></div></div><div style={{ flexShrink: "0", background: "#fff", borderTop: "1px solid #E6EBE9", padding: "12px 16px 28px", display: "flex", gap: "8px" }}><button style={{ height: "44px", padding: "0 18px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "13.5px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", whiteSpace: "nowrap", flexShrink: "0", flex: "1" }}>Contacter · {pro.quotaCourt}</button></div>
      </main>
    </>
  );
}
