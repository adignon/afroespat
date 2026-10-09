import { expect, test } from '@playwright/test';
import { connecter } from './session';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1';

/**
 * L'EN-TÊTE DE RÉSEAU, ÉPROUVÉ DANS UN NAVIGATEUR SUR DEUX RÉSEAUX DIFFÉRENTS.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI DEUX RÉSEAUX, ET PAS UN
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Les vingt-cinq planches d'onglet écrivaient « Béninois en France » et
 * « 890 membres » EN DUR. Un test qui ouvrirait UN seul réseau — celui que la
 * maquette a dessiné — et y lirait son nom ne distinguerait RIEN : le littéral
 * en dur et la donnée lue s'affichent exactement pareil.
 *
 * Cette suite ouvre donc deux réseaux et vérifie que l'en-tête CHANGE entre les
 * deux. C'est la seule forme d'assertion que le défaut d'origine n'aurait pas
 * satisfaite, et c'est la leçon des trois témoins troués d'hier : une assertion
 * qu'un code faux satisfait ne garde rien.
 *
 * ── CE QUE CE FICHIER A ATTRAPÉ QUE LES TESTS UNITAIRES N'ONT PAS VU ───────
 *
 * Deux défauts, et les deux ne se voyaient qu'À L'ÉCRAN :
 *
 *   1. l'onglet « À propos » peignait l'en-tête de REPLI pendant le chargement —
 *      une pastille contenant « · », aucun nom, deux séparateurs orphelins. Les
 *      prises étaient bien liées ; c'est le moment du rendu qui était faux ;
 *   2. l'onglet par DÉFAUT (« Sujets », qui est A08 et non A08T) nommait encore
 *      le réseau de la maquette, et déclarait le lecteur membre à l'endroit même
 *      où le serveur venait de lui refuser le contenu.
 *
 * Aucun des deux ne faisait rougir un test de forme, et les deux sautent aux yeux.
 *
 * ── UNE SEULE SESSION, UN SEUL CONTEXTE, UNE SEULE PAGE ───────────────────
 *
 * `POST /auth/otp/request` est à `@RateLimit(10)` par HEURE et par ROUTE : une
 * session par test rougirait au onzième pour une raison étrangère à ce qu'il
 * éprouve. Et le jeton de rafraîchissement TOURNE — le même cookie dans deux
 * contextes est un rejeu qui RÉVOQUE la chaîne. D'où un seul `test()` qui
 * parcourt les onglets, plutôt que six qui se partageraient une session.
 *
 * ── LE NOMBRE DE MEMBRES SE DEMANDE AU SERVEUR ────────────────────────────
 *
 * Il était ÉCRIT EN DUR — « 99 membres » pour le Bénin, « 72 » pour Lyon — avec
 * cette justification : les relire serait une tautologie, et si la base bouge, le
 * test rougira et dira où regarder. Elle a bougé, et il a rougi : chaque suite
 * d'épreuves inscrit des membres, et ces réseaux sont AUTOMATIQUES — tout membre
 * du Bénin entre dans « pays-bj ». Le signal ne désignait donc rien à corriger.
 *
 * Et ce n'est pas une tautologie : on ne compare pas la réponse à elle-même, on
 * compare L'ÉCRAN à la réponse. C'est exactement ce que ce fichier éprouve — que
 * l'en-tête dise le réseau OUVERT et non celui de la maquette — et le littéral
 * « 890 membres » de la planche reste attrapé, puisqu'il ne vaudra jamais ce que
 * le serveur rend.
 */

const RESEAUX = [
  { slug: 'pays-bj', nom: 'Bénin', genre: 'réseau de pays', cat: 'Pays' },
  { slug: 'ville-lyon', nom: 'Lyon', genre: 'réseau de ville', cat: 'Ville' },
] as const;

/** Les cinq onglets A08T, plus « sujets » qui est le cadre complet de A08. */
/**
 * Toute espace Unicode ramenée à l'espace ordinaire — insécable, fine, tabulation.
 * Sans elle, un nombre formaté par Node ne rencontre jamais le même nombre formaté
 * par le navigateur dès qu'il dépasse 999.
 */
