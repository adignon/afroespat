// GÉNÉRÉ depuis docs/template/03 Accueil v2.dc.html, section A06, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import Link from 'next/link';
import { OngletsPropositions } from '@/components/propositions-recues';
import { ListePropositions } from '@/components/propositions-recues';
import type { A06Data } from './data';

export function A06SignalementsMobile(props: A06Data) {
  const { guide, signalements } = props;

  return (
    <>

      <main style={{ display: "contents" }}>

      <div style={{ padding: "52px 16px 12px", background: "#fff", borderBottom: "1px solid #E6EBE9" }}><div style={{ display: "flex", alignItems: "center", gap: "10px" }}><Link href={guide.href} aria-label="Revenir au guide" data-a06-retour="" style={{ width: "40px", height: "40px", borderRadius: "999px", background: "#F2F5F4", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg></Link><h1 style={{ margin: "0", fontSize: "17px", fontWeight: "800" }}>{signalements.titre}</h1></div><OngletsPropositions largeur="mobile" /></div>
      <ListePropositions largeur="mobile" />
    
      </main>
    </>
  );
}
