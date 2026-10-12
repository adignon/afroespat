// GÉNÉRÉ depuis docs/template/04 Parcours.dc.html, section J11, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import { CadreCliquable } from '@/components/cadre-cliquable';
import type { CarteParcours } from '../parcours/data';

export function CarteParcoursMobile({ p }: { readonly p: CarteParcours }) {
  return (
    <>
<CadreCliquable vers={p.href ?? null} style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "20px", padding: "14px", flexShrink: "0" }}><div style={{ display: "flex", gap: "6px", alignItems: "center" }}><div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: "1px", color: "#16785E" }}>PARCOURS {p.type}</div>{p.actif ? (<><span style={{ background: "#E3F0EB", color: "#0F5C48", fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "999px", whiteSpace: "nowrap" }}>Actif</span></>) : null}{p.enPause ? (<><span style={{ background: "#F2F5F4", color: "#5D6B66", fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "999px", whiteSpace: "nowrap" }}>En pause</span></>) : null}</div><div style={{ display: "flex", alignItems: "baseline", marginTop: "6px" }}><span style={{ flex: "1", fontSize: "16px", fontWeight: "700" }}>{p.titre}</span><span style={{ fontSize: "18px", fontWeight: "800" }}>{p.pourcent}</span></div><div style={{ marginTop: "10px" }}><div style={{ height: "7px", borderRadius: "999px", background: "#EEF2F0", overflow: "hidden" }}><div style={{ width: p.barre, height: "100%", background: p.teinte, borderRadius: "999px" }}></div></div></div><div style={{ fontSize: "11.5px", color: "#8A958F", marginTop: "8px" }}>{p.sousTitreCourt}</div></CadreCliquable>
    </>
  );
}
