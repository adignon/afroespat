import { newId } from '@app/db';
import {
  CLICK_ID_TOKEN,
  HOUSING_SECTION_STEP_CODE,
  PARTNER_BADGE_LABEL,
  PLACEMENT_SECTIONS,
  affiliateUrlTemplateSchema,
  buildAffiliateUrl,
  placementQuerySchema,
} from '@app/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../../../common/audit.service';
import { CryptoService } from '../../../common/crypto.service';
import { OutboxService } from '../../../common/outbox.service';
import { PrismaService } from '../../../common/prisma.service';
import { TokenService } from '../../../common/token.service';
import { FakeCaptchaProvider, FakeSmsProvider } from '../../../providers/providers';
import { AuthService } from '../../auth/auth.service';
import { ConsentsService } from '../../consents/consents.service';
import { PlanService } from '../../billing/plan.service';
import { PartnersService } from '../partners.service';

/**
 * Partenaires et affiliation — 14-monetisation.md §5 et §12.
 *
 * Les quatre règles dures du §12 qui concernent ce module ont chacune leur test, et
 * chacun a été ÉPROUVÉ PAR MUTATION — la mutation est notée en tête.
 *
 * DEUX D'ENTRE ELLES SONT TENUES PAR UNE ABSENCE de code (« aucun encart hors
 * étape et pied de Logement », « aucune priorité d'affichage »), et une absence ne
 * lève jamais toute seule. Elles sont donc verrouillées par des LISTES FERMÉES
 * qu'on compte, et par le test statique de `hard-rules.int.test.ts`.
 */
