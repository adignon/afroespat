import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { connecter } from './session';
import {
  API_SERVICES,
  ENTREPRISE_OFFRE,
  INITIALES_MEMBRE,
  NOM_MEMBRE,
  PRENOM_MEMBRE,
  TITRE_ANNONCE,
  TITRE_OFFRE,
  installerSession,
  jeuDeServices,
  type JeuServices,
} from './services-donnees';

/**
 * Les dix écrans transcodés de `docs/template/06 Services.dc.html` — S01 à S10 —
 * et les quatre fenêtres que deux d'entre eux ouvrent.
 *
 * Ce que ces tests éprouvent n'est PAS le dessin : il est transcodé, donc il est
 * celui de la maquette par construction. Ils éprouvent ce qu'une image ne peut
 * pas contenir — la route qui mène à chaque planche, la bascule au bon seuil, ce
 * qui reste à l'écran quand la page défile, le titre que le lecteur d'écran
 * annonce, les états que l'URL choisit, et les SEPT RÈGLES DURES que ce module
 * doit rendre visibles :
 *
 *   · 10 §2.2 — le bandeau de non-paiement, affiché en permanence ;
 *   · 00 §49 — aucun compteur de vues, sur aucun contenu ;
 *   · 14 §17 — un seul encart partenaire, en pied de la section Logement ;
 *   · 10 §3.1 — la pastille « Sponsorisée », toujours visible ;
 *   · 10 §4.2 — « Fiche mise en avant » signalée, deux emplacements au plus ;
 *   · 10 §4.1 — le téléphone n'est jamais affiché sur une fiche pro ;
 *   · 10 §7  — l'aperçu du score de risque n'est jamais montré au membre.
 *
 * ── CE QUI A CHANGÉ AVEC LE BRANCHEMENT DE L'API ────────────────────────────
 *
 * CES ÉCRANS LISAIENT LA MAQUETTE : ils s'ouvraient sans session, et cette suite
 * n'avait pas besoin d'en ouvrir une. Depuis qu'ils lisent l'API, un écran sans
 * session n'affiche plus que « Chargement… » puis une invitation à se reconnecter
 * — et un test qui n'en ouvrirait pas mesurerait l'écran d'erreur en croyant
 * mesurer l'écran. C'est le genre de succès qui ne prouve rien.
 *
 * Chaque test pose donc la session du membre que `services-donnees.ts` crée, et
 * les assertions portent sur SES valeurs : « AK », « Awa », le titre de SON
 * annonce. Un test qui chercherait encore « Amina Diallo » ou « Studio meublé
 * Lyon 7e » — les textes DESSINÉS — passerait sans session et échouerait avec,
 * ce qui est le bon sens : ce qui s'affiche doit venir du serveur.
 *
 * ET LA MOITIÉ SYMÉTRIQUE EST ÉPROUVÉE AUSSI : les textes de la maquette doivent
 * avoir DISPARU. Sans elle, un écran qui n'aurait rien branché du tout passerait
 * la première moitié dès que le serveur enverrait par hasard la bonne valeur.
 *
 * ── CHAQUE RÈGLE DURE A ÉTÉ ÉPROUVÉE PAR MUTATION ───────────────────────────
 *
 * La règle cassée dans la SOURCE (déclaration d'écran, schéma partagé, ou
 * maquette temporairement modifiée puis rendue), la régénération relancée, le
 * test rejoué et vérifié ROUGE, puis tout remis. Le tableau des mutations est
 * dans le rapport de lot.
 *
 * DEUX RÈGLES D'ABSENCE PORTENT LEUR PROPRE PREUVE DE NON-VACUITÉ, et c'est pour
 * cela que ces tests existent : un détecteur qui cherche des mots et n'en trouve
 * jamais ne dit rien tant qu'on n'a pas montré qu'il SAIT en trouver.
 */

/** Ce fichier pilote lui-même ses tailles : un seul projet suffit. */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'piloté par le test');

/**
 * `waitUntil: 'load'` ET NON `'networkidle'`.
 *
 * Next précharge les liens visibles d'une page App Router : le réseau ne retombe
 * jamais au calme, et `page.goto` expire au bout de trente secondes sur un
 * message qui ne nomme pas la cause. C'est la même correction que
 * `e2e/entraide-agenda.spec.ts` a mesurée, et elle ne vaut, ici comme là-bas, que
 * pour ce fichier.
 *
 * ── L'ATTENTE DE L'ÉCRAN EST UN ÉCHEC NOMMÉ ─────────────────────────────────
 *
 * Depuis que ces écrans chargent, `page.goto` rend la main sur un document qui ne
 * porte encore que l'état d'attente. On attend donc `[data-screen]`, et SON
 * expiration est reformulée : une borne atteinte doit DIRE pourquoi elle l'a été,
 * sinon on lit « Timeout 20000ms exceeded » et on cherche le défaut dans la
 * géométrie. Trois bornes écrites à la main ont déjà menti dans ce dépôt ; celle-ci
 * nomme ses trois causes possibles.
 */
async function visiter(page: Page, route: string, width: number, height = 900): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto(route, { waitUntil: 'load' });
  try {
    await page.locator('[data-screen]').first().waitFor({ state: 'attached', timeout: 20_000 });
  } catch {
    const visible = (await page.locator('body').innerText()).slice(0, 200).replace(/\s+/g, ' ');
    throw new Error(
      `${route} à ${width} px n’a jamais monté son écran en 20 s. CE QUE LA PAGE AFFICHE DIT ` +
        `LAQUELLE des quatre causes c’est : « ${visible} ». ` +
        '« Chargement… » → la réponse n’est pas arrivée : soit l’API ne répond pas sur ' +
        'NEXT_PUBLIC_API_URL, soit la machine est saturée (mesuré : à trois serveurs de ' +
        'développement et un voisin à 100 % de CPU, la montée dépasse les 30 s du budget de ' +
        'Playwright). « Se reconnecter » → la session n’est pas posée. Un bandeau d’erreur → un ' +
        'schéma de réponse refuse la charge, et son nom est dans la console du navigateur.',
    );
  }
}

/**
 * ─── UN SEUL CONTEXTE DE NAVIGATEUR POUR TOUTE LA SUITE, ET C'EST OBLIGATOIRE ─
 *
 * La première version posait le cookie `dp_refresh` dans le contexte NEUF de
 * chaque test. Un test sur deux échouait, et la cause n'était ni la géométrie ni
 * l'écran : **le jeton de rafraîchissement TOURNE à chaque usage, et rejouer une
 * génération dépassée RÉVOQUE LA CHAÎNE** (01 §2.1, `AuthService.refresh`).
 *
 * Le déroulé, mesuré : le jeton d'accès vit en mémoire et meurt au rechargement,
 * donc chaque page repart du cookie — premier appel `401`, le transport rafraîchit
 * une fois, et le serveur ÉMET UN NOUVEAU COOKIE. Le test suivant reposait
 * l'ancien dans un contexte vierge : rejeu détecté, chaîne coupée, écran d'erreur.
 * Un navigateur réel ne fait jamais cela — il garde le cookie que le serveur vient
 * de poser.
 *
 * La suite se comporte donc comme un navigateur : UN contexte, UNE page, et la
 * rotation suit son cours. Playwright joue les tests d'un fichier en série dans un
 * processus de travail, et chaque test commence par `visiter()`, qui navigue — il
 * n'y a donc rien à isoler de plus.
 *
 * C'est aussi ce qui garde la suite sous le plafond d'OTP : `POST /auth/otp/request`
 * est limité à TROIS envois par NUMÉRO et par heure dans `AuthService`,
 * indépendamment de `RATE_LIMIT_ENABLED`, et le chemin L0 → L1 → L2 en consomme
 * exactement trois. Une session par test aurait été impossible, pas seulement lente.
 */
let partage: { readonly page: Page; readonly jeu: JeuServices } | null = null;

async function atelier(
  browser: Browser,
  request: APIRequestContext,
): Promise<{ readonly page: Page; readonly jeu: JeuServices }> {
  if (partage === null) {
    const contexte: BrowserContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      locale: 'fr-FR',
      timezoneId: 'Europe/Paris',
      colorScheme: 'light',
    });
    const jeu = await jeuDeServices(contexte, request);
    await installerSession(contexte, jeu);
    partage = { page: await contexte.newPage(), jeu };
  }
  return partage;
}

/**
 * ─── LE JEU EST CONSTRUIT DANS UN HOOK, ET PAS DANS LE PREMIER TEST ─────────
 *
 * `atelier()` est paresseux, donc le PREMIER test à l'appeler payait toute la
 * préparation — une douzaine d'appels d'API, deux SMS fictifs, un webhook signé —
 * DANS SON PROPRE BUDGET DE 30 SECONDES. Sur une machine chargée (trois autres
 * serveurs de développement et un processus voisin à 100 % de CPU, mesuré), ce
 * test expirait seul, et son message parlait de la bascule à 1024 px : il accusait
 * la géométrie d'une lenteur de préparation.
 *
 * Le `beforeAll` a son propre budget, qu'on porte explicitement à quatre minutes,
 * et aucun test ne paie plus pour les autres. Il prend un contexte d'API à lui :
 * la fixture `request` est à portée de TEST, pas de processus de travail, donc
 * elle n'existe pas ici — `playwright.request.newContext()` est l'équivalent au
 * bon niveau.
 */
test.beforeAll(async ({ browser, playwright }) => {
  test.setTimeout(240_000);
  const api = await playwright.request.newContext();
  await atelier(browser, api);
});

test.afterAll(async () => {
  await partage?.page.context().close();
  partage = null;
});

/** Le cadre visible à cette largeur — les deux sont dans le document. */
const cadre = (width: number) => (width >= 1024 ? '[data-frame="desktop"]' : '[data-frame="mobile"]');

/**
 * Les dix écrans, avec la ROUTE que la maquette écrit en légende de chaque
 * planche et le titre qu'elle dessine sur chaque cadre.
 *
 * `titreMobile` diffère parfois de `titreDesktop`, et c'est la maquette qui le
 * veut : S01, S04 et S06 titrent « Services » sur téléphone — l'en-tête mobile
 * range les trois rubriques sous le nom de la SECTION — et S08 abrège « Créer ma
 * fiche pro » en « Ma fiche pro ». Un titre uniformisé aurait gommé l'écart.
 *
 * TROIS TITRES SONT MAINTENANT DES DONNÉES : celui de S02 est le titre de
 * l'annonce, celui de S05 l'intitulé de l'offre, celui de S07 le nom du pro. Ils
 * viennent donc du JEU, c'est-à-dire du serveur — et c'est exactement ce que
 * `retitrerSurDonnees` permet côté générateur : un titre lié reste promu en `<h1>`.
 */
