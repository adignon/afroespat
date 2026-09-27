// GÉNÉRÉ depuis docs/template/01 Accès et Onboarding.dc.html, section O04, cadre 1440 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 1440 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import type { OnboardingVals } from '../onboarding/data';

export function O04Desktop(props: OnboardingVals) {
  const { help, helpKnob, helpTrack, helpTypes, seg4, statuses, toggleHelp } = props;

  return (
    <>
      <main style={{ display: "contents" }}>

      <div style={{ padding: "24px 40px 0", display: "flex", alignItems: "center", gap: "20px" }}>
        <span style={{ width: "44px", height: "44px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg></span>
        <div style={{ flex: "1", display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: "6px" }}>{(seg4 ?? []).map((s, sIndex) => (
<Fragment key={sIndex}><span style={{ height: "6px", borderRadius: "999px", background: s }}></span></Fragment>
))}</div>
        <span style={{ fontSize: "13px", fontWeight: "700", color: "#5D6B66" }}>4/6</span>
      </div>
      <div style={{ flex: "1", display: "flex", justifyContent: "center", paddingTop: "40px" }}>
        <div style={{ width: "640px" }}>
          <h1 style={{ margin: "0", fontSize: "29px", fontWeight: "800", letterSpacing: "-0.9px" }}>Présentez-vous</h1>
          <p style={{ margin: "8px 0 0", fontSize: "15px", color: "#5D6B66" }}>Seuls le pseudo et le nom sont obligatoires.</p>
          <div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "24px", marginTop: "24px", display: "flex", flexDirection: "column", gap: "18px" }}>
            <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
              <div style={{ width: "84px", height: "84px", borderRadius: "999px", background: "#F2F5F4", border: "1.5px dashed #CBD5D1", display: "flex", alignItems: "center", justifyContent: "center", color: "#8A958F", flexShrink: "0" }}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg></div>
              <div style={{ flex: "1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div><div style={{ fontSize: "12.5px", fontWeight: "700", marginBottom: "6px" }}>Pseudo</div><div style={{ height: "48px", padding: "0 14px", borderRadius: "14px", border: "1.5px solid #16785E", display: "flex", alignItems: "center", fontSize: "14.5px", fontWeight: "600" }}>@amina.d<span style={{ flex: "1" }}></span><svg width="16" height="16" viewBox="0 0 24 24" fill="#16785E"><circle cx="12" cy="12" r="10" /><path d="m8 12 3 3 5-6" stroke="#fff" strokeWidth="2.2" fill="none" /></svg></div><div style={{ fontSize: "11.5px", color: "#16785E", fontWeight: "600", marginTop: "5px" }}>Disponible</div></div>
                <div><div style={{ fontSize: "12.5px", fontWeight: "700", marginBottom: "6px" }}>Nom d'affichage</div><div style={{ height: "48px", padding: "0 14px", borderRadius: "14px", background: "#F2F5F4", border: "1px solid #EAEEEC", display: "flex", alignItems: "center", fontSize: "14.5px", fontWeight: "600" }}>Amina Diallo</div></div>
              </div>
            </div>
            <div><div style={{ fontSize: "12.5px", fontWeight: "700", marginBottom: "8px" }}>Statut</div><div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>{(statuses ?? []).map((s, sIndex) => (
<Fragment key={sIndex}><span style={{ padding: "9px 16px", borderRadius: "999px", fontSize: "13px", fontWeight: "600", background: s.bg, color: s.fg, border: `1px solid ${s.bd}` }}>{s.label}</span></Fragment>
))}</div></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div><div style={{ fontSize: "12.5px", fontWeight: "700", marginBottom: "8px" }}>Compétences</div><div style={{ minHeight: "48px", padding: "6px", borderRadius: "14px", background: "#F2F5F4", border: "1px solid #EAEEEC", display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}><span style={{ background: "#fff", borderRadius: "999px", padding: "6px 12px", fontSize: "12.5px", fontWeight: "600" }}>Comptabilité</span><span style={{ background: "#fff", borderRadius: "999px", padding: "6px 12px", fontSize: "12.5px", fontWeight: "600" }}>Excel</span><span style={{ fontSize: "12.5px", color: "#8A958F", padding: "0 6px" }}>Rechercher…</span></div></div>
              <div><div style={{ fontSize: "12.5px", fontWeight: "700", marginBottom: "8px" }}>Langues</div><div style={{ minHeight: "48px", padding: "6px", borderRadius: "14px", background: "#F2F5F4", border: "1px solid #EAEEEC", display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}><span style={{ background: "#fff", borderRadius: "999px", padding: "6px 12px", fontSize: "12.5px", fontWeight: "600" }}>Français</span><span style={{ background: "#fff", borderRadius: "999px", padding: "6px 12px", fontSize: "12.5px", fontWeight: "600" }}>Fon</span><span style={{ background: "#fff", borderRadius: "999px", padding: "6px 12px", fontSize: "12.5px", fontWeight: "600" }}>Anglais</span></div></div>
            </div>
            <div style={{ background: "#F3F7F5", borderRadius: "18px", padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}><span style={{ flex: "1", fontSize: "14.5px", fontWeight: "700" }}>Je suis disponible pour aider</span><button onClick={toggleHelp} style={{ width: "48px", height: "28px", borderRadius: "999px", border: "none", background: helpTrack, position: "relative", cursor: "pointer", padding: "8px 0", boxSizing: "content-box", backgroundClip: "content-box" }} role="switch" aria-checked={help} aria-label="Je suis disponible pour aider"><span style={{ position: "absolute", top: "11px", left: helpKnob, width: "22px", height: "22px", borderRadius: "999px", background: "#fff" }}></span></button></div>
              {help ? (<><div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "12px" }}>{(helpTypes ?? []).map((h, hIndex) => (
<Fragment key={hIndex}><span style={{ padding: "8px 14px", borderRadius: "999px", fontSize: "12.5px", fontWeight: "600", background: h.bg, color: h.fg, border: `1px solid ${h.bd}` }}>{h.label}</span></Fragment>
))}</div></>) : null}
            </div>
          </div>
          <button style={{ width: "100%", height: "52px", marginTop: "22px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "15px", fontWeight: "700" }}>Continuer</button>
        </div>
      </div>
    
      </main>
    </>
  );
}
