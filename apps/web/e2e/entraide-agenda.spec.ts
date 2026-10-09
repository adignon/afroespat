import { expect, test, type Page } from '@playwright/test';
import { connecter } from './session';

/**
 * Les dix écrans transcodés de `docs/template/05 Entraide.dc.html`.
 *
 * ── LES QUATRE ÉCRANS DE L'AGENDA ONT DÉMÉNAGÉ, ET IL FAUT SAVOIR POURQUOI ──
 *
 * E01 à E04 étaient éprouvés ici, SANS SESSION : ils affichaient la maquette, et
 * ces tests mesuraient sa géométrie. Depuis qu'ils lisent `apps/api/.../events`,
 * un écran sans session ne montre plus qu'une invitation à se reconnecter — et un
 * test qui n'en ouvrirait pas mesurerait l'écran d'erreur en croyant mesurer
 * l'écran. C'est le genre de succès qui ne prouve rien.
 *
 * Ils vivent donc dans `agenda.spec.ts`, qui crée un membre, le porte à L1 et
 * crée son événement. AUCUNE des propriétés mesurées ici n'a été perdue : rail de
 * 76 px, colonne de contexte de 300 px, borne de 660 px (et l'écart de E04 à
 * 1 016 px), absence d'ombre, absence d'emoji et absence de débordement
 * horizontal y sont reprises, avec une session.
 *
 * Ce que ces tests éprouvent n'est PAS le dessin : il est transcodé, donc il est
 * celui de la maquette par construction. Ils éprouvent ce qu'une image ne peut pas
 * contenir — la bascule au bon seuil, ce qui reste à l'écran quand la page défile,
 * le titre que le lecteur d'écran annonce, et les deux règles dures que ces deux
 * modules portent.
 *
 * Les assertions portent sur la GÉOMÉTRIE et les RÔLES, jamais sur des classes : le
 * balisage vient de la maquette en styles en ligne, et viser une classe se casserait
 * à la première régénération.
 *
 * CHAQUE PROPRIÉTÉ A ÉTÉ ÉPROUVÉE PAR MUTATION — la propriété cassée dans la SOURCE
 * (déclaration d'écran ou adaptation du générateur), la maquette régénérée, le test
 * relancé, et vérifié ROUGE. Le tableau est dans le rapport de lot. Deux de ces
 * tests ont changé de forme à cause de ce que la mutation a montré, et c'est dit à
 * l'endroit où ils sont écrits.
 */

/** Ce fichier pilote lui-même ses tailles : un seul projet suffit. */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'piloté par le test');

/**
 * Les dix écrans de l'entraide, avec ce que la maquette dit d'eux.
 *
 * `titreMobile` diffère parfois de `titreDesktop`, et c'est la maquette qui le veut :
 * H09 titre « Mes demandes » sur ordinateur mais « Fil d'entraide » sur mobile, où
 * « Mes demandes » devient une pastille sous un en-tête commun.
 *
 * `mobile: false` pour H06 seul : sa planche « MOBILE » ne montre pas la fiche du
 * parrain sur téléphone, mais la feuille de demande posée sur un voile. La maquette
 * ne dessine donc pas cet écran en mobile.
 */
const ECRANS = [
  { nom: 'H01', route: '/entraide', titre: 'Fil d’entraide', titreMobile: 'Fil d’entraide', module: 'entraide' },
  { nom: 'H02', route: '/entraide/abc', titre: "Un lit et une table pour l'installation", titreMobile: "Un lit et une table pour l'installation", module: 'entraide' },
  { nom: 'H03', route: '/entraide/nouveau', titre: 'Publier une demande', titreMobile: 'Publier une demande', module: 'entraide' },
  { nom: 'H04', route: '/entraide/aider', titre: 'Vous pouvez aider', titreMobile: 'Vous pouvez aider', module: 'entraide' },
  { nom: 'H09', route: '/entraide/mes-demandes', titre: 'Mes demandes', titreMobile: 'Fil d’entraide', module: 'entraide' },
  { nom: 'H10', route: '/entraide/mes-reponses', titre: 'Mes réponses', titreMobile: 'Fil d’entraide', module: 'entraide' },
  { nom: 'H05', route: '/parrainage', titre: 'Parrainage', titreMobile: 'Parrainage', module: 'entraide' },
  { nom: 'H06', route: '/parrainage/amina', titre: 'Aïcha Diop', titreMobile: null, module: 'entraide' },
  { nom: 'H07', route: '/parrainage/mes-parrainages', titre: 'Mes parrainages', titreMobile: 'Mes parrainages', module: 'entraide' },
  { nom: 'H08', route: '/parrainage/devenir', titre: 'Devenir parrain', titreMobile: 'Devenir parrain', module: 'entraide' },
] as const;

