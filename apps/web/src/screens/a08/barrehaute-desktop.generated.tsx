// GÉNÉRÉ depuis docs/template/03 Accueil v2.dc.html, section A08, cadre 1440 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 1440 px, ce qui ne
// serait pas responsive.
import { BoutonCreer, LienMessages, LienNotifications } from '@/components/barre-haute/controles';
import { PastilleMembre } from '@/components/barre-haute/membre';

export function A08BarreHauteDesktop() {
  return (
    <>
<div style={{ height: "64px", display: "flex", alignItems: "center", gap: "8px", flexShrink: "0", position: "sticky", top: "0", zIndex: 20, background: "#F6F8F7" }}><div style={{ flex: "1", maxWidth: "420px", height: "44px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", gap: "10px", padding: "0 18px", color: "#8A958F", fontSize: "13.5px" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg><span style={{ flex: "1", minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Rechercher dans la diaspora</span></div><span style={{ flex: "1" }}></span><BoutonCreer style={{ width: "44px", height: "44px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.7" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></BoutonCreer><LienMessages forme="point" style={{ position: "relative", width: "44px", height: "44px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.7" strokeLinejoin="round"><path d="M4 5h16v11H9l-5 4z" /></svg></LienMessages><LienNotifications forme="nombre" style={{ position: "relative", width: "44px", height: "44px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg></LienNotifications><PastilleMembre styleBoite={{ height: "44px", padding: "3px 16px 3px 3px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", gap: "9px", marginLeft: "4px" }} styleAvatar={{ width: "38px", height: "38px", borderRadius: "999px", background: "#B4581F", color: "#fff", fontSize: "12px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }} styleNom={{ fontSize: "13.5px", fontWeight: "600" }} /></div>
    </>
  );
}
