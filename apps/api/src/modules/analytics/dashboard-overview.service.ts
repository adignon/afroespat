import { Injectable } from '@nestjs/common';
import {
  CITY_ACTIVATION_SUGGEST_MEMBERS,
  KEY_INDICATOR_TARGET_DEFAULT,
  KEY_INDICATOR_TARGET_SETTING_KEY,
  KEY_INDICATOR_WEEKS,
  type AdminDashboardOverview,
} from '@app/shared';
import { PrismaService } from '../../common/prisma.service';

/**
 * Le tableau de bord, ce que les instantanés ne portent pas — 15 §5.1 et §8.
 *
 * `GET /admin/dashboard` rend des POINTS DE MESURE (`metric_snapshots`). Il ne dit ni
 * l'objectif de l'indicateur clé, ni son écart avec la période précédente, ni sa courbe
 * par semaine, ni les alertes du bandeau, ni le SLA de modération, ni la note moyenne
 * des parrainages, ni les événements DU MOIS. Cette route les sert, pour les QUATRE
 * rôles (§2.2 : « Tableaux de bord » est ouvert à tous) — d'où la file de modération et
 * son SLA calculés ici et non lus dans `/moderation/stats`, qui exclut `SUPPORT`.
 *
 * UNE MESURE ABSENTE EST `null`, jamais zéro. L'indicateur clé vient des instantanés
 * quotidiens de `metrics.key_indicator` : sans aucun instantané il vaut `null`, et
 * l'écran écrit « — » et « Pas encore de mesure ». Les autres sont des comptes vivants
 * (un zéro est alors un fait).
 *
 * AGRÉGÉ : aucune ligne ne porte d'identifiant de membre.
 */

const DAY_MS = 86_400_000;
const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Lundi 00:00 UTC de la semaine de `d`. */
function weekStartUtc(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (x.getUTCDay() + 6) % 7;
  return new Date(x.getTime() - dow * DAY_MS);
}

