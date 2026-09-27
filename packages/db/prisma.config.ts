import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Prisma 6.19 ne charge plus .env tout seul quand un fichier de config existe.
// La racine du monorepo porte le .env unique (§11.2 : toute configuration par
// variables d'environnement, validées au démarrage).
const envPath = path.resolve(__dirname, '..', '..', '.env');
try {
  process.loadEnvFile(envPath);
} catch {
  // En CI, les variables sont déjà dans l'environnement : rien à charger.
}

// Schéma multi-fichiers : un fichier par module du modèle relationnel (§6.3).
export default defineConfig({
  schema: path.join('prisma', 'schema'),
  migrations: { path: path.join('prisma', 'migrations'), seed: 'tsx src/seed/index.ts' },
});
