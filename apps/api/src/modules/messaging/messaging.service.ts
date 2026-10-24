import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { newId, type Prisma } from '@app/db';
import {
  CONVERSATION_PREVIEW_MAX,
  type ConversationsQuery,
  type CreateDirectConversation,
  MESSAGES_PER_MINUTE,
  MESSAGE_DELETED_PLACEHOLDER,
  MESSAGE_DELETED_USER_PLACEHOLDER,
  MESSAGE_RATE_WINDOW_MS,
  MESSAGING_ERROR_CODES,
  MESSAGING_ERROR_MESSAGES,
  type MessageKind,
  type MessagesQuery,
  type MessagingErrorCode,
  NEW_CONVERSATIONS_PER_DAY,
  NEW_CONVERSATIONS_WINDOW_MS,
  type SendMessage,
  type VerificationLevel,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { AuditService } from '../../common/audit.service';
import { CryptoService } from '../../common/crypto.service';
import { buildPage, decodeCursor } from '../../common/cursor';
import { REQUIRED_MEDIA_STATUS, ownedAttachableWhere } from '../../common/media-attachment';
import { OutboxService } from '../../common/outbox.service';
import { PrismaService } from '../../common/prisma.service';
import { VisibilityService } from '../../common/visibility.service';
import { loadEnv } from '../../config/env';
import { ConnectionsService } from '../connections/connections.service';
import { RealtimeRelayService } from '../realtime/realtime.relay';
import type { RealtimeEvent } from '../realtime/realtime.channel';

/**
 * Messagerie — 08-parrainage-messagerie.md §5.
 *
 * « Volontairement minimale » (§1) : trois kinds, pas de groupe libre, pas de
 * recherche. Ce qui est petit ici, c'est la surface ; ce qui est délicat, c'est
 * QUI PEUT ÉCRIRE À QUI (§5.2) — la seule règle du module qui protège contre le
 * démarchage, et la seule qu'un front ne peut pas faire respecter.
 *
 * Trois points structurent ce service :
 *
 *   · le CHIFFREMENT est AU REPOS, pas de bout en bout (00 §8.1, décision T4) :
 *     « la modération doit pouvoir traiter un signalement ». `CryptoService`
 *     scelle et ouvre avec la clé de contenu ; le serveur voit donc les messages,
 *     et c'est assumé. Construire du bout en bout ici contredirait la spec et
 *     rendrait la modération d'une conversation signalée impossible.
 *
 *   · le NIVEAU de vérification est une règle du SERVICE autant que du garde.
 *     §5.2 : un L0 ne peut ouvrir aucune conversation DIRECT, mais il écrit dans
 *     les conversations MENTORSHIP et JOURNEY dont il fait partie — un pré-départ
 *     doit pouvoir parler à son parrain. La route d'envoi ne peut donc pas
 *     déclarer `message.send` (L1) : elle déclare `content.read` et c'est ici que
 *     le refus se décide, en fonction du KIND.
 *
 *   · la DEMANDE DE CONVERSATION (§5.2, « n'importe qui une fois ») est un ÉTAT,
 *     et le schéma figé ne porte pas la colonne `conversations.pending_from_user_id`
 *     que §6 déclare « Ajoutée ». L'état est donc déduit, et la déduction est
 *     documentée sur `pendingState()`.
 */

/** Ce qui autorise une conversation DIRECT (§5.2). `COLD` = la seule fois permise. */
export type DirectPermission = 'CONTACT' | 'MENTORSHIP' | 'HELP_REPLY' | 'GREET' | 'COLD';

interface PendingState {
  /** La conversation attend une réponse du destinataire. */
  readonly pending: boolean;
  /** Qui a écrit le premier, quand la conversation est en attente. */
  readonly initiatorUserId: string | null;
}

export interface MessagingActor {
  readonly userId: string;
  readonly level: VerificationLevel;
}

const MEMBER_SELECT = {
  id: true,
  handle: true,
  displayName: true,
  deletedAt: true,
  status: true,
  avatarAsset: { select: { storageKey: true } },
} satisfies Prisma.UserSelect;

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);
  private readonly cursorSecret = loadEnv().CURSOR_SECRET;

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly visibility: VisibilityService,
    private readonly connections: ConnectionsService,
    /**
     * LA POUSSÉE TEMPS RÉEL (08 §7.3), FACULTATIVE : les épreuves qui construisent
     * ce service à la main n'en ont pas, et un navigateur sans socket retombe sur
     * le polling (`MESSAGE_POLL_INTERVAL_MS`). Elle ne lève jamais — voir
     * `RealtimeRelayService.publish`.
     */
    @Optional() @Inject(RealtimeRelayService) private readonly realtime: RealtimeRelayService | null = null,
  ) {}

  /**
   * Pousse un événement à ces membres. Ne lève jamais, n'attend pas les
   * destinataires un par un : la requête HTTP qui l'a déclenché ne doit pas
   * dépendre de Redis pour répondre.
   */
  private async push(
    userIds: readonly string[],
    event: RealtimeEvent,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const relais = this.realtime;
    if (relais === null) return;
    await Promise.all([...new Set(userIds)].map((id) => relais.publish(id, event, payload)));
  }

  private fail(code: MessagingErrorCode, details?: Record<string, unknown>): never {
    throw new ApiError(code, MESSAGING_ERROR_MESSAGES[code], MESSAGING_ERROR_CODES[code], details);
  }

  // ── Lectures ──────────────────────────────────────────────────────────────

  /**
   * `GET /conversations` (§7.3) : « Mes conversations, non-lus, dernière ligne ».
   *
   * Une conversation QUITTÉE (`left_at`) disparaît de la liste : c'est ce que fait
   * la cascade de blocage (§4), et la laisser visible donnerait un fil qu'on peut
   * lire mais où l'on ne peut plus écrire — le pire des deux.
   */
  async listConversations(userId: string, query: ConversationsQuery) {
    const scope = `conversations:${userId}`;
    /**
     * LA CONVERSATION QUE J'AI FERMÉE PAR UN BLOCAGE RESTE LISTÉE (lot F2).
     *
     * La cascade de blocage (§4) pose `left_at` sur les deux lignes d'une DIRECT.
     * Sans exception, la conversation disparaissait de la liste ET le membre qui
     * venait de bloquer n'avait plus aucun endroit où la DÉBLOQUER : le bouton
     * « Débloquer » de la conversation bloquée (M01BLOQUE) aurait été
     * inatteignable. On garde donc, pour MOI seul, les DIRECT fermées dont
     * l'interlocuteur figure dans MES blocages (`blockedByMe`). Celui qui a été
     * bloqué, lui, ne la voit plus : il n'a rien à y faire et ne doit pas deviner.
     */
    const bloquesParMoi = (
      await this.prisma.block.findMany({
        where: { blockerUserId: userId },
        select: { blockedUserId: true },
      })
    ).map((b) => b.blockedUserId);
    const memberships = await this.prisma.conversationMember.findMany({
      where: {
        userId,
        OR: [
          { leftAt: null },
          ...(bloquesParMoi.length === 0
            ? []
            : [
                {
                  conversation: {
                    kind: 'DIRECT' as const,
                    members: { some: { userId: { in: bloquesParMoi } } },
                  },
                },
              ]),
        ],
      },
      select: { conversationId: true, lastReadAt: true },
    });
    if (memberships.length === 0) return { items: [], nextCursor: null, meta: { unreadTotal: 0 } };

    const lastReadBy = new Map(memberships.map((m) => [m.conversationId, m.lastReadAt]));
    const where: Prisma.ConversationWhereInput = { id: { in: [...lastReadBy.keys()] } };

    const rows = await this.prisma.conversation.findMany({
      where:
        query.cursor === undefined
          ? where
          : {
              AND: [
                where,
                { id: { lt: decodeCursor(query.cursor, this.cursorSecret, scope).id } },
              ],
            },
      orderBy: { id: 'desc' },
      take: query.limit + 1,
      include: {
        /**
         * `isMuted` VIENT AVEC LES MEMBRES, dans la même requête. Ma ligne de
         * membre est déjà chargée pour `leftAt` ; y ajouter une colonne ne coûte
         * rien, là où une requête par conversation en coûterait vingt par page.
         */
        members: {
          select: { userId: true, leftAt: true, isMuted: true, user: { select: MEMBER_SELECT } },
        },
        journey: { select: { title: true } },
        /**
         * LE NOM DU RÉSEAU VIENT AVEC LA CONVERSATION, dans la même requête.
         *
         * Il n'est PAS recopié dans la ligne de conversation à l'ouverture du
         * fil : `PATCH /communities/:id` accepte `name`, donc un réseau se
         * renomme, et un titre figé au premier clic aurait vieilli en silence.
         * Une jointure ne coûte rien de plus ; un aller-retour par conversation
         * en coûterait vingt par page.
         */
        community: { select: { name: true } },
      },
    });

    const page = buildPage(rows, query.limit, scope, this.cursorSecret);
    const separated = new Set(await this.visibility.separatedFrom(userId));

    const items = [];
    let unreadTotal = 0;
    for (const conversation of page.items) {
      const lastReadAt = lastReadBy.get(conversation.id) ?? null;
      const others = conversation.members.filter((m) => m.userId !== userId);
      const mienne = conversation.members.find((m) => m.userId === userId) ?? null;

      const blockedByMe =
        conversation.kind === 'DIRECT' && others.some((m) => bloquesParMoi.includes(m.userId));
      // Une conversation que j'ai fermée par un blocage ne compte aucun non-lu.
      const unread = blockedByMe
        ? 0
        : await this.prisma.message.count({
            where: {
              conversationId: conversation.id,
              senderUserId: { not: userId },
              deletedAt: null,
              ...(lastReadAt === null ? {} : { sentAt: { gt: lastReadAt } }),
            },
          });
      unreadTotal += unread;

      const last = await this.prisma.message.findFirst({
        where: { conversationId: conversation.id },
        orderBy: { id: 'desc' },
        include: { sender: { select: { id: true, handle: true, deletedAt: true } } },
      });

      const pending = await this.pendingState(conversation.id, userId);

      items.push({
        id: conversation.id,
        kind: conversation.kind,
        /**
         * §8 : « Conversation de parcours nommée par le titre du parcours
         * (visible de ses membres seuls) ». Nous SOMMES membre : la liste ne
         * renvoie que mes conversations.
         *
         * LA MÊME RÈGLE VAUT POUR LE FIL DE MODÉRATION, nommé par le nom du
         * réseau : sans titre, l'écran l'aurait nommé par la liste de ses
         * membres (« Aïcha Diop, Marc Koudou, Sandra M. »), ce qui ne dit pas
         * DE QUOI il s'agit — c'est `nomDeConversation`, côté front, qui retombe
         * là-dessus quand `title` est nul.
         *
         * ── CÔTÉ ÉQUIPE, LE NOM DU MEMBRE QUI A ÉCRIT S'AJOUTE ─────────────
         *
         * Le porteur, à la question « plusieurs fils portent le même nom » :
         * « OUI ajoute ». Un modérateur contacté par trois membres voyait trois
         * lignes « Cuisine béninoise », que seul l'aperçu du dernier message
         * distinguait. Pour TOUT AUTRE lecteur que celui qui a ouvert le fil
         * (`openedByUserId`), le titre devient « Cuisine béninoise · Aïcha
         * Diop ». Le membre qui a écrit, lui, garde le nom du réseau seul : il
         * n'a qu'un fil par réseau, et son propre nom n'y apprendrait rien.
         *
         * Le nom vient des MEMBRES déjà chargés, pas d'une requête de plus. Si
         * le membre n'y est plus (compte supprimé, sorti du fil), on retombe
         * sur le nom du réseau seul plutôt que d'écrire un nom périmé.
         */
        title:
          conversation.kind === 'JOURNEY'
            ? conversation.journey?.title ?? null
            : conversation.kind === 'COMMUNITY_MODERATION'
              ? this.titreModeration(conversation, userId)
              : null,
        members: others.map((m) => ({
          userId: m.userId,
          handle: m.user.handle,
          displayName: m.user.displayName,
          /**
           * `/media/<clé>` ET PLUS LA CLÉ NUE.
           *
           * Le porteur : « l'avatar de la personne n'est pas affichée en haut de
           * la conversation. » Ce champ rendait la CLÉ DE STOCKAGE seule, alors
           * que les six autres routes du dépôt — fil, stories, logement, profils
           * — rendent toutes `/media/<clé>` (`urlDuMedia`, juste au-dessous).
           * Composée côté front, la clé nue donnait `/v1/<clé>`, une adresse qui
           * ne sert rien ; et personne ne l'avait vu parce que personne ne la
           * lisait encore.
           */
          avatarUrl:
            m.user.avatarAsset === null || m.user.avatarAsset === undefined
              ? null
              : `/media/${m.user.avatarAsset.storageKey}`,
          // §4, effet de LECTURE : dans une conversation de groupe commune, les
          // deux restent membres mais leurs contenus sont masqués mutuellement.
          hidden: separated.has(m.userId),
          leftAt: m.leftAt,
        })),
        lastMessageAt: conversation.lastMessageAt,
        lastMessagePreview:
          last === null ? null : this.preview(last, separated.has(last.senderUserId)),
        unreadCount: unread,
        /**
         * LA SOURDINE ÉTAIT STOCKÉE ET JAMAIS RENDUE.
         *
         * `conversation_members.is_muted` existe dans le schéma figé depuis le
         * début ; aucune route ne la lisait ni ne l'écrivait. L'entrée « Mettre
         * en sourdine » du menu de conversation était donc un `<span>` inerte, et
         * le porteur l'a relevé : « les options voir le profil, mettre en
         * sourdine, bloquer et signaler ne marchent pas ».
         */
        muted: mienne?.isMuted ?? false,
        /** §5.2 : une demande que je dois accepter ou ignorer. */
        pendingForMe: pending.pending && pending.initiatorUserId !== userId,
        /** Mon premier message attend une réponse : pas de second (§5.2). */
        awaitingReply: pending.pending && pending.initiatorUserId === userId,
        /** C'est MOI qui ai bloqué l'interlocuteur de cette DIRECT (lot F2). */
        blockedByMe,
      });
    }

    return { items, nextCursor: page.nextCursor, meta: { unreadTotal } };
  }

  /**
   * `GET /conversations/:id/messages` (§7.3) : « Paginé, marque lu ».
   *
   * « Marque lu » a UNE exception : le destinataire d'une demande de conversation
   * non encore acceptée. Deux raisons, et la seconde est la vraie : d'abord un
   * « Vu » avant acceptation en dirait plus que ce que le destinataire a voulu
   * dire ; ensuite `last_read_at` est ce qui matérialise l'acceptation, faute de
   * la colonne `pending_from_user_id` de §6 — la marquer à la lecture accepterait
   * la demande à la place du membre.
   */
  async listMessages(userId: string, conversationId: string, query: MessagesQuery) {
    const { conversation, member } = await this.memberOf(conversationId, userId);
    const scope = `messages:${conversationId}`;

    const rows = await this.prisma.message.findMany({
      where:
        query.cursor === undefined
          ? { conversationId }
          : {
              conversationId,
              id: { lt: decodeCursor(query.cursor, this.cursorSecret, scope).id },
            },
      orderBy: { id: 'desc' },
      take: query.limit + 1,
      /**
       * LA CLÉ DE STOCKAGE VIENT AVEC LE MESSAGE, dans la même requête.
       *
       * `mediaId` était rendu depuis le début et ne menait nulle part : aucune
       * route ne résolvait un média en adresse, et la vignette que la maquette
       * dessine n'avait donc rien à afficher. Un aller-retour par message pour
       * chercher la clé serait vingt requêtes par page ; une jointure en coûte
       * zéro de plus.
       *
       * `deletedAt: null` N'EST PAS FILTRÉ ICI, et c'est volontaire : la relation
       * est `onDelete: SetNull`, donc un média réellement supprimé fait tomber
       * `mediaAssetId` avec lui. Filtrer sur un média marqué supprimé rendrait
       * `mediaUrl: null` avec un `mediaId` non nul — ce qui est exactement l'état
       * que l'écran doit savoir distinguer, et `urlDuMedia` s'en charge.
       */
      include: {
        sender: { select: MEMBER_SELECT },
        mediaAsset: { select: { storageKey: true, deletedAt: true } },
        /**
         * LA STORY D'OÙ LE MESSAGE EST PARTI, dans la même requête.
         *
         * Le porteur : « Il faut qu'on puisse cliquer sur [la vignette] et aller
         * vers la story si toujours en ligne. Sinon ça affirme que la story a
         * expiré. » L'écran a donc besoin de savoir si elle vit ENCORE, et c'est
         * le serveur qui en juge : une story vit vingt-quatre heures, et
         * l'horloge d'un navigateur peut être fausse de plusieurs heures.
         *
         * Deux colonnes suffisent — `status` et `expiresAt` — et c'est la règle
         * exacte de `feed.service.ts`. Une seconde requête par message en
         * coûterait vingt par page ; cette jointure n'en coûte aucune.
         */
        story: { select: { id: true, status: true, expiresAt: true, deletedAt: true } },
      },
    });

    const page = buildPage(rows, query.limit, scope, this.cursorSecret);
    const separated = new Set(await this.visibility.separatedFrom(userId));

    const pending = await this.pendingState(conversationId, userId);
    const iAmPendingRecipient = pending.pending && pending.initiatorUserId !== userId;
    if (!iAmPendingRecipient) {
      const last = page.items.at(0);
      const readAt = last?.sentAt ?? new Date();
      if (member.lastReadAt === null || member.lastReadAt < readAt) {
        await this.prisma.conversationMember.update({
          where: { conversationId_userId: { conversationId, userId } },
          data: { lastReadAt: readAt },
        });
        // « Vu » EN DIRECT : les autres membres apprennent que j'ai lu, et mes
        // autres onglets que mon compteur de non-lus a baissé. Seulement quand la
        // lecture AVANCE : un rechargement qui ne change rien ne pousse rien.
        const others = conversation.members
          .filter((m) => m.userId !== userId && m.leftAt === null)
          .map((m) => m.userId);
        void this.push(others, 'message.read', {
          conversationId,
          readerUserId: userId,
          readAt: readAt.toISOString(),
        });
        void this.push([userId], 'conversation.updated', { conversationId, reason: 'read' });
      }
    }

    /**
     * ── « VU » ──────────────────────────────────────────────────────────────
     *
     * Où en est la lecture des AUTRES membres, renvoyée telle quelle depuis
     * `last_read_at`. À deux, c'est celle de l'interlocuteur ; à plusieurs, la
     * plus ancienne (« vu par tous »). Un membre qui a quitté ne compte pas, et
     * un membre qui n'a jamais lu rend `null` pour tout le monde : mieux vaut ne
     * pas afficher « Vu » que l'afficher trop tôt.
     *
     * Lue APRÈS ma propre mise à jour et sans elle : ma ligne n'y entre pas.
     */
    const lecturesDesAutres = conversation.members
      .filter((m) => m.userId !== userId && m.leftAt === null)
      .map((m) => m.lastReadAt);
    const seenAt =
      lecturesDesAutres.length === 0 || lecturesDesAutres.some((d) => d === null)
        ? null
        : new Date(Math.min(...lecturesDesAutres.map((d) => (d as Date).getTime())));

    return {
      items: page.items.map((message) => ({
        id: message.id,
        senderUserId: message.senderUserId,
        senderHandle: message.sender.handle,
        kind: this.kindOf(message),
        // §4, effet de lecture : dans une conversation de groupe commune, les
        // contenus d'un membre séparé sont MASQUÉS, les deux restant membres.
        body: this.bodyOf(message, separated.has(message.senderUserId)),
        mediaId: message.mediaAssetId,
        mediaUrl: this.urlDuMedia(message.mediaAsset),
        storyId: message.story === null || message.story.deletedAt !== null ? null : message.story.id,
        /**
         * « ENCORE EN LIGNE » — LA MÊME DÉFINITION QUE LE FIL, mot pour mot :
         * `status === 'EXPIRED' || expiresAt <= maintenant` (`feed.service.ts`).
         * Une story supprimée est traitée comme absente plus haut, donc elle rend
         * `storyId: null` : la vignette redevient une image muette plutôt que de
         * promettre une page qui répondrait 404.
         */
        storyAlive:
          message.story !== null &&
          message.story.deletedAt === null &&
          message.story.status !== 'EXPIRED' &&
          message.story.expiresAt.getTime() > Date.now(),
        sentAt: message.sentAt,
        deletedAt: message.deletedAt,
        mine: message.senderUserId === userId,
      })),
      nextCursor: page.nextCursor,
      meta: {
        kind: conversation.kind,
        pendingForMe: iAmPendingRecipient,
        awaitingReply: pending.pending && pending.initiatorUserId === userId,
        seenAt: seenAt === null ? null : seenAt.toISOString(),
      },
    };
  }

  // ── Écritures ─────────────────────────────────────────────────────────────

  /**
   * `POST /conversations/direct` (§7.3). Unique par paire (§5.1).
   *
   * Si la conversation existe déjà, on n'en crée pas une seconde : le message part
   * dans l'existante, en repassant par `sendMessage` — c'est là que vit la règle
   * du second message (§5.2), et la dupliquer ici la ferait diverger.
   */
  /**
   * ╔════════════════════════════════════════════════════════════════════════════╗
   * ║ METTRE UNE CONVERSATION EN SOURDINE — §7.3                                ║
   * ╚════════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « les options voir le profil, mettre en sourdine, bloquer et
   * signaler ne marchent pas. Intègre tout ça. »
   *
   * La colonne `conversation_members.is_muted` EXISTE dans le schéma figé depuis
   * le début, et aucune route ne l'écrivait. Rien à migrer, donc : seulement à
   * brancher.
   *
   * `memberOf` d'abord, et c'est ce qui tient la règle : il rend 404 — jamais 403
   * (T4 §3) — pour une conversation dont je ne suis pas membre. Mettre en
   * sourdine une conversation qu'on ne peut pas lire n'a aucun sens, et répondre
   * « interdit » dirait qu'elle existe.
   *
   * CE QUE LA SOURDINE FAIT, ET CE QU'ELLE NE FAIT PAS : elle coupe les
   * NOTIFICATIONS, pas la conversation. Les messages arrivent, le compteur de non
   * lus continue — c'est la définition du §7.3, et c'est ce que le membre attend
   * d'un « mettre en sourdine » plutôt que d'un « archiver ».
   *
   * ⚠ REMONTÉ : aucun émetteur de notification ne LIT encore `is_muted`. Le choix
   * est stocké, rendu, et respecté par l'écran ; le jour où les notifications de
   * message partent vraiment, c'est `notifications.events.ts` qui devra le lire.
   * Le dire ici vaut mieux que de laisser croire que la boucle est fermée.
   */
  async setMuted(userId: string, conversationId: string, muted: boolean) {
    await this.memberOf(conversationId, userId);
    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { isMuted: muted },
    });
    // Mes autres onglets suivent : l'icône de sourdine de la liste doit changer
    // sans rechargement.
    void this.push([userId], 'conversation.updated', { conversationId, reason: 'muted' });
    return { muted };
  }

  async openDirect(actor: MessagingActor, input: CreateDirectConversation) {
    // §5.2 : un L0 ne peut ouvrir AUCUNE conversation directe. Le garde le refuse
    // déjà (`message.send` est L1) ; on le redit ici parce que la règle dure du
    // §12 porte sur le comportement, pas sur le décorateur.
    this.assertCanSendDirect(actor);

    const target = await this.prisma.user.findUnique({
      where: { handle: input.toHandle },
      select: { id: true, deletedAt: true, status: true },
    });
    if (target === null || !this.isVisible(target)) throw ApiError.notFound();
    if (target.id === actor.userId) {
      throw ApiError.validation([{ path: 'toHandle', code: 'SELF_CONVERSATION' }]);
    }
    if (await this.visibility.isSeparated(actor.userId, target.id)) {
      // §7.3 nomme `BLOCKED_RELATIONSHIP` sur cette route : c'est l'une des rares
      // où la spec préfère le code explicite au 404 de discrétion.
      throw ApiError.transverse('BLOCKED_RELATIONSHIP');
    }

    const existing = await this.findDirectBetween(actor.userId, target.id);
    if (existing !== null) {
      const sent = await this.sendMessage(actor, existing, {
        body: input.firstMessage,
        ...(input.mediaId === undefined ? {} : { mediaId: input.mediaId }),
        /**
         * LA STORY PASSE AUSSI PAR CETTE BRANCHE, et c'est celle qu'on emprunte le
         * plus : dès qu'on a déjà écrit une fois à quelqu'un, écrire depuis sa
         * story RÉUTILISE la conversation. L'oublier ici aurait donné une vignette
         * cliquable au tout premier message et muette à tous les suivants — un
         * défaut qui ne se voit qu'à la deuxième story.
         */
        ...(input.storyId === undefined ? {} : { storyId: input.storyId }),
      });
      const pending = await this.pendingState(existing, actor.userId);
      return {
        conversationId: existing,
        messageId: sent.messageId,
        pending: pending.pending && pending.initiatorUserId === actor.userId,
      };
    }

    /**
     * L'IMAGE EST VÉRIFIÉE AVANT D'OUVRIR QUOI QUE CE SOIT.
     *
     * `sendMessage` fait ce contrôle sur la branche « conversation existante »,
     * puisqu'elle y passe. La branche qui CRÉE n'y passe pas : sans cette ligne,
     * un `mediaId` qui ne m'appartient pas — ou qui n'est pas prêt — créerait la
     * conversation, le message et l'événement, pour échouer ensuite ou, pire, pour
     * attacher le média d'un autre. Le quota, lui, se vérifie après : refuser pour
     * quota une demande dont l'image est déjà invalide dirait la mauvaise raison.
     */
    if (input.mediaId !== undefined) await this.assertOwnedMedia(actor.userId, input.mediaId);

    await this.assertConversationQuota(actor.userId);

    const conversationId = newId();
    const messageId = newId();
    const now = new Date();
    const sealed = this.crypto.encryptContent(input.firstMessage);

    await this.prisma.$transaction(async (tx) => {
      await tx.conversation.create({
        data: { id: conversationId, kind: 'DIRECT', lastMessageAt: now },
      });
      await tx.conversationMember.createMany({
        data: [
          { conversationId, userId: actor.userId, joinedAt: now },
          { conversationId, userId: target.id, joinedAt: now },
        ],
      });
      await tx.message.create({
        data: {
          id: messageId,
          conversationId,
          senderUserId: actor.userId,
          bodyEncrypted: sealed,
          mediaAssetId: input.mediaId ?? null,
          storyId: input.storyId ?? null,
          sentAt: now,
        },
      });
      await this.outbox.emit(tx, {
        type: 'message.sent',
        aggregateId: messageId,
        // AUCUN corps de message dans le payload : un événement de domaine est
        // conservé en clair dans `domain_events`, et le §8.1 chiffre justement les
        // messages au repos. La modération lit la table, pas l'événement.
        payload: {
          messageId,
          conversationId,
          kind: 'DIRECT',
          senderUserId: actor.userId,
          recipientUserIds: [target.id],
        },
      });
    });

    return {
      conversationId,
      messageId,
      /** §5.2 : le premier message EST la demande, tant que la relation est froide. */
      pending: (await this.permissionFor(actor.userId, target.id)) === 'COLD',
    };
  }

  /**
   * `POST /conversations/:id/accept` (§7.3) — « Destinataire d'une DIRECT en attente ».
   *
   * L'acceptation est matérialisée par `conversation_members.last_read_at`, faute
   * de la colonne `conversations.pending_from_user_id` de §6 (absente du schéma
   * figé). Le détournement est MODESTE et non arbitraire : accepter, c'est avoir
   * lu et consenti à la suite ; et c'est exactement ce que le destinataire fait.
   */
  async acceptDirect(userId: string, conversationId: string) {
    const { conversation } = await this.memberOf(conversationId, userId);
    if (conversation.kind !== 'DIRECT') throw ApiError.notFound();

    const pending = await this.pendingState(conversationId, userId);
    if (!pending.pending || pending.initiatorUserId === userId) {
      // Rien à accepter : déjà accepté, ou c'est moi qui attends. Idempotent
      // plutôt qu'en erreur — un double clic ne doit pas produire un 409.
      return { accepted: true };
    }

    const now = new Date();
    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: now },
    });

    // L'initiateur apprend l'acceptation EN DIRECT : son bandeau « en attente de
    // réponse » tombe, son champ se rouvre, et son message passe à « Vu ».
    const initiator = pending.initiatorUserId;
    if (initiator !== null) {
      void this.push([initiator], 'conversation.updated', { conversationId, reason: 'accepted' });
      void this.push([initiator], 'message.read', {
        conversationId,
        readerUserId: userId,
        readAt: now.toISOString(),
      });
    }
    void this.push([userId], 'conversation.updated', { conversationId, reason: 'accepted' });
    return { accepted: true };
  }

  /**
   * `POST /conversations/:id/ignore` — l'autre moitié de « l'autre accepte ou
   * IGNORE » (08 §5.2), que la spec nomme et qu'aucune route ne portait.
   *
   * IGNORER, C'EST SORTIR DE LA CONVERSATION, SANS UN MOT À L'AUTRE. `left_at` est
   * posé sur MA ligne : la demande quitte ma liste (`listConversations` écarte les
   * conversations quittées), et elle n'est plus lisible par moi. L'initiateur,
   * lui, ne voit RIEN changer — il reste « en attente de réponse » et ne peut pas
   * écrire un second message (`PENDING_CONVERSATION`, la règle dure du §12). C'est
   * exactement « sans réponse, pas de second message » ; lui annoncer un refus
   * serait une pression de plus sur celui qui a choisi de ne pas répondre.
   *
   * RIEN À IGNORER = NON ÉCHEC : déjà acceptée, déjà ignorée, ou c'est moi qui
   * attends. Un double clic ne doit pas produire un 409, comme `acceptDirect`.
   *
   * ⚠ LIMITE ASSUMÉE, remontée : `left_at` est aussi ce que la cascade de blocage
   * pose. Un membre qui a ignoré une demande ne peut donc pas, plus tard, écrire
   * lui-même dans CE fil (`CONVERSATION_CLOSED`) ; il le peut en revanche après un
   * déblocage de sa part ou une demande de contact, qui passent par une autre voie.
   * Une colonne `ignored_at` serait plus juste, mais le schéma de ce module est
   * figé (§6) et la migration d'une colonne pour ce seul cas n'est pas justifiée.
   */
  async ignoreDirect(userId: string, conversationId: string) {
    const { conversation, member } = await this.memberOf(conversationId, userId);
    if (conversation.kind !== 'DIRECT') throw ApiError.notFound();
    if (member.leftAt !== null) return { ignored: true };

    const pending = await this.pendingState(conversationId, userId);
    if (!pending.pending || pending.initiatorUserId === userId) return { ignored: false };

    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { leftAt: new Date() },
    });
    void this.push([userId], 'conversation.updated', { conversationId, reason: 'deleted' });
    return { ignored: true };
  }

  /**
   * `POST /conversations/:id/messages` (§7.3).
   *
   * RÈGLE DURE (§12) : « un premier message non accepté n'autorise pas de second
   * message ». C'est ici, et nulle part ailleurs.
   */
  async sendMessage(actor: MessagingActor, conversationId: string, input: SendMessage) {
    const { conversation, member } = await this.memberOf(conversationId, actor.userId);

    // §5.2 : le L0 écrit dans MENTORSHIP et JOURNEY, jamais en DIRECT.
    if (conversation.kind === 'DIRECT') this.assertCanSendDirect(actor);

    const others = conversation.members
      .filter((m) => m.userId !== actor.userId)
      .map((m) => m.userId);

    // Dans une conversation à deux, un blocage ferme le fil (§5.2). La cascade
    // pose `left_at`, mais une conversation MENTORSHIP n'est pas fermée par §4 :
    // le contrôle ici est ce qui empêche d'y écrire malgré la séparation.
    if (others.length === 1) {
      const other = others[0] as string;
      if (await this.visibility.isSeparated(actor.userId, other)) {
        throw ApiError.transverse('BLOCKED_RELATIONSHIP');
      }
    }
    if (member.leftAt !== null) this.fail('CONVERSATION_CLOSED');

    await this.assertMessageRate(actor.userId);

    if (conversation.kind === 'DIRECT') {
      const pending = await this.pendingState(conversationId, actor.userId);
      if (pending.pending && pending.initiatorUserId === actor.userId) {
        this.fail('PENDING_CONVERSATION');
      }
    }

    if (input.mediaId !== undefined) await this.assertOwnedMedia(actor.userId, input.mediaId);

    const messageId = newId();
    const now = new Date();
    const sealed = this.crypto.encryptContent(input.body ?? '');

    await this.prisma.$transaction(async (tx) => {
      await tx.message.create({
        data: {
          id: messageId,
          conversationId,
          senderUserId: actor.userId,
          bodyEncrypted: sealed,
          mediaAssetId: input.mediaId ?? null,
          storyId: input.storyId ?? null,
          sentAt: now,
        },
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: now },
      });
      await this.outbox.emit(tx, {
        type: 'message.sent',
        aggregateId: messageId,
        payload: {
          messageId,
          conversationId,
          kind: conversation.kind,
          senderUserId: actor.userId,
          recipientUserIds: others,
        },
      });
    });

    return { messageId, conversationId, sentAt: now };
  }

  /**
   * `DELETE /messages/:id` (§7.3) : suppression LOGIQUE par l'émetteur (§5.3).
   *
   * Le corps chiffré est CONSERVÉ. §5.2 : « la modération peut lire la
   * conversation signalée » — effacer le corps à la suppression donnerait à
   * l'auteur d'un message abusif le moyen d'effacer la preuve après signalement.
   * L'affichage, lui, ne rend plus que « Message supprimé ».
   */
  async deleteMessage(userId: string, messageId: string): Promise<void> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, senderUserId: true, deletedAt: true, conversationId: true },
    });
    if (message === null || message.senderUserId !== userId) throw ApiError.notFound();
    if (message.deletedAt !== null) return;

    await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });

    // « Message supprimé » apparaît chez les autres sans qu'ils rechargent.
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId: message.conversationId, leftAt: null },
      select: { userId: true },
    });
    void this.push(
      members.map((m) => m.userId),
      'conversation.updated',
      { conversationId: message.conversationId, reason: 'deleted' },
    );
  }

  // ── Conversations créées par d'autres modules ─────────────────────────────

  /**
   * La conversation MENTORSHIP, créée « à l'acceptation du parrainage » (§5.1).
   *
   * Appelée DANS la transaction d'acceptation par le module parrainage : un
   * parrainage actif sans sa conversation laisserait les deux membres sans moyen
   * de se parler, et rien ne viendrait la créer ensuite.
   *
   * Idempotente : elle rend la conversation existante si le parrainage en a déjà
   * une, ce qui rend une acceptation rejouée inoffensive.
   */
  async ensureMentorshipConversation(
    tx: Prisma.TransactionClient,
    mentorshipId: string,
    memberIds: readonly string[],
  ): Promise<string> {
    const existing = await tx.conversation.findFirst({
      where: { kind: 'MENTORSHIP', mentorshipId },
      select: { id: true },
    });
    if (existing !== null) return existing.id;

    const conversationId = newId();
    const now = new Date();
    await tx.conversation.create({
      data: { id: conversationId, kind: 'MENTORSHIP', mentorshipId },
    });
    await tx.conversationMember.createMany({
      data: memberIds.map((userId) => ({ conversationId, userId, joinedAt: now })),
      skipDuplicates: true,
    });
    return conversationId;
  }

  /**
   * §5.1, conversation JOURNEY : « À la création du parcours ; membres synchronisés
   * avec `journey_members` ».
   *
   * Abonnée à `journey.created` et `journey.member_joined` (§9, « Consommés »).
   * RECALCUL idempotent — c'est ce qu'exige une livraison « au moins une fois » :
   * on ajoute les membres manquants, on fait sortir ceux qui ne sont plus là, et un
   * rejeu ne bouge rien.
   *
   * Le module 03 n'existe pas encore, donc rien n'émet ces événements aujourd'hui.
   * L'abonnement est posé plutôt qu'oublié — c'est précisément ce qui est arrivé à
   * `user.onboarded_location`, dont personne n'a écouté l'événement pendant des mois.
   */
  async syncJourneyConversation(journeyId: string): Promise<string | null> {
    const journey = await this.prisma.journey.findUnique({
      where: { id: journeyId },
      select: { id: true, ownerUserId: true, groupConversationId: true, deletedAt: true },
    });
    if (journey === null || journey.deletedAt !== null) return null;

    const supporters = await this.prisma.journeyMember.findMany({
      where: { journeyId, role: 'SUPPORTER', status: 'ACTIVE', removedAt: null },
      select: { userId: true },
    });
    const mentors = await this.prisma.mentorship.findMany({
      where: { journeyId, status: 'ACTIVE' },
      select: { mentorUserId: true },
    });

    const expected = new Set<string>([
      journey.ownerUserId,
      ...supporters.map((m) => m.userId),
      ...mentors.map((m) => m.mentorUserId),
    ]);

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      let conversationId = journey.groupConversationId;
      if (conversationId === null) {
        conversationId = newId();
        await tx.conversation.create({
          data: { id: conversationId, kind: 'JOURNEY', journeyId },
        });
        await tx.journey.update({
          where: { id: journeyId },
          data: { groupConversationId: conversationId },
        });
      }

      /**
       * Le recalcul des membres vit maintenant dans `syncMembres`, parce que le
       * fil de modération d'un réseau en a besoin MOT POUR MOT — ajouter les
       * manquants, faire revenir les sortis, faire sortir ceux qui ne sont plus
       * attendus. Les deux boucles étaient écrites ici en ligne ; deux copies
       * auraient divergé au premier ajustement, et c'est une divergence qui ne
       * se voit qu'en regardant les membres d'une conversation.
       */
      await this.syncMembres(tx, conversationId, expected, now);

      return conversationId;
    });
  }

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ « CONTACTER LES MODÉRATEURS » — LE FIL DE GROUPE D'UN RÉSEAU             ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Les deux boutons de la planche « À propos » de A08T (1036 px et 390 px)
   * n'avaient AUCUNE route : `07-reseaux.md` décrit le chemin modérateur →
   * membre — masquer, retirer, épingler, clore — et jamais l'inverse.
   *
   * CE N'EST PAS UN SIGNALEMENT, et c'est la confusion à ne pas faire :
   * `POST /reports` va à l'équipe de la PLATEFORME, ouvre un `moderation_case`
   * et peut suspendre un compte (L2). Ceci va aux bénévoles d'UN réseau, n'ouvre
   * aucun dossier et n'a aucun pouvoir de sanction. Le détail de l'arbitrage est
   * sur `moderatorsConversationResponseSchema`, dans `@app/shared`.
   *
   * ── POURQUOI UN QUATRIÈME KIND, ET NON L'UN DES TROIS ─────────────────────
   *
   * MESURÉ, pas supposé. `DIRECT` est à DEUX membres et « unique par paire »
   * (§5.1) : elle aurait désigné un seul modérateur, et elle serait entrée en
   * COLLISION avec la conversation privée que le demandeur et ce modérateur ont
   * peut-être déjà — `findDirectBetween` rend la même ligne. `JOURNEY` et
   * `MENTORSHIP` portent chacune une clé étrangère vers un parcours ou un
   * parrainage, qui n'existent pas ici. Aucun des trois ne convenait.
   *
   * ── IDEMPOTENTE, PAR CONSTRUCTION ────────────────────────────────────────
   *
   * « Un membre qui clique deux fois ne doit pas ouvrir deux conversations. »
   * La recherche se fait sur le COUPLE (réseau, demandeur), que les deux
   * nouvelles colonnes portent — et `@@unique([communityId, openedByUserId])`
   * attrape la course des deux clics simultanés, que la recherche seule laisse
   * passer. `openedByUserId` est indispensable et non du confort : un
   * modérateur appartient à TOUS les fils de son réseau, donc chercher « la
   * conversation de ce réseau dont je suis membre » lui rendrait celle d'un
   * autre demandeur.
   *
   * ── LES MEMBRES SONT RECALCULÉS À CHAQUE OUVERTURE ───────────────────────
   *
   * Même forme que `syncJourneyConversation`, et pour une raison qui se voit :
   * l'équipe d'un réseau CHANGE. Un modérateur nommé après l'ouverture du fil
   * doit pouvoir le lire — sinon la réponse collective dépend de la composition
   * de l'équipe au jour du premier clic — et un modérateur destitué doit en
   * sortir. Le retrait pose `left_at` et n'efface rien : il a lu ces messages,
   * et le fil reste cohérent pour les autres.
   *
   * LE DEMANDEUR NE SORT JAMAIS : il est toujours dans `attendus`. Et si c'est
   * lui qui est destitué de l'équipe entre deux clics, il garde SON fil — c'est
   * le fil du demandeur, pas celui de l'équipe.
   *
   * ── CE QUE CETTE MÉTHODE NE FAIT PAS, ET POURQUOI ────────────────────────
   *
   * ⚠ AUCUN MESSAGE SYSTÈME n'annonce l'ouverture. §6 déclare `messages.kind`
   * avec une valeur `SYSTEM`, la colonne n'existe pas dans le schéma figé, et le
   * kind est DÉDUIT (`kindOf`) : un message système écrit aujourd'hui serait
   * indistinguable d'un message du membre. Le fil naît donc VIDE, comme naît
   * une conversation JOURNEY.
   *
   * ⚠ AUCUN ÉVÉNEMENT DE DOMAINE n'est émis, et aucune notification ne part :
   * `message.sent` est produit par `sendMessage`, c'est-à-dire au PREMIER
   * message réel — qui est ce que l'équipe doit lire. Émettre quelque chose à
   * l'ouverture notifierait trois bénévoles d'un fil vide. REMONTÉ : il n'existe
   * aucun `conversation.created` dans `DomainEventType`, et en inventer un sans
   * consommateur refarait `user.onboarded_location`, dont personne n'a écouté
   * l'événement pendant des mois.
   */
  async ensureCommunityModerationConversation(input: {
    readonly communityId: string;
    readonly communityName: string;
    readonly requesterUserId: string;
    /**
     * Le propriétaire et les modérateurs ACTIFS, tels que le module réseaux les
     * lit — BRUTS : le demandeur peut y figurer, et des doublons sont permis.
     * C'est ici que la liste est nettoyée, parce que c'est ici que se décide le
     * refus et qu'il doit en nommer la raison.
     */
    readonly teamUserIds: readonly string[];
  }): Promise<{ conversationId: string; created: boolean; recipients: number }> {
    const brute = [...new Set(input.teamUserIds)];
    const sansMoi = brute.filter((id) => id !== input.requesterUserId);

    /**
     * ── LES MEMBRES SÉPARÉS DU DEMANDEUR SONT ÉCARTÉS ────────────────────────
     *
     * §4, effet de LECTURE : « les deux ne se voient plus ». Un modérateur que
     * le demandeur a bloqué — ou qui l'a bloqué — n'a rien à faire dans un fil
     * que ce demandeur ouvre.
     *
     * ET CE N'EST PAS QUE DE LA DOCTRINE : sans ce filtre, un réseau à UN SEUL
     * modérateur séparé du demandeur produisait un fil à DEUX membres, et
     * `sendMessage` refuse d'écrire dans une conversation à deux entre deux
     * membres séparés (`BLOCKED_RELATIONSHIP`, la règle du §5.2). Le bouton
     * aurait ouvert un fil où le membre ne pouvait pas écrire — un cul-de-sac
     * qui ne se voit qu'après avoir cliqué sur « Envoyer ».
     */
    const separes = new Set(await this.visibility.separatedFrom(input.requesterUserId));
    const equipe = sansMoi.filter((id) => !separes.has(id));

    if (equipe.length === 0) {
      /**
       * TROIS RAISONS, ET L'ÉCRAN NE DIT PAS LA MÊME CHOSE POUR LES TROIS :
       *
       *   · `NO_TEAM` — le réseau n'a NI propriétaire NI modérateur. C'est le
       *     cas réel des réseaux AUTOMATIQUES de ville et de pays (07 §2.1 :
       *     « pas de créateur ; modérateurs = bénévoles nommés par l'équipe »)
       *     tant qu'aucun bénévole n'a été nommé. Il n'y a personne à joindre, et
       *     `POST /reports` — qui va à l'équipe de la PLATEFORME — est le bon
       *     chemin : c'est ce que le message d'erreur propose ;
       *   · `ONLY_ME` — le demandeur EST toute l'équipe. Un propriétaire sans
       *     modérateur qui clique sur le bouton de son propre réseau est dans ce
       *     cas, et il arrive pour de bon : la planche « À propos » de la vue
       *     propriétaire n'existe PAS sur mobile, donc un propriétaire sur
       *     téléphone voit la planche MEMBRE, bouton compris. Ouvrir un fil où
       *     il serait seul lui donnerait un carnet de notes déguisé ;
       *   · `SEPARATED` — il reste une équipe, mais le demandeur est séparé de
       *     tous. On ne nomme personne : dire « votre seul modérateur vous a
       *     bloqué » trahirait un blocage, que §4 ne notifie JAMAIS.
       */
      const raison = brute.length === 0 ? 'NO_TEAM' : sansMoi.length === 0 ? 'ONLY_ME' : 'SEPARATED';
      this.fail('NO_MODERATORS_TO_CONTACT', { reason: raison });
    }

    const attendus = new Set<string>([input.requesterUserId, ...equipe]);
    const now = new Date();

    const existante = await this.prisma.conversation.findFirst({
      where: {
        kind: 'COMMUNITY_MODERATION',
        communityId: input.communityId,
        openedByUserId: input.requesterUserId,
      },
      select: { id: true },
    });

    if (existante !== null) {
      /**
       * RIEN À METTRE À JOUR SUR LA CONVERSATION ELLE-MÊME, et il faut le dire :
       * son NOM n'est pas stocké. `PATCH /communities/:id` accepte `name`, donc
       * un réseau se renomme — et `listConversations` lit `community.name` à la
       * lecture plutôt que de recopier le nom dans la ligne. Un titre figé au
       * premier clic aurait vieilli en silence.
       */
      await this.prisma.$transaction((tx) => this.syncMembres(tx, existante.id, attendus, now));
      return { conversationId: existante.id, created: false, recipients: equipe.length };
    }

    const conversationId = newId();
    await this.prisma.$transaction(async (tx) => {
      await tx.conversation.create({
        data: {
          id: conversationId,
          kind: 'COMMUNITY_MODERATION',
          communityId: input.communityId,
          openedByUserId: input.requesterUserId,
          /**
           * `lastMessageAt` RESTE NUL — le fil n'a pas de message.
           *
           * `openDirect` le pose à `now` parce qu'il crée un message dans la
           * même transaction. Le poser ici ferait remonter en tête de
           * `GET /conversations` un fil dont `lastMessagePreview` vaut `null` :
           * la liste afficherait une ligne vide au-dessus de conversations
           * vivantes. Un fil sans message n'a pas de dernière activité.
           */
        },
      });
      await tx.conversationMember.createMany({
        data: [...attendus].map((userId) => ({ conversationId, userId, joinedAt: now })),
        skipDuplicates: true,
      });
    });

    this.logger.log(
      `Fil de modération ouvert sur « ${input.communityName} » : ${equipe.length} destinataire(s)`,
    );
    return { conversationId, created: true, recipients: equipe.length };
  }

  /**
   * Le titre d'un fil « Contacter les modérateurs » pour `lecteurId` — voir le
   * commentaire de `listConversations` : le nom du réseau, suivi, pour l'équipe,
   * du nom du membre qui a ouvert le fil.
   */
  private titreModeration(
    conversation: {
      readonly openedByUserId: string | null;
      readonly community: { readonly name: string } | null;
      readonly members: readonly {
        readonly userId: string;
        readonly leftAt: Date | null;
        readonly user: { readonly displayName: string; readonly handle: string; readonly deletedAt: Date | null };
      }[];
    },
    lecteurId: string,
  ): string | null {
    const reseau = conversation.community?.name ?? null;
    if (reseau === null) return null;
    const auteur = conversation.openedByUserId;
    if (auteur === null || auteur === lecteurId) return reseau;
    const membre = conversation.members.find(
      (m) => m.userId === auteur && m.leftAt === null && m.user.deletedAt === null,
    );
    if (membre === undefined) return reseau;
    const nom = membre.user.displayName.trim() === '' ? `@${membre.user.handle}` : membre.user.displayName.trim();
    return `${reseau} · ${nom}`;
  }

  /**
   * Met les membres d'une conversation de groupe en accord avec ce qu'on attend.
   *
   * EXTRAIT de `syncJourneyConversation`, dont le corps faisait exactement ceci
   * — ajouter les manquants, faire revenir ceux qui étaient sortis, faire sortir
   * ceux qui ne sont plus attendus. Le fil de modération en a besoin mot pour
   * mot : une équipe de réseau change comme change l'équipe d'un parcours.
   *
   * Idempotent : rejoué sur un état déjà juste, il n'écrit rien.
   */
  private async syncMembres(
    tx: Prisma.TransactionClient,
    conversationId: string,
    attendus: ReadonlySet<string>,
    now: Date,
  ): Promise<void> {
    const actuels = await tx.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true, leftAt: true },
    });
    const parId = new Map(actuels.map((m) => [m.userId, m]));

    for (const userId of attendus) {
      const ligne = parId.get(userId);
      if (ligne === undefined) {
        await tx.conversationMember.create({ data: { conversationId, userId, joinedAt: now } });
      } else if (ligne.leftAt !== null) {
        await tx.conversationMember.update({
          where: { conversationId_userId: { conversationId, userId } },
          data: { leftAt: null },
        });
      }
    }

    for (const ligne of actuels) {
      if (!attendus.has(ligne.userId) && ligne.leftAt === null) {
        await tx.conversationMember.update({
          where: { conversationId_userId: { conversationId, userId: ligne.userId } },
          data: { leftAt: now },
        });
      }
    }
  }

  // ── Consommateurs d'événements ────────────────────────────────────────────

  /**
   * §4, la part « messagerie » de la cascade de blocage :
   * « `conversation_members.left_at` sur les conversations DIRECT entre les deux ».
   *
   * Les DEUX lignes sont marquées, pas seulement celle du bloqué : §5.2 dit « un
   * blocage FERME la conversation », et ne fermer qu'un côté laisserait celui qui
   * a bloqué écrire dans un fil que l'autre ne lit plus.
   *
   * Seules les DIRECT, littéralement comme §4 le demande. Une conversation
   * JOURNEY commune reste ouverte — « les deux restent membres, contenus masqués
   * mutuellement » — et une conversation MENTORSHIP est protégée autrement : le
   * parrainage est terminé par la cascade, et `sendMessage` refuse d'écrire à un
   * membre séparé dans une conversation à deux.
   *
   * IDEMPOTENT : `updateMany` conditionné à `left_at: null`.
   */
  async handleUserBlocked(blockerUserId: string, blockedUserId: string): Promise<void> {
    // Le consommateur tourne après coup (outbox) : si le membre a déjà débloqué,
    // fermer la conversation maintenant la ferait pour rien (lot F2).
    const toujours = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerUserId, blockedUserId },
          { blockerUserId: blockedUserId, blockedUserId: blockerUserId },
        ],
      },
      select: { id: true },
    });
    if (toujours === null) return;
    const shared = await this.prisma.conversation.findMany({
      where: {
        kind: 'DIRECT',
        AND: [
          { members: { some: { userId: blockerUserId } } },
          { members: { some: { userId: blockedUserId } } },
        ],
      },
      select: { id: true },
    });
    if (shared.length === 0) return;

    const now = new Date();
    const ids = shared.map((c) => c.id);
    await this.prisma.$transaction(async (tx) => {
      const closed = await tx.conversationMember.updateMany({
        where: {
          conversationId: { in: ids },
          userId: { in: [blockerUserId, blockedUserId] },
          leftAt: null,
        },
        data: { leftAt: now },
      });
      if (closed.count === 0) return;
      await this.audit.record(tx, {
        actor: { type: 'SYSTEM' },
        action: 'conversation.closed_by_block',
        targetType: 'user',
        targetId: blockedUserId,
        metadata: { conversations: ids.length, membersClosed: closed.count },
      });
    });
  }

  /**
   * §11 : « Messages : supprimés pour le membre ; dans les conversations de
   * l'autre, remplacés par “Message d'un membre supprimé” (le corps est effacé, la
   * ligne reste pour la cohérence du fil). »
   *
   * Le corps est donc RÉELLEMENT effacé — remplacé par un scellé vide, la colonne
   * étant NOT NULL — et non simplement masqué à l'affichage. C'est une suppression
   * au sens du RGPD, pas un drapeau.
   */
  async handleUserDeleted(userId: string): Promise<void> {
    const emptied = this.crypto.encryptContent('');
    const now = new Date();

    const messages = await this.prisma.message.findMany({
      where: { senderUserId: userId, deletedAt: null },
      select: { id: true },
    });

    await this.prisma.$transaction(async (tx) => {
      for (const message of messages) {
        await tx.message.update({
          where: { id: message.id },
          data: { deletedAt: now, bodyEncrypted: emptied, mediaAssetId: null },
        });
      }
      await tx.conversationMember.updateMany({
        where: { userId, leftAt: null },
        data: { leftAt: now },
      });
    });

    if (messages.length > 0) {
      this.logger.log(`${messages.length} message(s) effacé(s) pour un compte supprimé (§11)`);
    }
  }

  // ── Interne ───────────────────────────────────────────────────────────────

  /**
   * L'état « demande de conversation » de §5.2, DÉDUIT.
   *
   * `conversations.pending_from_user_id` (§6, « Ajoutée ») n'existe ni dans
   * `packages/db/prisma/schema` ni en base. Trois faits, tous déjà stockés, le
   * remplacent :
   *
   *   1. la relation est-elle FROIDE ? `permissionFor()` la réévalue à chaque
   *      appel — contact, parrainage, réponse privée, « Saluer » lèvent la règle.
   *      Une conversation ouverte à froid puis devenue contact cesse donc d'être
   *      une demande, ce qui est le comportement souhaitable ;
   *   2. le destinataire a-t-il ÉCRIT ? une réponse vaut acceptation (§5.2 : « sans
   *      réponse, pas de second message ») ;
   *   3. a-t-il ACCEPTÉ explicitement ? `last_read_at` le porte (`acceptDirect`).
   *
   * La limite assumée de cette déduction : une conversation ouverte à froid entre
   * deux membres qui deviennent contacts plus tard n'est plus « en attente »,
   * alors que la colonne l'aurait gardée. C'est le seul écart, et il va dans le
   * sens de la permission — jamais dans celui de l'ouverture d'un démarchage.
   */
  private async pendingState(conversationId: string, viewerId: string): Promise<PendingState> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        kind: true,
        members: { select: { userId: true, lastReadAt: true } },
      },
    });
    if (conversation === null || conversation.kind !== 'DIRECT') {
      return { pending: false, initiatorUserId: null };
    }
    if (conversation.members.length !== 2) return { pending: false, initiatorUserId: null };

    const me = conversation.members.find((m) => m.userId === viewerId);
    const other = conversation.members.find((m) => m.userId !== viewerId);
    if (me === undefined || other === undefined) return { pending: false, initiatorUserId: null };

    if ((await this.permissionFor(viewerId, other.userId)) !== 'COLD') {
      return { pending: false, initiatorUserId: null };
    }

    const [mine, theirs] = await Promise.all([
      this.prisma.message.count({ where: { conversationId, senderUserId: viewerId } }),
      this.prisma.message.count({ where: { conversationId, senderUserId: other.userId } }),
    ]);

    if (mine > 0 && theirs === 0 && other.lastReadAt === null) {
      return { pending: true, initiatorUserId: viewerId };
    }
    if (theirs > 0 && mine === 0 && me.lastReadAt === null) {
      return { pending: true, initiatorUserId: other.userId };
    }
    return { pending: false, initiatorUserId: null };
  }

  /**
   * §5.2, la table « Qui peut écrire à qui ».
   *
   * `COLD` n'est pas un refus : c'est la « une fois » de la dernière ligne du
   * tableau. Ce qu'elle change, c'est que le second message attend une réponse.
   */
  async permissionFor(senderId: string, targetId: string): Promise<DirectPermission> {
    if (await this.connections.areConnected(senderId, targetId)) return 'CONTACT';

    const mentorship = await this.prisma.mentorship.findFirst({
      where: {
        status: { in: ['ACTIVE', 'REQUESTED', 'ACCEPTED'] },
        OR: [
          { mentorUserId: senderId, menteeUserId: targetId },
          { mentorUserId: targetId, menteeUserId: senderId },
        ],
      },
      select: { id: true },
    });
    if (mentorship !== null) return 'MENTORSHIP';

    // « L'auteur d'une demande d'entraide (réponse privée) » : écrire à quelqu'un
    // qui a demandé de l'aide est permis — c'est le geste que 06 §2 encourage.
    const helpRequest = await this.prisma.helpRequest.findFirst({
      where: { authorUserId: targetId, deletedAt: null },
      select: { id: true },
    });
    if (helpRequest !== null) return 'HELP_REPLY';

    // « Un nouvel arrivant via Saluer ».
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { phase: true },
    });
    if (target?.phase === 'RECENT_ARRIVAL') return 'GREET';

    return 'COLD';
  }

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LE NIVEAU NE FERME PLUS LA MESSAGERIE — ARBITRAGE DU PORTEUR            ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Ce garde refusait toute conversation DIRECT à un L0, en écho au tableau §5.2
   * (« L0 → Personne »). Le porteur l'a rencontré en lisant une story et a demandé
   * de l'ouvrir ; la décision et ce qu'elle coûte sont écrites une seule fois, sur
   * `message.send` dans `capabilities.ts`.
   *
   * La fonction reste, VIDE DE SON TEST DE NIVEAU, et c'est délibéré : elle est
   * appelée aux DEUX endroits où une DIRECT naît ou reçoit un message
   * (`openDirect`, `sendMessage`), et c'est là que se poseront les prochaines
   * conditions d'envoi. La retirer disperserait la question le jour où il faudra y
   * répondre de nouveau — et c'est aussi le seul point à rouvrir pour revenir en
   * arrière.
   *
   * CE QUI RETIENT ENCORE : le premier message à un inconnu ouvre une conversation
   * EN ATTENTE (`pendingState`), et sans réponse il n'y a pas de second message ;
   * vingt nouvelles conversations par jour ; soixante messages par minute.
   */
  private assertCanSendDirect(_actor: MessagingActor): void {
    /* Aucune condition de niveau : voir l'en-tête. */
  }

  /** §5.3 : « 60 messages/minute ». */
  private async assertMessageRate(userId: string): Promise<void> {
    const since = new Date(Date.now() - MESSAGE_RATE_WINDOW_MS);
    const sent = await this.prisma.message.count({
      where: { senderUserId: userId, sentAt: { gte: since } },
    });
    if (sent >= MESSAGES_PER_MINUTE) {
      this.fail('MESSAGE_RATE_LIMIT', { max: MESSAGES_PER_MINUTE });
    }
  }

  /**
   * §5.3 : « 20 nouvelles conversations/jour ».
   *
   * Compte celles que J'AI ouvertes, et non celles où je figure : l'initiateur est
   * l'auteur du PREMIER message. Compter les secondes punirait un membre sollicité
   * par vingt personnes, alors que la borne visait le démarchage.
   */
  private async assertConversationQuota(userId: string): Promise<void> {
    const since = new Date(Date.now() - NEW_CONVERSATIONS_WINDOW_MS);
    const recent = await this.prisma.conversation.findMany({
      where: {
        kind: 'DIRECT',
        createdAt: { gte: since },
        members: { some: { userId } },
      },
      select: {
        id: true,
        messages: { orderBy: { id: 'asc' }, take: 1, select: { senderUserId: true } },
      },
    });
    const opened = recent.filter((c) => c.messages[0]?.senderUserId === userId).length;
    if (opened >= NEW_CONVERSATIONS_PER_DAY) {
      this.fail('CONVERSATION_LIMIT', { max: NEW_CONVERSATIONS_PER_DAY });
    }
  }

  /** La DIRECT de cette paire, s'il y en a une. §5.1 : « unique par paire ». */
  private async findDirectBetween(one: string, other: string): Promise<string | null> {
    const found = await this.prisma.conversation.findFirst({
      where: {
        kind: 'DIRECT',
        AND: [{ members: { some: { userId: one } } }, { members: { some: { userId: other } } }],
      },
      select: { id: true },
    });
    return found?.id ?? null;
  }

  /** Ma ligne de membre, ou 404 — jamais 403 (T4 §3). */
  private async memberOf(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        kind: true,
        members: { select: { userId: true, leftAt: true, lastReadAt: true } },
      },
    });
    if (conversation === null) throw ApiError.notFound();
    const member = conversation.members.find((m) => m.userId === userId);
    if (member === undefined) throw ApiError.notFound();
    return { conversation, member };
  }

  /**
   * La pièce jointe d'un message : propriétaire, genre, ET STATUT.
   *
   * [RÈGLE DURE] LE STATUT MANQUAIT, et c'est la correction de ce lot.
   *
   * Le propriétaire et le genre étaient bien vérifiés ; `status` ne l'était pas,
   * et il n'était même pas SÉLECTIONNÉ. Une pièce jointe refusée par l'antivirus
   * (`status = 'REJECTED'`) était donc rattachable à un message — et sa clé de
   * stockage est RÉSERVÉE SANS OCTETS DESSOUS : le destinataire aurait reçu un
   * message portant une image que rien ne peut servir. Un média encore en analyse
   * (`PENDING`/`SCANNING`) passait tout autant.
   *
   * Les deux refus ne sont pas du même ordre, et c'est l'arbitrage du fil
   * (`feed.resolveMedia`) qu'on reprend ici pour que les deux points de
   * rattachement se refusent de la même façon :
   *
   *   - **propriétaire, suppression, genre → 404.** Ils vivent dans le `where`.
   *     Un refus nommé apprendrait qu'un média de genre protégé existe sous cet
   *     identifiant ; le genre ne doit pas devenir un oracle.
   *   - **statut → 400.** Le membre vient d'envoyer ce fichier et sait qu'il
   *     existe ; un 404 l'enverrait chercher un identifiant perdu alors que son
   *     envoi est seulement en cours d'analyse, ou refusé.
   *
   * Ceci REMPLACE un `WRONG_MEDIA_KIND` (400) qui n'était référencé nulle part
   * ailleurs dans le dépôt et qu'aucun test ne figeait.
   */
  /**
   * L'adresse publique d'un média joint, ou `null`.
   *
   * `/media/<clé>` : le même composé que `feed.service.ts`, `housing.service.ts`
   * et `users.service.ts`. Il n'est pas factorisé entre les cinq modules, et c'est
   * un écart REMONTÉ plutôt que corrigé ici — `media.service.ts` l'écrit lui-même :
   * « `users.service.ts`, `housing.service.ts`, `feed.service.ts` et
   * `communities.service.ts` construisent tous `/media/<clé>` à partir d'elle ».
   * Un cinquième endroit n'aggrave pas le problème, mais le déplacer est un lot à
   * part : cinq modules à retoucher pour une concaténation.
   *
   * UN MÉDIA SUPPRIMÉ REND `null`. La relation est `onDelete: SetNull`, donc une
   * suppression dure fait disparaître `mediaId` aussi ; une suppression DOUCE, en
   * revanche, laisse `mediaId` renseigné et son objet retiré du seau. L'écran voit
   * alors « il y avait une image, elle n'est plus là » — ce qui est vrai — au lieu
   * d'une vignette cassée.
   */
  private urlDuMedia(asset: { storageKey: string; deletedAt: Date | null } | null): string | null {
    if (asset === null || asset.deletedAt !== null) return null;
    return `/media/${asset.storageKey}`;
  }

  private async assertOwnedMedia(userId: string, mediaId: string): Promise<void> {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: mediaId, ...ownedAttachableWhere('message', userId) },
      select: { status: true },
    });
    if (asset === null) throw ApiError.notFound();
    if (asset.status !== REQUIRED_MEDIA_STATUS) {
      throw ApiError.validation([{ path: 'mediaId', code: 'MEDIA_NOT_READY' }]);
    }
  }

  /**
   * Le kind de §6 (`messages.kind`, colonne absente du schéma figé), DÉDUIT.
   *
   * `IMAGE` quand une image accompagne le message, `TEXT` sinon. `SYSTEM` n'est
   * pas représentable sans la colonne, et aucune route n'en produit : un message
   * système écrit aujourd'hui serait indistinguable d'un message du membre.
   */
  private kindOf(message: { mediaAssetId: string | null }): MessageKind {
    return message.mediaAssetId === null ? 'TEXT' : 'IMAGE';
  }

  private bodyOf(
    message: { bodyEncrypted: Uint8Array; deletedAt: Date | null; sender: { deletedAt: Date | null } },
    hidden: boolean,
  ): string | null {
    if (hidden) return null;
    if (message.sender.deletedAt !== null) return MESSAGE_DELETED_USER_PLACEHOLDER;
    if (message.deletedAt !== null) return MESSAGE_DELETED_PLACEHOLDER;
    return this.crypto.decryptContent(message.bodyEncrypted);
  }

  private preview(
    message: {
      bodyEncrypted: Uint8Array;
      deletedAt: Date | null;
      mediaAssetId: string | null;
      sender: { deletedAt: Date | null };
    },
    hidden: boolean,
  ): string | null {
    const body = this.bodyOf(message, hidden);
    if (body === null) return null;
    /**
     * UNE IMAGE SEULE SE DIT, elle ne se tait pas.
     *
     * Depuis que `sendMessageSchema` accepte un message SANS corps — il le
     * fallait pour envoyer plusieurs photos sans écrire autant de phrases — la
     * ligne de la liste serait restée VIDE : le membre aurait vu un nom, une
     * heure, et rien. « Photo » est ce que Messenger, WhatsApp et Signal écrivent
     * tous les trois à cet endroit.
     *
     * Ce n'est PAS un substitut inventé à un corps manquant : il n'y a pas de
     * corps, et c'est une image. On dit ce qui est.
     */
    if (body === '' && message.mediaAssetId !== null) return 'Photo';
    return body.length > CONVERSATION_PREVIEW_MAX
      ? `${body.slice(0, CONVERSATION_PREVIEW_MAX - 1)}…`
      : body;
  }

  private isVisible(user: { deletedAt: Date | null; status: string }): boolean {
    return user.deletedAt === null && user.status !== 'DELETED' && user.status !== 'DEACTIVATED';
  }
}
