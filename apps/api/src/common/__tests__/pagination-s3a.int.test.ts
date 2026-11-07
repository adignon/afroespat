import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { eventsQuerySchema } from '@app/shared';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit.service';
import { OutboxService } from '../outbox.service';
import { CryptoService } from '../crypto.service';
import { VisibilityService } from '../visibility.service';
import { CommunitiesService } from '../../modules/communities/communities.service';
import { ConnectionsService } from '../../modules/connections/connections.service';
import { MessagingService } from '../../modules/messaging/messaging.service';
import { BookmarksService } from '../../modules/bookmarks/bookmarks.service';
import { HelpService } from '../../modules/help/help.service';
import { EventsService } from '../../modules/events/events.service';
import { UsersService } from '../../modules/users/users.service';
import { ConsentsService } from '../../modules/consents/consents.service';
import { villeActiveDeTest } from './villes-de-test';

/**
 * PAGINATION « VOIR PLUS » — lot S3A (Étape 3).
 *
 * Pour chaque liste que l'écran prolonge par « Voir plus » : on SUIT LE CURSEUR jusqu'au bout
 * avec une page minuscule, et l'on exige (1) aucun doublon, (2) aucun trou — l'ensemble
 * parcouru est celui que la même route rend sans pagination —, (3) l'ordre rendu identique
 * à l'ordre sans pagination, et (4) un `nextCursor` nul seulement en fin de liste.
 *
 * LES LIGNES DE TÊTE PARTAGENT LA MÊME DATE, exprès : c'est l'identifiant qui départage. Un
 * ordre non total répéterait ou sauterait une ligne à la frontière de page.
 */

async function suivre<T>(
  page: (cursor: string | undefined) => Promise<{ items: readonly T[]; nextCursor: string | null }>,
  cle: (item: T) => string,
): Promise<{ ids: string[]; pages: number }> {
  const ids: string[] = [];
  let cursor: string | undefined;
  let pages = 0;
  do {
    const r = await page(cursor);
    pages += 1;
    ids.push(...r.items.map(cle));
    cursor = r.nextCursor ?? undefined;
    if (pages > 40) break;
  } while (cursor !== undefined);
  return { ids, pages };
}

