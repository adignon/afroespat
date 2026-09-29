import { ScreenFrames } from '@/screens/frames';
import { K10Desktop } from '@/screens/k10/desktop.generated';
import { K10Mobile } from '@/screens/k10/mobile.generated';

/**
 * K10 — « Enregistrés » (`/compte/enregistres`, T5 §9).
 *
 * Le JSX vient du TRANSCODAGE de `docs/template/08 Compte.dc.html`. Rien n'est
 * réécrit ; la page ne fait que servir les deux cadres de la maquette.
 *
 * T5 K10 : « Aucun compteur public, aucune notion de partage. » La planche tient
 * la règle par le dessin — le seul compteur est « 14 enregistrés », qui est celui
 * du membre, et aucune carte ne porte de bouton de partage. Vérifié, pas supposé.
 *
 * L'ÉTAT VIDE N'EST PAS LIVRÉ, et il faut le dire : la maquette le dessine bien
 * (« Vous n'avez rien enregistré »), mais dans une planche de DOCUMENTATION de
 * 320 px intitulée « ÉTATS », qui porte sa légende « VIDE » à l'intérieur du
 * cadre. Ce n'est pas un cadre d'écran : l'extraire produirait une page dont le
 * titre serait le mot « ÉTATS ». Il est signalé au porteur plutôt que monté à
 * moitié.
 */
export default function EnregistresPage() {
  return <ScreenFrames screen="K10" desktop={<K10Desktop />} mobile={<K10Mobile />} />;
}
