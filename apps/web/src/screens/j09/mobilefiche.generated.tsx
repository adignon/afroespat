// GÉNÉRÉ depuis docs/template/04 Parcours.dc.html, section J09, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import { VueFichePublique } from '@/components/parcours/vue-publics';
import type { J09FicheData } from '../parcours/data';

export function J09MobileFiche(_props: J09FicheData) {
  return (
    <>
      <main style={{ display: "contents" }}>
<VueFichePublique compact={true} />
      </main>
    </>
  );
}
