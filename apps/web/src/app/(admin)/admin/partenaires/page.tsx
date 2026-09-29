import { ScreenFrames } from '@/screens/frames';
import { D13Desktop } from '@/screens/d13/desktop.generated';

/**
 * D13 — les partenaires et leurs placements. `/admin/partenaires` (T5 D13).
 *
 * Le tableau des partenaires (modèle CPA / CPL, contrat, clics, conversions,
 * revenus) et la grille des placements ÉTAPE × PAYS.
 *
 * LA RÈGLE EST ÉCRITE SOUS LA GRILLE : « un seul encart par étape et par pays :
 * l'ajout est refusé si un placement actif existe. » C'est ce que la grille rend
 * lisible d'un coup d'œil — une case, un partenaire, ou un tiret.
 */
export default function Page() {
  return <ScreenFrames screen="D13" desktop={<D13Desktop />} />;
}
