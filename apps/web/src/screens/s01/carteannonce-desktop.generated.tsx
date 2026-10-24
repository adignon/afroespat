// GÉNÉRÉ depuis docs/template/06 Services.dc.html, section S01, cadre 1440 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 1440 px, ce qui ne
// serait pas responsive.
import { CadreCliquable } from '@/components/cadre-cliquable';
import { Signet } from '@/components/entraide/signet';
import { SignetSujet } from '@/components/services/signet-sujet';
import type { CarteAnnonce } from './data';

export function CarteAnnonceDesktop({ a }: { readonly a: CarteAnnonce }) {
  return (
    <>
<CadreCliquable vers={a.href ?? null} style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "10px" }}><div style={{ position: "relative" }}><div style={{ height: "150px", borderRadius: "16px", background: a.fondPhoto, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11.5px", fontWeight: "600", color: "#7C8C85", position: "relative" }}></div><span style={{ position: "absolute", top: "10px", left: "10px", background: "rgba(255,255,255,.92)", color: "#0F5C48", fontSize: "11px", fontWeight: "700", padding: "5px 11px", borderRadius: "999px" }}>{a.genre}</span><span style={{ position: "absolute", top: "8px", right: "8px", width: "34px", height: "34px", borderRadius: "999px", background: "rgba(255,255,255,.92)", display: "flex", alignItems: "center", justifyContent: "center" }}><SignetSujet type="HOUSING" id={a.id} /></span></div><div style={{ padding: "12px 8px 6px" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8px" }}><span style={{ fontSize: "14.5px", fontWeight: "700", minWidth: "0" }}>{a.titre}</span><span style={{ fontSize: "16px", fontWeight: "800", color: "#0F5C48", whiteSpace: "nowrap" }}>{a.prix}</span></div><div style={{ fontSize: "12px", color: "#5D6B66", marginTop: "4px" }}>{a.detail}</div><div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #F0F3F2", fontSize: "12px" }}><span style={{ width: "24px", height: "24px", borderRadius: "999px", background: a.fond, color: "#fff", fontSize: "8px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>{a.initiales}</span>{a.auteur}<svg width="12" height="12" viewBox="0 0 24 24" fill="#16785E"><circle cx="12" cy="12" r="10" /><path d="m8 12 3 3 5-6" stroke="#fff" strokeWidth="2.2" fill="none" /></svg><span style={{ background: "#E3F0EB", color: "#0F5C48", fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "999px", whiteSpace: "nowrap" }}>{a.niveau}</span></div></div></CadreCliquable>
    </>
  );
}
