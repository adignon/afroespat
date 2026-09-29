import { ScreenFrames } from '@/screens/frames';
import { K01Desktop } from '@/screens/k01/desktop.generated';
import { K01Mobile } from '@/screens/k01/mobile.generated';

/**
 * K01 — « Mon profil » (`/compte/profil`, T5 §9).
 *
 * Le JSX vient du TRANSCODAGE de `docs/template/08 Compte.dc.html` : les styles
 * en ligne sont ceux de la maquette, à l'identique. Rien n'est réécrit.
 *
 * AUCUN ÉTAT ICI, et c'est la maquette qui le décide : son `renderVals()` rend
 * `{}` et tout son contenu est écrit en clair (voir `@/screens/compte/data`). Il
 * n'y a donc ni composant client ni JavaScript sur cette page — elle est rendue
 * sur le serveur. L'état arrivera avec l'API, au lot suivant.
 *
 * 01 §2.1, RÈGLE DURE : aucun numéro de téléphone en clair. Cet écran n'en
 * affiche aucun — la maquette n'en dessine pas non plus, ce qui a été vérifié
 * plutôt que supposé. Le seul téléphone du module vit sur K04, masqué.
 */
export default function ProfilPage() {
  return <ScreenFrames screen="K01" desktop={<K01Desktop />} mobile={<K01Mobile />} />;
}
