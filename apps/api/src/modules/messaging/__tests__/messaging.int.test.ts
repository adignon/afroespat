import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { MESSAGE_DELETED_PLACEHOLDER, MESSAGE_DELETED_USER_PLACEHOLDER } from '@app/shared';
import { AuditService } from '../../../common/audit.service';
import { CryptoService } from '../../../common/crypto.service';
import { OutboxService } from '../../../common/outbox.service';
import { PrismaService } from '../../../common/prisma.service';
import { VisibilityService } from '../../../common/visibility.service';
import { BlocksService } from '../../blocks/blocks.service';
import { ConnectionsService } from '../../connections/connections.service';
import { MessagingService } from '../messaging.service';

/**
 * Messagerie — 08-parrainage-messagerie.md §5, §7.3 et §12.
 *
 * Deux règles dures du §12 vivent ici :
 *
 *   · « un L0 peut demander un parrain mais ne peut pas ouvrir de conversation
 *     directe » — la moitié « parrain » est testée dans le module parrainage, la
 *     moitié « conversation » ici ;
 *   · « un premier message non accepté n'autorise pas de second message ».
 *
 * Le CHIFFREMENT est vérifié à sa frontière : la colonne `body_encrypted` ne doit
 * jamais contenir le texte en clair, et la lecture doit rendre exactement ce qui a
 * été écrit. C'est ce qui prouve que le chiffrement est bien AU REPOS et non de
 * bout en bout — la modération doit pouvoir lire (00 §8.1).
 */
