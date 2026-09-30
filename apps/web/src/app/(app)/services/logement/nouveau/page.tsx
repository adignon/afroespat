import { ScreenFrames } from '@/screens/frames';
import { S03Desktop } from '@/screens/s03/desktop.generated';
import { S03Mobile } from '@/screens/s03/mobile.generated';

/**
 * S03 — publier une annonce de logement (`/services/logement/nouveau`, 10 §2.1).
 *
 * Transcodé de `docs/template/06 Services.dc.html`. Voir `/services/logement/
 * page.tsx` pour le détail du procédé et la raison pour laquelle cette page n'a
 * pas d'état.
 *
 * 10 §7 : « aperçu du score de risque NON AFFICHÉ (interne) ». La maquette s'y
 * tient — aucun chiffre de risque nulle part, seulement « Votre annonce est en
 * vérification. Vous serez prévenu·e. » dans sa colonne APRÈS ENVOI. Vérifié
 * plutôt que supposé, et figé par `e2e/services.spec.ts`.
 *
 * « PUBLIER L'ANNONCE » EST INERTE, et c'est la décision la plus importante de
 * cet écran. §2.2 calcule un score de risque côté serveur et ne publie jamais une
 * annonce à score ≥ 0,7 sans décision humaine. Un `onClick` qui refermerait le
 * formulaire ferait croire au membre que son annonce est en ligne — c'est pire
 * qu'un bouton inerte, et c'est exactement ce que la règle dure cherche à
 * empêcher.
 *
 * CE QUE LA MAQUETTE NE DESSINE PAS : le formulaire GRISÉ d'un membre L1, que
 * §2.1 décrit avec sa phrase exacte. Elle l'écrit dans une carte d'ÉTATS de la
 * section S01 (« PUBLIER · SOUS L2 »), pas dans un cadre d'écran. Il n'a donc pas
 * été monté ici : le faire demanderait de décider où il s'insère, et la maquette
 * ne le dit pas.
 */
export default function PublierLogementPage() {
  return <ScreenFrames screen="S03" desktop={<S03Desktop />} mobile={<S03Mobile />} />;
}
