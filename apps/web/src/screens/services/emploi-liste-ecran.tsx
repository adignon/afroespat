'use client';

import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { useListeAPages } from '@/lib/use-liste-pages';
import { SQUELETTE_S04, chargerOffresSuivantes, chargerS04 } from '@/screens/services/appels';
import type { S04Charge, S04Data } from '@/screens/s04/data';
import { useContacterMembre } from '@/screens/services/use-contacter-membre';
import { S04Desktop } from '@/screens/s04/desktop.generated';
import { S04Mobile } from '@/screens/s04/mobile.generated';
import type { OngletEmploi } from '@/screens/s04/data';

/**
 * S04 — offres d'emploi, profils disponibles et profil de recherche du membre ; l'onglet
 * vient de l'adresse (`?onglet=`), « Contacter » écrit au membre.
 */
export function EmploiListeEcran({ onglet }: { readonly onglet: OngletEmploi }) {
  const { vivant, fenetre } = useContacterMembre();
  return (
    <>
      <EcranDonnees
        charger={chargerS04}
        attente="Chargement des offres…"
        squelette={SQUELETTE_S04}
      >
        {(donnees) => <S04AvecSuite donnees={donnees} onglet={onglet} vivant={vivant} />}
      </EcranDonnees>
      {fenetre}
    </>
  );
}

/** S04 avec « Voir plus » sur les offres (lot E2) ; les profils gardent leur propre bouton. */
function S04AvecSuite({
  donnees,
  onglet,
  vivant,
}: {
  readonly donnees: S04Charge;
  readonly onglet: S04Data['onglet'];
  readonly vivant: S04Data['vivant'];
}) {
  const { items, plus } = useListeAPages({
    cle: 'offres',
    initiaux: donnees.offres.liste,
    curseurInitial: donnees.offres.suite,
    total: donnees.offres.total,
    identifiant: (o) => o.id,
    charger: (curseur, signal) => chargerOffresSuivantes(curseur, signal),
  });
  const complet = { ...donnees, offres: { ...donnees.offres, liste: items, plus } };
  return (
    <ScreenFrames
      screen="S04"
      desktop={<S04Desktop {...complet} onglet={onglet} vivant={vivant} />}
      mobile={<S04Mobile {...complet} onglet={onglet} vivant={vivant} />}
    />
  );
}
