import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { motsVisibles } from './mots-visibles';

/**
 * Les règles dures, mesurées sur l'écran rendu.
 *
 * Le balisage est TRANSCODÉ de `docs/template/03 Accueil v2.dc.html` : styles en
 * ligne, pas de classes. Les assertions portent donc sur des valeurs CALCULÉES —
 * couleurs, dimensions, texte — et jamais sur un sélecteur de classe, qui se
 * casserait à la première régénération.
 *
 * La responsivité et les cibles tactiles vivent dans responsive.spec.ts, qui les
 * vérifie largeur par largeur, au seuil qui convient à chacune.
 */

const TOKENS = {
  bg: 'rgb(246, 248, 247)', // #F6F8F7
  primaryStrong: 'rgb(15, 92, 72)', // #0F5C48
  journey: 'rgb(224, 115, 58)', // #E0733A
} as const;

async function computed(page: Page, selector: string, prop: string): Promise<string> {
  return page
    .locator(selector)
    .first()
    .evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
}

/**
 * LE FIL EST BRANCHÉ SUR L'API : ses trois lectures sont SERVIES DEPUIS DES
 * CHARGES RÉELLES.
 *
 * Avant le lot 3, cet écran dessinait cinq publications d'exemple codées en dur, et
 * ces tests s'appuyaient dessus — « repas partagé pour les nouveaux » servait à la
 * fois de preuve que le fil existe et de matière à faire défiler la page. Ces deux
 * usages ont disparu avec les données de maquette, et c'est voulu : elles étaient
 * servies dans le HTML comme si elles étaient réelles.
 *
 * On les remplace par des INTERCEPTIONS, comme `e2e/inscription.spec.ts` le fait
 * déjà. Les charges viennent de `packages/shared/src/__tests__/fixtures/`, relevées
 * octet pour octet sur une API qui tournait — donc ce que le navigateur reçoit ici
 * a exactement la forme que le serveur produit, y compris ses pièges (`meta`
 * différent d'une route à l'autre, `greetingHint` absent, `nextCursor` nul).
 *
 * Pourquoi intercepter plutôt que lancer une vraie session : ces tests gardent le
 * CADRE — les colonnes collantes, les largeurs, les jetons de couleur — et non le
 * réseau. Les faire dépendre d'une base et d'un compte les rendrait lents et
 * instables pour une question qu'ils ne posent pas. Le branchement lui-même est
 * éprouvé ailleurs : `src/screens/accueil/from-api.test.ts` sur ces mêmes charges,
 * et `packages/shared` sur le contrat de réponse.
 */
/**
 * L'ancre d'attente : un extrait de la PREMIÈRE publication de la charge réelle.
 * Recopié d'elle, donc il change avec elle — et s'il ne s'affichait plus, c'est le
 * branchement qui serait cassé, ce que ces tests doivent voir.
 */
const PREMIERE_PUBLICATION = 'Comment vous organisez-vous pour envoyer de l’argent au pays';

// `__dirname` et non `import.meta.dirname` : Playwright transpile ces fichiers en
// CommonJS, où `import.meta` n'existe pas — l'échec dit « No tests found », ce qui
// ne désigne pas la cause.
const FIXTURES = resolve(__dirname, '../../../packages/shared/src/__tests__/fixtures');
const charge = (nom: string): string => readFileSync(resolve(FIXTURES, `${nom}.json`), 'utf8');

test.beforeEach(async ({ page }) => {
  // Le socle tente une reprise de session au chargement : sans réponse, il
  // renoncerait, et les trois lectures ne partiraient jamais.
  await page.route('**/v1/auth/refresh', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ accessToken: 'jeton-de-test', isNewUser: false }),
    }),
  );

  const json = (body: string) => ({ status: 200, contentType: 'application/json', body });
  // L'ordre compte : `**/v1/feed/sidebar` AVANT `**/v1/feed*`, sinon le second
  // intercepte le premier et la colonne droite reçoit la charge du fil.
  await page.route('**/v1/feed/sidebar', (route) => route.fulfill(json(charge('feed_sidebar'))));
  await page.route('**/v1/feed*', (route) => route.fulfill(json(charge('feed'))));
  await page.route('**/v1/stories*', (route) => route.fulfill(json(charge('stories_band'))));

  /**
   * `waitUntil: 'load'` et NON `'networkidle'`.
   *
   * Le fil émet désormais trois requêtes, et Next précharge en plus les liens
   * visibles d'une page App Router : le réseau ne retombe pas au calme, et
   * `networkidle` expire au bout de trente secondes sur un message qui ne nomme pas
   * la cause. On attend `load`, puis la première publication — ce qui est la vraie
   * condition à attendre.
   */
  await page.goto('/accueil', { waitUntil: 'load' });
  await page.getByText(PREMIERE_PUBLICATION).first().waitFor({ state: 'attached' });
});

