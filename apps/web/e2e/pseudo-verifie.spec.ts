import { expect, test } from '@playwright/test';
import { connecter } from './session';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE PSEUDO EST VÉRIFIÉ — IL NE L'ÉTAIT PAS                                  ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Le pseudo est vérifié ? »
 *
 * Non. La maquette dessine une coche verte et le mot « Disponible » sous le
 * champ ; c'étaient des LITTÉRAUX, affichés quoi qu'on tape — y compris sur un
 * pseudo déjà pris. Le refus n'arrivait qu'au `PATCH /me`, deux écrans plus loin,
 * sur un champ que le membre ne voyait plus.
 *
 * Ce fichier éprouve les trois états qui comptent, et le troisième est le seul
 * qui prouve qu'un SERVEUR répond : un pseudo RÉELLEMENT pris — celui d'un membre
 * créé par le test — doit être refusé. Un test qui ne vérifierait que « un pseudo
 * inventé est libre » passerait aussi sur le code d'avant.
 *
 * Le cadre mobile de O04 ne dessine NI coche NI phrase : la maquette ne les pose
 * que sur la planche d'ordinateur. Les cas sont donc bornés à ce cadre, et c'est
 * un manque de DESSIN, remonté — pas un défaut de ce lot.
 */

const phrase = (page: import('@playwright/test').Page) =>
  page.locator('[data-frame="desktop"] [role="status"]');

const champ = (page: import('@playwright/test').Page) =>
  page.locator('[data-frame="desktop"]').getByLabel('Votre pseudo');

test.describe('O04 — la disponibilité du pseudo', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'la maquette ne le dessine qu’à 1440 px');

  test('un pseudo libre s’annonce « Disponible », avec la coche de la maquette', async ({
    page,
    request,
  }) => {
    await connecter(page.context(), request);
    await page.goto('/bienvenue/profil');

    const libre = `libre${String(Date.now()).slice(-9)}`;
    await champ(page).fill(libre);

    await expect(phrase(page)).toHaveText('Disponible');
    // La teinte est celle que la maquette écrit sur ce mot.
    expect(await phrase(page).evaluate((e) => getComputedStyle(e).color)).toBe('rgb(22, 120, 94)');
    await expect(page.locator('[data-frame="desktop"] svg[aria-hidden="true"][style*="display"]')).not.toHaveCount(0);
  });

  /**
   * LE CAS QUI PROUVE QU'UN SERVEUR RÉPOND : le pseudo d'un membre qui existe.
   * Avant ce lot, cet écran disait « Disponible ».
   */
  test('un pseudo DÉJÀ PRIS est refusé, et la coche s’éteint', async ({ page, request }) => {
    const voisin = await connecter(page.context(), request);
    // Un second membre, dans le même navigateur : c'est lui qui remplit l'écran.
    await connecter(page.context(), request);
    await page.goto('/bienvenue/profil');

    await champ(page).fill(voisin.handle);
    await expect(phrase(page)).toHaveText('Déjà pris');
    expect(await phrase(page).evaluate((e) => getComputedStyle(e).color)).toBe('rgb(180, 88, 31)');

    /**
     * LA COCHE DU CHAMP DE PSEUDO, et pas la première icône venue.
     *
     * Ce cas visait `svg[aria-hidden="true"]` en premier dans le cadre. Il a cassé
     * quand le rond de portrait a reçu son appareil photo — également
     * `aria-hidden` — qui vient AVANT dans le document. Le test mesurait alors
     * l'icône de l'avatar, qui n'a aucune raison de s'éteindre.
     *
     * On vise donc la coche par ce qui la définit : elle est dans la même boîte
     * que le champ de pseudo.
     */
    const coche = page.locator('[data-frame="desktop"]').locator('div:has(> input[aria-label="Votre pseudo"]) svg');
    await expect(coche).toHaveCount(1);
    expect(await coche.evaluate((e) => getComputedStyle(e).display)).toBe('none');
  });

  test('un pseudo mal formé est refusé sans appeler le serveur', async ({ page, request }) => {
    await connecter(page.context(), request);
    await page.goto('/bienvenue/profil');

    let appels = 0;
    page.on('request', (r) => {
      if (r.url().includes('/users/')) appels += 1;
    });

    // Deux caractères : `handleSchema` exige trois au moins.
    await champ(page).fill('ab');
    await expect(phrase(page)).not.toHaveText('Disponible');
    await expect(phrase(page)).not.toHaveText('');
    await page.waitForTimeout(800);
    expect(appels, 'un pseudo invalide ne doit RIEN demander au serveur').toBe(0);
  });
});
