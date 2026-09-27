import { z } from 'zod';
import { GuideCategory, GuideScope, GuideVoteValue } from '../enums/generated.js';
import { cursorQuerySchema, uuidSchema } from './pagination.js';

/**
 * Guides et démarches — 05-guides.md §2 et §4.
 *
 * SOURCE UNIQUE (00-fondations.md §4) : ces schémas valident l'API ET les
 * formulaires de l'éditeur. Les bornes du §2.1 (titre 10–120, corps
 * 300–20 000), les seuils du §2.4 et du §2.6 et la table de fraîcheur du §2.3
 * vivent donc ici — le bandeau « À vérifier » affiché par le front et le
 * classement calculé par l'API emploient le MÊME coefficient, faute de quoi
 * l'écran et le tri finiraient par ne plus dire la même chose.
 *
 * Le mot « certifié » n'est PAS vérifié par ces schémas : §4 exige un code
 * d'erreur propre, `FORBIDDEN_WORD`, et non un `VALIDATION_FAILED` noyé dans la
 * liste des champs. Le service appelle `containsForbiddenWord` (constants/product).
 */

// ── Codes d'erreur (§4) ─────────────────────────────────────────────────────

export const GUIDE_ERROR_CODES = {
  /** Le mot « certifié » ou un dérivé, dans un titre (règle dure §2.1). */
  FORBIDDEN_WORD: 422,
  /** Bloqué par la modération à la publication (§2.1). */
  CONTENT_BLOCKED: 422,
  /** Trois guides publiés dans la journée (§2.1). */
  GUIDE_LIMIT_REACHED: 422,
  /** On ne vote pas, on ne signale pas et on ne propose pas sur son propre guide. */
  OWN_GUIDE: 422,
  /** Un signalement d'obsolescence par membre et par guide (§2.6). */
  ALREADY_FLAGGED: 409,
  /** Le passage visé n'existe plus, ou plus une seule fois (§2.4). */
  EXCERPT_NOT_FOUND: 409,
  /** Trois propositions en attente par membre et par guide (§2.4). */
  PROPOSAL_LIMIT: 422,
  /** Seul le créateur décide d'une proposition (§4). */
  NOT_AUTHOR: 403,
  /** Proposition déjà acceptée, refusée ou escaladée (§4). */
  ALREADY_DECIDED: 409,
  /** La conversion en guide demande un parcours terminé (§2.8). */
  JOURNEY_NOT_COMPLETED: 422,
} as const;

export type GuideErrorCode = keyof typeof GUIDE_ERROR_CODES;

export const GUIDE_ERROR_MESSAGES: Record<GuideErrorCode, string> = {
  FORBIDDEN_WORD:
    'Le mot « certifié » n’est pas autorisé dans un titre : la plateforme ne vérifie aucun dossier administratif.',
  CONTENT_BLOCKED: 'Ce contenu ne peut pas être publié en l’état. Notre équipe le relit.',
  GUIDE_LIMIT_REACHED: 'Vous avez publié trois guides aujourd’hui. Reprenez demain.',
  OWN_GUIDE: 'Il s’agit de votre guide : vous pouvez le modifier directement.',
  ALREADY_FLAGGED: 'Vous avez déjà signalé ce guide comme dépassé.',
  EXCERPT_NOT_FOUND:
    'Le passage visé a changé depuis votre sélection. Rechargez le guide et sélectionnez-le à nouveau.',
  PROPOSAL_LIMIT: 'Vous avez trois propositions en attente sur ce guide. Attendez une réponse.',
  NOT_AUTHOR: 'Seul l’auteur du guide peut répondre à cette proposition.',
  ALREADY_DECIDED: 'Cette proposition a déjà reçu une réponse.',
  JOURNEY_NOT_COMPLETED: 'Ce parcours n’est pas encore terminé.',
};

// ── Bornes et seuils (§2) ───────────────────────────────────────────────────

export const GUIDE_TITLE_MIN = 10;
export const GUIDE_TITLE_MAX = 120;
/** Le minimum ne s'applique qu'à la PUBLICATION : un brouillon s'enregistre à tout moment. */
export const GUIDE_BODY_MIN = 300;
export const GUIDE_BODY_MAX = 20_000;

