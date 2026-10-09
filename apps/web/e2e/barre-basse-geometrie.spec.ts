import { expect, test, type Page } from '@playwright/test';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA BARRE D'ONGLETS BASSE RESTAIT EN L'AIR, ET ELLE VOLAIT LE CLIC DU « + » ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Mesuré au navigateur sur `/villes/lyon` à 390 px, avant correction :
 *
 *   LE +  : haut=680 bas=736  position=fixed   z=auto  bottom=108px
 *   BARRE : haut=684 bas=769  position=sticky  z=10    bottom=0px
 *   document=844px  vue=844px
 *
 * La barre finissait à 769 dans une vue de 844 : il restait SOIXANTE-QUINZE
 * PIXELS DE VIDE sous elle. Le cadre mobile fait bien ses 844 px en colonne flex,
 * mais aucun de ses enfants ne grandissait — et une colonne flex tasse ses
 * enfants en haut. La barre n'était donc pas mal empilée : elle était trop haute.
 *
 * Et le « + » flottant, lui ancré à la FENÊTRE par `bottom: 108px`, occupait
 * 680→736. La barre lui recouvrait 52 de ses 56 pixels, avec un `z-index: 10`
 * contre son `auto` : `elementFromPoint` au centre du bouton rendait l'icône
 * « Compte » de la barre, et le clic n'ouvrait JAMAIS la fenêtre de contribution.
 * Un appel à l'action principal inerte, sur une page où la maquette dessine
 * précisément le « + » 108 px au-dessus du bord pour qu'il DÉGAGE une barre de
 * 85 px.
 *
 * La cause était dans `tools/generate-screens.mjs` : l'adaptation « le contenu
 * doit couler » retirait `flex: "1", minHeight: "0"` en même temps qu'elle
 * ouvrait l'`overflow`. Retirer le `minHeight` est juste — c'est lui qui
 * autorisait la compression. Retirer le `flex-grow` avec lui était le défaut.
 *
 * ── POURQUOI CES TROIS CAS, ET PAS UNE CAPTURE D'ÉCRAN ──────────────────────
 *
 * Une image aurait montré le vide sans dire qu'il rendait un bouton inerte, et
 * une image ne distingue pas « la barre est au bon endroit » de « la barre est
 * au bon endroit PARCE QUE le contenu remplit ». Les trois propriétés sont donc
 * mesurées séparément, par la GÉOMÉTRIE et par le POINTEUR, jamais par une
 * classe :
 *
 *   1. la barre touche le bord bas de la vue ;
 *   2. le déclencheur flottant reçoit le pointeur en son centre ;
 *   3. un contenu plus haut que la vue DÉFILE toujours — la correction pose un
 *      `flex-grow`, pas une hauteur, et ce cas-là le prouve. Sans lui, remettre
 *      le `flex: 1` d'origine (donc `flex-basis: 0%`) rendrait les deux premiers
 *      cas verts en replafonnant le contenu, c'est-à-dire en rétablissant le
 *      défaut que l'adaptation corrigeait au départ.
 */

