import { expect, test, type Page } from '@playwright/test';
import { monterEnL2 } from './niveau';
import { connecter } from './session';

/**
 * LOT E — SERVICES, de bout en bout, aux deux largeurs (1 440 et 390 px).
 *
 * Un membre L2 publie une annonce par le vrai formulaire (S03), la voit dans « Mes
 * annonces » (S09), la met en pause puis la reprend ; un second membre l'ouvre (S02),
 * clique « Contacter » et écrit à l'auteur (la conversation s'ouvre) ; l'auteur
 * enregistre une alerte (S10). Les captures vont dans `CAPTURES_DIR` quand il est posé.
 *
 * Aux deux largeurs la page monte les DEUX cadres (l'un masqué) : tous les sélecteurs
 * passent par `:visible`.
 */
test.describe.configure({ timeout: 180_000 });

const CAPTURES = process.env['CAPTURES_DIR'];

// Un PNG de 1×1 pixel : le serveur exige une vraie image pour une photo d'annonce.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function capture(page: Page, nom: string): Promise<void> {
  if (CAPTURES === undefined) return;
  const largeur = page.viewportSize()?.width ?? 0;
  await page.screenshot({ path: `${CAPTURES}/${nom}-${String(largeur)}.png`, fullPage: true });
}

test('publier, suspendre, contacter, alerter', async ({ page, context, request, browser }) => {
  const erreurs: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') erreurs.push(m.text().slice(0, 300));
  });
  const auteur = await connecter(context, request, { displayName: 'Auteur Annonce' });
  await monterEnL2(context, request, auteur.accessToken);

  // ── S03 : publier ────────────────────────────────────────────────────────
  await page.goto('/services/logement/nouveau');
  await expect(page.locator('[data-annonce-titre]:visible')).toBeVisible({ timeout: 60_000 });
  await capture(page, 's03-formulaire');
  const titre = `Studio test ${String(Date.now() % 100000)}`;
  await page.locator('[data-annonce-titre]:visible').fill(titre);
  await page
    .locator('[data-annonce-description]:visible')
    .fill('Un studio calme et lumineux, proche des transports, charges comprises, idéal pour un étudiant.');
  await page.locator('[data-annonce-loyer]:visible').fill('620');
  await page.locator('[data-annonce-photos]:visible input[type=file]').setInputFiles({
    name: 'photo.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await expect(page.locator('[data-annonce-photos]:visible')).toBeVisible();
  await page.locator('[data-publier]:visible').click();
  await expect(page).toHaveURL(/\/services\/mes-annonces/, { timeout: 30_000 });

  // ── S09 : la liste, la pause, la reprise ─────────────────────────────────
  await expect(page.getByText(titre).locator('visible=true').first()).toBeVisible({ timeout: 30_000 });
  await capture(page, 's09-mes-annonces');
  await page.getByRole('button', { name: 'Pause' }).locator('visible=true').first().click();
  await expect(page.getByText('En pause').locator('visible=true').first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Reprendre' }).locator('visible=true').first().click();
  await expect(page.getByText('Active').locator('visible=true').first()).toBeVisible({ timeout: 15_000 });

  const lien = await page.getByRole('link', { name: titre }).locator('visible=true').first().getAttribute('href');
  expect(lien).toMatch(/^\/services\/logement\/[0-9a-f-]{36}$/);

  // ── S02 : un second membre contacte l'auteur ─────────────────────────────
  const contexteB = await browser.newContext({ viewport: page.viewportSize() ?? { width: 1440, height: 1000 } });
  const pageB = await contexteB.newPage();
  const lecteur = await connecter(contexteB, contexteB.request, { displayName: 'Lecteur Annonce' });
  await monterEnL2(contexteB, contexteB.request, lecteur.accessToken);
  await pageB.goto(lien ?? '/services/logement');
  await expect(pageB.getByText(titre).locator('visible=true').first()).toBeVisible({ timeout: 60_000 });
  await capture(pageB, 's02-annonce');
  await pageB.getByRole('button', { name: 'Contacter' }).locator('visible=true').first().click();
  const message = pageB.locator('[data-contact-message]:visible');
  await expect(message).toBeVisible();
  await message.fill('Bonjour, votre annonce m’intéresse. Puis-je la visiter cette semaine ?');
  await capture(pageB, 's02-contacter');
  await pageB.locator('[data-contact-envoyer]:visible').click();
  await expect(pageB).toHaveURL(/\/messages\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await contexteB.close();

  // ── S10 : enregistrer une alerte ─────────────────────────────────────────
  await page.goto('/services/alertes');
  await expect(page.locator('[data-alerte-budget]:visible')).toBeVisible({ timeout: 60_000 });
  await page.locator('[data-alerte-budget]:visible').fill('700');
  await page.locator('[data-alerte-enregistrer]:visible').click();
  await expect(page.getByText('Alerte enregistrée').locator('visible=true').first()).toBeVisible({ timeout: 15_000 });
  await capture(page, 's10-alertes');

  // ── S01 : la liste, avec la photo réelle et les puces de genre ───────────
  await page.goto('/services/logement');
  await expect(page.getByText(titre).locator('visible=true').first()).toBeVisible({ timeout: 60_000 });
  await capture(page, 's01-liste');
  if (erreurs.length > 0) console.log('ERREURS CONSOLE', JSON.stringify([...new Set(erreurs)], null, 1));
});

test('publier une offre, la retrouver, créer sa fiche pro', async ({ page, context, request }) => {
  const membre = await connecter(context, request, { displayName: 'Recruteur Test' });
  await monterEnL2(context, request, membre.accessToken);

  // ── S05 : publier une offre ──────────────────────────────────────────────
  await page.goto('/services/emploi/nouveau');
  await expect(page.locator('[data-offre-titre]:visible')).toBeVisible({ timeout: 60_000 });
  await capture(page, 's05-publier');
  const titre = `Comptable junior ${String(Date.now() % 100000)}`;
  await page.locator('[data-offre-titre]:visible').fill(titre);
  await page
    .locator('[data-offre-description]:visible')
    .fill('Tenue comptable, déclarations de TVA et accompagnement du dirigeant. Débutant accepté.');
  await page.locator('[data-publier]:visible').click();
  await expect(page).toHaveURL(/\/services\/mes-annonces/, { timeout: 30_000 });

  // ── S09 : l'onglet Emploi, puis la fiche de l'offre (S05) ────────────────
  await page.getByRole('button', { name: /^Emploi/ }).locator('visible=true').first().click();
  await expect(page.getByText(titre).locator('visible=true').first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole('link', { name: titre }).locator('visible=true').first().click();
  await expect(page).toHaveURL(/\/services\/emploi\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('button', { name: /Recommander/ }).locator('visible=true').first()).toBeVisible({ timeout: 30_000 });
  await capture(page, 's05-offre');

  // ── S08 : créer sa fiche pro ─────────────────────────────────────────────
  await page.goto('/services/annuaire/ma-fiche');
  await expect(page.locator('[data-fiche-metier]:visible')).toBeVisible({ timeout: 60_000 });
  await capture(page, 's08-fiche-pro');
  await page.locator('[data-fiche-metier]:visible').selectOption({ index: 1 });
  await page.locator('[data-fiche-nom]:visible').fill('Cabinet Test');
  await page.locator('[data-fiche-description]:visible').fill('Accompagnement des démarches administratives des nouveaux arrivants.');
  await page.locator('[data-fiche-ajouter-ville]:visible').selectOption({ index: 1 });
  await page.locator('[data-fiche-justificatif]:visible input[type=file]').setInputFiles({
    name: 'justificatif.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  // On ATTEND que le justificatif soit déposé avant d'envoyer : l'envoi part de l'état du
  // formulaire, et un clic lancé avant la fin du dépôt est refusé côté écran (« Déposez un
  // justificatif ») — le cas passait ou échouait selon la vitesse de la machine.
  await expect(page.getByText(/Justificatif déposé : justificatif\.png/).locator('visible=true').first()).toBeVisible({ timeout: 30_000 });
  await page.locator('[data-fiche-envoyer]:visible').click();
  await expect(page.locator('[data-fiche-succes]:visible')).toBeVisible({ timeout: 30_000 });
  await capture(page, 's08-envoyee');
});
