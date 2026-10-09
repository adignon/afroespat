import { expect, test } from '@playwright/test';
import { connecter } from './session';
test('probe recherche', async ({ page, request }) => {
  test.setTimeout(180_000);
  await connecter(page.context(), request, { displayName: 'Awa Konate' });
  for (const q of ['lyon', 'visale', 'awa']) {
    await page.goto(`/recherche?q=${q}`);
    await page.waitForTimeout(1800);
    const cadre = page.locator('[data-frame]').filter({ visible: true }).first();
    const m = await cadre.evaluate((e) => {
      const txt = (e.innerText || '').split('\n').map((l) => l.trim()).filter((l) => l !== '');
      const titre = txt.find((l) => l.startsWith('Résultats pour')) ?? '—';
      const facettes = txt.filter((l) => / · \d+$/.test(l)).slice(0, 4);
      const cartes = [...e.querySelectorAll('div')].filter((d) => (d.getAttribute('style') ?? '').includes('border-radius: 22px')).length;
      return { titre, facettes, cartes };
    });
    const corps = await cadre.innerText();
    console.log(q, '>', JSON.stringify(m), '| Visale présent :', corps.includes('Visale'));
  }
});
