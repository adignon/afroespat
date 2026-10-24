'use client';

import { useCallback } from 'react';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { EcranServices, useServices } from '@/screens/services/ecran';
import { SQUELETTE_S02, chargerS02 } from '@/screens/services/appels';
import type { NiveauContact, NomModale } from '@/screens/services/data';
import { useAnnonceLogement, vivantAnnonceVide } from '@/screens/services/use-annonce-logement';
import type { S02Charge } from '@/screens/s02/data';
import { S02Desktop } from '@/screens/s02/desktop.generated';
import { S02Mobile } from '@/screens/s02/mobile.generated';
import { S02DesktopContact } from '@/screens/s02contact/desktopcontact.generated';
import { S02MobileContact } from '@/screens/s02contact/mobilecontact.generated';
import { S02MobileVerification } from '@/screens/s02verification/mobileverification.generated';

/**
 * S02 — une annonce de logement, et les deux états de « Contacter » (10 §2.3).
 *
 * « Envoyer » ouvre (ou rouvre) la conversation avec l'auteur et y dépose le
 * message (`useAnnonceLogement`). Le niveau n'est jamais lu : l'état L0 (« Contacter
 * demande une identité vérifiée ») est la CONSÉQUENCE d'un `403 LEVEL_REQUIRED` du
 * serveur ; `?niveau=l0` reste un lien profond de test qui n'affirme rien.
 *
 * Les hooks vivent dans `AnnonceVivante`, rendu DANS la fonction-enfant d'`EcranDonnees`
 * : ils ont besoin du prénom de l'auteur et de `estMienne`, qui viennent de la donnée.
 */
export function AnnonceEcran({ id, niveau }: { readonly id: string; readonly niveau: NiveauContact | null }) {
  const services = useServices(niveau === 'l0' ? 'S02V' : null);
  const charger = useCallback(() => chargerS02(id), [id]);

  return (
    <EcranDonnees
      squelette={SQUELETTE_S02}
      charger={charger}
      attente="Chargement de l’annonce…"
    >
      {(donnees) => <AnnonceVivante id={id} donnees={donnees} services={services} />}
    </EcranDonnees>
  );
}

function AnnonceVivante({
  id,
  donnees,
  services,
}: {
  readonly id: string;
  readonly donnees: S02Charge;
  readonly services: ReturnType<typeof useServices>;
}) {
  const { ouverte, onOuvrir, onFermer, ouvrir } = services;
  const { vivant, fenetres } = useAnnonceLogement(
    id,
    { prenomAuteur: donnees.annonce.prenomAuteur, estMienne: donnees.annonce.estMienne },
    { ouvrir: (nom: 'S02C' | 'S02V') => { ouvrir(nom satisfies NomModale); }, fermer: onFermer },
  );
  const avec = { ...donnees, vivant: id === '' ? vivantAnnonceVide : vivant };
  return (
    <>
      <EcranServices
        screen="S02"
        desktop={<S02Desktop {...avec} />}
        mobile={<S02Mobile {...avec} />}
        ouverte={ouverte}
        onOuvrir={onOuvrir}
        onFermer={onFermer}
        modales={{
          S02C: {
            desktop: <S02DesktopContact {...avec} />,
            mobile: <S02MobileContact {...avec} />,
          },
          S02V: { mobile: <S02MobileVerification {...avec} />, mobileOnly: true },
        }}
      />
      {fenetres}
    </>
  );
}
