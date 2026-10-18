import { z } from 'zod';
import { cursorQuerySchema, uuidSchema } from './pagination.js';

/**
 * Notifications — 12-notifications.md.
 *
 * SOURCE UNIQUE (00 §4) : la matrice catégorie × canal du §2.1 est ici, et nulle
 * part ailleurs. Le back décide des canaux avec `channelAllowed`, le front dessine
 * la grille des réglages avec `NOTIFICATION_CATEGORIES` et
 * `CATEGORY_CHANNELS`. Recopier la matrice côté front la ferait diverger au
 * premier ajustement, et c'est l'écran de réglages qui mentirait sur ce que le
 * membre reçoit.
 *
 * TROIS CHOSES que ce fichier porte et qui ne sont pas de simples schémas :
 *
 *   · la RÈGLE DURE du §2.1 — « aucun email n'est jamais envoyé pour la catégorie
 *     SOCIAL ». Elle est le PREMIER test de `channelAllowed`, avant toute lecture
 *     de préférence, pour qu'aucun chemin ne puisse la contourner ;
 *   · les restrictions PAR TYPE. Le tableau du §2.1 ne dit pas « HELP : push »,
 *     il dit « push (réponse) ». Un booléen par catégorie perdrait cette nuance
 *     et enverrait un push pour « vous pouvez aider », que la spec réserve à
 *     l'in-app ;
 *   · les catégories NON DÉSACTIVABLES du §2.2 (`ACCOUNT` sécurité, `MODERATION`).
 *     Elles ignorent les préférences, et c'est volontaire : un membre sanctionné
 *     ne doit pas pouvoir se rendre injoignable.
 */

// ── Catégories et canaux (§2.1) ───────────────────────────────────────────────

/**
 * Les quatorze catégories du tableau du §2.1.
 *
 * CONTRADICTION ASSUMÉE : le commentaire de `notifications.category` dans le
 * schéma n'en énumère que dix — il oublie `MESSAGE`, `GUIDE`, `EVENT` et
 * `DIGEST`, qui ont pourtant chacun leur ligne dans le tableau. La colonne est un
 * `String` libre, donc la spec fait foi et cette liste est la sienne.
 */
