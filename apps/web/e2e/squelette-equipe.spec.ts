import { expect, test, type Page } from '@playwright/test';

/**
 * ─── LE CADRE D'ÉQUIPE EST-IL SERVI ? MESURÉ SANS EXÉCUTER DE JAVASCRIPT ────
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ CE FICHIER REFERME UN TROU DE COUVERTURE PRÉCIS : le bloc                │
 * │ « rendu serveur » de `e2e/shell.spec.ts` ne visitait QU'UNE route,       │
 * │ `/accueil` — précisément la seule du produit qui le faisait bien. Un     │
 * │ test qui garde le seul cas qui marche est la famille de défauts la plus  │
 * │ coûteuse de ce dépôt : il avait été écrit après que CINQ pages ont été   │
 * │ servies vides, dont une qui faisait 8 Ko de script et zéro mot, et il    │
 * │ n'a jamais été étendu.                                                   │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * CE QU'IL A ATTRAPÉ, mesuré route par route avant correction : CINQ des dix
 * routes d'équipe servaient DEUX mots visibles (« Administration Chargement… ») et
 * ZÉRO entrée de rail, et ce sont exactement les cinq qui lisent des données —
 * `/admin`, `/admin/moderation`, `/admin/referentiels`, `/admin/services`,
 * `/admin/impact`. Les neuf autres servaient de 56 à 126 mots et 14 entrées.
 *
 * La cause était dans `screens/administration/ecran-donnees.tsx` : sa branche
 * d'attente rendait un `<div>` À LA PLACE du cadre entier, rail compris, et sa
 * branche d'échec faisait pareil — un chargement raté laissait le membre de
 * l'équipe sans aucune navigation.
 *
 * ── LA DISTINCTION À NE PAS PERDRE DANS LES MESSAGES D'ÉCHEC ───────────────
 *
 * « L'écran n'a pas ses données » et « le lien ne mène nulle part » sont DEUX
 * défauts, et un rapport de ce projet les a déjà confondus. Ici c'est le PREMIER :
 * la page répond 200, les liens EXISTENT dans le cadre généré, et c'est le cadre
 * qui n'était pas rendu. Les messages d'échec ci-dessous accusent donc le RENDU et
 * non la navigation — un test dont le message désigne la mauvaise cause coûte plus
 * cher qu'un test absent. La navigation, elle, est gardée au CLIC par
 * `e2e/navigation-rail.spec.ts`, qui est son fichier.
 *
 * ── POURQUOI `request` ET NON `page` ───────────────────────────────────────
 *
 * Le défaut est INVISIBLE au navigateur : la page s'affiche parfaitement, puisque
 * le script tourne. Il ne se voit que dans la réponse brute. On lit donc ce que le
 * serveur a envoyé, sans exécuter une ligne de script — exactement comme le
 * feraient un moteur d'indexation, un aperçu de lien, ou un téléphone sur réseau
 * lent avant que le script n'arrive. C'est la même mesure que `shell.spec.ts` et
 * elle emploie le même détecteur, recopié plus bas pour la raison qui y est écrite.
 *
 * ── CE QUE CE FICHIER NE PRÉTEND PAS GARDER ────────────────────────────────
 *
 * Il garde le CADRE, pas les données. Les nombres de ces écrans viennent de routes
 * d'équipe derrière un cookie `dp_staff` `HttpOnly`/`SameSite=Strict` que le
 * serveur de rendu de Next n'a pas sous la main : ils ne peuvent pas être
 * pré-rendus aujourd'hui, et c'est écrit chez eux. Le cadre, lui, est du DESSIN et
 * n'a aucune raison d'attendre le réseau.
 */

