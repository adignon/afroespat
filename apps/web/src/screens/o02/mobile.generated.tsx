// GÉNÉRÉ depuis docs/template/01 Accès et Onboarding.dc.html, section O02, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import type { OnboardingVals } from '../onboarding/data';

export function O02Mobile(props: OnboardingVals) {
  const { busy, onContinue, onOriginOuvrir, onVilleOuvrir, originName, originOuvert, paysSelecteur, seg2, villeNom, villeOuvert, villeSelecteur } = props;

  return (
    <>
      <div style={{ background: "#F6F8F7", padding: "56px 20px 28px", display: "flex", flexDirection: "column", flexGrow: "1", flexShrink: "1", flexBasis: "auto" }}>
      <main style={{ display: "contents" }}>

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}><div style={{ flex: "1", display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: "4px" }}>{(seg2 ?? []).map((s, sIndex) => (
<Fragment key={sIndex}><span style={{ height: "5px", borderRadius: "999px", background: s }}></span></Fragment>
))}</div><span style={{ fontSize: "12px", fontWeight: "700", color: "#5D6B66" }}>2/6</span></div>
      <h1 style={{ margin: "32px 0 0", fontSize: "25px", fontWeight: "800", letterSpacing: "-0.8px", lineHeight: "1.15" }}>D'où venez-vous, où vivez-vous ?</h1>
      <div style={{ fontSize: "13px", fontWeight: "700", marginTop: "24px" }}>D'où venez-vous ?</div>
      <div style={{ position: "relative", height: "50px", marginTop: "8px", padding: "0 14px", borderRadius: "14px", background: "#fff", border: "1px solid #E6EBE9", display: "flex", alignItems: "center", fontSize: "14.5px", fontWeight: "600" }}>{originName}<button type="button" onClick={onOriginOuvrir} aria-haspopup="dialog" aria-expanded={originOuvert} aria-label="Pays d’origine" style={{ padding: 0, background: "transparent", position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", font: "inherit", border: "none", appearance: "none" }}></button></div>{paysSelecteur}
      <div style={{ fontSize: "13px", fontWeight: "700", marginTop: "18px" }}>Où vivez-vous ?</div>
      <div style={{ position: "relative", height: "50px", marginTop: "8px", padding: "0 14px", borderRadius: "14px", background: "#F2F5F4", border: "1px solid #EAEEEC", display: "flex", alignItems: "center", gap: "10px", fontSize: "14.5px", fontWeight: "600" }}>{villeNom}<span style={{ flex: "1" }}></span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5D6B66" strokeWidth="2" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg><button type="button" onClick={onVilleOuvrir} aria-haspopup="dialog" aria-expanded={villeOuvert} aria-label="Votre ville" style={{ padding: 0, background: "transparent", position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", font: "inherit", border: "none", appearance: "none" }}></button></div>{villeSelecteur}
      <div style={{ flex: "1" }}></div>
      <button style={{ width: "100%", height: "52px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "15px", fontWeight: "700" }} onClick={onContinue} disabled={busy}>Continuer</button>
    
      </main>
      </div>
    </>
  );
}
