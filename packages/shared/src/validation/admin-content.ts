import { z } from 'zod';
import {
  BlockerTarget,
  GuideStatus,
  Phase,
  PlanCode,
  StepCategory,
} from '../enums/generated.js';
import { cursorQuerySchema, uuidSchema } from './pagination.js';

/**
 * Administration — contenu, annonces, drapeaux, modèles de parcours et guides.
 *
 * AJOUT du lot « administration et contenu légal » : ces schémas sont ceux des
 * routes que 15 §7 promettait (`/pages`, `/announcements`, `/flags`,
 * `/users/:id/{note,delete-now,export}`, `/stats/migrations`, `/impact/export`) et
 * que 03 §5.2 et 05 §4 renvoient à l'administration (`/journey-templates/*`,
 * `/guides`). Même règle que `admin.ts` : `packages/shared` est la source unique,
 * le front importe ces bornes au lieu de les recopier.
 */

// ── Pages statiques (15 §4.1) ───────────────────────────────────────────────

/** Les deux documents dont une nouvelle version redemande le consentement (01 §2.10). */
export const CONSENT_PAGE_SLUGS = ['cgu', 'confidentialite'] as const;

/** Les quatre pages légales que la plateforme doit porter (01 §2.10, mentions LCEN, cookies). */
export const LEGAL_PAGE_SLUGS = ['cgu', 'confidentialite', 'cookies', 'mentions-legales'] as const;

export const PAGE_BODY_MAX = 200_000;

export const pageSlugSchema = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lettres minuscules, chiffres et tirets.');

/** Un brouillon : le titre, le corps en Markdown, et un résumé des changements. */
export const pageDraftSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    body: z.string().min(1).max(PAGE_BODY_MAX),
    changelog: z.string().trim().min(1).max(500).optional(),
  })
  .strict();
export type PageDraft = z.infer<typeof pageDraftSchema>;

export const pageCreateSchema = pageDraftSchema.extend({ slug: pageSlugSchema }).strict();
export type PageCreate = z.infer<typeof pageCreateSchema>;

/** `GET /pages/:slug` — la page EN VIGUEUR, telle que la lisent les membres. */
export const staticPagePublicSchema = z.object({
  slug: z.string(),
  title: z.string(),
  body: z.string(),
  /** Le numéro de la version en vigueur, en chaîne (`consents.version`). */
  version: z.string(),
  publishedAt: z.string(),
});
export type StaticPagePublic = z.infer<typeof staticPagePublicSchema>;

// ── Annonces (15 §4.2) ──────────────────────────────────────────────────────

/** Le ciblage : « villes, pays, phases, plans » — un tableau vide ou absent veut dire tous. */
export const audienceSchema = z
  .object({
    cityIds: z.array(uuidSchema).max(200).optional(),
    countryIds: z.array(uuidSchema).max(200).optional(),
    phases: z.array(z.enum(Phase)).max(10).optional(),
    plans: z.array(z.enum(PlanCode)).max(10).optional(),
  })
  .strict();
export type Audience = z.infer<typeof audienceSchema>;

export const ANNOUNCEMENT_TITLE_MAX = 120;
export const ANNOUNCEMENT_BODY_MAX = 500;

export const announcementWriteSchema = z
  .object({
    title: z.string().trim().min(1).max(ANNOUNCEMENT_TITLE_MAX),
    body: z.string().trim().min(1).max(ANNOUNCEMENT_BODY_MAX),
    target: audienceSchema.nullable().optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date().nullable().optional(),
  })
  .strict()
  .refine((v) => v.endsAt === null || v.endsAt === undefined || v.endsAt > v.startsAt, {
    message: 'La fin doit suivre le début.',
    path: ['endsAt'],
  });
export type AnnouncementWrite = z.infer<typeof announcementWriteSchema>;

export const announcementListQuerySchema = cursorQuerySchema
  .extend({ state: z.enum(['active', 'upcoming', 'ended', 'all']).default('all') })
  .strict();
export type AnnouncementListQuery = z.infer<typeof announcementListQuerySchema>;

