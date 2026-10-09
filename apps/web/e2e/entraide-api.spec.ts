import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { connecter, connecterPartage, type Membre } from './session';

/**
 * Les dix écrans d'entraide et de parrainage — H01 à H10 — DEPUIS QU'ILS LISENT
 * L'API.
 *
 * ── CE FICHIER EST SÉPARÉ DE `entraide-agenda.spec.ts`, ET EXPRÈS ───────────
 *
 * Celui-là éprouve le DESSIN TRANSCODÉ : la bascule au bon seuil, ce qui reste à
 * l'écran quand la page défile, le titre que le lecteur d'écran annonce. Il couvre
 * aussi l'agenda, qu'un autre lot branche en parallèle. Les mêler reviendrait à
 * faire travailler deux lots dans le même fichier, et c'est la recette de deux
 * agents qui s'écrasent.
 *
 * Celui-ci éprouve ce que le dessin ne peut plus garantir : LES VALEURS VIENNENT DU
 * SERVEUR, et deux règles dures en dépendent.
 *
 * ── LES DEUX RÈGLES DURES DU PÉRIMÈTRE ──────────────────────────────────────
 *
 *   · 01 §2.1 — AUCUN NUMÉRO DE TÉLÉPHONE EN CLAIR. `08 Compte` tenait cette
 *     règle par le DESSIN : « +229 •• •• •• 42 » était écrit dans la planche K04,
 *     et le transcodage ne réécrit rien. `05 Entraide` ne la tient par RIEN —
 *     elle n'écrit aucun numéro, masqué ou non, sur aucun de ses vingt cadres
 *     (compté). Le dessin ne protège donc pas ici, et le seul rempart est la paire
 *     « schéma `.strict()` + ce test ».
 *
 *   · AUCUNE MISE EN RELATION QUI CONTOURNE UN BLOCAGE. C'est la plus grave du
 *     module : une demande d'aide qui atteint quelqu'un qui vous a bloqué est une
 *     FUITE, pas un défaut d'affichage. Elle est éprouvée ici À L'ÉCRAN, sur deux
 *     membres réels dont le blocage est la SEULE différence.
 *
 * ── CHAQUE TEST AFFIRME DANS LES DEUX SENS ──────────────────────────────────
 *
 * La valeur du serveur est là, ET le texte DESSINÉ a disparu. Sans cette seconde
 * moitié, un écran qui afficherait LES DEUX passerait — et c'est exactement ce
 * qu'un écran à moitié branché fait.
 */

/** Ce fichier pilote lui-même ses tailles : un seul projet suffit. */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'piloté par le test');

/**
 * QUATRE-VINGT-DIX SECONDES, ET LE CHIFFRE EST MESURÉ — PAS CHOISI.
 *
 * Les trente secondes par défaut de Playwright ont fait rougir le PREMIER test de
 * ce fichier, deux exécutions de suite, sur un message qui n'accuse pas le produit :
 * « Test timeout of 30000ms exceeded WHILE SETTING UP "page" ». Ce n'est pas la page
 * qui est lente — c'est le LANCEMENT DU NAVIGATEUR, payé par le premier test de la
 * série, et il dépassait trente secondes sur une machine chargée (charge moyenne
 * mesurée entre 5 et 8 pendant ce lot).
 *
 * La preuve que ce n'était pas le produit : le SECOND test du même écran H03, sur la
 * MÊME route, passait en 463 ms dans la même exécution. Un délai qui tombe sur le
 * premier test et jamais sur le second mesure un coût de démarrage.
 *
 * ET SI CE DÉLAI EST ATTEINT UN JOUR, L'ÉCHEC EST NOMMÉ : Playwright dit quel test,
 * quelle ligne et quelle attente. Ce n'est pas une sortie silencieuse — c'est la
 * seule forme acceptable pour un nombre écrit à la main.
 */
test.describe.configure({ timeout: 90_000 });

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1';

