import { defineConfig } from 'vitest/config';

/**
 * Tests unitaires de l'application web.
 *
 * Les suites `e2e/` et `visual/` appartiennent à Playwright : elles importent
 * `@playwright/test` et n'ont rien à faire ici. Sans cette exclusion, Vitest les
 * ramasse et échoue sans rien dire d'utile.
 */
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'visual/**', 'node_modules/**'],
    environment: 'jsdom',
    globals: true,
  },
});
