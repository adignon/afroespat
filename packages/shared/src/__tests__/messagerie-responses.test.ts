import { describe, expect, it } from 'vitest';
import {
  CONVERSATION_PREVIEW_MAX,
  conversationsResponseSchema,
  groupedSearchResponseSchema,
  messagesResponseSchema,
  notificationsResponseSchema,
  suggestResponseSchema,
} from '../index.js';

/**
 * ─── LES SCHÉMAS DE LA MESSAGERIE, DE LA RECHERCHE ET DES NOTIFICATIONS ─────
 *
 * Les charges de ce fichier ont été RELEVÉES OCTET POUR OCTET sur l'API qui tourne
 * (port 3194), avec deux membres créés pour l'occasion, une vraie conversation
 * directe et trois notifications réelles. Aucun champ n'est déduit du code d'un
 * service — c'est la leçon de `compte-responses.test.ts`, où un schéma écrit en
 * lisant le SERVICE avait manqué l'enveloppe posée par le CONTRÔLEUR, et où le
 * défaut n'est apparu qu'au navigateur.
 *
 * ── LA RÈGLE LA PLUS GRAVE DE CE MODULE, ET C'EST ICI QU'ELLE SE TIENT ──────
 *
 * LE CORPS DES MESSAGES EST CHIFFRÉ — AU REPOS, pas de bout en bout (00 §8.1) : la
 * modération doit pouvoir lire une conversation signalée. Mesuré sur la base qui
 * tourne, pas supposé : la colonne `messages.body_encrypted` ne contient AUCUNE
 * occurrence du texte écrit (`… LIKE '%Garibaldi%'` → 0 ligne), et son contenu est
 * un bloc d'octets (`74d3764a593ccfaf…`). Le service descelle avant de répondre, en
 * un seul endroit, et ce qui circule sur le fil est du TEXTE CLAIR — les charges
 * ci-dessous en sont la preuve relevée.
 *
 * Il en découle DEUX obligations pour le front, et ce fichier les tient toutes deux :
 *
 *   1. l'écran n'a RIEN à déchiffrer, et ne doit rien pouvoir déchiffrer. Un champ
 *      de trop sur une forme de messagerie — `bodyEncrypted`, `bodyCipher`,
 *      `lastMessageBody` non coupé — est une FUITE, jamais un enrichissement.
 *      `.strict()` le fait REFUSER à la frontière ; sans lui, zod le dépouille EN
 *      SILENCE et les octets ont déjà traversé le réseau sans que rien ne le dise ;
 *   2. une notification de message ne porte JAMAIS le corps (12 §2.4, 08 §8.1). Le
 *      back le tient à trois étages — l'événement de domaine ne porte que des
 *      identifiants, la passerelle temps réel publie `message.new` avec deux ids, et
 *      `onMessageSent` écrit `body: null`. Mais AUCUN de ces trois garde-fous n'est
 *      au CONTACT de l'écran, et il n'existe aucun intercepteur de validation de
 *      réponse côté API (compté : zéro `APP_INTERCEPTOR`). Le `refine` de
 *      `notificationSchema` est donc le seul contrôle entre un extrait de message et
 *      la page X02 qui l'afficherait.
 */

// ── Charges relevées sur l'API (port 3194) ──────────────────────────────────

/** `GET /v1/conversations` — une conversation directe, un message non lu. */
const CONVERSATIONS = {
  items: [
    {
      id: '01a0f8d8-b504-7000-baa1-fcf0787b4d6a',
      kind: 'DIRECT',
      title: null,
      members: [
        {
          userId: '01a0f8d8-6bcb-7000-8f0c-acd34ac9a2b6',
          handle: 'm01a0f8d86bcb70008f0cacd34ac9a',
          displayName: 'Kofi Boateng',
          avatarUrl: null,
          hidden: false,
          leftAt: null,
        },
      ],
      lastMessageAt: '2026-10-01T19:02:26.941Z',
      // DÉSCELLÉ PAR LE SERVEUR : c'est le texte que le membre a écrit.
      lastMessagePreview: 'Oui avec plaisir, je t’envoie tout.',
      unreadCount: 1,
      // Ajouté par le serveur après le relevé d'origine (`messaging.service.ts`,
      // `muted: mienne?.isMuted ?? false`) : la charge relevée est mise à jour,
      // le schéma strict exige bien le champ.
      muted: false,
      pendingForMe: false,
      awaitingReply: false,
    },
  ],
  nextCursor: null,
  meta: { unreadTotal: 1 },
};