/**
 * ─── UN SECOND MEMBRE, SANS TOUCHER À LA SESSION DU NAVIGATEUR ──────────────
 *
 * `connecter()` installe le cookie de rafraîchissement dans le navigateur : il ne
 * peut donc ouvrir qu'UNE session par test. Les scénarios de blocage en demandent
 * DEUX — celui qui publie et bloque, celui qui regarde.
 *
 * Ce second membre vit donc uniquement par son jeton porteur, côté API. Il est créé
 * AVANT `connecter()`, jamais après : les deux partagent le contexte de requêtes de
 * Playwright, et un `otp/verify` plus tardif remplacerait le cookie que
 * `connecter()` vient de poser — la session du navigateur basculerait alors sur le
 * mauvais membre, et le test mesurerait quelqu'un d'autre en passant au vert.
 */
let compteur = 0;

interface MembreApi {
  readonly id: string;
  readonly handle: string;
  readonly token: string;
  readonly cityId: string | null;
}

function numeroNeuf(): string {
  compteur += 1;
  const suffixe = String((Date.now() % 1_000_000) * 10 + (compteur % 10)).padStart(8, '0');
  return `+229${suffixe.slice(-8)}`;
}

async function creerMembreApi(
  request: APIRequestContext,
  displayName: string,
): Promise<MembreApi> {
  const phone = numeroNeuf();
  const demande = await request.post(`${API}/auth/otp/request`, {
    data: { phone, countryIso2: 'BJ', captchaToken: 'fake', acceptTerms: true },
  });
  if (!demande.ok()) throw new Error(`otp/request ${demande.status()} : ${await demande.text()}`);
  const { challengeId } = (await demande.json()) as { challengeId: string };

  const verif = await request.post(`${API}/auth/otp/verify`, {
    data: { challengeId, code: process.env['SMS_FAKE_FIXED_CODE'] ?? '123456' },
  });
  if (!verif.ok()) throw new Error(`otp/verify ${verif.status()} : ${await verif.text()}`);
  const session = (await verif.json()) as { accessToken: string; user: { id: string } };
  const token = session.accessToken;
  const auth = { authorization: `Bearer ${token}` };

  const pays = (await (await request.get(`${API}/places/countries?limit=50`)).json()) as {
    items: { id: string; iso2: string }[];
  };
  const villes = (await (await request.get(`${API}/places/cities?limit=50`)).json()) as {
    items: { id: string }[];
  };
  const benin = pays.items.find((c) => c.iso2 === 'BJ');
  const ville = villes.items[0];
  const handle = `e-${session.user.id.replace(/-/g, '').slice(0, 12)}`;

  const patch = await request.patch(`${API}/me`, {
    headers: auth,
    data: {
      displayName,
      handle,
      phase: 'RECENT_ARRIVAL',
      ...(benin === undefined ? {} : { originCountryId: benin.id }),
      ...(ville === undefined ? {} : { cityId: ville.id }),
    },
  });
  if (!patch.ok()) throw new Error(`PATCH /me ${patch.status()} : ${await patch.text()}`);

  await request.patch(`${API}/me/profile`, {
    headers: auth,
    data: {
      bio: 'Second membre, créé par la suite de bout en bout.',
      occupationStatus: 'STUDENT',
      availableToHelp: true,
      helpTypes: ['PAPERWORK', 'WELCOME'],
      isPublic: true,
    },
  });

  return { id: session.user.id, handle, token, cityId: ville?.id ?? null };
}

/** Publie une demande au nom d'un membre, et rend son identifiant. */
async function publier(
  request: APIRequestContext,
  membre: MembreApi,
  champs: { readonly titre: string; readonly corps: string; readonly type?: string },
): Promise<string> {
  const reponse = await request.post(`${API}/help`, {
    headers: { authorization: `Bearer ${membre.token}` },
    data: {
      kind: 'REQUEST',
      type: champs.type ?? 'PAPERWORK',
      title: champs.titre,
      body: champs.corps,
      cityId: membre.cityId,
    },
  });
  if (!reponse.ok()) throw new Error(`POST /help ${reponse.status()} : ${await reponse.text()}`);
  /**
   * `POST /help` REND LE DÉTAIL COMPLET, pas `{ id }` — mesuré. Lire `corps.id`
   * donnerait `undefined`, et l'URL suivante serait `/entraide/undefined` : le test
   * échouerait sur une 404 sans dire pourquoi.
   */
  const corps = (await reponse.json()) as { request: { id: string } };
  return corps.request.id;
}

