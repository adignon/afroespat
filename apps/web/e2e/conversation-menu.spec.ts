import { expect, test } from '@playwright/test';
import { connecter } from './session';
import { monterEnL1, monterEnL2 } from './niveau';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
);

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA MESSAGERIE — SIX DÉFAUTS RELEVÉS PAR LE PORTEUR, EN UNE PASSE          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Tous les six avaient la même forme : la MAQUETTE dessine un contrôle, et le
 * transcodage l'avait laissé tel quel. Ce fichier les fige ensemble parce qu'ils
 * vivent sur le même écran et se cassent par les mêmes retouches.
 *
 *   1. « il faut permettre plusieurs images […] tu le mets dans l'input comme on
 *      a fait avec l'input de publication » — le composeur n'en prenait qu'une,
 *      et l'affichait dans un bandeau flottant ;
 *   2. « le bouton back sur mobile des conversations ne marche pas » — le chevron
 *      était un `<span>` ;
 *   3. « la conversation active n'est pas highlighted. Ça reste sur le premier »
 *      — le fond suivait le RANG (`rang === 0`), pas la conversation ouverte ;
 *   4. « utilise emoji-picker-react et affiche-le en bas […] avec un highlight du
 *      bouton d'emoji qui se transforme en bouton close » ;
 *   5. « l'avatar de la personne n'est pas affichée en haut de la conversation »
 *      — la planche y dessine l'icône d'un PARCOURS ;
 *   6. « les options voir le profil, mettre en sourdine, bloquer et signaler ne
 *      marchent pas » — quatre `<span>`.
 *
 * Par géométrie et par rôle, jamais par une classe : la maquette n'en a aucune.
 */
