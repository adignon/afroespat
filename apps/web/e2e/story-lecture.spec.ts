import { type Page, expect, test } from '@playwright/test';
import { connecter } from './session';
import { monterEnL1 } from './niveau';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ A13 — LIRE UNE STORY : LES VOISINS, LE MINUTEUR, LE VOTE                  ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Quatre demandes du porteur, et chacune désignait un écran inerte :
 *
 *   1. « les cartes left et right doivent afficher le contenu des story qui
 *      suivent dynamiquement selon le filtre appliqué » — c'étaient deux
 *      rectangles `#0F5C48` écrits en dur, sous « Aïcha D. » et « Kofi B. » ;
 *   2. « La barre de progression doit progresser pendant 15 s et automatiquement
 *      slide right » — MESURÉ : aucun minuteur, l'URL inchangée après huit
 *      secondes, la barre peinte pleine et immobile ;
 *   3. « Les boutons utile et pas utile […] doivent être cliquables » — MESURÉ :
 *      zéro `<button>` dans tout l'écran ;
 *   4. « La page de création se plaque toujours à gauche sur une partie de la
 *      page » — MESURÉ : la surface sombre faisait 908 px dans un cadre de 1384.
 *
 * Les cas sont bornés au cadre d'ORDINATEUR : la planche de 390 px ne dessine ni
 * cartes voisines ni chevrons.
 */

const a13 = (page: Page) => page.locator('[data-screen="A13"]');

/** Deux stories du même type, pour qu'elles se voisinent. */
async function deuxStories(
  request: Parameters<typeof connecter>[1],
  jeton: string,
): Promise<readonly string[]> {
  const ids: string[] = [];
  for (const [corps, fond] of [
    ['Story A, texte unique.', '#2D6A4F'],
    ['Story B, autre texte.', '#9C2A2A'],
  ]) {
    const r = await request.post(`${API}/stories`, {
      headers: { authorization: `Bearer ${jeton}` },
      data: {
        type: 'CONSEIL',
        body: corps,
        backgroundColor: fond,
        textStyle: 'BOLD',
        category: 'LOGEMENT',
        audience: 'ALL',
        allowMessages: true,
      },
    });
    if (r.ok()) ids.push(((await r.json()) as { story: { id: string } }).story.id);
  }
  return ids;
}

