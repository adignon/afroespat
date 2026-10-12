'use client';

import { useEffect, useState } from 'react';
import {
  SEARCH_ZERO_RESULTS_PANEL_LIMIT,
  SEARCH_ZERO_RESULTS_PANEL_WEEKS,
  zeroResultsResponseSchema,
} from '@app/shared';
import { hasAccessToken, memberApi, resumeSession } from '@/lib/api/index';
import type { MissingQueryView } from '@/screens/a03/data';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « GUIDES MANQUANTS · Recherché sans résultat ce mois-ci » — LA VRAIE LISTE  ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * MESURÉ avant ce lot : le panneau de la colonne de droite d'A03 affichait les
 * QUATRE lignes d'exemple de la maquette — « CAF étudiant étranger · 64 » et ses
 * trois sœurs, écrites dans `screens/a03/data.ts`. Un chiffre qui a l'air mesuré
 * et qui ne l'est pas.
 *
 * TOUT EXISTAIT SAUF LA ROUTE, et elle existe maintenant :
 * `GET /search/zero-results` (capacité `content.read`, N0). Le modèle
 * `SearchZeroResult` était déjà ALIMENTÉ par `POST /search/zero`, et
 * `searchService.zeroResults` agrégeait déjà par `groupBy` — il n'y avait
 * personne pour le lire.
 *
 * ── POURQUOI UN CROCHET À PART, ET NON `useGuides` ──────────────────────────
 *
 * Parce que ce panneau ne dépend NI de l'onglet NI des trois filtres de la page :
 * c'est la même liste quoi qu'on regarde. Le mettre dans `useGuides` l'aurait fait
 * recharger à chaque changement d'onglet et à chaque choix de filtre — quatre
 * appels de plus pour une liste identique. Même découpage que
 * `use-referentiels.ts`, qui charge ses pays et ses villes une seule fois.
 *
 * ── LA FENÊTRE, ET LA VILLE QU'ON NE PASSE PAS ──────────────────────────────
 *
 * « Ce mois-ci » → `SEARCH_ZERO_RESULTS_PANEL_WEEKS` (quatre semaines), importé et
 * non recopié : `zeroResults` ne connaît que des semaines.
 *
 * ⚠ AUCUNE VILLE N'EST PASSÉE, ET C'EST MESURÉ. `zeroResults` filtre sur
 * l'ÉGALITÉ de `cityId`, et `recordZeroResult` y écrit la ville DE LA RECHERCHE —
 * le filtre que le chercheur avait posé — donc `null` dès qu'il n'en avait posé
 * aucun. Passer la ville du lecteur exclurait toutes ces lignes, c'est-à-dire la
 * majorité, et le panneau se viderait sur un filtre que personne n'a demandé. La
 * ville reste donc un paramètre de la route, pour l'outil de revue qui en voudra
 * un, et le panneau demande la liste entière. REMONTÉ.
 *
 * ── CE QUE LE PANNEAU MONTRE AVANT LA RÉPONSE : RIEN ────────────────────────
 *
 * `null`, et non les lignes de la maquette. C'est l'inverse du choix tenu pour
 * l'en-tête d'un guide (`guide-screen.tsx` garde le dessin le temps d'un
 * aller-retour) et la raison est la nature de la donnée : un titre de guide servi
 * une demi-seconde trop tôt est un titre qui va être remplacé, tandis que « CAF
 * étudiant étranger · 64 » est un CHIFFRE — il se lit comme une mesure, et une
 * fausse mesure affichée une demi-seconde est lue, puis crue. Le panneau est donc
 * CACHÉ tant que la liste n'est pas là, par la même condition que lorsqu'elle
 * revient vide (`A03_GUIDES_MANQUANTS` dans le générateur).
 *
 * ── L'ÉCHEC NE DIT RIEN, ET C'EST VOULU ─────────────────────────────────────
 *
 * Un panneau latéral d'appoint ne mérite pas un bandeau d'erreur sur une page de
 * guides : s'il ne peut pas se remplir, il ne se dessine pas. C'est le même
 * arbitrage que `useGuide` tient pour l'historique des versions (`allSettled`), et
 * la raison est la même — l'échec d'un encart ne doit pas faire disparaître la
 * page qui le porte.
 */
export function useGuidesManquants(): readonly MissingQueryView[] | null {
  const [items, setItems] = useState<readonly MissingQueryView[] | null>(null);

  useEffect(() => {
    const ac = new AbortController();

    void (async () => {
      try {
        /**
         * LA MÊME REPRISE QUE PARTOUT : le jeton d'accès vit en mémoire et meurt
         * avec l'onglet, le cookie de rafraîchissement dure trente jours. Sans
         * cette ligne, un rechargement de `/guides` partirait sans jeton et la
         * route répondrait `401` — le panneau resterait caché sur une session
         * parfaitement valide.
         */
        if (!hasAccessToken()) await resumeSession().catch(() => false);

        const r = await memberApi.get(
          `/search/zero-results?weeks=${SEARCH_ZERO_RESULTS_PANEL_WEEKS}` +
            `&limit=${SEARCH_ZERO_RESULTS_PANEL_LIMIT}`,
          zeroResultsResponseSchema,
          { signal: ac.signal },
        );
        if (ac.signal.aborted) return;
        setItems(r.items.map((row) => ({ q: row.query, n: String(row.count) })));
      } catch {
        /** Voir l'en-tête : un encart qui ne peut pas se remplir ne se dessine pas. */
        if (!ac.signal.aborted) setItems([]);
      }
    })();

    return () => ac.abort();
  }, []);

  return items;
}