test.describe('la messagerie — liste, en-tête, composeur et menu', () => {
  test('les six contrôles sont vivants', async ({ page, browser, request }, infos) => {
    const telephone = (page.viewportSize()?.width ?? 0) < 1024;

    const ouvert = await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    const moi = await monterEnL1(page.context(), request, ouvert.accessToken);
    const entete = { authorization: `Bearer ${moi.accessToken}` };

    /** DEUX conversations : sans seconde ligne, le point 3 ne se mesure pas. */
    for (const nom of ['Fatim Sow', 'Kofi Boni']) {
      const ctx = await browser.newContext();
      const autre = await connecter(ctx, request, { displayName: nom });
      await monterEnL1(ctx, request, autre.accessToken);
      await ctx.close();
      const r = await request.post(`${API}/conversations/direct`, {
        headers: entete,
        data: { toHandle: autre.handle, firstMessage: `Bonjour ${nom}, une question.` },
      });
      expect(r.status(), `la conversation avec ${nom} n’a pas été ouverte`).toBe(201);
    }

    await page.goto('/messages');
    const lignes = page.locator('[data-conversation-ligne]').filter({ visible: true });
    await expect(lignes.first(), 'les lignes de la liste ne sont pas des liens').toBeVisible({
      timeout: 20_000,
    });
    await expect(lignes).toHaveCount(2);

    // ── 3. LE SURLIGNAGE SUIT LA CONVERSATION OUVERTE ────────────────────
    const fonds = (): Promise<string[]> =>
      lignes.evaluateAll((ns) => ns.map((n) => getComputedStyle(n).backgroundColor));
    const TRANSPARENT = 'rgba(0, 0, 0, 0)';
    const [avantA, avantB] = await fonds();

    await lignes.nth(1).click();
    await expect(page, 'le clic sur une conversation ne change pas l’URL').toHaveURL(
      /\/messages\/[0-9a-f-]{36}/,
      { timeout: 20_000 },
    );

    /**
     * LE SURLIGNAGE NE SE MESURE QUE SUR L'ORDINATEUR, et ce n'est pas une
     * exemption : son cadre montre les DEUX volets côte à côte, donc la liste
     * reste à l'écran pendant qu'une conversation est ouverte. La planche de
     * 390 px en fait deux PAGES — `/messages` porte la liste, `/messages/:id` la
     * conversation — et il n'y a alors aucune ligne à peindre. C'est la maquette,
     * et `messages-transverse.spec.ts` le vérifie déjà de son côté.
     */
    if (!telephone) {
      expect(avantA, 'aucune ligne n’est peinte à l’arrivée').not.toBe(TRANSPARENT);
      expect(avantB).toBe(TRANSPARENT);
      await expect
        .poll(fonds, {
          timeout: 20_000,
          message: 'le surlignage reste sur la première ligne au lieu de suivre l’ouverture',
        })
        .toEqual([TRANSPARENT, avantA]);
    }

    // ── 5. L'AVATAR DE L'INTERLOCUTEUR, EN HAUT ──────────────────────────
    const avatar = page.locator('[data-entete-avatar]').filter({ visible: true }).first();
    await expect(avatar, 'l’en-tête ne montre pas l’interlocuteur').toBeVisible({
      timeout: 20_000,
    });
    /**
     * SES INITIALES OU SA PHOTO, et rien d'autre. Ce membre n'a pas d'avatar :
     * on attend donc deux lettres, ce qui prouve au passage que ce n'est plus
     * l'icône de parcours que la maquette dessine à cet endroit.
     *
     * `expect.poll` ET NON UNE LECTURE UNIQUE : le rond EXISTE dès le premier
     * rendu — `SQUELETTE_M01` donne un en-tête aux initiales vides — donc
     * `toBeVisible` passe avant que la donnée soit là. Mesuré : la planche de
     * 390 px rendait `""` une fois sur deux, et c'était la mesure qui était trop
     * rapide, pas l'écran qui était faux.
     */
    await expect
      .poll(async () => (await avatar.innerText()).trim(), {
        timeout: 20_000,
        message: 'l’en-tête ne porte ni initiales ni photo de l’interlocuteur',
      })
      .toMatch(/^[A-ZÉÀÈ]{1,2}$/);

    // ── 2. LE RETOUR, SUR LA PLANCHE DE TÉLÉPHONE ────────────────────────
    if (telephone) {
      const retour = page.locator('[data-conversation-retour]').filter({ visible: true }).first();
      await expect(retour, 'le chevron de retour n’est pas un contrôle').toBeVisible();
      await retour.click();
      await expect(page, 'le retour ne ramène pas à la liste').toHaveURL(/\/messages$/, {
        timeout: 20_000,
      });
      /** On y retourne : la suite mesure le composeur, qui n'existe pas sur la liste. */
      await expect(lignes.nth(1)).toBeVisible({ timeout: 20_000 });
      await lignes.nth(1).click();
      await expect(page).toHaveURL(/\/messages\/[0-9a-f-]{36}/, { timeout: 20_000 });
    }

    // ── 4. LE CLAVIER D'ÉMOJIS, EN SECTION SOUS LA BARRE ─────────────────
    const bouton = page.locator('[data-bouton-emojis]').filter({ visible: true }).first();
    const boite = page.locator('[data-conversation-boite]').filter({ visible: true }).first();
    await expect(bouton).toHaveAttribute('aria-label', 'Émojis');
    await bouton.click();

    const panneau = page.locator('[data-panneau-emojis]').filter({ visible: true }).first();
    await expect(panneau, 'le clavier d’émojis ne s’ouvre pas').toBeVisible({ timeout: 25_000 });
    /**
     * EN BAS, ET NON EN PANNEAU FLOTTANT. Le porteur : « ça crée une section en
     * bas de la section de l'input et image et emoji et se met en bas de ça. » On
     * mesure donc que son bord HAUT est sous le bord BAS de la boîte de saisie —
     * la version précédente flottait au-dessus du bouton.
     */
    const basBoite = await boite.evaluate((n) => n.getBoundingClientRect().bottom);
    const hautPanneau = await panneau.evaluate((n) => n.getBoundingClientRect().top);
    expect(hautPanneau, 'le clavier ne s’ouvre pas SOUS la barre').toBeGreaterThanOrEqual(
      basBoite - 1,
    );

    /** Le bouton s'allume et devient une croix — « montrer que c'est ça qui est ouvert ». */
    await expect(bouton).toHaveAttribute('aria-label', 'Fermer les émojis');
    await expect(bouton).toHaveAttribute('aria-expanded', 'true');
    expect(await bouton.evaluate((n) => getComputedStyle(n).backgroundColor)).toBe(
      'rgb(22, 120, 94)',
    );

    await bouton.click();
    await expect(panneau, 'un second clic ne referme pas le clavier').toBeHidden({
      timeout: 10_000,
    });

    // ── 1. PLUSIEURS IMAGES, DANS LA BOÎTE DE SAISIE ─────────────────────
    await page.setInputFiles('[data-conversation-fichier]', [
      { name: 'a.png', mimeType: 'image/png', buffer: PNG },
      { name: 'b.png', mimeType: 'image/png', buffer: PNG },
    ]);
    const retirer = page.locator('[data-conversation-retirer-image]').filter({ visible: true });
    await expect(retirer, 'le composeur ne prend qu’une image').toHaveCount(2, { timeout: 30_000 });
    /**
     * DANS L'INPUT, pas dans un bandeau à côté : c'est la demande, mot pour mot
     * — « tu le mets dans l'input comme on a fait avec l'input de publication ».
     */
    expect(
      await retirer.first().evaluate((n) => n.closest('[data-conversation-boite]') !== null),
      'les vignettes ne sont pas dans la boîte de saisie',
    ).toBe(true);

    /** Une des deux se retire, et seule celle-là. */
    await retirer.first().click();
    await expect(retirer).toHaveCount(1);

    /**
     * ET L'IMAGE PART SANS TEXTE. `MESSAGE_BODY_MIN` exigeait un caractère ; la
     * borne est devenue « un corps OU une image », sans quoi envoyer quatre
     * photos aurait demandé quatre phrases.
     */
    await page.locator('[data-conversation-envoyer]').filter({ visible: true }).first().click();
    await expect(retirer).toHaveCount(0, { timeout: 30_000 });

    const apres = await request.get(`${API}/conversations`, { headers: entete });
    const { items } = (await apres.json()) as { items: { lastMessagePreview: string | null }[] };
    expect(
      items.some((c) => c.lastMessagePreview === 'Photo'),
      'une image seule laisse la ligne de la liste vide',
    ).toBe(true);

    // ── 6. LES QUATRE ENTRÉES DU MENU ────────────────────────────────────
    await page
      .getByRole('button', { name: 'Menu de la conversation' })
      .filter({ visible: true })
      .first()
      .click();

    const profil = page.locator('[data-menu-profil]').filter({ visible: true }).first();
    await expect(profil, '« Voir le profil » ne mène nulle part').toBeVisible({ timeout: 10_000 });
    /**
     * L'AROBASE EN FAIT PARTIE. La route `(app)/[handle]` l'EXIGE — `pseudo()`
     * rend `null` sans elle, donc `notFound()`. Le lien pointait vers
     * `/<handle>` et la page répondait 404 en silence ; le porteur l'a vu avant
     * les épreuves : « la page voir le profil ne s'affiche pas ».
     */
    expect(await profil.getAttribute('href')).toMatch(/^\/@[a-z0-9-]+$/);
    await expect(page.locator('[data-menu-signaler]').filter({ visible: true })).toHaveAttribute(
      'href',
      '?feuille=signaler',
    );

    /** La sourdine écrit vraiment : on la pose, et le serveur la rend. */
    await page.locator('[data-menu-sourdine]').filter({ visible: true }).first().click();
    await expect
      .poll(
        async () => {
          const r = await request.get(`${API}/conversations`, { headers: entete });
          const liste = (await r.json()) as { items: { muted: boolean }[] };
          return liste.items.some((c) => c.muted);
        },
        { timeout: 20_000, message: 'la sourdine n’est pas enregistrée' },
      )
      .toBe(true);

    /**
     * « Bloquer » EST UN BOUTON ET IL EST BRANCHÉ. On ne le DÉCLENCHE pas : il
     * demande confirmation par `window.confirm`, et §4 dit que débloquer ne
     * restaure pas les contacts — un cas d'épreuve n'a pas à poser un blocage
     * irréversible pour prouver qu'un bouton existe. Son geste est mesuré par le
     * fait qu'il n'est pas désactivé.
     */
    const bloquer = page.locator('[data-menu-bloquer]').filter({ visible: true }).first();
    await expect(bloquer, '« Bloquer » n’est pas un contrôle').toBeEnabled();

    expect(infos.errors).toEqual([]);
  });
});

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ SIGNALER — LA FENÊTRE NE S'OUVRAIT PAS, ET N'AURAIT RIEN FAIT            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Le signalement quand on clique sur signaler n'affiche pas
 * automatiquement le modal. L'URL change mais le modal ne vient pas. Ensuite le
 * modal n'est pas du tout dynamique (pas d'input, les choix ne marchent pas ainsi
 * que la soumission). » Et : « La page voir le profil ne s'affiche pas. »
 *
 * DEUX CAUSES, mesurées :
 *
 *   · `useState(ouverte)` ne lisait sa prise QU'AU MONTAGE. Le lien change l'URL,
 *     Next rerend, mais le composant n'est pas remonté — la fenêtre restait donc
 *     fermée. Seule une arrivée DIRECTE sur l'URL l'ouvrait, et c'est précisément
 *     ce que les épreuves exerçaient : le défaut leur était invisible.
 *   · le lien de profil pointait vers `/<handle>` ; la route `(app)/[handle]`
 *     EXIGE l'arobase et rend `notFound()` sans elle.
 */
