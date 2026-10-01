'use client';

import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { chargerH07 } from '@/screens/entraide/appels';
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
  return (
    <EcranDonnees charger={chargerH07}>
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
