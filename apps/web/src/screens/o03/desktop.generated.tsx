// GÉNÉRÉ depuis docs/template/01 Accès et Onboarding.dc.html, section O03, cadre 1440 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 1440 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import type { OnboardingVals } from '../onboarding/data';

export function O03Desktop(props: OnboardingVals) {
  const { create, createBd, createBg, createHelp, goals, seg3, toggleCreate } = props;

  return (
    <>
      <main style={{ display: "contents" }}>

      <div style={{ padding: "24px 40px 0", display: "flex", alignItems: "center", gap: "20px" }}>
        <span style={{ width: "44px", height: "44px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg></span>
        <div style={{ flex: "1", display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: "6px" }}>{(seg3 ?? []).map((s, sIndex) => (
<Fragment key={sIndex}><span style={{ height: "6px", borderRadius: "999px", background: s }}></span></Fragment>
))}</div>
        <span style={{ fontSize: "13px", fontWeight: "700", color: "#5D6B66" }}>3/6</span>
      </div>
      <div style={{ flex: "1", display: "flex", justifyContent: "center", paddingTop: "52px" }}>
        <div style={{ width: "640px" }}>
          <h1 style={{ margin: "0", fontSize: "29px", fontWeight: "800", letterSpacing: "-0.9px" }}>Quel est votre objectif ?</h1>
          <p style={{ margin: "8px 0 0", fontSize: "15px", color: "#5D6B66", lineHeight: "1.55" }}>Un parcours découpe votre projet en étapes, avec les guides et les membres qui les ont franchies.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "26px" }}>
            {(goals ?? []).map((g, gIndex) => (
<Fragment key={gIndex}><div style={{ padding: "18px", borderRadius: "18px", background: g.bg, border: g.bd, display: "flex", flexDirection: "column", gap: "12px" }}>
                <span style={{ width: "44px", height: "44px", borderRadius: "14px", background: g.iconBg, color: "#0F5C48", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={g.icon} /></svg></span>
                <span><span style={{ display: "block", fontSize: "15.5px", fontWeight: "700", letterSpacing: "-0.2px" }}>{g.title}</span><span style={{ display: "block", fontSize: "12.5px", color: "#5D6B66", marginTop: "2px" }}>{g.steps}</span></span>
              </div></Fragment>
))}
          </div>
          <button onClick={toggleCreate} style={{ width: "100%", marginTop: "12px", padding: "14px 16px", borderRadius: "16px", background: "#F3F7F5", border: "none", font: "inherit", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: "12px" }} role="checkbox" aria-checked={create}>
            <span style={{ width: "22px", height: "22px", borderRadius: "7px", background: createBg, border: createBd, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0", marginTop: "1px" }}>{create ? (<><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="m5 12 4.5 4.5L19 7" /></svg></>) : null}</span>
            <span><span style={{ display: "block", fontSize: "14px", fontWeight: "700", color: "#16211D" }}>Créer mon parcours maintenant</span><span style={{ display: "block", fontSize: "12.5px", color: "#5D6B66", marginTop: "2px", lineHeight: "1.5" }}>{createHelp}</span></span>
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "22px 0 14px" }}><span style={{ flex: "1", height: "1px", background: "#E0E5E3" }}></span><span style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F" }}>SANS CRÉER DE PARCOURS</span><span style={{ flex: "1", height: "1px", background: "#E0E5E3" }}></span></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div style={{ height: "64px", padding: "0 18px", borderRadius: "18px", background: "#fff", border: "1px solid #E6EBE9", display: "flex", alignItems: "center", gap: "12px", fontSize: "14.5px", fontWeight: "700" }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#0F5C48" strokeWidth="1.7" strokeLinecap="round"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" /></svg>M'intégrer, rencontrer du monde</div>
            <div style={{ height: "64px", padding: "0 18px", borderRadius: "18px", background: "#fff", border: "1px solid #E6EBE9", display: "flex", alignItems: "center", gap: "12px", fontSize: "14.5px", fontWeight: "700" }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#0F5C48" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" /></svg>Aider les autres</div>
          </div>
          <button style={{ width: "100%", height: "52px", marginTop: "28px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "15px", fontWeight: "700" }}>Continuer</button>
          <div style={{ textAlign: "center", marginTop: "14px" }}><a href="#" style={{ fontSize: "13px", fontWeight: "700", color: "#5D6B66" }}>Passer cette étape</a></div>
        </div>
      </div>
    
      </main>
    </>
  );
}
