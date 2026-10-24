import { Injectable, Logger } from '@nestjs/common';
import { newId, Prisma } from '@app/db';
import { PrismaService } from '../../common/prisma.service';

/**
 * Le pilotage — 15-administration.md §5, §6 et §10.
 *
 * CE QUE CE SERVICE EST, ET CE QU'IL N'EST PAS.
 *
 * Il n'écoute AUCUN événement de domaine, alors que §9 annonce « Consommés :
 * tous les événements de domaine (agrégation dans `metric_snapshots`) ». C'est
 * un écart assumé, et il vaut d'être expliqué plutôt que subi :
 *
 *   · un compteur incrémenté par événement DÉRIVE. Un événement rejoué — et le
 *     relais de la boîte d'envoi garantit « au moins une fois », pas « exactement
 *     une fois » — compterait deux fois, définitivement, sans que rien ne le
 *     signale. `scheduled-tasks.ts` pose l'idempotence comme propriété obligatoire
 *     de toute tâche : « une tâche qui compte au lieu de recalculer finirait par
 *     dériver ». La même phrase condamne l'agrégation par événement ;
 *   · un balayage qui RECALCULE depuis les tables métier est, lui, idempotent par
 *     construction : rejoué, il retrouve le même nombre.
 *
 * §10 le confirme en donnant à `metrics.refresh` une fréquence — « horaire » —
 * ce qu'une agrégation par événement n'aurait pas. Les deux lectures de la spec
 * sont donc réconciliables, et seule celle-ci tient l'idempotence.
 *
 * LES ÉCRITURES SONT EN AJOUT SEUL. `metric_snapshots` est de socle `append` :
 * une ligne posée n'est jamais modifiée. Un créneau rejoué n'écrase rien — il
 * n'insère rien, grâce à l'unicité `(metric, dimension, period_start)`. C'est
 * l'index qui porte l'idempotence, pas la prudence de ce fichier.
 */

/** La tranche globale, sans dimension. Voir la colonne `dimension` du schéma. */
export const GLOBAL_DIMENSION = '';

/** Un point à poser. `value` est un nombre JS ; la colonne est un `Decimal(18,4)`. */
export interface MetricPoint {
  readonly metric: string;
  readonly dimension: string;
  readonly value: number;
}

/**
 * Le début de l'heure, en UTC.
 *
 * §6 ne dit PAS dans quel fuseau `period_start` est tronqué. UTC est retenu parce
 * que c'est le seul choix qui ne déplace pas les points deux fois par an : à
 * Paris, le passage à l'heure d'hiver produit deux fois la même heure locale, et
 * l'unicité `(metric, dimension, period_start)` ferait alors PERDRE le second
 * relevé. Les courbes sont lues sur des jours et des semaines, où l'heure de
 * référence ne change rien.
 */
export function startOfHourUtc(now: Date): Date {
  const d = new Date(now.getTime());
  d.setUTCMinutes(0, 0, 0);
  return d;
}

