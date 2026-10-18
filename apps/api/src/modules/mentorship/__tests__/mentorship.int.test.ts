import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import {
  MENTORSHIP_DURATION_MS,
  MENTORSHIP_REVIEW_WINDOW_MS,
} from '@app/shared';
import { AuditService } from '../../../common/audit.service';
import { CryptoService } from '../../../common/crypto.service';
import { OutboxService } from '../../../common/outbox.service';
import { PrismaService } from '../../../common/prisma.service';
import { VisibilityService } from '../../../common/visibility.service';
import { BlocksService } from '../../blocks/blocks.service';
import { ConnectionsService } from '../../connections/connections.service';
import { MessagingService } from '../../messaging/messaging.service';
import { MentorshipService } from '../mentorship.service';

/**
 * Parrainage — 08-parrainage-messagerie.md §2, §7.1 et §12.
 *
 * Les tests appellent le SERVICE, pas HTTP : les capacités (`mentor.become` L2,
 * `mentorship.request` L0) sont l'affaire du garde, déjà couverte par
 * capability-coverage.int.test.ts, et les faire passer ici demanderait un jeton par
 * cas sans rien ajouter aux règles du §2.
 *
 * Chaque règle dure du §12 qui relève du parrainage a son test, et chacun a été
 * éprouvé PAR MUTATION — la règle cassée volontairement, le test doit tomber. Un
 * test qui passe aussi avec le bogue ne protège rien.
 */
