import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * ─── LES SOUS-LIENS DU MODULE ACCUEIL, ÉPROUVÉS EN CLIQUANT ──────────────────
 *
 * Verbatim du porteur, en ouvrant le produit : « Aucun sous lien aussi ne
 * fonctionne. […] et tous les sous liens des pages. »
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ CE QUE LE COMPTEUR DU GÉNÉRATEUR NE VOYAIT PAS                             ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le récapitulatif « ── NAVIGATION ── » compte les `href="#"`. Il en comptait 85
 * sur ce module, et c'était la MOITIÉ du problème — pas la plus grosse. Mesuré
 * avant ce lot, sur les cadres produits :
 *
 *   · les dix-sept cadres MOBILES de cette maquette ne portaient pas UNE SEULE
 *     balise `<a>`. `grep -c '<a ' a01/mobile.generated.tsx` → 0. Le compteur y
 *     annonçait donc ZÉRO lien mort, sur des écrans où rien ne menait nulle part ;
 *   · la barre d'onglets BASSE — Accueil · Parcours · Entraide · Services ·
 *     Compte — est dessinée en `<div>`, dix-sept fois ;
 *   · les vingt-et-une barres d'onglets du réseau et de la fiche ville sont
 *     dessinées en `<span>`, sur l'ordinateur comme sur le téléphone.
 *
 * Ce ne sont pas des liens cassés : CE NE SONT PAS DES LIENS. Un test qui lirait
 * le JSX ne pourrait pas le dire, et une assertion sur un `href` non plus — c'est
 * exactement le piège que `navigation-rail.spec.ts` décrit : « un parent qui avale
 * le clic, un `pointer-events: none` ou un `preventDefault` passeraient tous ».
 *
 * CHAQUE CAS CI-DESSOUS PART D'UNE URL QUI N'EST PAS SA DESTINATION, CLIQUE, ET
 * VÉRIFIE L'URL OBTENUE. Le départ est affirmé avant le clic : sans cela, un lien
 * inerte passerait pour une navigation réussie.
 *
 * ── LES CHARGES SONT CELLES DU DÉPÔT ────────────────────────────────────────
 *
 * `packages/shared/src/__tests__/fixtures/` — les réponses relevées octet pour
 * octet que les tests unitaires emploient. Les écrans d'arrivée et de départ
 * lisent l'API ; sans leurs données, `ReseauScreen` affiche « Chargement du
 * réseau… » et le fil est vide, donc les contrôles n'existent pas. Les servir
 * retire la question des DONNÉES de l'équation : un rouge ici ne peut plus
 * signifier qu'un défaut de NAVIGATION.
 *
 * `__dirname` et non `import.meta.dirname` : Playwright transpile ses specs en
 * CommonJS, où `import.meta` échoue AU CHARGEMENT — et l'erreur se présente en
 * « No tests found », qui ne désigne pas la cause.
 */

const FIXTURES = resolve(__dirname, '../../../packages/shared/src/__tests__/fixtures');
const charge = (nom: string): string => readFileSync(resolve(FIXTURES, `${nom}.json`), 'utf8');
const objet = (nom: string): Record<string, unknown> =>
  JSON.parse(charge(nom)) as Record<string, unknown>;

/** Ce fichier pilote lui-même ses tailles : un seul projet suffit. */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, "piloté par le test");

/** Chaque cas pose sa propre taille et peut compiler une route froide : la borne
 * par défaut de 30 s est trop courte en `next dev`. Mesuré ailleurs dans ce dépôt. */
test.describe.configure({ timeout: 180_000 });

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ L'APOSTROPHE EST CELLE DE LA MAQUETTE, ET LES DEUX EXISTENT DANS CE DÉPÔT  ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Mesuré, pas supposé : le fil d'Ariane de A02 et la barre d'onglets de A01
 * écrivent « Fil d'actualité » avec l'apostrophe DROITE (U+0027) — `od -c` sur le
 * cadre produit le dit — alors que le reste du dépôt écrit la COURBE (U+2019), et
 * que `BUTTON_ACTIONS` documente justement l'inverse pour ses libellés.
 *
 * Deux cas de ce fichier ont échoué pour cette seule raison, sur un message qui ne
 * la nomme pas (« locator resolved to 0 elements »). Le motif accepte donc les
 * deux : un test de navigation n'a pas à trancher une question de typographie, et
 * la trancher dans un sens le rendrait faux le jour où le designer change d'avis.
 */
