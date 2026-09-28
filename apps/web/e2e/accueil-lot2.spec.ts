import { expect, test, type Page } from '@playwright/test';

/**
 * Les dix-sept écrans du lot 2 — A02 à A14 de `docs/template/03 Accueil v2.dc.html`.
 *
 * Les assertions portent sur la GÉOMÉTRIE, les RÔLES et le TEXTE VISIBLE de la
 * maquette, jamais sur des classes : le balisage est transcodé en styles en ligne,
 * et viser une classe se casserait à la première régénération.
 *
 * Chaque bloc dit la PROPRIÉTÉ qu'il tient, pas l'implémentation qu'il observe.
 */

/**
 * Les routes du lot, avec le titre que la MAQUETTE écrit sur chaque cadre.
 *
 * `h1` à `null` n'est pas un oubli du test : c'est un manque de la maquette, que le
 * générateur signale à chaque exécution (« aucun <h2> à promouvoir en <h1> »). A02,
 * A13 et la première étape de A14 ne dessinent aucun titre, et en inventer un serait
 * la faute que l'en-tête de `tools/dc-to-jsx.mjs` raconte. Le test constate l'état
 * réel plutôt que de le maquiller — et si un titre APPARAÎT un jour dans la
 * maquette, il tombera, ce qui est exactement ce qu'on veut savoir.
 */
const ROUTES = [
  { path: '/guides', screen: 'A03', h1: 'Guides et Démarches', h1Mobile: 'Guides et Démarches' },
  {
    path: '/guides/visale-sans-cdi',
    screen: 'A04',
    h1: 'Obtenir la garantie Visale sans CDI',
    h1Mobile: 'Obtenir la garantie Visale sans CDI',
  },
  {
    path: '/guides/visale-sans-cdi?vue=auteur',
    screen: 'A04-auteur',
    h1: 'Obtenir la garantie Visale sans CDI',
    h1Mobile: 'Obtenir la garantie Visale sans CDI',
  },
  // Le cadre mobile de l'éditeur met le nom du BROUILLON là où l'ordinateur écrit
  // « Nouveau guide ». Deux titres différents, comme la maquette les dessine.
  {
    path: '/guides/nouveau',
    screen: 'A05',
    h1: 'Nouveau guide',
    h1Mobile: 'Mon arrivée étudiante à Lyon',
  },
  {
    path: '/guides/visale-sans-cdi/propositions',
    screen: 'A06',
    h1: 'Propositions reçues',
    h1Mobile: 'Propositions reçues',
  },
  {
    path: '/guides/visale-sans-cdi/corriger',
    screen: 'A06-corriger',
    h1: 'Obtenir la garantie Visale sans CDI',
    h1Mobile: 'Obtenir la garantie Visale sans CDI',
  },
  { path: '/reseaux', screen: 'A07', h1: 'Réseaux', h1Mobile: 'Réseaux' },
  {
    path: '/reseaux/beninois-en-france',
    screen: 'A08',
    h1: 'Béninois en France',
    h1Mobile: 'Béninois en France',
  },
  {
    path: '/reseaux/beninois-en-france?onglet=fil',
    screen: 'A08T-fil',
    h1: 'Béninois en France',
    h1Mobile: 'Béninois en France',
  },
  {
    path: '/reseaux/beninois-en-france?onglet=gerer&vue=proprietaire',
    screen: 'A08T-gerer',
    h1: 'Béninois en France',
    h1Mobile: 'Gérer le réseau',
  },
  {
    path: '/reseaux/beninois-en-france/sujets/passeport',
    screen: 'A09',
    h1: 'Renouveler son passeport béninois depuis la France',
    h1Mobile: 'Renouveler son passeport béninois depuis la France',
  },
  {
    path: '/reseaux/nouveau',
    screen: 'A10',
    h1: "Nouveau réseau d'intérêt",
    h1Mobile: "Nouveau réseau d'intérêt",
  },
  { path: '/villes', screen: 'A11', h1: 'Villes et Membres', h1Mobile: 'Villes et Membres' },
  {
    path: '/villes?vue=carte',
    screen: 'A11-carte',
    h1: 'Villes et Membres',
    h1Mobile: 'Villes et Membres',
  },
  { path: '/villes/lyon', screen: 'A12', h1: 'Lyon', h1Mobile: 'Lyon' },
  { path: '/villes/lyon?onglet=produits', screen: 'A12T-produits', h1: 'Lyon', h1Mobile: 'Lyon' },
  { path: '/publications/repas-partage', screen: 'A02', h1: null, h1Mobile: null },
  { path: '/stories/visale', screen: 'A13', h1: null, h1Mobile: null },
  { path: '/stories/nouvelle', screen: 'A14-1', h1: null, h1Mobile: null },
  {
    path: '/stories/nouvelle?etape=2',
    screen: 'A14-2',
    h1: null,
    h1Mobile: 'Ce conseil concerne…',
  },
] as const;

