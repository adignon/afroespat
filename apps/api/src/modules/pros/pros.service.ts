import { Injectable, Logger } from '@nestjs/common';
import { newId, type Prisma } from '@app/db';
import {
  FREE_PRO_CONTACTS_PER_MONTH,
  type Page,
  PRO_ERROR_CODES,
  PRO_ERROR_MESSAGES,
  PRO_FEATURED_LABEL,
  PRO_FEATURED_SLOTS,
  PRO_PHONE_ON_REQUEST_HINT,
  PRO_RECIPROCAL_CASE_PRIORITY,
  PRO_RECIPROCAL_WINDOW_DAYS,
  type ProErrorCode,
  type ProProfileInput,
  type ProsQuery,
  type RecommendPro,
  type UserPlan,
  proTextIsAllowed,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { AuditService } from '../../common/audit.service';
import { buildPage, decodeCursor } from '../../common/cursor';
import { OutboxService } from '../../common/outbox.service';
import { PrismaService } from '../../common/prisma.service';
import { VisibilityService } from '../../common/visibility.service';
import { loadEnv } from '../../config/env';

/**
 * Annuaire professionnel — 10-services.md §4.
 *
 * Quatre règles dures se rencontrent dans ce seul fichier, et chacune explique une
 * partie de sa forme :
 *
 *   · le mot « certifié » n'apparaît NULLE PART (01 §1.2). L'annuaire est l'endroit
 *     où la tentation est maximale, parce que c'est le membre qui rédige. Le refus
 *     est dans les schémas zod (`validation/pros.ts`), donc appliqué à l'entrée ; et
 *     `assertNoForbiddenWord` le REDIT ici, parce qu'un service peut être appelé
 *     sans passer par le tuyau de validation — une tâche, un autre module, un test ;
 *
 *   · le TÉLÉPHONE n'est jamais stocké ni renvoyé (§11). `PHONE_ON_REQUEST` ne cache
 *     pas un numéro : il annonce que le pro le donnera lui-même. Il n'y a donc rien
 *     à filtrer en sortie, et c'est la bonne façon de tenir la règle — un champ
 *     qu'on n'écrit pas ne fuit pas ;
 *
 *   · une RECOMMANDATION exige une `connection` existante (§4.3). C'est ce qui
 *     empêche l'achat d'avis, et cela vaut aussi dans le temps : quand le contact
 *     disparaît, la recommandation avec lui (`handleConnectionRemoved`) ;
 *
 *   · le CLASSEMENT n'est « jamais purement payant » (§4.2). Les fiches payantes ont
 *     deux emplacements SIGNALÉS en tête, et pas un de plus ; `items` est trié sur
 *     les recommandations et la date, et n'a aucune connaissance du palier.
 *
 * Le PALIER est lu comme une DATE, pas comme une colonne : « un abonnement expiré
 * rétrograde en FREE » (§4.1), et la facturation n'existe pas encore pour le faire.
 * `effectiveTier()` est donc la seule lecture de palier autorisée dans ce service —
 * se fier à `tier` seul afficherait des fiches mises en avant sans abonnement.
 *
 * CE QUI MANQUE, et qui est signalé plutôt que contourné :
 *   · `pro_profiles.approved_at`, `approved_by_staff_id`, `rejection_reason` (§5)
 *     n'existent pas dans le schéma figé. Les routes d'administration du §6.3 ne sont
 *     donc PAS livrées : elles demandent en plus une authentification d'équipe
 *     (module 15) qui n'existe pas. Conséquence à connaître : aucune fiche ne peut
 *     passer en `APPROVED` par l'API aujourd'hui, donc l'annuaire reste vide en
 *     production tant que le module 15 n'est pas là. `verification_status` et
 *     `pro.registered` sont en place pour l'y brancher ;
 *   · `pro_contact_logs` n'a pas d'index UNIQUE sur (fiche, membre, période) : deux
 *     appels vraiment simultanés peuvent écrire deux lignes pour le même mois. Le
 *     quota reste juste (il compte les fiches DISTINCTES via `usage_counters`), mais
 *     le journal peut contenir un doublon.
 */

export interface ProCard {
  readonly id: string;
  readonly handle: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  /** Le libellé du référentiel, mention obligatoire comprise (02 §… et §4.1). */
  readonly profession: { readonly id: string; readonly nameFr: string };
  readonly businessName: string | null;
  readonly description: string | null;
  readonly priceHint: string | null;
  readonly contactMethod: string;
  /** Présent seulement pour `PHONE_ON_REQUEST` : dit ce que « sur demande » signifie. */
  readonly contactHint: string | null;
  /** Identifiant légal saisi par le pro. Aucune interrogation d'un service tiers. */
  readonly siret: string | null;
  readonly cities: readonly { readonly id: string; readonly name: string; readonly slug: string }[];
  readonly languages: readonly { readonly id: string; readonly code: string; readonly nameFr: string }[];
  readonly recommendationCount: number;
  /** Palier EFFECTIF : `FREE` dès que l'abonnement est échu (§4.1). */
  readonly tier: string;
  /** §4.2 : une fiche mise en avant est « clairement signalée ». */
  readonly isFeatured: boolean;
  readonly featuredLabel: string | null;
  readonly isMine: boolean;
  readonly createdAt: Date;
}

export interface ProDetail extends ProCard {
  readonly verificationStatus: string;
  readonly mutualConnectionCount: number;
  readonly recommendations: readonly {
    readonly id: string;
    readonly handle: string;
    readonly displayName: string;
    readonly comment: string | null;
    readonly createdAt: Date;
  }[];
  /** L'état de mon geste sur cette fiche : puis-je recommander, et l'ai-je déjà fait ? */
  readonly myRecommendation: { readonly id: string; readonly comment: string | null } | null;
  readonly canRecommend: boolean;
  /** Le compteur de quota de l'écran de contact (§7). `null` pour un visiteur. */
  readonly contactQuota: { readonly used: number; readonly max: number | null } | null;
}

/**
 * Le `select` d'une fiche.
 *
 * `proofAssetId` n'y figure PAS, et ce n'est pas un oubli : §4.1 en réserve l'accès à
 * l'équipe. Ne pas le sélectionner rend la fuite impossible par construction, plutôt
 * que de compter sur une suppression en sortie que quelqu'un finira par retirer.
 */
const PRO_SELECT = {
  id: true,
  createdAt: true,
  deletedAt: true,
  userId: true,
  businessName: true,
  description: true,
  priceHint: true,
  contactMethod: true,
  siret: true,
  verificationStatus: true,
  tier: true,
  tierUntil: true,
  status: true,
  recommendationCount: true,
  profession: { select: { id: true, nameFr: true } },
  cities: { select: { city: { select: { id: true, name: true, slug: true } } } },
  user: {
    select: {
      handle: true,
      displayName: true,
      avatarAsset: { select: { storageKey: true } },
      languages: { select: { language: { select: { id: true, code: true, nameFr: true } } } },
    },
  },
} satisfies Prisma.ProProfileSelect;

type ProRow = Prisma.ProProfileGetPayload<{ select: typeof PRO_SELECT }>;

@Injectable()
export class ProsService {
  private readonly logger = new Logger(ProsService.name);
  private readonly cursorSecret = loadEnv().CURSOR_SECRET;

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly visibility: VisibilityService,
  ) {}

  private fail(code: ProErrorCode, details?: Record<string, unknown>): never {
    throw new ApiError(code, PRO_ERROR_MESSAGES[code], PRO_ERROR_CODES[code], details);
  }

  // ── Ma fiche (§4.1) ───────────────────────────────────────────────────────

  /** GET /me/pro-profile. `hasProof` et jamais l'identifiant du justificatif. */
  async myProfile(userId: string) {
    const row = await this.prisma.proProfile.findUnique({
      where: { userId },
      select: { ...PRO_SELECT, proofAssetId: true },
    });
    if (row === null) return null;
    const { proofAssetId, ...rest } = row;
    return {
      // LOT A : `toCard(rest, userId)` sans le troisième argument rendait TOUJOURS
      // `isFeatured: false` à son propre titulaire, même abonné — alors que la
      // fiche publique (`detail`) disait « mise en avant ». Même définition :
      // abonnement payant ET non expiré.
      ...this.toCard(rest, userId, this.isPaidAndCurrent(row)),
      verificationStatus: row.verificationStatus,
      status: row.status,
      hasProof: proofAssetId !== null,
    };
  }

  /**
   * PUT /me/pro-profile — création ou mise à jour.
   *
   * « Une seule fiche par membre » (§4.1) : la contrainte unique du schéma le garantit,
   * et l'`upsert` en fait un geste naturel plutôt qu'une erreur à rattraper.
   *
   * `PROOF_REQUIRED` à la CRÉATION seulement : §4.1 fait du justificatif une condition
   * du référencement, mais l'exiger à nouveau pour corriger un tarif obligerait à le
   * redéposer sans raison.
   */
  async putProfile(userId: string, input: ProProfileInput) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { verificationLevel: true },
    });
    // §4.1 : capacité `pro.register`, L2. Le garde l'applique déjà ; on le redit
    // parce qu'une règle dure ne doit pas dépendre d'un décorateur.
    if (user.verificationLevel !== 'L2') {
      throw ApiError.levelRequired('pro.register', user.verificationLevel);
    }

    for (const text of [input.businessName, input.description, input.priceHint]) {
      this.assertNoForbiddenWord(text);
    }

    const profession = await this.prisma.profession.findFirst({
      where: { id: input.professionId, isActive: true },
      select: { id: true },
    });
    if (profession === null) {
      throw ApiError.validation([{ path: 'professionId', code: 'NOT_FOUND' }]);
    }

    const cityIds = await this.resolveCityIds(input.cityIds);
    const existing = await this.prisma.proProfile.findUnique({
      where: { userId },
      select: { id: true, proofAssetId: true, verificationStatus: true },
    });

    const proofAssetId = input.proofAssetId ?? existing?.proofAssetId ?? null;
    if (proofAssetId === null) this.fail('PROOF_REQUIRED');
    if (input.proofAssetId !== undefined) await this.assertOwnedProof(userId, input.proofAssetId);

    const id = existing?.id ?? newId();
    const isCreation = existing === null;

    await this.prisma.$transaction(async (tx) => {
      await tx.proProfile.upsert({
        where: { userId },
        create: {
          id,
          userId,
          professionId: input.professionId,
          businessName: input.businessName ?? null,
          description: input.description ?? null,
          priceHint: input.priceHint ?? null,
          contactMethod: input.contactMethod,
          siret: input.siret ?? null,
          proofAssetId,
          // §4.1 : « PENDING jusqu'à validation humaine ; la fiche est invisible avant ».
          verificationStatus: 'PENDING',
          tier: 'FREE',
          status: 'ACTIVE',
        },
        update: {
          professionId: input.professionId,
          businessName: input.businessName ?? null,
          description: input.description ?? null,
          priceHint: input.priceHint ?? null,
          contactMethod: input.contactMethod,
          siret: input.siret ?? null,
          proofAssetId,
          // Une fiche REJETÉE que l'on corrige repart en attente ; une fiche déjà
          // validée n'est PAS renvoyée en file : autrement, corriger une virgule
          // ferait disparaître la fiche de l'annuaire le temps d'une relecture.
          ...(existing?.verificationStatus === 'REJECTED'
            ? { verificationStatus: 'PENDING' as const }
            : {}),
        },
      });

      await tx.proProfileCity.deleteMany({ where: { proProfileId: id } });
      await tx.proProfileCity.createMany({
        data: cityIds.map((cityId) => ({ proProfileId: id, cityId })),
      });

      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: userId },
        action: isCreation ? 'pro.registered' : 'pro.updated',
        targetType: 'pro_profile',
        targetId: id,
        metadata: { professionId: input.professionId, cityCount: cityIds.length },
      });

      if (isCreation) {
        // §8 : consommé par search, notifications et l'administration (la file de
        // validation des justificatifs).
        await this.outbox.emit(tx, {
          type: 'pro.registered',
          aggregateId: id,
          payload: { userId, professionId: input.professionId, cityIds },
        });
      }
    });

    return this.myProfile(userId);
  }

  /** POST /me/pro-profile/proof — dépôt ou remplacement du justificatif (§6.3). */
  async submitProof(userId: string, proofAssetId: string) {
    await this.assertOwnedProof(userId, proofAssetId);
    const profile = await this.prisma.proProfile.findUnique({
      where: { userId },
      select: { id: true, verificationStatus: true },
    });
    if (profile === null) throw ApiError.notFound();

    await this.prisma.$transaction(async (tx) => {
      await tx.proProfile.update({
        where: { id: profile.id },
        data: {
          proofAssetId,
          // Un nouveau justificatif relance la relecture : c'est le geste attendu
          // après un rejet, et le seul qui ait du sens.
          verificationStatus: 'PENDING',
        },
      });
      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: userId },
        action: 'pro.proof_submitted',
        targetType: 'pro_profile',
        targetId: profile.id,
        // L'identifiant du justificatif reste hors de la trace : elle est lisible par
        // l'équipe, mais un identifiant de média y invite à le consulter sans dossier.
        metadata: { previousStatus: profile.verificationStatus },
      });
    });

    return { submitted: true, verificationStatus: 'PENDING' as const };
  }

  // ── Annuaire (§4.2) ───────────────────────────────────────────────────────

  /**
   * GET /pros — `featured[]` (≤ 2) puis `items[]`.
   *
   * RÈGLE DURE §4.2 : « Tri par défaut pertinence puis recommandations, jamais
   * purement payant. » `items` est donc ordonné sur `recommendationCount` puis la
   * date, et le palier n'entre NULLE PART dans son `orderBy`. Les fiches payantes
   * gagnent deux emplacements en tête, signalés, et rien d'autre.
   *
   * Comme ailleurs, les conditions s'empilent dans un `AND` : la visibilité et la
   * recherche plein texte emploient toutes deux `OR`, et les fusionner dans un seul
   * objet en ferait taire une — le genre de bogue qui laisse fuir ce qu'il devrait
   * cacher.
   */
  async list(
    query: ProsQuery,
    viewerId: string | null,
  ): Promise<Page<ProCard> & { featured: readonly ProCard[] }> {
    const now = new Date();
    const conditions: Prisma.ProProfileWhereInput[] = [this.publiclyVisible()];

    const separated = await this.visibility.separatedFrom(viewerId);
    if (separated.length > 0) conditions.push({ userId: { notIn: separated } });

    if (query.professionId !== undefined) conditions.push({ professionId: query.professionId });
    if (query.cityId !== undefined) conditions.push({ cities: { some: { cityId: query.cityId } } });
    if (query.languageId !== undefined) {
      conditions.push({ user: { languages: { some: { languageId: query.languageId } } } });
    }
    if (query.q !== undefined) {
      conditions.push({
        OR: [
          { businessName: { contains: query.q, mode: 'insensitive' } },
          { description: { contains: query.q, mode: 'insensitive' } },
          { profession: { nameFr: { contains: query.q, mode: 'insensitive' } } },
          { user: { displayName: { contains: query.q, mode: 'insensitive' } } },
        ],
      });
    }

    const scope = [
      'pros',
      query.professionId ?? '',
      query.cityId ?? '',
      query.languageId ?? '',
      query.q ?? '',
      viewerId ?? 'anon',
    ].join(':');
    const cursor =
      query.cursor === undefined ? null : decodeCursor(query.cursor, this.cursorSecret, scope);

    // La tête n'existe que sur la première page : sur la page 3, une fiche payante
    // n'a plus de tête à occuper, et la répéter serait un troisième emplacement.
    const featuredRows =
      cursor === null
        ? await this.prisma.proProfile.findMany({
            where: { AND: [...conditions, this.paidAndCurrent(now)] },
            orderBy: [{ recommendationCount: 'desc' }, { id: 'desc' }],
            take: PRO_FEATURED_SLOTS,
            select: PRO_SELECT,
          })
        : [];
    const headIds = featuredRows.map((row) => row.id);

    const rows = await this.prisma.proProfile.findMany({
      where: {
        AND: [
          ...conditions,
          ...(headIds.length === 0 ? [] : [{ id: { notIn: headIds } }]),
          this.keysetFor(cursor),
        ],
      },
      orderBy: [{ recommendationCount: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      select: PRO_SELECT,
    });

    const page = buildPage(
      rows.map((row) => this.toCard(row, viewerId, false)),
      query.limit,
      scope,
      this.cursorSecret,
      (card) => card.recommendationCount,
    );

    return {
      ...page,
      featured: featuredRows.map((row) => this.toCard(row, viewerId, true)),
      meta: { featuredLabel: PRO_FEATURED_LABEL, featuredSlots: PRO_FEATURED_SLOTS },
    };
  }

  /** GET /pros/:id — fiche, recommandations, contacts en commun (§6.3). */
  async detail(proProfileId: string, viewerId: string | null): Promise<ProDetail> {
    const row = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
      select: PRO_SELECT,
    });
    if (row === null) throw ApiError.notFound();

    const isMine = viewerId !== null && row.userId === viewerId;
    if (!isMine) {
      // §4.1 : « la fiche est invisible avant » validation. 404 et non 403 (T4 §3).
      if (!this.isVisible(row)) throw ApiError.notFound();
      await this.visibility.assertVisible(viewerId, row.userId);
    }

    await this.prisma.proProfile.update({
      where: { id: proProfileId },
      data: { viewCount: { increment: 1 } },
      select: { id: true },
    });

    const separated = await this.visibility.separatedFrom(viewerId);
    const recommendations = await this.prisma.proRecommendation.findMany({
      where: {
        AND: [
          { proProfileId },
          ...(separated.length === 0 ? [] : [{ authorUserId: { notIn: separated } }]),
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        comment: true,
        createdAt: true,
        authorUserId: true,
        author: { select: { handle: true, displayName: true } },
      },
    });

    const mine = recommendations.find((rec) => rec.authorUserId === viewerId) ?? null;

    return {
      ...this.toCard(row, viewerId, this.isPaidAndCurrent(row)),
      verificationStatus: row.verificationStatus,
      mutualConnectionCount:
        viewerId === null || isMine ? 0 : await this.mutualConnectionCount(viewerId, row.userId),
      recommendations: recommendations.map((rec) => ({
        id: rec.id,
        // §4.3 : « Affichées avec le handle du recommandeur. »
        handle: rec.author.handle,
        displayName: rec.author.displayName,
        comment: rec.comment,
        createdAt: rec.createdAt,
      })),
      myRecommendation: mine === null ? null : { id: mine.id, comment: mine.comment },
      canRecommend:
        viewerId !== null &&
        !isMine &&
        mine === null &&
        (await this.connectionBetween(viewerId, row.userId)) !== null,
      contactQuota: viewerId === null ? null : await this.contactQuotaOf(viewerId),
    };
  }

  // ── Contact et quota (§4.4) ───────────────────────────────────────────────

  /**
   * POST /pros/:id/contact.
   *
   * RÈGLE DURE §4.4 : « 3 contacts distincts par mois en gratuit », illimité en
   * Premium, et « recontacter un pro déjà contacté ce mois-ci ne consomme pas ».
   *
   * L'ordre est celui du §4.4, et il compte : on regarde d'abord si le journal porte
   * déjà ce pro pour ce mois. Si oui, rien n'est consommé et la conversation
   * existante se rouvre — « la conversation existante reste ouverte » même une fois
   * la limite atteinte.
   *
   * Le compteur est INCRÉMENTÉ PUIS vérifié, dans la transaction : `upsert` pose un
   * verrou de ligne, donc deux contacts simultanés se sérialisent et le second voit
   * la valeur suivante. Vérifier puis écrire aurait laissé passer les deux.
   */
  async contact(
    proProfileId: string,
    viewerId: string,
  ): Promise<{ conversationId: string; quota: { used: number; max: number | null } }> {
    const pro = await this.prisma.proProfile.findFirst({
      where: { id: proProfileId, ...this.publiclyVisible() },
      select: { id: true, userId: true },
    });
    if (pro === null) throw ApiError.notFound();
    if (pro.userId === viewerId) this.fail('OWN_PROFILE');
    await this.visibility.assertVisible(viewerId, pro.userId);

    const viewer = await this.prisma.user.findUniqueOrThrow({
      where: { id: viewerId },
      select: { plan: true },
    });
    const periodKey = monthKey(new Date());

    const result = await this.prisma.$transaction(async (tx) => {
      const already = await tx.proContactLog.findFirst({
        where: { proProfileId, userId: viewerId, periodKey },
        select: { id: true },
      });

      if (already === null) {
        await this.consumeContactQuota(tx, viewerId, viewer.plan, periodKey);
        await tx.proContactLog.create({
          data: { id: newId(), proProfileId, userId: viewerId, periodKey },
        });
      }

      const conversationId = await this.ensureDirectConversation(tx, viewerId, pro.userId);

      await this.outbox.emit(tx, {
        type: 'pro.contacted',
        aggregateId: proProfileId,
        payload: {
          fromUserId: viewerId,
          toUserId: pro.userId,
          conversationId,
          consumed: already === null,
        },
      });

      return conversationId;
    });

    return { conversationId: result, quota: await this.contactQuotaOf(viewerId) };
  }

  // ── Recommandations (§4.3) ────────────────────────────────────────────────

  /**
   * POST /pros/:id/recommend.
   *
   * RÈGLE DURE §4.3 : « uniquement si une `connection` existe entre le membre et le
   * pro (`connection_id` obligatoire, vérifié) ». La colonne n'est pas nullable, donc
   * une recommandation sans contact ne peut même pas s'écrire — mais on lève
   * `CONNECTION_REQUIRED` avant d'y arriver, pour que le membre comprenne.
   */
  async recommend(proProfileId: string, authorUserId: string, input: RecommendPro) {
    const pro = await this.prisma.proProfile.findFirst({
      where: { id: proProfileId, ...this.publiclyVisible() },
      select: { id: true, userId: true },
    });
    if (pro === null) throw ApiError.notFound();
    // §4.3 : « Un pro ne peut pas recommander lui-même. »
    if (pro.userId === authorUserId) this.fail('OWN_PROFILE');
    await this.visibility.assertVisible(authorUserId, pro.userId);
    this.assertNoForbiddenWord(input.comment);

    const connectionId = await this.connectionBetween(authorUserId, pro.userId);
    if (connectionId === null) this.fail('CONNECTION_REQUIRED');

    const existing = await this.prisma.proRecommendation.findFirst({
      where: { proProfileId, authorUserId },
      select: { id: true },
    });
    if (existing !== null) this.fail('ALREADY_RECOMMENDED');

    const id = newId();
    // §4.3 : « une recommandation réciproque dans les 7 jours est acceptée mais
    // marquée pour revue ». Calculé AVANT l'écriture : après, la nôtre compterait.
    const reciprocal = await this.reciprocalRecommendation(authorUserId, pro.userId);

    await this.prisma.$transaction(async (tx) => {
      await tx.proRecommendation.create({
        data: {
          id,
          proProfileId,
          authorUserId,
          connectionId,
          comment: input.comment ?? null,
        },
      });
      await tx.proProfile.update({
        where: { id: proProfileId },
        data: { recommendationCount: { increment: 1 } },
      });

      if (reciprocal !== null) {
        await tx.moderationCase.create({
          data: {
            id: newId(),
            subjectType: 'PRO',
            subjectId: proProfileId,
            subjectAuthorUserId: pro.userId,
            source: 'AUTO_RULE',
            priority: PRO_RECIPROCAL_CASE_PRIORITY,
            status: 'OPEN',
            aiLabels: ['RECIPROCAL_RECOMMENDATION'],
            slaDueAt: new Date(Date.now() + 24 * 3_600_000),
          },
        });
      }

      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: authorUserId },
        action: 'pro.recommended',
        targetType: 'pro_recommendation',
        targetId: id,
        metadata: { proProfileId, reciprocal: reciprocal !== null },
      });

      await this.outbox.emit(tx, {
        type: 'pro.recommended',
        aggregateId: proProfileId,
        payload: { authorUserId, notifyUserId: pro.userId, reciprocal: reciprocal !== null },
      });
    });

    return { id, proProfileId, flaggedForReview: reciprocal !== null };
  }

  /** DELETE /pros/:id/recommend — « Retirable » (§4.3). */
  async unrecommend(proProfileId: string, authorUserId: string): Promise<{ deleted: true }> {
    const existing = await this.prisma.proRecommendation.findFirst({
      where: { proProfileId, authorUserId },
      select: { id: true },
    });
    if (existing === null) throw ApiError.notFound();

    await this.prisma.$transaction(async (tx) => {
      await tx.proRecommendation.delete({ where: { id: existing.id } });
      await tx.proProfile.update({
        where: { id: proProfileId },
        // Borné à 0 : un compteur dénormalisé qui passe négatif se remarque des mois
        // plus tard, sur une fiche « recommandée par −1 membre ».
        data: { recommendationCount: { decrement: 1 } },
      });
      await tx.proProfile.updateMany({
        where: { id: proProfileId, recommendationCount: { lt: 0 } },
        data: { recommendationCount: 0 },
      });
    });
    return { deleted: true };
  }

  // ── Tâches et événements (§8, §9, §10) ────────────────────────────────────

  /**
   * Tâche `pro.tier_expire` (§9) : « Un abonnement expiré rétrograde en FREE sans
   * supprimer la fiche » (§4.1).
   *
   * Les lectures ne s'y fient pas (`effectiveTier` compare la date) : la tâche
   * nettoie l'état, elle ne décide pas de l'affichage. Idempotente.
   */
  async expireTiers(now = new Date()): Promise<number> {
    const { count } = await this.prisma.proProfile.updateMany({
      where: { tier: { not: 'FREE' }, tierUntil: { lte: now } },
      data: { tier: 'FREE', tierUntil: null },
    });
    return count;
  }

  /**
   * `connection.removed` (§8).
   *
   * §4.3 conditionne la recommandation à l'existence d'un contact : quand le contact
   * disparaît, la recommandation n'a plus son fondement. Idempotent — `deleteMany`
   * sur un identifiant déjà traité ne trouve rien — et les compteurs sont recalculés
   * plutôt que décrémentés, pour qu'un rejeu ne les fasse pas plonger.
   */
  async handleConnectionRemoved(connectionId: string): Promise<void> {
    const affected = await this.prisma.proRecommendation.findMany({
      where: { connectionId },
      select: { proProfileId: true },
    });
    if (affected.length === 0) return;

    await this.prisma.proRecommendation.deleteMany({ where: { connectionId } });
    for (const proProfileId of new Set(affected.map((row) => row.proProfileId))) {
      await this.recountRecommendations(proProfileId);
    }
  }

  /**
   * `user.blocked` (§8).
   *
   * Un blocage sépare les deux membres dans les deux sens (08 §4) et retire le
   * contact. Les recommandations échangées entre eux perdent donc leur fondement,
   * exactement comme sur un retrait de contact. Idempotent et indépendant : ce
   * gestionnaire ne fait que sa part, et lève si elle échoue pour être rejoué.
   */
  async handleUserBlocked(blockerUserId: string, blockedUserId: string): Promise<void> {
    const profiles = await this.prisma.proProfile.findMany({
      where: { userId: { in: [blockerUserId, blockedUserId] } },
      select: { id: true, userId: true },
    });
    if (profiles.length === 0) return;

    for (const profile of profiles) {
      const author = profile.userId === blockerUserId ? blockedUserId : blockerUserId;
      const { count } = await this.prisma.proRecommendation.deleteMany({
        where: { proProfileId: profile.id, authorUserId: author },
      });
      if (count > 0) await this.recountRecommendations(profile.id);
    }
  }

  /**
   * §10 : « Fiche pro : supprimée, justificatif détruit, recommandations reçues
   * supprimées ; recommandations données par le membre : supprimées. Journaux de
   * contact : anonymisés (conservés pour les quotas des autres membres). »
   *
   * Le justificatif est détruit explicitement : la contrainte du schéma est
   * `onDelete: SetNull`, donc supprimer la fiche laisserait le média en place, et un
   * extrait SIRENE oublié dans le stockage est exactement ce que §4.1 interdit.
   *
   * Les journaux de contact ne peuvent PAS être anonymisés : `pro_contact_logs.user_id`
   * n'est pas nullable et la clé étrangère est en cascade. Les lignes du membre
   * supprimé disparaissent donc avec lui — celles des AUTRES membres, qui portent leur
   * propre `user_id`, sont intactes, et c'est ce que le §10 protège vraiment.
   * Signalé, non contourné.
   */
  async handleUserDeleted(userId: string): Promise<void> {
    const profile = await this.prisma.proProfile.findUnique({
      where: { userId },
      select: { id: true, proofAssetId: true },
    });

    await this.prisma.proRecommendation.deleteMany({ where: { authorUserId: userId } });

    if (profile !== null) {
      const affected = await this.prisma.proRecommendation.findMany({
        where: { proProfileId: profile.id },
        select: { id: true },
      });
      if (affected.length > 0) {
        await this.prisma.proRecommendation.deleteMany({ where: { proProfileId: profile.id } });
      }
      await this.prisma.proContactLog.deleteMany({ where: { proProfileId: profile.id } });
      await this.prisma.proProfile.delete({ where: { id: profile.id } });
      if (profile.proofAssetId !== null) {
        await this.prisma.mediaAsset.deleteMany({ where: { id: profile.proofAssetId } });
      }
    }

    await this.prisma.proContactLog.deleteMany({ where: { userId } });
  }

  // ── Plomberie ─────────────────────────────────────────────────────────────

  /**
   * RÈGLE DURE 01 §1.2, appliquée ICI et non dans le schéma zod.
   *
   * Le tuyau de validation (00 §5.2) ne transmet que le CODE d'issue de zod, jamais
   * son message : un `.refine()` aurait donc rendu « Certaines informations sont
   * incomplètes ou mal remplies » sur un refus qui a besoin d'être expliqué, et le
   * membre n'aurait pu que tâtonner. Relevé en appelant la route au curl.
   *
   * `proTextIsAllowed` de `@app/shared` délègue à `containsForbiddenWord`, SOURCE
   * UNIQUE de la règle : en réécrire une variante ici ferait deux règles, dont une
   * seule épargnerait « certificat ».
   */
  private assertNoForbiddenWord(text: string | null | undefined): void {
    if (!proTextIsAllowed(text)) {
      throw new ApiError(
        'FORBIDDEN_WORD',
        PRO_ERROR_MESSAGES.FORBIDDEN_WORD,
        PRO_ERROR_CODES.FORBIDDEN_WORD,
      );
    }
  }

  /** §4.1 : visible seulement une fois validée par un humain. */
  private publiclyVisible(): Prisma.ProProfileWhereInput {
    return { deletedAt: null, status: 'ACTIVE', verificationStatus: 'APPROVED' };
  }

  private isVisible(row: ProRow): boolean {
    return row.deletedAt === null && row.status === 'ACTIVE' && row.verificationStatus === 'APPROVED';
  }

  /** §4.2 : les fiches qui ont DROIT à un emplacement mis en avant, aujourd'hui. */
  private paidAndCurrent(now: Date): Prisma.ProProfileWhereInput {
    return {
      tier: { in: ['PRO', 'PRO_PLUS'] },
      OR: [{ tierUntil: null }, { tierUntil: { gt: now } }],
    };
  }

  private isPaidAndCurrent(row: ProRow): boolean {
    return this.effectiveTier(row) !== 'FREE';
  }

  /**
   * §4.1 : « Un abonnement expiré rétrograde en FREE sans supprimer la fiche. »
   *
   * Lu sur la DATE et non sur la colonne : la facturation (module 14) n'existe pas
   * encore pour faire la rétrogradation, et la tâche `pro.tier_expire` peut avoir du
   * retard. Se fier à `tier` seul mettrait en avant des fiches non payées.
   */
  private effectiveTier(row: { tier: string; tierUntil: Date | null }): string {
    if (row.tier === 'FREE') return 'FREE';
    if (row.tierUntil !== null && row.tierUntil.getTime() <= Date.now()) return 'FREE';
    return row.tier;
  }

  private keysetFor(
    cursor: { id: string; sort?: string | number } | null,
  ): Prisma.ProProfileWhereInput {
    if (cursor === null || cursor.sort === undefined) return {};
    const count = Number(cursor.sort);
    return {
      OR: [
        { recommendationCount: { lt: count } },
        { recommendationCount: count, id: { lt: cursor.id } },
      ],
    };
  }

  /** §4.4 : la limite du plan, lue dans `plans.limits` quand la ligne existe. */
  private async contactsPerMonth(planCode: UserPlan): Promise<number> {
    const plan = await this.prisma.plan.findUnique({
      where: { code: planCode },
      select: { limits: true },
    });
    const limits = plan?.limits;
    if (limits !== null && limits !== undefined && typeof limits === 'object' && !Array.isArray(limits)) {
      const raw = (limits as Record<string, unknown>)['proContactsPerMonth'];
      if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0) return raw;
    }
    // `plans` n'est pas amorcée (module 14 absent). Retomber sur la spec est
    // obligatoire : ne pas le faire signifierait « aucune limite jusqu'au module 14 »,
    // or c'est une règle dure.
    return FREE_PRO_CONTACTS_PER_MONTH;
  }

  private async consumeContactQuota(
    tx: Prisma.TransactionClient,
    userId: string,
    plan: UserPlan,
    periodKey: string,
  ): Promise<void> {
    // Premium : illimité (§4.4). Le compteur n'est même pas incrémenté — un compteur
    // qui monte sans plafond ne sert qu'à faire croire à une limite.
    if (plan !== 'FREE') return;

    const max = await this.contactsPerMonth(plan);
    const counter = await tx.usageCounter.upsert({
      where: { userId_metric_periodKey: { userId, metric: 'PRO_CONTACTS', periodKey } },
      create: { userId, metric: 'PRO_CONTACTS', periodKey, count: 1 },
      update: { count: { increment: 1 } },
      select: { count: true },
    });

    if (counter.count > max) {
      // La levée annule l'incrément avec la transaction : rien à compenser. Le front
      // affiche l'invitation Premium sur `PLAN_LIMIT_REACHED` (T4 §3), et §4.4 précise
      // que la conversation déjà ouverte reste accessible — elle n'est pas touchée ici.
      throw ApiError.planLimit('proContactsPerMonth', counter.count - 1, max);
    }
  }

  /** Le compteur affiché sur l'écran de contact (§7). `max: null` = illimité. */
  private async contactQuotaOf(userId: string): Promise<{ used: number; max: number | null }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { plan: true },
    });
    const periodKey = monthKey(new Date());
    const used = await this.prisma.proContactLog.count({ where: { userId, periodKey } });
    if (user.plan !== 'FREE') return { used, max: null };
    return { used, max: await this.contactsPerMonth(user.plan) };
  }

  /** L'identifiant du contact entre deux membres, ou `null` (§4.3). */
  private async connectionBetween(a: string, b: string): Promise<string | null> {
    const connection = await this.prisma.connection.findFirst({
      where: {
        removedAt: null,
        OR: [
          { userAId: a, userBId: b },
          { userAId: b, userBId: a },
        ],
      },
      select: { id: true },
    });
    return connection?.id ?? null;
  }

  /**
   * §4.3 : la boucle de complaisance — le pro recommandé a-t-il recommandé MA fiche
   * dans les sept derniers jours ?
   */
  private async reciprocalRecommendation(
    authorUserId: string,
    proUserId: string,
  ): Promise<string | null> {
    const myProfile = await this.prisma.proProfile.findUnique({
      where: { userId: authorUserId },
      select: { id: true },
    });
    if (myProfile === null) return null;

    const since = new Date(Date.now() - PRO_RECIPROCAL_WINDOW_DAYS * 86_400_000);
    const reciprocal = await this.prisma.proRecommendation.findFirst({
      where: { proProfileId: myProfile.id, authorUserId: proUserId, createdAt: { gte: since } },
      select: { id: true },
    });
    return reciprocal?.id ?? null;
  }

  /** Recalcule le compteur dénormalisé. Idempotent, contrairement à un décrément. */
  private async recountRecommendations(proProfileId: string): Promise<void> {
    const count = await this.prisma.proRecommendation.count({ where: { proProfileId } });
    await this.prisma.proProfile.updateMany({
      where: { id: proProfileId },
      data: { recommendationCount: count },
    });
  }

  private async assertOwnedProof(userId: string, proofAssetId: string): Promise<void> {
    const asset = await this.prisma.mediaAsset.findFirst({
      // `status: 'READY'` — §8.3 : l'analyse antivirus précède la publication, et
      // un justificatif refusé laisse une ligne `REJECTED` sans octets derrière
      // elle. L'équipe qui ouvrirait la fiche ne trouverait rien à lire.
      where: {
        id: proofAssetId,
        ownerUserId: userId,
        kind: 'PROOF',
        deletedAt: null,
        status: 'READY',
      },
      select: { id: true },
    });
    // 404 sur un média d'autrui, jamais 403 : répondre « ce fichier n'est pas à vous »
    // confirmerait qu'il existe.
    if (asset === null) throw ApiError.validation([{ path: 'proofAssetId', code: 'NOT_FOUND' }]);
  }

  private async resolveCityIds(cityIds: readonly string[]): Promise<string[]> {
    const unique = [...new Set(cityIds)];
    const cities = await this.prisma.city.findMany({
      where: { id: { in: unique } },
      select: { id: true, mergedIntoCityId: true },
    });
    if (cities.length !== unique.length) {
      throw ApiError.validation([{ path: 'cityIds', code: 'NOT_FOUND' }]);
    }
    return [...new Set(cities.map((city) => city.mergedIntoCityId ?? city.id))];
  }

  private async mutualConnectionCount(viewerId: string, otherId: string): Promise<number> {
    const [mine, theirs] = await Promise.all([
      this.connectionPeers(viewerId),
      this.connectionPeers(otherId),
    ]);
    let shared = 0;
    for (const id of mine) if (theirs.has(id)) shared += 1;
    return shared;
  }

  private async connectionPeers(userId: string): Promise<Set<string>> {
    const rows = await this.prisma.connection.findMany({
      where: { removedAt: null, OR: [{ userAId: userId }, { userBId: userId }] },
      select: { userAId: true, userBId: true },
    });
    return new Set(rows.map((row) => (row.userAId === userId ? row.userBId : row.userAId)));
  }

  /** Voir `HousingService.ensureDirectConversation` : le module 08 n'est pas livré. */
  private async ensureDirectConversation(
    tx: Prisma.TransactionClient,
    a: string,
    b: string,
  ): Promise<string> {
    const existing = await tx.conversation.findFirst({
      where: {
        kind: 'DIRECT',
        AND: [{ members: { some: { userId: a } } }, { members: { some: { userId: b } } }],
      },
      select: { id: true },
    });
    if (existing !== null) {
      await tx.conversationMember.updateMany({
        where: { conversationId: existing.id, userId: { in: [a, b] } },
        data: { leftAt: null },
      });
      return existing.id;
    }

    const id = newId();
    const joinedAt = new Date();
    await tx.conversation.create({ data: { id, kind: 'DIRECT' } });
    await tx.conversationMember.createMany({
      data: [
        { conversationId: id, userId: a, joinedAt },
        { conversationId: id, userId: b, joinedAt },
      ],
    });
    return id;
  }

  private toCard(row: ProRow, viewerId: string | null, isFeatured = false): ProCard {
    const tier = this.effectiveTier(row);
    return {
      id: row.id,
      handle: row.user.handle,
      displayName: row.user.displayName,
      avatarUrl: row.user.avatarAsset === null ? null : `/media/${row.user.avatarAsset.storageKey}`,
      profession: row.profession,
      businessName: row.businessName,
      description: row.description,
      priceHint: row.priceHint,
      contactMethod: row.contactMethod,
      // §4.1 : « le téléphone n'est JAMAIS stocké ici ni affiché ». Ce champ est une
      // EXPLICATION, pas un numéro — il n'y a aucun numéro à donner.
      contactHint: row.contactMethod === 'PHONE_ON_REQUEST' ? PRO_PHONE_ON_REQUEST_HINT : null,
      siret: row.siret,
      cities: row.cities.map((link) => link.city),
      languages: row.user.languages.map((link) => link.language),
      recommendationCount: row.recommendationCount,
      tier,
      isFeatured: isFeatured && tier !== 'FREE',
      featuredLabel: isFeatured && tier !== 'FREE' ? PRO_FEATURED_LABEL : null,
      isMine: viewerId !== null && row.userId === viewerId,
      createdAt: row.createdAt,
    };
  }
}

/** Clé de période des compteurs d'usage : AAAA-MM. */
export function monthKey(instant: Date): string {
  return instant.toISOString().slice(0, 7);
}
