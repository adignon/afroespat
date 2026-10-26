import { expect, test, type Locator, type Page } from '@playwright/test';
import { connecter, type Membre } from './session';
import { monterEnL1 } from './niveau';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE COMPOSEUR DE STORY, MESURÉ AU NAVIGATEUR                               ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur a ouvert le produit et rien ne marchait pendant que quinze rapports
 * étaient verts. Ce fichier mesure donc les GESTES, pas les fichiers : on clique,
 * on tape, on déplace, on publie, et on relit la bande de l'accueil.
 *
 * CE QUI EST ÉPROUVÉ, dans l'ordre où le porteur l'a demandé :
 *
 *   1. le rond « + » de « STORIES DU JOUR » mène à `/stories/nouvelle` ;
 *   2. le corps de la story se TAPE, et le compteur suit ;
 *   3. ce que l'écran montre est ce qui PART dans `POST /stories` — la requête est
 *      interceptée et sa charge relue, champ par champ. C'est la seule exigence de
 *      preuve stricte de ce lot ;
 *   4. la story publiée APPARAÎT dans « STORIES DU JOUR » ;
 *   5. le calque de texte se déplace, à la souris comme au doigt, mesuré en
 *      GÉOMÉTRIE avant/après — jamais par une classe CSS ;
 *   6. un refus s'AFFICHE au lieu d'échouer en silence.
 *
 * ── POURQUOI CHAQUE TEST OUVRE SA PROPRE SESSION ───────────────────────────
 *
 * `connecterPartage` est réservé à la LECTURE, son en-tête le dit : « Un fichier
 * dont les tests MODIFIENT le membre — qui publient, bloquent, révoquent — doit
 * garder `connecter()` par test ». Celui-ci publie, et la limite de trois stories
 * par jour (`STORY_LIMIT`) est par membre : deux tests qui publieraient sur le même
 * compte finiraient par se gêner, et l'échec accuserait l'écran.
 */

/** Le membre doit être L1 : `post.create` l'exige (§7.2), un membre neuf est L0. */
/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ PUBLIER NE DEMANDE PLUS DE VÉRIFICATION — ÉCART ASSUMÉ AVEC 04 §2.4       ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La spec écrit : « Capacité `post.create` (L1). Un L0 voit le composeur grisé
 * avec l'invitation à monter de niveau. » Le porteur : « Autorise pour tout le
 * monde la possibilité de publier des stories avec tout ce qui va avec. »
 *
 * MESURÉ avant : `POST /stories` rendait 403 à un compte non vérifié, et
 * `POST /media` aussi — c'est la MÊME capacité qui garde les deux, d'où la photo
 * refusée en même temps que la publication. La décision et ce qu'elle ouvre sont
 * écrites sur `post.create` dans `capabilities.ts`.
 */
/**
 * MISE À JOUR PAR DÉCISION (lot w5b) — LE NIVEAU N1 EST EXIGÉ POUR PUBLIER, À NOUVEAU.
 *
 * Le bloc ci-dessus garde l'histoire : le porteur avait ouvert les stories à tout le monde. Le
 * 2026-10-09 il a REFONDU les niveaux (`capabilities.ts`, « Pour les niveaux on va revoir ») :
 * « N1 : publier dans le fil d'actualité et stories ». L'instruction la plus récente l'emporte,
 * et `post.create` repasse à L1. Le cas « un compte NON VÉRIFIÉ publie » mesurait l'inverse ;
 * il est remplacé par ses deux moitiés :
 *   · à N0, le composeur S'OUVRE mais le produit répond par la fenêtre « Niveau N1 requis »
 *     (« Passer au niveau N1 ») au lieu de publier, et aucune requête `POST /stories` ne part ;
 *   · à N1, la story part (201).
 */
test.describe('A14 — publier demande le niveau N1', () => {
  test('à N0 : le composeur s’ouvre, mais la fenêtre « Niveau N1 requis » remplace la publication', async ({
    page,
    request,
  }) => {
    await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    const partis: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/stories') && r.method() === 'POST') partis.push(r.url());
    });

    await page.goto('/stories/nouvelle');
    const cadre = page.locator('[data-frame]').filter({ visible: true }).first();
    await cadre.getByRole('textbox').first().fill('Un conseil que le produit ne doit pas publier.');

    // La fenêtre de niveau (`fenetre-niveau.tsx`) : modale « Niveau N1 requis » au large, feuille basse
    // « Cette action demande une identité vérifiée » (planche X04) au téléphone. On tient donc le
    // CONTENANT commun — `data-fenetre-niveau` — et sa sortie « Plus tard », pas les deux libellés.
    const fenetre = page.locator('[data-fenetre-niveau]').filter({ visible: true });
    await expect(fenetre).toBeVisible({ timeout: 15_000 });
    await expect(fenetre.locator('[data-niveau-plus-tard]')).toBeVisible();
    expect(partis, 'une story est partie alors que le membre est N0').toEqual([]);
  });

  test('à N1 : le composeur s’ouvre et la story part', async ({ page, request }) => {
    await membreQuiPeutPublier(page.context(), request);

    await page.goto('/stories/nouvelle');
    const cadre = page.locator('[data-frame]').filter({ visible: true }).first();
    await cadre.getByRole('textbox').first().fill('Un conseil publié par un membre vérifié.');

    await cadre.getByRole('button', { name: /Suivant|Continuer/ }).first().click();
    await cadre.getByRole('button', { name: 'Logement', exact: true }).click();
    await cadre.getByRole('button', { name: /Suivant|Continuer/ }).first().click();

    const requete = page.waitForRequest(
      (r) => r.url().includes('/stories') && r.method() === 'POST',
    );
    await cadre.getByRole('button', { name: 'Publier', exact: true }).click();
    const reponse = await (await requete).response();
    expect(reponse?.status(), 'la publication a été refusée à un membre N1').toBe(201);
  });
});

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ UNE DÉCOUVERTE ÉTAIT IMPOSSIBLE À PUBLIER                                 ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Ceci est lié à quoi "Ce type de story demande un rattachement que
 * vous n'avez pas indiqué" ? Qu'est-ce qui manque ? »
 *
 * MESURÉ en publiant les trois types à la suite : un conseil part (201), une
 * information part (201), une DÉCOUVERTE est refusée en 422 — motif
 * `DECOUVERTE_NEEDS_PLACE`. §2.6 lui demande « Ville + catégorie + `place_label` »,
 * et la planche ne dessine AUCUN champ pour ce dernier. Ce n'était donc pas une
 * explication qui manquait : c'était le champ.
 */
test.describe('A14 — la découverte et son lieu', () => {
  test('le champ de lieu existe, et sans lui le refus NOMME le lieu', async ({ page, request }) => {
    await membreQuiPeutPublier(page.context(), request);
    await page.goto('/stories/nouvelle');

    const cadre = page.locator('[data-frame]').filter({ visible: true }).first();
    await cadre.getByRole('button', { name: 'Découverte', exact: true }).first().click();
    await cadre.getByRole('textbox').first().fill('Une épicerie du pays près de la gare.');
    await cadre.getByRole('button', { name: /Suivant|Continuer/ }).first().click();

    const lieu = cadre.locator('[data-lieu]');
    await expect(lieu, 'aucun champ pour le lieu : la découverte reste impubliable').toHaveCount(1);

    // On ne le remplit PAS : le refus doit dire lequel des champs manque.
    await cadre.getByRole('button', { name: /Suivant|Continuer/ }).first().click();
    await cadre.getByRole('button', { name: 'Publier', exact: true }).click();
    await expect(page.getByText(/Une découverte a besoin du lieu/)).toHaveCount(1);
    // Et plus la phrase qui ne nomme rien.
    await expect(page.getByText(/rattachement que vous n’avez pas indiqué/)).toHaveCount(0);
  });

  /**
   * ╔═════════════════════════════════════════════════════════════════════════╗
   * ║ LA VILLE PAR DÉFAUT EST EMPÊCHÉE D'ARRIVER, ET C'EST TOUT L'INTÉRÊT         ║
   * ╚═════════════════════════════════════════════════════════════════════════╝
   *
   * `onPublish` est un `useCallback` : il fige les valeurs de son dernier rendu.
   * `lieu` manquait de sa liste de dépendances, donc une découverte partait sans
   * `placeLabel` — refusée par le serveur alors que le champ était rempli à
   * l'écran.
   *
   * CE CAS NE L'ATTRAPAIT QU'UNE FOIS SUR DIX, et la raison vaut d'être écrite :
   * `villeChoisie` EST dans la liste, et la ville par défaut se charge à
   * l'étape 2, donc APRÈS la saisie du lieu. Sa réponse recréait le rappel, qui
   * recapturait le lieu à jour : le défaut se réparait tout seul. Il ne restait
   * que sur une machine chargée — c'est là qu'il a été vu, dans une suite qui
   * jouait deux projets de front.
   *
   * ON COUPE DONC `/places/countries`. L'écran ne montre AUCUN refus pour ça — la
   * ville par défaut est un confort, et le serveur retombe sur celle du membre —
   * mais `villeChoisie` reste `null`, aucune dépendance ne bouge, et le rappel
   * garde le lieu de son premier rendu. Sans le correctif, ce cas rougit À CHAQUE
   * FOIS ; vérifié en retirant `lieu` de la liste et en rejouant.
   */
  test('avec le lieu, la découverte part', async ({ page, request }) => {
    await membreQuiPeutPublier(page.context(), request);
    await page.route('**/places/countries**', (route) => route.abort());
    await page.goto('/stories/nouvelle');

    const cadre = page.locator('[data-frame]').filter({ visible: true }).first();
    await cadre.getByRole('button', { name: 'Découverte', exact: true }).first().click();
    await cadre.getByRole('textbox').first().fill('Une épicerie du pays près de la gare.');
    await cadre.getByRole('button', { name: /Suivant|Continuer/ }).first().click();
    await cadre.locator('[data-lieu]').fill('Épicerie près de la gare');
    /**
     * ╔═════════════════════════════════════════════════════════════════════╗
     * ║ `fill` PROUVE QUE LE TEXTE EST DANS LE CHAMP, PAS QU'IL EST DANS L'ÉTAT   ║
     * ╚═════════════════════════════════════════════════════════════════════╝
     *
     * Ce cas échouait par intermittence, et SEULEMENT dans une suite chargée :
     * « le lieu saisi n'atteint pas la charge — reçu : undefined », alors que la
     * même suite jouée seule passait. Le défaut n'est ni le champ ni
     * `chargeStory` : relancé à la main sur les deux largeurs, `placeLabel` part
     * bien.
     *
     * CE QUI COURT : le champ est CONTRÔLÉ. `fill` pose la valeur dans le DOM et
     * émet `input` ; si React n'a pas encore attaché son écouteur, l'événement
     * tombe dans le vide — le texte se voit à l'écran et `inputValue()` le lit,
     * mais `setLieu` n'a jamais été appelé. Lire le champ ne distingue donc pas
     * les deux situations.
     *
     * CE QUI LES DISTINGUE : `ScreenFrames` rend LES DEUX PLANCHES et en masque
     * une, et toutes deux lisent le MÊME état. Le champ de la planche masquée ne
     * peut porter la valeur que si React l'a reçue. On attend donc que LES DEUX
     * la portent : c'est la liaison elle-même qu'on mesure, pas la frappe.
     */
    await expect
      .poll(
        async () =>
          page
            .locator('[data-lieu]')
            .evaluateAll((ns) => ns.map((n) => (n as HTMLInputElement).value)),
        { message: 'l’état n’a pas reçu la saisie : la planche masquée ne la porte pas' },
      )
      .toEqual(['Épicerie près de la gare', 'Épicerie près de la gare']);
    await cadre.getByRole('button', { name: /Suivant|Continuer/ }).first().click();

    const requete = page.waitForRequest(
      (r) => r.url().includes('/stories') && r.method() === 'POST',
    );
    await cadre.getByRole('button', { name: 'Publier', exact: true }).click();
    const envoyee = await requete;
    const charge = JSON.parse(envoyee.postData() ?? '{}') as Record<string, unknown>;
    expect(charge['placeLabel'], 'le lieu saisi n’atteint pas la charge').toBe(
      'Épicerie près de la gare',
    );
    expect((await envoyee.response())?.status()).toBe(201);
  });
});

