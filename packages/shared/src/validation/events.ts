import { z } from 'zod';
import { AttendeeStatus, EventStatus, EventType } from '../enums/generated.js';
import { cursorQuerySchema, handleSchema, pageSchema, uuidSchema } from './pagination.js';

/**
 * Agenda — 09-villes-agenda.md §3 et §5.
 *
 * SOURCE UNIQUE (00 §4) : ces schémas valident l'API ET les formulaires. Les
 * bornes de §3.1 (titre 5–120, description ≤ 3 000, début ≥ +2 h, ≤ 6 mois) sont
 * donc écrites UNE fois. Recopiées côté front, elles auraient divergé au premier
 * ajustement, et c'est l'écran « Créer » qui aurait menti.
 *
 * Deux choix méritent leur ligne :
 *
 *   · `addressText` est OBLIGATOIRE alors que la colonne est nullable. §3.5 :
 *     « Aucun événement en ligne / visio en V1 : l'agenda est physique par
 *     définition (`address_text` obligatoire). » C'est la seule barrière contre
 *     l'événement visio, et elle doit être ici, pas dans un contrôle d'écran.
 *
 *   · `WAITLIST` n'est PAS acceptée en entrée de RSVP. §3.2 en fait une décision
 *     du serveur (capacité atteinte, puis promotion à la première désinscription).
 *     Laisser le client la demander permettrait de doubler la file.
 */

// ── Bornes de §3 ────────────────────────────────────────────────────────────

/** §3.1 : « Début ≥ maintenant + 2 h ». */
export const EVENT_MIN_LEAD_MS = 2 * 60 * 60 * 1000;
/** §3.1 : « au plus 6 mois à l'avance ». Six mois = 183 jours, borne haute. */
export const EVENT_MAX_LEAD_MS = 183 * 24 * 60 * 60 * 1000;
/** §3.1 : « 1 par mois en gratuit », illimité en Premium. */
export const FREE_EVENTS_PER_MONTH = 1;
/** §3.1 : « Un événement annulé dans l'heure ne compte pas. » */
export const EVENT_CANCEL_GRACE_MS = 60 * 60 * 1000;
/** §3.3 : passage à DONE 12 h après `ends_at`… */
export const EVENT_DONE_AFTER_END_MS = 12 * 60 * 60 * 1000;
/** …ou `starts_at` + 4 h quand la fin n'est pas renseignée. */
export const EVENT_DONE_AFTER_START_MS = 4 * 60 * 60 * 1000;
/** §3.3 : « Je suis là » actif de H−0 à H+6. */
export const SELF_CHECKIN_WINDOW_MS = 6 * 60 * 60 * 1000;
/** §3.3 : `EVENT_ORGANIZED` exige au moins 3 présents cochés. */
export const EVENT_ORGANIZED_MIN_CHECKINS = 3;
/** §3.4 : un événement annulé reste visible 7 jours barré, puis masqué. */
export const CANCELLED_VISIBLE_DAYS = 7;
/** §2.2 et §5 : « ville (+ 30 km) ». */
export const DEFAULT_RADIUS_KM = 30;
/** §5 : `/events/calendar` accepte au plus 62 jours (6 semaines glissantes + marge). */
export const CALENDAR_MAX_DAYS = 62;
/** §5 : « Cache 5 min par (membre, ville) ». */
export const CALENDAR_CACHE_MS = 5 * 60 * 1000;

/**
 * Fuseau d'une ville, par pays de destination.
 *
 * Le schéma ne porte NI `cities.timezone` NI `countries.timezone`, et il est
 * figé : cette table est le substitut, pas une préférence. §3.5 lit un événement
 * « dans le fuseau de sa ville », or sans fuseau on ne sait pas de quel JOUR un
 * événement de 23 h relève — le calendrier vertical le rangerait un jour trop
 * tôt ou trop tard selon le fuseau du serveur.
 */
export const TIME_ZONE_BY_COUNTRY_ISO2: Readonly<Record<string, string>> = {
  FR: 'Europe/Paris',
};

