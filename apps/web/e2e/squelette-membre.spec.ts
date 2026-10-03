import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * ─── LE SQUELETTE MEMBRE CLIQUE-T-IL ? MESURÉ AU NAVIGATEUR ─────────────────
 *
 * CE QUE CE FICHIER EXISTE POUR EMPÊCHER, et ce n'est pas une précaution de
 * principe : le porteur a ouvert le produit et a écrit « Aucun lien ne marche sur
 * la page d'accueil ? », puis « Accueil, Parcours, Entraide, Services, Agenda :
 * sont des liens à faire ». Les 207 `href="#"` du produit avaient tenu quinze
 * rapports verts parce que TOUS les tests du dépôt visitent les écrans EN TAPANT
 * L'URL, jamais en cliquant.
 *
 * Une assertion sur un `href` ne prouverait rien de plus qu'une lecture du JSX :
 * elle passe si le lien ne mène nulle part, et elle passe si le squelette n'est
 * pas rendu du tout. On CLIQUE donc, depuis un écran qui n'est PAS la destination,
 * et on lit l'URL après coup.
 *
 * ── LES DEUX FORMES DE RAIL SONT ÉPROUVÉES SÉPARÉMENT ──────────────────────
 *
 * La maquette en dessine deux, et c'est tout l'enjeu du lot :
 *
 *   · 13 cadres portent le rail EN BOUCLE (`03 Accueil v2.dc.html`) :
 *     `<sc-for list="{{ rail }}" as="r">` n'écrit QU'UN `<a href="#">` pour cinq
 *     entrées au rendu, et son libellé est `{{ r.label }}`. C'est la forme
 *     qu'aucun discriminant de texte ne pouvait brancher — il n'y a pas de texte à
 *     distinguer — et sa destination voyage avec la donnée (`r.href`). Ces treize
 *     cadres sont aussi les seuls à porter le panneau de section.
 *   · 52 cadres portent le rail LITTÉRAL (Parcours, Entraide, Services, Agenda,
 *     Compte, Messages) : cinq `<span>` avec cinq libellés écrits en clair. Ce
 *     n'étaient pas des liens cassés — CE N'ÉTAIENT PAS DES LIENS, donc aucun
 *     `href="#"` ne les comptait et le récapitulatif ne les voyait pas.
 *
 * Éprouver une seule des deux laisserait la moitié la plus nombreuse du produit
 * non mesurée.
 *
 * ── POURQUOI L'API EST INTERCEPTÉE ET NON LANCÉE ───────────────────────────
 *
 * Même raison que `e2e/shell.spec.ts`, qui le fait déjà : ces tests gardent la
 * NAVIGATION, pas le réseau. Les écrans de `(app)` sont derrière
 * `components/garde-session.tsx`, qui renvoie vers `/connexion?suite=…` dès que la
 * reprise de session a échoué — sans interception on mesurerait l'écran de
 * connexion en croyant mesurer le rail. Une vraie session coûterait en plus un
 * `POST /auth/otp/request`, plafonné à DIX PAR HEURE ET PAR IP, pour une question
 * que ces tests ne posent pas.
 *
 * Et le squelette ne vient PAS du serveur : le rail et le panneau sont du DESSIN,
 * calculés dans `screens/a01/data.ts`. Ils se rendent donc entièrement sans API —
 * c'est ce qui rend cette mesure à la fois honnête et bon marché.
 */

/** Le vert fort de la maquette (#0F5C48) : fond du rail, et texte de l'entrée active. */
const VERT_RAIL = 'rgb(15, 92, 72)';
/** Le repos d'une entrée de rail, tel que la maquette l'écrit : blanc à 8 %. */
const REPOS = 'rgba(255, 255, 255, 0.08)';
/** La pastille claire de l'entrée active (#FFFFFF). */
const PASTILLE = 'rgb(255, 255, 255)';

const FIXTURES = resolve(__dirname, '../../../packages/shared/src/__tests__/fixtures');
const charge = (nom: string): string => readFileSync(resolve(FIXTURES, `${nom}.json`), 'utf8');
const json = (body: string) => ({ status: 200, contentType: 'application/json', body });

