import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import {
  CONNECTION_REQUESTS_PER_DAY,
  CONNECTION_REQUESTS_PER_TARGET,
  CONNECTION_REQUEST_EXPIRY_MS,
} from '@app/shared';
import { AuditService } from '../../../common/audit.service';
import { OutboxService } from '../../../common/outbox.service';
import { PrismaService } from '../../../common/prisma.service';
import { VisibilityService } from '../../../common/visibility.service';
import { BlocksService } from '../../blocks/blocks.service';
import { ConnectionsService } from '../connections.service';

/**
 * Contacts — 08-parrainage-messagerie.md §3, §7.2 et §12.
 *
 * Deux règles dures du §12 vivent ici, et elles tirent dans des directions
 * différentes : l'une interdit d'EXPOSER (aucun compteur public de contacts),
 * l'autre interdit de CRÉER trop facilement (même ville, message obligatoire).
 * Chacune a son test, chacun éprouvé par mutation.
 */
describe('contacts (08 §3)', () => {
  let prisma: PrismaService;
  let connections: ConnectionsService;
  let blocks: BlocksService;

  const createdUsers: string[] = [];
  const createdGuides: string[] = [];
  const createdEvents: string[] = [];
  let originCountryId: string;
  let cityId: string;
  let otherCityId: string;
  let counter = 0;

  const MESSAGE = 'Bonjour, on s’est croisés à la réunion de quartier la semaine dernière.';

  async function member(options: { cityId?: string | null } = {}): Promise<{
    id: string;
    handle: string;
  }> {
    counter += 1;
    const id = newId();
    const handle = `con${counter}${id.slice(-8)}`;
    await prisma.user.create({
      data: {
        id,
        handle,
        displayName: `Membre ${counter}`,
        phase: 'SETTLED',
        verificationLevel: 'L1',
        originCountryId,
        cityId: options.cityId === undefined ? cityId : options.cityId,
        plan: 'FREE',
        status: 'ACTIVE',
      },
    });
    createdUsers.push(id);
    return { id, handle };
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const outbox = new OutboxService(prisma);
    const audit = new AuditService(prisma);
    const visibility = new VisibilityService(prisma);
    connections = new ConnectionsService(prisma, outbox, audit, visibility);
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
    if (createdGuides.length > 0) {
      await prisma.guide.deleteMany({ where: { id: { in: createdGuides } } });
    }
    if (createdEvents.length > 0) {
      await prisma.event.deleteMany({ where: { id: { in: createdEvents } } });
    }
    if (createdUsers.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    }
    await prisma.$disconnect();
  });

  // ── §3.1 Demande manuelle ─────────────────────────────────────────────────

  /**
   * RÈGLE DURE (§12) : « la demande de contact manuelle exige la même ville et un
   * message ».
   *
   * Le message est porté par le schéma zod (20 à 500 caractères) ; la ville est une
   * règle de service, et c'est celle-ci que le test protège.
   *
   * MUTATION éprouvée : en retirant le contrôle `me.cityId !== target.cityId` de
   * `request()`, ce test tombe seul.
   */
  it('[RÈGLE DURE §12] exige la même ville — SAME_CITY_REQUIRED', async () => {
    const from = await member();
    const to = await member({ cityId: otherCityId });

    await expect(
      connections.request(from.id, { toHandle: to.handle, message: MESSAGE }),
    ).rejects.toMatchObject({ code: 'SAME_CITY_REQUIRED' });

    // Et sans ville du tout : on ne peut pas prétendre partager une ville absente.
    const nowhere = await member({ cityId: null });
    await expect(
      connections.request(nowhere.id, { toHandle: to.handle, message: MESSAGE }),
    ).rejects.toMatchObject({ code: 'SAME_CITY_REQUIRED' });
  });

  it('crée la demande dans la même ville, et émet `connection.requested`', async () => {
    const from = await member();
    const to = await member();

    const request = await connections.request(from.id, { toHandle: to.handle, message: MESSAGE });
    expect(request.status).toBe('PENDING');

    const event = await prisma.domainEvent.findFirst({
      where: { type: 'connection.requested', aggregateId: request.id },
    });
    expect(event).not.toBeNull();
  });

  it('l’acceptation crée un contact RÉCIPROQUE, en paire ordonnée', async () => {
    const from = await member();
    const to = await member();
    const request = await connections.request(from.id, { toHandle: to.handle, message: MESSAGE });

    await connections.acceptRequest(request.id, to.id);

    // Réciproque : les deux se voient dans leurs contacts.
    expect((await connections.list(from.id, { limit: 20 })).items.map((i) => i.userId)).toContain(
      to.id,
    );
    expect((await connections.list(to.id, { limit: 20 })).items.map((i) => i.userId)).toContain(
      from.id,
    );

    // La paire est ORDONNÉE en base (contrainte CHECK user_a_id < user_b_id).
    const [a, b] = from.id < to.id ? [from.id, to.id] : [to.id, from.id];
    const row = await prisma.connection.findUniqueOrThrow({
      where: { userAId_userBId: { userAId: a, userBId: b } },
    });
    expect(row.origin).toBe('MANUAL');
  });

  it('refuse une seconde demande en attente entre les mêmes membres', async () => {
    const from = await member();
    const to = await member();
    await connections.request(from.id, { toHandle: to.handle, message: MESSAGE });
    await expect(
      connections.request(from.id, { toHandle: to.handle, message: MESSAGE }),
    ).rejects.toMatchObject({ code: 'REQUEST_PENDING' });

    // Dans l'autre sens aussi : une demande croisée n'a pas de sens.
    await expect(
      connections.request(to.id, { toHandle: from.handle, message: MESSAGE }),
    ).rejects.toMatchObject({ code: 'REQUEST_PENDING' });
  });

  it('borne à 3 demandes vers le même membre sur 30 jours (§3.1)', async () => {
    const from = await member();
    const to = await member();

    for (let i = 0; i < CONNECTION_REQUESTS_PER_TARGET; i += 1) {
      const request = await connections.request(from.id, {
        toHandle: to.handle,
        message: MESSAGE,
      });
      await connections.declineRequest(request.id, to.id);
    }

    await expect(
      connections.request(from.id, { toHandle: to.handle, message: MESSAGE }),
    ).rejects.toMatchObject({ code: 'REQUEST_LIMIT' });
  });

  it('borne à 10 demandes envoyées par jour (§3.1)', async () => {
    const from = await member();
    for (let i = 0; i < CONNECTION_REQUESTS_PER_DAY; i += 1) {
      const to = await member();
      await connections.request(from.id, { toHandle: to.handle, message: MESSAGE });
    }
    const extra = await member();
    await expect(
      connections.request(from.id, { toHandle: extra.handle, message: MESSAGE }),
    ).rejects.toMatchObject({ code: 'REQUEST_LIMIT' });
  });

  it('une demande de plus de 30 jours n’est plus acceptable, avant même la tâche', async () => {
    const from = await member();
    const to = await member();
    const request = await connections.request(from.id, { toHandle: to.handle, message: MESSAGE });

    // La colonne `expires_at` de §6 n'existe pas : l'échéance se lit sur `created_at`.
    await prisma.connectionRequest.update({
      where: { id: request.id },
      data: { createdAt: new Date(Date.now() - CONNECTION_REQUEST_EXPIRY_MS - 1000) },
    });

    await expect(connections.acceptRequest(request.id, to.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(await connections.expireRequests()).toBeGreaterThanOrEqual(1);
    const row = await prisma.connectionRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(row.status).toBe('EXPIRED');
  });

  it('un tiers ne peut ni accepter ni refuser une demande (404)', async () => {
    const from = await member();
    const to = await member();
    const stranger = await member();
    const request = await connections.request(from.id, { toHandle: to.handle, message: MESSAGE });

    await expect(connections.acceptRequest(request.id, stranger.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    // L'émetteur non plus : ce serait s'ajouter soi-même aux contacts de l'autre.
    await expect(connections.acceptRequest(request.id, from.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  // ── §3.2 Ce que débloque un contact, et ce qu'il ne dit pas ───────────────

  /**
   * RÈGLE DURE (§12 et §3.2) : « le nombre de contacts n'est jamais renvoyé sur le
   * profil d'un autre membre ».
   *
   * Le test ne vérifie pas seulement l'absence d'un champ : il vérifie que le
   * NOMBRE renvoyé par la route de 2ᵉ degré est celui du recouvrement, et non le
   * total de l'autre. C'est la différence entre « Connecté·e à 2 de vos contacts »
   * (autorisé par §3.2) et « 40 contacts » (interdit).
   *
   * MUTATION éprouvée : en faisant renvoyer `theirs.length` au lieu de
   * `shared.length` dans `mutualConnections`, ce test tombe seul — la valeur passe
   * de 1 à 3.
   */
  it('[RÈGLE DURE §12] ne renvoie jamais le nombre de contacts d’un autre membre', async () => {
    const me = await member();
    const them = await member();
    const shared = await member();

    // `them` a TROIS contacts, dont un seul en commun avec moi.
    for (const other of [shared, await member(), await member()]) {
      const request = await connections.request(them.id, {
        toHandle: other.handle,
        message: MESSAGE,
      });
      await connections.acceptRequest(request.id, other.id);
    }
    const mine = await connections.request(me.id, {
      toHandle: shared.handle,
      message: MESSAGE,
    });
    await connections.acceptRequest(mine.id, shared.id);

    const mutual = await connections.mutualConnections(me.id, them.handle);
    expect(mutual.count).toBe(1);
    expect(mutual.handles).toEqual([shared.handle]);

    // Mon propre total, lui, m'est accessible — et à moi seul.
    const own = await connections.list(me.id, { limit: 20 });
    expect(own.meta.count).toBe(1);
  });

  it('le retrait est logique, sans notification, et idempotent', async () => {
    const a = await member();
    const b = await member();
    const request = await connections.request(a.id, { toHandle: b.handle, message: MESSAGE });
    await connections.acceptRequest(request.id, b.id);

    await connections.remove(b.id, a.id);
    expect((await connections.list(a.id, { limit: 20 })).items).toEqual([]);
    expect(await connections.areConnected(a.id, b.id)).toBe(false);

    // La ligne SURVIT : la contrainte d'unicité interdirait de recréer le contact.
    const [x, y] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
    const row = await prisma.connection.findUniqueOrThrow({
      where: { userAId_userBId: { userAId: x, userBId: y } },
    });
    expect(row.removedAt).not.toBeNull();

    // Idempotent : un double clic ne doit pas lever.
    await expect(connections.remove(b.id, a.id)).resolves.toBeUndefined();
  });

  it('un contact retiré puis refondé reprend vie', async () => {
    const a = await member();
    const b = await member();
    const first = await connections.request(a.id, { toHandle: b.handle, message: MESSAGE });
    await connections.acceptRequest(first.id, b.id);
    await connections.remove(a.id, b.id);

    const second = await connections.request(a.id, { toHandle: b.handle, message: MESSAGE });
    await connections.acceptRequest(second.id, b.id);
    expect(await connections.areConnected(a.id, b.id)).toBe(true);
  });

  // ── §3.1 Suggestions ──────────────────────────────────────────────────────

  it('suggère les membres présents au même événement (origine EVENT)', async () => {
    const organizer = await member();
    const me = await member();
    const them = await member();

    const eventId = newId();
    await prisma.event.create({
      data: {
        id: eventId,
        organizerUserId: organizer.id,
        type: 'PICNIC',
        title: 'Pique-nique du dimanche',
        cityId,
        addressText: 'Parc, entrée nord',
        startsAt: new Date(Date.now() - 86_400_000),
        status: 'DONE',
      },
    });
    createdEvents.push(eventId);
    for (const user of [me, them]) {
      await prisma.eventAttendee.create({
        data: {
          id: newId(),
          eventId,
          userId: user.id,
          status: 'GOING',
          respondedAt: new Date(),
          checkedIn: true,
        },
      });
    }

    const suggestions = await connections.suggestions(me.id);
    const match = suggestions.items.find((s) => s.user.id === them.id);
    expect(match?.origin).toBe('EVENT');
    expect(match?.reason).toContain('Pique-nique');

    // Accepter la suggestion crée le contact — sans passer par la règle de ville.
    await connections.acceptSuggestion(me.id, 'EVENT', them.handle);
    expect(await connections.areConnected(me.id, them.id)).toBe(true);

    // Et la suggestion disparaît d'elle-même : elle est calculée, pas stockée.
    const after = await connections.suggestions(me.id);
    expect(after.items.find((s) => s.user.id === them.id)).toBeUndefined();
  });

  it('refuse une suggestion sans fondement (404) — la route n’est pas un « ajouter n’importe qui »', async () => {
    const me = await member();
    const stranger = await member({ cityId: otherCityId });
    await expect(
      connections.acceptSuggestion(me.id, 'EVENT', stranger.handle),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('suggère auteur et contributeur d’un guide (origine GUIDE)', async () => {
    const author = await member();
    const contributor = await member();

    const guideId = newId();
    await prisma.guide.create({
      data: {
        id: guideId,
        authorUserId: author.id,
        slug: `guide-test-${guideId.slice(-8)}`,
        title: 'Ouvrir un compte bancaire',
        category: 'DAILY_LIFE',
        scope: 'UNIVERSAL',
        status: 'PUBLISHED',
        lastContentUpdateAt: new Date(),
      },
    });
    createdGuides.push(guideId);
    await prisma.guideContributor.create({
      data: { guideId, userId: contributor.id, acceptedCount: 1, firstAt: new Date() },
    });

    const fromContributor = await connections.suggestions(contributor.id);
    expect(fromContributor.items.find((s) => s.user.id === author.id)?.origin).toBe('GUIDE');

    const fromAuthor = await connections.suggestions(author.id);
    expect(fromAuthor.items.find((s) => s.user.id === contributor.id)?.origin).toBe('GUIDE');
  });

  /**
   * Le piège du `notIn` sur une colonne NULLABLE, dans le seul endroit de ce module
   * où il se présente : `guides.author_user_id` est nullable (guide anonymisé après
   * suppression de compte).
   *
   * Ici l'intention est d'écarter ces guides — il n'y a personne à suggérer — d'où
   * le `not: null` EXPLICITE. Ce test vérifie que le lecteur qui a UN blocage voit
   * toujours ses autres suggestions : c'est la forme du bogue qui a coûté cher
   * ailleurs, où un `notIn` faisait disparaître les contenus anonymisés dès qu'un
   * lecteur avait un seul blocage.
   */
  it('un blocage n’emporte pas les autres suggestions de guide', async () => {
    const me = await member();
    const author = await member();
    const blocked = await member();

    const guideId = newId();
    await prisma.guide.create({
      data: {
        id: guideId,
        authorUserId: author.id,
        slug: `guide-test-${guideId.slice(-8)}`,
        title: 'Trouver un logement',
        category: 'HOUSING',
        scope: 'UNIVERSAL',
        status: 'PUBLISHED',
        lastContentUpdateAt: new Date(),
      },
    });
    createdGuides.push(guideId);
    await prisma.guideContributor.create({
      data: { guideId, userId: me.id, acceptedCount: 1, firstAt: new Date() },
    });

    // Un guide dont l'auteur est anonymisé : il ne doit rien suggérer, mais il ne
    // doit rien emporter non plus.
    const orphanId = newId();
    await prisma.guide.create({
      data: {
        id: orphanId,
        authorUserId: null,
        slug: `guide-test-${orphanId.slice(-8)}`,
        title: 'Guide anonymisé',
        category: 'HOUSING',
        scope: 'UNIVERSAL',
        status: 'PUBLISHED',
        lastContentUpdateAt: new Date(),
      },
    });
    createdGuides.push(orphanId);
    await prisma.guideContributor.create({
      data: { guideId: orphanId, userId: me.id, acceptedCount: 1, firstAt: new Date() },
    });

    await blocks.block(me.id, blocked.handle);

    const suggestions = await connections.suggestions(me.id);
    expect(suggestions.items.map((s) => s.user.id)).toContain(author.id);
    expect(suggestions.items.map((s) => s.user.id)).not.toContain(blocked.id);
  });

  // ── §3.1 Origine MENTORSHIP, par l'ÉVÉNEMENT ──────────────────────────────

  it('crée le contact sur `mentorship.ended` motif COMPLETED, et sur lui seul', async () => {
    const mentor = await member();
    const mentee = await member();

    // Motif non COMPLETED : rien ne doit être créé.
    await connections.handleMentorshipEnded({
      mentorshipId: newId(),
      mentorUserId: mentor.id,
      menteeUserId: mentee.id,
      reason: 'MENTEE_LEFT',
    });
    expect(await connections.areConnected(mentor.id, mentee.id)).toBe(false);

    const mentorshipId = newId();
    await connections.handleMentorshipEnded({
      mentorshipId,
      mentorUserId: mentor.id,
      menteeUserId: mentee.id,
      reason: 'COMPLETED',
    });
    expect(await connections.areConnected(mentor.id, mentee.id)).toBe(true);

    // IDEMPOTENT : la livraison est « au moins une fois ».
    await connections.handleMentorshipEnded({
      mentorshipId,
      mentorUserId: mentor.id,
      menteeUserId: mentee.id,
      reason: 'COMPLETED',
    });
    const [a, b] = mentor.id < mentee.id ? [mentor.id, mentee.id] : [mentee.id, mentor.id];
    expect(
      await prisma.connection.count({ where: { userAId: a, userBId: b } }),
    ).toBe(1);
  });

  it('lève sur un payload `mentorship.ended` incomplet, pour être rejoué', async () => {
    // Sortir en silence perdrait définitivement le contact ; lever le fait rejouer
    // et laisse une trace (00 §9.2).
    await expect(
      connections.handleMentorshipEnded({ reason: 'COMPLETED' }),
    ).rejects.toThrow(/payload incomplet/);
  });

  it('ne crée pas de contact si un blocage est survenu entre-temps', async () => {
    const mentor = await member();
    const mentee = await member();
    await blocks.block(mentor.id, mentee.handle);

    await connections.handleMentorshipEnded({
      mentorshipId: newId(),
      mentorUserId: mentor.id,
      menteeUserId: mentee.id,
      reason: 'COMPLETED',
    });
    expect(await connections.areConnected(mentor.id, mentee.id)).toBe(false);
  });

  // ── §11 Suppression de compte ─────────────────────────────────────────────

  it('la suppression retire les contacts et expire les demandes, sans toucher aux blocages', async () => {
    const leaving = await member();
    const other = await member();
    const blockedBy = await member();

    const request = await connections.request(leaving.id, {
      toHandle: other.handle,
      message: MESSAGE,
    });
    await connections.acceptRequest(request.id, other.id);
    // La demande en attente vient d'un TROISIÈME membre : `other` est désormais
    // contact, et une demande vers un contact est refusée (ALREADY_CONNECTED).
    const asker = await member();
    const pendingReq = await connections.request(asker.id, {
      toHandle: leaving.handle,
      message: MESSAGE,
    });
    await blocks.block(blockedBy.id, leaving.handle);

    await connections.handleUserDeleted(leaving.id);

    expect(await connections.areConnected(leaving.id, other.id)).toBe(false);
    expect(
      (await prisma.connectionRequest.findUniqueOrThrow({ where: { id: pendingReq.id } })).status,
    ).toBe('EXPIRED');
    // §11 : les blocages sont CONSERVÉS — « l'autre partie garde sa protection ».
    expect(
      await prisma.block.count({ where: { blockerUserId: blockedBy.id, blockedUserId: leaving.id } }),
    ).toBe(1);
  });
});
