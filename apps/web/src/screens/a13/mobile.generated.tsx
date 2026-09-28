// GÉNÉRÉ depuis docs/template/03 Accueil v2.dc.html, section A13, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import type { AccueilData } from '../accueil/data';

export function A13Mobile(props: AccueilData) {
  const { st } = props;

  return (
    <>
      <main style={{ display: "contents" }}>

        <div style={{ position: "relative", width: "100%", height: "100%", background: st.bg, color: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {st.photo ? (<><div style={{ position: "absolute", inset: "0", background: "repeating-linear-gradient(135deg,#46564F 0 14px,#3E4D47 14px 28px)" }}></div><div style={{ position: "absolute", left: "0", right: "0", top: "34%", textAlign: "center", fontSize: "11.5px", fontWeight: "600", color: "rgba(255,255,255,.55)" }}>Photo de l'auteur</div><div style={{ position: "absolute", left: "0", right: "0", bottom: "0", height: "60%", background: "linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.78))" }}></div></>) : null}
          <div style={{ position: "relative", padding: "48px 14px 0", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", gap: "4px" }}>{(st.bars ?? []).map((b, bIndex) => (
<Fragment key={bIndex}><span style={{ flex: "1", height: "3px", borderRadius: "999px", background: "rgba(255,255,255,.3)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: b, background: "#fff" }}></span></span></Fragment>
))}</div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}><span style={{ width: "40px", height: "40px", borderRadius: "999px", border: "2px solid #fff", background: st.avBg, fontSize: "12px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>{st.i}</span><span style={{ flex: "1", minWidth: "0" }}><span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "14px", fontWeight: "700" }}>{st.name}<svg width="14" height="14" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#fff" /><path d="m8 12 3 3 5-6" stroke="#16785E" strokeWidth="2.4" fill="none" /></svg></span><span style={{ display: "block", fontSize: "11.5px", color: "rgba(255,255,255,.8)" }}>{st.sub}</span></span><span style={{ width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg></span></div>
            <span style={{ alignSelf: "flex-start", background: "#fff", color: st.pillFg, fontSize: "10.5px", fontWeight: "800", letterSpacing: ".8px", padding: "6px 12px", borderRadius: "999px" }}>{st.pill}</span>
          </div>
          <div style={{ position: "relative", flex: "1", display: "flex", flexDirection: "column", justifyContent: st.align, padding: "22px 22px 18px", gap: "14px" }}>
            <div style={{ fontSize: "11px", fontWeight: "800", letterSpacing: "1.4px", color: "rgba(255,255,255,.78)" }}>{st.label}</div>
            <div style={{ fontSize: "28px", fontWeight: "800", lineHeight: "1.18", letterSpacing: "-0.6px", textWrap: "pretty" }}>{st.text}</div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(255,255,255,.14)", borderRadius: "16px", padding: "12px 14px", fontSize: "12.5px", fontWeight: "600", lineHeight: "1.45" }}>{st.confirmers ? (<><span style={{ display: "flex", paddingLeft: "6px", flexShrink: "0" }}>{(st.confirmers ?? []).map((c, cIndex) => (
<Fragment key={cIndex}><span style={{ width: "26px", height: "26px", borderRadius: "999px", background: c.bg, border: "2px solid rgba(255,255,255,.9)", marginLeft: "-6px", fontSize: "9px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}>{c.i}</span></Fragment>
))}</span></>) : null}<span>{st.state}</span></div>
          </div>
          <div style={{ position: "relative", padding: "0 14px 26px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}><span style={{ height: "48px", borderRadius: "999px", background: "#fff", color: "#0F5C48", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "14px", fontWeight: "800", whiteSpace: "nowrap" }}>{st.useful ? (<><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0F5C48" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4.5 4.5L19 7" /></svg></>) : null}{st.a1}<span style={{ color: "#6FA893", fontSize: "12.5px", fontWeight: "700" }}>{st.n1}</span></span><span style={{ height: "48px", borderRadius: "999px", border: "1.5px solid rgba(255,255,255,.7)", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", fontSize: "13.5px", fontWeight: "700", whiteSpace: "nowrap" }}>{st.a2}<span style={{ opacity: ".55", fontSize: "12.5px", fontWeight: "700" }}>{st.n2}</span></span></div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}><span style={{ flex: "1", height: "46px", borderRadius: "999px", border: "1px solid rgba(255,255,255,.45)", padding: "0 18px", display: "flex", alignItems: "center", fontSize: "13.5px", color: "rgba(255,255,255,.85)" }}>{st.write}</span><span style={{ width: "44px", height: "46px", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="21" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round"><path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg></span></div>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,.65)", textAlign: "center" }}>Touchez pour passer au suivant · glissez pour changer de membre</div>
          </div>
        </div>
      
      </main>
    </>
  );
}