/**
 * ─── LES QUATORZE ROUTES QUE LE RAIL DÉCLARE ───────────────────────────────
 *
 * Recopié de `ENTREES` dans `e2e/navigation-rail.spec.ts`, lui-même recopié de la
 * clé `rail` de `tools/screens/10-administration.mjs`. Ni déduit du libellé, ni
 * balayé depuis le disque : c'est la DÉCLARATION qui décide, et un test qui la
 * recalculerait ne pourrait pas la contredire.
 *
 * `litLApi` nomme les cinq écrans que ce fichier existe pour garder. Les neuf
 * autres sont dans la table quand même, et ce n'est pas du remplissage : sans eux,
 * la règle ne serait posée que là où elle vient d'être réparée, et la prochaine
 * page branchée retomberait dans le trou sans que rien ne le dise.
 */
const ROUTES_EQUIPE = [
  { url: '/admin', libelle: 'Tableau de bord', litLApi: true },
  { url: '/admin/impact', libelle: 'Rapport d’impact', litLApi: true },
  { url: '/admin/membres', libelle: 'Membres', litLApi: false },
  { url: '/admin/moderation', libelle: 'Modération', litLApi: true },
  // AJOUTÉE (lot w5b) : D17, quinzième entrée du rail (13 §4.4, 15 §2.1).
  { url: '/admin/alertes-equipe', libelle: 'Alertes d’équipe', litLApi: false },
  { url: '/admin/parcours', libelle: 'Parcours', litLApi: false },
  { url: '/admin/etapes', libelle: 'Bibliothèque d’étapes', litLApi: false },
  { url: '/admin/contenu', libelle: 'Contenu', litLApi: false },
  { url: '/admin/guides', libelle: 'Guides', litLApi: false },
  { url: '/admin/alertes', libelle: 'Alertes arnaques', litLApi: false },
  { url: '/admin/referentiels', libelle: 'Référentiels', litLApi: true },
  { url: '/admin/services', libelle: 'Services', litLApi: true },
  { url: '/admin/revenus', libelle: 'Revenus', litLApi: false },
  { url: '/admin/partenaires', libelle: 'Partenaires', litLApi: false },
  { url: '/admin/reglages', libelle: 'Réglages', litLApi: false },
] as const;

/**
 * LE DOSSIER DE MODÉRATION, qui n'est PAS une rubrique du rail.
 *
 * `/admin/moderation/:id` (D05) lit `GET /admin/moderation/cases/:id` et portait
 * donc le même défaut, mais aucune entrée ne mène à lui : il est éprouvé à part
 * plutôt que glissé dans la table, où il aurait faussé la règle de complétude du
 * rail ci-dessous.
 */
const DOSSIER = '/admin/moderation/4812';

/** Toutes les pages d'équipe qui doivent servir leur cadre, rail compris. */
const TOUTES = [...ROUTES_EQUIPE.map((r) => r.url), DOSSIER];

/**
 * Le texte visible d'une réponse HTML, scripts et styles ÔTÉS.
 *
 * RECOPIÉ de `shell.spec.ts` plutôt que mutualisé, et c'est un choix : Playwright
 * transpile chaque fichier de test indépendamment, un module partagé entre
 * `*.spec.ts` serait chargé comme un test vide, et surtout le détecteur est éprouvé
 * ICI (voir « le détecteur distingue… ») — deux copies éprouvées chacune chez elle
 * valent mieux qu'une copie éprouvée à un seul endroit et importée à l'autre.
 */
function motsVisibles(html: string): { readonly texte: string; readonly nombre: number } {
  const sansScript = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const texte = sansScript
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, '’')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { texte, nombre: texte.split(' ').filter((m) => /[A-Za-zÀ-ÿ]{2,}/.test(m)).length };
}

/**
 * Les destinations que les `<nav>` de la réponse offrent, dédoublonnées.
 *
 * On lit les `<nav>` et eux seuls : un `href="/admin/…"` posé ailleurs dans la page
 * — une carte cliquable, un fil d'Ariane — ne serait pas le rail, et une règle qui
 * les compterait resterait verte sur une page dont le rail a disparu.
 *
 * Mesuré sur la réponse BRUTE, donc par expression régulière et non par un
 * sélecteur : il n'y a pas de DOM ici, c'est tout l'intérêt de la mesure.
 */