export const NOTIFICATION_CATEGORIES = [
  'JOURNEY_DEADLINE',
  'JOURNEY_TEAM',
  'HELP',
  'MENTORSHIP',
  'MESSAGE',
  'SOCIAL',
  'GUIDE',
  'COMMUNITY',
  'EVENT',
  'SERVICES',
  'BOOKMARK',
  'ACCOUNT',
  'MODERATION',
  'DIGEST',
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

/**
 * Les trois canaux. `IN_APP` n'est pas dans l'enum `NotificationChannel` du schéma
 * — celui-ci ne couvre que les envois SORTANTS (`outbound_messages`) — mais c'est
 * bien un canal du §2.1, et `notifications.channels_sent` l'emploie.
 */
export const NOTIFICATION_DELIVERY_CHANNELS = ['IN_APP', 'PUSH', 'EMAIL'] as const;
export type NotificationDeliveryChannel = (typeof NOTIFICATION_DELIVERY_CHANNELS)[number];

/**
 * Marqueur transitoire de `channels_sent` : un push DIFFÉRÉ par les heures calmes.
 *
 * Pourquoi dans cette colonne et pas dans `outbound_messages` : cette table ne
 * porte AUCUNE charge utile (ni titre, ni corps, ni lien), donc un push qui y
 * attendrait serait impossible à composer une heure plus tard. La notification,
 * elle, porte déjà son titre, son corps et sa référence — la tâche horaire
 * `notifications.quiet_hours_flush` en rejoue le push et remplace ce marqueur par
 * `PUSH`. Durable, contrairement à un délai posé dans Redis.
 */
export const PUSH_DEFERRED = 'PUSH_DEFERRED';

interface CategoryChannels {
  /** Toujours vrai sauf `DIGEST`, qui n'existe que par email (§2.1). */
  readonly inApp: boolean;
  /** `true` = tous les types ; une liste = seulement ces types ; `false` = jamais. */
  readonly push: boolean | readonly string[];
  readonly email: boolean | readonly string[];
}

/**
 * La matrice du §2.1, au mot.
 *
 * Les listes de types transcrivent les parenthèses de la spec : « ✓ (réponse) »,
 * « ✓ (J−1 seulement) », « annonce », « alerte », « événement ».
 */
export const CATEGORY_CHANNELS: Record<NotificationCategory, CategoryChannels> = {
  JOURNEY_DEADLINE: { inApp: true, push: true, email: ['journey.step_due_j1'] },
  JOURNEY_TEAM: { inApp: true, push: true, email: false },
  HELP: { inApp: true, push: ['help.response_received'], email: false },
  MENTORSHIP: { inApp: true, push: true, email: ['mentorship.request_received'] },
  MESSAGE: { inApp: true, push: true, email: false },
  // RÈGLE DURE : jamais d'email. Et pas de push non plus — le tableau laisse la
  // colonne vide, et c'est ce qui rend le regroupement supportable.
  SOCIAL: { inApp: true, push: false, email: false },
  GUIDE: { inApp: true, push: false, email: ['guide.proposal_received'] },
  COMMUNITY: { inApp: true, push: ['community.announcement'], email: false },
  EVENT: { inApp: true, push: true, email: false },
  SERVICES: { inApp: true, push: ['services.alert_match'], email: false },
  BOOKMARK: { inApp: true, push: ['bookmark.event_tomorrow'], email: false },
  ACCOUNT: { inApp: true, push: true, email: true },
  MODERATION: { inApp: true, push: false, email: true },
  DIGEST: { inApp: false, push: false, email: true },
};

/**
 * §2.2 : « Certaines ne sont pas désactivables : `ACCOUNT` sécurité (in-app +
 * email), `MODERATION`. »
 *
 * `ACCOUNT` sécurité est une AFFAIRE DE TYPE, pas de catégorie : un changement de
 * niveau est un `ACCOUNT` ordinaire, désactivable. D'où cette liste explicite
 * plutôt qu'un drapeau sur la catégorie.
 */
export const ACCOUNT_SECURITY_TYPES = [
  'account.security_new_device',
  'account.deletion_requested',
  'account.deleted',
] as const;

/** Les catégories dont AUCUN canal ne se désactive. */
export const NON_DISABLEABLE_CATEGORIES: readonly NotificationCategory[] = ['MODERATION'];

/** Un type que les préférences ne peuvent pas éteindre (§2.2). */
export function isMandatory(category: NotificationCategory, type: string): boolean {
  if (NON_DISABLEABLE_CATEGORIES.includes(category)) return true;
  return category === 'ACCOUNT' && (ACCOUNT_SECURITY_TYPES as readonly string[]).includes(type);
}

/**
 * Le canal est-il PRÉVU par la spec pour cette catégorie et ce type ?
 *
 * Ne lit AUCUNE préférence : c'est la matrice seule. Les préférences se
 * superposent ensuite, et ne peuvent qu'ôter — jamais ajouter un canal que le
 * tableau du §2.1 ne prévoit pas.
 */
export function channelAllowed(
  category: NotificationCategory,
  type: string,
  channel: NotificationDeliveryChannel,
): boolean {
  // RÈGLE DURE (§2.1), en premier et sans condition : « Aucun email n'est jamais
  // envoyé pour la catégorie SOCIAL. C'est ce qui protège la délivrabilité et
  // évite le désabonnement massif. »
  if (category === 'SOCIAL' && channel === 'EMAIL') return false;

  const row = CATEGORY_CHANNELS[category];
  const rule = channel === 'IN_APP' ? row.inApp : channel === 'PUSH' ? row.push : row.email;
  if (typeof rule === 'boolean') return rule;
  return rule.includes(type);
}

// ── Regroupement (§2.3) ───────────────────────────────────────────────────────

/** Fenêtre d'une heure — « une notification par publication et par heure ». */
export const GROUPING_WINDOW_HOUR_MS = 60 * 60 * 1000;
/** « `HELP` “vous pouvez aider” : au plus une par jour. » */
export const GROUPING_WINDOW_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * La clé de regroupement : ce qui fait que deux notifications sont « la même ».
 *
 * `SUBJECT` = par membre, par type et par référence (`ref_type` + `ref_id`) —
 * dix réactions sur une publication tombent dans une seule ligne.
 * `USER` = par membre et par type seulement — « vous pouvez aider » ne se
 * rattache à aucune référence unique.
 */
export interface GroupingRule {
  readonly windowMs: number;
  readonly scope: 'SUBJECT' | 'USER';
}

/**
 * Les trois regroupements du §2.3, et rien de plus.
 *
 * La clé est le TYPE quand la spec vise un type (« vous pouvez aider », « alertes
 * services »), la CATÉGORIE quand elle vise la catégorie entière (`SOCIAL`).
 * Cherché dans cet ordre : type d'abord, catégorie ensuite.
 */
export const GROUPING_BY_TYPE: Record<string, GroupingRule> = {
  // « `HELP` “vous pouvez aider” : au plus une par jour. »
  'help.can_help': { windowMs: GROUPING_WINDOW_DAY_MS, scope: 'USER' },
  // « `SERVICES` alertes : une par heure et par alerte. » La référence est
  // l'alerte enregistrée, pas l'annonce : sinon chaque annonce ferait sa ligne.
  'services.alert_match': { windowMs: GROUPING_WINDOW_HOUR_MS, scope: 'SUBJECT' },
};

export const GROUPING_BY_CATEGORY: Partial<Record<NotificationCategory, GroupingRule>> = {
  // « `SOCIAL` : une notification par publication et par heure. »
  SOCIAL: { windowMs: GROUPING_WINDOW_HOUR_MS, scope: 'SUBJECT' },
};

export function groupingRuleFor(
  category: NotificationCategory,
  type: string,
): GroupingRule | null {
  return GROUPING_BY_TYPE[type] ?? GROUPING_BY_CATEGORY[category] ?? null;
}

/**
 * « Sandra et 4 autres ont réagi » (§2.3).
 *
 * `others` est le nombre d'acteurs EN PLUS du premier nommé. Zéro rend le titre
 * simple : un regroupement de un ne doit pas s'annoncer comme un groupe.
 */
export function groupedTitle(firstActor: string, others: number, verb: string): string {
  if (others <= 0) return `${firstActor} ${verb}`;
  if (others === 1) return `${firstActor} et 1 autre ${verb}`;
  return `${firstActor} et ${others} autres ${verb}`;
}

// ── Heures calmes (§2.2) ──────────────────────────────────────────────────────

/** « plage par défaut 22 h–8 h (fuseau du membre) ». */
export const DEFAULT_QUIET_HOURS = { start: '22:00', end: '08:00' } as const;

export const quietHoursSchema = z.object({
  start: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  end: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
});

export type QuietHours = z.infer<typeof quietHoursSchema>;

/**
 * L'heure locale du membre tombe-t-elle dans la plage calme ?
 *
 * La plage TRAVERSE MINUIT dans le cas par défaut (22 h → 8 h), et c'est le piège :
 * `start <= h && h < end` ne rendrait jamais vrai. Le test se fait donc en deux
 * branches, selon que la plage franchit minuit ou non.
 *
 * Le fuseau vient de `users.timezone`. `Intl` fait la conversion : réimplémenter
 * l'heure d'été à la main est la façon la plus sûre de se tromper deux fois par an.
 */
export function isWithinQuietHours(now: Date, timezone: string, hours: QuietHours): boolean {
  const local = localHourMinute(now, timezone);
  const start = toMinutes(hours.start);
  const end = toMinutes(hours.end);
  if (start === end) return false;
  return start < end ? local >= start && local < end : local >= start || local < end;
}

/** Minutes à attendre avant la fin de la plage calme, dans le fuseau du membre. */
export function minutesUntilQuietHoursEnd(
  now: Date,
  timezone: string,
  hours: QuietHours,
): number {
  const local = localHourMinute(now, timezone);
  const end = toMinutes(hours.end);
  const delta = (end - local + 1440) % 1440;
  return delta === 0 ? 1440 : delta;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':');
  return Number(h) * 60 + Number(m);
}

