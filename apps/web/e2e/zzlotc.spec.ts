import { expect, test } from '@playwright/test';
import { connecter } from './session';

test.use({ launchOptions: { executablePath: '/opt/pw-browsers/chromium' } });
const OUT = '/tmp/claude-0/-home-user-afroespat/b604e56b-762f-5033-9aa9-c83b59d52246/scratchpad/lot-c';

test('parcours : création, étapes, réglages', async ({ page, context, request }, info) => {
  const largeur = info.project.name;
  await connecter(context, request, { displayName: 'Amina Test' });
  await page.goto('/parcours/nouveau');
  await expect(page.getByRole('radio').first()).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: `${OUT}/${largeur}-creer.png`, fullPage: true });
  await page.getByRole('radio', { name: /Travail|Étudier/ }).first().click();
  await page.getByLabel('Nom du parcours').fill('Mon projet test');
  await page.getByRole('button', { name: 'Créer le parcours' }).click();
  await page.waitForURL(/\/parcours\/[0-9a-f-]{36}$/, { timeout: 30000 });
  await expect(page.getByText('Mon projet test').first()).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: `${OUT}/${largeur}-parcours.png`, fullPage: true });
  await page.getByRole('button', { name: 'Commencer' }).first().click();
  await expect(page.getByRole('button', { name: 'Marquer comme franchie' }).first()).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Marquer comme franchie' }).first().click();
  await expect(page.getByText('Étape franchie, bravo.')).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: `${OUT}/${largeur}-franchie.png`, fullPage: true });
  await page.getByRole('button', { name: 'Je suis bloqué·e' }).first().click();
  await expect(page.getByLabel('Votre message')).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: `${OUT}/${largeur}-bloque.png` });
});