const FIL_ACTUALITE = /Fil d['’]actualité/;

/**
 * `Access-Control-Allow-Origin: *` NE MARCHE PAS : le socle envoie
 * `credentials: 'include'`, et pour une requête créditée le navigateur refuse le
 * joker. On renvoie l'origine de la requête plutôt qu'un port en dur — `WEB_PORT`
 * change d'un arbre de travail à l'autre. Même note que `modales.spec.ts`.
 */
const entetes = (route: Route): Record<string, string> => ({
  'access-control-allow-origin': route.request().headers()['origin'] ?? '*',
  'access-control-allow-credentials': 'true',
});

const servir = (body: string) => (route: Route) =>
  route.fulfill({ status: 200, contentType: 'application/json', headers: entetes(route), body });

/**
 * ── LA REPRISE DE SESSION RÉUSSIT, ET IL FAUT QU'ELLE RÉUSSISSE ─────────────
 *
 * `(app)/layout.tsx` pose `GardeSession`, qui renvoie vers la connexion dès que la
 * reprise a ÉCHOUÉ. Un test de navigation qui laisserait échouer la reprise
 * mesurerait donc une redirection vers `/connexion` en croyant mesurer un lien
 * mort — le pire des deux rouges, celui qui accuse le bon code.
 *
 * On sert donc un jeton, comme `shell.spec.ts` le fait. Ce n'est pas une session
 * réelle et ces tests n'en ont pas besoin : ce qu'ils éprouvent est le CLIC et
 * l'URL, pas l'authentification, qui est éprouvée par `garde-session.spec.ts` et
 * `code-otp.spec.ts` sur une vraie chaîne.
 */
async function servirTout(page: Page): Promise<void> {
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LE FOURRE-TOUT D'ABORD, LES ROUTES PRÉCISES ENSUITE                      ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Playwright donne la main au DERNIER motif inscrit : un fourre-tout sur
   * l'ensemble de `/v1/` posé APRÈS une route précise l'avale, et c'est ce qui a
   * donné douze tests verts à un autre lot dans une fenêtre de course.
   *
   * (Le motif ne s'écrit pas dans ce commentaire : il contient la séquence qui
   * FERME un bloc de commentaire. Écrit tel quel, il a transformé ce fichier en
   * `ReferenceError: v1 is not defined` sur onze cas — un échec de 123 ms qui ne
   * désigne pas sa cause. Mesuré, pas supposé.)
   *
   * CE FOURRE-TOUT N'EST PAS UNE COMMODITÉ : il garantit qu'AUCUN appel ne part
   * vers une vraie API. Sans lui, un écran d'arrivée qui demande une route non
   * interceptée la demande au serveur qui écoute — qui peut être celui d'un
   * voisin, sur une autre base que celle du navigateur. Le symptôme serait alors
   * un succès qui ne prouve rien.
   *
   * `503` et non `401` : un `401` déclencherait la reprise de session et la garde.
   */
  await page.route('**/v1/**', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      headers: entetes(route),
      body: '{"error":{"code":"HORS_TEST","message":"Appel non intercepté par cette spec."}}',
    }),
  );
  await page.route('**/v1/auth/refresh', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: entetes(route),
      body: JSON.stringify({ accessToken: 'jeton-de-test', isNewUser: false }),
    }),
  );

  /**
   * `onlineContacts` est VIDE dans la charge relevée. On y place deux membres pris
   * dans `newArrivals` de la MÊME charge — des `memberSummary` réels — sinon la
   * colonne de droite n'a personne à montrer. Même retouche que `modales.spec.ts`,
   * et au même endroit : dans le test, jamais dans la fixture.
   */
  const colonne = objet('feed_sidebar');
  const arrivants = (colonne['newArrivals'] as { items: unknown[] }).items;
  const sidebar = JSON.stringify({ ...colonne, onlineContacts: arrivants.slice(0, 2) });

  // L'ORDRE DES `page.route` EST L'INVERSE DE L'ENREGISTREMENT : Playwright donne
  // la main au DERNIER motif inscrit. Les motifs précis vont donc APRÈS les
  // fourre-tout, sinon le fourre-tout les avale. C'est ce qui a donné douze tests
  // verts à un autre lot, dans une fenêtre de course.
  /**
   * `GET /me` est demandé par le socle dès qu'une session existe. Sans
   * interception, il partait vers la sonde de l'API et revenait en 599 — ce qui
   * n'a fait tomber aucun cas, mais laissait dans le journal un refus qui ferait
   * chercher le défaut au mauvais endroit. La sonde le signale (« APPEL NON
   * INTERCEPTÉ »), et c'est ainsi qu'il a été vu.
   */
  await page.route('**/v1/me', servir(charge('compte_me')));
  await page.route('**/v1/feed*', servir(charge('feed')));
  await page.route('**/v1/feed/sidebar*', servir(sidebar));
  await page.route('**/v1/stories*', servir(charge('stories_band')));
  await page.route('**/v1/comments*', servir(charge('comments')));
  await page.route('**/v1/posts/**', servir(charge('post_detail')));
  await page.route('**/v1/guides*', servir(charge('guides_list')));
  await page.route('**/v1/guides/**', servir(charge('guide_detail')));
  await page.route('**/v1/communities*', servir(charge('communities_list')));
  await page.route('**/v1/communities/*', servir(charge('community_detail_membre')));
  await page.route('**/v1/communities/*/topics*', servir(charge('community_topics')));
  await page.route('**/v1/communities/*/members*', servir(charge('community_members')));
  await page.route('**/v1/communities/*/feed*', servir(charge('community_feed')));
  await page.route('**/v1/communities/*/albums*', servir(charge('community_albums')));
  await page.route('**/v1/communities/*/map*', servir(charge('community_map')));
}