function localHourMinute(now: Date, timezone: string): number {
  // `timeZone` invalide = `RangeError`. Un fuseau erroné en base ne doit pas
  // faire échouer une notification : on retombe sur l'heure UTC, qui est au pire
  // décalée, jamais absente.
  try {
    const parts = new Intl.DateTimeFormat('fr-FR', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
    return (hour % 24) * 60 + minute;
  } catch {
    return now.getUTCHours() * 60 + now.getUTCMinutes();
  }
}

// ── Push (§2.4) ───────────────────────────────────────────────────────────────

/** « Un abonnement qui échoue 5 fois est supprimé. » */
export const PUSH_MAX_FAILURES = 5;

/**
 * RÈGLE DURE (§2.4) : « jamais de contenu de message privé dans le push,
 * seulement “Nouveau message de Sandra” ».
 *
 * Le texte est CONSTRUIT ici et le corps du message n'est même pas un paramètre :
 * ce qu'une fonction ne peut pas recevoir ne peut pas fuir.
 */
export function messagePushTitle(senderDisplayName: string): string {
  return `Nouveau message de ${senderDisplayName}`;
}

/**
 * LA MÊME RÈGLE, POUR UN FIL « CONTACTER LES MODÉRATEURS ».
 *
 * Le porteur : « Oui » au nom du réseau dans la notification. Sans lui, un
 * modérateur recevait « Nouveau message de Sandra » sans savoir que Sandra
 * écrivait à l'équipe de SON réseau — ni de quel réseau, s'il en anime
 * plusieurs. Le même titre sert au membre qui reçoit la réponse : c'est bien
 * « les modérateurs de ce réseau » qui lui répondent.
 *
 * Le nom du réseau n'est PAS du contenu de message : c'est le nom public d'un
 * réseau dont le destinataire est membre. La règle dure du §2.4 tient donc —
 * le corps du message n'est, ici non plus, pas un paramètre.
 */
export function moderationMessagePushTitle(senderDisplayName: string, communityName: string): string {
  return `${messagePushTitle(senderDisplayName)} · Modérateurs de ${communityName}`;
}

/** Charge utile minimale du §2.4 : titre, corps court, lien. */
export const PUSH_BODY_MAX = 120;

// ── Conservation (§2.7) ───────────────────────────────────────────────────────

/** « Conservation 90 jours. » */
export const NOTIFICATION_RETENTION_DAYS = 90;
/** §7 : « `outbound_messages` : conservés 90 jours anonymisés puis purgés. » */
export const OUTBOUND_RETENTION_DAYS = 90;
/** §2.5 : « adresse marquée invalide après 2 rebonds durs ». */
export const EMAIL_HARD_BOUNCE_LIMIT = 2;

// ── Modèles d'email (§2.5) ────────────────────────────────────────────────────

/**
 * Les modèles nommés par le §2.5. Un `template` d'`outbound_messages` qui n'est
 * pas dans cette liste est un modèle inventé, donc une chaîne que personne n'a
 * rédigée.
 */
export const EMAIL_TEMPLATES = [
  'welcome',
  'journey_deadline_j1',
  'mentorship_request_received',
  'guide_proposal_received',
  'weekly_digest',
  'security',
  'moderation',
  'invoice',
] as const;

export type EmailTemplate = (typeof EMAIL_TEMPLATES)[number];

// ── Résumé hebdomadaire (§2.6) ────────────────────────────────────────────────

/** « Lundi 8 h, fuseau du membre. » 1 = lundi pour `Date#getUTCDay`. */
export const DIGEST_WEEKDAY = 1;
export const DIGEST_LOCAL_HOUR = 8;
/** « 3 guides les plus utiles publiés, 2 nouveaux arrivants. » */
export const DIGEST_GUIDES_COUNT = 3;
export const DIGEST_NEWCOMERS_COUNT = 2;

// ── Schémas d'API (§4) ────────────────────────────────────────────────────────

export const notificationCategorySchema = z.enum(NOTIFICATION_CATEGORIES);

export const notificationListQuerySchema = cursorQuerySchema.extend({
  /** `true` = seulement les non-lues (la cloche). */
  unread: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .transform((v) => v === true || v === 'true')
    .optional(),
  /** §5 : « page Notifications (filtres par catégorie) ». */
  category: notificationCategorySchema.optional(),
});

/**
 * ─── `GET /notifications` — ET LA RÈGLE DURE DU §2.4, RENDUE EXÉCUTABLE ───────
 *
 * « UN PUSH MESSAGE NE CONTIENT JAMAIS LE CORPS DU MESSAGE » (§2.4, et 08 §8.1).
 *
 * Le back la tient déjà, et bien : `onMessageSent` écrit `body: null` sur chaque
 * notification de catégorie `MESSAGE`, en le commentant (« laisser la place vide
 * est ce qui garantit qu'aucun extrait ne s'y glissera un jour ») ; l'événement de
 * domaine `message.sent` ne porte que des identifiants ; et la passerelle temps
 * réel publie `message.new` avec `conversationId` et `messageId`, rien d'autre.
 * Vérifié aux trois étages, pas supposé.
 *
 * ALORS POURQUOI LE REDIRE ICI ? Parce qu'aucune de ces trois gardes n'est au
 * CONTACT de l'écran. Il n'existe aucun intercepteur de validation de réponse
 * côté API — compté : zéro `APP_INTERCEPTOR` dans `app.module.ts` — donc entre le
 * `body: null` du service et le gabarit d'une ligne de notification, il n'y a
 * aujourd'hui aucun contrôle. Le jour où un extrait de message s'y glisserait — un
 * regroupement qui résume, un gabarit d'email réemployé, une jointure de trop — la
 * page X02 l'AFFICHERAIT, et c'est précisément la fuite que le §2.4 interdit : le
 * corps d'un message privé lisible sans ouvrir la conversation, donc sur un écran
 * verrouillé si la ligne part aussi en push.
 *
 * `refine` fait donc de la règle un REFUS : une réponse qui porte un corps sur une
 * notification `MESSAGE` est rejetée à la frontière, sur l'appel, avec le nom du
 * champ. L'écran ne l'affiche pas, et personne n'a à s'en souvenir.
 *
 * `.strict()` tient l'autre moitié, et sans lui zod DÉPOUILLE EN SILENCE : un
 * `preview`, un `excerpt` ou un `messageBody` greffé sur la ligne serait retiré de
 * l'objet sans un mot — les octets auraient quitté le serveur, traversé le réseau,
 * atteint le navigateur, et rien ne l'aurait dit. Un champ de trop sur une
 * notification de message est une FUITE, jamais un enrichissement.
 *
 * ── CE QUE CETTE RÉPONSE NE PORTE PAS, ET QUI MANQUE À L'ÉCRAN ───────────────
 *
 * AUCUN `url`. Les gestionnaires d'événements en calculent un (`/messages/:id`) et
 * le passent au push et à l'email, mais la table `notifications` n'a PAS de colonne
 * `url` — vérifié sur le schéma Prisma. La ligne arrive donc au front avec
 * `refType` et `refId` pour toute destination, et pour une notification de message
 * `refType` vaut `CONVERSATION` tandis que `refId` porte l'identifiant du
 * MESSAGE — pas celui de la conversation. Un front qui construirait
 * `/messages/${refId}` ouvrirait une conversation qui n'existe pas. Écart remonté
 * au porteur, pas contourné : les lignes de X02 ne sont donc pas cliquables.
 */
export const notificationSchema = z
  .object({
    id: uuidSchema,
    createdAt: z.string().datetime(),
    category: notificationCategorySchema,
    /** Ex. `help.response_received`, `message.received`. Libre côté base. */
    type: z.string(),
    title: z.string(),
    body: z.string().nullable(),
    refType: z.string().nullable(),
    refId: z.string().nullable(),
    readAt: z.string().datetime().nullable(),
    channelsSent: z.array(z.enum(NOTIFICATION_DELIVERY_CHANNELS)),
  })
  .strict()
  .refine((n) => n.category !== 'MESSAGE' || n.body === null, {
    path: ['body'],
    message:
      'Une notification de catégorie MESSAGE ne peut pas porter de corps (§2.4) : ' +
      'un push de message ne contient jamais le corps du message.',
  });

export type Notification = z.infer<typeof notificationSchema>;

/** `GET /notifications` — l'enveloppe, et le compteur de la cloche. */
export const notificationsResponseSchema = z.object({
  items: z.array(notificationSchema),
  nextCursor: z.string().nullable(),
  meta: z.object({ unread: z.number().int().nonnegative() }).strict(),
});

export type NotificationsResponse = z.infer<typeof notificationsResponseSchema>;

/** `POST /notifications/read` — ce que le serveur rend après avoir marqué (§4). */
export const notificationReadResponseSchema = z
  .object({
    updated: z.number().int().nonnegative(),
    unread: z.number().int().nonnegative(),
  })
  .strict();

export type NotificationReadResponse = z.infer<typeof notificationReadResponseSchema>;

/**
 * `POST /notifications/read` : `ids[]` OU `all` (§4).
 *
 * Le `refine` refuse les deux à la fois et aucun des deux. Sans lui, un corps
 * vide passerait pour « tout marquer lu » ou pour « ne rien faire » selon
 * l'implémentation, et le client ne saurait pas lequel.
 */
export const notificationReadSchema = z
  .object({
    ids: z.array(uuidSchema).min(1).max(200).optional(),
    all: z.literal(true).optional(),
  })
  .refine((v) => (v.ids === undefined) !== (v.all === undefined), {
    message: 'Indiquez soit `ids`, soit `all`, mais pas les deux.',
  });

/**
 * Les préférences, par catégorie et par canal.
 *
 * Le schéma figé porte DEUX colonnes json — `push` et `email` — et non une seule
 * comme le `{ "HELP": { "push": true, "email": false } }` du §2.2. La forme d'API
 * suit la spec (une entrée par catégorie), le service la range dans les deux
 * colonnes : le membre voit la grille que §5 décrit, la base garde sa forme.
 *
 * Il n'y a pas de préférence IN_APP : la colonne n'existe pas, et le tableau du
 * §2.1 coche l'in-app partout sauf `DIGEST`. Un canal toujours actif n'a pas
 * besoin d'être stocké.
 */
export const notificationPreferencesSchema = z.object({
  categories: z
    .record(
      notificationCategorySchema,
      z.object({ push: z.boolean().optional(), email: z.boolean().optional() }),
    )
    .optional(),
  weeklyDigest: z.boolean().optional(),
  /** `null` désactive les heures calmes ; absent ne les change pas. */
  quietHours: quietHoursSchema.nullable().optional(),
});

export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;

/**
 * `GET /me/notification-preferences` — ce que l'API RENVOIE, et non ce qu'elle
 * accepte en écriture.
 *
 * Les deux formes sont volontairement différentes, et les confondre serait une
 * faute : l'écriture est un DELTA (tout est facultatif, « absent ne change pas »),
 * la lecture est un ÉTAT COMPLET — une ligne par catégorie, avec son libellé
 * français, ce que chaque canal permet et ce que le membre a choisi.
 *
 * `locked` porte la règle dure du §2.1 que l'écran K07 dessine : la catégorie
 * « Sécurité et compte » est grisée et marquée « Non désactivable ». Elle vient
 * du SERVEUR — `NON_DISABLEABLE_CATEGORIES` — et l'écran l'affiche ; il ne la
 * décide pas, sinon la grille et le serveur divergeraient au premier ajustement.
 */
export const notificationPreferencesResponseSchema = z.object({
  categories: z.array(
    z.object({
      category: notificationCategorySchema,
      /** Le libellé français, composé par l'API : `CATEGORY_LABELS_FR`. */
      label: z.string(),
      /** L'in-app n'est pas une préférence : il est toujours là, ou jamais. */
      inApp: z.boolean(),
      push: z.object({
        available: z.boolean(),
        enabled: z.boolean(),
        locked: z.boolean(),
      }),
      email: z.object({
        available: z.boolean(),
        enabled: z.boolean(),
        locked: z.boolean(),
      }),
    }),
  ),
  weeklyDigest: z.boolean(),
  /** `null` = heures calmes désactivées. L'écran affiche « 22 h – 7 h » sinon. */
  quietHours: quietHoursSchema.nullable(),
  /** §3 : sans adresse vérifiée, pas de canal email à proposer. */
  emailAvailable: z.boolean(),
});

export type NotificationPreferencesResponse = z.infer<
  typeof notificationPreferencesResponseSchema
>;

/**
 * `POST /me/push-subscriptions` — la forme exacte d'un `PushSubscription` du
 * navigateur, aplatie. `endpoint` est unique en base : réenregistrer le même
 * appareil met à jour, il ne duplique pas.
 */
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
  userAgent: z.string().max(400).optional(),
});

