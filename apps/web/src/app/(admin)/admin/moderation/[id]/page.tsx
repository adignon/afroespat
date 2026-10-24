import { ScreenFrames } from '@/screens/frames';
import { D05Desktop } from '@/screens/d05/desktop.generated';

/**
 * D05 — Le dossier d’un signalement (13 §4.2) : le contenu, le contexte, les actions avec motif.
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
  return <ScreenFrames screen="D05" desktop={<D05Desktop />} />;
}
