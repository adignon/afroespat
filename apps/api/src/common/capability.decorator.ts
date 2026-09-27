import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';
import type { Capability } from '@app/shared';

/**
 * Déclaration de capacité sur une route — 00-fondations.md §7.3.
 *
 * RÈGLE DURE : « Toute route d'écriture déclare une capacité requise. Un test
 * d'intégration parcourt toutes les routes et échoue si une route non-GET n'en
 * déclare pas. » Ce test vit dans src/common/__tests__/capability-coverage.int.test.ts.
 *
 * Le décorateur fait deux choses d'un coup :
 *   · pose la métadonnée que le garde lit à l'exécution ;
 *   · émet `x-capability` dans l'OpenAPI, que T4 §9 exige sur chaque route.
 *
 * Une route de LECTURE publique se déclare explicitement `@PublicRead()` plutôt
 * que d'omettre le décorateur : l'omission devient alors toujours une erreur, et
 * non « peut-être un oubli, peut-être volontaire ».
 */

export const CAPABILITY_KEY = 'app:capability';
export const PUBLIC_READ_KEY = 'app:publicRead';

export function RequiresCapability(capability: Capability) {
  return applyDecorators(
    SetMetadata(CAPABILITY_KEY, capability),
    ApiExtension('x-capability', capability),
  );
}

/**
 * Route de lecture ouverte, sans capacité. À employer sciemment : une lecture
 * reste soumise aux règles de visibilité du module (un parcours privé, un réseau
 * fermé, un membre bloqué ne sont jamais renvoyés).
 */
export function PublicRead() {
  return applyDecorators(
    SetMetadata(PUBLIC_READ_KEY, true),
    ApiExtension('x-capability', 'none:public-read'),
  );
}

/**
 * Limite de débit propre à la route. Par défaut 120 requêtes/min et 30
 * écritures/min par membre (§5.5) ; les routes sensibles resserrent.
 */
export function RateLimit(perMinute: number) {
  return applyDecorators(
    SetMetadata('app:rateLimit', perMinute),
    ApiExtension('x-rate-limit', `${perMinute}/min`),
  );
}
