// GÉNÉRÉ depuis docs/template/03 Accueil v2.dc.html, section A03, cadre 1440 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 1440 px, ce qui ne
// serait pas responsive.
import { CadreCliquable } from '@/components/cadre-cliquable';
import type { GuideCardView } from './data';

export function CarteGuideDesktop({ g }: { readonly g: GuideCardView }) {
  return (
    <>
<CadreCliquable vers={g.href ?? null} style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", overflow: "hidden" }}>
              {g.verify ? (<><div style={{ background: "#FDF1D8", color: "#8A5A0B", fontSize: "12.5px", fontWeight: "700", padding: "9px 20px", display: "flex", alignItems: "center", gap: "8px" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>À vérifier — des membres signalent que l'information a changé</div></>) : null}
              <div style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" }}><div style={{ fontSize: "16.5px", fontWeight: "700", letterSpacing: "-0.3px", minWidth: "0" }}>{g.title}</div><span style={{ fontSize: "13px", fontWeight: "700", color: "#0F5C48", background: "#E3F0EB", padding: "5px 11px", borderRadius: "999px", whiteSpace: "nowrap" }}>{g.updated}</span></div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "10px", flexWrap: "wrap" }}><span style={{ background: "#F2F5F4", color: "#5D6B66", fontSize: "11.5px", fontWeight: "700", padding: "4px 10px", borderRadius: "999px" }}>{g.cat}</span><span style={{ background: "#F2F5F4", color: "#5D6B66", fontSize: "11.5px", fontWeight: "700", padding: "4px 10px", borderRadius: "999px" }}>{g.scope}</span></div><p style={{ margin: "12px 0 0", fontSize: "14px", lineHeight: "1.6", color: "#5D6B66", display: "-webkit-box", WebkitLineClamp: "2", WebkitBoxOrient: "vertical", overflow: "hidden" }}>{g.excerpt}</p><a href={g.href} style={{ display: "inline-block", marginTop: "6px", fontSize: "13px", fontWeight: "700" }}>Lire le guide</a>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px", fontSize: "12.5px", color: "#5D6B66" }}><span style={{ display: "flex", alignItems: "center", gap: "8px" }}><span style={{ width: "26px", height: "26px", borderRadius: "999px", background: g.bg, color: "#fff", fontSize: "9.5px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}>{g.i}</span>{g.author}<svg width="13" height="13" viewBox="0 0 24 24" fill="#16785E"><circle cx="12" cy="12" r="10" /><path d="m8 12 3 3 5-6" stroke="#fff" strokeWidth="2.2" fill="none" /></svg></span><span><strong style={{ color: "#16211D" }}>{g.useful}</strong> ont trouvé utile</span></div>
              </div>
            </CadreCliquable>
    </>
  );
}