const isDesktop = (page: Page): boolean => (page.viewportSize()?.width ?? 0) >= 1024;

/** Le cadre que la largeur courante rend visible. L'autre est masqué en CSS. */
const frame = (page: Page) =>
  page.locator(isDesktop(page) ? '[data-frame="desktop"]' : '[data-frame="mobile"]');

test.describe('les écrans du lot 2 sont montés et nommés', () => {
  for (const route of ROUTES) {
    test(`${route.screen} — ${route.path}`, async ({ page }) => {
      const response = await page.goto(route.path, { waitUntil: 'networkidle' });
      expect(response?.status(), `${route.path} doit répondre`).toBe(200);

      /**
       * 1. LE BON CADRE EST VISIBLE, l'autre est hors de l'arbre.
       *
       * `ScreenFrames` rend les deux et en masque un — Next rend côté serveur et
       * ignore la largeur de la fenêtre. Ce qui doit être vrai, c'est qu'UN SEUL
       * soit rendu à l'écran, sans quoi tout le reste (titre, géométrie) mesure le
       * mauvais design sans le dire.
       */
      await expect(frame(page)).toBeVisible();
      const other = page.locator(
        isDesktop(page) ? '[data-frame="mobile"]' : '[data-frame="desktop"]',
      );
      if ((await other.count()) > 0) await expect(other).toBeHidden();

      /**
       * 2. LE TITRE DE PAGE est celui que la maquette écrit — un seul, visible.
       *
       * Le `<h1>` n'est pas décoratif : sans lui, un lecteur d'écran ne sait pas de
       * quoi la page parle (axe : `page-has-heading-one`). Le texte est comparé à
       * celui de la MAQUETTE, pas à une formulation choisie ici : c'est ce qui a
       * manqué la première fois qu'un écran a été réécrit à la main.
       */
      const expected = isDesktop(page) ? route.h1 : route.h1Mobile;
      const h1 = frame(page).locator('h1');
      if (expected === null) {
        expect(await h1.count(), `${route.screen} : la maquette ne dessine aucun titre`).toBe(0);
      } else {
        await expect(h1).toHaveCount(1);
        await expect(h1).toBeVisible();
        expect((await h1.textContent())?.trim()).toBe(expected);
      }

      /**
       * 3. AUCUN COMPTEUR DE VUES, NULLE PART — règle dure §1.2.
       *
       * Le test cherche le MOTIF, pas un champ : « 42 vues », « 1 200 vues ». Un
       * compteur peut arriver par la donnée autant que par le balisage, et la règle
       * porte sur ce que le membre LIT. La maquette tient la règle d'elle-même —
       * elle écrit « aucun compteur de vues » sous A13 — donc ce test doit rester
       * vert sans rien retirer ; il est là pour le jour où ça change.
       */
      const views = await page.evaluate(() => {
        const text = document.body.innerText;
        return [...text.matchAll(/(\d[\d\s ]*)\s*vues?\b/gi)].map((m) => m[0].trim()).slice(0, 5);
      });
      expect(views, `compteur de vues interdit (§1.2) sur ${route.screen}`).toEqual([]);

      /**
       * 4. PAS DE DÉBORDEMENT HORIZONTAL de la page — le symptôme n°1 d'un écran
       *    transcodé dont une largeur fixe a survécu.
       */
      const overflow = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        inner: window.innerWidth,
      }));
      expect(
        overflow.scroll,
        `${route.screen} déborde : ${overflow.scroll} px pour ${overflow.inner} px`,
      ).toBeLessThanOrEqual(overflow.inner + 1);
    });
  }
});

