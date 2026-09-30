import { ScreenFrames } from '@/screens/frames';
import { S08Desktop } from '@/screens/s08/desktop.generated';
import { S08Mobile } from '@/screens/s08/mobile.generated';

/**
 * S08 — créer ma fiche pro (`/services/annuaire/ma-fiche`, 10 §4.1).
 *
 * Transcodé de `docs/template/06 Services.dc.html`. Voir `/services/logement/
 * page.tsx` pour le détail du procédé et la raison pour laquelle cette page n'a
 * pas d'état.
 *
 * La maquette porte les conditions de §4.1 à l'écran, en toutes lettres :
 * « Numéro français vérifié (L2) » et « Justificatif professionnel à déposer ».
 * Elle ajoute, sous le dépôt du justificatif, « Il n'est jamais affiché » —
 * l'exigence de §4.1 (« accès équipe uniquement ») dite au membre.
 *
 * « ENVOYER POUR VALIDATION » EST INERTE : la fiche attend une validation humaine
 * (§4.1, module 15) et reste invisible jusque-là. Rien n'est branché dans ce lot.
 *
 * ⚠ ÉCART DE LA MAQUETTE, SIGNALÉ ET NON CORRIGÉ : elle affiche « Pro 9 €/mois »
 * et « Pro+ 19 €/mois » là où 10 §4.1 et 14 §2 écrivent « ~25 € » et « ~40 € ».
 * On ne réécrit pas la maquette, et on ne réécrit pas non plus la spec : l'écart
 * est consigné dans le rapport de lot pour que le porteur tranche.
 */
export default function MaFicheProPage() {
  return <ScreenFrames screen="S08" desktop={<S08Desktop />} mobile={<S08Mobile />} />;
}
