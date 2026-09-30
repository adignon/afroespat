// GÉNÉRÉ depuis docs/template/03 Accueil v2.dc.html, section A14, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import type { A14Data } from './data';

export function A14Mobile(props: A14Data) {
  const { palette, storyKinds, writeBg } = props;

  return (
    <>
      <div style={{ background: writeBg, color: "#fff", display: "flex", flexDirection: "column", padding: "48px 16px 26px" }}>
      <main style={{ display: "contents" }}>

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><span style={{ width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg></span><span style={{ flex: "1", display: "flex", justifyContent: "center", gap: "6px" }}><span style={{ width: "18px", height: "6px", borderRadius: "999px", background: "#fff" }}></span><span style={{ width: "6px", height: "6px", borderRadius: "999px", background: "rgba(255,255,255,.4)" }}></span><span style={{ width: "6px", height: "6px", borderRadius: "999px", background: "rgba(255,255,255,.4)" }}></span></span><span style={{ width: "40px", height: "40px", borderRadius: "999px", background: "rgba(255,255,255,.14)", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M7 12h10M5 18h14" /></svg></span><span style={{ width: "40px", height: "40px", borderRadius: "999px", background: "rgba(255,255,255,.14)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", fontWeight: "800" }}>Aa</span><span style={{ width: "40px", height: "40px", borderRadius: "999px", background: "rgba(255,255,255,.14)", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"><path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a4 4 0 0 0 4-4c0-4.4-4-8-9-8z" /><circle cx="7.5" cy="11" r="1" /><circle cx="10" cy="7" r="1" /><circle cx="15" cy="7" r="1" /></svg></span></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "4px", background: "rgba(0,0,0,.18)", borderRadius: "999px", padding: "4px", marginTop: "14px" }}>{(storyKinds ?? []).map((k, kIndex) => (
<Fragment key={kIndex}><button onClick={k.onPick} style={{ height: "38px", borderRadius: "999px", border: "none", font: "inherit", fontSize: "13px", fontWeight: "700", cursor: "pointer", background: k.bg, color: k.fg }}>{k.label}</button></Fragment>
))}</div>
      <div style={{ flex: "1", display: "flex", flexDirection: "column", justifyContent: "center", gap: "12px", padding: "0 8px" }}>
        <div style={{ fontSize: "30px", fontWeight: "800", lineHeight: "1.2", letterSpacing: "-0.6px" }}>Pour Visale, déposez votre VLS-TS dès sa validation sur l'ANEF. Réponse en 48 h.<span style={{ display: "inline-block", width: "3px", height: "32px", background: "#fff", verticalAlign: "-6px", marginLeft: "3px", borderRadius: "2px" }}></span></div>
        <div style={{ fontSize: "12.5px", fontWeight: "700", color: "rgba(255,255,255,.7)" }}>118 / 280</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>{(palette ?? []).map((c, cIndex) => (
<Fragment key={cIndex}><button onClick={c.onPick} style={{ width: "34px", height: "34px", borderRadius: "999px", background: c.hex, border: c.bd, cursor: "pointer", padding: "0" }} aria-label={`Fond ${c.hex}`} aria-pressed={c.on}></button></Fragment>
))}</div>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "16px" }}><span style={{ height: "48px", padding: "0 18px", borderRadius: "999px", background: "rgba(255,255,255,.16)", display: "flex", alignItems: "center", gap: "8px", fontSize: "13.5px", fontWeight: "700" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m5 17 5-5 3 3 2-2 4 4" /><circle cx="9" cy="9" r="1.4" /></svg>Photo</span><span style={{ flex: "1", fontSize: "11.5px", color: "rgba(255,255,255,.72)", lineHeight: "1.4" }}>Un seul message, court et utile.</span><span style={{ width: "58px", height: "58px", borderRadius: "999px", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></span></div>
    
      </main>
      </div>
    </>
  );
}
