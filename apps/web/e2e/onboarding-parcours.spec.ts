import { type Page, expect, test } from '@playwright/test';
import { connecter, numeroNational } from './session';
import { monterEnL1 } from './niveau';

/**
 * L'ONBOARDING BRANCHÉ SUR L'API, ET LE PARCOURS QU'IL CRÉE — 01 §5, 03 §3.1.
 *
 * `inscription.spec.ts` éprouve le chemin numéro → code → phase → lieu. Ce fichier
 * reprend là où il s'arrête, sur ce que ce lot a branché :
 *
 *   · O03 affiche les modèles de `GET /journey-templates` — les VRAIS noms et le
 *     VRAI nombre d'étapes, pas les « 12 étapes » de la maquette ;
 *   · « Créer mon parcours maintenant » crée réellement le parcours (§3.1) ;
 *   · O05 choisit sa variante sur `GET /journeys`, plus sur l'URL seule ;
 *   · J02 « Régulariser » et son refus `PLAN_LIMIT_REACHED` ;
 *   · J03 crée un brouillon de blocage et « Annuler » le passe en `CANCELLED` ;
 *   · P03 sert son document, et un slug inconnu rend 404.
 *
 * ── DEUX CONTRAINTES DE L'API DICTENT LA FORME DE CE FICHIER ─────────────────
 *
 * 1. `POST /auth/otp/request` EST LIMITÉ À 10 PAR HEURE ET PAR IP. Ce n'est pas une
 *    précaution théorique : la première version de ce fichier faisait une
 *    inscription PAR TEST, sur deux projets Playwright, donc dix-huit envois. Le
 *    compteur de l'heure était épuisé au milieu de la suite (mesuré à 19 dans
 *    Redis), et les tests échouaient sur « waiting for navigation to
 *    /connexion/code » — un message qui n'a RIEN à voir avec la cause, et qui
 *    accuse l'application.
 *
 *    D'où la forme retenue : DEUX inscriptions pour tout le fichier, chacune en
 *    `serial`, qui traversent les écrans et assertionnent au passage. C'est aussi la
 *    forme la plus honnête pour un onboarding — un membre ne s'inscrit pas huit
 *    fois.
 *
 * 2. UN SEUL PROJET. Les deux projets Playwright tournent en parallèle et
 *    partageraient l'IP, donc le compteur. Les blocs d'inscription se limitent au
 *    cadre d'ordinateur et pilotent eux-mêmes leur taille quand ils ont besoin du
 *    mobile — la même méthode que `parcours-bloque.spec.ts`.
 *
 * Le code OTP est lu dans le journal de l'API. C'est le SEUL raccourci, et il est
 * obligatoire : `SMS_FAKE_FIXED_CODE=123456` n'est PAS respecté — le fournisseur
 * fictif tire un code au hasard et le journalise.
 */

const API = process.env['API_URL'] ?? 'http://localhost:3001/v1';
/**
 * VAGUE 5 — LE CODE EST CELUI DE DÉVELOPPEMENT (`SMS_FAKE_FIXED_CODE`, 123456), pas
 * celui qu'on lirait dans le journal de l'API. Ce fichier exigeait `API_LOG` et SAUTAIT
 * dix-sept cas quand la variable manquait : un saut silencieux est un test qui ne
 * prouve rien, et il ne se lit pas comme une panne. Le code fixe rend le journal inutile ;
 * l'API absente fait désormais ÉCHOUER les cas, au lieu de les taire.
 */
const CODE_OTP = process.env['SMS_FAKE_FIXED_CODE'] ?? '123456';

/** La bannière du parcours, et elle seule : Next pose son propre `role="alert"`. */
const BANNER = '[data-flow-error]';

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
 * Lu en `latin1`, et corrélé au numéro : le journal contient des séquences de
 * couleur et un masque `•` qui le font passer pour du binaire, et un `grep`
 * ordinaire s'y tait. Les deux pièges sont documentés dans `inscription.spec.ts`,
 * et la fonction est la même — délibérément.
 */

/** Un numéro vraiment unique : la limite est de 3 envois par numéro et par heure. */
/**
 * Un numéro que l'écran ACCEPTE. Il commençait par `97` — l'ancien format du
 * Bénin, celui que la planche dessine — et depuis la validation par pays,
 * « Recevoir le code » restait grisé : ce fichier expirait sur un clic
 * impossible, trois cas de suite.
 */
