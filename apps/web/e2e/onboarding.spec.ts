import { type Page, expect, test } from '@playwright/test';

/**
 * Les écrans d'accès et d'onboarding — sections P01 à O05 de la maquette.
 *
 * Trois choses sont vérifiées ici, et chacune correspond à un défaut trouvé en
 * regardant les pages dans un navigateur :
 *
 *   · la SÉMANTIQUE, que la maquette n'a pas — un document visuel n'a ni `main`
 *     ni `h1`, et axe signalait les deux sur les sept écrans ;
 *   · l'INTERACTIVITÉ, que la maquette porte pourtant dans son script — cartes
 *     de phase, interrupteur de disponibilité — et qui doit rester vivante ;
 *   · la CIBLE TACTILE de l'interrupteur, agrandie à 44 px sans que la piste
 *     peinte change d'un pixel. C'est cette dernière partie qui compte : une
 *     correction d'accessibilité qui déplace le design serait refusée.
 */

const ROUTES = [
  '/connexion',
  '/connexion/code',
  '/bienvenue/phase',
  '/bienvenue/lieu',
  '/bienvenue/objectif',
  '/bienvenue/profil',
  '/bienvenue/fin',
];

/**
 * Le cadre visible, demandé au DOM.
 *
 * On ne déduit PAS du projet Playwright : la configuration décrit le projet
 * mobile comme « Desktop Chrome » dans un viewport de 390 px, donc `isMobile`
 * y est faux. Un test qui s'y fiait cherchait le cadre ordinateur à 390 px,
 * ne trouvait rien, et échouait en accusant l'application.
 *
 * On ne redit pas non plus le seuil de 1024 px : c'est le CSS qui décide, et le
 * lui demander évite deux vérités.
 */
async function visibleFrame(page: Page): Promise<string> {
  const frame = await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>('[data-frame]')) {
      if (el.getBoundingClientRect().height > 0) return el.getAttribute('data-frame');
    }
    return null;
  });
  if (frame === null) throw new Error('aucun cadre visible');
  return `[data-frame="${frame}"]`;
}

test.describe('sémantique des écrans d’onboarding', () => {
  for (const route of ROUTES) {
    test(`${route} expose un repère principal et un titre de niveau 1`, async ({ page }) => {
      await page.goto(route);

      // Les deux cadres portent un `main`, mais un seul est dans l'arbre
      // d'accessibilité : l'autre est en `display: none`.
      await expect(page.locator('main:visible')).toHaveCount(1);

      const h1 = page.locator('main:visible h1');
      await expect(h1).toHaveCount(1);
      await expect(h1).not.toBeEmpty();
    });
  }
});

test.describe('O01 — choix de la phase', () => {
  test('la carte cliquée devient la seule sélectionnée', async ({ page }) => {
    await page.goto('/bienvenue/phase');
    const frame = await visibleFrame(page);

    // Les trois cartes sont les seuls boutons à porter une hauteur minimale :
    // 76 px sur ordinateur, 70 px sur mobile. On ne fixe donc pas la valeur —
    // sa seule présence suffit à les distinguer du bouton « Continuer ».
    const selected = () =>
      page.evaluate(
        (f) =>
          [...document.querySelectorAll<HTMLElement>(`${f} button`)]
            .filter((b) => b.style.minHeight !== '')
            .map((b) => b.style.border.startsWith('2px')),
        frame,
      );

    /**
     * ── LES CARTES SE DÉSIGNENT PAR LEUR HAUTEUR, PAS PAR LEUR RANG ──────────
     *
     * C'était « tous les boutons du cadre sauf Continuer », et un rang. Ce repère
     * a cassé le jour où le BOUTON RETOUR de l'en-tête est devenu un vrai
     * `<button>` : il est premier dans le document, donc tous les rangs ont
     * glissé d'un cran et `nth(2)` désignait la DEUXIÈME carte. Le cas accusait
     * la sélection, qui n'y était pour rien.
     *
     * On emploie donc le MÊME discriminant que `selected()` juste au-dessus — la
     * hauteur minimale, que seules les cartes portent. Un repère par rang se
     * casse au premier bouton ajouté ; celui-ci tient.
     */
    const cards = page.locator(`${frame} button`).filter({
      has: page.locator('xpath=self::*[contains(@style,"min-height")]'),
    });

    // La maquette démarre sur la deuxième carte : c'est son état initial, pas un
    // hasard, et le reproduire évite un écran qui s'ouvre sans rien de choisi.
    expect(await selected()).toEqual([false, true, false]);

    await cards.nth(2).click();
    expect(await selected()).toEqual([false, false, true]);

    await cards.nth(0).click();
    expect(await selected()).toEqual([true, false, false]);
  });
});

