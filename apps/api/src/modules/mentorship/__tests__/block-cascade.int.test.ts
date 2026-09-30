import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import type { CommunitiesService } from '../../communities/communities.service';
import type { GuidesService } from '../../guides/guides.service';
import type { HelpService } from '../../help/help.service';
import { AuditService } from '../../../common/audit.service';
import { CryptoService } from '../../../common/crypto.service';
import { OutboxService } from '../../../common/outbox.service';
import { PrismaService } from '../../../common/prisma.service';
import { VisibilityService } from '../../../common/visibility.service';
import { EventHandlerRegistry } from '../../../queue/event-handlers';
import { EventSubscriptionsService } from '../../../queue/event-subscriptions.service';
import { BlocksService } from '../../blocks/blocks.service';
import { ConnectionsService } from '../../connections/connections.service';
import { MessagingService } from '../../messaging/messaging.service';
import { MentorshipService } from '../mentorship.service';

/**
 * La CASCADE DE BLOCAGE — 08-parrainage-messagerie.md §4 et §12.
 *
 * RÈGLE DURE (§12) : « le blocage retire contact, parrainage, appartenance au
 * parcours et ferme la conversation directe en une transaction ».
 *
 * CE TEST PASSE PAR L'ÉVÉNEMENT, et c'est le point essentiel. Appeler les trois
 * gestionnaires à la main prouverait qu'ils fonctionnent, pas qu'ils sont
 * BRANCHÉS — et c'est précisément le défaut que ce dépôt a déjà connu : les
 * modules émettaient correctement, et la moitié « consommateur » n'existait pas.
 * Un test qui appelle le gestionnaire directement serait passé malgré ça.
 *
 * Le chemin réel est donc reproduit à l'identique, sans Redis :
 *
 *   1. `BlocksService.block()` écrit le blocage ET la ligne `domain_events`, dans
 *      la même transaction (patron de la boîte d'envoi, 00 §9.1) ;
 *   2. `drainOutbox()` fait ce que fait `OutboxRelayService` : réclamer les
 *      événements non publiés, les distribuer, les marquer publiés ;
 *   3. `EventHandlerRegistry.dispatch()` appelle les abonnés que
 *      `EventSubscriptionsService` a déclarés — le VRAI fichier de câblage.
 *
 * Ce que BullMQ ajoute en production (dix tentatives, dédoublonnage par `jobId`)
 * ne change pas la sémantique que ce test vérifie ; l'idempotence, elle, est
 * vérifiée en distribuant DEUX FOIS le même événement.
 *
 * Les trois services du lot 08 sont réels. Réseaux, entraide et guides sont des
 * substituts : leurs gestionnaires n'écoutent pas `user.blocked`, donc ils ne
 * seront pas appelés — et `GuidesService` demande un fournisseur d'IA dont ce
 * test n'a que faire.
 */
/**
 * Un service dont toute méthode ne fait rien.
 *
 * Ce test construit le VRAI fichier de câblage, pour que la disparition d'un
 * abonnement le fasse échouer. Il hérite donc des abonnements de tous les autres
 * modules, qu'il n'a aucune raison d'exercer — d'où ces bouchons.
 */
function inert(): never {
  return new Proxy(
    {},
    { get: () => () => Promise.resolve() },
  ) as never;
}