/**
 * LE RAIL EST TROUVÉ PAR SA GÉOMÉTRIE ET SON RÔLE, jamais par une classe.
 *
 * Le JSX transcodé n'a aucune classe — tout est en style en ligne — donc un
 * sélecteur de classe serait non seulement fragile, il serait impossible. On prend
 * l'élément de rôle `navigation` qui fait 76 px de large : c'est la largeur que la
 * maquette lui donne, et `T5 §0` l'écrit (« rail vertical 76 px à gauche »). Un
 * écran peut porter plusieurs `<nav>` ; un seul fait 76 px.
 *
 * L'échec est EXPLICITE plutôt qu'un `undefined` : « le rail n'est pas rendu » et
 * l'URL. Sans cela, l'absence de rail se présenterait comme un lien introuvable,
 * et l'on chercherait la cause dans la promotion au lieu du rendu — c'est arrivé
 * pendant cette campagne.
 */
async function rail(page: Page): Promise<Locator> {
  /**
   * ON ATTEND LE CADRE AVANT DE LE MESURER, et ce n'est pas une précaution de
   * confort : c'est un échec payé pendant cette campagne.
   *
   * Sur les modules derrière `ecran-donnees.tsx` — Compte, Services, Entraide,
   * Recherche — le cadre, RAIL COMPRIS, n'est rendu qu'APRÈS la résolution de
   * `GET /me`, c'est-à-dire après le `load` de la page. Un balayage géométrique
   * lancé juste après `goto()` ne voyait donc aucun `<nav>` et concluait « le rail
   * n'est pas rendu » — un diagnostic faux, qui accusait la promotion d'un défaut
   * qui était dans l'attente du test. `/accueil`, rendu côté serveur, passait au
   * même moment : l'erreur se présentait comme un problème des rails littéraux.
   *
   * `boundingBox()` n'a pas d'attente intégrée, contrairement aux assertions
   * web-first de Playwright. On attend donc une ancre explicite — la première
   * entrée du rail, présente sur les 65 cadres — puis on mesure.
   */
  await page
    .getByRole('link', { name: 'Accueil', exact: true })
    .first()
    .waitFor({ state: 'visible' });

  const navs = page.getByRole('navigation');
  const n = await navs.count();
  for (let i = 0; i < n; i += 1) {
    const nav = navs.nth(i);
    const boite = await nav.boundingBox();
    if (boite !== null && Math.round(boite.width) === 76) return nav;
  }
  throw new Error(`aucun <nav> de 76 px sur ${page.url()} : le rail n’est pas rendu.`);
}

/**
 * ─── L'ORDRE D'ENREGISTREMENT DES INTERCEPTIONS EST LA PREMIÈRE CHOSE À LIRE ─
 *
 * Playwright essaie les routes de la PLUS RÉCEMMENT ENREGISTRÉE à la plus
 * ancienne. Le fourre-tout doit donc être posé EN PREMIER, et les routes précises
 * APRÈS lui, sinon il les avale.
 *
 * CE PIÈGE S'EST REFERMÉ ICI, et il faut l'écrire parce que son symptôme était un
 * SUCCÈS. En posant `**\/v1/auth/refresh` d'abord, le fourre-tout le recouvrait :
 * la reprise de session recevait `{ items: [] }`, donc aucun jeton, donc la garde
 * renvoyait vers `/connexion`. Les pages mesurées étaient P01 — l'écran du numéro
 * de téléphone — et pourtant douze tests passaient : la garde REND SES ENFANTS
 * avant de rediriger, le rail existait donc une fraction de seconde, le clic
 * partait, l'URL changeait, l'assertion tombait juste, et la redirection arrivait
 * ensuite. Un vert obtenu dans une fenêtre de course ne prouve rien.
 */
/**
 * ─── CADRE D'ORDINATEUR UNIQUEMENT ──────────────────────────────────────────
 *
 * `pnpm test:e2e` joue chaque fichier sous DEUX projets, `ordinateur` (1440 px)
 * et `mobile` (390 px). Le rail de 76 px et le panneau de section n'existent que
 * sur le cadre d'ordinateur : la maquette met une barre d'onglets basse à leur
 * place en mobile, et `e2e/shell.spec.ts` le vérifie (« le rail d'ordinateur est
 * absent », « cinq entrées, Compte à la place d'Agenda »).
 *
 * Sans ce saut, les 36 cas de ce fichier échoueraient tous sous le projet
 * `mobile` en annonçant « le rail n'est pas rendu » — ce qui serait exact et
 * complètement trompeur. C'est l'idiome du dépôt, repris mot pour mot du seuil de
 * 1024 px de §10.1.
 *
 * LA BARRE D'ONGLETS BASSE N'EST PAS BRANCHÉE PAR CE LOT, et c'est dit plutôt que
 * laissé à deviner : la maquette la dessine en `<div>` (`mBottom`), ses cinq
 * entrées sont Accueil, Parcours, Entraide, Services et COMPTE — et non Agenda —
 * donc sa table de destinations n'est pas celle du rail. Et « Compte » n'a pas de
 * route d'accueil : `app/(app)/compte/` n'a que des sous-pages. Remonté au
 * porteur avec le bouton « Réglages », qui bute sur le même manque.
 */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'cadre ordinateur uniquement');