/** `GET /announcements/active` — l'annonce du membre, ou `null`. */
export const activeAnnouncementSchema = z.object({
  announcement: z
    .object({ id: z.string(), title: z.string(), body: z.string(), startsAt: z.string() })
    .nullable(),
});
export type ActiveAnnouncement = z.infer<typeof activeAnnouncementSchema>;

// ── Feature flags (15 §4.3) ─────────────────────────────────────────────────

export const flagKeySchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/, 'Minuscules, chiffres, points, tirets et soulignés.');

export const flagWriteSchema = z
  .object({
    key: flagKeySchema,
    isEnabled: z.boolean(),
    /** 0 à 100 : la part des membres concernés, par hachage stable de l'identifiant. */
    rolloutPct: z.number().int().min(0).max(100).default(100),
    conditions: audienceSchema.nullable().optional(),
  })
  .strict();
export type FlagWrite = z.infer<typeof flagWriteSchema>;

export const flagUpdateSchema = z
  .object({
    isEnabled: z.boolean().optional(),
    rolloutPct: z.number().int().min(0).max(100).optional(),
    conditions: audienceSchema.nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Rien à modifier.' });
export type FlagUpdate = z.infer<typeof flagUpdateSchema>;

/** `GET /me/flags` — l'état de chaque drapeau pour CE membre. */
export const myFlagsSchema = z.object({ flags: z.record(z.string(), z.boolean()) });
export type MyFlags = z.infer<typeof myFlagsSchema>;

// ── Fiche membre : note, suppression immédiate, export (15 §3.2) ────────────

export const MEMBER_NOTE_MAX = 2000;

/** Suppression immédiate : le motif ET la saisie du pseudo (15 §3.2). */
export const memberDeleteNowSchema = z
  .object({
    reason: z.string().trim().min(20).max(500),
    confirmHandle: z.string().trim().min(1).max(60),
  })
  .strict();
export type MemberDeleteNow = z.infer<typeof memberDeleteNowSchema>;
export const memberNoteSchema = z.object({ body: z.string().trim().min(1).max(MEMBER_NOTE_MAX) }).strict();
export type MemberNoteInput = z.infer<typeof memberNoteSchema>;

// ── Modèles de parcours (03 §5.2) ───────────────────────────────────────────

export const templateCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[A-Z][A-Z0-9_]*$/, 'Majuscules, chiffres et soulignés.');

export const templateWriteSchema = z
  .object({
    code: templateCodeSchema,
    nameFr: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).nullable().optional(),
    targetPhase: z.enum(Phase),
    icon: z.string().trim().max(40).nullable().optional(),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().min(0).max(1000).default(100),
    createsJourney: z.boolean().default(true),
  })
  .strict();
export type TemplateWrite = z.infer<typeof templateWriteSchema>;
export const templateUpdateSchema = templateWriteSchema
  .partial()
  .omit({ code: true })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Rien à modifier.' });
export type TemplateUpdate = z.infer<typeof templateUpdateSchema>;

export const stepDefinitionWriteSchema = z
  .object({
    code: templateCodeSchema,
    nameFr: z.string().trim().min(1).max(160),
    description: z.string().trim().max(1000).nullable().optional(),
    category: z.enum(StepCategory),
    defaultDurationDays: z.number().int().min(0).max(1500).nullable().optional(),
    guideId: uuidSchema.nullable().optional(),
    blockerTarget: z.enum(BlockerTarget).default('NONE'),
    blockerTemplate: z.string().trim().max(1000).nullable().optional(),
    isMajorMilestone: z.boolean().default(false),
    isRisky: z.boolean().default(false),
    riskMessage: z.string().trim().max(500).nullable().optional(),
    documentChecklist: z.array(z.string().trim().min(1).max(160)).max(40).default([]),
  })
  .strict();
export type StepDefinitionWrite = z.infer<typeof stepDefinitionWriteSchema>;
export const stepDefinitionUpdateSchema = stepDefinitionWriteSchema
  .partial()
  .omit({ code: true })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Rien à modifier.' });
export type StepDefinitionUpdate = z.infer<typeof stepDefinitionUpdateSchema>;