/**
 * LE CONTENU ARRIVE DANS LE HTML DU SERVEUR, sans attendre le JavaScript.
 *
 * Ce test existe à cause d'un défaut trouvé en lisant la réponse du serveur, et
 * invisible autrement : les pages qui lisaient l'URL avec `useSearchParams()`
 * renvoyaient un HTML VIDE. Le crochet force le rendu client de tout ce qu'il
 * enveloppe ; sur une page statique, il ne restait rien à pré-rendre. `/villes`
 * faisait 8 ko de script et zéro mot de contenu — et s'affichait parfaitement dans
 * un navigateur, ce qui est exactement pourquoi personne ne le voit.
 *
 * Le dépôt avait DÉJÀ appris cette leçon (voir `(onboarding)/bienvenue/fin/page.tsx`)
 * et la corriger a demandé de repasser cinq pages en composants serveur, qui
 * reçoivent l'URL en propriété.
 *
 * Le test coupe le JavaScript : c'est la seule façon de mesurer ce que le serveur
 * envoie vraiment, plutôt que ce que l'hydratation rattrape.
 *
 * ── CE TEST NE MORD QUE CONTRE UN BUILD DE PRODUCTION ───────────────────────
 *
 * Découvert par mutation, et c'est le genre de chose qu'on ne devine pas : en
 * remettant `useSearchParams()` dans `(app)/villes/page.tsx`, les six cas sont restés
 * VERTS contre `next dev`, et deux sont tombés contre `next build && next start`.
 *
 * La raison est que la bascule vers le rendu client n'a lieu qu'à la GÉNÉRATION
 * STATIQUE : le serveur de développement rend tout à la demande, donc il remplit le
 * HTML dans les deux cas. C'est mot pour mot ce que le dépôt avait déjà écrit dans
 * `(onboarding)/bienvenue/fin/page.tsx` — « le serveur de développement l'accepte
 * sans rien dire » — et c'est pourquoi c'est répété ici, à l'endroit où quelqu'un
 * pourrait croire un vert qui ne vaut rien.
 */
test.describe('le serveur rend le contenu, pas une coquille', () => {
  test.use({ javaScriptEnabled: false });

  const SERVER_RENDERED = [
    { path: '/villes', text: 'Villes et Membres' },
    { path: '/villes?vue=carte', text: 'Villes et Membres' },
    { path: '/villes/lyon?onglet=produits', text: 'Lyon' },
    { path: '/guides/visale-sans-cdi?vue=auteur', text: 'Obtenir la garantie Visale sans CDI' },
    { path: '/reseaux/beninois-en-france?onglet=fil', text: 'Béninois en France' },
    { path: '/stories/nouvelle?etape=2', text: 'Ce conseil concerne' },
  ] as const;

  for (const { path, text } of SERVER_RENDERED) {
    test(path, async ({ page }) => {
      const response = await page.goto(path);
      const html = (await response?.text()) ?? '';
      expect(html, `${path} doit contenir « ${text} » AVANT toute hydratation`).toContain(text);
    });
  }
});

/**
 * LE RAIL DE 76 px — la colonne d'icônes que la maquette pose à gauche de tous ses
 * cadres d'ordinateur, sauf ceux qui n'en dessinent pas.
 *
 * A05 (l'éditeur, en colonne), A13 et A14 (les stories, plein écran sombre) n'en ont
 * pas : la maquette les dessine sans. Et les planches A08T / A12T non plus, puisque
 * ce sont des zones de contenu — c'est le manque que le rapport nomme.
 */
const WITH_RAIL = [
  '/guides',
  '/guides/visale-sans-cdi',
  '/guides/visale-sans-cdi/propositions',
  '/guides/visale-sans-cdi/corriger',
  '/reseaux',
  '/reseaux/beninois-en-france',
  '/reseaux/beninois-en-france/sujets/passeport',
  '/reseaux/nouveau',
  '/villes',
  '/villes/lyon',
  '/publications/repas-partage',
] as const;

test.describe('le rail garde ses 76 px', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'le rail est un design d’ordinateur');

  for (const path of WITH_RAIL) {
    test(path, async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle' });
      const rail = page.locator('[data-frame="desktop"] nav').first();
      await expect(rail).toBeVisible();
      expect((await rail.boundingBox())?.width).toBe(76);
    });
  }
});

