'use client';

import { chargerK04 } from '@/screens/compte/appels';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { K04Desktop } from '@/screens/k04/desktop.generated';
import { K04Mobile } from '@/screens/k04/mobile.generated';

/**
 * K04 — « Téléphones et sessions » (`/compte/securite`, 01 §2).
 *
 * 01 §2.1, RÈGLE DURE : **aucun numéro de téléphone en clair**, jamais, et
 * seulement un masque à son propriétaire.
 *
 * ── CE QUI A CHANGÉ, ET C'EST LE POINT LE PLUS IMPORTANT DE CE LOT ──────────
 *
 * La règle se tenait par le DESSIN : « +229 •• •• •• 42 » était écrit dans la
 * maquette, le transcodage ne réécrit rien, donc elle tenait par construction. Le
 * commentaire précédent de ce fichier le disait, et ajoutait : « il suffirait
 * qu'un lot branche l'API et interpole `user.phone` ».
 *
 * C'est ce lot. Les numéros viennent maintenant de l'API. La règle ne tient donc
 * PLUS par le dessin — elle tient par trois choses, et chacune est vérifiable :
 *
 *   1. le serveur n'envoie pas de numéro en clair : `phones[].masked` est le SEUL
 *      champ de numéro que `meResponseSchema` décrive ;
 *   2. la validation de réponse du socle DÉPOUILLE ce qui n'est pas au schéma : un
 *      `e164` ajouté un jour à la route n'atteindrait pas cet écran ;
 *   3. `e2e/compte.spec.ts` éprouve la règle À L'ÉCRAN, sur les DONNÉES RÉELLES de
 *      l'API et non plus sur celles de la maquette, et sur les deux cadres.
 *
 * ── LES SESSIONS ────────────────────────────────────────────────────────────
 *
 * `GET /auth/sessions`. La maquette dessine DEUX variantes de ligne — la session
 * courante avec sa pastille « Actuelle », les autres avec un bouton « Révoquer » —
 * et la boucle générée porte les deux, chacune sous sa condition. Aucune n'est
 * inventée : ce sont les deux planches que la maquette dessine.
 *
 * Pas d'adresse IP : §8.1 ne collecte aucune position plus fine que la ville, et
 * `authSessionsResponseSchema` ne la prévoit donc pas — « et la retirerait si elle
 * apparaissait ».
 *
 * LES DEUX CADRES NE DISENT PAS LA MÊME CHOSE du numéro principal, et c'est la
 * maquette : le cadre mobile écrit « Dernier numéro, non retirable » à sa droite —
 * ce que T5 K04 demande — là où le cadre d'ordinateur lui laisse un bouton
 * « Retirer ». L'écart est transcodé tel quel et signalé au porteur : le corriger
 * ici serait redessiner une des deux planches à sa place. Le cadre mobile n'est
 * donc pas lié — il n'y a pas de liste à y répéter, et ses deux masques restent
 * ceux de la maquette. Signalé aussi.
 */
export default function SecuritePage() {
  return (
    <EcranDonnees charger={chargerK04}>
      {(donnees) => (
        <ScreenFrames
          screen="K04"
          desktop={<K04Desktop {...donnees} />}
          mobile={<K04Mobile {...donnees} />}
        />
      )}
    </EcranDonnees>
  );
}
