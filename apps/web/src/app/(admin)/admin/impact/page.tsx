import { ScreenFrames } from '@/screens/frames';
import { D16Desktop } from '@/screens/d16/desktop.generated';

/**
 * D16 — Le rapport d’impact (15 §5.3) : agrégé, jamais nominatif, exportable.
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
  return <ScreenFrames screen="D16" desktop={<D16Desktop />} />;
}
