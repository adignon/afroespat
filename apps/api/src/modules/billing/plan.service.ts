import { monetisationActive } from '../../common/monetisation';
import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@app/db';
import {
  BILLING_YEAR_PRICES_SETTING_KEY,
  PLAN_YEAR_PRICES_DEFAULT,
  type PaidPlanCode,
  type PlanCode,
  type PlanLimits,
  type UserPlan,
  planLimitsSchema,
  seededLimitsFor,
  xofFromEurCents,
  yearPricesSchema,
} from '@app/shared';
import { PrismaService } from '../../common/prisma.service';

/**
 * Les plans et leurs limites — 14-monetisation.md §3.
 *
 * « `plans.limits` est la source unique des quotas ; les modules lisent les
 * limites via `PlanService.limitsFor(userId)` (cache Redis 5 min, invalidé sur
 * `subscription.changed`). »
 *
 * CE QUE LE CACHE MET EN CACHE, ET POURQUOI CE N'EST PAS CE QUE LA SPEC DIT.
 *
 * La spec décrit un cache par MEMBRE. Ce service met en cache par CODE DE PLAN, et
 * lit `users.plan` frais à chaque appel. Les deux rendent le même résultat — les
 * limites ne dépendent que du code — mais le second n'a pas le défaut du premier :
 * un cache par membre reste faux pendant cinq minutes après un paiement, et c'est
 * précisément le moment où le membre essaie sa nouvelle limite. Ici, un changement
 * de plan est visible IMMÉDIATEMENT, et le cache ne couvre que ce qui bouge une
 * fois par trimestre : quatre lignes de `plans`.
 *
 * Le cache est EN MÉMOIRE DU PROCESSUS, et non dans Redis. Conséquence à connaître
 * et assumée : un prix ou une limite modifiés par un SUPER_ADMIN mettent au pire
 * cinq minutes à se propager aux autres instances de l'API. L'instance qui a reçu
 * la modification, elle, purge tout de suite. Passer à Redis est un changement
 * d'un seul endroit (`readLimits`), et la contrepartie serait d'exiger Redis de
 * toute suite d'intégration — ce que ce dépôt évite partout ailleurs.
 *
 * L'INVALIDATION SUR `subscription.changed` DEVIENT INUTILE, et c'est la
 * conséquence heureuse du choix ci-dessus : ce que `subscription.changed` change,
 * c'est le plan DU MEMBRE, pas les limites du plan. Rien à purger.
 */
@Injectable()
export class PlanService {
  private readonly logger = new Logger(PlanService.name);

  /** Cinq minutes, comme le veut §3. */
  private static readonly TTL_MS = 5 * 60 * 1_000;

  private cache: { readonly at: number; readonly rows: ReadonlyMap<PlanCode, PlanRow> } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  // ══ Lectures ══════════════════════════════════════════════════════════════