export const addEmailSchema = z.object({
  email: z.string().email().max(254).toLowerCase(),
});

/**
 * `POST /me/email/verify` — un code à six chiffres reçu par email, saisi dans
 * l'application. Le « lien » du premier jet de 12 §3 est remplacé par un code :
 * la route exige déjà la session du membre, et un code se saisit sur le même écran
 * que l'adresse, sans quitter l'application (le lien rouvrait un onglet et perdait
 * le contexte, surtout sur mobile).
 */
export const verifyEmailSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
});

/** `GET /me/email` et réponses des routes d'écriture : jamais l'adresse en clair. */
export const emailStateSchema = z.object({
  /** Adresse enregistrée (masquée) — `null` si aucune. */
  email: z.object({ masked: z.string(), verified: z.boolean() }).nullable(),
  /** Adresse en attente de vérification (masquée) — `null` si aucune. */
  pending: z.object({ masked: z.string(), expiresAt: z.string(), resendAvailableAt: z.string() }).nullable(),
});
export type EmailState = z.infer<typeof emailStateSchema>;

/** `GET /unsubscribe?token` — route PUBLIQUE, sans connexion (§4 et §8). */
export const unsubscribeQuerySchema = z.object({
  token: z.string().min(16).max(512),
});

/** Le lien de désabonnement vaut 90 jours : un email peut être lu tard. */
export const UNSUBSCRIBE_TOKEN_TTL_DAYS = 90;