test.beforeEach(async ({ page }) => {
  /**
   * 1. LE FOURRE-TOUT D'ABORD : une enveloppe vide pour tout le reste de l'API.
   *
   * On répond 200 plutôt que d'abandonner la requête : un `route.abort()` ferait
   * lever les crochets de lecture, et un écran en erreur de rendu n'afficherait
   * plus son cadre — donc plus de rail, et un échec qui accuserait la navigation
   * d'un défaut qui serait dans le test.
   */
  await page.route('**/v1/**', (route) =>
    route.fulfill(
      json(
        JSON.stringify({
          items: [],
          meta: { total: 0, open: 0, resolvedThisMonth: 0 },
          nextCursor: null,
        }),
      ),
    ),
  );

  /**
   * 2. LES ROUTES PRÉCISES ENSUITE, donc prioritaires.
   *
   * CE QUE CETTE CAMPAGNE A DÉCOUVERT, et qui explique pourquoi il en faut
   * autant : sur les modules Compte, Services, Messages, Recherche, Parcours,
   * Entraide et Agenda, LE CADRE ENTIER — RAIL COMPRIS — est derrière
   * `screens/compte/ecran-donnees.tsx`, qui remplace tout l'écran par « Chargement
   * de votre compte… » puis par « Une erreur est survenue de notre côté ». Un
   * chargement en échec ne laisse donc AUCUN rail à l'écran : il n'y a rien à
   * cliquer, et le membre ne peut pas quitter un écran qui a échoué. (Écart
   * remonté au porteur : il préexiste à ce lot et ne relève pas de la navigation.)
   *
   * Les charges viennent de `packages/shared/src/__tests__/fixtures`, relevées
   * octet pour octet sur une API qui tournait : ce que le navigateur reçoit a donc
   * exactement la forme que le serveur produit.
   */
  await page.route('**/v1/me', (route) => route.fulfill(json(charge('compte_me'))));
  await page.route('**/v1/me/subscription', (route) =>
    route.fulfill(json(charge('compte_subscription'))),
  );
  await page.route('**/v1/users/**', (route) =>
    route.fulfill(json(charge('compte_profil_public'))),
  );
  await page.route('**/v1/housing*', (route) =>
    route.fulfill(json(charge('services_housing_list'))),
  );

  // La reprise de session, en DERNIER donc en PREMIER servie : sans elle, la garde
  // renvoie vers `/connexion` et l'on mesure l'écran de connexion.
  await page.route('**/v1/auth/refresh', (route) =>
    route.fulfill(json(JSON.stringify({ accessToken: 'jeton-de-test', isNewUser: false }))),
  );
});

/** Les cinq entrées du rail et leur destination déclarée. */
const RAIL = [
  { libelle: 'Accueil', vers: '/accueil' },
  { libelle: 'Parcours', vers: '/parcours' },
  { libelle: 'Entraide', vers: '/entraide' },
  /**
   * `/services` N'EXISTE PAS, et c'est un arbitrage de produit remonté au porteur :
   * il n'y a aucun `app/(app)/services/page.tsx`, et la maquette ne dessine aucune
   * planche « Services — accueil ». Sa première planche du module est S01,
   * « Logement — liste ».
   */
  { libelle: 'Services', vers: '/services/logement' },
  { libelle: 'Agenda', vers: '/agenda' },
] as const;

/**
 * ─── LES ÉCRANS DE DÉPART, UN PAR FORME ET PAR MODULE ───────────────────────
 *
 * `depuis` n'est jamais la destination du lien cliqué : un lien qui pointe sur la
 * page courante passerait le test sans rien prouver, puisque l'URL y est déjà. La
 * boucle les saute explicitement.
 *
 * CINQ MODULES À RAIL LITTÉRAL sont représentés — Entraide, Services, Compte,
 * Parrainage (dans la maquette Entraide) et Recherche — et non un seul : la
 * déclaration est partagée, donc une seule planche suffirait à prouver le
 * MÉCANISME, mais pas que chaque module l'a bien reçu.
 */
const DEPARTS = [
  { nom: 'rail EN BOUCLE — A01 /accueil', depuis: '/accueil' },
  { nom: 'rail LITTÉRAL — X01 /recherche', depuis: '/recherche' },
  { nom: 'rail LITTÉRAL — H01 /entraide', depuis: '/entraide' },
  { nom: 'rail LITTÉRAL — S01 /services/logement', depuis: '/services/logement' },
  { nom: 'rail LITTÉRAL — K01 /compte/profil', depuis: '/compte/profil' },
] as const;

