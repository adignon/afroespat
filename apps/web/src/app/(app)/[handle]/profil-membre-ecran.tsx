'use client';

import { useCallback, useState } from 'react';
import type { MemberContentType } from '@app/shared';
import { SQUELETTE_K02, chargerK02 } from '@/screens/compte/appels';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { EcranCompte, useCompte } from '@/screens/compte/ecran';
import { K02Desktop } from '@/screens/k02/desktop.generated';
import { K02Mobile } from '@/screens/k02/mobile.generated';
import { K02Ajout } from '@/screens/k02contact/ajout.generated';
import { ProfilContactVivant } from '@/screens/compte/profil-contact-vivant';

/**
 * K02 — le profil d'un autre membre, et la fenêtre « Ajouter aux contacts ».
 *
 * T5 K02 : « Ajouter aux contacts (avec motif) ». Le motif est le choix
 * Entraide · Parrainage · Rencontre · Réseau que la planche de 420 px dessine,
 * avec un message facultatif. Elle n'a pas de forme mobile dans la maquette : la
 * même fenêtre sert aux deux largeurs.
 *
 * DEUX BOUTONS L'OUVRENT, un par cadre : « Ajouter aux contacts » sur ordinateur
 * et « Ajouter » sur mobile, parce que la maquette raccourcit le libellé quand la
 * place manque. Le transcodeur marque les deux.
 *
 * ── LES DEUX BOUTONS RÉPONDENT MAINTENANT ────────────────────────────────
 *
 * Le porteur : « Sur le profil, le bouton écrire et ajouter ne marche pas. Le
 * bouton ajouter affiche un modal qui ne marche pas. » Les deux sont bien
 * dessinés sur les DEUX planches — c'était sa troisième question — et aucun des
 * deux n'avait de geste : zéro `onClick` mesuré dans les trois cadres de K02.
 *
 * `ProfilContactVivant` les attache : « Écrire » cherche la conversation
 * existante puis, à défaut, ouvre la fenêtre du premier message
 * (`POST /conversations/direct`) ; « Envoyer la demande » appelle
 * `POST /connection-requests`.
 */
/**
 * LE PSEUDO VIENT DE LA ROUTE, et c'est lui qui décide de l'appel.
 *
 * Le commentaire de `page.tsx` disait : « Le pseudo n'est pas affiché — la maquette
 * écrit “Fatou Ndiaye” en clair et ce lot ne branche pas l'API. L'interpoler serait
 * inventer une donnée que la maquette n'a pas choisi de calculer. » Ce lot a
 * justement rendu ces littéraux interpolables, par déclaration et sans toucher à la
 * maquette : `/@fatou.n` affiche donc Fatou, et `/@kofi.b` affiche Kofi.
 *
 * `404` N'EST PAS TRAITÉ COMME UNE ABSENCE ICI. 08 §4.4 et T4 §3 veulent qu'un
 * membre bloqué, désactivé ou supprimé soit indiscernable d'un membre qui n'existe
 * pas : l'échec remonte, et `displayMessageFor` dit la même phrase dans les quatre
 * cas. C'est le but, pas une approximation.
 */
export function ProfilMembreEcran({ pseudo }: { readonly pseudo: string }) {
  const { ouverte, onOuvrir, onFermer } = useCompte();
  /**
   * L'ONGLET DE CONTENU EST UN ÉTAT DE PAGE, et il recharge : `useDonnees`
   * relance son effet quand `charger` change d'identité — c'est le seul
   * mécanisme qu'il offre, et les cinq autres écrans de ce module s'en servent
   * déjà. Le filtre part dans la requête (`?type=`), parce que la liste est
   * paginée et qu'un tri local donnerait un onglet vide sur une page deux.
   */
  const [onglet, setOnglet] = useState<MemberContentType>('GUIDE');
  const charger = useCallback(
    () => chargerK02(pseudo, onglet, setOnglet),
    [pseudo, onglet],
  );

  return (
    <EcranDonnees
      /*
       * LE CADRE EST SERVI AVANT LA DONNEE : sans squelette, cette route repond 200
       * en servant cinq mots et aucune entree de rail. Voir
       * `screens/compte/ecran-donnees.tsx`.
       */
      squelette={SQUELETTE_K02}
      charger={charger}
    >
      {(donnees) => (
        <ProfilContactVivant donnees={donnees} pseudo={pseudo} onFermerAjout={onFermer}>
          {(vivantes) => (
            <EcranCompte
              screen="K02"
              desktop={<K02Desktop {...vivantes} />}
              mobile={<K02Mobile {...vivantes} />}
              ouverte={ouverte}
              onOuvrir={onOuvrir}
              onFermer={onFermer}
              /**
               * LA FENÊTRE REÇOIT LES MÊMES DONNÉES QUE L'ÉCRAN, et il le faut : son
               * titre nomme le membre visité (« Ajouter Fatou aux contacts »). Figé,
               * il disait « Fatou » sur le profil de Kofi — la fenêtre aurait menti
               * par-dessus un écran qui, lui, disait vrai.
               */
              modales={{ K02C: { mobile: <K02Ajout {...vivantes} /> } }}
            />
          )}
        </ProfilContactVivant>
      )}
    </EcranDonnees>
  );
}
