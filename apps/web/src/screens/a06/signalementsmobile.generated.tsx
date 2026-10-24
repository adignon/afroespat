// GÉNÉRÉ depuis docs/template/03 Accueil v2.dc.html, section A06, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import Link from 'next/link';
import type { A06Data } from './data';

export function A06SignalementsMobile(props: A06Data) {
  const { guide, signalements } = props;

  return (
    <>

      <main style={{ display: "contents" }}>

      <div style={{ padding: "52px 16px 12px", background: "#fff", borderBottom: "1px solid #E6EBE9" }}><div style={{ display: "flex", alignItems: "center", gap: "10px" }}><Link href={guide.href} aria-label="Revenir au guide" data-a06-retour="" style={{ width: "40px", height: "40px", borderRadius: "999px", background: "#F2F5F4", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg></Link><h1 style={{ margin: "0", fontSize: "17px", fontWeight: "800" }}>{signalements.titre}</h1></div><div style={{ display: "flex", gap: "6px", marginTop: "12px" }}><span style={{ padding: "8px 13px", borderRadius: "999px", background: "#16785E", color: "#fff", fontSize: "12.5px", fontWeight: "700" }}>{signalements.compte}</span></div></div>
      <div style={{ flex: "1", padding: "14px 16px", overflow: "hidden", display: "flex", flexDirection: "column", gap: "12px" }}>
<div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "20px", padding: "16px" }}><div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F" }}>{signalements.libelle}</div>{(signalements.items ?? []).map((f, fIndex) => (
<Fragment key={fIndex}><div style={{ display: "flex", gap: "10px", marginTop: "12px", alignItems: "flex-start" }}><span style={{ width: "8px", height: "8px", borderRadius: "999px", background: f.dot, marginTop: "6px", flexShrink: "0" }}></span><span><span style={{ display: "block", fontSize: "13px", fontWeight: "600" }}>{f.quand}</span><span style={{ display: "block", fontSize: "11.5px", color: "#8A958F" }}>{f.dit}</span></span></div></Fragment>
))}</div>
      </div>
    
      </main>
    </>
  );
}
