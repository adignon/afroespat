import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import {
  GUIDE_DAILY_PUBLISH_LIMIT,
  GUIDE_NEGATIVE_VOTE_THRESHOLD,
  GUIDE_PENDING_PROPOSAL_LIMIT,
  computeFreshnessScore,
  freshnessCoefficient,
  guideDraftBodySchema,
  monthsSince,
  slugifyGuideTitle,
} from '@app/shared';
import { AuditService } from '../../../common/audit.service';
import { OutboxService } from '../../../common/outbox.service';
import { PrismaService } from '../../../common/prisma.service';
import { VisibilityService } from '../../../common/visibility.service';
import { FakeAiModerationProvider } from '../../../providers/providers';
import { GuidesService } from '../guides.service';

/**
 * Guides et démarches — 05-guides.md §9.
 *
 * Chaque RÈGLE DURE du §9 a ici son test, et chacun porte un CONTRE-EXEMPLE :
 * une assertion qui passerait aussi si la règle était absente ne vaut rien. Le
 * test de la règle 1, par exemple, vérifie d'abord que le guide EST dans la
 * liste, puis qu'il en sort — sans le premier point, une liste vide suffirait à
 * faire passer le second.
 *
 * Les tests appellent le SERVICE, comme ceux du module 01 : les capacités et les
 * niveaux sont l'affaire du garde, que `capability-coverage.int.test.ts` éprouve
 * route par route.
 */
