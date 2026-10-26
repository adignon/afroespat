import { expect, test, type Page } from '@playwright/test';
import { connecter } from './session';
import { ouvrirConversationBloquee } from './aide-w5a';

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
 *
 * ── CE FICHIER A CHANGÉ DE MONDE, ET IL FAUT SAVOIR POURQUOI ───────────────
 *
 * Il disait, et c'était exact : « ces écrans n'émettent AUCUNE requête — la
 * maquette est statique et ce lot ne branche pas l'API ». Ce n'est plus vrai.
 * M01, X01 et X02 lisent désormais `GET /conversations`,
 * `GET /conversations/:id/messages`, `GET /search`, `GET /search/suggest` et
 * `GET /notifications`.
 *
 * CONSÉQUENCE MESURÉE, et elle a fait rougir 35 tests d'un coup : sans session, ces
 * écrans n'affichent plus que « Chargement… » puis une invitation à se reconnecter.
 * `[data-screen]` n'apparaît jamais, et l'échec dit « element(s) not found » sans
 * nommer la cause. Un test de ce fichier qui passerait SANS session mesurerait
 * désormais l'écran d'erreur en croyant mesurer l'écran.
 *
 * D'où `connecter()` avant chaque test, et une attente explicite de la fin du
 * chargement dans `visiter`. Les deux sont des nécessités, pas des rites.
 *
 * ⚠ CE QUE CELA COÛTE, ET C'EST À REMONTER : `POST /auth/otp/request` porte
 * `@RateLimit(10)` À L'HEURE ET PAR ROUTE. Ce fichier ouvre une session par test ;
 * au-delà de dix, le onzième prend un `429` annonçant près d'une heure d'attente.
 * `e2e/messagerie-donnees.spec.ts` montre l'échappatoire — un seul contexte et une
 * seule page pour tout le fichier — mais l'appliquer ici demanderait de réécrire
 * trente tests qui prennent `page` en fixture. Signalé : la suite de bout en bout
 * de ce dépôt a besoin soit d'une session partagée par fichier, soit d'un plafond
 * desserré pour les tests.
 */

/** Ce fichier pilote lui-même ses tailles : un seul projet suffit. */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'piloté par le test');

/**
 * LA SESSION EST OUVERTE AVANT CHAQUE TEST, et c'est une nécessité, pas un rite.
 *
 * Voir l'en-tête : sans elle, les écrans branchés de ce module n'affichent qu'un
 * état d'attente puis une invitation à se reconnecter.
 */
test.beforeEach(async ({ context, request }) => {
  await connecter(context, request, { displayName: 'Awa Traoré' });
});

/**
 * `load`, PUIS on attend que l'état d'attente soit parti.
 *
 * `networkidle` ne convient toujours pas — Next précharge les liens visibles, donc
 * le réseau ne retombe jamais au calme et l'attente expire sur un message qui ne
 * nomme pas la cause. Mais `load` seul ne suffit plus : le document ne contient
 * d'abord que le squelette, et les données arrivent par deux à trois appels dont le
 * premier prend un `401` que le socle rafraîchit puis rejoue.
 *
 * On attend donc le CADRE, qui n'est monté qu'une fois les données là.
 */
