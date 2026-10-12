// GÉNÉRÉ depuis docs/template/07 Agenda.dc.html, section E01, cadre 1440 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 1440 px, ce qui ne
// serait pas responsive.
import { CadreCliquable } from '@/components/cadre-cliquable';
import type { CarteEvenement } from '../agenda/data';

export function CarteEvenementDesktop({ ev }: { readonly ev: CarteEvenement }) {
  return (
    <>
<CadreCliquable vers={ev.href ?? null} style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "16px", flexShrink: "0" }}><div style={{ display: "flex", gap: "14px", alignItems: "center" }}><div style={{ width: "60px", height: "60px", borderRadius: "18px", background: ev.fondDate, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: "0" }}><span style={{ fontSize: "10px", fontWeight: "800", color: "#B4581F" }}>{ev.numero}</span><span style={{ fontSize: "21px", fontWeight: "800", lineHeight: "1", color: "#16211D" }}>{ev.abbr}</span></div><div style={{ flex: "1", minWidth: "0" }}><div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>{ev.jyVais ? (<><span style={{ background: "#E0733A", color: "#fff", fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "999px", whiteSpace: "nowrap" }}>Vous y allez</span></>) : null}<span style={{ background: "#F2F5F4", color: "#5D6B66", fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "999px", whiteSpace: "nowrap" }}>{ev.type}</span>{ev.reseau ? (<><span style={{ background: "#E3F0EB", color: "#0F5C48", fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "999px", whiteSpace: "nowrap" }}>{ev.reseau}</span></>) : null}</div><div style={{ fontSize: "15.5px", fontWeight: "700", marginTop: "6px" }}>{ev.titre}</div><div style={{ fontSize: "12.5px", color: "#5D6B66", marginTop: "2px" }}>{ev.lieu} · {ev.heure} · {ev.participants} participant{ev.pluriel}</div></div><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg></div></CadreCliquable>
    </>
  );
}
