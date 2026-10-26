import { expect, test } from '@playwright/test';
import { connecter } from './session';
import { publierGuide, villeActive } from './aide-w5b';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ K10 « ENREGISTRÉS » — LE SEUL DES DIX ÉCRANS SANS SOURCE                  ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Finalise les routes bookmarks et branche-les. »
 *
 * MESURÉ AVANT : la page servait les six lignes de la maquette — « Obtenir la
 * garantie Visale sans CDI », « Story de Aïcha », « Repas partagé béninois » —
 * à tout le monde, et les dix onglets étaient des `<span>`. Le module API, lui,
 * n'avait aucun contrôleur : §2.9 annonçait quatre routes, zéro était livrée.
 *
 * Ce cas tient les trois promesses de l'écran, et il les tient SUR LES DEUX
 * PLANCHES — le porteur : « veille toujours à ce que toutes les corrections
 * soient aussi faites sur mobile ».
 */
test.describe('les enregistrés', () => {
  test('la liste vient du serveur, l’onglet filtre et le signet retire', async ({
    page,
    request,
    browser,
    playwright,
  }) => {
    test.setTimeout(120_000);
    const membre = await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    const auth = { authorization: `Bearer ${membre.accessToken}` };

    // ── RIEN D'ENREGISTRÉ : le bloc vide de la planche « ÉTATS » ──────────
    await page.goto('/compte/enregistres');
    await expect(
      page.getByText('Vous n’avez rien enregistré').filter({ visible: true }).first(),
      'un compte neuf doit voir le bloc vide, pas les six lignes de la maquette',
    ).toBeVisible({ timeout: 25_000 });
    await expect(
      page.getByText('Obtenir la garantie Visale sans CDI'),
      'la ligne d’exemple de la maquette est servie comme une donnée',
    ).toHaveCount(0);

    // ── DEUX SIGNETS POSÉS PAR L'API, DE DEUX ESPÈCES ────────────────────
    /**
     * LE DÉCOR EST CRÉÉ ICI (lot w5b). Le test prenait « le premier guide » et « Lyon » du
     * référentiel : une base fraîche n'a aucun guide, et Lyon y est inactive. Un guide est
     * donc publié par un membre N2 neuf (`aide-w5b.ts`), et la ville est la première ville
     * ACTIVE — celle où `connecter()` installe ses membres.
     */
    const decor = await publierGuide(browser, playwright, 'Obtenir la garantie Visale sans CDI');
    const guide = { id: decor.id, title: decor.titre };
    const cite = await villeActive(request);
    const ville = { id: cite.id, name: cite.name };

    for (const [subjectType, subjectId] of [
      ['GUIDE', guide.id],
      ['CITY', ville.id],
    ] as const) {
      const pose = await request.put(`${API}/me/bookmarks`, {
        headers: auth,
        data: { subjectType, subjectId },
      });
      expect(pose.status(), `PUT /me/bookmarks ${subjectType}`).toBe(200);
    }

    // ── LES DEUX PLANCHES MONTRENT LES DEUX LIGNES ───────────────────────
    for (const largeur of [1440, 390]) {
      await page.setViewportSize({ width: largeur, height: 900 });
      await page.goto('/compte/enregistres');
      const titres = page.locator('[data-enregistres-lien]').filter({ visible: true });
      await expect(titres, `à ${largeur} px, les deux enregistrés doivent être là`).toHaveCount(2, {
        timeout: 25_000,
      });
      await expect(page.getByText(guide.title).filter({ visible: true }).first()).toBeVisible();

      /**
       * LA CIBLE DE RETRAIT FAIT 44 px — T1 §2.3. La maquette dessine un svg de
       * 18 px sans boîte, ce qui est une cible qu'on rate sur un téléphone.
       */
      const signet = page.locator('[data-enregistres-retirer]').filter({ visible: true }).first();
      const boite = await signet.boundingBox();
      expect(boite?.width ?? 0, `cible de retrait trop petite à ${largeur} px`).toBeGreaterThanOrEqual(44);
      expect(boite?.height ?? 0, `cible de retrait trop petite à ${largeur} px`).toBeGreaterThanOrEqual(44);
    }

    // ── L'ONGLET FILTRE, ET IL FILTRE AU SERVEUR ─────────────────────────
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/compte/enregistres');
    const ongletVilles = page
      .locator('[data-enregistres-onglet="CITY"]')
      .filter({ visible: true })
      .first();
    await expect(ongletVilles).toBeVisible({ timeout: 25_000 });
    await ongletVilles.click();
    await expect(
      page.locator('[data-enregistres-lien]').filter({ visible: true }),
      'l’onglet « Villes » doit ne garder que la ville',
    ).toHaveCount(1, { timeout: 15_000 });
    await expect(ongletVilles).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText(ville.name).filter({ visible: true }).first()).toBeVisible();

    // ── LE SIGNET RETIRE, ET LE COMPTE SUIT ──────────────────────────────
    await page.locator('[data-enregistres-onglet="*"]').filter({ visible: true }).first().click();
    await expect(page.locator('[data-enregistres-lien]').filter({ visible: true })).toHaveCount(2, {
      timeout: 15_000,
    });
    await page.locator('[data-enregistres-retirer]').filter({ visible: true }).first().click();
    await expect(
      page.locator('[data-enregistres-lien]').filter({ visible: true }),
      'le retrait doit faire tomber la liste à un',
    ).toHaveCount(1, { timeout: 15_000 });

    const reste = await request.get(`${API}/me/bookmarks`, { headers: auth });
    expect(((await reste.json()) as { meta: { total: number } }).meta.total).toBe(1);
  });
});
