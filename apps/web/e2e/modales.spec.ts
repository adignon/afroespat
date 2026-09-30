import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * Les modales du fil — « fenêtre sur web, feuille sur mobile », comme la maquette
 * l'écrit sous chacune de ses planches.
 *
 * Ce que ces tests éprouvent n'est PAS le dessin : il est transcodé, donc il est
 * celui de la maquette par construction. Ils éprouvent ce qu'une image ne peut pas
 * contenir — la bascule de forme au bon seuil, l'ouverture, les trois façons de
 * fermer, et les promesses d'accessibilité que `aria-modal` engage.
 *
 * Les assertions portent sur la GÉOMÉTRIE et les RÔLES, jamais sur des classes :
 * le balisage vient de la maquette en styles en ligne, et viser une classe se
 * casserait à la première régénération.
 */

/** Ce fichier pilote lui-même ses tailles : un seul projet suffit. */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'piloté par le test');

/**
 * LE FIL EST SERVI PAR DES CHARGES RELEVÉES, ET IL DOIT L'ÊTRE.
 *
 * Ces tests échouaient tous, et pour une raison qu'il faut nommer : depuis que le
 * fil est branché sur l'API, ses cartes — donc les DÉCLENCHEURS des deux fenêtres,
 * qui vivent dans la boucle des publications — n'existent que s'il y a des
 * publications. Un navigateur de test arrive sans session : `GET /feed` répond
 * `401`, le fil est vide, et `[data-modal-open]` ne désigne plus rien. Les
 * quatorze tests attendaient un bouton qui ne pouvait pas être là.
 *
 * Ouvrir une vraie session dans ces tests serait le mauvais remède : ils éprouvent
 * la FORME et les promesses d'`aria-modal`, pas l'authentification, et ils ne
 * doivent pas se mettre à dépendre d'un jeu de données en base.
 *
 * Les charges viennent donc de `packages/shared/src/__tests__/fixtures/` — les
 * mêmes réponses relevées OCTET POUR OCTET que les tests unitaires emploient, pas
 * des objets écrits pour la circonstance. Si le contrat de l'API bouge, ces
 * fixtures cessent d'être valides et les tests unitaires le disent aussi.
 */
/**
 * `__dirname`, ET SURTOUT PAS `import.meta` : Playwright transpile ses specs en
 * CommonJS, où toute mention d'`import.meta` échoue AU CHARGEMENT — et l'erreur se
 * présente en « No tests found », qui ne désigne pas la cause. Une heure peut y
 * passer. Les tests unitaires (Vitest, en module) emploient `import.meta.dirname` ;
 * les deux mondes ne se ressemblent pas sur ce point.
 */
const FIXTURES = resolve(__dirname, '../../../packages/shared/src/__tests__/fixtures');

const charge = (nom: string): Record<string, unknown> =>
  JSON.parse(readFileSync(resolve(FIXTURES, `${nom}.json`), 'utf8')) as Record<string, unknown>;

async function servirLeFil(page: Page): Promise<void> {
  const fil = charge('feed');
  const bandeau = charge('stories_band');
  const commentaires = charge('comments');

  /**
   * `onlineContacts` est VIDE dans la charge relevée — le membre de la session
   * mesurée n'avait aucun contact vu depuis moins de dix minutes. La fenêtre de
   * partage n'aurait alors personne à cocher, et le test du libellé n'éprouverait
   * rien.
   *
   * On y place donc deux membres pris dans `newArrivals` de la MÊME charge : des
   * objets `memberSummary` réels, dans leur forme exacte, et non deux contacts
   * inventés. C'est la seule retouche, et elle est ici plutôt que dans la fixture
   * — celle-ci doit rester ce que l'API a répondu.
   */
  const colonne = charge('feed_sidebar');
  const arrivants = (colonne['newArrivals'] as { items: unknown[] }).items;
  const sidebar = { ...colonne, onlineContacts: arrivants.slice(0, 2) };

  /**
   * `Access-Control-Allow-Origin: *` NE MARCHE PAS ICI, et l'erreur ne ressemble
   * à rien d'utile — « Failed to load resource », le fil vide, aucun déclencheur.
   *
   * Le socle envoie `credentials: 'include'` (le cookie de rafraîchissement en
   * dépend), et pour une requête créditée le navigateur REFUSE le joker : l'origine
   * doit être écrite, et `Access-Control-Allow-Credentials: true` présent. On
   * RENVOIE donc l'origine de la requête plutôt que d'écrire un port en dur —
   * `WEB_PORT` change d'un arbre de travail à l'autre.
   */
  const entetes = (route: { request(): { headers(): Record<string, string> } }) => ({
    'access-control-allow-origin': route.request().headers()['origin'] ?? '*',
    'access-control-allow-credentials': 'true',
  });

  const servir = (body: unknown) => (route: Parameters<Parameters<Page['route']>[1]>[0]) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: entetes(route),
      body: JSON.stringify(body),
    });

  /**
   * La reprise de session n'a RIEN à reprendre, et elle doit échouer proprement :
   * un `401` avec les bons en-têtes, comme l'API le renvoie. Laisser la vraie route
   * répondre marcherait aussi, mais ces tests ne doivent pas dépendre de l'API.
   */
  await page.route('**/v1/auth/refresh', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      headers: entetes(route),
      body: '{"error":{"code":"UNAUTHENTICATED","message":"Session expirée."}}',
    }),
  );
  await page.route('**/v1/feed/sidebar*', servir(sidebar));
  await page.route('**/v1/feed?**', servir(fil));
  await page.route('**/v1/feed', servir(fil));
  await page.route('**/v1/stories?**', servir(bandeau));
  await page.route('**/v1/stories', servir(bandeau));
  await page.route('**/v1/comments?**', servir(commentaires));
}

