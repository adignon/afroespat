'use client';

import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { SQUELETTE_S10, chargerS10 } from '@/screens/services/appels';
import { S10Desktop } from '@/screens/s10/desktop.generated';
import { S10Mobile } from '@/screens/s10/mobile.generated';

/**
 * S10 — mes alertes (`/services/alertes`, 10 §2.4).
 *
 * Transcodé de `docs/template/06 Services.dc.html`. Voir `/services/logement/
 * page.tsx` pour le détail du procédé.
 *
 * LA ROUTE EST `GET /me/alerts`, ET ELLE VIT DANS `housing.controller.ts`. Il
 * n'existe PAS de module `apps/api/src/modules/alerts` : §2.4 définit l'alerte
 * avec la recherche de logement, et la même table sert les deux kinds (`HOUSING`,
 * `JOB`). Chercher le dossier plutôt que le contrôleur fait chercher une route
 * absente — c'est consigné ici parce que cela a coûté une recherche.
 *
 * Sa capacité est `content.read`, et non une capacité d'alerte : une alerte est
 * une RECHERCHE MÉMORISÉE, qui ne publie rien, n'expose rien à personne et n'exige
 * donc aucun niveau. Sa barrière est le PLAN (§2.4, Premium), que le service
 * applique et que `meta.isPremium` dit à l'écran.
 *
 * Les alertes enregistrées SONT réservées à Premium, et c'est le seul endroit du
 * module où un plan conditionne une fonction. La maquette le dit sans fermer le
 * reste : « Réservées à Premium, le reste des Services reste gratuit. » — ce qui
 * est exactement la frontière que 14 §2 trace, l'entraide, les guides, le
 * parrainage et les réseaux restant hors de tout paiement.
 *
 * L'ENCART « SANS PREMIUM » DISPARAÎT POUR UN MEMBRE PREMIUM, et c'est le serveur
 * qui en décide (`meta.isPremium`). Relire `users.plan` dans le front se
 * tromperait le jour où un essai, une grâce Mobile Money ou un plan Pro change la
 * réponse.
 *
 * LE FORMULAIRE « NOUVELLE ALERTE » N'EST PAS LIÉ : ses champs sont des exemples
 * de saisie, pas les critères d'un objet existant. « Enregistrer l'alerte » est
 * inerte — `POST /me/alerts` répond `422 PLAN_REQUIRED` à un membre gratuit, et
 * la maquette ne dessine pas cet état.
 */
export default function AlertesPage() {
  return (
    <EcranDonnees
      charger={chargerS10}
      attente="Chargement
      de
      vos
      alertes…"
      /*
       * LE CADRE EST SERVI AVANT LA DONNÉE, et c'est MESURÉ : cette route
       * répondait 200 avec cinq mots et aucune entrée de rail dans le HTML
       * servi. Voir `screens/compte/ecran-donnees.tsx`.
       */
      squelette={SQUELETTE_S10}
    >
      {(donnees) => (
        <ScreenFrames
          screen="S10"
          desktop={<S10Desktop {...donnees} />}
          mobile={<S10Mobile {...donnees} />}
        />
      )}
    </EcranDonnees>
  );
}
