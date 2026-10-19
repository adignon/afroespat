import { Injectable, Logger } from '@nestjs/common';
import { newId, type Prisma } from '@app/db';
import {
  CITY_ACTIVATION_SUGGEST_MEMBERS,
  CITY_COUNT_PRIVACY_THRESHOLD,
  CITY_DESKS_CACHE_MS,
  CITY_ERROR_CODES,
  CITY_ERROR_MESSAGES,
  type CityCount,
  type CityErrorCode,
  type CityTipsQuery,
  type CreateCityTip,
  type MembersQuery,
  NEWCOMER_WINDOW_DAYS,
  type UpdateCityTip,
  cityCount,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { AuditService } from '../../common/audit.service';
import { buildPage, decodeCursor, encodeCursor } from '../../common/cursor';
import { OutboxService } from '../../common/outbox.service';
import { PrismaService } from '../../common/prisma.service';
import { VisibilityService } from '../../common/visibility.service';
import { loadEnv } from '../../config/env';
import { haversineKm, localDate, zoneOf } from '../events/events.service';

/**
 * Villes et membres — 09-villes-agenda.md §2.
 *
 * La RÈGLE DURE du §2.1 gouverne ce fichier : « Aucune position individuelle ; la
 * carte ne montre que des agrégats par ville, et jamais en dessous de 3 membres
 * pour un filtre pays (sinon "moins de 3"), pour ne pas identifier une personne. »
 *
 * Pourquoi ce seuil est une règle et non une préférence d'affichage : « Lyon · 1
 * Bénin » désigne UNE personne. Croisé avec l'annuaire, il la nomme. Le seuil
 * s'applique donc à tout compteur filtré par pays — la carte ET la répartition en
 * tête de fiche ville — et il est appliqué ICI, jamais laissé au front.
 *
 * Les compteurs non filtrés, eux, sortent tels quels : ce sont ceux de
 * `cities.member_count`, et une ville n'est activée qu'autour de 20 membres
 * (02 §2.2) — un agrégat qui ne désigne personne.
 */
/**
 * Écarte les auteurs séparés du lecteur, sur une colonne NULLABLE.
 *
 * `city_tips.author_user_id` est nullable — §9 conserve les contributions d'un
 * membre supprimé, anonymisées — et en SQL `author_user_id NOT IN (…)` vaut NULL,
 * donc FAUX, pour une ligne sans auteur. Un simple `notIn` faisait ainsi
 * disparaître tous les tips anonymisés dès que le lecteur avait UN blocage : un
 * contenu sans auteur n'appartient à personne, et personne ne l'a bloqué.
 */
function separatedAuthorFilter(separated: string[]): Prisma.CityTipWhereInput {
  if (separated.length === 0) return {};
  return { OR: [{ authorUserId: null }, { authorUserId: { notIn: separated } }] };
}

/** Le `select` de l'annuaire (§2.2). Allow-list explicite : jamais un `omit`. */
const MEMBER_SELECT = {
  id: true,
  handle: true,
  displayName: true,
  phase: true,
  createdAt: true,
  verificationLevel: true,
  avatarAsset: { select: { storageKey: true } },
  city: { select: { id: true, name: true, slug: true } },
  originCountry: { select: { iso2: true, nameFr: true } },
  profile: { select: { availableToHelp: true, helpTypes: true, occupationStatus: true } },
  // Les compétences que la carte de l'annuaire montre en puces (les trois premières).
  skills: { select: { skill: { select: { nameFr: true } } }, take: 3 },
} satisfies Prisma.UserSelect;

type MemberRow = Prisma.UserGetPayload<{ select: typeof MEMBER_SELECT }>;

/**
 * Le filtre d'un groupe de l'annuaire.
 *
 * « Les autres » comprend les membres SANS profil : l'écran 5 de l'onboarding est
 * passable, et les exclure retirerait de l'annuaire des membres bien réels.
 */
function groupFilter(group: 'available' | 'others'): Prisma.UserWhereInput {
  return group === 'available'
    ? { profile: { availableToHelp: true } }
    : { OR: [{ profile: { is: null } }, { profile: { availableToHelp: false } }] };
}

/** Le curseur de l'annuaire : groupe, ancienneté, identifiant. */
function parseMemberCursor(
  after: { id: string; sort?: string | number } | null,
): { group: number; createdAt: Date; id: string } | null {
  if (after === null) return null;
  const raw = String(after.sort ?? '');
  const [group, at] = raw.split(':');
  const groupNumber = Number(group);
  const timestamp = Number(at);
  if (!Number.isInteger(groupNumber) || Number.isNaN(timestamp)) {
    throw ApiError.validation([{ path: 'cursor', code: 'MALFORMED' }]);
  }
  return { group: groupNumber, createdAt: new Date(timestamp), id: after.id };
}

/**
 * L'AUDIENCE d'une réponse de fiche ville : qui elle exclut, et rien d'autre.
 *
 * Deux lecteurs qui bloquent exactement les mêmes personnes ont droit à la même
 * réponse — ils peuvent donc partager une entrée de cache. Deux lecteurs dont les
 * listes diffèrent, même d'un seul nom, n'y ont pas droit.
 *
 * Trié avant d'être joint : la base ne promet aucun ordre, et sans le tri deux
 * lecteurs équivalents obtiendraient deux entrées — ce qui ne serait pas faux,
 * seulement inutile. `aucun` plutôt que la chaîne vide, pour qu'une clé se relise.
 */
function desksAudience(separated: readonly string[]): string {
  return separated.length === 0 ? 'aucun' : [...separated].sort().join(',');
}

/** Une contribution de fiche ville, telle que la lecture ET l'écriture la rendent. */
const TIP_SELECT = {
  id: true,
  kind: true,
  body: true,
  amountCents: true,
  helpfulCount: true,
  createdAt: true,
  sourceStoryId: true,
  venueName: true,
  addressText: true,
  authorUserId: true,
  author: { select: { handle: true, displayName: true } },
} satisfies Prisma.CityTipSelect;

@Injectable()
export class CitiesService {
  private readonly logger = new Logger(CitiesService.name);
  private readonly cursorSecret = loadEnv().CURSOR_SECRET;
  private readonly defaultTimeZone = loadEnv().DEFAULT_TIMEZONE;

  /** §2.3 : « Calculé à la requête, cache 5 minutes. Rien n'est stocké. » */
  private readonly desksCache = new Map<string, { at: number; items: unknown[] }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly visibility: VisibilityService,
  ) {}

  private fail(code: CityErrorCode): never {
    throw new ApiError(code, CITY_ERROR_MESSAGES[code], CITY_ERROR_CODES[code]);
  }

  // ── Carte (§2.1) ──────────────────────────────────────────────────────────

  /**
   * Les villes actives et leurs compteurs.
   *
   * Avec `countryId`, le compteur est RECALCULÉ par pays d'origine et passé au
   * seuil de 3. Sans filtre, on rend `member_count`, dénormalisé et recalculé
   * chaque nuit (02 §2.2).
   */
  async map(countryId: string | undefined) {
    const cities = await this.prisma.city.findMany({
      // Une ville inactive n'apparaît pas sur la carte (§2.1, 02 §2.2).
      where: { isActive: true, mergedIntoCityId: null },
      orderBy: [{ memberCount: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        region: true,
        latitude: true,
        longitude: true,
        memberCount: true,
      },
    });

    if (countryId === undefined) {
      return {
        items: cities.map((city) => ({
          id: city.id,
          name: city.name,
          slug: city.slug,
          region: city.region,
          latitude: Number(city.latitude),
          longitude: Number(city.longitude),
          ...cityCount(city.memberCount, 0),
        })),
        nextCursor: null,
        meta: { threshold: CITY_COUNT_PRIVACY_THRESHOLD, countryId: null },
      };
    }

    const counts = await this.countsByCity({ originCountryId: countryId });

    return {
      items: cities.map((city) => ({
        id: city.id,
        name: city.name,
        slug: city.slug,
        region: city.region,
        latitude: Number(city.latitude),
        longitude: Number(city.longitude),
        // RÈGLE DURE §2.1 : jamais 1 ni 2, « moins de 3 ».
        ...cityCount(counts.get(city.id) ?? 0),
      })),
      nextCursor: null,
      meta: { threshold: CITY_COUNT_PRIVACY_THRESHOLD, countryId },
    };
  }

  /**
   * Compte les membres VISIBLES par ville.
   *
   * Les critères viennent du §2.2 : ni compte désactivé, ni supprimé. Un membre
   * caché de l'annuaire doit l'être aussi de la carte, sinon la soustraction des
   * deux le révèle.
   */
  private async countsByCity(filter: { originCountryId?: string }): Promise<Map<string, number>> {
    const rows = await this.prisma.user.groupBy({
      by: ['cityId'],
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        cityId: { not: null },
        ...(filter.originCountryId === undefined ? {} : { originCountryId: filter.originCountryId }),
      },
      _count: { _all: true },
    });
    const out = new Map<string, number>();
    for (const row of rows) {
      if (row.cityId !== null) out.set(row.cityId, row._count._all);
    }
    return out;
  }

  // ── Fiche ville (§2.3) ────────────────────────────────────────────────────

  async profile(slug: string, viewerId: string | null) {
    const city = await this.prisma.city.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        region: true,
        memberCount: true,
        isActive: true,
        mergedIntoCityId: true,
        countryId: true,
        country: { select: { iso2: true } },
      },
    });
    if (city === null) throw ApiError.notFound();
    // Une ville fusionnée n'existe plus : on renvoie 404 plutôt qu'une fiche
    // fantôme, et le front suit la redirection du référentiel (02 §2.2).
    if (city.mergedIntoCityId !== null) throw ApiError.notFound();
    // Ni carte, ni fiche pour une ville inactive (§2.3, 02 §2.2).
    if (!city.isActive) this.fail('CITY_INACTIVE');
    const zone = zoneOf(city.country.iso2, this.defaultTimeZone);

    const [byCountry, network, upcoming, newcomers, tips, budgetMedian, tipCounts] = await Promise.all([
      this.breakdownByCountry(city.id),
      this.prisma.community.findFirst({
        where: { kind: 'CITY', cityId: city.id, status: 'ACTIVE' },
        select: { id: true, name: true, slug: true, memberCount: true },
      }),
      this.upcomingEvents(city.id, viewerId),
      this.newcomers(city.id, viewerId),
      this.tipsByKind(city.id, viewerId),
      this.budgetMedianCents(city.id),
      this.tipCountsByKind(city.id, viewerId),
    ]);

    return {
      city: {
        id: city.id,
        name: city.name,
        slug: city.slug,
        region: city.region,
        memberCount: city.memberCount,
        byCountry,
      },
      network,
      events: upcoming.map((e) => ({
        ...e,
        // Le fuseau de la ville et le jour civil DANS ce fuseau : l'écran ne
        // recalcule jamais un jour (comme les fiches de l'agenda).
        timeZone: zone,
        localDate: localDate(e.startsAt, zone),
      })),
      newcomers,
      tips,
      tipCounts,
      // §2.3 : « l'agrégat (médiane) s'affiche en tête ».
      budgetMedianCents: budgetMedian,
      meta: { threshold: CITY_COUNT_PRIVACY_THRESHOLD, newcomerWindowDays: NEWCOMER_WINDOW_DAYS },
    };
  }

  /** La répartition par pays d'origine — au seuil de 3, comme la carte. */
  private async breakdownByCountry(
    cityId: string,
  ): Promise<{ countryId: string; iso2: string; nameFr: string; count: number | null; belowThreshold: boolean }[]> {
    const rows = await this.prisma.user.groupBy({
      by: ['originCountryId'],
      where: { cityId, deletedAt: null, status: 'ACTIVE' },
      _count: { _all: true },
    });
    if (rows.length === 0) return [];

    const countries = await this.prisma.country.findMany({
      where: { id: { in: rows.map((r) => r.originCountryId) } },
      select: { id: true, iso2: true, nameFr: true },
    });
    const byId = new Map(countries.map((c) => [c.id, c]));

    return rows
      .map((row) => {
        const country = byId.get(row.originCountryId);
        const counted: CityCount = cityCount(row._count._all);
        return {
          countryId: row.originCountryId,
          iso2: country?.iso2 ?? '??',
          nameFr: country?.nameFr ?? 'Inconnu',
          ...counted,
        };
      })
      // Les pays sous le seuil restent LISTÉS (« moins de 3 ») : les retirer
      // dirait, par leur absence, qu'il n'y a personne.
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || a.nameFr.localeCompare(b.nameFr));
  }

  private async upcomingEvents(cityId: string, viewerId: string | null) {
    const separated = await this.visibility.separatedFrom(viewerId);
    const communityIds =
      viewerId === null
        ? []
        : (
            await this.prisma.communityMember.findMany({
              where: { userId: viewerId, status: 'ACTIVE' },
              select: { communityId: true },
            })
          ).map((r) => r.communityId);

    const rows = await this.prisma.event.findMany({
      where: {
        cityId,
        deletedAt: null,
        status: 'SCHEDULED',
        startsAt: { gte: new Date() },
        ...(separated.length > 0 ? { organizerUserId: { notIn: separated } } : {}),
        // RÈGLE DURE (§10) : un événement de réseau n'existe pas pour un non-membre.
        OR: [
          { communityId: null },
          ...(communityIds.length > 0 ? [{ communityId: { in: communityIds } }] : []),
        ],
      },
      orderBy: { startsAt: 'asc' },
      take: 5,
      select: {
        id: true,
        title: true,
        type: true,
        startsAt: true,
        venueName: true,
        attendeeCount: true,
        capacity: true,
      },
    });
    return rows;
  }

  /**
   * Les nouveaux arrivants (§2.4).
   *
   * `arrival_date` si elle existe, sinon `created_at` — la spec le dit, et un
   * membre qui n'a pas renseigné sa date d'arrivée doit pouvoir être accueilli.
   *
   * MANQUE : `user_profiles.show_as_newcomer` (colonne de §4 absente du schéma
   * figé). Faute d'option de retrait, on applique le critère le plus protecteur
   * disponible — un profil non public n'apparaît pas — et on le signale.
   */
  private async newcomers(cityId: string, viewerId: string | null) {
    const since = new Date(Date.now() - NEWCOMER_WINDOW_DAYS * 86_400_000);
    const separated = await this.visibility.separatedFrom(viewerId);

    const rows = await this.prisma.user.findMany({
      where: {
        cityId,
        deletedAt: null,
        status: 'ACTIVE',
        phase: 'RECENT_ARRIVAL',
        ...(separated.length > 0 ? { id: { notIn: separated } } : {}),
        AND: [
          { OR: [{ arrivalDate: { gte: since } }, { arrivalDate: null, createdAt: { gte: since } }] },
          // 09 §2.4 : le membre peut ne pas apparaître ici (`show_as_newcomer`, défaut
          // vrai). Un membre sans ligne de profil est au défaut, donc visible.
          { OR: [{ profile: { is: null } }, { profile: { showAsNewcomer: true } }] },
        ],
      },
      orderBy: [{ arrivalDate: 'desc' }, { createdAt: 'desc' }],
      take: 12,
      select: {
        handle: true,
        displayName: true,
        arrivalDate: true,
        createdAt: true,
        avatarAsset: { select: { storageKey: true } },
        originCountry: { select: { iso2: true, nameFr: true } },
        profile: { select: { isPublic: true } },
      },
    });

    return rows
      .filter((row) => viewerId !== null || (row.profile?.isPublic ?? false))
      .map((row) => ({
        handle: row.handle,
        displayName: row.displayName,
        avatarUrl: row.avatarAsset === null ? null : `/media/${row.avatarAsset.storageKey}`,
        country: row.originCountry,
        arrivedAt: row.arrivalDate ?? row.createdAt,
      }));
  }

  /** §2.3 : les quatre sections de la fiche, chacune triée par utilité puis date. */
  private async tipsByKind(cityId: string, viewerId: string | null) {
    const separated = await this.visibility.separatedFrom(viewerId);
    const rows = await this.prisma.cityTip.findMany({
      where: {
        cityId,
        deletedAt: null,
        status: 'PUBLISHED',
        ...separatedAuthorFilter(separated),
      },
      orderBy: [{ helpfulCount: 'desc' }, { createdAt: 'desc' }],
      take: 40,
      select: {
        id: true,
        kind: true,
        body: true,
        amountCents: true,
        helpfulCount: true,
        createdAt: true,
        sourceStoryId: true,
        venueName: true,
        addressText: true,
        authorUserId: true,
        author: { select: { handle: true, displayName: true } },
      },
    });

    const views = await this.withViewerState(rows, viewerId);
    const grouped: Record<string, typeof views> = { TIP: [], SHOP: [], BUDGET: [], TESTIMONY: [] };
    for (const row of views) {
      grouped[row.kind]?.push(row);
    }
    return grouped;
  }

  /**
   * Le NOMBRE de contributions par genre : la liste `tips` est bornée (40), le
   * compteur de l'en-tête (« 212 contributions », « 38 contributions » sous la
   * médiane) ne doit pas l'être.
   */
  private async tipCountsByKind(
    cityId: string,
    viewerId: string | null,
  ): Promise<Record<'TIP' | 'SHOP' | 'BUDGET' | 'TESTIMONY', number>> {
    const separated = await this.visibility.separatedFrom(viewerId);
    const rows = await this.prisma.cityTip.groupBy({
      by: ['kind'],
      where: {
        cityId,
        deletedAt: null,
        status: 'PUBLISHED',
        ...separatedAuthorFilter(separated),
      },
      _count: { _all: true },
    });
    const out = { TIP: 0, SHOP: 0, BUDGET: 0, TESTIMONY: 0 };
    for (const row of rows) out[row.kind] = row._count._all;
    return out;
  }

  /**
   * La médiane des budgets de la ville (§2.3).
   *
   * Médiane et non moyenne : un seul loyer aberrant déplacerait la moyenne et
   * donnerait au nouvel arrivant un repère faux — c'est précisément ce que cette
   * section existe pour éviter.
   */
  private async budgetMedianCents(cityId: string): Promise<number | null> {
    const rows = await this.prisma.cityTip.findMany({
      where: {
        cityId,
        kind: 'BUDGET',
        deletedAt: null,
        status: 'PUBLISHED',
        amountCents: { not: null },
      },
      select: { amountCents: true },
      orderBy: { amountCents: 'asc' },
    });
    if (rows.length === 0) return null;
    const values = rows.map((r) => r.amountCents ?? 0);
    const middle = Math.floor(values.length / 2);
    if (values.length % 2 === 1) return values[middle] ?? null;
    return Math.round(((values[middle - 1] ?? 0) + (values[middle] ?? 0)) / 2);
  }

  /**
   * « Guichets du jour » (§2.3).
   *
   * Agrégat des stories `INFORMATION` ACTIVES de la ville dont le sujet est
   * démarches et qui portent un `place_label` : par lieu, la dernière
   * information, l'heure, les confirmations, les signalements « ça a changé ».
   *
   * Rien n'est stocké au-delà des stories elles-mêmes (§2.3) : d'où le calcul à
   * la requête et le cache de 5 minutes, en mémoire.
   */
  async desks(slug: string, viewerId: string | null) {
    const city = await this.prisma.city.findUnique({
      where: { slug },
      select: { id: true, isActive: true },
    });
    if (city === null) throw ApiError.notFound();
    if (!city.isActive) this.fail('CITY_INACTIVE');

    /**
     * LA SÉPARATION EST CALCULÉE AVANT LE CACHE, et elle entre dans sa clé.
     *
     * Elle était calculée APRÈS, et la clé ne portait que `city.id` : le résultat
     * DÉJÀ FILTRÉ pour un lecteur était donc resservi à tous les autres pendant
     * cinq minutes. Les deux moitiés du défaut n'ont pas la même gravité :
     *
     *   · un lecteur sans blocage remplit le cache, et celui qui a bloqué l'auteur
     *     reçoit ensuite SA story — c'est un contournement du blocage, pas un
     *     défaut d'affichage ;
     *   · à l'inverse, un lecteur qui bloque remplit le cache avec son propre
     *     filtre, et fait disparaître du contenu pour des gens qui n'ont rien
     *     demandé.
     *
     * Deux lecteurs qui bloquent les mêmes personnes partagent légitimement une
     * entrée : ce qu'on leur doit est identique. La clé est donc la ville PLUS
     * l'empreinte de la liste triée — triée, sinon deux lecteurs équivalents
     * auraient deux entrées selon l'ordre rendu par la base.
     */
    const separated = await this.visibility.separatedFrom(viewerId);
    const desksKey = `${city.id}|${desksAudience(separated)}`;

    const cached = this.desksCache.get(desksKey);
    if (cached !== undefined && Date.now() - cached.at < CITY_DESKS_CACHE_MS) {
      return { items: cached.items, nextCursor: null, meta: { cached: true } };
    }
    const stories = await this.prisma.story.findMany({
      where: {
        cityId: city.id,
        type: 'INFORMATION',
        status: 'ACTIVE',
        deletedAt: null,
        placeLabel: { not: null },
        expiresAt: { gt: new Date() },
        // `stories.author_user_id` est NON nullable (relation en cascade) : le
        // `notIn` suffit ici, et le détour par `OR` des city_tips n'a pas lieu d'être.
        ...(separated.length > 0 ? { authorUserId: { notIn: separated } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        body: true,
        category: true,
        placeLabel: true,
        createdAt: true,
        validUntil: true,
        positiveCount: true,
        negativeCount: true,
      },
    });

    const byPlace = new Map<
      string,
      {
        placeLabel: string;
        lastInformation: string;
        at: Date;
        validUntil: Date | null;
        confirmations: number;
        changedReports: number;
      }
    >();

    for (const story of stories) {
      if (!isPaperworkSubject(story.category)) continue;
      const place = story.placeLabel ?? '';
      const existing = byPlace.get(place);
      if (existing === undefined) {
        // Les stories arrivent du plus récent au plus ancien : la première vue
        // pour un lieu est « la dernière information » (§2.3).
        byPlace.set(place, {
          placeLabel: place,
          lastInformation: story.body,
          at: story.createdAt,
          validUntil: story.validUntil,
          // `story_reactions` : CONFIRM est le vote positif d'une INFORMATION,
          // CHANGED son vote négatif (04 §2.6). On lit les compteurs déjà tenus.
          confirmations: story.positiveCount,
          changedReports: story.negativeCount,
        });
      } else {
        existing.confirmations += story.positiveCount;
        existing.changedReports += story.negativeCount;
      }
    }

    const items = [...byPlace.values()].sort((a, b) => b.at.getTime() - a.at.getTime());
    this.desksCache.set(desksKey, { at: Date.now(), items });
    return { items, nextCursor: null, meta: { cached: false } };
  }

  // ── Annuaire des membres (§2.2) ───────────────────────────────────────────

  /**
   * L'annuaire filtrable (§2.2).
   *
   * Tri imposé : « disponibilité pour aider d'abord, puis ancienneté ». Ce tri
   * ne peut PAS être paginé par un simple `orderBy` Prisma, et c'est la seule
   * difficulté de cette méthode :
   *
   *   · `available_to_help` vit dans `user_profiles`, et l'écran 5 de
   *     l'onboarding est passable — beaucoup de membres n'ont pas de ligne. Un
   *     `ORDER BY profile.available_to_help DESC` sur une jointure externe met
   *     les NULL EN TÊTE en PostgreSQL : les membres sans profil passeraient
   *     devant ceux qui se sont déclarés disponibles, soit l'inverse de la règle ;
   *
   *   · un curseur sur l'identifiant seul mélangerait les deux groupes dès la
   *     deuxième page.
   *
   * On parcourt donc DEUX groupes explicites — les disponibles, puis les autres —
   * chacun ordonné par ancienneté, et le curseur porte le groupe où reprendre.
   *
   * Exclusions du §2.2, toutes ici : profils non publics hors connexion, membres
   * bloqués (dans les deux sens), comptes désactivés ou supprimés.
   */
  async members(query: MembersQuery, viewerId: string | null) {
    const cityIds = await this.cityScope(query.cityId, query.radiusKm);
    const separated = await this.visibility.separatedFrom(viewerId);

    // Les conditions sur `user_profiles` sont fusionnées en UN objet.
    //
    // Bogue trouvé en exerçant la route : deux clés `profile:` dans le même
    // littéral, et la seconde écrase la première en JavaScript. Un visiteur
    // anonyme filtrant par statut d'occupation perdait ainsi la condition
    // `isPublic: true` — l'annuaire lui rendait des profils privés.
    const profileFilter: Prisma.UserProfileWhereInput = {
      // Hors connexion, seuls les profils publics (§2.2). Connecté, un membre voit
      // l'annuaire entier — c'est ce que §2.7 de 01 accorde à « un autre membre ».
      ...(viewerId === null ? { isPublic: true } : {}),
      ...(query.occupationStatus === undefined
        ? {}
        : { occupationStatus: query.occupationStatus }),
    };

    const base: Prisma.UserWhereInput = {
      deletedAt: null,
      status: 'ACTIVE',
      ...(cityIds === null ? {} : { cityId: { in: cityIds } }),
      ...(query.originCountryId === undefined ? {} : { originCountryId: query.originCountryId }),
      ...(query.phase === undefined ? {} : { phase: query.phase }),
      ...(separated.length > 0 ? { id: { notIn: separated } } : {}),
      ...(query.skillId === undefined ? {} : { skills: { some: { skillId: query.skillId } } }),
      ...(query.languageId === undefined
        ? {}
        : { languages: { some: { languageId: query.languageId } } }),
      ...(Object.keys(profileFilter).length === 0 ? {} : { profile: profileFilter }),
    };

    const groups: ('available' | 'others')[] =
      query.availableToHelp === undefined
        ? ['available', 'others']
        : [query.availableToHelp ? 'available' : 'others'];

    const scope = `members:${query.cityId ?? ''}:${query.radiusKm}:${query.originCountryId ?? ''}:${query.phase ?? ''}:${query.occupationStatus ?? ''}:${query.skillId ?? ''}:${query.languageId ?? ''}:${String(query.availableToHelp)}`;
    const after =
      query.cursor === undefined ? null : decodeCursor(query.cursor, this.cursorSecret, scope);
    const resume = parseMemberCursor(after);

    const collected: (MemberRow & { group: number })[] = [];
    for (let index = (resume?.group ?? 1) - 1; index < groups.length; index += 1) {
      if (collected.length > query.limit) break;
      const group = groups[index];
      if (group === undefined) break;
      const resuming = resume !== null && index === resume.group - 1;

      const rows = await this.prisma.user.findMany({
        where: {
          ...base,
          AND: [
            groupFilter(group),
            ...(resuming
              ? [
                  {
                    OR: [
                      { createdAt: { gt: resume.createdAt } },
                      { createdAt: resume.createdAt, id: { gt: resume.id } },
                    ],
                  },
                ]
              : []),
          ],
        },
        // L'ancienneté : le plus ancien membre d'abord (§2.2).
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: query.limit + 1 - collected.length,
        select: MEMBER_SELECT,
      });

      collected.push(...rows.map((row) => ({ ...row, group: index + 1 })));
    }

    const hasMore = collected.length > query.limit;
    const items = hasMore ? collected.slice(0, query.limit) : collected;
    const last = items.at(-1);

    return {
      items: items.map((row) => ({
        handle: row.handle,
        displayName: row.displayName,
        avatarUrl: row.avatarAsset === null ? null : `/media/${row.avatarAsset.storageKey}`,
        phase: row.phase,
        verificationLevel: row.verificationLevel,
        city: row.city,
        country: row.originCountry,
        availableToHelp: row.profile?.availableToHelp ?? false,
        helpTypes: row.profile?.helpTypes ?? [],
        occupationStatus: row.profile?.occupationStatus ?? null,
        skills: row.skills.map((s) => s.skill.nameFr),
        memberSince: row.createdAt,
      })),
      nextCursor:
        hasMore && last !== undefined
          ? encodeCursor(
              { id: last.id, sort: `${last.group}:${last.createdAt.getTime()}`, scope },
              this.cursorSecret,
            )
          : null,
    };
  }


  /** Les villes du rayon demandé, ou null pour « toutes ». */
  private async cityScope(
    cityId: string | undefined,
    radiusKm: number,
  ): Promise<string[] | null> {
    if (cityId === undefined) return null;
    const center = await this.prisma.city.findUnique({
      where: { id: cityId },
      select: { id: true, latitude: true, longitude: true },
    });
    if (center === null) throw ApiError.notFound();
    if (radiusKm <= 0) return [center.id];

    const cities = await this.prisma.city.findMany({
      where: { mergedIntoCityId: null },
      select: { id: true, latitude: true, longitude: true },
    });
    return cities
      .filter(
        (city) =>
          city.id === center.id ||
          haversineKm(
            Number(center.latitude),
            Number(center.longitude),
            Number(city.latitude),
            Number(city.longitude),
          ) <= radiusKm,
      )
      .map((city) => city.id);
  }

  // ── Contenus communautaires (§2.3) ────────────────────────────────────────

  async listTips(slug: string, query: CityTipsQuery, viewerId: string | null) {
    const city = await this.prisma.city.findUnique({
      where: { slug },
      select: { id: true, isActive: true },
    });
    if (city === null) throw ApiError.notFound();

    const separated = await this.visibility.separatedFrom(viewerId);
    const scope = `tips:${city.id}:${query.kind ?? ''}`;
    const after =
      query.cursor === undefined ? null : decodeCursor(query.cursor, this.cursorSecret, scope);

    const rows = await this.prisma.cityTip.findMany({
      where: {
        cityId: city.id,
        deletedAt: null,
        status: 'PUBLISHED',
        ...(query.kind === undefined ? {} : { kind: query.kind }),
        ...separatedAuthorFilter(separated),
        ...(after === null ? {} : { id: { gt: after.id } }),
      },
      // §2.3 : « Tri par utilité puis date. »
      orderBy: [{ helpfulCount: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
      take: query.limit + 1,
      select: {
        id: true,
        kind: true,
        body: true,
        amountCents: true,
        helpfulCount: true,
        createdAt: true,
        sourceStoryId: true,
        venueName: true,
        addressText: true,
        authorUserId: true,
        author: { select: { handle: true, displayName: true } },
      },
    });

    const page = buildPage(rows, query.limit, scope, this.cursorSecret);
    return {
      items: await this.withViewerState(page.items, viewerId),
      nextCursor: page.nextCursor,
      meta:
        query.kind === 'BUDGET'
          ? { medianCents: await this.budgetMedianCents(city.id) }
          : undefined,
    };
  }

  /** §2.3 : contribuer à la fiche ville. Capacité `post.create` (L1). */
  async createTip(slug: string, authorUserId: string, input: CreateCityTip) {
    const city = await this.prisma.city.findUnique({
      where: { slug },
      select: { id: true, isActive: true, mergedIntoCityId: true },
    });
    if (city === null || city.mergedIntoCityId !== null) throw ApiError.notFound();
    if (!city.isActive) this.fail('CITY_INACTIVE');

    if (input.sourceStoryId !== undefined) {
      // §2.3 : « Une story DECOUVERTE gardée PAR SON AUTEUR devient un city_tips. »
      // Par son auteur : garder la découverte d'un autre serait s'en attribuer une.
      const story = await this.prisma.story.findUnique({
        where: { id: input.sourceStoryId },
        select: { authorUserId: true, type: true, deletedAt: true },
      });
      if (story === null || story.deletedAt !== null) throw ApiError.notFound();
      if (story.authorUserId !== authorUserId) throw ApiError.notFound();
      if (story.type !== 'DECOUVERTE') {
        throw ApiError.validation([{ path: 'sourceStoryId', code: 'WRONG_STORY_TYPE' }]);
      }
    }

    const id = newId();
    const tip = await this.prisma.$transaction(async (tx) => {
      const row = await tx.cityTip.create({
        data: {
          id,
          cityId: city.id,
          authorUserId,
          kind: input.kind,
          body: input.body,
          amountCents: input.amountCents ?? null,
          sourceStoryId: input.sourceStoryId ?? null,
          venueName: input.venueName ?? null,
          addressText: input.addressText ?? null,
          status: 'PUBLISHED',
        },
        select: {
          id: true,
          kind: true,
          body: true,
          amountCents: true,
          helpfulCount: true,
          createdAt: true,
          sourceStoryId: true,
          venueName: true,
          addressText: true,
          authorUserId: true,
          author: { select: { handle: true, displayName: true } },
        },
      });

      if (input.sourceStoryId !== undefined) {
        // La story garde la trace de sa conversion (04 §2.6 : `converted_to`).
        await tx.story.update({
          where: { id: input.sourceStoryId },
          data: { convertedToType: 'city_tip', convertedToId: id },
        });
      }

      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: authorUserId },
        action: 'city_tip.created',
        targetType: 'city_tip',
        targetId: id,
        metadata: { cityId: city.id, kind: input.kind },
      });

      await this.outbox.emit(tx, {
        type: 'city_tip.published',
        aggregateId: id,
        payload: { cityId: city.id, authorUserId, kind: input.kind },
      });

      return row;
    });

    /**
     * Cette purge ne sert à RIEN, et elle reste — lisez `oublierGuichets`.
     *
     * `createTip` écrit dans `city_tips` ; `desks()` lit `stories`. Purger ici ne
     * peut donc rien changer à ce que la fiche des guichets rend. On la garde
     * parce qu'elle est juste — une contribution ne doit pas laisser de vue
     * périmée derrière elle — et parce que le jour où `desks()` lira aussi les
     * astuces, elle sera déjà au bon endroit.
     *
     * Le VRAI déclencheur est sur le chemin des stories, et il manquait : voir
     * `oublierGuichets` et son abonnement dans `event-subscriptions.service.ts`.
     */
    this.oublierGuichets(city.id);
    return this.withViewerStateOne(tip, authorUserId);
  }

  /**
   * OUBLIER LES GUICHETS D'UNE VILLE — et pourquoi cette méthode est publique.
   *
   * `desks()` lit `stories`. Or la seule purge du cache vivait dans `createTip`,
   * qui écrit `city_tips` : elle ne pouvait rien changer, et RIEN sur le chemin
   * des stories ne purgeait. Mesuré : une information de guichet publiée par
   * `POST /stories` restait invisible jusqu'au redémarrage du processus, la fiche
   * continuant de rendre `{"items":[],"meta":{"cached":true}}`.
   *
   * C'est le miroir exact du défaut que le fichier de câblage des événements
   * raconte à son propre sujet — un événement sans lecteur — sauf qu'ici c'est un
   * lecteur sans événement.
   *
   * Publique, donc, pour que le câblage l'abonne aux événements de story. Les
   * services métier restent ignorants de la file : ils exposent une méthode, le
   * fichier de câblage décide qui l'appelle.
   *
   * RÉSERVE À CONNAÎTRE : ce cache vit dans la MÉMOIRE DU PROCESSUS. Avec
   * plusieurs instances d'API, seule celle qui traite l'événement oublie ; les
   * autres attendent l'expiration. Ce n'est pas introduit ici — c'est la nature
   * du cache — mais cela veut dire que la fraîcheur reste garantie par la durée
   * de vie, et que la purge ne fait que l'améliorer là où elle passe.
   */
  oublierGuichets(cityId: string): void {
    // Une ville a AUTANT D'ENTRÉES que d'audiences distinctes l'ont consultée :
    // les effacer toutes, sinon une information nouvelle resterait invisible pour
    // tout lecteur dont la liste de blocage n'est pas vide.
    for (const key of this.desksCache.keys()) {
      if (key.startsWith(`${cityId}|`)) this.desksCache.delete(key);
    }
  }

  async updateTip(tipId: string, authorUserId: string, patch: UpdateCityTip) {
    const tip = await this.loadOwnedTip(tipId, authorUserId);
    if (patch.amountCents !== undefined && tip.kind !== 'BUDGET') {
      throw ApiError.validation([{ path: 'amountCents', code: 'NOT_A_BUDGET' }]);
    }

    const updated = await this.prisma.cityTip.update({
      where: { id: tipId },
      data: {
        ...(patch.body === undefined ? {} : { body: patch.body }),
        ...(patch.amountCents === undefined ? {} : { amountCents: patch.amountCents }),
      },
      select: TIP_SELECT,
    });
    return this.withViewerStateOne(updated, authorUserId);
  }

  // ── Vote « utile » (09 §2.3) ──────────────────────────────────────────────

  /**
   * `PUT /tips/:id/vote` — « utile », un par membre.
   *
   * IDEMPOTENT : revoter ne change rien (la ligne unique `(city_tip_id, user_id)`
   * est la prise) et n'émet rien. `helpful_count` est tenu dans la MÊME
   * transaction que la ligne de vote : un compteur qui diverge de ses votes est
   * la seule façon de rendre ce tri faux.
   *
   * On ne vote pas pour sa propre contribution (CONFLICT) — sinon le tri « par
   * utilité » serait le classement de qui s'applaudit le mieux — ni pour celle
   * d'un membre séparé de soi (404, comme tout contenu d'un bloqué).
   */
  async vote(tipId: string, userId: string): Promise<{ helpfulCount: number; votedByMe: true }> {
    const tip = await this.loadVotableTip(tipId, userId);
    const helpfulCount = await this.prisma.$transaction(async (tx) => {
      const created = await tx.cityTipVote.createMany({
        data: [{ id: newId(), cityTipId: tipId, userId }],
        skipDuplicates: true,
      });
      if (created.count === 0) {
        const row = await tx.cityTip.findUniqueOrThrow({
          where: { id: tipId },
          select: { helpfulCount: true },
        });
        return row.helpfulCount;
      }
      const row = await tx.cityTip.update({
        where: { id: tipId },
        data: { helpfulCount: { increment: 1 } },
        select: { helpfulCount: true },
      });
      await this.outbox.emit(tx, {
        type: 'city_tip.voted',
        aggregateId: tipId,
        payload: { cityId: tip.cityId, voterUserId: userId, authorUserId: tip.authorUserId, voted: true },
      });
      return row.helpfulCount;
    });
    return { helpfulCount, votedByMe: true };
  }

  /** `DELETE /tips/:id/vote` — retire mon vote. Idempotent, comme `vote`. */
  async unvote(tipId: string, userId: string): Promise<{ helpfulCount: number; votedByMe: false }> {
    const tip = await this.loadVotableTip(tipId, userId);
    const helpfulCount = await this.prisma.$transaction(async (tx) => {
      const gone = await tx.cityTipVote.deleteMany({ where: { cityTipId: tipId, userId } });
      if (gone.count === 0) {
        const row = await tx.cityTip.findUniqueOrThrow({
          where: { id: tipId },
          select: { helpfulCount: true },
        });
        return row.helpfulCount;
      }
      const row = await tx.cityTip.update({
        where: { id: tipId },
        data: { helpfulCount: { decrement: 1 } },
        select: { helpfulCount: true },
      });
      await this.outbox.emit(tx, {
        type: 'city_tip.voted',
        aggregateId: tipId,
        payload: { cityId: tip.cityId, voterUserId: userId, authorUserId: tip.authorUserId, voted: false },
      });
      return row.helpfulCount;
    });
    return { helpfulCount, votedByMe: false };
  }

  private async loadVotableTip(tipId: string, userId: string) {
    const tip = await this.prisma.cityTip.findUnique({
      where: { id: tipId },
      select: { id: true, cityId: true, authorUserId: true, deletedAt: true, status: true },
    });
    if (tip === null || tip.deletedAt !== null || tip.status !== 'PUBLISHED') throw ApiError.notFound();
    if (tip.authorUserId === userId) throw ApiError.transverse('CONFLICT', { reason: 'OWN_TIP' });
    if (tip.authorUserId !== null) await this.visibility.assertVisible(userId, tip.authorUserId);
    return tip;
  }

  private async withViewerStateOne<T extends { id: string; authorUserId: string | null }>(
    row: T,
    viewerId: string | null,
  ) {
    const [view] = await this.withViewerState([row], viewerId);
    if (view === undefined) throw ApiError.notFound();
    return view;
  }

  /**
   * Ce que le lecteur doit savoir d'une contribution et que la ligne ne dit pas :
   * l'a-t-il trouvée utile (`votedByMe`) et est-elle de lui (`mine`). Le serveur
   * décide ; le front n'en déduit rien.
   */
  private async withViewerState<
    T extends { id: string; authorUserId: string | null },
  >(rows: readonly T[], viewerId: string | null) {
    const voted =
      viewerId === null || rows.length === 0
        ? new Set<string>()
        : new Set(
            (
              await this.prisma.cityTipVote.findMany({
                where: { userId: viewerId, cityTipId: { in: rows.map((r) => r.id) } },
                select: { cityTipId: true },
              })
            ).map((v) => v.cityTipId),
          );
    return rows.map(({ authorUserId, ...rest }) => ({
      ...rest,
      votedByMe: voted.has(rest.id),
      mine: viewerId !== null && authorUserId === viewerId,
    }));
  }

  /**
   * Gestionnaire de `user.deleted` (09 §9) : « Tips : conservés anonymisés ;
   * votes supprimés. » Les contributions restent (la ligne `users` est
   * anonymisée, pas retirée). Les votes du membre partent, et chaque
   * `helpful_count` redescend d'autant — sans quoi le compteur survivrait à son
   * électeur. Idempotent : un rejeu ne trouve plus de vote.
   */
  async handleUserDeleted(userId: string): Promise<void> {
    const votes = await this.prisma.cityTipVote.findMany({
      where: { userId },
      select: { id: true, cityTipId: true },
    });
    for (const vote of votes) {
      await this.prisma.$transaction(async (tx) => {
        const gone = await tx.cityTipVote.deleteMany({ where: { id: vote.id } });
        if (gone.count === 0) return;
        await tx.cityTip.updateMany({
          where: { id: vote.cityTipId, helpfulCount: { gt: 0 } },
          data: { helpfulCount: { decrement: 1 } },
        });
      });
    }
  }

  /** Suppression LOGIQUE : §9 conserve les tips anonymisés, jamais effacés en dur. */
  async deleteTip(tipId: string, authorUserId: string): Promise<{ id: string }> {
    await this.loadOwnedTip(tipId, authorUserId);
    await this.prisma.cityTip.update({
      where: { id: tipId },
      data: { deletedAt: new Date() },
    });
    return { id: tipId };
  }

  private async loadOwnedTip(tipId: string, authorUserId: string) {
    const tip = await this.prisma.cityTip.findUnique({
      where: { id: tipId },
      select: { id: true, kind: true, authorUserId: true, deletedAt: true },
    });
    if (tip === null || tip.deletedAt !== null) throw ApiError.notFound();
    // 404 et non 403 (T4 §3).
    if (tip.authorUserId !== authorUserId) throw ApiError.notFound();
    return tip;
  }

  // ══ Tâches planifiées ══════════════════════════════════════════════════════

  /**
   * `city.member_count_recompute` — chaque nuit. 02 §2.2 : « Recalculé chaque
   * nuit : membres actifs avec `city_id` = cette ville. Utilisé par la carte. »
   *
   * CETTE MÉTHODE N'EXISTAIT PAS, et `cities.member_count` valait donc zéro pour
   * toutes les villes, depuis toujours. Personne ne l'écrivait — vérifié : les
   * seules écritures de `memberCount` du dépôt portaient sur `communities`.
   * Pourtant trois lectures en dépendent, et le commentaire de `map()` affirmait
   * déjà un recalcul nocturne :
   *
   *   · le TRI de la carte (`orderBy: [{ memberCount: 'desc' }, { name: 'asc' }]`)
   *     — les villes les plus peuplées d'abord. Avec un compteur uniformément nul,
   *     le premier critère ne départageait rien et la carte sortait dans l'ordre
   *     ALPHABÉTIQUE. C'est la conséquence la plus visible, et la plus silencieuse :
   *     une liste triée par un critère mort reste une liste triée ;
   *   · le compteur rendu par la carte et par la fiche de ville, donc « 0 membre »
   *     partout ;
   *   · le nombre que l'ÉQUIPE regarde pour activer une ville. §2.2 est explicite :
   *     l'activation « passe active quand l'équipe le décide, en GÉNÉRAL à 20
   *     membres » — ce n'est pas un seuil automatique, c'est un jugement humain
   *     nourri par ce chiffre. Le chiffre étant faux, la décision l'était aussi.
   *
   * LA DÉFINITION est celle que toutes les autres lectures emploient déjà
   * (`countsByCity`, `breakdownByCountry`) : membre `ACTIVE`, non supprimé,
   * rattaché à la ville. Il fallait qu'elle coïncide — un compteur qui ne compte
   * pas la même chose que la liste qu'il annonce est pire qu'un compteur absent.
   *
   * TOUTES les villes sont recalculées, y compris les INACTIVES : c'est justement
   * leur compteur qui sert à décider de leur activation. Les villes FUSIONNÉES
   * aussi, et elles tomberont naturellement à zéro puisque §2.2 redirige leurs
   * membres vers la ville cible — si l'une d'elles garde un compte non nul, c'est
   * que la redirection est incomplète, et le voir vaut mieux que le masquer.
   *
   * `WHERE member_count <> sub.total` : seules les lignes qui changent sont
   * écrites. Sur un balayage nocturne de toutes les villes, cela évite de réveiller
   * les déclencheurs et de gonfler les WAL pour des valeurs identiques.
   */
  async recomputeMemberCounts(): Promise<number> {
    return this.prisma.$executeRaw`
      UPDATE cities c
      SET member_count = sub.total
      FROM (
        SELECT ci.id, COUNT(u.id) AS total
        FROM cities ci
        LEFT JOIN users u
          ON u.city_id = ci.id
         AND u.deleted_at IS NULL
         AND u.status::text = 'ACTIVE'
        GROUP BY ci.id
      ) AS sub
      WHERE c.id = sub.id AND c.member_count <> sub.total
    `;
  }

  /**
   * `city.activation_suggest` — hebdomadaire (02 §7) : « signale à l'équipe les
   * villes inactives à plus de 20 membres ».
   *
   * ELLE NE FAIT QUE LIRE, et c'est la seule lecture correcte de §2.2 : « Elle passe
   * active quand l'ÉQUIPE le décide, en général à 20 membres. » Activer une ville
   * crée son réseau CITY et y inscrit tous ses membres — un effet qu'AUCUNE route ne
   * défait. Une tâche qui activerait à vingt membres franchirait donc, chaque
   * semaine et sans retour possible, la décision que §2.2 réserve nommément à un
   * humain. « Signale » veut dire signale.
   *
   * C'est la forme de `moderation.sla_alert`, et pour la même raison : sa ligne de
   * journal est aujourd'hui l'alerte que le runbook observe.
   *
   * OÙ CE SIGNAL DEVRAIT ARRIVER, et n'arrive pas encore : T5 D1 décrit en tête du
   * tableau de bord d'équipe un bandeau « Alertes (SLA dépassé, justificatifs en
   * attente, VILLES À ACTIVER) ». Les trois manquent — `GET /admin/dashboard` ne
   * rend que les blocs d'indicateurs de 15 §5.1. Remonté plutôt que comblé ici :
   * livrer un tiers d'un bandeau de module 15 depuis le module 02 serait un choix de
   * produit, et la précédente de ce fichier (`moderation.sla_alert`, même bandeau,
   * même manque) a tranché pour la ligne de journal. Elle rejoint la revue
   * hebdomadaire « Villes à activer » de T4 §6, où l'équipe ouvre déjà
   * `GET /v1/admin/ref/cities?active=false`, qui rend `memberCount` — c'est-à-dire
   * que la tâche et l'écran lisent le MÊME chiffre, celui que
   * `city.member_count_recompute` écrit chaque nuit. Le jour où l'équipe veut une
   * notification plutôt qu'une ligne de journal, seul le gestionnaire change.
   *
   * IDEMPOTENTE PAR CONSTRUCTION : aucune écriture. Deux passages au même instant,
   * ou à une heure d'écart, rendent la même liste et ne touchent rien.
   *
   * Les villes FUSIONNÉES sont écartées : leur compteur est censé tomber à zéro
   * (§2.2 redirige leurs membres), mais si la redirection est incomplète, on ne veut
   * surtout pas proposer d'activer une ville qui n'existe plus.
   */
  async suggestActivations(
    threshold: number = CITY_ACTIVATION_SUGGEST_MEMBERS,
  ): Promise<{ villes: { id: string; name: string; slug: string; memberCount: number }[] }> {
    const villes = await this.prisma.city.findMany({
      where: {
        isActive: false,
        mergedIntoCityId: null,
        memberCount: { gte: threshold },
      },
      orderBy: [{ memberCount: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, memberCount: true },
      take: 100,
    });

    if (villes.length > 0) {
      this.logger.log(
        `${villes.length} ville(s) à activer (≥ ${threshold} membres) : ` +
          villes.map((v) => `${v.name} (${v.memberCount})`).join(', '),
      );
    }

    return { villes };
  }
}

/**
 * Le sujet d'une story `INFORMATION` est-il « démarches » (§2.3) ?
 *
 * `stories.category` est du texte libre : le module 04 ne fixe pas la liste des
 * sujets, seulement qu'elle existe. On compare donc sans casse ni accents, et sur
 * plusieurs écritures probables, plutôt que d'imposer une valeur exacte qui ferait
 * disparaître les Guichets du jour au premier libellé différent.
 */
export function isPaperworkSubject(category: string | null): boolean {
  if (category === null) return false;
  const normalized = category
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  return normalized.startsWith('demarche');

}
