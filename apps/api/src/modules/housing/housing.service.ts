import { Injectable, Logger } from '@nestjs/common';
import { newId, type Prisma } from '@app/db';
import {
  ALERT_DISPATCH_INTERVAL_MS,
  type CreateAlert,
  type CreateHousing,
  HOUSING_CAUTION_LEVELS,
  HOUSING_CONTACT_PATTERNS,
  HOUSING_ERROR_CODES,
  HOUSING_ERROR_MESSAGES,
  HOUSING_L0_CONTACT_HINT,
  HOUSING_L2_EXPLANATION,
  HOUSING_LIFETIME_DAYS,
  HOUSING_MEDIAN_RATIO,
  HOUSING_NEW_MEMBER_DAYS,
  HOUSING_PRICE_BOUNDS_DEFAULT,
  HOUSING_RENEW_INTERVAL_DAYS,
  HOUSING_RISK_BLOCK_THRESHOLD,
  HOUSING_RISK_FLAGS,
  HOUSING_RISK_REVIEW_THRESHOLD,
  HOUSING_RISK_WEIGHTS,
  HOUSING_SAFETY_BANNER,
  HOUSING_SCAM_TERM_PATTERN,
  type HousingCautionLevel,
  type HousingErrorCode,
  type HousingKind,
  type HousingQuery,
  type HousingRiskFlag,
  MAX_ACTIVE_HOUSING_LISTINGS,
  type Page,
  type UpdateAlert,
  type UpdateHousing,
  type VerificationLevel,
  isHousingOfferKind,
  levelRequiredDetails,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { AuditService } from '../../common/audit.service';
import { buildPage, decodeCursor } from '../../common/cursor';
import { OutboxService } from '../../common/outbox.service';
import { PrismaService } from '../../common/prisma.service';
import { VisibilityService } from '../../common/visibility.service';
import { loadEnv } from '../../config/env';
// Le haversine de l'agenda, et non une troisième copie : « ville + 30 km » est la
// même règle ici et là (09 §2.2, 10 §2.4), et deux implémentations d'une distance
// finissent par ne plus donner le même rayon. C'est une fonction PURE, pas le
// dépôt d'un autre module — l'interdit du §3.3 ne porte pas sur elle.
import { haversineKm } from '../events/events.service';
import { assertLocalRules } from '../../common/content-gate';

/**
 * Logement — 10-services.md §2.
 *
 * Le logement est « la surface d'attaque principale des arnaques » (§2, et le
 * schéma le redit). Tout ce service est organisé autour de cette phrase :
 *
 *   · PUBLIER exige L2 « sans exception » (§2.1), recherches comprises — on ne met
 *     en relation que des personnes présentes sur le territoire. Le garde l'applique
 *     par la capacité `housing.publish`, et le service le REVÉRIFIE : une règle dure
 *     qui ne tient qu'au décorateur tombe le jour où quelqu'un appelle le service
 *     depuis une tâche ou un autre module ;
 *
 *   · le SCORE de risque (§2.2) décide de la publication, et il n'est JAMAIS
 *     renvoyé. L'écran de publication ne montre aucun aperçu (§7) : un auteur qui
 *     voit son score apprend à le contourner. Ce que l'API expose, c'est un
 *     `cautionLevel` — standard ou renforcé — qui ne dit rien des poids ;
 *
 *   · le BANDEAU de sécurité accompagne chaque liste et chaque annonce (règle dure
 *     §2.2). Il passe par `meta`, prévu pour cela (T4 §4), plutôt que par une
 *     constante du front qu'un déploiement pourrait effacer.
 *
 * Ce que ce service NE fait pas, et pourquoi :
 *
 *   · il n'envoie aucune notification et n'indexe rien. §8 nomme les consommateurs
 *     (search, moderation, alerts) et 00 §3.3 interdit l'appel direct : tout passe
 *     par la boîte d'envoi ;
 *   · il n'appelle pas le fournisseur de modération IA pour le score. §2.2 NOMME
 *     les termes recherchés, ce qui en fait une règle locale, applicable même
 *     fournisseur indisponible. Le pipeline complet du module 13 passe en plus, sur
 *     l'événement `housing.published`.
 *
 * COLONNES MANQUANTES (signalées, non contournées — §5 les annonce « ajoutées »,
 * le schéma figé ne les porte pas) :
 *   · `renewed_at` / `renew_count` : l'intervalle de renouvellement est DÉDUIT de
 *     `expires_at` (voir `renew`) ;
 *   · `photo_hashes` : l'empreinte perceptuelle n'existe pas. Le signal « photos
 *     identiques » se rabat sur le partage du MÊME média, qui attrape la
 *     réutilisation d'une photo déjà publiée sur la plateforme, pas une photo
 *     réenregistrée ;
 *   · `hidden_from_user_ids` : `POST /housing/:id/hide-from` (§6.1) n'est donc PAS
 *     livrée. Aucune autre table ne peut porter un masquage local sans en faire un
 *     blocage global, ce que §2.3 refuse explicitement.
 */

/** Ce qu'une annonce expose. Ni score, ni drapeau, ni compteur (règle dure 01 §1.2). */
export interface HousingCard {
  readonly id: string;
  readonly kind: HousingKind;
  readonly title: string;
  readonly description: string;
  readonly city: { readonly id: string; readonly name: string; readonly slug: string };
  readonly district: string | null;
  readonly priceCents: number | null;
  readonly currency: string;
  readonly isFurnished: boolean | null;
  readonly availableFrom: Date | null;
  readonly durationMonths: number | null;
  readonly status: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly photos: readonly { readonly url: string; readonly position: number }[];
  readonly author: {
    readonly handle: string;
    readonly displayName: string;
    readonly avatarUrl: string | null;
    /** Le badge de l'écran (§7) : un auteur de logement est toujours L2. */
    readonly verificationLevel: VerificationLevel;
  };
  /**
   * §2.2 : « l'interface ajoute un rappel de prudence renforcé ». Deux valeurs
   * seulement — le score reste interne.
   */
  readonly cautionLevel: HousingCautionLevel;
  readonly isMine: boolean;
  /** Réservé à l'auteur : `null` pour les autres lecteurs. */
  readonly reviewState: 'PUBLISHED' | 'UNDER_REVIEW' | null;
  /** Réservé à l'auteur : le bouton « Renouveler » est-il actif (§2.1) ? */
  readonly canRenew: boolean | null;
}

/** La fiche d'une annonce : le bandeau et « Connecté·e à N de vos contacts » (§7). */
export interface HousingDetail extends HousingCard {
  readonly safetyBanner: string;
  readonly mutualConnectionCount: number;
}

const HOUSING_SELECT = {
  id: true,
  createdAt: true,
  deletedAt: true,
  authorUserId: true,
  kind: true,
  title: true,
  description: true,
  district: true,
  priceCents: true,
  currency: true,
  isFurnished: true,
  availableFrom: true,
  durationMonths: true,
  status: true,
  riskScore: true,
  moderationStatus: true,
  expiresAt: true,
  city: { select: { id: true, name: true, slug: true } },
  author: {
    select: {
      handle: true,
      displayName: true,
      verificationLevel: true,
      avatarAsset: { select: { storageKey: true } },
    },
  },
  photos: {
    select: { position: true, mediaAsset: { select: { storageKey: true } } },
    orderBy: { position: 'asc' },
  },
} satisfies Prisma.HousingListingSelect;

type HousingRow = Prisma.HousingListingGetPayload<{ select: typeof HOUSING_SELECT }>;

/** Le résultat du §2.2, avant écriture. */
export interface RiskAssessment {
  readonly score: number;
  readonly flags: HousingRiskFlag[];
  /** `≥ 0,7` : l'annonce n'est pas publiée, un humain décide (§2.2). */
  readonly held: boolean;
  /** `0,4–0,7` : publiée, dossier priorité 2, rappel renforcé. */
  readonly review: boolean;
}

@Injectable()
export class HousingService {
  private readonly logger = new Logger(HousingService.name);
  private readonly cursorSecret = loadEnv().CURSOR_SECRET;

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly visibility: VisibilityService,
  ) {}

  private fail(code: HousingErrorCode, details?: Record<string, unknown>): never {
    throw new ApiError(code, HOUSING_ERROR_MESSAGES[code], HOUSING_ERROR_CODES[code], details);
  }

  // ── Publication (§2.1) ────────────────────────────────────────────────────

  /**
   * Crée une annonce ou une recherche.
   *
   * L'ordre des contrôles compte : le NIVEAU d'abord (une invitation à vérifier son
   * compte est plus utile qu'un « trop d'annonces »), la ville ensuite, le quota
   * enfin — et le score de risque en dernier, parce qu'il coûte plusieurs requêtes.
   */
  async create(authorUserId: string, input: CreateHousing): Promise<HousingCard> {
    const author = await this.prisma.user.findUniqueOrThrow({
      where: { id: authorUserId },
      select: { verificationLevel: true, createdAt: true },
    });
    this.assertPublishLevel(author.verificationLevel);
    // 13 §2.1 : les règles locales, avant que l'annonce n'existe.
    assertLocalRules(input.title, input.description);

    const cityId = await this.resolveCityId(input.cityId);

    const active = await this.prisma.housingListing.count({
      where: this.activeForAuthor(authorUserId),
    });
    if (active >= MAX_ACTIVE_HOUSING_LISTINGS) {
      this.fail('MAX_ACTIVE_LISTINGS', { current: active, max: MAX_ACTIVE_HOUSING_LISTINGS });
    }

    await this.assertOwnedPhotos(authorUserId, input.photoAssetIds);

    const listingId = newId();
    const risk = await this.assessRisk({
      authorUserId,
      kind: input.kind,
      cityId,
      description: input.description,
      priceCents: input.priceCents ?? null,
      photoAssetIds: input.photoAssetIds,
      excludeListingId: null,
    });

    const expiresAt = new Date(Date.now() + HOUSING_LIFETIME_DAYS * 86_400_000);

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.housingListing.create({
        data: {
          id: listingId,
          authorUserId,
          kind: input.kind,
          title: input.title,
          description: input.description,
          cityId,
          district: input.district ?? null,
          priceCents: input.priceCents ?? null,
          isFurnished: input.isFurnished ?? null,
          availableFrom: input.availableFrom ?? null,
          durationMonths: input.durationMonths ?? null,
          status: 'ACTIVE',
          riskScore: risk.score,
          riskFlags: risk.flags,
          // PENDING = retenue pour décision humaine, donc invisible ; CLEARED =
          // publiée. C'est la seule colonne disponible pour porter cet état, et
          // `status` reste ACTIVE : l'annonce occupe bien un des trois créneaux du
          // membre, qui n'a rien mis en pause.
          moderationStatus: risk.held ? 'PENDING' : 'CLEARED',
          expiresAt,
        },
        select: HOUSING_SELECT,
      });

      await this.writePhotos(tx, listingId, input.photoAssetIds);

      if (risk.held || risk.review) {
        await this.openRiskCase(tx, listingId, authorUserId, risk);
      }

      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: authorUserId },
        action: 'housing.created',
        targetType: 'housing_listing',
        targetId: listingId,
        // Le score et les drapeaux ont leur place ICI — la trace est réservée à
        // l'équipe — et nulle part dans une réponse d'API.
        metadata: { kind: input.kind, cityId, riskScore: risk.score, riskFlags: risk.flags },
      });

      // Aucun événement quand l'annonce est retenue : `housing.published` déclenche
      // l'indexation et les alertes, et une annonce en vérification ne doit
      // apparaître dans aucune des deux.
      if (!risk.held) {
        await this.outbox.emit(tx, {
          type: 'housing.published',
          aggregateId: listingId,
          payload: {
            authorUserId,
            kind: input.kind,
            cityId,
            priceCents: input.priceCents ?? null,
            riskScore: risk.score,
          },
        });
      }

      return await tx.housingListing.findUniqueOrThrow({
        where: { id: row.id },
        select: HOUSING_SELECT,
      });
    });

    // §6.1 : `LISTING_UNDER_REVIEW` figure parmi les erreurs de POST /housing, et
    // §2.2 veut que l'annonce EXISTE avec son dossier de modération. La transaction
    // est donc validée d'abord, puis on lève : l'auteur reçoit « en vérification »,
    // l'équipe reçoit son dossier, et rien n'est perdu.
    if (risk.held) this.fail('LISTING_UNDER_REVIEW', { listingId });

    return this.toCard(created, authorUserId);
  }

  /** §2.2 : le score est recalculé « à chaque modification ». */
  async update(listingId: string, authorUserId: string, patch: UpdateHousing): Promise<HousingCard> {
    const listing = await this.loadOwned(listingId, authorUserId);
    if (listing.status === 'REMOVED') throw ApiError.transverse('CONFLICT', { status: 'REMOVED' });
    // Un texte modifié repasse par les mêmes règles : sinon le filtre se contourne en deux temps.
    assertLocalRules(patch.title, patch.description);

    const cityId = patch.cityId === undefined ? listing.city.id : await this.resolveCityId(patch.cityId);
    const description = patch.description ?? listing.description;
    const priceCents =
      patch.priceCents === undefined ? listing.priceCents : (patch.priceCents ?? null);

    if (patch.photoAssetIds !== undefined) {
      await this.assertOwnedPhotos(authorUserId, patch.photoAssetIds);
      if (isHousingOfferKind(listing.kind) && patch.photoAssetIds.length === 0) {
        throw ApiError.validation([{ path: 'photoAssetIds', code: 'TOO_SMALL' }]);
      }
    }
    if (isHousingOfferKind(listing.kind) && listing.kind !== 'TEMPORARY' && priceCents === null) {
      throw ApiError.validation([{ path: 'priceCents', code: 'INVALID_TYPE' }]);
    }

    const photoAssetIds =
      patch.photoAssetIds ?? (await this.currentPhotoAssetIds(listingId));

    const risk = await this.assessRisk({
      authorUserId,
      kind: listing.kind,
      cityId,
      description,
      priceCents,
      photoAssetIds,
      excludeListingId: listingId,
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.housingListing.update({
        where: { id: listingId },
        data: {
          ...(patch.title === undefined ? {} : { title: patch.title }),
          ...(patch.description === undefined ? {} : { description: patch.description }),
          ...(patch.cityId === undefined ? {} : { cityId }),
          ...(patch.district === undefined ? {} : { district: patch.district }),
          ...(patch.priceCents === undefined ? {} : { priceCents: patch.priceCents }),
          ...(patch.isFurnished === undefined ? {} : { isFurnished: patch.isFurnished }),
          ...(patch.availableFrom === undefined ? {} : { availableFrom: patch.availableFrom }),
          ...(patch.durationMonths === undefined ? {} : { durationMonths: patch.durationMonths }),
          riskScore: risk.score,
          riskFlags: risk.flags,
          // Une annonce déjà retenue le reste jusqu'à la décision humaine : une
          // modification ne la libère pas, sinon il suffirait d'éditer une virgule
          // pour passer la barrière.
          moderationStatus:
            risk.held || listing.moderationStatus === 'PENDING' ? 'PENDING' : 'CLEARED',
        },
      });

      if (patch.photoAssetIds !== undefined) {
        await tx.housingPhoto.deleteMany({ where: { listingId } });
        await this.writePhotos(tx, listingId, patch.photoAssetIds);
      }

      if (risk.held || risk.review) {
        await this.openRiskCase(tx, listingId, authorUserId, risk);
      }

      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: authorUserId },
        action: 'housing.updated',
        targetType: 'housing_listing',
        targetId: listingId,
        metadata: { riskScore: risk.score, riskFlags: risk.flags },
      });

      await this.outbox.emit(tx, {
        type: 'housing.updated',
        aggregateId: listingId,
        payload: { authorUserId, cityId, held: risk.held },
      });

      return await tx.housingListing.findUniqueOrThrow({
        where: { id: listingId },
        select: HOUSING_SELECT,
      });
    });

    if (risk.held) this.fail('LISTING_UNDER_REVIEW', { listingId });
    return this.toCard(updated, authorUserId);
  }

  /**
   * Renouvellement (§2.1) : « une fois par 30 jours, sans repasser en modération ».
   *
   * `renewed_at` n'existe pas dans le schéma figé, alors que §5 l'annonce. On DÉDUIT
   * la date du dernier renouvellement de `expires_at` : la durée de vie est fixe, donc
   * un renouvellement a eu lieu à `expires_at − 60 j`. La condition « il y a plus de
   * 30 jours » devient donc « il reste au plus 30 jours ».
   *
   * Conséquence assumée : une annonce fraîchement publiée ne se renouvelle pas tout de
   * suite. C'est exactement ce que « une fois par 30 jours » demande, et cela évite
   * qu'un membre remonte son annonce en tête tous les matins.
   */
  async renew(listingId: string, authorUserId: string): Promise<HousingCard> {
    const listing = await this.loadOwned(listingId, authorUserId);
    if (listing.status === 'REMOVED') throw ApiError.transverse('CONFLICT', { status: 'REMOVED' });

    const now = Date.now();
    const renewableFrom =
      listing.expiresAt.getTime() - (HOUSING_LIFETIME_DAYS - HOUSING_RENEW_INTERVAL_DAYS) * 86_400_000;
    if (now < renewableFrom) {
      this.fail('RENEW_TOO_SOON', { renewableAt: new Date(renewableFrom).toISOString() });
    }

    const expiresAt = new Date(now + HOUSING_LIFETIME_DAYS * 86_400_000);
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.housingListing.update({
        where: { id: listingId },
        data: {
          expiresAt,
          // Une annonce expirée redevient active ; une annonce en pause le reste —
          // renouveler n'est pas reprendre.
          ...(listing.status === 'EXPIRED' ? { status: 'ACTIVE' as const } : {}),
        },
        select: HOUSING_SELECT,
      });
      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: authorUserId },
        action: 'housing.renewed',
        targetType: 'housing_listing',
        targetId: listingId,
        metadata: { expiresAt: expiresAt.toISOString() },
      });
      return updated;
    });

    return this.toCard(row, authorUserId);
  }

  /** §2.1 : `PAUSED`, `TAKEN` (« Logement trouvé »), `REMOVED`. */
  async setStatus(
    listingId: string,
    authorUserId: string,
    status: 'ACTIVE' | 'PAUSED' | 'TAKEN' | 'REMOVED',
  ): Promise<HousingCard> {
    const listing = await this.loadOwned(listingId, authorUserId);
    if (listing.status === status) return this.toCard(listing, authorUserId);

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.housingListing.update({
        where: { id: listingId },
        data: {
          status,
          ...(status === 'REMOVED' ? { deletedAt: new Date() } : {}),
        },
        select: HOUSING_SELECT,
      });

      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: authorUserId },
        action: `housing.${status.toLowerCase()}`,
        targetType: 'housing_listing',
        targetId: listingId,
      });

      // §8 : `housing.taken` a ses consommateurs (search retire l'annonce, les
      // alertes cessent de la proposer). Les autres transitions ne changent rien
      // pour eux : une annonce en pause reste indexée, et `housing.updated` suffit.
      if (status === 'TAKEN') {
        await this.outbox.emit(tx, {
          type: 'housing.taken',
          aggregateId: listingId,
          payload: { authorUserId, cityId: listing.city.id },
        });
      } else {
        await this.outbox.emit(tx, {
          type: 'housing.updated',
          aggregateId: listingId,
          payload: { authorUserId, cityId: listing.city.id, status },
        });
      }

      return updated;
    });

    return this.toCard(row, authorUserId);
  }

  // ── Contact (§2.3) ────────────────────────────────────────────────────────

  /**
   * « Contacter » ouvre une conversation directe.
   *
   * L0 est refusé AVEC une orientation vers le parrainage (§2.3) : un pré-départ
   * peut lire les annonces mais doit passer par un parrain ou un accompagnant. Le
   * garde refuse déjà (capacité `message.send`, L1) ; le contrôle est répété ici
   * parce que c'est la règle, et parce qu'une règle qui ne tient qu'au décorateur
   * disparaît dès qu'un autre appelant arrive.
   */
  async contact(listingId: string, viewerId: string): Promise<{
    conversationId: string;
    safetyBanner: string;
  }> {
    const viewer = await this.prisma.user.findUniqueOrThrow({
      where: { id: viewerId },
      select: { verificationLevel: true },
    });
    if (viewer.verificationLevel === 'L0') {
      throw ApiError.transverse('LEVEL_REQUIRED', {
        ...levelRequiredDetails('message.send', viewer.verificationLevel),
        hint: HOUSING_L0_CONTACT_HINT,
        suggestMentorship: true,
      });
    }

    const listing = await this.prisma.housingListing.findFirst({
      where: { id: listingId, ...this.publiclyVisible() },
      select: { id: true, authorUserId: true },
    });
    if (listing === null) throw ApiError.notFound();
    if (listing.authorUserId === viewerId) throw ApiError.transverse('CONFLICT');

    // Un blocage, dans un sens ou l'autre, rend l'annonce inexistante (08 §4).
    await this.visibility.assertVisible(viewerId, listing.authorUserId);

    const conversationId = await this.prisma.$transaction(async (tx) => {
      const id = await this.ensureDirectConversation(tx, viewerId, listing.authorUserId);

      await tx.housingListing.update({
        where: { id: listingId },
        data: { contactCount: { increment: 1 } },
      });

      await this.outbox.emit(tx, {
        type: 'housing.contacted',
        aggregateId: listingId,
        payload: { fromUserId: viewerId, toUserId: listing.authorUserId, conversationId: id },
      });

      return id;
    });

    return { conversationId, safetyBanner: HOUSING_SAFETY_BANNER };
  }

  // ── Recherche (§2.4) ──────────────────────────────────────────────────────

  /**
   * GET /housing.
   *
   * Les conditions sont empilées dans un tableau passé à `AND`, et JAMAIS fusionnées
   * dans un même objet. C'est la défense contre un bogue qui a coûté cher à deux
   * modules : deux diffusions conditionnelles posant la même clé — ici `OR`, qu'emploient
   * à la fois le filtre de visibilité, celui de disponibilité et celui de budget — et
   * la seconde écrase la première en silence. Un `AND` de conditions ne peut pas
   * s'écraser.
   */
  async list(query: HousingQuery, viewerId: string | null): Promise<Page<HousingCard>> {
    const conditions: Prisma.HousingListingWhereInput[] = [];

    if (query.scope === 'mine') {
      if (viewerId === null) throw ApiError.transverse('UNAUTHENTICATED');
      conditions.push({ authorUserId: viewerId, deletedAt: null, status: { not: 'REMOVED' } });
    } else {
      conditions.push(this.publiclyVisible());
      const separated = await this.visibility.separatedFrom(viewerId);
      if (separated.length > 0) conditions.push({ authorUserId: { notIn: separated } });
    }


    /**
     * LES ÉLÉMENTS D'UN MEMBRE — l'onglet correspondant de son profil public.
     *
     * Le filtre s'AJOUTE aux clauses de visibilité qui précèdent : demander
     * l'auteur ne montre ni un retrait, ni un contenu d'un membre dont on est
     * séparé, ni ce qu'on ne verrait pas autrement.
     */
    if (query.authorHandle !== undefined) {
      conditions.push({ author: { handle: query.authorHandle } });
    }

    if (query.kind !== undefined) conditions.push({ kind: query.kind });

    const cityIds = await this.nearbyCityIds(query.cityId, query.radiusKm);
    if (cityIds !== null) conditions.push({ cityId: { in: cityIds } });

    // Un budget maximum garde les annonces SANS prix : une mise à disposition
    // temporaire gratuite (§2.1) tient dans tous les budgets, et l'exclure serait
    // exactement l'inverse de ce que le filtre veut dire.
    if (query.maxPriceCents !== undefined) {
      conditions.push({ OR: [{ priceCents: null }, { priceCents: { lte: query.maxPriceCents } }] });
    }
    if (query.isFurnished !== undefined) conditions.push({ isFurnished: query.isFurnished });

    // « Disponible à partir de » : je veux pouvoir entrer à cette date, donc une
    // annonce libre AVANT convient aussi. Sans date renseignée, l'annonce reste
    // candidate — l'écarter cacherait les annonces les plus souples.
    if (query.availableFrom !== undefined) {
      const from = new Date(`${query.availableFrom}T00:00:00.000Z`);
      conditions.push({ OR: [{ availableFrom: null }, { availableFrom: { lte: from } }] });
    }
    if (query.minDurationMonths !== undefined) {
      conditions.push({
        OR: [{ durationMonths: null }, { durationMonths: { gte: query.minDurationMonths } }],
      });
    }

    const scope = [
      'housing',
      query.scope,
      query.sort,
      query.kind ?? '',
      query.cityId ?? '',
      String(query.radiusKm),
      query.maxPriceCents ?? '',
      query.isFurnished === undefined ? '' : String(query.isFurnished),
      query.availableFrom ?? '',
      query.minDurationMonths ?? '',
      viewerId ?? 'anon',
    ].join(':');

    const cursor =
      query.cursor === undefined ? null : decodeCursor(query.cursor, this.cursorSecret, scope);

    const where: Prisma.HousingListingWhereInput = { AND: [...conditions, this.keysetFor(query.sort, cursor)] };

    const rows = await this.prisma.housingListing.findMany({
      where,
      orderBy:
        query.sort === 'price'
          ? [{ priceCents: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }]
          : [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      select: HOUSING_SELECT,
    });

    // Le total sert le sous-titre de l'écran (« 12 annonces à Lyon », §7). Compté sur
    // les mêmes conditions MOINS le keyset, sinon il décroîtrait de page en page.
    const total = await this.prisma.housingListing.count({ where: { AND: conditions } });

    const page = buildPage(
      rows.map((row) => this.toCard(row, viewerId)),
      query.limit,
      scope,
      this.cursorSecret,
      query.sort === 'price'
        ? (card) => (card.priceCents === null ? 'null' : card.priceCents)
        : (card) => card.createdAt.toISOString(),
    );

    return {
      ...page,
      meta: await this.listMeta(viewerId, total),
    };
  }

  /** GET /housing/:id — `404` si non publiée ou si l'auteur est séparé du lecteur (§6.1). */
  async detail(listingId: string, viewerId: string | null): Promise<HousingDetail> {
    const row = await this.prisma.housingListing.findUnique({
      where: { id: listingId },
      select: HOUSING_SELECT,
    });
    if (row === null) throw ApiError.notFound();

    const isMine = viewerId !== null && row.authorUserId === viewerId;
    if (!isMine) {
      if (!this.isPublished(row)) throw ApiError.notFound();
      await this.visibility.assertVisible(viewerId, row.authorUserId);
    }

    // Compteur INTERNE (§2.1 du schéma) : il sert la modération et le pilotage
    // admin, et n'apparaît dans aucune réponse — un test du socle échoue si une
    // route l'expose (règle dure 01 §1.2).
    await this.prisma.housingListing.update({
      where: { id: listingId },
      data: { viewCount: { increment: 1 } },
      select: { id: true },
    });

    return {
      ...this.toCard(row, viewerId),
      // RÈGLE DURE §2.2 : sur CHAQUE annonce, pas seulement sur les listes.
      safetyBanner: HOUSING_SAFETY_BANNER,
      mutualConnectionCount:
        isMine || viewerId === null ? 0 : await this.mutualConnectionCount(viewerId, row.authorUserId),
    };
  }

  // ── Alertes (§2.4 et §6.4) ────────────────────────────────────────────────

  /**
   * Les alertes vivent ici parce que §2.4 les définit avec la recherche de logement,
   * et la même table sert les deux kinds (`HOUSING`, `JOB`).
   *
   * PREMIUM : la lecture de `users.plan` est légitime — §2.4 en fait une fonction
   * payante, et la règle dure 14 §2 ne protège que l'entraide, les guides, le
   * parrainage, les réseaux et la participation aux événements.
   */
  async listAlerts(userId: string): Promise<{ items: unknown[]; nextCursor: null; meta: Record<string, unknown> }> {
    const items = await this.prisma.savedAlert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, kind: true, criteria: true, isActive: true, createdAt: true, lastNotifiedAt: true },
    });
    const plan = await this.planOf(userId);
    return {
      items,
      nextCursor: null,
      meta: { isPremium: plan !== 'FREE', dispatchIntervalMs: ALERT_DISPATCH_INTERVAL_MS },
    };
  }

  async createAlert(userId: string, input: CreateAlert) {
    await this.assertPremium(userId);
    const id = newId();
    return this.prisma.savedAlert.create({
      data: {
        id,
        userId,
        kind: input.kind,
        criteria: input.criteria,
        isActive: input.isActive,
      },
      select: { id: true, kind: true, criteria: true, isActive: true, createdAt: true },
    });
  }

  async updateAlert(alertId: string, userId: string, patch: UpdateAlert) {
    const existing = await this.prisma.savedAlert.findFirst({
      where: { id: alertId, userId },
      select: { id: true },
    });
    if (existing === null) throw ApiError.notFound();
    // Réactiver une alerte est une écriture payante comme la créer ; la désactiver
    // ou la supprimer ne l'est jamais — on ne retient personne dans un abonnement.
    if (patch.isActive === true) await this.assertPremium(userId);

    return this.prisma.savedAlert.update({
      where: { id: alertId },
      data: {
        ...(patch.criteria === undefined ? {} : { criteria: patch.criteria }),
        ...(patch.isActive === undefined ? {} : { isActive: patch.isActive }),
      },
      select: { id: true, kind: true, criteria: true, isActive: true, createdAt: true },
    });
  }

  async deleteAlert(alertId: string, userId: string): Promise<{ deleted: true }> {
    const { count } = await this.prisma.savedAlert.deleteMany({ where: { id: alertId, userId } });
    if (count === 0) throw ApiError.notFound();
    return { deleted: true };
  }

  // ── Tâches et événements (§9, §10) ────────────────────────────────────────

  /**
   * Tâche `listing.expire` (§9) — la partie logement : 60 jours.
   *
   * Idempotente par construction : elle ne touche que les annonces ACTIVE dont la
   * date est passée, donc un second passage ne trouve rien. Le câblage horaire
   * appartient au planificateur du worker, hors de ce module.
   */
  async expireDueListings(now = new Date()): Promise<number> {
    const due = await this.prisma.housingListing.findMany({
      where: { status: 'ACTIVE', deletedAt: null, expiresAt: { lte: now } },
      select: { id: true, authorUserId: true },
    });
    for (const listing of due) {
      await this.prisma.$transaction(async (tx) => {
        await tx.housingListing.update({ where: { id: listing.id }, data: { status: 'EXPIRED' } });
        await this.outbox.emit(tx, {
          type: 'housing.expired',
          aggregateId: listing.id,
          payload: { authorUserId: listing.authorUserId },
        });
      });
    }
    return due.length;
  }

  /**
   * §10 : « Annonces logement : supprimées. Alertes : supprimées. »
   *
   * Supprimées et non anonymisées, contrairement aux guides : une annonce sans
   * auteur joignable ne sert personne, et elle continuerait à faire espérer un
   * logement. `deleteMany` rend la reprise sans effet — la file livre « au moins
   * une fois », donc ce gestionnaire sera rejoué.
   */
  async handleUserDeleted(userId: string): Promise<void> {
    await this.prisma.housingListing.deleteMany({ where: { authorUserId: userId } });
    await this.prisma.savedAlert.deleteMany({ where: { userId } });
  }

  // ── Score de risque (§2.2) ────────────────────────────────────────────────

  /**
   * Les six signaux du §2.2, additionnés et bornés à 1.
   *
   * Les poids et les bornes de prix se lisent dans `system_settings` quand la clé
   * existe (§6 : « réglage des bornes de prix et des poids »), sinon dans la spec.
   * Ne pas retomber sur la spec signifierait « aucun score tant que l'admin n'a rien
   * réglé », c'est-à-dire aucune protection — or c'est LA protection du module.
   */
  /**
   * `housing.price_median_recompute` — quotidienne, « par ville et kind » (§9).
   *
   * Ce qu'elle nourrit : le drapeau `PRICE_FAR_BELOW_MEDIAN` du §2.2 (« prix
   * inférieur de 40 % à la médiane des annonces actives du même kind dans la
   * ville »), lu par `medianPrice` à chaque publication et chaque modification
   * d'annonce. C'est son UNIQUE lecteur, et il est réel : sans lui, cette tâche
   * écrirait dans une table que personne n'ouvre.
   *
   * ── CE QU'ELLE NE FAIT PAS, ET POURQUOI ─────────────────────────────────────
   *
   * Elle N'INSÈRE PAS une ligne par exécution. Une ligne par couple (ville, kind),
   * remplacée sur place : c'est le défaut que le test d'idempotence de
   * l'ordonnanceur traque nommément — « un balayage qui recalcule une valeur dérivée
   * du temps écoulé et l'AJOUTE au lieu de la remplacer ». Une médiane est un état,
   * pas un historique ; si l'équipe veut un jour la courbe, c'est
   * `metric_snapshots` (15 §6) qui est en ajout seul, pas cette table.
   *
   * Elle N'ÉCRIT PAS si la valeur n'a pas changé. Deux raisons : la ligne
   * `computed_at` bougerait chaque nuit sans qu'aucune médiane ait bougé, et
   * surtout un test ne pourrait plus distinguer « la tâche a tourné et rien n'a
   * changé » de « la tâche a réécrit ». Une nuit sans nouvelle annonce ne produit
   * donc AUCUNE écriture.
   *
   * Elle SUPPRIME la ligne d'un couple qui n'a plus d'annonce active. Une médiane
   * périmée est pire qu'une médiane absente : le repli de `medianPrice` recalcule
   * sur place, alors qu'une ligne vieille de six mois serait servie comme une
   * vérité.
   *
   * `now` sert à dater le calcul, et il vient du créneau. Une tâche qui écrirait
   * `new Date()` ici serait indistinguable, pour un test, d'une tâche qui réécrit
   * à chaque passage.
   */
  async recomputePriceMedians(
    now: Date = new Date(),
  ): Promise<{ couples: number; ecrits: number; supprimes: number }> {
    // Les couples (ville, kind) qui ONT des annonces actives à prix connu. Le
    // `groupBy` remplace un produit cartésien de 65 villes × 6 kinds, dont la quasi
    // totalité serait vide.
    const couples = await this.prisma.housingListing.groupBy({
      by: ['cityId', 'kind'],
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        moderationStatus: { not: 'PENDING' },
        priceCents: { not: null },
      },
      _count: { _all: true },
    });

    let ecrits = 0;
    const vivants = new Set<string>();

    for (const couple of couples) {
      vivants.add(`${couple.cityId}|${couple.kind}`);
      const median = await this.computeMedianPrice(couple.cityId, couple.kind, null);
      if (median === null) continue;

      // `Math.round` : la médiane d'un effectif PAIR est une moyenne de deux
      // centimes, donc parfois un demi-centime. `median_cents` est un entier, comme
      // `price_cents` — §4 : « jamais de flottant sur un montant ».
      const medianCents = Math.round(median);
      const sampleSize = couple._count._all;

      const existing = await this.prisma.housingPriceMedian.findUnique({
        where: { cityId_kind: { cityId: couple.cityId, kind: couple.kind } },
        select: { medianCents: true, sampleSize: true },
      });

      if (existing !== null && existing.medianCents === medianCents && existing.sampleSize === sampleSize) {
        continue;
      }

      await this.prisma.housingPriceMedian.upsert({
        where: { cityId_kind: { cityId: couple.cityId, kind: couple.kind } },
        create: { cityId: couple.cityId, kind: couple.kind, medianCents, sampleSize, computedAt: now },
        update: { medianCents, sampleSize, computedAt: now },
      });
      ecrits += 1;
    }

    // Les couples devenus vides. Lus puis filtrés en mémoire : un `NOT IN` sur un
    // couple de colonnes n'est pas exprimable en Prisma, et la table compte au plus
    // une ligne par (ville, kind).
    const stored = await this.prisma.housingPriceMedian.findMany({
      select: { cityId: true, kind: true },
    });
    const orphelins = stored.filter((row) => !vivants.has(`${row.cityId}|${row.kind}`));

    let supprimes = 0;
    for (const row of orphelins) {
      const { count } = await this.prisma.housingPriceMedian.deleteMany({
        where: { cityId: row.cityId, kind: row.kind },
      });
      supprimes += count;
    }

    return { couples: couples.length, ecrits, supprimes };
  }

  async assessRisk(input: {
    authorUserId: string;
    kind: HousingKind;
    cityId: string;
    description: string;
    priceCents: number | null;
    photoAssetIds: readonly string[];
    excludeListingId: string | null;
  }): Promise<RiskAssessment> {
    const flags = new Set<HousingRiskFlag>();
    const [weights, bounds] = await Promise.all([this.riskWeights(), this.priceBounds()]);

    // 1. Prix : 40 % sous la médiane du même kind dans la ville, ou hors bornes.
    if (input.priceCents !== null && isHousingOfferKind(input.kind)) {
      if (input.priceCents < bounds.minCents || input.priceCents > bounds.maxCents) {
        flags.add('PRICE_OUT_OF_BOUNDS');
      }
      const median = await this.medianPrice(input.cityId, input.kind, input.excludeListingId);
      if (median !== null && input.priceCents < median * HOUSING_MEDIAN_RATIO) {
        flags.add('PRICE_FAR_BELOW_MEDIAN');
      }
    }

    // 2. L2 depuis moins de 7 jours. `verification_level` n'est pas horodaté : la
    // date de VÉRIFICATION du numéro de destination est ce qui fait le L2 (01 §7.2),
    // et c'est donc elle qu'on lit. À défaut, la création du compte.
    const l2At = await this.l2SinceOf(input.authorUserId);
    if (l2At !== null && Date.now() - l2At.getTime() < HOUSING_NEW_MEMBER_DAYS * 86_400_000) {
      flags.add('NEW_L2_MEMBER');
    }

    // 3. Lien, email ou numéro dans la description.
    if (HOUSING_CONTACT_PATTERNS.some((pattern) => pattern.test(input.description))) {
      flags.add('CONTACT_IN_DESCRIPTION');
    }

    // 4. Termes d'arnaque nommés par §2.2.
    if (HOUSING_SCAM_TERM_PATTERN.test(input.description)) flags.add('SCAM_TERMS');

    // 5. Photos identiques. Faute de `photo_hashes`, on détecte le partage du MÊME
    // média : cela attrape la réutilisation d'une photo déjà publiée ici, pas une
    // capture d'écran d'une annonce d'ailleurs. Signalé, non contourné.
    if (input.photoAssetIds.length > 0) {
      const shared = await this.prisma.housingPhoto.findFirst({
        where: {
          mediaAssetId: { in: [...input.photoAssetIds] },
          ...(input.excludeListingId === null ? {} : { listingId: { not: input.excludeListingId } }),
        },
        select: { id: true },
      });
      if (shared !== null) flags.add('DUPLICATE_PHOTOS');
    }

    // 6. Première annonce du membre.
    const previous = await this.prisma.housingListing.count({
      where: {
        authorUserId: input.authorUserId,
        ...(input.excludeListingId === null ? {} : { id: { not: input.excludeListingId } }),
      },
    });
    if (previous === 0) flags.add('FIRST_LISTING');

    const ordered = HOUSING_RISK_FLAGS.filter((flag) => flags.has(flag));
    const raw = ordered.reduce((sum, flag) => sum + (weights[flag] ?? 0), 0);
    // Borné à 1 : `risk_score` est un Decimal(4,3), et §2.2 le décrit « 0–1 ».
    const score = Math.min(1, Math.round(raw * 1000) / 1000);

    return {
      score,
      flags: [...ordered],
      held: score >= HOUSING_RISK_BLOCK_THRESHOLD,
      review: score >= HOUSING_RISK_REVIEW_THRESHOLD && score < HOUSING_RISK_BLOCK_THRESHOLD,
    };
  }

  /**
   * Médiane des annonces actives du même kind dans la ville.
   *
   * DEUX CHEMINS, et l'ordre importe :
   *
   *   1. la ligne de `housing_price_medians`, écrite chaque nuit par
   *      `housing.price_median_recompute` (§9). C'est le chemin normal : une lecture
   *      de clé primaire, là où le calcul direct trie jusqu'à 500 annonces pour
   *      CHAQUE publication ou modification d'annonce ;
   *   2. à défaut — ville jamais calculée, tâche qui n'a pas encore tourné, ville
   *      créée dans la journée — le CALCUL DIRECT, inchangé.
   *
   * Le repli n'est pas une précaution de confort : cette médiane décide de mettre
   * une annonce en modération (§2.2, drapeau `PRICE_FAR_BELOW_MEDIAN`, poids 0,5).
   * Une absence de ligne qui rendrait `null` ferait passer une annonce
   * frauduleusement bon marché SANS drapeau, en silence — c'est-à-dire que la tâche
   * planifiée deviendrait une dépendance de sécurité. Elle ACCÉLÈRE, elle ne
   * conditionne pas.
   *
   * `excludeListingId` FORCE LE CALCUL DIRECT, et c'est le seul cas où la table est
   * ignorée : la médiane stockée inclut l'annonce en cours de modification, et se
   * comparer à une médiane dont on fait partie affaiblit le drapeau — d'autant plus
   * que le couple (ville, kind) compte parfois deux ou trois annonces.
   */
  private async medianPrice(
    cityId: string,
    kind: HousingKind,
    excludeListingId: string | null,
  ): Promise<number | null> {
    if (excludeListingId === null) {
      const cached = await this.prisma.housingPriceMedian.findUnique({
        where: { cityId_kind: { cityId, kind } },
        select: { medianCents: true },
      });
      if (cached !== null) return cached.medianCents;
    }
    return this.computeMedianPrice(cityId, kind, excludeListingId);
  }

  /**
   * Le calcul, en mémoire sur au plus 500 annonces.
   *
   * `percentile_cont` en SQL aurait demandé du SQL brut pour un gain nul à cette
   * échelle, et la tâche quotidienne appelle la MÊME fonction que le repli — une
   * médiane calculée de deux façons différentes finirait par ne plus être la même,
   * et le drapeau de risque dépendrait de qui l'a calculée.
   */
  private async computeMedianPrice(
    cityId: string,
    kind: HousingKind,
    excludeListingId: string | null,
  ): Promise<number | null> {
    const rows = await this.prisma.housingListing.findMany({
      where: {
        cityId,
        kind,
        status: 'ACTIVE',
        deletedAt: null,
        moderationStatus: { not: 'PENDING' },
        priceCents: { not: null },
        ...(excludeListingId === null ? {} : { id: { not: excludeListingId } }),
      },
      select: { priceCents: true },
      orderBy: { priceCents: 'asc' },
      take: 500,
    });
    const prices = rows.map((row) => row.priceCents).filter((p): p is number => p !== null);
    if (prices.length === 0) return null;
    const middle = Math.floor(prices.length / 2);
    return prices.length % 2 === 1
      ? (prices[middle] as number)
      : ((prices[middle - 1] as number) + (prices[middle] as number)) / 2;
  }

  /** La date à laquelle le membre est devenu L2, ou `null` s'il ne l'est pas. */
  private async l2SinceOf(userId: string): Promise<Date | null> {
    const phone = await this.prisma.phoneNumber.findFirst({
      where: { userId, isDestination: true },
      orderBy: { verifiedAt: 'asc' },
      select: { verifiedAt: true },
    });
    if (phone !== null) return phone.verifiedAt;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { verificationLevel: true, createdAt: true },
    });
    // Sans numéro de destination enregistré, on ne sait pas dater le L2 : la
    // création du compte est la borne la plus PRUDENTE (elle ne peut que rendre le
    // membre plus « récent », donc plus surveillé, jamais moins).
    return user?.verificationLevel === 'L2' ? user.createdAt : null;
  }

  private async riskWeights(): Promise<Record<string, number>> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'housing.risk_weights' },
      select: { value: true },
    });
    const overrides = asRecord(setting?.value);
    const weights: Record<string, number> = { ...HOUSING_RISK_WEIGHTS };
    if (overrides !== null) {
      for (const flag of HOUSING_RISK_FLAGS) {
        const raw = overrides[flag];
        if (typeof raw === 'number' && raw >= 0 && raw <= 1) weights[flag] = raw;
      }
    }
    return weights;
  }

  private async priceBounds(): Promise<{ minCents: number; maxCents: number }> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'housing.price_bounds' },
      select: { value: true },
    });
    const value = asRecord(setting?.value);
    const min = value?.['minCents'];
    const max = value?.['maxCents'];
    if (typeof min === 'number' && typeof max === 'number' && min >= 0 && max > min) {
      return { minCents: min, maxCents: max };
    }
    return { ...HOUSING_PRICE_BOUNDS_DEFAULT };
  }

  /** §2.2 : priorité 1 au-delà du seuil de blocage, priorité 2 dans la zone de revue. */
  private async openRiskCase(
    tx: Prisma.TransactionClient,
    listingId: string,
    authorUserId: string,
    risk: RiskAssessment,
  ): Promise<void> {
    // Idempotence : un dossier ouvert sur la même annonce est RÉUTILISÉ. Une
    // modification qui garde le score haut ne doit pas empiler les dossiers, sinon
    // la file de modération se remplit d'une même annonce éditée dix fois.
    const existing = await tx.moderationCase.findFirst({
      where: { subjectType: 'HOUSING', subjectId: listingId, status: { not: 'RESOLVED' } },
      select: { id: true },
    });
    const priority = risk.held ? 1 : 2;
    // 13 §… : `sla_due_at` = création + 24 h, priorité 1 : + 4 h.
    const slaDueAt = new Date(Date.now() + (priority === 1 ? 4 : 24) * 3_600_000);

    if (existing !== null) {
      await tx.moderationCase.update({
        where: { id: existing.id },
        data: { priority, aiScore: risk.score, aiLabels: risk.flags, slaDueAt },
      });
      return;
    }

    await tx.moderationCase.create({
      data: {
        id: newId(),
        subjectType: 'HOUSING',
        subjectId: listingId,
        subjectAuthorUserId: authorUserId,
        source: 'RISK_SCORE',
        priority,
        status: 'OPEN',
        aiVerdict: risk.held ? 'BLOCK' : 'QUEUE',
        aiLabels: risk.flags,
        aiScore: risk.score,
        slaDueAt,
      },
    });
  }

  // ── Plomberie ─────────────────────────────────────────────────────────────

  /** §2.1 : L2 « sans exception », recherches comprises. */
  private assertPublishLevel(level: VerificationLevel): void {
    if (level !== 'L2') {
      throw ApiError.transverse('LEVEL_REQUIRED', {
        ...levelRequiredDetails('housing.publish', level),
        explanation: HOUSING_L2_EXPLANATION,
      });
    }
  }

  private async planOf(userId: string): Promise<string> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { plan: true },
    });
    return user.plan;
  }

  private async assertPremium(userId: string): Promise<void> {
    if ((await this.planOf(userId)) === 'FREE') this.fail('PLAN_REQUIRED', { feature: 'alerts' });
  }

  /** Publiée : active, hors modération, non expirée, non supprimée. */
  private publiclyVisible(): Prisma.HousingListingWhereInput {
    return {
      deletedAt: null,
      status: 'ACTIVE',
      moderationStatus: { not: 'PENDING' },
      expiresAt: { gt: new Date() },
    };
  }

  private isPublished(row: HousingRow): boolean {
    return (
      row.deletedAt === null &&
      row.status === 'ACTIVE' &&
      row.moderationStatus !== 'PENDING' &&
      row.expiresAt.getTime() > Date.now()
    );
  }

  /** Les annonces qui occupent un des trois créneaux du §2.1. */
  private activeForAuthor(authorUserId: string): Prisma.HousingListingWhereInput {
    return {
      authorUserId,
      deletedAt: null,
      status: 'ACTIVE',
      expiresAt: { gt: new Date() },
    };
  }

  private keysetFor(
    sort: 'date' | 'price',
    cursor: { id: string; sort?: string | number } | null,
  ): Prisma.HousingListingWhereInput {
    if (cursor === null || cursor.sort === undefined) return {};

    if (sort === 'price') {
      // Les annonces sans prix viennent en DERNIER (`nulls: 'last'`). Le curseur
      // doit donc distinguer trois cas, sans quoi la dernière page boucle.
      if (cursor.sort === 'null') return { priceCents: null, id: { gt: cursor.id } };
      const price = Number(cursor.sort);
      return {
        OR: [
          { priceCents: { gt: price } },
          { priceCents: price, id: { gt: cursor.id } },
          { priceCents: null },
        ],
      };
    }

    const createdAt = new Date(String(cursor.sort));
    return {
      OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: cursor.id } }],
    };
  }

  /** RÈGLE DURE §2.2 : le bandeau, sur CHAQUE liste. */
  private async listMeta(viewerId: string | null, total: number): Promise<Record<string, unknown>> {
    const level =
      viewerId === null
        ? null
        : (
            await this.prisma.user.findUnique({
              where: { id: viewerId },
              select: { verificationLevel: true },
            })
          )?.verificationLevel ?? null;

    return {
      safetyBanner: HOUSING_SAFETY_BANNER,
      total,
      // §7 : le bouton Publier est grisé AVEC son explication en dessous de L2.
      canPublish: level === 'L2',
      publishRequirement: HOUSING_L2_EXPLANATION,
    };
  }

  private async resolveCityId(cityId: string): Promise<string> {
    const city = await this.prisma.city.findUnique({
      where: { id: cityId },
      select: { id: true, mergedIntoCityId: true },
    });
    if (city === null) throw ApiError.notFound();
    // Une ville fusionnée n'existe plus pour personne (02 §3) : l'annonce serait
    // invisible sur la fiche de la ville d'accueil.
    return city.mergedIntoCityId ?? city.id;
  }

  private async loadOwned(listingId: string, authorUserId: string): Promise<HousingRow> {
    const row = await this.prisma.housingListing.findUnique({
      where: { id: listingId },
      select: HOUSING_SELECT,
    });
    // 404 et non 403 (T4 §3) : dire « cette annonce n'est pas à vous » révèle
    // qu'elle existe.
    if (row === null || row.authorUserId !== authorUserId) throw ApiError.notFound();
    return row;
  }

  /**
   * Les photos doivent APPARTENIR à l'auteur et être des médias de logement.
   *
   * Sans ce contrôle, un membre peut attacher l'identifiant d'un média d'autrui —
   * le justificatif d'un pro, par exemple — et le publier au grand jour.
   */
  private async assertOwnedPhotos(userId: string, assetIds: readonly string[]): Promise<void> {
    if (assetIds.length === 0) return;
    const unique = new Set(assetIds);
    if (unique.size !== assetIds.length) {
      throw ApiError.validation([{ path: 'photoAssetIds', code: 'DUPLICATE' }]);
    }
    const count = await this.prisma.mediaAsset.count({
      where: {
        id: { in: [...unique] },
        ownerUserId: userId,
        kind: 'HOUSING',
        deletedAt: null,
        /**
         * `READY`, ET C'EST NOUVEAU.
         *
         * §8.3 met l'analyse antivirus « avant publication » et en fait l'objet de
         * `media_assets.status`. Ce contrôle ne regardait que le propriétaire et le
         * genre : tant qu'AUCUNE route d'envoi n'existait, aucun asset non `READY`
         * ne pouvait naître et l'omission ne coûtait rien. L'envoi existe
         * désormais, et un refus d'antivirus laisse une ligne `REJECTED` — avec une
         * clé réservée sur laquelle rien n'est déposé. L'accepter afficherait dans
         * une annonce une photo qui n'existe pas, ou une qui n'a pas été analysée.
         */
        status: 'READY',
      },
    });
    if (count !== unique.size) {
      throw ApiError.validation([{ path: 'photoAssetIds', code: 'NOT_FOUND' }]);
    }
  }

  private async writePhotos(
    tx: Prisma.TransactionClient,
    listingId: string,
    assetIds: readonly string[],
  ): Promise<void> {
    if (assetIds.length === 0) return;
    await tx.housingPhoto.createMany({
      data: assetIds.map((mediaAssetId, index) => ({
        id: newId(),
        listingId,
        mediaAssetId,
        position: index,
      })),
    });
  }

  private async currentPhotoAssetIds(listingId: string): Promise<string[]> {
    const rows = await this.prisma.housingPhoto.findMany({
      where: { listingId },
      select: { mediaAssetId: true },
      orderBy: { position: 'asc' },
    });
    return rows.map((row) => row.mediaAssetId);
  }

  /**
   * La conversation directe entre deux membres, créée si elle n'existe pas.
   *
   * Le module 08 (messagerie) n'est pas livré : il n'y a donc aucun service à
   * appeler, et §2.3 exige quand même que « Contacter » ouvre une conversation. On
   * écrit les deux tables minimales — `conversations` et `conversation_members` — et
   * AUCUN message : le premier message reste le geste du membre.
   */
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
      // Idempotent : une conversation quittée puis recontactée se rouvre pour les
      // deux, plutôt que d'en créer une seconde qui couperait l'historique.
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

  /** §7 : « Connecté·e à N de vos contacts ». */
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

  /**
   * Les villes dans le rayon (§2.4 : « ville + 30 km »).
   *
   * `null` signifie « aucun filtre de ville » — et non « aucune ville » : sans ville
   * demandée, la liste doit rester complète.
   */
  private async nearbyCityIds(cityId: string | undefined, radiusKm: number): Promise<string[] | null> {
    if (cityId === undefined) return null;

    const center = await this.prisma.city.findUnique({
      where: { id: cityId },
      select: { id: true, mergedIntoCityId: true, latitude: true, longitude: true },
    });
    if (center === null) return null;
    const centerId = center.mergedIntoCityId ?? center.id;
    if (radiusKm === 0) return [centerId];

    const cities = await this.prisma.city.findMany({
      where: { mergedIntoCityId: null },
      select: { id: true, latitude: true, longitude: true },
    });

    return cities
      .filter(
        (city) =>
          city.id === centerId ||
          haversineKm(
            Number(center.latitude),
            Number(center.longitude),
            Number(city.latitude),
            Number(city.longitude),
          ) <= radiusKm,
      )
      .map((city) => city.id);
  }

  private toCard(row: HousingRow, viewerId: string | null): HousingCard {
    const isMine = viewerId !== null && row.authorUserId === viewerId;
    const score = Number(row.riskScore);

    return {
      id: row.id,
      kind: row.kind,
      title: row.title,
      description: row.description,
      city: row.city,
      district: row.district,
      priceCents: row.priceCents,
      currency: row.currency,
      isFurnished: row.isFurnished,
      availableFrom: row.availableFrom,
      durationMonths: row.durationMonths,
      status: row.status,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      photos: row.photos.map((photo) => ({
        url: `/media/${photo.mediaAsset.storageKey}`,
        position: photo.position,
      })),
      author: {
        handle: row.author.handle,
        displayName: row.author.displayName,
        avatarUrl:
          row.author.avatarAsset === null ? null : `/media/${row.author.avatarAsset.storageKey}`,
        verificationLevel: row.author.verificationLevel,
      },
      // Le seuil, jamais le score : §7 veut « un rappel de prudence renforcé si
      // score moyen », et rien de plus. Une valeur numérique serait du pilotage
      // offert à l'auteur.
      cautionLevel:
        score >= HOUSING_RISK_REVIEW_THRESHOLD
          ? HOUSING_CAUTION_LEVELS[1]
          : HOUSING_CAUTION_LEVELS[0],
      isMine,
      reviewState: isMine ? (row.moderationStatus === 'PENDING' ? 'UNDER_REVIEW' : 'PUBLISHED') : null,
      canRenew: isMine ? this.renewableNow(row.expiresAt) : null,
    };
  }

  private renewableNow(expiresAt: Date): boolean {
    const renewableFrom =
      expiresAt.getTime() - (HOUSING_LIFETIME_DAYS - HOUSING_RENEW_INTERVAL_DAYS) * 86_400_000;
    return Date.now() >= renewableFrom;
  }
}

/** Un objet JSON, ou `null` si la valeur n'en est pas un (un tableau n'en est pas un). */
function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
