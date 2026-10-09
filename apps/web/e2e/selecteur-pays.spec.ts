import { type Locator, type Page, expect, test } from '@playwright/test';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ O02 — LE PANNEAU DE CHOIX DU PAYS D'ORIGINE                                ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « il faut afficher un slide left modal quand on clique sur le pays
 * et qui montre tous les pays de l'afrique avec leur drapeau correctement et on
 * peut selectionner. IL NE FAUT PAS QUE CE SOIT COMME LES AUTRES MODALS mais
 * plutôt un modal dans la section qui cache tout le contenu de la section. »
 *
 * Chaque cas ci-dessous fige une PHRASE de cette demande, et deux d'entre eux
 * figent un défaut que le navigateur a démenti pendant la mise au point :
 *
 *   · `isVisible()` NE TESTE PAS LE RECOUVREMENT. Playwright appelle visible un
 *     champ parfaitement caché derrière un panneau opaque, parce qu'il ne regarde
 *     que la boîte et `visibility`. Un premier sondage concluait donc que le
 *     panneau ne cachait rien, alors qu'il cachait tout. Le recouvrement se
 *     mesure au SEUL endroit qui ne mente pas : `elementFromPoint` ;
 *   · le panneau ne doit RIEN DÉPLACER. Il est posé en `position: absolute` sur
 *     sa section ; une erreur de coque l'aurait mis dans le flux et aurait
 *     repoussé la ligne du pays. La boîte de cette ligne est donc comparée AU
 *     PIXEL avant et après.
 *
 * Les deux cadres sont couverts : la maquette dessine une CARTE blanche à
 * 1440 px et RIEN à 390 px, donc le panneau ne recouvre pas la même chose, et
 * c'est précisément ce qui pouvait casser d'un cadre à l'autre.
 */

/**
 * Le cadre visible, demandé au DOM — on ne déduit pas du projet Playwright, qui
 * décrit son projet mobile comme « Desktop Chrome » dans un viewport de 390 px.
 * Même raison, mêmes mots que `onboarding.spec.ts`.
 */
async function cadreVisible(page: Page): Promise<string> {
  const frame = await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>('[data-frame]')) {
      if (el.getBoundingClientRect().height > 0) return el.getAttribute('data-frame');
    }
    return null;
  });
  if (frame === null) throw new Error('aucun cadre visible');
  return `[data-frame="${frame}"]`;
}

/**
 * CE QUI EST RÉELLEMENT AU-DESSUS D'UN POINT.
 *
 * `elementFromPoint` rend l'élément que le navigateur a PEINT en dernier à cet
 * endroit, empilement compris. C'est la seule mesure qui distingue « caché » de
 * « présent mais recouvert ».
 */
async function recouvertParLePanneau(page: Page, cible: Locator): Promise<boolean> {
  const b = await cible.boundingBox();
  if (b === null) throw new Error('la cible n’a pas de boîte');
  return page.evaluate(
    ([x, y]) => {
      const el = document.elementFromPoint(x as number, y as number);
      return el?.closest('[data-panneau-section]') !== null && el !== null;
    },
    [b.x + b.width / 2, b.y + b.height / 2],
  );
}

/**
 * OUVRIR LE PANNEAU, ET ATTENDRE DEUX CHOSES QU'UN CLIC NE DONNE PAS.
 *
 * Ce harnais a été écrit APRÈS deux échecs, et chacun était le mien :
 *
 *   · LA LISTE VIENT DU SERVEUR. `GET /places/countries` part depuis le
 *     navigateur ; `page.goto` rend la main dès le `load`, donc le panneau
 *     pouvait s'ouvrir sur une liste encore vide. Trois cas mesuraient alors
 *     zéro pays et accusaient l'application. On attend donc une valeur que SEUL
 *     le serveur peut produire : une ligne de pays ;
 *   · LE PANNEAU GLISSE. `toHaveCount(1)` est satisfait dès que l'élément
 *     existe, c'est-à-dire pendant qu'il est encore à `translateX(100%)` — hors
 *     de sa section. Un test du recouvrement à cet instant regarde le champ que
 *     le panneau n'a pas encore atteint. On attend donc que la transformation
 *     soit RETOMBÉE À L'IDENTITÉ, ce qui est la seule fin de mouvement
 *     observable sans redire la durée.
 */
