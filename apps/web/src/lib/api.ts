'use client';

import {
  meResponseSchema,
  onboardingAdvanceResponseSchema,
  onboardingAdvanceSchema,
  otpRequestResponseSchema,
  otpVerifyResponseSchema,
  placesCitiesResponseSchema,
  placesCountriesResponseSchema,
  type MeResponse,
  type OnboardingAdvanceResponse,
  type OtpRequest,
  type OtpRequestResponse,
  type OtpVerify,
  type OtpVerifyResponse,
  type PlacesCity,
  type PlacesCountry,
  type UpdateMe,
  type UpdateProfile,
  publicProfileResponseSchema,
  placesLanguagesResponseSchema,
  placesSkillSchema,
  placesSkillsResponseSchema,
  type PlacesLanguage,
  type PlacesSkill,
  mediaAssetSchema,
  type MediaAssetView,
} from '@app/shared';
import { ApiError, fetchMe, memberApi, setAccessToken } from './api/index';

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
 *
 * LA RÉPONSE, ELLE, ÉTAIT DÉCRITE ICI — `z.object({ step: z.number().int() })`,
 * écrit à la ligne d'appel. C'était la seule entorse restante à la consigne du
 * socle (« écrivez le schéma manquant dans `packages/shared`, jamais dans un
 * fichier du front »), et elle était facile à ne pas voir parce qu'elle tenait sur
 * une ligne. `onboardingAdvanceResponseSchema` vit maintenant à côté du schéma de
 * requête, et le type de retour se dérive de lui — plus rien n'est écrit deux fois.
 */
