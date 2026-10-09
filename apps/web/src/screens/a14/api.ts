import {
  meResponseSchema,
  placesCitiesResponseSchema,
  placesCountriesResponseSchema,
  type MeResponse,
  type PlacesCity,
  type PlacesCountry,
} from '@app/shared';
import { memberApi } from '@/lib/api/index';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ CE QU'IL FAUT POUR CHOISIR UNE VILLE À L'ÉTAPE 3                           ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « ça affiche un modal de toutes les villes rangées par pays […]
 * une fois un pays sélectionné les villes du pays s'affiche […] Par défaut c'est
 * la première ville du pays d'origine qu'il faut sélectionner. »
 *
 * ── POURQUOI « PAR PAYS » SE DEMANDE AU SERVEUR, ET NE SE RANGE PAS ICI ────
 *
 * `GET /places/cities` rend six colonnes — `id, name, slug, region, isActive,
 * memberCount` — et PAS le pays. Ranger les villes par pays côté écran est donc
 * impossible : la donnée n'y est pas. Mais la route accepte `countryId` en
 * paramètre, ce qui est exactement le geste que le porteur décrit — on choisit un
 * pays, on reçoit SES villes. On ne regroupe rien, on demande.
 *
 * ── `activeOnly=false`, ET C'EST LE MÊME ARBITRAGE QU'À L'INSCRIPTION ──────
 *
 * 02 §2.2 rend une ville inactive sélectionnable, et `lib/api.ts` le dit déjà
 * pour l'écran du lieu : « au lancement aucune ne l'est. Le défaut `true` de la
 * route rendrait une liste vide, et l'écran paraîtrait cassé. » Le composeur a
 * besoin de la même tolérance, et le serveur l'accepte : `resolveStoryAttachment`
 * ne vérifie PAS `isActive` sur la ville d'une story — il ne suit que les
 * fusions.
 */
export function listCitiesOfCountry(
  countryId: string,
  signal?: AbortSignal,
): Promise<{ items: readonly PlacesCity[] }> {
  return memberApi.get(
    `/places/cities?countryId=${encodeURIComponent(countryId)}&activeOnly=false`,
    placesCitiesResponseSchema,
    signal === undefined ? {} : { signal },
  );
}

/** 02 §2.1 — les pays actifs, pour le panneau glissant du sélecteur de ville. */
export function listPlacesCountries(
  signal?: AbortSignal,
): Promise<{ items: readonly PlacesCountry[] }> {
  return memberApi.get(
    '/places/countries',
    placesCountriesResponseSchema,
    signal === undefined ? {} : { signal },
  );
}

/**
 * LE PROFIL, pour son `originCountryId` — « par défaut c'est la première ville du
 * pays d'origine ».
 *
 * `meResponseSchema` le déclare REQUIS (`uuidSchema`, non `optional`) : tout
 * membre qui a passé l'inscription en a un, et `auth.service.ts` en pose un
 * provisoire dès la vérification du code. On n'a donc pas de cas « sans pays » à
 * traiter — mais la ville par défaut, elle, peut manquer si ce pays n'a aucune
 * ville au référentiel, et c'est ce cas-là que l'écran gère.
 */
export function readMe(signal?: AbortSignal): Promise<MeResponse> {
  return memberApi.get('/me', meResponseSchema, signal === undefined ? {} : { signal });
}