async function membreQuiPeutPublier(
  context: Parameters<typeof connecter>[0],
  request: Parameters<typeof connecter>[1],
): Promise<Membre> {
  const membre = await connecter(context, request, { displayName: 'Awa Konaté' });
  await monterEnL1(context, request, membre.accessToken);
  return membre;
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES DEUX CADRES SONT DANS LE DOCUMENT — IL FAUT VISER LE VISIBLE           ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * `ScreenFrames` rend les DEUX cadres et masque l'un par CSS : « Next rend côté
 * serveur : il ne connaît pas la largeur de la fenêtre, et choisir en JavaScript
 * provoquerait un saut visible à l'hydratation ».
 *
 * Chaque contrôle existe donc DEUX FOIS dans le DOM, et `.first()` tombe une fois
 * sur deux sur celui du cadre masqué — sur quoi Playwright attend trente secondes
 * une visibilité qui ne viendra jamais, et son message accuse l'écran. Mesuré : le
 * compteur « 0 / 280 » résolvait à TROIS éléments (deux du cadre d'ordinateur, un
 * du mobile), ce qui est d'ailleurs la preuve que les trois compteurs dessinés sont
 * vivants.
 *
 * `filter({ visible: true })` ne garde que ce qu'un membre voit. C'est la seule
 * façon d'écrire une suite qui vaille aux DEUX largeurs.
 */
/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ `exact: true` — ET CE N'EST PAS UN DÉTAIL : L'INDICATEUR D'ÉTAPE EST UN    ║
 * ║ BOUTON                                                                      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * MESURÉ AU NAVIGATEUR, en listant les boutons visibles du cadre d'ordinateur. La
 * maquette dessine son fil d'étapes — « 1 · Écrire », « 2 · Rattacher »,
 * « 3 · Publier » — en `<button>`, et ces trois boutons sont présents à CHAQUE
 * étape, AVANT le bouton d'action dans l'ordre du document.
 *
 * Une recherche approximative sur « Publier » tombait donc sur « 3 · Publier »,
 * c'est-à-dire sur l'INDICATEUR D'ÉTAPE — qui n'a aucun gestionnaire. Le clic
 * réussissait, rien ne se passait, et l'échec accusait la publication.
 *
 * C'est le genre de faux négatif qui fait conclure « le bouton n'est pas branché »
 * alors qu'on n'a pas cliqué le bon. Le nom exact lève l'ambiguïté.
 *
 * AU PASSAGE, UN MANQUE RÉEL ET REMONTÉ : ces trois boutons d'étape n'ont AUCUN
 * `onClick`. Le fil d'étapes du cadre d'ordinateur ne navigue pas — il indique.
 * Les brancher demanderait une adaptation, car leur libellé est une prise
 * (`{s.label}`) et `BUTTON_ACTIONS` s'indexe sur un libellé littéral.
 */
const bouton = (page: Page, nom: string): Locator =>
  page.getByRole('button', { name: nom, exact: true }).filter({ visible: true }).first();

const champCorps = (page: Page): Locator =>
  page
    .getByRole('textbox', { name: 'Le texte de votre story' })
    .filter({ visible: true })
    .first();

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ DEUX CHAMPS SUR L'ORDINATEUR : L'APERÇU ET L'ÉDITEUR                      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « L'écran à gauche c'est le display ou le preview de ce qui sera
 * affiché aux utilisateurs, à droite c'est juste un éditeur du contenu à gauche.
 * Sur mobile tout est intégré sur la preview. »
 *
 * Les deux portent le MÊME nom accessible — c'est le même contenu — donc
 * `champCorps` prend « le premier visible » et tombe sur l'aperçu. C'est ce qui
 * rendait les cas de style verts SANS JAMAIS VÉRIFIER QUE L'ÉDITEUR RESTE NEUTRE :
 * `bodyStyle` était étalé sur les quatre champs, et personne ne le mesurait.
 *
 * On les distingue par une MESURE — la taille calculée — et jamais par une classe
 * ni par un rang : l'aperçu rend la story (26 px, graisse 800), l'éditeur est un
 * champ de formulaire (14,5 px). Un rang changerait au premier remaniement du DOM.
 */
const champsVisibles = (page: Page): Locator =>
  page.getByRole('textbox', { name: 'Le texte de votre story' }).filter({ visible: true });

/** Le champ dont la taille calculée est la plus GRANDE : l'aperçu. */
async function champApercu(page: Page): Promise<Locator> {
  return champParTaille(page, (a, b) => b - a);
}

/** Le champ dont la taille calculée est la plus PETITE : l'éditeur du panneau. */
async function champEditeur(page: Page): Promise<Locator> {
  return champParTaille(page, (a, b) => a - b);
}

async function champParTaille(
  page: Page,
  ordre: (a: number, b: number) => number,
): Promise<Locator> {
  const champs = champsVisibles(page);
  const n = await champs.count();
  const tailles: { readonly i: number; readonly px: number }[] = [];
  for (let i = 0; i < n; i += 1) {
    const px = await champs
      .nth(i)
      .evaluate((e) => Number.parseFloat(getComputedStyle(e).fontSize) || 0);
    tailles.push({ i, px });
  }
  const trie = [...tailles].sort((a, b) => ordre(a.px, b.px));
  return champs.nth(trie[0]?.i ?? 0);
}

/**
 * L'ÉLÉMENT QUI PORTE LE CORPS DE LA STORY DANS L'APERÇU — champ ou bloc.
 *
 * L'aperçu est tantôt un `<textarea>` (variante photo, où l'on écrit sur l'image),
 * tantôt un bloc lié (variante couleur). On le reconnaît à ce qu'il est LE PLUS
 * GRAND TEXTE DU CADRE : la story est écrite en 26 à 30 px, l'éditeur en 14,5.
 * Une mesure, jamais une classe ni un rang.
 */
async function porteurDuCorps(page: Page): Promise<Locator> {
  const cadre = page.locator('[data-frame]').filter({ visible: true }).first();
  const candidats = cadre.locator('textarea, div, p, span');
  const i = await candidats.evaluateAll((noeuds) => {
    let meilleur = -1;
    let taille = 0;
    noeuds.forEach((n, k) => {
      const el = n as HTMLElement;
      // Un porteur de corps a du texte propre, et il est grand.
      const propre = [...el.childNodes].some((c) => c.nodeType === 3 && (c.textContent ?? '').trim().length > 3);
      const champ = el.tagName === 'TEXTAREA';
      if (!propre && !champ) return;
      const px = Number.parseFloat(getComputedStyle(el).fontSize) || 0;
      if (px > taille) { taille = px; meilleur = k; }
    });
    return meilleur;
  });
  return candidats.nth(i < 0 ? 0 : i);
}

const compteur = (page: Page, texte: string): Locator =>
  page.getByText(texte, { exact: true }).filter({ visible: true }).first();

/**
 * AVANCER D'UNE ÉTAPE. Le libellé diffère selon le cadre, et ce n'est pas une
 * coquetterie : `webFrameFor` le calcule pour le cadre d'ordinateur — « Suivant »
 * à l'étape 1, « Continuer » à l'étape 2, « Publier » à l'étape 3. Le cadre mobile
 * dessine un rond fléché à l'étape 1 (nommé « Suivant » depuis ce lot, voir la
 * déclaration `liens` de A14) et un vrai « Continuer » à l'étape 2.
 *
 * Les deux cadres s'accordent donc sur « Suivant » puis « Continuer », et une
 * seule suite vaut aux deux largeurs.
 */
async function allerALEtape3(page: Page): Promise<void> {
  await bouton(page, 'Suivant').click();
  await bouton(page, 'Continuer').click();
}

/**
 * UNE IMAGE PNG MINIMALE, ÉCRITE EN OCTETS.
 *
 * `POST /media` ne croit PAS l'extension : `media-bytes.ts` lit les octets magiques
 * et refuse par `MEDIA_TYPE_REJECTED` un `.png` qui n'en est pas un (« seuls les
 * octets magiques comptent »). Un fichier bidon aurait donc été refusé, et l'échec
 * aurait accusé l'écran.
 *
 * Ce sont les octets d'un PNG 1 × 1 valide : signature, IHDR, IDAT, IEND.
 */
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
);