/**
 * Pose la page, attend le CADRE, puis attend que REACT L'AIT HYDRATÉ.
 *
 * `domcontentloaded` et NON `networkidle` : ces écrans émettent plusieurs requêtes
 * et Next précharge les liens visibles d'une page App Router — le réseau ne
 * retombe jamais au calme, et `networkidle` expire au bout de trente secondes sur
 * un message qui ne nomme pas la cause.
 *
 * ── L'ATTENTE D'HYDRATATION EST EMPRUNTÉE À `e2e/sous-liens.spec.ts` ─────────
 *
 * Elle y est motivée par une mesure que ce fichier n'avait pas faite : depuis que
 * les cadres sont SERVIS, les contrôles EXISTENT dans le HTML avant de
 * FONCTIONNER, et un clic sur un `<button>` pas encore hydraté tombe dans le vide
 * SANS ERREUR. Les sous-liens de ce fichier sont des `<a href>`, donc ils
 * navigueraient même sans hydratation — mais les DÉCLENCHEURS de modale, eux, sont
 * des `<button>`, et le cas qui mesure leur police les touche. On attend donc,
 * plutôt que de dépendre de l'ordre dans lequel le navigateur a fini.
 *
 * `__reactFiber$…` est la clé que React pose sur un nœud dont il a pris la charge :
 * c'est le seul signal d'hydratation qui ne demande pas d'ajouter un marqueur au
 * produit pour les besoins d'un test.
 */
async function visiter(page: Page, url: string, largeur: number): Promise<void> {
  await page.setViewportSize({ width: largeur, height: largeur >= 1024 ? 1000 : 844 });
  await servirTout(page);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-screen]').first().waitFor({ state: 'attached' });
  await page.waitForFunction(() => {
    const cadre = document.querySelector('[data-screen]');
    return cadre !== null && Object.keys(cadre).some((k) => k.startsWith('__reactFiber$'));
  });
}

/** Le cadre VISIBLE à cette largeur : les deux sont dans le document. */
const cadre = (page: Page, largeur: number) =>
  page.locator(largeur >= 1024 ? '[data-frame="desktop"]' : '[data-frame="mobile"]');

/**
 * LE CŒUR DE CE FICHIER : partir d'ailleurs, cliquer, et lire l'URL obtenue.
 *
 * `toHaveURL` et NON `waitForURL` : ce dernier attend l'état `load` de la page
 * d'arrivée, que `next dev` ne produit jamais (il garde une connexion ouverte).
 * `toHaveURL` scrute `page.url()` sans rien attendre du réseau.
 *
 * L'ANCRE AVANT LA MESURE n'est pas un ornement : `boundingBox()` n'a aucune
 * attente intégrée, et un contrôle qui arrive après `GET /me` ferait conclure
 * « le lien n'est pas rendu ». `expect(lien).toHaveCount(1)` attend, lui.
 */
async function cliquerEtVerifier(
  page: Page,
  depart: string,
  largeur: number,
  nom: string | RegExp,
  arrivee: string,
  options: { readonly dans?: string; readonly ignorerVue?: boolean } = {},
): Promise<void> {
  await visiter(page, depart, largeur);
  const avant = new URL(page.url());
  expect(`${avant.pathname}${avant.search}`, 'le départ doit être l’URL demandée').toBe(depart);
  expect(depart, 'le départ ne peut pas être l’arrivée').not.toBe(arrivee);

  const racine = options.dans === undefined ? cadre(page, largeur) : cadre(page, largeur).locator(options.dans);
  const lien = racine.getByRole('link', { name: nom, exact: typeof nom === 'string' }).first();
  await expect(lien, 'l’affordance doit être un LIEN, pas un <span> ni un <div>').toHaveCount(1);
  await lien.click();
  /**
   * LA BORNE EST LARGE, ET C'EST MESURÉ AILLEURS : en `next dev`, la PREMIÈRE
   * compilation d'une route peut prendre plus d'une minute, et l'URL ne change
   * qu'une fois la charge de la route d'arrivée reçue. Avec les 5 s par défaut, un
   * cas passe sur route chaude et échoue sur route froide — un test intermittent,
   * donc un test qu'on finit par ne plus lire. La borne ne masque rien : un clic
   * inerte n'arrive JAMAIS, quelle que soit l'attente.
   */

  if (options.ignorerVue === true) {
    /**
     * VAGUE 5 — `?vue=proprietaire` EST UN PARAMÈTRE MORT. La page ne le lit plus : la vue
     * de gestion suit le rôle que la fiche du réseau porte (`myRole`), pas l'URL (voir
     * `app/(app)/reseaux/[slug]/page.tsx`). Les planches d'onglets de la maquette
     * l'écrivent pourtant encore dans leurs liens ; l'attente « l'adresse d'arrivée n'en
     * porte pas » décrivait l'ancien mécanisme. Ces cas mesurent donc ce qui compte —
     * le chemin et l'onglet —, sans figer un paramètre ignoré.
     */
    await expect
      .poll(
        () => {
          const u = new URL(page.url());
          u.searchParams.delete('vue');
          return `${u.pathname}${u.search}`;
        },
        { timeout: 120_000 },
      )
      .toBe(arrivee);
    return;
  }
  await expect(page).toHaveURL(arrivee, { timeout: 120_000 });
  const apres = new URL(page.url());
  expect(`${apres.pathname}${apres.search}`).toBe(arrivee);
}