const unique = (): string => numeroNational();

/**
 * LIRE L'API EN TANT QUE CE MEMBRE, depuis le test.
 *
 * On ne peut PAS faire `fetch` dans la page : le jeton d'accès vit dans la clôture
 * de `src/lib/api/session.ts` et n'est exposé nulle part — c'est exactement le soin
 * que ce module prend, et il serait absurde de lui demander de l'abandonner pour
 * qu'un test soit plus court.
 *
 * Ce qui EST partagé avec la page, c'est le cookie `dp_refresh` (`httpOnly`).
 * `page.request` porte les cookies du contexte : on échange donc le cookie contre
 * un jeton d'accès neuf, exactement comme l'application le fait au chargement.
 *
 * Effet de bord à connaître : `/auth/refresh` FAIT TOURNER le jeton de
 * rafraîchissement, et porte `@RateLimit(30)` à la minute. Le `Set-Cookie` revient
 * dans le contexte, donc la page reste valide — mais ces lectures ne sont pas
 * gratuites, et on n'en fait qu'une par assertion.
 */
async function jetonDe(page: Page): Promise<string | null> {
  const r = await page.request.post(`${API}/auth/refresh`);
  if (!r.ok()) return null;
  const body = (await r.json()) as { accessToken?: string };
  return body.accessToken ?? null;
}

