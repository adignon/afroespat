import { expect, test } from '@playwright/test';
import { connecter } from './session';
import { monterEnL1 } from './niveau';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ ÉCRIRE À L'AUTEUR D'UNE STORY — LA STORY PART AVEC LE MESSAGE              ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « quand on envoie un message dans le contexte d'une story, il
 * faudrait que la story soit capturée comme une image et ajoutée au message juste
 * un peu sous le message ».
 *
 * MESURÉ avant : le message partait NU. Le destinataire lisait « votre conseil
 * m'a beaucoup aidée » sans savoir de quelle story on parlait — et une story vit
 * vingt-quatre heures, donc le lendemain la question est sans réponse possible,
 * même pour son auteur.
 *
 * ── CE QUE CE CAS TRAVERSE, DE BOUT EN BOUT ───────────────────────────────
 *
 * Il ne regarde pas un composant : il fait le geste entier, dans un vrai
 * navigateur, et vérifie ce qui arrive dans la MESSAGERIE DE L'AUTEUR.
 *
 *   1. un auteur publie une story qui accepte les messages ;
 *   2. un second membre l'ouvre, écrit, envoie ;
 *   3. le canvas peint la story, le PNG est déposé en média `MESSAGE`, et
 *      `POST /conversations/direct` l'emporte AVEC le premier message ;
 *   4. l'auteur ouvre sa messagerie et voit la bulle ET la vignette.
 *
 * ── POURQUOI L'ÉTAPE 4 EST INDISPENSABLE ──────────────────────────────────
 *
 * Un cas qui s'arrêterait au `201` passerait alors que rien ne s'affiche : c'est
 * exactement l'état d'avant ce lot — le module ACCEPTAIT `mediaId` depuis le
 * début, et aucune route ne résolvait le média en adresse. L'image partait en base
 * et personne ne la voyait jamais.
 */
