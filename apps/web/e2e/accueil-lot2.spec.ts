import { expect, test, type Browser, type Page, type Playwright } from '@playwright/test';
import { connecter } from './session';
import {
  ajouterBudget,
  creerEvenementDeDemain,
  creerMembreDecor,
  creerReseau,
  ouvrirSessionDe,
  publierPublication,
  villeActive,
  type ReseauDecor,
} from './aide-w5b';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ CE FICHIER ÉTAIT ROUGE — 88 CAS SUR 93 — ET LA CAUSE N'ÉTAIT PAS EN LUI    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Mesuré sur le commit de base, et vérifié avec la version HEAD de ce fichier
 * jouée telle quelle : chaque cas atterrissait sur « Votre numéro de téléphone »,
 * c'est-à-dire sur l'écran de CONNEXION. L'instantané de Playwright le dit.
 *
 * Un lot ultérieur à l'écriture de ce fichier a posé `GardeSession` sur
 * `(app)/layout.tsx` : elle RENVOIE vers `/connexion` dès que la reprise de
 * session a échoué. Ces cas n'ouvraient aucune session et n'interceptaient rien,
 * donc la reprise échouait, donc aucune des dix-sept routes ne rendait son cadre.
 * Les assertions de géométrie et de titre mesuraient un écran qui n'était pas
 * celui du test — et toutes étaient rouges, ce qui au moins ne mentait pas.
 *
 * Ce qu'il fallait AJOUTER est le `beforeEach` ci-dessous, et rien d'autre : ces
 * cas éprouvent le DESSIN TRANSCODÉ, pas le réseau.
 *
 *   · un fourre-tout qui répond `503` à tout appel, pour qu'aucune route ne
 *     parte vers une vraie API — celle d'un autre arbre de travail, branchée sur
 *     une autre base, donnerait un succès qui ne prouve rien ;
 *   · une reprise de session qui RÉUSSIT, pour que la garde ouvre.
 *
 * Les écrans qui lisent l'API rendent alors leur cadre de REPLI (c'est le
 * `squelette` d'`EcranDonnees`, et `useReseau` pose `pret` dans son `finally`) :
 * le dessin est là, la donnée est absente, et c'est précisément ce que ces cas
 * mesurent.
 */

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
/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ `ATTENTE` — LE TITRE QUE CES CAS PEUVENT HONNÊTEMENT EXIGER               ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Trois titres de ce tableau portaient « Béninois en France », et les cas
 * correspondants étaient ROUGES EN PERMANENCE. La raison n'est pas dans l'écran :
 * c'est LE NOM DU RÉSEAU, et il vient de `GET /communities/:slug`, un appel
 * CLIENT — alors que le `beforeEach` de ce fichier répond `503` À TOUTE L'API,
 * délibérément, pour que ces cas éprouvent le DESSIN TRANSCODÉ et jamais le
 * réseau d'un autre arbre de travail. Ces cas demandaient donc une donnée que la
 * suite s'interdit elle-même de fournir.
 *
 * ── CE QUE CES CAS TENAIENT QUAND MÊME, ET QU'IL NE FAUT PAS PERDRE ─────────
 *
 * Leur rouge a servi : il a tenu la COQUILLE VIDE. Mesuré au `curl`,
 * `/reseaux/beninois-en-france?onglet=fil` ne servait que quatre mots
 * (« DisaporyPlus Chargement du réseau… ») parce que `reseau-screen.tsx`
 * renvoyait un paquet d'attente À LA PLACE du cadre. C'est corrigé — 203 mots
 * servis — et il faut que le remplacer par un vert ne rende pas ce dépôt aveugle
 * à la rechute.
 *
 * D'où une valeur EXACTE et non un assouplissement. Le cas compare toujours au
 * caractère près, et il rougit sur les trois rechutes possibles :
 *
 *   · le titre redevient VIDE (`<h1></h1>`, violation `empty-heading` d'axe) ;
 *   · le titre EMPRUNTE le nom de la maquette — « Béninois en France » peint sur
 *     la fiche de Lyon, qui est le défaut d'origine du module ;
 *   · l'écran cesse de peindre son cadre, et il n'y a plus de `<h1>` du tout.
 *
 * CE QUI RESTE NON TENU, ET C'EST UN MANQUE ASSUMÉ : que le nom RÉEL s'affiche
 * quand l'API répond. Aucun cas de ce fichier ne peut le dire, puisqu'il
 * n'allume jamais l'API. Il faut pour cela une suite à base semée — c'est ce que
 * fait `e2e/session.ts`, et c'est une autre nature de vérification.
 */
const ATTENTE = '—';

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
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ A05 — LA PLANCHE DE 390 px N'A PLUS DE `<h1>`, ET C'EST LE BON ÉTAT     ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * CE CAS ATTENDAIT `h1Mobile: 'Mon arrivée étudiante à Lyon'`, avec ce
   * commentaire : « Le cadre mobile de l'éditeur met le nom du BROUILLON là où
   * l'ordinateur écrit “Nouveau guide”. Deux titres différents, comme la maquette
   * les dessine. »
   *
   * CE QUE LA MESURE A MONTRÉ, et pourquoi l'attente change : ce texte n'était pas
   * un titre, c'était LE CONTENU D'UNE BOÎTE DE SAISIE — 48 px de haut, bord vert
   * de 1,5 px, celui que cette maquette dessine sur un champ actif. Tant que
   * l'éditeur était une image, la différence ne se voyait pas ; depuis que
   * `A05_EDITEUR` en fait un `<input>` (le porteur : « Les pages Écrire un guide
   * est finalisé ? »), un `<h1>` autour d'un champ vide serait un titre SANS
   * TEXTE — ce qu'axe relève en `empty-heading`, c'est-à-dire pire que pas de
   * titre.
   *
   * `null` DIT DONC LA VÉRITÉ : la maquette n'écrit aucun titre sur cette planche
   * hors du champ lui-même. C'est le même cas que `/admin` et `/admin/membres`,
   * épinglés de la même façon dans `e2e/administration.spec.ts` —
   * `page-has-heading-one` est une règle « best-practice » d'axe-core, hors des
   * étiquettes WCAG retenues par `e2e/a11y.spec.ts`. Le jour où la maquette donne
   * un titre à cette planche, c'est ce `null` qui tombe.
   *
   * LE CADRE D'ORDINATEUR, lui, garde le sien : « Nouveau guide », que la maquette
   * écrit bien en 16 px au-dessus de la grille des champs.
   */
  {
    path: '/guides/nouveau',
    screen: 'A05',
    h1: 'Nouveau guide',
    h1Mobile: null,
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
    // Le nom vient de l'API, que ce fichier coupe : voir `ATTENTE` ci-dessus.
    h1: ATTENTE,
    h1Mobile: ATTENTE,
  },
  {
    path: '/reseaux/beninois-en-france?onglet=fil',
    screen: 'A08T-fil',
    h1: ATTENTE,
    h1Mobile: ATTENTE,
  },
  {
    path: '/reseaux/beninois-en-france?onglet=gerer&vue=proprietaire',
    screen: 'A08T-gerer',
    // `h1Mobile` reste un MOT DE LA MAQUETTE : la planche mobile de « Gérer »
    // écrit son propre titre, elle ne reprend pas le nom du réseau. Les deux
    // largeurs ne dépendent donc pas de la même chose, et c'est la donnée qui le
    // dit — pas une préférence.
    h1: ATTENTE,
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

/**
 * LE FOURRE-TOUT D'ABORD, LA REPRISE ENSUITE — voir l'en-tête de ce fichier.
 *
 * Playwright donne la main au DERNIER motif inscrit : l'ordre est donc le contraire
 * de l'intuition, et l'inverser ferait avaler la route précise par le fourre-tout.
 */
test.beforeEach(async ({ page }, testInfo) => {
  // Les `describe` « RÉEL · … » lisent de vraies données : l'API n'y est pas coupée.
  if (testInfo.titlePath.some((titre) => titre.startsWith('RÉEL ·'))) return;
  await page.route('**/v1/**', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: '{"error":{"code":"HORS_TEST","message":"Appel non intercepté par cette spec."}}',
    }),
  );
  await page.route('**/v1/auth/refresh', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ accessToken: 'jeton-de-test', isNewUser: false }),
    }),
  );
});

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
    // MISE À JOUR (lot w5b) : le nom de la ville vient de l'API (appel client), donc il n'est plus dans
    // le HTML servi ; le CADRE, lui, l'est : ses onglets prouvent qu'aucune coquille n'est servie.
    { path: '/villes/lyon?onglet=produits', text: 'Produits du pays' },
    { path: '/guides/visale-sans-cdi?vue=auteur', text: 'Obtenir la garantie Visale sans CDI' },
    /**
     * LE MOT-TÉMOIN N'EST PAS LE NOM DU RÉSEAU, ET C'EST UNE CORRECTION.
     *
     * Il l'était — « Béninois en France » — et ce cas était ROUGE À RAISON, mais
     * pas pour la raison qu'il affichait. Mesuré au `curl` : le serveur ne
     * servait que QUATRE MOTS sur cette route, « DisaporyPlus Chargement du
     * réseau… », parce que `reseau-screen.tsx` renvoyait un paquet d'attente À LA
     * PLACE du cadre. C'était la coquille vide, et ce cas la tenait.
     *
     * La coquille est corrigée (203 mots servis, rail, panneau et onglets
     * compris). Mais le NOM, lui, ne peut pas revenir ici : il vient de
     * `GET /communities/:slug`, un appel CLIENT. Exiger du serveur une donnée
     * qu'il n'a pas, c'est exiger une refonte en rendu serveur — un arbitrage du
     * porteur, pas une assertion de test.
     *
     * Le témoin est donc un mot que la MAQUETTE écrit et que le serveur sert :
     * « ANNONCE DU RÉSEAU », l'intitulé du bloc épinglé de la planche. Il
     * disparaîtrait si cette route repassait en rendu client — ce que ce bloc
     * surveille — sans rien affirmer sur la donnée.
     */
    // Idem : « ANNONCE DU RÉSEAU » était un texte de maquette. L'état vide du fil est servi avec le cadre.
    { path: '/reseaux/beninois-en-france?onglet=fil', text: 'Aucune publication dans ce réseau' },
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
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES CAS QUI LISENT DE VRAIES DONNÉES — LOT W5B                             ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Ces cas (« deux onglets montrent deux contenus » pour un réseau et pour une ville, « aucun
 * guide n'est affirmé rattaché », « Contribuer à la fiche ») cherchaient du contenu de LA
 * MAQUETTE — « Épingler », « Repas partagé béninois », « Chambre en coloc », la ville de Lyon —
 * sous une API coupée en 503. Depuis que ces écrans sont vivants, l'API coupée ne montre plus
 * que leurs états vides, et la maquette n'est plus nulle part : ces cas ne pouvaient plus être
 * verts, et la cause n'était pas un défaut du produit.
 *
 * ILS LISENT MAINTENANT CE QU'ILS ONT CRÉÉ, par les routes du produit (`aide-w5b.ts`) :
 *   · un réseau public, son sujet et un événement qui lui est réservé ;
 *   · la première ville ACTIVE (Lyon est inactive sur une base fraîche), avec un budget ;
 *   · une publication.
 * Le décor est bâti UNE fois par ouvrier ; le titre de ces `describe` porte « RÉEL » : c'est ce
 * qui retire, pour eux seuls, la coupure de l'API du `beforeEach` en tête de fichier.
 *
 * Les libellés du dessin qui n'ont PAS changé de sens sont gardés : « Épingler » (le menu d'un
 * sujet, pour le propriétaire) au large, « Sourdine » au téléphone.
 */
