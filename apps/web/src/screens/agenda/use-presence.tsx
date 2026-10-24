'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { z } from 'zod';
import { useGeste } from '@/components/entraide/geste';
import { memberApi } from '@/lib/api/index';
import type { LignePresence, PresenceView } from './data';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA FEUILLE DE PRÉSENCE (E04, 09 §3.3) — CASES, RECHERCHE, ENREGISTRER       ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * L'organisateur coche les présents ; « Enregistrer » envoie UNE requête
 * `POST /events/:id/check-in` avec la liste des nouveaux cochés. Le serveur
 * décide si la fenêtre est ouverte (`CHECKIN_WINDOW_CLOSED`, avec sa phrase).
 *
 * UNE PRÉSENCE ENREGISTRÉE NE SE DÉCOCHE PAS : l'API ne sait que cocher (la
 * donnée alimente l'indicateur d'impact et un crédit de réputation, §3.3), donc
 * une ligne déjà enregistrée (`figee`) est une case pleine et immobile. Seules
 * les cases cochées dans CETTE session se décochent, tant qu'elles n'ont pas été
 * envoyées.
 *
 * Pour un lecteur qui n'est pas l'organisateur, la feuille est une liste en
 * lecture : aucune case ne bouge (`userId` n'arrive pas dans sa réponse).
 */
export function usePresence(
  eventId: string,
  base: PresenceView,
  recharger: () => void,
): { readonly presence: PresenceView; readonly fenetre: ReactNode } {
  const { occupe, lancer, fenetre } = useGeste();
  const [cochees, setCochees] = useState<ReadonlySet<string>>(new Set());
  const [recherche, setRecherche] = useState('');
  const [retour, setRetour] = useState('');

  const onBascule = useCallback(
    (userId: string): void => {
      if (!base.estOrganisateur) return;
      setRetour('');
      setCochees((courant) => {
        const suivant = new Set(courant);
        if (suivant.has(userId)) suivant.delete(userId);
        else suivant.add(userId);
        return suivant;
      });
    },
    [base.estOrganisateur],
  );

  const onEnregistrer = useCallback((): void => {
    const userIds = [...cochees];
    if (userIds.length === 0) return;
    void lancer(
      () => memberApi.post(`/events/${eventId}/check-in`, z.unknown(), { body: { userIds } }),
      { recharger: false, echecRepli: 'La présence n’a pas pu être enregistrée.' },
    ).then((ok) => {
      if (!ok) return;
      setCochees(new Set());
      setRetour(
        userIds.length > 1
          ? `${userIds.length} présences enregistrées.`
          : 'Une présence enregistrée.',
      );
      recharger();
    });
  }, [cochees, eventId, lancer, recharger]);

  const lignes = useMemo<readonly LignePresence[]>(() => {
    const terme = recherche.trim().toLocaleLowerCase('fr-FR');
    return base.lignes
      .filter((l) => terme === '' || l.nom.toLocaleLowerCase('fr-FR').includes(terme))
      .map((l) => {
        if (!base.estOrganisateur || l.userId === undefined) return l;
        const coche = l.figee === true || cochees.has(l.userId);
        // Coché ici mais pas envoyé : « À enregistrer », pas « Présent·e » (voir `statutDeLigne`).
        const statut =
          l.figee !== true && coche ? 'À enregistrer' : l.statut === 'À enregistrer' ? 'Inscrit·e' : l.statut;
        return { ...l, coche, vide: !coche, statut };
      });
  }, [base.estOrganisateur, base.lignes, cochees, recherche]);

  const presence: PresenceView = {
    ...base,
    recherche,
    onRecherche: (e) => {
      setRecherche(e.target.value);
    },
    onBascule,
    onEnregistrer,
    occupe,
    enAttente: cochees.size,
    retour,
    lignes,
  };

  return { presence, fenetre };
}
