// GÉNÉRÉ depuis docs/template/08 Compte.dc.html, section K06, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import type { K06Data } from '../compte/data';

export function K06Mobile(props: K06Data) {
  const { premium } = props;

  return (
    <>
      <main style={{ display: "contents" }}>
<div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 16px) 16px 0", display: "flex", alignItems: "center", gap: "8px", flexShrink: "0" }}><h1 style={{ margin: "0", fontSize: "21px", fontWeight: "800", letterSpacing: "-0.6px", flex: "1" }}>Premium</h1></div><div style={{ flexGrow: "1", overflow: "visible", padding: "12px 16px", display: "flex", flexDirection: "column", gap: "12px" }}><div style={{ padding: "20px", borderRadius: "22px", background: "#0F5C48", color: "#fff", border: "none", display: "flex", flexDirection: "column", gap: "10px" }}><div style={{ display: "flex", alignItems: "center", gap: "8px" }}><span style={{ fontSize: "17px", fontWeight: "800" }}>Premium</span><span style={{ background: "#E0733A", color: "#fff", fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "999px", whiteSpace: "nowrap" }}>PREMIUM</span></div><div style={{ fontSize: "24px", fontWeight: "800" }}>{premium.prixMois}</div><div style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "13px" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7FD1B0" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4.5 4.5L19 7" /></svg>Parcours illimités</div><div style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "13px" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7FD1B0" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4.5 4.5L19 7" /></svg>Alertes</div><div style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "13px" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7FD1B0" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4.5 4.5L19 7" /></svg>Export PDF</div></div><div style={{ display: "flex", gap: "4px", background: "#EEF2F0", borderRadius: "14px", padding: "4px", flexShrink: "0", alignSelf: "flex-start" }}><span style={{ padding: "9px 16px", borderRadius: "11px", fontSize: "13px", fontWeight: "700", whiteSpace: "nowrap", background: "#fff" }}>Mensuel</span><span style={{ padding: "9px 16px", borderRadius: "11px", fontSize: "13px", fontWeight: "700", whiteSpace: "nowrap", color: "#5D6B66" }}>Annuel</span></div><div style={{ display: "flex", gap: "4px", background: "#EEF2F0", borderRadius: "14px", padding: "4px", flexShrink: "0", alignSelf: "flex-start" }}><span style={{ padding: "9px 16px", borderRadius: "11px", fontSize: "13px", fontWeight: "700", whiteSpace: "nowrap", color: "#5D6B66" }}>Carte</span><span style={{ padding: "9px 16px", borderRadius: "11px", fontSize: "13px", fontWeight: "700", whiteSpace: "nowrap", background: "#fff" }}>Mobile Money</span></div></div><div style={{ flexShrink: "0", background: "#fff", borderTop: "1px solid #E6EBE9", padding: "12px 16px 28px", display: "flex", gap: "8px" }}><button style={{ height: "44px", padding: "0 18px", borderRadius: "14px", background: "#E0733A", color: "#fff", border: "none", font: "inherit", fontSize: "13.5px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", whiteSpace: "nowrap", flexShrink: "0", flex: "1" }} data-modal-open="K06M">Passer à Premium</button></div>
      </main>
    </>
  );
}
