import { ScreenFrames } from '@/screens/frames';
import { D03Desktop } from '@/screens/d03/desktop.generated';

/**
 * D03 — La fiche membre (15 §3) : recherche, fiche, notes internes et actions avec motif.
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
  return <ScreenFrames screen="D03" desktop={<D03Desktop />} />;
}
