import { ScreenFrames } from '@/screens/frames';
import { S07Desktop } from '@/screens/s07/desktop.generated';
import { S07Mobile } from '@/screens/s07/mobile.generated';

/**
 * S07 — la fiche d'un professionnel (`/services/annuaire/:id`, 10 §4.3 et §4.4).
 *
 * Transcodé de `docs/template/06 Services.dc.html`. Voir `/services/logement/
 * page.tsx` pour le détail du procédé et la raison pour laquelle cette page n'a
 * pas d'état. L'identifiant de route n'est pas lu, comme sur S02.
 *
 * RÈGLE DURE (10 §4.1) : « le téléphone n'est JAMAIS stocké ici ni affiché ».
 * La maquette s'y tient sur les deux cadres — aucun numéro, et la méthode de
 * contact affichée sur S08 est « Messagerie de la plateforme ». Vérifié plutôt
 * que supposé, et figé par `e2e/services.spec.ts`.
 *
 * §4.4 : le quota de trois contacts pro par mois est écrit à l'écran, deux fois —
 * « Utilise 1 de vos 3 contacts du mois » sous le bouton d'ordinateur, et
 * « Contacter · 1/3 » sur le bouton mobile. C'est le serveur qui l'applique ; la
 * maquette ne fait que le dire, ce qui est exactement son rôle.
 *
 * « CONTACTER » EST INERTE : il consomme un des trois contacts du mois, et le
 * compteur vit côté serveur (§4.4). Aucune fenêtre n'est dessinée pour lui ici,
 * à la différence de S02.
 */
export default function FichePro() {
  return <ScreenFrames screen="S07" desktop={<S07Desktop />} mobile={<S07Mobile />} />;
}
