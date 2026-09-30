import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ALL_ERROR_CODES,
  ALL_ERROR_MESSAGES,
  ALL_ERROR_STATUSES,
  CONFLICTING_ERROR_CODES,
  apiErrorBodySchema,
  isKnownErrorCode,
  messageForErrorCode,
} from '../errors/catalogue.js';

/**
 * Le catalogue d'erreurs est COMPLET et SANS CONFLIT.
 *
 * Il est une DÉRIVATION : il importe les vingt tables et les fusionne, sans rien
 * recopier. Restent deux façons de se tromper, et ce fichier garde les deux :
 *
 *   · **oublier une table.** Ajouter `SPONSORSHIP_ERROR_CODES` dans un nouveau
 *     module sans l'inscrire dans `catalogue.ts` : le front ne connaîtrait pas ses
 *     codes, et `isKnownErrorCode` les dirait inconnus — c'est-à-dire « l'API est
 *     plus récente que ce client », un diagnostic faux qui envoie chercher au mauvais
 *     endroit. Le premier test lit le SYSTÈME DE FICHIERS pour s'en apercevoir.
 *
 *   · **un conflit de statut.** Le même code à 403 dans un module et 404 dans un
 *     autre. La fusion est silencieuse : le dernier gagne, et personne ne le voit.
 */
