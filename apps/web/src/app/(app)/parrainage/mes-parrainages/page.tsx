'use client';

import { useChargeur } from '@/lib/entraide-recharge';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { SQUELETTE_H07, chargerH07 } from '@/screens/entraide/appels';
import { ScreenFrames } from '@/screens/frames';
import { H07Desktop } from '@/screens/h07/desktop.generated';
import { H07Mobile } from '@/screens/h07/mobile.generated';

/**
 * H07 — Mes parrainages (`/parrainage/mes-parrainages`, 06 §5).
 *
 * Transcodé de `docs/template/05 Entraide.dc.html`. Voir `/entraide/page.tsx` pour
 * le procédé et la raison pour laquelle ces écrans sont des composants CLIENT.
 *
 * LES TROIS BLOCS SONT TROIS CARTES DE FORMES DIFFÉRENTES — en cours, terminé, en
 * attente — et le troisième dessine DEUX variantes selon le sens de la demande :
 * « Accepter / Refuser » pour celle qu'on reçoit, « En attente » pour celle qu'on a
 * envoyée. Les lier demande les variantes des trois formes, pas d'en choisir une.
 * Remonté.
 *
 * CE QUE L'API DONNE DÉJÀ, et qui attend sa liaison : `GET /me/mentorships` rend le
 * rôle, l'état, la date de fin, l'identifiant de conversation et les deux
 * évaluations. Son `other` est `null` DÈS QU'UN BLOCAGE SÉPARE les deux membres —
 * le parrainage reste listé, sans nom ni pseudo ni identifiant. C'est la forme du
 * blocage, et `myMentorshipsResponseSchema` l'accepte exprès : un schéma qui
 * exigerait `other` ferait échouer la page ENTIÈRE au premier blocage.
 */
export default function MyMentorshipsPage() {
  const charger = useChargeur(chargerH07);
  return (
    <EcranDonnees
      charger={charger}
      /*
       * LE CADRE EST SERVI AVANT LA DONNÉE, et c'est MESURÉ : cette route
       * répondait 200 avec cinq mots — « DisaporyPlus Chargement de votre
       * compte… » — et aucune entrée de rail dans le HTML servi. Voir
       * `screens/compte/ecran-donnees.tsx` pour le raisonnement complet.
       */
      squelette={SQUELETTE_H07}
    >
      {(donnees) => (
        <ScreenFrames
          screen="H07"
          desktop={<H07Desktop {...donnees} />}
          mobile={<H07Mobile {...donnees} />}
        />
      )}
    </EcranDonnees>
  );
}
