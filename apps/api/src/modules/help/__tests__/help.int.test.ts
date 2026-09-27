import { newId } from '@app/db';
import { HELP_LIMITS, HELP_SAFETY_BANNER, helpListQuerySchema } from '@app/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiError } from '../../../common/api-error';
import { AuditService } from '../../../common/audit.service';
import { CryptoService } from '../../../common/crypto.service';
import { OutboxService } from '../../../common/outbox.service';
import { PrismaService } from '../../../common/prisma.service';
import { TokenService } from '../../../common/token.service';
import { VisibilityService } from '../../../common/visibility.service';
import { FakeCaptchaProvider, FakeSmsProvider } from '../../../providers/providers';
import { ConsentsService } from '../../consents/consents.service';
import { AuthService } from '../../auth/auth.service';
import { HelpService, type HelpActor } from '../help.service';

/**
 * Fil d'entraide — 06-entraide.md §9.
 *
 * Les cinq règles dures de §9 ont chacune leur test, et plusieurs de ces tests
 * correspondent à des bogues RÉELS trouvés en exerçant le service, pas en le
 * relisant — ils sont signalés là où ils sont.
 *
 * Chaque test vérifie d'abord que sa PRÉMISSE tient (le niveau du membre, l'état
 * de la demande, la présence du blocage) : un test qui passerait aussi avec le
 * bogue ne vaut rien, et la première façon d'en écrire un est de l'appuyer sur
 * une base qui n'est pas dans l'état supposé.
 */