const ENTRAIDE = ECRANS.filter((e) => e.module === 'entraide');

/**
 * `waitUntil: 'load'` ET NON `'networkidle'` — DANS CE FICHIER SEULEMENT.
 *
 * `networkidle` attend cinq cents millisecondes sans la moindre requête. Next
 * précharge les liens visibles d'une page App Router : sur les écrans de ce lot —
 * le fil d'entraide, l'agenda — le réseau ne retombe jamais au calme, et
 * `page.goto` expire au bout de trente secondes. Playwright le déconseille
 * d'ailleurs dans sa propre documentation.
 *
 * Le symptôme ne désigne pas la cause : un `Test timeout` ou un `net::ERR_ABORTED`
 * sur des routes qui répondent en deux millisecondes au `curl`. Mesuré : dix tests
 * sont passés de « trois échecs en 4,2 minutes » à « dix verts en 1,1 minute ».
 *
 * POURQUOI PAS PARTOUT, alors que quatorze autres appels emploient `networkidle` :
 * je l'ai fait, et dix-huit tests sont tombés d'un coup. Ces suites-là comptent des
 * éléments rendus CÔTÉ CLIENT, et c'est l'attente du réseau qui leur laissait le
 * temps d'arriver. Corriger un problème mesuré sur un fichier ne donne pas le droit
 * de changer quatorze appels qu'on n'a pas mesurés.
 *
 * Ce fichier ne mesure que de la géométrie, des rôles et axe — tous disponibles dès
 * le chargement.
 */
async function visiter(page: Page, route: string, width: number, height = 900): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto(route, { waitUntil: 'load' });
}

/**
 * ⚠ CE FICHIER MESURE PARFOIS LE SQUELETTE, ET LA RÉPARATION ÉVIDENTE EMPIRE TOUT.
 *
 * Douze de ses cas échouent par vagues — « rail 76 px » sur H05 à H10 avec
 * `element(s) not found`, les bornes de 660 px, le débordement à 320, 360 et
 * 430 px. Aucun de ces défauts n'existe à l'écran : `EcranDonnees` rend
 * `children(donnees)` DÈS LE PREMIER RENDU, avec le squelette, et la mesure part
 * avant la donnée.
 *
 * LA RECETTE APPLIQUÉE AILLEURS NE MARCHE PAS ICI. Attendre que la bande
 * `role="status"` « Chargement » se détache — ce que font `services.spec.ts`,
 * `compte.spec.ts` et `parcours.spec.ts` — a fait TOMBER cette suite de 73 cas
 * verts à 37 : sur plusieurs de ces routes la bande ne part JAMAIS, chaque visite
 * brûle alors son délai entier, et le budget de 30 s de Playwright expire avant
 * l'assertion. Mesuré, puis retiré.
 *
 * La cause reste donc à trouver — vraisemblablement un écran d'entraide dont le
 * chargement n'aboutit pas sur une route de documentation (`/entraide/abc`,
 * `/parrainage/amina`). REMONTÉ AU PORTEUR, hors du lot en cours : ce sont des
 * cas d'épreuve qui clignotent, pas un défaut que quelqu'un voit à l'écran.
 */

// ─── Le titre de page ────────────────────────────────────────────────────────

/**
 * Aucune section de ces deux maquettes ne contient de `<h2>` : leur unique `<h1>` est
 * celui de la planche de documentation, hors section. Le titre de page est donc
 * DÉCLARÉ avec le cadre (`tools/screens/*.mjs`) et promu en `<h1>` au transcodage.
 *
 * Ce test vérifie les deux moitiés de cette promesse : qu'il y a UN titre, et que
 * c'est celui que la maquette affiche — pas un titre inventé. C'est exactement le
 * défaut qui a coûté A01, où un titre de page inventé s'était glissé dans un écran
 * réécrit à la main.
 */
