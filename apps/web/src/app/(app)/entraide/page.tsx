import { ScreenFrames } from '@/screens/frames';
import { H01Desktop } from '@/screens/h01/desktop.generated';
import { H01Mobile } from '@/screens/h01/mobile.generated';

/**
 * H01 — Fil d'entraide, la liste des demandes (`/entraide`, 06 §5).
 *
 * Le JSX vient du TRANSCODAGE de `docs/template/05 Entraide.dc.html` : les styles
 * en ligne sont ceux de la maquette, à l'identique. Rien n'est réécrit.
 *
 * RESPONSIVE : la maquette fournit DEUX designs — un cadre ordinateur de 1440 px et
 * un cadre mobile de 390 px. `ScreenFrames` bascule au seuil de 1024 px que fixe
 * §10.1, plutôt que d'inventer un comportement intermédiaire que le design n'a pas
 * défini.
 *
 * AUCUN ÉTAT ICI, et c'est la maquette qui le décide : son `renderVals()` rend `{}`
 * et tout son contenu est écrit en clair (voir `@/screens/entraide/data`). Il n'y a
 * donc ni composant client ni JavaScript sur cette page — elle est rendue sur le
 * serveur. L'état arrivera avec l'API, au lot suivant.
 *
 * RÈGLE DURE (14 §2) : l'entraide n'est JAMAIS payante. Cet écran ne porte aucun
 * encart d'abonnement, aucun verrou, aucune mention de plan — la maquette n'en
 * dessine pas non plus, ce qui a été vérifié plutôt que supposé.
 */
export default function HelpListPage() {
  return <ScreenFrames screen="H01" desktop={<H01Desktop />} mobile={<H01Mobile />} />;
}
