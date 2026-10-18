// GÉNÉRÉ depuis docs/template/03 Accueil v2.dc.html, section A08, cadre 1440 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 1440 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import { CarteMembre } from '@/components/barre-haute/membre';
import { RailSurvol } from '@/components/rail/survol';
import { CarteMonParcours } from '@/components/carte-mon-parcours';
<<<<<<< HEAD
=======
import { RaccourcisReseaux } from '@/components/raccourcis-reseaux';
>>>>>>> claude/beautiful-mayer-jze477
import type { A08Data } from './data';

export function A08ChromeGaucheDesktop(props: A08Data) {
  const { panelReseaux, rail } = props;

  return (
    <>
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
    </>
  );
}
