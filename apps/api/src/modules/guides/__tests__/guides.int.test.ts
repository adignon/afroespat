import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import {
  GUIDE_DAILY_PUBLISH_LIMIT,
  GUIDE_NEGATIVE_VOTE_THRESHOLD,
  GUIDE_PENDING_PROPOSAL_LIMIT,
  computeFreshnessScore,
  freshnessCoefficient,
  guideBodyMediaKeys,
  guideDraftBodySchema,
  monthsSince,
  slugifyGuideTitle,
} from '@app/shared';
import { AuditService } from '../../../common/audit.service';
import { OutboxService } from '../../../common/outbox.service';
import { PrismaService } from '../../../common/prisma.service';
import { VisibilityService } from '../../../common/visibility.service';
import { FakeAiModerationProvider } from '../../../providers/providers';
import { ModerationService } from '../../moderation/moderation.service';
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
/**
 * L'adresse d'une image DÉPOSÉE PAR L'APPLICATION, de la forme exacte que rend
 * `POST /media` : `/media/<genre>/<année>/<mois>/<uuid>-<32 hexa>.<ext>`
 * (`MediaService.keyFor`). RELEVÉE sur un envoi réel, pas construite de tête —
 * c'est la seule forme que `guideBodyMediaKeys` reconnaît, et une clé inventée à
 * la main se serait trompée sur la longueur du segment aléatoire.
 *
 * Elle ne désigne AUCUNE ligne de `media_assets` dans cette base de test, et ce
 * n'est pas un défaut : les cas ci-dessous éprouvent la GRAMMAIRE, qu'un schéma
 * applique sans lire la base. L'existence, le statut `READY` et la propriété sont
 * l'affaire du service — voir le cas « refuse une image qui n'est pas à l'auteur ».
 */
/**
 * LE SQL DE LA REPRISE DE DONNÉES, LU DEPUIS LE FICHIER DE MIGRATION LUI-MÊME.
 *
 * Et pas recopié : un test qui reproduirait la reprise en TypeScript éprouverait
 * SA COPIE, pas la migration que la base applique. C'est la différence entre
 * « mon idée de la reprise est idempotente » et « la reprise est idempotente ».
 */
const MIGRATION_REPRISE =
  '../../../../../../packages/db/prisma/migrations/20261010163200_guide_pages_reprise/migration.sql';

const MEDIA_KEY_VALIDE =
  '/media/guide/2026/10/01a1244a-808d-7000-a9e6-0c2d368603e1-ab48c3963bd2bd3e42e9db31bbdc52db.png';