/** Le champ de fichier que l'écran pose hors des cadres. Il est unique. */
const champFichier = (page: Page): Locator => page.locator('input[type="file"]');

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ UNE RÉPONSE QUI N'EST PAS UN `401` — LE REJEU DU SOCLE EST INVISIBLE AU TEST ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * MESURÉ, et le symptôme accusait l'écran : le premier `POST /media` a rendu `401`,
 * et le cas a conclu « le téléversement a été refusé ». Le téléversement avait
 * parfaitement réussi.
 *
 * La cause est écrite dans `e2e/niveau.ts` : CHANGER DE NIVEAU INVALIDE LE JETON
 * D'ACCÈS, et le serveur répond `401 TOKEN_STALE` sur la route suivante, quelle
 * qu'elle soit. Dans le navigateur ce n'est pas un problème — le socle d'appel
 * rafraîchit UNE FOIS et rejoue (`lib/api/member.ts`), donc la page ne voit rien.
 * Mais `waitForResponse` attrape la PREMIÈRE réponse, c'est-à-dire le 401 jeté.
 *
 * On attend donc la première réponse qui n'est pas un 401 : c'est celle que l'écran
 * lit vraiment. Si aucune n'arrive, le cas expire — un échec, et non un faux vert.
 */
const reponseUtile = (page: Page, chemin: string): Promise<import('@playwright/test').Response> =>
  page.waitForResponse(
    (r) =>
      r.url().includes(chemin) && r.request().method() === 'POST' && r.status() !== 401,
  );