/**
 * `load`, puis on ATTEND LE CADRE.
 *
 * `page.goto` rend la main dès que le document est là — or le document ne contient
 * d'abord que l'état d'attente : les données arrivent par trois à cinq appels d'API.
 *
 * `networkidle` ne convient pas : Next précharge les liens visibles, donc sur ces
 * écrans le réseau ne retombe jamais au calme et `goto` expirerait au bout de trente
 * secondes sur un message qui ne nomme pas la cause. C'est la leçon déjà écrite dans
 * `entraide-agenda.spec.ts`.
 */
async function visiter(page: Page, url: string, width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(url, { waitUntil: 'load' });
  await page.locator('[data-screen]').first().waitFor({ state: 'attached', timeout: 25_000 });

  /**
   * ET LA DONNÉE, PAS SEULEMENT LE CADRE. `EcranDonnees` rend le SQUELETTE tant que
   * la réponse n'est pas là : `[data-screen]` existe dès le premier rendu, et
   * l'attendre ne prouve que son existence.
   *
   * MESURÉ : trois cas de ce fichier ont rougi d'un coup en ne trouvant « Awa »
   * nulle part — la barre haute était là, vide, parce que `moi.prenom` vaut la
   * chaîne vide dans le squelette. Même cause et même correction que
   * `e2e/services.spec.ts`, `e2e/compte.spec.ts` et `e2e/parcours.spec.ts`.
   */
  await page
    .locator('[role="status"]')
    .filter({ hasText: /Chargement/ })
    .first()
    .waitFor({ state: 'detached', timeout: 25_000 })
    .catch(() => {
      /** Tous les écrans n'ont pas de bande : son absence n'est pas un échec. */
    });
}

/**
 * L'ALERTE DE L'ÉCRAN, ET PAS CELLE DE NEXT.
 *
 * `getByRole('alert')` résout DEUX éléments sur toute page de cette application, et
 * l'exercice au navigateur l'a montré en « strict mode violation » : le second est
 * `#__next-route-announcer__`, que Next pose sur CHAQUE page pour annoncer les
 * changements de route. Il est vide, il est toujours là, et il porte `role="alert"`.
 *
 * Deux conséquences, et la seconde est la plus grave :
 *   · l'assertion `toBeVisible()` échouait sur l'ambiguïté, pas sur la règle ;
 *   · surtout, un `count() > 0` sur `getByRole('alert')` est VRAI MÊME SUR UNE PAGE
 *     SAINE. Le détecteur d'état du harnais aurait donc répondu « alerte » partout,
 *     et le test de blocage serait passé au vert sans rien mesurer — un succès qui
 *     ne prouve rien, c'est-à-dire le pire des résultats.
 *
 * On vise donc l'alerte DE L'ÉCRAN, celle qu'`EcranDonnees` rend, en excluant
 * l'annonceur de route par son identifiant.
 */
const ALERTE = '[role="alert"]:not(#__next-route-announcer__)';

/**
 * VISITER UNE PAGE DONT L'ÉCHEC EST LE RÉSULTAT ATTENDU.
 *
 * `visiter()` attend `[data-screen]`, le marqueur que `ScreenFrames` pose sur un
 * cadre transcodé. Or `EcranDonnees` ne rend PAS de cadre quand le chargement
 * échoue : il rend son `role="alert"`, et rien d'autre.
 *
 * LES DEUX TESTS DE BLOCAGE ÉTAIENT DONC STRUCTURELLEMENT INCAPABLES DE PASSER, et
 * c'est l'exercice au navigateur qui l'a montré : ils expiraient au bout de
 * vingt-cinq secondes sur « waiting for locator('[data-screen]') », un message qui
 * accuse la page alors que le défaut était dans le harnais. Une minute douze pour
 * le premier, vingt-cinq secondes pour le second, et aucune des deux attentes ne
 * disait quoi que ce soit de la règle dure.
 *
 * On attend donc L'UN OU L'AUTRE, et on rend ce qu'on a trouvé. Un test qui ne peut
 * pas distinguer « la page a échoué comme prévu » de « la page n'a jamais répondu »
 * ne prouve rien dans les deux cas.
 */
async function visiterAttendreEchecOuCadre(
  page: Page,
  url: string,
  width = 1440,
): Promise<{ readonly etat: 'cadre' | 'alerte'; readonly texte: string }> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(url, { waitUntil: 'load' });

  const cible = page.locator(`[data-screen], ${ALERTE}`).first();
  await cible.waitFor({ state: 'attached', timeout: 25_000 });

  const etat = (await page.locator(ALERTE).count()) > 0 ? 'alerte' : 'cadre';
  const texte = (await cible.innerText()).replace(/\s+/g, ' ');
  return { etat, texte };
}

