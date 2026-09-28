import { expect, test, type Page } from '@playwright/test';

/**
 * Les modales du fil — « fenêtre sur web, feuille sur mobile », comme la maquette
 * l'écrit sous chacune de ses planches.
 *
 * Ce que ces tests éprouvent n'est PAS le dessin : il est transcodé, donc il est
 * celui de la maquette par construction. Ils éprouvent ce qu'une image ne peut pas
 * contenir — la bascule de forme au bon seuil, l'ouverture, les trois façons de
 * fermer, et les promesses d'accessibilité que `aria-modal` engage.
 *
 * Les assertions portent sur la GÉOMÉTRIE et les RÔLES, jamais sur des classes :
 * le balisage vient de la maquette en styles en ligne, et viser une classe se
 * casserait à la première régénération.
 */

/** Ce fichier pilote lui-même ses tailles : un seul projet suffit. */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'piloté par le test');

async function visit(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/accueil', { waitUntil: 'networkidle' });
}

/** Le déclencheur visible à cette largeur — les deux cadres sont dans le document. */
function trigger(page: Page, modal: string, width: number) {
  const frame = width >= 1024 ? '[data-frame="desktop"]' : '[data-frame="mobile"]';
  return page.locator(`${frame} [data-modal-open="${modal}"]`).first();
}

test.describe('ouverture et forme', () => {
  test('1440 px — « Commenter » ouvre une FENÊTRE centrée', async ({ page }) => {
    await visit(page, 1440);
    await trigger(page, 'A01C', 1440).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const panel = dialog.locator('[data-modal-panel]');
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    if (box === null) return;

    // La maquette fixe le panneau à 720 px, et le centre horizontalement.
    expect(Math.round(box.width)).toBe(720);
    const centre = box.x + box.width / 2;
    expect(Math.abs(centre - 1440 / 2)).toBeLessThan(2);
    // Une fenêtre ne touche pas le bas de l'écran : la maquette laisse 40 px.
    expect(box.y).toBeGreaterThan(20);
  });

  test('390 px — « Commenter » ouvre une FEUILLE collée en bas', async ({ page }) => {
    await visit(page, 390);
    await trigger(page, 'A01C', 390).click();

    const panel = page.getByRole('dialog').locator('[data-modal-panel]');
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    if (box === null) return;

    // Toute la largeur, et posée sur le bord bas — c'est ce qui distingue une
    // feuille d'une fenêtre, et c'est le seul point que la géométrie peut dire.
    expect(Math.round(box.width)).toBe(390);
    expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(898);
  });

  test('le seuil est à 1024 px, le même que celui des écrans', async ({ page }) => {
    for (const { w, forme } of [
      { w: 1023, forme: 'feuille' },
      { w: 1024, forme: 'fenetre' },
    ] as const) {
      await visit(page, w);
      await trigger(page, 'A01C', w).click();
      const box = await page.getByRole('dialog').locator('[data-modal-panel]').boundingBox();
      expect(box, `${w} px`).not.toBeNull();
      if (box === null) continue;
      if (forme === 'feuille') expect(Math.round(box.width), `${w} px`).toBe(w);
      else expect(Math.round(box.width), `${w} px`).toBeLessThan(w);
    }
  });

  test('« Partager » ouvre SA fenêtre, pas celle des commentaires', async ({ page }) => {
    await visit(page, 1440);
    await trigger(page, 'A01P', 1440).click();
    // Le nom accessible vient du titre VISIBLE de la maquette, via aria-labelledby.
    await expect(page.getByRole('dialog', { name: /Partager/ })).toBeVisible();
    await expect(page.getByRole('dialog', { name: /Commentaires/ })).toHaveCount(0);
  });
});

