import { reglerMonetisation } from '../../../common/__tests__/monetisation';
import { newId } from '@app/db';
import {
  MOBILE_MONEY_GRACE_DAYS,
  PLAN_SEED,
  PREMIUM_MONTH_PRICE_CENTS,
  PREMIUM_YEAR_PRICE_CENTS,
  TRIAL_DAYS,
  checkoutSchema,
  xofFromEurCents,
} from '@app/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../../../common/audit.service';
import { CryptoService } from '../../../common/crypto.service';
import { OutboxService } from '../../../common/outbox.service';
import { PrismaService } from '../../../common/prisma.service';
import { TokenService } from '../../../common/token.service';
import {
  FakeCaptchaProvider,
  FakeMobileMoneyProvider,
  FakePaymentProvider,
  FakeSmsProvider,
} from '../../../providers/providers';
import { AuthService } from '../../auth/auth.service';
import { ConsentsService } from '../../consents/consents.service';
import {
  HmacWebhookVerifier,
  UnconfiguredWebhookVerifier,
  signWebhookBody,
} from '../billing.ports';
import { BillingService } from '../billing.service';
import { PlanService } from '../plan.service';
import { numeroDEpreuve } from '../../../common/__tests__/numeros';

/**
 * Facturation — 14-monetisation.md §3, §4, §12.
 *
 * Chaque règle dure du §12 a son test, et chacun a été ÉPROUVÉ PAR MUTATION : la
 * règle a été cassée dans le service, le test est tombé, la règle a été rétablie,
 * `git diff` était vide. La mutation employée est notée en tête de chaque test —
 * sans elle, « le test passe » ne prouve rien d'autre que l'absence d'erreur de
 * syntaxe.
 *
 * Chaque test vérifie d'abord sa PRÉMISSE : l'état de l'abonnement, le plan du
 * membre, le statut du paiement. Un test appuyé sur une base qui n'est pas dans
 * l'état supposé passerait aussi avec le défaut.
 */
const WEBHOOK_SECRET = 'secret-de-test-pour-les-webhooks-000000';