/** §2.1 — trois guides publiés par jour. */
export const GUIDE_DAILY_PUBLISH_LIMIT = 3;
/** §2.4 — trois propositions PENDING par membre et par guide. */
export const GUIDE_PENDING_PROPOSAL_LIMIT = 3;
/** §2.4 — motif d'une proposition : 20 caractères minimum. */
export const GUIDE_PROPOSAL_REASON_MIN = 20;
/** §2.4 — sans décision au bout de 14 jours, la proposition est escaladée. */
export const GUIDE_PROPOSAL_ESCALATION_DAYS = 14;
/** §2.6 — trois signalements font passer le guide en FLAGGED. */
export const GUIDE_OUTDATED_FLAG_THRESHOLD = 3;
/** §2.6 — 30 jours pour corriger, puis dépublication. */
export const GUIDE_UNPUBLISH_DELAY_DAYS = 30;
/** §2.2 — cinq votes négatifs en sept jours ouvrent un dossier de modération. */
export const GUIDE_NEGATIVE_VOTE_THRESHOLD = 5;
export const GUIDE_NEGATIVE_VOTE_WINDOW_DAYS = 7;
/** §2.2 — priorité du dossier ouvert par la règle automatique. */
export const GUIDE_NEGATIVE_VOTE_CASE_PRIORITY = 4;
/** §2.4 — priorité du dossier ouvert par l'escalade d'une proposition. */
export const GUIDE_ESCALATION_CASE_PRIORITY = 3;
/** §2.5 — six mois sans session font basculer le guide en maintenance communautaire. */
export const GUIDE_AUTHOR_INACTIVITY_MONTHS = 6;
/** §2.3 — au-delà, bandeau « À vérifier » et entrée dans l'onglet du même nom. */
export const GUIDE_STALE_MONTHS = 24;

// ── Fraîcheur (§2.3) ────────────────────────────────────────────────────────

/**
 * `freshness_score = helpful_count × coeff(âge de last_content_update_at)`.
 *
 * Les tranches sont données par leur borne BASSE, en mois révolus, dans l'ordre
 * croissant : le coefficient est celui de la dernière tranche atteinte.
 *
 * Le tableau du §2.3 se recouvre à ses bornes (« < 6 mois », « 6–12 »,
 * « 12–24 », « > 24 »). Les deux bornes strictes de la spec tranchent :
 * « < 6 mois » exclut 6, « > 24 mois » exclut 24 — d'où 25 comme borne basse de
 * la dernière tranche, et un guide de 24 mois pile encore à 0,4. Le même choix
 * vaut pour l'onglet « À vérifier », qui retient « > 24 mois ».
 */
export const GUIDE_FRESHNESS_BRACKETS = [
  { fromMonths: 0, coefficient: 1 },
  { fromMonths: 6, coefficient: 0.7 },
  { fromMonths: 12, coefficient: 0.4 },
  { fromMonths: 25, coefficient: 0.2 },
] as const;

/**
 * Nombre de mois RÉVOLUS depuis une date.
 *
 * Calculé en mois calendaires, et non en tranches de 30 jours : le bandeau dit
 * « dernière mise à jour il y a N mois », et un membre qui compare à son
 * calendrier ne doit pas trouver un mois d'écart.
 */
export function monthsSince(date: Date, now: Date = new Date()): number {
  const months =
    (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
  const notYetReached = now.getDate() < date.getDate();
  return Math.max(0, notYetReached ? months - 1 : months);
}

export function freshnessCoefficient(monthsOld: number): number {
  let coefficient: number = GUIDE_FRESHNESS_BRACKETS[0].coefficient;
  for (const bracket of GUIDE_FRESHNESS_BRACKETS) {
    if (monthsOld >= bracket.fromMonths) coefficient = bracket.coefficient;
  }
  return coefficient;
}

/**
 * Le score de classement. Arrondi à quatre décimales, comme la colonne
 * `guides.freshness_score` (numeric(10,4)) : arrondir ici plutôt que de laisser
 * PostgreSQL tronquer évite qu'un test comparant les deux échoue pour un chiffre
 * de rang cinq.
 */
export function computeFreshnessScore(
  helpfulCount: number,
  lastContentUpdateAt: Date,
  now: Date = new Date(),
): number {
  const raw = helpfulCount * freshnessCoefficient(monthsSince(lastContentUpdateAt, now));
  return Math.round(raw * 10_000) / 10_000;
}

/** §2.3 — un guide dont le contenu n'a pas bougé depuis plus de 24 mois. */
export function isStaleGuide(lastContentUpdateAt: Date, now: Date = new Date()): boolean {
  return monthsSince(lastContentUpdateAt, now) > GUIDE_STALE_MONTHS;
}

// ── Slug (§2.1) ─────────────────────────────────────────────────────────────

/**
 * Slug depuis le titre. Translittéré, tronqué à 80 caractères pour laisser la
 * place au suffixe d'unicité. JAMAIS recalculé après publication (§2.1) : un
 * lien partagé dans une conversation doit continuer de fonctionner.
 */
export function slugifyGuideTitle(title: string): string {
  const base = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return base.length >= 2 ? base : 'guide';
}

// ── Markdown restreint (§2.1 et 00 §8.1) ────────────────────────────────────

/**
 * « Texte des membres : stocké brut, jamais du HTML. Formatage autorisé :
 * sous-ensemble Markdown (gras, italique, listes, liens) » (00 §8.1), auquel
 * §2.1 ajoute ICI les titres de niveau 2 et 3.
 *
 * Le niveau 1 reste interdit : le titre du guide est déjà le `h1` de la page, et
 * un second briserait la structure du document pour un lecteur d'écran.
 */
const HTML_TAG = /<\/?[a-zA-Z][^>]*>/;
const HEADING_OUT_OF_RANGE = /^[ \t]*(?:#|#{4,})[ \t]/m;
const MARKDOWN_IMAGE = /!\[[^\]]*\]\([^)]*\)/;

