import { expect, test } from '@playwright/test';
import { connecter } from './session';
import { monterEnL1 } from './niveau';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ ÉCRIRE DANS UNE CONVERSATION — LES TROIS CONTRÔLES ÉTAIENT DESSINÉS        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « L'envoi de message aussi ne marche pas ainsi que les images dans
 * une conversation. Ajoute aussi les emojis » — et, sur la vignette de story :
 * « Il faut qu'on puisse cliquer sur ça et aller vers la story si toujours en
 * ligne. Sinon ça affirme que la story a expiré. »
 *
 * MESURÉ AVANT, dans le cadre produit : la barre basse était faite d'un `<span>`,
 * d'un `<div>` portant le texte dessiné « Écrire un message… » et d'un `<span>`
 * vert. Aucun des trois n'était un contrôle. Et la vignette d'image était peinte
 * sur 140 px de haut et ZÉRO de large — l'image arrivait, personne ne la voyait.
 *
 * ── CE QUE CE CAS TRAVERSE ────────────────────────────────────────────────
 *
 * Le geste entier, dans un vrai navigateur, SUR LES DEUX PLANCHES : un auteur
 * publie une story, un second membre lui écrit depuis l'écran de lecture, puis
 * l'auteur répond — avec un émoji, puis avec une image — et clique sur la
 * vignette pour revenir à la story.
 *
 * Par géométrie et par rôle, jamais par une classe : la maquette n'en a aucune.
 */