async function visit(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await servirLeFil(page);
  await page.goto('/accueil', { waitUntil: 'networkidle' });
  // Le fil arrive après le premier rendu : les déclencheurs n'existent qu'ensuite.
  await page.locator('[data-modal-open="A01C"]').first().waitFor({ state: 'attached' });
}

/** Le déclencheur visible à cette largeur — les deux cadres sont dans le document. */
function trigger(page: Page, modal: string, width: number) {
  const frame = width >= 1024 ? '[data-frame="desktop"]' : '[data-frame="mobile"]';
  return page.locator(`${frame} [data-modal-open="${modal}"]`).first();
}

test.describe('ouverture et forme', () => {
  test('1440 px — « Commenter » ouvre une FENÊTRE centrée', async ({ page }) => {
    await visit(page, 1440);
    await trigger(page, 'A01C', 1440).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const panel = dialog.locator('[data-modal-panel]');
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    if (box === null) return;

    // La maquette fixe le panneau à 720 px, et le centre horizontalement.
    expect(Math.round(box.width)).toBe(720);
    const centre = box.x + box.width / 2;
    expect(Math.abs(centre - 1440 / 2)).toBeLessThan(2);
    // Une fenêtre ne touche pas le bas de l'écran : la maquette laisse 40 px.
    expect(box.y).toBeGreaterThan(20);
  });

  test('390 px — « Commenter » ouvre une FEUILLE collée en bas', async ({ page }) => {
    await visit(page, 390);
    await trigger(page, 'A01C', 390).click();

    const panel = page.getByRole('dialog').locator('[data-modal-panel]');
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    if (box === null) return;

    // Toute la largeur, et posée sur le bord bas — c'est ce qui distingue une
    // feuille d'une fenêtre, et c'est le seul point que la géométrie peut dire.
    expect(Math.round(box.width)).toBe(390);
    expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(898);
  });

  test('le seuil est à 1024 px, le même que celui des écrans', async ({ page }) => {
    for (const { w, forme } of [
      { w: 1023, forme: 'feuille' },
      { w: 1024, forme: 'fenetre' },
    ] as const) {
      await visit(page, w);
      await trigger(page, 'A01C', w).click();
      const box = await page.getByRole('dialog').locator('[data-modal-panel]').boundingBox();
      expect(box, `${w} px`).not.toBeNull();
      if (box === null) continue;
      if (forme === 'feuille') expect(Math.round(box.width), `${w} px`).toBe(w);
      else expect(Math.round(box.width), `${w} px`).toBeLessThan(w);
    }
  });

  test('« Partager » ouvre SA fenêtre, pas celle des commentaires', async ({ page }) => {
    await visit(page, 1440);
    await trigger(page, 'A01P', 1440).click();
    // Le nom accessible vient du titre VISIBLE de la maquette, via aria-labelledby.
    await expect(page.getByRole('dialog', { name: /Partager/ })).toBeVisible();
    await expect(page.getByRole('dialog', { name: /Commentaires/ })).toHaveCount(0);
  });
});