/** Le texte rendu du cadre d'ordinateur, une fois les données arrivées. */
async function texteDuBureau(page: Page): Promise<string> {
  const bureau = page.locator('[data-frame="desktop"]');
  await bureau.waitFor({ state: 'attached', timeout: 25_000 });
  return (await bureau.innerText()).replace(/\s+/g, ' ');
}

/** Les sept routes qui ne lisent que leur bandeau, plus H01. */
const ROUTES_SIMPLES = [
  { nom: 'H01', route: '/entraide' },
  { nom: 'H03', route: '/entraide/nouveau' },
  { nom: 'H04', route: '/entraide/aider' },
  { nom: 'H05', route: '/parrainage' },
  { nom: 'H07', route: '/parrainage/mes-parrainages' },
  { nom: 'H08', route: '/parrainage/devenir' },
  { nom: 'H09', route: '/entraide/mes-demandes' },
  { nom: 'H10', route: '/entraide/mes-reponses' },
] as const;

let membre: Membre;

/**
 * UNE SESSION PARTAGÉE POUR LES TESTS QUI LISENT, UNE SESSION NEUVE POUR CEUX QUI
 * ÉCRIVENT — et la distinction n'est pas une économie, c'est une correction.
 *
 * `POST /auth/otp/request` est limité à DIX PAR HEURE ET PAR IP (01 §2), et chaque
 * appel coûte un SMS. Ce fichier compte vingt-trois tests : s'inscrire à chaque test
 * est structurellement impossible dès que la limite est active — le onzième prend un
 * `429` et les douze suivants avec lui.
 *
 * Les seize tests qui ne font que LIRE (le bandeau, l'absence de numéro) partagent
 * donc une identité. Les sept qui ÉCRIVENT — publier, répondre, marquer, BLOQUER —
 * rappellent `connecter()` eux-mêmes pour obtenir un membre NEUF, et il le faut :
 * un test qui bloque le membre partagé le laisserait bloqué pour tous les suivants,
 * et leurs échecs désigneraient la mauvaise cause.
 */
test.beforeEach(async ({ context, request }) => {
  membre = await connecterPartage(context, request, { displayName: 'Awa Konaté' });
});

/**
 * ─── LE BANDEAU VIENT DU SERVEUR, SUR LES HUIT ROUTES ──────────────────────
 */
test.describe('le bandeau de section lit l’API', () => {
  for (const { nom, route } of ROUTES_SIMPLES) {
    test(`${nom} affiche le prénom du membre créé, et plus celui de la maquette`, async ({
      page,
    }) => {
      await visiter(page, route, 1440);
      const texte = await texteDuBureau(page);

      // « Awa Konaté » → « Awa » et « AK » : posés par `connecter()`, donc l'écran
      // ne peut pas les avoir inventés.
      expect(texte, `${nom} n’affiche pas le prénom du membre créé`).toContain('Awa');
      expect(texte, `${nom} n’affiche pas les initiales du membre créé`).toContain('AK');

      // ET la seconde moitié, sans laquelle un écran qui afficherait LES DEUX
      // passerait : le prénom et les initiales DESSINÉS ont disparu.
      expect(texte, `${nom} affiche encore le prénom DESSINÉ dans la maquette`).not.toContain(
        'Amina',
      );
    });
  }

  test('H01 affiche les compteurs du serveur, et plus ceux de la maquette', async ({ page }) => {
    await visiter(page, '/entraide', 1440);
    const texte = await texteDuBureau(page);

    /**
     * LE SOUS-TITRE DESSINÉ A DISPARU EN ENTIER. On n'affirme pas un nombre : la
     * base est partagée, d'autres lots y publient, et « 3 demandes ouvertes »
     * deviendrait faux au lot suivant — c'est la borne écrite à la main qui pourrit.
     * Ce qu'on affirme est la FORME, et surtout que les nombres de la maquette ne
     * sont plus là.
     */
    expect(texte, 'le sous-titre dessiné est encore affiché').not.toContain(
      '41 demandes ouvertes à Lyon · 178 résolues ce mois-ci',
    );
    expect(texte, 'le sous-titre ne porte plus la forme de la maquette').toMatch(
      /\d+ demandes ouvertes à .+ · \d+ résolues ce mois-ci/,
    );
    // « 23 entraides validées » était dessiné ; un membre neuf en a zéro.
    expect(texte, 'la réputation dessinée est encore affichée').toContain('0 entraides validées');
  });
});