function ecrans(jeu: JeuServices) {
  return [
    {
      nom: 'S01',
      route: '/services/logement',
      titre: 'Annonces logement',
      titreMobile: 'Services',
    },
    {
      nom: 'S02',
      route: `/services/logement/${jeu.idAnnonce}`,
      titre: TITRE_ANNONCE,
      titreMobile: TITRE_ANNONCE,
    },
    {
      nom: 'S03',
      route: '/services/logement/nouveau',
      titre: 'Publier une annonce',
      titreMobile: 'Publier une annonce',
    },
    { nom: 'S04', route: '/services/emploi', titre: 'Bourses et emploi', titreMobile: 'Services' },
    {
      nom: 'S05',
      route: `/services/emploi/${jeu.idOffre}`,
      titre: TITRE_OFFRE,
      titreMobile: TITRE_OFFRE,
    },
    {
      nom: 'S06',
      route: '/services/annuaire',
      titre: 'Annuaire professionnel',
      titreMobile: 'Services',
    },
    {
      nom: 'S07',
      route: `/services/annuaire/${jeu.idFiche ?? 'aucune-fiche'}`,
      /** Le `<h1>` porte AUSSI la pastille de palier : on n'exige donc qu'un préfixe. */
      titre: null,
      titreMobile: null,
    },
    {
      nom: 'S08',
      route: '/services/annuaire/ma-fiche',
      titre: 'Créer ma fiche pro',
      titreMobile: 'Ma fiche pro',
    },
    { nom: 'S09', route: '/services/mes-annonces', titre: 'Mes annonces', titreMobile: 'Mes annonces' },
    { nom: 'S10', route: '/services/alertes', titre: 'Mes alertes', titreMobile: 'Mes alertes' },
  ] as const;
}

/** Les quatre écrans de LOGEMENT, ceux que 10 §2.2 vise. */
const LOGEMENT = ['S01', 'S02', 'S03', 'S09'] as const;

/**
 * Les écrans dont la route n'exige AUCUN identifiant.
 *
 * S07 en exige un, et aucune route de l'API ne sait créer une fiche pro
 * (`proofAssetId` obligatoire, aucune route d'envoi de média). Les balayages
 * généraux l'excluent donc quand l'annuaire est vide, et un test dédié ÉCHOUE en
 * le disant — plutôt que de laisser les balayages passer sur un écran d'erreur.
 */
const SANS_FICHE = ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S08', 'S09', 'S10'] as const;

// ─── Ce que le branchement doit faire, et qu'aucune géométrie ne dirait ──────

test.describe('les écrans affichent les données du SERVEUR, et plus celles de la maquette', () => {
  /**
   * LE BANDEAU D'IDENTITÉ, sur les dix cadres d'ordinateur.
   *
   * C'est la preuve la plus simple et la plus large du branchement : les dix
   * planches dessinent « AD » et « Amina ». Le membre créé s'appelle « Awa
   * Konaté ». Si l'écran affiche encore « AD », rien n'est branché — et si le
   * `fois` de la déclaration d'écran cessait de tomber juste, la génération se
   * serait arrêtée avant d'arriver ici.
   */
  for (const nom of SANS_FICHE) {
    test(`${nom} — l’avatar et le prénom sont ceux du membre créé, pas ceux dessinés`, async ({ browser, request }) => {
      const { page, jeu } = await atelier(browser, request);
      const ecran = ecrans(jeu).find((e) => e.nom === nom)!;
      await visiter(page, ecran.route, 1440);

      /**
       * ── LA MESURE PORTE SUR L'ÉLÉMENT LIÉ, PAS SUR LE TEXTE DE LA PAGE ──────
       *
       * Première version : `innerText()` du cadre, puis `not.toContain('AD')`.
       * Elle a échoué sur S04 — et son échec était un FAUX POSITIF instructif.
       * La colonne « PROFILS DISPONIBLES » y affiche de VRAIES données, et l'un
       * des profils de la base appartient à une « Amina Diallo » : l'écran
       * montrait donc « AD » et « Amina D. » venus du SERVEUR, exactement ce
       * qu'on voulait prouver, et le test les prenait pour les textes de la
       * maquette.
       *
       * La leçon vaut au-delà de ce cas : les exemples d'une maquette sont des
       * noms PLAUSIBLES, donc des valeurs que le serveur peut légitimement
       * renvoyer. « Le texte dessiné a disparu » ne se vérifie pas par une
       * sous-chaîne sur toute la page — il se vérifie SUR L'ÉLÉMENT QU'ON A LIÉ.
       *
       * L'avatar de la barre haute est reconnu par sa géométrie — un rond de
       * 38 px — comme le reste de cette suite reconnaît ce que la maquette ne
       * nomme pas. Son voisin immédiat porte le prénom.
       */
      const bandeau = await page.evaluate(() => {
        const frame = document.querySelector('[data-frame="desktop"]');
        if (frame === null) return null;
        const avatar = [...frame.querySelectorAll<HTMLElement>('span')].find((el) => {
          const s = getComputedStyle(el);
          return (
            s.width === '38px' && s.height === '38px' && s.borderTopLeftRadius.startsWith('999')
          );
        });
        if (avatar === undefined) return null;
        return {
          initiales: avatar.textContent?.trim() ?? '',
          prenom: avatar.nextElementSibling?.textContent?.trim() ?? '',
        };
      });

      expect(bandeau, `${nom} : l’avatar de 38 px de la barre haute est introuvable`).not.toBeNull();
      expect(
        bandeau?.initiales,
        `${nom} : l’avatar doit porter les initiales de ${NOM_MEMBRE}, pas celles dessinées`,
      ).toBe(INITIALES_MEMBRE);
      expect(
        bandeau?.prenom,
        `${nom} : la barre haute doit porter le prénom du membre, pas celui dessiné`,
      ).toBe(PRENOM_MEMBRE);
    });
  }

  /**
   * LE QUOTA DU MOIS, et il est à zéro pour un membre neuf.
   *
   * La maquette écrit « 2 contacts pro sur 3 » et dessine sa barre à 66 %. Le
   * membre créé n'a contacté personne : le texte doit dire « 0 contacts pro sur
   * 3 » ET la barre tomber à 0 %. Lier le seul texte aurait laissé une barre aux
   * deux tiers au-dessus d'un zéro — une interface qui se contredit à l'œil.
   */
  test('S01 — le quota et SA BARRE viennent de /me/subscription, et ils s’accordent', async ({ browser, request }) => {
    const { page, jeu } = await atelier(browser, request);
    await visiter(page, '/services/logement', 1440);

    const frame = page.locator('[data-frame="desktop"]');
    await expect(frame.getByText('0 contacts pro sur 3')).toBeVisible();
    await expect(frame.getByText('2 contacts pro sur 3')).toHaveCount(0);

    const largeur = await page.evaluate(() => {
      const barre = [...document.querySelectorAll<HTMLElement>('[data-frame="desktop"] *')].find(
        (el) => getComputedStyle(el).backgroundColor === 'rgb(224, 115, 58)' && el.style.width !== '',
      );
      return barre?.style.width ?? null;
    });
    expect(largeur, 'la barre du quota est introuvable').not.toBeNull();
    expect(largeur, 'la barre doit suivre le quota, pas rester à 66 % comme la maquette').toBe('0%');
  });

  /**
   * S01 — LA LISTE EST CELLE DU SERVEUR.
   *
   * L'annonce publiée par le membre doit y figurer, et les six titres dessinés
   * par la maquette doivent avoir disparu — tous les six, parce que la liste est
   * une BOUCLE : si elle n'avait pas été liée, les six seraient encore là.
   */
  test('S01 — la liste porte l’annonce publiée, et aucune des six annonces dessinées', async ({ browser, request }) => {
    const { page, jeu } = await atelier(browser, request);
    await visiter(page, '/services/logement', 1440);

    const texte = await page.locator('[data-frame="desktop"]').innerText();
    expect(texte).toContain(jeu.titreAnnonce);
    /**
     * LES SIX TITRES, ET AUCUN NOM DE PERSONNE.
     *
     * Les titres d'annonce de la maquette sont du CONTENU : personne ne publiera
     * « Coloc étudiante Guillotière » par hasard, donc leur présence prouverait
     * que la boucle n'est pas liée. Ses noms d'auteur, eux, sont des noms
     * PLAUSIBLES — « Ibrahim S. » peut parfaitement être un membre réel — et les
     * chercher reviendrait à interdire au serveur d'envoyer un nom que la
     * maquette a choisi. Le faux positif que S04 a produit sur « AD » est la
     * version mesurée de cette erreur.
     */
    for (const dessine of [
      'Chambre à Villeurbanne',
      'Hébergement 2 semaines',
      'T2 lumineux Lyon 3e',
      'Coloc étudiante Guillotière',
      'Studio Croix-Rousse',
    ]) {
      expect(texte, `« ${dessine} » est encore dessiné : la boucle n’est pas liée`).not.toContain(
        dessine,
      );
    }
  });

  /**
   * S02 — LE TITRE DE LA PAGE EST UNE DONNÉE, sur LES DEUX cadres.
   *
   * `ScreenFrames` rend les deux cadres et n'en masque qu'un : lier le titre sur
   * l'ordinateur seulement laisserait « Studio meublé Lyon 7e » écrit en dur dans
   * le document servi, donc dans ce que lit un test, un moteur de recherche ou un
   * lecteur d'écran sur téléphone. La moitié de l'écran mentirait.
   */
  for (const width of [1440, 390] as const) {
    test(`S02 ${width} px — le titre et l’auteur viennent de l’API`, async ({ browser, request }) => {
      const { page, jeu } = await atelier(browser, request);
      await visiter(page, `/services/logement/${jeu.idAnnonce}`, width);

      const frame = page.locator(cadre(width));
      await expect(frame.getByRole('heading', { level: 1 })).toHaveText(jeu.titreAnnonce);
      const texte = await frame.innerText();
      expect(texte, 'l’auteur de l’annonce est le membre créé').toContain(NOM_MEMBRE);
      /**
       * Le TITRE dessiné, et pas le NOM dessiné : « Studio meublé Lyon 7e » est du
       * contenu que personne ne republiera par hasard, alors que « Sarah Traoré »
       * est un nom plausible que le serveur peut légitimement envoyer. Chercher le
       * second produirait le faux positif que S04 a mesuré sur « AD ».
       */
      expect(texte, 'le titre dessiné est encore là').not.toContain('Studio meublé Lyon 7e');
    });
  }

  /**
   * S04 — LA LISTE DES OFFRES EST CELLE DU SERVEUR.
   *
   * L'offre publiée doit y figurer avec SON entreprise, et les trois offres
   * dessinées avoir disparu.
   */
  test('S04 — la liste porte l’offre publiée, et aucune des trois offres dessinées', async ({ browser, request }) => {
    const { page, jeu } = await atelier(browser, request);
    await visiter(page, '/services/emploi', 1440);

    const texte = await page.locator('[data-frame="desktop"]').innerText();
    expect(texte).toContain(jeu.titreOffre);
    expect(texte).toContain(ENTREPRISE_OFFRE);
    for (const dessine of ['Développeur·se web', 'Bourse de mobilité 2026', 'Studio Kora']) {
      expect(texte, `« ${dessine} » est encore dessiné : la boucle n’est pas liée`).not.toContain(
        dessine,
      );
    }
    /** §3.1 : « Partagée par … » est composée par le SERVEUR, pas par l'écran. */
    expect(texte).toContain(`Partagée par ${NOM_MEMBRE}`);
    expect(texte).not.toContain('Partagée par Sandra M.');
  });

  /**
   * S09 — MES ANNONCES, ET LE COMPTEUR QUI VA AVEC.
   *
   * Le membre a publié UNE annonce et UNE offre : les onglets doivent dire
   * « Logement · 1 » et « Emploi · 1 », là où la maquette écrit 2 et 1. Le second
   * tombe juste par coïncidence — raison de plus de vérifier le premier.
   */
  test('S09 — les compteurs et la liste sont ceux du membre', async ({ browser, request }) => {
    const { page, jeu } = await atelier(browser, request);
    await visiter(page, '/services/mes-annonces', 1440);

    const frame = page.locator('[data-frame="desktop"]');
    await expect(frame.getByText('Logement · 1')).toBeVisible();
    await expect(frame.getByText('Logement · 2'), 'le compteur dessiné est encore là').toHaveCount(
      0,
    );
    const texte = await frame.innerText();
    expect(texte).toContain(jeu.titreAnnonce);
    expect(texte, 'une annonce dessinée est encore là').not.toContain('Coloc Guillotière');
  });

  /**
   * S10 — L'ENCART « SANS PREMIUM » OBÉIT AU SERVEUR.
   *
   * Le membre créé est gratuit : `GET /me/alerts` rend `items: []` et
   * `meta.isPremium: false`. L'encart doit donc être là, et les deux alertes
   * dessinées avoir disparu. C'est la preuve que le `<sc-if>` lit bien le serveur
   * et non une constante du front.
   */
  test('S10 — aucune alerte dessinée ne subsiste, et l’encart Premium est là', async ({ browser, request }) => {
    const { page, jeu } = await atelier(browser, request);
    await visiter(page, '/services/alertes', 1440);

    const frame = page.locator('[data-frame="desktop"]');
    await expect(frame.getByText('Sans Premium')).toBeVisible();
    const texte = await frame.innerText();
    expect(texte, 'une alerte dessinée est encore là').not.toContain('Logement · Colocation');
    expect(texte, 'une alerte dessinée est encore là').not.toContain('Emploi · Alternance');
  });

  /**
   * S07 — LA FICHE PRO, ET POURQUOI CE TEST PEUT ÉCHOUER SANS QUE L'ÉCRAN SOIT EN
   * CAUSE.
   *
   * Aucune route de l'API ne sait créer une fiche pro : `PUT /me/pro-profile`
   * exige `proofAssetId` à la création (§4.1) et IL N'EXISTE AUCUNE ROUTE D'ENVOI
   * DE MÉDIA dans toute l'API. La suite prend donc la première fiche existante.
   *
   * S'il n'y en a aucune, ce test ÉCHOUE EN LE DISANT. Un `test.skip()` aurait été
   * le choix confortable et c'est exactement celui qu'il faut refuser : un écran
   * jamais éprouvé passerait pour éprouvé, et le manque de route cesserait d'être
   * visible.
   */
  test('S07 — le nom affiché est celui de la fiche réelle', async ({ browser, request }) => {
    const { page, jeu } = await atelier(browser, request);
    expect(
      jeu.idFiche,
      'l’annuaire est vide, et la suite ne peut pas créer de fiche : `PUT /me/pro-profile` ' +
        'exige `proofAssetId` (10 §4.1) et AUCUNE route d’envoi de média n’existe dans l’API. ' +
        'Écart remonté au porteur. En attendant, seedez une fiche pro.',
    ).not.toBeNull();
    if (jeu.idFiche === null || jeu.nomFiche === null) return;
    await visiter(page, `/services/annuaire/${jeu.idFiche}`, 1440);

    const frame = page.locator('[data-frame="desktop"]');
    const h1 = frame.getByRole('heading', { level: 1 });
    await expect(h1).toContainText(jeu.nomFiche);
    expect(
      await frame.innerText(),
      '« Me Mariam Bah » est encore dessiné : la fiche n’est pas liée',
    ).not.toContain('Me Mariam Bah');
  });
});