describe('parrainage (08 §2)', () => {
  let prisma: PrismaService;
  let mentorship: MentorshipService;
  let blocks: BlocksService;

  const createdUsers: string[] = [];
  const createdTemplates: string[] = [];
  let originCountryId: string;
  let cityId: string;
  let otherCityId: string;
  let counter = 0;

  /** Un parrain éligible par la voie « SETTLED depuis 12 mois » (§2.1). */
  async function member(
    options: {
      phase?: 'PRE_DEPARTURE' | 'RECENT_ARRIVAL' | 'SETTLED';
      level?: 'L0' | 'L1' | 'L2';
      arrivalYearsAgo?: number;
      cityId?: string;
    } = {},
  ): Promise<{ id: string; handle: string }> {
    counter += 1;
    const id = newId();
    const handle = `par${counter}${id.slice(-8)}`;
    const arrival =
      options.arrivalYearsAgo === undefined
        ? null
        : new Date(Date.now() - options.arrivalYearsAgo * 365 * 86_400_000);
    await prisma.user.create({
      data: {
        id,
        handle,
        displayName: `Membre ${counter}`,
        phase: options.phase ?? 'SETTLED',
        verificationLevel: options.level ?? 'L2',
        originCountryId,
        cityId: options.cityId ?? cityId,
        plan: 'FREE',
        status: 'ACTIVE',
        arrivalDate: arrival,
      },
    });
    createdUsers.push(id);
    return { id, handle };
  }

  /** Un parrain avec son profil, éligible et disponible. */
  async function mentor(maxMentees = 2): Promise<{ id: string; handle: string }> {
    const user = await member({ phase: 'SETTLED', arrivalYearsAgo: 2 });
    await mentorship.upsertProfile(user.id, {
      bio: 'J’accompagne les nouveaux arrivants depuis deux ans, avec plaisir.',
      journeyTemplateIds: [],
      maxMentees,
      isAvailable: true,
    });
    return user;
  }

  const LONG_MESSAGE =
    'Bonjour, je prépare mon départ et je cherche quelqu’un qui connaît les démarches locales pour m’aider.';

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    const outbox = new OutboxService(prisma);
    const audit = new AuditService(prisma);
    const visibility = new VisibilityService(prisma);
    const crypto = new CryptoService();
    const connections = new ConnectionsService(prisma, outbox, audit, visibility);
    const messaging = new MessagingService(
      prisma,
      crypto,
      outbox,
      audit,
      visibility,
      connections,
    );
    mentorship = new MentorshipService(prisma, outbox, audit, visibility, messaging);
    blocks = new BlocksService(prisma, outbox, audit);

    const country = await prisma.country.findFirstOrThrow({
      where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } },
      select: { id: true },
    });
    originCountryId = country.id;

    const cities = await prisma.city.findMany({ take: 2, select: { id: true } });
    cityId = cities[0]!.id;
    otherCityId = cities[1]!.id;
  });

  afterAll(async () => {
    if (createdUsers.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    }
    if (createdTemplates.length > 0) {
      await prisma.journeyTemplate.deleteMany({ where: { id: { in: createdTemplates } } });
    }
    await prisma.$disconnect();
  });

  // ── §2.1 Devenir parrain ──────────────────────────────────────────────────

  it('refuse MENTOR_NOT_ELIGIBLE sans parcours terminé ni ancienneté', async () => {
    const user = await member({ phase: 'RECENT_ARRIVAL', arrivalYearsAgo: 0 });
    await expect(
      mentorship.upsertProfile(user.id, {
        bio: 'Je veux aider les autres, même si je viens juste d’arriver ici.',
        journeyTemplateIds: [],
        maxMentees: 2,
        isAvailable: true,
      }),
    ).rejects.toMatchObject({ code: 'MENTOR_NOT_ELIGIBLE' });
  });

  it('accepte un parrain SETTLED depuis plus de 12 mois', async () => {
    const user = await mentor();
    const profile = await prisma.mentorProfile.findUniqueOrThrow({ where: { userId: user.id } });
    expect(profile.isAvailable).toBe(true);
    expect(profile.maxMentees).toBe(2);
  });

  it('accepte un parrain qui a un parcours COMPLETED, même arrivé hier', async () => {
    const user = await member({ phase: 'RECENT_ARRIVAL', arrivalYearsAgo: 0 });

    const templateId = newId();
    await prisma.journeyTemplate.create({
      data: {
        id: templateId,
        code: `test-tpl-${templateId.slice(-8)}`,
        nameFr: 'Modèle de test',
        targetPhase: 'PRE_DEPARTURE',
        isActive: true,
        sortOrder: 1,
      },
    });
    createdTemplates.push(templateId);
    const versionId = newId();
    await prisma.journeyTemplateVersion.create({
      data: { id: versionId, templateId, version: 1, status: 'PUBLISHED' },
    });
    await prisma.journey.create({
      data: {
        id: newId(),
        ownerUserId: user.id,
        templateVersionId: versionId,
        title: 'Mon parcours terminé',
        status: 'COMPLETED',
        originCountryId,
        destinationCityId: cityId,
        lastActivityAt: new Date(),
      },
    });

    await expect(
      mentorship.upsertProfile(user.id, {
        bio: 'J’ai terminé mon parcours et je souhaite accompagner d’autres personnes.',
        journeyTemplateIds: [templateId],
        maxMentees: 2,
        isAvailable: true,
      }),
    ).resolves.toMatchObject({ availability: 'AVAILABLE' });
  });

  it('se désactiver conserve la ligne et ses compteurs (§2.1)', async () => {
    const user = await mentor();
    await mentorship.disableProfile(user.id);
    const profile = await prisma.mentorProfile.findUniqueOrThrow({ where: { userId: user.id } });
    expect(profile.isAvailable).toBe(false);
    expect(profile.disabledAt).not.toBeNull();
  });

  // ── §2.2 Demander un parrain ──────────────────────────────────────────────

  it('crée la demande et émet `mentorship.requested`', async () => {
    const m = await mentor();
    const mentee = await member({ phase: 'PRE_DEPARTURE', level: 'L0' });

    const request = await mentorship.request(mentee.id, {
      mentorHandle: m.handle,
      message: LONG_MESSAGE,
    });
    expect(request.status).toBe('REQUESTED');

    const event = await prisma.domainEvent.findFirst({
      where: { type: 'mentorship.requested', aggregateId: request.id },
    });
    expect(event).not.toBeNull();
  });

  it('[RÈGLE DURE §12] une seule demande REQUESTED à la fois', async () => {
    const a = await mentor();
    const b = await mentor();
    const mentee = await member({ phase: 'PRE_DEPARTURE', level: 'L0' });

    await mentorship.request(mentee.id, { mentorHandle: a.handle, message: LONG_MESSAGE });
    await expect(
      mentorship.request(mentee.id, { mentorHandle: b.handle, message: LONG_MESSAGE }),
    ).rejects.toMatchObject({ code: 'PENDING_REQUEST_EXISTS' });
  });

  it('une demande périmée libère le membre, avant même la tâche (§2.2)', async () => {
    const a = await mentor();
    const b = await mentor();
    const mentee = await member({ phase: 'PRE_DEPARTURE', level: 'L0' });

    const first = await mentorship.request(mentee.id, {
      mentorHandle: a.handle,
      message: LONG_MESSAGE,
    });
    // L'échéance est la colonne `expires_at` de §6 (posée à la demande). On la
    // recule, et la lecture doit déjà considérer la demande expirée. (Le repli sur
    // `created_at` d'une ligne sans échéance a son propre test, dans
    // `mentorship-colonnes.int.test.ts`.)
    await prisma.mentorship.update({
      where: { id: first.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(
      mentorship.request(mentee.id, { mentorHandle: b.handle, message: LONG_MESSAGE }),
    ).resolves.toMatchObject({ status: 'REQUESTED' });
  });

  it('refuse BLOCKED_RELATIONSHIP vers un parrain bloqué, dans les deux sens (§2.2)', async () => {
    const m = await mentor();
    const mentee = await member({ phase: 'PRE_DEPARTURE', level: 'L0' });

    await blocks.block(mentee.id, m.handle);
    await expect(
      mentorship.request(mentee.id, { mentorHandle: m.handle, message: LONG_MESSAGE }),
    ).rejects.toMatchObject({ code: 'BLOCKED_RELATIONSHIP' });

    // Et dans l'autre sens : c'est le parrain qui a bloqué.
    const m2 = await mentor();
    const mentee2 = await member({ phase: 'PRE_DEPARTURE', level: 'L0' });
    await blocks.block(m2.id, mentee2.handle);
    await expect(
      mentorship.request(mentee2.id, { mentorHandle: m2.handle, message: LONG_MESSAGE }),
    ).rejects.toMatchObject({ code: 'BLOCKED_RELATIONSHIP' });
  });

  it('refuse MENTOR_FULL sur un parrain complet, dès la demande', async () => {
    const m = await mentor(1);
    const first = await member({ phase: 'PRE_DEPARTURE', level: 'L0' });
    const second = await member({ phase: 'PRE_DEPARTURE', level: 'L0' });

    const request = await mentorship.request(first.id, {
      mentorHandle: m.handle,
      message: LONG_MESSAGE,
    });
    await mentorship.accept(request.id, m.id);

    await expect(
      mentorship.request(second.id, { mentorHandle: m.handle, message: LONG_MESSAGE }),
    ).rejects.toMatchObject({ code: 'MENTOR_FULL' });
  });

  // ── §2.3 Parrainage actif ─────────────────────────────────────────────────

  it('l’acceptation pose ACTIVE, ends_at à 90 jours, le compteur et la conversation', async () => {
    const m = await mentor();
    const mentee = await member({ phase: 'PRE_DEPARTURE', level: 'L0' });
    const request = await mentorship.request(mentee.id, {
      mentorHandle: m.handle,
      message: LONG_MESSAGE,
    });

    const accepted = await mentorship.accept(request.id, m.id);
    expect(accepted.status).toBe('ACTIVE');
    expect(accepted.conversationId).toBeTruthy();

    const row = await prisma.mentorship.findUniqueOrThrow({ where: { id: request.id } });
    expect(row.acceptedAt).not.toBeNull();
    const span = row.endsAt!.getTime() - row.acceptedAt!.getTime();
    expect(Math.abs(span - MENTORSHIP_DURATION_MS)).toBeLessThan(5_000);

    const profile = await prisma.mentorProfile.findUniqueOrThrow({ where: { userId: m.id } });
    expect(profile.activeMenteeCount).toBe(1);

    // La conversation MENTORSHIP existe, avec ses deux membres (§5.1).
    const members = await prisma.conversationMember.findMany({
      where: { conversationId: accepted.conversationId },
      select: { userId: true },
    });
    expect(members.map((x) => x.userId).sort()).toEqual([m.id, mentee.id].sort());
  });

  /**
   * LA règle dure du §12 : « un parrain à `max_mentees` refuse toute nouvelle
   * acceptation ».
   *
   * Le cas qui compte n'est pas « demander à un parrain complet » — celui-là est
   * refusé plus haut — mais « accepter alors qu'on est devenu complet entre-temps ».
   * Les deux demandes sont créées AVANT la première acceptation, ce que le filtre
   * de la demande ne peut pas voir.
   *
   * MUTATION éprouvée : en retirant le contrôle `activeMenteeCount >= maxMentees`
   * de `accept()`, ce test tombe (le second accept réussit et le compteur passe
   * à 2) alors que tous les autres passent.
   */
  it('[RÈGLE DURE §12] un parrain à max_mentees refuse TOUTE nouvelle acceptation', async () => {
    const m = await mentor(1);
    const first = await member({ phase: 'PRE_DEPARTURE', level: 'L0' });
    const second = await member({ phase: 'PRE_DEPARTURE', level: 'L0' });

    const a = await mentorship.request(first.id, {
      mentorHandle: m.handle,
      message: LONG_MESSAGE,
    });
    const b = await mentorship.request(second.id, {
      mentorHandle: m.handle,
      message: LONG_MESSAGE,
    });

    await mentorship.accept(a.id, m.id);
    await expect(mentorship.accept(b.id, m.id)).rejects.toMatchObject({ code: 'MENTOR_FULL' });

    const profile = await prisma.mentorProfile.findUniqueOrThrow({ where: { userId: m.id } });
    expect(profile.activeMenteeCount).toBe(1);
  });

  it('le refus est sans motif et n’entame aucun compteur', async () => {
    const m = await mentor();
    const mentee = await member({ phase: 'PRE_DEPARTURE', level: 'L0' });
    const request = await mentorship.request(mentee.id, {
      mentorHandle: m.handle,
      message: LONG_MESSAGE,
    });

    await mentorship.decline(request.id, m.id);
    const row = await prisma.mentorship.findUniqueOrThrow({ where: { id: request.id } });
    expect(row.status).toBe('DECLINED');
    expect(row.endReason).toBeNull();

    const profile = await prisma.mentorProfile.findUniqueOrThrow({ where: { userId: m.id } });
    expect(profile.activeMenteeCount).toBe(0);
  });

  it('un tiers ne peut ni accepter ni refuser (404, jamais 403)', async () => {
    const m = await mentor();
    const mentee = await member({ phase: 'PRE_DEPARTURE', level: 'L0' });
    const stranger = await member();
    const request = await mentorship.request(mentee.id, {
      mentorHandle: m.handle,
      message: LONG_MESSAGE,
    });

    await expect(mentorship.accept(request.id, stranger.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    // Le filleul lui-même n'accepte pas sa propre demande.
    await expect(mentorship.accept(request.id, mentee.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  // ── §2.4 Fin, prolongation, évaluation ────────────────────────────────────

  it('la fin unilatérale porte MENTOR_LEFT ou MENTEE_LEFT et libère le compteur', async () => {
    const m = await mentor();
    const mentee = await member({ phase: 'PRE_DEPARTURE', level: 'L0' });
    const request = await mentorship.request(mentee.id, {
      mentorHandle: m.handle,
      message: LONG_MESSAGE,
    });
    await mentorship.accept(request.id, m.id);

    const ended = await mentorship.end(request.id, mentee.id);
    expect(ended.endReason).toBe('MENTEE_LEFT');

    const profile = await prisma.mentorProfile.findUniqueOrThrow({ where: { userId: m.id } });
    expect(profile.activeMenteeCount).toBe(0);
    // Pas de réputation sur une fin unilatérale : personne n'a mené le parrainage
    // à son terme.
    expect(
      await prisma.reputationEvent.count({
        where: { userId: m.id, type: 'MENTORSHIP_COMPLETED', sourceId: request.id },
      }),
    ).toBe(0);
  });

  it('la tâche end_due termine en COMPLETED : réputation, compteur, statistiques', async () => {
    const m = await mentor();
    const mentee = await member({ phase: 'PRE_DEPARTURE', level: 'L0' });
    const request = await mentorship.request(mentee.id, {
      mentorHandle: m.handle,
      message: LONG_MESSAGE,
    });
    await mentorship.accept(request.id, m.id);
    // Échéance atteinte.
    await prisma.mentorship.update({
      where: { id: request.id },
      data: { endsAt: new Date(Date.now() - 1000) },
    });

    expect(await mentorship.endDueMentorships()).toBeGreaterThanOrEqual(1);

    const row = await prisma.mentorship.findUniqueOrThrow({ where: { id: request.id } });
    expect(row.status).toBe('ENDED');
    expect(row.endReason).toBe('COMPLETED');

    const profile = await prisma.mentorProfile.findUniqueOrThrow({ where: { userId: m.id } });
    expect(profile.completedCount).toBe(1);
    expect(profile.activeMenteeCount).toBe(0);
    expect(
      await prisma.reputationEvent.count({
        where: { userId: m.id, type: 'MENTORSHIP_COMPLETED', sourceId: request.id },
      }),
    ).toBe(1);
    const stats = await prisma.userStats.findUniqueOrThrow({ where: { userId: m.id } });
    expect(stats.mentorshipsCompleted).toBe(1);
  });

  /**
   * IDEMPOTENCE de la fin : la livraison des événements est « au moins une fois »,
   * et la tâche quotidienne peut repasser. Ni le compteur de parrainages menés ni
   * la réputation ne doivent bouger deux fois.
   *
   * C'est exactement le bogue que le module entraide avait connu : `skipDuplicates`
   * protégeait `reputation_events`, mais le compteur affiché s'incrémentait à
   * chaque appel.
   */
  it('terminer deux fois ne double ni la réputation ni completed_count', async () => {
    const m = await mentor();
    const mentee = await member({ phase: 'PRE_DEPARTURE', level: 'L0' });
    const request = await mentorship.request(mentee.id, {
      mentorHandle: m.handle,
      message: LONG_MESSAGE,
    });
    await mentorship.accept(request.id, m.id);
    await prisma.mentorship.update({
      where: { id: request.id },
      data: { endsAt: new Date(Date.now() - 1000) },
    });

    await mentorship.endDueMentorships();
    await mentorship.endDueMentorships();

    const profile = await prisma.mentorProfile.findUniqueOrThrow({ where: { userId: m.id } });
    expect(profile.completedCount).toBe(1);
    expect(profile.activeMenteeCount).toBe(0);
    expect(
      await prisma.reputationEvent.count({
        where: { userId: m.id, type: 'MENTORSHIP_COMPLETED', sourceId: request.id },
      }),
    ).toBe(1);
  });

  it('la prolongation ajoute 90 jours, une seule fois (ALREADY_EXTENDED)', async () => {
    const m = await mentor();
    const mentee = await member({ phase: 'PRE_DEPARTURE', level: 'L0' });
    const request = await mentorship.request(mentee.id, {
      mentorHandle: m.handle,
      message: LONG_MESSAGE,
    });
    const accepted = await mentorship.accept(request.id, m.id);

    const extended = await mentorship.extend(request.id, mentee.id);
    const added = extended.endsAt.getTime() - accepted.endsAt.getTime();
    expect(Math.abs(added - MENTORSHIP_DURATION_MS)).toBeLessThan(5_000);

    // §2.4 : « une fois ». Déduit de `ends_at > accepted_at + 90 jours`, faute de
    // la colonne `extended_once` de §6.
    await expect(mentorship.extend(request.id, m.id)).rejects.toMatchObject({
      code: 'ALREADY_EXTENDED',
    });
  });

  it('l’évaluation mutuelle n’est visible qu’une fois les deux déposées (§2.4)', async () => {
    const m = await mentor();
    const mentee = await member({ phase: 'PRE_DEPARTURE', level: 'L0' });
    const request = await mentorship.request(mentee.id, {
      mentorHandle: m.handle,
      message: LONG_MESSAGE,
    });
    await mentorship.accept(request.id, m.id);
    await prisma.mentorship.update({
      where: { id: request.id },
      data: { endsAt: new Date(Date.now() - 1000) },
    });
    await mentorship.endDueMentorships();

    await mentorship.review(request.id, mentee.id, { rating: 5, comment: 'Très aidant.' });

    // Une seule évaluation déposée : le parrain ne voit pas encore celle du filleul.
    const beforeBoth = await mentorship.myMentorships(m.id, { role: 'all', state: 'all' });
    const asMentor = beforeBoth.items.find((i) => i.id === request.id);
    expect(asMentor?.theirReview).toBeNull();

    await mentorship.review(request.id, m.id, { rating: 4 });

    const afterBoth = await mentorship.myMentorships(m.id, { role: 'all', state: 'all' });
    expect(afterBoth.items.find((i) => i.id === request.id)?.theirReview?.rating).toBe(5);

    // La note moyenne du parrain est recalculée (§2.4).
    const profile = await prisma.mentorProfile.findUniqueOrThrow({ where: { userId: m.id } });
    expect(Number(profile.avgRating)).toBe(5);
  });

  /**
   * LA FICHE DU PARRAIN RESTAIT MUETTE QUATORZE JOURS, et aucun test ne le voyait.
   *
   * §2.4 : « visible seulement une fois les deux évaluations déposées OU après
   * 14 jours ». Le test ci-dessus éprouve `myMentorships`, qui comptait juste — il
   * lit les deux évaluations de LA LIGNE du parrainage. `mentorCard`, lui, passe
   * par `visibleReviewsFor`, qui comptait les évaluations dont le membre est le
   * SUJET : au plus UNE par parrainage, puisque `mentorship_reviews` porte
   * `@@unique(mentorship_id, reviewer_user_id)` et qu'un parrainage n'a que deux
   * parties. Son test `>= 2` ne pouvait donc JAMAIS être vrai, et seule la fenêtre
   * de quatorze jours rendait une évaluation visible.
   *
   * CE TEST SE TIENT DANS LA FENÊTRE EXPRÈS : le parrainage vient de se terminer,
   * donc `windowOver` est faux et la première branche est la SEULE qui puisse
   * rendre l'évaluation visible. C'est ce qui le fait rougir sur le code d'avant.
   *
   * MUTATION TÉMOIN — remettre `visibleReviewsFor` à sa forme d'origine, c'est-à-dire
   * remplacer `review.mentorship._count.reviews >= MENTORSHIP_REVIEWS_BOTH_IN` par
   * un comptage par parrainage des lignes de la page, fait échouer l'attente
   * « 1 évaluation » ci-dessous avec `reviews: []`.
   */
  it('[§2.4] la fiche du parrain montre l’évaluation dès que les DEUX sont déposées, sans attendre 14 jours', async () => {
    const m = await mentor();
    const mentee = await member({ phase: 'PRE_DEPARTURE', level: 'L0' });
    const request = await mentorship.request(mentee.id, {
      mentorHandle: m.handle,
      message: LONG_MESSAGE,
    });
    await mentorship.accept(request.id, m.id);
    await prisma.mentorship.update({
      where: { id: request.id },
      data: { endsAt: new Date(Date.now() - 1000) },
    });
    await mentorship.endDueMentorships();

    // La fenêtre de 14 jours est GRANDE OUVERTE : `ended_at` est à l'instant.
    const ended = await prisma.mentorship.findUniqueOrThrow({
      where: { id: request.id },
      select: { endedAt: true },
    });
    const endedAt = ended.endedAt;
    expect(endedAt).not.toBeNull();
    expect(Date.now() - (endedAt as Date).getTime()).toBeLessThan(MENTORSHIP_REVIEW_WINDOW_MS);

    // Aucune évaluation : la fiche est muette, et c'est juste.
    expect((await mentorship.mentorCard(m.handle, m.id)).reviews).toEqual([]);

    // UNE SEULE déposée : elle doit rester muette (ni les deux, ni 14 jours).
    await mentorship.review(request.id, mentee.id, { rating: 5, comment: 'Très aidant.' });
    expect((await mentorship.mentorCard(m.handle, m.id)).reviews).toEqual([]);

    // LES DEUX déposées : l'évaluation du parrain paraît IMMÉDIATEMENT.
    await mentorship.review(request.id, m.id, { rating: 4 });
    const card = await mentorship.mentorCard(m.handle, m.id);
    expect(card.reviews).toHaveLength(1);
    expect(card.reviews[0]?.rating).toBe(5);
    expect(card.reviews[0]?.reviewer?.handle).toBe(mentee.handle);
  });

  /**
   * L'AUTRE MOITIÉ de §2.4 : « ou après 14 jours ».
   *
   * Sans ce test, la correction précédente pourrait se réduire à « visible dès
   * qu'il y a deux évaluations », et la fenêtre — qui protège le cas où l'autre
   * partie ne répond jamais — redeviendrait du code mort, dans l'autre sens.
   */
  it('[§2.4] passé 14 jours, une évaluation SEULE paraît quand même', async () => {
    const m = await mentor();
    const mentee = await member({ phase: 'PRE_DEPARTURE', level: 'L0' });
    const request = await mentorship.request(mentee.id, {
      mentorHandle: m.handle,
      message: LONG_MESSAGE,
    });
    await mentorship.accept(request.id, m.id);
    await prisma.mentorship.update({
      where: { id: request.id },
      data: { endsAt: new Date(Date.now() - 1000) },
    });
    await mentorship.endDueMentorships();
    await mentorship.review(request.id, mentee.id, { rating: 3, comment: 'Correct.' });

    // Dans la fenêtre, une seule déposée : muette.
    expect((await mentorship.mentorCard(m.handle, m.id)).reviews).toEqual([]);

    // La fenêtre passe. La seconde évaluation n'est jamais venue.
    await prisma.mentorship.update({
      where: { id: request.id },
      data: { endedAt: new Date(Date.now() - MENTORSHIP_REVIEW_WINDOW_MS - 1000) },
    });
    const card = await mentorship.mentorCard(m.handle, m.id);
    expect(card.reviews).toHaveLength(1);
    expect(card.reviews[0]?.rating).toBe(3);
  });

  it('refuse REVIEW_WINDOW_CLOSED hors des 14 jours et sur une fin non COMPLETED', async () => {
    const m = await mentor();
    const mentee = await member({ phase: 'PRE_DEPARTURE', level: 'L0' });
    const request = await mentorship.request(mentee.id, {
      mentorHandle: m.handle,
      message: LONG_MESSAGE,
    });
    await mentorship.accept(request.id, m.id);
    await mentorship.end(request.id, mentee.id);

    // Fin unilatérale : rien à évaluer.
    await expect(
      mentorship.review(request.id, mentee.id, { rating: 5 }),
    ).rejects.toMatchObject({ code: 'REVIEW_WINDOW_CLOSED' });

    // Et une clôture COMPLETED vieille de plus de 14 jours est fermée elle aussi.
    const m2 = await mentor();
    const mentee2 = await member({ phase: 'PRE_DEPARTURE', level: 'L0' });
    const r2 = await mentorship.request(mentee2.id, {
      mentorHandle: m2.handle,
      message: LONG_MESSAGE,
    });
    await mentorship.accept(r2.id, m2.id);
    await prisma.mentorship.update({
      where: { id: r2.id },
      data: { endsAt: new Date(Date.now() - 1000) },
    });
    await mentorship.endDueMentorships();
    await prisma.mentorship.update({
      where: { id: r2.id },
      data: { endedAt: new Date(Date.now() - MENTORSHIP_REVIEW_WINDOW_MS - 1000) },
    });

    await expect(mentorship.review(r2.id, mentee2.id, { rating: 5 })).rejects.toMatchObject({
      code: 'REVIEW_WINDOW_CLOSED',
    });
  });

  // ── §2.2 Liste et filtres ─────────────────────────────────────────────────

  /**
   * LE test du piège des filtres : les quatre filtres de §2.2 portent tous sur la
   * relation `user`, et trois diffusions conditionnelles posant chacune
   * `user: { … }` s'écraseraient silencieusement — la dernière gagne, sans un mot
   * de `tsc`.
   *
   * Un test par filtre passerait MALGRÉ l'écrasement. Celui-ci combine ville, pays
   * et langue, et c'est la seule forme qui l'attrape.
   *
   * MUTATION éprouvée : en remplaçant le sous-objet `user` cumulatif par trois
   * diffusions séparées (`...{ user: { cityId } }, ...{ user: { originCountryId } },
   * ...{ user: { languages } }`), ce test tombe — le parrain de la mauvaise ville
   * ressort — alors que les tests mono-filtre passent tous.
   */
  it('combine ville + pays + langue sans qu’un filtre écrase l’autre', async () => {
    const language = await prisma.language.findFirstOrThrow({ select: { id: true } });
    const otherLanguage = await prisma.language.findFirst({
      where: { id: { not: language.id } },
      select: { id: true },
    });

    const wanted = await mentor();
    await prisma.userLanguage.create({ data: { userId: wanted.id, languageId: language.id } });

    // Même pays, même langue, MAUVAISE ville.
    const wrongCity = await member({ phase: 'SETTLED', arrivalYearsAgo: 2, cityId: otherCityId });
    await mentorship.upsertProfile(wrongCity.id, {
      bio: 'Je suis dans une autre ville mais je parle la même langue que vous.',
      journeyTemplateIds: [],
      maxMentees: 2,
      isAvailable: true,
    });
    await prisma.userLanguage.create({ data: { userId: wrongCity.id, languageId: language.id } });

    // Même ville, même pays, MAUVAISE langue.
    const wrongLanguage = await mentor();
    if (otherLanguage !== null) {
      await prisma.userLanguage.create({
        data: { userId: wrongLanguage.id, languageId: otherLanguage.id },
      });
    }

    const page = await mentorship.listMentors(
      { cityId, countryId: originCountryId, languageId: language.id, limit: 50 },
      null,
    );
    const ids = page.items.map((i) => i.userId);
    expect(ids).toContain(wanted.id);
    expect(ids).not.toContain(wrongCity.id);
    expect(ids).not.toContain(wrongLanguage.id);
  });

  it('trie les disponibles d’abord, puis la note, puis les parrainages menés (§2.2)', async () => {
    const full = await mentor(1);
    const mentee = await member({ phase: 'PRE_DEPARTURE', level: 'L0' });
    const request = await mentorship.request(mentee.id, {
      mentorHandle: full.handle,
      message: LONG_MESSAGE,
    });
    await mentorship.accept(request.id, full.id);

    const available = await mentor();

    const page = await mentorship.listMentors({ cityId, limit: 50 }, null);
    const positions = page.items.map((i) => i.userId);
    expect(positions.indexOf(available.id)).toBeLessThan(positions.indexOf(full.id));
    expect(page.items.find((i) => i.userId === full.id)?.availability).toBe('FULL');
  });

  it('un membre bloqué disparaît de la liste des parrains, dans les deux sens (§4)', async () => {
    const m = await mentor();
    const viewer = await member();

    expect((await mentorship.listMentors({ cityId, limit: 50 }, viewer.id)).items).toEqual(
      expect.arrayContaining([expect.objectContaining({ userId: m.id })]),
    );

    await blocks.block(viewer.id, m.handle);
    const after = await mentorship.listMentors({ cityId, limit: 50 }, viewer.id);
    expect(after.items.map((i) => i.userId)).not.toContain(m.id);
    // Et la fiche renvoie 404, jamais 403 (T4 §3).
    await expect(mentorship.mentorCard(m.handle, viewer.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('un code de type de parcours inconnu rend une liste vide, jamais tous les parrains', async () => {
    await mentor();
    const page = await mentorship.listMentors(
      { templateCode: 'ce-code-n-existe-pas', limit: 50 },
      null,
    );
    expect(page.items).toEqual([]);
  });

  /**
   * RÈGLE DURE (§3.2) : « Aucun compteur public de contacts. » La fiche d'un parrain
   * est la surface la plus tentante pour en ajouter un — c'est là qu'on veut
   * « rassurer » sur la popularité.
   */
  it('[RÈGLE DURE §3.2] la fiche d’un parrain ne porte aucun compteur de contacts', async () => {
    const m = await mentor();
    const viewer = await member();
    const card = await mentorship.mentorCard(m.handle, viewer.id);
    const keys = Object.keys(card);
    expect(keys.filter((k) => /connection/i.test(k))).toEqual([]);
    expect(JSON.stringify(card)).not.toContain('connectionCount');
  });

  it('le bandeau « jamais d’argent » accompagne toutes les réponses (règle dure §2.4)', async () => {
    const m = await mentor();
    const mentee = await member({ phase: 'PRE_DEPARTURE', level: 'L0' });

    for (const response of [
      await mentorship.listMentors({ limit: 5 }, null),
      await mentorship.mentorCard(m.handle, null),
      await mentorship.myMentorships(mentee.id, { role: 'all', state: 'all' }),
    ]) {
      expect((response.meta as { moneyBanner?: string }).moneyBanner).toContain('gratuit');
    }
  });

  it('la tâche expire_requests annule les demandes de plus de 7 jours', async () => {
    const m = await mentor();
    const mentee = await member({ phase: 'PRE_DEPARTURE', level: 'L0' });
    const request = await mentorship.request(mentee.id, {
      mentorHandle: m.handle,
      message: LONG_MESSAGE,
    });
    await prisma.mentorship.update({
      where: { id: request.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect(await mentorship.expireRequests()).toBeGreaterThanOrEqual(1);
    const row = await prisma.mentorship.findUniqueOrThrow({ where: { id: request.id } });
    expect(row.status).toBe('CANCELLED');

    // Et une demande expirée n'est plus acceptable, même par le bon parrain.
    await expect(mentorship.accept(request.id, m.id)).rejects.toMatchObject({
      code: 'MENTORSHIP_STATE',
    });
  });
});
