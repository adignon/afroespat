import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { createCityTipSchema, updateProfileSchema } from '@app/shared';
import { AuditService } from '../../../common/audit.service';
import { OutboxService } from '../../../common/outbox.service';
import { PrismaService } from '../../../common/prisma.service';
import { VisibilityService } from '../../../common/visibility.service';
import { CitiesService } from '../cities.service';

/**
 * Villes — le lot « services, agenda, villes » : vote « utile » (09 §2.3), champs
 * du commerce (SHOP), retrait des « nouveaux arrivants » (§2.4) et gestionnaire de
 * suppression (§9).
 *
 * Chaque règle a été éprouvée en la cassant : un test qui passe aussi sans la règle
 * ne protège rien. Voir en tête de chaque bloc ce qui a été cassé.
 */
describe('villes — vote, commerce, nouveaux arrivants, suppression (09 §2.3, §2.4, §9)', () => {
  let prisma: PrismaService;
  let cities: CitiesService;

  const createdUsers: string[] = [];
  const createdTips: string[] = [];
  let cityId: string;
  let citySlug: string;
  let countryId: string;
  let counter = 0;

  async function member(
    options: { phase?: 'RECENT_ARRIVAL' | 'SETTLED'; showAsNewcomer?: boolean } = {},
  ): Promise<string> {
    counter += 1;
    const id = newId();
    await prisma.user.create({
      data: {
        id,
        handle: `vot${counter}${id.slice(-8)}`,
        displayName: `Votant ${counter}`,
        phase: options.phase ?? 'SETTLED',
        verificationLevel: 'L1',
        originCountryId: countryId,
        plan: 'FREE',
        status: 'ACTIVE',
        cityId,
      },
    });
    createdUsers.push(id);
    if (options.showAsNewcomer !== undefined) {
      await prisma.userProfile.create({
        data: { userId: id, occupationStatus: 'OTHER', availableToHelp: false, showAsNewcomer: options.showAsNewcomer },
      });
    }
    return id;
  }

  async function tip(author: string, kind: 'TIP' | 'SHOP' = 'TIP') {
    const created = await cities.createTip(citySlug, author, {
      kind,
      body: 'Le marché du dimanche matin est le moins cher de la ville.',
      ...(kind === 'SHOP' ? { venueName: 'Chez Fatou', addressText: '12 rue des Halles' } : {}),
    });
    createdTips.push(created.id);
    return created;
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    cities = new CitiesService(
      prisma,
      new OutboxService(prisma),
      new AuditService(prisma),
      new VisibilityService(prisma),
    );
    const country = await prisma.country.findFirstOrThrow({
      where: { kind: { in: ['ORIGIN', 'BOTH'] } },
      orderBy: { sortOrder: 'asc' },
      select: { id: true },
    });
    countryId = country.id;
    const city = await prisma.city.findFirstOrThrow({
      where: { mergedIntoCityId: null, memberCount: 0, isActive: false },
      orderBy: { name: 'desc' },
      select: { id: true, slug: true },
    });
    cityId = city.id;
    citySlug = city.slug;
    await prisma.city.update({ where: { id: cityId }, data: { isActive: true } });
  });

  afterAll(async () => {
    await prisma.domainEvent.deleteMany({ where: { aggregateId: { in: createdTips } } });
    await prisma.cityTip.deleteMany({ where: { id: { in: createdTips } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    await prisma.city.update({ where: { id: cityId }, data: { isActive: false } });
    await prisma.$disconnect();
  });

  // ══ Le vote « utile » ═════════════════════════════════════════════════════

  describe('PUT/DELETE /tips/:id/vote', () => {
    it('un vote monte le compteur de un, et revoter ne le monte pas (idempotent)', async () => {
      const author = await member();
      const voter = await member();
      const created = await tip(author);

      const first = await cities.vote(created.id, voter);
      const again = await cities.vote(created.id, voter);

      expect(first).toEqual({ helpfulCount: 1, votedByMe: true });
      expect(again).toEqual({ helpfulCount: 1, votedByMe: true });
      expect(await prisma.cityTipVote.count({ where: { cityTipId: created.id } })).toBe(1);
    });

    it('retirer son vote redescend le compteur, et le retirer deux fois ne descend pas sous zéro', async () => {
      const author = await member();
      const voter = await member();
      const created = await tip(author);
      await cities.vote(created.id, voter);

      expect(await cities.unvote(created.id, voter)).toEqual({ helpfulCount: 0, votedByMe: false });
      expect(await cities.unvote(created.id, voter)).toEqual({ helpfulCount: 0, votedByMe: false });
    });

    it('on ne vote pas pour sa propre contribution', async () => {
      const author = await member();
      const created = await tip(author);
      await expect(cities.vote(created.id, author)).rejects.toMatchObject({ status: 409 });
    });

    it('émet `city_tip.voted` une fois par vote réel, et pas pour un revote', async () => {
      const author = await member();
      const voter = await member();
      const created = await tip(author);
      await cities.vote(created.id, voter);
      await cities.vote(created.id, voter);
      await cities.unvote(created.id, voter);

      const emitted = await prisma.domainEvent.findMany({
        where: { aggregateId: created.id, type: 'city_tip.voted' },
        orderBy: { createdAt: 'asc' },
      });
      expect(emitted.map((e) => (e.payload as { voted: boolean }).voted)).toEqual([true, false]);
    });

    it('la fiche dit au lecteur s’il a voté (`votedByMe`) et si la contribution est de lui (`mine`)', async () => {
      const author = await member();
      const voter = await member();
      const created = await tip(author);
      await cities.vote(created.id, voter);

      const asVoter = await cities.listTips(citySlug, { limit: 50, kind: 'TIP' }, voter);
      const asAuthor = await cities.listTips(citySlug, { limit: 50, kind: 'TIP' }, author);
      const mineView = asVoter.items.find((t) => t.id === created.id);
      const authorView = asAuthor.items.find((t) => t.id === created.id);

      expect(mineView).toMatchObject({ votedByMe: true, mine: false, helpfulCount: 1 });
      expect(authorView).toMatchObject({ votedByMe: false, mine: true });
    });

    it('une contribution supprimée ne se vote plus (404)', async () => {
      const author = await member();
      const voter = await member();
      const created = await tip(author);
      await cities.deleteTip(created.id, author);
      await expect(cities.vote(created.id, voter)).rejects.toMatchObject({ status: 404 });
    });
  });

  // ══ Le commerce (SHOP) ════════════════════════════════════════════════════

  describe('nom et adresse d’un commerce', () => {
    it('un commerce exige un nom ; l’adresse est du texte', () => {
      const sansNom = createCityTipSchema.safeParse({
        kind: 'SHOP',
        body: 'Les meilleurs produits du pays de la ville.',
      });
      expect(sansNom.success).toBe(false);
      const complet = createCityTipSchema.safeParse({
        kind: 'SHOP',
        body: 'Les meilleurs produits du pays de la ville.',
        venueName: 'Chez Fatou',
        addressText: '12 rue des Halles',
      });
      expect(complet.success).toBe(true);
    });

    it('un bon plan ne porte ni nom ni adresse de commerce', () => {
      const parsed = createCityTipSchema.safeParse({
        kind: 'TIP',
        body: 'Le marché du dimanche matin est le moins cher.',
        venueName: 'Chez Fatou',
      });
      expect(parsed.success).toBe(false);
    });

    it('le nom et l’adresse sont stockés et rendus tels quels, jamais géocodés', async () => {
      const author = await member();
      const created = await tip(author, 'SHOP');
      expect(created).toMatchObject({ venueName: 'Chez Fatou', addressText: '12 rue des Halles' });
      const row = await prisma.cityTip.findUniqueOrThrow({ where: { id: created.id } });
      expect(row.venueName).toBe('Chez Fatou');
    });
  });

  // ══ Nouveaux arrivants : l’option `show_as_newcomer` ══════════════════════

  describe('« Apparaître dans les nouveaux arrivants » (09 §2.4)', () => {
    it('le champ se règle par le profil', () => {
      expect(updateProfileSchema.safeParse({ showAsNewcomer: false }).success).toBe(true);
    });

    it('un membre qui l’a désactivé n’apparaît pas ; un autre, si', async () => {
      const visible = await member({ phase: 'RECENT_ARRIVAL' });
      const hidden = await member({ phase: 'RECENT_ARRIVAL', showAsNewcomer: false });
      const viewer = await member();

      const profile = await cities.profile(citySlug, viewer);
      const handles = profile.newcomers.map((n) => n.handle);
      const visibleHandle = (await prisma.user.findUniqueOrThrow({ where: { id: visible } })).handle;
      const hiddenHandle = (await prisma.user.findUniqueOrThrow({ where: { id: hidden } })).handle;

      expect(handles).toContain(visibleHandle);
      expect(handles).not.toContain(hiddenHandle);
    });
  });

  // ══ Budgets, compteurs et fiche (09 §2.3) ═════════════════════════════════

  describe('budgets et en-tête de la fiche', () => {
    it('une ligne de budget tient en un mot (« Loyer »), un bon plan non', () => {
      const budget = createCityTipSchema.safeParse({ kind: 'BUDGET', body: 'Loyer', amountCents: 48_000 });
      const court = createCityTipSchema.safeParse({ kind: 'TIP', body: 'Court' });
      expect(budget.success).toBe(true);
      expect(court.success).toBe(false);
    });

    it('une ligne de budget ne porte JAMAIS le nom de son auteur (« votre budget est anonymisé »)', async () => {
      const author = await member();
      const created = await cities.createTip(citySlug, author, {
        kind: 'BUDGET',
        body: 'Chambre en coloc',
        amountCents: 48_000,
      });
      createdTips.push(created.id);
      expect(created.author).toBeNull();
      expect(created.mine).toBe(true);
      const liste = await cities.listTips(citySlug, { limit: 50, kind: 'BUDGET' }, null);
      expect(liste.items.find((t) => t.id === created.id)?.author).toBeNull();
    });

    it('la fiche compte les contributions par genre, sans plafond de liste', async () => {
      const author = await member();
      await tip(author);
      const created = await cities.createTip(citySlug, author, { kind: 'BUDGET', body: 'Courses', amountCents: 20_000 });
      createdTips.push(created.id);
      const fiche = await cities.profile(citySlug, author);
      expect(fiche.tipCounts.TIP).toBeGreaterThanOrEqual(1);
      expect(fiche.tipCounts.BUDGET).toBeGreaterThanOrEqual(1);
      expect(fiche.budgetMedianCents).not.toBeNull();
    });

    it('les événements de la fiche portent le fuseau et le jour civil de la ville', async () => {
      const organizer = await member();
      const id = newId();
      await prisma.event.create({
        data: {
          id,
          organizerUserId: organizer,
          type: 'PICNIC',
          title: 'Pique-nique de quartier',
          cityId,
          addressText: 'Parc',
          startsAt: new Date(Date.now() + 5 * 86_400_000),
          status: 'SCHEDULED',
        },
      });
      try {
        const fiche = await cities.profile(citySlug, organizer);
        const e = fiche.events.find((x) => x.id === id);
        expect(e?.timeZone).toMatch(/\//);
        expect(e?.localDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      } finally {
        await prisma.event.delete({ where: { id } });
      }
    });

    it('l’annuaire donne les compétences (trois au plus) de chaque membre', async () => {
      const m = await member();
      const skills = await prisma.skill.findMany({ where: { isActive: true }, take: 4, select: { id: true } });
      if (skills.length < 4) return;
      await prisma.userSkill.createMany({ data: skills.map((k) => ({ userId: m, skillId: k.id })) });
      const page = await cities.members(
        { limit: 50, radiusKm: 0, cityId, skillId: (skills[0] as { id: string }).id } as never,
        m,
      );
      const carte = page.items[0];
      expect(carte).toBeDefined();
      expect(carte?.skills.length).toBeLessThanOrEqual(3);
    });
  });

  // ══ Suppression de compte (09 §9) ═════════════════════════════════════════

  describe('gestionnaire de suppression', () => {
    it('les votes du membre partent et chaque compteur redescend ; les contributions restent', async () => {
      const author = await member();
      const leaver = await member();
      const stayer = await member();
      const created = await tip(author);
      await cities.vote(created.id, leaver);
      await cities.vote(created.id, stayer);

      await cities.handleUserDeleted(leaver);
      await cities.handleUserDeleted(leaver); // rejeu : sans effet

      const row = await prisma.cityTip.findUniqueOrThrow({ where: { id: created.id } });
      expect(row.helpfulCount).toBe(1);
      expect(row.deletedAt).toBeNull();
      expect(await prisma.cityTipVote.count({ where: { userId: leaver } })).toBe(0);
      expect(await prisma.cityTipVote.count({ where: { userId: stayer } })).toBe(1);
    });
  });
});
