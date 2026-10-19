import { z } from 'zod';

/**
 * Schémas de RÉPONSE des routes d'équipe ajoutées par le lot « administration et
 * contenu légal » — même règle que `admin.ts` : `packages/shared` est la source
 * unique, le front les importe et le transport REFUSE (`ApiShapeError`) toute réponse
 * qui ne leur correspond pas.
 *
 * Ils sont RELEVÉS sur l'API qui tourne, avec une vraie session d'équipe (mot de
 * passe puis TOTP), et non déduits des services. Les objets sont `passthrough()` :
 * un champ de plus côté serveur n'est pas un contrat cassé, un champ qui manque ou
 * qui change de type l'est.
 */

const dateStr = z.string();
const nullableStr = z.string().nullable();

// ── Connexion (15 §2.1) ─────────────────────────────────────────────────────

export const staffLoginResponseSchema = z.object({
  challenge: z.string(),
  expiresInSeconds: z.number(),
  enrollmentRequired: z.boolean(),
});
export const staffEnrollResponseSchema = z.object({
  secret: z.string(),
  otpauthUri: z.string(),
  challenge: z.string(),
});
export const staffOpenedSchema = z.object({
  staff: z.object({ id: z.string(), role: z.string(), displayName: z.string() }),
  expiresAt: dateStr,
});
export const loggedOutSchema = z.object({ loggedOut: z.boolean() });
/** Un accusé : l'écriture a réussi, la forme exacte n'importe pas à l'écran. */
export const okResponseSchema = z.object({}).passthrough();

// ── Pages (15 §4.1) ─────────────────────────────────────────────────────────

export const adminPageSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    liveVersion: nullableStr,
    publishedAt: nullableStr,
    updatedAt: dateStr,
    asksConsent: z.boolean(),
    draft: z
      .object({
        id: z.string(),
        version: z.number(),
        title: z.string(),
        changelog: nullableStr,
        updatedAt: dateStr,
        body: z.string().optional(),
      })
      .passthrough()
      .nullable(),
    versions: z.array(
      z
        .object({ id: z.string(), version: z.number(), title: z.string(), changelog: nullableStr, publishedAt: dateStr, body: z.string().optional() })
        .passthrough(),
    ),
    body: z.string().optional(),
  })
  .passthrough();
export type AdminPage = z.infer<typeof adminPageSchema>;
export const adminPagesResponseSchema = z.object({ items: z.array(adminPageSchema) });

// ── Annonces (15 §4.2) ──────────────────────────────────────────────────────

export const adminAnnouncementSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    body: z.string(),
    target: z
      .object({
        cityIds: z.array(z.string()).optional(),
        countryIds: z.array(z.string()).optional(),
        phases: z.array(z.string()).optional(),
        plans: z.array(z.string()).optional(),
      })
      .nullable(),
    startsAt: dateStr,
    endsAt: nullableStr,
    state: z.enum(['active', 'upcoming', 'ended']),
  })
  .passthrough();
export type AdminAnnouncement = z.infer<typeof adminAnnouncementSchema>;
export const adminAnnouncementsResponseSchema = z.object({
  items: z.array(adminAnnouncementSchema),
  nextCursor: nullableStr,
});

// ── Feature flags (15 §4.3) ─────────────────────────────────────────────────

export const adminFlagSchema = z
  .object({
    id: z.string(),
    key: z.string(),
    isEnabled: z.boolean(),
    rolloutPct: z.number(),
    conditions: z
      .object({
        cityIds: z.array(z.string()).optional(),
        countryIds: z.array(z.string()).optional(),
        phases: z.array(z.string()).optional(),
        plans: z.array(z.string()).optional(),
      })
      .nullable(),
  })
  .passthrough();
export type AdminFlag = z.infer<typeof adminFlagSchema>;
export const adminFlagsResponseSchema = z.object({ items: z.array(adminFlagSchema) });

// ── Fiche membre ────────────────────────────────────────────────────────────

// ── Modèles de parcours (03 §5.2) ───────────────────────────────────────────

export const adminTemplatesResponseSchema = z.object({
  items: z.array(
    z
      .object({
        id: z.string(),
        code: z.string(),
        nameFr: z.string(),
        isActive: z.boolean(),
        versions: z.array(
          z
            .object({
              id: z.string(),
              version: z.number(),
              status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
              originCountry: nullableStr,
              changelog: nullableStr,
              stepCount: z.number(),
              journeyCount: z.number(),
            })
            .passthrough(),
        ),
      })
      .passthrough(),
  ),
});
export type AdminTemplates = z.infer<typeof adminTemplatesResponseSchema>;

