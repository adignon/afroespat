import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { connecter } from './session';
import { monterParcours, ETAPES_COMPTEES, type MontageParcours } from './parcours-session';

/**
 * Les douze écrans du module Parcours — J01 à J11.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE FICHIER A CHANGÉ DE NATURE, ET IL FAUT SAVOIR POURQUOI.
 *
 * Il disait, et c'était exact : « ces écrans n'émettent AUCUNE requête — la
 * maquette est statique et ce lot ne branche pas l'API ». Il affirmait donc sur
 * les textes de la planche : « Mes études à Lyon », « 7 / 12 étapes », « Aïcha
 * Diop ». Et il passait SANS session, parce qu'il n'y avait rien à charger.
 *
 * Vingt-huit des trente-deux cadres LISENT désormais leurs données. Les mêmes
 * assertions sont devenues des pièges : elles passaient en mesurant une image.
 * Elles affirment maintenant sur ce que LE SERVEUR a écrit — un parcours créé par
 * `POST /journeys`, un titre posé par `PATCH /journeys/:id`, une étape franchie
 * par `PATCH …/steps/:id`, un accompagnant invité et acceptant. `monterParcours`
 * le monte, et rend ses valeurs.
 *
 * LES NOMBRES SONT ÉCRITS EN DUR. Un test de rétroplanning de ce module
 * calculait son attendu à partir de la donnée qu'il testait — il ne pouvait pas
 * échouer. `ETAPES_COMPTEES` vaut 14 parce que `STUDIES` version 3 porte quinze
 * étapes dont une facultative (§3.2), et ce nombre est figé sur une charge
 * relevée dans `packages/shared/src/__tests__/journeys-responses.test.ts`.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ce que ces tests éprouvent n'est PAS le dessin : il est transcodé de
 * `docs/template/04 Parcours.dc.html`, donc il est celui de la maquette par
 * construction. Ils éprouvent ce qu'une image ne peut pas contenir — la bascule
 * de forme au bon seuil, les états que l'URL choisit, les règles du dossier que
 * l'écran doit rendre visibles, et les valeurs qui viennent du serveur.
 *
 * Les assertions portent sur la GÉOMÉTRIE, les RÔLES et les DONNÉES, jamais sur
 * des classes : le balisage vient de la maquette en styles en ligne, et viser une
 * classe se casserait à la première régénération.
 */

/** Ce fichier pilote lui-même ses tailles : un seul projet suffit. */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'piloté par le test');

/**
 * ─── ATTENDRE QUE LA PLANCHE SOIT LÀ, ET PAS SEULEMENT LA PAGE ─────────────
 *
 * `networkidle` ET NON `load` : l'ancienne version employait `load` en
 * l'expliquant — « ces écrans n'émettent AUCUNE requête ». Ils en émettent
 * maintenant une à trois chacun.
 *
 * ET ON ATTEND `[data-screen]`, ce qui est la moitié qui a mordu. `ScreenFrames`
 * ne pose cet attribut que sur la planche ; tant que les données chargent,
 * `EcranParcoursDonnees` rend « Chargement de votre parcours… » — un `role=status`
 * sans un seul bouton, sans `<h1>`, et qui ne déborde jamais.
 *
 * LES ASSERTIONS DE PLAYWRIGHT RÉESSAIENT ; `page.evaluate` NON. Les tests qui
 * cherchent un texte passaient donc sans rien attendre, et les tests qui MESURENT
 * — débordement horizontal, cibles tactiles — mesuraient l'état de chargement.
 * Celui des cibles tactiles a rougi (il exige de retrouver ses écarts connus,
 * exprès) ; celui du débordement, lui, était VERT en mesurant une phrase centrée.
 * C'est le succès vide dans sa forme la plus pure : il aurait gardé cette règle
 * pendant des mois sans jamais regarder un écran.
 */
async function visiter(page: Page, url: string, width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  /**
   * `load` ET NON `networkidle` : Next précharge les liens visibles d'une page App
   * Router, et le réseau ne retombe pas au calme sur les pages de parcours —
   * `goto` expirait à 30 s, et dix cas étaient comptés échoués sans jamais avoir
   * été EXÉCUTÉS. Même cause et même correction que `e2e/services.spec.ts`,
   * `e2e/a11y.spec.ts` et `visual/screens.spec.ts`.
   */
  await page.goto(url, { waitUntil: 'load' });
  await page.locator('[data-screen]').first().waitFor({ state: 'attached', timeout: 20_000 });

  /**
   * ET LA DONNÉE, PAS SEULEMENT LE CADRE. `EcranDonnees` rend le SQUELETTE tant
   * que la réponse n'est pas là : `[data-screen]` existe dès le premier rendu.
   *
   * MESURÉ : en passant de `networkidle` à `load`, la navigation est devenue assez
   * rapide pour que le relevé de cibles tactiles tombe sur le squelette — il n'y
   * trouvait AUCUN bouton, et la garde de non-vacuité du cas l'a dit mot pour mot :
   * « « button « Écrire » » n'est plus mesuré à /parcours/publics ». C'est
   * exactement le rôle de cette garde, et elle a joué.
   */
  await page
    .locator('[role="status"]')
    .filter({ hasText: /Chargement/ })
    .first()
    .waitFor({ state: 'detached', timeout: 20_000 })
    .catch(() => {
      /** Tous les écrans de ce module n'ont pas de bande : son absence n'est pas un échec. */
    });
}

/** Le cadre d'ordinateur, le seul visible au-delà de 1024 px. */
const desktop = (page: Page) => page.locator('[data-frame="desktop"]');