async function ouvrirLePanneau(page: Page, cadre: string): Promise<Locator> {
  /**
   * LE DÉCLENCHEUR DU PAYS, nommément. Cet écran en porte DEUX depuis que la
   * ville emploie le même panneau ; un repère générique en attrapait deux.
   */
  await page.locator(`${cadre} button[aria-label="Pays d’origine"]`).click();
  const panneau = page.locator(`${cadre} [data-panneau-section="pays"]`);
  await expect(panneau).toHaveCount(1);
  await expect(panneau.locator('button[aria-pressed]').first()).toBeVisible();
  await expect
    .poll(async () => panneau.evaluate((el) => getComputedStyle(el).transform))
    .toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
  return panneau;
}

test.describe('O02 — choix du pays d’origine', () => {
  test('la ligne du pays ouvre une boîte de dialogue, et non un menu natif', async ({
    page,
  }) => {
    await page.goto('/bienvenue/lieu');
    const cadre = await cadreVisible(page);

    /**
     * LE MENU NATIF A DISPARU, et c'est le cœur de la demande : un `<option>` ne
     * rend que du texte, donc aucun menu natif ne pouvait porter de drapeau.
     */
    await expect(page.locator(`${cadre} select`)).toHaveCount(0);

    /**
     * BORNÉ AU DÉCLENCHEUR DU PAYS : depuis que la ville emploie le même panneau
     * (« La sélection de ville : utilise le panneau aussi »), cet écran porte
     * DEUX `aria-haspopup="dialog"`. Un repère générique en attrapait deux et le
     * test échouait sur une ambiguïté, pas sur un défaut.
     */
    const bouton = page.locator(`${cadre} button[aria-label="Pays d’origine"]`);
    await expect(bouton).toHaveCount(1);
    await expect(page.locator(`${cadre} button[aria-haspopup="dialog"]`)).toHaveCount(2);
    await expect(bouton).toHaveAttribute('aria-expanded', 'false');

    await bouton.click();

    const panneau = page.locator(`${cadre} [data-panneau-section="pays"]`);
    await expect(panneau).toHaveCount(1);
    await expect(panneau).toHaveAttribute('role', 'dialog');
    await expect(panneau).toHaveAttribute('aria-modal', 'true');
    // Le nom vient de l'étiquette que la maquette dessine sur ce champ.
    await expect(panneau).toHaveAttribute('aria-label', 'D’où venez-vous ?');
    await expect(bouton).toHaveAttribute('aria-expanded', 'true');
  });

  test('le panneau recouvre le contenu de sa section', async ({ page }) => {
    await page.goto('/bienvenue/lieu');
    const cadre = await cadreVisible(page);
    const ville = page.locator(`${cadre}`).getByLabel('Votre ville');
    const ligne = page.locator(`${cadre} div:has(> button[aria-label="Pays d’origine"])`);

    // Avant : le champ de ville est au-dessus de lui-même, personne ne le cache.
    expect(await recouvertParLePanneau(page, ville)).toBe(false);

    await ouvrirLePanneau(page, cadre);

    /**
     * Après : LE PANNEAU est au point du champ de ville ET au point de la ligne
     * du pays. « un modal dans la section qui cache tout le contenu de la
     * section » — les deux contrôles de la section sont derrière.
     */
    expect(await recouvertParLePanneau(page, ville)).toBe(true);
    expect(await recouvertParLePanneau(page, ligne)).toBe(true);
  });

  test('chaque pays porte SON drapeau, et deux pays n’ont pas le même', async ({ page }) => {
    await page.goto('/bienvenue/lieu');
    const cadre = await cadreVisible(page);
    const panneau = await ouvrirLePanneau(page, cadre);

    const lignes = panneau.locator('button[aria-pressed]');
    const nombre = await lignes.count();
    /**
     * Le référentiel décide COMBIEN de pays sont proposés — 02 §2.1 réserve au
     * back-office l'activation d'un second pays d'origine. Le test ne fige donc
     * pas un nombre, il fige qu'il y en a, et que chacun a son drapeau.
     */
    expect(nombre).toBeGreaterThan(0);

    const drapeaux: string[] = [];
    for (let i = 0; i < nombre; i += 1) {
      const ligne = lignes.nth(i);
      const pastille = ligne.locator('span[aria-hidden="true"]').first();
      const glyphe = (await pastille.innerText()).trim();
      /**
       * Deux indicateurs régionaux, soit quatre unités UTF-16. Un système sans
       * glyphe de drapeau dessine les deux lettres du code, mais le TEXTE reste
       * celui-ci : c'est bien le contenu qu'on mesure, pas le rendu.
       */
      expect(glyphe.length).toBeGreaterThan(0);
      drapeaux.push(glyphe);

      // Le drapeau est muet : la ligne écrit déjà le nom du pays en clair.
      await expect(pastille).toHaveAttribute('aria-hidden', 'true');
      const nom = (await ligne.innerText()).replace(glyphe, '').trim();
      expect(nom.length).toBeGreaterThan(1);
    }
    expect(new Set(drapeaux).size).toBe(drapeaux.length);
  });

  test('choisir un pays referme le panneau, met la ligne à jour, et ne déplace rien', async ({
    page,
  }) => {
    await page.goto('/bienvenue/lieu');
    const cadre = await cadreVisible(page);
    const bouton = page.locator(`${cadre} button[aria-label="Pays d’origine"]`);
    const ligne = page.locator(`${cadre} div:has(> button[aria-label="Pays d’origine"])`);

    const avant = await ligne.boundingBox();
    const texteAvant = (await ligne.innerText()).replace(/\s+/g, ' ').trim();

    const panneau = await ouvrirLePanneau(page, cadre);

    // Le pays déjà retenu porte la coche : le panneau dit où l'on en est.
    await expect(panneau.locator('button[aria-pressed="true"]')).toHaveCount(1);

    // On prend un pays AUTRE que celui qui est retenu.
    const autre = panneau.locator('button[aria-pressed="false"]').first();
    test.skip(
      (await autre.count()) === 0,
      'le référentiel ne sert qu’un pays d’origine : il n’y a pas d’autre choix',
    );
    const vise = (await autre.innerText()).replace(/\s+/g, ' ').trim();

    await autre.click();
    await expect(panneau).toHaveCount(0);

    const texteApres = (await ligne.innerText()).replace(/\s+/g, ' ').trim();
    expect(texteApres).not.toBe(texteAvant);
    // Le nom du pays visé se retrouve dans la ligne, drapeau compris.
    expect(vise.replace(/\s+/g, '')).toContain(texteApres.replace(/\s+/g, ''));

    /**
     * RIEN N'A BOUGÉ. Le panneau est hors du flux ; s'il y était entré, la ligne
     * aurait été repoussée vers le bas et cette égalité tomberait.
     */
    expect(await ligne.boundingBox()).toEqual(avant);
  });

  test('Échap referme le panneau et rend le focus à la ligne', async ({ page }) => {
    await page.goto('/bienvenue/lieu');
    const cadre = await cadreVisible(page);
    const bouton = page.locator(`${cadre} button[aria-label="Pays d’origine"]`);

    const panneau = await ouvrirLePanneau(page, cadre);

    // Le focus ENTRE dans le panneau : sans ça, le clavier reste derrière lui.
    expect(
      await page.evaluate(() => document.activeElement?.closest('[data-panneau-section="pays"]') !== null),
    ).toBe(true);

    await page.keyboard.press('Escape');
    await expect(panneau).toHaveCount(0);

    /**
     * Le focus REVIENT d'où il venait. Sans ce retour il retombe sur `<body>`,
     * et un membre au clavier doit re-parcourir tout l'écran — c'est le défaut
     * que `modal.tsx` documente pour les huit autres fenêtres.
     */
    expect(await bouton.evaluate((el) => el === document.activeElement)).toBe(true);
  });

  test('le panneau n’est pas une fenêtre de page : ni voile, ni élément fixe', async ({
    page,
  }) => {
    await page.goto('/bienvenue/lieu');
    const cadre = await cadreVisible(page);
    const panneau = await ouvrirLePanneau(page, cadre);

    /**
     * « Il ne faut pas que ce soit comme les autres modals. » Les huit fenêtres
     * du dépôt portent `data-modal-overlay` et se posent en `position: fixed`.
     * Celle-ci ne doit faire ni l'un ni l'autre : elle appartient à sa section.
     */
    await expect(page.locator('[data-modal-overlay]')).toHaveCount(0);
    expect(await panneau.evaluate((el) => getComputedStyle(el).position)).toBe('absolute');

    // Et son parent positionné est DANS le cadre, pas le document.
    expect(
      await panneau.evaluate(
        (el) => (el as HTMLElement).offsetParent?.closest('[data-frame]') !== null,
      ),
    ).toBe(true);
  });
});

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ O02 — LA VILLE EMPLOIE LE MÊME PANNEAU QUE LE PAYS                        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « La sélection de ville : utilise le panneau aussi. »
 *
 * Deux manières de choisir un lieu sur le MÊME écran — un panneau glissant pour
 * le pays, une liste à plat pour la ville — était l'incohérence. La coque est
 * désormais partagée (`panneau-section.tsx`), extraite au troisième emploi :
 * trois copies auraient divergé au premier ajustement.
 */
