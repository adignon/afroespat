// GÉNÉRÉ depuis docs/template/03 Accueil v2.dc.html, section A14, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import type { A14Data } from './data';

export function A14MobileRattacher(props: A14Data) {
  const { attachQuery, attachTopics, etapeSelecteur, onAttachQuery, onContinue, parcoursLabel, parcoursSelecteur, storyBodyRecap, sujetLibre } = props;

  return (
    <>
      <div style={{ background: "#0A3F31", position: "relative", display: "flex", flexDirection: "column", flexGrow: "1", flexShrink: "1", flexBasis: "auto" }}>

      <main style={{ display: "contents" }}>

      <div style={{ padding: "70px 30px 0", color: "rgba(255,255,255,.4)", fontSize: "22px", fontWeight: "800", lineHeight: "1.2" }}>{storyBodyRecap}</div>
      <div style={{ position: "absolute", left: "0", right: "0", bottom: "0", height: "78%", background: "#fff", borderRadius: "28px 28px 0 0", padding: "12px 18px 26px", display: "flex", flexDirection: "column", gap: "12px", overflowY: "auto" }}>
        <span style={{ alignSelf: "center", width: "40px", height: "5px", borderRadius: "999px", background: "#DDE3E0" }}></span>
        <div style={{ display: "flex", justifyContent: "center", gap: "6px" }}><span style={{ width: "6px", height: "6px", borderRadius: "999px", background: "#CBD5D1" }}></span><span style={{ width: "18px", height: "6px", borderRadius: "999px", background: "#16785E" }}></span><span style={{ width: "6px", height: "6px", borderRadius: "999px", background: "#CBD5D1" }}></span></div>
        <div><h1 style={{ margin: "0", fontSize: "21px", fontWeight: "800", letterSpacing: "-0.5px" }}>Ce conseil concerne…</h1><div style={{ fontSize: "13px", color: "#5D6B66", marginTop: "4px" }}>Il sera montré à ceux qui passent par la même étape.</div></div>
        <div style={{ height: "44px", borderRadius: "999px", background: "#F2F5F4", padding: "0 16px", display: "flex", alignItems: "center", gap: "10px", fontSize: "13.5px", color: "#8A958F" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg><input type="text" value={attachQuery} onChange={onAttachQuery} placeholder="Rechercher une étape ou un sujet" aria-label="Rechercher une étape ou un sujet" data-saisie-sur-gris="" style={{ flex: "1", minWidth: "0", border: "none", background: "transparent", font: "inherit", color: "#16211D", outline: "none", padding: 0 }} /></div>
        {parcoursSelecteur}<div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F" }}>{parcoursLabel}</div>
        {etapeSelecteur}
        <div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F", marginTop: "2px" }}>SUJETS</div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>{(attachTopics ?? []).map((t, tIndex) => (
<Fragment key={tIndex}><button type="button" onClick={t.onPick} aria-pressed={t.on} style={{ padding: "8px 13px", borderRadius: "999px", background: t.bg, border: t.bd, fontSize: "12.5px", fontWeight: "600", fontFamily: "inherit", color: "inherit", cursor: "pointer", lineHeight: "normal" }}>{t.label}</button></Fragment>
))}</div>{sujetLibre}
        <div style={{ flex: "1" }}></div>
        <button style={{ height: "52px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "15px", fontWeight: "700" }} onClick={onContinue}>Continuer</button>
      </div>
    
      </main>
      </div>
    </>
  );
}
