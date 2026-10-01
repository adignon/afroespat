// GÉNÉRÉ depuis docs/template/04 Parcours.dc.html, section J01M, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import type { J01MData } from '../parcours/data';

export function J01MMobile(props: J01MData) {
  const { mesParcours, total } = props;

  return (
    <>
<div style={{ position: "fixed", inset: "0", background: "rgba(22,33,29,.55)" }} data-modal-overlay=""></div><div style={{ position: "fixed", left: "0", right: "0", bottom: "0", background: "#fff", borderRadius: "28px 28px 0 0", padding: "10px 12px 28px", display: "flex", flexDirection: "column", gap: "4px" }} data-modal-panel=""><button type="button" aria-label="Fermer" data-modal-close="" style={{ alignSelf: "center", width: "40px", height: "5px", borderRadius: "999px", background: "#DDE3E0", marginBottom: "8px", border: "none", padding: "10px 24px", font: "inherit", cursor: "pointer", boxSizing: "content-box", marginTop: "0", backgroundClip: "content-box" }}></button><h2 id="j01m-titre" style={{ margin: "0", fontSize: "18px", fontWeight: "800", padding: "0 6px 6px" }}>Mes parcours · {total}</h2>{(mesParcours ?? []).map((p, pIndex) => (
<Fragment key={pIndex}><div style={{ display: "flex", gap: "12px", alignItems: "center", padding: "12px", borderRadius: "14px", background: p.fond }}><div style={{ flex: "1", minWidth: "0" }}><div style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ fontSize: "13.5px", fontWeight: "700", color: "#16211D" }}>{p.titre}</span><span style={{ background: p.pastilleFond, color: p.pastilleTexte, fontSize: "10.5px", fontWeight: "700", padding: "3px 9px", borderRadius: "999px", whiteSpace: "nowrap" }}>{p.etat}</span></div><div style={{ fontSize: "11.5px", color: "#8A958F", marginTop: "2px" }}>{p.sousTitre}</div><div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "8px" }}><div style={{ flex: "1" }}><div style={{ height: "5px", borderRadius: "999px", background: "#EEF2F0", overflow: "hidden" }}><div style={{ width: p.barre, height: "100%", background: p.teinte, borderRadius: "999px" }}></div></div></div><span style={{ fontSize: "11.5px", fontWeight: "800", color: "#16211D" }}>{p.pourcent}</span></div></div>{p.courant ? (<><span style={{ width: "22px", height: "22px", borderRadius: "999px", background: "#16785E", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4.5 4.5L19 7" /></svg></span></>) : null}{p.autre ? (<><span style={{ width: "22px" }}></span></>) : null}</div></Fragment>
))}<div style={{ padding: "10px 4px 0" }}><a href="#" style={{ height: "44px", borderRadius: "16px", border: "1.5px dashed #9FB3AB", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "13.5px", fontWeight: "700", color: "#0F5C48" }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>Nouveau parcours</a></div></div>
    </>
  );
}