function destinationsDuRail(html: string): readonly string[] {
  const navs = html.match(/<nav[\s\S]*?<\/nav>/gi) ?? [];
  const vues = new Set<string>();
  for (const nav of navs) {
    for (const m of nav.matchAll(/href="(\/admin[^"]*)"/gi)) vues.add(m[1]);
  }
  return [...vues];
}

/**
 * ─── LA BORNE BASSE, ET POURQUOI ELLE N'EST PAS UN COMPTE DE MOTS ATTENDU ──
 *
 * TROIS BORNES DE CE DÉPÔT SONT DÉJÀ DEVENUES FAUSSES PAR ACCUMULATION — un
 * défilement calibré sur cinq publications dessinées, une minuterie de
 * construction posée à trente écrans, un seuil de mots calé sur une page. Chacune a
 * fini par mesurer autre chose que ce qu'elle prétendait, en restant verte.
 *
 * Celle-ci ne décrit donc AUCUNE richesse attendue : elle sépare « des mots » de
 * « rien ». Les deux pôles sont mesurés sur ce dépôt, pas supposés :
 *
 *   · RIEN = 2 mots. C'est ce que servaient les cinq routes cassées : le titre du
 *     groupe de routes, plus la phrase d'attente. Une page vidée par un
 *     renoncement au pré-rendu, elle, tombe à ZÉRO.
 *   · DES MOTS = 56 au plus bas (`/admin/referentiels`, dont le tableau de villes
 *     est vide avant la réponse) et 126 au plus haut (`/admin/etapes`).
 *
 * DIX sépare les deux par un ordre de grandeur de chaque côté. Il reste vrai si une
 * planche s'allège, et il ne peut pas devenir faux par accumulation puisqu'il ne
 * suit aucune quantité de contenu.
 *
 * ET CE N'EST PAS LA RÈGLE PRINCIPALE. La règle qui ne peut pas rancir est la
 * suivante : le rail doit porter une destination pour CHAQUE route de la table —
 * elle est DÉRIVÉE de la table, donc y ajouter une route resserre la règle au lieu
 * de la périmer.
 */
const PLANCHER_DE_MOTS = 10;