/** Codes d'erreur propres à l'agenda (§5). */
export const EVENT_ERROR_CODES = {
  TOO_SOON: 422,
  TOO_FAR: 422,
  EVENT_STARTED: 422,
  CHECKIN_WINDOW_CLOSED: 422,
  /** La nouvelle capacité est sous le nombre d'inscrits (`details.attendeeCount`). */
  CAPACITY_BELOW_ATTENDEES: 422,
} as const;

export type EventErrorCode = keyof typeof EVENT_ERROR_CODES;

export const EVENT_ERROR_MESSAGES: Record<EventErrorCode, string> = {
  TOO_SOON: 'Un événement doit être annoncé au moins deux heures à l’avance.',
  TOO_FAR: 'Un événement ne peut pas être créé plus de six mois à l’avance.',
  EVENT_STARTED: 'Cet événement a commencé : il n’est plus modifiable.',
  CHECKIN_WINDOW_CLOSED: 'La présence ne peut plus être enregistrée pour cet événement.',
  CAPACITY_BELOW_ATTENDEES:
    'La capacité ne peut pas être inférieure au nombre de personnes déjà inscrites.',
};

/**
 * `EVENT_FULL` de la table du §5 n'est volontairement PAS déclaré.
 *
 * La même ligne l'annote « → waitlist automatique », et §3.2 le dit en clair :
 * « Si `capacity` atteinte : `WAITLIST` ». Les deux lectures se contredisent ;
 * on retient le comportement, pas le code, et la réponse porte alors
 * `status: WAITLIST` avec la position. Un code d'erreur que rien ne lève serait
 * un contrat vide dans l'OpenAPI, et le front finirait par l'attendre.
 */

// ── Écriture ─────────────────────────────────────────────────────────────────

/** Instant ISO 8601. Les dates SORTENT en UTC (T4 §1) ; en entrée, tout offset explicite est accepté. */
const instantSchema = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value));

const eventFields = {
  type: z.enum(EventType),
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().max(3000).optional(),
  cityId: uuidSchema,
  venueName: z.string().trim().min(2).max(160).optional(),
  /** Texte libre, JAMAIS géocodé (règle dure §4 du schéma, décision T4). */
  addressText: z.string().trim().min(4).max(400),
  startsAt: instantSchema,
  endsAt: instantSchema.optional(),
  capacity: z.number().int().min(1).max(100_000).optional(),
  coverAssetId: uuidSchema.optional(),
  /** Réservé au réseau : un non-membre reçoit 404 (§5). */
  communityId: uuidSchema.optional(),
};

export const createEventSchema = z
  .object(eventFields)
  .strict()
  .refine((v) => v.endsAt === undefined || v.endsAt.getTime() > v.startsAt.getTime(), {
    path: ['endsAt'],
    message: 'La fin doit suivre le début.',
  });

export type CreateEvent = z.infer<typeof createEventSchema>;

/**
 * Modification par l'organisateur (§3.1).
 *
 * `communityId` est absent : changer la réservation d'un événement déjà annoncé
 * le ferait apparaître à un public qui ne l'a jamais vu, ou disparaître sous les
 * pieds de ses inscrits. Créer un autre événement est la bonne manière de le dire.
 */
export const updateEventSchema = z
  .object({
    type: eventFields.type.optional(),
    title: eventFields.title.optional(),
    description: eventFields.description,
    cityId: eventFields.cityId.optional(),
    venueName: eventFields.venueName,
    addressText: eventFields.addressText.optional(),
    startsAt: eventFields.startsAt.optional(),
    endsAt: eventFields.endsAt,
    capacity: eventFields.capacity,
    coverAssetId: eventFields.coverAssetId,
  })
  .strict()
  .refine((v) => Object.values(v).some((field) => field !== undefined), {
    message: 'Aucune modification.',
  });

export type UpdateEvent = z.infer<typeof updateEventSchema>;

export const cancelEventSchema = z
  .object({ reason: z.string().trim().max(500).optional() })
  .strict();

export type CancelEvent = z.infer<typeof cancelEventSchema>;

