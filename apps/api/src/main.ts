import 'reflect-metadata';
import cookieParser from 'cookie-parser';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ApiErrorFilter } from './common/error.filter';
import { loadEnv } from './config/env';

/**
 * Démarrage de l'API — 00-fondations.md §3.1 et §5.1.
 *
 * `apps/api` et `apps/worker` partagent le même code : le worker démarre le même
 * module racine avec les processeurs de files actifs et le serveur HTTP coupé
 * (variable APP_ROLE).
 */
async function bootstrap(): Promise<void> {
  // Avant tout le reste : l'application refuse de démarrer si une variable
  // manque (§11.2). Mieux vaut échouer ici qu'à la première écriture.
  const env = loadEnv();
  const logger = new Logger('bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: env.NODE_ENV === 'production' ? ['error', 'warn', 'log'] : ['error', 'warn', 'log', 'debug'],
    /**
     * Le corps BRUT est conservé, en plus du JSON analysé — T4 §8.
     *
     * Les webhooks entrants (`/webhooks/didit`, et demain Stripe et Mobile Money)
     * ont une signature HMAC qui porte sur les OCTETS REÇUS. Reconstruire ces
     * octets depuis l'objet analysé est impossible en pratique : l'ordre des clés,
     * les espaces et l'échappement Unicode ne se devinent pas, et `JSON.stringify`
     * produit une chaîne qui ressemble à l'originale sans lui être identique — donc
     * une signature qui ne correspond jamais. Sans ce drapeau, tout webhook signé
     * repart en `401`, et aucune vérification d'identité n'aboutit.
     */
    rawBody: true,
  });

  // Préfixe /v1 pour les membres, /v1/admin pour l'équipe (§5.1).
  app.setGlobalPrefix('v1');

  // Pas de ValidationPipe de Nest : elle repose sur class-validator, alors que
  // §4 fait des schémas zod de packages/shared la source unique. Chaque route
  // déclare son schéma via `zodPipe()`.
  app.useGlobalFilters(new ApiErrorFilter());

  // Le jeton de rafraîchissement est un cookie httpOnly (T4 §2) : sans ce
  // lecteur, `request.cookies` est indéfini et le rafraîchissement échoue
  // silencieusement, comme si la session avait expiré.
  app.use(cookieParser());

  /**
   * Origines DÉCLARÉES : le front membres et le front équipe (§8.3).
   *
   * Hors production s'y ajoute `:3100`, où les tests de bout en bout servent la
   * compilation de production (`playwright.config.ts`). Sans elle, le navigateur
   * de test rejette chaque réponse alors que le serveur répond 200 — et le
   * parcours d'inscription échoue sans qu'aucun journal ne l'explique.
   *
   * Le PORT suit `WEB_PORT`, la même variable que `apps/web/playwright.config.ts`,
   * et c'est une leçon payée : le dépôt se travaille en plusieurs arbres, 3100 s'y
   * trouve occupé, et la suite lancée sur un autre port voyait le serveur répondre
   * 200 pendant que le navigateur jetait chaque réponse. Le message de Playwright ne
   * nomme jamais la cause — il dit « did not find some options » sur un `<select>`
   * resté vide. Les deux côtés lisent donc la même variable : régler l'un sans
   * l'autre n'est plus possible.
   *
   * En PRODUCTION la liste reste à deux entrées : une origine de test ouverte
   * là-bas serait une porte laissée entrebâillée, et `WEB_PORT` n'y change rien.
   */
  const origins = [env.WEB_ORIGIN, env.ADMIN_ORIGIN];
  if (env.NODE_ENV !== 'production') {
    origins.push(`http://localhost:${process.env['WEB_PORT'] ?? '3100'}`);
  }

  app.enableCors({
    origin: origins,
    credentials: true, // le jeton de rafraîchissement est un cookie (T4 §2)
  });

  // §8.3 — en-têtes de sécurité. La CSP complète viendra avec les domaines des
  // fournisseurs ; ceux-ci n'en dépendent pas.
  app.use((_req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    /**
     * ╔══════════════════════════════════════════════════════════════════════════╗
     * ║ RIEN DE CE QUE CETTE API REND NE SE RANGE DANS UN CACHE                 ║
     * ╚══════════════════════════════════════════════════════════════════════════╝
     *
     * Toutes les réponses sont PERSONNELLES — ce qu'un membre a vu, ses signets,
     * ses messages, son niveau. Elles portaient un `ETag` et AUCUN `Cache-Control` :
     * une réponse ainsi faite est « heuristiquement fraîche », c'est-à-dire que le
     * navigateur a le droit de la resservir sans redemander, pour une durée qu'il
     * choisit seul.
     *
     * MESURÉ, et c'est le porteur qui l'a vu : « je clique sur un story mais ça ne
     * montre pas que c'est lu même quand je rafraîchis la page ». Le ruban revenait
     * du cache, anneaux verts compris.
     *
     * `no-store` plutôt que `no-cache` : le premier interdit d'ÉCRIRE la réponse sur
     * disque, le second autorise à la garder en revalidant. Des données personnelles
     * n'ont pas à être écrites, ni ici ni dans un relais intermédiaire.
     */
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // OpenAPI 3.1, servi HORS production (§5.1). Chaque route porte son
  // `x-capability` et son `x-rate-limit` via les décorateurs (T4 §9).
  if (env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle(`${env.APP_NAME} — API membres`)
      .setDescription(
        'Conventions : pagination par curseur, erreurs `error { code, message, details }`, ' +
          'montants en centimes, dates ISO 8601 UTC. Voir docs/specs/T4-api-runbook-decisions.md.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('v1/docs', app, SwaggerModule.createDocument(app, config));
    logger.log(`OpenAPI : http://localhost:${env.API_PORT}/v1/docs`);
  }

  await app.listen(env.API_PORT, '0.0.0.0');
  logger.log(`${env.APP_NAME} — API sur http://localhost:${env.API_PORT}/v1 (${env.NODE_ENV})`);
}

void bootstrap();