test.describe('les douze routes du module', () => {
  /**
   * LE TITRE DE CHAQUE ROUTE, et d'où il vient.
   *
   * Quatre titres sont des DONNÉES : le titre du parcours (J01, J01M), celui de
   * l'étape (J01S), et le prénom du membre sur la fiche publique (J09F). Ils sont
   * calculés depuis le montage, pas recopiés de la planche — c'est le contraire
   * de « un titre de page inventé », la faute qui avait coûté A01.
   *
   * Les huit autres sont des titres de SECTION que la maquette écrit en clair et
   * qui ne dépendent d'aucun membre : « Équipe », « Historique »…
   */
  const routes = (m: MontageParcours) =>
    [
      { url: '/parcours', titre: 'Mes parcours', ecran: 'J11' },
      { url: '/parcours/nouveau', titre: 'Créer un parcours', ecran: 'J02' },
      { url: `/parcours/${m.journeyId}`, titre: m.titre, ecran: 'J01' },
      {
        url: `/parcours/${m.journeyId}/etapes/${m.etapeCourante.id}`,
        titre: m.etapeCourante.titre,
        ecran: 'J01S',
      },
      { url: `/parcours/${m.journeyId}/discussion`, titre: 'Discussion du parcours', ecran: 'J01D' },
      { url: `/parcours/${m.journeyId}/equipe`, titre: 'Équipe', ecran: 'J05' },
      { url: `/parcours/${m.journeyId}/documents`, titre: 'Checklist de documents', ecran: 'J06' },
      { url: `/parcours/${m.journeyId}/historique`, titre: 'Historique', ecran: 'J07' },
      { url: `/parcours/${m.journeyId}/reglages`, titre: 'Réglages du parcours', ecran: 'J08' },
      { url: `/parcours/${m.journeyId}/abouti`, titre: 'Vous y êtes arrivé·e !', ecran: 'J10' },
      { url: '/parcours/publics', titre: 'Parcours publics', ecran: 'J09' },
      { url: `/parcours/publics/${m.journeyPublicId}`, titre: 'Parcours de Ibrahim', ecran: 'J09F' },
    ] as const;

  test('les douze routes rendent leur écran et portent SON titre', async ({ page, context, request }) => {
    const m = await monterParcours(context, request);
    for (const { url, titre, ecran } of routes(m)) {
      await visiter(page, url);
      await expect(page.locator(`[data-screen="${ecran}"]`), url).toHaveCount(1);

      /**
       * Le titre est cherché par RÔLE, dans le cadre VISIBLE.
       *
       * `ScreenFrames` rend les deux cadres et en masque un par CSS : les deux
       * portent donc un `<h1>`, et un locator non scopé en trouverait deux. Le
       * scoper au cadre visible mesure ce que le membre voit.
       */
      await expect(desktop(page).getByRole('heading', { level: 1 }), url).toHaveText(titre);
    }
  });
});

/**
 * ─── CE QUE LES ÉCRANS AFFICHENT VIENT DU SERVEUR ──────────────────────────
 *
 * Un cadre peut avoir une signature `props` et n'afficher QUE des valeurs de
 * maquette : il suffit que le `donnees` déclaré n'ait rien lié d'important. Ces
 * tests le rendent impossible — ils exigent la valeur que le serveur a écrite, ET
 * l'ABSENCE de celle que la maquette dessine.
 *
 * L'absence est la moitié qui compte. Sans elle, un écran qui afficherait les
 * deux — la vraie donnée quelque part et « Mes études à Lyon » ailleurs —
 * passerait.
 */
