import { ScreenFrames } from '@/screens/frames';
import { D09Desktop } from '@/screens/d09/desktop.generated';

/**
 * D09 — Les guides côté équipe (05 §4) : propositions escaladées, signalés obsolètes, statut, retour arrière.
 *
 * Le châssis (rail, titre, emplacement) est celui de la maquette transcodée ; la zone de
 * contenu et la barre haute sont posées par l'adaptation `administration-vivante`
 * (`tools/adaptations/administration-vivante.mjs`) : composants vivants, lecture ET
 * écriture réelles. La session d'équipe est gardée par `(admin)/layout.tsx`.
 *
 * Aucun cadre mobile n'est dessiné par la maquette : `admin.css` empile le rail sous
 * 1 024 px.
 */
export default function Page() {
  return <ScreenFrames screen="D09" desktop={<D09Desktop />} />;
}
