import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONTRACTS, DEMO_ROUTES } from './contracts';
import { startDemoServer } from './server';

/**
 * `pnpm demo:providers` — lance le serveur démo des fournisseurs.
 *
 * Charge `.env.demo` (puis `.env.demo.example`) à la racine du dépôt s'il existe : les
 * variables déjà posées dans le shell gagnent. Le MÊME fichier configure l'API
 * (`PROVIDER_MODE=demo`) et ce serveur.
 */
function loadEnvFile(): string | null {
  let dir = __dirname;
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) {
      for (const name of ['.env.demo', '.env.demo.example']) {
        const file = resolve(dir, name);
        if (existsSync(file)) {
          process.loadEnvFile(file);
          return file;
        }
      }
      return null;
    }
    dir = resolve(dir, '..');
  }
  return null;
}

async function main(): Promise<void> {
  const file = process.env['DEMO_SKIP_ENV_FILE'] === '1' ? null : loadEnvFile();
  const demo = await startDemoServer();
  const out = (s: string): void => void process.stdout.write(`${s}\n`);
  out(`Serveur démo des fournisseurs : ${demo.url}  (écoute ${demo.config.host}:${demo.port}, HTTP + clamd sur le même port)`);
  out(`Clés lues depuis ${file ?? 'les valeurs par défaut'}.`);
  out(`Boîte de lecture : ${demo.url}/__demo/inbox   Remise à zéro : POST ${demo.url}/__demo/reset`);
  for (const c of CONTRACTS) out(`  ${c.provider.padEnd(9)} ${c.method.padEnd(6)} ${c.path}`);
  for (const r of DEMO_ROUTES) out(`  demo      ${r}`);
  const stop = (): void => void demo.close().then(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

void main();