test.describe('O02 — choix de la ville', () => {
  test('la ligne de ville ouvre le même panneau, recherche comprise', async ({ page }) => {
    await page.goto('/bienvenue/lieu');
    const cadre = await cadreVisible(page);

    /**
     * DEUX déclencheurs sur cet écran, et c'est le cœur de la demande : le pays
     * ET la ville ouvrent chacun un panneau. Avant, seul le pays en avait un.
     */
    const declencheurs = page.locator(`${cadre} button[aria-haspopup="dialog"]`);
    await expect(declencheurs).toHaveCount(2);

    const ligne = page.locator(`${cadre} div:has(> button[aria-label="Votre ville"])`);
    await expect(ligne).toContainText('Votre ville');

    await page.locator(`${cadre} button[aria-label="Votre ville"]`).click();
    const panneau = page.locator(`${cadre} [data-panneau-section="ville"]`);
    await expect(panneau).toHaveCount(1);
    await expect(panneau).toHaveAttribute('role', 'dialog');
    await expect(panneau).toHaveAttribute('aria-label', 'Où vivez-vous ?');

    /**
     * LE CHAMP DE RECHERCHE N'A PAS DISPARU : il est DANS le panneau, avec sa
     * boîte et sa loupe. C'est le même contrôle, déplacé.
     */
    const recherche = panneau.getByLabel('Votre ville');
    await expect(recherche).toHaveCount(1);

    /**
     * LE PANNEAU S'OUVRE PLEIN. Il rendait un tableau vide tant qu'on n'avait pas
     * tapé deux lettres — juste pour une liste qui s'ouvre sous un champ, faux
     * pour un panneau qu'on ouvre POUR choisir : il paraissait cassé.
     */
    const villes = panneau.locator('button[aria-pressed]');
    await expect(villes.first()).toBeVisible();
    const toutes = await villes.count();
    expect(toutes).toBeGreaterThan(1);

    // Le filtre resserre, sans accents ni casse — comme les étapes et les sujets.
    const premiere = (await villes.first().innerText()).split('\n')[0] ?? '';
    await recherche.fill(premiere.slice(0, 3).toLowerCase());
    await expect(villes).not.toHaveCount(0);
    expect(await villes.count()).toBeLessThanOrEqual(toutes);

    // Choisir referme et nomme la ligne : un seul geste, comme pour le pays.
    const nom = (await villes.first().innerText()).split('\n')[0] ?? '';
    await villes.first().click();
    await expect(panneau).toHaveCount(0);
    await expect(ligne).toContainText(nom);
  });

  test('le panneau de ville recouvre la section, comme celui du pays', async ({ page }) => {
    await page.goto('/bienvenue/lieu');
    const cadre = await cadreVisible(page);
    const pays = page.locator(`${cadre} div:has(> button[aria-label="Pays d’origine"])`);

    expect(await recouvertParLePanneau(page, pays)).toBe(false);
    await page.locator(`${cadre} button[aria-label="Votre ville"]`).click();

    /**
     * ON ATTEND LA FIN DU GLISSEMENT. `toHaveCount(1)` est satisfait dès que le
     * panneau EXISTE, c'est-à-dire pendant qu'il est encore à `translateX(100%)` —
     * hors de la section. Mesurer le recouvrement à cet instant regarde ce que le
     * panneau n'a pas encore atteint. C'est la même erreur que le cas du pays a
     * déjà payée, et la même garde : la transformation retombée à l'identité.
     */
    const panneau = page.locator(`${cadre} [data-panneau-section="ville"]`);
    await expect(panneau).toHaveCount(1);
    await expect
      .poll(async () => panneau.evaluate((el) => getComputedStyle(el).transform))
      .toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);

    // La ligne du PAYS, au-dessus, passe bien derrière : c'est toute la section.
    expect(await recouvertParLePanneau(page, pays)).toBe(true);
  });
});
