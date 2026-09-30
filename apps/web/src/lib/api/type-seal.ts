import { z } from 'zod';
import { memberApi } from './member';
import { staffApi } from './staff';

/**
 * L'ÉTANCHÉITÉ, VÉRIFIÉE PAR LE COMPILATEUR — règle dure 15 §2.1.
 *
 * Ce fichier ne contient aucun test au sens de vitest, et il n'en est pas un : il est
 * vérifié par `tsc`, à chaque `pnpm typecheck`. C'est délibéré, et c'est plus fort
 * qu'un test — la propriété à garder EST une propriété de types, et un test à
 * l'exécution ne peut pas l'observer.
 *
 * ── COMMENT IL MORD ─────────────────────────────────────────────────────────
 *
 * `@ts-expect-error` échoue quand l'erreur attendue N'ARRIVE PAS. Si quelqu'un
 * retire `MemberOnly` de la signature de `memberApi`, la ligne annotée ci-dessous
 * cesse d'être une erreur — et `tsc` se met alors à refuser la SUPPRESSION inutile
 * (« Unused '@ts-expect-error' directive »). Le typecheck devient rouge.
 *
 * Autrement dit, la seule façon de faire compiler `memberApi.get('/admin/…')` est de
 * venir modifier ce fichier, donc de lire ce commentaire.
 *
 * Il n'est PAS nommé `.test.ts` : vitest ne ramasse que `src/**\/*.test.ts`, et un
 * fichier qui ne contient pas de `describe` l'aurait fait échouer. Ici, `tsc` est le
 * seul lecteur nécessaire — il inclut tout `src`.
 *
 * Les fonctions sont exportées et jamais appelées. Elles ne doivent pas l'être : leur
 * corps n'a besoin que d'être TYPÉ, et les exécuter lancerait de vraies requêtes.
 */

const anything = z.unknown();

/** Ce qui doit compiler : le domaine de chacun. */
export function domainesLegitimes(): void {
  void memberApi.get('/me', anything);
  void memberApi.get('/places/countries', anything);
  void memberApi.post('/auth/otp/request', anything, { body: {} });
  // Un chemin de membre qui contient « administr… » reste un chemin de membre : la
  // règle porte sur le premier SEGMENT, pas sur la sous-chaîne.
  void memberApi.get('/guides/demarches-administratives', anything);

  void staffApi.get('/moderation/cases', anything);
  void staffApi.post('/auth/login', anything, { body: {} });
}

/**
 * Ce qui NE DOIT PAS compiler : le client membre vers le domaine de l'équipe.
 *
 * C'est la règle dure rendue non écrivable. Un développeur qui tape ceci de bonne
 * foi — parce qu'il a vu la route dans l'OpenAPI, parce qu'il recopie un appel — se
 * fait arrêter par le compilateur, pas par une revue.
 */
export function domainesInterdits(): void {
  // @ts-expect-error — le client MEMBRE ne peut pas atteindre le domaine de l'équipe.
  void memberApi.get('/admin/moderation/cases', anything);

  // @ts-expect-error — y compris en écriture, et y compris sur la connexion d'équipe.
  void memberApi.post('/admin/auth/login', anything, { body: {} });

  // @ts-expect-error — et y compris sur le préfixe nu.
  void memberApi.get('/admin', anything);

  /**
   * Le client d'équipe ne redouble pas son propre préfixe.
   *
   * `staffApi.get('/admin/moderation')` viserait `/v1/admin/admin/moderation` — un
   * 404 dont la cause est invisible à la lecture du code. Ce n'est pas une question
   * de sécurité, c'est une question de ne pas perdre une heure.
   */
  // @ts-expect-error — le préfixe /admin est déjà posé par le client d’équipe.
  void staffApi.get('/admin/moderation/cases', anything);
}

/**
 * LE SCHÉMA N'EST PAS FACULTATIF.
 *
 * C'est l'autre moitié du socle : il n'existe aucune variante d'appel sans schéma de
 * réponse, donc aucun moyen de contourner la frontière de validation. Un appel à un
 * argument ne compile pas.
 */
export function schemaObligatoire(): void {
  // @ts-expect-error — le schéma de réponse est obligatoire : la frontière n’est pas contournable.
  void memberApi.get('/me');

  // @ts-expect-error — idem côté équipe.
  void staffApi.get('/moderation/cases');
}