async function lireApi<T>(page: Page, chemin: string): Promise<T | null> {
  const token = await jetonDe(page);
  if (token === null) return null;
  const r = await page.request.get(`${API}${chemin}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  return r.ok() ? ((await r.json()) as T) : null;
}

/** Le nombre de parcours de ce membre, demandé au serveur. */
async function nombreDeParcours(page: Page): Promise<number> {
  const body = await lireApi<{ items: unknown[] }>(page, '/journeys');
  return body === null ? -1 : body.items.length;
}

/** Inscrit un membre et le laisse connecté, à l'écran de la phase. */
async function signUp(page: Page): Promise<void> {
  const phone = unique();
  await page.goto('/connexion');
  await page.locator('input[name="phone"]:visible').fill(phone);
  await page.locator('main:visible [role="checkbox"]').click();
  await page.getByRole('button', { name: 'Recevoir le code' }).click();
  await page.waitForURL('**/connexion/code', { timeout: 20_000 });
  await page.locator('input[autocomplete="one-time-code"]:visible').fill(CODE_OTP);
  await page.waitForURL('**/bienvenue/phase', { timeout: 20_000 });
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA VILLE SE CHOISIT DANS UN PANNEAU, PLUS DANS UN CHAMP                   ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « La sélection de ville : utilise le panneau aussi. » Le champ
 * `input[aria-label="Votre ville"]` que ces cas remplissaient n'existe plus dans
 * la page : c'est un BOUTON qui ouvre un panneau, et la recherche vit DEDANS.
 */
/** Retenir Lyon à l'écran du lieu, puis avancer. */
async function choisirLyon(page: Page): Promise<void> {
  const cadre = page.locator('[data-frame]').filter({ visible: true }).first();
  await cadre.locator('button[aria-label="Votre ville"]').click();

  const panneau = cadre.locator('[data-panneau-section="ville"]');
  await expect(panneau).toHaveCount(1);
  await panneau.getByLabel('Votre ville').fill('lyo');
  await panneau.locator('button[aria-pressed]', { hasText: 'Lyon' }).first().click();

  /**
 * ON LIT LA LIGNE, PAS LE BOUTON. Le déclencheur est une surface TRANSPARENTE
 * (`opacity:0`) posée sur toute la ligne : c'est la maquette qui dessine la
 * ligne, et le bouton ne fait que la rendre cliquable sans la redessiner. La
 * ville retenue est donc le texte de la LIGNE — viser le bouton lit une chaîne
 * vide et fait conclure, à tort, que le choix ne s'affiche pas.
 */
  await expect(cadre.locator('div:has(> button[aria-label="Votre ville"])')).toContainText('Lyon');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.waitForURL('**/bienvenue/objectif', { timeout: 20_000 });
}

/** Le nombre d'étapes affiché sur la première carte d'objectif de O03. */
async function etapesAffichees(page: Page): Promise<number | null> {
  const texte = await page.locator('main:visible').innerText();
  const trouve = /(\d+)\s+étapes/.exec(texte);
  return trouve === null ? null : Number(trouve[1]);
}

/**
 * LE PARCOURS D'INSCRIPTION COMPLET, UNE SEULE FOIS.
 *
 * `serial` : les tests partagent la MÊME page et le MÊME membre, dans l'ordre. Ce
 * n'est pas du confort — c'est la seule forme qui tienne sous la limite de dix
 * envois d'OTP par heure et par IP (voir l'en-tête).
 */
test.describe.serial('un membre s’inscrit, et son parcours existe', () => {
  // Un seul projet : les deux partageraient l'IP, donc le compteur d'OTP.
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'piloté par le test');

  let page: Page;
  let journeyId: string | null = null;

  test.beforeAll(async ({ browser }) => {
    expect(await apiUp(), `l’API ne répond pas sur ${API}/health`).toBe(true);
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  });

  test.afterAll(async () => {
  /**
   * `page` est VIDE quand le `describe` s'est sauté : `beforeAll` ne tourne pas,
   * mais `afterAll` SI. MESURÉ : trois cas comptés « échoués » — `TypeError:
   * Cannot read properties of undefined (reading 'close')` — là où ils étaient
   * simplement sautés faute de `API_LOG`. Un saut ne doit pas se lire comme une
   * panne : c'est ce qui fait chercher un défaut là où il n'y en a pas.
   */
    await page?.close();
  });

  test('numéro, code, phase, lieu', async () => {
    await signUp(page);

    // O01 — la phase. La troisième carte, par son TEXTE et non par son rang : les
    // deux cadres n'ont pas le même nombre de boutons.
    await page.locator('main:visible button').filter({ hasText: 'Je suis installé·e' }).click();
    await page.getByRole('button', { name: 'Continuer' }).click();
    await page.waitForURL('**/bienvenue/lieu', { timeout: 20_000 });

    /**
     * O02 — LA VILLE N'EST PAS UN DÉCOR.
     *
     * `POST /journeys` répond `LOCATION_REQUIRED` sans elle, mesuré sur l'API. Le
     * quatrième écran ne pourrait donc rien créer si celui-ci était sauté — et c'est
     * l'ordre de §5 qui le garantit, pas une coïncidence.
     */
    await choisirLyon(page);
    await expect(page.locator(BANNER)).toHaveCount(0);
  });

  test('O03 affiche le nombre d’étapes du SERVEUR, pas celui dessiné', async () => {
    /**
     * LA RÈGLE DE CE TEST : le nombre d'étapes ne vient jamais de la maquette.
     *
     * Elle écrit « Étudier · 12 étapes ». L'API répond « Étudier en France · 15
     * étapes », parce que le modèle `STUDIES` a été rechargé en version 3. Les deux
     * se ressemblent assez pour qu'une relecture ne voie rien — et c'est une
     * PROMESSE fausse au moment précis où le membre choisit son parcours.
     *
     * Aucun nombre n'est écrit en dur ici : le modèle peut passer en version 4
     * demain, et ce test doit alors continuer de passer. Il éprouve la PROVENANCE,
     * pas la valeur.
     */
    const attendu = await lireApi<{
      items: { nameFr: string; version: { stepCount: number } }[];
    }>(page, '/journey-templates');
    expect(attendu).not.toBeNull();
    const premier = attendu?.items[0];
    expect(premier).toBeDefined();

    await expect.poll(() => etapesAffichees(page), { timeout: 15_000 }).not.toBeNull();
    expect(await etapesAffichees(page)).toBe(premier?.version.stepCount);

    // Et le NOM aussi : « Étudier en France », non « Étudier ».
    await expect(page.locator('main:visible')).toContainText(premier?.nameFr ?? '');
  });

  test('« Continuer » crée réellement le parcours (§3.1)', async () => {
    // La case est cochée au départ, comme la maquette la dessine.
    await expect(page.locator('main:visible [role="checkbox"]')).toHaveAttribute(
      'aria-checked',
      'true',
    );

    await page.getByRole('button', { name: 'Continuer' }).click();
    await page.waitForURL('**/bienvenue/profil', { timeout: 25_000 });
    await expect(page.locator(BANNER)).toHaveCount(0);

    /**
     * Le parcours existe VRAIMENT — demandé au serveur, pas déduit de l'écran.
     *
     * Un test qui se contenterait de vérifier la navigation passerait avec la case
     * débranchée : c'est exactement l'état d'avant ce lot, où « Créer mon parcours
     * maintenant » ne créait rien et où l'inscription se terminait quand même.
     */
    expect(await nombreDeParcours(page)).toBe(1);
    journeyId =
      (await lireApi<{ items: { id: string }[] }>(page, '/journeys'))?.items[0]?.id ?? null;
    expect(journeyId).not.toBeNull();
  });

  test('O04 puis O05 : l’atterrissage est celui AVEC parcours', async () => {
    /**
     * O04 — le pseudo est translittéré, pas amputé (§2.6).
     *
     * Le suffixe unique n'est PAS du décor. Une première exécution employait
     * « Aïcha SÈGBÉDJI » tel quel ; la seconde a pris `409 CONFLICT`
     * `HANDLE_TAKEN`, et l'inscription s'est arrêtée au cinquième écran. Le test
     * échouait alors sur `waitForURL`, en accusant l'application d'un défaut qui
     * était dans le test — ce sont de VRAIS comptes, et un pseudo est unique.
     *
     * Le refus lui-même est éprouvé ailleurs : c'est lui qui a fait écrire la
     * phrase « Ce pseudo est déjà pris » à la place du « Cette action n'est plus
     * possible dans l'état actuel » du catalogue.
     */
    const pseudo = page.locator('input[name="handle"]:visible');
    const suffixe = String(Date.now()).slice(-6);
    /**
     * VAGUE 5 — LA SAISIE N'EST PLUS « SLUGIFIÉE » (lot A, `saisieHandle`). L'ancienne
     * attente — « Aïcha SÈGBÉDJI 123456 » devenait `aicha-segbedji-123456` — décrivait une
     * fonction qui MODIFIAIT en silence ce que le membre tapait, et le schéma partagé
     * refuse ce qu'elle produisait parfois. Décision : l'écran ne retire que ce qui ne peut
     * jamais appartenir à un pseudo (espaces, ponctuation) et translittère les accents ;
     * la casse est laissée telle quelle, et le schéma la REFUSE avec son propre message.
     * Le cas mesure donc les deux moitiés : la translittération, puis le refus d'une
     * majuscule — avant de saisir un pseudo valide pour continuer.
     */
    await pseudo.fill(`Aïcha SÈGBÉDJI ${suffixe}`);
    await expect(pseudo).toHaveValue(`AichaSEGBEDJI${suffixe}`);
    await expect(page.locator('main:visible')).toContainText('minuscules');
    await pseudo.fill(`aicha-segbedji-${suffixe}`);
    await expect(pseudo).toHaveValue(`aicha-segbedji-${suffixe}`);
    await page.getByRole('button', { name: 'Continuer' }).click();
    await page.waitForURL('**/bienvenue/fin', { timeout: 25_000 });

    /**
     * ON PART DE LA MAUVAISE VARIANTE, EXPRÈS.
     *
     * `?parcours=non` fixe la valeur de DÉPART à « sans parcours ». L'écran ne peut
     * donc basculer sur « avec parcours » que si `GET /journeys` a répondu ET que
     * sa réponse a été validée.
     *
     * La première version de ce test ouvrait `/bienvenue/fin` sans paramètre, donc
     * sur la variante qu'elle attendait : elle passait même quand l'appel échouait.
     * Et il échouait — `journeysListResponseSchema` décrivait la forme du DÉTAIL et
     * non celle de la LISTE, ce qui ne se voit pas sur une liste vide. Le test
     * mesurait la valeur par défaut ; il mesure maintenant le branchement.
     */
    /**
     * ── ON RECONNAÎT LA PLANCHE À SON CONTENU, PLUS À SON NOM ──────────────
     *
     * Ce cas distinguait les deux variantes par les libellés « SANS PARCOURS » et
     * « AVEC PARCOURS ». C'étaient les noms que la MAQUETTE donne à ses propres
     * planches, imprimés en tête de l'écran : ils ont été retirés, parce qu'un
     * membre n'a pas à lire le nom d'une planche. Les deux atterrissages se
     * reconnaissent donc à ce qu'ils DISENT — le réseau de la ville d'un côté,
     * la première étape du parcours de l'autre.
     */
    await page.goto('/bienvenue/fin?parcours=non');
    await expect(page.locator('main:visible')).toContainText('PROCHAINS ÉVÉNEMENTS');
    await expect
      .poll(
        async () =>
          (await page.locator('main:visible').innerText()).includes('Votre parcours est prêt'),
        { timeout: 15_000 },
      )
      .toBe(true);
    await expect(page.locator(BANNER)).toHaveCount(0);
  });

  test('J03 : ouvrir la feuille crée un BROUILLON, « Annuler » l’annule (§3.5)', async () => {
    /**
     * ON OBSERVE LES APPELS, parce que c'est la seule preuve disponible.
     *
     * Aucune route ne liste les blocages d'un parcours : `GET /journeys/:id` ne les
     * rend pas, et il n'existe pas de `GET /blockers`. Vérifier l'état en base
     * depuis un navigateur est donc impossible — d'où l'observation des requêtes,
     * qui reste une mesure du comportement réel et non du code écrit.
     *
     * C'est un manque à remonter, pas à contourner : sans lecture, un front ne peut
     * pas reprendre un brouillon laissé en plan.
     */
    const appels: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'POST') appels.push(new URL(r.url()).pathname);
    });

    await page.goto(`/parcours/${journeyId ?? ''}`, { waitUntil: 'networkidle' });
    await page.locator('[data-frame="desktop"] [data-modal-open="J03"]').first().click();
    await expect(page.getByRole('dialog', { name: /Je suis bloqué/ })).toBeVisible();

    // §3.5, premier temps : le brouillon est créé à l'ouverture.
    await expect
      .poll(() => appels.filter((p) => p.endsWith('/blocker')).length, { timeout: 15_000 })
      .toBe(1);

    await page
      .getByRole('dialog', { name: /Je suis bloqué/ })
      .getByRole('button', { name: 'Annuler' })
      .click();

    // §3.5 : « Annuler » → `CANCELLED`, par un appel explicite.
    await expect
      .poll(() => appels.filter((p) => /\/blockers\/[^/]+\/cancel$/.test(p)).length, {
        timeout: 15_000,
      })
      .toBe(1);

    /**
     * ET RIEN N'A ÉTÉ PUBLIÉ. C'est la règle dure de §3.5 : « le brouillon n'est
     * jamais promu sans cet appel ». Aucune suite de clics de ce lot ne l'appelle —
     * le bouton « Publier » du troisième volet ne porte aucun gestionnaire, faute
     * d'une prise dans le cadre transcodé.
     */
    expect(appels.filter((p) => p.endsWith('/publish'))).toHaveLength(0);
    await expect(page.locator(BANNER)).toHaveCount(0);
  });

  test('J02 : « tout est gratuit » — un second parcours n’est PLUS refusé', async () => {
    /**
     * ATTENTE RETOURNÉE PAR DÉCISION DU PORTEUR : « On va laisser les paiements. Tout sera
     * gratuit pour le moment. » Tant que `monetisation_active` est faux, tous les membres
     * ont les droits Premium et AUCUNE limite de plan ne s'applique : `PLAN_LIMIT_REACHED`
     * (03 §3.1, « un parcours actif en gratuit ») ne peut plus se produire. Le refus et sa
     * bannière restent éprouvés côté serveur, monétisation allumée, par les tests
     * d'intégration de l'API ; ici on prouve l'état présent — le second parcours est créé,
     * sans bannière d'erreur, et le membre en compte bien deux.
     */
    // La variante « Régulariser » n'existe QUE sur le cadre mobile.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/parcours/nouveau?etape=regulariser');
    await page.getByRole('button', { name: 'Créer le parcours' }).click();

    await expect.poll(() => nombreDeParcours(page), { timeout: 25_000 }).toBe(2);
    await expect(page.locator(BANNER)).toHaveCount(0);
    await page.setViewportSize({ width: 1440, height: 1000 });
  });
});

/**
 * LE SECOND MEMBRE : celui qui REFUSE le parcours.
 *
 * Un membre à part, et une seconde inscription, parce que la règle dure de 03 §1.2
 * — « le parcours n'est jamais imposé » — ne se vérifie pas sur un compte qui en a
 * déjà un. Deux inscriptions au total pour ce fichier ; la limite en autorise dix.
 */
test.describe.serial('un membre refuse le parcours, et rien n’est créé', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'piloté par le test');

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    expect(await apiUp(), `l’API ne répond pas sur ${API}/health`).toBe(true);
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  });

  test.afterAll(async () => {
  /**
   * `page` est VIDE quand le `describe` s'est sauté : `beforeAll` ne tourne pas,
   * mais `afterAll` SI. MESURÉ : trois cas comptés « échoués » — `TypeError:
   * Cannot read properties of undefined (reading 'close')` — là où ils étaient
   * simplement sautés faute de `API_LOG`. Un saut ne doit pas se lire comme une
   * panne : c'est ce qui fait chercher un défaut là où il n'y en a pas.
   */
    await page?.close();
  });

  test('décocher la case ne crée rien, et l’inscription continue', async () => {
    await signUp(page);
    /**
     * VAGUE 5 — ON PASSE PAR L'ÉCRAN DE LA PHASE, on n'ouvre plus `/bienvenue/lieu` d'un
     * coup. Les villes proposées au lieu dépendent de la phase du membre (`villesProposees`) :
     * un membre sans phase choisie est « avant le départ » côté serveur et se voit proposer
     * les villes de son pays d'ORIGINE — le comportement voulu, et c'est précisément ce que
     * l'accès direct montrait (douze villes béninoises, pas de Lyon).
     */
    await page.locator('main:visible button').filter({ hasText: 'Je suis installé·e' }).click();
    await page.getByRole('button', { name: 'Continuer' }).click();
    await page.waitForURL('**/bienvenue/lieu', { timeout: 20_000 });
    await choisirLyon(page);

    // §1.2, règle dure : « le parcours n'est jamais imposé ».
    await page.locator('main:visible [role="checkbox"]').click();
    await expect(page.locator('main:visible [role="checkbox"]')).toHaveAttribute(
      'aria-checked',
      'false',
    );

    await page.getByRole('button', { name: 'Continuer' }).click();
    await page.waitForURL('**/bienvenue/profil', { timeout: 25_000 });
    await expect(page.locator(BANNER)).toHaveCount(0);

    expect(await nombreDeParcours(page)).toBe(0);
  });

  test('et O05 l’atterrit SANS parcours', async () => {
    await page.goto('/bienvenue/fin');
    await expect
      .poll(
        // Le réseau de la ville : ce que montre l'atterrissage SANS parcours.
        async () => (await page.locator('main:visible').innerText()).includes('PROCHAINS ÉVÉNEMENTS'),
        { timeout: 15_000 },
      )
      .toBe(true);
  });
});

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ O05 DIT LE PARCOURS RÉEL, PAS CELUI DE LA MAQUETTE                        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur, capture à l'appui : « Il faut que cette page prenne en compte le
 * parcours réel créé au cours de l'onboarding, et non juste une valeur dummies. »
 *
 * Ce qu'il voyait : « Rejoindre ma famille », « ÉTAPE 1 SUR 9 » et « Déposer le
 * dossier de regroupement familial » — tout cela VRAI — surmontant « Campus
 * France, choix des formations, lettre de motivation », qui est la phrase de la
 * maquette et parle d'un parcours d'ÉTUDES.
 *
 * Ce cas ouvre un parcours de FAMILLE expressément : c'est ce qui rend l'erreur
 * visible. Sur un parcours d'études, la phrase dessinée aurait l'air juste.
 */
test.describe('O05 — l’atterrissage lit le parcours créé', () => {
  test('le titre, le rang, l’étape et sa description viennent du serveur', async ({
    page,
    request,
  }) => {
    test.slow();
    const membre = await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    const { accessToken } = await monterEnL1(page.context(), request, membre.accessToken);
    const entete = { authorization: `Bearer ${accessToken}` };

    const modeles = (await (
      await request.get(`${API}/journey-templates`, { headers: entete })
    ).json()) as { items: readonly { id: string; code: string }[] };
    const famille = modeles.items.find((t) => t.code === 'FAMILY') ?? modeles.items[0];
    expect(famille, 'aucun modèle de parcours servi').toBeDefined();
    const creation = await request.post(`${API}/journeys`, {
      headers: entete,
      data: { templateId: famille?.id },
    });
    expect(creation.ok(), `POST /journeys : ${creation.status()}`).toBe(true);

    /** La liste, c'est-à-dire EXACTEMENT ce que l'écran lit. */
    const liste = (await (await request.get(`${API}/journeys`, { headers: entete })).json()) as {
      items: readonly {
        title: string;
        doneCount: number;
        stepCount: number;
        currentStep: { title: string; description: string | null } | null;
      }[];
    };
    const parcours = liste.items[0];
    expect(parcours, 'le parcours créé n’est pas dans la liste').toBeDefined();
    if (parcours === undefined) return;

    await page.goto('/bienvenue/fin');
    const ecran = page.locator('main:visible');
    await expect(ecran).toContainText('Votre parcours est prêt');
    await expect.poll(async () => (await ecran.innerText()).includes(parcours.title), {
      timeout: 15_000,
    }).toBe(true);

    const texte = (await ecran.innerText()).replace(/\s+/g, ' ');
    // Le rang et le total DU PARCOURS — pas le `stepCount` du modèle, qui est une
    // seconde source et diverge dès la première étape franchie.
    expect(texte).toContain(
      `ÉTAPE ${String(parcours.doneCount + 1)} SUR ${String(parcours.stepCount)}`,
    );
    expect(texte).toContain(parcours.currentStep?.title ?? '');

    /**
     * LA DESCRIPTION : celle du serveur, ou RIEN.
     *
     * `currentStep.description` est `null` pour tout le référentiel actuel — T3
     * ne donne aucune description, les procédures vivent dans les guides. La
     * ligne ne doit donc pas être dessinée du tout ; et le jour où le back-office
     * la remplit, c'est ELLE qui doit s'afficher.
     */
    const decrite = parcours.currentStep?.description;
    if (decrite === null || decrite === undefined || decrite === '') {
      expect(texte, 'une phrase s’affiche là où le serveur n’en donne aucune').not.toContain(
        'Campus France',
      );
    } else {
      expect(texte).toContain(decrite);
    }

    // Et aucun littéral de la planche, qui parlent tous d'un parcours d'ÉTUDES.
    for (const dessine of [
      'Mes études à Lyon',
      'ÉTAPE 1 SUR 12',
      'Obtenir votre admission',
      'Campus France, choix des formations, lettre de motivation.',
    ]) {
      expect(texte, `« ${dessine} » est encore dessiné`).not.toContain(dessine);
    }
  });
});

test.describe('J03 sur une planche d’illustration : aucun appel ne part', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'piloté par le test');

  test('« 1 » n’est pas un parcours, et aucune requête n’est émise', async ({
    page,
    request,
  }) => {
    /**
     * UNE SESSION, PARCE QUE LA PAGE EN EXIGE UNE DÉSORMAIS. Ce cas ouvrait
     * `/parcours/1/etapes/7` sans se connecter ; mesuré, il atterrissait sur
     * `/connexion` — « Votre numéro de téléphone » — et le clic sur l'ouvreur de
     * la fenêtre expirait. La cause n'est pas dans ce cas : la garde de session
     * de ce groupe de routes a été posée depuis, et ce test ne l'avait pas suivie.
     */
    await connecter(page.context(), request);
    /**
     * `/parcours/1/etapes/7` est l'URL des tests de planche : la maquette ne dessine
     * qu'un parcours, et « 1 » n'est pas un identifiant. Prendre ce segment pour un
     * parcours ferait partir `GET /journeys/1`, que le serveur refuse en `400` — et
     * le membre verrait une bannière d'erreur pour avoir ouvert une feuille sur une
     * démonstration. C'est ce qu'interdit le garde de `useContexteParcours`.
     */
    const appels: string[] = [];
    page.on('request', (r) => {
      const chemin = new URL(r.url()).pathname;
      /**
       * VAGUE 5 — LA COLONNE LATÉRALE DEMANDE `/journeys/public` (parcours publics à
       * suggérer), appel légitime et sans rapport avec le segment « 1 » : la règle porte
       * sur ce segment, donc sur `/journeys/1…` et sur les blocages, pas sur toute route
       * `/journeys`. Garder l'ancien filtre aurait fait échouer le cas sur un appel
       * que la page DOIT faire.
       */
      if (/\/journeys\/1(\/|$)/.test(chemin) || chemin.includes('/blockers')) appels.push(chemin);
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/parcours/1/etapes/7', { waitUntil: 'networkidle' });
    await page.locator('[data-frame="desktop"] [data-modal-open="J03"]').first().click();
    await expect(page.getByRole('dialog', { name: /Je suis bloqué/ })).toBeVisible();

    expect(appels).toHaveLength(0);
    await expect(page.locator(BANNER)).toHaveCount(0);
  });
});

test.describe('P03 — la page statique, `/p/:slug`', () => {
  test('sert son document dans le HTML INITIAL, pas après hydratation', async ({ page }) => {
    /**
     * Vérifié sur la RÉPONSE, et non sur le DOM rendu.
     *
     * Cinq pages de ce dépôt ont été servies vides parce qu'un `useSearchParams()`
     * forçait le rendu client. Un `expect(locator).toBeVisible()` ne l'aurait pas
     * vu : le contenu arrive, une hydratation plus tard. Le texte doit être dans les
     * octets de la première réponse.
     */
    const response = await page.goto('/p/confidentialite');
    const html = (await response?.text()) ?? '';
    /**
     * VAGUE 5 — LE TEXTE VIENT DU BACK (`static_pages`), plus de la maquette. Sur une
     * base fraîche la confidentialité est un texte PROVISOIRE (version 0) : « Ce que nous
     * collectons » n'existe plus nulle part. Ce que la propriété « HTML initial » exige
     * n'a pas changé : le titre, la version et la date d'entrée en vigueur du document
     * servi par le serveur sont dans les octets de la première réponse.
     */
    expect(html).toContain('Politique de confidentialité');
    expect(html).toContain('En vigueur depuis le');
    expect(html).toMatch(/Version <!-- -->\d+/);
  });

  test('sert la variante RESSOURCES avec ses numéros réels', async ({ page }) => {
    const response = await page.goto('/p/ressources');
    const html = (await response?.text()) ?? '';
    // Des numéros de services d'aide RÉELS. Un numéro faux sur cet écran-là se paie
    // très cher : le test les fige.
    expect(html).toContain('SOS Amitié');
    expect(html).toContain('09 72 39 40 50');
    expect(html).toContain('3919');
  });

  test('un slug inconnu rend 404, au lieu de servir une page', async ({ page }) => {
    /**
     * L'URL est publique. On mesure le STATUT, pas l'absence d'une chaîne dans le
     * corps : en développement, Next embarque la pile d'erreur dans sa page 404, et
     * la pile contient l'URL demandée. Une assertion sur le corps passait donc en
     * production et échouait en développement — un test qui dépend du mode n'est pas
     * un test. `404` dit exactement ce qui compte : cette page n'existe pas.
     */
    const response = await page.goto('/p/%3Cscript%3Ealert(1)%3C%2Fscript%3E');
    expect(response?.status()).toBe(404);
  });

  test('`cgu` est servi par la route du back, avec SON titre', async ({ page }) => {
    /**
     * L'ancienne attente (« `cgu` rend 404 tant que la route du back n'existe pas »)
     * disait elle-même : « ce test tombera le jour où la route arrivera, il doit être
     * relu à ce moment-là ». La route est arrivée : `static_pages` sert `cgu` comme
     * `confidentialite`. Le garde-fou qu'elle portait reste : ne jamais afficher le
     * MAUVAIS document sous ce slug — on exige donc le titre des conditions, et
     * l'absence du titre de la confidentialité.
     */
    const response = await page.goto('/p/cgu');
    expect(response?.status()).toBe(200);
    const html = (await response?.text()) ?? '';
    expect(html).toContain('Conditions générales d’utilisation');
    expect(html).not.toContain('Politique de confidentialité');
  });
});