/** `GET /v1/conversations/:id/messages` — trois messages, du plus récent au plus ancien. */
const MESSAGES = {
  items: [
    {
      id: '01a0f8d8-b57d-7000-9d1e-703034ef5fa9',
      senderUserId: '01a0f8d8-66fa-7000-adf9-f7630d73c3b8',
      senderHandle: 'm01a0f8d866fa7000adf9f7630d73c',
      kind: 'TEXT',
      body: 'Oui avec plaisir, je t’envoie tout.',
      mediaId: null,
      mediaUrl: null,
      // `storyId`/`storyAlive` : servis par `messaging.service.ts` (null/false hors
      // story) ; le relevé d'origine les précédait.
      storyId: null,
      storyAlive: false,
      sentAt: '2026-10-01T19:02:26.941Z',
      deletedAt: null,
      mine: true,
    },
    {
      id: '01a0f8d8-b564-7000-a6b8-cdbea08b9dd6',
      senderUserId: '01a0f8d8-6bcb-7000-8f0c-acd34ac9a2b6',
      senderHandle: 'm01a0f8d86bcb70008f0cacd34ac9a',
      kind: 'TEXT',
      body: 'Avec Visale ça passe. Tu veux que je relise ton dossier ce soir ?',
      mediaId: null,
      mediaUrl: null,
      // `storyId`/`storyAlive` : servis par `messaging.service.ts` (null/false hors
      // story) ; le relevé d'origine les précédait.
      storyId: null,
      storyAlive: false,
      sentAt: '2026-10-01T19:02:26.916Z',
      deletedAt: null,
      mine: false,
    },
  ],
  nextCursor: null,
  meta: { kind: 'DIRECT', pendingForMe: false, awaitingReply: false, seenAt: null },
};

/** `GET /v1/notifications` — trois lignes réelles, dont une de catégorie MESSAGE. */
const NOTIFICATIONS = {
  items: [
    {
      id: '01a0bbbb-0000-7000-8000-000000000001',
      createdAt: '2026-10-01T18:53:19.949Z',
      category: 'SOCIAL',
      type: 'social.reaction_received',
      title: 'Sandra et 4 autres',
      body: 'ont trouve votre conseil utile',
      refType: 'POST',
      refId: null,
      url: null,
      readAt: null,
      channelsSent: ['IN_APP'],
    },
    {
      id: '01a0bbbb-0000-7000-8000-000000000003',
      createdAt: '2026-10-01T16:58:19.949Z',
      category: 'MESSAGE',
      type: 'message.received',
      title: 'Nouveau message de Kofi Boateng',
      // LA RÈGLE, EN UNE VALEUR : nul, et il doit l'être.
      body: null,
      refType: 'CONVERSATION',
      refId: null,
      url: null,
      readAt: null,
      channelsSent: ['IN_APP', 'PUSH'],
    },
  ],
  nextCursor: null,
  meta: { unread: 2 },
};

/**
 * `GET /v1/search/suggest` — enveloppe À PART : ni `nextCursor` ni `meta`.
 *
 * `subjectId` ET `url` ONT ÉTÉ AJOUTÉS À CETTE CHARGE, et relevés comme le reste :
 * une proposition était dessinée sans être cliquable, faute de savoir où elle mène.
 * Forme relevée sur l'API qui tourne :
 *
 *   { "title": "Visite guidée du quartier", "subjectType": "EVENT",
 *     "subjectId": "01a11020-…", "url": "/agenda/01a11020-…" }
 *
 * `url` est NULLABLE : un type de sujet sans page dédiée rend `null`, et l'écran
 * dessine alors la proposition sans lien plutôt qu'un lien mort.
 */
const SUGGESTIONS = {
  items: [
    {
      title: 'visale étudiant',
      subjectType: 'GUIDE',
      subjectId: '01a0f8d8-0000-7000-8000-000000000002',
      url: '/guides/obtenir-la-garantie-visale-sans-cdi',
    },
  ],
};

