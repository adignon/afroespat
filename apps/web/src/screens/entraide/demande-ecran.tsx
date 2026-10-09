'use client';

import { useCallback } from 'react';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { SQUELETTE_H02, chargerH02 } from '@/screens/entraide/appels';
import { ScreenFrames } from '@/screens/frames';
import { H02Desktop } from '@/screens/h02/desktop.generated';
import { H02Mobile } from '@/screens/h02/mobile.generated';

/**
 * H02 — une demande d'entraide en détail, chargée depuis `GET /help/:id`.
 *
 * L'IDENTIFIANT VIENT DE LA ROUTE, et c'est lui qui décide de l'appel. Le
 * commentaire de `page.tsx` disait : « L'identifiant de route n'est pas lu : la
 * maquette montre UNE demande, écrite en clair. Le brancher sur `:id` sans API
 * afficherait la même demande pour tous les identifiants. » Ce lot a rendu ces
 * littéraux interpolables, par déclaration et sans toucher à la maquette.
 *
 * `charger` EST UN `useCallback` MÉMOÏSÉ SUR L'IDENTIFIANT, et il doit l'être :
 * `EcranDonnees` met `charger` dans les dépendances de son effet. Une fonction
 * anonyme recréée à chaque rendu rechargerait en boucle — c'est la propriété que
 * `ecran-donnees.tsx` a choisi de rendre VISIBLE plutôt que de masquer, parce
 * qu'une boucle se voit tout de suite et un rechargement manqué ne se voit jamais.
 *
 * `404` N'EST PAS TRAITÉ COMME UNE ABSENCE, et c'est la règle dure du module vue
 * depuis l'écran. Cette route répond `404` quand la demande n'existe pas ET quand un
 * BLOCAGE sépare les deux membres (§4 : « 404 et jamais 403 »). Les deux veulent
 * dire la même chose au lecteur — « cette page n'existe pas pour vous » — et
 * `displayMessageFor` le dit. Un écran vide à la place ferait croire à une demande
 * sans réponses, c'est-à-dire apprendrait au membre qu'on lui cache quelque chose.
 */
export function DemandeEcran({ id }: { readonly id: string }) {
  const charger = useCallback(() => chargerH02(id), [id]);

  return (
    <EcranDonnees
      /*
       * LE CADRE EST SERVI AVANT LA DONNEE : sans squelette, cette route repond 200
       * en servant « DisaporyPlus Chargement de votre compte... » et rien d'autre.
       * Voir `screens/compte/ecran-donnees.tsx`.
       */
      squelette={SQUELETTE_H02} charger={charger}>
      {(donnees) => (
        <ScreenFrames
          screen="H02"
          desktop={<H02Desktop {...donnees} />}
          mobile={<H02Mobile {...donnees} />}
        />
      )}
    </EcranDonnees>
  );
}
