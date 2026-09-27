import { resolve } from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

try {
  process.loadEnvFile(resolve(__dirname, '..', '..', '.env'));
} catch {
  /* en CI les variables sont déjà là */
}

export default defineConfig({
  // SWC, et non esbuild : NestJS résout l'injection de dépendances via les
  // métadonnées de décorateur (`design:paramtypes`), qu'esbuild n'émet pas.
  // Sans cela, les services arrivent `undefined` dans les contrôleurs — sans
  // erreur au démarrage, ce qui rend le symptôme difficile à relier à sa cause.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: { include: ['src/**/*.int.test.ts'], environment: 'node', pool: 'forks' },
});
