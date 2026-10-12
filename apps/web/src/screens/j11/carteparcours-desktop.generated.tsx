// GÉNÉRÉ depuis docs/template/04 Parcours.dc.html, section J11, cadre 1440 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 1440 px, ce qui ne
// serait pas responsive.
import { CadreCliquable } from '@/components/cadre-cliquable';
import type { CarteParcours } from '../parcours/data';

export function CarteParcoursDesktop({ p }: { readonly p: CarteParcours }) {
  return (
    <>
<CadreCliquable vers={p.href ?? null} style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "18px" }}><div style={{ display: "flex", alignItems: "center", gap: "12px" }}><div style={{ flex: "1", minWidth: "0" }}><div style={{ display: "flex", gap: "6px", alignItems: "center" }}><div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: "1px", color: "#16785E" }}>PARCOURS {p.type}</div>{p.actif ? (<><span style={{ background: "#E3F0EB", color: "#0F5C48", fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "999px", whiteSpace: "nowrap" }}>Actif</span></>) : null}{p.enPause ? (<><span style={{ background: "#F2F5F4", color: "#5D6B66", fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "999px", whiteSpace: "nowrap" }}>En pause</span></>) : null}</div><div style={{ fontSize: "17px", fontWeight: "700", marginTop: "6px" }}>{p.titre}</div><div style={{ fontSize: "12.5px", color: "#8A958F", marginTop: "2px" }}>{p.sousTitre}</div></div><span style={{ fontSize: "22px", fontWeight: "800" }}>{p.pourcent}</span></div><div style={{ marginTop: "12px" }}><div style={{ height: "8px", borderRadius: "999px", background: "#EEF2F0", overflow: "hidden" }}><div style={{ width: p.barre, height: "100%", background: p.teinte, borderRadius: "999px" }}></div></div></div></CadreCliquable>
    </>
  );
}