// ═══ 1 · LA BARRE D'ONGLETS BASSE — dessinée en <div>, dix-sept fois ═════════

/**
 * ── LA BOUCLE ET LE LITTÉRAL, DEUX ÉCRITURES POUR UNE SEULE BARRE ───────────
 *
 * Le cadre mobile de A01 écrit sa barre en BOUCLE (`<sc-for list="{{ mBottom }}"
 * as="b">`) : une entrée de maquette, cinq au rendu, et la destination voyage avec
 * la donnée. Les seize autres cadres l'écrivent EN CLAIR. Les deux écritures sont
 * éprouvées, parce qu'elles passent par deux chemins différents du générateur et
 * qu'une seule des deux pourrait casser.
 */
const BARRE_BASSE = [
  { libelle: 'Parcours', route: '/parcours' },
  { libelle: 'Entraide', route: '/entraide' },
  { libelle: 'Services', route: '/services/logement' },
] as const;

test.describe('la barre d’onglets BASSE navigue — cadre mobile, 390 px', () => {
  for (const { libelle, route } of BARRE_BASSE) {
    test(`A01 (boucle) — « ${libelle} » → ${route}`, async ({ page }) => {
      await cliquerEtVerifier(page, '/accueil', 390, libelle, route);
    });
  }

  /**
   * « Accueil » part d'AILLEURS, sinon le départ serait l'arrivée et le cas ne
   * prouverait rien. `/guides` écrit sa barre EN CLAIR : ce cas éprouve donc
   * l'autre des deux écritures.
   */
  test('A03 (littéral) — « Accueil » → /accueil', async ({ page }) => {
    await cliquerEtVerifier(page, '/guides', 390, 'Accueil', '/accueil');
  });

  test('A07 (littéral) — « Entraide » → /entraide', async ({ page }) => {
    await cliquerEtVerifier(page, '/reseaux', 390, 'Entraide', '/entraide');
  });

  test('A12 (littéral) — « Parcours » → /parcours', async ({ page }) => {
    await cliquerEtVerifier(page, '/villes/lyon', 390, 'Parcours', '/parcours');
  });

  test('A08T (littéral) — « Services » → /services/logement', async ({ page }) => {
    await cliquerEtVerifier(
      page,
      '/reseaux/pays-bj?onglet=fil',
      390,
      'Services',
      '/services/logement',
    );
  });

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ « COMPTE » N'EST PAS UN LIEN, ET C'EST UN REFUS, PAS UN OUBLI             ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Il n'existe AUCUNE route `/compte` : `app/(app)/compte/` n'a que des
   * sous-pages. Choisir laquelle EST « Compte » serait décider à la place du
   * porteur — même manque que le bouton « Réglages » du bas du rail, déjà remonté.
   *
   * CE CAS EXISTE POUR QUE LE REFUS SOIT TENU PAR UN TEST, et non seulement écrit
   * dans un commentaire : si quelqu'un lui donne une destination un jour, ce sera
   * une décision, pas une dérive — et ce test la lui fera nommer.
   */
  test('« Compte » mène à /compte, qui redirige vers le profil (K01)', async ({ page }) => {
    /**
     * ATTENTE RETOURNÉE PAR DÉCISION. Ce cas disait « aucune route /compte n'existe » et
     * épinglait le manque (« le jour où le porteur tranche, ce cas rougira »). Il a
     * tranché : `app/(app)/compte/page.tsx` existe, et « Compte » est un lien comme les
     * quatre autres entrées de la barre basse. `/compte` redirige côté serveur vers le profil
     * (K01), première planche du module : c'est donc `/compte/profil` qu'on atteint.
     */
    await cliquerEtVerifier(page, '/accueil', 390, 'Compte', '/compte/profil');
  });
});