test.describe('jetons de design', () => {
  test('le fond de page est celui de la maquette', async ({ page }) => {
    expect(await computed(page, '[data-screen="A01"]', 'background-color')).toBe(TOKENS.bg);
  });

  test('la police est Plus Jakarta Sans', async ({ page }) => {
    expect(await computed(page, 'body', 'font-family')).toContain('Jakarta');
  });

  // RÈGLE DURE §1.2 — aucun rouge dans l'interface.
  test('aucun élément de la page n’est rouge', async ({ page }) => {
    const reds = await page.evaluate(() => {
      const isRed = (value: string): boolean => {
        const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(value);
        if (m === null) return false;
        const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
        if ((m[4] === undefined ? 1 : Number(m[4])) < 0.05) return false;

        // Teinte en HSL : le rouge est vers 0°, le terre cuite vers 23°.
        const rr = r / 255;
        const gg = g / 255;
        const bb = b / 255;
        const max = Math.max(rr, gg, bb);
        const d = max - Math.min(rr, gg, bb);
        if (d < 0.1) return false;
        let h =
          max === rr ? ((gg - bb) / d) % 6 : max === gg ? (bb - rr) / d + 2 : (rr - gg) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
        return h >= 345 || h <= 15;
      };

      const found: string[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
        const s = getComputedStyle(el);
        for (const prop of ['color', 'background-color', 'border-top-color', 'fill'] as const) {
          if (isRed(s.getPropertyValue(prop))) found.push(`${el.tagName.toLowerCase()} ${prop}`);
        }
      }
      return [...new Set(found)];
    });
    expect(reds).toEqual([]);
  });

  /**
   * RÈGLE DURE T1 §2.3 — jamais d'ombre portée.
   * L'anneau de focus est implémenté en box-shadow par Tailwind ; c'est lui que
   * T1 §6 exige, il ne compte pas comme ombre.
   */
  test('aucune ombre portée, hors anneau de focus', async ({ page }) => {
    const shadows = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('*'))
        .map((el) => getComputedStyle(el).boxShadow)
        .filter((s) => s !== 'none' && !s.includes('inset 0 0 0 0') && !/0 0 #0000/.test(s)),
    );
    expect(shadows).toEqual([]);
  });
});