test.describe('écrire dans une conversation', () => {
  test('la barre d’envoi est vivante : texte, émoji, image, et la vignette mène à la story', async ({
    page,
    browser,
    request,
  }, infos) => {
    const telephone = (page.viewportSize()?.width ?? 0) < 1024;

    const ouvert = await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    const auteur = await monterEnL1(page.context(), request, ouvert.accessToken);
    const enteteAuteur = { authorization: `Bearer ${auteur.accessToken}` };

    const publiee = await request.post(`${API}/stories`, {
      headers: enteteAuteur,
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

    /**
     * UN SECOND CONTEXTE : `canMessage` vaut FAUX sur sa propre story
     * (`allowMessages && !isAuthor`), donc l'auteur ne peut pas s'écrire.
     *
     * SA PLANCHE SUIT CELLE DU CAS : la barre d'écriture de A13 n'existait que
     * sur l'ordinateur — le motif du transcodeur était figé à `height: "48px"`,
     * la valeur de la planche large, et celle du téléphone en dessine 46. Deux
     * pixels, et le champ restait un `<span>` inerte sur mobile.
     */
    const contexte = await browser.newContext({
      viewport: telephone ? { width: 390, height: 844 } : { width: 1700, height: 1000 },
    });
    const lecteurOuvert = await connecter(contexte, request, { displayName: 'Fatim Sow' });
    await monterEnL1(contexte, request, lecteurOuvert.accessToken);
    const pageLecteur = await contexte.newPage();
    await pageLecteur.goto(`/stories/${story.id}`);

    const champStory = pageLecteur
      .locator('[data-screen="A13"] input')
      .filter({ visible: true })
      .first();
    await expect(champStory, 'la barre d’écriture de la story est inerte').toBeVisible({
      timeout: 20_000,
    });
    await champStory.fill('Merci, votre conseil m’a débloquée.');
    await champStory.press('Enter');
    await expect(pageLecteur.getByText(/Demande envoyée|Message envoyé/)).toBeVisible({
      timeout: 25_000,
    });
    await contexte.close();

    const convs = await request.get(`${API}/conversations`, { headers: enteteAuteur });
    const { items } = (await convs.json()) as { items: { id: string }[] };
    const id = items[0]?.id;
    expect(id, 'l’auteur n’a aucune conversation').toBeDefined();

    /**
     * ── ON ENTRE PAR `/messages`, COMME LE PORTEUR ───────────────────────
     *
     * Le porteur : « Ouvrir une conversation n'est pas possible hein ? » — et il
     * avait raison. Les lignes de la liste étaient des `<div>` : cliquer ne
     * changeait pas l'URL (relevé : « URL après clic = /messages »). Le volet de
     * droite montrait la conversation de repli, et le composeur s'y bloquait
     * puisque l'URL ne nommait aucune conversation.
     *
     * Ce cas entre donc par la LISTE et ouvre par un clic, au lieu d'aller
     * directement à `/messages/<id>` — qui marchait déjà et masquait le défaut.
     */
    await page.goto('/messages');
    const ligne = page.locator('[data-conversation-ligne]').filter({ visible: true }).first();
    await expect(ligne, 'les lignes de la liste n’ouvrent aucune conversation').toBeVisible({
      timeout: 20_000,
    });
    await ligne.click();
    await expect(page, 'le clic sur une conversation ne change pas l’URL').toHaveURL(
      /\/messages\/[0-9a-f-]{36}/,
      { timeout: 20_000 },
    );

    const champ = page.locator('[data-conversation-champ]').filter({ visible: true }).first();
    await expect(champ, 'le composeur de conversation est inerte').toBeVisible({ timeout: 20_000 });

    // ── 1. LA VIGNETTE A UNE LARGEUR, ET C'EST UN BOUTON ─────────────────
    const vignette = page.locator('[data-message-image]').filter({ visible: true }).first();
    await expect(vignette).toBeVisible({ timeout: 15_000 });
    const boite = await vignette.evaluate((n) => {
      const r = n.getBoundingClientRect();
      return { l: Math.round(r.width), h: Math.round(r.height), balise: n.tagName };
    });
    /**
     * LA LARGEUR EST LE CŒUR DU CAS. `max-width` BORNE une largeur, il n'en donne
     * aucune : une image de fond n'a pas de taille propre, et dans une colonne
     * `flex` la boîte se calculait donc à zéro.
     */
    expect(boite.l, 'la vignette n’a aucune largeur').toBeGreaterThan(100);
    expect(boite.h).toBe(140);
    expect(boite.balise, 'la vignette d’une story doit être cliquable').toBe('BUTTON');

    /**
     * ── LA FORME DE MESSENGER : L'IMAGE EN HAUT, LA BULLE QUI MORD DESSUS ──
     *
     * Le porteur : « L'image doit être en haut du message et le message va monter
     * un peu sur lui. C'est le format de messenger de Facebook il faut suivre. »
     *
     * La maquette dessine l'inverse — le texte, puis l'image. On vérifie donc les
     * DEUX moitiés de la correction : que la vignette commence AVANT la bulle, et
     * que la bulle remonte réellement sur elle. Sans la seconde, un simple
     * réordonnancement passerait pour le format demandé.
     */
    const bulle = page.getByText('Merci, votre conseil').filter({ visible: true }).first();
    const [hautVignette, basVignette] = await vignette.evaluate((n) => {
      const r = n.getBoundingClientRect();
      return [r.top, r.bottom];
    });
    const hautBulle = await bulle.evaluate((n) => n.getBoundingClientRect().top);
    expect(hautVignette, 'la vignette doit être AU-DESSUS de la bulle').toBeLessThan(hautBulle);
    expect(hautBulle, 'la bulle doit MORDRE sur la vignette').toBeLessThan(basVignette);

    // ── 2. L'ÉMOJI S'INSÈRE AU CURSEUR ───────────────────────────────────
    await champ.fill('Avec plaisir');
    await page.locator('[data-bouton-emojis]').filter({ visible: true }).first().click();
    /**
     * `.filter({ visible: true })` : LES DEUX PLANCHES SONT MONTÉES en même temps
     * — `ScreenFrames` les rend toutes les deux et n'en montre qu'une — donc un
     * locator nu en trouve DEUX et Playwright refuse en mode strict. Le clavier
     * est désormais une section du cadre, pas un panneau flottant posé une seule
     * fois par un composant.
     */
    const clavier = page.locator('[data-panneau-emojis]').filter({ visible: true }).first();
    await expect(clavier).toBeVisible({ timeout: 25_000 });
    /**
     * `emoji-picker-react` CHARGE SA GRILLE EN DIFFÉRÉ (`lazyLoadEmojis`), et le
     * composant lui-même arrive par `dynamic(…, { ssr: false })`. On attend donc
     * le bouton, au lieu de le cliquer dès que la section apparaît.
     */
    /**
     * ── LA PREMIÈRE CELLULE, ET NON UN ÉMOJI CHOISI ──────────────────────
     *
     * `emoji-picker-react` marque ses cellules d'un `data-unified` — le point de
     * code Unicode — et les nomme EN ANGLAIS. Deux pièges, tous deux mesurés :
     * désigner par le caractère (`name: /👍/`) ne trouve rien, car le nom
     * accessible est « thumbs up » ; et désigner par un point de code précis
     * échoue aussi, parce que `lazyLoadEmojis` ne rend que ce qui est à l'écran
     * — le pouce est plusieurs catégories plus bas.
     *
     * On prend donc la PREMIÈRE cellule rendue et on lit ce qu'elle porte. Ce que
     * ce cas doit tenir n'est pas « le pouce s'insère » mais « un émoji choisi
     * dans le clavier arrive AU CURSEUR du champ », et c'est vrai quel qu'il
     * soit.
     */
    const cellule = clavier.locator('button[data-unified]').first();
    await expect(cellule).toBeVisible({ timeout: 25_000 });
    const choisi = (await cellule.innerText()).trim();
    expect(choisi, 'la cellule du clavier ne porte aucun caractère').not.toBe('');
    await cellule.click();
    await expect(champ).toHaveValue(`Avec plaisir${choisi}`, { timeout: 10_000 });

    // ── 3. L'ENVOI PART, ET LE CHAMP SE VIDE ─────────────────────────────
    await page.locator('[data-conversation-envoyer]').filter({ visible: true }).first().click();
    await expect(champ).toHaveValue('', { timeout: 20_000 });
    /**
     * `.filter({ visible: true }).first()` : LES DEUX PLANCHES SONT MONTÉES en
     * même temps — `ScreenFrames` les rend toutes les deux et n'en montre qu'une.
     * Un `getByText` nu en trouve donc trois, et Playwright refuse en mode strict.
     */
    await expect(
      page.getByText(`Avec plaisir${choisi}`).filter({ visible: true }).first(),
    ).toBeVisible({ timeout: 20_000 });

    /**
     * ET LE SERVEUR L'A, avec le lien vers la story sur le message qui en vient.
     * Sans cette vérification, un affichage optimiste passerait pour un envoi.
     */
    const apres = await request.get(`${API}/conversations/${id ?? ''}/messages`, {
      headers: enteteAuteur,
    });
    const corps = (await apres.json()) as {
      items: { body: string | null; storyId: string | null; storyAlive: boolean }[];
    };
    expect(corps.items.some((m) => (m.body ?? '').includes(`Avec plaisir${choisi}`))).toBe(true);
    const venuDeLaStory = corps.items.find((m) => m.storyId !== null);
    expect(venuDeLaStory, 'le message parti d’une story ne la référence pas').toBeDefined();
    expect(venuDeLaStory?.storyId).toBe(story.id);
    expect(venuDeLaStory?.storyAlive, 'une story de ce jour doit être vivante').toBe(true);

    // ── 4. UNE IMAGE PART AVEC LE MOT ────────────────────────────────────
    //
    // LA VIGNETTE EST DANS L'INPUT, et non plus dans un bandeau flottant : le
    // porteur l'a demandé — « tu le mets dans l'input comme on a fait avec
    // l'input de publication de la file d'actualité ». Le bandeau
    // `data-conversation-image-attente` n'existe plus, et ce cas suit la
    // correction au lieu de se mettre au rouge dessus.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
      'base64',
    );
    await page.setInputFiles('[data-conversation-fichier]', {
      name: 'preuve.png',
      mimeType: 'image/png',
      buffer: png,
    });
    const retirer = page.locator('[data-conversation-retirer-image]').filter({ visible: true });
    await expect(retirer, 'l’image déposée n’apparaît pas dans le champ').toHaveCount(1, {
      timeout: 25_000,
    });
    await champ.fill('Voici');
    await page.locator('[data-conversation-envoyer]').filter({ visible: true }).first().click();
    await expect(retirer).toHaveCount(0, { timeout: 25_000 });

    const avecImage = await request.get(`${API}/conversations/${id ?? ''}/messages`, {
      headers: enteteAuteur,
    });
    const liste = (await avecImage.json()) as {
      items: { body: string | null; mediaUrl: string | null }[];
    };
    const porteuse = liste.items.find((m) => (m.body ?? '') === 'Voici');
    expect(porteuse, 'le message avec image n’est pas arrivé').toBeDefined();
    expect(porteuse?.mediaUrl, 'l’image n’a pas été jointe').toMatch(/^\/media\/message\//);

    // ── 5. LA VIGNETTE MÈNE À LA STORY ───────────────────────────────────
    /**
     * PAR SON NOM ACCESSIBLE, et non par la position : le fil porte maintenant
     * DEUX vignettes — la capture de la story et le PNG qu'on vient d'envoyer.
     * La seconde n'est pas une story, donc elle n'est pas un bouton et cliquer
     * dessus ne mène nulle part. C'est exactement ce que la règle doit produire,
     * et ce cas le vérifie en ne visant que celle qui promet une destination.
     */
    await page
      .getByRole('button', { name: 'Voir la story' })
      .filter({ visible: true })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`/stories/${story.id}`), { timeout: 20_000 });

    expect(infos.errors).toEqual([]);
  });

  /**
   * ── ET LE COMPOSEUR VIT AUSSI SUR `/messages`, QUI NE NOMME RIEN ──────────
   *
   * Le cadre d'ordinateur de `/messages` montre les DEUX volets : la liste et une
   * conversation — celle de repli que le chargeur choisit. L'URL, elle, ne porte
   * aucun identifiant. Le composeur se fiait à ce paramètre, donc à `null`, donc
   * il se grisait entièrement : c'est ce que le porteur voyait en arrivant sur la
   * messagerie, et il l'a décrit quatre fois.
   */
  test('sur /messages, qui ne nomme aucune conversation, le composeur reste utilisable', async ({
    page,
    request,
  }) => {
    test.skip(
      (page.viewportSize()?.width ?? 0) < 1024,
      'la planche de téléphone sépare la liste et la conversation en deux pages',
    );

    const ouvert = await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    const moi = await monterEnL1(page.context(), request, ouvert.accessToken);
    const autre = await connecter(await page.context().browser()!.newContext(), request, {
      displayName: 'Fatim Sow',
    });
    const depart = await request.post(`${API}/conversations/direct`, {
      headers: { authorization: `Bearer ${moi.accessToken}` },
      data: { toHandle: autre.handle, firstMessage: 'Bonjour, une question sur le logement.' },
    });
    expect(depart.status()).toBe(201);

    await page.goto('/messages');
    const champ = page.locator('[data-conversation-champ]').filter({ visible: true }).first();
    await expect(champ).toBeVisible({ timeout: 20_000 });
    await expect(champ, 'le composeur est grisé alors qu’une conversation est ouverte').toBeEnabled(
      { timeout: 20_000 },
    );
    await champ.fill('Je relance.');
    await page.locator('[data-conversation-envoyer]').filter({ visible: true }).first().click();
    await expect(champ).toHaveValue('', { timeout: 20_000 });
  });
});
