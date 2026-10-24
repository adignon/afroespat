import { z } from 'zod';
import { ProContactMethod, ProTier, ProVerificationStatus } from '../enums/generated.js';
import { containsForbiddenWord } from '../constants/product.js';
import {
  cursorQuerySchema,
  handleSchema,
  pageSchema,
  slugSchema,
  uuidSchema,
} from './pagination.js';

/**
 * Annuaire professionnel — 10-services.md §4.
 *
 * C'est le module le plus exposé juridiquement de la plateforme, et trois règles
 * en découlent directement :
 *
 *   · RÈGLE DURE (01 §1.2) : le mot « certifié » et ses dérivés n'apparaissent
 *     NULLE PART. L'annuaire est l'endroit où la tentation est maximale — « avocat
 *     certifié », « comptable certifié » — parce que le membre le tape lui-même.
 *     Le refus porte sur les TROIS champs de texte de la fiche : ce sont tous des
 *     affirmations que la plateforme publierait à son compte. Il est appliqué par le
 *     SERVICE (voir `proTextSchema` plus bas pour la raison) et `containsForbiddenWord`
 *     épargne déjà « certificat », qui nomme un document réel ;
 *
 *   · RÈGLE DURE (§11) : le téléphone n'est JAMAIS stocké ni renvoyé sur une
 *     fiche. `PHONE_ON_REQUEST` ne désigne pas un numéro caché : il signifie que
 *     le pro le communiquera lui-même en message. Le schéma ne porte donc aucun
 *     champ de téléphone, et il n'y a rien à filtrer en sortie ;
 *
 *   · le JUSTIFICATIF est la condition du référencement (§4.1). `proofAssetId` est
 *     obligatoire à la création, et n'est jamais renvoyé : accès équipe uniquement.
 */

// ── Bornes du §4 ─────────────────────────────────────────────────────────────

/** §4.1 : « description ≤ 1 500 ». */
export const PRO_DESCRIPTION_MAX = 1500;
/** §4.1 : « villes couvertes (1 à 10) ». */
export const PRO_CITIES_MIN = 1;
export const PRO_CITIES_MAX = 10;
/** §4.3 : « commentaire ≤ 500 ». */
export const PRO_RECOMMENDATION_COMMENT_MAX = 500;
/** §4.3 : « une recommandation réciproque dans les 7 jours … marquée pour revue ». */
export const PRO_RECIPROCAL_WINDOW_DAYS = 7;
/** §4.3 : la revue d'une réciprocité est un dossier AUTO_RULE de priorité 4. */
export const PRO_RECIPROCAL_CASE_PRIORITY = 4;
/** §4.4 : « 3 contacts distincts par mois en gratuit », illimité en Premium. */
export const FREE_PRO_CONTACTS_PER_MONTH = 3;
/** §4.2 : « au plus 2 fiches mises en avant en tête ». */
export const PRO_FEATURED_SLOTS = 2;

/**
 * §4.2 : « un emplacement mis en avant clairement signalé ».
 *
 * Le libellé vient du serveur, comme le bandeau du logement : c'est lui qui rend
 * la mise en avant honnête, et un front peut toujours « oublier » une chaîne qu'il
 * possède. Il ne contient évidemment aucun mot interdit — un test le vérifie.
 */
export const PRO_FEATURED_LABEL = 'Fiche mise en avant';

/** §4.1 : ce que « sur demande » veut dire, dit au membre plutôt que deviné. */
export const PRO_PHONE_ON_REQUEST_HINT =
  'Ce professionnel communique son numéro lui-même, en message. La plateforme ne le stocke pas.';

/** Les paliers payants du §4.1. `FREE` est la fiche simple. */
export const PRO_PAID_TIERS = ['PRO', 'PRO_PLUS'] as const;
export type ProPaidTier = (typeof PRO_PAID_TIERS)[number];

// ── Codes d'erreur (§6.3) ────────────────────────────────────────────────────

export const PRO_ERROR_CODES = {
  PROOF_REQUIRED: 422,
  CONNECTION_REQUIRED: 422,
  OWN_PROFILE: 422,
  ALREADY_RECOMMENDED: 409,
  PROFILE_EXISTS: 409,
  FORBIDDEN_WORD: 400,
} as const;

export type ProErrorCode = keyof typeof PRO_ERROR_CODES;

