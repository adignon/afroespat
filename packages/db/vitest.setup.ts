import { resolve } from 'node:path';

// En local, le .env de la racine ; en CI, les variables sont déjà là.
try {
  process.loadEnvFile(resolve(__dirname, '..', '..', '.env'));
} catch {
  /* rien à charger */
}