interface DecorReel {
  readonly reseau: ReseauDecor;
  readonly evenement: string;
  readonly ville: { readonly slug: string; readonly nom: string };
  readonly budget: string;
  readonly publication: string;
}

let decorReel: Promise<DecorReel> | null = null;

function decorDeLOuvrier(browser: Browser, playwright: Playwright): Promise<DecorReel> {
  decorReel ??= (async (): Promise<DecorReel> => {
    const reseau = await creerReseau(
      browser,
      playwright,
      'Béninois en France',
      'Renouveler son passeport béninois depuis la France',
    );
    const evenementTitre = 'Repas partagé béninois';
    await creerEvenementDeDemain(reseau.proprietaire, evenementTitre, { communityId: reseau.id });
    const cite = await villeActive(reseau.proprietaire.request);
    const budget = 'Chambre en coloc';
    const contributeur = await creerMembreDecor(browser, playwright, 'Kofi Boateng', { niveau: 'L2' });
    await ajouterBudget(contributeur, cite.slug, budget, 45_000);
    const publication = await publierPublication(contributeur, 'Un repas partagé samedi : qui vient ?');
    await contributeur.fermer();
    return {
      reseau,
      evenement: evenementTitre,
      ville: { slug: cite.slug, nom: cite.name },
      budget,
      publication,
    };
  })();
  return decorReel;
}