export const PRO_ERROR_MESSAGES: Record<ProErrorCode, string> = {
  PROOF_REQUIRED:
    'Une fiche professionnelle demande un justificatif d’activité : extrait SIRENE, attestation URSSAF ou carte professionnelle.',
  CONNECTION_REQUIRED:
    'Vous pouvez recommander un professionnel avec qui vous êtes en contact sur la plateforme.',
  OWN_PROFILE: 'Vous ne pouvez pas recommander votre propre fiche.',
  ALREADY_RECOMMENDED: 'Vous avez déjà recommandé ce professionnel.',
  PROFILE_EXISTS: 'Vous avez déjà une fiche professionnelle.',
  // Le message NOMME le mot refusé sans l'employer comme un label : il explique la
  // raison, parce qu'un refus sans explication se contourne par tâtonnement.
  FORBIDDEN_WORD:
    'Ce mot n’est pas accepté : la plateforme ne vérifie aucun diplôme ni aucune habilitation, et ne peut donc pas laisser une fiche l’affirmer. Décrivez votre activité et vos documents avec vos mots.',
} as const;

// ── Écriture (§4.1) ──────────────────────────────────────────────────────────

/**
 * Un texte de fiche pro : longueur seulement.
 *
 * Le mot interdit N'EST PAS refusé ici, et c'est un choix payé par l'expérience :
 * un `.refine()` sur ce schéma produit un `400 VALIDATION_FAILED` dont les détails
 * ne portent que `{ path, code: 'CUSTOM' }` — le tuyau de validation (00 §5.2) ne
 * transmet que le code d'issue de zod, jamais son message. Le membre voyait donc
 * « Certaines informations sont incomplètes ou mal remplies » sur un refus qui
 * demande une EXPLICATION, et il ne pouvait que tâtonner. Relevé en appelant la
 * route au curl.
 *
 * La règle vit donc dans le service, qui lève `FORBIDDEN_WORD` avec son message
 * (voir `ProsService.assertNoForbiddenWord`). Le formulaire, lui, appelle
 * `containsForbiddenWord` — exportée par ce paquet — pour prévenir avant l'envoi.
 */
const proTextSchema = (max: number) => z.string().trim().min(2).max(max);

/**
 * Le contrôle du mot interdit, à employer côté formulaire ET côté service.
 *
 * Il délègue à `containsForbiddenWord` de `constants/product.ts`, SOURCE UNIQUE de
 * la règle : en réécrire une ici ferait deux expressions régulières à maintenir, et
 * celle qui épargne « certificat » finirait par n'être appliquée qu'à moitié.
 */
export function proTextIsAllowed(text: string | null | undefined): boolean {
  return text === null || text === undefined || !containsForbiddenWord(text);
}

/**
 * La fiche, en création comme en modification (PUT /me/pro-profile).
 *
 * `siret` est facultatif (§4.1) et validé sur sa FORME seulement : 14 chiffres. La
 * plateforme ne l'interroge auprès d'aucun service — le vérifier reviendrait à
 * « certifier » le professionnel, ce que le §4.1 refuse explicitement.
 */
export const proProfileSchema = z
  .object({
    professionId: uuidSchema,
    businessName: proTextSchema(160).optional(),
    description: proTextSchema(PRO_DESCRIPTION_MAX).optional(),
    /** Tarifs indicatifs, texte libre (« 60 € la consultation, devis gratuit »). */
    priceHint: proTextSchema(300).optional(),
    contactMethod: z.enum(ProContactMethod),
    siret: z
      .string()
      .trim()
      .regex(/^\d{14}$/, { message: 'Un SIRET compte 14 chiffres.' })
      .optional(),
    cityIds: z.array(uuidSchema).min(PRO_CITIES_MIN).max(PRO_CITIES_MAX),
    /**
     * Le justificatif. Obligatoire à la CRÉATION (le service lève `PROOF_REQUIRED`
     * s'il manque) ; facultatif ensuite, pour ne pas obliger à le redéposer à
     * chaque modification de tarif.
     */
    proofAssetId: uuidSchema.optional(),
  })
  .strict();

export type ProProfileInput = z.infer<typeof proProfileSchema>;

export const proProofSchema = z.object({ proofAssetId: uuidSchema }).strict();
export type ProProof = z.infer<typeof proProofSchema>;

export const recommendProSchema = z
  .object({ comment: z.string().trim().min(5).max(PRO_RECOMMENDATION_COMMENT_MAX).optional() })
  .strict();

