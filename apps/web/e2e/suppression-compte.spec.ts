import { expect, test, type Page } from '@playwright/test';
import { connecter } from './session';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1';
const CODE_FICTIF = process.env['SMS_FAKE_FIXED_CODE'] ?? '123456';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ SUPPRIMER SON COMPTE — K08 « CONFIRMER LA SUPPRESSION » EST BRANCHÉ        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Mission B du lot w5b. Le bouton était volontairement inerte depuis plusieurs lots ; la
 * suppression est irréversible après sept jours (01 §2.8). Décision du porteur : on le branche.
 * Le parcours éprouvé, AUX DEUX LARGEURS et de bout en bout par les vraies routes :
 *
 *   1. la fenêtre « Supprimer mon compte » demande le PSEUDO ; « Recevoir le code » reste grisé
 *      tant qu'il n'est pas exact (casse et « @ » ignorés) ;
 *   2. `POST /me/deletion/code` envoie le code au numéro principal, et l'écran dit le MASQUE ;
 *   3. un code faux est REFUSÉ À L'ÉCRAN (avec les essais restants) et rien n'est supprimé ;
 *   4. le bon code lance `POST /me/deletion` : TOUTES les sessions sont révoquées (§2.8), l'écran
 *      recharge `/connexion` avec la bande « Votre compte sera supprimé le … » ;
 *   5. « Annuler la suppression », c'est se RECONNECTER : le serveur annule à la vérification du
 *      code, et l'écran le dit (« La suppression de votre compte est annulée »).
 *
 * Chaque cas ouvre SON membre : la demande de suppression est un état du compte, et le partager
 * ferait dépendre les cas de leur ordre.
 */

const cadre = (page: Page) => page.locator('[data-frame]').filter({ visible: true }).first();

/** Ouvre « Mes données » et la fenêtre de confirmation de suppression. */
async function ouvrirLaFenetre(page: Page): Promise<void> {
  await page.goto('/compte/donnees', { waitUntil: 'load' });
  await expect(page.locator('[role="status"]').filter({ hasText: /Chargement/ })).toHaveCount(0, {
    timeout: 25_000,
  });
  const declencheur = cadre(page).locator('[data-modal-open="K08S"]').first();
  await expect(declencheur, 'aucun bouton « Supprimer » sur cette largeur').toBeVisible();
  await declencheur.click();
  await expect(page.getByRole('dialog', { name: 'Supprimer mon compte' })).toBeVisible();
}

/** Le pseudo exact → « Recevoir le code » → le champ du code est là. */
async function demanderLeCode(page: Page, pseudo: string): Promise<void> {
  const fenetre = page.getByRole('dialog', { name: 'Supprimer mon compte' });
  await fenetre.locator('[data-suppression-pseudo]').fill(pseudo);
  const envoyer = fenetre.locator('[data-suppression-envoyer]');
  await expect(envoyer).toBeEnabled();
  await envoyer.click();
  await expect(fenetre.locator('[data-suppression-code]')).toBeVisible({ timeout: 20_000 });
}

/** « lundi 2 novembre 2026 » : le jour que la bande doit nommer, dans sept jours, à Paris. */
function jourDansSeptJours(): string {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  }).format(new Date(Date.now() + 7 * 86_400_000));
}

