import { ScreenFrames } from '@/screens/frames';
import { K09Desktop } from '@/screens/k09/desktop.generated';
import { K09Mobile } from '@/screens/k09/mobile.generated';

/**
 * K09 — « Sanctions » (`/compte/sanctions`, 13 §4).
 *
 * Le JSX vient du TRANSCODAGE de `docs/template/08 Compte.dc.html`. Rien n'est
 * réécrit ; la page ne fait que servir les deux cadres de la maquette.
 *
 * LA CONTESTATION N'EST PAS UNE FENÊTRE, et c'est la maquette qui le décide : la
 * planche d'ordinateur dessine la carte « CONTESTER · UNE SEULE FOIS » DANS la
 * page, avec son champ et son bouton, et ne lui donne aucune croix de fermeture —
 * la signature d'une fenêtre dans cette maquette. Le cadre mobile n'en dessine
 * pas du tout. On n'ouvre donc pas une fenêtre par-dessus une carte qui dit déjà
 * la même chose, et on n'en invente pas une là où il n'y en a pas.
 */
export default function SanctionsPage() {
  return <ScreenFrames screen="K09" desktop={<K09Desktop />} mobile={<K09Mobile />} />;
}
