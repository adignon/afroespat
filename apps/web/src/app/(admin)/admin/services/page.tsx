import { ScreenFrames } from '@/screens/frames';
import { D10Desktop } from '@/screens/d10/desktop.generated';

/**
 * D10 — Justificatifs pro à valider, annonces de logement à risque, bornes de prix (10 §4).
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
  return <ScreenFrames screen="D10" desktop={<D10Desktop />} />;
}
