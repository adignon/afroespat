import { type Page, expect, test } from '@playwright/test';
import { numeroNational } from './session';

/**
 * P02 — L'ÉCRAN DU CODE, LES QUATRE DÉFAUTS QUE LE PORTEUR A TROUVÉS EN L'UTILISANT.
 *
 * Mot pour mot : « sur la page de saisi de l'otp le bouton retour ne marche pas,
 * ainsi que le timer », « après la saisie du code OTP la corriger n'est pas
 * possible », et « le tooltip qui dit "Ce code n'est pas le bon. Vérifiez et
 * réessayez." n'est pas présentable ».
 *
 * Quinze rapports d'agents tous verts les avaient manqués, et la raison est
 * instructive : les tests existants VÉRIFIENT LE CHEMIN HEUREUX — taper le bon
 * code du premier coup, et partir. Aucun ne se trompait, n'attendait, ne
 * renvoyait, ne revenait. Ce fichier ne fait que cela.
 *
 * ── CE QUI EST SIMULÉ, ET POURQUOI C'EST HONNÊTE ────────────────────────────
 *
 * Deux raccourcis, tous deux sur l'ÉCHÉANCE de renvoi plutôt que sur le
 * comportement :
 *
 *   · `dp_otp_resend_at` est repoussé dans le passé au lieu d'attendre 45 s. Cette
 *     échéance EST le contrat — c'est elle que le parcours lit, elle qui survit à
 *     un rechargement — donc la faire expirer est exactement le même état que
 *     l'avoir attendue. Un test par cas à 45 s donnerait quatre minutes de suite
 *     pour la même information ;
 *   · le `429` est posé par `page.route`. L'API le renverrait pour de vrai en
 *     épuisant les trois envois par heure et par numéro — et consommerait du même
 *     coup le budget de dix par heure et par IP de la route, pour toute la
 *     machine. L'éprouver pour de bon rendrait les autres tests inexécutables
 *     pendant une heure, ce qui est précisément le coût qu'on veut éviter.
 *
 * Le DÉCOMPTE, lui, n'est pas simulé : un test le regarde vraiment descendre.
 */

const API = process.env['API_URL'] ?? 'http://localhost:3001/v1';

/** La notification de refus, et elle seule — voir `inscription.spec.ts`. */
const REFUS = '[data-flow-error]';
const CONFIRMATION = '[data-flow-ok]';

/** Le fournisseur SMS fictif émet ce code — `SMS_FAKE_FIXED_CODE`, §11.3. */
const CODE_FICTIF = '123456';

async function apiUp(): Promise<boolean> {
  try {
    const r = await fetch(`${API}/health`);
    return r.ok;
  } catch {
    return false;
  }
}

const champ = (page: Page) => page.locator('input[autocomplete="one-time-code"]:visible');
const renvoyer = (page: Page) => page.locator('main:visible button', { hasText: 'Renvoyer' });

/**
 * Attend que le compte à rebours soit à l'écran.
 *
 * `page.goto` rend la main au `load` du document, et l'échéance est lue dans un
 * EFFET — `sessionStorage` n'existe pas au rendu serveur, et un état initial qui
 * en dépendrait ferait diverger l'hydratation. Le premier rendu montre donc un
 * compteur caché, l'effet le révèle. Lire sans attendre faisait tomber ce test
 * sur `hidden` une fois sur deux, en accusant l'application.
 */
async function attendreLeCompteur(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const fort = [...document.querySelectorAll('main:not([hidden]) strong')].find((s) =>
        /^\d+:\d\d$/.test(s.textContent ?? ''),
      );
      return (
        fort?.parentElement !== null &&
        fort !== undefined &&
        getComputedStyle(fort.parentElement as Element).visibility === 'visible'
      );
    },
    undefined,
    { timeout: 20_000 },
  );
}

/** Le minuteur affiché, en secondes. `null` s'il n'y en a aucun. */
async function minuteur(page: Page): Promise<{ secondes: number; visibilite: string } | null> {
  return page.evaluate(() => {
    const fort = [...document.querySelectorAll('main:not([hidden]) strong')].find((s) =>
      /^\d+:\d\d$/.test(s.textContent ?? ''),
    );
    if (fort === undefined || fort.parentElement === null) return null;
    const [m, s] = (fort.textContent ?? '0:00').split(':').map(Number);
    return {
      secondes: (m as number) * 60 + (s as number),
      visibilite: getComputedStyle(fort.parentElement).visibility,
    };
  });
}