export type RecommendPro = z.infer<typeof recommendProSchema>;

// ── Lecture (§4.2) ───────────────────────────────────────────────────────────

export const prosQuerySchema = cursorQuerySchema
  .extend({
    professionId: uuidSchema.optional(),
    cityId: uuidSchema.optional(),
    languageId: uuidSchema.optional(),
    q: z.string().trim().min(2).max(120).optional(),
  })
  .strict();

export type ProsQuery = z.infer<typeof prosQuerySchema>;

// ── Lecture : LES SCHÉMAS DE RÉPONSE (§6.3) ──────────────────────────────────

/**
 * ─── RÈGLE DURE 10 §4.1, DEVENUE EXÉCUTABLE À LA FRONTIÈRE DU FRONT ─────────
 *
 * « Le téléphone n'est JAMAIS stocké ici ni affiché ; "sur demande" signifie que le
 * pro le communique lui-même en message. »
 *
 * Jusqu'ici cette règle tenait par le DESSIN : la maquette n'écrit aucun numéro sur
 * une fiche pro, et le transcodage ne réécrit rien. Elle ne tient plus par le
 * dessin dès que l'API arrive — un champ `phone` dans la réponse serait affiché par
 * la première ligne de code qui le lirait.
 *
 * Le rempart est donc à DEUX étages, comme pour K04 :
 *
 *   · le schéma ne DÉCRIT aucun champ de numéro — il n'y a rien à lire ;
 *   · et il est `.strict()`, donc une réponse qui en porterait un est REFUSÉE.
 *     Sans `.strict()`, zod le DÉPOUILLE EN SILENCE : l'écran ne l'afficherait pas
 *     aujourd'hui, et personne n'apprendrait que le serveur a commencé à l'envoyer
 *     — jusqu'au jour où quelqu'un ajoute une ligne pour s'en servir.
 *
 * `contactHint` n'est PAS une exception : c'est `PRO_PHONE_ON_REQUEST_HINT`, une
 * phrase de produit qui dit justement que la plateforme ne stocke pas le numéro.
 * La charge relevée le confirme — `null` pour `PLATFORM_MESSAGE`.
 *
 * Relevés sur l'API qui tourne : `src/__tests__/fixtures/services_pro*.json`.
 */
const proCityRefSchema = z.object({ id: uuidSchema, name: z.string(), slug: slugSchema }).strict();

/**
 * Une fiche de l'annuaire, telle que `GET /pros` et `GET /pros/:id` la rendent.
 *
 * `isFeatured` ET `featuredLabel` arrivent ENSEMBLE — §4.2 : « un emplacement mis
 * en avant CLAIREMENT SIGNALÉ ». Le libellé vient du serveur pour la même raison
 * que la pastille « Sponsorisée » de l'emploi : un front qui le posséderait
 * pourrait l'oublier, et la mise en avant cesserait d'être signalée.
 *
 * `siret` est la FORME seule, jamais une vérification : §4.1 refuse explicitement
 * de « certifier » le professionnel, et aucun service tiers n'est interrogé.
 *
 * ÉCART SIGNALÉ AU PORTEUR : `GET /me/pro-profile` rend `tier: "FREE"` et
 * `isFeatured: false` sur une fiche dont `GET /pros` dit `tier: "PRO"` et
 * `isFeatured: true`. `ProsService.myProfile` appelle `toCard(rest, userId)` sans
 * son troisième argument, qui porte la mise en avant. Relevé sur deux charges du
 * MÊME objet, à une seconde d'intervalle. Le palier affiché sur « Ma fiche pro »
 * est donc faux pour un pro payant.
 */
export const proCardSchema = z
  .object({
    id: uuidSchema,
    handle: handleSchema,
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
    profession: z.object({ id: uuidSchema, nameFr: z.string() }).strict(),
    businessName: z.string().nullable(),
    description: z.string().nullable(),
    priceHint: z.string().nullable(),
    contactMethod: z.enum(ProContactMethod),
    /** Présent seulement pour `PHONE_ON_REQUEST` : dit ce que « sur demande » signifie. */
    contactHint: z.string().nullable(),
    siret: z.string().nullable(),
    cities: z.array(proCityRefSchema),
    languages: z.array(
      z.object({ id: uuidSchema, code: z.string(), nameFr: z.string() }).strict(),
    ),
    recommendationCount: z.number().int(),
    tier: z.enum(ProTier),
    isFeatured: z.boolean(),
    featuredLabel: z.string().nullable(),
    isMine: z.boolean(),
    createdAt: z.string().datetime(),
  })
  .strict();