test.describe('RÉEL · A08 — deux onglets montrent deux contenus', () => {
  test('le réseau montre ses sujets d’un côté, ses événements de l’autre', async ({
    page,
    browser,
    playwright,
  }) => {
    test.setTimeout(180_000);
    const d = await decorDeLOuvrier(browser, playwright);
    await ouvrirSessionDe(page.context(), d.reseau.proprietaire);

    await page.goto(`/reseaux/${d.reseau.slug}`, { waitUntil: 'networkidle' });
    await expect(frame(page).getByText(d.reseau.sujet.titre).first()).toBeVisible({ timeout: 25_000 });
    const sujets = await frame(page).innerText();

    await page.goto(`/reseaux/${d.reseau.slug}?onglet=evenements`, { waitUntil: 'networkidle' });
    await expect(frame(page).getByText(d.evenement).first()).toBeVisible({ timeout: 25_000 });
    const evenements = await frame(page).innerText();

    const etroit = (page.viewportSize()?.width ?? 0) < 1024;
    const plancher = etroit ? 140 : 400;
    expect(sujets.length, `l’onglet Sujets a du contenu (plancher ${plancher})`).toBeGreaterThan(plancher);
    expect(evenements, 'un autre onglet, un autre contenu').not.toBe(sujets);

    const temoinSujets = etroit ? 'Sourdine' : 'Épingler';
    expect(sujets, `l’onglet Sujets porte « ${temoinSujets} »`).toContain(temoinSujets);
    expect(evenements, `l’onglet Événements ne porte pas « ${temoinSujets} »`).not.toContain(temoinSujets);
    expect(evenements, 'l’onglet Événements porte son événement').toContain(d.evenement);
    expect(sujets, 'l’onglet Sujets ne porte pas l’événement').not.toContain(d.evenement);
    expect(evenements, 'l’onglet Événements ne porte pas le sujet').not.toContain(d.reseau.sujet.titre);
  });
});

