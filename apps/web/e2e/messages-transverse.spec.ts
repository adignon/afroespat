import { expect, test, type Page } from '@playwright/test';

/**
 * M01 et X01 à X04 — « 09 Messages et transverse ».
 *
 * Ce que ces tests éprouvent n'est PAS le dessin : il est transcodé de
 * `docs/template/09 Messages et transverse.dc.html`, donc il est celui de la
 * maquette par construction. Ils éprouvent ce qu'une image ne peut pas contenir —
 * la bascule de forme, les états que l'URL choisit, et les RÈGLES DU DOSSIER que
 * l'écran doit rendre visibles (08 §5.1, 12 §2.1, 11 §2.1).
 *
 * Les assertions portent sur la GÉOMÉTRIE et les RÔLES, jamais sur des classes.
 */

/** Ce fichier pilote lui-même ses tailles : un seul projet suffit. */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'piloté par le test');

/**
 * `load` et non `networkidle` : ces écrans n'émettent AUCUNE requête — la maquette
 * est statique et ce lot ne branche pas l'API. Next précharge en plus les liens
 * visibles, donc le réseau ne retombe jamais au calme et `networkidle` expire sur
 * un message qui ne nomme pas la cause.
 */
async function visiter(page: Page, url: string, width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: width < 1024 ? 844 : 900 });
  await page.goto(url, { waitUntil: 'load' });
}

const ORDINATEUR = '[data-frame="desktop"]';
const MOBILE = '[data-frame="mobile"]';

// ─── Les routes et leur titre ────────────────────────────────────────────────

/**
 * Le titre est celui que le transcodeur a promu en `<h1>` : c'est le texte VISIBLE
 * de la maquette, pas un titre inventé pour la route. C'est exactement la faute
 * qu'avait commise la réécriture manuelle d'A01.
 */
const ROUTES = [
  { url: '/messages', ecran: 'M01', ordinateur: 'Messages', mobile: 'Messages' },
  {
    url: '/messages/1',
    ecran: 'M01',
    ordinateur: 'Messages',
    // Sur téléphone, la conversation est une PAGE À PART : son titre est celui de
    // la conversation — ici le titre du parcours (08 §8).
    mobile: 'Mes études à Lyon',
  },
  { url: '/notifications', ecran: 'X02', ordinateur: 'Notifications', mobile: 'Notifications' },
  /**
   * `/recherche` N'A PAS DE TITRE MOBILE, et ce n'est pas un oubli de déclaration :
   * la maquette n'en dessine aucun sur son cadre de 390 px — elle n'y écrit que la
   * requête, dans le champ de recherche. Promouvoir une saisie en `<h1>` serait un
   * titre inventé ; l'écart est donc NOMMÉ ici, comme `check-contrast.mjs` nomme ses
   * paires sous le seuil. Le jour où la maquette lui donne un titre, ce test tombe et
   * force à le déclarer.
   */
  { url: '/recherche', ecran: 'X01', ordinateur: 'Résultats pour « visale »', mobile: null },
] as const;

test.describe('les quatre routes rendent leur écran et SON titre', () => {
  for (const { url, ecran, ordinateur, mobile } of ROUTES) {
    test(`${url} — ordinateur`, async ({ page }) => {
      await visiter(page, url, 1440);
      await expect(page.locator(`[data-screen="${ecran}"]`)).toHaveCount(1);
      await expect(
        page.locator(ORDINATEUR).getByRole('heading', { level: 1 }),
      ).toHaveText(ordinateur);
    });

    test(`${url} — mobile`, async ({ page }) => {
      await visiter(page, url, 390);
      const titres = page.locator(MOBILE).getByRole('heading', { level: 1 });
      if (mobile === null) {
        await expect(titres, 'écart connu : la maquette ne dessine pas de titre ici').toHaveCount(0);
      } else {
        await expect(titres).toHaveText(mobile);
      }
    });
  }
});

/**
 * ── 08 §5.1 — LA MESSAGERIE N'EST PAS UNE ENTRÉE DE NAVIGATION ───────────────
 *
 * « Pas de groupe libre. La messagerie n'est pas une entrée de navigation : icône
 * en barre haute, accès depuis les profils, annonces, demandes. »
 *
 * C'est une règle qu'un écran peut trahir tout seul : il suffit d'ajouter
 * « Messages » au rail ou à la barre d'onglets pour que la messagerie devienne une
 * destination comme une autre — exactement ce que la règle refuse. Le test fige donc
 * les entrées des DEUX barres, et non la seule absence du mot.
 */