describe('messagerie (08 §5)', () => {
  let prisma: PrismaService;
  let messaging: MessagingService;
  let connections: ConnectionsService;
  let blocks: BlocksService;
  let crypto: CryptoService;

  const createdUsers: string[] = [];
  const createdHelp: string[] = [];
  const createdMediaIds: string[] = [];
  let originCountryId: string;
  let cityId: string;
  let counter = 0;

  /**
   * Un membre « froid » par défaut : SETTLED (donc pas « nouvel arrivant »), sans
   * demande d'entraide et sans contact. C'est la seule configuration où la règle
   * « n'importe qui UNE FOIS » de §5.2 s'applique — les quatre autres lignes du
   * tableau lèvent la restriction.
   */
  async function member(
    options: {
      level?: 'L0' | 'L1' | 'L2';
      phase?: 'PRE_DEPARTURE' | 'RECENT_ARRIVAL' | 'SETTLED';
    } = {},
  ): Promise<{ id: string; handle: string; level: 'L0' | 'L1' | 'L2' }> {
    counter += 1;
    const id = newId();
    const handle = `msg${counter}${id.slice(-8)}`;
    const level = options.level ?? 'L1';
    await prisma.user.create({
      data: {
        id,
        handle,
        displayName: `Membre ${counter}`,
        phase: options.phase ?? 'SETTLED',
        verificationLevel: level,
        originCountryId,
        cityId,
        plan: 'FREE',
        status: 'ACTIVE',
      },
    });
    createdUsers.push(id);
    return { id, handle, level };
  }

  async function connect(a: string, b: string): Promise<void> {
    const [userAId, userBId] = a < b ? [a, b] : [b, a];
    await prisma.connection.create({
      data: { id: newId(), userAId, userBId, origin: 'MANUAL' },
    });
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const outbox = new OutboxService(prisma);
    const audit = new AuditService(prisma);
    const visibility = new VisibilityService(prisma);
    crypto = new CryptoService();
    connections = new ConnectionsService(prisma, outbox, audit, visibility);
    messaging = new MessagingService(prisma, crypto, outbox, audit, visibility, connections);
    blocks = new BlocksService(prisma, outbox, audit);

    const country = await prisma.country.findFirstOrThrow({
      where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } },
      select: { id: true },
    });
    originCountryId = country.id;
    cityId = (await prisma.city.findFirstOrThrow({ select: { id: true } })).id;
  });

  afterAll(async () => {
    if (createdHelp.length > 0) {
      await prisma.helpRequest.deleteMany({ where: { id: { in: createdHelp } } });
    }
    // AVANT les membres : `media_assets.owner_user_id` les référence, et la base
    // est PARTAGÉE — un reste de ce fichier ferait échouer une autre suite sur
    // une contrainte de clé étrangère qui n'a rien à voir avec elle.
    if (createdMediaIds.length > 0) {
      await prisma.mediaAsset.deleteMany({ where: { id: { in: createdMediaIds } } });
    }
    if (createdUsers.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    }
    await prisma.$disconnect();
  });

  // ── §5.2 Qui peut écrire à qui ────────────────────────────────────────────

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ CE CAS DISAIT L'INVERSE — ÉCART ASSUMÉ AVEC §5.2                        ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Il gelait « un L0 ne peut pas ouvrir de conversation directe », qui est le
   * tableau §5.2 et que §12 range parmi les règles dures. Le porteur a rencontré
   * ce refus en lisant une story et a demandé de l'ouvrir ; la décision, et ce
   * qu'elle coûte, sont écrites sur `message.send` dans `capabilities.ts`.
   *
   * Il gèle maintenant L'AUTRE MOITIÉ, celle qui n'a pas bougé et qui est
   * désormais la SEULE à retenir un compte non vérifié : le premier message à un
   * inconnu ouvre une conversation EN ATTENTE. Sans ce mécanisme, ouvrir le
   * niveau reviendrait à ouvrir le démarchage de masse — et rien ne le dirait.
   *
   * MUTATION éprouvée : en rendant `pendingState` toujours faux, ce cas tombe.
   */
  it('un L0 ouvre une conversation directe, et elle part EN ATTENTE (§5.2)', async () => {
    const l0 = await member({ level: 'L0', phase: 'PRE_DEPARTURE' });
    const target = await member();

    const ouverte = await messaging.openDirect(
      { userId: l0.id, level: 'L0' },
      { toHandle: target.handle, firstMessage: 'Bonjour, puis-je vous poser une question ?' },
    );
    expect(ouverte.conversationId).toBeTruthy();
    expect(ouverte.messageId).toBeTruthy();
    // EN ATTENTE : l'autre accepte ou ignore, et sans réponse il n'y a pas de
    // second message. C'est ce qui borne ce qu'un compte non vérifié peut faire.
    expect(ouverte.pending, 'la demande doit partir en attente d’acceptation').toBe(true);
  });

  /**
   * L'autre moitié de la même règle : le L0 ÉCRIT dans une conversation MENTORSHIP
   * dont il fait partie. C'est tout l'intérêt d'avoir ouvert `mentorship.request`
   * en L0 — un pré-départ doit pouvoir parler à son parrain.
   *
   * C'est aussi pourquoi la route d'envoi ne peut pas déclarer `message.send` (L1) :
   * le refus dépend du KIND de la conversation, que seul le service connaît.
   */
  it('un L0 écrit dans sa conversation MENTORSHIP (§5.2)', async () => {
    const mentor = await member({ level: 'L2' });
    const mentee = await member({ level: 'L0', phase: 'PRE_DEPARTURE' });

    const mentorshipId = newId();
    await prisma.mentorship.create({
      data: {
        id: mentorshipId,
        mentorUserId: mentor.id,
        menteeUserId: mentee.id,
        status: 'ACTIVE',
        requestMessage: 'Bonjour, je cherche un parrain pour préparer mon arrivée cet automne.',
        acceptedAt: new Date(),
      },
    });
    const conversationId = await prisma.$transaction((tx) =>
      messaging.ensureMentorshipConversation(tx, mentorshipId, [mentor.id, mentee.id]),
    );

    await expect(
      messaging.sendMessage({ userId: mentee.id, level: 'L0' }, conversationId, {
        body: 'Merci d’avoir accepté !',
      }),
    ).resolves.toMatchObject({ conversationId });
  });

  /**
   * RÈGLE DURE (§12) : « un premier message non accepté n'autorise pas de second
   * message. »
   *
   * La colonne `conversations.pending_from_user_id` de §6 n'existe pas : l'état est
   * déduit (relation froide + aucun message de l'autre + `last_read_at` nul).
   * Ce test vérifie le COMPORTEMENT, qui est ce que la règle dure exige — pas la
   * présence d'une colonne.
   *
   * MUTATION éprouvée : en retirant le bloc `if (pending.pending && … ) this.fail(
   * 'PENDING_CONVERSATION')` de `sendMessage`, ce test tombe seul.
   */
  it('[RÈGLE DURE §12] un premier message non accepté n’autorise pas de second message', async () => {
    const sender = await member();
    const target = await member();

    const opened = await messaging.openDirect(
      { userId: sender.id, level: 'L1' },
      { toHandle: target.handle, firstMessage: 'Bonjour, je me permets de vous écrire.' },
    );
    expect(opened.pending).toBe(true);

    await expect(
      messaging.sendMessage({ userId: sender.id, level: 'L1' }, opened.conversationId, {
        body: 'Vous avez vu mon message ?',
      }),
    ).rejects.toMatchObject({ code: 'PENDING_CONVERSATION' });

    // Et la route d'ouverture, qui retombe sur la même conversation, refuse aussi :
    // §7.3 nomme bien `PENDING_CONVERSATION` sur `POST /conversations/direct`.
    await expect(
      messaging.openDirect(
        { userId: sender.id, level: 'L1' },
        { toHandle: target.handle, firstMessage: 'Toujours là ?' },
      ),
    ).rejects.toMatchObject({ code: 'PENDING_CONVERSATION' });
  });

  it('une réponse du destinataire lève la restriction (§5.2)', async () => {
    const sender = await member();
    const target = await member();
    const opened = await messaging.openDirect(
      { userId: sender.id, level: 'L1' },
      { toHandle: target.handle, firstMessage: 'Bonjour, une question rapide si possible.' },
    );

    await messaging.sendMessage({ userId: target.id, level: 'L1' }, opened.conversationId, {
      body: 'Oui, bien sûr.',
    });

    await expect(
      messaging.sendMessage({ userId: sender.id, level: 'L1' }, opened.conversationId, {
        body: 'Merci beaucoup.',
      }),
    ).resolves.toMatchObject({ conversationId: opened.conversationId });
  });

  it('l’acceptation explicite lève la restriction, sans réponse écrite', async () => {
    const sender = await member();
    const target = await member();
    const opened = await messaging.openDirect(
      { userId: sender.id, level: 'L1' },
      { toHandle: target.handle, firstMessage: 'Bonjour, auriez-vous un instant ?' },
    );

    // La demande apparaît comme telle au destinataire.
    const inbox = await messaging.listConversations(target.id, { limit: 20 });
    expect(inbox.items.find((c) => c.id === opened.conversationId)?.pendingForMe).toBe(true);

    await messaging.acceptDirect(target.id, opened.conversationId);

    await expect(
      messaging.sendMessage({ userId: sender.id, level: 'L1' }, opened.conversationId, {
        body: 'Merci d’avoir accepté.',
      }),
    ).resolves.toBeTruthy();
  });

  it('lire une demande en attente ne l’accepte PAS à la place du destinataire', async () => {
    const sender = await member();
    const target = await member();
    const opened = await messaging.openDirect(
      { userId: sender.id, level: 'L1' },
      { toHandle: target.handle, firstMessage: 'Bonjour, je cherche un conseil.' },
    );

    await messaging.listMessages(target.id, opened.conversationId, { limit: 20 });

    // `last_read_at` matérialise l'acceptation : le marquer à la lecture
    // accepterait la demande au nom du destinataire.
    const row = await prisma.conversationMember.findUniqueOrThrow({
      where: { conversationId_userId: { conversationId: opened.conversationId, userId: target.id } },
    });
    expect(row.lastReadAt).toBeNull();
    await expect(
      messaging.sendMessage({ userId: sender.id, level: 'L1' }, opened.conversationId, {
        body: 'Deuxième tentative.',
      }),
    ).rejects.toMatchObject({ code: 'PENDING_CONVERSATION' });
  });

  it('un CONTACT écrit sans restriction, dès le premier message (§3.2)', async () => {
    const a = await member();
    const b = await member();
    await connect(a.id, b.id);

    const opened = await messaging.openDirect(
      { userId: a.id, level: 'L1' },
      { toHandle: b.handle, firstMessage: 'Salut, tu es dispo demain ?' },
    );
    expect(opened.pending).toBe(false);

    // DEUX messages d'affilée, sans réponse : c'est justement ce que « sans
    // restriction » veut dire.
    await expect(
      messaging.sendMessage({ userId: a.id, level: 'L1' }, opened.conversationId, {
        body: 'Ou après-demain ?',
      }),
    ).resolves.toBeTruthy();
  });

  it('l’auteur d’une demande d’entraide est joignable (« réponse privée », §5.2)', async () => {
    const asker = await member();
    const helper = await member();

    const helpId = newId();
    await prisma.helpRequest.create({
      data: {
        id: helpId,
        authorUserId: asker.id,
        kind: 'REQUEST',
        type: 'PAPERWORK',
        title: 'Aide pour un dossier de préfecture',
        body: 'Je cherche quelqu’un qui connaît la procédure de renouvellement.',
        cityId,
        status: 'OPEN',
        moderationStatus: 'CLEARED',
      },
    });
    createdHelp.push(helpId);

    expect(await messaging.permissionFor(helper.id, asker.id)).toBe('HELP_REPLY');
    const opened = await messaging.openDirect(
      { userId: helper.id, level: 'L1' },
      { toHandle: asker.handle, firstMessage: 'Bonjour, j’ai fait cette démarche l’an dernier.' },
    );
    expect(opened.pending).toBe(false);
  });

  it('un nouvel arrivant est joignable via « Saluer » (§5.2)', async () => {
    const newcomer = await member({ phase: 'RECENT_ARRIVAL' });
    const greeter = await member();
    expect(await messaging.permissionFor(greeter.id, newcomer.id)).toBe('GREET');
  });

  // ── §5.3 Messages ─────────────────────────────────────────────────────────

  /**
   * Le chiffrement AU REPOS (00 §8.1), vérifié à sa frontière : la colonne
   * `body_encrypted` est un `bytea` qui ne contient JAMAIS le texte, et la lecture
   * rend exactement ce qui a été écrit.
   *
   * Pas de bout en bout, et c'est volontaire : « la modération doit pouvoir traiter
   * un signalement ». Le test le PROUVE en déchiffrant depuis un service tiers —
   * si le chiffrement était de bout en bout, cette ligne serait impossible.
   */
  it('chiffre le corps au repos, et le rend intact à la lecture', async () => {
    const a = await member();
    const b = await member();
    await connect(a.id, b.id);
    const body = 'Rendez-vous à 14 h devant la mairie, apporte ton récépissé.';

    const opened = await messaging.openDirect(
      { userId: a.id, level: 'L1' },
      { toHandle: b.handle, firstMessage: body },
    );

    const stored = await prisma.message.findUniqueOrThrow({
      where: { id: opened.messageId },
      select: { bodyEncrypted: true },
    });
    // Le texte n'apparaît NULLE PART en clair dans la colonne.
    expect(Buffer.from(stored.bodyEncrypted).toString('utf8')).not.toContain('mairie');
    // Et la modération peut lire : le chiffrement est au repos, pas de bout en bout.
    expect(crypto.decryptContent(stored.bodyEncrypted)).toBe(body);

    const page = await messaging.listMessages(b.id, opened.conversationId, { limit: 20 });
    expect(page.items[0]?.body).toBe(body);
  });

  it('la suppression logique laisse la ligne et remplace le corps à l’affichage', async () => {
    const a = await member();
    const b = await member();
    await connect(a.id, b.id);
    const opened = await messaging.openDirect(
      { userId: a.id, level: 'L1' },
      { toHandle: b.handle, firstMessage: 'Message que je vais regretter.' },
    );

    await messaging.deleteMessage(a.id, opened.messageId);
    const page = await messaging.listMessages(b.id, opened.conversationId, { limit: 20 });
    expect(page.items[0]?.body).toBe(MESSAGE_DELETED_PLACEHOLDER);

    // Le corps chiffré est CONSERVÉ : §5.2 veut que la modération puisse lire une
    // conversation signalée, et l'auteur d'un message abusif ne doit pas pouvoir
    // effacer la preuve.
    const stored = await prisma.message.findUniqueOrThrow({ where: { id: opened.messageId } });
    expect(crypto.decryptContent(stored.bodyEncrypted)).toContain('regretter');
  });

  it('seul l’émetteur supprime son message (404 pour l’autre)', async () => {
    const a = await member();
    const b = await member();
    await connect(a.id, b.id);
    const opened = await messaging.openDirect(
      { userId: a.id, level: 'L1' },
      { toHandle: b.handle, firstMessage: 'Bonjour, comment ça va depuis la semaine dernière ?' },
    );
    await expect(messaging.deleteMessage(b.id, opened.messageId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('compte les non-lus et marque lu à la lecture', async () => {
    const a = await member();
    const b = await member();
    await connect(a.id, b.id);
    const opened = await messaging.openDirect(
      { userId: a.id, level: 'L1' },
      { toHandle: b.handle, firstMessage: 'Premier message de la journée.' },
    );
    await messaging.sendMessage({ userId: a.id, level: 'L1' }, opened.conversationId, {
      body: 'Deuxième message.',
    });

    const before = await messaging.listConversations(b.id, { limit: 20 });
    expect(before.items.find((c) => c.id === opened.conversationId)?.unreadCount).toBe(2);

    await messaging.listMessages(b.id, opened.conversationId, { limit: 20 });
    const after = await messaging.listConversations(b.id, { limit: 20 });
    expect(after.items.find((c) => c.id === opened.conversationId)?.unreadCount).toBe(0);
  });

  it('une conversation DIRECT est unique par paire (§5.1)', async () => {
    const a = await member();
    const b = await member();
    await connect(a.id, b.id);

    const first = await messaging.openDirect(
      { userId: a.id, level: 'L1' },
      { toHandle: b.handle, firstMessage: 'Première prise de contact.' },
    );
    const second = await messaging.openDirect(
      { userId: b.id, level: 'L1' },
      { toHandle: a.handle, firstMessage: 'Réponse depuis l’autre côté.' },
    );
    expect(second.conversationId).toBe(first.conversationId);
    expect(
      await prisma.conversation.count({
        where: {
          kind: 'DIRECT',
          AND: [{ members: { some: { userId: a.id } } }, { members: { some: { userId: b.id } } }],
        },
      }),
    ).toBe(1);
  });

  it('émet `message.sent` SANS le corps du message', async () => {
    const a = await member();
    const b = await member();
    await connect(a.id, b.id);
    const secret = 'Mon numéro de dossier est confidentiel.';
    const opened = await messaging.openDirect(
      { userId: a.id, level: 'L1' },
      { toHandle: b.handle, firstMessage: secret },
    );

    const event = await prisma.domainEvent.findFirstOrThrow({
      where: { type: 'message.sent', aggregateId: opened.messageId },
    });
    // `domain_events` est conservé EN CLAIR : un corps de message y annulerait le
    // chiffrement au repos du §8.1.
    expect(JSON.stringify(event.payload)).not.toContain('confidentiel');
    expect(JSON.stringify(event.payload)).toContain(b.id);
  });

  it('refuse d’écrire dans une conversation dont on n’est pas membre (404)', async () => {
    const a = await member();
    const b = await member();
    const stranger = await member();
    await connect(a.id, b.id);
    const opened = await messaging.openDirect(
      { userId: a.id, level: 'L1' },
      { toHandle: b.handle, firstMessage: 'Conversation privée entre nous deux.' },
    );

    await expect(
      messaging.sendMessage({ userId: stranger.id, level: 'L1' }, opened.conversationId, {
        body: 'Je m’invite.',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      messaging.listMessages(stranger.id, opened.conversationId, { limit: 20 }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('refuse BLOCKED_RELATIONSHIP à l’ouverture vers un membre bloqué', async () => {
    const a = await member();
    const b = await member();
    await blocks.block(b.id, a.handle);

    await expect(
      messaging.openDirect(
        { userId: a.id, level: 'L1' },
        { toHandle: b.handle, firstMessage: 'Bonjour, je voulais vous écrire.' },
      ),
    ).rejects.toMatchObject({ code: 'BLOCKED_RELATIONSHIP' });
  });

  /**
   * §4 laisse la conversation MENTORSHIP ouverte — il ne ferme que les DIRECT.
   * Ce contrôle est ce qui empêche d'écrire quand même : sans lui, deux membres
   * séparés continueraient de se parler dans la conversation de parrainage.
   */
  it('refuse d’écrire à un membre séparé, même hors conversation DIRECT', async () => {
    const mentor = await member({ level: 'L2' });
    const mentee = await member({ level: 'L0', phase: 'PRE_DEPARTURE' });
    const mentorshipId = newId();
    await prisma.mentorship.create({
      data: {
        id: mentorshipId,
        mentorUserId: mentor.id,
        menteeUserId: mentee.id,
        status: 'ACTIVE',
        requestMessage: 'Bonjour, je cherche un parrain pour préparer mon arrivée cet automne.',
        acceptedAt: new Date(),
      },
    });
    const conversationId = await prisma.$transaction((tx) =>
      messaging.ensureMentorshipConversation(tx, mentorshipId, [mentor.id, mentee.id]),
    );

    await blocks.block(mentee.id, mentor.handle);
    await expect(
      messaging.sendMessage({ userId: mentor.id, level: 'L2' }, conversationId, {
        body: 'Tu es là ?',
      }),
    ).rejects.toMatchObject({ code: 'BLOCKED_RELATIONSHIP' });
  });

  // ── §5.1 Conversation de parcours ─────────────────────────────────────────

  it('la conversation MENTORSHIP est idempotente : deux appels, une conversation', async () => {
    const mentor = await member({ level: 'L2' });
    const mentee = await member({ level: 'L0', phase: 'PRE_DEPARTURE' });
    const mentorshipId = newId();
    await prisma.mentorship.create({
      data: {
        id: mentorshipId,
        mentorUserId: mentor.id,
        menteeUserId: mentee.id,
        status: 'ACTIVE',
        requestMessage: 'Bonjour, je cherche un parrain pour préparer mon arrivée cet automne.',
        acceptedAt: new Date(),
      },
    });

    const first = await prisma.$transaction((tx) =>
      messaging.ensureMentorshipConversation(tx, mentorshipId, [mentor.id, mentee.id]),
    );
    const second = await prisma.$transaction((tx) =>
      messaging.ensureMentorshipConversation(tx, mentorshipId, [mentor.id, mentee.id]),
    );
    expect(second).toBe(first);
    expect(await prisma.conversation.count({ where: { mentorshipId } })).toBe(1);
  });

  // ── §11 Suppression de compte ─────────────────────────────────────────────

  it('la suppression efface le corps et laisse la ligne dans le fil de l’autre (§11)', async () => {
    const leaving = await member();
    const other = await member();
    await connect(leaving.id, other.id);
    const opened = await messaging.openDirect(
      { userId: leaving.id, level: 'L1' },
      { toHandle: other.handle, firstMessage: 'Mon dernier message avant de partir.' },
    );

    await messaging.handleUserDeleted(leaving.id);
    // Le compte est marqué supprimé par le module 01 ; ici on simule cet état pour
    // vérifier le libellé du fil.
    await prisma.user.update({
      where: { id: leaving.id },
      data: { deletedAt: new Date(), status: 'DELETED' },
    });

    const stored = await prisma.message.findUniqueOrThrow({ where: { id: opened.messageId } });
    // Le corps est RÉELLEMENT effacé, pas seulement masqué : c'est une suppression
    // au sens du RGPD.
    expect(crypto.decryptContent(stored.bodyEncrypted)).toBe('');

    const page = await messaging.listMessages(other.id, opened.conversationId, { limit: 20 });
    expect(page.items[0]?.body).toBe(MESSAGE_DELETED_USER_PLACEHOLDER);
  });

  // ── §6 La pièce jointe d'un message ───────────────────────────────────────

  /**
   * [RÈGLE DURE] Une pièce jointe est de genre MESSAGE, **et en `READY`**.
   *
   * `assertOwnedMedia` vérifiait le propriétaire et le genre, mais pas le STATUT —
   * il ne le SÉLECTIONNAIT même pas. Deux conséquences, et la seconde est la
   * raison pour laquelle ce n'est pas cosmétique :
   *
   *   1. un média `REJECTED` (refusé par l'antivirus) était rattachable ;
   *   2. sa clé de stockage est RÉSERVÉE SANS OCTETS DESSOUS — l'envoi écrit la
   *      ligne `REJECTED` et ne dépose rien. Le destinataire recevait donc un
   *      message portant une image que rien ne peut servir, et le défaut
   *      n'apparaît qu'à la lecture, chez quelqu'un d'autre que l'expéditeur.
   *
   * PRÉMISSE VÉRIFIÉE D'ABORD : le même membre, avec un média `MESSAGE`/`READY`,
   * envoie. Sans cela le test passerait aussi si `sendMessage` refusait tout.
   */
  it('[RÈGLE DURE] refuse une pièce jointe non READY, ou d’un autre genre (§6, 00 §8.3)', async () => {
    const a = await member();
    const b = await member();
    await connect(a.id, b.id);
    const opened = await messaging.openDirect(
      { userId: a.id, level: 'L1' },
      { toHandle: b.handle, firstMessage: 'Je vous envoie la photo du document.' },
    );

    const asset = async (
      kind: 'MESSAGE' | 'PROOF',
      status: 'READY' | 'PENDING' | 'SCANNING' | 'REJECTED',
    ) => {
      const row = await prisma.mediaAsset.create({
        data: {
          id: newId(),
          ownerUserId: a.id,
          kind,
          storageKey: `test/msg-piece/${newId()}.jpg`,
          mime: 'image/jpeg',
          sizeBytes: BigInt(2048),
          status,
          exifStripped: true,
        },
      });
      createdMediaIds.push(row.id);
      return row.id;
    };

    const send = (mediaId: string) =>
      messaging.sendMessage({ userId: a.id, level: 'L1' }, opened.conversationId, {
        body: 'La voici.',
        mediaId,
      });

    // ── PRÉMISSE : MESSAGE + READY passe ────────────────────────────────────
    const good = await asset('MESSAGE', 'READY');
    const sent = await send(good);
    expect(sent.messageId).toBeTruthy();

    // ── LA RÈGLE, moitié STATUT : 400, et non 404 ──────────────────────────
    //
    // L'expéditeur vient d'envoyer ce fichier et SAIT qu'il existe ; un 404
    // l'enverrait chercher un identifiant perdu alors que son envoi est
    // seulement en analyse, ou refusé par l'antivirus.
    for (const status of ['PENDING', 'SCANNING', 'REJECTED'] as const) {
      await expect(send(await asset('MESSAGE', status))).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        details: { fields: [{ path: 'mediaId', code: 'MEDIA_NOT_READY' }] },
      });
    }

    // ── LA RÈGLE, moitié GENRE : 404, parce que le genre ne doit pas être un
    //    oracle d'existence — même prêt, un PROOF n'est pas une pièce jointe.
    await expect(send(await asset('PROOF', 'READY'))).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    // Et la pièce jointe d'un AUTRE membre reste un 404 : le propriétaire était
    // déjà vérifié, et ce lot ne doit pas l'avoir perdu en chemin.
    const hers = await prisma.mediaAsset.create({
      data: {
        id: newId(),
        ownerUserId: b.id,
        kind: 'MESSAGE',
        storageKey: `test/msg-piece/${newId()}.jpg`,
        mime: 'image/jpeg',
        sizeBytes: BigInt(2048),
        status: 'READY',
        exifStripped: true,
      },
    });
    createdMediaIds.push(hers.id);
    await expect(send(hers.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  // ── La story capturée, jointe au PREMIER message ───────────────────────────

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ UNE IMAGE SUR LE PREMIER MESSAGE — ET POURQUOI PAS SUR UN SECOND         ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « quand on envoie un message dans le contexte d'une story, il
   * faudrait que la story soit capturée comme une image et ajoutée au message
   * juste un peu sous le message ».
   *
   * LE RÉFLEXE — un second message portant l'image — EST REFUSÉ PAR §5.2 : la
   * conversation naît EN ATTENTE quand la relation est froide, et c'est exactement
   * le cas quand on écrit à l'auteur d'une story qu'on ne connaît pas. Ce cas
   * MESURE les deux moitiés : l'image passe sur le premier message, et un second
   * message est bien refusé — donc le chemin choisi n'est pas une préférence, c'est
   * le seul qui marche.
   *
   * ── MUTATIONS APPLIQUÉES ──────────────────────────────────────────────────
   *
   *   · `mediaAssetId: input.mediaId ?? null` retiré de la branche qui CRÉE la
   *     conversation → le message part sans image, le cas tombe ;
   *   · `assertOwnedMedia` retiré de cette même branche → la moitié « média d'un
   *     autre » tombe, et la conversation est créée pour rien ;
   *   · `urlDuMedia` rendant toujours `null` → la moitié `mediaUrl` tombe.
   */
  it('joint l’image au PREMIER message, et en rend l’adresse à la lecture', async () => {
    const a = await member();
    const b = await member();

    const asset = await prisma.mediaAsset.create({
      data: {
        id: newId(),
        ownerUserId: a.id,
        kind: 'MESSAGE',
        storageKey: `test/story-capture/${newId()}.png`,
        mime: 'image/png',
        sizeBytes: BigInt(4096),
        status: 'READY',
        exifStripped: true,
      },
    });
    createdMediaIds.push(asset.id);

    const opened = await messaging.openDirect(
      { userId: a.id, level: 'L1' },
      {
        toHandle: b.handle,
        firstMessage: 'Votre story sur le dossier Visale m’aide beaucoup.',
        mediaId: asset.id,
      },
    );

    /**
     * LA CONVERSATION EST BIEN EN ATTENTE — c'est la prémisse, et sans elle le
     * reste ne dirait rien : si la relation était chaude, un second message
     * passerait et le choix du premier message serait arbitraire.
     */
    expect(opened.pending).toBe(true);
    await expect(
      messaging.sendMessage({ userId: a.id, level: 'L1' }, opened.conversationId, {
        body: 'Et voici la capture.',
        mediaId: asset.id,
      }),
    ).rejects.toMatchObject({ code: 'PENDING_CONVERSATION' });

    // ── L'IMAGE EST SUR LE PREMIER MESSAGE, ET SON ADRESSE EST RENDUE ──────
    const page = await messaging.listMessages(a.id, opened.conversationId, { limit: 20 });
    const premier = (page.items as { id: string; kind: string; mediaId: string | null; mediaUrl: string | null }[])
      .find((m) => m.id === opened.messageId);
    expect(premier?.mediaId).toBe(asset.id);
    expect(premier?.mediaUrl).toBe(`/media/${asset.storageKey}`);
    /** Le kind est DÉDUIT de la présence du média (§6, colonne absente). */
    expect(premier?.kind).toBe('IMAGE');

    // ── ET UNE IMAGE QUI N'EST PAS LA MIENNE N'OUVRE RIEN ─────────────────
    //
    // La branche qui CRÉE ne passe pas par `sendMessage` : sans son propre
    // contrôle, elle attacherait le média d'un autre membre — ou créerait la
    // conversation avant d'échouer.
    const c = await member();
    const sienne = await prisma.mediaAsset.create({
      data: {
        id: newId(),
        ownerUserId: b.id,
        kind: 'MESSAGE',
        storageKey: `test/story-capture/${newId()}.png`,
        mime: 'image/png',
        sizeBytes: BigInt(4096),
        status: 'READY',
        exifStripped: true,
      },
    });
    createdMediaIds.push(sienne.id);

    await expect(
      messaging.openDirect(
        { userId: a.id, level: 'L1' },
        { toHandle: c.handle, firstMessage: 'Bonjour.', mediaId: sienne.id },
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    const entre = await prisma.conversationMember.findMany({
      where: { userId: { in: [a.id, c.id] } },
      select: { conversationId: true, userId: true },
    });
    const partagees = entre
      .filter((m) => m.userId === a.id)
      .map((m) => m.conversationId)
      .filter((id) => entre.some((m) => m.userId === c.id && m.conversationId === id));
    expect(partagees, 'une conversation a été créée malgré le refus').toHaveLength(0);
  });
});
