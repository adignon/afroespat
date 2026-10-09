// GÉNÉRÉ depuis docs/template/06 Services.dc.html, section S08, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import type { S08Data } from './data';

export function S08Mobile(props: S08Data) {
  const { offrePro } = props;

  return (
    <>
      <main style={{ display: "contents" }}>
<div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 12px) 12px 10px", display: "flex", alignItems: "center", gap: "8px", background: "#fff", borderBottom: "1px solid #E6EBE9", flexShrink: "0" }}><span style={{ width: "40px", height: "40px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg></span><h1 style={{ margin: "0", fontSize: "16px", fontWeight: "700", flex: "1", minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Ma fiche pro</h1></div><div style={{ flexGrow: "1", overflow: "visible", padding: "12px 16px", display: "flex", flexDirection: "column", gap: "12px" }}><div style={{ flexShrink: "0" }}><div style={{ fontSize: "12.5px", fontWeight: "700", marginBottom: "6px" }}>Métier</div><div style={{ minHeight: "48px", borderRadius: "14px", border: "1.5px solid #16785E", background: "#fff", padding: "13px 14px", fontSize: "14px", lineHeight: "1.5" }}>Avocate</div></div><div style={{ flexShrink: "0" }}><div style={{ fontSize: "12.5px", fontWeight: "700", marginBottom: "6px" }}>Description</div><div style={{ minHeight: "48px", borderRadius: "14px", border: "1px solid #E6EBE9", background: "#fff", padding: "13px 14px", fontSize: "14px", lineHeight: "1.5", color: "#8A958F" }}>Titres de séjour…</div></div><div style={{ display: "flex", gap: "6px", flexWrap: "wrap", flexShrink: "0" }}><span style={{ padding: "8px 13px", borderRadius: "999px", fontSize: "12.5px", fontWeight: "700", whiteSpace: "nowrap", background: "#fff", color: "#16211D", border: "1px solid #E6EBE9" }}>Lyon ×</span><span style={{ padding: "8px 13px", borderRadius: "999px", fontSize: "12.5px", fontWeight: "700", whiteSpace: "nowrap", background: "#fff", color: "#16211D", border: "1px solid #E6EBE9" }}>Villeurbanne ×</span></div><div style={{ height: "70px", borderRadius: "14px", border: "1.5px dashed #CBD5D1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12.5px", fontWeight: "700", color: "#5D6B66" }}>Déposer le justificatif</div><div style={{ padding: "16px", borderRadius: "18px", background: "#EFF7F3", border: "2px solid #16785E" }}><div style={{ fontSize: "15px", fontWeight: "700" }}>{offrePro.nom}</div><div style={{ fontSize: "20px", fontWeight: "800", marginTop: "6px" }}>{offrePro.prix}</div><div style={{ fontSize: "12px", color: "#5D6B66", marginTop: "8px", lineHeight: "1.5" }}>Badge Pro, 10 villes</div></div></div><div style={{ flexShrink: "0", background: "#fff", borderTop: "1px solid #E6EBE9", padding: "12px 16px 28px", display: "flex", gap: "8px" }}><button style={{ height: "44px", padding: "0 18px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "13.5px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", whiteSpace: "nowrap", flexShrink: "0", flex: "1" }}>Envoyer</button></div>
      </main>
    </>
  );
}