for (const forme of DEPARTS) {
  test.describe(forme.nom, () => {
    for (const entree of RAIL) {
      if (entree.vers === forme.depuis) continue;

      test(`« ${entree.libelle} » mène à ${entree.vers}`, async ({ page }) => {
        await page.goto(forme.depuis, { waitUntil: 'load' });

        const lien = (await rail(page)).getByRole('link', {
          name: entree.libelle,
          exact: true,
        });
        await expect(lien).toHaveCount(1);
        await lien.click();

        /**
         * `toHaveURL` et NON `waitForURL` : `waitForURL` attend l'événement `load`,
         * et `next dev` garde une connexion ouverte pour le rechargement à chaud —
         * `load` n'arrive jamais, et l'attente expire sur un message qui accuse la
         * navigation. Le piège est documenté dans ce dépôt ; on ne le rouvre pas.
         */
        await expect(page).toHaveURL(new RegExp(`${entree.vers}$`));
      });
    }
  });
}

/**
 * ─── LE PANNEAU DE SECTION : SES SEPT ENTRÉES ───────────────────────────────
 *
 * Il n'est dessiné que par les treize cadres de `03 Accueil v2.dc.html`, et c'est
 * `/accueil` qui en porte la variante « Fil d'actualité » (`panelFil`).
 *
 * Le nom accessible d'une entrée inclut son compteur quand la maquette en dessine
 * un — « Fil d'entraide 12 », « Événements 3 » — d'où le `^libellé` plutôt qu'une
 * égalité : le compteur est une DONNÉE, et l'exiger ferait échouer le test le jour
 * où il change, pour une raison qui n'a rien à voir avec la navigation.
 */
const PANNEAU = [
  { libelle: "Fil d'actualité", vers: '/accueil' },
  { libelle: 'Guides & Démarches', vers: '/guides' },
  { libelle: "Fil d'entraide", vers: '/entraide' },
  { libelle: 'Réseaux', vers: '/reseaux' },
  { libelle: 'Parrainage', vers: '/parrainage' },
  { libelle: 'Villes & Membres', vers: '/villes' },
  { libelle: 'Événements', vers: '/agenda' },
] as const;

test.describe('panneau de section — A01 /accueil', () => {
  for (const entree of PANNEAU) {
    if (entree.vers === '/accueil') continue;

    test(`« ${entree.libelle} » mène à ${entree.vers}`, async ({ page }) => {
      await page.goto('/accueil', { waitUntil: 'load' });

      const lien = page.getByRole('link', { name: new RegExp(`^${entree.libelle}`) }).first();
      await expect(lien).toBeVisible();
      await lien.click();

      await expect(page).toHaveURL(new RegExp(`${entree.vers}$`));
    });
  }
});

/**
 * ─── LA PROMOTION N'A PAS CHANGÉ LE DESSIN ──────────────────────────────────
 *
 * UN DÉFAUT D'APPARENCE CONNU DE CE DÉPÔT, et il vaut d'être mesuré ici plutôt
 * que supposé : une ancre sans couleur en ligne héritait, dans le document de la
 * maquette, d'une règle `a { color: #16785E }` que le JSX produit n'a PAS. Un
 * `<span>` promu en `<a>` prendrait alors la couleur de lien du navigateur — du
 * bleu souligné dans un rail vert foncé.
 *
 * Les entrées du rail portent leur couleur EN LIGNE, donc elles devraient être
 * couvertes : la neutralisation de `markLinks` est PRÉFIXÉE au style de la
 * maquette, et `styleToJsx` garde la DERNIÈRE déclaration — la maquette gagne.
 * « Devrait » ne suffit pas : on le lit sur l'écran rendu, des deux côtés.
 */
