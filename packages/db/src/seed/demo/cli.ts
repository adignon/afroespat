import { resolve } from 'node:path';
import { PrismaClient } from '../../../generated/client/index.js';
import { GRAINE_PAR_DEFAUT, genererDemo, purgerDonneesDeDepart } from './index.js';

/**
 * LA COMMANDE DES DONNÉES DE DÉPART.
 *
 *     pnpm --filter @app/db seed:demo                      génère (~120 membres et leurs contenus)
 *     pnpm --filter @app/db seed:demo --dry-run            écrit tout, affiche le rapport, ANNULE
 *     pnpm --filter @app/db seed:demo --purge              supprime tout ce qui est « de départ »
 *     pnpm --filter @app/db seed:demo --purge --dry-run    compte ce qui serait supprimé
 *     … --purge --fermer-villes                            referme aussi les villes que la génération a ouvertes
 *     … --seed=42                                          autre graine (autres noms et répartitions)
 *
 * Préalable : `pnpm --filter @app/db seed` (pays, villes, modèles de parcours, métiers, langues).
 *
 * EN PRODUCTION (`NODE_ENV=production`), la commande exige `--confirmer-production` : elle écrit dans la vraie base.
 * Faites d'abord une sauvegarde (`infra/backup-db.sh`) et lancez `--dry-run`.
 */

try {
  process.loadEnvFile(resolve(import.meta.dirname, '..', '..', '..', '..', '.env'));
} catch {
  /* rien à charger : les variables sont déjà dans l'environnement (conteneur) */
}

const args = new Set(process.argv.slice(2));
const valeur = (nom: string): string | undefined => process.argv.slice(2).find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3);

async function main(): Promise<number> {
  const log = (s: string): void => void process.stdout.write(`${s}\n`);
  const simulation = args.has('--dry-run');

  if (process.env['NODE_ENV'] === 'production' && !args.has('--confirmer-production')) {
    process.stderr.write(
      'NODE_ENV=production : cette commande écrit dans la base réelle. Relancez avec --confirmer-production (après sauvegarde, et un --dry-run).\n',
    );
    return 2;
  }
  const prisma = new PrismaClient();
  try {
    if (args.has('--purge')) {
      const r = await purgerDonneesDeDepart(prisma, { simulation, fermerVilles: args.has('--fermer-villes') });
      log(r.apercu ? 'Aperçu de la purge (rien n’est supprimé) :' : 'Purge faite :');
      log(`  comptes de départ : ${r.comptes}`);
      for (const [nom, n] of Object.entries(r.retire)) log(`  ${nom} : ${n}`);
      return 0;
    }
    const graine = valeur('seed') === undefined ? GRAINE_PAR_DEFAUT : Number(valeur('seed'));
    if (!Number.isInteger(graine)) throw new Error('--seed doit être un entier.');
    const r = await genererDemo(prisma, { graine, simulation, env: process.env, log });
    log(r.apercu ? '\nAperçu (transaction annulée, rien n’est écrit) :' : '\nGénération terminée :');
    for (const [nom, n] of Object.entries(r.compte)) log(`  ${nom} : ${n}`);
    return 0;
  } catch (erreur) {
    process.stderr.write(`Échec : ${erreur instanceof Error ? erreur.message : String(erreur)}\n`);
    return 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main().then((code) => {
  process.exitCode = code;
});
