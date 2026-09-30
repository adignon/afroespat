import { ScreenFrames } from '@/screens/frames';
import { S10Desktop } from '@/screens/s10/desktop.generated';
import { S10Mobile } from '@/screens/s10/mobile.generated';

/**
 * S10 — mes alertes (`/services/alertes`, 10 §2.4).
 *
 * Transcodé de `docs/template/06 Services.dc.html`. Voir `/services/logement/
 * page.tsx` pour le détail du procédé et la raison pour laquelle cette page n'a
 * pas d'état.
 *
 * Les alertes enregistrées SONT réservées à Premium (§2.4, `saved_alerts` kind
 * HOUSING), et c'est le seul endroit du module où un plan conditionne une
 * fonction. La maquette le dit sans fermer le reste : « Réservées à Premium, le
 * reste des Services reste gratuit. » — ce qui est exactement la frontière que
 * 14 §2 trace, l'entraide, les guides, le parrainage et les réseaux restant hors
 * de tout paiement.
 */
export default function AlertesPage() {
  return <ScreenFrames screen="S10" desktop={<S10Desktop />} mobile={<S10Mobile />} />;
}