test.describe('rendu serveur du domaine d’équipe', () => {
  for (const url of TOUTES) {
    test(`${url} sert son cadre, rail compris, sans exécuter de script`, async ({ request }) => {
      const res = await request.get(url);
      expect(res.status(), `${url} ne répond pas 200`).toBe(200);

      const html = await res.text();
      const { texte, nombre } = motsVisibles(html);

      /**
       * LE MESSAGE ACCUSE LE RENDU, PAS LA NAVIGATION — voir l'en-tête. Il donne
       * aussi l'extrait servi : sans lui, on relirait le code au lieu de voir que
       * la réponse ne contient que la phrase d'attente.
       */
      expect(
        nombre,
        `${url} ne sert que ${nombre} mot(s) hors script — le CADRE n’est pas rendu côté ` +
          `serveur (ce n’est PAS un défaut de navigation : la page répond 200 et les liens ` +
          `existent dans le cadre généré). Servi : « ${texte.slice(0, 120)} »`,
      ).toBeGreaterThan(PLANCHER_DE_MOTS);

      /**
       * LE RAIL, ENTRÉE PAR ENTRÉE. C'est la règle dure de ce fichier : une page
       * d'équipe sans rail est une page sans sortie, et c'est exactement ce que la
       * branche d'échec de `ecran-donnees.tsx` produisait.
       */
      const destinations = destinationsDuRail(html);
      const manquantes = ROUTES_EQUIPE.map((r) => r.url).filter((r) => !destinations.includes(r));
      expect(
        manquantes,
        `${url} sert un rail incomplet : ${manquantes.length} destination(s) absente(s) du ` +
          `HTML. Un membre de l’équipe arrivé là n’a aucune sortie vers ces rubriques.`,
      ).toEqual([]);
    });
  }

  /**
   * UNE PAGE QUI ANNONCE QU'ELLE CHARGE DOIT QUAND MÊME PORTER SA NAVIGATION.
   *
   * C'est la formulation EXACTE du défaut, et elle ne dépend d'aucun compte : les
   * cinq routes cassées servaient leur phrase d'attente SANS rail. Le bandeau
   * d'attente est servi côté serveur — le composant monte en phase « attente », et
   * c'est normal — donc on ne peut pas exiger son absence ; on exige que le rail
   * soit là EN MÊME TEMPS que lui.
   *
   * ON DÉTECTE L'ATTENTE PAR SON RÔLE, `role="status"`, ET NON PAR SA PHRASE.
   * Chercher « Chargement » rendrait ce cas VACUEUX au premier changement de
   * libellé : il ne trouverait plus d'attente, et passerait en ne regardant rien.
   * Le rôle, lui, est ce que le lecteur d'écran lit — il ne peut pas disparaître
   * sans que l'annonce disparaisse avec.
   *
   * Et la NON-VACUITÉ est exigée explicitement : si AUCUN des six écrans ne servait
   * d'attente, il n'y aurait rien à éprouver, et ce cas doit le dire au lieu de
   * passer. Elle est vraie par construction — le composant monte en phase
   * « attente », donc le serveur rend toujours le bandeau.
   */
  test('les six écrans qui lisent l’API servent leur rail EN MÊME TEMPS que leur attente', async ({
    request,
  }) => {
    const lecteurs = ROUTES_EQUIPE.filter((r) => r.litLApi).map((r) => r.url);
    expect(lecteurs, 'la table a perdu ses écrans branchés').toHaveLength(5);

    const attendent: string[] = [];
    const fautifs: string[] = [];
    for (const url of [...lecteurs, DOSSIER]) {
      const html = await (await request.get(url)).text();
      if (!/role="status"/i.test(html)) continue;
      attendent.push(url);
      if (destinationsDuRail(html).length === 0) fautifs.push(url);
    }

    expect(
      attendent.length,
      'aucun des six écrans ne sert d’état d’attente : ce cas ne mesure rien',
    ).toBeGreaterThan(0);

    expect(
      fautifs,
      `ces pages servent leur attente À LA PLACE de leur cadre : ${fautifs.join(', ')}`,
    ).toEqual([]);
  });

  /**
   * NON-VACUITÉ DES DEUX DÉTECTEURS.
   *
   * Un détecteur qui cherche et ne trouve jamais ne dit rien tant qu'on n'a pas
   * montré qu'il SAIT trouver — et, surtout, qu'il sait ne PAS trouver. On lui
   * donne les cas qu'il doit distinguer, dont celui qui l'a motivé : beaucoup de
   * script, aucun mot.
   */
  test('le détecteur de mots distingue une page servie d’une coquille vide', () => {
    const vide = '<html><body><div id="__next"></div><script>var a=1;</script></body></html>';
    expect(motsVisibles(vide).nombre).toBe(0);

    // La coquille EXACTE que les cinq routes servaient : elle doit tomber sous la borne.
    const coquille =
      '<html><body><div><span>Administration</span><div role="status">Chargement…</div></div>' +
      '<script>var a=1;</script></body></html>';
    expect(motsVisibles(coquille).nombre).toBeLessThanOrEqual(PLANCHER_DE_MOTS);

    /**
     * UNE PAGE SERVIE, réduite à ce qui la distingue de la coquille : son rail. Les
     * quatorze libellés suffisent à dépasser la borne — ce qui est exactement
     * pourquoi la borne tient : une page d'équipe qui porte son rail la franchit
     * sans rien devoir au contenu, donc sans dépendre de la richesse d'une planche.
     */
    const pleine =
      '<html><body><nav>' +
      ROUTES_EQUIPE.map((r) => `<a href="${r.url}">${r.libelle}</a>`).join('') +
      '</nav><script>var b=2;</script></body></html>';
    expect(motsVisibles(pleine).nombre).toBeGreaterThan(PLANCHER_DE_MOTS);
    expect(motsVisibles(pleine).texte).toContain('Référentiels');

    // Le script ne compte JAMAIS, même bavard — c'est tout le défaut d'origine.
    const bavard = `<html><body><script>${'var motmotmot = 1;'.repeat(400)}</script></body></html>`;
    expect(motsVisibles(bavard).nombre).toBe(0);
  });

  test('le détecteur de rail ne compte que les ancres d’un <nav>', () => {
    expect(destinationsDuRail('<html><body><a href="/admin/impact">x</a></body></html>')).toEqual(
      [],
    );
    expect(destinationsDuRail('<nav><a href="/admin/impact">x</a></nav>')).toEqual([
      '/admin/impact',
    ]);
    // Dédoublonné, et insensible à l'ordre des attributs.
    expect(
      destinationsDuRail('<nav><a class="k" href="/admin">a</a><a href="/admin">b</a></nav>')
        .length,
    ).toBe(1);
    // Une destination hors du domaine d'équipe n'est pas une entrée du rail d'équipe.
    expect(destinationsDuRail('<nav><a href="/accueil">x</a></nav>')).toEqual([]);
  });
});