export function restrictedMarkdownIssue(body: string): 'HTML' | 'HEADING_LEVEL' | 'IMAGE' | null {
  if (HTML_TAG.test(body)) return 'HTML';
  if (HEADING_OUT_OF_RANGE.test(body)) return 'HEADING_LEVEL';
  // Les guides n'ont pas de table de médias : une image ne pourrait être qu'un
  // lien externe, hors du pipeline média (antivirus, EXIF) qu'exige 00 §8.2.
  if (MARKDOWN_IMAGE.test(body)) return 'IMAGE';
  return null;
}

const restrictedMarkdown = (schema: z.ZodString) =>
  schema.superRefine((value, ctx) => {
    const issue = restrictedMarkdownIssue(value);
    if (issue === null) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      params: { reason: issue },
      message:
        issue === 'HTML'
          ? 'Le HTML n’est pas autorisé : employez le Markdown.'
          : issue === 'HEADING_LEVEL'
            ? 'Seuls les titres de niveau 2 (##) et 3 (###) sont autorisés.'
            : 'Les images ne sont pas autorisées dans un guide.',
    });
  });

// ── Champs ──────────────────────────────────────────────────────────────────

const enumOf = <T extends string>(values: readonly T[]) =>
  z.enum(values as unknown as [T, ...T[]]);

export const guideCategorySchema = enumOf(GuideCategory);
export const guideScopeSchema = enumOf(GuideScope);
export const guideVoteValueSchema = enumOf(GuideVoteValue);

export const guideTitleSchema = z.string().trim().min(GUIDE_TITLE_MIN).max(GUIDE_TITLE_MAX);

/**
 * Corps d'un BROUILLON : le maximum s'applique, le minimum non.
 *
 * L'éditeur enregistre automatiquement (§5) ; refuser un brouillon de
 * 299 caractères perdrait le texte du membre au moment précis où il écrit.
 * Les 300 caractères du §2.1 sont exigés à la PUBLICATION.
 */
export const guideDraftBodySchema = restrictedMarkdown(z.string().min(1).max(GUIDE_BODY_MAX));

/** Corps publiable : les deux bornes du §2.1. */
export const guidePublishableBodySchema = restrictedMarkdown(
  z.string().min(GUIDE_BODY_MIN).max(GUIDE_BODY_MAX),
);

// ── Requêtes (§4) ───────────────────────────────────────────────────────────

/**
 * `scope = COUNTRY` exige `originCountryId` (§2.1, et la contrainte
 * `guides_country_scope` en base). Le refus est donc une VALIDATION propre, et
 * non une violation de contrainte remontée depuis PostgreSQL.
 */
const countryScopeCoherent = (
  value: { scope?: string | undefined; originCountryId?: string | undefined },
  ctx: z.RefinementCtx,
): void => {
  if (value.scope === 'COUNTRY' && value.originCountryId === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['originCountryId'],
      message: 'Un guide de portée « pays » doit indiquer son pays d’origine.',
    });
  }
};

