'use client';

import { chargerK09 } from '@/screens/compte/appels';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { K09Desktop } from '@/screens/k09/desktop.generated';
import { K09Mobile } from '@/screens/k09/mobile.generated';

/**
 * K09 — « Sanctions » (`/compte/sanctions`, 13 §4).
 *
 * LA CONTESTATION N'EST PAS UNE FENÊTRE, et c'est la maquette qui le décide : la
 * planche d'ordinateur dessine la carte « CONTESTER · UNE SEULE FOIS » DANS la
 * page, avec son champ et son bouton, et ne lui donne aucune croix de fermeture —
 * la signature d'une fenêtre dans cette maquette. Le cadre mobile n'en dessine pas
 * du tout. On n'ouvre donc pas une fenêtre par-dessus une carte qui dit déjà la
 * même chose.
 *
 * `active` ET `appealable` VIENNENT DU SERVEUR, et ne sont pas recalculés ici.
 * Comparer `endsAt` à l'horloge du navigateur afficherait « suspendu » à un membre
 * libre dès que sa machine est décalée ; et « contester une fois » (13 §4.3)
 * demande de savoir si une contestation a déjà été déposée, ce que seul le serveur
 * sait. Le bouton reste inerte : ce lot ne poste aucune contestation.
 *
 * AUCUNE SANCTION EST LE CAS NORMAL, et la carte le dit alors — un écran vide
 * serait plus inquiétant qu'informatif pour quelqu'un qui vient vérifier qu'il n'a
 * rien.
 */
export default function SanctionsPage() {
  return (
    <EcranDonnees charger={chargerK09}>
      {(donnees) => (
        <ScreenFrames
          screen="K09"
          desktop={<K09Desktop {...donnees} />}
          mobile={<K09Mobile {...donnees} />}
        />
      )}
    </EcranDonnees>
  );
}