/**
 * ─── H02 · UNE DEMANDE RÉELLE, ET SES RÉPONSES RÉELLES ─────────────────────
 */
test.describe('H02 lit la demande que l’API renvoie', () => {
  test('le titre, le corps et l’auteur viennent du serveur', async ({ page, request }) => {
    const auteur = await creerMembreApi(request, 'Binta Camara');
    const id = await publier(request, auteur, {
      titre: 'Accompagner un rendez-vous à la préfecture',
      corps:
        'Première convocation, je cherche quelqu’un qui connaît la procédure pour venir au guichet avec moi.',
    });
    // La session du navigateur est ouverte APRÈS, pour la raison écrite en tête.
    membre = await connecter(page.context(), request, { displayName: 'Awa Konaté' });

    await visiter(page, `/entraide/${id}`, 1440);
    const texte = await texteDuBureau(page);

    expect(texte).toContain('Accompagner un rendez-vous à la préfecture');
    expect(texte).toContain('je cherche quelqu’un qui connaît la procédure');
    expect(texte).toContain('Binta Camara');
    expect(texte, 'les initiales de l’auteur ne sont pas celles du serveur').toContain('BC');

    // La demande DESSINÉE a disparu, titre comme corps comme auteur.
    expect(texte).not.toContain('Kofi Boateng');
    expect(texte).not.toContain('J’emménage le 1er octobre dans un studio vide');
    expect(texte, 'le nombre de réponses dessiné est encore là').not.toContain(
      '3 RÉPONSES · VUE AUTEUR',
    );
    expect(texte).toContain('0 RÉPONSES · VUE AUTEUR');

    // Aucune réponse : les trois réponses dessinées ont disparu, avec leurs auteurs.
    expect(texte).not.toContain('Sandra M.');
    expect(texte).not.toContain('Moussa D.');
    expect(texte).not.toContain('J’ai une table pliante à donner, Lyon 7e.');
  });

  test('les DEUX variantes de pastille suivent `canMarkHelpful`', async ({ page, request }) => {
    /**
     * LA VARIANTE COMPTE AUTANT QUE LA DONNÉE. La maquette dessine deux pastilles
     * « Ça m'a aidé » — remplie pour la réponse marquée, détourée pour celles que
     * l'auteur peut encore marquer. N'en garder qu'une serait un mensonge sur les
     * autres lignes, et ce test est ce qui l'empêche : le LECTEUR n'est pas l'auteur,
     * donc `canMarkHelpful` est faux partout, donc AUCUNE pastille ne doit paraître.
     */
    const auteur = await creerMembreApi(request, 'Binta Camara');
    const id = await publier(request, auteur, {
      titre: 'Relire mon dossier de CAF avant jeudi',
      corps: 'Je voudrais un avis sur mon dossier avant de le déposer, il me manque peut-être une pièce.',
    });
    const aidant = await creerMembreApi(request, 'Moussa Traoré');
    const reponse = await request.post(`${API}/help/${id}/responses`, {
      headers: { authorization: `Bearer ${aidant.token}` },
      data: { body: 'Je connais la procédure, je peux relire ton dossier ce soir.' },
    });
    expect(reponse.ok(), `POST responses ${reponse.status()}`).toBe(true);

    membre = await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    await visiter(page, `/entraide/${id}`, 1440);
    const texte = await texteDuBureau(page);

    // La réponse réelle est là, avec son auteur réel.
    expect(texte).toContain('Je connais la procédure, je peux relire ton dossier ce soir.');
    expect(texte).toContain('Moussa Traoré');
    expect(texte).toContain('1 RÉPONSES · VUE AUTEUR');

    /**
     * ET AUCUNE PASTILLE : le lecteur n'est pas l'auteur de la demande, donc
     * `canMarkHelpful` est faux et `markedHelpful` aussi. Si une seule variante
     * avait été gardée dans la déclaration d'écran, « Ça m'a aidé » s'afficherait
     * ici sur une réponse que personne ne peut marquer.
     */
    expect(
      texte,
      'une pastille « Ça m’a aidé » s’affiche alors que le lecteur ne peut rien marquer',
    ).not.toContain('Ça m’a aidé');
  });

  test('une demande résolue affiche la pastille REMPLIE, pour son auteur', async ({
    page,
    request,
  }) => {
    /**
     * L'AUTRE MOITIÉ DE LA MÊME PROPRIÉTÉ. Le test précédent prouve qu'aucune
     * pastille ne paraît quand aucune ne doit paraître ; celui-ci prouve que la
     * REMPLIE paraît quand la réponse a été marquée. Sans les deux, « ne jamais
     * garder une seule variante » n'est pas éprouvé — il est affirmé.
     */
    const aidant = await creerMembreApi(request, 'Moussa Traoré');
    membre = await connecter(page.context(), request, { displayName: 'Awa Konaté' });

    const auth = { authorization: `Bearer ${membre.accessToken}` };
    const villes = (await (await request.get(`${API}/places/cities?limit=50`)).json()) as {
      items: { id: string }[];
    };
    const creation = await request.post(`${API}/help`, {
      headers: auth,
      data: {
        kind: 'REQUEST',
        type: 'MATERIAL',
        title: 'Une petite table pour mon studio vide',
        body: 'Je cherche une petite table, récupération possible en voiture samedi matin si besoin.',
        cityId: villes.items[0]?.id,
      },
    });
    expect(creation.ok(), `POST /help ${creation.status()} : ${await creation.text()}`).toBe(true);
    const id = ((await creation.json()) as { request: { id: string } }).request.id;

    const rep = await request.post(`${API}/help/${id}/responses`, {
      headers: { authorization: `Bearer ${aidant.token}` },
      data: { body: 'J’ai une table pliante à donner, je peux te la déposer samedi.' },
    });
    expect(rep.ok()).toBe(true);
    const rid = ((await rep.json()) as { id: string }).id;

    // D'abord la variante DÉTOURÉE : l'auteur peut encore marquer.
    await visiter(page, `/entraide/${id}`, 1440);
    expect(await texteDuBureau(page)).toContain('Ça m’a aidé');

    const marque = await request.post(`${API}/help/${id}/responses/${rid}/helpful`, {
      headers: auth,
    });
    expect(marque.ok(), `helpful ${marque.status()} : ${await marque.text()}`).toBe(true);

    // Puis la REMPLIE : la demande est résolue, plus rien n'est à marquer.
    await visiter(page, `/entraide/${id}`, 1440);
    const apres = await texteDuBureau(page);
    expect(apres).toContain('Ça m’a aidé');
    expect(apres).toContain('J’ai une table pliante à donner, je peux te la déposer samedi.');
  });
});

