'use client';

import { chargerK07 } from '@/screens/compte/appels';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { K07Desktop } from '@/screens/k07/desktop.generated';
import { K07Mobile } from '@/screens/k07/mobile.generated';

/**
 * K07 — « Réglages des notifications » (`/compte/notifications`, T5 §9).
 *
 * LES INTERRUPTEURS DE LA GRILLE RESTENT DESSINÉS, et c'est délibéré — comme avant
 * l'API, mais la raison a changé et il faut la dire exactement.
 *
 * Avant, c'était parce que la maquette ne fournissait aucun état. Maintenant l'état
 * EXISTE : `GET /me/notification-preferences` rend, par catégorie, ce que chaque
 * canal permet (`available`), ce que le membre a choisi (`enabled`) et ce que le
 * serveur interdit de changer (`locked`, la règle dure du 12 §2.1 —
 * « Sécurité et compte » n'est pas désactivable). Ce qui manque, c'est une ANCRE :
 * la maquette dessine les cases de deux catégories à l'identique, au caractère
 * près. Rien ne distingue « Mon parcours · push » de « Messages · push », et lier
 * au hasard est exactement le défaut que le compteur `fois` du générateur existe
 * pour empêcher. Remonté au porteur : il faudrait que la maquette distingue ses
 * cases pour qu'on puisse les lier sans deviner.
 *
 * CE QUI EST LIÉ l'est complètement : l'adresse email, la plage des heures calmes —
 * les BORNES RÉELLES du membre, pas les 22 h – 8 h par défaut — et l'état du résumé
 * hebdomadaire.
 *
 * ÉCART SIGNALÉ : la planche écrit l'adresse (« Email · amina.d@mail.com ») et
 * aucune route du domaine membre ne la rend. `emailAvailable` dit seulement qu'une
 * adresse vérifiée existe ; l'écran écrit donc ce qui est vrai, et rien de plus.
 */
export default function NotificationsPage() {
  return (
    <EcranDonnees charger={chargerK07}>
      {(donnees) => (
        <ScreenFrames
          screen="K07"
          desktop={<K07Desktop {...donnees} />}
          mobile={<K07Mobile {...donnees} />}
        />
      )}
    </EcranDonnees>
  );
}
