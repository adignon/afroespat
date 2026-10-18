// GÉNÉRÉ depuis docs/template/10 Administration.dc.html, section D01, cadre 420 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 420 px, ce qui ne
// serait pas responsive.
import type { AdministrationData } from '../administration/data';

export function D01Identifiants(_props: AdministrationData) {
  return (
    <>
      <div style={{ width: "100%", maxWidth: "420px", background: "#fff", border: "1px solid #DDE3E0", borderRadius: "28px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px", flexShrink: "0" }}>

      <main style={{ display: "contents" }}>
<div style={{ display: "flex", alignItems: "center", gap: "10px" }}><div style={{ width: "38px", height: "38px", borderRadius: "12px", background: "#0F5C48", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><circle cx="16.5" cy="7.5" r="1.6" fill="#E0733A" stroke="none" /></svg></div><h1 style={{ margin: "0", fontSize: "17px", fontWeight: "800" }}>Administration</h1></div><div style={{ flexShrink: "0" }}><div style={{ fontSize: "12.5px", fontWeight: "700", marginBottom: "6px" }}>Email professionnel</div><div style={{ minHeight: "48px", borderRadius: "14px", border: "1.5px solid #16785E", background: "#fff", padding: "13px 14px", fontSize: "14px", lineHeight: "1.5" }}>r.adjovi@afroexpates.com</div></div><div style={{ flexShrink: "0" }}><div style={{ fontSize: "12.5px", fontWeight: "700", marginBottom: "6px" }}>Mot de passe</div><div style={{ minHeight: "48px", borderRadius: "14px", border: "1px solid #E6EBE9", background: "#fff", padding: "13px 14px", fontSize: "14px", lineHeight: "1.5" }}>••••••••••</div></div><button style={{ height: "44px", padding: "0 18px", borderRadius: "14px", background: "#16211D", color: "#fff", border: "none", font: "inherit", fontSize: "13.5px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", whiteSpace: "nowrap", flexShrink: "0", width: "100%" }}>Continuer</button>
      </main>
      </div>
    </>
  );
}
