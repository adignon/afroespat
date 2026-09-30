'use client';

import { EcranServices, useServices } from '@/screens/services/ecran';
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
 * CE QUI CHOISIT ENTRE LES DEUX, C'EST LE NIVEAU DU MEMBRE — et ce lot ne branche
 * aucune route, donc il ne le connaît pas. Le bouton « Contacter » ouvre la
 * feuille L1+, le cas courant ; `?niveau=l0` ouvre l'autre. Le paramètre
 * n'affirme rien et se teste, exactement comme `?paiement=` côté Compte et
 * `?etat=` côté Parcours.
 *
 * LA FEUILLE L0 EST `mobileOnly`, et ce n'est pas une économie : le cadre
 * d'ORDINATEUR porte déjà ce message en place, dans sa colonne de contexte
 * (planche « ÉTAT L0 · APRÈS “CONTACTER” »). Superposer la feuille par-dessus
 * l'afficherait deux fois.
 *
 * « ENVOYER » EST INERTE. Le message ouvre une conversation avec l'auteur de
 * l'annonce (§2.3) ; un `onClick` qui refermerait la feuille ferait croire au
 * membre que son message est parti. Même règle que « Publier » côté Parcours.
 */
export function AnnonceEcran({ niveau }: { readonly niveau: NiveauContact | null }) {
  const { ouverte, onOuvrir, onFermer } = useServices(niveau === 'l0' ? 'S02V' : null);

  return (
    <EcranServices
      screen="S02"
      desktop={<S02Desktop />}
      mobile={<S02Mobile />}
      ouverte={ouverte}
      onOuvrir={onOuvrir}
      onFermer={onFermer}
      modales={{
        S02C: { desktop: <S02DesktopContact />, mobile: <S02MobileContact /> },
        S02V: { mobile: <S02MobileVerification />, mobileOnly: true },
      }}
    />
  );
}