test.describe('A14 — le composeur de story', () => {
  test('le rond « + » de STORIES DU JOUR mène au composeur', async ({ page, request }) => {
    await membreQuiPeutPublier(page.context(), request);
    await page.goto('/accueil');

    /**
     * LA CIBLE EST DÉSIGNÉE PAR SON RÔLE ET SON NOM, jamais par une classe : c'est
     * un lien qui s'appelle « Créer une story » — le nom que `markLinks` lui pose
     * depuis le libellé de la maquette.
     *
     * La tuile en porte DEUX, et c'est voulu : le rond et le libellé sont deux
     * `<span>` frères que la remontée de `markLinks` ne peut pas dépasser, donc les
     * deux sont promus pour que toute la tuile réponde. Le premier VISIBLE dans
     * l'ordre du document est le rond — celui que le porteur a montré.
     */
    /**
     * ── LE LIBELLÉ A CHANGÉ AVEC LA BANDE ───────────────────────────────────
     *
     * Le porteur : « change la section de stories comme sur la page ci »
     * (`Fil d'actualité v2`). La tuile ronde « Créer une story » est devenue la
     * carte « Partager un jalon », et c'est le mot que la nouvelle planche écrit.
     * On désigne donc par l'ADRESSE — `/stories/nouvelle`, qui est ce que ce cas
     * tient vraiment — et on vérifie le libellé ensuite, pour qu'un changement de
     * mot se voie sans faire rougir la navigation.
     */
    const rond = page
      .locator('a[href="/stories/nouvelle"]')
      .filter({ visible: true })
      .first();
    await expect(rond, 'la bande n’offre aucun appel à publier').toBeVisible();
    expect((await rond.innerText()).trim()).toContain('Partager un jalon');

    const boite = await rond.boundingBox();
    expect(boite, 'le rond « + » n’a aucune géométrie : il ne serait pas cliquable').not.toBeNull();

    await rond.click();
    await expect(page).toHaveURL(/\/stories\/nouvelle/);
  });

  test('le corps de la story se tape, et le compteur suit la frappe', async ({ page, request }) => {
    await membreQuiPeutPublier(page.context(), request);
    await page.goto('/stories/nouvelle');

    const champ = champCorps(page);
    await expect(champ).toBeVisible();

    // AU DÉPART : vide, et le texte de la maquette n'est qu'une invite.
    await expect(champ).toHaveValue('');
    await expect(champ).toHaveAttribute('placeholder', /Pour Visale|Épicerie Wax/);
    await expect(compteur(page, '0 / 280')).toBeVisible();

    await champ.fill('Déposez votre dossier dès la validation.');
    await expect(champ).toHaveValue('Déposez votre dossier dès la validation.');
    // 40 caractères : le compteur COMPTE, il ne récite pas « 118 ».
    await expect(compteur(page, '40 / 280')).toBeVisible();
    await expect(page.getByText('118 / 280')).toHaveCount(0);
  });

  test('la borne de 280 caractères est tenue par le champ lui-même', async ({ page, request }) => {
    await membreQuiPeutPublier(page.context(), request);
    await page.goto('/stories/nouvelle');

    const champ = champCorps(page);
    await expect(champ).toHaveAttribute('maxlength', '280');
    await champ.fill('x'.repeat(400));
    expect((await champ.inputValue()).length).toBe(280);
    await expect(compteur(page, '280 / 280')).toBeVisible();
  });

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ CE QUE L'ÉCRAN MONTRE EST CE QUI PART — LA CHARGE EST RELUE              ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le seul verdict strict du lot. On change le TYPE, le FOND, l'AUDIENCE et
   * l'interrupteur de messages à l'écran, on publie, et on relit la charge
   * interceptée : un sélecteur qui bouge sans changer ce qui part est précisément le
   * défaut que ce dépôt a déjà payé.
   */
  test('la charge de POST /stories porte ce que l’écran montre', async ({ page, request }) => {
    await membreQuiPeutPublier(page.context(), request);
    await page.goto('/stories/nouvelle');

    await champCorps(page).fill('Un conseil mesuré au navigateur.');

    // Les quatre contrôles bougeaient DÉJÀ à l'écran ; la question est de savoir
    // s'ils atteignent la charge.
    await bouton(page, 'Information').click();
    // La seconde pastille : nommée par sa teinte (`aria-label="Fond #0F5C48"`).
    await bouton(page, 'Fond #0F5C48').click();

    const requete = page.waitForRequest(
      (r) => r.url().includes('/stories') && r.method() === 'POST',
    );

    await allerALEtape3(page);
    // MISE À JOUR (lot w5b) : l'audience porte la VILLE DU MEMBRE (« Aix-en-Provence seulement »),
    // plus l'exemple de la maquette (« Lyon seulement ») — l'écran lit `cityName` de `/me`.
    await page
      .getByRole('button', { name: / seulement$/ })
      .filter({ visible: true })
      .first()
      .click();
    /**
     * L'INTERRUPTEUR EST UN `switch`, PAS UN `button`, depuis ce lot. Il n'avait NI
     * nom NI rôle NI état — un `<button>` nu piloté par deux styles — donc ce test
     * ne pouvait pas le désigner, exactement comme un membre au lecteur d'écran ne
     * pouvait pas l'employer. `INTERACTIVE_ROLES` lui pose maintenant
     * `role="switch"`, `aria-checked` et le nom que le `<span>` frère écrit.
     *
     * Il est ALLUMÉ au départ — la maquette le dessine ainsi — donc un clic
     * l'éteint, et `allowMessages` doit partir à `false`.
     */
    const messages = page
      .getByRole('switch', { name: 'Autoriser les messages' })
      .filter({ visible: true })
      .first();
    await expect(messages).toHaveAttribute('aria-checked', 'true');
    await messages.click();
    await expect(messages).toHaveAttribute('aria-checked', 'false');

    await bouton(page, 'Publier').click();

    const charge = JSON.parse((await requete).postData() ?? '{}') as Record<string, unknown>;

    expect(charge['body'], 'le texte tapé ne part pas').toBe('Un conseil mesuré au navigateur.');
    expect(charge['type'], 'l’onglet de type ne change pas la charge').toBe('INFORMATION');
    expect(charge['audience'], 'l’onglet d’audience ne change pas la charge').toBe('CITY');
    expect(charge['allowMessages'], 'l’interrupteur ne change pas la charge').toBe(false);
    /**
     * LA COULEUR ENVOYÉE N'EST PAS CELLE DE LA PASTILLE, et c'est MESURÉ, pas
     * accidentel : les sept teintes dessinées et les sept que le serveur accepte
     * n'ont AUCUNE valeur commune (intersection vide, vérifié dans
     * `screens/a14/nouvelle-story.test.ts`). La seconde pastille, `#0F5C48`, part
     * donc en `#1B4332` — son plus proche voisin perceptuel. Écart REMONTÉ ; ce cas
     * le fixe pour qu'il ne s'oublie pas.
     */
    expect(charge['backgroundColor'], 'la pastille choisie n’atteint pas la charge').toBe(
      '#1B4332',
    );
    // Le rattachement que le SERVICE exige, même si le schéma le dit facultatif.
    expect(charge['category']).toBe('LOGEMENT');
    expect(charge['textStyle']).toBe('BOLD');
  });

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LA PREUVE QUE LE PORTEUR ATTEND : LA STORY APPARAÎT DANS LA BANDE        ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   */
  test('une story publiée apparaît dans STORIES DU JOUR', async ({ page, request }) => {
    const membre = await membreQuiPeutPublier(page.context(), request);
    await page.goto('/stories/nouvelle');

    await champCorps(page).fill(`Mesure de bout en bout ${String(Date.now()).slice(-6)}.`);

    const reponse = reponseUtile(page, '/stories');
    await allerALEtape3(page);
    await bouton(page, 'Publier').click();

    /**
     * LE CORPS DU REFUS ENTRE DANS LE MESSAGE, et ce n'est pas du confort.
     *
     * Ce cas a échoué par un `422` pendant ce lot, et le message d'origine — « la
     * publication a été refusée » — ne disait PAS lequel des quatre refus possibles
     * s'était produit (`INVALID_ATTACHMENT`, `CONTENT_BLOCKED`,
     * `KIND_NOT_ALLOWED_FOR_TYPE`, `STORY_EXPIRED` partagent le même statut). On
     * cherche alors la cause dans l'écran, qui n'y est pour rien.
     */
    const brute = await reponse;
    expect(
      brute.status(),
      `la publication a été refusée : ${await brute.text()}`,
    ).toBe(201);

    // L'écran mène à l'accueil de lui-même : c'est là que vit la bande.
    await expect(page).toHaveURL(/\/accueil/, { timeout: 30_000 });

    /**
     * LA BANDE EST DÉJÀ BRANCHÉE (`use-fil.ts`, `fetchStoryBand`) : la story doit
     * donc apparaître sans que cet écran la pousse.
     *
     * ── CE QU'ON CHERCHE, ET POURQUOI PAS LE NOM ─────────────────────────────
     *
     * ON CHERCHE LES INITIALES, et la bande est bornée par LE LIEN DU « + ».
     *
     * ── DEUX EXPLICATIONS FAUSSES ONT PRÉCÉDÉ CELLE-CI ────────────────────────
     *
     * La première disait que l'assertion devait porter sur le NOM de l'auteur. La
     * seconde, écrite ici même, disait l'inverse : « le cadre d'ordinateur écrit le
     * nom, le cadre mobile n'écrit que ses initiales ». Les deux sont fausses, et
     * la mesure est à une ligne : les deux cadres lisent EXACTEMENT les mêmes
     * prises sous la bulle — `caption`, `count`, `i`, `type`. Aucun des deux
     * n'écrit `name`.
     *
     * La vraie cause était la PORTÉE. `ancestor::*[self::div][1]` ne remonte qu'au
     * div PARENT IMMÉDIAT du libellé « STORIES DU JOUR » ; sur le cadre
     * d'ordinateur ce parent est la ligne de titre, qui ne contient aucune bulle.
     * Le cas cherchait donc les initiales dans un conteneur où elles ne pouvaient
     * pas être, et accusait la publication alors que le `201` était déjà là.
     *
     * La borne est maintenant un repère que les DEUX cadres portent et qui ne peut
     * pas désigner autre chose : le conteneur qui contient le lien du « + » vers le
     * composeur. Il exclut l'en-tête de page — dont l'avatar afficherait les mêmes
     * initiales et rendrait le cas vert sans rien prouver.
     */
    const bande = page
      .getByText('STORIES DU JOUR')
      .filter({ visible: true })
      .first()
      .locator('xpath=ancestor::div[.//a[@href="/stories/nouvelle"]][1]');
    await expect(bande).toBeVisible();

    const initiales = membre.displayName
      .split(/\s+/)
      .map((m) => m[0] ?? '')
      .join('')
      .toUpperCase();
    await expect(
      bande.getByText(initiales, { exact: true }).first(),
      'la story publiée n’apparaît pas dans la bande de l’accueil',
    ).toBeVisible({ timeout: 30_000 });
  });

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LE CALQUE SE DÉPLACE — GÉOMÉTRIE AVANT / APRÈS                           ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * La maquette dessine le calque à poignées sur la VARIANTE PHOTO : pointillé de
   * 1.5 px, rayon 14 px, remplissage 16 px, quatre poignées de 12 px à -6 px des
   * coins. On y entre par le bouton « Photo », qui était déjà branché.
   *
   * LA MESURE EST UNE POSITION, en pixels, lue par `boundingBox()`. Jamais une
   * classe, jamais un style calculé : si le calque n'a pas bougé à l'écran, sa
   * boîte ne bouge pas non plus.
   */
  test('le calque de texte se déplace à la souris, et reste modifiable', async ({
    page,
    request,
  }) => {
    await membreQuiPeutPublier(page.context(), request);
    await page.goto('/stories/nouvelle');

    /**
     * ON ENTRE DANS LA VARIANTE PHOTO EN CHOISISSANT UN FICHIER, et non plus en
     * cliquant « Photo ».
     *
     * MESURÉ : ce cas échouait après ce lot — « element was detached from the DOM,
     * retrying », puis 30 s d'attente. La cause n'est pas une régression, c'est le
     * correctif : « Photo » ne BASCULE plus une variante d'aperçu montrant le
     * hachurage d'exemple de la maquette, il OUVRE un sélecteur de fichier. Il n'y a
     * donc plus de calque à déplacer avant qu'une photo existe — ce qui est la
     * vérité, et c'était l'illusion d'avant.
     *
     * Voir l'en-tête de `onPhoto` dans `nouvelle-story-screen.tsx`.
     */
    await champFichier(page).setInputFiles({
      name: 'fond.png',
      mimeType: 'image/png',
      buffer: PNG_1x1,
    });

    const champ = champCorps(page);
    await expect(champ).toBeVisible();

    const avant = await champ.boundingBox();
    expect(avant).not.toBeNull();
    if (avant === null) return;

    /**
     * ON PREND LE CALQUE PAR SON CADRE, et non par son texte : les 16 px de
     * remplissage que la maquette dessine AUTOUR du texte sont la zone de prise, et
     * le texte la zone de frappe. Un point 6 px au-dessus du bord haut du champ
     * tombe dans ce remplissage.
     */
    const prise = { x: avant.x + avant.width / 2, y: avant.y - 6 };
    await page.mouse.move(prise.x, prise.y);
    await page.mouse.down();
    await page.mouse.move(prise.x - 40, prise.y - 70, { steps: 10 });
    await page.mouse.up();

    const apres = await champ.boundingBox();
    expect(apres).not.toBeNull();
    if (apres === null) return;

    expect(
      Math.round(apres.y - avant.y),
      'le calque n’a pas bougé verticalement : le déplacement n’est pas branché',
    ).toBeLessThan(-30);
    expect(Math.round(apres.x - avant.x), 'le calque n’a pas bougé horizontalement').toBeLessThan(
      -10,
    );

    /**
     * ET LE TEXTE RESTE MODIFIABLE. C'est l'autre moitié de la mesure : un calque
     * qu'on ne pourrait plus éditer parce qu'on l'a rendu déplaçable serait un
     * recul. Un clic SUR le texte doit donc écrire, pas déplacer.
     */
    const avantFrappe = await champ.boundingBox();
    await champ.click();
    await champ.fill('Attiéké frais le samedi.');
    await expect(champ).toHaveValue('Attiéké frais le samedi.');
    const apresFrappe = await champ.boundingBox();
    expect(
      Math.abs((apresFrappe?.x ?? 0) - (avantFrappe?.x ?? 0)),
      'cliquer dans le texte a déplacé le calque : les deux gestes sont confondus',
    ).toBeLessThan(2);
  });

  test('le calque se déplace aussi au doigt', async ({ page, request }) => {
    await membreQuiPeutPublier(page.context(), request);
    await page.goto('/stories/nouvelle');
    // Voir le cas précédent : on entre dans la variante photo par le FICHIER.
    await champFichier(page).setInputFiles({
      name: 'fond.png',
      mimeType: 'image/png',
      buffer: PNG_1x1,
    });

    const champ = champCorps(page);
    await expect(champ).toBeVisible();
    const avant = await champ.boundingBox();
    expect(avant).not.toBeNull();
    if (avant === null) return;

    /**
     * ÉVÉNEMENTS DE POINTEUR DE TYPE `touch`, et non `page.touchscreen.tap` : un
     * `tap` ne fait aucun glissement. Le gestionnaire de l'écran écoute
     * `pointerdown/move/up`, qui couvrent la souris ET le doigt — c'est ce que
     * « sur mobile […] sur Web aussi » demande, avec un seul jeu de gestionnaires.
     */
    await page.evaluate(
      ({ x, y }) => {
        const cible = document.elementFromPoint(x, y);
        if (cible === null) throw new Error('aucun élément sous le point de prise');
        const base = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch' };
        cible.dispatchEvent(new PointerEvent('pointerdown', { ...base, clientX: x, clientY: y }));
        window.dispatchEvent(
          new PointerEvent('pointermove', { ...base, clientX: x + 30, clientY: y - 60 }),
        );
        window.dispatchEvent(
          new PointerEvent('pointerup', { ...base, clientX: x + 30, clientY: y - 60 }),
        );
      },
      { x: avant.x + avant.width / 2, y: avant.y - 6 },
    );

    const apres = await champ.boundingBox();
    expect(Math.round((apres?.y ?? 0) - avant.y), 'le calque n’a pas bougé au doigt').toBeLessThan(
      -30,
    );
  });

  /**
   * UN REFUS S'AFFICHE. Le corps vide est refusé AVANT l'appel, par
   * `createStorySchema` — donc sans réseau — et le message passe par la
   * notification que le porteur a choisie pour tous les refus de flux.
   */
  test('publier sans texte affiche un refus lisible, et n’appelle pas le serveur', async ({
    page,
    request,
  }) => {
    await membreQuiPeutPublier(page.context(), request);
    await page.goto('/stories/nouvelle');

    let appels = 0;
    page.on('request', (r) => {
      if (r.url().includes('/stories') && r.method() === 'POST') appels += 1;
    });

    await allerALEtape3(page);
    await bouton(page, 'Publier').click();

    await expect(
      page.getByText(/Écrivez le texte de votre story/).first(),
      'aucun refus affiché : la publication échoue en silence',
    ).toBeVisible({ timeout: 10_000 });
    expect(appels, 'un corps vide a tout de même déclenché un appel réseau').toBe(0);
    await expect(page).toHaveURL(/\/stories\/nouvelle/);
  });
});

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES SEPT CONTRÔLES QUE LE PORTEUR A TROUVÉS MORTS — MESURÉS AU CLIC        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Il a ouvert `/stories/nouvelle` et il a écrit : « ça ne s'affiche pas bien. Les
 * actions sur la texte et photo ne marche pas. Centré, gras, Changer, Recadrer,
 * Assombrir le bas. Sur l'écran 3, la recherche, les étapes et sujet. »
 *
 * C'EST LA SEULE PREUVE QUI COMPTE pour ce lot : la suite était verte pendant que
 * ces contrôles ne répondaient pas, parce qu'aucun cas ne les CLIQUAIT. Chacun est
 * donc mesuré par son effet observable — un attribut d'état, une géométrie, un style
 * CALCULÉ, un nœud qui disparaît, ou la charge interceptée.
 *
 * `getComputedStyle` et non le style en ligne : c'est ce que le navigateur applique
 * vraiment, raccourcis CSS résolus. Lire `style.textAlign` sur l'attribut aurait
 * laissé passer un `font: inherit` plus bas qui l'écrase.
 */

/** Les deux cadres sont dans le document : viser le visible, toujours. */
const visible = (page: Page, selecteur: string): Locator =>
  page.locator(selecteur).filter({ visible: true }).first();


