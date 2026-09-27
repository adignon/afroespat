import { HttpException } from '@nestjs/common';
import {
  type Capability,
  type TransverseErrorCode,
  type VerificationLevel,
  httpStatusFor,
  levelRequiredDetails,
  TRANSVERSE_ERROR_MESSAGES,
} from '@app/shared';

/**
 * Erreurs de l'API — 00-fondations.md §5.2 et T4 §3.
 *
 * Toute erreur renvoie `error { code, message, details }`. Le front choisit son
 * affichage sur le `code`, jamais sur le message.
 *
 * Principe de discrétion (T4 §3) : ne jamais révéler l'existence d'un compte,
 * d'un numéro ou d'un contenu bloqué. On renvoie 404 plutôt que 403 quand la
 * ressource ne doit pas être connue du demandeur — d'où `notFound()`, employée
 * même dans des cas qui seraient techniquement des 403.
 */
export class ApiError extends HttpException {
  constructor(
    readonly code: string,
    message: string,
    status: number,
    readonly details?: Record<string, unknown>,
  ) {
    super({ error: details === undefined ? { code, message } : { code, message, details } }, status);
  }

  static transverse(code: TransverseErrorCode, details?: Record<string, unknown>): ApiError {
    return new ApiError(code, TRANSVERSE_ERROR_MESSAGES[code], httpStatusFor(code), details);
  }

  /**
   * Niveau de vérification insuffisant. Le front affiche une invitation à monter
   * de niveau, JAMAIS une simple erreur (§7.3) — d'où les détails typés.
   */
  static levelRequired(capability: Capability, currentLevel: VerificationLevel): ApiError {
    return ApiError.transverse('LEVEL_REQUIRED', { ...levelRequiredDetails(capability, currentLevel) });
  }

  /** Limite du plan gratuit. Ne s'applique JAMAIS à l'aide (règle dure 14 §2). */
  static planLimit(limit: string, current: number, max: number): ApiError {
    return ApiError.transverse('PLAN_LIMIT_REACHED', { limit, current, max });
  }

  static notFound(): ApiError {
    return ApiError.transverse('NOT_FOUND');
  }

  static validation(fields: { path: string; code: string }[]): ApiError {
    return ApiError.transverse('VALIDATION_FAILED', { fields });
  }
}
