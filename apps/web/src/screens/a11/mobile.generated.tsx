// GÉNÉRÉ depuis docs/template/03 Accueil v2.dc.html, section A11, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import Link from 'next/link';
import type { AccueilData } from '../accueil/data';

export function A11Mobile(props: AccueilData) {
  const { dirFilters, directory } = props;

  return (
    <>
      <main style={{ display: "contents" }}>

    <div style={{ padding: "52px 16px 12px", background: "#fff", borderBottom: "1px solid #E6EBE9" }}><h1 style={{ margin: "0", fontSize: "22px", fontWeight: "800", letterSpacing: "-0.6px" }}>Villes et Membres</h1><div style={{ display: "flex", gap: "4px", background: "#EEF2F0", borderRadius: "12px", padding: "4px", marginTop: "12px" }}><span style={{ flex: "1", textAlign: "center", padding: "8px", borderRadius: "9px", fontSize: "13px", fontWeight: "700", color: "#5D6B66" }}>Carte</span><span style={{ flex: "1", textAlign: "center", padding: "8px", borderRadius: "9px", fontSize: "13px", fontWeight: "700", background: "#fff" }}>Annuaire</span></div><div style={{ display: "flex", gap: "6px", marginTop: "10px", overflowX: "auto" }} tabIndex={0}>{(dirFilters ?? []).map((f, fIndex) => (
<Fragment key={fIndex}><span style={{ padding: "7px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: "600", background: f.bg, color: f.fg, border: `1px solid ${f.bd}`, whiteSpace: "nowrap" }}>{f.label}</span></Fragment>
))}</div></div>
    <div style={{ flex: "1", padding: "12px 16px", display: "flex", flexDirection: "column", gap: "10px", overflow: "hidden" }}>{(directory ?? []).map((m, mIndex) => (
<Fragment key={mIndex}><div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "20px", padding: "14px" }}><div style={{ display: "flex", gap: "12px", alignItems: "center" }}>{m.profil ? (<Link href={m.profil} data-avatar-profil="" aria-label={`Voir le profil de ${m.name}`} style={{ display: "contents", color: "inherit", textDecoration: "none" }}><span style={{ width: "44px", height: "44px", borderRadius: "999px", background: m.bg, color: "#fff", fontSize: "12px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>{m.i}</span></Link>) : (<span style={{ width: "44px", height: "44px", borderRadius: "999px", background: m.bg, color: "#fff", fontSize: "12px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>{m.i}</span>)}<span style={{ flex: "1", minWidth: "0" }}><span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "14px", fontWeight: "700" }}>{m.profil ? (<Link href={m.profil} data-nom-profil="" style={{ color: "inherit", textDecoration: "none" }}>{m.name}</Link>) : m.name}<svg width="13" height="13" viewBox="0 0 24 24" fill="#16785E"><circle cx="12" cy="12" r="10" /><path d="m8 12 3 3 5-6" stroke="#fff" strokeWidth="2.2" fill="none" /></svg></span><span style={{ display: "block", fontSize: "12px", color: "#8A958F" }}>{m.sub}</span></span></div><div style={{ display: "flex", gap: "6px", marginTop: "10px", flexWrap: "wrap" }}>{m.help ? (<><span style={{ background: "#E3F0EB", color: "#0F5C48", fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "999px" }}>Disponible pour aider</span></>) : null}{(m.skills ?? []).map((s, sIndex) => (
<Fragment key={sIndex}><span style={{ background: "#F2F5F4", color: "#5D6B66", fontSize: "11px", fontWeight: "600", padding: "4px 10px", borderRadius: "999px" }}>{s}</span></Fragment>
))}</div></div></Fragment>
))}</div>
  
      </main>
    </>
  );
}