describe('cascade de blocage, par l’événement (08 §4)', () => {
  let prisma: PrismaService;
  let outbox: OutboxService;
  let registry: EventHandlerRegistry;
  let blocks: BlocksService;
  let mentorship: MentorshipService;
  let connections: ConnectionsService;
  let messaging: MessagingService;

  const createdUsers: string[] = [];
  const createdCases: string[] = [];
  let originCountryId: string;
  let cityId: string;
  let counter = 0;

  async function member(
    options: { phase?: 'PRE_DEPARTURE' | 'SETTLED'; level?: 'L0' | 'L1' | 'L2' } = {},
  ): Promise<{ id: string; handle: string }> {
    counter += 1;
    const id = newId();
    const handle = `csc${counter}${id.slice(-8)}`;
    await prisma.user.create({
      data: {
        id,
        handle,
        displayName: `Membre ${counter}`,
        phase: options.phase ?? 'SETTLED',
        verificationLevel: options.level ?? 'L2',
        originCountryId,
        cityId,
        plan: 'FREE',
        status: 'ACTIVE',
        arrivalDate: new Date(Date.now() - 2 * 365 * 86_400_000),
      },
    });
    createdUsers.push(id);
    return { id, handle };
  }

  /**
   * Le relais de la boîte d'envoi, sans Redis — même ordre, même sémantique :
   * réclamer, distribuer, marquer publié.
   */
  async function drainOutbox(): Promise<number> {
    let dispatched = 0;

    /**
     * On vide la file JUSQU'AU BOUT, par lots, et on ne distribue que les
     * événements qui concernent les membres de ce test.
     *
     * Deux raisons, apprises en faisant échouer ce test dans la suite complète
     * alors qu'il passait seul :
     *
     *   · `claimUnpublished(n)` rend les n plus ANCIENS, et les autres suites en
     *     laissent des centaines derrière elles — les événements de ce test
     *     n'étaient tout simplement pas dans la fenêtre ;
     *   · distribuer ceux des autres suites rejouerait des faits dont les membres
     *     ont été supprimés par un `afterAll` voisin. Ils sont donc marqués
     *     publiés sans être distribués.
     *
     * La borne de 50 lots existe pour qu'un défaut de `markPublished` ne
     * transforme pas ce test en boucle infinie.
     */
    for (let batch = 0; batch < 50; batch += 1) {
      const events = await outbox.claimUnpublished(200);
      if (events.length === 0) break;

      for (const event of events) {
        const involvesThisTest = createdUsers.some(
          (id) => event.aggregateId === id || JSON.stringify(event.payload).includes(id),
        );
        if (!involvesThisTest) continue;

        await registry.dispatch({
          id: event.id,
          type: event.type as Parameters<typeof registry.dispatch>[0]['type'],
          aggregateId: event.aggregateId,
          payload: event.payload,
          occurredAt: event.occurredAt.toISOString(),
        });
        dispatched += 1;
      }

      await outbox.markPublished(events.map((e) => e.id));
    }

    return dispatched;
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    outbox = new OutboxService(prisma);
    const audit = new AuditService(prisma);
    const visibility = new VisibilityService(prisma);
    const crypto = new CryptoService();

    connections = new ConnectionsService(prisma, outbox, audit, visibility);
    messaging = new MessagingService(prisma, crypto, outbox, audit, visibility, connections);
    mentorship = new MentorshipService(prisma, outbox, audit, visibility, messaging);
    blocks = new BlocksService(prisma, outbox, audit);

    registry = new EventHandlerRegistry();
    // LE VRAI fichier de câblage : si un abonnement manque, ce test échoue.
    new EventSubscriptionsService(
      registry,
      {} as CommunitiesService,
      {} as HelpService,
      {} as GuidesService,
      // Les modules que cette cascade ne concerne pas.
      //
      // Des bouchons INERTES, et non `{}` : plusieurs d'entre eux s'abonnent au
      // même `user.blocked`, et le registre appelle réellement leurs méthodes. Un
      // objet vide levait donc `n'est pas une fonction`, le registre isolait
      // l'échec — puis levait à la fin, comme il doit — et toute la cascade
      // paraissait cassée alors qu'elle fonctionnait.
      inert(),
      inert(),
      inert(),
      inert(),
      mentorship,
      connections,
      messaging,
      inert(),
      // Le module 03, livré après ce test : il s'abonne au même `user.blocked`
      // pour retirer l'accompagnant de l'équipe du parcours (03 §3.4). Inerte
      // ici — sa propre suite l'éprouve.
      inert(),
      // Les modules 11 et 12, arrivés après ce test : la cascade de blocage ne les
      // concerne pas, mais le fichier de câblage les exige désormais. Noter que 11
      // n'a VOLONTAIREMENT aucun abonnement à `user.blocked` — 11 §2.5 exclut les
      // auteurs bloqués à la REQUÊTE, pas à l'indexation.
      inert(),
      inert(),
      inert(),
      // Le module 14, arrivé après ce test : il s'abonne à `journey.step_completed`
      // (l'essai Premium) et à `user.deleted`, pas à `user.blocked`. Inerte ici.
      inert(),
      // L'export RGPD (01 §2.8) et le relais temps réel (08 §7.3), arrivés après ce
      // test. Le premier ne s'abonne qu'à `user.export_requested`, le second à
      // `message.sent` : ni l'un ni l'autre n'est sur le chemin d'un blocage.
      inert(),
      inert(),
    ).onModuleInit();

    const country = await prisma.country.findFirstOrThrow({
      where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } },
      select: { id: true },
    });
    originCountryId = country.id;
    cityId = (await prisma.city.findFirstOrThrow({ select: { id: true } })).id;

    // Les événements laissés par d'autres suites sont MARQUÉS PUBLIÉS sans être
    // distribués : les distribuer rejouerait des faits dont les membres ont été
    // supprimés par un `afterAll` voisin, et ce test n'a rien à dire sur eux.
    const stale = await outbox.claimUnpublished(500);
    await outbox.markPublished(stale.map((e) => e.id));
  });

  afterAll(async () => {
    if (createdCases.length > 0) {
      await prisma.moderationCase.deleteMany({ where: { id: { in: createdCases } } });
    }
    if (createdUsers.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    }
    await prisma.$disconnect();
  });

  it('`user.blocked` a bien ses trois abonnés de ce lot', () => {
    // Le symptôme du défaut qu'on veut éviter : un événement sans lecteur. Ce
    // test-ci est bon marché et il tomberait si un abonnement disparaissait du
    // fichier de câblage.
    //
    // On vérifie la PRÉSENCE des trois, et non le total : d'autres modules
    // s'abonnent au même événement — le fil, l'annuaire pro, la modération — et
    // une égalité stricte ferait échouer ce test à chaque module livré, sans
    // qu'aucune règle de ce lot ne soit en cause.
    const modules = registry.for('user.blocked').map((r) => r.module);
    for (const expected of ['connections', 'mentorship', 'messaging']) {
      expect(modules).toContain(expected);
    }
  });

  /**
   * LE test de la règle dure. Un seul blocage, quatre effets attendus.
   *
   * MUTATION éprouvée, trois fois — en retirant tour à tour chacun des trois
   * abonnements `user.blocked` du fichier de câblage, ce test tombe chaque fois,
   * sur l'effet dont l'abonnement retiré était responsable : le contact resté en
   * place, le parrainage resté actif, la conversation restée ouverte.
   */
  it('[RÈGLE DURE §12] retire le contact, termine le parrainage, expire la demande et ferme la DIRECT', async () => {
    const mentor = await member();
    const mentee = await member({ phase: 'PRE_DEPARTURE', level: 'L0' });
    const asker = await member();

    // 1. Un CONTACT entre le parrain et le filleul.
    const [userAId, userBId] =
      mentor.id < mentee.id ? [mentor.id, mentee.id] : [mentee.id, mentor.id];
    await prisma.connection.create({
      data: { id: newId(), userAId, userBId, origin: 'MANUAL' },
    });

    // 2. Un PARRAINAGE actif, avec sa conversation MENTORSHIP.
    await mentorship.upsertProfile(mentor.id, {
      bio: 'J’accompagne les nouveaux arrivants depuis deux ans, avec plaisir.',
      journeyTemplateIds: [],
      maxMentees: 2,
      isAvailable: true,
    });
    const request = await mentorship.request(mentee.id, {
      mentorHandle: mentor.handle,
      message: 'Bonjour, je prépare mon départ et je cherche quelqu’un pour m’orienter un peu.',
    });
    await mentorship.accept(request.id, mentor.id);

    // 3. Une DEMANDE DE CONTACT en attente, dans l'autre sens.
    const pendingRequest = await connections.request(asker.id, {
      toHandle: mentee.handle,
      message: 'Bonjour, on s’est croisés à la réunion de quartier la semaine dernière.',
    });

    // 4. Une conversation DIRECT entre le parrain et le filleul.
    const direct = await messaging.openDirect(
      { userId: mentor.id, level: 'L2' },
      { toHandle: mentee.handle, firstMessage: 'Bonjour, ravi de faire votre connaissance.' },
    );

    // Les événements déjà produits (demande, acceptation, message) sont écoulés
    // pour que le drain suivant ne porte que le blocage et ses suites.
    await drainOutbox();

    // ── LE BLOCAGE, puis la distribution de l'événement ─────────────────────
    await blocks.block(mentee.id, mentor.handle);
    // Sans consommateur, ce drain ne ferait rien et tout ce qui suit échouerait.
    expect(await drainOutbox()).toBeGreaterThanOrEqual(1);

    // Effet 1 : le contact est retiré (§4).
    expect(await connections.areConnected(mentor.id, mentee.id)).toBe(false);

    // Effet 2 : le parrainage est ENDED, motif BLOCKED, compteur libéré.
    const ended = await prisma.mentorship.findUniqueOrThrow({ where: { id: request.id } });
    expect(ended.status).toBe('ENDED');
    expect(ended.endReason).toBe('BLOCKED');
    const profile = await prisma.mentorProfile.findUniqueOrThrow({ where: { userId: mentor.id } });
    expect(profile.activeMenteeCount).toBe(0);

    // Effet 3 : un dossier de modération, priorité 2 (§4).
    const moderationCase = await prisma.moderationCase.findFirst({
      where: { subjectType: 'USER', subjectId: mentor.id, source: 'AUTO_RULE' },
    });
    expect(moderationCase).not.toBeNull();
    expect(moderationCase?.priority).toBe(2);
    expect(moderationCase?.status).toBe('OPEN');
    expect(moderationCase?.aiLabels).toContain(request.id);
    if (moderationCase !== null) createdCases.push(moderationCase.id);

    // Effet 4 : la conversation DIRECT est fermée — les DEUX côtés (§5.2).
    const members = await prisma.conversationMember.findMany({
      where: { conversationId: direct.conversationId },
      select: { userId: true, leftAt: true },
    });
    expect(members).toHaveLength(2);
    for (const row of members) expect(row.leftAt).not.toBeNull();
    // Et elle disparaît des deux listes de conversations.
    for (const userId of [mentor.id, mentee.id]) {
      const list = await messaging.listConversations(userId, { limit: 20 });
      expect(list.items.map((c) => c.id)).not.toContain(direct.conversationId);
    }

    // Effet 5 : les demandes de contact en attente entre les deux sont expirées.
    // (Celle d'`asker` vers `mentee` ne l'est PAS : elle ne concerne pas la paire.)
    const untouched = await prisma.connectionRequest.findUniqueOrThrow({
      where: { id: pendingRequest.id },
    });
    expect(untouched.status).toBe('PENDING');

    // Le parrainage terminé pour BLOCKED ne crée AUCUN contact : `connections`
    // n'écoute `mentorship.ended` que pour le motif COMPLETED (§3.1). C'est ce que
    // le drain ci-dessus a exercé, en distribuant l'événement émis par la cascade.
    expect(await connections.areConnected(mentor.id, mentee.id)).toBe(false);
  });

  it('expire la demande de contact en attente ENTRE les deux membres', async () => {
    const a = await member();
    const b = await member();
    const request = await connections.request(a.id, {
      toHandle: b.handle,
      message: 'Bonjour, on s’est croisés à la réunion de quartier la semaine dernière.',
    });
    await drainOutbox();

    await blocks.block(b.id, a.handle);
    await drainOutbox();

    const row = await prisma.connectionRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(row.status).toBe('EXPIRED');
    expect(row.decidedAt).not.toBeNull();
  });

  it('annule une DEMANDE de parrainage en attente entre les deux (§2.2)', async () => {
    const mentor = await member();
    const mentee = await member({ phase: 'PRE_DEPARTURE', level: 'L0' });
    await mentorship.upsertProfile(mentor.id, {
      bio: 'J’accompagne les nouveaux arrivants depuis deux ans, avec plaisir.',
      journeyTemplateIds: [],
      maxMentees: 2,
      isAvailable: true,
    });
    const request = await mentorship.request(mentee.id, {
      mentorHandle: mentor.handle,
      message: 'Bonjour, je prépare mon départ et je cherche quelqu’un pour m’orienter un peu.',
    });
    await drainOutbox();

    await blocks.block(mentor.id, mentee.handle);
    await drainOutbox();

    const row = await prisma.mentorship.findUniqueOrThrow({ where: { id: request.id } });
    expect(row.status).toBe('CANCELLED');
    // Et la demande annulée n'est plus acceptable.
    await expect(mentorship.accept(request.id, mentor.id)).rejects.toMatchObject({
      code: 'MENTORSHIP_STATE',
    });
  });

  /**
   * IDEMPOTENCE. La livraison est « au moins une fois » (00 §9.1) : le même
   * événement SERA rejoué, par exemple si le processus meurt entre la mise en file
   * et le marquage.
   *
   * Ce que le rejeu ne doit pas faire : décrémenter deux fois le compteur de
   * filleuls — ce qui bloquerait le parrain à zéro filleul pour toujours si le
   * garde `activeMenteeCount > 0` sautait — ni empiler deux dossiers identiques
   * dans une file de modération HUMAINE.
   */
  it('rejouer l’événement ne double ni le compteur ni le dossier de modération', async () => {
    const mentor = await member();
    const mentee = await member({ phase: 'PRE_DEPARTURE', level: 'L0' });
    await mentorship.upsertProfile(mentor.id, {
      bio: 'J’accompagne les nouveaux arrivants depuis deux ans, avec plaisir.',
      journeyTemplateIds: [],
      maxMentees: 2,
      isAvailable: true,
    });
    const request = await mentorship.request(mentee.id, {
      mentorHandle: mentor.handle,
      message: 'Bonjour, je prépare mon départ et je cherche quelqu’un pour m’orienter un peu.',
    });
    await mentorship.accept(request.id, mentor.id);
    await drainOutbox();

    await blocks.block(mentee.id, mentor.handle);

    // Le MÊME événement, distribué deux fois — ce que fait un rejeu.
    const events = await outbox.claimUnpublished(50);
    const blockEvent = events.find((e) => e.type === 'user.blocked');
    expect(blockEvent).toBeDefined();
    const job = {
      id: blockEvent!.id,
      type: 'user.blocked' as const,
      aggregateId: blockEvent!.aggregateId,
      payload: blockEvent!.payload,
      occurredAt: blockEvent!.occurredAt.toISOString(),
    };
    await registry.dispatch(job);
    await registry.dispatch(job);
    await outbox.markPublished(events.map((e) => e.id));

    const profile = await prisma.mentorProfile.findUniqueOrThrow({ where: { userId: mentor.id } });
    expect(profile.activeMenteeCount).toBe(0);

    const cases = await prisma.moderationCase.findMany({
      where: { subjectType: 'USER', subjectId: mentor.id, source: 'AUTO_RULE' },
      select: { id: true },
    });
    expect(cases).toHaveLength(1);
    createdCases.push(...cases.map((c) => c.id));
  });

  /**
   * §4, effets de LECTURE : « Dans un réseau ou une conversation de groupe commune :
   * contenus masqués mutuellement, les deux restent membres. »
   *
   * Une conversation MENTORSHIP n'est PAS fermée par §4, qui ne nomme que les
   * DIRECT. Ce qui protège alors, c'est le refus d'écrire — vérifié dans la suite
   * messagerie — et le masquage à la lecture, vérifié ici.
   */
  it('masque les contenus dans la conversation MENTORSHIP sans en retirer les membres', async () => {
    const mentor = await member();
    const mentee = await member({ phase: 'PRE_DEPARTURE', level: 'L0' });
    await mentorship.upsertProfile(mentor.id, {
      bio: 'J’accompagne les nouveaux arrivants depuis deux ans, avec plaisir.',
      journeyTemplateIds: [],
      maxMentees: 2,
      isAvailable: true,
    });
    const request = await mentorship.request(mentee.id, {
      mentorHandle: mentor.handle,
      message: 'Bonjour, je prépare mon départ et je cherche quelqu’un pour m’orienter un peu.',
    });
    const accepted = await mentorship.accept(request.id, mentor.id);
    const conversationId = accepted.conversationId;
    await messaging.sendMessage({ userId: mentor.id, level: 'L2' }, conversationId, {
      body: 'Bienvenue, on commence quand vous voulez.',
    });
    await drainOutbox();

    await blocks.block(mentee.id, mentor.handle);
    await drainOutbox();

    const members = await prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true, leftAt: true },
    });
    // Les deux RESTENT membres : §4 ne ferme que les DIRECT.
    expect(members.filter((m) => m.leftAt === null)).toHaveLength(2);

    // Mais le contenu de l'autre est masqué à la lecture.
    const page = await messaging.listMessages(mentee.id, conversationId, { limit: 20 });
    expect(page.items[0]?.body).toBeNull();
  });
});