describe('partenaires (14 §5, §12)', () => {
  let prisma: PrismaService;
  let partners: PartnersService;
  let plans: PlanService;
  let auth: AuthService;
  const sms = new FakeSmsProvider();

  const createdUserIds: string[] = [];
  const createdPartnerIds: string[] = [];
  const createdStepIds: string[] = [];
  let counter = 0;
  let staffId = '';

  /** Deux pays réels du référentiel : le Bénin (origine) et la France (destination). */
  let benin = '';
  let france = '';
  let togo = '';
  let cityLyon = '';

  const nextPhone = (): string =>
    `07${String(Date.now()).slice(-6)}${String(counter++).padStart(2, '0')}`;

  async function newMember(options?: {
    plan?: 'FREE' | 'PREMIUM';
    cityId?: string | null;
    originCountryId?: string;
  }): Promise<string> {
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
      data: {
        verificationLevel: 'L1',
        plan: options?.plan ?? 'FREE',
        cityId: options?.cityId === undefined ? cityLyon : options.cityId,
        // `origin_country_id` est NOT NULL dans le schéma : `null` n'est pas une
        // valeur possible, seule l'absence de fixture l'est. Le paramètre reste
        // typé `string` pour cette raison.
        originCountryId: options?.originCountryId ?? benin,
      },
    });
    return session.userId;
  }

  async function stepDefinition(code: string): Promise<string> {
    const created = await prisma.stepDefinition.create({
      data: {
        id: newId(),
        code: `${code}-${Date.now()}-${counter++}`,
        nameFr: 'Étape de recette partenaires',
        category: 'PRE_DEPARTURE',
        blockerTarget: 'NONE',
        isMajorMilestone: false,
        isRisky: false,
        documentChecklist: [],
      },
      select: { id: true },
    });
    createdStepIds.push(created.id);
    return created.id;
  }

  async function partner(template?: string): Promise<string> {
    const created = await partners.createPartner(staffId, {
      name: `Assurance de recette ${counter++}`,
      category: 'INSURANCE',
      affiliateUrlTemplate: template ?? `https://partenaire.example/offre?ref=${CLICK_ID_TOKEN}`,
      payoutModel: 'CPA',
      isActive: true,
    });
    createdPartnerIds.push(created.id);
    return created.id;
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    const outbox = new OutboxService(prisma);
    const audit = new AuditService(prisma);
    plans = new PlanService(prisma);
    partners = new PartnersService(prisma, plans, audit);
    auth = new AuthService(
      prisma,
      new CryptoService(),
      outbox,
      new TokenService(),
      new ConsentsService(prisma),
      sms,
      new FakeCaptchaProvider(),
    );

    benin = (await prisma.country.findUniqueOrThrow({ where: { iso2: 'BJ' } })).id;
    france = (await prisma.country.findUniqueOrThrow({ where: { iso2: 'FR' } })).id;
    togo = (await prisma.country.findUniqueOrThrow({ where: { iso2: 'TG' } })).id;
    cityLyon = (await prisma.city.findUniqueOrThrow({ where: { slug: 'lyon' } })).id;

    const existing = await prisma.staffUser.findFirst({ select: { id: true } });
    staffId =
      existing?.id ??
      (
        await prisma.staffUser.create({
          data: {
            id: newId(),
            email: `recette-partenaires-${Date.now()}@example.test`,
            passwordHash: 'argon2-factice',
            displayName: 'Recette partenaires',
            totpSecretEncrypted: Buffer.from('fixture'),
            role: 'CONTENT_ADMIN',
            isActive: true,
          },
          select: { id: true },
        })
      ).id;
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    // `partner_placements` et `affiliate_clicks` sont en CASCADE sur `partners`.
    if (createdPartnerIds.length > 0) {
      await prisma.partner.deleteMany({ where: { id: { in: createdPartnerIds } } });
    }
    if (createdStepIds.length > 0) {
      await prisma.stepDefinition.deleteMany({ where: { id: { in: createdStepIds } } });
    }
    await prisma.$disconnect();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // RÈGLE DURE — aucun encart hors d'une étape et du pied de Logement (§2, §12)
  // ══════════════════════════════════════════════════════════════════════════

  describe('RÈGLE DURE — un encart ne vit que sur une étape ou en pied de Logement', () => {
    /**
     * MUTATION : ajouter `'FEED'` à `PLACEMENT_SECTIONS` → ce test tombe. C'est le
     * seul verrou possible sur une règle tenue par l'absence de code : la liste des
     * emplacements autorisés est FERMÉE, et on la compte.
     */
    it('la liste des emplacements hors étape contient exactement le pied de Logement', () => {
      expect([...PLACEMENT_SECTIONS]).toEqual(['HOUSING']);
    });

    it('on ne peut pas DEMANDER un encart pour le fil, l’entraide, un guide ou une conversation', () => {
      for (const section of ['FEED', 'HELP', 'GUIDE', 'COMMUNITY', 'MESSAGING', 'SEARCH']) {
        expect(placementQuerySchema.safeParse({ section }).success, section).toBe(false);
      }
      // Ni « n'importe où » : la requête sans cible est refusée.
      expect(placementQuerySchema.safeParse({}).success).toBe(false);
      // Ni les deux à la fois : la priorité serait indécidable.
      expect(
        placementQuerySchema.safeParse({ section: 'HOUSING', stepDefinitionId: newId() }).success,
      ).toBe(false);
    });

    it('une étape sans placement ne rend AUCUN encart', async () => {
      const stepId = await stepDefinition('vide');
      const viewer = await newMember();
      expect(await partners.resolve({ stepDefinitionId: stepId }, viewer)).toEqual({
        placement: null,
      });
    });

    it('le pied de Logement résout par l’ancre amorcée', async () => {
      const anchor = await prisma.stepDefinition.findUnique({
        where: { code: HOUSING_SECTION_STEP_CODE },
        select: { id: true },
      });
      // PRÉMISSE : l'ancre du §5.1 est bien amorcée (pnpm db:seed).
      expect(anchor).not.toBeNull();

      const partnerId = await partner();
      const created = await partners.createPlacement(staffId, {
        partnerId,
        section: 'HOUSING',
        headline: 'Garantie locative sans garant',
        ctaLabel: 'Voir l’offre',
        isActive: true,
      });

      const viewer = await newMember();
      const resolved = await partners.resolve({ section: 'HOUSING' }, viewer);
      expect(resolved.placement?.id).toBe(created.id);
      expect(resolved.placement?.badge).toBe(PARTNER_BADGE_LABEL);
      expect(resolved.placement?.transparency.url).toContain('transparence');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // RÈGLE DURE — aucune donnée personnelle dans un lien d'affiliation (§5.3)
  // ══════════════════════════════════════════════════════════════════════════

  describe('RÈGLE DURE — le lien d’affiliation ne porte que click_id (§5.3)', () => {
    /**
     * MUTATION : retirer le `refine` « aucun autre jeton que {click_id} » de
     * `affiliateUrlTemplateSchema` → ce test tombe, et un gabarit portant
     * `{user_id}` entre en base pour de bon.
     */
    it('un gabarit portant un autre paramètre que {click_id} est REFUSÉ', () => {
      const bad = [
        `https://p.example/o?c=${CLICK_ID_TOKEN}&u={user_id}`,
        `https://p.example/o?c=${CLICK_ID_TOKEN}&h={handle}`,
        'https://p.example/o?u={user_id}',
        `http://p.example/o?c=${CLICK_ID_TOKEN}`,
        'https://p.example/o',
      ];
      for (const template of bad) {
        expect(affiliateUrlTemplateSchema.safeParse(template).success, template).toBe(false);
      }
      expect(
        affiliateUrlTemplateSchema.safeParse(`https://p.example/o?c=${CLICK_ID_TOKEN}`).success,
      ).toBe(true);
    });

    /**
     * MUTATION : ajouter `&uid=${userId}` à l'URL rendue par
     * `PartnersService.click` → ce test tombe. La vérification vit dans
     * `buildAffiliateUrl`, c'est-à-dire là où l'URL PART — pas seulement là où le
     * gabarit est saisi.
     */
    it('l’URL rendue ne contient ni identifiant, ni handle, ni identifiant d’étape', async () => {
      const partnerId = await partner();
      const stepId = await stepDefinition('clic');
      const placement = await partners.createPlacement(staffId, {
        partnerId,
        stepDefinitionId: stepId,
        headline: 'Offre de recette',
        ctaLabel: 'Découvrir',
        isActive: true,
      });

      const userId = await newMember();
      const me = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { handle: true },
      });

      const result = await partners.click(placement.id, userId, undefined);
      expect(result.url).toContain(result.clickId);
      expect(result.url).not.toContain(userId);
      expect(result.url).not.toContain(me.handle);
      expect(result.url).not.toMatch(/\{[^}]*\}/);

      // Le membre EST identifiable en base — c'est la seconde moitié de la règle.
      const click = await prisma.affiliateClick.findUniqueOrThrow({
        where: { id: result.clickId },
        select: { userId: true, placementId: true, clickedAt: true },
      });
      expect(click.userId).toBe(userId);
      expect(click.placementId).toBe(placement.id);
    });

    it('buildAffiliateUrl LÈVE si une valeur interdite se retrouve dans l’URL', () => {
      // Le gabarit est valide, mais le partenaire a codé l'identifiant dans son
      // chemin : la seconde vérification est la seule qui l'attrape.
      expect(() =>
        buildAffiliateUrl(
          `https://p.example/u/abc-123/o?c=${CLICK_ID_TOKEN}`,
          'clic-1',
          ['abc-123'],
        ),
      ).toThrow(/donnée personnelle/i);
    });

    it('une étape qui n’appartient pas au membre n’est pas enregistrée sur le clic', async () => {
      const partnerId = await partner();
      const stepId = await stepDefinition('clic-etape');
      const placement = await partners.createPlacement(staffId, {
        partnerId,
        stepDefinitionId: stepId,
        headline: 'Offre de recette',
        ctaLabel: 'Découvrir',
        isActive: true,
      });

      const userId = await newMember();
      // Un identifiant d'étape inventé : il ne doit pas être écrit.
      const result = await partners.click(placement.id, userId, newId());
      const click = await prisma.affiliateClick.findUniqueOrThrow({
        where: { id: result.clickId },
        select: { journeyStepId: true },
      });
      expect(click.journeyStepId).toBeNull();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // RÈGLE DURE — un seul encart actif par étape et par pays (§5.1, §12)
  // ══════════════════════════════════════════════════════════════════════════

  describe('RÈGLE DURE — un seul placement actif par étape et par combinaison de pays', () => {
    /**
     * L'index unique du schéma NE PROTÈGE PAS ce cas : PostgreSQL traite `NULL`
     * comme distinct de lui-même, donc deux placements génériques sur la même étape
     * passent en base. C'est le contrôle du service qui tient la règle.
     *
     * MUTATION : retirer le bloc `if (clash !== null) this.fail('PLACEMENT_EXISTS')`
     * de `createPlacement` → ce test tombe, et DEUX encarts se disputent l'étape.
     */
    it('un second placement générique sur la même étape est refusé', async () => {
      const stepId = await stepDefinition('unicite');
      const first = await partner();
      const second = await partner();

      await partners.createPlacement(staffId, {
        partnerId: first,
        stepDefinitionId: stepId,
        headline: 'Premier encart',
        ctaLabel: 'Voir',
        isActive: true,
      });

      await expect(
        partners.createPlacement(staffId, {
          partnerId: second,
          stepDefinitionId: stepId,
          headline: 'Second encart',
          ctaLabel: 'Voir',
          isActive: true,
        }),
      ).rejects.toMatchObject({ code: 'PLACEMENT_EXISTS' });

      expect(
        await prisma.partnerPlacement.count({ where: { stepDefinitionId: stepId, isActive: true } }),
      ).toBe(1);
    });

    it('la base seule ne suffirait pas : deux lignes génériques y entrent sans broncher', async () => {
      const stepId = await stepDefinition('nulls-distinct');
      const partnerId = await partner();

      // Écriture DIRECTE, en contournant le service : c'est la démonstration que
      // l'index unique `(step, origin, destination)` est en NULLS DISTINCT.
      for (const headline of ['A', 'B']) {
        await prisma.partnerPlacement.create({
          data: {
            id: newId(),
            partnerId,
            stepDefinitionId: stepId,
            headline,
            ctaLabel: 'Voir',
            isActive: true,
          },
        });
      }
      expect(await prisma.partnerPlacement.count({ where: { stepDefinitionId: stepId } })).toBe(2);
    });

    it('deux placements de pays DIFFÉRENTS cohabitent sur la même étape', async () => {
      const stepId = await stepDefinition('pays');
      const a = await partner();
      const b = await partner();

      await partners.createPlacement(staffId, {
        partnerId: a,
        stepDefinitionId: stepId,
        originCountryId: benin,
        destinationCountryId: france,
        headline: 'Bénin → France',
        ctaLabel: 'Voir',
        isActive: true,
      });
      // Générique : ce n'est pas la même combinaison, donc pas un doublon.
      await partners.createPlacement(staffId, {
        partnerId: b,
        stepDefinitionId: stepId,
        headline: 'Générique',
        ctaLabel: 'Voir',
        isActive: true,
      });
      expect(await prisma.partnerPlacement.count({ where: { stepDefinitionId: stepId } })).toBe(2);
    });

    /** Réactiver, c'est créer un encart : la même unicité doit s'appliquer. */
    it('on ne contourne pas l’unicité en créant inactif puis en activant', async () => {
      const stepId = await stepDefinition('reactivation');
      const a = await partner();
      const b = await partner();

      await partners.createPlacement(staffId, {
        partnerId: a,
        stepDefinitionId: stepId,
        headline: 'Actif',
        ctaLabel: 'Voir',
        isActive: true,
      });
      const dormant = await partners.createPlacement(staffId, {
        partnerId: b,
        stepDefinitionId: stepId,
        headline: 'Endormi',
        ctaLabel: 'Voir',
        isActive: false,
      });

      await expect(
        partners.updatePlacement(staffId, dormant.id, { isActive: true }),
      ).rejects.toMatchObject({ code: 'PLACEMENT_EXISTS' });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Résolution : spécificité, période, plan (§5.1, §5.2)
  // ══════════════════════════════════════════════════════════════════════════

  describe('résolution de l’encart', () => {
    /**
     * §5.1 : « placement le plus spécifique (pays d'origine + destination >
     * destination seule > générique) ».
     *
     * Le test monte les TROIS placements et vérifie la préséance, puis retire le
     * plus spécifique et vérifie que le suivant prend la place — deux filtres
     * ENSEMBLE, jamais chacun seul.
     */
    it('choisit le placement le plus spécifique', async () => {
      const stepId = await stepDefinition('specificite');
      const generic = await partner();
      const byDestination = await partner();
      const byBoth = await partner();

      const genericPlacement = await partners.createPlacement(staffId, {
        partnerId: generic,
        stepDefinitionId: stepId,
        headline: 'Générique',
        ctaLabel: 'Voir',
        isActive: true,
      });
      const destinationPlacement = await partners.createPlacement(staffId, {
        partnerId: byDestination,
        stepDefinitionId: stepId,
        destinationCountryId: france,
        headline: 'Vers la France',
        ctaLabel: 'Voir',
        isActive: true,
      });
      const bothPlacement = await partners.createPlacement(staffId, {
        partnerId: byBoth,
        stepDefinitionId: stepId,
        originCountryId: benin,
        destinationCountryId: france,
        headline: 'Bénin → France',
        ctaLabel: 'Voir',
        isActive: true,
      });

      const viewer = await newMember({ originCountryId: benin, cityId: cityLyon });
      expect((await partners.resolve({ stepDefinitionId: stepId }, viewer)).placement?.id).toBe(
        bothPlacement.id,
      );

      await partners.updatePlacement(staffId, bothPlacement.id, { isActive: false });
      expect((await partners.resolve({ stepDefinitionId: stepId }, viewer)).placement?.id).toBe(
        destinationPlacement.id,
      );

      await partners.updatePlacement(staffId, destinationPlacement.id, { isActive: false });
      expect((await partners.resolve({ stepDefinitionId: stepId }, viewer)).placement?.id).toBe(
        genericPlacement.id,
      );
    });

    /**
     * LE PIÈGE DES DEUX FILTRES COMBINÉS. Un placement ciblé « Togo → France » ne
     * doit pas s'afficher à un Béninois en France : chaque filtre pris seul
     * passerait (la destination correspond), c'est leur COMBINAISON qui refuse.
     *
     * MUTATION : remplacer le `&&` du filtre d'éligibilité par `||` → ce test
     * tombe, et un encart ciblé fuit vers le mauvais membre.
     */
    it('un placement ciblé sur un AUTRE pays d’origine ne s’affiche pas', async () => {
      const stepId = await stepDefinition('mauvais-pays');
      const partnerId = await partner();
      await partners.createPlacement(staffId, {
        partnerId,
        stepDefinitionId: stepId,
        originCountryId: togo,
        destinationCountryId: france,
        headline: 'Togo → France',
        ctaLabel: 'Voir',
        isActive: true,
      });

      // Béninois en France : la DESTINATION correspond, l'ORIGINE non.
      const beninois = await newMember({ originCountryId: benin, cityId: cityLyon });
      expect((await partners.resolve({ stepDefinitionId: stepId }, beninois)).placement).toBeNull();

      // Togolais en France : les deux correspondent.
      const togolais = await newMember({ originCountryId: togo, cityId: cityLyon });
      expect((await partners.resolve({ stepDefinitionId: stepId }, togolais)).placement).not.toBeNull();
    });

    /**
     * §5.2 : « Masqué pour les membres PREMIUM (`limits.hide_partners = true`) ».
     *
     * MUTATION : retirer le bloc `if (limits.hidePartners) return { placement: null }`
     * de `resolve` → ce test tombe. La décision vient des LIMITES DU PLAN et non
     * d'un `plan === 'PREMIUM'` écrit à la main : la seconde moitié du test le
     * prouve en basculant le drapeau en base.
     */
    it('est masqué pour un membre Premium, selon plans.limits et non selon users.plan', async () => {
      const stepId = await stepDefinition('premium');
      const partnerId = await partner();
      await partners.createPlacement(staffId, {
        partnerId,
        stepDefinitionId: stepId,
        headline: 'Encart visible en gratuit',
        ctaLabel: 'Voir',
        isActive: true,
      });

      const free = await newMember({ plan: 'FREE' });
      const premium = await newMember({ plan: 'PREMIUM' });

      expect((await partners.resolve({ stepDefinitionId: stepId }, free)).placement).not.toBeNull();
      const hidden = await partners.resolve({ stepDefinitionId: stepId }, premium);
      expect(hidden.placement).toBeNull();
      expect(hidden.hiddenByPlan).toBe(true);

      // La décision EST dans `plans.limits` : on la retourne en base, le masquage suit.
      const limits = await plans.limitsOf('PREMIUM');
      await prisma.plan.update({
        where: { code: 'PREMIUM' },
        data: { limits: { ...limits, hidePartners: false } },
      });
      plans.invalidate();
      try {
        expect(
          (await partners.resolve({ stepDefinitionId: stepId }, premium)).placement,
        ).not.toBeNull();
      } finally {
        await prisma.plan.update({ where: { code: 'PREMIUM' }, data: { limits: { ...limits } } });
        plans.invalidate();
      }
    });

    it('un visiteur anonyme voit l’encart générique, jamais un encart ciblé', async () => {
      const stepId = await stepDefinition('anonyme');
      const a = await partner();
      const b = await partner();
      const generic = await partners.createPlacement(staffId, {
        partnerId: a,
        stepDefinitionId: stepId,
        headline: 'Générique',
        ctaLabel: 'Voir',
        isActive: true,
      });
      await partners.createPlacement(staffId, {
        partnerId: b,
        stepDefinitionId: stepId,
        originCountryId: benin,
        destinationCountryId: france,
        headline: 'Ciblé',
        ctaLabel: 'Voir',
        isActive: true,
      });

      expect((await partners.resolve({ stepDefinitionId: stepId }, null)).placement?.id).toBe(
        generic.id,
      );
    });

    it('un encart hors période ou d’un partenaire désactivé ne sort pas', async () => {
      const stepId = await stepDefinition('periode');
      const partnerId = await partner();
      const placement = await partners.createPlacement(staffId, {
        partnerId,
        stepDefinitionId: stepId,
        headline: 'Campagne passée',
        ctaLabel: 'Voir',
        startsAt: new Date(Date.now() - 20 * 86_400_000).toISOString(),
        endsAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
        isActive: true,
      });
      const viewer = await newMember();
      expect((await partners.resolve({ stepDefinitionId: stepId }, viewer)).placement).toBeNull();

      // Dans la période, mais partenaire désactivé : toujours rien.
      await partners.updatePlacement(staffId, placement.id, {
        startsAt: null,
        endsAt: null,
      });
      expect((await partners.resolve({ stepDefinitionId: stepId }, viewer)).placement).not.toBeNull();

      await partners.updatePartner(staffId, partnerId, { isActive: false });
      expect((await partners.resolve({ stepDefinitionId: stepId }, viewer)).placement).toBeNull();
      // Et le clic sur un encart de partenaire désactivé est un 404, jamais un 403.
      await expect(partners.click(placement.id, viewer, undefined)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Audit des actions d'équipe (règle dure 00 §7.4)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * « Toute action admin écrit une ligne dans `audit_logs` » (00 §7.4).
   *
   * Ce test est ce qui autorise `admin.int.test.ts` à exempter les cinq routes
   * d'équipe de ce module de sa propre vérification de couverture : la trace est
   * éprouvée ici, à côté de la logique qu'elle trace.
   */
  it('les cinq écritures d’équipe laissent chacune leur trace', async () => {
    const partnerId = await partner();
    await partners.updatePartner(staffId, partnerId, { name: 'Renommé pour la recette' });

    const stepId = await stepDefinition('audit');
    const placement = await partners.createPlacement(staffId, {
      partnerId,
      stepDefinitionId: stepId,
      headline: 'Encart tracé',
      ctaLabel: 'Voir',
      isActive: true,
    });
    await partners.updatePlacement(staffId, placement.id, { headline: 'Encart retouché' });

    const userId = await newMember();
    const click = await partners.click(placement.id, userId, undefined);
    await partners.importConversions(staffId, {
      rows: [{ clickId: click.clickId, conversionRef: 'CMD-AUDIT', payoutCents: 900 }],
    });

    const expected: { action: string; targetId?: string }[] = [
      { action: 'partner.created', targetId: partnerId },
      { action: 'partner.updated', targetId: partnerId },
      { action: 'placement.created', targetId: placement.id },
      { action: 'placement.updated', targetId: placement.id },
      { action: 'affiliate.import' },
    ];

    for (const { action, targetId } of expected) {
      const trace = await prisma.auditLog.findFirst({
        where: {
          action,
          ...(targetId === undefined ? {} : { targetId }),
          actorId: staffId,
        },
        orderBy: { createdAt: 'desc' },
        select: { actorType: true, targetType: true },
      });
      expect(trace, `aucune trace pour ${action}`).not.toBeNull();
      expect(trace?.actorType).toBe('STAFF');
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Conversions (§5.3)
  // ══════════════════════════════════════════════════════════════════════════

  describe('conversions', () => {
    it('l’import est idempotent : deux passages ne comptent pas deux fois', async () => {
      const stepId = await stepDefinition('conversion');
      const partnerId = await partner();
      const placement = await partners.createPlacement(staffId, {
        partnerId,
        stepDefinitionId: stepId,
        headline: 'Offre convertie',
        ctaLabel: 'Voir',
        isActive: true,
      });
      const userId = await newMember();
      const click = await partners.click(placement.id, userId, undefined);

      const rows = [{ clickId: click.clickId, conversionRef: 'CMD-1', payoutCents: 1_500 }];
      const first = await partners.importConversions(staffId, { rows });
      expect(first).toMatchObject({ converted: 1, alreadyKnown: 0, unknown: 0 });

      const second = await partners.importConversions(staffId, { rows });
      expect(second).toMatchObject({ converted: 0, alreadyKnown: 1 });

      const stored = await prisma.affiliateClick.findUniqueOrThrow({
        where: { id: click.clickId },
        select: { payoutCents: true, conversionRef: true, convertedAt: true },
      });
      // Le montant n'a pas doublé : c'est tout l'objet de l'idempotence.
      expect(stored.payoutCents).toBe(1_500);
      expect(stored.conversionRef).toBe('CMD-1');
      expect(stored.convertedAt).not.toBeNull();

      const dashboard = await partners.affiliateDashboard();
      const row = dashboard.items.find((i) => i.placementId === placement.id);
      expect(row).toMatchObject({ clicks: 1, conversions: 1, payoutCents: 1_500 });
      expect(row?.conversionRate).toBe(1);
    });

    it('un click_id inconnu est compté à part, sans faire échouer l’import', async () => {
      const result = await partners.importConversions(staffId, {
        rows: [{ clickId: newId(), conversionRef: 'CMD-X', payoutCents: 100 }],
      });
      expect(result).toMatchObject({ converted: 0, unknown: 1 });
    });
  });
});
