import { Injectable, Logger } from '@nestjs/common';
import { newId, type Prisma } from '@app/db';
import {
  HOUSING_SECTION_STEP_CODE,
  PARTNER_BADGE_LABEL,
  PARTNER_ERROR_CODES,
  PARTNER_ERROR_MESSAGES,
  PARTNER_TRANSPARENCY_LINK_LABEL,
  PARTNER_TRANSPARENCY_PAGE_SLUG,
  type AffiliateImport,
  type PartnerCreate,
  type PartnerErrorCode,
  type PartnerUpdate,
  type PartnersQuery,
  type PlacementCreate,
  type PlacementQuery,
  type PlacementUpdate,
  type PlacementsQuery,
  buildAffiliateUrl,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { AuditService } from '../../common/audit.service';
import { PrismaService } from '../../common/prisma.service';
import { PlanService } from '../billing/plan.service';

/**
 * Encarts partenaires et affiliation — 14-monetisation.md §5.
 *
 * ═══ LES DEUX RÈGLES DURES, ET COMMENT ELLES SONT TENUES ═══════════════════
 *
 * **« Aucun encart partenaire dans le fil, l'entraide, les guides, les réseaux, la
 * messagerie. Ils vivent uniquement sur une étape de parcours et en pied de la
 * section Logement. »** (§2 et §5.1)
 *
 * Cette règle est tenue par l'ABSENCE de code — et une absence ne lève jamais
 * toute seule. Trois choses la rendent malgré tout vérifiable :
 *
 *   1. la résolution n'accepte QUE deux formes d'entrée, une définition d'étape ou
 *      la section `HOUSING` (`PLACEMENT_SECTIONS`, une seule entrée) ;
 *   2. `resolve()` est la SEULE méthode publique qui rende un encart, et rien
 *      d'autre dans le dépôt ne l'appelle — un test statique vérifie qu'aucun
 *      service de contenu n'importe ce fichier ;
 *   3. l'écriture emploie la même liste fermée que la lecture : on ne peut pas
 *      créer un placement sur une cible qu'on ne pourrait pas lire.
 *
 * **« Aucune donnée personnelle n'est transmise au partenaire dans le lien :
 * seulement `click_id`. »** (§5.3)
 *
 * Tenue à DEUX endroits, volontairement : le gabarit est validé à la saisie
 * (`affiliateUrlTemplateSchema` refuse tout jeton autre que `{click_id}`), et
 * l'URL est vérifiée au moment de PARTIR (`buildAffiliateUrl` lève si
 * l'identifiant du membre ou son handle s'y trouvent). La seconde vérification
 * n'est pas redondante : c'est celle qui survivra à la prochaine modification.
 *
 * ═══ CE QUE LE SCHÉMA FIGÉ NE PERMET PAS ═══════════════════════════════════
 *
 *   · `partners.transparency_text` (§6) N'EXISTE PAS. L'encart renvoie donc le
 *     LIEN vers la page de transparence (`static_pages`), qui existe, plutôt qu'un
 *     texte par partenaire. §5.2 exige le lien ; le texte par partenaire attend
 *     la colonne.
 *   · `users.hide_partners_override` (§6) N'EXISTE PAS. §5.2 permet à un membre
 *     Premium de RÉACTIVER les encarts ; sans colonne, le masquage est
 *     inconditionnel pour Premium. Signalé, non contourné.
 *   · l'index unique `(step_definition_id, origin_country_id,
 *     destination_country_id)` ne protège RIEN quand un pays est `NULL` :
 *     PostgreSQL traite `NULL` comme distinct de lui-même (`NULLS DISTINCT` par
 *     défaut). Deux placements génériques sur la même étape passeraient donc en
 *     base. `PLACEMENT_EXISTS` est appliqué ici, sous verrou consultatif.
 */
@Injectable()
export class PartnersService {
  private readonly logger = new Logger(PartnersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlanService,
    private readonly audit: AuditService,
  ) {}

  private fail(code: PartnerErrorCode, details?: Record<string, unknown>): never {
    throw new ApiError(code, PARTNER_ERROR_MESSAGES[code], PARTNER_ERROR_CODES[code], details);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Résolution à l'affichage (§5.1, §5.2)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * `GET /placements?stepDefinitionId` ou `?section=HOUSING`.
   *
   * L'ORDRE DE SPÉCIFICITÉ est celui du §5.1 : « placement le plus spécifique
   * (pays d'origine + destination > destination seule > générique), actif, dans sa
   * période. Sinon aucun encart. »
   *
   * Le tri se fait EN MÉMOIRE sur trois candidats au plus, et non par un
   * `orderBy` : la spécificité n'est pas un ordre SQL mais une règle à trois
   * termes, et un `ORDER BY origin_country_id NULLS LAST` aurait exprimé « origine
   * d'abord » au lieu de « les deux d'abord ».
   */
  async resolve(query: PlacementQuery, viewerUserId: string | null) {
    const stepDefinitionId =
      query.section === 'HOUSING' ? await this.housingAnchorId() : query.stepDefinitionId;
    // `placementQuerySchema` garantit l'un des deux ; la garde protège contre un
    // appel interne mal formé, pas contre le client.
    if (stepDefinitionId === undefined) return { placement: null };

    // §5.2 : « Masqué pour les membres PREMIUM (limits.hide_partners = true) ».
    // Le masquage vient des LIMITES DU PLAN, jamais d'un test `plan === 'PREMIUM'`
    // écrit à la main : c'est `plans.limits` qui décide, et un SUPER_ADMIN peut
    // donc en changer sans déploiement.
    if (viewerUserId !== null) {
      const limits = await this.plans.limitsFor(viewerUserId);
      if (limits.hidePartners) return { placement: null, hiddenByPlan: true };
    }

    const now = new Date();
    const viewer =
      viewerUserId === null
        ? null
        : await this.prisma.user.findUnique({
            where: { id: viewerUserId },
            select: { originCountryId: true, city: { select: { countryId: true } } },
          });

    const originCountryId = viewer?.originCountryId ?? null;
    const destinationCountryId = viewer?.city?.countryId ?? null;

    const candidates = await this.prisma.partnerPlacement.findMany({
      where: {
        stepDefinitionId,
        isActive: true,
        // Dans sa période : les deux bornes sont facultatives, et une borne
        // absente veut dire « sans limite de ce côté ».
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        ],
        partner: {
          isActive: true,
          AND: [
            { OR: [{ contractStart: null }, { contractStart: { lte: now } }] },
            { OR: [{ contractEnd: null }, { contractEnd: { gte: now } }] },
          ],
        },
      },
      select: {
        id: true,
        headline: true,
        description: true,
        ctaLabel: true,
        originCountryId: true,
        destinationCountryId: true,
        partner: { select: { id: true, name: true, category: true, logoAssetId: true } },
      },
      take: 20,
    });

    /**
     * Le filtrage par PAYS se fait ici, en mémoire, et non dans la requête.
     *
     * Un placement ciblé ne s'affiche qu'aux membres concernés ; un placement
     * générique (pays à `NULL`) s'affiche à tous. Exprimer cela en SQL demanderait
     * `(origin_country_id IS NULL OR origin_country_id = $1)` sur deux colonnes, et
     * un `$1` à `NULL` — un membre sans pays d'origine — rendrait la comparaison
     * `NULL`, donc fausse, donc écarterait aussi les placements génériques. C'est
     * exactement le piège du `NOT IN` sur une colonne nullable, dans l'autre sens.
     */
    const eligible = candidates.filter(
      (c) =>
        (c.originCountryId === null || c.originCountryId === originCountryId) &&
        (c.destinationCountryId === null || c.destinationCountryId === destinationCountryId),
    );

    const best =
      eligible.find((c) => c.originCountryId !== null && c.destinationCountryId !== null) ??
      eligible.find((c) => c.originCountryId === null && c.destinationCountryId !== null) ??
      eligible.find((c) => c.originCountryId === null && c.destinationCountryId === null) ??
      null;

    if (best === null) return { placement: null };

    return {
      placement: {
        id: best.id,
        headline: best.headline,
        description: best.description,
        ctaLabel: best.ctaLabel,
        partner: {
          id: best.partner.id,
          name: best.partner.name,
          category: best.partner.category,
          logoAssetId: best.partner.logoAssetId,
        },
        /**
         * §5.2 : la mention « Partenaire » est TOUJOURS visible, et le lien de
         * transparence toujours présent. Les deux viennent du SERVEUR, pas du
         * front : une mention qu'un front peut oublier d'afficher est une mention
         * qui finira par manquer.
         */
        badge: PARTNER_BADGE_LABEL,
        transparency: {
          label: PARTNER_TRANSPARENCY_LINK_LABEL,
          url: `/pages/${PARTNER_TRANSPARENCY_PAGE_SLUG}`,
          /** `partners.transparency_text` n'existe pas dans le schéma figé (§6). */
          text: null,
        },
      },
    };
  }

  /**
   * `POST /placements/:id/click` → l'URL d'affiliation (§5.3).
   *
   * Rend l'URL dans le CORPS plutôt qu'une redirection 303. §5.3 dit
   * « redirection », et c'est bien ce qui se passe — mais côté client, après une
   * écriture. Deux raisons : une redirection du serveur enverrait l'en-tête
   * `Referer` de notre domaine au partenaire, et l'écriture du clic doit être
   * confirmée au client (il rejouera si elle échoue) plutôt que fondue dans un 303.
   *
   * `journeyStepId` est enregistré s'il est fourni ET s'il appartient au membre :
   * §5.3 le veut dans la ligne (« placement, membre, étape, horodatage »), et
   * l'accepter sans vérifier laisserait un client attribuer son clic à l'étape de
   * quelqu'un d'autre.
   */
  async click(placementId: string, userId: string, journeyStepId: string | undefined) {
    const placement = await this.prisma.partnerPlacement.findFirst({
      where: { id: placementId, isActive: true },
      select: {
        id: true,
        partner: { select: { isActive: true, affiliateUrlTemplate: true } },
      },
    });
    // 404 plutôt que 403 sur un encart retiré (T4 §3).
    if (placement === null || !placement.partner.isActive) throw ApiError.notFound();

    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { handle: true },
    });

    const ownedStepId =
      journeyStepId === undefined
        ? null
        : ((
            await this.prisma.journeyStep.findFirst({
              where: { id: journeyStepId, journey: { ownerUserId: userId, deletedAt: null } },
              select: { id: true },
            })
          )?.id ?? null);

    const clickId = newId();

    /**
     * L'URL est construite AVANT l'écriture, et l'écriture n'a lieu que si la
     * construction passe. `buildAffiliateUrl` LÈVE si une donnée personnelle
     * apparaît dans l'URL — identifiant, handle, identifiant d'étape. Construire
     * après aurait laissé une ligne de clic pour une URL qu'on refuse d'ouvrir.
     */
    const url = buildAffiliateUrl(placement.partner.affiliateUrlTemplate, clickId, [
      userId,
      me.handle,
      ...(ownedStepId === null ? [] : [ownedStepId]),
    ]);

    await this.prisma.affiliateClick.create({
      data: {
        id: clickId,
        placementId: placement.id,
        userId,
        journeyStepId: ownedStepId,
        clickedAt: new Date(),
      },
    });

    return { clickId, url };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Équipe — partenaires (§7.2, CONTENT_ADMIN)
  // ══════════════════════════════════════════════════════════════════════════

  async listPartners(query: PartnersQuery) {
    /**
     * LE PIÈGE DES DEUX DIFFUSIONS CONDITIONNELLES, évité par un `AND` explicite :
     * `{ ...(a ? { k } : {}), ...(b ? { k } : {}) }` fait écraser la première clé
     * par la seconde, sans erreur ni avertissement. Ici `category` et `isActive`
     * sont des clés différentes, donc le défaut ne se produirait pas — mais la
     * forme en liste est celle qui reste juste le jour où un troisième filtre
     * touchera la même clé.
     */
    const conditions: Prisma.PartnerWhereInput[] = [];
    if (query.category !== undefined) conditions.push({ category: query.category });
    if (query.isActive !== undefined) conditions.push({ isActive: query.isActive });

    const rows = await this.prisma.partner.findMany({
      where: conditions.length === 0 ? {} : { AND: conditions },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      select: {
        id: true,
        name: true,
        category: true,
        payoutModel: true,
        affiliateUrlTemplate: true,
        contractStart: true,
        contractEnd: true,
        isActive: true,
        _count: { select: { placements: true } },
      },
    });

    return {
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        payoutModel: r.payoutModel,
        affiliateUrlTemplate: r.affiliateUrlTemplate,
        contractStart: r.contractStart?.toISOString() ?? null,
        contractEnd: r.contractEnd?.toISOString() ?? null,
        isActive: r.isActive,
        placements: r._count.placements,
      })),
      nextCursor: null,
    };
  }

  async createPartner(staffId: string, input: PartnerCreate) {
    const id = newId();
    await this.prisma.$transaction(async (tx) => {
      await tx.partner.create({
        data: {
          id,
          name: input.name,
          category: input.category,
          affiliateUrlTemplate: input.affiliateUrlTemplate,
          payoutModel: input.payoutModel,
          logoAssetId: input.logoAssetId ?? null,
          contractStart: input.contractStart === undefined ? null : new Date(input.contractStart),
          contractEnd: input.contractEnd === undefined ? null : new Date(input.contractEnd),
          isActive: input.isActive,
        },
      });
      await this.audit.record(tx, {
        actor: { type: 'STAFF', id: staffId },
        action: 'partner.created',
        targetType: 'partner',
        targetId: id,
        metadata: { name: input.name, category: input.category },
      });
    });
    return { id };
  }

  async updatePartner(staffId: string, partnerId: string, patch: PartnerUpdate) {
    const before = await this.prisma.partner.findUnique({
      where: { id: partnerId },
      select: { id: true, isActive: true, name: true },
    });
    if (before === null) throw ApiError.notFound();

    await this.prisma.$transaction(async (tx) => {
      await tx.partner.update({
        where: { id: partnerId },
        data: {
          ...(patch.name === undefined ? {} : { name: patch.name }),
          ...(patch.category === undefined ? {} : { category: patch.category }),
          ...(patch.affiliateUrlTemplate === undefined
            ? {}
            : { affiliateUrlTemplate: patch.affiliateUrlTemplate }),
          ...(patch.payoutModel === undefined ? {} : { payoutModel: patch.payoutModel }),
          ...(patch.logoAssetId === undefined ? {} : { logoAssetId: patch.logoAssetId }),
          ...(patch.contractStart === undefined
            ? {}
            : { contractStart: patch.contractStart === null ? null : new Date(patch.contractStart) }),
          ...(patch.contractEnd === undefined
            ? {}
            : { contractEnd: patch.contractEnd === null ? null : new Date(patch.contractEnd) }),
          ...(patch.isActive === undefined ? {} : { isActive: patch.isActive }),
        },
      });
      await this.audit.record(tx, {
        actor: { type: 'STAFF', id: staffId },
        action: 'partner.updated',
        targetType: 'partner',
        targetId: partnerId,
        metadata: { before: { name: before.name, isActive: before.isActive }, after: patch },
      });
    });
    return { updated: true };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Équipe — placements (§5.1, §7.2)
  // ══════════════════════════════════════════════════════════════════════════

  async listPlacements(query: PlacementsQuery) {
    const conditions: Prisma.PartnerPlacementWhereInput[] = [];
    if (query.partnerId !== undefined) conditions.push({ partnerId: query.partnerId });
    if (query.stepDefinitionId !== undefined) {
      conditions.push({ stepDefinitionId: query.stepDefinitionId });
    }

    const rows = await this.prisma.partnerPlacement.findMany({
      where: conditions.length === 0 ? {} : { AND: conditions },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      select: {
        id: true,
        headline: true,
        ctaLabel: true,
        isActive: true,
        startsAt: true,
        endsAt: true,
        originCountryId: true,
        destinationCountryId: true,
        partner: { select: { id: true, name: true, isActive: true } },
        stepDefinition: { select: { id: true, code: true, nameFr: true } },
        _count: { select: { clicks: true } },
      },
    });

    return {
      items: rows.map((r) => ({
        id: r.id,
        headline: r.headline,
        ctaLabel: r.ctaLabel,
        isActive: r.isActive,
        startsAt: r.startsAt?.toISOString() ?? null,
        endsAt: r.endsAt?.toISOString() ?? null,
        originCountryId: r.originCountryId,
        destinationCountryId: r.destinationCountryId,
        partner: r.partner,
        step: r.stepDefinition,
        clicks: r._count.clicks,
      })),
      nextCursor: null,
    };
  }

  /**
   * `POST /admin/billing/placements` (§5.1).
   *
   * RÈGLE DURE : « un seul placement ACTIF par étape et par combinaison de pays →
   * un seul encart par étape. Un second placement pour la même étape est refusé
   * (`PLACEMENT_EXISTS`). »
   *
   * L'index unique du schéma NE SUFFIT PAS, et c'est le genre de défaut qu'on ne
   * voit qu'en le cherchant : `CREATE UNIQUE INDEX … (step_definition_id,
   * origin_country_id, destination_country_id)` est en `NULLS DISTINCT` par défaut
   * dans PostgreSQL, donc DEUX placements génériques sur la même étape — les deux
   * pays à `NULL` — passent tous les deux. Or le générique est précisément le cas
   * le plus courant.
   *
   * D'où le contrôle ici, sous VERROU CONSULTATIF sur l'étape : deux créations
   * simultanées se sérialisent, et la seconde voit la première. Un simple `count`
   * avant l'insertion perdrait la course, exactement comme pour le quota de
   * parcours.
   */
  async createPlacement(staffId: string, input: PlacementCreate) {
    const stepDefinitionId =
      input.section === 'HOUSING' ? await this.housingAnchorId() : input.stepDefinitionId;
    if (stepDefinitionId === undefined) this.fail('SECTION_NOT_SEEDED');

    const step = await this.prisma.stepDefinition.findUnique({
      where: { id: stepDefinitionId },
      select: { id: true },
    });
    if (step === null) throw ApiError.notFound();

    const partner = await this.prisma.partner.findUnique({
      where: { id: input.partnerId },
      select: { id: true, isActive: true },
    });
    if (partner === null) throw ApiError.notFound();
    if (!partner.isActive) this.fail('PARTNER_INACTIVE');

    const id = newId();
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`placement:${stepDefinitionId}`}, 0))`;

      if (input.isActive) {
        const clash = await tx.partnerPlacement.findFirst({
          where: {
            stepDefinitionId,
            isActive: true,
            // `null` est écrit EXPLICITEMENT plutôt que omis : omettre la clé
            // demanderait « n'importe quelle valeur », et un placement générique
            // entrerait en conflit avec tous les placements ciblés de l'étape.
            originCountryId: input.originCountryId ?? null,
            destinationCountryId: input.destinationCountryId ?? null,
          },
          select: { id: true },
        });
        if (clash !== null) this.fail('PLACEMENT_EXISTS', { placementId: clash.id });
      }

      await tx.partnerPlacement.create({
        data: {
          id,
          partnerId: input.partnerId,
          stepDefinitionId,
          originCountryId: input.originCountryId ?? null,
          destinationCountryId: input.destinationCountryId ?? null,
          headline: input.headline,
          description: input.description ?? null,
          ctaLabel: input.ctaLabel,
          startsAt: input.startsAt === undefined ? null : new Date(input.startsAt),
          endsAt: input.endsAt === undefined ? null : new Date(input.endsAt),
          isActive: input.isActive,
        },
      });

      await this.audit.record(tx, {
        actor: { type: 'STAFF', id: staffId },
        action: 'placement.created',
        targetType: 'partner_placement',
        targetId: id,
        metadata: { partnerId: input.partnerId, stepDefinitionId, headline: input.headline },
      });
    });

    return { id };
  }

  /** `PATCH /admin/billing/placements/:id`. Réactiver repasse par la même unicité. */
  async updatePlacement(staffId: string, placementId: string, patch: PlacementUpdate) {
    const before = await this.prisma.partnerPlacement.findUnique({
      where: { id: placementId },
      select: {
        id: true,
        stepDefinitionId: true,
        originCountryId: true,
        destinationCountryId: true,
        isActive: true,
      },
    });
    if (before === null) throw ApiError.notFound();

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`placement:${before.stepDefinitionId}`}, 0))`;

      // Réactiver, c'est créer un encart : la même unicité s'applique, sinon on
      // contournerait `PLACEMENT_EXISTS` en créant inactif puis en activant.
      if (patch.isActive === true && !before.isActive) {
        const clash = await tx.partnerPlacement.findFirst({
          where: {
            id: { not: placementId },
            stepDefinitionId: before.stepDefinitionId,
            isActive: true,
            originCountryId: before.originCountryId,
            destinationCountryId: before.destinationCountryId,
          },
          select: { id: true },
        });
        if (clash !== null) this.fail('PLACEMENT_EXISTS', { placementId: clash.id });
      }

      await tx.partnerPlacement.update({
        where: { id: placementId },
        data: {
          ...(patch.headline === undefined ? {} : { headline: patch.headline }),
          ...(patch.description === undefined ? {} : { description: patch.description }),
          ...(patch.ctaLabel === undefined ? {} : { ctaLabel: patch.ctaLabel }),
          ...(patch.startsAt === undefined
            ? {}
            : { startsAt: patch.startsAt === null ? null : new Date(patch.startsAt) }),
          ...(patch.endsAt === undefined
            ? {}
            : { endsAt: patch.endsAt === null ? null : new Date(patch.endsAt) }),
          ...(patch.isActive === undefined ? {} : { isActive: patch.isActive }),
        },
      });

      await this.audit.record(tx, {
        actor: { type: 'STAFF', id: staffId },
        action: 'placement.updated',
        targetType: 'partner_placement',
        targetId: placementId,
        metadata: { before: { isActive: before.isActive }, after: patch },
      });
    });

    return { updated: true };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Conversions (§5.3, §7.2)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * `POST /admin/billing/affiliate/import` — le CSV de conversions du partenaire.
   *
   * IDEMPOTENT par construction : une ligne déjà convertie n'est pas réécrite.
   * Un partenaire renvoie son fichier complet chaque mois, et additionner les
   * rémunérations à chaque import gonflerait le chiffre d'affaires sans qu'aucune
   * erreur n'apparaisse.
   *
   * Le fichier ne porte que des `click_id` : c'est la conséquence directe de la
   * règle dure §5.3 — le partenaire n'a jamais rien su du membre.
   */
  async importConversions(staffId: string, input: AffiliateImport) {
    let converted = 0;
    let alreadyKnown = 0;
    let unknown = 0;

    for (const row of input.rows) {
      const click = await this.prisma.affiliateClick.findUnique({
        where: { id: row.clickId },
        select: { id: true, convertedAt: true },
      });
      if (click === null) {
        unknown += 1;
        continue;
      }
      if (click.convertedAt !== null) {
        alreadyKnown += 1;
        continue;
      }
      await this.prisma.affiliateClick.update({
        where: { id: click.id },
        data: {
          convertedAt: row.convertedAt === undefined ? new Date() : new Date(row.convertedAt),
          conversionRef: row.conversionRef,
          payoutCents: row.payoutCents,
        },
      });
      converted += 1;
    }

    await this.audit.record(this.prisma, {
      actor: { type: 'STAFF', id: staffId },
      action: 'affiliate.import',
      targetType: 'affiliate_click',
      metadata: { rows: input.rows.length, converted, alreadyKnown, unknown },
    });

    return { converted, alreadyKnown, unknown };
  }

  /** Le tableau de bord du §5.3 : clics, conversions, taux, revenus par partenaire et par étape. */
  async affiliateDashboard() {
    const rows = await this.prisma.affiliateClick.findMany({
      select: {
        convertedAt: true,
        payoutCents: true,
        placement: {
          select: {
            id: true,
            headline: true,
            partner: { select: { id: true, name: true } },
            stepDefinition: { select: { id: true, code: true, nameFr: true } },
          },
        },
      },
      take: 20_000,
    });

    const byPlacement = new Map<string, AffiliateRow>();
    for (const click of rows) {
      const key = click.placement.id;
      const row =
        byPlacement.get(key) ??
        ({
          placementId: key,
          headline: click.placement.headline,
          partnerId: click.placement.partner.id,
          partnerName: click.placement.partner.name,
          stepCode: click.placement.stepDefinition.code,
          stepNameFr: click.placement.stepDefinition.nameFr,
          clicks: 0,
          conversions: 0,
          payoutCents: 0,
        } satisfies AffiliateRow);
      row.clicks += 1;
      if (click.convertedAt !== null) {
        row.conversions += 1;
        row.payoutCents += click.payoutCents ?? 0;
      }
      byPlacement.set(key, row);
    }

    return {
      items: [...byPlacement.values()]
        .map((r) => ({
          ...r,
          // Le taux est calculé À LA LECTURE et jamais stocké : un taux dénormalisé
          // dérive dès la première conversion importée.
          conversionRate: r.clicks === 0 ? 0 : Math.round((r.conversions / r.clicks) * 1000) / 1000,
        }))
        .sort((a, b) => b.clicks - a.clicks),
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Interne
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * L'identifiant de l'ancre `HOUSING_SECTION` (§5.1).
   *
   * `undefined` si elle n'est pas amorcée, et l'appelant le dit franchement plutôt
   * que de rendre « aucun encart » : un défaut d'amorçage et une absence de
   * partenaire ne se corrigent pas du même côté.
   */
  private async housingAnchorId(): Promise<string | undefined> {
    const anchor = await this.prisma.stepDefinition.findUnique({
      where: { code: HOUSING_SECTION_STEP_CODE },
      select: { id: true },
    });
    if (anchor === null) {
      this.logger.warn(
        `Ancre ${HOUSING_SECTION_STEP_CODE} absente : le pied de Logement n'affichera aucun encart (pnpm db:seed).`,
      );
      return undefined;
    }
    return anchor.id;
  }
}

interface AffiliateRow {
  placementId: string;
  headline: string;
  partnerId: string;
  partnerName: string;
  stepCode: string;
  stepNameFr: string;
  clicks: number;
  conversions: number;
  payoutCents: number;
}
