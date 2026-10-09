import { test } from '@playwright/test';
import { connecter } from './session';
const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1';
test('probe search api', async ({ page, request }) => {
  test.setTimeout(120_000);
  const m = await connecter(page.context(), request, { displayName: 'Awa Konate' });
  const h = { authorization: `Bearer ${m.accessToken}` };
  for (const q of ['visale', 'logement', 'awa', 'lyon', 'conseil']) {
    const r = await request.get(`${API}/search?q=${q}`, { headers: h });
    const j = await r.json() as { items?: { type: string; count: number }[]; meta?: unknown };
    console.log(q, '→', r.status(), JSON.stringify((j.items ?? []).map((g) => `${g.type}:${g.count}`)));
  }
});
