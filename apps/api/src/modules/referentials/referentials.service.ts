import { Injectable, Logger } from '@nestjs/common';
import { newId, Prisma } from '@app/db';
import { isPilotCitySlug } from '@app/shared';
import type {
  CitiesAdminQuery,
  CreateCity,
  CreateCountry,
  CreateLanguage,
  CreateTagged,
  ImportCities,
  MergeCity,
  RefListQuery,
  RefReason,
  ReferentialList,
  UpdateCity,
  UpdateCountry,
  UpdateLanguage,
  UpdateTagged,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { AuditService } from '../../common/audit.service';
import { OutboxService } from '../../common/outbox.service';
import { PrismaService } from '../../common/prisma.service';
import type { StaffUser } from '../../common/staff.guard';
import { CommunitiesService } from '../communities/communities.service';

/**
 * Administration des référentiels — 02-referentiels.md §4.2.
 *
 * CE MODULE MANQUAIT ENTIÈREMENT, et c'était le blocage le plus concret du projet :
 * §2.2 dit qu'une ville « passe active quand l'équipe le décide, en général à
 * 20 membres », et qu'« à l'activation : création du `community` CITY, les membres
 * déjà rattachés y sont inscrits par événement ». Aucune route ne le faisait. Le
 * premier geste du jour du lancement — ouvrir la ville pilote — n'avait pas de
 * bouton, et le commentaire d'`ensureAutoCommunity` le disait déjà : l'événement
 * `city.activated` « que personne n'émet encore ».
 *
 * TOUTES les écritures sont tracées dans `audit_logs`, dans LEUR transaction
 * (§4.2, dernière ligne, et 15 §2.3). Une activation dont la trace manquerait
 * serait une décision sans auteur.
 */
@Injectable()
export class ReferentialsService {
  private readonly logger = new Logger(ReferentialsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly communities: CommunitiesService,
  ) {}

  // ── Listes simples : langues, compétences, métiers ─────────────────────────

  async listSimple(list: ReferentialList, query: RefListQuery) {
    const where = {
      ...(query.q === undefined ? {} : { nameFr: { contains: query.q, mode: 'insensitive' as const } }),
      /**
       * `is_active` N'EXISTE PAS SUR `languages`, et le filtre est donc ignoré là.
       *
       * 02 §2.3 exige pourtant qu'« une entrée `is_active = false` reste affichée
       * sur les profils qui l'ont déjà, mais n'est plus proposée » — pour les
       * langues AUTANT que pour les compétences et les métiers. La colonne manque
       * au schéma, signalée et non migrée : une langue ne peut donc pas être
       * retirée des propositions. Filtrer en silence sur une colonne absente
       * lèverait ; faire semblant de filtrer serait pire.
       */
      ...(list === 'languages' || query.active === undefined
        ? {}
        : { isActive: query.active === 'true' }),
    };

    if (list === 'languages') {
      const items = await this.prisma.language.findMany({
        where: query.q === undefined ? {} : { nameFr: { contains: query.q, mode: 'insensitive' } },
        orderBy: { nameFr: 'asc' },
        select: { id: true, code: true, nameFr: true },
      });
      return { items, nextCursor: null, meta: { deactivatable: false } };
    }

    /**
     * Deux appels plutôt qu'un délégué tenu dans une variable.
     *
     * `this.prisma.skill` et `this.prisma.profession` ont des signatures
     * génériques distinctes : leur union n'est pas appelable, et `tsc` le refuse.
     * Les forcer par un `as` ferait taire le compilateur sur exactement ce qu'il
     * sait mieux que nous — les deux tables ont les mêmes colonnes aujourd'hui,
     * rien ne garantit qu'elles les auront demain.
     */
    const args = {
      where,
      orderBy: [{ category: 'asc' as const }, { nameFr: 'asc' as const }],
      select: { id: true, nameFr: true, category: true, isActive: true },
    };
    const items =
      list === 'skills'
        ? await this.prisma.skill.findMany(args)
        : await this.prisma.profession.findMany(args);
    return { items, nextCursor: null, meta: { deactivatable: true } };
  }

  async createLanguage(staff: StaffUser, input: CreateLanguage) {
    const id = newId();
    await this.write(staff, 'ref.language_created', 'language', id, input, async (tx) => {
      await tx.language.create({ data: { id, code: input.code, nameFr: input.nameFr } });
    });
    return { id, ...input };
  }

  async updateLanguage(staff: StaffUser, id: string, input: UpdateLanguage) {
    const before = await this.prisma.language.findUnique({ where: { id }, select: { nameFr: true } });
    if (before === null) throw ApiError.notFound();
    await this.write(
      staff,
      'ref.language_updated',
      'language',
      id,
      { before: before.nameFr, after: input.nameFr },
      async (tx) => {
        await tx.language.update({ where: { id }, data: { nameFr: input.nameFr } });
      },
    );
    return { id, ...input };
  }

  async createTagged(staff: StaffUser, list: 'skills' | 'professions', input: CreateTagged) {
    const id = newId();
    const action = list === 'skills' ? 'ref.skill_created' : 'ref.profession_created';
    await this.write(staff, action, list === 'skills' ? 'skill' : 'profession', id, input, async (tx) => {
      const data = {
        id,
        nameFr: input.nameFr,
        isActive: input.isActive,
        ...(input.category === undefined ? {} : { category: input.category }),
      };
      if (list === 'skills') await tx.skill.create({ data });
      else await tx.profession.create({ data });
    });
    return { id, ...input };
  }

  async updateTagged(staff: StaffUser, list: 'skills' | 'professions', id: string, input: UpdateTagged) {
    const select = { nameFr: true, category: true, isActive: true };
    const before =
      list === 'skills'
        ? await this.prisma.skill.findUnique({ where: { id }, select })
        : await this.prisma.profession.findUnique({ where: { id }, select });
    if (before === null) throw ApiError.notFound();

    const action = list === 'skills' ? 'ref.skill_updated' : 'ref.profession_updated';
    await this.write(staff, action, list === 'skills' ? 'skill' : 'profession', id, { before, after: input }, async (tx) => {
      /**
       * UN SEUL objet, et non deux diffusions conditionnelles par champ.
       *
       * Deux `...(x ? { k } : {})` qui posent la même clé s'écrasent en silence —
       * ce motif a déjà produit un filtre de visibilité perdu et une fuite de
       * profils privés dans ce dépôt. Ici chaque clé n'apparaît qu'une fois.
       */
      const data = {
        ...(input.nameFr === undefined ? {} : { nameFr: input.nameFr }),
        ...(input.category === undefined ? {} : { category: input.category }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      };
      if (list === 'skills') await tx.skill.update({ where: { id }, data });
      else await tx.profession.update({ where: { id }, data });
    });
    return { id, ...before, ...input };
  }

  // ── Pays ───────────────────────────────────────────────────────────────────

  async listCountries() {
    const items = await this.prisma.country.findMany({
      orderBy: [{ sortOrder: 'asc' }, { nameFr: 'asc' }],
      select: {
        id: true,
        iso2: true,
        nameFr: true,
        dialCode: true,
        kind: true,
        isActive: true,
        sortOrder: true,
        _count: { select: { cities: true } },
      },
    });
    return {
      items: items.map((c) => ({ ...c, cityCount: c._count.cities, _count: undefined })),
      nextCursor: null,
    };
  }

  async createCountry(staff: StaffUser, input: CreateCountry) {
    const id = newId();
    await this.write(staff, 'ref.country_created', 'country', id, input, async (tx) => {
      // Inactif à la création : l'activation crée le réseau et inscrit les
      // membres (§2.2), c'est une décision à part et elle a sa route.
      await tx.country.create({ data: { id, ...input, isActive: false } });
    });
    return { id, ...input, isActive: false };
  }

  async updateCountry(staff: StaffUser, id: string, input: UpdateCountry) {
    const before = await this.prisma.country.findUnique({
      where: { id },
      select: { nameFr: true, dialCode: true, kind: true, sortOrder: true },
    });
    if (before === null) throw ApiError.notFound();
    await this.write(staff, 'ref.country_updated', 'country', id, { before, after: input }, async (tx) => {
      /**
       * Champ par champ, et non `data: input`.
       *
       * `exactOptionalPropertyTypes` distingue « propriété absente » de
       * « propriété à `undefined` », et Prisma refuse la seconde. Passer l'objet
       * tel quel écrirait `nameFr: undefined` dans la requête dès qu'un champ
       * n'est pas fourni. Chaque clé n'apparaît qu'une fois : deux diffusions pour
       * la même clé s'écraseraient en silence.
       */
      await tx.country.update({
        where: { id },
        data: {
          ...(input.nameFr === undefined ? {} : { nameFr: input.nameFr }),
          ...(input.dialCode === undefined ? {} : { dialCode: input.dialCode }),
          ...(input.kind === undefined ? {} : { kind: input.kind }),
          ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
        },
      });
    });
    return { id, ...before, ...input };
  }

  /**
   * §4.2 : « `POST /countries/:id/activate` — idem » (crée le réseau, inscrit les
   * membres).
   *
   * Le réseau de pays rassemble les membres par pays d'ORIGINE (07 §2.1), là où le
   * réseau de ville les rassemble par lieu de vie. Ce sont deux appartenances
   * distinctes, et un membre a les deux.
   */
  async activateCountry(staff: StaffUser, id: string, input: RefReason) {
    const country = await this.prisma.country.findUnique({
      where: { id },
      select: { id: true, iso2: true, isActive: true },
    });
    if (country === null) throw ApiError.notFound();
    if (country.isActive) throw ApiError.transverse('CONFLICT', { reason: 'pays déjà actif' });

    await this.prisma.$transaction(async (tx) => {
      await tx.country.update({ where: { id }, data: { isActive: true } });
      await this.record(tx, staff, 'ref.country_activated', 'country', id, {
        reason: input.reason,
        iso2: country.iso2,
      });
      await this.outbox.emit(tx, {
        type: 'country.activated',
        aggregateId: id,
        payload: { countryId: id, iso2: country.iso2, byStaffId: staff.staffId },
      });
    });

    // Le réseau naît APRÈS la validation : `ensureAutoCommunity` lit
    // `countries.is_active`, qui doit donc déjà être vrai en base.
    const community = await this.communities.ensureAutoCommunity('COUNTRY', id);
    return { countryId: id, isActive: true, communityId: community?.id ?? null };
  }

  // ── Villes ─────────────────────────────────────────────────────────────────

  async listCities(query: CitiesAdminQuery) {
    const where: Prisma.CityWhereInput = {
      ...(query.countryId === undefined ? {} : { countryId: query.countryId }),
      ...(query.active === undefined ? {} : { isActive: query.active === 'true' }),
      ...(query.q === undefined ? {} : { name: { contains: query.q, mode: 'insensitive' } }),
    };
    const items = await this.prisma.city.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      take: query.limit,
      select: {
        id: true,
        name: true,
        slug: true,
        region: true,
        latitude: true,
        longitude: true,
        isActive: true,
        memberCount: true,
        activatedAt: true,
        mergedIntoCityId: true,
        country: { select: { id: true, iso2: true, nameFr: true } },
      },
    });
    return {
      items: items.map((c) => ({
        ...c,
        latitude: Number(c.latitude),
        longitude: Number(c.longitude),
        /**
         * LA VILLE PILOTE, DÉSIGNÉE DANS LA LISTE — `PILOT_CITY_SLUG` (@app/shared).
         *
         * Le premier geste du jour du lancement est d'ouvrir UNE ville parmi 43 +
         * celles du Bénin et du Togo, toutes inactives et triées par nom. Sans
         * repère, l'opérateur doit se souvenir de l'arbitrage — et un mauvais clic
         * crée un réseau CITY et y inscrit des membres, ce qu'aucune route ne
         * défait.
         *
         * C'est un CALCUL, pas une colonne : la pilote est une décision produit qui
         * se change en une ligne de `@app/shared`, pas un état à écrire en base que
         * deux villes pourraient porter à la fois. `isActive` reste seul à dire ce
         * qui est ouvert : une pilote non ouverte est le cas normal avant le jour J.
         */
        isPilot: isPilotCitySlug(c.slug),
      })),
      nextCursor: null,
    };
  }

  async createCity(staff: StaffUser, input: CreateCity) {
    const country = await this.prisma.country.findUnique({
      where: { id: input.countryId },
      select: { kind: true, iso2: true },
    });
    if (country === null) throw ApiError.notFound();
    /**
     * UN PAYS `ORIGIN` PEUT AVOIR DES VILLES — décision du porteur du projet, qui
     * relâche 02 §2.2 (« les villes du pays d'origine ne sont pas modélisées en
     * V1 »).
     *
     * Ce refus existait ici, et il avait l'air juste. Le contourner en passant le
     * Bénin en `BOTH` a révélé pourquoi il fallait le retirer plutôt : `kind` porte
     * DEUX sens, et `BOTH` en change un second — la condition du niveau L2, dérivée
     * de `kind` par `phone_numbers.is_destination`. Un numéro béninois se mettait à
     * prouver une présence en France.
     *
     * On relâche donc la règle sur les VILLES et on laisse intacte celle qui décide
     * d'un NIVEAU. Ce qu'on perd : plus rien n'empêche de créer une ville sous un
     * pays où le produit n'ira jamais. C'est un contrôle de saisie, pas une règle
     * dure, et l'écran d'administration est le bon endroit pour le rendre.
     */
    const id = newId();
    await this.write(staff, 'ref.city_created', 'city', id, input, async (tx) => {
      await tx.city.create({
        data: {
          id,
          countryId: input.countryId,
          name: input.name,
          slug: input.slug,
          latitude: new Prisma.Decimal(input.latitude),
          longitude: new Prisma.Decimal(input.longitude),
          isActive: false,
          ...(input.region === undefined ? {} : { region: input.region }),
          ...(input.postalPrefix === undefined ? {} : { postalPrefix: input.postalPrefix }),
        },
      });
    });
    return { id, ...input, isActive: false };
  }

  async updateCity(staff: StaffUser, id: string, input: UpdateCity) {
    const before = await this.prisma.city.findUnique({
      where: { id },
      select: { name: true, region: true, countryId: true, postalPrefix: true },
    });
    if (before === null) throw ApiError.notFound();

    await this.write(staff, 'ref.city_updated', 'city', id, { before, after: input }, async (tx) => {
      await tx.city.update({
        where: { id },
        data: {
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.region === undefined ? {} : { region: input.region }),
          ...(input.countryId === undefined ? {} : { countryId: input.countryId }),
          ...(input.postalPrefix === undefined ? {} : { postalPrefix: input.postalPrefix }),
          ...(input.latitude === undefined ? {} : { latitude: new Prisma.Decimal(input.latitude) }),
          ...(input.longitude === undefined ? {} : { longitude: new Prisma.Decimal(input.longitude) }),
        },
      });
    });
    return { id };
  }

  /**
   * ACTIVER UNE VILLE — le geste du jour du lancement (§2.2).
   *
   * Trois effets, dans cet ordre, et l'ordre compte :
   *   1. `is_active` passe à vrai et `activated_at` est posé, dans une transaction
   *      avec sa trace d'audit ;
   *   2. le réseau CITY est créé — `ensureAutoCommunity` LIT `cities.is_active`,
   *      donc il faut que l'étape 1 soit validée, sinon il refuse de créer ;
   *   3. `city.activated` part, et son consommateur inscrit les membres déjà
   *      rattachés. §2.2 dit « par événement », et c'est ce qui permet à
   *      l'inscription de centaines de membres de ne pas tenir la transaction.
   *
   * `activated_at` n'est écrit QU'À LA PREMIÈRE activation. Une ville qu'on
   * réactive après une fermeture garde la date de son ouverture : c'est elle qu'on
   * cherche quand on demande depuis quand une ville existe.
   */
  async activateCity(staff: StaffUser, id: string, input: RefReason) {
    const city = await this.prisma.city.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        isActive: true,
        activatedAt: true,
        mergedIntoCityId: true,
        memberCount: true,
        country: { select: { kind: true, isActive: true, iso2: true } },
      },
    });
    if (city === null) throw ApiError.notFound();
    if (city.isActive) throw ApiError.transverse('CONFLICT', { reason: 'ville déjà active' });
    if (city.mergedIntoCityId !== null) {
      throw ApiError.transverse('CONFLICT', {
        reason: 'ville fusionnée : elle n’a plus d’existence propre',
      });
    }
    if (!city.country.isActive) {
      throw ApiError.transverse('CONFLICT', {
        reason: 'activez d’abord le pays : une ville d’un pays inactif n’apparaît nulle part',
        iso2: city.country.iso2,
      });
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.city.update({
        where: { id },
        data: { isActive: true, ...(city.activatedAt === null ? { activatedAt: now } : {}) },
      });
      await this.record(tx, staff, 'ref.city_activated', 'city', id, {
        reason: input.reason,
        slug: city.slug,
        memberCountAtActivation: city.memberCount,
      });
      await this.outbox.emit(tx, {
        type: 'city.activated',
        aggregateId: id,
        payload: { cityId: id, slug: city.slug, byStaffId: staff.staffId },
      });
    });

    const community = await this.communities.ensureAutoCommunity('CITY', id);
    return { cityId: id, isActive: true, communityId: community?.id ?? null };
  }

  async deactivateCity(staff: StaffUser, id: string, input: RefReason) {
    const city = await this.prisma.city.findUnique({
      where: { id },
      select: { isActive: true, slug: true },
    });
    if (city === null) throw ApiError.notFound();
    if (!city.isActive) throw ApiError.transverse('CONFLICT', { reason: 'ville déjà inactive' });

    /**
     * On NE supprime PAS le réseau de la ville.
     *
     * Une ville qu'on referme — par erreur, ou le temps de corriger ses données —
     * doit pouvoir rouvrir sans que ses membres aient perdu leurs sujets et leurs
     * annonces. Le réseau devient simplement inatteignable, puisque §2.2 dit
     * qu'« une ville inactive n'a ni réseau, ni carte, ni fiche ».
     */
    await this.write(staff, 'ref.city_deactivated', 'city', id, { reason: input.reason, slug: city.slug }, async (tx) => {
      await tx.city.update({ where: { id }, data: { isActive: false } });
    });
    return { cityId: id, isActive: false };
  }

  /**
   * FUSIONNER deux villes — irréversible (§2.2).
   *
   * « `merged_into_city_id` redirige tous les membres et contenus vers la ville
   * cible ; l'ancienne devient invisible. »
   *
   * La confirmation est le SLUG de la ville absorbée, tapé à la main. Un booléen
   * `confirm: true` aurait la force d'un bouton, c'est-à-dire aucune : taper le
   * slug est la seule confirmation qu'on ne donne pas par réflexe.
   *
   * Les membres sont déplacés DANS la transaction, et leur réseau est recalculé
   * APRÈS — un membre qui change de ville quitte le réseau de l'ancienne et rejoint
   * celui de la nouvelle, ce que `syncAutoMemberships` sait déjà faire, et qui ne
   * doit pas tenir la transaction pendant des centaines de membres.
   */
  async mergeCity(staff: StaffUser, id: string, input: MergeCity) {
    if (id === input.targetCityId) {
      throw ApiError.transverse('CONFLICT', { reason: 'une ville ne fusionne pas avec elle-même' });
    }
    const [source, target] = await Promise.all([
      this.prisma.city.findUnique({
        where: { id },
        select: { id: true, slug: true, name: true, mergedIntoCityId: true, memberCount: true },
      }),
      this.prisma.city.findUnique({
        where: { id: input.targetCityId },
        select: { id: true, slug: true, mergedIntoCityId: true },
      }),
    ]);
    if (source === null || target === null) throw ApiError.notFound();
    if (source.mergedIntoCityId !== null) {
      throw ApiError.transverse('CONFLICT', { reason: 'ville déjà fusionnée' });
    }
    if (target.mergedIntoCityId !== null) {
      /**
       * On refuse de fusionner VERS une ville elle-même fusionnée, au lieu de
       * suivre la chaîne. Suivre donnerait un résultat juste aujourd'hui et une
       * chaîne de redirections demain, que personne ne saurait plus lire.
       */
      throw ApiError.transverse('CONFLICT', {
        reason: 'la ville cible est elle-même fusionnée : visez sa cible',
        targetOfTarget: target.mergedIntoCityId,
      });
    }
    if (input.confirmSlug !== source.slug) {
      throw ApiError.validation([
        { path: 'confirmSlug', code: 'CUSTOM', message: `Tapez « ${source.slug} » pour confirmer.` },
      ]);
    }

    const moved = await this.prisma.$transaction(async (tx) => {
      const users = await tx.user.updateMany({
        where: { cityId: id },
        data: { cityId: input.targetCityId },
      });
      await tx.city.update({
        where: { id },
        data: { mergedIntoCityId: input.targetCityId, isActive: false },
      });
      await this.record(tx, staff, 'ref.city_merged', 'city', id, {
        reason: input.reason,
        from: source.slug,
        into: target.slug,
        usersMoved: users.count,
      });
      await this.outbox.emit(tx, {
        type: 'city.merged',
        aggregateId: id,
        payload: { cityId: id, targetCityId: input.targetCityId, byStaffId: staff.staffId },
      });
      return users.count;
    });

    return { cityId: id, targetCityId: input.targetCityId, usersMoved: moved };
  }

  /**
   * IMPORT CSV — `nom, région, latitude, longitude, pays` (§4.2).
   *
   * `apply: false` par défaut : on VALIDE et on rend le rapport sans rien écrire.
   * Importer des villes est le genre d'opération qu'on lance une fois sur un fichier
   * qu'on n'a pas relu, et un rapport avant écriture coûte une requête.
   *
   * Le slug est DÉRIVÉ du nom, sans accents. Le demander dans le fichier ferait
   * porter à l'opérateur une contrainte d'URL qui n'est pas son métier.
   */
  async importCities(staff: StaffUser, input: ImportCities) {
    const lines = input.csv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) throw ApiError.validation([{ path: 'csv', code: 'CUSTOM', message: 'Fichier vide.' }]);

    // Un en-tête est toléré et ignoré : un tableur en produit un par défaut.
    const first = lines[0]?.toLowerCase() ?? '';
    const rows = /latitude|longitude|pays/.test(first) ? lines.slice(1) : lines;

    const countries = new Map(
      (await this.prisma.country.findMany({ select: { id: true, iso2: true, kind: true } })).map((c) => [
        c.iso2,
        c,
      ]),
    );
    const existing = new Set(
      (await this.prisma.city.findMany({ select: { slug: true } })).map((c) => c.slug),
    );

    const accepted: { name: string; slug: string; region: string | null; latitude: number; longitude: number; iso2: string }[] = [];
    const rejected: { line: number; raw: string; reason: string }[] = [];

    rows.forEach((raw, index) => {
      const cells = raw.split(/[;,]/).map((c) => c.trim());
      const [name, region, lat, lon, iso2] = cells;
      const at = index + 1;
      if (name === undefined || lat === undefined || lon === undefined || iso2 === undefined) {
        rejected.push({ line: at, raw, reason: 'cinq colonnes attendues : nom, région, latitude, longitude, pays' });
        return;
      }
      const latitude = Number(lat.replace(',', '.'));
      const longitude = Number(lon.replace(',', '.'));
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
        rejected.push({ line: at, raw, reason: `latitude invalide : « ${lat} »` });
        return;
      }
      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        rejected.push({ line: at, raw, reason: `longitude invalide : « ${lon} »` });
        return;
      }
      const country = countries.get(iso2.toUpperCase());
      if (country === undefined) {
        rejected.push({ line: at, raw, reason: `pays inconnu : « ${iso2} »` });
        return;
      }
      const slug = slugify(name);
      if (slug.length < 2) {
        rejected.push({ line: at, raw, reason: `nom inexploitable : « ${name} »` });
        return;
      }
      if (existing.has(slug) || accepted.some((a) => a.slug === slug)) {
        rejected.push({ line: at, raw, reason: `ville déjà connue : « ${slug} »` });
        return;
      }
      accepted.push({
        name,
        slug,
        region: region === undefined || region === '' ? null : region,
        latitude,
        longitude,
        iso2: country.iso2,
      });
    });

    if (!input.apply) {
      return { applied: false, accepted: accepted.length, rejected, preview: accepted.slice(0, 20) };
    }

    await this.prisma.$transaction(async (tx) => {
      for (const row of accepted) {
        const country = countries.get(row.iso2);
        if (country === undefined) continue;
        await tx.city.create({
          data: {
            id: newId(),
            countryId: country.id,
            name: row.name,
            slug: row.slug,
            latitude: new Prisma.Decimal(row.latitude),
            longitude: new Prisma.Decimal(row.longitude),
            isActive: false,
            ...(row.region === null ? {} : { region: row.region }),
          },
        });
      }
      await this.record(tx, staff, 'ref.cities_imported', 'city', undefined, {
        accepted: accepted.length,
        rejected: rejected.length,
        slugs: accepted.map((a) => a.slug).slice(0, 50),
      });
    });

    this.logger.log(`Import de villes : ${accepted.length} créée(s), ${rejected.length} refusée(s).`);
    return { applied: true, accepted: accepted.length, rejected, preview: accepted.slice(0, 20) };
  }

  // ── Outils ─────────────────────────────────────────────────────────────────

  /**
   * Une écriture et sa trace, dans LA MÊME transaction (§4.2, 15 §2.3).
   *
   * Le raccourci existe parce qu'il y a quinze écritures dans ce fichier : écrire
   * la transaction à la main quinze fois, c'est quinze occasions d'en oublier la
   * trace — et une écriture d'administration sans trace est une décision sans
   * auteur.
   */
  private async write(
    staff: StaffUser,
    action: string,
    targetType: string,
    targetId: string,
    metadata: Prisma.InputJsonValue,
    run: (tx: Prisma.TransactionClient) => Promise<void>,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await run(tx);
      await this.record(tx, staff, action, targetType, targetId, metadata);
    });
  }

  private async record(
    tx: Prisma.TransactionClient,
    staff: StaffUser,
    action: string,
    targetType: string,
    targetId: string | undefined,
    metadata: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.audit.record(tx, {
      actor: { type: 'STAFF', id: staff.staffId },
      action,
      targetType,
      ...(targetId === undefined ? {} : { targetId }),
      metadata,
      ...(staff.ip === null ? {} : { ip: staff.ip }),
    });
  }
}

/**
 * Le slug d'une ville : minuscules, sans accents, tirets.
 *
 * `normalize('NFD')` puis suppression des diacritiques — « Kpalimé » devient
 * « kpalime », « Abomey-Calavi » devient « abomey-calavi ». C'est la même règle que
 * les slugs du seed, et elle doit le rester : deux règles donneraient deux slugs
 * pour la même ville selon qu'elle vient du fichier de départ ou d'un import.
 */
function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
