// GÉNÉRÉ depuis docs/template/01 Accès et Onboarding.dc.html, section P03, cadre 560 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 560 px, ce qui ne
// serait pas responsive.
import { Fragment } from 'react';
import type { OnboardingVals } from '../onboarding/data';

export function P03Ressources(props: OnboardingVals) {
  const { resources } = props;

  return (
    <>
      <main style={{ display: "contents" }}>

      <div style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "1px", color: "#8A958F" }}>VARIANTE « RESSOURCES »</div>
      <div style={{ background: "#E3F0EB", borderRadius: "22px", padding: "20px 22px", fontSize: "14px", lineHeight: "1.6", color: "#0F5C48" }}><strong>Vous traversez un moment difficile ?</strong> Ces services sont gratuits et confidentiels.</div>
      {(resources ?? []).map((r, rIndex) => (
<Fragment key={rIndex}><div style={{ background: "#fff", border: "1px solid #E6EBE9", borderRadius: "22px", padding: "20px", display: "flex", gap: "14px" }}>
          <span style={{ width: "44px", height: "44px", borderRadius: "14px", background: "#E3F0EB", color: "#0F5C48", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg></span>
          <div style={{ flex: "1", minWidth: "0" }}><div style={{ fontSize: "15px", fontWeight: "700", letterSpacing: "-0.2px" }}>{r.name}</div><div style={{ fontSize: "13px", color: "#5D6B66", marginTop: "3px", lineHeight: "1.5" }}>{r.desc}</div><div style={{ display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap" }}><span style={{ background: "#16785E", color: "#fff", fontSize: "12.5px", fontWeight: "700", padding: "6px 12px", borderRadius: "999px" }}>{r.phone}</span><span style={{ background: "#F2F5F4", color: "#5D6B66", fontSize: "12.5px", fontWeight: "600", padding: "6px 12px", borderRadius: "999px" }}>{r.hours}</span></div></div>
        </div></Fragment>
))}
    
      </main>
    </>
  );
}