test.describe('A14 — les contrôles de composition, mesurés au clic', () => {
  /**
   * `Aa · Gras` — LE SEUL DES CINQ QUI PART DANS LA CHARGE.
   *
   * Il était un `<span>` sans gestionnaire affichant « Gras » en dur, alors que
   * `StoryTextStyle` compte TROIS valeurs et que `createStorySchema.textStyle` les
   * exige. Deux mesures ici : le LIBELLÉ tourne à l'écran, et la valeur choisie
   * atteint `POST /stories`.
   */
  test('« Aa · Gras » tourne sur les trois styles, et le style choisi PART', async ({
    page,
    request,
  }) => {
    await membreQuiPeutPublier(page.context(), request);
    await page.goto('/stories/nouvelle');

    // Le bouton de style ne vit que sur le panneau d'ordinateur de l'étape 1.
    const style = bouton(page, 'Aa · Gras');
    test.skip(
      (await style.count()) === 0,
      'le bouton de style n’est dessiné que sur le cadre de 1440 px',
    );

    await expect(style).toBeVisible();
    // C'est bien un BOUTON, et non le `<span>` d'avant.
    expect(await style.evaluate((n) => n.tagName)).toBe('BUTTON');

    await style.click();
    await expect(bouton(page, 'Aa · Serif')).toBeVisible();
    await bouton(page, 'Aa · Serif').click();
    await expect(bouton(page, 'Aa · Mono')).toBeVisible();
    // LE CYCLE BOUCLE : « Mono » n'est pas un cul-de-sac.
    await bouton(page, 'Aa · Mono').click();
    await expect(bouton(page, 'Aa · Gras')).toBeVisible();

    /**
     * ── LA POLICE SUIT SUR L'APERÇU, ET PAS SUR L'ÉDITEUR ────────────────────
     *
     * C'est la correction que le porteur a demandée en ouvrant l'écran : « Le
     * bouton centrer et gras doivent agir sur l'écran à côté et non sur le champ
     * input. » `bodyStyle` était étalé sur LES QUATRE champs — l'aperçu changeait
     * bien, mais l'éditeur aussi, ce qui fait changer l'outil au lieu de l'ouvrage.
     *
     * Le cas d'avant ne pouvait pas le voir : il lisait « le premier champ
     * visible », qui se trouve être l'aperçu. Il était vert et la moitié de la
     * propriété n'était pas mesurée.
     */
    await bouton(page, 'Aa · Gras').click();
    // Même raison qu'au cas « Centré » : un aperçu vide n'est pas reconnaissable.
    await champCorps(page).fill('Un conseil en serif.');
    const apercu = await porteurDuCorps(page);
    const police = await apercu.evaluate((n) => getComputedStyle(n).fontFamily);
    expect(police.toLowerCase(), 'l’aperçu ne passe pas en serif').toContain('serif');

    const editeur = await champEditeur(page);
    if ((await champsVisibles(page).count()) > 1) {
      const policeEditeur = await editeur.evaluate((n) => getComputedStyle(n).fontFamily);
      expect(
        policeEditeur.toLowerCase(),
        'l’éditeur a pris la police de la story : il doit rester un éditeur',
      ).not.toContain('serif');
    }

    // ENFIN LA CHARGE : « Serif » est l'état courant. On écrit dans l'ÉDITEUR —
    // l'aperçu n'est pas saisissable en variante couleur.
    await champCorps(page).fill('Un conseil en serif.');
    const requete = page.waitForRequest(
      (r) => r.url().includes('/stories') && r.method() === 'POST',
    );
    await allerALEtape3(page);
    await bouton(page, 'Publier').click();
    const charge = JSON.parse((await requete).postData() ?? '{}') as Record<string, unknown>;
    expect(charge['textStyle'], 'le style de texte choisi n’atteint pas la charge').toBe('SERIF');
  });

  /**
   * `Centré` — VIVANT À LA COMPOSITION, ET NON CONSERVÉ.
   *
   * Les deux moitiés sont mesurées, et la seconde compte autant : aucun champ de
   * `createStorySchema` n'exprime un alignement, donc rien ne doit en partir. Ce cas
   * fixe le manque au lieu de le masquer.
   */
  test('« Centré » centre vraiment le texte, et rien n’en part', async ({ page, request }) => {
    await membreQuiPeutPublier(page.context(), request);
    await page.goto('/stories/nouvelle');

    const centre = bouton(page, 'Centré');
    test.skip((await centre.count()) === 0, '« Centré » n’est dessiné que sur le cadre de 1440 px');

    expect(await centre.evaluate((n) => n.tagName)).toBe('BUTTON');
    await expect(centre).toHaveAttribute('aria-pressed', 'false');

    /**
     * ── ON MESURE L'APERÇU, ET IL N'EST PAS TOUJOURS UN CHAMP ────────────────
     *
     * « L'écran à gauche c'est le display ou le preview de ce qui sera affiché aux
     * utilisateurs, à droite c'est juste un éditeur du contenu à gauche. »
     *
     * En variante PHOTO l'aperçu se saisit sur place (le calque déplaçable) ; en
     * variante COULEUR — l'état par défaut — c'est un bloc lié qui REFLÈTE la
     * frappe sans être modifiable. Viser « le champ » ne pouvait donc mesurer que
     * l'éditeur au premier écran, et c'est ce qui a fait croire le bouton mort une
     * fois son style retiré de l'éditeur.
     *
     * On vise donc l'élément qui PORTE LE CORPS, quel qu'il soit : le plus grand
     * texte visible du cadre. C'est une mesure, pas une classe.
     */
    /**
     * ON ÉCRIT D'ABORD, et ce n'est pas un détail de confort : tant que le corps
     * est vide, le BLOC d'aperçu ne porte aucun texte propre et `porteurDuCorps`
     * ne peut pas le reconnaître — il retombe alors sur l'éditeur, le seul champ
     * restant, et mesure le mauvais élément. C'est ce qui a fait tomber ce cas
     * alors que l'écran, lui, était juste.
     *
     * Écrire avant de styler est d'ailleurs l'ordre dans lequel un membre procède.
     */
    await champCorps(page).fill('Un conseil à centrer.');

    const champ = await porteurDuCorps(page);
    const avant = await champ.evaluate((n) => getComputedStyle(n).textAlign);

    await centre.click();
    await expect(centre).toHaveAttribute('aria-pressed', 'true');
    const apres = await champ.evaluate((n) => getComputedStyle(n).textAlign);
    expect(apres, 'l’aperçu n’est pas centré : la bascule n’agit pas').toBe('center');
    expect(apres).not.toBe(avant);

    /**
     * ET L'ÉDITEUR NE BOUGE PAS. C'est la moitié que le cas d'avant ne mesurait
     * pas, et celle que le porteur a vue : un éditeur qui se centre avec l'aperçu
     * donne deux aperçus, dont un aux mauvaises dimensions.
     */
    if ((await champsVisibles(page).count()) > 1) {
      const editeur = await champEditeur(page);
      expect(
        await editeur.evaluate((n) => getComputedStyle(n).textAlign),
        'l’éditeur s’est centré avec l’aperçu : il doit rester un éditeur',
      ).not.toBe('center');
    }

    // La bascule REVIENT : `aria-pressed` promet deux états, pas un aller simple.
    await centre.click();
    await expect(centre).toHaveAttribute('aria-pressed', 'false');
    expect(await champ.evaluate((n) => getComputedStyle(n).textAlign)).toBe(avant);

    // ET RIEN NE PART. Mesuré sur la charge réelle, pas sur le schéma.
    await centre.click();
    // `champ` est l'APERÇU, qui n'est pas saisissable en variante couleur : on
    // écrit dans l'éditeur, comme le ferait un membre.
    await champCorps(page).fill('Un conseil centré.');
    const requete = page.waitForRequest(
      (r) => r.url().includes('/stories') && r.method() === 'POST',
    );
    await allerALEtape3(page);
    await bouton(page, 'Publier').click();
    const charge = JSON.parse((await requete).postData() ?? '{}') as Record<string, unknown>;
    expect(Object.keys(charge).join(' ')).not.toMatch(/align/i);
  });

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LA PHOTO : UN VRAI FICHIER, UN VRAI TÉLÉVERSEMENT, UN VRAI IDENTIFIANT   ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le cas le plus lourd, et le seul qui prouve la cause profonde : avant ce lot il
   * n'existait AUCUN `type="file"` dans le composeur et `backgroundAssetId` ne
   * partait jamais.
   *
   * On mesure la chaîne entière : le champ existe → `POST /media` répond 201 →
   * l'aperçu montre l'image → `POST /stories` porte `backgroundAssetId` et PAS
   * `backgroundColor`, parce que le schéma exige l'un OU l'autre.
   */
  test('la photo se choisit, se téléverse, et part en `backgroundAssetId`', async ({
    page,
    request,
  }) => {
    await membreQuiPeutPublier(page.context(), request);
    await page.goto('/stories/nouvelle');

    // LE CHAMP EXISTE — c'est ce qui manquait, mesuré à zéro avant ce lot.
    await expect(champFichier(page)).toHaveCount(1);

    const media = reponseUtile(page, '/media');
    await champFichier(page).setInputFiles({
      name: 'fond.png',
      mimeType: 'image/png',
      buffer: PNG_1x1,
    });
    expect((await media).status(), 'le téléversement a été refusé').toBe(201);

    /**
     * L'APERÇU MONTRE L'IMAGE. On lit le fond CALCULÉ du cadre, et on y cherche
     * l'adresse locale (`blob:`) — c'est-à-dire la photo du membre, à la place du
     * hachurage de la maquette.
     */
    const fond = await visible(page, '[data-screen]')
      .locator('xpath=.//div[1]')
      .first()
      .evaluate((n) => getComputedStyle(n).backgroundImage)
      .catch(() => '');
    const fondPage = await page.evaluate(() => {
      const vus = [...document.querySelectorAll<HTMLElement>('*')]
        .map((n) => getComputedStyle(n).backgroundImage)
        .filter((v) => v.includes('blob:'));
      return vus.length;
    });
    expect(
      fondPage > 0 || fond.includes('blob:'),
      'la photo choisie n’apparaît nulle part : l’aperçu montre encore le hachurage',
    ).toBe(true);

    const requete = page.waitForRequest(
      (r) => r.url().includes('/stories') && r.method() === 'POST',
    );
    await champCorps(page).fill('Épicerie du samedi, mesurée au navigateur.');
    await allerALEtape3(page);
    await bouton(page, 'Publier').click();

    const charge = JSON.parse((await requete).postData() ?? '{}') as Record<string, unknown>;
    expect(
      typeof charge['backgroundAssetId'],
      '`backgroundAssetId` ne part pas : la photo n’est pas attachée',
    ).toBe('string');
    expect(
      'backgroundColor' in charge,
      'la couleur part AVEC la photo : le `.refine()` du schéma refuse les deux',
    ).toBe(false);
  });

  /**
   * ╔════════════════════════════════════════════════════════════════════════════╗
   * ║ LA BOUCLE ENTIÈRE, DANS UN SEUL NAVIGATEUR : COMPOSER → PUBLIER → RELIRE  ║
   * ╚════════════════════════════════════════════════════════════════════════════╝
   *
   * Le cas au-dessus prouve la moitié ÉCRITURE : la photo part. Il ne dit RIEN de
   * ce que le membre voit ensuite, et c'est précisément là que le produit était
   * cassé — sur DEUX ruptures distinctes, trouvées séparément :
   *
   *   1. `backgroundUrl` était codé à `null` dans la projection de story, sur les
   *      TROIS lectures. La colonne était écrite, personne ne la lisait, et
   *      `screens/story/from-api.ts` posait donc `photo: false` : l'écran de
   *      lecture retombait sur une couleur ;
   *   2. et quand bien même l'URL serait venue, AUCUNE ROUTE ne servait
   *      `/media/<clé>` — l'adresse que neuf endroits du serveur composent à la
   *      main pour les avatars, les images de publication, les photos de logement
   *      et les albums. Toutes les images du produit pointaient dans le vide.
   *
   * Chacune des deux a été mesurée et corrigée de son côté. Ce cas-ci est le seul
   * qui les traverse TOUTES LES DEUX d'un bout à l'autre, depuis le clic du membre
   * jusqu'aux octets rendus — parce que deux moitiés vertes mesurées séparément ne
   * font pas une chaîne verte, et que c'est exactement l'erreur que ce lot a faite
   * une fois.
   *
   * Ce qu'il affirme, et qu'aucun autre ne couvre :
   *   · l'écran de lecture peint la photo du membre, pas une couleur de repli ;
   *   · l'adresse qu'il emploie RÉPOND, et rend des octets d'image.
   */
  test('la photo publiée se voit à la relecture, et son adresse rend des octets', async ({
    page,
    request,
  }) => {
    await membreQuiPeutPublier(page.context(), request);
    await page.goto('/stories/nouvelle');

    const media = reponseUtile(page, '/media');
    await champFichier(page).setInputFiles({
      name: 'fond.png',
      mimeType: 'image/png',
      buffer: PNG_1x1,
    });
    expect((await media).status(), 'le téléversement a été refusé').toBe(201);

    await champCorps(page).fill('Attiéké frais le samedi matin, mesuré de bout en bout.');
    await allerALEtape3(page);

    const publication = reponseUtile(page, '/stories');
    await bouton(page, 'Publier').click();
    const reponse = await publication;

    /**
     * Le corps du refus entre dans le message : `POST /stories` rend QUATRE 422
     * différents (`CITY_REQUIRED`, `DECOUVERTE_NEEDS_CATEGORY`, …) et « la
     * publication a échoué » ne dirait pas lequel. `CITY_REQUIRED` est le plus
     * probable sur une base fraîche — le seed n'ouvre aucune ville sans l'opt-in
     * `SEED_ACTIVATE_PILOT_CITY`, et c'est une décision de produit assumée, pas un
     * trou (voir `packages/db/src/seed/pilot-city.ts`).
     */
    expect(reponse.status(), `la publication a été refusée : ${await reponse.text()}`).toBe(201);
    /**
     * LA RÉPONSE ENVELOPPE : `{ story, meta }`, et non la story à plat. Mesuré —
     * `meta.reminder` est le rappel que §4 fait voyager AVEC la réponse plutôt
     * que de le recopier dans le front, ce qui est la raison de l'enveloppe.
     */
    const { story } = (await reponse.json()) as { story?: { id?: string } };
    expect(typeof story?.id, 'la réponse ne porte pas d’identifiant de story').toBe('string');

    /**
     * ET LE FOND EST DÉJÀ RENDU DANS LA RÉPONSE DE CRÉATION : la même projection
     * sert les trois lectures, donc si `backgroundUrl` était resté à `null` c'est
     * ici qu'on le verrait en premier, sans même changer de page.
     */
    expect(
      (story as { backgroundUrl?: string | null } | undefined)?.backgroundUrl ?? null,
      'la réponse de création ne porte aucune adresse de fond',
    ).not.toBeNull();

    await page.goto(`/stories/${story?.id ?? ''}`);

    /**
     * ON ATTEND LA DONNÉE AVANT DE LIRE LES FONDS, et c'est ce qui manquait : A13
     * va chercher sa story par un appel CLIENT, donc juste après la navigation
     * l'écran rend encore son état d'attente. Lire les fonds à ce moment-là rend
     * une page sans photo — et accuse l'écran d'un défaut qui n'existe pas.
     *
     * C'est exactement le piège déjà noté pour `count()` plus haut, sous une autre
     * forme : un `evaluate` ne patiente pas. On attend donc le CORPS de la story,
     * qui ne peut venir que du serveur.
     */
    await expect(
      page.getByText('Attiéké frais le samedi matin').filter({ visible: true }).first(),
      'l’écran de lecture n’affiche pas la story publiée',
    ).toBeVisible();

    /**
     * ON CHERCHE L'ADRESSE DANS LE FOND CALCULÉ, pas un `<img>` : la maquette
     * peint la photo en `background-image` sur le cadre, et viser une balise
     * supposerait un dessin qu'elle n'écrit pas.
     */
    const adresse = await page.evaluate(() => {
      for (const n of document.querySelectorAll<HTMLElement>('*')) {
        const fond = getComputedStyle(n).backgroundImage;
        const trouve = /url\("?([^")]*\/media\/[^")]*)"?\)/.exec(fond);
        if (trouve !== null) return trouve[1] ?? '';
      }
      return '';
    });
    expect(
      adresse,
      'la story publiée ne peint aucune photo : l’écran de lecture est retombé sur une couleur',
    ).not.toBe('');

    // ET CETTE ADRESSE RÉPOND. C'est la seconde rupture, et elle ne se voit pas
    // au rendu : un fond introuvable laisse simplement le cadre vide.
    const octets = await page.request.get(adresse);
    expect(octets.status(), `l’adresse du fond ne répond pas : ${adresse}`).toBe(200);
    expect(
      octets.headers()['content-type'] ?? '',
      'l’adresse du fond ne rend pas une image',
    ).toContain('image/');
    expect((await octets.body()).length, 'l’adresse du fond rend zéro octet').toBeGreaterThan(0);
  });

  /**
   * « CHANGER » ROUVRE LE SÉLECTEUR, et c'est mesurable sans boîte de dialogue
   * système : on compte les `click` reçus par le champ de fichier lui-même. Si le
   * bouton était resté inerte, le compte resterait à zéro.
   */
  test('« Changer » rouvre le sélecteur de fichier', async ({ page, request }) => {
    await membreQuiPeutPublier(page.context(), request);
    await page.goto('/stories/nouvelle');

    await champFichier(page).setInputFiles({
      name: 'fond.png',
      mimeType: 'image/png',
      buffer: PNG_1x1,
    });

    await page.evaluate(() => {
      const champ = document.querySelector('input[type="file"]');
      if (champ === null) throw new Error('aucun champ de fichier');
      (window as unknown as { __clics: number }).__clics = 0;
      champ.addEventListener('click', (e) => {
        // On EMPÊCHE l'ouverture réelle : la boîte du système bloquerait la suite.
        e.preventDefault();
        (window as unknown as { __clics: number }).__clics += 1;
      });
    });

    await bouton(page, 'Changer').click();
    expect(
      await page.evaluate(() => (window as unknown as { __clics: number }).__clics),
      '« Changer » n’atteint pas le sélecteur de fichier',
    ).toBe(1);
  });

  /**
   * « ASSOMBRIR LE BAS » — le voile que la maquette dessine s'éteint et se rallume.
   *
   * On compte le NŒUD : le voile est un `<div>` dont le fond est le dégradé exact de
   * la maquette. Un comptage est plus sûr qu'une mesure d'opacité — il ne peut pas
   * passer pour vrai sur un élément invisible.
   */
  test('« Assombrir le bas » éteint et rallume le voile dessiné', async ({ page, request }) => {
    await membreQuiPeutPublier(page.context(), request);
    await page.goto('/stories/nouvelle');
    await champFichier(page).setInputFiles({
      name: 'fond.png',
      mimeType: 'image/png',
      buffer: PNG_1x1,
    });

    const voiles = (): Promise<number> =>
      page.evaluate(
        () =>
          [...document.querySelectorAll<HTMLElement>('div')].filter((n) =>
            getComputedStyle(n).backgroundImage.includes('linear-gradient'),
          ).length,
      );

    const allume = await voiles();
    expect(allume, 'aucun voile dessiné : le cas ne mesure rien').toBeGreaterThan(0);

    await bouton(page, 'Assombrir le bas').click();
    const eteint = await voiles();
    expect(eteint, 'le voile ne s’éteint pas : le bouton est inerte').toBeLessThan(allume);

    await bouton(page, 'Assombrir le bas').click();
    expect(await voiles(), 'le voile ne se rallume pas').toBe(allume);
  });

  /** « RECADRER » bascule le cadrage de l'aperçu — composition seulement. */
  test('« Recadrer » change le cadrage de l’aperçu', async ({ page, request }) => {
    await membreQuiPeutPublier(page.context(), request);
    await page.goto('/stories/nouvelle');
    await champFichier(page).setInputFiles({
      name: 'fond.png',
      mimeType: 'image/png',
      buffer: PNG_1x1,
    });

    const cadrage = (): Promise<string[]> =>
      page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('*')]
          .filter((n) => getComputedStyle(n).backgroundImage.includes('blob:'))
          .map((n) => getComputedStyle(n).backgroundSize),
      );

    const avant = await cadrage();
    expect(avant.length, 'la photo n’est peinte nulle part').toBeGreaterThan(0);
    expect(avant[0]).toBe('cover');

    await bouton(page, 'Recadrer').click();
    const apres = await cadrage();
    expect(apres[0], '« Recadrer » est inerte : le cadrage ne change pas').toBe('contain');
  });
});

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ L'ÉTAPE 2 — LA RECHERCHE, LE SÉLECTEUR DE PARCOURS, LES ÉTAPES, LES SUJETS ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */
test.describe('A14 — l’étape 2, où tout était mort', () => {
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ `textbox` ET NON `searchbox` — LE CHAMP A CHANGÉ DE TYPE, PAS DE NATURE  ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Cette sonde disait `searchbox`, et elle a rougi sur « la recherche est restée
   * un <div> » — un message qui accusait le mauvais coupable : le champ EST un
   * `<input>`, il a seulement changé de `type`.
   *
   * POURQUOI IL A CHANGÉ : sur `type="search"`, le navigateur dessine SON PROPRE
   * bouton d'effacement, qui n'est pas dans la maquette et dont l'allure change
   * d'un navigateur à l'autre. Le porteur l'a pris pour une icône que nous aurions
   * posée — « c'est pas beau, c'est un emoji ». On ne le supprime pas : on ne le
   * demande plus. Le rôle implicite d'un `type="text"` est `textbox`.
   *
   * LE NOM ACCESSIBLE NE BOUGE PAS, et c'est lui qui porte l'intention : la sonde
   * continue de désigner le champ par ce que l'utilisateur entend, pas par un
   * détail de balisage.
   */
  const champRecherche = (page: Page): Locator =>
    page
      .getByRole('textbox', { name: 'Rechercher une étape ou un sujet' })
      .filter({ visible: true })
      .first();

  const fenetre = (page: Page): Locator => page.locator('[data-modal="A14P"]');

  /**
   * LA FENÊTRE D'ÉTAPES, demandée par le porteur après ce lot : « mettre un
   * chevron et afficher un modal de sélection d'une étape ». La liste à plat que
   * ces cas interrogeaient n'existe plus.
   */
  const fenetreEtapes = (page: Page): Locator => page.locator('[data-modal="A14E"]');
  const lignesDEtape = (page: Page): Locator =>
    fenetreEtapes(page).locator('button[aria-pressed]');
  const ouvrirLesEtapes = async (page: Page): Promise<void> => {
    await page
      .getByRole('button', { name: /Sélectionner une étape/ })
      .filter({ visible: true })
      .first()
      .click();
    await expect(lignesDEtape(page).first()).toBeVisible({ timeout: 15_000 });
  };

  /**
   * LA RECHERCHE ET LES SUJETS. Elle filtre AUSSI les étapes, qui vivent depuis
   * dans leur fenêtre — c'est `composeur-etapes-2-3.spec.ts` qui le mesure, là où
   * les repères de cette fenêtre sont posés.
   */
  test('la recherche est un VRAI champ, et elle filtre les sujets', async ({
    page,
    request,
  }) => {
    await membreQuiPeutPublier(page.context(), request);
    await page.goto('/stories/nouvelle');
    await bouton(page, 'Suivant').click();

    const recherche = champRecherche(page);
    await expect(recherche, 'la recherche est restée un <div>').toBeVisible();
    expect(await recherche.evaluate((n) => n.tagName)).toBe('INPUT');

    // Les neuf sujets RÉELS sont là, et les cinq exemples de la maquette n'y sont plus.
    await expect(bouton(page, 'Transport')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Visale', exact: true })).toHaveCount(0);

    await recherche.fill('trans');
    await expect(bouton(page, 'Transport')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Logement', exact: true }).filter({ visible: true }),
      'le filtre ne cache rien : il ne filtre pas',
    ).toHaveCount(0);

    // Les accents ne font pas échouer la recherche.
    await recherche.fill('etudes');
    await expect(bouton(page, 'Études')).toBeVisible();

    await recherche.fill('');
    await expect(bouton(page, 'Logement')).toBeVisible();
  });

  /**
   * LE SÉLECTEUR DE PARCOURS QUE LE PORTEUR A DEMANDÉ, de bout en bout : le bouton
   * et son chevron, la fenêtre DANS la page, la liste des parcours avec leur détail,
   * le choix, et les étapes de CE parcours qui remplissent la liste.
   */
  test('« Sélectionner un parcours » ouvre une fenêtre, et les étapes du parcours choisi remplissent la liste', async ({
    page,
    request,
  }) => {
    await membreQuiPeutPublier(page.context(), request);
    await page.goto('/stories/nouvelle');
    await bouton(page, 'Suivant').click();

    /**
     * LE NOM ACCESSIBLE DU BOUTON EST LA CONCATÉNATION DE SES DEUX LIGNES, et il
     * CHANGE une fois un parcours choisi. On le désigne donc par une expression
     * régulière sur sa première ligne : un nom exact aurait fait de ce cas un piège
     * pour le prochain lot, qui ne saurait pas pourquoi il échoue.
     */
    const declencheur = page
      .getByRole('button', { name: /Sélectionner un parcours/ })
      .filter({ visible: true })
      .first();
    await expect(declencheur, 'le bouton de sélection n’est pas là').toBeVisible();
    // LE CHEVRON EST DESSINÉ, et c'est celui de la maquette (`m9 18 6-6-6-6`).
    await expect(declencheur.locator('svg path[d="m9 18 6-6-6-6"]')).toHaveCount(1);
    await expect(declencheur).toHaveAttribute('aria-haspopup', 'dialog');

    /**
     * AUCUNE ÉTAPE N'EST RETENUE AVANT TOUT CHOIX : rien n'est écrit en dur. Le
     * bouton le DIT, là où la liste à plat se contentait d'être vide.
     */
    await expect(
      page.getByRole('button', { name: /Sélectionner une étape/ }).filter({ visible: true }),
    ).toContainText('Aucune pour l’instant');

    await declencheur.click();
    const boite = fenetre(page);
    await expect(boite, 'aucune fenêtre ne s’ouvre dans la page').toBeVisible();
    await expect(boite).toHaveAttribute('aria-modal', 'true');
    // La fenêtre porte son NOM : le titre promu est bien celui qu'elle désigne.
    await expect(boite.getByRole('heading', { name: 'Sélectionner un parcours' })).toBeVisible();

    /**
     * LES QUATRE PARCOURS SEMÉS, avec LEUR DÉTAIL.
     *
     * ⚠ LEUR `description` EST VIDE sur le jeu de données : le champ existe au
     * contrat et vaut `null`. On montre donc le COMPTE D'ÉTAPES, qui est une donnée
     * vraie venue de `version.stepCount` — et aucun texte n'est inventé. Ce cas le
     * mesure plutôt que de le supposer.
     */
    /**
     * `expect(...).toBeVisible()` AVANT `count()`, et ce n'est pas un détail de style.
     *
     * MESURÉ : ce cas a échoué sur « 0 parcours » alors que la fenêtre les affichait
     * bel et bien — le cas suivant, qui clique « Étudier en France » dans la même
     * fenêtre, passait. La cause est que `count()` ne PATIENTE PAS : c'est un
     * instantané. Or la liste est chargée PARESSEUSEMENT à la première ouverture
     * (voir l'effet de `nouvelle-story-screen.tsx` : un membre qui ne touche pas au
     * sélecteur ne doit pas payer un aller-retour), donc au moment où la boîte
     * devient visible elle affiche encore « Chargement des parcours… ».
     *
     * C'est un défaut DU CAS, pas de l'écran — et exactement le genre de faux
     * négatif qui fait conclure « le modal est vide » et chercher la cause ailleurs.
     */
    const lignes = boite.getByRole('button').filter({ hasText: /étapes/ });
    await expect(lignes.first(), 'la fenêtre ne liste aucun parcours').toBeVisible({
      timeout: 15_000,
    });
    expect(await lignes.count(), 'un seul parcours listé').toBeGreaterThanOrEqual(1);
    await expect(
      boite.getByText(/\d+ étapes/).first(),
      'aucun détail à côté du parcours : ni description ni compte d’étapes',
    ).toBeVisible();

    const etudier = boite.getByRole('button', { name: /Étudier en France/ }).first();
    await expect(etudier).toBeVisible();
    await etudier.click();

    // La fenêtre se referme sur le choix, et le titre de la liste NOMME le parcours.
    await expect(boite).toHaveCount(0);
    await expect(
      page.getByText('MON PARCOURS · ÉTUDIER EN FRANCE').filter({ visible: true }).first(),
      'le titre de la liste annonce encore « ÉTUDES » en dur',
    ).toBeVisible();

    // ET LES ÉTAPES DE CE PARCOURS REMPLISSENT LA FENÊTRE — elles viennent du serveur.
    await ouvrirLesEtapes(page);
    expect(
      await lignesDEtape(page).count(),
      'la fenêtre d’étapes est restée vide',
    ).toBeGreaterThan(5);
  });

  /**
   * CHOISIR UNE ÉTAPE RENSEIGNE `stepDefinitionId`. C'est le point de tout l'écran 2
   * — la liste d'avant était écrite en dur et SANS identifiant, donc rien ne pouvait
   * partir.
   */
  test('choisir une étape envoie son `stepDefinitionId`', async ({ page, request }) => {
    await membreQuiPeutPublier(page.context(), request);
    await page.goto('/stories/nouvelle');

    await champCorps(page).fill('Un conseil rattaché à une étape réelle.');
    await bouton(page, 'Suivant').click();

    await page
      .getByRole('button', { name: /Sélectionner un parcours/ })
      .filter({ visible: true })
      .first()
      .click();
    await fenetre(page).getByRole('button', { name: /Étudier en France/ }).first().click();

    await ouvrirLesEtapes(page);
    await lignesDEtape(page).first().click();
    await expect(fenetreEtapes(page)).toHaveCount(0);
    /**
     * LE BOUTON ANNONCE CE QUI EST RETENU. C'est le seul endroit où le choix reste
     * visible depuis que la liste est dans une fenêtre : s'il gardait « Aucune pour
     * l'instant », le membre n'aurait aucun moyen de savoir ce qui part.
     */
    await expect(
      page.getByRole('button', { name: /Sélectionner une étape/ }).filter({ visible: true }),
      'le bouton ne dit pas l’étape retenue',
    ).not.toContainText('Aucune pour l’instant');

    const requete = page.waitForRequest(
      (r) => r.url().includes('/stories') && r.method() === 'POST',
    );
    await bouton(page, 'Continuer').click();
    await bouton(page, 'Publier').click();

    const charge = JSON.parse((await requete).postData() ?? '{}') as Record<string, unknown>;
    expect(
      charge['stepDefinitionId'],
      'l’étape choisie n’atteint pas la charge : la liste reste décorative',
    ).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  /** CHOISIR UN SUJET RENSEIGNE `category`, avec une valeur que le serveur accepte. */
  test('choisir un sujet envoie sa `category`', async ({ page, request }) => {
    await membreQuiPeutPublier(page.context(), request);
    await page.goto('/stories/nouvelle');

    await champCorps(page).fill('Un conseil rattaché à un sujet réel.');
    await bouton(page, 'Suivant').click();

    const transport = bouton(page, 'Transport');
    await expect(transport).toBeVisible();
    expect(await transport.evaluate((n) => n.tagName)).toBe('BUTTON');
    await transport.click();
    await expect(transport).toHaveAttribute('aria-pressed', 'true');

    const requete = page.waitForRequest(
      (r) => r.url().includes('/stories') && r.method() === 'POST',
    );
    await bouton(page, 'Continuer').click();
    await bouton(page, 'Publier').click();

    const charge = JSON.parse((await requete).postData() ?? '{}') as Record<string, unknown>;
    expect(charge['category'], 'le sujet choisi n’atteint pas la charge').toBe('TRANSPORT');
  });
});

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « ÇA NE S'AFFICHE PAS BIEN » — LA PREMIÈRE PHRASE DU PORTEUR, MESURÉE      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Avant « les actions ne marchent pas », il a écrit « ça ne s'affiche pas bien ».
 * C'est une plainte de GÉOMÉTRIE, et elle ne se vérifie pas en cliquant : ces cas
 * mesurent donc des PIXELS, jamais une classe ni un style déclaré.
 *
 * Ils portent sur ce que ce lot ajoute — le sélecteur de parcours au-dessus de la
 * liste, les neuf pastilles de sujet là où la maquette en dessine cinq — et sur ce
 * qui pourrait avoir toujours été de travers sans que personne le mesure : la
 * hauteur de la feuille de l'étape 2 et le débordement horizontal.
 *
 * Un échec ici n'accuse pas forcément ce lot. Il désigne ce que le porteur a vu.
 */
test.describe('A14 — la géométrie, parce que « ça ne s’affiche pas bien »', () => {
  test('rien ne déborde horizontalement, sur les trois étapes', async ({ page, request }) => {
    await membreQuiPeutPublier(page.context(), request);

    for (const etape of [1, 2, 3]) {
      await page.goto(`/stories/nouvelle?etape=${String(etape)}`);
      const [large, fenetre] = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        window.innerWidth,
      ]);
      expect(
        large,
        `l’étape ${String(etape)} déborde de ${String(large - fenetre)} px en largeur`,
      ).toBeLessThanOrEqual(fenetre + 1);
    }
  });

  /**
   * LA FEUILLE DE L'ÉTAPE 2 OCCUPE UNE VRAIE HAUTEUR.
   *
   * La maquette la dessine à `height:78%` d'un téléphone de 844 px, soit ~658 px, en
   * `position:absolute`. Or `ScreenFrames` RETIRE la hauteur fixe de la planche
   * (`PLANK_ONLY`) : un pourcentage de hauteur contre un conteneur de hauteur AUTO
   * retombe sur `auto`, et la feuille se réduirait à son contenu. C'est le candidat
   * le plus sérieux au « ça ne s'affiche pas bien », et il se mesure.
   *
   * La borne est VOLONTAIREMENT basse — la moitié de la fenêtre. On ne vérifie pas
   * les 78 % de la maquette (le conteneur n'a pas la même hauteur), on vérifie que
   * la feuille n'est pas écrasée.
   */
  test('la feuille de l’étape 2 n’est pas écrasée', async ({ page, request }) => {
    await membreQuiPeutPublier(page.context(), request);
    await page.goto('/stories/nouvelle?etape=2');

    /**
     * LA FEUILLE EST TROUVÉE PAR SON STYLE CALCULÉ, pas par son attribut.
     *
     * Une première version la cherchait en XPath sur
     * `contains(@style, "border-radius: 28px 28px 0px 0px")`. Elle n'a RIEN trouvé —
     * et le cas s'est SAUTÉ sur les deux largeurs, donc il n'a rien mesuré tout en
     * paraissant sain. C'est le pire des états : un cas qui se saute ressemble à un
     * cas qui n'a pas lieu d'être. La cause est que la sérialisation de l'attribut
     * `style` n'est pas celle qu'on écrit — React pose `28px 28px 0 0`, le navigateur
     * rend `0px` — et un sélecteur qui en dépend mentira un jour.
     *
     * `getComputedStyle` donne la valeur RÉSOLUE, propriété par propriété, et c'est
     * elle que le navigateur applique. On remonte depuis le titre de l'étape 2 — le
     * seul repère que la maquette garantisse — jusqu'au premier ancêtre arrondi EN
     * HAUT SEULEMENT, qui est la forme d'une feuille du bas.
     */
    const mesure = await page.evaluate(() => {
      const titre = [...document.querySelectorAll('h1, h2, div')].find(
        (n) =>
          n.textContent?.trim() === 'Ce conseil concerne…' &&
          (n as HTMLElement).offsetParent !== null,
      );
      if (titre === undefined) return null;
      let n: HTMLElement | null = (titre as HTMLElement).parentElement;
      while (n !== null) {
        const css = getComputedStyle(n);
        if (
          Number.parseFloat(css.borderTopLeftRadius) >= 20 &&
          Number.parseFloat(css.borderBottomLeftRadius) < 4
        ) {
          return { hauteur: n.getBoundingClientRect().height, fenetre: window.innerHeight };
        }
        n = n.parentElement;
      }
      return { hauteur: -1, fenetre: window.innerHeight };
    });

    expect(mesure, 'le titre « Ce conseil concerne… » n’est visible nulle part').not.toBeNull();
    if (mesure === null) return;

    /**
     * SUR LE CADRE D'ORDINATEUR il n'y a PAS de feuille : la maquette y dessine un
     * panneau de colonne, sans coins arrondis en haut seulement. Le cas le DIT, et il
     * ne peut plus se sauter sur une erreur de sélecteur — `-1` ne vient que d'une
     * remontée COMPLÈTE qui n'a pas trouvé la forme.
     */
    test.skip(mesure.hauteur === -1, 'ce cadre ne dessine pas de feuille du bas');

    expect(
      Math.round(mesure.hauteur),
      `la feuille de l’étape 2 ne fait que ${String(Math.round(mesure.hauteur))} px de haut ` +
        `pour une fenêtre de ${String(mesure.fenetre)} px : elle est écrasée, et c’est ` +
        'probablement ce que le porteur a vu en écrivant « ça ne s’affiche pas bien »',
    ).toBeGreaterThan(mesure.fenetre / 2);
  });

  /**
   * LE SÉLECTEUR EST BIEN AU-DESSUS DE LA LISTE D'ÉTAPES — « il faut ajouter une en
   * haut des étapes », a écrit le porteur. C'est une position, donc ça se mesure en
   * pixels et non en ordre de code.
   */
  test('le sélecteur de parcours est AU-DESSUS de la liste d’étapes', async ({
    page,
    request,
  }) => {
    await membreQuiPeutPublier(page.context(), request);
    await page.goto('/stories/nouvelle?etape=2');

    const declencheur = page
      .getByRole('button', { name: /Sélectionner un parcours/ })
      .filter({ visible: true })
      .first();
    await expect(declencheur).toBeVisible();

    const haut = await declencheur.boundingBox();
    expect(haut).not.toBeNull();
    if (haut === null) return;

    /** T1 §2.3 : 44 px de cible tactile au moins. */
    expect(
      Math.round(haut.height),
      'le bouton de sélection est sous la cible tactile de 44 px',
    ).toBeGreaterThanOrEqual(44);

    await declencheur.click();
    await page
      .locator('[data-modal="A14P"]')
      .getByRole('button', { name: /Étudier en France/ })
      .first()
      .click();

    /**
     * CE QUI SUIT LE SÉLECTEUR EST MAINTENANT LE BOUTON D'ÉTAPE, et non plus la
     * liste à plat : le porteur a demandé que l'étape se choisisse elle aussi dans
     * une fenêtre. La demande d'origine — « en haut des étapes » — tient telle
     * quelle, c'est son repère qui a changé.
     */
    const etape1 = page
      .getByRole('button', { name: /Sélectionner une étape/ })
      .filter({ visible: true })
      .first();
    await expect(etape1).toBeVisible({ timeout: 15_000 });
    const bas = await etape1.boundingBox();
    expect(bas).not.toBeNull();
    if (bas === null) return;

    expect(
      haut.y,
      'le sélecteur n’est pas au-dessus de l’étape : le porteur l’a demandé « en haut des étapes »',
    ).toBeLessThan(bas.y);
  });

  /**
   * LES NEUF PASTILLES DE SUJET TIENNENT DANS LEUR RANGÉE.
   *
   * La maquette en dessine CINQ et son `<sc-for>` annonce
   * `hint-placeholder-count="5"` ; la liste réelle en compte NEUF. La rangée porte
   * `flex-wrap:wrap`, donc elles doivent se replier — mais c'est une supposition tant
   * qu'on ne l'a pas mesurée, et le porteur a dit « ça ne s'affiche pas bien ».
   *
   * On vérifie que chaque pastille reste DANS la largeur de son conteneur, et qu'il y
   * a bien plusieurs lignes (donc que le repli opère au lieu de déborder).
   */
  test('les neuf pastilles de sujet se replient au lieu de déborder', async ({
    page,
    request,
  }) => {
    await membreQuiPeutPublier(page.context(), request);
    await page.goto('/stories/nouvelle?etape=2');

    const mesure = await page.evaluate(() => {
      const sujets = ['Démarches', 'Logement', 'Emploi', 'Études', 'Santé', 'Argent', 'Transport', 'Vie quotidienne', 'Autre'];
      const pastilles = [...document.querySelectorAll('button')].filter(
        (b) => b.offsetParent !== null && sujets.includes((b.textContent ?? '').trim()),
      );
      if (pastilles.length === 0) return null;
      const rangee = pastilles[0]?.parentElement;
      const borne = rangee?.getBoundingClientRect() ?? null;
      const boites = pastilles.map((b) => b.getBoundingClientRect());
      return {
        combien: pastilles.length,
        borneDroite: borne?.right ?? 0,
        debordent: boites.filter((r) => borne !== null && r.right > borne.right + 1).length,
        lignes: new Set(boites.map((r) => Math.round(r.top))).size,
      };
    });

    expect(mesure, 'aucune pastille de sujet visible').not.toBeNull();
    if (mesure === null) return;

    expect(mesure.combien, 'les neuf sujets réels ne sont pas tous rendus').toBe(9);
    expect(
      mesure.debordent,
      `${String(mesure.debordent)} pastilles sortent de leur rangée`,
    ).toBe(0);
    expect(
      mesure.lignes,
      'les neuf pastilles tiennent sur une seule ligne : le repli ne mesure rien',
    ).toBeGreaterThan(1);
  });
});
