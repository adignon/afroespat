import { z } from 'zod';
import {
  HelpType,
  KycStatus,
  OccupationStatus,
  Phase,
  UserPlan,
  UserStatus,
  VerificationLevel,
} from '../enums/generated.js';
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
  /**
   * Le numéro ne respecte pas le plan de numérotation de son pays.
   *
   * `422` et non `400` : la demande est bien formée — c'est sa VALEUR qui ne
   * convient pas, et le membre peut la corriger. C'est le même choix que pour
   * `OTP_INVALID`.
   */
  PHONE_INVALID: 422,
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
  /**
   * Le message ne cite PAS la longueur attendue : elle dépend du pays, et le
   * serveur la met dans `details.expectedLength` pour que l'écran l'écrive avec
   * ses propres mots. §5.2 : « le front utilise le code, jamais le message ».
   */
  PHONE_INVALID: 'Ce numéro ne correspond pas au format du pays choisi.',
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
  /**
   * L'acceptation des CGU et de la politique de confidentialité — §5, « case à
   * cocher obligatoire » à l'écran 1.
   *
   * Champ AJOUTÉ au corps que décrit §4.1, et c'est délibéré. Vérifier la case
   * uniquement côté écran laisserait créer un compte par appel direct, dont la
   * ligne de consentement dirait « accordé » sans que personne n'ait rien
   * accepté. Une preuve fausse est pire qu'une preuve absente.
   *
   * `literal(true)` et non `boolean` : `false` doit être un refus de la requête,
   * pas une valeur acceptée qu'on oublierait de tester.
   */
  acceptTerms: z.literal(true),
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
    // `z.enum(Phase)` et non la liste recopiée : `Phase` est GÉNÉRÉ depuis
    // `prisma/schema/*.prisma` (D — les 95 enums), donc la base, l'API et ce
    // formulaire ne peuvent pas diverger. Une liste écrite ici à la main survivrait
    // à l'ajout d'une phase en base sans jamais l'accepter.
    phase: z.enum(Phase).optional(),
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
    occupationStatus: z.enum(OccupationStatus).optional(),
    availableToHelp: z.boolean().optional(),
    /**
     * `HelpType` — celui du module 01, PAS `HelpType`.
     *
     * Les deux existent et n'ont pas les mêmes membres : `HelpType` est
     * `PAPERWORK | HOUSING | JOB | WELCOME | OTHER` (ce que le profil déclare
     * savoir faire), `HelpType` est `PAPERWORK | SERVICE | RIDE | MATERIAL | OTHER`
     * (le type d'une demande d'entraide du module 06). Trois membres sur cinq
     * diffèrent, et une liste recopiée à la main ne dit pas laquelle des deux elle
     * voulait dire — c'est précisément pourquoi elle est importée.
     */
    helpTypes: z.array(z.enum(HelpType)).max(5).optional(),
    languageIds: z.array(uuidSchema).max(10).optional(),
    skillIds: z.array(uuidSchema).max(10).optional(),
    /** Profil visible hors connexion. Par défaut non — l'option la plus protectrice. */
    isPublic: z.boolean().optional(),
  })
  .strict();

export type UpdateProfile = z.infer<typeof updateProfileSchema>;

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
 * Les six écrans de §5, dans l'ordre. L'onboarding avance d'un cran à la fois.
 *
 * DÉCLARÉ AVANT `meResponseSchema`, qui borne `onboarding.step` avec
 * `ONBOARDING_LAST_STEP`. Les schémas zod se construisent à l'ÉVALUATION du
 * module, pas à l'appel : une constante lue plus haut qu'elle n'est déclarée lève
 * une `ReferenceError` au premier `import`, et l'ordre ici n'est donc pas une
 * question de goût.
 */
