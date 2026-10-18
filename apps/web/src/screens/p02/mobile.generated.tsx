// GÉNÉRÉ depuis docs/template/01 Accès et Onboarding.dc.html, section P02, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import type { OnboardingVals } from '../onboarding/data';

export function P02Mobile(props: OnboardingVals) {
  const { codeValue, onChangeNumber, onCodeChange, otp, phoneMasque, resend } = props;

  return (
    <>
      <div style={{ background: "#F6F8F7", padding: "56px 20px 28px", display: "flex", flexDirection: "column", flexGrow: "1", flexShrink: "1", flexBasis: "auto" }}>

      <main style={{ display: "contents" }}>

      <button type="button" onClick={onChangeNumber} aria-label="Changer de numéro" style={{ width: "44px", height: "44px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center", border: "none", padding: 0, font: "inherit", cursor: "pointer" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg></button>
      <h1 style={{ margin: "28px 0 0", fontSize: "27px", fontWeight: "800", letterSpacing: "-0.8px" }}>Entrez le code reçu</h1>
      <p style={{ margin: "8px 0 0", fontSize: "14px", color: "#5D6B66" }}>Envoyé au <strong style={{ color: "#16211D" }}>{phoneMasque}</strong></p>
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: "6px", marginTop: "24px" }}>
        {(otp ?? []).map((d, dIndex) => (
<Fragment key={dIndex}><div style={{ height: "54px", borderRadius: "12px", background: d.bg, border: `1.5px solid ${d.bd}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", fontWeight: "800" }}>{d.v}</div></Fragment>
))}
      <input type="text" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus aria-label="Code à six chiffres reçu par SMS" value={codeValue} onChange={onCodeChange} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0, font: "inherit", border: "none", background: "transparent", padding: 0, margin: 0, cursor: "text" }} /></div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "16px", fontSize: "13px" }}><span style={{ color: "#5D6B66", visibility: resend.countdown }}>Nouveau code dans <strong style={{ color: "#16211D" }}>{resend.label}</strong></span><button type="button" onClick={resend.onPick} disabled={resend.blocked} style={{ font: "inherit", color: resend.color, fontWeight: "700", border: "none", background: "none", padding: 0, cursor: resend.cursor }}>Renvoyer</button></div>
    
      </main>
      </div>
    </>
  );
}
