// GÉNÉRÉ depuis docs/template/03 Accueil v2.dc.html, section A02, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import type { AccueilData } from '../accueil/data';

export function A02Mobile(props: AccueilData) {
  const { comments } = props;

  return (
    <>
      <main style={{ display: "contents" }}>

    <div style={{ padding: "52px 16px 12px", display: "flex", alignItems: "center", gap: "10px", background: "#fff", borderBottom: "1px solid #E6EBE9" }}><span style={{ width: "40px", height: "40px", borderRadius: "999px", background: "#F2F5F4", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg></span><span style={{ fontSize: "16px", fontWeight: "700" }}>Question</span></div>
    <div style={{ flex: "1", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "12px", overflow: "hidden" }}>
      <div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "20px", padding: "16px" }}><div style={{ display: "flex", alignItems: "center", gap: "10px" }}><span style={{ width: "40px", height: "40px", borderRadius: "999px", background: "#2FA37D", color: "#fff", fontSize: "12px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}>FN</span><div><div style={{ fontSize: "14.5px", fontWeight: "700" }}>Fatou Ndiaye</div><div style={{ fontSize: "12px", color: "#8A958F" }}>Lyon 7e · il y a 6 h</div></div></div><p style={{ margin: "12px 0 0", fontSize: "14.5px", lineHeight: "1.58" }}>Quelqu'un connaîtrait un médecin généraliste qui prend de nouveaux patients sur Lyon 7e ou 3e ?</p></div>
      {(comments ?? []).map((c, cIndex) => (
<Fragment key={cIndex}><div style={{ display: "flex", gap: "10px", paddingLeft: c.indentM }}><span style={{ width: "32px", height: "32px", borderRadius: "999px", background: c.bg, color: "#fff", fontSize: "10px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>{c.i}</span><div style={{ background: "#fff", borderRadius: "14px", padding: "10px 12px", border: "1px solid #EAEEEC" }}><div style={{ fontSize: "13px", fontWeight: "700" }}>{c.name}</div><div style={{ fontSize: "13px", lineHeight: "1.5", marginTop: "2px" }}>{c.text}</div></div></div></Fragment>
))}
    </div>
    <div style={{ padding: "10px 12px 28px", background: "#fff", borderTop: "1px solid #E6EBE9", display: "flex", gap: "8px" }}><div style={{ flex: "1", height: "44px", borderRadius: "999px", background: "#F2F5F4", padding: "0 16px", display: "flex", alignItems: "center", fontSize: "13.5px", color: "#8A958F" }}>Écrire une réponse…</div><span style={{ width: "44px", height: "44px", borderRadius: "999px", background: "#16785E", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></span></div>
  
      </main>
    </>
  );
}
