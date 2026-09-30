import { ScreenFrames } from '@/screens/frames';
import { S01Desktop } from '@/screens/s01/desktop.generated';
import { S01Mobile } from '@/screens/s01/mobile.generated';

/**
 * S01 — Annonces de logement, la liste (`/services/logement`, 10 §7).
 *
 * Le JSX vient du TRANSCODAGE de `docs/template/06 Services.dc.html` : les styles
 * en ligne sont ceux de la maquette, à l'identique. Rien n'est réécrit.
 *
 * RESPONSIVE : la maquette fournit DEUX designs — un cadre ordinateur de 1440 px
 * et un cadre mobile de 390 px. `ScreenFrames` bascule au seuil de 1024 px que
 * fixe §10.1, plutôt que d'inventer un comportement intermédiaire que le design
 * n'a pas défini.
 *
 * AUCUN ÉTAT ICI, et c'est la maquette qui le décide : son `renderVals()` rend
 * `{}` et tout son contenu est écrit en clair (voir `@/screens/services/data`).
 * Il n'y a donc ni composant client ni JavaScript sur cette page — elle est rendue
 * sur le serveur. L'état arrivera avec l'API, au lot suivant.
 *
 * RÈGLE DURE (10 §2.2) : « Aucun versement avant visite ou vérification. Ne payez
 * jamais une réservation à distance. » est affiché en permanence. La maquette
 * l'écrit sur les deux cadres — le mobile l'abrège en « Aucun versement avant
 * visite. », et c'est elle qui abrège.
 *
 * RÈGLE DURE (14 §17) : l'encart partenaire ne vit QUE sur une étape de parcours
 * et « en pied de la section Logement ». Celui du bas de cette liste est donc le
 * seul de tout le module, ce que `e2e/services.spec.ts` vérifie dans les deux
 * sens.
 */
export default function LogementListePage() {
  return <ScreenFrames screen="S01" desktop={<S01Desktop />} mobile={<S01Mobile />} />;
}
