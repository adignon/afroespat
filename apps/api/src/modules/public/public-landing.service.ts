import { Injectable } from '@nestjs/common';
import {
  LANDING_MIN_GUIDES,
  LANDING_MIN_HELP_REQUESTS,
  LANDING_MIN_MEMBERS,
  PUBLIC_SEARCH_LIMIT,
  median,
  shortName,
  type PublicCommunityAbout,
  type PublicLanding,
  type PublicSearchQuery,
  type PublicSearchResponse,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { PrismaService } from '../../common/prisma.service';

const contient = (q: string) => ({ contains: q, mode: 'insensitive' as const });
/** Un chiffre n'est montré qu'au-dessus du seuil de membres (voir `LANDING_MIN_MEMBERS`). */
const sinon = (n: number): number | null => (n >= LANDING_MIN_MEMBERS ? n : null);

/** La page d'accueil se recalcule au plus toutes les cinq minutes : c'est une vitrine, pas un tableau de bord. */
const DUREE_CACHE_MS = 5 * 60_000;

/**
 * Ce qu'un visiteur sans compte peut lire (voir `@app/shared` → `public-landing.ts`). Rien ici ne contourne une règle
 * de visibilité : on ne lit que des contenus déjà publics (guides publiés, événements ouverts, villes actives) et la
 * fiche « À propos » des réseaux de ville PUBLICS créés automatiquement. Un réseau privé répond comme un réseau qui
 * n'existe pas.
 */
@Injectable()
export class PublicLandingService {
  private cache: { readonly at: number; readonly value: PublicLanding } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async landing(now: Date = new Date()): Promise<PublicLanding> {
    if (this.cache !== null && now.getTime() - this.cache.at < DUREE_CACHE_MS) return this.cache.value;
    const value = await this.compute(now);
    this.cache = { at: now.getTime(), value };
    return value;
  }

  private async compute(now: Date): Promise<PublicLanding> {
    const membres = await this.prisma.user.count({ where: { status: 'ACTIVE', deletedAt: null } });
    const assezDeMembres = membres >= LANDING_MIN_MEMBERS;

    // ── Compteurs : nuls sous le seuil.
    const villes = await this.prisma.city.count({ where: { isActive: true } });
    const parPays = await this.prisma.user.groupBy({
      by: ['originCountryId'],
      where: { status: 'ACTIVE', deletedAt: null },
      _count: { _all: true },
    });
    const pays = await this.prisma.country.findMany({
      where: { id: { in: parPays.map((p) => p.originCountryId) } },
      select: { nameFr: true },
      orderBy: { nameFr: 'asc' },
    });

    // ── Entraide : sur les 90 derniers jours, avec un minimum de demandes.
    const depuis = new Date(now.getTime() - 90 * 86_400_000);
    const demandes = await this.prisma.helpRequest.findMany({
      where: { createdAt: { gte: depuis }, deletedAt: null },
      select: { id: true, createdAt: true, status: true },
    });
    let delaiMedian: number | null = null;
    let tauxResolu: number | null = null;
    if (assezDeMembres && demandes.length >= LANDING_MIN_HELP_REQUESTS) {
      const premieres = await this.prisma.helpResponse.groupBy({
        by: ['helpRequestId'],
        where: { helpRequestId: { in: demandes.map((d) => d.id) }, deletedAt: null },
        _min: { createdAt: true },
      });
      const parDemande = new Map(premieres.map((p) => [p.helpRequestId, p._min.createdAt]));
      const delais = demandes.flatMap((d) => {
        const premiere = parDemande.get(d.id);
        return premiere === undefined || premiere === null ? [] : [Math.max(0, (premiere.getTime() - d.createdAt.getTime()) / 60_000)];
      });
      delaiMedian = median(delais);
      tauxResolu = Math.round((100 * demandes.filter((d) => d.status === 'RESOLVED').length) / demandes.length);
    }
    const guides = await this.prisma.guide.count({ where: { status: 'PUBLISHED', deletedAt: null } });

    // ── Événements ouverts : à venir, hors réseau privé.
    const evenements = await this.prisma.event.findMany({
      where: {
        status: 'SCHEDULED',
        deletedAt: null,
        startsAt: { gte: now },
        OR: [{ communityId: null }, { community: { is: { visibility: 'PUBLIC' } } }],
      },
      orderBy: { startsAt: 'asc' },
      take: 4,
      select: {
        id: true,
        title: true,
        type: true,
        startsAt: true,
        attendeeCount: true,
        city: { select: { name: true } },
        community: { select: { name: true } },
        organizer: { select: { displayName: true } },
      },
    });

    // ── Villes actives.
    const listeVilles = await this.prisma.city.findMany({
      where: { isActive: true, mergedIntoCityId: null },
      orderBy: [{ memberCount: 'desc' }, { name: 'asc' }],
      take: 8,
      select: { slug: true, name: true, memberCount: true },
    });

    // ── Citations approuvées, non retirées : la source garde son auteur.
    const citations = await this.prisma.impactQuote.findMany({
      where: { approvedByStaffId: { not: null }, withdrawnAt: null },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        id: true,
        quote: true,
        guide: { select: { title: true, author: { select: { displayName: true, status: true } } } },
        cityTip: { select: { author: { select: { displayName: true, status: true } } } },
        city: { select: { name: true } },
      },
    });

    return {
      stats: {
        members: assezDeMembres ? membres : null,
        cities: assezDeMembres ? villes : null,
        countries: assezDeMembres ? pays.length : null,
        countryNames: assezDeMembres ? pays.map((p) => p.nameFr) : [],
      },
      entraide: {
        medianFirstReplyMinutes: delaiMedian,
        resolvedPercent: tauxResolu,
        publishedGuides: guides >= LANDING_MIN_GUIDES ? guides : null,
      },
      events: evenements.map((e) => ({
        id: e.id,
        title: e.title,
        startsAt: e.startsAt.toISOString(),
        type: e.type,
        cityName: e.city.name,
        by: e.community?.name ?? shortName(e.organizer.displayName),
        attendeeCount: e.attendeeCount,
      })),
      cities: listeVilles.map((v) => ({ slug: v.slug, name: v.name, memberCount: sinon(v.memberCount) })),
      quotes: citations.map((c) => {
        const auteur = c.guide?.author ?? c.cityTip?.author ?? null;
        return {
          id: c.id,
          text: c.quote,
          authorName: auteur !== null && auteur.status === 'ACTIVE' ? shortName(auteur.displayName) : null,
          context: c.guide?.title ?? c.city?.name ?? null,
        };
      }),
      generatedAt: now.toISOString(),
    };
  }

  /** La recherche d'un visiteur : guides publiés, réseaux de ville publics, villes actives. Minimale, sans compte. */
  async search(query: PublicSearchQuery): Promise<PublicSearchResponse> {
    const q = query.q;
    const ville =
      query.city === undefined
        ? null
        : await this.prisma.city.findFirst({ where: { slug: query.city, isActive: true }, select: { id: true } });
    // Une ville inconnue ne restreint rien : elle ne doit pas faire croire qu'il n'y a pas de résultat.
    const villeId = ville?.id;

    const guides = await this.prisma.guide.findMany({
      where: {
        status: 'PUBLISHED',
        deletedAt: null,
        title: contient(q),
        ...(villeId === undefined ? {} : { OR: [{ cityId: null }, { cityId: villeId }] }),
      },
      orderBy: [{ helpfulCount: 'desc' }, { createdAt: 'desc' }],
      take: PUBLIC_SEARCH_LIMIT,
      select: { slug: true, title: true, category: true, helpfulCount: true, city: { select: { name: true } } },
    });
    const communautes = await this.prisma.community.findMany({
      where: {
        ...this.reseauPublicDeVille(),
        name: contient(q),
        ...(villeId === undefined ? {} : { cityId: villeId }),
      },
      orderBy: { memberCount: 'desc' },
      take: PUBLIC_SEARCH_LIMIT,
      select: { id: true, name: true, memberCount: true, city: { select: { name: true } } },
    });
    const villes = await this.prisma.city.findMany({
      where: { isActive: true, mergedIntoCityId: null, name: contient(q) },
      orderBy: { name: 'asc' },
      take: PUBLIC_SEARCH_LIMIT,
      select: { slug: true, name: true },
    });

    return {
      guides: guides.map((g) => ({
        slug: g.slug,
        title: g.title,
        category: g.category,
        helpfulCount: g.helpfulCount,
        cityName: g.city?.name ?? null,
      })),
      communities: communautes.map((c) => ({
        id: c.id,
        name: c.name,
        cityName: c.city?.name ?? null,
        memberCount: sinon(c.memberCount),
      })),
      cities: villes,
    };
  }

  /**
   * La fiche « À propos » d'un réseau de ville PUBLIC créé automatiquement — et rien de plus. Tout autre réseau (privé,
   * sur demande, de pays, créé par un membre, archivé) répond 404, comme un réseau inexistant.
   */
  async communityAbout(id: string): Promise<PublicCommunityAbout> {
    const reseau = await this.prisma.community.findFirst({
      where: { id, ...this.reseauPublicDeVille() },
      select: { id: true, name: true, description: true, memberCount: true, createdAt: true, city: { select: { name: true } } },
    });
    if (reseau === null) throw ApiError.notFound();

    const equipe = await this.prisma.communityMember.findMany({
      where: {
        communityId: id,
        role: { in: ['OWNER', 'MODERATOR'] },
        status: 'ACTIVE',
        user: { is: { status: 'ACTIVE', deletedAt: null } },
      },
      orderBy: { createdAt: 'asc' },
      take: 5,
      select: { role: true, user: { select: { displayName: true } } },
    });

    return {
      id: reseau.id,
      name: reseau.name,
      cityName: reseau.city?.name ?? null,
      description: reseau.description,
      memberCount: sinon(reseau.memberCount),
      foundedYear: reseau.createdAt.getUTCFullYear(),
      moderators: equipe.flatMap((m) =>
        m.role === 'OWNER' || m.role === 'MODERATOR' ? [{ name: shortName(m.user.displayName), role: m.role }] : [],
      ),
    };
  }

  /** Le seul type de réseau qu'un visiteur peut voir : ceux que l'activation d'une ville crée toute seule. */
  private reseauPublicDeVille() {
    return {
      kind: 'CITY' as const,
      visibility: 'PUBLIC' as const,
      status: 'ACTIVE' as const,
      createdByUserId: null,
    };
  }
}