test.describe('RÉEL · A12 — deux onglets montrent deux contenus', () => {
  test('les budgets d’un côté, les produits du pays de l’autre', async ({ page, browser, playwright, request }) => {
    test.setTimeout(180_000);
    const d = await decorDeLOuvrier(browser, playwright);
    await connecter(page.context(), request, { displayName: 'Awa Konaté' });

    await page.goto(`/villes/${d.ville.slug}`, { waitUntil: 'networkidle' });
    await expect(frame(page).getByText(d.budget).first()).toBeVisible({ timeout: 25_000 });
    const budgets = await frame(page).innerText();

    await page.goto(`/villes/${d.ville.slug}?onglet=produits`, { waitUntil: 'networkidle' });
    await expect(frame(page).getByRole('heading', { level: 1 })).toHaveText(d.ville.nom);
    const produits = await frame(page).innerText();

    expect(produits).not.toBe(budgets);
    // Un budget est une ligne de l'onglet « Budgets réels », et n'existe que là.
    expect(budgets).toContain(d.budget);
    expect(produits).not.toContain(d.budget);
  });
});

test.describe('RÉEL · A02 — une publication', () => {
  test('aucun guide n’est affirmé rattaché tant que l’API n’en donne pas', async ({
    page,
    browser,
    playwright,
    request,
  }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1024, 'les guides liés sont dans la colonne de contexte');
    test.setTimeout(180_000);
    const d = await decorDeLOuvrier(browser, playwright);
    await connecter(page.context(), request, { displayName: 'Awa Konaté' });

    await page.goto(`/publications/${d.publication}`, { waitUntil: 'networkidle' });

    await expect(frame(page).getByText('GUIDES LIÉS', { exact: false })).toBeVisible({ timeout: 25_000 });
    await expect(frame(page).getByTitle('Pertinent')).toHaveCount(0);
  });
});

