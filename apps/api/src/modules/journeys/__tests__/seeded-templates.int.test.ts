import { BLOCKER_TEMPLATES } from '@app/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../../../common/audit.service';
import { CryptoService } from '../../../common/crypto.service';
import { OutboxService } from '../../../common/outbox.service';
import { PrismaService } from '../../../common/prisma.service';
import { TokenService } from '../../../common/token.service';
import { VisibilityService } from '../../../common/visibility.service';
import {
  FakeCaptchaProvider,
  FakeEmailProvider,
  FakePushProvider,
  FakeSmsProvider,
} from '../../../providers/providers';
import { AuthService } from '../../auth/auth.service';
import { ConnectionsService } from '../../connections/connections.service';
import { ConsentsService } from '../../consents/consents.service';
import { FeedService } from '../../feed/feed.service';
import { HelpService } from '../../help/help.service';
import { HousingService } from '../../housing/housing.service';
import { JobsService } from '../../jobs/jobs.service';
import { MentorshipService } from '../../mentorship/mentorship.service';
import { MessagingService } from '../../messaging/messaging.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { JourneysService, type JourneyActor } from '../journeys.service';
import { numeroDEpreuve } from '../../../common/__tests__/numeros';

/**
 * Les modèles AMORCÉS (T3 partie A), vus depuis le service.
 *
 * `journeys.int.test.ts` construit ses propres fixtures — et doit continuer : il
 * teste les RÈGLES, et des règles éprouvées sur trois étapes jetables se lisent
 * mieux que sur quinze. Ce fichier-ci teste autre chose : que les DONNÉES de
 * départ, telles que le seed les écrit, produisent un parcours conforme à T3 A.2.
 * Les deux sont complémentaires, aucun ne remplace l'autre.
 *
 * Chaque test porte sa MUTATION : la propriété a été cassée dans le seed, le test
 * est tombé, la propriété a été rétablie.
 */

/** L'élément à cet index, ou l'échec immédiat du test avec un message utile. */
function at<T>(rows: readonly T[], index: number, what = 'étape'): T {
  const row = rows[index];
  if (row === undefined) throw new Error(`${what} ${index} absente`);
  return row;
}

/** La date d'échéance attendue : date d'arrivée cible − `days_before_arrival`. */
function minusDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

const ISO_DATE = (value: Date | null): string | null =>
  value === null ? null : value.toISOString().slice(0, 10);

/**
 * STUDIES, recopié de T3 A.2 : code d'étape et `days_before_arrival`.
 *
 * Cette table est ÉCRITE ICI, à la main, et non lue depuis
 * `template_steps.days_before_arrival`. La première version de ce test lisait la
 * colonne pour calculer l'échéance attendue : la comparaison était alors
 * tautologique, et la mutation qui a changé 240 en 200 dans le seed est passée
 * sans faire tomber le test. Un test qui tire son attendu de la donnée qu'il
 * vérifie ne vérifie rien.
 */
const STUDIES_A2: readonly (readonly [string, number])[] = [
  ['CHOOSE_PROGRAM', 240],
  ['CAMPUS_FRANCE_FILE', 200],
  ['CAMPUS_FRANCE_INTERVIEW', 170],
  ['ADMISSION', 120],
  ['PROOF_OF_FUNDS', 100],
  ['VISA', 60],
  ['HEALTH_INSURANCE', 50],
  ['HOUSING_BEFORE', 30],
  ['FLIGHT', 21],
  ['ARRIVAL', 0],
  ['OFII_VALIDATION', -30],
  ['BANK_ACCOUNT', -21],
  ['SOCIAL_SECURITY', -60],
  ['CAF', -45],
  ['RESIDENCE_PERMIT', -270],
];

