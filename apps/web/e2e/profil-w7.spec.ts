import { type Locator, type Page, expect, test } from '@playwright/test';
import { connecter } from './session';
import { monterEnL1 } from './niveau';

/**
 * LOT W7 — TROIS DÉFAUTS DU PROFIL ET UN DE /parrainage/devenir, MESURÉS.
 *
 *  1. L'interrupteur « Je suis disponible pour aider » (O04) : la pastille doit être
 *     ENTIÈREMENT dans la piste, et la piste une vraie piste (rayon plein). Mesuré avant
 *     correction : la zone peinte devenait une ellipse 22 × 14 (padding + background-clip).
 *  2. Le panneau de « Compétences » (O04) : son rectangle est SOUS le champ qui l'ouvre
 *     (il s'ouvrait à 1004 px sur une fenêtre de 1000).
 *  3. /parrainage/devenir : un membre non vérifié lit pourquoi, au lieu de « la liste n'a
 *     pas pu être chargée » ; un membre L1 voit le formulaire. Les deux largeurs.
 *  4. L'étape « D'où venez-vous ? » : l'aide « bientôt » dit la vérité du produit.
 */

const rect = async (l: Locator) => {
  const b = await l.boundingBox();
  if (b === null) throw new Error('élément sans boîte');
  return b;
};

async function dansLaPiste(page: Page, interrupteur: Locator): Promise<void> {
  const piste = interrupteur.locator('[data-interrupteur-piste]');
  const pastille = piste.locator('span');
  const p = await rect(piste);
  const k = await rect(pastille);
  // Piste 48 × 28, pastille 22 × 22.
  expect([Math.round(p.width), Math.round(p.height)]).toEqual([48, 28]);
  expect([Math.round(k.width), Math.round(k.height)]).toEqual([22, 22]);
  // ENTIÈREMENT dans la piste, avec une marge de 3 px des deux côtés verticaux.
  expect(k.x).toBeGreaterThanOrEqual(p.x);
  expect(k.x + k.width).toBeLessThanOrEqual(p.x + p.width);
  expect(k.y).toBeGreaterThanOrEqual(p.y);
  expect(k.y + k.height).toBeLessThanOrEqual(p.y + p.height);
  expect(Math.round(k.y - p.y)).toBe(3);
  // La piste n'est pas rognée par un remplissage : border-box, aucun padding, rayon plein.
  const style = await piste.evaluate((e) => {
    const c = getComputedStyle(e);
    return { box: c.boxSizing, pad: c.padding, rayon: parseFloat(c.borderTopLeftRadius), clip: c.backgroundClip };
  });
  expect(style.box).toBe('border-box');
  expect(style.pad).toBe('0px');
  expect(style.rayon).toBeGreaterThanOrEqual(14);
  expect(style.clip).toBe('border-box');
  // La cible tactile reste de 44 px.
  const cible = await rect(interrupteur);
  expect(cible.height).toBeGreaterThanOrEqual(44);
  expect(cible.width).toBeGreaterThanOrEqual(44);
  // Le bouton lui-même est dans la fenêtre.
  const vp = page.viewportSize();
  expect(cible.x + cible.width).toBeLessThanOrEqual(vp?.width ?? 0);
}

test.describe('O04 — interrupteur « disponible pour aider »', () => {
  test('la pastille reste dans la piste, ouvert et fermé, avec rôle, état et focus', async ({ page, request }) => {
    await connecter(page.context(), request);
    await page.goto('/bienvenue/profil');
    const sw = page.getByRole('switch', { name: /disponible pour aider/i }).locator('visible=true');
    await expect(sw).toHaveCount(1);
    await sw.scrollIntoViewIfNeeded();

    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await dansLaPiste(page, sw);
    const gauche = async () => (await rect(sw.locator('[data-interrupteur-piste] span'))).x;
    const xOuvert = await gauche();

    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    await dansLaPiste(page, sw);
    expect(await gauche()).toBeLessThan(xOuvert);

    // Le clavier le bascule, et le focus se voit (contour de 2 px, T1 §6).
    await sw.focus();
    await page.keyboard.press('Space');
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    const contour = await sw.evaluate((e) => {
      const c = getComputedStyle(e);
      return { style: c.outlineStyle, largeur: parseFloat(c.outlineWidth) };
    });
    expect(contour.style).not.toBe('none');
    expect(contour.largeur).toBeGreaterThanOrEqual(2);
    await dansLaPiste(page, sw);
  });
});

