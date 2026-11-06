'use client';

import { useCallback } from 'react';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { useListeAPages } from '@/lib/use-liste-pages';
import { SQUELETTE_S06, chargerFichesSuivantes, chargerS06 } from '@/screens/services/appels';
import type { S06Data } from '@/screens/s06/data';
import { S06Desktop } from '@/screens/s06/desktop.generated';
import { S06Mobile } from '@/screens/s06/mobile.generated';

/** S06 — l'annuaire professionnel, recherché par `?q=` et filtré par `?ville=` et `?metier=`. */
export function AnnuaireEcran({
  recherche,
  ville,
  metier,
  plus,
}: {
  readonly recherche: string;
  readonly ville: string;
  /** `?metier=` : l'identifiant du métier filtré, ou `''`. */
  readonly metier: string;
  /** `?plus=1` : toutes les pastilles de métier, et non les premières. */
  readonly plus: boolean;
}) {
  const charger = useCallback(() => chargerS06(recherche, ville, metier, plus), [recherche, ville, metier, plus]);
  return (
    <EcranDonnees charger={charger} cle={JSON.stringify([recherche, ville, metier])} attente="Chargement de l’annuaire…" squelette={SQUELETTE_S06}>
      {(donnees) => <S06AvecSuite donnees={donnees} recherche={recherche} ville={ville} metier={metier} />}
    </EcranDonnees>
  );
}

/** S06 avec « Voir plus » : la page suivante de `GET /pros`, avec les MÊMES filtres (lot E2). */
function S06AvecSuite({
  donnees,
  recherche,
  ville,
  metier,
}: {
  readonly donnees: S06Data;
  readonly recherche: string;
  readonly ville: string;
  readonly metier: string;
}) {
  const { items, plus } = useListeAPages({
    cle: [recherche, ville, metier].join('|'),
    initiaux: donnees.annuaire.fiches,
    curseurInitial: donnees.annuaire.suite,
    total: donnees.annuaire.total,
    identifiant: (f) => f.href,
    charger: (curseur, signal) =>
      chargerFichesSuivantes({ recherche, ville, metier }, curseur, donnees.annuaire.fiches.length, signal),
  });
  const complet: S06Data = { ...donnees, annuaire: { ...donnees.annuaire, fiches: items, plus } };
  return <ScreenFrames screen="S06" desktop={<S06Desktop {...complet} />} mobile={<S06Mobile {...complet} />} />;
}