test.describe('RÉEL · A12C — « Contribuer à la fiche de la ville »', () => {
  const nomDeLaFenetre = (ville: string, largeur: number): string =>
    largeur >= 1024 ? `Contribuer à la fiche ${ville}` : `Contribuer à ${ville}`;

  for (const width of [1440, 390]) {
    test(`${width} px — « Contribuer » ouvre la fenêtre`, async ({ page, browser, playwright, request }) => {
      test.skip((page.viewportSize()?.width ?? 0) !== width, 'piloté par le projet');
      const d = await decorDeLOuvrier(browser, playwright);
      await connecter(page.context(), request, { displayName: 'Awa Konaté' });
      await page.goto(`/villes/${d.ville.slug}`, { waitUntil: 'load' });

      // Rien n'est ouvert tant qu'on n'a rien demandé.
      await expect(page.getByRole('dialog')).toHaveCount(0);

      await frame(page).locator('[data-modal-open="A12C"]').first().click();
      await expect(page.getByRole('dialog', { name: nomDeLaFenetre(d.ville.nom, width) })).toBeVisible();
    });
  }

  test('le voile ferme au clic hors du panneau', async ({ page, browser, playwright, request }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1024, 'mesuré une fois, sur ordinateur');
    const d = await decorDeLOuvrier(browser, playwright);
    await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    await page.goto(`/villes/${d.ville.slug}`, { waitUntil: 'load' });
    await page.locator('[data-frame="desktop"] [data-modal-open="A12C"]').first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-modal-overlay]')).toHaveCount(1);

    await dialog.locator('[data-modal-overlay]').click({ position: { x: 5, y: 5 } });
    await expect(dialog).toBeHidden();
  });

  test('Échap ferme, et le focus revient sur le bouton d’origine', async ({
    page,
    browser,
    playwright,
    request,
  }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1024, 'mesuré une fois, sur ordinateur');
    const d = await decorDeLOuvrier(browser, playwright);
    await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    await page.goto(`/villes/${d.ville.slug}`, { waitUntil: 'load' });

    const bouton = page.locator('[data-frame="desktop"] [data-modal-open="A12C"]').first();
    await bouton.click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(bouton).toBeFocused();
  });

  const VOLETS = [
    { param: 'type', repere: 'Étape 1 sur 2' },
    { param: 'produit', repere: 'Étape 2 sur 2' },
    { param: 'budget', repere: 'Étape 2 sur 2' },
  ] as const;

  for (const { param, repere } of VOLETS) {
    test(`?contribution=${param} ouvre le volet « ${repere} »`, async ({ page, browser, playwright, request }) => {
      test.skip((page.viewportSize()?.width ?? 0) < 1024, 'les volets sont dessinés sur ordinateur');
      const d = await decorDeLOuvrier(browser, playwright);
      await connecter(page.context(), request, { displayName: 'Awa Konaté' });
      await page.goto(`/villes/${d.ville.slug}?contribution=${param}`, { waitUntil: 'load' });

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(repere).first()).toBeVisible();
    });
  }

  test('« Contribuer » ouvre l’ÉTAPE 1, jamais un formulaire', async ({ page, browser, playwright, request }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1024, 'mesuré une fois, sur ordinateur');
    const d = await decorDeLOuvrier(browser, playwright);
    await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    await page.goto(`/villes/${d.ville.slug}`, { waitUntil: 'load' });
    await page.locator('[data-frame="desktop"] [data-modal-open="A12C"]').first().click();

    const dialog = page.getByRole('dialog', { name: nomDeLaFenetre(d.ville.nom, 1440) });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Étape 1 sur 2')).toBeVisible();
    await expect(dialog.getByText('Étape 2 sur 2')).toHaveCount(0);
  });

  for (const onglet of ['budgets', 'bons-plans', 'produits', 'temoignages']) {
    test(`l’onglet « ${onglet} » porte le déclencheur de A12C`, async ({ page, browser, playwright, request }) => {
      const d = await decorDeLOuvrier(browser, playwright);
      await connecter(page.context(), request, { displayName: 'Awa Konaté' });
      await page.goto(`/villes/${d.ville.slug}?onglet=${onglet}`, { waitUntil: 'load' });
      await expect(frame(page).locator('[data-modal-open="A12C"]')).toHaveCount(1);
    });
  }
});

