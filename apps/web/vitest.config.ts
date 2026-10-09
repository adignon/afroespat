import { fileURLToPath } from 'node:url';
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
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ L'ALIAS `@/`, QUE VITEST NE CONNAISSAIT PAS                             ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * `tsconfig.json` et Next le résolvent depuis toujours ; cette configuration,
   * non — et ça n'avait jamais mordu parce qu'aucun module ATTEINT PAR UN TEST
   * ne l'employait : les écrans générés n'importaient que `./data` et
   * `next/link`.
   *
   * Le premier `@/` dans un écran généré — les contrôles de la barre haute — a
   * fait tomber `declencheur.test.tsx` d'un coup : « Failed to resolve import ».
   * Le fichier ne collectait plus AUCUN cas, et le total passait de 336 à 324
   * sans qu'une seule assertion rougisse. Un fichier qui ne collecte rien est le
   * pire des échecs : il se lit comme une suite plus courte.
   */
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'visual/**', 'node_modules/**'],
    environment: 'jsdom',
    globals: true,
  },
});