const espaces = (texte: string): string => texte.replace(/\s/g, ' ');

const ONGLETS = ['sujets', 'fil', 'evenements', 'membres', 'album', 'a-propos'] as const;

/** Ce que la maquette dessine, et qu'aucun écran ne doit plus montrer. */
const LITTERAUX_DE_MAQUETTE = ['Béninois en France', '890 membres', 'BN'] as const;

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ BORNÉ AU CADRE D'ORDINATEUR, ET C'EST UNE MESURE                          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Ce cas reconnaît l'en-tête à son NOMBRE DE MEMBRES — « 105 membres » — parce que
 * c'est la seule valeur qui n'existe nulle part ailleurs sur la page.
 *
 * MESURÉ sur une fenêtre de 390 px : ce texte n'apparaît QUE dans le cadre
 * d'ordinateur, qui y est masqué (0 × 0). La planche de 390 px ne le dessine pas —
 * son en-tête est compact. Le cas attendait donc un élément qui ne pouvait pas
 * s'afficher, et il échouait sur le projet mobile depuis toujours en accusant
 * l'écran.
 *
 * ⚠ CE QUE ÇA LAISSE DEHORS, et c'est remonté : l'en-tête MOBILE n'est éprouvé par
 * personne. Il faudrait un repère que sa planche dessine ; le trouver est un lot en
 * soi, et l'inventer ici donnerait un cas vert qui ne garde rien.
 */
