import { expect, test, type Page } from '@playwright/test';
import { ouvrirSessionEquipe, type RoleEquipe } from './aide-w5a';
import { poserSanction } from './aide-w5b';
import { connecter } from './session';

/**
 * Étape 3 « Administration » : ce qui se prouve au navigateur, contre la vraie API.
 *
 *   · garde de route par rôle : un modérateur qui ouvre une adresse hors de son périmètre lit un refus clair, et le
 *     rail ne propose pas l'entrée ;
 *   · référentiels : onglets Pays, Langues, Compétences, Métiers ; une compétence s'ajoute, se retire (confirmation) ;
 *   · fenêtres : le focus entre, reste dans la fenêtre (Tab), Échap ferme et le focus revient au bouton d'origine ;
 *   · fiche membre : compteurs, sanctions, « Lever le bannissement » (motif + confirmation) ;
 *   · tableau de bord : le filtre de période ;
 *   · Paiements et offres : l'interrupteur global ne bascule qu'après motif ET confirmation.
 */

test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'piloté par le test');

async function visiter(page: Page, url: string): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(url, { waitUntil: 'load' });
}

const alea = () => Math.random().toString(36).slice(2, 8);

async function equipe(page: Page, request: Parameters<typeof ouvrirSessionEquipe>[1], role?: RoleEquipe) {
  await ouvrirSessionEquipe(page.context(), request, role);
}

test('garde de route : un modérateur lit un refus clair hors de son périmètre, et le rail masque l’entrée', async ({ page, request }) => {
  await equipe(page, request, 'MODERATOR');
  await visiter(page, '/admin/referentiels');
  await expect(page.getByRole('heading', { name: /Accès réservé à/ })).toBeVisible();
  await expect(page.getByText('La page « Référentiels » n’est pas ouverte à votre rôle.')).toBeVisible();

  await visiter(page, '/admin');
  const rail = page.getByRole('navigation').first();
  await expect(rail.getByRole('link', { name: /Modération/ }).first()).toBeVisible();
  await expect(rail.getByRole('link', { name: /Référentiels/ })).toHaveCount(0);
  await expect(rail.getByRole('link', { name: /Paiements et offres/ })).toHaveCount(0);

  await visiter(page, '/admin/revenus');
  await expect(page.getByRole('heading', { name: /Accès réservé à administrateurs/ })).toBeVisible();
});

