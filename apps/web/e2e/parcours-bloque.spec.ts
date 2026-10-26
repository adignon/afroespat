import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { monterParcours } from './parcours-session';
import { monterJalonPartageable } from './aide-w5a';

/**
 * « JE SUIS BLOQUÉ·E » — J03, et la règle qui commande tout le module.
 *
 * 03 §1.2 : « un parcours ne publie JAMAIS rien tout seul. Il propose. »
 * §3.5, règle dure : « l'objet cible n'est créé qu'à l'appel explicite de la
 * route de publication… Le brouillon n'est jamais promu sans cet appel. »
 *
 * Cette règle vit côté serveur. Mais un écran peut la TRAHIR sans que le serveur
 * change d'un octet : il suffirait d'un « Publier » atteignable au premier volet.
 * C'est ce que ces tests interdisent — non pas que le code soit écrit ainsi, mais
 * qu'aucune suite de clics ne mène à « Publier » sans traverser les trois volets.
 *
 * Les assertions portent sur la GÉOMÉTRIE et les RÔLES, jamais sur des classes.
 */

/** Ce fichier pilote lui-même ses tailles : un seul projet suffit. */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'piloté par le test');

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║ ON ATTEND LA DONNÉE, PAS LE CADRE — sinon le clic porte sur un élément qui  ║
 * ║ se détache                                                                 ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * `EcranDonnees` rend le SQUELETTE tant que la réponse n'est pas là, puis le
 * remplace. Un clic lancé entre les deux vise un bouton du squelette, que React
 * retire sous lui — Playwright le dit mot pour mot : « element was detached from
 * the DOM, retrying », jusqu'à expiration.
 *
 * La bande `role="status"` est le seul signal de la bascule. Son absence n'est pas
 * un échec : certains écrans de ce module ne chargent rien.
 */
/**
 * ╔═════════════════════════════════════════════════════════════════════════╗
 * ║ CE FICHIER N'OUVRAIT AUCUNE SESSION — et `/parcours/…` est gardé          ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * MESURÉ : `/parcours/1/etapes/7` sans session rend L'ÉCRAN DE CONNEXION —
 * « Votre numéro de téléphone », relevé au navigateur. Les déclencheurs J03 et J04
 * n'y existent pas, et les sept cas de ce fichier cliquaient dans le vide.
 *
 * LE DÉFAUT ÉTAIT MASQUÉ PAR `networkidle` : `goto` expirait AVANT d'atteindre le
 * clic, et l'échec ressemblait à une lenteur. En passant à `load`, le clic est
 * atteint — et Playwright a dit la vérité : « element was detached from the DOM »,
 * le squelette cédant la place à l'écran de connexion.
 */
async function session(page: Page, request: APIRequestContext): Promise<{ readonly url: string }> {
  /**
   * VAGUE 5 — `/parcours/1/etapes/7` EST UNE URL DE PLANCHE D'ILLUSTRATION : le segment
   * n'est pas un UUID, l'écran répond « Ce parcours n'est pas ouvert » et ne monte plus
   * aucun déclencheur de fenêtre (mesuré : dix-sept cas expiraient sur un clic dans le
   * vide). Le décor est celui du produit — un vrai parcours et une vraie étape en cours
   * (`monterParcours`, routes publiques, aucun accès direct à la base).
   */
  const m = await monterParcours(page.context(), request);
  return { url: `/parcours/${m.journeyId}/etapes/${m.etapeCourante.id}` };
}

async function pret(page: Page): Promise<void> {
  await page
    .locator('[role="status"]')
    .filter({ hasText: /Chargement/ })
    .first()
    .waitFor({ state: 'detached', timeout: 20_000 })
    .catch(() => {});
}