/**
 * Pose l'état que P01 laisse derrière lui, SANS passer par l'API.
 *
 * Les clés sont celles de `use-onboarding-flow.ts`. Les écrire ici les met sous
 * surveillance : les renommer sans toucher à ce fichier fait tomber ces tests, ce
 * qui est exactement ce qu'on veut d'un contrat entre deux écrans.
 */
async function poserDefi(page: Page, options: { attente: number }): Promise<void> {
  await page.addInitScript((attente: number) => {
    sessionStorage.setItem('dp_otp_challenge', 'defi-de-test');
    sessionStorage.setItem('dp_otp_phone', '97123456');
    sessionStorage.setItem('dp_otp_country', 'BJ');
    /**
     * L'ÉCHÉANCE N'EST POSÉE QU'UNE FOIS, et c'est ce qui rend le test du
     * rechargement honnête : `addInitScript` tourne à CHAQUE navigation, donc la
     * réécrire la repousserait à chaque rechargement — et le test qui vérifie
     * qu'elle survit à un rechargement aurait mesuré le test, pas l'application.
     */
    if (sessionStorage.getItem('dp_otp_resend_at') === null) {
      sessionStorage.setItem('dp_otp_resend_at', String(Date.now() + attente * 1000));
    }
  }, options.attente);
}

/**
 * L'attente des tests qui regardent un compte à rebours EN COURS : dix minutes,
 * et non les 45 s de la maquette.
 *
 * Le premier chargement d'une route sous `next dev` peut demander plus d'une
 * minute de compilation, et l'échéance est posée AVANT elle. Avec 45 s, ces tests
 * trouvaient un compteur déjà expiré et échouaient en accusant l'application —
 * mesuré : 1,4 min sur le premier `goto` de la suite.
 *
 * La valeur 45 n'est pas perdue de vue pour autant : elle est éprouvée là où elle
 * est VRAIE, après un renvoi réel (« réarme l'attente »).
 */
const ATTENTE_LONGUE = 600;

