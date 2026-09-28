// GÉNÉRÉ depuis docs/template/03 Accueil v2.dc.html, section A01C, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import type { A01Data } from '../a01/data';

export function A01CMobile(props: A01Data) {
  const { thread } = props;

  return (
    <>

      
      <div style={{ position: "fixed", inset: "0", background: "rgba(22,33,29,.55)" }} data-modal-overlay=""></div>
      <div style={{ position: "fixed", left: "0", right: "0", bottom: "0", height: "88%", background: "#fff", borderRadius: "28px 28px 0 0", display: "flex", flexDirection: "column" }} data-modal-panel="">
        <button type="button" aria-label="Fermer" data-modal-close="" style={{ alignSelf: "center", width: "40px", height: "5px", borderRadius: "999px", background: "#DDE3E0", marginTop: "0", flexShrink: "0", border: "none", padding: "10px 24px", font: "inherit", cursor: "pointer", boxSizing: "content-box", backgroundClip: "content-box" }}></button>
        <div style={{ padding: "12px 18px", display: "flex", alignItems: "center", borderBottom: "1px solid #EAEEEC", flexShrink: "0" }}><h2 id="a01c-titre" style={{ margin: "0", fontSize: "17px", fontWeight: "800", flex: "1" }}>Commentaires <span style={{ color: "#8A958F" }}>· 8</span></h2><span style={{ fontSize: "12.5px", fontWeight: "700", color: "#5D6B66" }}>Pertinents</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5D6B66" strokeWidth="2" strokeLinecap="round" style={{ marginLeft: "4px" }}><path d="m6 9 6 6 6-6" /></svg></div>
        <div style={{ flex: "1", minHeight: "0", overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "14px" }}>
          {(thread ?? []).map((c, cIndex) => (
<Fragment key={cIndex}><div style={{ display: "flex", gap: "10px", paddingLeft: c.indentM }}>
              <span style={{ width: "34px", height: "34px", borderRadius: "999px", background: c.bg, color: "#fff", fontSize: "10.5px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>{c.i}</span>
              <div style={{ flex: "1", minWidth: "0" }}><div style={{ background: "#F6F8F7", borderRadius: "14px", padding: "10px 12px" }}><div style={{ display: "flex", alignItems: "center", gap: "5px" }}><span style={{ fontSize: "13px", fontWeight: "700" }}>{c.name}</span><svg width="12" height="12" viewBox="0 0 24 24" fill="#16785E"><circle cx="12" cy="12" r="10" /><path d="m8 12 3 3 5-6" stroke="#fff" strokeWidth="2.2" fill="none" /></svg></div><div style={{ fontSize: "13px", lineHeight: "1.5", marginTop: "2px" }}>{c.text}</div></div><div style={{ display: "flex", gap: "14px", fontSize: "11.5px", color: "#8A958F", marginTop: "5px", paddingLeft: "4px" }}><span>{c.time}</span><span style={{ fontWeight: "700", color: c.likeFg }}>Utile · {c.likes}</span>{c.canReply ? (<><span style={{ fontWeight: "700", color: "#5D6B66" }}>Répondre</span></>) : null}</div></div>
            </div></Fragment>
))}
        </div>
        <div style={{ flexShrink: "0", borderTop: "1px solid #EAEEEC", padding: "10px 12px 26px", display: "flex", gap: "8px", alignItems: "center" }}><div style={{ flex: "1", height: "44px", borderRadius: "999px", background: "#F2F5F4", padding: "0 16px", display: "flex", alignItems: "center", fontSize: "13.5px", color: "#8A958F" }}>Écrire un commentaire…</div><span style={{ width: "44px", height: "44px", borderRadius: "999px", background: "#16785E", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></span></div>
      </div>
    
    </>
  );
}
