// GÉNÉRÉ depuis docs/template/01 Accès et Onboarding.dc.html, section P03, cadre 1440 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 1440 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import type { OnboardingVals } from '../onboarding/data';

export function P03Desktop(props: OnboardingVals) {
  const { toc } = props;

  return (
    <>
      <main style={{ display: "contents" }}>

      <div style={{ height: "72px", padding: "0 40px", display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid #E6EBE9", background: "#fff" }}><div style={{ width: "38px", height: "38px", borderRadius: "12px", background: "#0F5C48" }}></div><span style={{ fontSize: "21px", fontWeight: "800", color: "#0F5C48", letterSpacing: "-0.5px" }}>Diaspora</span></div>
      <div style={{ flex: "1", display: "flex", gap: "48px", justifyContent: "center", padding: "48px 40px", overflow: "hidden" }}>
        <nav style={{ width: "220px", position: "sticky", top: "0", display: "flex", flexDirection: "column", gap: "2px" }}>
          <div style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F", padding: "0 12px 10px" }}>SOMMAIRE</div>
          {(toc ?? []).map((t, tIndex) => (
<Fragment key={tIndex}><a href="#" style={{ height: "40px", display: "flex", alignItems: "center", padding: "0 12px", borderRadius: "12px", fontSize: "13.5px", fontWeight: t.w, background: t.bg, color: t.fg }}>{t.label}</a></Fragment>
))}
        </nav>
        <article style={{ width: "760px", background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "40px 48px" }}>
          <div style={{ display: "flex", gap: "8px" }}><span style={{ background: "#E3F0EB", color: "#0F5C48", fontSize: "11px", fontWeight: "700", padding: "5px 11px", borderRadius: "999px" }}>Version 3</span><span style={{ background: "#F2F5F4", color: "#5D6B66", fontSize: "11px", fontWeight: "700", padding: "5px 11px", borderRadius: "999px" }}>En vigueur depuis le 1er septembre 2026</span></div>
          <h1 style={{ margin: "18px 0 0", fontSize: "32px", fontWeight: "800", letterSpacing: "-1px" }}>Politique de confidentialité</h1>
          <h2 style={{ margin: "32px 0 0", fontSize: "19px", fontWeight: "700", letterSpacing: "-0.3px" }}>1. Ce que nous collectons</h2>
          <p style={{ margin: "10px 0 0", fontSize: "15px", lineHeight: "1.7" }}>Votre numéro de téléphone sert uniquement à vous connecter. Il n'est jamais affiché aux autres membres, ni transmis à un partenaire.</p>
          <ul style={{ margin: "12px 0 0", paddingLeft: "20px", fontSize: "15px", lineHeight: "1.8" }}><li>Pseudo, nom d'affichage, ville et phase de parcours</li><li>Contenus que vous publiez</li><li>Préférences de notification</li></ul>
          <h2 style={{ margin: "28px 0 0", fontSize: "19px", fontWeight: "700", letterSpacing: "-0.3px" }}>2. Où sont vos données</h2>
          <p style={{ margin: "10px 0 0", fontSize: "15px", lineHeight: "1.7" }}>Toutes les données sont hébergées en Europe. <a href="#" style={{ fontWeight: "700", textDecoration: "underline" }}>Voir nos sous-traitants</a>.</p>
          <div style={{ marginTop: "40px", paddingTop: "18px", borderTop: "1px solid #EAEEEC", fontSize: "12.5px", color: "#8A958F" }}>Dernière mise à jour le 1er septembre 2026</div>
        </article>
      </div>
    
      </main>
    </>
  );
}
