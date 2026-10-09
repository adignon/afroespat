import { createHmac } from 'node:crypto';
import { expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { connecter, type Membre } from './session';

/**
 * Les quatre écrans de l'agenda — E01 à E04 — BRANCHÉS SUR L'API.
 *
 * ── CE QUE CE FICHIER ÉPROUVE, ET POURQUOI IL A FALLU L'ÉCRIRE ──────────────
 *
 * Ces quatre écrans vivaient dans `entraide-agenda.spec.ts`, où ils se visitaient
 * SANS SESSION : ils affichaient la maquette, et les tests mesuraient sa
 * géométrie. Depuis qu'ils lisent l'API, un écran sans session ne montre plus
 * qu'une invitation à se reconnecter — un test qui n'en ouvrirait pas mesurerait
 * l'écran d'erreur en croyant mesurer l'écran. C'est le genre de succès qui ne
 * prouve rien, et c'est pour l'éviter que les quatre écrans ont déménagé ici.
 *
 * Chaque test crée donc SON membre, le porte à L1, et crée SON événement : les
 * assertions portent sur les valeurs de ce membre-là, et la SECONDE MOITIÉ de
 * chacune vérifie que le texte dessiné par la maquette a DISPARU. Sans cette
 * seconde moitié, un écran qui afficherait les deux passerait.
 *
 * ── TROIS CONTRAINTES DE L'API, MESURÉES, QUI FAÇONNENT CE FICHIER ──────────
 *
 *   1. `event.create` et `event.attend` exigent L1 (00 §7.3). `connecter()` rend
 *      un membre L0 : il faut donc passer par la vérification d'identité, et le
 *      fournisseur fictif la rend atteignable — session KYC puis webhook SIGNÉ.
 *   2. LE JETON PORTE LES DROITS. Au passage L0 → L1 il devient périmé
 *      (`TOKEN_STALE`), et toute écriture capacitaire part en 401. On reprend donc
 *      une session APRÈS la promotion, et c'est son cookie qu'on installe.
 *   3. TROIS ENVOIS D'OTP PAR NUMÉRO ET PAR HEURE — la limite est dans le SERVICE
 *      (`AuthService.assertWithinRateLimits`, §2.1), donc `RATE_LIMIT_ENABLED=false`
 *      ne la coupe pas. Chaque membre se connecte ici DEUX fois au plus, et aucun
 *      test ne recycle un numéro.
 *
 * ── CE QUI N'EST PAS ÉPROUVÉ ICI, ET OÙ ÇA L'EST ────────────────────────────
 *
 * La case « Présent·e » cochée demande un événement COMMENCÉ, et aucune route ne
 * peut en créer un : `POST /events` refuse à moins de deux heures (TOO_SOON) et
 * `POST /check-in` n'ouvre qu'à partir du début (vérifié : 422
 * CHECKIN_WINDOW_CLOSED). Ce qui se joue là — « la case se décide sur `checkedIn`
 * et pas sur le RSVP » — est donc éprouvé sur les CHARGES RÉELLES dans
 * `src/screens/agenda/agenda.test.ts`, en mutant l'un puis l'autre champ. Ici on
 * éprouve la moitié atteignable : la case VIDE de l'organisateur, et l'ABSENCE de
 * case pour qui n'organise pas.
 */

/** Ce fichier pilote lui-même ses tailles : un seul projet suffit. */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'piloté par le test');

/**
 * CENT VINGT SECONDES PAR TEST, et le chiffre est mesuré, pas choisi.
 *
 * Chaque test crée un membre (OTP), le porte à L1 (session KYC + webhook signé +
 * reprise de session), crée un événement, puis charge deux à trois pages qui
 * appellent chacune quatre à cinq routes. Les trente secondes par défaut
 * expiraient sur des écrans parfaitement sains, et le message ne nommait pas la
 * cause : « Chargement de votre compte… » encore à l'écran.
 *
 * Si cette borne est atteinte un jour, c'est que quelque chose est vraiment
 * bloqué — et l'échec le dira, puisque `visiter` échoue sur l'état d'attente.
 */
test.describe.configure({ timeout: 120_000 });

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1';
const SECRET = process.env['DIDIT_WEBHOOK_SECRET'] ?? 'dev-didit-webhook-secret-change-me';

/** Un membre L1, sa session installée dans le navigateur, et son jeton d'API. */
interface MembreL1 extends Membre {
  readonly jeton: string;
}

/**
 * Porte un membre à L1 et REPREND sa session.
 *
 * Le webhook est signé en HMAC-SHA256 sur les OCTETS envoyés, comme le ferait le
 * fournisseur : c'est la seule porte d'entrée vers L1, et elle est la même en
 * développement qu'en production — seul le secret change.
 */