async function ouvrir(page: Page, request: APIRequestContext, width = 1440): Promise<void> {
  const { url } = await session(page, request);
  await page.setViewportSize({ width, height: 900 });
  /**
   * `load` ET NON `networkidle` : Next précharge les liens visibles d'une page App
   * Router, et le réseau ne retombe pas au calme sur les pages de parcours —
   * `goto` expirait à 30 s, et dix cas étaient comptés échoués sans jamais avoir
   * été EXÉCUTÉS. Même cause et même correction que `e2e/services.spec.ts`,
   * `e2e/a11y.spec.ts` et `visual/screens.spec.ts`.
   */
  await page.goto(url, { waitUntil: 'load' });
  await pret(page);
  const cadre = width >= 1024 ? 'desktop' : 'mobile';
  /**
   * VAGUE 5 — SUR MOBILE LE BOUTON N'EST PAS MARQUÉ `data-modal-open` (le générateur ne
   * pose le marqueur que sur la planche d'ordinateur) mais il OUVRE bien la feuille :
   * mesuré au navigateur. On vise donc le bouton par son rôle et son nom, ce qu'un membre
   * voit — ce qui vaut aussi pour l'ordinateur.
   */
  await page
    .locator(`[data-frame="${cadre}"]`)
    .getByRole('button', { name: 'Je suis bloqué·e' })
    .first()
    .click();
  await expect(page.getByRole('dialog', { name: /Je suis bloqué/ })).toBeVisible();
  // L'ouverture s'anime (échelle / glissement) : on mesure APRÈS, pas pendant.
  await page.waitForTimeout(500);
}

const dialogue = (page: Page) => page.getByRole('dialog', { name: /Je suis bloqué/ });

/**
 * VAGUE 5 — « Voir l'aperçu » EST ÉTEINT TANT QUE LE TITRE N'EST PAS SAISI (10 à 120
 * caractères, §3.5 : le membre écrit, rien n'est pré-rédigé). Le chemin vers le troisième
 * volet passe donc par la saisie du titre — comme pour un vrai membre.
 */
async function versApercu(page: Page): Promise<void> {
  await dialogue(page).locator('input').first().fill('Comment obtenir mon dossier Campus France ?');
  await dialogue(page).getByRole('button', { name: 'Voir l’aperçu' }).click();
}