describe('guides (05 §2, §7, §8, §9)', () => {
  let prisma: PrismaService;
  let guides: GuidesService;
  let moderation: ModerationService;

  const userIds: string[] = [];
  const guideIds: string[] = [];
  const journeyIds: string[] = [];
  const templateIds: string[] = [];
  const stepDefinitionIds: string[] = [];
  const assetIds: string[] = [];

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

  /**
   * Un actif média PRÊT, appartenant à `ownerUserId`.
   *
   * Écrit directement en base, et non par `POST /media` : la route déposerait des
   * octets dans le fournisseur de stockage, alors que ce qu'on éprouve ici est le
   * RATTACHEMENT — existence, statut, propriété. La clé suit la forme exacte de
   * `MediaService.keyFor`, parce que c'est elle que la grammaire du corps
   * reconnaît.
   */
  async function mediaAsset(
    ownerUserId: string | null,
    options: { status?: 'READY' | 'SCANNING' | 'REJECTED'; kind?: 'GUIDE' | 'PROOF' } = {},
  ): Promise<{ id: string; url: string; storageKey: string }> {
    const id = newId();
    const kind = options.kind ?? 'GUIDE';
    const secret = id.replace(/-/g, '').padEnd(32, '0').slice(0, 32);
    const storageKey = `${kind.toLowerCase()}/2026/10/${id}-${secret}.png`;
    await prisma.mediaAsset.create({
      data: {
        id,
        ownerUserId,
        kind,
        storageKey,
        mime: 'image/png',
        sizeBytes: BigInt(79),
        status: options.status ?? 'READY',
        exifStripped: true,
      },
    });
    assetIds.push(id);
    return { id, url: `/media/${storageKey}`, storageKey };
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
    moderation = new ModerationService(
      prisma,
      new OutboxService(prisma),
      new AuditService(prisma),
      new FakeAiModerationProvider(),
    );
    guides = new GuidesService(
      prisma,
      new OutboxService(prisma),
      new AuditService(prisma),
      new VisibilityService(prisma),
      // Le pipeline du module 13 (lot G) : plus d'appel direct au fournisseur d'IA.
      moderation,
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
      // Un dossier qui porte une action (celui qu'ouvre une règle locale, avec sa
      // note) ne peut plus être supprimé : `moderation_actions` est en ajout seul.
      await prisma.moderationCase.deleteMany({
        where: { subjectId: { in: guideIds }, actions: { none: {} } },
      });
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
    // Les médias APRÈS les guides : `guide_media` cascade depuis les deux côtés,
    // mais `media_assets.owner_user_id` est en `SET NULL` — supprimer les membres
    // d'abord laisserait des actifs sans propriétaire dans la base commune.
    if (assetIds.length > 0) {
      await prisma.mediaAsset.deleteMany({ where: { id: { in: assetIds } } });
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

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ `GET /guides/:id/outdated` — CE QUI A ÉTÉ SIGNALÉ, JAMAIS PAR QUI        ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Il faut faire ceci, l'auteur doit voir les signalements "a
   * changé". » Et, de la veille, ce qui n'a pas été annulé : « Les signalants
   * resteront anonymes. »
   *
   * LE CONTRE-EXEMPLE EST L'ANONYMAT LUI-MÊME, et il porte sur les CLÉS et non sur
   * les valeurs : une assertion du genre « la réponse ne contient pas "Fatou" »
   * passerait aussi sur une réponse vide, et passerait encore le jour où la route
   * rendrait un `userId`. On vérifie donc l'ENSEMBLE EXACT des clés de chaque
   * ligne — deux, pas trois — ce qui tombe dès qu'une colonne s'ajoute.
   *
   * Le TROISIÈME signalement est posé SANS commentaire : le champ est facultatif,
   * donc `comment: null` est un cas normal que l'écran doit savoir dire.
   */
  it('rend à l’auteur les signalements « a changé » — date et commentaire, sans aucune identité', async () => {
    const author = await newMember();
    const guide = await publishedGuide(author);

    const dits = ['Le guichet a déménagé en mars.', 'Le formulaire n’existe plus.', undefined];
    for (const dit of dits) {
      const membre = await newMember();
      await guides.flagOutdated(membre, guide.id, dit);
    }

    const lu = await guides.listOutdatedFlags(author, guide.id);
    expect(lu.items).toHaveLength(3);

    // L'ANONYMAT, sur les CLÉS : deux par ligne, et pas une de plus.
    for (const ligne of lu.items) {
      expect(Object.keys(ligne).sort()).toEqual(['comment', 'createdAt']);
    }
    // Trié sur une clé EXPLICITE : le tri par défaut de JavaScript convertit en
    // chaîne, donc `null` deviendrait « null » et se rangerait selon l'alphabet —
    // un détail qui aurait rendu l'attendu dépendant du texte des commentaires.
    expect(
      lu.items.map((l) => l.comment).sort((a, b) => (a ?? '').localeCompare(b ?? '')),
    ).toEqual([null, 'Le formulaire n’existe plus.', 'Le guichet a déménagé en mars.']);

    // L'ORDRE EST DÉCROISSANT : le dernier signalement d'abord.
    const dates = lu.items.map((l) => Date.parse(l.createdAt));
    expect([...dates].sort((a, b) => b - a)).toEqual(dates);
  });

  /**
   * LA RÈGLE D'ACCÈS N'EST PAS RÉÉCRITE : c'est `loadOwned`, le même garde que les
   * écritures du module. Ce cas éprouve les DEUX refus qu'il distingue, et la
   * distinction n'est pas cosmétique — un `403` sur un brouillon d'autrui
   * révélerait qu'il existe.
   */
  it('refuse les signalements à qui n’est pas l’auteur : NOT_AUTHOR sur un guide publié, 404 sur un brouillon', async () => {
    const author = await newMember();
    const intrus = await newMember();

    const publie = await publishedGuide(author);
    await guides.flagOutdated(intrus, publie.id, 'J’ai signalé, je ne dois pas pouvoir relire.');
    await expect(guides.listOutdatedFlags(intrus, publie.id)).rejects.toMatchObject({
      code: 'NOT_AUTHOR',
    });
    // CONTRE-EXEMPLE : l'auteur, lui, le lit — sinon le refus ci-dessus ne
    // prouverait rien d'autre qu'une route cassée.
    expect((await guides.listOutdatedFlags(author, publie.id)).items).toHaveLength(1);

    const brouillon = await guides.createDraft(author, {
      title: 'Un brouillon dont les signalements ne se devinent pas',
      body: body('Le brouillon'),
      category: 'ARRIVAL',
      scope: 'UNIVERSAL',
    });
    guideIds.push(brouillon.id);
    await expect(guides.listOutdatedFlags(intrus, brouillon.id)).rejects.toMatchObject({
      status: 404,
    });
  });

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ « OUVRIR À LA COMMUNAUTÉ » — ET LA CONSÉQUENCE QUE §2.4 LUI DONNE        ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « le bouton ouvrir à la communauté ne marche pas. »
   *
   * CE CAS N'ÉPROUVE PAS LE BOOLÉEN, IL ÉPROUVE CE QU'IL FAIT. §2.4, ligne 52 :
   * « Si le guide est `maintained_by_community` : les propositions vont
   * directement en file de modération, sans passer par le créateur. » Un test qui
   * relirait seulement `maintainedByCommunity` passerait sur une route qui écrit
   * dans une colonne que personne ne lit — et c'est précisément le défaut qu'on
   * vient de corriger ailleurs.
   *
   * Le CONTRE-EXEMPLE est dans l'ordre : la proposition posée AVANT l'ouverture
   * reste `PENDING` (elle attend l'auteur), celle posée APRÈS part en modération.
   *
   * §2.5 : « Réversible si l'auteur revient et le demande. » D'où le dernier
   * temps, et la vérification que l'idempotence tient (ouvrir deux fois ne refuse
   * pas).
   */
  it('ouvre un guide à la communauté, envoie les propositions en modération, et revient en arrière (§2.5)', async () => {
    const author = await newMember();
    const guide = await publishedGuide(author);
    const lecteur = await newMember();

    const avant = await guides.createProposal(lecteur, guide.id, {
      targetExcerpt: 'Le guichet ouvre tôt le matin',
      replacement: 'Le guichet ouvre à 9 h',
      reason: 'L’horaire a changé et nous sommes plusieurs à l’avoir constaté.',
    });
    expect(avant.status).toBe('PENDING');

    const ouvert = await guides.setCommunityMaintenance(author, guide.id, true);
    expect(ouvert.maintainedByCommunity).toBe(true);
    // IDEMPOTENT : §2.5 ne connaît pas de « déjà ouvert ».
    expect(
      (await guides.setCommunityMaintenance(author, guide.id, true)).maintainedByCommunity,
    ).toBe(true);

    const apres = await guides.createProposal(await newMember(), guide.id, {
      targetExcerpt: 'la salle n’a pas de photocopieur',
      replacement: 'un photocopieur est installé depuis la rentrée',
      reason: 'Le photocopieur est revenu, et l’information fait perdre du temps.',
    });
    expect(apres.status).toBe('ESCALATED');

    const repris = await guides.setCommunityMaintenance(author, guide.id, false);
    expect(repris.maintainedByCommunity).toBe(false);
    expect(
      (await prisma.guide.findUniqueOrThrow({ where: { id: guide.id } })).authorUserId,
    ).toBe(author);
  });

  /** Le même garde que la lecture : `loadOwned`, et ses deux refus. */
  it('refuse « ouvrir à la communauté » à qui n’est pas l’auteur', async () => {
    const author = await newMember();
    const intrus = await newMember();
    const publie = await publishedGuide(author);

    await expect(
      guides.setCommunityMaintenance(intrus, publie.id, true),
    ).rejects.toMatchObject({ code: 'NOT_AUTHOR' });
    expect(
      (await prisma.guide.findUniqueOrThrow({ where: { id: publie.id } })).maintainedByCommunity,
    ).toBe(false);
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

  /**
   * ⚠ CE CAS A CHANGÉ DE SENS : « et les images » est devenu « et les images
   * EXTERNES ».
   *
   * Les guides portent maintenant des images, parce que `guide_media` existe et
   * que la maquette les dessine (éditeur A05, `<figure>` du lecteur A04). Ce qui
   * reste refusé est l'image qui ne vient PAS du pipeline média : une URL externe
   * envoie l'adresse IP de chaque lecteur chez un tiers et échappe à l'antivirus
   * comme au retrait des EXIF (00 §8.1 et §8.2).
   *
   * Le cas éprouve donc les deux moitiés — sans la seconde, un schéma qui
   * refuserait TOUTE image resterait vert alors qu'il casse l'éditeur.
   */
  it('refuse le HTML, les titres de niveau 1 et 4, et les images EXTERNES (§2.1)', () => {
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
      // Un chemin relatif : il ne sort pas du produit, mais il ne désigne aucune
      // clé de stockage, donc rien ne garantit qu'un fichier scanné existe.
      `${body('Ok')}\n\n![photo](image-1.jpg)`,
      // Le bon préfixe, une clé qui n'en est pas une.
      `${body('Ok')}\n\n![photo](/media/../../etc/passwd)`,
      // Un titre Markdown collé à une adresse valide : refusé, faute d'écran qui
      // le dessine (la légende se compose de l'ALT et du contributeur).
      `${body('Ok')}\n\n![photo](${MEDIA_KEY_VALIDE} "titre")`,
    ]) {
      expect(guideDraftBodySchema.safeParse(badBody).success).toBe(false);
    }

    // ACCEPTÉE : l'adresse que rend `POST /media`, et c'est la seule forme.
    const avecImage = `${body('Ok')}\n\n![Capture de l’attestation](${MEDIA_KEY_VALIDE})`;
    expect(guideDraftBodySchema.safeParse(avecImage).success).toBe(true);
    expect(guideBodyMediaKeys(avecImage)).toEqual([MEDIA_KEY_VALIDE.slice('/media/'.length)]);

    // Les niveaux 2 et 3 sont autorisés ICI, en plus du sous-ensemble standard.
    expect(guideDraftBodySchema.safeParse('## Titre\n\n### Sous-titre\n\n**gras** et *italique* et [lien](https://example.org)').success).toBe(true);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // LES IMAGES DU CORPS — `guide_media` (05 §2.1, 00 §8.1 et §8.2)
  // ══════════════════════════════════════════════════════════════════════════

  it('rattache les images du corps, dans l’ordre du texte et sans doublon', async () => {
    const author = await newMember();
    const premiere = await mediaAsset(author);
    const seconde = await mediaAsset(author);

    // La SECONDE image est citée d'abord, et la première deux fois : l'ordre
    // attendu est celui du TEXTE, pas celui des identifiants, et le doublon ne
    // doit pas produire deux lignes.
    const draft = await guides.createDraft(author, {
      title: 'Deux captures dans une démarche',
      body: `${body('Les pièces')}\n\n![Deux](${seconde.url})\n\n![Une](${premiere.url})\n\n![Deux encore](${seconde.url})`,
      category: 'ARRIVAL',
      scope: 'UNIVERSAL',
    });
    guideIds.push(draft.id);

    const lignes = await prisma.guideMedia.findMany({
      where: { guideId: draft.id },
      orderBy: { position: 'asc' },
      select: { position: true, mediaAssetId: true },
    });
    expect(lignes).toEqual([
      { position: 0, mediaAssetId: seconde.id },
      { position: 1, mediaAssetId: premiere.id },
    ]);

    // Une mise à jour qui retire une image retire son rattachement : sinon la
    // table retiendrait des fichiers que le guide n'affiche plus.
    await guides.update(author, draft.id, { body: `${body('Les pièces')}\n\n![Une](${premiere.url})` });
    expect(
      await prisma.guideMedia.findMany({
        where: { guideId: draft.id },
        select: { position: true, mediaAssetId: true },
      }),
    ).toEqual([{ position: 0, mediaAssetId: premiere.id }]);

    // Et un corps sans image n'en garde aucun.
    await guides.update(author, draft.id, { body: body('Les pièces, sans capture') });
    expect(await prisma.guideMedia.count({ where: { guideId: draft.id } })).toBe(0);
  });

  it('refuse une image inconnue, pas prête, d’un autre genre, ou qui n’est pas à l’auteur', async () => {
    const author = await newMember();
    const autre = await newMember();

    const inconnue = `/media/guide/2026/10/${newId()}-${'a'.repeat(32)}.png`;
    const enAnalyse = await mediaAsset(author, { status: 'SCANNING' });
    const refusee = await mediaAsset(author, { status: 'REJECTED' });
    // `PROOF` : « accès équipe uniquement, jamais affiché » (00 §8.1). Le genre
    // est dans la clause `where`, donc le refus dit `UNKNOWN` — il ne confirme
    // pas à qui tient la clé qu'elle désigne un justificatif.
    const justificatif = await mediaAsset(author, { kind: 'PROOF' });
    const aQuelquUnDAutre = await mediaAsset(autre);

    const attendu: readonly [string, string][] = [
      [inconnue, 'UNKNOWN'],
      [enAnalyse.url, 'NOT_READY'],
      [refusee.url, 'REJECTED'],
      [justificatif.url, 'UNKNOWN'],
      [aQuelquUnDAutre.url, 'NOT_OWNED'],
    ];

    for (const [url, raison] of attendu) {
      await expect(
        guides.createDraft(author, {
          title: `Un guide avec une image ${raison}`,
          body: `${body('Les pièces')}\n\n![Capture](${url})`,
          category: 'ARRIVAL',
          scope: 'UNIVERSAL',
        }),
      ).rejects.toMatchObject({
        code: 'IMAGE_NOT_ATTACHABLE',
        // Le motif est NOMMÉ par clé : l'éditeur peut désigner l'image fautive
        // au lieu de faire retirer les images une par une.
        details: { images: [{ key: url.slice('/media/'.length), reason: raison }] },
      });
    }

    // CONTRE-EXEMPLE : la même écriture passe avec un actif prêt et à l'auteur.
    // Sans lui, un service qui refuserait TOUTE image ferait passer ce cas.
    const bonne = await mediaAsset(author);
    const draft = await guides.createDraft(author, {
      title: 'Un guide avec une image en règle',
      body: `${body('Les pièces')}\n\n![Capture](${bonne.url})`,
      category: 'ARRIVAL',
      scope: 'UNIVERSAL',
    });
    guideIds.push(draft.id);
    expect(await prisma.guideMedia.count({ where: { guideId: draft.id } })).toBe(1);
  });

  it('n’écrit NI la version NI le rattachement quand une image est refusée', async () => {
    const author = await newMember();
    const guide = await publishedGuide(author);
    const corpsAvant = guide.currentVersion?.body;
    const versionsAvant = await prisma.guideVersion.count({ where: { guideId: guide.id } });

    const aQuelquUnDAutre = await mediaAsset(await newMember());
    await expect(
      guides.update(author, guide.id, {
        body: `${body('Une refonte')}\n\n![Volée](${aQuelquUnDAutre.url})`,
      }),
    ).rejects.toMatchObject({ code: 'IMAGE_NOT_ATTACHABLE' });

    // LA TRANSACTION ENTIÈRE EST ANNULÉE. C'est tout l'intérêt de vérifier les
    // images DANS la transaction qui écrit la version : un refus tardif aurait
    // laissé une version de plus, avec un corps citant une image non rattachée.
    expect(await prisma.guideVersion.count({ where: { guideId: guide.id } })).toBe(versionsAvant);
    const apres = await prisma.guide.findUniqueOrThrow({
      where: { id: guide.id },
      select: { currentVersion: { select: { body: true } } },
    });
    expect(apres.currentVersion?.body).toBe(corpsAvant);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // LE COMPTEUR DE COMMENTAIRES — `GET /guides/:slug` (04 §2.5)
  // ══════════════════════════════════════════════════════════════════════════

  // ══════════════════════════════════════════════════════════════════════════
  // LES PAGES D'UN GUIDE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * LE CAS QUI PROTÈGE TOUS LES LIENS DÉJÀ PARTAGÉS.
   *
   * §2.1 fige le slug d'un guide pour qu'un lien collé dans une conversation
   * continue de fonctionner. Les pages auraient pu casser cette promesse d'une
   * autre façon : en changeant la FORME de la réponse. Ce cas mesure qu'un guide
   * à une page répond comme avant — un plan d'un élément, la page lue est cette
   * page, et `currentVersion` porte son corps.
   */
  it('répond comme avant les pages sur un guide à UNE page (§2.1)', async () => {
    const author = await newMember();
    const lecteur = await newMember();
    const corps = body('La démarche d’avant');
    const guide = await publishedGuide(author, { bodyText: corps });

    const vue = await guides.bySlug(guide.slug, lecteur);
    expect(vue.pages).toHaveLength(1);
    expect(vue.guide.pageCount).toBe(1);
    expect(vue.currentPage.position).toBe(1);
    // Le titre de la page 1 est celui du guide, et son slug en est dérivé par la
    // MÊME fonction que la reprise de données emploie en SQL.
    expect(vue.currentPage.title).toBe(guide.title);
    expect(vue.currentPage.slug).toBe(slugifyGuideTitle(guide.title));
    // Le corps est là, et c'est bien celui de la page lue.
    expect(vue.currentVersion?.body).toBe(corps);

    // Demander explicitement la page 1 par son slug donne le MÊME résultat : le
    // lien court et le lien long ouvrent la même chose.
    const explicite = await guides.bySlug(guide.slug, lecteur, vue.currentPage.slug);
    expect(explicite.currentPage.id).toBe(vue.currentPage.id);
    expect(explicite.currentVersion?.body).toBe(corps);
  });

  it('rend 404 sur un slug de page inconnu, et jamais la première page', async () => {
    const author = await newMember();
    const lecteur = await newMember();
    const guide = await publishedGuide(author);

    // Contre-exemple : sans lui, un 404 systématique ferait passer la suite.
    expect((await guides.bySlug(guide.slug, lecteur)).currentPage.position).toBe(1);

    await expect(
      guides.bySlug(guide.slug, lecteur, 'une-page-qui-n-existe-pas'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  /**
   * LES DEUX COMPTEURS, MESURÉS L'UN CONTRE L'AUTRE.
   *
   * C'est la décision du porteur qui est éprouvée ici, et elle ne se vérifie
   * qu'avec DEUX pages inégalement commentées : un guide dont les deux pages
   * portent le même nombre laisserait passer un service qui rendrait le total
   * partout, ou la page partout.
   */
  it('rend le TOTAL du guide en liste et le compte de la PAGE LUE en détail', async () => {
    const author = await newMember();
    const lecteur = await newMember();
    const guide = await publishedGuide(author);

    const avecPage = await guides.addPage(author, guide.id, {
      title: 'Après le rendez-vous',
      body: body('La suite'),
    });
    const [page1, page2] = avecPage.pages;
    expect(page1).toBeDefined();
    expect(page2).toBeDefined();

    const commentaire = async (pageId: string, texte: string): Promise<void> => {
      await prisma.comment.create({
        data: {
          id: newId(),
          subjectType: 'GUIDE_PAGE',
          subjectId: pageId,
          authorUserId: lecteur,
          body: texte,
          status: 'PUBLISHED',
        },
      });
    };
    await commentaire(page1?.id ?? '', 'Une question sur la première page.');
    await commentaire(page2?.id ?? '', 'Une question sur la seconde.');
    await commentaire(page2?.id ?? '', 'Et une autre sur la seconde.');

    // DÉTAIL, page 1 : UN commentaire — celui de cette page.
    const vue1 = await guides.bySlug(guide.slug, lecteur);
    expect(vue1.currentPage.id).toBe(page1?.id);
    expect(vue1.guide.commentCount).toBe(1);
    // DÉTAIL, page 2 : DEUX. Le même guide, un autre nombre.
    const vue2 = await guides.bySlug(guide.slug, lecteur, page2?.slug);
    expect(vue2.guide.commentCount).toBe(2);
    // Le plan porte les deux, et leur somme est le total.
    expect(vue2.pages.map((page) => page.commentCount)).toEqual([1, 2]);

    // LISTE : le TOTAL, et il est différent des deux nombres ci-dessus — c'est ce
    // qui prouve que ce n'est pas le même calcul recopié.
    const page = await guides.list({ tab: 'recent', limit: 50 }, lecteur);
    const carte = page.items.find((item) => item.id === guide.id);
    expect(carte?.commentCount).toBe(3);
    expect(carte?.pageCount).toBe(2);

    // `GET /me/guides` porte le même total : c'est la même carte.
    const miennes = await guides.mine(author, 50);
    expect(miennes.items.find((item) => item.id === guide.id)?.commentCount).toBe(3);

    await prisma.comment.deleteMany({
      where: { subjectId: { in: [page1?.id ?? '', page2?.id ?? ''] } },
    });
  });

  it('refuse de retirer la DERNIÈRE page d’un guide (LAST_PAGE)', async () => {
    const author = await newMember();
    const guide = await publishedGuide(author);
    const seule = (await guides.bySlug(guide.slug, author)).currentPage;

    await expect(guides.removePage(author, guide.id, seule.id)).rejects.toMatchObject({
      code: 'LAST_PAGE',
    });
    // Contre-exemple : avec une SECONDE page, le retrait passe — donc le refus
    // ci-dessus vient bien de « c'est la dernière », et pas d'un refus général.
    const deux = await guides.addPage(author, guide.id, {
      title: 'Une page de plus',
      body: body('Encore'),
    });
    expect(deux.pages).toHaveLength(2);
    const apres = await guides.removePage(author, guide.id, deux.currentPage.id);
    expect(apres.pages).toHaveLength(1);
    expect(apres.pages[0]?.id).toBe(seule.id);
    // Et la page retirée a quitté le plan sans emporter son historique : la
    // table des versions est en ajout seul (§2.7).
    expect(
      await prisma.guideVersion.count({ where: { pageId: deux.currentPage.id } }),
    ).toBe(1);
    // Sa position est passée en négatif pour libérer la place, et la survivante
    // garde la position 1.
    const retiree = await prisma.guidePage.findUniqueOrThrow({
      where: { id: deux.currentPage.id },
      select: { position: true, deletedAt: true },
    });
    expect(retiree.deletedAt).not.toBeNull();
    expect(retiree.position).toBeLessThan(0);
  });

  it('déplace une page sans heurter l’unicité (guide, position)', async () => {
    const author = await newMember();
    const guide = await publishedGuide(author, { title: 'Un guide à trois pages' });
    await guides.addPage(author, guide.id, { title: 'Deuxième', body: body('Deux') });
    const trois = await guides.addPage(author, guide.id, {
      title: 'Troisième',
      body: body('Trois'),
    });
    expect(trois.pages.map((page) => page.title)).toEqual([
      guide.title,
      'Deuxième',
      'Troisième',
    ]);

    // La troisième passe en PREMIÈRE : les deux autres descendent d'un cran, et
    // c'est exactement le cas qu'un décalage naïf `position + 1` ferait échouer.
    const deplace = await guides.updatePage(author, guide.id, trois.currentPage.id, {
      position: 1,
    });
    expect(deplace.pages.map((page) => page.title)).toEqual([
      'Troisième',
      guide.title,
      'Deuxième',
    ]);
    expect(deplace.pages.map((page) => page.position)).toEqual([1, 2, 3]);

    // Une position hors bornes est RAMENÉE à la dernière place, pas refusée.
    const fin = await guides.updatePage(author, guide.id, trois.currentPage.id, {
      position: 99,
    });
    expect(fin.pages.map((page) => page.title)).toEqual([
      guide.title,
      'Deuxième',
      'Troisième',
    ]);
  });

  /**
   * LES 300 CARACTÈRES SONT CEUX DU TOTAL — ET C'EST MESURÉ AVEC DES PAGES QUI
   * NE PASSERAIENT PAS SÉPARÉMENT.
   *
   * Sans ce cas, la décision écrite sur `guidePublishableGuideBodySchema` serait
   * une intention : trois pages de 120 caractères totalisent 360 et publient,
   * alors qu'aucune ne tient seule les 300.
   */
  it('mesure les 300 caractères du §2.1 sur le TOTAL des pages, pas page par page', async () => {
    const author = await newMember();
    const court = 'Une page courte mais utile, qui dit ce qu’il faut et rien de plus. '.repeat(2);
    expect(court.length).toBeLessThan(300);

    const draft = await guides.createDraft(author, {
      title: 'Un guide en trois pages courtes',
      body: court,
      category: 'ARRIVAL',
      scope: 'UNIVERSAL',
    });
    guideIds.push(draft.id);

    // Contre-exemple : une seule page courte ne suffit pas, le minimum existe.
    await expect(guides.publish(author, draft.id)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });

    await guides.addPage(author, draft.id, { title: 'Deuxième page', body: court });
    await guides.addPage(author, draft.id, { title: 'Troisième page', body: court });

    const publie = await guides.publish(author, draft.id);
    expect(publie.status).toBe('PUBLISHED');
    expect(publie.pageCount).toBe(3);
  });

  /**
   * LA REPRISE DE DONNÉES, ÉPROUVÉE SUR SON SQL RÉEL ET REJOUÉE.
   *
   * Le fichier de migration est LU ET EXÉCUTÉ, pas réécrit à la main : un test
   * qui reproduirait la reprise en TypeScript éprouverait sa copie, pas elle. Le
   * décor est un guide RAMENÉ À L'ÉTAT D'AVANT LES PAGES — page retirée,
   * `page_id` vidé, commentaire replacé sur le GUIDE — puis la reprise est jouée
   * DEUX FOIS.
   */
  it('reprend un guide d’avant les pages, et le rejeu ne double rien', async () => {
    const author = await newMember();
    const lecteur = await newMember();
    const guide = await publishedGuide(author, { title: 'Un guide hérité d’avant' });
    const page1 = (await guides.bySlug(guide.slug, author)).currentPage;

    const commentId = newId();
    await prisma.comment.create({
      data: {
        id: commentId,
        subjectType: 'GUIDE_PAGE',
        subjectId: page1.id,
        authorUserId: lecteur,
        body: 'Un commentaire écrit avant la migration.',
        status: 'PUBLISHED',
      },
    });

    // ── On remet le guide dans l'état d'AVANT la fonctionnalité ──────────────
    await prisma.$executeRaw`
      UPDATE comments SET subject_type = 'GUIDE', subject_id = ${guide.id}::uuid
      WHERE id = ${commentId}::uuid`;
    await prisma.$executeRaw`
      UPDATE guide_versions SET page_id = NULL WHERE guide_id = ${guide.id}::uuid`;
    await prisma.$executeRaw`DELETE FROM guide_pages WHERE guide_id = ${guide.id}::uuid`;
    expect(await prisma.guidePage.count({ where: { guideId: guide.id } })).toBe(0);

    // `__dirname` et non un chemin relatif au cwd : vitest est lancé depuis
    // `apps/api` aujourd'hui, mais un jour il le sera d'ailleurs, et le test
    // chercherait alors un fichier qu'il ne trouverait pas.
    const sql = readFileSync(resolve(__dirname, MIGRATION_REPRISE), 'utf8');
    /**
     * UNE INSTRUCTION À LA FOIS. MESURÉ : `$executeRawUnsafe` passe par une
     * requête PRÉPARÉE, et PostgreSQL y refuse plusieurs commandes —
     * `42601 cannot insert multiple commands into a prepared statement`. Le
     * fichier est donc découpé, et les lignes de COMMENTAIRE sont retirées
     * d'abord : l'en-tête de la migration contient des points-virgules de
     * ponctuation française, qui feraient des morceaux de phrase des « ordres »
     * SQL.
     */
    const rejouerLaReprise = async (): Promise<void> => {
      const ordres = sql
        .split('\n')
        .filter((ligne) => !ligne.trimStart().startsWith('--'))
        .join('\n')
        .split(';')
        .map((ordre) => ordre.trim())
        .filter((ordre) => ordre.length > 0);
      // Trois ordres : la page 1, le rattachement des versions, le déplacement
      // des commentaires. Si le fichier en gagne un, ce test doit le savoir.
      expect(ordres).toHaveLength(3);
      for (const ordre of ordres) await prisma.$executeRawUnsafe(ordre);
    };

    // ── PREMIER passage ─────────────────────────────────────────────────────
    await rejouerLaReprise();

    const reprise = await prisma.guidePage.findMany({
      where: { guideId: guide.id },
      select: { id: true, position: true, title: true, slug: true, currentVersionId: true },
    });
    expect(reprise).toHaveLength(1);
    const reprisePage = reprise[0];
    expect(reprisePage?.position).toBe(1);
    // Le titre du guide, et le slug que `slugifyGuideTitle` aurait produit — la
    // même règle, écrite deux fois dans deux langages, et qui doit tomber juste.
    expect(reprisePage?.title).toBe(guide.title);
    expect(reprisePage?.slug).toBe(slugifyGuideTitle(guide.title));
    // La version courante du guide est devenue celle de la page 1.
    const avant = await prisma.guide.findUniqueOrThrow({
      where: { id: guide.id },
      select: { currentVersionId: true },
    });
    expect(reprisePage?.currentVersionId).toBe(avant.currentVersionId);
    // Toutes les versions sont rattachées.
    expect(
      await prisma.guideVersion.count({ where: { guideId: guide.id, pageId: null } }),
    ).toBe(0);
    // Le commentaire a suivi, SANS changer d'identité : même ligne, même auteur.
    const deplace = await prisma.comment.findUniqueOrThrow({ where: { id: commentId } });
    expect(deplace.subjectType).toBe('GUIDE_PAGE');
    expect(deplace.subjectId).toBe(reprisePage?.id);
    expect(deplace.authorUserId).toBe(lecteur);

    // ── SECOND passage : l'idempotence, qui est la propriété qui compte ──────
    await rejouerLaReprise();

    const apres = await prisma.guidePage.findMany({ where: { guideId: guide.id } });
    expect(apres).toHaveLength(1);
    expect(apres[0]?.id).toBe(reprisePage?.id);
    expect(
      await prisma.comment.count({
        where: { subjectType: 'GUIDE_PAGE', subjectId: reprisePage?.id ?? '' },
      }),
    ).toBe(1);

    await prisma.comment.deleteMany({ where: { id: commentId } });
  });

  /**
   * UNE PROPOSITION ACCEPTÉE ÉCRIT DANS LA BONNE PAGE.
   *
   * C'est le défaut que les pages auraient introduit en silence :
   * `decideProposal` lisait `guide.currentVersion.body`, c'est-à-dire le reflet de
   * la PREMIÈRE page. Une correction sur la page 2 aurait été cherchée dans le
   * texte de la page 1, donc refusée pour toujours en `EXCERPT_NOT_FOUND`.
   */
  it('écrit une proposition acceptée dans la page du passage visé (§2.4)', async () => {
    const author = await newMember();
    const proposer = await newMember();
    const guide = await publishedGuide(author);
    const deuxieme = await guides.addPage(author, guide.id, {
      title: 'Le retrait du titre',
      body: `${body('Le retrait')}\n\nLe guichet ferme à seize heures précises.`,
    });
    const page2 = deuxieme.currentPage;
    const page1 = deuxieme.pages[0];

    const proposition = await guides.createProposal(proposer, guide.id, {
      targetExcerpt: 'Le guichet ferme à seize heures précises.',
      replacement: 'Le guichet ferme à dix-sept heures depuis la rentrée.',
      reason: 'Les horaires ont changé en septembre, vu sur place.',
    });
    await guides.decideProposal(author, proposition.id, { kind: 'ACCEPT' });

    const corpsPage2 = await prisma.guidePage.findUniqueOrThrow({
      where: { id: page2.id },
      select: { currentVersion: { select: { body: true } } },
    });
    expect(corpsPage2.currentVersion?.body).toContain('dix-sept heures');
    expect(corpsPage2.currentVersion?.body).not.toContain('seize heures');
    // Et la PREMIÈRE page n'a pas bougé : c'est le contre-exemple du défaut.
    const corpsPage1 = await prisma.guidePage.findUniqueOrThrow({
      where: { id: page1?.id ?? '' },
      select: { currentVersion: { select: { body: true } } },
    });
    expect(corpsPage1.currentVersion?.body).not.toContain('dix-sept heures');
    // `guide_id` reste juste sur la version créée — il porte les listes.
    const versions = await prisma.guideVersion.findMany({
      where: { guideId: guide.id },
      select: { guideId: true, pageId: true },
    });
    expect(versions.every((version) => version.guideId === guide.id)).toBe(true);
    expect(versions.some((version) => version.pageId === page2.id)).toBe(true);
  });

  it('balaye les images de TOUTES les pages (guide_media reste au niveau du guide)', async () => {
    const author = await newMember();
    const image1 = await mediaAsset(author);
    const image2 = await mediaAsset(author);

    const draft = await guides.createDraft(author, {
      title: 'Un guide illustré sur deux pages',
      body: `${body('La première')}\n\n![Capture](${image1.url})`,
      category: 'ARRIVAL',
      scope: 'UNIVERSAL',
    });
    guideIds.push(draft.id);
    expect(await prisma.guideMedia.count({ where: { guideId: draft.id } })).toBe(1);

    // L'image de la SECONDE page s'ajoute SANS effacer celle de la première :
    // c'est tout l'enjeu du balayage sur toutes les pages.
    await guides.addPage(author, draft.id, {
      title: 'La seconde page',
      body: `${body('La seconde')}\n\n![Autre](${image2.url})`,
    });
    const rattachees = await prisma.guideMedia.findMany({
      where: { guideId: draft.id },
      orderBy: { position: 'asc' },
      select: { mediaAssetId: true, position: true },
    });
    expect(rattachees.map((row) => row.mediaAssetId)).toEqual([image1.id, image2.id]);
    expect(rattachees.map((row) => row.position)).toEqual([0, 1]);

    // Modifier la PREMIÈRE page ne retire pas l'image de la seconde — c'est le
    // défaut qu'un balayage sur le seul corps modifié aurait produit.
    await guides.update(author, draft.id, {
      body: `${body('La première, revue')}\n\n![Capture](${image1.url})`,
    });
    expect(await prisma.guideMedia.count({ where: { guideId: draft.id } })).toBe(2);

    // Retirer la seconde page retire SON image, et garde l'autre.
    const pages = (await guides.bySlug(draft.slug, author)).pages;
    const seconde = pages[1];
    await guides.removePage(author, draft.id, seconde?.id ?? '');
    const restantes = await prisma.guideMedia.findMany({
      where: { guideId: draft.id },
      select: { mediaAssetId: true },
    });
    expect(restantes.map((row) => row.mediaAssetId)).toEqual([image1.id]);
  });

  it('tient `guides.current_version_id` à jour sur la PREMIÈRE page (colonne dépréciée)', async () => {
    const author = await newMember();
    const guide = await publishedGuide(author);
    const page1 = (await guides.bySlug(guide.slug, author)).currentPage;

    const deux = await guides.addPage(author, guide.id, {
      title: 'Une page de plus',
      body: body('Deux'),
    });
    // Écrire sur la SECONDE page ne touche pas le reflet : il suit la première.
    const refletApresPage2 = await prisma.guide.findUniqueOrThrow({
      where: { id: guide.id },
      select: { currentVersionId: true },
    });
    const version1 = await prisma.guidePage.findUniqueOrThrow({
      where: { id: page1.id },
      select: { currentVersionId: true },
    });
    expect(refletApresPage2.currentVersionId).toBe(version1.currentVersionId);
    expect(refletApresPage2.currentVersionId).not.toBe(deux.currentVersion?.id);

    // Écrire sur la PREMIÈRE page déplace le reflet avec elle.
    await guides.update(author, guide.id, {
      pageId: page1.id,
      body: `${body('La première, revue')}\n\nUn ajout.`,
    });
    const apres = await prisma.guide.findUniqueOrThrow({
      where: { id: guide.id },
      select: { currentVersionId: true },
    });
    const page1Apres = await prisma.guidePage.findUniqueOrThrow({
      where: { id: page1.id },
      select: { currentVersionId: true },
    });
    expect(apres.currentVersionId).toBe(page1Apres.currentVersionId);
    expect(apres.currentVersionId).not.toBe(refletApresPage2.currentVersionId);
  });

  it('écrit dans la page que `pageId` nomme, et 404 sur une page étrangère', async () => {
    const author = await newMember();
    const guide = await publishedGuide(author);
    const deux = await guides.addPage(author, guide.id, {
      title: 'La seconde',
      body: body('Deux'),
    });
    const page2 = deux.currentPage;

    const corps = `${body('La seconde, revue')}\n\nUne précision de plus.`;
    const patche = await guides.update(author, guide.id, { pageId: page2.id, body: corps });
    // La réponse NOMME la page écrite : sans `currentPage`, l'éditeur recevrait
    // le corps de la page 1 et croirait sa sauvegarde perdue.
    expect(patche.currentPage.id).toBe(page2.id);
    expect(patche.currentVersion?.body).toBe(corps);

    // `pageId` absent → la PREMIÈRE page, comme avant les pages.
    const sansPageId = await guides.update(author, guide.id, {
      body: `${body('La première, revue')}\n\nAutre chose.`,
    });
    expect(sansPageId.currentPage.position).toBe(1);

    // La page d'un AUTRE guide ne s'écrit pas par ici : 404, et non une écriture
    // silencieuse sur la page 1.
    const autre = await publishedGuide(author, { title: 'Un tout autre guide' });
    const pageAutre = (await guides.bySlug(autre.slug, author)).currentPage;
    await expect(
      guides.update(author, guide.id, { pageId: pageAutre.id, body: body('Ailleurs') }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ `GET /guides/:slug/editor` — LA LECTURE QUI MANQUAIT À L'AUTEUR          ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * CE CAS A UN CONTRE-EXEMPLE, et c'est ce qui le rend utile : il vérifie que les
   * TROIS corps arrivent et qu'ils sont les BONS, page par page. Se contenter de
   * `pages.length === 3` aurait aussi passé avec trois corps vides, ou trois fois
   * le même — c'est-à-dire exactement le défaut que la route existe pour éviter.
   */
  it('rend toutes les pages AVEC leur corps à l’auteur, brouillon comme guide publié', async () => {
    const author = await newMember();
    const guide = await publishedGuide(author, { bodyText: body('La page une') });
    const deux = await guides.addPage(author, guide.id, {
      title: 'La page deux',
      body: body('La page deux'),
    });
    const trois = await guides.addPage(author, guide.id, {
      title: 'La page trois',
      body: body('La page trois'),
    });

    const lu = await guides.editorBySlug(guide.slug, author);

    // L'ORDRE EST CELUI DES POSITIONS, et non celui des insertions : c'est lui que
    // la barre latérale de l'éditeur dessine.
    expect(lu.pages.map((page) => page.position)).toEqual([1, 2, 3]);
    expect(lu.pages.map((page) => page.body)).toEqual([
      body('La page une'),
      body('La page deux'),
      body('La page trois'),
    ]);
    expect(lu.pages[1]?.id).toBe(deux.currentPage.id);
    expect(lu.pages[2]?.id).toBe(trois.currentPage.id);
    // `currentPage` est la PREMIÈRE, comme sur la route de lecture publique :
    // l'éditeur ouvre sur la page 1 et la barre latérale sert à aller ailleurs.
    expect(lu.currentPage.position).toBe(1);
    expect(lu.currentVersion?.body).toBe(body('La page une'));
    expect(lu.status).toBe('PUBLISHED');
    expect(lu.isAuthor).toBe(true);

    // UNE PAGE SANS CORPS REND LA CHAÎNE VIDE, et non `null` : `POST /pages` rend
    // `body` facultatif, donc c'est un cas NORMAL — l'éditeur y met un
    // `<textarea>` vide.
    await guides.addPage(author, guide.id, { title: 'La page quatre' });
    const relu = await guides.editorBySlug(guide.slug, author);
    expect(relu.pages[3]?.body).toBe('');

    // ET ELLE SERT UN BROUILLON, ce que `GET /guides/:slug` ne fait pour personne.
    const brouillon = await guides.createDraft(author, {
      title: 'Un brouillon jamais publié',
      body: body('Le brouillon'),
      category: 'ARRIVAL',
      scope: 'UNIVERSAL',
    });
    guideIds.push(brouillon.id);
    const luBrouillon = await guides.editorBySlug(brouillon.slug, author);
    expect(luBrouillon.status).toBe('DRAFT');
    expect(luBrouillon.pages[0]?.body).toBe(body('Le brouillon'));
  });

  /**
   * LA RÈGLE D'ACCÈS N'EST PAS RÉÉCRITE PAR LA ROUTE : c'est `loadOwned`, le même
   * que les neuf écritures. Ce cas éprouve les DEUX refus qu'il distingue, et la
   * distinction n'est pas cosmétique — un `403` sur un brouillon d'autrui
   * révélerait qu'il existe.
   */
  it('refuse l’éditeur à qui n’est pas l’auteur : 404 sur un brouillon, NOT_AUTHOR sur un guide publié', async () => {
    const author = await newMember();
    const intrus = await newMember();

    const publie = await publishedGuide(author);
    await expect(guides.editorBySlug(publie.slug, intrus)).rejects.toMatchObject({
      code: 'NOT_AUTHOR',
    });

    const brouillon = await guides.createDraft(author, {
      title: 'Un brouillon qui ne se devine pas',
      body: body('Le brouillon'),
      category: 'ARRIVAL',
      scope: 'UNIVERSAL',
    });
    guideIds.push(brouillon.id);
    await expect(guides.editorBySlug(brouillon.slug, intrus)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    // Un slug inconnu répond comme un guide inexistant, et non comme un refus.
    await expect(guides.editorBySlug('ce-guide-n-existe-pas', author)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('compte les commentaires visibles de la PAGE LUE, réponses comprises', async () => {
    const author = await newMember();
    const lecteur = await newMember();
    const guide = await publishedGuide(author);
    /**
     * LE SUJET D'UN COMMENTAIRE EST LA PAGE, PLUS LE GUIDE.
     *
     * Ce cas écrivait `subjectType: 'GUIDE', subjectId: guide.id`. La prémisse a
     * changé — décision du porteur : « Les commentaires concernent donc une page
     * du guide. » Les lignes posées sur le GUIDE ne sont plus comptées par
     * personne, et `FeedService.assertSubjectVisible` refuse d'en créer de
     * nouvelles. Le sujet est donc l'identifiant de la page 1.
     */
    const page1 = (await guides.bySlug(guide.slug, lecteur)).currentPage;

    const commentaire = async (
      userId: string,
      texte: string,
      options: { parentCommentId?: string; status?: 'PUBLISHED' | 'HIDDEN' } = {},
    ): Promise<string> => {
      const id = newId();
      await prisma.comment.create({
        data: {
          id,
          subjectType: 'GUIDE_PAGE',
          subjectId: page1.id,
          authorUserId: userId,
          body: texte,
          status: options.status ?? 'PUBLISHED',
          ...(options.parentCommentId === undefined
            ? {}
            : { parentCommentId: options.parentCommentId }),
        },
      });
      return id;
    };

    // Le contre-exemple : sans lui, un compteur bloqué à zéro passerait.
    expect((await guides.bySlug(guide.slug, lecteur)).guide.commentCount).toBe(0);

    const racine = await commentaire(lecteur, 'La file du matin est bien réelle.');
    // UNE RÉPONSE COMPTE : §2.5 n'autorise qu'une profondeur et la liste imbrique
    // les réponses sous leur racine, donc elles sont toutes à l'écran.
    await commentaire(author, 'Merci, je l’ajoute au guide.', { parentCommentId: racine });
    /**
     * ╔══════════════════════════════════════════════════════════════════════╗
     * ║ UN COMMENTAIRE MASQUÉ COMPTE MAINTENANT — ET C'EST LE CHANGEMENT      ║
     * ╚══════════════════════════════════════════════════════════════════════╝
     *
     * Ce cas attendait 2 et disait : « Un commentaire MASQUÉ par la modération ne
     * compte pas, parce qu'il ne s'affiche pas. » La PRÉMISSE a changé, pas la
     * règle : depuis que la colonne « ÉTATS » de A01C est montée, un commentaire
     * masqué LAISSE UN EMPLACEMENT — un bloc gris « Ce commentaire a été retiré
     * par la modération. » C'est une LIGNE RENDUE, donc elle compte.
     *
     * La règle est restée la même, et c'est elle qui impose le nouveau nombre :
     * le compteur dit ce que la liste montre. « 2 COMMENTAIRES » au-dessus de
     * trois lignes serait le mensonge exact que `common/comment-visibility.ts`
     * existe pour empêcher.
     */
    await commentaire(lecteur, 'Un message masqué.', { status: 'HIDDEN' });

    expect((await guides.bySlug(guide.slug, lecteur)).guide.commentCount).toBe(3);
    // Un visiteur anonyme voit le même nombre : aucun blocage ne le concerne.
    expect((await guides.bySlug(guide.slug, null)).guide.commentCount).toBe(3);

    /**
     * ET IL DÉPEND DU LECTEUR. Un membre séparé du commentateur ne voit ni son
     * message dans la liste, ni son unité dans le compteur (08 §4) — ET CELA VAUT
     * AUSSI POUR L'EMPLACEMENT : un commentaire masqué d'un membre bloqué ne
     * laisse AUCUNE trace, sinon le fil deviendrait un détecteur de blocage.
     *
     * ⚠ CE CAS ATTENDAIT 1, ET C'ÉTAIT UN ÉCART LATENT — mesuré, et ce lot le
     * ferme. La réponse de `author` est restée visible dans le compteur alors que
     * SA RACINE, écrite par `lecteur`, est cachée à `sépare` : la liste ne va
     * chercher les réponses que sous les racines qu'elle a retenues, donc elle
     * n'en montrait aucune. Le compteur annonçait « 1 RÉPONSE » au-dessus d'un fil
     * vide. `commentCountWhere` porte désormais la condition, et le nombre est 0 —
     * ce que la liste montre.
     */
    const sépare = await newMember();
    await prisma.block.create({
      data: { id: newId(), blockerUserId: sépare, blockedUserId: lecteur },
    });
    expect((await guides.bySlug(guide.slug, sépare)).guide.commentCount).toBe(0);
    await prisma.block.deleteMany({ where: { blockerUserId: sépare } });

    /**
     * LE TÉMOIN DU CHANGEMENT : la SUPPRESSION PAR L'AUTEUR, elle, ne compte
     * toujours pas. `deleted_at` la distingue d'un masquage de modération, et elle
     * ne laisse aucun emplacement — une personne qui retire son mot demande qu'il
     * disparaisse, pas qu'un rectangle gris annonce qu'elle a parlé.
     */
    await prisma.comment.create({
      data: {
        id: newId(),
        subjectType: 'GUIDE_PAGE',
        subjectId: page1.id,
        authorUserId: lecteur,
        body: 'Un message que son auteur retire.',
        status: 'REMOVED',
        deletedAt: new Date(),
      },
    });
    expect((await guides.bySlug(guide.slug, lecteur)).guide.commentCount).toBe(3);

    // LE PLAN PORTE LE MÊME NOMBRE, par page : c'est de lui que le TOTAL se
    // compose, et les deux doivent être d'accord — sinon « 3 » coifferait le fil
    // et « 4 » la carte de liste, pour les mêmes lignes.
    const vue = await guides.bySlug(guide.slug, lecteur);
    expect(vue.pages).toHaveLength(1);
    expect(vue.pages[0]?.commentCount).toBe(3);

    await prisma.comment.deleteMany({ where: { subjectId: page1.id } });
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

  it('refuse à la publication un texte que les règles locales du pipeline interdisent (§2.1)', async () => {
    const author = await newMember();
    const draft = await guides.createDraft(author, {
      title: 'Comment régler les frais de dossier',
      // Les règles locales sont celles du module 13 (`matchLocalRule`) : une
      // demande de versement ADRESSÉE AU MEMBRE est un motif de blocage.
      body: `${body('Les frais')}\n\nEnvoyez-moi 225 € sur mon compte avant de recevoir le formulaire.`,
      category: 'ARRIVAL',
      scope: 'UNIVERSAL',
    });
    guideIds.push(draft.id);

    await expect(guides.publish(author, draft.id)).rejects.toMatchObject({
      code: 'CONTENT_BLOCKED',
    });
    // Le guide reste un brouillon, et un dossier de priorité 1 attend l'équipe.
    expect((await prisma.guide.findUniqueOrThrow({ where: { id: draft.id } })).status).toBe('DRAFT');
    const cases = await prisma.moderationCase.findMany({
      where: { subjectType: 'GUIDE', subjectId: draft.id, source: 'AI' },
    });
    expect(cases).toHaveLength(1);
    expect(cases[0]?.priority).toBe(1);
  });

  it('ne publie plus par un appel direct à l’IA : le texte part au pipeline après la publication', async () => {
    const author = await newMember();
    const draft = await guides.createDraft(author, {
      title: 'Comment régler les frais de dossier',
      // Étiqueté MONEY_REQUEST par l'IA fictive, mais SANS motif local : la
      // publication passe, et c'est le pipeline asynchrone qui décidera.
      body: `${body('Les frais')}\n\nIl faut envoyer l'argent avant de recevoir le formulaire.`,
      category: 'ARRIVAL',
      scope: 'UNIVERSAL',
    });
    guideIds.push(draft.id);

    const published = await guides.publish(author, draft.id);
    expect(published.status).toBe('PUBLISHED');
    expect(
      await prisma.moderationCase.count({ where: { subjectType: 'GUIDE', subjectId: draft.id } }),
    ).toBe(0);
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
    /**
     * ╔══════════════════════════════════════════════════════════════════════╗
     * ║ UNE PAGE PAR ÉTAPE — ET C'EST CE QUI A CHANGÉ                        ║
     * ╚══════════════════════════════════════════════════════════════════════╝
     *
     * Ce cas cherchait `## Demander le visa étudiant` DANS LE CORPS : la
     * conversion écrivait un seul corps avec un intertitre Markdown par étape.
     * La PRÉMISSE a changé, pas la règle : A05 annonce « Une section par étape
     * de *Mes études à Lyon* a été pré-remplie », et une section d'un guide est
     * désormais une PAGE. Le `##` a disparu parce que le titre de la page EST
     * l'intertitre — l'y remettre afficherait deux titres superposés.
     *
     * Ce que le test vérifie est donc le PLAN, plus fort que l'ancienne
     * assertion : les étapes sont là, dans leur ordre, avec l'introduction en
     * tête et « Ce que je ferais différemment » en dernier (§2.8).
     */
    expect(draft.pages.map((page) => page.title)).toEqual([
      'Mon parcours en bref',
      'Demander le visa étudiant',
      'Trouver un logement',
      'Ce que je ferais différemment',
    ]);
    expect(draft.pages.map((page) => page.position)).toEqual([1, 2, 3, 4]);
    // La page lue par défaut est la PREMIÈRE, et son corps est celui de
    // l'introduction — pas celui d'une étape.
    expect(draft.currentPage.position).toBe(1);
    expect(draft.currentVersion?.body).toContain('Études');

    // La durée réelle (§2.8) est dans la page de l'étape, pas ailleurs.
    const etapeVisa = draft.pages[1];
    const corpsVisa = await prisma.guidePage.findUniqueOrThrow({
      where: { id: etapeVisa?.id ?? '' },
      select: { currentVersion: { select: { body: true } } },
    });
    expect(corpsVisa.currentVersion?.body).toContain('42 jours');
    // Et le titre n'est PAS répété en Markdown dans le corps.
    expect(corpsVisa.currentVersion?.body).not.toContain('## Demander le visa');

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
