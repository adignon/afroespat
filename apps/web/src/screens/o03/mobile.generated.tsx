// GÉNÉRÉ depuis docs/template/01 Accès et Onboarding.dc.html, section O03, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import type { OnboardingVals } from '../onboarding/data';

export function O03Mobile(props: OnboardingVals) {
  const { busy, create, createBd, createBg, goals, goalsSansParcours, onContinue, seg3, toggleCreate } = props;

  return (
    <>
      <div style={{ background: "#F6F8F7", padding: "56px 20px 28px", display: "flex", flexDirection: "column", flexGrow: "1", flexShrink: "1", flexBasis: "auto" }}>

      <main style={{ display: "contents" }}>

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}><div style={{ flex: "1", display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: "4px" }}>{(seg3 ?? []).map((s, sIndex) => (
<Fragment key={sIndex}><span style={{ height: "5px", borderRadius: "999px", background: s }}></span></Fragment>
))}</div><span style={{ fontSize: "12px", fontWeight: "700", color: "#5D6B66" }}>3/6</span></div>
      <h1 style={{ margin: "28px 0 0", fontSize: "25px", fontWeight: "800", letterSpacing: "-0.8px" }}>Quel est votre objectif ?</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "18px" }}>{(goals ?? []).map((g, gIndex) => (
<Fragment key={gIndex}><button type="button" onClick={g.onPick} aria-pressed={g.on} style={{ height: "62px", padding: "0 14px", borderRadius: "16px", background: g.bg, border: g.bd, display: "flex", alignItems: "center", gap: "12px", fontFamily: "inherit", color: "inherit", cursor: "pointer", textAlign: "left", width: "100%" }}><span style={{ width: "38px", height: "38px", borderRadius: "12px", background: g.iconBg, color: "#0F5C48", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={g.icon} /></svg></span><span><span style={{ display: "block", fontSize: "14.5px", fontWeight: "700" }}>{g.title}</span><span style={{ display: "block", fontSize: "12px", color: "#5D6B66" }}>{g.steps}</span></span></button></Fragment>
))}</div>
      <button onClick={toggleCreate} style={{ marginTop: "10px", padding: "12px 14px", borderRadius: "14px", background: "#F3F7F5", border: "none", font: "inherit", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px" }} role="checkbox" aria-checked={create}><span style={{ width: "22px", height: "22px", borderRadius: "7px", background: createBg, border: createBd, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>{create ? (<><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="m5 12 4.5 4.5L19 7" /></svg></>) : null}</span><span style={{ fontSize: "13.5px", fontWeight: "700", color: "#16211D" }}>Créer mon parcours maintenant</span></button>
      <div style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F", margin: "18px 0 8px", textAlign: "center" }}>SANS CRÉER DE PARCOURS</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>{(goalsSansParcours ?? []).map((g, gsIndex) => (<Fragment key={gsIndex}><button type="button" onClick={g.onPick} aria-pressed={g.on} style={{ height: "52px", padding: "0 14px", borderRadius: "16px", background: g.bg, border: g.bd, display: "flex", alignItems: "center", fontSize: "14px", fontWeight: "700", fontFamily: "inherit", color: "inherit", cursor: "pointer", textAlign: "left", width: "100%" }}>{g.title}</button></Fragment>))}</div>
      <div style={{ flex: "1" }}></div>
      <button style={{ width: "100%", height: "52px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "15px", fontWeight: "700" }} onClick={onContinue} disabled={busy}>Continuer</button>
    
      </main>
      </div>
    </>
  );
}
