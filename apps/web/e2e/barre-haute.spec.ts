import { expect, test, type Page } from '@playwright/test';
import { connecter } from './session';
import { monterEnL1 } from './niveau';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA BARRE HAUTE — ELLE ÉTAIT ENTIÈREMENT DESSINÉE                          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Corrige la top bar qui n'est pas du tout dynamique en termes de
 * données, de liens et autres, donc simplement non fonctionnelle. »
 *
 * MESURÉ avant : la barre ne contenait QU'UN SEUL nœud nommé — le mot
 * « Diaspora ». Le champ de recherche était un `<div>` portant son texte en dur,
 * le `+` et les deux icônes des `<span>` sans rôle ni geste, et la pastille
 * orange d'alerte était peinte en permanence.
 */
const cadre = (page: Page) => page.locator('[data-frame]').filter({ visible: true }).first();

test.describe('la barre haute', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'la barre d’ordinateur');

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LE LOGO EST ENCORE LÀ — ET CE CAS EXISTE PARCE QU'IL NE L'ÉTAIT PLUS    ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * La première version de la transformation cherchait la boîte de recherche par
   * un motif qui pouvait RECULER jusqu'au logo : `<div (style)>(<svg…>.*?</svg>)
   * Rechercher`. Le `<div` de tête n'était borné par rien, et la capture allait du
   * LOGO jusqu'au texte de la recherche. Les deux étaient remplacés par un seul
   * nœud, qui héritait du style du logo — 38 × 38 px au lieu de 420 × 44.
   *
   * CE QUE ÇA DONNAIT : la barre s'écrasait, et avec elle toute la mise en page.
   * Sur cinquante-trois planches. C'est le porteur qui l'a vu, capture à l'appui.
   *
   * Un cas qui ne regarderait que les contrôles serait resté VERT : ils étaient
   * tous là, bien promus. Il faut donc regarder aussi ce qui N'A PAS bougé.
   */
  test('le logo et la recherche coexistent, chacun à sa taille', async ({ page, request }) => {
    await connecter(page.context(), request, { displayName: 'Awa Konate' });
    await page.setViewportSize({ width: 1700, height: 1000 });
    await page.goto('/accueil');

    const barre = cadre(page);
    await expect(barre.getByText('Diaspora').first(), 'le logo a disparu').toBeVisible();

    const recherche = barre.locator('form[role="search"]');
    await expect(recherche).toHaveCount(1);
    const boite = await recherche.boundingBox();
    /**
     * LA BOÎTE DESSINÉE : `flex: 1` borné à 420 px, haute de 44. On vérifie la
     * HAUTEUR au pixel — c'est elle qui trahit l'échange avec le logo (38 px) —
     * et on borne la largeur sans la figer : elle dépend de la place restante.
     */
    expect(boite?.height).toBe(44);
    expect(boite?.width ?? 0).toBeGreaterThan(200);
  });

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LA BARRE DISAIT « AMINA » À TOUT LE MONDE                               ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « La top bar montre toujours Amina, qui n'est pas le nom de
   * l'utilisateur actif. »
   *
   * MESURÉ : la planche écrit `AD` et `Amina` EN DUR sur vingt-six cadres, et la
   * carte du rail « AD / Amina Diallo / Voir mon profil public » sur treize — ce
   * dernier lien en `href="#"`, donc mort. La maquette de l'accueil ne prévoit
   * aucune prise pour le membre, là où les autres en ont une : les vingt-six
   * cadres affichaient donc l'exemple de la maquette.
   *
   * Ce cas vérifie LES DEUX MOITIÉS : ce qui s'affiche est le membre connecté, et
   * le nom de la maquette n'est plus nulle part sur la page.
   */
  test('la barre et le rail portent le membre connecté, pas celui de la maquette', async ({
    page,
    request,
  }) => {
    await connecter(page.context(), request, { displayName: 'Awa Konate' });
    await page.goto('/accueil');

    const barre = cadre(page);
    const pastille = barre.locator('[data-barre-membre]');
    await expect(pastille).toHaveCount(1);
    await expect.poll(async () => pastille.innerText(), { timeout: 10_000 }).toContain('Awa');
    // Elle MÈNE quelque part : la maquette en fait un `<div>` qui ne fait rien.
    await expect(pastille).toHaveAttribute('href', '/compte/profil');

    // La carte du rail dit le nom ENTIER, et son lien mène au profil public.
    const carte = barre.locator('[data-carte-membre]');
    await expect(carte).toHaveCount(1);
    await expect(barre.getByText('Awa Konate')).not.toHaveCount(0);

    /**
     * ╔══════════════════════════════════════════════════════════════════════╗
     * ║ ET « AMINA » A DISPARU DES DEUX NŒUDS QUI L'ÉCRIVAIENT               ║
     * ╚══════════════════════════════════════════════════════════════════════╝
     *
     * C'est la moitié qui compte : un cas qui ne vérifierait que la présence du
     * bon nom resterait vert si l'exemple de la maquette s'affichait juste à côté
     * — ce qui était exactement le défaut.
     *
     * ── MAIS LA SONDE ÉTAIT FAUSSE, ET C'ÉTAIT LA MIENNE ──────────────────
     *
     * Première version : `barre.innerText()` sur TOUT le cadre, et
     * `not.toContain('Amina')`. Elle a rougi, et le produit n'avait rien. MESURÉ en
     * base : « Amina Diallo » est un MEMBRE RÉEL du jeu de démonstration — cinq
     * comptes portent ce nom — et le fil d'actualité affichait ses publications.
     * La sonde ne pouvait pas distinguer le nom CODÉ EN DUR dans la pastille d'un
     * auteur légitimement nommé ainsi trois cents pixels plus bas.
     *
     * Elle est donc posée sur LES DEUX NŒUDS qui portaient le nom en dur, et sur
     * eux seuls. C'est plus étroit, et c'est plus juste : le défaut était là, pas
     * « quelque part sur la page ». Le jour où la pastille remontrera l'exemple,
     * ce cas rougira ; le jour où Amina Diallo publiera, il ne rougira plus.
     */
    expect(await pastille.innerText(), 'la pastille montre encore le nom de la maquette').not.toContain(
      'Amina',
    );
    const rail = barre.locator('[data-carte-membre]').locator('xpath=..');
    expect(await rail.innerText(), 'la carte du rail montre encore le nom de la maquette').not.toContain(
      'Amina',
    );
  });

  /** Les quatre contrôles, et ce qu'ils font. */
  test('la recherche mène à /recherche, les deux icônes à leur écran', async ({ page, request }) => {
    await connecter(page.context(), request, { displayName: 'Awa Konate' });
    await page.goto('/accueil');
    const barre = cadre(page);

    const liens = await barre.locator('[data-barre-lien]').evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-barre-lien')),
    );
    expect(liens, 'les icônes de la barre ne mènent nulle part').toEqual(
      expect.arrayContaining(['/messages', '/notifications']),
    );

    /**
     * ╔══════════════════════════════════════════════════════════════════════╗
     * ║ `combobox` ET NON `searchbox` — LE CHAMP A CHANGÉ DE NATURE          ║
     * ╚══════════════════════════════════════════════════════════════════════╝
     *
     * Ce cas disait `searchbox`, et il a rougi le jour où le champ s'est mis à
     * proposer pendant la frappe. CE N'EST PAS UNE SONDE À RECALER AU PLUS VITE :
     * le rôle a changé parce que le contrôle a changé.
     *
     * Un champ qui déplie une liste de propositions est un COMBOBOX au sens ARIA
     * 1.2 — `aria-expanded`, `aria-controls` vers le `listbox`, `aria-autocomplete`
     * — et c'est ce motif que les lecteurs d'écran annoncent et savent parcourir.
     * Le garder en `searchbox` aurait laissé un panneau de propositions dont rien
     * n'annonçait l'existence.
     *
     * LA TOUCHE ENTRÉE MÈNE TOUJOURS À LA PAGE DE RÉSULTATS, et c'est ce que ce cas
     * garde : le formulaire reste un `<form method="get">`, donc la recherche
     * fonctionne même sans JavaScript et même si les propositions n'arrivent pas.
     * Les propositions sont éprouvées à part, dans `recherche.spec.ts`.
     */
    const champ = barre.getByRole('combobox', { name: /Rechercher/ });
    await champ.fill('lyon');
    await champ.press('Enter');
    await expect.poll(() => page.url(), { timeout: 10_000 }).toContain('/recherche?q=lyon');
  });

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LA PASTILLE NE S'ALLUME QUE S'IL Y A DU NON-LU                          ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * La maquette la peint EN DUR. Elle annonçait donc des messages non lus à un
   * compte neuf qui n'en a jamais reçu — le même défaut que « 890 membres » sur
   * l'en-tête de réseau : un exemple de maquette pris pour une donnée.
   */
  test('un compte neuf n’a aucune pastille, et le nombre part dans le nom du lien', async ({
    page,
    request,
  }) => {
    await connecter(page.context(), request, { displayName: 'Awa Konate' });
    await page.goto('/accueil');
    const barre = cadre(page);

    // On attend que les compteurs soient revenus : avant, il n'y a rien à dire.
    await expect(barre.locator('[data-barre-lien="/messages"]')).toHaveCount(1);
    await page.waitForTimeout(1_500);
    await expect(barre.locator('[data-barre-pastille]')).toHaveCount(0);
    // Et le nom du lien ne promet aucun non-lu.
    await expect(barre.locator('[data-barre-lien="/messages"]')).toHaveAttribute(
      'aria-label',
      'Messages',
    );
  });

  /**
   * LE « + » ET SES RACCOURCIS. « Le bouton + doit afficher un modal permettant
   * d'envoyer vers la page pour créer une story, une actualité, un guide, une
   * demande d'aide, un service, un événement, envoyer un message. »
   */
  test('le « + » ouvre les raccourcis, et chacun mène à son écran', async ({ page, request }) => {
    await connecter(page.context(), request, { displayName: 'Awa Konate' });
    await page.goto('/accueil');

    const bouton = cadre(page).locator('[data-barre-creer]');
    await expect(bouton, 'le « + » n’est pas un bouton').toHaveCount(1);
    await expect(bouton).toHaveAttribute('aria-haspopup', 'dialog');
    await bouton.click();

    const fenetre = page.locator('[data-modal="RACCOURCIS"]');
    await expect(fenetre).toHaveCount(1);
    const vers = await fenetre.locator('[data-raccourci]').evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-raccourci')),
    );
    expect(vers).toEqual([
      '/stories/nouvelle',
      '/publications/nouvelle',
      '/guides/nouveau',
      '/entraide/nouvelle',
      '/services/nouveau',
      '/agenda/nouveau',
    ]);

    /**
     * SANS CONTACT, LA FENÊTRE LE DIT. Elle restait sur « Chargement de vos
     * contacts… » indéfiniment : elle décidait de redemander sur la LONGUEUR de la
     * liste, et une liste vide est une réponse, pas une absence de réponse.
     */
    await expect(fenetre.getByText(/Vous n’avez pas encore de contact/)).toBeVisible({
      timeout: 10_000,
    });
  });

  /** Avec un contact, « Discuter » mène à la conversation avec cette personne. */
  test('un contact apparaît, avec son bouton « Discuter »', async ({ page, request }) => {
    const hote = await connecter(page.context(), request, { displayName: 'Kofi Boni' });
    const jetonHote = (await monterEnL1(page.context(), request, hote.accessToken)).accessToken;
    const moi = (await (
      await request.get(`${API}/me`, { headers: { authorization: `Bearer ${jetonHote}` } })
    ).json()) as { user: { handle: string } };

    const lecteur = await connecter(page.context(), request, { displayName: 'Awa Konate' });
    const jeton = (await monterEnL1(page.context(), request, lecteur.accessToken)).accessToken;
    const demande = await request.post(`${API}/connection-requests`, {
      headers: { authorization: `Bearer ${jeton}` },
      data: {
        toHandle: moi.user.handle,
        message: 'Bonjour, je viens d’arriver et j’aimerais échanger avec vous.',
      },
    });
    expect(demande.status()).toBe(201);
    const { id } = (await demande.json()) as { id: string };
    const acceptation = await request.post(`${API}/connection-requests/${id}/accept`, {
      headers: { authorization: `Bearer ${jetonHote}` },
    });
    expect(acceptation.ok(), 'la mise en relation a échoué').toBe(true);

    await page.goto('/accueil');
    await cadre(page).locator('[data-barre-creer]').click();
    const discuter = page.locator('[data-modal="RACCOURCIS"] [data-discuter]');
    await expect(discuter).toHaveCount(1, { timeout: 10_000 });
    await expect(discuter).toHaveAttribute('href', `/messages?avec=${moi.user.handle}`);
  });
});
