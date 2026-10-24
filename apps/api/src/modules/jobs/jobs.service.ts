import { Injectable, Logger } from '@nestjs/common';
import { newId, type Prisma } from '@app/db';
import {
  type CreateJob,
  type CreateMemberRecommendation,
  FREE_SPONSORED_JOBS_PER_MONTH,
  JOB_ERROR_CODES,
  JOB_ERROR_MESSAGES,
  JOB_LIFETIME_DAYS,
  JOB_RENEW_INTERVAL_DAYS,
  JOB_SCAM_TERM_PATTERN,
  JOB_SPONSORED_DAYS,
  JOB_SPONSORED_HEAD_SLOTS,
  JOB_SPONSORED_LABEL,
  type JobErrorCode,
  type JobKind,
  type JobSeekerProfileInput,
  type JobSeekersQuery,
  type JobsQuery,
  type Page,
  type UpdateJob,
  type UserPlan,
  sharedByLabel,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { planEffectif } from '../../common/monetisation';
import { AuditService } from '../../common/audit.service';
import { buildPage, decodeCursor } from '../../common/cursor';
import { OutboxService } from '../../common/outbox.service';
import { PrismaService } from '../../common/prisma.service';
import { VisibilityService } from '../../common/visibility.service';
import { loadEnv } from '../../config/env';
import { assertLocalRules } from '../../common/content-gate';

/**
 * Emploi — 10-services.md §3.
 *
 * Trois décisions expliquent la forme de ce service :
 *
 *   · la MISE EN AVANT est payante, mais jamais discrète. §3.1 exige la pastille
 *     « toujours visible », et la règle dure du §11 borne la tête de liste à deux
 *     emplacements. Les deux tiennent ensemble dans `list()` : les sponsorisées
 *     sortent dans un champ SÉPARÉ, plafonné, et celles qui débordent retombent dans
 *     le classement naturel — avec leur pastille. Rien dans cette réponse ne permet
 *     à un front d'afficher une offre sponsorisée sans la signaler, parce que le
 *     drapeau voyage avec la carte, pas avec la position ;
 *
 *   · un PROFIL de recherche n'est pas un CV. §3.2 : « Aucun CV stocké en V1 ; le
 *     membre l'envoie lui-même en message. » Le service n'a donc aucune notion de
 *     fichier, et `job_seeker_profiles` ne porte que trois champs de texte ;
 *
 *   · une RECOMMANDATION de membre n'a « aucun effet de réputation en V1 » (§3.3).
 *     Aucun `ReputationEvent` n'est écrit ici, volontairement : la spec explique
 *     pourquoi — cela inviterait aux recommandations de complaisance.
 *
 * COLONNES MANQUANTES (§5 les annonce « ajoutées », le schéma figé ne les porte pas) :
 *   · `job_listings.renewed_at` : l'intervalle est déduit de `expires_at`, comme pour
 *     le logement ;
 *   · `job_listings.sponsored_count_month` : le compte mensuel est DÉDUIT de
 *     `sponsored_until`, la durée de mise en avant étant fixe (14 jours). L'enum
 *     `UsageMetric` est figé et ne porte pas de métrique de mise en avant, donc
 *     `usage_counters` n'était pas une option non plus. Limite connue : une offre
 *     mise en avant deux fois dans le mois n'est comptée qu'une fois — d'où
 *     `ALREADY_SPONSORED`, qui interdit le cas le plus courant.
 */

export interface JobCard {
  readonly id: string;
  readonly kind: JobKind;
  readonly title: string;
  readonly description: string;
  readonly companyName: string | null;
  readonly city: { readonly id: string; readonly name: string; readonly slug: string } | null;
  readonly contractType: string | null;
  readonly sector: string | null;
  readonly educationLevel: string | null;
  readonly externalUrl: string | null;
  readonly status: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  /**
   * RÈGLE DURE (§11) : la pastille suit l'offre partout. `isSponsored` est calculé
   * sur la DATE, jamais recopié de la colonne : une mise en avant expirée doit
   * cesser d'être annoncée, et la tâche `sponsored.expire` (§9) peut avoir du retard.
   */
  readonly isSponsored: boolean;
  readonly sponsoredLabel: string | null;
  readonly sponsoredUntil: Date | null;
  readonly author: {
    readonly handle: string;
    readonly displayName: string;
    readonly avatarUrl: string | null;
  };
  /** §3.1 : « Partagée par Sandra M. » — une offre de membre est gratuite et le dit. */
  readonly sharedBy: string;
  readonly isMine: boolean;
  readonly canRenew: boolean | null;
  readonly recommendationCount: number;
}

const JOB_SELECT = {
  id: true,
  createdAt: true,
  deletedAt: true,
  authorUserId: true,
  kind: true,
  title: true,
  description: true,
  companyName: true,
  contractType: true,
  sector: true,
  educationLevel: true,
  externalUrl: true,
  isSponsored: true,
  sponsoredUntil: true,
  status: true,
  expiresAt: true,
  city: { select: { id: true, name: true, slug: true } },
  author: {
    select: { handle: true, displayName: true, avatarAsset: { select: { storageKey: true } } },
  },
  _count: { select: { memberRecommendations: true } },
} satisfies Prisma.JobListingSelect;

type JobRow = Prisma.JobListingGetPayload<{ select: typeof JOB_SELECT }>;

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  private readonly cursorSecret = loadEnv().CURSOR_SECRET;

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly visibility: VisibilityService,
  ) {}

  private fail(code: JobErrorCode, details?: Record<string, unknown>): never {
    throw new ApiError(code, JOB_ERROR_MESSAGES[code], JOB_ERROR_CODES[code], details);
  }

  // ── Offres (§3.1) ─────────────────────────────────────────────────────────

  async create(authorUserId: string, input: CreateJob): Promise<JobCard> {
    // 13 §2.1 : les règles locales, avant que l'offre n'existe.
    assertLocalRules(input.title, input.description);
    const cityId = input.cityId === undefined || input.cityId === null
      ? null
      : await this.resolveCityId(input.cityId);

    const jobId = newId();
    const expiresAt = new Date(Date.now() + JOB_LIFETIME_DAYS * 86_400_000);
    // §3.1 : « arnaques à l'emploi : frais d'inscription, formation payante
    // obligatoire → MONEY_REQUEST ». Détecté LOCALEMENT sur les termes que la spec
    // nomme ; le pipeline IA complet du module 13 s'ajoute via `job.published`.
    const scam = JOB_SCAM_TERM_PATTERN.test(`${input.title}\n${input.description}`);

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.jobListing.create({
        data: {
          id: jobId,
          authorUserId,
          kind: input.kind,
          title: input.title,
          description: input.description,
          companyName: input.companyName ?? null,
          cityId,
          contractType: input.contractType ?? null,
          sector: input.sector ?? null,
          educationLevel: input.educationLevel ?? null,
          externalUrl: input.externalUrl ?? null,
          status: 'ACTIVE',
          expiresAt,
        },
        select: JOB_SELECT,
      });

      if (scam) {
        // `job_listings` ne porte AUCUNE colonne de modération : l'offre reste donc
        // en ligne pendant la revue, contrairement à une annonce de logement. C'est
        // une limite du schéma, signalée, et la priorité 1 la compense — une demande
        // d'argent est traitée en 4 h (13 §…).
        await this.openScamCase(tx, jobId, authorUserId);
      }

      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: authorUserId },
        action: 'job.created',
        targetType: 'job_listing',
        targetId: jobId,
        metadata: { kind: input.kind, cityId, scamTermsDetected: scam },
      });

      await this.outbox.emit(tx, {
        type: 'job.published',
        aggregateId: jobId,
        payload: {
          authorUserId,
          kind: input.kind,
          cityId,
          sector: input.sector ?? null,
          scamTermsDetected: scam,
        },
      });

      return created;
    });

    return this.toCard(row, authorUserId);
  }

  async update(jobId: string, authorUserId: string, patch: UpdateJob): Promise<JobCard> {
    const job = await this.loadOwned(jobId, authorUserId);
    if (job.status === 'REMOVED') throw ApiError.transverse('CONFLICT', { status: 'REMOVED' });
    assertLocalRules(patch.title, patch.description);

    const cityId =
      patch.cityId === undefined
        ? undefined
        : patch.cityId === null
          ? null
          : await this.resolveCityId(patch.cityId);

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.jobListing.update({
        where: { id: jobId },
        data: {
          ...(patch.title === undefined ? {} : { title: patch.title }),
          ...(patch.description === undefined ? {} : { description: patch.description }),
          ...(patch.companyName === undefined ? {} : { companyName: patch.companyName }),
          ...(cityId === undefined ? {} : { cityId }),
          ...(patch.contractType === undefined ? {} : { contractType: patch.contractType }),
          ...(patch.sector === undefined ? {} : { sector: patch.sector }),
          ...(patch.educationLevel === undefined ? {} : { educationLevel: patch.educationLevel }),
          ...(patch.externalUrl === undefined ? {} : { externalUrl: patch.externalUrl }),
        },
        select: JOB_SELECT,
      });

      const title = patch.title ?? job.title;
      const description = patch.description ?? job.description;
      if (JOB_SCAM_TERM_PATTERN.test(`${title}\n${description}`)) {
        await this.openScamCase(tx, jobId, authorUserId);
      }

      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: authorUserId },
        action: 'job.updated',
        targetType: 'job_listing',
        targetId: jobId,
      });
      // 11 §2.5 : une offre modifiée est RÉINDEXÉE. Le titre, la description et
      // l'employeur sont dans le document ; avant cet événement, seul `job.published`
      // déclenchait l'indexation et une correction restait invisible à la recherche.
      await this.outbox.emit(tx, {
        type: 'job.updated',
        aggregateId: jobId,
        payload: { fields: Object.keys(patch) },
      });
      return updated;
    });

    return this.toCard(row, authorUserId);
  }

  async remove(jobId: string, authorUserId: string): Promise<JobCard> {
    const job = await this.loadOwned(jobId, authorUserId);
    if (job.status === 'REMOVED') return this.toCard(job, authorUserId);

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.jobListing.update({
        where: { id: jobId },
        data: { status: 'REMOVED', deletedAt: new Date() },
        select: JOB_SELECT,
      });
      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: authorUserId },
        action: 'job.removed',
        targetType: 'job_listing',
        targetId: jobId,
      });
      // Une offre retirée sort de l'index : `readSource` ne la rend plus, et
      // `reindexSubject` supprime alors le document.
      await this.outbox.emit(tx, {
        type: 'job.updated',
        aggregateId: jobId,
        payload: { removed: true },
      });
      return updated;
    });
    return this.toCard(row, authorUserId);
  }

  /** §3.1 : « Durée 45 jours, renouvelable ». Même déduction que le logement. */
  async renew(jobId: string, authorUserId: string): Promise<JobCard> {
    const job = await this.loadOwned(jobId, authorUserId);
    if (job.status === 'REMOVED') throw ApiError.transverse('CONFLICT', { status: 'REMOVED' });

    const now = Date.now();
    const renewableFrom =
      job.expiresAt.getTime() - (JOB_LIFETIME_DAYS - JOB_RENEW_INTERVAL_DAYS) * 86_400_000;
    if (now < renewableFrom) {
      this.fail('RENEW_TOO_SOON', { renewableAt: new Date(renewableFrom).toISOString() });
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const renewed = await tx.jobListing.update({
        where: { id: jobId },
        data: {
          expiresAt: new Date(now + JOB_LIFETIME_DAYS * 86_400_000),
          ...(job.status === 'EXPIRED' ? { status: 'ACTIVE' as const } : {}),
        },
        select: JOB_SELECT,
      });
      // Une offre EXPIRÉE puis renouvelée doit REVENIR dans l'index.
      await this.outbox.emit(tx, {
        type: 'job.updated',
        aggregateId: jobId,
        payload: { renewed: true },
      });
      return renewed;
    });
    return this.toCard(row, authorUserId);
  }

  /**
   * Mise en avant (§3.1). Premium, 14 jours, au plus 5 par mois.
   *
   * La lecture de `users.plan` est légitime ici : §3.1 en fait une fonction payante,
   * et la règle dure 14 §2 ne protège que l'entraide, les guides, le parrainage, les
   * réseaux et la participation aux événements — publier une offre reste gratuit,
   * c'est la MISE EN AVANT qui ne l'est pas.
   */
  async sponsor(jobId: string, authorUserId: string): Promise<JobCard> {
    const job = await this.loadOwned(jobId, authorUserId);
    if (job.status !== 'ACTIVE') throw ApiError.transverse('CONFLICT', { status: job.status });
    if (job.sponsoredUntil !== null && job.sponsoredUntil.getTime() > Date.now()) {
      this.fail('ALREADY_SPONSORED');
    }

    const author = await this.prisma.user.findUniqueOrThrow({
      where: { id: authorUserId },
      select: { plan: true },
    });
    // Un membre gratuit n'est pas « au-dessus du quota » : la fonction ne lui est pas
    // ouverte. `PLAN_LIMIT_REACHED` porte l'invitation Premium (T4 §3), et `max: 0`
    // dit clairement qu'aucune mise en avant n'est incluse.
    const plan = await planEffectif(this.prisma, author.plan);
    if (plan === 'FREE') throw ApiError.planLimit('sponsoredJobsPerMonth', 0, 0);

    const max = await this.sponsoredPerMonth(plan);
    const used = await this.sponsoredThisMonth(authorUserId);
    if (used >= max) this.fail('SPONSORED_LIMIT', { current: used, max });

    const sponsoredUntil = new Date(Date.now() + JOB_SPONSORED_DAYS * 86_400_000);
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.jobListing.update({
        where: { id: jobId },
        data: { isSponsored: true, sponsoredUntil },
        select: JOB_SELECT,
      });

      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: authorUserId },
        action: 'job.sponsored',
        targetType: 'job_listing',
        targetId: jobId,
        metadata: { sponsoredUntil: sponsoredUntil.toISOString(), usedThisMonth: used + 1 },
      });

      // §3.1 : « notification ciblée aux `job_seeker_profiles` correspondants (secteur,
      // ville) ». Le ciblage est porté par l'événement, pas fait ici : c'est le module
      // 11-12 qui sait notifier, et 00 §3.3 interdit l'appel direct.
      await this.outbox.emit(tx, {
        type: 'job.sponsored',
        aggregateId: jobId,
        payload: {
          authorUserId,
          sector: job.sector,
          cityId: job.city?.id ?? null,
          sponsoredUntil: sponsoredUntil.toISOString(),
        },
      });
      return updated;
    });

    return this.toCard(row, authorUserId);
  }

  // ── Listes (§3.1) ─────────────────────────────────────────────────────────

  /**
   * GET /jobs.
   *
   * RÈGLE DURE (§11) : au plus `JOB_SPONSORED_HEAD_SLOTS` offres en tête. Elles
   * sortent dans `sponsored`, sont RETIRÉES de `items` pour ne pas apparaître deux
   * fois, et `items` garde la pagination par curseur — que la tête, elle, n'a pas :
   * une tête paginée serait une tête sans borne.
   *
   * Comme pour le logement, les conditions s'empilent dans un `AND` : `OR` est
   * employé par la visibilité ET par la recherche plein texte, et les fusionner dans
   * un même objet ferait taire l'un des deux.
   */
  async list(
    query: JobsQuery,
    viewerId: string | null,
  ): Promise<Page<JobCard> & { sponsored: readonly JobCard[] }> {
    const now = new Date();
    const conditions: Prisma.JobListingWhereInput[] = [];

    if (query.scope === 'mine') {
      if (viewerId === null) throw ApiError.transverse('UNAUTHENTICATED');
      conditions.push({ authorUserId: viewerId, deletedAt: null, status: { not: 'REMOVED' } });
    } else {
      conditions.push({ deletedAt: null, status: 'ACTIVE', expiresAt: { gt: now } });
      const separated = await this.visibility.separatedFrom(viewerId);
      if (separated.length > 0) conditions.push({ authorUserId: { notIn: separated } });
    }

    if (query.kind !== undefined) conditions.push({ kind: query.kind });
    if (query.cityId !== undefined) conditions.push({ cityId: query.cityId });
    if (query.sector !== undefined) {
      conditions.push({ sector: { equals: query.sector, mode: 'insensitive' } });
    }
    if (query.contractType !== undefined) {
      conditions.push({ contractType: { equals: query.contractType, mode: 'insensitive' } });
    }
    if (query.q !== undefined) {
      conditions.push({
        OR: [
          { title: { contains: query.q, mode: 'insensitive' } },
          { companyName: { contains: query.q, mode: 'insensitive' } },
        ],
      });
    }

    const scope = [
      'jobs',
      query.scope,
      query.kind ?? '',
      query.cityId ?? '',
      query.sector ?? '',
      query.contractType ?? '',
      query.q ?? '',
      viewerId ?? 'anon',
    ].join(':');

    const cursor =
      query.cursor === undefined ? null : decodeCursor(query.cursor, this.cursorSecret, scope);

    // La tête n'existe que sur la PREMIÈRE page : en page 3, une offre sponsorisée
    // n'a plus de tête à occuper, et la répéter serait un cinquième emplacement
    // déguisé.
    const sponsoredRows =
      cursor === null && query.scope === 'all'
        ? await this.prisma.jobListing.findMany({
            where: {
              AND: [...conditions, { isSponsored: true, sponsoredUntil: { gt: now } }],
            },
            orderBy: [{ sponsoredUntil: 'desc' }, { id: 'desc' }],
            take: JOB_SPONSORED_HEAD_SLOTS,
            select: JOB_SELECT,
          })
        : [];

    const headIds = sponsoredRows.map((row) => row.id);

    const rows = await this.prisma.jobListing.findMany({
      where: {
        AND: [
          ...conditions,
          ...(headIds.length === 0 ? [] : [{ id: { notIn: headIds } }]),
          this.keysetFor(cursor),
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      select: JOB_SELECT,
    });

    const page = buildPage(
      rows.map((row) => this.toCard(row, viewerId)),
      query.limit,
      scope,
      this.cursorSecret,
      (card) => card.createdAt.toISOString(),
    );

    return {
      ...page,
      sponsored: sponsoredRows.map((row) => this.toCard(row, viewerId)),
      meta: { sponsoredLabel: JOB_SPONSORED_LABEL, sponsoredHeadSlots: JOB_SPONSORED_HEAD_SLOTS },
    };
  }

  async detail(jobId: string, viewerId: string | null): Promise<JobCard> {
    const row = await this.prisma.jobListing.findUnique({
      where: { id: jobId },
      select: JOB_SELECT,
    });
    if (row === null) throw ApiError.notFound();

    const isMine = viewerId !== null && row.authorUserId === viewerId;
    if (!isMine) {
      if (row.deletedAt !== null || row.status !== 'ACTIVE' || row.expiresAt.getTime() <= Date.now()) {
        throw ApiError.notFound();
      }
      await this.visibility.assertVisible(viewerId, row.authorUserId);
    }
    return this.toCard(row, viewerId);
  }

  // ── Profils disponibles (§3.2) ────────────────────────────────────────────

  async myJobSeekerProfile(userId: string) {
    const profile = await this.prisma.jobSeekerProfile.findUnique({
      where: { userId },
      select: { headline: true, sectors: true, contractTypes: true, isVisible: true, updatedAt: true },
    });
    return profile ?? null;
  }

  /** PUT : création ou remplacement. Un membre n'a qu'un profil de recherche. */
  async putJobSeekerProfile(userId: string, input: JobSeekerProfileInput) {
    const row = await this.prisma.jobSeekerProfile.upsert({
      where: { userId },
      create: {
        userId,
        headline: input.headline,
        sectors: input.sectors,
        contractTypes: input.contractTypes,
        isVisible: input.isVisible,
      },
      update: {
        headline: input.headline,
        sectors: input.sectors,
        contractTypes: input.contractTypes,
        isVisible: input.isVisible,
      },
      select: { headline: true, sectors: true, contractTypes: true, isVisible: true, updatedAt: true },
    });
    return row;
  }

  async deleteJobSeekerProfile(userId: string): Promise<{ deleted: boolean }> {
    const { count } = await this.prisma.jobSeekerProfile.deleteMany({ where: { userId } });
    return { deleted: count > 0 };
  }

  /**
   * GET /job-seekers — « Liste filtrable par ville, secteur » (§3.2).
   *
   * `is_visible` est la volonté du membre, et elle passe avant tout filtre : un
   * profil invisible n'apparaît pour personne, même pour qui le cherche par secteur.
   * Le compte du membre doit aussi être actif — un profil de recherche d'un compte
   * désactivé promettrait une réponse qui ne viendra pas.
   */
  async listJobSeekers(query: JobSeekersQuery, viewerId: string | null): Promise<Page<unknown>> {
    const conditions: Prisma.JobSeekerProfileWhereInput[] = [
      { isVisible: true, user: { status: 'ACTIVE', deletedAt: null } },
    ];

    const separated = await this.visibility.separatedFrom(viewerId);
    if (separated.length > 0) conditions.push({ userId: { notIn: separated } });

    if (query.cityId !== undefined) conditions.push({ user: { cityId: query.cityId } });
    if (query.sector !== undefined) conditions.push({ sectors: { has: query.sector } });

    const scope = ['job-seekers', query.cityId ?? '', query.sector ?? '', viewerId ?? 'anon'].join(':');
    const cursor =
      query.cursor === undefined ? null : decodeCursor(query.cursor, this.cursorSecret, scope);

    const rows = await this.prisma.jobSeekerProfile.findMany({
      where: {
        AND: [
          ...conditions,
          ...(cursor === null ? [] : [{ userId: { lt: cursor.id } }]),
        ],
      },
      orderBy: { userId: 'desc' },
      take: query.limit + 1,
      select: {
        userId: true,
        headline: true,
        sectors: true,
        contractTypes: true,
        updatedAt: true,
        user: {
          select: {
            handle: true,
            displayName: true,
            avatarAsset: { select: { storageKey: true } },
            city: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    // La clé de page est `userId` (clé primaire de la table) : `buildPage` attend un
    // champ `id`, on le lui donne explicitement plutôt que d'exposer `userId` deux
    // fois dans la réponse.
    const items = rows.map((row) => ({
      id: row.userId,
      headline: row.headline,
      sectors: row.sectors,
      contractTypes: row.contractTypes,
      updatedAt: row.updatedAt,
      member: {
        handle: row.user.handle,
        displayName: row.user.displayName,
        avatarUrl: row.user.avatarAsset === null ? null : `/media/${row.user.avatarAsset.storageKey}`,
        city: row.user.city,
      },
    }));

    return buildPage(items, query.limit, scope, this.cursorSecret);
  }

  // ── Recommander un membre (§3.3) ──────────────────────────────────────────

  /**
   * « Recommander X pour cette offre », avec commentaire.
   *
   * §3.3 : « Aucun effet de réputation en V1 (évite les recommandations de
   * complaisance). » Rien n'est donc écrit dans `reputation_events`, et c'est
   * volontaire. La contrainte d'unicité `(from, to, jobListingId)` du schéma fait le
   * reste : une recommandation par membre, par membre recommandé et par offre.
   */
  async recommendMember(fromUserId: string, input: CreateMemberRecommendation) {
    const to = await this.prisma.user.findFirst({
      where: { handle: input.toHandle, deletedAt: null, status: { not: 'DELETED' } },
      select: { id: true, handle: true, displayName: true },
    });
    if (to === null) throw ApiError.notFound();
    if (to.id === fromUserId) this.fail('SELF_RECOMMENDATION');

    // Un blocage dans un sens ou l'autre rend le membre inexistant (08 §4) : on ne
    // recommande pas quelqu'un dont on est séparé, et le 404 ne dit pas pourquoi.
    await this.visibility.assertVisible(fromUserId, to.id);

    let jobAuthorUserId: string | null = null;
    if (input.jobId !== undefined) {
      const job = await this.prisma.jobListing.findFirst({
        where: { id: input.jobId, deletedAt: null, status: 'ACTIVE' },
        select: { id: true, authorUserId: true },
      });
      if (job === null) throw ApiError.notFound();
      jobAuthorUserId = job.authorUserId;
    }

    const existing = await this.prisma.memberRecommendation.findFirst({
      where: { fromUserId, toUserId: to.id, jobListingId: input.jobId ?? null },
      select: { id: true },
    });
    if (existing !== null) this.fail('ALREADY_RECOMMENDED');

    const id = newId();
    await this.prisma.$transaction(async (tx) => {
      await tx.memberRecommendation.create({
        data: {
          id,
          fromUserId,
          toUserId: to.id,
          jobListingId: input.jobId ?? null,
          comment: input.comment ?? null,
        },
      });
      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: fromUserId },
        action: 'member.recommended',
        targetType: 'member_recommendation',
        targetId: id,
        metadata: { toUserId: to.id, jobListingId: input.jobId ?? null },
      });
      // §3.3 : « notifié à l'auteur de l'offre ». Le destinataire voyage dans la
      // charge ; c'est le module 11-12 qui notifie (00 §3.3 : jamais d'appel direct).
      //
      // `member.recommended` ne figure PAS dans le tableau des événements du §8, qui
      // ne nomme que `job.published` et `job.sponsored` — alors que §3.3 exige la
      // notification. Contradiction de la spec, tranchée en faveur du comportement :
      // réemployer `job.published` pour une recommandation aurait fait indexer une
      // offre qui n'existe pas.
      await this.outbox.emit(tx, {
        type: 'member.recommended',
        aggregateId: id,
        payload: {
          fromUserId,
          toUserId: to.id,
          jobListingId: input.jobId ?? null,
          notifyUserId: jobAuthorUserId,
        },
      });
    });

    return { id, toHandle: to.handle, jobId: input.jobId ?? null };
  }

  /** §3.3 : « Visible sur le profil du recommandé (« Recommandé·e par 3 membres ») ». */
  async recommendationsFor(handle: string, viewerId: string | null) {
    const user = await this.prisma.user.findFirst({
      where: { handle, deletedAt: null },
      select: { id: true },
    });
    if (user === null) throw ApiError.notFound();
    await this.visibility.assertVisible(viewerId, user.id);

    const separated = await this.visibility.separatedFrom(viewerId);
    const rows = await this.prisma.memberRecommendation.findMany({
      where: {
        AND: [
          { toUserId: user.id },
          ...(separated.length === 0 ? [] : [{ fromUserId: { notIn: separated } }]),
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        comment: true,
        createdAt: true,
        fromUser: { select: { handle: true, displayName: true } },
        jobListing: { select: { id: true, title: true } },
      },
    });
    return { count: rows.length, items: rows };
  }

  // ── Tâches et événements (§9, §10) ────────────────────────────────────────

  /** Tâche `listing.expire` (§9) — la partie emploi : 45 jours. Idempotente. */
  async expireDueJobs(now = new Date()): Promise<number> {
    const { count } = await this.prisma.jobListing.updateMany({
      where: { status: 'ACTIVE', deletedAt: null, expiresAt: { lte: now } },
      data: { status: 'EXPIRED' },
    });
    return count;
  }

  /**
   * Tâche `sponsored.expire` (§9) — 14 jours.
   *
   * `isSponsored` retombe à faux dès que la date est passée. Les LECTURES ne s'y
   * fient pas de toute façon (`toCard` compare la date), donc un retard de tâche ne
   * peut pas prolonger une mise en avant : la tâche nettoie, elle ne décide pas.
   */
  async expireSponsorships(now = new Date()): Promise<number> {
    const { count } = await this.prisma.jobListing.updateMany({
      where: { isSponsored: true, sponsoredUntil: { lte: now } },
      data: { isSponsored: false },
    });
    return count;
  }

  /**
   * §10 : « Annonces emploi : supprimées. Profil de recherche : supprimé.
   * Recommandations données par le membre : supprimées. »
   */
  async handleUserDeleted(userId: string): Promise<void> {
    await this.prisma.jobListing.deleteMany({ where: { authorUserId: userId } });
    await this.prisma.jobSeekerProfile.deleteMany({ where: { userId } });
    await this.prisma.memberRecommendation.deleteMany({
      where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
    });
  }

  // ── Plomberie ─────────────────────────────────────────────────────────────

  /**
   * Le nombre de mises en avant consommées ce mois-ci.
   *
   * DÉDUIT de `sponsored_until`, faute de `sponsored_count_month` : la durée étant
   * fixe à 14 jours, une mise en avant démarrée dans le mois a sa fin dans
   * [début + 14 j, fin + 14 j). Aucune arithmétique de date en SQL, donc aucune
   * surprise de fuseau : les deux bornes sont calculées en UTC ici.
   */
  private async sponsoredThisMonth(authorUserId: string, now = new Date()): Promise<number> {
    const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
    const monthEnd = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
    const shift = JOB_SPONSORED_DAYS * 86_400_000;

    return this.prisma.jobListing.count({
      where: {
        authorUserId,
        sponsoredUntil: { gte: new Date(monthStart + shift), lt: new Date(monthEnd + shift) },
      },
    });
  }

  /**
   * La limite mensuelle, lue dans `plans.limits` quand la ligne existe.
   *
   * `plans` n'est pas amorcée (le module 14 n'existe pas) : on retombe alors sur la
   * valeur de la spec, 5. Ne PAS retomber signifierait qu'aucune limite ne
   * s'applique tant que la facturation n'est pas livrée — et « au plus 5 par mois »
   * est une règle, pas une suggestion.
   */
  private async sponsoredPerMonth(planCode: UserPlan): Promise<number> {
    const plan = await this.prisma.plan.findUnique({
      where: { code: planCode },
      select: { limits: true },
    });
    const limits = plan?.limits;
    if (limits !== null && limits !== undefined && typeof limits === 'object' && !Array.isArray(limits)) {
      const raw = (limits as Record<string, unknown>)['sponsoredJobsPerMonth'];
      if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0) return raw;
    }
    return FREE_SPONSORED_JOBS_PER_MONTH;
  }

  private async openScamCase(
    tx: Prisma.TransactionClient,
    jobId: string,
    authorUserId: string,
  ): Promise<void> {
    const existing = await tx.moderationCase.findFirst({
      where: { subjectType: 'JOB', subjectId: jobId, status: { not: 'RESOLVED' } },
      select: { id: true },
    });
    if (existing !== null) return;

    await tx.moderationCase.create({
      data: {
        id: newId(),
        subjectType: 'JOB',
        subjectId: jobId,
        subjectAuthorUserId: authorUserId,
        source: 'AI',
        // 13 : « 1 = arnaque ou demande d'argent ». Une arnaque à l'emploi vise des
        // gens qui cherchent du travail : c'est la priorité maximale.
        priority: 1,
        status: 'OPEN',
        aiVerdict: 'QUEUE',
        aiLabels: ['MONEY_REQUEST'],
        slaDueAt: new Date(Date.now() + 4 * 3_600_000),
      },
    });
  }

  private keysetFor(cursor: { id: string; sort?: string | number } | null): Prisma.JobListingWhereInput {
    if (cursor === null || cursor.sort === undefined) return {};
    const createdAt = new Date(String(cursor.sort));
    return { OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: cursor.id } }] };
  }

  private async resolveCityId(cityId: string): Promise<string> {
    const city = await this.prisma.city.findUnique({
      where: { id: cityId },
      select: { id: true, mergedIntoCityId: true },
    });
    if (city === null) throw ApiError.notFound();
    return city.mergedIntoCityId ?? city.id;
  }

  private async loadOwned(jobId: string, authorUserId: string): Promise<JobRow> {
    const row = await this.prisma.jobListing.findUnique({
      where: { id: jobId },
      select: JOB_SELECT,
    });
    if (row === null || row.authorUserId !== authorUserId) throw ApiError.notFound();
    return row;
  }

  private toCard(row: JobRow, viewerId: string | null): JobCard {
    const sponsored = row.sponsoredUntil !== null && row.sponsoredUntil.getTime() > Date.now();
    return {
      id: row.id,
      kind: row.kind,
      title: row.title,
      description: row.description,
      companyName: row.companyName,
      city: row.city,
      contractType: row.contractType,
      sector: row.sector,
      educationLevel: row.educationLevel,
      externalUrl: row.externalUrl,
      status: row.status,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      isSponsored: sponsored,
      // RÈGLE DURE §11 : la pastille accompagne TOUJOURS une offre sponsorisée. Elle
      // est calculée ici, une seule fois, pour que tête de liste et corps de liste ne
      // puissent pas en dire deux choses différentes.
      sponsoredLabel: sponsored ? JOB_SPONSORED_LABEL : null,
      sponsoredUntil: row.sponsoredUntil,
      author: {
        handle: row.author.handle,
        displayName: row.author.displayName,
        avatarUrl:
          row.author.avatarAsset === null ? null : `/media/${row.author.avatarAsset.storageKey}`,
      },
      sharedBy: sharedByLabel(row.author.displayName),
      isMine: viewerId !== null && row.authorUserId === viewerId,
      canRenew:
        viewerId !== null && row.authorUserId === viewerId
          ? Date.now() >=
            row.expiresAt.getTime() - (JOB_LIFETIME_DAYS - JOB_RENEW_INTERVAL_DAYS) * 86_400_000
          : null,
      recommendationCount: row._count.memberRecommendations,
    };
  }
}
