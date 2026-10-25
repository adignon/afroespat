import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { PrismaService } from '../../../common/prisma.service';
import { AnalyticsService } from '../analytics.service';

/**
 * Le pilotage — 15-administration.md §5.1 et §10.
 *
 * DEUX RÈGLES DURES sont éprouvées ici, et une seule d'entre elles saute aux yeux.
 *
 *   · **l'indicateur clé compte ce que §5.1 dit qu'il compte** : « % des membres
 *     d'une ville ayant été COCHÉS PRÉSENTS à au moins un événement dans les
 *     90 jours ». Trois façons de se tromper, et le test les sépare : compter les
 *     inscrits au lieu des présents, compter les présences au lieu des membres,
 *     et ignorer la fenêtre de 90 jours ;
 *   · **les tâches sont IDEMPOTENTES** (`scheduled-tasks.ts`). Une reprise BullMQ
 *     rejoue le créneau ; si elle doublait les points, la courbe de §6 mentirait
 *     et personne ne le verrait avant de la lire.
 *
 * LES ATTENDUS SONT ÉCRITS EN DUR — 25 %, 4 membres, 1 présent — et NON calculés
 * depuis les lignes insérées. Un test qui recalculerait son attendu avec la même
 * formule que le code éprouverait que la formule est égale à elle-même, ce qui est
 * vrai même quand elle est fausse.
 */