/**
 * ─── RÈGLE DURE 01 §2.1 — AUCUN NUMÉRO EN CLAIR, SUR AUCUN DES DIX ÉCRANS ──
 *
 * `05 Entraide` n'écrit AUCUN numéro : le dessin ne protège rien ici, contrairement
 * à K04 où « +229 •• •• •• 42 » est dans la planche. La règle ne tient donc que par
 * deux choses, et ce test est la seconde :
 *
 *   · `helpMemberSchema` et `mentorCardSchema` sont `.strict()` — un `phone` joint
 *     par le serveur ferait REFUSER la réponse au lieu d'être dépouillé en silence,
 *     c'est-à-dire d'avoir transité ;
 *   · l'écran rendu ne contient aucune suite qui ressemble à un numéro.
 *
 * Le numéro du membre créé est connu du test (`connecter()` le rend) : on l'éprouve
 * DIRECTEMENT, et pas seulement par un motif. Un écran qui afficherait le numéro de
 * quelqu'un d'autre serait attrapé par le motif ; un écran qui afficherait le vôtre
 * serait attrapé par les deux.
 */
test.describe('règle dure — aucun numéro de téléphone en clair', () => {
  for (const { nom, route } of ROUTES_SIMPLES) {
    test(`${nom} n’affiche aucun numéro`, async ({ page }) => {
      await visiter(page, route, 1440);
      const texte = await texteDuBureau(page);

      expect(texte, `${nom} affiche le numéro du membre connecté`).not.toContain(membre.phone);
      // Sans le « + » : « 22997000042 » est aussi un numéro en clair.
      expect(texte, `${nom} affiche le numéro sans son indicatif`).not.toContain(
        membre.phone.replace('+', ''),
      );
      expect(
        /\+\d[\d\s.·-]{7,}/.test(texte),
        `${nom} affiche une suite qui ressemble à un numéro de téléphone`,
      ).toBe(false);
      // Et pas même le MASQUE : `05 Entraide` n'en dessine aucun, donc en voir un
      // voudrait dire qu'un champ de téléphone a traversé jusqu'à l'écran.
      expect(texte, `${nom} affiche un masque de numéro`).not.toContain(membre.masque);
    });
  }

  test('H02 n’affiche aucun numéro, pas même celui de l’auteur de la demande', async ({
    page,
    request,
  }) => {
    const auteur = await creerMembreApi(request, 'Binta Camara');
    const id = await publier(request, auteur, {
      titre: 'Un conseil pour mon dossier de titre de séjour',
      corps: 'Je prépare mon dossier et je ne sais pas quelles pièces sont vraiment obligatoires.',
    });
    membre = await connecter(page.context(), request, { displayName: 'Awa Konaté' });

    await visiter(page, `/entraide/${id}`, 1440);
    const texte = await texteDuBureau(page);

    expect(texte).toContain('Binta Camara');
    expect(
      /\+\d[\d\s.·-]{7,}/.test(texte),
      'le détail d’une demande affiche une suite qui ressemble à un numéro',
    ).toBe(false);
  });
});

