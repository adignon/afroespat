// GÉNÉRÉ depuis docs/template/03 Accueil v2.dc.html, section A01P, cadre 1440 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 1440 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import type { A01Data } from '../a01/data';

export function A01PDesktop(props: A01Data) {
  const { shareBtn, shareBtnBg, shareBtnFg, shareContacts, shareNets, shareOut } = props;

  return (
    <>

      
      <div style={{ position: "fixed", inset: "0", background: "rgba(22,33,29,.55)" }} data-modal-overlay=""></div>
      <div style={{ position: "fixed", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: "520px", background: "#fff", borderRadius: "28px", padding: "24px", display: "flex", flexDirection: "column", gap: "18px" }} data-modal-panel="">
        <div style={{ display: "flex", alignItems: "center" }}><h2 id="a01p-titre" style={{ margin: "0", fontSize: "20px", fontWeight: "800", letterSpacing: "-0.5px", flex: "1" }}>Partager</h2><button type="button" aria-label="Fermer" data-modal-close="" style={{ width: "40px", height: "40px", borderRadius: "999px", background: "#F2F5F4", display: "flex", alignItems: "center", justifyContent: "center", border: "none", padding: "0", font: "inherit", cursor: "pointer" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button></div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", background: "#F6F8F7", borderRadius: "18px", padding: "12px 14px" }}><span style={{ width: "38px", height: "38px", borderRadius: "999px", background: "#B4581F", color: "#fff", fontSize: "11px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>AD</span><div style={{ minWidth: "0" }}><div style={{ fontSize: "13px", fontWeight: "700" }}>Amina Diallo · Victoire</div><div style={{ fontSize: "12.5px", color: "#5D6B66", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Attestation de virement irrévocable validée ce matin…</div></div></div>
        <div><div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F", marginBottom: "10px" }}>ENVOYER À UN CONTACT</div>
          <div style={{ height: "44px", borderRadius: "999px", background: "#F2F5F4", padding: "0 16px", display: "flex", alignItems: "center", gap: "10px", fontSize: "13.5px", color: "#8A958F" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>Rechercher un contact</div>
          <div style={{ display: "flex", gap: "6px", marginTop: "12px" }}>{(shareContacts ?? []).map((c, cIndex) => (
<Fragment key={cIndex}><button onClick={c.onPick} style={{ width: "84px", border: "none", background: "none", padding: "0", font: "inherit", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}><span style={{ position: "relative", width: "52px", height: "52px", borderRadius: "999px", background: c.bg, color: "#fff", fontSize: "13px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", outline: c.ring, outlineOffset: "2px" }}>{c.i}{c.on ? (<><span style={{ position: "absolute", right: "-3px", bottom: "-3px", width: "20px", height: "20px", borderRadius: "999px", background: "#16785E", border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round"><path d="m5 12 4.5 4.5L19 7" /></svg></span></>) : null}</span><span style={{ fontSize: "11.5px", fontWeight: "600", color: "#16211D", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "84px" }}>{c.name}</span></button></Fragment>
))}</div>
        </div>
        <div><div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F", marginBottom: "8px" }}>DANS UN RÉSEAU</div>{(shareNets ?? []).map((n, nIndex) => (
<Fragment key={nIndex}><div style={{ display: "flex", alignItems: "center", gap: "12px", height: "52px", padding: "0 4px" }}><span style={{ width: "34px", height: "34px", borderRadius: "10px", background: n.bg, color: "#fff", fontSize: "10px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center" }}>{n.i}</span><span style={{ flex: "1" }}><span style={{ display: "block", fontSize: "13.5px", fontWeight: "700" }}>{n.name}</span><span style={{ display: "block", fontSize: "11.5px", color: "#8A958F" }}>{n.sub}</span></span><span style={{ height: "34px", padding: "0 14px", borderRadius: "999px", background: "#F2F5F4", fontSize: "12.5px", fontWeight: "700", display: "flex", alignItems: "center" }}>Partager</span></div></Fragment>
))}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "8px" }}>{(shareOut ?? []).map((o, oIndex) => (
<Fragment key={oIndex}><div style={{ height: "74px", borderRadius: "16px", background: "#F6F8F7", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "12.5px", fontWeight: "700" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F5C48" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={o.icon} /></svg>{o.label}</div></Fragment>
))}</div>
        <div style={{ fontSize: "12px", color: "#8A958F", lineHeight: "1.5" }}>Hors de la plateforme, seuls les membres connectés pourront ouvrir la publication.</div>
        <button style={{ height: "50px", borderRadius: "14px", background: shareBtnBg, color: shareBtnFg, border: "none", font: "inherit", fontSize: "14.5px", fontWeight: "700" }}>{shareBtn}</button>
      </div>
    
    </>
  );
}
