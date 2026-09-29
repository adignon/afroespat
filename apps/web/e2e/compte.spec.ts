import { expect, test, type Page } from '@playwright/test';

/**
 * Les dix écrans du module Compte — K01 à K10.
 *
 * Ce que ces tests éprouvent n'est PAS le dessin : il est transcodé de
 * `docs/template/08 Compte.dc.html`, donc il est celui de la maquette par
 * construction. Ils éprouvent ce qu'une image ne peut pas contenir — la route
 * qui mène à chaque planche, les états que l'URL choisit, et les DEUX RÈGLES
 * DURES que ce module doit rendre visibles :
 *
 *   · 01 §2.1 — aucun numéro de téléphone en clair, jamais ;
 *   · 14 §4.1 — aucune donnée de carte ne transite ni ne s'affiche.
 *
 * Les assertions portent sur la GÉOMÉTRIE et les RÔLES, jamais sur des classes :
 * le balisage vient de la maquette en styles en ligne, et viser une classe se
 * casserait à la première régénération.
 */

/** Ce fichier pilote lui-même ses tailles : un seul projet suffit. */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'piloté par le test');

/**
 * `load` et non `networkidle` : ces écrans n'émettent AUCUNE requête — la
 * maquette est statique et ce lot ne branche pas l'API. `networkidle` n'arrive
 * d'ailleurs jamais, puisque Next précharge les liens visibles ; `page.goto`
 * expirerait au bout de trente secondes sur un message qui ne nomme pas la cause.
 */
async function visiter(page: Page, url: string, width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(url, { waitUntil: 'load' });
}

/** Le cadre visible à cette largeur — les deux sont dans le document. */
const cadre = (width: number) => (width >= 1024 ? '[data-frame="desktop"]' : '[data-frame="mobile"]');

/**
 * Les dix routes de T5 §9, avec le titre que la maquette écrit sur chaque cadre.
 *
 * Le titre est celui que le transcodeur a promu en `<h1>` : c'est le texte
 * VISIBLE de la maquette, pas un titre inventé pour la route. Les deux cadres ne
 * le disent pas toujours pareil, et c'est la maquette qui en décide — K01 titre
 * « Mon profil » sur ordinateur et « Compte » sur téléphone, parce que l'en-tête
 * mobile range les huit onglets sous le nom de la SECTION.
 */
const ROUTES = [
  { url: '/compte/profil', ecran: 'K01', bureau: 'Mon profil', mobile: 'Compte' },
  { url: '/@fatou.n', ecran: 'K02', bureau: 'Fatou NdiayeNiveau 2', mobile: 'Fatou Ndiaye' },
  { url: '/compte/verification', ecran: 'K03', bureau: 'Vérification et niveaux', mobile: 'Compte' },
  { url: '/compte/securite', ecran: 'K04', bureau: 'Téléphones et sessions', mobile: 'Compte' },
  { url: '/compte/contacts', ecran: 'K05', bureau: 'Contacts', mobile: 'Contacts' },
  { url: '/compte/abonnement', ecran: 'K06', bureau: 'Abonnement et Premium', mobile: 'Premium' },
  { url: '/compte/notifications', ecran: 'K07', bureau: 'Notifications', mobile: 'Notifications' },
  { url: '/compte/donnees', ecran: 'K08', bureau: 'Mes données', mobile: 'Mes données' },
  { url: '/compte/sanctions', ecran: 'K09', bureau: 'Sanctions', mobile: 'Sanctions' },
  { url: '/compte/enregistres', ecran: 'K10', bureau: 'Enregistrés', mobile: 'Enregistrés' },
] as const;

test.describe('les dix routes du module', () => {
  for (const { url, ecran, bureau, mobile } of ROUTES) {
    test(`${url} rend ${ecran} et porte SON titre, aux deux largeurs`, async ({ page }) => {
      for (const { width, titre } of [
        { width: 1440, titre: bureau },
        { width: 390, titre: mobile },
      ]) {
        await visiter(page, url, width);
        await expect(page.locator(`[data-screen="${ecran}"]`)).toHaveCount(1);

        /**
         * Le titre est cherché par RÔLE, dans le cadre VISIBLE.
         *
         * `ScreenFrames` rend les deux cadres et en masque un par CSS : les deux
         * portent donc un `<h1>`, et un locator non scopé en trouverait deux.
         * Le scoper au cadre visible mesure ce que le membre voit.
         */
        const h1 = page.locator(cadre(width)).getByRole('heading', { level: 1 });
        await expect(h1, `${url} à ${width} px`).toHaveText(titre);
      }
    });
  }
});

