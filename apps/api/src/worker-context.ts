import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PinoNestLogger, initSentry } from './common/observability';

/**
 * Le démarrage du contexte applicatif du worker — 00-fondations.md §3.1.
 *
 * POURQUOI CE FICHIER EXISTE, et pourquoi le worker ne doit PLUS appeler
 * `NestFactory` lui-même.
 *
 * Le worker ne démarrait pas — dans un worktree fraîchement installé. Pas
 * « mal » : pas du tout, sur un message qui n'a rien à voir avec la cause :
 *
 *     Nest can't resolve dependencies of the AuthGuard (?, TokenService,
 *     PrismaService). Please make sure that the argument Reflector at index [0]
 *     is available in the AppModule context.
 *
 * LE LOCKFILE PORTE DEUX VARIANTES de `@nestjs/core`, et c'est le fait vérifiable
 * dont tout découle :
 *
 *   · `@nestjs/core@10.4.22(...)(@nestjs/platform-express@10.4.22)(...)`, pour un
 *     paquet qui dépend d'une plateforme HTTP — `apps/api` ;
 *   · `@nestjs/core@10.4.22` NUE, pour un paquet qui n'en dépend pas —
 *     `apps/worker`.
 *
 * LAQUELLE chaque paquet reçoit dépend de L'INSTALLATION. Dans l'arbre principal
 * d'aujourd'hui, `apps/api` et `apps/worker` pointent vers la MÊME : le défaut ne
 * s'y manifeste pas, et on peut le vérifier en lisant les deux liens symboliques.
 * Sur une installation propre — un worktree neuf, la CI, l'image Docker de
 * production — la résolution peut scinder, et elle scinde : c'est ainsi que le
 * défaut a été rencontré.
 *
 * Quand elle scinde, il y a DEUX classes `Reflector` distinctes. `NestFactory`
 * importée par le worker enregistre celui de son instance ; `AuthGuard`, compilée
 * dans `apps/api`, réclame celui de l'autre. Aucun jeton ne correspond, et
 * l'injection échoue en accusant une classe étrangère au problème.
 * (`@nestjs/common` n'a, lui, qu'une seule variante : d'où un échec qui ne touche
 * QUE `Reflector`, ce qui achève de rendre le symptôme trompeur.)
 *
 * CE QUE CELA COÛTE : le worker est le seul processus qui fasse tourner le relais
 * de la boîte d'envoi (§9.1), les tâches planifiées (§9.3) et les consommateurs
 * des neuf files (§9.2). Là où la scission se produit, AUCUN événement de domaine
 * n'est distribué et AUCUN balayage ne passe. Ce n'est donc pas un défaut visible
 * qu'on répare : c'est une mine qui attend le premier déploiement propre.
 *
 * LA CORRECTION NE CHOISIT PAS UNE VARIANTE, elle rend la question sans objet :
 * `NestFactory` n'est plus importée que depuis CE paquet, donc la fabrique et les
 * gardes viennent forcément de la même instance, quelle que soit celle que
 * l'installation a retenue. Aligner les `package.json` aurait au contraire été à
 * refaire à chaque changement de pairs — ce lot ajoute justement
 * `@nestjs/websockets` à `apps/api`.
 *
 * `apps/worker/src/__tests__/no-nest-core-import.test.ts` garde l'invariant.
 *
 * Constaté en LANÇANT le worker, jamais en le relisant.
 */
export async function createWorkerContext(): Promise<INestApplicationContext> {
  await initSentry();
  return NestFactory.createApplicationContext(AppModule, {
    logger: new PinoNestLogger(),
  });
}
