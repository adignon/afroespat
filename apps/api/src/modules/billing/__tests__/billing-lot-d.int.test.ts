import { reglerMonetisation } from '../../../common/__tests__/monetisation';
import { newId } from '@app/db';
import {
  BILLING_PAYMENT_METHODS_SETTING_KEY,
  BILLING_YEAR_PRICES_SETTING_KEY,
  PAYMENT_METHODS_DEFAULT,
  PAYMENT_PENDING_TIMEOUT_MINUTES,
} from '@app/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiError } from '../../../common/api-error';
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
import { HmacWebhookVerifier, signWebhookBody } from '../billing.ports';
import { BillingService } from '../billing.service';
import { PlanService } from '../plan.service';
import { numeroDEpreuve } from '../../../common/__tests__/numeros';

/**
 * Lot D — moyens de paiement, activation des plans et des options, corrections de
 * facturation hors paiement réel. Banc d'intégration : demande PostgreSQL.
 *
 * Chaque test vérifie d'abord sa PRÉMISSE (état des plans, des réglages, des
 * abonnements) avant d'asserter l'effet.
 */
const WEBHOOK_SECRET = 'secret-de-test-pour-les-webhooks-000000';
const MOTIF = 'Réglage de recette du lot D';

describe('facturation — lot D', () => {
  let prisma: PrismaService;
  let plans: PlanService;
  let billing: BillingService;
  let auth: AuthService;
  const sms = new FakeSmsProvider();
  const createdUserIds: string[] = [];
  const createdStaffIds: string[] = [];
  let counter = 5_000;

  async function newMember(): Promise<string> {
    const { challengeId } = await auth.requestOtp({
      phone: numeroDEpreuve(counter++),
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
    await prisma.user.update({ where: { id: session.userId }, data: { verificationLevel: 'L1' } });
    return session.userId;
  }

  async function newStaff(): Promise<string> {
    const staff = await prisma.staffUser.create({
      data: {
        id: newId(),
        email: `recette-lot-d-${newId()}@example.test`,
        passwordHash: 'x',
        totpSecretEncrypted: Buffer.from('x'),
        isActive: true,
        role: 'SUPER_ADMIN',
        displayName: 'Recette lot D',
      },
      select: { id: true },
    });
    createdStaffIds.push(staff.id);
    return staff.id;
  }

  function webhook(providerRef: string, type: string) {
    const body = { id: `evt-${newId()}`, type, providerRef };
    const raw = Buffer.from(JSON.stringify(body));
    return { body, raw, headers: { 'x-webhook-signature': signWebhookBody(WEBHOOK_SECRET, raw) } };
  }

  async function rejet(promesse: Promise<unknown>): Promise<ApiError> {
    try {
      await promesse;
    } catch (e) {
      if (e instanceof ApiError) return e;
      throw e;
    }
    throw new Error('Un refus était attendu.');
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    await reglerMonetisation(prisma, true);
    plans = new PlanService(prisma);
    billing = new BillingService(
      prisma,
      plans,
      new OutboxService(prisma),
      new AuditService(prisma),
      new FakePaymentProvider(),
      new FakeMobileMoneyProvider(),
      new HmacWebhookVerifier('stripe', WEBHOOK_SECRET),
      new HmacWebhookVerifier('mobile-money', WEBHOOK_SECRET),
    );
    auth = new AuthService(
      prisma,
      new CryptoService(),
      new OutboxService(prisma),
      new TokenService(),
      new ConsentsService(prisma),
      sms,
      new FakeCaptchaProvider(),
    );
  });

  afterAll(async () => {
    // Remet les plans comme le seed les laisse (actifs) et efface les réglages.
    await prisma.plan.updateMany({ data: { isActive: true } });
    await prisma.systemSetting.deleteMany({ where: { key: BILLING_YEAR_PRICES_SETTING_KEY } });
    await reglerMonetisation(prisma, null);
    if (createdUserIds.length > 0) await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    if (createdStaffIds.length > 0) await prisma.staffUser.deleteMany({ where: { id: { in: createdStaffIds } } });
    await prisma.$disconnect();
  });

  // ══ Activation et refus de checkout ═══════════════════════════════════════

  describe('checkout refusé quand ce n’est pas ouvert à la vente', () => {
    it('monétisation éteinte : PAYMENTS_DISABLED, rien n’est créé', async () => {
      const staff = await newStaff();
      const userId = await newMember();
      await billing.setMonetisation(staff, false, MOTIF);
      try {
        const erreur = await rejet(billing.checkout(userId, { planCode: 'PREMIUM', period: 'MONTH', provider: 'STRIPE' }));
        expect(erreur.code).toBe('PAYMENTS_DISABLED');
        expect(await prisma.payment.count({ where: { userId } })).toBe(0);
      } finally {
        await billing.setMonetisation(staff, true, MOTIF);
      }
    });

    it('plan désactivé : PLAN_DISABLED, et GET /plans ne le rend plus', async () => {
      const staff = await newStaff();
      const userId = await newMember();
      expect((await plans.publicPlans()).some((p) => p.code === 'PREMIUM')).toBe(true);
      await billing.setPlanEnabled(staff, 'PREMIUM', false, MOTIF);
      try {
        expect((await plans.publicPlans()).some((p) => p.code === 'PREMIUM')).toBe(false);
        const erreur = await rejet(billing.checkout(userId, { planCode: 'PREMIUM', period: 'MONTH', provider: 'STRIPE' }));
        expect(erreur.code).toBe('PLAN_DISABLED');
      } finally {
        await billing.setPlanEnabled(staff, 'PREMIUM', true, MOTIF);
      }
      expect((await plans.publicPlans()).some((p) => p.code === 'PREMIUM')).toBe(true);
    });

    it('moyen désactivé : PAYMENT_METHOD_DISABLED pour lui seul', async () => {
      const staff = await newStaff();
      const userId = await newMember();
      await billing.updatePaymentMethods(staff, { methods: [{ code: 'MOBILE_MONEY_MOOV', enabled: false }], reason: MOTIF });
      try {
        const erreur = await rejet(
          billing.checkout(userId, {
            planCode: 'PREMIUM',
            period: 'MONTH',
            provider: 'MOBILE_MONEY',
            method: 'MOOV_MONEY',
            phone: '22997000001',
          }),
        );
        expect(erreur.code).toBe('PAYMENT_METHOD_DISABLED');
        // La carte, elle, passe encore.
        const ok = await billing.checkout(userId, { planCode: 'PREMIUM', period: 'MONTH', provider: 'STRIPE' });
        expect(ok.status).toBe('PENDING');
      } finally {
        await billing.updatePaymentMethods(staff, { methods: [{ code: 'MOBILE_MONEY_MOOV', enabled: true }], reason: MOTIF });
      }
    });

    it('/me/subscription : paiementsDisponibles suit la configuration', async () => {
      const staff = await newStaff();
      const userId = await newMember();
      expect((await billing.mySubscription(userId)).paiementsDisponibles).toBe(true);
      expect((await billing.mySubscription(userId)).moyensPaiement.length).toBe(3);

      await billing.updatePaymentMethods(staff, {
        methods: PAYMENT_METHODS_DEFAULT.map((m) => ({ code: m.code, enabled: false })),
        reason: MOTIF,
      });
      try {
        const vue = await billing.mySubscription(userId);
        expect(vue.paiementsDisponibles).toBe(false);
        expect(vue.moyensPaiement).toEqual([]);
      } finally {
        await prisma.systemSetting.deleteMany({ where: { key: BILLING_PAYMENT_METHODS_SETTING_KEY } });
        await reglerMonetisation(prisma, true);
      }
    });

    it('chaque bascule est tracée dans le journal d’audit, motif compris', async () => {
      const staff = await newStaff();
      await billing.updatePaidOptions(staff, { options: { SPONSORED_JOBS: false }, reason: MOTIF });
      try {
        const traces = await prisma.auditLog.findMany({
          where: { actorId: staff, action: 'billing.paid_options_changed' },
        });
        expect(traces).toHaveLength(1);
        expect(JSON.stringify(traces[0]?.metadata)).toContain(MOTIF);
      } finally {
        await reglerMonetisation(prisma, true);
      }
    });
  });

  describe('quotas par option', () => {
    it('option « avantages à quota » éteinte : un membre gratuit a les limites Premium', async () => {
      const staff = await newStaff();
      const userId = await newMember();
      const premium = await plans.limitsOf('PREMIUM');
      const gratuit = await plans.limitsOf('FREE');
      // PRÉMISSE : les deux plans diffèrent, sinon le test ne prouve rien.
      expect(gratuit.maxActiveJourneys).not.toBe(premium.maxActiveJourneys);
      expect((await plans.limitsFor(userId)).maxActiveJourneys).toBe(gratuit.maxActiveJourneys);

      await billing.updatePaidOptions(staff, { options: { PREMIUM_PERKS: false }, reason: MOTIF });
      try {
        expect((await plans.limitsFor(userId)).maxActiveJourneys).toBe(premium.maxActiveJourneys);
      } finally {
        await reglerMonetisation(prisma, true);
      }
    });

    it('/me/usage expose SPONSORED_JOBS avec son plafond', async () => {
      const userId = await newMember();
      const usage = await billing.usage(userId);
      const ligne = usage.items.find((i) => i.metric === 'SPONSORED_JOBS');
      expect(ligne).toBeDefined();
      expect(ligne?.used).toBe(0);
      expect(ligne?.limit).toBe((await plans.limitsFor(userId)).sponsoredJobsPerMonth);
    });
  });

  // ══ (a) prix annuel ═══════════════════════════════════════════════════════

  it('(a) updatePlan écrit yearPriceCents et le tableau annuel le reflète', async () => {
    const staff = await newStaff();
    const avant = await plans.yearPrices();
    expect(avant.PREMIUM).not.toBe(4321);
    await billing.updatePlan(staff, 'PREMIUM', { yearPriceCents: 4321 }, MOTIF);
    expect((await plans.yearPrices()).PREMIUM).toBe(4321);
    expect((await plans.yearPrices()).PRO).toBe(avant.PRO);
    const admin = await billing.adminPlans();
    expect(admin.items.find((p) => p.code === 'PREMIUM')?.yearPriceCents).toBe(4321);
  });

  // ══ (b) remboursement ═════════════════════════════════════════════════════

  it('(b) un remboursement coupe l’abonnement et ramène le membre à FREE', async () => {
    const staff = await newStaff();
    const userId = await newMember();
    const { paymentId } = await billing.checkout(userId, { planCode: 'PREMIUM', period: 'MONTH', provider: 'STRIPE' });
    const ref = (await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } })).providerRef as string;
    const hook = webhook(ref, 'invoice.paid');
    await billing.handleWebhook('stripe', hook.raw, hook.headers, hook.body);
    // PRÉMISSE : le membre est bien Premium avant le remboursement.
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).plan).toBe('PREMIUM');

    await billing.refund(staff, paymentId, MOTIF);

    const sub = await prisma.subscription.findFirstOrThrow({ where: { userId } });
    expect(sub.status).toBe('CANCELLED');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).plan).toBe('FREE');
    // Rejouer le remboursement ne refait rien et ne lève pas de second effet.
    const rejeu = await rejet(billing.refund(staff, paymentId, MOTIF));
    expect(rejeu.code).toBe('PAYMENT_NOT_REFUNDABLE');
  });

  // ══ (c) funnel Pro ════════════════════════════════════════════════════════

  it('(c) un paiement Pro crée l’abonnement PRO de la fiche, et le consommateur pose le niveau', async () => {
    const userId = await newMember();
    const profession = await prisma.profession.findFirst({ select: { id: true } });
    expect(profession, 'le seed des métiers').not.toBeNull();
    const proProfileId = newId();
    await prisma.proProfile.create({
      data: {
        id: proProfileId,
        userId,
        professionId: (profession as { id: string }).id,
        contactMethod: 'PLATFORM_MESSAGE',
        verificationStatus: 'APPROVED',
        tier: 'FREE',
        status: 'ACTIVE',
      },
    });

    const { paymentId } = await billing.checkout(userId, {
      planCode: 'PRO',
      period: 'YEAR',
      provider: 'STRIPE',
      proProfileId,
    });
    const paiement = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(paiement.planCode).toBe('PRO');
    expect(paiement.period).toBe('YEAR');
    expect(paiement.proProfileId).toBe(proProfileId);

    const hook = webhook(paiement.providerRef as string, 'invoice.paid');
    const resultat = await billing.handleWebhook('stripe', hook.raw, hook.headers, hook.body);
    expect(resultat.handled).toBe(true);

    const sub = await prisma.subscription.findFirstOrThrow({
      where: { userId },
      include: { plan: { select: { code: true } } },
    });
    // Avant le correctif : PREMIUM, et sans fiche.
    expect(sub.plan.code).toBe('PRO');
    expect(sub.proProfileId).toBe(proProfileId);
    // L'année est lue sur la période mémorisée : la fin est à environ un an.
    expect(sub.currentPeriodEnd.getTime() - Date.now()).toBeGreaterThan(300 * 86_400_000);
    // Le membre n'est pas Premium pour autant : Premium et Pro sont indépendants.
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).plan).toBe('FREE');

    await billing.applyProTier(sub.id);
    const fiche = await prisma.proProfile.findUniqueOrThrow({ where: { id: proProfileId } });
    expect(fiche.tier).toBe('PRO');
    expect(fiche.tierUntil?.getTime()).toBe(sub.currentPeriodEnd.getTime());

    // Rejouer le consommateur ne change rien (livraison « au moins une fois »).
    await billing.applyProTier(sub.id);
    expect((await prisma.proProfile.findUniqueOrThrow({ where: { id: proProfileId } })).tier).toBe('PRO');

    // Abonnement expiré : la fiche redescend.
    await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'EXPIRED' } });
    await billing.applyProTier(sub.id);
    const apres = await prisma.proProfile.findUniqueOrThrow({ where: { id: proProfileId } });
    expect(apres.tier).toBe('FREE');
    expect(apres.tierUntil).toBeNull();
  });

  // ══ (e) paiements en attente ══════════════════════════════════════════════

  it('(e) un paiement PENDING de plus de 5 minutes passe FAILED, pas un récent', async () => {
    const userId = await newMember();
    const vieux = await billing.checkout(userId, { planCode: 'PREMIUM', period: 'MONTH', provider: 'STRIPE' });
    const maintenant = new Date();
    await prisma.payment.update({
      where: { id: vieux.paymentId },
      data: { createdAt: new Date(maintenant.getTime() - (PAYMENT_PENDING_TIMEOUT_MINUTES + 1) * 60_000) },
    });
    const resultat = await billing.expirePendingPayments(maintenant);
    expect(resultat.expired).toBeGreaterThanOrEqual(1);
    const paiement = await prisma.payment.findUniqueOrThrow({ where: { id: vieux.paymentId } });
    expect(paiement.status).toBe('FAILED');
    expect(paiement.failureCode).toBe('TIMEOUT');

    const recent = await billing.checkout(userId, { planCode: 'PREMIUM', period: 'MONTH', provider: 'STRIPE' });
    await billing.expirePendingPayments(maintenant);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: recent.paymentId } })).status).toBe('PENDING');
  });
});
