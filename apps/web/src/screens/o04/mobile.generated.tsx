// GÉNÉRÉ depuis docs/template/01 Accès et Onboarding.dc.html, section O04, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import type { OnboardingVals } from '../onboarding/data';

export function O04Mobile(props: OnboardingVals) {
  const { avatarFond, avatarIconDisplay, busy, competencesChamp, displayNameValue, handleValue, help, helpKnob, helpTrack, languesChamp, onAvatar, onContinue, onDisplayNameChange, onHandleChange, seg4, statuses, toggleHelp } = props;

  return (
    <>
      <div style={{ background: "#F6F8F7", padding: "56px 20px 28px", display: "flex", flexDirection: "column", gap: "14px", flexGrow: "1", flexShrink: "1", flexBasis: "auto" }}>

      <main style={{ display: "contents" }}>

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}><div style={{ flex: "1", display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: "4px" }}>{(seg4 ?? []).map((s, sIndex) => (
<Fragment key={sIndex}><span style={{ height: "5px", borderRadius: "999px", background: s }}></span></Fragment>
))}</div><span style={{ fontSize: "12px", fontWeight: "700", color: "#5D6B66" }}>4/6</span></div>
      <h1 style={{ margin: "14px 0 0", fontSize: "25px", fontWeight: "800", letterSpacing: "-0.8px" }}>Présentez-vous</h1>
      <button type="button" onClick={onAvatar} aria-label="Choisir une photo de profil" style={{ width: "76px", height: "76px", borderRadius: "999px", background: "#fff", border: "1.5px dashed #CBD5D1", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#8A958F", flexShrink: 0, backgroundImage: avatarFond, backgroundSize: "cover", backgroundPosition: "center" }}><svg aria-hidden="true" style={{ display: avatarIconDisplay }} width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h4l2-3h6l2 3h4v11H3z" /><circle cx="12" cy="13" r="3.5" /></svg></button>
      <div style={{ height: "48px", padding: "0 14px", borderRadius: "14px", border: "1.5px solid #16785E", background: "#fff", display: "flex", alignItems: "center", fontSize: "14.5px", fontWeight: "600" }}>@<input placeholder="votre pseudo" type="text" name="handle" autoComplete="off" aria-label="Votre pseudo" value={handleValue} onChange={onHandleChange} style={{ flex: "1", minWidth: "0", border: "none", background: "transparent", font: "inherit", color: "inherit", outline: "none", padding: 0 }} /></div>
      <input style={{ height: "48px", padding: "0 14px", borderRadius: "14px", background: "#fff", border: "1px solid #E6EBE9", display: "flex", alignItems: "center", fontSize: "14.5px", fontWeight: "600" }} placeholder="Prénom et nom" type="text" name="displayName" autoComplete="name" aria-label="Votre nom d’affichage" value={displayNameValue} onChange={onDisplayNameChange} />
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>{(statuses ?? []).map((s, sIndex) => (
<Fragment key={sIndex}><button type="button" onClick={s.onPick} aria-pressed={s.on} style={{ padding: "8px 13px", borderRadius: "999px", fontSize: "12.5px", fontWeight: "600", background: s.bg, color: s.fg, border: `1px solid ${s.bd}`, font: "inherit", cursor: "pointer", lineHeight: "normal" }}>{s.label}</button></Fragment>
))}</div>
      <div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "16px", padding: "14px", display: "flex", alignItems: "center", gap: "10px" }}><span style={{ flex: "1", fontSize: "14px", fontWeight: "700" }}>Disponible pour aider</span><button type="button" onClick={toggleHelp} style={{ width: "48px", height: "44px", padding: "0", border: "none", background: "transparent", display: "flex", alignItems: "center", flexShrink: "0", cursor: "pointer", borderRadius: "22px" }} role="switch" aria-checked={help} aria-label="Disponible pour aider"><span data-interrupteur-piste="" style={{ position: "relative", display: "block", boxSizing: "border-box", width: "48px", height: "28px", borderRadius: "999px", backgroundColor: helpTrack }}><span style={{ position: "absolute", top: "3px", left: helpKnob, width: "22px", height: "22px", borderRadius: "999px", background: "#fff" }}></span></span></button></div>
      <div><div style={{ fontSize: "12.5px", fontWeight: "700", marginBottom: "8px" }}>Compétences</div><div style={{ minHeight: "48px", padding: "6px", borderRadius: "14px", background: "#F2F5F4", border: "1px solid #EAEEEC", display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center", position: "relative" }}>{competencesChamp}</div></div>
      <div><div style={{ fontSize: "12.5px", fontWeight: "700", marginBottom: "8px" }}>Langues</div><div style={{ minHeight: "48px", padding: "6px", borderRadius: "14px", background: "#F2F5F4", border: "1px solid #EAEEEC", display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center", position: "relative" }}>{languesChamp}</div></div>
      <div style={{ flex: "1" }}></div>
      <button style={{ width: "100%", height: "52px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "15px", fontWeight: "700" }} onClick={onContinue} disabled={busy}>Continuer</button>
    
      </main>
      </div>
    </>
  );
}
