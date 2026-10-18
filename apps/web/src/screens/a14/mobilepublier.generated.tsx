// GÉNÉRÉ depuis docs/template/03 Accueil v2.dc.html, section A14, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import type { A14Data } from './data';

export function A14MobilePublier(props: A14Data) {
  const { audience, busy, etapeRecap, msgsKnob, msgsOn, msgsTrack, onEdit, onPublish, storyBody, sujetRecap, toggleMsgs, webKind, writeBg } = props;

  return (
    <>
      <div style={{ background: "#F6F8F7", display: "flex", flexDirection: "column", padding: "48px 18px 26px", gap: "14px", flexGrow: "1", flexShrink: "1", flexBasis: "auto" }}>

      <main style={{ display: "contents" }}>

      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}><span style={{ width: "40px", height: "40px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg></span><span style={{ flex: "1", display: "flex", justifyContent: "center", gap: "6px" }}><span style={{ width: "6px", height: "6px", borderRadius: "999px", background: "#CBD5D1" }}></span><span style={{ width: "6px", height: "6px", borderRadius: "999px", background: "#CBD5D1" }}></span><span style={{ width: "18px", height: "6px", borderRadius: "999px", background: "#16785E" }}></span></span><span style={{ width: "40px" }}></span></div>
      <h1 style={{ margin: "0", fontSize: "24px", fontWeight: "800", letterSpacing: "-0.6px" }}>Prêt à publier</h1>
      <div style={{ display: "flex", gap: "12px" }}>
        <div style={{ width: "132px", height: "234px", flexShrink: "0", borderRadius: "18px", background: writeBg, color: "#fff", padding: "12px", display: "flex", flexDirection: "column", justifyContent: "center", gap: "6px" }}><span style={{ fontSize: "7.5px", fontWeight: "800", letterSpacing: "1px", opacity: ".75" }}>{webKind}</span><span style={{ fontSize: "13px", fontWeight: "800", lineHeight: "1.2" }}>{storyBody}</span></div>
        <div style={{ flex: "1", display: "flex", flexDirection: "column", gap: "8px", minWidth: "0" }}>
          <div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "16px", padding: "12px" }}><div style={{ fontSize: "10px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F" }}>SUJET</div><div style={{ fontSize: "13.5px", fontWeight: "700", marginTop: "4px" }}>{sujetRecap}</div><div style={{ fontSize: "11.5px", color: "#5D6B66", marginTop: "2px" }}>{etapeRecap}</div></div>
          <div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "16px", padding: "12px" }}><div style={{ fontSize: "10px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F" }}>VISIBLE</div><div style={{ fontSize: "13.5px", fontWeight: "700", marginTop: "4px" }}>24 heures</div><div style={{ fontSize: "11.5px", color: "#5D6B66", marginTop: "2px", lineHeight: "1.4" }}>puis gardé par ceux qui l'enregistrent</div></div>
        </div>
      </div>
      <div><div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F", marginBottom: "8px" }}>QUI LE VOIT</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", background: "#EEF2F0", borderRadius: "14px", padding: "4px" }}>{(audience ?? []).map((a, aIndex) => (
<Fragment key={aIndex}><button type="button" onClick={a.onPick} aria-pressed={a.on} style={{ height: "42px", borderRadius: "11px", border: "none", font: "inherit", fontSize: "13px", fontWeight: "700", cursor: "pointer", background: a.bg, color: a.fg, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>{a.label}{a.chevron ? (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ flexShrink: 0 }}><path d="m6 9 6 6 6-6" /></svg>) : null}</button></Fragment>
))}</div></div>
      <div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "16px", padding: "14px", display: "flex", alignItems: "center", gap: "12px" }}><span style={{ flex: "1", fontSize: "14px", fontWeight: "700" }}>Autoriser les messages</span><button onClick={toggleMsgs} style={{ width: "48px", height: "28px", borderRadius: "999px", border: "none", backgroundColor: msgsTrack, position: "relative", cursor: "pointer", padding: "8px 0", boxSizing: "content-box", backgroundClip: "content-box" }} role="switch" aria-checked={msgsOn} aria-label="Autoriser les messages"><span style={{ position: "absolute", top: "11px", left: msgsKnob, width: "22px", height: "22px", borderRadius: "999px", background: "#fff" }}></span></button></div>
      <div style={{ flex: "1" }}></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: "8px" }}><button style={{ height: "52px", borderRadius: "14px", background: "#fff", color: "#0F5C48", border: "1.5px solid #CFE3DA", font: "inherit", fontSize: "15px", fontWeight: "700" }} onClick={onEdit}>Modifier</button><button style={{ height: "52px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "15px", fontWeight: "700" }} onClick={onPublish} disabled={busy}>Publier</button></div>
    
      </main>
      </div>
    </>
  );
}