/** P01 → P02, pour de vrai. Rend le numéro employé. */
async function demanderUnCode(page: Page): Promise<string> {
  /**
   * UN NUMÉRO BÉNINOIS VALIDE SELON `libphonenumber` : `019` + sept chiffres.
   *
   * Il commençait par `97`, c'est-à-dire l'ancien format — celui que la planche
   * dessine encore. Depuis que la validation par pays est en service (le porteur :
   * « utilise les librairies de validation de lib number de Google »), ce format
   * est refusé et « Recevoir le code » reste GRISÉ : le test expirait sur un clic
   * qui ne pouvait pas aboutir.
   */
  const phone = numeroNational();
  await page.goto('/connexion');
  await page.locator('input[name="phone"]:visible').fill(phone);
  await page.locator('main:visible [role="checkbox"]').click();
  await page.getByRole('button', { name: 'Recevoir le code' }).click();
  await page.waitForURL('**/connexion/code', { timeout: 30_000 });
  return phone;
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « ENVOYÉ AU … » NE DISAIT RIEN                                            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « La page d'onboarding "Entrez le code reçu" ne montre pas le
 * numéro, même anonymisé un peu. »
 *
 * MESURÉ : « Envoyé au » suivi de RIEN — et pas seulement après un rechargement,
 * dès l'arrivée sur l'écran. `/connexion` et `/connexion/code` sont DEUX PAGES :
 * chacune monte son propre flux, donc son propre état, et le numéro tapé sur la
 * première n'existait pas dans la seconde.
 */
test.describe('P02 — le numéro auquel le code est parti', () => {
  test('l’écran dit le numéro, masqué, et le garde après rechargement', async ({ page }) => {
    const phone = await demanderUnCode(page);
    const deux = phone.slice(-2);

    const cadre = page.locator('[data-frame]').filter({ visible: true }).first();
    /**
     * CE QU'ON ATTEND EXACTEMENT : l'indicatif, des points à la place du corps du
     * numéro, et les DEUX DERNIERS chiffres. Assez pour reconnaître son numéro,
     * pas assez pour le lire par-dessus l'épaule — c'est ce que fait
     * `masqueNumero`, et c'est la seule chose que cet écran a le droit d'afficher.
     */
    await expect(cadre.getByText(/Envoyé au/)).toBeVisible();
    await expect.poll(async () => cadre.innerText(), { timeout: 10_000 }).toContain(`+229`);
    const texte = await cadre.innerText();
    expect(texte, 'le numéro masqué n’apparaît pas').toMatch(new RegExp(`••.*${deux}`));
    // Et JAMAIS le numéro en clair : ce serait l'inverse du masque.
    expect(texte).not.toContain(phone);

    /**
     * ET IL SURVIT AU RECHARGEMENT. C'est la moitié qui manquait : le numéro est
     * conservé dans `sessionStorage` pour que « Renvoyer » fonctionne, et c'est de
     * là qu'il est relu — pas de l'adresse, où un numéro de téléphone n'a rien à
     * faire (historique, journaux, copier-coller).
     */
    await page.reload();
    await expect.poll(async () => cadre.innerText(), { timeout: 10_000 }).toMatch(
      new RegExp(`••.*${deux}`),
    );
  });
});

test.describe('P02 — le minuteur', () => {
  test('DÉCOMPTE au lieu d’afficher le « 0:45 » figé de la maquette', async ({ page }) => {
    await poserDefi(page, { attente: ATTENTE_LONGUE });
    await page.goto('/connexion/code');
    await attendreLeCompteur(page);

    const debut = await minuteur(page);
    expect(debut, 'le minuteur doit exister').not.toBeNull();

    await page.waitForTimeout(2_500);
    const apres = await minuteur(page);

    // Le défaut rapporté par le porteur : ce nombre ne bougeait JAMAIS. La
    // maquette écrit « 0:45 » et le cadre transcodé rendait ce texte tel quel.
    expect(apres?.secondes, 'le minuteur doit avoir descendu').toBeLessThan(
      debut?.secondes as number,
    );
    expect(apres?.secondes).toBeGreaterThan(0);
  });

  test('ne repart PAS de zéro à chaque rechargement de la page', async ({ page }) => {
    await poserDefi(page, { attente: ATTENTE_LONGUE });
    await page.goto('/connexion/code');
    await attendreLeCompteur(page);
    await page.waitForTimeout(2_500);
    const avant = await minuteur(page);

    await page.reload();
    await attendreLeCompteur(page);
    const apres = await minuteur(page);

    /**
     * L'ÉCHÉANCE EST EN SESSION, PAS LE TEMPS RESTANT.
     *
     * Un compteur en mémoire serait reparti de son maximum ici — et trois
     * rechargements auraient suffi à épuiser les trois envois par heure et par
     * numéro, ce qui verrouille le NUMÉRO du membre pour une heure entière.
     *
     * `poserDefi` ne pose l'échéance que si elle manque : ce qui se mesure est
     * donc bien que le compteur a continué de courir à travers le rechargement.
     */
    expect(apres?.secondes).toBeLessThanOrEqual((avant?.secondes as number) + 1);
    // Et il a VRAIMENT couru : un « temps restant » recalculé à plein à chaque
    // lecture passerait l'assertion ci-dessus sans jamais descendre.
    expect(apres?.secondes).toBeLessThan(ATTENTE_LONGUE);
  });

  test('se CACHE au lieu de rester à 0:00, sans déplacer « Renvoyer »', async ({ page }) => {
    await poserDefi(page, { attente: ATTENTE_LONGUE });
    await page.goto('/connexion/code');
    await attendreLeCompteur(page);
    const place = async () => (await renvoyer(page).boundingBox())?.x ?? -1;
    const pendant = await place();

    await page.evaluate(() => sessionStorage.setItem('dp_otp_resend_at', String(Date.now() - 1)));
    await expect(renvoyer(page)).toBeEnabled({ timeout: 5_000 });

    expect((await minuteur(page))?.visibilite).toBe('hidden');
    // La ligne est en `justify-content: space-between` : retirer le compteur du
    // flux ferait SAUTER « Renvoyer » à gauche. C'est ce que `visibility` évite.
    expect(await place()).toBe(pendant);
  });
});

test.describe('P02 — « Renvoyer »', () => {
  test('est un <button>, pas le <span> que la maquette dessine', async ({ page }) => {
    await poserDefi(page, { attente: ATTENTE_LONGUE });
    await page.goto('/connexion/code');

    const bouton = renvoyer(page);
    await expect(bouton).toHaveCount(1);
    await expect(bouton).toBeDisabled();

    // Les deux couleurs sont celles de la maquette : `#8A958F` pendant l'attente
    // (ce qu'elle dessine), `#16785E` ensuite (son « Recevoir un nouveau code »
    // du panneau « CODE EXPIRÉ », qui hérite d'`a{color:#16785E}`).
    await expect(bouton).toHaveCSS('color', 'rgb(138, 149, 143)');
    // La promotion en bouton ne doit pas faire maigrir le contrôle : `font:
    // inherit` posé APRÈS `fontWeight` aurait effacé la graisse de la maquette.
    await expect(bouton).toHaveCSS('font-weight', '700');

    await page.evaluate(() => sessionStorage.setItem('dp_otp_resend_at', String(Date.now() - 1)));
    await expect(bouton).toBeEnabled({ timeout: 5_000 });
    await expect(bouton).toHaveCSS('color', 'rgb(22, 120, 94)');
    await expect(bouton).toHaveCSS('cursor', 'pointer');
  });

  test('N’APPELLE PAS l’API tant que l’attente court', async ({ page }) => {
    let appels = 0;
    await page.route('**/auth/otp/request', (route) => {
      appels += 1;
      return route.fulfill({ status: 500, body: '{}' });
    });

    await poserDefi(page, { attente: ATTENTE_LONGUE });
    await page.goto('/connexion/code');
    // `force` : on contourne exprès le `disabled` de l'attribut, pour éprouver le
    // garde du GESTIONNAIRE. Les deux existent — un clic programmé, un double
    // événement ou un test comme celui-ci ne doivent pas consommer d'envoi.
    for (let i = 0; i < 3; i += 1) await renvoyer(page).click({ force: true, timeout: 2_000 });

    expect(appels, 'un SMS coûte, et la limite est de 3 par heure et par numéro').toBe(0);
  });

  test('un 429 REVERROUILLE l’attente et n’est JAMAIS rejoué', async ({ page }) => {
    let appels = 0;
    await page.route('**/auth/otp/request', (route) => {
      appels += 1;
      /**
       * CE QUE L'API RÉPOND VRAIMENT quand les trois envois par numéro sont
       * épuisés : le refus vient d'`AuthService.assertWithinRateLimits`, donc il
       * porte `retryAfterSeconds` dans ses `details` et AUCUN en-tête
       * `Retry-After`. C'est exactement le cas où `ApiError.rateLimitMessage`
       * retomberait sur « Patientez un instant » pour une heure d'attente.
       */
      return route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'RATE_LIMITED',
            message: 'Patientez un instant avant de réessayer.',
            details: { retryAfterSeconds: 3600 },
          },
        }),
      });
    });

    await poserDefi(page, { attente: 0 });
    await page.goto('/connexion/code');
    await expect(renvoyer(page)).toBeEnabled({ timeout: 5_000 });
    await renvoyer(page).click();

    /**
     * LE DÉLAI ANNONCÉ EST LE VRAI, et le message du serveur n'apparaît pas.
     *
     * Il dit « Patientez un instant avant de réessayer » pour 3 600 secondes.
     * L'afficher ferait réessayer en boucle, et chaque essai coûte un SMS aux
     * autres derrière le même NAT.
     *
     * La garantie est tenue par `ApiError.rateLimitMessage` — plus par cet
     * écran, qui en avait écrit une seconde version avant qu'une mutation ne
     * montre qu'elle était inutile. Ce test la surveille donc là où elle vit :
     * mettre `displayMessage` à plat (`return this.message`) le fait tomber.
     */
    const refus = page.locator(REFUS);
    await expect(refus).toContainText('une heure');
    await expect(refus).not.toContainText('un instant');

    // Le bouton se reverrouille sur le délai ANNONCÉ, et le minuteur l'affiche
    // dans le format `m:ss` de la maquette, prolongé au-delà de l'heure.
    await expect(renvoyer(page)).toBeDisabled();
    expect((await minuteur(page))?.secondes).toBeGreaterThan(3_500);

    for (let i = 0; i < 3; i += 1) await renvoyer(page).click({ force: true, timeout: 2_000 });
    expect(appels, 'un 429 ne se rejoue pas').toBe(1);
  });
});