test.describe('le titre de page vient de la maquette', () => {
  for (const ecran of ECRANS) {
    test(`${ecran.nom} — ordinateur`, async ({ page }) => {
      await visiter(page, ecran.route, 1440);
      const titres = page.getByRole('heading', { level: 1 });
      await expect(titres).toHaveCount(1);
      await expect(titres).toHaveText(ecran.titre);
    });
  }

  for (const ecran of ECRANS) {
    if (ecran.titreMobile === null) continue;
    test(`${ecran.nom} — mobile`, async ({ page }) => {
      await visiter(page, ecran.route, 390);
      const titres = page.getByRole('heading', { level: 1 });
      // Les deux cadres sont dans le document, l'un masqué par CSS : le `<h1>` du
      // cadre masqué ne compte pas pour un lecteur d'écran, et `getByRole` l'ignore.
      await expect(titres).toHaveCount(1);
      await expect(titres).toHaveText(ecran.titreMobile);
    });
  }
});

// ─── La bascule de cadre ─────────────────────────────────────────────────────

test.describe('la bascule ordinateur/mobile a lieu à 1024 px', () => {
  test('1023 px montre le cadre mobile, 1024 le cadre ordinateur', async ({ page }) => {
    for (const { w, cadre } of [
      { w: 1023, cadre: 'mobile' },
      { w: 1024, cadre: 'desktop' },
    ] as const) {
      await visiter(page, '/entraide', w);
      await expect(page.locator(`[data-frame="${cadre}"]`), `${w} px`).toBeVisible();
      const autre = cadre === 'mobile' ? 'desktop' : 'mobile';
      await expect(page.locator(`[data-frame="${autre}"]`), `${w} px`).toBeHidden();
    }
  });

  /**
   * H06 N'A PAS DE CADRE MOBILE, et l'assertion est écrite à l'envers exprès.
   *
   * Ce n'est pas une exception qu'on inscrit pour faire passer la suite : c'est la
   * forme de la maquette, et le jour où elle dessinera enfin la fiche du parrain sur
   * téléphone, CE TEST TOMBERA. Il faudra alors le retirer et déclarer le cadre —
   * ce qui est exactement ce qu'on veut qu'il arrive.
   */
  test('H06 ne porte pas de cadre mobile : la maquette n’en dessine pas', async ({ page }) => {
    await visiter(page, '/parrainage/amina', 390);
    await expect(page.locator('[data-frame="mobile"]')).toHaveCount(0);
    await expect(page.locator('[data-frame="desktop"]')).toBeVisible();
  });
});

// ─── Ce qui reste à l'écran quand la page défile ─────────────────────────────

/**
 * La maquette ne l'exprime pas : c'est une image, rien n'y défile. Ce sont donc des
 * ADAPTATIONS, faites dans le générateur pour qu'elles survivent à la régénération,
 * et ces tests sont ce qui les tient.
 */