/**
 * ─── UN CHARGEMENT EN ÉCHEC LAISSE UNE NAVIGATION ──────────────────────────
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ C'ÉTAIT LA MOITIÉ LA PLUS COÛTEUSE DU DÉFAUT, et la moins visible : la   │
 * │ branche d'échec de `ecran-donnees.tsx` remplaçait elle aussi l'écran     │
 * │ entier. Un membre de l'équipe dont le chargement ratait se retrouvait    │
 * │ SANS AUCUNE NAVIGATION — sans sortie hors du bouton retour du            │
 * │ navigateur. Aucun test ne le voyait : les suites d'équipe SERVENT leurs  │
 * │ charges pour pouvoir mesurer autre chose, donc aucune n'observait jamais │
 * │ un échec.                                                                │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * On provoque donc l'échec pour de vrai — l'API répond 500 — et on exige deux
 * choses DISTINCTES : que le rail soit encore là, et qu'une de ses entrées MÈNE
 * AILLEURS. La seconde n'est pas redondante : un rail rendu mais inerte
 * (`pointer-events: none`, un parent qui avale le clic, un `<a>` sans `href`)
 * laisserait le membre tout aussi coincé, et c'est la leçon de
 * `e2e/navigation-rail.spec.ts` — « un test qui garde la navigation doit cliquer ».
 */
