import { expect, test } from '@playwright/test';

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
 */

const VIEWPORTS = [
  { name: 'ordinateur', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

const SCREENS = [{ path: '/accueil', id: 'A01-fil' }] as const;

for (const vp of VIEWPORTS) {
  for (const screen of SCREENS) {
    test(`${screen.id} — ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(screen.path, { waitUntil: 'networkidle' });
      // Laisse la police s'appliquer : sinon la première capture montre le fallback.
      await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveScreenshot(`${screen.id}-${vp.name}.png`, { fullPage: true });
    });
  }
}
