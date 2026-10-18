// GÉNÉRÉ depuis docs/template/01 Accès et Onboarding.dc.html, section O01, cadre 1440 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 1440 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import type { OnboardingVals } from '../onboarding/data';

export function O01Desktop(props: OnboardingVals) {
  const { busy, onBack, onContinue, phases, seg1 } = props;

  return (
    <>

      <main style={{ display: "contents" }}>

      <div style={{ padding: "24px 40px 0", display: "flex", alignItems: "center", gap: "20px" }}>
        <button type="button" onClick={onBack} aria-label="Retour" style={{ border: "none", padding: "0", font: "inherit", color: "inherit", cursor: "pointer", textAlign: "inherit", width: "44px", height: "44px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg></button>
        <div style={{ flex: "1", display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: "6px" }}>{(seg1 ?? []).map((s, sIndex) => (
<Fragment key={sIndex}><span style={{ height: "6px", borderRadius: "999px", background: s }}></span></Fragment>
))}</div>
        <span style={{ fontSize: "13px", fontWeight: "700", color: "#5D6B66", fontVariantNumeric: "tabular-nums" }}>1/6</span>
      </div>
      <div style={{ flex: "1", display: "flex", justifyContent: "center", paddingTop: "80px" }}>
        <div style={{ width: "560px" }}>
          <h1 style={{ margin: "0", fontSize: "29px", fontWeight: "800", letterSpacing: "-0.9px" }}>Où en êtes-vous ?</h1>
          <p style={{ margin: "8px 0 0", fontSize: "15px", color: "#5D6B66", lineHeight: "1.55" }}>Nous adaptons l'accueil, les guides et les membres suggérés à votre situation.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "28px" }}>
            {(phases ?? []).map((p, pIndex) => (
<Fragment key={pIndex}><button onClick={p.onPick} style={{ minHeight: "76px", padding: "14px 18px", borderRadius: "18px", background: p.bg, border: p.bd, font: "inherit", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "14px" }}>
                <span style={{ width: "46px", height: "46px", borderRadius: "14px", background: p.iconBg, color: "#0F5C48", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={p.icon} /></svg></span>
                <span style={{ flex: "1", minWidth: "0" }}><span style={{ display: "block", fontSize: "15.5px", fontWeight: "700", color: "#16211D", letterSpacing: "-0.2px" }}>{p.title}</span><span style={{ display: "block", fontSize: "13px", color: "#5D6B66", marginTop: "2px" }}>{p.sub}</span></span>
                <span style={{ width: "26px", height: "26px", borderRadius: "999px", background: p.checkBg, border: p.checkBd, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="m5 12 4.5 4.5L19 7" /></svg></span>
              </button></Fragment>
))}
          </div>
          <button style={{ width: "100%", height: "52px", marginTop: "32px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "15px", fontWeight: "700", cursor: "pointer" }} onClick={onContinue} disabled={busy}>Continuer</button>
          <div style={{ textAlign: "center", marginTop: "14px" }}><a href="/bienvenue/lieu" style={{ fontSize: "13px", fontWeight: "700", color: "#5D6B66" }}>Passer cette étape</a></div>
        </div>
      </div>
    
      </main>
    </>
  );
}
