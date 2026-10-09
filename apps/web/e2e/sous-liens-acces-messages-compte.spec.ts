import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * ─── LES SOUS-LIENS DES PAGES CLIQUENT-ILS ? MESURÉ AU NAVIGATEUR ───────────
 *
 * Verbatim du porteur : « Aucun sous lien aussi ne fonctionne. […] et tous les
 * sous liens des pages. » Ce fichier éprouve les liens HORS RAIL des écrans
 * d'accès et d'onboarding (P01, O01, O02, O03, O05), des notifications (X02) et
 * de « Téléphones et sessions » (K04) — ceux que `e2e/squelette-membre.spec.ts`
 * ne couvre pas, parce qu'ils ne sont pas le squelette.
 *
 * ── ON CLIQUE, ON NE LIT PAS LE `href` ─────────────────────────────────────
 *
 * Une assertion sur un attribut passerait si le lien ne menait nulle part, et
 * passerait aussi si l'écran n'était pas rendu du tout. C'est précisément parce
 * que tous les tests du dépôt tapaient l'URL que 207 liens morts ont tenu quinze
 * rapports verts. On part donc d'un écran qui N'EST PAS la destination, on
 * clique, et on lit l'URL obtenue.
 *
 * ── ET POUR P01, ON VA PLUS LOIN QUE L'URL ─────────────────────────────────
 *
 * L'URL seule ne distingue pas une route qui répond d'une route qui rend `404` :
 * `/p/:slug` n'accepte que DEUX slugs (`confidentialite`, `ressources`) et
 * `notFound()` pour tout le reste, SANS changer l'URL. Le test lit donc le titre
 * du document arrivé. Sans cela, `vers: '/p/cgu'` — la déduction tentante, et
 * fausse — aurait rendu ce fichier vert.
 *
 * ── CE QUI N'EST PAS ICI, ET POURQUOI ──────────────────────────────────────
 *
 * X04 (les encarts de refus) porte deux des liens de ce lot, et il est ABSENT de
 * ce fichier : son unique cadre n'est monté par AUCUNE page — vérifié, son
 * composant est généré et importé par personne — donc il n'existe aucune URL où
 * l'ouvrir et cliquer. Déclaré et vérifié dans le JSX produit, pas au navigateur.
 * C'est dit plutôt que compté comme un succès.
 */

const FIXTURES = resolve(__dirname, '../../../packages/shared/src/__tests__/fixtures');
const charge = (nom: string): string => readFileSync(resolve(FIXTURES, `${nom}.json`), 'utf8');
const json = (body: string) => ({ status: 200, contentType: 'application/json', body });

/**
 * ─── L'ORDRE D'ENREGISTREMENT DES INTERCEPTIONS EST LA PREMIÈRE CHOSE À LIRE ─
 *
 * Playwright essaie les routes de la PLUS RÉCEMMENT ENREGISTRÉE à la plus
 * ancienne : le fourre-tout va donc EN PREMIER, et les routes précises APRÈS lui.
 * L'ordre inverse donne un vert qui ne prouve rien — c'est documenté dans
 * `e2e/squelette-membre.spec.ts`, où le fourre-tout avalait `auth/refresh` et où
 * douze tests passaient dans une fenêtre de course, sur l'écran de connexion.
 *
 * L'API est INTERCEPTÉE et non lancée, pour la raison déjà écrite dans
 * `e2e/shell.spec.ts` : ces tests gardent la NAVIGATION, pas le réseau. Une vraie
 * session coûterait en plus un `POST /auth/otp/request`, plafonné à DIX PAR HEURE
 * ET PAR IP, pour une question que ces tests ne posent pas.
 */