test.describe('les écrans affichent les valeurs du SERVEUR, pas celles de la planche', () => {
  test('J01 — titre, pays d’origine, équipe et étape en cours viennent de l’API', async ({ page, context, request }) => {
    const m = await monterParcours(context, request);
    await visiter(page, `/parcours/${m.journeyId}`);
    const cadre = desktop(page);

    await expect(cadre.getByText(m.titre).first()).toBeVisible();
    // « Cotonou → Lyon » de la planche : le pays est ce que l'API sait, la ville
    // d'origine n'existe sur aucune route de parcours. Écart remonté au porteur.
    await expect(cadre.getByText('Bénin → Lyon', { exact: false })).toBeVisible();
    // §3.4 — le propriétaire D'ABORD, puis les membres. Le propriétaire n'est pas
    // dans `members` : un écran qui lirait `members` seul l'omettrait.
    await expect(cadre.getByText('Awa Porteuse (vous)')).toBeVisible();
    await expect(cadre.getByText('Aicha Accompagnante')).toBeVisible();
    await expect(cadre.getByText(m.etapeCourante.titre).first()).toBeVisible();
    // La frise ne montre QUE les étapes franchies : la première, et elle seule.
    await expect(cadre.getByText(m.etapeFranchie.titre).first()).toBeVisible();

    // ET LE TEXTE DE LA PLANCHE A DISPARU.
    await expect(cadre.getByText('Mes études à Lyon')).toHaveCount(0);
    await expect(cadre.getByText('Aïcha Diop')).toHaveCount(0);
    await expect(cadre.getByText('Moussa Diallo')).toHaveCount(0);
  });

  test('J01 — le dénominateur est `totalCount`, qui EXCLUT l’étape facultative (§3.2)', async ({ page, context, request }) => {
    const m = await monterParcours(context, request);
    await visiter(page, `/parcours/${m.journeyId}`);
    /**
     * QUATORZE, ÉCRIT EN DUR, et c'est tout l'objet de ce test.
     *
     * `STUDIES` version 3 porte QUINZE étapes dont UNE facultative. Un écran qui
     * aurait pris `steps.length` pour dénominateur écrirait « 1 / 15 » — et un
     * membre qui franchit tout verrait « 14 / 15 » à 100 %. L'attendu ne peut pas
     * être calculé depuis la donnée : il vient du modèle, pas de la réponse.
     */
    await expect(desktop(page).getByText(`1 / ${ETAPES_COMPTEES} étapes`)).toBeVisible();
    await expect(desktop(page).getByText('7 / 12 étapes')).toHaveCount(0);
  });

  test('J06 — la checklist vient du modèle, et le bandeau vient de `meta` (§3.3)', async ({ page, context, request }) => {
    const m = await monterParcours(context, request);
    await visiter(page, `/parcours/${m.journeyId}/documents`);
    const cadre = desktop(page);
    // Les six libellés du modèle `CAMPUS_FRANCE_FILE`, dans le seed.
    await expect(cadre.getByText('Passeport valide')).toBeVisible();
    await expect(cadre.getByText('Relevés de notes')).toBeVisible();
    await expect(cadre.getByText(`0 / 6`)).toBeVisible();
    // La phrase de §3.3 vient du SERVEUR (`meta.checklistNotice`).
    await expect(cadre.getByText('Les documents restent chez vous')).toBeVisible();
    // Et les libellés de la planche ne sont plus là.
    await expect(cadre.getByText('Attestation Visale')).toHaveCount(0);
  });

  test('J07 — le journal vient de `GET /journeys/:id/activities` (§3.8)', async ({ page, context, request }) => {
    const m = await monterParcours(context, request);
    await visiter(page, `/parcours/${m.journeyId}/historique`);
    const cadre = desktop(page);
    await expect(cadre.getByText(`${m.etapeFranchie.titre} franchie`)).toBeVisible();
    await expect(cadre.getByText(`${m.etapeCourante.titre} commencée`)).toBeVisible();
    await expect(cadre.getByText('Jalon partagé : Visa étudiant')).toHaveCount(0);
  });

  test('J05 — l’équipe, ses deux rôles réels, et la pastille « Parraine » qui ne sort jamais', async ({ page, context, request }) => {
    const m = await monterParcours(context, request);
    await visiter(page, `/parcours/${m.journeyId}/equipe`);
    const cadre = desktop(page);
    await expect(cadre.getByText('Awa Porteuse (vous)')).toBeVisible();
    await expect(cadre.getByText('Propriétaire')).toBeVisible();
    await expect(cadre.getByText('Aicha Accompagnante')).toBeVisible();
    await expect(cadre.getByText('Accompagnant').first()).toBeVisible();
    /**
     * `JourneyMemberRole` NE CONNAÎT QUE `OBSERVER` ET `SUPPORTER`.
     *
     * La maquette dessine une quatrième pastille, « Parraine », en orange. Aucune
     * donnée des routes de parcours ne la déclenche — « parrain » est un rôle du
     * PARRAINAGE. Ce test fige l'écart : si « Parraine » réapparaît, c'est qu'un
     * libellé a été inventé côté écran.
     */
    await expect(cadre.getByText('Parraine')).toHaveCount(0);
  });

  test('J11 — mes parcours, et la limite du plan vient de la constante partagée (§3.1)', async ({ page, context, request }) => {
    const m = await monterParcours(context, request);
    await visiter(page, '/parcours');
    const cadre = desktop(page);
    await expect(cadre.getByText(m.titre).first()).toBeVisible();
    /**
     * « 1 parcours actif sur 1 » — LE DÉNOMINATEUR EST `JOURNEY_FREE_ACTIVE_LIMIT`.
     *
     * Écrit en dur ici, et c'est voulu : la constante du front et celle du serveur
     * doivent dire la même chose, et le seul moyen de le vérifier est de l'écrire
     * une troisième fois, à la main, dans le test. Si le plan change, ce test
     * rougit — ce qui est exactement ce qu'on veut d'une borne affichée.
     */
    await expect(cadre.getByText('1 parcours actif sur 1')).toBeVisible();
    await expect(cadre.getByText('Faire venir ma sœur')).toHaveCount(0);
  });

  test('J09 — le parcours PUBLIC d’un autre membre, jamais son titre personnel (§3.7)', async ({ page, context, request }) => {
    const m = await monterParcours(context, request);
    await visiter(page, '/parcours/publics');
    const cadre = desktop(page);
    await expect(cadre.getByText('Ibrahim Inconnu').first()).toBeVisible();
    /**
     * RÈGLE DURE §3.7 : « jamais le titre personnel ». Le serveur ne le renvoie
     * même pas, et `publicJourneySchema` est `.strict()` : s'il se mettait à le
     * faire, l'appel ÉCHOUERAIT au lieu que zod le dépouille en silence. Ce test
     * est le dernier rempart, côté écran.
     */
    await expect(cadre.getByText('Son chemin à lui')).toHaveCount(0);
    await expect(cadre.getByText('Fatou Ndiaye')).toHaveCount(0);
  });
});

/**
 * ─── LA SESSION EST REPRISE AVANT LA PREMIÈRE LECTURE ──────────────────────
 *
 * Cette règle n'était gardée par RIEN, et c'est une mutation qui l'a dit : on a
 * retiré la reprise de session de `EcranParcoursDonnees`, et les quarante-trois
 * autres tests sont restés VERTS. Ils le resteraient toujours — le socle
 * rafraîchit sur `401` puis rejoue, donc l'écran s'affiche quand même.
 *
 * Ce qu'on perd sans la règle n'est donc pas visible à l'écran, et c'est
 * précisément pourquoi il faut le mesurer ailleurs : un `401` par page dans le
 * journal du serveur, sur une session parfaitement valide. Mesuré au navigateur
 * avant correction : DIX pour douze écrans. Un signal qui crie tout le temps ne
 * veut plus rien dire — et sur une route de lecture publique, le serveur
 * répondrait `200` avec la vue VISITEUR, sans même un `401` pour le dire.
 *
 * On compte donc les `401`. Zéro, et pas « peu » : le seuil est le seul attendu
 * qui ne devienne pas faux par accumulation.
 */
test.describe('la session est assurée avant toute lecture', () => {
  test('aucune réponse 401 au chargement de deux écrans qui lisent', async ({ page, context, request }) => {
    const m = await monterParcours(context, request);
    const refus: string[] = [];
    page.on('response', (r) => {
      if (r.status() === 401) refus.push(`${r.request().method()} ${r.url()}`);
    });

    await visiter(page, `/parcours/${m.journeyId}`);
    await visiter(page, `/parcours/${m.journeyId}/equipe`);

    expect(
      refus,
      'un appel est parti avant que la session soit reprise',
    ).toEqual([]);
  });
});

