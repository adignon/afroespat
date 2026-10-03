import { createHmac } from 'node:crypto';
import { expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { connecter, type Membre } from './session';

/**
 * EXERCICE AU NAVIGATEUR du branchement de A01G et A06.
 *
 * Ce fichier n'éprouve pas le dessin — il est transcodé. Il éprouve que les
 * valeurs affichées viennent DU SERVEUR, sur des données que ce fichier crée
 * lui-même : un guide publié par un membre L1, et une correction proposée par un
 * second membre. Un test qui lirait les valeurs de la maquette (« Fatou Ndiaye »,
 * « 11 j », « Obtenir la garantie Visale sans CDI ») passerait AVANT le
 * branchement et doit échouer après : c'est le bon sens de lecture.
 *
 * ── LA SESSION EST MUTUALISÉE, ET C'EST UNE CONTRAINTE MESURÉE ──────────────
 *
 * `POST /auth/otp/request` est limité à DIX PAR HEURE ET PAR IP, et le passage à
 * L1 en coûte DEUX par membre (le jeton est périmé par la promotion). Ce fichier
 * crée donc ses deux membres UNE FOIS, dans un `beforeAll`, et chaque test
 * réinstalle le cookie dans SON contexte — un `BrowserContext` neuf n'hérite de
 * rien.
 */

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1';
const SECRET = process.env['DIDIT_WEBHOOK_SECRET'] ?? 'dev-didit-webhook-secret-change-me';

interface MembreL1 extends Membre {
  readonly jeton: string;
}

/** Porte un membre à L1 par la porte réelle : session KYC + webhook signé. */
async function connecterL1(
  context: BrowserContext,
  request: APIRequestContext,
  profil: { readonly displayName?: string } = {},
): Promise<MembreL1> {
  const membre = await connecter(context, request, profil);

  const session = await request.post(`${API}/me/kyc/session`, {
    headers: { authorization: `Bearer ${membre.accessToken}` },
  });
  if (!session.ok()) throw new Error(`kyc/session ${session.status()} : ${await session.text()}`);
  const { sessionId } = (await session.json()) as { sessionId: string };

  const corps = JSON.stringify({ sessionId, status: 'APPROVED', isAdult: true });
  const hook = await request.post(`${API}/webhooks/didit`, {
    headers: {
      'content-type': 'application/json',
      'x-signature': createHmac('sha256', SECRET).update(Buffer.from(corps, 'utf8')).digest('hex'),
    },
    data: corps,
  });
  if (!hook.ok()) throw new Error(`webhooks/didit ${hook.status()} : ${await hook.text()}`);

  // Le jeton PORTE les droits : périmé par la promotion, il faut en reprendre un.
  const demande = await request.post(`${API}/auth/otp/request`, {
    data: { phone: membre.phone, countryIso2: 'BJ', captchaToken: 'fake', acceptTerms: true },
  });
  if (!demande.ok()) throw new Error(`otp/request ${demande.status()} : ${await demande.text()}`);
  const { challengeId } = (await demande.json()) as { challengeId: string };
  const verif = await request.post(`${API}/auth/otp/verify`, {
    data: { challengeId, code: process.env['SMS_FAKE_FIXED_CODE'] ?? '123456' },
  });
  if (!verif.ok()) throw new Error(`otp/verify ${verif.status()} : ${await verif.text()}`);
  const { accessToken } = (await verif.json()) as { accessToken: string };

  const me = await request.get(`${API}/me`, { headers: { authorization: `Bearer ${accessToken}` } });
  const niveau = ((await me.json()) as { user: { verificationLevel: string } }).user
    .verificationLevel;
  expect(niveau, 'le membre devait être porté à L1').toBe('L1');

  return { ...membre, jeton: accessToken };
}

/** Réinstalle dans CE contexte le dernier `dp_refresh` posé par le contexte d'API. */
async function poserCookie(context: BrowserContext, request: APIRequestContext): Promise<void> {
  const cookies = await request.storageState();
  const refresh = cookies.cookies.filter((c) => c.name === 'dp_refresh').at(-1);
  if (refresh === undefined) throw new Error('aucun dp_refresh : la session serait muette');
  await context.addCookies([refresh]);
}

/**
 * `goto` rend la main dès que le DOCUMENT est là — or le document ne contient
 * d'abord que l'état d'attente. On attend donc le cadre, puis la VALEUR : sans
 * cela on mesure l'écran de chargement, défaut déjà rencontré dans ce dépôt.
 */
async function visiter(page: Page, url: string, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(url, { waitUntil: 'load' });
  await page.locator('[data-screen]').first().waitFor({ state: 'attached', timeout: 30_000 });
}

const CADRE = (w: number) => (w >= 1024 ? '[data-frame="desktop"]' : '[data-frame="mobile"]');

interface Decor {
  readonly auteur: MembreL1;
  readonly slug: string;
  readonly titre: string;
  readonly proposant: string;
  readonly motif: string;
  /**
   * LE COOKIE DE L'AUTEUR, capturé dans SON propre contexte de requêtes.
   *
   * `GET /guides/:id/proposals` ne montre les propositions EN ATTENTE qu'à
   * l'auteur — « en attente pour l'auteur, acceptées pour tous (§4) », dit la
   * route. Un membre quelconque voit donc une liste vide, et un test qui
   * s'ouvrirait avec lui mesurerait deux emplacements vides en croyant mesurer
   * l'écran. C'est exactement ce qui est arrivé à la première campagne.
   */
  readonly cookieAuteur: { name: string; value: string; domain: string; path: string };
}

let decor: Decor;

test.beforeAll(async ({ browser, playwright }) => {
  const context = await browser.newContext();
  /**
   * UN CONTEXTE DE REQUÊTES PAR MEMBRE. `dp_refresh` TOURNE à chaque usage et
   * porte un numéro de génération : deux membres dans le même pot à cookies, et
   * c'est le dernier inscrit qui gagne — on capturerait le cookie du
   * contributeur en croyant prendre celui de l'auteur.
   */
  const request = await playwright.request.newContext();

  const auteur = await connecterL1(context, request, { displayName: 'Awa Konaté' });
  const auth = { authorization: `Bearer ${auteur.jeton}` };

  const potAuteur = await request.storageState();
  const refreshAuteur = potAuteur.cookies.filter((c) => c.name === 'dp_refresh').at(-1);
  if (refreshAuteur === undefined) throw new Error('aucun dp_refresh pour l’auteur');

  /**
   * UN MARQUEUR UNIQUE SUR LE JEU D'ESSAI (règle du dépôt).
   *
   * Sans lui, deux campagnes laissent deux guides du même titre, et une assertion
   * exacte compte alors les guides des campagnes PRÉCÉDENTES : la première
   * mesure a trouvé cinq lignes de contexte là où une seule était attendue. Le
   * défaut n'était pas dans l'écran, il était dans l'accumulation — et c'est le
   * genre de borne qui devient fausse sans que personne ne touche au code.
   */
  const marque = `E2E-A01G-${Date.now().toString(36)}`;
  const titre = `Déclarer son médecin traitant ${marque}`;
  const cree = await request.post(`${API}/guides`, {
    headers: auth,
    data: {
      title: titre,
      /** 300 caractères au moins : `GUIDE_BODY_MIN` est exigé à la PUBLICATION. */
      body:
        'Pour déclarer votre médecin traitant, remplissez le formulaire S3704 et remettez-le à votre caisse d assurance maladie. Le médecin doit cosigner le formulaire : sans sa signature, la caisse le refuse et vous devrez recommencer la démarche depuis le début. Comptez environ trois semaines avant que la déclaration soit prise en compte, et conservez une copie du formulaire signé : la caisse la redemande parfois. Tant que la déclaration n est pas enregistrée, vos consultations sont remboursées à un taux réduit, ce qui surprend beaucoup de nouveaux arrivants.',
      category: 'DAILY_LIFE',
      scope: 'UNIVERSAL',
    },
  });
  if (!cree.ok()) throw new Error(`POST /guides ${cree.status()} : ${await cree.text()}`);
  /** `guideEditorResponseSchema` est PLAT : l'id et le slug sont à la racine. */
  const guide = (await cree.json()) as { id: string; slug: string };

  const publie = await request.post(`${API}/guides/${guide.id}/publish`, { headers: auth });
  if (!publie.ok()) throw new Error(`publish ${publie.status()} : ${await publie.text()}`);

  // UN SECOND MEMBRE propose une correction : l'auteur ne peut pas se corriger.
  const requeteContrib = await playwright.request.newContext();
  const contributeur = await connecterL1(context, requeteContrib, { displayName: 'Kofi Boateng' });
  const motif = 'Le formulaire a change de numero depuis la reforme de janvier 2026.';
  const prop = await requeteContrib.post(`${API}/guides/${guide.id}/proposals`, {
    headers: { authorization: `Bearer ${contributeur.jeton}` },
    data: {
      targetExcerpt: 'formulaire S3704',
      replacement: 'formulaire S3705',
      reason: motif,
    },
  });
  if (!prop.ok()) throw new Error(`POST proposals ${prop.status()} : ${await prop.text()}`);

  decor = {
    auteur,
    slug: guide.slug,
    titre,
    proposant: contributeur.displayName,
    motif,
    cookieAuteur: {
      name: refreshAuteur.name,
      value: refreshAuteur.value,
      domain: refreshAuteur.domain,
      path: refreshAuteur.path,
    },
  };

  await context.close();
  await request.dispose();
  await requeteContrib.dispose();
});

// ─── A01G · « Lier un guide » ───────────────────────────────────────────────

test.describe('A01G — la fenêtre « Lier un guide »', () => {
  for (const largeur of [1440, 390]) {
    test(`les RÉSULTATS sont de vrais guides (${largeur} px)`, async ({ context, request, page }) => {
      await connecter(context, request, {});
      await poserCookie(context, request);
      await visiter(page, '/accueil', largeur);

      const cadre = page.locator(CADRE(largeur));
      // L'icône livre du composeur : la maquette l'écrit en <span title=…>.
      const declencheur = cadre.locator('[title="Lier un guide"]').first();
      await expect(declencheur).toBeVisible();
      await declencheur.click();

      const fenetre = page.locator('[data-modal="A01G"]');
      await expect(fenetre).toBeVisible();

      /**
       * LE TITRE DU GUIDE CRÉÉ PAR CE FICHIER, et non une carte de la maquette.
       * `expect.poll` et non `page.evaluate` : la liste arrive par un appel, et
       * `evaluate` ne réessaie pas — défaut déjà mesuré dans ce dépôt.
       */
      await expect(fenetre.getByText(decor.titre, { exact: false }).first()).toBeVisible({
        timeout: 20_000,
      });

      /** Les quatre cartes de la MAQUETTE ont disparu : elles étaient en dur. */
      await expect(fenetre.getByText('Carte Vitale : premiers pas')).toHaveCount(0);
      await expect(fenetre.getByText('Complémentaire santé solidaire')).toHaveCount(0);
    });
  }

  test('la ligne de contexte porte la catégorie, la portée et le compteur d’utilité', async ({
    context,
    request,
    page,
  }) => {
    await connecter(context, request, {});
    await poserCookie(context, request);
    await visiter(page, '/accueil', 1440);
    const cadre = page.locator(CADRE(1440));
    await cadre.locator('[title="Lier un guide"]').first().click();
    const fenetre = page.locator('[data-modal="A01G"]');
    await expect(fenetre.getByText(decor.titre, { exact: false }).first()).toBeVisible({
      timeout: 20_000,
    });
    /**
     * LA LIGNE DE CONTEXTE : la catégorie, la PORTÉE, puis le compteur de VOTES
     * d'utilité — « Vie quotidienne · Universel · 0 utile ». Le guide est neuf,
     * donc personne n'a voté, et c'est bien `0` et non un nombre dessiné.
     *
     * `.first()` parce que la base d'essai porte plusieurs guides de la même
     * catégorie : ce test éprouve la FORME de la ligne, et c'est l'assertion de
     * titre ci-dessus qui prouve que NOTRE guide est là.
     */
    await expect(
      fenetre.getByText('Vie quotidienne · Universel · 0 utile').first(),
    ).toBeVisible();

    /**
     * LA SECTION « SUGGÉRÉS » EST VIDE, et c'est l'écart le plus important que ce
     * fichier mesure : aucune route ne rend des guides « suggérés pour cette
     * publication ». Son titre reste dessiné, et aucune carte ne vient dessous —
     * plutôt qu'une fausse suggestion qui aurait l'air branchée.
     */
    await expect(fenetre.getByText('SUGGÉRÉS POUR VOTRE PUBLICATION')).toBeVisible();
    await expect(fenetre.getByText('Suggéré', { exact: true })).toHaveCount(0);
  });
});

// ─── A06 · « Propositions reçues » ──────────────────────────────────────────

/**
 * UN SEUL TEST, ET UNE SEULE SESSION D'AUTEUR — ce n'est pas un regroupement de
 * confort.
 *
 * `dp_refresh` TOURNE à chaque rafraîchissement et porte un numéro de génération.
 * Trois tests qui présenteraient TOUS le même cookie capturé donneraient, au
 * deuxième, une génération dépassée : le serveur y voit un REJEU — ce pour quoi il
 * est fait — et RÉVOQUE la chaîne. Les deux derniers tests mesureraient alors
 * l'écran de reconnexion en croyant mesurer l'écran.
 *
 * Les trois affirmations vivent donc dans un seul contexte.
 */
test('A06 — la planche de l’auteur lit ses propositions réelles (390 px)', async ({
  context,
  page,
}) => {
  await context.addCookies([
    { ...decor.cookieAuteur, httpOnly: true, secure: false, sameSite: 'Strict' as const },
  ]);
  await visiter(page, `/guides/${decor.slug}/propositions`, 390);

  const cadre = page.locator(CADRE(390));

  // 1 ── LE PROPOSANT ET SON MOTIF viennent de `GET /guides/:id/proposals`.
  await expect(cadre.getByText(decor.proposant).first()).toBeVisible({ timeout: 30_000 });
  await expect(cadre.getByText(decor.motif, { exact: false }).first()).toBeVisible();
  /** Les proposants DESSINÉS ont disparu : ils étaient en dur dans le cadre. */
  await expect(cadre.getByText('Fatou Ndiaye')).toHaveCount(0);

  // 2 ── LES COMPTEURS sont DÉRIVÉS du statut, et non les « 2 » et « 7 » dessinés.
  await expect(cadre.getByText('En attente · 1')).toBeVisible();
  await expect(cadre.getByText('Acceptées · 0')).toBeVisible();
  await expect(cadre.getByText('En attente · 2')).toHaveCount(0);
  await expect(cadre.getByText('Acceptées · 7')).toHaveCount(0);

  /**
   * 3 ── LE SECOND EMPLACEMENT N'EMPRUNTE AUCUNE IDENTITÉ.
   *
   * La planche dessine DEUX cartes en balisage statique — une dépliée, une
   * repliée — et il n'existe qu'une proposition. L'emplacement libre annonce donc
   * l'absence au lieu d'afficher « Kofi Boateng » une seconde fois ou, pire, le
   * « Fatou Ndiaye » de la maquette. C'est la limite structurelle de cet écran,
   * et elle est REMONTÉE : il faut une boucle, donc que la planche dise ce qui
   * déplie une carte.
   */
  await expect(cadre.getByText('Aucune proposition')).toHaveCount(1);
  await expect(cadre.getByText(decor.proposant)).toHaveCount(1);
});

// ─── A06 · « Proposer une correction » ──────────────────────────────────────

test('A06-corriger — la feuille nomme LE GUIDE visé, pas celui de la maquette', async ({
  context,
  request,
  page,
}) => {
  await connecter(context, request, {});
  await poserCookie(context, request);
  await visiter(page, `/guides/${decor.slug}/corriger`, 390);

  const cadre = page.locator(CADRE(390));
  await expect(cadre.getByText(decor.titre, { exact: false }).first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(cadre.getByText('Obtenir la garantie Visale sans CDI')).toHaveCount(0);
});
