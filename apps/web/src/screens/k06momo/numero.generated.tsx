// GÉNÉRÉ depuis docs/template/08 Compte.dc.html, section K06, cadre 380 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 380 px, ce qui ne
// serait pas responsive.
import type { K06Data } from '../compte/data';

export function K06Numero(props: K06Data) {
  const { premium } = props;

  return (
    <>
<div style={{ position: "fixed", inset: "0", background: "rgba(22,33,29,.55)" }} data-modal-overlay=""></div><div style={{ position: "fixed", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: "380px", background: "#fff", border: "1px solid #DDE3E0", borderRadius: "28px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px", flexShrink: "0" }} data-modal-panel=""><div style={{ display: "flex", alignItems: "center" }}><div style={{ flex: "1" }}><div style={{ fontSize: "12px", fontWeight: "700", color: "#8A958F" }}>Étape 1 sur 3</div><h2 id="k06-titre" style={{ margin: "0", fontSize: "20px", fontWeight: "800", letterSpacing: "-0.5px" }}>Payer avec Mobile Money</h2></div><button type="button" aria-label="Fermer" data-modal-close="" style={{ width: "40px", height: "40px", borderRadius: "999px", background: "#F2F5F4", display: "flex", alignItems: "center", justifyContent: "center", border: "none", padding: "0", font: "inherit", cursor: "pointer" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button></div><div style={{ flexShrink: "0" }}><div style={{ fontSize: "12.5px", fontWeight: "700", marginBottom: "6px" }}>Numéro</div><div style={{ minHeight: "48px", borderRadius: "14px", border: "1.5px solid #16785E", background: "#fff", padding: "13px 14px", fontSize: "14px", lineHeight: "1.5" }}>+229 97 12 34 42</div></div><div><div style={{ fontSize: "12.5px", fontWeight: "700", marginBottom: "8px" }}>Opérateur</div><div style={{ display: "flex", gap: "4px", background: "#EEF2F0", borderRadius: "14px", padding: "4px", flexShrink: "0", alignSelf: "flex-start" }}><span style={{ padding: "9px 16px", borderRadius: "11px", fontSize: "13px", fontWeight: "700", whiteSpace: "nowrap", background: "#fff" }}>MTN</span><span style={{ padding: "9px 16px", borderRadius: "11px", fontSize: "13px", fontWeight: "700", whiteSpace: "nowrap", color: "#5D6B66" }}>Moov</span></div></div><button style={{ height: "44px", padding: "0 18px", borderRadius: "14px", background: "#E0733A", color: "#fff", border: "none", font: "inherit", fontSize: "13.5px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", whiteSpace: "nowrap", flexShrink: "0", width: "100%" }}>Payer {premium.montantXof}</button></div>
    </>
  );
}