// ═══ 2 · LA BARRE D'ONGLETS DE SECTION du fil — sept pastilles en <span> ════

/**
 * Les sept entrées mènent aux SEPT MÊMES PAGES que le panneau « COMMUNAUTÉ » de
 * l'ordinateur. « Fil d'actualité » mène à `/accueil`, qui EST le départ : il est
 * donc vérifié comme lien et non comme navigation, et c'est dit.
 */
/**
 * VAGUE 5 — TROIS PASTILLES ONT QUITTÉ LA BARRE, PAR DÉCISION DU PORTEUR (2026-10-11,
 * `screens/a01/data.ts`, « TROIS ENTRÉES RETIRÉES ») : « Retire parrainage, fil d'entraide
 * et événements du sous-menu d'Accueil. C'est déjà dans entraide et événements. » La barre
 * de section de A01 n'offre plus que Guides, Réseaux et Villes (et « Fil d'actualité », ci-
 * dessous). Les trois autres destinations restent atteignables par la barre basse (Entraide)
 * et le rail (Agenda) ; l'absence des pastilles est éprouvée plus bas.
 */
const ONGLETS_SECTION = [
  { libelle: 'Guides', route: '/guides' },
  { libelle: 'Réseaux', route: '/reseaux' },
  { libelle: 'Villes', route: '/villes' },
] as const;

test.describe('la barre d’onglets DE SECTION navigue — cadre mobile de A01', () => {
  for (const { libelle, route } of ONGLETS_SECTION) {
    test(`« ${libelle} » → ${route}`, async ({ page }) => {
      await cliquerEtVerifier(page, '/accueil', 390, new RegExp(`^${libelle}`), route);
    });
  }

  /**
   * « Entraide » porte un COMPTEUR dans sa pastille — « Entraide 12 » — donc son
   * nom accessible n'est pas exactement « Entraide ». Le viser par un nom exact
   * aurait attrapé l'entrée de la barre BASSE, qui mène au même endroit : le test
   * serait passé en mesurant l'autre contrôle. On le vise donc par son compteur,
   * qui est ce qui le distingue.
   */
  test('« Parrainage », « Entraide 12 » et « Événements » ne sont plus dans la barre de section', async ({
    page,
  }) => {
    await visiter(page, '/accueil', 390);
    const barre = cadre(page, 390);
    // Ni la pastille de parrainage, ni celle des événements, ni « Entraide » AVEC son compteur
    // (la barre BASSE porte « Entraide » sans compteur : elle n'est pas concernée).
    await expect(barre.getByRole('link', { name: /^Parrainage/ })).toHaveCount(0);
    await expect(barre.getByRole('link', { name: /^Événements/ })).toHaveCount(0);
    await expect(barre.getByRole('link', { name: /Entraide\s*\d+/ })).toHaveCount(0);
  });

  test('« Fil d’actualité » est devenu un LIEN vers /accueil (navigation non mesurable : départ = arrivée)', async ({
    page,
  }) => {
    await visiter(page, '/accueil', 390);
    const lien = cadre(page, 390).getByRole('link', { name: FIL_ACTUALITE }).first();
    await expect(lien).toHaveCount(1);
    await expect(lien).toHaveAttribute('href', '/accueil');
  });
});

// ═══ 3 · LES ONGLETS DU RÉSEAU — vingt-et-une barres en <span> ══════════════

/**
 * `/reseaux/:slug` choisit son onglet par `?onglet=`, et `SLUGS` dans
 * `reseau-screen.tsx` donne les six noms. La destination déclarée est RELATIVE
 * (`?onglet=fil`) : le slug du réseau n'est dessiné dans aucune de ces planches et
 * n'est pas dans leur prise, donc une adresse absolue demanderait de l'inventer.
 * Ces cas vérifient que la résolution relative garde bien le chemin.
 */
const ONGLETS_RESEAU = [
  { libelle: 'Fil', onglet: 'fil' },
  { libelle: 'Événements', onglet: 'evenements' },
  { libelle: 'Membres', onglet: 'membres' },
  { libelle: 'Album', onglet: 'album' },
  { libelle: 'À propos', onglet: 'a-propos' },
] as const;