test.beforeEach(async ({ page }) => {
  /**
   * Le fourre-tout d'abord, la reprise ensuite : Playwright donne la main au
   * DERNIER motif inscrit. Ces cas éprouvent le DESSIN, pas le réseau — et le
   * fourre-tout garantit qu'aucun appel ne part vers l'API d'un autre arbre.
   */
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

/**
 * Les routes dont la maquette dessine une barre d'onglets basse sur le cadre
 * mobile. Chacune était touchée : la barre vit sur 54 cadres, rigoureusement la
 * même partout.
 */
const AVEC_BARRE = [
  '/accueil',
  '/villes/lyon',
  '/entraide',
  '/agenda',
  '/messages',
  '/notifications',
  '/recherche',
  '/parcours',
  '/compte/profil',
] as const;

/** La barre, reconnue à sa FORME — cinq colonnes et un filet haut. Jamais à une classe. */
const mesureBarre = (page: Page) =>
  page.evaluate(() => {
    const cadre = document.querySelector('[data-frame="mobile"]');
    if (cadre === null) return { trouvee: false as const, raison: 'aucun cadre mobile' };
    const barre = [...cadre.querySelectorAll('div')].find(
      (d) =>
        getComputedStyle(d).gridTemplateColumns.split(' ').length === 5 &&
        getComputedStyle(d).borderTopWidth === '1px',
    );
    if (barre === undefined) return { trouvee: false as const, raison: 'aucune barre basse' };
    return {
      trouvee: true as const,
      bas: Math.round(barre.getBoundingClientRect().bottom),
      vue: window.innerHeight,
    };
  });

test.describe('la barre d’onglets basse touche le bord bas de la vue', () => {
  for (const route of AVEC_BARRE) {
    test(`${route} — 390 px`, async ({ page }) => {
      test.skip((page.viewportSize()?.width ?? 0) !== 390, 'la barre basse n’existe qu’en mobile');
      await page.goto(route, { waitUntil: 'load' });

      const m = await mesureBarre(page);
      expect(m.trouvee, `${route} : ${m.trouvee ? '' : m.raison}`).toBe(true);
      if (!m.trouvee) return;

      /**
       * UN PIXEL DE TOLÉRANCE, et pas davantage : la mesure est arrondie, et
       * `bas` et `vue` sont deux entiers calculés par des chemins différents.
       * Soixante-quinze pixels d'écart — le défaut — ne passent pas.
       */
      expect(
        Math.abs(m.bas - m.vue),
        `${route} : la barre finit à ${m.bas} pour une vue de ${m.vue} — ${m.vue - m.bas} px de vide sous elle`,
      ).toBeLessThanOrEqual(1);
    });
  }
});

test.describe('le déclencheur flottant reçoit le pointeur', () => {
  /**
   * Les deux cadres mobiles qui dessinent un bouton flottant PAR-DESSUS la barre.
   * A12 est celui que la mesure a pris en défaut ; A01 porte la même forme, et
   * l'inclure fait que la correction est tenue là où elle n'avait pas encore
   * échoué.
   */
  for (const route of ['/villes/lyon', '/accueil'] as const) {
    test(`${route} — 390 px, le « + » n’est pas couvert`, async ({ page }) => {
      test.skip((page.viewportSize()?.width ?? 0) !== 390, 'le « + » flottant est mobile');
      await page.goto(route, { waitUntil: 'load' });

      const verdict = await page.evaluate(() => {
        const cadre = document.querySelector('[data-frame="mobile"]');
        const bouton = cadre?.querySelector('[data-modal-open]');
        if (bouton == null) return 'AUCUN DÉCLENCHEUR FLOTTANT';
        const r = bouton.getBoundingClientRect();
        /**
         * `elementFromPoint` dit QUI RECEVRAIT LE CLIC, ce qu'un test de
         * visibilité ne dit pas : le bouton était visible, et couvert.
         */
        const atteint = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (atteint === bouton || bouton.contains(atteint)) return 'LE DÉCLENCHEUR REÇOIT';
        return `COUVERT PAR « ${(atteint?.closest('div')?.textContent ?? '').trim().slice(0, 24)} »`;
      });

      expect(verdict).toBe('LE DÉCLENCHEUR REÇOIT');
    });
  }
});

test('un contenu plus haut que la vue DÉFILE toujours — la correction pose un flex-grow, pas une hauteur', async ({
  page,
}) => {
  test.skip((page.viewportSize()?.width ?? 0) !== 390, 'mesuré sur le cadre mobile');

  /**
   * `/parrainage` est la route MESURÉE comme débordante : 1 077 px de document
   * pour une vue de 844. C'est le témoin de la correction — si quelqu'un
   * remettait `flex: 1` (donc `flex-basis: 0%`), le contenu serait replafonné à
   * la vue et ce cas tomberait, alors que les deux précédents resteraient verts.
   */
  await page.goto('/parrainage', { waitUntil: 'load' });

  const m = await page.evaluate(() => ({
    document: document.scrollingElement?.scrollHeight ?? 0,
    vue: window.innerHeight,
  }));

  expect(
    m.document,
    `le contenu de /parrainage est replafonné : ${m.document} px pour une vue de ${m.vue}`,
  ).toBeGreaterThan(m.vue);

  // Et la barre reste visible malgré le défilement : c'est son `position: sticky`.
  const barre = await mesureBarre(page);
  expect(barre.trouvee).toBe(true);
  if (barre.trouvee) expect(Math.abs(barre.bas - barre.vue)).toBeLessThanOrEqual(1);
});
