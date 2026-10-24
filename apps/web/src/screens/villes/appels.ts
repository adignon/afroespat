'use client';

import {
  cityMapResponseSchema,
  cityProfileResponseSchema,
  cityTipsResponseSchema,
  membersResponseSchema,
  placesCountriesResponseSchema,
  type CityTipsResponse,
} from '@app/shared';
import { hasAccessToken, memberApi, resumeSession } from '@/lib/api/index';
import { cityPillsFor, cityTabsFor, panelVilles, rail, shortcuts } from '../accueil/data';
import type { VilleData } from './data';
import {
  arrivants,
  barresPays,
  bonsPlans,
  budgetsVivants,
  enteteVille,
  evenementsVille,
  lieux,
  temoignages,
} from './from-api';

/**
 * Les appels des écrans « Villes » — et eux seuls touchent l'API.
 *
 * `GET /cities/*` et `GET /members` sont `@PublicRead` : un visiteur peut lire. Mais
 * `votedByMe` et `mine` dépendent du lecteur, et un appel parti AVANT que le jeton
 * soit en mémoire rend la vue du visiteur (200, sans erreur à rejouer) — le défaut
 * est écrit au long dans `screens/agenda/appels.ts`. On reprend donc la session
 * avant la première lecture, et seulement s'il n'y a pas déjà de jeton.
 */
export async function assurerSession(): Promise<void> {
  if (!hasAccessToken()) await resumeSession();
}

/** Les quatre onglets de la fiche, dans l'ordre de `CITY_TABS`, et le genre qu'ils listent. */
export const ONGLETS_VILLE = ['bons-plans', 'produits', 'budgets', 'temoignages'] as const;
export type OngletVille = (typeof ONGLETS_VILLE)[number];

export const KIND_PAR_ONGLET = {
  'bons-plans': 'TIP',
  produits: 'SHOP',
  budgets: 'BUDGET',
  temoignages: 'TESTIMONY',
} as const satisfies Record<OngletVille, 'TIP' | 'SHOP' | 'BUDGET' | 'TESTIMONY'>;

export function ongletDeUrl(valeur: string | null): OngletVille {
  return (ONGLETS_VILLE as readonly (string | null)[]).includes(valeur)
    ? (valeur as OngletVille)
    : 'budgets';
}

export type VilleBase = Omit<VilleData, 'vivant'>;

/** La fiche d'une ville : l'en-tête et les colonnes, plus la liste de l'onglet ouvert. */
export async function chargerVille(slug: string, onglet: OngletVille): Promise<VilleBase> {
  await assurerSession();
  const kind = KIND_PAR_ONGLET[onglet];
  const [profil, liste] = await Promise.all([
    memberApi.get(`/cities/${encodeURIComponent(slug)}`, cityProfileResponseSchema),
    memberApi.get(
      `/cities/${encodeURIComponent(slug)}/tips?kind=${kind}&limit=50`,
      cityTipsResponseSchema,
    ),
  ]);
  return composerVille(profil, liste, onglet);
}

export function composerVille(
  profil: Parameters<typeof enteteVille>[0],
  liste: CityTipsResponse,
  onglet: OngletVille,
): VilleBase {
  const index = ONGLETS_VILLE.indexOf(onglet);
  return {
    rail,
    panelVilles,
    shortcuts,
    cityTabs: cityTabsFor(index),
    cityPills: cityPillsFor(index),
    ville: enteteVille(profil),
    countryBars: barresPays(profil),
    arrivals: arrivants(profil),
    events: evenementsVille(profil),
    budgets: onglet === 'budgets' ? budgetsVivants(liste.items) : [],
    cityTips: onglet === 'bons-plans' ? bonsPlans(liste.items) : [],
    cityPlaces: onglet === 'produits' ? lieux(liste.items) : [],
    cityStories: onglet === 'temoignages' ? temoignages(liste.items) : [],
  };
}

/** Le dessin sans la donnée, pour que le cadre soit servi tout de suite (voir l'agenda). */
export const SQUELETTE_VILLE: VilleBase = {
  rail,
  panelVilles,
  shortcuts,
  cityTabs: cityTabsFor(2),
  cityPills: cityPillsFor(2),
  ville: {
    nom: '',
    region: '',
    membres: '',
    contributions: '',
    reseau: '',
    reseauHref: null,
    mediane: null,
    medianeSous: '',
  },
  countryBars: [],
  arrivals: [],
  events: [],
  budgets: [],
  cityTips: [],
  cityPlaces: [],
  cityStories: [],
};

// ─── A11 ─────────────────────────────────────────────────────────────────────

export function lireCarte(pays: string) {
  return memberApi.get(
    pays === '' ? '/cities/map' : `/cities/map?countryId=${encodeURIComponent(pays)}`,
    cityMapResponseSchema,
  );
}

export function lirePays() {
  return memberApi.get('/places/countries?limit=100', placesCountriesResponseSchema);
}

export function lireMembres(requete: string) {
  return memberApi.get(`/members?${requete}`, membresReponse);
}

const membresReponse = membersResponseSchema;
