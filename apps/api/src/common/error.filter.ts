import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { MEDIA_ERROR_MESSAGES, apiError, transverseError } from '@app/shared';

/**
 * Filtre d'erreurs : garantit que TOUTE réponse d'erreur a la forme
 * `error { code, message, details }` (§5.2), y compris celles que Nest produit
 * lui-même (404 de routage, 400 de validation, 429 de limite de débit).
 *
 * Une erreur inattendue ne fuit jamais son détail au client : le message reste
 * générique, la trace part dans les journaux. §8.3 — on ne révèle pas la
 * structure interne à un attaquant.
 */
/** Vrai seulement pour la forme `{ error: { code, message } }` de §5.2. */
function isApiErrorBody(body: unknown): body is { error: { code: string; message: string } } {
  if (typeof body !== 'object' || body === null || !('error' in body)) return false;
  const err: unknown = body.error;
  return typeof err === 'object' && err !== null && 'code' in err && 'message' in err;
}

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const status = exception.getStatus();

      // Déjà au bon format : nos ApiError.
      //
      // Le test porte sur la FORME de `error`, pas sur sa seule présence : le
      // format par défaut de Nest est `{ message, error, statusCode }`, où
      // `error` est une chaîne. Un simple `'error' in body` le laissait passer
      // tel quel, et un 404 de routage sortait au format de Nest. Trouvé en
      // appelant une route inexistante, pas en relisant le filtre.
      if (isApiErrorBody(body)) {
        res.status(status).json(body);
        return;
      }

      /**
       * 413 — LE PLAFOND DUR DU MULTIPART, et il mérite son propre code.
       *
       * Multer arrête la lecture du corps au-delà de `limits.fileSize` et Nest en
       * fait une `PayloadTooLargeException`. Sans cette branche, la réponse
       * sortait en `INTERNAL_ERROR` à 413 — « une erreur est survenue de notre
       * côté » pour un fichier trop lourd, c'est-à-dire la seule phrase qui
       * n'aide pas le membre et qui envoie chercher la panne au mauvais endroit.
       *
       * Le code est celui du module média, `MEDIA_TOO_LARGE`, exactement comme
       * celui que le service lève pour le même fait : le front choisit son
       * affichage sur le `code` (§5.2), et deux codes pour un seul fait lui en
       * feraient apprendre deux.
       */
      if (status === 413) {
        res.status(413).json(apiError('MEDIA_TOO_LARGE', MEDIA_ERROR_MESSAGES.MEDIA_TOO_LARGE));
        return;
      }

      // Erreur produite par Nest : on la remet au format maison.
      const code =
        status === 404
          ? 'NOT_FOUND'
          : status === 401
            ? 'UNAUTHENTICATED'
            : status === 403
              ? 'FORBIDDEN'
              : status === 429
                ? 'RATE_LIMITED'
                : status === 400
                  ? 'VALIDATION_FAILED'
                  : 'INTERNAL_ERROR';
      res.status(status).json(transverseError(code));
      return;
    }

    // Inattendue : on journalise tout, on ne renvoie rien de spécifique.
    this.logger.error(
      `${req.method} ${req.url} — erreur non gérée`,
      exception instanceof Error ? exception.stack : String(exception),
    );
    res.status(500).json(transverseError('INTERNAL_ERROR'));
  }
}
