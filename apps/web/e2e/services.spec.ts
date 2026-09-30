import { expect, test, type Page } from '@playwright/test';
import { connecter } from './session';

/**
 * Les dix écrans transcodés de `docs/template/06 Services.dc.html` — S01 à S10 —
 * et les quatre fenêtres que deux d'entre eux ouvrent.
 *
 * Ce que ces tests éprouvent n'est PAS le dessin : il est transcodé, donc il est
 * celui de la maquette par construction. Ils éprouvent ce qu'une image ne peut
 * pas contenir — la route qui mène à chaque planche, la bascule au bon seuil, ce
 * qui reste à l'écran quand la page défile, le titre que le lecteur d'écran
 * annonce, les états que l'URL choisit, et les SEPT RÈGLES DURES que ce module
 * doit rendre visibles :
 *
 *   · 10 §2.2 — le bandeau de non-paiement, affiché en permanence ;
 *   · 00 §49 — aucun compteur de vues, sur aucun contenu ;
 *   · 14 §17 — un seul encart partenaire, en pied de la section Logement ;
 *   · 10 §3.1 — la pastille « Sponsorisée », toujours visible ;
 *   · 10 §4.2 — « Fiche mise en avant » signalée, deux emplacements au plus ;
 *   · 10 §4.1 — le téléphone n'est jamais affiché sur une fiche pro ;
 *   · 10 §7  — l'aperçu du score de risque n'est jamais montré au membre.
 *
 * Les assertions portent sur la GÉOMÉTRIE et les RÔLES, jamais sur des classes :
 * le balisage vient de la maquette en styles en ligne, et viser une classe se
 * casserait à la première régénération.
 *
 * CHAQUE RÈGLE DURE A ÉTÉ ÉPROUVÉE PAR MUTATION — la règle cassée dans la SOURCE
 * (déclaration d'écran, adaptation du générateur, ou maquette temporairement
 * modifiée puis rendue), la régénération relancée, le test rejoué et vérifié
 * ROUGE, puis tout remis. Le tableau des mutations est dans le rapport de lot.
 *
 * DEUX RÈGLES D'ABSENCE PORTENT LEUR PROPRE PREUVE DE NON-VACUITÉ, et c'est pour
 * cela que ces tests existent : un détecteur qui cherche des mots et n'en trouve
 * jamais ne dit rien tant qu'on n'a pas montré qu'il SAIT en trouver.
 */

/** Ce fichier pilote lui-même ses tailles : un seul projet suffit. */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'piloté par le test');

/**
 * `waitUntil: 'load'` ET NON `'networkidle'`.
 *
 * Ces écrans n'émettent AUCUNE requête — la maquette est statique et ce lot ne
 * branche pas l'API — mais Next précharge les liens visibles d'une page App
 * Router : le réseau ne retombe jamais au calme, et `page.goto` expire au bout de
 * trente secondes sur un message qui ne nomme pas la cause. C'est la même
 * correction que `e2e/entraide-agenda.spec.ts` a mesurée, et elle ne vaut, ici
 * comme là-bas, que pour ce fichier.
 */
async function visiter(page: Page, route: string, width: number, height = 900): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto(route, { waitUntil: 'load' });
}

/** Le cadre visible à cette largeur — les deux sont dans le document. */
const cadre = (width: number) => (width >= 1024 ? '[data-frame="desktop"]' : '[data-frame="mobile"]');

/**
 * Les dix écrans, avec la ROUTE que la maquette écrit en légende de chaque
 * planche et le titre qu'elle dessine sur chaque cadre.
 *
 * `titreMobile` diffère parfois de `titreDesktop`, et c'est la maquette qui le
 * veut : S01, S04 et S06 titrent « Services » sur téléphone — l'en-tête mobile
 * range les trois rubriques sous le nom de la SECTION — et S08 abrège « Créer ma
 * fiche pro » en « Ma fiche pro ». Un titre uniformisé aurait gommé l'écart.
 *
 * S07 porte sa pastille « Pro » DANS son titre : la maquette la met dans le même
 * bloc que le nom, et le `<h1>` promu les garde tous les deux. Les séparer serait
 * redessiner.
 */
const ECRANS = [
  { nom: 'S01', route: '/services/logement', titre: 'Annonces logement', titreMobile: 'Services' },
  { nom: 'S02', route: '/services/logement/abc', titre: 'Studio meublé Lyon 7e', titreMobile: 'Studio meublé Lyon 7e' },
  { nom: 'S03', route: '/services/logement/nouveau', titre: 'Publier une annonce', titreMobile: 'Publier une annonce' },
  { nom: 'S04', route: '/services/emploi', titre: 'Bourses et emploi', titreMobile: 'Services' },
  { nom: 'S05', route: '/services/emploi/42', titre: 'Comptable junior', titreMobile: 'Comptable junior' },
  { nom: 'S06', route: '/services/annuaire', titre: 'Annuaire professionnel', titreMobile: 'Services' },
  { nom: 'S07', route: '/services/annuaire/mariam-bah', titre: 'Me Mariam BahPro', titreMobile: 'Me Mariam BahPro' },
  { nom: 'S08', route: '/services/annuaire/ma-fiche', titre: 'Créer ma fiche pro', titreMobile: 'Ma fiche pro' },
  { nom: 'S09', route: '/services/mes-annonces', titre: 'Mes annonces', titreMobile: 'Mes annonces' },
  { nom: 'S10', route: '/services/alertes', titre: 'Mes alertes', titreMobile: 'Mes alertes' },
] as const;

/** Les quatre écrans de LOGEMENT, ceux que 10 §2.2 vise. */
const LOGEMENT = ['S01', 'S02', 'S03', 'S09'] as const;

// ─── Les routes et le titre de page ──────────────────────────────────────────

/**
 * La maquette n'écrit AUCUN `<h2>` — zéro dans tout le fichier, compté. Le titre
 * de page est donc DÉCLARÉ avec le cadre (`tools/screens/06-services.mjs`) et
 * promu en `<h1>` au transcodage.
 *
 * Ce test vérifie les deux moitiés de cette promesse : qu'il y a UN titre, et que
 * c'est celui que la maquette affiche — pas un titre inventé pour la route. C'est
 * exactement le défaut qui a coûté A01.
 */
