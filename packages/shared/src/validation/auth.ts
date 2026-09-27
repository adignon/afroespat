import { z } from 'zod';
import { handleSchema, uuidSchema } from './pagination.js';

/**
 * Schémas d'authentification — 01-identite.md §2.1 et §4.1.
 *
 * SOURCE UNIQUE (§4) : ces schémas valident l'API ET les formulaires du front.
 * Deux définitions de la même règle divergent toujours, et c'est sur un
 * formulaire d'inscription que ça se paie le plus cher.
 *
 * Il n'y a AUCUN mot de passe pour les membres : l'identifiant est le numéro de
 * téléphone, vérifié par OTP. Les mots de passe n'existent que pour l'équipe.
 */

/** Codes d'erreur propres à l'authentification (§4.1). */
export const AUTH_ERROR_CODES = {
  COUNTRY_NOT_SUPPORTED: 400,
  CAPTCHA_FAILED: 400,
  OTP_INVALID: 422,
  OTP_EXPIRED: 422,
  OTP_ATTEMPTS_EXCEEDED: 429,
  SESSION_REVOKED: 401,
  PHONE_ALREADY_USED: 409,
  LAST_PHONE: 422,
  ACCOUNT_MINOR: 403,
} as const;

export type AuthErrorCode = keyof typeof AUTH_ERROR_CODES;

export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  // Message volontairement accueillant : un membre dont le pays n'est pas
  // ouvert n'a rien fait de mal, et la plateforme y viendra.
  COUNTRY_NOT_SUPPORTED: 'Nous n’ouvrons pas encore dans ce pays.',
  CAPTCHA_FAILED: 'La vérification anti-robot a échoué. Réessayez.',
  OTP_INVALID: 'Ce code n’est pas le bon. Vérifiez et réessayez.',
  OTP_EXPIRED: 'Ce code a expiré. Demandez-en un nouveau.',
  OTP_ATTEMPTS_EXCEEDED: 'Trop de tentatives. Demandez un nouveau code.',
  SESSION_REVOKED: 'Votre session a expiré. Reconnectez-vous.',
  // Ne dit PAS à quel compte (T4 §3 : ne jamais révéler l'existence d'un compte).
  PHONE_ALREADY_USED: 'Ce numéro est déjà utilisé.',
  LAST_PHONE: 'Vous devez garder au moins un numéro.',
  ACCOUNT_MINOR: 'La plateforme est réservée aux personnes majeures.',
};

/**
 * Numéro au format E.164 : `+` suivi de 8 à 15 chiffres.
 *
 * La saisie côté front est plus souple — espaces, points, tirets — et
 * `normalizePhone` la ramène ici. Le stockage, lui, n'accepte que cette forme :
 * deux écritures du même numéro créeraient deux comptes.
 */
export const e164Schema = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, { message: 'Numéro de téléphone invalide.' });

/**
 * Nettoie une saisie humaine. Ne DEVINE pas l'indicatif : c'est le sélecteur de
 * pays qui le donne, et supposer « +33 » parce qu'on est en France créerait des
 * comptes en double pour les membres encore au pays.
 */
export function normalizePhone(input: string, dialCode: string): string {
  const digits = input.replace(/[\s.\-–—()]/g, '');
  if (digits.startsWith('+')) return digits;
  // Un numéro national commence souvent par un 0 de service, qui saute.
  const national = digits.replace(/^0+/, '');
  return `${dialCode}${national}`;
}

export const otpPurposeSchema = z.enum([
  'SIGNUP',
  'LOGIN',
  'ADD_PHONE',
  'DELETE_ACCOUNT',
  'REACTIVATE',
]);

export const otpRequestSchema = z.object({
  phone: z.string().min(4).max(24),
  countryIso2: z.string().length(2).toUpperCase(),
  /** Turnstile, obligatoire avant tout envoi (§2.1). */
  captchaToken: z.string().min(1),
  purpose: otpPurposeSchema.default('SIGNUP'),
});

export type OtpRequest = z.infer<typeof otpRequestSchema>;

export const otpVerifySchema = z.object({
  challengeId: uuidSchema,
  code: z.string().regex(/^\d{6}$/, { message: 'Le code comporte 6 chiffres.' }),
});

