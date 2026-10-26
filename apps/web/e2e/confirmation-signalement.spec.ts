import { expect, test } from '@playwright/test';
import { connecter } from './session';
import { monterEnL1, monterEnL2 } from './niveau';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES CONFIRMATIONS SONT DES FENÊTRES, ET LES COMMENTAIRES SE SIGNALENT     ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Pour les confirmations inspire-toi du design pour créer un modal
 * bien fait » — `window.confirm` servait à supprimer une publication et à bloquer
 * un membre. Et : « sur les publications le signalement des commentaires ne
 * marche pas non plus » — `<a href="#">Signaler</a>`, un lien mort sous chaque
 * commentaire.
 *
 * Le châssis de la fenêtre vient de K08 · suppression de compte, la seule
 * confirmation que les maquettes dessinent ; la feuille de signalement est X03,
 * celle de `09 Messages et TRANSVERSE`.
 */
test.describe('confirmer et signaler, sur le fil', () => {
  test('supprimer une publication passe par une fenêtre dessinée', async ({
    page,
    request,
  }, infos) => {
    const ouvert = await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    const moi = await monterEnL1(page.context(), request, ouvert.accessToken);
    const entete = { authorization: `Bearer ${moi.accessToken}` };

    const marque = `E2E-SUPPR-${Date.now().toString(36)}`;
    const cree = await request.post(`${API}/posts`, {
      headers: entete,
      data: { type: 'QUESTION', body: `Une question à supprimer ${marque}` },
    });
    expect(cree.status(), 'la publication n’a pas été créée').toBe(201);

    await page.goto('/accueil');
    await expect(page.getByText(marque).filter({ visible: true }).first()).toBeVisible({
      timeout: 25_000,
    });

    /** Le menu « ··· » n'existe que sur SA publication — `isAuthor` vient du serveur. */
    await page
      .getByRole('button', { name: 'Options de la publication' })
      .filter({ visible: true })
      .first()
      .click();
    await page.getByRole('button', { name: 'Supprimer' }).filter({ visible: true }).first().click();

    const fenetre = page.locator('[data-fenetre-confirmation]').filter({ visible: true }).first();
    await expect(fenetre, 'la suppression ne passe plus par une fenêtre dessinée').toBeVisible({
      timeout: 15_000,
    });

    /**
     * LE CHÂSSIS EST CELUI DE K08, et on le mesure : 440 px de large, rayon 28.
     * Sans ces deux-là, n'importe quelle boîte passerait pour la fenêtre demandée.
     */
    const boite = await fenetre.evaluate((n) => {
      const s = getComputedStyle(n);
      return { l: Math.round(n.getBoundingClientRect().width), rayon: s.borderRadius };
    });
    if ((page.viewportSize()?.width ?? 0) >= 1024) expect(boite.l).toBe(440);
    expect(boite.rayon).toBe('28px');

    /** ANNULER NE SUPPRIME RIEN — c'est la moitié qui compte d'une confirmation. */
    await fenetre.locator('[data-confirmation-annuler]').click();
    await expect(fenetre).toBeHidden({ timeout: 10_000 });
    await expect(page.getByText(marque).filter({ visible: true }).first()).toBeVisible();

    await page
      .getByRole('button', { name: 'Options de la publication' })
      .filter({ visible: true })
      .first()
      .click();
    await page.getByRole('button', { name: 'Supprimer' }).filter({ visible: true }).first().click();
    await page
      .locator('[data-fenetre-confirmation]')
      .filter({ visible: true })
      .first()
      .locator('[data-confirmation-confirmer]')
      .click();

    /**
     * `.filter({ visible: true })` : les DEUX planches sont montées en même temps
     * — `ScreenFrames` les rend toutes les deux et n'en montre qu'une — donc un
     * compte nu en trouve deux pour une seule publication à l'écran.
     */
    await expect(page.getByText(marque).filter({ visible: true })).toHaveCount(0, {
      timeout: 25_000,
    });
    expect(infos.errors).toEqual([]);
  });

  test('le « Signaler » d’un commentaire ouvre la feuille et l’envoi part', async ({
    page,
    browser,
    request,
  }, infos) => {
    const ouvert = await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    /**
     * MISE À JOUR (lot w5b) : signaler demande le niveau N2 (`report.create`, voir
     * `packages/shared/src/capabilities`). Le lecteur qui signale monte donc en N2 ;
     * à N1 le produit répond, à raison, par la fenêtre « Niveau N2 requis ».
     */
    const moi = await monterEnL2(page.context(), request, ouvert.accessToken);
    const entete = { authorization: `Bearer ${moi.accessToken}` };

    const marque = `E2E-SIGN-${Date.now().toString(36)}`;
    const cree = await request.post(`${API}/posts`, {
      headers: entete,
      data: { type: 'QUESTION', body: `Une question commentée ${marque}` },
    });
    const { post } = (await cree.json()) as { post: { id: string } };

    /** Un AUTRE membre commente : on ne signale pas son propre commentaire. */
    const ctx = await browser.newContext();
    const autre = await connecter(ctx, request, { displayName: 'Fatim Sow' });
    const lui = await monterEnL1(ctx, request, autre.accessToken);
    await ctx.close();
    /**
     * `POST /comments` AVEC LE SUJET DANS LE CORPS, et non `/posts/:id/comments` :
     * la table des commentaires est POLYMORPHE (§2.5) — elle sert aussi aux
     * sujets, aux guides et aux événements — donc la route est unique et le genre
     * voyage avec l'identifiant.
     */
    const commente = await request.post(`${API}/comments`, {
      headers: { authorization: `Bearer ${lui.accessToken}` },
      data: {
        subjectType: 'POST',
        subjectId: post.id,
        /**
         * UN TEXTE ANODIN, ET C'EST OBLIGÉ. Le premier essai écrivait
         * « Envoyez-moi 150 € et je règle votre dossier » — le filtre de
         * modération l'a refusé avec `CONTENT_BLOCKED`, et il a eu raison : c'est
         * une demande d'argent, une règle dure du produit. Ce cas mesure le
         * SIGNALEMENT, pas la modération à l'écriture ; il lui faut donc un
         * commentaire que le serveur accepte.
         */
        body: 'Je ne suis pas certain que ce conseil soit exact.',
      },
    });
    expect(commente.status(), 'le commentaire n’a pas été créé').toBe(201);

    /**
     * LA FENÊTRE S'OUVRE PAR LE BOUTON « COMMENTER » DE LA CARTE, et non par une
     * URL : le fil porte vingt publications et `data-modal-subject` dit laquelle
     * — il n'y a pas de paramètre d'adresse pour cette fenêtre.
     */
    await page.goto('/accueil');
    const carte = page.locator(`[data-modal-subject="${post.id}"]`).filter({ visible: true });
    await expect(carte.first(), 'la publication n’apparaît pas dans le fil').toBeVisible({
      timeout: 25_000,
    });
    await carte.first().click();

    const signaler = page
      .locator('[data-commentaire-signaler]')
      .filter({ visible: true })
      .first();
    await expect(signaler, 'le « Signaler » d’un commentaire n’est pas un contrôle').toBeVisible({
      timeout: 25_000,
    });
    /** Il était `<a href="#">` : un lien mort que le garde-fou de navigation comptait. */
    expect(await signaler.evaluate((n) => n.tagName)).toBe('BUTTON');
    await signaler.click();

    const feuille = page.getByRole('dialog', { name: 'Signaler' });
    await expect(feuille, 'la feuille de signalement ne s’ouvre pas').toBeVisible({
      timeout: 20_000,
    });

    await feuille.locator('[data-signalement-motif="MONEY_REQUEST"]').click();
    await feuille.locator('[data-signalement-details]').fill('Il demande 150 €.');
    await feuille.locator('[data-signalement-envoyer]').click();

    /** La maquette dessine une confirmation : X03M, la carte « Merci ». */
    await expect(
      page.getByRole('dialog', { name: 'Merci.' }),
      'l’envoi ne mène pas à la confirmation',
    ).toBeVisible({ timeout: 25_000 });

    expect(infos.errors).toEqual([]);
  });
});
