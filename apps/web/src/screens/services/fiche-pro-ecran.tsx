'use client';

import { useCallback } from 'react';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { chargerS07 } from '@/screens/services/appels';
import { S07Desktop } from '@/screens/s07/desktop.generated';
import { S07Mobile } from '@/screens/s07/mobile.generated';

/**
 * S07 — la fiche d'un professionnel (`/services/annuaire/:id`, 10 §4.3 et §4.4).
 *
 * UN COMPOSANT CLIENT À PART de la page, et pour la raison que `/services/
 * logement/[id]/page.tsx` détaille : la page reste un composant SERVEUR qui lit
 * le paramètre de route, et c'est l'écran qui appelle l'API. `useSearchParams()`
 * dans la page aurait forcé un rendu client du document servi.
 *
 * `useCallback` SUR L'IDENTIFIANT, et il est obligatoire : `EcranDonnees` déclare
 * `charger` dans les dépendances de son effet — délibérément, pour qu'un appelant
 * qui change de cible recharge. Une fonction anonyme rechargerait en boucle, et
 * c'est une propriété qu'on veut VISIBLE plutôt que masquée.
 *
 * RÈGLE DURE (10 §4.1) : « le téléphone n'est JAMAIS stocké ici ni affiché ».
 * Rien n'est filtré dans cet écran, et c'est le point — il n'y a RIEN À FILTRER.
 * `proDetailResponseSchema` ne décrit aucun champ de numéro, et son `.strict()`
 * refuse la réponse qui en porterait un. La règle ne dépend donc pas de la
 * vigilance de celui qui écrit la prochaine ligne de ce fichier.
 *
 * §4.4 : le quota de trois contacts pro par mois est écrit à l'écran, deux fois —
 * « Utilise 1 de vos 3 contacts du mois » sous le bouton d'ordinateur, et
 * « Contacter · 1/3 » sur le bouton mobile. Les deux viennent de `contactQuota`,
 * que le SERVEUR calcule : le recalculer ici demanderait de relire le plan du
 * membre, ce que le socle interdit, et afficherait « 1/3 » à un Premium illimité.
 *
 * « CONTACTER » EST INERTE : il consomme un des trois contacts du mois (§4.4), et
 * le compteur vit côté serveur. Aucune fenêtre n'est dessinée pour lui ici, à la
 * différence de S02.
 */
export function FicheProEcran({ id }: { readonly id: string }) {
  const charger = useCallback(() => chargerS07(id), [id]);

  return (
    <EcranDonnees charger={charger} attente="Chargement de la fiche…">
      {(donnees) => (
        <ScreenFrames
          screen="S07"
          desktop={<S07Desktop {...donnees} />}
          mobile={<S07Mobile {...donnees} />}
        />
      )}
    </EcranDonnees>
  );
}
