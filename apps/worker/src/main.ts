import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { createWorkerContext, loadEnv } from '@app/api';

/**
 * Worker — 00-fondations.md §3.1.
 *
 * « apps/api et apps/worker partagent le MÊME code. Le worker démarre le même
 * module racine avec les processeurs de files actifs et le serveur HTTP
 * désactivé (variable APP_ROLE). »
 *
 * D'où `createApplicationContext` plutôt que `create` : même arbre de
 * dépendances, même configuration, même base — sans serveur HTTP. Elle est
 * appelée DEPUIS `@app/api` (`createWorkerContext`) et non ici, et ce n'est pas
 * un détail d'organisation : le lockfile porte DEUX variantes de `@nestjs/core`,
 * et selon l'installation `apps/api` et `apps/worker` peuvent ne pas recevoir la
 * même. Importer `NestFactory` ici faisait alors échouer le démarrage sur un
 * `Reflector` introuvable — donc ni relais de boîte d'envoi, ni tâches
 * planifiées, ni files. Voir `worker-context.ts` ; la règle est gardée par
 * `__tests__/no-nest-core-import.test.ts`.
 *
 * Partager le code, et non le dupliquer, garantit qu'une règle métier écrite
 * dans un service vaut aussi bien pour une requête que pour une tâche planifiée.
 * Deux implémentations divergeraient en quelques semaines.
 *
 * Ce qui ne tourne QUE ici :
 *   · le relais de la boîte d'envoi (§9.1), toutes les secondes ;
 *   · les 22 tâches planifiées de §9.3, protégées par un verrou Redis ;
 *   · les consommateurs des neuf files de §9.2.
 */
async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const logger = new Logger('worker');

  if (env.APP_ROLE !== 'worker') {
    logger.error(
      `APP_ROLE vaut « ${env.APP_ROLE} » : le worker refuse de démarrer.\n` +
        'Sans cela, le relais de la boîte d’envoi ne serait pas chargé et les ' +
        'événements de domaine resteraient en attente, sans erreur visible.',
    );
    process.exit(1);
  }

  const app = await createWorkerContext();
  app.enableShutdownHooks();

  logger.log(`${env.APP_NAME} — worker démarré (${env.NODE_ENV})`);

  // Arrêt propre : on laisse les jobs en cours se terminer plutôt que de les
  // interrompre au milieu d'une transaction.
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      logger.log(`${signal} reçu — arrêt en cours`);
      void app.close().then(() => process.exit(0));
    });
  }
}

void bootstrap();