describe('guides (05 §2, §7, §8, §9)', () => {
  let prisma: PrismaService;
  let guides: GuidesService;

  const userIds: string[] = [];
  const guideIds: string[] = [];
  const journeyIds: string[] = [];
  const templateIds: string[] = [];
  const stepDefinitionIds: string[] = [];

  let countryId: string;
  let otherCountryId: string;
  let cityId: string;
  let counter = 0;

  /** Un corps publiable : plus de 300 caractères, et rien que la modération fictive n'attrape. */
  function body(topic: string): string {
    // Les apostrophes sont TYPOGRAPHIQUES, ici comme dans les passages visés par
    // les propositions : `indexOf` ne pardonne pas la différence, et un test qui
    // cherche « l’ouverture » dans un corps écrit « l'ouverture » échouerait sur la
    // ponctuation en faisant croire à un bogue de la règle.
    return (
      `## ${topic}\n\n` +
      `Voici la démarche telle que je l’ai vécue, étape par étape, avec les pièces ` +
      `demandées et les délais constatés. Le guichet ouvre tôt le matin et la file ` +
      `s’allonge vite : venez avant l’ouverture. Prévoyez deux photocopies de chaque ` +
      `pièce, la salle n’a pas de photocopieur. Comptez trois semaines entre le dépôt ` +
      `du dossier et la réponse écrite, parfois davantage en période de rentrée.\n\n` +
      `### Ce qui m’a fait perdre du temps\n\nJ’ai commencé par la mauvaise adresse.`
    );
  }

  async function newMember(iso2Country = countryId): Promise<string> {
    counter += 1;
    const id = newId();
    await prisma.user.create({
      data: {
        id,
        handle: `guide-t${Date.now().toString(36)}-${counter}`,
        displayName: `Membre ${counter}`,
        phase: 'SETTLED',
        // L1 : le niveau qu'exigent `guide.write`, `guide.vote` et
        // `guide.propose_revision` (00 §7.3). Le garde le vérifie, pas le service.
        verificationLevel: 'L1',
        originCountryId: iso2Country,
        plan: 'FREE',
        status: 'ACTIVE',
        lastSeenAt: new Date(),
      },
    });
    userIds.push(id);
    return id;
  }

  /** Un guide publié, prêt à être voté, signalé ou corrigé. */
  async function publishedGuide(
    authorId: string,
    options: { title?: string; scope?: 'UNIVERSAL' | 'COUNTRY'; bodyText?: string } = {},
  ) {
    counter += 1;
    const draft = await guides.createDraft(authorId, {
      title: options.title ?? `Obtenir son titre de séjour ${counter}`,
      body: options.bodyText ?? body('La démarche'),
      category: 'ARRIVAL',
      scope: options.scope ?? 'UNIVERSAL',
      ...(options.scope === 'COUNTRY' ? { originCountryId: countryId } : {}),
    });
    guideIds.push(draft.id);
    await guides.publish(authorId, draft.id);
    return draft;
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    guides = new GuidesService(
      prisma,
      new OutboxService(prisma),
      new AuditService(prisma),
      new VisibilityService(prisma),
      new FakeAiModerationProvider(),
    );

    const origin = await prisma.country.findFirstOrThrow({
      where: { kind: { in: ['ORIGIN', 'BOTH'] }, isActive: true },
      select: { id: true },
    });
    countryId = origin.id;
    const other = await prisma.country.findFirstOrThrow({
      where: { id: { not: countryId }, isActive: true },
      select: { id: true },
    });
    otherCountryId = other.id;
    const city = await prisma.city.findFirstOrThrow({
      where: { mergedIntoCityId: null },
      select: { id: true },
    });
    cityId = city.id;
  });

  afterAll(async () => {
    // Les guides d'abord : `guides.author_user_id` est en `SET NULL`, donc
    // supprimer les membres laisserait des guides anonymes derrière nous.
    if (guideIds.length > 0) {
      await prisma.moderationCase.deleteMany({ where: { subjectId: { in: guideIds } } });
      await prisma.guide.deleteMany({ where: { id: { in: guideIds } } });
    }
    if (journeyIds.length > 0) {
      await prisma.journey.deleteMany({ where: { id: { in: journeyIds } } });
    }
    if (templateIds.length > 0) {
      await prisma.journeyTemplateVersion.deleteMany({ where: { templateId: { in: templateIds } } });
      await prisma.journeyTemplate.deleteMany({ where: { id: { in: templateIds } } });
    }
    if (stepDefinitionIds.length > 0) {
      await prisma.stepDefinition.deleteMany({ where: { id: { in: stepDefinitionIds } } });
    }
    if (userIds.length > 0) {
      await prisma.guide.deleteMany({ where: { authorUserId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // RÈGLE DURE — « un guide FLAGGED depuis plus de 30 jours ou UNPUBLISHED
  // n'est renvoyé dans aucune liste publique » (§2.6, §9)
  // ══════════════════════════════════════════════════════════════════════════

  it('retire des listes publiques un guide UNPUBLISHED, et un FLAGGED dont le délai est écoulé', async () => {
    const author = await newMember();
    const reader = await newMember();
    const guide = await publishedGuide(author);

    const inList = async (tab: 'helpful' | 'recent' | 'review') => {
      const page = await guides.list({ tab, limit: 50 }, reader);
      return page.items.some((item) => item.id === guide.id);
    };

    // Le contre-exemple : sans lui, une liste vide ferait passer la suite.
    expect(await inList('recent')).toBe(true);

    // FLAGGED, délai en COURS : le guide RESTE visible — §2.3 le veut dans
    // l'onglet « À vérifier », avec son bandeau.
    await prisma.guide.update({
      where: { id: guide.id },
      data: {
        status: 'FLAGGED',
        outdatedFlagCount: 3,
        unpublishDeadlineAt: new Date(Date.now() + 10 * 86_400_000),
      },
    });
    expect(await inList('recent')).toBe(true);
    expect(await inList('review')).toBe(true);
    const flagged = await guides.bySlug(guide.slug, reader);
    expect(flagged.guide.banners.map((b) => b.kind)).toContain('OUTDATED_REPORTED');

    // FLAGGED depuis plus de 30 jours : le délai est écoulé, la tâche de nuit
    // n'a pas encore tourné — la LISTE doit déjà le taire.
    await prisma.guide.update({
      where: { id: guide.id },
      data: { unpublishDeadlineAt: new Date(Date.now() - 86_400_000) },
    });
    expect(await inList('recent')).toBe(false);
    expect(await inList('helpful')).toBe(false);
    expect(await inList('review')).toBe(false);
    await expect(guides.bySlug(guide.slug, reader)).rejects.toMatchObject({ code: 'NOT_FOUND' });

    // UNPUBLISHED : nulle part non plus.
    await prisma.guide.update({
      where: { id: guide.id },
      data: { status: 'UNPUBLISHED', unpublishDeadlineAt: null },
    });
    expect(await inList('recent')).toBe(false);
    expect(await inList('review')).toBe(false);
    // Mais son auteur le retrouve : §2.6 le lui conserve « en brouillon ».
    const asAuthor = await guides.bySlug(guide.slug, author);
    expect(asAuthor.guide.status).toBe('UNPUBLISHED');
  });

  it('ne renvoie jamais un brouillon à un autre membre', async () => {
    const author = await newMember();
    const reader = await newMember();
    const draft = await guides.createDraft(author, {
      title: 'Ouvrir un compte bancaire sans fiche de paie',
      body: body('Le compte bancaire'),
      category: 'DAILY_LIFE',
      scope: 'UNIVERSAL',
    });
    guideIds.push(draft.id);

    await expect(guides.bySlug(draft.slug, reader)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const page = await guides.list({ tab: 'recent', limit: 50 }, reader);
    expect(page.items.some((item) => item.id === draft.id)).toBe(false);
    // L'auteur, lui, doit pouvoir reprendre son brouillon.
    expect((await guides.bySlug(draft.slug, author)).guide.id).toBe(draft.id);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // RÈGLE DURE — « le vote négatif ne modifie ni helpful_count ni
  // freshness_score » (§2.2, §9)
  // ══════════════════════════════════════════════════════════════════════════

  it('ne touche ni helpful_count ni freshness_score sur un vote négatif', async () => {
    const author = await newMember();
    const guide = await publishedGuide(author);

    // D'abord un vote POSITIF, pour que les compteurs ne soient pas à zéro :
    // sinon « inchangé » et « zéro » seraient indistinguables.
    const yes = await newMember();
    await guides.vote(yes, guide.id, 'HELPFUL');
    const after = await prisma.guide.findUniqueOrThrow({
      where: { id: guide.id },
      select: { helpfulCount: true, freshnessScore: true },
    });
    expect(after.helpfulCount).toBe(1);
    expect(after.freshnessScore.toNumber()).toBeGreaterThan(0);

    for (let i = 0; i < 3; i += 1) {
      const voter = await newMember();
      await guides.vote(voter, guide.id, 'NOT_HELPFUL');
    }

    const afterNegatives = await prisma.guide.findUniqueOrThrow({
      where: { id: guide.id },
      select: { helpfulCount: true, freshnessScore: true },
    });
    expect(afterNegatives.helpfulCount).toBe(1);
    expect(afterNegatives.freshnessScore.toNumber()).toBe(after.freshnessScore.toNumber());
    // Et aucune réputation pour un vote négatif (§2.2).
    expect(
      await prisma.reputationEvent.count({
        where: { userId: author, type: 'GUIDE_HELPFUL_VOTE' },
      }),
    ).toBe(1);
  });

  it('crée puis retire le reputation_event avec le vote (§2.2)', async () => {
    const author = await newMember();
    const voter = await newMember();
    const guide = await publishedGuide(author);

    await guides.vote(voter, guide.id, 'HELPFUL');
    expect(
      await prisma.reputationEvent.count({
        where: { userId: author, type: 'GUIDE_HELPFUL_VOTE' },
      }),
    ).toBe(1);

    await guides.removeVote(voter, guide.id);
    expect(
      await prisma.reputationEvent.count({
        where: { userId: author, type: 'GUIDE_HELPFUL_VOTE' },
      }),
    ).toBe(0);
    const after = await prisma.guide.findUniqueOrThrow({
      where: { id: guide.id },
      select: { helpfulCount: true },
    });
    expect(after.helpfulCount).toBe(0);
  });

  it('bascule d’un vote positif à un vote négatif en décrémentant une seule fois', async () => {
    const author = await newMember();
    const voter = await newMember();
    const guide = await publishedGuide(author);

    await guides.vote(voter, guide.id, 'HELPFUL');
    await guides.vote(voter, guide.id, 'NOT_HELPFUL');
    // Un second appel identique ne doit rien changer : il est idempotent.
    await guides.vote(voter, guide.id, 'NOT_HELPFUL');

    const after = await prisma.guide.findUniqueOrThrow({
      where: { id: guide.id },
      select: { helpfulCount: true },
    });
    expect(after.helpfulCount).toBe(0);
    expect(await prisma.guideVote.count({ where: { guideId: guide.id } })).toBe(1);
  });

  it('refuse le vote sur son propre guide', async () => {
    const author = await newMember();
    const guide = await publishedGuide(author);
    await expect(guides.vote(author, guide.id, 'HELPFUL')).rejects.toMatchObject({
      code: 'OWN_GUIDE',
    });
  });

  it('ouvre un dossier AUTO_RULE à cinq votes négatifs en sept jours (§2.2)', async () => {
    const author = await newMember();
    const guide = await publishedGuide(author);

    for (let i = 0; i < GUIDE_NEGATIVE_VOTE_THRESHOLD - 1; i += 1) {
      const voter = await newMember();
      await guides.vote(voter, guide.id, 'NOT_HELPFUL');
    }
    // Quatre ne suffisent pas : le seuil est à cinq.
    expect(
      await prisma.moderationCase.count({
        where: { subjectType: 'GUIDE', subjectId: guide.id, source: 'AUTO_RULE' },
      }),
    ).toBe(0);

    const fifth = await newMember();
    await guides.vote(fifth, guide.id, 'NOT_HELPFUL');

    const cases = await prisma.moderationCase.findMany({
      where: { subjectType: 'GUIDE', subjectId: guide.id, source: 'AUTO_RULE' },
      select: { priority: true, status: true },
    });
    expect(cases).toHaveLength(1);
    expect(cases[0]?.priority).toBe(4);

    // Un sixième vote négatif n'ouvre pas un second dossier.
    const sixth = await newMember();
    await guides.vote(sixth, guide.id, 'NOT_HELPFUL');
    expect(
      await prisma.moderationCase.count({
        where: { subjectType: 'GUIDE', subjectId: guide.id, source: 'AUTO_RULE' },
      }),
    ).toBe(1);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // RÈGLE DURE — « une proposition sans décision à 14 jours est escaladée »
  // (§2.4, §9)
  // ══════════════════════════════════════════════════════════════════════════

  it('escalade une proposition sans décision au bout de 14 jours, et pas avant', async () => {
    const author = await newMember();
    const proposer = await newMember();
    const guide = await publishedGuide(author);
    const excerpt = 'Le guichet ouvre tôt le matin';

    const proposal = await guides.createProposal(proposer, guide.id, {
      targetExcerpt: excerpt,
      replacement: 'Le guichet ouvre désormais à 9 h',
      reason: 'Les horaires ont changé au 1er septembre, vérifié sur place.',
    });

    // L'échéance est bien à quatorze jours (§2.4).
    const days = (proposal.escalateAt.getTime() - proposal.createdAt.getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(14);

    // Contre-exemple : la tâche ne doit RIEN escalader tant que le délai court.
    expect(await guides.escalateStaleProposals()).toEqual({ escalated: 0 });
    expect(
      (await prisma.guideRevisionProposal.findUniqueOrThrow({ where: { id: proposal.id } })).status,
    ).toBe('PENDING');

    await prisma.guideRevisionProposal.update({
      where: { id: proposal.id },
      data: { escalateAt: new Date(Date.now() - 86_400_000) },
    });
    const result = await guides.escalateStaleProposals();
    expect(result.escalated).toBeGreaterThanOrEqual(1);

    const escalated = await prisma.guideRevisionProposal.findUniqueOrThrow({
      where: { id: proposal.id },
    });
    expect(escalated.status).toBe('ESCALATED');
    // §2.4 : dossier de modération, priorité 3 — l'équipe décide à la place du
    // créateur.
    const cases = await prisma.moderationCase.findMany({
      where: { subjectType: 'GUIDE', subjectId: guide.id, priority: 3 },
    });
    expect(cases).toHaveLength(1);
    expect(
      await prisma.domainEvent.count({
        where: { type: 'guide.proposal_escalated', aggregateId: proposal.id },
      }),
    ).toBe(1);

    // Et le créateur ne peut plus décider : l'équipe a la main.
    await expect(
      guides.decideProposal(author, proposal.id, { kind: 'ACCEPT' }),
    ).rejects.toMatchObject({ code: 'ALREADY_DECIDED' });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // RÈGLE DURE — « l'acceptation d'une proposition crée une version et crédite
  // le contributeur » (§2.4, §9)
  // ══════════════════════════════════════════════════════════════════════════

  it('crée une version et crédite le contributeur à l’acceptation', async () => {
    const author = await newMember();
    const proposer = await newMember();
    const guide = await publishedGuide(author);
    const before = await prisma.guide.findUniqueOrThrow({
      where: { id: guide.id },
      select: { lastContentUpdateAt: true, currentVersionId: true },
    });

    const proposal = await guides.createProposal(proposer, guide.id, {
      targetExcerpt: 'Comptez trois semaines',
      replacement: 'Comptez cinq semaines',
      reason: 'Le délai a doublé depuis la réforme du printemps.',
      sourceUrl: 'https://example.org/reforme',
    });

    await guides.decideProposal(author, proposal.id, { kind: 'ACCEPT' });

    const after = await prisma.guide.findUniqueOrThrow({
      where: { id: guide.id },
      include: { currentVersion: true, contributors: true },
    });
    // Nouvelle version, et l'ancienne conservée : la table est en ajout seul.
    expect(await prisma.guideVersion.count({ where: { guideId: guide.id } })).toBe(2);
    expect(after.currentVersionId).not.toBe(before.currentVersionId);
    expect(after.currentVersion?.version).toBe(2);
    expect(after.currentVersion?.sourceProposalId).toBe(proposal.id);
    // L'auteur de la VERSION est le proposant : c'est son travail que
    // l'historique public montre (§2.7), même si le créateur a décidé.
    expect(after.currentVersion?.createdByUserId).toBe(proposer);
    expect(after.currentVersion?.body).toContain('Comptez cinq semaines');
    expect(after.currentVersion?.body).not.toContain('Comptez trois semaines');

    // Le contributeur est crédité, et sa réputation aussi (§2.4).
    expect(after.contributors).toHaveLength(1);
    expect(after.contributors[0]?.userId).toBe(proposer);
    expect(after.contributors[0]?.acceptedCount).toBe(1);
    expect(
      await prisma.reputationEvent.count({
        where: { userId: proposer, type: 'GUIDE_CONTRIBUTION', sourceId: proposal.id },
      }),
    ).toBe(1);

    // §2.3 : le guide remonte — sa date de contenu a bougé.
    expect(after.lastContentUpdateAt.getTime()).toBeGreaterThan(
      before.lastContentUpdateAt.getTime(),
    );
  });

  it('crédite le contributeur même quand le créateur MODIFIE son texte', async () => {
    const author = await newMember();
    const proposer = await newMember();
    const guide = await publishedGuide(author);

    const proposal = await guides.createProposal(proposer, guide.id, {
      targetExcerpt: 'la file s’allonge vite',
      replacement: 'la file est très longue',
      reason: 'La formulation actuelle laisse penser qu’il n’y a jamais foule.',
    });
    await guides.decideProposal(author, proposal.id, {
      kind: 'AMEND',
      replacement: 'la file s’allonge dès 7 h',
    });

    const after = await prisma.guide.findUniqueOrThrow({
      where: { id: guide.id },
      include: { currentVersion: true, contributors: true },
    });
    expect(after.currentVersion?.body).toContain('la file s’allonge dès 7 h');
    // « Accepter en modifiant » crédite quand même : la version reste signée du
    // proposant, et la décision est tracée sur la proposition.
    expect(after.currentVersion?.createdByUserId).toBe(proposer);
    expect(
      (await prisma.guideRevisionProposal.findUniqueOrThrow({ where: { id: proposal.id } }))
        .reviewerUserId,
    ).toBe(author);
    expect(
      (await prisma.guideRevisionProposal.findUniqueOrThrow({ where: { id: proposal.id } })).status,
    ).toBe('AMENDED');
    // « contributeur crédité quand même » (§2.4).
    expect(after.contributors[0]?.userId).toBe(proposer);
    expect(
      await prisma.reputationEvent.count({
        where: { userId: proposer, type: 'GUIDE_CONTRIBUTION', sourceId: proposal.id },
      }),
    ).toBe(1);
  });

  it('refuse une proposition avec motif, sans créer de version ni de crédit', async () => {
    const author = await newMember();
    const proposer = await newMember();
    const guide = await publishedGuide(author);

    const proposal = await guides.createProposal(proposer, guide.id, {
      targetExcerpt: 'venez avant l’ouverture',
      replacement: 'venez à midi',
      reason: 'Je crois que le guichet est plus calme en milieu de journée.',
    });
    await guides.decideProposal(author, proposal.id, {
      kind: 'REJECT',
      reason: 'L’après-midi le guichet est fermé au public.',
    });

    const rejected = await prisma.guideRevisionProposal.findUniqueOrThrow({
      where: { id: proposal.id },
    });
    expect(rejected.status).toBe('REJECTED');
    expect(rejected.rejectReason).toContain('fermé');
    expect(await prisma.guideVersion.count({ where: { guideId: guide.id } })).toBe(1);
    expect(await prisma.guideContributor.count({ where: { guideId: guide.id } })).toBe(0);
    expect(
      await prisma.reputationEvent.count({
        where: { userId: proposer, type: 'GUIDE_CONTRIBUTION' },
      }),
    ).toBe(0);
    // Une seconde décision n'est plus possible.
    await expect(
      guides.decideProposal(author, proposal.id, { kind: 'ACCEPT' }),
    ).rejects.toMatchObject({ code: 'ALREADY_DECIDED' });
  });

  it('n’accepte une proposition que par l’auteur du guide', async () => {
    const author = await newMember();
    const proposer = await newMember();
    const stranger = await newMember();
    const guide = await publishedGuide(author);

    const proposal = await guides.createProposal(proposer, guide.id, {
      targetExcerpt: 'deux photocopies',
      replacement: 'trois photocopies',
      reason: 'Le guichet en demande une de plus depuis cet été.',
    });
    await expect(
      guides.decideProposal(stranger, proposal.id, { kind: 'ACCEPT' }),
    ).rejects.toMatchObject({ code: 'NOT_AUTHOR' });
    // Le proposant lui-même ne peut pas s'auto-accepter.
    await expect(
      guides.decideProposal(proposer, proposal.id, { kind: 'ACCEPT' }),
    ).rejects.toMatchObject({ code: 'NOT_AUTHOR' });
  });

  it('exige un passage présent exactement une fois (§2.4)', async () => {
    const author = await newMember();
    const proposer = await newMember();
    // Un corps où « le dossier » apparaît DEUX fois : le remplacement serait
    // ambigu, et corriger « la première occurrence » toucherait un passage que
    // le proposant n'a pas lu.
    const guide = await publishedGuide(author, {
      bodyText:
        body('Le dossier') +
        '\n\nLe guichet vérifie le dossier, puis le dossier repart par courrier.',
    });

    await expect(
      guides.createProposal(proposer, guide.id, {
        targetExcerpt: 'le dossier',
        replacement: 'la demande',
        reason: 'Le mot dossier est employé de deux manières différentes ici.',
      }),
    ).rejects.toMatchObject({ code: 'EXCERPT_NOT_FOUND' });

    await expect(
      guides.createProposal(proposer, guide.id, {
        targetExcerpt: 'un passage qui n’existe pas dans ce guide',
        replacement: 'autre chose',
        reason: 'Je copie un passage que j’ai lu sur une version précédente.',
      }),
    ).rejects.toMatchObject({ code: 'EXCERPT_NOT_FOUND' });
  });

  it('revérifie le passage au moment de la DÉCISION, pas seulement à la proposition', async () => {
    const author = await newMember();
    const first = await newMember();
    const second = await newMember();
    const guide = await publishedGuide(author);

    const a = await guides.createProposal(first, guide.id, {
      targetExcerpt: 'trois semaines entre le dépôt',
      replacement: 'quatre semaines entre le dépôt',
      reason: 'Constaté en juillet, le délai s’allonge un peu.',
    });
    const b = await guides.createProposal(second, guide.id, {
      targetExcerpt: 'trois semaines entre le dépôt',
      replacement: 'six semaines entre le dépôt',
      reason: 'Constaté en septembre, le délai s’allonge beaucoup.',
    });

    await guides.decideProposal(author, a.id, { kind: 'ACCEPT' });
    // Le passage de `b` a disparu du corps courant : l'accepter écrirait à
    // l'aveugle. Le service refuse au lieu de produire un texte faux.
    await expect(guides.decideProposal(author, b.id, { kind: 'ACCEPT' })).rejects.toMatchObject({
      code: 'EXCERPT_NOT_FOUND',
    });
    const after = await prisma.guide.findUniqueOrThrow({
      where: { id: guide.id },
      include: { currentVersion: true },
    });
    expect(after.currentVersion?.body).toContain('quatre semaines');
    expect(after.currentVersion?.body).not.toContain('six semaines');
  });

  it('limite à trois propositions en attente par membre et par guide', async () => {
    const author = await newMember();
    const proposer = await newMember();
    const guide = await publishedGuide(author);
    const excerpts = ['deux photocopies', 'le matin', 'de rentrée'];

    for (const excerpt of excerpts.slice(0, GUIDE_PENDING_PROPOSAL_LIMIT)) {
      await guides.createProposal(proposer, guide.id, {
        targetExcerpt: excerpt,
        replacement: `${excerpt} (corrigé)`,
        reason: 'Précision utile pour qui découvre cette démarche de loin.',
      });
    }

    await expect(
      guides.createProposal(proposer, guide.id, {
        targetExcerpt: 'photocopieur',
        replacement: 'photocopieuse',
        reason: 'Une coquille sans importance, mais autant la corriger.',
      }),
    ).rejects.toMatchObject({ code: 'PROPOSAL_LIMIT' });

    // Un AUTRE membre n'est pas bloqué : la limite est par membre.
    const other = await newMember();
    await expect(
      guides.createProposal(other, guide.id, {
        targetExcerpt: 'photocopieur',
        replacement: 'photocopieuse',
        reason: 'Une coquille sans importance, mais autant la corriger.',
      }),
    ).resolves.toBeDefined();
  });

  it('refuse une proposition sur son propre guide', async () => {
    const author = await newMember();
    const guide = await publishedGuide(author);
    await expect(
      guides.createProposal(author, guide.id, {
        targetExcerpt: 'le matin',
        replacement: 'tôt le matin',
        reason: 'Je veux préciser l’heure exacte d’ouverture du guichet.',
      }),
    ).rejects.toMatchObject({ code: 'OWN_GUIDE' });
  });

  it('envoie directement en modération les propositions sur un guide communautaire (§2.4)', async () => {
    const author = await newMember();
    const proposer = await newMember();
    const guide = await publishedGuide(author);
    await prisma.guide.update({ where: { id: guide.id }, data: { maintainedByCommunity: true } });

    const proposal = await guides.createProposal(proposer, guide.id, {
      targetExcerpt: 'le matin',
      replacement: 'dès 8 h',
      reason: 'L’heure précise manque et c’est ce que tout le monde cherche.',
    });
    expect(proposal.status).toBe('ESCALATED');
    expect(
      await prisma.moderationCase.count({
        where: { subjectType: 'GUIDE', subjectId: guide.id, priority: 3 },
      }),
    ).toBe(1);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // RÈGLE DURE — « le mot certifié est rejeté dans un titre de guide »
  // (§2.1, §9)
  // ══════════════════════════════════════════════════════════════════════════

  it('rejette « certifié » et ses dérivés dans un titre, mais pas dans le corps', async () => {
    const author = await newMember();

    for (const title of [
      'Traducteur certifié : comment le trouver',
      'La CERTIFICATION de vos diplômes',
      'Faire certifier une copie',
      'Traducteur certifiée à Paris',
    ]) {
      await expect(
        guides.createDraft(author, {
          title,
          body: body('Les traductions'),
          category: 'ARRIVAL',
          scope: 'UNIVERSAL',
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN_WORD' });
    }

    // Le CORPS peut citer un document officiel : « certificat » est épargné, et
    // c'est explicitement ce que §2.1 autorise.
    const ok = await guides.createDraft(author, {
      title: 'Faire traduire ses diplômes en France',
      body: `${body('Les traductions')}\n\nDemandez un certificat de scolarité certifié conforme.`,
      category: 'ARRIVAL',
      scope: 'UNIVERSAL',
    });
    guideIds.push(ok.id);
    expect(ok.title).toBe('Faire traduire ses diplômes en France');

    // Et un titre contenant « certificat » passe : c'est un document réel.
    const document = await guides.createDraft(author, {
      title: 'Obtenir un certificat de résidence',
      body: body('Le certificat'),
      category: 'ARRIVAL',
      scope: 'UNIVERSAL',
    });
    guideIds.push(document.id);
    expect(document.id).toBeDefined();
  });

  it('refuse aussi « certifié » sur une modification de titre', async () => {
    const author = await newMember();
    const draft = await guides.createDraft(author, {
      title: 'Trouver un traducteur à Paris',
      body: body('Les traductions'),
      category: 'ARRIVAL',
      scope: 'UNIVERSAL',
    });
    guideIds.push(draft.id);
    await expect(
      guides.update(author, draft.id, { title: 'Trouver un traducteur certifié' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN_WORD' });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // RÈGLE DURE — « la suppression du compte anonymise les guides publiés au lieu
  // de les supprimer » (§8, §9)
  // ══════════════════════════════════════════════════════════════════════════

  it('anonymise les guides publiés, supprime les brouillons, retire les votes', async () => {
    const author = await newMember();
    const otherAuthor = await newMember();

    const published = await publishedGuide(author, { title: 'Ma démarche au guichet unique' });
    const draft = await guides.createDraft(author, {
      title: 'Un brouillon jamais publié',
      body: body('Un brouillon'),
      category: 'DAILY_LIFE',
      scope: 'UNIVERSAL',
    });
    guideIds.push(draft.id);

    // Le membre supprimé avait voté sur le guide d'un autre : le compteur de
    // celui-là doit redescendre (§8).
    const otherGuide = await publishedGuide(otherAuthor, { title: 'La démarche vue d’ailleurs' });
    await guides.vote(author, otherGuide.id, 'HELPFUL');
    expect(
      (await prisma.guide.findUniqueOrThrow({ where: { id: otherGuide.id } })).helpfulCount,
    ).toBe(1);

    // Et il avait une proposition en attente.
    const proposal = await guides.createProposal(author, otherGuide.id, {
      targetExcerpt: 'le matin',
      replacement: 'très tôt le matin',
      reason: 'Le guichet ouvre bien plus tôt que ce que dit le guide.',
    });

    const result = await guides.handleUserDeleted(author);
    expect(result.anonymised).toBe(1);
    expect(result.draftsDeleted).toBe(1);

    // Le guide publié est CONSERVÉ, sans auteur, maintenu par la communauté.
    const kept = await prisma.guide.findUnique({ where: { id: published.id } });
    expect(kept).not.toBeNull();
    expect(kept?.authorUserId).toBeNull();
    expect(kept?.maintainedByCommunity).toBe(true);
    expect(kept?.status).toBe('PUBLISHED');
    // Les versions sont conservées, anonymisées.
    const versions = await prisma.guideVersion.findMany({ where: { guideId: published.id } });
    expect(versions.length).toBeGreaterThanOrEqual(1);
    expect(versions.every((v) => v.createdByUserId === null)).toBe(true);

    // Le brouillon a disparu.
    expect(await prisma.guide.findUnique({ where: { id: draft.id } })).toBeNull();

    // Vote supprimé, compteur décrémenté, réputation de l'autre auteur ajustée.
    expect(
      (await prisma.guide.findUniqueOrThrow({ where: { id: otherGuide.id } })).helpfulCount,
    ).toBe(0);
    expect(
      await prisma.reputationEvent.count({
        where: { userId: otherAuthor, type: 'GUIDE_HELPFUL_VOTE' },
      }),
    ).toBe(0);

    // Proposition en attente : refusée, motif « compte supprimé » (§8).
    const decided = await prisma.guideRevisionProposal.findUniqueOrThrow({
      where: { id: proposal.id },
    });
    expect(decided.status).toBe('REJECTED');
    expect(decided.rejectReason).toBe('compte supprimé');
  });

  it('garde visible dans les listes un guide anonymisé, même pour un lecteur qui a bloqué quelqu’un', async () => {
    const author = await newMember();
    const reader = await newMember();
    const blocked = await newMember();
    const guide = await publishedGuide(author, { title: 'Une mémoire sans auteur' });

    await guides.handleUserDeleted(author);
    // Le lecteur bloque un TIERS : la liste applique alors un `NOT IN`, et un
    // `author_user_id NOT IN (…)` est FAUX pour NULL en SQL — le guide anonymisé
    // disparaîtrait sans le `OR author_user_id IS NULL`.
    await prisma.block.create({
      data: { id: newId(), blockerUserId: reader, blockedUserId: blocked },
    });

    const page = await guides.list({ tab: 'recent', limit: 50 }, reader);
    expect(page.items.some((item) => item.id === guide.id)).toBe(true);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // RÈGLE DURE — « la date de dernière mise à jour est renvoyée sur chaque
  // guide de liste » (§9)
  // ══════════════════════════════════════════════════════════════════════════

  it('renvoie lastContentUpdateAt sur chaque guide de liste', async () => {
    const author = await newMember();
    const guide = await publishedGuide(author);
    const page = await guides.list({ tab: 'recent', limit: 50 }, author);

    expect(page.items.length).toBeGreaterThan(0);
    for (const item of page.items) {
      expect(item.lastContentUpdateAt).toBeInstanceOf(Date);
      expect(Number.isNaN(item.lastContentUpdateAt.getTime())).toBe(false);
    }
    const mine = page.items.find((item) => item.id === guide.id);
    expect(mine?.lastContentUpdateAt).toBeInstanceOf(Date);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Visibilité (08 §4) — un membre bloqué disparaît dans les deux sens
  // ══════════════════════════════════════════════════════════════════════════

  it('fait disparaître le guide d’un membre bloqué, dans les deux sens', async () => {
    const author = await newMember();
    const reader = await newMember();
    const guide = await publishedGuide(author);

    const visibleFor = async (viewer: string) => {
      const page = await guides.list({ tab: 'recent', limit: 50 }, viewer);
      return page.items.some((item) => item.id === guide.id);
    };
    expect(await visibleFor(reader)).toBe(true);

    await prisma.block.create({
      data: { id: newId(), blockerUserId: reader, blockedUserId: author },
    });

    // Celui qui a bloqué ne retrouve plus le guide…
    expect(await visibleFor(reader)).toBe(false);
    await expect(guides.bySlug(guide.slug, reader)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    // …et il ne peut pas voter dessus : 404, pas 403 (T4 §3).
    await expect(guides.vote(reader, guide.id, 'HELPFUL')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    // L'auteur, de son côté, ne doit pas non plus retrouver le bloqueur par
    // hasard : le blocage est une séparation, pas un filtre à sens unique.
    const authorGuide = await publishedGuide(reader, { title: 'Le guide de celui qui a bloqué' });
    expect(
      (await guides.list({ tab: 'recent', limit: 50 }, author)).items.some(
        (item) => item.id === authorGuide.id,
      ),
    ).toBe(false);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Obsolescence (§2.6)
  // ══════════════════════════════════════════════════════════════════════════

  it('passe en FLAGGED au troisième signalement, avec un délai de 30 jours', async () => {
    const author = await newMember();
    const guide = await publishedGuide(author);

    for (let i = 0; i < 2; i += 1) {
      const member = await newMember();
      const state = await guides.flagOutdated(member, guide.id, 'Les horaires ont changé.');
      // Contre-exemple : deux signalements ne suffisent pas.
      expect(state.status).toBe('PUBLISHED');
    }

    const third = await newMember();
    const state = await guides.flagOutdated(third, guide.id, undefined);
    expect(state.status).toBe('FLAGGED');
    expect(state.outdatedFlagCount).toBe(3);

    const after = await prisma.guide.findUniqueOrThrow({ where: { id: guide.id } });
    expect(after.status).toBe('FLAGGED');
    const days = ((after.unpublishDeadlineAt?.getTime() ?? 0) - Date.now()) / 86_400_000;
    expect(Math.round(days)).toBe(30);
    expect(
      await prisma.domainEvent.count({ where: { type: 'guide.flagged', aggregateId: guide.id } }),
    ).toBe(1);

    // Un membre ne signale qu'une fois.
    await expect(guides.flagOutdated(third, guide.id, undefined)).rejects.toMatchObject({
      code: 'ALREADY_FLAGGED',
    });
  });

  it('rend un guide corrigé à PUBLISHED et remet les signalements à zéro (§2.6)', async () => {
    const author = await newMember();
    const guide = await publishedGuide(author);
    const flaggers: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const member = await newMember();
      flaggers.push(member);
      await guides.flagOutdated(member, guide.id, undefined);
    }
    expect(
      (await prisma.guide.findUniqueOrThrow({ where: { id: guide.id } })).status,
    ).toBe('FLAGGED');

    const proposal = await guides.createProposal(flaggers[0] as string, guide.id, {
      targetExcerpt: 'Le guichet ouvre tôt le matin',
      replacement: 'Le guichet ouvre à 9 h depuis la réforme',
      reason: 'C’est précisément l’information que nous avons signalée comme fausse.',
    });
    await guides.decideProposal(author, proposal.id, { kind: 'ACCEPT' });

    const after = await prisma.guide.findUniqueOrThrow({ where: { id: guide.id } });
    expect(after.status).toBe('PUBLISHED');
    expect(after.outdatedFlagCount).toBe(0);
    expect(after.unpublishDeadlineAt).toBeNull();
    // Les signalements sont archivés — faute de colonne d'archivage, supprimés :
    // un membre doit pouvoir resignaler le jour où l'information rechange.
    expect(await prisma.guideOutdatedFlag.count({ where: { guideId: guide.id } })).toBe(0);
    await expect(
      guides.flagOutdated(flaggers[1] as string, guide.id, undefined),
    ).resolves.toBeDefined();
  });

  it('dépublie un guide signalé dont le délai est dépassé (tâche §2.6)', async () => {
    const author = await newMember();
    const guide = await publishedGuide(author);
    await prisma.guide.update({
      where: { id: guide.id },
      data: {
        status: 'FLAGGED',
        outdatedFlagCount: 3,
        unpublishDeadlineAt: new Date(Date.now() + 5 * 86_400_000),
      },
    });

    // Contre-exemple : la tâche ne dépublie rien tant que le délai court.
    await guides.unpublishOutdated();
    expect((await prisma.guide.findUniqueOrThrow({ where: { id: guide.id } })).status).toBe(
      'FLAGGED',
    );

    await prisma.guide.update({
      where: { id: guide.id },
      data: { unpublishDeadlineAt: new Date(Date.now() - 86_400_000) },
    });
    const result = await guides.unpublishOutdated();
    expect(result.unpublished).toBeGreaterThanOrEqual(1);
    expect((await prisma.guide.findUniqueOrThrow({ where: { id: guide.id } })).status).toBe(
      'UNPUBLISHED',
    );
    expect(
      await prisma.domainEvent.count({
        where: { type: 'guide.unpublished', aggregateId: guide.id },
      }),
    ).toBeGreaterThanOrEqual(1);
  });

  it('remet le guide à PUBLISHED quand un signalement est retiré sous le seuil', async () => {
    const author = await newMember();
    const guide = await publishedGuide(author);
    const members: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const member = await newMember();
      members.push(member);
      await guides.flagOutdated(member, guide.id, undefined);
    }

    const state = await guides.removeOutdatedFlag(members[0] as string, guide.id);
    expect(state.status).toBe('PUBLISHED');
    expect(state.outdatedFlagCount).toBe(2);
  });

  it('refuse le signalement d’obsolescence sur son propre guide', async () => {
    const author = await newMember();
    const guide = await publishedGuide(author);
    await expect(guides.flagOutdated(author, guide.id, undefined)).rejects.toMatchObject({
      code: 'OWN_GUIDE',
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Publication, slug, versions (§2.1 et §2.7)
  // ══════════════════════════════════════════════════════════════════════════

  it('suffixe le slug en cas de conflit, et ne le change plus après publication', async () => {
    const first = await newMember();
    const second = await newMember();
    const title = `Trouver un logement étudiant ${Date.now().toString(36)}`;

    const a = await publishedGuide(first, { title });
    const b = await guides.createDraft(second, {
      title,
      body: body('Le logement'),
      category: 'HOUSING',
      scope: 'UNIVERSAL',
    });
    guideIds.push(b.id);

    expect(a.slug).toBe(slugifyGuideTitle(title));
    expect(b.slug).toBe(`${slugifyGuideTitle(title)}-2`);

    // Publié : le titre est figé, donc le slug aussi (§2.1).
    await expect(guides.update(first, a.id, { title: `${title} (mis à jour)` })).rejects.toMatchObject(
      { code: 'CONFLICT' },
    );
    expect((await prisma.guide.findUniqueOrThrow({ where: { id: a.id } })).slug).toBe(a.slug);

    // Sur un BROUILLON, le titre et le slug suivent encore.
    const renamed = await guides.update(second, b.id, { title: `${title} en colocation` });
    expect(renamed.slug).not.toBe(b.slug);
  });

  it('exige 300 caractères pour publier, mais enregistre un brouillon plus court', async () => {
    const author = await newMember();
    const draft = await guides.createDraft(author, {
      title: 'Un début de guide à compléter',
      // L'éditeur auto-enregistre : un brouillon court doit passer.
      body: 'Je commence à écrire.',
      category: 'DAILY_LIFE',
      scope: 'UNIVERSAL',
    });
    guideIds.push(draft.id);

    await expect(guides.publish(author, draft.id)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });

    await guides.update(author, draft.id, { body: body('La suite') });
    const published = await guides.publish(author, draft.id);
    expect(published.status).toBe('PUBLISHED');
    // La première version reste la version 1 : le brouillon a été modifié SUR
    // PLACE, l'historique public commence à la publication.
    expect(await prisma.guideVersion.count({ where: { guideId: draft.id } })).toBe(1);
  });

  it('refuse le HTML, les titres de niveau 1 et 4, et les images (§2.1)', () => {
    // La validation du balisage vit dans le SCHÉMA zod, que l'API applique avant
    // d'atteindre le service : c'est donc le schéma qu'on éprouve, par le même
    // chemin que la route.
    const ok = guideDraftBodySchema.safeParse(body('Correct'));
    expect(ok.success).toBe(true);

    for (const badBody of [
      `${body('Ok')}\n\n<script>alert(1)</script>`,
      `${body('Ok')}\n\n<b>gras</b>`,
      `# Un titre de niveau 1\n\n${body('Ok')}`,
      `${body('Ok')}\n\n#### Un titre de niveau 4`,
      `${body('Ok')}\n\n![photo](https://example.org/p.png)`,
    ]) {
      expect(guideDraftBodySchema.safeParse(badBody).success).toBe(false);
    }

    // Les niveaux 2 et 3 sont autorisés ICI, en plus du sous-ensemble standard.
    expect(guideDraftBodySchema.safeParse('## Titre\n\n### Sous-titre\n\n**gras** et *italique* et [lien](https://example.org)').success).toBe(true);
  });

  it('crée une nouvelle version à chaque édition directe d’un guide publié (§2.7)', async () => {
    const author = await newMember();
    const guide = await publishedGuide(author);

    await guides.update(author, guide.id, { body: `${body('Version deux')}\n\nAjout.` });
    const versions = await prisma.guideVersion.findMany({
      where: { guideId: guide.id },
      orderBy: { version: 'asc' },
    });
    expect(versions).toHaveLength(2);
    expect(versions[1]?.createdByUserId).toBe(author);
    expect(
      await prisma.domainEvent.count({
        where: { type: 'guide.version_created', aggregateId: guide.id },
      }),
    ).toBe(1);
  });

  it('fait du retour arrière une NOUVELLE version, sans effacer l’historique (§2.7)', async () => {
    const author = await newMember();
    const guide = await publishedGuide(author);
    const v1 = await prisma.guideVersion.findFirstOrThrow({
      where: { guideId: guide.id, version: 1 },
    });

    await guides.update(author, guide.id, { body: `${body('Une refonte')}\n\nTout a changé.` });
    await guides.revert(author, guide.id, v1.id);

    const versions = await prisma.guideVersion.findMany({
      where: { guideId: guide.id },
      orderBy: { version: 'asc' },
    });
    // Trois versions : l'originale, la refonte, et le retour arrière.
    expect(versions).toHaveLength(3);
    expect(versions[2]?.body).toBe(v1.body);
    expect(versions[2]?.summary).toContain('version 1');
    const after = await prisma.guide.findUniqueOrThrow({ where: { id: guide.id } });
    expect(after.currentVersionId).toBe(versions[2]?.id);
  });

  it('limite à trois les publications d’une journée (§2.1)', async () => {
    const author = await newMember();
    for (let i = 0; i < GUIDE_DAILY_PUBLISH_LIMIT; i += 1) {
      await publishedGuide(author, { title: `Ma démarche numéro ${i} de la journée` });
    }
    const extra = await guides.createDraft(author, {
      title: 'Un quatrième guide dans la même journée',
      body: body('Le quatrième'),
      category: 'DAILY_LIFE',
      scope: 'UNIVERSAL',
    });
    guideIds.push(extra.id);

    await expect(guides.publish(author, extra.id)).rejects.toMatchObject({
      code: 'GUIDE_LIMIT_REACHED',
    });
  });

  it('bloque à la publication un contenu que la modération refuse (§2.1)', async () => {
    const author = await newMember();
    const draft = await guides.createDraft(author, {
      title: 'Comment régler les frais de dossier',
      // La modération fictive applique les mêmes règles locales que le vrai
      // pipeline : « envoyer » de l'argent est un motif de blocage.
      body: `${body('Les frais')}\n\nIl faut envoyer l'argent avant de recevoir le formulaire.`,
      category: 'ARRIVAL',
      scope: 'UNIVERSAL',
    });
    guideIds.push(draft.id);

    await expect(guides.publish(author, draft.id)).rejects.toMatchObject({
      code: 'CONTENT_BLOCKED',
    });
    // Le guide reste un brouillon, et un dossier attend l'équipe.
    expect((await prisma.guide.findUniqueOrThrow({ where: { id: draft.id } })).status).toBe('DRAFT');
    expect(
      await prisma.moderationCase.count({
        where: { subjectType: 'GUIDE', subjectId: draft.id, source: 'AI' },
      }),
    ).toBe(1);
  });

  it('dépublie puis republie à la demande de l’auteur (§2.6)', async () => {
    const author = await newMember();
    const guide = await publishedGuide(author);

    await guides.unpublish(author, guide.id);
    expect((await prisma.guide.findUniqueOrThrow({ where: { id: guide.id } })).status).toBe(
      'UNPUBLISHED',
    );
    const republished = await guides.publish(author, guide.id);
    expect(republished.status).toBe('PUBLISHED');
  });

  it('n’autorise l’édition que par l’auteur', async () => {
    const author = await newMember();
    const stranger = await newMember();
    const guide = await publishedGuide(author);
    await expect(guides.update(stranger, guide.id, { body: body('Pirate') })).rejects.toMatchObject(
      { code: 'NOT_AUTHOR' },
    );
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Classement et onglets (§2.3)
  // ══════════════════════════════════════════════════════════════════════════

  it('applique la table de coefficients de fraîcheur du §2.3', () => {
    expect(freshnessCoefficient(0)).toBe(1);
    expect(freshnessCoefficient(5)).toBe(1);
    expect(freshnessCoefficient(6)).toBe(0.7);
    expect(freshnessCoefficient(11)).toBe(0.7);
    expect(freshnessCoefficient(12)).toBe(0.4);
    expect(freshnessCoefficient(24)).toBe(0.4);
    expect(freshnessCoefficient(25)).toBe(0.2);
    expect(freshnessCoefficient(120)).toBe(0.2);

    const now = new Date('2026-09-27T12:00:00Z');
    expect(monthsSince(new Date('2026-03-27T12:00:00Z'), now)).toBe(6);
    expect(computeFreshnessScore(10, new Date('2026-03-27T12:00:00Z'), now)).toBe(7);
    expect(computeFreshnessScore(10, new Date('2020-01-01T12:00:00Z'), now)).toBe(2);
  });

  it('recalcule les scores de fraîcheur en tenant compte de l’âge (tâche §2.3)', async () => {
    const author = await newMember();
    const guide = await publishedGuide(author);
    const voter = await newMember();
    await guides.vote(voter, guide.id, 'HELPFUL');

    // Le guide vieillit de dix-huit mois : son score doit tomber à 0,4 × 1.
    const old = new Date();
    old.setMonth(old.getMonth() - 18);
    await prisma.guide.update({
      where: { id: guide.id },
      data: { lastContentUpdateAt: old },
    });
    await guides.recomputeFreshness();

    const after = await prisma.guide.findUniqueOrThrow({ where: { id: guide.id } });
    expect(after.freshnessScore.toNumber()).toBeCloseTo(0.4, 4);
  });

  it('place dans « À vérifier » un guide de plus de 24 mois, avec son bandeau', async () => {
    const author = await newMember();
    const guide = await publishedGuide(author);
    const old = new Date();
    old.setMonth(old.getMonth() - 30);
    await prisma.guide.update({ where: { id: guide.id }, data: { lastContentUpdateAt: old } });

    const review = await guides.list({ tab: 'review', limit: 50 }, author);
    expect(review.items.some((item) => item.id === guide.id)).toBe(true);
    const item = review.items.find((i) => i.id === guide.id);
    const banner = item?.banners.find((b) => b.kind === 'TO_VERIFY');
    expect(banner).toBeDefined();
    expect(banner?.months).toBeGreaterThanOrEqual(29);
  });

  it('classe les plus utiles par score décroissant et pagine par curseur', async () => {
    const author = await newMember();
    const low = await publishedGuide(author, { title: 'Un guide peu voté sur les transports' });
    const high = await publishedGuide(author, { title: 'Un guide très voté sur les transports' });
    for (let i = 0; i < 3; i += 1) {
      const voter = await newMember();
      await guides.vote(voter, high.id, 'HELPFUL');
    }
    const oneVoter = await newMember();
    await guides.vote(oneVoter, low.id, 'HELPFUL');

    const firstPage = await guides.list({ tab: 'helpful', limit: 1 }, author);
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = await guides.list(
      { tab: 'helpful', limit: 50, cursor: firstPage.nextCursor as string },
      author,
    );
    const firstId = firstPage.items[0]?.id;
    // Aucune ligne répétée entre les deux pages : c'est le propre d'une
    // pagination par clé, et ce qu'un `offset` raterait sur une liste qui bouge.
    expect(secondPage.items.some((item) => item.id === firstId)).toBe(false);

    const all = await guides.list({ tab: 'helpful', limit: 50 }, author);
    const positions = [high.id, low.id].map((id) => all.items.findIndex((item) => item.id === id));
    expect(positions[0]).toBeLessThan(positions[1] as number);
  });

  it('n’affiche par défaut les guides COUNTRY qu’aux membres de ce pays (§2.3)', async () => {
    const author = await newMember();
    const guide = await publishedGuide(author, {
      title: 'Les démarches propres à mon pays d’origine',
      scope: 'COUNTRY',
    });

    const local = await guides.list({ tab: 'recent', limit: 50 }, author);
    expect(local.items.some((item) => item.id === guide.id)).toBe(true);

    const foreigner = await newMember(otherCountryId);
    const seen = await guides.list({ tab: 'recent', limit: 50 }, foreigner);
    expect(seen.items.some((item) => item.id === guide.id)).toBe(false);

    // Le filtre est modifiable : en demandant ce pays, il le voit.
    const filtered = await guides.list(
      { tab: 'recent', limit: 50, countryId },
      foreigner,
    );
    expect(filtered.items.some((item) => item.id === guide.id)).toBe(true);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Maintenu par la communauté (§2.5)
  // ══════════════════════════════════════════════════════════════════════════

  it('bascule en maintenance communautaire après six mois sans session (tâche §2.5)', async () => {
    const author = await newMember();
    const guide = await publishedGuide(author);

    // Contre-exemple : un auteur vu hier ne bascule pas.
    await prisma.user.update({
      where: { id: author },
      data: { lastSeenAt: new Date(Date.now() - 86_400_000) },
    });
    await guides.switchInactiveAuthorsToCommunity();
    expect(
      (await prisma.guide.findUniqueOrThrow({ where: { id: guide.id } })).maintainedByCommunity,
    ).toBe(false);

    const longAgo = new Date();
    longAgo.setMonth(longAgo.getMonth() - 7);
    await prisma.user.update({ where: { id: author }, data: { lastSeenAt: longAgo } });
    await guides.switchInactiveAuthorsToCommunity();

    const after = await prisma.guide.findUniqueOrThrow({ where: { id: guide.id } });
    expect(after.maintainedByCommunity).toBe(true);
    const view = await guides.bySlug(guide.slug, author);
    expect(view.guide.banners.map((b) => b.kind)).toContain('COMMUNITY_MAINTAINED');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Conversion depuis un parcours (§2.8)
  // ══════════════════════════════════════════════════════════════════════════

  it('pré-remplit un brouillon depuis un parcours terminé, et refuse les autres', async () => {
    const owner = await newMember();

    const templateId = newId();
    templateIds.push(templateId);
    await prisma.journeyTemplate.create({
      data: {
        id: templateId,
        code: `test-etudes-${Date.now().toString(36)}`,
        nameFr: 'Études',
        targetPhase: 'PRE_DEPARTURE',
        isActive: true,
        sortOrder: 99,
      },
    });
    const versionId = newId();
    await prisma.journeyTemplateVersion.create({
      data: { id: versionId, templateId, version: 1, status: 'DRAFT' },
    });
    const stepDefinitionId = newId();
    stepDefinitionIds.push(stepDefinitionId);
    await prisma.stepDefinition.create({
      data: {
        id: stepDefinitionId,
        code: `test-visa-${Date.now().toString(36)}`,
        nameFr: 'Demander le visa',
        category: 'PRE_DEPARTURE',
        blockerTarget: 'HELP',
        isMajorMilestone: true,
        isRisky: false,
        documentChecklist: [],
      },
    });

    const journeyId = newId();
    journeyIds.push(journeyId);
    await prisma.journey.create({
      data: {
        id: journeyId,
        ownerUserId: owner,
        templateVersionId: versionId,
        title: 'Mon parcours d’études',
        status: 'ACTIVE',
        originCountryId: countryId,
        destinationCityId: cityId,
        lastActivityAt: new Date(),
        steps: {
          create: [
            {
              id: newId(),
              stepDefinitionId,
              title: 'Demander le visa étudiant',
              position: 1,
              status: 'DONE',
              completedAt: new Date(),
              durationDays: 42,
            },
            {
              id: newId(),
              stepDefinitionId,
              title: 'Trouver un logement',
              position: 2,
              status: 'DONE',
              completedAt: new Date(),
              durationDays: 15,
            },
          ],
        },
      },
    });

    // Contre-exemple : un parcours encore ACTIVE ne se convertit pas.
    await expect(guides.draftFromJourney(owner, journeyId)).rejects.toMatchObject({
      code: 'JOURNEY_NOT_COMPLETED',
    });

    await prisma.journey.update({
      where: { id: journeyId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    const draft = await guides.draftFromJourney(owner, journeyId);
    guideIds.push(draft.id);
    expect(draft.status).toBe('DRAFT');
    // Une section par étape franchie, avec la durée réelle (§2.8).
    expect(draft.currentVersion?.body).toContain('## Demander le visa étudiant');
    expect(draft.currentVersion?.body).toContain('## Trouver un logement');
    expect(draft.currentVersion?.body).toContain('42 jours');
    expect(draft.category).toBe('PRE_DEPARTURE');
    expect(draft.scope).toBe('COUNTRY');

    // Le parcours d'un autre membre ne se convertit pas, et ne se révèle pas.
    const stranger = await newMember();
    await expect(guides.draftFromJourney(stranger, journeyId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Lectures dérivées
  // ══════════════════════════════════════════════════════════════════════════

  it('renvoie mon vote, mon signalement et les contributeurs sur la fiche du guide', async () => {
    const author = await newMember();
    const reader = await newMember();
    const guide = await publishedGuide(author);

    await guides.vote(reader, guide.id, 'HELPFUL');
    await guides.flagOutdated(reader, guide.id, 'Les horaires ne sont plus les bons.');

    const view = await guides.bySlug(guide.slug, reader);
    expect(view.myVote).toBe('HELPFUL');
    expect(view.myOutdatedFlag?.comment).toContain('horaires');
    expect(view.currentVersion?.body).toContain('Voici la démarche');
    // Un visiteur anonyme n'a ni vote ni signalement, mais lit le guide.
    const anonymous = await guides.bySlug(guide.slug, null);
    expect(anonymous.myVote).toBeNull();
    expect(anonymous.currentVersion?.body).toContain('Voici la démarche');
  });

  it('montre à l’auteur ses propositions en attente, et aux autres seulement les acceptées', async () => {
    const author = await newMember();
    const proposer = await newMember();
    const stranger = await newMember();
    const guide = await publishedGuide(author);

    await guides.createProposal(proposer, guide.id, {
      targetExcerpt: 'le matin',
      replacement: 'dès l’aube',
      reason: 'Une précision d’horaire que tout le monde cherche en arrivant.',
    });

    expect((await guides.listProposals(guide.id, author)).items).toHaveLength(1);
    expect((await guides.listProposals(guide.id, stranger)).items).toHaveLength(0);
    expect((await guides.listProposals(guide.id, null)).items).toHaveLength(0);
  });

  it('renvoie l’historique des versions, sans le corps, et une version avec le sien', async () => {
    const author = await newMember();
    const guide = await publishedGuide(author);
    await guides.update(author, guide.id, { body: `${body('Deux')}\n\nUne précision.` });

    const history = await guides.versions(guide.slug, null);
    expect(history.items).toHaveLength(2);
    expect(JSON.stringify(history.items)).not.toContain('Voici la démarche');

    const first = history.items.find((v) => v.version === 1);
    const full = await guides.version(guide.slug, first?.id as string, null);
    expect(full.body).toContain('Voici la démarche');

    // L'identifiant d'une version d'un AUTRE guide ne sort pas par cette route.
    const otherAuthor = await newMember();
    const otherGuide = await publishedGuide(otherAuthor, { title: 'Un tout autre guide ici' });
    const otherVersion = await prisma.guideVersion.findFirstOrThrow({
      where: { guideId: otherGuide.id },
    });
    await expect(guides.version(guide.slug, otherVersion.id, null)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('liste mes guides, tous statuts confondus', async () => {
    const author = await newMember();
    const draft = await guides.createDraft(author, {
      title: 'Un brouillon à moi tout seul',
      body: body('Brouillon'),
      category: 'DAILY_LIFE',
      scope: 'UNIVERSAL',
    });
    guideIds.push(draft.id);
    const published = await publishedGuide(author, { title: 'Un guide publié à moi' });

    const mine = await guides.mine(author, 50);
    const ids = mine.items.map((item) => item.id);
    expect(ids).toContain(draft.id);
    expect(ids).toContain(published.id);
  });
});