/** `GET /v1/search` sans `type` — des GROUPES, et `nextCursor` toujours nul. */
const RECHERCHE_GROUPEE = {
  items: [
    {
      type: 'GUIDE',
      label: 'Guides',
      count: 5,
      capped: false,
      items: [
        {
          id: '01a0f8d8-0000-7000-8000-000000000001',
          subjectType: 'GUIDE',
          subjectId: '01a0f8d8-0000-7000-8000-000000000002',
          title: 'Obtenir la garantie Visale sans CDI',
          excerpt: 'La garantie Visale couvre les loyers impayés…',
          cityId: null,
          countryId: null,
          communityId: null,
          rank: 0.84,
          updatedAt: '2026-09-12T08:00:00.000Z',
          /**
           * OÙ MÈNE CE RÉSULTAT — le champ manquait, et les cartes de `/recherche`
           * n'étaient donc pas cliquables. Résolu par le SERVEUR, une requête par
           * type présent, jamais deviné par l'écran : seul le serveur connaît le
           * `slug` d'un guide et le `handle` d'un membre. Forme relevée sur l'API :
           * `"url": "/services/logement/01a11025-…"` pour un logement.
           */
          url: '/guides/obtenir-la-garantie-visale-sans-cdi',
          subline: '84 utiles',
        },
      ],
    },
  ],
  nextCursor: null,
  meta: { q: 'visale', normalized: 'visale' },
};

// ── Les charges réelles passent ─────────────────────────────────────────────

describe('les charges relevées sur l’API', () => {
  it('`GET /conversations` est acceptée telle quelle', () => {
    expect(() => conversationsResponseSchema.parse(CONVERSATIONS)).not.toThrow();
  });

  it('`GET /conversations/:id/messages` est acceptée telle quelle', () => {
    expect(() => messagesResponseSchema.parse(MESSAGES)).not.toThrow();
  });

  it('`GET /notifications` est acceptée telle quelle', () => {
    expect(() => notificationsResponseSchema.parse(NOTIFICATIONS)).not.toThrow();
  });

  it('`GET /search/suggest` est acceptée SANS `nextCursor` ni `meta`', () => {
    expect(() => suggestResponseSchema.parse(SUGGESTIONS)).not.toThrow();
  });

  it('`GET /search` groupée est acceptée, ses items étant des GROUPES', () => {
    const page = groupedSearchResponseSchema.parse(RECHERCHE_GROUPEE);
    // Ce que le groupé porte VRAIMENT : pas de `title` à la racine d'un item.
    expect(page.items[0]?.label).toBe('Guides');
    expect(page.items[0]?.items[0]?.title).toBe('Obtenir la garantie Visale sans CDI');
  });
});

// ── Une charge amputée est REFUSÉE ──────────────────────────────────────────

describe('une charge amputée est refusée', () => {
  it('une conversation sans `unreadCount` est refusée', () => {
    const ampute = {
      ...CONVERSATIONS,
      items: [{ ...CONVERSATIONS.items[0], unreadCount: undefined }],
    };
    expect(() => conversationsResponseSchema.parse(ampute)).toThrow();
  });

  it('une enveloppe sans `meta.unreadTotal` est refusée', () => {
    expect(() => conversationsResponseSchema.parse({ ...CONVERSATIONS, meta: {} })).toThrow();
  });

  it('un message sans `mine` est refusé — le fil ne saurait plus de quel côté poser la bulle', () => {
    const ampute = { ...MESSAGES, items: [{ ...MESSAGES.items[0], mine: undefined }] };
    expect(() => messagesResponseSchema.parse(ampute)).toThrow();
  });

  it('`nextCursor` absent est refusé : une pagination muette passerait pour une fin de liste', () => {
    const { nextCursor: _, ...sansCurseur } = NOTIFICATIONS;
    expect(() => notificationsResponseSchema.parse(sansCurseur)).toThrow();
  });
});

// ── LA RÈGLE DU CHIFFREMENT, ET SES DEUX MOITIÉS ────────────────────────────

