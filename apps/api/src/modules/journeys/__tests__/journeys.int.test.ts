import { newId } from '@app/db';
import {
  BLOCKER_TEMPLATES,
  JourneyStepStatus,
  JourneyStatus,
  JOURNEY_MAX_MEMBERS,
} from '@app/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../../../common/audit.service';
import { CryptoService } from '../../../common/crypto.service';
import { OutboxService } from '../../../common/outbox.service';
import { PrismaService } from '../../../common/prisma.service';
import { TokenService } from '../../../common/token.service';
import { VisibilityService } from '../../../common/visibility.service';
import { FakeCaptchaProvider, FakeSmsProvider } from '../../../providers/providers';
import { AuthService } from '../../auth/auth.service';
import { ConnectionsService } from '../../connections/connections.service';
import { ConsentsService } from '../../consents/consents.service';
import { FeedService } from '../../feed/feed.service';
import { HelpService } from '../../help/help.service';
import { MessagingService } from '../../messaging/messaging.service';
import { JourneysService, type JourneyActor } from '../journeys.service';

/**
 * Parcours — 03-parcours.md §10.
 *
 * Les neuf règles dures du §10 ont chacune leur test, et chacun a été ÉPROUVÉ PAR
 * MUTATION : la règle a été cassée dans le service, le test est tombé, la règle a
 * été rétablie. Les mutations sont notées en tête de chaque test — sans quoi
 * « le test passe » ne prouve rien d'autre que l'absence d'erreur de syntaxe.
 *
 * Chaque test vérifie d'abord sa PRÉMISSE : l'état du parcours, le rôle du
 * lecteur, la présence du blocage. Un test appuyé sur une base qui n'est pas dans
 * l'état supposé passerait aussi avec le défaut.
 *
 * Les modèles de parcours ne sont PAS amorcés en base (T3 partie A n'est pas
 * chargée) : ce fichier construit ses propres fixtures et les retire.
 */
/**
 * L'élément à cet index, ou l'échec immédiat du test.
 *
 * Un `as [{ id: string }, …]` mentirait à TypeScript et, surtout, produirait
 * `undefined.id` là où l'on veut un message clair : « étape 2 absente du
 * parcours » dit tout de suite que la fixture, et non la règle, est en cause.
 */
function at<T>(rows: readonly T[], index: number, what = 'étape'): T {
  const row = rows[index];
  if (row === undefined) throw new Error(`${what} ${index} absente`);
  return row;
}

