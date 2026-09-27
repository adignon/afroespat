// GÉNÉRÉ depuis docs/template/01 Accès et Onboarding.dc.html, section P01, cadre 1440 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 1440 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import type { OnboardingVals } from '../onboarding/data';

export function P01Desktop(props: OnboardingVals) {
  const { busy, countryIso2, countryOptions, dialCode, flagDisplay, onCountryChange, onPhoneChange, onSubmit, phoneValue, reassure } = props;

  return (
    <>
      <main style={{ display: "contents" }}>

      <div style={{ height: "72px", padding: "0 40px", display: "flex", alignItems: "center", gap: "10px" }}><div style={{ width: "38px", height: "38px", borderRadius: "12px", background: "#0F5C48", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><circle cx="16.5" cy="7.5" r="1.6" fill="#E0733A" stroke="none" /></svg></div><span style={{ fontSize: "21px", fontWeight: "800", color: "#0F5C48", letterSpacing: "-0.5px" }}>Diaspora</span></div>
      <div style={{ flex: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "20px" }}>
        <div style={{ width: "420px", background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "32px" }}>
          <h1 style={{ margin: "0", fontSize: "28px", fontWeight: "800", letterSpacing: "-0.8px" }}>Votre numéro de téléphone</h1>
          <p style={{ margin: "8px 0 0", fontSize: "14px", color: "#5D6B66", lineHeight: "1.55" }}>Pour vous connecter ou créer votre compte.</p>
          <div style={{ display: "flex", gap: "8px", marginTop: "24px" }}>
            <div style={{ position: "relative", height: "52px", padding: "0 14px", borderRadius: "14px", background: "#F2F5F4", border: "1px solid #EAEEEC", display: "flex", alignItems: "center", gap: "8px", fontSize: "14.5px", fontWeight: "600" }}><span style={{ width: "22px", height: "15px", borderRadius: "3px", background: "linear-gradient(90deg,#16785E 33%,#F2C94C 33% 66%,#E0733A 66%)", display: flagDisplay }}></span>{dialCode}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5D6B66" strokeWidth="2" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg><select value={countryIso2} onChange={onCountryChange} aria-label="Indicatif du pays" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", font: "inherit", border: "none", appearance: "none" }}>{(countryOptions ?? []).map((c) => (<option key={c.iso2} value={c.iso2}>{c.nameFr} {c.dialCode}</option>))}</select></div>
            <input style={{ flex: "1", height: "52px", padding: "0 16px", borderRadius: "14px", background: "#fff", border: "1.5px solid #16785E", display: "flex", alignItems: "center", fontSize: "15px", fontWeight: "600", letterSpacing: ".5px" }} placeholder="97 12 34 42" type="tel" name="phone" inputMode="numeric" autoComplete="tel-national" aria-label="Votre numéro de téléphone" value={phoneValue} onChange={onPhoneChange} />
          </div>
          <p style={{ margin: "12px 0 0", fontSize: "12.5px", color: "#5D6B66", lineHeight: "1.55" }}>Nous vous envoyons un code par SMS. Votre numéro n'est jamais affiché aux autres membres.</p>
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginTop: "20px" }}><span style={{ width: "22px", height: "22px", borderRadius: "7px", background: "#16785E", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="m5 12 4.5 4.5L19 7" /></svg></span><span style={{ fontSize: "13px", lineHeight: "1.5" }}>J'accepte les <a href="#" style={{ fontWeight: "700" }}>conditions d'utilisation</a> et la <a href="#" style={{ fontWeight: "700" }}>politique de confidentialité</a>.</span></div>
          <button style={{ width: "100%", height: "52px", marginTop: "22px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "15px", fontWeight: "700", cursor: "pointer" }} onClick={onSubmit} disabled={busy}>Recevoir le code</button>
        </div>
        <div style={{ width: "420px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {(reassure ?? []).map((r, rIndex) => (
<Fragment key={rIndex}><div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "13px", color: "#5D6B66" }}><span style={{ width: "32px", height: "32px", borderRadius: "10px", background: "#E3F0EB", color: "#0F5C48", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={r.icon} /></svg></span>{r.text}</div></Fragment>
))}
        </div>
      </div>
    
      </main>
    </>
  );
}
