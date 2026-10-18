// GÉNÉRÉ depuis docs/template/01 Accès et Onboarding.dc.html, section O02, cadre 1440 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 1440 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import type { OnboardingVals } from '../onboarding/data';

export function O02Desktop(props: OnboardingVals) {
  const { busy, onBack, onContinue, onOriginOuvrir, onVilleOuvrir, originFlag, originName, originOuvert, paysSelecteur, seg2, villeNom, villeOuvert, villeSelecteur } = props;

  return (
    <>

      <main style={{ display: "contents" }}>

      <div style={{ padding: "24px 40px 0", display: "flex", alignItems: "center", gap: "20px" }}>
        <button type="button" onClick={onBack} aria-label="Retour" style={{ border: "none", padding: "0", font: "inherit", color: "inherit", cursor: "pointer", textAlign: "inherit", width: "44px", height: "44px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg></button>
        <div style={{ flex: "1", display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: "6px" }}>{(seg2 ?? []).map((s, sIndex) => (
<Fragment key={sIndex}><span style={{ height: "6px", borderRadius: "999px", background: s }}></span></Fragment>
))}</div>
        <span style={{ fontSize: "13px", fontWeight: "700", color: "#5D6B66" }}>2/6</span>
      </div>
      <div style={{ flex: "1", display: "flex", justifyContent: "center", paddingTop: "64px" }}>
        <div style={{ width: "560px" }}>
          <h1 style={{ margin: "0", fontSize: "29px", fontWeight: "800", letterSpacing: "-0.9px" }}>D'où venez-vous, où vivez-vous ?</h1>
          <p style={{ margin: "8px 0 0", fontSize: "15px", color: "#5D6B66", lineHeight: "1.55" }}>Ces informations vous rattachent au réseau de votre ville et de votre pays.</p>
          <div style={{ position: "relative", background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "22px", marginTop: "28px" }}>
            <div style={{ fontSize: "13.5px", fontWeight: "700" }}>D'où venez-vous ?</div>
            <div style={{ position: "relative", height: "52px", marginTop: "10px", padding: "0 16px", borderRadius: "14px", background: "#F2F5F4", border: "1px solid #EAEEEC", display: "flex", alignItems: "center", gap: "10px", fontSize: "14.5px", fontWeight: "600" }}><span aria-hidden="true" style={{ width: "22px", height: "15px", borderRadius: "3px", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", fontSize: "15px", lineHeight: 1 }}>{originFlag}</span>{originName}<span style={{ flex: "1" }}></span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5D6B66" strokeWidth="2" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg><button type="button" onClick={onOriginOuvrir} aria-haspopup="dialog" aria-expanded={originOuvert} aria-label="Pays d’origine" style={{ padding: 0, background: "transparent", position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", font: "inherit", border: "none", appearance: "none" }}></button></div>{paysSelecteur}
            <div style={{ fontSize: "13.5px", fontWeight: "700", marginTop: "22px" }}>Où vivez-vous ?</div>
            <div style={{ position: "relative", height: "52px", marginTop: "10px", padding: "0 16px", borderRadius: "14px", background: "#F2F5F4", border: "1px solid #EAEEEC", display: "flex", alignItems: "center", gap: "10px", fontSize: "14.5px", fontWeight: "600" }}>{villeNom}<span style={{ flex: "1" }}></span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5D6B66" strokeWidth="2" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg><button type="button" onClick={onVilleOuvrir} aria-haspopup="dialog" aria-expanded={villeOuvert} aria-label="Votre ville" style={{ padding: 0, background: "transparent", position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", font: "inherit", border: "none", appearance: "none" }}></button></div>{villeSelecteur}
          </div>
          <button style={{ width: "100%", height: "52px", marginTop: "24px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "15px", fontWeight: "700" }} onClick={onContinue} disabled={busy}>Continuer</button>
          <div style={{ textAlign: "center", marginTop: "14px" }}><a href="/bienvenue/objectif" style={{ fontSize: "13px", fontWeight: "700", color: "#5D6B66" }}>Passer cette étape</a></div>
        </div>
      </div>
    
      </main>
    </>
  );
}
