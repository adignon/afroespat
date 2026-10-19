'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { z } from 'zod';
import {
  alertCriteriaSchema,
  placesCitiesResponseSchema,
  type HousingKind,
} from '@app/shared';
import { useGeste } from '@/components/entraide/geste';
import { FenetreConfirmation } from '@/components/fenetre-confirmation';
import { ApiError, hasAccessToken, memberApi, resumeSession } from '@/lib/api/index';
import { centimesDe } from '@/lib/centimes';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ S10 — MES ALERTES : ENREGISTRER, ACTIVER, METTRE EN PAUSE, SUPPRIMER         ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * « Enregistrer l'alerte » n'avait aucun gestionnaire, et la pastille d'activation
 * d'une alerte était un `<span>`. Les routes sont celles de 10 §6.4 :
 * `POST /me/alerts`, `PATCH /me/alerts/:id` (`isActive`) et `DELETE /me/alerts/:id`.
 *
 * « TOUT EST GRATUIT » : la limite de plan est retirée par le lot « tout gratuit »
 * (le plan lu côté serveur est PREMIUM pour tous tant que les plans ne sont pas
 * appliqués) ; cet écran ne la teste nulle part — si le serveur répond
 * `PLAN_REQUIRED` un jour, sa phrase s'affiche, comme n'importe quel refus.
 *
 * Les critères sont ceux de `alertCriteriaSchema` : pour le logement le genre, la
 * ville (+ rayon par défaut) et le budget maximum ; pour l'emploi le secteur et le
 * type de contrat. « Annuaire » (une pastille que la maquette dessine) n'est pas un
 * genre d'alerte (`AlertKind` = HOUSING | JOB) : elle disparaît plutôt que de ne
 * rien faire.
 */
export type GenreAlerte = 'HOUSING' | 'JOB';

export interface FormulaireAlerteView {
  readonly genre: GenreAlerte;
  readonly onGenre: (g: GenreAlerte) => void;
  readonly logementKind: HousingKind | '';
  readonly onLogementKind: (k: HousingKind | '') => void;
  readonly villeId: string;
  readonly onVille: (e: { readonly target: { readonly value: string } }) => void;
  readonly villes: readonly { id: string; nom: string }[];
  readonly budget: string;
  readonly onBudget: (e: { readonly target: { readonly value: string } }) => void;
  readonly secteur: string;
  readonly onSecteur: (e: { readonly target: { readonly value: string } }) => void;
  readonly contrat: string;
  readonly onContrat: (e: { readonly target: { readonly value: string } }) => void;
  readonly echec: string;
  readonly succes: string;
  readonly occupe: boolean;
  readonly onEnregistrer: () => void;
}

export interface GestesAlertes {
  readonly occupe: boolean;
  readonly onBasculer: (id: string, active: boolean) => void;
  readonly onSupprimer: (id: string) => void;
}

const RIEN = (): void => {};

export const formulaireAlerteVide: FormulaireAlerteView = {
  genre: 'HOUSING',
  onGenre: RIEN,
  logementKind: '',
  onLogementKind: RIEN,
  villeId: '',
  onVille: RIEN,
  villes: [],
  budget: '',
  onBudget: RIEN,
  secteur: '',
  onSecteur: RIEN,
  contrat: '',
  onContrat: RIEN,
  echec: '',
  succes: '',
  occupe: false,
  onEnregistrer: RIEN,
};

export const gestesAlertesVides: GestesAlertes = { occupe: false, onBasculer: RIEN, onSupprimer: RIEN };

type Evt = { readonly target: { readonly value: string } };

