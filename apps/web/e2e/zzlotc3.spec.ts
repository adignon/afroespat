import { expect, test } from '@playwright/test';
import { connecter } from './session';
import { monterEnL1 } from './niveau';

test.use({ launchOptions: { executablePath: '/opt/pw-browsers/chromium' } });
const OUT = '/tmp/claude-0/-home-user-afroespat/b604e56b-762f-5033-9aa9-c83b59d52246/scratchpad/lot-c';
const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3013/v1';

test('blocage public, partage de jalon, migration', async ({ page, context, request }, info) => {
  test.setTimeout(240000);
  const l = info.project.name;
  const a = await connecter(context, request, { displayName: 'Amina Test' });
  const { accessToken } = await monterEnL1(context, request, a.accessToken);
  const auth = { authorization: `Bearer ${accessToken}` };
  const tpl = (await (await request.get(`${API}/journey-templates`, { headers: auth })).json()) as { items: { id: string; code: string }[] };
  const etudes = tpl.items.find((t) => t.code === 'STUDIES')!;
  const cree = (await (await request.post(`${API}/journeys`, { headers: auth, data: { templateId: etudes.id, title: 'Projet Lyon', targetArrivalDate: '2027-09-01' } })).json()) as { journey: { id: string } };
  const id = cree.journey.id;
  const detail = (await (await request.get(`${API}/journeys/${id}`, { headers: auth })).json()) as { steps: { id: string; title: string; isMajorMilestone: boolean; status: string }[] };
  const jalon = detail.steps.find((s) => s.isMajorMilestone)!;
  for (const s of detail.steps) {
    await request.patch(`${API}/journeys/${id}/steps/${s.id}`, { headers: auth, data: { status: 'DONE' } });
    if (s.id === jalon.id) break;
  }

  const apres = (await (await request.get(`${API}/journeys/${id}`, { headers: auth })).json()) as { journey: { currentStepId: string }; steps: { id: string; title: string; blockerTarget: string }[] };
  console.log('COURANTE', apres.steps.find((s) => s.id === apres.journey.currentStepId));
  await page.goto(`/parcours/${id}`);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/${l}-jalon.png`, fullPage: true });

  // Partager un jalon : champ vide, publier
  await page.getByRole('button', { name: 'Partager' }).first().click();
  await expect(page.getByLabel('Votre message')).toHaveValue('', { timeout: 15000 });
  await page.getByLabel('Votre message').fill('Victoire : le visa est là, courage à ceux qui attendent.');
  await page.screenshot({ path: `${OUT}/${l}-partage.png` });
  await page.getByRole('button', { name: 'Publier' }).click();
  await expect(page.getByText('Votre victoire est publiée dans le fil.')).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Fermer' }).last().click();

  // Je suis bloqué·e : trois volets, public
  await page.getByRole('button', { name: 'Je suis bloqué·e' }).first().click();
  const zone = page.getByLabel('Votre message');
  await expect(zone).not.toHaveValue('', { timeout: 15000 });
  const brouillon = await zone.inputValue();
  expect(brouillon.length).toBeGreaterThan(20);
  await zone.fill(brouillon + ' Je n’ai aucune réponse de la préfecture depuis trois semaines.');
  await page.getByRole('button', { name: 'Suivant' }).click();
  // Publier n'existe pas encore (§3.5)
  await expect(page.getByRole('button', { name: 'Publier' })).toHaveCount(0);
  await page.getByLabel('Titre de la publication').fill('Sans réponse de la préfecture');
  await page.getByRole('button', { name: 'Voir l’aperçu' }).click();
  await page.screenshot({ path: `${OUT}/${l}-apercu.png` });
  await page.getByRole('button', { name: 'Publier' }).click();
  await expect(page.getByText(/Votre demande est publiée/)).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: `${OUT}/${l}-publie.png` });
});