describe('catalogue des codes d’erreur', () => {
  const srcDir = resolve(__dirname, '..');

  /**
   * Les tables déclarées dans le dépôt, lues sur le disque.
   *
   * IL FAUT LIRE LES FICHIERS, et non importer `../index.js` pour y chercher les
   * clés en `_ERROR_CODES`. La différence est tout l'intérêt du test : une table
   * qu'on aurait oublié de réexporter depuis `index.ts` serait invisible à
   * l'import, donc le test passerait pour la même raison que le bogue existe. Le
   * disque, lui, ne ment pas sur ce qui est écrit.
   */
  function declaredTables(): string[] {
    const names: string[] = [];
    const dirs = ['validation', 'errors'];
    for (const dir of dirs) {
      for (const file of readdirSync(resolve(srcDir, dir))) {
        if (!file.endsWith('.ts')) continue;
        const source = readFileSync(resolve(srcDir, dir, file), 'utf8');
        for (const match of source.matchAll(/export const (\w+_ERROR_CODES)\s*=\s*\{/g)) {
          const name = match[1];
          if (name !== undefined) names.push(name);
        }
      }
    }
    return names.sort();
  }

  it('[RÈGLE DURE] chaque table de codes du dépôt est fusionnée dans le catalogue', () => {
    const tables = declaredTables();

    // Si ce compte s'effondre, c'est la LECTURE qui est cassée, pas le code : sans
    // ce plancher, le test passerait brillamment sur zéro table trouvée.
    expect(tables.length).toBeGreaterThanOrEqual(20);

    const catalogueSource = readFileSync(resolve(srcDir, 'errors', 'catalogue.ts'), 'utf8');
    const missing = tables.filter((name) => !catalogueSource.includes(name));

    expect(
      missing,
      `Ces tables de codes existent et le catalogue ne les connaît pas. Le front dira\n` +
        `« code inconnu » sur des erreurs parfaitement prévues :\n${missing.join('\n')}`,
    ).toEqual([]);
  });

  /**
   * DEUX CONFLITS DE STATUT EXISTENT, et ce test les ÉPINGLE au lieu de les taire.
   *
   * Trouvés en construisant le catalogue, pas en relisant les tables : la fusion est
   * silencieuse, le dernier module gagne, et aucun test existant ne regardait deux
   * tables à la fois.
   *
   *   · `FORBIDDEN_WORD` — `400` dans `pros.ts`, `422` dans `guides.ts`.
   *     `00` §5.2 range `400` en « validation » et `422` en « règle métier ». Un mot
   *     interdit est la même chose dans les deux modules, donc l'un des deux se
   *     trompe. Le front qui voudrait distinguer « champ mal rempli » de « règle
   *     métier » sur le statut se tromperait selon la route appelée.
   *
   *   · `WEBHOOK_SIGNATURE_INVALID` — `401` dans `account.ts` (webhook Didit),
   *     `400` dans `billing.ts` (webhook Stripe). Les messages diffèrent aussi
   *     (« Signature du webhook invalide. » contre « Signature invalide. »). Moins
   *     grave, puisqu'aucun client ne lit ces réponses — ce sont les fournisseurs —
   *     mais c'est le même code qui dit deux choses.
   *
   * CE N'EST PAS AU SOCLE DU FRONT DE TRANCHER : choisir un statut change ce que
   * l'API répond, donc relève de la spécification et des agents du back. La liste
   * est donc FERMÉE et ses statuts sont ÉPINGLÉS — corriger l'un des deux fait
   * rougir ce test, ce qui oblige à venir retirer l'entrée. Et un TROISIÈME conflit
   * le fait rougir aussi, ce qui est tout l'intérêt.
   */
  it('[RÈGLE DURE] les conflits de statut sont exactement les deux défauts connus', () => {
    expect(
      [...CONFLICTING_ERROR_CODES],
      `Un code déclaré avec deux statuts DIFFÉRENTS selon le module. Le front choisit\n` +
        `son affichage sur le couple (statut, code) : il se tromperait selon la route\n` +
        `appelée. Si vous venez d’en corriger un, retirez-le de cette liste ; si vous\n` +
        `venez d’en créer un, ne le faites pas.\n${CONFLICTING_ERROR_CODES.join('\n')}`,
    ).toEqual(['FORBIDDEN_WORD', 'WEBHOOK_SIGNATURE_INVALID']);
  });

  it('les deux conflits connus n’ont pas changé de statut sans qu’on le sache', () => {
    /**
     * Les valeurs sont celles que la FUSION retient, MESURÉES et non déduites.
     *
     * Je les avais déduites de l'ordre des tables et je me suis trompé : `PRO_` passe
     * après `GUIDE_` et `BILLING_` après `ACCOUNT_`, donc ce sont `pros.ts` (400) et
     * `billing.ts` (400) qui gagnent — pas l'inverse. Le test a rougi et il avait
     * raison. C'est exactement pourquoi cette valeur est épinglée : « le dernier
     * gagne » est une règle qu'on croit connaître et qu'on applique de travers.
     *
     * Conséquence à connaître pour qui branche l'annuaire pro ou les guides :
     * `FORBIDDEN_WORD` arrive en `400` sur LES DEUX routes, alors que `guides.ts`
     * documente `422`. C'est la table de `pros.ts` qui décrit ce que le client voit.
     */
    expect(ALL_ERROR_STATUSES['FORBIDDEN_WORD']).toBe(400);
    expect(ALL_ERROR_STATUSES['WEBHOOK_SIGNATURE_INVALID']).toBe(400);
  });

  it('chaque code a une phrase française', () => {
    const sansMessage = ALL_ERROR_CODES.filter(
      (code) => (ALL_ERROR_MESSAGES[code] ?? '').trim().length === 0,
    );
    expect(
      sansMessage,
      `§5.2 promet un message « français, affichable tel quel » pour chaque code.\n` +
        `Ceux-ci n’en ont pas :\n${sansMessage.join('\n')}`,
    ).toEqual([]);
  });

  it('les codes sont en SCREAMING_SNAKE (§4)', () => {
    const malformes = ALL_ERROR_CODES.filter((code) => !/^[A-Z][A-Z0-9_]*$/.test(code));
    expect(malformes).toEqual([]);
  });

  it('les statuts sont des codes HTTP d’erreur plausibles', () => {
    const horsBornes = ALL_ERROR_CODES.filter((code) => {
      const status = ALL_ERROR_STATUSES[code];
      return status === undefined || status < 400 || status > 599;
    });
    expect(horsBornes).toEqual([]);
  });

  it('les codes transverses du §5.2 sont tous présents', () => {
    // La liste littérale de `00` §5.2, recopiée VOLONTAIREMENT depuis la
    // spécification et non depuis le code : c'est ce qui en fait une vérification
    // plutôt qu'une tautologie. Un test qui lit la valeur attendue dans la source
    // qu'il vérifie ne vérifie rien.
    for (const code of [
      'VALIDATION_FAILED',
      'UNAUTHENTICATED',
      'FORBIDDEN',
      'NOT_FOUND',
      'RATE_LIMITED',
      'LEVEL_REQUIRED',
      'PLAN_LIMIT_REACHED',
      'BLOCKED_RELATIONSHIP',
      'ACCOUNT_SUSPENDED',
      'CONFLICT',
    ]) {
      expect(isKnownErrorCode(code), `${code} manque au catalogue`).toBe(true);
    }
  });

  it('les codes nommés par T4 §2 et par 15 §2.1 sont présents', () => {
    // Ceux dont le CLIENT doit savoir quoi faire, nommés dans les specs.
    for (const code of ['TOKEN_STALE', 'STAFF_SESSION_REQUIRED', 'CROSS_DOMAIN_TOKEN']) {
      expect(isKnownErrorCode(code), `${code} manque au catalogue`).toBe(true);
    }
  });

  it('un code inconnu rend null plutôt qu’une phrase inventée', () => {
    // Une API plus récente que ce client peut lever un code qu'il ne connaît pas.
    // Prétendre le comprendre ferait passer une nouveauté pour une règle gérée.
    expect(messageForErrorCode('CODE_QUI_NEXISTE_PAS')).toBeNull();
    expect(isKnownErrorCode('CODE_QUI_NEXISTE_PAS')).toBe(false);
  });

  describe('schéma de l’enveloppe d’erreur (§5.2)', () => {
    it('accepte la forme exacte du serveur', () => {
      // Corps relevé à l'appel sur l'API qui tourne.
      const parsed = apiErrorBodySchema.safeParse({
        error: {
          code: 'LEVEL_REQUIRED',
          message: 'Cette action demande de vérifier votre compte.',
          details: { capability: 'post.create', requiredLevel: 'L1', currentLevel: 'L0' },
        },
      });
      expect(parsed.success).toBe(true);
    });

    it('accepte un code que le dépôt ne connaît pas encore', () => {
      /**
       * DÉLIBÉRÉ : `code` n'est pas un `z.enum(ALL_ERROR_CODES)`.
       *
       * Sinon, déployer l'API avant le front ferait échouer la validation de
       * l'enveloppe sur un code neuf — donc transformerait une nouveauté en panne,
       * et ferait perdre au passage le message que le serveur avait pris la peine
       * d'écrire.
       */
      const parsed = apiErrorBodySchema.safeParse({
        error: { code: 'REGLE_INVENTEE_DEMAIN', message: 'Pas possible.' },
      });
      expect(parsed.success).toBe(true);
    });

    it('refuse le format par défaut de Nest', () => {
      // `{ message, error: 'Not Found', statusCode }` — `error` y est une CHAÎNE.
      // Le filtre de l'API le convertit, mais un intermédiaire peut le produire, et
      // le confondre avec §5.2 donnerait un `code` indéfini.
      const parsed = apiErrorBodySchema.safeParse({
        message: 'Not Found',
        error: 'Not Found',
        statusCode: 404,
      });
      expect(parsed.success).toBe(false);
    });
  });
});
