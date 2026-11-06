'use client';

import { useCallback } from 'react';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { useListeAPages } from '@/lib/use-liste-pages';
import { chargerAnnoncesSuivantes, chargerS01, SQUELETTE_S01 } from '@/screens/services/appels';
import type { S01Data } from '@/screens/s01/data';
import type { FiltreLogement } from '@/screens/services/navigation';
import { S01Desktop } from '@/screens/s01/desktop.generated';
import { S01Mobile } from '@/screens/s01/mobile.generated';

/** S01 — les annonces de logement, filtrées par `?kind=` (liens des puces de genre). */
export function ListeLogementEcran({ kind }: { readonly kind: FiltreLogement }) {
  const charger = useCallback(() => chargerS01(kind), [kind]);
  return (
    <EcranDonnees charger={charger} cle={String(kind)} attente="Chargement des annonces…" squelette={SQUELETTE_S01}>
      {(donnees) => (
        <S01AvecSuite donnees={donnees} kind={kind} />
      )}
    </EcranDonnees>
  );
}

/** S01 avec « Voir plus » : les pages suivantes de `GET /housing` (lot E2), même filtre de genre. */
function S01AvecSuite({ donnees, kind }: { readonly donnees: S01Data; readonly kind: FiltreLogement }) {
  const { items, plus } = useListeAPages({
    cle: kind ?? '',
    initiaux: donnees.liste.annonces,
    curseurInitial: donnees.liste.suite,
    total: donnees.liste.total,
    identifiant: (a) => a.id,
    charger: (curseur, signal) => chargerAnnoncesSuivantes(kind, curseur, signal),
  });
  const complet: S01Data = { ...donnees, liste: { ...donnees.liste, annonces: items, plus } };
  return <ScreenFrames screen="S01" desktop={<S01Desktop {...complet} />} mobile={<S01Mobile {...complet} />} />;
}