test.describe('cadre ordinateur', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'cadre ordinateur uniquement');

  test('le rail fait 76 px, en carte arrondie 22 px sur vert fort', async ({ page }) => {
    const rail = page.locator('nav').first();
    expect((await rail.boundingBox())?.width).toBe(76);
    expect(await rail.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
      TOKENS.primaryStrong,
    );
    expect(await rail.evaluate((el) => getComputedStyle(el).borderRadius)).toBe('22px');
  });

  // RÈGLE DURE §10.1 et T1 §3.1 — jamais une barre d'icônes horizontale en haut.
  test('la navigation principale est verticale, pas une barre horizontale', async ({ page }) => {
    const box = await page.locator('nav').first().boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThan(box!.width * 3);
    expect(box!.x, 'elle commence au bord gauche').toBeLessThan(60);
  });

  test('la colonne de gauche porte 352 px de contenu dans 400 px', async ({ page }) => {
    // On remonte depuis le rail : le balisage de la maquette n'offre pas de
    // classe à viser, mais sa structure est stable.
    const panel = page.locator('nav').locator('xpath=../..').first();
    expect((await panel.boundingBox())?.width).toBe(400);

    const inner = await panel.evaluate((el) => {
      const s = getComputedStyle(el);
      return el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
    });
    expect(inner).toBe(352);
  });

  test('le contenu ne dépasse pas 660 px et la colonne de contexte fait 300 px', async ({
    page,
  }) => {
    // Scopé au cadre ORDINATEUR : le cadre mobile porte aussi un `main`.
    expect(
      (await page.locator('[data-frame="desktop"] main').boundingBox())!.width,
    ).toBeLessThanOrEqual(660);
    expect((await page.locator('[data-frame="desktop"] aside').boundingBox())!.width).toBe(300);
  });

  /**
   * Les deux colonnes restent à l'écran pendant que le fil défile.
   *
   * La maquette ne l'exprime pas — c'est une image, rien n'y défile. C'est donc
   * une adaptation, faite dans le générateur et non à la main, pour qu'elle
   * survive à la prochaine régénération. Ce test la tient.
   */
  test('la barre haute et les deux colonnes restent à l’écran au défilement', async ({ page }) => {
    /**
     * ON DÉFILE JUSQU'EN BAS, et non de 1 200 px fixes.
     *
     * Le chiffre de 1 200 px avait été calibré sur les cinq publications d'exemple
     * que la maquette dessinait en dur, dont deux portaient une photo de 260 px. Le
     * fil venant maintenant de l'API, sa hauteur suit la charge : avec quatre
     * publications sans photo, la page ne peut défiler que de 431 px, et
     * l'assertion `> 800` échouait sur une page dont les colonnes étaient
     * parfaitement collantes. Le test mesurait la hauteur du contenu en croyant
     * mesurer le collage.
     *
     * On défile donc AUTANT QUE LA PAGE LE PERMET, puis on exige deux choses
     * distinctes : qu'il y ait bien eu un défilement RÉEL — sans quoi le reste ne
     * prouverait rien, une page qui ne bouge pas gardant trivialement ses colonnes
     * en place — et que les trois repères n'aient pas bougé d'un pixel.
     */
    const defilement = await page.evaluate(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, max);
      return max;
    });
    await page.waitForTimeout(250);

    expect(
      defilement,
      'la page doit pouvoir défiler, sinon le collage n’est pas éprouvé',
    ).toBeGreaterThan(200);

    const positions = await page.evaluate(() => {
      const frame = document.querySelector('[data-frame="desktop"]')!;
      const top = (el: Element | null) =>
        el === null ? null : Math.round(el.getBoundingClientRect().top);

      const bar = Array.from(frame.querySelectorAll('div')).find(
        (d) => getComputedStyle(d).position === 'sticky' && d.offsetHeight === 64,
      );
      const rail = frame.querySelector('nav');
      const panel = rail?.parentElement?.parentElement ?? null;

      return {
        barreHaute: top(bar ?? null),
        colonneGauche: top(panel),
        colonneDroite: top(frame.querySelector('aside')),
        defile: Math.round(window.scrollY),
      };
    });

    expect(positions.defile, 'la page doit avoir réellement défilé').toBeGreaterThan(200);

    // Sans `sticky`, les trois seraient remontées hors de l'écran, de tout le
    // défilement : leur `top` vaudrait un nombre négatif, pas 0 ni 76.
    expect(positions.barreHaute, 'la barre haute a suivi le défilement').toBe(0);
    expect(positions.colonneGauche, 'la colonne de gauche a suivi').toBe(0);
    // La colonne de contexte s'arrête SOUS la barre haute, pas dessous elle.
    expect(positions.colonneDroite, 'la colonne de contexte a suivi').toBe(76);
  });

  /**
   * Une barre collante sans fond laisse voir le contenu défiler au travers.
   * La maquette n'en a pas besoin — rien n'y défile — donc l'oubli est facile.
   */
  test('la barre haute collante porte un fond opaque', async ({ page }) => {
    const bg = await page.evaluate(() => {
      const frame = document.querySelector('[data-frame="desktop"]')!;
      const bar = Array.from(frame.querySelectorAll('div')).find(
        (d) => getComputedStyle(d).position === 'sticky' && d.offsetHeight === 64,
      );
      return bar === undefined ? null : getComputedStyle(bar).backgroundColor;
    });
    expect(bg).toBe(TOKENS.bg);
  });

  /**
   * La maquette est dessinée à 1440 px. Au-delà, on centre plutôt que d'étirer :
   * le contenu est déjà borné à 660 px, et l'étirement ne ferait qu'éloigner
   * les colonnes l'une de l'autre.
   */
  test('au-delà de 1440 px, la mise en page est centrée', async ({ page }) => {
    await page.setViewportSize({ width: 1800, height: 900 });
    await page.goto('/accueil', { waitUntil: 'networkidle' });

    const frame = (await page.locator('[data-frame="desktop"]').boundingBox())!;
    expect(frame.width).toBe(1440);
    // Marges égales de part et d'autre, à un pixel près.
    expect(Math.abs(frame.x - (1800 - frame.width - frame.x))).toBeLessThanOrEqual(1);
  });

  /**
   * La barre de progression de parcours est le seul aplat terre cuite du fil
   * (T1 §2.1). La maquette la dessine en div, sans rôle ARIA : on vérifie donc
   * la couleur. L'absence de sémantique est un constat à part, consigné dans
   * docs/decisions.md.
   */
  test('la carte parcours porte sa barre de progression terre cuite', async ({ page }) => {
    const found = await page.evaluate((journey) => {
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('div'))) {
        const r = el.getBoundingClientRect();
        if (getComputedStyle(el).backgroundColor === journey && r.height > 0 && r.height <= 10) {
          return true;
        }
      }
      return false;
    }, TOKENS.journey);
    expect(found, 'aucune barre terre cuite trouvée').toBe(true);
  });
});