export const versionCreateSchema = z
  .object({
    /** Null = version générique ; un pays = déclinaison par pays d'origine. */
    originCountryId: uuidSchema.nullable().optional(),
    /** Part de la version publiée la plus proche (03 §5.2 : « copie de la version publiée ou vide »). */
    copyPublished: z.boolean().default(true),
    changelog: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();
export type VersionCreate = z.infer<typeof versionCreateSchema>;

/**
 * La composition ORDONNÉE d'une version : l'ordre du tableau est la position.
 * Les dépendances désignent les étapes par leur INDEX dans ce tableau — les
 * lignes `template_steps` sont recréées à chaque enregistrement, leurs
 * identifiants ne sont donc pas stables.
 */
export const versionStepsSchema = z
  .object({
    steps: z
      .array(
        z
          .object({
            stepDefinitionId: uuidSchema,
            isOptional: z.boolean().default(false),
            /** Négatif = après l'arrivée. */
            daysBeforeArrival: z.number().int().min(-1500).max(1500).nullable().optional(),
            overrides: z
              .object({
                nameFr: z.string().trim().min(1).max(160).optional(),
                blockerTemplate: z.string().trim().max(1000).optional(),
              })
              .strict()
              .nullable()
              .optional(),
          })
          .strict(),
      )
      .max(60),
    dependencies: z
      .array(z.object({ step: z.number().int().min(0).max(59), dependsOn: z.number().int().min(0).max(59) }).strict())
      .max(200)
      .default([]),
    changelog: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();
export type VersionSteps = z.infer<typeof versionStepsSchema>;

export const versionPublishSchema = z
  .object({ changelog: z.string().trim().min(1).max(1000).optional() })
  .strict();
export type VersionPublish = z.infer<typeof versionPublishSchema>;

export const correctionQuerySchema = cursorQuerySchema
  .extend({ status: z.enum(['PENDING', 'ACCEPTED', 'REJECTED']).default('PENDING') })
  .strict();
export type CorrectionQuery = z.infer<typeof correctionQuerySchema>;

export const correctionDecisionSchema = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('ACCEPT') }).strict(),
  z
    .object({
      decision: z.literal('REJECT'),
      reason: z.string().trim().min(10, 'Un motif d’au moins 10 caractères.').max(500),
    })
    .strict(),
]);
export type CorrectionDecision = z.infer<typeof correctionDecisionSchema>;

// ── Guides, côté équipe (05 §4) ─────────────────────────────────────────────

export const adminGuidesQuerySchema = cursorQuerySchema
  .extend({
    status: z.enum(GuideStatus).optional(),
    /** `flagged` : signalés obsolètes ; `escalated` : propositions escaladées. */
    view: z.enum(['all', 'flagged']).default('all'),
  })
  .strict();
export type AdminGuidesQuery = z.infer<typeof adminGuidesQuerySchema>;

export const adminGuideStatusSchema = z
  .object({
    status: z.enum(['FLAGGED', 'UNPUBLISHED', 'PUBLISHED']),
    reason: z.string().trim().min(10).max(500),
  })
  .strict();
export type AdminGuideStatus = z.infer<typeof adminGuideStatusSchema>;

export const adminGuideRevertSchema = z
  .object({ versionId: uuidSchema, reason: z.string().trim().min(10).max(500) })
  .strict();
export type AdminGuideRevert = z.infer<typeof adminGuideRevertSchema>;

export const adminGuideMaintainedSchema = z.object({ maintainedByCommunity: z.boolean() }).strict();
export type AdminGuideMaintained = z.infer<typeof adminGuideMaintainedSchema>;

export const adminProposalDecisionSchema = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('ACCEPT') }).strict(),
  z
    .object({
      decision: z.literal('REJECT'),
      reason: z.string().trim().min(10).max(500),
    })
    .strict(),
]);
export type AdminProposalDecision = z.infer<typeof adminProposalDecisionSchema>;

// ── Impact : export (15 §5.3) ───────────────────────────────────────────────