/**
 * ─── RÈGLE DURE 01 §2.1 — AUCUN NUMÉRO EN CLAIR ────────────────────────────
 *
 * « Aucun numéro de téléphone en clair, jamais ; seulement un masque, et
 * seulement à son propriétaire. »
 *
 * La maquette la tient par le DESSIN — « +229 •• •• •• 42 » — et le transcodage
 * la conserve par construction. Ce test ne suppose pas qu'elle est tenue : il
 * PARCOURT les dix écrans, aux deux largeurs, ramasse tout ce qui ressemble à un
 * numéro, et exige que chacun porte des puces.
 *
 * LE COMPTE EST VÉRIFIÉ, et c'est la moitié qui manque le plus souvent : sans
 * lui, le test passerait tout aussi bien si la maquette cessait d'afficher le
 * moindre numéro — il ne prouverait plus rien du tout.
 */
test.describe('01 §2.1 — aucun numéro de téléphone en clair', () => {
  /** Tout ce qui commence par un « + » et continue en chiffres, espaces ou puces. */
  const NUMERO = /\+\d[\d\s•]{4,}/g;

  test('les dix écrans n’en affichent que des masqués', async ({ page }) => {
    let vus = 0;

    for (const { url } of ROUTES) {
      for (const width of [1440, 390]) {
        await visiter(page, url, width);
        const texte = await page.locator(cadre(width)).innerText();
        for (const numero of texte.match(NUMERO) ?? []) {
          vus += 1;
          expect(numero, `${url} à ${width} px affiche « ${numero.trim()} » sans masque`).toContain(
            '•',
          );
        }
      }
    }

    // K04 en dessine deux par cadre, sur ses deux cadres : le test regarderait
    // dans le vide si ce compte tombait à zéro.
    expect(vus, 'aucun numéro trouvé : le test ne prouverait rien').toBeGreaterThanOrEqual(4);
  });
});

/**
 * ─── RÈGLE DURE 14 §4.1 — AUCUNE DONNÉE DE CARTE ───────────────────────────
 *
 * « Aucune donnée de carte ne transite par le serveur (Stripe Elements /
 * Checkout). »
 *
 * K06 est l'écran d'abonnement : c'est le seul endroit du produit où la question
 * se pose. Ce test regarde l'écran ET la fenêtre de paiement, sur ses trois
 * volets, et exige qu'aucun champ ni libellé de carte n'y figure. « Carte » comme
 * NOM DE MOYEN reste permis — c'est ce que la maquette dessine, à côté de
 * « Mobile Money » — ce qui est interdit, c'est d'en demander les chiffres.
 */
test.describe('14 §4.1 — aucune donnée de carte', () => {
  const INTERDITS = /numéro de carte|cvv|cvc|expiration|titulaire de la carte|card number/i;

  test('ni l’écran ni les trois volets de paiement n’en demandent', async ({ page }) => {
    for (const url of [
      '/compte/abonnement',
      '/compte/abonnement?paiement=numero',
      '/compte/abonnement?paiement=attente',
      '/compte/abonnement?paiement=succes',
      '/premium',
    ]) {
      await visiter(page, url, 1440);
      const texte = await page.locator('body').innerText();
      expect(texte, `${url}`).not.toMatch(INTERDITS);

      // Aucun champ que le navigateur remplirait avec une carte enregistrée.
      await expect(page.locator('[autocomplete^="cc-"]'), url).toHaveCount(0);
    }
  });
});

/**
 * ─── LES TROIS FENÊTRES ────────────────────────────────────────────────────
 *
 * La maquette les dessine en CARTES NUES — sans voile ni positionnement — et
 * leur donne pourtant la croix de fermeture, ce qui est sa façon de dire que ce
 * sont des fenêtres. Le transcodeur pose le voile et le centrage ; ces tests
 * éprouvent que les deux sont bien là et qu'ils servent.
 */
