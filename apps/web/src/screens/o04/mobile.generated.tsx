// GÉNÉRÉ depuis docs/template/01 Accès et Onboarding.dc.html, section O04, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import type { OnboardingVals } from '../onboarding/data';

export function O04Mobile(props: OnboardingVals) {
  const { busy, onContinue, seg4, statuses } = props;

  return (
    <>
      <main style={{ display: "contents" }}>

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}><div style={{ flex: "1", display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: "4px" }}>{(seg4 ?? []).map((s, sIndex) => (
<Fragment key={sIndex}><span style={{ height: "5px", borderRadius: "999px", background: s }}></span></Fragment>
))}</div><span style={{ fontSize: "12px", fontWeight: "700", color: "#5D6B66" }}>4/6</span></div>
      <h1 style={{ margin: "14px 0 0", fontSize: "25px", fontWeight: "800", letterSpacing: "-0.8px" }}>Présentez-vous</h1>
      <div style={{ width: "76px", height: "76px", borderRadius: "999px", background: "#fff", border: "1.5px dashed #CBD5D1" }}></div>
      <div style={{ height: "48px", padding: "0 14px", borderRadius: "14px", border: "1.5px solid #16785E", background: "#fff", display: "flex", alignItems: "center", fontSize: "14.5px", fontWeight: "600" }}>@amina.d</div>
      <div style={{ height: "48px", padding: "0 14px", borderRadius: "14px", background: "#fff", border: "1px solid #E6EBE9", display: "flex", alignItems: "center", fontSize: "14.5px", fontWeight: "600" }}>Amina Diallo</div>
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>{(statuses ?? []).map((s, sIndex) => (
<Fragment key={sIndex}><span style={{ padding: "8px 13px", borderRadius: "999px", fontSize: "12.5px", fontWeight: "600", background: s.bg, color: s.fg, border: `1px solid ${s.bd}` }}>{s.label}</span></Fragment>
))}</div>
      <div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "16px", padding: "14px", display: "flex", alignItems: "center", gap: "10px" }}><span style={{ flex: "1", fontSize: "14px", fontWeight: "700" }}>Disponible pour aider</span><span style={{ width: "48px", height: "28px", borderRadius: "999px", background: "#16785E", position: "relative" }}><span style={{ position: "absolute", top: "3px", left: "23px", width: "22px", height: "22px", borderRadius: "999px", background: "#fff" }}></span></span></div>
      <div style={{ flex: "1" }}></div>
      <button style={{ width: "100%", height: "52px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "15px", fontWeight: "700" }} onClick={onContinue} disabled={busy}>Continuer</button>
    
      </main>
    </>
  );
}