async function connecterL1(
  context: BrowserContext,
  request: APIRequestContext,
  profil: { readonly displayName?: string } = {},
): Promise<MembreL1> {
  const membre = await connecter(context, request, profil);

  const session = await request.post(`${API}/me/kyc/session`, {
    headers: { authorization: `Bearer ${membre.accessToken}` },
  });
  if (!session.ok()) throw new Error(`kyc/session ${session.status()} : ${await session.text()}`);
  const { sessionId } = (await session.json()) as { sessionId: string };

  const corps = JSON.stringify({ sessionId, status: 'APPROVED', isAdult: true });
  const hook = await request.post(`${API}/webhooks/didit`, {
    headers: {
      'content-type': 'application/json',
      'x-signature': createHmac('sha256', SECRET).update(Buffer.from(corps, 'utf8')).digest('hex'),
    },
    data: corps,
  });
  if (!hook.ok()) throw new Error(`webhooks/didit ${hook.status()} : ${await hook.text()}`);

  // Le jeton porte les droits : périmé par la promotion, il faut en reprendre un.
  const demande = await request.post(`${API}/auth/otp/request`, {
    data: { phone: membre.phone, countryIso2: 'BJ', captchaToken: 'fake', acceptTerms: true },
  });
  if (!demande.ok()) throw new Error(`otp/request ${demande.status()} : ${await demande.text()}`);
  const { challengeId } = (await demande.json()) as { challengeId: string };
  const verif = await request.post(`${API}/auth/otp/verify`, {
    data: { challengeId, code: process.env['SMS_FAKE_FIXED_CODE'] ?? '123456' },
  });
  if (!verif.ok()) throw new Error(`otp/verify ${verif.status()} : ${await verif.text()}`);
  const { accessToken } = (await verif.json()) as { accessToken: string };

  const me = await request.get(`${API}/me`, { headers: { authorization: `Bearer ${accessToken}` } });
  const niveau = ((await me.json()) as { user: { verificationLevel: string } }).user
    .verificationLevel;
  expect(niveau, 'le membre devait être porté à L1 pour créer un événement').toBe('L1');

  /**
   * LE COOKIE DE LA SESSION NEUVE REMPLACE CELUI DE `connecter`, et il le doit :
   * `dp_refresh` TOURNE à chaque rafraîchissement et porte un numéro de
   * génération. Deux sessions du même membre dans le même navigateur présentent
   * une génération dépassée, le serveur y voit un REJEU — ce pour quoi il est
   * fait — et RÉVOQUE LA CHAÎNE. Mesuré pendant ce lot, journal de l'API mot pour
   * mot : « Rejeu de jeton sur la chaîne … (génération 0 contre 4) ».
   */
  const cookies = await request.storageState();
  const refresh = cookies.cookies.filter((c) => c.name === 'dp_refresh').at(-1);
  if (refresh === undefined) throw new Error('aucun dp_refresh après la reprise de session');
  await context.addCookies([refresh]);

  return { ...membre, jeton: accessToken };
}

/** Le jour civil de demain, à Paris : l'événement doit commencer dans plus de 2 h. */
function demain(): string {
  const dans26h = new Date(Date.now() + 26 * 3_600_000);
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Europe/Paris',
  }).format(dans26h);
}

interface Evenement {
  readonly id: string;
  readonly titre: string;
  readonly jour: string;
  readonly lieu: string;
  readonly adresse: string;
}

/**
 * Crée un événement à Lyon, avec lieu, description et capacité.
 *
 * `capacite` est un paramètre parce que la LISTE D'ATTENTE ne s'éprouve qu'avec un
 * événement plein : §3.2 fait de `WAITLIST` une décision du serveur quand la
 * capacité est atteinte, et une place unique est la façon la plus courte de
 * l'atteindre.
 */
async function creerEvenement(
  request: APIRequestContext,
  jeton: string,
  titre: string,
  capacite = 40,
): Promise<Evenement> {
  const villes = await request.get(`${API}/places/cities?limit=100`);
  const items = ((await villes.json()) as { items: { id: string; name: string }[] }).items;
  const lyon = items.find((c) => c.name === 'Lyon') ?? items[0];
  if (lyon === undefined) throw new Error('aucune ville dans le référentiel');

  const jour = demain();
  const lieu = 'Maison des Associations';
  const adresse = '28 rue Denfert-Rochereau, Lyon 7e';
  const cree = await request.post(`${API}/events`, {
    headers: { authorization: `Bearer ${jeton}` },
    data: {
      type: 'COOKING',
      title: titre,
      description: 'Chacun apporte un plat du pays.',
      cityId: lyon.id,
      venueName: lieu,
      addressText: adresse,
      startsAt: `${jour}T12:00:00+02:00`,
      endsAt: `${jour}T16:00:00+02:00`,
      capacity: capacite,
    },
  });
  if (!cree.ok()) throw new Error(`POST /events ${cree.status()} : ${await cree.text()}`);
  const { id } = (await cree.json()) as { id: string };
  return { id, titre, jour, lieu, adresse };
}

/** `PUT /events/:id/rsvp` au nom d'un membre L1. */
async function repondre(
  request: APIRequestContext,
  jeton: string,
  id: string,
  status: 'GOING' | 'MAYBE' | 'DECLINED',
): Promise<void> {
  const res = await request.put(`${API}/events/${id}/rsvp`, {
    headers: { authorization: `Bearer ${jeton}` },
    data: { status },
  });
  if (!res.ok()) throw new Error(`PUT rsvp ${res.status()} : ${await res.text()}`);
}

