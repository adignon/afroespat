// GÉNÉRÉ depuis docs/template/03 Accueil v2.dc.html, section A08, cadre 1440 px.
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
import { ActionsReseau } from '@/components/actions-reseau';
import { EtatVide } from '@/components/etat-vide';
import { CarteMonParcours } from '@/components/carte-mon-parcours';
import { RaccourcisReseaux } from '@/components/raccourcis-reseaux';
import type { A08Data } from './data';

export function A08Desktop(props: A08Data) {
  const { actions, hrefGerer, netTabs, outils, ownerActions, panelReseaux, rail, reseau, sujets, topics } = props;

  return (
    <>
<header data-entete-globale="" style={{ position: "fixed", top: "0", left: "0", right: "0", height: "64px", zIndex: 30, background: "#F6F8F7", display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 560px) minmax(0, 1fr)", alignItems: "center", columnGap: "16px", padding: "0 24px" }}><div style={{ display: "flex", alignItems: "center", justifySelf: "start", minWidth: "0" }}><div style={{ height: "64px", display: "flex", alignItems: "center", gap: "10px", flexShrink: "0" }}><div style={{ width: "38px", height: "38px", borderRadius: "12px", background: "#0F5C48", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><circle cx="16.5" cy="7.5" r="1.6" fill="#E0733A" stroke="none" /></svg></div><span style={{ fontSize: "21px", fontWeight: "800", color: "#0F5C48", letterSpacing: "-0.5px" }}>Diaspora</span></div></div><div style={{ display: "flex", alignItems: "center", minWidth: "0" }}><ChampRecherche style={{ flex: "1", maxWidth: "none", width: "100%", height: "44px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", gap: "10px", padding: "0 18px", color: "#8A958F", fontSize: "13.5px" }} /></div><div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px", minWidth: "0" }}><BoutonCreer style={{ width: "44px", height: "44px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.7" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></BoutonCreer><LienMessages forme="point" style={{ position: "relative", width: "44px", height: "44px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.7" strokeLinejoin="round"><path d="M4 5h16v11H9l-5 4z" /></svg></LienMessages><LienNotifications forme="nombre" style={{ position: "relative", width: "44px", height: "44px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg></LienNotifications><PastilleMembre styleBoite={{ height: "44px", padding: "3px 16px 3px 3px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", gap: "9px", marginLeft: "4px" }} styleAvatar={{ width: "38px", height: "38px", borderRadius: "999px", background: "#B4581F", color: "#fff", fontSize: "12px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }} styleNom={{ fontSize: "13.5px", fontWeight: "600" }} /></div></header>
      <main style={{ display: "contents" }}>


    <div data-zone="gauche" style={{ width: "400px", flexShrink: "0", display: "flex", flexDirection: "column", padding: "0 24px", position: "sticky", top: "0", alignSelf: "flex-start", maxHeight: "100vh", overflowY: "auto" }}>
      <div style={{ height: "64px", flexShrink: "0" }}></div>
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 6px 8px" }}><span style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F" }}>VOS RACCOURCIS</span><a href="/reseaux" style={{ fontSize: "12px", fontWeight: "700" }}>Modifier</a></div>
            <RaccourcisReseaux />
          </div>
        </div>
      </div>
    </div>
    <div data-zone="centre" style={{ flex: "1", minWidth: "0", display: "flex", flexDirection: "column", paddingRight: "24px" }}>
      <div style={{ height: "64px", flexShrink: "0" }}></div>
      <div data-zone="contenu" style={{ flex: "1", padding: "12px 0 24px", display: "flex", flexDirection: "column", gap: "16px", maxWidth: "1036px" }}>
        <div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", overflow: "hidden" }}>
          <div style={{ height: "140px", background: "#CFE3DA", backgroundImage: reseau.couverture === null ? "none" : `url("${reseau.couverture}")`, backgroundSize: "cover", backgroundPosition: "center" }}></div>
          <div style={{ padding: "0 24px 18px", display: "flex", alignItems: "flex-end", gap: "16px", marginTop: "-32px" }}>
            <span style={{ position: "relative", display: "inline-flex", flexShrink: "0" }}><span style={{ width: "76px", height: "76px", borderRadius: "22px", background: "#E0733A", border: "4px solid #fff", color: "#fff", fontSize: "20px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", backgroundImage: reseau.logo === null ? "none" : `url("${reseau.logo}")`, backgroundSize: "cover", backgroundPosition: "center" }}>{reseau.logo === null ? reseau.initiales : null}</span>{actions.peutChangerCouverture ? (<button type="button" onClick={actions.onChangerLogo} disabled={actions.couvertureOccupee} aria-label="Changer le logo" data-reseau-changer-logo="" style={{ position: "absolute", right: "-6px", bottom: "-6px", width: "28px", height: "28px", borderRadius: "999px", background: "#fff", border: "1px solid #E6EBE9", display: "flex", alignItems: "center", justifyContent: "center", padding: "0", cursor: actions.couvertureOccupee ? "default" : "pointer" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" /></svg></button>) : null}</span>
            <div style={{ flex: "1", paddingBottom: "4px" }}><h1 style={{ margin: "0", fontSize: "24px", fontWeight: "800", letterSpacing: "-0.7px" }}>{reseau.nom}</h1><div style={{ fontSize: "13px", color: "#5D6B66", marginTop: "2px" }}>{reseau.resume}</div></div>
            <ActionsReseau actions={actions} />
          </div>
          <div style={{ display: "flex", gap: "4px", padding: "0 20px", borderTop: "1px solid #EAEEEC" }}>{(netTabs ?? []).map((t, tIndex) => (
<Fragment key={tIndex}><a href={t.href} style={{ textDecoration: "none", cursor: "pointer", height: "50px", display: "flex", alignItems: "center", padding: "0 14px", fontSize: "13.5px", fontWeight: t.w, color: t.fg, borderBottom: `2.5px solid ${t.bd}` }}>{t.label}</a></Fragment>
))}</div>
        </div>
        {outils.visibles ? (<div style={{ background: "#0F5C48", borderRadius: "18px", padding: "10px 12px 10px 20px", display: "flex", alignItems: "center", gap: "10px", color: "#fff" }}><span style={{ fontSize: "12.5px", fontWeight: "700", flex: "1" }}>{outils.libelle}</span>{(ownerActions ?? []).map((o, oIndex) => (
<Fragment key={oIndex}>{o === 'Gérer' ? (<Link href={hrefGerer} data-reseau-gerer="" style={{ height: "38px", padding: "0 14px", borderRadius: "12px", background: "rgba(255,255,255,.12)", color: "#fff", border: "none", font: "inherit", fontSize: "12.5px", fontWeight: "700", textDecoration: "none", display: "flex", alignItems: "center" }}>{o}</Link>) : (o === 'Annonce' ? (<Link href={outils.hrefAnnonce} data-reseau-annonce="" style={{ height: "38px", padding: "0 14px", borderRadius: "12px", background: "rgba(255,255,255,.12)", color: "#fff", border: "none", font: "inherit", fontSize: "12.5px", fontWeight: "700", textDecoration: "none", display: "flex", alignItems: "center" }}>{o}</Link>) : (<button type="button" onClick={outils.onEpingler} data-reseau-epingler="" style={{ height: "38px", padding: "0 14px", borderRadius: "12px", background: "rgba(255,255,255,.12)", color: "#fff", border: "none", font: "inherit", fontSize: "12.5px", fontWeight: "700", cursor: "pointer" }}>{o}</button>))}</Fragment>
))}</div>) : null}
        <div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "8px" }}>{sujets.nouveauVisible ? (<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px 6px" }}><div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F" }}>SUJETS</div><button type="button" onClick={sujets.onNouveau} data-sujet-nouveau="" style={{ fontSize: "12.5px", fontWeight: "700", color: "#16785E", fontFamily: "inherit", border: "none", background: "none", padding: 0, cursor: "pointer" }}>Nouveau sujet</button></div>) : null}
          {(topics ?? []).map((t, tIndex) => (
<Fragment key={tIndex}><Link href={t.href} data-sujet-lien="" style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: "14px", padding: "14px 14px", borderRadius: "16px", background: t.bg }}>
              <span style={{ width: "38px", height: "38px", borderRadius: "12px", background: t.iconBg, color: t.iconFg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={t.icon} /></svg></span>
              <div style={{ flex: "1", minWidth: "0" }}><div style={{ fontSize: "14.5px", fontWeight: "700", letterSpacing: "-0.2px" }}>{t.title}</div><div style={{ fontSize: "12px", color: "#8A958F", marginTop: "2px" }}>{t.last}</div></div>
              <span style={{ fontSize: "11.5px", fontWeight: "700", padding: "5px 11px", borderRadius: "999px", background: t.stBg, color: t.stFg }}>{t.state}</span>
              <span style={{ width: "90px", textAlign: "right", fontSize: "12.5px", color: "#5D6B66" }}><strong style={{ color: "#16211D" }}>{t.n}</strong> réponses</span>
            </Link></Fragment>
))}{(topics ?? []).length === 0 ? (<EtatVide texte={sujets.vide} />) : null}
        </div>
      </div>
    </div>
  
      </main>
    </>
  );
}
