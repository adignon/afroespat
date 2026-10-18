// GÉNÉRÉ depuis docs/template/03 Accueil v2.dc.html, section A06, cadre 1440 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 1440 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import { BoutonCreer, ChampRecherche, LienMessages, LienNotifications } from '@/components/barre-haute/controles';
import { PastilleMembre, CarteMembre } from '@/components/barre-haute/membre';
import { RailSurvol } from '@/components/rail/survol';
import { CarteMonParcours } from '@/components/carte-mon-parcours';
import { RaccourcisReseaux } from '@/components/raccourcis-reseaux';
import type { A06Data } from './data';

export function A06CorrigerDesktop(props: A06Data) {
  const { correction, panelGuides, rail } = props;

  return (
    <>
<header data-entete-globale="" style={{ position: "fixed", top: "0", left: "0", right: "0", height: "64px", zIndex: 30, background: "#F6F8F7", display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 560px) minmax(0, 1fr)", alignItems: "center", columnGap: "16px", padding: "0 24px" }}><div style={{ display: "flex", alignItems: "center", justifySelf: "start", minWidth: "0" }}><div style={{ height: "64px", display: "flex", alignItems: "center", gap: "10px", flexShrink: "0" }}><div style={{ width: "38px", height: "38px", borderRadius: "12px", background: "#0F5C48", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><circle cx="16.5" cy="7.5" r="1.6" fill="#E0733A" stroke="none" /></svg></div><span style={{ fontSize: "21px", fontWeight: "800", color: "#0F5C48", letterSpacing: "-0.5px" }}>Diaspora</span></div></div><div style={{ display: "flex", alignItems: "center", minWidth: "0" }}><ChampRecherche style={{ flex: "1", maxWidth: "none", width: "100%", height: "44px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", gap: "10px", padding: "0 18px", color: "#8A958F", fontSize: "13.5px" }} /></div><div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px", minWidth: "0" }}><BoutonCreer style={{ width: "44px", height: "44px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.7" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></BoutonCreer><LienMessages forme="point" style={{ position: "relative", width: "44px", height: "44px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.7" strokeLinejoin="round"><path d="M4 5h16v11H9l-5 4z" /></svg></LienMessages><LienNotifications forme="nombre" style={{ position: "relative", width: "44px", height: "44px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg></LienNotifications><PastilleMembre styleBoite={{ height: "44px", padding: "3px 16px 3px 3px", borderRadius: "999px", background: "#EEF2F0", display: "flex", alignItems: "center", gap: "9px", marginLeft: "4px" }} styleAvatar={{ width: "38px", height: "38px", borderRadius: "999px", background: "#B4581F", color: "#fff", fontSize: "12px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }} styleNom={{ fontSize: "13.5px", fontWeight: "600" }} /></div></header>
      <main style={{ display: "contents" }}>


    <div style={{ width: "400px", flexShrink: "0", display: "flex", flexDirection: "column", padding: "0 24px", position: "sticky", top: "0", alignSelf: "flex-start", maxHeight: "100vh", overflowY: "auto" }}>
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
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>{(panelGuides ?? []).map((m, mIndex) => (
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
    <div style={{ flex: "1", minWidth: "0", display: "flex", flexDirection: "column", paddingRight: "24px" }}>
      <div style={{ height: "64px", flexShrink: "0" }}></div>
      <div style={{ flex: "1", display: "flex", gap: "28px", padding: "12px 0 24px" }}>
        <article style={{ width: "688px", background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "28px", alignSelf: "flex-start" }}>
          <div style={{ display: "flex", gap: "8px" }}><span style={{ background: "#F2F5F4", color: "#5D6B66", fontSize: "11.5px", fontWeight: "700", padding: "4px 10px", borderRadius: "999px" }}>Logement</span><span style={{ background: "#F2F5F4", color: "#5D6B66", fontSize: "11.5px", fontWeight: "700", padding: "4px 10px", borderRadius: "999px" }}>Universel</span></div>
          <h1 style={{ margin: "14px 0 0", fontSize: "30px", fontWeight: "800", letterSpacing: "-1px" }}>Obtenir la garantie Visale sans CDI</h1>
          <span style={{ display: "inline-block", marginTop: "12px", fontSize: "14px", fontWeight: "700", color: "#0F5C48", background: "#E3F0EB", padding: "6px 12px", borderRadius: "999px" }}>Mis à jour le 12 mars 2026</span>
          <h2 style={{ margin: "24px 0 0", fontSize: "19px", fontWeight: "700" }}>1. Vérifier votre éligibilité</h2>
          <p style={{ margin: "10px 0 0", fontSize: "15px", lineHeight: "1.72" }}>Visale est une caution gratuite proposée par Action Logement. Les étudiants de 18 à 30 ans y ont droit, <span style={{ background: "#CFE3DA", borderRadius: "4px", outline: "2px solid #16785E", outlineOffset: "1px" }}>quel que soit leur pays d'origine, dès l'obtention du VLS-TS</span>.</p>
          <ul style={{ margin: "18px 0 0", paddingLeft: "20px", fontSize: "15px", lineHeight: "1.85" }}><li>Créer un compte sur visale.fr</li><li>Déposer votre VLS-TS et votre certificat de scolarité</li></ul>
        </article>
      </div>
      <div style={{ position: "absolute", inset: "0", background: "rgba(22,33,29,.45)" }}></div>
      <div style={{ position: "absolute", top: "0", right: "0", bottom: "0", width: "480px", background: "#fff", padding: "28px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: "20px", fontWeight: "800", letterSpacing: "-0.5px" }}>Proposer une correction</span><button type="button" onClick={correction.onFermer} aria-label="Fermer" data-correction-fermer="" style={{ width: "40px", height: "40px", borderRadius: "999px", background: "#F2F5F4", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", color: "inherit", cursor: "pointer", border: "none" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button></div>
          <div style={{ fontSize: "12.5px", fontWeight: "700" }}>Passage sélectionné</div>
          <div data-correction-passage="" style={{ marginTop: "-8px", background: "#F2F5F4", borderRadius: "14px", padding: "14px", fontSize: "14px", lineHeight: "1.6", color: "#5D6B66" }}>{correction.passage}</div>
          <div style={{ fontSize: "12.5px", fontWeight: "700" }}>Remplacer par</div>
          <textarea value={correction.remplacement} onChange={correction.onRemplacement} aria-label="Le texte que vous proposez à la place" data-correction-remplacement="" style={{ width: "100%", boxSizing: "border-box", background: "transparent", fontFamily: "inherit", color: "inherit", outline: "none", resize: "none", display: "block", margin: "0", marginTop: "-8px", border: "1.5px solid #16785E", borderRadius: "14px", padding: "14px", fontSize: "14px", lineHeight: "1.6", minHeight: "76px" }} />
          <div style={{ fontSize: "12.5px", fontWeight: "700" }}>Pourquoi cette correction ? <span style={{ color: "#B4581F" }}>*</span></div>
          <textarea value={correction.motif} onChange={correction.onMotif} aria-label="Pourquoi cette correction ? (obligatoire)" data-correction-motif="" required aria-required="true" minLength={20} style={{ width: "100%", boxSizing: "border-box", background: "transparent", fontFamily: "inherit", color: "inherit", outline: "none", resize: "none", display: "block", margin: "0", marginTop: "-8px", border: "1px solid #E6EBE9", borderRadius: "14px", padding: "14px", fontSize: "14px" }} />
          <div style={{ fontSize: "12.5px", fontWeight: "700" }}>Source <span style={{ color: "#8A958F", fontWeight: "500" }}>(facultatif)</span></div>
          <input type="url" inputMode="url" autoComplete="off" placeholder="https://" aria-label="Une source qui appuie votre correction (facultatif)" value={correction.source} onChange={correction.onSource} data-correction-source="" style={{ width: "100%", boxSizing: "border-box", background: "transparent", fontFamily: "inherit", outline: "none", marginTop: "-8px", height: "46px", border: "1px solid #E6EBE9", borderRadius: "14px", padding: "0 14px", display: "flex", alignItems: "center", fontSize: "13.5px", color: "inherit" }} />
          <div style={{ display: "flex", gap: "10px", alignItems: "center", background: "#F3F7F5", borderRadius: "14px", padding: "12px 14px", fontSize: "12.5px", color: "#0F5C48", fontWeight: "600" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>L'auteur a 14 jours pour répondre. Sans réponse, la modération tranche.</div>
          {correction.accuse === null ? null : (<div role="status" data-correction-accuse="" style={{ background: "#16211D", color: "#fff", borderRadius: "16px", padding: "14px 16px", fontSize: "13px", fontWeight: "600", lineHeight: "1.5" }}>{correction.accuse}</div>)}<div style={{ flex: "1" }}></div>
          <div style={{ display: "flex", gap: "8px" }}><button type="button" onClick={correction.onFermer} data-correction-annuler="" style={{ height: "50px", padding: "0 20px", borderRadius: "14px", background: "#F2F5F4", border: "none", font: "inherit", fontSize: "14.5px", fontWeight: "700", cursor: "pointer" }}>Annuler</button><button type="button" onClick={correction.onEnvoyer} disabled={!correction.peutEnvoyer} data-correction-envoyer="" style={{ flex: "1", height: "50px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "14.5px", fontWeight: "700", cursor: correction.peutEnvoyer ? "pointer" : "default", opacity: correction.peutEnvoyer ? "1" : ".55" }}>Envoyer la proposition</button></div>
      </div>
    </div>
  
      </main>
    </>
  );
}