/**
 * `waitUntil: 'load'` puis attente de la fin du chargement CLIENT.
 *
 * Ces écrans chargent leurs données dans le navigateur : `load` ne dit donc rien
 * de leur contenu, et `networkidle` ne retombe jamais sur une page App Router qui
 * précharge ses liens. On attend que l'état d'attente de `EcranDonnees` ait
 * disparu, et on ÉCHOUE s'il reste — un test qui mesurerait « Chargement… » ne
 * mesurerait rien.
 */
async function visiter(page: Page, route: string, width: number, height = 1000): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto(route, { waitUntil: 'load' });
  /**
   * SOIXANTE SECONDES, et le chiffre vient d'une mesure, pas d'une précaution.
   *
   * Un test de cette suite a rougi sur un écran parfaitement sain : la charge de
   * la machine était à 19 (`uptime`), plusieurs constructions tournaient en
   * parallèle, et l'état d'attente tenait encore à la trentième seconde. Relancé
   * seul, le même test passe en 1,5 s. La borne tient compte de la machine, et
   * elle reste bornée par le délai de 120 s du fichier : un vrai blocage échoue
   * toujours, et il échoue EN NOMMANT l'état d'attente.
   */
  /**
   * ── LA PHRASE ATTENDUE N'ÉTAIT PAS CELLE QUE CET ÉCRAN ÉCRIT ──────────────
   *
   * MESURÉ : ce cas attendait « Chargement de votre compte… », la phrase par
   * défaut d'`EcranDonnees`. `agenda-ecran.tsx` passe la SIENNE —
   * « Chargement de l'agenda… » — donc le compte à zéro était vrai dès la
   * première image, l'attente ne patientait PAS, et la mesure partait sur le
   * squelette. Le symptôme : « le calendrier vertical doit porter ses lignes de
   * jour : expected > 27, received 0 » — alors que le calendrier s'affiche très
   * bien à l'écran. `SQUELETTE_E01` rend `semaines: []`, et c'est exactement ce
   * que le relevé comptait.
   *
   * ON ATTEND DONC LE RÔLE, PAS LA PHRASE. `EcranDonnees` marque sa bande d'un
   * `role="status"` quelle que soit la phrase qu'on lui donne : le relevé ne peut
   * plus manquer un écran parce qu'il s'annonce autrement. C'est la même raison
   * qui a fait rater celui-ci pendant tout un lot.
   */
  await expect(
    page.locator('[role="status"]').filter({ hasText: /Chargement/ }),
  ).toHaveCount(0, { timeout: 60_000 });
  await expect(page.locator('[data-screen]')).toBeVisible({ timeout: 60_000 });
}

/** Le cadre visible à cette largeur. Les deux sont dans le document, l'un masqué. */
const cadre = (page: Page, width: number) =>
  page.locator(`[data-frame="${width >= 1024 ? 'desktop' : 'mobile'}"]`);

const LARGEURS = [1440, 390] as const;

// ─── E01 · /agenda ───────────────────────────────────────────────────────────

