// GÉNÉRÉ depuis docs/template/01 Accès et Onboarding.dc.html, section P03, cadre 1440 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 1440 px, ce qui ne
// serait pas responsive.
import { DocumentLegal } from '@/components/document-legal';
import type { OnboardingVals } from '../onboarding/data';

export function P03Desktop(_props: OnboardingVals) {
  return (
    <>

      <main style={{ display: "contents" }}>

      <div style={{ height: "72px", padding: "0 40px", display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid #E6EBE9", background: "#fff" }}><div style={{ width: "38px", height: "38px", borderRadius: "12px", background: "#0F5C48" }}></div><span style={{ fontSize: "21px", fontWeight: "800", color: "#0F5C48", letterSpacing: "-0.5px" }}>Diaspora</span></div>
      <DocumentLegal />
    
      </main>
    </>
  );
}