test.describe('K01 — interrupteurs du profil', () => {
  test('la pastille reste dans la piste, ouvert et fermé', async ({ page, request }) => {
    await connecter(page.context(), request);
    await page.goto('/compte/profil');
    const sw = page.getByRole('switch', { name: 'Disponible pour aider' }).locator('visible=true');
    await expect(sw).toHaveCount(1);
    await sw.scrollIntoViewIfNeeded();
    for (let i = 0; i < 2; i += 1) {
      // Une seule lecture : la page peut bouger entre deux mesures séparées.
      const m = await sw.evaluate((e) => {
        const c = e.getBoundingClientRect();
        const k = (e.firstElementChild as HTMLElement).getBoundingClientRect();
        return { c, k, rayon: parseFloat(getComputedStyle(e).borderTopLeftRadius) };
      });
      expect(m.k.x).toBeGreaterThanOrEqual(m.c.x);
      expect(m.k.x + m.k.width).toBeLessThanOrEqual(m.c.x + m.c.width);
      expect(m.k.y).toBeGreaterThanOrEqual(m.c.y);
      expect(m.k.y + m.k.height).toBeLessThanOrEqual(m.c.y + m.c.height);
      expect(m.rayon).toBeGreaterThanOrEqual(m.c.height / 2);
      await sw.click();
    }
  });
});

test.describe('O04 — le panneau de choix', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'la planche de 390 px ne dessine pas ces champs');

  for (const [nom, etiquette] of [
    ['Compétences', 'Ajouter compétences'],
    ['Langues', 'Ajouter langues'],
  ] as const) {
    test(`« ${nom} » s'ouvre SOUS son champ, dans la fenêtre, et se ferme avec Échap`, async ({ page, request }) => {
      await connecter(page.context(), request);
      await page.goto('/bienvenue/profil');
      const champ = page.getByLabel(etiquette);
      const boite = champ.locator('xpath=..');
      await champ.click();
      const liste = boite.getByRole('listbox');
      await expect(liste).toBeVisible();

      const b = await rect(boite);
      const l = await rect(liste);
      const vp = page.viewportSize();
      expect(l.y).toBeGreaterThanOrEqual(b.y + b.height); // sous le champ
      expect(l.y - (b.y + b.height)).toBeLessThanOrEqual(8); // tout contre lui
      expect(Math.abs(l.width - b.width)).toBeLessThanOrEqual(3); // à sa largeur
      expect(Math.abs(l.x - b.x)).toBeLessThanOrEqual(3);
      expect(l.y + l.height).toBeLessThanOrEqual(vp?.height ?? 0); // dans la fenêtre

      await page.keyboard.press('Escape');
      await expect(liste).toHaveCount(0);
    });
  }
});

test.describe('/parrainage/devenir', () => {
  test('un membre non vérifié lit pourquoi, au lieu d’une liste qui ne vient pas', async ({ page, request }) => {
    await connecter(page.context(), request);
    await page.goto('/parrainage/devenir');
    const carte = page.getByText('Devenir parrain demande un compte vérifié').locator('visible=true');
    await expect(carte).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Vérifier mon compte' }).locator('visible=true')).toHaveAttribute(
      'href',
      '/compte/verification',
    );
    await expect(page.getByText('La liste n’a pas pu être chargée')).toHaveCount(0);
    await expect(page.getByText('Chargement…')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('un membre L1 voit les conditions et la liste des parcours', async ({ page, request }) => {
    const m = await connecter(page.context(), request);
    await monterEnL1(page.context(), request, m.accessToken);
    await page.goto('/parrainage/devenir');
    await expect(page.getByText('CONDITIONS').locator('visible=true')).toHaveCount(1);
    const groupe = page.getByRole('group', { name: 'Parcours que vous connaissez' }).locator('visible=true');
    await expect(groupe).toHaveCount(1);
    expect(await groupe.getByRole('button').count()).toBeGreaterThan(0);
    await expect(page.getByText('La liste n’a pas pu être chargée')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('une panne du serveur offre « Réessayer », qui relit vraiment', async ({ page, request }) => {
    const m = await connecter(page.context(), request);
    await monterEnL1(page.context(), request, m.accessToken);
    // Les deux cadres (ordinateur, téléphone) lisent la route : tant que la panne dure, ils échouent tous deux.
    let panne = true;
    await page.route('**/me/mentor-profile', (route) =>
      panne
        ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"code":"INTERNAL","message":"x"}}' })
        : route.continue(),
    );
    await page.goto('/parrainage/devenir');
    const reessayer = page.getByRole('button', { name: 'Réessayer' }).locator('visible=true');
    await expect(reessayer).toHaveCount(1);
    panne = false;
    await reessayer.click();
    await expect(page.getByText('CONDITIONS').locator('visible=true')).toHaveCount(1);
  });
});

test.describe('O02 — « bientôt »', () => {
  test('l’aide dit ce que « bientôt » veut dire, sans promettre de notification', async ({ page, request }) => {
    await connecter(page.context(), request);
    await page.goto('/bienvenue/lieu');
    await page.getByRole('button', { name: 'Votre ville' }).locator('visible=true').click();
    const aide = page.locator('[data-aide-bientot]:visible');
    await expect(aide).toHaveCount(1);
    await expect(aide).toContainText('pas encore de réseau');
    await expect(aide).not.toContainText(/prévenu|notifi/i);
  });
});