test.describe('fermeture — les trois chemins', () => {
  test('la croix ferme', async ({ page }) => {
    await visit(page, 1440);
    await trigger(page, 'A01C', 1440).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('Échap ferme', async ({ page }) => {
    await visit(page, 1440);
    await trigger(page, 'A01C', 1440).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('un clic sur le voile ferme, un clic DANS le panneau non', async ({ page }) => {
    await visit(page, 1440);
    await trigger(page, 'A01C', 1440).click();

    // D'abord la moitié qu'on oublie : cliquer dans le panneau ne doit RIEN faire.
    // Sans cette garde, un membre qui sélectionne du texte et relâche hors de la
    // zone perdrait ce qu'il écrivait.
    await page.getByRole('dialog').locator('[data-modal-panel]').click({ position: { x: 10, y: 10 } });
    await expect(page.getByRole('dialog')).toBeVisible();

    // Le voile occupe tout l'écran ; on clique là où le panneau n'est pas.
    await page.mouse.click(30, 450);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('la poignée de la feuille est un vrai bouton, et sa cible est atteignable au doigt', async ({ page }) => {
    await visit(page, 390);
    await trigger(page, 'A01C', 390).click();

    const handle = page.getByRole('dialog').getByRole('button', { name: 'Fermer' });
    const box = await handle.boundingBox();
    expect(box).not.toBeNull();
    if (box === null) return;

    /**
     * La barre visible mesure 40 × 5 px dans la maquette. C'est juste comme
     * dessin, inutilisable comme bouton — et c'est le SEUL contrôle de la feuille.
     * La cible est donc élargie par du remplissage, sans que la barre grandisse.
     */
    expect(box.height).toBeGreaterThanOrEqual(24);
    expect(box.width).toBeGreaterThanOrEqual(24);

    await handle.click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

test.describe('ce que `aria-modal` promet', () => {
  test('la boîte de dialogue porte le nom de son titre VISIBLE', async ({ page }) => {
    await visit(page, 1440);
    await trigger(page, 'A01C', 1440).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    // `aria-labelledby` désigne le `<h2>` que le transcodeur a promu : le nom
    // accessible ne peut donc pas dériver du texte affiché.
    await expect(dialog).toHaveAttribute('aria-labelledby', 'a01c-titre');
    await expect(page.locator('#a01c-titre')).toContainText('Commentaires');
    // UN SEUL élément porte cet identifiant. Deux — un par cadre — rendraient
    // `aria-labelledby` ambigu et la modale pourrait prendre le nom du cadre masqué.
    await expect(page.locator('#a01c-titre')).toHaveCount(1);
  });

  test('un seul `main` dans le document, même modale ouverte', async ({ page }) => {
    await visit(page, 1440);
    const before = await page.getByRole('main').count();
    await trigger(page, 'A01C', 1440).click();
    // Une modale n'est pas le contenu principal de la page : c'est celui qui est
    // DERRIÈRE elle. Deux repères `main` ne sont pas interprétables.
    expect(await page.getByRole('main').count()).toBe(before);
  });

  test('Tab tourne en rond dans le panneau', async ({ page }) => {
    await visit(page, 1440);
    await trigger(page, 'A01C', 1440).click();

    const dialog = page.getByRole('dialog');
    // Vingt tabulations : bien plus que le nombre de contrôles du panneau. Si le
    // piège fuit, le focus finit dans le fil, derrière le voile — la promesse
    // d'`aria-modal` serait fausse et le membre parcourrait un écran qu'il ne voit
    // plus.
    for (let n = 0; n < 20; n += 1) {
      await page.keyboard.press('Tab');
      const inside = await dialog.evaluate(
        (node, _) => node.contains(document.activeElement),
        null,
      );
      expect(inside, `après ${n + 1} tabulation(s)`).toBe(true);
    }
  });

  test('le focus REVIENT sur le bouton qui a ouvert', async ({ page }) => {
    await visit(page, 1440);
    const opener = trigger(page, 'A01C', 1440);
    await opener.click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Sans le retour de focus, refermer renvoie au début du document : un membre
    // au clavier doit re-parcourir tout le fil pour revenir où il était.
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-modal-open'));
    expect(focused).toBe('A01C');
  });

  test('le défilement de la page est bloqué pendant l’ouverture, et rendu après', async ({ page }) => {
    await visit(page, 1440);
    await trigger(page, 'A01C', 1440).click();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  });
});

test.describe('le partage se manipule', () => {
  test('choisir des contacts change le libellé du bouton', async ({ page }) => {
    await visit(page, 1440);
    await trigger(page, 'A01P', 1440).click();

    const dialog = page.getByRole('dialog');
    // La maquette part avec deux contacts choisis.
    await expect(dialog.getByText(/Envoyer à 2 contacts/)).toBeVisible();

    // « cliquez les contacts », dit la maquette : c'est une vraie interaction.
    await dialog.getByRole('button', { name: /Sandra M\./ }).click();
    await expect(dialog.getByText(/Envoyer à 1 contact$/)).toBeVisible();
  });
});
