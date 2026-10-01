// GÉNÉRÉ depuis docs/template/09 Messages et transverse.dc.html, section M01, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import type { M01BloqueData } from './data';

export function M01BloqueMobileConversation(props: M01BloqueData) {
  const { entete, messages } = props;

  return (
    <>
      <main style={{ display: "contents" }}>
<div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 12px) 12px 10px", display: "flex", alignItems: "center", gap: "8px", background: "#fff", borderBottom: "1px solid #E6EBE9", flexShrink: "0" }}><span style={{ width: "40px", height: "40px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg></span><h1 style={{ margin: "0", fontSize: "16px", fontWeight: "700", flex: "1", minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{entete.nom}</h1><button type="button" data-modal-open="M01MENU" aria-label="Menu de la conversation" style={{ width: "40px", height: "40px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0", border: "none", font: "inherit", cursor: "pointer", boxSizing: "content-box", padding: "2px", margin: "-2px", backgroundClip: "content-box" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h.01M12 12h.01M19 12h.01" /></svg></button></div><div style={{ flex: "1", overflow: "hidden", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>{(messages ?? []).map((m, mIndex) => (
<Fragment key={mIndex}><div style={{ display: "flex", flexDirection: "column", alignItems: m.cote, gap: "4px" }}><div style={{ maxWidth: "70%", padding: "11px 14px", borderRadius: m.rayon, background: m.fond, color: m.encre, border: m.trait, fontSize: "14px", lineHeight: "1.5" }}>{m.auteur ? (<><strong>{m.auteur}</strong><br /></>) : null}{m.corps}</div>{m.mention ? (<><span style={{ fontSize: "11px", color: "#8A958F" }}>{m.mention}</span></>) : null}</div></Fragment>
))}</div><div style={{ flexShrink: "0", background: "#fff", borderTop: "1px solid #E6EBE9", padding: "12px 16px 28px", display: "flex", gap: "8px" }}><div style={{ background: "#F3F7F5", borderRadius: "14px", padding: "12px", fontSize: "12.5px", color: "#0F5C48", lineHeight: "1.5" }}>Vous avez bloqué ce membre. Débloquez-le pour reprendre la conversation.<button style={{ padding: "0 18px", borderRadius: "14px", background: "#F2F5F4", color: "#16211D", border: "none", font: "inherit", fontSize: "13.5px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", whiteSpace: "nowrap", flexShrink: "0", height: "36px" }}>Débloquer</button></div></div>
      </main>
    </>
  );
}