test('référentiels : les quatre onglets, ajout puis retrait d’une compétence, focus des fenêtres', async ({ page, request }) => {
  await equipe(page, request);
  await visiter(page, '/admin/referentiels');

  for (const nom of ['Pays', 'Langues', 'Compétences', 'Métiers']) {
    await page.getByRole('tab', { name: nom, exact: true }).click();
    await expect(page.getByRole('tabpanel')).toBeVisible();
    await expect(page.getByRole('tabpanel').locator('table tbody tr').first()).toBeVisible();
  }

  await page.getByRole('tab', { name: 'Compétences', exact: true }).click();
  const ajouter = page.getByRole('button', { name: 'Ajouter une compétence' });

  // Le piège du focus : le champ prend le focus, Tab reste dans la fenêtre, Échap ferme et rend le focus.
  await ajouter.focus();
  await ajouter.press('Enter');
  const fenetre = page.getByRole('dialog', { name: 'Ajouter une compétence' });
  await expect(fenetre).toBeVisible();
  await expect(fenetre.getByLabel('Nom en français')).toBeFocused();
  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press('Tab');
    expect(await fenetre.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press('Shift+Tab');
    expect(await fenetre.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(fenetre).toHaveCount(0);
  await expect(ajouter).toBeFocused();

  // Ajout réel.
  const nom = `Compétence e2e ${alea()}`;
  await ajouter.click();
  await page.getByRole('dialog').getByLabel('Nom en français').fill(nom);
  await page.getByRole('dialog').getByRole('button', { name: 'Ajouter', exact: true }).click();
  const ligne = page.getByRole('row', { name: new RegExp(nom) });
  await expect(ligne).toBeVisible();
  await expect(ligne.getByText('Proposé')).toBeVisible();

  // Retrait : une confirmation d'abord.
  await ligne.getByRole('button', { name: 'Retirer des propositions' }).click();
  const confirmation = page.getByRole('dialog', { name: new RegExp(`Retirer « ${nom}`) });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Annuler' }).click();
  await expect(ligne.getByText('Proposé')).toBeVisible();
  await ligne.getByRole('button', { name: 'Retirer des propositions' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Retirer', exact: true }).click();
  await expect(ligne.getByText('Retiré')).toBeVisible();
});

test('fiche membre : compteurs, sanctions et « Lever le bannissement »', async ({ page, request, browser }) => {
  const contexte = await browser.newContext();
  const membre = await connecter(contexte, request, { displayName: 'Koffi Sanctionné' });
  await contexte.close();
  poserSanction(membre.id, { type: 'BAN', motif: 'Arnaque répétée, relevée par la modération.' });

  await equipe(page, request);
  await visiter(page, '/admin/membres');
  await page.getByPlaceholder(/@pseudo/).fill(membre.handle);
  await page.getByText('Koffi Sanctionné').first().click();

  await expect(page.getByText('Publications', { exact: true })).toBeVisible();
  await expect(page.getByText('Messages signalés', { exact: true })).toBeVisible();
  await expect(page.getByText('Demandes d’aide', { exact: true })).toBeVisible();
  const sanctions = page.locator('[data-sanctions-membre]');
  await expect(sanctions.getByText('Bannissement', { exact: true })).toBeVisible();
  await expect(sanctions.getByText('En cours', { exact: true })).toBeVisible();
  await expect(sanctions.getByText('Arnaque répétée, relevée par la modération.')).toBeVisible();

  await page.getByRole('button', { name: 'Lever le bannissement' }).click();
  const fenetre = page.getByRole('dialog', { name: 'Lever le bannissement' });
  const confirmer = fenetre.getByRole('button', { name: 'Confirmer' });
  await expect(confirmer).toBeDisabled();
  await fenetre.getByLabel(/Motif/).fill('Recours accepté après réexamen du dossier.');
  await confirmer.click();
  await expect(page.getByText(/Bannissement levé/)).toBeVisible();
  await expect(sanctions.getByText('Levée', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lever le bannissement' })).toHaveCount(0);
});

test('tableau de bord : le filtre de période', async ({ page, request }) => {
  await equipe(page, request);
  await visiter(page, '/admin');
  const filtre = page.getByLabel('Période des instantanés');
  await expect(filtre).toBeVisible();
  await expect(page.locator('[data-periode-arret]')).toHaveCount(0);
  const requete = page.waitForResponse((r) => r.url().includes('/admin/dashboard?period=7d') && r.ok());
  await filtre.selectOption('7d');
  await requete;
  await expect(page.locator('[data-periode-arret]')).toContainText('Instantanés arrêtés au');
  await filtre.selectOption('current');
  await expect(page.locator('[data-periode-arret]')).toHaveCount(0);
});

test('paiements et offres : l’interrupteur global exige un motif et une confirmation', async ({ page, request }) => {
  await equipe(page, request);
  await visiter(page, '/admin/revenus');
  await expect(page.getByText('Monétisation désactivée')).toBeVisible();
  const interrupteur = page.getByRole('switch', { name: /Monétisation/ });
  await interrupteur.click();
  const fenetre = page.getByRole('dialog', { name: 'Allumer la monétisation' });
  await expect(fenetre).toBeVisible();
  await expect(fenetre.getByRole('button', { name: 'Allumer' })).toBeDisabled();
  await fenetre.getByLabel(/Motif/).fill('court');
  await expect(fenetre.getByRole('button', { name: 'Allumer' })).toBeDisabled();
  // Annuler : rien n'a changé.
  await fenetre.getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByText('Monétisation désactivée')).toBeVisible();
  await expect(interrupteur).toHaveAttribute('aria-checked', 'false');
});
