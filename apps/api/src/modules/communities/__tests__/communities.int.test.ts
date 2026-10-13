import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import {
  COMMUNITY_ARCHIVE_AFTER_DAYS,
  COMMUNITY_CITY_THRESHOLD_SETTING_KEY,
  COMMUNITY_MIN_INVITES,
  createAnnouncementSchema,
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
import { ConnectionsService } from '../../connections/connections.service';
import { MessagingService } from '../../messaging/messaging.service';
import { numeroDEpreuve } from '../../../common/__tests__/numeros';

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
  /** Gardé à part pour relire la LISTE des conversations (titre du fil d'équipe). */
  let messaging: MessagingService;
  let users: UsersService;
  let auth: AuthService;
  const sms = new FakeSmsProvider();

  const createdUserIds: string[] = [];
  const createdCommunityIds: string[] = [];
  let cityId = '';
  let otherCityId = '';
  let originCountryId = '';

  let counter = 0;
  const nextPhone = (): string => numeroDEpreuve(counter++);

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

    /**
     * `MessagingService` EN SIXIÈME ARGUMENT, pour « Contacter les
     * modérateurs » : `POST /communities/:id/moderators-conversation` délègue la
     * création du fil au module 08, qui seul connaît la forme d'une
     * conversation. Le monter ici n'ajoute aucune dépendance de test — ses
     * quatre collaborateurs sont déjà debout juste au-dessus.
     */
    messaging = new MessagingService(
      prisma,
      crypto,
      outbox,
      audit,
      visibility,
      new ConnectionsService(prisma, outbox, audit, visibility),
    );
    communities = new CommunitiesService(prisma, outbox, audit, visibility, messaging);
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
    /**
     * LES SIGNALEMENTS ET LES PUBLICATIONS DE TEST, AVANT LES COMPTES.
     *
     * `reports.reporter_user_id` est en `Cascade`, donc supprimer les comptes
     * emporterait les signalements — mais pas les PUBLICATIONS du fil global
     * créées par le cas « pas dans le réseau », qui sont en cascade sur l'auteur
     * elles aussi. L'ordre reste explicite : un nettoyage qui compte sur une
     * cascade cesse de nettoyer le jour où la cascade change.
     */
    if (createdUserIds.length > 0) {
      await prisma.report.deleteMany({ where: { reporterUserId: { in: createdUserIds } } });
      await prisma.post.deleteMany({ where: { authorUserId: { in: createdUserIds } } });
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

  /**
   * ⚠ CE CAS A GAGNÉ TROIS ATTENDUS, et c'est l'arbitrage du 2026-10-11 qui les
   * lui a donnés : il vérifiait que l'avertissement était IDENTIFIÉ, pas qu'il
   * était ENVOYÉ. Il l'était à juste titre — `communities.warning_sent_at`
   * n'existait pas, et la tâche ne faisait que relever la liste. La colonne est
   * arrivée avec la migration `reseaux_sourdine_inviteur_avertissement`, et les
   * trois attendus couvrent les trois moitiés du mécanisme.
   */
  it('avertit à 45 jours sans archiver, UNE SEULE FOIS, et de nouveau après une reprise', async () => {
    const owner = await newMember();
    const interest = await createInterest(owner);
    await prisma.community.update({
      where: { id: interest.id },
      data: { lastActivityAt: new Date(Date.now() - 50 * 86_400_000) },
    });

    const result = await communities.archiveInactive();
    expect(result.warned).toContain(interest.id);
    expect(result.archived).not.toContain(interest.id);

    // 1. L'HORODATAGE EST POSÉ, et l'événement est parti vers `notifications`.
    const apres = await prisma.community.findUniqueOrThrow({
      where: { id: interest.id },
      select: { warningSentAt: true },
    });
    expect(apres.warningSentAt).not.toBeNull();

    const emis = await prisma.domainEvent.findMany({
      where: { aggregateId: interest.id, type: 'community.archive_warning' },
      select: { id: true, payload: true },
    });
    expect(emis).toHaveLength(1);
    expect(emis[0]?.payload).toMatchObject({ ownerUserId: owner });

    /**
     * 2. LE SECOND PASSAGE NE PRÉVIENT PLUS. C'est tout l'objet de la colonne :
     * la tâche est QUOTIDIENNE et la fenêtre dure quinze jours — sans mémoire,
     * le propriétaire recevrait quinze fois le même avertissement.
     */
    const second = await communities.archiveInactive();
    expect(second.warned).not.toContain(interest.id);
    expect(
      await prisma.domainEvent.count({
        where: { aggregateId: interest.id, type: 'community.archive_warning' },
      }),
    ).toBe(1);

    /**
     * 3. UNE ACTIVITÉ REMET LE COMPTEUR À ZÉRO, et c'est l'autre moitié : un
     * réseau qui reprend puis se rendort doit être prévenu DE NOUVEAU, sinon il
     * serait archivé sans préavis — ce que §2.2 promet d'éviter.
     *
     * On passe par une vraie écriture (`createTopic` appelle `touch()`) plutôt
     * que par un `UPDATE` à la main : c'est `touch()` qu'on veut éprouver.
     */
    await communities.createTopic(interest.id, owner, {
      title: 'Le réseau reprend vie',
      body: 'Une activité, et l’avertissement doit pouvoir repartir.',
    });
    const reveille = await prisma.community.findUniqueOrThrow({
      where: { id: interest.id },
      select: { warningSentAt: true },
    });
    expect(reveille.warningSentAt).toBeNull();

    await prisma.community.update({
      where: { id: interest.id },
      data: { lastActivityAt: new Date(Date.now() - 50 * 86_400_000) },
    });
    const troisieme = await communities.archiveInactive();
    expect(troisieme.warned).toContain(interest.id);
  });

  // ══ LA SOURDINE — §2.5 et §4 (« `muted` (soi-même) ») ═════════════════════

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LA SOURDINE EST UNE PRÉFÉRENCE, ET CE CAS GARDE LES QUATRE DÉCISIONS     ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * §2.5 : « Un membre peut mettre un réseau en sourdine : plus de
   * notifications, le réseau reste dans sa liste. » §4 : « `muted` (soi-même) ».
   *
   * Le FILTRE des notifications, lui, est éprouvé dans
   * `notifications.int.test.ts` — c'est là qu'il vit (00 §3.3 : ce module émet
   * un événement, il ne notifie pas).
   */
  it('met un réseau en sourdine sur SON propre rang, et nulle part ailleurs (§2.5)', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const membre = await newMember();
    await communities.join(community.id, membre);

    // Par défaut, personne n'a demandé le silence.
    const avant = await communities.detail(community.id, membre);
    expect(avant.myMuted).toBe(false);

    const pose = await communities.updateMember(community.id, membre, membre, { muted: true });
    expect(pose).toMatchObject({ userId: membre, muted: true, status: 'ACTIVE' });

    const apres = await communities.detail(community.id, membre);
    expect(apres.myMuted).toBe(true);

    /**
     * « LE RÉSEAU RESTE DANS SA LISTE » — §2.5 le dit, et c'est la moitié qu'on
     * oublierait le plus facilement : une sourdine qui retirerait le réseau de
     * « Mes réseaux » serait un départ déguisé.
     */
    const liste = await communities.list(membre, { limit: 20 });
    const sien = liste.mine.find((c) => c.id === community.id);
    expect(sien).toBeDefined();
    expect(sien?.muted).toBe(true);

    // Et la sourdine d'un membre n'est pas celle d'un autre.
    expect((await communities.detail(community.id, owner)).myMuted).toBe(false);

    // Elle se rallume d'un second geste — idempotent, et sans effet de bord.
    await communities.updateMember(community.id, membre, membre, { muted: false });
    expect((await communities.detail(community.id, membre)).myMuted).toBe(false);

    /**
     * ⚠ AUCUN RÔLE NE PERMET DE FAIRE TAIRE UN RÉSEAU POUR QUELQU'UN D'AUTRE.
     * Le propriétaire qui le pourrait aurait un moyen de couper les
     * notifications d'un membre sans le bannir ni le prévenir — c'est-à-dire de
     * l'exclure en silence, ce que §2.4 ne lui donne pas.
     */
    await expect(
      communities.updateMember(community.id, owner, membre, { muted: true }),
    ).rejects.toMatchObject({ code: 'MUTE_SELF_ONLY' });

    /**
     * ⚠ ET ELLE NE VOYAGE PAS AVEC UN GESTE DE MODÉRATION : une requête ne peut
     * pas être à la fois un acte de modération et un réglage personnel, et une
     * seule ligne d'audit ne saurait pas décrire les deux.
     */
    await expect(
      communities.updateMember(community.id, owner, membre, { muted: true, role: 'MODERATOR' }),
    ).rejects.toMatchObject({ code: 'MUTE_ALONE' });
  });

  it('laisse un INVITÉ couper les notifications avant d’avoir accepté (§2.5)', async () => {
    const owner = await newMember();
    const invite = await newMember();
    const handle = await handleOf(invite);
    const created = await communities.create(owner, {
      name: `Sourdine ${Date.now().toString(36)}${counter++}`,
      category: 'cuisine',
      visibility: 'PUBLIC',
      inviteHandles: [handle, ...(await fiveInvitees())],
    });
    createdCommunityIds.push(created.id);

    /**
     * `assertMember` AURAIT REFUSÉ, et c'est pour cela que la sourdine ne passe
     * pas par lui : un invité reçoit déjà les notifications du réseau — c'est
     * même ce qu'est une invitation — et doit pouvoir les couper sans accepter.
     */
    const pose = await communities.updateMember(created.id, invite, invite, { muted: true });
    expect(pose).toMatchObject({ muted: true, status: 'INVITED' });
    expect((await communities.detail(created.id, invite)).myMuted).toBe(true);
  });

  it('ne met pas en sourdine un réseau qu’on n’a pas rejoint (§2.5)', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const passant = await newMember({ city: otherCityId });

    /**
     * 404 ET NON 403 : il n'y a aucune ligne d'adhésion où écrire. En créer une
     * pour l'occasion mettrait dans `community_members` des lignes que personne
     * n'a demandées — et qui compteraient dans la liste des membres.
     */
    await expect(
      communities.updateMember(community.id, passant, passant, { muted: true }),
    ).rejects.toMatchObject({ status: 404 });
  });

  // ══ QUI A INVITÉ — §3, `community_members.invited_by_user_id` ═════════════

  it('écrit qui a invité, à la création comme sur `POST /invite` (§3)', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);

    /**
     * À LA CRÉATION, l'inviteur est le CRÉATEUR : §2.2 exige cinq invitations à
     * la création, et il n'y a qu'une personne pour les envoyer.
     */
    const aLaCreation = await prisma.communityMember.findMany({
      where: { communityId: community.id, status: 'INVITED' },
      select: { invitedByUserId: true },
    });
    expect(aLaCreation).toHaveLength(COMMUNITY_MIN_INVITES);
    expect(aLaCreation.every((m) => m.invitedByUserId === owner)).toBe(true);

    // Le propriétaire, lui, n'a été invité par personne.
    const rangDuChef = await prisma.communityMember.findFirstOrThrow({
      where: { communityId: community.id, userId: owner },
      select: { invitedByUserId: true },
    });
    expect(rangDuChef.invitedByUserId).toBeNull();

    /**
     * SUR `POST /invite`, c'est L'APPELANT et non le propriétaire : sur un
     * réseau PUBLIC, n'importe quel membre invite (`assertMember`). Écrire le
     * propriétaire ferait dire au journal qu'il a invité des gens qu'il n'a
     * jamais nommés.
     */
    const parrain = await newMember();
    await communities.join(community.id, parrain);
    const nouveau = await newMember();
    const handle = await handleOf(nouveau);
    const result = await communities.invite(community.id, parrain, { handles: [handle] });
    expect(result.invited).toEqual([handle]);

    const rang = await prisma.communityMember.findFirstOrThrow({
      where: { communityId: community.id, userId: nouveau },
      select: { invitedByUserId: true, status: true },
    });
    expect(rang).toMatchObject({ invitedByUserId: parrain, status: 'INVITED' });

    // Une adhésion SPONTANÉE n'a pas d'inviteur : la colonne est nullable pour ça.
    const seul = await newMember();
    await communities.join(community.id, seul);
    const spontane = await prisma.communityMember.findFirstOrThrow({
      where: { communityId: community.id, userId: seul },
      select: { invitedByUserId: true },
    });
    expect(spontane.invitedByUserId).toBeNull();
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

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ ARBITRAGE DU PORTEUR — « RETIRER » ET « BANNIR » SONT DEUX GESTES        ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Mot pour mot : « Retirer, il peut rejoindre à nouveau. Mais banni, il ne peut
   * plus rejoindre. » La maquette dessinait bien DEUX entrées dans le menu d'une
   * ligne de membre ; §2.4 n'en décrit qu'une, et un lot précédent les avait donc
   * branchées toutes les deux sur le bannissement.
   *
   * CE TEST EXISTE POUR LA DIFFÉRENCE, et c'est le `join` d'après le retrait qui
   * la prouve : avec l'ancien branchement il répondait `BANNED_FROM_COMMUNITY`.
   */
  it('retirer n’est pas bannir : le retiré revient, le banni non (arbitrage §2.4)', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const membre = await newMember();
    await communities.join(community.id, membre);

    await communities.removeMember(community.id, owner, membre);

    // L'adhésion DISPARAÎT, comme après un `leave` — par opposition au
    // bannissement, qui garde la ligne en `BANNED`.
    expect(
      await prisma.communityMember.findUnique({
        where: { communityId_userId: { communityId: community.id, userId: membre } },
        select: { status: true },
      }),
    ).toBeNull();

    // LA PREUVE : il rejoint de nouveau, comme n'importe qui.
    expect((await communities.join(community.id, membre)).myStatus).toBe('ACTIVE');

    // Et le bannissement, lui, ferme la porte.
    await communities.updateMember(community.id, owner, membre, { status: 'BANNED' });
    await expect(communities.join(community.id, membre)).rejects.toMatchObject({
      code: 'BANNED_FROM_COMMUNITY',
    });

    /**
     * DEUX LIGNES D'AUDIT DISTINCTES — §2.4 l'exige, et c'est ce qui rend le
     * journal capable de dire LEQUEL des deux gestes a eu lieu. Deux
     * conséquences opposées sous un même nom d'action ne seraient plus
     * distinguables cinq ans plus tard.
     */
    const lignes = await prisma.auditLog.findMany({
      where: {
        actorId: owner,
        action: { in: ['community.member_removed', 'community.member_banned'] },
      },
      orderBy: { createdAt: 'asc' },
      select: { action: true, actorType: true, metadata: true },
    });
    expect(lignes.map((l) => l.action)).toEqual([
      'community.member_removed',
      'community.member_banned',
    ]);
    expect(lignes.every((l) => l.actorType === 'MEMBER')).toBe(true);
    expect((lignes[0]?.metadata as { reversible?: boolean } | null)?.reversible).toBe(true);
    expect((lignes[1]?.metadata as { reversible?: boolean } | null)?.reversible).toBe(false);
  });

  it('ne laisse pas retirer le propriétaire, ni un modérateur par un autre', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const mod1 = await newMember();
    const mod2 = await newMember();
    await communities.join(community.id, mod1);
    await communities.join(community.id, mod2);
    await communities.updateMember(community.id, owner, mod1, { role: 'MODERATOR' });
    await communities.updateMember(community.id, owner, mod2, { role: 'MODERATOR' });

    // La route de retrait applique EXACTEMENT les refus du bannissement : c'est
    // pour cela qu'ils vivent dans `moderationTarget` et non dans chaque route.
    await expect(communities.removeMember(community.id, mod1, owner)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(communities.removeMember(community.id, mod1, mod2)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    // Le propriétaire, lui, peut retirer un modérateur.
    await communities.removeMember(community.id, owner, mod2);
  });

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ ARBITRAGE DU PORTEUR — SEPT JOURS POUR REVENIR SUR UN MASQUAGE           ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * « Le modérateur qui a masqué peut remettre dans les sept jours. Au-delà,
   * seule l'équipe. » Avant ce lot, masquer était sans retour du côté réseau :
   * seule l'équipe disposait d'`UNHIDE` (module 13).
   *
   * LA DATE VIENT DE `topics.deleted_at`, et le vieillissement ci-dessous le
   * vérifie : c'est la seule valeur que le masquage écrit, donc la seule qui ne
   * puisse pas diverger de l'état.
   */
  it('remet un sujet masqué dans les sept jours, et plus après (arbitrage §2.4)', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const topic = await communities.createTopic(community.id, owner, {
      title: 'Un sujet masqué par erreur de clic',
      body: 'On va le masquer, puis le remettre.',
    });

    await communities.deleteTopic(topic.id, owner);

    // Le sujet masqué sort de la LISTE…
    const liste = await communities.topics(community.id, owner, { limit: 20 });
    expect(liste.items.some((t) => t.id === topic.id)).toBe(false);

    // … mais il reste lisible PAR UN MODÉRATEUR, et c'est ce qui rend l'erreur
    // de clic réparable : sans cela, la page du sujet répondait 404.
    const vu = await communities.topic(topic.id, owner);
    expect(vu.hidden).toBe(true);
    expect(vu.canUnhide).toBe(true);
    expect(vu.unhideUntil).not.toBeNull();

    // Un membre ordinaire ne le voit pas, et ne le remet pas.
    const passant = await newMember();
    await communities.join(community.id, passant);
    await expect(communities.topic(topic.id, passant)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(communities.restoreTopic(topic.id, passant)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    const remis = await communities.restoreTopic(topic.id, owner);
    expect(remis.hidden).toBe(false);
    const apres = await communities.topics(community.id, owner, { limit: 20 });
    expect(apres.items.some((t) => t.id === topic.id)).toBe(true);

    // Tracé comme le masquage l'est (§2.4), en `MEMBER`.
    const trace = await prisma.auditLog.findFirst({
      where: { action: 'community.topic_restored', targetId: topic.id },
      select: { actorType: true, actorId: true },
    });
    expect(trace).toMatchObject({ actorType: 'MEMBER', actorId: owner });

    // ── AU-DELÀ DE SEPT JOURS ────────────────────────────────────────────────
    //
    // On masque de nouveau, puis on VIEILLIT la date de masquage. Aucune route
    // du produit ne fait avancer l'horloge ; c'est le même procédé que les
    // tests d'archivage de ce fichier emploient pour les 60 et les 90 jours.
    await communities.deleteTopic(topic.id, owner);
    await prisma.topic.update({
      where: { id: topic.id },
      data: { deletedAt: new Date(Date.now() - 8 * 86_400_000) },
    });

    await expect(communities.restoreTopic(topic.id, owner)).rejects.toMatchObject({
      code: 'UNHIDE_WINDOW_CLOSED',
    });
    // Et l'écran le sait AVANT de tenter : `canUnhide` tombe, la phrase change.
    expect((await communities.topic(topic.id, owner)).canUnhide).toBe(false);
  });

  it('ne republie pas par-dessus l’auteur qui a retiré son propre sujet', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const auteur = await newMember();
    await communities.join(community.id, auteur);
    const topic = await communities.createTopic(community.id, auteur, {
      title: 'Un sujet que son auteur retire',
      body: 'Ce n’est pas une erreur de clic de modération.',
    });

    // §2.3 : « l'auteur peut aussi retirer le sien ». Ce retrait-là n'est pas un
    // acte de modération, et le rétablir serait republier ce qu'il a retiré.
    await communities.deleteTopic(topic.id, auteur);

    await expect(communities.restoreTopic(topic.id, owner)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
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

  /**
   * LE CORPS MINIMAL D'UNE ANNONCE, pour les cas qui ne parlent QUE de la limite.
   *
   * `createAnnouncement` prend maintenant le corps validé entier et non un
   * `body: string` : la planche dessine quatre contrôles, et le service les écrit
   * tous les quatre. Les cas de limite ci-dessous ne s'intéressent à aucun — ils
   * passent donc par ce fabricant, qui applique les DÉFAUTS DU SCHÉMA plutôt que
   * de les recopier. `parse` ici n'est pas une cérémonie : c'est ce qui garantit
   * que les tests exercent le même corps que `zodPipe` construit sur la route.
   */
  const annonce = (body: string, patch: Record<string, unknown> = {}) =>
    createAnnouncementSchema.parse({ body, ...patch });

  it('n’accepte que deux annonces par semaine, par RÉSEAU (§2.3)', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const moderator = await newMember();
    await communities.join(community.id, moderator);
    await communities.updateMember(community.id, owner, moderator, { role: 'MODERATOR' });

    await communities.createAnnouncement(community.id, owner, annonce('Première annonce.'));
    await communities.createAnnouncement(community.id, owner, annonce('Deuxième annonce.'));

    // Un AUTRE auteur, mais le même réseau : la limite protège les membres de
    // la sur-notification, pas les auteurs d'eux-mêmes.
    await expect(
      communities.createAnnouncement(community.id, moderator, annonce('Troisième annonce.')),
    ).rejects.toMatchObject({ code: 'ANNOUNCEMENT_LIMIT' });

    // Une semaine plus tôt : le compteur glisse.
    await prisma.communityAnnouncement.updateMany({
      where: { communityId: community.id },
      data: { createdAt: new Date(Date.now() - 8 * 86_400_000) },
    });
    await communities.createAnnouncement(community.id, moderator, annonce('La semaine suivante.'));

    // Un membre ordinaire n'annonce pas (§2.3 : propriétaire et modérateurs).
    const member = await newMember();
    await communities.join(community.id, member);
    await expect(
      communities.createAnnouncement(community.id, member, annonce('Moi aussi ?')),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  /**
   * LES QUATRE CONTRÔLES DE LA PLANCHE, ÉPROUVÉS JUSQU'À LA LIGNE.
   *
   * Le porteur : « L'annonce : tous les champs doivent être branchés. » Ce cas
   * fige les trois faits qu'un branchement d'écran seul ne garantirait pas :
   *
   *   1. le TITRE et l'ÉPINGLAGE s'écrivent vraiment — ils n'avaient pas de
   *      colonne avant la migration `annonce_titre_et_epinglage` ;
   *   2. « Notifier » décidé à FAUX ne pose PAS `notified_at` — sinon
   *      l'interrupteur serait décoratif ;
   *   3. l'épinglage est EXCLUSIF : la seconde annonce épinglée DÉÉPINGLE la
   *      première au lieu d'échouer. C'est la décision écrite au-dessus de
   *      `createAnnouncement`, et c'est le seul comportement que la planche
   *      permette de tenir — elle ne dessine aucun geste pour déépingler.
   *
   * La limite de deux par semaine borne ce cas à deux annonces : la troisième
   * serait refusée, et c'est le test juste au-dessus qui le dit.
   */
  it('écrit le titre, l’épinglage et la notification — et l’épinglage est exclusif', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);

    const premiere = await communities.createAnnouncement(
      community.id,
      owner,
      annonce('La première, épinglée et notifiée.', {
        title: 'Permanence consulaire',
        pinned: true,
      }),
    );
    expect(premiere.title).toBe('Permanence consulaire');
    expect(premiere.pinnedAt).not.toBeNull();
    expect(premiere.notifiedAt).not.toBeNull();

    // « Notifier » à faux, et épinglée : `notified_at` reste nul.
    const seconde = await communities.createAnnouncement(
      community.id,
      owner,
      annonce('La seconde, épinglée et muette.', { pinned: true, notify: false }),
    );
    expect(seconde.title).toBeNull();
    expect(seconde.notifiedAt).toBeNull();
    expect(seconde.pinnedAt).not.toBeNull();

    // EXCLUSIF : une seule épinglée, et c'est la dernière.
    const epinglees = await prisma.communityAnnouncement.findMany({
      where: { communityId: community.id, pinnedAt: { not: null } },
      select: { id: true },
    });
    expect(epinglees.map((a) => a.id)).toEqual([seconde.id]);

    // La route de lecture rend les trois champs — `announcementSchema` est
    // `.strict()`, donc un champ oublié dans le `select` casse le front.
    const page = await communities.announcements(community.id, owner, { limit: 20 });
    const vue = page.items.find((a) => a.id === premiere.id);
    /**
     * `body` EST DANS L'ATTENDU, et il n'y était pas : le `select` de
     * `announcements()` l'avait PERDU en gagnant les trois nouveaux champs, et ce
     * cas passait quand même parce qu'il ne regardait que ce qu'il venait
     * d'ajouter. Mesuré au `curl` sur l'API qui tourne — la charge sortait sans
     * `body`, et `announcementSchema` étant `.strict()`, le front l'aurait
     * refusée en bloc. Un attendu qui ne nomme que le champ du jour est un
     * attendu qui laisse régresser les autres.
     */
    expect(vue).toMatchObject({
      title: 'Permanence consulaire',
      body: 'La première, épinglée et notifiée.',
      pinnedAt: null,
    });
    expect(vue?.notifiedAt).not.toBeNull();
  });

  /**
   * ⚠ LE DÉSÉPINGLAGE — arbitrage du porteur, 2026-10-11.
   *
   * L'exclusivité RESTE (le cas juste au-dessus la gèle, et il reste juste) ;
   * ce qui manquait était le chemin du RETOUR. Sans lui, on ne pouvait jamais
   * revenir à « aucune annonce épinglée » : seulement remplacer l'épinglée par
   * une autre, en publiant — avec un budget de deux annonces par semaine.
   */
  it('déépingle une annonce publiée, et épingler une ancienne déépingle la courante', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);

    const premiere = await communities.createAnnouncement(
      community.id,
      owner,
      annonce('La première, épinglée.', { title: 'Première', pinned: true }),
    );
    const seconde = await communities.createAnnouncement(
      community.id,
      owner,
      annonce('La seconde, épinglée aussi.', { title: 'Seconde', pinned: true }),
    );

    const epinglees = async () =>
      (
        await prisma.communityAnnouncement.findMany({
          where: { communityId: community.id, pinnedAt: { not: null } },
          select: { id: true },
        })
      ).map((a) => a.id);

    // L'exclusivité de la création : la seconde a chassé la première.
    expect(await epinglees()).toEqual([seconde.id]);

    /**
     * 1. ÉPINGLER UNE ANCIENNE DÉÉPINGLE LA COURANTE. Sans cela, la règle
     * tiendrait à la création et nulle part ailleurs : deux annonces épinglées
     * seraient atteignables par le chemin le plus évident.
     */
    const rendue = await communities.setAnnouncementPinned(
      community.id,
      premiere.id,
      owner,
      true,
    );
    expect(rendue.pinnedAt).not.toBeNull();
    expect(await epinglees()).toEqual([premiere.id]);

    /** 2. ET ON PEUT REVENIR À AUCUNE — c'est ce qui manquait. */
    const retiree = await communities.setAnnouncementPinned(
      community.id,
      premiere.id,
      owner,
      false,
    );
    expect(retiree.pinnedAt).toBeNull();
    expect(await epinglees()).toEqual([]);

    /**
     * 3. LES DEUX SENS SONT JOURNALISÉS — §2.4, dernière phrase : « Toute action
     * de modération de réseau est journalisée », et « épingler » est dans sa
     * liste. `actor_type = MEMBER` : un modérateur bénévole n'est pas l'équipe.
     */
    const traces = await prisma.auditLog.findMany({
      where: { targetId: premiere.id, targetType: 'community_announcement' },
      select: { action: true, actorType: true, actorId: true },
    });
    expect(traces.map((t) => t.action).sort()).toEqual([
      'community.announcement_pinned',
      'community.announcement_unpinned',
    ]);
    expect(traces.every((t) => t.actorType === 'MEMBER' && t.actorId === owner)).toBe(true);

    // 4. Un membre ordinaire n'épingle pas (§2.3 : propriétaire et modérateurs).
    const membre = await newMember();
    await communities.join(community.id, membre);
    await expect(
      communities.setAnnouncementPinned(community.id, premiere.id, membre, true),
    ).rejects.toMatchObject({ details: { reason: 'MODERATOR_REQUIRED' } });

    /**
     * 5. ET L'ANNONCE D'UN AUTRE RÉSEAU EST UN 404, pas un épinglage. Sans ce
     * contrôle, l'identifiant d'une annonce suffirait à l'épingler depuis un
     * réseau qu'on modère — c'est le genre de fuite entre réseaux que ce module
     * passe son temps à refermer.
     */
    const voisin = await newMember();
    const ailleurs = await createInterest(voisin);
    /**
     * L'APPELANT EST LE PROPRIÉTAIRE DE L'AUTRE RÉSEAU, et c'est ce qui rend ce
     * cas utile. Avec `owner` — qui n'est pas membre de `ailleurs` —, le refus
     * serait venu d'`assertModerator`, c'est-à-dire d'une garde qu'on éprouve
     * déjà juste au-dessus : le cas aurait passé sans jamais toucher au `where`
     * sur `communityId`, qui est précisément ce qu'on veut garder.
     */
    await expect(
      communities.setAnnouncementPinned(ailleurs.id, premiere.id, voisin, false),
    ).rejects.toMatchObject({ status: 404 });
  });

  // ══ LA FILE DE SIGNALEMENTS D'UN RÉSEAU — §2.4 ════════════════════════════

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ « MASQUER » ET « CONSERVER », ET LA LIMITE DE POUVOIR QUI LES ENCADRE    ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * §2.4 : « Propriétaire et modérateurs peuvent : masquer une publication ou un
   * sujet du réseau […]. Ils ne peuvent pas suspendre un compte — ils signalent
   * à l'équipe. Toute action de modération de réseau est journalisée. »
   *
   * ⚠ LE LIEN ENTRE UN SIGNALEMENT ET UN RÉSEAU N'EXISTE PAS EN COLONNE :
   * `reports` n'a pas de `community_id`, et il est DÉRIVÉ (post → sujet →
   * commentaire). Ces cas éprouvent la dérivation pour les trois genres, parce
   * que c'est elle qui décide de ce qu'un modérateur voit — et un modérateur qui
   * verrait le fil global serait une fuite, pas un affichage.
   */
  it('liste les contenus signalés du réseau, groupés par contenu (§2.4)', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const auteur = await newMember();
    await communities.join(community.id, auteur);
    const signaleurA = await newMember();
    const signaleurB = await newMember();

    // Une publication DU RÉSEAU, signalée DEUX fois.
    const postId = newId();
    await prisma.post.create({
      data: {
        id: postId,
        authorUserId: auteur,
        type: 'QUESTION',
        body: 'Vends attestation d’hébergement, 50 euros.',
        communityId: community.id,
        status: 'PUBLISHED',
        moderationStatus: 'CLEARED',
      },
    });
    for (const reporter of [signaleurA, signaleurB]) {
      await prisma.report.create({
        data: {
          id: newId(),
          reporterUserId: reporter,
          subjectType: 'POST',
          subjectId: postId,
          reason: 'MONEY_REQUEST',
          status: 'NEW',
        },
      });
    }

    // Un SUJET du réseau, signalé une fois.
    const sujet = await communities.createTopic(community.id, auteur, {
      title: 'Un sujet qui dérange quelqu’un',
      body: 'Le corps du sujet.',
    });
    await prisma.report.create({
      data: {
        id: newId(),
        reporterUserId: signaleurA,
        subjectType: 'TOPIC',
        subjectId: sujet.id,
        reason: 'HARASSMENT',
        status: 'NEW',
      },
    });

    /**
     * ⚠ ET UNE PUBLICATION DU FIL GLOBAL, signalée aussi : elle ne doit JAMAIS
     * apparaître dans la file de ce réseau. C'est le témoin de la dérivation —
     * sans lui, un `community_id` mal joint rendrait la file de la plateforme
     * entière à un modérateur bénévole, et le cas passerait quand même.
     */
    const hors = newId();
    await prisma.post.create({
      data: {
        id: hors,
        authorUserId: auteur,
        type: 'QUESTION',
        body: 'Une question du fil global.',
        status: 'PUBLISHED',
        moderationStatus: 'CLEARED',
      },
    });
    await prisma.report.create({
      data: {
        id: newId(),
        reporterUserId: signaleurA,
        subjectType: 'POST',
        subjectId: hors,
        reason: 'SPAM',
        status: 'NEW',
      },
    });

    const file = await communities.reports(community.id, owner);
    const vus = file.items.map((i) => i.subjectId);
    expect(vus).toContain(postId);
    expect(vus).toContain(sujet.id);
    expect(vus).not.toContain(hors);

    // GROUPÉ PAR CONTENU : deux signalements, UNE rangée, et `count` à 2.
    const rangee = file.items.find((i) => i.subjectId === postId);
    expect(rangee).toMatchObject({
      subjectType: 'POST',
      count: 2,
      reason: 'MONEY_REQUEST',
      hidden: false,
    });
    expect(rangee?.author).toMatchObject({ id: auteur });
    expect(rangee?.extrait).toContain('Vends attestation');

    // Un SUJET porte son TITRE en extrait, pas son corps : c'est lui qui l'identifie.
    expect(file.items.find((i) => i.subjectId === sujet.id)?.extrait).toBe(
      'Un sujet qui dérange quelqu’un',
    );

    // `meta.open` est le nombre que la planche affiche cinq fois.
    expect(file.meta.open).toBe(2);

    /**
     * ⚠ AUCUN SIGNALEUR N'EST RÉVÉLÉ — 13 §… : ni à l'auteur, ni à un modérateur
     * bénévole. Le contrôle porte sur la charge ENTIÈRE, sérialisée : un champ
     * ajouté par mégarde dans un prochain lot le ferait échouer.
     */
    const charge = JSON.stringify(file);
    expect(charge).not.toContain(signaleurA);
    expect(charge).not.toContain(signaleurB);
    expect(charge).not.toContain('details');

    // Un membre ordinaire ne lit pas la file.
    const curieux = await newMember();
    await communities.join(community.id, curieux);
    await expect(communities.reports(community.id, curieux)).rejects.toMatchObject({
      details: { reason: 'MODERATOR_REQUIRED' },
    });
  });

  it('masque un contenu signalé, conserve l’autre, et journalise les deux (§2.4)', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const auteur = await newMember();
    await communities.join(community.id, auteur);
    const signaleur = await newMember();

    const postId = newId();
    await prisma.post.create({
      data: {
        id: postId,
        authorUserId: auteur,
        type: 'QUESTION',
        body: 'Un contenu que l’on va masquer.',
        communityId: community.id,
        status: 'PUBLISHED',
        moderationStatus: 'CLEARED',
      },
    });
    await prisma.report.create({
      data: {
        id: newId(),
        reporterUserId: signaleur,
        subjectType: 'POST',
        subjectId: postId,
        reason: 'SCAM',
        status: 'NEW',
      },
    });

    const sujet = await communities.createTopic(community.id, auteur, {
      title: 'Un sujet que l’on va conserver',
      body: 'Rien de fautif ici.',
    });
    await prisma.report.create({
      data: {
        id: newId(),
        reporterUserId: signaleur,
        subjectType: 'TOPIC',
        subjectId: sujet.id,
        reason: 'OTHER',
        status: 'NEW',
      },
    });

    // ── « MASQUER » ────────────────────────────────────────────────────────
    const masque = await communities.decideReport(community.id, owner, {
      subjectType: 'POST',
      subjectId: postId,
      decision: 'HIDE',
    });
    expect(masque).toMatchObject({ closed: 1, hidden: true });

    /**
     * MASQUÉ, PAS SUPPRIMÉ — 13 §2 : « le pipeline masque, il ne supprime
     * jamais ». Et ce sont les MÊMES valeurs que `FeedService.handleContentHidden`
     * écrit quand l'équipe décide : deux façons de masquer la même chose
     * divergeraient.
     */
    const apres = await prisma.post.findUniqueOrThrow({
      where: { id: postId },
      select: { status: true, moderationStatus: true, deletedAt: true },
    });
    expect(apres).toMatchObject({ status: 'HIDDEN', moderationStatus: 'FLAGGED' });
    expect(apres.deletedAt).toBeNull();

    // ── « CONSERVER » ─────────────────────────────────────────────────────
    const garde = await communities.decideReport(community.id, owner, {
      subjectType: 'TOPIC',
      subjectId: sujet.id,
      decision: 'KEEP',
    });
    expect(garde).toMatchObject({ closed: 1, hidden: false });

    // Le sujet est INTACT : « Conserver » ne touche pas au contenu.
    const intact = await prisma.topic.findUniqueOrThrow({
      where: { id: sujet.id },
      select: { deletedAt: true, status: true },
    });
    expect(intact.deletedAt).toBeNull();
    expect(intact.status).toBe('OPEN');

    // Les deux mots sont distincts, et §3 du module 13 compte les `DISMISSED`.
    const etats = await prisma.report.findMany({
      where: { subjectId: { in: [postId, sujet.id] } },
      select: { subjectId: true, status: true },
    });
    expect(etats.find((r) => r.subjectId === postId)?.status).toBe('RESOLVED');
    expect(etats.find((r) => r.subjectId === sujet.id)?.status).toBe('DISMISSED');

    // La file est vide : les deux contenus sont tranchés.
    expect((await communities.reports(community.id, owner)).meta.open).toBe(0);

    /**
     * LA JOURNALISATION DES DEUX DÉCISIONS — §2.4, dernière phrase. « Conserver »
     * aussi : classer des signalements sans suite est un acte de modération, et
     * c'est celui qu'on voudra pouvoir relire le jour où le contenu conservé
     * posera problème.
     */
    const traces = await prisma.auditLog.findMany({
      where: { actorId: owner, targetType: 'report' },
      select: { action: true, actorType: true, metadata: true },
    });
    const actions = traces.map((t) => t.action);
    expect(actions).toContain('community.report_hidden');
    expect(actions).toContain('community.report_kept');
    expect(traces.every((t) => t.actorType === 'MEMBER')).toBe(true);
    expect(traces.map((t) => t.metadata)).toContainEqual(
      expect.objectContaining({ communityId: community.id, subjectType: 'POST' }),
    );

    // Rejouer une décision déjà prise ne la rejoue pas.
    await expect(
      communities.decideReport(community.id, owner, {
        subjectType: 'POST',
        subjectId: postId,
        decision: 'KEEP',
      }),
    ).rejects.toMatchObject({ code: 'REPORT_ALREADY_DECIDED' });
  });

  it('ne laisse pas masquer un contenu qui n’est pas dans le réseau (§2.4)', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const auteur = await newMember();
    const signaleur = await newMember();

    /**
     * ⚠ C'EST LA GARDE LA PLUS IMPORTANTE DE LA ROUTE. Sans elle, un modérateur
     * d'un réseau quelconque masquerait la publication du FIL GLOBAL — ou celle
     * d'un autre réseau — en envoyant son identifiant. C'est la même fuite que
     * `load()` referme sur la lecture, et elle doit l'être sur l'écriture.
     */
    const hors = newId();
    await prisma.post.create({
      data: {
        id: hors,
        authorUserId: auteur,
        type: 'QUESTION',
        body: 'Une publication du fil global, qui ne regarde aucun réseau.',
        status: 'PUBLISHED',
        moderationStatus: 'CLEARED',
      },
    });
    await prisma.report.create({
      data: {
        id: newId(),
        reporterUserId: signaleur,
        subjectType: 'POST',
        subjectId: hors,
        reason: 'SPAM',
        status: 'NEW',
      },
    });

    await expect(
      communities.decideReport(community.id, owner, {
        subjectType: 'POST',
        subjectId: hors,
        decision: 'HIDE',
      }),
    ).rejects.toMatchObject({ code: 'REPORT_NOT_IN_COMMUNITY' });

    // Et la publication est intacte.
    const intacte = await prisma.post.findUniqueOrThrow({
      where: { id: hors },
      select: { status: true },
    });
    expect(intacte.status).toBe('PUBLISHED');
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
      resultsAfterVote: true,
      isAnonymous: true,
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
      resultsAfterVote: true,
      isAnonymous: true,
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
      resultsAfterVote: true,
      isAnonymous: true,
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

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ CRÉER UN ALBUM EST RÉSERVÉ AU PROPRIÉTAIRE ET AUX MODÉRATEURS            ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * ⚠ CE CAS N'EXISTAIT PAS, et c'est pour cela que le défaut a vécu :
   * `createAlbum` appelait `assertMember`, donc n'importe quel membre actif
   * pouvait créer autant d'albums qu'il voulait dans un réseau dont il n'est que
   * membre. §2.3 ne tranchait pas — il ne nomme que « tout membre ajoute (L1) »
   * pour une PHOTO et « propriétaire et modérateurs suppriment ».
   *
   * ARBITRAGE DU PORTEUR, 2026-10-11 : « les administrateurs ont seul le bouton
   * ajouté […] et ajouter un album ». L'écran ne montre ce geste qu'aux
   * modérateurs, mais LE FRONT PRÉVIENT, IL N'AUTORISE PAS (00 §5) : sans cette
   * garde, la route restait ouverte à tout membre qui l'appelle directement.
   *
   * LES TROIS RÔLES SONT ÉPROUVÉS, et c'est le seul moyen de distinguer une
   * garde juste d'une garde trop serrée : le propriétaire passe, un modérateur
   * NOMMÉ passe, un membre simple est refusé.
   */
  it('réserve la création d’un album au propriétaire et aux modérateurs', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const moderator = await newMember();
    const simple = await newMember();
    await communities.join(community.id, moderator);
    await communities.join(community.id, simple);
    await communities.updateMember(community.id, owner, moderator, { role: 'MODERATOR' });

    // Le propriétaire crée.
    const parLeProprietaire = await communities.createAlbum(community.id, owner, {
      title: 'Permanence 2026',
    });
    expect(parLeProprietaire.title).toBe('Permanence 2026');

    // Un modérateur nommé crée aussi — « les administrateurs », au pluriel.
    const parLeModerateur = await communities.createAlbum(community.id, moderator, {
      title: 'Repas de juillet',
    });
    expect(parLeModerateur.title).toBe('Repas de juillet');

    // Un membre simple est refusé, et le motif le dit.
    await expect(
      communities.createAlbum(community.id, simple, { title: 'Mon album à moi' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', details: { reason: 'MODERATOR_REQUIRED' } });

    /**
     * ⚠ ET AJOUTER UNE PHOTO RESTE OUVERT À TOUT MEMBRE : §2.3 l'écrit en toutes
     * lettres (« tout membre ajoute (L1) ») et le contrôleur déclare
     * `post.create`. Le dessin ne donne le bouton qu'aux modérateurs ; la RÈGLE
     * reste celle de la spécification, et ce cas est là pour que personne ne
     * resserre la seconde en croyant suivre la première.
     */
    const asset = await prisma.mediaAsset.create({
      data: {
        id: newId(),
        ownerUserId: simple,
        kind: 'ALBUM',
        storageKey: `test/${newId()}.jpg`,
        mime: 'image/jpeg',
        sizeBytes: BigInt(1024),
        status: 'READY',
      },
    });
    try {
      const photo = await communities.addPhoto(parLeProprietaire.id, simple, {
        mediaAssetId: asset.id,
      });
      expect(photo.albumId).toBe(parLeProprietaire.id);
    } finally {
      await prisma.mediaAsset.delete({ where: { id: asset.id } });
    }
  });

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LES TROIS ONGLETS DE L'ÉCRAN SE DÉRIVENT DE CETTE RÉPONSE, SANS COLONNE  ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur veut trois onglets par défaut — « tous », « Partagés »,
   * « Événements ». MESURÉ : le modèle `Album` porte `communityId`, `eventId?`,
   * `title`, `createdByUserId`, et AUCUN champ de genre. Ce cas est la preuve
   * que la dérivation tient sur ce que la route rend DÉJÀ, et il est là pour
   * qu'on ne la casse pas sans le voir :
   *
   *   · `eventId` distingue l'album d'événement de l'album libre — c'est tout
   *     l'onglet « Événements » ;
   *   · `photoCount` et `photos[].url` nourrissent la carte « ALBUMS » de la
   *     colonne de droite (compte et couverture) — rien à ajouter non plus.
   *
   * (« Partagés » ne passe pas par ici : ce sont les médias des publications,
   * que l'écran lit sur `GET /feed?communityId=`.)
   */
  it('distingue l’album d’événement de l’album libre, et rend compte et couverture', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const event = await prisma.event.create({
      data: {
        id: newId(),
        communityId: community.id,
        organizerUserId: owner,
        type: 'PICNIC',
        title: 'Permanence du samedi',
        cityId: (await prisma.city.findFirstOrThrow({ select: { id: true } })).id,
        addressText: 'Quelque part',
        startsAt: new Date(Date.now() + 86_400_000),
        endsAt: new Date(Date.now() + 90_000_000),
        status: 'SCHEDULED',
      },
    });

    const libre = await communities.createAlbum(community.id, owner, { title: 'Album libre' });
    const evenementiel = await communities.createAlbum(community.id, owner, {
      title: 'Album de la permanence',
      eventId: event.id,
    });

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
      await communities.addPhoto(libre.id, owner, { mediaAssetId: asset.id });
      const page = await communities.albums(community.id, owner);

      const vuLibre = page.items.find((a) => a.id === libre.id);
      const vuEvenement = page.items.find((a) => a.id === evenementiel.id);

      // L'onglet « Événements » tient sur ce seul champ.
      expect(vuLibre?.eventId).toBeNull();
      expect(vuEvenement?.eventId).toBe(event.id);

      // Le compte et la couverture de la carte « ALBUMS », tels quels.
      expect(vuLibre?.photoCount).toBe(1);
      expect(vuLibre?.photos[0]?.url).toBe(`/media/${asset.storageKey}`);
      expect(vuEvenement?.photoCount).toBe(0);
    } finally {
      await prisma.mediaAsset.delete({ where: { id: asset.id } });
      await prisma.event.delete({ where: { id: event.id } });
    }
  });

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

  /**
   * La photo de couverture d'un album (§2.6, `PATCH /albums/:id`). L'équipe la
   * choisit parmi les photos de CET album ; un membre ordinaire ne le peut pas ;
   * une photo d'un autre album est introuvable ; `null` revient à la plus récente.
   * Retirer la photo de couverture remet la couverture à nul : le retrait est un
   * `deletedAt`, la clé étrangère ne le ferait pas d'elle-même.
   */
  it('laisse l’équipe choisir la couverture d’un album, et l’oublie quand la photo part', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const member = await newMember();
    await communities.join(community.id, member);

    const album = await communities.createAlbum(community.id, owner, { title: 'Pique-nique' });
    const autre = await communities.createAlbum(community.id, owner, { title: 'Autre' });
    const assets = await Promise.all(
      [0, 1, 2].map(() =>
        prisma.mediaAsset.create({
          data: {
            id: newId(),
            ownerUserId: owner,
            kind: 'ALBUM',
            storageKey: `test/${newId()}.jpg`,
            mime: 'image/jpeg',
            sizeBytes: BigInt(1024),
            status: 'READY',
          },
        }),
      ),
    );
    try {
      const [a0, a1, a2] = assets as [(typeof assets)[0], (typeof assets)[0], (typeof assets)[0]];
      const premiere = await communities.addPhoto(album.id, owner, { mediaAssetId: a0.id });
      await communities.addPhoto(album.id, owner, { mediaAssetId: a1.id });
      const ailleurs = await communities.addPhoto(autre.id, owner, { mediaAssetId: a2.id });

      const lire = async () =>
        (await communities.albums(community.id, owner)).items.find((a) => a.id === album.id);

      expect((await lire())?.coverPhotoId).toBeNull();

      await expect(
        communities.setAlbumCover(album.id, member, premiere.id),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(
        communities.setAlbumCover(album.id, owner, ailleurs.id),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });

      await communities.setAlbumCover(album.id, owner, premiere.id);
      expect((await lire())?.coverPhotoId).toBe(premiere.id);

      await communities.setAlbumCover(album.id, owner, null);
      expect((await lire())?.coverPhotoId).toBeNull();

      await communities.setAlbumCover(album.id, owner, premiere.id);
      await communities.deletePhoto(album.id, premiere.id, owner);
      expect((await lire())?.coverPhotoId).toBeNull();
    } finally {
      await prisma.albumPhoto.deleteMany({ where: { albumId: { in: [album.id, autre.id] } } });
      await prisma.mediaAsset.deleteMany({ where: { id: { in: assets.map((a) => a.id) } } });
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

  // ══ La couverture : un média du PROPRIÉTAIRE, prêt, et rendu en `coverUrl` ══
  //
  // `create` et `update` recopiaient `coverAssetId` sans rien vérifier : le
  // média d'un autre membre, ou un justificatif (`PROOF`, « jamais affiché »),
  // pouvait devenir le bandeau d'un réseau. C'est le contrôle des couvertures
  // d'événement (`assertOwnedCover`), appliqué ici.

  it('n’accepte pour couverture qu’un média EVENT_COVER du propriétaire, et rend son adresse', async () => {
    const owner = await newMember();
    const autre = await newMember();
    const media = async (proprio: string, kind: 'EVENT_COVER' | 'PROOF', status: 'READY' | 'PENDING' = 'READY') =>
      (
        await prisma.mediaAsset.create({
          data: {
            id: newId(),
            ownerUserId: proprio,
            kind,
            storageKey: `test/reseau-couverture/${newId()}.jpg`,
            mime: 'image/jpeg',
            sizeBytes: BigInt(4096),
            status,
            exifStripped: true,
          },
        })
      ).id;
    const mienne = await media(owner, 'EVENT_COVER');
    const etrangere = await media(autre, 'EVENT_COVER');
    const justificatif = await media(owner, 'PROOF');
    const enCours = await media(owner, 'EVENT_COVER', 'PENDING');
    const community = await createInterest(owner);
    try {
      // Étrangère ou d'un autre genre : 404, indistinguable d'un média absent.
      await expect(communities.update(community.id, owner, { coverAssetId: etrangere })).rejects.toMatchObject({
        status: 404,
      });
      await expect(communities.update(community.id, owner, { coverAssetId: justificatif })).rejects.toMatchObject({
        status: 404,
      });
      // Encore en analyse : une erreur de validation, le membre sait qu'il existe.
      await expect(communities.update(community.id, owner, { coverAssetId: enCours })).rejects.toMatchObject({
        status: 400,
      });

      const apres = await communities.update(community.id, owner, { coverAssetId: mienne });
      expect(apres.coverAssetId).toBe(mienne);
      expect(apres.coverUrl).toMatch(/^\/media\/test\/reseau-couverture\//);

      // Retirer la couverture reste possible : `null` ne passe pas par le contrôle.
      const sans = await communities.update(community.id, owner, { coverAssetId: null });
      expect(sans.coverUrl).toBeNull();

      // Le LOGO suit exactement la même règle.
      await expect(communities.update(community.id, owner, { logoAssetId: etrangere })).rejects.toMatchObject({
        status: 404,
      });
      const logo = await communities.update(community.id, owner, { logoAssetId: mienne });
      expect(logo.logoAssetId).toBe(mienne);
      expect(logo.logoUrl).toMatch(/^\/media\/test\/reseau-couverture\//);
    } finally {
      await prisma.community.update({
        where: { id: community.id },
        data: { coverAssetId: null, logoAssetId: null },
      });
      await prisma.mediaAsset.deleteMany({ where: { id: { in: [mienne, etrangere, justificatif, enCours] } } });
    }
  });

  // ══ « Contacter les modérateurs » — le fil de groupe (08 §5.1) ═════════════
  //
  // CE N'EST PAS UN SIGNALEMENT, et les cas ci-dessous le figent : la route
  // n'ouvre AUCUN dossier de modération, et aucune de ses réponses ne ressemble
  // à celle de `POST /reports`. Elle ouvre un fil, un seul par demandeur.

  it('ouvre un fil de groupe avec le propriétaire ET les modérateurs actifs', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const moderateur = await newMember();
    await communities.join(community.id, moderateur);
    await communities.updateMember(community.id, owner, moderateur, { role: 'MODERATOR' });

    const demandeur = await newMember();
    await communities.join(community.id, demandeur);

    const ouvert = await communities.openModeratorsConversation(community.id, demandeur);
    expect(ouvert.created).toBe(true);
    // Deux destinataires : le propriétaire et le modérateur. Le demandeur n'est
    // pas compté — il n'est pas son propre destinataire.
    expect(ouvert.recipients).toBe(2);

    const fil = await prisma.conversation.findUniqueOrThrow({
      where: { id: ouvert.conversationId },
      select: {
        kind: true,
        communityId: true,
        openedByUserId: true,
        lastMessageAt: true,
        members: { select: { userId: true, leftAt: true } },
        messages: { select: { id: true } },
      },
    });
    expect(fil.kind).toBe('COMMUNITY_MODERATION');
    expect(fil.communityId).toBe(community.id);
    expect(fil.openedByUserId).toBe(demandeur);
    // Le fil naît VIDE — la maquette ne dessine aucun formulaire — et il n'a donc
    // aucune dernière activité : la poser le ferait remonter en tête de la liste
    // au-dessus de conversations vivantes.
    expect(fil.messages).toHaveLength(0);
    expect(fil.lastMessageAt).toBeNull();
    expect(new Set(fil.members.filter((m) => m.leftAt === null).map((m) => m.userId))).toEqual(
      new Set([demandeur, owner, moderateur]),
    );
  });

  it('nomme le fil par le réseau, suivi pour l’équipe du nom du membre qui écrit', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const demandeur = await newMember();
    await communities.join(community.id, demandeur);
    await prisma.user.update({ where: { id: demandeur }, data: { displayName: 'Aïcha Diop' } });

    const { conversationId } = await communities.openModeratorsConversation(community.id, demandeur);
    const titreDe = async (lecteur: string) =>
      (await messaging.listConversations(lecteur, { limit: 50 })).items.find((c) => c.id === conversationId)
        ?.title;

    // Le porteur : « OUI ajoute » — un modérateur contacté par plusieurs membres
    // voyait autant de lignes au même nom. Le membre, lui, n'a qu'un fil par
    // réseau : son propre nom n'y apprendrait rien.
    expect(await titreDe(owner)).toBe(`${community.name} · Aïcha Diop`);
    expect(await titreDe(demandeur)).toBe(community.name);
  });

  it('est idempotente : un second appel rouvre LE MÊME fil', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const demandeur = await newMember();
    await communities.join(community.id, demandeur);

    const premier = await communities.openModeratorsConversation(community.id, demandeur);
    const second = await communities.openModeratorsConversation(community.id, demandeur);

    expect(second.conversationId).toBe(premier.conversationId);
    expect(premier.created).toBe(true);
    expect(second.created).toBe(false);

    // Et il n'y a qu'UNE ligne en base : c'est ce que l'index unique
    // (community_id, opened_by_user_id) garantit, et le compter ici est la seule
    // façon de voir qu'un double clic n'a pas dédoublé le fil.
    expect(
      await prisma.conversation.count({
        where: { kind: 'COMMUNITY_MODERATION', communityId: community.id },
      }),
    ).toBe(1);
  });

  it('donne à un modérateur SON fil, et non celui d’un autre demandeur', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const moderateur = await newMember();
    await communities.join(community.id, moderateur);
    await communities.updateMember(community.id, owner, moderateur, { role: 'MODERATOR' });

    const autre = await newMember();
    await communities.join(community.id, autre);
    const filDeLAutre = await communities.openModeratorsConversation(community.id, autre);

    /**
     * LE PIÈGE QUE `opened_by_user_id` ÉVITE. Le modérateur est membre du fil de
     * `autre` : chercher « la conversation de ce réseau dont je suis membre » lui
     * aurait rendu CELLE-LÀ, et son second clic l'aurait fait écrire dans le fil
     * de quelqu'un d'autre.
     */
    const sien = await communities.openModeratorsConversation(community.id, moderateur);
    expect(sien.conversationId).not.toBe(filDeLAutre.conversationId);
    expect(sien.created).toBe(true);
    // Le propriétaire seul le lira : un modérateur n'est pas son propre destinataire.
    expect(sien.recipients).toBe(1);
  });

  it('refuse quand le demandeur est à lui seul toute l’équipe (ONLY_ME)', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);

    // Le propriétaire d'un réseau sans modérateur. Le cas est réel : la planche
    // « À propos » de la vue propriétaire n'existe pas sur mobile, donc un
    // propriétaire sur téléphone voit la planche MEMBRE, bouton compris.
    await expect(
      communities.openModeratorsConversation(community.id, owner),
    ).rejects.toMatchObject({ code: 'NO_MODERATORS_TO_CONTACT' });
    expect(
      await prisma.conversation.count({
        where: { kind: 'COMMUNITY_MODERATION', communityId: community.id },
      }),
    ).toBe(0);
  });

  it('refuse sur un réseau automatique sans aucun bénévole (NO_TEAM)', async () => {
    const membre = await newMember();
    await communities.syncAutoMemberships(membre);
    const city = await prisma.community.findFirstOrThrow({
      where: { kind: 'CITY', cityId },
      select: { id: true },
    });

    // §2.1 : « pas de créateur ; modérateurs = bénévoles nommés par l'équipe ».
    // Tant qu'aucun n'est nommé, il n'y a PERSONNE à joindre — et c'est
    // `POST /reports`, qui va à l'équipe de la plateforme, qui est le bon chemin.
    await expect(communities.openModeratorsConversation(city.id, membre)).rejects.toMatchObject({
      code: 'NO_MODERATORS_TO_CONTACT',
    });
  });

  it('refuse à qui n’est pas membre du réseau (NOT_A_MEMBER)', async () => {
    const owner = await newMember();
    const community = await createInterest(owner);
    const passant = await newMember();

    // §2.3 réserve le contenu d'un réseau à ses membres, et un fil avec l'équipe
    // EST du contenu de réseau. Un passant qui a un problème avec le réseau a
    // déjà `POST /reports`, qui ne demande aucune adhésion.
    await expect(
      communities.openModeratorsConversation(community.id, passant),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