@Injectable()
export class DashboardOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(staffId: string, now: Date = new Date()): Promise<AdminDashboardOverview> {
    const [keyIndicator, alerts, moderation, mentorship, events, communities] = await Promise.all([
      this.keyIndicator(now),
      this.alerts(staffId, now),
      this.moderation(),
      this.mentorship(),
      this.events(now),
      this.communities(),
    ]);
    return { generatedAt: now.toISOString(), alerts, keyIndicator, moderation, mentorship, events, communities };
  }

  // ── Indicateur clé : % des membres d'une ville cochés présents sur 90 jours ──

  private async target(): Promise<number> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: KEY_INDICATOR_TARGET_SETTING_KEY }, select: { value: true } });
    return typeof row?.value === 'number' && row.value >= 1 && row.value <= 100 ? row.value : KEY_INDICATOR_TARGET_DEFAULT;
  }

  private async keyIndicator(now: Date): Promise<AdminDashboardOverview['keyIndicator']> {
    const target = await this.target();
    // Assez d'historique pour la courbe ET pour retrouver l'instantané d'il y a 7 jours.
    const since = new Date(now.getTime() - (KEY_INDICATOR_WEEKS * 7 + 7) * DAY_MS);
    const rows = await this.prisma.$queryRaw<{ period_start: Date; members: number; present: number }[]>`
      SELECT period_start,
             COALESCE(sum(value) FILTER (WHERE metric = 'key_indicator.city_members'), 0)::float8      AS members,
             COALESCE(sum(value) FILTER (WHERE metric = 'key_indicator.city_present_90d'), 0)::float8 AS present
        FROM metric_snapshots
       WHERE metric IN ('key_indicator.city_members', 'key_indicator.city_present_90d')
         AND period_start >= ${since}
         AND period_start <= ${now}
       GROUP BY period_start
       ORDER BY period_start
    `;
    const points = rows
      .filter((r) => r.members > 0)
      .map((r) => ({ at: r.period_start, members: r.members, present: r.present, percent: round1((r.present / r.members) * 100) }));
    const last = points[points.length - 1];
    if (last === undefined) {
      return { percent: null, target, variationPoints: null, members: null, present: null, measuredAt: null, byCity: [], weekly: [] };
    }

    // L'écart, en POINTS, avec le dernier instantané pris au moins 7 jours avant le plus récent.
    const reference = [...points].reverse().find((p) => p.at.getTime() <= last.at.getTime() - 7 * DAY_MS);
    const variationPoints = reference === undefined ? null : round1(last.percent - reference.percent);

    // La courbe hebdomadaire : le dernier instantané de chaque semaine.
    const byWeek = new Map<number, number>();
    for (const p of points) byWeek.set(weekStartUtc(p.at).getTime(), p.percent);
    const weekly = [...byWeek.entries()]
      .sort((a, b) => a[0] - b[0])
      .slice(-KEY_INDICATOR_WEEKS)
      .map(([t, percent]) => ({ weekStart: new Date(t).toISOString(), percent }));

    // La répartition par ville, au dernier instantané.
    const cityRows = await this.prisma.$queryRaw<{ dimension: string; metric: string; value: number }[]>`
      SELECT dimension, metric, value::float8 AS value
        FROM metric_snapshots
       WHERE period_start = ${last.at}
         AND metric IN ('key_indicator.city_members', 'key_indicator.city_present_90d')
    `;
    const perCity = new Map<string, { members: number; present: number }>();
    for (const r of cityRows) {
      const acc = perCity.get(r.dimension) ?? { members: 0, present: 0 };
      if (r.metric === 'key_indicator.city_members') acc.members = r.value;
      else acc.present = r.value;
      perCity.set(r.dimension, acc);
    }
    const cities = await this.prisma.city.findMany({ where: { id: { in: [...perCity.keys()] } }, select: { id: true, name: true } });
    const byCity = cities
      .map((c) => {
        const v = perCity.get(c.id) ?? { members: 0, present: 0 };
        return { cityId: c.id, name: c.name, members: v.members, present: v.present, percent: v.members > 0 ? round1((v.present / v.members) * 100) : 0 };
      })
      .filter((c) => c.members > 0)
      .sort((a, b) => b.members - a.members || a.name.localeCompare(b.name, 'fr'))
      .slice(0, 6);

    return {
      percent: last.percent,
      target,
      variationPoints,
      members: last.members,
      present: last.present,
      measuredAt: last.at.toISOString(),
      byCity,
      weekly,
    };
  }

  // ── Le bandeau d'alertes ────────────────────────────────────────────────────

  private async alerts(staffId: string, now: Date): Promise<AdminDashboardOverview['alerts']> {
    const [overdue, proPending, cities, citiesCount, unread] = await Promise.all([
      this.prisma.moderationCase.count({ where: { status: { in: ['OPEN', 'IN_REVIEW'] }, slaDueAt: { lt: now } } }),
      this.prisma.proProfile.count({ where: { verificationStatus: 'PENDING', deletedAt: null } }),
      this.prisma.city.findMany({
        where: { isActive: false, mergedIntoCityId: null, memberCount: { gte: CITY_ACTIVATION_SUGGEST_MEMBERS } },
        orderBy: [{ memberCount: 'desc' }, { name: 'asc' }],
        take: 3,
        select: { name: true },
      }),
      this.prisma.city.count({ where: { isActive: false, mergedIntoCityId: null, memberCount: { gte: CITY_ACTIVATION_SUGGEST_MEMBERS } } }),
      this.prisma.staffAlert.count({ where: { staffId, readAt: null } }),
    ]);
    return {
      moderationOverdue: { count: overdue },
      proPending: { count: proPending },
      citiesToActivate: { count: citiesCount, names: cities.map((c) => c.name) },
      unreadStaffAlerts: unread,
    };
  }

  // ── Modération : la file et le respect du SLA ───────────────────────────────

  private async moderation(): Promise<AdminDashboardOverview['moderation']> {
    const queue = await this.prisma.moderationCase.count({ where: { status: { in: ['OPEN', 'IN_REVIEW'] } } });
    // Même échantillon que `ModerationService.stats` : les 500 derniers dossiers résolus.
    const resolved = await this.prisma.moderationCase.findMany({
      where: { status: 'RESOLVED', resolvedAt: { not: null } },
      select: { resolvedAt: true, slaDueAt: true },
      orderBy: { resolvedAt: 'desc' },
      take: 500,
    });
    const within = resolved.filter((r) => (r.resolvedAt as Date).getTime() <= r.slaDueAt.getTime()).length;
    return {
      queue,
      slaComplianceRate: resolved.length === 0 ? null : within / resolved.length,
      resolvedSampleSize: resolved.length,
    };
  }

  // ── Parrainage : en cours, note moyenne ─────────────────────────────────────

  private async mentorship(): Promise<AdminDashboardOverview['mentorship']> {
    const [active, rating] = await Promise.all([
      this.prisma.mentorship.count({ where: { status: 'ACTIVE' } }),
      this.prisma.mentorshipReview.aggregate({ _avg: { rating: true }, _count: { _all: true } }),
    ]);
    const avg = rating._avg.rating;
    return {
      active,
      averageRating: avg === null ? null : Math.round(avg * 10) / 10,
      ratingCount: rating._count._all,
    };
  }

  // ── Événements du mois ──────────────────────────────────────────────────────

  private async events(now: Date): Promise<AdminDashboardOverview['events']> {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const window = { gte: start, lt: end };
    const [thisMonth, checkedIn] = await Promise.all([
      this.prisma.event.count({ where: { deletedAt: null, status: { not: 'CANCELLED' }, startsAt: window } }),
      this.prisma.eventAttendee.count({ where: { checkedIn: true, event: { is: { deletedAt: null, status: { not: 'CANCELLED' }, startsAt: window } } } }),
    ]);
    return { thisMonth, checkedInThisMonth: checkedIn };
  }

  // ── Réseaux ─────────────────────────────────────────────────────────────────

  private async communities(): Promise<AdminDashboardOverview['communities']> {
    const [active, interest] = await Promise.all([
      this.prisma.community.count({ where: { status: 'ACTIVE' } }),
      this.prisma.community.count({ where: { status: 'ACTIVE', kind: 'INTEREST' } }),
    ]);
    return { active, interest };
  }
}