test.describe('K02 — « Ajouter aux contacts »', () => {
  for (const width of [1440, 390]) {
    test(`${width} px — le bouton du cadre visible ouvre la fenêtre`, async ({ page }) => {
      await visiter(page, '/@fatou.n', width);
      await page.locator(`${cadre(width)} [data-modal-open="K02C"]`).first().click();

      // Le nom accessible vient du titre VISIBLE, via `aria-labelledby`.
      const dialog = page.getByRole('dialog', { name: 'Ajouter Fatou aux contacts' });
      await expect(dialog).toBeVisible();

      // 420 px : la largeur que la maquette donne à cette planche. Elle n'a pas
      // de forme mobile, donc la même fenêtre sert aux deux largeurs.
      const box = await dialog.locator('[data-modal-panel]').boundingBox();
      expect(box).not.toBeNull();
      if (box === null) return;
      expect(Math.round(box.width)).toBe(420);
    });
  }

  test('le voile ferme au clic hors du panneau', async ({ page }) => {
    await visiter(page, '/@fatou.n', 1440);
    await page.locator('[data-frame="desktop"] [data-modal-open="K02C"]').first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    /**
     * LE VOILE EST UNE ADAPTATION DU TRANSCODEUR, pas un dessin de la maquette :
     * `08 Compte` n'en écrit aucun, et il est emprunté aux fenêtres de
     * `03 Accueil v2`. Sans lui, `Modal` ne voit qu'un panneau et un clic à côté
     * ne ferme rien — c'est exactement ce que ce test mesure.
     */
    await dialog.locator('[data-modal-overlay]').click({ position: { x: 5, y: 5 } });
    await expect(dialog).toBeHidden();
  });

  test('Échap ferme, et le focus revient sur le bouton d’origine', async ({ page }) => {
    await visiter(page, '/@fatou.n', 1440);
    const bouton = page.locator('[data-frame="desktop"] [data-modal-open="K02C"]').first();
    await bouton.click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(bouton).toBeFocused();
  });
});

/**
 * ─── K06 · LE FLUX MOBILE MONEY (14 §4.2) ──────────────────────────────────
 *
 * Trois volets, trois planches. Ce que ces tests éprouvent, c'est la RÈGLE :
 * aucun clic ne fait avancer le paiement, parce que rien n'est envoyé. Le volet
 * vient de l'URL, qui n'affirme rien.
 */
