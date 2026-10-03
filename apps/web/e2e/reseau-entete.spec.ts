import { expect, test } from '@playwright/test';
import { connecter } from './session';

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
 * ── LES VALEURS SONT ÉCRITES EN DUR, ET C'EST VOULU ───────────────────────
 *
 * 99 membres pour « Bénin », 72 pour « Lyon » : les deux réseaux automatiques du
 * jeu de développement. Les relire depuis l'API serait une tautologie — le test
 * comparerait la réponse à elle-même. La base est PARTAGÉE, donc ces nombres
 * peuvent bouger ; ce test rougira alors et dira exactement où regarder, ce qui
 * vaut mieux qu'une borne calculée, toujours verte et qui ne garde rien.
 */

const RESEAUX = [
  { slug: 'pays-bj', nom: 'Bénin', membres: '99 membres', genre: 'réseau de pays', cat: 'Pays' },
  { slug: 'ville-lyon', nom: 'Lyon', membres: '72 membres', genre: 'réseau de ville', cat: 'Ville' },
] as const;

/** Les cinq onglets A08T, plus « sujets » qui est le cadre complet de A08. */
const ONGLETS = ['sujets', 'fil', 'evenements', 'membres', 'album', 'a-propos'] as const;

/** Ce que la maquette dessine, et qu'aucun écran ne doit plus montrer. */
const LITTERAUX_DE_MAQUETTE = ['Béninois en France', '890 membres', 'BN'] as const;

test('l’en-tête de réseau dit le réseau ouvert, sur les six onglets', async ({
  browser,
  request,
}) => {
  test.setTimeout(180_000);
  const ctx = await browser.newContext();
  await connecter(ctx, request, { displayName: 'Lectrice Réseaux' });
  const page = await ctx.newPage();

  for (const reseau of RESEAUX) {
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
      await expect(page.getByText(reseau.membres, { exact: false }).first(), ou).toBeVisible({
        timeout: 20_000,
      });

      const corps = (await page.locator('body').innerText()).replace(/\s+/g, ' ');

      // PRÉSENCE — l'écran dit bien ce réseau-ci.
      expect(corps, ou).toContain(reseau.nom);
      expect(corps, ou).toContain(reseau.membres);
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
    await page.goto(`/reseaux/${reseau.slug}?onglet=a-propos`);
    await expect(page.getByText(reseau.membres, { exact: false }).first()).toBeVisible({
      timeout: 20_000,
    });
    const corps = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    expect(corps, `${reseau.slug} — tuile catégorie`).toContain(`${reseau.cat} catégorie`);
    expect(corps, `${reseau.slug} — tuile membres`).toContain(reseau.membres);
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

  // Puis l'écran réel arrive, et il dit le bon réseau.
  await expect(page.getByText('72 membres', { exact: false }).first()).toBeVisible({
    timeout: 20_000,
  });
  await page.unroute('**/v1/communities/ville-lyon');

  await ctx.close();
});
