'use client';

import { useCallback, useEffect, useState } from 'react';
import { hasAccessToken, resumeSession } from '@/lib/api/index';
import type { MyCommunity } from '@app/shared';
import { fetchCommunities } from '../reseaux/api';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « DANS UN RÉSEAU » — LES DEUX LIGNES ÉTAIENT CELLES DE LA MAQUETTE        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La fenêtre « Partager » dessine « Lyon et Rhône · 1 400 membres » et « Béninois
 * en France · 890 membres ». Ces deux lignes venaient de `screens/a01/data.ts`, et
 * s'affichaient à TOUT membre — y compris à celui qui n'appartient à aucun réseau.
 *
 * `GET /communities` rend `mine` : les réseaux du membre, avec leur compte de
 * membres réel. C'est la seule source, et elle existait déjà pour A07.
 *
 * ── CHARGÉ À L'OUVERTURE DE LA FENÊTRE, PAS AU MONTAGE DE LA PAGE ─────────
 *
 * `actif` suit l'ouverture de la fenêtre. La route rend QUATRE listes et une
 * grille de découverte paginée ; la payer à chaque arrivée sur l'accueil, pour
 * une fenêtre que la plupart des visites n'ouvrent pas, serait le même gaspillage
 * que la liste des parcours du composeur de story — et c'est la même borne qui
 * est appliquée ici.
 *
 * ── UN ÉCHEC NE CRIE PAS ──────────────────────────────────────────────────
 *
 * Les réseaux sont l'un des trois chemins de la fenêtre ; les contacts et les
 * tuiles marchent sans eux. Un bandeau d'erreur ferait passer pour cassée une
 * fenêtre dont deux tiers fonctionnent. La section reste donc simplement vide,
 * comme elle l'est pour un membre sans réseau — ce qui est, lui, un état normal.
 */
export function useMesReseaux(actif: boolean): {
  readonly reseaux: readonly MyCommunity[];
  readonly chargement: boolean;
} {
  const [reseaux, setReseaux] = useState<readonly MyCommunity[]>([]);
  const [chargement, setChargement] = useState(false);
  const [charge, setCharge] = useState(false);

  const lire = useCallback(async (signal: AbortSignal): Promise<void> => {
    setChargement(true);
    try {
      if (!hasAccessToken()) await resumeSession();
      const reponse = await fetchCommunities({}, signal);
      if (signal.aborted) return;
      setReseaux(reponse.mine);
      setCharge(true);
    } catch {
      // Voir l'en-tête : un confort qui n'aboutit pas ne parle pas.
      if (!signal.aborted) setCharge(true);
    } finally {
      if (!signal.aborted) setChargement(false);
    }
  }, []);

  useEffect(() => {
    /**
     * `charge` EST UN DRAPEAU « ON A ESSAYÉ », pas « on a trouvé » — un membre sans
     * réseau rend une liste vide, et s'y fier relancerait l'appel à chaque
     * réouverture de la fenêtre. Même raisonnement que `villePreparee` sur le
     * composeur de story.
     */
    if (!actif || charge) return undefined;
    const ac = new AbortController();
    void lire(ac.signal);
    return () => {
      ac.abort();
    };
  }, [actif, charge, lire]);

  return { reseaux, chargement };
}