describe('le corps des messages ne fuit pas', () => {
  /**
   * PREMIÈRE MOITIÉ — 12 §2.4 : « un push MESSAGE ne contient jamais le corps du
   * message ».
   *
   * C'est LE test de ce fichier. Il ne décrit pas une forme : il décrit un REFUS.
   * Si `notificationSchema` perdait son `refine`, une notification de message
   * portant un extrait traverserait la frontière et la page X02 l'afficherait —
   * c'est-à-dire le corps d'un message privé lisible sans ouvrir la conversation,
   * et sur un écran verrouillé si la ligne part aussi en push.
   */
  it('[lot F] une notification retenue par les heures calmes (PUSH_DEFERRED) est ACCEPTÉE — sinon la page X02 et la cloche tombent', () => {
    const calme = {
      ...NOTIFICATIONS,
      items: [{ ...NOTIFICATIONS.items[0], url: '/messages/abc', channelsSent: ['IN_APP', 'PUSH_DEFERRED'] }],
    };
    expect(notificationsResponseSchema.parse(calme).items[0]?.channelsSent).toContain('PUSH_DEFERRED');
  });

  it('[lot F] `url` doit être un chemin relatif du front, jamais une adresse absolue', () => {
    const ext = { ...NOTIFICATIONS, items: [{ ...NOTIFICATIONS.items[0], url: 'https://evil.example/x' }] };
    expect(() => notificationsResponseSchema.parse(ext)).toThrow();
  });

  it('une notification MESSAGE portant un corps est REFUSÉE', () => {
    const fuite = {
      ...NOTIFICATIONS,
      items: [
        {
          ...NOTIFICATIONS.items[1],
          body: 'J’ai visité le studio de la rue Garibaldi, ils demandent un garant.',
        },
      ],
    };
    expect(() => notificationsResponseSchema.parse(fuite)).toThrow(/MESSAGE/);
  });

  it('la MÊME ligne avec `body: null` est acceptée — c’est le corps qui est refusé, pas la catégorie', () => {
    const correcte = { ...NOTIFICATIONS, items: [NOTIFICATIONS.items[1]] };
    expect(() => notificationsResponseSchema.parse(correcte)).not.toThrow();
  });

  it('une AUTRE catégorie peut porter un corps — la règle ne vise que les messages', () => {
    const social = { ...NOTIFICATIONS, items: [NOTIFICATIONS.items[0]] };
    expect(() => notificationsResponseSchema.parse(social)).not.toThrow();
  });

  /**
   * SECONDE MOITIÉ — un champ greffé est une FUITE, et `.strict()` le refuse.
   *
   * Sans `.strict()`, zod DÉPOUILLE en silence : l'objet validé n'aurait pas le
   * champ, mais les octets auraient quitté le serveur, traversé le réseau et atteint
   * le navigateur — et aucun test, aucun type, aucun lint ne l'aurait dit.
   */
  it('un `bodyEncrypted` greffé sur un message est REFUSÉ, pas dépouillé', () => {
    const greffe = {
      ...MESSAGES,
      items: [{ ...MESSAGES.items[0], bodyEncrypted: 'dGQzdjZhNTkzY2NmYWY=' }],
    };
    expect(() => messagesResponseSchema.parse(greffe)).toThrow();
  });

  it('un `lastMessageBody` greffé sur une conversation est REFUSÉ', () => {
    const greffe = {
      ...CONVERSATIONS,
      items: [{ ...CONVERSATIONS.items[0], lastMessageBody: 'le corps entier, non coupé' }],
    };
    expect(() => conversationsResponseSchema.parse(greffe)).toThrow();
  });

  it('un `preview` greffé sur une notification est REFUSÉ', () => {
    const greffe = {
      ...NOTIFICATIONS,
      items: [{ ...NOTIFICATIONS.items[1], preview: 'les premiers mots du message' }],
    };
    expect(() => notificationsResponseSchema.parse(greffe)).toThrow();
  });

  /**
   * L'APERÇU EST COUPÉ PAR LE SERVEUR, et le schéma le vérifie.
   *
   * §7.3 : la dernière ligne est tronquée à `CONVERSATION_PREVIEW_MAX`. Un serveur
   * qui se mettrait à renvoyer le corps ENTIER enverrait, pour chaque conversation
   * de la liste, jusqu'à 4 000 caractères de message privé — sur un écran qui n'en
   * montre qu'une ligne. La borne est donc une règle, pas une mise en forme.
   */
  it('un aperçu plus long que la borne partagée est REFUSÉ', () => {
    const tropLong = {
      ...CONVERSATIONS,
      items: [
        { ...CONVERSATIONS.items[0], lastMessagePreview: 'x'.repeat(CONVERSATION_PREVIEW_MAX + 1) },
      ],
    };
    expect(() => conversationsResponseSchema.parse(tropLong)).toThrow();
  });
});