test('l’en-tête de réseau dit le réseau ouvert, sur les six onglets', async ({
  browser,
  request,
}, info) => {
  // Hors d'un `describe`, le saut se décide sur les informations du cas.
  test.skip(
    (info.project.use.viewport?.width ?? 0) < 1024,
    'la planche de 390 px ne dessine pas le nombre de membres — mesuré',
  );
  test.setTimeout(180_000);
  const ctx = await browser.newContext();
  const { accessToken: jeton } = await connecter(ctx, request, {
    displayName: 'Lectrice Réseaux',
  });
  const page = await ctx.newPage();

  for (const reseau of RESEAUX) {
    /**
     * LE COMPTE, DEMANDÉ AU SERVEUR AVANT D'OUVRIR L'ÉCRAN. `GET /communities/:slug`
     * est la route que la page emploie elle-même ; on la lit en tant que ce membre.
     */
    const fiche = await ctx.request.get(`${API}/communities/${reseau.slug}`, {
      headers: { authorization: `Bearer ${jeton}` },
    });
    expect(fiche.ok(), `GET /communities/${reseau.slug} : ${fiche.status()}`).toBe(true);
    /**
     * `memberCount`, et JAMAIS `counters.members` : c'est le choix de
     * `a08t/data.ts`, et sa note dit pourquoi — `counters.members` arrive masqué
     * sous le seuil de confidentialité, `memberCount` est public et vrai pour
     * tout le monde. Lire l'autre ici comparerait l'écran à un nombre qu'il ne
     * montre pas.
     */
    const detail = (await fiche.json()) as { memberCount: number };
    /**
     * ╔════════════════════════════════════════════════════════════════════════╗
     * ║ LE NOMBRE EST FORMATÉ À LA FRANÇAISE À L'ÉCRAN — défaut LATENT          ║
     * ╚════════════════════════════════════════════════════════════════════════╝
     *
     * L'API rend `2360` ; l'écran écrit « 2 360 membres », avec une espace fine
     * insécable (U+202F) — c'est `Intl.NumberFormat('fr-FR')`. Comparés bruts, les
     * deux ne se rencontrent JAMAIS au-dessus de 999.
     *
     * CE DÉFAUT DORMAIT : tant que les réseaux du jeu de données comptaient moins de
     * mille membres, les deux formes coïncidaient. Il s'est réveillé quand le
     * réseau de pays a dépassé le millier — chaque membre créé par une suite
     * rejoint le réseau de son pays d'origine, et les suites en créent beaucoup.
     *
     * ON COMPARE DONC SUR UN TEXTE NORMALISÉ, et non sur une chaîne formatée. Node
     * et le navigateur n'emploient pas la MÊME espace : selon la version d'ICU,
     * `Intl.NumberFormat('fr-FR')` sépare les milliers par une espace insécable
     * (U+00A0) ou par une espace fine insécable (U+202F). Deux chaînes identiques
     * à l'œil, jamais égales — relevé : « Expected "2 360 membres" / Received
     * "… 2 360 membres …" », les deux étant visuellement les mêmes. `espaces()`
     * ramène toute espace Unicode à l'espace ordinaire, des deux côtés.
     */
    const membres = `${new Intl.NumberFormat('fr-FR').format(detail.memberCount)} membres`;
    const membresNus = espaces(membres);

    for (const onglet of ONGLETS) {
      await page.goto(`/reseaux/${reseau.slug}?onglet=${onglet}`);

      /**
       * ON ATTEND LE NOM, et non un délai fixe.
       *
       * L'en-tête n'est plus peint avant que l'appel soit revenu — c'est le
       * correctif du premier défaut — donc attendre le nom attend l'écran réel.
       * Un `waitForTimeout` mesurerait parfois l'écran de chargement, et le test
       * serait vert ou rouge selon la charge de la machine.
       */
      const ou = `${reseau.slug} / ${onglet}`;
      /**
       * ON ATTEND LE NOMBRE DE MEMBRES, PAS LE NOM — et ce choix est un défaut
       * attrapé puis corrigé dans ce fichier même.
       *
       * Attendre « Lyon » passait IMMÉDIATEMENT sur n'importe quelle page : le
       * panneau de gauche écrit « Mes études à Lyon » dans le parcours du membre.
       * Le test mesurait donc l'écran de chargement en croyant mesurer l'écran, et
       * c'est très exactement la forme de témoin troué décrite en tête de
       * `a08t/entete.test.ts`. « 99 membres » n'existe que dans l'en-tête.
       */
      /**
       * LE CADRE VISIBLE, ET LUI SEUL. `ScreenFrames` rend les DEUX cadres et en
       * masque un : viser le texte dans le document trouve d'abord celui du cadre
       * CACHÉ, et l'attente expire sur un élément qui existe mais ne s'affiche
       * pas. C'est ce qui faisait tomber ce cas sur le projet mobile — « resolved
       * to <div>105 membres · réseau de pays</div> », quarante-deux fois.
       */
      await expect(
        page
          .getByText(new RegExp(membresNus.replace(/ /g, '\\s')), { exact: false })
          .filter({ visible: true })
          .first(),
        ou,
      ).toBeVisible({ timeout: 20_000 });

      const corps = (await page.locator('body').innerText()).replace(/\s+/g, ' ');

      // PRÉSENCE — l'écran dit bien ce réseau-ci.
      expect(corps, ou).toContain(reseau.nom);
      expect(espaces(corps), ou).toContain(membresNus);
      expect(corps, ou).toContain(reseau.genre);

      // ABSENCE — et plus aucun littéral de la maquette. C'est la moitié qui
      // aurait rougi sur le dépôt d'avant ce lot, et la seule qui le distingue.
      for (const littéral of LITTERAUX_DE_MAQUETTE) {
        expect(corps, `${ou} — littéral de maquette « ${littéral} »`).not.toContain(littéral);
      }

      /**
       * AUCUN SÉPARATEUR ORPHELIN — le défaut vu à l'écran, figé.
       *
       * « · · » accolés, ou une ligne qui se termine par « · », veut dire qu'une
       * interpolation est vide entre deux séparateurs DESSINÉS. C'est ce que
       * donnait l'en-tête de repli, et ce que donnerait un passant si la ligne
       * était liée en trois morceaux au lieu d'un.
       */
      expect(corps, `${ou} — séparateur orphelin`).not.toMatch(/·\s*·/);
      // Et le « 0 modérateurs » qu'un compteur inconnu écrivait.
      expect(corps, ou).not.toContain('0 modérateurs');
    }
  }

  /**
   * LA CARTE « À PROPOS » LIT LE MÊME RÉSEAU QUE SON EN-TÊTE.
   *
   * Ses quatre tuiles — membres, visibilité, catégorie, année — étaient dessinées
   * et contredisaient l'en-tête juste au-dessus : « Bénin · 99 membres » en tête,
   * « 890 / membres » et « Pays / catégorie » dans la carte. La catégorie est le
   * discriminant le plus net entre les deux réseaux : « Pays » contre « Ville ».
   */
  for (const reseau of RESEAUX) {
    const fiche = await ctx.request.get(`${API}/communities/${reseau.slug}`, {
      headers: { authorization: `Bearer ${jeton}` },
    });
    const { memberCount } = (await fiche.json()) as { memberCount: number };
    /** Même raison qu'au-dessus : l'écran formate à la française, Node aussi, et
     * leurs espaces de milliers diffèrent selon la version d'ICU. */
    const membresNus = espaces(
      `${new Intl.NumberFormat('fr-FR').format(memberCount)} membres`,
    );

    await page.goto(`/reseaux/${reseau.slug}?onglet=a-propos`);
    await expect(
      page
        .getByText(new RegExp(membresNus.replace(/ /g, '\\s')), { exact: false })
        .filter({ visible: true })
        .first(),
    ).toBeVisible({ timeout: 20_000 });
    const corps = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    expect(corps, `${reseau.slug} — tuile catégorie`).toContain(`${reseau.cat} catégorie`);
    expect(espaces(corps), `${reseau.slug} — tuile membres`).toContain(membresNus);
  }

  /**
   * ── LE PREMIER COUP DE PINCEAU, ET POURQUOI IL A FALLU LE PROVOQUER ──────
   *
   * Le défaut de l'en-tête peint avant d'être su est INVISIBLE à tout ce qui
   * précède — et ce n'est pas une faiblesse de ces assertions, c'est structurel :
   * elles ATTENDENT « 99 membres », donc elles attendent précisément que l'état
   * fautif soit passé. Vérifié par mutation : en retirant la garde `!pret` de
   * `reseau-screen.tsx`, tout ce qui est au-dessus reste VERT.
   *
   * Un témoin vert n'est pas un succès, c'est une question — et la réponse était
   * qu'il manquait une assertion sur l'ÉTAT INTERMÉDIAIRE. On retient donc la
   * réponse de la fiche pour la rendre observable, et on affirme sur ce que
   * l'écran montre PENDANT ce temps-là.
   *
   * Ce que l'écran ne doit pas montrer : le repli peint. Il se reconnaît à la
   * pastille d'initiales réduite à « · » et aux séparateurs du résumé laissés
   * seuls — c'est exactement ce qui s'affichait sur l'onglet « À propos », et
   * c'est ce qu'une capture d'écran a montré là où aucun test ne regardait.
   */
  await page.route('**/v1/communities/ville-lyon', async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });
  await page.goto('/reseaux/ville-lyon?onglet=a-propos');

  // Pendant que la fiche est retenue : l'écran dit qu'il charge…
  await expect(page.getByRole('status')).toContainText('Chargement', { timeout: 2_000 });
  // … et ne peint AUCUN en-tête de repli.
  const pendant = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  expect(pendant, 'en-tête de repli peint pendant le chargement').not.toMatch(/·\s*·/);
  expect(pendant, 'nom de maquette peint pendant le chargement').not.toContain(
    'Béninois en France',
  );

  // Puis l'écran réel arrive, et il dit le bon réseau — avec le compte du
  // serveur, pas le « 72 » figé qu'une base partagée dément.
  const ficheLyon = await ctx.request.get(`${API}/communities/ville-lyon`, {
    headers: { authorization: `Bearer ${jeton}` },
  });
  const { memberCount: membresLyon } = (await ficheLyon.json()) as { memberCount: number };
  await expect(
    page
      .getByText(
        new RegExp(espaces(`${new Intl.NumberFormat('fr-FR').format(membresLyon)} membres`).replace(/ /g, '\\s')),
        { exact: false },
      )
      .filter({ visible: true })
      .first(),
  ).toBeVisible({
    timeout: 20_000,
  });
  await page.unroute('**/v1/communities/ville-lyon');

  await ctx.close();
});