async function interceptions(page: Page): Promise<void> {
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

  await page.route('**/v1/me', (route) => route.fulfill(json(charge('compte_me'))));
  await page.route('**/v1/me/subscription', (route) =>
    route.fulfill(json(charge('compte_subscription'))),
  );
  await page.route('**/v1/auth/sessions', (route) =>
    route.fulfill(json(charge('compte_sessions'))),
  );
  /**
   * `meta.unread` est EXIGÉ par `notificationsResponseSchema`, qui est `.strict()` :
   * l'enveloppe du fourre-tout le ferait échouer, et `EcranNotifications`
   * remplacerait alors tout l'écran par son message d'erreur — donc plus de lien à
   * cliquer, et un échec qui accuserait la navigation.
   */
  await page.route('**/v1/notifications*', (route) =>
    route.fulfill(json(JSON.stringify({ items: [], nextCursor: null, meta: { unread: 0 } }))),
  );
  /**
   * O05 choisit sa planche sur `GET /journeys` : liste non vide → « avec parcours »,
   * qui est la planche qui porte le lien « Aller à l'accueil ». La liste vide
   * servirait l'autre planche, où les mêmes mots sont un `<button>` et non un lien.
   */
  await page.route('**/v1/journeys*', (route) => route.fulfill(json(charge('journeys_liste'))));

  // La reprise de session, en DERNIER donc en PREMIER servie : sans elle, la garde
  // de `(app)` renvoie vers `/connexion` et l'on mesure l'écran de connexion.
  await page.route('**/v1/auth/refresh', (route) =>
    route.fulfill(json(JSON.stringify({ accessToken: 'jeton-de-test', isNewUser: false }))),
  );
}

test.beforeEach(async ({ page }) => {
  await interceptions(page);
});

/** Le cadre d'ordinateur est servi au-delà de 1024 px — seuil de §10.1. */
const ordinateur = ({ viewport }: { viewport: { width: number } | null }): boolean =>
  (viewport?.width ?? 0) >= 1024;

/**
 * ─── P01 — LA CASE DE CONSENTEMENT, L'ÉCRAN PAR LEQUEL TOUT MEMBRE ENTRE ────
 *
 * La maquette raccourcit les libellés à 390 px : « politique de confidentialité »
 * devient « confidentialité ». Les deux largeurs sont donc éprouvées avec LEUR
 * libellé, et non avec un libellé commun qui n'existe sur aucune des deux.
 */
test.describe('P01 /connexion — les liens de la case de consentement', () => {
  test('« confidentialité » mène à /p/confidentialite, et le document arrive', async ({
    page,
    viewport,
  }) => {
    await page.goto('/connexion', { waitUntil: 'load' });

    const libelle = ordinateur({ viewport })
      ? 'politique de confidentialité'
      : 'confidentialité';
    const lien = page.getByRole('link', { name: libelle, exact: true });
    await expect(lien).toHaveCount(1);
    await lien.click();

    /**
     * `toHaveURL` et non `waitForURL` : `waitForURL` attend `load`, que `next dev`
     * ne produit jamais (connexion ouverte pour le rechargement à chaud).
     */
    await expect(page).toHaveURL(/\/p\/confidentialite$/);

    /**
     * ET LE DOCUMENT EST BIEN SERVI. `notFound()` ne change pas l'URL : sans cette
     * seconde assertion, un slug inexistant passerait le test. C'est exactement le
     * piège de `/p/cgu`, qui existe en base et ne répond pas.
     */
    await expect(
      page.getByRole('heading', { name: 'Politique de confidentialité' }),
    ).toBeVisible();
  });

  /**
   * ⚠ LE LIEN DES CONDITIONS RESTE MORT, ET C'EST MESURÉ ICI PLUTÔT QUE PASSÉ
   * SOUS SILENCE.
   *
   * `/p/cgu` n'est servi par aucune route (`SLUGS` est une liste fermée de deux
   * entrées), et la maquette ne dessine aucune planche de conditions. Le lien
   * reste donc sur `href="#"` : ce test CONSTATE le trou et le tiendra ouvert
   * jusqu'à ce que la route arrive — le jour où elle arrivera, il échouera, et
   * c'est ce qu'on veut de lui.
   */
  test('⚠ « conditions » n’a toujours aucune destination — route absente', async ({
    page,
    viewport,
  }) => {
    await page.goto('/connexion', { waitUntil: 'load' });

    const libelle = ordinateur({ viewport }) ? "conditions d'utilisation" : 'conditions';
    const lien = page.getByRole('link', { name: libelle, exact: true });
    await expect(lien).toHaveCount(1);
    await expect(lien).toHaveAttribute('href', '#');
  });
});