test.describe('les dix routes du module', () => {
  for (const ecran of ECRANS) {
    test(`${ecran.route} rend ${ecran.nom} et porte SON titre, aux deux largeurs`, async ({
      page,
    }) => {
      for (const { width, titre } of [
        { width: 1440, titre: ecran.titre },
        { width: 390, titre: ecran.titreMobile },
      ]) {
        await visiter(page, ecran.route, width);
        await expect(page.locator(`[data-screen="${ecran.nom}"]`)).toHaveCount(1);

        /**
         * Le titre est cherché par RÔLE, dans le cadre VISIBLE.
         *
         * `ScreenFrames` rend les deux cadres et en masque un par CSS : le `<h1>`
         * du cadre masqué ne compte pas pour un lecteur d'écran, et `getByRole`
         * l'ignore — mais le scoper au cadre visible rend l'échec lisible.
         */
        const h1 = page.locator(cadre(width)).getByRole('heading', { level: 1 });
        await expect(h1, `${ecran.route} à ${width} px`).toHaveText(titre);
      }
    });
  }

  /**
   * UNE PLANCHE, DEUX ROUTES — et c'est la maquette qui l'écrit : la légende de
   * S05 dit « /services/emploi/:id · /nouveau ». Le cadre porte le détail de
   * l'offre à gauche et le formulaire « PUBLIER UNE OFFRE » à droite.
   *
   * Ce test dit que `/services/emploi/nouveau` mène bien là, et que le formulaire
   * y est. Le jour où la maquette séparera les deux, il tombera — ce qui est
   * exactement ce qu'on veut qu'il arrive.
   */
  test('/services/emploi/nouveau tombe sur S05 : la maquette lui donne les deux routes', async ({
    page,
  }) => {
    await visiter(page, '/services/emploi/nouveau', 1440);
    await expect(page.locator('[data-screen="S05"]')).toHaveCount(1);
    await expect(page.getByText('PUBLIER UNE OFFRE')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publier l’offre' })).toBeVisible();
  });
});

// ─── La bascule de cadre ─────────────────────────────────────────────────────

test.describe('la bascule ordinateur/mobile a lieu à 1024 px', () => {
  test('1023 px montre le cadre mobile, 1024 le cadre ordinateur', async ({ page }) => {
    for (const { w, attendu } of [
      { w: 1023, attendu: 'mobile' },
      { w: 1024, attendu: 'desktop' },
    ] as const) {
      await visiter(page, '/services/logement', w);
      await expect(page.locator(`[data-frame="${attendu}"]`), `${w} px`).toBeVisible();
      const autre = attendu === 'mobile' ? 'desktop' : 'mobile';
      await expect(page.locator(`[data-frame="${autre}"]`), `${w} px`).toBeHidden();
    }
  });

  test('les dix écrans portent bien LEURS deux cadres', async ({ page }) => {
    for (const ecran of ECRANS) {
      await visiter(page, ecran.route, 1440);
      await expect(page.locator('[data-frame="desktop"]'), ecran.nom).toHaveCount(1);
      await expect(page.locator('[data-frame="mobile"]'), ecran.nom).toHaveCount(1);
    }
  });
});

// ─── Ce qui reste à l'écran quand la page défile ─────────────────────────────

/**
 * EXIGENCE DU PORTEUR : le panneau de gauche, la colonne de droite et l'en-tête
 * de recherche RESTENT À L'ÉCRAN pendant que le fil défile.
 *
 * La maquette ne l'exprime pas : c'est une image, rien n'y défile. Ce sont donc
 * des ADAPTATIONS, faites dans le générateur pour qu'elles survivent à la
 * régénération, et ces tests sont ce qui les tient.
 */
test.describe('le défilement — ordinateur', () => {
  /** Les cinq écrans que la maquette dote d'une colonne de contexte. */
  const AVEC_ASIDE = ['S02', 'S03', 'S04', 'S07', 'S10'];

  for (const ecran of ECRANS) {
    test(`${ecran.nom} — la barre haute et les colonnes suivent`, async ({ page }) => {
      /**
       * UNE FENÊTRE DE 400 px DE HAUT, et la mesure est ce qui l'a fixée.
       *
       * Les cadres de cette maquette vont de 628 px (S07) à 955 px (S01) de haut.
       * Dans une fenêtre de 900 px, la moitié d'entre eux ne défile pas du tout —
       * et un test qui ne défile pas ne prouve rien sur ce qui reste à l'écran
       * quand on défile. À 400 px, le plus court garde encore 228 px de marge.
       */
      await visiter(page, ecran.route, 1440, 400);

      const marge = await page.evaluate(
        () => document.documentElement.scrollHeight - window.innerHeight,
      );
      const defilement = Math.min(250, marge);
      // La colonne de contexte part à 76 px : il faut la dépasser, sinon une
      // colonne qui suivrait le défilement resterait quand même visible et le
      // test serait muet.
      expect(defilement, `${ecran.nom} : pas assez de marge pour défiler`).toBeGreaterThan(116);

      await page.evaluate((y) => window.scrollTo(0, y), defilement);
      await page.waitForTimeout(150);

      const p = await page.evaluate(() => {
        const frame = document.querySelector('[data-frame="desktop"]')!;
        const haut = (el: Element | null) =>
          el === null ? null : Math.round(el.getBoundingClientRect().top);
        const rail = frame.querySelector('nav');
        /**
         * La barre haute est reconnue par sa GÉOMÉTRIE, pas par un sélecteur : la
         * maquette ne lui donne ni rôle ni texte propre. C'est la rangée de 64 px
         * qui contient le champ « Rechercher dans la diaspora ».
         */
        const recherche = [...frame.querySelectorAll<HTMLElement>('*')].find(
          (el) => el.textContent?.trim() === 'Rechercher dans la diaspora',
        );
        const barre = recherche?.parentElement ?? null;
        return {
          defile: Math.round(window.scrollY),
          colonneGauche: haut(rail?.parentElement?.parentElement ?? null),
          barreHaute: haut(barre),
          colonneDroite: haut(frame.querySelector('aside')),
        };
      });

      expect(p.defile, 'la page doit avoir défilé').toBe(defilement);

      /**
       * Sans `sticky`, la colonne serait remontée de tout le défilement — à
       * −250 px. La tolérance d'un pixel n'est pas de la complaisance : le haut
       * mesuré vaut parfois −0,3 px, et `Math.round` en fait un `-0` que
       * `toBe(0)` refuse.
       */
      expect(p.colonneGauche, 'la colonne de gauche a suivi').toBeGreaterThan(-2);
      expect(p.colonneGauche, 'la colonne de gauche a suivi').toBeLessThan(2);

      // L'en-tête de recherche est collé en haut de la fenêtre.
      expect(p.barreHaute, 'la barre haute est introuvable').not.toBeNull();
      expect(p.barreHaute, 'la barre haute a suivi').toBeGreaterThan(-2);
      expect(p.barreHaute, 'la barre haute a suivi').toBeLessThan(2);

      if (AVEC_ASIDE.includes(ecran.nom)) {
        expect(p.colonneDroite, `${ecran.nom} doit avoir une colonne de contexte`).not.toBeNull();
        /**
         * Elle s'arrête SOUS la barre haute, à 76 px — sauf tout en bas de page,
         * où la fin de sa rangée la pousse vers le haut. L'assertion est donc
         * écrite comme la propriété l'est : elle n'a pas suivi le défilement.
         * Sans `sticky` elle serait à `76 − défilement`, c'est-à-dire négative.
         */
        expect(p.colonneDroite, 'la colonne de contexte est restée visible').toBeGreaterThanOrEqual(0);
        expect(p.colonneDroite, 'la colonne de contexte a suivi le défilement').toBeGreaterThan(
          76 - defilement + 20,
        );
        expect(p.colonneDroite, 'elle ne descend pas sous la barre haute').toBeLessThanOrEqual(76);
      } else {
        // Cinq écrans n'en ont pas : la maquette y étire le contenu sur toute la
        // largeur. Le dire ici empêche qu'une colonne apparaisse sans qu'on le voie.
        expect(p.colonneDroite, `${ecran.nom} n’a pas de colonne de contexte`).toBeNull();
      }
    });
  }
});

test.describe('le défilement — mobile', () => {
  /**
   * LA BARRE D'ONGLETS BASSE.
   *
   * L'assertion est PUREMENT GÉOMÉTRIQUE, et prise en HAUT de page : si la barre
   * n'était pas collante, son bas serait à la hauteur du document — plusieurs
   * centaines de pixels sous la fenêtre. La mesurer après avoir défilé jusqu'en
   * bas n'aurait rien prouvé : à cet endroit, une barre statique est visible
   * aussi. C'est la leçon que `e2e/entraide-agenda.spec.ts` a payée — son premier
   * test passait au vert avec le défaut.
   *
   * CINQ CADRES MOBILES SEULEMENT en portent une : S01, S04, S06, S09 et S10. Les
   * cinq autres sont des écrans de détail ou de formulaire, avec une flèche de
   * retour ou une croix. La liste est ÉPINGLÉE et tombe dans les deux sens.
   */
  const AVEC_ONGLETS = ['S01', 'S04', 'S06', 'S09', 'S10'];

  for (const ecran of ECRANS) {
    test(`${ecran.nom} — la barre d’onglets reste au bas de la fenêtre`, async ({ page }) => {
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

      if (!AVEC_ONGLETS.includes(ecran.nom)) {
        expect(p.basBarre, `${ecran.nom} n’a pas de barre d’onglets`).toBeNull();
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
   * LE BOUTON FLOTTANT DE PUBLICATION, sur les deux écrans qui en dessinent un.
   *
   * Dans la maquette il est `position: absolute` dans un cadre de 844 px. Dans
   * l'application, le conteneur du cadre mobile fait la hauteur de TOUTE la page :
   * le bouton se posait à 108 px du bas du DOCUMENT, donc invisible tant qu'on
   * n'avait pas déroulé la liste entière.
   *
   * Il est reconnu par sa GÉOMÉTRIE — 56 × 56 px, contre le bord droit — et non
   * par un sélecteur : la maquette ne lui donne ni texte ni rôle.
   */
  for (const nom of ['S01', 'S04'] as const) {
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
  test('le rail fait 76 px sur les dix cadres d’ordinateur', async ({ page }) => {
    for (const ecran of ECRANS) {
      await visiter(page, ecran.route, 1440);
      const rail = page.locator('[data-frame="desktop"] nav');
      await expect(rail, ecran.nom).toBeVisible();
      expect((await rail.boundingBox())?.width, ecran.nom).toBe(76);
    }
  });

  test('la colonne de contexte fait 300 px là où la maquette en dessine une', async ({ page }) => {
    const avec: string[] = [];
    for (const ecran of ECRANS) {
      await visiter(page, ecran.route, 1440);
      const aside = page.locator('[data-frame="desktop"] aside');
      if ((await aside.count()) === 0) continue;
      avec.push(ecran.nom);
      expect((await aside.boundingBox())?.width, ecran.nom).toBe(300);
    }
    // Épinglé dans les deux sens : un écran qui gagnerait ou perdrait sa colonne
    // se signalerait ici.
    expect(avec).toEqual(['S02', 'S03', 'S04', 'S07', 'S10']);
  });

  /**
   * §10.1 borne le contenu à 660 px. CINQ écrans sur dix l'écrivent dans leur
   * `<main>` ; les cinq autres ne le font pas — leurs grilles et leurs tableaux
   * s'étirent sur 1 016 px à 1 440. C'est la maquette qui en décide, et elle n'a
   * pas été réécrite : l'écart est mesuré ici plutôt que corrigé en silence.
   *
   * La liste tombe dans les deux sens : si un sixième écran s'étire, et le jour où
   * la maquette bornera les cinq.
   */
  test('le contenu est borné à 660 px, sauf cinq écrans que la maquette étire', async ({ page }) => {
    const larges: string[] = [];
    for (const ecran of ECRANS) {
      await visiter(page, ecran.route, 1440);
      const box = await page.locator('[data-frame="desktop"] main').boundingBox();
      expect(box, ecran.nom).not.toBeNull();
      if (box !== null && box.width > 660) larges.push(`${ecran.nom} ${Math.round(box.width)}px`);
    }
    expect(larges).toEqual(['S01 1016px', 'S05 1016px', 'S06 1016px', 'S08 1016px', 'S09 1016px']);
  });
});

// ─── L'encoche ───────────────────────────────────────────────────────────────

/**
 * Les 50 px du haut simulaient l'encoche dans une image. Un écran réel lit la
 * zone sûre — qui vaut 0 dans un navigateur, donc l'en-tête doit remonter contre
 * le bord.
 *
 * LA MESURE PORTE SUR L'EN-TÊTE, PAS SUR LE `<h1>` : S02 et S05 mettent leur
 * `<h1>` dans le corps, sous une couverture photo. Ce qu'il faut mesurer, c'est
 * le creux entre le haut du cadre et son premier contenu.
 *
 * S02 et S05 sont hors de ce test, et c'est la maquette qui le décide : leurs
 * cadres mobiles commencent par une couverture pleine largeur, sans en-tête à
 * remplissage. Le constat est consigné dans le rapport plutôt que corrigé en
 * silence.
 */
test.describe('l’en-tête mobile lit la zone sûre', () => {
  for (const ecran of ECRANS) {
    if (ecran.nom === 'S02' || ecran.nom === 'S05') continue;
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
      // 50 px d'encoche simulée laisseraient 50 ; la zone sûre vaut 0 ici, donc
      // il ne reste que le remplissage latéral de la maquette — 12 ou 16 px.
      expect(creux).toBeLessThan(40);
    });
  }
});

// ─── Les quatre fenêtres ─────────────────────────────────────────────────────

test.describe('S02 — « Contacter » ouvre la feuille « Présentez-vous »', () => {
  for (const width of [1440, 390] as const) {
    test(`${width} px — la fenêtre s’ouvre et porte son nom`, async ({ page }) => {
      await visiter(page, '/services/logement/abc', width);
      await page.locator(`${cadre(width)} [data-modal-open="S02C"]`).first().click();

      const dialog = page.getByRole('dialog', { name: 'Présentez-vous' });
      await expect(dialog).toBeVisible();
      // La feuille porte le rappel de non-paiement, juste au-dessus de l'envoi.
      await expect(dialog.getByText('Aucun versement avant visite')).toBeVisible();
    });
  }

  test('Échap ferme et rend le focus au bouton qui l’a ouverte', async ({ page }) => {
    await visiter(page, '/services/logement/abc', 1440);
    const bouton = page.locator('[data-frame="desktop"] [data-modal-open="S02C"]').first();
    await bouton.click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(bouton).toBeFocused();
  });

  test('un clic sur le voile ferme, un clic dans le panneau non', async ({ page }) => {
    await visiter(page, '/services/logement/abc', 1440);
    await page.locator('[data-frame="desktop"] [data-modal-open="S02C"]').first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    /**
     * LE CLIC « DANS LE PANNEAU » VISE SON TITRE, et non son coin.
     *
     * Première version : `click({ position: { x: 5, y: 5 } })` sur le panneau. Il
     * expirait au bout de trente secondes — « `[data-modal-overlay]` intercepts
     * pointer events ». La cause n'est pas un défaut de la modale : le panneau a
     * `border-radius: 28px`, et le point (5, 5) tombe HORS de la forme arrondie,
     * donc hors de la zone de clic. Le clic atteignait le voile, qui ferme.
     *
     * Viser le titre est à la fois juste et lisible : c'est un élément inerte,
     * franchement à l'intérieur du panneau.
     */
    await dialog.getByRole('heading', { level: 2 }).click();
    await expect(dialog, 'un clic dans le panneau ne ferme pas').toBeVisible();

    await dialog.locator('[data-modal-overlay]').click({ position: { x: 5, y: 5 } });
    await expect(dialog).toBeHidden();
  });

  /**
   * « ENVOYER » EST INERTE, et c'est délibéré : ce message ouvre une conversation
   * avec l'auteur de l'annonce (10 §2.3), et ce lot ne branche aucune route. Un
   * bouton qui refermerait la feuille ferait croire au membre que son message est
   * parti.
   */
  test('« Envoyer » ne referme rien : aucune route n’est branchée', async ({ page }) => {
    await visiter(page, '/services/logement/abc', 1440);
    await page.locator('[data-frame="desktop"] [data-modal-open="S02C"]').first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Envoyer' }).click();
    await expect(dialog, 'la feuille reste ouverte').toBeVisible();
  });
});

/**
 * L'ÉTAT L0 — 10 §2.3 : « un L0 pré-départ peut LIRE les annonces mais doit
 * passer par un parrain ou un accompagnant pour contacter ; l'interface le dit et
 * propose de demander un parrain. »
 *
 * Ce qui choisit entre L1+ et L0, c'est le NIVEAU DU MEMBRE, et ce lot ne le
 * connaît pas. `?niveau=l0` rend l'état atteignable sans rien affirmer.
 */
test.describe('S02 — l’état L0 de « Contacter »', () => {
  test('390 px — ?niveau=l0 ouvre la feuille de vérification dès l’arrivée', async ({ page }) => {
    await visiter(page, '/services/logement/abc?niveau=l0', 390);
    const dialog = page.getByRole('dialog', { name: 'Contacter Sarah' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Contacter demande une identité vérifiée.')).toBeVisible();
    await expect(
      dialog.getByRole('link', { name: 'Ou demandez à un parrain de visiter pour vous' }),
    ).toBeVisible();
  });

  /**
   * SUR ORDINATEUR, PAS DE FENÊTRE — et ce n'est pas un oubli : la maquette
   * dessine ce même état EN PLACE, dans la colonne de contexte du cadre de
   * 1440 px (planche « ÉTAT L0 · APRÈS “CONTACTER” »). Superposer la feuille
   * l'afficherait deux fois.
   *
   * Le test vérifie les deux moitiés : aucune boîte de dialogue, ET le message
   * bien présent dans la page.
   */
  /**
   * CE TEST A ÉTÉ RÉÉCRIT PARCE QUE SA PREMIÈRE VERSION ÉTAIT CREUSE, et c'est la
   * mutation qui l'a montré.
   *
   * Version d'origine : aller directement en 1440 px et vérifier
   * `getByRole('dialog')).toHaveCount(0)`. Elle passait au vert — Y COMPRIS quand
   * on retirait le `mobileOnly` qu'elle prétendait garder. La cause : une modale
   * est rendue CÔTÉ CLIENT, après l'hydratation, et `toHaveCount(0)` est satisfait
   * dans l'instant, sur un document qui n'a encore rien monté. Le test mesurait la
   * lenteur de React, pas la règle. Un relevé direct l'a confirmé : sous mutation,
   * la page portait bien `[data-modal]` et un `role="dialog"`.
   *
   * Version actuelle : on OUVRE d'abord la feuille en 390 px — ce qui prouve que
   * l'hydratation a eu lieu et que la fenêtre existe — puis on ÉLARGIT la fenêtre.
   * `Modal` suit la largeur tant qu'il est ouvert, donc la feuille doit
   * DISPARAÎTRE au passage du seuil, et l'écran d'ordinateur porter le même
   * message en place. Sans `mobileOnly`, elle reste : le test rougit.
   */
  test('1440 px — la feuille s’efface : la maquette dessine cet état dans la page', async ({
    page,
  }) => {
    await visiter(page, '/services/logement/abc?niveau=l0', 390);
    const dialog = page.getByRole('dialog', { name: 'Contacter Sarah' });
    await expect(dialog, 'la feuille doit d’abord exister — sinon on ne prouve rien').toBeVisible();

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(
      page.locator('[data-frame="desktop"]').getByText('Contacter demande une identité vérifiée.'),
    ).toBeVisible();
  });
});

test.describe('S05 — les deux fenêtres de l’offre', () => {
  const FENETRES = [
    {
      nom: 'S05L',
      titre: 'Vous quittez la plateforme',
      // 10 §3.1 : la mise en garde contre les arnaques à l'emploi.
      repere: 'Ne communiquez jamais de coordonnées bancaires pour une candidature.',
    },
    { nom: 'S05R', titre: 'Recommander un membre', repere: 'Commentaire' },
  ] as const;

  for (const fenetre of FENETRES) {
    for (const width of [1440, 390] as const) {
      test(`${fenetre.nom} à ${width} px — « ${fenetre.titre} »`, async ({ page }) => {
        await visiter(page, '/services/emploi/42', width);
        await page.locator(`${cadre(width)} [data-modal-open="${fenetre.nom}"]`).first().click();

        const dialog = page.getByRole('dialog', { name: fenetre.titre });
        await expect(dialog).toBeVisible();
        await expect(dialog.getByText(fenetre.repere)).toBeVisible();

        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);
      });
    }
  }

  /**
   * LE BOUTON DRAPEAU N'A AUCUN TEXTE dans la maquette — c'est le seul bouton
   * muet de tout le fichier. Son nom accessible est recopié de la maquette
   * elle-même, qui écrit « Signaler » à côté du même tracé sur S02 et S07.
   *
   * Sans `ICON_BUTTON_NAMES`, axe-core le relève en `critical` (`button-name`).
   */
  test('le bouton drapeau porte le nom que la maquette lui donne ailleurs', async ({ page }) => {
    await visiter(page, '/services/emploi/42', 1440);
    await expect(
      page.locator('[data-frame="desktop"]').getByRole('button', { name: 'Signaler' }),
    ).toBeVisible();
  });
});

// ─── Les règles dures ────────────────────────────────────────────────────────

test.describe('règles dures', () => {
  /**
   * ── RÈGLE DURE 10 §2.2 — LE BANDEAU DE NON-PAIEMENT ────────────────────────
   *
   * « Le bandeau “Aucun versement avant visite ou vérification. Si une annonce
   * demande un acompte à distance, signalez-la.” est renvoyé par l'API sur chaque
   * liste et chaque annonce, et AFFICHÉ EN PERMANENCE. »
   *
   * LA MAQUETTE ÉCRIT SA PROPRE FORMULATION, et trois fois différemment : le
   * cadre d'ordinateur de la liste et du formulaire dit « Aucun versement avant
   * visite ou vérification. Ne payez jamais une réservation à distance. », le
   * cadre mobile de la liste abrège en « Aucun versement avant visite. », et
   * l'annonce porte « Visitez avant tout versement. Ne transmettez jamais vos
   * papiers originaux. » (le « rappel de prudence » de §7). Le détecteur couvre
   * les trois : on ne réécrit pas la maquette pour faire coller un test.
   *
   * CINQ CADRES SUR HUIT L'AFFICHENT. Les trois autres — le formulaire sur
   * téléphone et les deux cadres de « Mes annonces » — ne l'écrivent pas, et
   * c'est un défaut de la maquette, pas du transcodage : le texte n'y est
   * simplement pas. Il n'a PAS été ajouté — ce serait réécrire la maquette, et
   * sur une règle dure c'est la dernière chose à faire en silence.
   *
   * La liste est donc ÉPINGLÉE, et elle tombe dans les deux sens.
   */
  const NON_PAIEMENT = /Aucun versement|Visitez avant tout versement/;

  const PORTENT_LA_REGLE = [
    { nom: 'S01', width: 1440 },
    { nom: 'S01', width: 390 },
    { nom: 'S02', width: 1440 },
    { nom: 'S02', width: 390 },
    { nom: 'S03', width: 1440 },
  ] as const;

  for (const { nom, width } of PORTENT_LA_REGLE) {
    test(`${nom} ${width} px — le rappel de non-paiement est affiché (10 §2.2)`, async ({
      page,
    }) => {
      const ecran = ECRANS.find((e) => e.nom === nom)!;
      await visiter(page, ecran.route, width);
      await expect(
        page.locator(cadre(width)).getByText(NON_PAIEMENT).first(),
      ).toBeVisible();
    });
  }

  test('trois cadres de logement ne l’affichent PAS — défaut de maquette, épinglé', async ({
    page,
  }) => {
    const manquants: string[] = [];
    for (const nom of LOGEMENT) {
      const ecran = ECRANS.find((e) => e.nom === nom)!;
      for (const width of [1440, 390] as const) {
        await visiter(page, ecran.route, width);
        const n = await page.locator(cadre(width)).getByText(NON_PAIEMENT).count();
        if (n === 0) manquants.push(`${nom} ${width}`);
      }
    }
    expect(manquants).toEqual(['S03 390', 'S09 1440', 'S09 390']);
  });

  /**
   * ── RÈGLE DURE 00 §49 — AUCUN COMPTEUR DE VUES ─────────────────────────────
   *
   * « Aucun compteur de vues n'est exposé à personne, sur aucun contenu. »
   *
   * DEUX DOCUMENTS SE CONTREDISENT, et la maquette tranche. `T5 S09` demande
   * « compteur de vues et contacts » ; la règle dure l'interdit. La maquette
   * écrit dans sa propre légende de route « /services/mes-annonces · AUCUN
   * COMPTEUR DE VUES » et n'affiche que « 6 contacts ».
   *
   * LE TEST PORTE SA PREUVE DE NON-VACUITÉ : le même relevé, sur le même écran,
   * DOIT trouver le compteur de contacts. S'il ne trouve rien du tout, c'est le
   * détecteur qui est cassé, pas l'interface qui est propre.
   */
  const VUES = /\b\d[\d\s]*vues?\b|\bvues?\s*:/i;

  for (const ecran of ECRANS) {
    for (const width of [1440, 390] as const) {
      test(`${ecran.nom} ${width} px — aucun compteur de vues (00 §49)`, async ({ page }) => {
        await visiter(page, ecran.route, width);
        const texte = await page.locator(cadre(width)).innerText();
        expect(texte).not.toMatch(VUES);
      });
    }
  }

  test('le même relevé TROUVE le compteur de contacts de S09 — il n’est donc pas aveugle', async ({
    page,
  }) => {
    await visiter(page, '/services/mes-annonces', 1440);
    const texte = await page.locator('[data-frame="desktop"]').innerText();
    // Le compteur que la maquette affiche bel et bien, et que la règle autorise.
    expect(texte).toMatch(/6 contacts/);
    // Et le détecteur de vues, appliqué à la même chaîne, ne trouve rien.
    expect(texte).not.toMatch(VUES);
  });

  /**
   * ── RÈGLE DURE 14 §17 — L'ENCART PARTENAIRE ────────────────────────────────
   *
   * « Aucun encart partenaire dans le fil, l'entraide, les guides, les réseaux,
   * la messagerie. Ils vivent uniquement sur une étape de parcours ET EN PIED DE
   * LA SECTION LOGEMENT. »
   *
   * 10 §7 borne la quantité : « un encart partenaire AU MAXIMUM en bas ».
   *
   * Les deux moitiés sont vérifiables : il y en a UN sur la liste de logement, et
   * AUCUN sur les neuf autres écrans du module. Le premier test est la preuve de
   * non-vacuité du second.
   */
  test('S01 porte UN encart partenaire, en pied de liste (14 §17, 10 §7)', async ({ page }) => {
    await visiter(page, '/services/logement', 1440);
    const encarts = page.locator('[data-frame="desktop"]').getByText(/^Partenaire\b/);
    await expect(encarts).toHaveCount(1);
    await expect(encarts.first()).toBeVisible();
  });

  test('aucun encart partenaire sur les neuf autres écrans (14 §17)', async ({ page }) => {
    const fautifs: string[] = [];
    for (const ecran of ECRANS) {
      if (ecran.nom === 'S01') continue;
      for (const width of [1440, 390] as const) {
        await visiter(page, ecran.route, width);
        const n = await page.locator(cadre(width)).getByText(/^Partenaire\b/).count();
        if (n > 0) fautifs.push(`${ecran.nom} ${width}`);
      }
    }
    expect(fautifs).toEqual([]);
  });

  /**
   * ── RÈGLE DURE 10 §3.1 — « SPONSORISÉE », TOUJOURS VISIBLE ─────────────────
   *
   * « Sponsorisée (is_sponsored, Premium) : mise en avant en tête des listes
   * pendant 14 jours, pastille “Sponsorisée” TOUJOURS VISIBLE. »
   * Et §11 : « une offre sponsorisée … n'occupe jamais plus de 2 emplacements de
   * tête ».
   *
   * La maquette dessine UNE offre sponsorisée, en PREMIER, pastille comprise, sur
   * les deux cadres. Les deux moitiés de la règle se mesurent donc : la pastille
   * existe, et le compte ne dépasse pas deux.
   */
  for (const width of [1440, 390] as const) {
    test(`S04 ${width} px — la pastille « Sponsorisée » est visible, et au plus 2 (10 §3.1)`, async ({
      page,
    }) => {
      await visiter(page, '/services/emploi', width);
      const pastilles = page.locator(cadre(width)).getByText('Sponsorisée', { exact: true });
      const n = await pastilles.count();
      expect(n, 'la pastille doit exister — elle est toujours visible').toBeGreaterThanOrEqual(1);
      expect(n, 'jamais plus de deux emplacements de tête').toBeLessThanOrEqual(2);
      await expect(pastilles.first()).toBeVisible();

      /**
       * ELLE EST EN TÊTE, et ce n'est pas un détail : « mise en avant en tête des
       * listes ». La pastille du haut de la liste doit être plus haute que la
       * première carte non sponsorisée.
       */
      const hauteurs = await page.evaluate((sel) => {
        const frame = document.querySelector(sel)!;
        const textes = [...frame.querySelectorAll<HTMLElement>('*')].filter(
          (el) => el.textContent?.trim() === 'Sponsorisée' && el.children.length === 0,
        );
        const autre = [...frame.querySelectorAll<HTMLElement>('*')].find(
          (el) => el.textContent?.trim() === 'Alternance' && el.children.length === 0,
        );
        return {
          sponsorisee: textes[0]?.getBoundingClientRect().top ?? null,
          suivante: autre?.getBoundingClientRect().top ?? null,
        };
      }, cadre(width));
      expect(hauteurs.sponsorisee).not.toBeNull();
      expect(hauteurs.suivante).not.toBeNull();
      expect(hauteurs.sponsorisee!, 'la sponsorisée est en tête de liste').toBeLessThan(
        hauteurs.suivante!,
      );
    });
  }

  /**
   * ── RÈGLE DURE 10 §4.2 — « FICHE MISE EN AVANT » ───────────────────────────
   *
   * « Les fiches PRO/PRO_PLUS obtiennent un emplacement mis en avant CLAIREMENT
   * SIGNALÉ (“Fiche mise en avant”) : AU PLUS 2 fiches mises en avant en tête,
   * puis le classement naturel. »
   *
   * La maquette signale les DEUX premières fiches d'ordinateur et laisse la
   * troisième sans mention. Les deux moitiés se mesurent : la mention existe, et
   * le compte ne dépasse pas deux.
   *
   * LE COMPTE EST BORNÉ À L'ANNUAIRE. « Fiche mise en avant » figure aussi sur
   * S08, dans la DESCRIPTION du plan Pro+ (« Fiche mise en avant, contacts
   * illimités ») : c'est un argument de vente, pas un emplacement de liste. Un
   * détecteur non borné aurait compté trois « emplacements de tête » répartis sur
   * deux écrans — exactement la dérive qu'un motif trop large produit en silence.
   */
  for (const width of [1440, 390] as const) {
    test(`S06 ${width} px — au plus deux fiches mises en avant, signalées (10 §4.2)`, async ({
      page,
    }) => {
      await visiter(page, '/services/annuaire', width);
      const mentions = page.locator(cadre(width)).getByText('Fiche mise en avant', { exact: true });
      const n = await mentions.count();
      expect(n, 'la mise en avant doit être signalée').toBeGreaterThanOrEqual(1);
      expect(n, 'au plus deux emplacements de tête').toBeLessThanOrEqual(2);
      await expect(mentions.first()).toBeVisible();
    });
  }

  test('la troisième fiche de l’annuaire n’est PAS mise en avant (10 §4.2)', async ({ page }) => {
    await visiter(page, '/services/annuaire', 1440);
    const frame = page.locator('[data-frame="desktop"]');
    const mentions = frame.getByText('Fiche mise en avant', { exact: true });
    await expect(mentions).toHaveCount(2);

    /**
     * `.last()` ET NON UN FILTRE « SANS ENFANT ».
     *
     * Première version : un `evaluate` qui ne retenait que les éléments dont
     * `children.length === 0`. Il ne trouvait PAS « Me Serge Loko », et le test
     * échouait sur un écran parfaitement conforme — le nom du pro vit dans un
     * `<span>` qui contient AUSSI la coche verte de vérification, donc un enfant.
     * Le filtre visait la forme du balisage plutôt que ce qu'on mesure.
     */
    const troisieme = frame.getByText('Me Serge Loko', { exact: true }).last();
    await expect(troisieme, 'la troisième fiche est bien là').toBeVisible();

    const basTroisieme = (await troisieme.boundingBox())?.y ?? null;
    expect(basTroisieme).not.toBeNull();

    // Les deux mentions sont AU-DESSUS de la troisième fiche : « en tête ».
    for (let i = 0; i < 2; i += 1) {
      const box = await mentions.nth(i).boundingBox();
      expect(box?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(basTroisieme!);
    }
  });

  /**
   * ── RÈGLE DURE 10 §4.1 — LE TÉLÉPHONE N'EST JAMAIS AFFICHÉ ─────────────────
   *
   * « Méthode de contact (PLATFORM_MESSAGE, EMAIL, PHONE_ON_REQUEST — le
   * téléphone n'est JAMAIS stocké ici ni affiché ; “sur demande” signifie que le
   * pro le communique lui-même en message). »
   *
   * Le test parcourt les dix écrans, aux deux largeurs, et exige qu'aucun ne
   * porte de numéro.
   *
   * LE TEST SUIVANT EST SA PREUVE DE NON-VACUITÉ : le MÊME détecteur, appliqué à
   * `/compte/securite` — le seul écran du produit qui affiche un téléphone, et
   * encore, masqué — doit en trouver un. S'il se tait là aussi, c'est le
   * détecteur qui est cassé, pas l'interface qui est propre.
   */
  const TELEPHONE = /\+\d[\d\s•]{4,}|\b0[1-9](?:[\s.]?\d{2}){4}\b/;

  for (const ecran of ECRANS) {
    for (const width of [1440, 390] as const) {
      test(`${ecran.nom} ${width} px — aucun numéro de téléphone (10 §4.1)`, async ({ page }) => {
        await visiter(page, ecran.route, width);
        const texte = await page.locator(cadre(width)).innerText();
        expect(texte).not.toMatch(TELEPHONE);
      });
    }
  }

  /**
   * K04 EXIGE MAINTENANT UNE SESSION, et c'est ce test qui l'a rendu visible.
   *
   * Il est la preuve de non-vacuité du détecteur : appliqué à l'écran qui affiche un
   * téléphone — masqué — il doit en TROUVER un. Depuis que K04 lit `GET /me`, une
   * visite sans session n'affiche plus que l'état d'attente : le détecteur ne
   * trouvait plus rien, et ce test rougissait. Son échec était juste — il disait
   * exactement ce qu'il est là pour dire, « je ne vois plus de numéro » — et la
   * réponse n'est pas de l'assouplir mais de lui donner la session que l'écran
   * réclame désormais.
   *
   * Sans lui, les vingt cas ci-dessus continueraient de passer sur un détecteur
   * devenu aveugle, et personne ne le saurait.
   */
  test('le même détecteur TROUVE le numéro masqué de K04 — il n’est donc pas aveugle', async ({
    context,
    page,
    request,
  }) => {
    await connecter(context, request);
    await visiter(page, '/compte/securite', 1440);
    await page.locator('[data-screen="K04"]').waitFor({ state: 'attached', timeout: 20_000 });
    const texte = await page.locator('[data-frame="desktop"]').innerText();
    expect(texte).toMatch(TELEPHONE);
  });

  /**
   * S08 dit au membre ce que §4.1 exige du serveur : la méthode de contact est la
   * messagerie de la plateforme, et le justificatif n'est jamais affiché.
   */
  test('S08 annonce la messagerie comme méthode de contact et protège le justificatif', async ({
    page,
  }) => {
    await visiter(page, '/services/annuaire/ma-fiche', 1440);
    const frame = page.locator('[data-frame="desktop"]');
    await expect(frame.getByText('Messagerie de la plateforme')).toBeVisible();
    await expect(frame.getByText('Il n\'est jamais affiché')).toBeVisible();
  });

  /**
   * ── RÈGLE DURE 10 §7 — LE SCORE DE RISQUE N'EST PAS AFFICHÉ ────────────────
   *
   * « Publier un logement : formulaire, photos, aperçu du score de risque NON
   * AFFICHÉ (interne), message “en vérification” si bloquée. »
   *
   * Le score est un nombre entre 0 et 1 (§2.2). Le détecteur cherche donc le mot
   * et le nombre, sur les quatre écrans de logement.
   *
   * CE QUI EST AUTORISÉ, ET QU'ON VÉRIFIE AUSSI : le message « en vérification »
   * sur le formulaire, et le rappel de prudence RENFORCÉ sur l'annonce (§2.2,
   * tranche 0,4–0,7) — « ANNONCE À RISQUE MOYEN ». C'est la preuve de
   * non-vacuité : le même relevé de texte trouve ces deux-là.
   */
  const SCORE = /score|risque\s*[:=]|0[.,][0-9]\b/i;

  for (const nom of LOGEMENT) {
    for (const width of [1440, 390] as const) {
      test(`${nom} ${width} px — aucun aperçu du score de risque (10 §7)`, async ({ page }) => {
        const ecran = ECRANS.find((e) => e.nom === nom)!;
        await visiter(page, ecran.route, width);
        const texte = await page.locator(cadre(width)).innerText();
        expect(texte).not.toMatch(SCORE);
      });
    }
  }

  test('le même relevé TROUVE « en vérification » et « À RISQUE MOYEN » — il n’est pas aveugle', async ({
    page,
  }) => {
    await visiter(page, '/services/logement/nouveau', 1440);
    const formulaire = await page.locator('[data-frame="desktop"]').innerText();
    expect(formulaire).toMatch(/Votre annonce est en vérification/);
    expect(formulaire, 'et pourtant aucun score').not.toMatch(SCORE);

    await visiter(page, '/services/logement/abc', 1440);
    const annonce = await page.locator('[data-frame="desktop"]').innerText();
    // §2.2, tranche 0,4–0,7 : « l'interface ajoute un rappel de prudence renforcé ».
    expect(annonce).toMatch(/ANNONCE À RISQUE MOYEN/);
    expect(annonce, 'la tranche est dite, jamais le chiffre').not.toMatch(SCORE);
  });

  /**
   * ── RÈGLE DURE 00 §47 — LE MOT « CERTIFIÉ » N'APPARAÎT NULLE PART ──────────
   *
   * « Le mot “certifié” n'apparaît nulle part dans l'interface. La plateforme ne
   * vérifie aucun dossier administratif. »
   *
   * La nuance compte sur CE module précisément : l'annuaire pro repose sur un
   * justificatif d'activité et une validation humaine (§4.1), donc c'est
   * exactement l'endroit où le mot serait tentant. La maquette écrit « vérifié »
   * et « validation », jamais « certifié » — et le test le montre dans les deux
   * sens, ce qui prouve que le relevé lit bien le texte.
   */
  test('« certifié » n’apparaît sur aucun des dix écrans, mais « vérifié » si (00 §47)', async ({
    page,
  }) => {
    const fautifs: string[] = [];
    let vus = 0;
    for (const ecran of ECRANS) {
      for (const width of [1440, 390] as const) {
        await visiter(page, ecran.route, width);
        const texte = await page.locator(cadre(width)).innerText();
        if (/certifi/i.test(texte)) fautifs.push(`${ecran.nom} ${width}`);
        if (/vérifi/i.test(texte)) vus += 1;
      }
    }
    expect(fautifs).toEqual([]);
    // Non-vacuité : le relevé lit bien le texte de la page.
    expect(vus, 'le relevé doit trouver « vérifié » quelque part').toBeGreaterThan(0);
  });
});

// ─── Ce que la maquette impose, et qu'on vérifie une fois ────────────────────

test.describe('jetons de design', () => {
  /**
   * T1 §2.3 — jamais d'ombre portée.
   *
   * LE COMPTE D'ÉLÉMENTS EXAMINÉS EST VÉRIFIÉ, et ce n'est pas du zèle : un
   * relevé d'absence qui ne regarde rien passe au vert pour toujours. La leçon
   * vient de ce lot — un test d'absence de fenêtre y passait au vert parce qu'il
   * mesurait une page pas encore hydratée (voir « la feuille s'efface »).
   */
  test('aucune ombre portée sur les dix écrans', async ({ page }) => {
    const fautifs: string[] = [];
    let examines = 0;
    for (const ecran of ECRANS) {
      await visiter(page, ecran.route, 1440);
      const releve = await page.evaluate(() => {
        const tous = [...document.querySelectorAll<HTMLElement>('*')];
        return {
          total: tous.length,
          ombres: tous
            .map((el) => getComputedStyle(el).boxShadow)
            .filter((s) => s !== 'none' && !s.includes('inset 0 0 0 0') && !/0 0 #0000/.test(s)),
        };
      });
      examines += releve.total;
      if (releve.ombres.length > 0) fautifs.push(`${ecran.nom} : ${releve.ombres[0]}`);
    }
    expect(fautifs).toEqual([]);
    // Non-vacuité : ces dix écrans sont denses, le relevé a vraiment vu la page.
    expect(examines, 'le relevé doit avoir examiné la page').toBeGreaterThan(2000);
  });

  /** T1 §2.4 — aucun emoji dans l'interface. Même garde de non-vacuité. */
  test('aucun emoji dans l’interface', async ({ page }) => {
    const fautifs: string[] = [];
    let caracteres = 0;
    for (const ecran of ECRANS) {
      await visiter(page, ecran.route, 1440);
      const texte = await page.locator('body').innerText();
      caracteres += texte.length;
      if (/\p{Extended_Pictographic}/u.test(texte)) fautifs.push(ecran.nom);
    }
    expect(fautifs).toEqual([]);
    expect(caracteres, 'le relevé doit avoir lu du texte').toBeGreaterThan(5000);
  });
});

// ─── Responsivité ────────────────────────────────────────────────────────────

/**
 * Aucun défilement horizontal de la PAGE — le symptôme n°1 d'une interface non
 * responsive, et le plus pénible à l'usage.
 *
 * Les écarts éventuels sont MESURÉS plutôt que cachés : ils viennent de la
 * maquette, et on ne la réécrit pas. La liste est épinglée et tombe dans les deux
 * sens.
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
      expect(fautifs).toEqual([]);
    });
  }
});