test.describe('A13 — lire une story', () => {
  test.skip(
    ({ viewport }) => (viewport?.width ?? 0) < 1024,
    'la planche de 390 px ne dessine ni cartes voisines ni chevrons',
  );

  test('les cartes voisines portent le contenu des stories voisines', async ({ page, request }) => {
    const m = await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    const { accessToken } = await monterEnL1(page.context(), request, m.accessToken);
    const ids = await deuxStories(request, accessToken);
    expect(ids.length).toBe(2);

    await page.goto(`/stories/${ids[0] ?? ''}`);
    const cartes = a13(page).locator('button[aria-label^="Story de"], button[aria-label^="Aucune story"]');
    await expect(cartes).toHaveCount(2);

    /**
     * LE FOND D'UNE CARTE EST CELUI DE LA STORY VOISINE, pas le `#0F5C48` de la
     * planche. C'est le seul repère qui prouve que le contenu est lu : une
     * vignette écrite en dur aurait toujours la même couleur.
     */
    /**
     * ON ATTEND LA VALEUR, et c'est irréductible : les voisins demandent DEUX
     * allers-retours enchaînés — la story d'abord, puis le ruban FILTRÉ SUR SON
     * TYPE, qu'on ne peut pas demander avant de connaître ce type. Mesurer tout
     * de suite lit le `#0F5C48` de la planche et accuse l'écran d'être inerte.
     */
    /**
     * ON LIT LA CARTE, PAS SA BOÎTE. Depuis que la vignette est « le composant
     * story en petit scale », le bouton porte DEUX `<span>` : la boîte de 180 ×
     * 320 qui découpe, et la carte de 430 × 764 mise à l'échelle qui PEINT. La
     * boîte n'a pas de fond — et une sonde qui lisait le premier `<span>` voyait
     * donc `rgba(0, 0, 0, 0)`, jamais le `#0F5C48` de la planche : elle se
     * déclarait satisfaite AVANT l'arrivée du ruban, sur deux cartes vides.
     */
    await expect
      .poll(
        async () =>
          cartes.evaluateAll((els) =>
            els.map((e) => {
              const carte = e.querySelector('span > span');
              return carte === null ? '' : getComputedStyle(carte).backgroundColor;
            }),
          ),
        { timeout: 15_000 },
      )
      .not.toEqual(['rgb(15, 92, 72)', 'rgb(15, 92, 72)']);

    /**
     * ET CHAQUE CARTE PORTE LE TEXTE DE SA STORY, pas un nom d'exemple.
     *
     * On ne vise PAS un texte précis : le ruban contient toutes les stories du
     * jour, et deux d'entre elles peuvent commencer pareil — la première version
     * de ce cas cherchait « Story B » et en trouvait deux. Ce qui compte est que
     * les deux cartes ne disent pas LA MÊME chose, et qu'elles disent quelque
     * chose : deux rectangles vides les auraient fait échouer toutes deux.
     */
    const textes = await cartes.evaluateAll((els) =>
      els.map((e) => (e.textContent ?? '').trim()),
    );
    expect(textes).toHaveLength(2);
    /**
     * CHAQUE CARTE DIT QUELQUE CHOSE. On ne vérifie PAS qu'elles disent des
     * choses différentes : le ruban porte toutes les stories du jour, et deux
     * d'entre elles peuvent avoir le même corps — une version précédente de ce
     * cas l'a exigé et a échoué sur des stories légitimement jumelles. Ce qui
     * prouve la lecture, c'est le FOND vérifié juste au-dessus : un rectangle
     * écrit en dur aurait toujours la même couleur.
     */
    expect(textes.every((t) => t.length > 0)).toBe(true);
  });

  /**
   * LE MINUTEUR. Ce cas dure plus de quinze secondes, et c'est irréductible : la
   * durée EST ce qu'on mesure. La borne de temps du fichier en tient compte.
   */
  test('la barre se remplit en 15 s, puis la story suivante s’affiche', async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    const m = await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    const { accessToken } = await monterEnL1(page.context(), request, m.accessToken);
    const ids = await deuxStories(request, accessToken);
    await page.goto(`/stories/${ids[0] ?? ''}`);
    // L'écran n'est dessiné qu'une fois la story reçue : rien n'est peint d'avance.
    await expect(a13(page)).toHaveCount(1, { timeout: 15_000 });

    /**
     * La barre est ANIMÉE, et sa durée est celle que `motion.js` déclare sous
     * `storyProgress`. Une barre peinte pleine passerait ce test si l'on ne
     * regardait que sa largeur — on regarde donc l'animation.
     */
    /**
     * DANS LE CADRE VISIBLE. `ScreenFrames` rend les DEUX cadres et en masque un :
     * un repère global en trouve donc deux, et le cas échouait sur une ambiguïté
     * et non sur un défaut.
     */
    const barre = page
      .locator('[data-frame]')
      .filter({ visible: true })
      .first()
      .locator('[data-story-barre="active"]');
    await expect(barre).toHaveCount(1);
    expect(await barre.evaluate((e) => getComputedStyle(e).animationName)).toBe(
      'dp-story-progress',
    );
    expect(await barre.evaluate((e) => getComputedStyle(e).animationDuration)).toBe('15s');

    const avant = page.url();
    await expect.poll(() => page.url(), { timeout: 25_000 }).not.toBe(avant);
    expect(page.url()).toContain('/stories/');
  });

  test('utile et pas utile votent, et une seule des deux porte l’icône', async ({
    page,
    request,
  }) => {
    const m = await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    const { accessToken } = await monterEnL1(page.context(), request, m.accessToken);
    const ids = await deuxStories(request, accessToken);
    await page.goto(`/stories/${ids[0] ?? ''}`);

    const boutons = a13(page).locator('button[aria-pressed]').filter({ hasText: /utile/i });
    await expect(boutons).toHaveCount(2);
    const utile = boutons.first();
    const pasUtile = boutons.last();

    /**
     * AVANT TOUT VOTE, AUCUN DES DEUX N'EST BLANC. C'est le seul écart assumé
     * avec la planche, qui dessine « Utile » en blanc — c'est-à-dire l'écran d'un
     * membre QUI A DÉJÀ VOTÉ. Le laisser ferait croire à chacun qu'il a voté.
     */
    for (const b of [utile, pasUtile]) {
      await expect(b).toHaveAttribute('aria-pressed', 'false');
      expect(await b.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
      await expect(b.locator('svg')).toHaveCount(0);
    }

    await utile.click();
    await expect(utile).toHaveAttribute('aria-pressed', 'true');
    await expect(utile.locator('svg')).toHaveCount(1);
    expect(await utile.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(
      'rgb(255, 255, 255)',
    );
    // « L'autre bouton n'a donc plus de background ou d'icône affiché. »
    await expect(pasUtile.locator('svg')).toHaveCount(0);
    expect(await pasUtile.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(
      'rgba(0, 0, 0, 0)',
    );

    // Et le vote BASCULE : voter contre retire le vote pour.
    await pasUtile.click();
    await expect(pasUtile).toHaveAttribute('aria-pressed', 'true');
    await expect(utile).toHaveAttribute('aria-pressed', 'false');
    await expect(utile.locator('svg')).toHaveCount(0);

    /**
     * ── LE REFUS EST ROUGE ──────────────────────────────────────────────────
     *
     * Le porteur : « Le pas utile et son icône doivent être en rouge quand
     * coché. » Même pastille blanche que l'accord — la paire reste cohérente —
     * et seule l'ENCRE change. `#9C2A2A` est le rouge du dossier : il est dessiné
     * dans la palette de fonds de cette maquette, donc il n'est pas inventé.
     */
    expect(await pasUtile.evaluate((e) => getComputedStyle(e).color)).toBe('rgb(156, 42, 42)');
    expect(await pasUtile.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(
      'rgb(255, 255, 255)',
    );
  });

  /**
   * « La page de création se plaque toujours à gauche sur une partie de la page. »
   *
   * La surface sombre de A14 est un ÉLÉMENT FLEX du cadre : sans `flex-grow` elle
   * se dimensionne sur son contenu — 908 px dans un cadre de 1384, mesuré — et le
   * vert de l'écran se voyait sur le reste.
   */
  test('le composeur remplit sa fenêtre, sans bande à droite', async ({ page, request }) => {
    const m = await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    await monterEnL1(page.context(), request, m.accessToken);
    await page.goto('/accueil');

    const lien = page
      .locator('[data-frame]')
      .filter({ visible: true })
      .first()
      .locator('a[href="/stories/nouvelle"]')
      .first();
    await lien.click();

    const voile = page.locator('[data-fenetre-story]');
    await expect(voile).toHaveCount(1);

    const mesure = await page.evaluate(() => {
      const v = document.querySelector<HTMLElement>('[data-fenetre-story]');
      const cadre = v?.querySelector('[data-frame]') ?? null;
      const surface = cadre?.firstElementChild ?? null;
      if (cadre === null || surface === null) return null;
      const a = cadre.getBoundingClientRect();
      const b = surface.getBoundingClientRect();
      return { cadre: Math.round(a.width), surface: Math.round(b.width) };
    });
    expect(mesure).not.toBeNull();
    // La surface sombre occupe TOUTE la largeur du cadre, à l'arrondi près.
    expect(Math.abs((mesure?.surface ?? 0) - (mesure?.cadre ?? 0))).toBeLessThan(2);
  });
});

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ A13 — ÉCRIRE À L'AUTEUR, ENREGISTRER, ET TOURNER EN ROND                  ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */
test.describe('A13 — les gestes de la story', () => {
  test.skip(
    ({ viewport }) => (viewport?.width ?? 0) < 1024,
    'la planche de 390 px ne dessine ni cartes voisines ni chevrons',
  );

  /**
   * « ça doit être une infinite sliding » — depuis la DERNIÈRE story, « suivant »
   * ramène à la première. Avant, le bouton ne faisait rien aux extrémités, et
   * c'est ce silence que le porteur a lu comme « ne marche plus ».
   */
  test('la traversée est circulaire : après la dernière vient la première', async ({
    page,
    request,
  }) => {
    test.slow();
    const m = await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    const { accessToken } = await monterEnL1(page.context(), request, m.accessToken);
    const ids = await deuxStories(request, accessToken);
    expect(ids.length).toBe(2);

    /**
     * ╔══════════════════════════════════════════════════════════════════════════╗
     * ║ ON MESURE CONTRE LE RUBAN QUE LA PAGE A REÇU, PAS CONTRE LE NÔTRE        ║
     * ╚══════════════════════════════════════════════════════════════════════════╝
     *
     * Deux versions de ce cas se sont trompées de repère avant celle-ci.
     *
     * La première appuyait six fois sur « suivant » en espérant revenir sur ses
     * pas : vrai sur une base vide, faux dès qu'il y a plus de six conseils du
     * jour — MESURÉ : 64. Elle n'atteignait jamais le bord.
     *
     * La deuxième redemandait le ruban par l'API pour en deviner l'ordre. Elle
     * passait seule et tombait dans la série, et la cause est dans
     * `feed.service.ts` : pour un CONSEIL, la clé de tri est `-score`. Les VOTES
     * d'un cas précédent déplacent donc les bulles, et deux appels au même
     * endpoint à deux instants ne rendent pas le même ordre.
     *
     * On n'a pas besoin de le deviner : l'écran fige SON ruban à l'ouverture, et
     * c'est une réponse HTTP qu'on peut lire. C'est elle qui sert de repère —
     * exactement la liste que l'utilisateur parcourt.
     */
    const ruban = page.waitForResponse(
      (r) => r.url().includes('/stories?type=') && r.ok(),
      { timeout: 20_000 },
    );
    await page.goto(`/stories/${ids[0] ?? ''}`);
    await expect(a13(page)).toHaveCount(1, { timeout: 15_000 });

    const recu = (await (await ruban).json()) as {
      readonly items: readonly { readonly stories: readonly { readonly id: string }[] }[];
    };
    // Dédoublonné comme l'écran le fait : le ruban est groupé par auteur et la
    // même story peut revenir dans deux entrées.
    const ordre = [...new Set(recu.items.flatMap((e) => e.stories.map((st) => st.id)))];
    const total = ordre.length;
    const depart = ordre.indexOf(ids[0] ?? '');
    expect(total).toBeGreaterThan(2);
    expect(depart).toBeGreaterThanOrEqual(0);

    const cadre = page.locator('[data-frame]').filter({ visible: true }).first();
    /**
     * ── `.filter({ visible: true })` — LES DEUX CADRES SONT DANS LE DOM ─────
     *
     * Le cadre mobile a reçu ses propres chevrons (« il faut mettre les boutons
     * next et prev » : la planche de 390 px n'en dessinait aucun). Les deux cadres
     * coexistent dans le DOM, l'un masqué par `lg:hidden` ou `hidden lg:block`,
     * donc `button[aria-label="Story suivante"]` en désigne désormais DEUX et le
     * mode strict de Playwright refuse.
     *
     * On vise celui QUE L'ON VOIT, ce qui est la question posée : « le chevron de
     * l'écran où je suis fait-il changer de story ? » Et c'est plus juste que
     * `.first()`, qui aurait pris celui du cadre caché selon l'ordre du DOM.
     */
    const suivant = cadre
      .locator('button[aria-label="Story suivante"]')
      .filter({ visible: true })
      .first();
    const precedent = cadre
      .locator('button[aria-label="Story précédente"]')
      .filter({ visible: true })
      .first();
    await expect(suivant).toHaveCount(1);
    await expect(precedent).toHaveCount(1);

    /**
     * ── ON VA AU BORD PAR LE CÔTÉ LE PLUS COURT ─────────────────────────────
     *
     * Le ruban porte soixante stories et la nôtre peut tomber n'importe où : on
     * rejoint donc l'extrémité la plus proche. Chaque pas est VÉRIFIÉ au passage
     * — c'est ce qui prouve que la traversée suit le ruban entrée par entrée, et
     * non qu'elle saute au hasard.
     */
    const versLeHaut = total - 1 - depart <= depart;
    const bouton = versLeHaut ? suivant : precedent;
    const pas = versLeHaut ? total - 1 - depart : depart;
    let rang = depart;
    for (let k = 0; k < pas; k += 1) {
      rang = versLeHaut ? rang + 1 : rang - 1;
      await bouton.click();
      await expect.poll(() => page.url(), { timeout: 10_000 }).toContain(ordre[rang] ?? '—');
    }
    expect(rang).toBe(versLeHaut ? total - 1 : 0);

    /**
     * ╔══════════════════════════════════════════════════════════════════════════╗
     * ║ LE PAS QUI FRANCHIT LE BORD                                              ║
     * ╚══════════════════════════════════════════════════════════════════════════╝
     *
     * « ça doit être une infinite sliding » : au bout du ruban, le bouton ne doit
     * pas se taire. Avant, il ne faisait rien aux extrémités, et c'est ce silence
     * que le porteur a lu comme « ne marche plus ».
     */
    const apresLeBord = versLeHaut ? 0 : total - 1;
    await bouton.click();
    await expect.poll(() => page.url(), { timeout: 10_000 }).toContain(ordre[apresLeBord] ?? '—');

    /**
     * ET UN PAS DE PLUS, qui distingue la boucle d'une PANNE qui lui ressemble :
     * quand l'écran ne retrouve pas son rang dans le ruban, il se rabat sur la
     * première story en avant et sur la dernière en arrière — exactement les deux
     * adresses qu'on vient de vérifier. Si le rang était perdu, ce pas de plus ne
     * bougerait plus. Il doit mener à la story d'après.
     */
    const encore = versLeHaut ? 1 : total - 2;
    await bouton.click();
    await expect.poll(() => page.url(), { timeout: 10_000 }).toContain(ordre[encore] ?? '—');
  });

  /**
   * « Le bouton de bookmark permet d'enregistrer la stories. » La table, son enum
   * et le champ `bookmarked` existaient ; les DEUX ROUTES d'écriture manquaient —
   * le mot n'apparaissait dans aucun contrôleur du dépôt.
   */
  test('le signet enregistre la story, et le dit', async ({ page, request }) => {
    const m = await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    const { accessToken } = await monterEnL1(page.context(), request, m.accessToken);
    const ids = await deuxStories(request, accessToken);
    await page.goto(`/stories/${ids[0] ?? ''}`);

    const signet = a13(page).getByRole('button', {
      name: /Enregistrer la story|Retirer des enregistrées/,
    });
    await expect(signet).toHaveCount(1);
    await expect(signet).toHaveAttribute('aria-label', 'Enregistrer la story');
    await expect(signet).toHaveAttribute('aria-pressed', 'false');
    // Vide, le tracé dit « à garder ».
    await expect(signet.locator('svg')).toHaveAttribute('fill', 'none');

    const reponse = page.waitForResponse((r) => r.url().includes('/bookmark'));
    await signet.click();
    expect((await reponse).status()).toBe(200);

    /** Le même bouton fait les deux : son nom doit donc dire l'ÉTAT, pas le geste. */
    await expect(signet).toHaveAttribute('aria-label', 'Retirer des enregistrées');
    await expect(signet).toHaveAttribute('aria-pressed', 'true');
    // Plein, le tracé dit « gardé ».
    await expect(signet.locator('svg')).toHaveAttribute('fill', '#fff');
  });

  /**
   * « implémente l'envoi de message avec l'input et le serveur ». La planche
   * dessine « Écrire à Awa… » dans un `<span>` : une invite, pas un champ.
   */
  test('le champ écrit à l’auteur, et se vide quand c’est parti', async ({ page, request }) => {
    /**
     * ── DEUX MEMBRES, ET L'ORDRE COMPTE ────────────────────────────────────
     *
     * On n'écrit pas à soi-même : `canMessage` est FAUX sur sa propre story, et
     * le champ est alors grisé — à raison. Une première version de ce cas
     * publiait et lisait avec le même membre, et accusait le champ d'être mort
     * alors qu'il protégeait correctement.
     *
     * L'AUTEUR publie d'abord ; `connecter` installe ensuite le LECTEUR dans le
     * navigateur, puisque c'est la dernière session posée qui y vit.
     */
    const auteur = await connecter(page.context(), request, { displayName: 'Kofi Boni' });
    const jetonAuteur = (await monterEnL1(page.context(), request, auteur.accessToken))
      .accessToken;
    const ids = await deuxStories(request, jetonAuteur);
    expect(ids.length).toBe(2);

    const lecteur = await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    // `message.send` est une capacité L1 : un lecteur L0 recevrait `LEVEL_REQUIRED`.
    await monterEnL1(page.context(), request, lecteur.accessToken);
    await page.goto(`/stories/${ids[0] ?? ''}`);

    const champ = a13(page).getByRole('textbox').first();
    await expect(champ).toHaveCount(1);
    await expect(champ).not.toBeDisabled();

    const envoi = page.waitForResponse(
      (r) => r.url().includes('/conversations/direct') && r.request().method() === 'POST',
    );
    await champ.fill('Bonjour, mesuré au navigateur.');
    /**
     * ENTRÉE ENVOIE : la planche ne dessine AUCUN bouton d'envoi à côté du champ,
     * seulement le signet. C'est la touche qui porte le geste.
     */
    await champ.press('Enter');
    expect((await envoi).status()).toBe(201);

    /**
     * LE CHAMP SE VIDE, et c'est la seule preuve que l'écran a LU la réponse.
     *
     * Il ne se vidait pas : le schéma de réponse attendait `{ id }` alors que la
     * route rend `{ conversationId, messageId, pending }`. Le `201` partait, le
     * message était créé, et l'écran croyait à un échec — un cas où la frontière
     * stricte a fait son travail en refusant ce qu'on avait mal décrit.
     */
    await expect(champ).toHaveValue('');
  });
});

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ A13 EN FENÊTRE — LE FOND, LA VIGNETTE, LE BOUTON D'ENVOI, LES TOASTS      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */
test.describe('A13 — la fenêtre et ses gestes', () => {
  test.skip(
    ({ viewport }) => (viewport?.width ?? 0) < 1024,
    'la planche de 390 px ne dessine ni cartes voisines ni chevrons',
  );

  /** L'auteur publie, le LECTEUR regarde : on ne s'écrit pas à soi-même. */
  async function ouvrirDepuisLeFil(
    page: Page,
    request: Parameters<typeof connecter>[1],
  ): Promise<void> {
    const auteur = await connecter(page.context(), request, { displayName: 'Kofi Boni' });
    const jeton = (await monterEnL1(page.context(), request, auteur.accessToken)).accessToken;
    const ids = await deuxStories(request, jeton);
    expect(ids.length).toBe(2);

    const lecteur = await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    await monterEnL1(page.context(), request, lecteur.accessToken);
    await page.goto('/accueil');
    await page.locator(`a[href="/stories/${ids[0] ?? ''}"]`).first().click();
    await expect(page.locator('[data-fenetre-story]')).toHaveCount(1);
  }

  test('le fond est transparent : on voit la page derrière', async ({ page, request }) => {
    await ouvrirDepuisLeFil(page, request);

    /**
     * Le porteur : « Le background n'est pas transparent […] il doit couvrir
     * toute la page et être transparent pour voir le contenu derrière. »
     *
     * La coque de A13 peint `#101A17` EN DUR — juste pour une page entière, faux
     * pour une fenêtre : cet aplat recouvrait le voile, et donc le fil.
     */
    const fond = await page.evaluate(() => {
      const v = document.querySelector<HTMLElement>('[data-fenetre-story]');
      const coque = v?.querySelector<HTMLElement>('[data-screen="A13"] > div') ?? null;
      return {
        voile: v === null ? '' : getComputedStyle(v).backgroundColor,
        coque: coque === null ? '' : getComputedStyle(coque).backgroundColor,
      };
    });
    /**
     * NEUF DIXIÈMES. Les huit fenêtres des maquettes écrivent `.55`, et c'est ce
     * qui était posé. Le porteur, capture à l'appui : « le background doit être
     * avec une opacité à 90% » — sur une story, une surface de couleur pleine au
     * milieu de l'écran, le fil resté lisible derrière lui faisait concurrence.
     */
    expect(fond.voile).toBe('rgba(22, 33, 29, 0.9)');
    expect(fond.coque).toBe('rgba(0, 0, 0, 0)');
  });

  /**
   * « Le bouton close ne fonctionne pas ? » MESURÉ : la croix de l'en-tête était
   * un `<span>` dans les deux planches — aucun geste, aucun nom accessible, ni
   * cliquable ni atteignable au clavier.
   */
  test('la croix ferme la story et rend la page de dessous', async ({ page, request }) => {
    await ouvrirDepuisLeFil(page, request);
    const fenetre = page.locator('[data-fenetre-story]');
    const fermer = fenetre.getByRole('button', { name: 'Fermer' });
    await expect(fermer, 'la croix n’est pas un bouton nommé').toHaveCount(1);

    await fermer.click();
    await expect(fenetre).toHaveCount(0);
    // On revient D'OÙ L'ON VIENT, et non sur une adresse fixe.
    expect(page.url()).toContain('/accueil');
  });

  /** « Retire le logo de la page de display des story. » */
  test('la fenêtre ne porte pas le logo du produit', async ({ page, request }) => {
    await ouvrirDepuisLeFil(page, request);
    const fenetre = page.locator('[data-fenetre-story]');
    await expect(fenetre.locator('[data-story-fond]').first()).toBeVisible({ timeout: 15_000 });

    /**
     * La planche de 1440 px le pose en absolu, en haut à gauche. C'est juste pour
     * une PAGE — elle doit se nommer — et faux pour une fenêtre : le fil de
     * dessous porte déjà le logo, et il s'y retrouvait deux fois, dont une
     * par-dessus le voile.
     */
    expect(await fenetre.innerText()).not.toContain('Diaspora');
  });

  /**
   * ╔════════════════════════════════════════════════════════════════════════════╗
   * ║ LA BARRE S'ARRÊTE PENDANT QU'ON ÉCRIT                                     ║
   * ╚════════════════════════════════════════════════════════════════════════════╝
   *
   * « Le focus dans l'input de message doit stopper temporairement la progress
   * bar. » Et ce n'est pas qu'un détail de mouvement : à son terme, la barre fait
   * PASSER à la story suivante — un message à moitié écrit disparaissait sous les
   * doigts.
   */
  test('la barre se fige au focus du champ, et repart au blur', async ({ page, request }) => {
    await ouvrirDepuisLeFil(page, request);
    const fenetre = page.locator('[data-fenetre-story]');
    await expect(fenetre.locator('[data-story-fond]').first()).toBeVisible({ timeout: 15_000 });

    const barre = () =>
      page.evaluate(() => {
        const b = document.querySelector<HTMLElement>(
          '[data-fenetre-story] [data-story-barre="active"]',
        );
        return b === null
          ? null
          : { jeu: getComputedStyle(b).animationPlayState, large: b.getBoundingClientRect().width };
      });

    await expect.poll(async () => (await barre())?.jeu, { timeout: 5_000 }).toBe('running');

    await fenetre.getByRole('textbox').first().focus();
    await expect.poll(async () => (await barre())?.jeu, { timeout: 5_000 }).toBe('paused');

    /**
     * ET ELLE NE BOUGE PLUS. L'état « en pause » ne suffit pas à le prouver : on
     * regarde la LARGEUR deux secondes plus tard. Une barre qui avance encore
     * voudrait dire que la story va changer, ce que la pause existe pour empêcher.
     */
    const figee = (await barre())?.large ?? 0;
    await page.waitForTimeout(2_000);
    /**
     * UN PIXEL DE TOLÉRANCE, et il est mérité : entre l'instant où l'attribut
     * passe à « oui » et celui où le moteur arrête l'animation, il reste une
     * trame. Exiger l'égalité stricte faisait tomber ce cas une fois sur
     * plusieurs — sur une trame, pas sur un défaut. En deux secondes, une barre
     * qui tourne encore aurait avancé de plus de deux cents fois ça.
     */
    expect((await barre())?.large ?? 0).toBeLessThanOrEqual(figee + 1);

    await fenetre.getByRole('textbox').first().blur();
    await expect.poll(async () => (await barre())?.jeu, { timeout: 5_000 }).toBe('running');
    // Elle REPREND, elle ne recommence pas : la largeur ne revient pas à zéro.
    await expect.poll(async () => (await barre())?.large ?? 0, { timeout: 5_000 }).toBeGreaterThan(
      figee,
    );
  });

  /**
   * ╔════════════════════════════════════════════════════════════════════════════╗
   * ║ L'ANNEAU GRISE SANS QU'ON RAFRAÎCHISSE                                    ║
   * ╚════════════════════════════════════════════════════════════════════════════╝
   *
   * « Il faut rafraîchir pour savoir ce qui est lu ou pas. » La story s'ouvre dans
   * une route INTERCEPTÉE, montée à côté du fil : rien ne redescendait jusqu'au
   * bandeau, dont l'anneau restait vert jusqu'au rechargement de la page.
   */
  test('la story lue grise son anneau dès la fermeture, sans rechargement', async ({
    page,
    request,
  }) => {
    const auteur = await connecter(page.context(), request, { displayName: 'Kofi Boni' });
    const jeton = (await monterEnL1(page.context(), request, auteur.accessToken)).accessToken;
    const ids = await deuxStories(request, jeton);
    const cible = ids[0] ?? '';
    expect(cible).not.toBe('');

    const lecteur = await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    await monterEnL1(page.context(), request, lecteur.accessToken);
    await page.goto('/accueil');

    /**
     * ╔════════════════════════════════════════════════════════════════════════╗
     * ║ LE SIGNAL A CHANGÉ DE FORME AVEC LA BANDE — PAS DE NATURE             ║
     * ╚════════════════════════════════════════════════════════════════════════╝
     *
     * Le porteur : « change la section de stories comme sur la page ci »
     * (`Fil d'actualité v2`). La bande est passée des ronds aux CARTES, et la
     * nouvelle planche ne dessine AUCUN état de lecture — ses cartes sont toutes
     * pareilles.
     *
     * Perdre « ce qu'il me reste à lire » aurait été une régression de produit,
     * pas un choix de dessin. Le signal est donc reporté sur un trait que la
     * planche dessine DÉJÀ — le liseré de 2 px autour de l'avatar — dont seule la
     * COULEUR change : le vert du dépôt tant que la story n'est pas vue, le blanc
     * dessiné ensuite.
     *
     * CE CAS MESURE DONC LA COULEUR ET PLUS L'ÉPAISSEUR. Ce qu'il tient n'a pas
     * bougé : l'anneau se grise à la fermeture, SANS rechargement.
     */
    const anneau = async (): Promise<string> =>
      page.evaluate((id) => {
        const lien = document.querySelector<HTMLElement>(`a[href="/stories/${id}"]`);
        const rond = lien?.querySelector<HTMLElement>('span');
        return rond === null || rond === undefined ? 'absent' : getComputedStyle(rond).borderTopColor;
      }, cible);

    /** `#16785E` : le vert du NON-VU. */
    await expect.poll(anneau, { timeout: 15_000 }).toBe('rgb(22, 120, 94)');

    await page.locator(`a[href="/stories/${cible}"]`).first().click();
    const fenetre = page.locator('[data-fenetre-story]');
    await expect(fenetre.locator('[data-story-fond]').first()).toBeVisible({ timeout: 15_000 });
    await fenetre.getByRole('button', { name: 'Fermer' }).click();
    await expect(fenetre).toHaveCount(0);

    // AUCUN `page.reload()` ici : c'est tout l'objet du cas.
    /** Le blanc que la planche dessine : la story a été vue. */
    await expect.poll(anneau, { timeout: 10_000 }).toBe('rgba(255, 255, 255, 0.9)');
  });

  /**
   * ╔════════════════════════════════════════════════════════════════════════════╗
   * ║ LE FOND SE FOND DANS LE SUIVANT                                           ║
   * ╚════════════════════════════════════════════════════════════════════════════╝
   *
   * « Au niveau de la story il faut que le background se change avec une animation
   * de fade. »
   *
   * CE QUI L'EMPÊCHAIT N'ÉTAIT PAS L'ABSENCE DE TRANSITION, c'était le `key` :
   * l'écran remontait le cadre entier à chaque voisin, pour faire repartir la
   * barre de progression — et on ne transitionne pas la couleur d'un nœud qui
   * vient de naître. La clé est descendue sur la seule barre.
   *
   * Ce cas mesure les deux moitiés : la transition EST déclarée, et le nœud SURVIT
   * au changement de story. Sans la seconde, la première ne ferait rien.
   */
  test('le fond porte une transition, et le nœud survit au changement de story', async ({
    page,
    request,
  }) => {
    await ouvrirDepuisLeFil(page, request);
    const fenetre = page.locator('[data-fenetre-story]');

    /**
     * ON ATTEND LA CARTE. La fenêtre s'ouvre sur « Chargement de la story… » — le
     * cadre ne peint RIEN tant que la réponse n'est pas là, c'est sa discipline —
     * donc le nœud du fond n'existe pas encore à l'instant où elle apparaît.
     */
    await expect(page.locator('[data-fenetre-story] [data-story-fond]').first()).toBeVisible({
      timeout: 15_000,
    });

    const avant = await page.evaluate(() => {
      const n = document.querySelector<HTMLElement>('[data-fenetre-story] [data-story-fond]');
      if (n === null) return null;
      // Un repère posé SUR LE NŒUD : s'il survit, on le retrouvera après le saut.
      n.dataset['temoin'] = 'pose';
      const style = getComputedStyle(n);
      return {
        propriete: style.transitionProperty,
        duree: style.transitionDuration,
        couleur: style.backgroundColor,
      };
    });
    // La couleur, et ELLE SEULE : `background` couvrirait les images, qui ne
    // s'animent pas, pour un calcul à chaque trame.
    expect(avant?.propriete).toBe('background-color');
    expect(avant?.duree).toBe('0.22s');

    /**
     * ON SUIT LA STORY, PAS LA COULEUR. La première version attendait que le fond
     * CHANGE de couleur — et deux stories voisines peuvent légitimement partager
     * la leur : la palette n'a que sept entrées, et le jeu de démonstration les
     * réemploie. Le cas tombait alors sur une coïncidence.
     */
    /**
     * ON ATTEND LE RUBAN AVANT D'APPUYER. « Suivante » ne fait RIEN tant que la
     * traversée n'est pas chargée — et c'est voulu : sauter sur une story au
     * hasard serait pire. Les voisins demandent DEUX allers-retours enchaînés (la
     * story, puis le ruban filtré sur son type), donc appuyer dès que la carte
     * est peinte appuie dans le vide, et le cas attendait ensuite un changement
     * qui ne pouvait plus venir.
     */
    await expect(fenetre.getByRole('button', { name: /Story de/ }).first()).toBeVisible({
      timeout: 15_000,
    });

    const depart = page.url();
    // Même raison qu'au cas des chevrons : les deux cadres sont dans le DOM.
    await fenetre
      .locator('button[aria-label="Story suivante"]')
      .filter({ visible: true })
      .first()
      .click();
    await expect.poll(() => page.url(), { timeout: 10_000 }).not.toBe(depart);

    const survit = await page.evaluate(
      () =>
        document.querySelector<HTMLElement>('[data-fenetre-story] [data-story-fond]')?.dataset[
          'temoin'
        ] ?? null,
    );
    expect(survit, 'le cadre est remonté : la transition ne peut pas jouer').toBe('pose');
  });

  /**
   * ╔════════════════════════════════════════════════════════════════════════════╗
   * ║ UN COMPTE NON VÉRIFIÉ ÉCRIT — ÉCART ASSUMÉ AVEC 08 §5.2                   ║
   * ╚════════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Pour l'envoi de message j'ai cette erreur "Cette action demande
   * de vérifier votre compte". Il faut corriger et permettre l'envoi de message
   * même pour les utilisateurs niveau [0]. »
   *
   * La spec écrivait « L0 → Personne ». L'écart est nommé sur `message.send` dans
   * `capabilities.ts`, avec ce qu'il coûte. Ce cas gèle les DEUX moitiés de la
   * décision : le message part, ET il part en attente d'acceptation — c'est la
   * seule chose qui retient encore un compte non vérifié.
   */
  test('un membre NON VÉRIFIÉ écrit à l’auteur, et la demande part en attente', async ({
    page,
    request,
  }) => {
    /**
     * ── L'AUTEUR EST « INSTALLÉ », ET CE DÉTAIL EST LE SUJET ─────────────────
     *
     * `permissionFor` rend `GREET` — et non `COLD` — quand la cible est un NOUVEL
     * ARRIVANT, parce que §5.2 autorise expressément à « saluer » quelqu'un qui
     * vient d'arriver. Or `GREET` ne met PAS la conversation en attente.
     *
     * MESURÉ en ouvrant le niveau : un compte non vérifié écrit à un nouvel
     * arrivant SANS passer par la demande d'acceptation. C'est la population la
     * plus exposée, et c'est remonté au porteur.
     *
     * Ce cas prend donc un auteur `SETTLED`, où la règle d'attente s'applique :
     * c'est elle qu'il gèle, et c'est la seule qui retient encore un compte non
     * vérifié.
     */
    const auteur = await connecter(page.context(), request, {
      displayName: 'Kofi Boni',
      phase: 'SETTLED',
    });
    const jeton = (await monterEnL1(page.context(), request, auteur.accessToken)).accessToken;
    const ids = await deuxStories(request, jeton);
    expect(ids.length).toBeGreaterThan(0);

    // CE LECTEUR RESTE L0 : pas de `monterEnL1`, c'est tout l'objet du cas.
    await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    await page.goto(`/stories/${ids[0] ?? ''}`);

    const cadre = page.locator('[data-frame]').filter({ visible: true }).first();
    const champ = cadre.getByRole('textbox').first();
    await champ.focus();
    await champ.fill('Bonjour, une question sur votre conseil.');

    const demande = page.waitForRequest(
      (r) => r.url().includes('/conversations') && r.method() === 'POST',
    );
    await cadre.getByRole('button', { name: 'Envoyer' }).click();
    const reponse = await (await demande).response();
    expect(reponse?.status(), 'le niveau refuse encore l’envoi').toBe(201);
    const charge = (await reponse?.json()) as { pending?: boolean };
    expect(charge.pending, 'la demande doit partir en attente d’acceptation').toBe(true);

    await expect(page.getByText(/Message envoyé à|Demande envoyée à/)).toHaveCount(1);
    await expect(page.getByText(/vérifier votre compte/)).toHaveCount(0);
  });

  /**
   * « La vignette peut être juste le composant story en petit scale. » C'est
   * littéralement ce qui est fait : la carte est composée à SA taille, puis
   * `transform: scale()` la ramène à la boîte de 180 × 320 de la planche.
   */
  test('la vignette est la carte mise à l’échelle', async ({ page, request }) => {
    await ouvrirDepuisLeFil(page, request);

    const carte = page
      .locator('[data-fenetre-story]')
      .getByRole('button', { name: /Story de/ })
      .first();
    const mesure = await carte.evaluate((e) => {
      const boite = e.querySelector('span');
      const mini = boite?.querySelector('span') ?? null;
      if (boite === null || mini === null) return null;
      const b = boite.getBoundingClientRect();
      return {
        boite: `${Math.round(b.width)}x${Math.round(b.height)}`,
        echelle: getComputedStyle(mini).transform,
        texte: (mini.textContent ?? '').trim(),
      };
    });
    // La boîte garde sa taille dessinée ; c'est le contenu qui rétrécit.
    expect(mesure?.boite).toBe('180x320');
    expect(mesure?.echelle).toContain('0.4186');
    // Et elle porte la composition de la carte : pastille, étiquette, corps.
    expect((mesure?.texte ?? '').length).toBeGreaterThan(10);
  });

  /**
   * « dès que l'input est focus il faut afficher un bouton d'icône d'envoi
   * rounded blanc flottant dans le coin droit de l'input », et « il faut un toast
   * message qui dit si le message est bien envoyé ou pas ».
   */
  test('le bouton d’envoi apparaît au focus, et le toast dit ce qui s’est passé', async ({
    page,
    request,
  }) => {
    await ouvrirDepuisLeFil(page, request);
    const fenetre = page.locator('[data-fenetre-story]');
    const champ = fenetre.getByRole('textbox').first();
    const envoyer = fenetre.getByRole('button', { name: 'Envoyer' });

    // Il n'existe pas tant que le champ dort : la planche n'en dessine aucun.
    await expect(envoyer).toHaveCount(0);
    await champ.focus();
    await expect(envoyer).toHaveCount(1);

    await champ.fill('Bonjour, mesuré au navigateur.');
    await envoyer.click();
    await expect(page.getByText(/Message envoyé à|Demande envoyée à/)).toHaveCount(1);
  });

  /** « Après le check du bookmark il faut informer "Storie enregistré etc..." » */
  test('le signet annonce ce qu’il a fait', async ({ page, request }) => {
    await ouvrirDepuisLeFil(page, request);
    await page
      .locator('[data-fenetre-story]')
      .getByRole('button', { name: 'Enregistrer la story' })
      .click();
    /**
     * La phrase dit AUSSI ce que l'enregistrement apporte : c'est la seule
     * occasion de le dire, et une story disparaît au bout de vingt-quatre heures
     * sauf pour qui l'a gardée.
     */
    await expect(page.getByText(/Story enregistrée/)).toHaveCount(1);
  });
});

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ A14 — LA SIGNATURE DU COMPOSEUR ET LE CHOIX D'ÉTAPE                       ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */
/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ CE BLOC NE SE SAUTE PAS SOUS 1024 px — ET C'EST LE POINT                  ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Les autres blocs de ce fichier sont bornés au cadre d'ordinateur : la planche de
 * 390 px ne dessine ni cartes voisines ni chevrons. Celui-ci NON, parce que le
 * défaut qu'il garde était précisément une différence ENTRE LES DEUX CADRES — la
 * maquette dessine le bloc photo sur le petit et pas sur le grand. Un cas borné à
 * l'un des deux serait resté vert.
 */
/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE RUBAN DU FIL — SUR TÉLÉPHONE, AUCUNE BULLE N'OUVRAIT RIEN              ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « sur mobile l'affichage des stories ne marche pas ».
 *
 * MESURÉ au navigateur, à 390 px : le ruban « STORIES DU JOUR » affichait bien ses
 * CINQUANTE-QUATRE bulles — elles ne manquaient pas, et c'est pour cela que le
 * défaut se décrivait mal — mais `a` y comptait ZÉRO. On touchait une story et il
 * ne se passait rien. À 1 440 px, les mêmes bulles étaient cinquante-quatre liens.
 *
 * LA CAUSE : la transformation qui pose le lien cherchait `width: "92px"`, la bulle
 * de la planche D'ORDINATEUR. Le téléphone dessine la sienne à 76 px, avec un écart
 * de 5 et non de 6. Comme A01 porte AUSSI un cadre d'ordinateur où la
 * transformation réussissait, le garde-fou « transformation jamais appliquée » ne
 * voyait aucune anomalie — un défaut qui ne pouvait être trouvé qu'en ouvrant le
 * produit sur un téléphone.
 *
 * ── CE CAS EST POSÉ AUX DEUX LARGEURS ─────────────────────────────────────
 *
 * Et c'est tout son intérêt : écrit sur le seul mobile, il serait resté muet sur la
 * régression inverse. La mesure est la MÊME des deux côtés — « autant de liens que
 * de bulles » — donc aucune des deux planches ne peut se mettre à mentir seule.
 */
test.describe('le ruban du fil — une bulle s’ouvre, aux deux largeurs', () => {
  for (const largeur of [390, 1440] as const) {
    test(`${String(largeur)} px — chaque bulle de story est un lien vers la sienne`, async ({
      page,
      request,
    }) => {
      const ouvert = await connecter(page.context(), request, { displayName: 'Awa Konaté' });
      const moi = await monterEnL1(page.context(), request, ouvert.accessToken);
      const publiee = await request.post(`${API}/stories`, {
        headers: { authorization: `Bearer ${moi.accessToken}` },
        data: {
          type: 'CONSEIL',
          body: 'Une story pour le ruban.',
          backgroundColor: '#2D6A4F',
          textStyle: 'BOLD',
          category: 'LOGEMENT',
          audience: 'ALL',
          allowMessages: true,
        },
      });
      expect(publiee.status(), 'la story n’a pas été publiée').toBe(201);

      await page.setViewportSize({ width: largeur, height: 844 });
      await page.goto('/accueil');

      const releve = await page.evaluate(async () => {
        const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));
        await attendre(2500);
        const cadre = [...document.querySelectorAll<HTMLElement>('[data-frame]')].find(
          (e) => e.getBoundingClientRect().width > 0,
        );
        if (cadre === undefined) return null;
        /**
         * ── LE RUBAN SE TROUVE PAR SA TUILE « CRÉER », PAS PAR SON TITRE ────
         *
         * Première version : « le frère suivant du titre STORIES DU JOUR ». Elle a
         * rougi à 1 440 px en rendant QUATRE enfants nommés « Tout »,
         * « Informations », « Conseils », « Découvertes » — la planche
         * d'ordinateur glisse une rangée de filtres entre le titre et le ruban,
         * celle du téléphone non. La sonde lisait donc le mauvais bloc, et elle
         * disait « aucune bulle n'est un lien » d'une rangée de boutons.
         *
         * On part de ce que les DEUX planches ont en commun : la tuile « Créer une
         * story », qui est la première du ruban. On remonte jusqu'au premier
         * ancêtre qui porte plusieurs enfants — c'est le ruban lui-même.
         */
        const creer = cadre.querySelector('a[href="/stories/nouvelle"]');
        if (creer === null) return null;
        /**
         * ── LA TUILE D'APPEL EST MAINTENANT LE LIEN LUI-MÊME ────────────────
         *
         * Le porteur : « change la section de stories comme sur la page ci »
         * (`Fil d'actualité v2`). La bande est passée des ronds aux CARTES, et la
         * carte « Partager un jalon » n'est plus un `<div>` CONTENANT un lien :
         * elle EST le lien. `creer.closest('div')` remontait donc à la bande,
         * puis `.parentElement` au bloc au-dessus — la sonde lisait le mauvais
         * conteneur.
         *
         * On prend donc le parent du lien directement quand celui-ci est déjà la
         * tuile, et la tuile sinon. Les deux formes passent, et ce cas ne dépend
         * plus de la façon dont la carte est enveloppée.
         */
        const tuileCreer = creer.parentElement?.children.length === 1 ? creer.closest('div') : creer;
        const bande = tuileCreer?.parentElement ?? null;
        if (bande === null) return null;
        /**
         * LA PREMIÈRE TUILE EST L'APPEL À PUBLIER — même gabarit, même écart, et
         * elle vient AVANT la boucle. Elle est écartée par son ADRESSE, pas par sa
         * position : une tuile ajoutée en tête ne ferait pas passer ce cas au
         * vert. On regarde la tuile ELLE-MÊME autant que ce qu'elle contient,
         * puisqu'elle peut être le lien.
         */
        const estAppel = (t: HTMLElement): boolean =>
          t.getAttribute('href') === '/stories/nouvelle' ||
          t.querySelector('a[href="/stories/nouvelle"]') !== null;
        const tuiles = [...bande.children] as HTMLElement[];
        const stories = tuiles.filter((t) => !estAppel(t));
        return {
          stories: stories.length,
          versUneStory: stories.filter((t) => {
            const a = t.tagName === 'A' ? t : t.querySelector('a');
            const href = a?.getAttribute('href') ?? '';
            return /^\/stories\/[0-9a-f-]{8,}$/.test(href);
          }).length,
        };
      });

      expect(releve, 'le ruban « STORIES DU JOUR » est introuvable').not.toBeNull();
      /** Non-vacuité : sans bulle, « toutes les bulles sont des liens » est creux. */
      expect(releve?.stories ?? 0, 'aucune bulle de story dans le ruban').toBeGreaterThan(0);
      expect(
        releve?.versUneStory,
        'des bulles s’affichent mais n’ouvrent aucune story',
      ).toBe(releve?.stories);
    });
  }
});

test.describe('A13 — la photo de fond, sur les deux cadres', () => {
/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA PHOTO D'UNE STORY NE S'AFFICHAIT PAS                                   ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « J'ajoute une image mais elle ne s'affiche pas dans le display
 * de story. »
 *
 * MESURÉ de bout en bout — média envoyé (201), story publiée (201), `GET
 * /stories/:id` rendant bien `backgroundUrl` — puis relue à 1440 px : les trois
 * couches de la carte portaient `background-image: none`. La photo était
 * composée, stockée, servie, et JAMAIS PEINTE : la maquette dessine le bloc
 * photo dans son cadre de 390 px et PAS dans celui de 1440.
 *
 * Ce cas tourne sur LES DEUX cadres, et c'est tout son intérêt : il serait resté
 * vert sur le seul mobile.
 */
test('la photo de fond est peinte, cadrée, et sans l’étiquette de la maquette', async ({
  page,
  request,
}) => {
  const membre = await connecter(page.context(), request, { displayName: 'Awa Konaté' });
  const entete = { authorization: `Bearer ${membre.accessToken}` };

  /** Un JPEG minimal mais VALIDE : le serveur refuse ce qu'il ne sait pas lire. */
  const jpeg = Buffer.from(
    'ffd8ffe000104a46494600010100000100010000ffdb004300ffffffffffffffffffffffffffffff' +
      'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffc0001108000100' +
      '0103012200021101031101ffc40014000100000000000000000000000000000003ffda0008010100' +
      '003f00d2cf20ffd9',
    'hex',
  );
  const media = await request.post(`${API}/media`, {
    headers: entete,
    multipart: { kind: 'POST', file: { name: 'fond.jpg', mimeType: 'image/jpeg', buffer: jpeg } },
  });
  expect(media.status(), 'l’envoi du média a échoué').toBe(201);
  const asset = (await media.json()) as { id: string };

  const publiee = await request.post(`${API}/stories`, {
    headers: entete,
    data: {
      type: 'CONSEIL',
      body: 'Une story avec une photo.',
      backgroundAssetId: asset.id,
      textStyle: 'BOLD',
      category: 'LOGEMENT',
      audience: 'ALL',
      allowMessages: true,
    },
  });
  expect(publiee.status()).toBe(201);
  const { story } = (await publiee.json()) as { story: { id: string } };

  await page.goto(`/stories/${story.id}`);
  const carte = page.locator('[data-story-fond]').filter({ visible: true }).first();
  await expect(carte).toBeVisible({ timeout: 15_000 });

  const couches = await carte.evaluate((e) =>
    [...e.querySelectorAll<HTMLElement>(':scope > div')].map((d) => {
      const style = getComputedStyle(d);
      return { image: style.backgroundImage, taille: style.backgroundSize, repete: style.backgroundRepeat };
    }),
  );

  const photo = couches.find((c) => c.image.startsWith('url('));
  expect(photo, 'aucune couche ne porte l’image : la photo n’est pas peinte').toBeDefined();
  /**
   * ET ELLE EST CADRÉE. Sans `cover` et `no-repeat`, le navigateur pose l'image
   * à sa taille naturelle et la répète : une photo de téléphone remplissait la
   * carte d'un coin agrandi, une petite image s'y répétait en damier.
   */
  expect(photo?.taille).toBe('cover');
  expect(photo?.repete).toBe('no-repeat');

  // LE DÉGRADÉ DE LISIBILITÉ est gardé : il ne décore pas, il rend le texte
  // lisible sur une photo claire.
  expect(couches.some((c) => c.image.includes('linear-gradient'))).toBe(true);

  /**
   * ET PAS L'ÉTIQUETTE DE LA MAQUETTE. « Photo de l'auteur » est ce qu'elle
   * écrit SUR SON HACHURAGE pour dire « ici il y aura une image » — une
   * annotation, qui s'imprimait par-dessus la vraie photo du membre.
   */
  expect(await carte.innerText()).not.toContain('Photo de l’auteur');
  expect(await carte.innerText()).not.toContain("Photo de l'auteur");
});

});

test.describe('A14 — l’aperçu et l’étape', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'mesuré sur la planche de 1440 px');

  test('l’aperçu signe avec le nom du membre, et la pastille tait le sujet non choisi', async ({
    page,
    request,
  }) => {
    const m = await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    await monterEnL1(page.context(), request, m.accessToken);
    await page.goto('/stories/nouvelle');

    const cadre = page.locator('[data-frame]').filter({ visible: true }).first();
    /**
     * « Le nom n'est pas dynamique » : la planche écrit « AD » et « Amina Diallo »
     * en clair, et chaque membre voyait l'aperçu de SA story signé d'un autre nom.
     */
    await expect(cadre.getByText('Awa Konaté')).not.toHaveCount(0);
    await expect(cadre.getByText('Amina Diallo')).toHaveCount(0);

    /**
     * « le "Logement" […] est affiché même quand ce n'est pas encore sélectionné ».
     * Sans sujet retenu, la pastille ne dit QUE le type.
     */
    const texte = await cadre.innerText();
    expect(texte).toContain('CONSEIL');
    expect(texte).not.toContain('CONSEIL · LOGEMENT');
  });

  /**
   * « Pour la section "MON PARCOURS" […] mettre un chevron et afficher un modal
   * de sélection d'une étape. » La liste était posée à plat — quinze étapes, dont
   * certaines à quatre lignes — et repoussait les sujets hors de vue.
   */
  test('l’étape se choisit dans une fenêtre, comme le parcours', async ({ page, request }) => {
    const m = await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    await monterEnL1(page.context(), request, m.accessToken);
    await page.goto('/stories/nouvelle');

    const cadre = page.locator('[data-frame]').filter({ visible: true }).first();
    await cadre.getByRole('textbox').first().fill('Un conseil mesuré.');
    await cadre.getByRole('button', { name: /Suivant|Continuer/ }).first().click();

    const bouton = cadre.getByRole('button', { name: /Sélectionner une étape/ });
    await expect(bouton).toHaveCount(1);
    await expect(bouton).toContainText('Aucune pour l’instant');
    // La liste à plat a disparu du panneau : c'est tout l'intérêt.
    await expect(
      cadre.locator('button[aria-pressed]').filter({ hasText: /^Étape / }),
    ).toHaveCount(0);

    await bouton.click();
    const fenetre = page.locator('[data-modal-panel]');
    await expect(fenetre).toHaveCount(1);
    // Les quinze étapes du parcours, et la recherche qui les suit dans la fenêtre.
    await expect(fenetre.locator('button[aria-pressed]')).not.toHaveCount(0);
    await expect(fenetre.getByLabel('Rechercher une étape')).toHaveCount(1);

    await fenetre.locator('button[aria-pressed]').nth(1).click();
    await expect(fenetre).toHaveCount(0);
    await expect(bouton).toContainText('Étape');
  });
});
