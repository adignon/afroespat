// GÉNÉRÉ depuis docs/template/03 Accueil v2.dc.html, section A06, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import type { A06Data } from './data';

export function A06CorrigerMobile(_props: A06Data) {
  return (
    <>
      <main style={{ display: "contents" }}>

      <div style={{ padding: "56px 18px 0", opacity: ".6" }}><h1 style={{ margin: "0", fontSize: "22px", fontWeight: "800" }}>Obtenir la garantie Visale sans CDI</h1><p style={{ fontSize: "14.5px", lineHeight: "1.7" }}>Les étudiants de 18 à 30 ans y ont droit, <span style={{ background: "#CFE3DA" }}>quel que soit leur pays d'origine…</span></p></div>
      <div style={{ position: "absolute", inset: "0", background: "rgba(22,33,29,.5)" }}></div>
      <div style={{ position: "absolute", left: "0", right: "0", bottom: "0", height: "86%", background: "#fff", borderRadius: "28px 28px 0 0", padding: "10px 18px 26px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <span style={{ alignSelf: "center", width: "40px", height: "5px", borderRadius: "999px", background: "#DDE3E0" }}></span>
        <div style={{ fontSize: "18px", fontWeight: "800" }}>Proposer une correction</div>
          <div style={{ fontSize: "12.5px", fontWeight: "700" }}>Passage sélectionné</div>
          <div style={{ marginTop: "-8px", background: "#F2F5F4", borderRadius: "14px", padding: "14px", fontSize: "14px", lineHeight: "1.6", color: "#5D6B66" }}>quel que soit leur pays d'origine, dès l'obtention du VLS-TS</div>
          <div style={{ fontSize: "12.5px", fontWeight: "700" }}>Remplacer par</div>
          <div style={{ marginTop: "-8px", border: "1.5px solid #16785E", borderRadius: "14px", padding: "14px", fontSize: "14px", lineHeight: "1.6", minHeight: "76px" }}>quel que soit leur pays d'origine, dès la validation du VLS-TS sur le site de l'ANEF</div>
          <div style={{ fontSize: "12.5px", fontWeight: "700" }}>Pourquoi cette correction ? <span style={{ color: "#B4581F" }}>*</span></div>
          <div style={{ marginTop: "-8px", border: "1px solid #E6EBE9", borderRadius: "14px", padding: "14px", fontSize: "14px" }}>La validation en ligne est obligatoire depuis 2025.</div>
          <div style={{ fontSize: "12.5px", fontWeight: "700" }}>Source <span style={{ color: "#8A958F", fontWeight: "500" }}>(facultatif)</span></div>
          <div style={{ marginTop: "-8px", height: "46px", border: "1px solid #E6EBE9", borderRadius: "14px", padding: "0 14px", display: "flex", alignItems: "center", fontSize: "13.5px", color: "#8A958F" }}>https://</div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", background: "#F3F7F5", borderRadius: "14px", padding: "12px 14px", fontSize: "12.5px", color: "#0F5C48", fontWeight: "600" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>L'auteur a 14 jours pour répondre. Sans réponse, la modération tranche.</div>
        <div style={{ flex: "1" }}></div>
        <button style={{ height: "52px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "15px", fontWeight: "700" }}>Envoyer</button>
      </div>
    
      </main>
    </>
  );
}
