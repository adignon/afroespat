// GÉNÉRÉ depuis docs/template/01 Accès et Onboarding.dc.html, section O01, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import type { OnboardingVals } from '../onboarding/data';

export function O01Mobile(props: OnboardingVals) {
  const { busy, onContinue, phases, seg1 } = props;

  return (
    <>
      <div style={{ background: "#F6F8F7", padding: "56px 20px 28px", display: "flex", flexDirection: "column", flexGrow: "1", flexShrink: "1", flexBasis: "auto" }}>
      <main style={{ display: "contents" }}>

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}><div style={{ flex: "1", display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: "4px" }}>{(seg1 ?? []).map((s, sIndex) => (
<Fragment key={sIndex}><span style={{ height: "5px", borderRadius: "999px", background: s }}></span></Fragment>
))}</div><span style={{ fontSize: "12px", fontWeight: "700", color: "#5D6B66" }}>1/6</span></div>
      <h1 style={{ margin: "32px 0 0", fontSize: "27px", fontWeight: "800", letterSpacing: "-0.8px" }}>Où en êtes-vous ?</h1>
      <p style={{ margin: "8px 0 0", fontSize: "14px", color: "#5D6B66", lineHeight: "1.55" }}>Nous adaptons l'accueil à votre situation.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "22px" }}>
        {(phases ?? []).map((p, pIndex) => (
<Fragment key={pIndex}><button onClick={p.onPick} style={{ minHeight: "70px", padding: "12px 14px", borderRadius: "16px", background: p.bg, border: p.bd, font: "inherit", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ width: "42px", height: "42px", borderRadius: "12px", background: p.iconBg, color: "#0F5C48", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={p.icon} /></svg></span>
            <span style={{ flex: "1", minWidth: "0" }}><span style={{ display: "block", fontSize: "14.5px", fontWeight: "700", color: "#16211D" }}>{p.title}</span><span style={{ display: "block", fontSize: "12.5px", color: "#5D6B66", marginTop: "2px" }}>{p.sub}</span></span>
          </button></Fragment>
))}
      </div>
      <div style={{ flex: "1" }}></div>
      <button style={{ width: "100%", height: "52px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "15px", fontWeight: "700" }} onClick={onContinue} disabled={busy}>Continuer</button>
    
      </main>
      </div>
    </>
  );
}
