import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { PrismaService } from '../../common/prisma.service';
import { PublicRead, RequiresCapability } from '../../common/capability.decorator';
import { Auth, MaybeAuth, type AuthContext } from '../../common/auth.guard';
import { newId } from '@app/db';
import { ApiError } from '../../common/api-error';
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

/**
 * Le nom d'une compétence écrite à la main.
 *
 * Soixante caractères : les soixante compétences semées vont de « Excel » à
 * « Électricité générale », la plus longue en faisant 21. La borne laisse trois
 * fois cette place sans ouvrir un champ libre de taille indéfinie dans un
 * référentiel.
 */
const skillCreate = z.object({ nameFr: z.string().trim().min(2).max(60) }).strict();
type SkillCreate = z.infer<typeof skillCreate>;

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
      select: {
        id: true,
        iso2: true,
        nameFr: true,
        dialCode: true,
        kind: true,
        // L'écran valide le numéro AVANT d'envoyer un SMS : il lui faut la règle.
        phoneNationalLength: true,
      },
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
        countryId: true,
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

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LES COMPÉTENCES GLOBALES, PLUS LES SIENNES                              ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « On a donc un createdBy si c'est uniquement pour cet
   * utilisateur. Les autres pourront le voir sur son profil mais pas le choisir
   * dans le champ des compétences. Mais quand c'est globalisé tout le monde y a
   * accès. »
   *
   * `created_by_user_id IS NULL` veut dire GLOBALE — c'est l'état des soixante
   * compétences semées, qui n'appartiennent à personne. Cette liste rend donc les
   * globales, PLUS celles que le lecteur a écrites lui-même. Celles d'un autre
   * membre n'y figurent jamais ; elles restent visibles sur SON profil, que
   * `GET /users/{pseudo}` sert depuis `user_skills` sans passer par ici.
   *
   * `@MaybeAuth()` et non `@Auth()` : la liste reste lisible sans session — on
   * n'y voit alors que les globales, ce qui est exact. `@Auth()` LÈVERAIT, et
   * c'est le faux pas que `media.controller.ts` documente déjà.
   */
  @Get('skills')
  @PublicRead()
  @ApiOperation({ summary: 'Compétences proposées au profil (globales + les siennes)' })
  async skills(@MaybeAuth() auth: AuthContext | null) {
    const mien = auth?.userId ?? null;
    const items = await this.prisma.skill.findMany({
      where: {
        isActive: true,
        ...(mien === null
          ? { createdByUserId: null }
          : { OR: [{ createdByUserId: null }, { createdByUserId: mien }] }),
      },
      orderBy: [{ category: 'asc' }, { nameFr: 'asc' }],
      select: { id: true, nameFr: true, category: true },
    });
    return { items, nextCursor: null };
  }

  /**
   * ÉCRIRE SA PROPRE COMPÉTENCE — « le free typing qui crée de nouvelles
   * compétences ».
   *
   * ── CE QUE LA ROUTE NE FAIT PAS, ET POURQUOI ──────────────────────────────
   *
   * Elle ne crée PAS de doublon. `skills.name_fr` est UNIQUE : si le nom existe
   * déjà — globale, ou écrite par ce membre, ou par un autre — on rend la ligne
   * existante au lieu d'échouer. Rendre la ligne d'un AUTRE membre serait une
   * fuite : on vérifie donc, et dans ce seul cas on refuse.
   *
   * Elle n'ACTIVE pas une compétence pour tout le monde : `isActive` est vrai
   * (sans quoi le membre ne la verrait pas lui-même) mais `createdByUserId` la
   * borne à son auteur. La globalisation est un geste d'ÉQUIPE, en back-office.
   *
   * `content.read` est la capacité des écritures de profil dans ce dépôt —
   * `PATCH /me` et `PUT /me/avatar` la portent déjà. Une compétence écrite à la
   * main est une donnée de profil, pas une publication.
   */
  @Post('skills')
  @RequiresCapability('content.read')
  @ApiOperation({ summary: 'Créer une compétence à soi (globalisable par l’équipe)' })
  async createSkill(@Auth() auth: AuthContext, @Body(zodPipe(skillCreate)) body: SkillCreate) {
    const nameFr = body.nameFr.trim();
    const existante = await this.prisma.skill.findUnique({
      where: { nameFr },
      select: { id: true, nameFr: true, category: true, createdByUserId: true, isActive: true },
    });

    if (existante !== null) {
      /**
       * Une compétence d'un AUTRE membre porte le nom demandé. La rendre
       * dirait au lecteur qu'elle est à lui, et la lui laisserait choisir —
       * exactement ce que le porteur exclut. On refuse par le même code que le
       * reste du dépôt pour un conflit de nom.
       */
      const aMoi = existante.createdByUserId === null || existante.createdByUserId === auth.userId;
      if (!aMoi) throw ApiError.transverse('CONFLICT', { reason: 'SKILL_NAME_TAKEN' });
      return { id: existante.id, nameFr: existante.nameFr, category: existante.category };
    }

    const cree = await this.prisma.skill.create({
      data: {
        id: newId(),
        nameFr,
        category: null,
        isActive: true,
        createdByUserId: auth.userId,
      },
      select: { id: true, nameFr: true, category: true },
    });
    return cree;
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
