// GÉNÉRÉ depuis docs/template/06 Services.dc.html, section S02, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import type { S02Data } from '../s02/data';

export function S02MobileVerification(props: S02Data) {
  const { annonce } = props;

  return (
    <>
<div style={{ position: "fixed", inset: "0", background: "rgba(22,33,29,.55)" }} data-modal-overlay=""></div><div style={{ position: "fixed", left: "0", right: "0", bottom: "0", height: "auto", background: "#fff", borderRadius: "28px 28px 0 0", padding: "10px 16px 28px", display: "flex", flexDirection: "column", gap: "14px", maxHeight: "calc(100vh - 24px)", overflowY: "auto" }} data-modal-panel=""><button type="button" aria-label="Fermer" data-modal-close="" style={{ alignSelf: "center", width: "40px", height: "5px", borderRadius: "999px", background: "#DDE3E0", border: "none", padding: "10px 24px", font: "inherit", cursor: "pointer", boxSizing: "content-box", marginTop: "0", backgroundClip: "content-box" }}></button><h2 id="s02-titre" style={{ margin: "0", fontSize: "18px", fontWeight: "800" }}>Contacter {annonce.prenomAuteur}</h2><div style={{ background: "#E3F0EB", borderRadius: "18px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}><div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}><span style={{ width: "36px", height: "36px", borderRadius: "12px", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0F5C48" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 4 6v6c0 4.5 3.5 8 8 9 4.5-1 8-4.5 8-9V6z" /></svg></span><div style={{ fontSize: "13.5px", lineHeight: "1.5" }}><strong style={{ color: "#0F5C48" }}>Contacter demande une identité vérifiée.</strong> La vérification prend deux minutes et rassure la personne qui loue.</div></div><button style={{ padding: "0 18px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "13.5px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", whiteSpace: "nowrap", flexShrink: "0", width: "100%", height: "42px" }}>Vérifier mon identité</button><a href="#" style={{ fontSize: "12.5px", fontWeight: "700", textAlign: "center" }}>Ou demandez à un parrain de visiter pour vous</a></div></div>
    </>
  );
}
