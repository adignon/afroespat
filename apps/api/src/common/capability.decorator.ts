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
 * WEBHOOK ENTRANT SIGNÉ — T4 §8.
 *
 * Une route d'écriture qui n'a AUCUN membre, et aucun compte d'équipe : c'est un
 * fournisseur qui appelle. Elle ne peut donc déclarer ni capacité — aucune de la
 * matrice du §7.3 ne lui va — ni rôle, et elle ne peut pas non plus se taire,
 * puisque le test de couverture exige un `x-capability` sur toute route non-GET.
 *
 * D'où ce troisième décorateur. Il réemploie la métadonnée de `@PublicRead()` —
 * « le garde ne demande rien » — parce que l'autorisation d'un webhook n'est pas
 * un jeton mais une SIGNATURE, vérifiée dans le service, qui seul détient le
 * secret du bon fournisseur. Une route de webhook qui exigerait un jeton de membre
 * serait une route qu'aucun fournisseur ne pourrait appeler.
 *
 * LA CAPACITÉ NOMME LE FOURNISSEUR — `webhook:stripe`, `webhook:didit` — et non
 * une sentinelle générique. Deux agents ont proposé les deux formes, et celle-ci
 * est la bonne : `none:public-read` satisferait le test en MENTANT sur la nature
 * de la route, et l'on chercherait ensuite pourquoi une « lecture publique »
 * accepte des POST. Le préfixe `webhook:` ne peut pas être confondu avec une
 * capacité de `@app/shared`, exactement comme `staff:`.
 *
 * IL N'Y A PAS DE MÉTADONNÉE PROPRE AUX WEBHOOKS, et c'est délibéré.
 *
 * Une version de ce décorateur posait aussi une clé `app:signedWebhook`, « pour
 * pouvoir les énumérer ». Personne ne la lisait : le test
 * `metadata-consumed.test.ts` l'a signalée à la fusion suivante, et il avait
 * raison. Le `x-capability` fait déjà ce travail — il est dans l'OpenAPI, il nomme
 * le fournisseur, et `capability-coverage.int.test.ts` l'énumère. Deux marqueurs
 * pour un seul fait, c'est un fait qui finit par diverger.
 *
 * Aucune route ne doit porter ce décorateur sans vérifier la signature dès sa
 * première ligne : sans cela, elle serait une écriture ouverte à tout l'Internet.
 * La liste FERMÉE du test de couverture est ce qui l'impose — une route de webhook
 * de plus fait rougir le test, donc oblige à venir dire pourquoi elle en est une.
 */
export function SignedWebhook(provider: string) {
  return applyDecorators(
    // Le garde n'a pas de branche propre aux webhooks : il n'en a pas besoin, et
    // lui en ajouter une serait un chemin d'autorisation de plus à auditer.
    SetMetadata(PUBLIC_READ_KEY, true),
    ApiExtension('x-capability', `webhook:${provider}`),
  );
}

/**
 * Limite de débit propre à la route. Par défaut 120 requêtes/min et 30
 * écritures/min par membre (§5.5) ; les routes sensibles resserrent.
 *
 * La clé est une CONSTANTE EXPORTÉE, et non plus une chaîne écrite ici et
 * relue ailleurs. Pendant longtemps ce décorateur ne limitait rien du tout :
 * il posait sa métadonnée, annonçait `x-rate-limit` dans l'OpenAPI, et
 * personne ne la lisait — une seule occurrence de « app:rateLimit » dans tout
 * le dépôt, sa propre déclaration. Quinze contrôleurs déclaraient une limite,
 * dont les routes d'OTP qui coûtent un SMS par appel. Une chaîne écrite deux
 * fois peut diverger en silence ; un symbole importé ne peut pas.
 *
 * Le garde qui la lit est `RateLimitGuard` (`common/rate-limit.guard.ts`).
 */
export const RATE_LIMIT_KEY = 'app:rateLimit';

/**
 * La période d'un budget de route.
 *
 * ELLE N'EXISTAIT PAS, et son absence rendait plusieurs règles inexprimables.
 *
 * `@RateLimit(n)` voulait dire « n par minute », point. Or les spécifications
 * énoncent souvent l'heure : 01 §4.4 écrit « `PATCH /me` 20/h » et 01 §2 « 10 par
 * IP et par heure » pour l'envoi d'un code. Ces routes portaient donc
 * `@RateLimit(20)` et `@RateLimit(10)` — soixante fois plus permissif que la
 * règle, avec un commentaire qui citait l'heure juste au-dessus. Tant que le
 * décorateur ne limitait rien, l'écart ne coûtait rien ; le rendre effectif l'a
 * mis au jour.
 *
 * La journée n'est PAS proposée. Les quotas journaliers des spécifications
 * (« 30 publications/jour », « 3 stories/jour », « 10 contacts/jour ») sont des
 * règles MÉTIER : elles doivent survivre à un redémarrage de Redis, être lisibles
 * par le membre, et compter des objets créés — pas des requêtes reçues. Elles
 * appartiennent au service, qui compte des lignes en base. Une limite de débit
 * protège la minute et l'heure ; au-delà, c'est un quota, et ce n'est pas la même
 * chose.
 */
export type RateLimitPeriod = 'minute' | 'hour';

export interface RateLimitRule {
  readonly count: number;
  readonly period: RateLimitPeriod;
}

export function RateLimit(count: number, period: RateLimitPeriod = 'minute') {
  const rule: RateLimitRule = { count, period };
  return applyDecorators(
    SetMetadata(RATE_LIMIT_KEY, rule),
    ApiExtension('x-rate-limit', `${count}/${period === 'hour' ? 'h' : 'min'}`),
  );
}

/**
 * Route qu'un compte SUSPENDU peut appeler, bien qu'elle écrive.
 *
 * §7.3 refuse toute écriture à un compte suspendu, et c'est juste : un membre
 * sanctionné ne doit pas continuer à publier. Mais `13` §4.3 lui donne le droit
 * de CONTESTER sa sanction, et contester est une écriture.
 *
 * Sans cette exemption, la contestation renvoyait `403 ACCOUNT_SUSPENDED` — donc
 * une sanction sans recours effectif, ce qui n'est pas une sanction mais une
 * exclusion. Le piège était double : la suspension révoque les sessions, le membre
 * se reconnecte, et c'est son jeton NEUF qui porte `SUSPENDED` — le refus
 * n'apparaissait qu'à ce moment-là.
 *
 * À employer avec parcimonie, et seulement là où un droit du membre l'exige. Toute
 * route qui le porte doit se justifier en une phrase, ici ou dans son commentaire.
 */
export const ALLOW_SUSPENDED_KEY = 'app:allowSuspended';

export function AllowSuspended() {
  return applyDecorators(
    SetMetadata(ALLOW_SUSPENDED_KEY, true),
    ApiExtension('x-allow-suspended', true),
  );
}