/**
 * ─── « PASSER CETTE ÉTAPE » — MÊME LIBELLÉ, TROIS DESTINATIONS ──────────────
 *
 * C'est le cas que l'en-tête de `markLinks` prend pour justifier le bornage par
 * écran, et c'est pour cela que les trois sont éprouvés séparément : une table
 * indexée sur le seul libellé les enverrait au même endroit, et un seul test le
 * laisserait passer.
 *
 * Le lien n'est dessiné que sur le cadre d'ORDINATEUR (T5 §3 : « sauf O01 sur
 * mobile »), d'où le saut sous le projet `mobile`.
 */
const PASSER = [
  { depuis: '/bienvenue/phase', vers: '/bienvenue/lieu', ecran: 'O01' },
  { depuis: '/bienvenue/lieu', vers: '/bienvenue/objectif', ecran: 'O02' },
  { depuis: '/bienvenue/objectif', vers: '/bienvenue/profil', ecran: 'O03' },
] as const;

test.describe('« Passer cette étape » — trois écrans, trois destinations', () => {
  test.skip(({ viewport }) => !ordinateur({ viewport }), 'cadre ordinateur uniquement');

  for (const etape of PASSER) {
    test(`${etape.ecran} ${etape.depuis} → ${etape.vers}`, async ({ page }) => {
      await page.goto(etape.depuis, { waitUntil: 'load' });

      const lien = page.getByRole('link', { name: 'Passer cette étape', exact: true });
      await expect(lien).toHaveCount(1);
      await lien.click();

      await expect(page).toHaveURL(new RegExp(`${etape.vers}$`));
    });
  }
});

/**
 * ─── O05 — LA SORTIE DE L'INSCRIPTION ──────────────────────────────────────
 *
 * Le lien est sur la planche AVEC PARCOURS, sous le bouton « Commencer » — et non
 * sur celle sans parcours, où les mêmes mots sont un `<button>` primaire. C'est la
 * mesure qui l'a dit : le garde-fou `fois` de `markLinks` a arrêté la génération
 * sur « 0 élément(s) promouvable(s) » quand la déclaration visait l'autre planche.
 *
 * O05 n'a QU'UN cadre de 700 px — la maquette ne lui dessine pas de mobile — donc
 * les deux projets mesurent le même cadre, et c'est voulu : il est servi aux deux
 * largeurs.
 */
test.describe('O05 /bienvenue/fin — la sortie de l’inscription', () => {
  test('« Aller à l’accueil » mène à /accueil', async ({ page }) => {
    await page.goto('/bienvenue/fin', { waitUntil: 'load' });

    const lien = page.getByRole('link', { name: "Aller à l'accueil", exact: true });
    await expect(lien).toHaveCount(1);
    await lien.click();

    await expect(page).toHaveURL(/\/accueil$/);
  });
});

/**
 * ─── X02 — LE PANNEAU DÉROULANT RENVOIE À SA PAGE ──────────────────────────
 *
 * Le panneau est servi sur `?vue=panneau` : aucun cadre ne dessine de cloche
 * cliquable, et le paramètre d'URL est le choix déjà fait par ce module plutôt que
 * d'inventer le contrôle. Le départ est donc `/notifications?vue=panneau`, et la
 * destination `/notifications` — deux URL distinctes, donc le clic prouve bien
 * quelque chose.
 */
test.describe('X02 /notifications — le panneau déroulant', () => {
  test.skip(({ viewport }) => !ordinateur({ viewport }), 'le panneau n’a pas de forme mobile');

  test('« Voir tout » mène à /notifications', async ({ page }) => {
    await page.goto('/notifications?vue=panneau', { waitUntil: 'load' });

    const lien = page.getByRole('link', { name: 'Voir tout', exact: true });
    await expect(lien).toHaveCount(1);
    await lien.click();

    await expect(page).toHaveURL(/\/notifications$/);
  });

  /**
   * ⚠ « TOUT MARQUER LU » RESTE MORT, SUR LES DEUX PLANCHES D'ORDINATEUR.
   *
   * La route existe (`POST /notifications/read` accepte `{ all: true }`), mais
   * c'est une ÉCRITURE : il faudrait un gestionnaire, et `markLinks` refuse
   * `action` sur une balise `<a>`. Mesuré ici pour que le trou soit CONSTATÉ et
   * non deviné.
   */
  test('⚠ « Tout marquer lu » n’est toujours branché sur rien', async ({ page }) => {
    await page.goto('/notifications?vue=panneau', { waitUntil: 'load' });

    const lien = page.getByRole('link', { name: 'Tout marquer lu', exact: true });
    await expect(lien).toHaveCount(1);
    await expect(lien).toHaveAttribute('href', '#');
  });
});

