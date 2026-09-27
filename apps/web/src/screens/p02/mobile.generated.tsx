// GÉNÉRÉ depuis docs/template/01 Accès et Onboarding.dc.html, section P02, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import type { OnboardingVals } from '../onboarding/data';

export function P02Mobile(props: OnboardingVals) {
  const { otp } = props;

  return (
    <>
      <main style={{ display: "contents" }}>

      <span style={{ width: "44px", height: "44px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg></span>
      <h1 style={{ margin: "28px 0 0", fontSize: "27px", fontWeight: "800", letterSpacing: "-0.8px" }}>Entrez le code reçu</h1>
      <p style={{ margin: "8px 0 0", fontSize: "14px", color: "#5D6B66" }}>Envoyé au <strong style={{ color: "#16211D" }}>+229 •• •• •• 42</strong></p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: "6px", marginTop: "24px" }}>
        {(otp ?? []).map((d, dIndex) => (
<Fragment key={dIndex}><div style={{ height: "54px", borderRadius: "12px", background: d.bg, border: `1.5px solid ${d.bd}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", fontWeight: "800" }}>{d.v}</div></Fragment>
))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "16px", fontSize: "13px" }}><span style={{ color: "#5D6B66" }}>Nouveau code dans <strong style={{ color: "#16211D" }}>0:45</strong></span><span style={{ color: "#8A958F", fontWeight: "700" }}>Renvoyer</span></div>
    
      </main>
    </>
  );
}
