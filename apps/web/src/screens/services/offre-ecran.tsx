'use client';

import { useCallback } from 'react';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { EcranServices, useServices } from '@/screens/services/ecran';
import { SQUELETTE_S05, chargerS05 } from '@/screens/services/appels';
import { S05Desktop } from '@/screens/s05/desktop.generated';
import { S05Mobile } from '@/screens/s05/mobile.generated';
import { S05LienExterne } from '@/screens/s05lien/lienexterne.generated';
import { S05Recommander } from '@/screens/s05recommander/recommander.generated';

/**
 * S05 — une offre d'emploi, ses deux fenêtres, et le formulaire de publication.
 *
 * LES DEUX FENÊTRES SONT CELLES DE LA MAQUETTE, planches « LIEN EXTERNE » et
 * « RECOMMANDER », chacune avec sa croix de fermeture :
 *
 *   · « Vous quittez la plateforme » — l'interstitiel du lien de candidature.
 *     Il porte l'avertissement de §3.1 sur les arnaques à l'emploi : « Ne
 *     communiquez jamais de coordonnées bancaires pour une candidature. »
 *   · « Recommander un membre » (§3.3) — recherche d'un membre et commentaire.
 *
 * Chacune n'a qu'UNE planche, de 440 px : la maquette ne les dessine pas en
 * mobile. On ne leur en invente pas une — la même fenêtre sert aux deux largeurs,
 * ce que `Modal` prévoit dans son type, et le manque est consigné dans le rapport
 * de lot. Elles ne consomment AUCUNE donnée : un interstitiel de texte et un
 * formulaire vide.
 *
 * LE LIEN DE L'INTERSTITIEL N'EST PAS AFFICHÉ DANS LA FENÊTRE, et c'est la
 * maquette : elle écrit l'avertissement, pas l'URL. `offre.lien` vient pourtant de
 * `externalUrl` et alimente le champ « Lien de candidature » du formulaire de
 * publication, que la même planche dessine. Écart consigné plutôt que comblé.
 *
 * « CONTINUER » ET « RECOMMANDER » SONT INERTES. Le premier fait sortir de la
 * plateforme, le second écrit un avis sur un autre membre et notifie l'auteur de
 * l'offre (§3.3). Aucune route n'est branchée dans ce lot ; un bouton qui
 * refermerait la fenêtre ferait croire à une action qui n'a pas eu lieu.
 *
 * `useCallback` SUR L'IDENTIFIANT : `EcranDonnees` déclare `charger` dans les
 * dépendances de son effet, délibérément. Une fonction anonyme rechargerait en
 * boucle, et c'est une propriété qu'on veut visible plutôt que masquée.
 */
export function OffreEcran({ id }: { readonly id: string }) {
  const { ouverte, onOuvrir, onFermer } = useServices();
  const charger = useCallback(() => chargerS05(id), [id]);

  return (
    <EcranDonnees
      /*
       * LE CADRE EST SERVI AVANT LA DONNEE : sans squelette, cette route repond 200
       * en servant cinq mots et aucune entree de rail. Voir
       * `screens/compte/ecran-donnees.tsx`.
       */
      squelette={SQUELETTE_S05} charger={charger} attente="Chargement de l’offre…">
      {(donnees) => (
        <EcranServices
          screen="S05"
          desktop={<S05Desktop {...donnees} />}
          mobile={<S05Mobile {...donnees} />}
          ouverte={ouverte}
          onOuvrir={onOuvrir}
          onFermer={onFermer}
          modales={{
            /**
             * L'INTERSTITIEL NOMME LE DOMAINE OÙ IL ENVOIE, donc il lit l'offre :
             * « vous allez sur arvel.fr » doit être l'hôte de `externalUrl` et pas
             * celui de la maquette, sans quoi la seule fenêtre de mise en garde du
             * module est aussi la seule à mentir.
             */
            S05L: { mobile: <S05LienExterne {...donnees} /> },
            S05R: { mobile: <S05Recommander /> },
          }}
        />
      )}
    </EcranDonnees>
  );
}