test.describe('la story capturée, jointe au message', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'la planche de lecture d’ordinateur');

  test('le message emporte la capture, et l’auteur la voit dans son fil', async ({
    page,
    browser,
    request,
  }) => {
    // ── 1. L'AUTEUR ET SA STORY ────────────────────────────────────────────
    const ouvert = await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    /**
     * L1 EST REQUIS POUR PUBLIER ET POUR ÉCRIRE — `story.create` et `message.send`
     * le sont tous deux. `monterEnL1` rend un jeton FRAIS : l'ancien meurt au
     * changement de niveau, et s'en servir donnerait un `401` que ce cas lirait
     * comme une panne de la capture.
     */
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

    // ── 2. UN AUTRE MEMBRE LA LIT ET ÉCRIT ────────────────────────────────
    //
    // Un second contexte, parce que `canMessage` vaut FAUX sur sa propre story
    // (`allowMessages && !isAuthor`, mesuré) : l'auteur ne peut pas s'écrire.
    const contexte = await browser.newContext();
    const lecteurOuvert = await connecter(contexte, request, { displayName: 'Fatim Sow' });
    await monterEnL1(contexte, request, lecteurOuvert.accessToken);
    const pageLecteur = await contexte.newPage();
    await pageLecteur.setViewportSize({ width: 1700, height: 1000 });

    /** Ce qui part vraiment : on relève le dépôt du média et l'ouverture. */
    let mediaDepose: string | null = null;
    let mediaEnvoye: string | null = null;
    pageLecteur.on('request', (r) => {
      if (r.method() !== 'POST') return;
      if (r.url().endsWith('/media')) mediaDepose = 'demandé';
      if (r.url().endsWith('/conversations/direct')) {
        const brut = r.postData();
        if (brut !== null) {
          const corps = JSON.parse(brut) as { mediaId?: string };
          mediaEnvoye = corps.mediaId ?? null;
        }
      }
    });

    await pageLecteur.goto(`/stories/${story.id}`);
    /**
     * LE CHAMP SE DÉSIGNE PAR SON ÉCRAN ET SON RÔLE, jamais par une classe : la
     * maquette n'en a aucune. A13 ne dessine qu'un seul champ de saisie — celui du
     * message à l'auteur — et son nom accessible est le `write` du serveur.
     */
    const champ = pageLecteur
      .locator('[data-screen="A13"] input')
      .filter({ visible: true })
      .first();
    await expect(champ).toBeVisible({ timeout: 15_000 });
    await champ.fill('Merci, votre conseil m’a débloquée.');
    await champ.press('Enter');

    /**
     * LE TOAST DIT CE QUI S'EST PASSÉ. On l'attend plutôt qu'un délai fixe : la
     * capture, le dépôt et l'envoi sont trois allers-retours, et une attente en
     * dur rendrait ce cas instable sur une machine chargée.
     */
    await expect(pageLecteur.getByText(/Demande envoyée|Message envoyé/)).toBeVisible({
      timeout: 20_000,
    });

    expect(mediaDepose, 'aucune capture n’a été déposée').toBe('demandé');
    expect(mediaEnvoye, 'le message est parti SANS l’image').not.toBeNull();

    // ── 3. CE QUE L'AUTEUR REÇOIT ─────────────────────────────────────────
    const conversations = await request.get(`${API}/conversations`, { headers: enteteAuteur });
    expect(conversations.status()).toBe(200);
    const { items } = (await conversations.json()) as { items: { id: string }[] };
    const ouverte = items[0];
    expect(ouverte, 'l’auteur n’a aucune conversation').toBeDefined();

    const fil = await request.get(`${API}/conversations/${ouverte?.id ?? ''}/messages`, {
      headers: enteteAuteur,
    });
    expect(fil.status()).toBe(200);
    const messages = (await fil.json()) as {
      items: { kind: string; body: string | null; mediaId: string | null; mediaUrl: string | null }[];
    };
    const premier = messages.items.at(-1);
    expect(premier?.body).toContain('débloquée');
    /**
     * L'IMAGE EST SUR LE PREMIER MESSAGE, et `mediaUrl` est composée par le
     * serveur. Avant ce lot, `mediaUrl` n'existait pas : la vignette que la
     * maquette dessine n'avait rien à afficher.
     */
    expect(premier?.mediaId).toBe(mediaEnvoye);
    expect(premier?.mediaUrl).toMatch(/^\/media\/message\//);
    expect(premier?.kind).toBe('IMAGE');

    // ── 4. ET ELLE S'AFFICHE DANS SON FIL ─────────────────────────────────
    await page.setViewportSize({ width: 1700, height: 1000 });
    await page.goto(`/messages/${ouverte?.id ?? ''}`);
    const bulle = page.getByText('débloquée').first();
    await expect(bulle).toBeVisible({ timeout: 15_000 });

    /**
     * LA VIGNETTE EST SOUS LA BULLE, du côté de la bulle, et elle PORTE l'image.
     *
     * On la cherche par sa géométrie dessinée — 140 px de haut, 220 au plus — et
     * non par une classe : la maquette n'en a pas. `backgroundImage` commençant par
     * `url(` est ce qui distingue une vignette peinte d'un rectangle hachuré ; sans
     * cette assertion, le hachurage « ici il y a une image » passerait pour l'image.
     */
    const vignette = await page.evaluate(() => {
      /**
       * `[data-message-image]` ET PLUS `div`, et ce n'est pas un confort.
       *
       * La vignette était cherchée parmi les `<div>` de la page. Elle n'en est
       * plus un : le porteur a demandé qu'« on puisse cliquer dessus et aller vers
       * la story si toujours en ligne », donc une vignette qui PORTE une story est
       * maintenant un `<button>`. Ce cas se serait mis au rouge sur une correction
       * demandée, en disant « aucune vignette » alors qu'il y en a une.
       *
       * Le repère est posé par la même transformation que la vignette elle-même
       * (`M01_VIGNETTE`), donc les deux ne peuvent pas diverger. Par repère et
       * jamais par une classe : la maquette n'en a aucune.
       */
      const trouve = [...document.querySelectorAll<HTMLElement>('[data-message-image]')].find(
        (d) => getComputedStyle(d).backgroundImage.startsWith('url('),
      );
      if (trouve === undefined) return null;
      const s = getComputedStyle(trouve);
      const r = trouve.getBoundingClientRect();
      return {
        taille: s.backgroundSize,
        repete: s.backgroundRepeat,
        align: s.alignSelf,
        /**
         * LA LARGEUR EST MESURÉE DEPUIS CE LOT. Elle valait ZÉRO : la maquette
         * écrit `max-width` sans `width`, et une image de fond n'a pas de taille
         * propre — la boîte se calculait donc sur son contenu, c'est-à-dire rien.
         * L'image arrivait, était peinte, et restait invisible.
         */
        largeur: Math.round(r.width),
        hauteur: Math.round(r.height),
      };
    });
    expect(vignette, 'aucune vignette ne porte l’image dans le fil').not.toBeNull();
    expect(vignette?.taille).toBe('cover');
    expect(vignette?.repete).toBe('no-repeat');
    expect(vignette?.hauteur).toBe(140);
    expect(vignette?.largeur, 'la vignette n’a aucune largeur').toBeGreaterThan(100);
    /** Du côté de l'EXPÉDITEUR vu par l'auteur : ce n'est pas lui qui a écrit. */
    expect(vignette?.align).toBe('flex-start');

    await contexte.close();
  });
});