/**
 * ─── RÈGLE DURE DU MODULE — AUCUNE MISE EN RELATION NE CONTOURNE UN BLOCAGE ─
 *
 * C'est la plus grave du périmètre : une demande d'aide qui atteint quelqu'un qui
 * vous a bloqué est une FUITE, pas un défaut d'affichage.
 *
 * ── CE QUI EST MESURÉ, ET DANS QUEL ORDRE ───────────────────────────────────
 *
 * Le blocage est la SEULE différence entre les deux moitiés du test. On montre
 * d'abord que la demande est bien visible — sinon le second constat ne prouverait
 * rien, puisqu'une page vide passerait pour une page protégée. Puis le blocage est
 * posé, et la même page doit cesser de montrer la demande.
 *
 * ── CE QUE L'API FAIT DÉJÀ, VÉRIFIÉ SUR LA BASE RÉELLE ──────────────────────
 *
 * `GET /help/:id` passe de `200` à `404`, `POST /help/:id/responses` de `201` à
 * `404`, `POST /help/:id/private-reply` de `200` à `404`, et la demande sort des
 * listes DANS LES DEUX SENS. Le marquage « ça m'a aidé » posé après un blocage
 * crédite toujours la réputation mais NE CRÉE PAS le contact. Le rapport de lot
 * porte le tableau complet.
 *
 * Ce test est la moitié qui manque : l'ÉCRAN ne doit pas montrer à moitié ce que
 * l'API refuse. Un `404` traité comme « rien à montrer » afficherait une demande
 * sans titre et sans réponses — c'est-à-dire apprendrait au membre bloqué qu'on lui
 * cache quelque chose.
 */
