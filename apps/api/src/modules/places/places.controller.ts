import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { PrismaService } from '../../common/prisma.service';
import { PublicRead, RateLimit, RequiresCapability } from '../../common/capability.decorator';
import { Auth, MaybeAuth, type AuthContext } from '../../common/auth.guard';
import { newId } from '@app/db';
import { ApiError } from '../../common/api-error';
import { zodPipe } from '../../common/zod.pipe';
import {
  MEMBER_SKILLS_MAX,
  cleCompetence,
  createPlacesSkillSchema,
  type CreatePlacesSkill,
} from '@app/shared';

/**
 * Module 02 — Référentiels. Lecture seule, mise en cache 1 h côté client — à UNE exception :
 * `POST /places/skills`, par lequel un membre écrit SA compétence (elle reste à lui tant que
 * l'équipe ne l'a pas globalisée en back-office).
 *
 * Ces listes sont administrées par l'équipe (02 §1).
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
   * ── LES RÈGLES, DANS L'ORDRE OÙ ELLES S'APPLIQUENT ─────────────────────────
   *
   * 1. LA FORME (`createPlacesSkillSchema`, dans `@app/shared`) : 2 à 60 caractères, des
   *    lettres, des chiffres et quelques signes simples, une lettre au moins, ni lien ni
   *    adresse ni numéro de téléphone (01 §2.1 — la compétence s'affiche sur le profil public).
   *    Les espaces sont normalisés AVANT la validation : « Soudure   TIG » et « Soudure TIG »
   *    sont le même nom.
   *
   * 2. LA DÉDUPLICATION, sans casse ni accent (`cleCompetence`). `skills.name_fr` est unique à
   *    l'octet près, ce qui laissait passer « excel » à côté d'« Excel ». On compare donc la
   *    clé du nom à celle des compétences que le membre PEUT CHOISIR — les globales et les
   *    siennes — et on rend la ligne existante au lieu d'en créer une seconde : pas de doublon,
   *    et le membre obtient quand même ce qu'il voulait. Une compétence GLOBALE que l'équipe a
   *    retirée des propositions (`is_active` faux) n'est pas ressuscitée : `409 SKILL_RETIRED`.
   *
   * 3. LE PLAFOND : `MEMBER_SKILLS_MAX` compétences personnelles par membre. Un profil n'en
   *    retient que dix ; au-delà, c'est une boucle qui remplit le référentiel.
   *    `409 SKILL_LIMIT`, avec le plafond dans `details`.
   *
   * 4. LA COLLISION D'UN AUTRE MEMBRE : si le nom EXACT est celui de la compétence personnelle
   *    d'un autre membre, la rendre dirait au lecteur qu'elle est à lui — exactement ce que le
   *    porteur exclut. `409 SKILL_NAME_TAKEN`. (Un nom qui ne diffère que par la casse ou les
   *    accents, lui, est créé : il n'y a pas de fuite, la ligne est à son auteur.)
   *
   * ── CE QUE LA ROUTE NE FAIT PAS ──────────────────────────────────────────
   *
   * Elle n'ACTIVE pas une compétence pour tout le monde : `isActive` est vrai (sans quoi le
   * membre ne la verrait pas lui-même) mais `createdByUserId` la borne à son auteur. La
   * globalisation est un geste d'ÉQUIPE, en back-office (D08), et c'est aussi la MODÉRATION :
   * aucune compétence personnelle n'est proposée à un autre membre avant qu'elle l'ait relue.
   * Avant cela, elle n'est vue que sur le profil de son auteur, où le signalement d'un
   * profil (13) s'applique comme pour toute autre mention libre.
   *
   * ── NIVEAU ET DÉBIT ─────────────────────────────────────────────────────
   *
   * `content.read` (L0) est la capacité des écritures de profil dans ce dépôt — `PATCH /me` et
   * `PUT /me/avatar` la portent déjà, et l'inscription (O04) appelle cette route avant même
   * qu'un compte soit vérifié. Une compétence est une donnée de profil, pas une publication.
   * Le débit est de dix créations par heure et par membre : bien au-dessus d'un usage réel
   * (le plafond de vingt ne s'atteint pas en une séance), bien en dessous d'un script.
   */
  @Post('skills')
  @RequiresCapability('content.read')
  @RateLimit(10, 'hour')
  @ApiOperation({ summary: 'Créer une compétence à soi (globalisable par l’équipe)' })
  async createSkill(
    @Auth() auth: AuthContext,
    @Body(zodPipe(createPlacesSkillSchema)) body: CreatePlacesSkill,
  ) {
    const nameFr = body.nameFr;
    const cle = cleCompetence(nameFr);
    const choix = { id: true, nameFr: true, category: true, createdByUserId: true, isActive: true } as const;

    // Les compétences que ce membre peut choisir : les globales et les siennes (actives ou non,
    // pour reconnaître une globale retirée). Quatre-vingts lignes au plus.
    const visibles = await this.prisma.skill.findMany({
      where: { OR: [{ createdByUserId: null }, { createdByUserId: auth.userId }] },
      select: choix,
    });
    const memeCle = visibles.find((s) => cleCompetence(s.nameFr) === cle);
    if (memeCle !== undefined) {
      if (!memeCle.isActive) throw ApiError.transverse('CONFLICT', { reason: 'SKILL_RETIRED' });
      return { id: memeCle.id, nameFr: memeCle.nameFr, category: memeCle.category };
    }

    const miennes = visibles.filter((s) => s.createdByUserId === auth.userId && s.isActive).length;
    if (miennes >= MEMBER_SKILLS_MAX) {
      throw ApiError.transverse('CONFLICT', { reason: 'SKILL_LIMIT', max: MEMBER_SKILLS_MAX });
    }

    // Le nom EXACT d'un autre membre : l'index unique le refuserait de toute façon, et on veut le
    // dire d'un code lisible plutôt que d'une erreur de base.
    const exacte = await this.prisma.skill.findUnique({ where: { nameFr }, select: { id: true } });
    if (exacte !== null) throw ApiError.transverse('CONFLICT', { reason: 'SKILL_NAME_TAKEN' });

    try {
      return await this.prisma.skill.create({
        data: { id: newId(), nameFr, category: null, isActive: true, createdByUserId: auth.userId },
        select: { id: true, nameFr: true, category: true },
      });
    } catch (cause) {
      // Deux envois simultanés du même nom : le second perd la course sur l'index unique.
      if (typeof cause === 'object' && cause !== null && (cause as { code?: string }).code === 'P2002') {
        throw ApiError.transverse('CONFLICT', { reason: 'SKILL_NAME_TAKEN' });
      }
      throw cause;
    }
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