export function advanceOnboarding(step: number): Promise<OnboardingAdvanceResponse> {
  return memberApi.post('/me/onboarding', onboardingAdvanceResponseSchema, {
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
 * LE PORTRAIT DU MEMBRE — `PUT /me/avatar` (01 §4.2).
 *
 * Le porteur : « la sélection d'image ». MESURÉ sur O04 : zéro `input[type=file]`
 * et zéro bouton. Le rond en pointillés avec son appareil photo était un `<div>`
 * — un dessin d'intention, sans mécanisme.
 *
 * La route EXISTAIT : multipart, champ `file`, un seul fichier, et elle écrit
 * `users.avatar_asset_id` en retirant l'ancien portrait, octets compris. Il n'y
 * avait rien à ajouter côté serveur.
 *
 * `FormData` SANS `content-type` : un multipart porte une frontière que seul le
 * navigateur sait écrire. La poser à la main l'envoie sans frontière, et multer
 * ne trouve alors aucun fichier — `lib/api/transport.ts` le documente déjà pour
 * la photo de story.
 */
export function uploadAvatar(file: File, signal?: AbortSignal): Promise<MediaAssetView> {
  const corps = new FormData();
  corps.append('file', file);
  return memberApi.put(
    '/me/avatar',
    mediaAssetSchema,
    signal === undefined ? { body: corps } : { body: corps, signal },
  );
}

/**
 * LES LANGUES ET LES COMPÉTENCES PROPOSÉES AU PROFIL (O04).
 *
 * Le porteur : « L'ajout de compétences et langue ». Les deux routes EXISTAIENT
 * et personne ne les appelait : l'écran affichait « Comptabilité », « Excel »,
 * « Français », « Fon », « Anglais » — cinq littéraux de maquette, que rien ne
 * rendait cliquables et que rien n'enregistrait.
 *
 * Aucune pagination : `GET /places/skills` rend les 60 compétences actives et
 * `GET /places/languages` les 24 langues, triées par le serveur. C'est assez
 * petit pour tenir en une réponse, et c'est pourquoi le filtre se fait à l'écran
 * plutôt qu'en interrogeant à chaque frappe.
 */
export function listLanguages(): Promise<{ items: readonly PlacesLanguage[] }> {
  return memberApi.get('/places/languages', placesLanguagesResponseSchema);
}

export function listSkills(): Promise<{ items: readonly PlacesSkill[] }> {
  return memberApi.get('/places/skills', placesSkillsResponseSchema);
}

/**
 * ÉCRIRE SA PROPRE COMPÉTENCE — « le free typing qui crée de nouvelles
 * compétences que les administrateurs peuvent globaliser ».
 *
 * Elle naît RATTACHÉE À SON AUTEUR (`skills.created_by_user_id`) : lui seul la
 * voit dans le champ, les autres la voient sur son profil sans pouvoir la
 * choisir. L'équipe peut l'ouvrir à tous depuis D08, ce qui efface l'auteur.
 *
 * La réponse a la forme d'une ligne de référentiel, donc le même schéma que la
 * liste — c'est ce qui permet de l'ajouter au catalogue sans conversion.
 */
export function creerCompetence(nameFr: string): Promise<PlacesSkill> {
  return memberApi.post('/places/skills', placesSkillSchema, { body: { nameFr } });
}

/**
 * Le refus de `POST /places/skills` dit en français. Le serveur répond `409 CONFLICT` avec
 * `details.reason` ; la phrase générique de ce code (« conflit ») ne dirait pas quoi faire.
 */
export function messageCreationCompetence(cause: unknown): string {
  if (cause instanceof ApiError) {
    const raison = cause.details['reason'];
    if (raison === 'SKILL_LIMIT') {
      const max = cause.details['max'];
      return `Vous avez déjà ${typeof max === 'number' ? String(max) : 'plusieurs'} compétences à vous : retirez-en une avant d’en ajouter.`;
    }
    if (raison === 'SKILL_NAME_TAKEN') {
      return 'Ce nom est déjà pris par une compétence personnelle d’un autre membre : précisez-le un peu.';
    }
    if (raison === 'SKILL_RETIRED') return 'Cette compétence n’est plus proposée.';
    return cause.displayMessage;
  }
  return 'Cette compétence n’a pas pu être ajoutée.';
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE PSEUDO EST-IL LIBRE ? — ET POURQUOI AUCUNE ROUTE NEUVE                  ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Le pseudo est vérifié ? » Il ne l'était PAS. La maquette dessine
 * une coche verte et le mot « Disponible » sous le champ ; ce sont des littéraux,
 * et ils s'affichaient quoi qu'on tape — y compris sur un pseudo déjà pris. Le
 * refus n'arrivait qu'au `PATCH /me`, deux écrans plus loin, sur un champ que le
 * membre ne voyait plus.
 *
 * ── LA ROUTE EXISTE DÉJÀ, ET C'EST `GET /users/{pseudo}` ──────────────────
 *
 * Aucune route de disponibilité n'a été ajoutée, et c'est délibéré : le dépôt
 * refuse par défaut toute route sans capacité déclarée, et en ouvrir une pour
 * répondre « oui / non » aurait doublé une lecture qui existe. Un profil est
 * PUBLIC (`@PublicRead`) : si `GET /users/{pseudo}` répond, le pseudo est pris ;
 * s'il répond `404`, il est libre. On ne révèle donc rien que l'annuaire ne
 * révèle déjà.
 *
 * ── LE CAS QUI FAIT MENTIR UNE RÉPONSE NAÏVE ─────────────────────────────
 *
 * Le membre a DÉJÀ un pseudo quand il arrive sur cet écran — l'inscription lui en
 * attribue un. Retaper le sien rendrait `200`, donc « déjà pris », sur son propre
 * compte. L'appelant compare donc au pseudo courant AVANT d'appeler ; c'est lui
 * qui le connaît, pas cette fonction.
 *
 * Toute autre erreur — réseau, `429`, `500` — rend `null` : « on ne sait pas ».
 * Répondre « libre » par défaut ferait promettre une disponibilité qu'on n'a pas
 * vérifiée, et répondre « pris » bloquerait un pseudo valide sur une panne.
 */
export async function pseudoEstPris(
  handle: string,
  signal?: AbortSignal,
): Promise<boolean | null> {
  try {
    await memberApi.get(
      `/users/${encodeURIComponent(handle)}`,
      publicProfileResponseSchema,
      signal === undefined ? {} : { signal },
    );
    return true;
  } catch (erreur) {
    if (erreur instanceof ApiError && erreur.status === 404) return false;
    return null;
  }
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
