// GÉNÉRÉ depuis docs/template/03 Accueil v2.dc.html, section A13, cadre 1440 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 1440 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import type { AccueilData } from '../accueil/data';

export function A13Desktop(props: AccueilData) {
  const { storyMain } = props;

  return (
    <>
      <main style={{ display: "contents" }}>

      <div style={{ position: "absolute", top: "24px", left: "28px", display: "flex", alignItems: "center", gap: "10px" }}><div style={{ width: "36px", height: "36px", borderRadius: "12px", background: "#0F5C48", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><circle cx="16.5" cy="7.5" r="1.6" fill="#E0733A" stroke="none" /></svg></div><span style={{ fontSize: "19px", fontWeight: "800", color: "#fff" }}>Diaspora</span></div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", opacity: ".55" }}><span style={{ width: "180px", height: "320px", borderRadius: "22px", background: "#0F5C48" }}></span><span style={{ fontSize: "13px", fontWeight: "700", color: "#fff" }}>Aïcha D.</span></div>
      <span style={{ width: "52px", height: "52px", borderRadius: "999px", background: "rgba(255,255,255,.12)", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg></span>
      <div style={{ width: "430px", height: "800px", borderRadius: "28px", overflow: "hidden", flexShrink: "0" }}>
        {(storyMain ?? []).map((st, stIndex) => (
<Fragment key={stIndex}><div style={{ position: "relative", width: "100%", height: "100%", background: st.bg, color: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ position: "relative", padding: "18px 16px 0", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", gap: "4px" }}>{(st.bars ?? []).map((b, bIndex) => (
<Fragment key={bIndex}><span style={{ flex: "1", height: "3px", borderRadius: "999px", background: "rgba(255,255,255,.3)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: b, background: "#fff" }}></span></span></Fragment>
))}</div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}><span style={{ width: "42px", height: "42px", borderRadius: "999px", border: "2px solid #fff", background: st.avBg, fontSize: "12px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>{st.i}</span><span style={{ flex: "1", minWidth: "0" }}><span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "14.5px", fontWeight: "700" }}>{st.name}<svg width="15" height="15" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#fff" /><path d="m8 12 3 3 5-6" stroke="#16785E" strokeWidth="2.4" fill="none" /></svg></span><span style={{ display: "block", fontSize: "12px", color: "rgba(255,255,255,.8)" }}>{st.sub}</span></span><span style={{ width: "40px", height: "40px", borderRadius: "999px", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg></span></div>
              <span style={{ alignSelf: "flex-start", background: "#fff", color: st.pillFg, fontSize: "10.5px", fontWeight: "800", letterSpacing: ".8px", padding: "6px 12px", borderRadius: "999px" }}>{st.pill}</span>
            </div>
            <div style={{ position: "relative", flex: "1", display: "flex", flexDirection: "column", justifyContent: "center", padding: "24px 26px", gap: "16px" }}>
              <div style={{ fontSize: "11px", fontWeight: "800", letterSpacing: "1.4px", color: "rgba(255,255,255,.75)" }}>{st.label}</div>
              <div style={{ fontSize: "30px", fontWeight: "800", lineHeight: "1.18", letterSpacing: "-0.6px", textWrap: "pretty" }}>{st.text}</div>
              <div style={{ background: "rgba(255,255,255,.14)", borderRadius: "16px", padding: "12px 14px", fontSize: "13px", fontWeight: "600", lineHeight: "1.45" }}>{st.state}</div>
            </div>
            <div style={{ position: "relative", padding: "0 18px 22px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}><span style={{ height: "50px", borderRadius: "999px", background: "#fff", color: "#0F5C48", display: "flex", alignItems: "center", justifyContent: "center", gap: "9px", fontSize: "14.5px", fontWeight: "800" }}>{st.useful ? (<><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0F5C48" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4.5 4.5L19 7" /></svg></>) : null}{st.a1}<span style={{ color: "#6FA893", fontSize: "12.5px", fontWeight: "700" }}>{st.n1}</span></span><span style={{ height: "50px", borderRadius: "999px", border: "1.5px solid rgba(255,255,255,.7)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "14px", fontWeight: "700" }}>{st.a2}<span style={{ opacity: ".55", fontSize: "12.5px", fontWeight: "700" }}>{st.n2}</span></span></div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}><span style={{ flex: "1", height: "48px", borderRadius: "999px", border: "1px solid rgba(255,255,255,.45)", padding: "0 18px", display: "flex", alignItems: "center", fontSize: "13.5px", color: "rgba(255,255,255,.85)" }}>{st.write}</span><span style={{ width: "44px", height: "48px", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="21" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round"><path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg></span></div>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,.65)", textAlign: "center" }}>Touchez pour passer au suivant · glissez pour changer de membre</div>
            </div>
          </div></Fragment>
))}
      </div>
      <span style={{ width: "52px", height: "52px", borderRadius: "999px", background: "rgba(255,255,255,.12)", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="m9 18 6-6-6-6" /></svg></span>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", opacity: ".55" }}><span style={{ width: "180px", height: "320px", borderRadius: "22px", background: "#3A4943" }}></span><span style={{ fontSize: "13px", fontWeight: "700", color: "#fff" }}>Kofi B.</span></div>
    
      </main>
    </>
  );
}
