import { ScreenFrames } from '@/screens/frames';
import { S09Desktop } from '@/screens/s09/desktop.generated';
import { S09Mobile } from '@/screens/s09/mobile.generated';

/**
 * S09 — mes annonces (`/services/mes-annonces`, 10 §7).
 *
 * Transcodé de `docs/template/06 Services.dc.html`. Voir `/services/logement/
 * page.tsx` pour le détail du procédé et la raison pour laquelle cette page n'a
 * pas d'état.
 *
 * RÈGLE DURE (00 §49) : « Aucun compteur de vues n'est exposé à personne, sur
 * aucun contenu. »
 *
 * DEUX DOCUMENTS SE CONTREDISENT ICI, et la maquette tranche. `T5 S09` demande
 * « compteur de vues et contacts » ; la règle dure l'interdit. La maquette écrit
 * dans sa propre légende de route « /services/mes-annonces · AUCUN COMPTEUR DE
 * VUES » et n'affiche que « 6 contacts ». C'est cet arbitrage qui est transcodé,
 * et `e2e/services.spec.ts` le fige sur les deux cadres.
 */
export default function MesAnnoncesPage() {
  return <ScreenFrames screen="S09" desktop={<S09Desktop />} mobile={<S09Mobile />} />;
}