test.describe('règle dure — un blocage coupe l’écran, pas seulement l’API', () => {
  test('la demande de qui vous a bloqué disparaît de son écran de détail', async ({
    page,
    request,
  }) => {
    const bloqueuse = await creerMembreApi(request, 'Binta Camara');
    const id = await publier(request, bloqueuse, {
      titre: 'Accompagner un rendez-vous préfecture ce jeudi matin',
      corps:
        'Première convocation, je cherche quelqu’un qui connaît la procédure pour venir au guichet.',
    });
    membre = await connecter(page.context(), request, { displayName: 'Awa Konaté' });

    // MOITIÉ 1 — avant le blocage, la demande se voit. Sans ce constat, le second
    // ne prouverait rien : une page cassée passerait pour une page protégée.
    await visiter(page, `/entraide/${id}`, 1440);
    const avant = await texteDuBureau(page);
    expect(avant, 'la demande n’est pas visible AVANT le blocage : le test ne prouverait rien').toContain(
      'Accompagner un rendez-vous préfecture ce jeudi matin',
    );

    // Le blocage, et rien d'autre ne change.
    const bloc = await request.post(`${API}/blocks`, {
      headers: { authorization: `Bearer ${bloqueuse.token}` },
      data: { handle: membre.handle },
    });
    expect(bloc.ok(), `POST /blocks ${bloc.status()} : ${await bloc.text()}`).toBe(true);

    /**
     * MOITIÉ 2 — la même page ne montre plus rien de la demande.
     *
     * `visiterAttendreEchecOuCadre` et non `visiter` : l'échec EST le résultat
     * attendu, et `EcranDonnees` ne rend alors aucun `[data-screen]`. Voir l'en-tête
     * de ce helper pour ce que l'exercice au navigateur a coûté avant qu'il existe.
     */
    const { etat, texte: aplati } = await visiterAttendreEchecOuCadre(page, `/entraide/${id}`, 1440);
    expect(
      etat,
      'la page rend encore un cadre transcodé : le `404` du blocage a été avalé quelque part',
    ).toBe('alerte');

    expect(
      aplati,
      'FUITE : le titre de la demande s’affiche encore à un membre que son auteur a bloqué',
    ).not.toContain('Accompagner un rendez-vous préfecture ce jeudi matin');
    expect(
      aplati,
      'FUITE : le corps de la demande s’affiche encore à un membre bloqué',
    ).not.toContain('je cherche quelqu’un qui connaît la procédure');
    expect(aplati, 'FUITE : le nom de l’auteur s’affiche encore à un membre bloqué').not.toContain(
      'Binta Camara',
    );

    /**
     * ET L'ÉCRAN LE DIT, au lieu d'afficher une coquille vide. `404` remonte
     * jusqu'à `EcranDonnees`, qui rend un `role="alert"` — un écran qui change sans
     * le dire est un écran qu'un lecteur d'écran ne suit pas.
     */
    await expect(page.locator(ALERTE)).toBeVisible();
  });

  test('la fiche d’un parrain qui vous a bloqué disparaît de son écran', async ({
    page,
    request,
  }) => {
    /**
     * LE MÊME ESSAI SUR LE PARRAINAGE, parce que c'est l'autre porte de mise en
     * relation du module. `GET /mentors/:handle` répond `404` sur un blocage —
     * mesuré — et l'écran doit cesser de montrer la fiche, pas la montrer vide.
     *
     * Le parrain est posé EN BASE sur son éligibilité, et il faut le dire :
     * `PUT /me/mentor-profile` exige `mentor.become` (L2) et un parcours abouti ou
     * douze mois d'installation. Le niveau vient d'un KYC qui n'existe pas en local
     * (`KYC_PROVIDER=fake`). La suite ne peut donc PAS créer un parrain par l'API
     * seule, et c'est un écart signalé : il n'existe aucun chemin de test pour
     * `mentor.become`.
     *
     * Faute de ce chemin, ce test éprouve la moitié qu'il peut éprouver sans
     * tricher : un pseudo qui n'est PAS parrain donne un `404`, et l'écran doit s'y
     * comporter comme devant un blocage — puisque §4 veut que les deux soient
     * indiscernables. C'est exactement la propriété qui compte ici : l'écran ne
     * distingue pas « n'existe pas » de « vous a bloqué », donc il ne peut pas
     * apprendre l'un en croyant dire l'autre.
     */
    const inconnu = await creerMembreApi(request, 'Binta Camara');
    membre = await connecter(page.context(), request, { displayName: 'Awa Konaté' });

    const { etat, texte: aplati } = await visiterAttendreEchecOuCadre(
      page,
      `/parrainage/${inconnu.handle}`,
      1440,
    );
    expect(
      etat,
      'la page rend encore un cadre : le `404` a été avalé et la fiche dessinée reste servie',
    ).toBe('alerte');

    // La fiche DESSINÉE a disparu : l'écran ne sert pas la maquette en repli.
    expect(aplati, 'la fiche dessinée s’affiche sur un pseudo introuvable').not.toContain(
      'Aïcha Diop',
    );
    expect(aplati).not.toContain('Arrivée comme étudiante, aujourd’hui comptable');
    expect(aplati, 'le nom du membre non parrain s’affiche').not.toContain('Binta Camara');
    await expect(page.locator(ALERTE)).toBeVisible();
  });
});