// ─── Les routes et le titre de page ──────────────────────────────────────────

/**
 * La maquette n'écrit AUCUN `<h2>` — zéro dans tout le fichier, compté. Le titre
 * de page est donc DÉCLARÉ avec le cadre (`tools/screens/06-services.mjs`) et
 * promu en `<h1>` au transcodage.
 *
 * Ce test vérifie les deux moitiés de cette promesse : qu'il y a UN titre, et que
 * c'est celui que la maquette affiche — pas un titre inventé pour la route. C'est
 * exactement le défaut qui a coûté A01.
 */
test.describe('les dix routes du module', () => {
  for (const nom of SANS_FICHE) {
    test(`${nom} rend son écran et porte SON titre, aux deux largeurs`, async ({ browser, request }) => {
      const { page, jeu } = await atelier(browser, request);
      const ecran = ecrans(jeu).find((e) => e.nom === nom)!;

      for (const { width, titre } of [
        { width: 1440, titre: ecran.titre },
        { width: 390, titre: ecran.titreMobile },
      ]) {
        await visiter(page, ecran.route, width);
        await expect(page.locator(`[data-screen="${ecran.nom}"]`)).toHaveCount(1);

        /**
         * Le titre est cherché par RÔLE, dans le cadre VISIBLE.
         *
         * `ScreenFrames` rend les deux cadres et en masque un par CSS : le `<h1>`
         * du cadre masqué ne compte pas pour un lecteur d'écran, et `getByRole`
         * l'ignore — mais le scoper au cadre visible rend l'échec lisible.
         */
        const h1 = page.locator(cadre(width)).getByRole('heading', { level: 1 });
        if (titre === null) {
          await expect(h1, `${ecran.route} à ${width} px`).not.toHaveText('');
        } else {
          await expect(h1, `${ecran.route} à ${width} px`).toHaveText(titre);
        }
      }
    });
  }

  /**
   * UNE PLANCHE, DEUX ROUTES — et le branchement les a SÉPARÉES.
   *
   * La légende de S05 dit « /services/emploi/:id · /nouveau », et son cadre porte
   * le détail de l'offre à gauche et le formulaire « PUBLIER UNE OFFRE » à droite.
   * Tant que l'écran lisait la maquette, les deux routes pouvaient partager la
   * planche. Avec l'API, `/nouveau` n'a aucune offre à charger : il est devenu un
   * segment STATIQUE, qui gagne sur `[id]` dans le routeur. Sans lui, il partait
   * chercher l'offre d'identifiant « nouveau » — un `400`.
   *
   * Le test dit donc les deux choses : la route mène bien à S05 avec son
   * formulaire, ET son titre est celui que la maquette écrit pour cette colonne.
   */
  test('/services/emploi/nouveau tombe sur S05, séparé de la route :id', async ({ browser, request }) => {
    const { page, jeu } = await atelier(browser, request);
    await visiter(page, '/services/emploi/nouveau', 1440);

    await expect(page.locator('[data-screen="S05"]')).toHaveCount(1);
    /**
     * `exact: true` ET scopé au cadre d'ordinateur, et les deux sont nécessaires
     * depuis que le titre est une donnée : `getByText('PUBLIER UNE OFFRE')` compare
     * SANS tenir compte de la casse, donc il attrapait aussi le `<h1>` « Publier
     * une offre » de cette route — trois éléments au lieu d'un, et Playwright
     * refuse en mode strict. Le libellé de la colonne, lui, est en capitales dans
     * la maquette.
     */
    const frame = page.locator('[data-frame="desktop"]');
    await expect(frame.getByText('PUBLIER UNE OFFRE', { exact: true })).toBeVisible();
    await expect(frame.getByRole('button', { name: 'Publier l’offre' })).toBeVisible();
    await expect(frame.getByRole('heading', { level: 1 })).toHaveText('Publier une offre');
  });
});

// ─── La bascule de cadre ─────────────────────────────────────────────────────

test.describe('la bascule ordinateur/mobile a lieu à 1024 px', () => {
  test('1023 px montre le cadre mobile, 1024 le cadre ordinateur', async ({ browser, request }) => {
    const { page, jeu } = await atelier(browser, request);
    for (const { w, attendu } of [
      { w: 1023, attendu: 'mobile' },
      { w: 1024, attendu: 'desktop' },
    ] as const) {
      await visiter(page, '/services/logement', w);
      await expect(page.locator(`[data-frame="${attendu}"]`), `${w} px`).toBeVisible();
      const autre = attendu === 'mobile' ? 'desktop' : 'mobile';
      await expect(page.locator(`[data-frame="${autre}"]`), `${w} px`).toBeHidden();
    }
  });

  test('les dix écrans portent bien LEURS deux cadres', async ({ browser, request }) => {
    const { page, jeu } = await atelier(browser, request);
    for (const nom of SANS_FICHE) {
      const ecran = ecrans(jeu).find((e) => e.nom === nom)!;
      await visiter(page, ecran.route, 1440);
      await expect(page.locator('[data-frame="desktop"]'), nom).toHaveCount(1);
      await expect(page.locator('[data-frame="mobile"]'), nom).toHaveCount(1);
    }
  });
});

// ─── Ce qui reste à l'écran quand la page défile ─────────────────────────────

/**
 * EXIGENCE DU PORTEUR : le panneau de gauche, la colonne de droite et l'en-tête
 * de recherche RESTENT À L'ÉCRAN pendant que le fil défile.
 *
 * La maquette ne l'exprime pas : c'est une image, rien n'y défile. Ce sont donc
 * des ADAPTATIONS, faites dans le générateur pour qu'elles survivent à la
 * régénération, et ces tests sont ce qui les tient.
 */