test.describe('P02 — « Changer de numéro »', () => {
  test('ramène à la saisie du numéro et abandonne le défi', async ({ page }, info) => {
    await poserDefi(page, { attente: ATTENTE_LONGUE });
    await page.goto('/connexion/code');

    /**
     * DEUX CONTRÔLES DIFFÉRENTS, et c'est la maquette qui le décide : l'ordinateur
     * écrit « Changer de numéro » à côté du chevron, le téléphone n'affiche qu'un
     * rond de 44 px. Le second tient son nom d'un `aria-label` recopié du premier.
     */
    const retour = page.locator(
      'main:visible button[aria-label="Changer de numéro"], main:visible button:has-text("Changer de numéro")',
    );
    await expect(retour).toHaveCount(1);

    // La cible tactile de `T1 §2.3` sur le cadre où la maquette dessine un rond.
    if (info.project.name === 'mobile') {
      const boite = await retour.boundingBox();
      expect(Math.min(boite?.width ?? 0, boite?.height ?? 0)).toBeGreaterThanOrEqual(44);
    }

    await retour.click();
    await page.waitForURL('**/connexion', { timeout: 20_000 });
    await expect(page.locator('input[name="phone"]:visible')).toHaveCount(1);

    // Le défi abandonné est effacé : le laisser derrière soi laisserait un défi
    // valide pour un numéro que le membre vient justement de quitter.
    expect(await page.evaluate(() => sessionStorage.getItem('dp_otp_challenge'))).toBeNull();
  });
});