/**
 * Les DEUX cadres sont dans le DOM, l'un masqué par CSS — Next rend côté
 * serveur et ne connaît pas la largeur. Les assertions mobiles se limitent donc
 * au cadre visible, faute de quoi elles trouveraient l'autre.
 */
test.describe('cadre mobile', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 1024, 'cadre mobile uniquement');

  const frame = (page: Page) => page.locator('[data-frame="mobile"]');

  test('le rail d’ordinateur est absent', async ({ page }) => {
    await expect(page.locator('[data-frame="desktop"]')).toBeHidden();
    await expect(frame(page).locator('nav')).toHaveCount(0);
  });

  test('la barre d’onglets basse porte cinq entrées, Compte à la place d’Agenda', async ({
    page,
  }) => {
    for (const label of ['Accueil', 'Parcours', 'Entraide', 'Services', 'Compte']) {
      await expect(frame(page).getByText(label, { exact: true }).last()).toBeVisible();
    }
    // §10.1 : Agenda cède sa place à Compte et reste atteignable depuis Accueil.
    await expect(frame(page).getByText('Agenda', { exact: true })).toHaveCount(0);
  });

  test('la page défile, et la barre d’onglets reste visible', async ({ page }) => {
    const scrollable = await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight,
    );
    expect(scrollable, 'le contenu doit défiler — la maquette le fige à 844 px').toBe(true);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(frame(page).getByText('Compte', { exact: true }).last()).toBeInViewport();
  });

  /**
   * Le cadre mobile de la maquette n'a PAS de colonne de contexte : c'est un
   * design distinct, pas un repli du design ordinateur.
   */
  test('pas de colonne de contexte, mais le fil est bien là', async ({ page }) => {
    await expect(frame(page).locator('aside')).toHaveCount(0);
    await expect(frame(page).getByText(PREMIERE_PUBLICATION).first()).toBeVisible();
  });
});

