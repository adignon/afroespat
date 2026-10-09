import { expect, test } from '@playwright/test';
import { connecter } from './session';
import { monterEnL1 } from './niveau';
const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1';
test('dbg noms cliquables', async ({ page, browser, request }) => {
  const o = await connecter(page.context(), request, { displayName: 'Awa Konaté' });
  const moi = await monterEnL1(page.context(), request, o.accessToken);
  const ctx = await browser.newContext();
  const autre = await connecter(ctx, request, { displayName: 'Fatim Sow' });
  const lui = await monterEnL1(ctx, request, autre.accessToken);
  await ctx.close();
  await request.post(`${API}/posts`, { headers: { authorization: `Bearer ${lui.accessToken}` }, data: { type: 'QUESTION', body: 'Une question de Fatim pour le fil.' } });
  await request.post(`${API}/stories`, { headers: { authorization: `Bearer ${lui.accessToken}` }, data: { type: 'CONSEIL', body: 'Un conseil.', backgroundColor: '#2D6A4F', textStyle: 'BOLD', category: 'LOGEMENT', audience: 'ALL', allowMessages: true } });
  for (const route of ['/accueil']) {
    await page.goto(route);
    await page.waitForTimeout(4000);
    const liens = await page.locator('[data-nom-profil]').filter({ visible: true }).evaluateAll((ns) => ns.slice(0, 5).map((n) => `${(n.textContent ?? '').trim().slice(0, 16)}→${n.getAttribute('href')}`));
    console.log(`### ${route} : ${liens.length} liens |`, liens.join(' , '));
  }
  const l = page.locator('[data-nom-profil]').filter({ visible: true }).first();
  if (await l.count() > 0) {
    await l.click();
    await page.waitForTimeout(2500);
    console.log('### APRÈS CLIC =', new URL(page.url()).pathname, '|', (await page.locator('body').innerText()).replace(/\s+/g,' ').slice(190, 320));
  }
  expect(moi).toBeDefined();
});
