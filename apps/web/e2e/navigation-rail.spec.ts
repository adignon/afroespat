import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * ─── LA NAVIGATION, ÉPROUVÉE EN CLIQUANT ─────────────────────────────────────
 *
 * CE FICHIER EXISTE À CAUSE D'UN DÉFAUT QUE QUINZE RAPPORTS VERTS ONT MANQUÉ, et
 * la cause est dans une seule phrase : TOUS les tests de ce dépôt visitaient les
 * écrans en TAPANT L'URL (`page.goto`), jamais en cliquant.
 *
 * Or les écrans sont TRANSCODÉS de maquettes qui DESSINENT la navigation sans la
 * CÂBLER. Mesuré avant ce lot :
 *
 *   · les neuf entrées du rail d'équipe étaient neuf `<span>`. Pas des liens
 *     cassés : AUCUN LIEN. Zéro balise `<a>` sur les quinze cadres du module,
 *     zéro `cursor: pointer` ;
 *   · 207 balises `<a>` dans les 250 cadres produits, et les 207 sur `href="#"` ;
 *   · `e2e/administration.spec.ts` affirmait même « zéro lien dans le cadre » — une
 *     assertion VRAIE, et verte, sur une console d'administration dont aucune page
 *     n'était atteignable depuis une autre.
 *
 * UN TEST QUI GARDE LA NAVIGATION DOIT CLIQUER. C'est tout le défaut, et c'est
 * toute la raison de ce fichier : il part d'un écran, CLIQUE une entrée du rail, et
 * vérifie que l'URL a changé. Une assertion sur le `href` ne suffirait pas — elle
 * mesurerait l'attribut, pas la navigation ; un `<a>` sans `href`, un `pointer-events: none`
 * ou un parent qui avale le clic passeraient tous.
 *
 * ── DEUX ÉCRANS SUR SEIZE LISENT L'API, ET CELA CHANGE L'ARRIVÉE ────────────
 *
 * `/admin/referentiels` (D08) et `/admin/impact` (D16) sont des pages CLIENTES
 * branchées sur `GET /admin/ref/cities` et `GET /admin/impact` ; sans session
 * d'ÉQUIPE elles affichent le refus de `EcranDonneesEquipe`, pas le cadre. Elles ne
 * servent donc ni de point de départ ni de point d'arrivée mesurable au-delà de
 * l'URL — ce qui est dit cas par cas plus bas, au lieu d'être découvert comme un
 * échec intermittent.
 *
 * ── POURQUOI L'ADMINISTRATION, ET POURQUOI SANS SESSION ─────────────────────
 *
 * Le rail d'équipe est le seul rail du dépôt dont la navigation soit DÉCLARÉE à ce
 * jour (`liens` dans `tools/screens/10-administration.mjs`) : c'est donc le seul
 * endroit où un clic peut être GARDÉ plutôt que constaté mort.
 *
 * `(admin)/layout.tsx` ne porte AUCUNE garde de session — il ne fournit que des
 * métadonnées, et c'est documenté chez lui : « le jour où une coquille d'équipe
 * existera, elle vivra ici ». Ces tests n'ouvrent donc pas de session, et ils ne
 * doivent PAS en ouvrir une de membre : 15 §2.1 est une règle dure, « un compte
 * équipe ne peut jamais se connecter à l'application membres, ni l'inverse ».
 * Poser un cookie de membre pour visiter `/admin` serait mesurer précisément ce que
 * la spec interdit. Le jour où la garde d'équipe existera, ce fichier devra ouvrir
 * une session d'ÉQUIPE, et ce commentaire sera l'indice.
 */

/** Ce fichier pilote lui-même sa taille : le rail n'existe qu'en 1440 px. */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'piloté par le test');

/**
 * `load` et non `networkidle` : ces écrans n'émettent aucune requête, et Next
 * précharge les liens visibles — le réseau ne retombe donc jamais au calme. Voir la
 * même note dans `administration.spec.ts`.
 */
