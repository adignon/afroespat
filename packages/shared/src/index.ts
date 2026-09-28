/**
 * @app/shared — source unique des schémas de validation, enums, capacités et
 * codes d'erreur (00-fondations.md §4).
 *
 * Les types sont inférés depuis les schémas : une seule définition sert à la
 * validation de l'API, à celle des formulaires, et aux types du front.
 */
// Les enums générés d'abord : ils sont la source, le reste s'y réfère.
export * from './enums/generated.js';
export * from './capabilities/capabilities.js';
export * from './errors/errors.js';
export * from './validation/pagination.js';
export * from './validation/auth.js';
export * from './validation/help.js';
export * from './validation/journeys.js';
export * from './validation/guides.js';
export * from './validation/communities.js';
export * from './validation/cities.js';
export * from './validation/feed.js';
export * from './validation/messaging.js';
export * from './validation/connections.js';
export * from './validation/mentorship.js';
export * from './validation/moderation.js';
export * from './validation/pros.js';
export * from './validation/jobs.js';
export * from './validation/housing.js';
export * from './validation/events.js';
export * from './validation/admin.js';
export * from './constants/product.js';
export * from './constants/post-types.js';
