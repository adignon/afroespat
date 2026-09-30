import { ScreenFrames } from '@/screens/frames';
import { S04Desktop } from '@/screens/s04/desktop.generated';
import { S04Mobile } from '@/screens/s04/mobile.generated';

/**
 * S04 — Bourses et emploi, la liste (`/services/emploi`, 10 §3).
 *
 * Transcodé de `docs/template/06 Services.dc.html`. Voir `/services/logement/
 * page.tsx` pour le détail du procédé et la raison pour laquelle cette page n'a
 * pas d'état.
 *
 * 10 §3.1 : la pastille « Sponsorisée » est TOUJOURS VISIBLE, et une offre
 * sponsorisée n'occupe jamais plus de deux emplacements de tête. La maquette
 * dessine une seule offre sponsorisée, en tête, pastille comprise, sur les deux
 * cadres — les deux moitiés de la règle sont donc vérifiables à l'écran, et
 * `e2e/services.spec.ts` les fige.
 */
export default function EmploiListePage() {
  return <ScreenFrames screen="S04" desktop={<S04Desktop />} mobile={<S04Mobile />} />;
}