test.describe('fermeture — les trois chemins', () => {
  test('la croix ferme', async ({ page }) => {
    await visit(page, 1440);
    await trigger(page, 'A01C', 1440).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('Échap ferme', async ({ page }) => {
    await visit(page, 1440);
    await trigger(page, 'A01C', 1440).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('un clic sur le voile ferme, un clic DANS le panneau non', async ({ page }) => {
    await visit(page, 1440);
    await trigger(page, 'A01C', 1440).click();

    // D'abord la moitié qu'on oublie : cliquer dans le panneau ne doit RIEN faire.
    // Sans cette garde, un membre qui sélectionne du texte et relâche hors de la
    // zone perdrait ce qu'il écrivait.
    await page.getByRole('dialog').locator('[data-modal-panel]').click({ position: { x: 10, y: 10 } });
    await expect(page.getByRole('dialog')).toBeVisible();

    // Le voile occupe tout l'écran ; on clique là où le panneau n'est pas.
    await page.mouse.click(30, 450);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('la poignée de la feuille est un vrai bouton, et sa cible est atteignable au doigt', async ({ page }) => {
    await visit(page, 390);
    await trigger(page, 'A01C', 390).click();

    const handle = page.getByRole('dialog').getByRole('button', { name: 'Fermer' });
    const box = await handle.boundingBox();
    expect(box).not.toBeNull();
    if (box === null) return;

    /**
     * La barre visible mesure 40 × 5 px dans la maquette. C'est juste comme
     * dessin, inutilisable comme bouton — et c'est le SEUL contrôle de la feuille.
     * La cible est donc élargie par du remplissage, sans que la barre grandisse.
     */
    expect(box.height).toBeGreaterThanOrEqual(24);
    expect(box.width).toBeGreaterThanOrEqual(24);

    await handle.click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

test.describe('ce que `aria-modal` promet', () => {
  test('la boîte de dialogue porte le nom de son titre VISIBLE', async ({ page }) => {
    await visit(page, 1440);
    await trigger(page, 'A01C', 1440).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    // `aria-labelledby` désigne le `<h2>` que le transcodeur a promu : le nom
    // accessible ne peut donc pas dériver du texte affiché.
    await expect(dialog).toHaveAttribute('aria-labelledby', 'a01c-titre');
    await expect(page.locator('#a01c-titre')).toContainText('Commentaires');
    // UN SEUL élément porte cet identifiant. Deux — un par cadre — rendraient
    // `aria-labelledby` ambigu et la modale pourrait prendre le nom du cadre masqué.
    await expect(page.locator('#a01c-titre')).toHaveCount(1);
  });

  test('un seul `main` dans le document, même modale ouverte', async ({ page }) => {
    await visit(page, 1440);
    const before = await page.getByRole('main').count();
    await trigger(page, 'A01C', 1440).click();
    // Une modale n'est pas le contenu principal de la page : c'est celui qui est
    // DERRIÈRE elle. Deux repères `main` ne sont pas interprétables.
    expect(await page.getByRole('main').count()).toBe(before);
  });

  test('Tab tourne en rond dans le panneau', async ({ page }) => {
    await visit(page, 1440);
    await trigger(page, 'A01C', 1440).click();

    const dialog = page.getByRole('dialog');
    // Vingt tabulations : bien plus que le nombre de contrôles du panneau. Si le
    // piège fuit, le focus finit dans le fil, derrière le voile — la promesse
    // d'`aria-modal` serait fausse et le membre parcourrait un écran qu'il ne voit
    // plus.
    for (let n = 0; n < 20; n += 1) {
      await page.keyboard.press('Tab');
      const inside = await dialog.evaluate(
        (node, _) => node.contains(document.activeElement),
        null,
      );
      expect(inside, `après ${n + 1} tabulation(s)`).toBe(true);
    }
  });

  test('le focus REVIENT sur le bouton qui a ouvert', async ({ page }) => {
    await visit(page, 1440);
    const opener = trigger(page, 'A01C', 1440);
    await opener.click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Sans le retour de focus, refermer renvoie au début du document : un membre
    // au clavier doit re-parcourir tout le fil pour revenir où il était.
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-modal-open'));
    expect(focused).toBe('A01C');
  });

  test('le défilement de la page est bloqué pendant l’ouverture, et rendu après', async ({ page }) => {
    await visit(page, 1440);
    await trigger(page, 'A01C', 1440).click();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  });
});

test.describe('le partage se manipule', () => {
  /**
   * LE LIBELLÉ PORTE L'ÉTAT, et il part maintenant de ZÉRO contact.
   *
   * La maquette en coche deux d'avance (rangs 0 et 2) parce qu'une planche doit
   * montrer l'état sélectionné. Avec de VRAIS contacts — ceux que
   * `GET /feed/sidebar` calcule — deux cases cochées désigneraient deux personnes
   * que le membre n'a pas choisies. L'écran part donc de rien, et le bouton dit
   * « Choisissez un contact » : c'est exactement l'état que la maquette dessine
   * pour zéro, donc rien n'est inventé.
   */
  test('choisir un contact change le libellé du bouton', async ({ page }) => {
    await visit(page, 1440);
    await trigger(page, 'A01P', 1440).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/Choisissez un contact/)).toBeVisible();

    /**
     * Les contacts sont visés PAR LEUR NOM, lu dans la charge servie — donc de
     * vrais membres, et un test qui tombe si le nom cesse d'être affiché.
     *
     * Et non par `aria-pressed` : LA MAQUETTE NE LE POSE PAS sur ces boutons. La
     * sélection n'y est marquée que par un anneau vert, ce qui ne dit rien à un
     * lecteur d'écran — le générateur pose bien `aria-pressed` sur les pastilles de
     * palette de A14, jamais ici. C'est un manque réel, remonté au rapport de lot ;
     * ce test ne le contourne pas en silence, il le nomme.
     */
    const contacts = (charge('feed_sidebar')['newArrivals'] as {
      items: { displayName: string }[];
    }).items;

    // « cliquez les contacts », dit la maquette : c'est une vraie interaction.
    await dialog.getByRole('button', { name: new RegExp(contacts[0]!.displayName) }).click();
    await expect(dialog.getByText(/Envoyer à 1 contact$/)).toBeVisible();

    // Et un second choix passe au pluriel — le libellé COMPTE, il n'alterne pas.
    await dialog.getByRole('button', { name: new RegExp(contacts[1]!.displayName) }).click();
    await expect(dialog.getByText(/Envoyer à 2 contacts$/)).toBeVisible();
  });
});

/**
 * LE DÉFAUT RÉPARÉ, VU DEPUIS LE NAVIGATEUR.
 *
 * Le test unitaire (`src/screens/publication/declencheur.test.tsx`) garde le JSX
 * généré ; celui-ci garde la CHAÎNE COMPLÈTE : le clic, l'écouteur délégué de la
 * page, et l'appel réseau qui en sort. C'est la moitié qu'un test de rendu ne peut
 * pas voir — un attribut correct que la page lirait mal ne réparerait rien.
 *
 * Avant la correction, les quatre publications de la charge ouvraient la même
 * fenêtre : le déclencheur ne portait que le NOM de la fenêtre, et l'écouteur, qui
 * ne voit que l'élément cliqué, ne pouvait pas savoir laquelle.
 */
test.describe('la fenêtre de commentaires sait DE QUELLE publication elle parle', () => {
  test('chaque carte porte son propre identifiant', async ({ page }) => {
    await visit(page, 1440);
    const sujets = await page
      .locator('[data-frame="desktop"] [data-modal-open="A01C"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-modal-subject')));

    expect(sujets.length, 'la charge doit porter plusieurs publications').toBeGreaterThan(1);
    expect(sujets.every((s) => s !== null && s !== '')).toBe(true);
    expect(new Set(sujets).size, 'deux cartes ne peuvent pas désigner la même').toBe(sujets.length);
  });

  test('cliquer la seconde carte demande LES commentaires de la seconde', async ({ page }) => {
    await visit(page, 1440);
    const boutons = page.locator('[data-frame="desktop"] [data-modal-open="A01C"]');
    const attendu = await boutons.nth(1).getAttribute('data-modal-subject');

    const appel = page.waitForRequest(
      (r) => r.url().includes('/comments') && r.url().includes('subjectType=POST'),
    );
    await boutons.nth(1).click();
    const url = new URL((await appel).url());

    expect(url.searchParams.get('subjectId')).toBe(attendu);
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('et cliquer la première demande ceux de la première', async ({ page }) => {
    await visit(page, 1440);
    const boutons = page.locator('[data-frame="desktop"] [data-modal-open="A01C"]');
    const premier = await boutons.nth(0).getAttribute('data-modal-subject');
    const second = await boutons.nth(1).getAttribute('data-modal-subject');
    expect(premier).not.toBe(second);

    const appel = page.waitForRequest(
      (r) => r.url().includes('/comments') && r.url().includes('subjectType=POST'),
    );
    await boutons.nth(0).click();
    expect(new URL((await appel).url()).searchParams.get('subjectId')).toBe(premier);
  });
});
