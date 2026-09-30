'use client';

import { EcranServices, useServices } from '@/screens/services/ecran';
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
 * de lot.
 *
 * « CONTINUER » ET « RECOMMANDER » SONT INERTES. Le premier fait sortir de la
 * plateforme, le second écrit un avis sur un autre membre et notifie l'auteur de
 * l'offre (§3.3). Aucune route n'est branchée dans ce lot ; un bouton qui
 * refermerait la fenêtre ferait croire à une action qui n'a pas eu lieu.
 */
export function OffreEcran() {
  const { ouverte, onOuvrir, onFermer } = useServices();

  return (
    <EcranServices
      screen="S05"
      desktop={<S05Desktop />}
      mobile={<S05Mobile />}
      ouverte={ouverte}
      onOuvrir={onOuvrir}
      onFermer={onFermer}
      modales={{
        S05L: { mobile: <S05LienExterne /> },
        S05R: { mobile: <S05Recommander /> },
      }}
    />
  );
}
