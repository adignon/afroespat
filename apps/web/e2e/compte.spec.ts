import { expect, test, type Page } from '@playwright/test';
import { connecter, type Membre } from './session';

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
 * ── CE QUI A CHANGÉ, ET POURQUOI C'EST TOUT L'ENJEU ─────────────────────────
 *
 * Ces dix écrans lisaient la MAQUETTE. Les deux règles dures y tenaient donc par
 * le dessin : « +229 •• •• •• 42 » était écrit dans la planche, le transcodage ne
 * réécrit rien, et aucun champ de carte n'y figurait. Les éprouver était utile mais
 * facile — le dessin ne change pas tout seul.
 *
 * Depuis ce lot, les valeurs viennent de l'API. Le risque est d'une autre nature :
 * il suffirait qu'une route se mette à renvoyer un numéro en clair, ou qu'une
 * liaison vise le mauvais champ, pour que la règle tombe SANS QU'AUCUN TEST DE
 * FORME NE BOUGE. Les deux tests de règle dure portent donc maintenant sur les
 * DONNÉES RÉELLES d'un membre créé par l'API, et ils affirment dans les deux sens :
 * ce qui doit s'afficher s'affiche, et ce qui ne doit jamais s'afficher n'y est pas.
 *
 * Les assertions portent sur la GÉOMÉTRIE, les RÔLES et les VALEURS DU SERVEUR,
 * jamais sur des classes : le balisage vient de la maquette en styles en ligne, et
 * viser une classe se casserait à la première régénération.
 */

/** Ce fichier pilote lui-même ses tailles : un seul projet suffit. */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'piloté par le test');

/**
 * LA SESSION EST OUVERTE AVANT CHAQUE TEST, et c'est une nécessité, pas un rite.
 *
 * Sans elle, les dix écrans n'affichent plus que « Chargement de votre compte… »
 * puis une invitation à se reconnecter : un test sans session mesurerait l'écran
 * d'erreur en croyant mesurer l'écran. Voir `e2e/session.ts`, qui explique aussi
 * pourquoi le cookie suffit et pourquoi aucun jeton n'est poussé dans la page.
 */
let membre: Membre;

test.beforeEach(async ({ context, request }) => {
  membre = await connecter(context, request, { displayName: 'Awa Konaté' });
});

/**
 * `load`, puis on ATTEND LE CADRE.
 *
 * `page.goto` rend la main dès que le document est là — or le document ne contient
 * d'abord que l'état d'attente : les données arrivent par deux à quatre appels
 * d'API. Un test qui affirmerait tout de suite mesurerait le squelette, et son
 * échec dirait « élément introuvable » sans nommer la cause.
 *
 * `networkidle` ne convient pas davantage : Next précharge les liens visibles, donc
 * le réseau ne retombe jamais complètement au calme et `goto` expirerait au bout de
 * trente secondes sur un message qui ne dit rien.
 */
async function visiter(page: Page, url: string, width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(url, { waitUntil: 'load' });
  await page.locator('[data-screen]').first().waitFor({ state: 'attached', timeout: 20_000 });
}

/** Le cadre visible à cette largeur — les deux sont dans le document. */
const cadre = (width: number) => (width >= 1024 ? '[data-frame="desktop"]' : '[data-frame="mobile"]');

/**
 * Les dix routes de T5 §9, avec le titre que chaque cadre porte.
 *
 * Le titre est celui que le transcodeur a promu en `<h1>` : c'est le texte VISIBLE
 * de la maquette, pas un titre inventé pour la route. Les deux cadres ne le disent
 * pas toujours pareil, et c'est la maquette qui en décide — K01 titre « Mon
 * profil » sur ordinateur et « Compte » sur téléphone, parce que l'en-tête mobile
 * range les huit onglets sous le nom de la SECTION.
 *
 * K02 EST LE CAS QUI A CHANGÉ : son titre était « Fatou Ndiaye », le nom dessiné.
 * C'est maintenant une DONNÉE, et le titre promu suit la liaison — d'où une
 * fonction plutôt qu'une chaîne. Un test qui chercherait encore « Fatou Ndiaye »
 * passerait sans session et échouerait avec : exactement le mauvais sens.
 */