test.describe('08 §5.1 — la messagerie n’est pas une entrée de navigation', () => {
  test('le rail de 76 px porte cinq entrées, et « Messages » n’en est pas', async ({ page }) => {
    await visiter(page, '/messages', 1440);
    const rail = page.locator(`${ORDINATEUR} nav`);
    await expect(rail).toBeVisible();
    expect((await rail.boundingBox())?.width, 'rail vertical de 76 px (T5 §0)').toBe(76);

    const entrees = await rail.locator('> span').allInnerTexts();
    expect(entrees.filter((t) => t.trim() !== '')).toEqual([
      'Accueil',
      'Parcours',
      'Entraide',
      'Services',
      'Agenda',
    ]);
  });

  test('la barre d’onglets basse porte cinq entrées, et « Messages » n’en est pas', async ({
    page,
  }) => {
    await visiter(page, '/messages', 390);
    /**
     * La barre est le DERNIER bloc du cadre mobile.
     *
     * Le `main` est traversé explicitement : le générateur enveloppe le cadre d'un
     * `<main style="display:contents">` quand la maquette n'en fournit pas. Il ne
     * dessine rien — `display: contents` — mais il EXISTE dans le DOM, et un
     * sélecteur d'enfant direct s'arrête dessus. Écrit sans lui, ce test ne trouvait
     * aucun élément et échouait sur un message qui ne nommait pas la cause.
     */
    const onglets = page.locator(`${MOBILE} main > div`).last();
    await expect(onglets).toBeVisible();
    expect(await onglets.locator('> div').allInnerTexts()).toEqual([
      'Accueil',
      'Parcours',
      'Entraide',
      'Services',
      'Compte',
    ]);
  });
});

/**
 * ── M01 — UN SEUL CADRE D'ORDINATEUR, DEUX CADRES MOBILES ────────────────────
 *
 * T5 M01 : « deux volets sur ordinateur (liste 320 px + conversation), pages
 * séparées sur mobile ». C'est la seule chose que la maquette décide ici, et c'est
 * donc la seule qu'il vaille la peine de mesurer.
 */
test.describe('M01 — la forme que T5 décrit', () => {
  test('sur ordinateur, la liste fait 320 px et la conversation est à côté', async ({ page }) => {
    await visiter(page, '/messages', 1440);
    /**
     * Le volet de liste est la CARTE qui porte le titre « Messages » — c'est-à-dire
     * le grand-parent du `<h1>`. Le désigner par sa place dans l'arbre
     * (`main > div > div`) désignait la colonne de gauche de 400 px, dont les 24 px
     * de remplissage donnent 352 : un nombre proche, sur le mauvais élément, et un
     * test qui aurait pu être « corrigé » en changeant l'attendu.
     */
    const liste = page.locator(ORDINATEUR).getByRole('heading', { level: 1 }).locator('../..');
    const boite = await liste.boundingBox();
    expect(boite?.width, 'volet de liste de 320 px').toBe(320);

    // La conversation est ouverte DANS le même cadre : c'est ce qui fait les
    // « deux volets ». Son en-tête porte le nom de la conversation.
    await expect(page.locator(ORDINATEUR).getByText('Parcours · Aïcha (parraine), Moussa, Fanta')).toBeVisible();
  });

  test('sur téléphone, /messages montre la LISTE et /messages/:id la CONVERSATION', async ({
    page,
  }) => {
    await visiter(page, '/messages', 390);
    // La liste porte la section « Demandes » (08 §5.2, premiers messages non acceptés).
    await expect(page.locator(MOBILE).getByText('DEMANDES · 2')).toBeVisible();
    await expect(page.locator(MOBILE).getByText('Message…')).toHaveCount(0);

    await visiter(page, '/messages/1', 390);
    // La conversation porte le champ de saisie, et plus la liste.
    await expect(page.locator(MOBILE).getByText('Message…')).toBeVisible();
    await expect(page.locator(MOBILE).getByText('DEMANDES · 2')).toHaveCount(0);
  });

  /**
   * 08 §5.2 — « premier message = demande de conversation, l'autre accepte ou
   * ignore ; sans réponse, pas de second message ». La maquette le DIT à l'écran, et
   * c'est ce qui empêche de croire qu'on peut écrire à n'importe qui sans limite.
   *
   * ⚠ La carte « DEMANDE EN ATTENTE » qui porte cette phrase n'appartient à AUCUN
   * cadre (voir `tools/screens/09-messages.mjs`) : elle n'est donc pas montée, et la
   * phrase n'est nulle part à l'écran. Le test fige cette absence pour qu'elle se
   * voie, plutôt que de la passer sous silence.
   */
  test('la phrase de la demande en attente n’est PAS à l’écran (carte non montée)', async ({
    page,
  }) => {
    await visiter(page, '/messages/1', 1440);
    await expect(
      page.getByText('Vous pourrez continuer quand'),
      'écart connu : la carte « DEMANDE EN ATTENTE » est une carte nue, hors cadre',
    ).toHaveCount(0);
  });
});