export type OtpVerify = z.infer<typeof otpVerifySchema>;

/** Onboarding, écrans O01 et O02 — phase, pays, ville. */
export const updateMeSchema = z
  .object({
    displayName: z.string().min(2).max(60).optional(),
    handle: handleSchema.optional(),
    phase: z.enum(['PRE_DEPARTURE', 'RECENT_ARRIVAL', 'SETTLED']).optional(),
    cityId: uuidSchema.optional(),
    /** Modifiable UNE SEULE FOIS (§2.7) : il pilote réseaux et modèles. */
    originCountryId: uuidSchema.optional(),
    arrivalDate: z.string().date().optional(),
    plannedDepartureDate: z.string().date().optional(),
    timezone: z.string().min(3).max(64).optional(),
  })
  .strict();

export type UpdateMe = z.infer<typeof updateMeSchema>;

/** Onboarding, écran O04 — profil. */
export const updateProfileSchema = z
  .object({
    bio: z.string().max(500).optional(),
    occupationStatus: z
      .enum(['STUDENT', 'EMPLOYEE', 'ENTREPRENEUR', 'JOB_SEEKER', 'OTHER'])
      .optional(),
    availableToHelp: z.boolean().optional(),
    helpTypes: z.array(z.enum(['PAPERWORK', 'HOUSING', 'JOB', 'WELCOME', 'OTHER'])).max(5).optional(),
    languageIds: z.array(uuidSchema).max(10).optional(),
    skillIds: z.array(uuidSchema).max(10).optional(),
    /** Profil visible hors connexion. Par défaut non — l'option la plus protectrice. */
    isPublic: z.boolean().optional(),
  })
  .strict();

export const consentSchema = z.object({
  type: z.enum(['TERMS', 'PRIVACY', 'MARKETING_EMAIL', 'JOURNEY_VISIBILITY']),
  version: z.string().min(1).max(32),
  granted: z.boolean(),
});

/**
 * Limites de débit (§2.1 et §4.4). Elles sont ici, et non dans le service, pour
 * que le front puisse afficher le bon message avant même d'appeler.
 */
export const RATE_LIMITS = {
  /** 3 envois par numéro et par heure. */
  otpPerPhonePerHour: 3,
  /** 10 par IP et par heure — protège d'une énumération de numéros. */
  otpPerIpPerHour: 10,
  /** 5 tentatives, puis nouveau défi obligatoire. */
  otpAttempts: 5,
  /** 10 minutes. */
  otpTtlSeconds: 600,
  /** Jeton d'accès court : le niveau y figure, il doit se rafraîchir vite. */
  accessTokenSeconds: 15 * 60,
  /** 30 jours, avec rotation à chaque usage. */
  refreshTokenDays: 30,
  updateMePerHour: 20,
} as const;

/**
 * Le membre courant, tel que `GET /me` le renvoie.
 *
 * RÈGLE DURE (§2.1) : le numéro n'est JAMAIS renvoyé en clair, seulement masqué,
 * et seulement à son propriétaire. Le type ne porte donc que `masked`.
 */
export interface MeResponse {
  readonly user: {
    readonly id: string;
    readonly handle: string;
    readonly displayName: string;
    readonly avatarUrl: string | null;
    readonly phase: string;
    readonly verificationLevel: string;
    readonly plan: string;
    readonly status: string;
    readonly originCountryId: string;
    readonly cityId: string | null;
    readonly originCountryLocked: boolean;
  };
  readonly profile: {
    readonly bio: string | null;
    readonly occupationStatus: string;
    readonly availableToHelp: boolean;
    readonly helpTypes: readonly string[];
    readonly isPublic: boolean;
  } | null;
  readonly phones: readonly { readonly id: string; readonly masked: string; readonly isDestination: boolean }[];
  readonly kyc: { readonly status: string } | null;
  /** Ce qu'il reste à remplir. Déduit du profil, jamais stocké — voir §5. */
  readonly onboarding: {
    readonly needsPhase: boolean;
    readonly needsPlace: boolean;
    readonly needsProfile: boolean;
    readonly complete: boolean;
  };
}