describe('parcours (03 §2, §3, §5, §10)', () => {
  let prisma: PrismaService;
  let journeys: JourneysService;
  let help: HelpService;
  let feed: FeedService;
  let auth: AuthService;
  const sms = new FakeSmsProvider();

  const createdUserIds: string[] = [];
  const createdTemplateIds: string[] = [];
  const createdDefinitionIds: string[] = [];

  let cityA: { id: string; name: string };
  let cityFar: { id: string; name: string };
  let originCountryId: string;

  /** Le modèle générique : trois étapes, la deuxième optionnelle, la troisième jalon. */
  const model: {
    templateId: string;
    templateCode: string;
    templateName: string;
    versionId: string;
    stepIds: string[];
    definitionIds: { first: string; optional: string; milestone: string };
  } = {
    templateId: '',
    templateCode: '',
    templateName: '',
    versionId: '',
    stepIds: [],
    definitionIds: { first: '', optional: '', milestone: '' },
  };

  let counter = 0;
  const nextPhone = (): string =>
    `07${String(Date.now()).slice(-6)}${String(counter++).padStart(2, '0')}`;

  async function newMember(
    level: 'L0' | 'L1' | 'L2' = 'L1',
    cityId?: string,
  ): Promise<JourneyActor & { handle: string }> {
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
    const user = await prisma.user.update({
      where: { id: session.userId },
      data: { verificationLevel: level, cityId: cityId ?? cityA.id },
      select: { handle: true },
    });
    return { userId: session.userId, level, handle: user.handle };
  }

  /** Une définition d'étape jetable, sur le modèle de T3 A.1. */
  async function definition(over: {
    code: string;
    nameFr: string;
    blockerTarget?: 'HELP' | 'HOUSING' | 'JOBS' | 'MENTORSHIP' | 'NONE';
    isMajorMilestone?: boolean;
    checklist?: string[];
    blockerTemplate?: string | null;
  }): Promise<string> {
    const created = await prisma.stepDefinition.create({
      data: {
        id: newId(),
        code: `${over.code}-${Date.now()}-${counter++}`,
        nameFr: over.nameFr,
        description: `Description de ${over.nameFr}`,
        category: 'PRE_DEPARTURE',
        defaultDurationDays: 21,
        blockerTarget: over.blockerTarget ?? 'HELP',
        ...(over.blockerTemplate === undefined ? {} : { blockerTemplate: over.blockerTemplate }),
        isMajorMilestone: over.isMajorMilestone ?? false,
        isRisky: false,
        documentChecklist: over.checklist ?? [],
      },
      select: { id: true },
    });
    createdDefinitionIds.push(created.id);
    return created.id;
  }

  /** Un modèle complet, publié. Rendu tel qu'un back-office l'aurait composé. */
  async function template(options: {
    code: string;
    nameFr: string;
    steps: { definitionId: string; isOptional?: boolean; daysBeforeArrival?: number }[];
    originCountryId?: string | null;
  }): Promise<{ templateId: string; versionId: string; stepIds: string[] }> {
    const created = await prisma.journeyTemplate.create({
      data: {
        id: newId(),
        code: `${options.code}-${Date.now()}-${counter++}`,
        nameFr: options.nameFr,
        targetPhase: 'PRE_DEPARTURE',
        isActive: true,
        sortOrder: 900,
      },
      select: { id: true, code: true },
    });
    createdTemplateIds.push(created.id);

    const version = await prisma.journeyTemplateVersion.create({
      data: {
        id: newId(),
        templateId: created.id,
        version: 1,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        ...(options.originCountryId === undefined || options.originCountryId === null
          ? {}
          : { originCountryId: options.originCountryId }),
      },
      select: { id: true },
    });

    const stepIds: string[] = [];
    for (const [index, step] of options.steps.entries()) {
      const templateStep = await prisma.templateStep.create({
        data: {
          id: newId(),
          templateVersionId: version.id,
          stepDefinitionId: step.definitionId,
          position: index + 1,
          isOptional: step.isOptional ?? false,
          ...(step.daysBeforeArrival === undefined
            ? {}
            : { daysBeforeArrival: step.daysBeforeArrival }),
        },
        select: { id: true },
      });
      stepIds.push(templateStep.id);
    }
    return { templateId: created.id, versionId: version.id, stepIds };
  }

  /** Un parcours neuf du modèle générique, pour ce membre. */
  async function journeyFor(actor: JourneyActor, title = 'Ma galère de visa') {
    const created = await journeys.create(actor, { templateId: model.templateId, title });
    return created.journey.id;
  }

  const stepsOf = async (journeyId: string) =>
    prisma.journeyStep.findMany({
      where: { journeyId },
      orderBy: { position: 'asc' },
      select: { id: true, title: true, status: true, position: true, dueDate: true, dueDateManual: true },
    });

  /** Combien de lignes de CONTENU existent, toutes tables confondues (§1.2). */
  async function publishedContentCounts(userId: string) {
    const [posts, stories, helpRequests, housing, jobs, mentorships] = await Promise.all([
      prisma.post.count({ where: { authorUserId: userId } }),
      prisma.story.count({ where: { authorUserId: userId } }),
      prisma.helpRequest.count({ where: { authorUserId: userId } }),
      prisma.housingListing.count({ where: { authorUserId: userId } }),
      prisma.jobListing.count({ where: { authorUserId: userId } }),
      prisma.mentorship.count({ where: { menteeUserId: userId } }),
    ]);
    return { posts, stories, helpRequests, housing, jobs, mentorships };
  }

  const eventsOf = async (type: string, aggregateId: string) =>
    prisma.domainEvent.count({ where: { type, aggregateId } });

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
    help = new HelpService(prisma, outbox, audit, visibility);
    feed = new FeedService(prisma, outbox, audit, visibility);
    journeys = new JourneysService(
      prisma,
      outbox,
      audit,
      visibility,
      crypto,
      consents,
      help,
      feed,
      messaging,
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

    cityA = await prisma.city.findUniqueOrThrow({
      where: { slug: 'lyon' },
      select: { id: true, name: true },
    });
    cityFar = await prisma.city.findUniqueOrThrow({
      where: { slug: 'lille' },
      select: { id: true, name: true },
    });
    originCountryId = (
      await prisma.country.findUniqueOrThrow({ where: { iso2: 'BJ' }, select: { id: true } })
    ).id;

    model.definitionIds.first = await definition({
      code: 'j-first',
      nameFr: 'Constituer le dossier',
      checklist: ['Passeport valide', 'Relevés de notes'],
    });
    model.definitionIds.optional = await definition({
      code: 'j-optional',
      nameFr: 'Demander l’aide au logement',
    });
    model.definitionIds.milestone = await definition({
      code: 'j-milestone',
      nameFr: 'Obtenir le visa',
      isMajorMilestone: true,
    });

    const built = await template({
      code: 'j-studies',
      nameFr: 'Études',
      steps: [
        { definitionId: model.definitionIds.first, daysBeforeArrival: 200 },
        { definitionId: model.definitionIds.optional, isOptional: true, daysBeforeArrival: 45 },
        { definitionId: model.definitionIds.milestone, daysBeforeArrival: 60 },
      ],
    });
    model.templateId = built.templateId;
    model.versionId = built.versionId;
    model.stepIds = built.stepIds;
    model.templateName = 'Études';
    model.templateCode = (
      await prisma.journeyTemplate.findUniqueOrThrow({
        where: { id: built.templateId },
        select: { code: true },
      })
    ).code;
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      // Parcours, étapes, checklist, activités, blocages, demandes d'aide et
      // publications partent en cascade avec les membres.
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      await prisma.conversation.deleteMany({ where: { journeyId: null, kind: 'JOURNEY' } });
    }
    if (createdTemplateIds.length > 0) {
      await prisma.journeyTemplate.deleteMany({ where: { id: { in: createdTemplateIds } } });
    }
    if (createdDefinitionIds.length > 0) {
      await prisma.stepDefinition.deleteMany({ where: { id: { in: createdDefinitionIds } } });
    }
    await prisma.$disconnect();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Création, résolution de version, limite de plan
  // ══════════════════════════════════════════════════════════════════════════

  it('crée un parcours : étapes copiées, checklist copiée, rétro-planning appliqué', async () => {
    const member = await newMember();
    const created = await journeys.create(member, {
      templateId: model.templateId,
      title: 'Mon dossier 2026',
      targetArrivalDate: '2026-09-01',
    });

    expect(created.journey.title).toBe('Mon dossier 2026');
    expect(created.journey.template.nameFr).toBe('Études');
    expect(created.steps).toHaveLength(3);
    // La progression compte les étapes NON OPTIONNELLES : deux ici, pas trois.
    expect(created.journey.totalCount).toBe(2);
    expect(created.journey.progressPct).toBe(0);

    // §2.3 : `due_date` = date d'arrivée − `days_before_arrival`.
    const steps = await stepsOf(created.journey.id);
    expect(steps[0]?.dueDate?.toISOString().slice(0, 10)).toBe('2026-02-13');
    expect(steps[0]?.dueDateManual).toBe(false);

    // §3.3 : la checklist est copiée depuis la définition, cochable, sans fichier.
    const checklist = await prisma.journeyStepChecklistItem.findMany({
      where: { journeyStepId: at(steps, 0).id },
      orderBy: { position: 'asc' },
      select: { label: true, isChecked: true },
    });
    expect(checklist.map((c) => c.label)).toEqual(['Passeport valide', 'Relevés de notes']);
    expect(checklist.every((c) => !c.isChecked)).toBe(true);

    // L'étape en cours de la carte d'accueil : la première qui reste à faire.
    expect(created.journey.currentStepId).toBe(at(steps, 0).id);
    expect(await eventsOf('journey.created', created.journey.id)).toBe(1);
  });

  /**
   * RÈGLE DURE §10 : « la limite d'un parcours actif en gratuit est appliquée
   * côté serveur ».
   *
   * MUTATION : en retirant le `throw ApiError.planLimit(...)` de
   * `assertJourneyQuota`, ce test tombe sur la deuxième création, qui réussit.
   */
  it('[RÈGLE DURE] un seul parcours actif en gratuit, et les parcours terminés ne comptent pas', async () => {
    const member = await newMember();
    // La prémisse : le membre est bien au plan gratuit.
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: member.userId },
      select: { plan: true },
    });
    expect(before.plan).toBe('FREE');

    const first = await journeyFor(member);
    await expect(journeys.create(member, { templateId: model.templateId })).rejects.toMatchObject({
      code: 'PLAN_LIMIT_REACHED',
      details: { limit: 'maxActiveJourneys', max: 1 },
    });

    // Un parcours en PAUSE compte toujours (§3.1).
    await journeys.update(member.userId, first, { status: 'PAUSED' });
    await expect(journeys.create(member, { templateId: model.templateId })).rejects.toMatchObject({
      code: 'PLAN_LIMIT_REACHED',
    });

    // Un parcours ARRÊTÉ ne compte plus.
    await journeys.update(member.userId, first, { status: 'ABANDONED' });
    const second = await journeys.create(member, { templateId: model.templateId });
    expect(second.journey.id).not.toBe(first);
  });

  it('résout la version du pays d’origine, et la générique à défaut', async () => {
    const member = await newMember();
    const localOnly = await definition({ code: 'j-bj', nameFr: 'Espace Campus France Bénin' });
    const built = await template({
      code: 'j-work',
      nameFr: 'Travail',
      steps: [{ definitionId: localOnly }],
      originCountryId,
    });

    const list = await journeys.templates(member.userId);
    const work = list.items.find((item) => item.id === built.templateId);
    expect(work?.version.isCountrySpecific).toBe(true);

    // Un type sans version publiée n'est pas proposé (§2.1).
    const draftOnly = await prisma.journeyTemplate.create({
      data: {
        id: newId(),
        code: `j-draft-${Date.now()}`,
        nameFr: 'Brouillon',
        targetPhase: 'PRE_DEPARTURE',
        isActive: true,
        sortOrder: 901,
      },
      select: { id: true },
    });
    createdTemplateIds.push(draftOnly.id);
    await prisma.journeyTemplateVersion.create({
      data: { id: newId(), templateId: draftOnly.id, version: 1, status: 'DRAFT' },
    });

    const again = await journeys.templates(member.userId);
    expect(again.items.some((item) => item.id === draftOnly.id)).toBe(false);
    await expect(
      journeys.create(member, { templateId: draftOnly.id }),
    ).rejects.toMatchObject({ code: 'TEMPLATE_UNAVAILABLE' });
  });

  /**
   * RÈGLE DURE §2.2 : « Publier une version ne modifie jamais un `journey`
   * existant. »
   *
   * MUTATION : impossible à casser par une ligne, puisque la règle est tenue par
   * l'ABSENCE de code — c'est précisément ce que ce test verrouille. Il tombe le
   * jour où une publication de version viendrait repointer les parcours en cours,
   * et il vérifie aussi le pendant utile : un parcours NEUF prend bien la v2.
   */
  it('[RÈGLE DURE] publier une version ne touche aucun parcours existant', async () => {
    const member = await newMember();

    /**
     * Ce test travaille sur SON PROPRE modèle, et non sur celui partagé par le
     * fichier : archiver la v1 du modèle commun changerait la version que
     * résolvent tous les tests suivants, et l'on ne pourrait pas la remettre —
     * un `journey` créé sur la v2 l'empêche d'être supprimée (`onDelete:
     * Restrict`). C'est exactement le genre d'effet de bord qu'une fixture
     * partagée fait payer trois tests plus loin.
     */
    const stepOne = await definition({ code: 'j-v1a', nameFr: 'Première étape' });
    const stepTwo = await definition({ code: 'j-v1b', nameFr: 'Deuxième étape' });
    const own = await template({
      code: 'j-versioned',
      nameFr: 'Regroupement familial',
      steps: [{ definitionId: stepOne }, { definitionId: stepTwo }],
    });

    const created = await journeys.create(member, { templateId: own.templateId });
    const journeyId = created.journey.id;
    const before = await stepsOf(journeyId);
    expect(before).toHaveLength(2);
    expect(created.journey.templateVersion).toBe(1);

    /**
     * Ce que fera la route d'administration (§5.2, non livrée) : la v1 ARCHIVÉE,
     * puis la v2 publiée — dans cet ordre, parce que la base fait respecter
     * « une seule version publiée par (type, pays) » par un index unique partiel
     * (`journey_template_versions_one_published_generic`). Publier la v2 avant
     * d'archiver la v1 échoue sur cette contrainte : la règle §2.2 n'est donc pas
     * seulement applicative, et la future route de publication devra faire les
     * deux dans la même transaction.
     */
    const extra = await definition({ code: 'j-v2', nameFr: 'Nouvelle étape v2' });
    await expect(
      prisma.journeyTemplateVersion.create({
        data: {
          id: newId(),
          templateId: own.templateId,
          version: 2,
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    await prisma.journeyTemplateVersion.update({
      where: { id: own.versionId },
      data: { status: 'ARCHIVED' },
    });
    const v2 = await prisma.journeyTemplateVersion.create({
      data: {
        id: newId(),
        templateId: own.templateId,
        version: 2,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        changelog: 'La procédure a évolué.',
      },
      select: { id: true },
    });
    for (const [index, definitionId] of [stepOne, stepTwo, extra].entries()) {
      await prisma.templateStep.create({
        data: {
          id: newId(),
          templateVersionId: v2.id,
          stepDefinitionId: definitionId,
          position: index + 1,
          isOptional: false,
        },
      });
    }

    // Le parcours en cours RESTE sur sa version, avec ses étapes intactes.
    const after = await prisma.journey.findUniqueOrThrow({
      where: { id: journeyId },
      select: { templateVersionId: true, progressPct: true },
    });
    expect(after.templateVersionId).toBe(own.versionId);
    expect(await stepsOf(journeyId)).toEqual(before);

    // Un parcours NEUF, lui, prend la version publiée courante.
    const newcomer = await newMember();
    const fresh = await journeys.create(newcomer, { templateId: own.templateId });
    expect(fresh.journey.templateVersion).toBe(2);
    expect(fresh.steps).toHaveLength(3);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Étapes
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * RÈGLE DURE §1.2 et §3.6 : « un parcours ne publie JAMAIS rien tout seul ».
   *
   * MUTATION : en ajoutant dans `updateStep`, sur la branche `DONE`, une création
   * de `posts` (ce que §3.6 pourrait laisser croire), ce test tombe sur
   * `posts: 0`.
   */
  it('[RÈGLE DURE] franchir une étape ne publie RIEN — seulement des propositions', async () => {
    const member = await newMember();
    const journeyId = await journeyFor(member);
    const steps = await stepsOf(journeyId);
    const milestone = at(steps, 2);

    const before = await publishedContentCounts(member.userId);
    // La prémisse : rien n'existe encore, sinon le test ne mesurerait rien.
    expect(before).toEqual({ posts: 0, stories: 0, helpRequests: 0, housing: 0, jobs: 0, mentorships: 0 });

    const started = await journeys.updateStep(member, journeyId, milestone.id, {
      status: 'IN_PROGRESS',
    });
    expect(started.journey.currentStepId).toBe(milestone.id);

    const done = await journeys.updateStep(member, journeyId, milestone.id, { status: 'DONE' });

    // 1. RIEN n'a été publié, dans aucune table de contenu.
    expect(await publishedContentCounts(member.userId)).toEqual(before);

    // 2. Ce qui remonte est une PROPOSITION : de la donnée, pas un contenu.
    expect(done.proposals?.milestone).toMatchObject({ kind: 'VICTORY', stepId: milestone.id });
    // §3.6 : le champ est VIDE — aucun texte pré-rédigé.
    expect(done.proposals?.milestone?.text).toBe('');
    expect(done.proposals?.tip).toMatchObject({ kind: 'STORY_TIP' });
    // §3.7 : le passage en public est proposé À LA PREMIÈRE ÉTAPE FRANCHIE.
    expect(done.proposals?.goPublic).not.toBeNull();

    // 3. L'événement, lui, est bien émis : c'est le fil qui décidera de l'encart.
    expect(await eventsOf('journey.step_completed', milestone.id)).toBe(1);
    expect(await eventsOf('journey.step_started', milestone.id)).toBe(1);

    // 4. La durée réelle est calculée, et la progression recalculée.
    const stored = await prisma.journeyStep.findUniqueOrThrow({
      where: { id: milestone.id },
      select: { durationDays: true, completedAt: true, status: true },
    });
    expect(stored.status).toBe('DONE');
    expect(stored.durationDays).toBe(0);
    expect(stored.completedAt).not.toBeNull();
    const journey = await prisma.journey.findUniqueOrThrow({
      where: { id: journeyId },
      select: { progressPct: true },
    });
    // Une étape non optionnelle sur deux.
    expect(journey.progressPct).toBe(50);
  });

  /**
   * RÈGLE DURE §3.2 : « Aucun état ni libellé d'échec n'existe, ni en base ni à
   * l'écran. »
   *
   * Deux vérifications, parce que la règle a deux versants : l'ÉNUMÉRATION (aucun
   * état d'échec n'existe) et la TRANSITION (ce qui n'est pas prévu est refusé par
   * un code neutre, `INVALID_TRANSITION`, et non par un « échec »).
   *
   * MUTATION : en ajoutant `PAUSED: ['DONE']` à la table des transitions, la
   * deuxième assertion tombe.
   */
  it('[RÈGLE DURE] aucun état d’échec sur une étape, et les transitions non prévues sont refusées', async () => {
    // 1. L'énumération du schéma ne porte aucun état d'échec.
    expect([...JourneyStepStatus]).toEqual(['TODO', 'IN_PROGRESS', 'DONE', 'PAUSED']);
    for (const forbidden of ['FAILED', 'ABANDONED', 'REJECTED', 'ERROR', 'BLOCKED']) {
      expect(JourneyStepStatus as readonly string[]).not.toContain(forbidden);
    }
    // Le parcours, lui, peut être ARRÊTÉ — « arrêté », pas « échoué ».
    expect(JourneyStatus as readonly string[]).not.toContain('FAILED');

    const member = await newMember();
    const journeyId = await journeyFor(member);
    const steps = await stepsOf(journeyId);
    const first = at(steps, 0);

    // 2. « Mise en pause », puis reprise : aucun état intermédiaire d'échec.
    await journeys.updateStep(member, journeyId, first.id, { status: 'IN_PROGRESS' });
    const paused = await journeys.updateStep(member, journeyId, first.id, { status: 'PAUSED' });
    expect(paused.steps.find((s) => s.id === first.id)?.status).toBe('PAUSED');
    expect(paused.steps.find((s) => s.id === first.id)?.pausedAt).not.toBeNull();

    // Une étape en pause se reprend ; elle ne se clôt pas directement.
    await expect(
      journeys.updateStep(member, journeyId, first.id, { status: 'DONE' }),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION', details: { from: 'PAUSED', to: 'DONE' } });

    const resumed = await journeys.updateStep(member, journeyId, first.id, {
      status: 'IN_PROGRESS',
    });
    expect(resumed.steps.find((s) => s.id === first.id)?.pausedAt).toBeNull();
  });

  it('rouvrir une étape franchie décrémente la progression, et la dernière étape achève le parcours', async () => {
    const member = await newMember();
    const journeyId = await journeyFor(member);
    const steps = await stepsOf(journeyId);
    const [first, optional, milestone] = [at(steps, 0), at(steps, 1), at(steps, 2)];

    await journeys.updateStep(member, journeyId, first.id, { status: 'DONE' });
    await journeys.updateStep(member, journeyId, milestone.id, { status: 'DONE' });

    const journeyState = async () =>
      prisma.journey.findUniqueOrThrow({
        where: { id: journeyId },
        select: { progressPct: true, status: true, completedAt: true },
      });
    let journey = await journeyState();
    // Les deux étapes qui comptent sont franchies : le parcours est terminé,
    // l'étape optionnelle ne l'empêche pas.
    expect(journey.progressPct).toBe(100);
    expect(journey.status).toBe('COMPLETED');
    expect(journey.completedAt).not.toBeNull();
    expect(await eventsOf('journey.completed', journeyId)).toBe(1);

    // §3.2 : « `DONE → IN_PROGRESS` autorisé (rouvrir) […] décrémente la
    // progression ».
    await journeys.updateStep(member, journeyId, milestone.id, { status: 'IN_PROGRESS' });
    journey = await journeyState();
    expect(journey.progressPct).toBe(50);
    expect(journey.status).toBe('ACTIVE');

    // L'étape optionnelle franchie ne fait pas dépasser 100 %.
    await journeys.updateStep(member, journeyId, optional.id, { status: 'DONE' });
    await journeys.updateStep(member, journeyId, milestone.id, { status: 'DONE' });
    journey = await journeyState();
    expect(journey.progressPct).toBe(100);
  });

  /**
   * §2.3 : « Une `due_date` saisie à la main par le membre n'est pas écrasée
   * (`due_date_manual`). »
   *
   * MUTATION : en retirant `dueDateManual: false` du `where` de
   * `applyRetroPlanning`, l'échéance saisie est écrasée et ce test tombe.
   */
  it('le rétro-planning n’écrase jamais une échéance saisie à la main', async () => {
    const member = await newMember();
    const created = await journeys.create(member, {
      templateId: model.templateId,
      targetArrivalDate: '2026-09-01',
    });
    const journeyId = created.journey.id;
    const steps = await stepsOf(journeyId);
    const [first, second] = [at(steps, 0), at(steps, 1)];

    await journeys.updateStep(member, journeyId, first.id, { dueDate: '2026-01-05' });
    let stored = await prisma.journeyStep.findUniqueOrThrow({
      where: { id: first.id },
      select: { dueDate: true, dueDateManual: true },
    });
    // La prémisse : l'échéance est bien marquée manuelle.
    expect(stored.dueDateManual).toBe(true);

    // On décale la date d'arrivée : les échéances CALCULÉES bougent, la manuelle non.
    await journeys.update(member.userId, journeyId, { targetArrivalDate: '2026-10-01' });

    stored = await prisma.journeyStep.findUniqueOrThrow({
      where: { id: first.id },
      select: { dueDate: true, dueDateManual: true },
    });
    expect(stored.dueDate?.toISOString().slice(0, 10)).toBe('2026-01-05');

    const recomputed = await prisma.journeyStep.findUniqueOrThrow({
      where: { id: second.id },
      select: { dueDate: true },
    });
    expect(recomputed.dueDate?.toISOString().slice(0, 10)).toBe('2026-08-17');
  });

  it('ajoute, réordonne et retire une étape personnelle', async () => {
    const member = await newMember();
    const journeyId = await journeyFor(member);

    const withCustom = await journeys.addStep(member.userId, journeyId, {
      title: 'Prendre rendez-vous au consulat',
      position: 1,
    });
    expect(withCustom.steps).toHaveLength(4);
    expect(withCustom.steps[0]?.title).toBe('Prendre rendez-vous au consulat');
    expect(withCustom.steps[0]?.isCustom).toBe(true);
    // L'étape personnelle compte dans la progression : rien ne la dit optionnelle.
    expect(withCustom.journey.totalCount).toBe(3);

    const ids = withCustom.steps.map((s) => s.id);
    const reordered = await journeys.reorderSteps(member.userId, journeyId, {
      stepIds: [ids[1] as string, ids[0] as string, ids[2] as string, ids[3] as string],
    });
    expect(reordered.steps.map((s) => s.id)).toEqual([ids[1], ids[0], ids[2], ids[3]]);

    // Une liste incomplète est refusée : elle laisserait des positions en double.
    await expect(
      journeys.reorderSteps(member.userId, journeyId, { stepIds: [ids[0] as string] }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });

    const afterDelete = await journeys.deleteStep(member.userId, journeyId, ids[0] as string);
    expect(afterDelete.steps).toHaveLength(3);
    expect(afterDelete.steps.map((s) => s.position)).toEqual([1, 2, 3]);
  });

  it('remplace la checklist en conservant les coches, et rend le texte imposé', async () => {
    const member = await newMember();
    const journeyId = await journeyFor(member);
    const steps = await stepsOf(journeyId);
    const first = at(steps, 0);

    const checked = await journeys.replaceChecklist(member.userId, journeyId, first.id, {
      items: [
        { label: 'Passeport valide', isChecked: true },
        { label: 'Relevés de notes', isChecked: false },
      ],
    });
    expect(checked.meta.checklistNotice).toContain('Les documents restent chez vous');

    const before = await prisma.journeyStepChecklistItem.findFirstOrThrow({
      where: { journeyStepId: first.id, label: 'Passeport valide' },
      select: { checkedAt: true },
    });
    expect(before.checkedAt).not.toBeNull();

    // On remplace la liste en ajoutant une ligne : la coche existante garde sa date.
    await journeys.replaceChecklist(member.userId, journeyId, first.id, {
      items: [
        { label: 'Passeport valide', isChecked: true },
        { label: 'Photo d’identité', isChecked: false },
      ],
    });
    const after = await prisma.journeyStepChecklistItem.findMany({
      where: { journeyStepId: first.id },
      orderBy: { position: 'asc' },
      select: { label: true, isChecked: true, checkedAt: true },
    });
    expect(after.map((i) => i.label)).toEqual(['Passeport valide', 'Photo d’identité']);
    expect(after[0]?.checkedAt?.getTime()).toBe(before.checkedAt?.getTime());
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Équipe (§3.4)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * RÈGLE DURE §10 : « les notes et la checklist ne sont jamais renvoyées à un
   * observateur. » §3.4 l'étend à l'accompagnant : il gagne la discussion, pas le
   * dossier.
   *
   * MUTATION : en supprimant le `if (role !== 'OWNER') return base;` de
   * `stepView`, ce test tombe sur les notes de l'observateur.
   */
  it('[RÈGLE DURE] ni l’observateur ni l’accompagnant ne voient les notes ou la checklist', async () => {
    const owner = await newMember();
    const observer = await newMember();
    const supporter = await newMember();
    const journeyId = await journeyFor(owner);
    const steps = await stepsOf(journeyId);
    const first = at(steps, 0);

    const secret = 'Mon titre de séjour expire dans trois semaines et je n’ai pas de rendez-vous.';
    await journeys.updateStep(owner, journeyId, first.id, { notes: secret });

    // La prémisse : le propriétaire, lui, retrouve bien sa note déchiffrée.
    const mine = await journeys.detail(owner.userId, journeyId);
    const ownerStep = mine.steps.find((s) => s.id === first.id) as Record<string, unknown>;
    expect(ownerStep['notes']).toBe(secret);
    expect(Array.isArray(ownerStep['checklist'])).toBe(true);

    for (const [role, member] of [
      ['OBSERVER', observer],
      ['SUPPORTER', supporter],
    ] as const) {
      await journeys.addMember(owner.userId, journeyId, { userHandle: member.handle, role });
      await journeys.acceptInvite(member.userId, journeyId);

      const seen = await journeys.detail(member.userId, journeyId);
      expect(seen.viewerRole).toBe(role);
      const step = seen.steps.find((s) => s.id === first.id) as Record<string, unknown>;
      // La progression et l'état, oui. Les notes, la checklist, l'échéance, non.
      expect(step['status']).toBeDefined();
      expect(step['notes']).toBeUndefined();
      expect(step['checklist']).toBeUndefined();
      expect(step['dueDate']).toBeUndefined();
      // Et rien de tout cela n'est caché ailleurs dans la charge.
      expect(JSON.stringify(seen)).not.toContain('titre de séjour expire');
      expect(JSON.stringify(seen)).not.toContain('Passeport valide');
      // §3.4 : l'observateur ne voit pas la discussion ; l'accompagnant, oui.
      if (role === 'OBSERVER') expect(seen.journey.groupConversationId).toBeNull();
    }
  });

  it('l’équipe s’arrête à dix membres, un blocage interdit l’invitation, et accepter est idempotent', async () => {
    const owner = await newMember();
    const journeyId = await journeyFor(owner);

    const invited = [];
    for (let i = 0; i < JOURNEY_MAX_MEMBERS; i += 1) {
      const member = await newMember();
      invited.push(member);
      await journeys.addMember(owner.userId, journeyId, {
        userHandle: member.handle,
        role: 'OBSERVER',
      });
    }
    const eleventh = await newMember();
    await expect(
      journeys.addMember(owner.userId, journeyId, {
        userHandle: eleventh.handle,
        role: 'OBSERVER',
      }),
    ).rejects.toMatchObject({ code: 'MAX_MEMBERS' });

    // Retirer libère une place (§3.4).
    const first = invited[0] as { userId: string; handle: string };
    await journeys.removeMember(owner.userId, journeyId, first.userId);
    expect(await eventsOf('journey.member_removed', journeyId)).toBe(1);
    await journeys.addMember(owner.userId, journeyId, {
      userHandle: eleventh.handle,
      role: 'SUPPORTER',
    });

    // Accepter deux fois n'émet qu'un `journey.member_joined`.
    await journeys.acceptInvite(eleventh.userId, journeyId);
    await journeys.acceptInvite(eleventh.userId, journeyId);
    expect(await eventsOf('journey.member_joined', journeyId)).toBe(1);

    // §5.1 : `BLOCKED_RELATIONSHIP` sur cette route, dans les deux sens.
    const blocked = await newMember();
    await prisma.block.create({
      data: { id: newId(), blockerUserId: blocked.userId, blockedUserId: owner.userId },
    });
    await expect(
      journeys.addMember(owner.userId, journeyId, { userHandle: blocked.handle, role: 'OBSERVER' }),
    ).rejects.toMatchObject({ code: 'BLOCKED_RELATIONSHIP' });
  });

  it('un non-membre n’accède pas au parcours', async () => {
    const owner = await newMember();
    const stranger = await newMember();
    const journeyId = await journeyFor(owner);

    await expect(journeys.detail(stranger.userId, journeyId)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    // Un membre SÉPARÉ ne reçoit pas 403 mais 404 : confirmer l'existence en
    // dirait déjà trop (T4 §3).
    await prisma.block.create({
      data: { id: newId(), blockerUserId: owner.userId, blockedUserId: stranger.userId },
    });
    await expect(journeys.detail(stranger.userId, journeyId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // « Je suis bloqué » (§3.5)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * RÈGLE DURE §3.5 : « L'objet cible n'est créé qu'à l'appel explicite de la
   * route de publication, avec le texte tel que renvoyé par le client. Le
   * brouillon n'est jamais promu sans cet appel. »
   *
   * RÈGLE DURE §3.7 / 06 §2.5 : le titre personnel du parcours ne sort jamais —
   * le gabarit porte le NOM DU TYPE.
   *
   * MUTATIONS (deux, éprouvées séparément) :
   *   · `parcours: journey.templateName` → `journey.title` dans
   *     `createBlockerDraft` : l'assertion sur la fuite du titre tombe ;
   *   · `body: input.text` → `body: blocker.draftText` dans `publishBlocker` :
   *     l'assertion sur le texte publié tombe.
   */
  it('[RÈGLE DURE] le brouillon ne publie rien, le gabarit ne fuit pas le titre, et le texte publié est celui du client', async () => {
    const personalTitle = 'Ma galère de visa très personnelle';
    const member = await newMember();
    const created = await journeys.create(member, {
      templateId: model.templateId,
      title: personalTitle,
      targetArrivalDate: '2026-09-01',
    });
    const journeyId = created.journey.id;
    const steps = await stepsOf(journeyId);
    const first = at(steps, 0);

    const draft = await journeys.createBlockerDraft(member.userId, journeyId, first.id);

    // 1. RIEN n'a été créé ailleurs : le brouillon est seul.
    expect(await publishedContentCounts(member.userId)).toEqual({
      posts: 0,
      stories: 0,
      helpRequests: 0,
      housing: 0,
      jobs: 0,
      mentorships: 0,
    });
    const stored = await prisma.blockerRequest.findUniqueOrThrow({
      where: { id: draft.blocker.id },
      select: { status: true, publishedRefId: true, publishedAt: true },
    });
    expect(stored.status).toBe('DRAFT');
    expect(stored.publishedRefId).toBeNull();
    expect(stored.publishedAt).toBeNull();

    // 2. Le gabarit est rendu avec le NOM DU TYPE, la ville et l'échéance —
    //    jamais le titre personnel.
    expect(draft.blocker.draftText).toContain('Études');
    expect(draft.blocker.draftText).toContain(cityA.name);
    expect(draft.blocker.draftText).toContain(first.title);
    expect(draft.blocker.draftText).not.toContain(personalTitle);
    expect(draft.blocker.draftText).not.toContain('galère');
    // Aucune variable de gabarit ne reste non remplacée.
    expect(draft.blocker.draftText).not.toMatch(/\{(etape|parcours|ville|echeance)\}/);
    expect(draft.blocker.target).toBe('HELP');

    // 3. Un second clic ne crée pas un second brouillon.
    const again = await journeys.createBlockerDraft(member.userId, journeyId, first.id);
    expect(again.blocker.id).toBe(draft.blocker.id);
    expect(await prisma.blockerRequest.count({ where: { journeyStepId: first.id } })).toBe(1);

    // 4. La publication : c'est le texte DU CLIENT qui part, pas le gabarit.
    const myText =
      'Je ne comprends pas quelles pièces sont demandées pour le dossier, quelqu’un a-t-il fait cette démarche à Lyon ?';
    const published = await journeys.publishBlocker(member, draft.blocker.id, {
      text: myText,
      isPrivate: false,
      title: 'Aide pour constituer le dossier',
      helpType: 'PAPERWORK',
    });
    expect(published.blocker.publishedRefType).toBe('help_request');

    const request = await prisma.helpRequest.findUniqueOrThrow({
      where: { id: published.blocker.publishedRefId },
      select: { body: true, title: true, originJourneyStepId: true, cityId: true, dueDate: true },
    });
    expect(request.body).toBe(myText);
    expect(request.body).not.toContain(BLOCKER_TEMPLATES.HELP.slice(0, 20));
    // Le titre personnel ne part pas non plus dans la demande d'aide.
    expect(JSON.stringify(request)).not.toContain(personalTitle);
    expect(request.originJourneyStepId).toBe(first.id);
    // §2.5 du module 06 : l'échéance est héritée de l'étape.
    expect(request.dueDate).not.toBeNull();

    // 5. L'événement et le journal.
    expect(await eventsOf('blocker.published', draft.blocker.id)).toBe(1);
    const activity = await prisma.journeyActivity.findFirstOrThrow({
      where: { journeyId, type: 'BLOCKER_PUBLISHED' },
      select: { refType: true, refId: true, journeyStepId: true },
    });
    expect(activity.refId).toBe(published.blocker.publishedRefId);
    expect(activity.journeyStepId).toBe(first.id);

    // 6. Republier est refusé.
    await expect(
      journeys.publishBlocker(member, draft.blocker.id, {
        text: myText,
        isPrivate: false,
        title: 'Aide pour constituer le dossier',
      }),
    ).rejects.toMatchObject({ code: 'BLOCKER_ALREADY_PUBLISHED' });
    expect(await prisma.helpRequest.count({ where: { authorUserId: member.userId } })).toBe(1);
  });

  it('une demande privée reste privée : rien de public, un message dans la discussion', async () => {
    const owner = await newMember();
    const supporter = await newMember();
    const journeyId = await journeyFor(owner);
    await journeys.addMember(owner.userId, journeyId, {
      userHandle: supporter.handle,
      role: 'SUPPORTER',
    });
    await journeys.acceptInvite(supporter.userId, journeyId);

    const steps = await stepsOf(journeyId);
    const first = at(steps, 0);
    const draft = await journeys.createBlockerDraft(owner.userId, journeyId, first.id);

    const text = 'Je bloque sur le dossier, est-ce que l’un de vous a déjà rempli ce formulaire ?';
    const published = await journeys.publishBlocker(owner, draft.blocker.id, {
      text,
      isPrivate: true,
    });

    expect(published.blocker.publishedRefType).toBe('message');
    // §3.5 : « rien de public ».
    expect(await prisma.helpRequest.count({ where: { authorUserId: owner.userId } })).toBe(0);

    const message = await prisma.message.findUniqueOrThrow({
      where: { id: published.blocker.publishedRefId },
      select: { conversationId: true, senderUserId: true },
    });
    const conversation = await prisma.conversation.findUniqueOrThrow({
      where: { id: message.conversationId },
      select: { kind: true, journeyId: true, members: { select: { userId: true, leftAt: true } } },
    });
    expect(conversation.kind).toBe('JOURNEY');
    expect(conversation.journeyId).toBe(journeyId);
    // L'accompagnant est dans la discussion ; l'observateur n'y serait pas.
    expect(conversation.members.map((m) => m.userId).sort()).toEqual(
      [owner.userId, supporter.userId].sort(),
    );
  });

  it('une cible sans publication publique livrée est refusée franchement, et annuler ferme le brouillon', async () => {
    const member = await newMember();
    const housingDefinition = await definition({
      code: 'j-housing',
      nameFr: 'Trouver un logement',
      blockerTarget: 'HOUSING',
    });
    const noneDefinition = await definition({
      code: 'j-none',
      nameFr: 'Réserver le billet',
      blockerTarget: 'NONE',
    });
    const built = await template({
      code: 'j-arrival',
      nameFr: 'Installation',
      steps: [{ definitionId: housingDefinition }, { definitionId: noneDefinition }],
    });
    const created = await journeys.create(member, { templateId: built.templateId });
    const steps = await stepsOf(created.journey.id);
    const [housingStep, noneStep] = [at(steps, 0), at(steps, 1)];

    const draft = await journeys.createBlockerDraft(
      member.userId,
      created.journey.id,
      housingStep.id,
    );
    expect(draft.blocker.target).toBe('HOUSING');
    expect(draft.blocker.draftText).toContain(BLOCKER_TEMPLATES.HOUSING.slice(0, 20));

    await expect(
      journeys.publishBlocker(member, draft.blocker.id, {
        text: 'Je cherche un studio à Lyon pour septembre, budget 600 euros.',
        isPrivate: false,
        title: 'Recherche de logement à Lyon',
      }),
    ).rejects.toMatchObject({ code: 'BLOCKER_TARGET_UNSUPPORTED' });
    // Le brouillon n'a pas bougé : il reste publiable en privé.
    expect(
      (await prisma.blockerRequest.findUniqueOrThrow({ where: { id: draft.blocker.id } })).status,
    ).toBe('DRAFT');

    // Une étape dont la cible est NONE ne propose pas de blocage (T3 A.1).
    await expect(
      journeys.createBlockerDraft(member.userId, created.journey.id, noneStep.id),
    ).rejects.toMatchObject({ code: 'BLOCKER_NOT_AVAILABLE' });

    await journeys.cancelBlocker(member.userId, draft.blocker.id);
    await expect(
      journeys.publishBlocker(member, draft.blocker.id, {
        text: 'Je cherche un studio à Lyon pour septembre, budget 600 euros.',
        isPrivate: true,
      }),
    ).rejects.toMatchObject({ code: 'BLOCKER_CANCELLED' });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Partage de jalon (§3.6)
  // ══════════════════════════════════════════════════════════════════════════

  it('partager un jalon publie avec MON texte, et seulement un jalon franchi', async () => {
    const member = await newMember('L1');
    const journeyId = await journeyFor(member);
    const steps = await stepsOf(journeyId);
    const [first, milestone] = [at(steps, 0), at(steps, 2)];

    // §3.6 : `STEP_NOT_DONE` avant la clôture.
    await expect(
      journeys.shareMilestone(member, journeyId, milestone.id, { text: 'Visa obtenu !' }),
    ).rejects.toMatchObject({ code: 'STEP_NOT_DONE' });

    await journeys.updateStep(member, journeyId, first.id, { status: 'DONE' });
    // Une étape franchie qui n'est pas un jalon majeur : `NOT_A_MILESTONE`.
    await expect(
      journeys.shareMilestone(member, journeyId, first.id, { text: 'Dossier déposé !' }),
    ).rejects.toMatchObject({ code: 'NOT_A_MILESTONE' });

    await journeys.updateStep(member, journeyId, milestone.id, { status: 'DONE' });
    const myText = 'Visa obtenu après quatre mois. Merci à celles et ceux qui m’ont répondu ici.';
    await journeys.shareMilestone(member, journeyId, milestone.id, { text: myText });

    const post = await prisma.post.findFirstOrThrow({
      where: { authorUserId: member.userId },
      select: { type: true, body: true, journeyId: true, journeyStepId: true },
    });
    expect(post.type).toBe('VICTORY');
    expect(post.body).toBe(myText);
    expect(post.journeyStepId).toBe(milestone.id);
    // Le titre personnel n'entre pas dans la publication.
    expect(post.body).not.toContain('galère');

    const activity = await prisma.journeyActivity.findFirstOrThrow({
      where: { journeyId, type: 'MILESTONE_SHARED' },
      select: { refType: true, refId: true },
    });
    expect(activity.refType).toBe('post');
    expect(activity.refId).not.toBeNull();
  });

  it('décliner le partage est définitif pour cette étape, et idempotent', async () => {
    const member = await newMember();
    const journeyId = await journeyFor(member);
    const steps = await stepsOf(journeyId);
    const milestone = at(steps, 2);

    await journeys.updateStep(member, journeyId, milestone.id, { status: 'DONE' });
    await journeys.dismissShare(member.userId, journeyId, milestone.id);
    const first = await prisma.journeyStep.findUniqueOrThrow({
      where: { id: milestone.id },
      select: { sharePromptDismissedAt: true },
    });
    expect(first.sharePromptDismissedAt).not.toBeNull();

    await journeys.dismissShare(member.userId, journeyId, milestone.id);
    const second = await prisma.journeyStep.findUniqueOrThrow({
      where: { id: milestone.id },
      select: { sharePromptDismissedAt: true },
    });
    // La date du PREMIER refus est conservée.
    expect(second.sharePromptDismissedAt?.getTime()).toBe(first.sharePromptDismissedAt?.getTime());

    // Et la proposition ne revient pas en rouvrant puis refermant l'étape.
    await journeys.updateStep(member, journeyId, milestone.id, { status: 'IN_PROGRESS' });
    const reclosed = await journeys.updateStep(member, journeyId, milestone.id, { status: 'DONE' });
    expect(reclosed.proposals?.milestone).toBeNull();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Parcours publics (§3.7)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * RÈGLE DURE §3.7 : « Un parcours `PAUSED` ou `ABANDONED` n'apparaît jamais
   * comme public, même si `visibility = PUBLIC`. »
   *
   * Le test éprouve la COMBINAISON de deux filtres, et non chacun seul : un
   * parcours en pause ET un parcours d'un membre bloqué doivent disparaître EN
   * MÊME TEMPS, avec deux filtres de requête actifs par-dessus (type et ville).
   * C'est la seule façon d'attraper deux clauses qui s'écrasent.
   *
   * MUTATION : en retirant `{ status: { in: ['ACTIVE', 'COMPLETED'] } }` des
   * conditions de `publicList`, ce test tombe ; en retirant le filtre des
   * membres séparés, il tombe aussi, sur l'autre assertion.
   */
  it('[RÈGLE DURE] un parcours en pause ou arrêté n’est jamais public, et un membre bloqué disparaît', async () => {
    const viewer = await newMember();
    const active = await newMember();
    const paused = await newMember();
    const blocked = await newMember();
    const elsewhere = await newMember('L1', cityFar.id);

    const ids: Record<string, string> = {};
    for (const [name, member] of [
      ['active', active],
      ['paused', paused],
      ['blocked', blocked],
      ['elsewhere', elsewhere],
    ] as const) {
      const journeyId = await journeyFor(member, `Parcours de ${name}`);
      // §3.7 : PUBLIC est un choix du membre, enregistré avec son consentement.
      await journeys.update(member.userId, journeyId, { visibility: 'PUBLIC' });
      ids[name] = journeyId;
    }

    await journeys.update(paused.userId, ids['paused'] as string, { status: 'PAUSED' });
    await prisma.block.create({
      data: { id: newId(), blockerUserId: viewer.userId, blockedUserId: blocked.userId },
    });

    // La prémisse : les quatre parcours sont bien marqués PUBLIC en base.
    const marked = await prisma.journey.count({
      where: { id: { in: Object.values(ids) }, visibility: 'PUBLIC' },
    });
    expect(marked).toBe(4);

    // Deux filtres actifs EN MÊME TEMPS : le type et la ville.
    const list = await journeys.publicList(viewer.userId, {
      templateCode: model.templateCode,
      cityId: cityA.id,
      limit: 50,
    });
    const returned = list.items.map((item) => item.id);

    expect(returned).toContain(ids['active']);
    // Le filtre d'état ET le filtre de blocage tiennent tous les deux.
    expect(returned).not.toContain(ids['paused']);
    expect(returned).not.toContain(ids['blocked']);
    // Le filtre de ville tient aussi : le parcours de Lille n'est pas là.
    expect(returned).not.toContain(ids['elsewhere']);
    // Et le mien non plus : la liste montre les parcours des AUTRES.
    const mine = await journeyFor(viewer, 'Le mien');
    await journeys.update(viewer.userId, mine, { visibility: 'PUBLIC' });
    const again = await journeys.publicList(viewer.userId, { cityId: cityA.id, limit: 50 });
    expect(again.items.map((i) => i.id)).not.toContain(mine);

    // La vue unitaire applique les mêmes règles : 404, pas une vue dégradée.
    await expect(
      journeys.publicDetail(viewer.userId, ids['paused'] as string),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      journeys.publicDetail(viewer.userId, ids['blocked'] as string),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    // Le consentement de visibilité est tracé (§3.7, 01 §2.10).
    const consent = await prisma.consent.findFirst({
      where: { userId: active.userId, type: 'JOURNEY_VISIBILITY' },
      orderBy: { createdAt: 'desc' },
      select: { granted: true },
    });
    expect(consent?.granted).toBe(true);
  });

  /**
   * RÈGLE DURE §3.7 : « Jamais : titre personnel, notes, checklist, équipe,
   * discussion, motifs de pause, demandes privées, dates cibles. »
   *
   * MUTATION : en ajoutant `title: row.title` à `publicView`, ce test tombe.
   */
  it('[RÈGLE DURE] la vue publique ne contient ni titre personnel, ni notes, ni checklist, ni équipe', async () => {
    const viewer = await newMember();
    const owner = await newMember();
    const personalTitle = 'Mon parcours à moi, très intime';

    const created = await journeys.create(owner, {
      templateId: model.templateId,
      title: personalTitle,
      targetArrivalDate: '2026-09-01',
    });
    const journeyId = created.journey.id;
    const steps = await stepsOf(journeyId);
    const first = at(steps, 0);

    const secretNote = 'Note intime sur ma situation administrative';
    await journeys.updateStep(owner, journeyId, first.id, { notes: secretNote, status: 'DONE' });
    await journeys.update(owner.userId, journeyId, { visibility: 'PUBLIC' });
    await journeys.addMember(owner.userId, journeyId, { userHandle: viewer.handle, role: 'OBSERVER' });

    const view = await journeys.publicDetail(viewer.userId, journeyId);
    // Deux portées de vérification, et c'est volontaire : la DONNÉE du parcours
    // (`view.journey`) ne doit porter aucun de ces champs, tandis que le `meta`
    // de la réponse porte légitimement le texte imposé de la checklist (T4 §4) —
    // chercher « checklist » dans l'enveloppe entière ferait échouer le test sur
    // une phrase d'interface, pas sur une fuite.
    const serialized = JSON.stringify(view.journey);

    // Ce qui DOIT être là (§3.7) : l'identité publique, le type, la ville, le pays,
    // l'étape en cours, les étapes franchies avec leur durée, la progression.
    expect(view.journey.member.handle).toBeDefined();
    expect(view.journey.template.nameFr).toBe('Études');
    expect(view.journey.destinationCity.name).toBe(cityA.name);
    expect(view.journey.originCountry.iso2).toBe('BJ');
    expect(view.journey.progressPct).toBe(50);
    expect(view.journey.completedSteps).toHaveLength(1);
    expect(view.journey.completedSteps[0]?.durationDays).not.toBeNull();
    // L'étape en cours est la première qui RESTE à faire : l'optionnelle, en
    // position 2 — et non le jalon de la position 3.
    expect(view.journey.currentStep?.id).toBe(at(await stepsOf(journeyId), 1).id);

    // Ce qui NE DOIT PAS y être.
    expect(serialized).not.toContain(personalTitle);
    expect(serialized).not.toContain('intime');
    expect(serialized).not.toContain(secretNote);
    expect(serialized).not.toContain('Passeport valide');
    expect(serialized).not.toContain('2026-09-01');
    expect(serialized).not.toContain('checklist');
    expect(serialized).not.toContain('notes');
    expect(serialized).not.toContain('members');
    expect(serialized).not.toContain('groupConversationId');
    expect(serialized).not.toContain('dueDate');
    expect(Object.keys(view.journey)).not.toContain('title');
    expect(Object.keys(view.journey)).not.toContain('targetArrivalDate');

    // La liste applique la même projection.
    const list = await journeys.publicList(viewer.userId, { limit: 50 });
    expect(JSON.stringify(list)).not.toContain(personalTitle);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Journal, inactivité, corrections
  // ══════════════════════════════════════════════════════════════════════════

  it('le journal est paginé par curseur et réservé au propriétaire', async () => {
    const owner = await newMember();
    const observer = await newMember();
    const journeyId = await journeyFor(owner);
    const steps = await stepsOf(journeyId);
    const [first, milestone] = [at(steps, 0), at(steps, 2)];

    await journeys.updateStep(owner, journeyId, first.id, { status: 'IN_PROGRESS' });
    await journeys.updateStep(owner, journeyId, first.id, { status: 'DONE' });
    await journeys.updateStep(owner, journeyId, milestone.id, { status: 'IN_PROGRESS' });

    const page1 = await journeys.activities(owner.userId, journeyId, { limit: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await journeys.activities(owner.userId, journeyId, {
      limit: 2,
      cursor: page1.nextCursor as string,
    });
    const ids1 = page1.items.map((i) => (i as { id: string }).id);
    const ids2 = page2.items.map((i) => (i as { id: string }).id);
    // Une page qui répète ou saute une ligne est le symptôme d'un curseur cassé.
    expect(ids2.some((id) => ids1.includes(id))).toBe(false);
    expect(page2.items.length).toBeGreaterThan(0);

    await journeys.addMember(owner.userId, journeyId, {
      userHandle: observer.handle,
      role: 'OBSERVER',
    });
    await journeys.acceptInvite(observer.userId, journeyId);
    await expect(
      journeys.activities(observer.userId, journeyId, { limit: 20 }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('la réponse à la relance d’inactivité change l’état sans rien publier', async () => {
    const member = await newMember();
    const journeyId = await journeyFor(member);

    const answered = await journeys.inactivityResponse(member.userId, journeyId, {
      answer: 'PAUSED',
    });
    expect(answered.journey.status).toBe('PAUSED');
    expect(await publishedContentCounts(member.userId)).toMatchObject({ posts: 0, stories: 0 });

    const done = await journeys.inactivityResponse(member.userId, journeyId, {
      answer: 'COMPLETED',
    });
    expect(done.journey.status).toBe('COMPLETED');
    expect(await eventsOf('journey.completed', journeyId)).toBe(1);
  });

  it('signaler une erreur de modèle ouvre une proposition de correction', async () => {
    const member = await newMember();
    const journeyId = await journeyFor(member);
    const steps = await stepsOf(journeyId);

    const proposal = await journeys.reportTemplateError(member.userId, journeyId, {
      stepId: at(steps, 0).id,
      message: 'Le formulaire demandé a changé de nom depuis janvier.',
    });
    const stored = await prisma.templateCorrectionProposal.findUniqueOrThrow({
      where: { id: proposal.id },
      select: { status: true, templateVersionId: true, stepDefinitionId: true, userId: true },
    });
    expect(stored.status).toBe('PENDING');
    expect(stored.templateVersionId).toBe(model.versionId);
    expect(stored.stepDefinitionId).toBe(model.definitionIds.first);
    expect(stored.userId).toBe(member.userId);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Consommateurs d'événements (§7)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * §3.4 et 08 §2.3 : « Un parrain actif devient `SUPPORTER` automatiquement. »
   *
   * MUTATION : en retirant le garde d'idempotence
   * (`existing?.status === 'ACTIVE' && …` → `false`), le second appel réécrit une
   * activité et réémet l'événement, et ce test tombe sur les compteurs.
   */
  it('mentorship.accepted fait du parrain un SUPPORTER, une seule fois', async () => {
    const owner = await newMember();
    const mentor = await newMember('L2');
    const journeyId = await journeyFor(owner);

    const payload = {
      mentorshipId: newId(),
      mentorUserId: mentor.userId,
      menteeUserId: owner.userId,
      journeyId,
    };

    const first = await journeys.handleMentorshipAccepted(payload);
    expect(first.added).toBe(true);

    const member = await prisma.journeyMember.findUniqueOrThrow({
      where: { journeyId_userId: { journeyId, userId: mentor.userId } },
      select: { role: true, status: true, invitedByUserId: true, acceptedAt: true },
    });
    expect(member.role).toBe('SUPPORTER');
    expect(member.status).toBe('ACTIVE');
    // §4 : `invited_by_user_id` = propriétaire.
    expect(member.invitedByUserId).toBe(owner.userId);
    expect(member.acceptedAt).not.toBeNull();

    // Rejeu : la livraison est « au moins une fois ».
    const second = await journeys.handleMentorshipAccepted(payload);
    expect(second.added).toBe(false);
    expect(await eventsOf('journey.member_joined', journeyId)).toBe(1);
    expect(
      await prisma.journeyActivity.count({ where: { journeyId, type: 'MEMBER_JOINED' } }),
    ).toBe(1);

    // Une charge sans parcours ne fait rien, et ne lève pas.
    expect(
      (await journeys.handleMentorshipAccepted({ mentorUserId: mentor.userId, journeyId: null }))
        .added,
    ).toBe(false);
  });

  it('user.blocked retire l’accompagnant du parcours, dans les deux sens et une seule fois', async () => {
    const owner = await newMember();
    const supporter = await newMember();
    const journeyId = await journeyFor(owner);
    await journeys.addMember(owner.userId, journeyId, {
      userHandle: supporter.handle,
      role: 'SUPPORTER',
    });
    await journeys.acceptInvite(supporter.userId, journeyId);

    // Le blocage vient de l'ACCOMPAGNANT : le retrait doit marcher dans ce sens
    // aussi, alors que le parcours n'est pas le sien.
    const first = await journeys.handleUserBlocked(supporter.userId, owner.userId);
    expect(first.removed).toBe(1);

    const membership = await prisma.journeyMember.findUniqueOrThrow({
      where: { journeyId_userId: { journeyId, userId: supporter.userId } },
      select: { status: true, removedAt: true },
    });
    expect(membership.status).toBe('REMOVED');
    expect(membership.removedAt).not.toBeNull();

    const second = await journeys.handleUserBlocked(supporter.userId, owner.userId);
    expect(second.removed).toBe(0);
    expect(await eventsOf('journey.member_removed', journeyId)).toBe(1);
  });

  it('help_request.resolved pose une activité HELP_RECEIVED sur l’étape, une seule fois', async () => {
    const member = await newMember();
    const helper = await newMember();
    const journeyId = await journeyFor(member);
    const steps = await stepsOf(journeyId);
    const first = at(steps, 0);

    const draft = await journeys.createBlockerDraft(member.userId, journeyId, first.id);
    const published = await journeys.publishBlocker(member, draft.blocker.id, {
      text: 'Je ne sais pas quelles pièces réunir pour ce dossier, une idée ?',
      isPrivate: false,
      title: 'Aide pour le dossier',
    });
    const helpRequestId = published.blocker.publishedRefId;

    const response = await help.respond({ userId: helper.userId, level: helper.level }, helpRequestId, {
      body: 'Les pièces sont listées à l’accueil de la préfecture, demande le formulaire 14.',
    });
    await help.markHelpful({ userId: member.userId, level: member.level }, helpRequestId, response.id);

    const first1 = await journeys.handleHelpRequestResolved(helpRequestId);
    expect(first1.logged).toBe(true);
    const again = await journeys.handleHelpRequestResolved(helpRequestId);
    expect(again.logged).toBe(false);

    const activities = await prisma.journeyActivity.findMany({
      where: { journeyId, type: 'HELP_RECEIVED' },
      select: { journeyStepId: true, refId: true, payload: true },
    });
    expect(activities).toHaveLength(1);
    expect(activities[0]?.journeyStepId).toBe(first.id);
    expect(activities[0]?.refId).toBe(helpRequestId);
    // La PROPOSITION de marquer l'étape franchie voyage dans l'activité : le
    // module ne franchit jamais l'étape lui-même (§3.5).
    expect(activities[0]?.payload).toMatchObject({ proposeStepDone: true });
    const step = await prisma.journeyStep.findUniqueOrThrow({
      where: { id: first.id },
      select: { status: true },
    });
    expect(step.status).toBe('TODO');
  });
});