test.describe('signaler depuis une conversation', () => {
  test('le menu ouvre la fenêtre, les six motifs répondent, et l’envoi part', async ({
    page,
    browser,
    request,
  }, infos) => {
    const ouvert = await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    // MISE À JOUR (lot w5b) : signaler demande le niveau N2 (`report.create`) ; à N1 le
    // produit ouvre « Niveau N2 requis » au lieu de la feuille, à raison.
    const moi = await monterEnL2(page.context(), request, ouvert.accessToken);
    const entete = { authorization: `Bearer ${moi.accessToken}` };

    const ctx = await browser.newContext();
    const autre = await connecter(ctx, request, { displayName: 'Fatim Sow' });
    await monterEnL1(ctx, request, autre.accessToken);
    await ctx.close();
    const ouverture = await request.post(`${API}/conversations/direct`, {
      headers: entete,
      data: { toHandle: autre.handle, firstMessage: 'Bonjour, une question sur le logement.' },
    });
    expect(ouverture.status()).toBe(201);

    await page.goto('/messages');
    const ligne = page.locator('[data-conversation-ligne]').filter({ visible: true }).first();
    await expect(ligne).toBeVisible({ timeout: 20_000 });
    await ligne.click();
    await expect(page).toHaveURL(/\/messages\/[0-9a-f-]{36}/, { timeout: 20_000 });

    // ── « VOIR LE PROFIL » MÈNE À UNE PAGE QUI EXISTE ────────────────────
    await page
      .getByRole('button', { name: 'Menu de la conversation' })
      .filter({ visible: true })
      .first()
      .click();
    const profil = page.locator('[data-menu-profil]').filter({ visible: true }).first();
    await expect(profil).toBeVisible({ timeout: 10_000 });
    /** L'arobase : sans elle, `(app)/[handle]` rend `notFound()`. */
    expect(await profil.getAttribute('href')).toBe(`/@${autre.handle}`);
    await profil.click();
    await expect(page).toHaveURL(new RegExp(`/@${autre.handle}$`), { timeout: 20_000 });
    await expect(
      page.getByText('Fatim Sow').filter({ visible: true }).first(),
      'la page de profil ne s’affiche pas',
    ).toBeVisible({ timeout: 20_000 });

    // ── LE MENU OUVRE LA FENÊTRE DE SIGNALEMENT, SANS RECHARGEMENT ───────
    await page.goBack();
    await expect(page).toHaveURL(/\/messages\/[0-9a-f-]{36}/, { timeout: 20_000 });
    await page
      .getByRole('button', { name: 'Menu de la conversation' })
      .filter({ visible: true })
      .first()
      .click();
    await page.locator('[data-menu-signaler]').filter({ visible: true }).first().click();

    const feuille = page.getByRole('dialog', { name: 'Signaler' });
    await expect(feuille, 'l’URL change mais la fenêtre ne s’ouvre pas').toBeVisible({
      timeout: 20_000,
    });

    // ── LES SIX MOTIFS SONT DES BOUTONS RADIO QUI RÉPONDENT ──────────────
    const motifs = feuille.locator('[data-signalement-motif]');
    await expect(motifs).toHaveCount(6);
    const argent = feuille.locator('[data-signalement-motif="MONEY_REQUEST"]');
    const arnaque = feuille.locator('[data-signalement-motif="SCAM"]');
    /**
     * AUCUN N'EST COCHÉ À L'OUVERTURE, alors que la planche en dessine un :
     * elle montre un exemple REMPLI. Un motif pré-choisi partirait au premier clic
     * sur « Envoyer » sans que personne ne l'ait voulu.
     */
    await expect(argent).toHaveAttribute('aria-checked', 'false');
    await arnaque.click();
    await expect(arnaque).toHaveAttribute('aria-checked', 'true');
    await expect(argent).toHaveAttribute('aria-checked', 'false');

    // ── LE CHAMP DE DÉTAILS EST UN CHAMP ─────────────────────────────────
    const details = feuille.locator('[data-signalement-details]');
    await details.fill('Il m’a demandé 150 € pour accélérer mon dossier.');
    expect(await details.inputValue()).toContain('150');

    // ── ET L'ENVOI PART VRAIMENT ─────────────────────────────────────────
    await feuille.locator('[data-signalement-envoyer]').click();
    /** La maquette dessine une confirmation : l'écran y bascule. */
    await expect(page, 'l’envoi ne mène pas à la confirmation').toHaveURL(/feuille=merci/, {
      timeout: 25_000,
    });

    expect(infos.errors).toEqual([]);
  });
});
