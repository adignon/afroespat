// GÉNÉRÉ depuis docs/template/10 Administration.dc.html, section D01, cadre 420 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 420 px, ce qui ne
// serait pas responsive.
import type { AdministrationData } from '../administration/data';

export function D01Totp(_props: AdministrationData) {
  return (
    <>
      <div style={{ width: "100%", maxWidth: "420px", background: "#fff", border: "1px solid #DDE3E0", borderRadius: "28px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px", flexShrink: "0" }}>
      <main style={{ display: "contents" }}>
<div style={{ display: "flex", alignItems: "center", gap: "10px" }}><div style={{ width: "38px", height: "38px", borderRadius: "12px", background: "#0F5C48", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><circle cx="16.5" cy="7.5" r="1.6" fill="#E0733A" stroke="none" /></svg></div><h1 style={{ margin: "0", fontSize: "17px", fontWeight: "800" }}>Administration</h1></div><div style={{ fontSize: "17px", fontWeight: "800" }}>Code de l'application</div><div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: "6px" }}><div style={{ height: "52px", borderRadius: "12px", border: "1.5px solid #E6EBE9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "21px", fontWeight: "800" }}>4</div><div style={{ height: "52px", borderRadius: "12px", border: "1.5px solid #E6EBE9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "21px", fontWeight: "800" }}>0</div><div style={{ height: "52px", borderRadius: "12px", border: "1.5px solid #E6EBE9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "21px", fontWeight: "800" }}>1</div><div style={{ height: "52px", borderRadius: "12px", border: "1.5px solid #16785E", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "21px", fontWeight: "800" }}></div><div style={{ height: "52px", borderRadius: "12px", border: "1.5px solid #E6EBE9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "21px", fontWeight: "800" }}></div><div style={{ height: "52px", borderRadius: "12px", border: "1.5px solid #E6EBE9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "21px", fontWeight: "800" }}></div></div><div style={{ fontSize: "12.5px", color: "#5D6B66" }}>Compte verrouillé après 5 échecs.</div>
      </main>
      </div>
    </>
  );
}