describe('modèles amorcés (T3 partie A) vus du service', () => {
  let prisma: PrismaService;
  let journeys: JourneysService;
  let auth: AuthService;
  const sms = new FakeSmsProvider();

  const createdUserIds: string[] = [];
  let lyonId: string;
  let studiesTemplateId: string;
  let togoCountryId: string | null = null;

  let counter = 0;
  const nextPhone = (): string => numeroDEpreuve(counter++);

  /** Un membre L1, à Lyon, originaire du Bénin (le seul pays d'origine actif). */
  async function newMember(): Promise<JourneyActor> {
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
      data: { verificationLevel: 'L1', cityId: lyonId },
    });
    return { userId: session.userId, level: 'L1' };
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    const crypto = new CryptoService();
    const outbox = new OutboxService(prisma);
    const audit = new AuditService(prisma);
    const visibility = new VisibilityService(prisma);
    const consents = new ConsentsService(prisma);
    const connections = new ConnectionsService(prisma, outbox, audit, visibility);
    const messaging = new MessagingService(prisma, crypto, outbox, audit, visibility, connections);
    journeys = new JourneysService(
      prisma,
      outbox,
      audit,
      visibility,
      crypto,
      consents,
      new HelpService(prisma, outbox, audit, visibility),
      new FeedService(prisma, outbox, audit, visibility),
      messaging,
      new NotificationsService(prisma, new FakeEmailProvider(), new FakePushProvider()),
      new HousingService(prisma, outbox, audit, visibility),
      new JobsService(prisma, outbox, audit, visibility),
      new MentorshipService(prisma, outbox, audit, visibility, messaging),
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

    lyonId = (
      await prisma.city.findUniqueOrThrow({ where: { slug: 'lyon' }, select: { id: true } })
    ).id;
    studiesTemplateId = (
      await prisma.journeyTemplate.findUniqueOrThrow({
        where: { code: 'STUDIES' },
        select: { id: true },
      })
    ).id;
    togoCountryId =
      (await prisma.country.findUnique({ where: { iso2: 'TG' }, select: { id: true } }))?.id ??
      null;
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      // Parcours, étapes, checklist, activités partent en cascade avec les membres.
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      await prisma.conversation.deleteMany({ where: { journeyId: null, kind: 'JOURNEY' } });
    }
    await prisma.$disconnect();
  });

  /**
   * MUTATION : dans `packages/db/src/seed/journeys.ts`, changer le
   * `daysBeforeArrival` de `CHOOSE_PROGRAM` (240 → 200) puis recharger le seed.
   * Le test tombe sur l'échéance de l'étape 1. Intervertir deux étapes le fait
   * tomber sur l'ordre.
   */
  it('un parcours STUDIES amorcé pose les 15 étapes, dans l’ordre, avec leur rétro-planning', async () => {
    const member = await newMember();
    const arrival = '2027-09-01';
    const created = await journeys.create(member, {
      templateId: studiesTemplateId,
      targetArrivalDate: arrival,
    });

    // PRÉMISSE : le titre proposé est le nom du TYPE (§3.1), donc le modèle amorcé
    // est bien celui qui a servi.
    expect(created.journey.template.nameFr).toBe('Étudier en France');
    expect(created.steps).toHaveLength(15);

    const steps = await prisma.journeyStep.findMany({
      where: { journeyId: created.journey.id },
      orderBy: { position: 'asc' },
      select: {
        position: true,
        title: true,
        dueDate: true,
        dueDateManual: true,
        isCustom: true,
        stepDefinition: { select: { code: true } },
        // `daysBeforeArrival` n'est DÉLIBÉRÉMENT pas relu : l'attendu vient de
        // `STUDIES_A2`, sans quoi le test se comparerait à lui-même.
        templateStep: { select: { isOptional: true } },
      },
    });

    expect(steps.map((s) => s.stepDefinition?.code)).toEqual(STUDIES_A2.map(([code]) => code));

    // Le rétro-planning, étape par étape : `due_date = arrivée − days_before`, où
    // `days_before` vient de T3 A.2 et NON de la base.
    expect(steps.map((s) => [s.stepDefinition?.code, ISO_DATE(s.dueDate)])).toEqual(
      STUDIES_A2.map(([code, offset]) => [code, minusDays(arrival, offset)]),
    );
    for (const step of steps) {
      // Une échéance calculée n'est jamais MANUELLE : sinon un changement de date
      // cible ne la recalculerait plus (§2.3).
      expect(step.dueDateManual).toBe(false);
      expect(step.isCustom).toBe(false);
    }
    // L'étape 10 (ARRIVAL, 0 jour) tombe SUR la date d'arrivée, et celles d'après
    // (décalages négatifs) APRÈS elle.
    expect(ISO_DATE(at(steps, 9).dueDate)).toBe(arrival);
    expect(ISO_DATE(at(steps, 14).dueDate)).toBe('2028-05-28');

    // Seule l'étape 14 (CAF) est optionnelle : la progression se compte sur 14.
    expect(steps.filter((s) => s.templateStep?.isOptional === true).map((s) => s.position)).toEqual(
      [14],
    );
  });

  /**
   * MUTATION : vider `documentChecklist` de `CAMPUS_FRANCE_FILE` dans le seed et
   * recharger. Le test tombe. Réordonner les libellés le fait tomber aussi.
   */
  it('la checklist de documents est copiée depuis la définition, dans l’ordre', async () => {
    const member = await newMember();
    const created = await journeys.create(member, { templateId: studiesTemplateId });

    const step = await prisma.journeyStep.findFirstOrThrow({
      where: { journeyId: created.journey.id, stepDefinition: { code: 'CAMPUS_FRANCE_FILE' } },
      select: {
        id: true,
        checklistItems: {
          orderBy: { position: 'asc' },
          select: { label: true, position: true, isChecked: true },
        },
      },
    });

    expect(step.checklistItems.map((i) => i.label)).toEqual([
      'Passeport valide',
      'Relevés de notes',
      'Diplômes',
      'Lettre de motivation',
      'CV',
      'Photo d’identité',
    ]);
    expect(step.checklistItems.map((i) => i.position)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(step.checklistItems.every((i) => !i.isChecked)).toBe(true);
  });

  /**
   * La résolution de version (03 §2.1), sur les DEUX filtres à la fois : le statut
   * PUBLISHED **et** le pays d'origine. Tester chacun seul laisserait passer le
   * défaut : une version générique préférée à la déclinaison du membre passe le
   * test « la version est publiée », et une déclinaison d'un autre pays passe le
   * test « la version est celle du pays ».
   *
   * MUTATION : vider `variants` de STUDIES dans le seed et recharger — le membre
   * béninois retombe sur la générique, et l'assertion sur la surcharge tombe.
   */
  it('résout la déclinaison BJ pour un membre béninois, la générique pour les autres', async () => {
    const beninois = await newMember();
    const created = await journeys.create(beninois, { templateId: studiesTemplateId });

    const journey = await prisma.journey.findUniqueOrThrow({
      where: { id: created.journey.id },
      select: {
        templateVersion: { select: { originCountry: { select: { iso2: true } } } },
      },
    });
    expect(journey.templateVersion.originCountry?.iso2).toBe('BJ');

    // La surcharge de description (T3 A.3) est bien celle qui a été copiée.
    const visa = await prisma.journeyStep.findFirstOrThrow({
      where: { journeyId: created.journey.id, stepDefinition: { code: 'VISA' } },
      select: { description: true },
    });
    expect(visa.description).toMatch(/Cotonou/);
    // Et elle ne porte NI montant NI délai : T3 A.3 renvoie aux guides.
    expect(visa.description ?? '').not.toMatch(/€|\d+\s*jours/);

    // Un membre d'un pays SANS déclinaison retombe sur la générique — et n'a donc
    // aucune description sur VISA, puisque T3 n'en donne aucune de générique.
    if (togoCountryId !== null) {
      const autre = await newMember();
      await prisma.user.update({
        where: { id: autre.userId },
        data: { originCountryId: togoCountryId },
      });
      const second = await journeys.create(autre, { templateId: studiesTemplateId });
      const generic = await prisma.journey.findUniqueOrThrow({
        where: { id: second.journey.id },
        select: { templateVersion: { select: { originCountryId: true } } },
      });
      expect(generic.templateVersion.originCountryId).toBeNull();

      const genericVisa = await prisma.journeyStep.findFirstOrThrow({
        where: { journeyId: second.journey.id, stepDefinition: { code: 'VISA' } },
        select: { description: true },
      });
      expect(genericVisa.description).toBeNull();
    }
  });

  /**
   * `GET /journey-templates` — la liste qui renvoyait `[]`.
   *
   * MUTATION : mettre `isActive: false` au `create` des types dans le seed, sur
   * une base vide — les quatre types disparaissent de la liste et le test tombe.
   */
  it('expose les quatre types amorcés avec le bon nombre d’étapes', async () => {
    const member = await newMember();
    const list = await journeys.templates(member.userId);

    const seeded = new Map(
      list.items
        .filter((item) => ['STUDIES', 'WORK', 'FAMILY', 'SETTLEMENT'].includes(item.code))
        .map((item) => [item.code, item]),
    );
    expect([...seeded.keys()].sort()).toEqual(['FAMILY', 'SETTLEMENT', 'STUDIES', 'WORK']);
    expect(seeded.get('STUDIES')?.version.stepCount).toBe(15);
    expect(seeded.get('WORK')?.version.stepCount).toBe(11);
    expect(seeded.get('FAMILY')?.version.stepCount).toBe(9);
    expect(seeded.get('SETTLEMENT')?.version.stepCount).toBe(7);

    // La déclinaison du membre béninois est celle qui sort pour STUDIES et WORK.
    expect(seeded.get('STUDIES')?.version.isCountrySpecific).toBe(true);
    expect(seeded.get('WORK')?.version.isCountrySpecific).toBe(true);
    expect(seeded.get('FAMILY')?.version.isCountrySpecific).toBe(false);

    // Les quatre types sortent dans l'ordre de `sort_order` (T5 O03 : quatre
    // cartes, Étudier d'abord).
    const codes = list.items.map((i) => i.code).filter((c) => seeded.has(c));
    expect(codes).toEqual(['STUDIES', 'WORK', 'FAMILY', 'SETTLEMENT']);
  });

  /**
   * Le seed laisse `step_definitions.blocker_template` NUL : T3 A.1 donne quatre
   * gabarits par CIBLE, pas trente par étape, et le service retombe sur
   * `BLOCKER_TEMPLATES` de `@app/shared`. Ce test vérifie que ce choix ne laisse
   * pas un brouillon vide au membre.
   *
   * MUTATION : dans `journeys.service.ts`, remplacer
   * `step.stepDefinition?.blockerTemplate ?? BLOCKER_TEMPLATES[target]` par
   * `step.stepDefinition?.blockerTemplate ?? ''`. Le brouillon devient vide et le
   * test tombe — c'est exactement ce qui arriverait si le repli disparaissait.
   */
  it('« Je suis bloqué » reste pré-rempli sur une étape amorcée sans gabarit propre', async () => {
    const member = await newMember();
    const created = await journeys.create(member, { templateId: studiesTemplateId });

    const housing = await prisma.journeyStep.findFirstOrThrow({
      where: { journeyId: created.journey.id, stepDefinition: { code: 'HOUSING_BEFORE' } },
      select: { id: true, stepDefinition: { select: { blockerTemplate: true } } },
    });
    // PRÉMISSE : la colonne est bien nulle en base — sans quoi le test ne prouve
    // rien sur le repli.
    expect(housing.stepDefinition?.blockerTemplate).toBeNull();

    const draft = await journeys.createBlockerDraft(member.userId, created.journey.id, housing.id);
    expect(draft.blocker.target).toBe('HOUSING');
    expect(draft.blocker.draftText.length).toBeGreaterThan(20);
    expect(draft.blocker.draftText).toContain('Lyon');
    // Le gabarit rendu est bien celui de la cible HOUSING.
    expect(draft.blocker.draftText.startsWith(BLOCKER_TEMPLATES.HOUSING.slice(0, 20))).toBe(true);
    // Aucune variable non substituée ne fuit vers le membre.
    expect(draft.blocker.draftText).not.toMatch(/\{(ville|etape|parcours|echeance)\}/);
  });
});
