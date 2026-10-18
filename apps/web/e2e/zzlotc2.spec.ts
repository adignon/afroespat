import { expect, test } from '@playwright/test';
import { connecter } from './session';

test.use({ launchOptions: { executablePath: '/opt/pw-browsers/chromium' } });
const OUT = '/tmp/claude-0/-home-user-afroespat/b604e56b-762f-5033-9aa9-c83b59d52246/scratchpad/lot-c';

test('équipe, invitation, discussion, notes, réglages', async ({ page, browser, context, request }, info) => {
  test.setTimeout(240000);
  const l = info.project.name;
  const a = await connecter(context, request, { displayName: 'Amina Test' });
  const ctxB = await browser.newContext({ viewport: page.viewportSize() ?? { width: 1440, height: 1000 } });
  const pageB = await ctxB.newPage();
  const b = await connecter(ctxB, request, { displayName: 'Bruno Ami' });

  await page.goto('/parcours/nouveau');
  await page.getByRole('radio', { name: /Travailler/ }).click();
  await page.getByRole('button', { name: 'Créer le parcours' }).click();
  await page.waitForURL(/\/parcours\/[0-9a-f-]{36}$/, { timeout: 30000 });
  const base = new URL(page.url()).pathname;

  // Inviter B par pseudo
  await page.getByRole('button', { name: 'Inviter' }).first().click();
  await page.getByLabel('Pseudo').fill(`@${b.handle}`);
  await page.getByRole('button', { name: 'Inviter', exact: true }).last().click();
  await expect(page.getByText(`Invitation envoyée à @${b.handle}`)).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: `${OUT}/${l}-inviter.png` });

  // B voit l'invitation et accepte
  await pageB.goto('/parcours');
  await expect(pageB.getByText('Amina Test vous invite')).toBeVisible({ timeout: 30000 });
  await pageB.screenshot({ path: `${OUT}/${l}-invitation-b.png`, fullPage: true });
  await pageB.getByRole('button', { name: 'Accepter' }).click();
  await expect(pageB.getByText('Amina Test vous invite')).toBeHidden({ timeout: 15000 });

  // Discussion : B écrit, A lit
  await pageB.goto(base + '/discussion');
  await pageB.getByLabel('Votre message').fill('Bonjour de Bruno');
  await pageB.getByRole('button', { name: 'Envoyer' }).click();
  await expect(pageB.getByText('Bonjour de Bruno')).toBeVisible({ timeout: 15000 });
  await page.goto(base + '/discussion');
  await expect(page.getByText('Bonjour de Bruno')).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: `${OUT}/${l}-discussion-a.png`, fullPage: true });

  // Équipe : Bruno listé, retrait
  await page.goto(base + '/equipe');
  await expect(page.getByText(`@${b.handle}`).first()).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: `${OUT}/${l}-equipe2.png`, fullPage: true });

  // Étape : notes + document
  await page.goto(base + '/etapes');
  await page.getByLabel('Mes notes').fill('Note privée de test');
  await page.getByRole('button', { name: 'Enregistrer la note' }).click();
  await expect(page.getByText('Enregistré')).toBeVisible({ timeout: 15000 });
  await page.getByLabel('Ajouter un document').first().fill('Passeport de test');
  await page.getByRole('button', { name: 'Ajouter', exact: true }).first().click();
  await expect(page.getByText('Passeport de test')).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: `${OUT}/${l}-etape2.png`, fullPage: true });

  // Réglages : public
  await page.goto(base + '/reglages');
  await page.getByRole('radio', { name: /Public/ }).check();
  await page.getByRole('button', { name: 'Mettre à jour' }).click();
  await expect(page.getByText('Réglages enregistrés.')).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Arrêter ce parcours' }).click();
  await expect(page.getByText('Votre projet a évolué')).toBeVisible();
  await page.screenshot({ path: `${OUT}/${l}-arret.png` });
  await page.getByRole('button', { name: 'Arrêter', exact: true }).click();
  await page.waitForURL(/\/parcours$/, { timeout: 15000 });
  await ctxB.close();
});
