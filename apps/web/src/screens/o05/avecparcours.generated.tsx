// GÉNÉRÉ depuis docs/template/01 Accès et Onboarding.dc.html, section O05, cadre 700 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 700 px, ce qui ne
// serait pas responsive.
import type { O05Data } from '../onboarding/data';

export function O05AvecParcours(props: O05Data) {
  const { onCommencer, parcours } = props;

  return (
    <>
      <div style={{ background: "#F6F8F7", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px", flexGrow: "1", flexShrink: "1", flexBasis: "auto" }}>

      <main style={{ display: "contents" }}>

      <div style={{ width: "100%", maxWidth: "520px" }}>
        <div style={{ width: "64px", height: "64px", borderRadius: "20px", background: "#16785E", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4.5 4.5L19 7" /></svg></div>
        <h1 style={{ margin: "22px 0 0", fontSize: "32px", fontWeight: "800", letterSpacing: "-1px" }}>Votre parcours est prêt</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "14px", height: "52px", padding: "0 16px", borderRadius: "14px", background: "#fff", border: "1px solid #E6EBE9" }}><span style={{ flex: "1", fontSize: "16px", fontWeight: "700" }}>{parcours.titre}</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5D6B66" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z" /></svg></div>
        <div style={{ marginTop: "18px", border: "1.5px solid #E0733A", borderRadius: "22px", padding: "22px", background: "#FFFBF8" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}><span style={{ background: "#E0733A", color: "#fff", fontSize: "10.5px", fontWeight: "700", letterSpacing: ".8px", padding: "5px 11px", borderRadius: "999px" }}>ÉTAPE {parcours.rang} SUR {parcours.total}</span></div>
          <div style={{ fontSize: "19px", fontWeight: "700", letterSpacing: "-0.4px", marginTop: "12px" }}>{parcours.etape}</div>
          {parcours.description === "" ? null : <p style={{ margin: "6px 0 0", fontSize: "14px", color: "#5D6B66", lineHeight: "1.55" }}>{parcours.description}</p>}
          <button type="button" onClick={onCommencer} style={{ width: "100%", height: "50px", marginTop: "16px", borderRadius: "14px", background: "#E0733A", color: "#fff", border: "none", font: "inherit", fontSize: "15px", fontWeight: "700", cursor: "pointer" }}>Commencer</button>
        </div>
        <div style={{ textAlign: "center", marginTop: "18px" }}><a href="/accueil" style={{ fontSize: "14px", fontWeight: "700" }}>Aller à l'accueil</a></div>
      </div>
      <div style={{ marginTop: "auto" }}></div>
    
      </main>
      </div>
    </>
  );
}
