'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { CITY_COUNT_PRIVACY_THRESHOLD, DEFAULT_RADIUS_KM, Phase } from '@app/shared';
import { conversationAvec, ouvrirConversation, prenomDe } from '@/components/ecrire';
import { FenetreEcrire } from '@/components/fenetre-ecrire';
import { notifyError } from '@/components/notifications';
import { ApiError, fetchMe } from '@/lib/api/index';
import { assurerSession, lireCarte, lireMembres, lirePays } from './appels';
import type { FiltreVivant, MembreVivant, PointCarte, VillesVivantes, VueVilles } from './data';
import { membresVivants, pointsCarte } from './from-api';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ VILLES ET MEMBRES (A11) — LA CARTE, L'ANNUAIRE, LEURS FILTRES               ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Deux lectures : `GET /cities/map` (les villes actives et leurs compteurs, le
 * filtre par pays étant appliqué PAR LE SERVEUR avec son seuil de 3) et `GET
 * /members` (l'annuaire, 20 par page). Aucune règle n'est rejouée ici : le seuil, la
 * visibilité des profils, les blocages et l'ordre « disponibles pour aider d'abord »
 * sont ceux du serveur (09 §2.1, §2.2).
 *
 * LA VUE PAR DÉFAUT DIFFÈRE SELON LA LARGEUR, comme la maquette : la carte sur
 * ordinateur, l'annuaire sur téléphone. `?vue=carte|annuaire` impose la même vue
 * aux deux. `vue` (ordinateur) et `vueMobile` ne sont donc pas la même prise.
 *
 * LES FILTRES de l'annuaire sont ceux de §2.2 que la maquette dessine : « Ma ville ·
 * 30 km » (`cityId` + rayon par défaut), « Pays » (`originCountryId`), « Phase »
 * (`phase`) et « Disponible » (`availableToHelp`). Le pays est AUSSI celui de la
 * carte : un seul état, deux vues.
 */
const LIBELLES_PHASE: Record<string, string> = {
  PRE_DEPARTURE: 'Prépare son départ',
  RECENT_ARRIVAL: 'Vient d’arriver',
  SETTLED: 'Installé·e',
};

const ACTIF = { bg: '#16785E', fg: '#fff', bd: '#16785E' } as const;
const REPOS = { bg: '#fff', fg: '#16211D', bd: '#E6EBE9' } as const;

export function useVilles(options: {
  readonly vueDemandee: VueVilles | null;
  readonly pays: string;
  readonly hrefVue: (vue: VueVilles, pays: string) => string;
}): {
  readonly vivant: VillesVivantes;
  readonly vueMobile: VueVilles;
  readonly maVilleId: string | null;
  readonly fenetre: ReactNode;
} {
  const { vueDemandee, pays, hrefVue } = options;
  const router = useRouter();

  const [points, setPoints] = useState<readonly PointCarte[]>([]);
  const [membres, setMembres] = useState<readonly MembreVivant[]>([]);
  const [curseur, setCurseur] = useState<string | null>(null);
  const [paysListe, setPaysListe] = useState<readonly { valeur: string; libelle: string }[]>([]);
  const [maVille, setMaVille] = useState<{ id: string; nom: string } | null>(null);
  const [memeVille, setMemeVille] = useState(false);
  const [phase, setPhase] = useState('');
  const [dispo, setDispo] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [echec, setEchec] = useState('');
  const [salut, setSalut] = useState<string | null>(null);
  const [enVol, setEnVol] = useState(false);

  // Ma ville et le référentiel des pays d'origine : une fois.
  useEffect(() => {
    let annule = false;
    void (async () => {
      try {
        await assurerSession();
        const [moi, liste] = await Promise.allSettled([fetchMe(), lirePays()]);
        if (annule) return;
        if (liste.status === 'fulfilled') {
          setPaysListe(
            liste.value.items
              .filter((c) => c.kind === 'ORIGIN' || c.kind === 'BOTH')
              .map((c) => ({ valeur: c.id, libelle: c.nameFr })),
          );
        }
        if (moi.status === 'fulfilled' && moi.value.user.cityId !== null) {
          setMaVille({ id: moi.value.user.cityId, nom: '' });
        }
      } catch {
        /* sans ma ville, le filtre « Ma ville » est simplement éteint */
      }
    })();
    return () => {
      annule = true;
    };
  }, []);

  // La carte suit le pays.
  useEffect(() => {
    let annule = false;
    setChargement(true);
    setEchec('');
    void (async () => {
      try {
        await assurerSession();
        const carte = await lireCarte(pays);
        if (!annule) setPoints(pointsCarte(carte));
      } catch (cause: unknown) {
        if (!annule) {
          setEchec(
            cause instanceof ApiError ? cause.displayMessage : 'La carte n’a pas pu être chargée.',
          );
        }
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [pays]);

  const requete = useMemo(() => {
    const q = new URLSearchParams({ limit: '20' });
    if (memeVille && maVille !== null) {
      q.set('cityId', maVille.id);
      q.set('radiusKm', String(DEFAULT_RADIUS_KM));
    }
    if (pays !== '') q.set('originCountryId', pays);
    if (phase !== '') q.set('phase', phase);
    if (dispo) q.set('availableToHelp', 'true');
    return q;
  }, [dispo, maVille, memeVille, pays, phase]);

  // L'annuaire suit les filtres : la page repart de zéro à chaque changement.
  useEffect(() => {
    let annule = false;
    void (async () => {
      try {
        await assurerSession();
        const page = await lireMembres(requete.toString());
        if (annule) return;
        setMembres(membresVivants(page));
        setCurseur(page.nextCursor);
      } catch (cause: unknown) {
        if (!annule) {
          setEchec(
            cause instanceof ApiError ? cause.displayMessage : 'L’annuaire n’a pas pu être chargé.',
          );
        }
      }
    })();
    return () => {
      annule = true;
    };
  }, [requete]);

  const onPlus = useCallback((): void => {
    if (curseur === null) return;
    const q = new URLSearchParams(requete);
    q.set('cursor', curseur);
    void lireMembres(q.toString())
      .then((page) => {
        setMembres((courant) => [...courant, ...membresVivants(page)]);
        setCurseur(page.nextCursor);
      })
      .catch((cause: unknown) => {
        notifyError(cause instanceof ApiError ? cause.displayMessage : 'La suite n’a pas pu être chargée.');
      });
  }, [curseur, requete]);

  const onPays = useCallback(
    (valeur: string): void => {
      router.replace(hrefVue(vueDemandee ?? 'carte', valeur));
    },
    [hrefVue, router, vueDemandee],
  );

  const filtres = useMemo<readonly FiltreVivant[]>(
    () => [
      {
        label: maVille === null ? 'Ma ville' : `Ma ville · ${DEFAULT_RADIUS_KM} km`,
        ...(memeVille ? ACTIF : REPOS),
        options: null,
        valeur: memeVille ? 'oui' : '',
        onChange: () => {
          if (maVille !== null) setMemeVille((v) => !v);
        },
      },
      {
        label: pays === '' ? 'Pays' : (paysListe.find((p) => p.valeur === pays)?.libelle ?? 'Pays'),
        ...(pays === '' ? REPOS : ACTIF),
        options: [{ valeur: '', libelle: 'Tous les pays' }, ...paysListe],
        valeur: pays,
        onChange: onPays,
      },
      {
        label: phase === '' ? 'Phase' : (LIBELLES_PHASE[phase] ?? phase),
        ...(phase === '' ? REPOS : ACTIF),
        options: [
          { valeur: '', libelle: 'Toutes les phases' },
          ...Phase.map((p) => ({ valeur: p, libelle: LIBELLES_PHASE[p] ?? p })),
        ],
        valeur: phase,
        onChange: setPhase,
      },
      {
        label: 'Disponible',
        ...(dispo ? ACTIF : REPOS),
        options: null,
        valeur: dispo ? 'oui' : '',
        onChange: () => {
          setDispo((v) => !v);
        },
      },
    ],
    [dispo, maVille, memeVille, onPays, pays, paysListe, phase],
  );

  // « Saluer » : on cherche le fil avant d'ouvrir la fenêtre (route unique par paire).
  const onSaluer = useCallback(
    (handle: string): void => {
      if (enVol) return;
      setEnVol(true);
      conversationAvec(handle)
        .then((existante) => {
          if (existante === null) setSalut(handle);
          else router.push(`/messages/${existante}`);
        })
        .catch(() => {
          setSalut(handle);
        })
        .finally(() => {
          setEnVol(false);
        });
    },
    [enVol, router],
  );

  const envoyer = useCallback(
    (message: string): void => {
      if (salut === null) return;
      setEnVol(true);
      ouvrirConversation(salut, message)
        .then((id) => {
          setSalut(null);
          router.push(`/messages/${id}`);
        })
        .catch((cause: unknown) => {
          notifyError(cause instanceof ApiError ? cause.displayMessage : 'Le message n’a pas pu partir.');
        })
        .finally(() => {
          setEnVol(false);
        });
    },
    [router, salut],
  );

  const vivant: VillesVivantes = {
    vue: vueDemandee ?? 'carte',
    hrefCarte: hrefVue('carte', pays),
    hrefAnnuaire: hrefVue('annuaire', pays),
    pays,
    paysOptions: [{ valeur: '', libelle: 'Tous' }, ...paysListe],
    onPays,
    points,
    seuil: CITY_COUNT_PRIVACY_THRESHOLD,
    annuaire: membres,
    filtres,
    aPlus: curseur !== null,
    onPlus,
    chargement,
    echec,
    onSaluer,
    maVilleId: maVille?.id ?? null,
  };

  const fenetre = (
    <FenetreEcrire
      ouverte={salut !== null}
      prenom={salut === null ? '' : prenomDe('', salut)}
      occupe={enVol}
      onEnvoyer={envoyer}
      onFermer={() => {
        setSalut(null);
      }}
    />
  );

  return { vivant, vueMobile: vueDemandee ?? 'annuaire', maVilleId: maVille?.id ?? null, fenetre };
}
