import { Injectable, Logger } from '@nestjs/common';
import { newId, Prisma } from '@app/db';
import {
  ADMIN_CONTENT_AUDIT_ACTIONS,
  ADMIN_CONTENT_ERROR_CODES,
  ADMIN_CONTENT_ERROR_MESSAGES,
  type AdminContentErrorCode,
  type ImpactQuoteApprove,
  type ImpactQuoteKind,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { AuditService } from '../../common/audit.service';
import { PrismaService } from '../../common/prisma.service';
import { AnalyticsService, quarterLabel, startOfQuarterUtc } from './analytics.service';

/**
 * Le rapport d'impact — HISTORIQUE ET TÉMOIGNAGES (15 §5.3).
 *
 * ─── DÉCISION DU PORTEUR : « IL FAUT TOUT CONSERVER » ────────────────────────
 *
 * Avant ce service, `GET /admin/impact` rendait « le dernier point connu » de chaque
 * indicateur : un financeur qui demandait le trimestre précédent n'avait rien. Chaque
 * calcul d'un trimestre est maintenant rangé dans `impact_report_snapshots`, UN
 * INSTANTANÉ PAR TRIMESTRE ET PAR RÉVISION. Un recalcul pose la révision suivante ; la
 * précédente reste, et reste lisible. Aucune méthode de ce fichier ne modifie ni ne
 * supprime une ligne de cette table (un test le garde).
 *
 * `prepareQuarter` (la tâche `impact.quarterly_prepare`) est IDEMPOTENTE : si le
 * trimestre a déjà un instantané, elle n'en pose pas un second — c'est `recompute`,
 * geste explicite et tracé de l'équipe, qui crée une révision.
 *
 * ─── TÉMOIGNAGES : TROIS CONDITIONS, ET LA DERNIÈRE EST CONTINUE ─────────────
 *
 *   1. l'auteur a coché « autoriser la citation » (`quotable`) ;
 *   2. l'équipe a APPROUVÉ l'extrait (≤ 300 caractères, éventuellement raccourci) :
 *      c'est la citation « modérée » ;
 *   3. à CHAQUE lecture du rapport, l'accord tient encore : `quotable` toujours vrai,
 *      contenu publié et non supprimé. Un auteur qui retire son accord fait disparaître
 *      sa citation du rapport au prochain affichage — le consentement n'est pas un
 *      instantané.
 *
 * Le rapport ne porte NI nom NI identifiant d'auteur : « agrégé, jamais nominatif ».
 */

function fail(code: AdminContentErrorCode, details?: Record<string, unknown>): never {
  throw new ApiError(code, ADMIN_CONTENT_ERROR_MESSAGES[code], ADMIN_CONTENT_ERROR_CODES[code], details);
}

const DAY_MS = 86_400_000;
/** L'extrait montré à l'équipe pour décider quoi citer. */
const EXCERPT_MAX = 600;

export interface ImpactItem {
  readonly metric: string;
  readonly dimension: string;
  readonly value: number;
}

@Injectable()
export class ImpactService {
  private readonly logger = new Logger(ImpactService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly audit: AuditService,
  ) {}

  // ── Calcul et conservation ──────────────────────────────────────────────────

  /** Début du trimestre clos le plus récent à la date `now`. */
  lastClosedQuarterStart(now: Date): Date {
    return startOfQuarterUtc(new Date(startOfQuarterUtc(now).getTime() - DAY_MS));
  }

  /**
   * `impact.quarterly_prepare` : calcule le trimestre ÉCOULÉ. Écrit toujours dans
   * `metric_snapshots` (comme avant, idempotent par l'unicité) ET pose l'instantané de
   * l'historique s'il n'existe pas encore.
   */
  async prepareQuarter(now: Date): Promise<{ trimestre: string; ecrits: number; revision: number | null }> {
    const done = await this.analytics.prepareQuarterlyImpact(now);
    const start = this.lastClosedQuarterStart(now);
    const existing = await this.prisma.impactReportSnapshot.findFirst({
      where: { quarter: quarterLabel(start) },
      select: { revision: true },
    });
    if (existing !== null) return { ...done, revision: null };
    const revision = await this.writeSnapshot(start, null);
    return { ...done, revision };
  }

  /**
   * Un nouveau calcul d'un trimestre CLOS : la révision suivante. L'ancienne n'est pas
   * touchée. Un trimestre en cours est refusé — son rapport changerait à chaque lecture.
   */
  async recompute(quarter: string, staffId: string, ip: string | null, now: Date = new Date()) {
    const start = this.parseQuarter(quarter);
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 1));
    if (end.getTime() > now.getTime()) fail('IMPACT_QUARTER_OPEN', { quarter });
    const revision = await this.writeSnapshot(start, staffId);
    await this.audit.record(this.prisma, {
      actor: { type: 'STAFF', id: staffId },
      action: ADMIN_CONTENT_AUDIT_ACTIONS.impactRecomputed,
      targetType: 'impact_report',
      metadata: { trimestre: quarter, revision },
      ...(ip === null ? {} : { ip }),
    });
    return { trimestre: quarter, revision };
  }

  private async writeSnapshot(start: Date, staffId: string | null): Promise<number> {
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 1));
    const label = quarterLabel(start);
    const points = await this.analytics.impactPoints(start, end);
    const items = points.map((p) => ({ metric: p.metric, dimension: p.dimension, value: p.value }));
    // Deux calculs simultanés visent la même révision : l'unicité (trimestre, révision)
    // refuse le second, qui retente avec la suivante. Aucune ligne n'est jamais remplacée.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const last = await this.prisma.impactReportSnapshot.findFirst({
        where: { quarter: label },
        orderBy: { revision: 'desc' },
        select: { revision: true },
      });
      const revision = (last?.revision ?? 0) + 1;
      try {
        await this.prisma.impactReportSnapshot.create({
          data: {
            id: newId(),
            quarter: label,
            revision,
            periodStart: start,
            periodEnd: end,
            items: items,
            ...(staffId === null ? {} : { computedByStaffId: staffId }),
          },
        });
        this.logger.log(`Rapport d'impact ${label} : révision ${revision} conservée (${items.length} points)`);
        return revision;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') continue;
        throw error;
      }
    }
    throw new Error(`Impossible de poser une révision pour ${label} après 5 tentatives.`);
  }

  private quarterEnd(quarter: string): Date {
    const start = this.parseQuarter(quarter);
    return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 1));
  }

  private parseQuarter(quarter: string): Date {
    const m = /^(\d{4})-T([1-4])$/.exec(quarter);
    if (m === null) throw ApiError.notFound();
    return new Date(Date.UTC(Number(m[1]), (Number(m[2]) - 1) * 3, 1));
  }

  // ── Lecture ──────────────────────────────────────────────────────────────────

  /** Les trimestres conservés, du plus récent au plus ancien (dernière révision de chacun). */
  async quarters(): Promise<{ quarter: string; revision: number; computedAt: string }[]> {
    const rows = await this.prisma.$queryRaw<{ quarter: string; revision: number; created_at: Date }[]>`
      SELECT DISTINCT ON (quarter) quarter, revision, created_at
        FROM impact_report_snapshots
       ORDER BY quarter DESC, revision DESC
    `;
    return rows
      .map((r) => ({ quarter: r.quarter, revision: r.revision, computedAt: r.created_at.toISOString() }))
      .sort((a, b) => (a.quarter < b.quarter ? 1 : a.quarter > b.quarter ? -1 : 0));
  }

  /** Le rapport d'un trimestre : sa dernière révision et ses témoignages encore consentis. */
  async report(quarter: string | undefined, now: Date = new Date()) {
    const quarters = await this.quarters();
    // Sans trimestre demandé : le plus récent trimestre CLOS qui a été conservé. Un instantané d'un
    // trimestre qui n'est pas clos n'est pas « le rapport » (il changerait à chaque lecture).
    const closed = quarters.find((q) => this.quarterEnd(q.quarter).getTime() <= now.getTime());
    const label = quarter ?? closed?.quarter ?? quarterLabel(this.lastClosedQuarterStart(now));
    const snapshot = await this.prisma.impactReportSnapshot.findFirst({
      where: { quarter: label },
      orderBy: { revision: 'desc' },
    });
    return {
      trimestre: label,
      revision: snapshot?.revision ?? null,
      computedAt: snapshot?.createdAt.toISOString() ?? null,
      items: snapshot === null ? [] : (snapshot.items as unknown as ImpactItem[]),
      quarters,
      temoignages: await this.testimonials(label),
    };
  }

  /** Les citations approuvées d'un trimestre dont l'accord de l'auteur tient encore. */
  async testimonials(quarter: string) {
    const rows = await this.prisma.impactQuote.findMany({
      where: {
        quarter,
        withdrawnAt: null,
        OR: [
          { guide: { is: { quotable: true, deletedAt: null, status: 'PUBLISHED' } } },
          { cityTip: { is: { quotable: true, deletedAt: null, status: 'PUBLISHED' } } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, quote: true, guideId: true, city: { select: { name: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      quote: r.quote,
      kind: (r.guideId === null ? 'CITY_TIP' : 'GUIDE'),
      cityName: r.city?.name ?? null,
    }));
  }

  /** Les contenus que l'auteur accepte de voir cités, avec la citation déjà approuvée pour ce trimestre. */
  async candidates(quarter: string) {
    const [guides, tips, quotes] = await Promise.all([
      this.prisma.guide.findMany({
        where: { quotable: true, deletedAt: null, status: 'PUBLISHED' },
        orderBy: { updatedAt: 'desc' },
        take: 50,
        select: {
          id: true,
          title: true,
          city: { select: { name: true } },
          pages: { orderBy: { position: 'asc' }, take: 1, select: { currentVersion: { select: { body: true } } } },
        },
      }),
      this.prisma.cityTip.findMany({
        where: { quotable: true, deletedAt: null, status: 'PUBLISHED' },
        orderBy: { updatedAt: 'desc' },
        take: 50,
        select: { id: true, body: true, city: { select: { name: true } } },
      }),
      this.prisma.impactQuote.findMany({ where: { quarter, withdrawnAt: null }, select: { id: true, quote: true, guideId: true, cityTipId: true } }),
    ]);
    const quoteOf = (kind: ImpactQuoteKind, id: string) => {
      const q = quotes.find((x) => (kind === 'GUIDE' ? x.guideId === id : x.cityTipId === id));
      return q === undefined ? null : { id: q.id, quote: q.quote };
    };
    return {
      items: [
        ...guides.map((g) => ({
          kind: 'GUIDE' as const,
          sourceId: g.id,
          title: g.title,
          excerpt: (g.pages[0]?.currentVersion?.body ?? '').slice(0, EXCERPT_MAX),
          cityName: g.city?.name ?? null,
          quote: quoteOf('GUIDE', g.id),
        })),
        ...tips.map((t) => ({
          kind: 'CITY_TIP' as const,
          sourceId: t.id,
          title: null,
          excerpt: t.body.slice(0, EXCERPT_MAX),
          cityName: t.city.name,
          quote: quoteOf('CITY_TIP', t.id),
        })),
      ],
    };
  }

  // ── Citations ────────────────────────────────────────────────────────────────

  /** L'équipe approuve (ou remplace) la citation d'un contenu pour un trimestre. */
  async approveQuote(input: ImpactQuoteApprove, staffId: string, ip: string | null) {
    const source =
      input.kind === 'GUIDE'
        ? await this.prisma.guide.findFirst({
            where: { id: input.sourceId, deletedAt: null, status: 'PUBLISHED' },
            select: { id: true, quotable: true, cityId: true },
          })
        : await this.prisma.cityTip.findFirst({
            where: { id: input.sourceId, deletedAt: null, status: 'PUBLISHED' },
            select: { id: true, quotable: true, cityId: true },
          });
    if (source === null) fail('IMPACT_SOURCE_NOT_FOUND');
    // La condition 1, vérifiée par le SERVEUR : l'écran ne propose que les contenus
    // consentis, mais une requête forgée ne doit pas contourner l'accord.
    if (!source.quotable) fail('IMPACT_QUOTE_NOT_CONSENTED');

    const where = input.kind === 'GUIDE' ? { quarter: input.quarter, guideId: source.id } : { quarter: input.quarter, cityTipId: source.id };
    const existing = await this.prisma.impactQuote.findFirst({ where, select: { id: true } });
    const data = { quote: input.quote, cityId: source.cityId, approvedByStaffId: staffId, withdrawnAt: null };
    const row =
      existing === null
        ? await this.prisma.impactQuote.create({
            data: {
              id: newId(),
              quarter: input.quarter,
              ...(input.kind === 'GUIDE' ? { guideId: source.id } : { cityTipId: source.id }),
              ...data,
            },
            select: { id: true },
          })
        : await this.prisma.impactQuote.update({ where: { id: existing.id }, data, select: { id: true } });
    await this.audit.record(this.prisma, {
      actor: { type: 'STAFF', id: staffId },
      action: ADMIN_CONTENT_AUDIT_ACTIONS.impactQuoteApproved,
      targetType: 'impact_quote',
      targetId: row.id,
      metadata: { trimestre: input.quarter, type: input.kind },
      ...(ip === null ? {} : { ip }),
    });
    return { id: row.id };
  }

  /** Retire une citation du rapport (elle reste en base, marquée retirée). */
  async withdrawQuote(id: string, staffId: string, ip: string | null) {
    const updated = await this.prisma.impactQuote.updateMany({
      where: { id, withdrawnAt: null },
      data: { withdrawnAt: new Date() },
    });
    if (updated.count === 0) throw ApiError.notFound();
    await this.audit.record(this.prisma, {
      actor: { type: 'STAFF', id: staffId },
      action: ADMIN_CONTENT_AUDIT_ACTIONS.impactQuoteWithdrawn,
      targetType: 'impact_quote',
      targetId: id,
      ...(ip === null ? {} : { ip }),
    });
    return { ok: true };
  }

  // ── L'accord de l'auteur ─────────────────────────────────────────────────────

  /** `PUT /guides/:id/quotable` — l'AUTEUR seul, jamais l'équipe. */
  async setGuideQuotable(userId: string, guideId: string, quotable: boolean) {
    const r = await this.prisma.guide.updateMany({
      where: { id: guideId, authorUserId: userId, deletedAt: null },
      data: { quotable },
    });
    if (r.count === 0) throw ApiError.notFound();
    return { quotable };
  }

  /** `GET /guides/:id/quotable` — l'AUTEUR seul : son accord actuel. */
  async getGuideQuotable(userId: string, guideId: string) {
    const g = await this.prisma.guide.findFirst({
      where: { id: guideId, authorUserId: userId, deletedAt: null },
      select: { quotable: true },
    });
    if (g === null) throw ApiError.notFound();
    return { quotable: g.quotable };
  }

  /** `PUT /tips/:id/quotable` — l'AUTEUR seul. */
  async setTipQuotable(userId: string, tipId: string, quotable: boolean) {
    const r = await this.prisma.cityTip.updateMany({
      where: { id: tipId, authorUserId: userId, deletedAt: null },
      data: { quotable },
    });
    if (r.count === 0) throw ApiError.notFound();
    return { quotable };
  }

  // ── Export ───────────────────────────────────────────────────────────────────

  /** Le CSV d'un trimestre : trimestre;révision;indicateur;tranche;valeur, puis les témoignages. */
  async csv(quarter: string | undefined) {
    const report = await this.report(quarter);
    // Les tranches sont des UUID de villes et de pays : le financeur lit des NOMS.
    const ids = [...new Set(report.items.map((i) => i.dimension).filter((d) => /^[0-9a-f-]{36}$/i.test(d)))];
    const [cities, countries] = await Promise.all([
      this.prisma.city.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
      this.prisma.country.findMany({ where: { id: { in: ids } }, select: { id: true, nameFr: true } }),
    ]);
    const names = new Map<string, string>([...cities.map((c) => [c.id, c.name] as const), ...countries.map((c) => [c.id, c.nameFr] as const)]);
    const resolveName = (id: string): string | undefined => names.get(id);
    const cell = (v: string | number): string => `"${String(v).replace(/"/g, '""')}"`;
    const rev = report.revision === null ? '' : String(report.revision);
    const lines = [
      ['trimestre', 'revision', 'indicateur', 'tranche', 'valeur'].map(cell).join(','),
      ...report.items.map((i) =>
        [report.trimestre, rev, i.metric, i.dimension === '' ? '' : (resolveName(i.dimension) ?? i.dimension), i.value].map(cell).join(','),
      ),
      ...report.temoignages.map((t) =>
        [report.trimestre, rev, `temoignage.${t.kind === 'GUIDE' ? 'guide' : 'conseil_de_ville'}`, t.cityName ?? '', t.quote].map(cell).join(','),
      ),
    ];
    return { report, text: `\uFEFF${lines.join('\r\n')}\r\n` };
  }
}
