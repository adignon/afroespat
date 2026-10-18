// GÉNÉRÉ depuis docs/template/03 Accueil v2.dc.html, section A12, cadre 1440 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 1440 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import Link from 'next/link';
import { BoutonCreer, ChampRecherche, LienMessages, LienNotifications } from '@/components/barre-haute/controles';
import { PastilleMembre, CarteMembre } from '@/components/barre-haute/membre';
import { RailSurvol } from '@/components/rail/survol';
import { CarteMonParcours } from '@/components/carte-mon-parcours';
import { RaccourcisReseaux } from '@/components/raccourcis-reseaux';
import type { AccueilData } from '../accueil/data';

export function A12Desktop(props: AccueilData) {
  const { arrivals, budgets, cityTabs, countryBars, events, panelVilles, rail } = props;

  return (
    <>
<header data-entete-globale="" style={{ position: "fixed", top: "0", left: "0", right: "0", height: "64px", zIndex: 30, background: "#F6F8F7", display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 560px) minmax(0, 1fr)", alignItems: "center", columnGap: "16px", padding: "0 24px" }}><div style={{ display: "flex", alignItems: "center", justifySelf: "start", minWidth: "0" }}><div style={{ height: "64px", display: "flex", alignItems: "center", gap: "10px", flexShrink: "0" }}><div style={{ width: "38px", height: "38px", borderRadius: "12px", background: "#0F5C48", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><circle cx="16.5" cy="7.5" r="1.6" fill="#E0733A" stroke="none" /></svg></div><span style={{ fontSize: "21px", fontWeight: "800", color: "#0F5C48", letterSpacing: "-0.5px" }}>Diaspora</span></div></div><div style={{ display: "flex", alignItems: "center", minWidth: "0" }}><ChampRecherche style={{ flex: "1", maxWidth: "none", width: "100%", height: "44px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", gap: "10px", padding: "0 18px", color: "#8A958F", fontSize: "13.5px" }} /></div><div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px", minWidth: "0" }}><BoutonCreer style={{ width: "44px", height: "44px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.7" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></BoutonCreer><LienMessages forme="point" style={{ position: "relative", width: "44px", height: "44px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.7" strokeLinejoin="round"><path d="M4 5h16v11H9l-5 4z" /></svg></LienMessages><LienNotifications forme="nombre" style={{ position: "relative", width: "44px", height: "44px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg></LienNotifications><PastilleMembre styleBoite={{ height: "44px", padding: "3px 16px 3px 3px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", gap: "9px", marginLeft: "4px" }} styleAvatar={{ width: "38px", height: "38px", borderRadius: "999px", background: "#B4581F", color: "#fff", fontSize: "12px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }} styleNom={{ fontSize: "13.5px", fontWeight: "600" }} /></div></header>

    <div data-zone="gauche" style={{ width: "400px", flexShrink: "0", display: "flex", flexDirection: "column", padding: "0 24px", position: "sticky", top: "0", alignSelf: "flex-start", maxHeight: "100vh", overflowY: "auto" }}>
      <div style={{ height: "64px", flexShrink: "0" }}></div>
      <div style={{ display: "flex", gap: "12px", paddingTop: "12px", minHeight: "0" }}>
        <RailSurvol style={{ width: "76px", background: "#0F5C48", borderRadius: "22px", padding: "12px 8px", display: "flex", flexDirection: "column", gap: "4px", flexShrink: "0", alignSelf: "stretch" }}>{(rail ?? []).map((r, rIndex) => (
<Fragment key={rIndex}><a href={r.href} style={{ height: "58px", borderRadius: "16px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "5px", fontSize: "9.5px", fontWeight: "700", background: r.bg, color: r.fg }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={r.icon} /></svg>{r.label}</a></Fragment>
))}<div style={{ flex: "1", minHeight: "12px" }}></div><a href="/compte" style={{ height: "48px", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", color: "#CFE3DA" }} aria-label="Réglages"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M4 7h8M17 7h3M4 17h3M12 17h8" /><circle cx="15" cy="7" r="2.2" /><circle cx="9.5" cy="17" r="2.2" /></svg></a></RailSurvol>
        <div style={{ flex: "1", minWidth: "0", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "14px", display: "flex", alignItems: "center", gap: "11px" }}><CarteMembre styleAvatar={{ width: "44px", height: "44px", borderRadius: "999px", background: "#B4581F", color: "#fff", fontSize: "13px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }} styleNom={{ display: "block", fontWeight: "700", fontSize: "14px", letterSpacing: "-0.2px" }} styleLien={{ display: "block", fontSize: "12px", color: "#5D6B66" }} libelle="Voir mon profil public" /></div>
          <CarteMonParcours />
          <div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "14px" }}>
            <div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F", padding: "0 6px 8px" }}>COMMUNAUTÉ</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>{(panelVilles ?? []).map((m, mIndex) => (
<Fragment key={mIndex}><a href={m.href} style={{ height: "44px", display: "flex", alignItems: "center", gap: "11px", padding: "0 12px", borderRadius: "14px", background: m.bg, color: m.fg, fontWeight: m.w, fontSize: "13.5px" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={m.icon} /></svg><span style={{ flex: "1", minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.label}</span>{m.count ? (<><span style={{ background: "#E0733A", color: "#fff", fontSize: "11px", fontWeight: "700", minWidth: "22px", height: "22px", padding: "0 7px", borderRadius: "999px", display: "flex", alignItems: "center", justifyContent: "center" }}>{m.count}</span></>) : null}</a></Fragment>
))}</div>
          </div>
          <div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 6px 8px" }}><span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F" }}>VOS RACCOURCIS</span><a href="/reseaux" style={{ fontSize: "12px", fontWeight: "700" }}>Modifier</a></div>
            <RaccourcisReseaux />
          </div>
        </div>
      </div>
    </div>
    <div data-zone="centre" style={{ flex: "1", minWidth: "0", display: "flex", flexDirection: "column", paddingRight: "24px" }}>
      <div style={{ height: "64px", flexShrink: "0" }}></div>
      <div data-zone="rangee" style={{ display: "flex", gap: "28px", padding: "12px 0 24px" }}>
    <main data-zone="contenu" style={{ width: "660px", display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ background: "#0F5C48", borderRadius: "22px", padding: "24px", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}><div><h1 style={{ margin: "0", fontSize: "30px", fontWeight: "800", letterSpacing: "-1px" }}>Lyon</h1><div style={{ fontSize: "13.5px", color: "#A9CDBF", marginTop: "2px" }}>Auvergne-Rhône-Alpes · 1 400 membres</div></div><a href="#" style={{ background: "#fff", color: "#0F5C48", fontSize: "12.5px", fontWeight: "700", padding: "9px 16px", borderRadius: "999px" }}>Réseau Lyon et Rhône</a></div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "20px" }}>{(countryBars ?? []).map((b, bIndex) => (
<Fragment key={bIndex}><div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12.5px" }}><span style={{ width: "110px", color: "#CFE3DA" }}>{b.c}</span><span style={{ flex: "1", height: "8px", borderRadius: "999px", background: "rgba(255,255,255,.14)", overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: b.w, background: "#fff", borderRadius: "999px" }}></span></span><span style={{ width: "36px", textAlign: "right", fontWeight: "700", fontVariantNumeric: "tabular-nums" }}>{b.n}</span></div></Fragment>
))}</div>
      </div>
      <div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", overflow: "hidden" }}>
        <div style={{ display: "flex", gap: "4px", padding: "0 20px", borderBottom: "1px solid #EAEEEC" }}>{(cityTabs ?? []).map((t, tIndex) => (
<Fragment key={tIndex}><a href={t.href} style={{ textDecoration: "none", cursor: "pointer", height: "52px", display: "flex", alignItems: "center", padding: "0 14px", fontSize: "13.5px", fontWeight: t.w, color: t.fg, borderBottom: `2.5px solid ${t.bd}` }}>{t.label}</a></Fragment>
))}<span style={{ flex: "1" }}></span><button type="button" data-modal-open="A12C" style={{ border: "none", font: "inherit", cursor: "pointer", alignSelf: "center", height: "36px", padding: "0 14px", borderRadius: "999px", background: "#16785E", color: "#fff", fontSize: "12.5px", fontWeight: "700", display: "flex", alignItems: "center" }}>Contribuer</button></div>
        <div style={{ padding: "20px" }}>
          <div style={{ background: "#EFF7F3", borderRadius: "18px", padding: "16px 18px", display: "flex", alignItems: "baseline", gap: "12px" }}><span style={{ fontSize: "30px", fontWeight: "800", letterSpacing: "-1px", color: "#0F5C48", fontVariantNumeric: "tabular-nums" }}>1 050 €</span><span style={{ fontSize: "13px", color: "#5D6B66" }}>budget mensuel médian d'un étudiant · 38 contributions</span></div>
          {(budgets ?? []).map((b, bIndex) => (
<Fragment key={bIndex}><div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 4px", borderBottom: "1px solid #F0F3F2" }}><span style={{ flex: "1", fontSize: "14px", fontWeight: "600" }}>{b.l}</span><span style={{ fontSize: "14.5px", fontWeight: "800", fontVariantNumeric: "tabular-nums" }}>{b.v}</span><span style={{ fontSize: "12px", color: "#8A958F", width: "90px", textAlign: "right" }}>{b.u} utiles</span><span style={{ fontSize: "12px", color: "#8A958F", fontWeight: "600" }}>Signaler</span></div></Fragment>
))}
        </div>
      </div>
    </main>
    <aside data-zone="droite" style={{ width: "300px", display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "18px" }}><div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F" }}>NOUVEAUX ARRIVANTS</div>{(arrivals ?? []).map((a, aIndex) => (
<Fragment key={aIndex}><div style={{ display: "flex", alignItems: "center", gap: "11px", marginTop: "14px" }}>{a.profil ? (<Link href={a.profil} data-avatar-profil="" aria-label={`Voir le profil de ${a.name}`} style={{ display: "contents", color: "inherit", textDecoration: "none" }}><span style={{ width: "38px", height: "38px", borderRadius: "999px", background: a.bg, color: "#fff", fontSize: "11px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}>{a.i}</span></Link>) : (<span style={{ width: "38px", height: "38px", borderRadius: "999px", background: a.bg, color: "#fff", fontSize: "11px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}>{a.i}</span>)}<span style={{ flex: "1" }}><span style={{ display: "block", fontSize: "13px", fontWeight: "700" }}>{a.profil ? (<Link href={a.profil} data-nom-profil="" style={{ color: "inherit", textDecoration: "none" }}>{a.name}</Link>) : a.name}</span><span style={{ display: "block", fontSize: "11.5px", color: "#8A958F" }}>{a.sub}</span></span><button style={{ height: "34px", padding: "0 14px", borderRadius: "999px", background: "#0F5C48", color: "#fff", border: "none", font: "inherit", fontSize: "12px", fontWeight: "700" }}>Saluer</button></div></Fragment>
))}</div>
      <div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "18px" }}><div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F" }}>ÉVÉNEMENTS À VENIR</div>{(events ?? []).map((e, eIndex) => (
<Fragment key={eIndex}><div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "12px" }}><div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "#E3F0EB", color: "#0F5C48", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: "0" }}><span style={{ fontSize: "15px", fontWeight: "800", lineHeight: "1" }}>{e.d}</span><span style={{ fontSize: "9px", fontWeight: "700" }}>{e.m}</span></div><div><div style={{ fontSize: "13px", fontWeight: "700" }}>{e.t}</div><div style={{ fontSize: "11.5px", color: "#8A958F" }}>{e.s}</div></div></div></Fragment>
))}</div>
    </aside>
  </div></div>
    </>
  );
}