/**
 * ─── A01N · « NOUVELLE PUBLICATION », UN ÉCRAN MOBILE SEUL ───────────────────
 *
 * Second cadre de 390 px de A01S, manqué par les lots précédents : la déclaration
 * des modales ne prenait que l'occurrence 0 (« Créer un sondage »), et rien ne
 * disait qu'il y en avait une seconde. Un cadre non déclaré ne produit aucune
 * erreur — il disparaît, simplement.
 *
 * Ce que ces tests tiennent :
 *
 *   · la route répond et porte le titre que la MAQUETTE écrit ;
 *   · l'écran est rendu AUX DEUX LARGEURS, parce qu'il n'a qu'un cadre — c'est le
 *     miroir de O05, et sans cela un visiteur sur ordinateur verrait une page vide ;
 *   · le cadre unique garde ses 390 px et ne s'étire pas sur tout l'écran ;
 *   · les trois règles du composeur sont respectées par ce qui est RÉELLEMENT
 *     affiché — c'est la doublure au navigateur de `composeur.test.ts`, qui les lit
 *     dans la maquette.
 */
test.describe('A01N — « Nouvelle publication »', () => {
  test('la route répond et porte le titre de la maquette', async ({ page }) => {
    const reponse = await page.goto('/publications/nouvelle', { waitUntil: 'load' });
    expect(reponse?.status(), '/publications/nouvelle doit répondre').toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: 'Nouvelle publication' })).toBeVisible();
  });

  /**
   * UN ÉCRAN SANS CADRE D'ORDINATEUR RESTE VISIBLE SUR ORDINATEUR.
   *
   * `ScreenFrames` masque normalement le cadre mobile au-delà de 1024 px. Si cette
   * règle s'appliquait ici, la page serait VIDE sur un écran de bureau — et rien ne
   * le dirait, puisque le HTML serait correctement servi. Ce test est la seule chose
   * qui sépare « écran mobile seul » de « écran cassé sur ordinateur ».
   */
  test('le cadre unique est visible aux deux largeurs', async ({ page }) => {
    await page.goto('/publications/nouvelle', { waitUntil: 'load' });
    const cadre = page.locator('[data-screen="A01N"] [data-frame="mobile"]');
    await expect(cadre).toBeVisible();
    // Aucun cadre d'ordinateur n'est rendu : la maquette n'en dessine pas.
    await expect(page.locator('[data-screen="A01N"] [data-frame="desktop"]')).toHaveCount(0);
  });

  test('le cadre garde les 390 px de la maquette, il ne s’étire pas', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1024, 'la borne ne se mesure qu’au large');
    await page.goto('/publications/nouvelle', { waitUntil: 'load' });

    const boite = await page.locator('[data-screen="A01N"] [data-frame="mobile"]').boundingBox();
    expect(boite).not.toBeNull();
    if (boite === null) return;
    expect(Math.round(boite.width), 'la largeur que la maquette écrit').toBe(390);
  });

  /**
   * LES TROIS RÈGLES DE LA PLANCHE « COMPOSANTS », SUR CE QUI EST AFFICHÉ.
   *
   * Le piège est ici, et il est nommé : le nombre d'images est dessiné TROIS fois —
   * les miniatures, le compteur « 2 / 4 », la pastille « 2 images ». Deux de ces
   * trois ne décident de rien. On compte donc les MINIATURES, par leur géométrie
   * (92 × 92) et non par leur texte d'exemple (« Photo 1 »), qui pourrait changer.
   */
  test('ce qui est affiché respecte les trois règles du composeur', async ({ page }) => {
    await page.goto('/publications/nouvelle', { waitUntil: 'load' });
    const cadre = page.locator('[data-screen="A01N"] [data-frame="mobile"]');

    const compte = await cadre.evaluate((racine) => {
      const tous = [...racine.querySelectorAll<HTMLElement>('*')];
      const miniatures = tous.filter((el) => {
        const s = getComputedStyle(el);
        return s.width === '92px' && s.height === '92px' && s.borderRadius === '14px';
      }).length;
      const etiquettes = tous.filter((el) => {
        const s = getComputedStyle(el);
        return (
          s.backgroundColor === 'rgb(239, 247, 243)' &&
          s.color === 'rgb(15, 92, 72)' &&
          s.borderRadius === '999px' &&
          s.paddingLeft === '12px'
        );
      }).length;
      // L'aperçu compact du sondage se reconnaît à son seul « Modifier ».
      const sondages = tous.filter((el) => el.children.length === 0 && el.textContent === 'Modifier').length;
      return { miniatures, etiquettes, sondages };
    });

    /**
     * ╔══════════════════════════════════════════════════════════════════════╗
     * ║ LES BORNES BASSES ONT SAUTÉ, ET C'EST LE DÉFAUT QU'ELLES GARDAIENT   ║
     * ╚══════════════════════════════════════════════════════════════════════╝
     *
     * Elles exigeaient « au moins une miniature, au moins une étiquette, au
     * moins un sondage » SUR UN BROUILLON NEUF. Elles ne tenaient que parce que
     * la page montait `accueilData()`, la fabrique de DÉMONSTRATION : « Photo
     * 1 », « Repas pas cher à Lyon », « Quelle date pour le repas partagé ? »
     * étaient affichés à qui n'avait rien écrit. Le porteur l'a vu — « la page
     * n'est pas dynamique, pas d'input » — et c'est corrigé.
     *
     * CE TEST GARDE DONC L'INVERSE, qui est la règle vraie : une page de
     * création neuve ne montre le brouillon de PERSONNE. C'est un garde-fou plus
     * fort que l'ancien, parce qu'il échouerait si la fabrique de démonstration
     * revenait.
     *
     * Les bornes HAUTES restent : ce sont les trois règles de la planche
     * « COMPOSANTS », et elles valent quel que soit le contenu.
     */
    expect(compte.miniatures, 'un brouillon neuf ne porte aucune image').toBe(0);
    expect(compte.etiquettes, 'un brouillon neuf ne porte aucun guide lié').toBe(0);
    expect(compte.sondages, 'un brouillon neuf ne porte aucun sondage').toBe(0);

    // « Jusqu’à 4. Miniatures avec croix, case « + » pour en ajouter. »
    expect(compte.miniatures, 'Images — jusqu’à 4').toBeLessThanOrEqual(4);
    // « Jusqu’à 3. Étiquettes vertes avec croix. »
    expect(compte.etiquettes, 'Guides — jusqu’à 3').toBeLessThanOrEqual(3);
    // « Un seul par publication. »
    expect(compte.sondages, 'Sondage — un seul par publication').toBeLessThanOrEqual(1);

    /**
     * ET LES TROIS CONTRÔLES SONT BIEN LÀ — sans quoi « 0, 0, 0 » serait aussi
     * ce que rendrait une page cassée. Le porteur : « pas d'input ».
     */
    await expect(
      page.locator('[data-composeur-texte]').filter({ visible: true }),
      'le composeur doit avoir un champ',
    ).toHaveCount(1);
    await expect(
      page.locator('[data-composeur-type]').filter({ visible: true }),
      'les quatre types doivent être des boutons',
    ).toHaveCount(4);
    await expect(
      page.locator('[data-composeur-publier]').filter({ visible: true }),
      'le bouton « Publier » doit exister',
    ).toHaveCount(1);
  });
});
