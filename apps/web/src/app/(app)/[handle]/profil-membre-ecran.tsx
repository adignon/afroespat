'use client';

import { useCallback } from 'react';
import { chargerK02 } from '@/screens/compte/appels';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { EcranCompte, useCompte } from '@/screens/compte/ecran';
import { K02Desktop } from '@/screens/k02/desktop.generated';
import { K02Mobile } from '@/screens/k02/mobile.generated';
import { K02Ajout } from '@/screens/k02contact/ajout.generated';

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
 * « Envoyer la demande » est INERTE : une demande de contact est un message
 * adressé à quelqu'un, et ce lot ne branche aucune route.
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
  const charger = useCallback(() => chargerK02(pseudo), [pseudo]);

  return (
    <EcranDonnees charger={charger}>
      {(donnees) => (
        <EcranCompte
          screen="K02"
          desktop={<K02Desktop {...donnees} />}
          mobile={<K02Mobile {...donnees} />}
          ouverte={ouverte}
          onOuvrir={onOuvrir}
          onFermer={onFermer}
          modales={{ K02C: { mobile: <K02Ajout /> } }}
        />
      )}
    </EcranDonnees>
  );
}
