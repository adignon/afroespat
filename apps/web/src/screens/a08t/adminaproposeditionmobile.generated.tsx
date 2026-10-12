// GÉNÉRÉ depuis docs/template/03 Accueil v2.dc.html, section MOB2, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import { CartePublicationMobile } from '@/screens/a01/cartepublication-mobile.generated';
import type { A08TData } from './data';

export function A08TAdminAProposEditionMobile(props: A08TData) {
  const { publications } = props;

  return (
    <>
      <main style={{ display: "contents" }}>
<div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 12px) 12px 10px", display: "flex", alignItems: "center", gap: "8px", background: "#fff", borderBottom: "1px solid #E6EBE9", flexShrink: "0" }}><span style={{ width: "40px", height: "40px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg></span><h1 style={{ margin: "0", fontSize: "16px", fontWeight: "700", flex: "1" }}>Modifier « À propos »</h1><button style={{ padding: "0 14px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", flexShrink: "0", height: "38px", fontSize: "13px" }}>Enregistrer</button></div><div style={{ flexGrow: "1", overflow: "visible", padding: "12px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>{(publications ?? []).map((pub) => (<CartePublicationMobile key={pub.postId} p={pub} />))}</div>
      </main>
    </>
  );
}