test.describe('le défilement — ordinateur', () => {
  for (const ecran of ECRANS) {
    test(`${ecran.nom} — la barre haute et les colonnes suivent`, async ({ page }) => {
      /**
       * UNE FENÊTRE DE 400 px DE HAUT, et la mesure est ce qui l'a fixée.
       *
       * Les cadres de ces maquettes sont bien plus courts que ceux du fil : le
       * contenu d'ordinateur va de 545 px (H04) à 1 047 px (H05). Dans une fenêtre
       * de 900 px, la moitié d'entre eux ne défile pas du tout — et un test qui ne
       * défile pas ne prouve rien sur ce qui reste à l'écran quand on défile. À
       * 500 px, deux écrans n'avaient encore que 45 et 85 px de marge. À 400 px,
       * tous en ont au moins 145.
       */
      await visiter(page, ecran.route, 1440, 400);

      const avant = await page.evaluate(() => ({
        marge: document.documentElement.scrollHeight - window.innerHeight,
      }));
      const defilement = Math.min(250, avant.marge);
      // La colonne de contexte part à 76 px : il faut la dépasser, sinon une colonne
      // qui suivrait le défilement resterait quand même visible et le test serait muet.
      expect(defilement, `${ecran.nom} : pas assez de marge pour défiler`).toBeGreaterThan(116);

      await page.evaluate((y) => window.scrollTo(0, y), defilement);
      await page.waitForTimeout(150);

      const p = await page.evaluate(() => {
        const frame = document.querySelector('[data-frame="desktop"]')!;
        const haut = (el: Element | null) =>
          el === null ? null : Math.round(el.getBoundingClientRect().top);
        const rail = frame.querySelector('nav');
        return {
          defile: Math.round(window.scrollY),
          colonneGauche: haut(rail?.parentElement?.parentElement ?? null),
          colonneDroite: haut(frame.querySelector('aside')),
        };
      });

      expect(p.defile, 'la page doit avoir défilé').toBe(defilement);
      /**
       * Sans `sticky`, elle serait remontée de tout le défilement — à −250 px. La
       * tolérance d'un pixel n'est pas de la complaisance : le haut mesuré vaut
       * parfois −0,3 px, et `Math.round` en fait un `-0` que `toBe(0)` refuse.
       */
      expect(p.colonneGauche, 'la colonne de gauche a suivi').toBeGreaterThan(-2);
      expect(p.colonneGauche, 'la colonne de gauche a suivi').toBeLessThan(2);

      if (p.colonneDroite !== null) {
        /**
         * Elle s'arrête SOUS la barre haute, à 76 px — sauf tout en bas de page, où
         * la fin de sa rangée la pousse vers le haut. L'assertion est donc écrite
         * comme la propriété l'est : elle n'a pas suivi le défilement. Sans `sticky`
         * elle serait à `76 − défilement`, c'est-à-dire négative.
         */
        expect(p.colonneDroite, 'la colonne de contexte est restée visible').toBeGreaterThanOrEqual(0);
        expect(p.colonneDroite, 'la colonne de contexte a suivi le défilement').toBeGreaterThan(
          76 - defilement + 20,
        );
        expect(p.colonneDroite, 'elle ne descend pas sous la barre haute').toBeLessThanOrEqual(76);
      }
    });
  }
});

test.describe('le défilement — mobile', () => {
  /**
   * LA BARRE D'ONGLETS BASSE, et c'est le défaut que le navigateur a révélé.
   *
   * L'adaptation posait `position: sticky` par un remplacement de
   * `position: relative` — que seule la maquette du fil écrit. Sur ces deux
   * maquettes-ci, elle ne trouvait rien : la barre repartait avec `bottom: 0` et
   * `z-index: 10` sur un élément `position: static`, donc deux déclarations sans le
   * moindre effet, et elle défilait hors de l'écran sur onze cadres.
   *
   * L'assertion est PUREMENT GÉOMÉTRIQUE, et prise en HAUT de page : si la barre
   * n'était pas collante, son bas serait à la hauteur du document — plusieurs
   * centaines de pixels sous la fenêtre. La mesurer après avoir défilé jusqu'en bas
   * n'aurait rien prouvé : à cet endroit, une barre statique est visible aussi.
   * C'est la mutation qui l'a montré — le test passait au vert avec le défaut.
   */
  for (const ecran of ECRANS) {
    if (ecran.titreMobile === null) continue;
    test(`${ecran.nom} — la barre d’onglets reste au bas de la fenêtre`, async ({ page }) => {
      // 400 px de haut : la plus grande fenêtre où les neuf cadres mobiles défilent
      // tous. À 500, trois d'entre eux tiennent tout entiers et ne prouvent rien.
      await visiter(page, ecran.route, 390, 400);

      const p = await page.evaluate(() => {
        const frame = document.querySelector('[data-frame="mobile"]')!;
        const onglet = [...frame.querySelectorAll<HTMLElement>('*')].find(
          (el) => el.textContent?.trim() === 'Compte' && el.children.length > 0,
        );
        const barre = onglet?.parentElement ?? null;
        return {
          hauteurDoc: document.documentElement.scrollHeight,
          fenetre: window.innerHeight,
          basBarre: barre === null ? null : Math.round(barre.getBoundingClientRect().bottom),
          defilement: Math.round(window.scrollY),
        };
      });

      if (p.basBarre === null) {
        // Trois cadres mobiles de ces maquettes n'ont pas de barre d'onglets : ce
        // sont des écrans de formulaire ou de détail, avec une flèche de retour.
        expect(['H02', 'H03', 'H08']).toContain(ecran.nom);
        return;
      }

      expect(p.hauteurDoc, 'la page doit dépasser la fenêtre, sinon rien à prouver').toBeGreaterThan(
        p.fenetre,
      );
      expect(p.defilement, 'on mesure en haut de page').toBe(0);
      expect(p.basBarre, 'la barre est collée au bas de la FENÊTRE').toBe(p.fenetre);
    });
  }

  /**
   * LE BOUTON FLOTTANT DE PUBLICATION.
   *
   * Dans la maquette il est `position: absolute` dans un cadre de 844 px. Dans
   * l'application, le conteneur du cadre mobile fait la hauteur de TOUTE la page :
   * le bouton se posait à 108 px du bas du DOCUMENT, donc invisible tant qu'on
   * n'avait pas déroulé la liste entière.
   *
   * Il est reconnu par sa GÉOMÉTRIE — 56 × 56 px, contre le bord droit — et non par
   * un sélecteur : la maquette ne lui donne ni texte ni rôle, et c'est un constat
   * consigné plus bas.
   */
  for (const nom of ['H01', 'H09'] as const) {
    const ecran = ECRANS.find((e) => e.nom === nom)!;
    test(`${nom} — le bouton flottant reste au-dessus de la barre d’onglets`, async ({ page }) => {
      await visiter(page, ecran.route, 390, 400);

      const mesure = async () =>
        page.evaluate(() => {
          const frame = document.querySelector('[data-frame="mobile"]')!;
          const el = [...frame.querySelectorAll<HTMLElement>('*')].find((n) => {
            const b = n.getBoundingClientRect();
            return Math.round(b.width) === 56 && Math.round(b.height) === 56;
          });
          if (el === undefined) return null;
          const b = el.getBoundingClientRect();
          return {
            bas: Math.round(b.bottom),
            droite: Math.round(b.right),
            fenetre: window.innerHeight,
            largeur: window.innerWidth,
          };
        });

      const avant = await mesure();
      expect(avant, 'le bouton flottant de 56 px est introuvable').not.toBeNull();
      if (avant === null) return;

      // 108 px au-dessus du bas de la FENÊTRE — pas du document.
      expect(avant.bas).toBe(avant.fenetre - 108);
      expect(avant.droite).toBe(avant.largeur - 18);

      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(150);
      const apres = await mesure();
      expect(apres?.bas, 'il ne bouge pas quand la page défile').toBe(avant.bas);
    });
  }
});

