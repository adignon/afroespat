// GÉNÉRÉ depuis docs/template/04 Parcours.dc.html, section J02, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import type { J02Data } from '../parcours/data';

export function J02MobilePlanAtteint(props: J02Data) {
  const { modeles } = props;

  return (
    <>
      <main style={{ display: "contents" }}>
<div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 12px) 12px 10px", display: "flex", alignItems: "center", gap: "8px", background: "#fff", borderBottom: "1px solid #E6EBE9", flexShrink: "0" }}><span style={{ width: "40px", height: "40px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg></span><h1 style={{ margin: "0", fontSize: "16px", fontWeight: "700", flex: "1", minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Créer un parcours</h1></div><div style={{ overflow: "visible", padding: "12px 16px", display: "flex", flexDirection: "column", gap: "12px" }}><div style={{ background: "#FBE3D4", borderRadius: "18px", padding: "16px", flexShrink: "0" }}><div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: "1px", color: "#B4581F" }}>PLAN ATTEINT</div><div style={{ fontSize: "15px", fontWeight: "700", marginTop: "8px" }}>Vous avez déjà un parcours actif</div><div style={{ fontSize: "12.5px", lineHeight: "1.5", marginTop: "4px" }}>Mettez-le en pause ou passez à Premium. Vous pouvez continuer à explorer.</div><button style={{ padding: "0 18px", borderRadius: "14px", background: "#E0733A", color: "#fff", border: "none", font: "inherit", fontSize: "13.5px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", whiteSpace: "nowrap", flexShrink: "0", width: "100%", marginTop: "12px", height: "42px" }}>Découvrir Premium</button></div>{(modeles ?? []).map((m, mIndex) => (
<Fragment key={mIndex}><div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "16px", padding: "14px", fontSize: "14px", fontWeight: "700", opacity: ".7" }}>{m.nom} · {m.etapes} étapes</div></Fragment>
))}</div>
      </main>
    </>
  );
}
