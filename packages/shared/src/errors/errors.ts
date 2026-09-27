/**
 * Codes d'erreur — SOURCE UNIQUE (00-fondations.md §5.2, T4 §3).
 *
 * Toute erreur renvoie `error { code, message, details }` :
 *   · `code`    constante stable en SCREAMING_SNAKE, que le front utilise pour
 *               choisir son affichage — jamais le message.
 *   · `message` français, affichable tel quel.
 *   · `details` objet typé par code.
 *
 * Principe de discrétion (T4 §3) : ne JAMAIS révéler l'existence d'un compte,
 * d'un numéro ou d'un contenu bloqué. On renvoie 404 plutôt que 403 quand la
 * ressource ne doit pas être connue du demandeur.
 */

/** Codes transverses, disponibles dans tous les modules (§5.2). */
export const TRANSVERSE_ERROR_CODES = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  TOKEN_STALE: 401,
  FORBIDDEN: 403,
  LEVEL_REQUIRED: 403,
  ACCOUNT_SUSPENDED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PLAN_LIMIT_REACHED: 422,
  BLOCKED_RELATIONSHIP: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
} as const;

export type TransverseErrorCode = keyof typeof TRANSVERSE_ERROR_CODES;

/** Messages français par défaut. Le module peut les préciser, jamais les contredire. */
export const TRANSVERSE_ERROR_MESSAGES: Record<TransverseErrorCode, string> = {
  VALIDATION_FAILED: 'Certaines informations sont incomplètes ou mal remplies.',
  UNAUTHENTICATED: 'Vous devez être connecté·e pour continuer.',
  TOKEN_STALE: 'Votre session doit être actualisée.',
  FORBIDDEN: 'Vous n’avez pas accès à cette action.',
  LEVEL_REQUIRED: 'Cette action demande de vérifier votre compte.',
  ACCOUNT_SUSPENDED: 'Votre compte est suspendu. Vous pouvez toujours consulter la plateforme.',
  NOT_FOUND: 'Ce contenu n’existe pas ou n’est plus disponible.',
  CONFLICT: 'Cette action n’est plus possible dans l’état actuel.',
  PLAN_LIMIT_REACHED: 'Vous avez atteint la limite de votre formule gratuite.',
  BLOCKED_RELATIONSHIP: 'Cette action n’est pas possible entre vous et ce membre.',
  RATE_LIMITED: 'Trop de tentatives. Patientez un instant avant de réessayer.',
  INTERNAL_ERROR: 'Une erreur est survenue de notre côté. Réessayez dans un instant.',
};

/** Un champ en erreur. Le front le rattache au champ de formulaire par `path`. */
export interface FieldError {
  readonly path: string;
  readonly code: string;
}

export interface ApiErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: Record<string, unknown>;
  };
}

export function apiError(
  code: string,
  message: string,
  details?: Record<string, unknown>,
): ApiErrorBody {
  return { error: details === undefined ? { code, message } : { code, message, details } };
}

export function transverseError(
  code: TransverseErrorCode,
  details?: Record<string, unknown>,
): ApiErrorBody {
  return apiError(code, TRANSVERSE_ERROR_MESSAGES[code], details);
}

export function httpStatusFor(code: TransverseErrorCode): number {
  return TRANSVERSE_ERROR_CODES[code];
}