test.describe('la bascule ordinateur / mobile au seuil de 1024 px (§10.1)', () => {
  /**
   * Le rail vertical de 76 px est la signature du cadre ORDINATEUR (T5 §0 :
   * « rail vertical 76 px à gauche »). La barre d'onglets à cinq entrées est
   * celle du cadre MOBILE. Les deux sont dans le document ; c'est la VISIBILITÉ
   * qui bascule, pas le rendu.
   */
  for (const { w, rail } of [
    { w: 1023, rail: false },
    { w: 1024, rail: true },
  ] as const) {
    test(`${w} px — rail ${rail ? 'visible' : 'masqué'}`, async ({ page, context, request }) => {
      const m = await monterParcours(context, request);
      await visiter(page, `/parcours/${m.journeyId}`, w);
      const nav = page.locator('nav');
      if (rail) {
        await expect(nav).toBeVisible();
        expect((await nav.boundingBox())?.width).toBe(76);
        await expect(page.getByText('Compte', { exact: true })).toBeHidden();
      } else {
        await expect(nav).toBeHidden();
        await expect(page.getByText('Compte', { exact: true })).toBeVisible();
      }
    });
  }

  test('la colonne de contenu ne dépasse pas 660 px et la colonne de contexte fait 300 px', async ({
    page,
    context,
    request,
  }) => {
    const m = await monterParcours(context, request);
    await visiter(page, `/parcours/${m.journeyId}`, 1440);
    const main = await page.locator('[data-frame="desktop"] main').boundingBox();
    expect(main?.width, 'le contenu ne dépasse pas 660 px (§10.1)').toBeLessThanOrEqual(660);
    const aside = await page.locator('[data-frame="desktop"] aside').boundingBox();
    expect(aside?.width, 'la colonne de contexte fait 300 px').toBe(300);
  });
});

/**
 * LES ÉTATS QUE LA MAQUETTE DESSINE.
 *
 * Chacun est une PLANCHE à part — « aucun parcours », « parcours abouti »,
 * « plan atteint », « variante Régulariser », « modifier les étapes ». Un état
 * que l'URL ne saurait pas atteindre serait une planche transcodée pour rien.
 */
