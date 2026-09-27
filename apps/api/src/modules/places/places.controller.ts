import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { PrismaService } from '../../common/prisma.service';
import { PublicRead } from '../../common/capability.decorator';
import { zodPipe } from '../../common/zod.pipe';

/**
 * Module 02 — Référentiels. Lecture seule, mise en cache 1 h côté client.
 *
 * Aucune écriture membre : ces listes sont administrées par l'équipe (02 §1).
 *
 * RÈGLE (02 §2.1) : un pays inactif n'apparaît NULLE PART côté membres — ni à
 * l'inscription, ni dans les filtres, ni sur la carte. Le filtre `is_active` est
 * donc appliqué ici, dans le dépôt, et non laissé au front.
 *
 * Lancement mono-pays : un seul ORIGIN actif et un seul DESTINATION actif.
 * Activer un second pays est une écriture en back-office, jamais un déploiement —
 * d'où l'absence totale de constante de pays dans ce code.
 */

const citiesQuery = z.object({
  countryId: z.string().uuid().optional(),
  /** `false` inclut les villes inactives : nécessaire à l'onboarding, où le
   *  membre doit pouvoir indiquer où il vit même sans réseau ouvert (02 §2.2). */
  activeOnly: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
});

@ApiTags('places')
@Controller('places')
export class PlacesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('countries')
  @PublicRead()
  @ApiOperation({ summary: 'Pays actifs, origine et destination' })
  async countries() {
    const items = await this.prisma.country.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { nameFr: 'asc' }],
      select: { id: true, iso2: true, nameFr: true, dialCode: true, kind: true },
    });
    return { items, nextCursor: null };
  }

  @Get('cities')
  @PublicRead()
  @ApiOperation({ summary: 'Villes d’un pays de destination' })
  async cities(@Query(zodPipe(citiesQuery)) query: z.infer<typeof citiesQuery>) {
    const items = await this.prisma.city.findMany({
      where: {
        ...(query.activeOnly ? { isActive: true } : {}),
        ...(query.countryId === undefined ? {} : { countryId: query.countryId }),
        // Une ville fusionnée n'existe plus pour personne (02 §2.2).
        mergedIntoCityId: null,
      },
      orderBy: [{ memberCount: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        region: true,
        isActive: true,
        memberCount: true,
      },
    });
    return { items, nextCursor: null };
  }

  @Get('languages')
  @PublicRead()
  @ApiOperation({ summary: 'Langues proposées au profil' })
  async languages() {
    const items = await this.prisma.language.findMany({
      orderBy: { nameFr: 'asc' },
      select: { id: true, code: true, nameFr: true },
    });
    return { items, nextCursor: null };
  }

  @Get('skills')
  @PublicRead()
  @ApiOperation({ summary: 'Compétences proposées au profil' })
  async skills() {
    const items = await this.prisma.skill.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { nameFr: 'asc' }],
      select: { id: true, nameFr: true, category: true },
    });
    return { items, nextCursor: null };
  }

  @Get('professions')
  @PublicRead()
  @ApiOperation({ summary: 'Métiers de l’annuaire professionnel' })
  async professions() {
    const items = await this.prisma.profession.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { nameFr: 'asc' }],
      select: { id: true, nameFr: true, category: true },
    });
    return { items, nextCursor: null };
  }
}
