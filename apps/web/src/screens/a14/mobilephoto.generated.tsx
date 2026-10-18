// GÉNÉRÉ depuis docs/template/03 Accueil v2.dc.html, section A14, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import type { A14Data } from './data';

export function A14MobilePhoto(props: A14Data) {
  const { assombri, bodyMax, bodyStyle, layerStyle, onClose, onContinue, onLayerGrab, onStoryBodyChange, photoFond, photoTools, storyBodyValue } = props;

  return (
    <>
      <div style={{ background: photoFond, color: "#fff", display: "flex", flexDirection: "column", padding: "48px 16px 26px", position: "relative", flexGrow: "1", flexShrink: "1", flexBasis: "auto" }}>

      <main style={{ display: "contents" }}>

      {assombri ? (<><div style={{ position: "absolute", left: "0", right: "0", bottom: "0", height: "60%", background: "linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.72))" }}></div></>) : null}
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "8px" }}><button type="button" onClick={onClose} aria-label="Fermer" style={{ border: "none", fontFamily: "inherit", color: "inherit", cursor: "pointer", padding: 0, width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button><span style={{ flex: "1", display: "flex", justifyContent: "center", gap: "6px" }}><span style={{ width: "18px", height: "6px", borderRadius: "999px", background: "#fff" }}></span><span style={{ width: "6px", height: "6px", borderRadius: "999px", background: "rgba(255,255,255,.4)" }}></span><span style={{ width: "6px", height: "6px", borderRadius: "999px", background: "rgba(255,255,255,.4)" }}></span></span><span style={{ width: "40px" }}></span></div>
      <div style={{ position: "relative", display: "flex", gap: "8px", justifyContent: "center", marginTop: "14px" }}>{(photoTools ?? []).map((t, tIndex) => (
<Fragment key={tIndex}><button type="button" onClick={t.onPick} aria-pressed={t.on} style={{ height: "38px", padding: "0 14px", borderRadius: "999px", background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", fontSize: "12.5px", fontWeight: "700", border: "none", fontFamily: "inherit", color: "inherit", cursor: "pointer" }}>{t.label}</button></Fragment>
))}</div>
      <div style={{ position: "relative", flex: "1", display: "flex", flexDirection: "column", justifyContent: "flex-end", paddingBottom: "28px" }}>
        <div onPointerDown={onLayerGrab} style={{ position: "relative", border: "1.5px dashed rgba(255,255,255,.85)", borderRadius: "14px", padding: "16px", ...layerStyle }}>
          <span style={{ position: "absolute", left: "-6px", top: "-6px", width: "12px", height: "12px", borderRadius: "999px", background: "#fff" }}></span><span style={{ position: "absolute", right: "-6px", top: "-6px", width: "12px", height: "12px", borderRadius: "999px", background: "#fff" }}></span><span style={{ position: "absolute", left: "-6px", bottom: "-6px", width: "12px", height: "12px", borderRadius: "999px", background: "#fff" }}></span><span style={{ position: "absolute", right: "-6px", bottom: "-6px", width: "12px", height: "12px", borderRadius: "999px", background: "#fff" }}></span>
          <textarea value={storyBodyValue} onChange={onStoryBodyChange} placeholder="Épicerie Wax et Saveurs : attiéké frais le samedi matin." maxLength={bodyMax} aria-label="Le texte de votre story" rows={2} style={{ width: "100%", boxSizing: "border-box", border: "none", background: "transparent", fontFamily: "inherit", color: "inherit", outline: "none", resize: "none", display: "block", padding: "0", margin: "0", fontSize: "26px", fontWeight: "800", lineHeight: "1.2", letterSpacing: "-0.5px", ...bodyStyle }} />
        </div>
      </div>
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "flex-end" }}><button type="button" onClick={onContinue} aria-label="Suivant" style={{ border: "none", padding: "0", font: "inherit", color: "inherit", cursor: "pointer", textAlign: "inherit", width: "58px", height: "58px", borderRadius: "999px", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></button></div>
    
      </main>
      </div>
    </>
  );
}