test.describe('les onglets du RÉSEAU naviguent — 1440 px', () => {
  /** A08 écrit sa barre en BOUCLE (`netTabs`) : une entrée, six destinations. */
  for (const { libelle, onglet } of ONGLETS_RESEAU) {
    test(`A08 (boucle) — « ${libelle} » → ?onglet=${onglet}`, async ({ page }) => {
      await cliquerEtVerifier(
        page,
        '/reseaux/pays-bj?onglet=sujets',
        1440,
        libelle,
        `/reseaux/pays-bj?onglet=${onglet}`,
      );
    });
  }

  /** Les douze planches A08T écrivent la leur EN CLAIR : l'autre chemin. */
  test('A08T (littéral) — depuis l’onglet « Fil », « Membres » → ?onglet=membres', async ({
    page,
  }) => {
    await cliquerEtVerifier(
      page,
      '/reseaux/pays-bj?onglet=fil',
      1440,
      'Membres',
      '/reseaux/pays-bj?onglet=membres',
      { ignorerVue: true },
    );
  });

  test('A08T (littéral) — « Sujets » revient sur A08', async ({ page }) => {
    await cliquerEtVerifier(
      page,
      '/reseaux/pays-bj?onglet=album',
      1440,
      'Sujets',
      '/reseaux/pays-bj?onglet=sujets',
    );
  });

  /**
   * ── LA VUE PROPRIÉTAIRE GARDE SA VUE, SAUF SUR « SUJETS » ─────────────────
   *
   * `PROPRIETAIRE` n'a AUCUNE entrée `sujets` — la maquette ne dessine pas de
   * planche « Sujets — propriétaire ». Avec `?onglet=sujets&vue=proprietaire`,
   * l'écran rendrait `null` : une page BLANCHE. Le lien mène donc à `?onglet=sujets`
   * tout court, la seule vue « Sujets » dessinée. Les deux cas sont tenus ici pour
   * que ce compromis soit une décision et non une dérive.
   */
  test('A08T propriétaire — « Album » garde &vue=proprietaire', async ({ page }) => {
    await cliquerEtVerifier(
      page,
      '/reseaux/pays-bj?onglet=fil&vue=proprietaire',
      1440,
      'Album',
      '/reseaux/pays-bj?onglet=album&vue=proprietaire',
    );
  });

  test('A08T propriétaire — « Sujets » LAISSE la vue, faute de planche', async ({ page }) => {
    await cliquerEtVerifier(
      page,
      '/reseaux/pays-bj?onglet=fil&vue=proprietaire',
      1440,
      'Sujets',
      '/reseaux/pays-bj?onglet=sujets',
    );
  });
});

test.describe('les onglets du RÉSEAU naviguent aussi au doigt — 390 px', () => {
  test('A08 mobile (boucle) — « Membres » → ?onglet=membres', async ({ page }) => {
    await cliquerEtVerifier(
      page,
      '/reseaux/pays-bj?onglet=sujets',
      390,
      'Membres',
      '/reseaux/pays-bj?onglet=membres',
    );
  });

  test('A08T mobile (littéral) — « Album » → ?onglet=album', async ({ page }) => {
    await cliquerEtVerifier(
      page,
      '/reseaux/pays-bj?onglet=fil',
      390,
      'Album',
      '/reseaux/pays-bj?onglet=album',
      { ignorerVue: true },
    );
  });
});

// ═══ 4 · LES ONGLETS DE LA FICHE VILLE ══════════════════════════════════════

const ONGLETS_VILLE = [
  { libelle: 'Bons plans', onglet: 'bons-plans' },
  { libelle: 'Produits du pays', onglet: 'produits' },
  { libelle: 'Témoignages', onglet: 'temoignages' },
] as const;

test.describe('les onglets de la FICHE VILLE naviguent', () => {
  /** A12 part de « Budgets réels », l'onglet que son cadre complet dessine. */
  for (const { libelle, onglet } of ONGLETS_VILLE) {
    test(`A12 (1440 px) — « ${libelle} » → ?onglet=${onglet}`, async ({ page }) => {
      await cliquerEtVerifier(page, '/villes/lyon', 1440, libelle, `/villes/lyon?onglet=${onglet}`);
    });
  }

  test('A12T (1440 px) — « Budgets réels » revient sur A12', async ({ page }) => {
    await cliquerEtVerifier(
      page,
      '/villes/lyon?onglet=bons-plans',
      1440,
      'Budgets réels',
      '/villes/lyon?onglet=budgets',
    );
  });

  test('A12 mobile (390 px) — « Témoignages » → ?onglet=temoignages', async ({ page }) => {
    await cliquerEtVerifier(
      page,
      '/villes/lyon',
      390,
      'Témoignages',
      '/villes/lyon?onglet=temoignages',
    );
  });

  test('A12T mobile (390 px) — « Produits du pays » → ?onglet=produits', async ({ page }) => {
    await cliquerEtVerifier(
      page,
      '/villes/lyon?onglet=bons-plans',
      390,
      'Produits du pays',
      '/villes/lyon?onglet=produits',
    );
  });
});

// ═══ 5 · LES TROIS LIENS QUE LE COMPTEUR VOYAIT ═════════════════════════════

