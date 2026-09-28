// GÉNÉRÉ depuis docs/template/03 Accueil v2.dc.html, section MOB2, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import type { AccueilData } from '../accueil/data';

export function A08TAdminAnnonceMobile(_props: AccueilData) {
  return (
    <>
      <main style={{ display: "contents" }}>
<div style={{ position: "absolute", inset: "0", background: "rgba(22,33,29,.5)" }}></div><div style={{ position: "absolute", left: "0", right: "0", bottom: "0", background: "#fff", borderRadius: "28px 28px 0 0", padding: "10px 16px 28px", display: "flex", flexDirection: "column", gap: "12px" }}><span style={{ alignSelf: "center", width: "40px", height: "5px", borderRadius: "999px", background: "#DDE3E0" }}></span><h1 style={{ margin: "0", fontSize: "18px", fontWeight: "800" }}>Nouvelle annonce</h1><div style={{ height: "46px", borderRadius: "14px", border: "1.5px solid #16785E", padding: "0 14px", display: "flex", alignItems: "center", fontSize: "14px", fontWeight: "700" }}>Permanence consulaire le 14 mars</div><div style={{ minHeight: "86px", borderRadius: "14px", border: "1px solid #E6EBE9", padding: "12px 14px", fontSize: "13.5px", lineHeight: "1.5" }}>Inscription obligatoire avant le 7 mars.</div><div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 0" }}><span style={{ flex: "1", fontSize: "13.5px", fontWeight: "700" }}>Épingler en haut du fil</span><span style={{ width: "46px", height: "26px", borderRadius: "999px", background: "#16785E", position: "relative" }}><span style={{ position: "absolute", top: "3px", left: "23px", width: "20px", height: "20px", borderRadius: "999px", background: "#fff" }}></span></span></div><div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 0" }}><span style={{ flex: "1", fontSize: "13.5px", fontWeight: "700" }}>Notifier les 890 membres</span><span style={{ width: "46px", height: "26px", borderRadius: "999px", background: "#16785E", position: "relative" }}><span style={{ position: "absolute", top: "3px", left: "23px", width: "20px", height: "20px", borderRadius: "999px", background: "#fff" }}></span></span></div><button style={{ padding: "0 14px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "13.5px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", flexShrink: "0", width: "100%", height: "50px" }}>Publier l’annonce</button></div>
      </main>
    </>
  );
}