/**
 * A05 — L'ÉDITEUR EST EN COLONNE, sa barre d'outils AU-DESSUS du corps.
 *
 * La maquette met `flex-direction: column` dans le conteneur du cadre, que le
 * générateur retire parce qu'il portait aussi la taille fixe de la planche. Tous les
 * autres cadres d'ordinateur sont en rangée ; celui-ci est le seul en colonne, et
 * sans la bascule sa barre d'outils se retrouvait À CÔTÉ du texte.
 *
 * Le test mesure la GÉOMÉTRIE — la barre finit avant que le corps commence — et non
 * la propriété CSS : c'est le résultat qui compte, et une propriété peut être juste
 * sans que le rendu le soit.
 */
test.describe('A05 · l’éditeur de guide', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'la colonne est un fait d’ordinateur');

  test('la barre d’outils est au-dessus du corps, pas à côté', async ({ page }) => {
    await page.goto('/guides/nouveau', { waitUntil: 'networkidle' });

    /**
     * Les bandes se cherchent SOUS les enveloppes sans boîte.
     *
     * Le générateur pose un repère `<main style="display: contents">` quand la
     * maquette n'en fournit pas : il n'a donc aucune géométrie propre, et mesurer
     * les enfants directs du cadre revenait à mesurer un seul élément — le test
     * passait ou tombait pour une raison qui n'avait rien à voir avec la colonne.
     */
    const boxes = await page.evaluate(() => {
      const bands = (el: Element): Element[] =>
        [...el.children].flatMap((c) =>
          getComputedStyle(c).display === 'contents' ? bands(c) : [c],
        );
      const frameEl = document.querySelector('[data-frame="desktop"]');
      if (frameEl === null) return [];
      return bands(frameEl).map((c) => {
        const r = c.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      });
    });

    expect(boxes.length, 'le cadre a bien plusieurs bandes').toBeGreaterThanOrEqual(2);
    const [first, second] = boxes;
    expect(first, 'première bande').toBeDefined();
    expect(second, 'seconde bande').toBeDefined();
    if (first === undefined || second === undefined) return;

    // EMPILÉES : la seconde commence au plus tôt là où la première finit.
    expect(second.top, 'les bandes sont empilées, pas côte à côte').toBeGreaterThanOrEqual(
      first.bottom - 1,
    );
    // Et non JUXTAPOSÉES : elles partagent le même bord gauche.
    expect(Math.abs(second.left - first.left), 'même bord gauche').toBeLessThanOrEqual(1);
  });
});

/**
 * A14 — LA COQUE DU CADRE SURVIT AU TRANSCODAGE.
 *
 * Seul écran de la maquette à mettre de la vraie mise en page dans le conteneur que
 * le générateur retire d'habitude : remplissage, texte blanc, et un fond qui est une
 * DONNÉE (`background: {{ writeBg }}`, la couleur choisie dans la palette). Sans
 * `keepFrameStyle`, l'étape 1 dessinait du texte blanc sur fond clair, collé aux
 * bords — illisible, et sans que rien ne le signale.
 *
 * `#16785E` est le premier de la palette de la maquette. Le test lit la couleur
 * CALCULÉE, donc il tient quelle que soit la façon dont elle arrive.
 */
test.describe('A14 · la coque du cadre', () => {
  test.skip(
    ({ viewport }) => (viewport?.width ?? 0) >= 1024,
    'la coque colorée est le cadre mobile',
  );

  test('l’étape 1 garde son fond de palette et son remplissage', async ({ page }) => {
    await page.goto('/stories/nouvelle', { waitUntil: 'networkidle' });

    const shell = await page.evaluate(() => {
      const el = document.querySelector('[data-frame="mobile"]')?.firstElementChild;
      if (el === null || el === undefined) return null;
      const s = getComputedStyle(el);
      return { background: s.backgroundColor, color: s.color, paddingTop: s.paddingTop };
    });

    expect(shell, 'la coque existe').not.toBeNull();
    expect(shell?.background, 'le fond est la couleur choisie dans la palette').toBe(
      'rgb(22, 120, 94)',
    );
    expect(shell?.color, 'le texte est blanc sur ce fond').toBe('rgb(255, 255, 255)');
    expect(shell?.paddingTop, 'le remplissage du haut de la maquette').toBe('48px');
  });
});

