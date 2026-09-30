import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import {
  COMMUNITY_ARCHIVE_AFTER_DAYS,
  COMMUNITY_CITY_THRESHOLD_SETTING_KEY,
  COMMUNITY_MIN_INVITES,
  TOPIC_ARCHIVE_AFTER_DAYS,
} from '@app/shared';
import { AuditService } from '../../../common/audit.service';
import { CryptoService } from '../../../common/crypto.service';
import { OutboxService } from '../../../common/outbox.service';
import { PrismaService } from '../../../common/prisma.service';
import { TokenService } from '../../../common/token.service';
import { VisibilityService } from '../../../common/visibility.service';
import { FakeCaptchaProvider, FakeSmsProvider } from '../../../providers/providers';
import { ConsentsService } from '../../consents/consents.service';
import { AuthService } from '../../auth/auth.service';
import { UsersService } from '../../users/users.service';
import { CommunitiesService } from '../communities.service';

/**
 * Réseaux — 07-reseaux.md §9 (règles dures) et §2.
 *
 * Chaque règle dure du §9 a son test nommé, et chacun a été vérifié en CASSANT
 * volontairement la règle dans le service : un test qui passerait aussi avec le
 * bogue ne vaut rien.
 *
 * Les tests ouvrent une ville de test à part (`is_active`), parce qu'aucune
 * ville du jeu de départ n'est activée : le réseau de ville n'existerait donc
 * pour personne, et l'adhésion automatique serait vérifiée à vide.
 */
