// GÉNÉRÉ depuis docs/template/07 Agenda.dc.html, section E04, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import Link from 'next/link';
import type { E04Data } from '../agenda/data';

export function E04Mobile(props: E04Data) {
  const { inscrits, participants, presents } = props;

  return (
    <>
      <main style={{ display: "contents" }}>
<div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 12px) 12px 10px", display: "flex", alignItems: "center", gap: "8px", background: "#fff", borderBottom: "1px solid #E6EBE9", flexShrink: "0" }}><span style={{ width: "40px", height: "40px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg></span><h1 style={{ margin: "0", fontSize: "16px", fontWeight: "700", flex: "1", minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Présence · {presents} / {inscrits}</h1></div><div style={{ flexGrow: "1", overflow: "visible", padding: "12px 16px", display: "flex", flexDirection: "column", gap: "12px" }}><div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "0 14pxpx", flexShrink: "0" }}>{(participants ?? []).map((p, pIndex) => (
<Fragment key={pIndex}><div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 0", borderBottom: "1px solid #F0F3F2" }}>{p.profil ? (<Link href={p.profil} data-avatar-profil="" aria-label={`Voir le profil de ${p.nom}`} style={{ display: "contents", color: "inherit", textDecoration: "none" }}><span style={{ width: "36px", height: "36px", borderRadius: "999px", background: p.fond, color: "#fff", fontSize: "11px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>{p.initiales}</span></Link>) : (<span style={{ width: "36px", height: "36px", borderRadius: "999px", background: p.fond, color: "#fff", fontSize: "11px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>{p.initiales}</span>)}<span style={{ flex: "1", fontSize: "14px", fontWeight: "600" }}>{p.profil ? (<Link href={p.profil} data-nom-profil="" style={{ color: "inherit", textDecoration: "none" }}>{p.nom}</Link>) : p.nom}</span><span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", color: "#5D6B66" }}>Présent·e{p.coche ? (<><span style={{ width: "24px", height: "24px", borderRadius: "8px", background: "#16785E", border: "none", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4.5 4.5L19 7" /></svg></span></>) : null}{p.vide ? (<><span style={{ width: "24px", height: "24px", borderRadius: "8px", background: "#fff", border: "1.5px solid #CBD5D1", display: "flex", alignItems: "center", justifyContent: "center" }}></span></>) : null}</span></div></Fragment>
))}</div></div><div style={{ flexShrink: "0", background: "#fff", borderTop: "1px solid #E6EBE9", padding: "12px 16px 28px", display: "flex", gap: "8px" }}><button style={{ height: "44px", padding: "0 18px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "13.5px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", whiteSpace: "nowrap", flexShrink: "0", flex: "1" }}>Enregistrer</button></div>
      </main>
    </>
  );
}