test.describe('E01 — l’agenda lit l’API', () => {
  for (const largeur of LARGEURS) {
    test(`${largeur} px — le jour, les cartes et le calendrier viennent du serveur`, async ({
      page,
      context,
      request,
    }) => {
      const membre = await connecterL1(context, request, { displayName: 'Fatim Sow' });
      const evenement = await creerEvenement(request, membre.jeton, 'Thiéboudienne du dimanche');

      await visiter(page, `/agenda?jour=${evenement.jour}`, largeur);
      const vue = cadre(page, largeur);

      // ── La donnée du serveur est à l'écran ──────────────────────────────
      await expect(vue.getByText(evenement.titre).first()).toBeVisible();
      const titres = page.getByRole('heading', { level: 1 });
      await expect(titres).toHaveCount(1);

      /**
       * LE TITRE EST LE JOUR SÉLECTIONNÉ sur ordinateur, la SECTION sur mobile —
       * c'est la maquette, et 09 §3.5 l'explique : le mobile porte son sélecteur
       * de date en bande, donc son titre ne peut pas être la date.
       */
      if (largeur >= 1024) {
        const attendu = new Intl.DateTimeFormat('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          timeZone: 'UTC',
        }).format(new Date(`${evenement.jour}T12:00:00Z`));
        await expect(titres).toHaveText(attendu.charAt(0).toUpperCase() + attendu.slice(1));
      } else {
        await expect(titres).toHaveText('Agenda');
      }

      /**
       * LA BARRE HAUTE PORTE MON IDENTITÉ, et les deux moitiés sont écrites : mon
       * prénom est là, celui de la planche n'y est plus.
       *
       * CETTE ASSERTION MANQUAIT, et c'est une MUTATION TÉMOIN qui l'a montré : en
       * forçant `construireMoi` à rendre « Amina », toute cette suite restait
       * VERTE. Un test qui ne meurt pas quand on remet la valeur de la maquette ne
       * garde pas le branchement — il garde seulement qu'un écran s'affiche.
       *
       * Le membre de test ne partage pas ses initiales avec la planche : « Awa
       * Diagne » donnait « AD », exactement ce que la maquette dessine, donc une
       * assertion sur les initiales n'aurait rien distingué.
       */
      if (largeur >= 1024) {
        await expect(vue.getByText('Fatim', { exact: true })).toBeVisible();
        await expect(vue.getByText('FS', { exact: true })).toBeVisible();
      }

      // ── Et le texte de la maquette a DISPARU ────────────────────────────
      const texte = await page.locator('body').innerText();
      for (const figé of [
        'Samedi 21 septembre',
        'Atelier budget étudiant',
        'Septembre 2026',
        'Aujourd’hui : samedi 26',
        "Aujourd'hui : samedi 26",
        // L'identité que la planche dessine dans sa barre haute.
        ...(largeur >= 1024 ? ['Amina'] : []),
      ]) {
        expect(texte, `« ${figé} » est encore dessiné : l’écran n’a pas lu l’API`).not.toContain(
          figé,
        );
      }
    });
  }

  /**
   * LE POINT TERRE CUITE MARQUE MES PARTICIPATIONS (§3.5), et il se mesure en
   * COULEUR CALCULÉE : c'est une propriété de l'écran, pas un mot dans le texte.
   *
   * L'organisateur est inscrit `GOING` par la création (le service l'ajoute), donc
   * le jour de son événement porte le point terre cuite, et un jour sans aucun
   * événement est atténué à `.45` — les deux variantes que la maquette dessine.
   */
  test('1440 px — le calendrier marque mon jour en terre cuite et atténue les jours vides', async ({
    page,
    context,
    request,
  }) => {
    const membre = await connecterL1(context, request, { displayName: 'Fatim Sow' });
    const evenement = await creerEvenement(request, membre.jeton, 'Atelier CV du quartier');

    await visiter(page, `/agenda?jour=${evenement.jour}`, 1440);

    const mesures = await page.evaluate(() => {
      const frame = document.querySelector('[data-frame="desktop"]')!;
      const lignes = [...frame.querySelectorAll<HTMLElement>('div')].filter(
        (el) => el.style.height === '40px' && el.style.borderRadius === '12px',
      );
      return lignes.map((el) => ({
        texte: el.innerText.replace(/\s+/g, ' ').trim(),
        opacite: getComputedStyle(el).opacity,
        points: [...el.querySelectorAll<HTMLElement>('span')]
          .filter((s) => s.style.width === '8px')
          .map((s) => getComputedStyle(s).backgroundColor),
      }));
    });

    expect(mesures.length, 'le calendrier vertical doit porter ses lignes de jour').toBeGreaterThan(
      27,
    );
    const avecPoint = mesures.filter((m) => m.points.length > 0);
    const terreCuite = avecPoint.filter((m) => m.points.includes('rgb(224, 115, 58)'));
    expect(terreCuite.length, 'mon jour doit porter le point terre cuite').toBeGreaterThan(0);

    const vides = mesures.filter((m) => m.points.length === 0);
    expect(vides.length, 'il doit rester des jours sans événement').toBeGreaterThan(0);
    expect(vides.every((m) => m.opacite === '0.45'), 'un jour vide est atténué').toBe(true);
    expect(
      terreCuite.every((m) => m.opacite === '1'),
      'un jour où je participe n’est pas atténué',
    ).toBe(true);
  });
});

// ─── E02 · /agenda/:id ───────────────────────────────────────────────────────

