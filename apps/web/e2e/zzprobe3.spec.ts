import { expect, test } from '@playwright/test';
import { connecter } from './session';
import { monterEnL1 } from './niveau';
const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1';
test('probe indexation', async ({ page, request }) => {
  test.setTimeout(180_000);
  const m = await connecter(page.context(), request, { displayName: 'Awa Konate' });
  const j = (await monterEnL1(page.context(), request, m.accessToken)).accessToken;
  const h = { authorization: `Bearer ${j}` };
  // une demande d'entraide : son événement déclenche l'indexation
  const r = await request.post(`${API}/help-requests`, { headers: h,
    data: { title: 'Relire mon dossier Zorglub', body: 'Quelqu’un peut relire mon dossier Zorglub avant dépôt ?', type: 'PAPERWORK', urgency: 'NORMAL' } });
  console.log('demande :', r.status(), (await r.text()).slice(0, 140));
  for (const attente of [1500, 4000]) {
    await page.waitForTimeout(attente);
    const s = await (await request.get(`${API}/search?q=zorglub`, { headers: h })).json() as { items?: { type: string; count: number }[] };
    console.log('après', attente, 'ms →', JSON.stringify((s.items ?? []).map((g) => `${g.type}:${g.count}`)));
  }
});