export const impactExportQuerySchema = z
  .object({ quarter: z.string().regex(/^\d{4}-[TQ][1-4]$/).optional() })
  .strict();

// ── Codes d'erreur ──────────────────────────────────────────────────────────

export const ADMIN_CONTENT_ERROR_CODES = {
  PAGE_SLUG_TAKEN: 409,
  PAGE_NO_DRAFT: 409,
  PAGE_NOT_DELETABLE: 409,
  FLAG_KEY_TAKEN: 409,
  TEMPLATE_CODE_TAKEN: 409,
  STEP_CODE_TAKEN: 409,
  VERSION_NOT_DRAFT: 409,
  VERSION_EMPTY: 422,
  VERSION_CYCLE: 422,
  VERSION_DEPENDENCY_INVALID: 422,
  VERSION_SLOT_TAKEN: 409,
  CORRECTION_ALREADY_DECIDED: 409,
  MEMBER_DELETE_CONFIRMATION: 422,
  GUIDE_NOT_ESCALATED: 409,
} as const;
export type AdminContentErrorCode = keyof typeof ADMIN_CONTENT_ERROR_CODES;

export const ADMIN_CONTENT_ERROR_MESSAGES: Record<AdminContentErrorCode, string> = {
  PAGE_SLUG_TAKEN: 'Une page porte déjà cet identifiant.',
  PAGE_NO_DRAFT: 'Cette page n’a pas de brouillon à publier.',
  PAGE_NOT_DELETABLE: 'Une page déjà publiée ne se supprime pas : publiez une nouvelle version.',
  FLAG_KEY_TAKEN: 'Un drapeau porte déjà cette clé.',
  TEMPLATE_CODE_TAKEN: 'Un type de parcours porte déjà ce code.',
  STEP_CODE_TAKEN: 'Une définition d’étape porte déjà ce code.',
  VERSION_NOT_DRAFT: 'Seul un brouillon peut être modifié ou publié.',
  VERSION_EMPTY: 'Une version doit compter au moins une étape.',
  VERSION_CYCLE: 'Les dépendances forment une boucle : une étape ne peut dépendre d’elle-même, même de loin.',
  VERSION_DEPENDENCY_INVALID: 'Une dépendance désigne une étape qui n’existe pas dans cette version.',
  VERSION_SLOT_TAKEN: 'Un brouillon existe déjà pour ce type et ce pays.',
  CORRECTION_ALREADY_DECIDED: 'Cette proposition a déjà été traitée.',
  MEMBER_DELETE_CONFIRMATION: 'Saisissez le pseudo du membre pour confirmer la suppression.',
  GUIDE_NOT_ESCALATED: 'Cette proposition n’a pas été escaladée à l’équipe.',
};

// ── Actions d'audit de ce module ────────────────────────────────────────────

export const ADMIN_CONTENT_AUDIT_ACTIONS = {
  pageCreated: 'page.created',
  pageDrafted: 'page.drafted',
  pagePublished: 'page.published',
  pageDeleted: 'page.deleted',
  announcementCreated: 'announcement.created',
  announcementUpdated: 'announcement.updated',
  announcementDeleted: 'announcement.deleted',
  flagCreated: 'flag.created',
  flagChanged: 'flag.changed',
  flagDeleted: 'flag.deleted',
  memberNoteAdded: 'user.note_added',
  userDeletedNow: 'user.deleted_now',
  userExported: 'user.exported',
  templateCreated: 'template.created',
  templateUpdated: 'template.updated',
  stepDefinitionCreated: 'step_definition.created',
  stepDefinitionUpdated: 'step_definition.updated',
  templateVersionCreated: 'template.version_created',
  templateVersionEdited: 'template.version_edited',
  templateVersionPublished: 'template.publish',
  templateVersionArchived: 'template.version_archived',
  correctionDecided: 'template.correction_decided',
  guideStatusForced: 'guide.status_forced',
  guideReverted: 'guide.reverted',
  guideMaintainedToggled: 'guide.maintained_toggled',
  guideProposalDecided: 'guide.proposal_decided_by_staff',
  impactExported: 'impact.exported',
} as const;
