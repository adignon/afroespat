// GÉNÉRÉ depuis docs/template/03 Accueil v2.dc.html, section A01G, cadre 1440 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 1440 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import type { A01GData } from './data';

export function A01GDesktop(props: A01GData) {
  const { guideRecherche, guidesSuggeres, guidesTrouves, lierBloque, onAnnulerGuides, onGuideRecherche, onLierGuides } = props;

  return (
    <>

      
      <div style={{ position: "fixed", inset: "0", background: "rgba(22,33,29,.55)" }} data-modal-overlay=""></div>
      <div style={{ position: "fixed", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: "560px", background: "#fff", borderRadius: "28px", padding: "24px", display: "flex", flexDirection: "column", gap: "12px", maxHeight: "calc(100vh - 48px)", overflow: "hidden" }} data-modal-panel="">
        <div style={{ display: "flex", alignItems: "center" }}><div style={{ flex: "1" }}><h2 id="a01g-titre" style={{ margin: "0", fontSize: "20px", fontWeight: "800", letterSpacing: "-0.5px" }}>Lier un guide</h2><div style={{ fontSize: "12.5px", color: "#5D6B66", marginTop: "2px" }}>Aidez les lecteurs à aller plus loin. 3 guides maximum.</div></div><button type="button" aria-label="Fermer" data-modal-close="" style={{ width: "40px", height: "40px", borderRadius: "999px", background: "#F2F5F4", display: "flex", alignItems: "center", justifyContent: "center", border: "none", padding: "0", font: "inherit", cursor: "pointer" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button></div>
          <div data-fenetre-contenu="" style={{ flex: "1", minHeight: "0", overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px" }}><div style={{ height: "44px", borderRadius: "999px", background: "#F2F5F4", padding: "0 16px", display: "flex", alignItems: "center", gap: "10px", fontSize: "13.5px", color: "#16211D", flexShrink: "0" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A958F" strokeWidth="1.7" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg><input type="search" value={guideRecherche} onChange={onGuideRecherche} placeholder="Rechercher un guide" aria-label="Rechercher un guide" data-guide-recherche="" style={{ flex: "1", minWidth: "0", border: "none", background: "transparent", font: "inherit", fontSize: "13.5px", color: "#16211D", outline: "none", padding: 0 }} /></div>
          <div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F" }}>SUGGÉRÉS POUR VOTRE PUBLICATION</div>
          {(guidesSuggeres ?? []).map((g, gIndex) => (
<Fragment key={gIndex}><div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "16px", background: "#EFF7F3", border: "1.5px solid #16785E" }}><span style={{ width: "36px", height: "36px", borderRadius: "12px", background: "#E3F0EB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F5C48" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></svg></span><span style={{ flex: "1", minWidth: "0" }}><span style={{ display: "block", fontSize: "13.5px", fontWeight: "700", lineHeight: "1.3" }}>{g.titre}</span><span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "#8A958F", marginTop: "2px" }}>{g.meta}<span style={{ background: "#FBE3D4", color: "#B4581F", fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "999px" }}>Suggéré</span></span></span><span style={{ width: "24px", height: "24px", borderRadius: "7px", background: "#16785E", border: "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="m5 12 4.5 4.5L19 7" /></svg></span></div></Fragment>
))}
          <div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F", marginTop: "4px" }}>RÉSULTATS</div>
          {(guidesTrouves ?? []).map((g, gIndex) => (
<Fragment key={gIndex}><button type="button" onClick={g.onPick} aria-pressed={g.choisi === true} data-guide-choix={g.guideId} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "16px", background: g.choisi === true ? "#E3F0EB" : "#fff", border: g.choisi === true ? "1.5px solid #16785E" : "1px solid #E6EBE9", fontFamily: "inherit", color: "inherit", cursor: "pointer" }}><span style={{ width: "36px", height: "36px", borderRadius: "12px", background: "#E3F0EB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F5C48" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></svg></span><span style={{ flex: "1", minWidth: "0" }}><span style={{ display: "block", fontSize: "13.5px", fontWeight: "700", lineHeight: "1.3" }}>{g.titre}</span><span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "#8A958F", marginTop: "2px" }}>{g.meta}</span></span><span style={{ width: "24px", height: "24px", borderRadius: "7px", background: "#fff", border: "1.5px solid #CBD5D1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}></span></button></Fragment>
))}
        </div><div style={{ display: "flex", gap: "8px", marginTop: "6px" }}><button type="button" onClick={onAnnulerGuides} style={{ height: "50px", padding: "0 20px", borderRadius: "14px", background: "#F2F5F4", border: "none", font: "inherit", fontSize: "14.5px", fontWeight: "700", cursor: "pointer" }}>Annuler</button><button type="button" onClick={onLierGuides} disabled={lierBloque} data-guide-lier="" style={{ flex: "1", height: "50px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "14.5px", fontWeight: "700", cursor: "pointer", opacity: lierBloque ? ".55" : "1" }}>Lier 2 guides</button></div>
      </div>
    
    </>
  );
}
