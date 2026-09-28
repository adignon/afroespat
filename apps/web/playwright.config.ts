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
/**
 * LE PORT EST CONFIGURABLE, et ce n'est pas un confort.
 *
 * Ce dépôt se travaille en arbres de travail (`git worktree`) parallèles. Un port
 * codé en dur veut dire qu'un seul arbre peut être éprouvé au navigateur à la fois :
 * le second trouve le 3100 occupé, `reuseExistingServer` réutilise alors le serveur
 * du VOISIN, et la suite s'exécute contre un build qui n'est pas le sien. C'est
 * arrivé pendant ce lot, et le symptôme ne désigne pas la cause — on voit des 404
 * sur des routes qui existent pourtant dans le build local.
 *
 * Le symptôme n'est d'ailleurs pas toujours un échec : c'est souvent un SUCCÈS QUI
 * NE PROUVE RIEN — la suite passe, contre une application construite ailleurs.
 *
 * `WEB_PORT` laisse chaque arbre prendre le sien. Le défaut reste 3100, donc rien ne
 * change pour qui n'en a qu'un.
 */
const PORT = process.env.WEB_PORT ?? '3100';
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: '.',
  // Sur le chemin critique : un test instable fait plus de mal qu'un test absent.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: BASE_URL,
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

  /**
   * DEUX serveurs, et le second n'est pas un confort.
   *
   * L'écran du téléphone remplit son sélecteur d'indicatif depuis
   * `/places/countries` : sans l'API, le `<select>` est VIDE et le test
   * « l'indicatif suit le choix » expire sur un `selectOption('FR')` qui n'a aucune
   * option à choisir. Il a échoué exactement ainsi, et le message de Playwright ne
   * nomme pas la cause — il dit « waiting for element to be visible and enabled »,
   * parce qu'un `<select>` sans option, superposé et en `opacity: 0`, n'a pas de
   * taille.
   *
   * La dépendance existait donc depuis toujours, et elle était IMPLICITE : la suite
   * passait sur les machines où une API de développement tournait déjà, et échouait
   * ailleurs sans dire pourquoi. La déclarer est la seule façon de rendre la suite
   * autonome — et de faire que son échec, s'il revient, désigne la bonne chose.
   *
   * `reuseExistingServer` hors CI : on ne relance pas l'API de quelqu'un qui
   * développe. L'API a besoin de PostgreSQL et de Redis (les deux conteneurs du
   * dépôt) ; c'est ce que `/health` vérifie avant de répondre.
   */
  webServer: [
    {
      // `next start` directement : le script `start` porte déjà son propre port.
      command: `pnpm build && npx next start -p ${PORT}`,
      url: `${BASE_URL}/accueil`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: 'pnpm --filter @app/api dev',
      url: 'http://localhost:3001/v1/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