/**
 * A08 — CHANGER D'ONGLET CHANGE LE CONTENU.
 *
 * Les treize planches A08T sont des variantes d'état de cet écran, choisies par
 * `?onglet=`. Ce qu'on vérifie n'est pas « le bon composant est importé » — ça, le
 * compilateur le dit — mais que deux onglets différents MONTRENT deux choses
 * différentes. Un aiguillage qui retombe toujours sur le même défaut compile
 * parfaitement et se voit d'une seule façon : en comparant.
 */
test('A08 · deux onglets montrent deux contenus', async ({ page }) => {
  await page.goto('/reseaux/beninois-en-france', { waitUntil: 'networkidle' });
  const sujets = await frame(page).innerText();

  await page.goto('/reseaux/beninois-en-france?onglet=evenements', { waitUntil: 'networkidle' });
  const evenements = await frame(page).innerText();

  expect(sujets.length, 'l’onglet Sujets a du contenu').toBeGreaterThan(200);
  expect(evenements, 'un autre onglet, un autre contenu').not.toBe(sujets);
  // Et c'est bien le contenu ATTENDU, pas simplement un autre : la maquette écrit
  // ce sujet épinglé sur l'onglet Sujets, et lui seul.
  expect(sujets).toContain('Renouveler son passeport depuis la France');
  expect(evenements).not.toContain('Renouveler son passeport depuis la France');
});

/**
 * A12 — MÊME PROPRIÉTÉ sur la fiche ville : quatre onglets, quatre contenus.
 */
test('A12 · deux onglets montrent deux contenus', async ({ page }) => {
  await page.goto('/villes/lyon', { waitUntil: 'networkidle' });
  const budgets = await frame(page).innerText();

  await page.goto('/villes/lyon?onglet=produits', { waitUntil: 'networkidle' });
  const produits = await frame(page).innerText();

  expect(produits).not.toBe(budgets);
  // « Chambre en coloc » est une ligne de budget, et n'existe que là.
  expect(budgets).toContain('Chambre en coloc');
  expect(produits).not.toContain('Chambre en coloc');
});

/**
 * A02 — LE VOTE SUR UN GUIDE RATTACHÉ CHANGE CE QU'ON VOIT.
 *
 * C'est le seul comportement de cet écran, et il a un sens de produit : le membre
 * dit si le rattachement automatique est utile, et c'est ce retour qui corrige les
 * suggestions. Sans cette boucle, la liste ne s'améliore jamais.
 *
 * Le test lit la couleur CALCULÉE avant et après, plutôt que de chercher un attribut
 * d'état : ce qui compte est que le membre VOIE que son vote est pris.
 */
test('A02 · voter « utile » sur un guide se voit', async ({ page }) => {
  /**
   * Le bloc « GUIDES LIÉS » n'existe que dans le cadre d'ORDINATEUR : le cadre
   * mobile de A02 ne dessine que la publication et ses réponses. Ce n'est pas une
   * omission du transcodage, c'est la maquette — un téléphone n'a pas la place de
   * la colonne de contexte.
   */
  test.skip(
    (page.viewportSize()?.width ?? 0) < 1024,
    'les guides liés sont dans la colonne de contexte',
  );

  await page.goto('/publications/repas-partage', { waitUntil: 'networkidle' });

  /**
   * `title="Pertinent"` vient de la MAQUETTE : c'est elle qui nomme ce bouton, qui
   * ne porte autrement qu'un pouce. Le viser par son nom accessible, et non par sa
   * position, veut dire que le test suit le libellé si la maquette le change — et
   * tombe s'il disparaît, ce qui serait une régression d'accessibilité.
   */
  const button = frame(page).getByTitle('Pertinent').first();
  await expect(button).toBeVisible();

  const before = await button.evaluate((el) => getComputedStyle(el).backgroundColor);
  await button.click();
  const after = await button.evaluate((el) => getComputedStyle(el).backgroundColor);

  expect(before, 'le fond de départ est le gris neutre de la maquette').toBe('rgb(242, 245, 244)');
  expect(after, 'voter passe le bouton au vert primaire').toBe('rgb(22, 120, 94)');
});