test.describe('O04 — interrupteur de disponibilité', () => {
  /**
   * L'interrupteur n'existe QUE dans le cadre ordinateur.
   *
   * Ce n'est pas un oubli de transcodage : la maquette ne dessine pas la ligne
   * « je suis disponible pour aider » dans son cadre de 390 px. Le test le
   * constate explicitement, pour qu'un jour où la maquette l'ajoutera, l'écart
   * se voie ici plutôt que de passer inaperçu.
   */
  test('n’est présent que dans le cadre que la maquette lui donne', async ({ page }) => {
    await page.goto('/bienvenue/profil');
    const counts = await page.evaluate(() => ({
      desktop: document.querySelectorAll('[data-frame="desktop"] [role="switch"]').length,
      mobile: document.querySelectorAll('[data-frame="mobile"] [role="switch"]').length,
    }));
    expect(counts).toEqual({ desktop: 1, mobile: 0 });
  });

  test('annonce son nom et son état, et les fait suivre', async ({ page }) => {
    await page.goto('/bienvenue/profil');
    const toggle = page.locator('[data-frame="desktop"] [role="switch"]');

    await expect(toggle).toHaveAttribute('aria-label', 'Je suis disponible pour aider');
    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    await toggle.evaluate((el: HTMLElement) => el.click());
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  test('cache les types d’aide quand la disponibilité est coupée', async ({ page }) => {
    await page.goto('/bienvenue/profil');
    const chip = page.locator('[data-frame="desktop"] >> text=Relecture CV');
    await expect(chip).toHaveCount(1);

    await page.locator('[data-frame="desktop"] [role="switch"]').evaluate((el: HTMLElement) => el.click());
    // Demander de l'aide sur des types qu'on ne rend plus n'aurait pas de sens :
    // la maquette les retire, et c'est le comportement attendu.
    await expect(chip).toHaveCount(0);
  });

  /**
   * LE test qui protège le design.
   *
   * La cible fait 44 px pour satisfaire `T1` §2.3, mais la piste PEINTE garde
   * les 48 × 28 de la maquette : le remplissage porte la boîte à 44 px et
   * `background-clip: content-box` empêche la couleur de s'y étendre. Sans cette
   * assertion, n'importe qui « corrigerait » la cible en grossissant la piste.
   */
  test('agrandit la cible sans grossir la piste', async ({ page }) => {
    await page.goto('/bienvenue/profil');
    // La mesure n'a de sens que si le cadre est affiché : sous 1024 px il est en
    // `display: none`, et toutes ses boîtes valent zéro. Le test porte donc sur
    // le seul cadre où la maquette dessine l'interrupteur.
    test.skip((await visibleFrame(page)) !== '[data-frame="desktop"]', 'interrupteur absent du cadre mobile');

    const measured = await page.evaluate(() => {
      const sw = document.querySelector<HTMLElement>('[data-frame="desktop"] [role="switch"]');
      if (sw === null) throw new Error('interrupteur introuvable');
      const box = sw.getBoundingClientRect();
      const style = getComputedStyle(sw);
      const knob = sw.querySelector('span')?.getBoundingClientRect();
      return {
        targetHeight: Math.round(box.height),
        paintedWidth: parseFloat(style.width),
        paintedHeight: parseFloat(style.height),
        backgroundClip: style.backgroundClip,
        knobCentre: knob === undefined ? -1 : Math.round(knob.top + knob.height / 2 - box.top),
      };
    });

    expect(measured.targetHeight).toBeGreaterThanOrEqual(44);
    expect(measured.paintedWidth).toBe(48);
    expect(measured.paintedHeight).toBe(28);
    expect(measured.backgroundClip).toBe('content-box');
    // Le curseur reste centré : la boîte fait 44 px, son milieu est à 22 px.
    expect(measured.knobCentre).toBe(Math.round(measured.targetHeight / 2));
  });
});

test.describe('O03 — création du parcours', () => {
  test('la case annonce son état, et le parcours n’est jamais imposé', async ({ page }) => {
    await page.goto('/bienvenue/objectif');
    const frame = await visibleFrame(page);

    const box = page.locator(`${frame} [role="checkbox"]`);
    await expect(box).toHaveAttribute('aria-checked', 'true');

    await box.evaluate((el: HTMLElement) => el.click());
    await expect(box).toHaveAttribute('aria-checked', 'false');
  });

  /**
   * ÉCART DE MAQUETTE, constaté et non contourné.
   *
   * §5 pose une règle dure : « le parcours n'est jamais imposé ». Décocher la case
   * doit donc dire ce qui se passera. Le cadre ORDINATEUR l'écrit — « Aucun
   * parcours ne sera créé. Vous pourrez en créer un plus tard depuis Parcours. » —
   * mais le cadre MOBILE ne montre aucune phrase explicative, ni dans un état ni
   * dans l'autre.
   *
   * Le test fixe donc l'état des lieux au lieu de le masquer : le texte est exigé
   * sur ordinateur, et son absence sur mobile est ASSERTÉE. Le jour où la maquette
   * ajoutera la phrase, ce test échouera — c'est le but : il faudra alors venir le
   * mettre à jour, plutôt que de découvrir l'écart en production.
   */
  test('explique la conséquence — sur ordinateur seulement, à ce jour', async ({ page }) => {
    await page.goto('/bienvenue/objectif');

    const said = await page.evaluate(() => {
      const text = (frame: string) =>
        document.querySelector(`[data-frame="${frame}"]`)?.textContent ?? '';
      return {
        desktop: text('desktop').includes('sera créé'),
        mobile: text('mobile').includes('sera créé'),
      };
    });

    expect(said.desktop).toBe(true);
    expect(said.mobile).toBe(false);
  });
});

test.describe('O05 — les deux atterrissages', () => {
  test('sert la variante « sans parcours » sur demande', async ({ page }) => {
    await page.goto('/bienvenue/fin');
    await expect(page.locator('main h1')).toContainText('Votre parcours est prêt');

    await page.goto('/bienvenue/fin?parcours=non');
    // §5 écran 6 : sans parcours, on atterrit sur le réseau de la ville. C'est un
    // vrai atterrissage, pas une version dégradée.
    await expect(page.locator('main h1')).toContainText('Bienvenue');
  });
});
