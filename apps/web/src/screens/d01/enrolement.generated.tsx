// GÉNÉRÉ depuis docs/template/10 Administration.dc.html, section D01, cadre 420 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 420 px, ce qui ne
// serait pas responsive.
import type { AdministrationData } from '../administration/data';

export function D01Enrolement(_props: AdministrationData) {
  return (
    <>
      <div style={{ width: "100%", maxWidth: "420px", background: "#fff", border: "1px solid #DDE3E0", borderRadius: "28px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px", flexShrink: "0" }}>
      <main style={{ display: "contents" }}>
<div style={{ display: "flex", alignItems: "center", gap: "10px" }}><div style={{ width: "38px", height: "38px", borderRadius: "12px", background: "#0F5C48", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><circle cx="16.5" cy="7.5" r="1.6" fill="#E0733A" stroke="none" /></svg></div><span style={{ fontSize: "17px", fontWeight: "800" }}>Administration</span></div><h1 style={{ margin: "0", fontSize: "17px", fontWeight: "800" }}>Activer la double authentification</h1><div style={{ display: "flex", gap: "14px", alignItems: "center" }}><div style={{ width: "120px", height: "120px", borderRadius: "14px", background: "repeating-conic-gradient(#16211D 0 25%,#fff 0 50%) 0 0/16px 16px", flexShrink: "0" }}></div><div style={{ fontSize: "12.5px", color: "#5D6B66", lineHeight: "1.55" }}>Scannez avec votre application d'authentification, puis saisissez le code.</div></div><button style={{ height: "44px", padding: "0 18px", borderRadius: "14px", background: "#F2F5F4", color: "#16211D", border: "none", font: "inherit", fontSize: "13.5px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", whiteSpace: "nowrap", flexShrink: "0", width: "100%" }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>Télécharger les codes de secours</button>
      </main>
      </div>
    </>
  );
}
