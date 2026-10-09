import { type Page, expect, test } from '@playwright/test';
import { connecter, type Membre } from './session';
import { monterEnL1 } from './niveau';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE COMPOSEUR DE STORY, ÉTAPES 2 ET 3 — CINQ DEMANDES DU PORTEUR            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Chaque cas fige UNE phrase, et chacune désignait un défaut mesuré :
 *
 *   1. « Le champ de recherche n'est pas bien affiché » — la maquette pose
 *      `color:#8A958F` sur le CONTENANT de la barre, parce qu'elle y dessine une
 *      invite. Le champ en héritait : ce qu'on tapait sortait dans le gris d'un
 *      champ vide. Mesuré `rgb(138, 149, 143)` ;
 *   2. « Je propose de sélectionner par défaut le premier parcours dans la
 *      liste » — l'étape 2 s'ouvrait sur « Aucun pour l'instant » et ZÉRO étape ;
 *   3. « Au niveau du sujet, Autre doit permettre de saisir dans un champ » —
 *      « Autre » se cochait et n'ouvrait rien ;
 *   4. « L'étape 3 doit afficher le sujet sélectionné et autres » — l'écran
 *      « Prêt à publier » récitait « Logement · Visale » et « Étape 7 » quoi
 *      qu'on ait choisi, c'est-à-dire mentait sur ce qui allait partir ;
 *   5. « un chevron down après le titre du bouton […] une deuxième fois ça
 *      affiche un modal de toutes les villes rangées par pays » — l'onglet
 *      disait « Lyon seulement » sans chevron et n'ouvrait rien.
 *
 * ── LE DERNIER CAS EST LE SEUL VERDICT STRICT ──────────────────────────────
 *
 * Les quatre premiers vérifient l'ÉCRAN ; le cinquième relit LA CHARGE. Un
 * contrôle qui bouge à l'écran sans changer ce qui part est le défaut que ce
 * dépôt a déjà payé, et c'est pourquoi `nouvelle-story.test.ts` compte les
 * champs : ici on vérifie que les DEUX champs neufs — `categoryOther` et
 * `cityId` — y arrivent avec les valeurs montrées.
 */

/** Un membre qui peut publier : L0 reçoit `403 LEVEL_REQUIRED` sur `POST /stories`. */
async function membreQuiPeutPublier(
  context: Parameters<typeof connecter>[0],
  request: Parameters<typeof connecter>[1],
): Promise<Membre> {
  const membre = await connecter(context, request, { displayName: 'Awa Konaté' });
  await monterEnL1(context, request, membre.accessToken);
  return membre;
}

/**
 * Le cadre visible. `ScreenFrames` rend les DEUX et en masque un ; viser le
 * document plutôt que le projet Playwright, qui décrit son projet mobile comme
 * « Desktop Chrome ».
 */
const cadre = (page: Page) => page.locator('[data-frame]').filter({ visible: true }).first();

/** « Suivant » / « Continuer » — le dernier bouton de la fenêtre sombre. */
const suivant = (page: Page) =>
  cadre(page).getByRole('button', { name: /Suivant|Continuer/ }).first();

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ L'ÉTAPE SE CHOISIT DANS UNE FENÊTRE, PLUS DANS UNE LISTE À PLAT            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Pour la section "MON PARCOURS" avec la section des étapes je
 * propose de faire comme la section qui le précède et mettre un chevron et
 * afficher un modal de sélection d'une étape. »
 *
 * Ces repères remplacent `button[aria-pressed]` filtré sur « Étape … », qui
 * désignait la liste posée à plat — quinze entrées, certaines à quatre lignes,
 * qui repoussaient les sujets hors de vue.
 */
const boutonEtape = (page: Page) =>
  cadre(page).getByRole('button', { name: /Sélectionner une étape/ });
const fenetreEtapes = (page: Page) => page.locator('[data-modal="A14E"]');
const lignesDEtape = (page: Page) => fenetreEtapes(page).locator('button[aria-pressed]');

/** Ouvre la fenêtre et attend que le SERVEUR ait rendu ses étapes. */
async function ouvrirLesEtapes(page: Page): Promise<void> {
  await boutonEtape(page).click();
  await expect(lignesDEtape(page).first()).toBeVisible({ timeout: 15_000 });
}