describe('pagination « Voir plus » : deux pages, ni doublon ni trou (lot S3A)', () => {
  let prisma: PrismaService;
  let communities: CommunitiesService;
  let help: HelpService;
  let bookmarks: BookmarksService;
  let events: EventsService;
  let connections: ConnectionsService;
  let users: UsersService;

  const marker = `S3A${newId().slice(-9)}`;
  const userIds: string[] = [];
  const communityIds: string[] = [];
  const cityIds: string[] = [];
  let countryId: string;
  let cityId: string;

  async function membre(nom: string): Promise<{ id: string; handle: string }> {
    const id = newId();
    const handle = `s3a${id.slice(-12)}`;
    await prisma.user.create({
      data: {
        id,
        handle,
        displayName: nom,
        phase: 'SETTLED',
        verificationLevel: 'L1',
        originCountryId: countryId,
        plan: 'FREE',
        status: 'ACTIVE',
      },
    });
    userIds.push(id);
    return { id, handle };
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const outbox = new OutboxService(prisma);
    const audit = new AuditService(prisma);
    const visibility = new VisibilityService(prisma);
    const crypto = new CryptoService();
    connections = new ConnectionsService(prisma, outbox, audit, visibility);
    communities = new CommunitiesService(
      prisma,
      outbox,
      audit,
      visibility,
      new MessagingService(prisma, crypto, outbox, audit, visibility, connections),
    );
    help = new HelpService(prisma, outbox, audit, visibility);
    bookmarks = new BookmarksService(prisma);
    events = new EventsService(prisma, outbox, audit, visibility);
    users = new UsersService(prisma, crypto, outbox, audit, new ConsentsService(prisma));

    const country = await prisma.country.findFirstOrThrow({
      where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } },
      select: { id: true },
    });
    countryId = country.id;
    cityId = await villeActiveDeTest(prisma);
  });

  afterAll(async () => {
    await prisma.bookmark.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.helpResponse.deleteMany({ where: { authorUserId: { in: userIds } } });
    await prisma.helpRequest.deleteMany({ where: { authorUserId: { in: userIds } } });
    await prisma.eventAttendee.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.event.deleteMany({ where: { organizerUserId: { in: userIds } } });
    await prisma.post.deleteMany({ where: { authorUserId: { in: userIds } } });
    await prisma.housingListing.deleteMany({ where: { authorUserId: { in: userIds } } });
    await prisma.jobListing.deleteMany({ where: { authorUserId: { in: userIds } } });
    await prisma.connection.deleteMany({
      where: { OR: [{ userAId: { in: userIds } }, { userBId: { in: userIds } }] },
    });
    await prisma.communityMember.deleteMany({ where: { communityId: { in: communityIds } } });
    await prisma.community.deleteMany({ where: { id: { in: communityIds } } });
    await prisma.city.deleteMany({ where: { id: { in: cityIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  // ── Réseaux : « Mes réseaux » et « Découvrir » ───────────────────────────────

  it('réseaux : « Mes réseaux » se pagine (genre, nom, id) et la découverte aussi', async () => {
    const moi = await membre('Membre réseaux');

    // Trois genres, des NOMS IDENTIQUES : seul l'identifiant les sépare.
    const ville = await prisma.city.create({
      data: {
        id: newId(),
        countryId,
        name: `${marker} ville`,
        slug: `${marker.toLowerCase()}-ville`,
        isActive: false,
        latitude: 45.75,
        longitude: 4.85,
      },
    });
    cityIds.push(ville.id);
    // Les réseaux de ville et de pays sont rattachés d'office : le membre habite la ville créée ici.
    await prisma.user.update({ where: { id: moi.id }, data: { cityId: ville.id } });
    const plan: {
      kind: 'CITY' | 'COUNTRY' | 'INTEREST';
      name: string;
      extra: Record<string, string>;
    }[] = [
      { kind: 'INTEREST', name: `${marker} même nom`, extra: {} },
      { kind: 'INTEREST', name: `${marker} même nom`, extra: {} },
      { kind: 'INTEREST', name: `${marker} même nom`, extra: {} },
      { kind: 'INTEREST', name: `${marker} autre`, extra: {} },
      { kind: 'COUNTRY', name: `${marker} pays`, extra: { countryId } },
      { kind: 'CITY', name: `${marker} cité`, extra: { cityId: ville.id } },
      { kind: 'INTEREST', name: `${marker} zèbre`, extra: {} },
    ];
    const interets: string[] = [];
    for (const [i, c] of plan.entries()) {
      const id = newId();
      await prisma.community.create({
        data: {
          id,
          kind: c.kind,
          name: c.name,
          slug: `${marker.toLowerCase()}-${String(i)}`,
          visibility: 'PUBLIC',
          status: 'ACTIVE',
          lastActivityAt: new Date(),
          ...c.extra,
        },
      });
      communityIds.push(id);
      if (c.kind === 'INTEREST') interets.push(id);
      await prisma.communityMember.create({
        data: {
          id: newId(),
          communityId: id,
          userId: moi.id,
          role: 'MEMBER',
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
      });
    }

    // Chauffe : la première lecture rattache d'office les réseaux de ville et de pays (adhésion
    // automatique) ; l'état est stable ensuite.
    await communities.list(moi.id, { limit: 20 });
    // Sans pagination demandée : TOUS les réseaux, `mineNextCursor` nul.
    const tout = await communities.list(moi.id, { limit: 20 });
    expect(tout.mineNextCursor).toBeNull();
    const attendus = tout.mine.map((m) => m.id);
    // Les réseaux de ville et de pays sont recalés par l'adhésion automatique : on ne s'y fie pas.
    for (const id of interets) expect(attendus).toContain(id);
    expect(attendus.length).toBeGreaterThanOrEqual(interets.length);

    // Deux réseaux par page : le curseur se reprend plusieurs fois.
    const { ids, pages } = await suivre(
      async (mineCursor) =>
        communities
          .list(moi.id, {
            limit: 20,
            mineLimit: 2,
            ...(mineCursor === undefined ? {} : { mineCursor }),
          })
          .then((r) => ({ items: r.mine, nextCursor: r.mineNextCursor })),
      (m) => m.id,
    );
    expect(pages).toBeGreaterThan(1);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(attendus);

    // Page 2 : la découverte n'est pas relue.
    const premiere = await communities.list(moi.id, { limit: 20, mineLimit: 2 });
    expect(premiere.mine).toHaveLength(2);
    expect(premiere.mineNextCursor).not.toBeNull();
    const seconde = await communities.list(moi.id, {
      limit: 20,
      mineLimit: 2,
      mineCursor: premiere.mineNextCursor as string,
    });
    expect(seconde.discover.items).toHaveLength(0);
    expect(seconde.mine.map((m) => m.id)).not.toContain(premiere.mine[0]?.id);

    // Un curseur falsifié est refusé, pas ignoré.
    await expect(
      communities.list(moi.id, { limit: 20, mineLimit: 2, mineCursor: 'x.y' }),
    ).rejects.toBeDefined();

    // Découverte : suivre `discover.nextCursor`, restreint à nos réseaux par le nom.
    const decouverte = await suivre(
      async (cursor) =>
        communities
          .list(moi.id, { limit: 3, q: marker, ...(cursor === undefined ? {} : { cursor }) })
          .then((r) => r.discover),
      (d) => d.id,
    );
    expect(decouverte.pages).toBeGreaterThan(1);
    expect(new Set(decouverte.ids).size).toBe(decouverte.ids.length);
    expect([...decouverte.ids].sort()).toEqual([...communityIds].sort());
  });

  // ── Entraide : mes réponses ─────────────────────────────────────────────────

  it('entraide : « Mes réponses » se pagine sans doublon ni trou', async () => {
    const auteur = await membre('Auteur demandes');
    const moi = await membre('Répondant');
    for (let i = 0; i < 5; i += 1) {
      const requestId = newId();
      await prisma.helpRequest.create({
        data: {
          id: requestId,
          authorUserId: auteur.id,
          kind: 'REQUEST',
          type: 'PAPERWORK',
          title: `${marker} demande ${String(i)}`,
          body: 'Corps de la demande de test pour la pagination.',
          cityId,
          status: 'OPEN',
          moderationStatus: 'CLEARED',
        },
      });
      await prisma.helpResponse.create({
        data: {
          id: newId(),
          helpRequestId: requestId,
          authorUserId: moi.id,
          body: `Réponse ${String(i)} de test.`,
        },
      });
    }
    const actor = { userId: moi.id, level: 'L1' as const };
    const tout = await help.myResponses(actor, { limit: 50 });
    expect(tout.items).toHaveLength(5);
    const { ids, pages } = await suivre(
      (cursor) =>
        help.myResponses(actor, { limit: 2, ...(cursor === undefined ? {} : { cursor }) }),
      (r) => r.id,
    );
    expect(pages).toBe(3);
    expect(new Set(ids).size).toBe(5);
    expect(ids).toEqual(tout.items.map((r) => r.id));

    // Et « Mes demandes » côté auteur, avec filtre : même exigence.
    const miennes = await help.mine({ userId: auteur.id, level: 'L1' }, { limit: 50 });
    const { ids: idsMine } = await suivre(
      (cursor) =>
        help.mine(
          { userId: auteur.id, level: 'L1' },
          { limit: 2, ...(cursor === undefined ? {} : { cursor }) },
        ),
      (r) => r.id,
    );
    expect(idsMine).toEqual(miennes.items.map((r) => r.id));
    expect(new Set(idsMine).size).toBe(5);
  });

  // ── Enregistrés ─────────────────────────────────────────────────────────────

  it('enregistrés : la liste se pagine, même quand tous les signets datent de la même milliseconde', async () => {
    const auteur = await membre('Auteur signets');
    const moi = await membre('Lecteur signets');
    const meme = new Date(Date.now() - 60_000);
    for (let i = 0; i < 5; i += 1) {
      const requestId = newId();
      await prisma.helpRequest.create({
        data: {
          id: requestId,
          authorUserId: auteur.id,
          kind: 'REQUEST',
          type: 'PAPERWORK',
          title: `${marker} signet ${String(i)}`,
          body: 'Corps de la demande enregistrée pour la pagination.',
          cityId,
          status: 'OPEN',
          moderationStatus: 'CLEARED',
        },
      });
      await prisma.bookmark.create({
        data: {
          id: newId(),
          userId: moi.id,
          subjectType: 'HELP_REQUEST',
          subjectId: requestId,
          createdAt: meme,
        },
      });
    }
    const tout = await bookmarks.list(moi.id, { limit: 50 });
    expect(tout.items).toHaveLength(5);
    const { ids, pages } = await suivre(
      (cursor) => bookmarks.list(moi.id, { limit: 2, ...(cursor === undefined ? {} : { cursor }) }),
      (b) => b.subjectId,
    );
    expect(pages).toBe(3);
    expect(new Set(ids).size).toBe(5);
    expect(ids).toEqual(tout.items.map((b) => b.subjectId));

    // L'onglet « Annonces » couvre plusieurs types : le filtre est serveur, le curseur lui est lié.
    for (let i = 0; i < 3; i += 1) {
      await prisma.bookmark.create({
        data: {
          id: newId(),
          userId: moi.id,
          subjectType: 'JOB',
          subjectId: newId(),
          createdAt: meme,
        },
      });
    }
    await prisma.bookmark.create({
      data: {
        id: newId(),
        userId: moi.id,
        subjectType: 'USER',
        subjectId: newId(),
        createdAt: meme,
      },
    });
    const types = ['HELP_REQUEST', 'JOB'] as const;
    const multi = await bookmarks.list(moi.id, { subjectTypes: types, limit: 50 });
    expect(multi.items).toHaveLength(8);
    expect(
      multi.items.every((b) => b.subjectType === 'HELP_REQUEST' || b.subjectType === 'JOB'),
    ).toBe(true);
    const suiteMulti = await suivre(
      (cursor) =>
        bookmarks.list(moi.id, {
          subjectTypes: types,
          limit: 3,
          ...(cursor === undefined ? {} : { cursor }),
        }),
      (b) => b.id,
    );
    expect(suiteMulti.pages).toBe(3);
    expect(new Set(suiteMulti.ids).size).toBe(8);
    expect(suiteMulti.ids).toEqual(multi.items.map((b) => b.id));
    // Les comptes d'onglets restent ceux de TOUTE la collection.
    expect(multi.meta.total).toBe(9);
    const premiere = await bookmarks.list(moi.id, { subjectTypes: types, limit: 3 });
    await expect(
      bookmarks.list(moi.id, {
        subjectType: 'JOB',
        limit: 3,
        cursor: premiere.nextCursor as string,
      }),
    ).rejects.toBeDefined();
  });

  // ── Agenda ──────────────────────────────────────────────────────────────────

  it('agenda : les événements d’un organisateur se paginent (date de début égale, id en départage)', async () => {
    const orga = await membre('Organisateur');
    const debut = new Date(Date.now() + 3 * 86_400_000);
    for (let i = 0; i < 5; i += 1) {
      await prisma.event.create({
        data: {
          id: newId(),
          organizerUserId: orga.id,
          type: 'NETWORKING',
          title: `${marker} événement ${String(i)}`,
          cityId,
          startsAt: debut,
          status: 'SCHEDULED',
        },
      });
    }
    const requete = (extra: Record<string, unknown>) =>
      eventsQuerySchema.parse({ authorHandle: orga.handle, ...extra });
    const tout = await events.list(requete({ limit: 50 }), orga.id);
    expect(tout.items).toHaveLength(5);
    const { ids, pages } = await suivre(
      (cursor) =>
        events.list(requete({ limit: 2, ...(cursor === undefined ? {} : { cursor }) }), orga.id),
      (e) => e.id,
    );
    expect(pages).toBe(3);
    expect(new Set(ids).size).toBe(5);
    expect([...ids].sort()).toEqual(tout.items.map((e) => e.id).sort());
  });

  // ── Contacts ────────────────────────────────────────────────────────────────

  it('contacts : « Mes contacts » se pagine sans doublon ni trou', async () => {
    const moi = await membre('Membre contacts');
    for (let i = 0; i < 5; i += 1) {
      const autre = await membre(`Contact ${String(i)}`);
      const [a, b] = moi.id < autre.id ? [moi.id, autre.id] : [autre.id, moi.id];
      await prisma.connection.create({
        data: { id: newId(), userAId: a, userBId: b, origin: 'MANUAL' },
      });
    }
    const tout = await connections.list(moi.id, { limit: 50 });
    expect(tout.items).toHaveLength(5);
    const { ids, pages } = await suivre(
      (cursor) =>
        connections.list(moi.id, { limit: 2, ...(cursor === undefined ? {} : { cursor }) }),
      (c) => c.userId,
    );
    expect(pages).toBe(3);
    expect(new Set(ids).size).toBe(5);
    expect(ids).toEqual(tout.items.map((c) => c.userId));
  });

  // ── Profil public : ce qu'un membre a publié ────────────────────────────────

  it('profil public : chaque onglet se pagine ; sans onglet, aucune suite promise', async () => {
    const auteur = await membre('Auteur profil');
    const meme = new Date(Date.now() - 120_000);
    const commun = new Date(Date.now() + 9 * 86_400_000);
    for (let i = 0; i < 5; i += 1) {
      await prisma.post.create({
        data: {
          id: newId(),
          authorUserId: auteur.id,
          type: 'INFO',
          body: `${marker} publication ${String(i)}`,
          status: 'PUBLISHED',
          moderationStatus: 'CLEARED',
          createdAt: meme,
        },
      });
      await prisma.event.create({
        data: {
          id: newId(),
          organizerUserId: auteur.id,
          type: 'OUTING',
          title: `${marker} sortie ${String(i)}`,
          cityId,
          // Le tri des événements est celui de la date de début : trois d'entre eux la partagent.
          startsAt: new Date(commun.getTime() + (i < 3 ? 0 : i) * 86_400_000),
          status: 'SCHEDULED',
        },
      });
    }
    // « Services » = deux tables fusionnées : 2 annonces de logement à la même date.
    for (let i = 0; i < 2; i += 1) {
      await prisma.housingListing.create({
        data: {
          id: newId(),
          authorUserId: auteur.id,
          kind: 'RENT',
          title: `${marker} logement ${String(i)}`,
          description: 'Un logement de test pour la pagination du profil public.',
          cityId,
          status: 'ACTIVE',
          moderationStatus: 'CLEARED',
          riskFlags: [],
          expiresAt: new Date(Date.now() + 30 * 86_400_000),
          createdAt: meme,
        },
      });
    }

    const lire = (type: 'POST' | 'EVENT' | 'SERVICE', limit: number, cursor?: string) =>
      users.publishedContent(auteur.handle, auteur.id, {
        type,
        limit,
        ...(cursor === undefined ? {} : { cursor }),
      });

    for (const [type, attendu] of [
      ['POST', 5],
      ['EVENT', 5],
    ] as const) {
      const tout = await lire(type, 50);
      expect(tout.items).toHaveLength(attendu);
      expect(tout.nextCursor).toBeNull();
      const { ids, pages } = await suivre(
        (c) => lire(type, 2, c),
        (i) => i.id,
      );
      expect(pages).toBe(3);
      expect(new Set(ids).size).toBe(attendu);
      expect(ids).toEqual(tout.items.map((i) => i.id));
    }

    // SERVICE : les deux tables fusionnées dans un seul ordre total.
    const services = await lire('SERVICE', 50);
    expect(services.items.length).toBe(2);
    const sv = await suivre(
      (c) => lire('SERVICE', 1, c),
      (i) => i.id,
    );
    expect(sv.pages).toBe(2);
    expect(sv.ids).toEqual(services.items.map((i) => i.id));

    // Les compteurs d'onglets sont de vrais comptes, pas la taille de la page.
    const petite = await lire('POST', 2);
    expect(petite.items).toHaveLength(2);
    expect(petite.nextCursor).not.toBeNull();
    expect(petite.meta.parType.POST).toBe(5);
    expect(petite.meta.parType.EVENT).toBe(5);

    // Sans onglet : les premières cartes de chaque espèce, et AUCUNE suite promise.
    const toutes = await users.publishedContent(auteur.handle, auteur.id, { limit: 2 });
    expect(toutes.nextCursor).toBeNull();

    // Un curseur d'un autre onglet est refusé (périmètre lié à l'espèce).
    await expect(lire('EVENT', 2, petite.nextCursor as string)).rejects.toBeDefined();
  });
});
