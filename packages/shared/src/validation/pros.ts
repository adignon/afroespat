import { z } from 'zod';
import { ProContactMethod } from '../enums/generated.js';
import { containsForbiddenWord } from '../constants/product.js';
import { cursorQuerySchema, uuidSchema } from './pagination.js';

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
