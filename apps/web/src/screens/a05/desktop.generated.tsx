// GÉNÉRÉ depuis docs/template/03 Accueil v2.dc.html, section A05, cadre 1440 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 1440 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import type { A05Data } from './data';

export function A05Desktop(props: A05Data) {
  const { mdTools, rules } = props;

  return (
    <>
      <main style={{ display: "contents" }}>

    <div style={{ height: "66px", padding: "0 32px", display: "flex", alignItems: "center", gap: "14px", background: "#fff", borderBottom: "1px solid #E6EBE9" }}><span style={{ width: "42px", height: "42px", borderRadius: "999px", background: "#F2F5F4", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg></span><h1 style={{ margin: "0", fontSize: "16px", fontWeight: "700" }}>Nouveau guide</h1><span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", color: "#16785E", fontWeight: "600", background: "#E3F0EB", padding: "5px 11px", borderRadius: "999px" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="m5 12 4.5 4.5L19 7" /></svg>Brouillon enregistré · il y a 4 s</span><span style={{ flex: "1" }}></span><button style={{ height: "44px", padding: "0 22px", borderRadius: "14px", background: "#16785E", color: "#fff", border: "none", font: "inherit", fontSize: "14px", fontWeight: "700" }}>Publier</button></div>
    <div style={{ padding: "20px 32px 0", display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "12px" }}>
      <div style={{ height: "50px", padding: "0 16px", borderRadius: "14px", background: "#fff", border: "1.5px solid #16785E", display: "flex", alignItems: "center", fontSize: "16px", fontWeight: "700" }}>Mon arrivée étudiante à Lyon, étape par étape</div>
      <div style={{ height: "50px", padding: "0 16px", borderRadius: "14px", background: "#fff", border: "1px solid #E6EBE9", display: "flex", alignItems: "center", fontSize: "13.5px", fontWeight: "600" }}>Catégorie : Études</div>
      <div style={{ height: "50px", padding: "0 16px", borderRadius: "14px", background: "#fff", border: "1px solid #E6EBE9", display: "flex", alignItems: "center", fontSize: "13.5px", fontWeight: "600" }}>Portée : Bénin</div>
      <div style={{ height: "50px", padding: "0 16px", borderRadius: "14px", background: "#fff", border: "1px solid #E6EBE9", display: "flex", alignItems: "center", fontSize: "13.5px", fontWeight: "600", color: "#8A958F" }}>Ville (facultatif)</div>
    </div>
    <div style={{ flex: "1", minHeight: "0", display: "grid", gridTemplateColumns: "1fr 1fr 320px", gap: "16px", padding: "16px 32px 28px" }}>
      <div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", display: "flex", flexDirection: "column", overflow: "hidden" }}><div style={{ height: "48px", display: "flex", alignItems: "center", gap: "4px", padding: "0 12px", borderBottom: "1px solid #EAEEEC" }}>{(mdTools ?? []).map((t, tIndex) => (
<Fragment key={tIndex}><span style={{ height: "34px", minWidth: "34px", padding: "0 8px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "800", color: "#5D6B66" }}>{t}</span></Fragment>
))}</div><pre style={{ margin: "0", flex: "1", padding: "18px 20px", fontFamily: "ui-monospace,Menlo,monospace", fontSize: "13px", lineHeight: "1.75", color: "#16211D", whiteSpace: "pre-wrap" }}>## Étape 1 — Admission Campus France
Dossier ouvert en novembre, entretien en janvier.
Comptez **3 mois**.

## Étape 2 — Visa étudiant
- Prendre RDV chez TLS Cotonou
- Préparer l'AVI (banque partenaire)

## Étape 3 — Logement
_Complétez cette section…_</pre></div>
      <div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "22px 26px", overflow: "hidden" }}><div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F" }}>APERÇU</div><h3 style={{ margin: "14px 0 0", fontSize: "18px", fontWeight: "700" }}>Étape 1 — Admission Campus France</h3><p style={{ margin: "8px 0 0", fontSize: "14.5px", lineHeight: "1.65" }}>Dossier ouvert en novembre, entretien en janvier. Comptez <strong>3 mois</strong>.</p><h3 style={{ margin: "20px 0 0", fontSize: "18px", fontWeight: "700" }}>Étape 2 — Visa étudiant</h3><ul style={{ margin: "8px 0 0", paddingLeft: "20px", fontSize: "14.5px", lineHeight: "1.8" }}><li>Prendre RDV chez TLS Cotonou</li><li>Préparer l'AVI (banque partenaire)</li></ul><h3 style={{ margin: "20px 0 0", fontSize: "18px", fontWeight: "700" }}>Étape 3 — Logement</h3><p style={{ margin: "8px 0 0", fontSize: "14.5px", color: "#8A958F", fontStyle: "italic" }}>Complétez cette section…</p></div>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ background: "#FBE3D4", borderRadius: "22px", padding: "18px" }}><div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: "1px", color: "#B4581F" }}>À PARTIR DE MON PARCOURS</div><div style={{ fontSize: "13px", lineHeight: "1.55", marginTop: "6px" }}>Une section par étape de « Mes études à Lyon » a été pré-remplie.</div></div>
        <div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "18px" }}><div style={{ fontSize: "10.5px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F" }}>AVANT DE PUBLIER</div>{(rules ?? []).map((r, rIndex) => (
<Fragment key={rIndex}><div style={{ display: "flex", gap: "10px", marginTop: "12px", fontSize: "13px", lineHeight: "1.5" }}><span style={{ width: "20px", height: "20px", borderRadius: "999px", background: "#E3F0EB", color: "#16785E", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="m5 12 4.5 4.5L19 7" /></svg></span>{r}</div></Fragment>
))}</div>
      </div>
    </div>
  
      </main>
    </>
  );
}