/**
 * ─── K04 — L'ÉCRART QUE LE COMPTEUR NE VOYAIT PAS ──────────────────────────
 *
 * L'unique `href="#"` de cet écran (« Révoquer toutes les autres ») est une
 * écriture, pas une destination : il reste mort, et c'est constaté plus bas.
 *
 * Ce qui CHANGE sur cet écran, c'est la barre d'onglets basse de son cadre mobile :
 * quatre `<div>` devenus quatre liens. Ils ne comptaient dans aucun `href="#"`,
 * donc le récapitulatif de la génération ne les a jamais vus — et c'est pourtant
 * tout ce qu'un membre a sous le pouce.
 */
test.describe('K04 /compte/securite — téléphones et sessions', () => {
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ « RÉVOQUER TOUTES LES AUTRES » EST BRANCHÉ — LE MANQUE A ÉTÉ COMBLÉ      ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * CE QUE CE CAS DISAIT AVANT : « n'est toujours branché sur rien », et il
   * épinglait `<a href="#">` pour que le trou ne se referme pas en silence.
   *
   * IL S'EST VU. Le porteur : « Niveau page sécurité, l'ajout de numéro marche et
   * la révocation de SESSIONS ? » — ni l'un ni l'autre. `DELETE /sessions`
   * répondait depuis le début.
   *
   * LE LIEN MORT EST DEVENU UN BOUTON, et c'est ce qu'il devait être : révoquer
   * n'est pas une destination. Il est présent sur les DEUX planches maintenant —
   * celle de 390 px ne le dessinait pas du tout, un membre sur téléphone ne
   * pouvait pas déconnecter ses autres appareils.
   */
  test('« Révoquer toutes les autres » est un bouton branché, sur les deux planches', async ({
    page,
  }) => {
    await page.goto('/compte/securite', { waitUntil: 'load' });

    /** Plus AUCUN lien de ce nom : c'était le défaut, et il est corrigé. */
    await expect(
      page.getByRole('link', { name: 'Révoquer toutes les autres', exact: true }),
    ).toHaveCount(0);

    const bouton = page
      .locator('[data-securite-revoquer-tout]')
      .filter({ visible: true })
      .first();
    await expect(bouton, 'la révocation en bloc n’est pas offerte').toBeVisible({
      timeout: 20_000,
    });
    await expect(bouton).toBeEnabled();
  });
});

/**
 * ─── LA BARRE D'ONGLETS BASSE — 12 AFFORDANCES QUE LE COMPTEUR NE VOYAIT PAS ─
 *
 * Elle existe sur 54 cadres mobiles des sept maquettes membre, et aucune de ses
 * entrées n'était un lien : la maquette les dessine en `<div>`. Trois de ces
 * cadres relèvent de ce lot — X02 Mobile, X04 Mobile et K04 Mobile — et les deux
 * qu'une page monte sont éprouvés ici au clic.
 *
 * LA CINQUIÈME ENTRÉE, « COMPTE », N'EST PAS DANS LA LISTE, et c'est un refus :
 * il n'existe aucune route `/compte` (`app/(app)/compte/` n'a que des sous-pages).
 * Le test le CONSTATE, pour que le trou ne se referme pas en silence.
 */
const ONGLETS = [
  { libelle: 'Accueil', vers: '/accueil' },
  { libelle: 'Parcours', vers: '/parcours' },
  { libelle: 'Entraide', vers: '/entraide' },
  { libelle: 'Services', vers: '/services/logement' },
] as const;

