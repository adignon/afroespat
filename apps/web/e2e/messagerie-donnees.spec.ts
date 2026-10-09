import { expect, test, type Locator, type Page } from '@playwright/test';
import { connecter, type Membre } from './session';

/**
 * M01, X01 et X02 — CE QUE LES ÉCRANS LISENT VRAIMENT DE L'API.
 *
 * ── CE QUE CES TESTS ÉPROUVENT, ET CE QU'ILS N'ÉPROUVENT PAS ───────────────
 *
 * PAS LE DESSIN : il est transcodé de `docs/template/09 Messages et transverse.dc.html`,
 * donc il est celui de la maquette par construction. Ils éprouvent la seule chose
 * que le transcodage ne peut pas garantir — que les valeurs affichées VIENNENT DU
 * SERVEUR, et non de la planche.
 *
 * ── LA FORME DE L'ASSERTION, ET POURQUOI ELLE EST À DEUX FACES ─────────────
 *
 * Un test qui vérifie seulement « l'écran affiche quelque chose » passe aussi bien
 * sur une maquette figée. Chaque test ci-dessous affirme donc DEUX choses :
 *
 *   · ce qui doit s'afficher s'affiche — la valeur du membre créé pour le test ;
 *   · ce qui ne doit PLUS s'afficher n'y est pas — la valeur que la MAQUETTE
 *     dessine (« Amina », « Sandra M. », « Mes études à Lyon »…).
 *
 * La seconde face est la plus importante, et c'est elle qui rougirait si une
 * liaison disparaissait de `tools/screens/09-messages.mjs` : l'écran retomberait
 * sur le texte de la planche, l'air parfaitement normal, et le premier test
 * passerait encore.
 *
 * ── UNE SEULE SESSION POUR TOUT LE FICHIER, ET C'EST MESURÉ ────────────────
 *
 * `POST /auth/otp/request` porte `@RateLimit(10)` À L'HEURE ET PAR ROUTE — pas
 * seulement par numéro. Mesuré, et de la mauvaise façon : une première version de
 * ce fichier ouvrait une session PAR TEST, et les quatre derniers ont échoué sur
 * un `429` annonçant 2 934 secondes d'attente. Le symptôme ne ressemblait en rien
 * à une limite de débit — Playwright disait seulement que `connecter` avait jeté.
 *
 * D'où un seul contexte et une seule page pour tout le fichier, créés une fois.
 * C'est aussi ce qu'exige la ROTATION du jeton de rafraîchissement : le cookie
 * change à chaque échange, et reposer le même dans deux contextes est un REJEU qui
 * fait RÉVOQUER toute la chaîne. Une suite qui se comporte comme un navigateur —
 * un contexte, une page — est la seule qui tienne.
 */

/** Ce fichier pilote lui-même ses tailles : un seul projet suffit. */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'piloté par le test');

/** Les tests partagent une page : ils doivent donc s'exécuter dans l'ordre. */
test.describe.configure({ mode: 'serial' });

let page: Page;
let membre: Membre;