test.describe('E02 — la fiche d’un événement', () => {
  for (const largeur of LARGEURS) {
    test(`${largeur} px — titre, date, lieu et compteur viennent du serveur`, async ({
      page,
      context,
      request,
    }) => {
      const membre = await connecterL1(context, request, { displayName: 'Fatim Sow' });
      const evenement = await creerEvenement(request, membre.jeton, 'Repas du quartier Guillotière');

      await visiter(page, `/agenda/${evenement.id}`, largeur);
      const vue = cadre(page, largeur);

      await expect(page.getByRole('heading', { level: 1 })).toHaveText(evenement.titre);
      // L'organisateur est compté `GOING` à la création : 1 sur 40 places.
      await expect(vue.getByText('1 sur 40 places')).toBeVisible();
      await expect(vue.getByText(membre.displayName).first()).toBeVisible();

      const texte = await page.locator('body').innerText();
      /**
       * « Repas partagé béninois » N'EST PAS DANS CETTE LISTE, et c'est le test
       * qui l'a appris : c'est aussi le titre d'un ÉVÉNEMENT RÉEL de la base de
       * développement, qui apparaît légitimement dans le calendrier du panneau.
       * L'y laisser faisait échouer un écran juste. Ne sont listés que des
       * littéraux que SEULE la maquette écrit.
       */
      for (const figé of ['Aïcha Diop', '27 sur 40 places', 'Maison des Assos']) {
        expect(texte, `« ${figé} » est encore dessiné`).not.toContain(figé);
      }
      /**
       * RÈGLE DURE §10 : l'adresse est du TEXTE LIBRE, jamais géocodée — affichée
       * telle qu'elle a été envoyée, et sans aucune coordonnée.
       *
       * ELLE N'EST ÉCRITE QUE SUR L'ORDINATEUR : la maquette ne donne au cadre
       * mobile que le nom du lieu et la ville (« Maison des Assos, Lyon 7e »). Le
       * test l'a appris en échouant sur un écran juste ; l'écart est celui de la
       * maquette, et il est mesuré ici plutôt que comblé.
       */
      if (largeur >= 1024) {
        expect(texte).toContain(evenement.adresse);
      } else {
        expect(texte).toContain(evenement.lieu);
      }
      expect(texte).not.toMatch(/4[0-9]\.\d{4}|latitude|longitude/i);
    });
  }

  /**
   * CE QUI DÉCIDE LE BOUTON ACTIF EST `myStatus`, et la mesure est la COULEUR —
   * `#16785E` pour l'actif, `#F2F5F4` pour les autres, les deux paires que la
   * maquette dessine. Un test qui lirait le seul texte passerait sur un écran où
   * les trois boutons seraient gris.
   */
  test('1440 px — « Peut-être » devient actif quand c’est ma réponse, et « Je viens » ne l’est plus', async ({
    page,
    context,
    request,
  }) => {
    const hote = await connecterL1(context, request, { displayName: 'Hôte Éprouvé' });
    const evenement = await creerEvenement(request, hote.jeton, 'Match amical du dimanche');

    const couleurs = async () =>
      page.evaluate(() => {
        const frame = document.querySelector('[data-frame="desktop"]')!;
        const boutons = [...frame.querySelectorAll<HTMLElement>('span')].filter(
          (el) => el.style.height === '46px' && el.style.borderRadius === '14px',
        );
        return boutons.map((el) => [el.innerText.trim(), getComputedStyle(el).backgroundColor]);
      });

    // L'organisateur est `GOING` : « Je viens » est actif.
    await visiter(page, `/agenda/${evenement.id}`, 1440);
    expect(await couleurs()).toEqual([
      ['Je viens', 'rgb(22, 120, 94)'],
      ['Peut-être', 'rgb(242, 245, 244)'],
      ['Je ne viens pas', 'rgb(242, 245, 244)'],
    ]);

    // La MÊME page, après avoir changé de réponse par l'API : l'actif se déplace.
    await repondre(request, hote.jeton, evenement.id, 'MAYBE');
    await visiter(page, `/agenda/${evenement.id}`, 1440);
    expect(await couleurs()).toEqual([
      ['Je viens', 'rgb(242, 245, 244)'],
      ['Peut-être', 'rgb(22, 120, 94)'],
      ['Je ne viens pas', 'rgb(242, 245, 244)'],
    ]);
  });

  /**
   * « VUE ORGANISATEUR » EST UN ÉTAT, et c'est le SERVEUR qui le décide
   * (`isOrganizer`). La carte doit donc apparaître à l'organisateur et disparaître
   * pour les autres — la maquette, elle, la dessine toujours.
   */
  test('1440 px — la carte « VUE ORGANISATEUR » ne s’affiche qu’à l’organisateur', async ({
    page,
    context,
    request,
  }) => {
    const hote = await connecterL1(context, request, { displayName: 'Hôte Éprouvé' });
    const evenement = await creerEvenement(request, hote.jeton, 'Permanence CAF du quartier');

    await visiter(page, `/agenda/${evenement.id}`, 1440);
    await expect(page.getByText('VUE ORGANISATEUR')).toBeVisible();
    /**
     * LA LIGNE ENTIÈRE DOIT AVOIR DISPARU, pas seulement son chiffre.
     *
     * La première version cherchait `/Vous êtes \d+e sur la liste/`, et une
     * MUTATION l'a prise en défaut : en retirant la condition, la ligne se
     * dessinait avec un nombre VIDE — « Vous êtes e sur la liste » — que le `\d+`
     * ne reconnaissait pas. Le test restait vert sur un écran qui mentait.
     */
    await expect(page.getByText(/sur la liste/)).toHaveCount(0);

    // Un autre membre, dans un contexte neuf : la carte doit disparaître.
    const autre = await page.context().browser()!.newContext();
    const autrePage = await autre.newPage();
    const invite = await connecterL1(autre, request, { displayName: 'Invité Éprouvé' });
    await repondre(request, invite.jeton, evenement.id, 'GOING');
    await visiter(autrePage, `/agenda/${evenement.id}`, 1440);
    await expect(autrePage.getByText(evenement.titre).first()).toBeVisible();
    await expect(autrePage.getByText('VUE ORGANISATEUR')).toHaveCount(0);
    await autre.close();
  });
  /**
   * §3.2 — LA CAPACITÉ ATTEINTE ET LA LISTE D'ATTENTE, deux faits distincts.
   *
   * La carte « COMPLET » dit que l'événement est plein ; la ligne « Vous êtes 3e
   * sur la liste » dit que MOI j'y suis. La maquette dessine les deux ensemble,
   * parce qu'elle documente un état ; un écran doit les distinguer, sinon il
   * annonce une position à qui n'en a pas.
   *
   * `WAITLIST` est une décision du SERVEUR : l'invité demande `GOING` sur un
   * événement d'une seule place, et c'est le serveur qui le met en attente.
   */
  test('1440 px — « COMPLET » à capacité atteinte, et la position seulement pour qui est sur la liste', async ({
    page,
    context,
    request,
  }) => {
    const hote = await connecterL1(context, request, { displayName: 'Hôte Éprouvé' });
    const evenement = await creerEvenement(request, hote.jeton, 'Visite guidée du quartier', 1);

    /**
     * LA MESURE EST SCOPÉE AU CADRE VISIBLE, et il faut qu'elle le soit : les DEUX
     * cadres sont dans le document, l'un masqué par CSS. Un `.last()` sur toute la
     * page attrapait l'élément du cadre MOBILE — présent, mais caché — et le test
     * échouait sur un écran juste.
     */
    await visiter(page, `/agenda/${evenement.id}`, 1440);
    const vue = cadre(page, 1440);
    await expect(vue.getByText('COMPLET')).toBeVisible();
    // AU SINGULIER : une place, « 1 sur 1 place ». La planche écrit « 40 places »
    // et ne pouvait pas montrer ce cas — c'est ce test qui l'a trouvé.
    await expect(vue.getByText('1 sur 1 place').first()).toBeVisible();
    await expect(vue.getByText(/sur la liste/)).toHaveCount(0);

    const autre = await page.context().browser()!.newContext();
    const autrePage = await autre.newPage();
    const invite = await connecterL1(autre, request, { displayName: 'Invité Éprouvé' });
    await repondre(request, invite.jeton, evenement.id, 'GOING');
    await visiter(autrePage, `/agenda/${evenement.id}`, 1440);
    const vueAutre = cadre(autrePage, 1440);
    await expect(vueAutre.getByText('COMPLET')).toBeVisible();
    await expect(vueAutre.getByText('Vous êtes 1e sur la liste')).toBeVisible();
    await autre.close();
  });
});