test.describe('un chargement en échec laisse une navigation', () => {
  /** Le rail n'existe qu'au cadre d'ordinateur : la maquette n'en dessine pas d'autre. */
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'le rail est au cadre ordinateur');

  /**
   * TOUT LE DOMAINE D'ÉQUIPE RÉPOND 500.
   *
   * Un seul motif, posé sur `**\/v1/admin/**`, plutôt que six interceptions : ce
   * qu'on éprouve est l'ÉCHEC, et le laisser dépendre de la route exacte de chaque
   * écran ferait qu'un écran rebranché ailleurs passerait en silence — il
   * recevrait alors une vraie réponse (ou un vrai 401), et le cas mesurerait
   * l'attente au lieu de l'échec.
   *
   * La charge est l'enveloppe d'erreur du serveur (§5.2) : `displayMessageFor`
   * décide sur `code`, et une réponse sans corps JSON lui ferait prendre le chemin
   * du `unknown` — ce qui marcherait, mais ne ressemblerait à aucun échec réel.
   */
  async function toutEchoue(page: Page): Promise<void> {
    await page.route('**/v1/admin/**', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'INTERNAL', message: 'Erreur interne.' }),
      }),
    );
  }

  const ECHECS = [
    { url: '/admin', ailleurs: { libelle: 'Réglages', route: '/admin/reglages' } },
    { url: '/admin/moderation', ailleurs: { libelle: 'Revenus', route: '/admin/revenus' } },
    { url: '/admin/referentiels', ailleurs: { libelle: 'Membres', route: '/admin/membres' } },
    { url: '/admin/services', ailleurs: { libelle: 'Contenu', route: '/admin/contenu' } },
    { url: '/admin/impact', ailleurs: { libelle: 'Guides', route: '/admin/guides' } },
    { url: DOSSIER, ailleurs: { libelle: 'Partenaires', route: '/admin/partenaires' } },
  ] as const;

  for (const { url, ailleurs } of ECHECS) {
    test(`${url} en échec : le rail est là, et « ${ailleurs.libelle} » mène ailleurs`, async ({
      page,
    }) => {
      await toutEchoue(page);
      await page.setViewportSize({ width: 1440, height: 1000 });
      /**
       * `load` et non `networkidle` : Next précharge les liens visibles d'une page
       * App Router, donc le réseau ne retombe pas au calme — voir la même note
       * dans `administration.spec.ts`.
       */
      await page.goto(url, { waitUntil: 'load' });

      const rail = page.locator('[data-frame="desktop"] nav');

      /**
       * L'ÉCHEC EST BIEN SURVENU — sinon le reste ne prouverait rien, une page qui
       * a ses données gardant trivialement son rail. C'est le même garde-fou que
       * « la page doit pouvoir défiler » dans `shell.spec.ts` : on vérifie d'abord
       * que la condition éprouvée existe.
       */
      /**
       * `filter({ hasText: /\S/ })` N'EST PAS DU CONFORT DE SÉLECTEUR, et le
       * découvrir a coûté un échec : Next pose son propre `<div role="alert"
       * id="__next-route-announcer__">` dans chaque page de l'App Router, pour
       * annoncer les changements de route au lecteur d'écran. `getByRole('alert')`
       * en trouve donc DEUX et Playwright refuse en mode strict — sur un message
       * (« strict mode violation ») qui n'aurait rien dit du bandeau.
       *
       * L'annonceur de Next est toujours VIDE : exiger du texte le retire sans
       * nommer son identifiant, qui est un détail d'implémentation du cadre.
       */
      await expect(
        // `.first()` (lot w5b) : D10 charge deux sections indépendantes (statistiques, liste), chacune
        // porte son bandeau — deux `role="alert"` visibles, tous deux légitimes.
        page.getByRole('alert').filter({ hasText: /\S/ }).first(),
        'aucun bandeau d’échec : le 500 n’est pas arrivé jusqu’à l’écran, et ce cas ne mesure rien',
      ).toBeVisible({ timeout: 20_000 });

      await expect(
        rail,
        `${url} en échec ne rend plus son rail : le membre de l’équipe est sans sortie`,
      ).toBeVisible();

      // Le rail entier, pas une entrée : une sortie unique n'est pas une navigation.
      await expect(rail.getByRole('link')).toHaveCount(ROUTES_EQUIPE.length);

      /**
       * ET LE CLIC PART. La destination n'est PAS la page de départ — sinon un clic
       * inerte passerait pour une navigation réussie.
       */
      expect(ailleurs.route, 'le départ ne doit pas être l’arrivée').not.toBe(url);
      const entree = rail.getByRole('link', { name: ailleurs.libelle, exact: true });
      await expect(entree, 'l’entrée du rail doit être un LIEN, pas un <span>').toHaveCount(1);
      await entree.click();
      await expect(page).toHaveURL(new RegExp(`${ailleurs.route}$`));
    });
  }
});
