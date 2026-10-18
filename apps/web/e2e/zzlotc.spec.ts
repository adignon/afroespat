import { expect, test } from '@playwright/test';
import { connecter } from './session';

test.use({ launchOptions: { executablePath: '/opt/pw-browsers/chromium' } });
const OUT = '/tmp/claude-0/-home-user-afroespat/b604e56b-762f-5033-9aa9-c83b59d52246/scratchpad/lot-c';

test('parcours : toutes les pages', async ({ page, context, request }, info) => {
  test.setTimeout(240000);
  const l = info.project.name;
  await connecter(context, request, { displayName: 'Amina Test' });
  await page.goto('/parcours/nouveau');
  await expect(page.getByRole('radio').first()).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: `${OUT}/${l}-creer.png`, fullPage: true });
  await page.getByRole('radio', { name: /Régulariser/ }).click();
  await page.getByRole('radio', { name: /Renouvel/ }).click();
  await page.getByRole('button', { name: 'Créer le parcours' }).click();
  await page.waitForURL(/\/parcours\/[0-9a-f-]{36}$/, { timeout: 30000 });
  const base = new URL(page.url()).pathname;
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/${l}-j01.png`, fullPage: true });
  for (const [nom, chemin] of [['etape', '/etapes'], ['discussion', '/discussion'], ['equipe', '/equipe'], ['documents', '/documents'], ['historique', '/historique'], ['reglages', '/reglages'], ['export', '/export']] as const) {
    await page.goto(base + chemin);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/${l}-${nom}.png`, fullPage: true });
  }
  for (const [nom, chemin] of [['publics', '/parcours/publics'], ['liste', '/parcours'], ['abouti', `${base}/abouti`]] as const) {
    await page.goto(chemin);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/${l}-${nom}.png`, fullPage: true });
  }
});