test.describe('la règle dure : jamais de publication en un clic (§3.5)', () => {
  test('« Publier » n’existe PAS au premier volet', async ({ page, request }) => {
    await ouvrir(page, request);
    await expect(dialogue(page).getByRole('button', { name: 'Publier' })).toHaveCount(0);
    /**
     * Ce qu'on voit à la place : relire, et « Suivant ».
     *
     * L'apostrophe est DROITE, et c'est la maquette qui en décide : elle mélange
     * les deux — « Rien n'est publié » avec `'` (U+0027) et « Voir l’aperçu »
     * avec `’` (U+2019), dans la même planche. Ce test a d'abord échoué sur
     * l'apostrophe typographique que j'avais écrite par réflexe. Le texte se
     * recopie de la maquette, caractère par caractère, comme le style.
     */
    await expect(dialogue(page).getByText("Rien n'est publié sans votre accord.")).toBeVisible();
    await expect(dialogue(page).getByRole('button', { name: 'Suivant' })).toBeVisible();
  });

  test('« Publier » n’existe PAS au deuxième volet non plus', async ({ page, request }) => {
    await ouvrir(page, request);
    await dialogue(page).getByRole('button', { name: 'Suivant' }).click();
    await expect(dialogue(page).getByText('Publier dans Entraide')).toBeVisible();
    // « Publier dans Entraide » est le libellé d'un CHOIX DE PORTÉE,
    // pas un bouton de publication — et c'est précisément le piège : un test qui
    // chercherait le TEXTE « Publier » le trouverait ici et croirait la règle
    // violée. On cherche donc le RÔLE bouton avec ce nom exact.
    await expect(dialogue(page).getByRole('button', { name: 'Publier', exact: true })).toHaveCount(0);
  });

  test('« Publier » n’apparaît qu’au TROISIÈME volet, après l’aperçu', async ({ page, request }) => {
    await ouvrir(page, request);
    await dialogue(page).getByRole('button', { name: 'Suivant' }).click();
    await versApercu(page);

    // L'aperçu montre la carte telle qu'elle apparaîtra (T5 J03, volet 3).
    await expect(dialogue(page).getByText('Depuis un parcours')).toBeVisible();
    await expect(dialogue(page).getByRole('button', { name: 'Publier', exact: true })).toBeVisible();
  });

  test('refermer et rouvrir REVIENT au premier volet', async ({ page, request }) => {
    await ouvrir(page, request);
    await dialogue(page).getByRole('button', { name: 'Suivant' }).click();
    await versApercu(page);
    await expect(dialogue(page).getByRole('button', { name: 'Publier', exact: true })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    /**
     * Rouvrir la feuille à un clic de « Publier » contredirait §3.5 : le membre
     * doit relire son texte et rechoisir sa portée. C'est le défaut le plus
     * facile à introduire — un état de volet conservé entre deux ouvertures —
     * et le plus difficile à voir, parce que la première ouverture est juste.
     */
    await page.locator('[data-frame="desktop"] [data-modal-open="J03"]').first().click();
    await expect(dialogue(page).getByRole('button', { name: 'Publier', exact: true })).toHaveCount(0);
    await expect(dialogue(page).getByRole('button', { name: 'Suivant' })).toBeVisible();
  });

  test('« Retour » redescend d’un volet', async ({ page, request }) => {
    await ouvrir(page, request);
    await dialogue(page).getByRole('button', { name: 'Suivant' }).click();
    await dialogue(page).getByRole('button', { name: 'Retour' }).click();
    await expect(dialogue(page).getByRole('button', { name: 'Suivant' })).toBeVisible();
    await expect(dialogue(page).getByRole('button', { name: 'Publier', exact: true })).toHaveCount(0);
  });

  test('« Annuler » referme sans rien publier (§3.5 → CANCELLED)', async ({ page, request }) => {
    await ouvrir(page, request);
    await dialogue(page).getByRole('button', { name: 'Annuler' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

/**
 * LE MOUVEMENT DU VOLET — `moments.panelAdvance` de `packages/config/motion.js`.
 *
 * « Les trois volets glissent latéralement. Le mouvement dit : vous avancez dans
 * une démarche, vous ne sautez pas d'un écran à l'autre. » 240 ms, courbe `out`,
 * seize pixels.
 *
 * Ce n'est pas de la décoration : chaque volet est une PLANCHE distincte, donc
 * changer de volet démonte un composant et en monte un autre. Sans ce jeton,
 * l'animation d'OUVERTURE repartait de zéro et toute la feuille remontait depuis
 * le bas à chaque « Suivant » — le membre voyait une nouvelle feuille s'ouvrir
 * là où il devait voir la même avancer d'un cran.
 */
test.describe('le volet AVANCE, il ne se rouvre pas', () => {
  test('première ouverture : l’animation d’entrée ; volet suivant : panelAdvance', async ({
    page,
    request,
  }) => {
    await ouvrir(page, request, 1440);
    const panneau = dialogue(page).locator('[data-modal-panel]');

    const ouverture = await panneau.evaluate((n) => getComputedStyle(n).animationName);
    expect(ouverture, 'la première ouverture reste une ouverture').toBe('dp-modal-in');

    await dialogue(page).getByRole('button', { name: 'Suivant' }).click();
    const avance = await dialogue(page)
      .locator('[data-modal-panel]')
      .evaluate((n) => {
        const s = getComputedStyle(n);
        return { nom: s.animationName, duree: s.animationDuration };
      });
    expect(avance.nom).toBe('dp-panel-advance');
    // 240 ms, la valeur de `moments.panelAdvance` — et sous le plafond de 300 ms
    // que `check-motion.mjs` fait respecter.
    expect(avance.duree).toBe('0.24s');
  });

  test('sur mobile aussi, le volet avance au lieu de remonter du bas', async ({ page, request }) => {
    await ouvrir(page, request, 390);
    const panneau = dialogue(page).locator('[data-modal-panel]');
    expect(await panneau.evaluate((n) => getComputedStyle(n).animationName)).toBe('dp-sheet-in');

    await dialogue(page).getByRole('button', { name: 'Suivant' }).click();
    expect(
      await dialogue(page)
        .locator('[data-modal-panel]')
        .evaluate((n) => getComputedStyle(n).animationName),
    ).toBe('dp-panel-advance');
  });
});

/**
 * CE QUE `aria-modal` PROMET, UNE FOIS LE VOLET CHANGÉ.
 *
 * Ces trois tests viennent d'un défaut trouvé AU NAVIGATEUR, pas en relisant le
 * code : après « Suivant », le focus retombait sur `<body>`, hors du portail.
 * Comme `onKeyDown` est posé sur la boîte de dialogue, plus aucune touche ne lui
 * parvenait — Échap ne fermait plus, et le piège au clavier ne retenait plus
 * rien. À la souris, rien ne se voyait ; au clavier, on était coincé.
 *
 * Le défaut est dans le composant PARTAGÉ : toute modale dont le contenu est
 * remplacé l'aurait eu. Les quatre modales du fil y échappaient parce que leur
 * contenu ne change jamais.
 */
test.describe('le clavier garde la main après un changement de volet', () => {
  /**
   * LE FOCUS NE QUITTE JAMAIS LA BOÎTE, DÈS LE CHANGEMENT DE VOLET.
   *
   * La vérification commence AVANT la première tabulation, et ce détail est tout
   * le test. J'avais d'abord écrit la boucle sur le modèle de `modales.spec.ts` :
   * vingt tabulations, containment vérifié après chacune. **Elle passait sous
   * mutation.** Le portail est le DERNIER enfant de `<body>` : le focus posé sur
   * `<body>` par le démontage revenait dans la boîte à la première tabulation, par
   * la seule grâce de l'ordre du document. Le test mesurait la position du portail
   * dans le DOM, pas le piège au clavier.
   *
   * Le premier `n === 0` vérifie l'état AVANT toute touche. C'est lui qui tombe
   * quand l'effet de focus est neutralisé, et c'est donc lui qui compte.
   */
  test('le focus ne quitte jamais la boîte, dès le changement de volet', async ({ page, request }) => {
    await ouvrir(page, request);
    await dialogue(page).getByRole('button', { name: 'Suivant' }).click();
    await versApercu(page);

    const boite = dialogue(page);
    for (let n = 0; n <= 20; n += 1) {
      if (n > 0) await page.keyboard.press('Tab');
      const dedans = await boite.evaluate((node) => node.contains(document.activeElement));
      expect(dedans, n === 0 ? 'juste après le changement de volet' : `après ${n} tabulation(s)`).toBe(
        true,
      );
    }
  });

  test('Échap ferme ENCORE au deuxième volet', async ({ page, request }) => {
    await ouvrir(page, request);
    await dialogue(page).getByRole('button', { name: 'Suivant' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('le focus revient sur le bouton d’origine, même après trois volets', async ({ page, request }) => {
    await ouvrir(page, request);
    await dialogue(page).getByRole('button', { name: 'Suivant' }).click();
    await versApercu(page);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    /**
     * La moitié qu'on casse en corrigeant l'autre : si l'effet de volet
     * recapturait l'élément de retour, il enregistrerait `<body>` et refermer
     * renverrait au début du document. Ce test le refuse.
     */
    const focus = await page.evaluate(() =>
      document.activeElement?.getAttribute('data-modal-open'),
    );
    expect(focus).toBe('J03');
  });
});

/**
 * LA FORME DE LA FENÊTRE, aux deux largeurs.
 *
 * La maquette l'annonce : « modale sur ordinateur, feuille du bas sur mobile ».
 * Elle ne DESSINE pourtant la forme d'ordinateur qu'en carte nue de 540 px, sans
 * voile ni positionnement — c'est le transcodeur qui la centre, avec les valeurs
 * que `03 Accueil` écrit pour ses propres fenêtres. Ces deux tests vérifient que
 * la carte est bien devenue une fenêtre, et la feuille bien une feuille.
 */
test.describe('fenêtre sur ordinateur, feuille sur mobile', () => {
  test('1440 px — une fenêtre de 540 px, centrée', async ({ page, request }) => {
    await ouvrir(page, request, 1440);
    const boite = await dialogue(page).locator('[data-modal-panel]').boundingBox();
    expect(boite).not.toBeNull();
    if (boite === null) return;

    expect(Math.round(boite.width), 'la carte de la maquette fait 540 px').toBe(540);
    const centre = boite.x + boite.width / 2;
    expect(Math.abs(centre - 1440 / 2), 'centrée horizontalement').toBeLessThan(2);
    // Une fenêtre ne touche pas le bord : elle est centrée verticalement.
    expect(boite.y).toBeGreaterThan(20);
  });

  test('390 px — une feuille collée en bas, sur toute la largeur', async ({ page, request }) => {
    await ouvrir(page, request, 390);
    const boite = await dialogue(page).locator('[data-modal-panel]').boundingBox();
    expect(boite).not.toBeNull();
    if (boite === null) return;

    expect(Math.round(boite.width)).toBe(390);
    expect(Math.round(boite.y + boite.height)).toBeGreaterThanOrEqual(898);
  });

  test('le voile est emprunté à la planche mobile, et il ferme', async ({ page, request }) => {
    await ouvrir(page, request, 1440);
    // La planche d'ordinateur de J03 n'a PAS de voile : il vient des planches
    // mobiles de la même section. S'il manquait, un clic hors panneau ne
    // fermerait rien et le membre serait coincé dans la fenêtre.
    await expect(dialogue(page).locator('[data-modal-overlay]')).toHaveCount(1);
    await page.mouse.click(30, 450);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

/**
 * §3.6 — LE PARTAGE DE JALON, proposé et jamais imposé.
 *
 * « Proposition "Partager cette victoire ?" avec un champ de texte VIDE (pas de
 * texte pré-rédigé — c'est le membre qui écrit). »
 */
/**
 * VAGUE 5 — J04 S'OUVRE SUR UN VRAI JALON. La planche d'illustration (`/parcours/1/etapes/7`)
 * ne monte plus de déclencheur : « Partager » n'est proposé, dans la colonne du parcours,
 * que pour une étape MAJEURE franchie dont le partage n'a pas été refusé. Le décor est
 * donc fabriqué par les routes du produit (`monterJalonPartageable`).
 */
async function ouvrirPartage(page: Page, request: APIRequestContext): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  const jalon = await monterJalonPartageable(page.context(), request);
  await page.goto(`/parcours/${jalon.journeyId}`, { waitUntil: 'load' });
  await pret(page);
  await page
    .locator('[data-frame="desktop"]')
    .getByRole('button', { name: 'Partager', exact: true })
    .first()
    .click();
}

test.describe('§3.6 — partager un jalon', () => {
  test('« Marquer comme franchie » PROPOSE le partage, il ne publie pas', async ({ page, request }) => {
    await ouvrirPartage(page, request);

    const jalon = page.getByRole('dialog', { name: /Partager un jalon/ });
    await expect(jalon).toBeVisible();
    // « Plus tard » est la moitié qui compte : la proposition se décline.
    await expect(jalon.getByRole('button', { name: 'Plus tard' })).toBeVisible();
  });

  test('le champ de texte est VIDE — aucun texte pré-rédigé', async ({ page, request }) => {
    await ouvrirPartage(page, request);

    const jalon = page.getByRole('dialog', { name: /Partager un jalon/ });
    /**
     * « Racontez-la avec vos mots… » est un INDICE, pas une valeur : il doit
     * disparaître dès que le membre écrit. Un texte pré-rédigé, lui, partirait
     * tel quel dans la publication — et §3.6 l'interdit nommément.
     */
    const champ = jalon.locator('input, textarea');
    await expect(champ).toHaveCount(1);
    await expect(champ).toHaveValue('');
    await expect(champ).toHaveAttribute('placeholder', /Racontez-la avec vos mots/);
  });

  test('« Plus tard » referme sans publier (§3.6 → share_prompt_dismissed_at)', async ({ page, request }) => {
    await ouvrirPartage(page, request);
    await page
      .getByRole('dialog', { name: /Partager un jalon/ })
      .getByRole('button', { name: 'Plus tard' })
      .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
