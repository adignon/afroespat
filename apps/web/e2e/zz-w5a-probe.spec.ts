import { test } from '@playwright/test';
import { connecter } from './session';
test('sonde', async ({ page, context, request }) => {
  test.setTimeout(90000);
  await connecter(context, request, {});
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/accueil', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const liens = await page.locator('[data-frame="mobile"] a').evaluateAll((e) => e.map((x) => (x.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 30) + ' -> ' + x.getAttribute('href')));
  console.log(JSON.stringify(liens));
  await page.goto('/reseaux', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  console.log('reseaux', (await page.locator('[data-frame="mobile"]').innerText()).replace(/\n+/g, ' | ').slice(0, 400));
});
