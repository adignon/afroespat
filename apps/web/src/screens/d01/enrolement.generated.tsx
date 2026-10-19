// GÉNÉRÉ depuis docs/template/10 Administration.dc.html, section D01, cadre 420 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 420 px, ce qui ne
// serait pas responsive.
import { ConnexionEquipe } from '@/components/admin/connexion-equipe';
import type { AdministrationData } from '../administration/data';

export function D01Enrolement(_props: AdministrationData) {
  return (
    <>
      <div style={{ width: "100%", maxWidth: "420px", background: "#fff", border: "1px solid #DDE3E0", borderRadius: "28px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px", flexShrink: "0" }}>

      <main style={{ display: "contents" }}>
<ConnexionEquipe />
      </main>
      </div>
    </>
  );
}