export type ProCardView = z.infer<typeof proCardSchema>;

/**
 * `GET /pros` — et sa TÊTE MISE EN AVANT est un champ À PART de `items`.
 *
 * Même forme que l'emploi, et même piège : `items` EXCLUT les fiches de la tête.
 * Un schéma qui n'aurait décrit que `items` aurait fait disparaître les deux fiches
 * signalées — donc la mention « Fiche mise en avant », donc la règle du §4.2.
 *
 * `meta.featuredSlots` voyage avec la liste (T4 §4) : la borne de deux emplacements
 * est une règle de produit, pas un réglage d'affichage.
 */
export const prosListResponseSchema = pageSchema(proCardSchema).extend({
  featured: z.array(proCardSchema),
  meta: z.object({ featuredLabel: z.string(), featuredSlots: z.number().int() }).strict(),
});

export type ProsListResponse = z.infer<typeof prosListResponseSchema>;

/**
 * `GET /pros/professions` — les métiers qui ont AU MOINS une fiche visible, du plus
 * représenté au moins représenté (lot W2A, phase 2.14).
 *
 * Les pastilles de l'annuaire (« Avocat », « Comptable »…) étaient six noms écrits
 * dans le front — dont un, « Auto-école », qui n'est pas dans le référentiel des
 * métiers. Elles viennent maintenant de cette liste : un métier sans fiche n'a pas
 * de pastille, et celui qui en a le plus passe en premier.
 */
export const prosProfessionsResponseSchema = z.object({
  items: z.array(z.object({ id: uuidSchema, nameFr: z.string(), count: z.number().int().positive() })),
});

export type ProsProfessionsResponse = z.infer<typeof prosProfessionsResponseSchema>;

/**
 * `GET /pros/:id` — la fiche, ses recommandations et le quota de contact.
 *
 * `contactQuota` est la DÉCISION DU SERVEUR (§4.4, « 3 contacts distincts par mois
 * en gratuit »), et `max` vaut `null` pour « illimité ». Le recalculer dans le
 * front demanderait de relire le plan du membre — exactement ce que le socle
 * interdit, et ce qui afficherait « 3 sur 3 » à un Premium.
 *
 * `canRecommend` aussi : §4.3 exige un contact existant, et seul le serveur sait
 * s'il y en a un.
 */
export const proDetailResponseSchema = proCardSchema
  .extend({
    verificationStatus: z.enum(ProVerificationStatus),
    mutualConnectionCount: z.number().int(),
    recommendations: z.array(
      z
        .object({
          id: uuidSchema,
          /** §4.3 : « Affichées avec le handle du recommandeur. » */
          handle: handleSchema,
          displayName: z.string(),
          comment: z.string().nullable(),
          createdAt: z.string().datetime(),
        })
        .strict(),
    ),
    myRecommendation: z
      .object({ id: uuidSchema, comment: z.string().nullable() })
      .strict()
      .nullable(),
    canRecommend: z.boolean(),
    contactQuota: z
      .object({ used: z.number().int(), max: z.number().int().nullable() })
      .strict()
      .nullable(),
  })
  .strict();

export type ProDetailResponse = z.infer<typeof proDetailResponseSchema>;

/**
 * `GET /me/pro-profile` — ma fiche, ou `null` quand je n'en ai pas.
 *
 * `hasProof` ET NON `proofAssetId`, et c'est §4.1 : le justificatif est réservé à
 * l'équipe. `PRO_SELECT` ne le sélectionne même pas, et le contrôleur n'en rend
 * qu'un booléen. Le `.strict()` interdit qu'un identifiant de justificatif
 * réapparaisse un jour dans cette réponse — ce serait la pièce d'identité d'un
 * professionnel servie à son propre navigateur, donc à son cache.
 */
export const myProProfileResponseSchema = proCardSchema
  .extend({
    verificationStatus: z.enum(ProVerificationStatus),
    status: z.string(),
    hasProof: z.boolean(),
  })
  .strict()
  .nullable();

export type MyProProfileResponse = z.infer<typeof myProProfileResponseSchema>;