const ROUTES = [
  { url: () => '/compte/profil', ecran: 'K01', bureau: () => 'Mon profil', mobile: () => 'Compte' },
  {
    url: () => `/@${membre.handle}`,
    ecran: 'K02',
    bureau: () => `${membre.displayName}Niveau 0`,
    mobile: () => membre.displayName,
  },
  {
    url: () => '/compte/verification',
    ecran: 'K03',
    bureau: () => 'Vérification et niveaux',
    mobile: () => 'Compte',
  },
  {
    url: () => '/compte/securite',
    ecran: 'K04',
    bureau: () => 'Téléphones et sessions',
    mobile: () => 'Compte',
  },
  { url: () => '/compte/contacts', ecran: 'K05', bureau: () => 'Contacts', mobile: () => 'Contacts' },
  {
    url: () => '/compte/abonnement',
    ecran: 'K06',
    bureau: () => 'Abonnement et Premium',
    mobile: () => 'Premium',
  },
  {
    url: () => '/compte/notifications',
    ecran: 'K07',
    bureau: () => 'Notifications',
    mobile: () => 'Notifications',
  },
  {
    url: () => '/compte/donnees',
    ecran: 'K08',
    bureau: () => 'Mes données',
    mobile: () => 'Mes données',
  },
  { url: () => '/compte/sanctions', ecran: 'K09', bureau: () => 'Sanctions', mobile: () => 'Sanctions' },
  {
    url: () => '/compte/enregistres',
    ecran: 'K10',
    bureau: () => 'Enregistrés',
    mobile: () => 'Enregistrés',
  },
] as const;

test.describe('les dix routes du module', () => {
  for (const { url, ecran, bureau, mobile } of ROUTES) {
    test(`${ecran} rend sa route et porte SON titre, aux deux largeurs`, async ({ page }) => {
      for (const { width, titre } of [
        { width: 1440, titre: bureau },
        { width: 390, titre: mobile },
      ]) {
        await visiter(page, url(), width);
        await expect(page.locator(`[data-screen="${ecran}"]`)).toHaveCount(1);

        /**
         * Le titre est cherché par RÔLE, dans le cadre VISIBLE.
         *
         * `ScreenFrames` rend les deux cadres et en masque un par CSS : les deux
         * portent donc un `<h1>`, et un locator non scopé en trouverait deux.
         * Le scoper au cadre visible mesure ce que le membre voit.
         */
        const h1 = page.locator(cadre(width)).getByRole('heading', { level: 1 });
        await expect(h1, `${url()} à ${width} px`).toHaveText(titre());
      }
    });
  }
});

/**
 * ─── LES DONNÉES VIENNENT DE L'API, ET NON DE LA MAQUETTE ──────────────────
 *
 * C'est le test qui donne un sens à tout le lot, et il affirme dans les DEUX sens.
 * Le sens positif seul serait faible : un écran qui afficherait à la fois le nom du
 * membre ET celui de la maquette le passerait. Le sens négatif seul serait faux :
 * un écran vide le passerait aussi.
 *
 * « Amina Diallo » est le nom que la planche DESSINE. Il doit avoir disparu du
 * document — c'est la preuve que le littéral est devenu une donnée, et non qu'on a
 * ajouté un nom à côté de l'autre.
 */
test.describe('les valeurs affichées viennent du serveur', () => {
  /**
   * DIX NAVIGATIONS DANS UN SEUL TEST, donc son propre budget.
   *
   * Chaque visite attend deux à quatre appels d'API : le défaut de 30 s de
   * Playwright suffisait quand ces écrans ne parlaient à personne, et il ne suffit
   * plus. Mesuré, pas choisi : 10 visites × ~1,4 s dans le pire cas observé, plus
   * la création du membre. La marge est large exprès — une borne serrée redeviendra
   * fausse au premier écran ajouté, et son message ne dira pas pourquoi.
   *
   * Le balayage reste UN test plutôt que dix : ce qu'il affirme, c'est que le nom
   * dessiné a disparu de TOUS les écrans. Dix tests indépendants laisseraient
   * passer « neuf sur dix », qui est précisément le résultat qu'on veut refuser.
   */
  test('le bandeau de compte porte le nom du membre, et plus celui de la maquette', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    for (const { url, ecran } of ROUTES) {
      await visiter(page, url(), 1440);
      const bureau = page.locator('[data-frame="desktop"]');
      const texte = await bureau.innerText();

      expect(texte, `${ecran} n’affiche pas le nom du membre`).toContain(membre.displayName);
      expect(texte, `${ecran} affiche encore le nom DESSINÉ dans la maquette`).not.toContain(
        'Amina Diallo',
      );
      expect(texte, `${ecran} affiche encore le pseudo DESSINÉ dans la maquette`).not.toContain(
        '@amina.d',
      );
    }
  });

  test('K01 affiche la bio et le pays que l’API renvoie', async ({ page }) => {
    await visiter(page, '/compte/profil', 1440);
    const bureau = page.locator('[data-frame="desktop"]');

    // Posée par `connecter()` : l'écran ne peut pas l'avoir inventée.
    await expect(bureau).toContainText('Profil créé par la suite de tests.');
    // Le pays d'origine, résolu par `GET /users/{pseudo}` — la maquette dessinait
    // « Bénin » et le membre est béninois : la valeur coïncide, donc on éprouve
    // aussi que la BIO dessinée a bien disparu, elle qui ne coïncide pas.
    await expect(bureau).toContainText('Bénin');
    await expect(bureau).not.toContainText('Étudiante en gestion à Lyon 3');
  });

  test('K04 affiche EXACTEMENT le masque que le serveur a envoyé', async ({ page }) => {
    await visiter(page, '/compte/securite', 1440);
    const bureau = page.locator('[data-frame="desktop"]');

    await expect(bureau).toContainText(membre.masque);
    // Les deux numéros DESSINÉS ont disparu : la liste est celle de l'API.
    await expect(bureau).not.toContainText('+229 •• •• •• 42');
    await expect(bureau).not.toContainText('+33 6 •• •• •• 18');
    // La session courante porte la pastille de la maquette, l'autre variante non :
    // un membre neuf n'a qu'une session, donc aucun bouton « Révoquer ».
    await expect(bureau).toContainText('Actuelle');
    await expect(bureau.getByRole('button', { name: 'Révoquer' })).toHaveCount(0);
  });
});