/** §3.2 : les trois statuts que le MEMBRE peut choisir. `WAITLIST` est serveur. */
export const rsvpSchema = z
  .object({ status: z.enum(['GOING', 'MAYBE', 'DECLINED']) })
  .strict();

export type Rsvp = z.infer<typeof rsvpSchema>;

/**
 * Présence (§3.3). `userIds` est le geste de l'organisateur ; son absence est le
 * bouton « Je suis là » du participant.
 */
export const checkInSchema = z
  .object({ userIds: z.array(uuidSchema).min(1).max(500).optional() })
  .strict();

export type CheckIn = z.infer<typeof checkInSchema>;

// ── Lecture ──────────────────────────────────────────────────────────────────

/** Jour civil, dans le fuseau de la ville (§3.5). */
export const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const eventsScopeSchema = z.enum(['all', 'mine', 'organized']);

export type EventsScope = z.infer<typeof eventsScopeSchema>;

export const eventsQuerySchema = cursorQuerySchema
  .extend({
    /** Un jour précis (la page Agenda), ou un intervalle. */
    date: localDateSchema.optional(),
    from: localDateSchema.optional(),
    to: localDateSchema.optional(),
    scope: eventsScopeSchema.default('all'),
    cityId: uuidSchema.optional(),
    radiusKm: z.coerce.number().int().min(0).max(200).default(DEFAULT_RADIUS_KM),
    type: z.enum(EventType).optional(),
    /**
     * LES ÉLÉMENTS D'UN MEMBRE — l'onglet correspondant de son profil public.
     *
     * Le porteur : « pour tous les tabs il reprend le design des éléments
     * présentés de la façon dont ils sont présentés sur les pages d'origine ».
     * La carte se dessine à partir du schéma ENTIER de cette route ; une route
     * résumée ne peut pas la nourrir. Le filtre s'ajoute aux règles de
     * visibilité existantes, il n'en remplace aucune.
     */
    authorHandle: handleSchema.optional(),
    /**
     * ╔══════════════════════════════════════════════════════════════════════════╗
     * ║ LES ÉVÉNEMENTS D'UN RÉSEAU — L'ONGLET « ÉVÉNEMENTS » DE A08              ║
     * ╚══════════════════════════════════════════════════════════════════════════╝
     *
     * Le porteur : « Le contenu de l'onglet événement aussi est dessiné
     * (événements passés et à venir). Le bouton "Je viens" et "Voir" aussi ne
     * marchent pas. »
     *
     * MESURÉ avant ce lot, et c'est ce qui a décidé de la forme : ce schéma
     * étant `.strict()`, `GET /events?communityId=…` répondait
     * `400 UNRECOGNIZED_KEYS`, et `GET /communities/:slug/events` n'existe pas —
     * le contrôleur des réseaux déclare trente-quatre routes, aucune
     * d'événement. L'écran n'avait donc AUCUNE route pour cet onglet.
     *
     * ── POURQUOI PAS UN FILTRE CÔTÉ ÉCRAN ────────────────────────────────────
     *
     * Parce qu'il serait faux ET incomplet : `GET /events` sans filtre borne à la
     * ville du lecteur plus un rayon (§3.5), donc la réponse ne contient même pas
     * tous les événements du réseau à trier. Un réseau de PAYS a des membres et
     * des événements dans plusieurs villes.
     *
     * ── LE FILTRE S'AJOUTE AUX RÈGLES, IL N'EN REMPLACE AUCUNE ───────────────
     *
     * Même formule qu'`authorHandle` juste au-dessus, et pour la même raison : la
     * règle dure §10 — « un événement de réseau n'existe que pour ses membres » —
     * reste la première clause du `visibleWhere`. Demander un réseau dont on
     * n'est pas membre ne rend donc RIEN, et un événement privé reste privé.
     *
     * ⚠ C'EST L'INVERSE DU FIL, et l'écart est volontaire : `GET /feed?communityId=`
     * REMPLACE sa clause de réseau (`communityId: null` par défaut), ce qui
     * l'oblige à vérifier l'appartenance AVANT la requête — sans quoi un
     * identifiant de réseau deviendrait une clé de lecture universelle. Ici la
     * clause de visibilité n'est pas remplacée : il n'y a rien à garder en plus.
     */
    communityId: uuidSchema.optional(),
  })
  .strict()
  .refine((v) => v.date === undefined || (v.from === undefined && v.to === undefined), {
    path: ['date'],
    message: 'Choisissez un jour ou un intervalle, pas les deux.',
  });

