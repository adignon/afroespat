'use client';

import { z } from 'zod';
import {
  meResponseSchema,
  onboardingAdvanceSchema,
  otpRequestResponseSchema,
  otpVerifyResponseSchema,
  placesCitiesResponseSchema,
  placesCountriesResponseSchema,
  type MeResponse,
  type OtpRequest,
  type OtpRequestResponse,
  type OtpVerify,
  type OtpVerifyResponse,
  type PlacesCity,
  type PlacesCountry,
  type UpdateMe,
  type UpdateProfile,
} from '@app/shared';
import { fetchMe, memberApi, setAccessToken } from './api/index';

/**
 * Les appels de l'INSCRIPTION — 01-identite.md §4.1 et §5.
 *
 * Ce fichier n'est plus le client d'API : il est un des consommateurs du socle, qui
 * vit dans `./api/`. Lisez `./api/index.ts` avant de brancher un domaine — la
 * convention y est écrite comme une consigne.
 *
 * CE QUI A CHANGÉ, et pourquoi cela compte pour la suite :
 *
 *   · les types ne sont plus DÉCLARÉS ici. `OtpRequestResponse`, `MeResponse`,
 *     `PlacesCountry`, `PlacesCity` viennent de `@app/shared`, inférés des schémas.
 *     Les anciens `CountryOption` et `CityOption`, écrits à la main dans ce fichier,
 *     étaient une deuxième définition de la même chose : `kind` y était `string`, ce
 *     qui acceptait n'importe quoi, et rien n'aurait signalé le jour où la route
 *     cesse de renvoyer `dialCode` — le sélecteur d'indicatif aurait simplement
 *     affiché `undefined` ;
 *
 *   · `apiRequest` n'existe plus. C'était un `fetch` typé par assertion
 *     (`return parsed as T`) : l'appelant annonçait la forme de la réponse et
 *     personne ne la vérifiait. C'est exactement le trou que le socle ferme, et le
 *     garder aurait suffi à le contourner.
 */

/** §4.1 — envoi du code. Le code part par SMS, jamais dans la réponse. */
export function requestOtp(input: OtpRequest): Promise<OtpRequestResponse> {
  return memberApi.post('/auth/otp/request', otpRequestResponseSchema, { body: input });
}

/**
 * §4.1 — vérification du code, ouverture de la session.
 *
 * Le jeton d'accès est posé dans le socle, pas rendu à l'appelant : c'est le seul
 * endroit qui doit le connaître (voir `./api/session.ts`). Le jeton de
 * rafraîchissement, lui, est déjà en cookie `httpOnly` — le serveur l'a posé, et il
 * n'apparaît dans aucune réponse JSON.
 */
export async function verifyOtp(input: OtpVerify): Promise<OtpVerifyResponse> {
  const session = await memberApi.post('/auth/otp/verify', otpVerifyResponseSchema, {
    body: input,
  });
  setAccessToken(session.accessToken);
  return session;
}

/**
 * §5 — enregistrer l'écran franchi.
 *
 * Le corps est validé par `onboardingAdvanceSchema`, LE MÊME schéma que l'API
 * applique à l'entrée (§4 : source unique). Valider aussi côté client n'est pas une
 * redondance : un numéro d'écran hors bornes devient une erreur ici, sur le champ,
 * au lieu d'un aller-retour qui rend `400 VALIDATION_FAILED`.
 */
export function advanceOnboarding(step: number): Promise<{ step: number }> {
  return memberApi.post('/me/onboarding', z.object({ step: z.number().int() }), {
    body: onboardingAdvanceSchema.parse({ step }),
  });
}

/** §4.2 — `PATCH /me`. Limite : 20 par HEURE (et non par minute). */
export function updateMe(patch: UpdateMe): Promise<MeResponse> {
  return memberApi.patch('/me', meResponseSchema, { body: patch });
}

/** §4.2 — `PATCH /me/profile`. Limite : 20 par HEURE. */
export function updateProfile(patch: UpdateProfile): Promise<MeResponse> {
  return memberApi.patch('/me/profile', meResponseSchema, { body: patch });
}

/** 02 §2.1 — pays actifs. Un pays inactif n'apparaît nulle part côté membres. */
export function listCountries(): Promise<{ items: readonly PlacesCountry[] }> {
  return memberApi.get('/places/countries', placesCountriesResponseSchema);
}

/**
 * Les villes proposées à l'inscription.
 *
 * `activeOnly=false` est ESSENTIEL : 02 §2.2 rend une ville inactive sélectionnable
 * à l'inscription, et au lancement aucune ne l'est. Le défaut `true` de la route
 * rendrait une liste vide, et l'écran du lieu paraîtrait cassé.
 */
export function listCities(): Promise<{ items: readonly PlacesCity[] }> {
  return memberApi.get('/places/cities?activeOnly=false', placesCitiesResponseSchema);
}

/**
 * Le socle, réexporté pour les appelants existants.
 *
 * `ApiClientError` est l'ancien nom d'`ApiError` — c'est la MÊME classe, donc les
 * `instanceof ApiClientError` déjà écrits continuent de fonctionner. À ne plus
 * employer dans du code neuf : importez `ApiError` depuis `@/lib/api/index`.
 */
export {
  ApiError,
  ApiError as ApiClientError,
  ApiNetworkError,
  ApiShapeError,
  displayMessageFor,
  hasAccessToken,
  memberApi,
  setAccessToken,
  staffApi,
} from './api/index';

export { fetchMe };