// ─── E03 · /agenda/nouveau ───────────────────────────────────────────────────

test.describe('E03 — créer un événement', () => {
  /**
   * LE QUOTA EST CELUI DU MEMBRE, et ce test le prouve par le cas que la maquette
   * ne peut PAS afficher : un membre qui n'a rien créé voit « 0 événement sur 1 ».
   * La planche écrit « 1 événement sur 1 » — donc un écran resté figé passerait un
   * test écrit sur « 1 », et échoue sur celui-ci.
   */
  for (const largeur of LARGEURS) {
    test(`${largeur} px — le quota affiché est celui du membre, pas celui de la planche`, async ({
      page,
      context,
      request,
    }) => {
      const membre = await connecterL1(context, request, { displayName: 'Fatim Sow' });

      await visiter(page, '/agenda/nouveau', largeur);
      const vue = cadre(page, largeur);
      await expect(vue.getByText('0 événement sur 1 ce mois-ci')).toBeVisible();

      // Après une création, le même écran dit « 1 ». La donnée bouge, le dessin non.
      await creerEvenement(request, membre.jeton, 'Apéro du quartier Croix-Rousse');
      await visiter(page, '/agenda/nouveau', largeur);
      await expect(cadre(page, largeur).getByText('1 événement sur 1 ce mois-ci')).toBeVisible();
    });
  }

  /**
   * 09 §3.1, RÈGLE DURE : « adresse en texte libre, jamais géolocalisée ». La
   * note est du TEXTE DE RÈGLE — vrai pour tout le monde, en tout temps — donc
   * elle n'est pas liée, et elle doit rester affichée.
   */
  test('1440 px — la note « jamais géolocalisée » reste affichée', async ({
    page,
    context,
    request,
  }) => {
    await connecterL1(context, request, { displayName: 'Fatim Sow' });
    await visiter(page, '/agenda/nouveau', 1440);
    await expect(
      page.getByText('Adresse en texte libre, jamais géolocalisée.'),
    ).toBeVisible();
  });
});

// ─── E04 · /agenda/:id/presence ──────────────────────────────────────────────