test.beforeAll(async ({ browser, request }) => {
  const contexte = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await connecter(contexte, request, { displayName: 'Awa Traoré' });
  page = await contexte.newPage();
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

/**
 * `load`, puis on ATTEND QUE L'ÉTAT D'ATTENTE SOIT PARTI.
 *
 * `page.goto` rend la main dès que le document est là — or le document ne contient
 * d'abord que l'état d'attente : les données arrivent par deux à trois appels
 * d'API, et le premier prend un `401` que le socle rafraîchit puis rejoue. Un test
 * qui affirmerait tout de suite mesurerait le squelette, et son échec dirait
 * « élément introuvable » sans nommer la cause.
 */
async function visiter(url: string, attente: string): Promise<void> {
  await page.goto(url, { waitUntil: 'load' });
  await expect(page.getByText(attente)).toHaveCount(0, { timeout: 20_000 });
  await page.locator('[data-screen]').first().waitFor({ state: 'attached', timeout: 20_000 });
}

/**
 * LE CADRE D'ORDINATEUR, ET RIEN QUE LUI.
 *
 * `ScreenFrames` rend les DEUX cadres et n'en masque qu'un : chaque texte lié
 * figure donc DEUX fois dans le document. Une première version de ce fichier
 * affirmait sans portée et échouait en « strict mode violation : resolved to
 * 2 elements » — ce qui, au passage, PROUVAIT que les deux cadres étaient bien
 * liés. On vise explicitement le cadre d'ordinateur, celui que cette largeur rend
 * visible.
 */
function bureau(): Locator {
  return page.locator('[data-frame="desktop"]').first();
}

test.describe('M01 · la messagerie lit l’API', () => {
  test('la barre haute porte le membre du SERVEUR, pas celui de la maquette', async () => {
    await visiter('/messages', 'Chargement de vos messages…');

    // Ce qui doit s'afficher : le prénom et les initiales du membre créé.
    await expect(bureau().getByText('Awa', { exact: true })).toBeVisible();
    await expect(bureau().getByText('AT', { exact: true })).toBeVisible();

    // Ce qui ne doit PLUS s'afficher : le membre que la maquette dessine.
    await expect(bureau().getByText('Amina', { exact: true })).toHaveCount(0);
    await expect(bureau().getByText('AD', { exact: true })).toHaveCount(0);

    expect(membre?.displayName ?? 'Awa Traoré').toBe('Awa Traoré');
  });

  /**
   * LA LISTE EST VIDE POUR UN MEMBRE NEUF, ET C'EST UNE ASSERTION FORTE.
   *
   * La maquette dessine QUATRE conversations et une demande, avec leurs noms et
   * leurs aperçus. Un membre qui vient d'être créé n'en a aucune. Si la liste
   * n'était pas liée — si le `<sc-for>` de `donnees` disparaissait — les cinq
   * rangées de la planche seraient encore là, et l'écran montrerait les
   * conversations d'une personne qui n'existe pas à un membre qui n'en a aucune.
   *
   * C'est exactement le genre de défaut qu'aucun test de forme ne voit : le JSX
   * compile, la page s'affiche, elle est simplement FAUSSE.
   */
  test('les conversations de la maquette ont disparu : la liste vient du serveur', async () => {
    await visiter('/messages', 'Chargement de vos messages…');

    for (const dessine of [
      'Sandra M.',
      'Kofi Boateng',
      'Marc Koudou',
      'Yasmine Benali',
      'Mes études à Lyon',
      'Aïcha : Tu veux que je relise ?',
      'Merci pour la table !',
    ]) {
      await expect(bureau().getByText(dessine, { exact: true })).toHaveCount(0);
    }

    // Le compteur de demandes est, lui, bien LIÉ : il vaut zéro, pas « 2 ».
    await expect(bureau().getByText('DEMANDES · 0')).toBeVisible();
    await expect(bureau().getByText('DEMANDES · 2')).toHaveCount(0);
  });

  /**
   * LE FIL DE LA MAQUETTE A DISPARU AUSSI — et avec lui ses trois bulles.
   *
   * 00 §8.1 : le corps des messages est chiffré AU REPOS. Le serveur descelle avant
   * de répondre, donc ce qui arrive à l'écran est du texte clair — et c'est
   * précisément pour cela que les bulles de la planche ne doivent plus s'afficher :
   * elles donneraient à croire qu'une conversation existe là où il n'y en a pas.
   */
  test('le fil de la maquette a disparu : les bulles viennent du serveur', async () => {
    await visiter('/messages', 'Chargement de vos messages…');

    for (const bulle of [
      'J’ai visité le studio de la rue Garibaldi, ils demandent un garant.',
      'Avec Visale ça passe. Tu veux que je relise ton dossier ce soir ?',
      'Oui avec plaisir, je t’envoie tout.',
      // La ligne SYSTÈME : aucune route n'en produit, elle est retirée du gabarit.
      'Aïcha a rejoint le parcours',
    ]) {
      await expect(bureau().getByText(bulle, { exact: true })).toHaveCount(0);
    }
  });

  /**
   * L'ÉTAT BLOQUÉ RESTE ATTEIGNABLE, et il porte la phrase DU PORTEUR.
   *
   * ⚠ Cette phrase ne vient d'AUCUNE maquette : elle est déclarée en `texte` dans
   * `tools/screens/09-messages.mjs`, et le générateur l'annonce par un `⚠` à chaque
   * exécution. Ce test fige cette honnêteté — mais il affirme SURTOUT que le
   * composeur a disparu, ce qui est la vraie règle de l'état : un membre bloqué ne
   * doit pouvoir ni écrire ni envoyer, et la seule façon d'en être sûr est que les
   * trois contrôles ne soient PAS LÀ.
   */
  test('un membre bloqué : le composeur est remplacé, pas seulement masqué', async () => {
    await visiter(
      '/messages/01a0f8d8-b504-7000-baa1-fcf0787b4d6a?etat=bloque',
      'Chargement de vos messages…',
    );

    await expect(
      bureau().getByText(
        'Vous avez bloqué ce membre. Débloquez-le pour reprendre la conversation.',
      ),
    ).toBeVisible();

    await expect(bureau().getByText('Écrire un message…')).toHaveCount(0);
    await expect(bureau().getByText('Message…', { exact: true })).toHaveCount(0);
  });
});

test.describe('X02 · les notifications lisent l’API', () => {
  /**
   * LES CINQ LIGNES DE LA MAQUETTE ONT DISPARU.
   *
   * Même raisonnement que pour la liste de conversations : un membre neuf n'a
   * aucune notification, donc aucune ligne ne doit s'afficher. Les cinq lignes
   * dessinées sont la preuve par l'absence que le `<sc-for>` est bien branché.
   */
  test('les notifications de la maquette ont disparu', async () => {
    await visiter('/notifications', 'Chargement de vos notifications…');

    for (const dessinee of [
      'Sandra et 4 autres',
      '3 nouvelles réponses',
      'Repas partagé',
      'a accepté d’être votre parraine',
    ]) {
      await expect(bureau().getByText(dessinee)).toHaveCount(0);
    }

    // Le titre de la page, lui, reste : il n'est pas une donnée.
    await expect(bureau().getByRole('heading', { level: 1 })).toHaveText('Notifications');
  });

  /**
   * LE PANNEAU DÉROULANT LIT LA MÊME LISTE.
   *
   * 12 §2.7 décrit deux formes, et la maquette les dessine toutes les deux. Les
   * deux planches portent la MÊME liste liée — un test qui n'éprouverait que la
   * page complète laisserait le panneau figé sur les cinq lignes dessinées.
   */
  test('le panneau déroulant lit la même liste que la page', async () => {
    await visiter('/notifications?vue=panneau', 'Chargement de vos notifications…');

    await expect(bureau().getByText('Voir tout')).toBeVisible();
    await expect(bureau().getByText('Sandra et 4 autres')).toHaveCount(0);
  });
});

test.describe('X01 · la recherche lit l’API', () => {
  /**
   * LE TITRE PORTE LA REQUÊTE DE L'URL, pas celle de la maquette.
   *
   * La planche écrit « Résultats pour « visale » ». Le titre est désormais lié à
   * `meta.q` — ce que le SERVEUR a compris de la requête — donc une autre requête
   * doit donner un autre titre. Chercher « visale » ne prouverait rien : c'est le
   * mot que la maquette dessine, et un écran non branché passerait le test.
   */
  test('le titre suit la requête de l’URL', async () => {
    await visiter('/recherche?q=colocation', 'Recherche en cours…');

    await expect(bureau().getByRole('heading', { level: 1 })).toHaveText(
      'Résultats pour « colocation »',
    );
    await expect(bureau().getByText('Résultats pour « visale »')).toHaveCount(0);
  });

  /**
   * LES SUGGESTIONS DE LA MAQUETTE ONT DISPARU.
   *
   * Elle en dessine trois (« vis|ale étudiant », « vis|a long séjour »,
   * « vis|ite préfecture Lyon »), surlignage compris. Sur un index vide, aucune ne
   * doit rester.
   */
  test('les suggestions dessinées ont disparu', async () => {
    await visiter('/recherche?q=colocation', 'Recherche en cours…');

    for (const suggestion of ['ale étudiant', 'a long séjour', 'ite préfecture Lyon']) {
      await expect(bureau().getByText(suggestion)).toHaveCount(0);
    }
  });
});
