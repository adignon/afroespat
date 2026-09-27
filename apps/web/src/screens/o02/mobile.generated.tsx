// GÉNÉRÉ depuis docs/template/01 Accès et Onboarding.dc.html, section O02, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import type { OnboardingVals } from '../onboarding/data';

export function O02Mobile(props: OnboardingVals) {
  const { busy, cities, citySearch, onCitySearch, onContinue, onOriginChange, originIso2, originName, originOptions, seg2 } = props;

  return (
    <>
      <main style={{ display: "contents" }}>

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}><div style={{ flex: "1", display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: "4px" }}>{(seg2 ?? []).map((s, sIndex) => (
<Fragment key={sIndex}><span style={{ height: "5px", borderRadius: "999px", background: s }}></span></Fragment>
))}</div><span style={{ fontSize: "12px", fontWeight: "700", color: "#5D6B66" }}>2/6</span></div>
      <h1 style={{ margin: "32px 0 0", fontSize: "25px", fontWeight: "800", letterSpacing: "-0.8px", lineHeight: "1.15" }}>D'où venez-vous, où vivez-vous ?</h1>
      <div style={{ fontSize: "13px", fontWeight: "700", marginTop: "24px" }}>D'où venez-vous ?</div>
      <div style={{ position: "relative", height: "50px", marginTop: "8px", padding: "0 14px", borderRadius: "14px", background: "#fff", border: "1px solid #E6EBE9", display: "flex", alignItems: "center", fontSize: "14.5px", fontWeight: "600" }}>{originName}<select value={originIso2} onChange={onOriginChange} aria-label="Pays d’origine" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", font: "inherit", border: "none", appearance: "none" }}>{(originOptions ?? []).map((c) => (<option key={c.iso2} value={c.iso2}>{c.nameFr}</option>))}</select></div>
      <div style={{ fontSize: "13px", fontWeight: "700", marginTop: "18px" }}>Où vivez-vous ?</div>
      <div style={{ height: "50px", marginTop: "8px", padding: "0 14px", borderRadius: "14px", background: "#fff", border: "1.5px solid #16785E", display: "flex", alignItems: "center", fontSize: "14.5px", fontWeight: "600" }}><input value={citySearch} onChange={onCitySearch} placeholder="Votre ville" aria-label="Votre ville" autoComplete="address-level2" style={{ flex: "1", minWidth: "0", border: "none", background: "transparent", font: "inherit", color: "inherit", outline: "none", padding: 0 }} /></div>
      <div style={{ marginTop: "8px", background: "#fff", border: "1px solid #EAEEEC", borderRadius: "16px", padding: "6px" }}>{(cities ?? []).map((c, cIndex) => (
<Fragment key={cIndex}><button type="button" onClick={c.onPick} style={{ height: "46px", display: "flex", alignItems: "center", gap: "10px", padding: "0 10px", borderRadius: "12px", background: c.bg, color: c.fg, border: "none", font: "inherit", textAlign: "left", cursor: "pointer", width: "100%" }}><span style={{ flex: "1", fontSize: "14px", fontWeight: "600" }}>{c.name}</span><span style={{ fontSize: "11.5px", fontWeight: "700", color: c.metaFg }}>{c.meta}</span></button></Fragment>
))}</div>
      <div style={{ flex: "1" }}></div>
      <button style={{ width: "100%", height: "52px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "15px", fontWeight: "700" }} onClick={onContinue} disabled={busy}>Continuer</button>
    
      </main>
    </>
  );
}
