import { type Page, expect, test } from '@playwright/test';
import { connecter } from './session';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ O04 « PRÉSENTEZ-VOUS » — QUATRE CONTRÔLES QUI N'EXISTAIENT PAS            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Le checkbox, la sélection d'image, L'ajout de compétences et
 * langue, ajoute aussi plus d'option au niveau de la section je suis disponible
 * pour aider », puis « les inputs d'ajout de langue, compétences et autres de la
 * page marchent ? »
 *
 * Ils ne marchaient pas, et la mesure était sans appel : ZÉRO `input[type=file]`,
 * ZÉRO bouton de portrait, ZÉRO champ de recherche, ZÉRO pastille de langue
 * cliquable. « Comptabilité », « Excel », « Français », « Fon », « Anglais » et
 * le mot gris « Rechercher… » étaient six `<span>` littéraux — un dessin
 * d'intention, sans mécanisme. Les routes, elles, existaient toutes :
 * `PUT /me/avatar`, `GET /places/skills`, `GET /places/languages`, et
 * `updateProfileSchema` portait `skillIds` et `languageIds` depuis le début.
 *
 * ── CE QUE CE FICHIER NE COUVRE PAS, ET POURQUOI ──────────────────────────
 *
 * Le cadre MOBILE. La planche de 390 px ne dessine NI portrait, NI compétences,
 * NI langues — mesuré : zéro occurrence. Leur ajouter un contrôle serait dessiner
 * à la place du porteur. REMONTÉ, et c'est la raison du `test.skip` ci-dessous.
 *
 * ── LE DERNIER CAS EST LE SEUL VERDICT STRICT ─────────────────────────────
 *
 * Les autres vérifient l'écran ; le dernier relit LA CHARGE de `PATCH /me/profile`.
 * Un contrôle qui bouge à l'écran sans changer ce qui part est le défaut que ce
 * dépôt a déjà payé, et c'était EXACTEMENT l'état d'avant : cinq noms affichés,
 * rien d'envoyé.
 */

const cadre = (page: Page) => page.locator('[data-frame="desktop"]');

/**
 * LES SUGGESTIONS D'UNE BOÎTE, ET PAS DE L'AUTRE.
 *
 * L'écran porte DEUX de ces contrôles, côte à côte. Un `[role="option"]` global
 * attrapait celui qui se trouvait être ouvert, et le test ajoutait une
 * compétence en croyant choisir une langue — il a mis deux tours à l'avouer.
 * On borne donc à la boîte qui contient CE champ.
 */
const suggestions = (page: Page, libelle: string) =>
  cadre(page).locator(`div:has(> input[aria-label="Ajouter ${libelle}"]) [role="option"]`);

