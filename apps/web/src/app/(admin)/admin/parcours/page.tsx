import { ScreenFrames } from '@/screens/frames';
import { D06Desktop } from '@/screens/d06/desktop.generated';

/**
 * D06 — Les modèles de parcours et leurs versions (03 §5.2) : composition, brouillon, publication.
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
  return <ScreenFrames screen="D06" desktop={<D06Desktop />} />;
}
