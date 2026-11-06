'use client';

import { useCallback, useRef, useState } from 'react';
import type { PlusListe } from '@/components/voir-plus';
import { plusDe } from '@/components/voir-plus';
import { fusionner, useSuiteCurseur, type PageSuivante } from './use-pages-curseur';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ UNE LISTE CHARGÉE D'UN COUP, PROLONGÉE PAGE PAR PAGE                        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Pour les écrans dont un CHARGEUR rend la première page (`chargerS01`,
 * `chargerS06`…) et dont la liste n'est pas modifiée sur place : le crochet garde
 * les pages SUIVANTES à part, les recolle aux éléments initiaux (sans doublon) et
 * rend le `PlusListe` du bouton « Voir plus ».
 *
 * Les pages ajoutées sont oubliées dès que la clé change — un autre filtre, une
 * autre recherche, ou un rechargement qui rend un autre premier curseur : on ne
 * recolle jamais des lignes d'une requête à celles d'une autre.
 */
export interface OptionsListe<T> {
  /** Le filtre / la recherche : en changer abandonne les pages ajoutées et la requête en vol. */
  readonly cle: string;
  readonly initiaux: readonly T[];
  /** Le `nextCursor` de la première page. */
  readonly curseurInitial: string | null;
  readonly total?: number | null;
  readonly identifiant: (element: T) => string;
  readonly charger: (curseur: string, signal: AbortSignal) => Promise<PageSuivante<T>>;
}

interface Ajouts<T> {
  readonly cle: string;
  readonly elements: readonly T[];
  /** `undefined` : aucune page ajoutée, on part du curseur initial. */
  readonly curseur: string | null | undefined;
}

export function useListeAPages<T>(options: OptionsListe<T>): {
  readonly items: readonly T[];
  readonly plus: PlusListe;
} {
  const cleComplete = `${options.cle}|${options.curseurInitial ?? ''}`;
  const [ajouts, setAjouts] = useState<Ajouts<T>>({ cle: cleComplete, elements: [], curseur: undefined });
  const courants = ajouts.cle === cleComplete;
  const elementsAjoutes = courants ? ajouts.elements : [];
  const curseur = courants && ajouts.curseur !== undefined ? ajouts.curseur : options.curseurInitial;
  const dernier = useRef(options);
  dernier.current = options;

  const surPage = useCallback(
    (page: PageSuivante<T>): void => {
      setAjouts((precedent) => ({
        cle: cleComplete,
        elements: [...(precedent.cle === cleComplete ? precedent.elements : []), ...page.items],
        curseur: page.nextCursor,
      }));
    },
    [cleComplete],
  );

  const suite = useSuiteCurseur<T>({
    curseur,
    cle: cleComplete,
    charger: (c, signal) => dernier.current.charger(c, signal),
    surPage,
  });

  const items = fusionner(options.initiaux, elementsAjoutes, options.identifiant);
  return {
    items,
    plus: plusDe(suite, { curseur, affiches: items.length, total: options.total ?? null }),
  };
}