test.describe('le défilement — ordinateur', () => {
  /** Les cinq écrans que la maquette dote d'une colonne de contexte. */
  const AVEC_ASIDE = ['S02', 'S03', 'S04', 'S07', 'S10'];

  for (const nom of SANS_FICHE) {
    test(`${nom} — la barre haute et les colonnes suivent`, async ({ browser, request }) => {
      const { page, jeu } = await atelier(browser, request);
      const ecran = ecrans(jeu).find((e) => e.nom === nom)!;

      /**
       * UNE FENÊTRE DE 240 px DE HAUT, et la mesure est ce qui l'a fixée — DEUX
       * FOIS, à deux lots de distance.
       *
       * Au lot précédent c'était 400 px : les cadres de la maquette vont de 628 px
       * à 955 px, et dans une fenêtre de 900 px la moitié d'entre eux ne défilait
       * pas du tout — un test qui ne défile pas ne prouve rien sur ce qui reste à
       * l'écran quand on défile.
       *
       * LE BRANCHEMENT A RACCOURCI LES PAGES, et 400 px ne suffisait plus. Les
       * listes réelles sont plus courtes que celles que la maquette dessine : à
       * 1440 × 400, le document de S09 fait exactement 400 px (marge 0), celui de
       * S06 421 px (marge 21) et celui de S10 479 px (marge 79) — relevé au
       * navigateur. Trois tests échouaient, et leur message le disait : « pas assez
       * de marge pour défiler ». C'est la borne qui était fausse, pas l'écran.
       *
       * À 240 px, la marge mesurée est de 128 px (S09), 181 px (S06), 239 px (S10)
       * et de plusieurs milliers sur les listes longues. La garde ci-dessous reste
       * donc la vraie protection : si une page redevient trop courte, elle
       * ÉCHOUE EN LE DISANT plutôt que de mesurer un défilement qui n'a pas eu lieu.
       */
      await visiter(page, ecran.route, 1440, 240);

      const marge = await page.evaluate(
        () => document.documentElement.scrollHeight - window.innerHeight,
      );
      const defilement = Math.min(250, marge);
      // La colonne de contexte part à 76 px : il faut la dépasser, sinon une
      // colonne qui suivrait le défilement resterait quand même visible et le
      // test serait muet.
      expect(defilement, `${nom} : pas assez de marge pour défiler`).toBeGreaterThan(116);

      await page.evaluate((y) => window.scrollTo(0, y), defilement);
      await page.waitForTimeout(150);

      const p = await page.evaluate(() => {
        const frame = document.querySelector('[data-frame="desktop"]')!;
        const haut = (el: Element | null) =>
          el === null ? null : Math.round(el.getBoundingClientRect().top);
        const rail = frame.querySelector('nav');
        /**
         * La barre haute est reconnue par sa GÉOMÉTRIE, pas par un sélecteur : la
         * maquette ne lui donne ni rôle ni texte propre. C'est la rangée de 64 px
         * qui contient le champ « Rechercher dans la diaspora ».
         */
        const recherche = [...frame.querySelectorAll<HTMLElement>('*')].find(
          (el) => el.textContent?.trim() === 'Rechercher dans la diaspora',
        );
        const barre = recherche?.parentElement ?? null;
        return {
          defile: Math.round(window.scrollY),
          colonneGauche: haut(rail?.parentElement?.parentElement ?? null),
          barreHaute: haut(barre),
          colonneDroite: haut(frame.querySelector('aside')),
        };
      });

      expect(p.defile, 'la page doit avoir défilé').toBe(defilement);

      /**
       * Sans `sticky`, la colonne serait remontée de tout le défilement — à
       * −250 px. La tolérance d'un pixel n'est pas de la complaisance : le haut
       * mesuré vaut parfois −0,3 px, et `Math.round` en fait un `-0` que
       * `toBe(0)` refuse.
       */
      expect(p.colonneGauche, 'la colonne de gauche a suivi').toBeGreaterThan(-2);
      expect(p.colonneGauche, 'la colonne de gauche a suivi').toBeLessThan(2);

      // L'en-tête de recherche est collé en haut de la fenêtre.
      expect(p.barreHaute, 'la barre haute est introuvable').not.toBeNull();
      expect(p.barreHaute, 'la barre haute a suivi').toBeGreaterThan(-2);
      expect(p.barreHaute, 'la barre haute a suivi').toBeLessThan(2);

      if (AVEC_ASIDE.includes(nom)) {
        expect(p.colonneDroite, `${nom} doit avoir une colonne de contexte`).not.toBeNull();
        /**
         * Elle s'arrête SOUS la barre haute, à 76 px — sauf tout en bas de page,
         * où la fin de sa rangée la pousse vers le haut. L'assertion est donc
         * écrite comme la propriété l'est : elle n'a pas suivi le défilement.
         * Sans `sticky` elle serait à `76 − défilement`, c'est-à-dire négative.
         */
        expect(p.colonneDroite, 'la colonne de contexte est restée visible').toBeGreaterThanOrEqual(
          0,
        );
        expect(p.colonneDroite, 'la colonne de contexte a suivi le défilement').toBeGreaterThan(
          76 - defilement + 20,
        );
        expect(p.colonneDroite, 'elle ne descend pas sous la barre haute').toBeLessThanOrEqual(76);
      } else {
        // Cinq écrans n'en ont pas : la maquette y étire le contenu sur toute la
        // largeur. Le dire ici empêche qu'une colonne apparaisse sans qu'on le voie.
        expect(p.colonneDroite, `${nom} n’a pas de colonne de contexte`).toBeNull();
      }
    });
  }
});

test.describe('le défilement — mobile', () => {
  /**
   * LA BARRE D'ONGLETS BASSE.
   *
   * L'assertion est PUREMENT GÉOMÉTRIQUE, et prise en HAUT de page : si la barre
   * n'était pas collante, son bas serait à la hauteur du document — plusieurs
   * centaines de pixels sous la fenêtre. La mesurer après avoir défilé jusqu'en
   * bas n'aurait rien prouvé : à cet endroit, une barre statique est visible
   * aussi. C'est la leçon que `e2e/entraide-agenda.spec.ts` a payée — son premier
   * test passait au vert avec le défaut.
   *
   * CINQ CADRES MOBILES SEULEMENT en portent une : S01, S04, S06, S09 et S10. Les
   * cinq autres sont des écrans de détail ou de formulaire, avec une flèche de
   * retour ou une croix. La liste est ÉPINGLÉE et tombe dans les deux sens.
   */
  const AVEC_ONGLETS = ['S01', 'S04', 'S06', 'S09', 'S10'];

  /**
   * S10 NE DÉFILE PLUS SUR TÉLÉPHONE, et ce n'est pas un défaut d'écran.
   *
   * Avec les données de la maquette, son cadre mobile dessinait deux alertes et une
   * note : la page dépassait la fenêtre, et la nature COLLANTE de la barre
   * d'onglets se mesurait. Avec l'API, un membre gratuit n'a AUCUNE alerte —
   * `POST /me/alerts` répond `422 PLAN_REQUIRED` (§2.4) et aucune route n'accorde
   * Premium sans paiement. Le document fait alors exactement la hauteur de la
   * fenêtre (240 px pour 240), relevé au navigateur.
   *
   * Sur une page qui ne défile pas, une barre STATIQUE est au bas de la fenêtre
   * elle aussi : l'assertion passerait en ne prouvant rien. Plutôt que de la
   * laisser devenir creuse, cet écran est épinglé ICI, avec sa raison — et le test
   * affirme l'INVERSE : que sa page ne dépasse pas la fenêtre. Le jour où elle
   * dépassera (plus de contenu, ou une suite capable d'acheter Premium), ce test
   * échouera et dira de remettre S10 dans la mesure.
   */
  const SANS_DEFILEMENT = ['S10'];

  for (const nom of SANS_FICHE) {
    test(`${nom} — la barre d’onglets reste au bas de la fenêtre`, async ({ browser, request }) => {
      const { page, jeu } = await atelier(browser, request);
      const ecran = ecrans(jeu).find((e) => e.nom === nom)!;
      await visiter(page, ecran.route, 390, 240);

      const p = await page.evaluate(() => {
        const frame = document.querySelector('[data-frame="mobile"]')!;
        const onglet = [...frame.querySelectorAll<HTMLElement>('*')].find(
          (el) => el.textContent?.trim() === 'Compte' && el.children.length > 0,
        );
        const barre = onglet?.parentElement ?? null;
        return {
          hauteurDoc: document.documentElement.scrollHeight,
          fenetre: window.innerHeight,
          basBarre: barre === null ? null : Math.round(barre.getBoundingClientRect().bottom),
          defilement: Math.round(window.scrollY),
        };
      });

      if (!AVEC_ONGLETS.includes(nom)) {
        expect(p.basBarre, `${nom} n’a pas de barre d’onglets`).toBeNull();
        return;
      }

      if (SANS_DEFILEMENT.includes(nom)) {
        /**
         * L'affirmation INVERSE, et elle tombe dans les deux sens : tant que cette
         * page tient dans la fenêtre, sa barre collante n'est pas mesurable, et on
         * le DIT au lieu de laisser une assertion vraie par accident.
         */
        expect(
          p.hauteurDoc,
          `${nom} dépasse maintenant la fenêtre : sa barre d’onglets est mesurable, ` +
            'retirez-le de SANS_DEFILEMENT et laissez le test l’éprouver.',
        ).toBeLessThanOrEqual(p.fenetre);
        /**
         * ON N'AFFIRME PAS SA POSITION, et c'est le fond du problème : sur une page
         * qui ne défile pas, la barre se pose à la fin du contenu — 208 px dans une
         * fenêtre de 240, mesuré. « Collée au bas de la fenêtre » n'a pas de sens
         * ici, et l'exiger quand même produirait un test qui échoue sur un écran
         * conforme. On exige seulement qu'elle EXISTE : si elle disparaissait, ce
         * cas le dirait.
         */
        expect(p.basBarre, `${nom} doit quand même porter sa barre d’onglets`).not.toBeNull();
        return;
      }

      expect(
        p.hauteurDoc,
        'la page doit dépasser la fenêtre, sinon rien à prouver',
      ).toBeGreaterThan(p.fenetre);
      expect(p.defilement, 'on mesure en haut de page').toBe(0);
      expect(p.basBarre, 'la barre est collée au bas de la FENÊTRE').toBe(p.fenetre);
    });
  }

  /**
   * LE BOUTON FLOTTANT DE PUBLICATION, sur les deux écrans qui en dessinent un.
   *
   * Dans la maquette il est `position: absolute` dans un cadre de 844 px. Dans
   * l'application, le conteneur du cadre mobile fait la hauteur de TOUTE la page :
   * le bouton se posait à 108 px du bas du DOCUMENT, donc invisible tant qu'on
   * n'avait pas déroulé la liste entière.
   *
   * Il est reconnu par sa GÉOMÉTRIE — 56 × 56 px, contre le bord droit — et non
   * par un sélecteur : la maquette ne lui donne ni texte ni rôle.
   */
  for (const nom of ['S01', 'S04'] as const) {
    test(`${nom} — le bouton flottant reste au-dessus de la barre d’onglets`, async ({ browser, request }) => {
      const { page, jeu } = await atelier(browser, request);
      const ecran = ecrans(jeu).find((e) => e.nom === nom)!;
      await visiter(page, ecran.route, 390, 400);

      const mesure = async () =>
        page.evaluate(() => {
          const frame = document.querySelector('[data-frame="mobile"]')!;
          const el = [...frame.querySelectorAll<HTMLElement>('*')].find((n) => {
            const b = n.getBoundingClientRect();
            return Math.round(b.width) === 56 && Math.round(b.height) === 56;
          });
          if (el === undefined) return null;
          const b = el.getBoundingClientRect();
          return {
            bas: Math.round(b.bottom),
            droite: Math.round(b.right),
            fenetre: window.innerHeight,
            largeur: window.innerWidth,
          };
        });

      const avant = await mesure();
      expect(avant, 'le bouton flottant de 56 px est introuvable').not.toBeNull();
      if (avant === null) return;

      // 108 px au-dessus du bas de la FENÊTRE — pas du document.
      expect(avant.bas).toBe(avant.fenetre - 108);
      expect(avant.droite).toBe(avant.largeur - 18);

      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(150);
      const apres = await mesure();
      expect(apres?.bas, 'il ne bouge pas quand la page défile').toBe(avant.bas);
    });
  }
});

// ─── Les colonnes de la maquette ─────────────────────────────────────────────

