// GÉNÉRÉ depuis docs/template/01 Accès et Onboarding.dc.html, section P02, cadre 1440 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 1440 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import type { OnboardingVals } from '../onboarding/data';

export function P02Desktop(props: OnboardingVals) {
  const { otp } = props;

  return (
    <>
      <main style={{ display: "contents" }}>

      <div style={{ height: "72px", padding: "0 40px", display: "flex", alignItems: "center", gap: "10px" }}><div style={{ width: "38px", height: "38px", borderRadius: "12px", background: "#0F5C48" }}></div><span style={{ fontSize: "21px", fontWeight: "800", color: "#0F5C48", letterSpacing: "-0.5px" }}>Diaspora</span></div>
      <div style={{ flex: "1", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "420px", background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "32px" }}>
          <a href="#" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: "700" }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg>Changer de numéro</a>
          <h1 style={{ margin: "18px 0 0", fontSize: "28px", fontWeight: "800", letterSpacing: "-0.8px" }}>Entrez le code reçu</h1>
          <p style={{ margin: "8px 0 0", fontSize: "14px", color: "#5D6B66" }}>Envoyé au <strong style={{ color: "#16211D" }}>+229 •• •• •• 42</strong></p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: "8px", marginTop: "24px" }}>
            {(otp ?? []).map((d, dIndex) => (
<Fragment key={dIndex}><div style={{ height: "60px", borderRadius: "14px", background: d.bg, border: `1.5px solid ${d.bd}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", fontWeight: "800" }}>{d.v}</div></Fragment>
))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "18px", fontSize: "13px" }}><span style={{ color: "#5D6B66" }}>Nouveau code dans <strong style={{ color: "#16211D", fontVariantNumeric: "tabular-nums" }}>0:45</strong></span><span style={{ color: "#8A958F", fontWeight: "700" }}>Renvoyer</span></div>
        </div>
      </div>
    
      </main>
    </>
  );
}
