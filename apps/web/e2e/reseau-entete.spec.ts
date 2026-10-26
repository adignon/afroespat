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

/**
 * Le réseau de VILLE est celui de la première ville ACTIVE du référentiel — celle où
 * `connecter()` installe ses membres, donc la seule dont le réseau existe sur une base
 * fraîche (lot w5b : « ville-lyon » supposait une ville de Lyon active, ce que le jeu
 * de référence n'offre pas — Lyon y est inactive et n'a aucun réseau).
 */
interface ReseauAttendu {
  readonly slug: string;
  readonly nom: string;
  readonly genre: string;
  readonly cat: string;
}

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

  const villes = (await (await ctx.request.get(`${API}/places/cities?limit=50`)).json()) as {
    items: { name: string; slug: string; isActive: boolean }[];
  };
  const ville = villes.items.find((v) => v.isActive);
  if (ville === undefined) throw new Error('aucune ville active : aucun réseau de ville à éprouver');
  const RESEAUX: readonly ReseauAttendu[] = [
    { slug: 'pays-bj', nom: 'Bénin', genre: 'réseau de pays', cat: 'Pays' },
    { slug: `ville-${ville.slug}`, nom: ville.name, genre: 'réseau de ville', cat: 'Ville' },
  ];
  const SLUG_VILLE = `ville-${ville.slug}`;

  /**
   * LA CARTE « À PROPOS » LIT LE MÊME RÉSEAU QUE SON EN-TÊTE.
   *
   * Ses quatre tuiles — membres, visibilité, catégorie, année — étaient dessinées
   * et contredisaient l'en-tête juste au-dessus : « Bénin · 99 membres » en tête,
   * « 890 / membres » et « Pays / catégorie » dans la carte. La catégorie est le
   * discriminant le plus net entre les deux réseaux : « Pays » contre « Ville ».
   */
  /**
   * LE COMPTE DÉRIVE PENDANT LA MESURE (lot w5b) — et ce n'est pas un défaut du produit.
   *
   * Ces réseaux sont AUTOMATIQUES : tout membre du Bénin entre dans « pays-bj », et la
   * batterie en inscrit en continu sur d'autres ouvriers. Lire le compte du serveur AVANT
   * l'écran et exiger l'égalité exacte rougissait dès qu'un membre arrivait entre les
   * deux lectures (« 50 membres » attendus, 70 à l'écran). On encadre donc : le compte de
   * l'écran doit se trouver entre le compte lu AVANT et celui lu APRÈS. Le littéral de la
   * maquette (« 890 membres ») reste attrapé, puisqu'il sort de cet intervalle.
   */
  const compteDe = async (slug: string): Promise<number> => {
    const fiche = await ctx.request.get(`${API}/communities/${slug}`, {
      headers: { authorization: `Bearer ${jeton}` },
    });
    expect(fiche.ok(), `GET /communities/${slug} : ${fiche.status()}`).toBe(true);
    return ((await fiche.json()) as { memberCount: number }).memberCount;
  };
  /** Le nombre qui précède « membres · réseau de … » dans l'en-tête de la page. */
  const membresDeLEntete = async (): Promise<number> => {
    const entete = page.getByText(/\d[\d\s]*membres\s*·\s*réseau de/).filter({ visible: true }).first();
    await expect(entete).toBeVisible({ timeout: 20_000 });
    const texte = espaces(await entete.innerText());
    const m = /(\d[\d ]*)\s*membres\s*·\s*réseau de/.exec(texte);
    return Number((m?.[1] ?? '').replace(/ /g, ''));
  };

  for (const reseau of RESEAUX) {
    for (const onglet of ONGLETS) {
      const avant = await compteDe(reseau.slug);
      await page.goto(`/reseaux/${reseau.slug}?onglet=${onglet}`);
      const ou = `${reseau.slug} / ${onglet}`;

      const affiche = await membresDeLEntete();
      const apres = await compteDe(reseau.slug);
      expect(affiche, `${ou} — le compte de l'en-tête sort de [${avant}, ${apres}]`).toBeGreaterThanOrEqual(avant);
      expect(affiche, `${ou} — le compte de l'en-tête sort de [${avant}, ${apres}]`).toBeLessThanOrEqual(apres);

      const corps = (await page.locator('body').innerText()).replace(/\s+/g, ' ');

      // PRÉSENCE — l'écran dit bien ce réseau-ci.
      expect(corps, ou).toContain(reseau.nom);
      expect(corps, ou).toContain(reseau.genre);

      // ABSENCE — et plus aucun littéral de la maquette. C'est la moitié qui
      // aurait rougi sur le dépôt d'avant ce lot, et la seule qui le distingue.
      for (const littéral of LITTERAUX_DE_MAQUETTE) {
        expect(corps, `${ou} — littéral de maquette « ${littéral} »`).not.toContain(littéral);
      }

      expect(corps, `${ou} — séparateur orphelin`).not.toMatch(/·\s*·/);
      // Et le « 0 modérateurs » qu'un compteur inconnu écrivait.
      expect(corps, ou).not.toContain('0 modérateurs');
    }
  }

  for (const reseau of RESEAUX) {
    const avant = await compteDe(reseau.slug);
    await page.goto(`/reseaux/${reseau.slug}?onglet=a-propos`);
    const affiche = await membresDeLEntete();
    const apres = await compteDe(reseau.slug);
    expect(affiche, `${reseau.slug} — tuile membres`).toBeGreaterThanOrEqual(avant);
    expect(affiche, `${reseau.slug} — tuile membres`).toBeLessThanOrEqual(apres);
    const corps = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    expect(corps, `${reseau.slug} — tuile catégorie`).toContain(`${reseau.cat} catégorie`);
  }

  await page.route(`**/v1/communities/${SLUG_VILLE}`, async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });
  await page.goto(`/reseaux/${SLUG_VILLE}?onglet=a-propos`);

  // Pendant que la fiche est retenue : l'écran dit qu'il charge…
  await expect(page.getByRole('status').filter({ hasText: 'Chargement' })).toBeVisible({ timeout: 2_000 });
  // … et ne peint AUCUN en-tête de repli.
  const pendant = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  expect(pendant, 'en-tête de repli peint pendant le chargement').not.toMatch(/·\s*·/);
  expect(pendant, 'nom de maquette peint pendant le chargement').not.toContain(
    'Béninois en France',
  );

  // Puis l'écran réel arrive, et il dit le bon réseau — avec un compte du serveur
  // (encadré, voir plus haut), pas le « 72 » figé qu'une base partagée dément.
  const avantLyon = await compteDe(SLUG_VILLE);
  const afficheLyon = await membresDeLEntete();
  const apresLyon = await compteDe(SLUG_VILLE);
  expect(afficheLyon).toBeGreaterThanOrEqual(avantLyon);
  expect(afficheLyon).toBeLessThanOrEqual(apresLyon);
  await page.unroute(`**/v1/communities/${SLUG_VILLE}`);

  await ctx.close();
});