test.describe('P02 — corriger son code', () => {
  test('cliquer sur les six cases rend le focus au champ', async ({ page }) => {
    await poserDefi(page, { attente: ATTENTE_LONGUE });
    await page.goto('/connexion/code');

    // Le champ est focalisé à l'arrivée, puis on le perd EXPRÈS — c'est ce que
    // faisait le `disabled={busy}` du champ masqué pendant la vérification.
    await page.locator('main:visible h1').click();
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('INPUT');

    /**
     * LE GESTE QUI NE MARCHAIT PAS.
     *
     * Les six cases sont des `<div>`, donc cliquer dessus ne focalisait RIEN : le
     * champ vivait HORS du cadre, en 1 px opaque à zéro. Une fois le focus perdu,
     * plus rien n'était saisissable, et c'est exactement ce que le porteur a
     * vécu. Le champ est maintenant POSÉ SUR les cases.
     */
    const grille = page.locator('main:visible div[style*="grid"]').first();
    await grille.click({ position: { x: 25, y: 25 } });
    expect(
      await page.evaluate(
        () => document.activeElement?.getAttribute('autocomplete') === 'one-time-code',
      ),
      'cliquer là où l’on regarde doit rendre le focus',
    ).toBe(true);

    // Et l'on peut effacer puis retaper, à tout moment.
    await page.keyboard.type('12');
    await expect(champ(page)).toHaveValue('12');
    await page.keyboard.press('Backspace');
    await expect(champ(page)).toHaveValue('1');
  });

  test('UN SEUL champ : le collage et le remplissage par SMS restent possibles', async ({ page }) => {
    await poserDefi(page, { attente: ATTENTE_LONGUE });
    await page.goto('/connexion/code');

    // Six `<input>` paraîtraient plus fidèles à l'image et casseraient les deux
    // seules choses dont un membre a besoin ici.
    await expect(champ(page)).toHaveCount(1);
    await expect(champ(page)).toHaveAttribute('inputmode', 'numeric');
    await expect(champ(page)).toHaveAttribute('maxlength', '6');
  });
});

