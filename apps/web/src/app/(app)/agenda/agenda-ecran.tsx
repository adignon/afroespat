'use client';

import { useCallback } from 'react';
import { chargerE01, SQUELETTE_E01 } from '@/screens/agenda/appels';
import type { E01Data, ScopeAgenda } from '@/screens/agenda/data';
import { useListeAPages } from '@/lib/use-liste-pages';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { E01Desktop } from '@/screens/e01/desktop.generated';
import { E01Mobile } from '@/screens/e01/mobile.generated';

/**
 * E01 — l'agenda (`/agenda`, 09 §3.5), côté client.
 *
 * `?jour=2026-10-02` sélectionne un jour ; sans paramètre, c'est §3.5 qui décide
 * (« aujourd'hui, ou le prochain jour avec événement »), et la décision est prise
 * sur la réponse du serveur, dans `appels.ts`.
 *
 * LA FONCTION PASSÉE À `charger` EST MÉMOÏSÉE, et il faut qu'elle le soit :
 * `useDonnees` a `charger` dans ses dépendances — c'est écrit et justifié dans
 * `ecran-donnees.tsx` — donc une fonction anonyme rechargerait en boucle. Le
 * `useCallback` dépend du seul paramètre qui change l'appel.
 */
export function AgendaEcran({
  jour,
  mois,
  scope,
}: {
  readonly jour: string | null;
  readonly mois: string | null;
  readonly scope: ScopeAgenda;
}) {
  const charger = useCallback(() => chargerE01(jour, scope, mois), [jour, mois, scope]);

  return (
    <EcranDonnees
      charger={charger}
      cle={`${String(jour)}|${String(scope)}|${String(mois)}`}
      attente="Chargement de l’agenda…"
      /*
       * LE CADRE EST SERVI AVANT LA DONNÉE, et c'est mesuré : sans cela, `/agenda`
       * répondait 200 sans rail et sans barre basse. Voir `SQUELETTE_E01`.
       */
      squelette={SQUELETTE_E01}
    >
      {(donnees) => <E01AvecSuite donnees={donnees} cle={`${String(jour)}|${String(scope)}|${String(mois)}`} />}
    </EcranDonnees>
  );
}

/**
 * E01 avec « Voir plus » (lot S3A) : la page suivante des cartes du MÊME jour et du même filtre,
 * recollée à la première sans doublon. « N événements » suit ce qui est chargé.
 *
 * ⚠ « Mes participations en tête » est un tri du serveur, PAR PAGE : une participation qui tombe en
 * page deux s'affiche à sa place chronologique de cette page, pas au-dessus de la première.
 */
function E01AvecSuite({ donnees, cle }: { readonly donnees: E01Data; readonly cle: string }) {
  const { items, plus } = useListeAPages({
    cle,
    initiaux: donnees.evenements,
    curseurInitial: donnees.suite ?? null,
    identifiant: (c) => c.href ?? `${c.titre}|${c.heure}`,
    charger: (curseur, signal) =>
      donnees.chargerSuite === undefined
        ? Promise.resolve({ items: [], nextCursor: null })
        : donnees.chargerSuite(curseur, signal),
  });
  const complet: E01Data = {
    ...donnees,
    evenements: items,
    nombre: items.length,
    pluriel: items.length > 1 ? 's' : '',
    plusEvenements: plus,
  };
  return <ScreenFrames screen="E01" desktop={<E01Desktop {...complet} />} mobile={<E01Mobile {...complet} />} />;
}