export function useAlertes(recharger: () => void): {
  readonly formulaire: FormulaireAlerteView;
  readonly gestes: GestesAlertes;
  readonly fenetres: ReactNode;
} {
  const { occupe, lancer, fenetre } = useGeste();
  const [genre, setGenre] = useState<GenreAlerte>('HOUSING');
  const [logementKind, setLogementKind] = useState<HousingKind | ''>('');
  const [villeId, setVilleId] = useState('');
  const [villes, setVilles] = useState<readonly { id: string; nom: string }[]>([]);
  const [budget, setBudget] = useState('');
  const [secteur, setSecteur] = useState('');
  const [contrat, setContrat] = useState('');
  const [echec, setEchec] = useState('');
  const [succes, setSucces] = useState('');
  const [enVol, setEnVol] = useState(false);
  const [aSupprimer, setASupprimer] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      try {
        if (!hasAccessToken()) await resumeSession();
        const liste = await memberApi.get('/places/cities?limit=100', placesCitiesResponseSchema, { signal: ac.signal });
        if (!ac.signal.aborted) setVilles(liste.items.map((c) => ({ id: c.id, nom: c.name })));
      } catch {
        /* sans la liste, l'alerte peut se fonder sur le budget ou le genre seuls */
      }
    })();
    return () => {
      ac.abort();
    };
  }, []);

  const champ = (poser: (v: string) => void) => (e: Evt): void => {
    poser(e.target.value);
    setEchec('');
    setSucces('');
  };

  const onEnregistrer = useCallback((): void => {
    if (enVol || occupe) return;
    let criteres: Record<string, unknown>;
    if (genre === 'HOUSING') {
      const prix = budget.trim() === '' ? undefined : centimesDe(budget);
      if (budget.trim() !== '' && prix === null) {
        setEchec('Le budget n’est pas un montant en euros.');
        return;
      }
      criteres = {
        ...(logementKind === '' ? {} : { kind: logementKind }),
        ...(villeId === '' ? {} : { cityId: villeId }),
        ...(prix === undefined || prix === null ? {} : { maxPriceCents: prix }),
      };
    } else {
      criteres = {
        ...(secteur.trim() === '' ? {} : { sector: secteur.trim() }),
        ...(contrat.trim() === '' ? {} : { contractType: contrat.trim() }),
      };
    }
    // Le front prévient avec la règle PARTAGÉE (« au moins un critère »).
    const verdict = alertCriteriaSchema.safeParse(criteres);
    if (!verdict.success) {
      setEchec(verdict.error.issues[0]?.message ?? 'Alerte invalide.');
      return;
    }
    setEnVol(true);
    void lancer(
      () => memberApi.post('/me/alerts', z.unknown(), { body: { kind: genre, criteria: criteres } }),
      { recharger: false, echecRepli: 'L’alerte n’a pas pu être enregistrée.' },
    )
      .then((ok) => {
        if (!ok) return;
        setSucces('Alerte enregistrée : vous serez prévenu·e des nouvelles annonces qui correspondent.');
        setBudget('');
        setSecteur('');
        setContrat('');
        setLogementKind('');
        setVilleId('');
        recharger();
      })
      .finally(() => {
        setEnVol(false);
      });
  }, [budget, contrat, enVol, genre, lancer, logementKind, occupe, recharger, secteur, villeId]);

  const formulaire = useMemo<FormulaireAlerteView>(
    () => ({
      genre,
      onGenre: (g) => {
        setGenre(g);
        setEchec('');
        setSucces('');
      },
      logementKind,
      onLogementKind: (k) => {
        setLogementKind(k);
        setEchec('');
      },
      villeId,
      onVille: champ(setVilleId),
      villes,
      budget,
      onBudget: champ(setBudget),
      secteur,
      onSecteur: champ(setSecteur),
      contrat,
      onContrat: champ(setContrat),
      echec,
      succes,
      occupe: enVol || occupe,
      onEnregistrer,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `champ` est recréé à chaque rendu
    [budget, contrat, echec, enVol, genre, logementKind, occupe, onEnregistrer, secteur, succes, villeId, villes],
  );

  const gestes = useMemo<GestesAlertes>(
    () => ({
      occupe,
      onBasculer: (id, active) => {
        void lancer(() => memberApi.patch(`/me/alerts/${id}`, z.unknown(), { body: { isActive: !active } }), {
          recharger: false,
          echecRepli: 'L’alerte n’a pas pu être modifiée.',
        }).then((ok) => {
          if (ok) recharger();
        });
      },
      onSupprimer: setASupprimer,
    }),
    [lancer, occupe, recharger],
  );

  const fenetres = (
    <>
      {fenetre}
      <FenetreConfirmation
        ouverte={aSupprimer !== null}
        nom="SUPPRESSION-ALERTE"
        titre="Supprimer l’alerte"
        question="Vous ne serez plus prévenu·e des annonces qui correspondaient à ces critères."
        libelleConfirmer="Supprimer"
        occupe={occupe}
        onConfirmer={() => {
          const id = aSupprimer;
          if (id === null) return;
          void lancer(() => memberApi.del(`/me/alerts/${id}`, z.unknown()), {
            recharger: false,
            succes: 'L’alerte est supprimée.',
            echecRepli: 'L’alerte n’a pas pu être supprimée.',
          }).then((ok) => {
            if (ok) {
              setASupprimer(null);
              recharger();
            }
          });
        }}
        onAnnuler={() => {
          setASupprimer(null);
        }}
      />
    </>
  );

  return { formulaire, gestes, fenetres };
}

export { ApiError };