/** Retient la n-ième étape de la fenêtre et vérifie qu'elle se referme dessus. */
async function choisirEtape(page: Page, n: number): Promise<void> {
  await ouvrirLesEtapes(page);
  await lignesDEtape(page).nth(n).click();
  await expect(fenetreEtapes(page)).toHaveCount(0);
}

/**
 * Mène le composeur à l'étape 2, parcours chargé.
 *
 * On attend une valeur que SEUL le serveur peut produire — le NOM du parcours
 * retenu d'office, servi par `GET /journey-templates`. `page.goto` rend la main
 * au `load` ; mesurer avant que la liste arrive est le piège que ce dépôt a déjà
 * payé deux fois. Avant, on attendait une ligne « Étape … » de la liste à plat :
 * elle n'existe plus, et c'est elle qui faisait tomber sept cas de ce fichier.
 */
async function allerEtape2(page: Page): Promise<void> {
  await page.goto('/stories/nouvelle');
  await cadre(page).getByRole('textbox').first().fill('Un conseil mesuré au navigateur.');
  await suivant(page).click();
  const parcours = cadre(page).getByRole('button', { name: /Sélectionner un parcours/ });
  await expect(parcours).toBeVisible();
  await expect(parcours).not.toContainText('Aucun pour l’instant', { timeout: 15_000 });
  await expect(boutonEtape(page)).toBeVisible();
}

test.describe('A14 — étape 2', () => {
  test('ce qu’on tape dans la recherche s’écrit en encre, pas dans le gris de l’invite', async ({
    page,
    request,
  }) => {
    await membreQuiPeutPublier(page.context(), request);
    await allerEtape2(page);

    const champ = cadre(page).getByLabel('Rechercher une étape ou un sujet');
    await champ.fill('visa');

    /**
     * `#16211D`, l'encre de toute cette maquette. Le gris `#8A958F` —
     * `rgb(138, 149, 143)` — est ce qu'on mesurait, et il reste celui de
     * l'INVITE, posée par `[data-saisie-sur-gris]::placeholder`.
     */
    expect(await champ.evaluate((e) => getComputedStyle(e).color)).toBe('rgb(22, 33, 29)');
    await expect(champ).toHaveAttribute('data-saisie-sur-gris', '');

    // Et il filtre : le champ promet « une étape OU un sujet ».
    await champ.fill('transport');
    await expect(cadre(page).getByRole('button', { name: 'Transport', exact: true })).toBeVisible();
    await expect(
      cadre(page).getByRole('button', { name: 'Logement', exact: true }),
    ).toHaveCount(0);
  });

  /**
   * ── « UNE ÉTAPE OU UN SUJET » : LA SECONDE MOITIÉ DE LA PROMESSE ──────────
   *
   * La recherche de l'étape 2 filtre AUSSI les étapes, qui vivent désormais dans
   * leur fenêtre. Sans ce cas, le déplacement de la liste aurait pu couper le
   * champ de ce qu'il filtre sans que rien ne le signale.
   *
   * ON NE FIGE AUCUN LIBELLÉ : le mot cherché est EMPRUNTÉ à la première étape
   * du parcours retenu. Les étapes sont un référentiel que l'équipe peut
   * réécrire en back-office, et un cas qui cherche « Campus » tomberait le jour
   * où elle le fait — pour une raison illisible.
   */
  test('la recherche de l’étape 2 filtre aussi la fenêtre d’étapes', async ({ page, request }) => {
    await membreQuiPeutPublier(page.context(), request);
    await allerEtape2(page);

    await ouvrirLesEtapes(page);
    const toutes = await lignesDEtape(page).count();
    expect(toutes).toBeGreaterThan(1);
    const libelle = (await lignesDEtape(page).first().innerText()).trim();
    // Le mot le plus long du libellé : le plus discriminant, et jamais « de » ni « la ».
    const mot = [...libelle.matchAll(/[\p{L}]{5,}/gu)]
      .map((m) => m[0])
      .sort((a, b) => b.length - a.length)[0];
    expect(mot, `aucun mot utilisable dans « ${libelle} »`).toBeDefined();
    await fenetreEtapes(page).locator('[data-modal-close]').first().click();
    await expect(fenetreEtapes(page)).toHaveCount(0);

    await cadre(page).getByLabel('Rechercher une étape ou un sujet').fill(mot ?? '');
    await ouvrirLesEtapes(page);
    const restantes = await lignesDEtape(page).count();
    expect(restantes).toBeGreaterThan(0);
    expect(restantes, 'la fenêtre ignore la recherche de l’étape 2').toBeLessThan(toutes);
  });

  test('le premier parcours de la liste est retenu d’office, avec ses étapes', async ({
    page,
    request,
  }) => {
    await membreQuiPeutPublier(page.context(), request);
    await allerEtape2(page);

    /**
     * Le bouton porte le NOM du parcours retenu, pas « Aucun pour l'instant ».
     * On ne fige pas LEQUEL : le rang vient de `sortOrder`, une donnée de
     * référentiel que l'équipe peut changer en back-office.
     */
    const bouton = cadre(page).getByRole('button', { name: /Sélectionner un parcours/ });
    await expect(bouton).not.toContainText('Aucun pour l’instant');

    // Et ses étapes sont là : un parcours retenu sans étapes ne servirait à rien.
    await ouvrirLesEtapes(page);
    expect(await lignesDEtape(page).count()).toBeGreaterThan(0);
  });

  test('« Autre » ouvre un champ, et lui seul', async ({ page, request }) => {
    await membreQuiPeutPublier(page.context(), request);
    await allerEtape2(page);

    const champ = cadre(page).locator('[data-sujet-libre]');
    // Avant : aucun champ. Une pastille qui n'est pas « Autre » n'en ouvre pas.
    await expect(champ).toHaveCount(0);
    await cadre(page).getByRole('button', { name: 'Logement', exact: true }).click();
    await expect(champ).toHaveCount(0);

    await cadre(page).getByRole('button', { name: 'Autre', exact: true }).click();
    await expect(champ).toHaveCount(1);

    /**
     * 44 px de haut : la boîte de la barre de recherche du même panneau, dont ce
     * champ emprunte la forme. Une hauteur écrasée voudrait dire que le panneau
     * (une colonne flex) l'a comprimé — c'est le défaut classique de cette coque.
     */
    const boite = await champ.boundingBox();
    expect(boite?.height).toBe(44);

    await champ.fill('Carte de séjour');
    await expect(champ).toHaveValue('Carte de séjour');

    // Repasser sur un autre sujet referme le champ : son texte ne partirait pas.
    await cadre(page).getByRole('button', { name: 'Emploi', exact: true }).click();
    await expect(champ).toHaveCount(0);
  });
});

