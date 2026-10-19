// GÉNÉRÉ depuis docs/template/01 Accès et Onboarding.dc.html, section P01, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import type { OnboardingVals } from '../onboarding/data';

export function P01Mobile(props: OnboardingVals) {
  const { busy, consentAccepted, consentBg, consentBorder, countryOuvert, dialCode, onCountryOuvrir, onPhoneChange, onSubmit, onToggleConsent, paysIndicatifSelecteur, phoneBordure, phoneExemple, phoneValue } = props;

  return (
    <>
      <div style={{ background: "#F6F8F7", display: "flex", flexDirection: "column", padding: "56px 20px 28px", flexGrow: "1", flexShrink: "1", flexBasis: "auto" }}>

      <main style={{ display: "contents" }}>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "#0F5C48" }}></div><span style={{ fontSize: "18px", fontWeight: "800", color: "#0F5C48" }}>Diaspora</span></div>
        <h1 style={{ margin: "40px 0 0", fontSize: "27px", fontWeight: "800", letterSpacing: "-0.8px", lineHeight: "1.15" }}>Votre numéro de téléphone</h1>
        <div style={{ display: "flex", gap: "8px", marginTop: "24px" }}><div style={{ position: "relative", height: "52px", padding: "0 12px", borderRadius: "14px", background: "#fff", border: "1px solid #E6EBE9", display: "flex", alignItems: "center", gap: "6px", fontSize: "14.5px", fontWeight: "600" }}>{dialCode}<button type="button" onClick={onCountryOuvrir} aria-haspopup="dialog" aria-expanded={countryOuvert} aria-label="Indicatif du pays" style={{ padding: 0, background: "transparent", position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", font: "inherit", border: "none", appearance: "none" }}></button></div>{paysIndicatifSelecteur}<input style={{ flex: "1", height: "52px", padding: "0 14px", borderRadius: "14px", background: "#fff", border: phoneBordure, display: "flex", alignItems: "center", fontSize: "15px", fontWeight: "600" }} placeholder={phoneExemple} type="tel" name="phone" inputMode="numeric" autoComplete="tel-national" aria-label="Votre numéro de téléphone" value={phoneValue} onChange={onPhoneChange} /></div>
        <p style={{ margin: "12px 0 0", fontSize: "12.5px", color: "#5D6B66", lineHeight: "1.55" }}>Nous vous envoyons un code par SMS. Votre numéro n'est jamais affiché aux autres membres.</p>
        <div style={{ flex: "1" }}></div>
        <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}><button type="button" role="checkbox" aria-checked={consentAccepted} onClick={onToggleConsent} aria-label="J’accepte les conditions d’utilisation et la politique de confidentialité" style={{ width: "44px", height: "44px", padding: "0", border: "none", background: "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0", margin: "-11px", cursor: "pointer" }}><span aria-hidden="true" style={{ width: "22px", height: "22px", borderRadius: "7px", background: consentBg, border: consentBorder, flexShrink: "0", display: "flex", alignItems: "center", justifyContent: "center" }}></span></button><span style={{ fontSize: "12.5px", lineHeight: "1.5" }}>J'accepte les <a href="/p/cgu" style={{ fontWeight: "700" }}>conditions</a> et la <a href="/p/confidentialite" style={{ fontWeight: "700" }}>confidentialité</a>.</span></div>
        <button style={{ width: "100%", height: "52px", marginTop: "16px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "15px", fontWeight: "700" }} onClick={onSubmit} disabled={busy}>Recevoir le code</button>
      
      </main>
      </div>
    </>
  );
}
