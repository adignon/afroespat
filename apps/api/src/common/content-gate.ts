import { Logger } from '@nestjs/common';
import {
  MODERATION_ERROR_CODES,
  MODERATION_ERROR_MESSAGES,
  matchLocalRule,
} from '@app/shared';
import { ApiError } from './api-error';

const logger = new Logger('ContentGate');

/**
 * La barrière SYNCHRONE du pipeline de modération (13 §2.1) pour les modules qui
 * n'ont pas de code d'erreur `CONTENT_BLOCKED` à eux.
 *
 * Les règles sont celles de `matchLocalRule` (@app/shared), et il n'y en a pas
 * d'autres : le fil et l'entraide gardaient chacun une copie des mêmes motifs, qui
 * ne pouvaient que diverger. Ce qui reste propre à chaque module — le code
 * d'erreur rendu — reste chez l'appelant ; ce helper sert aux modules qui
 * n'en ont pas (annonces, offres, fiches, astuces, sujets de réseau).
 *
 * Le motif rendu au membre est GÉNÉRIQUE (§2.1) : détailler la règle franchie
 * apprendrait à la contourner. La règle n'est qu'au journal.
 *
 * L'étape ASYNCHRONE (analyse IA, dossier, masquage) n'est pas ici : elle part de
 * l'événement `*.published` (`event-subscriptions.service.ts`).
 */
export function assertLocalRules(...texts: readonly (string | null | undefined)[]): void {
  const joined = texts.filter((t): t is string => typeof t === 'string' && t.length > 0).join('\n');
  const rule = matchLocalRule(joined);
  if (rule === null) return;
  logger.warn(`Publication bloquée par la règle locale ${rule} (13 §2.1)`);
  throw new ApiError(
    'CONTENT_BLOCKED',
    MODERATION_ERROR_MESSAGES.CONTENT_BLOCKED,
    MODERATION_ERROR_CODES.CONTENT_BLOCKED,
  );
}