test.describe('E04 — la feuille de présence', () => {
  for (const largeur of LARGEURS) {
    test(`${largeur} px — les inscrits et le compteur viennent du serveur`, async ({
      page,
      context,
      request,
    }) => {
      const hote = await connecterL1(context, request, { displayName: 'Hôte Éprouvé' });
      const evenement = await creerEvenement(request, hote.jeton, 'Atelier couture du quartier');

      await visiter(page, `/agenda/${evenement.id}/presence`, largeur);
      const vue = cadre(page, largeur);

      await expect(vue.getByText(hote.displayName).first()).toBeVisible();

      /**
       * UN SEUL INSCRIT, AUCUN PRÉSENT : le compteur dit « 0 présent sur 1
       * inscrit » — au singulier, et c'est la donnée qui porte la marque du
       * pluriel. La planche écrit « 18 présents sur 23 inscrits » : un écran figé
       * ne peut pas satisfaire cette assertion.
       */
      if (largeur >= 1024) {
        await expect(vue.getByText('0 présent sur 1 inscrit')).toBeVisible();
      } else {
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Présence · 0 / 1');
      }

      const texte = await page.locator('body').innerText();
      for (const figé of ['Fatou Ndiaye', 'Kofi Boateng', '18 présents sur 23 inscrits']) {
        expect(texte, `« ${figé} » est encore dessiné`).not.toContain(figé);
      }
    });
  }

  /**
   * LA PRÉSENCE EST PRIVÉE (§5) : à qui n'organise pas, l'API n'envoie NI
   * `userId` NI `checkedIn`. L'écran ne doit donc dessiner AUCUNE case — ni
   * cochée, ni vide — et le compteur doit DISPARAÎTRE plutôt que d'annoncer zéro
   * présent, ce que le serveur n'a jamais dit. Ne pas savoir n'est pas dire non.
   *
   * La case est reconnue par sa GÉOMÉTRIE — 24 × 24 px, rayon 8 px — parce que la
   * maquette ne lui donne ni rôle ni texte, et c'est consigné.
   */
  test('1440 px — un non-organisateur ne voit ni case ni compteur de présence', async ({
    page,
    context,
    request,
  }) => {
    const hote = await connecterL1(context, request, { displayName: 'Hôte Éprouvé' });
    const evenement = await creerEvenement(request, hote.jeton, 'Permanence consulaire du mois');

    const cases = () =>
      page.evaluate(() => {
        const frame = document.querySelector('[data-frame="desktop"]')!;
        return [...frame.querySelectorAll<HTMLElement>('span')].filter(
          (el) => el.style.width === '24px' && el.style.borderRadius === '8px',
        ).length;
      });

    // L'organisateur voit SA feuille : une ligne, une case (vide, car personne
    // n'est encore coché — `checked_in` est faux, et c'est lui qui décide).
    await visiter(page, `/agenda/${evenement.id}/presence`, 1440);
    expect(await cases(), 'l’organisateur doit voir la case de chaque inscrit').toBe(1);
    await expect(page.getByText('0 présent sur 1 inscrit')).toBeVisible();

    const autre = await page.context().browser()!.newContext();
    const autrePage = await autre.newPage();
    const invite = await connecterL1(autre, request, { displayName: 'Invité Éprouvé' });
    await repondre(request, invite.jeton, evenement.id, 'GOING');
    await visiter(autrePage, `/agenda/${evenement.id}/presence`, 1440);

    const casesAutre = await autrePage.evaluate(() => {
      const frame = document.querySelector('[data-frame="desktop"]')!;
      return [...frame.querySelectorAll<HTMLElement>('span')].filter(
        (el) => el.style.width === '24px' && el.style.borderRadius === '8px',
      ).length;
    });
    expect(casesAutre, 'aucune case pour qui n’organise pas : la présence est privée').toBe(0);
    const texteAutre = await autrePage.locator('body').innerText();
    expect(texteAutre, 'le compteur de présence ne sort pas de la feuille de l’organisateur')
      .not.toMatch(/présents? sur \d+ inscrits?/);
    // Les inscrits, eux, restent visibles : §5 envoie les `GOING` à tout le monde.
    expect(texteAutre).toContain(invite.displayName);
    await autre.close();
  });
});

// ─── La géométrie de la maquette, qui ne doit pas bouger ─────────────────────

/**
 * Ces quatre mesures vivaient dans `entraide-agenda.spec.ts`. Elles ont déménagé
 * AVEC les écrans, et pas une n'a été perdue : ce sont les propriétés que la
 * maquette porte et qu'une image ne peut pas garantir.
 */
