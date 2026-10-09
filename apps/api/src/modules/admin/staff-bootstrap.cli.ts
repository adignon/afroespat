import { AuditService } from '../../common/audit.service';
import { PrismaService } from '../../common/prisma.service';
import { loadEnv } from '../../config/env';
import {
  STAFF_BOOTSTRAP_ENV,
  StaffBootstrapRefusal,
  bootstrapStaffUser,
} from './staff-bootstrap';

/**
 * La commande d'amorçage. **Hors ligne, jamais une route.**
 *
 *     STAFF_BOOTSTRAP_EMAIL=… STAFF_BOOTSTRAP_DISPLAY_NAME=… STAFF_BOOTSTRAP_PASSWORD=… \
 *       pnpm --filter @app/api staff:bootstrap
 *
 * Exposer l'amorçage en HTTP en aurait fait une porte dérobée joignable depuis
 * l'Internet : il faut un accès au serveur pour l'exécuter, et c'est le point.
 *
 * `@swc-node/register` et non `tsx` : par cohérence avec `pnpm dev` du même
 * paquet. Ce script n'emploie pourtant AUCUNE injection NestJS — il instancie
 * `PrismaService` (qui n'est qu'un `PrismaClient` décoré) et `AuditService` à la
 * main, pour ne pas démarrer le conteneur entier (files BullMQ, Redis,
 * passerelle temps réel, 56 tâches planifiées) juste pour écrire une ligne.
 *
 * Codes de sortie, pour qu'un script d'exploitation puisse les distinguer :
 *
 *     0  compte créé
 *     2  REFUS : configuration absente ou invalide
 *     3  REFUS : un compte d'équipe existe déjà (rejeu — rien n'a été touché)
 *     1  panne inattendue
 *
 * `3` est séparé de `2` délibérément : un rejeu dans un script de déploiement
 * idempotent n'est pas la même chose qu'une configuration oubliée. Le choix de
 * traiter `3` comme « rien à faire » appartient à l'exploitant ; ce script ne le
 * prend pas pour lui.
 */
async function main(): Promise<number> {
  const out = (s: string): void => void process.stdout.write(`${s}\n`);
  const err = (s: string): void => void process.stderr.write(`${s}\n`);

  // Valide la configuration de l'application (§11.2) et charge le `.env` de la
  // racine. Sans cela, `DATABASE_URL` manquerait et l'échec parlerait de Prisma
  // plutôt que de la variable absente.
  loadEnv();

  const prisma = new PrismaService();
  await prisma.$connect();
  const audit = new AuditService(prisma);

  try {
    const created = await bootstrapStaffUser(prisma, audit, process.env);
    out('Premier compte d’équipe créé.');
    out(`  identifiant  : ${created.id}`);
    out(`  email        : ${created.email}`);
    out(`  nom affiché  : ${created.displayName}`);
    out(`  rôle         : ${created.role}`);
    out('');
    out('Le mot de passe n’est PAS réaffiché : il n’a été ni journalisé, ni stocké en');
    out('clair (argon2id). Transmettez-le par le canal que vous avez choisi.');
    out('');
    out('La DOUBLE AUTHENTIFICATION est à enrôler à la première connexion (15 §2.1,');
    out('planche D01 « ENRÔLEMENT FORCÉ »). Le parcours est :');
    out('  1. POST /v1/admin/auth/login         → { challenge, enrollmentRequired: true }');
    out('  2. POST /v1/admin/auth/totp/enroll   → { secret, uri } — à scanner');
    out('  3. POST /v1/admin/auth/totp/confirm  → ouvre la session (cookie dp_staff)');
    out('');
    out('Les comptes suivants se créent depuis l’administration (POST /v1/admin/staff).');
    out('Cette commande REFUSERA de se rejouer : elle n’est pas une porte dérobée.');
    return 0;
  } catch (error) {
    if (error instanceof StaffBootstrapRefusal) {
      err(error.message);
      return error.reason === 'STAFF_ALREADY_EXISTS' ? 3 : 2;
    }
    err(`Amorçage interrompu : ${String(error)}`);
    return 1;
  } finally {
    await prisma.$disconnect();
  }
}

void (async () => {
  try {
    process.exitCode = await main();
  } catch (error) {
    process.stderr.write(
      `Amorçage impossible : ${String(error)}\n` +
        `Les variables attendues sont ${Object.values(STAFF_BOOTSTRAP_ENV).join(', ')}.\n`,
    );
    process.exitCode = 1;
  }
})();