/**
 * ─── RÈGLE DURE 01 §2.1 — AUCUN NUMÉRO EN CLAIR ────────────────────────────
 *
 * « Aucun numéro de téléphone en clair, jamais ; seulement un masque, et
 * seulement à son propriétaire. »
 *
 * CE TEST A CHANGÉ DE NATURE avec ce lot. Il éprouvait la maquette, où la règle
 * tenait par le dessin. Il éprouve maintenant les DONNÉES RÉELLES : le membre a un
 * vrai numéro, connu du test, et trois choses doivent être vraies en même temps.
 *
 *   1. le numéro EN CLAIR n'apparaît nulle part, sous aucune de ses écritures ;
 *   2. tout ce qui ressemble à un numéro porte des puces ;
 *   3. il y en a AU MOINS UN — sans quoi le test regarderait dans le vide et
 *      passerait tout aussi bien si l'écran cessait d'afficher le moindre numéro.
 */
test.describe('01 §2.1 — aucun numéro de téléphone en clair', () => {
  /** Tout ce qui commence par un « + » et continue en chiffres, espaces ou puces. */
  const NUMERO = /\+\d[\d\s•]{4,}/g;

  test('les dix écrans n’affichent que des masques, et jamais le vrai numéro', async ({ page }) => {
    /**
     * VINGT NAVIGATIONS — dix routes × deux largeurs — donc son propre budget.
     *
     * Le défaut de 30 s a expiré sur la dix-septième visite, et son message ne
     * nommait pas la cause : « navigating to /compte/sanctions, waiting until load ».
     * On croit à un écran qui ne charge pas, alors que le test n'avait pas fini.
     * C'est le même piège que les 180 s du `webServer` de ce dépôt.
     *
     * Les deux largeurs restent dans le MÊME test, et c'est volontaire : la règle
     * dure vaut sur les deux cadres, et `ScreenFrames` les rend tous les deux dans
     * le document. Un numéro en clair qui n'apparaîtrait que sur le cadre mobile
     * serait exactement le défaut qu'un test d'une seule largeur laisse passer.
     */
    test.setTimeout(180_000);
    let vus = 0;

    /**
     * Les écritures sous lesquelles le numéro pourrait fuir.
     *
     * Pas seulement `+22997000057` : un écran qui formaterait le numéro par groupes
     * de deux le rendrait invisible à une recherche de la forme brute, tout en
     * l'affichant parfaitement au membre — et à quiconque regarde son écran.
     */
    const brut = membre.phone;
    const national = brut.replace(/^\+229/, '');
    const espace = national.replace(/(\d\d)(?=\d)/g, '$1 ');
    const clair = [brut, brut.replace('+', ''), national, espace];

    for (const { url, ecran } of ROUTES) {
      for (const width of [1440, 390]) {
        await visiter(page, url(), width);
        const texte = await page.locator(cadre(width)).innerText();

        for (const forme of clair) {
          expect(texte, `${ecran} à ${width} px affiche le numéro EN CLAIR (« ${forme} »)`).not.toContain(
            forme,
          );
        }

        for (const numero of texte.match(NUMERO) ?? []) {
          vus += 1;
          expect(numero, `${ecran} à ${width} px affiche « ${numero.trim()} » sans masque`).toContain(
            '•',
          );
        }
      }
    }

    // K04 en montre au moins un par cadre : le test regarderait dans le vide si ce
    // compte tombait à zéro, et il passerait alors sans rien prouver.
    expect(vus, 'aucun numéro trouvé : le test ne prouverait rien').toBeGreaterThanOrEqual(2);
  });

  /**
   * LA FRONTIÈRE, ÉPROUVÉE À LA SOURCE. Le rempart n'est pas l'écran : c'est le
   * schéma de réponse. `GET /me` ne DOIT PAS porter de numéro en clair, et le
   * vérifier ici évite de croire que l'absence à l'écran vient d'une vigilance de
   * l'écran — elle vient de ce que le serveur n'en envoie pas.
   */
  test('la route /me elle-même n’envoie aucun numéro en clair', async ({ request }) => {
    const me = await request.get(
      `${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1'}/me`,
      { headers: { authorization: `Bearer ${membre.accessToken}` } },
    );
    const corps = await me.text();
    expect(corps).not.toContain(membre.phone);
    expect(corps).not.toContain(membre.phone.replace('+', ''));
    expect(corps).toContain('masked');
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
 *
 * ET DEPUIS CE LOT, il regarde aussi CE QUE LES ROUTES ENVOIENT. L'écran lit
 * `/me/subscription`, `/plans` et `/me/payments` : si l'une se mettait à joindre
 * quatre derniers chiffres ou une date d'expiration, l'écran pourrait très bien ne
 * pas les afficher — et la règle serait pourtant tombée, puisque la donnée aurait
 * transité. C'est la moitié qu'un test d'écran seul ne voit pas.
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

  test('les trois routes de facturation n’envoient aucune donnée de carte', async ({ request }) => {
    const base = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1';
    const auth = { authorization: `Bearer ${membre.accessToken}` };
    /** `last4`, `fingerprint`, `exp_month` : les noms sous lesquels cela arriverait. */
    const CHAMPS = /last4|fingerprint|exp_?month|exp_?year|card_?number|cvc|brand/i;

    for (const chemin of ['/me/subscription', '/plans', '/me/payments']) {
      const r = await request.get(`${base}${chemin}`, { headers: auth });
      expect(r.status(), chemin).toBe(200);
      const corps = await r.text();
      expect(corps, `${chemin} transporte une donnée de carte`).not.toMatch(CHAMPS);
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
      await visiter(page, `/@${membre.handle}`, width);
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
    await visiter(page, `/@${membre.handle}`, 1440);
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
    await visiter(page, `/@${membre.handle}`, 1440);
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
   * webhook de confirmation. Ce lot ne branche aucune route d'écriture : « Payer
   * 2 600 F » est donc inerte, et « Premium activé » ne doit être atteignable par
   * AUCUNE suite de clics. Un bouton qui ferait avancer la fenêtre annoncerait un
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

  /**
   * LE PRIX EST CELUI DU SERVEUR, dans les DEUX devises.
   *
   * §8 : « bouton Premium (prix EUR/XOF selon pays) », et le serveur envoie les
   * deux — « le membre peut être béninois en France, ou français au Bénin ». Ce
   * test compare l'écran à `GET /plans` plutôt qu'à un nombre écrit ici : un prix
   * en dur dans un test ne vérifie que lui-même, et les deux se figeraient
   * ensemble le jour où le porteur change de tarif.
   */
  test('le prix affiché est celui que `GET /plans` renvoie, pas une constante du front', async ({
    page,
    request,
  }) => {
    const base = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1';
    const plans = (await (await request.get(`${base}/plans`)).json()) as {
      items: {
        code: string;
        month: { eur: { amountCents: number }; xof: { amountCents: number } };
      }[];
    };
    const premium = plans.items.find((p) => p.code === 'PREMIUM');
    expect(premium, 'aucun plan PREMIUM : le test ne prouverait rien').toBeDefined();
    if (premium === undefined) return;

    await visiter(page, '/compte/abonnement', 1440);
    const bureau = page.locator('[data-frame="desktop"]');

    const euros = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(premium.month.eur.amountCents / 100);
    await expect(bureau).toContainText(`${euros}/mois`);

    // Les francs CFA sont CALCULÉS par le serveur : l'écran ne refait pas la
    // conversion, sinon deux taux de change cohabiteraient dans le produit.
    const francs = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(premium.month.xof.amountCents);
    await expect(bureau).toContainText(`Au Bénin : ${francs}/mois`);
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
 * Ces trois tests gardent les trois moitiés du garde-fou : la bonne adresse passe
 * ET montre le bon membre, et le segment dynamique ne dévore pas les 404 du reste
 * du site.
 */
test.describe('la route /@:handle', () => {
  test('/@pseudo rend K02 et montre CE membre', async ({ page }) => {
    const reponse = await page.goto(`/@${membre.handle}`, { waitUntil: 'load' });
    expect(reponse?.status()).toBe(200);
    await page.locator('[data-screen="K02"]').waitFor({ state: 'attached', timeout: 20_000 });
    await expect(page.locator('[data-frame="desktop"]')).toContainText(membre.displayName);
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