const CADRES_MOBILES = [
  /**
   * LES ONZE CADRES MOBILES QUI DESSINENT LA BARRE, dans les trois maquettes de ce
   * lot, et leur route. Ils sont ÉPROUVÉS UN PAR UN plutôt qu'un seul par
   * mécanisme : la table est partagée, donc UNE planche suffirait à prouver le
   * mécanisme, mais pas que chaque écran l'a bien reçue. C'est la discipline de
   * `e2e/squelette-membre.spec.ts`, et elle a déjà servi : les cadres mobiles qui
   * NE dessinent PAS la barre (`MobileConversation`, `MobileMenu`, les feuilles)
   * auraient été déclarés par un défaut trop large.
   *
   * — Messages et transverse : M01, X01, X02, X04 (X04 n'a pas de route, voir plus
   *   haut : son cadre n'est monté par aucune page) ;
   * — Compte : K01, K03, K04, K05, K07, K08, K09, K10.
   */
  { nom: 'M01 Mobile', depuis: '/messages' },
  { nom: 'X01 Mobile', depuis: '/recherche' },
  { nom: 'X02 Mobile', depuis: '/notifications' },
  { nom: 'K01 Mobile', depuis: '/compte/profil' },
  { nom: 'K03 Mobile', depuis: '/compte/verification' },
  { nom: 'K04 Mobile', depuis: '/compte/securite' },
  { nom: 'K05 Mobile', depuis: '/compte/contacts' },
  { nom: 'K07 Mobile', depuis: '/compte/notifications' },
  { nom: 'K08 Mobile', depuis: '/compte/donnees' },
  { nom: 'K09 Mobile', depuis: '/compte/sanctions' },
  { nom: 'K10 Mobile', depuis: '/compte/enregistres' },
] as const;

/**
 * La barre basse est trouvée par sa GÉOMÉTRIE : cinq colonnes égales, en pied
 * d'écran. On passe par le conteneur plutôt que par le document entier parce que
 * « Parcours » et « Entraide » sont AUSSI écrits dans les pastilles de filtre du
 * cadre mobile de X02 — c'est la raison même du `dans` de la déclaration.
 */
async function barreBasse(page: Page) {
  const lien = page.getByRole('link', { name: 'Accueil', exact: true }).last();
  await lien.waitFor({ state: 'visible' });
  const boite = await lien.boundingBox();
  if (boite === null) throw new Error(`barre basse absente sur ${page.url()}`);
  return boite;
}

test.describe('la barre d’onglets basse clique', () => {
  test.skip(({ viewport }) => ordinateur({ viewport }), 'cadre mobile uniquement');

  for (const cadre of CADRES_MOBILES) {
    test.describe(cadre.nom, () => {
      for (const onglet of ONGLETS) {
        test(`« ${onglet.libelle} » mène à ${onglet.vers}`, async ({ page }) => {
          await page.goto(cadre.depuis, { waitUntil: 'load' });

          // Le pied d'écran est le DERNIER « Accueil » du document : les pastilles
          // de filtre viennent avant lui.
          const haut = (await barreBasse(page)).y;
          const lien = page.getByRole('link', { name: onglet.libelle, exact: true });
          const n = await lien.count();

          let clique = false;
          for (let i = 0; i < n; i += 1) {
            const boite = await lien.nth(i).boundingBox();
            // Le même rang vertical que « Accueil » : c'est la barre, pas un filtre.
            if (boite !== null && Math.abs(boite.y - haut) < 4) {
              await lien.nth(i).click();
              clique = true;
              break;
            }
          }
          if (!clique) throw new Error(`« ${onglet.libelle} » absent de la barre basse`);

          await expect(page).toHaveURL(new RegExp(`${onglet.vers}$`));
        });
      }

      /**
       * ╔══════════════════════════════════════════════════════════════════════╗
       * ║ « COMPTE » EST UN LIEN MAINTENANT — ET CE TEST DISAIT L'INVERSE      ║
       * ╚══════════════════════════════════════════════════════════════════════╝
       *
       * Il gardait un MANQUE : « aucune route /compte ». Le porteur l'a relevé —
       * « Le bouton compte dans le menu sur mobile au niveau du bottom bar ne
       * marche pas » — et `(app)/compte/page.tsx` redirige désormais vers
       * `/compte/profil`, la première des dix pages du module (T5 §11).
       *
       * Un test qui garde l'absence d'une route doit TOMBER le jour où la route
       * arrive, sinon il interdit la correction. Celui-ci est donc retourné : il
       * garde maintenant la présence, comme les quatre onglets voisins.
       */
      test('« Compte » mène au module Compte', async ({ page }) => {
        await page.goto(cadre.depuis, { waitUntil: 'load' });
        await barreBasse(page);
        const compte = page.getByRole('link', { name: 'Compte', exact: true });
        await expect(compte).toHaveCount(1);
        await compte.first().click();
        await expect(page).toHaveURL(/\/compte(\/profil)?$/);
      });
    });
  }
});

