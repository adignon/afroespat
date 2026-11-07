import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { SEARCH_ZERO_MIN_DISTINCT_SEEKERS } from '@app/shared';
import { PrismaService } from '../../../common/prisma.service';
import { VisibilityService } from '../../../common/visibility.service';
import { EventHandlerRegistry, type DomainEventJob } from '../../../queue/event-handlers';
import { registerSearchSubscriptions } from '../../../queue/event-subscriptions.service';
import { SearchService } from '../search.service';

/**
 * Étape 2 — fiabilité de la recherche : villes, demandes d'aide modifiées/supprimées,
 * pagination et purge des « zéro résultat », suggestions sans auteurs séparés.
 * Les abonnements sont ceux du produit ; chaque cas modifie la SOURCE puis dispatche.
 */
describe('recherche : fiabilité des données (étape 2)', () => {
  let prisma: PrismaService;
  let search: SearchService;
  let registry: EventHandlerRegistry;
  const users: string[] = [];
  const helps: string[] = [];
  const cities: string[] = [];
  const zeroQueries: string[] = [];
  let countryId = '';
  let cityId = '';
  const run = Math.random().toString(36).slice(2, 8);

  async function member(): Promise<string> {
    const id = newId();
    await prisma.user.create({
      data: {
        id, handle: `s2${run}${id.slice(-6)}`, displayName: 'Chercheur', phase: 'SETTLED', verificationLevel: 'L1',
        originCountryId: countryId, cityId, plan: 'FREE', status: 'ACTIVE',
      },
    });
    users.push(id);
    return id;
  }

  async function help(authorUserId: string, title: string): Promise<string> {
    const id = newId();
    await prisma.helpRequest.create({
      data: {
        id, authorUserId, kind: 'REQUEST', type: 'PAPERWORK', title, body: 'Un corps.', cityId,
        status: 'OPEN', moderationStatus: 'CLEARED',
      },
    });
    helps.push(id);
    return id;
  }

  async function emit(type: string, aggregateId: string, payload: unknown = {}): Promise<void> {
    await registry.dispatch({
      id: newId(), type: type as DomainEventJob['type'], aggregateId, payload, occurredAt: new Date().toISOString(),
    });
  }

  const docCount = (subjectId: string): Promise<number> => prisma.searchDocument.count({ where: { subjectId } });

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    search = new SearchService(prisma, new VisibilityService(prisma));
    registry = new EventHandlerRegistry();
    registerSearchSubscriptions(registry, search);
    countryId = (await prisma.country.findFirstOrThrow({ where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } }, select: { id: true } })).id;
    cityId = (await prisma.city.findFirstOrThrow({ select: { id: true } })).id;
  });

  afterAll(async () => {
    const all = [...users, ...helps, ...cities];
    await prisma.$executeRawUnsafe(`DELETE FROM search_documents WHERE subject_id = ANY($1::uuid[])`, all);
    await prisma.block.deleteMany({ where: { OR: [{ blockerUserId: { in: users } }, { blockedUserId: { in: users } }] } });
    await prisma.helpRequest.deleteMany({ where: { id: { in: helps } } });
    await prisma.searchZeroResultSeeker.deleteMany({ where: { queryNormalized: { in: zeroQueries } } });
    await prisma.searchZeroResult.deleteMany({ where: { queryNormalized: { in: zeroQueries } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.city.deleteMany({ where: { id: { in: cities } } });
    await prisma.$disconnect();
  });

  // ── Villes ────────────────────────────────────────────────────────────────

  describe('city.* : l’index suit la fiche ville', () => {
    async function newCity(): Promise<string> {
      const id = newId();
      await prisma.city.create({
        data: {
          id, countryId, name: `Ville${run}`, slug: `ville-${run}-${id.slice(-6)}`,
          latitude: 1, longitude: 1, isActive: false,
        },
      });
      cities.push(id);
      return id;
    }

    it('city.created sur une ville inactive n’indexe rien ; activée puis renommée, le titre suit city.updated ; désactivée, elle sort', async () => {
      const id = await newCity();
      await emit('city.created', id);
      expect(await docCount(id)).toBe(0);

      await prisma.city.update({ where: { id }, data: { isActive: true } });
      await emit('city.activated', id);
      expect(await docCount(id)).toBe(1);

      await prisma.city.update({ where: { id }, data: { name: `Renommee${run}` } });
      await emit('city.updated', id);
      const doc = await prisma.searchDocument.findFirstOrThrow({ where: { subjectId: id }, select: { title: true } });
      expect(doc.title).toContain(`Renommee${run}`);

      await prisma.city.update({ where: { id }, data: { isActive: false } });
      await emit('city.deactivated', id);
      expect(await docCount(id)).toBe(0);
    });

    it('city.created / city.updated sont bien abonnés (une ville active créée directement est indexée)', async () => {
      const id = await newCity();
      await prisma.city.update({ where: { id }, data: { isActive: true } });
      await emit('city.created', id);
      expect(await docCount(id)).toBe(1);
    });
  });

  // ── Demandes d'aide ───────────────────────────────────────────────────────

  describe('demandes d’aide : édition et suppression', () => {
    it('help_request.updated réindexe (ancien titre introuvable) ; help_request.deleted retire le document', async () => {
      const auteur = await member();
      const lecteur = await member();
      const ancien = `ancienh${run}`;
      const nouveau = `nouveauh${run}`;
      const id = await help(auteur, `Titre ${ancien}`);
      await emit('help_request.published', id);
      expect(await docCount(id)).toBe(1);

      await prisma.helpRequest.update({ where: { id }, data: { title: `Titre ${nouveau}` } });
      await emit('help_request.updated', id);
      const found = async (q: string): Promise<string[]> => {
        const page = await search.search(lecteur, { q, limit: 20, period: 'all' });
        return (page.items as { items: { subjectId: string }[] }[]).flatMap((g) => g.items.map((i) => i.subjectId));
      };
      expect(await found(nouveau)).toContain(id);
      expect(await found(ancien)).not.toContain(id);

      await prisma.helpRequest.update({ where: { id }, data: { deletedAt: new Date() } });
      await emit('help_request.deleted', id);
      expect(await docCount(id)).toBe(0);
      expect(await found(nouveau)).not.toContain(id);
    });
  });

  // ── Zéro résultat : agrégat paginé, purge ─────────────────────────────────

  describe('zéro résultat', () => {
    async function seek(q: string, seekers: number, day = new Date()): Promise<void> {
      const occurredOn = new Date(day);
      occurredOn.setUTCHours(0, 0, 0, 0);
      zeroQueries.push(q);
      await prisma.searchZeroResult.create({ data: { id: newId(), queryNormalized: q, cityId: null, occurredOn, count: seekers } });
      for (let i = 0; i < seekers; i += 1) {
        await prisma.searchZeroResultSeeker.create({
          data: { id: newId(), queryNormalized: q, cityId: null, occurredOn, seekerHash: `h${run}${i}${q}` },
        });
      }
    }

    it('pagine par curseur signé sans répéter ni sauter une requête, dans l’ordre (personnes DESC, requête ASC)', async () => {
      const min = SEARCH_ZERO_MIN_DISTINCT_SEEKERS;
      // Cinq requêtes dont les nombres de personnes sont uniques au-dessus de tout le reste.
      const names = [`pg${run}a`, `pg${run}b`, `pg${run}c`, `pg${run}d`, `pg${run}e`];
      await seek(names[0]!, min + 40);
      await seek(names[1]!, min + 41);
      await seek(names[2]!, min + 41);
      await seek(names[3]!, min + 39);
      await seek(names[4]!, min + 38);

      const seen: string[] = [];
      let cursor: string | undefined;
      for (let i = 0; i < 10; i += 1) {
        const page = await search.zeroResults({ weeks: 1, limit: 2, cursor });
        expect(page.items.length).toBeLessThanOrEqual(2);
        seen.push(...page.items.map((it) => it.query));
        if (page.nextCursor === null) break;
        cursor = page.nextCursor;
      }
      const mine = seen.filter((q) => q.startsWith(`pg${run}`));
      expect(new Set(seen).size).toBe(seen.length);
      expect(mine).toEqual([`pg${run}b`, `pg${run}c`, `pg${run}a`, `pg${run}d`, `pg${run}e`]);
    });

    it('refuse un curseur forgé ou lié à une autre fenêtre', async () => {
      await expect(search.zeroResults({ weeks: 1, limit: 2, cursor: 'x.y' })).rejects.toBeDefined();
      await seek(`sc${run}a`, SEARCH_ZERO_MIN_DISTINCT_SEEKERS + 60);
      await seek(`sc${run}b`, SEARCH_ZERO_MIN_DISTINCT_SEEKERS + 59);
      const first = await search.zeroResults({ weeks: 1, limit: 1 });
      expect(first.nextCursor).not.toBeNull();
      await expect(search.zeroResults({ weeks: 2, limit: 1, cursor: first.nextCursor as string })).rejects.toBeDefined();
    });

    it('la purge supprime au-delà de la rétention (compteurs ET pseudonymes), garde le reste, et se rejoue sans effet', async () => {
      const now = new Date();
      const vieux = new Date(now.getTime() - 100 * 86_400_000);
      const recent = new Date(now.getTime() - 30 * 86_400_000);
      const q = `pu${run}`;
      await seek(q, 2, vieux);
      await seek(q, 2, recent);

      const first = await search.purgeZeroResults(now, 90);
      expect(first.results).toBeGreaterThanOrEqual(1);
      expect(first.seekers).toBeGreaterThanOrEqual(2);
      const reste = await prisma.searchZeroResult.findMany({ where: { queryNormalized: q } });
      expect(reste).toHaveLength(1);
      expect(await prisma.searchZeroResultSeeker.count({ where: { queryNormalized: q } })).toBe(2);

      const second = await search.purgeZeroResults(now, 90);
      expect(second.results).toBe(0);
      // Une rétention plus courte retire aussi la ligne de 30 jours.
      const court = await search.purgeZeroResults(now, 10);
      expect(court.results).toBeGreaterThanOrEqual(1);
      expect(await prisma.searchZeroResult.count({ where: { queryNormalized: q } })).toBe(0);
    });
  });

  // ── Suggestions ───────────────────────────────────────────────────────────

  describe('suggestions et auteurs séparés', () => {
    it('ne propose ni le contenu ni la fiche d’un membre séparé, dans les DEUX sens de blocage', async () => {
      const lecteur = await member();
      const bloque = await member(); // bloqué par le lecteur
      const bloqueur = await member(); // a bloqué le lecteur
      const neutre = await member();
      const mot = `sugg${run}`;
      const ids = {
        bloque: await help(bloque, `${mot} alpha bloque`),
        bloqueur: await help(bloqueur, `${mot} beta bloqueur`),
        neutre: await help(neutre, `${mot} gamma neutre`),
      };
      for (const id of Object.values(ids)) await emit('help_request.published', id);
      await prisma.block.create({ data: { id: newId(), blockerUserId: lecteur, blockedUserId: bloque } });
      await prisma.block.create({ data: { id: newId(), blockerUserId: bloqueur, blockedUserId: lecteur } });

      const { items } = await search.suggest(lecteur, mot);
      const suggested = items.map((i) => i.subjectId);
      expect(suggested).toContain(ids.neutre);
      expect(suggested).not.toContain(ids.bloque);
      expect(suggested).not.toContain(ids.bloqueur);

      // Un tiers non séparé voit les trois (le cache n'a pas servi une réponse filtrée).
      const tiers = await member();
      const vuParTiers = (await search.suggest(tiers, mot)).items.map((i) => i.subjectId);
      expect(vuParTiers).toEqual(expect.arrayContaining([ids.bloque, ids.bloqueur, ids.neutre]));
    });
  });
});