/**
 * ── 12 §2.1 ET §2.4 — AUCUNE NOTIFICATION NE PORTE UN CORPS DE MESSAGE ───────
 *
 * « Charge utile minimale … jamais de contenu de message privé dans le push,
 * seulement "Nouveau message de Sandra". »
 *
 * La maquette ne dessine AUCUNE notification de catégorie MESSAGE — elle en dessine
 * cinq, et aucune n'est un message. Le test fige donc la liste exacte : le jour où un
 * lot en ajoute une, il tombe, et celui qui l'ajoute doit vérifier la règle au lieu de
 * la découvrir en production.
 */
const NOTIFICATIONS = [
  'Sandra et 4 autres ont trouvé votre conseil utile',
  '3 nouvelles réponses à votre demande « Un lit et une table »',
  'Échéance Logement dans 9 jours',
  'Repas partagé demain à 12 h',
  'Aïcha a accepté d’être votre parraine',
] as const;

test.describe('12 §2.1 — la liste des notifications', () => {
  test('les cinq lignes de la maquette, et aucune notification de message', async ({ page }) => {
    await visiter(page, '/notifications', 1440);
    // La carte des lignes est le dernier bloc du contenu principal.
    const lignes = page.locator(`${ORDINATEUR} main > div`).last().locator('> div');
    await expect(lignes).toHaveCount(NOTIFICATIONS.length);

    const textes = await lignes.evaluateAll((rangees) =>
      rangees.map((r) => (r.children[1]?.textContent ?? '').trim()),
    );
    expect(textes).toEqual([...NOTIFICATIONS]);
  });

  /**
   * La pastille de filtre « Messages » existe pourtant (12 §2.1 la liste bien comme
   * catégorie). Elle est donc présente, et ne filtre aucune ligne dessinée : c'est le
   * manque de la maquette, pas une violation, et il est nommé ici.
   */
  test('la pastille « Messages » existe mais ne filtre aucune ligne dessinée', async ({ page }) => {
    await visiter(page, '/notifications', 1440);
    await expect(page.locator(ORDINATEUR).getByText('Messages', { exact: true })).toBeVisible();
  });
});

/**
 * ── X02 — LES DEUX FORMES DE 12 §2.7 ─────────────────────────────────────────
 *
 * « Cloche en barre haute avec compteur de non-lus, panneau déroulant, page
 * complète. » Les deux formes sont dessinées ; l'URL choisit.
 */
test.describe('X02 — panneau déroulant et page complète', () => {
  test('?vue=panneau ouvre le panneau, avec « Tout marquer lu » et « Voir tout »', async ({
    page,
  }) => {
    await visiter(page, '/notifications?vue=panneau', 1440);
    const cadre = page.locator(ORDINATEUR);
    await expect(cadre.getByRole('link', { name: 'Voir tout' })).toBeVisible();
    await expect(cadre.getByRole('link', { name: 'Tout marquer lu' })).toBeVisible();

    // Le panneau est POSÉ au-dessus de la page : la maquette le dessine à 420 px,
    // ancré sous la barre haute.
    const panneau = cadre.getByRole('link', { name: 'Voir tout' }).locator('..');
    const boite = await panneau.boundingBox();
    expect(boite?.width, 'panneau déroulant de 420 px').toBe(420);
  });

  test('la page complète n’a PAS de « Voir tout » : c’est déjà tout', async ({ page }) => {
    await visiter(page, '/notifications', 1440);
    await expect(page.getByRole('link', { name: 'Voir tout' })).toHaveCount(0);
  });

  test('une vue inconnue ne casse pas la page', async ({ page }) => {
    await visiter(page, '/notifications?vue=nimporte-quoi', 1440);
    await expect(page.locator(ORDINATEUR).getByRole('heading', { level: 1 })).toHaveText(
      'Notifications',
    );
    await expect(page.getByRole('link', { name: 'Voir tout' })).toHaveCount(0);
  });
});