export const ONBOARDING_STEPS = [
  'phone',
  'phase',
  'place',
  'goal',
  'profile',
  'landing',
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const ONBOARDING_LAST_STEP = ONBOARDING_STEPS.length;

/**
 * Le membre courant, tel que `GET /me` le renvoie — EN SCHÉMA.
 *
 * RÈGLE DURE (§2.1) : le numéro n'est JAMAIS renvoyé en clair, seulement masqué,
 * et seulement à son propriétaire. Le schéma ne porte donc que `masked` — et,
 * étant `z.object`, il RETIRE tout autre champ : si un jour la route renvoyait le
 * numéro en clair par accident, il ne traverserait pas cette frontière.
 *
 * POURQUOI UN SCHÉMA, ALORS QU'UNE INTERFACE SUFFISAIT À L'API.
 *
 * C'était une interface, et l'API l'employait comme type de retour — ce qui est
 * correct de son côté, puisque le compilateur vérifie l'objet qu'elle construit.
 * Mais côté front, un type ne vérifie RIEN à l'exécution : `await r.json() as
 * MeResponse` accepte n'importe quoi, et une réponse qui change de forme donne un
 * `user` indéfini qui se propage jusqu'à un écran blanc, plusieurs composants plus
 * loin, sans jamais nommer l'API. Le schéma refuse à l'endroit où la donnée entre.
 *
 * `MeResponse` reste exporté sous le même nom, mais INFÉRÉ : il n'y a donc qu'une
 * seule définition, et l'API continue de s'en servir comme avant.
 *
 * LES ÉNUMÉRATIONS SONT IMPORTÉES, pas recopiées. `verificationLevel` était
 * `string`, ce qui acceptait `"L9"` comme `"L0"`. C'est le champ le plus sensible
 * du projet — c'est lui qui décide des droits — et le seul endroit où sa liste de
 * valeurs fait autorité est l'enum généré depuis le schéma Prisma.
 */
export const meResponseSchema = z.object({
  user: z.object({
    id: uuidSchema,
    handle: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
    phase: z.enum(Phase),
    verificationLevel: z.enum(VerificationLevel),
    plan: z.enum(UserPlan),
    status: z.enum(UserStatus),
    originCountryId: uuidSchema,
    cityId: uuidSchema.nullable(),
    /**
     * ╔═══════════════════════════════════════════════════════════════════╗
     * ║ LA DATE D'ARRIVÉE — on pouvait l'ÉCRIRE sans jamais la RELIRE          ║
     * ╚═══════════════════════════════════════════════════════════════════╝
     *
     * `updateMeSchema.arrivalDate` existe, la colonne aussi, et `GET /me` ne la
     * rendait pas. Le champ « Arrivée » de K01 n'avait donc aucune valeur à
     * afficher : il serait parti vide et aurait effacé la date au premier
     * enregistrement.
     *
     * `YYYY-MM-DD` et non un horodatage : c'est une DATE, le champ de saisie
     * n'accepte que cette forme, et l'heure n'aurait aucun sens pour une arrivée.
     */
    arrivalDate: z.string().nullable(),
    originCountryLocked: z.boolean(),
  }),
  profile: z
    .object({
      bio: z.string().nullable(),
      occupationStatus: z.enum(OccupationStatus),
      availableToHelp: z.boolean(),
      helpTypes: z.array(z.enum(HelpType)),
      isPublic: z.boolean(),
    })
    .nullable(),
  phones: z.array(
    z.object({ id: uuidSchema, masked: z.string(), isDestination: z.boolean() }),
  ),
  kyc: z.object({ status: z.enum(KycStatus) }).nullable(),
  /** Compteurs de réputation, tels que `user_stats` les porte. */
  stats: z
    .object({
      helpValidatedCount: z.number().int(),
      guideHelpfulVotes: z.number().int(),
      guideContributions: z.number().int(),
      mentorshipsCompleted: z.number().int(),
      eventsOrganized: z.number().int(),
    })
    .nullable(),
  /**
   * Les consentements à (re)demander — §2.10.
   *
   * « Sans bloquer la lecture » : le front affiche une invitation, il ne ferme
   * pas l'application. D'où une liste, et non un drapeau.
   */
  consents: z.object({ outstanding: z.array(z.string()) }),
  /**
   * Où en est l'onboarding. `step` est STOCKÉ (§5 : « pour reprendre là où le
   * membre s'est arrêté »), et non déduit : cinq des six écrans sont passables,
   * donc un profil vide ne dit pas si le membre a sauté l'écran ou ne l'a pas vu.
   */
  onboarding: z.object({
    /** 0 à 6. 6 = terminé. */
    step: z.number().int().min(0).max(ONBOARDING_LAST_STEP),
    complete: z.boolean(),
  }),
});

export type MeResponse = z.infer<typeof meResponseSchema>;

/** `POST /auth/otp/request` — §4.1. Le code part par SMS, jamais dans la réponse. */
export const otpRequestResponseSchema = z.object({
  challengeId: uuidSchema,
  expiresAt: z.string().datetime(),
});

export type OtpRequestResponse = z.infer<typeof otpRequestResponseSchema>;

/**
 * `POST /auth/otp/verify` — §4.1.
 *
 * La réponse est `MeResponse` AUGMENTÉE de deux champs : §4.1 demande `user` dans
 * la réponse pour que le front sache tout de suite s'il doit afficher l'onboarding
 * ou l'accueil, sans un second aller-retour qui se verrait à l'écran.
 *
 * Le jeton de RAFRAÎCHISSEMENT n'y figure pas, et son absence est une règle, pas
 * un oubli : il part en cookie `httpOnly` (T4 §2). Un schéma qui l'accepterait
 * inviterait un jour quelqu'un à le lire depuis JavaScript, ce qui annulerait tout
 * le bénéfice du cookie.
 */
export const otpVerifyResponseSchema = meResponseSchema.extend({
  accessToken: z.string().min(1),
  isNewUser: z.boolean(),
});

export type OtpVerifyResponse = z.infer<typeof otpVerifyResponseSchema>;

/**
 * `POST /auth/refresh` — §4.1.
 *
 * UN SEUL champ, et c'est le point : le nouveau jeton de rafraîchissement part en
 * cookie, seul le jeton d'accès revient en JSON. Le niveau que porte ce jeton est
 * celui de la base À CET INSTANT — c'est pourquoi un rafraîchissement ne peut pas
 * servir à conserver un ancien niveau (voir `apps/web/src/lib/api/member.ts`).
 */
export const refreshResponseSchema = z.object({
  accessToken: z.string().min(1),
});

export type RefreshResponse = z.infer<typeof refreshResponseSchema>;

/**
 * `GET /auth/sessions` — les appareils connectés (§4.1).
 *
 * Pas d'IP : elle approche une position, et §8.1 ne collecte aucune position plus
 * fine que la ville. Le schéma ne la prévoit donc pas — et la retirerait si elle
 * apparaissait.
 */
export const authSessionsResponseSchema = z.object({
  sessions: z.array(
    z.object({
      id: uuidSchema,
      deviceLabel: z.string(),
      lastUsedAt: z.string().datetime(),
      createdAt: z.string().datetime(),
      isCurrent: z.boolean(),
    }),
  ),
});

export type AuthSessionsResponse = z.infer<typeof authSessionsResponseSchema>;

/**
 * Avancer l'onboarding. On envoie le NUMÉRO de l'écran franchi, pas un « suivant » :
 * le membre peut revenir en arrière, et un simple incrément ferait alors reculer
 * son avancement enregistré.
 */
export const onboardingAdvanceSchema = z.object({
  step: z.number().int().min(1).max(ONBOARDING_LAST_STEP),
});

/**
 * `GET /users/:handle` — le profil PUBLIC d'un membre (§2.9).
 *
 * Écrit ici, à côté de `meResponseSchema` et des schémas de requête du même
 * module, parce que `00` §4 fait de ce paquet la source unique : un schéma de
 * réponse recopié dans un fichier du front est une deuxième source, et elle
 * divergera.
 *
 * CE SCHÉMA EST CE QUI REND `/me` INSUFFISANT POUR L'ÉCRAN K01, et cela vaut
 * d'être dit ici plutôt que découvert deux fois : `meResponseSchema` rend
 * `cityId` et `originCountryId`, DES UUID. La planche « Mon profil » affiche
 * « Lyon » et « Bénin ». Aucune route du domaine MEMBRE ne résout ces
 * identifiants — `/referentials/countries` et `/referentials/cities` sont des
 * routes d'ÉQUIPE (`@RequiresStaffRole`). La seule façon honnête d'afficher les
 * noms est donc d'appeler CETTE route sur son propre pseudo, ce que l'écran K01
 * fait. C'est un aller-retour de plus pour une donnée que `/me` a déjà en base,
 * et c'est un écart à remonter au porteur, pas à corriger en devinant.
 *
 * `memberSince` est un `datetime` : le service rend `user.createdAt`, que Nest
 * sérialise en ISO. Le déclarer `z.string()` laisserait passer n'importe quoi.
 */
export const publicProfileResponseSchema = z
  .object({
    /**
     * L'IDENTIFIANT du membre. Le profil s'en passait ; « Signaler » (`POST
     * /reports`, `subjectType: 'USER'`) et « Retirer des contacts » (`DELETE
     * /me/connections/:userId`) le demandent tous deux. Ce n'est pas une donnée
     * d'identité — la liste des membres d'un réseau le rend déjà. Un DÉFAUT pour
     * la charge relevée avant ce champ.
     */
    userId: uuidSchema.nullable().default(null),
    handle: handleSchema,
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
    phase: z.enum(Phase),
    verificationLevel: z.enum(VerificationLevel),
    country: z.object({ iso2: z.string(), nameFr: z.string() }),
    city: z.object({ id: uuidSchema, name: z.string() }).nullable(),
    languages: z.array(z.object({ code: z.string(), nameFr: z.string() })),
    skills: z.array(z.object({ id: uuidSchema, nameFr: z.string() })),
    bio: z.string().nullable(),
    /** `null` quand le membre n'a pas encore de profil : le service le rend tel quel. */
    occupationStatus: z.enum(OccupationStatus).nullable(),
    availableToHelp: z.boolean(),
    helpTypes: z.array(z.enum(HelpType)),
    memberSince: z.string().datetime(),
    stats: z
      .object({
        helpValidatedCount: z.number().int(),
        guideHelpfulVotes: z.number().int(),
        guideContributions: z.number().int(),
        mentorshipsCompleted: z.number().int(),
        eventsOrganized: z.number().int(),
      })
      .nullable(),
    /**
     * MA RELATION AVEC CE MEMBRE — `null` pour un lecteur anonyme.
     *
     * Le porteur : « même quand la demande est envoyée, le bouton affiche
     * toujours “Envoyer une demande” ». Le profil ne disait rien de la relation,
     * donc « Ajouter aux contacts » s'offrait à un contact comme à un inconnu.
     *
     *   · `SELF` — c'est mon propre profil ;
     *   · `CONNECTED` — nous sommes en contact ;
     *   · `REQUEST_SENT` — j'ai une demande en attente vers lui ;
     *   · `REQUEST_RECEIVED` — il m'a envoyé une demande, `requestId` la nomme
     *     pour que je l'accepte d'ici ;
     *   · `NONE` — rien.
     *
     * C'est une donnée DU LECTEUR, pas du membre regardé : elle n'apprend rien
     * sur son réseau à lui (la règle dure de 08 §3.2 tient). Un DÉFAUT et non un
     * champ exigé : la charge relevée avant ce champ ne le porte pas.
     */
    relation: z
      .object({
        status: z.enum(['SELF', 'CONNECTED', 'REQUEST_SENT', 'REQUEST_RECEIVED', 'NONE']),
        requestId: uuidSchema.nullable(),
      })
      .strict()
      .nullable()
      .default(null),
  })
  /**
   * `.strict()` — UN CHAMP DE PLUS SUR UNE ROUTE D'IDENTITÉ DOIT ARRÊTER.
   *
   * Sans lui, zod DÉPOUILLE en silence ce qu'il ne connaît pas, et c'est exactement
   * le mauvais comportement ici : le jour où cette route joindrait un numéro de
   * téléphone, une date de naissance ou une adresse, la donnée aurait TRANSITÉ —
   * et 01 §2.1 comme 00 §8.1 parlent de ce qui transite, pas de ce qui s'affiche.
   * Le contrat le refuse donc bruyamment, en `ApiShapeError`, qui est un incident
   * et non une règle métier.
   *
   * Le jeu de clés vient de la charge RELEVÉE sur l'API
   * (`__tests__/fixtures/compte_profil_public.json`), et non d'une lecture du
   * service : c'est cette distinction qui a déjà rattrapé une erreur sur
   * `GET /me/blocks`, où le contrôleur enveloppe ce que le service rend nu.
   */
  .strict();

export type PublicProfileResponse = z.infer<typeof publicProfileResponseSchema>;

/**
 * Ce que `POST /me/onboarding` répond — l'écran ENREGISTRÉ.
 *
 * Il vivait en `z.object({ step: z.number().int() })` dans un fichier du front,
 * écrit à la ligne d'appel. C'était la deuxième définition d'une forme dont la
 * première est ci-dessus : §4 de `00` fait de ce paquet la source unique, et le
 * socle d'appel le répète mot pour mot (« écrivez le schéma manquant dans
 * `packages/shared`, jamais dans un fichier du front »).
 *
 * Il n'est PAS `onboardingAdvanceSchema` : la requête borne l'écran à
 * `ONBOARDING_LAST_STEP`, la réponse rend ce que le SERVEUR a retenu — et le
 * serveur garde le maximum, donc un écran refait rend un numéro plus grand que
 * celui envoyé. Réutiliser le schéma de requête aurait paru économe et aurait
 * refusé une réponse juste.
 */
export const onboardingAdvanceResponseSchema = z.object({
  step: z.number().int().min(0),
});

export type OnboardingAdvanceResponse = z.infer<typeof onboardingAdvanceResponseSchema>;