test.describe('K08 — supprimer mon compte, de bout en bout', () => {
  test('la fenêtre dit ce qui part et ce qui reste, et demande le pseudo avant tout envoi', async ({
    page,
    request,
  }) => {
    const membre = await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    await ouvrirLaFenetre(page);
    const fenetre = page.getByRole('dialog', { name: 'Supprimer mon compte' });

    await expect(fenetre.getByText('Conservé sans votre nom')).toBeVisible();
    const champ = fenetre.locator('[data-suppression-pseudo]');
    const envoyer = fenetre.locator('[data-suppression-envoyer]');
    await expect(champ).toBeVisible();
    // Avant de saisir : grisé. Le pseudo de quelqu'un d'autre : grisé. Le sien : actif.
    await expect(envoyer).toBeDisabled();
    await champ.fill('quelquun-dautre');
    await expect(envoyer).toBeDisabled();
    await champ.fill(`@${membre.handle.toUpperCase()}`);
    await expect(envoyer).toBeEnabled();

    // Rien n'est parti : aucun code demandé tant qu'on n'a pas cliqué.
    await expect(fenetre.locator('[data-suppression-code]')).toHaveCount(0);
  });

  test('un code faux est refusé à l’écran, et le compte reste intact', async ({ page, request }) => {
    const membre = await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    await ouvrirLaFenetre(page);
    const fenetre = page.getByRole('dialog', { name: 'Supprimer mon compte' });
    await demanderLeCode(page, membre.handle);

    // Le numéro est MASQUÉ, jamais en clair.
    const consigne = await fenetre.locator('label[for="suppression-code"]').innerText();
    expect(consigne).toContain('•');
    expect(consigne).not.toContain(membre.phone.replace('+229', ''));

    const confirmer = fenetre.locator('[data-suppression-confirmer]');
    await expect(confirmer, 'sans six chiffres le bouton reste grisé').toBeDisabled();
    await fenetre.locator('[data-suppression-code]').fill('000000');
    await expect(confirmer).toBeEnabled();
    await confirmer.click();

    const refus = fenetre.locator('[data-suppression-refus]');
    await expect(refus).toBeVisible({ timeout: 15_000 });
    await expect(refus).toContainText(/Code incorrect|incorrect/i);
    await expect(fenetre, 'la fenêtre ne se ferme pas sur un refus').toBeVisible();

    // Le compte n'a pas bougé : le jeton d'accès vaut toujours, et le statut est actif.
    const me = await request.get(`${API}/me`, {
      headers: { authorization: `Bearer ${membre.accessToken}` },
    });
    expect(me.status(), 'le compte a été touché par un code faux').toBe(200);
  });

  test('le bon code programme la suppression, déconnecte, et la bande nomme le jour', async ({
    page,
    request,
  }) => {
    const membre = await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    const attendu = jourDansSeptJours();
    await ouvrirLaFenetre(page);
    const fenetre = page.getByRole('dialog', { name: 'Supprimer mon compte' });
    await demanderLeCode(page, membre.handle);

    await fenetre.locator('[data-suppression-code]').fill(CODE_FICTIF);
    await fenetre.locator('[data-suppression-confirmer]').click();

    await page.waitForURL(/\/connexion\?suppression=/, { timeout: 30_000 });
    const bande = page.locator('[data-suppression-programmee]');
    await expect(bande).toBeVisible();
    await expect(bande).toContainText('Votre compte sera supprimé le');
    // Le jour est celui d'aujourd'hui + 7 (tolérance : minuit peut passer pendant le cas).
    const lu = (await bande.innerText()).replace(/\s+/g, ' ');
    const demain = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/Paris',
    }).format(new Date(Date.now() + 8 * 86_400_000));
    expect(lu.includes(attendu) || lu.includes(demain), `la bande dit « ${lu} », attendu ${attendu}`).toBe(true);
    await expect(bande.locator('[data-suppression-annuler]')).toHaveText('Annuler la suppression');

    // « Déconnexion après la demande » : le serveur a révoqué la session, le jeton est mort.
    const mort = await request.get(`${API}/me`, {
      headers: { authorization: `Bearer ${membre.accessToken}` },
    });
    expect(mort.status(), 'la session du membre survit à sa demande de suppression').toBe(401);
  });

  test('« Annuler la suppression » mène à la reconnexion, qui annule et le dit', async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    const membre = await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    await ouvrirLaFenetre(page);
    const fenetre = page.getByRole('dialog', { name: 'Supprimer mon compte' });
    await demanderLeCode(page, membre.handle);
    await fenetre.locator('[data-suppression-code]').fill(CODE_FICTIF);
    await fenetre.locator('[data-suppression-confirmer]').click();
    await page.waitForURL(/\/connexion\?suppression=/, { timeout: 30_000 });

    // Le bouton amène au champ du numéro.
    await page.locator('[data-suppression-annuler]').click();
    const numero = page.locator('input[name="phone"]:visible');
    await expect(numero).toBeFocused();

    // Se reconnecter, c'est annuler (§2.8).
    await numero.fill(membre.phone.replace('+229', ''));
    await page.locator('main:visible [role="checkbox"]').click();
    await page.getByRole('button', { name: 'Recevoir le code' }).click();
    await page.waitForURL('**/connexion/code', { timeout: 30_000 });
    await page.locator('input[autocomplete="one-time-code"]:visible').fill(CODE_FICTIF);

    await page.waitForURL(/\/accueil/, { timeout: 30_000 });
    await expect(page.getByText('La suppression de votre compte est annulée').first()).toBeVisible({
      timeout: 15_000,
    });

    // Et le compte est de nouveau pleinement utilisable : la page « Mes données » se rouvre.
    await page.goto('/compte/donnees');
    await expect(cadre(page).locator('[data-modal-open="K08S"]').first()).toBeVisible({ timeout: 25_000 });
  });
});