test.describe('aucune dérive de dessin après promotion', () => {
  for (const cas of [
    { nom: 'en boucle (A01)', depuis: '/accueil', actif: 'Accueil' },
    { nom: 'littéral (H01)', depuis: '/entraide', actif: 'Entraide' },
  ] as const) {
    test(`le rail ${cas.nom} garde ses couleurs de maquette`, async ({ page }) => {
      await page.goto(cas.depuis, { waitUntil: 'load' });
      const nav = await rail(page);

      await expect(nav).toHaveCSS('background-color', VERT_RAIL);

      // Une entrée AU REPOS : le #CFE3DA de la maquette, et aucun soulignement.
      const repos = nav.getByRole('link', { name: 'Villes', exact: true }).or(
        nav.getByRole('link', { name: 'Parcours', exact: true }),
      );
      await expect(repos.first()).toHaveCSS('color', 'rgb(207, 227, 218)');
      await expect(repos.first()).toHaveCSS('text-decoration-line', 'none');

      // L'entrée ACTIVE garde sa pastille claire et son vert fort.
      const actif = nav.getByRole('link', { name: cas.actif, exact: true });
      await expect(actif).toHaveCSS('color', VERT_RAIL);
      await expect(actif).toHaveCSS('background-color', PASTILLE);
      await expect(actif).toHaveCSS('text-decoration-line', 'none');
    });
  }
});

/**
 * ─── LA SURBRILLANCE DÉSIGNE LA PAGE AFFICHÉE ───────────────────────────────
 *
 * MESURÉ PLUTÔT QUE PROMIS, parce que le soupçon était explicite et légitime : la
 * maquette allume sa première entrée EN DUR (`i === 0`), donc toute page du
 * produit pourrait s'annoncer « Accueil » — le défaut que le rail d'équipe a sur
 * D16, où le rapport d'impact se présente comme le tableau de bord.
 *
 * Mesuré, le produit membre ne l'a PAS, et ces tests sont là pour que cela reste
 * vrai :
 *
 *   · sur les 52 cadres LITTÉRAUX, la maquette peint elle-même l'entrée du module
 *     — « Entraide » sur l'entraide, « Services » sur les services ;
 *   · sur `/recherche` et `/compte/profil`, AUCUNE des cinq n'est allumée, et
 *     c'est juste : aucune ne désigne ces pages ;
 *   · sur les 13 cadres EN BOUCLE, « Accueil » est allumé — et c'est vrai aussi,
 *     parce que `T5 §0` range Guides, Réseaux, Parrainage, Villes et Événements
 *     DANS LE PANNEAU D'ACCUEIL. C'est donc le PANNEAU qui dit laquelle, et le
 *     dernier test de ce bloc est celui qui compte : sur `/guides`, l'entrée
 *     allumée du panneau est « Guides & Démarches » et non « Fil d'actualité ».
 */
test.describe('la surbrillance dit la vérité', () => {
  for (const cas of [
    { chemin: '/accueil', allumee: 'Accueil' },
    { chemin: '/entraide', allumee: 'Entraide' },
    { chemin: '/services/logement', allumee: 'Services' },
    { chemin: '/recherche', allumee: null },
    { chemin: '/compte/profil', allumee: null },
  ] as const) {
    const quoi =
      cas.allumee === null
        ? 'aucune entrée du rail n’est allumée'
        : `« ${cas.allumee} » est l’entrée allumée`;

    test(`sur ${cas.chemin}, ${quoi}`, async ({ page }) => {
      await page.goto(cas.chemin, { waitUntil: 'load' });
      const nav = await rail(page);

      for (const entree of RAIL) {
        const lien = nav.getByRole('link', { name: entree.libelle, exact: true });
        await expect(lien).toHaveCSS(
          'background-color',
          entree.libelle === cas.allumee ? PASTILLE : REPOS,
        );
      }
    });
  }

  /**
   * LE CAS QUI PROUVE QUE LA PAGE NE S'ANNONCE PAS SOUS LE NOM D'UNE AUTRE.
   *
   * `/guides` est un cadre EN BOUCLE : son rail allume « Accueil », ce qui est le
   * module. Si son panneau allumait aussi « Fil d'actualité », l'écran dirait
   * « vous êtes sur le fil » alors qu'il affiche les guides — exactement le défaut
   * de D16. La maquette a paramétré ce panneau (`panelGuides = panel(1)`), et
   * c'est cela qu'on vérifie.
   */
  test('sur /guides, le panneau allume « Guides & Démarches » et non le fil', async ({ page }) => {
    await page.goto('/guides', { waitUntil: 'load' });

    const guides = page.getByRole('link', { name: /^Guides & Démarches/ }).first();
    const fil = page.getByRole('link', { name: /^Fil d’actualité|^Fil d'actualité/ }).first();

    await expect(guides).toHaveCSS('background-color', 'rgb(227, 240, 235)'); // #E3F0EB
    await expect(guides).toHaveCSS('color', VERT_RAIL);
    await expect(guides).toHaveCSS('font-weight', '700');

    await expect(fil).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)'); // transparent
    await expect(fil).toHaveCSS('color', 'rgb(22, 33, 29)'); // #16211D
  });
});