test.describe('les largeurs de la maquette', () => {
  test('le rail fait 76 px sur les cadres d’ordinateur', async ({ browser, request }) => {
    const { page, jeu } = await atelier(browser, request);
    for (const nom of SANS_FICHE) {
      const ecran = ecrans(jeu).find((e) => e.nom === nom)!;
      await visiter(page, ecran.route, 1440);
      const rail = page.locator('[data-frame="desktop"] nav');
      await expect(rail, nom).toBeVisible();
      expect((await rail.boundingBox())?.width, nom).toBe(76);
    }
  });

  test('la colonne de contexte fait 300 px là où la maquette en dessine une', async ({ browser, request }) => {
    const { page, jeu } = await atelier(browser, request);
    const avec: string[] = [];
    for (const nom of SANS_FICHE) {
      const ecran = ecrans(jeu).find((e) => e.nom === nom)!;
      await visiter(page, ecran.route, 1440);
      const aside = page.locator('[data-frame="desktop"] aside');
      if ((await aside.count()) === 0) continue;
      avec.push(nom);
      expect((await aside.boundingBox())?.width, nom).toBe(300);
    }
    // Épinglé dans les deux sens : un écran qui gagnerait ou perdrait sa colonne
    // se signalerait ici. S07 est hors de ce balayage (voir `SANS_FICHE`).
    expect(avec).toEqual(['S02', 'S03', 'S04', 'S10']);
  });

  /**
   * §10.1 borne le contenu à 660 px. CINQ écrans sur dix l'écrivent dans leur
   * `<main>` ; les cinq autres ne le font pas — leurs grilles et leurs tableaux
   * s'étirent sur 1 016 px à 1 440. C'est la maquette qui en décide, et elle n'a
   * pas été réécrite : l'écart est mesuré ici plutôt que corrigé en silence.
   *
   * La liste tombe dans les deux sens : si un sixième écran s'étire, et le jour où
   * la maquette bornera les cinq.
   */
  test('le contenu est borné à 660 px, sauf les écrans que la maquette étire', async ({ browser, request }) => {
    const { page, jeu } = await atelier(browser, request);
    const larges: string[] = [];
    for (const nom of SANS_FICHE) {
      const ecran = ecrans(jeu).find((e) => e.nom === nom)!;
      await visiter(page, ecran.route, 1440);
      const box = await page.locator('[data-frame="desktop"] main').boundingBox();
      expect(box, nom).not.toBeNull();
      if (box !== null && box.width > 660) larges.push(`${nom} ${Math.round(box.width)}px`);
    }
    expect(larges).toEqual(['S01 1016px', 'S05 1016px', 'S06 1016px', 'S08 1016px', 'S09 1016px']);
  });
});

// ─── L'encoche ───────────────────────────────────────────────────────────────

/**
 * Les 50 px du haut simulaient l'encoche dans une image. Un écran réel lit la
 * zone sûre — qui vaut 0 dans un navigateur, donc l'en-tête doit remonter contre
 * le bord.
 *
 * LA MESURE PORTE SUR L'EN-TÊTE, PAS SUR LE `<h1>` : S02 et S05 mettent leur
 * `<h1>` dans le corps, sous une couverture photo. Ce qu'il faut mesurer, c'est
 * le creux entre le haut du cadre et son premier contenu.
 *
 * S02 et S05 sont hors de ce test, et c'est la maquette qui le décide : leurs
 * cadres mobiles commencent par une couverture pleine largeur, sans en-tête à
 * remplissage. Le constat est consigné dans le rapport plutôt que corrigé en
 * silence.
 */
test.describe('l’en-tête mobile lit la zone sûre', () => {
  for (const nom of SANS_FICHE) {
    if (nom === 'S02' || nom === 'S05') continue;
    test(`${nom} — l’en-tête ne garde pas les 50 px d’encoche simulée`, async ({ browser, request }) => {
      const { page, jeu } = await atelier(browser, request);
      const ecran = ecrans(jeu).find((e) => e.nom === nom)!;
      await visiter(page, ecran.route, 390);
      const creux = await page.evaluate(() => {
        const frame = document.querySelector('[data-frame="mobile"]')!;
        const entete = frame.firstElementChild?.firstElementChild ?? null;
        const premier = entete?.firstElementChild ?? null;
        if (entete === null || premier === null) return null;
        return Math.round(
          premier.getBoundingClientRect().top - entete.getBoundingClientRect().top,
        );
      });
      expect(creux, 'en-tête mobile introuvable').not.toBeNull();
      // 50 px d'encoche simulée laisseraient 50 ; la zone sûre vaut 0 ici, donc
      // il ne reste que le remplissage latéral de la maquette — 12 ou 16 px.
      expect(creux).toBeLessThan(40);
    });
  }
});

// ─── Les quatre fenêtres ─────────────────────────────────────────────────────

test.describe('S02 — « Contacter » ouvre la feuille « Présentez-vous »', () => {
  for (const width of [1440, 390] as const) {
    test(`${width} px — la fenêtre s’ouvre et porte son nom`, async ({ browser, request }) => {
      const { page, jeu } = await atelier(browser, request);
      await visiter(page, `/services/logement/${jeu.idAnnonce}`, width);
      await page.locator(`${cadre(width)} [data-modal-open="S02C"]`).first().click();

      const dialog = page.getByRole('dialog', { name: 'Présentez-vous' });
      await expect(dialog).toBeVisible();
      // La feuille porte le rappel de non-paiement, juste au-dessus de l'envoi.
      await expect(dialog.getByText('Aucun versement avant visite')).toBeVisible();
    });
  }

  test('Échap ferme et rend le focus au bouton qui l’a ouverte', async ({ browser, request }) => {
    const { page, jeu } = await atelier(browser, request);
    await visiter(page, `/services/logement/${jeu.idAnnonce}`, 1440);
    const bouton = page.locator('[data-frame="desktop"] [data-modal-open="S02C"]').first();
    await bouton.click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(bouton).toBeFocused();
  });

  test('un clic sur le voile ferme, un clic dans le panneau non', async ({ browser, request }) => {
    const { page, jeu } = await atelier(browser, request);
    await visiter(page, `/services/logement/${jeu.idAnnonce}`, 1440);
    await page.locator('[data-frame="desktop"] [data-modal-open="S02C"]').first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    /**
     * LE CLIC « DANS LE PANNEAU » VISE SON TITRE, et non son coin.
     *
     * Première version : `click({ position: { x: 5, y: 5 } })` sur le panneau. Il
     * expirait au bout de trente secondes — « `[data-modal-overlay]` intercepts
     * pointer events ». La cause n'est pas un défaut de la modale : le panneau a
     * `border-radius: 28px`, et le point (5, 5) tombe HORS de la forme arrondie,
     * donc hors de la zone de clic. Le clic atteignait le voile, qui ferme.
     *
     * Viser le titre est à la fois juste et lisible : c'est un élément inerte,
     * franchement à l'intérieur du panneau.
     */
    await dialog.getByRole('heading', { level: 2 }).click();
    await expect(dialog, 'un clic dans le panneau ne ferme pas').toBeVisible();

    await dialog.locator('[data-modal-overlay]').click({ position: { x: 5, y: 5 } });
    await expect(dialog).toBeHidden();
  });

  /**
   * « ENVOYER » EST INERTE, et c'est délibéré : ce message ouvre une conversation
   * avec l'auteur de l'annonce (10 §2.3), et ce lot ne branche aucune écriture. Un
   * bouton qui refermerait la feuille ferait croire au membre que son message est
   * parti.
   */
  test('« Envoyer » ne referme rien : aucune écriture n’est branchée', async ({ browser, request }) => {
    const { page, jeu } = await atelier(browser, request);
    await visiter(page, `/services/logement/${jeu.idAnnonce}`, 1440);
    await page.locator('[data-frame="desktop"] [data-modal-open="S02C"]').first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Envoyer' }).click();
    await expect(dialog, 'la feuille reste ouverte').toBeVisible();
  });
});

/**
 * L'ÉTAT L0 — 10 §2.3 : « un L0 pré-départ peut LIRE les annonces mais doit
 * passer par un parrain ou un accompagnant pour contacter ; l'interface le dit et
 * propose de demander un parrain. »
 *
 * Ce qui choisit entre L1+ et L0, c'est le NIVEAU DU MEMBRE — et on ne le lit
 * PAS pour décider : la règle du socle est sans exception. `?niveau=l0` rend
 * l'état atteignable sans rien affirmer.
 */