describe('fil d’entraide (06 §2, §4, §9)', () => {
  let prisma: PrismaService;
  let help: HelpService;
  let auth: AuthService;
  const sms = new FakeSmsProvider();

  const createdUserIds: string[] = [];
  const createdConversationIds: string[] = [];
  let cityA: { id: string; name: string };
  /** À 4 km de `cityA` : dans le rayon de 30 km, mais PAS la même ville. */
  let cityNear: { id: string; name: string };
  /** À 50 km : hors du rayon par défaut, dans celui de 200 km. */
  let cityFar: { id: string; name: string };
  const journeyFixture: {
    templateId?: string;
    versionId?: string;
    stepDefinitionId?: string;
    journeyId?: string;
    stepId?: string;
  } = {};

  let counter = 0;
  const nextPhone = (): string =>
    `07${String(Date.now()).slice(-6)}${String(counter++).padStart(2, '0')}`;

  /** Un membre neuf. Le NIVEAU est porté par l'acteur, comme le jeton le porte. */
  async function newMember(level: 'L0' | 'L1' | 'L2' = 'L1'): Promise<HelpActor> {
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
      data: { verificationLevel: level, cityId: cityA.id },
    });
    return { userId: session.userId, level };
  }

  const request = (over: Record<string, unknown> = {}) => ({
    kind: 'REQUEST' as const,
    type: 'PAPERWORK' as const,
    title: 'Renouvellement de titre de séjour',
    body: 'Je dois déposer mon dossier la semaine prochaine et je ne sais pas quelles pièces réunir.',
    cityId: cityA.id,
    ...over,
  });

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    const crypto = new CryptoService();
    const outbox = new OutboxService(prisma);
    help = new HelpService(prisma, outbox, new AuditService(prisma), new VisibilityService(prisma));
    auth = new AuthService(
      prisma,
      crypto,
      outbox,
      new TokenService(),
      // Ajouté au tronc commun après que ce module a été écrit : les
      // consentements de l'inscription s'écrivent dans la transaction de
      // création du compte (01 §5).
      new ConsentsService(prisma),
      sms,
      new FakeCaptchaProvider(),
    );

    const lyon = await prisma.city.findUniqueOrThrow({
      where: { slug: 'lyon' },
      select: { id: true, name: true },
    });
    cityA = lyon;
    // Villeurbanne est à 4 km de Lyon, Saint-Étienne à 50 : de quoi distinguer
    // un vrai calcul de distance d'une simple égalité de `city_id`.
    cityNear = await prisma.city.findUniqueOrThrow({
      where: { slug: 'villeurbanne' },
      select: { id: true, name: true },
    });
    cityFar = await prisma.city.findUniqueOrThrow({
      where: { slug: 'saint-etienne' },
      select: { id: true, name: true },
    });
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      // Les demandes, réponses, contacts et événements de réputation partent en
      // cascade avec les membres ; les conversations, elles, n'ont pas de clé
      // étrangère vers `users` et doivent être retirées à la main.
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    if (createdConversationIds.length > 0) {
      await prisma.conversation.deleteMany({ where: { id: { in: createdConversationIds } } });
    }
    if (journeyFixture.templateId !== undefined) {
      await prisma.journeyTemplate.deleteMany({ where: { id: journeyFixture.templateId } });
    }
    if (journeyFixture.stepDefinitionId !== undefined) {
      await prisma.stepDefinition.deleteMany({ where: { id: journeyFixture.stepDefinitionId } });
    }
    await prisma.$disconnect();
  });

  // ══ RÈGLE DURE : un L0 publie une demande, jamais une offre (§2.1) ═════════

  it('rule: un L0 peut publier une demande mais pas une offre', async () => {
    const pre = await newMember('L0');
    // La prémisse : le membre est bien L0, sinon le test ne prouve rien.
    expect(pre.level).toBe('L0');

    const asked = await help.create(pre, request());
    expect(asked.request.kind).toBe('REQUEST');
    expect(asked.request.status).toBe('OPEN');

    // §2.1 : « il ne peut pas non plus servir de compte-relais » pour une offre.
    await expect(
      help.create(pre, request({ kind: 'OFFER', type: 'RIDE' })),
    ).rejects.toMatchObject({
      code: 'LEVEL_REQUIRED',
      details: { capability: 'help.offer', requiredLevel: 'L1', currentLevel: 'L0' },
    });

    // Le même texte, en L1, passe : c'est bien le NIVEAU qui a refusé, et non le
    // contenu ou le type.
    const settled = await newMember('L1');
    const offered = await help.create(settled, request({ kind: 'OFFER', type: 'RIDE' }));
    expect(offered.request.kind).toBe('OFFER');
  });

  // ══ RÈGLE DURE : « ça m'a aidé » → contact + réputation, une fois (§2.4) ═══

  it('rule: ça m’a aidé crée le contact et le crédit de réputation, une seule fois par demande', async () => {
    const author = await newMember();
    const helper = await newMember();
    const other = await newMember();

    const created = await help.create(author, request());
    const requestId = created.request.id;

    const first = await help.respond(helper, requestId, {
      body: 'La liste des pièces est affichée à l’accueil de la préfecture, demande le formulaire 14.',
    });
    const second = await help.respond(other, requestId, {
      body: 'J’ai fait la même démarche en mars, prends rendez-vous en ligne avant d’y aller.',
    });

    const resolved = await help.markHelpful(author, requestId, first.id);
    expect(resolved.request.status).toBe('RESOLVED');
    expect(resolved.request.resolvedByResponseId).toBe(first.id);

    // 1. La réponse est marquée, et horodatée.
    const marked = await prisma.helpResponse.findUniqueOrThrow({ where: { id: first.id } });
    expect(marked.markedHelpful).toBe(true);
    expect(marked.markedAt).not.toBeNull();

    // 2. La réputation est créditée à l'AIDANT, pas à l'auteur.
    const events = await prisma.reputationEvent.findMany({
      where: { sourceType: 'help_request', sourceId: requestId },
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.userId).toBe(helper.userId);
    expect(events[0]?.type).toBe('HELP_VALIDATED');
    const stats = await prisma.userStats.findUniqueOrThrow({ where: { userId: helper.userId } });
    expect(stats.helpValidatedCount).toBe(1);

    // 3. Le contact existe, avec son origine — la paire est TRIÉE, sans quoi
    //    l'unicité (user_a, user_b) laisserait passer (A,B) et (B,A).
    const [a, b] =
      author.userId < helper.userId
        ? [author.userId, helper.userId]
        : [helper.userId, author.userId];
    const connection = await prisma.connection.findUniqueOrThrow({
      where: { userAId_userBId: { userAId: a, userBId: b } },
    });
    expect(connection.origin).toBe('HELP_VALIDATED');
    expect(connection.originRefId).toBe(requestId);
    expect(connection.removedAt).toBeNull();

    // 4. L'événement est dans la boîte d'envoi, dans la même transaction.
    const emitted = await prisma.domainEvent.findMany({
      where: { aggregateId: requestId, type: 'help_request.resolved' },
    });
    expect(emitted).toHaveLength(1);

    // ── « Une seule fois par demande » ───────────────────────────────────────
    // Marquer DEUX fois la même réponse ne crédite pas deux fois : la contrainte
    // d'unicité de reputation_events porte sur la demande (00 §9.4), et la
    // livraison des événements est « au moins une fois ».
    await help.markHelpful(author, requestId, first.id);
    expect(
      await prisma.reputationEvent.count({ where: { sourceType: 'help_request', sourceId: requestId } }),
    ).toBe(1);
    expect(
      (await prisma.userStats.findUniqueOrThrow({ where: { userId: helper.userId } }))
        .helpValidatedCount,
    ).toBe(1);

    // ── Marquer une AUTRE réponse désmarque la première (§2.4) ───────────────
    await help.markHelpful(author, requestId, second.id);

    expect(
      (await prisma.helpResponse.findUniqueOrThrow({ where: { id: first.id } })).markedHelpful,
    ).toBe(false);
    // Réputation ajustée : retirée au premier, donnée au second.
    expect(
      (await prisma.userStats.findUniqueOrThrow({ where: { userId: helper.userId } }))
        .helpValidatedCount,
    ).toBe(0);
    expect(
      (await prisma.userStats.findUniqueOrThrow({ where: { userId: other.userId } }))
        .helpValidatedCount,
    ).toBe(1);
    // Et TOUJOURS un seul événement pour cette demande, désormais au nom du second.
    const after = await prisma.reputationEvent.findMany({
      where: { sourceType: 'help_request', sourceId: requestId },
    });
    expect(after).toHaveLength(1);
    expect(after[0]?.userId).toBe(other.userId);

    // Connexion ajustée : celle du premier retirée, celle du second créée.
    expect(
      await prisma.connection.count({
        where: { originRefId: requestId, OR: [{ userAId: helper.userId }, { userBId: helper.userId }] },
      }),
    ).toBe(0);
    expect(
      await prisma.connection.count({
        where: { originRefId: requestId, OR: [{ userAId: other.userId }, { userBId: other.userId }] },
      }),
    ).toBe(1);
  });

  it('ne crédite JAMAIS la réputation sur une offre (§2.9)', async () => {
    const author = await newMember();
    const taker = await newMember();
    const offer = await help.create(author, request({ kind: 'OFFER', type: 'MATERIAL' }));
    const answer = await help.respond(taker, offer.request.id, {
      body: 'Je suis intéressé·e, je peux passer samedi matin si c’est encore disponible.',
    });

    // §2.9 : la clôture d'une offre est « Offre pourvue », sans marquage — « cela
    // évite de récompenser l'auto-promotion ».
    await expect(
      help.markHelpful(author, offer.request.id, answer.id),
    ).rejects.toMatchObject({ code: 'CONFLICT', details: { reason: 'OFFER_NOT_MARKABLE' } });

    const closed = await help.resolve(author, offer.request.id);
    expect(closed.request.status).toBe('RESOLVED');
    expect(closed.request.resolvedByResponseId).toBeNull();
    expect(
      await prisma.reputationEvent.count({ where: { sourceId: offer.request.id } }),
    ).toBe(0);
    expect(await prisma.connection.count({ where: { originRefId: offer.request.id } })).toBe(0);
  });

  // ══ RÈGLE DURE : la règle de non-paiement est renvoyée par l'API (§2.7) ════

  it('rule: la règle de non-paiement est renvoyée dans la réponse de liste', async () => {
    const member = await newMember();
    await help.create(member, request());

    const list = await help.list(member, helpListQuerySchema.parse({}));
    expect(list.meta['safetyBanner']).toBe(HELP_SAFETY_BANNER);
    expect(String(list.meta['safetyBanner'])).toContain('Aucun versement entre membres');
    expect(String(list.meta['safetyBanner'])).toContain('signalez');

    // « CHAQUE page de la section » : toutes les vues, pas seulement la première.
    const canHelp = await help.canHelp(member, { limit: 20, radiusKm: 30 });
    const mine = await help.mine(member, { limit: 20 });
    const responses = await help.myResponses(member, { limit: 20 });
    const detail = await help.detail(member, (await help.mine(member, { limit: 1 })).items[0]!.id);
    for (const meta of [canHelp.meta, mine.meta, responses.meta, detail.meta]) {
      expect(meta['safetyBanner']).toBe(HELP_SAFETY_BANNER);
    }

    // Les compteurs du sous-titre (§5) accompagnent la liste.
    expect(typeof list.meta['open']).toBe('number');
    expect(typeof list.meta['resolvedThisMonth']).toBe('number');
  });

  // ══ RÈGLE DURE : logement et emploi vont dans Services (§2.1) ══════════════

  it('rule: une demande d’entraide de type logement ou emploi est refusée avec USE_SERVICES', async () => {
    const member = await newMember();

    for (const type of ['HOUSING', 'JOB'] as const) {
      await expect(help.create(member, request({ type }))).rejects.toMatchObject({
        code: 'USE_SERVICES',
        details: { type },
      });
    }

    // Le message est celui de T2 — le front l'affiche tel quel. Il se lit dans le
    // CORPS de la réponse : `HttpException.message` vaut « Api Error » quand le
    // corps est un objet, et l'y chercher ferait passer le test pour rien.
    await help
      .create(member, request({ type: 'HOUSING' }))
      .then(() => expect.unreachable('la demande aurait dû être refusée'))
      .catch((error: unknown) => {
        const body = (error as ApiError).getResponse() as {
          error: { code: string; message: string };
        };
        expect(body.error.code).toBe('USE_SERVICES');
        expect(body.error.message).toContain('utilisez Services');
      });

    // Et la modification ne doit pas rouvrir la porte que la création ferme.
    const created = await help.create(member, request());
    await expect(
      help.update(member, created.request.id, { type: 'JOB' }),
    ).rejects.toMatchObject({ code: 'USE_SERVICES' });
  });

  // ══ RÈGLE DURE : l'auteur ne répond pas à sa demande (§2.3) ════════════════

  it('rule: l’auteur ne peut pas répondre à sa propre demande', async () => {
    const author = await newMember();
    const created = await help.create(author, request());

    await expect(
      help.respond(author, created.request.id, {
        body: 'Je précise : le dossier est à déposer avant le 30 du mois.',
      }),
    ).rejects.toMatchObject({ code: 'OWN_REQUEST' });

    // Le compteur n'a pas bougé, et aucune ligne n'a été écrite.
    expect(
      await prisma.helpResponse.count({ where: { helpRequestId: created.request.id } }),
    ).toBe(0);
    expect(
      (await prisma.helpRequest.findUniqueOrThrow({ where: { id: created.request.id } }))
        .responseCount,
    ).toBe(0);

    // Un AUTRE membre, lui, répond : la règle refuse l'auteur, pas la réponse.
    const helper = await newMember();
    await help.respond(helper, created.request.id, {
      body: 'Le formulaire est téléchargeable, il faut le remplir avant le rendez-vous.',
    });
    expect(
      (await prisma.helpRequest.findUniqueOrThrow({ where: { id: created.request.id } }))
        .responseCount,
    ).toBe(1);
  });

  // ══ Visibilité — un membre bloqué n'apparaît nulle part (08 §4) ════════════

  it('cache la demande d’un membre bloqué, dans les DEUX sens, avec 404', async () => {
    const author = await newMember();
    const reader = await newMember();
    const created = await help.create(author, request());

    // Avant le blocage, la demande est bien visible : sans cette vérification, le
    // test passerait même si la liste était vide pour une autre raison.
    expect((await help.list(reader, helpListQuerySchema.parse({}))).items.map((i) => i.id)).toContain(
      created.request.id,
    );

    await prisma.block.create({
      data: { id: newId(), blockerUserId: reader.userId, blockedUserId: author.userId },
    });

    // Celui qui a bloqué ne retrouve plus la demande…
    expect(
      (await help.list(reader, helpListQuerySchema.parse({}))).items.map((i) => i.id),
    ).not.toContain(created.request.id);
    await expect(help.detail(reader, created.request.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    // …et il ne peut pas non plus y répondre ni écrire en privé.
    await expect(
      help.respond(reader, created.request.id, {
        body: 'Une réponse qui ne doit jamais atteindre son destinataire.',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(help.privateReply(reader, created.request.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    // …et l'auteur, lui, garde sa propre demande dans « Mes demandes » : le
    // blocage la cache aux autres, il ne la lui confisque pas.
    expect((await help.mine(author, { limit: 20 })).items.map((i) => i.id)).toContain(
      created.request.id,
    );

    // Dans l'autre sens : la demande du BLOQUANT est invisible au bloqué.
    const own = await help.create(reader, request({ title: 'Ouvrir un compte bancaire ici' }));
    expect(
      (await help.list(author, helpListQuerySchema.parse({}))).items.map((i) => i.id),
    ).not.toContain(own.request.id);
  });

  it('retire la réponse d’un membre bloqué du détail de la demande', async () => {
    const author = await newMember();
    const helper = await newMember();
    const created = await help.create(author, request());
    const answer = await help.respond(helper, created.request.id, {
      body: 'Le service est ouvert de 9 h à 12 h, mieux vaut arriver tôt.',
    });

    expect((await help.detail(author, created.request.id)).responses.map((r) => r.id)).toContain(
      answer.id,
    );

    await prisma.block.create({
      data: { id: newId(), blockerUserId: author.userId, blockedUserId: helper.userId },
    });
    expect(
      (await help.detail(author, created.request.id)).responses.map((r) => r.id),
    ).not.toContain(answer.id);
  });

  it('ne crée PAS de contact quand un blocage existe (§2.4)', async () => {
    const author = await newMember();
    const helper = await newMember();
    const created = await help.create(author, request());
    const answer = await help.respond(helper, created.request.id, {
      body: 'Il faut aussi une attestation d’hébergement de moins de trois mois.',
    });

    await prisma.block.create({
      data: { id: newId(), blockerUserId: helper.userId, blockedUserId: author.userId },
    });

    await help.markHelpful(author, created.request.id, answer.id);

    // La réputation est créditée — la réponse a bien aidé —, mais AUCUN contact :
    // §2.4 dit « sauf si un blocage existe ».
    expect(
      await prisma.reputationEvent.count({ where: { sourceId: created.request.id } }),
    ).toBe(1);
    expect(await prisma.connection.count({ where: { originRefId: created.request.id } })).toBe(0);
  });

  // ══ Cycle de vie (§2.2) ═══════════════════════════════════════════════════

  it('refuse une nouvelle réponse sur une demande résolue', async () => {
    const author = await newMember();
    const helper = await newMember();
    const late = await newMember();
    const created = await help.create(author, request());
    const answer = await help.respond(helper, created.request.id, {
      body: 'Prends un rendez-vous en ligne, les dépôts sans rendez-vous sont refusés.',
    });
    await help.markHelpful(author, created.request.id, answer.id);

    await expect(
      help.respond(late, created.request.id, {
        body: 'J’allais dire la même chose, le rendez-vous est obligatoire.',
      }),
    ).rejects.toMatchObject({ code: 'REQUEST_CLOSED' });
  });

  it('rouvre dans les 7 jours et RETIRE ce que la résolution avait posé (§2.2, §6)', async () => {
    const author = await newMember();
    const helper = await newMember();
    const created = await help.create(author, request());
    const answer = await help.respond(helper, created.request.id, {
      body: 'La préfecture demande deux photos d’identité récentes en plus du dossier.',
    });
    await help.markHelpful(author, created.request.id, answer.id);
    expect(await prisma.connection.count({ where: { originRefId: created.request.id } })).toBe(1);

    const reopened = await help.reopen(author, created.request.id);
    expect(reopened.request.status).toBe('OPEN');
    expect(reopened.request.resolvedAt).toBeNull();
    expect(reopened.request.resolvedByResponseId).toBeNull();

    // §6 : « reputation (retrait), connections (retrait si créée par cette
    // résolution) ». Une erreur de clic ne doit rien laisser derrière elle.
    expect(
      (await prisma.helpResponse.findUniqueOrThrow({ where: { id: answer.id } })).markedHelpful,
    ).toBe(false);
    expect(await prisma.reputationEvent.count({ where: { sourceId: created.request.id } })).toBe(0);
    expect(
      (await prisma.userStats.findUniqueOrThrow({ where: { userId: helper.userId } }))
        .helpValidatedCount,
    ).toBe(0);
    expect(await prisma.connection.count({ where: { originRefId: created.request.id } })).toBe(0);
    expect(
      await prisma.domainEvent.count({
        where: { aggregateId: created.request.id, type: 'help_request.reopened' },
      }),
    ).toBe(1);

    // Et la demande accepte de nouveau des réponses.
    const again = await newMember();
    await expect(
      help.respond(again, created.request.id, {
        body: 'Ajoute un justificatif de domicile, ils le demandent systématiquement.',
      }),
    ).resolves.toBeDefined();
  });

  it('ne conserve PAS un contact né d’un autre lien à la réouverture', async () => {
    const author = await newMember();
    const helper = await newMember();
    // Un contact préexistant, d'une autre origine (08 §3.1).
    const [a, b] =
      author.userId < helper.userId
        ? [author.userId, helper.userId]
        : [helper.userId, author.userId];
    await prisma.connection.create({
      data: { id: newId(), userAId: a, userBId: b, origin: 'MANUAL' },
    });

    const created = await help.create(author, request());
    const answer = await help.respond(helper, created.request.id, {
      body: 'Le guichet 4 traite les renouvellements, les autres renvoient vers lui.',
    });
    await help.markHelpful(author, created.request.id, answer.id);
    await help.reopen(author, created.request.id);

    // Le contact MANUAL survit : il n'a pas été créé par cette résolution.
    const survivor = await prisma.connection.findUnique({
      where: { userAId_userBId: { userAId: a, userBId: b } },
    });
    expect(survivor).not.toBeNull();
    expect(survivor?.origin).toBe('MANUAL');
  });

  it('refuse la réouverture au-delà de 7 jours', async () => {
    const author = await newMember();
    const created = await help.create(author, request());
    await help.resolve(author, created.request.id);

    // Huit jours en arrière : la fenêtre de §2.2 est fermée.
    await prisma.helpRequest.update({
      where: { id: created.request.id },
      data: { resolvedAt: new Date(Date.now() - 8 * 86_400_000) },
    });
    await expect(help.reopen(author, created.request.id)).rejects.toMatchObject({
      code: 'REOPEN_WINDOW_CLOSED',
    });

    // À six jours, en revanche, elle est encore ouverte — la borne est bien à 7
    // jours et non « toujours fermée ».
    await prisma.helpRequest.update({
      where: { id: created.request.id },
      data: { resolvedAt: new Date(Date.now() - 6 * 86_400_000) },
    });
    await expect(help.reopen(author, created.request.id)).resolves.toBeDefined();
  });

  it('n’accepte jamais `status=ARCHIVED` comme filtre de liste (§2.2)', () => {
    // « Invisible dans les listes » : c'est l'énumération du schéma qui le tient,
    // pour qu'aucune route ne puisse le contourner en oubliant un `if`.
    expect(() => helpListQuerySchema.parse({ status: 'ARCHIVED' })).toThrow();
    expect(helpListQuerySchema.parse({}).status).toBe('OPEN');
  });

  it('archive 45 jours sans réponse, 90 jours après résolution (§7)', async () => {
    const author = await newMember();
    const helper = await newMember();

    const stale = await help.create(author, request({ title: 'Demande restée sans réponse' }));
    const answered = await help.create(author, request({ title: 'Demande avec réponse récente' }));
    const oldResolved = await help.create(author, request({ title: 'Demande résolue il y a long' }));

    await help.respond(helper, answered.request.id, {
      body: 'Je regarde et je te dis, j’ai fait cette démarche le mois dernier.',
    });
    await help.resolve(author, oldResolved.request.id);

    const fiftyDaysAgo = new Date(Date.now() - 50 * 86_400_000);
    await prisma.helpRequest.updateMany({
      where: { id: { in: [stale.request.id, answered.request.id] } },
      data: { createdAt: fiftyDaysAgo },
    });
    await prisma.helpRequest.update({
      where: { id: oldResolved.request.id },
      data: { resolvedAt: new Date(Date.now() - 100 * 86_400_000) },
    });

    const { archived } = await help.archiveDue();
    expect(archived).toBeGreaterThanOrEqual(2);

    const states = await prisma.helpRequest.findMany({
      where: { id: { in: [stale.request.id, answered.request.id, oldResolved.request.id] } },
      select: { id: true, status: true },
    });
    const statusOf = (id: string): string | undefined => states.find((s) => s.id === id)?.status;

    expect(statusOf(stale.request.id)).toBe('ARCHIVED');
    expect(statusOf(oldResolved.request.id)).toBe('ARCHIVED');
    // Publiée il y a 50 jours mais RÉPONDUE hier : elle est vivante. « Sans
    // réponse depuis 45 jours » se lit sur la dernière réponse, pas sur la
    // création — sinon toute discussion longue serait archivée en pleine vie.
    expect(statusOf(answered.request.id)).toBe('OPEN');

    // Et une demande archivée sort des listes, mais reste au bout de son lien.
    expect(
      (await help.list(author, helpListQuerySchema.parse({}))).items.map((i) => i.id),
    ).not.toContain(stale.request.id);
    await expect(help.detail(author, stale.request.id)).resolves.toBeDefined();
  });

  // ══ Autorisations ═════════════════════════════════════════════════════════

  it('refuse à un non-auteur de marquer, résoudre, modifier ou supprimer', async () => {
    const author = await newMember();
    const intruder = await newMember();
    const created = await help.create(author, request());
    const answer = await help.respond(intruder, created.request.id, {
      body: 'Le dépôt se fait au guichet 4, avec le dossier complet et les photos.',
    });

    await expect(
      help.markHelpful(intruder, created.request.id, answer.id),
    ).rejects.toMatchObject({ code: 'NOT_AUTHOR' });
    await expect(help.resolve(intruder, created.request.id)).rejects.toMatchObject({
      code: 'NOT_AUTHOR',
    });
    await expect(
      help.update(intruder, created.request.id, { title: 'Un titre volé à quelqu’un' }),
    ).rejects.toMatchObject({ code: 'NOT_AUTHOR' });
    await expect(help.remove(intruder, created.request.id)).rejects.toMatchObject({
      code: 'NOT_AUTHOR',
    });

    // Rien n'a bougé en base : le refus n'est pas seulement un code de retour.
    const untouched = await prisma.helpRequest.findUniqueOrThrow({
      where: { id: created.request.id },
    });
    expect(untouched.status).toBe('OPEN');
    expect(untouched.resolvedByResponseId).toBeNull();
    expect(untouched.deletedAt).toBeNull();
  });

  it('refuse de modifier une demande qui n’est plus ouverte', async () => {
    const author = await newMember();
    const created = await help.create(author, request());
    await help.resolve(author, created.request.id);

    await expect(
      help.update(author, created.request.id, { body: 'Un corps réécrit après la clôture.' }),
    ).rejects.toMatchObject({ code: 'REQUEST_CLOSED' });
  });

  it('garde une réponse marquée « ça m’a aidé » à la suppression (§8)', async () => {
    const author = await newMember();
    const helper = await newMember();
    const created = await help.create(author, request());
    const kept = await help.respond(helper, created.request.id, {
      body: 'Les photos doivent être aux normes, une photo de cabine suffit.',
    });
    const plain = await help.create(author, request({ title: 'Une seconde demande à part' }));
    const removable = await help.respond(helper, plain.request.id, {
      body: 'Je ne suis pas sûr·e, mieux vaut appeler le service pour confirmer.',
    });

    await help.markHelpful(author, created.request.id, kept.id);

    // Une réponse ordinaire se supprime, et le compteur suit.
    await help.removeResponse(helper, plain.request.id, removable.id);
    expect(
      (await prisma.helpRequest.findUniqueOrThrow({ where: { id: plain.request.id } }))
        .responseCount,
    ).toBe(0);

    // Celle qui a aidé quelqu'un, non : §8 la conserve même à la suppression du
    // compte, et l'effacer retirerait l'encart de clôture d'une demande d'autrui.
    await expect(
      help.removeResponse(helper, created.request.id, kept.id),
    ).rejects.toMatchObject({ code: 'CONFLICT', details: { reason: 'MARKED_HELPFUL' } });
  });

  it('supprime logiquement une demande et la retire des listes', async () => {
    const author = await newMember();
    const reader = await newMember();
    const created = await help.create(author, request());

    await help.remove(author, created.request.id);

    const row = await prisma.helpRequest.findUniqueOrThrow({ where: { id: created.request.id } });
    expect(row.deletedAt).not.toBeNull();
    await expect(help.detail(reader, created.request.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(
      (await help.list(reader, helpListQuerySchema.parse({}))).items.map((i) => i.id),
    ).not.toContain(created.request.id);
    // Et la trace est au journal d'audit.
    expect(
      await prisma.auditLog.count({
        where: { action: 'help_request.deleted', targetId: created.request.id },
      }),
    ).toBe(1);
  });

  it('applique la part de ce module dans la suppression de compte (§8)', async () => {
    const leaving = await newMember();
    const stayer = await newMember();

    const own = await help.create(leaving, request({ title: 'Ma demande, à supprimer' }));
    const hosted = await help.create(stayer, request({ title: 'La demande de quelqu’un' }));
    const helpful = await help.respond(leaving, hosted.request.id, {
      body: 'Va au guichet 4, c’est le seul qui traite les renouvellements complets.',
    });
    const plain = await help.create(stayer, request({ title: 'Une autre demande hôte' }));
    const notHelpful = await help.respond(leaving, plain.request.id, {
      body: 'Je crois que c’est fermé le mercredi, mais je n’en suis pas certain·e.',
    });
    await help.markHelpful(stayer, hosted.request.id, helpful.id);

    const result = await help.handleUserDeleted(leaving.userId);
    expect(result.requests).toBeGreaterThanOrEqual(1);

    // Demandes : supprimées.
    expect(await prisma.helpRequest.count({ where: { id: own.request.id } })).toBe(0);
    // Réponse marquée « ça m'a aidé » : CONSERVÉE — elle a aidé quelqu'un.
    expect(await prisma.helpResponse.count({ where: { id: helpful.id } })).toBe(1);
    // Réponse ordinaire : supprimée.
    expect(await prisma.helpResponse.count({ where: { id: notHelpful.id } })).toBe(0);
    // Le contact et la réputation déjà créés chez l'autre membre restent.
    expect(await prisma.connection.count({ where: { originRefId: hosted.request.id } })).toBe(1);
  });

  // ══ Modération locale (13 §2) ═════════════════════════════════════════════

  it('bloque coordonnées bancaires et demande de versement, sans bloquer une info de prix', async () => {
    const member = await newMember();

    await expect(
      help.create(
        member,
        request({
          body: 'Je peux avancer les frais, envoyez-moi 200 euros sur mon compte et je dépose le dossier.',
        }),
      ),
    ).rejects.toMatchObject({ code: 'CONTENT_BLOCKED' });

    await expect(
      help.create(
        member,
        request({
          body: 'Pour le paiement des frais, mon IBAN est FR76 3000 6000 0112 3456 7890 189, merci.',
        }),
      ),
    ).rejects.toMatchObject({ code: 'CONTENT_BLOCKED' });

    // Et surtout : une information de prix LÉGITIME passe. Une règle qui bloque
    // « il faut payer 225 € à la préfecture » rendrait la section inutilisable
    // pour le sujet même dont elle parle.
    const legit = await help.create(
      member,
      request({
        body: 'Le timbre fiscal coûte 225 € à régler à la préfecture, en ligne ou chez un buraliste.',
      }),
    );
    expect(legit.request.status).toBe('OPEN');

    // La règle vaut aussi pour les RÉPONSES, qui sont le vecteur visé par §2.7.
    const target = await help.create(member, request({ title: 'Question sur un dossier CAF' }));
    const scammer = await newMember();
    await expect(
      help.respond(scammer, target.request.id, {
        body: 'Je m’occupe de tout, versez-moi la somme sur mon compte Orange Money.',
      }),
    ).rejects.toMatchObject({ code: 'CONTENT_BLOCKED' });
    expect(
      await prisma.helpResponse.count({ where: { helpRequestId: target.request.id } }),
    ).toBe(0);
  });

  it('bloque la modification qui introduit un contenu interdit', async () => {
    const member = await newMember();
    const created = await help.create(member, request());
    await expect(
      help.update(member, created.request.id, {
        body: 'Finalement, envoyez-moi 150 euros sur mon compte et je m’occupe du dossier.',
      }),
    ).rejects.toMatchObject({ code: 'CONTENT_BLOCKED' });

    // Le texte d'origine est intact : le refus ne doit pas écrire à moitié.
    expect(
      (await prisma.helpRequest.findUniqueOrThrow({ where: { id: created.request.id } })).body,
    ).toBe(request().body);
  });

  // ══ Limites (§4) ══════════════════════════════════════════════════════════

  it('limite à 5 demandes par jour', async () => {
    const member = await newMember();
    for (let i = 0; i < HELP_LIMITS.requestsPerDay; i += 1) {
      await help.create(member, request({ title: `Demande numéro ${i + 1} du jour` }));
    }
    await expect(
      help.create(member, request({ title: 'La sixième demande du jour' })),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });

    // Supprimer une demande ne remet PAS le compteur à zéro : sinon la limite se
    // contourne d'un clic.
    const mine = await help.mine(member, { limit: 1 });
    await help.remove(member, mine.items[0]!.id);
    await expect(
      help.create(member, request({ title: 'Une demande après suppression' })),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  // ══ Filtres, rayon et pagination (§4) ═════════════════════════════════════

  it('filtre par ville avec un rayon, et exclut ce qui est au-delà', async () => {
    const member = await newMember();
    const here = await help.create(member, request({ title: 'Une demande à la ville A' }));
    const neighbour = await help.create(
      member,
      request({ title: 'Une demande à la ville voisine', cityId: cityNear.id }),
    );
    const far = await help.create(
      member,
      request({ title: 'Une demande à la ville lointaine', cityId: cityFar.id }),
    );

    const scoped = await help.list(
      member,
      helpListQuerySchema.parse({ cityId: cityA.id, radiusKm: '30' }),
    );
    const ids = scoped.items.map((i) => i.id);
    expect(ids).toContain(here.request.id);
    // La ville VOISINE entre dans les 30 km : §4 dit « ville, puis 30 km », ce
    // qu'un filtre par égalité de `city_id` ne ferait pas.
    expect(ids).toContain(neighbour.request.id);
    expect(ids).not.toContain(far.request.id);

    // Un rayon large rattrape la ville lointaine : c'est bien la distance qui
    // filtrait, et non un « même cityId » déguisé.
    const wide = await help.list(
      member,
      helpListQuerySchema.parse({ cityId: cityA.id, radiusKm: '200' }),
    );
    expect(wide.items.map((i) => i.id)).toContain(far.request.id);

    // Rayon nul : la ville seule, sans ses voisines.
    const exact = await help.list(
      member,
      helpListQuerySchema.parse({ cityId: cityA.id, radiusKm: '0' }),
    );
    expect(exact.items.map((i) => i.id)).toContain(here.request.id);
    expect(exact.items.map((i) => i.id)).not.toContain(neighbour.request.id);
  });

  it('pagine par curseur, sans répéter ni sauter de ligne', async () => {
    const member = await newMember();
    const created: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const row = await help.create(member, request({ title: `Demande paginée ${i + 1} ici` }));
      created.push(row.request.id);
    }

    const first = await help.mine(member, { limit: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();

    const second = await help.mine(member, { limit: 2, cursor: first.nextCursor as string });
    const seen = [...first.items, ...second.items].map((i) => i.id);
    expect(new Set(seen).size).toBe(seen.length);
    for (const id of created) expect(seen).toContain(id);
  });

  it('cache un compte désactivé, même quand on filtre par phase', async () => {
    const gone = await newMember();
    const reader = await newMember();
    const created = await help.create(gone, request({ title: 'Demande d’un compte éteint' }));
    await prisma.user.update({
      where: { id: gone.userId },
      data: { status: 'DEACTIVATED', phase: 'PRE_DEPARTURE' },
    });

    // Sans filtre, le compte éteint est déjà exclu…
    expect(
      (await help.list(reader, helpListQuerySchema.parse({}))).items.map((i) => i.id),
    ).not.toContain(created.request.id);

    // …et AVEC le filtre de phase aussi. Bogue trouvé en relisant le `where`
    // construit : le filtre de phase posait un second `author: { … }` dans le même
    // objet littéral, qui écrasait celui de `baseWhere` — les comptes désactivés
    // et supprimés revenaient donc dans la liste dès qu'on filtrait par phase.
    expect(
      (await help.list(reader, helpListQuerySchema.parse({ phase: 'PRE_DEPARTURE' }))).items.map(
        (i) => i.id,
      ),
    ).not.toContain(created.request.id);
  });

  it('filtre par phase de l’auteur', async () => {
    const pre = await newMember();
    const settled = await newMember();
    await prisma.user.update({ where: { id: pre.userId }, data: { phase: 'PRE_DEPARTURE' } });
    await prisma.user.update({ where: { id: settled.userId }, data: { phase: 'SETTLED' } });

    const fromPre = await help.create(pre, request({ title: 'Demande d’un pré-départ ici' }));
    const fromSettled = await help.create(settled, request({ title: 'Demande d’un installé ici' }));

    const ids = (
      await help.list(settled, helpListQuerySchema.parse({ phase: 'PRE_DEPARTURE' }))
    ).items.map((i) => i.id);
    expect(ids).toContain(fromPre.request.id);
    expect(ids).not.toContain(fromSettled.request.id);
  });

  it('filtre par type et par kind', async () => {
    const member = await newMember();
    const ride = await help.create(member, request({ kind: 'OFFER', type: 'RIDE' }));
    const paperwork = await help.create(member, request({ type: 'PAPERWORK' }));

    const offers = await help.list(member, helpListQuerySchema.parse({ kind: 'OFFER' }));
    expect(offers.items.map((i) => i.id)).toContain(ride.request.id);
    expect(offers.items.map((i) => i.id)).not.toContain(paperwork.request.id);

    const rides = await help.list(member, helpListQuerySchema.parse({ type: 'RIDE' }));
    expect(rides.items.every((i) => i.type === 'RIDE')).toBe(true);
  });

  // ══ « Vous pouvez aider » (§2.6) ══════════════════════════════════════════

  it('propose les demandes dont le type correspond aux types déclarés au profil', async () => {
    const asker = await newMember();
    const volunteer = await newMember();
    await prisma.userProfile.create({
      data: {
        userId: volunteer.userId,
        occupationStatus: 'OTHER',
        availableToHelp: true,
        // `HelpType` (module 01) et non `HelpType2` : les deux énumérations
        // diffèrent, et la correspondance vit dans `HELP_TYPES_FROM_PROFILE`.
        helpTypes: ['PAPERWORK'],
        isPublic: false,
      },
    });

    const paperwork = await help.create(asker, request({ type: 'PAPERWORK' }));
    const material = await help.create(asker, request({ type: 'MATERIAL' }));
    const own = await help.create(volunteer, request({ type: 'PAPERWORK' }));

    const suggestions = await help.canHelp(volunteer, { limit: 20, radiusKm: 30 });
    const ids = suggestions.items.map((i) => i.id);
    expect(ids).toContain(paperwork.request.id);
    // Un type non déclaré n'est pas proposé…
    expect(ids).not.toContain(material.request.id);
    // …et on ne se propose jamais ses propres demandes.
    expect(ids).not.toContain(own.request.id);
  });

  it('ne propose rien quand le membre n’a déclaré aucun critère', async () => {
    const asker = await newMember();
    const blank = await newMember();
    await help.create(asker, request());

    const suggestions = await help.canHelp(blank, { limit: 20, radiusKm: 30 });
    // Renvoyer « toutes les demandes » serait la pire réponse possible : l'encadré
    // perdrait son sens, et son taux de réponse avec.
    expect(suggestions.items).toEqual([]);
    expect(suggestions.meta['reason']).toBe('NO_CRITERIA');
  });

  it('trie « Vous pouvez aider » par échéance la plus proche', async () => {
    const asker = await newMember();
    const volunteer = await newMember();
    await prisma.userProfile.create({
      data: {
        userId: volunteer.userId,
        occupationStatus: 'OTHER',
        availableToHelp: true,
        helpTypes: ['PAPERWORK'],
        isPublic: false,
      },
    });

    const iso = (days: number): string =>
      new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
    const later = await help.create(asker, request({ dueDate: iso(20) }));
    const sooner = await help.create(asker, request({ dueDate: iso(2) }));
    const undated = await help.create(asker, request());

    const ids = (await help.canHelp(volunteer, { limit: 20, radiusKm: 30 })).items.map((i) => i.id);
    expect(ids.indexOf(sooner.request.id)).toBeLessThan(ids.indexOf(later.request.id));
    // Sans échéance en DERNIER : autrement, les demandes sans date occuperaient
    // tout l'encadré et masqueraient celles qui pressent.
    expect(ids.indexOf(later.request.id)).toBeLessThan(ids.indexOf(undated.request.id));
  });

  // ══ Demande issue d'un parcours (§2.5) ════════════════════════════════════

  it('hérite l’échéance de l’étape et n’expose JAMAIS le titre personnel du parcours', async () => {
    const author = await newMember();
    const stepDueDate = new Date(Date.now() + 12 * 86_400_000);
    const personalTitle = 'Mon projet secret à moi';

    const template = await prisma.journeyTemplate.create({
      data: {
        id: newId(),
        code: `test-help-${Date.now()}`,
        nameFr: 'Études',
        targetPhase: 'PRE_DEPARTURE',
        isActive: true,
        sortOrder: 900,
      },
    });
    journeyFixture.templateId = template.id;
    const version = await prisma.journeyTemplateVersion.create({
      data: { id: newId(), templateId: template.id, version: 1, status: 'PUBLISHED' },
    });
    journeyFixture.versionId = version.id;
    const definition = await prisma.stepDefinition.create({
      data: {
        id: newId(),
        code: `test-help-step-${Date.now()}`,
        nameFr: 'Logement',
        category: 'ARRIVAL',
        blockerTarget: 'HELP',
        isMajorMilestone: false,
        isRisky: false,
        documentChecklist: [],
      },
    });
    journeyFixture.stepDefinitionId = definition.id;
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: author.userId },
      select: { originCountryId: true },
    });
    const journey = await prisma.journey.create({
      data: {
        id: newId(),
        ownerUserId: author.userId,
        templateVersionId: version.id,
        title: personalTitle,
        status: 'ACTIVE',
        originCountryId: user.originCountryId,
        destinationCityId: cityA.id,
        lastActivityAt: new Date(),
      },
    });
    journeyFixture.journeyId = journey.id;
    const step = await prisma.journeyStep.create({
      data: {
        id: newId(),
        journeyId: journey.id,
        stepDefinitionId: definition.id,
        title: 'Trouver un logement',
        position: 1,
        status: 'IN_PROGRESS',
        dueDate: stepDueDate,
      },
    });
    journeyFixture.stepId = step.id;

    const created = await help.create(
      author,
      request({ originJourneyStepId: step.id, title: 'Aide pour le dossier de logement' }),
    );

    // §2.5 : « `due_date` héritée » de l'étape, sans que le membre la ressaisisse.
    expect(created.request.dueDate?.toISOString().slice(0, 10)).toBe(
      stepDueDate.toISOString().slice(0, 10),
    );
    expect(created.request.fromJourney).toBe(true);

    // La ligne de contexte porte le TYPE de parcours, jamais son titre personnel
    // (§2.5 et règle dure 04 §2).
    expect(created.journeyContext).not.toBeNull();
    expect(created.journeyContext?.stepName).toBe('Logement');
    expect(created.journeyContext?.journeyTypeName).toBe('Études');
    expect(created.journeyContext?.dueInDays).toBeGreaterThan(0);
    expect(JSON.stringify(created)).not.toContain(personalTitle);

    // L'événement publié porte l'étape : le module 03 en a besoin pour l'activité
    // HELP_RECEIVED et la proposition « marquer l'étape comme franchie ? ».
    const event = await prisma.domainEvent.findFirstOrThrow({
      where: { aggregateId: created.request.id, type: 'help_request.published' },
    });
    expect(JSON.stringify(event.payload)).toContain(step.id);

    // Une étape qui n'est pas la MIENNE donne 404 — et non 403 : essayer des
    // identifiants ne doit pas dire lesquels existent.
    const stranger = await newMember();
    await expect(
      help.create(stranger, request({ originJourneyStepId: step.id })),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    // Et « Vous pouvez aider » propose la demande à qui a franchi cette étape,
    // même sans l'avoir déclarée dans ses types d'aide (§2.6).
    const veteran = await newMember();
    const veteranUser = await prisma.user.findUniqueOrThrow({
      where: { id: veteran.userId },
      select: { originCountryId: true },
    });
    const veteranJourney = await prisma.journey.create({
      data: {
        id: newId(),
        ownerUserId: veteran.userId,
        templateVersionId: version.id,
        title: 'Un autre parcours personnel',
        status: 'ACTIVE',
        originCountryId: veteranUser.originCountryId,
        destinationCityId: cityA.id,
        lastActivityAt: new Date(),
      },
    });
    await prisma.journeyStep.create({
      data: {
        id: newId(),
        journeyId: veteranJourney.id,
        stepDefinitionId: definition.id,
        title: 'Trouver un logement',
        position: 1,
        status: 'DONE',
        completedAt: new Date(),
      },
    });

    const suggested = await help.canHelp(veteran, { limit: 20, radiusKm: 30 });
    expect(suggested.items.map((i) => i.id)).toContain(created.request.id);
  });

  // ══ Réponse privée (§2.3) ═════════════════════════════════════════════════

  it('ouvre une conversation directe, puis la retrouve sans la dupliquer', async () => {
    const author = await newMember();
    const reader = await newMember();
    const created = await help.create(author, request());

    const opened = await help.privateReply(reader, created.request.id);
    createdConversationIds.push(opened.conversationId);
    expect(opened.created).toBe(true);

    const again = await help.privateReply(reader, created.request.id);
    expect(again.conversationId).toBe(opened.conversationId);
    expect(again.created).toBe(false);

    const members = await prisma.conversationMember.findMany({
      where: { conversationId: opened.conversationId },
      select: { userId: true },
    });
    expect(members.map((m) => m.userId).sort()).toEqual([author.userId, reader.userId].sort());

    // §2.3 : la réponse privée n'est PAS comptée dans `response_count`.
    expect(
      (await prisma.helpRequest.findUniqueOrThrow({ where: { id: created.request.id } }))
        .responseCount,
    ).toBe(0);

    // Et l'auteur ne s'écrit pas à lui-même.
    await expect(help.privateReply(author, created.request.id)).rejects.toMatchObject({
      code: 'OWN_REQUEST',
    });
  });

  // ══ Modération : un contenu masqué disparaît des listes (§6) ═══════════════

  it('retire des listes une demande masquée par la modération, sauf pour son auteur', async () => {
    const author = await newMember();
    const reader = await newMember();
    const created = await help.create(author, request());
    await prisma.helpRequest.update({
      where: { id: created.request.id },
      data: { moderationStatus: 'FLAGGED' },
    });

    expect(
      (await help.list(reader, helpListQuerySchema.parse({}))).items.map((i) => i.id),
    ).not.toContain(created.request.id);
    await expect(help.detail(reader, created.request.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    // L'auteur, lui, doit comprendre pourquoi sa demande ne paraît plus.
    await expect(help.detail(author, created.request.id)).resolves.toBeDefined();
  });

  // ══ Sérialisation (T4 §6) ═════════════════════════════════════════════════

  it('ne renvoie jamais de téléphone ni d’email avec l’auteur', async () => {
    const author = await newMember();
    const created = await help.create(author, request());
    const serialized = JSON.stringify(await help.detail(author, created.request.id));

    for (const forbidden of ['phoneEncrypted', 'phoneNumbers', 'email', 'phoneHash']) {
      expect(serialized).not.toContain(forbidden);
    }
    // Ni le plan du membre : l'entraide ne le lit jamais (règle dure 14 §2).
    expect(serialized).not.toContain('"plan"');
  });
});
