'use client';

import { useEffect, useState } from 'react';
import type { MeResponse } from '@app/shared';
import { fetchMe, hasAccessToken, resumeSession } from '@/lib/api/member';
import {
  TEXTES_DELAIS,
  phraseNouvelArrivant,
  phrasePaysOrigine,
  phrasePseudo,
  type CleTexteDelai,
} from '@/lib/textes-delais';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT — LES PETITES VALEURS DE LA MAQUETTE, LUES SUR LE COMPTE CONNECTÉ    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Lot W2A, phase 2 (« données statiques à rendre dynamiques »). Les planches
 * écrivent en clair une ville (« ÉVÉNEMENTS À LYON »), des dates (« Modifié le 2
 * janvier ») et des délais (« Pendant 3 mois »). Chacun est remplacé, par
 * l'adaptation `tools/adaptations/donnees-vives.mjs`, par l'un des composants
 * ci-dessous. Ils ne dessinent RIEN : ils rendent du texte, dans le style du
 * parent, et laissent donc la planche intacte.
 *
 * RÈGLE : une valeur vient de l'API ou du compte, sinon un texte neutre honnête —
 * jamais un nom de ville ou une date inventés.
 *
 * `GET /me` est demandé une fois et partagé (`fetchMe` garde la copie en mémoire).
 */

/** Le membre connecté — `undefined` avant la réponse, `null` si elle a échoué. */
export function useMoi(): MeResponse | null | undefined {
  const [moi, setMoi] = useState<MeResponse | null | undefined>(undefined);
  useEffect(() => {
    let vivant = true;
    void (async () => {
      try {
        // Le jeton vit en mémoire : au premier rendu d'un onglet il n'existe pas encore.
        if (!hasAccessToken()) await resumeSession();
        const me = await fetchMe();
        if (vivant) setMoi(me);
      } catch {
        if (vivant) setMoi(null);
      }
    })();
    return () => {
      vivant = false;
    };
  }, []);
  return moi;
}

/**
 * Le nom de la ville du membre, précédé de `avant` (« ÉVÉNEMENTS À »). Sans ville —
 * ou avant la réponse — il rend `sans` : « ÉVÉNEMENTS » et rien d'autre.
 */
export function VilleMembre({
  avant = '',
  sans = '',
  majuscules = false,
}: {
  readonly avant?: string;
  readonly sans?: string;
  readonly majuscules?: boolean;
}) {
  const moi = useMoi();
  const nom = moi?.user.cityName ?? null;
  if (nom === null) return <>{sans}</>;
  return <>{`${avant}${majuscules ? nom.toLocaleUpperCase('fr-FR') : nom}`}</>;
}

/** Une phrase de délai, par clé : voir `lib/textes-delais.ts`. */
export function Texte({ id }: { readonly id: CleTexteDelai }) {
  return <>{TEXTES_DELAIS[id]}</>;
}

/** K01 — sous « Pseudo ». */
export function PhrasePseudo() {
  const moi = useMoi();
  if (moi === undefined || moi === null) return <>{''}</>;
  return <>{phrasePseudo(moi.user.handleChangedAt)}</>;
}

/** K01 — sous « Pays d'origine ». */
export function PhrasePaysOrigine() {
  const moi = useMoi();
  if (moi === undefined || moi === null) return <>{''}</>;
  return <>{phrasePaysOrigine(moi.user.originCountryLocked)}</>;
}

/** K01 — sous « Apparaître dans les nouveaux arrivants ». */
export function PhraseNouvelArrivant() {
  const moi = useMoi();
  return <>{phraseNouvelArrivant(moi?.user.arrivalDate ?? null)}</>;
}