/** Le début du jour, en UTC. Même raison qu'au-dessus. */
export function startOfDayUtc(now: Date): Date {
  const d = new Date(now.getTime());
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Le premier jour du trimestre, en UTC — le repère du rapport d'impact (§5.3). */
export function startOfQuarterUtc(now: Date): Date {
  const d = new Date(now.getTime());
  d.setUTCMonth(Math.floor(d.getUTCMonth() / 3) * 3, 1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** « 2026-T3 » — le libellé de trimestre attendu par `GET /impact?quarter`. */
export function quarterLabel(start: Date): string {
  return `${start.getUTCFullYear()}-T${Math.floor(start.getUTCMonth() / 3) + 1}`;
}

const DAY_MS = 86_400_000;

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Écriture — les quatre tâches de §10
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * `metrics.refresh` — §10, horaire : « vues matérialisées et `metric_snapshots` ».
   *
   * IL N'Y A PAS DE VUE MATÉRIALISÉE, et c'est délibéré. §5.1 demande un tableau
   * de bord « rafraîchi toutes les heures » ; une vue matérialisée et un instantané
   * horaire répondent à la même question, mais l'instantané répond en plus à
   * « et la semaine dernière ? », qui est justement ce que §6 appelle « historique
   * des indicateurs pour les courbes ». Deux mécanismes pour un besoin auraient
   * demandé de les garder cohérents ; un seul suffit. Si une vue devient
   * nécessaire pour le temps de réponse, elle s'ajoutera SOUS cette table, pas à
   * côté.
   *
   * Les blocs couverts sont ceux de §5.1 dont le modèle porte la donnée. Ceux qui
   * manquent sont nommés en fin de méthode plutôt que devinés.
   */
  async refreshMetrics(now: Date): Promise<{ periode: string; points: number; ecrits: number }> {
    const periodStart = startOfHourUtc(now);
    const points: MetricPoint[] = [];

    const since = (days: number): Date => new Date(now.getTime() - days * DAY_MS);

    // ── Membres (§5.1) ──────────────────────────────────────────────────────
    //
    // `deletedAt: null` PARTOUT : un membre supprimé ne doit plus peser sur un
    // effectif courant. Les lignes déjà posées, elles, ne bougent pas — §11 :
    // « `metric_snapshots` : agrégats, non concernés ».
    const live = { deletedAt: null } satisfies Prisma.UserWhereInput;

    points.push(
      { metric: 'members.registered', dimension: GLOBAL_DIMENSION, value: await this.prisma.user.count({ where: live }) },
      { metric: 'members.active_7d', dimension: GLOBAL_DIMENSION, value: await this.prisma.user.count({ where: { ...live, lastSeenAt: { gte: since(7) } } }) },
      { metric: 'members.active_30d', dimension: GLOBAL_DIMENSION, value: await this.prisma.user.count({ where: { ...live, lastSeenAt: { gte: since(30) } } }) },
      { metric: 'members.new_7d', dimension: GLOBAL_DIMENSION, value: await this.prisma.user.count({ where: { ...live, createdAt: { gte: since(7) } } }) },
    );

    for (const row of await this.prisma.user.groupBy({ by: ['phase'], where: live, _count: { _all: true } })) {
      points.push({ metric: 'members.by_phase', dimension: row.phase, value: row._count._all });
    }
    for (const row of await this.prisma.user.groupBy({ by: ['verificationLevel'], where: live, _count: { _all: true } })) {
      points.push({ metric: 'members.by_level', dimension: row.verificationLevel, value: row._count._all });
    }
    for (const row of await this.prisma.user.groupBy({ by: ['cityId'], where: live, _count: { _all: true } })) {
      // Une ville nulle est un membre en pré-départ sans ville cible : compté
      // dans `members.registered`, pas dans une tranche par ville.
      if (row.cityId === null) continue;
      points.push({ metric: 'members.by_city', dimension: row.cityId, value: row._count._all });
    }
    for (const row of await this.prisma.user.groupBy({ by: ['originCountryId'], where: live, _count: { _all: true } })) {
      points.push({ metric: 'members.by_origin_country', dimension: row.originCountryId, value: row._count._all });
    }

    // ── Parcours (§5.1) ─────────────────────────────────────────────────────
    for (const row of await this.prisma.journey.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } })) {
      points.push({ metric: 'journeys.by_status', dimension: row.status, value: row._count._all });
    }

    // ── Entraide (§5.1) ─────────────────────────────────────────────────────
    for (const row of await this.prisma.helpRequest.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } })) {
      points.push({ metric: 'help.by_status', dimension: row.status, value: row._count._all });
    }
    const firstResponse = await this.medianFirstResponseMinutes();
    if (firstResponse !== null) {
      points.push({ metric: 'help.first_response_median_minutes', dimension: GLOBAL_DIMENSION, value: firstResponse });
    }

    // ── Guides (§5.1) ───────────────────────────────────────────────────────
    for (const row of await this.prisma.guide.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } })) {
      points.push({ metric: 'guides.by_status', dimension: row.status, value: row._count._all });
    }
    points.push({ metric: 'guides.votes', dimension: GLOBAL_DIMENSION, value: await this.prisma.guideVote.count() });

    // ── Parrainage (§5.1) ───────────────────────────────────────────────────
    for (const row of await this.prisma.mentorship.groupBy({ by: ['status'], _count: { _all: true } })) {
      points.push({ metric: 'mentorships.by_status', dimension: row.status, value: row._count._all });
    }

    // ── Événements (§5.1) ───────────────────────────────────────────────────
    for (const row of await this.prisma.event.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } })) {
      points.push({ metric: 'events.by_status', dimension: row.status, value: row._count._all });
    }
    points.push({
      metric: 'events.checked_in',
      dimension: GLOBAL_DIMENSION,
      value: await this.prisma.eventAttendee.count({ where: { checkedIn: true } }),
    });

    // ── Réseaux (§5.1) ──────────────────────────────────────────────────────
    for (const row of await this.prisma.community.groupBy({ by: ['status'], _count: { _all: true } })) {
      points.push({ metric: 'communities.by_status', dimension: row.status, value: row._count._all });
    }

    // ── Services (§5.1) ─────────────────────────────────────────────────────
    for (const row of await this.prisma.housingListing.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } })) {
      points.push({ metric: 'housing.by_status', dimension: row.status, value: row._count._all });
    }
    for (const row of await this.prisma.jobListing.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } })) {
      points.push({ metric: 'jobs.by_status', dimension: row.status, value: row._count._all });
    }
    for (const row of await this.prisma.proProfile.groupBy({ by: ['verificationStatus'], where: { deletedAt: null }, _count: { _all: true } })) {
      points.push({ metric: 'pros.by_verification', dimension: row.verificationStatus, value: row._count._all });
    }

    // ── Modération (§5.1) ───────────────────────────────────────────────────
    for (const row of await this.prisma.moderationCase.groupBy({ by: ['status'], _count: { _all: true } })) {
      points.push({ metric: 'moderation.cases_by_status', dimension: row.status, value: row._count._all });
    }
    points.push({
      metric: 'moderation.sanctions_active',
      dimension: GLOBAL_DIMENSION,
      value: await this.prisma.sanction.count({ where: { liftedAt: null } }),
    });

    // ── Revenus (§5.1) ──────────────────────────────────────────────────────
    //
    // « Premium actifs » est ici. Le MRR, la répartition Mobile Money / carte et
    // l'affiliation NE SONT PAS posés : le MRR demande de joindre le prix du plan
    // et de le ramener au mois, ce que §5.1 nomme sans dire comment traiter les
    // plans annuels ni les remises, et l'affiliation attend les événements
    // `affiliate.clicked` / `converted` que le catalogue de la boîte d'envoi n'a
    // volontairement pas déclarés faute de consommateur. Remonté plutôt que
    // deviné : un MRR faux est pire qu'un MRR absent.
    for (const row of await this.prisma.subscription.groupBy({ by: ['status'], _count: { _all: true } })) {
      points.push({ metric: 'subscriptions.by_status', dimension: row.status, value: row._count._all });
    }

    const ecrits = await this.append(points, periodStart);
    return { periode: periodStart.toISOString(), points: points.length, ecrits };
  }

  /**
   * `metrics.key_indicator` — §10, quotidienne.
   *
   * §5.1, mot pour mot : « % des membres d'une ville ayant été cochés présents à
   * au moins un événement dans les 90 jours — par ville, courbe hebdomadaire.
   * Objectif : 30 % ».
   *
   * TROIS PRÉCISIONS que la phrase impose et qu'il faut lire :
   *
   *   · « cochés présents », donc `event_attendees.checked_in`, et NON le RSVP.
   *     Le commentaire de la colonne le dit : « la participation physique réelle,
   *     pas le RSVP ». Compter les inscrits gonflerait l'indicateur de tout ce
   *     qui ne s'est pas déplacé ;
   *   · « à au moins un », donc un `DISTINCT` sur le membre : trois présences ne
   *     font pas trois membres ;
   *   · « dans les 90 jours » porte sur la DATE DE L'ÉVÉNEMENT (`events.starts_at`),
   *     pas sur celle du pointage. Un pointage saisi en retard appartient à
   *     l'événement, pas au jour de la saisie.
   *
   * La cadence est QUOTIDIENNE (§10) alors que la courbe est HEBDOMADAIRE (§5.1) :
   * un point par jour se regroupe en semaine à la lecture, l'inverse est
   * impossible. La maille fine est donc le bon choix — signalé comme un écart
   * apparent qui n'en est pas un.
   */
  async refreshKeyIndicator(now: Date): Promise<{ periode: string; villes: number; ecrits: number }> {
    const periodStart = startOfDayUtc(now);
    const since = new Date(now.getTime() - 90 * DAY_MS);

    const rows = await this.prisma.$queryRaw<{ city_id: string; members: bigint; present: bigint }[]>`
      SELECT u.city_id                                                     AS city_id,
             count(DISTINCT u.id)                                          AS members,
             count(DISTINCT u.id) FILTER (WHERE a.user_id IS NOT NULL)     AS present
        FROM users u
        LEFT JOIN event_attendees a
               ON a.user_id = u.id
              AND a.checked_in = true
              AND EXISTS (SELECT 1 FROM events e
                           WHERE e.id = a.event_id
                             AND e.deleted_at IS NULL
                             AND e.starts_at >= ${since}
                             AND e.starts_at <= ${now})
       WHERE u.deleted_at IS NULL
         AND u.city_id IS NOT NULL
       GROUP BY u.city_id
    `;

    const points: MetricPoint[] = [];
    for (const row of rows) {
      const members = Number(row.members);
      if (members === 0) continue;
      const present = Number(row.present);
      points.push({
        metric: 'key_indicator.event_presence_90d',
        dimension: row.city_id,
        value: Math.round((present / members) * 1_000_000) / 10_000,
      });
      // Le numérateur et le dénominateur sont posés À CÔTÉ du pourcentage : sans
      // eux, « 50 % » ne distingue pas une ville de deux membres d'une ville de
      // deux cents, et l'objectif de 30 % de §5.1 se lirait sur du bruit.
      points.push({ metric: 'key_indicator.city_members', dimension: row.city_id, value: members });
      points.push({ metric: 'key_indicator.city_present_90d', dimension: row.city_id, value: present });
    }

    const ecrits = await this.append(points, periodStart);
    return { periode: periodStart.toISOString(), villes: rows.length, ecrits };
  }

  /**
   * `stats.steps_recompute` — §10, hebdomadaire ; le contenu est §5.2.
   *
   * §5.2 demande trois familles, et les trois sont ici :
   *
   *   · « Délais réels par étape : médiane, quartiles, effectif, par
   *     `step_definition` » — proposés comme `default_duration_days` à la
   *     prochaine version du modèle. `PERCENTILE_CONT` côté PostgreSQL plutôt
   *     qu'un tri en mémoire : la table des étapes croît avec les parcours, et
   *     rapatrier toutes les durées pour en prendre la médiane serait le premier
   *     balayage non borné du planificateur ;
   *   · « Étapes bloquantes : nombre de `blocker_requests` par étape / nombre de
   *     parcours passés par l'étape » — suggère `is_risky`. Le RATIO est posé,
   *     et pas seulement le compte : c'est ce que la spec demande ;
   *   · « Étapes sautées ou supprimées par les membres » — suggère de les rendre
   *     optionnelles.
   *
   * §5.2 dit « par `step_definition` ET par pays d'origine ». Seule la première
   * maille est posée : la seconde multiplierait les lignes par le nombre de pays
   * pour un effectif qui, à ce stade, ne permettrait aucune médiane crédible.
   * Remonté plutôt que livré à moitié.
   *
   * RÈGLE DURE §5.2 : « Aucune statistique n'affiche un taux de réussite ou
   * d'échec côté membres. » Rien ici n'est exposé au membre — la seule lecture est
   * `/v1/admin/stats/*`, derrière `StaffGuard`.
   */
  async recomputeStepStats(now: Date): Promise<{ periode: string; etapes: number; ecrits: number }> {
    const periodStart = startOfDayUtc(now);

    const durations = await this.prisma.$queryRaw<
      { step_definition_id: string; n: bigint; p25: number | null; p50: number | null; p75: number | null }[]
    >`
      SELECT s.step_definition_id                                                        AS step_definition_id,
             count(*)                                                                    AS n,
             percentile_cont(0.25) WITHIN GROUP (ORDER BY s.duration_days)::float8       AS p25,
             percentile_cont(0.50) WITHIN GROUP (ORDER BY s.duration_days)::float8       AS p50,
             percentile_cont(0.75) WITHIN GROUP (ORDER BY s.duration_days)::float8       AS p75
        FROM journey_steps s
       WHERE s.step_definition_id IS NOT NULL
         AND s.duration_days IS NOT NULL
       GROUP BY s.step_definition_id
    `;

    const points: MetricPoint[] = [];
    for (const row of durations) {
      points.push({ metric: 'stats.step.effectif', dimension: row.step_definition_id, value: Number(row.n) });
      if (row.p25 !== null) points.push({ metric: 'stats.step.p25_days', dimension: row.step_definition_id, value: row.p25 });
      if (row.p50 !== null) points.push({ metric: 'stats.step.median_days', dimension: row.step_definition_id, value: row.p50 });
      if (row.p75 !== null) points.push({ metric: 'stats.step.p75_days', dimension: row.step_definition_id, value: row.p75 });
    }

    // « nombre de `blocker_requests` (publiés + privés + annulés) par étape /
    // nombre de parcours passés par l'étape ». Le dénominateur est le nombre
    // d'étapes instanciées portant cette définition — c'est cela, « un parcours
    // passé par l'étape ».
    const blockers = await this.prisma.$queryRaw<
      { step_definition_id: string; steps: bigint; blockers: bigint }[]
    >`
      SELECT s.step_definition_id                    AS step_definition_id,
             count(DISTINCT s.id)                    AS steps,
             count(b.id)                             AS blockers
        FROM journey_steps s
        LEFT JOIN blocker_requests b ON b.journey_step_id = s.id
       WHERE s.step_definition_id IS NOT NULL
       GROUP BY s.step_definition_id
    `;
    for (const row of blockers) {
      const steps = Number(row.steps);
      if (steps === 0) continue;
      points.push({ metric: 'stats.step.blocker_ratio', dimension: row.step_definition_id, value: Math.round((Number(row.blockers) / steps) * 10_000) / 10_000 });
    }

    // « Étapes sautées » : instanciées, jamais commencées, sur un parcours qui a
    // dépassé leur position. Sans la comparaison de position, une étape encore à
    // venir compterait comme sautée sur tout parcours en cours.
    const skipped = await this.prisma.$queryRaw<{ step_definition_id: string; skipped: bigint }[]>`
      SELECT s.step_definition_id AS step_definition_id,
             count(*)             AS skipped
        FROM journey_steps s
        JOIN journeys j ON j.id = s.journey_id
       WHERE s.step_definition_id IS NOT NULL
         AND s.started_at IS NULL
         AND EXISTS (SELECT 1 FROM journey_steps later
                      WHERE later.journey_id = s.journey_id
                        AND later.position > s.position
                        AND later.started_at IS NOT NULL)
       GROUP BY s.step_definition_id
    `;
    for (const row of skipped) {
      points.push({ metric: 'stats.step.skipped', dimension: row.step_definition_id, value: Number(row.skipped) });
    }

    const ecrits = await this.append(points, periodStart);
    return { periode: periodStart.toISOString(), etapes: durations.length, ecrits };
  }

  /**
   * `impact.quarterly_prepare` — §10, « 1er jour du trimestre ».
   *
   * §5.3 : « membres accompagnés, parcours aboutis, présences aux événements,
   * entraides résolues, guides produits, parrainages menés, répartition par ville
   * et par pays ». Le trimestre préparé est le trimestre ÉCOULÉ, pas celui qui
   * commence : au 1er janvier, le rapport qu'un financeur attend est celui
   * d'octobre à décembre, et celui qui commence est vide par construction.
   *
   * RÈGLE DURE §5.3 : « Toutes les données sont agrégées, jamais nominatives. »
   * Aucune ligne posée ici ne porte d'identifiant de membre : les seules
   * dimensions sont des villes et des pays, et §12 en fait un test
   * (`rule: le rapport d'impact ne contient aucune donnée nominative`).
   *
   * Les TÉMOIGNAGES de §5.3 ne sont pas ici : ils demandent `guides.quotable` et
   * `city_tips.quotable`, deux colonnes que §6 annonce « Ajoutées » et qui
   * n'existent pas au schéma. Remonté, non contourné — citer un membre sans son
   * accord serait exactement ce que la colonne existe pour empêcher.
   */
  async prepareQuarterlyImpact(now: Date): Promise<{ trimestre: string; ecrits: number }> {
    const currentQuarter = startOfQuarterUtc(now);
    const periodStart = startOfQuarterUtc(new Date(currentQuarter.getTime() - DAY_MS));
    const periodEnd = currentQuarter;
    const window = { gte: periodStart, lt: periodEnd };

    const points: MetricPoint[] = [];

    points.push({
      metric: 'impact.members_accompanied',
      dimension: GLOBAL_DIMENSION,
      value: await this.prisma.user.count({ where: { deletedAt: null, createdAt: { lt: periodEnd } } }),
    });
    points.push({
      metric: 'impact.journeys_completed',
      dimension: GLOBAL_DIMENSION,
      value: await this.prisma.journey.count({ where: { deletedAt: null, status: 'COMPLETED', completedAt: window } }),
    });
    points.push({
      metric: 'impact.event_attendances',
      dimension: GLOBAL_DIMENSION,
      value: await this.prisma.eventAttendee.count({ where: { checkedIn: true, event: { startsAt: window, deletedAt: null } } }),
    });
    points.push({
      metric: 'impact.help_resolved',
      dimension: GLOBAL_DIMENSION,
      value: await this.prisma.helpRequest.count({ where: { deletedAt: null, resolvedAt: window } }),
    });
    points.push({
      metric: 'impact.guides_published',
      dimension: GLOBAL_DIMENSION,
      value: await this.prisma.guide.count({ where: { deletedAt: null, status: 'PUBLISHED', createdAt: window } }),
    });
    points.push({
      metric: 'impact.mentorships_completed',
      dimension: GLOBAL_DIMENSION,
      value: await this.prisma.mentorship.count({ where: { status: 'ENDED', endedAt: window } }),
    });

    // « répartition par ville et par pays » — agrégats, jamais nominatifs.
    for (const row of await this.prisma.user.groupBy({ by: ['cityId'], where: { deletedAt: null, createdAt: { lt: periodEnd } }, _count: { _all: true } })) {
      if (row.cityId === null) continue;
      points.push({ metric: 'impact.members_by_city', dimension: row.cityId, value: row._count._all });
    }
    for (const row of await this.prisma.user.groupBy({ by: ['originCountryId'], where: { deletedAt: null, createdAt: { lt: periodEnd } }, _count: { _all: true } })) {
      points.push({ metric: 'impact.members_by_origin_country', dimension: row.originCountryId, value: row._count._all });
    }

    const ecrits = await this.append(points, periodStart);
    return { trimestre: quarterLabel(periodStart), ecrits };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Lecture — §7 (`GET /admin/dashboard`, `/admin/stats/*`, `/admin/impact`)
  // ───────────────────────────────────────────────────────────────────────────

  /** Les derniers points connus d'un ensemble de métriques. Le tableau de bord. */
  async latest(metrics: readonly string[]): Promise<{ metric: string; dimension: string; value: number; periodStart: string }[]> {
    if (metrics.length === 0) return [];
    const rows = await this.prisma.$queryRaw<
      { metric: string; dimension: string; value: Prisma.Decimal; period_start: Date }[]
    >`
      SELECT DISTINCT ON (metric, dimension) metric, dimension, value, period_start
        FROM metric_snapshots
       WHERE metric IN (${Prisma.join(metrics)})
       ORDER BY metric, dimension, period_start DESC
    `;
    return rows.map((r) => ({
      metric: r.metric,
      dimension: r.dimension,
      value: Number(r.value),
      periodStart: r.period_start.toISOString(),
    }));
  }

  /** Le client, pour qu'un contrôleur de ce module écrive une trace d'audit. */
  prismaClient(): PrismaService {
    return this.prisma;
  }

  /**
   * 15 §5.2 : « Migration : parcours restés sur une version archivée ».
   *
   * CALCULÉ À LA DEMANDE, pas lu dans `metric_snapshots` : c'est une question sur
   * l'état courant (combien de parcours EN COURS restent figés sur une version que
   * plus aucun nouveau parcours ne prend), et un instantané horaire la rendrait
   * fausse juste après une publication — le moment précis où l'équipe la pose.
   *
   * AGRÉGÉ, jamais nominatif (§5.3) : un effectif par version, aucun identifiant de
   * membre. Seuls les parcours ACTIVE et PAUSED comptent : un parcours terminé ou
   * abandonné n'a aucune raison de migrer.
   */
  async migrations(): Promise<
    {
      templateId: string;
      templateCode: string;
      templateName: string;
      versionId: string;
      version: number;
      originCountryId: string | null;
      journeys: number;
      currentVersion: number | null;
    }[]
  > {
    const grouped = await this.prisma.journey.groupBy({
      by: ['templateVersionId'],
      where: { status: { in: ['ACTIVE', 'PAUSED'] }, templateVersion: { status: 'ARCHIVED' } },
      _count: { _all: true },
    });
    if (grouped.length === 0) return [];
    const versions = await this.prisma.journeyTemplateVersion.findMany({
      where: { id: { in: grouped.map((g) => g.templateVersionId) } },
      select: {
        id: true,
        version: true,
        originCountryId: true,
        template: { select: { id: true, code: true, nameFr: true } },
      },
    });
    const published = await this.prisma.journeyTemplateVersion.findMany({
      where: { status: 'PUBLISHED', templateId: { in: versions.map((v) => v.template.id) } },
      select: { templateId: true, version: true, originCountryId: true },
    });
    const counts = new Map(grouped.map((g) => [g.templateVersionId, g._count._all]));
    return versions
      .map((v) => ({
        templateId: v.template.id,
        templateCode: v.template.code,
        templateName: v.template.nameFr,
        versionId: v.id,
        version: v.version,
        originCountryId: v.originCountryId,
        journeys: counts.get(v.id) ?? 0,
        currentVersion:
          published.find((p) => p.templateId === v.template.id && p.originCountryId === v.originCountryId)?.version ??
          published.find((p) => p.templateId === v.template.id && p.originCountryId === null)?.version ??
          null,
      }))
      .sort((a, b) => b.journeys - a.journeys);
  }

  /** La courbe d'une métrique — ce pour quoi §6 crée la table. */
  async series(
    metric: string,
    options: {
      readonly dimension?: string | undefined;
      readonly from?: Date | undefined;
      readonly to?: Date | undefined;
      readonly limit?: number | undefined;
    } = {},
  ): Promise<{ dimension: string; value: number; periodStart: string }[]> {
    const rows = await this.prisma.metricSnapshot.findMany({
      where: {
        metric,
        ...(options.dimension === undefined ? {} : { dimension: options.dimension }),
        ...(options.from === undefined && options.to === undefined
          ? {}
          : {
              periodStart: {
                ...(options.from === undefined ? {} : { gte: options.from }),
                ...(options.to === undefined ? {} : { lte: options.to }),
              },
            }),
      },
      orderBy: { periodStart: 'asc' },
      take: Math.min(options.limit ?? 500, 2_000),
      select: { dimension: true, value: true, periodStart: true },
    });
    return rows.map((r) => ({ dimension: r.dimension, value: Number(r.value), periodStart: r.periodStart.toISOString() }));
  }

  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Pose les points du créneau. Le cœur de l'idempotence des quatre tâches.
   *
   * `skipDuplicates` s'appuie sur l'unicité `(metric, dimension, period_start)` :
   * rejouer le créneau n'insère RIEN et ne lève pas. Sans elle, une reprise BullMQ
   * doublerait chaque point de la courbe — et un doublon dans un historique ne se
   * voit qu'au moment où quelqu'un lit le graphique, des semaines plus tard.
   */
  private async append(points: readonly MetricPoint[], periodStart: Date): Promise<number> {
    if (points.length === 0) return 0;
    const result = await this.prisma.metricSnapshot.createMany({
      data: points.map((p) => ({
        id: newId(),
        metric: p.metric,
        dimension: p.dimension,
        value: new Prisma.Decimal(p.value),
        periodStart,
      })),
      skipDuplicates: true,
    });
    if (result.count !== points.length) {
      // Normal sur une reprise, anormal sur un premier passage. `debug` : le
      // planificateur journalise déjà le résumé rendu par la tâche.
      this.logger.debug(`${points.length - result.count} point(s) déjà posé(s) pour ${periodStart.toISOString()}`);
    }
    return result.count;
  }

  /**
   * Le « délai médian de première réponse » de §5.1, en minutes.
   *
   * Sur les demandes RÉPONDUES seulement : une demande sans réponse n'a pas de
   * délai, et lui en prêter un (l'ancienneté, par exemple) ferait grandir la
   * médiane avec le temps sans qu'aucune réponse n'ait ralenti.
   */
  private async medianFirstResponseMinutes(): Promise<number | null> {
    const rows = await this.prisma.$queryRaw<{ median: number | null }[]>`
      SELECT percentile_cont(0.5) WITHIN GROUP (
               ORDER BY EXTRACT(EPOCH FROM (first_at - created_at)) / 60
             )::float8 AS median
        FROM (
          SELECT r.created_at, min(p.created_at) AS first_at
            FROM help_requests r
            JOIN help_responses p ON p.help_request_id = r.id
           WHERE r.deleted_at IS NULL
           GROUP BY r.id, r.created_at
        ) t
    `;
    const median = rows[0]?.median;
    return median === undefined || median === null ? null : Math.round(median * 100) / 100;
  }
}
