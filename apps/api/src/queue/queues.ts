/**
 * Files d'attente — 00-fondations.md §9.2.
 *
 * Les neuf files de la spec, déclarées en un seul endroit. Les créer vides au
 * lot 0 coûte une heure ; les rétro-ajouter au lot 7 coûte un refactor par
 * module qui en dépend.
 */
export const QUEUES = {
  /** Distribution des événements de domaine aux abonnés. */
  EVENTS: 'events',
  /** Création et envoi des notifications. */
  NOTIFICATIONS: 'notifications',
  /** Envois sortants, réessais exponentiels, trace dans outbound_messages. */
  EMAIL: 'email',
  SMS: 'sms',
  PUSH: 'push',
  /** Analyse IA des contenus — après masquage des PII (règle dure 13 §2). */
  MODERATION: 'moderation',
  /** Mise à jour de search_documents. */
  SEARCH_INDEX: 'search-index',
  /** Redimensionnement, suppression EXIF, antivirus. */
  MEDIA: 'media',
  /** Les 22 tâches planifiées de §9.3. */
  SCHEDULED: 'scheduled',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export const ALL_QUEUES: readonly QueueName[] = Object.values(QUEUES);

/**
 * Réessais exponentiels sur les envois sortants (§9.2). Cinq tentatives sur
 * environ une heure : un fournisseur SMS indisponible dix minutes ne doit pas
 * faire perdre un code OTP, mais un numéro invalide ne doit pas être réessayé
 * indéfiniment.
 */
export const OUTBOUND_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 30_000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 86_400 * 7 },
};

/** Les événements de domaine sont rejoués agressivement : les perdre casse la chaîne. */
export const EVENT_JOB_OPTIONS = {
  attempts: 10,
  backoff: { type: 'exponential' as const, delay: 5_000 },
  removeOnComplete: { age: 3600, count: 5000 },
  removeOnFail: { age: 86_400 * 30 },
};
