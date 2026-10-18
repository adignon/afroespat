import { CryptoService } from './crypto.service';
import { PrismaService } from './prisma.service';
import { loadEnv } from '../config/env';
import { rotateKeys } from './rotate-keys';

/**
 * `pnpm --filter @app/api rotate-keys [--dry-run]` — voir `rotate-keys.ts` pour la
 * procédure. Code de sortie 0 si rien n'a échoué, 1 sinon (un blob illisible avec
 * toutes les clés connues veut dire qu'une ancienne clé manque dans `*_KEYS_PREVIOUS`).
 */
async function main(): Promise<number> {
  loadEnv();
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const dryRun = process.argv.includes('--dry-run');
    const reports = await rotateKeys(prisma, new CryptoService(), { dryRun });
    process.stdout.write(`${dryRun ? 'SIMULATION — rien n’est écrit.\n' : ''}`);
    for (const r of reports) {
      process.stdout.write(
        `${r.column.padEnd(40)} lus ${r.scanned} · à jour ${r.alreadyCurrent} · réécrits ${r.rewritten} · illisibles ${r.failed}\n`,
      );
    }
    return reports.some((r) => r.failed > 0) ? 1 : 0;
  } finally {
    await prisma.$disconnect();
  }
}

void main().then((code) => {
  process.exitCode = code;
});