test.describe('règles dures visibles à l’écran', () => {
  /**
   * RÈGLE DURE §1.2 — le mot « certifié » n'apparaît pas dans l'interface.
   *
   * Portée exacte (05-guides.md §2) : « rejetés dans le titre et dans les
   * libellés d'interface (pas dans le corps, qui peut citer un document
   * officiel) ». Un membre doit pouvoir écrire « le certificat Visale ».
   */
  test('aucun libellé d’interface n’emploie « certifié »', async ({ page }) => {
    const offenders = await page.evaluate(() => {
      const selector = 'button, a[href], h1, h2, h3, label, [role="tab"]';
      const out: string[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
        if (/certifi(?!cats?\b)/i.test(el.innerText)) {
          out.push(`${el.tagName.toLowerCase()} « ${el.innerText.trim().slice(0, 40)} »`);
        }
      }
      return out;
    });
    expect(offenders).toEqual([]);
  });

  // RÈGLE DURE §1.2 — aucun compteur de vues, sur aucun contenu, pour personne.
  test('aucun compteur de vues n’est affiché', async ({ page }) => {
    const text = (await page.locator('body').innerText()).toLowerCase();
    expect(text).not.toMatch(/\bvues?\b|\bvisualisations?\b/);
  });

  // T1 §2.4 — aucun emoji dans l'interface. Le contenu d'un membre peut en avoir.
  test('aucun emoji dans l’interface', async ({ page }) => {
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  /**
   * RÈGLE DURE (04 §2) : le titre personnel d'un parcours n'est jamais exposé
   * dans le fil ; seul le nom du type l'est.
   *
   * « Mes études à Lyon » vit dans la carte du panneau. Il ne doit apparaître
   * dans AUCUNE publication — leurs lignes de contexte disent « Parcours Études ».
   */
  test('le titre personnel du parcours n’apparaît pas dans le fil', async ({ page }) => {
    const leaked = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('article')).some((el) =>
        el.innerText.includes('Mes études à Lyon'),
      ),
    );
    expect(leaked, 'le titre personnel a fuité dans une publication').toBe(false);
  });
});

/**
 * LE FIL EST SERVI AVEC DES MOTS, ET PAS SEULEMENT AVEC DU SCRIPT.
 *
 * ── POURQUOI CE TEST EXISTE ─────────────────────────────────────────────────
 *
 * Ce dépôt a déjà servi CINQ pages vides sans que personne le voie : un
 * `useSearchParams()` dans un composant client fait renoncer Next au pré-rendu de
 * tout ce qu'il enveloppe, et la réponse du serveur ne contient alors plus un mot —
 * seulement le script qui les fabriquera plus tard. `/villes` faisait 8 Ko de
 * script et zéro mot.
 *
 * Le défaut est INVISIBLE au navigateur : la page s'affiche parfaitement, puisque
 * le script tourne. Il ne se voit que dans la réponse brute — d'où `request` et non
 * `page` ici. Aucun JavaScript n'est exécuté : on lit ce que le serveur a envoyé,
 * exactement comme le feraient un moteur d'indexation, un aperçu de lien, ou un
 * téléphone sur réseau lent avant que le script n'arrive.
 *
 * Le fil est la page la plus visitée du produit ; c'est celle qui peut le moins se
 * permettre d'être vide.
 *
 * ── CE BLOC NE GARDAIT QU'UNE ROUTE, ET C'ÉTAIT UN TROU ─────────────────────
 *
 * Il ne visitait que `/accueil` — précisément la seule route du produit qui le
 * faisait bien. Un test qui garde le seul cas qui marche est la famille de défauts
 * la plus coûteuse de ce dépôt : pendant qu'il était vert, CINQ des dix routes du
 * domaine d'équipe servaient deux mots et zéro entrée de rail.
 *
 * La règle est posée pour tout le domaine d'équipe dans
 * `e2e/squelette-equipe.spec.ts`, avec la même mesure et le même détecteur. Elle
 * n'est pas recopiée ici : ce fichier a un `beforeEach` qui charge `/accueil` et
 * ses trois interceptions, dont une page d'équipe n'a que faire. Le domaine MEMBRE,
 * lui, est gardé par `e2e/squelette-membre.spec.ts`.
 *
 * ── CE QUE CE TEST NE PRÉTEND PAS GARDER ────────────────────────────────────
 *
 * Il garde la COQUILLE, pas le contenu du fil. Les publications ne peuvent pas être
 * pré-rendues aujourd'hui, et ce n'est pas un oubli : le jeton d'accès vit en
 * mémoire du navigateur (`lib/api/session.ts`), et 04 §2.3 refuse toute lecture
 * anonyme du fil parce que la visibilité y est relative au LECTEUR — le serveur de
 * rendu n'a donc pas de lecteur à qui appliquer les règles. C'est remonté au lot
 * comme une décision à prendre côté API, pas contourné ici.
 */
