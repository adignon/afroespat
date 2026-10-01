'use client';

import { useCallback } from 'react';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { EcranServices, useServices } from '@/screens/services/ecran';
import { chargerS02 } from '@/screens/services/appels';
import type { NiveauContact } from '@/screens/services/data';
import { S02Desktop } from '@/screens/s02/desktop.generated';
import { S02Mobile } from '@/screens/s02/mobile.generated';
import { S02DesktopContact } from '@/screens/s02contact/desktopcontact.generated';
import { S02MobileContact } from '@/screens/s02contact/mobilecontact.generated';
import { S02MobileVerification } from '@/screens/s02verification/mobileverification.generated';

/**
 * S02 — une annonce de logement, et les deux états de « Contacter » (10 §2.3).
 *
 * LA MAQUETTE DESSINE DEUX FEUILLES, et elle les nomme elle-même :
 *
 *   · « MOBILE · L1+ » — la feuille « Présentez-vous », pré-remplie depuis le
 *     parcours, avec le rappel « Aucun versement avant visite » juste au-dessus
 *     du bouton d'envoi. Elle a AUSSI une planche d'ordinateur, de 480 px.
 *   · « MOBILE · L0 » — « Contacter demande une identité vérifiée », avec
 *     « Vérifier mon identité » et « Ou demandez à un parrain de visiter pour
 *     vous ». C'est mot pour mot ce que §2.3 exige de l'interface.
 *
 * CE QUI CHOISIT ENTRE LES DEUX, C'EST LE NIVEAU DU MEMBRE — ET ON NE LE LIT PAS.
 * La règle du socle est sans exception : on tente l'action, et le serveur répond
 * `403 LEVEL_REQUIRED` avec de quoi afficher l'invitation du §7.3. Or ce lot ne
 * branche AUCUN bouton de contact : il n'y a donc pas d'action à tenter, et lire
 * le niveau de `GET /me` pour choisir la feuille aurait été exactement l'interdit
 * — une décision d'autorisation prise dans le front. Le bouton « Contacter » ouvre
 * la feuille L1+, le cas courant ; `?niveau=l0` ouvre l'autre. Le paramètre
 * n'affirme rien et se teste, comme `?paiement=` côté Compte.
 *
 * LA FEUILLE L0 EST `mobileOnly`, et ce n'est pas une économie : le cadre
 * d'ORDINATEUR porte déjà ce message en place, dans sa colonne de contexte
 * (planche « ÉTAT L0 · APRÈS “CONTACTER” »). Superposer la feuille par-dessus
 * l'afficherait deux fois.
 *
 * « ENVOYER » EST INERTE. Le message ouvre une conversation avec l'auteur de
 * l'annonce (§2.3) ; un `onClick` qui refermerait la feuille ferait croire au
 * membre que son message est parti. Même règle que « Publier » côté Parcours.
 *
 * `useCallback` SUR L'IDENTIFIANT, et il est obligatoire : `EcranDonnees` déclare
 * `charger` dans les dépendances de son effet — délibérément, pour qu'un appelant
 * qui changerait de cible recharge. Une fonction anonyme rechargerait en boucle,
 * et c'est une propriété qu'on veut VISIBLE plutôt que masquée.
 */
export function AnnonceEcran({
  id,
  niveau,
}: {
  readonly id: string;
  readonly niveau: NiveauContact | null;
}) {
  const { ouverte, onOuvrir, onFermer } = useServices(niveau === 'l0' ? 'S02V' : null);
  const charger = useCallback(() => chargerS02(id), [id]);

  return (
    <EcranDonnees charger={charger} attente="Chargement de l’annonce…">
      {(donnees) => (
        <EcranServices
          screen="S02"
          desktop={<S02Desktop {...donnees} />}
          mobile={<S02Mobile {...donnees} />}
          ouverte={ouverte}
          onOuvrir={onOuvrir}
          onFermer={onFermer}
          modales={{
            S02C: { desktop: <S02DesktopContact />, mobile: <S02MobileContact /> },
            S02V: { mobile: <S02MobileVerification />, mobileOnly: true },
          }}
        />
      )}
    </EcranDonnees>
  );
}