/**
 * ─── LE PANNEAU « MON COMPTE » — NEUF AFFORDANCES QUE LE COMPTEUR NE VOYAIT PAS ─
 *
 * Ce n'est PAS le panneau déjà éprouvé par `e2e/squelette-membre.spec.ts` : celui-là
 * est le panneau « COMMUNAUTÉ » des treize cadres de `03 Accueil v2`, en boucle.
 * Celui-ci est le menu du module Compte, neuf entrées LITTÉRALES en `<span>` — donc
 * aucun `href="#"`, donc invisible au récapitulatif de la génération.
 *
 * LES NEUF ROUTES VIENNENT DE T5 §11 (K01…K10), une par entrée, sans un seul trou.
 *
 * ⚠ CE LOT NE LE BRANCHE QUE SUR K04, le seul écran du module qui lui est confié.
 * Les neuf autres cadres d'ordinateur de `08 Compte` gardent leurs `<span>` morts :
 * c'est une décision de périmètre, écrite dans `tools/screens/08-compte.mjs` et
 * remontée au porteur.
 */
const MON_COMPTE = [
  { libelle: 'Profil', vers: '/compte/profil' },
  { libelle: 'Vérification', vers: '/compte/verification' },
  { libelle: 'Sécurité', vers: '/compte/securite' },
  { libelle: 'Contacts', vers: '/compte/contacts' },
  { libelle: 'Enregistrés', vers: '/compte/enregistres' },
  { libelle: 'Abonnement', vers: '/compte/abonnement' },
  { libelle: 'Notifications', vers: '/compte/notifications' },
  { libelle: 'Mes données', vers: '/compte/donnees' },
  { libelle: 'Sanctions', vers: '/compte/sanctions' },
] as const;

test.describe('K04 — le panneau « MON COMPTE » clique', () => {
  test.skip(({ viewport }) => !ordinateur({ viewport }), 'le panneau n’est que sur l’ordinateur');

  for (const entree of MON_COMPTE) {
    /**
     * « Sécurité » EST la page de départ : un lien qui pointe sur l'URL courante
     * passerait le test sans rien prouver, puisque l'URL y est déjà. Sauté
     * explicitement, comme le fait `e2e/squelette-membre.spec.ts` pour le rail.
     */
    if (entree.vers === '/compte/securite') continue;

    test(`« ${entree.libelle} » mène à ${entree.vers}`, async ({ page }) => {
      await page.goto('/compte/securite', { waitUntil: 'load' });

      /**
       * ╔═══════════════════════════════════════════════════════════════════════╗
       * ║ LA CLOCHE EST DEVENUE UN LIEN — et ce cas supposait qu'elle n'en était  ║
       * ║ pas un                                                                 ║
       * ╚═══════════════════════════════════════════════════════════════════════╝
       *
       * Le commentaire précédent disait : « la cloche n'est pas un lien, donc le
       * rôle suffit à les séparer ». C'était vrai à l'écriture ; depuis le
       * branchement de la barre haute, la cloche est un `<a href="/notifications">`
       * portant `aria-label="Notifications"`. MESURÉ au navigateur : deux liens de
       * ce nom dans le cadre d'ordinateur, et `toHaveCount(1)` — qui était là pour
       * vérifier plutôt que supposer — a fait son travail.
       *
       * ON BORNE PAR LA DESTINATION, et non par le voisinage : ce que ce cas
       * affirme, c'est que l'entrée du panneau « MON COMPTE » mène sous
       * `/compte/`. Un sélecteur de position se serait recassé au premier
       * réagencement du panneau.
       */
      const lien = page
        .getByRole('link', { name: entree.libelle, exact: true })
        .filter({ has: page.locator(`xpath=self::a[starts-with(@href, '/compte/')]`) });
      await expect(lien).toHaveCount(1);
      await lien.click();

      await expect(page).toHaveURL(new RegExp(`${entree.vers}$`));
    });
  }
});
