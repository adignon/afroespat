// GÉNÉRÉ depuis docs/template/04 Parcours.dc.html, section J07, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import Link from 'next/link';
import { VueHistorique } from '@/components/parcours/vue-historique';
import type { J07Data } from '../parcours/data';

export function J07Mobile(_props: J07Data) {
  return (
    <>

      <main style={{ display: "contents" }}>
<VueHistorique compact={true} /><div style={{ position: "sticky", flexShrink: "0", bottom: "0", zIndex: 10, background: "#fff", borderTop: "1px solid #E6EBE9", padding: "6px 8px calc(env(safe-area-inset-bottom, 0px) + 24px)", display: "grid", gridTemplateColumns: "repeat(5,1fr)" }}><a href="/accueil" style={{ textDecoration: "none", cursor: "pointer", height: "54px", borderRadius: "14px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", fontSize: "10px", fontWeight: "700", color: "#8A958F", background: "transparent" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11 12 4l8 7v9H4z" /></svg>Accueil</a><a href="/parcours" style={{ textDecoration: "none", cursor: "pointer", height: "54px", borderRadius: "14px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", fontSize: "10px", fontWeight: "700", color: "#0F5C48", background: "#E3F0EB" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 5h6a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h10" /></svg>Parcours</a><a href="/entraide" style={{ textDecoration: "none", cursor: "pointer", height: "54px", borderRadius: "14px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", fontSize: "10px", fontWeight: "700", color: "#8A958F", background: "transparent" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" /></svg>Entraide</a><a href="/services/logement" style={{ textDecoration: "none", cursor: "pointer", height: "54px", borderRadius: "14px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", fontSize: "10px", fontWeight: "700", color: "#8A958F", background: "transparent" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V8l8-4 8 4v12" /></svg>Services</a><Link href="/compte" style={{ height: "54px", borderRadius: "14px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", fontSize: "10px", fontWeight: "700", color: "#8A958F", background: "transparent", textDecoration: "none", cursor: "pointer" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 21a7 7 0 0 1 14 0" /></svg>Compte</Link></div>
      </main>
    </>
  );
}