describe('facturation (14 §3, §4, §12)', () => {
  let prisma: PrismaService;
  let plans: PlanService;
  let billing: BillingService;
  let auth: AuthService;
  const sms = new FakeSmsProvider();
  const card = new FakePaymentProvider();
  const momo = new FakeMobileMoneyProvider();

  const createdUserIds: string[] = [];
  let counter = 0;

  const nextPhone = (): string => numeroDEpreuve(counter++);

  async function newMember(plan: 'FREE' | 'PREMIUM' = 'FREE'): Promise<string> {
    const { challengeId } = await auth.requestOtp({
      phone: nextPhone(),
      countryIso2: 'BJ',
      captchaToken: 'test',
      purpose: 'SIGNUP',
      ip: undefined,
    });
    const session = await auth.verifyOtp({
      challengeId,
      code: sms.lastCodeSent() as string,
      ip: undefined,
      userAgent: undefined,
    });
    createdUserIds.push(session.userId);
    await prisma.user.update({
      where: { id: session.userId },
      data: { verificationLevel: 'L1', plan },
    });
    return session.userId;
  }

  /** Le corps d'un webhook, signé comme le fournisseur le ferait. */
  function webhook(providerRef: string, type: string) {
    const body = { id: `evt-${newId()}`, type, providerRef };
    const raw = Buffer.from(JSON.stringify(body));
    return {
      body,
      raw,
      headers: { 'x-webhook-signature': signWebhookBody(WEBHOOK_SECRET, raw) },
    };
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    // Lot A : ces bancs vérifient les quotas des plans, donc les plans s'appliquent.
    await reglerMonetisation(prisma, true);

    const crypto = new CryptoService();
    const outbox = new OutboxService(prisma);
    const audit = new AuditService(prisma);
    const consents = new ConsentsService(prisma);

    plans = new PlanService(prisma);
    billing = new BillingService(
      prisma,
      plans,
      outbox,
      audit,
      card,
      momo,
      new HmacWebhookVerifier('stripe', WEBHOOK_SECRET),
      new HmacWebhookVerifier('mobile-money', WEBHOOK_SECRET),
    );
    auth = new AuthService(
      prisma,
      crypto,
      outbox,
      new TokenService(),
      consents,
      sms,
      new FakeCaptchaProvider(),
    );
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      // `payments`, `subscriptions`, `usage_counters` sont en CASCADE sur `users` :
      // supprimer les membres retire les fixtures de facturation avec eux.
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    // Les modèles de parcours créés par `journeyFor`, retirés APRÈS les membres :
    // `journey_template_versions` est en `Restrict` depuis `journeys`, donc la
    // suppression échouerait dans l'autre ordre. Les versions et les étapes
    // partent en cascade avec leur modèle.
    await prisma.journeyTemplate.deleteMany({
      where: { code: { startsWith: 'recette-facturation-' } },
    });
    await reglerMonetisation(prisma, null);
    await prisma.$disconnect();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Amorçage des plans (§3)
  // ══════════════════════════════════════════════════════════════════════════

  it('[TOUT GRATUIT] limitsFor rend les droits Premium à tous, sauf hidePartners', async () => {
    await reglerMonetisation(prisma, false);
    try {
      const gratuit = await prisma.user.findFirstOrThrow({ where: { plan: 'FREE' }, select: { id: true } });
      const limites = await plans.limitsFor(gratuit.id);
      const premium = await plans.limitsOf('PREMIUM');
      expect({ ...limites, hidePartners: premium.hidePartners }).toEqual(premium);
      expect(limites.hidePartners).toBe(false);
      expect(limites.maxActiveJourneys).toBeNull();
      expect(limites.alerts).toBe(true);
    } finally {
      await reglerMonetisation(prisma, true);
    }
    const reel = await plans.limitsFor(
      (await prisma.user.findFirstOrThrow({ where: { plan: 'FREE' }, select: { id: true } })).id,
    );
    expect(reel.maxActiveJourneys).toBe(1);
  });

  describe('les plans', () => {
    it('sont amorcés, avec les limites du §3', async () => {
      const rows = await prisma.plan.findMany({ select: { code: true, priceCents: true } });
      expect(rows.map((r) => r.code).sort()).toEqual(['FREE', 'PREMIUM', 'PRO', 'PRO_PLUS']);

      const premium = rows.find((r) => r.code === 'PREMIUM');
      expect(premium?.priceCents).toBe(PREMIUM_MONTH_PRICE_CENTS);

      const free = await plans.limitsOf('FREE');
      // Les valeurs du tableau du §3, celles-là et pas d'autres.
      expect(free.maxActiveJourneys).toBe(1);
      expect(free.eventsPerMonth).toBe(1);
      expect(free.proContactsPerMonth).toBe(3);
      expect(free.hidePartners).toBe(false);

      const premiumLimits = await plans.limitsOf('PREMIUM');
      expect(premiumLimits.maxActiveJourneys).toBeNull();
      expect(premiumLimits.hidePartners).toBe(true);
      expect(premiumLimits.sponsoredJobsPerMonth).toBe(5);
    });

    /**
     * MUTATION : faire lire `seededLimitsFor(code)` au lieu de la ligne de base dans
     * `PlanService.readLimits` → ce test tombe (la limite modifiée en base n'est plus
     * vue). C'est la preuve que la base est bien la SOURCE, et pas le code.
     */
    it('sont lus DEPUIS LA BASE, pas depuis le code', async () => {
      const before = await plans.limitsOf('FREE');
      expect(before.eventsPerMonth).toBe(1);

      await prisma.plan.update({
        where: { code: 'FREE' },
        data: { limits: { ...before, eventsPerMonth: 9 } },
      });
      plans.invalidate();

      try {
        const after = await plans.limitsOf('FREE');
        expect(after.eventsPerMonth).toBe(9);
        // Et les autres clés ne bougent pas : on remplace une valeur, pas le bloc.
        expect(after.maxActiveJourneys).toBe(1);
      } finally {
        await prisma.plan.update({ where: { code: 'FREE' }, data: { limits: { ...before } } });
        plans.invalidate();
      }
    });

    it('sont convertis en XOF selon la parité fixe, arrondis à la centaine inférieure', () => {
      // §4.2, au mot : « 4 € = 2 625 F arrondi à 2 600 F ».
      expect(xofFromEurCents(PREMIUM_MONTH_PRICE_CENTS)).toBe(2_600);
      expect(xofFromEurCents(PREMIUM_YEAR_PRICE_CENTS)).toBe(26_200);
    });

    it('sont exposés avec les deux devises et le prix annuel', async () => {
      const list = await plans.publicPlans();
      const premium = list.find((p) => p.code === 'PREMIUM');
      expect(premium?.month.eur.amountCents).toBe(PREMIUM_MONTH_PRICE_CENTS);
      expect(premium?.month.xof.amountCents).toBe(2_600);
      expect(premium?.year.eur.amountCents).toBe(PREMIUM_YEAR_PRICE_CENTS);
    });

    it('l’amorçage est idempotent : relancer ne duplique rien', async () => {
      const before = await prisma.plan.count();
      // Le seed emploie `upsert` par `code`, qui est unique : deux passages donnent
      // quatre lignes. On le vérifie par la contrainte plutôt qu'en relançant tsx.
      await expect(
        prisma.plan.create({
          data: {
            id: newId(),
            code: 'FREE',
            nameFr: 'Doublon',
            priceCents: 0,
            currency: 'EUR',
            interval: 'MONTH',
            limits: {},
            isActive: true,
          },
        }),
      ).rejects.toThrow();
      expect(await prisma.plan.count()).toBe(before);
      expect(before).toBe(PLAN_SEED.length);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Règle dure : aucune donnée de carte ne parvient à l'API (§4.1, §12)
  // ══════════════════════════════════════════════════════════════════════════

  describe('RÈGLE DURE — aucune donnée de carte n’est reçue par l’API (§4.1)', () => {
    /**
     * MUTATION : remplacer `.strict()` par `.passthrough()` sur `checkoutSchema` →
     * ce test tombe (le corps est accepté). C'est la seule barrière possible : un
     * champ accepté finirait par être journalisé quelque part.
     */
    it('un corps de paiement portant un numéro de carte est REFUSÉ', () => {
      const withCard = {
        planCode: 'PREMIUM',
        period: 'MONTH',
        provider: 'STRIPE',
        cardNumber: '4242424242424242',
        cvc: '123',
        expMonth: 12,
      };
      const parsed = checkoutSchema.safeParse(withCard);
      expect(parsed.success).toBe(false);
    });

    it('les quatre noms de champ les plus probables sont tous refusés', () => {
      for (const field of ['cardNumber', 'card_number', 'pan', 'cvv']) {
        const parsed = checkoutSchema.safeParse({
          planCode: 'PREMIUM',
          period: 'MONTH',
          provider: 'STRIPE',
          [field]: '4242424242424242',
        });
        expect(parsed.success, `${field} accepté`).toBe(false);
      }
    });

    it('un paiement par carte ne demande ni numéro de téléphone ni opérateur', () => {
      expect(
        checkoutSchema.safeParse({
          planCode: 'PREMIUM',
          period: 'MONTH',
          provider: 'STRIPE',
          phone: '22997000000',
        }).success,
      ).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Souscription (§4.1, §4.3)
  // ══════════════════════════════════════════════════════════════════════════

  describe('souscription', () => {
    it('carte : ouvre un paiement PENDING et rend une URL hébergée', async () => {
      const userId = await newMember();
      const result = await billing.checkout(userId, {
        planCode: 'PREMIUM',
        period: 'MONTH',
        provider: 'STRIPE',
      });

      expect(result.status).toBe('PENDING');
      expect(result.checkoutUrl).toMatch(/^\/dev\/paiement\//);
      expect(result.amount).toEqual({ amountCents: PREMIUM_MONTH_PRICE_CENTS, currency: 'EUR' });

      const payment = await prisma.payment.findUniqueOrThrow({
        where: { id: result.paymentId },
        select: { status: true, amountCents: true, currency: true, method: true, subscriptionId: true },
      });
      // PRÉMISSE : rien n'est activé avant le webhook.
      expect(payment.status).toBe('PENDING');
      expect(payment.method).toBe('CARD');
      expect(payment.subscriptionId).toBeNull();
      expect((await prisma.subscription.count({ where: { userId } }))).toBe(0);
    });

    /**
     * RÈGLE DURE (§4.1) : « aucun numéro Mobile Money stocké au-delà de la
     * transaction ».
     *
     * MUTATION : ajouter `failureCode: input.phone` à la création du paiement → ce
     * test tombe. Il cherche le numéro dans TOUTE la ligne, sérialisée, et non dans
     * une colonne nommée : c'est la seule forme qui résiste à l'ajout d'une colonne.
     */
    it('Mobile Money : le numéro n’atterrit dans AUCUNE colonne', async () => {
      const userId = await newMember();
      const phone = '22997123456';

      const result = await billing.checkout(userId, {
        planCode: 'PREMIUM',
        period: 'MONTH',
        provider: 'MOBILE_MONEY',
        method: 'MTN_MOMO',
        phone,
      });

      expect(result.amount).toEqual({ amountCents: 2_600, currency: 'XOF' });
      expect(result.checkoutUrl).toBeNull();

      const rows = await prisma.$queryRaw<
        { line: string }[]
      >`SELECT row_to_json(p)::text AS line FROM payments p WHERE p.user_id = ${userId}::uuid`;
      expect(rows.length).toBe(1);
      for (const row of rows) expect(row.line).not.toContain(phone);

      // Et nulle part ailleurs non plus : ni abonnement, ni journal d'audit.
      const audits = await prisma.$queryRaw<
        { line: string }[]
      >`SELECT row_to_json(a)::text AS line FROM audit_logs a WHERE a.target_id = ${result.paymentId}::uuid`;
      for (const row of audits) expect(row.line).not.toContain(phone);
    });

    /**
     * §4.3 : « Une seule subscription ACTIVE par (membre, type de plan). »
     *
     * MUTATION : retirer `assertNotSubscribed` de la transaction de `checkout` → ce
     * test tombe.
     */
    it('refuse un second abonnement du même type (ALREADY_SUBSCRIBED)', async () => {
      const userId = await newMember();
      const first = await billing.checkout(userId, {
        planCode: 'PREMIUM',
        period: 'MONTH',
        provider: 'STRIPE',
      });
      const ref = await providerRefOf(prisma, first.paymentId);
      const hook = webhook(ref, 'invoice.paid');
      await billing.handleWebhook('stripe', hook.raw, hook.headers, hook.body);

      // PRÉMISSE : l'abonnement est bien ACTIVE avant la seconde tentative.
      expect(
        await prisma.subscription.count({ where: { userId, status: 'ACTIVE' } }),
      ).toBe(1);

      await expect(
        billing.checkout(userId, { planCode: 'PREMIUM', period: 'MONTH', provider: 'STRIPE' }),
      ).rejects.toMatchObject({ code: 'ALREADY_SUBSCRIBED' });
    });

    /**
     * La COURSE du §4.3, celle qu'un double clic gagne.
     *
     * MUTATION : retirer le `SELECT … FOR UPDATE` de `lockUser` → ce test tombe (les
     * deux paiements passent, puis deux abonnements naissent). Le verrou sérialise
     * par membre, et c'est ce qui fait que la seconde voit la première.
     */
    it('deux souscriptions simultanées ne donnent qu’un abonnement', async () => {
      const userId = await newMember();

      const first = await billing.checkout(userId, {
        planCode: 'PREMIUM',
        period: 'MONTH',
        provider: 'STRIPE',
      });
      const ref = await providerRefOf(prisma, first.paymentId);
      const hook = webhook(ref, 'invoice.paid');

      // Deux livraisons SIMULTANÉES du même webhook : c'est le rejeu concurrent,
      // pas séquentiel — celui qu'un verrou de ligne attrape et qu'un `count` non.
      const results = await Promise.allSettled([
        billing.handleWebhook('stripe', hook.raw, hook.headers, hook.body),
        billing.handleWebhook('stripe', hook.raw, hook.headers, hook.body),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled').length).toBeGreaterThan(0);
      expect(await prisma.subscription.count({ where: { userId } })).toBe(1);
      expect(await prisma.payment.count({ where: { userId, status: 'SUCCEEDED' } })).toBe(1);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Webhooks (§7.1, T4 §8, §12)
  // ══════════════════════════════════════════════════════════════════════════

  describe('RÈGLE DURE — un webhook rejoué n’active pas deux fois un abonnement (§12)', () => {
    /**
     * MUTATION : retirer le court-circuit `if (payment.status === 'SUCCEEDED')` de
     * `applyPaymentSucceeded` → ce test tombe (la période est prolongée deux fois).
     */
    it('le rejeu ne prolonge pas la période et ne crée pas de second paiement', async () => {
      const userId = await newMember();
      const checkout = await billing.checkout(userId, {
        planCode: 'PREMIUM',
        period: 'MONTH',
        provider: 'STRIPE',
      });
      const ref = await providerRefOf(prisma, checkout.paymentId);
      const hook = webhook(ref, 'invoice.paid');

      const first = await billing.handleWebhook('stripe', hook.raw, hook.headers, hook.body);
      expect(first).toMatchObject({ handled: true, reason: 'ACTIVATED' });

      const after = await prisma.subscription.findFirstOrThrow({
        where: { userId },
        select: { id: true, currentPeriodEnd: true, status: true },
      });
      // PRÉMISSE : l'abonnement existe et court.
      expect(after.status).toBe('ACTIVE');

      const replay = await billing.handleWebhook('stripe', hook.raw, hook.headers, hook.body);
      expect(replay).toMatchObject({ handled: true, reason: 'ALREADY_PROCESSED' });

      const again = await prisma.subscription.findUniqueOrThrow({
        where: { id: after.id },
        select: { currentPeriodEnd: true },
      });
      expect(again.currentPeriodEnd.toISOString()).toBe(after.currentPeriodEnd.toISOString());
      expect(await prisma.subscription.count({ where: { userId } })).toBe(1);
      expect(await prisma.payment.count({ where: { userId } })).toBe(1);
    });

    /**
     * MUTATION : faire rendre `{ ok: true }` à `UnconfiguredWebhookVerifier.verify`
     * → ce test tombe. Sans cette garantie, `/v1/webhooks/stripe` serait une
     * activation d'abonnement Premium ouverte à quiconque connaît l'URL.
     */
    it('sans secret configuré, TOUT webhook est refusé', async () => {
      const outbox = new OutboxService(prisma);
      const unconfigured = new BillingService(
        prisma,
        plans,
        outbox,
        new AuditService(prisma),
        card,
        momo,
        new UnconfiguredWebhookVerifier('stripe'),
        new UnconfiguredWebhookVerifier('mobile-money'),
      );

      const userId = await newMember();
      const checkout = await unconfigured.checkout(userId, {
        planCode: 'PREMIUM',
        period: 'MONTH',
        provider: 'STRIPE',
      });
      const ref = await providerRefOf(prisma, checkout.paymentId);
      const hook = webhook(ref, 'invoice.paid');

      await expect(
        unconfigured.handleWebhook('stripe', hook.raw, hook.headers, hook.body),
      ).rejects.toMatchObject({ code: 'WEBHOOK_SIGNATURE_INVALID' });

      // Et rien n'a été activé : c'est ce qui compte, pas le code d'erreur.
      expect(await prisma.subscription.count({ where: { userId } })).toBe(0);
      expect(
        (await prisma.payment.findUniqueOrThrow({ where: { id: checkout.paymentId } })).status,
      ).toBe('PENDING');
    });

    it('une signature falsifiée est refusée, un corps modifié aussi', async () => {
      const userId = await newMember();
      const checkout = await billing.checkout(userId, {
        planCode: 'PREMIUM',
        period: 'MONTH',
        provider: 'STRIPE',
      });
      const ref = await providerRefOf(prisma, checkout.paymentId);
      const hook = webhook(ref, 'invoice.paid');

      await expect(
        billing.handleWebhook('stripe', hook.raw, { 'x-webhook-signature': 'sha256=00' }, hook.body),
      ).rejects.toMatchObject({ code: 'WEBHOOK_SIGNATURE_INVALID' });

      // Corps modifié, signature d'origine : c'est l'attaque que le HMAC couvre.
      const tampered = Buffer.from(JSON.stringify({ ...hook.body, providerRef: 'autre' }));
      await expect(
        billing.handleWebhook('stripe', tampered, hook.headers, hook.body),
      ).rejects.toMatchObject({ code: 'WEBHOOK_SIGNATURE_INVALID' });

      // Corps brut absent : on refuse, on ne devine pas.
      await expect(
        billing.handleWebhook('stripe', undefined, hook.headers, hook.body),
      ).rejects.toMatchObject({ code: 'WEBHOOK_SIGNATURE_INVALID' });

      expect(await prisma.subscription.count({ where: { userId } })).toBe(0);
    });

    it('un paiement encaissé attribue un numéro de facture séquentiel par année', async () => {
      const userA = await newMember();
      const userB = await newMember();
      const numbers: string[] = [];

      for (const userId of [userA, userB]) {
        const checkout = await billing.checkout(userId, {
          planCode: 'PREMIUM',
          period: 'MONTH',
          provider: 'STRIPE',
        });
        const ref = await providerRefOf(prisma, checkout.paymentId);
        const hook = webhook(ref, 'invoice.paid');
        await billing.handleWebhook('stripe', hook.raw, hook.headers, hook.body);
        const payment = await prisma.payment.findUniqueOrThrow({
          where: { id: checkout.paymentId },
          select: { invoiceNumber: true, paidAt: true },
        });
        expect(payment.paidAt).not.toBeNull();
        expect(payment.invoiceNumber).toMatch(/^\d{4}-\d{6}$/);
        numbers.push(payment.invoiceNumber as string);
      }

      const [a, b] = numbers as [string, string];
      expect(a).not.toBe(b);
      expect(Number.parseInt(b.slice(5), 10)).toBe(Number.parseInt(a.slice(5), 10) + 1);
    });

    it('un type d’événement inconnu ne fait rien et ne lève pas', async () => {
      const userId = await newMember();
      const checkout = await billing.checkout(userId, {
        planCode: 'PREMIUM',
        period: 'MONTH',
        provider: 'STRIPE',
      });
      const ref = await providerRefOf(prisma, checkout.paymentId);
      const hook = webhook(ref, 'customer.subscription.trial_will_end');

      const result = await billing.handleWebhook('stripe', hook.raw, hook.headers, hook.body);
      expect(result).toMatchObject({ handled: false, reason: 'TYPE_IGNORED' });
      expect(await prisma.subscription.count({ where: { userId } })).toBe(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Essai (§3)
  // ══════════════════════════════════════════════════════════════════════════

  describe('essai de 14 jours', () => {
    /**
     * RÈGLE (§3 et décision T4) : l'essai s'ouvre à la PREMIÈRE ÉTAPE FRANCHIE,
     * « pas à l'inscription — le membre doit avoir vu la valeur ».
     *
     * MUTATION : retirer le `if (completed === 0)` de `startTrial` → ce test tombe,
     * et l'essai devient un cadeau d'inscription.
     */
    it('ne s’active PAS à l’inscription', async () => {
      const userId = await newMember();
      // PRÉMISSE : aucune étape franchie.
      expect(
        await prisma.journeyStep.count({
          where: { status: 'DONE', journey: { ownerUserId: userId } },
        }),
      ).toBe(0);

      await expect(billing.startTrial(userId)).rejects.toMatchObject({
        code: 'TRIAL_NOT_ELIGIBLE',
      });
      expect(await prisma.subscription.count({ where: { userId } })).toBe(0);
      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).plan,
      ).toBe('FREE');
    });

    /**
     * MUTATION : retirer le verrou `lockUser` de `grantTrial`, puis lancer les deux
     * appels en parallèle → deux essais naissent et ce test tombe.
     */
    it('s’ouvre une seule fois, même sur deux étapes franchies simultanées', async () => {
      const userId = await newMember();

      const [a, b] = await Promise.all([
        billing.handleStepCompleted(userId),
        billing.handleStepCompleted(userId),
      ]);
      expect([a.granted, b.granted].filter(Boolean).length).toBe(1);

      const trials = await prisma.subscription.findMany({
        where: { userId },
        select: { providerRef: true, currentPeriodEnd: true, cancelAtPeriodEnd: true, status: true },
      });
      expect(trials.length).toBe(1);
      const trial = trials[0];
      expect(trial?.providerRef?.startsWith('trial-')).toBe(true);
      // Un essai ne se reconduit jamais (§3 : « sans moyen de paiement enregistré »).
      expect(trial?.cancelAtPeriodEnd).toBe(true);

      // 14 jours, à la minute près.
      const days = (trial!.currentPeriodEnd.getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(TRIAL_DAYS - 0.01);
      expect(days).toBeLessThan(TRIAL_DAYS + 0.01);

      // `users.plan` suit, dans la MÊME transaction : pas d'attente d'un événement.
      expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).plan).toBe('PREMIUM');

      // Un troisième appel ne rend rien, et la route dit pourquoi.
      expect((await billing.handleStepCompleted(userId)).granted).toBe(false);
      await expect(billing.startTrial(userId)).rejects.toMatchObject({
        code: 'TRIAL_ALREADY_USED',
      });
    });

    /**
     * §3 : « à la fin, retour en FREE sans coupure de service, les parcours
     * excédentaires passent en lecture seule (JAMAIS SUPPRIMÉS) ».
     *
     * MUTATION : ajouter `await tx.journey.deleteMany({ where: { ownerUserId } })`
     * dans `endTrials` → ce test tombe. La règle est tenue par l'ABSENCE de cette
     * ligne ; le test la verrouille en comptant les parcours avant et après.
     */
    it('la fin d’essai ne supprime AUCUN parcours', async () => {
      const userId = await newMember();
      /**
       * UN VRAI PARCOURS, et c'est le point du test.
       *
       * Première écriture, ce test comptait les parcours d'un membre QUI N'EN AVAIT
       * AUCUN : zéro avant, zéro après, et la mutation « supprimer tous les parcours
       * à la fin de l'essai » passait sans être vue. Un test qui ne prouve rien
       * ressemble à un test qui prouve — d'où la fixture.
       */
      const journeyId = await journeyFor(prisma, userId);
      await billing.handleStepCompleted(userId);

      const subscription = await prisma.subscription.findFirstOrThrow({ where: { userId } });
      // On ramène l'échéance dans le passé plutôt que d'attendre quatorze jours.
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { currentPeriodEnd: new Date(Date.now() - 60_000) },
      });

      const before = await prisma.journey.count({ where: { ownerUserId: userId } });
      // PRÉMISSE : il y a bien quelque chose à ne pas supprimer.
      expect(before).toBe(1);

      const result = await billing.endTrials(new Date());
      expect(result.ended).toBeGreaterThan(0);

      expect(await prisma.journey.count({ where: { ownerUserId: userId } })).toBe(before);
      // Et la ligne est intacte, pas seulement présente : ni suppression douce, ni
      // passage en archivé, qui seraient l'un et l'autre une perte pour le membre.
      const survivor = await prisma.journey.findUniqueOrThrow({
        where: { id: journeyId },
        select: { deletedAt: true, status: true },
      });
      expect(survivor.deletedAt).toBeNull();
      expect(survivor.status).toBe('ACTIVE');
      expect(
        (await prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } })).status,
      ).toBe('EXPIRED');
      expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).plan).toBe('FREE');
    });

    it('un essai n’a ni portail Stripe ni reconduction', async () => {
      const userId = await newMember();
      await billing.handleStepCompleted(userId);

      await expect(billing.portal(userId, 'PREMIUM')).rejects.toMatchObject({ code: 'NOT_STRIPE' });
      await expect(billing.cancel(userId, 'PREMIUM')).rejects.toMatchObject({
        code: 'MOBILE_MONEY_NOT_RECURRING',
      });
    });

    it('un essai en cours n’empêche pas de payer : il est REMPLACÉ, pas prolongé', async () => {
      const userId = await newMember();
      await billing.handleStepCompleted(userId);
      const trial = await prisma.subscription.findFirstOrThrow({ where: { userId } });

      const checkout = await billing.checkout(userId, {
        planCode: 'PREMIUM',
        period: 'MONTH',
        provider: 'STRIPE',
      });
      const ref = await providerRefOf(prisma, checkout.paymentId);
      const hook = webhook(ref, 'invoice.paid');
      await billing.handleWebhook('stripe', hook.raw, hook.headers, hook.body);

      // Une seule ligne : l'essai est devenu l'abonnement payé.
      const rows = await prisma.subscription.findMany({ where: { userId } });
      expect(rows.length).toBe(1);
      expect(rows[0]?.id).toBe(trial.id);
      expect(rows[0]?.providerRef).toBe(ref);
      expect(rows[0]?.cancelAtPeriodEnd).toBe(false);
      // Un mois, et non quatorze jours + un mois.
      const days = (rows[0]!.currentPeriodEnd.getTime() - Date.now()) / 86_400_000;
      expect(days).toBeLessThan(32);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Expiration et grâce (§4.2, §4.3)
  // ══════════════════════════════════════════════════════════════════════════

  describe('expiration', () => {
    /**
     * §4.2 : « Après expiration : 3 jours de grâce, puis EXPIRED. »
     *
     * MUTATION : retirer `addDays(now, -MOBILE_MONEY_GRACE_DAYS)` au profit de `now`
     * dans `expireSubscriptions` → ce test tombe, la grâce disparaît.
     */
    it('Mobile Money : 3 jours de grâce avant EXPIRED', async () => {
      const userId = await newMember();
      const premiumId = await plans.idOf('PREMIUM');

      // Échu depuis DEUX jours : dans la grâce.
      const inGrace = await prisma.subscription.create({
        data: {
          id: newId(),
          userId,
          planId: premiumId,
          status: 'ACTIVE',
          provider: 'MOBILE_MONEY',
          providerRef: `momo-${newId()}`,
          currentPeriodStart: new Date(Date.now() - 32 * 86_400_000),
          currentPeriodEnd: new Date(Date.now() - 2 * 86_400_000),
          cancelAtPeriodEnd: true,
        },
      });
      await prisma.user.update({ where: { id: userId }, data: { plan: 'PREMIUM' } });

      await billing.expireSubscriptions(new Date());
      expect(
        (await prisma.subscription.findUniqueOrThrow({ where: { id: inGrace.id } })).status,
      ).toBe('ACTIVE');
      expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).plan).toBe('PREMIUM');

      // Échu depuis QUATRE jours : la grâce est passée.
      await prisma.subscription.update({
        where: { id: inGrace.id },
        data: {
          currentPeriodEnd: new Date(Date.now() - (MOBILE_MONEY_GRACE_DAYS + 1) * 86_400_000),
        },
      });
      await billing.expireSubscriptions(new Date());
      expect(
        (await prisma.subscription.findUniqueOrThrow({ where: { id: inGrace.id } })).status,
      ).toBe('EXPIRED');
      expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).plan).toBe('FREE');
    });

    /**
     * LE PIÈGE DU `notIn` SUR UNE COLONNE NULLABLE, appliqué ici.
     *
     * MUTATION : remplacer le `OR: [{ providerRef: null }, { providerRef: { not:
     * { startsWith } } }]` de `expireSubscriptions` par le seul
     * `providerRef: { not: { startsWith } }` → ce test tombe. En SQL,
     * `provider_ref NOT LIKE 'trial-%'` vaut NULL — donc faux — dès que la colonne
     * est NULL, et un abonnement payé sans référence n'expirerait JAMAIS.
     */
    it('un abonnement à provider_ref NULL expire quand même', async () => {
      const userId = await newMember();
      const premiumId = await plans.idOf('PREMIUM');

      const orphan = await prisma.subscription.create({
        data: {
          id: newId(),
          userId,
          planId: premiumId,
          status: 'ACTIVE',
          provider: 'MOBILE_MONEY',
          // NULL : le cas réel d'un paiement dont la référence n'a pas été rendue.
          providerRef: null,
          currentPeriodStart: new Date(Date.now() - 40 * 86_400_000),
          currentPeriodEnd: new Date(Date.now() - 10 * 86_400_000),
          cancelAtPeriodEnd: true,
        },
      });
      // PRÉMISSE : la colonne est bien NULL, et l'échéance bien dépassée.
      expect(orphan.providerRef).toBeNull();

      await billing.expireSubscriptions(new Date());
      expect(
        (await prisma.subscription.findUniqueOrThrow({ where: { id: orphan.id } })).status,
      ).toBe('EXPIRED');
    });

    it('un essai échu n’est PAS traité par expire_subscriptions (il a sa tâche)', async () => {
      const userId = await newMember();
      await billing.handleStepCompleted(userId);
      const trial = await prisma.subscription.findFirstOrThrow({ where: { userId } });
      await prisma.subscription.update({
        where: { id: trial.id },
        data: { currentPeriodEnd: new Date(Date.now() - 10 * 86_400_000) },
      });

      await billing.expireSubscriptions(new Date());
      // Toujours ACTIVE : `billing.trial_end` s'en occupe, pas la grâce Mobile Money.
      expect(
        (await prisma.subscription.findUniqueOrThrow({ where: { id: trial.id } })).status,
      ).toBe('ACTIVE');

      await billing.endTrials(new Date());
      expect(
        (await prisma.subscription.findUniqueOrThrow({ where: { id: trial.id } })).status,
      ).toBe('EXPIRED');
    });

    it('une annulation carte prend effet en fin de période, et est réversible', async () => {
      const userId = await newMember();
      const checkout = await billing.checkout(userId, {
        planCode: 'PREMIUM',
        period: 'MONTH',
        provider: 'STRIPE',
      });
      const ref = await providerRefOf(prisma, checkout.paymentId);
      const hook = webhook(ref, 'invoice.paid');
      await billing.handleWebhook('stripe', hook.raw, hook.headers, hook.body);

      const cancelled = await billing.cancel(userId, 'PREMIUM');
      expect(cancelled.cancelAtPeriodEnd).toBe(true);
      // §4.3 : « users.plan reste PREMIUM jusqu'à current_period_end. »
      expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).plan).toBe('PREMIUM');

      const resumed = await billing.resume(userId, 'PREMIUM');
      expect(resumed.cancelAtPeriodEnd).toBe(false);
      expect(resumed.cancelledAt).toBeNull();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Quotas et factures (§4.4, §4.5)
  // ══════════════════════════════════════════════════════════════════════════

  describe('quotas et factures', () => {
    it('les compteurs du mois sont rendus avec leur plafond et leur date de remise à zéro', async () => {
      const userId = await newMember();
      const usage = await billing.usage(userId);

      expect(usage.periodKey).toMatch(/^\d{4}-\d{2}$/);
      expect(new Date(usage.resetsAt).getTime()).toBeGreaterThan(Date.now());
      const events = usage.items.find((i) => i.metric === 'EVENTS_CREATED');
      expect(events).toMatchObject({ used: 0, limit: 1 });
    });

    it('un membre Premium voit « illimité » plutôt qu’un plafond', async () => {
      const userId = await newMember('PREMIUM');
      const usage = await billing.usage(userId);
      expect(usage.items.find((i) => i.metric === 'EVENTS_CREATED')?.limit).toBeNull();
    });

    it('la facture PDF répond 503, avec son numéro : elle existe, elle n’est pas rendue', async () => {
      const userId = await newMember();
      const checkout = await billing.checkout(userId, {
        planCode: 'PREMIUM',
        period: 'MONTH',
        provider: 'STRIPE',
      });
      const ref = await providerRefOf(prisma, checkout.paymentId);
      const hook = webhook(ref, 'invoice.paid');
      await billing.handleWebhook('stripe', hook.raw, hook.headers, hook.body);

      await expect(billing.invoice(userId, checkout.paymentId)).rejects.toMatchObject({
        code: 'INVOICE_UNAVAILABLE',
      });
      // Et la facture d'un AUTRE membre est un 404, jamais un 403 (T4 §3).
      const other = await newMember();
      await expect(billing.invoice(other, checkout.paymentId)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    /**
     * §4.4 : « Remboursement : sous 14 jours sans usage significatif. »
     *
     * MUTATION : retirer le contrôle de la fenêtre de 14 jours → ce test tombe.
     */
    it('un paiement de plus de 14 jours n’est plus remboursable', async () => {
      const userId = await newMember();
      const checkout = await billing.checkout(userId, {
        planCode: 'PREMIUM',
        period: 'MONTH',
        provider: 'STRIPE',
      });
      const ref = await providerRefOf(prisma, checkout.paymentId);
      const hook = webhook(ref, 'invoice.paid');
      await billing.handleWebhook('stripe', hook.raw, hook.headers, hook.body);

      const staff = await staffId(prisma);

      // Dans la fenêtre, sans usage : remboursable.
      const ok = await billing.refund(staff, checkout.paymentId, 'test de recette');
      expect(ok.refunded).toBe(true);
      expect(
        (await prisma.payment.findUniqueOrThrow({ where: { id: checkout.paymentId } })).status,
      ).toBe('REFUNDED');

      // Un second remboursement n'est plus possible.
      await expect(billing.refund(staff, checkout.paymentId, 'encore')).rejects.toMatchObject({
        code: 'PAYMENT_NOT_REFUNDABLE',
      });

      // Hors fenêtre : refus, même sans usage.
      await prisma.payment.update({
        where: { id: checkout.paymentId },
        data: { status: 'SUCCEEDED', paidAt: new Date(Date.now() - 20 * 86_400_000) },
      });
      await expect(billing.refund(staff, checkout.paymentId, 'trop tard')).rejects.toMatchObject({
        code: 'REFUND_NOT_ELIGIBLE',
      });
    });

    it('la purge des compteurs ne retire que ce qui a plus de 13 mois', async () => {
      const userId = await newMember();
      await prisma.usageCounter.createMany({
        data: [
          { userId, metric: 'EVENTS_CREATED', periodKey: '2020-01', count: 3 },
          { userId, metric: 'PRO_CONTACTS', periodKey: '2099-01', count: 1 },
        ],
      });

      await billing.purgeUsageCounters(new Date());
      const left = await prisma.usageCounter.findMany({
        where: { userId },
        select: { periodKey: true },
      });
      expect(left.map((c) => c.periodKey)).toEqual(['2099-01']);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Équipe : audit (§7.2, règle dure 00 §7.4)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * RÈGLE DURE (00 §7.4) : « toute action admin écrit une ligne dans `audit_logs` ».
   *
   * Ces deux tests sont ce qui autorise `admin.int.test.ts` à exempter
   * `PUT /admin/billing/plans/:code` et `POST /admin/billing/payments/:id/refund` de
   * sa propre vérification de couverture : la trace est éprouvée ici, à côté de la
   * logique qu'elle trace.
   */
  describe('actions d’équipe tracées', () => {
    it('la modification d’un plan écrit sa trace, avec l’avant et l’après', async () => {
      const staff = await staffId(prisma);
      const before = await prisma.plan.findUniqueOrThrow({ where: { code: 'PRO' } });

      try {
        await billing.updatePlan(staff, 'PRO', { priceCents: 2_600 });
        expect(
          (await prisma.plan.findUniqueOrThrow({ where: { code: 'PRO' } })).priceCents,
        ).toBe(2_600);

        const trace = await prisma.auditLog.findFirst({
          where: { action: 'billing.plan_updated', targetId: before.id },
          orderBy: { createdAt: 'desc' },
          select: { actorType: true, actorId: true, metadata: true },
        });
        expect(trace).not.toBeNull();
        expect(trace?.actorType).toBe('STAFF');
        expect(trace?.actorId).toBe(staff);
        expect(trace?.metadata).toMatchObject({ code: 'PRO' });
      } finally {
        await prisma.plan.update({
          where: { code: 'PRO' },
          data: { priceCents: before.priceCents },
        });
        plans.invalidate();
      }
    });

    it('un remboursement écrit sa trace, avec son motif', async () => {
      const userId = await newMember();
      const checkout = await billing.checkout(userId, {
        planCode: 'PREMIUM',
        period: 'MONTH',
        provider: 'STRIPE',
      });
      const ref = await providerRefOf(prisma, checkout.paymentId);
      const hook = webhook(ref, 'invoice.paid');
      await billing.handleWebhook('stripe', hook.raw, hook.headers, hook.body);

      const staff = await staffId(prisma);
      await billing.refund(staff, checkout.paymentId, 'geste commercial de recette');

      const trace = await prisma.auditLog.findFirst({
        where: { action: 'billing.payment_refunded', targetId: checkout.paymentId },
        select: { actorType: true, metadata: true },
      });
      expect(trace?.actorType).toBe('STAFF');
      expect(trace?.metadata).toMatchObject({ reason: 'geste commercial de recette' });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Événements de domaine (§9)
  // ══════════════════════════════════════════════════════════════════════════

  describe('événements', () => {
    it('l’activation, l’essai et l’expiration émettent subscription.changed', async () => {
      const userId = await newMember();
      await billing.handleStepCompleted(userId);
      const trial = await prisma.subscription.findFirstOrThrow({ where: { userId } });

      const started = await prisma.domainEvent.findMany({
        where: { type: 'subscription.changed', aggregateId: trial.id },
        select: { payload: true },
      });
      expect(started.length).toBe(1);
      expect(started[0]?.payload).toMatchObject({ reason: 'TRIAL_STARTED', userId });

      await prisma.subscription.update({
        where: { id: trial.id },
        data: { currentPeriodEnd: new Date(Date.now() - 1_000) },
      });
      await billing.endTrials(new Date());

      const all = await prisma.domainEvent.findMany({
        where: { type: 'subscription.changed', aggregateId: trial.id },
        select: { payload: true },
      });
      const reasons = all.map((e) => (e.payload as { reason?: string }).reason);
      expect(reasons).toContain('TRIAL_ENDED');
    });

    it('les rappels J−7 et J−1 partent une fois par créneau', async () => {
      const userId = await newMember();
      const premiumId = await plans.idOf('PREMIUM');
      const subscription = await prisma.subscription.create({
        data: {
          id: newId(),
          userId,
          planId: premiumId,
          status: 'ACTIVE',
          provider: 'MOBILE_MONEY',
          providerRef: `momo-${newId()}`,
          currentPeriodStart: new Date(),
          // Dans 6,5 jours : la fenêtre J−7 est [J−7, J−6).
          currentPeriodEnd: new Date(Date.now() + 6.5 * 86_400_000),
          cancelAtPeriodEnd: true,
        },
      });

      const result = await billing.sendExpiryReminders(new Date());
      expect(result.renewals).toBe(1);

      const events = await prisma.domainEvent.findMany({
        where: { type: 'subscription.changed', aggregateId: subscription.id },
        select: { payload: true },
      });
      expect(events.map((e) => (e.payload as { reason?: string }).reason)).toEqual(['RENEWAL_J7']);
    });
  });
});

/** La référence fournisseur d'un paiement — ce que le webhook porterait. */
async function providerRefOf(prisma: PrismaService, paymentId: string): Promise<string> {
  const row = await prisma.payment.findUniqueOrThrow({
    where: { id: paymentId },
    select: { providerRef: true },
  });
  if (row.providerRef === null) throw new Error('paiement sans référence fournisseur');
  return row.providerRef;
}

/**
 * Un identifiant de compte d'équipe, pour les actions tracées dans `audit_logs`.
 *
 * `audit_logs.actor_staff_id` référence `staff_users` : un UUID inventé violerait
 * la clé étrangère, et l'échec ressemblerait à un défaut du remboursement.
 */
async function staffId(prisma: PrismaService): Promise<string> {
  const existing = await prisma.staffUser.findFirst({ select: { id: true } });
  if (existing !== null) return existing.id;
  const created = await prisma.staffUser.create({
    data: {
      id: newId(),
      email: `recette-${Date.now()}@example.test`,
      passwordHash: 'argon2-factice',
      displayName: 'Recette facturation',
      // `totp_secret_encrypted` est NOT NULL : le second facteur n'est pas optionnel
      // (15 §2.1). La fixture n'a pas à être un vrai secret, mais elle doit exister.
      totpSecretEncrypted: Buffer.from('fixture'),
      role: 'SUPPORT',
      isActive: true,
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * Un parcours réel, pour éprouver « la dégradation ne supprime aucun parcours ».
 *
 * Écrit en direct plutôt que par `JourneysService.create` : celui-ci demande un
 * modèle publié, ses étapes et une ville d'arrivée, soit une fixture cinq fois
 * plus grosse que ce que ce test doit démontrer. Ce qui compte ici est qu'une
 * LIGNE de `journeys` existe et survive.
 */
async function journeyFor(prisma: PrismaService, userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { originCountryId: true },
  });
  const city = await prisma.city.findFirstOrThrow({ select: { id: true } });

  const template = await prisma.journeyTemplate.create({
    data: {
      id: newId(),
      code: `recette-facturation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      nameFr: 'Type de recette facturation',
      targetPhase: 'PRE_DEPARTURE',
      isActive: true,
      sortOrder: 999,
    },
    select: { id: true },
  });
  const version = await prisma.journeyTemplateVersion.create({
    data: { id: newId(), templateId: template.id, version: 1, status: 'PUBLISHED' },
    select: { id: true },
  });
  const journey = await prisma.journey.create({
    data: {
      id: newId(),
      ownerUserId: userId,
      templateVersionId: version.id,
      title: 'Parcours de recette',
      status: 'ACTIVE',
      visibility: 'PRIVATE',
      originCountryId: user.originCountryId,
      destinationCityId: city.id,
      lastActivityAt: new Date(),
    },
    select: { id: true },
  });
  return journey.id;
}
