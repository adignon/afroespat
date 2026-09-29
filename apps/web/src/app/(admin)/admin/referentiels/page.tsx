import { ScreenFrames } from '@/screens/frames';
import { D08Desktop } from '@/screens/d08/desktop.generated';

/**
 * D08 — les référentiels. `/admin/referentiels` (02 §4.2, T5 D08).
 *
 * Onglets Pays · Villes · Langues · Compétences · Métiers, import CSV, et le
 * tableau des villes avec ses trois cas : une ville active (Lyon), une ville à
 * activer (Nantes) et un doublon à fusionner (Lyon 07).
 *
 * LA CONFIRMATION EST DANS LA PAGE, PAS DANS UNE FENÊTRE. La maquette dessine
 * « Activer Nantes ? » en carte de 440 px posée à côté du tableau, sans voile et
 * sans panneau. Elle n'est donc pas transcodée en modale : `Modal` attend
 * exactement un voile et un panneau, et lui en fabriquer un serait inventer une
 * forme que la maquette ne montre pas. C'est le même arbitrage que J08 sur
 * ordinateur, où la confirmation d'arrêt est une carte en ligne.
 *
 * Ce qu'elle annonce vient de 02 §4.2 : « un réseau de ville sera créé et les 190
 * membres y seront rattachés automatiquement ». L'écran le dit ; le back-end le
 * fait, dans `apps/api/src/modules/referentials`.
 */
export default function Page() {
  return <ScreenFrames screen="D08" desktop={<D08Desktop />} />;
}
