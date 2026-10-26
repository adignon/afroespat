import { expect, test, type Page } from '@playwright/test';
import { connecter } from './session';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA RECHERCHE — QUATRE DEMANDES DU PORTEUR, MESURÉES AU NAVIGATEUR          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur, dans un seul message :
 *
 *   1. « Lorsqu'on tape dans le champ, les propositions sous l'input doivent
 *      s'afficher et permettre d'ALLER DIRECTEMENT sur un élément » ;
 *   2. « Il faut que la recherche touche à tous les types de contenus » ;
 *   3. « Lorsqu'on est sur la page du search, il faut que la left side bar
 *      contienne PLUTÔT les filtres (guide, actualité, événement, etc.) avec le
 *      nombre matché dans ces catégories » ;
 *   4. « Donc pendant ce temps le menu green de gauche affiche au "hover" un
 *      floatting side bar menu quand on passe le curseur sur Accueil, Parcours
 *      etc. — ça va permettre d'avoir la navigation même sur les pages où la side
 *      bar est réutilisée pour le contexte de la page. »
 *
 * ── CE QUE CES CAS MESURENT, ET PAR QUOI ──────────────────────────────────
 *
 * Par la GÉOMÉTRIE et les RÔLES, jamais par une classe CSS : la maquette n'en a
 * pas — tout est en style en ligne — et un cas accroché à un hexadécimal
 * rougirait au premier ajustement de dessin sans rien dire de vrai.
 *
 * ── CE QUI NE DOIT PAS AVOIR BOUGÉ ────────────────────────────────────────
 *
 * Un cas regarde ce qui a DISPARU : le menu « ACCUEIL » n'est plus dans la
 * colonne de la page de recherche, et la rangée de pastilles n'est plus au-dessus
 * des résultats. Sans lui, tout resterait vert avec DEUX jeux de filtres sur la
 * page — ce qui est précisément le genre de régression que le porteur a attrapée
 * sur une capture, et pas moi sur un test.
 */
const cadre = (page: Page) => page.locator('[data-frame]').filter({ visible: true }).first();

/**
 * MISE À JOUR (lot w5b) — LE TERME CHERCHÉ ET LE WORKER.
 *
 * Ces cas cherchaient « lyon », ville que le jeu de référence d'une base fraîche porte
 * INACTIVE : le moteur n'indexe que les villes actives (`search_documents`), donc la recherche
 * ne rendait rien et chaque cas accusait l'écran. Le terme est maintenant « aix » — Aix-en-
 * Provence, la ville où `connecter()` installe ses membres, active et indexée — qui rend une
 * VILLE (filtre « Villes », carte `/villes/aix-en-provence`, proposition de la barre).
 *
 * ⚠ L'INDEX SE REMPLIT PAR LE WORKER (`apps/worker`, relais de la boîte d'envoi puis file
 * `search_index`). Sans lui, les événements de domaine restent en attente et la recherche ne
 * voit que ce qu'un ancien passage a indexé : lancer `APP_ROLE=worker node -r
 * @swc-node/register apps/worker/src/main.ts` avec les mêmes variables que l'API.
 *
 * Les libellés de rubrique sont ceux du produit (« Guides & Démarches »), plus ceux de la
 * maquette (« Guides et Démarches »).
 */
