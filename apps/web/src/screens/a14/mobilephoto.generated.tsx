// GÉNÉRÉ depuis docs/template/03 Accueil v2.dc.html, section A14, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import type { A14Data } from './data';

export function A14MobilePhoto(props: A14Data) {
  const { photoTools } = props;

  return (
    <>
      <div style={{ background: "repeating-linear-gradient(135deg,#46564F 0 14px,#3E4D47 14px 28px)", color: "#fff", display: "flex", flexDirection: "column", padding: "48px 16px 26px", position: "relative" }}>
      <main style={{ display: "contents" }}>

      <div style={{ position: "absolute", left: "0", right: "0", bottom: "0", height: "60%", background: "linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.72))" }}></div>
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "8px" }}><span style={{ width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg></span><span style={{ flex: "1", display: "flex", justifyContent: "center", gap: "6px" }}><span style={{ width: "18px", height: "6px", borderRadius: "999px", background: "#fff" }}></span><span style={{ width: "6px", height: "6px", borderRadius: "999px", background: "rgba(255,255,255,.4)" }}></span><span style={{ width: "6px", height: "6px", borderRadius: "999px", background: "rgba(255,255,255,.4)" }}></span></span><span style={{ width: "40px" }}></span></div>
      <div style={{ position: "relative", display: "flex", gap: "8px", justifyContent: "center", marginTop: "14px" }}>{(photoTools ?? []).map((t, tIndex) => (
<Fragment key={tIndex}><span style={{ height: "38px", padding: "0 14px", borderRadius: "999px", background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", fontSize: "12.5px", fontWeight: "700" }}>{t}</span></Fragment>
))}</div>
      <div style={{ position: "relative", flex: "1", display: "flex", flexDirection: "column", justifyContent: "flex-end", paddingBottom: "28px" }}>
        <div style={{ position: "relative", border: "1.5px dashed rgba(255,255,255,.85)", borderRadius: "14px", padding: "16px" }}>
          <span style={{ position: "absolute", left: "-6px", top: "-6px", width: "12px", height: "12px", borderRadius: "999px", background: "#fff" }}></span><span style={{ position: "absolute", right: "-6px", top: "-6px", width: "12px", height: "12px", borderRadius: "999px", background: "#fff" }}></span><span style={{ position: "absolute", left: "-6px", bottom: "-6px", width: "12px", height: "12px", borderRadius: "999px", background: "#fff" }}></span><span style={{ position: "absolute", right: "-6px", bottom: "-6px", width: "12px", height: "12px", borderRadius: "999px", background: "#fff" }}></span>
          <div style={{ fontSize: "26px", fontWeight: "800", lineHeight: "1.2", letterSpacing: "-0.5px" }}>Épicerie Wax et Saveurs : attiéké frais le samedi matin.</div>
        </div>
      </div>
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "flex-end" }}><span style={{ width: "58px", height: "58px", borderRadius: "999px", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></span></div>
    
      </main>
      </div>
    </>
  );
}