test.describe('A14 — étape 3', () => {
  /** Mène à l'étape 3 avec un sujet « Autre » précisé et une étape rattachée. */
  async function allerEtape3(page: Page): Promise<void> {
    await allerEtape2(page);
    await cadre(page).getByRole('button', { name: 'Autre', exact: true }).click();
    await cadre(page).locator('[data-sujet-libre]').fill('Carte de séjour');
    await choisirEtape(page, 1);
    await suivant(page).click();
    await expect(cadre(page).getByText('Prêt à publier')).toBeVisible();
  }

  test('le récapitulatif dit le sujet et l’étape RETENUS, pas ceux de la planche', async ({
    page,
    request,
  }) => {
    await membreQuiPeutPublier(page.context(), request);
    await allerEtape3(page);

    const texte = await cadre(page).innerText();
    expect(texte).toContain('Autre · Carte de séjour');
    expect(texte).toMatch(/Étape \d+ de mon parcours/);

    // Les deux littéraux de la maquette ont DISPARU : c'est ce qui se récitait.
    expect(texte).not.toContain('Logement · Visale');
    expect(texte).not.toContain('Étape 7 de mon parcours');
  });

  test('l’onglet de ville porte un chevron ; un appui le retient, le suivant ouvre la fenêtre', async ({
    page,
    request,
  }) => {
    await membreQuiPeutPublier(page.context(), request);
    await allerEtape3(page);

    const onglet = cadre(page).locator('button[aria-pressed]').filter({ hasText: /seulement/ });
    await expect(onglet).toHaveCount(1);
    // Le chevron, demandé « par défaut » — donc avant tout appui.
    await expect(onglet.locator('svg')).toHaveCount(1);
    await expect(onglet).toHaveAttribute('aria-pressed', 'false');

    /**
     * La hauteur dessinée est 42 px. Le chevron a demandé `display: flex` sur ce
     * bouton ; s'il avait changé sa boîte, le dessin aurait bougé — et la règle
     * du porteur est qu'une correction qui déplace le design est refusée.
     */
    expect((await onglet.boundingBox())?.height).toBe(42);

    // PREMIER appui : il retient l'onglet, et n'ouvre rien.
    await onglet.click();
    await expect(onglet).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-modal-panel]')).toHaveCount(0);

    // SECOND appui, l'onglet étant déjà retenu : la fenêtre s'ouvre.
    await onglet.click();
    await expect(page.locator('[data-modal-panel]')).toHaveCount(1);
  });

  test('la fenêtre de ville : recherche, bouton de pays, panneau glissant, choix', async ({
    page,
    request,
  }) => {
    await membreQuiPeutPublier(page.context(), request);
    await allerEtape3(page);

    const onglet = cadre(page).locator('button[aria-pressed]').filter({ hasText: /seulement/ });
    /**
     * « Par défaut c'est la première ville du pays d'origine » : l'onglet porte
     * donc un NOM DE VILLE, et plus le « Lyon » de la planche — le membre du
     * harnais vient du Bénin.
     */
    await expect(onglet).not.toContainText('Lyon seulement');

    await onglet.click();
    await onglet.click();
    const fenetre = page.locator('[data-modal-panel]');
    await expect(fenetre).toHaveCount(1);

    // Les deux contrôles du haut, demandés côte à côte.
    const recherche = fenetre.getByLabel('Rechercher une ville');
    const boutonPays = fenetre.locator('[data-bouton-pays]');
    await expect(recherche).toHaveCount(1);
    await expect(boutonPays).toHaveCount(1);
    /**
     * ╔════════════════════════════════════════════════════════════════════════╗
     * ║ LES DEUX BOÎTES SE LISENT DANS LA MÊME IMAGE — SINON ON MESURE LE VOL  ║
     * ╚════════════════════════════════════════════════════════════════════════╝
     *
     * Deux erreurs successives, et toutes deux de MESURE, pas de code :
     *
     *   · comparer les `y` — `recherche` désigne L'INPUT, centré dans sa pilule
     *     de 44 px, tandis que `boutonPays` EST une pilule. D'où 11,9 px d'écart
     *     sur un alignement pourtant juste. C'est le CENTRE vertical qu'il faut
     *     comparer entre un contenu et un conteneur ;
     *   · deux `boundingBox()` successifs — chacun est un aller-retour, et la
     *     feuille est encore en train de MONTER (`dp-modal-in`). Les deux lectures
     *     tombaient à deux instants différents du même vol : 33,7 px une fois,
     *     56,8 px la suivante. Un écart qui change à chaque exécution ne décrit
     *     pas un défaut, il décrit une mesure prise trop tôt.
     *
     * Les deux rectangles sont donc lus par UN SEUL `evaluate`, dans la même
     * image : quoi que la feuille soit en train de faire, les deux subissent le
     * même déplacement et leur écart reste celui du dessin. Mesuré à l'arrêt :
     * y=228 / h=44 pour les deux sur ordinateur, y=258,8 / h=44 sur téléphone.
     */
    const ecart = await page.evaluate(() => {
      /**
       * ── `data-saisie-sur-gris` ET NON `type="search"` ────────────────────
       *
       * Cette sonde désignait le champ par `input[type="search"]`. Le type a
       * changé pour `text`, et pour une raison de produit : sur `type="search"`,
       * le navigateur dessine SON bouton d'effacement, qui n'est pas dans la
       * maquette et que le porteur a pris pour une icône posée par nous — « c'est
       * pas beau, c'est un emoji ». La sonde rendait donc `null`, et le cas
       * échouait sur « expect(ecart).not.toBeNull() », qui ne nomme pas la cause.
       *
       * `data-saisie-sur-gris` est le repère que le générateur pose sur CHAQUE
       * champ de saisie assis sur une pilule grise — c'est ce que ce cas mesure,
       * et c'est stable par rapport au `type`.
       */
      const champ = document.querySelector('[data-modal-panel] input[data-saisie-sur-gris]');
      const bouton = document.querySelector('[data-modal-panel] [data-bouton-pays]');
      if (champ === null || bouton === null) return null;
      const a = champ.getBoundingClientRect();
      const b = bouton.getBoundingClientRect();
      return {
        centres: Math.abs(a.y + a.height / 2 - (b.y + b.height / 2)),
        aDroite: b.x >= a.x + a.width,
      };
    });
    expect(ecart).not.toBeNull();
    expect(ecart?.centres).toBeLessThan(2);
    // Et le bouton est bien à DROITE du champ, pas au-dessous.
    expect(ecart?.aDroite).toBe(true);

    // La liste des villes du pays d'origine est déjà là.
    const villes = fenetre.locator('button[aria-pressed]');
    await expect(villes.first()).toBeVisible();
    const avant = await villes.count();
    expect(avant).toBeGreaterThan(0);
    await expect(fenetre.locator('button[aria-pressed="true"]')).toHaveCount(1);

    // LE FILTRE, qui ignore accents et casse.
    const premiere = (await villes.first().innerText()).split('\n')[0] ?? '';
    await recherche.fill(premiere.slice(0, 3).toLowerCase());
    await expect(villes).not.toHaveCount(0);
    expect(await villes.count()).toBeLessThanOrEqual(avant);
    await recherche.fill('');

    /**
     * LE PANNEAU DES PAYS EST CELUI DE O02, et il recouvre LA FENÊTRE — pas la
     * page. C'est le « slide left » demandé, et il est borné à sa boîte : un
     * panneau calé sur la page serait une seconde fenêtre par-dessus la première.
     */
    await boutonPays.click();
    const panneau = fenetre.locator('[data-panneau-section="pays"]');
    await expect(panneau).toHaveCount(1);
    await expect(panneau).toHaveAttribute('role', 'dialog');
    const bFen = await fenetre.boundingBox();
    const bPan = await panneau.boundingBox();
    expect(Math.abs((bPan?.width ?? 0) - (bFen?.width ?? 0))).toBeLessThan(2);
    expect(Math.abs((bPan?.height ?? 0) - (bFen?.height ?? 0))).toBeLessThan(2);

    // Changer de pays change la liste de villes.
    const autrePays = panneau.locator('button[aria-pressed="false"]').first();
    test.skip(
      (await autrePays.count()) === 0,
      'le référentiel ne sert qu’un pays : il n’y a pas d’autre choix',
    );
    await autrePays.click();
    await expect(panneau).toHaveCount(0);
    await expect(villes.first()).toBeVisible();

    // Choisir une ville referme la fenêtre ET nomme l'onglet.
    const nom = (await villes.first().innerText()).split('\n')[0] ?? '';
    await villes.first().click();
    await expect(fenetre).toHaveCount(0);
    await expect(onglet).toContainText(`${nom} seulement`);
    await expect(onglet).toHaveAttribute('aria-pressed', 'true');
  });

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ CE QUE L'ÉCRAN MONTRE EST CE QUI PART — LA CHARGE EST RELUE              ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   */
  test('la charge de POST /stories emporte le sujet écrit à la main et la ville choisie', async ({
    page,
    request,
  }) => {
    await membreQuiPeutPublier(page.context(), request);

    const charges: Record<string, unknown>[] = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().includes('/stories')) {
        charges.push(r.postDataJSON() as Record<string, unknown>);
      }
    });

    await allerEtape3(page);

    const onglet = cadre(page).locator('button[aria-pressed]').filter({ hasText: /seulement/ });
    await onglet.click();
    await onglet.click();
    const fenetre = page.locator('[data-modal-panel]');
    const villes = fenetre.locator('button[aria-pressed]');
    await expect(villes.first()).toBeVisible();
    const choisie = (await villes.nth(1).innerText()).split('\n')[0] ?? '';
    await villes.nth(1).click();
    await expect(fenetre).toHaveCount(0);
    await expect(onglet).toContainText(`${choisie} seulement`);

    /**
     * `exact: true` : l'indicateur d'étape du haut s'appelle « 3 · Publier », et
     * un nom par sous-chaîne l'attrapait AVANT le vrai bouton. Le test passait
     * alors en ne publiant rien — un vert qui ne mesure rien est pire qu'un
     * rouge, et celui-ci a bien failli être lu comme un défaut de l'application.
     */
    await cadre(page).getByRole('button', { name: 'Publier', exact: true }).last().click();

    // La publication ramène à l'accueil : c'est elle qui prouve le 201.
    await expect(page).toHaveURL(/\/accueil/);

    expect(charges).toHaveLength(1);
    const charge = charges[0] ?? {};
    expect(charge['category']).toBe('AUTRE');
    expect(charge['categoryOther']).toBe('Carte de séjour');
    expect(charge['audience']).toBe('CITY');
    // La ville choisie part : c'est un UUID, et il n'était pas envoyé du tout avant.
    expect(charge['cityId']).toMatch(/^[0-9a-f-]{36}$/);
    expect(charge['stepDefinitionId']).toMatch(/^[0-9a-f-]{36}$/);
  });
});