export type EventsQuery = z.infer<typeof eventsQuerySchema>;

export const calendarQuerySchema = z
  .object({ from: localDateSchema, to: localDateSchema })
  .strict()
  .refine((v) => v.from <= v.to, { path: ['to'], message: 'L’intervalle est inversé.' })
  .refine((v) => daysBetween(v.from, v.to) <= CALENDAR_MAX_DAYS, {
    path: ['to'],
    message: `L’intervalle ne peut pas dépasser ${CALENDAR_MAX_DAYS} jours.`,
  });

export type CalendarQuery = z.infer<typeof calendarQuerySchema>;

/**
 * Nombre de jours d'un intervalle de dates civiles, bornes incluses.
 *
 * Calculé en UTC à partir du seul jour civil : il n'y a pas d'heure ici, donc
 * aucun fuseau à consulter — et passer par `new Date('YYYY-MM-DD')` dans un
 * fuseau local ferait varier le résultat selon le serveur.
 */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000) + 1;
}

/**
 * Un jour du calendrier vertical (§3.5, §5).
 *
 * C'ÉTAIT UNE `interface` ÉCRITE À LA MAIN, et le type seul ne vérifiait rien à
 * l'exécution : `apps/web` recevait `total: undefined` d'une API qui aurait changé
 * de forme, et le calendrier aurait dessiné des jours vides sans qu'un seul
 * message ne nomme la route. Le schéma refuse à l'endroit où la donnée entre, et
 * le type en DÉCOULE — une seule définition, donc aucune dérive possible entre ce
 * que le serveur promet et ce que le front valide.
 */
export const calendarDaySchema = z
  .object({
    /** Jour civil dans le fuseau de référence du membre. */
    date: localDateSchema,
    /** Événements visibles ce jour-là — près de moi et de mes réseaux. */
    total: z.number().int(),
    /** Mes participations : GOING ou WAITLIST (le point terre cuite). */
    attending: z.number().int(),
    /** Titre du premier événement du jour, ou null. */
    firstTitle: z.string().nullable(),
  })
  .strict();

export type CalendarDay = Readonly<z.infer<typeof calendarDaySchema>>;

/**
 * ─── CE QUE LES ROUTES DE LECTURE RENVOIENT ──────────────────────────────────
 *
 * Quatre schémas pour les quatre routes que les écrans E01 à E04 lisent. Ils sont
 * ICI, à côté des schémas de requête du même module, et pas dans `apps/web` :
 * 00 §4 fait de `packages/shared` la source unique, et un schéma de réponse
 * recopié dans le front est une deuxième source qui divergera au premier
 * ajustement.
 *
 * ── RELEVÉS SUR L'API QUI TOURNE, PAS DÉDUITS DU SERVICE ────────────────────
 *
 * Les charges sont dans `__tests__/fixtures/agenda_*.json`, prises avec quatre
 * membres créés pour l'occasion, un événement, deux RSVP, un réseau et une
 * présence cochée. Trois faits ne se lisent dans AUCUN service, et chacun aurait
 * produit un schéma faux :
 *
 *   1. `GET /events/:id/attendees` OMET `userId` et `checkedIn` au lieu de les
 *      mettre à `null` quand le lecteur n'est pas l'organisateur. Un
 *      `.nullable()` aurait refusé la réponse réelle de tout non-organisateur ;
 *   2. `waitlistPosition` n'apparaît QUE sur une ligne `WAITLIST` ;
 *   3. `GET /events` n'a pas de `meta` du tout, alors que `attendees` en a un
 *      dont les clés CHANGENT selon le lecteur (`going` seul, ou cinq compteurs).
 *
 * ── `.strict()` PARTOUT, ET CE N'EST PAS DU ZÈLE ────────────────────────────
 *
 * Sans lui, zod DÉPOUILLE en silence ce qu'il ne connaît pas : le jour où une de
 * ces routes joindrait une latitude (§10 : « rien n'est géocodé »), un numéro de
 * téléphone de participant ou un compteur de vues, la donnée aurait TRANSITÉ et
 * tout le monde conclurait que la règle est tenue. Le contrat la refuse donc
 * bruyamment — en `ApiShapeError`, qui est un incident et non une règle métier.
 */