test.describe('S02 — l’état L0 de « Contacter »', () => {
  test('390 px — ?niveau=l0 ouvre la feuille de vérification dès l’arrivée', async ({ browser, request }) => {
    const { page, jeu } = await atelier(browser, request);
    await visiter(page, `/services/logement/${jeu.idAnnonce}?niveau=l0`, 390);
    const dialog = page.getByRole('dialog', { name: 'Contacter Sarah' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Contacter demande une identité vérifiée.')).toBeVisible();
    await expect(
      dialog.getByRole('link', { name: 'Ou demandez à un parrain de visiter pour vous' }),
    ).toBeVisible();
  });

  /**
   * SUR ORDINATEUR, PAS DE FENÊTRE — et ce n'est pas un oubli : la maquette
   * dessine ce même état EN PLACE, dans la colonne de contexte du cadre de
   * 1440 px (planche « ÉTAT L0 · APRÈS “CONTACTER” »). Superposer la feuille
   * l'afficherait deux fois.
   *
   * CE TEST A ÉTÉ RÉÉCRIT PARCE QUE SA PREMIÈRE VERSION ÉTAIT CREUSE, et c'est la
   * mutation qui l'a montré.
   *
   * Version d'origine : aller directement en 1440 px et vérifier
   * `getByRole('dialog')).toHaveCount(0)`. Elle passait au vert — Y COMPRIS quand
   * on retirait le `mobileOnly` qu'elle prétendait garder. La cause : une modale
   * est rendue CÔTÉ CLIENT, après l'hydratation, et `toHaveCount(0)` est satisfait
   * dans l'instant, sur un document qui n'a encore rien monté. Le test mesurait la
   * lenteur de React, pas la règle. Un relevé direct l'a confirmé : sous mutation,
   * la page portait bien `[data-modal]` et un `role="dialog"`.
   *
   * Version actuelle : on OUVRE d'abord la feuille en 390 px — ce qui prouve que
   * l'hydratation a eu lieu et que la fenêtre existe — puis on ÉLARGIT la fenêtre.
   * `Modal` suit la largeur tant qu'il est ouvert, donc la feuille doit
   * DISPARAÎTRE au passage du seuil, et l'écran d'ordinateur porter le même
   * message en place. Sans `mobileOnly`, elle reste : le test rougit.
   */
  test('1440 px — la feuille s’efface : la maquette dessine cet état dans la page', async ({ browser, request }) => {
    const { page, jeu } = await atelier(browser, request);
    await visiter(page, `/services/logement/${jeu.idAnnonce}?niveau=l0`, 390);
    const dialog = page.getByRole('dialog', { name: 'Contacter Sarah' });
    await expect(dialog, 'la feuille doit d’abord exister — sinon on ne prouve rien').toBeVisible();

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(
      page.locator('[data-frame="desktop"]').getByText('Contacter demande une identité vérifiée.'),
    ).toBeVisible();
  });
});

test.describe('S05 — les deux fenêtres de l’offre', () => {
  const FENETRES = [
    {
      nom: 'S05L',
      titre: 'Vous quittez la plateforme',
      // 10 §3.1 : la mise en garde contre les arnaques à l'emploi.
      repere: 'Ne communiquez jamais de coordonnées bancaires pour une candidature.',
    },
    { nom: 'S05R', titre: 'Recommander un membre', repere: 'Commentaire' },
  ] as const;

  for (const fenetre of FENETRES) {
    for (const width of [1440, 390] as const) {
      test(`${fenetre.nom} à ${width} px — « ${fenetre.titre} »`, async ({ browser, request }) => {
        const { page, jeu } = await atelier(browser, request);
        await visiter(page, `/services/emploi/${jeu.idOffre}`, width);
        await page.locator(`${cadre(width)} [data-modal-open="${fenetre.nom}"]`).first().click();

        const dialog = page.getByRole('dialog', { name: fenetre.titre });
        await expect(dialog).toBeVisible();
        await expect(dialog.getByText(fenetre.repere)).toBeVisible();

        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);
      });
    }
  }

  /**
   * LE BOUTON DRAPEAU N'A AUCUN TEXTE dans la maquette — c'est le seul bouton
   * muet de tout le fichier. Son nom accessible est recopié de la maquette
   * elle-même, qui écrit « Signaler » à côté du même tracé sur S02 et S07.
   *
   * Sans `ICON_BUTTON_NAMES`, axe-core le relève en `critical` (`button-name`).
   */
  test('le bouton drapeau porte le nom que la maquette lui donne ailleurs', async ({ browser, request }) => {
    const { page, jeu } = await atelier(browser, request);
    await visiter(page, `/services/emploi/${jeu.idOffre}`, 1440);
    await expect(
      page.locator('[data-frame="desktop"]').getByRole('button', { name: 'Signaler' }),
    ).toBeVisible();
  });
});

// ─── Les règles dures ────────────────────────────────────────────────────────

test.describe('règles dures', () => {
  /**
   * ── RÈGLE DURE 10 §2.2 — LE BANDEAU DE NON-PAIEMENT ────────────────────────
   *
   * « Le bandeau "Aucun versement avant visite ou vérification. Si une annonce
   * demande un acompte à distance, signalez-la." est renvoyé par l'API sur chaque
   * liste et chaque annonce, et AFFICHÉ EN PERMANENCE. »
   *
   * LA MAQUETTE ÉCRIVAIT SA PROPRE FORMULATION, et trois fois différemment : le
   * cadre d'ordinateur de la liste et du formulaire disait « … Ne payez jamais une
   * réservation à distance. », le cadre mobile de la liste abrège en « Aucun
   * versement avant visite. », et l'annonce porte « Visitez avant tout versement.
   * Ne transmettez jamais vos papiers originaux. » (le « rappel de prudence » de
   * §7). Le détecteur couvre les trois : on ne réécrit pas la maquette pour faire
   * coller un test.
   *
   * CE QUE LE BRANCHEMENT A CHANGÉ : sur les DEUX cadres d'ordinateur où la
   * maquette écrivait la phrase complète (S01 et S03), le texte vient maintenant
   * du SERVEUR (`meta.safetyBanner`). C'est la seule forme de la règle qu'un
   * déploiement front ne peut pas effacer — et le test ci-dessous le prouve dans
   * les deux sens : la phrase du serveur est là, celle de la maquette a disparu.
   *
   * CINQ CADRES SUR HUIT L'AFFICHENT. Les trois autres — le formulaire sur
   * téléphone et les deux cadres de « Mes annonces » — ne l'écrivent pas, et
   * c'est un défaut de la MAQUETTE, pas du transcodage : le texte n'y est
   * simplement pas. Il n'a PAS été ajouté — ce serait réécrire la maquette, et
   * sur une règle dure c'est la dernière chose à faire en silence.
   *
   * La liste est donc ÉPINGLÉE, et elle tombe dans les deux sens.
   */
  const NON_PAIEMENT = /Aucun versement|Visitez avant tout versement/;

  const PORTENT_LA_REGLE = [
    { nom: 'S01', width: 1440 },
    { nom: 'S01', width: 390 },
    { nom: 'S02', width: 1440 },
    { nom: 'S02', width: 390 },
    { nom: 'S03', width: 1440 },
  ] as const;

  for (const { nom, width } of PORTENT_LA_REGLE) {
    test(`${nom} ${width} px — le rappel de non-paiement est affiché (10 §2.2)`, async ({ browser, request }) => {
      const { page, jeu } = await atelier(browser, request);
      const ecran = ecrans(jeu).find((e) => e.nom === nom)!;
      await visiter(page, ecran.route, width);
      await expect(page.locator(cadre(width)).getByText(NON_PAIEMENT).first()).toBeVisible();
    });
  }

  /**
   * LA PREUVE QUE LE BANDEAU VIENT DU SERVEUR, et pas d'une chaîne du front.
   *
   * Les deux moitiés comptent : la phrase du SERVEUR est affichée, et la seconde
   * moitié de la phrase de la MAQUETTE — « Ne payez jamais une réservation à
   * distance. » — a disparu. Sans la seconde, le test passerait aussi sur un écran
   * qui n'aurait rien branché, puisque les deux phrases commencent pareil.
   */
  for (const nom of ['S01', 'S03'] as const) {
    test(`${nom} 1440 px — le bandeau affiché est celui de l’API, pas celui dessiné`, async ({ browser, request }) => {
      const { page, jeu } = await atelier(browser, request);
      const ecran = ecrans(jeu).find((e) => e.nom === nom)!;
      await visiter(page, ecran.route, 1440);

      const texte = await page.locator('[data-frame="desktop"]').innerText();
      expect(
        texte,
        'la phrase du serveur (10 §2.2) n’est pas affichée : `meta.safetyBanner` n’est pas lu',
      ).toContain('Si une annonce demande un acompte à distance, signalez-la.');
      expect(
        texte,
        'la phrase DESSINÉE est encore là : le bandeau ne vient pas du serveur',
      ).not.toContain('Ne payez jamais une réservation à distance.');
    });
  }

  test('trois cadres de logement ne l’affichent PAS — défaut de maquette, épinglé', async ({ browser, request }) => {
    const { page, jeu } = await atelier(browser, request);
    const manquants: string[] = [];
    for (const nom of LOGEMENT) {
      const ecran = ecrans(jeu).find((e) => e.nom === nom)!;
      for (const width of [1440, 390] as const) {
        await visiter(page, ecran.route, width);
        const n = await page.locator(cadre(width)).getByText(NON_PAIEMENT).count();
        if (n === 0) manquants.push(`${nom} ${width}`);
      }
    }
    expect(manquants).toEqual(['S03 390', 'S09 1440', 'S09 390']);
  });

  /**
   * ── RÈGLE DURE 00 §49 — AUCUN COMPTEUR DE VUES ─────────────────────────────
   *
   * « Aucun compteur de vues n'est exposé à personne, sur aucun contenu. »
   *
   * DEUX DOCUMENTS SE CONTREDISENT, et la maquette tranche. `T5 S09` demande
   * « compteur de vues et contacts » ; la règle dure l'interdit. La maquette
   * écrit dans sa propre légende de route « /services/mes-annonces · AUCUN
   * COMPTEUR DE VUES ».
   *
   * LE SERVICE INCRÉMENTE POURTANT `viewCount` à chaque lecture d'annonce et de
   * fiche — c'est un compteur interne de modération. La règle ne tient donc qu'au
   * `select` du service ET au `.strict()` des schémas partagés, qui refuserait la
   * réponse si le champ sortait. Ce balayage est la moitié visible de la preuve ;
   * l'autre est dans `packages/shared/src/__tests__/services-responses.test.ts`.
   */
  const VUES = /\b\d[\d\s]*vues?\b|\bvues?\s*:/i;

  for (const nom of SANS_FICHE) {
    for (const width of [1440, 390] as const) {
      test(`${nom} ${width} px — aucun compteur de vues (00 §49)`, async ({ browser, request }) => {
        const { page, jeu } = await atelier(browser, request);
        const ecran = ecrans(jeu).find((e) => e.nom === nom)!;
        await visiter(page, ecran.route, width);
        const texte = await page.locator(cadre(width)).innerText();
        expect(texte).not.toMatch(VUES);
      });
    }
  }

  /**
   * LA PREUVE DE NON-VACUITÉ, et elle a changé de forme avec le branchement.
   *
   * Avant, le même relevé devait TROUVER « 6 contacts » sur S09 — le compteur que
   * la maquette dessine et que la règle autorise. Ce nombre n'existe dans AUCUN
   * champ de l'API (écart remonté au porteur), et l'écran affiche donc
   * l'expiration seule. Le détecteur est donc prouvé non aveugle autrement : il
   * doit trouver le nombre de jours que le sous-titre porte — « expire dans N
   * jours » — qui est bien un nombre affiché, et ne pas le confondre avec des vues.
   */
  test('le relevé de S09 TROUVE un nombre affiché, et ce n’est pas un compteur de vues', async ({ browser, request }) => {
    const { page, jeu } = await atelier(browser, request);
    await visiter(page, '/services/mes-annonces', 1440);
    const texte = await page.locator('[data-frame="desktop"]').innerText();
    expect(texte, 'le sous-titre doit porter l’expiration, de `expiresAt`').toMatch(
      /expire dans \d+ jours/,
    );
    expect(texte, 'et le détecteur de vues, sur la même chaîne, ne trouve rien').not.toMatch(VUES);
    /**
     * ET LE COMPTEUR DE CONTACTS A DISPARU, ce qui est la conséquence de l'écart :
     * la maquette écrivait « 6 contacts · expire dans 12 jours », l'API n'a pas de
     * compteur de contacts, et l'écran n'en invente pas un.
     */
    expect(texte, 'un compteur de contacts est affiché alors qu’aucun champ ne le porte').not.toMatch(
      /\d+ contacts? ·/,
    );
  });

  /**
   * ── RÈGLE DURE 14 §17 — L'ENCART PARTENAIRE ────────────────────────────────
   *
   * « Aucun encart partenaire dans le fil, l'entraide, les guides, les réseaux,
   * la messagerie. Ils vivent uniquement sur une étape de parcours ET EN PIED DE
   * LA SECTION LOGEMENT. »
   *
   * 10 §7 borne la quantité : « un encart partenaire AU MAXIMUM en bas ».
   *
   * Les deux moitiés sont vérifiables : il y en a UN sur la liste de logement, et
   * AUCUN sur les neuf autres écrans du module. Le premier test est la preuve de
   * non-vacuité du second.
   */
  test('S01 porte UN encart partenaire, en pied de liste (14 §17, 10 §7)', async ({ browser, request }) => {
    const { page, jeu } = await atelier(browser, request);
    await visiter(page, '/services/logement', 1440);
    const encarts = page.locator('[data-frame="desktop"]').getByText(/^Partenaire\b/);
    await expect(encarts).toHaveCount(1);
    await expect(encarts.first()).toBeVisible();
  });

  test('aucun encart partenaire sur les autres écrans (14 §17)', async ({ browser, request }) => {
    const { page, jeu } = await atelier(browser, request);
    const fautifs: string[] = [];
    for (const nom of SANS_FICHE) {
      if (nom === 'S01') continue;
      const ecran = ecrans(jeu).find((e) => e.nom === nom)!;
      for (const width of [1440, 390] as const) {
        await visiter(page, ecran.route, width);
        const n = await page.locator(cadre(width)).getByText(/^Partenaire\b/).count();
        if (n > 0) fautifs.push(`${nom} ${width}`);
      }
    }
    expect(fautifs).toEqual([]);
  });

  /**
   * ── RÈGLE DURE 10 §3.1 — « SPONSORISÉE », TOUJOURS VISIBLE ─────────────────
   *
   * « Sponsorisée (is_sponsored, Premium) : mise en avant en tête des listes
   * pendant 14 jours, pastille "Sponsorisée" TOUJOURS VISIBLE. »
   * Et §11 : « une offre sponsorisée … n'occupe jamais plus de 2 emplacements de
   * tête ».
   *
   * CE QUE LE BRANCHEMENT A CHANGÉ : l'offre publiée par la suite N'EST PAS
   * sponsorisée — mettre en avant exige Premium (§3.1, 5 par mois) et le membre
   * créé est gratuit. La pastille ne doit donc PAS s'afficher, et c'est la moitié
   * la plus difficile de la règle : une pastille collée à toutes les offres serait
   * un mensonge commercial, exactement ce que §11 interdit dans l'autre sens.
   *
   * Les deux moitiés sont donc éprouvées : aucune pastille sur une offre qui n'est
   * pas mise en avant, ET au plus deux quand il y en a.
   */
  for (const width of [1440, 390] as const) {
    test(`S04 ${width} px — la pastille suit l’état du serveur, et jamais plus de 2 (10 §3.1)`, async ({ browser, request }) => {
      const { page, jeu } = await atelier(browser, request);
      await visiter(page, '/services/emploi', width);

      /**
       * ── CE QUE LE BRANCHEMENT A SÉPARÉ, ET QUE LA MAQUETTE CONFONDAIT ────────
       *
       * Le test comptait les pastilles de la PAGE et exigeait « au plus deux ». Il
       * a échoué en trouvant TROIS, et son échec était juste : la règle du §11 dit
       * deux EMPLACEMENTS DE TÊTE, pas deux pastilles. Une troisième offre mise en
       * avant qui retombe dans le classement naturel GARDE sa pastille — « toujours
       * visible » est l'autre moitié de la même règle. La maquette, qui n'en
       * dessinait qu'une, ne pouvait pas faire voir la différence.
       *
       * On compare donc l'écran à ce que l'API PROMET, en l'interrogeant :
       *   · la TÊTE ne dépasse pas `meta.sponsoredHeadSlots` — c'est la borne ;
       *   · le nombre de pastilles affichées ÉGALE le nombre d'offres que l'API
       *     déclare sponsorisées — l'écran n'en ajoute ni n'en perd aucune.
       *
       * La seconde est la plus forte des deux : elle tombe si l'écran colle la
       * pastille à tout le monde, ET si un `<sc-if>` la fait disparaître.
       */
      const promesse = (await (
        await request.get(`${API_SERVICES}/jobs?limit=20`)
      ).json()) as {
        items: { isSponsored: boolean }[];
        sponsored: { isSponsored: boolean }[];
        meta: { sponsoredHeadSlots: number };
      };
      const attendues = [...promesse.sponsored, ...promesse.items].filter(
        (o) => o.isSponsored,
      ).length;

      expect(
        promesse.sponsored.length,
        'la TÊTE dépasse la borne de §11 : c’est l’API qui est en faute, pas l’écran',
      ).toBeLessThanOrEqual(promesse.meta.sponsoredHeadSlots);

      const frame = page.locator(cadre(width));
      const pastilles = frame.getByText('Sponsorisée', { exact: true });
      const n = await pastilles.count();
      expect(
        n,
        `l’écran affiche ${n} pastille(s) là où l’API en annonce ${attendues} : ` +
          'la pastille ne suit plus `isSponsored` (10 §3.1, §11)',
      ).toBe(attendues);
      /**
       * LES DEUX CADRES MONTRENT LA MÊME LISTE : le `<sc-for>` déclaré remplace les
       * trois cartes de l'ordinateur ET les deux du mobile par UNE boucle sur la
       * liste entière. Le compte attendu est donc le même aux deux largeurs — la
       * maquette abrégeait, la donnée ne le fait pas.
       */

      /**
       * L'OFFRE DU MEMBRE N'EST PAS SPONSORISÉE : sa carte ne doit porter aucune
       * pastille. On le vérifie sur SA carte, pas sur la liste entière — une autre
       * offre de la base peut légitimement l'être.
       *
       * LA CARTE EST REMONTÉE DEPUIS LE TITRE, et non ciblée par un `hasText` sur
       * `div` : `hasText` rend l'élément le plus PROFOND qui contient le texte,
       * c'est-à-dire le `<div>` du titre seul — qui ne contient jamais la pastille,
       * quoi qu'il arrive. L'assertion aurait été vraie par construction, donc
       * creuse. On remonte donc jusqu'au cadre de la carte (le conteneur blanc à
       * `border-radius: 22px`), et c'est LUI qu'on interroge.
       */
      const carte = await page.evaluate(
        ({ sel, titre }) => {
          const racine = document.querySelector(sel);
          if (racine === null) return null;
          const titreEl = [...racine.querySelectorAll<HTMLElement>('*')].find(
            (el) => el.children.length === 0 && el.textContent?.trim() === titre,
          );
          if (titreEl === undefined) return null;
          let n: HTMLElement | null = titreEl;
          while (n !== null && getComputedStyle(n).borderTopLeftRadius !== '22px') {
            n = n.parentElement;
          }
          return n === null ? null : { texte: n.innerText, trouve: true };
        },
        { sel: cadre(width), titre: jeu.titreOffre },
      );

      expect(carte, `la carte de « ${jeu.titreOffre} » est introuvable dans la liste`).not.toBeNull();
      expect(
        carte?.texte,
        'une offre gratuite porte la pastille : elle serait annoncée comme payée (§3.1)',
      ).not.toContain('Sponsorisée');
      // Non-vacuité : c'est bien la carte de l'offre qu'on vient de lire.
      expect(carte?.texte).toContain(jeu.titreOffre);
      expect(carte?.texte).toContain(ENTREPRISE_OFFRE);
    });
  }

  /**
   * LA PREUVE DE NON-VACUITÉ DU DÉTECTEUR DE PASTILLE.
   *
   * Un relevé qui ne trouve jamais « Sponsorisée » ne dit rien tant qu'on n'a pas
   * montré qu'il SAIT en trouver. On la cherche donc là où la maquette l'écrit à
   * coup sûr : dans le texte du bouton de sponsorisation du formulaire de S05
   * (« Sponsoriser 14 jours »), qui est du DESSIN et non une donnée.
   */
  test('le même relevé TROUVE le mot dans le formulaire de S05 — il n’est pas aveugle', async ({ browser, request }) => {
    const { page, jeu } = await atelier(browser, request);
    await visiter(page, `/services/emploi/${jeu.idOffre}`, 1440);
    const texte = await page.locator('[data-frame="desktop"]').innerText();
    expect(texte, 'le relevé doit lire le texte de la page').toMatch(/Sponsoriser 14 jours/);
  });

  /**
   * ── RÈGLE DURE 10 §4.2 — « FICHE MISE EN AVANT » ───────────────────────────
   *
   * « Les fiches PRO/PRO_PLUS obtiennent un emplacement mis en avant CLAIREMENT
   * SIGNALÉ ("Fiche mise en avant") : AU PLUS 2 fiches mises en avant en tête,
   * puis le classement naturel. »
   *
   * LE COMPTE EST BORNÉ À L'ANNUAIRE. « Fiche mise en avant » figure aussi sur
   * S08, dans la DESCRIPTION du plan Pro+ (« Fiche mise en avant, contacts
   * illimités ») : c'est un argument de vente, pas un emplacement de liste. Un
   * détecteur non borné aurait compté trois « emplacements de tête » répartis sur
   * deux écrans — exactement la dérive qu'un motif trop large produit en silence.
   */
  for (const width of [1440, 390] as const) {
    test(`S06 ${width} px — au plus deux fiches mises en avant, signalées (10 §4.2)`, async ({ browser, request }) => {
      const { page, jeu } = await atelier(browser, request);
      await visiter(page, '/services/annuaire', width);
      const mentions = page.locator(cadre(width)).getByText('Fiche mise en avant', { exact: true });
      expect(
        await mentions.count(),
        'au plus deux emplacements de tête (§4.2)',
      ).toBeLessThanOrEqual(2);
    });
  }

  /**
   * LA MENTION SUIT `isFeatured`, ET ELLE EST SIGNALÉE QUAND ELLE EXISTE.
   *
   * La base de développement porte une fiche `PRO` : la liste doit donc en
   * signaler au moins une, avec le libellé que le SERVEUR envoie. Si l'annuaire
   * est vide, le test le dit — même raison que pour S07.
   */
  test('la mention de mise en avant est celle du serveur (10 §4.2)', async ({ browser, request }) => {
    const { page, jeu } = await atelier(browser, request);
    expect(
      jeu.idFiche,
      'l’annuaire est vide : aucune route ne sait créer une fiche pro (voir S07).',
    ).not.toBeNull();
    if (jeu.idFiche === null) return;
    await visiter(page, '/services/annuaire', 1440);
    const mentions = page
      .locator('[data-frame="desktop"]')
      .getByText('Fiche mise en avant', { exact: true });
    expect(await mentions.count(), 'la mise en avant doit être signalée').toBeGreaterThanOrEqual(1);
    await expect(mentions.first()).toBeVisible();
  });

  /**
   * ── RÈGLE DURE 10 §4.1 — LE TÉLÉPHONE N'EST JAMAIS AFFICHÉ ─────────────────
   *
   * « Méthode de contact (PLATFORM_MESSAGE, EMAIL, PHONE_ON_REQUEST — le
   * téléphone n'est JAMAIS stocké ici ni affiché ; "sur demande" signifie que le
   * pro le communique lui-même en message). »
   *
   * CETTE RÈGLE A CHANGÉ DE NATURE AVEC LE BRANCHEMENT, et c'est le point le plus
   * important de ce fichier. Elle tenait par le DESSIN : la maquette n'écrit aucun
   * numéro, et le transcodage ne réécrit rien. Elle ne tient plus par le dessin
   * dès que les champs viennent du réseau — un champ `phone` dans la réponse
   * serait affiché par la première ligne de code qui le lirait.
   *
   * Le rempart est donc à DEUX étages, et les deux sont éprouvés :
   *
   *   · ICI, sur ce que l'écran AFFICHE, avec des données réelles et une session ;
   *   · dans `packages/shared/src/__tests__/services-responses.test.ts`, sur le
   *     CONTRAT : `proCardSchema` et `proDetailResponseSchema` sont `.strict()`,
   *     donc une réponse portant un numéro est REFUSÉE. Sans `.strict()`, zod le
   *     dépouillerait en silence et ce balayage resterait vert pour toujours.
   *
   * LE TEST SUIVANT EST LA PREUVE DE NON-VACUITÉ du détecteur : le MÊME motif,
   * appliqué à `/compte/securite` — le seul écran du produit qui affiche un
   * téléphone, et encore, masqué — doit en trouver un.
   */
  const TELEPHONE = /\+\d[\d\s•]{4,}|\b0[1-9](?:[\s.]?\d{2}){4}\b/;

  for (const nom of SANS_FICHE) {
    for (const width of [1440, 390] as const) {
      test(`${nom} ${width} px — aucun numéro de téléphone (10 §4.1)`, async ({ browser, request }) => {
        const { page, jeu } = await atelier(browser, request);
        const ecran = ecrans(jeu).find((e) => e.nom === nom)!;
        await visiter(page, ecran.route, width);
        const texte = await page.locator(cadre(width)).innerText();
        expect(texte).not.toMatch(TELEPHONE);
      });
    }
  }

  test('S07 — aucun numéro sur la fiche pro, sur données réelles (10 §4.1)', async ({ browser, request }) => {
    const { page, jeu } = await atelier(browser, request);
    expect(jeu.idFiche, 'l’annuaire est vide : voir le test S07 pour la cause.').not.toBeNull();
    if (jeu.idFiche === null) return;
    for (const width of [1440, 390] as const) {
      await visiter(page, `/services/annuaire/${jeu.idFiche}`, width);
      const texte = await page.locator(cadre(width)).innerText();
      expect(texte, `S07 à ${width} px affiche un numéro`).not.toMatch(TELEPHONE);
    }
  });

  /**
   * K04 EXIGE UNE SESSION, et c'est ce test qui l'a rendu visible.
   *
   * Il est la preuve de non-vacuité du détecteur : appliqué à l'écran qui affiche un
   * téléphone — masqué — il doit en TROUVER un. Depuis que K04 lit `GET /me`, une
   * visite sans session n'affiche plus que l'état d'attente : le détecteur ne
   * trouvait plus rien, et ce test rougissait. Son échec était juste — il disait
   * exactement ce qu'il est là pour dire, « je ne vois plus de numéro » — et la
   * réponse n'est pas de l'assouplir mais de lui donner la session que l'écran
   * réclame désormais.
   *
   * Sans lui, les vingt cas ci-dessus continueraient de passer sur un détecteur
   * devenu aveugle, et personne ne le saurait.
   *
   * CE TEST A SON PROPRE CONTEXTE, et c'est la seule exception de ce fichier : il
   * lui faut un AUTRE membre, parce qu'il regarde `/compte/securite` et que le
   * membre partagé a déjà consommé son plafond de trois OTP par heure pour monter
   * en L2. Son contexte est donc neuf, sa session fraîche, et la rotation du jeton
   * de rafraîchissement n'entre pas en conflit avec celle du contexte partagé.
   */
  test('le même détecteur TROUVE le numéro masqué de K04 — il n’est donc pas aveugle', async ({
    context,
    page,
    request,
  }) => {
    await connecter(context, request);
    await visiter(page, '/compte/securite', 1440);
    const texte = await page.locator('[data-frame="desktop"]').innerText();
    expect(texte).toMatch(TELEPHONE);
  });

  /**
   * S08 dit au membre ce que §4.1 exige du serveur : la méthode de contact est la
   * messagerie de la plateforme, et le justificatif n'est jamais affiché. L'API le
   * tient : `GET /me/pro-profile` ne rend qu'un booléen `hasProof`.
   */
  test('S08 annonce la messagerie comme méthode de contact et protège le justificatif', async ({ browser, request }) => {
    const { page, jeu } = await atelier(browser, request);
    await visiter(page, '/services/annuaire/ma-fiche', 1440);
    const frame = page.locator('[data-frame="desktop"]');
    await expect(frame.getByText('Messagerie de la plateforme')).toBeVisible();
    await expect(frame.getByText("Il n'est jamais affiché")).toBeVisible();
  });

  /**
   * ── RÈGLE DURE 10 §7 — LE SCORE DE RISQUE N'EST PAS AFFICHÉ ────────────────
   *
   * « Publier un logement : formulaire, photos, aperçu du score de risque NON
   * AFFICHÉ (interne), message "en vérification" si bloquée. »
   *
   * MÊME CHANGEMENT DE NATURE QUE §4.1 : la règle tenait par le dessin, elle tient
   * maintenant par le CONTRAT. `cautionLevel` est une énumération à DEUX valeurs
   * (`STANDARD`, `REINFORCED`), le `<sc-if>` du cadre transcodé ne lit qu'un
   * BOOLÉEN qui en dérive, et `housingCardSchema` est `.strict()` — un `riskScore`
   * dans la réponse la ferait REFUSER avant l'écran.
   *
   * Le score est un nombre entre 0 et 1 (§2.2). Le détecteur cherche donc le mot
   * et le nombre, sur les quatre écrans de logement.
   */
  const SCORE = /score|risque\s*[:=]|0[.,][0-9]\b/i;

  for (const nom of LOGEMENT) {
    for (const width of [1440, 390] as const) {
      test(`${nom} ${width} px — aucun aperçu du score de risque (10 §7)`, async ({ browser, request }) => {
        const { page, jeu } = await atelier(browser, request);
        const ecran = ecrans(jeu).find((e) => e.nom === nom)!;
        await visiter(page, ecran.route, width);
        const texte = await page.locator(cadre(width)).innerText();
        expect(texte).not.toMatch(SCORE);
      });
    }
  }

  /**
   * LA PREUVE DE NON-VACUITÉ, ET LA MOITIÉ QUE LE BRANCHEMENT A RENDUE VRAIE.
   *
   * Le même relevé doit TROUVER le message autorisé « Votre annonce est en
   * vérification » sur le formulaire — du dessin, donc toujours là.
   *
   * ET « ANNONCE À RISQUE MOYEN » NE DOIT PLUS APPARAÎTRE sur l'annonce publiée
   * par la suite : son `cautionLevel` est `STANDARD` (elle ne porte aucun terme
   * d'arnaque, aucun contact dans sa description), donc le `<sc-if>` l'efface.
   * Avant le branchement, la maquette l'affichait TOUJOURS — c'est précisément le
   * progrès que ce lot apporte à la règle, et le test l'épingle : la carte suit la
   * tranche, elle n'est plus décorative.
   */
  test('le relevé TROUVE « en vérification », et la carte de risque suit la TRANCHE', async ({ browser, request }) => {
    const { page, jeu } = await atelier(browser, request);

    await visiter(page, '/services/logement/nouveau', 1440);
    const formulaire = await page.locator('[data-frame="desktop"]').innerText();
    expect(formulaire).toMatch(/Votre annonce est en vérification/);
    expect(formulaire, 'et pourtant aucun score').not.toMatch(SCORE);

    await visiter(page, `/services/logement/${jeu.idAnnonce}`, 1440);
    const annonce = await page.locator('[data-frame="desktop"]').innerText();
    expect(
      annonce,
      'le rappel renforcé est affiché sur une annonce à prudence STANDARD : ' +
        'le `<sc-if>` ne lit pas `cautionLevel`',
    ).not.toMatch(/ANNONCE À RISQUE MOYEN/);
    expect(annonce, 'la tranche est dite, jamais le chiffre').not.toMatch(SCORE);
  });

  /**
   * ── RÈGLE DURE 00 §47 — LE MOT « CERTIFIÉ » N'APPARAÎT NULLE PART ──────────
   *
   * « Le mot "certifié" n'apparaît nulle part dans l'interface. La plateforme ne
   * vérifie aucun dossier administratif. »
   *
   * La nuance compte sur CE module précisément : l'annuaire pro repose sur un
   * justificatif d'activité et une validation humaine (§4.1), donc c'est
   * exactement l'endroit où le mot serait tentant — et depuis le branchement, le
   * texte vient en partie du MEMBRE lui-même. Le service le refuse à l'écriture
   * (`FORBIDDEN_WORD`), ce qui est la seule place où la règle peut tenir.
   */
  test('« certifié » n’apparaît sur aucun écran, mais « vérifié » si (00 §47)', async ({ browser, request }) => {
    const { page, jeu } = await atelier(browser, request);
    const fautifs: string[] = [];
    let vus = 0;
    for (const nom of SANS_FICHE) {
      const ecran = ecrans(jeu).find((e) => e.nom === nom)!;
      for (const width of [1440, 390] as const) {
        await visiter(page, ecran.route, width);
        const texte = await page.locator(cadre(width)).innerText();
        if (/certifi/i.test(texte)) fautifs.push(`${nom} ${width}`);
        if (/vérifi/i.test(texte)) vus += 1;
      }
    }
    expect(fautifs).toEqual([]);
    // Non-vacuité : le relevé lit bien le texte de la page.
    expect(vus, 'le relevé doit trouver « vérifié » quelque part').toBeGreaterThan(0);
  });
});

// ─── Ce que la maquette impose, et qu'on vérifie une fois ────────────────────

test.describe('jetons de design', () => {
  /**
   * T1 §2.3 — jamais d'ombre portée.
   *
   * LE COMPTE D'ÉLÉMENTS EXAMINÉS EST VÉRIFIÉ, et ce n'est pas du zèle : un
   * relevé d'absence qui ne regarde rien passe au vert pour toujours. La leçon
   * vient de ce module — un test d'absence de fenêtre y passait au vert parce
   * qu'il mesurait une page pas encore hydratée (voir « la feuille s'efface »).
   */
  test('aucune ombre portée sur les écrans', async ({ browser, request }) => {
    const { page, jeu } = await atelier(browser, request);
    const fautifs: string[] = [];
    let examines = 0;
    for (const nom of SANS_FICHE) {
      const ecran = ecrans(jeu).find((e) => e.nom === nom)!;
      await visiter(page, ecran.route, 1440);
      const releve = await page.evaluate(() => {
        const tous = [...document.querySelectorAll<HTMLElement>('*')];
        return {
          total: tous.length,
          ombres: tous
            .map((el) => getComputedStyle(el).boxShadow)
            .filter((s) => s !== 'none' && !s.includes('inset 0 0 0 0') && !/0 0 #0000/.test(s)),
        };
      });
      examines += releve.total;
      if (releve.ombres.length > 0) fautifs.push(`${nom} : ${releve.ombres[0]}`);
    }
    expect(fautifs).toEqual([]);
    // Non-vacuité : ces écrans sont denses, le relevé a vraiment vu la page.
    expect(examines, 'le relevé doit avoir examiné la page').toBeGreaterThan(2000);
  });

  /** T1 §2.4 — aucun emoji dans l'interface. Même garde de non-vacuité. */
  test('aucun emoji dans l’interface', async ({ browser, request }) => {
    const { page, jeu } = await atelier(browser, request);
    const fautifs: string[] = [];
    let caracteres = 0;
    for (const nom of SANS_FICHE) {
      const ecran = ecrans(jeu).find((e) => e.nom === nom)!;
      await visiter(page, ecran.route, 1440);
      const texte = await page.locator('body').innerText();
      caracteres += texte.length;
      if (/\p{Extended_Pictographic}/u.test(texte)) fautifs.push(nom);
    }
    expect(fautifs).toEqual([]);
    expect(caracteres, 'le relevé doit avoir lu du texte').toBeGreaterThan(5000);
  });
});

// ─── Responsivité ────────────────────────────────────────────────────────────

/**
 * Aucun défilement horizontal de la PAGE — le symptôme n°1 d'une interface non
 * responsive, et le plus pénible à l'usage.
 *
 * Les écarts éventuels sont MESURÉS plutôt que cachés : ils viennent de la
 * maquette, et on ne la réécrit pas. La liste est épinglée et tombe dans les deux
 * sens.
 */
test.describe('aucun débordement horizontal', () => {
  const LARGEURS = [390, 430, 768, 1023, 1024, 1279, 1440, 1920] as const;

  for (const w of LARGEURS) {
    test(`${w} px`, async ({ browser, request }) => {
      const { page, jeu } = await atelier(browser, request);
      const fautifs: string[] = [];
      for (const nom of SANS_FICHE) {
        const ecran = ecrans(jeu).find((e) => e.nom === nom)!;
        await visiter(page, ecran.route, w);
        const m = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          fenetre: window.innerWidth,
        }));
        if (m.scroll > m.fenetre + 1) fautifs.push(`${nom} ${m.scroll}>${m.fenetre}`);
      }
      expect(fautifs).toEqual([]);
    });
  }
});