test.describe('les états de §6 sont atteignables', () => {
  test('?etat=vide — les TYPES de parcours viennent de `GET /journey-templates` (§2.1)', async ({ page, context, request }) => {
    const m = await monterParcours(context, request);
    await visiter(page, `/parcours/${m.journeyId}?etat=vide`);
    await expect(desktop(page).getByRole('heading', { level: 1 })).toHaveText(
      'Commencez votre parcours',
    );
    /**
     * LE NOMBRE D'ÉTAPES VIENT DE LA VERSION DU MODÈLE, PAS DE LA MAQUETTE.
     *
     * Elle écrit « Étudier · 12 étapes ». L'API répond QUINZE pour `STUDIES`,
     * parce que le modèle a été rechargé en version 3. Recopier le nombre de la
     * planche afficherait un engagement faux au moment précis où le membre
     * choisit son parcours — c'est le défaut que ce test interdit.
     */
    await expect(desktop(page).getByText('Étudier en France')).toBeVisible();
    await expect(desktop(page).getByText('15 étapes').first()).toBeVisible();
    await expect(desktop(page).getByText('12 étapes')).toHaveCount(0);
  });

  test('?etat=abouti — la progression du SERVEUR, pas « 12 / 12 » (§3.9)', async ({ page, context, request }) => {
    const m = await monterParcours(context, request);
    await visiter(page, `/parcours/${m.journeyId}?etat=abouti`);
    // Une étape franchie sur quatorze comptées. La planche écrit « 12 / 12 » ;
    // l'écran ne peut plus le dire.
    await expect(desktop(page).getByText(`1 / ${ETAPES_COMPTEES} étapes`)).toBeVisible();
    await expect(desktop(page).getByText('12 / 12 étapes')).toHaveCount(0);
  });

  test('?etat=parcours — le sélecteur ouvert, page complète sur ordinateur', async ({ page, context, request }) => {
    const m = await monterParcours(context, request);
    await visiter(page, `/parcours/${m.journeyId}?etat=parcours`, 1440);
    // La liste est DANS la page, pas dans une fenêtre : `mobileOnly` interdit la
    // feuille au-dessus de 1024 px.
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // Mon parcours y est, et les deux parcours d'exemple de la planche n'y sont
    // plus : la liste vient de `GET /journeys`.
    await expect(desktop(page).getByText(m.titre).first()).toBeVisible();
    await expect(desktop(page).getByText('Changer de statut')).toHaveCount(0);
    await expect(desktop(page).getByText('Faire venir ma sœur')).toHaveCount(0);
  });

  test('?etat=parcours — la même chose devient une FEUILLE sous 1024 px', async ({ page, context, request }) => {
    const m = await monterParcours(context, request);
    await visiter(page, `/parcours/${m.journeyId}?etat=parcours`, 390);
    const dialogue = page.getByRole('dialog', { name: /Mes parcours/ });
    await expect(dialogue).toBeVisible();

    const boite = await dialogue.locator('[data-modal-panel]').boundingBox();
    expect(boite).not.toBeNull();
    if (boite === null) return;
    // Toute la largeur, posée sur le bord bas : c'est ce qui fait une feuille.
    expect(Math.round(boite.width)).toBe(390);
    expect(Math.round(boite.y + boite.height)).toBeGreaterThanOrEqual(898);
  });

  /**
   * LE TITRE DE LA FEUILLE EST UNE DONNÉE, ET IL RESTE LE NOM ACCESSIBLE.
   *
   * La maquette écrit « Mes parcours · 3 ». Le trois est devenu
   * `{{ total }}` — le nombre de MES parcours, de `GET /journeys` — et
   * `retitrerSurDonnees` reprend le titre sur sa forme liée pour que
   * `aria-labelledby` continue de le désigner. Sans cette reprise, la boîte de
   * dialogue perdait son nom : un lecteur d'écran annoncerait « dialogue ».
   */
  test('?etat=parcours — le compteur du titre vient de l’API, et nomme toujours la fenêtre', async ({ page, context, request }) => {
    const m = await monterParcours(context, request);
    await visiter(page, `/parcours/${m.journeyId}?etat=parcours`, 390);
    const dialogue = page.getByRole('dialog', { name: 'Mes parcours · 1' });
    await expect(dialogue).toBeVisible();
    // Et le décor de l'écran de dessous n'est pas revenu : le titre du parcours
    // n'y figure qu'UNE fois, dans la ligne du parcours courant.
    await expect(dialogue.getByText(m.titre, { exact: true })).toHaveCount(1);
  });

  test('?etat=edition — « Modifier les étapes », mobile seulement', async ({ page, context, request }) => {
    const m = await monterParcours(context, request);
    await visiter(page, `/parcours/${m.journeyId}?etat=edition`, 390);
    await expect(
      page.locator('[data-frame="mobile"]').getByRole('heading', { level: 1 }),
    ).toHaveText('Modifier les étapes');

    // Sur ordinateur la maquette ne dessine PAS ce mode : on garde la vue
    // d'ensemble plutôt que d'inventer l'écran manquant. Son titre est le TITRE
    // DU PARCOURS, donc une donnée.
    await visiter(page, `/parcours/${m.journeyId}?etat=edition`, 1440);
    await expect(desktop(page).getByRole('heading', { level: 1 })).toHaveText(m.titre);
  });

  test('?etape=plan — « plan atteint » SANS bloquer la lecture (§3.1)', async ({
    page,
    request,
  }) => {
    /**
     * ╔═══════════════════════════════════════════════════════════════════════╗
     * ║ « CETTE ROUTE N'A BESOIN D'AUCUNE SESSION » — ce n'est plus vrai        ║
     * ╚════════════════════════════════════════════════════════════════════════╝
     *
     * Le commentaire précédent disait « J02 n'a pas été rebranché par ce lot : ses
     * planches restent statiques ». MESURÉ au navigateur aujourd'hui :
     * `/parcours/nouveau` rend L'ÉCRAN DE CONNEXION — « Votre numéro de
     * téléphone ». La route est passée sous garde depuis.
     */
    await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    await visiter(page, '/parcours/nouveau?etape=plan', 390);
    const cadre = page.locator('[data-frame="mobile"]');
    /**
     * 20 s SUR LE PREMIER REPÈRE, et sur lui seul.
     *
     * Le volet est choisi par `?etape=…`, LU CÔTÉ CLIENT : il n'existe donc pas
     * dans le HTML servi, et il n'apparaît qu'après l'hydratation. `load` rend la
     * main avant — c'est tout l'intérêt du passage à `load`, et c'en est le prix
     * ici. Les assertions suivantes gardent les 5 s par défaut : une fois le
     * premier repère là, l'écran entier l'est.
     */
    await expect(cadre.getByText('Vous avez déjà un parcours actif')).toBeVisible({
      timeout: 20_000,
    });
    /**
     * §3.1 : « encart avec bouton Premium, SANS BLOQUER LA LECTURE ». Les types
     * de parcours doivent rester lisibles SOUS l'encart — c'est la moitié de la
     * règle qu'on oublie, et la seule qu'un écran puisse trahir.
     */
    /**
     * ╔════════════════════════════════════════════════════════════════════════╗
     * ║ LA RÈGLE, PAS LE LIBELLÉ DE LA MAQUETTE                                 ║
     * ╚════════════════════════════════════════════════════════════════════════╝
     *
     * « Étudier · 12 étapes » était écrit en dur : c'est ce que la PLANCHE dessine.
     * La donnée dit « Étudier en France · 15 étapes » — relevé au navigateur. Ce cas
     * ne passait donc que sur le squelette, et il a rougi dès qu'une session a été
     * ouverte.
     *
     * CE QUE §3.1 EXIGE, c'est que les types de parcours restent LISIBLES sous
     * l'encart Premium — pas qu'ils portent tel ou tel nom. On mesure donc la
     * règle : au moins un type, avec son compte d'étapes, visible sous l'encart.
     */
    await expect(
      cadre.getByText(/\u00b7 \d+ \u00e9tapes?/).first(),
      'les types de parcours doivent rester lisibles SOUS l\u2019encart',
    ).toBeVisible();
  });

  test('?etape=regulariser — les trois sous-situations (§3.1)', async ({ page, request }) => {
    await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    await visiter(page, '/parcours/nouveau?etape=regulariser', 390);
    const cadre = page.locator('[data-frame="mobile"]');
    for (const choix of ['Régularisation', 'Changement de statut', 'Renouvellement']) {
      await expect(cadre.getByText(choix, { exact: true })).toBeVisible();
    }
  });

  test('un état inconnu ne casse pas la page', async ({ page, context, request }) => {
    const m = await monterParcours(context, request);
    // L'URL est publique : une valeur fantaisiste est IGNORÉE, pas affichée.
    await visiter(page, `/parcours/${m.journeyId}?etat=nimporte-quoi`);
    await expect(desktop(page).getByRole('heading', { level: 1 })).toHaveText(m.titre);
  });
});

/**
 * ─── UN SEGMENT QUI N'EST PAS UN IDENTIFIANT LAISSE L'ÉCRAN INERTE ─────────
 *
 * `/parcours/1/etapes/7` est l'URL des planches d'illustration. Prendre « 1 »
 * pour un parcours ferait partir `GET /journeys/1`, que le serveur refuse en
 * `400 VALIDATION_FAILED` — et le membre verrait une bannière d'erreur pour avoir
 * ouvert une démonstration.
 *
 * Ce test mesure les TROIS moitiés de la propriété : l'écran s'affiche, aucun
 * appel de parcours ne part, et aucun message d'erreur n'apparaît. Les trois,
 * parce que chacune seule se satisfait trop facilement — un écran blanc n'émet
 * aucun appel, lui non plus.
 */
test.describe('l’URL d’illustration reste inerte', () => {
  test('/parcours/1/etapes/7 — aucun appel de parcours, aucune erreur, et l’écran est là', async ({ page, context, request }) => {
    await monterParcours(context, request);
    const appels: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/journey')) appels.push(`${r.method()} ${r.url()}`);
    });
    await visiter(page, '/parcours/1/etapes/7');

    await expect(page.locator('[data-screen="J01S"]')).toHaveCount(1);
    expect(appels, 'aucune route de parcours ne doit partir sur un segment non-UUID').toEqual([]);
    const alerte = page.locator('[role="alert"]');
    // `FlowError` rend toujours la région annoncée : c'est son TEXTE qui compte.
    await expect(alerte).toHaveText('');
  });
});

