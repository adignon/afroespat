// GÉNÉRÉ depuis docs/template/03 Accueil v2.dc.html, section A02, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import Link from 'next/link';
import { PublicationVivante } from '@/components/publication-vivante';
import { TitrePublication } from '@/components/publication-vivante';
import type { A02Data } from './data';

export function A02Mobile(_props: A02Data) {
  return (
    <>

      <main style={{ display: "contents" }}>

    <div style={{ padding: "52px 16px 12px", display: "flex", alignItems: "center", gap: "10px", background: "#fff", borderBottom: "1px solid #E6EBE9" }}><Link href="/accueil" aria-label="Retour au fil" style={{ width: "40px", height: "40px", borderRadius: "999px", background: "#F2F5F4", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg></Link><span style={{ fontSize: "16px", fontWeight: "700" }}><TitrePublication /></span></div>
    <PublicationVivante largeur="mobile" />
  
      </main>
    </>
  );
}