test.describe('P02 — le retour d’erreur, en notification', () => {
  test.skip(async () => !(await apiUp()), 'API absente : lancer `pnpm dev` dans apps/api');

  test('un code faux est refusé, annoncé, et SE CORRIGE', async ({ page }) => {
    await demanderUnCode(page);

    await champ(page).fill('654321');
    const refus = page.locator(REFUS);
    await expect(refus).toBeVisible({ timeout: 20_000 });
    await expect(refus).toHaveAttribute('role', 'alert');
    await expect(refus).toContainText('code');

    /**
     * LES JETONS SONT CEUX DE LA MAQUETTE, pas ceux de la bibliothèque.
     *
     * `react-hot-toast` apporte sa propre carte blanche, son ombre portée et son
     * émoji — trois choses que `T1 §2.1` interdit. On ne garde d'elle que la
     * mécanique. Le fond, le filet et le texte sont `journey-softest`, `journey`
     * et `journey-strong` : les trois couleurs du panneau « CODE INVALIDE » que
     * la section P02 dessine elle-même.
     */
    await expect(refus).toHaveCSS('background-color', 'rgb(255, 251, 248)');
    await expect(refus).toHaveCSS('border-top-color', 'rgb(224, 115, 58)');
    await expect(refus).toHaveCSS('color', 'rgb(180, 88, 31)');

    /**
     * LE SECOND CODE FAUX EST REFUSÉ LUI AUSSI — et on le mesure sur l'APPEL.
     *
     * Le garde de double vérification gardait le code refusé : retaper
     * exactement les mêmes six chiffres ne produisait alors plus rien — ni
     * vérification, ni message — et l'écran paraissait mort.
     *
     * On compte les `POST /auth/otp/verify` plutôt que de regarder la
     * notification : elle est encore à l'écran (sept secondes), donc la chercher
     * une seconde fois passerait sur le RESTE de la première. C'est exactement le
     * genre de test vert qui ne prouve rien, et la mutation l'a montré.
     */
    let verifications = 0;
    page.on('request', (r) => {
      if (r.url().includes('/auth/otp/verify')) verifications += 1;
    });
    await champ(page).fill('');
    await champ(page).fill('654321');
    await expect
      .poll(() => verifications, { timeout: 20_000 })
      .toBeGreaterThan(0);

    // Puis le bon code passe : l'écran n'a jamais cessé d'accepter la saisie.
    await champ(page).fill('');
    await champ(page).fill(CODE_FICTIF);
    await page.waitForURL('**/bienvenue/**', { timeout: 30_000 });
  });

  test('« Renvoyer » envoie VRAIMENT un code, et réarme l’attente', async ({ page }) => {
    await demanderUnCode(page);
    await page.evaluate(() => sessionStorage.setItem('dp_otp_resend_at', String(Date.now() - 1)));
    await expect(renvoyer(page)).toBeEnabled({ timeout: 5_000 });

    const partis: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/auth/otp/request')) partis.push(r.url());
    });

    await renvoyer(page).click();

    const ok = page.locator(CONFIRMATION);
    await expect(ok).toBeVisible({ timeout: 20_000 });
    // POLI, pas assertif : « un nouveau code est parti » ne doit pas couper la
    // phrase qu'un lecteur d'écran est en train de lire.
    await expect(ok).toHaveAttribute('role', 'status');
    expect(partis.length, 'un seul envoi par clic').toBe(1);

    expect((await minuteur(page))?.secondes).toBeGreaterThan(40);
    await expect(renvoyer(page)).toBeDisabled();

    /**
     * LE MÊME CODE REPASSE SUR LE NOUVEAU DÉFI.
     *
     * `SMS_FAKE_FIXED_CODE` rend toujours `123456` : sans l'oubli du garde de
     * double vérification, retaper ce code après un renvoi ne déclenchait rien.
     */
    await champ(page).fill('');
    await champ(page).fill(CODE_FICTIF);
    await page.waitForURL('**/bienvenue/**', { timeout: 30_000 });
  });
});