/**
 * UNE SESSION D'ÉQUIPE SERVIE (lot w5b). `FournisseurEquipe` interroge `POST /admin/auth/session`
 * au montage et renvoie vers `/admin/connexion` sur un `401` : sans session, la page se
 * recharge sur la connexion au bout de quelques millisecondes, le rail disparaît, et chaque
 * cas de ce fichier mesurait une page de connexion en croyant mesurer la navigation. Ce
 * fichier éprouve le RAIL, pas l'authentification d'équipe (TOTP, mot de passe) : la réponse
 * « qui suis-je ? » est donc servie, au format exact du contrat (`adminStaffSessionResponseSchema`).
 */
async function servirUneSessionEquipe(page: Page): Promise<void> {
  await page.route('**/v1/admin/auth/session', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        staffId: '01a1ffff-0000-7000-8000-000000000001',
        role: 'SUPER_ADMIN',
        sessionId: '01a1ffff-0000-7000-8000-000000000002',
        displayName: 'Équipe éprouvée',
      }),
    }),
  );
}

async function visiter(page: Page, url: string): Promise<void> {
  await servirUneSessionEquipe(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(url, { waitUntil: 'load' });
}

/** Le rail, et lui seul : le `<nav>` du cadre d'ordinateur. */
const rail = (page: Page) => page.locator('[data-frame="desktop"] nav');

/**
 * Les neuf entrées, avec la route que `tools/screens/10-administration.mjs`
 * DÉCLARE pour chacune. La table est recopiée là — pas déduite du libellé, pour la
 * même raison que dans la déclaration : « Services » est écrit dans le rail ET
 * comme titre de la page D10, et les deux ne mènent pas au même endroit.
 */
const ENTREES = [
  { libelle: 'Tableau de bord', route: '/admin', ecran: 'D02', litLApi: true },
  { libelle: 'Rapport d’impact', route: '/admin/impact', ecran: 'D16', litLApi: true },
  { libelle: 'Membres', route: '/admin/membres', ecran: 'D03', litLApi: false },
  { libelle: 'Modération', route: '/admin/moderation', ecran: 'D04', litLApi: true },
  // AJOUTÉE (lot w5b) : D17, « Alertes d'équipe » (13 §4.4, 15 §2.1), quinzième entrée du rail.
  { libelle: 'Alertes d’équipe', route: '/admin/alertes-equipe', ecran: 'D17', litLApi: false },
  { libelle: 'Parcours', route: '/admin/parcours', ecran: 'D06', litLApi: false },
  { libelle: 'Bibliothèque d’étapes', route: '/admin/etapes', ecran: 'D07', litLApi: false },
  { libelle: 'Contenu', route: '/admin/contenu', ecran: 'D12', litLApi: false },
  { libelle: 'Guides', route: '/admin/guides', ecran: 'D09', litLApi: false },
  { libelle: 'Alertes arnaques', route: '/admin/alertes', ecran: 'D11', litLApi: false },
  { libelle: 'Référentiels', route: '/admin/referentiels', ecran: 'D08', litLApi: true },
  { libelle: 'Services', route: '/admin/services', ecran: 'D10', litLApi: true },
  { libelle: 'Revenus', route: '/admin/revenus', ecran: 'D14', litLApi: false },
  { libelle: 'Partenaires', route: '/admin/partenaires', ecran: 'D13', litLApi: false },
  { libelle: 'Réglages', route: '/admin/reglages', ecran: 'D15', litLApi: false },
] as const;

/**
 * ─── CINQ ÉCRANS LISENT L'API, ET ON LEUR SERT LEURS DONNÉES ─────────────────
 *
 * D02, D04, D08, D10 et D16 sont des pages CLIENTES : sans réponse, elles affichent
 * le refus de `EcranDonneesEquipe` au lieu de leur cadre — donc SANS RAIL. Un clic
 * ne pourrait alors pas partir de là, et un test qui l'ignorerait rendrait rouge
 * pour la mauvaise raison.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ C'EST CE QUI PERMET DE DISTINGUER LES DEUX CAUSES, et elles sont         │
 * │ différentes : « le lien ne mène nulle part » est un défaut de            │
 * │ NAVIGATION ; « l'écran n'a pas ses données » est un défaut de DONNÉES.   │
 * │ Les charges servies ici retirent la seconde de l'équation, pour que le   │
 * │ rouge d'un cas de clic ne puisse signifier QUE la première.              │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Les charges sont celles de `packages/shared/src/__tests__/fixtures/`, les mêmes
 * que `admin-responses.test.ts` valide contre les schémas Zod : on ne réinvente pas
 * de fausse réponse à côté, qui dériverait sans que rien ne le dise.
 *
 * `__dirname` et non `import.meta.dirname` : Playwright transpile en CommonJS.
 */
const FIXTURES = resolve(__dirname, '../../../packages/shared/src/__tests__/fixtures');
const charge = (nom: string): string => readFileSync(resolve(FIXTURES, `${nom}.json`), 'utf8');

async function servirLesDonneesEquipe(page: Page): Promise<void> {
  const json = (body: string) => ({ status: 200, contentType: 'application/json', body });
  await page.route('**/v1/admin/dashboard*', (r) => r.fulfill(json(charge('admin_dashboard'))));
  await page.route('**/v1/admin/impact*', (r) => r.fulfill(json(charge('admin_impact'))));
  await page.route('**/v1/admin/moderation/stats*', (r) =>
    r.fulfill(json(charge('admin_moderation_stats'))),
  );
  /**
   * D05 LIT LE DOSSIER, D04 LIT LES STATISTIQUES — deux chemins, deux charges.
   * Les motifs ne se recouvrent pas (`/stats` contre `/cases/…`), donc l'ordre
   * d'enregistrement ne décide de rien : c'est voulu, Playwright donne la main au
   * DERNIER motif inscrit et s'y fier serait fragile.
   */
  await page.route('**/v1/admin/moderation/cases/**', (r) =>
    r.fulfill(json(charge('admin_moderation_case'))),
  );
  await page.route('**/v1/admin/ref/cities*', (r) => r.fulfill(json(charge('admin_ref_cities'))));
  await page.route('**/v1/admin/pro-profiles*', (r) =>
    r.fulfill(json(charge('admin_pro_profiles'))),
  );
}

/**
 * ─── LES QUINZE PLANCHES, ET L'ENTRÉE QUE CHACUNE DOIT SURLIGNER ─────────────
 *
 * Recopié de `PAGE_COURANTE` dans `tools/screens/10-administration.mjs`, et NON
 * déduit de l'URL : c'est la déclaration qui décide, et un test qui la recalculerait
 * ne pourrait pas la contredire.
 *
 * D05 EST LA SEULE EXCEPTION, et elle est DÉCLARÉE : `/admin/moderation/4812` est le
 * DOSSIER d'un signalement, pas une rubrique du menu. Il surligne « Modération », sa
 * rubrique, exactement comme la maquette le peignait — c'est ce que dit sa place
 * dans l'arborescence, `/admin/moderation/[id]`.
 */
const SURBRILLANCE = [
  { url: '/admin', attendu: '/admin' },
  { url: '/admin/impact', attendu: '/admin/impact' },
  { url: '/admin/membres', attendu: '/admin/membres' },
  { url: '/admin/moderation', attendu: '/admin/moderation' },
  { url: '/admin/moderation/4812', attendu: '/admin/moderation' },
  { url: '/admin/alertes-equipe', attendu: '/admin/alertes-equipe' },
  { url: '/admin/parcours', attendu: '/admin/parcours' },
  { url: '/admin/etapes', attendu: '/admin/etapes' },
  { url: '/admin/contenu', attendu: '/admin/contenu' },
  { url: '/admin/guides', attendu: '/admin/guides' },
  { url: '/admin/alertes', attendu: '/admin/alertes' },
  { url: '/admin/referentiels', attendu: '/admin/referentiels' },
  { url: '/admin/services', attendu: '/admin/services' },
  { url: '/admin/revenus', attendu: '/admin/revenus' },
  { url: '/admin/partenaires', attendu: '/admin/partenaires' },
  { url: '/admin/reglages', attendu: '/admin/reglages' },
] as const;

/**
 * LE POINT DE DÉPART EST UN ÉCRAN QUI N'EST PAS CELUI D'ARRIVÉE, et il est STATIQUE.
 *
 * `/admin/reglages` (D15) est transcodé sans appel réseau : il porte son rail dès le
 * HTML, donc le clic mesure la navigation et non un état de chargement. Pour la seule
 * entrée « Réglages », on part d'ailleurs — sinon le départ et l'arrivée seraient la
 * même URL et le cas ne prouverait rien.
 */
const departPour = (route: string): string =>
  route === '/admin/reglages' ? '/admin/revenus' : '/admin/reglages';

test.describe('le rail d’équipe NAVIGUE — au clic, pas à l’URL tapée', () => {
  for (const { libelle, route, litLApi } of ENTREES) {
    test(`clic sur « ${libelle} » → ${route}`, async ({ page }) => {
      // Les cinq écrans clients reçoivent leurs charges AVANT la première
      // navigation : un rouge ne pourra donc signifier qu'un défaut de NAVIGATION.
      await servirLesDonneesEquipe(page);
      const depart = departPour(route);
      await visiter(page, depart);
      // Le départ n'est PAS l'arrivée : sans cela, un clic inerte passerait pour une
      // navigation réussie. C'est exactement le faux vert que ce fichier existe pour
      // rendre impossible.
      expect(new URL(page.url()).pathname).toBe(depart);
      expect(depart).not.toBe(route);

      const entree = rail(page).getByRole('link', { name: libelle, exact: true });
      await expect(entree, 'l’entrée du rail doit être un LIEN, pas un <span>').toHaveCount(1);

      await entree.click();
      /**
       * `toHaveURL` et NON `waitForURL`, et ce n'est pas un détail de style.
       *
       * `page.waitForURL` attend l'état `load` de la page d'arrivée. En
       * développement, Next garde une connexion ouverte et précharge les liens
       * visibles : `load` ne retombe pas, `domcontentloaded` seul se déclenche, et
       * l'attente expire sur une navigation qui a POURTANT eu lieu. C'est la même
       * observation que `administration.spec.ts` fait pour `networkidle`, un cran
       * plus bas. `toHaveURL` SCRUTE `page.url()` sans rien attendre du réseau.
       *
       * L'URL A CHANGÉ : c'est la seule assertion qui prouve une navigation. Un
       * `href` juste ne la prouve pas — un parent qui avale le clic, un
       * `pointer-events: none` ou un `preventDefault` passeraient tous.
       */
      await expect(page).toHaveURL(route);
      expect(new URL(page.url()).pathname).toBe(route);
      // Et l'écran d'arrivée est bien servi, pas une coquille vide — sauf pour les
      // deux pages qui lisent l'API, qui demandent une session d'ÉQUIPE.
      if (!litLApi) await expect(rail(page)).toBeVisible();
    });
  }
});

/**
 * NAVIGABLE AU CLAVIER. Un rail qui ne répond qu'à la souris n'est pas une
 * navigation — §10.6 exige « un nom accessible sur tout élément interactif », et
 * un `<span>` promu sans être focalisable l'aurait manqué en silence.
 *
 * `<a href>` est focalisable NATIVEMENT : aucun `tabIndex` n'est posé par le
 * générateur, et ce test est ce qui le prouve plutôt que de le supposer.
 */
test('le rail se parcourt et s’actionne AU CLAVIER', async ({ page }) => {
  await visiter(page, '/admin/reglages');

  const premiere = rail(page).getByRole('link', { name: 'Tableau de bord', exact: true });
  await expect(premiere).toBeVisible();
  await premiere.focus();
  await expect(premiere).toBeFocused();

  await page.keyboard.press('Enter');
  // `toHaveURL` plutôt que `waitForURL` : voir la note du cas de clic.
  await expect(page).toHaveURL('/admin');
  expect(new URL(page.url()).pathname).toBe('/admin');
});

/**
 * LES QUATORZE ENTRÉES SONT NOMMÉES — les neuf que la maquette dessine, et les cinq
 * qu'elle ne dessinait pas. Chacune par un texte DE LA MAQUETTE : les neuf par leur
 * libellé de rail, les cinq par le `data-screen-label` de leur planche.
 *
 * Le générateur refuse de produire un lien sans nom accessible (voir `markLinks`) ;
 * ce cas mesure le résultat de ce refus dans l'arbre d'accessibilité réel, où un
 * `aria-hidden` mal placé ou un `<svg>` bavard se verrait.
 */
test('les quinze entrées du rail portent un nom accessible, et seulement quinze', async ({
  page,
}) => {
  await visiter(page, '/admin/reglages');

  const liens = rail(page).getByRole('link');
  await expect(liens).toHaveCount(ENTREES.length);
  for (const { libelle, route } of ENTREES) {
    const entree = rail(page).getByRole('link', { name: libelle, exact: true });
    await expect(entree).toHaveCount(1);
    await expect(entree).toHaveAttribute('href', route);
  }
});

/**
 * LE DESSIN N'A PAS BOUGÉ — et c'est la moitié du contrat de ce mécanisme.
 *
 * Promouvoir un `<span>` en `<a>` apporte trois valeurs du navigateur que le
 * `<span>` n'avait pas : `color: -webkit-link`, `text-decoration: underline`,
 * `cursor: pointer`. Les deux premières CHANGERAIENT LE DESSIN — du bleu souligné
 * dans un rail vert foncé. `markLinks` les PRÉFIXE au style de la maquette pour que
 * celui-ci gagne ; ce cas mesure le résultat calculé par le navigateur, qui est le
 * seul juge.
 *
 * Les couleurs mesurées sont celles de la maquette, à l'identique : `#CBD5D1` pour
 * une entrée au repos, `#16211D` pour l'entrée active sur fond blanc. Aucune n'est
 * assombrie, et c'est vérifiable ici plutôt que relu.
 */
test('la promotion en lien ne change NI la couleur NI le soulignement du rail', async ({
  page,
}) => {
  /**
   * CE CAS A ÉTÉ CASSÉ PAR LE BRANCHEMENT DE L'API, pas par le rail, et la
   * distinction vaut d'être écrite : D04 est devenu une page CLIENTE. Sans réponse,
   * `EcranDonneesEquipe` affiche son refus — SANS RAIL — et le cas expirait sur un
   * `locator.evaluate` qui attendait une entrée jamais rendue. Le message de
   * Playwright (« Test timeout of 30000ms exceeded ») n'accusait rien de juste : on
   * aurait pu y lire un défaut de promotion de lien, alors que le lien allait bien
   * et que c'est l'ÉCRAN qui n'avait pas ses données.
   *
   * « un lien qui ne mène nulle part » et « un écran qui n'a pas ses données » sont
   * DEUX défauts différents. Servir la charge retire le second de l'équation, pour
   * que ce cas ne puisse plus parler que du premier — le dessin du rail.
   */
  await servirLesDonneesEquipe(page);
  await visiter(page, '/admin/moderation');

  const active = rail(page).getByRole('link', { name: 'Modération', exact: true });
  const repos = rail(page).getByRole('link', { name: 'Revenus', exact: true });

  const lu = async (l: typeof active): Promise<Record<string, string>> =>
    l.evaluate((n) => {
      const s = getComputedStyle(n as Element);
      return {
        color: s.color,
        decoration: s.textDecorationLine,
        cursor: s.cursor,
        height: s.height,
      };
    });

  const a = await lu(active);
  const r = await lu(repos);

  // Les couleurs de la maquette, intactes : rien n'est hérité, rien n'est assombri.
  expect(a.color).toBe('rgb(22, 33, 29)'); // #16211D — entrée active
  expect(r.color).toBe('rgb(203, 213, 209)'); // #CBD5D1 — entrée au repos
  // Aucun soulignement : la valeur par défaut d'un `<a>` est neutralisée.
  expect(a.decoration).toBe('none');
  expect(r.decoration).toBe('none');
  // Et le clic est ANNONCÉ, ce que le `<span>` ne faisait pas.
  expect(a.cursor).toBe('pointer');
  // La géométrie de la maquette ne bouge pas d'un pixel.
  expect(a.height).toBe('42px');
  expect(r.height).toBe('42px');
});

/**
 * ─── CHAQUE PAGE SURLIGNE SA PROPRE ENTRÉE ───────────────────────────────────
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LE DÉFAUT QUE CE CAS GÈLE EST LE PLUS TROMPEUR DU LOT : une page qui se  │
 * │ présentait SOUS LE NOM D'UNE AUTRE. `/admin/impact` (D16) surlignait     │
 * │ « Tableau de bord ». D07 s'annonçait « Parcours », D09 et D11            │
 * │ « Contenu », D13 « Revenus ». Cinq pages sur quinze.                     │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ON MESURE `aria-current="page"`, PAS LE FOND BLANC. Deux raisons, et la seconde
 * est la plus importante :
 *
 *   · viser `background: #fff` serait tester LE DESSIN, et le dessin vient de la
 *     maquette — un test qui le répète ne garde rien de plus que le transcodeur ;
 *   · `aria-current` est ce qu'un lecteur d'écran ANNONCE. C'est l'état, pas la
 *     peinture, et c'est ce que l'utilisateur reçoit.
 *
 * Le cas vérifie en plus que l'entrée surlignée est bien CELLE QUI MÈNE ICI, par
 * son `href` : une surbrillance posée sur la bonne entrée mais pointant ailleurs
 * serait un défaut de plus, invisible autrement.
 */
test.describe('la surbrillance du rail désigne la page où l’on se trouve', () => {
  for (const { url, attendu } of SURBRILLANCE) {
    test(`${url} surligne l’entrée qui mène à ${attendu}`, async ({ page }) => {
      await servirLesDonneesEquipe(page);
      await visiter(page, url);

      const courante = rail(page).locator('[aria-current="page"]');
      // EXACTEMENT UNE : zéro laisserait la page sans repère, deux la rendraient
      // ambiguë — et les deux passeraient un test qui se contenterait de « au moins une ».
      await expect(
        courante,
        'exactement une entrée du rail doit s’annoncer comme la page courante',
      ).toHaveCount(1);
      await expect(
        courante,
        `${url} doit surligner l’entrée qui mène à ${attendu}, pas celle d’une autre page`,
      ).toHaveAttribute('href', attendu);
    });
  }
});

/**
 * ─── RÈGLE DURE : AUCUNE PAGE D'ÉQUIPE N'EST INJOIGNABLE DEPUIS LE RAIL ──────
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ CE CAS NE COMPTE PAS JUSQU'À QUATORZE. Il compare deux ENSEMBLES —       │
 * │ les routes que `(admin)` SERT, et les destinations que le rail OFFRE.    │
 * │ C'est ce qui le fait tomber le jour où quelqu'un ajoute une seizième     │
 * │ page sans entrée : un compte, lui, resterait vert tant que le total      │
 * │ n'aurait pas bougé, et c'est précisément ainsi que cinq pages            │
 * │ orphelines ont tenu quinze rapports verts.                              │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * LES DEUX CÔTÉS SONT MESURÉS, PAS DÉCLARÉS :
 *
 *   · les routes viennent du SYSTÈME DE FICHIERS (`apps/web/src/app/(admin)/`),
 *     parce que c'est lui qui décide ce que Next sert. Une table recopiée ici ne
 *     verrait jamais une page ajoutée ;
 *   · les destinations viennent du DOM D'UNE PAGE SERVIE, pas de la déclaration du
 *     générateur. Un rail déclaré juste mais rendu faux — une injection qui
 *     échouerait en silence — tomberait donc ici.
 *
 * LA RÈGLE TOMBE DANS LES DEUX SENS, et le second compte autant : une entrée de
 * rail qui mènerait vers une route INEXISTANTE est un lien mort, et c'est tout ce
 * que ce dépôt a passé un lot à éliminer.
 */

/**
 * LES DEUX EXCEPTIONS, DÉCLARÉES ET JUSTIFIÉES — pas silencieuses.
 *
 *   · `/admin/connexion` (D01) : on ne navigue pas dans une console AVANT de s'y
 *     être authentifié. La maquette ne dessine d'ailleurs aucun rail sur ses trois
 *     cartes de 420 px, et `10-administration.mjs` porte `rail: false` pour elle.
 *     Une entrée « Connexion » dans le menu d'une session déjà ouverte serait un
 *     contresens.
 *   · `/admin/moderation/[id]` (D05) : c'est le DOSSIER d'un signalement, atteint
 *     depuis la file de modération. Ce n'est pas une rubrique — il n'y a pas de
 *     « dossier » en général, seulement le dossier #4812. Une entrée de menu
 *     devrait choisir un identifiant, donc inventer une donnée.
 *
 * Toute AUTRE page sans entrée est un défaut, et ce cas le dit.
 */
const SANS_ENTREE_DE_RAIL = [
  { route: '/admin/connexion', pourquoi: 'D01 — on ne navigue pas avant de s’authentifier' },
  { route: '/admin/moderation/[id]', pourquoi: 'D05 — le dossier est atteint depuis la file' },
] as const;

/** Les routes que `(admin)` sert, relevées sur le disque. */
function routesServies(): string[] {
  const racine = resolve(__dirname, '../src/app/(admin)');
  const trouvees: string[] = [];
  const descendre = (dossier: string, prefixe: string): void => {
    for (const e of readdirSync(dossier, { withFileTypes: true })) {
      if (e.isDirectory()) {
        // Les groupes de routes `(…)` ne paraissent pas dans l'URL.
        const segment = e.name.startsWith('(') && e.name.endsWith(')') ? '' : `/${e.name}`;
        descendre(resolve(dossier, e.name), `${prefixe}${segment}`);
      } else if (e.name === 'page.tsx') {
        trouvees.push(prefixe === '' ? '/' : prefixe);
      }
    }
  };
  descendre(racine, '');
  return trouvees.sort();
}

test('AUCUNE page d’équipe n’est injoignable depuis le rail', async ({ page }) => {
  const servies = routesServies();
  // Le relevé lui-même doit tenir : s'il ne trouve rien, le cas serait vert pour
  // rien. C'est le faux vert que ce dépôt a déjà payé trois fois.
  expect(servies.length, 'le relevé des routes de (admin) ne doit pas être vide').toBeGreaterThan(
    10,
  );

  const exceptions = new Set(SANS_ENTREE_DE_RAIL.map((e) => e.route));
  // Une exception qui ne correspond plus à aucune route servie est une exception
  // PÉRIMÉE : elle dispenserait une page qui n'existe plus, et masquerait la
  // suivante qui prendrait son nom.
  for (const { route, pourquoi } of SANS_ENTREE_DE_RAIL) {
    expect(servies, `exception périmée (${pourquoi}) : ${route} n’est plus servie`).toContain(route);
  }

  const doiventEtreJoignables = servies.filter((r) => !exceptions.has(r));

  // Les destinations telles que le NAVIGATEUR les reçoit, pas telles qu'on les a
  // déclarées : une injection qui échouerait en silence tomberait ici.
  await servirLesDonneesEquipe(page);
  await visiter(page, '/admin/reglages');
  const offertes = await rail(page)
    .locator('a[href]')
    .evaluateAll((liens) => liens.map((l) => new URL((l as HTMLAnchorElement).href).pathname));

  const manquantes = doiventEtreJoignables.filter((r) => !offertes.includes(r));
  expect(
    manquantes,
    'ces pages d’équipe existent et répondent, mais AUCUNE entrée du rail n’y mène. ' +
      'Ajouter leur entrée (clé « rail » dans tools/screens/10-administration.mjs) ou, ' +
      'si elles ne doivent pas en avoir, les déclarer dans SANS_ENTREE_DE_RAIL avec le pourquoi.',
  ).toEqual([]);

  // L'AUTRE SENS : une entrée qui mène vers une route que personne ne sert.
  const mortes = offertes.filter((r) => !servies.includes(r));
  expect(
    mortes,
    'ces entrées du rail mènent vers une route que (admin) ne sert pas : cliquer donnerait un 404.',
  ).toEqual([]);

  // Et aucune destination n'est offerte DEUX fois : deux entrées vers la même page
  // seraient un doublon que la surbrillance ne saurait pas trancher.
  expect(new Set(offertes).size, 'une destination ne doit paraître qu’une fois dans le rail').toBe(
    offertes.length,
  );
});

/**
 * ─── LE RAIL À QUATORZE ENTRÉES TIENT-IL DANS LE CADRE ? MESURÉ, PAS CALCULÉ ──
 *
 * L'arithmétique sur les styles déclarés dit que oui : colonne de 240 px, logo de
 * 64 px, nav à `padding:10px` + `gap:2px` + `margin-top:8px`, entrée de 42 px,
 * cadre de 980 px — donc nav = 20 + 14×42 + 13×2 = 634 px, et 64 + 8 + 634 = 706 px
 * pour 980 px de cadre.
 *
 * MAIS L'ARITHMÉTIQUE N'EST PAS UNE MESURE : elle suppose qu'aucune entrée ne passe
 * à la ligne, qu'aucun libellé ne déborde, et que `height:42px` n'est pas écrasé par
 * le contenu. « Bibliothèque d'étapes » est le libellé le plus long du rail — plus
 * long que les neuf d'origine — et c'est exactement le genre de chose qu'un calcul
 * ne voit pas. On DEMANDE DONC AU NAVIGATEUR.
 */
test('le rail à quinze entrées tient dans le cadre, à 1440 px', async ({ page }) => {
  await visiter(page, '/admin/reglages');

  const mesure = await rail(page).evaluate((nav) => {
    const n = nav as HTMLElement;
    const entrees = [...n.querySelectorAll(':scope > a')] as HTMLElement[];
    const colonne = n.parentElement as HTMLElement;
    const cadre = n.closest('[data-frame="desktop"]') as HTMLElement;
    return {
      entrees: entrees.length,
      hauteurNav: n.getBoundingClientRect().height,
      hauteurEntrees: entrees.map((e) => e.getBoundingClientRect().height),
      hauteurColonne: colonne.getBoundingClientRect().height,
      hauteurCadre: cadre.getBoundingClientRect().height,
      largeurColonne: colonne.getBoundingClientRect().width,
      basDuNav: n.getBoundingClientRect().bottom - cadre.getBoundingClientRect().top,
      // Un débordement se voit ici, et nulle part dans un calcul.
      debordeEnHauteur: n.scrollHeight > n.clientHeight + 1,
      // Chaque entrée sur UNE ligne : 42 px de haut, pas 62.
      surUneLigne: entrees.every((e) => Math.abs(e.getBoundingClientRect().height - 42) < 0.5),
    };
  });

  expect(mesure.entrees).toBe(ENTREES.length);
  // La géométrie de la maquette tient, entrée par entrée : aucune n'a grandi pour
  // contenir son libellé — c'est ce qui aurait cassé le calcul.
  expect(mesure.surUneLigne, 'une entrée a changé de hauteur pour contenir son libellé').toBe(true);
  expect(mesure.debordeEnHauteur, 'le rail déborde de lui-même').toBe(false);
  // ET LE RAIL TIENT DANS LE CADRE : c'est la question que l'arithmétique posait.
  expect(mesure.basDuNav).toBeLessThan(mesure.hauteurCadre);
  expect(mesure.largeurColonne).toBe(240);

  // Les chiffres sont imprimés : le rapport doit porter des MESURES, pas un calcul.
  console.log(
    `  rail à 1440 px — ${mesure.entrees} entrées · nav ${mesure.hauteurNav}px · ` +
      `bas du nav à ${mesure.basDuNav}px du haut du cadre · cadre ${mesure.hauteurCadre}px · ` +
      `colonne ${mesure.largeurColonne}px · débordement ${mesure.debordeEnHauteur}`,
  );
});