/**
 * §3.7 — LA VUE PUBLIQUE, règle dure.
 *
 * « Ce que voit un membre connecté sur un parcours public : … **Jamais** : titre
 * personnel, notes, checklist, équipe, discussion, motifs de pause, dates
 * cibles. »
 *
 * Le serveur la tient (il ne renvoie pas les champs, et le schéma est `.strict()`
 * pour que l'inverse ÉCHOUE au lieu d'être dépouillé). L'ÉCRAN doit la tenir
 * aussi : s'il affichait un titre personnel sur la fiche d'un autre, la règle
 * serait trahie côté client alors que l'API est juste.
 */
test.describe('§3.7 — la vue publique ne montre pas ce qu’elle ne doit pas', () => {
  test('aucun titre personnel de parcours sur la fiche publique', async ({ page, context, request }) => {
    const m = await monterParcours(context, request);
    await visiter(page, `/parcours/publics/${m.journeyPublicId}`);
    const corps = page.locator('[data-screen="J09F"]');

    // Le membre, le type et la ville, oui. Le titre qu'il a donné, jamais.
    await expect(corps.getByText('Ibrahim Inconnu')).toBeVisible();
    await expect(corps.getByText('Parcours Études · Lyon')).toBeVisible();
    await expect(corps.getByText('Son chemin à lui')).toHaveCount(0);
    // Ni le mien, ni celui de la planche.
    await expect(corps.getByText(m.titre)).toHaveCount(0);
    await expect(corps.getByText('Mes études à Lyon')).toHaveCount(0);
  });

  test('la fiche annonce elle-même ce qu’elle ne montre pas', async ({ page, context, request }) => {
    const m = await monterParcours(context, request);
    await visiter(page, `/parcours/publics/${m.journeyPublicId}`);
    await expect(
      page.getByText('Lecture seule · aucune note, checklist, équipe ni discussion'),
    ).toBeVisible();
  });

  /**
   * ET L'ÉTAPE EN COURS N'EST PAS LA MÊME CLÉ QUE DANS LA LISTE.
   *
   * `GET /journeys/public/:id` rend `currentStep`, `GET /journeys/public` NON.
   * C'est le piège déjà payé entre `GET /journeys` et `GET /journeys/:id`, une
   * seconde fois dans le même module. La fiche doit donc nommer l'étape ; la
   * liste ne peut pas.
   */
  test('la FICHE nomme l’étape en cours, que la LISTE ne porte pas', async ({ page, context, request }) => {
    const m = await monterParcours(context, request);
    await visiter(page, `/parcours/publics/${m.journeyPublicId}`);
    // La seconde étape du modèle `STUDIES` : celle qui suit l'étape franchie.
    await expect(
      page.locator('[data-screen="J09F"]').getByText('Constituer le dossier Campus France'),
    ).toBeVisible();
  });
});

/**
 * AUCUN DÉBORDEMENT HORIZONTAL, À AUCUNE LARGEUR.
 *
 * C'est le symptôme n°1 d'une interface non responsive, et celui que les
 * adaptations de cadre du générateur risquent le plus d'introduire : elles
 * rendent des colonnes collantes, ouvrent des bandes à défilement horizontal et
 * retirent les bornes de hauteur du cadre mobile. Chacune peut faire dépasser
 * quelque chose par la droite, et rien dans la maquette ne peut le révéler —
 * une image de 1440 px de large ne déborde jamais.
 *
 * LA SESSION EST OUVERTE POUR DE BON ICI. Sans elle, `/parcours/publics` affichait
 * son écran d'échec — une phrase centrée, qui ne déborde jamais. Le test passait
 * en mesurant un écran d'erreur : un succès qui ne prouve rien.
 */
const LARGEURS = [320, 360, 390, 430, 768, 1023, 1024, 1279, 1440, 1920] as const;

