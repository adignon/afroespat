// GÉNÉRÉ depuis docs/template/03 Accueil v2.dc.html, section A14, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import type { AccueilData } from '../accueil/data';

export function A14MobileRattacher(props: AccueilData) {
  const { attachSteps, attachTopics, onContinue } = props;

  return (
    <>
      <div style={{ background: "#0A3F31", position: "relative", display: "flex", flexDirection: "column" }}>
      <main style={{ display: "contents" }}>

      <div style={{ padding: "70px 30px 0", color: "rgba(255,255,255,.4)", fontSize: "22px", fontWeight: "800", lineHeight: "1.2" }}>Pour Visale, déposez votre VLS-TS dès sa validation…</div>
      <div style={{ position: "absolute", left: "0", right: "0", bottom: "0", height: "78%", background: "#fff", borderRadius: "28px 28px 0 0", padding: "12px 18px 26px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <span style={{ alignSelf: "center", width: "40px", height: "5px", borderRadius: "999px", background: "#DDE3E0" }}></span>
        <div style={{ display: "flex", justifyContent: "center", gap: "6px" }}><span style={{ width: "6px", height: "6px", borderRadius: "999px", background: "#CBD5D1" }}></span><span style={{ width: "18px", height: "6px", borderRadius: "999px", background: "#16785E" }}></span><span style={{ width: "6px", height: "6px", borderRadius: "999px", background: "#CBD5D1" }}></span></div>
        <div><h1 style={{ margin: "0", fontSize: "21px", fontWeight: "800", letterSpacing: "-0.5px" }}>Ce conseil concerne…</h1><div style={{ fontSize: "13px", color: "#5D6B66", marginTop: "4px" }}>Il sera montré à ceux qui passent par la même étape.</div></div>
        <div style={{ height: "44px", borderRadius: "999px", background: "#F2F5F4", padding: "0 16px", display: "flex", alignItems: "center", gap: "10px", fontSize: "13.5px", color: "#8A958F" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>Rechercher une étape ou un sujet</div>
        <div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F" }}>MON PARCOURS · ÉTUDES</div>
        {(attachSteps ?? []).map((a, aIndex) => (
<Fragment key={aIndex}><div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "16px", background: a.bg, border: a.bd }}><span style={{ flex: "1", minWidth: "0" }}><span style={{ display: "block", fontSize: "14px", fontWeight: "700" }}>{a.t}</span><span style={{ display: "block", fontSize: "12px", color: "#5D6B66", marginTop: "1px" }}>{a.s}</span></span><span style={{ width: "24px", height: "24px", borderRadius: "999px", background: a.cBg, border: a.cBd, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="m5 12 4.5 4.5L19 7" /></svg></span></div></Fragment>
))}
        <div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F", marginTop: "2px" }}>SUJETS</div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>{(attachTopics ?? []).map((t, tIndex) => (
<Fragment key={tIndex}><span style={{ padding: "8px 13px", borderRadius: "999px", background: "#fff", border: "1px solid #E6EBE9", fontSize: "12.5px", fontWeight: "600" }}>{t}</span></Fragment>
))}</div>
        <div style={{ flex: "1" }}></div>
        <button style={{ height: "52px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "15px", fontWeight: "700" }} onClick={onContinue}>Continuer</button>
      </div>
    
      </main>
      </div>
    </>
  );
}
