/**
 * @app/shared — source unique des schémas de validation, enums, capacités et
 * codes d'erreur (00-fondations.md §4).
 *
 * Les types sont inférés depuis les schémas : une seule définition sert à la
 * validation de l'API, à celle des formulaires, et aux types du front.
 */
export * from './enums/generated.js';
export * from './capabilities/capabilities.js';
export * from './errors/errors.js';
export * from './validation/pagination.js';
export * from './constants/product.js';