test.describe('la recherche', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'les planches d’ordinateur');

  test('la colonne de gauche porte les filtres et leurs comptes, pas le menu d’accueil', async ({
    page,
    request,
  }) => {
    await connecter(page.context(), request, { displayName: 'Awa Konate' });
    await page.setViewportSize({ width: 1700, height: 1000 });
    await page.goto('/recherche?q=aix');

    const vue = cadre(page);
    await expect(vue.getByText('FILTRES')).toBeVisible();

    /**
     * LE MENU DE SECTION N'EST PLUS LÀ. « Plutôt », dit le porteur : les filtres
     * remplacent, ils ne s'ajoutent pas. « Guides et Démarches » était l'entrée du
     * menu « ACCUEIL » que la planche dessinait dans cette colonne.
     */
    await expect(vue.getByText('ACCUEIL', { exact: true })).toHaveCount(0);
    await expect(vue.getByText('Guides & Démarches')).toHaveCount(0);

    /**
     * LE COMPTE VIENT DU SERVEUR. « Tout · 24 » et « Guides · 5 » étaient les
     * exemples de la maquette ; on ne vérifie donc pas un nombre, on vérifie que
     * le filtre de « Tout » porte la SOMME des autres — ce qu'un nombre dessiné ne
     * pourrait pas faire.
     */
    const lire = async (mot: string): Promise<number> => {
      const ligne = vue.locator('a', { has: page.getByText(mot, { exact: true }) }).first();
      const texte = (await ligne.textContent()) ?? '';
      return Number(texte.replace(mot, '').trim());
    };

    const tout = await lire('Tout');
    const types = ['Guides', 'Sujets', 'Entraide', 'Logement', 'Emploi', 'Événements', 'Membres', 'Villes', 'Pros'];
    let somme = 0;
    for (const t of types) somme += await lire(t);
    expect(tout).toBe(somme);
    expect(tout).toBeGreaterThan(0);
  });

  test('un filtre de la colonne filtre vraiment, et se montre retenu', async ({ page, request }) => {
    await connecter(page.context(), request, { displayName: 'Awa Konate' });
    await page.setViewportSize({ width: 1700, height: 1000 });
    await page.goto('/recherche?q=aix');

    /**
     * ── POURQUOI « VILLES » ET PAS « MEMBRES » ────────────────────────────
     *
     * Première version : le filtre « Membres » sur la requête « lyon ». Elle a
     * rougi, et pour une raison qui n'était pas un défaut du produit — MESURÉ dans
     * l'index : « lyon » ne correspond qu'à UN document, de type `CITY`. Le filtre
     * menait donc à une page légitimement vide, et le cas mesurait l'état du jeu de
     * données plutôt que le filtre.
     *
     * La ville de la requête est, elle, dans le référentiel : elle est indexée dans
     * toute base où le produit tourne. Et elle couvre mieux : son adresse est
     * `/villes/<slug>`, donc elle éprouve AUSSI la résolution d'un slug par le
     * serveur, là qu'un identifiant brut n'aurait rien éprouvé.
     */
    const vue = cadre(page);
    const villes = vue.locator('a', { has: page.getByText('Villes', { exact: true }) }).first();
    await villes.click();

    await expect(page).toHaveURL(/type=CITY/);
    /** `aria-current="page"` : le filtre retenu se dit, il n'est pas que peint. */
    await expect(cadre(page).locator('a[aria-current="page"]')).toContainText('Villes');

    /**
     * ET LES RÉSULTATS SONT DE CE TYPE. Sans cette ligne, le cas ne mesurerait que
     * l'adresse : un filtre qui change l'URL sans changer la liste passerait.
     */
    const cartes = cadre(page).locator('[data-cadre-cliquable]');
    expect(await cartes.count()).toBeGreaterThan(0);
    await expect(cartes.first()).toContainText('Ville');
  });

  test('une carte de résultat ouvre son élément — le chevron ne promettait rien', async ({
    page,
    request,
  }) => {
    await connecter(page.context(), request, { displayName: 'Awa Konate' });
    await page.setViewportSize({ width: 1700, height: 1000 });
    await page.goto('/recherche?q=aix&type=CITY');

    const premiere = cadre(page).locator('[data-cadre-cliquable]').first();
    const vers = await premiere.getAttribute('data-cadre-cliquable');
    /**
     * L'ADRESSE EST COMPOSÉE PAR LE SERVEUR, et elle porte un SLUG — pas
     * l'identifiant du document. C'est ce que `destinations` résout : quatre des
     * neuf types ne s'ouvrent pas par leur identifiant, et le front n'a pas à
     * connaître trois référentiels pour poser un lien.
     */
    expect(vers).toMatch(/^\/villes\/[a-z0-9-]+$/);
    await premiere.click();
    await expect(page).toHaveURL(new RegExp(`${vers ?? 'x'}$`));
  });

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LES PROPOSITIONS PENDANT LA FRAPPE                                       ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le seuil est de trois caractères (§2.3) : en dessous, le serveur REFUSE la
   * requête, donc on ne l'appelle pas. Le cas tape donc deux caractères d'abord,
   * et vérifie qu'il n'y a RIEN — sans quoi il ne mesurerait pas le seuil mais
   * seulement l'arrivée des propositions.
   */
  test('taper ouvre les propositions, et en choisir une ouvre l’élément', async ({ page, request }) => {
    await connecter(page.context(), request, { displayName: 'Awa Konate' });
    await page.setViewportSize({ width: 1700, height: 1000 });
    await page.goto('/accueil');

    const champ = cadre(page).locator('form[role="search"] input');
    await champ.fill('ai');
    await expect(page.locator('[data-recherche-suggestions]')).toHaveCount(0);

    await champ.fill('aix');
    const panneau = page.locator('[data-recherche-suggestions]');
    await expect(panneau).toBeVisible({ timeout: 5000 });

    /** Le panneau tombe SOUS le champ, pas par-dessus : c'est ce qu'il annonce. */
    const boiteChamp = await cadre(page).locator('form[role="search"]').boundingBox();
    const boitePanneau = await panneau.boundingBox();
    expect(boitePanneau?.y ?? 0).toBeGreaterThan((boiteChamp?.y ?? 0) + (boiteChamp?.height ?? 0) - 1);

    const premiere = panneau.locator('[data-recherche-suggestion]').first();
    const vers = await premiere.getAttribute('href');
    expect(vers).not.toBeNull();
    /**
     * ELLE NE RAMÈNE PAS SUR LA PAGE DE RECHERCHE. C'est toute la demande : « aller
     * directement sur un élément ». Une proposition qui mène à `/recherche?q=…` est
     * ce que le produit savait déjà faire avec la touche Entrée.
     */
    expect(vers).not.toContain('/recherche');

    await premiere.click();
    await expect(page).toHaveURL(new RegExp(`${vers ?? 'x'}$`));
  });

  test('la croix efface la saisie et referme les propositions', async ({ page, request }) => {
    await connecter(page.context(), request, { displayName: 'Awa Konate' });
    await page.setViewportSize({ width: 1700, height: 1000 });
    await page.goto('/accueil');

    const champ = cadre(page).locator('form[role="search"] input');
    await champ.fill('aix');
    await expect(page.locator('[data-recherche-suggestions]')).toBeVisible({ timeout: 5000 });

    await cadre(page).locator('[data-recherche-effacer]').click();
    await expect(champ).toHaveValue('');
    await expect(page.locator('[data-recherche-suggestions]')).toHaveCount(0);
  });

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LE RAIL REND LA NAVIGATION QUE LA COLONNE A CÉDÉE                        ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le cas est posé SUR LA PAGE DE RECHERCHE, et c'est le point : c'est là que la
   * colonne de gauche ne porte plus le menu de section. Si le survol ne marchait
   * que sur l'accueil, la demande ne serait pas tenue.
   */
  test('survoler une rubrique du rail déplie son menu, et ses entrées mènent quelque part', async ({
    page,
    request,
  }) => {
    await connecter(page.context(), request, { displayName: 'Awa Konate' });
    await page.setViewportSize({ width: 1700, height: 1000 });
    await page.goto('/recherche?q=aix');

    const vue = cadre(page);
    await expect(page.locator('[data-rail-survol]')).toHaveCount(0);

    const rail = vue.locator('nav').first();
    await rail.getByText('Accueil', { exact: true }).hover();

    const volet = page.locator('[data-rail-survol="Accueil"]');
    await expect(volet).toBeVisible();
    await expect(volet.getByText('Guides & Démarches')).toBeVisible();

    /**
     * LE VOLET FLOTTE À DROITE DU RAIL, par-dessus la colonne de contexte. Sans
     * cette mesure, un volet rendu SOUS le rail — donc invisible — passerait.
     */
    const boiteRail = await rail.boundingBox();
    const boiteVolet = await volet.boundingBox();
    expect(boiteVolet?.x ?? 0).toBeGreaterThanOrEqual((boiteRail?.x ?? 0) + (boiteRail?.width ?? 0));

    await volet.getByText('Guides & Démarches').click();
    await expect(page).toHaveURL(/\/guides$/);
  });

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LA RUBRIQUE OÙ L'ON EST DÉJÀ NE DÉPLIE RIEN                             ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « sur les pages où l'un des menus est actif, le menu actif, son
   * hover ne doit pas marcher ». Sur `/entraide`, la colonne de gauche porte déjà
   * la carte « ENTRAIDE » et ses quatre entrées : déplier le volet poserait le même
   * menu par-dessus elle.
   *
   * LE CAS A DEUX MOITIÉS, et la seconde est celle qui compte : sans elle, un
   * composant qui ne déplierait PLUS RIEN passerait au vert.
   *
   * MUTATION : la garde sur `backgroundColor` retirée → la première moitié tombe.
   */
  test('la rubrique active ne déplie rien, les autres si', async ({ page, request }) => {
    await connecter(page.context(), request, { displayName: 'Awa Konate' });
    await page.setViewportSize({ width: 1700, height: 1000 });
    await page.goto('/entraide');

    const rail = cadre(page).locator('nav').first();
    /** Prémisse : la maquette peint bien « Entraide » en actif sur cette page. */
    const actif = rail.getByText('Entraide', { exact: true });
    await expect(actif).toHaveCSS('background-color', 'rgb(255, 255, 255)');

    await actif.hover();
    await expect(page.locator('[data-rail-survol]')).toHaveCount(0);

    // ET LE RAIL N'EST PAS MORT POUR AUTANT.
    await rail.getByText('Agenda', { exact: true }).hover();
    await expect(page.locator('[data-rail-survol="Agenda"]')).toBeVisible();
  });

  test('une autre rubrique déplie un AUTRE menu, et le survol du bas le referme', async ({
    page,
    request,
  }) => {
    await connecter(page.context(), request, { displayName: 'Awa Konate' });
    await page.setViewportSize({ width: 1700, height: 1000 });
    await page.goto('/recherche?q=aix');

    const rail = cadre(page).locator('nav').first();
    await rail.getByText('Services', { exact: true }).hover();
    await expect(page.locator('[data-rail-survol="Services"]')).toBeVisible();
    await expect(page.locator('[data-rail-survol="Services"]').getByText('Annuaire professionnel')).toBeVisible();

    await rail.getByText('Entraide', { exact: true }).hover();
    await expect(page.locator('[data-rail-survol="Services"]')).toHaveCount(0);
    await expect(page.locator('[data-rail-survol="Entraide"]')).toBeVisible();
  });
});