test.describe('aucun débordement horizontal', () => {
  for (const w of LARGEURS) {
    test(`${w} px — les trois charpentes du module`, async ({ page, context, request }) => {
      const m = await monterParcours(context, request);
      /**
       * TROIS ÉCRANS, choisis pour leurs FORMES et non pour faire nombre.
       *
       *   · la page d'un parcours — trois colonnes : rail, panneau collant de
       *     400 px, contenu borné à 660, colonne de contexte collante de 300.
       *     C'est elle qui porte le plus d'adaptations de cadre ;
       *   · la page d'une étape — la même charpente, le cadre le plus haut ;
       *   · les parcours publics — des cartes en grille, la seule mise en page du
       *     module qui ne soit pas une colonne.
       */
      for (const url of [
        `/parcours/${m.journeyId}`,
        `/parcours/${m.journeyId}/etapes/${m.etapeCourante.id}`,
        '/parcours/publics',
      ]) {
        await visiter(page, url, w);
        const mesure = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          inner: window.innerWidth,
        }));
        expect(
          mesure.scroll,
          `${url} à ${w} px : ${mesure.scroll} px pour ${mesure.inner} px de fenêtre`,
        ).toBeLessThanOrEqual(mesure.inner + 1);

        /**
         * Et rien ne sort par la droite — sauf dans un conteneur à défilement
         * horizontal, où dépasser est le comportement voulu (les barres
         * d'onglets du module défilent par conception).
         */
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

/**
 * CIBLES TACTILES — LA LISTE DES ÉCARTS EST FIGÉE, PAS LE SEUIL.
 *
 * `T1` §2.3 demande 44 px au doigt. Quelques contrôles du module ne l'atteignent
 * pas, et ils sont NOMMÉS ici un par un. Ce n'est pas une tolérance : c'est la
 * même discipline que `check-contrast.mjs`, qui liste ses huit paires sous le
 * seuil AA avec leur ratio et échoue sur toute paire NOUVELLE. Un écart nommé
 * reste sous les yeux ; un seuil abaissé disparaît.
 *
 * ── CE QUI A CHANGÉ : ON FIGE LES LIBELLÉS, PLUS LE COMPTE ─────────────────
 *
 * L'ancienne version comparait un NOMBRE : « deux cartes publiques, donc DEUX
 * “Écrire” ». C'était juste quand la planche était figée ; depuis que l'écran lit
 * `GET /journeys/public`, le nombre de cartes dépend de la base — et une borne
 * écrite à la main devient fausse par accumulation, sans rien dire de vrai.
 *
 * On fige donc l'ENSEMBLE DES LIBELLÉS fautifs, qui ne dépend pas du nombre de
 * cartes, et l'atteindre par un libellé NOUVEAU est un échec NOMMÉ. C'est la
 * propriété qu'on voulait depuis le début : « ces écarts-là, et aucun autre ».
 */
const ECARTS_TACTILES: Readonly<Record<string, readonly string[]>> = {
  parcours: ['a « Nouveau parcours »'],
  historique: ['button « Découvrir »'],
  reglages: ['button « Arrêter ce parcours »'],
  /**
   * « Proposer comme parrain » N'EST PAS DANS CETTE LISTE, et c'est mesuré plutôt
   * que décidé : la maquette ne le dessine que sur la carte d'un membre dont le
   * niveau de vérification dépasse `L0`, et les trois membres que ce montage crée
   * sont tous `L0` (la vérification d'identité demande le parcours KYC). Le bouton
   * existe, il fait 40 px, et aucun test de cette suite ne peut l'atteindre.
   * Signalé — il reste un écart connu, simplement hors de portée d'ici.
   */
  publics: ['button « Écrire »'],
};

test.describe('cible tactile — les écarts connus, et AUCUN autre', () => {
  for (const cle of Object.keys(ECARTS_TACTILES)) {
    test(`${cle} à 390 px`, async ({ page, context, request }) => {
      const m = await monterParcours(context, request);
      const url =
        cle === 'publics' ? '/parcours/publics' : `/parcours/${m.journeyId}${cle === 'parcours' ? '' : `/${cle}`}`;
      await visiter(page, url, 390);
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
            out.push(`${el.tagName.toLowerCase()} « ${(el.textContent ?? '').trim().slice(0, 30)} »`);
          }
        }
        return out;
      });

      const attendus = ECARTS_TACTILES[cle] ?? [];
      const inattendus = trop.filter((t) => !attendus.includes(t));
      expect(inattendus, `écart NON RÉPERTORIÉ à ${url}`).toEqual([]);
      /**
       * ET L'ENSEMBLE ATTENDU DOIT ÊTRE ATTEINT, pas seulement contenu.
       *
       * Sans cette moitié, un écran qui n'afficherait plus AUCUN de ces contrôles
       * — parce qu'il reste en chargement, ou parce que sa donnée est vide —
       * passerait. C'est exactement le succès vide que la session corrige
       * ailleurs dans ce fichier.
       */
      for (const attendu of attendus) {
        expect(trop, `« ${attendu} » n’est plus mesuré à ${url} : l’écran rend-il bien ?`).toContain(
          attendu,
        );
      }
    });
  }

  test('le « + » de l’en-tête Équipe atteint 44 px sans repeindre un pixel', async ({ page, context, request }) => {
    const m = await monterParcours(context, request);
    await visiter(page, `/parcours/${m.journeyId}/equipe`, 390);
    const bouton = page.locator('[data-frame="mobile"] [data-modal-open="J05I"]').first();

    const boite = await bouton.boundingBox();
    expect(boite).not.toBeNull();
    if (boite === null) return;
    expect(Math.round(boite.width), 'la cible fait 44 px').toBe(44);
    expect(Math.round(boite.height), 'la cible fait 44 px').toBe(44);

    /**
     * ET LA PASTILLE PEINTE GARDE SES 40 px.
     *
     * C'est la moitié qui empêche la « correction » facile : grossir le rond à
     * 44 px ferait passer ce test de taille et changerait le design. On mesure
     * donc les DEUX — la boîte de contenu reste à 40, le fond n'est peint que
     * là, et le remplissage ne fait que porter la cible.
     */
    const peint = await bouton.evaluate((n) => {
      const c = getComputedStyle(n);
      return { w: c.width, h: c.height, clip: c.backgroundClip, box: c.boxSizing };
    });
    expect(peint.w).toBe('40px');
    expect(peint.h).toBe('40px');
    expect(peint.clip).toBe('content-box');
    expect(peint.box).toBe('content-box');
  });
});

/**
 * §3.3 — LA CHECKLIST NE PREND AUCUN FICHIER EN V1.
 *
 * « Aucun fichier attaché en V1 — l'interface le dit clairement : "Cochez ce que
 * vous avez réuni. Les documents restent chez vous." » Un dépôt de fichier
 * ajouté par inadvertance serait une fuite de documents d'identité.
 */