// ─── Les colonnes de la maquette ─────────────────────────────────────────────

test.describe('les largeurs de la maquette', () => {
  for (const ecran of ECRANS) {
    test(`${ecran.nom} — rail 76 px, colonne de contexte 300 px`, async ({ page }) => {
      await visiter(page, ecran.route, 1440);

      const rail = page.locator('[data-frame="desktop"] nav');
      await expect(rail).toBeVisible();
      expect((await rail.boundingBox())?.width).toBe(76);

      const aside = page.locator('[data-frame="desktop"] aside');
      if ((await aside.count()) > 0) {
        expect((await aside.boundingBox())?.width).toBe(300);
      } else {
        /**
         * LES DIX ÉCRANS DE L'ENTRAIDE EN ONT UNE. E04 était l'unique exception
         * de ce fichier ; il est parti dans `agenda.spec.ts`, où la même
         * propriété est mesurée avec un événement réel. Si cette branche est
         * atteinte, c'est un écran qui a perdu sa colonne : on échoue en le
         * nommant plutôt que de passer en silence.
         */
        expect(`${ecran.nom} n’a pas de colonne de contexte`).toBe('tous en ont une');
      }
    });
  }

  /**
   * §10.1 borne le contenu à 660 px, et les dix écrans de l'entraide l'écrivent
   * dans leur `<main>`. L'écart de E04 — 1 016 px, décidé par la maquette — est
   * mesuré dans `agenda.spec.ts`, où cet écran vit maintenant.
   */
  test('le contenu est borné à 660 px sur les dix écrans', async ({ page }) => {
    const larges: string[] = [];
    for (const ecran of ECRANS) {
      await visiter(page, ecran.route, 1440);
      const box = await page.locator('[data-frame="desktop"] main').boundingBox();
      expect(box, ecran.nom).not.toBeNull();
      if (box !== null && box.width > 660) larges.push(`${ecran.nom} ${Math.round(box.width)}px`);
    }
    expect(larges).toEqual([]);
  });
});

// ─── Le rail et la barre d'onglets ───────────────────────────────────────────