export const adminVersionSchema = z
  .object({
    id: z.string(),
    version: z.number(),
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
    changelog: nullableStr,
    journeyCount: z.number(),
    template: z.object({ id: z.string(), code: z.string(), nameFr: z.string() }).passthrough(),
    originCountry: z.object({ nameFr: z.string() }).passthrough().nullable(),
    steps: z.array(
      z
        .object({
          stepDefinitionId: z.string(),
          code: z.string(),
          nameFr: z.string(),
          isOptional: z.boolean(),
          daysBeforeArrival: z.number().nullable(),
          isRisky: z.boolean(),
        })
        .passthrough(),
    ),
    dependencies: z.array(z.object({ step: z.number(), dependsOn: z.number() })),
  })
  .passthrough();
export type AdminVersion = z.infer<typeof adminVersionSchema>;

export const adminPublishResponseSchema = adminVersionSchema.extend({
  archivedVersions: z.number(),
  journeysStaying: z.number(),
});

export const adminStepDefinitionSchema = z
  .object({
    id: z.string(),
    code: z.string(),
    nameFr: z.string(),
    description: nullableStr,
    category: z.string(),
    defaultDurationDays: z.number().nullable(),
    blockerTarget: z.string(),
    blockerTemplate: nullableStr,
    isMajorMilestone: z.boolean(),
    isRisky: z.boolean(),
    riskMessage: nullableStr,
    documentChecklist: z.array(z.string()),
    guideTitle: nullableStr,
  })
  .passthrough();
export type AdminStepDefinition = z.infer<typeof adminStepDefinitionSchema>;
export const adminStepDefinitionsResponseSchema = z.object({
  items: z.array(adminStepDefinitionSchema),
  nextCursor: nullableStr,
  meta: z.object({ total: z.number() }).passthrough().optional(),
});

export const adminCorrectionsResponseSchema = z.object({
  items: z.array(
    z
      .object({ id: z.string(), message: z.string(), template: z.string(), version: z.number(), step: z.object({ nameFr: z.string() }).passthrough().nullable() })
      .passthrough(),
  ),
  nextCursor: nullableStr,
});

export const adminStatsPointsSchema = z.object({
  items: z.array(z.object({ metric: z.string(), dimension: z.string(), value: z.number(), periodStart: dateStr })),
});
export const adminMigrationsResponseSchema = z.object({
  items: z.array(
    z
      .object({ templateName: z.string(), templateCode: z.string(), version: z.number(), journeys: z.number(), currentVersion: z.number().nullable() })
      .passthrough(),
  ),
});

// ── Guides côté équipe (05 §4) ──────────────────────────────────────────────

export const adminGuideCountsSchema = z.object({ escalated: z.number(), flagged: z.number(), all: z.number() });
export const adminGuidesResponseSchema = z.object({
  items: z.array(
    z
      .object({
        id: z.string(),
        title: z.string(),
        status: z.string(),
        maintainedByCommunity: z.boolean(),
        outdatedFlagCount: z.number(),
        unpublishInDays: z.number().nullable(),
      })
      .passthrough(),
  ),
  nextCursor: nullableStr,
});
export const adminEscalatedResponseSchema = z.object({
  items: z.array(
    z
      .object({
        id: z.string(),
        guideId: z.string(),
        guideTitle: z.string(),
        maintainedByCommunity: z.boolean(),
        before: z.string(),
        after: z.string(),
        daysOverdue: z.number(),
      })
      .passthrough(),
  ),
});
export const adminGuideVersionsSchema = z.object({
  items: z.array(z.object({ id: z.string(), version: z.number(), summary: nullableStr, createdAt: dateStr })),
});

// ── Alertes arnaques côté équipe (13 §5) ────────────────────────────────────

export const adminScamAlertsResponseSchema = z.object({
  items: z.array(
    z
      .object({
        id: z.string(),
        title: z.string(),
        body: z.string(),
        severity: z.enum(['INFO', 'WARNING', 'CRITICAL']),
        cityId: nullableStr,
        countryId: nullableStr,
        cityName: nullableStr,
        countryName: nullableStr,
        isPinned: z.boolean(),
        publishedAt: nullableStr,
        expiresAt: nullableStr,
        state: z.enum(['draft', 'active', 'ended']),
      })
      .passthrough(),
  ),
});

