import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // Les variables d'environnement viennent du .env de la racine (§11.2).
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: { alias: { '@app/shared': new URL('../shared/src/index.ts', import.meta.url).pathname } },
});
