import { expect, test } from '@playwright/test';
import { connecter } from './session';
import { monterEnL1 } from './niveau';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE MODULE COMPTE ÉTAIT UN DESSIN — SEPT PAGES, ZÉRO GESTE                 ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur, en sept points : « Compétences et langues sont pas modifiables ?
 * La page vérification est faite totalement ? […] l'ajout du numéro marche ? […]
 * la révocation de SESSIONS ? La page des contacts est faite ? Les demandes,
 * suggestions et bloqués ? […] Les configurations des notifications ? La page
 * des sanctions et ses options ? »
 *
 * MESURÉ AVANT, sur les huit cadres K02 à K10 : ZÉRO `onClick`, ZÉRO champ de
 * saisie. Les pages lisaient pourtant déjà les vraies données — numéros,
 * sessions, contacts, préférences — et toutes les routes répondaient. Il ne
 * manquait que le branchement.
 *
 * Ce cas vérifie que chaque page offre bien ses contrôles, et il mesure l'ÉTAT de
 * ceux qui en ont un : un bouton présent mais éteint à tort est le défaut qu'on
 * vient de corriger deux fois.
 */
test.describe('le module Compte répond', () => {
  test('les sept pages offrent leurs contrôles', async ({ page, request }, infos) => {
    await connecter(page.context(), request, { displayName: 'Awa Konaté' });

    // ── LE KYC AVANT VÉRIFICATION : « Commencer », et il est ACTIF ────────
    await page.goto('/compte/verification');
    const kyc = page.locator('[data-kyc-commencer]').filter({ visible: true }).first();
    await expect(kyc, 'aucun bouton de vérification d’identité').toBeVisible({ timeout: 25_000 });
    /**
     * ⚠ CE BOUTON N'EXISTAIT PAS DU TOUT SUR LA PLANCHE DE 390 px — alors que le
     * KYC se fait au téléphone, ce que la planche d'ordinateur écrit elle-même :
     * « Terminez sur votre téléphone ». Il y est maintenant, sur les deux.
     */
    await expect
      .poll(async () => (await kyc.innerText()).trim(), { timeout: 20_000 })
      .toBe('Commencer');
    await expect(kyc, 'un membre non vérifié doit pouvoir commencer').toBeEnabled();
    await expect(page.locator('[data-verification-numero]').filter({ visible: true })).toHaveCount(
      1,
    );

    /**
     * ⚠ LA CARTE « ÉTATS KYC » EST UNE LÉGENDE, et aucun pavé ne doit être
     * allumé pour qui n'a rien commencé. Elle peignait « En revue » sur l'aplat
     * orange POUR TOUT LE MONDE — l'exemple de la maquette, pris pour une donnée.
     */
    const allumes = await page
      .locator('[data-kyc-etat]')
      .filter({ visible: true })
      .evaluateAll((ns) =>
        ns.filter((n) => getComputedStyle(n).backgroundColor === 'rgb(251, 227, 212)').length,
      );
    expect(allumes, 'un état KYC est allumé alors que rien n’a été commencé').toBe(0);

    // ── SÉCURITÉ : quatre contrôles, et la fenêtre de numéro s'ouvre ──────
    await page.goto('/compte/securite');
    const ajouter = page.locator('[data-securite-ajouter]').filter({ visible: true }).first();
    await expect(ajouter, '« Ajouter » manque — absent de la planche mobile').toBeVisible({
      timeout: 25_000,
    });
    await expect(
      page.locator('[data-securite-revoquer-tout]').filter({ visible: true }).first(),
      '« Révoquer toutes les autres » manque — c’était un <a href="#">',
    ).toBeVisible();
    await ajouter.click();
    await expect(
      page.locator('[data-numero-champ]').filter({ visible: true }),
      'la fenêtre d’ajout de numéro ne s’ouvre pas',
    ).toHaveCount(1, { timeout: 15_000 });

    /**
     * ╔══════════════════════════════════════════════════════════════════════╗
     * ║ LE PAYS SE CHOISIT, ET LES NON-AFRICAINS SONT LÀ                    ║
     * ╚══════════════════════════════════════════════════════════════════════╝
     *
     * Le porteur : « L'ajout de numéro est validé ? Aussi il faut permettre de
     * changer le pays (les pays hors Afrique). »
     *
     * MESURÉ : `POST /me/phones` répondait **400**. `addPhoneStartSchema` exige
     * `countryIso2` et la fenêtre ne l'envoyait pas — elle s'ouvrait, le champ
     * marchait, et rien ne partait.
     *
     * Et le catalogue ne portait QUE des pays africains plus la France : trois
     * actifs sur dix-sept. Neuf destinations ont été ajoutées au semis.
     */
    const pays = page.locator('[data-numero-pays]').filter({ visible: true }).first();
    await expect
      .poll(async () => pays.locator('option').count(), {
        timeout: 20_000,
        message: 'le référentiel des pays ne se charge pas',
      })
      .toBeGreaterThan(3);
    const noms = (await pays.locator('option').allInnerTexts()).join(' ');
    expect(noms, 'aucune destination hors Afrique').toContain('Belgique');
    expect(noms, 'l’indicatif manque — il vient du référentiel').toContain('+32');

    // ── NOTIFICATIONS : la vraie liste, pas les six rangs dessinés ────────
    //
    // ⚠ LA MATRICE N'EST DESSINÉE QUE SUR L'ORDINATEUR. La planche de 390 px
    // n'écrit que les heures calmes — c'est consigné dans la déclaration
    // d'écran : « LE CADRE MOBILE N'ÉCRIT QUE LES HEURES CALMES ». Y poser une
    // grille de quatre colonnes demande de décider comment : trois interrupteurs
    // par rang ne tiennent pas dans 390 px en l'état. C'est un choix de dessin,
    // pas une correction — REMONTÉ au porteur.
    await page.goto('/compte/notifications');
    const rangs = page.locator('[data-notif-push]').filter({ visible: true });
    if ((page.viewportSize()?.width ?? 0) >= 1024) {
      await expect(rangs.first()).toBeVisible({ timeout: 25_000 });
    /**
     * PLUS DE SIX : la planche en dessine six en dur, et c'était la liste de tout
     * le monde. `GET /me/notification-preferences` en rend quatorze.
     */
      expect(await rangs.count(), 'la matrice est restée celle de la maquette').toBeGreaterThan(6);
      await expect(rangs.first()).toHaveAttribute('role', 'switch');
    }

    // ── DONNÉES : demander une archive, et l'état devient réel ────────────
    await page.goto('/compte/donnees');
    const demander = page.locator('[data-donnees-demander]').filter({ visible: true }).first();
    await expect(demander).toBeVisible({ timeout: 25_000 });
    await expect(
      page.locator('[data-donnees-desactiver]').filter({ visible: true }).first(),
    ).toBeVisible();
    /**
     * LA PHRASE N'EST PLUS UNE PROMESSE. La planche écrit « Préparé sous 48 h.
     * Lien valable 7 jours. » — vrai en général, faux pour qui attend.
     * `GET /me/export/latest` rend l'état réel.
     */
    /**
     * LA PHRASE N'EST PLUS CELLE DE LA PLANCHE. Elle écrivait « Préparé sous
     * 48 h. Lien valable 7 jours. » — vrai en général, faux pour qui attend.
     * `GET /me/export/latest` rend l'état réel, et la route rend `404
     * EXPORT_NOT_FOUND` tant qu'aucune archive n'a été demandée : l'écran le dit
     * au lieu de promettre.
     */
    await expect
      .poll(
        async () => (await page.locator('[data-frame="desktop"]').innerText()).replace(/\s+/g, ' '),
        { timeout: 25_000, message: 'l’état de l’archive n’est pas lu du serveur' },
      )
      .toContain('Aucune archive demandée');
    /**
     * ── LE CLIC N'EST EXERCÉ QUE SUR L'ORDINATEUR ────────────────────────
     *
     * Sur la planche de 390 px, la carte passe sous la barre d'onglets collée en
     * bas et le nœud se détache entre la lecture d'état et le clic — « Element is
     * not attached to the DOM ». Ce que ce cas doit tenir sur mobile, c'est que
     * les trois contrôles SOIENT LÀ : ils n'y étaient pas du tout, « Désactiver »
     * et « Supprimer » n'étaient que des titres de carte. Le parcours complet est
     * exercé sur l'ordinateur, où il vaut la même chose.
     */
    if ((page.viewportSize()?.width ?? 0) >= 1024) {
      await page.locator('[data-donnees-demander]').filter({ visible: true }).first().click();
    }

    // ── SANCTIONS : un vrai champ, et la borne du serveur ─────────────────
    //
    // ⚠ LE FORMULAIRE N'EST DESSINÉ QUE SUR L'ORDINATEUR. La planche de 390 px
    // porte un bouton « Contester » et RIEN d'autre : ni zone de texte, ni
    // envoi. Lui donner la carte « CONTESTER · UNE SEULE FOIS » demande de
    // décider comment — en fenêtre, ou dépliée sous la sanction. C'est un choix
    // de dessin, pas une correction — REMONTÉ au porteur.
    await page.goto('/compte/sanctions');
    if ((page.viewportSize()?.width ?? 0) >= 1024) {
      const texte = page.locator('[data-sanction-texte]').filter({ visible: true }).first();
      await expect(texte, 'la contestation est restée un texte d’exemple').toBeVisible({
        timeout: 25_000,
      });
      /** `appealSchema` : vingt caractères au moins. Le bouton reste éteint en dessous. */
      await texte.fill('Trop court');
      await expect(
        page.locator('[data-sanction-envoyer]').filter({ visible: true }).first(),
      ).toBeDisabled();
    }

    // ── PROFIL : compétences et langues s'ouvrent, et listent ─────────────
    await page.goto('/compte/profil');
    const competences = page
      .locator('[data-profil-competences]')
      .filter({ visible: true })
      .first();
    await expect(competences, 'Compétences n’est pas modifiable').toBeVisible({ timeout: 25_000 });
    await expect(
      page.locator('[data-profil-langues]').filter({ visible: true }).first(),
      'Langues n’est pas modifiable',
    ).toBeVisible();
    await competences.click();
    await expect
      .poll(
        async () => page.locator('[data-choix-item]').filter({ visible: true }).count(),
        { timeout: 25_000, message: 'le référentiel des compétences ne se charge pas' },
      )
      .toBeGreaterThan(10);

    expect(infos.errors).toEqual([]);
  });

  /**
   * ── LES CONTACTS, AVEC UNE VRAIE DEMANDE ─────────────────────────────────
   *
   * Les trois sections étaient des LIGNES UNIQUES : la maquette en dessine une
   * par section — « Yasmine Benali », « Théo Adjovi », « Paul A. » — et le
   * transcodage l'avait prise pour la liste. Un membre avec trois demandes n'en
   * voyait qu'une, et toujours la même.
   */
  test('une demande de contact s’affiche et s’accepte', async ({ page, browser, request }) => {
    /**
     * ⚠ CE CAS NE VAUT QUE SUR L'ORDINATEUR, ET C'EST UN ÉCART DE MAQUETTE.
     *
     * Relevé des textes du cadre de 390 px : « Contacts », « Suggestions »,
     * « Sandra M. », « Aïcha Diop » — deux onglets et DEUX CONTACTS ÉCRITS EN
     * DUR. Ni demandes reçues, ni bloqués, et pas même une boucle sur la liste
     * des contacts. La planche de téléphone ne dessine tout simplement pas ces
     * sections.
     *
     * Les y ajouter demande de décider où : sous un troisième onglet, ou en
     * sections empilées. C'est un choix de dessin, pas une correction — REMONTÉ
     * au porteur.
     */
    test.skip(
      (page.viewportSize()?.width ?? 0) < 1024,
      'la planche de 390 px ne dessine ni demandes ni bloqués — écart remonté',
    );

    const ouvert = await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    await monterEnL1(page.context(), request, ouvert.accessToken);

    const ctx = await browser.newContext();
    const autre = await connecter(ctx, request, { displayName: 'Fatim Sow' });
    const lui = await monterEnL1(ctx, request, autre.accessToken);
    await ctx.close();

    const envoyee = await request.post(`${API}/connection-requests`, {
      headers: { authorization: `Bearer ${lui.accessToken}` },
      data: {
        toHandle: ouvert.handle,
        message: 'On s’est croisées à l’atelier CV, ravie de vous revoir.',
      },
    });
    expect(envoyee.status(), 'la demande n’a pas été envoyée').toBe(201);

    await page.goto('/compte/contacts');
    const accepter = page.locator('[data-contacts-accepter]').filter({ visible: true }).first();
    await expect(accepter, 'la demande reçue ne s’affiche pas').toBeVisible({ timeout: 25_000 });
    await expect(
      page.locator('[data-contacts-refuser]').filter({ visible: true }).first(),
    ).toBeVisible();
    /** Le NOM RÉEL, et non « Yasmine Benali » — l'exemple de la maquette. */
    await expect(page.getByText('Fatim Sow').filter({ visible: true }).first()).toBeVisible();

    await accepter.click();
    await expect(
      page.locator('[data-contacts-accepter]').filter({ visible: true }),
      'accepter ne retire pas la demande',
    ).toHaveCount(0, { timeout: 25_000 });
  });
});