/** Un PNG d'un pixel, construit ici : rien n'est lu du disque du dépôt. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test.describe('O04 — se présenter', () => {
  test.skip(
    ({ viewport }) => (viewport?.width ?? 0) < 1024,
    'la planche de 390 px ne dessine ni portrait, ni compétences, ni langues',
  );

  test('le rond de portrait est un bouton, et envoyer une photo la montre', async ({
    page,
    request,
  }) => {
    await connecter(page.context(), request);
    await page.goto('/bienvenue/profil');

    const rond = cadre(page).getByRole('button', { name: 'Choisir une photo de profil' });
    await expect(rond).toHaveCount(1);
    /**
     * 84 px : la taille que la maquette dessine. Promouvoir un `<div>` en
     * `<button>` ne doit RIEN déplacer — la règle du porteur est qu'une
     * correction qui bouge le design est refusée.
     */
    expect((await rond.boundingBox())?.height).toBe(84);

    // Avant : pas de portrait, et l'appareil photo de la maquette est visible.
    expect(await rond.evaluate((e) => getComputedStyle(e).backgroundImage)).toBe('none');
    expect(await rond.locator('svg').evaluate((e) => getComputedStyle(e).display)).toBe('block');

    const reponse = page.waitForResponse((r) => r.url().includes('/me/avatar'));
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: 'portrait.png', mimeType: 'image/png', buffer: PNG });
    expect((await reponse).status()).toBe(200);

    /**
     * APRÈS : le rond porte le portrait, et l'appareil photo s'efface. L'adresse
     * est celle du SERVEUR, préfixée par `urlMedia` — une adresse relative serait
     * demandée au serveur web, qui ne sert aucun média.
     */
    await expect
      .poll(async () => rond.evaluate((e) => getComputedStyle(e).backgroundImage))
      .toContain('/media/avatar/');
    expect(await rond.locator('svg').evaluate((e) => getComputedStyle(e).display)).toBe('none');
  });

  test('les compétences s’ajoutent et se retirent, depuis le référentiel', async ({
    page,
    request,
  }) => {
    await connecter(page.context(), request);
    await page.goto('/bienvenue/profil');

    const champ = cadre(page).getByLabel('Ajouter compétences');
    await expect(champ).toHaveCount(1);

    await champ.fill('compta');
    const options = suggestions(page, 'compétences');
    await expect(options.first()).toBeVisible();
    /**
     * La suggestion vient de `GET /places/skills` — 60 lignes servies triées —
     * et porte sa CATÉGORIE, que la route rend elle aussi. Rien n'est écrit dans
     * l'écran : une liste codée en dur passerait ce test, mais pas celui de la
     * charge, plus bas.
     */
    await expect(options.first()).toContainText('Comptabilité');

    await options.first().click();
    const retirer = cadre(page).getByRole('button', { name: /^Retirer / });
    await expect(retirer).toHaveCount(1);
    await expect(retirer).toHaveAttribute('aria-label', 'Retirer Comptabilité');

    // Et elle se retire : une pastille qu'on ne peut pas enlever est un piège.
    await retirer.click();
    await expect(cadre(page).getByRole('button', { name: /^Retirer / })).toHaveCount(0);
  });

  test('les langues s’ajoutent depuis le référentiel', async ({ page, request }) => {
    await connecter(page.context(), request);
    await page.goto('/bienvenue/profil');

    const champ = cadre(page).getByLabel('Ajouter langues');
    await expect(champ).toHaveCount(1);

    await champ.fill('fran');
    const options = suggestions(page, 'langues');
    await expect(options.first()).toBeVisible();
    await expect(options.first()).toContainText('Français');
    await options.first().click();

    await expect(cadre(page).getByRole('button', { name: 'Retirer Français' })).toHaveCount(1);
  });

  /**
   * « ajoute aussi plus d'option au niveau de la section je suis disponible pour
   * aider » — cinq pastilles dessinées, trois ajoutées par la fusion des enums.
   */
  test('huit types d’aide, et jamais plus de cinq retenus', async ({ page, request }) => {
    await connecter(page.context(), request);
    await page.goto('/bienvenue/profil');

    const aides = cadre(page)
      .locator('button[aria-pressed]')
      .filter({ hasText: /Démarches|Relecture CV|Trajet|Traduction|Matériel|Logement|Accueil|Autre/ });
    await expect(aides).toHaveCount(8);

    /**
     * `updateProfileSchema.helpTypes` porte `.max(5)`. L'écran doit tenir la
     * borne AVANT l'envoi : offrir huit cases et en laisser cocher six ferait
     * refuser l'enregistrement par le serveur, sur un formulaire qui a dit oui.
     */
    for (let i = 0; i < 8; i += 1) {
      const pastille = aides.nth(i);
      if ((await pastille.getAttribute('aria-pressed')) === 'false') await pastille.click();
    }
    const retenus = await aides.evaluateAll(
      (els) => els.filter((e) => e.getAttribute('aria-pressed') === 'true').length,
    );
    expect(retenus).toBeLessThanOrEqual(5);
    expect(retenus).toBe(5);
  });

  test('la charge de PATCH /me/profile emporte les compétences et les langues', async ({
    page,
    request,
  }) => {
    await connecter(page.context(), request);

    const charges: Record<string, unknown>[] = [];
    page.on('request', (r) => {
      if (r.method() === 'PATCH' && r.url().endsWith('/me/profile')) {
        charges.push(r.postDataJSON() as Record<string, unknown>);
      }
    });

    await page.goto('/bienvenue/profil');
    await cadre(page).getByLabel('Ajouter compétences').fill('compta');
    await suggestions(page, 'compétences').first().click();
    await cadre(page).getByLabel('Ajouter langues').fill('fran');
    await suggestions(page, 'langues').first().click();

    await cadre(page).getByRole('button', { name: 'Continuer', exact: true }).click();
    await expect(page).toHaveURL(/\/bienvenue\/fin/);

    expect(charges).toHaveLength(1);
    const charge = charges[0] ?? {};
    /**
     * DES UUID, et c'est le point : avant ce lot, l'écran affichait des NOMS
     * écrits dans la maquette et n'envoyait rien du tout. Une liste codée en dur
     * n'aurait pas d'identifiant à envoyer.
     */
    expect(charge['skillIds']).toHaveLength(1);
    expect((charge['skillIds'] as string[])[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(charge['languageIds']).toHaveLength(1);
    expect((charge['languageIds'] as string[])[0]).toMatch(/^[0-9a-f-]{36}$/);
    // Et le reste de l'écran part toujours : on n'a rien cassé en ajoutant.
    expect(charge['occupationStatus']).toBe('STUDENT');
    expect(charge['availableToHelp']).toBe(true);
  });
});
