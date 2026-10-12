// GÉNÉRÉ depuis docs/template/03 Accueil v2.dc.html, section MOB, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import { CadreCliquable } from '@/components/cadre-cliquable';
import type { GuideCardView } from './data';

export function CarteGuideMobile({ g }: { readonly g: GuideCardView }) {
  return (
    <>
<CadreCliquable vers={g.href ?? null} style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "20px", padding: "14px", flexShrink: "0" }}>{g.verify ? (<><div style={{ background: "#FDF1D8", color: "#8A5A0B", fontSize: "11.5px", fontWeight: "700", padding: "7px 10px", borderRadius: "10px", marginBottom: "10px" }}>À vérifier</div></>) : null}<div style={{ fontSize: "15px", fontWeight: "700", letterSpacing: "-0.2px" }}>{g.title}</div><span style={{ display: "inline-block", marginTop: "8px", fontSize: "12.5px", fontWeight: "700", color: "#0F5C48", background: "#E3F0EB", padding: "4px 10px", borderRadius: "999px" }}>{g.updated}</span><div style={{ display: "flex", gap: "6px", marginTop: "8px" }}><span style={{ background: "#F2F5F4", color: "#5D6B66", fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "999px", whiteSpace: "nowrap" }}>{g.cat}</span><span style={{ background: "#F2F5F4", color: "#5D6B66", fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "999px", whiteSpace: "nowrap" }}>{g.scope}</span></div><p style={{ margin: "10px 0 0", fontSize: "13px", lineHeight: "1.55", color: "#5D6B66", display: "-webkit-box", WebkitLineClamp: "2", WebkitBoxOrient: "vertical", overflow: "hidden" }}>{g.excerpt}</p><div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "10px", fontSize: "12px", color: "#5D6B66" }}><span style={{ width: "22px", height: "22px", borderRadius: "999px", background: g.bg, color: "#fff", fontSize: "7px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>{g.i}</span>{g.author}<svg width="12" height="12" viewBox="0 0 24 24" fill="#16785E"><circle cx="12" cy="12" r="10" /><path d="m8 12 3 3 5-6" stroke="#fff" strokeWidth="2.2" fill="none" /></svg><span style={{ flex: "1" }}></span><strong style={{ color: "#16211D" }}>{g.useful}</strong>&nbsp;utiles</div></CadreCliquable>
    </>
  );
}