test.describe('rendu serveur', () => {
  /** Ce que la coquille de l'accueil doit contenir, mot pour mot. */
  const MOTS_DE_LA_COQUILLE = [
    'STORIES DU JOUR',
    'VOS RACCOURCIS',
    /**
     * « Partager un jalon » ET PLUS « Créer une story ».
     *
     * Le porteur : « change la section de stories comme sur la page ci »
     * (`Fil d'actualité v2`). La tuile ronde « Créer une story » est devenue la
     * carte d'appel « Partager un jalon », et c'est le mot que la nouvelle
     * planche écrit. Ce que ce cas tient n'a pas bougé : le HTML servi porte des
     * MOTS, pas seulement du script.
     */
    'Partager un jalon',
    'COMMUNAUTÉ',
  ] as const;

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ « RECHERCHER DANS LA DIASPORA » A CHANGÉ DE NATURE, PAS DE PRÉSENCE      ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Il figurait dans la liste ci-dessus parce que la maquette l'écrivait en TEXTE,
   * dans un `<div>` qui ne faisait rien. Il est désormais l'INVITE d'un vrai champ
   * de recherche — le porteur : « la top bar n'est pas du tout fonctionnelle » —
   * et une invite vit dans un attribut, pas dans un nœud de texte.
   *
   * Le détecteur de mots visibles ne lit que les textes : il ne le voit donc plus,
   * et c'est juste. On vérifie sa présence là où elle est maintenant — ce qui
   * prouve en outre que le champ est SERVI PAR LE SERVEUR, et non monté après
   * hydratation, ce que ce fichier éprouve de bout en bout.
   */
  const INVITE_DE_RECHERCHE = 'placeholder="Rechercher dans la diaspora"';

  /**
   * Le détecteur a DÉMÉNAGÉ dans `e2e/mots-visibles.ts`, et ce n'est pas du
   * rangement : `coquille-vide.spec.ts` l'emploie aussi, sur toutes les routes du
   * produit. Deux copies d'un détecteur, c'est deux calibrages qui divergent, et
   * la divergence se lirait comme un changement du produit.
   */

  test('le HTML de /accueil porte des mots, pas seulement du script', async ({ request }) => {
    const res = await request.get('/accueil');
    expect(res.status()).toBe(200);
    const { texte, nombre } = motsVisibles(await res.text());

    /**
     * Le seuil est BAS exprès. Il ne décrit pas une richesse attendue : il sépare
     * « une page servie » de « une page vide ». Une page vidée par un renoncement
     * au pré-rendu tombe à ZÉRO, pas à quatre-vingts — mesuré à 130 mots sur cette
     * route, et à 0 sur les cinq pages qui portaient le défaut.
     */
    expect(nombre, `la page ne porte que ${nombre} mot(s) hors script`).toBeGreaterThan(80);

    // Et ce sont les BONS mots : un compte élevé rempli d'autre chose ne dirait rien.
    for (const mot of MOTS_DE_LA_COQUILLE) {
      expect(texte, `« ${mot} » manque au HTML servi`).toContain(mot);
    }

    // Le champ de recherche, servi par le serveur — voir `INVITE_DE_RECHERCHE`.
    expect(await res.text(), 'le champ de recherche n’est pas dans le HTML servi').toContain(
      INVITE_DE_RECHERCHE,
    );
  });

  /**
   * NON-VACUITÉ DU DÉTECTEUR.
   *
   * Un détecteur qui cherche des mots et n'en trouve jamais ne dit rien tant qu'on
   * n'a pas montré qu'il SAIT en trouver — et, surtout, qu'il sait ne PAS en
   * trouver. On lui donne donc les trois cas qu'il doit distinguer, dont celui qui
   * l'a motivé : beaucoup de script, aucun mot.
   */
  test('le détecteur distingue vraiment une page pleine d’une page vide', () => {
    const vide = '<html><body><div id="__next"></div><script>var a=1;</script></body></html>';
    expect(motsVisibles(vide).nombre).toBe(0);

    const pleine = '<html><body><h1>Fil d’actualité</h1><script>var b=2;</script></body></html>';
    expect(motsVisibles(pleine).nombre).toBeGreaterThan(0);
    expect(motsVisibles(pleine).texte).toContain('Fil');

    // Le script ne compte JAMAIS, même bavard — c'est tout le défaut d'origine.
    const bavard = `<html><body><script>${'var motmotmot = 1;'.repeat(400)}</script></body></html>`;
    expect(motsVisibles(bavard).nombre).toBe(0);
  });

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LE TROU DE COUVERTURE QUE CE BLOC AVAIT, ET QUI A LAISSÉ VIVRE LE DÉFAUT  ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Ce bloc ne visitait QU'UNE SEULE ROUTE : `/accueil` — précisément la seule du
   * produit qui rende son cadre tout de suite. Les quatre autres entrées du rail
   * servaient une COQUILLE, et personne ne les avait regardées. C'est la famille de
   * défauts la plus coûteuse de ce dépôt : un test qui garde le seul cas qui marche.
   *
   * Relevé au HTML servi, avant correction :
   *
   *     /accueil            200  rail servi
   *     /parcours           200  rail : AUCUN — « DisaporyPlus · Chargement… »
   *     /entraide           200  rail : AUCUN
   *     /services/logement  200  rail : AUCUN
   *     /agenda             200  rail : AUCUN
   *
   * ── CE QUE CES TESTS AFFIRMENT, ET POURQUOI PAS UN COMPTE ──────────────────
   *
   * Deux choses, et aucune n'est un seuil qui redeviendra faux :
   *
   *   1. LES CINQ DESTINATIONS DU RAIL SONT DANS LE HTML SERVI. C'est la propriété
   *      qui compte — sur un téléphone comme sur un écran, c'est la seule sortie de
   *      la page — et elle ne dépend d'aucune donnée ;
   *   2. UN REPÈRE QUE LA MAQUETTE DESSINE SANS DONNÉE est présent : l'étiquette du
   *      panneau de section. Elle est écrite en clair dans la maquette, donc elle
   *      est là que l'API réponde ou non. Un compte de mots élevé rempli d'autre
   *      chose ne dirait rien ; cette étiquette-là dit que le CADRE est rendu.
   *
   * ── MESURÉ SANS EXÉCUTER LE JAVASCRIPT ────────────────────────────────────
   *
   * `request.get` lit le HTML servi, sans navigateur et sans script — c'est
   * exactement la bonne mesure pour cette règle, et celle que les deux tests
   * au-dessus emploient déjà. Une mesure au navigateur passerait même sur une
   * coquille, puisque le client finit par rendre le cadre.
   *
   * ── UN CADRE SANS DONNÉE ET UN LIEN QUI NE MÈNE NULLE PART SONT DEUX DÉFAUTS ─
   *
   * Ces tests gardent le PREMIER. Le second — « le lien clique et l'URL change » —
   * est gardé par `e2e/sous-liens.spec.ts`, au navigateur. Les confondre coûte une
   * heure : ici la page répond 200, le `<a href>` existe bel et bien dans le cadre
   * généré, et c'est le cadre qui n'était pas rendu.
   */
  const RAIL_SERVI = [
    '/accueil',
    '/parcours',
    '/entraide',
    '/services/logement',
    '/agenda',
  ] as const;

  /**
   * ── LES VINGT-DEUX ROUTES, ET LE REPÈRE QUE CHACUNE DOIT SERVIR ───────────
   *
   * Le repère est une étiquette que LA MAQUETTE écrit EN CLAIR : elle est dans le
   * HTML que l'API réponde ou non, donc elle dit « le cadre est rendu » et rien
   * d'autre. Un compte de mots élevé rempli d'autre chose ne dirait rien.
   *
   * `/accueil`, `/guides`, `/reseaux` et `/villes` n'y sont pas : ces écrans
   * rendaient déjà leur cadre, et `/accueil` a son propre cas plus haut. Ce qui
   * est listé ici est l'ensemble de ce qui servait une COQUILLE — dix-huit routes
   * mesurées à quatre ou cinq mots.
   */
  const ROUTES_SERVIES = [
    // ── Parcours, Entraide, Services, Agenda — le périmètre de ce lot ──
    ['/parcours', 'MON PARCOURS'],
    ['/entraide', 'MA RÉPUTATION'],
    ['/entraide/aider', 'VOUS POUVEZ AIDER'],
    ['/entraide/mes-demandes', 'MA RÉPUTATION'],
    ['/entraide/mes-reponses', 'MA RÉPUTATION'],
    ['/entraide/nouveau', 'MA RÉPUTATION'],
    ['/parrainage', 'DEVENIR PARRAIN'],
    ['/parrainage/mes-parrainages', 'PARRAINAGE'],
    ['/parrainage/devenir', 'GUIDE DU PARRAIN'],
    ['/services/logement', 'MES QUOTAS DU MOIS'],
    ['/services/emploi', 'PROFILS DISPONIBLES'],
    ['/services/annuaire', 'MON ESPACE'],
    ['/services/annuaire/ma-fiche', 'MES QUOTAS DU MOIS'],
    ['/services/mes-annonces', 'MON ESPACE'],
    ['/services/alertes', 'NOUVELLE ALERTE'],
    ['/agenda', 'CALENDRIER'],
    /**
     * ── ET LES SIX ROUTES QUI NE SONT PAS DE CE PÉRIMÈTRE ───────────────────
     *
     * Elles partagent la coquille de chargement corrigée
     * (`screens/compte/ecran-donnees.tsx`), donc la même correction les répare.
     * Les laisser hors du test aurait rendu la correction réversible sans que
     * rien ne le dise — et c'est du code écrit à la main, pas une déclaration
     * d'écran : elle n'entre en conflit avec le lot de personne.
     *
     * `/premium` m'avait été donné comme L'EXCEPTION, la route qui servirait cinq
     * mots SANS passer par cette coquille. C'est faux : `premium/page.tsx` rend
     * `AbonnementEcran`, qui appelle `EcranDonnees`. Ce sont les dix sur dix.
     */
    ['/messages', 'DEMANDES'],
    /**
     * `Résultats pour` et non plus `Rechercher dans la diaspora` : cette dernière
     * était l'INVITE du champ, et une invite vit dans un attribut depuis que la
     * barre haute est branchée. Le détecteur ne lit que les nœuds de texte, et
     * c'est juste — on prend donc un repère qui appartient VRAIMENT à cette page,
     * ce que l'invite d'une barre présente partout n'était pas.
     */
    ['/recherche', 'Résultats pour'],
    ['/notifications', 'Tout marquer lu'],
    ['/premium', 'MON COMPTE'],
    ['/compte/profil', 'TEL QUE LES AUTRES VOUS VOIENT'],
  ] as const;

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ D'OÙ VIENT CE PLANCHER, ET POURQUOI IL EST BAS                           ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * DEUX PÔLES MESURÉS avec `motsVisibles` — celui-là même, pas un autre
   * détecteur :
   *
   *   ·  4 mots : une coquille vide. `/recherche` servait « DisaporyPlus
   *      Recherche en cours… » et RIEN d'autre, rail compris ;
   *   · 41 mots : le cadre le plus pauvre une fois rendu — `/messages`, dont le
   *      squelette n'a ni conversation ni message. `/agenda` en sert 49, les dix-
   *      neuf autres de 55 à 278.
   *
   * DIX sépare les deux, et il est volontairement près du pôle cassé : un
   * plancher haut RECALE DES PAGES SAINES, et trois bornes de ce dépôt sont déjà
   * devenues fausses par accumulation. Les deux chiffres sont écrits ici pour que
   * le prochain sache d'où vient la borne au lieu de la relever au hasard.
   *
   * CE PLANCHER NE DÉCRIT PAS UNE RICHESSE ATTENDUE. Ce qui décrit le contenu,
   * c'est le repère de la maquette, juste au-dessus.
   */
  const PLANCHER_DE_MOTS = 10;

  for (const [route, repere] of ROUTES_SERVIES) {
    test(`le HTML de ${route} sert le rail et le cadre, pas une coquille`, async ({ request }) => {
      const res = await request.get(route);
      expect(res.status()).toBe(200);
      const html = await res.text();

      for (const destination of RAIL_SERVI) {
        expect(html, `« href="${destination}" » manque au HTML servi de ${route}`).toContain(
          `href="${destination}"`,
        );
      }

      const { texte, nombre } = motsVisibles(html);
      expect(texte, `« ${repere} » manque : le cadre n’est pas rendu`).toContain(repere);
      expect(nombre, `${route} ne porte que ${nombre} mot(s) hors script`).toBeGreaterThan(
        PLANCHER_DE_MOTS,
      );
    });
  }
});
