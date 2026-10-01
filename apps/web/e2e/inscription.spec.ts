import { readFileSync } from 'node:fs';
import { type Page, expect, test } from '@playwright/test';

/**
 * L'inscription, de bout en bout, dans un vrai navigateur — 01-identite.md §5.
 *
 * Le code OTP est lu dans le journal de l'API, où le fournisseur de SMS fictif
 * l'écrit. C'est le SEUL raccourci : tout le reste passe par l'interface, comme
 * un membre le ferait.
 *
 * Ces tests demandent l'API en marche. Ils se sautent proprement sinon, avec un
 * message qui dit quoi lancer — plutôt que d'échouer en accusant le code.
 */

const API = process.env['API_URL'] ?? 'http://localhost:3001/v1';

/**
 * La bannière d'erreur du parcours, et elle seule.
 *
 * `[role="alert"]` ne suffit PAS : Next pose son annonceur de route avec le même
 * rôle, vide au chargement. Trois tests d'ici échouaient dessus, en accusant
 * l'application — c'est le sélecteur qui était trop large.
 */
const BANNER = '[data-flow-error]';
const API_LOG = process.env['API_LOG'] ?? '';

async function apiUp(): Promise<boolean> {
  try {
    const r = await fetch(`${API}/health`);
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * Les codes envoyés à un numéro donné, dans l'ordre.
 *
 * CORRÉLÉS au numéro, et non « le dernier du journal » : les deux projets
 * Playwright tournent en parallèle et demandent chacun un code. Prendre le
 * dernier écrit renvoyait celui de l'autre projet, et le test échouait sur
 * « ce code n'est pas le bon » — en accusant l'application d'un défaut qui était
 * dans le test. Le journal masque le numéro mais garde ses quatre derniers
 * chiffres : c'est assez pour ne pas se tromper.
 *
 * Lu en `latin1` : le journal contient des séquences de couleur et un masque `•`
 * qui le font passer pour du binaire. Un `grep` ordinaire s'y tait complètement —
 * le premier outil d'inspection que j'ai écrit est tombé exactement là.
 */
function codesSentTo(phone: string): string[] {
  if (API_LOG === '') return [];
  const tail = phone.slice(-4);
  try {
    const text = readFileSync(API_LOG, 'latin1');
    const pattern = new RegExp(`SMS fictif vers [^:]*${tail} : Votre code de connexion : (\\d{6})`, 'g');
    return [...text.matchAll(pattern)].map((m) => m[1] as string);
  } catch {
    return [];
  }
}

/**
 * Inscrit un membre et le laisse connecté, pour éprouver un écran plus loin dans
 * le parcours sans refaire le chemin à chaque test.
 */
async function signUp(page: Page): Promise<void> {
  const phone = `97${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 100)}`;
  await page.goto('/connexion');
  await page.locator('input[name="phone"]:visible').fill(phone);
  // §5 : la case est obligatoire, et l'API la vérifie aussi. Sans ce clic, tout
  // le parcours s'arrête au premier écran — c'est le but.
  await page.locator('main:visible [role="checkbox"]').click();
  await page.getByRole('button', { name: 'Recevoir le code' }).click();
  await page.waitForURL('**/connexion/code');
  await expect.poll(() => codesSentTo(phone).length, { timeout: 15_000 }).toBe(1);
  await page.locator('input[autocomplete="one-time-code"]').fill(codesSentTo(phone)[0] as string);
  await page.waitForURL('**/bienvenue/phase', { timeout: 20_000 });
}

test.describe('inscription complète', () => {
  test.skip(
    async () => !(await apiUp()) || API_LOG === '',
    'API ou journal absents : lancer `pnpm dev` dans apps/api et passer API_LOG',
  );

  test('numéro, code, phase — et l’avancement suit', async ({ page }) => {
    /**
     * Un numéro VRAIMENT unique.
     *
     * `Date.now()` tronqué à quatre chiffres se répète toutes les dix secondes,
     * et les deux projets Playwright démarrent à la même milliseconde : deux
     * exécutions rapprochées consommaient la limite de trois envois par heure et
     * par numéro. Le test échouait alors sur un vrai refus du serveur, ce qui
     * ressemblait à un bogue de l'application.
     */
    const phone = `97${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 100)}`;

    await page.goto('/connexion');

    // Le champ dessiné en `<div>` par la maquette est bien devenu saisissable.
    const field = page.locator('input[name="phone"]:visible');
    await field.fill(phone);
    await expect(field).toHaveValue(phone);

    await page.locator('main:visible [role="checkbox"]').click();
    await page.getByRole('button', { name: 'Recevoir le code' }).click();
    await page.waitForURL('**/connexion/code');

    // Le SMS fictif est parti, VERS CE NUMÉRO.
    await expect.poll(() => codesSentTo(phone).length, { timeout: 15_000 }).toBe(1);
    const code = codesSentTo(phone)[0] as string;

    // UN SEUL champ, masqué : les six cases ne font qu'afficher.
    await page.locator('input[autocomplete="one-time-code"]').fill(code);

    // La vérification part au sixième chiffre, sans bouton — comme la maquette.
    await page.waitForURL('**/bienvenue/phase', { timeout: 20_000 });

    // Troisième carte, puis « Continuer » : la phase doit être enregistrée avant
    // d'avancer, sinon l'écran suivant travaille sur un compte incomplet.
    // Ciblé par son TEXTE, pas par son rang : les deux cadres n'ont pas le même
    // nombre de boutons, et un `nth(2)` désignait une flèche de retour sur mobile.
    await page.locator('main:visible button').filter({ hasText: 'Je suis installé·e' }).click();
    await page.getByRole('button', { name: 'Continuer' }).click();
    await page.waitForURL('**/bienvenue/lieu', { timeout: 20_000 });

    // Aucune bannière d'erreur sur le chemin heureux.
    await expect(page.locator(BANNER)).toHaveCount(0);
  });

  test('refuse un numéro vide sans appeler l’API', async ({ page }) => {
    let called = false;
    await page.route('**/auth/otp/request', (route) => {
      called = true;
      return route.continue();
    });

    await page.goto('/connexion');
    await page.getByRole('button', { name: 'Recevoir le code' }).click();

    await expect(page.locator(BANNER)).toContainText('Entrez votre numéro');
    // Un SMS coûte : la vérification locale doit précéder l'appel.
    expect(called).toBe(false);
  });

  test('refuse les lettres à la frappe', async ({ page }) => {
    await page.goto('/connexion');
    const field = page.locator('input[name="phone"]:visible');

    await field.fill('06ab12cd');
    // Refusé À LA FRAPPE, et non signalé après envoi : un champ qui accepte des
    // lettres laisse croire qu'elles comptent.
    await expect(field).toHaveValue('0612');
  });

  test('renvoie au numéro AVEC son motif quand le défi est perdu', async ({ page }) => {
    await page.goto('/connexion/code');
    // Aucun défi en session : c'est le cas d'un onglet rouvert, ou d'un lien
    // suivi directement.
    await page.locator('input[autocomplete="one-time-code"]').fill('123456');

    await page.waitForURL('**/connexion?reprise=**', { timeout: 20_000 });
    /**
     * Le motif voyage dans l'URL, pas dans l'état React.
     *
     * Posé dans l'état, il était effacé par la navigation : le membre
     * atterrissait sur l'écran du numéro SANS SAVOIR POURQUOI — le pire moment
     * pour abandonner une inscription. Trouvé en exerçant ce cas, pas en relisant.
     */
    await expect(page.locator(BANNER)).toContainText('expiré');
  });

  test('affiche le motif de reprise rendu par le SERVEUR', async ({ page }) => {
    // Le message vient du HTML initial, pas d'un rendu client : les constantes
    // partagées ne vivent donc pas dans un module `'use client'`, où un composant
    // serveur n'obtiendrait qu'une référence client et une recherche vide.
    const response = await page.goto('/connexion?reprise=defi-expire');
    expect(await response?.text()).toContain('Votre demande a expiré');
  });

  test('ignore un motif de reprise inconnu au lieu de l’afficher', async ({ page }) => {
    // L'URL est publique : n'importe qui peut y écrire ce qu'il veut. Afficher la
    // valeur telle quelle ferait de cet écran un panneau d'affichage.
    await page.goto('/connexion?reprise=<script>alert(1)</script>');
    await expect(page.locator(BANNER)).toHaveCount(0);
  });
});

test.describe('O02 — pays d’origine et ville', () => {
  test.skip(async () => !(await apiUp()) || API_LOG === '', 'API ou journal absents');

  test('la recherche de ville ignore accents et casse', async ({ page }) => {
    await signUp(page);
    await page.goto('/bienvenue/lieu');

    const field = page.locator('input[aria-label="Votre ville"]:visible');
    await field.fill('LYO');
    // Comparer sans normaliser fait échouer « segou » sur « Ségou » — un échec
    // que le membre lit comme « ma ville n'existe pas ».
    await expect(page.locator('main:visible button', { hasText: 'Lyon' })).toHaveCount(1);
  });

  test('retenir une ville remplit le champ et l’enregistre', async ({ page }) => {
    await signUp(page);
    await page.goto('/bienvenue/lieu');

    const field = page.locator('input[aria-label="Votre ville"]:visible');
    await field.fill('lyo');
    await page.locator('main:visible button', { hasText: 'Lyon' }).first().click();
    await expect(field).toHaveValue('Lyon');

    await page.getByRole('button', { name: 'Continuer' }).click();
    await page.waitForURL('**/bienvenue/objectif', { timeout: 20_000 });
    await expect(page.locator(BANNER)).toHaveCount(0);
  });

  test('ne propose PAS la France comme pays d’origine', async ({ page }) => {
    await signUp(page);
    await page.goto('/bienvenue/lieu');

    const optionsLocator = page.locator('main:visible select[aria-label="Pays d’origine"] option');

    /**
     * ON ATTEND QUE LA LISTE ARRIVE, et ce n'est pas une précaution de style.
     *
     * Ce test lisait `allTextContents()` juste après `goto`. Or cette méthode
     * N'ATTEND PAS : elle rend ce qui existe à l'instant. Les pays viennent d'un
     * `GET /places/countries` asynchrone, donc elle rendait `[]` — et les deux
     * assertions passaient le mauvais examen : « aucune option ne contient France »
     * est TRIVIALEMENT vrai sur une liste vide, et `length > 0` échouait.
     *
     * Mesuré au navigateur pour lever le doute : la requête répond `200` et les
     * options arrivent bien (`Bénin`, `Togo`, sans la France), à peine plus tard.
     * C'était donc la course du test, pas un défaut de l'application — mais le
     * symptôme était exactement celui d'un sélecteur vide, le piège qui a déjà coûté
     * une heure ici. D'où `expect.poll`, qui attend le fait au lieu de le supposer.
     */
    await expect.poll(async () => (await optionsLocator.allTextContents()).length, {
      timeout: 15_000,
    }).toBeGreaterThan(0);

    const options = await optionsLocator.allTextContents();
    // La France est `DESTINATION` (02 §2.1) : l'API refuse de l'accepter comme
    // pays d'origine, donc la proposer serait offrir un choix qui échoue.
    expect(options.some((o) => o.includes('France'))).toBe(false);
  });
});

test.describe('P01 — sélecteur d’indicatif', () => {
  test('l’indicatif suit le choix, et le drapeau disparaît', async ({ page }) => {
    await page.goto('/connexion');
    const select = page.locator('main:visible select[aria-label="Indicatif du pays"]');
    await expect(select).toHaveCount(1);

    const dialCode = () =>
      page.evaluate(() => {
        const box = document.querySelector('main:not([hidden]) select')?.parentElement;
        return (box?.textContent ?? '').match(/\+\d+/)?.[0] ?? '';
      });

    await expect.poll(dialCode).toBe('+229');
    await select.selectOption('FR');
    await expect.poll(dialCode).toBe('+33');

    /**
     * Le drapeau se cache dès que le pays choisi n'est plus celui que la maquette
     * a dessiné. Un drapeau béninois à côté d'un « +33 » serait un défaut que
     * n'importe qui remarque ; en inventer d'autres serait dessiner à la place du
     * porteur.
     */
    const flagDisplay = await page.evaluate(() => {
      const flag = document.querySelector<HTMLElement>(
        'main:not([hidden]) select',
      )?.parentElement?.querySelector('span');
      return flag === null || flag === undefined ? 'absent' : getComputedStyle(flag).display;
    });
    expect(['none', 'absent']).toContain(flagDisplay);
  });
});

test.describe('O04 — profil', () => {
  test.skip(async () => !(await apiUp()) || API_LOG === '', 'API ou journal absents');

  test('translittère les accents du pseudo au lieu de les supprimer', async ({ page }) => {
    await signUp(page);
    await page.goto('/bienvenue/profil');

    const handle = page.locator('input[name="handle"]:visible');
    await handle.fill('Aïcha SÈGBÉDJI!!');
    // Les retirer faisait de « Aïcha Sègbédji » un `achasgbdji` méconnaissable :
    // le membre voit son nom se désagréger sous ses doigts.
    await expect(handle).toHaveValue('aicha-segbedji');
  });

  test('un seul statut à la fois, plusieurs types d’aide', async ({ page }) => {
    await signUp(page);
    await page.goto('/bienvenue/profil');

    const pressed = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('main:not([hidden]) button[aria-pressed="true"]')].map(
          (b) => b.textContent?.trim() ?? '',
        ),
      );

    await page.locator('main:visible button', { hasText: 'Indépendant·e' }).click();
    // `user_profiles.occupation_status` est une colonne unique : deux statuts
    // sélectionnés seraient un état que la base ne peut pas représenter.
    expect(await pressed()).not.toContain('Étudiant·e');
    expect(await pressed()).toContain('Indépendant·e');

    /**
     * Les types d'aide n'existent que dans le cadre ORDINATEUR.
     *
     * Ce n'est pas un oubli de transcodage : la maquette ne dessine pas la ligne
     * « je suis disponible pour aider » dans son cadre de 390 px, donc ni
     * l'interrupteur ni les pastilles qui en dépendent. Le test le CONSTATE, pour
     * que le jour où la maquette l'ajoutera, l'écart se voie ici.
     */
    const hasHelpTypes = await page.locator('main:visible button', { hasText: 'Démarches' }).count();
    if (hasHelpTypes === 0) {
      expect(await page.locator('[data-frame="desktop"] button', { hasText: 'Démarches' }).count())
        .toBe(1);
      return;
    }

    await page.locator('main:visible button', { hasText: 'Trajet' }).click();
    const after = await pressed();
    expect(after).toContain('Démarches');
    expect(after).toContain('Trajet');
  });

  test('les pastilles sont atteignables au clavier', async ({ page }) => {
    await signUp(page);
    await page.goto('/bienvenue/profil');

    // La maquette les dessinait en `<span>` : ni focalisables, ni annoncées comme
    // actionnables. Un membre au lecteur d'écran ne pouvait pas remplir son profil.
    const chip = page.locator('main:visible button', { hasText: 'Salarié·e' });
    await chip.focus();
    await expect(chip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('P01 — consentement (§5 et §2.10)', () => {
  test('la case est DÉCOCHÉE au départ', async ({ page }) => {
    await page.goto('/connexion');
    const box = page.locator('main:visible [role="checkbox"]');

    /**
     * La maquette la dessine COCHÉE. Ce n'est pas un défaut à reproduire : une
     * case pré-cochée n'est pas un consentement valide, et la preuve enregistrée
     * ne vaudrait rien. L'état dessiné est une illustration.
     */
    await expect(box).toHaveAttribute('aria-checked', 'false');
  });

  test('refuse l’envoi sans acceptation, SANS appeler l’API', async ({ page }) => {
    let called = false;
    await page.route('**/auth/otp/request', (route) => {
      called = true;
      return route.continue();
    });

    await page.goto('/connexion');
    await page.locator('input[name="phone"]:visible').fill('971234567');
    await page.getByRole('button', { name: 'Recevoir le code' }).click();

    await expect(page.locator(BANNER)).toContainText('accepter les conditions');
    // Le message est local : l'API le refuserait aussi, mais le membre verrait un
    // message générique sans savoir quoi corriger.
    expect(called).toBe(false);
  });

  test('agrandit la cible sans grossir la case dessinée', async ({ page }) => {
    await page.goto('/connexion');

    const measured = await page.evaluate(() => {
      // La case AFFICHÉE, pas celle du cadre d'ordinateur : sous 1024 px ce
      // dernier est en `display: none` et toutes ses boîtes valent zéro.
      const el = [...document.querySelectorAll<HTMLElement>('[role="checkbox"]')].find(
        (candidate) => candidate.getBoundingClientRect().height > 0,
      );
      if (el === undefined) throw new Error('case affichée introuvable');
      const box = el.getBoundingClientRect();
      /**
       * CE QUI EST PEINT SE MESURE SUR L'ÉLÉMENT QUI PORTE LE TRAIT, pas sur la
       * largeur calculée du bouton.
       *
       * Ce test mesurait `getComputedStyle(el).width` et affirmait « la case garde
       * ses 22 px dessinés ». IL ÉTAIT CREUX, et le propriétaire a vu à l'écran ce
       * qu'il ne voyait pas : la case portait `padding: 11px` en `content-box`, donc
       * `style.width` valait bien 22 — la boîte de CONTENU — alors que
       * `backgroundClip: "content-box"` rogne le FOND et pas le TRAIT. Le `border`
       * se dessinait au bord du remplissage : 44 × 44 px peints, le double de la
       * maquette, sous un test vert.
       *
       * On mesure donc le rectangle RENDU de l'élément qui porte la bordure. La
       * cible tactile et le carré peint sont maintenant deux éléments distincts, et
       * ce test exige les deux séparément — ce qu'un seul élément ne pouvait pas
       * donner.
       */
      const paintedEl = el.querySelector<HTMLElement>('[aria-hidden="true"]') ?? el;
      const painted = paintedEl.getBoundingClientRect();
      return {
        target: Math.round(Math.min(box.width, box.height)),
        painted: Math.round(Math.max(painted.width, painted.height)),
      };
    });

    expect(measured.target, 'la cible tactile doit faire au moins 44 px').toBeGreaterThanOrEqual(
      44,
    );
    // La case garde ses 22 px dessinés : une « correction » d'accessibilité qui
    // grossit le visuel serait un changement de design, pas un correctif.
    expect(
      measured.painted,
      'le carré PEINT a changé de taille : c’est un changement de design, pas un correctif d’accessibilité',
    ).toBe(22);
  });

  /**
   * Le retour visuel de la case, dans le cadre qui est affiché.
   *
   * Les deux cadres ne le donnent pas de la même façon, et c'est la maquette qui
   * en décide : celui d'ORDINATEUR dessine une coche blanche, celui de MOBILE
   * n'en dessine aucune — seul le fond distingue les deux états. Le test éprouve
   * donc ce qui existe, au lieu d'exiger partout ce qu'un seul cadre fournit.
   */
  test('montre l’état de la case, par la coche ou par le fond', async ({ page }) => {
    await page.goto('/connexion');

    const visual = () =>
      page.evaluate(() => {
        const box = [...document.querySelectorAll<HTMLElement>('[role="checkbox"]')].find(
          (candidate) => candidate.getBoundingClientRect().height > 0,
        );
        if (box === undefined) throw new Error('case affichée introuvable');
        /**
         * LE FOND SE LIT SUR L'ÉLÉMENT QUI LE PORTE, et ce n'est plus le bouton.
         *
         * La cible tactile et le carré peint ont été séparés : le bouton porte les
         * 44 px cliquables sans fond ni trait, le `<span>` intérieur porte le dessin
         * de la maquette à ses 22 px. Lire `backgroundColor` sur le bouton rendrait
         * désormais `rgba(0, 0, 0, 0)` avant ET après — le test passerait pour la
         * raison même qui le rendrait inutile.
         */
        const peint = box.querySelector<HTMLElement>('[aria-hidden="true"]') ?? box;
        const path = peint.querySelector('svg path');
        return {
          background: getComputedStyle(peint).backgroundColor,
          check: path === null ? null : getComputedStyle(path).stroke,
        };
      });

    const before = await visual();
    await page.locator('main:visible [role="checkbox"]').click();
    const after = await visual();

    // Le fond change toujours : c'est le seul signal commun aux deux cadres.
    expect(after.background).not.toBe(before.background);

    if (before.check !== null) {
      // Là où la maquette dessine une coche, elle est transparente puis blanche —
      // rien ne bouge dans la mise en page.
      expect(before.check).toContain('rgba(0, 0, 0, 0)');
      expect(after.check).toBe('rgb(255, 255, 255)');
    }
  });
});
