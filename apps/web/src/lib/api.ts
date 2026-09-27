'use client';

import { AUTH_ERROR_MESSAGES, TRANSVERSE_ERROR_MESSAGES } from '@app/shared';

/**
 * Le client d'API — T4 §3.
 *
 * Trois choses le distinguent d'un `fetch` nu, et chacune évite une classe de
 * bogue qu'on ne voit qu'en production :
 *
 *   · le jeton d'accès vit EN MÉMOIRE, jamais dans `localStorage`. Il dure 15
 *     minutes et le jeton de rafraîchissement est un cookie `httpOnly` (§4.1) :
 *     écrire l'un des deux dans un stockage lisible par JavaScript annulerait
 *     tout le bénéfice du cookie ;
 *   · un `401` déclenche UN SEUL rafraîchissement, partagé entre tous les appels
 *     en vol. Sans ce partage, cinq requêtes simultanées lanceraient cinq
 *     rotations — et la détection de rejeu du serveur, qui est faite pour ça,
 *     révoquerait la chaîne. Le bogue serait une déconnexion aléatoire au
 *     chargement d'une page ;
 *   · les erreurs sortent typées, avec le `code` du serveur. Le front décide sur
 *     le code, jamais sur le message (§5.2).
 */

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1';

/** Une erreur venue de l'API, avec son code exploitable. */
export class ApiClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }

  /** Le message à afficher : celui du serveur, ou celui du catalogue partagé. */
  get displayMessage(): string {
    const known =
      (AUTH_ERROR_MESSAGES as Record<string, string | undefined>)[this.code] ??
      (TRANSVERSE_ERROR_MESSAGES as Record<string, string | undefined>)[this.code];
    return known ?? this.message;
  }
}

/**
 * Le jeton d'accès, en mémoire du module.
 *
 * Il disparaît au rechargement de la page — c'est voulu : le cookie de
 * rafraîchissement suffit à en obtenir un nouveau, et c'est justement son rôle.
 */
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function hasAccessToken(): boolean {
  return accessToken !== null;
}

/** Le rafraîchissement en cours, partagé. Voir le commentaire d'en-tête. */
let refreshing: Promise<boolean> | null = null;

async function refreshOnce(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const response = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        // Le cookie de rafraîchissement est `httpOnly` : il ne part que si on le
        // demande explicitement, l'API étant sur une autre origine.
        credentials: 'include',
      });
      if (!response.ok) return false;
      const body = (await response.json()) as { accessToken?: unknown };
      if (typeof body.accessToken !== 'string') return false;
      accessToken = body.accessToken;
      return true;
    } catch {
      return false;
    } finally {
      // Libéré dans tous les cas : sans cela, un échec réseau condamnerait la
      // session pour le reste de la vie de l'onglet.
      refreshing = null;
    }
  })();
  return refreshing;
}

interface RequestOptions {
  readonly method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  readonly body?: unknown;
  /** Interne : empêche une boucle de rafraîchissement. */
  readonly retried?: boolean;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (accessToken !== null) headers['authorization'] = `Bearer ${accessToken}`;

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    credentials: 'include',
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });

  if (response.status === 401 && options.retried !== true) {
    if (await refreshOnce()) {
      return apiRequest<T>(path, { ...options, retried: true });
    }
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const parsed: unknown = text.length === 0 ? null : safeJson(text);

  if (!response.ok) {
    const error = extractError(parsed);
    throw new ApiClientError(
      error.code,
      error.message,
      response.status,
      ...(error.details === undefined ? [] : [error.details]),
    );
  }

  return parsed as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Extrait `error { code, message, details }`.
 *
 * Le repli n'invente pas de code : un serveur qui répond autre chose que le
 * format de T4 §3 est un incident, et `UNKNOWN` le dit. Fabriquer un code
 * plausible ferait prendre une panne pour une règle métier.
 */
function extractError(body: unknown): {
  code: string;
  message: string;
  details?: Record<string, unknown>;
} {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    // `'error' in body` suffit à rendre la propriété accessible : TypeScript
    // réduit le type lui-même, et une assertion de plus ne dirait rien.
    const inner: unknown = body.error;
    if (typeof inner === 'object' && inner !== null && 'code' in inner && 'message' in inner) {
      const e = inner as { code: unknown; message: unknown; details?: unknown };
      if (typeof e.code === 'string' && typeof e.message === 'string') {
        return {
          code: e.code,
          message: e.message,
          ...(typeof e.details === 'object' && e.details !== null
            ? { details: e.details as Record<string, unknown> }
            : {}),
        };
      }
    }
  }
  return { code: 'UNKNOWN', message: 'Une erreur inattendue est survenue.' };
}

// ── Routes employées par l'onboarding ───────────────────────────────────────

export interface OtpRequested {
  readonly challengeId: string;
  readonly expiresAt: string;
}

export function requestOtp(input: {
  phone: string;
  countryIso2: string;
  captchaToken: string;
  purpose?: 'SIGNUP' | 'LOGIN';
}): Promise<OtpRequested> {
  return apiRequest<OtpRequested>('/auth/otp/request', { method: 'POST', body: input });
}

export interface VerifiedSession {
  readonly accessToken: string;
  readonly isNewUser: boolean;
  readonly user: { readonly handle: string; readonly phase: string };
  readonly onboarding: { readonly step: number; readonly complete: boolean };
}

export async function verifyOtp(input: {
  challengeId: string;
  code: string;
}): Promise<VerifiedSession> {
  const session = await apiRequest<VerifiedSession>('/auth/otp/verify', {
    method: 'POST',
    body: input,
  });
  // Le jeton de rafraîchissement, lui, est déjà posé en cookie par le serveur.
  setAccessToken(session.accessToken);
  return session;
}

export function advanceOnboarding(step: number): Promise<{ step: number }> {
  return apiRequest<{ step: number }>('/me/onboarding', { method: 'POST', body: { step } });
}

export function updateMe(patch: Record<string, unknown>): Promise<unknown> {
  return apiRequest('/me', { method: 'PATCH', body: patch });
}

export interface CountryOption {
  readonly id: string;
  readonly iso2: string;
  readonly nameFr: string;
  readonly dialCode: string;
  readonly kind: string;
}

export function listCountries(): Promise<{ items: CountryOption[] }> {
  return apiRequest<{ items: CountryOption[] }>('/places/countries');
}

export function updateProfile(patch: Record<string, unknown>): Promise<unknown> {
  return apiRequest('/me/profile', { method: 'PATCH', body: patch });
}

export interface CityOption {
  readonly id: string;
  readonly name: string;
  readonly region: string | null;
  readonly isActive: boolean;
  readonly memberCount: number;
}

/**
 * Les villes proposées à l'onboarding.
 *
 * `activeOnly=false` est ESSENTIEL ici : 02 §2.2 dit qu'« une ville inactive est
 * sélectionnable à l'inscription (le membre doit pouvoir indiquer où il vit) ».
 * Au lancement AUCUNE ville n'est active — elles le deviennent vers 20 membres —
 * donc le défaut `true` rendrait une liste vide et l'écran paraîtrait cassé.
 */
export function listCities(): Promise<{ items: CityOption[] }> {
  return apiRequest<{ items: CityOption[] }>('/places/cities?activeOnly=false');
}
