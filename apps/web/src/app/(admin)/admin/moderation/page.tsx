import { ScreenFrames } from '@/screens/frames';
import { D04Desktop } from '@/screens/d04/desktop.generated';

/**
 * D04 — La file de modération (13 §4.1), paginée, qui mène au dossier (D05).
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
  return <ScreenFrames screen="D04" desktop={<D04Desktop />} />;
}