/**
 * ── X03 — « SIGNALER », fenêtre sur ordinateur, feuille du bas sur mobile ────
 *
 * La maquette l'écrit elle-même sous sa planche. C'est la seule chose que ce lot
 * puisse trahir : le reste du dessin est transcodé.
 */
test.describe('X03 — la feuille de signalement', () => {
  test('?feuille=signaler ouvre une boîte de dialogue nommée « Signaler »', async ({ page }) => {
    await visiter(page, '/messages/1?feuille=signaler', 1440);
    await expect(page.getByRole('dialog', { name: 'Signaler' })).toBeVisible();
    // Les six motifs de T5, dans l'ordre de la maquette.
    for (const motif of [
      'Arnaque',
      'Demande d’argent',
      'Harcèlement',
      'Indésirable',
      'Inapproprié',
      'Autre',
    ]) {
      await expect(page.getByRole('dialog').getByText(motif, { exact: true })).toBeVisible();
    }
  });

  test('08 §5.2 — la feuille annonce que la conversation sera lue par les modérateurs', async ({
    page,
  }) => {
    await visiter(page, '/messages/1?feuille=signaler', 1440);
    await expect(
      page.getByRole('dialog').getByText('La conversation sera visible des modérateurs.'),
    ).toBeVisible();
  });

  test('sur ordinateur c’est une FENÊTRE centrée, sur téléphone une FEUILLE du bas', async ({
    page,
  }) => {
    await visiter(page, '/messages/1?feuille=signaler', 1440);
    const fenetre = await page.locator('[data-modal-panel]').boundingBox();
    expect(fenetre).not.toBeNull();
    if (fenetre === null) return;
    expect(Math.round(fenetre.width), 'la carte de 480 px de la maquette').toBe(480);
    // Centrée : autant d'espace à gauche qu'à droite, à un pixel près.
    expect(Math.abs(fenetre.x - (1440 - fenetre.x - fenetre.width))).toBeLessThanOrEqual(1);

    await visiter(page, '/messages/1?feuille=signaler', 390);
    const feuille = await page.locator('[data-modal-panel]').boundingBox();
    expect(feuille).not.toBeNull();
    if (feuille === null) return;
    // Toute la largeur, posée sur le bord bas : c'est ce qui fait une feuille.
    expect(Math.round(feuille.width)).toBe(390);
    expect(Math.round(feuille.y + feuille.height)).toBeGreaterThanOrEqual(842);
  });

  test('Échap referme, et le voile aussi', async ({ page }) => {
    await visiter(page, '/messages/1?feuille=signaler', 1440);
    /**
     * ON ATTEND QUE LE FOCUS SOIT ENTRÉ DANS LA BOÎTE avant de frapper Échap.
     *
     * `onKeyDown` est posé sur la boîte de dialogue : tant que le focus est sur
     * `<body>`, la touche ne lui parvient pas. Or cette feuille s'ouvre DÈS L'ARRIVÉE
     * (l'URL la demande), donc à l'hydratation — et la première frappe partait avant
     * l'effet qui place le focus. Le test échouait « Échap ne ferme pas », ce qui
     * accusait le composant au lieu du minutage.
     *
     * La croix est le premier élément focalisable du panneau — c'est le transcodeur
     * qui l'a promue en `<button aria-label="Fermer">`.
     */
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Fermer' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await visiter(page, '/messages/1?feuille=signaler', 1440);
    await expect(page.getByRole('dialog')).toBeVisible();
    /**
     * Un clic DANS le panneau ne ferme pas — sans quoi un membre qui sélectionne du
     * texte et relâche à côté perdrait ce qu'il écrivait.
     *
     * Le clic vise un TEXTE du panneau, et non son coin : le panneau a 28 px de rayon,
     * donc à 5 px de son angle c'est le VOILE qu'on touche, pas lui. Playwright l'a dit
     * mot pour mot (« div data-modal-overlay intercepts pointer events »), et c'est
     * exact — un clic pile dans l'angle arrondi de la fenêtre la referme. Consigné au
     * rapport ; ce test mesure la règle, pas l'angle.
     */
    await page
      .getByRole('dialog')
      .getByText('La conversation sera visible des modérateurs.')
      .click();
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await page.locator('[data-modal-overlay]').click({ position: { x: 5, y: 5 } });
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  /**
   * LA CONFIRMATION N'A AUCUN CONTRÔLE — ni croix, ni poignée, ni bouton : la
   * maquette n'en dessine pas. `aria-modal="true"` promet pourtant qu'on ne sort
   * pas de la boîte ; sans un seul élément focalisable, la tabulation en sortait.
   * C'est le défaut que cet écran a révélé dans `Modal`, et ce test le retient.
   */
  test('?feuille=merci — la confirmation retient la tabulation bien qu’elle n’ait aucun contrôle', async ({
    page,
  }) => {
    await visiter(page, '/messages/1?feuille=merci', 390);
    const boite = page.getByRole('dialog', { name: 'Merci.' });
    await expect(boite).toBeVisible();
    await expect(boite.getByText('Nous regardons sous 24 heures.')).toBeVisible();
    // Aucun contrôle : c'est le manque de la maquette, figé pour qu'il se voie.
    await expect(boite.locator('button, a[href], input, select, textarea')).toHaveCount(0);

    for (let i = 0; i < 4; i += 1) await page.keyboard.press('Tab');
    const dedans = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      return d !== null && d.contains(document.activeElement);
    });
    expect(dedans, 'le focus est resté dans la boîte de dialogue').toBe(true);
  });

  test('une feuille inconnue n’ouvre rien', async ({ page }) => {
    await visiter(page, '/messages/1?feuille=nimporte-quoi', 1440);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

/**
 * ── CIBLES TACTILES — LA LISTE DES ÉCARTS EST FIGÉE, PAS LE SEUIL ────────────
 *
 * `T1` §2.3 demande 44 px au doigt. Les quatre PAGES de ce lot n'ont aucun écart,
 * pour une raison qu'il vaut mieux dire que taire : la maquette y dessine TOUS ses
 * contrôles en `<span>` et en `<div>`, donc l'écran n'a presque aucun élément
 * interactif à mesurer. Le test le fige quand même — le jour où un lot branchera ces
 * écrans sur l'API, les boutons apparaîtront, et c'est ce jour-là qu'il faudra
 * regarder leur taille.
 *
 * La feuille de signalement, elle, a DEUX écarts, et ils sont nommés avec leur
 * mesure — même discipline que `check-contrast.mjs`, qui liste ses paires sous le
 * seuil AA plutôt que d'abaisser le seuil.
 */
const ECARTS_TACTILES: Readonly<Record<string, readonly string[]>> = {
  '/messages': [],
  '/messages/1': [],
  '/recherche': [],
  '/notifications': [],
  '/notifications?vue=panneau': [],
  /**
   * · la POIGNÉE de la feuille : 40 × 5 px dessinés, portés à 88 × 25 par le
   *   transcodeur (remplissage en `content-box`, peinture bornée au contenu). Elle
   *   n'atteint toujours pas 44 px de haut — l'agrandir davantage décollerait la
   *   feuille de son bord, donc la mesure reste nommée ici ;
   * · la CROIX : 40 × 40 px, c'est ce que la maquette dessine. La porter à 44
   *   déplacerait des pixels, ce que le transcodage refuse.
   *
   * Les deux tiennent WCAG 2.5.8 AA (24 px), pas la règle du dossier. Au porteur de
   * trancher — voir `docs/decisions.md`.
   */
  '/messages/1?feuille=signaler': ['button « Fermer » 88×25 px', 'button « Fermer » 40×40 px'],
};

test.describe('cible tactile — les écarts connus, et AUCUN autre', () => {
  for (const url of Object.keys(ECARTS_TACTILES)) {
    test(`${url} à 390 px`, async ({ page }) => {
      await visiter(page, url, 390);
      // La feuille s'ouvre à l'hydratation : on l'attend avant de mesurer.
      if (url.includes('feuille=')) await expect(page.getByRole('dialog')).toBeVisible();

      const trop = await page.evaluate(() => {
        /** Exception WCAG 2.5.8 : « une cible dans une phrase ou un bloc de texte ». */
        const estLienTexte = (el: HTMLElement, s: CSSStyleDeclaration): boolean => {
          if (el.tagName !== 'A') return false;
          const transparent =
            s.backgroundColor === 'rgba(0, 0, 0, 0)' || s.backgroundColor === 'transparent';
          const sansBordure =
            parseFloat(s.borderTopWidth) === 0 && parseFloat(s.borderLeftWidth) === 0;
          const lignes = el.getClientRects();
          const hauteur =
            lignes.length > 0 ? (lignes[0] as DOMRect).height : el.getBoundingClientRect().height;
          return transparent && sansBordure && hauteur <= parseFloat(s.fontSize) * 1.8;
        };
        const out: string[] = [];
        for (const el of Array.from(
          document.querySelectorAll<HTMLElement>('button, a[href], [role="switch"], [role="tab"]'),
        )) {
          const s = getComputedStyle(el);
          if (s.display === 'none' || s.visibility === 'hidden') continue;
          if (estLienTexte(el, s)) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          if (r.height < 43.5 || r.width < 43.5) {
            const nom = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30);
            out.push(
              `${el.tagName.toLowerCase()} « ${nom} » ${Math.round(r.width)}×${Math.round(r.height)} px`,
            );
          }
        }
        return out;
      });

      expect(trop, `écarts mesurés sur ${url}`).toEqual([...(ECARTS_TACTILES[url] ?? [])]);
    });
  }
});

/**
 * ── AUCUN DÉBORDEMENT HORIZONTAL, À AUCUNE LARGEUR ───────────────────────────
 *
 * C'est le symptôme n°1 d'une interface non responsive, et celui que les adaptations
 * de cadre du générateur risquent le plus d'introduire — colonnes collantes, bandes à
 * défilement horizontal, bornes de hauteur retirées. Une image de 1440 px de large ne
 * déborde jamais : seule la fenêtre peut le dire.
 */
const LARGEURS = [320, 360, 390, 430, 768, 1023, 1024, 1279, 1440, 1920] as const;

/**
 * TROIS CHARPENTES, et non quatre routes : `/messages` et `/messages/:id` partagent
 * le même cadre d'ordinateur, et c'est lui qui porte les colonnes collantes.
 */
const MESURES = ['/messages/1', '/recherche', '/notifications'] as const;

test.describe('aucun débordement horizontal', () => {
  for (const w of LARGEURS) {
    test(`${w} px — les trois charpentes`, async ({ page }) => {
      for (const url of MESURES) {
        await visiter(page, url, w);
        const mesure = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          inner: window.innerWidth,
        }));
        expect(
          mesure.scroll,
          `${url} à ${w} px : ${mesure.scroll} px pour ${mesure.inner} px de fenêtre`,
        ).toBeLessThanOrEqual(mesure.inner + 1);

        const coupes = await page.evaluate(() => {
          const defileH = (el: HTMLElement): boolean => {
            let n: HTMLElement | null = el.parentElement;
            while (n !== null && n !== document.body) {
              const ox = getComputedStyle(n).overflowX;
              if (ox === 'auto' || ox === 'scroll') return true;
              n = n.parentElement;
            }
            return false;
          };
          const out: string[] = [];
          for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
            const s = getComputedStyle(el);
            if (s.display === 'none' || s.visibility === 'hidden') continue;
            if (s.position === 'fixed' || s.position === 'sticky') continue;
            const r = el.getBoundingClientRect();
            if (r.width === 0 || defileH(el)) continue;
            if (r.right > window.innerWidth + 1) {
              out.push(
                `${el.tagName.toLowerCase()} dépasse de ${Math.round(r.right - window.innerWidth)} px`,
              );
            }
          }
          return out.slice(0, 5);
        });
        expect(coupes, `${url} à ${w} px`).toEqual([]);
      }
    });
  }
});