test.describe('K06 — Mobile Money', () => {
  const VOLETS = [
    { param: 'numero', repere: 'Étape 1 sur 3' },
    { param: 'attente', repere: 'Étape 2 sur 3' },
    { param: 'succes', repere: 'Étape 3 sur 3' },
  ] as const;

  for (const { param, repere } of VOLETS) {
    test(`?paiement=${param} ouvre le volet « ${repere} »`, async ({ page }) => {
      await visiter(page, `/compte/abonnement?paiement=${param}`, 1440);
      const dialog = page.getByRole('dialog', { name: 'Payer avec Mobile Money' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(repere)).toBeVisible();
    });
  }

  test('« Passer à Premium » ouvre le PREMIER volet, jamais un autre', async ({ page }) => {
    await visiter(page, '/compte/abonnement', 1440);
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.locator('[data-frame="desktop"] [data-modal-open="K06M"]').first().click();
    const dialog = page.getByRole('dialog', { name: 'Payer avec Mobile Money' });
    await expect(dialog.getByText('Étape 1 sur 3')).toBeVisible();
  });

  /**
   * LA RÈGLE DURE DE CET ÉCRAN, et la raison d'être de son paramètre d'URL.
   *
   * 14 §4.2 fait avancer le paiement par le RÉSEAU — notification de l'opérateur,
   * webhook de confirmation. Ce lot ne branche aucune route : « Payer 2 600 F »
   * est donc inerte, et « Premium activé » ne doit être atteignable par AUCUNE
   * suite de clics. Un bouton qui ferait avancer la fenêtre annoncerait un
   * paiement que personne n'a demandé.
   */
  test('aucune suite de clics n’atteint « Premium activé »', async ({ page }) => {
    await visiter(page, '/compte/abonnement', 1440);
    await page.locator('[data-frame="desktop"] [data-modal-open="K06M"]').first().click();

    const dialog = page.getByRole('dialog', { name: 'Payer avec Mobile Money' });
    const payer = dialog.getByRole('button', { name: 'Payer 2 600 F' });
    await expect(payer).toBeVisible();

    for (let i = 0; i < 3; i += 1) {
      await payer.click();
      await expect(dialog.getByText('Étape 1 sur 3')).toBeVisible();
      await expect(dialog.getByText('Premium activé')).toHaveCount(0);
    }
  });
});

/**
 * ─── K08 · LA SUPPRESSION DE COMPTE ────────────────────────────────────────
 *
 * 01 §5 : définitive après sept jours, confirmée par un code SMS. Le bouton de
 * confirmation est INERTE dans ce lot — il ne referme même pas la fenêtre, parce
 * que la refermer ferait croire que la demande est partie.
 */
test.describe('K08 — supprimer mon compte', () => {
  test('« Supprimer » ouvre la confirmation détaillée', async ({ page }) => {
    await visiter(page, '/compte/donnees', 1440);
    await page.locator('[data-frame="desktop"] [data-modal-open="K08S"]').first().click();

    const dialog = page.getByRole('dialog', { name: 'Supprimer mon compte' });
    await expect(dialog).toBeVisible();
    // T5 K08 : « ce qui est supprimé, ce qui est conservé sans nom ».
    await expect(dialog.getByText('Conservé sans votre nom')).toBeVisible();
  });

  test('« Confirmer la suppression » ne referme rien : il n’envoie rien', async ({ page }) => {
    await visiter(page, '/compte/donnees', 1440);
    await page.locator('[data-frame="desktop"] [data-modal-open="K08S"]').first().click();

    const dialog = page.getByRole('dialog', { name: 'Supprimer mon compte' });
    await dialog.getByRole('button', { name: 'Confirmer la suppression' }).click();
    await expect(dialog).toBeVisible();
  });

  /**
   * Le cadre MOBILE ne dessine aucun bouton « Supprimer » : la maquette n'en met
   * qu'au premier de ses trois blocs. Le déclencheur est donc borné à
   * l'ordinateur, et ce test empêche qu'un lot suivant l'élargisse sans le voir.
   */
  test('390 px — la maquette ne dessine pas ce bouton', async ({ page }) => {
    await visiter(page, '/compte/donnees', 390);
    await expect(page.locator('[data-frame="mobile"] [data-modal-open="K08S"]')).toHaveCount(0);
  });
});

/**
 * ─── LA ROUTE `/@:handle` ──────────────────────────────────────────────────
 *
 * T5 écrit `/@:handle`, et l'App Router ne sait pas écrire un `@` littéral dans
 * un nom de dossier — c'est son marqueur de route parallèle. Le segment est donc
 * dynamique et porte l'arobase dans sa VALEUR, percent-encodée par Next.
 *
 * Ces deux tests gardent les deux moitiés du garde-fou : la bonne adresse passe,
 * et le segment dynamique ne dévore pas les 404 du reste du site.
 */
test.describe('la route /@:handle', () => {
  test('/@fatou.n rend K02', async ({ page }) => {
    const reponse = await page.goto('/@fatou.n', { waitUntil: 'load' });
    expect(reponse?.status()).toBe(200);
    await expect(page.locator('[data-screen="K02"]')).toHaveCount(1);
  });

  test('un chemin sans arobase reste une 404', async ({ page }) => {
    const reponse = await page.goto('/pas-un-pseudo', { waitUntil: 'load' });
    expect(reponse?.status()).toBe(404);
    await expect(page.locator('[data-screen="K02"]')).toHaveCount(0);
  });
});

/**
 * ─── LA BASCULE AU SEUIL DE 1024 px (§10.1) ────────────────────────────────
 *
 * Le rail vertical de 76 px est la signature du cadre ORDINATEUR (T5 §0), la
 * barre d'onglets à cinq entrées celle du cadre MOBILE. Les deux sont dans le
 * document ; c'est la VISIBILITÉ qui bascule, pas le rendu.
 */
test.describe('la bascule ordinateur / mobile', () => {
  for (const { w, rail } of [
    { w: 1023, rail: false },
    { w: 1024, rail: true },
  ] as const) {
    test(`${w} px — rail ${rail ? 'visible' : 'masqué'}`, async ({ page }) => {
      await visiter(page, '/compte/profil', w);
      const nav = page.locator('nav').first();
      if (rail) {
        await expect(nav).toBeVisible();
        expect((await nav.boundingBox())?.width).toBe(76);
      } else {
        await expect(nav).toBeHidden();
      }
    });
  }
});
