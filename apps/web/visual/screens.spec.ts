import { expect, test } from '@playwright/test';
import { connecter } from '../e2e/session';

/**
 * Comparaison d'images — suite SÉPARÉE, non bloquante en CI.
 *
 * Les références sont suffixées par plateforme : une capture macOS ne
 * correspondra jamais à une CI Linux (rendu des polices, anti-crénelage). Pour
 * obtenir des références utilisables en CI, on régénère dans l'image officielle :
 *
 *   docker run --rm -v "$PWD":/w -w /w mcr.microsoft.com/playwright:v1.49.0-noble \
 *     pnpm --filter @app/web test:visual -- --update-snapshots
 *
 * Ce que cette suite apporte que les assertions de géométrie n'apportent pas :
 * l'œil. Un écart d'espacement, un alignement cassé, une carte qui déborde se
 * voient sur un diff d'image et ne se mesurent pas facilement.
 *
 * ╔════════════════════════════════════════════════════════════════════════╗
 * ║ CETTE SUITE NE PHOTOGRAPHIAIT RIEN — et sa référence datait d'avant l'API  ║
 * ╚════════════════════════════════════════════════════════════════════════╝
 *
 * DEUX DÉFAUTS, et le second découle du premier :
 *
 *   1. `goto` attendait `networkidle`, que `/accueil` n'atteint JAMAIS — Next
 *      précharge les liens visibles. Les deux captures expiraient donc à 30 s
 *      comme à 120 s : elles étaient comptées échouées sans rien comparer ;
 *   2. la suite n'ouvrait AUCUNE SESSION. `/accueil` est gardé : sans session,
 *      elle aurait photographié un écran de reprise, pas le fil. La référence
 *      stockée, elle, date du 27 septembre — du temps où la page était ENTIÈREMENT
 *      dessinée et ne parlait à personne : 2 465 px de haut contre 844 aujourd'hui.
 *
 * Les deux sont corrigés, et la référence a été REFAITE délibérément — celle
 * d'avant ne montrait pas l'écran que les membres voient.
 */

const VIEWPORTS = [
  { name: 'ordinateur', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

const SCREENS = [{ path: '/accueil', id: 'A01-fil' }] as const;

for (const vp of VIEWPORTS) {
  for (const screen of SCREENS) {
    test(`${screen.id} — ${vp.name}`, async ({ context, page, request }) => {
      await connecter(context, request, { displayName: 'Awa Konaté' });
      await page.setViewportSize({ width: vp.width, height: vp.height });
      /**
       * `load` ET NON `networkidle` : Next précharge les liens visibles d'une page
       * App Router, et le réseau ne retombe JAMAIS au calme sur `/accueil`. Mesuré :
       * `goto` expirait à 30 s comme à 120 s, donc ces deux captures n'ont jamais
       * été PRISES — elles étaient comptées échouées sans rien comparer. Même cause
       * et même correction que `e2e/a11y.spec.ts` et `e2e/services.spec.ts`.
       */
      await page.goto(screen.path, { waitUntil: 'load' });
      await page.locator('[data-screen]').first().waitFor({ state: 'attached', timeout: 20_000 });
      // Laisse la police s'appliquer : sinon la première capture montre le fallback.
      await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveScreenshot(`${screen.id}-${vp.name}.png`, { fullPage: true });
    });
  }
}
