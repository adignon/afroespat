'use client';

import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { SQUELETTE_S09, chargerS09 } from '@/screens/services/appels';
import { S09Desktop } from '@/screens/s09/desktop.generated';
import { S09Mobile } from '@/screens/s09/mobile.generated';

/**
 * S09 — mes annonces (`/services/mes-annonces`, 10 §7).
 *
 * Transcodé de `docs/template/06 Services.dc.html`. Voir `/services/logement/
 * page.tsx` pour le détail du procédé.
 *
 * DEUX ROUTES : `GET /housing?scope=mine` et `GET /jobs?scope=mine`. `scope=mine`
 * est exactement ce que `housingQuerySchema` prévoit pour cet écran — « l'auteur y
 * voit aussi ses annonces en pause », ce que la liste publique masque.
 *
 * RÈGLE DURE (00 §49) : « Aucun compteur de vues n'est exposé à personne, sur
 * aucun contenu. »
 *
 * DEUX DOCUMENTS SE CONTREDISENT ICI, et la maquette tranche. `T5 S09` demande
 * « compteur de vues et contacts » ; la règle dure l'interdit. La maquette écrit
 * dans sa propre légende de route « /services/mes-annonces · AUCUN COMPTEUR DE
 * VUES » et n'affiche que « 6 contacts ». C'est cet arbitrage qui est transcodé,
 * et `e2e/services.spec.ts` le fige sur les deux cadres.
 *
 * L'API TIENT LA MÊME LIGNE, et c'est maintenant vérifiable : le service
 * INCRÉMENTE bien `viewCount` à chaque lecture d'annonce — compteur interne de
 * modération — et aucune réponse ne le porte. `housingCardSchema` étant
 * `.strict()`, il serait REFUSÉ s'il sortait un jour, au lieu d'être dépouillé en
 * silence par zod.
 *
 * ÉCART SIGNALÉ AU PORTEUR : « 6 contacts », que la règle AUTORISE, n'existe dans
 * aucun champ de `HousingCard`. Le sous-titre porte donc l'expiration seule, qui
 * est une donnée réelle de la même réponse.
 *
 * LES PUCES D'ACTION SONT INERTES. Les routes existent — `POST /housing/:id/renew`,
 * `/pause`, `/resume`, `/taken`, `DELETE /housing/:id` — mais « Supprimer » retire
 * définitivement une annonce et la maquette ne dessine aucune confirmation. Un
 * clic qui supprimerait sans demander serait pire qu'une puce inerte.
 */
export default function MesAnnoncesPage() {
  return (
    <EcranDonnees
      charger={chargerS09}
      attente="Chargement
      de
      vos
      annonces…"
      /*
       * LE CADRE EST SERVI AVANT LA DONNÉE, et c'est MESURÉ : cette route
       * répondait 200 avec cinq mots et aucune entrée de rail dans le HTML
       * servi. Voir `screens/compte/ecran-donnees.tsx`.
       */
      squelette={SQUELETTE_S09}
    >
      {(donnees) => (
        <ScreenFrames
          screen="S09"
          desktop={<S09Desktop {...donnees} />}
          mobile={<S09Mobile {...donnees} />}
        />
      )}
    </EcranDonnees>
  );
}
