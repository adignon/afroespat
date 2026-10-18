'use client';

import { useChargeur } from '@/lib/entraide-recharge';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { SQUELETTE_H08, chargerH08 } from '@/screens/entraide/appels';
import { ScreenFrames } from '@/screens/frames';
import { H08Desktop } from '@/screens/h08/desktop.generated';
import { H08Mobile } from '@/screens/h08/mobile.generated';

/**
 * H08 — Devenir parrain (`/parrainage/devenir`, 06 §5).
 *
 * Transcodé de `docs/template/05 Entraide.dc.html`. Voir `/entraide/page.tsx` pour
 * le procédé et la raison pour laquelle ces écrans sont des composants CLIENT.
 *
 * LES TROIS CONDITIONS SONT DU TEXTE DE RÈGLE (§2.1), vraies pour tout le monde,
 * et elles ne sont pas liées : AUCUNE route ne dit LESQUELLES manquent au membre.
 * `PUT /me/mentor-profile` répond `MENTOR_NOT_ELIGIBLE` sans détail — mesuré en
 * appelant. Dessiner trois pastilles d'état demanderait d'inventer ce diagnostic.
 * Écart remonté.
 *
 * « Activer mon profil de parrain » est INERTE : devenir parrain fait apparaître le
 * membre dans une liste publique où d'autres lui écriront.
 */
export default function BecomeMentorPage() {
  const charger = useChargeur(chargerH08);
  return (
    <EcranDonnees
      charger={charger}
      /*
       * LE CADRE EST SERVI AVANT LA DONNÉE, et c'est MESURÉ : cette route
       * répondait 200 avec cinq mots — « DisaporyPlus Chargement de votre
       * compte… » — et aucune entrée de rail dans le HTML servi. Voir
       * `screens/compte/ecran-donnees.tsx` pour le raisonnement complet.
       */
      squelette={SQUELETTE_H08}
    >
      {(donnees) => (
        <ScreenFrames
          screen="H08"
          desktop={<H08Desktop {...donnees} />}
          mobile={<H08Mobile {...donnees} />}
        />
      )}
    </EcranDonnees>
  );
}
