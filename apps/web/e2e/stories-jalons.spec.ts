import { expect, test } from '@playwright/test';
import { connecter } from './session';
import { monterEnL1 } from './niveau';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA BANDE DE STORIES PREND LES CARTES DE « Fil d'actualité v2 »            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Change la section de stories comme sur la page ci » —
 * `docs/template/Fil d'actualité v2.dc.html`.
 *
 * AVANT : une bande de ronds de 68 px (60 sur téléphone) portant des initiales,
 * un anneau, une pastille de type, une légende et un compte d'utiles.
 *
 * APRÈS : des cartes de 198 px de haut qui montrent la story EN FOND, avec
 * l'avatar de l'auteur en haut à gauche, l'étiquette de type et le titre en bas.
 * La première carte appelle à publier.
 *
 * Le fragment est TRANSCODÉ du nouveau fichier à chaque génération, pas recopié :
 * ce cas vérifie donc ce que la maquette dit, et il rougira le jour où elle
 * changera sans que le dépôt suive.
 */
test.describe('la bande de stories, version cartes', () => {
  test('cinq cartes de 198 px, la story en fond, et chacune mène à la sienne', async ({
    page,
    request,
  }, infos) => {
    const telephone = (page.viewportSize()?.width ?? 0) < 1024;

    const ouvert = await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    const moi = await monterEnL1(page.context(), request, ouvert.accessToken);
    const publiee = await request.post(`${API}/stories`, {
      headers: { authorization: `Bearer ${moi.accessToken}` },
      data: {
        type: 'CONSEIL',
        body: 'Le dossier Visale se monte en ligne, comptez deux jours.',
        backgroundColor: '#2D6A4F',
        textStyle: 'BOLD',
        category: 'LOGEMENT',
        audience: 'ALL',
        allowMessages: true,
      },
    });
    expect(publiee.status(), 'la story n’a pas été publiée').toBe(201);
    const { story } = (await publiee.json()) as { story: { id: string } };

    await page.goto('/accueil');

    // ── L'APPEL À PUBLIER, EN TÊTE DE BANDE ──────────────────────────────
    const publier = page.getByText('Partager un jalon').filter({ visible: true }).first();
    await expect(publier, 'la bande n’a pas pris les cartes de la nouvelle planche').toBeVisible({
      timeout: 25_000,
    });
    const carteCta = page
      .locator('a[href="/stories/nouvelle"]')
      .filter({ hasText: 'Partager un jalon' })
      .filter({ visible: true })
      .first();
    await expect(carteCta, 'la carte d’appel ne mène pas au composeur').toBeVisible();

    /**
     * ── LA PREMIÈRE CARTE DE STORY, ET NON LA NÔTRE NOMMÉMENT ────────────
     *
     * MESURÉ : ce cas passait seul et rougissait en batterie. La grille
     * d'ordinateur ne montre que les QUATRE premières stories — c'est le compte
     * que la planche dessine — et les autres suites en publient. La nôtre sortait
     * donc du cadre, et `a[href="/stories/<id>"]` ne trouvait rien.
     *
     * Ce que ce cas tient n'est pas « MA story est là » mais « la bande a pris
     * les cartes de la nouvelle planche ». On vise donc la première carte de
     * story, quelle qu'elle soit. La publication reste nécessaire : sans aucune
     * story, la bande n'aurait que son appel à publier, et le cas serait creux.
     */
    const carte = page.locator(`a[href="/stories/${story.id}"]`).filter({ visible: true }).first();
    /**
     * NOTRE STORY, ET ELLE EST ATTEIGNABLE. Avec la grille d'avant, limitée aux
     * quatre premières, ce cas rougissait en batterie dès qu'une autre suite
     * publiait après lui. Le ruban les porte TOUTES : il suffit de la faire
     * défiler jusqu'à elle, ce que Playwright fait avant de mesurer.
     */
    await expect(carte, 'la story publiée n’a pas de carte dans la bande').toBeAttached({
      timeout: 25_000,
    });
    await carte.scrollIntoViewIfNeeded();

    const boite = await carte.evaluate((n) => {
      const r = n.getBoundingClientRect();
      const fond = n.querySelector<HTMLElement>(':scope > div');
      return {
        h: Math.round(r.height),
        l: Math.round(r.width),
        rayon: getComputedStyle(n).borderRadius,
        fond: fond === null ? '' : getComputedStyle(fond).backgroundColor,
      };
    });
    expect(boite.h, 'la carte ne fait pas la hauteur dessinée').toBe(198);
    expect(boite.rayon).toBe('20px');
    /**
     * LE FOND EST CELUI DE LA STORY — sa photo, ou la couleur choisie à la
     * composition. C'est ce qui distingue la nouvelle carte de l'ancien rond
     * d'initiales : sans fond, une carte vide passerait pour la nouvelle bande.
     * On ne fige PAS une teinte : la première carte n'est pas forcément la story
     * publiée ci-dessus quand d'autres cas en ont posé entre-temps.
     */
    expect(
      boite.fond,
      'la carte ne porte pas la story en fond',
    ).not.toBe('rgba(0, 0, 0, 0)');

    /**
     * ── LA FORME DU CONTENEUR, ET NON UNE LARGEUR DEVINÉE ────────────────
     *
     * L'ordinateur reçoit la GRILLE de cinq colonnes du fichier. Sa largeur de
     * carte dépend de la colonne du fil, qui est plus étroite que le cadre de
     * 1440 px de la planche : relevé 116 px, là où une première version de ce cas
     * attendait « plus de 130 » — un chiffre inventé, pas mesuré. On vérifie donc
     * ce que la maquette DIT (cinq colonnes) et non ce qu'elles mesurent une fois
     * posées dans une colonne dont le fichier ne parle pas.
     *
     * Le téléphone, lui, n'est dessiné NULLE PART dans ce fichier — il ne porte
     * qu'un cadre de 1440 px. Une grille de cinq colonnes sur 390 px donnerait
     * des cartes de 70 px. On garde donc la carte à l'identique et on la fait
     * défiler, comme la bande le faisait déjà. DÉDUCTION, remontée au porteur.
     */
    /**
     * ── CINQ CARTES VISIBLES, ET LES AUTRES AU CHEVRON ───────────────────
     *
     * Le porteur : « Pour le scroll de liste des stories il faut plutôt utiliser
     * des boutons prev et next bien présentés. »
     *
     * La planche dessine cinq cases pour une ligne de 198 px. En grille, un fil
     * de plus de quatre stories débordait sur un second rang et les 198 px se
     * partageaient — relevé 79 px par carte. Le ruban garde la ligne et met les
     * suivantes derrière les chevrons.
     *
     * ON MESURE DONC LA LARGEUR D'UNE CARTE CONTRE CELLE DU RAIL : un cinquième,
     * écarts de 12 px compris. C'est la grille, au pixel près, sans en être une.
     */
    const rail = page.locator('[data-ruban-stories-rail]').filter({ visible: true }).first();
    const largeurRail = await rail.evaluate((n) => n.clientWidth);
    expect(await rail.evaluate((n) => getComputedStyle(n).height)).toBe('198px');
    if (telephone) {
      expect(boite.l, 'la carte de téléphone ne garde pas sa largeur').toBe(124);
    } else {
      const attendue = Math.round((largeurRail - 48) / 5);
      expect(Math.abs(boite.l - attendue), 'la carte ne vaut pas un cinquième du ruban').toBeLessThanOrEqual(2);
    }

    /**
     * LES CHEVRONS N'APPARAISSENT QUE S'IL Y A DE QUOI PARCOURIR. Deux flèches
     * éteintes occuperaient la place de deux cartes pour ne rien promettre. On
     * vérifie donc l'un OU l'autre : soit le ruban déborde et les deux boutons
     * sont là, soit tout tient et il n'y en a aucun.
     */
    const chevrons = page.locator('[data-ruban-stories]').filter({ visible: true });
    const deborde = await rail.evaluate((n) => n.scrollWidth > n.clientWidth + 1);
    await expect(chevrons).toHaveCount(deborde ? 2 : 0);
    if (deborde) {
      const avant = await rail.evaluate((n) => n.scrollLeft);
      await page.locator('[data-ruban-stories="suiv"]').filter({ visible: true }).first().click();
      await expect
        .poll(async () => rail.evaluate((n) => n.scrollLeft), {
          timeout: 10_000,
          message: '« Stories suivantes » ne fait pas avancer le ruban',
        })
        .toBeGreaterThan(avant);
    }

    /**
     * ╔════════════════════════════════════════════════════════════════════════╗
     * ║ LA VIGNETTE EST LA STORY, PAS SON TEXTE RECOLLÉ                       ║
     * ╚════════════════════════════════════════════════════════════════════════╝
     *
     * Le porteur, capture à l'appui : « Ça doit être le même composant du display
     * qui est affiché en preview, un peu comme WhatsApp. Et non écrire le texte
     * sur la story comme tu as fait. »
     *
     * Une première version peignait le fond et RECOLLAIT le corps en bas, dans la
     * typographie de la carte. On vérifie donc les deux moitiés de la correction :
     *
     *   · la story est rendue À SA TAILLE puis réduite — 430 px de large, celle
     *     de `data-story-carte` dans A13 — ce qui garde ses proportions et ses
     *     retours à la ligne ;
     *   · le bas de la carte porte le NOM DE L'AUTEUR, et non le corps.
     */
    const mini = carte.locator('[data-apercu-story]');
    await expect(mini, 'la carte ne rend pas la story en miniature').toBeAttached();
    const composition = await mini.evaluate((n) => {
      const dedans = n.querySelector<HTMLElement>(':scope > div');
      if (dedans === null) return null;
      const s = getComputedStyle(dedans);
      return { l: dedans.offsetWidth, h: dedans.offsetHeight, transform: s.transform };
    });
    expect(composition?.l, 'la story n’est pas rendue à sa taille').toBe(430);
    expect(composition?.h).toBe(800);
    expect(composition?.transform, 'la miniature n’est pas une réduction').toContain('matrix');
    expect(
      (await mini.innerText()).replace(/\s+/g, ' '),
      'la miniature ne porte pas le texte de la story',
    ).toContain('Le dossier Visale se monte en ligne');

    const auteur = carte.locator('[data-story-auteur]');
    await expect(auteur, 'le bas de la carte ne nomme pas l’auteur').toBeAttached();
    expect((await auteur.innerText()).trim(), 'le bas doit porter le nom, pas le corps').toBe(
      'Awa Konaté',
    );

    // ── ET ELLE OUVRE SA STORY ───────────────────────────────────────────
    const vers = await carte.getAttribute('href');
    await carte.click();
    await expect(page).toHaveURL(new RegExp(`${vers ?? ''}$`), { timeout: 20_000 });

    expect(infos.errors).toEqual([]);
  });
});