test.describe('la géométrie de la maquette', () => {
  test('1440 px — rail 76 px, colonne de contexte 300 px, et E04 sans colonne', async ({
    page,
    context,
    request,
  }) => {
    const hote = await connecterL1(context, request, { displayName: 'Hôte Éprouvé' });
    const evenement = await creerEvenement(request, hote.jeton, 'Foot entre membres du quartier');

    const routes = [
      { nom: 'E01', route: '/agenda', aside: 300 },
      { nom: 'E02', route: `/agenda/${evenement.id}`, aside: 300 },
      { nom: 'E03', route: '/agenda/nouveau', aside: 300 },
      // E04 est le seul écran sans colonne de contexte : la liste de présence
      // occupe toute la largeur. Contradiction assumée avec §10.1, consignée.
      { nom: 'E04', route: `/agenda/${evenement.id}/presence`, aside: null },
    ] as const;

    for (const { nom, route, aside } of routes) {
      await visiter(page, route, 1440);
      const rail = page.locator('[data-frame="desktop"] nav');
      await expect(rail, nom).toBeVisible();
      expect((await rail.boundingBox())?.width, nom).toBe(76);

      const contexte = page.locator('[data-frame="desktop"] aside');
      if (aside === null) {
        expect(await contexte.count(), `${nom} ne dessine pas de colonne de contexte`).toBe(0);
      } else {
        expect((await contexte.boundingBox())?.width, nom).toBe(aside);
      }
    }
  });

  /**
   * §10.1 borne le contenu à 660 px. E04 ne le fait pas — sa liste de présence
   * s'étire sur 1 016 px à 1 440. C'est la maquette qui en décide, et elle n'a pas
   * été réécrite : l'écart est MESURÉ ici plutôt que corrigé en silence.
   */
  test('1440 px — le contenu est borné à 660 px, sauf E04 que la maquette étire', async ({
    page,
    context,
    request,
  }) => {
    const hote = await connecterL1(context, request, { displayName: 'Hôte Éprouvé' });
    const evenement = await creerEvenement(request, hote.jeton, 'Apéro Diaspora du quartier');

    const larges: string[] = [];
    for (const [nom, route] of [
      ['E01', '/agenda'],
      ['E02', `/agenda/${evenement.id}`],
      ['E03', '/agenda/nouveau'],
      ['E04', `/agenda/${evenement.id}/presence`],
    ] as const) {
      await visiter(page, route, 1440);
      const box = await page.locator('[data-frame="desktop"] main').boundingBox();
      expect(box, nom).not.toBeNull();
      if (box !== null && box.width > 660) larges.push(`${nom} ${Math.round(box.width)}px`);
    }
    expect(larges).toEqual(['E04 1016px']);
  });

  /** T1 §2.3 — jamais d'ombre portée. T1 §2.4 — aucun emoji. */
  test('aucune ombre portée, aucun emoji, aucun débordement horizontal', async ({
    page,
    context,
    request,
  }) => {
    const hote = await connecterL1(context, request, { displayName: 'Hôte Éprouvé' });
    const evenement = await creerEvenement(request, hote.jeton, 'Permanence du quartier');

    const fautifs: string[] = [];
    for (const [nom, route] of [
      ['E01', '/agenda'],
      ['E02', `/agenda/${evenement.id}`],
      ['E03', '/agenda/nouveau'],
      ['E04', `/agenda/${evenement.id}/presence`],
    ] as const) {
      for (const largeur of [1440, 390] as const) {
        await visiter(page, route, largeur);
        const m = await page.evaluate(() => ({
          ombres: [...document.querySelectorAll<HTMLElement>('*')]
            .map((el) => getComputedStyle(el).boxShadow)
            .filter((s) => s !== 'none' && !s.includes('inset 0 0 0 0') && !/0 0 #0000/.test(s)),
          scroll: document.documentElement.scrollWidth,
          fenetre: window.innerWidth,
        }));
        const texte = await page.locator('body').innerText();
        if (m.ombres.length > 0) fautifs.push(`${nom} ${largeur} ombre ${m.ombres[0]}`);
        if (m.scroll > m.fenetre + 1) fautifs.push(`${nom} ${largeur} déborde ${m.scroll}`);
        if (/\p{Extended_Pictographic}/u.test(texte)) fautifs.push(`${nom} ${largeur} emoji`);
      }
    }
    expect(fautifs).toEqual([]);
  });

  /**
   * §10.1 — sur mobile le rail disparaît, la barre d'onglets porte « Compte », et
   * « Agenda » cède sa place : il reste atteignable depuis l'accueil.
   */
  test('390 px — E01 porte la barre d’onglets, et le rail a disparu', async ({
    page,
    context,
    request,
  }) => {
    await connecterL1(context, request, { displayName: 'Fatim Sow' });
    await visiter(page, '/agenda', 390, 844);

    const vue = page.locator('[data-frame="mobile"]');
    await expect(vue.locator('nav')).toHaveCount(0);

    /**
     * LA BARRE EST RECONNUE PAR SA GRILLE — cinq colonnes égales — et non par un
     * texte : « Agenda » est aussi le TITRE de cet écran sur mobile, donc le
     * chercher dans tout le cadre ne dirait rien de la barre. C'est précisément
     * l'assertion qui aurait été creuse ici.
     */
    const onglets = await page.evaluate(() => {
      const frame = document.querySelector('[data-frame="mobile"]')!;
      const grille = [...frame.querySelectorAll<HTMLElement>('div')].find(
        /**
         * `repeat(5,1fr)` RESSORT « repeat(5, 1fr) » : le CSSOM normalise ce que
         * React a posé, espace compris. La comparaison stricte échouait sur une
         * barre parfaitement dessinée — mesuré, puis assoupli à l'expression.
         */
        (el) => el.style.display === 'grid' && /^repeat\(5,\s*1fr\)$/.test(el.style.gridTemplateColumns),
      );
      return grille === undefined
        ? null
        : [...grille.children].map((c) => (c as HTMLElement).innerText.trim());
    });
    // §10.1 : Agenda cède sa place à Compte et reste atteignable depuis Accueil.
    expect(onglets).toEqual(['Accueil', 'Parcours', 'Entraide', 'Services', 'Compte']);
  });
});
