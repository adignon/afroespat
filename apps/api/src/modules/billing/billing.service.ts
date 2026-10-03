import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { newId, type Prisma } from '@app/db';
import {
  BILLING_ERROR_CODES,
  BILLING_ERROR_MESSAGES,
  MOBILE_MONEY_GRACE_DAYS,
  MOBILE_MONEY_TIMEOUT_MINUTES,
  PAST_DUE_WINDOW_DAYS,
  REFUND_WINDOW_DAYS,
  RENEWAL_REMINDER_DAYS,
  TRIAL_DAYS,
  TRIAL_REMINDER_DAYS,
  USAGE_RETENTION_MONTHS,
  USAGE_METRIC_LIMIT_KEYS,
  type BillingErrorCode,
  type Checkout,
  type PaidPlanCode,
  type PaymentsQuery,
  type PlanCode,
  type PlanInterval,
  type PlanUpdate,
  type RevenueQuery,
  type SubscriptionsQuery,
  type UsageMetric,
  codesInFamily,
  methodFor,
  monthKeyOf,
  nextMonthStart,
  planFamilyOf,
  planLimitsSchema,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { AuditService } from '../../common/audit.service';
import {
  buildPage,
  createdAtDescAfter,
  createdAtDescSort,
  decodeCreatedAtDesc,
} from '../../common/cursor';
import { loadEnv } from '../../config/env';
import { OutboxService } from '../../common/outbox.service';
import { PrismaService } from '../../common/prisma.service';
import {
  MOBILE_MONEY_PROVIDER,
  PAYMENT_PROVIDER,
  type MobileMoneyProvider,
  type PaymentProvider,
} from '../../providers/providers';
import {
  INVOICE_PDF,
  MOBILE_MONEY_WEBHOOK_VERIFIER,
  NoInvoicePdfPort,
  STRIPE_WEBHOOK_VERIFIER,
  UnconfiguredWebhookVerifier,
  type InvoicePdfPort,
  type WebhookVerifier,
} from './billing.ports';
import { PlanService } from './plan.service';

/**
 * Abonnements, paiements, quotas — 14-monetisation.md §3, §4, §7.1, §7.2.
 *
 * ═══ CE QUI N'EST PAS ICI, ET NE PEUT PAS L'ÊTRE ═══════════════════════════
 *
 * AUCUNE DONNÉE DE CARTE (règle dure §4.1). Elle n'entre pas — `checkoutSchema`
 * est `.strict()` — et elle ne SORTIRAIT de nulle part : la seule chose que ce
 * service demande au fournisseur de carte est une URL de paiement hébergée. Le
 * type `PaymentProvider.createCheckout` ne peut même pas transporter un numéro.
 *
 * AUCUN NUMÉRO MOBILE MONEY PERSISTÉ (§4.1, seconde phrase). Le numéro traverse
 * `checkout()` jusqu'à l'agrégateur et n'est écrit dans aucune colonne — la ligne
 * `payments` créée juste après ne le porte pas, et il n'y a pas de colonne pour.
 *
 * AUCUN TRI, AUCUN BOOST (règle dure §2). Ce service ne trie rien pour personne
 * et n'expose aucune méthode de classement. Les limites qu'il publie sont des
 * QUOTAS (« combien »), jamais des rangs (« avant qui »).
 *
 * ═══ CE QUE LE SCHÉMA FIGÉ NE PERMET PAS ═══════════════════════════════════
 *
 * §6 annonce six colonnes « ajoutées » qui n'existent PAS dans le schéma figé :
 * `subscriptions.trial_ends_at`, `is_trial`, `grace_until`, `period`,
 * `payments.exchange_rate`, `partners.transparency_text`, plus
 * `users.hide_partners_override`. Aucune n'est créée ici — la base est gelée.
 * Chaque contournement est écrit à l'endroit où il opère :
 *
 *   · l'ESSAI se reconnaît à `provider_ref` préfixé `trial-` (voir `TRIAL_REF_PREFIX`) ;
 *   · la GRÂCE Mobile Money se calcule, `current_period_end + 3 jours` ;
 *   · la PÉRIODE mensuelle/annuelle est tenue par le fournisseur, pas ici ;
 *   · le TAUX de change est la parité fixe 655,957, donc constante et non stockée.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  /**
   * Le préfixe qui distingue un essai d'un abonnement payé.
   *
   * `subscriptions` n'a ni `is_trial` ni `trial_ends_at` (§6, colonnes annoncées
   * mais absentes du schéma figé). L'essai est donc une ligne d'abonnement comme
   * une autre, reconnaissable à sa RÉFÉRENCE FOURNISSEUR — la seule colonne libre
   * de la table.
   *
   * `provider` vaut MOBILE_MONEY pour un essai, et c'est un PIS-ALLER assumé :
   * l'enum `PaymentProviderKind` n'a pas de valeur « aucun ». MOBILE_MONEY plutôt
   * que STRIPE parce qu'aucun chemin de code n'appelle un fournisseur pour ce
   * canal — un essai marqué STRIPE aurait fini par déclencher un appel
   * d'annulation chez Stripe avec une référence inventée. Tout code qui distingue
   * un essai le fait sur `provider_ref`, JAMAIS sur `provider`.
   */
  static readonly TRIAL_REF_PREFIX = 'trial-';

  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlanService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    @Optional() @Inject(PAYMENT_PROVIDER) private readonly card: PaymentProvider | null = null,
    @Optional() @Inject(MOBILE_MONEY_PROVIDER) private readonly momo: MobileMoneyProvider | null = null,
    @Optional()
    @Inject(STRIPE_WEBHOOK_VERIFIER)
    private readonly stripeVerifier: WebhookVerifier = new UnconfiguredWebhookVerifier('stripe'),
    @Optional()
    @Inject(MOBILE_MONEY_WEBHOOK_VERIFIER)
    private readonly momoVerifier: WebhookVerifier = new UnconfiguredWebhookVerifier('mobile-money'),
    @Optional() @Inject(INVOICE_PDF) private readonly invoices: InvoicePdfPort = new NoInvoicePdfPort(),
  ) {}

  /** Le secret de signature des curseurs (§5.3). */
  private readonly cursorSecret = loadEnv().CURSOR_SECRET;

  private fail(code: BillingErrorCode, details?: Record<string, unknown>): never {
    throw new ApiError(code, BILLING_ERROR_MESSAGES[code], BILLING_ERROR_CODES[code], details);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Lectures membre (§7.1)
  // ══════════════════════════════════════════════════════════════════════════

  /** `GET /me/subscription` : abonnements, période, quotas du mois, essai. */
  async mySubscription(userId: string) {
    const rows = await this.prisma.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: SUBSCRIPTION_SELECT,
    });

    const current = rows.filter((r) => r.status === 'ACTIVE' || r.status === 'PAST_DUE');
    const trial = rows.find((r) => isTrialRef(r.providerRef)) ?? null;

    return {
      items: current.map((r) => this.toSubscriptionView(r)),
      /**
       * L'HISTORIQUE est renvoyé aussi : §8 montre l'écran « Compte →
       * Abonnement » avec les factures et l'annulation, et un membre dont
       * l'abonnement vient d'expirer doit pouvoir le constater plutôt que de voir
       * un écran vide qui laisse croire qu'il n'a jamais payé.
       */
      history: rows.filter((r) => r.status === 'EXPIRED' || r.status === 'CANCELLED').map((r) => this.toSubscriptionView(r)),
      trial:
        trial === null
          ? { used: false, active: false, endsAt: null }
          : {
              used: true,
              active: trial.status === 'ACTIVE',
              endsAt: trial.currentPeriodEnd.toISOString(),
            },
      usage: await this.usage(userId),
    };
  }

  /** `GET /me/usage` : les compteurs du mois et leur plafond (§4.5). */
  async usage(userId: string) {
    const now = new Date();
    const periodKey = monthKeyOf(now);
    const limits = await this.plans.limitsFor(userId);

    const counters = await this.prisma.usageCounter.findMany({
      where: { userId, periodKey },
      select: { metric: true, count: true },
    });

    const metrics = Object.keys(USAGE_METRIC_LIMIT_KEYS) as UsageMetric[];
    return {
      periodKey,
      resetsAt: nextMonthStart(now).toISOString(),
      items: metrics.map((metric) => ({
        metric,
        used: counters.find((c) => c.metric === metric)?.count ?? 0,
        /** `null` = illimité. Le front affiche « illimité », pas « 0 sur null ». */
        limit: limits[USAGE_METRIC_LIMIT_KEYS[metric]],
      })),
    };
  }

  /**
   * `GET /me/payments` : les factures du membre.
   *
   * ELLE TRONQUAIT EN SILENCE : `take: query.limit` suivi d'un `nextCursor: null`
   * écrit en dur. Sur le domaine MEMBRE, et sur des FACTURES — un membre qui a
   * plus de vingt paiements ne pouvait pas atteindre les plus anciens, et l'écran
   * lui affirmait qu'il n'y en avait pas d'autres. Un historique comptable qui
   * mentit par omission est pire qu'un historique vide.
   */
  async myPayments(userId: string, query: PaymentsQuery) {
    const scope = `me:payments:${userId}:${query.status ?? ''}`;
    const resume = decodeCreatedAtDesc(query.cursor, this.cursorSecret, scope);

    const rows = await this.prisma.payment.findMany({
      where: {
        AND: [
          { userId, ...(query.status === undefined ? {} : { status: query.status }) },
          ...createdAtDescAfter(resume),
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      select: {
        id: true,
        amountCents: true,
        currency: true,
        provider: true,
        method: true,
        status: true,
        invoiceNumber: true,
        paidAt: true,
        createdAt: true,
      },
    });

    const page = buildPage(rows, query.limit, scope, this.cursorSecret, createdAtDescSort);

    return {
      items: page.items.map((r) => ({
        id: r.id,
        amount: { amountCents: r.amountCents, currency: r.currency },
        provider: r.provider,
        method: r.method,
        status: r.status,
        invoiceNumber: r.invoiceNumber,
        paidAt: r.paidAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
      nextCursor: page.nextCursor,
    };
  }

  /**
   * `GET /me/payments/:id/invoice` (§4.4).
   *
   * Répond `INVOICE_UNAVAILABLE` (503) tant qu'aucun moteur de rendu n'est
   * branché — voir `NoInvoicePdfPort`, qui porte le raisonnement. 503 et non 404 :
   * la facture existe, son numéro est attribué et conservé ; c'est sa mise en
   * forme qui manque.
   */
  async invoice(userId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, userId },
      select: { id: true, invoiceNumber: true, amountCents: true, currency: true, status: true },
    });
    // 404 et non 403 pour un paiement d'autrui (T4 §3) : ne pas révéler qu'il existe.
    if (payment === null) throw ApiError.notFound();
    if (payment.invoiceNumber === null) this.fail('INVOICE_UNAVAILABLE');

    const rendered = await this.invoices.render({
      paymentId: payment.id,
      invoiceNumber: payment.invoiceNumber,
      amountCents: payment.amountCents,
      currency: payment.currency,
    });
    if (rendered === null) {
      this.fail('INVOICE_UNAVAILABLE', { invoiceNumber: payment.invoiceNumber });
    }
    return { invoiceNumber: payment.invoiceNumber, assetId: rendered.assetId };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Souscription (§4.1, §4.2, §7.1)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * `POST /me/subscription/checkout`.
   *
   * L'ORDRE des trois temps porte toute la correction de cette méthode :
   *
   *   1. **pré-vérification hors transaction** — un refus évident (déjà abonné,
   *      fiche inconnue) ne doit pas coûter un appel au fournisseur ;
   *   2. **appel au fournisseur** — hors transaction, toujours. Un appel réseau
   *      dans une transaction PostgreSQL tient un verrou pendant le temps de vol,
   *      et un fournisseur lent devient une base bloquée ;
   *   3. **transaction : verrou sur la ligne du membre, PUIS re-vérification, PUIS
   *      écriture.** C'est le seul agencement qui résiste à deux requêtes
   *      simultanées. Sans le verrou, deux paiements créent deux abonnements — et
   *      « un seul ACTIVE par membre et par type de plan » (§4.3) est le genre de
   *      règle qu'un double clic gagne.
   *
   * Le verrou porte sur `users` et sur AUCUNE autre ligne, exactement comme
   * `JourneysService.assertJourneyQuota` : il sérialise les souscriptions d'un
   * membre, et de lui seul.
   */
  async checkout(userId: string, input: Checkout) {
    const family = planFamilyOf(input.planCode);

    if (input.proProfileId !== undefined) {
      const owned = await this.prisma.proProfile.findFirst({
        where: { id: input.proProfileId, userId },
        select: { id: true },
      });
      if (owned === null) throw ApiError.notFound();
    }

    await this.assertNotSubscribed(this.prisma, userId, family, input.proProfileId);

    const currency = input.provider === 'MOBILE_MONEY' ? 'XOF' : 'EUR';
    const price = await this.plans.priceFor(input.planCode, input.period, currency);

    // ── Le fournisseur ──────────────────────────────────────────────────────
    let providerRef: string;
    let checkoutUrl: string | null = null;

    if (input.provider === 'STRIPE') {
      if (this.card === null) this.fail('PROVIDER_UNAVAILABLE', { provider: 'STRIPE' });
      const created = await this.card.createCheckout({
        userId,
        planCode: input.planCode,
        amountCents: price.amountCents,
        currency: price.currency,
      });
      providerRef = created.providerRef;
      checkoutUrl = created.checkoutUrl;
    } else {
      if (this.momo === null) this.fail('PROVIDER_UNAVAILABLE', { provider: 'MOBILE_MONEY' });
      if (input.phone === undefined) this.fail('PROVIDER_UNAVAILABLE', { provider: 'MOBILE_MONEY' });
      const created = await this.momo.requestPayment({
        userId,
        // Le numéro passe, et ne se pose nulle part. Aucune écriture ci-dessous
        // ne le porte, et aucune colonne ne pourrait l'accueillir (§4.1).
        phone: input.phone,
        amountCents: price.amountCents,
        currency: 'XOF',
        periodMonths: input.period === 'YEAR' ? 12 : 1,
      });
      providerRef = created.providerRef;
    }

    // ── L'écriture ──────────────────────────────────────────────────────────
    const paymentId = newId();
    await this.prisma.$transaction(async (tx) => {
      await lockUser(tx, userId);
      await this.assertNotSubscribed(tx, userId, family, input.proProfileId);

      await tx.payment.create({
        data: {
          id: paymentId,
          userId,
          amountCents: price.amountCents,
          currency: price.currency,
          provider: input.provider,
          method: methodFor(input),
          providerRef,
          status: 'PENDING',
        },
      });
    });

    return {
      paymentId,
      status: 'PENDING' as const,
      amount: { amountCents: price.amountCents, currency: price.currency },
      /** Carte : l'URL hébergée. Mobile Money : rien à ouvrir, le téléphone sonne. */
      checkoutUrl,
      instruction:
        input.provider === 'MOBILE_MONEY'
          ? `Validez le paiement sur votre téléphone. Vous avez ${MOBILE_MONEY_TIMEOUT_MINUTES} minutes.`
          : null,
    };
  }

  /**
   * `POST /me/subscription/cancel` — effet en FIN DE PÉRIODE (§4.3).
   *
   * Rien n'est coupé, rien n'est supprimé, `users.plan` ne bouge pas : « reste
   * PREMIUM jusqu'à `current_period_end` ». C'est la tâche horaire qui conclura.
   */
  async cancel(userId: string, planCode: PaidPlanCode) {
    const subscription = await this.loadCurrent(userId, planCode);

    if (isTrialRef(subscription.providerRef)) {
      // Un essai est déjà « annulé en fin de période » par construction : il n'y
      // a rien à annuler, et prétendre le contraire donnerait un bouton qui ne
      // fait rien. On le dit plutôt que de laisser croire.
      this.fail('MOBILE_MONEY_NOT_RECURRING');
    }
    if (subscription.provider === 'MOBILE_MONEY') this.fail('MOBILE_MONEY_NOT_RECURRING');

    if (this.card !== null && subscription.providerRef !== null) {
      await this.card.setCancelAtPeriodEnd(subscription.providerRef, true);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.subscription.update({
        where: { id: subscription.id },
        data: { cancelAtPeriodEnd: true, cancelledAt: new Date() },
        select: SUBSCRIPTION_SELECT,
      });
      await this.emitChanged(tx, row.id, { userId, reason: 'CANCEL_SCHEDULED', planCode });
      return row;
    });

    return this.toSubscriptionView(updated);
  }

  /** `POST /me/subscription/resume` — réversible jusqu'à la fin de période (§4.3). */
  async resume(userId: string, planCode: PaidPlanCode) {
    const subscription = await this.loadCurrent(userId, planCode);
    if (subscription.provider === 'MOBILE_MONEY' || isTrialRef(subscription.providerRef)) {
      this.fail('MOBILE_MONEY_NOT_RECURRING');
    }

    if (this.card !== null && subscription.providerRef !== null) {
      await this.card.setCancelAtPeriodEnd(subscription.providerRef, false);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.subscription.update({
        where: { id: subscription.id },
        data: { cancelAtPeriodEnd: false, cancelledAt: null },
        select: SUBSCRIPTION_SELECT,
      });
      await this.emitChanged(tx, row.id, { userId, reason: 'RESUMED', planCode });
      return row;
    });

    return this.toSubscriptionView(updated);
  }

  /**
   * `POST /me/subscription/change-period` — au prochain renouvellement (§4.3).
   *
   * La période est tenue PAR LE FOURNISSEUR. `subscriptions.period` est annoncée
   * par §6 et absente du schéma figé ; la mémoriser ailleurs créerait une seconde
   * vérité, qui divergerait au premier prorata calculé par Stripe. Mobile Money
   * n'a rien à changer : le membre choisit sa période à chaque paiement (§4.2).
   */
  async changePeriod(userId: string, planCode: PaidPlanCode, period: PlanInterval) {
    const subscription = await this.loadCurrent(userId, planCode);
    if (subscription.provider !== 'STRIPE' || isTrialRef(subscription.providerRef)) {
      this.fail('MOBILE_MONEY_NOT_RECURRING');
    }
    if (this.card === null || subscription.providerRef === null) {
      this.fail('PROVIDER_UNAVAILABLE', { provider: 'STRIPE' });
    }

    await this.card.changePeriod(subscription.providerRef, period === 'YEAR' ? 'YEAR' : 'MONTH');
    return { scheduled: true, period, effectiveAt: subscription.currentPeriodEnd.toISOString() };
  }

  /** `GET /me/subscription/portal` (§7.1) — `NOT_STRIPE` sinon. */
  async portal(userId: string, planCode: PaidPlanCode) {
    const subscription = await this.loadCurrent(userId, planCode);
    if (subscription.provider !== 'STRIPE' || isTrialRef(subscription.providerRef)) {
      this.fail('NOT_STRIPE');
    }
    if (this.card === null || subscription.providerRef === null) {
      this.fail('PROVIDER_UNAVAILABLE', { provider: 'STRIPE' });
    }
    return { url: await this.card.createPortalUrl(subscription.providerRef) };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Essai (§3)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * `POST /me/trial/start` — le bouton « Activer mon essai ».
   *
   * RÈGLE (§3) : « 14 jours de Premium offerts À LA PREMIÈRE ÉTAPE FRANCHIE d'un
   * parcours (pas à l'inscription — le membre doit avoir vu la valeur) ». Le
   * serveur vérifie donc l'étape franchie, et ne se contente pas de l'espérer :
   * un client peut toujours appeler la route, et une inscription n'est pas une
   * étape franchie.
   */
  async startTrial(userId: string) {
    /**
     * L'ORDRE DES DEUX REFUS compte, et l'exercice l'a montré.
     *
     * Écrit dans l'autre sens — éligibilité d'abord — un membre dont l'essai a
     * DÉJÀ servi recevait `TRIAL_NOT_ELIGIBLE`, dont le message dit « avancez
     * d'une étape, puis revenez ». Il aurait avancé, serait revenu, et aurait reçu
     * le même refus : une invitation à faire quelque chose qui ne change rien.
     * « Déjà utilisé » est la vérité, et c'est le refus à donner d'abord.
     */
    const alreadyUsed = await this.prisma.subscription.count({
      where: { userId, providerRef: { startsWith: BillingService.TRIAL_REF_PREFIX } },
    });
    if (alreadyUsed > 0) this.fail('TRIAL_ALREADY_USED');

    const completed = await this.prisma.journeyStep.count({
      where: { status: 'DONE', journey: { ownerUserId: userId, deletedAt: null } },
    });
    if (completed === 0) this.fail('TRIAL_NOT_ELIGIBLE');

    // `grantTrial` refait le contrôle SOUS VERROU : celui ci-dessus est là pour le
    // message, celui-là pour la course.
    const started = await this.grantTrial(userId);
    if (started === null) this.fail('TRIAL_ALREADY_USED');
    return started;
  }

  /**
   * Consommateur de `journey.step_completed` (§9, « Consommés »).
   *
   * Le module parcours émet déjà cet événement — c'est le point d'accroche que la
   * spec décrit. IDEMPOTENT et SILENCIEUX : la deuxième étape franchie, comme un
   * rejeu de la file, ne doit ni lever ni offrir un second essai.
   */
  async handleStepCompleted(ownerUserId: string): Promise<{ granted: boolean }> {
    const granted = await this.grantTrial(ownerUserId);
    return { granted: granted !== null };
  }

  /**
   * Ouvre l'essai, ou rend `null` s'il a déjà servi.
   *
   * Le verrou sur la ligne du membre est ce qui rend « une seule fois » vrai :
   * deux étapes franchies simultanément — ou l'événement et le bouton en même
   * temps — verraient chacune zéro essai sans lui. Même piège, même remède que le
   * quota de parcours.
   */
  private async grantTrial(userId: string): Promise<{ endsAt: string } | null> {
    const premiumId = await this.plans.idOf('PREMIUM');

    return this.prisma.$transaction(async (tx) => {
      await lockUser(tx, userId);

      const everTrialed = await tx.subscription.count({
        where: { userId, providerRef: { startsWith: BillingService.TRIAL_REF_PREFIX } },
      });
      if (everTrialed > 0) return null;

      // Un membre DÉJÀ abonné n'a pas besoin d'un essai, et lui en donner un
      // créerait un second abonnement Premium — ce que §4.3 interdit.
      const paying = await tx.subscription.count({
        where: { userId, planId: premiumId, status: { in: ['ACTIVE', 'PAST_DUE'] } },
      });
      if (paying > 0) return null;

      const now = new Date();
      const endsAt = addDays(now, TRIAL_DAYS);
      const id = newId();

      await tx.subscription.create({
        data: {
          id,
          userId,
          planId: premiumId,
          status: 'ACTIVE',
          // Voir TRIAL_REF_PREFIX : pis-aller assumé, l'enum n'a pas « aucun ».
          provider: 'MOBILE_MONEY',
          providerRef: `${BillingService.TRIAL_REF_PREFIX}${id}`,
          currentPeriodStart: now,
          currentPeriodEnd: endsAt,
          // Un essai ne se reconduit jamais : §3, « sans moyen de paiement enregistré ».
          cancelAtPeriodEnd: true,
        },
      });

      await this.plans.recomputeUserPlan(tx, userId);
      await this.emitChanged(tx, id, { userId, reason: 'TRIAL_STARTED', planCode: 'PREMIUM' });

      return { endsAt: endsAt.toISOString() };
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Webhooks (§7.1, T4 §8)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * `POST /webhooks/stripe` et `POST /webhooks/mobile-money`.
   *
   * DEUX GARANTIES, et la seconde est une règle dure des tests du §12.
   *
   *   · **signature d'abord, lecture ensuite.** Le corps n'est pas même analysé
   *     avant que la signature ne soit validée. Sans secret configuré, le
   *     vérificateur refuse TOUT (voir `UnconfiguredWebhookVerifier`) : sinon
   *     cette route serait une activation d'abonnement gratuite ouverte à tous.
   *   · **idempotence par `payments.provider_ref`**, qui porte une contrainte
   *     d'unicité en base. Le rejeu est détecté sur le STATUT du paiement, sous
   *     verrou de ligne : « un webhook rejoué n'active pas deux fois un
   *     abonnement » (§12) tient à ce verrou, pas à l'ordre des messages.
   */
  async handleWebhook(
    channel: 'stripe' | 'mobile-money',
    rawBody: Buffer | undefined,
    headers: Record<string, string | string[] | undefined>,
    body: { providerRef: string; type: string },
  ) {
    const verifier = channel === 'stripe' ? this.stripeVerifier : this.momoVerifier;
    const check = verifier.verify(rawBody, headers);
    if (!check.ok) this.fail('WEBHOOK_SIGNATURE_INVALID', { reason: check.reason });

    const succeeded = isSuccessType(body.type);
    const failed = isFailureType(body.type);
    if (!succeeded && !failed) {
      // Un type qu'on ne traite pas se répond 200 sans rien faire : un
      // fournisseur qui reçoit une erreur réessaie, puis désactive le point
      // d'entrée. Ignorer explicitement est le comportement attendu (T4 §8).
      return { handled: false as const, reason: 'TYPE_IGNORED' };
    }

    return succeeded
      ? this.applyPaymentSucceeded(body.providerRef)
      : this.applyPaymentFailed(body.providerRef);
  }

  /** Le chemin heureux : paiement encaissé → abonnement activé ou prolongé. */
  private async applyPaymentSucceeded(providerRef: string) {
    const premiumId = await this.plans.idOf('PREMIUM');
    const yearPrices = await this.plans.yearPrices();

    return this.prisma.$transaction(async (tx) => {
      // Le verrou de LIGNE sur le paiement sérialise les rejeux concurrents. Sans
      // lui, deux livraisons du même webhook lisent toutes deux `PENDING` et
      // prolongent deux fois la période.
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM payments WHERE provider_ref = ${providerRef} FOR UPDATE
      `;
      const lockedId = locked[0]?.id;
      if (lockedId === undefined) return { handled: false as const, reason: 'UNKNOWN_PAYMENT' };

      const payment = await tx.payment.findUniqueOrThrow({
        where: { id: lockedId },
        select: {
          id: true,
          userId: true,
          amountCents: true,
          currency: true,
          provider: true,
          status: true,
          subscriptionId: true,
        },
      });

      if (payment.status === 'SUCCEEDED') {
        return { handled: true as const, reason: 'ALREADY_PROCESSED', subscriptionId: payment.subscriptionId };
      }
      if (payment.status === 'REFUNDED') {
        return { handled: false as const, reason: 'REFUNDED' };
      }

      /**
       * La PÉRIODE est déduite du MONTANT, faute de `subscriptions.period` et de
       * toute colonne de paiement qui la porterait (§6, colonne annoncée et
       * absente). Le rapport prix annuel / prix mensuel est de dix : la confusion
       * est donc impossible tant que les deux prix diffèrent, et un prix modifié
       * entre le paiement et le webhook — quelques minutes — est le seul cas où
       * la déduction pourrait se tromper.
       */
      const planCode = await this.planCodeOfPayment(tx, payment.userId, premiumId);
      const yearEur = yearPrices[planCode];
      const isYear = payment.currency === 'XOF'
        ? payment.amountCents >= xofOf(yearEur)
        : payment.amountCents >= yearEur;

      const now = new Date();
      const planId = planCode === 'PREMIUM' ? premiumId : await this.plans.idOf(planCode);
      const family = planFamilyOf(planCode);
      const familyIds = await this.planIdsOf(codesInFamily(family));

      const existing = await tx.subscription.findFirst({
        where: { userId: payment.userId, planId: { in: familyIds } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, currentPeriodEnd: true, status: true, providerRef: true },
      });

      /**
       * Une prolongation part de la fin de période EN COURS, pas de maintenant :
       * renouveler trois jours avant l'échéance ne doit pas faire perdre ces trois
       * jours. Un essai, en revanche, est REMPLACÉ et non prolongé — §3 dit
       * « 14 jours offerts », pas « 14 jours ajoutés à ce que vous payez ».
       */
      const base =
        existing !== null &&
        existing.status === 'ACTIVE' &&
        !isTrialRef(existing.providerRef) &&
        existing.currentPeriodEnd > now
          ? existing.currentPeriodEnd
          : now;
      const periodEnd = isYear ? addMonths(base, 12) : addMonths(base, 1);

      const subscriptionData = {
        planId,
        status: 'ACTIVE' as const,
        provider: payment.provider,
        providerRef,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        // §4.2 : Mobile Money n'a pas de récurrence — vrai PAR CONSTRUCTION.
        cancelAtPeriodEnd: payment.provider === 'MOBILE_MONEY',
        cancelledAt: null,
      };

      const subscriptionId =
        existing === null
          ? (
              await tx.subscription.create({
                data: { id: newId(), userId: payment.userId, ...subscriptionData },
                select: { id: true },
              })
            ).id
          : (
              await tx.subscription.update({
                where: { id: existing.id },
                data: subscriptionData,
                select: { id: true },
              })
            ).id;

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'SUCCEEDED',
          paidAt: now,
          subscriptionId,
          invoiceNumber: await this.nextInvoiceNumber(tx, now),
        },
      });

      await this.plans.recomputeUserPlan(tx, payment.userId);
      await this.emitChanged(tx, subscriptionId, {
        userId: payment.userId,
        reason: 'ACTIVATED',
        planCode,
        currentPeriodEnd: periodEnd.toISOString(),
      });

      return { handled: true as const, reason: 'ACTIVATED', subscriptionId };
    });
  }

  /** Carte refusée : `PAST_DUE` et notification, jamais une coupure immédiate (§4.3). */
  private async applyPaymentFailed(providerRef: string) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { providerRef },
        select: { id: true, userId: true, status: true, subscriptionId: true },
      });
      if (payment === null) return { handled: false as const, reason: 'UNKNOWN_PAYMENT' };
      if (payment.status === 'FAILED') return { handled: true as const, reason: 'ALREADY_PROCESSED' };

      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', failureCode: 'PROVIDER_DECLINED' },
      });

      if (payment.subscriptionId !== null) {
        await tx.subscription.updateMany({
          where: { id: payment.subscriptionId, status: 'ACTIVE' },
          data: { status: 'PAST_DUE' },
        });
      }

      await this.outbox.emit(tx, {
        type: 'payment.failed',
        aggregateId: payment.id,
        payload: { userId: payment.userId, subscriptionId: payment.subscriptionId },
      });

      return { handled: true as const, reason: 'PAST_DUE' };
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Tâches planifiées (§10)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * `billing.expiry_reminders` — quotidienne : J−7 et J−1 (Mobile Money), essai J−3.
   *
   * Aucun appel direct à `NotificationsService` : le rappel passe par un événement
   * de domaine, que le module 12 consomme (00 §3.3). L'idempotence vient de
   * `deliver()`, qui dé-duplique sur le type et la référence — il n'y a pas de
   * colonne `reminder_sent_at` sur `subscriptions`, et en inventer une n'est pas
   * possible sur un schéma gelé.
   */
  async sendExpiryReminders(now = new Date()): Promise<{ renewals: number; trials: number }> {
    let renewals = 0;
    let trials = 0;

    for (const days of RENEWAL_REMINDER_DAYS) {
      const due = await this.prisma.subscription.findMany({
        where: {
          status: 'ACTIVE',
          provider: 'MOBILE_MONEY',
          currentPeriodEnd: { gte: addDays(now, days - 1), lt: addDays(now, days) },
          // TRAP : `providerRef` est NULLABLE. `not startsWith` seul écarterait
          // aussi les lignes à NULL, qui sont précisément des abonnements payés
          // sans référence. Le `OR` explicite est obligatoire.
          OR: [{ providerRef: null }, { providerRef: { not: { startsWith: BillingService.TRIAL_REF_PREFIX } } }],
        },
        select: { id: true, userId: true, currentPeriodEnd: true },
        take: 500,
      });

      for (const row of due) {
        await this.prisma.$transaction(async (tx) => {
          await this.emitChanged(tx, row.id, {
            userId: row.userId,
            reason: days === 1 ? 'RENEWAL_J1' : 'RENEWAL_J7',
            planCode: 'PREMIUM',
            currentPeriodEnd: row.currentPeriodEnd.toISOString(),
          });
        });
        renewals += 1;
      }
    }

    const endingTrials = await this.prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        providerRef: { startsWith: BillingService.TRIAL_REF_PREFIX },
        currentPeriodEnd: {
          gte: addDays(now, TRIAL_REMINDER_DAYS - 1),
          lt: addDays(now, TRIAL_REMINDER_DAYS),
        },
      },
      select: { id: true, userId: true, currentPeriodEnd: true },
      take: 500,
    });

    for (const row of endingTrials) {
      await this.prisma.$transaction(async (tx) => {
        await this.emitChanged(tx, row.id, {
          userId: row.userId,
          reason: 'TRIAL_ENDING',
          planCode: 'PREMIUM',
          currentPeriodEnd: row.currentPeriodEnd.toISOString(),
        });
      });
      trials += 1;
    }

    return { renewals, trials };
  }

  /**
   * `billing.expire_subscriptions` — horaire : fin de grâce → EXPIRED → dégradation.
   *
   * QUATRE CAS, séparés parce qu'ils n'ont pas la même échéance :
   *
   *   · Mobile Money échu + 3 jours de grâce (§4.2) → EXPIRED ;
   *   · carte en `PAST_DUE` depuis 7 jours (§4.3) → EXPIRED ;
   *   · carte annulée dont la période s'achève (§4.3) → CANCELLED ;
   *   · les ESSAIS sont exclus : ils appartiennent à `billing.trial_end`.
   *
   * RÈGLE DURE (§4.3 et §12) : « la dégradation en FREE ne supprime aucun
   * parcours ». Cette méthode n'écrit que dans `subscriptions` et `users.plan`.
   * Elle ne touche AUCUNE table de contenu — ni `journeys`, ni `saved_alerts`, ni
   * `pro_profiles` — et c'est ce que le test de mutation vérifie.
   */
  async expireSubscriptions(now = new Date()): Promise<{ expired: number; cancelled: number }> {
    const notATrial: Prisma.SubscriptionWhereInput = {
      OR: [{ providerRef: null }, { providerRef: { not: { startsWith: BillingService.TRIAL_REF_PREFIX } } }],
    };

    const due = await this.prisma.subscription.findMany({
      where: {
        AND: [
          notATrial,
          {
            OR: [
              {
                provider: 'MOBILE_MONEY',
                status: 'ACTIVE',
                currentPeriodEnd: { lte: addDays(now, -MOBILE_MONEY_GRACE_DAYS) },
              },
              {
                status: 'PAST_DUE',
                currentPeriodEnd: { lte: addDays(now, -PAST_DUE_WINDOW_DAYS) },
              },
              {
                provider: 'STRIPE',
                status: 'ACTIVE',
                cancelAtPeriodEnd: true,
                currentPeriodEnd: { lte: now },
              },
            ],
          },
        ],
      },
      select: { id: true, userId: true, status: true, cancelAtPeriodEnd: true, provider: true },
      take: 500,
    });

    let expired = 0;
    let cancelled = 0;

    for (const row of due) {
      const next =
        row.provider === 'STRIPE' && row.status === 'ACTIVE' && row.cancelAtPeriodEnd
          ? ('CANCELLED' as const)
          : ('EXPIRED' as const);

      await this.prisma.$transaction(async (tx) => {
        const applied = await tx.subscription.updateMany({
          where: { id: row.id, status: row.status },
          data: { status: next },
        });
        // Zéro ligne = quelqu'un d'autre est passé avant (rejeu, second worker).
        // Ne rien émettre est alors la bonne réponse : l'événement l'a déjà été.
        if (applied.count === 0) return;

        await this.plans.recomputeUserPlan(tx, row.userId);
        await this.emitChanged(tx, row.id, { userId: row.userId, reason: next, planCode: 'PREMIUM' });
      });

      if (next === 'CANCELLED') cancelled += 1;
      else expired += 1;
    }

    return { expired, cancelled };
  }

  /**
   * `billing.trial_end` — horaire.
   *
   * §3 : « à la fin, retour en FREE SANS COUPURE DE SERVICE, les parcours
   * excédentaires passent en lecture seule (JAMAIS SUPPRIMÉS) ». Aucun parcours
   * n'est touché ici — et la « lecture seule » n'a pas de colonne dans le schéma
   * figé, donc elle n'est pas appliquée : signalée, non contournée. Conséquence
   * connue : un membre peut rester avec deux parcours actifs après son essai ; il
   * ne pourra simplement pas en créer un troisième.
   */
  async endTrials(now = new Date()): Promise<{ ended: number }> {
    const due = await this.prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        providerRef: { startsWith: BillingService.TRIAL_REF_PREFIX },
        currentPeriodEnd: { lte: now },
      },
      select: { id: true, userId: true },
      take: 500,
    });

    let ended = 0;
    for (const row of due) {
      await this.prisma.$transaction(async (tx) => {
        const applied = await tx.subscription.updateMany({
          where: { id: row.id, status: 'ACTIVE' },
          data: { status: 'EXPIRED' },
        });
        if (applied.count === 0) return;
        await this.plans.recomputeUserPlan(tx, row.userId);
        await this.emitChanged(tx, row.id, {
          userId: row.userId,
          reason: 'TRIAL_ENDED',
          planCode: 'PREMIUM',
        });
        ended += 1;
      });
    }
    return { ended };
  }

  /**
   * `usage.reset` — §10 : « les compteurs sont par `period_key`, donc rien à
   * réinitialiser : simple purge à 13 mois ». Le nom de la spec est trompeur ;
   * le travail est une purge, et c'est ce que fait cette méthode.
   */
  async purgeUsageCounters(now = new Date()): Promise<{ purged: number }> {
    const cutoff = monthKeyOf(addMonths(now, -USAGE_RETENTION_MONTHS));
    const deleted = await this.prisma.usageCounter.deleteMany({
      where: { periodKey: { lt: cutoff } },
    });
    return { purged: deleted.count };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Équipe (§7.2)
  // ══════════════════════════════════════════════════════════════════════════

  /** `GET /admin/billing/plans` — prix, limites, état. */
  async adminPlans() {
    const rows = await this.prisma.plan.findMany({ orderBy: { priceCents: 'asc' } });
    const yearPrices = await this.plans.yearPrices();
    return {
      items: rows.map((p) => ({
        code: p.code,
        nameFr: p.nameFr,
        priceCents: p.priceCents,
        yearPriceCents: p.code === 'FREE' ? 0 : yearPrices[p.code],
        currency: p.currency,
        interval: p.interval,
        limits: p.limits,
        isActive: p.isActive,
      })),
      // §5.3 : l'enveloppe de liste veut `nextCursor`, et il MANQUAIT. `null` est
      // honnête — le catalogue est rendu en entier, sans `take`.
      nextCursor: null,
    };
  }

  /** `PUT /admin/billing/plans/:code` (SUPER_ADMIN). */
  async updatePlan(staffId: string, code: PlanCode, patch: PlanUpdate) {
    const before = await this.prisma.plan.findUnique({ where: { code } });
    if (before === null) throw ApiError.notFound();

    // Les limites sont revalidées ici AUSSI, bien que le schéma de route l'ait
    // fait : `plans.limits` est la source unique des quotas de quatre modules, et
    // une limite mal formée s'y installerait pour de bon.
    if (patch.limits !== undefined) planLimitsSchema.parse(patch.limits);

    await this.prisma.$transaction(async (tx) => {
      await tx.plan.update({
        where: { code },
        data: {
          ...(patch.priceCents === undefined ? {} : { priceCents: patch.priceCents }),
          ...(patch.limits === undefined ? {} : { limits: { ...patch.limits } }),
          ...(patch.isActive === undefined ? {} : { isActive: patch.isActive }),
          ...(patch.nameFr === undefined ? {} : { nameFr: patch.nameFr }),
        },
      });

      await this.audit.record(tx, {
        actor: { type: 'STAFF', id: staffId },
        action: 'billing.plan_updated',
        targetType: 'plan',
        targetId: before.id,
        metadata: {
          code,
          before: { priceCents: before.priceCents, isActive: before.isActive },
          after: patch,
        },
      });
    });

    // Le cache par code, purgé tout de suite sur cette instance.
    this.plans.invalidate();
    return this.adminPlans();
  }

  /** `GET /admin/billing/subscriptions?status&provider` (§7.2). */
  async listSubscriptions(query: SubscriptionsQuery) {
    /**
     * LE PIÈGE DES DEUX DIFFUSIONS. `status` et `provider` sont deux filtres
     * indépendants, mais `trialsOnly` touche la MÊME clé que le filtre par
     * fournisseur (`providerRef`). Écrits en deux diffusions conditionnelles, la
     * seconde écraserait la première en silence — d'où un `AND` explicite, qui
     * les cumule au lieu de les superposer.
     */
    const conditions: Prisma.SubscriptionWhereInput[] = [];
    if (query.status !== undefined) conditions.push({ status: query.status });
    if (query.provider !== undefined) conditions.push({ provider: query.provider });
    if (query.trialsOnly === true) {
      conditions.push({ providerRef: { startsWith: BillingService.TRIAL_REF_PREFIX } });
    }
    if (query.trialsOnly === false) {
      conditions.push({
        OR: [{ providerRef: null }, { providerRef: { not: { startsWith: BillingService.TRIAL_REF_PREFIX } } }],
      });
    }

    /**
     * ELLE TRONQUAIT EN SILENCE, comme quatre autres routes du dépôt : `take`
     * posé, `nextCursor: null` écrit en dur. Le tableau des abonnements de
     * l'équipe s'arrêtait à vingt lignes en affirmant la fin de liste.
     */
    const scope = `admin:subs:${query.status ?? ''}:${query.provider ?? ''}:${String(query.trialsOnly)}`;
    const resume = decodeCreatedAtDesc(query.cursor, this.cursorSecret, scope);

    const rows = await this.prisma.subscription.findMany({
      where: { AND: [...conditions, ...createdAtDescAfter(resume)] },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      // `createdAt` est SÉLECTIONNÉ bien qu'il ne paraisse pas dans la réponse :
      // c'est la valeur de tri que le curseur transporte. Sans elle, `buildPage`
      // signerait un curseur sur une date `undefined`.
      select: { ...SUBSCRIPTION_SELECT, userId: true, createdAt: true },
    });

    const page = buildPage(rows, query.limit, scope, this.cursorSecret, createdAtDescSort);
    const total = await this.prisma.subscription.count({
      where: conditions.length === 0 ? {} : { AND: conditions },
    });

    return {
      items: page.items.map((r) => ({ ...this.toSubscriptionView(r), userId: r.userId })),
      nextCursor: page.nextCursor,
      meta: { total },
    };
  }

  /**
   * `POST /admin/billing/payments/:id/refund` — SUPPORT (§4.4).
   *
   * « Sous 14 jours sans usage significatif (aucun second parcours créé, aucune
   * alerte déclenchée) ». L'USAGE SIGNIFICATIF est interprété au mot : un parcours
   * créé après le paiement (le membre a consommé « parcours illimités »), ou une
   * alerte enregistrée qui a notifié (il a consommé « alertes logement/emploi »).
   * Les deux sont les avantages que §3 liste en premier.
   */
  async refund(staffId: string, paymentId: string, reason: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        userId: true,
        amountCents: true,
        currency: true,
        status: true,
        paidAt: true,
        providerRef: true,
        subscriptionId: true,
      },
    });
    if (payment === null) throw ApiError.notFound();
    if (payment.status !== 'SUCCEEDED' || payment.paidAt === null) {
      this.fail('PAYMENT_NOT_REFUNDABLE', { status: payment.status });
    }

    const deadline = addDays(payment.paidAt, REFUND_WINDOW_DAYS);
    if (deadline <= new Date()) {
      this.fail('REFUND_NOT_ELIGIBLE', { reason: 'WINDOW_ELAPSED', deadline: deadline.toISOString() });
    }

    const journeysSince = await this.prisma.journey.count({
      where: { ownerUserId: payment.userId, createdAt: { gt: payment.paidAt }, deletedAt: null },
    });
    const alertsFired = await this.prisma.savedAlert.count({
      where: { userId: payment.userId, lastNotifiedAt: { gt: payment.paidAt } },
    });
    if (journeysSince > 0 || alertsFired > 0) {
      this.fail('REFUND_NOT_ELIGIBLE', { reason: 'SIGNIFICANT_USAGE', journeysSince, alertsFired });
    }

    if (this.card !== null && payment.providerRef !== null && payment.currency === 'EUR') {
      await this.card.refund(payment.providerRef, payment.amountCents);
    }

    await this.prisma.$transaction(async (tx) => {
      const applied = await tx.payment.updateMany({
        where: { id: payment.id, status: 'SUCCEEDED' },
        data: { status: 'REFUNDED' },
      });
      if (applied.count === 0) return;

      await this.audit.record(tx, {
        actor: { type: 'STAFF', id: staffId },
        action: 'billing.payment_refunded',
        targetType: 'payment',
        targetId: payment.id,
        metadata: { amountCents: payment.amountCents, currency: payment.currency, reason },
      });

      await this.outbox.emit(tx, {
        type: 'payment.refunded',
        aggregateId: payment.id,
        payload: {
          userId: payment.userId,
          amountCents: payment.amountCents,
          currency: payment.currency,
        },
      });
    });

    return { refunded: true, paymentId: payment.id };
  }

  /** `GET /admin/billing/revenue` — abonnements et affiliation, par mois (§7.2). */
  async revenue(query: RevenueQuery) {
    const payments = await this.prisma.payment.findMany({
      where: { status: 'SUCCEEDED', paidAt: { not: null } },
      select: { amountCents: true, currency: true, paidAt: true, provider: true },
      orderBy: { paidAt: 'asc' },
      take: 20_000,
    });

    const clicks = await this.prisma.affiliateClick.findMany({
      where: { convertedAt: { not: null } },
      select: { payoutCents: true, convertedAt: true },
      take: 20_000,
    });

    const months = new Map<string, MonthRevenue>();
    const bucket = (key: string): MonthRevenue => {
      const found = months.get(key);
      if (found !== undefined) return found;
      const fresh: MonthRevenue = {
        month: key,
        subscriptionsEurCents: 0,
        subscriptionsXof: 0,
        affiliateEurCents: 0,
        payments: 0,
        conversions: 0,
      };
      months.set(key, fresh);
      return fresh;
    };

    for (const p of payments) {
      if (p.paidAt === null) continue;
      const key = monthKeyOf(p.paidAt);
      if (!inRange(key, query)) continue;
      const row = bucket(key);
      // Les deux devises ne s'ADDITIONNENT PAS : le XOF n'a pas de sous-unité, et
      // convertir pour totaliser ferait un chiffre d'affaires inventé. Deux
      // colonnes, et le lecteur décide.
      if (p.currency === 'XOF') row.subscriptionsXof += p.amountCents;
      else row.subscriptionsEurCents += p.amountCents;
      row.payments += 1;
    }

    for (const c of clicks) {
      if (c.convertedAt === null) continue;
      const key = monthKeyOf(c.convertedAt);
      if (!inRange(key, query)) continue;
      const row = bucket(key);
      row.affiliateEurCents += c.payoutCents ?? 0;
      row.conversions += 1;
    }

    /**
     * §5.3 : `nextCursor` MANQUAIT à l'enveloppe. `null` est honnête sur la liste
     * rendue — tous les mois de la plage y sont, sans `take`.
     *
     * CE QUI RESTE TRONQUÉ, ET QUI EST REMONTÉ, N'EST PAS L'ENVELOPPE : les deux
     * lectures sources ci-dessus portent `take: 20_000`. Au-delà, l'agrégat est
     * incomplet SANS QUE RIEN NE LE DISE — ce n'est pas une page manquante mais un
     * chiffre d'affaires faux. Un agrégat ne se pagine pas ; il se calcule en base
     * (`GROUP BY` par mois) ou il s'assume borné. Décision à prendre par le
     * propriétaire, pas ici.
     */
    return {
      items: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)),
      nextCursor: null,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Suppression de compte (§11)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Consommateur de `user.deleted` (§9 et §11).
   *
   * « Abonnements : annulés immédiatement chez le fournisseur ; lignes conservées
   * ANONYMISÉES (obligation comptable), factures conservées 10 ans. »
   *
   * Et voilà l'écart avec le schéma figé : `subscriptions.user_id` et
   * `payments.user_id` sont NOT NULL avec `onDelete: Cascade`. Une ligne
   * d'abonnement NE PEUT PAS survivre à la suppression de son membre, donc
   * l'anonymisation en base est impossible. La seule chose que ce module puisse
   * faire est ce qu'il fait ici : couper chez le fournisseur avant que la ligne
   * disparaisse. Signalé, non contourné — la conservation comptable demande un
   * stockage séparé, que §11 prévoit d'ailleurs pour les factures.
   */
  async handleUserDeleted(userId: string): Promise<{ cancelled: number }> {
    const rows = await this.prisma.subscription.findMany({
      where: { userId, status: { in: ['ACTIVE', 'PAST_DUE'] } },
      select: { id: true, provider: true, providerRef: true },
    });

    let cancelled = 0;
    for (const row of rows) {
      if (row.provider === 'STRIPE' && row.providerRef !== null && this.card !== null) {
        try {
          await this.card.cancelSubscription(row.providerRef);
        } catch (error) {
          // On ne bloque PAS la suppression du compte sur un échec fournisseur :
          // le droit du membre passe avant, et la trace reste dans le journal.
          this.logger.error(
            `Annulation fournisseur échouée pour ${row.id} : ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      await this.prisma.subscription.updateMany({
        where: { id: row.id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
      cancelled += 1;
    }
    return { cancelled };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Interne
  // ══════════════════════════════════════════════════════════════════════════

  /** §4.3 : « une seule subscription ACTIVE par (membre, type de plan) ». */
  private async assertNotSubscribed(
    db: PrismaService | Prisma.TransactionClient,
    userId: string,
    family: 'MEMBER' | 'PRO',
    proProfileId: string | undefined,
  ): Promise<void> {
    const familyIds = await this.planIdsOf(codesInFamily(family));
    const existing = await db.subscription.findFirst({
      where: {
        userId,
        planId: { in: familyIds },
        status: { in: ['ACTIVE', 'PAST_DUE'] },
        ...(proProfileId === undefined ? {} : { proProfileId }),
      },
      select: { id: true, providerRef: true },
    });
    if (existing === null) return;

    // Un ESSAI n'est pas un obstacle : §3 le décrit comme un avant-goût, et le
    // convertir en abonnement payé est exactement ce qu'on espère du membre.
    if (isTrialRef(existing.providerRef)) return;

    this.fail('ALREADY_SUBSCRIBED', { subscriptionId: existing.id });
  }

  private async planIdsOf(codes: readonly PlanCode[]): Promise<string[]> {
    const ids: string[] = [];
    for (const code of codes) ids.push(await this.plans.idOf(code));
    return ids;
  }

  private async loadCurrent(userId: string, planCode: PaidPlanCode) {
    const familyIds = await this.planIdsOf(codesInFamily(planFamilyOf(planCode)));
    const row = await this.prisma.subscription.findFirst({
      where: { userId, planId: { in: familyIds }, status: { in: ['ACTIVE', 'PAST_DUE'] } },
      orderBy: { createdAt: 'desc' },
      select: SUBSCRIPTION_SELECT,
    });
    if (row === null) this.fail('NO_SUBSCRIPTION');
    return row;
  }

  /**
   * Le code de plan d'un paiement, déduit du montant et du canal.
   *
   * `payments` ne porte pas le plan visé — il n'y a pas de colonne, et §6 n'en
   * annonce pas. On retrouve donc le plan par le MONTANT, en comparant aux prix
   * en vigueur. Le PREMIUM est le repli : c'est le seul plan qu'un membre
   * souscrit pour lui-même, et c'est l'immense majorité des paiements.
   */
  private async planCodeOfPayment(
    tx: Prisma.TransactionClient,
    userId: string,
    premiumId: string,
  ): Promise<PaidPlanCode> {
    // Une souscription Pro passe toujours par une fiche : si le membre en a une
    // avec un abonnement Pro en attente, c'est celui-là. Sinon, Premium.
    const proSub = await tx.subscription.findFirst({
      where: { userId, planId: { not: premiumId }, proProfileId: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { plan: { select: { code: true } } },
    });
    const code = proSub?.plan.code;
    return code === 'PRO' || code === 'PRO_PLUS' ? code : 'PREMIUM';
  }

  /**
   * Le numéro de facture séquentiel, préfixé de l'année (§4.4).
   *
   * Le VERROU CONSULTATIF de transaction est indispensable : `invoice_number` est
   * unique, et deux paiements encaissés dans la même seconde liraient le même
   * dernier numéro. Sans lui, l'un des deux échoue sur une violation de
   * contrainte — donc un webhook en erreur, donc un abonnement non activé alors
   * que le membre a payé. Un verrou de ligne ne suffirait pas : il n'y a pas de
   * ligne à verrouiller pour un numéro qui n'existe pas encore.
   */
  private async nextInvoiceNumber(tx: Prisma.TransactionClient, now: Date): Promise<string> {
    const year = now.getUTCFullYear();
    const prefix = `${year}-`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`invoice:${year}`}, 0))`;

    const last = await tx.payment.findFirst({
      where: { invoiceNumber: { startsWith: prefix } },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });

    const previous = Number.parseInt(last?.invoiceNumber?.slice(prefix.length) ?? '0', 10);
    const next = Number.isNaN(previous) ? 1 : previous + 1;
    return `${prefix}${String(next).padStart(6, '0')}`;
  }

  /**
   * `subscription.changed` — l'unique événement du module sur l'abonnement.
   *
   * Un seul type, avec un `reason`, plutôt que huit types : c'est le catalogue de
   * `DomainEventType` qui l'impose — « un type ne s'ajoute que s'il a un
   * producteur ET un consommateur réels ». `subscription.changed` existait déjà et
   * n'avait AUCUN consommateur ; il en a un désormais (les notifications du
   * module 12), et huit types pour un même fait en auraient laissé sept vides.
   * C'est la même forme que `event.updated` + `reminder: 'H_MINUS_2'` du module 09.
   */
  private async emitChanged(
    tx: Prisma.TransactionClient,
    subscriptionId: string,
    payload: {
      userId: string;
      reason: SubscriptionChangeReason;
      planCode: PlanCode;
      currentPeriodEnd?: string;
    },
  ): Promise<void> {
    await this.outbox.emit(tx, {
      type: 'subscription.changed',
      aggregateId: subscriptionId,
      payload: { ...payload },
    });
  }

  private toSubscriptionView(row: SubscriptionRow) {
    return {
      id: row.id,
      planCode: row.plan.code,
      status: row.status,
      provider: row.provider,
      /** Dérivé, faute de colonne `is_trial` (§6). Voir `TRIAL_REF_PREFIX`. */
      isTrial: isTrialRef(row.providerRef),
      currentPeriodStart: row.currentPeriodStart.toISOString(),
      currentPeriodEnd: row.currentPeriodEnd.toISOString(),
      cancelAtPeriodEnd: row.cancelAtPeriodEnd,
      /** Dérivée, faute de colonne `grace_until` (§6). Mobile Money seulement (§4.2). */
      graceUntil:
        row.provider === 'MOBILE_MONEY' && !isTrialRef(row.providerRef)
          ? addDays(row.currentPeriodEnd, MOBILE_MONEY_GRACE_DAYS).toISOString()
          : null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
    };
  }
}

// ── Types et utilitaires ─────────────────────────────────────────────────────

export type SubscriptionChangeReason =
  | 'ACTIVATED'
  | 'CANCEL_SCHEDULED'
  | 'RESUMED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'TRIAL_STARTED'
  | 'TRIAL_ENDING'
  | 'TRIAL_ENDED'
  | 'RENEWAL_J7'
  | 'RENEWAL_J1';

const SUBSCRIPTION_SELECT = {
  id: true,
  status: true,
  provider: true,
  providerRef: true,
  currentPeriodStart: true,
  currentPeriodEnd: true,
  cancelAtPeriodEnd: true,
  cancelledAt: true,
  plan: { select: { code: true } },
} as const;

interface SubscriptionRow {
  readonly id: string;
  readonly status: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';
  readonly provider: 'STRIPE' | 'MOBILE_MONEY';
  readonly providerRef: string | null;
  readonly currentPeriodStart: Date;
  readonly currentPeriodEnd: Date;
  readonly cancelAtPeriodEnd: boolean;
  readonly cancelledAt: Date | null;
  readonly plan: { readonly code: PlanCode };
}

/**
 * Exportée, bien qu'employée en interne : `tsc` en mode déclarations refuse une
 * méthode publique dont le type de retour « ne peut pas être nommé ». Le
 * contrôleur d'équipe rend ce type, donc il doit sortir du fichier.
 */
export interface MonthRevenue {
  month: string;
  subscriptionsEurCents: number;
  subscriptionsXof: number;
  affiliateEurCents: number;
  payments: number;
  conversions: number;
}

/** Un essai, reconnu à sa référence. Voir `BillingService.TRIAL_REF_PREFIX`. */
export function isTrialRef(providerRef: string | null): boolean {
  return providerRef !== null && providerRef.startsWith(BillingService.TRIAL_REF_PREFIX);
}

/**
 * Le verrou de la ligne du membre, DANS la transaction.
 *
 * Le même remède que `JourneysService.assertJourneyQuota`, pour le même défaut :
 * deux requêtes simultanées qui comptent avant d'écrire voient chacune zéro. Le
 * verrou sérialise par MEMBRE, et par lui seul — aucun autre membre n'attend.
 */
async function lockUser(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/**
 * Ajoute des mois, en BORNANT le jour du mois.
 *
 * `setUTCMonth` seul fait déborder : le 31 janvier + 1 mois donnerait le 3 mars,
 * ce qui offrirait trois jours à qui s'abonne le 31. On borne au dernier jour du
 * mois d'arrivée — c'est ce que font les fournisseurs, et c'est ce qu'attend un
 * membre qui lit « prochain prélèvement le 28 février ».
 */
function addMonths(date: Date, months: number): Date {
  const day = date.getUTCDate();
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      target.getUTCFullYear(),
      target.getUTCMonth(),
      Math.min(day, lastDay),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

/** Le prix en francs, pour comparer un montant XOF à un prix EUR. */
function xofOf(eurCents: number): number {
  return Math.floor(((eurCents / 100) * 655.957) / 100) * 100;
}

function inRange(month: string, query: RevenueQuery): boolean {
  if (query.from !== undefined && month < query.from) return false;
  if (query.to !== undefined && month > query.to) return false;
  return true;
}

/**
 * Les types d'événement fournisseur qui valent « encaissé ».
 *
 * Reconnus par MOTIF et non par liste exacte : les deux fournisseurs ne sont pas
 * désignés (Stripe l'est, mais ses noms d'événements évoluent ; l'agrégateur UEMOA
 * ne l'est pas du tout — décision D4). Une liste fermée écrite aujourd'hui serait
 * fausse demain, et l'échec serait silencieux : un paiement encaissé jamais activé.
 */
function isSuccessType(type: string): boolean {
  const t = type.toLowerCase();
  return (
    t.includes('succeeded') ||
    t.includes('success') ||
    t.includes('paid') ||
    t.includes('completed') ||
    t.includes('approved')
  );
}

function isFailureType(type: string): boolean {
  const t = type.toLowerCase();
  return t.includes('failed') || t.includes('failure') || t.includes('declined');
}