test.describe('les href="#" qui ont reçu leur destination', () => {
  test('A01 — « Voir tout » des événements → /agenda', async ({ page }) => {
    await cliquerEtVerifier(page, '/accueil', 1440, 'Voir tout', '/agenda');
  });

  test('A02 — le fil d’Ariane « Fil d’actualité » → /accueil', async ({ page }) => {
    await cliquerEtVerifier(page, '/publications/p-1', 1440, FIL_ACTUALITE, '/accueil');
  });

  /**
   * A03 — « Lire le guide » mène au SLUG QUE L'API REND, pas à une adresse
   * composée du titre. Le test lit donc le slug dans la charge servie : si le
   * convertisseur se mettait à fabriquer l'adresse autrement, ce cas tomberait.
   */
  test('A03 — « Lire le guide » mène au guide de la charge servie', async ({ page }) => {
    const premier = (objet('guides_list')['items'] as { slug: string }[])[0];
    expect(premier, 'la charge doit porter au moins un guide').toBeDefined();
    await cliquerEtVerifier(page, '/guides', 1440, 'Lire le guide', `/guides/${premier!.slug}`);
  });

  /**
   * ── CE QUE LE CADRE MOBILE DE A03 NE PEUT PAS FAIRE, ET POURQUOI ───────────
   *
   * Sa carte de guide ne porte AUCUN libellé : la carte ENTIÈRE est l'affordance,
   * un `<div>` qui contient le titre, la date et l'extrait. `markLinks` remonte du
   * marqueur jusqu'au PREMIER élément promouvable, qui est le `<div>` du titre —
   * promouvoir celui-là déplacerait la zone cliquable sans rien dire. Le mécanisme
   * ne sait pas désigner un CONTENEUR, et l'inventer sortirait du périmètre.
   * REMONTÉ ; ce cas tient le constat pour qu'il ne se perde pas.
   */
  test('A03 mobile — la carte entière est un LIEN vers le guide', async ({ page }) => {
    /**
     * ATTENTE RETOURNÉE. La carte mobile « restait SANS lien : le mécanisme ne promeut pas
     * un conteneur » — un manque mesuré, pas une règle. Il est comblé : le titre porte
     * maintenant le lien du guide, comme « Lire le guide » sur ordinateur. Le cas exige
     * donc la destination, celle du guide de la charge servie.
     */
    await visiter(page, '/guides', 390);
    const premier = (objet('guides_list')['items'] as { title: string; slug: string }[])[0];
    expect(premier?.title ?? '').not.toBe('');
    const lien = cadre(page, 390).getByRole('link', { name: premier!.title }).first();
    await expect(lien).toHaveCount(1);
    await expect(lien).toHaveAttribute('href', `/guides/${premier!.slug}`);
  });
});

// ═══ 6 · LA PROMOTION NE DÉPLACE PAS UN PIXEL ═══════════════════════════════

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE DÉFAUT DE `markTriggers` QUE CES CAS TIENNENT, ET CE N'EST PAS CELUI    ║
 * ║ QUE TROIS LOTS ONT DÉCRIT                                                  ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Promouvoir un `<span>` en `<button>` demande de neutraliser ce qu'un bouton
 * apporte — bordure, remplissage, police. `markTriggers` SUFFIXAIT cette
 * neutralisation, et c'était le défaut. Trois lots l'ont signalé en nommant
 * `padding: 0` comme le coupable. LA MESURE LE DÉMENT : le coupable principal est
 * `font: inherit`.
 *
 * `font` est un RACCOURCI CSS, et un objet de style React s'applique DANS L'ORDRE
 * DES CLÉS. Suffixé, `font: inherit` remet donc à l'hérité la TAILLE et la
 * GRAISSE que le designer avait posées juste avant. Relevé sur les cadres, avant
 * correction : six contrôles perdaient leur police — 12,5 px/700 sur le
 * « Contribuer » de A12 et sur une feuille de J07, 13 px/700 sur les trois
 * planches de A12T, 13,5 px/700 sur J08. Le `padding`, lui, ne mordait que sur
 * quatre d'entre eux.
 *
 * ET AUCUN ORACLE QUI COMPARE DES ENSEMBLES DE PAIRES NE PEUT LE VOIR : les clés
 * et les valeurs sont IDENTIQUES avant et après, seul l'ordre change. C'est pour
 * cela que ces cas mesurent la police CALCULÉE PAR LE NAVIGATEUR : lui applique
 * le raccourci.
 */