test.describe('la coquille de navigation', () => {
  test('sur mobile, le rail disparaît et la barre d’onglets porte Compte', async ({ page }) => {
    await visiter(page, '/entraide', 390);
    const frame = page.locator('[data-frame="mobile"]');
    await expect(frame.locator('nav')).toHaveCount(0);
    for (const label of ['Accueil', 'Parcours', 'Entraide', 'Services', 'Compte']) {
      await expect(frame.getByText(label, { exact: true }).last()).toBeVisible();
    }
    // §10.1 : Agenda cède sa place à Compte et reste atteignable depuis Accueil.
    await expect(frame.getByText('Agenda', { exact: true })).toHaveCount(0);
  });

  /**
   * Une bande horizontale doit DÉFILER, pas être coupée — et être atteignable au
   * clavier, sans quoi l'adaptation créerait elle-même une régression
   * d'accessibilité (axe-core : `scrollable-region-focusable`).
   */
  test('la bande de pastilles défile et se rejoint au clavier', async ({ page }) => {
    await visiter(page, '/entraide', 320);
    const bande = await page.evaluate(() => {
      const frame = document.querySelector('[data-frame="mobile"]')!;
      for (const el of frame.querySelectorAll<HTMLElement>('*')) {
        if (getComputedStyle(el).overflowX !== 'auto') continue;
        if (el.scrollWidth <= el.clientWidth) continue;
        return { tabindex: el.getAttribute('tabindex'), deborde: el.scrollWidth - el.clientWidth };
      }
      return null;
    });
    expect(bande, 'aucune bande défilante trouvée').not.toBeNull();
    expect(bande?.deborde, 'elle doit vraiment avoir de quoi défiler').toBeGreaterThan(0);
    expect(bande?.tabindex, 'une zone défilable doit être atteignable au clavier').toBe('0');
  });
});

// ─── L'encoche ───────────────────────────────────────────────────────────────

/**
 * Les 50 px du haut simulaient l'encoche dans une image. Un écran réel lit la zone
 * sûre — qui vaut 0 dans un navigateur, donc l'en-tête doit remonter contre le bord.
 *
 * LA MESURE PORTE SUR L'EN-TÊTE, PAS SUR LE `<h1>`, et c'est la première version du
 * test qui l'a appris : H02 met son `<h1>` dans le corps — son en-tête mobile affiche
 * « Demande », le titre de la demande est dans la carte, à 148 px du bord. Le test
 * tombait sur un écran parfaitement adapté. Ce qu'il fallait mesurer, c'est le creux
 * entre le haut du cadre et son premier contenu.
 *
 * E02 était hors de ce test, et c'est la maquette qui le décidait : son cadre
 * mobile commence par une couverture pleine largeur, sans en-tête à remplissage —
 * sa flèche de retour est posée en absolu à 50 px, dans un parent positionné. Cet
 * écart reste vrai, il est consigné, et l'écran vit maintenant dans
 * `agenda.spec.ts`.
 */
test.describe('l’en-tête mobile lit la zone sûre', () => {
  for (const ecran of ECRANS) {
    if (ecran.titreMobile === null) continue;
    test(`${ecran.nom} — l’en-tête ne garde pas les 50 px d’encoche simulée`, async ({ page }) => {
      await visiter(page, ecran.route, 390);
      const creux = await page.evaluate(() => {
        const frame = document.querySelector('[data-frame="mobile"]')!;
        const entete = frame.firstElementChild?.firstElementChild ?? null;
        const premier = entete?.firstElementChild ?? null;
        if (entete === null || premier === null) return null;
        return Math.round(
          premier.getBoundingClientRect().top - entete.getBoundingClientRect().top,
        );
      });
      expect(creux, 'en-tête mobile introuvable').not.toBeNull();
      // 50 px d'encoche simulée laisseraient 50 ; la zone sûre vaut 0 ici, donc il
      // ne reste que le remplissage latéral de la maquette — 12 ou 16 px.
      expect(creux).toBeLessThan(40);
    });
  }
});

// ─── Les deux règles dures ───────────────────────────────────────────────────