test.describe('§3.3 — aucun dépôt de fichier sur la checklist', () => {
  test('la page documents ne contient aucun champ de fichier, et le dit', async ({ page, context, request }) => {
    const m = await monterParcours(context, request);
    await visiter(page, `/parcours/${m.journeyId}/documents`);
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    // La phrase vient du SERVEUR (`meta.checklistNotice`), pas de l'écran.
    await expect(page.getByText('Les documents restent chez vous').first()).toBeVisible();
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LES RÈGLES DURES, ÉPROUVÉES EN CLIQUANT ET CONTRE L'API QUI TOURNE.
 *
 * Pas « la route répond ce qu'il faut » — cela, les tests de fixtures le disent.
 * Ici : un membre clique, et la règle tient ou ne tient pas.
 * ═══════════════════════════════════════════════════════════════════════════
 */
test.describe('les règles dures du module', () => {
  /**
   * §3.5, RÈGLE DURE : « le brouillon n'est jamais promu sans cet appel. »
   *
   * On ne vérifie PAS que le bouton est absent — ce serait mesurer le dessin. On
   * clique « Je suis bloqué·e », on traverse les trois volets EN CLIQUANT, on
   * clique « Publier », et on demande à l'API si quelque chose a été publié.
   *
   * CE TEST EST VERT POUR UNE RAISON QU'IL FAUT CONNAÎTRE : le générateur ne
   * reconnaît pas le libellé « Publier », donc aucun `onClick` n'y est posé. La
   * règle est tenue PAR ABSENCE DE PRISE, pas par conception. Le jour où le
   * bouton gagnera un gestionnaire, ce test deviendra le seul garde-fou — et il
   * rougira si ce gestionnaire publie sans le corps de
   * `POST /blockers/:id/publish`.
   */
  test('§3.5 — traverser les trois volets et cliquer « Publier » ne publie rien', async ({ page, context, request }) => {
    const m = await monterParcours(context, request);
    const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1';
    const journal = async (): Promise<number> => {
      const res = await request.get(`${API}/journeys/${m.journeyId}/activities?limit=50`, {
        headers: { authorization: `Bearer ${m.proprietaire.accessToken}` },
      });
      const page_ = (await res.json()) as { items: readonly { type: string }[] };
      return page_.items.filter((i) => i.type === 'BLOCKER_PUBLISHED').length;
    };

    const avant = await journal();
    expect(avant, 'rien n’est publié au départ').toBe(0);

    await visiter(page, `/parcours/${m.journeyId}`);
    await desktop(page).getByText('Je suis bloqué·e').first().click();
    const dialogue = page.getByRole('dialog', { name: 'Je suis bloqué·e' });
    await expect(dialogue).toBeVisible();

    // PREMIER VOLET : « Publier » n'y est pas dessiné. C'est la maquette qui
    // tient la règle par le dessin, et c'est la moitié facile.
    await expect(dialogue.getByText('Publier', { exact: true })).toHaveCount(0);

    for (const libelle of ['Suivant', 'Voir l’aperçu']) {
      const bouton = dialogue.getByText(libelle, { exact: true }).first();
      if ((await bouton.count()) > 0) await bouton.click();
    }
    // TROISIÈME VOLET : il y est. On clique.
    const publier = dialogue.getByText('Publier', { exact: true }).first();
    await expect(publier).toBeVisible();
    await publier.click();
    await page.waitForTimeout(1200);

    expect(await journal(), 'cliquer « Publier » n’a rien promu (§3.5)').toBe(0);
  });

  /**
   * §3.1, RÈGLE DURE : un seul parcours actif en gratuit.
   *
   * L'ÉCRAN L'AFFICHE, et le SERVEUR l'applique. Les deux moitiés, parce qu'un
   * écran qui l'affiche sans que le serveur l'applique est décoratif, et un
   * serveur qui l'applique sans que l'écran le dise est opaque.
   */
  test('§3.1 — l’écran annonce la limite du plan, et le serveur la refuse', async ({ page, context, request }) => {
    const m = await monterParcours(context, request);
    await visiter(page, '/parcours');
    await expect(desktop(page).getByText('1 parcours actif sur 1')).toBeVisible();

    const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1';
    const modeles = await request.get(`${API}/journey-templates`, {
      headers: { authorization: `Bearer ${m.proprietaire.accessToken}` },
    });
    const items = ((await modeles.json()) as { items: readonly { id: string; code: string }[] }).items;
    const etudes = items.find((t) => t.code === 'STUDIES');
    const second = await request.post(`${API}/journeys`, {
      headers: { authorization: `Bearer ${m.proprietaire.accessToken}` },
      data: { templateId: etudes?.id },
    });
    // 422 et `PLAN_LIMIT_REACHED`, écrits en dur : le front décide sur le CODE,
    // jamais sur le message (§5.2), et le code est le contrat.
    expect(second.status()).toBe(422);
    const corps = (await second.json()) as { error: { code: string } };
    expect(corps.error.code).toBe('PLAN_LIMIT_REACHED');
  });

  /**
   * §3.4 et §10, RÈGLE DURE : « les notes et la checklist ne sont jamais
   * renvoyées à un observateur », et le service va plus loin — l'ACCOMPAGNANT non
   * plus ne les voit pas.
   *
   * Éprouvé SUR LA RÉPONSE, pas sur l'écran : si le serveur les envoyait, un
   * écran qui ne les affiche pas ne suffirait pas — la fuite serait dans la
   * réponse HTTP, lisible dans n'importe quel onglet réseau.
   */
  test('§3.4 — l’accompagnant reçoit les étapes, jamais les notes ni la checklist', async ({ context, request }) => {
    const m = await monterParcours(context, request);
    const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1';
    const res = await request.get(`${API}/journeys/${m.journeyId}`, {
      headers: { authorization: `Bearer ${m.accompagnant.accessToken}` },
    });
    expect(res.status()).toBe(200);
    const vu = (await res.json()) as {
      viewerRole: string;
      steps: readonly Record<string, unknown>[];
    };
    expect(vu.viewerRole).toBe('SUPPORTER');
    // QUINZE étapes, écrit en dur : il voit bien le parcours entier.
    expect(vu.steps).toHaveLength(15);
    for (const etape of vu.steps) {
      for (const interdit of ['notes', 'checklist', 'dueDate', 'sharePromptDismissedAt']) {
        expect(
          Object.hasOwn(etape, interdit),
          `« ${interdit} » ne doit JAMAIS sortir pour un accompagnant`,
        ).toBe(false);
      }
    }

    /**
     * ET LE JOURNAL LUI EST REFUSÉ (§3.8) — par un `404`, pas un `403`.
     *
     * Mesuré : `assertOwned` lève `notFound()`, donc le serveur ne confirme même
     * pas que ce journal existe. Les deux codes sont acceptés ici parce que les
     * deux refusent ; ce qui ne l'est pas, c'est un `200`.
     */
    const journal = await request.get(`${API}/journeys/${m.journeyId}/activities`, {
      headers: { authorization: `Bearer ${m.accompagnant.accessToken}` },
    });
    expect([403, 404], `le journal a répondu ${journal.status()}`).toContain(journal.status());
  });
});
