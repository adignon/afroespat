'use client';

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
export function ProfilMembreEcran() {
  const { ouverte, onOuvrir, onFermer } = useCompte();

  return (
    <EcranCompte
      screen="K02"
      desktop={<K02Desktop />}
      mobile={<K02Mobile />}
      ouverte={ouverte}
      onOuvrir={onOuvrir}
      onFermer={onFermer}
      modales={{ K02C: { mobile: <K02Ajout /> } }}
    />
  );
}