test.describe('règles dures', () => {
  /**
   * RÈGLE DURE 14 §2 — l'entraide n'est JAMAIS payante.
   *
   * Aucune route du module `help` ne lit `users.plan` ; à l'écran, cela veut dire
   * qu'aucun encart d'abonnement, aucun verrou et aucune mention de plan n'y a sa
   * place — et qu'un plan n'y donne aucune priorité d'affichage.
   *
   * LE TEST SUIVANT EST SA PREUVE DE NON-VACUITÉ, et c'est pour cela qu'il existe :
   * un test qui cherche des mots et n'en trouve jamais ne dit rien tant qu'on n'a
   * pas montré qu'il SAIT en trouver. Le même détecteur, appliqué à E03, doit
   * rapporter le quota et « Découvrir Premium ». S'il se tait là aussi, c'est le
   * détecteur qui est cassé, pas l'interface qui est propre.
   */
  const MOTS_DE_PLAN = /premium|abonnement|s’abonner|débloquer|illimité|quota|offre gratuite/i;

  for (const ecran of ENTRAIDE) {
    for (const w of [1440, 390] as const) {
      test(`${ecran.nom} ${w} px — aucune mention de plan (14 §2)`, async ({ page }) => {
        await visiter(page, ecran.route, w);
        const texte = await page.locator('body').innerText();
        expect(texte).not.toMatch(MOTS_DE_PLAN);
      });
    }
  }

  /**
   * LA PREUVE DE NON-VACUITÉ A BESOIN D'UNE SESSION DEPUIS QUE E03 LIT L'API, et
   * c'est tout l'intérêt de l'avoir gardée ici : sans session, l'écran de création
   * d'événement n'affiche plus que « Chargement… » puis une invitation à se
   * reconnecter, et le détecteur se tairait — exactement le faux négatif contre
   * lequel ce test existe. Le quota est maintenant celui du MEMBRE (`usage.items`
   * de `GET /me/subscription`), donc on cherche la FORME de la phrase, pas le « 1 »
   * que la maquette dessinait.
   */
  test('le même détecteur TROUVE le quota de l’agenda — il n’est donc pas aveugle', async ({
    page,
    context,
    request,
  }) => {
    await connecter(context, request);
    await visiter(page, '/agenda/nouveau', 1440);
    await expect(page.getByText('Chargement de votre compte…')).toHaveCount(0, { timeout: 30_000 });
    const texte = await page.locator('body').innerText();
    expect(texte).toMatch(MOTS_DE_PLAN);
    // 09 §3.1 : « 1 par mois en gratuit, illimité en Premium ». Légitime ICI, et
    // seulement ici — la règle dure de 14 §2 porte sur l'entraide.
    expect(texte).toMatch(/\d+ événement sur 1 ce mois-ci/);
  });

  /**
   * RÈGLE DURE 06 §2.7 — « Chaque page de la section affiche en permanence : Aucun
   * versement entre membres pour une démarche administrative. »
   *
   * Les dix cadres d'ORDINATEUR l'affichent. Sept cadres MOBILES ne l'affichent pas,
   * et c'est un défaut de la maquette, pas du transcodage : le texte n'y est
   * simplement pas écrit. Il n'a pas été ajouté — ce serait réécrire la maquette,
   * et sur une règle dure c'est la dernière chose à faire en silence.
   *
   * La liste est donc ÉPINGLÉE. Elle tombe dans les deux sens : si un onzième cadre
   * perd la règle, et le jour où la maquette la rendra aux sept. Les deux méritent
   * qu'on rouvre ce fichier.
   */
  const RULE = /Aucun versement entre membres/;

  for (const ecran of ENTRAIDE) {
    test(`${ecran.nom} ordinateur — la règle de non-paiement est affichée (06 §2.7)`, async ({
      page,
    }) => {
      await visiter(page, ecran.route, 1440);
      await expect(page.locator('[data-frame="desktop"]').getByText(RULE).first()).toBeVisible();
    });
  }

  test('sept cadres mobiles n’affichent PAS la règle — défaut de maquette, épinglé', async ({
    page,
  }) => {
    const manquants: string[] = [];
    for (const ecran of ENTRAIDE) {
      if (ecran.titreMobile === null) continue;
      await visiter(page, ecran.route, 390);
      const n = await page.locator('[data-frame="mobile"]').getByText(RULE).count();
      if (n === 0) manquants.push(ecran.nom);
    }
    expect(manquants).toEqual(['H02', 'H04', 'H09', 'H10', 'H05', 'H07', 'H08']);
  });
});

// ─── Ce que la maquette impose, et qu'on vérifie une fois ────────────────────

