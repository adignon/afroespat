import { defineConfig, devices } from '@playwright/test';

/**
 * Deux suites, pour deux natures de vérification. La distinction n'est pas
 * cosmétique : elle décide de ce qui est tenable sur douze lots.
 *
 *  · `e2e/` — assertions de GÉOMÉTRIE et de JETONS. Déterministes : une largeur
 *    de rail, une hauteur de bouton, une couleur calculée valent la même chose
 *    sur macOS et sur Linux. Bloquantes en CI.
 *
 *  · `visual/` — comparaisons d'IMAGES. Utiles à l'œil humain, mais le rendu des
 *    polices et l'anti-crénelage diffèrent d'un système à l'autre : une référence
 *    prise sur macOS ne correspondra jamais à la CI Linux. Elles tournent donc à
 *    part, avec des références suffixées par plateforme, et ne bloquent pas la CI.
 *
 * Pourquoi ne pas tout jouer en pixels : sur 86 écrans × 2 tailles, des diffs
 * d'un pixel d'anti-crénelage produisent des échecs quotidiens que personne ne
 * lit plus au bout d'un mois. Ce qui doit vraiment être tenu — les jetons, les
 * dimensions, la cible tactile, l'absence d'ombre — se mesure exactement.
 */
export default defineConfig({
  testDir: '.',
  // Sur le chemin critique : un test instable fait plus de mal qu'un test absent.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: 'http://localhost:3100',
    trace: 'on-first-retry',
    // Fige ce qui varie d'une machine à l'autre.
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    colorScheme: 'light',
  },

  // Références suffixées par plateforme : macOS et Linux ne rendent pas pareil.
  snapshotPathTemplate: '{testDir}/__snapshots__/{testFilePath}/{arg}-{platform}{ext}',

  expect: {
    toHaveScreenshot: {
      // Tolérance pour l'anti-crénelage, pas pour un changement de design.
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
    },
  },

  projects: [
    {
      name: 'ordinateur',
      testMatch: /e2e\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
    {
      name: 'mobile',
      testMatch: /e2e\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
    {
      name: 'visuel',
      testMatch: /visual\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    // `next start` directement : le script `start` porte déjà son propre port.
    command: 'pnpm build && npx next start -p 3100',
    url: 'http://localhost:3100/accueil',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