test.describe('la promotion d’un <span> en bouton rend sa POLICE au designer', () => {
  const contribuer = (page: Page) =>
    page.locator('[data-frame="desktop"] [data-modal-open="A12C"]').first();

  /** Ce que le navigateur calcule vraiment pour ce contrôle. */
  const dessin = (page: Page) =>
    contribuer(page).evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        taille: s.fontSize,
        graisse: s.fontWeight,
        remplissage: `${s.paddingTop} ${s.paddingRight} ${s.paddingBottom} ${s.paddingLeft}`,
        fond: s.backgroundColor,
        couleur: s.color,
        rayon: s.borderTopLeftRadius,
      };
    });

  test('A12 — « Contribuer » : 12.5px / 700, remplissage 0 14px, et rien d’autre ne bouge', async ({
    page,
  }) => {
    await visiter(page, '/villes/lyon', 1440);
    await expect(contribuer(page)).toHaveCount(1);
    const d = await dessin(page);
    // LA POLICE DU DESIGNER — c'est elle que le suffixe effaçait.
    expect(d.taille).toBe('12.5px');
    expect(d.graisse).toBe('700');
    // Le remplissage, l'autre moitié du défaut.
    expect(d.remplissage).toBe('0px 14px 0px 14px');
    // ET CE QUI NE DOIT PAS AVOIR BOUGÉ : le fond vert de la maquette, le texte
    // blanc, le rayon. « N'assombrie pas » est une règle dure du porteur.
    expect(d.fond).toBe('rgb(22, 120, 94)'); // #16785E
    expect(d.couleur).toBe('rgb(255, 255, 255)');
    expect(d.rayon).toBe('999px');
    const boite = await contribuer(page).boundingBox();
    expect(boite).not.toBeNull();
    if (boite !== null) expect(Math.round(boite.height)).toBe(36);
  });

  test('A12T — « Contribuer » : 13px / 700, remplissage 0 16px', async ({ page }) => {
    await visiter(page, '/villes/lyon?onglet=bons-plans', 1440);
    await expect(contribuer(page)).toHaveCount(1);
    const d = await dessin(page);
    expect(d.taille).toBe('13px');
    expect(d.graisse).toBe('700');
    expect(d.remplissage).toBe('0px 16px 0px 16px');
    expect(d.fond).toBe('rgb(22, 120, 94)');
    expect(d.couleur).toBe('rgb(255, 255, 255)');
    const boite = await contribuer(page).boundingBox();
    expect(boite).not.toBeNull();
    if (boite !== null) expect(Math.round(boite.height)).toBe(38);
  });

  /**
   * ET LES DEUX ICÔNES DU COMPOSEUR, QUI N'AVAIENT RIEN À PERDRE.
   *
   * A01G et A01S sont deux `<span>` promus par ce lot, et la maquette ne leur
   * déclare NI taille NI graisse — rien à rendre, donc. Ce cas mesure l'autre
   * moitié de la promotion : `font: inherit`, posé en PREMIER, fait hériter la
   * police de la page au lieu de laisser le navigateur imposer celle d'un bouton.
   * Sans lui, les deux icônes passeraient en police système.
   */
  test('A01G et A01S héritent la police de la page, pas celle d’un bouton', async ({ page }) => {
    await visiter(page, '/accueil', 1440);
    for (const nom of ['A01G', 'A01S']) {
      const b = page.locator(`[data-frame="desktop"] [data-modal-open="${nom}"]`).first();
      await expect(b, nom).toHaveCount(1);
      const police = await b.evaluate((el) => {
        const s = getComputedStyle(el);
        return { famille: s.fontFamily, geometrie: `${el.clientWidth}x${el.clientHeight}` };
      });
      expect(police.famille, nom).toContain('Jakarta');
      // 36 × 36 : la géométrie que la maquette dessine pour ces deux ronds.
      expect(police.geometrie, nom).toBe('36x36');
    }
  });

  /**
   * ET LA PROMOTION EN LIEN NE DÉCOLORE RIEN.
   *
   * `markLinks` préfixe `color:inherit` : la couleur de la maquette, déclarée
   * APRÈS, gagne. Sans ce sens, un onglet actif de la fiche ville passerait du vert
   * foncé de la maquette au bleu de lien du navigateur, et le porteur a une règle
   * dure là-dessus — « N'assombrie pas », et à plus forte raison ne recolore pas.
   */
  test('un onglet promu en lien garde la couleur de la maquette', async ({ page }) => {
    await visiter(page, '/villes/lyon', 1440);
    const actif = cadre(page, 1440).getByRole('link', { name: 'Budgets réels', exact: true }).first();
    await expect(actif).toHaveCount(1);
    const style = await actif.evaluate((el) => {
      const s = getComputedStyle(el);
      return { couleur: s.color, soulignement: s.textDecorationLine, curseur: s.cursor };
    });
    // #0F5C48 — la couleur que la maquette donne à l'onglet actif.
    expect(style.couleur).toBe('rgb(15, 92, 72)');
    expect(style.soulignement).toBe('none');
    expect(style.curseur).toBe('pointer');
  });
});