test.describe('jetons de design', () => {
  /** T1 §2.3 — jamais d'ombre portée. */
  test('aucune ombre portée sur les dix écrans', async ({ page }) => {
    const fautifs: string[] = [];
    for (const ecran of ECRANS) {
      await visiter(page, ecran.route, 1440);
      const ombres = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('*')]
          .map((el) => getComputedStyle(el).boxShadow)
          .filter((s) => s !== 'none' && !s.includes('inset 0 0 0 0') && !/0 0 #0000/.test(s)),
      );
      if (ombres.length > 0) fautifs.push(`${ecran.nom} : ${ombres[0]}`);
    }
    expect(fautifs).toEqual([]);
  });

  /** T1 §2.4 — aucun emoji dans l'interface. */
  test('aucun emoji dans l’interface', async ({ page }) => {
    const fautifs: string[] = [];
    for (const ecran of ECRANS) {
      await visiter(page, ecran.route, 1440);
      const texte = await page.locator('body').innerText();
      if (/\p{Extended_Pictographic}/u.test(texte)) fautifs.push(ecran.nom);
    }
    expect(fautifs).toEqual([]);
  });
});

// ─── Responsivité ────────────────────────────────────────────────────────────

/**
 * Aucun défilement horizontal de la PAGE — le symptôme n°1 d'une interface non
 * responsive, et le plus pénible à l'usage.
 *
 * DEUX ÉCARTS SONT MESURÉS ICI PLUTÔT QUE CACHÉS, parce qu'ils viennent de la
 * maquette et qu'on ne la réécrit pas :
 *
 *   · sous 390 px — trois rangées d'actions de carte poussent la page à 363, 370 et
 *     376 px. Leurs enfants sont en `flex-shrink: 0` et `white-space: nowrap`, et la
 *     maquette est dessinée à 390 : sous cette largeur, la rangée ne peut plus se
 *     comprimer. Une ligne (`flex-wrap: wrap` sur ces rangées) suffirait et serait
 *     invisible à 390 — mais le motif touche aussi 31 rangées des écrans déjà livrés,
 *     et ce lot ne doit pas changer leur sortie. C'est donc une décision à prendre,
 *     pas un correctif à glisser ici.
 *
 *   · H06 — la maquette ne dessine pas sa fiche en mobile, donc le cadre
 *     d'ordinateur est servi à toutes les largeurs et ses 745 px de colonnes
 *     débordent sous 768. C'est la même limite que le cadre unique de O05.
 *
 * Les deux listes sont ÉPINGLÉES : elles tombent si un écran s'y ajoute, et elles
 * tombent aussi le jour où la maquette les corrige.
 */
test.describe('aucun débordement horizontal', () => {
  const LARGEURS = [390, 430, 768, 1023, 1024, 1279, 1440, 1920] as const;

  for (const w of LARGEURS) {
    test(`${w} px`, async ({ page }) => {
      const fautifs: string[] = [];
      for (const ecran of ECRANS) {
        await visiter(page, ecran.route, w);
        const m = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          fenetre: window.innerWidth,
        }));
        if (m.scroll > m.fenetre + 1) fautifs.push(`${ecran.nom} ${m.scroll}>${m.fenetre}`);
      }
      // H06 sous 768 : cadre d'ordinateur servi faute de cadre mobile.
      const attendus = w < 768 ? ['H06'] : [];
      expect(fautifs.map((f) => f.split(' ')[0])).toEqual(attendus);
    });
  }

  /**
   * SOUS 390 px, l'écart de la maquette est MESURÉ, pas caché.
   *
   * Les trois rangées fautives ont une largeur minimale fixe : c'est pourquoi la
   * mesure est la MÊME à 320 et à 360 px, et c'est ce qui la rend épinglable. Le
   * jour où la maquette laissera ces rangées passer à la ligne, ce test tombera et
   * il faudra le retirer — ce qui est exactement ce qu'on veut qu'il arrive.
   */
  for (const w of [320, 360] as const) {
    test(`${w} px — l’écart de la maquette est mesuré, pas caché`, async ({ page }) => {
      const mesures: string[] = [];
      for (const ecran of ECRANS) {
        await visiter(page, ecran.route, w);
        const m = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          fenetre: window.innerWidth,
        }));
        if (m.scroll > m.fenetre + 1) mesures.push(`${ecran.nom} ${m.scroll}`);
      }
      expect(mesures).toEqual(['H01 363', 'H04 370', 'H06 745', 'H07 376']);
    });
  }
});