describe('réseaux (07 §2, §9)', () => {
  let prisma: PrismaService;
  let communities: CommunitiesService;
  let users: UsersService;
  let auth: AuthService;
  const sms = new FakeSmsProvider();

  const createdUserIds: string[] = [];
  const createdCommunityIds: string[] = [];
  let cityId = '';
  let otherCityId = '';
  let originCountryId = '';

  let counter = 0;
  const nextPhone = () => `07${String(Date.now()).slice(-6)}${String(counter++).padStart(2, '0')}`;

  /** Un membre inscrit par la vraie chaîne OTP, comme le fait le front. */
  async function newMember(options: { city?: string | null } = {}): Promise<string> {
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

    const city = options.city === undefined ? cityId : options.city;
    await prisma.user.update({
      where: { id: session.userId },
      // L'écran 3 de l'onboarding (01 §5) : pays et ville. C'est l'écriture que
      // `user.onboarded_location` est censé annoncer.
      data: { cityId: city, originCountryId, verificationLevel: 'L1' },
    });
    return session.userId;
  }

  /** Un handle stable, pour pouvoir inviter par pseudo. */
  async function handleOf(userId: string): Promise<string> {
    const handle = `t${Date.now().toString(36)}${counter++}`;
    await prisma.user.update({ where: { id: userId }, data: { handle } });
    return handle;
  }

  /** Cinq invités : le strict minimum du §2.2. */
  async function fiveInvitees(): Promise<string[]> {
    const handles: string[] = [];
    for (let i = 0; i < COMMUNITY_MIN_INVITES; i += 1) {
      handles.push(await handleOf(await newMember()));
    }
    return handles;
  }

  async function createInterest(
    ownerId: string,
    overrides: Partial<{ name: string; visibility: 'PUBLIC' | 'ON_REQUEST' | 'INVITE_ONLY' }> = {},
  ) {
    const created = await communities.create(ownerId, {
      name: overrides.name ?? `Reseau ${Date.now().toString(36)}${counter++}`,
      category: 'cuisine',
      visibility: overrides.visibility ?? 'PUBLIC',
      inviteHandles: await fiveInvitees(),
    });
    createdCommunityIds.push(created.id);
    return created;
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    const crypto = new CryptoService();
    const outbox = new OutboxService(prisma);
    const audit = new AuditService(prisma);
    const visibility = new VisibilityService(prisma);

    communities = new CommunitiesService(prisma, outbox, audit, visibility);
    // `ConsentsService` a été ajouté au tronc commun après l'écriture de ce
    // module : les consentements de l'inscription s'écrivent dans la transaction
    // de création du compte (01 §5).
    const consents = new ConsentsService(prisma);
    users = new UsersService(prisma, crypto, outbox, audit, consents);
    auth = new AuthService(
      prisma,
      crypto,
      outbox,
      new TokenService(),
      consents,
      sms,
      new FakeCaptchaProvider(),
    );

    const country = await prisma.country.findFirstOrThrow({
      where: { kind: { in: ['ORIGIN', 'BOTH'] }, isActive: true },
      select: { id: true },
    });
    originCountryId = country.id;

    const destination = await prisma.country.findFirstOrThrow({
      where: { iso2: 'FR' },
      select: { id: true },
    });

    // Deux villes ACTIVES à nous : §2.1 fait naître le réseau de ville « à
    // l'activation de la ville », et aucune ville du jeu de départ ne l'est.
    const suffix = Date.now().toString(36);
    const city = await prisma.city.create({
      data: {
        id: newId(),
        countryId: destination.id,
        name: `Testville ${suffix}`,
        slug: `testville-${suffix}`,
        latitude: 45.75,
        longitude: 4.85,
        isActive: true,
        activatedAt: new Date(),
      },
    });
    cityId = city.id;

    const other = await prisma.city.create({
      data: {
        id: newId(),
        countryId: destination.id,
        name: `Autreville ${suffix}`,
        slug: `autreville-${suffix}`,
        latitude: 43.3,
        longitude: 5.4,
        isActive: true,
        activatedAt: new Date(),
      },
    });
    otherCityId = other.id;

    // Le seuil du §2.2 est un `system_settings`. On l'abaisse à 1 pour les
    // tests qui ne portent PAS sur lui ; le test du seuil le remonte lui-même.
    await prisma.systemSetting.upsert({
      where: { key: COMMUNITY_CITY_THRESHOLD_SETTING_KEY },
      create: { key: COMMUNITY_CITY_THRESHOLD_SETTING_KEY, value: 1 },
      update: { value: 1 },
    });
  });

  afterAll(async () => {
    if (createdCommunityIds.length > 0) {
      await prisma.community.deleteMany({ where: { id: { in: createdCommunityIds } } });
    }
    // `communities.created_by_user_id` est en `SetNull` : supprimer les membres
    // de test ne suffirait pas, et un réseau orphelin resterait dans la
    // découverte de la base locale à chaque exécution. On passe donc par le
    // créateur AVANT de supprimer les comptes.
    if (createdUserIds.length > 0) {
      await prisma.community.deleteMany({
        where: { kind: 'INTEREST', createdByUserId: { in: createdUserIds } },
      });
    }
    await prisma.community.deleteMany({ where: { cityId: { in: [cityId, otherCityId] } } });
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.city.deleteMany({ where: { id: { in: [cityId, otherCityId] } } });
    await prisma.systemSetting.deleteMany({
      where: { key: COMMUNITY_CITY_THRESHOLD_SETTING_KEY },
    });
    await prisma.$disconnect();
  });

  // ══ RÈGLE DURE — 5 invitations (§9) ═══════════════════════════════════════

  it('rule: un réseau d’intérêt ne peut pas être créé sans 5 invitations', async () => {
    const owner = await newMember();
    const handles = await fiveInvitees();

    // Quatre handles : le schéma partagé refuse avant même le service.
    await expect(
      communities.create(owner, {
        name: 'Quatre invités',
        category: 'sport',
        visibility: 'PUBLIC',
        inviteHandles: handles.slice(0, 4),
      }),
    ).rejects.toMatchObject({ code: 'NOT_ENOUGH_INVITES' });

    // Cinq handles dont trois INEXISTANTS : c'est le vrai contournement, et le
    // seul que le schéma ne peut pas voir. Le garde-fou compte les invitations
    // RÉSOLUES, sinon cinq pseudos au hasard suffiraient à ouvrir un réseau vide.
    await expect(
      communities.create(owner, {
        name: 'Faux invités',
        category: 'sport',
        visibility: 'PUBLIC',
        inviteHandles: [handles[0] as string, handles[1] as string, 'nexistepas1', 'nexistepas2', 'nexistepas3'],
      }),
    ).rejects.toMatchObject({ code: 'NOT_ENOUGH_INVITES' });

    // Et cinq invités réels passent : sans cette moitié, le test passerait aussi
    // si la création refusait tout.
    const created = await createInterest(owner);
    expect(created.status).toBe('ACTIVE');
    expect(
      await prisma.communityMember.count({ where: { communityId: created.id, status: 'INVITED' } }),
    ).toBe(COMMUNITY_MIN_INVITES);
  });

  it('ne compte pas cinq fois le même invité, ni le créateur', async () => {
    const owner = await newMember();
    const ownerHandle = await handleOf(owner);
    const someone = await handleOf(await newMember());

    await expect(
      communities.create(owner, {
        name: 'Doublons',
        category: 'foi',
        visibility: 'PUBLIC',
        // Le schéma déduplique : cinq fois le même handle ne fait qu'un.
        inviteHandles: [someone, someone, someone, someone, someone],
      }),
    ).rejects.toMatchObject({ code: 'NOT_ENOUGH_INVITES' });

    const four = await fiveInvitees();
    await expect(
      communities.create(owner, {
        name: 'Soi-même',
        category: 'foi',
        visibility: 'PUBLIC',
        // Le créateur parmi les invités : il est déjà membre, il ne peuple rien.
        inviteHandles: [ownerHandle, ...four.slice(0, 4)],
      }),
    ).rejects.toMatchObject({ code: 'NOT_ENOUGH_INVITES' });
  });

  // ══ RÈGLE DURE — seuil de la ville (§9) ═══════════════════════════════════

  it('rule: le bouton de création est refusé sous le seuil de membres de la ville', async () => {
    const owner = await newMember();
    const handles = await fiveInvitees();

    const current = await prisma.user.count({
      where: { cityId, status: 'ACTIVE', deletedAt: null },
    });
    // Seuil placé JUSTE au-dessus du compte réel : le refus ne peut alors venir
    // que du seuil, pas d'une ville vide par accident.
    await prisma.systemSetting.update({
      where: { key: COMMUNITY_CITY_THRESHOLD_SETTING_KEY },
      data: { value: current + 1 },
    });

    const gate = await communities.creationGate(owner);
    expect(gate.canCreate).toBe(false);
    // Le message du §2.2 a besoin de la ville, du seuil et du compte.
    expect(gate.required).toBe(current + 1);
    expect(gate.current).toBe(current);
    expect(gate.cityName).toContain('Testville');

    await expect(
      communities.create(owner, {
        name: 'Sous le seuil',
        category: 'lecture',
        visibility: 'PUBLIC',
        inviteHandles: handles,
      }),
    ).rejects.toMatchObject({
      code: 'CITY_THRESHOLD',
      details: { required: current + 1, current },
    });

    // Le seuil atteint, la même création passe.
    await prisma.systemSetting.update({
      where: { key: COMMUNITY_CITY_THRESHOLD_SETTING_KEY },
      data: { value: current },
    });
    const created = await communities.create(owner, {
      name: 'Au seuil',
      category: 'lecture',
      visibility: 'PUBLIC',
      inviteHandles: handles,
    });
    createdCommunityIds.push(created.id);
    expect(created.myRole).toBe('OWNER');

    await prisma.systemSetting.update({
      where: { key: COMMUNITY_CITY_THRESHOLD_SETTING_KEY },
      data: { value: 1 },
    });
  });

  it('refuse la création à un membre sans ville', async () => {
    const nomad = await newMember({ city: null });
    const gate = await communities.creationGate(nomad);
    // Sans ville, il n'y a pas de seuil à comparer — et surtout pas de « 0 ≥ 0 »
    // qui ouvrirait la création à tout le monde.
    expect(gate.canCreate).toBe(false);
    expect(gate.cityId).toBeNull();
  });

  // ══ RÈGLE DURE — sortie d'un réseau automatique (§9) ══════════════════════

  it('rule: on ne peut pas quitter un réseau automatique', async () => {
    const member = await newMember();
    await communities.syncAutoMemberships(member);

    const city = await prisma.community.findFirstOrThrow({
      where: { kind: 'CITY', cityId },
      select: { id: true },
    });
    const country = await prisma.community.findFirstOrThrow({
      where: { kind: 'COUNTRY', countryId: originCountryId },
      select: { id: true },
    });

    for (const communityId of [city.id, country.id]) {
      await expect(communities.leave(communityId, member)).rejects.toMatchObject({
        code: 'AUTO_COMMUNITY',
      });
      // Et l'adhésion est TOUJOURS là : un refus qui aurait quand même supprimé
      // la ligne avant de lever passerait le test d'erreur sans rien protéger.
      const still = await prisma.communityMember.findUnique({
        where: { communityId_userId: { communityId, userId: member } },
        select: { status: true },
      });
      expect(still?.status).toBe('ACTIVE');
    }

    // Un réseau d'INTÉRÊT, lui, se quitte : sinon le test passerait avec un
    // `leave()` qui refuserait tout.
    const interest = await createInterest(await newMember());
    await communities.join(interest.id, member);
    await communities.leave(interest.id, member);
    expect(
      await prisma.communityMember.findUnique({
        where: { communityId_userId: { communityId: interest.id, userId: member } },
      }),
    ).toBeNull();
  });

  // ══ RÈGLE DURE — archivage à 60 jours (§9) ════════════════════════════════

  it('rule: un réseau d’intérêt sans activité depuis 60 jours est archivé, jamais un réseau automatique', async () => {
    const owner = await newMember();
    const interest = await createInterest(owner);
    await communities.syncAutoMemberships(owner);

    const auto = await prisma.community.findFirstOrThrow({
      where: { kind: 'CITY', cityId },
      select: { id: true },
    });

    const longAgo = new Date(Date.now() - (COMMUNITY_ARCHIVE_AFTER_DAYS + 5) * 86_400_000);
    // LES DEUX sont endormis d'autant : c'est le `kind` qui doit départager, et
    // pas la date. Sans le réseau automatique ici, un `archiveInactive()` qui
    // ignorerait le `kind` passerait le test.
    await prisma.community.updateMany({
      where: { id: { in: [interest.id, auto.id] } },
      data: { lastActivityAt: longAgo },
    });

    const result = await communities.archiveInactive();
    expect(result.archived).toContain(interest.id);
    expect(result.archived).not.toContain(auto.id);

    const after = await prisma.community.findMany({
      where: { id: { in: [interest.id, auto.id] } },
      select: { id: true, status: true, archivedAt: true },
    });
    expect(after.find((c) => c.id === interest.id)?.status).toBe('ARCHIVED');
    expect(after.find((c) => c.id === interest.id)?.archivedAt).not.toBeNull();
    // §2.1 : les réseaux automatiques ne sont JAMAIS archivés.
    expect(after.find((c) => c.id === auto.id)?.status).toBe('ACTIVE');

    // Archivé = LECTURE SEULE (§2.2).
    await expect(
      communities.createTopic(interest.id, owner, {
        title: 'Un sujet dans un réseau archivé',
        body: 'Refusé.',
      }),
    ).rejects.toMatchObject({ code: 'COMMUNITY_ARCHIVED' });

    // Et le propriétaire le réactive (§2.2), ce qui repousse l'archivage.
    const back = await communities.reactivate(interest.id, owner);
    expect(back.status).toBe('ACTIVE');
    const again = await communities.archiveInactive();
    expect(again.archived).not.toContain(interest.id);
  });

  it('avertit à 45 jours sans archiver', async () => {
    const owner = await newMember();
    const interest = await createInterest(owner);
    await prisma.community.update({
      where: { id: interest.id },
      data: { lastActivityAt: new Date(Date.now() - 50 * 86_400_000) },
    });

    const result = await communities.archiveInactive();
    expect(result.warned).toContain(interest.id);
    expect(result.archived).not.toContain(interest.id);
  });

  // ══ RÈGLE DURE — INVITE_ONLY (§9) ═════════════════════════════════════════

  it('rule: le contenu d’un réseau INVITE_ONLY n’est jamais renvoyé à un non-membre ni indexé pour lui', async () => {
    const owner = await newMember();
    const outsider = await newMember();
    const secret = await createInterest(owner, { visibility: 'INVITE_ONLY' });

    await communities.createTopic(secret.id, owner, {
      title: 'Le sujet confidentiel du réseau',
      body: 'Rien ne doit sortir.',
    });
    const topicId = (
      await prisma.topic.findFirstOrThrow({
        where: { communityId: secret.id },
        select: { id: true },
      })
    ).id;

    // L'EN-TÊTE : 404, et non 403 — un 403 dirait que le réseau existe (T4 §3).
    await expect(communities.detail(secret.id, outsider)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(communities.detail(secret.slug, outsider)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    // TOUT le contenu, une route après l'autre. Le sujet est éprouvé PAR SON
    // IDENTIFIANT PROPRE : c'est la porte de derrière, celle qui ne passe pas par
    // le réseau, et c'est là qu'une fuite se logerait.
    await expect(communities.topic(topicId, outsider)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      communities.topics(secret.id, outsider, { limit: 20 }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(communities.members(secret.id, outsider, { limit: 20 })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(communities.feed(secret.id, outsider, { limit: 20 })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(
      communities.announcements(secret.id, outsider, { limit: 20 }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(communities.polls(secret.id, outsider, { limit: 20 })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(communities.albums(secret.id, outsider)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(communities.map(secret.id, outsider)).rejects.toMatchObject({ code: 'NOT_FOUND' });

    // On ne le rejoint pas non plus de sa propre initiative.
    await expect(communities.join(secret.id, outsider)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    // « ni indexé pour lui » : absent de la découverte.
    const listing = await communities.list(outsider, { limit: 50 });
    expect(listing.discover.items.map((c) => c.id)).not.toContain(secret.id);
    const searched = await communities.list(outsider, { limit: 50, q: secret.name });
    expect(searched.discover.items).toHaveLength(0);

    // Le propriétaire, lui, voit tout : sinon le test passerait avec un service
    // qui renverrait 404 à tout le monde.
    expect((await communities.detail(secret.id, owner)).pinned).toBeDefined();
    expect((await communities.topics(secret.id, owner, { limit: 20 })).items).toHaveLength(1);

    // Et un INVITÉ voit l'en-tête (il a reçu l'invitation) puis rejoint.
    const invited = await prisma.communityMember.findFirstOrThrow({
      where: { communityId: secret.id, status: 'INVITED' },
      select: { userId: true },
    });
    expect((await communities.detail(secret.id, invited.userId)).myStatus).toBe('INVITED');
    await communities.join(secret.id, invited.userId);
    expect((await communities.detail(secret.id, invited.userId)).myStatus).toBe('ACTIVE');
  });

  /**
   * LE CONTENU D'UN RÉSEAU **PUBLIC** NE SORT PAS NON PLUS À UN NON-MEMBRE.
   *
   * ── POURQUOI CE TEST EXISTE, ALORS QUE CELUI DU DESSUS SEMBLE COUVRIR LE SUJET ──
   *
   * Il a été écrit après une MUTATION qui aurait dû rougir et ne l'a pas fait. Le
   * service pose deux gardes successives, et elles ne gardent pas la même chose :
   *
   *   · `load()` refuse l'accès à un réseau `INVITE_ONLY` — par un 404, pour ne pas
   *     même confirmer son existence ;
   *   · `assertMember()` refuse le CONTENU d'un réseau auquel on n'appartient pas,
   *     quelle que soit sa visibilité — par un 403 `NOT_A_MEMBER`.
   *
   * Le test du dessus n'emploie qu'un réseau `INVITE_ONLY`. La première garde y
   * répond donc toujours la première, et la seconde n'est jamais atteinte : en
   * neutralisant entièrement `assertMember()` (`if (false)`), ce test RESTE VERT.
   * Autrement dit, la garde qui protège le contenu des réseaux publics — de loin
   * les plus nombreux — n'était éprouvée par rien.
   *
   * Un réseau `PUBLIC` est DÉCOUVRABLE : son nom, sa description et son nombre de
   * membres sont faits pour être vus, c'est ce qui permet d'afficher le bouton
   * « Rejoindre ». Mais ses sujets, son fil, ses annonces, ses sondages, ses albums
   * et sa LISTE DE MEMBRES ne le sont pas. La distinction est exactement ce que ce
   * test fixe, et elle ne se lit dans aucune des deux gardes prise isolément.
   *
   * L'écart attendu est donc double, et les deux moitiés comptent :
   *   · l'en-tête PASSE pour un non-membre (sinon on ne pourrait pas rejoindre) ;
   *   · tout le contenu est REFUSÉ.
   */
  it('rule: le contenu d’un réseau PUBLIC n’est pas renvoyé à un non-membre, même si l’en-tête l’est', async () => {
    const owner = await newMember();
    const outsider = await newMember();
    const ouvert = await createInterest(owner, { visibility: 'PUBLIC' });

    const sujet = await communities.createTopic(ouvert.id, owner, {
      title: 'Le sujet d’un réseau public',
      body: 'Visible de ses membres, pas des passants.',
    });

    /**
     * LE SUJET EST ÉPINGLÉ, ET C'EST INDISPENSABLE.
     *
     * Écrit d'abord sans cette ligne, l'assertion `pinned` plus bas était CREUSE :
     * un sujet ordinaire porte `pinKind: 'NONE'`, `pinnedTopics()` ne le renvoie
     * donc jamais, et `pinned` valait `[]` que la garde soit là ou non. Mesuré :
     * en supprimant le masquage du service (`isMember ? … : []`), les 39 tests du
     * fichier restaient VERTS. L'assertion décrivait une absence garantie par
     * autre chose que la règle qu'elle prétendait garder.
     *
     * Épinglé, le sujet EST renvoyé par `pinnedTopics()` — avec son TITRE. Le
     * masquage devient alors la seule chose qui empêche un passant de lire les
     * titres des sujets épinglés d'un réseau qu'il n'a pas rejoint, et l'assertion
     * garde enfin quelque chose.
     */
    await communities.updateTopic(sujet.id, owner, { pinKind: 'RULES' });

    // ── L'EN-TÊTE PASSE, et c'est voulu : un réseau public se découvre. ──
    const entete = await communities.detail(ouvert.id, outsider);
    expect(entete.name).toBe(ouvert.name);
    expect(entete.myRole).toBeNull();
    expect(entete.canJoin).toBe(true);

    /**
     * … mais l'en-tête ne laisse fuir AUCUN contenu par ses compteurs. Un
     * `counters.topics` à 1 dirait à un passant qu'il se dit quelque chose ici, et
     * `pinned` porterait carrément des TITRES de sujets.
     */
    expect(entete.pinned).toEqual([]);
    expect(entete.counters.topics).toBe(0);
    expect(entete.counters.announcements).toBe(0);

    // ── LE CONTENU EST REFUSÉ, route par route. 403, et non 404 : le réseau ──
    // ── est public, donc son existence n'est pas un secret — seul son           ──
    // ── contenu l'est. Le code de refus n'est pas cosmétique, un écran décide  ──
    // ── dessus (§5.2).                                                          ──
    for (const [nom, appel] of [
      ['topics', () => communities.topics(ouvert.id, outsider, { limit: 20 })],
      ['feed', () => communities.feed(ouvert.id, outsider, { limit: 20 })],
      ['members', () => communities.members(ouvert.id, outsider, { limit: 20 })],
      ['announcements', () => communities.announcements(ouvert.id, outsider, { limit: 20 })],
      ['polls', () => communities.polls(ouvert.id, outsider, { limit: 20 })],
      ['albums', () => communities.albums(ouvert.id, outsider)],
      ['map', () => communities.map(ouvert.id, outsider)],
    ] as const) {
      await expect(appel(), `${nom} ne doit rien renvoyer à un non-membre`).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    }

    /**
     * LA PORTE DE DERRIÈRE : le sujet par son identifiant propre, sans passer par
     * le réseau. C'est le chemin qu'une fuite emprunte — il ne ressemble pas à une
     * lecture de réseau, donc on oublie de le garder.
     */
    const topicId = (
      await prisma.topic.findFirstOrThrow({
        where: { communityId: ouvert.id },
        select: { id: true },
      })
    ).id;
    await expect(communities.topic(topicId, outsider)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    /**
     * NON-VACUITÉ. Sans ces trois lignes, un service qui refuserait tout à tout le
     * monde passerait ce test en paraissant exemplaire — et le réseau serait
     * illisible pour ses propres membres.
     */
    expect((await communities.topics(ouvert.id, owner, { limit: 20 })).items).toHaveLength(1);
    expect((await communities.topic(topicId, owner)).title).toBe('Le sujet d’un réseau public');
    expect((await communities.members(ouvert.id, owner, { limit: 20 })).items.length).toBeGreaterThan(0);
  });

  // ══ Adhésion automatique — la chaîne de l'onboarding (§2.1, §6) ═══════════

  it('inscrit d’office un membre dans les réseaux de sa ville et de son pays', async () => {
    const member = await newMember();
    const result = await communities.syncAutoMemberships(member);
    expect(result.joined.length).toBeGreaterThanOrEqual(2);

    const rows = await prisma.communityMember.findMany({
      where: { userId: member, community: { kind: { in: ['CITY', 'COUNTRY'] } } },
      select: { status: true, role: true, community: { select: { kind: true, cityId: true, countryId: true } } },
    });

    const city = rows.find((r) => r.community.kind === 'CITY');
    const country = rows.find((r) => r.community.kind === 'COUNTRY');
    expect(city?.status).toBe('ACTIVE');
    expect(city?.community.cityId).toBe(cityId);
    expect(country?.status).toBe('ACTIVE');
    expect(country?.community.countryId).toBe(originCountryId);
  });

  it('est idempotent : un rejeu d’événement ne gonfle pas `member_count`', async () => {
    const member = await newMember();
    await communities.syncAutoMemberships(member);

    const city = await prisma.community.findFirstOrThrow({
      where: { kind: 'CITY', cityId },
      select: { id: true, memberCount: true },
    });

    // La livraison des événements est « au moins une fois » (00 §9.1) : rejouer
    // doit être sans effet. Sans le test « n'était pas déjà ACTIVE » dans
    // `activateMembership`, le compteur monterait de 3 ici.
    await communities.syncAutoMemberships(member);
    await communities.syncAutoMemberships(member);
    await communities.syncAutoMemberships(member);

    const after = await prisma.community.findUniqueOrThrow({
      where: { id: city.id },
      select: { memberCount: true },
    });
    expect(after.memberCount).toBe(city.memberCount);
    expect(
      await prisma.communityMember.count({ where: { communityId: city.id, userId: member } }),
    ).toBe(1);
  });

  it('change de réseau de ville quand le membre change de ville (§2.1)', async () => {
    const member = await newMember();
    await communities.syncAutoMemberships(member);

    const first = await prisma.community.findFirstOrThrow({
      where: { kind: 'CITY', cityId },
      select: { id: true },
    });

    await users.updateMe(member, { cityId: otherCityId });
    await communities.syncAutoMemberships(member);

    const second = await prisma.community.findFirstOrThrow({
      where: { kind: 'CITY', cityId: otherCityId },
      select: { id: true },
    });

    // « changement de ville = changement de réseau » : la NOUVELLE adhésion ne
    // suffit pas, l'ANCIENNE doit disparaître. Un recalcul qui n'ajouterait que
    // laisserait le membre dans les deux réseaux, et dans les deux listes.
    expect(
      await prisma.communityMember.findUnique({
        where: { communityId_userId: { communityId: first.id, userId: member } },
      }),
    ).toBeNull();
    expect(
      (
        await prisma.communityMember.findUniqueOrThrow({
          where: { communityId_userId: { communityId: second.id, userId: member } },
          select: { status: true },
        })
      ).status,
    ).toBe('ACTIVE');
  });

  it('ne réintègre jamais un membre BANNI d’un réseau automatique (§2.4)', async () => {
    const member = await newMember();
    await communities.syncAutoMemberships(member);
    const city = await prisma.community.findFirstOrThrow({
      where: { kind: 'CITY', cityId },
      select: { id: true },
    });

    await prisma.communityMember.update({
      where: { communityId_userId: { communityId: city.id, userId: member } },
      data: { status: 'BANNED' },
    });

    await communities.syncAutoMemberships(member);
    const after = await prisma.communityMember.findUniqueOrThrow({
      where: { communityId_userId: { communityId: city.id, userId: member } },
      select: { status: true },
    });
    // Un recalcul qui ramènerait le banni viderait la sanction de son sens.
    expect(after.status).toBe('BANNED');
  });

  it('ne crée aucun réseau pour une ville INACTIVE', async () => {
    const dormant = await prisma.city.create({
      data: {
        id: newId(),
        countryId: (await prisma.country.findFirstOrThrow({ where: { iso2: 'FR' } })).id,
        name: `Dormante ${counter++}`,
        slug: `dormante-${Date.now().toString(36)}${counter}`,
        latitude: 47.2,
        longitude: -1.55,
        isActive: false,
      },
    });
    try {
      // §2.1 : le réseau naît « à l'activation de la ville ». Le schéma le dit
      // aussi : « une ville inactive n'a ni réseau, ni carte, ni fiche ».
      expect(await communities.ensureAutoCommunity('CITY', dormant.id)).toBeNull();
      expect(await prisma.community.count({ where: { cityId: dormant.id } })).toBe(0);
    } finally {
      await prisma.city.delete({ where: { id: dormant.id } });
    }
  });

  it('rattrape l’adhésion automatique dès le premier `GET /communities`', async () => {
    const member = await newMember();
    expect(await prisma.communityMember.count({ where: { userId: member } })).toBe(0);

    // Personne n'émet `user.onboarded_location` et rien ne consomme la file
    // `events` : la liste doit donc rattraper elle-même, sinon le membre
    // n'aurait aucun réseau au premier écran.
    const listing = await communities.list(member, { limit: 20 });
    expect(listing.mine.map((c) => c.kind).sort()).toEqual(['CITY', 'COUNTRY']);
  });

  // ══ Blocage — masquage réciproque (§6) ════════════════════════════════════

  it('masque un membre bloqué de la liste des membres, dans les deux sens', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const a = await newMember();
    const b = await newMember();
    await communities.join(community.id, a);
    await communities.join(community.id, b);

    await prisma.block.create({
      data: { id: newId(), blockerUserId: a, blockedUserId: b },
    });

    const seenByA = (await communities.members(community.id, a, { limit: 50 })).items;
    const seenByB = (await communities.members(community.id, b, { limit: 50 })).items;

    // Celui qui a bloqué ne retrouve pas l'autre…
    expect(seenByA.map((m) => m.userId)).not.toContain(b);
    // …et le bloqué ne retrouve pas celui qui l'a bloqué (08 §4 : dans les deux
    // sens). Un filtre à sens unique laisserait B voir A, et la « séparation »
    // n'en serait plus une.
    expect(seenByB.map((m) => m.userId)).not.toContain(a);
    // Le propriétaire, lui, voit les deux : le masquage est propre au lecteur.
    const seenByOwner = (await communities.members(community.id, owner, { limit: 50 })).items;
    expect(seenByOwner.map((m) => m.userId)).toContain(a);
    expect(seenByOwner.map((m) => m.userId)).toContain(b);
  });

  it('masque un sujet écrit par un membre bloqué, liste et accès direct', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const reader = await newMember();
    await communities.join(community.id, reader);

    const topic = await communities.createTopic(community.id, owner, {
      title: 'Un sujet que le lecteur ne verra plus',
      body: 'Contenu.',
    });

    expect((await communities.topics(community.id, reader, { limit: 50 })).items).toHaveLength(1);

    await prisma.block.create({
      data: { id: newId(), blockerUserId: reader, blockedUserId: owner },
    });

    expect((await communities.topics(community.id, reader, { limit: 50 })).items).toHaveLength(0);
    // Et par son identifiant : la liste filtrée ne suffirait pas si le sujet
    // restait lisible en direct.
    await expect(communities.topic(topic.id, reader)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    // Épinglé, il ne reparaît pas non plus dans l'en-tête.
    await communities.updateTopic(topic.id, owner, { pinKind: 'RULES' });
    expect((await communities.detail(community.id, reader)).pinned).toHaveLength(0);
    expect((await communities.detail(community.id, owner)).pinned).toHaveLength(1);
  });

  it('écarte un membre séparé des invitations et du décompte des 5', async () => {
    const owner = await newMember();
    const blocked = await newMember();
    const blockedHandle = await handleOf(blocked);
    await prisma.block.create({
      data: { id: newId(), blockerUserId: owner, blockedUserId: blocked },
    });

    const four = (await fiveInvitees()).slice(0, 4);
    await expect(
      communities.create(owner, {
        name: 'Avec un bloqué',
        category: 'sorties',
        visibility: 'PUBLIC',
        inviteHandles: [...four, blockedHandle],
      }),
    ).rejects.toMatchObject({ code: 'NOT_ENOUGH_INVITES' });
  });

  // ══ Visibilité et adhésion (§2.2) ═════════════════════════════════════════

  it('met une demande en attente sur un réseau ON_REQUEST, puis l’accepte', async () => {
    const owner = await newMember();
    const community = await createInterest(owner, { visibility: 'ON_REQUEST' });
    const candidate = await newMember();

    const afterJoin = await communities.join(community.id, candidate);
    expect(afterJoin.myStatus).toBe('PENDING');
    // Un PENDING n'est pas un membre : le contenu lui reste fermé.
    await expect(
      communities.topics(community.id, candidate, { limit: 20 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    // …et il n'est pas compté dans les membres.
    expect(
      (await prisma.community.findUniqueOrThrow({ where: { id: community.id }, select: { memberCount: true } }))
        .memberCount,
    ).toBe(1);

    const pendingList = await communities.members(community.id, owner, { limit: 20, pending: true });
    expect(pendingList.items.map((m) => m.userId)).toContain(candidate);

    await communities.decideRequest(community.id, owner, candidate, 'accept');
    expect((await communities.detail(community.id, candidate)).myStatus).toBe('ACTIVE');
    expect((await communities.topics(community.id, candidate, { limit: 20 })).items).toEqual([]);
  });

  it('refuse le contenu d’un réseau PUBLIC à qui ne l’a pas rejoint (§2.3)', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const outsider = await newMember();

    // L'en-tête est visible — c'est ainsi qu'on décide de rejoindre…
    expect((await communities.detail(community.id, outsider)).canJoin).toBe(true);
    // …mais « Membres seulement » pour le fil et les sujets. 403 et non 404 :
    // l'existence du réseau n'est pas un secret, « rejoignez d'abord » l'est encore moins.
    await expect(communities.feed(community.id, outsider, { limit: 20 })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('ne laisse plus revenir un membre banni (§2.4)', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const troublemaker = await newMember();
    await communities.join(community.id, troublemaker);

    await communities.updateMember(community.id, owner, troublemaker, { status: 'BANNED' });

    await expect(communities.join(community.id, troublemaker)).rejects.toMatchObject({
      code: 'BANNED_FROM_COMMUNITY',
    });
    // La ligne RESTE : c'est elle qui interdit le retour. La supprimer laisserait
    // le banni rejoindre comme un inconnu.
    const row = await prisma.communityMember.findUniqueOrThrow({
      where: { communityId_userId: { communityId: community.id, userId: troublemaker } },
      select: { status: true },
    });
    expect(row.status).toBe('BANNED');

    // §2.4 : « toute action de modération de réseau est journalisée », en MEMBER.
    const entry = await prisma.auditLog.findFirst({
      where: { action: 'community.member_banned', actorId: owner },
      orderBy: { createdAt: 'desc' },
      select: { actorType: true },
    });
    expect(entry?.actorType).toBe('MEMBER');
  });

  it('n’a qu’UN propriétaire, avant comme après un transfert (§2.2)', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const successor = await newMember();
    await communities.join(community.id, successor);

    // Un propriétaire ne part pas sans successeur : le réseau deviendrait
    // impossible à modérer et à réactiver.
    await expect(communities.leave(community.id, owner)).rejects.toMatchObject({
      code: 'OWNER_MUST_TRANSFER',
    });

    await communities.transfer(community.id, owner, successor);

    const roles = await prisma.communityMember.findMany({
      where: { communityId: community.id, role: 'OWNER' },
      select: { userId: true },
    });
    expect(roles).toHaveLength(1);
    expect(roles[0]?.userId).toBe(successor);
    // L'ancien devient modérateur, pas un membre ordinaire : il connaît le réseau.
    expect((await communities.detail(community.id, owner)).myRole).toBe('MODERATOR');
    // Et il peut maintenant partir.
    await communities.leave(community.id, owner);
  });

  it('réserve la nomination des modérateurs au propriétaire', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const moderator = await newMember();
    const member = await newMember();
    await communities.join(community.id, moderator);
    await communities.join(community.id, member);
    await communities.updateMember(community.id, owner, moderator, { role: 'MODERATOR' });

    // Un modérateur ne nomme pas, et ne touche pas à un autre modérateur :
    // sinon deux modérateurs pourraient se destituer l'un l'autre.
    await expect(
      communities.updateMember(community.id, moderator, member, { role: 'MODERATOR' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      communities.updateMember(community.id, moderator, moderator, { status: 'BANNED' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    // Le propriétaire n'est jamais la cible.
    await expect(
      communities.updateMember(community.id, moderator, owner, { status: 'BANNED' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    // Mais il retire bien un membre ordinaire : c'est son rôle (§2.4).
    await communities.updateMember(community.id, moderator, member, { status: 'BANNED' });
  });

  // ══ Sujets (§2.3, §4) ════════════════════════════════════════════════════

  it('n’épingle pas plus de 5 sujets (§2.3)', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);

    const ids: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      const topic = await communities.createTopic(community.id, owner, {
        title: `Sujet numero ${i} du reseau`,
        body: 'Corps.',
      });
      ids.push(topic.id);
    }

    for (const id of ids.slice(0, 5)) {
      await communities.updateTopic(id, owner, { pinKind: 'RESOURCE' });
    }
    await expect(
      communities.updateTopic(ids[5] as string, owner, { pinKind: 'RESOURCE' }),
    ).rejects.toMatchObject({ code: 'PIN_LIMIT' });

    // Un épinglé retiré libère la place : sinon la limite serait un cul-de-sac.
    await communities.updateTopic(ids[0] as string, owner, { pinKind: 'NONE' });
    await communities.updateTopic(ids[5] as string, owner, { pinKind: 'RESOURCE' });
    expect((await communities.detail(community.id, owner)).pinned).toHaveLength(5);
  });

  it('réserve l’épinglage aux modérateurs et RÉSOLU à l’auteur (§2.3, §4)', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const author = await newMember();
    const bystander = await newMember();
    await communities.join(community.id, author);
    await communities.join(community.id, bystander);

    const topic = await communities.createTopic(community.id, author, {
      title: 'Une question sur les demarches',
      body: 'Corps.',
    });

    await expect(
      communities.updateTopic(topic.id, author, { pinKind: 'RULES' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      communities.updateTopic(topic.id, bystander, { status: 'RESOLVED' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const resolved = await communities.updateTopic(topic.id, author, { status: 'RESOLVED' });
    expect(resolved.status).toBe('RESOLVED');
    // L'événement du §6 part, une seule fois.
    expect(
      await prisma.domainEvent.count({
        where: { aggregateId: topic.id, type: 'community.topic_resolved' },
      }),
    ).toBe(1);

    // ARCHIVED n'est pas posé à la main : c'est la tâche des 90 jours (§7).
    await expect(
      communities.updateTopic(topic.id, owner, { status: 'ARCHIVED' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('ne laisse corriger le titre que dans les 15 minutes (§4)', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const topic = await communities.createTopic(community.id, owner, {
      title: 'Titre initial du sujet',
      body: 'Corps.',
    });

    await communities.updateTopic(topic.id, owner, { title: 'Titre corrige du sujet' });

    // Vingt minutes plus tard : la fenêtre est fermée.
    await prisma.topic.update({
      where: { id: topic.id },
      data: { createdAt: new Date(Date.now() - 20 * 60_000) },
    });
    await expect(
      communities.updateTopic(topic.id, owner, { title: 'Reecriture tardive du sujet' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', details: { reason: 'EDIT_WINDOW_CLOSED' } });
    // Mais RÉSOLU reste possible : la fenêtre ne concerne que le texte.
    await communities.updateTopic(topic.id, owner, { status: 'RESOLVED' });
  });

  it('archive les sujets sans réponse depuis 90 jours, et pas les autres (§7)', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);

    const stale = await communities.createTopic(community.id, owner, {
      title: 'Sujet sans aucune reponse',
      body: 'Corps.',
    });
    const repliedRecently = await communities.createTopic(community.id, owner, {
      title: 'Sujet avec une reponse recente',
      body: 'Corps.',
    });
    const fresh = await communities.createTopic(community.id, owner, {
      title: 'Sujet ouvert tout juste',
      body: 'Corps.',
    });

    const old = new Date(Date.now() - (TOPIC_ARCHIVE_AFTER_DAYS + 5) * 86_400_000);
    // `stale` n'a JAMAIS reçu de réponse : `last_reply_at` est nul, et c'est le
    // cas qu'un simple `lastReplyAt < date` laisserait passer.
    await prisma.topic.update({ where: { id: stale.id }, data: { createdAt: old } });
    await prisma.topic.update({
      where: { id: repliedRecently.id },
      data: { createdAt: old, lastReplyAt: new Date() },
    });

    await communities.archiveStaleTopics();

    const after = await prisma.topic.findMany({
      where: { id: { in: [stale.id, repliedRecently.id, fresh.id] } },
      select: { id: true, status: true },
    });
    expect(after.find((t) => t.id === stale.id)?.status).toBe('ARCHIVED');
    expect(after.find((t) => t.id === repliedRecently.id)?.status).toBe('OPEN');
    expect(after.find((t) => t.id === fresh.id)?.status).toBe('OPEN');
  });

  // ══ Annonces (§2.3) ══════════════════════════════════════════════════════

  it('n’accepte que deux annonces par semaine, par RÉSEAU (§2.3)', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const moderator = await newMember();
    await communities.join(community.id, moderator);
    await communities.updateMember(community.id, owner, moderator, { role: 'MODERATOR' });

    await communities.createAnnouncement(community.id, owner, 'Première annonce.');
    await communities.createAnnouncement(community.id, owner, 'Deuxième annonce.');

    // Un AUTRE auteur, mais le même réseau : la limite protège les membres de
    // la sur-notification, pas les auteurs d'eux-mêmes.
    await expect(
      communities.createAnnouncement(community.id, moderator, 'Troisième annonce.'),
    ).rejects.toMatchObject({ code: 'ANNOUNCEMENT_LIMIT' });

    // Une semaine plus tôt : le compteur glisse.
    await prisma.communityAnnouncement.updateMany({
      where: { communityId: community.id },
      data: { createdAt: new Date(Date.now() - 8 * 86_400_000) },
    });
    await communities.createAnnouncement(community.id, moderator, 'La semaine suivante.');

    // Un membre ordinaire n'annonce pas (§2.3 : propriétaire et modérateurs).
    const member = await newMember();
    await communities.join(community.id, member);
    await expect(
      communities.createAnnouncement(community.id, member, 'Moi aussi ?'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  // ══ Sondages (§2.3) ══════════════════════════════════════════════════════

  it('ne montre les résultats qu’après vote ou clôture (§2.3)', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const voter = await newMember();
    const abstainer = await newMember();
    await communities.join(community.id, voter);
    await communities.join(community.id, abstainer);

    const poll = await communities.createPoll(community.id, owner, {
      question: 'Quel jour pour le prochain repas ?',
      options: ['Samedi', 'Dimanche'],
      isMultiple: false,
    });

    const before = await communities.poll(poll.id, abstainer);
    expect(before.resultsVisible).toBe(false);
    // Les compteurs sont ABSENTS de la réponse, pas seulement masqués à
    // l'affichage : les renvoyer en demandant au front de ne pas les montrer
    // revient à les publier.
    expect(before.totalVotes).toBeNull();
    expect(before.options.every((o) => o.voteCount === null)).toBe(true);

    const afterVote = await communities.vote(poll.id, voter, [poll.options[0]?.id as string]);
    expect(afterVote.resultsVisible).toBe(true);
    expect(afterVote.totalVotes).toBe(1);
    // Celui qui n'a pas voté ne voit toujours rien.
    expect((await communities.poll(poll.id, abstainer)).totalVotes).toBeNull();

    await communities.closePoll(poll.id, owner);
    // Clos : tout le monde voit.
    expect((await communities.poll(poll.id, abstainer)).totalVotes).toBe(1);
  });

  it('compte UN vote par membre, modifiable jusqu’à la clôture (§2.3)', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const voter = await newMember();
    await communities.join(community.id, voter);

    const poll = await communities.createPoll(community.id, owner, {
      question: 'Quelle soirée preferez-vous ?',
      options: ['Samedi', 'Dimanche', 'Vendredi'],
      isMultiple: false,
    });
    const [first, second] = poll.options;

    await communities.vote(poll.id, voter, [first?.id as string]);
    // Le membre change d'avis : son vote est REMPLACÉ, pas ajouté. Un `create`
    // simple le compterait deux fois.
    const changed = await communities.vote(poll.id, voter, [second?.id as string]);
    expect(changed.totalVotes).toBe(1);
    expect(changed.options.find((o) => o.id === first?.id)?.voteCount).toBe(0);
    expect(changed.options.find((o) => o.id === second?.id)?.voteCount).toBe(1);
    expect(await prisma.pollVote.count({ where: { userId: voter, pollOption: { pollId: poll.id } } })).toBe(1);

    // Choix unique : deux options à la fois sont refusées.
    await expect(
      communities.vote(poll.id, voter, [first?.id as string, second?.id as string]),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });

    await communities.closePoll(poll.id, owner);
    await expect(
      communities.vote(poll.id, voter, [first?.id as string]),
    ).rejects.toMatchObject({ code: 'POLL_CLOSED' });
  });

  it('accepte plusieurs options sur un sondage à choix multiple', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const poll = await communities.createPoll(community.id, owner, {
      question: 'Quels ateliers vous interessent ?',
      options: ['Cuisine', 'Couture', 'Code'],
      isMultiple: true,
    });

    const voted = await communities.vote(poll.id, owner, [
      poll.options[0]?.id as string,
      poll.options[2]?.id as string,
    ]);
    expect(voted.myOptionIds).toHaveLength(2);
    expect(voted.totalVotes).toBe(2);

    // Réduction du choix : l'option retirée redescend à zéro.
    const reduced = await communities.vote(poll.id, owner, [poll.options[0]?.id as string]);
    expect(reduced.options.find((o) => o.id === poll.options[2]?.id)?.voteCount).toBe(0);
  });

  // ══ Carte et compteurs (§2.3, §7) ════════════════════════════════════════

  it('compte les membres par ville, sans jamais de position individuelle (§2.3)', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const elsewhere = await newMember({ city: otherCityId });
    await communities.join(community.id, elsewhere);

    const map = await communities.map(community.id, owner);
    const testville = map.items.find((c) => c.cityId === cityId);
    const autreville = map.items.find((c) => c.cityId === otherCityId);

    expect(testville?.memberCount).toBeGreaterThanOrEqual(1);
    expect(autreville?.memberCount).toBe(1);
    // Des compteurs de VILLE, et rien de plus fin (règle dure 00 §1.2).
    expect(JSON.stringify(map)).not.toContain('latitude');
    expect(Object.keys(map.items[0] ?? {})).toEqual(['cityId', 'name', 'slug', 'memberCount']);
  });

  it('recalcule `member_count` quand il a dérivé (§7)', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const joiner = await newMember();
    await communities.join(community.id, joiner);

    await prisma.community.update({ where: { id: community.id }, data: { memberCount: 999 } });
    await communities.recomputeMemberCounts();

    const after = await prisma.community.findUniqueOrThrow({
      where: { id: community.id },
      select: { memberCount: true },
    });
    expect(after.memberCount).toBe(2);
  });

  // ══ Découverte (§2.2, §4) ════════════════════════════════════════════════

  it('retire un réseau archivé de la découverte (§2.2)', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const browser = await newMember();

    expect(
      (await communities.list(browser, { limit: 50, q: community.name })).discover.items,
    ).toHaveLength(1);

    await prisma.community.update({
      where: { id: community.id },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    });

    expect(
      (await communities.list(browser, { limit: 50, q: community.name })).discover.items,
    ).toHaveLength(0);
    // Mais il reste dans MES réseaux : « le réseau reste dans sa liste » (§2.5),
    // et le propriétaire doit pouvoir le retrouver pour le réactiver.
    expect((await communities.list(owner, { limit: 50 })).mine.map((c) => c.id)).toContain(
      community.id,
    );
  });

  it('filtre la découverte par catégorie et par ville', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const browser = await newMember();

    const byCategory = await communities.list(browser, { limit: 50, category: 'cuisine' });
    expect(byCategory.discover.items.map((c) => c.id)).toContain(community.id);

    const wrongCategory = await communities.list(browser, {
      limit: 50,
      category: 'musique',
      q: community.name,
    });
    expect(wrongCategory.discover.items).toHaveLength(0);

    const autoOnly = await communities.list(browser, { limit: 50, kind: 'CITY' });
    expect(autoOnly.discover.items.every((c) => c.kind === 'CITY')).toBe(true);
  });

  it('marque `joined` sur les réseaux déjà rejoints', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const listing = await communities.list(owner, { limit: 50, q: community.name });
    expect(listing.discover.items[0]?.joined).toBe(true);
  });

  // ══ Albums (§2.3) ════════════════════════════════════════════════════════

  it('refuse une photo dont l’image n’appartient pas à celui qui la pose', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const other = await newMember();
    await communities.join(community.id, other);

    const album = await communities.createAlbum(community.id, owner, { title: 'Repas de juin' });

    const asset = await prisma.mediaAsset.create({
      data: {
        id: newId(),
        ownerUserId: owner,
        kind: 'ALBUM',
        storageKey: `test/${newId()}.jpg`,
        mime: 'image/jpeg',
        sizeBytes: BigInt(1024),
        status: 'READY',
      },
    });

    try {
      // L'image est à `owner` : `other` ne peut pas l'accrocher à l'album en
      // devinant son identifiant.
      await expect(
        communities.addPhoto(album.id, other, { mediaAssetId: asset.id }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });

      const photo = await communities.addPhoto(album.id, owner, { mediaAssetId: asset.id });
      const albums = await communities.albums(community.id, owner);
      expect(albums.items[0]?.photos.map((p) => p.id)).toContain(photo.id);

      // Un modérateur retire ce qu'il n'a pas posé (§2.3), et c'est journalisé.
      await communities.deletePhoto(album.id, photo.id, owner);
      expect((await communities.albums(community.id, owner)).items[0]?.photos).toHaveLength(0);
    } finally {
      await prisma.mediaAsset.delete({ where: { id: asset.id } });
    }
  });

  // ══ Événements de domaine (§6) ═══════════════════════════════════════════

  it('émet les événements du §6 dans la transaction qui les cause', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);

    expect(
      await prisma.domainEvent.count({
        where: { aggregateId: community.id, type: 'community.created' },
      }),
    ).toBe(1);

    const joiner = await newMember();
    await communities.join(community.id, joiner);
    await communities.leave(community.id, joiner);

    const events = await prisma.domainEvent.findMany({
      where: { aggregateId: community.id },
      select: { type: true },
    });
    const types = events.map((e) => e.type);
    expect(types).toContain('community.member_joined');
    expect(types).toContain('community.member_left');
  });

  it('repousse l’archivage à chaque activité (§2.2)', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);

    const longAgo = new Date(Date.now() - 59 * 86_400_000);
    await prisma.community.update({
      where: { id: community.id },
      data: { lastActivityAt: longAgo },
    });

    await communities.createTopic(community.id, owner, {
      title: 'Un signe de vie dans le reseau',
      body: 'Corps.',
    });

    const after = await prisma.community.findUniqueOrThrow({
      where: { id: community.id },
      select: { lastActivityAt: true },
    });
    // `last_activity_at` est écrit DANS la transaction du sujet : entre les deux,
    // la tâche d'archivage pourrait passer et endormir un réseau qui vient de vivre.
    expect(after.lastActivityAt.getTime()).toBeGreaterThan(longAgo.getTime());
  });
});