/** La ville d'un événement, telle que `toCard` la projette — sans coordonnées. */
const eventCitySchema = z
  .object({ id: uuidSchema, name: z.string(), slug: z.string() })
  .strict();

/**
 * L'organisateur, et le participant dont on ne montre que l'avatar.
 *
 * `handle` est NULLABLE : un membre qui n'a pas encore choisi son pseudo organise
 * quand même. Le front affiche alors son nom, et ne fabrique pas de lien.
 */
const eventPersonSchema = z
  .object({
    handle: handleSchema.nullable(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
  })
  .strict();

/**
 * Une fiche d'événement (§5) — le même objet dans la liste et dans le détail.
 *
 * AUCUNE LATITUDE, AUCUNE LONGITUDE : la règle dure §10 dit « adresse en texte
 * libre, jamais géocodée », et `EVENT_SELECT` lit pourtant `city.latitude` pour
 * calculer le rayon côté serveur. `.strict()` est donc ce qui garantit qu'elles
 * ne SORTENT pas : si la projection se mettait à les joindre, l'écran refuserait
 * la réponse au lieu de les recevoir et, un jour, de les dessiner sur une carte.
 */
export const eventCardSchema = z
  .object({
    id: uuidSchema,
    type: z.enum(EventType),
    title: z.string(),
    description: z.string().nullable(),
    city: eventCitySchema,
    venueName: z.string().nullable(),
    /** Texte libre. Jamais de coordonnées : voir ci-dessus. */
    addressText: z.string().nullable(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime().nullable(),
    /** Fuseau de la VILLE de l'événement, et jour civil dans ce fuseau (§3.5). */
    timeZone: z.string(),
    localDate: localDateSchema,
    capacity: z.number().int().nullable(),
    /** Nombre de `GOING` : c'est ce nombre que `capacity` borne (§3.2). */
    attendeeCount: z.number().int(),
    status: z.enum(EventStatus),
    communityId: uuidSchema.nullable(),
    organizer: eventPersonSchema,
    coverUrl: z.string().nullable(),
    /** Mon RSVP, ou `null` — y compris pour un visiteur non connecté. */
    myStatus: z.enum(AttendeeStatus).nullable(),
    myWaitlistPosition: z.number().int().nullable(),
    myCheckedIn: z.boolean(),
    isOrganizer: z.boolean(),
    /** 09 §3.4 : l'instant et le motif (facultatif) de l'annulation. */
    cancelledAt: z.string().datetime().nullable(),
    cancelReason: z.string().nullable(),
  })
  .strict();

export type EventCardResponse = z.infer<typeof eventCardSchema>;

/**
 * `GET /events` (§5) — la liste d'un jour ou d'un intervalle.
 *
 * `pageSchema` convient : la réponse relevée porte `{ items, nextCursor }` et PAS
 * de `meta`, que `pageSchema` déclare facultatif. Un `meta` exigé aurait refusé
 * la vraie réponse de la seule route que l'agenda pagine.
 */
export const eventsResponseSchema = pageSchema(eventCardSchema);

export type EventsResponse = z.infer<typeof eventsResponseSchema>;

/**
 * `GET /events/:id` (§5) — la fiche, mon RSVP, les avatars des `GOING`.
 *
 * `checkedInCount` est `null` pour qui n'est NI l'organisateur NI en face d'un
 * événement `DONE` : le compte des présents est la feuille de l'organisateur, pas
 * une statistique publique. Il est bien là et vaut `null` — relevé, pas supposé —
 * donc `.nullable()` et non `.optional()`.
 */
export const eventDetailResponseSchema = eventCardSchema
  .extend({
    attendees: z.array(eventPersonSchema),
    checkedInCount: z.number().int().nullable(),
  })
  .strict();

export type EventDetailResponse = z.infer<typeof eventDetailResponseSchema>;

/**
 * `GET /events/calendar` (§5) — un objet par jour, les jours vides compris.
 *
 * `meta.timeZone` n'est pas décoratif : c'est le fuseau dans lequel la grille a
 * été construite, et le front ne doit pas en choisir un autre — un calendrier
 * reconstruit dans le fuseau du navigateur rangerait un événement de 23 h un jour
 * trop tôt.
 */
export const calendarResponseSchema = z
  .object({
    items: z.array(calendarDaySchema),
    meta: z.object({ timeZone: z.string(), cached: z.boolean() }).strict(),
  })
  .strict();

export type CalendarResponse = z.infer<typeof calendarResponseSchema>;

/**
 * ─── LA FEUILLE DE PRÉSENCE, EN DEUX SCHÉMAS ET NON EN UN ───────────────────
 *
 * §5 : « organisateur → liste complète ; autres → avatars des GOING ». Le service
 * tient cette règle en OMETTANT `userId` et `checkedIn` aux autres, et en
 * réduisant `meta` à son seul `going`.
 *
 * UN SEUL SCHÉMA À CHAMPS FACULTATIFS NE PROTÉGERAIT RIEN. `userId` y serait une
 * clé connue, donc le jour où la route le joindrait à la vue publique — par une
 * refonte du `select`, un `...row` de trop — la réponse passerait la validation
 * SANS UN MOT, et l'identifiant d'un participant aurait transité vers n'importe
 * quel membre qui ouvre la page. C'est exactement la fuite que §5 écarte.
 *
 * D'où deux formes, et un choix fait sur `isOrganizer` — que le SERVEUR décide, et
 * que `GET /events/:id` renvoie. Le front ne s'autorise rien : il valide la
 * réponse avec le contrat qui correspond à ce que le serveur a dit de lui.
 */

/** Une ligne de la vue PUBLIQUE : aucun identifiant, aucune présence. */
const publicAttendeeSchema = z
  .object({
    handle: handleSchema.nullable(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
    status: z.enum(AttendeeStatus),
    /** Présent UNIQUEMENT sur une ligne `WAITLIST` (relevé). */
    waitlistPosition: z.number().int().optional(),
  })
  .strict();

/** Une ligne de la feuille de l'ORGANISATEUR : elle seule porte de quoi cocher. */
const organizerAttendeeSchema = publicAttendeeSchema.extend({
  /** L'identifiant ne sort qu'à l'organisateur : lui seul coche les présents. */
  userId: uuidSchema,
  checkedIn: z.boolean(),
});

/** `GET /events/:id/attendees` vu par un membre qui n'organise pas. */
export const publicAttendeesResponseSchema = z
  .object({
    items: z.array(publicAttendeeSchema),
    nextCursor: z.string().nullable(),
    meta: z.object({ going: z.number().int() }).strict(),
  })
  .strict();

export type PublicAttendeesResponse = z.infer<typeof publicAttendeesResponseSchema>;

/** `GET /events/:id/attendees` vu par l'ORGANISATEUR — la feuille de présence. */
export const organizerAttendeesResponseSchema = z
  .object({
    items: z.array(organizerAttendeeSchema),
    nextCursor: z.string().nullable(),
    meta: z
      .object({
        going: z.number().int(),
        maybe: z.number().int(),
        waitlist: z.number().int(),
        declined: z.number().int(),
        /** Le nombre de présents cochés : l'indicateur clé de la plateforme (§3.3). */
        checkedIn: z.number().int(),
      })
      .strict(),
  })
  .strict();

export type OrganizerAttendeesResponse = z.infer<typeof organizerAttendeesResponseSchema>;
