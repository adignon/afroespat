'use client';

/**
 * AJOUT HORS MAQUETTE — LA LECTURE ET LES GESTES DES VUES DU MODULE PARCOURS.
 *
 * Trois outils, et rien d'autre :
 *
 *   · `useParcoursComplet(id)` lit `GET /journeys/:id` et garde la réponse EN MÉMOIRE ;
 *     chaque geste d'écriture de `api.ts` rend le parcours complet, que `appliquer`
 *     pose directement — pas de second aller-retour pour afficher le résultat ;
 *   · `useGeste()` enveloppe un appel d'écriture : un seul geste en vol à la fois
 *     (un double clic ne crée pas deux étapes), le refus affiché par
 *     `displayMessageFor` (jamais le message brut), et l'invitation à monter de niveau
 *     de §7.3 quand le serveur répond `LEVEL_REQUIRED` — le front prévient, le
 *     serveur décide ;
 *   · `signalerMaj()` prévient le PANNEAU de gauche (avancement, étape en cours,
 *     compteur d'équipe), qui est chargé par la page et non par la vue : il se
 *     recharge sans clignoter (voir `EcranParcoursDonnees`).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import type { JourneyFullResponse, LevelRequiredDetailsParsed } from '@app/shared';
import { ApiError, displayMessageFor } from '@/lib/api/index';
import { readJourney } from '@/screens/parcours/api';

export const EVT_MAJ_PANNEAU = 'parcours:maj';

/** Un identifiant de la base : UUID, y compris les UUIDv7 que ce projet émet. */
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function signalerMaj(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVT_MAJ_PANNEAU));
}

/** Le parcours de l'URL `/parcours/:id`, ou `null` sur une planche d'illustration. */
export function useIdParcours(): string | null {
  const params = useParams<{ id?: string }>();
  return typeof params.id === 'string' && UUID.test(params.id) ? params.id : null;
}

export type EtatParcours =
  | { readonly phase: 'absent' }
  | { readonly phase: 'attente' }
  | { readonly phase: 'echec'; readonly erreur: unknown }
  | { readonly phase: 'pret'; readonly parcours: JourneyFullResponse };

export function useParcoursComplet(id: string | null) {
  const [etat, setEtat] = useState<EtatParcours>(
    id === null ? { phase: 'absent' } : { phase: 'attente' },
  );
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (id === null) return;
    let annule = false;
    readJourney(id).then(
      (parcours) => {
        if (!annule) setEtat({ phase: 'pret', parcours });
      },
      (erreur: unknown) => {
        if (!annule) setEtat({ phase: 'echec', erreur });
      },
    );
    return () => {
      annule = true;
    };
  }, [id, version]);

  const recharger = useCallback(() => setVersion((n) => n + 1), []);
  const appliquer = useCallback((parcours: JourneyFullResponse) => {
    setEtat({ phase: 'pret', parcours });
  }, []);
  return { etat, recharger, appliquer };
}

export function useGeste() {
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [niveau, setNiveau] = useState<LevelRequiredDetailsParsed | null>(null);
  const enVol = useRef(false);

  const executer = useCallback(
    async <T,>(
      travail: () => Promise<T>,
      options: { readonly majPanneau?: boolean } = {},
    ): Promise<T | null> => {
      if (enVol.current) return null;
      enVol.current = true;
      setOccupe(true);
      setErreur(null);
      setNiveau(null);
      try {
        const resultat = await travail();
        if (options.majPanneau === true) signalerMaj();
        return resultat;
      } catch (cause) {
        const invitation = cause instanceof ApiError ? cause.levelRequired : null;
        if (invitation !== null) setNiveau(invitation);
        else setErreur(displayMessageFor(cause));
        return null;
      } finally {
        enVol.current = false;
        setOccupe(false);
      }
    },
    [],
  );

  const effacer = useCallback(() => {
    setErreur(null);
    setNiveau(null);
  }, []);

  return { occupe, erreur, niveau, executer, effacer, signaler: setErreur };
}
