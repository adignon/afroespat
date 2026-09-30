'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  COMMUNITY_MIN_INVITES,
  type CommunityCategory,
  type CommunityDetailResponse,
  type CommunityVisibility,
} from '@app/shared';
import { createCommunity } from './api';
import { echecDe, type ReseauEchec } from './echec';
import { panelReseaux, rail } from './chrome';
import type { A10Data, InviteeView } from '../a10/data';
import { shortcuts, visibilityFor } from '../a10/data';

/**
 * L'ÉTAT DE A10 — créer un réseau d'intérêt.
 *
 * ── LE COMPTEUR DES CINQ LIT LA CONSTANTE DU SCHÉMA PARTAGÉ ────────────────
 *
 * `COMMUNITY_MIN_INVITES` vient de `@app/shared`, à côté du schéma que l'API
 * emploie pour refuser. C'est ce qui empêche l'écran d'afficher « 4 sur 4 » et
 * d'envoyer une requête que le serveur rejettera : une seconde définition de la
 * règle côté formulaire finirait par autoriser quatre invités là où l'API en
 * exige cinq.
 *
 * Le schéma DÉDOUBLONNE aussi les handles avant de compter — inviter cinq fois
 * la même personne ne suffit pas à ouvrir un réseau vide. Le compteur d'ici fait
 * donc la même chose, et pour la même raison.
 *
 * ── DEUX REFUS, ET AUCUN N'EST DEVANCÉ ─────────────────────────────────────
 *
 *   · `403 LEVEL_REQUIRED` si le compte n'est pas L1. On ne lit PAS le niveau
 *     pour griser le bouton : un niveau lu une fois et gardé, c'est la faille de
 *     quinze minutes rejouée dans le front. On tente, et `echec.levelRequired`
 *     porte `requiredLevel`, `currentLevel` et `labelFr` — de quoi afficher
 *     l'INVITATION de §7.3, jamais une erreur sèche ;
 *   · `422 CITY_THRESHOLD` si la ville n'atteint pas le seuil. Le service le
 *     revérifie à la création même si `creationGate` disait oui — sinon un appel
 *     direct suffirait à ouvrir un réseau dans une ville de trois membres.
 *
 * Mesuré, le refus de niveau sur un compte L0 :
 *
 *     LEVEL_REQUIRED · capability "community.create" · requiredLevel "L1"
 *                    · currentLevel "L0" · labelFr "créer un réseau"
 */
export interface CreationEtat {
  readonly data: A10Data;
  readonly echec: ReseauEchec | null;
  readonly envoi: boolean;
  readonly cree: CommunityDetailResponse | null;
  /** Combien d'invités DISTINCTS sont choisis, et combien il en faut. */
  readonly invitesChoisis: number;
  readonly invitesRequis: number;
  /**
   * Le formulaire est-il complet ?
   *
   * `false` grise le bouton d'envoi — et c'est une commodité d'ÉCRITURE, pas une
   * autorisation : la règle est dans le schéma partagé, qui refusera de toute
   * façon, et le serveur derrière lui. Ce booléen évite un aller-retour inutile,
   * il ne garde rien.
   */
  readonly complet: boolean;
  readonly basculer: (handle: string) => void;
  readonly choisirVisibilite: (index: number) => void;
  readonly soumettre: (
    nom: string,
    description: string,
    categorie: CommunityCategory,
  ) => Promise<void>;
}

export function useCreation(candidats: readonly InviteeView[]): CreationEtat {
  const [choisis, setChoisis] = useState<readonly string[]>([]);
  const [visibiliteIndex, setVisibiliteIndex] = useState(0);
  const [echec, setEchec] = useState<ReseauEchec | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [cree, setCree] = useState<CommunityDetailResponse | null>(null);

  /** DÉDOUBLONNÉ et en minuscules, comme le schéma partagé le fait avant de compter. */
  const handles = useMemo(
    () => [...new Set(choisis.map((h) => h.toLowerCase()))],
    [choisis],
  );

  const invitees: readonly InviteeView[] = useMemo(() => {
    const pris = new Set(handles);
    return candidats.map((c) => {
      const invited = pris.has(c.handle.toLowerCase());
      return {
        ...c,
        invited,
        btn: invited ? 'Invité·e' : 'Inviter',
        btnBg: invited ? '#E3F0EB' : '#16785E',
        btnFg: invited ? '#0F5C48' : '#fff',
      };
    });
  }, [candidats, handles]);

  const data: A10Data = useMemo(
    () => ({
      rail,
      shortcuts,
      panelReseaux,
      visibility: visibilityFor(visibiliteIndex),
      invitees,
    }),
    [invitees, visibiliteIndex],
  );

  const soumettre = useCallback(
    async (nom: string, description: string, categorie: CommunityCategory) => {
      setEnvoi(true);
      setEchec(null);
      try {
        const visibilite: CommunityVisibility =
          visibilityFor(visibiliteIndex)[visibiliteIndex]?.v ?? 'PUBLIC';
        /**
         * On TENTE. Aucune lecture de niveau, aucune lecture de `creationGate`
         * avant l'appel : les deux portes sont tenues par le serveur, et c'est
         * son refus qui porte de quoi les expliquer.
         */
        setCree(
          await createCommunity({
            name: nom,
            ...(description === '' ? {} : { description }),
            category: categorie,
            visibility: visibilite,
            inviteHandles: handles,
          }),
        );
      } catch (e) {
        setEchec(echecDe(e));
      } finally {
        setEnvoi(false);
      }
    },
    [handles, visibiliteIndex],
  );

  return {
    data,
    echec,
    envoi,
    cree,
    invitesChoisis: handles.length,
    invitesRequis: COMMUNITY_MIN_INVITES,
    complet: handles.length >= COMMUNITY_MIN_INVITES,
    basculer: useCallback((handle: string) => {
      setChoisis((c) =>
        c.includes(handle) ? c.filter((h) => h !== handle) : [...c, handle],
      );
    }, []),
    choisirVisibilite: setVisibiliteIndex,
    soumettre,
  };
}
