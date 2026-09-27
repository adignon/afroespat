import 'reflect-metadata';
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
  });

  // Préfixe /v1 pour les membres, /v1/admin pour l'équipe (§5.1).
  app.setGlobalPrefix('v1');

  // Pas de ValidationPipe de Nest : elle repose sur class-validator, alors que
  // §4 fait des schémas zod de packages/shared la source unique. Chaque route
  // déclare son schéma via `zodPipe()`.
  app.useGlobalFilters(new ApiErrorFilter());

  // Deux origines seulement, déclarées : le front membres et le front équipe.
  app.enableCors({
    origin: [env.WEB_ORIGIN, env.ADMIN_ORIGIN],
    credentials: true, // le jeton de rafraîchissement est un cookie (T4 §2)
  });

  // §8.3 — en-têtes de sécurité. La CSP complète viendra avec les domaines des
  // fournisseurs ; ceux-ci n'en dépendent pas.
  app.use((_req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
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
