// GÉNÉRÉ depuis docs/template/03 Accueil v2.dc.html, section A01P, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import Link from 'next/link';
import type { A01PData } from './data';

export function A01PMobile(props: A01PData) {
  const { onPartageRecherche, onPartager, partageAucun, partageBloque, partageRecherche, shareBtn, shareBtnBg, shareBtnFg, shareContacts, shareNets, shareOut } = props;

  return (
    <>

      
      <div style={{ position: "fixed", inset: "0", background: "rgba(22,33,29,.55)" }} data-modal-overlay=""></div>
      <div style={{ position: "fixed", left: "0", right: "0", bottom: "0", background: "#fff", borderRadius: "28px 28px 0 0", padding: "10px 18px 28px", display: "flex", flexDirection: "column", gap: "16px", maxHeight: "calc(100vh - 24px)", overflow: "hidden" }} data-modal-panel="">
        <button type="button" aria-label="Fermer" data-modal-close="" style={{ alignSelf: "center", width: "40px", height: "5px", borderRadius: "999px", background: "#DDE3E0", border: "none", padding: "20px 24px", font: "inherit", cursor: "pointer", boxSizing: "content-box", marginTop: "-10px", marginBottom: "-10px", backgroundClip: "content-box" }}></button>
        <h2 id="a01p-titre" style={{ margin: "0", fontSize: "18px", fontWeight: "800" }}>Partager</h2>
        <div data-fenetre-contenu="" style={{ flex: "1", minHeight: "0", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}><div style={{ height: "44px", borderRadius: "999px", background: "#F2F5F4", padding: "0 16px", display: "flex", alignItems: "center", gap: "10px", fontSize: "13.5px", color: "#8A958F" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg><input type="search" value={partageRecherche} onChange={onPartageRecherche} placeholder="Rechercher un contact" aria-label="Rechercher un contact" data-partage-recherche="" style={{ flex: "1", minWidth: "0", border: "none", background: "transparent", font: "inherit", fontSize: "13.5px", color: "#16211D", outline: "none", padding: 0 }} /></div>
        <div style={{ display: "flex", gap: "2px", overflowX: "auto" }} tabIndex={0}>{(shareContacts ?? []).map((c, cIndex) => (
<Fragment key={cIndex}><button onClick={c.onPick} style={{ width: "70px", flexShrink: "0", border: "none", background: "none", padding: "0", font: "inherit", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}><span style={{ position: "relative", width: "50px", height: "50px", borderRadius: "999px", background: c.bg, color: "#fff", fontSize: "12px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", outline: c.ring, outlineOffset: "2px" }}>{c.i}{c.on ? (<><span style={{ position: "absolute", right: "-3px", bottom: "-3px", width: "19px", height: "19px", borderRadius: "999px", background: "#16785E", border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round"><path d="m5 12 4.5 4.5L19 7" /></svg></span></>) : null}</span><span style={{ fontSize: "11px", fontWeight: "600", color: "#16211D", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "68px" }}>{c.profil ? (<Link href={c.profil} data-nom-profil="" style={{ color: "inherit", textDecoration: "none" }}>{c.name}</Link>) : c.name}</span></button></Fragment>
))}</div>{partageAucun ? (<div style={{ textAlign: "center", padding: "8px 0" }}><div style={{ fontSize: "14px", fontWeight: "700" }}>Aucun contact à ce nom</div><div style={{ fontSize: "12.5px", color: "#5D6B66", marginTop: "4px" }}>Essayez un autre prénom, ou partagez le lien.</div></div>) : null}
        <div><div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F", marginBottom: "4px" }}>DANS UN RÉSEAU</div>{(shareNets ?? []).map((n, nIndex) => (
<Fragment key={nIndex}><button type="button" onClick={n.onPartager} disabled={n.bloque} data-partage-reseau="" aria-label={n.action} style={{ display: "flex", alignItems: "center", gap: "12px", height: "52px", width: "100%", border: "none", background: "none", padding: 0, font: "inherit", textAlign: "left", cursor: n.bloque ? "default" : "pointer", opacity: n.bloque ? ".55" : "1" }}><span style={{ width: "34px", height: "34px", borderRadius: "10px", background: n.bg, color: "#fff", fontSize: "10px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center" }}>{n.i}</span><span style={{ flex: "1", fontSize: "13.5px", fontWeight: "700" }}>{n.name}</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A958F" strokeWidth="2" strokeLinecap="round"><path d="m9 18 6-6-6-6" /></svg></button></Fragment>
))}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "8px" }}>{(shareOut ?? []).map((o, oIndex) => (
<Fragment key={oIndex}><button type="button" onClick={o.onChoisir} data-partage-sortie="" aria-label={o.label} style={{ height: "70px", borderRadius: "16px", background: "#F6F8F7", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "12px", fontWeight: "700", border: "none", font: "inherit", cursor: "pointer", width: "100%" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F5C48" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={o.icon} /></svg>{o.label}</button></Fragment>
))}</div>
        </div><button type="button" onClick={onPartager} disabled={partageBloque} data-partage-envoyer="" style={{ height: "52px", borderRadius: "14px", background: shareBtnBg, color: shareBtnFg, border: "none", font: "inherit", fontSize: "15px", fontWeight: "700", cursor: "pointer", opacity: partageBloque ? ".55" : "1" }}>{shareBtn}</button>
      </div>
    
    </>
  );
}
