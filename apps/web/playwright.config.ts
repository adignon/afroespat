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

/**
 * LE PORT DE L'API EST CONFIGURABLE POUR LA MÊME RAISON QUE CELUI DU WEB, et
 * l'oubli coûtait exactement le défaut décrit au-dessus — en pire.
 *
 * Il était codé à 3001. Deux arbres de travail côte à côte : le second trouve le
 * 3001 occupé, `reuseExistingServer` réutilise l'API DU VOISIN, et toute la suite
 * s'exécute contre un back qui n'est pas le sien. Mesuré pendant ce lot : une API
 * d'un autre arbre écoutait 3001, et rien dans la sortie de Playwright ne l'aurait
 * dit.
 *
 * Le symptôme est le pire qui existe : un SUCCÈS QUI NE PROUVE RIEN. La suite
 * passe, contre des routes construites ailleurs — et un échec, lui, accuse le code
 * local d'un défaut qui est dans le voisin.
 *
 * `API_PORT` est la même variable que celle du `.env` de l'API, donc les deux se
 * règlent ensemble. Le défaut reste 3001 : rien ne change pour qui n'a qu'un arbre.
 *
 * `NEXT_PUBLIC_API_URL` est passé au serveur web : sans lui, le navigateur
 * appellerait 3001 quel que soit le port de l'API, puisque c'est LUI qui compose
 * l'URL (voir `src/lib/api/base.ts`). Et `WEB_PORT` va sur les DEUX commandes —
 * l'API construit sa liste d'origines CORS avec, et une origine manquante fait
 * rejeter chaque réponse par le navigateur alors que le serveur répond 200. On voit
 * alors un sélecteur vide, jamais un refus : c'est l'heure déjà perdue ici.
 */
const API_PORT = process.env.API_PORT ?? '3001';
const API_URL = `http://localhost:${API_PORT}/v1`;

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
      // `NEXT_PUBLIC_…` est inlinée à la CONSTRUCTION : elle doit donc être là
      // pour `pnpm build`, pas seulement pour `next start`.
      env: { WEB_PORT: PORT, NEXT_PUBLIC_API_URL: API_URL },
      /**
       * VINGT MINUTES, et le chiffre est mesuré, pas choisi.
       *
       * `pnpm build` a pris 884 s (14 min 44 s) sur 124 écrans, machine chargée.
       * Les 180 s d'origine avaient été posées quand la suite en comptait une
       * trentaine ; la borne est devenue fausse par accumulation, pas par erreur.
       *
       * Son échec ne ressemblait à RIEN d'utile : « Timed out waiting 180000ms from
       * config.webServer », sans un mot sur la construction en cours. On croit à un
       * serveur qui refuse de démarrer, alors qu'il n'avait simplement pas fini.
       *
       * La marge est large exprès — le transcodage produit du JSX à styles en ligne,
       * donc le temps de construction croît avec chaque maquette ajoutée. Une borne
       * serrée redeviendrait fausse au lot suivant, et son message ne le dirait pas
       * davantage. Si elle est atteinte un jour, c'est que quelque chose est vraiment
       * bloqué.
       */
      timeout: 1_200_000,
    },
    {
      command: 'pnpm --filter @app/api dev',
      url: `${API_URL}/health`,
      reuseExistingServer: !process.env.CI,
      // `WEB_PORT` ici aussi : c'est `apps/api/src/main.ts` qui en construit sa
      // liste d'origines autorisées. Sans lui, CORS bloque tout en silence.
      env: { WEB_PORT: PORT, API_PORT },
      timeout: 120_000,
    },
  ],
});