// ── Textes (T2) ───────────────────────────────────────────────────────────────

/**
 * Les libellés français des catégories, pour la grille des réglages.
 *
 * Ici et non dans le front, pour la même raison que le bandeau du logement : le
 * serveur décide ce qu'il envoie, il doit aussi savoir le nommer.
 */
export const CATEGORY_LABELS_FR: Record<NotificationCategory, string> = {
  JOURNEY_DEADLINE: 'Échéances de mon parcours',
  JOURNEY_TEAM: 'Mon équipe de parcours',
  HELP: 'Entraide',
  MENTORSHIP: 'Parrainage',
  MESSAGE: 'Messages privés',
  SOCIAL: 'Réactions et commentaires',
  GUIDE: 'Guides',
  COMMUNITY: 'Réseaux',
  EVENT: 'Événements',
  SERVICES: 'Logement, emploi, professionnels',
  BOOKMARK: 'Mes éléments enregistrés',
  ACCOUNT: 'Mon compte',
  MODERATION: 'Modération',
  DIGEST: 'Résumé hebdomadaire',
};

/** §7.2 : la cloche, le panneau, la page. Le texte de l'état vide. */
export const NOTIFICATIONS_EMPTY_FR = 'Aucune notification pour l’instant.';
export const UNSUBSCRIBE_CONFIRMATION_FR =
  'Vous ne recevrez plus cet email. Vous pouvez le réactiver dans vos réglages.';