describe('instantanés d’indicateurs (15 §5, §10)', () => {
  let prisma: PrismaService;
  let analytics: AnalyticsService;

  const users: string[] = [];
  const events: string[] = [];
  let cityId = '';
  let countryId = '';
  /** Une clé de métrique propre à ce test : la base porte d'autres villes. */
  let otherCityId = '';
  let rsvpSeulId = '';
  let organizerId = '';

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    analytics = new AnalyticsService(prisma);

    const country = await prisma.country.findFirstOrThrow({
      where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } },
      select: { id: true },
    });
    countryId = country.id;

    /**
     * DEUX VILLES À SOI. Le test lisait `findMany({ take: 2 })` : les deux premières villes
     * de la base, avec les membres que d'autres suites ou le développement y avaient mis.
     * Or l'indicateur compte les membres de la ville — « quatre membres, un présent →
     * 25 % » n'est vrai que si ce sont LES SEULS. MESURÉ : sur une base qui avait d'autres
     * membres à Lyon, `city_members` valait 9 au lieu de 4 et le test échouait sans que
     * rien ne soit cassé. Les deux villes sont créées ici, vides, et retirées en fin de fichier.
     */
    const marque = newId().slice(-10);
    const creerVille = async (rang: number): Promise<string> => {
      const id = newId();
      await prisma.city.create({
        data: {
          id, countryId: (await prisma.country.findUniqueOrThrow({ where: { iso2: 'FR' }, select: { id: true } })).id,
          name: `Analytics ${marque} ${rang}`, slug: `analytics-${marque}-${rang}`,
          latitude: 45.75, longitude: 4.85, isActive: true, memberCount: 0,
        },
      });
      return id;
    };
    cityId = await creerVille(1);
    otherCityId = await creerVille(2);

    // QUATRE membres dans la ville, UN seul coché présent → 25 %, écrit en dur
    // plus bas. Les trois autres couvrent les trois façons de se tromper :
    //   · `absent`    : aucune participation du tout ;
    //   · `rsvpSeul`  : INSCRIT mais pas coché — le piège du RSVP ;
    //   · `troisVieux`: coché, mais sur un événement hors des 90 jours.
    //
    // EN SÉRIE, et non en `Promise.all` : l'ordre de `users.push` n'est alors pas
    // celui des résultats, et `makeEvent` comme la mise à jour ci-dessous
    // désigneraient un autre membre que celui qu'on croit. Le premier jet du test
    // est tombé exactement là — et c'est le test qui l'a dit, pas la relecture.
    const present = await makeUser('present');
    const absent = await makeUser('absent');
    rsvpSeulId = await makeUser('rsvp');
    const vieux = await makeUser('vieux');
    organizerId = present;

    const recent = await makeEvent(daysAgo(10));
    const old = await makeEvent(daysAgo(200));

    await prisma.eventAttendee.createMany({
      data: [
        { id: newId(), eventId: recent, userId: present, status: 'GOING', respondedAt: new Date(), checkedIn: true },
        { id: newId(), eventId: recent, userId: rsvpSeulId, status: 'GOING', respondedAt: new Date(), checkedIn: false },
        { id: newId(), eventId: old, userId: vieux, status: 'GOING', respondedAt: new Date(), checkedIn: true },
      ],
    });
    void absent;
  });

  afterAll(async () => {
    if (users.length > 0) {
      await prisma.eventAttendee.deleteMany({ where: { userId: { in: users } } });
      await prisma.event.deleteMany({ where: { id: { in: events } } });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
    }
    await prisma.metricSnapshot.deleteMany({ where: { dimension: { in: [cityId, otherCityId] } } });
    // `refreshKeyIndicator(demain)` écrit un point pour CHAQUE ville active de la base, daté du
    // futur : une ligne que rien ne reprendra jamais et qui fausserait toute lecture « dernier
    // point » d'un autre fichier. On retire tout ce qui est daté après maintenant.
    await prisma.metricSnapshot.deleteMany({ where: { periodStart: { gt: new Date() } } });
    await prisma.city.deleteMany({ where: { id: { in: [cityId, otherCityId] } } });
    await prisma.$disconnect();
  });

  async function makeUser(tag: string): Promise<string> {
    const id = newId();
    await prisma.user.create({
      data: {
        id, handle: `an${tag}${id.slice(-8)}`, displayName: `Analytics ${tag}`,
        phase: 'SETTLED', verificationLevel: 'L1', originCountryId: countryId,
        cityId, plan: 'FREE', status: 'ACTIVE',
      },
    });
    users.push(id);
    return id;
  }

  async function makeEvent(startsAt: Date): Promise<string> {
    const id = newId();
    await prisma.event.create({
      data: {
        id, organizerUserId: organizerId, type: 'NETWORKING', title: 'Rencontre',
        cityId, startsAt, status: 'SCHEDULED',
      },
    });
    events.push(id);
    return id;
  }

  // ───────────────────────────────────────────────────────────────────────────

  describe('l’indicateur clé de §5.1', () => {
    it('compte les COCHÉS PRÉSENTS des 90 jours, pas les inscrits ni les présences', async () => {
      const now = new Date();
      await prisma.metricSnapshot.deleteMany({ where: { dimension: cityId } });

      await analytics.refreshKeyIndicator(now);

      const pct = await snapshot('key_indicator.event_presence_90d', cityId);
      const membres = await snapshot('key_indicator.city_members', cityId);
      const presents = await snapshot('key_indicator.city_present_90d', cityId);

      // 4 membres, 1 seul coché présent dans la fenêtre → 25 %. En dur.
      expect(membres).toBe(4);
      expect(presents).toBe(1);
      expect(pct).toBe(25);
    });

    it('recompte après un pointage : le deuxième membre fait passer à 50 %', async () => {
      const now = new Date();
      // Un jour PLUS TARD, donc un autre `period_start` : la table est en ajout
      // seul, on ne réécrit pas le point d'hier.
      const tomorrow = new Date(now.getTime() + 86_400_000);
      await prisma.eventAttendee.updateMany({
        where: { userId: rsvpSeulId },
        data: { checkedIn: true },
      });

      await analytics.refreshKeyIndicator(tomorrow);

      expect(await snapshot('key_indicator.event_presence_90d', cityId, tomorrow)).toBe(50);
      expect(await snapshot('key_indicator.city_present_90d', cityId, tomorrow)).toBe(2);
    });
  });

  describe('les tâches de §10 sont idempotentes', () => {
    it('rejouer le même créneau n’écrit aucun point de plus', async () => {
      const now = new Date('2026-06-15T09:30:00.000Z');
      await prisma.metricSnapshot.deleteMany({ where: { dimension: cityId } });

      const first = await analytics.refreshKeyIndicator(now);
      const second = await analytics.refreshKeyIndicator(now);

      expect(first.ecrits).toBeGreaterThan(0);
      // Le deuxième passage n'insère RIEN : c'est l'unicité
      // (metric, dimension, period_start) qui le garantit, pas la prudence du service.
      expect(second.ecrits).toBe(0);

      const lignes = await prisma.metricSnapshot.count({
        where: { metric: 'key_indicator.event_presence_90d', dimension: cityId },
      });
      expect(lignes).toBe(1);
    });

    it('`metrics.refresh` rejoué n’écrit rien non plus', async () => {
      const now = new Date('2026-06-15T11:00:00.000Z');
      const first = await analytics.refreshMetrics(now);
      const second = await analytics.refreshMetrics(now);

      expect(first.points).toBeGreaterThan(0);
      expect(second.ecrits).toBe(0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────

  async function snapshot(metric: string, dimension: string, at?: Date): Promise<number | null> {
    const row = await prisma.metricSnapshot.findFirst({
      where: {
        metric,
        dimension,
        ...(at === undefined ? {} : { periodStart: startOfDay(at) }),
      },
      orderBy: { periodStart: 'desc' },
      select: { value: true },
    });
    return row === null ? null : Number(row.value);
  }
});

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000);
}

function startOfDay(d: Date): Date {
  const c = new Date(d.getTime());
  c.setUTCHours(0, 0, 0, 0);
  return c;
}
