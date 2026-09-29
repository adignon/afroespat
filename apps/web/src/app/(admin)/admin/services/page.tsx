import { ScreenFrames } from '@/screens/frames';
import { D10Desktop } from '@/screens/d10/desktop.generated';

/**
 * D10 — les services. `/admin/services` (T5 D10).
 *
 * Trois blocs : justificatifs pro en attente (approuver / rejeter avec motif),
 * annonces logement à risque, et les bornes de prix par ville.
 *
 * LES ANNONCES À RISQUE portent leur score et leurs drapeaux — « Score 82 · prix
 * bas · compte récent · photos réutilisées ». 13 §4.4 fixe les seuils : « annonce
 * logement à risque, score 0,4–0,7 → dossier priorité 2 ; ≥ 0,7 → priorité 1 + non
 * publiée ». La maquette montre un 82 et un 61, c'est-à-dire un cas de chaque côté
 * du seuil — et les deux gardent pourtant « Publier » et « Retirer » : la décision
 * reste humaine (13 §2, règle dure).
 *
 * LES BORNES DE PRIX sont un paramètre système (15 §4.4, « bornes de prix
 * logement »), modifiable sans déploiement. Le tableau les dessine par ville et
 * par type de bien.
 */
export default function Page() {
  return <ScreenFrames screen="D10" desktop={<D10Desktop />} />;
}
