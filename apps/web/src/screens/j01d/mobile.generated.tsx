// GÉNÉRÉ depuis docs/template/04 Parcours.dc.html, section J01D, cadre 390 px.
// Ne pas modifier à la main : relancer `node tools/generate-screens.mjs`.
//
// Les styles en ligne sont ceux de la maquette, à l'identique. Le conteneur
// extérieur, lui, est fluide : la maquette le fige à 390 px, ce qui ne
// serait pas responsive.
import { VueDiscussion } from '@/components/parcours/vue-discussion';
import type { J01DData } from '../parcours/data';

export function J01DMobile(_props: J01DData) {
  return (
    <>
      <main style={{ display: "contents" }}>
<VueDiscussion compact={true} />
      </main>
    </>
  );
}
