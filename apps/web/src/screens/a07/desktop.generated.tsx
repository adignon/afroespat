// GÉNÉRÉ depuis docs/template/03 Accueil v2.dc.html, section A07, cadre 1440 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 1440 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import { BoutonCreer, LienMessages, LienNotifications } from '@/components/barre-haute/controles';
import { PastilleMembre, CarteMembre } from '@/components/barre-haute/membre';
import { RailSurvol } from '@/components/rail/survol';
import { CarteMonParcours } from '@/components/carte-mon-parcours';
import type { A07Data } from './data';

export function A07Desktop(props: A07Data) {
  const { discover, myNets, netFilters, onRejoindre, panelReseaux, rail, seuil, shortcuts } = props;

  return (
    <>
      <main style={{ display: "contents" }}>

    <div style={{ width: "400px", flexShrink: "0", display: "flex", flexDirection: "column", padding: "0 24px", position: "sticky", top: "0", alignSelf: "flex-start", maxHeight: "100vh", overflowY: "auto" }}>
      <div style={{ height: "64px", display: "flex", alignItems: "center", gap: "10px", flexShrink: "0" }}><div style={{ width: "38px", height: "38px", borderRadius: "12px", background: "#0F5C48", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><circle cx="16.5" cy="7.5" r="1.6" fill="#E0733A" stroke="none" /></svg></div><span style={{ fontSize: "21px", fontWeight: "800", color: "#0F5C48", letterSpacing: "-0.5px" }}>Diaspora</span></div>
      <div style={{ display: "flex", gap: "12px", paddingTop: "12px", minHeight: "0" }}>
        <RailSurvol style={{ width: "76px", background: "#0F5C48", borderRadius: "22px", padding: "12px 8px", display: "flex", flexDirection: "column", gap: "4px", flexShrink: "0", alignSelf: "stretch" }}>{(rail ?? []).map((r, rIndex) => (
<Fragment key={rIndex}><a href={r.href} style={{ height: "58px", borderRadius: "16px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "5px", fontSize: "9.5px", fontWeight: "700", background: r.bg, color: r.fg }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={r.icon} /></svg>{r.label}</a></Fragment>
))}<div style={{ flex: "1", minHeight: "12px" }}></div><a href="#" style={{ height: "48px", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", color: "#CFE3DA" }} aria-label="Réglages"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M4 7h8M17 7h3M4 17h3M12 17h8" /><circle cx="15" cy="7" r="2.2" /><circle cx="9.5" cy="17" r="2.2" /></svg></a></RailSurvol>
        <div style={{ flex: "1", minWidth: "0", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "14px", display: "flex", alignItems: "center", gap: "11px" }}><CarteMembre styleAvatar={{ width: "44px", height: "44px", borderRadius: "999px", background: "#B4581F", color: "#fff", fontSize: "13px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }} styleNom={{ display: "block", fontWeight: "700", fontSize: "14px", letterSpacing: "-0.2px" }} styleLien={{ display: "block", fontSize: "12px", color: "#5D6B66" }} libelle="Voir mon profil public" /></div>
          <CarteMonParcours />
          <div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "14px" }}>
            <div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F", padding: "0 6px 8px" }}>COMMUNAUTÉ</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>{(panelReseaux ?? []).map((m, mIndex) => (
<Fragment key={mIndex}><a href={m.href} style={{ height: "44px", display: "flex", alignItems: "center", gap: "11px", padding: "0 12px", borderRadius: "14px", background: m.bg, color: m.fg, fontWeight: m.w, fontSize: "13.5px" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={m.icon} /></svg><span style={{ flex: "1", minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.label}</span>{m.count ? (<><span style={{ background: "#E0733A", color: "#fff", fontSize: "11px", fontWeight: "700", minWidth: "22px", height: "22px", padding: "0 7px", borderRadius: "999px", display: "flex", alignItems: "center", justifyContent: "center" }}>{m.count}</span></>) : null}</a></Fragment>
))}</div>
          </div>
          <div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 6px 8px" }}><span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F" }}>VOS RACCOURCIS</span><a href="#" style={{ fontSize: "12px", fontWeight: "700" }}>Modifier</a></div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>{(shortcuts ?? []).map((s, sIndex) => (
<Fragment key={sIndex}><a href="#" style={{ height: "50px", display: "flex", alignItems: "center", gap: "11px", padding: "0 8px", borderRadius: "14px", color: "#16211D" }}><span style={{ width: "32px", height: "32px", borderRadius: "10px", background: s.bg, color: "#fff", fontSize: "10px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>{s.i}</span><span style={{ minWidth: "0" }}><span style={{ display: "block", fontSize: "12.5px", fontWeight: "700", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</span><span style={{ display: "block", fontSize: "11px", color: "#8A958F" }}>{s.sub}</span></span></a></Fragment>
))}</div>
          </div>
        </div>
      </div>
    </div>
    <div style={{ flex: "1", minWidth: "0", display: "flex", flexDirection: "column", paddingRight: "24px" }}>
      <div style={{ height: "64px", display: "flex", alignItems: "center", gap: "8px", flexShrink: "0", position: "sticky", top: "0", zIndex: 20, background: "#F6F8F7" }}><div style={{ flex: "1", maxWidth: "420px", height: "44px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", gap: "10px", padding: "0 18px", color: "#8A958F", fontSize: "13.5px" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg><span style={{ flex: "1", minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Rechercher dans la diaspora</span></div><span style={{ flex: "1" }}></span><BoutonCreer style={{ width: "44px", height: "44px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.7" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></BoutonCreer><LienMessages forme="point" style={{ position: "relative", width: "44px", height: "44px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.7" strokeLinejoin="round"><path d="M4 5h16v11H9l-5 4z" /></svg></LienMessages><LienNotifications forme="nombre" style={{ position: "relative", width: "44px", height: "44px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg></LienNotifications><PastilleMembre styleBoite={{ height: "44px", padding: "3px 16px 3px 3px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", gap: "9px", marginLeft: "4px" }} styleAvatar={{ width: "38px", height: "38px", borderRadius: "999px", background: "#B4581F", color: "#fff", fontSize: "12px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }} styleNom={{ fontSize: "13.5px", fontWeight: "600" }} /></div>
      <div style={{ flex: "1", padding: "12px 0 24px", display: "flex", flexDirection: "column", gap: "16px", maxWidth: "1036px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}><h1 style={{ margin: "0", fontSize: "28px", fontWeight: "800", letterSpacing: "-0.9px" }}>Réseaux</h1><a href="/reseaux/nouveau" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none", height: "44px", padding: "0 18px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "14px", fontWeight: "700" }}>Créer un réseau d'intérêt</a></div>
        <div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F", marginTop: "6px" }}>MES RÉSEAUX</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px" }}>{(myNets ?? []).map((n, nIndex) => (
<Fragment key={nIndex}><a href={n.href} style={{ display: "contents", color: "inherit", textDecoration: "none" }}><div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "20px", padding: "16px" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><span style={{ width: "44px", height: "44px", borderRadius: "14px", background: n.bg, color: "#fff", fontSize: "13px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center" }}>{n.i}</span>{n.muted ? (<><span style={{ fontSize: "11px", fontWeight: "700", color: "#8A958F", background: "#F2F5F4", padding: "4px 9px", borderRadius: "999px" }}>En sourdine</span></>) : null}</div><div style={{ fontSize: "14.5px", fontWeight: "700", marginTop: "12px", letterSpacing: "-0.2px" }}>{n.name}</div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}><span style={{ fontSize: "12px", color: "#8A958F" }}>{n.members}</span>{n.unread ? (<><span style={{ fontSize: "11px", fontWeight: "700", color: "#fff", background: "#16785E", padding: "3px 9px", borderRadius: "999px" }}>{n.unread} nouveaux</span></>) : null}</div></div></a></Fragment>
))}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "10px" }}><span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F" }}>DÉCOUVRIR</span><div style={{ display: "flex", gap: "6px" }}>{(netFilters ?? []).map((f, fIndex) => (
<Fragment key={fIndex}><span style={{ padding: "8px 14px", borderRadius: "999px", fontSize: "12.5px", fontWeight: "600", background: f.bg, color: f.fg, border: `1px solid ${f.bd}` }}>{f.label}</span></Fragment>
))}</div></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "14px" }}>{(discover ?? []).map((d, dIndex) => (
<Fragment key={dIndex}><div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "10px" }}><div style={{ height: "110px", borderRadius: "16px", background: d.cover }}></div><div style={{ padding: "14px 8px 8px" }}><div style={{ display: "flex", gap: "6px" }}><span style={{ background: "#F2F5F4", color: "#5D6B66", fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "999px" }}>{d.cat}</span></div><div style={{ fontSize: "15px", fontWeight: "700", marginTop: "10px", letterSpacing: "-0.2px" }}><a href={d.href} style={{ color: "inherit", textDecoration: "none" }}>{d.name}</a></div><div style={{ fontSize: "12.5px", color: "#5D6B66", marginTop: "4px", lineHeight: "1.5" }}>{d.desc}</div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px" }}><span style={{ fontSize: "12px", color: "#8A958F" }}>{d.members}</span><button type="button" onClick={() => onRejoindre(d.slug, d.joined)} style={{ height: "38px", padding: "0 16px", borderRadius: "999px", background: d.btnBg, color: d.btnFg, border: "none", font: "inherit", fontSize: "12.5px", fontWeight: "700", cursor: "pointer" }}>{d.cta}</button></div></div></div></Fragment>
))}</div>
        {seuil === null ? null : (<div style={{ background: "#F2F5F4", borderRadius: "18px", padding: "14px 18px", fontSize: "13px", color: "#5D6B66" }} data-reseaux-seuil="">{seuil}</div>)}
      </div>
    </div>
  
      </main>
    </>
  );
}