export const createGuideSchema = z
  .object({
    title: guideTitleSchema,
    body: guideDraftBodySchema,
    category: guideCategorySchema,
    scope: guideScopeSchema,
    originCountryId: uuidSchema.optional(),
    cityId: uuidSchema.optional(),
  })
  .strict()
  .superRefine(countryScopeCoherent);

export type CreateGuide = z.infer<typeof createGuideSchema>;

/** §4 : `body`, `title` si DRAFT, `category`, `scope`, `cityId`. */
export const updateGuideSchema = z
  .object({
    title: guideTitleSchema.optional(),
    body: guideDraftBodySchema.optional(),
    category: guideCategorySchema.optional(),
    scope: guideScopeSchema.optional(),
    originCountryId: uuidSchema.nullable().optional(),
    cityId: uuidSchema.nullable().optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, { message: 'Aucune modification.' })
  .superRefine((patch, ctx) => {
    if (patch.scope === 'COUNTRY' && patch.originCountryId === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['originCountryId'],
        message: 'Un guide de portée « pays » doit indiquer son pays d’origine.',
      });
    }
  });

export type UpdateGuide = z.infer<typeof updateGuideSchema>;

export const guideListTabSchema = z.enum(['helpful', 'recent', 'review']).default('helpful');

export type GuideListTab = z.infer<typeof guideListTabSchema>;

export const guideListQuerySchema = cursorQuerySchema.extend({
  tab: guideListTabSchema,
  category: guideCategorySchema.optional(),
  countryId: uuidSchema.optional(),
  cityId: uuidSchema.optional(),
});

export type GuideListQuery = z.infer<typeof guideListQuerySchema>;

export const guideVoteSchema = z.object({ value: guideVoteValueSchema }).strict();

export const guideOutdatedFlagSchema = z
  .object({ comment: z.string().trim().min(1).max(500).optional() })
  .strict();

export const guideRevertSchema = z.object({ versionId: uuidSchema }).strict();

/**
 * §2.4 — le passage visé est COPIÉ TEL QUEL depuis la version courante : le
 * proposant ne le retouche pas, sinon le serveur ne pourrait plus le retrouver.
 */
export const createProposalSchema = z
  .object({
    targetExcerpt: z.string().min(3).max(4_000),
    replacement: z.string().max(GUIDE_BODY_MAX),
    reason: z.string().trim().min(GUIDE_PROPOSAL_REASON_MIN).max(1_000),
    sourceUrl: z.string().url().max(500).optional(),
  })
  .strict();

export type CreateProposal = z.infer<typeof createProposalSchema>;

/** « Accepter en modifiant » (§2.4) : le créateur ajuste le texte proposé. */
export const amendProposalSchema = z
  .object({ replacement: z.string().max(GUIDE_BODY_MAX) })
  .strict();

/** Refus : motif OBLIGATOIRE (§2.4), le proposant en est notifié. */
export const rejectProposalSchema = z
  .object({ reason: z.string().trim().min(10).max(1_000) })
  .strict();

// ── Réponses ────────────────────────────────────────────────────────────────

/**
 * Bandeaux du §2.3 et du §2.6. Renvoyés par l'API, et non recomposés par le
 * front : le seuil de 24 mois et celui de 3 signalements sont des règles
 * métier, pas des détails d'affichage.
 */
export type GuideBannerKind = 'TO_VERIFY' | 'OUTDATED_REPORTED' | 'COMMUNITY_MAINTAINED';

export interface GuideBanner {
  readonly kind: GuideBannerKind;
  /** Renseigné pour `TO_VERIFY` : « dernière mise à jour il y a N mois ». */
  readonly months?: number;
}

/**
 * Une carte de liste (§5).
 *
 * RÈGLE (T1 §6, règle dure §9) : `lastContentUpdateAt` figure sur CHAQUE guide
 * de liste — « date de mise à jour aussi visible que le titre ». Le type
 * l'impose : un champ facultatif serait oublié un jour.
 */
export interface GuideListItem {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly category: GuideCategory;
  readonly scope: GuideScope;
  readonly status: string;
  readonly lastContentUpdateAt: Date;
  readonly helpfulCount: number;
  readonly freshnessScore: number;
  readonly maintainedByCommunity: boolean;
  readonly author: { readonly handle: string; readonly displayName: string; readonly verificationLevel: string } | null;
  readonly country: { readonly id: string; readonly iso2: string; readonly nameFr: string } | null;
  readonly city: { readonly id: string; readonly name: string } | null;
  readonly banners: readonly GuideBanner[];
}