async function visiter(page: Page, url: string, width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: width < 1024 ? 844 : 900 });
  await page.goto(url, { waitUntil: 'load' });
  await page.locator('[data-screen]').first().waitFor({ state: 'attached', timeout: 20_000 });
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
    /**
     * Sur téléphone, la conversation est une PAGE À PART : son titre est celui de
     * la conversation (08 §8).
     *
     * CE TITRE EST DEVENU UNE DONNÉE, et c'est ce qui a fait tomber ce test. Il
     * attendait « Mes études à Lyon » — le titre que la MAQUETTE dessine — alors
     * qu'il vaut maintenant `entete.nom`, c'est-à-dire le titre du parcours ou le
     * nom de l'interlocuteur. Un membre neuf n'a aucune conversation, et `/messages/1`
     * ne nomme d'ailleurs pas un UUID : le chargeur retombe sur « Messages ».
     *
     * Corriger l'attente plutôt que le code est ici le bon sens — le test
     * cherchait le nom DESSINÉ, donc il passait sans session et échouait avec.
     * `e2e/messagerie-donnees.spec.ts` éprouve, lui, que ce titre suit bien la
     * donnée.
     */
    mobile: 'Messages',
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
  /**
   * `/recherche` N'A TOUJOURS PAS DE TITRE MOBILE — mais son titre d'ORDINATEUR est
   * devenu une DONNÉE : il porte `meta.q`, la requête telle que le serveur l'a
   * comprise. Sans `?q=`, il n'y a pas de requête, et le titre se réduit à ses
   * guillemets. C'est exact, et c'est ce que la page doit montrer : inventer
   * « visale » faute de requête serait réafficher la maquette.
   *
   * L'URL porte donc la requête ici, pour que ce test mesure l'écran et non le vide.
   */
  {
    url: '/recherche?q=visale',
    ecran: 'X01',
    ordinateur: 'Résultats pour « visale »',
    // VAGUE 5 — la planche mobile de la recherche porte maintenant son titre en <h1>.
    mobile: 'Résultats pour « visale »',
  },
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

    /**
     * ╔══════════════════════════════════════════════════════════════════════╗
     * ║ LA SONDE LISAIT DES `<span>` QUI SONT DEVENUS DES LIENS             ║
     * ╚══════════════════════════════════════════════════════════════════════╝
     *
     * Elle cherchait `> span`, parce que la maquette dessine les cinq entrées du
     * rail en `<span>` — « ce ne sont pas des liens cassés : CE NE SONT PAS DES
     * LIENS », dit `tools/squelette-membre.mjs`. Le lot de navigation les a
     * promues en `<a>` pour qu'elles mènent quelque part. La sonde rendait donc un
     * tableau VIDE, et ce cas rougissait en disant « Messages est dans le rail »
     * alors qu'il n'y est pas.
     *
     * UN CAS QUI ROUGIT POUR UNE FAUSSE RAISON EST PIRE QU'UN CAS ABSENT : il
     * garde une règle dure de §5.1 — « la messagerie n'est pas une entrée de
     * navigation » — et personne ne le croit plus.
     *
     * Il lit maintenant les ENFANTS DIRECTS, quelle que soit leur balise : c'est
     * la question posée (« qu'y a-t-il dans ce rail ? »), et elle ne dépend plus
     * de la façon dont chaque entrée est balisée. Les enfants sans texte — le
     * ressort du bas, le bouton de réglages qui n'a qu'une icône — sont écartés
     * par le filtre qui existait déjà.
     */
    const entrees = await rail.locator('> *').allInnerTexts();
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
    /**
     * MÊME CORRECTION QU'AU-DESSUS, et la même cause : quatre des cinq lignes de
     * la barre basse ont été promues en `<a>` par le lot de navigation, et la
     * cinquième — « Compte » — est restée un `<div>` parce qu'aucune route
     * `/compte` n'existe (refus motivé dans `tools/squelette-membre.mjs`). La
     * sonde ne voyait donc QUE « Compte », c'est-à-dire la seule entrée morte.
     */
    expect(
      (await onglets.locator('> *').allInnerTexts()).filter((t) => t.trim() !== ''),
    ).toEqual([
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

    /**
     * La conversation est ouverte DANS le même cadre : c'est ce qui fait les
     * « deux volets ».
     *
     * CE QU'ON MESURE A CHANGÉ, et pas par commodité. Le test cherchait
     * « Parcours · Aïcha (parraine), Moussa, Fanta » — le sous-titre DESSINÉ, qui
     * est devenu `entete.sousTitre`. Le chercher encore reviendrait à exiger que
     * l'écran affiche la maquette, c'est-à-dire l'inverse de ce qu'on veut.
     *
     * Ce qui prouve les deux volets, c'est le COMPOSEUR : il n'appartient qu'au
     * volet de conversation, et la maquette ne le dessine pas dans la liste.
     *
     * `getByPlaceholder` ET PLUS `getByText` : ce n'est plus du dessin. Le
     * porteur : « L'envoi de message aussi ne marche pas ainsi que les images
     * dans une conversation » — l'invite « Écrire un message… » était le TEXTE
     * d'un `<div>` ; elle est devenue le `placeholder` d'un vrai champ. Le mot
     * est le même, il a changé de place, et ce cas suit la correction au lieu de
     * se mettre au rouge dessus.
     */
    await expect(page.locator(ORDINATEUR).getByPlaceholder('Écrire un message…')).toBeVisible();
  });

  test('sur téléphone, /messages montre la LISTE et /messages/:id la CONVERSATION', async ({
    page,
  }) => {
    await visiter(page, '/messages', 390);
    /**
     * La liste porte la section « Demandes » (08 §5.2, premiers messages non
     * acceptés). SON COMPTEUR EST DEVENU UNE DONNÉE : il vaut le nombre de
     * conversations `pendingForMe`, donc zéro pour un membre neuf — et non plus
     * le « 2 » que la maquette dessine. C'est l'ÉTIQUETTE qui reste du dessin,
     * et c'est elle qui distingue la liste de la conversation.
     */
    await expect(page.locator(MOBILE).getByText('DEMANDES ·')).toBeVisible();
    await expect(page.locator(MOBILE).getByText('DEMANDES · 2')).toHaveCount(0);
    /** Même raison que sur l'ordinateur : l'invite est un `placeholder`, pas du texte. */
    await expect(page.locator(MOBILE).getByPlaceholder('Message…')).toHaveCount(0);

    await visiter(page, '/messages/1', 390);
    // La conversation porte le champ de saisie, et plus la liste.
    await expect(page.locator(MOBILE).getByPlaceholder('Message…')).toBeVisible();
    await expect(page.locator(MOBILE).getByText('DEMANDES ·')).toHaveCount(0);
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
  /**
   * ⚠ CE TEST A CHANGÉ DE NATURE, ET C'EST LE POINT LE PLUS IMPORTANT DU FICHIER.
   *
   * Il figeait les CINQ LIGNES DESSINÉES et en déduisait la règle : « aucune n'est
   * un message, donc 12 §2.1 est respecté ». C'était vrai, et ce ne l'est plus —
   * non parce que la règle a changé, mais parce que la PREUVE a cessé d'en être une.
   * Les lignes ne sont plus dessinées, elles sont LUES : une notification de
   * catégorie MESSAGE peut désormais arriver ici, et le back en produit.
   *
   * Laisser ce test tel quel aurait été le pire des cas : vert, et gardant une règle
   * qu'il n'éprouvait plus. On le réécrit donc sur ce qu'il peut encore prouver — la
   * liste vient du serveur — et LA RÈGLE elle-même est éprouvée là où elle se tient
   * maintenant, à la frontière :
   *
   *   · `packages/shared/src/__tests__/messagerie-responses.test.ts` — une
   *     notification MESSAGE portant un corps est REFUSÉE. Vérifié par mutation :
   *     retirer le `refine` de `notificationSchema` fait rougir ce test, et lui seul.
   *
   * La preuve par l'absence ci-dessous reste utile, et elle est forte : si la liste
   * cessait d'être liée, les cinq lignes de la maquette reviendraient d'un coup.
   */
  test('les cinq lignes de la maquette ont disparu : la liste vient du serveur', async ({
    page,
  }) => {
    await visiter(page, '/notifications', 1440);

    for (const dessinee of NOTIFICATIONS) {
      // Le texte est coupé en deux par le `<strong>` : on cherche chaque moitié.
      const titre = dessinee.split(' ').slice(0, 2).join(' ');
      await expect(page.locator(ORDINATEUR).getByText(titre, { exact: false })).toHaveCount(0);
    }
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
    // « Tout marquer lu » est un bouton (il écrit : `POST /notifications/read-all`), plus un lien.
    await expect(cadre.getByText('Tout marquer lu', { exact: true })).toBeVisible();

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
    /**
     * VAGUE 5 — LA MENTION N'EST PLUS UNIVERSELLE, PAR CHOIX DE PRODUIT
     * (`screens/messages/data.ts`, `SignalementVue.note`) : « La conversation sera visible
     * des modérateurs. » ne vaut que pour le signalement d'UN MESSAGE ; signaler le membre
     * (menu de la conversation, `?feuille=signaler`) reçoit la phrase neutre du cadre. Le
     * cas exige donc la phrase neutre, et l'ABSENCE de la mention hors message — la dire
     * à tort serait une fausse promesse de transparence.
     */
    await expect(
      page.getByRole('dialog').getByText('Votre signalement sera examiné par l’équipe de modération.'),
    ).toBeVisible();
    await expect(
      page.getByRole('dialog').getByText('La conversation sera visible des modérateurs.'),
    ).toHaveCount(0);
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
      .getByText('Votre signalement sera examiné par l’équipe de modération.')
      .click();
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await page.locator('[data-modal-overlay]').click({ position: { x: 5, y: 5 } });
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  /**
   * ── LA CROIX DE LA CONFIRMATION EST UN EMPRUNT ─────────────────────────────
   *
   * La maquette ne dessine AUCUNE fermeture sur la planche de confirmation — ni
   * croix ni poignée. Celle qui s'y trouve désormais est recopiée mot pour mot de
   * la fenêtre « Signaler », MÊME maquette, MÊME section X03, qui en porte une.
   * Voir `CROIX_DE_X03` dans `tools/screens/09-messages.mjs`, et le garde-fou de
   * `applyBorrows` qui refuse de générer si ce motif disparaît de X03.
   *
   * CE QUE CE TEST MESURE, c'est que l'emprunt est le MÊME OBJET que l'original :
   * même rôle, même nom accessible, même géométrie de 40 × 40 px. Une croix
   * « inspirée de » se verrait ici — elle n'aurait pas exactement ces mesures.
   */
  test('?feuille=merci — la croix empruntée à « Signaler » ferme la confirmation', async ({
    page,
  }) => {
    await visiter(page, '/messages/1?feuille=merci', 1440);
    const boite = page.getByRole('dialog', { name: 'Merci.' });
    await expect(boite).toBeVisible();
    await expect(boite.getByText('Nous regardons sous 24 heures.')).toBeVisible();

    const croix = boite.getByRole('button', { name: 'Fermer' });
    await expect(croix).toHaveCount(1);
    const ici = await croix.boundingBox();
    expect(ici).not.toBeNull();

    // La MÊME croix, dans la fenêtre d'où elle est empruntée : mêmes mesures.
    await visiter(page, '/messages/1?feuille=signaler', 1440);
    const origine = await page
      .getByRole('dialog', { name: 'Signaler' })
      .getByRole('button', { name: 'Fermer' })
      .boundingBox();
    expect(origine).not.toBeNull();
    if (ici === null || origine === null) return;
    expect(
      { w: Math.round(ici.width), h: Math.round(ici.height) },
      'la croix empruntée a la géométrie de son original',
    ).toEqual({ w: Math.round(origine.width), h: Math.round(origine.height) });

    await visiter(page, '/messages/1?feuille=merci', 1440);
    await expect(boite.getByRole('button', { name: 'Fermer' })).toBeFocused();
    await boite.getByRole('button', { name: 'Fermer' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('?feuille=merci — Échap et le voile referment aussi', async ({ page }) => {
    await visiter(page, '/messages/1?feuille=merci', 1440);
    await expect(page.getByRole('dialog', { name: 'Merci.' })).toBeVisible();
    // Le focus est entré dans la boîte (la croix) : Échap lui parvient.
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Fermer' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await visiter(page, '/messages/1?feuille=merci', 1440);
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.locator('[data-modal-overlay]').click({ position: { x: 5, y: 5 } });
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('une feuille inconnue n’ouvre rien', async ({ page }) => {
    await visiter(page, '/messages/1?feuille=nimporte-quoi', 1440);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

/**
 * ── M01 · LA CONVERSATION AVEC UN MEMBRE BLOQUÉ ──────────────────────────────
 *
 * AUCUNE MAQUETTE NE DESSINE CET ÉTAT. Sa forme est EMPRUNTÉE — le bandeau de la
 * carte « DEMANDE EN ATTENTE » (section M01) et le bouton « Débloquer » de la carte
 * « BLOQUÉS » de K05 (`08 Compte`) — et sa PHRASE vient du porteur, pas d'une
 * planche. Voir `CONVERSATION_BLOQUEE` dans `tools/screens/09-messages.mjs`.
 *
 * LA RÈGLE DURE QUE CES TESTS TIENNENT : dans cet état, LE COMPOSEUR N'EST PAS
 * ATTEIGNABLE. Pas de zone de saisie, pas de bouton d'envoi, rien où écrire. C'est
 * la seule chose qu'un écran peut trahir tout seul ici : un bandeau ajouté au-dessus
 * d'un composeur toujours là aurait l'air juste et ne tiendrait rien.
 */

/**
 * CE QUE « UN COMPOSEUR » VEUT DIRE, mesuré et non supposé.
 *
 * La maquette ne dessine AUCUN vrai champ : l'invite est un `<div>` et le rond
 * d'envoi un `<span>`. Chercher `input, textarea` ne prouverait donc rien — le
 * compte serait à zéro même avec le composeur bien en place, et le test serait creux.
 *
 * On mesure les trois choses qui FONT le composeur dans cette maquette :
 *   · l'invite, à son texte exact (« Message… » / « Écrire un message… ») ;
 *   · le rond d'envoi, à son fond `#16785E`, son rayon de 999 px ET le tracé de sa
 *     flèche ;
 *   · tout élément réellement saisissable, au cas où un lot en ajouterait un.
 *
 * LE TRACÉ DE LA FLÈCHE N'EST PAS UN LUXE. Sans lui, la sonde comptait DEUX ronds
 * verts de plus dans le cadre d'ordinateur — le vert d'action sert aussi ailleurs
 * dans cette planche — et le test échouait sur une conversation pourtant bien
 * bloquée. C'est le même piège que le `</svg>` des déclencheurs : une couleur ne
 * désigne pas un contrôle, un tracé si.
 *
 * La sonde est appliquée AUX DEUX ÉTATS dans le même test : zéro sur la conversation
 * bloquée, non nul sur la conversation ordinaire. Un test qui ne vérifierait que le
 * zéro passerait au vert si la sonde cessait de trouver quoi que ce soit.
 */
const FLECHE_ENVOI = 'M5 12h14m-6-6 6 6-6 6';

async function composeur(page: Page, cadre: string): Promise<number> {
  return page.evaluate(
    ([selecteurCadre, fleche]) => {
      const frame = document.querySelector(selecteurCadre as string);
      if (frame === null) return -1;
      let trouve = 0;
      for (const el of Array.from(frame.querySelectorAll<HTMLElement>('*'))) {
        const s = getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden') continue;
        /**
         * ╔══════════════════════════════════════════════════════════════════╗
         * ║ LA RECHERCHE DE LA BARRE HAUTE N'EST PAS UNE FAÇON D'ÉCRIRE     ║
         * ╚══════════════════════════════════════════════════════════════════╝
         *
         * Cette sonde compte TOUT `<input>` du cadre comme « une façon d'écrire au
         * membre bloqué ». C'était exact tant que le cadre n'en contenait qu'un
         * seul : celui du composeur. La barre haute en a reçu un — son champ de
         * recherche était un `<div>` de texte en dur — et la sonde l'a compté,
         * donc ce cas annonçait qu'on pouvait écrire à un membre bloqué alors que
         * le composeur est bien retiré.
         *
         * `form[role="search"]` est le conteneur que `ChampRecherche` rend, et il
         * dit ce qu'il est : une zone de recherche, pas un composeur de message.
         */
        if (el.closest('form[role="search"]') !== null) continue;
        const texte = (el.textContent ?? '').trim();
        if (el.children.length === 0 && (texte === 'Message…' || texte === 'Écrire un message…')) {
          trouve += 1;
          continue;
        }
        // Le rond d'envoi : le vert d'action, en pastille, AUTOUR de sa flèche.
        if (
          s.backgroundColor === 'rgb(22, 120, 94)' &&
          s.borderRadius.startsWith('999px') &&
          el.querySelector(`path[d="${fleche as string}"]`) !== null
        ) {
          trouve += 1;
          continue;
        }
        const tag = el.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable) trouve += 1;
      }
      return trouve;
    },
    [cadre, FLECHE_ENVOI] as const,
  );
}

test.describe('M01 — la conversation avec un membre bloqué', () => {
  /**
   * VAGUE 5 — `?etat=bloque` SUR `/messages/1` N'EXISTE PLUS. L'état « conversation bloquée »
   * est dérivé du serveur (`blockedByMe`) : le décor est celui du produit — deux membres, une
   * conversation, un blocage (`ouvrirConversationBloquee`). Le cas prouve donc que le
   * composeur disparaît pour un blocage RÉEL.
   */
  for (const [largeur, cadre] of [
    [1440, ORDINATEUR],
    [390, MOBILE],
  ] as const) {
    test(`${largeur} px — un blocage réel retire le composeur, et sans lui il est bien là`, async ({
      page,
      context,
      request,
      browser,
    }) => {
      const { conversationId } = await ouvrirConversationBloquee(context, request, browser);
      await visiter(page, `/messages/${conversationId}`, largeur);
      await expect(page.locator(cadre).getByRole('button', { name: 'Débloquer' })).toBeVisible({ timeout: 20_000 });
      const bloque = await composeur(page, cadre);
      expect(bloque, 'aucune façon d’écrire à un membre bloqué').toBe(0);

      // LA MÊME SONDE, sur la conversation ORDINAIRE. Sans cette moitié, le test
      // passerait au vert le jour où la sonde cesserait de reconnaître le composeur.
      await visiter(page, '/messages/1', largeur);
      const ordinaire = await composeur(page, cadre);
      expect(ordinaire, 'la sonde reconnaît bien un composeur quand il y en a un').toBeGreaterThan(
        0,
      );
    });
  }

  test('le bandeau porte la phrase du porteur et le bouton « Débloquer » de K05', async ({
    page,
    context,
    request,
    browser,
  }) => {
    const { conversationId } = await ouvrirConversationBloquee(context, request, browser);
    await visiter(page, `/messages/${conversationId}`, 1440);
    const cadre = page.locator(ORDINATEUR);
    const bandeau = cadre.getByText(
      'Vous avez bloqué ce membre. Débloquez-le pour reprendre la conversation.',
      { exact: false },
    );
    await expect(bandeau).toBeVisible({ timeout: 20_000 });

    // Le bouton est celui de la carte « BLOQUÉS » de K05, transcodé tel quel : il est
    // donc un vrai `<button>` dans la maquette, à la différence des contrôles de M01.
    await expect(cadre.getByRole('button', { name: 'Débloquer' })).toHaveCount(1);
  });

  test('le bandeau occupe la bande du bas, pas le fil', async ({ page, context, request, browser }) => {
    const { conversationId } = await ouvrirConversationBloquee(context, request, browser);
    await visiter(page, `/messages/${conversationId}`, 390);
    const bouton = page.locator(MOBILE).getByRole('button', { name: 'Débloquer' });
    await expect(bouton).toBeVisible({ timeout: 20_000 });
    const bandeau = bouton.locator('..');
    const boite = await bandeau.boundingBox();
    const fenetre = page.viewportSize();
    expect(boite).not.toBeNull();
    if (boite === null || fenetre === null) return;
    expect(boite.y + boite.height, 'le bandeau est posé en bas de l’écran').toBeGreaterThan(
      fenetre.height - 120,
    );
  });

  test('une valeur d’état inconnue rend la conversation ORDINAIRE', async ({ page }) => {
    await visiter(page, '/messages/1?etat=nimporte-quoi', 1440);
    expect(await composeur(page, ORDINATEUR)).toBeGreaterThan(0);
    await expect(page.getByRole('button', { name: 'Débloquer' })).toHaveCount(0);
  });
});

/**
 * ── M01 · LE MENU DE LA CONVERSATION, ET SON VOILE EMPRUNTÉ ──────────────────
 *
 * La carte « MENU DE LA CONVERSATION » (300 px) est une CARTE NUE : la maquette ne
 * lui dessine ni voile ni positionnement, et la section M01 n'écrit pas un seul
 * `position:absolute;inset:0;background:rgba(…)` — compté, pas supposé. Le voile
 * lui est donc emprunté à `03 Accueil v2.dc.html` par `adaptModalFrame`, comme aux
 * trois fenêtres de `08 Compte`.
 *
 * CE N'EST PAS UN DÉTAIL DE DESSIN : le menu n'a ni croix ni poignée, parce que la
 * maquette ne lui en dessine pas et qu'on ne lui en invente pas. Le voile est donc
 * la SEULE fermeture à la souris. Sans lui, `Modal` ne verrait qu'un panneau, un
 * clic à côté ne fermerait rien, et le membre serait enfermé dans un menu qui ne se
 * quitte qu'à Échap.
 */
test.describe('M01 — le menu de la conversation', () => {
  const DECLENCHEUR = '[data-modal-open="M01MENU"]';

  test('le « ··· » de l’en-tête ouvre une boîte de dialogue nommée, aux deux largeurs', async ({
    page,
  }) => {
    for (const [largeur, cadre] of [
      [1440, ORDINATEUR],
      [390, MOBILE],
    ] as const) {
      await visiter(page, '/messages/1', largeur);
      const bouton = page.locator(`${cadre} ${DECLENCHEUR}`);
      await expect(bouton, `un seul déclencheur à ${largeur} px`).toHaveCount(1);
      // Le bouton n'a qu'une icône : son nom vient du déclencheur déclaré.
      await expect(bouton).toHaveAccessibleName('Menu de la conversation');

      await bouton.click();
      const menu = page.getByRole('dialog', { name: 'MENU DE LA CONVERSATION' });
      await expect(menu).toBeVisible();
      // Les quatre entrées, dans l'ordre de la maquette.
      for (const entree of ['Voir le profil', 'Mettre en sourdine', 'Bloquer', 'Signaler']) {
        await expect(menu.getByText(entree, { exact: true })).toBeVisible();
      }
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
  });

  /**
   * LE CADRE « MOBILE · LISTE » NE PORTE PAS LE « ··· », et c'est la maquette qui
   * le décide : son en-tête dessine un crayon. Le figer évite qu'un lot futur
   * marque le mauvais tracé sans que rien ne le dise.
   */
  test('le cadre mobile de la LISTE ne porte aucun déclencheur', async ({ page }) => {
    await visiter(page, '/messages', 390);
    await expect(page.locator(`${MOBILE} ${DECLENCHEUR}`)).toHaveCount(0);
    // Le cadre d'ordinateur, lui, en porte un : c'est celui de la conversation.
    await expect(page.locator(`${ORDINATEUR} ${DECLENCHEUR}`)).toHaveCount(1);
  });

  test('LE VOILE EMPRUNTÉ ferme au clic hors du panneau — et un clic dedans ne ferme pas', async ({
    page,
  }) => {
    await visiter(page, '/messages/1', 1440);
    await page.locator(`${ORDINATEUR} ${DECLENCHEUR}`).click();
    const menu = page.getByRole('dialog', { name: 'MENU DE LA CONVERSATION' });
    await expect(menu).toBeVisible();

    // Le voile existe, et il couvre la fenêtre : c'est lui l'emprunt.
    const voile = page.locator('[data-modal-overlay]');
    await expect(voile).toHaveCount(1);
    const couverture = await voile.boundingBox();
    expect(couverture?.width, 'le voile couvre la fenêtre').toBe(1440);

    // Un clic DANS le panneau ne ferme pas : le membre lit son menu.
    await menu.getByText('Mettre en sourdine', { exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(1);

    await voile.click({ position: { x: 5, y: 5 } });
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('Échap ferme, et le focus revient sur le « ··· » d’origine', async ({ page }) => {
    await visiter(page, '/messages/1', 1440);
    const bouton = page.locator(`${ORDINATEUR} ${DECLENCHEUR}`);
    await bouton.click();
    await expect(page.getByRole('dialog', { name: 'MENU DE LA CONVERSATION' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // Sans le retour de focus, refermer renvoie au début du document : un membre au
    // clavier doit re-parcourir toute la conversation pour revenir où il était.
    await expect(bouton).toBeFocused();
  });

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LE MENU A MAINTENANT SES QUATRE CONTRÔLES                               ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * CE QUE CE CAS DISAIT AVANT : « le menu n'a aucun contrôle — la maquette
   * dessine ses quatre entrées en `<span>`, et on ne les promeut pas en boutons :
   * aucune route ne les porte, et un bouton qui ne fait rien ment au membre ». Le
   * manque était figé pour qu'il se voie.
   *
   * IL S'EST VU. Le porteur : « les options voir le profil, mettre en sourdine,
   * bloquer et signaler ne marchent pas. Intègre tout ça. » Les quatre sont
   * branchées — deux liens (le profil public, `?feuille=signaler`) et deux
   * boutons (`PATCH /conversations/:id/mute`, `POST /blocks`).
   *
   * CE QUE LE CAS GARDE, ET C'EST SA VRAIE RAISON D'ÊTRE : `aria-modal="true"`
   * promet qu'on ne sort pas de la boîte. Sans AUCUN élément focalisable, la
   * tabulation en sortait — c'est le défaut que la confirmation X03 avait révélé
   * dans `Modal`. Le menu n'est plus dans ce cas, et le piège de tabulation doit
   * tenir quand même : c'est ce qui est mesuré ci-dessous, et c'est la seule
   * chose qui n'a pas changé de nature.
   */
  test('la tabulation ne sort pas de la boîte, menu branché compris', async ({ page }) => {
    await visiter(page, '/messages/1?feuille=menu', 390);
    const menu = page.getByRole('dialog', { name: 'MENU DE LA CONVERSATION' });
    await expect(menu).toBeVisible();
    /**
     * TROIS CONTRÔLES ICI, ET QUATRE AVEC UNE VRAIE CONVERSATION.
     *
     * Cette route est `/messages/1` — un identifiant qui n'est pas un UUID, donc
     * aucune conversation ouverte (le chargeur le dit lui-même : « une valeur
     * fantaisiste retombe sur la conversation par défaut », et il n'y en a pas
     * ici). « Voir le profil » n'a alors pas d'adresse où mener et reste un
     * libellé, plutôt qu'un `href="#"` — un lien mort, que le garde-fou de
     * navigation compte et refuse.
     *
     * C'est exactement ce que la règle doit produire, et ce cas le fige. La
     * quatrième entrée est vérifiée par `conversation-menu.spec.ts`, qui ouvre
     * une vraie conversation. Ici, seul le piège de tabulation est en jeu.
     */
    // VAGUE 5 — le menu porte quatre gestes (profil, sourdine, bloquer, signaler) et sa croix : on
    // exige au moins trois contrôles plutôt qu'un total figé.
    expect(await menu.locator('button, a[href]').count()).toBeGreaterThanOrEqual(3);

    for (let i = 0; i < 4; i += 1) await page.keyboard.press('Tab');
    const dedans = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      return d !== null && d.contains(document.activeElement);
    });
    expect(dedans, 'le focus est resté dans la boîte de dialogue').toBe(true);
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
  /**
   * LA CROIX EMPRUNTÉE HÉRITE DE L'ÉCART DE SON ORIGINAL, et c'est la preuve que
   * c'est bien le même objet : 40 × 40 px, ce que la maquette dessine. La porter à
   * 44 déplacerait des pixels — et la porterait, elle, plus loin que celle dont
   * elle est la copie.
   */
  '/messages/1?feuille=merci': ['button « Fermer » 40×40 px'],
  /** Le menu n'a aucun contrôle : la maquette dessine ses quatre entrées en `<span>`. */
  // Le « Fermer » en texte du pied de feuille : même composant, même écart que celui de « Signaler ».
  '/messages/1?feuille=menu': ['button « Fermer » 88×25 px'],
  /**
   * « Débloquer » HÉRITE DE L'ÉCART DE SON ORIGINAL, comme la croix de X03 : la carte
   * « BLOQUÉS » de K05 dessine ce bouton à 36 px de haut (`height:44px` suivi de
   * `height:36px` dans le même style — la seconde gagne, et c'est le dessin). Le
   * porter à 44 le rendrait différent de celui dont il est la copie.
   */
  // Clé d'illustration : l'URL réelle est celle d'un blocage fabriqué par les routes (voir le cas).
  '/messages/1?etat=bloque': ['button « Débloquer » 108×36 px'],
};

test.describe('cible tactile — les écarts connus, et AUCUN autre', () => {
  for (const url of Object.keys(ECARTS_TACTILES)) {
    test(`${url} à 390 px`, async ({ page, context, request, browser }) => {
      let cible = url;
      if (url.includes('etat=bloque')) {
        const { conversationId } = await ouvrirConversationBloquee(context, request, browser);
        cible = `/messages/${conversationId}`;
      }
      await visiter(page, cible, 390);
      if (url.includes('etat=bloque')) {
        await expect(page.getByRole('button', { name: 'Débloquer' })).toBeVisible({ timeout: 20_000 });
      }
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