  /**
   * Les limites applicables à un membre. LE point d'entrée des autres modules.
   *
   * Un membre dont la ligne a disparu n'existe pas : on rend les limites du plan
   * gratuit plutôt que de lever. L'appelant est en train d'appliquer une limite,
   * pas d'authentifier — et la limite la plus stricte est la bonne réponse au doute.
   */
  async limitsFor(userId: string): Promise<PlanLimits> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
    const reel = await this.limitsOf(user?.plan ?? 'FREE');
    if (await monetisationActive(this.prisma)) return reel;
    // LOT A : « tout gratuit » — les droits de PREMIUM pour tous. Une seule
    // exception, `hidePartners` : ce n'est pas un droit de plus mais la
    // disparition des encarts partenaires, une recette que le porteur n'a pas
    // demandé de supprimer. Elle suit le plan RÉEL (donc : encarts visibles).
    return { ...(await this.limitsOf('PREMIUM')), hidePartners: reel.hidePartners };
  }

  /** Les limites d'un code de plan, depuis `plans.limits`. */
  async limitsOf(code: PlanCode): Promise<PlanLimits> {
    const rows = await this.rows();
    return rows.get(code)?.limits ?? seededLimitsFor(code);
  }

  /** `GET /plans` (§7.1) : prix en EUR et en XOF, période, limites. */
  async publicPlans(): Promise<readonly PublicPlan[]> {
    const rows = await this.rows();
    const yearPrices = await this.yearPrices();

    return [...rows.values()]
      .filter((p) => p.isActive)
      .sort((a, b) => a.priceCents - b.priceCents)
      .map((p) => {
        const yearCents = p.code === 'FREE' ? 0 : yearPrices[p.code];
        return {
          code: p.code,
          nameFr: p.nameFr,
          month: money(p.priceCents),
          year: money(yearCents),
          limits: p.limits,
        };
      });
  }

  /**
   * Les prix annuels, depuis `system_settings`.
   *
   * La valeur est REVALIDÉE contre le schéma partagé à la lecture, jamais crue :
   * `system_settings.value` est un `Json` libre, et une valeur écrite par une
   * version antérieure du back-office ferait sinon passer `undefined` dans un
   * montant — donc `NaN` centimes affichés au membre.
   */
  async yearPrices(): Promise<Record<PaidPlanCode, number>> {
    const row = await this.prisma.systemSetting.findUnique({
      where: { key: BILLING_YEAR_PRICES_SETTING_KEY },
      select: { value: true },
    });
    const parsed = yearPricesSchema.safeParse(row?.value);
    if (!parsed.success) {
      if (row !== null) {
        this.logger.warn(
          `${BILLING_YEAR_PRICES_SETTING_KEY} illisible en base : les prix annuels du code sont employés.`,
        );
      }
      return PLAN_YEAR_PRICES_DEFAULT;
    }
    return parsed.data;
  }

  /** Le prix d'une souscription, dans la devise du canal choisi. */
  async priceFor(
    code: PaidPlanCode,
    period: 'MONTH' | 'YEAR',
    currency: 'EUR' | 'XOF',
  ): Promise<{ amountCents: number; currency: 'EUR' | 'XOF' }> {
    const rows = await this.rows();
    const monthCents = rows.get(code)?.priceCents ?? 0;
    const yearCents = (await this.yearPrices())[code];
    const eurCents = period === 'YEAR' ? yearCents : monthCents;
    return currency === 'EUR'
      ? { amountCents: eurCents, currency: 'EUR' }
      : // Le XOF n'a pas de sous-unité : `amountCents` porte des francs entiers.
        { amountCents: xofFromEurCents(eurCents), currency: 'XOF' };
  }

  /** L'identifiant de la ligne `plans` d'un code. Lève si la table n'est pas amorcée. */
  async idOf(code: PlanCode): Promise<string> {
    const rows = await this.rows();
    const row = rows.get(code);
    if (row === undefined) {
      throw new Error(
        `La table plans n'est pas amorcée pour ${code} : lancez pnpm db:seed (14 §3).`,
      );
    }
    return row.id;
  }

  // ══ Écriture (§7.2, SUPER_ADMIN) ══════════════════════════════════════════

  /** Purge le cache. Appelée après toute écriture de `plans`. */
  invalidate(): void {
    this.cache = null;
  }

  // ══ `users.plan` ══════════════════════════════════════════════════════════

  /**
   * Le plan que les abonnements du membre impliquent — la DÉRIVATION, en un seul
   * endroit.
   *
   * `users.plan` est une dénormalisation : trois modules livrés la lisent pour
   * appliquer un quota (parcours, agenda, annuaire pro) et le jeton d'accès la
   * porte. Elle ne doit donc jamais être « posée » par un appelant, mais toujours
   * RECALCULÉE depuis les abonnements — ce qui rend l'opération idempotente, donc
   * rejouable par un gestionnaire d'événement ou une tâche.
   *
   * `ACTIVE` et `PAST_DUE` donnent tous deux PREMIUM : §4.3 laisse trois
   * tentatives sur sept jours avant l'expiration, et couper l'accès au premier
   * échec de carte reviendrait à ne pas les laisser. C'est la TÂCHE
   * `billing.expire_subscriptions` qui rend le statut véridique ; ici on ne
   * regarde que le statut, pour que la règle vive à un seul endroit.
   *
   * `UserPlan` n'a que FREE et PREMIUM : un abonnement PRO ne touche pas
   * `users.plan`, il porte sur une FICHE (§4.3, « Premium et Pro sont
   * indépendants »).
   */
  async recomputeUserPlan(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<{ plan: UserPlan; changed: boolean }> {
    const premiumId = await this.idOf('PREMIUM');
    const active = await tx.subscription.count({
      where: { userId, planId: premiumId, status: { in: ['ACTIVE', 'PAST_DUE'] } },
    });
    const plan: UserPlan = active > 0 ? 'PREMIUM' : 'FREE';

    const user = await tx.user.findUnique({ where: { id: userId }, select: { plan: true } });
    if (user === null || user.plan === plan) return { plan, changed: false };

    await tx.user.update({ where: { id: userId }, data: { plan } });
    return { plan, changed: true };
  }

  // ══ Interne ═══════════════════════════════════════════════════════════════

  private async rows(): Promise<ReadonlyMap<PlanCode, PlanRow>> {
    const cached = this.cache;
    if (cached !== null && Date.now() - cached.at < PlanService.TTL_MS) return cached.rows;

    const found = await this.prisma.plan.findMany({
      select: { id: true, code: true, nameFr: true, priceCents: true, limits: true, isActive: true },
    });

    const rows = new Map<PlanCode, PlanRow>();
    for (const row of found) {
      rows.set(row.code, {
        id: row.id,
        code: row.code,
        nameFr: row.nameFr,
        priceCents: row.priceCents,
        isActive: row.isActive,
        limits: this.readLimits(row.code, row.limits),
      });
    }

    if (rows.size === 0) {
      // Pas une exception : plusieurs modules livrés fonctionnent déjà avec la
      // table vide, en retombant sur la valeur de leur spec. On le DIT, parce que
      // c'est un défaut d'exploitation qui se corrige en une commande.
      this.logger.warn('La table plans est VIDE : les limites de la spec sont employées (pnpm db:seed).');
    }

    this.cache = { at: Date.now(), rows };
    return rows;
  }

  /**
   * `plans.limits` est un `Json` : on le VALIDE, on ne le croit pas.
   *
   * Une ligne écrite à la main, ou par une version antérieure du back-office, peut
   * ne porter qu'une partie des clés. Le repli se fait alors clé par clé sur les
   * valeurs d'amorçage plutôt qu'en bloc : une limite de parcours administrée ne
   * doit pas être perdue parce qu'un drapeau d'affichage manque à côté d'elle.
   */
  private readLimits(code: PlanCode, raw: unknown): PlanLimits {
    const seeded = seededLimitsFor(code);
    const strict = planLimitsSchema.safeParse(raw);
    if (strict.success) return strict.data;

    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      this.logger.warn(`plans.limits illisible pour ${code} : valeurs de la spec employées.`);
      return seeded;
    }
    const merged = planLimitsSchema.safeParse({ ...seeded, ...(raw as Record<string, unknown>) });
    if (merged.success) return merged.data;

    this.logger.warn(`plans.limits partiellement invalide pour ${code} : valeurs de la spec employées.`);
    return seeded;
  }
}

interface PlanRow {
  readonly id: string;
  readonly code: PlanCode;
  readonly nameFr: string;
  readonly priceCents: number;
  readonly isActive: boolean;
  readonly limits: PlanLimits;
}

export interface PublicPlan {
  readonly code: PlanCode;
  readonly nameFr: string;
  readonly month: PlanPrice;
  readonly year: PlanPrice;
  readonly limits: PlanLimits;
}

interface PlanPrice {
  readonly eur: { amountCents: number; currency: 'EUR' };
  readonly xof: { amountCents: number; currency: 'XOF' };
}

/**
 * Le prix dans les deux devises, toujours les deux.
 *
 * §8 : « bouton Premium (prix EUR/XOF selon pays) ». Le SERVEUR n'a pas à
 * choisir : le membre peut être béninois en France, ou français au Bénin, et le
 * pays déduit d'une IP serait faux la moitié du temps. On envoie les deux, le
 * front montre celui qui correspond au canal de paiement choisi.
 */
function money(eurCents: number): PlanPrice {
  return {
    eur: { amountCents: eurCents, currency: 'EUR' },
    xof: { amountCents: xofFromEurCents(eurCents), currency: 'XOF' },
  };
}
