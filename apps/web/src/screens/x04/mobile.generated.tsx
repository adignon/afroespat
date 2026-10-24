// GÉNÉRÉ depuis docs/template/09 Messages et transverse.dc.html, section X04, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import { FVal } from '@/components/parcours/feuille-dessinee';
import { FAct } from '@/components/parcours/feuille-dessinee';
import type { X04Data } from '../x04/data';

export function X04Mobile(_props: X04Data) {
  return (
    <>

      <main style={{ display: "contents" }}>
<div style={{ background: "#E3F0EB", borderRadius: "22px", padding: "20px", display: "flex", gap: "14px", width: "auto" }}><span style={{ width: "44px", height: "44px", borderRadius: "14px", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F5C48" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 4 6v6c0 4.5 3.5 8 8 9 4.5-1 8-4.5 8-9V6z" /></svg></span><div style={{ flex: "1" }}><div style={{ fontSize: "15.5px", fontWeight: "700", color: "#0F5C48" }}><FVal k="titre" tag="span" /></div><div style={{ fontSize: "13px", lineHeight: "1.55", marginTop: "4px" }}><FVal k="texte" tag="span" /></div><div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "12px" }}><FAct k="monter" style={{ padding: "0 18px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "13.5px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", whiteSpace: "nowrap", flexShrink: "0", height: "40px" }}>Vérifier mon identité</FAct><a href="/compte/verification" style={{ fontSize: "13px", fontWeight: "700" }}>Voir les niveaux</a></div></div></div>
      </main>
    </>
  );
}
