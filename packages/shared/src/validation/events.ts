import { z } from 'zod';
import { EventType } from '../enums/generated.js';
import { cursorQuerySchema, uuidSchema } from './pagination.js';

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
} as const;

export type EventErrorCode = keyof typeof EVENT_ERROR_CODES;

export const EVENT_ERROR_MESSAGES: Record<EventErrorCode, string> = {
  TOO_SOON: 'Un événement doit être annoncé au moins deux heures à l’avance.',
  TOO_FAR: 'Un événement ne peut pas être créé plus de six mois à l’avance.',
  EVENT_STARTED: 'Cet événement a commencé : il n’est plus modifiable.',
  CHECKIN_WINDOW_CLOSED: 'La présence ne peut plus être enregistrée pour cet événement.',
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

/** Un jour du calendrier vertical (§3.5, §5). */
export interface CalendarDay {
  /** Jour civil dans le fuseau de référence du membre. */
  readonly date: string;
  /** Événements visibles ce jour-là — près de moi et de mes réseaux. */
  readonly total: number;
  /** Mes participations : GOING ou WAITLIST (le point terre cuite). */
  readonly attending: number;
  /** Titre du premier événement du jour, ou null. */
  readonly firstTitle: string | null;
}
