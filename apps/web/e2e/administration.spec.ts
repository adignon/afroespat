import { expect, test, type Page } from '@playwright/test';

/**
 * Les seize écrans de l'application d'ÉQUIPE — D01 à D16.
 *
 * Ce que ces tests éprouvent n'est PAS le dessin : il est transcodé de
 * `docs/template/10 Administration.dc.html`, donc il est celui de la maquette par
 * construction. Ils éprouvent ce qu'une image ne peut pas contenir — que chaque
 * route sert bien SON écran, que le HTML arrive déjà rempli, que les règles dures
 * du dossier restent visibles à l'écran, et que la frontière entre les deux
 * domaines tient.
 *
 * Les assertions portent sur la GÉOMÉTRIE, les RÔLES et le TEXTE VISIBLE, jamais
 * sur des classes : le balisage vient de la maquette en styles en ligne, et viser
 * une classe se casserait à la première régénération.
 */

/** Ce fichier pilote lui-même ses tailles : un seul projet suffit. */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'piloté par le test');

/**
 * `load` et non `networkidle` : ces écrans n'émettent AUCUNE requête — la
 * maquette est statique et ce lot ne branche pas l'API. Next précharge d'ailleurs
 * les liens visibles, donc le réseau ne retombe jamais au calme et `page.goto`
 * finit par expirer sur un message qui ne nomme pas la cause.
 */
async function visiter(page: Page, url: string, width = 1440, height = 1000): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto(url, { waitUntil: 'load' });
}

/**
 * Les seize routes de T5 §11, avec le titre que la MAQUETTE écrit sur chacune.
 *
 * `titre: null` n'est pas un oubli : D02 et D03 ne portent aucun titre dans leur
 * contenu — le seul endroit où « Tableau de bord » et « Membres » sont écrits est
 * l'entrée ACTIVE du menu latéral, et promouvoir un élément de `<nav>` en `<h1>`
 * dirait que la page parle de son propre menu. Le manque est ÉPINGLÉ ici plutôt
 * que maquillé : le jour où la maquette leur donne un titre, ce test tombe et
 * demande qu'on le déclare.
 */
const ROUTES = [
  { url: '/admin', ecran: 'D02', titre: null },
  { url: '/admin/membres', ecran: 'D03', titre: null },
  { url: '/admin/connexion', ecran: 'D01', titre: 'Administration' },
  { url: '/admin/connexion?etape=totp', ecran: 'D01T', titre: 'Administration' },
  {
    url: '/admin/connexion?etape=enrolement',
    ecran: 'D01E',
    titre: 'Activer la double authentification',
  },
  { url: '/admin/moderation', ecran: 'D04', titre: 'Modération' },
  { url: '/admin/moderation/4812', ecran: 'D05', titre: 'Dossier #4812' },
  { url: '/admin/parcours', ecran: 'D06', titre: 'Parcours Études · version 2026' },
  { url: '/admin/etapes', ecran: 'D07', titre: 'Bibliothèque d’étapes' },
  { url: '/admin/referentiels', ecran: 'D08', titre: 'Référentiels' },
  { url: '/admin/guides', ecran: 'D09', titre: 'Guides' },
  { url: '/admin/services', ecran: 'D10', titre: 'Services' },
  { url: '/admin/alertes', ecran: 'D11', titre: 'Alertes arnaques' },
  { url: '/admin/contenu', ecran: 'D12', titre: 'Pages et annonces' },
  { url: '/admin/partenaires', ecran: 'D13', titre: 'Partenaires' },
  { url: '/admin/revenus', ecran: 'D14', titre: 'Abonnements et revenus' },
  { url: '/admin/reglages', ecran: 'D15', titre: 'Réglages' },
  { url: '/admin/impact', ecran: 'D16', titre: 'Rapport d’impact' },
] as const;

test.describe('les seize routes de T5 §11', () => {
  for (const { url, ecran, titre } of ROUTES) {
    test(`${url} rend ${ecran} et porte SON titre`, async ({ page }) => {
      await visiter(page, url);
      await expect(page.locator(`[data-screen="${ecran}"]`)).toHaveCount(1);

      const h1 = page.locator('[data-frame="desktop"]').getByRole('heading', { level: 1 });
      if (titre === null) {
        await expect(h1, 'la maquette n’écrit aucun titre dans ce cadre').toHaveCount(0);
      } else {
        await expect(h1).toHaveText(titre);
      }
    });
  }
});

/**
 * LE HTML ARRIVE DÉJÀ REMPLI, et c'est la seule propriété de ce fichier qui ne se
 * voit pas à l'écran.
 *
 * `useSearchParams()` force le rendu côté client : la réponse du serveur est alors
 * une coquille vide, et la page n'apparaît qu'après l'hydratation. Cinq pages de ce
 * dépôt y sont déjà tombées, et rien ne le dit — l'écran finit par s'afficher.
 *
 * On lit donc la RÉPONSE BRUTE, sans navigateur : si le titre y est, le rendu est
 * bien celui du serveur. `/admin/connexion` est le seul écran de ce lot à lire
 * l'URL, donc le seul exposé ; les autres sont vérifiés pour que la garde tienne
 * si l'un d'eux devient client un jour.
 */
test.describe('les écrans d’équipe sont rendus par le SERVEUR', () => {
  for (const { url, titre } of ROUTES.filter((r) => r.titre !== null)) {
    test(`${url} sert son titre dans le HTML, sans JavaScript`, async ({ request }) => {
      const reponse = await request.get(url);
      expect(reponse.status()).toBe(200);
      const html = await reponse.text();
      expect(html, 'le titre doit être dans la réponse, pas seulement après hydratation').toContain(
        `>${titre}</h1>`,
      );
    });
  }
});

/**
 * RÈGLE DURE — 15 §3.1 : « l'application admin n'affiche jamais un numéro de
 * téléphone en clair ».
 *
 * La recherche se fait par EMPREINTE (« saisie du numéro → HMAC → recherche, le
 * numéro n'est jamais affiché »), et la fiche masque ce qu'elle montre.
 *
 * Le test ne cherche pas les masques : il cherche ce qui NE DOIT PAS ÊTRE LÀ. Un
 * numéro français ou béninois en clair porte au moins neuf chiffres derrière son
 * indicatif ; « +33 6 12 … » en porte cinq et « +33 6 •• •• •• 18 » en porte cinq
 * aussi. Chercher le masque laisserait passer un numéro complet ajouté À CÔTÉ ;
 * compter les chiffres ne le laisse pas passer.
 */
test('15 §3.1 — aucun numéro de téléphone en clair sur la fiche membre', async ({ page }) => {
  await visiter(page, '/admin/membres');
  const texte = (await page.locator('[data-frame="desktop"]').innerText()).replace(/ /g, ' ');

  // Un indicatif suivi d'au moins neuf chiffres, espaces et points compris.
  const enClair = texte.match(/\+\d{1,3}(?:[\s.]*\d){9,}/g) ?? [];
  expect(enClair, `numéro(s) en clair trouvé(s) : ${enClair.join(', ')}`).toEqual([]);

  // Et la recherche dit par quoi elle passe, ce que §3.1 exige.
  await expect(page.getByText('Recherche par empreinte')).toBeVisible();
  // L'apostrophe est DROITE ici, alors que la maquette emploie la courbe ailleurs.
  // C'est elle qui l'écrit ainsi ; la corriger ferait échouer la recherche.
  await expect(page.getByText("Aucun numéro n'est affiché en clair.")).toBeVisible();
});

/**
 * 13 §4.1 — « une file unique, triée par PRIORITÉ puis `sla_due_at` ».
 *
 * La priorité est dessinée en pastille carrée de 26 px, une par ligne. On lit donc
 * les pastilles dans l'ORDRE DU DOCUMENT, par leur géométrie, et on vérifie que la
 * suite ne décroît jamais. C'est la propriété de §4.1, et elle tombe dès que deux
 * lignes sont interverties dans la maquette.
 */
test('13 §4.1 — la file est ordonnée par priorité croissante', async ({ page }) => {
  await visiter(page, '/admin/moderation');

  const priorites = await page.evaluate(() =>
    [...document.querySelectorAll('span')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return Math.round(r.width) === 26 && Math.round(r.height) === 26;
      })
      .map((el) => Number(el.textContent)),
  );

  expect(priorites.length, 'cinq dossiers sont dessinés dans la file').toBe(5);
  expect(priorites.every((p) => p >= 1 && p <= 5), 'les priorités vont de 1 à 5').toBe(true);
  expect([...priorites].sort((a, b) => a - b)).toEqual(priorites);

  // Le SLA est affiché avec son état : c'est ce qui rend §4.1 vérifiable à l'œil.
  await expect(page.getByText('dépassé', { exact: true })).toBeVisible();
});

/**
 * 13 §4.2 — « une suspension ou un bannissement exige un motif d'au moins 20
 * caractères », et « `BAN_USER` — `SUPER_ADMIN` seulement ».
 *
 * Les deux sont DITS À L'ÉCRAN par la maquette, et c'est ce qui compte : une règle
 * que le serveur tient mais que l'écran ne montre pas se découvre au refus.
 */
test('13 §4.2 — le dossier annonce le motif minimal et le rôle du bannissement', async ({
  page,
}) => {
  await visiter(page, '/admin/moderation/4812');
  await expect(page.getByText('Motif · 20 caractères minimum')).toBeVisible();
  // Le compteur montre que le motif saisi dépasse le minimum.
  await expect(page.getByText('48 / 20', { exact: true })).toBeVisible();
  await expect(page.getByText('Bannir · super-admin')).toBeVisible();
});

/**
 * LA FRONTIÈRE ENTRE LES DEUX DOMAINES (15 §2.1, règle dure).
 *
 * « Un compte équipe ne peut jamais se connecter à l'application membres avec ses
 * identifiants, ni l'inverse. » Cela ne se vérifie pas seulement côté API : un
 * écran d'équipe qui porterait le rail des membres, leur barre d'onglets ou un lien
 * vers leurs pages inviterait à franchir la frontière que le serveur refuse.
 *
 * Le rail d'équipe fait 240 px et porte les neuf entrées que T5 §11 énumère ; celui
 * des membres fait 76 px. La mesure distingue les deux sans ambiguïté.
 */
test('15 §2.1 — le rail est celui de l’équipe, et rien de l’application membres', async ({
  page,
}) => {
  /**
   * ON MESURE LE RAIL SUR UNE PLANCHE STATIQUE, et c'est un choix, pas un hasard.
   *
   * Ce cas visitait `/admin/moderation`. D04 est devenu une page CLIENTE : sans
   * session d'équipe ni charge servie, `EcranDonneesEquipe` affiche son refus — SANS
   * RAIL — et le cas échouait dès `expect(rail).toBeVisible()`. Il parlait alors des
   * DONNÉES tout en prétendant parler du rail, et ce fichier n'intercepte rien, par
   * choix assumé (voir son en-tête).
   *
   * D15 (`/admin/reglages`) est transcodé sans aucun appel : son rail arrive dans le
   * HTML. Et le rail est IDENTIQUE sur les quinze planches — à la surbrillance près —
   * donc le mesurer là ne perd rien et ne peut plus échouer pour la mauvaise cause.
   */
  await visiter(page, '/admin/reglages');

  const rail = page.locator('[data-frame="desktop"] nav');
  await expect(rail).toBeVisible();
  const boite = await rail.boundingBox();
  // Le rail vit dans une colonne de 240 px, moins ses 16 px de marge de chaque côté.
  expect(boite?.width).toBe(208);

  /**
   * LES QUATORZE ENTRÉES — neuf dessinées par la maquette, cinq AJOUTÉES.
   *
   * Cette liste en comptait NEUF, et le rail n'en offrait que neuf pour quinze
   * pages : cinq pages existaient, répondaient, et AUCUNE entrée n'y menait. Le
   * porteur a tranché — « Le rail d'équipe a 9 entrées pour 15 pages c'est à
   * corriger » — et les cinq sont ajoutées par la clé `rail` de
   * `tools/screens/10-administration.mjs`. Les libellés viennent du
   * `data-screen-label` de leur planche, pas d'une invention.
   *
   * L'ordre est celui du rail : chaque enfant immédiatement après son parent.
   */
  for (const entree of [
    'Tableau de bord',
    'Rapport d’impact',
    'Membres',
    'Modération',
    'Parcours',
    'Bibliothèque d’étapes',
    'Contenu',
    'Guides',
    'Alertes arnaques',
    'Référentiels',
    'Services',
    'Revenus',
    'Partenaires',
    'Réglages',
  ]) {
    await expect(rail.getByText(entree, { exact: true })).toHaveCount(1);
  }

  /**
   * AUCUNE BARRE D'ONGLETS DE MEMBRE, ET AUCUN LIEN VERS LEURS PAGES.
   *
   * Cette assertion disait « zéro balise `<a>` dans le cadre », et elle était vraie
   * pour la mauvaise raison : la maquette ne CÂBLE pas son rail — elle le dessine en
   * neuf `<span>`. Le cadre ne contenait donc aucun lien du tout, ce qui satisfaisait
   * la mesure tout en rendant l'application d'équipe entièrement innavigable. Les
   * dix-huit cas de ce fichier passaient parce qu'ils tapent l'URL.
   *
   * Ce qui compte n'est pas qu'il n'y ait AUCUN lien, c'est qu'aucun lien ne sorte du
   * domaine d'équipe. On le mesure donc à l'endroit : tous les liens du cadre, et il
   * y en a, pointent sous `/admin/`.
   */
  await expect(page.getByText('Compte', { exact: true })).toHaveCount(0);
  const liens = page.locator('[data-frame="desktop"] a');
  const combien = await liens.count();
  /**
   * QUATORZE, et le chiffre n'est plus la propriété intéressante : ce qui compte est
   * que les quatorze pointent SOUS `/admin/`. Le nombre reste mesuré pour qu'une
   * entrée perdue en silence se voie — mais la règle « aucune page d'équipe n'est
   * injoignable » est gelée par ENSEMBLES dans `e2e/navigation-rail.spec.ts`, qui
   * compare les routes de `(admin)` aux destinations du rail. Un compte, lui,
   * resterait vert si on retirait une entrée en ajoutant une autre.
   */
  expect(combien, 'le rail d’équipe doit être fait de vrais liens').toBe(14);
  for (let i = 0; i < combien; i += 1) {
    expect(await liens.nth(i).getAttribute('href')).toMatch(/^\/admin(\/|$)/);
  }
  // Aucun cadre mobile : la maquette n'en dessine pas pour l'administration.
  await expect(page.locator('[data-frame="mobile"]')).toHaveCount(0);
});

/**
 * LA BARRE HAUTE RESTE À L'ÉCRAN — l'adaptation du transcodeur, mesurée.
 *
 * La maquette est une IMAGE de 760 px de haut : rien n'y défile, donc sa barre de
 * recherche n'a pas besoin de tenir. Un écran réel défile, et le générateur pose
 * `position: sticky` sur cette barre. Une adaptation qu'on ne mesure pas est une
 * adaptation qu'on croit appliquée — c'est exactement ainsi que la barre d'onglets
 * basse a défilé hors de l'écran sur onze cadres sans que rien ne le dise.
 */
test('la barre haute reste à l’écran quand la page défile', async ({ page }) => {
  // Fenêtre courte : sans cela, ces écrans tiennent d'un bloc et rien ne défile.
  await visiter(page, '/admin/reglages', 1440, 420);

  const hauteurBarre = async (): Promise<number | null> =>
    page.evaluate(() => {
      const barre = [...document.querySelectorAll('div')].find(
        (el) =>
          getComputedStyle(el).position === 'sticky' &&
          Math.round(el.getBoundingClientRect().height) === 64,
      );
      return barre === undefined ? null : Math.round(barre.getBoundingClientRect().top);
    });

  expect(await hauteurBarre(), 'la barre haute est bien collante').toBe(0);

  await page.evaluate(() => window.scrollTo(0, 400));
  expect(await page.evaluate(() => Math.round(window.scrollY)), 'la page a bien défilé').toBeGreaterThan(
    0,
  );
  expect(await hauteurBarre(), 'elle est toujours en haut après défilement').toBe(0);
});

/**
 * RÈGLE DURE — 00 §1.2 et T1 §2.1 : « aucun rouge dans l'interface ».
 *
 * C'est l'endroit du produit où elle est le plus tentante à enfreindre : une
 * alerte arnaque urgente, un abonnement impayé. `check-colors.mjs` garde les
 * JETONS ; ce test garde ce qui est PEINT à l'écran, teinte calculée sur la couleur
 * finale du navigateur — la même mesure que le garde-fou, du côté du pixel.
 */
/**
 * La MÊME définition du rouge que `packages/config/guardrails/check-colors.mjs`, et
 * il a fallu la reprendre en entier.
 *
 * Une première version ne calculait que la teinte, et déclarait le BLANC rouge :
 * une couleur sans saturation a une teinte de 0°, c'est-à-dire exactement celle du
 * rouge vif. Le garde-fou, lui, écarte d'abord les gris (saturation < 25 %) et les
 * quasi-blancs (luminosité > 92 %) — « un test naïf sur R > G et R > B le
 * rejetterait à tort », dit son propre commentaire, et c'est le même piège par
 * l'autre bout.
 *
 * La borne à 15° laisse passer le terre cuite (23°) et refuse le rouge vif (0°)
 * comme le rouge-rose (350°).
 */
const estRouge = (rgb: string): boolean => {
  const [r = 0, g = 0, b = 0] = (rgb.match(/\d+/g) ?? []).slice(0, 3).map((n) => Number(n) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = ((max + min) / 2) * 100;
  const saturation = delta === 0 ? 0 : (delta / (1 - Math.abs((2 * lightness) / 100 - 1))) * 100;
  if (saturation < 25) return false;
  if (lightness > 92 || lightness < 8) return false;
  const h =
    delta === 0
      ? 0
      : max === r
        ? ((g - b) / delta) % 6
        : max === g
          ? (b - r) / delta + 2
          : (r - g) / delta + 4;
  const hue = (h * 60 + 360) % 360;
  return hue >= 345 || hue <= 15;
};

test('00 §1.2 — aucun rouge, pas même sur « Impayé » ni sur une alerte urgente', async ({
  page,
}) => {
  for (const { url, textes } of [
    { url: '/admin/revenus', textes: ['Impayé', 'Remboursé'] },
    { url: '/admin/alertes', textes: ['Urgente', 'Vigilance'] },
  ]) {
    await visiter(page, url);
    for (const texte of textes) {
      const pastille = page.getByText(texte, { exact: true }).first();
      const couleurs = await pastille.evaluate((el) => {
        const s = getComputedStyle(el);
        return [s.backgroundColor, s.color];
      });
      for (const couleur of couleurs) {
        if (couleur.startsWith('rgba(0, 0, 0, 0)')) continue;
        expect(estRouge(couleur), `« ${texte} » sur ${url} peint ${couleur} — un rouge`).toBe(false);
      }
    }
  }
});

/**
 * D08 — la confirmation d'activation est DANS la page, pas dans une fenêtre.
 *
 * La maquette dessine « Activer Nantes ? » en carte de 440 px posée à côté du
 * tableau : ni voile, ni panneau. Elle n'a donc pas été transcodée en modale, et ce
 * test le fixe — si quelqu'un la transforme un jour en `Modal`, ce sera un choix,
 * pas un glissement.
 */
test('02 §4.2 — la confirmation d’activation d’une ville est une carte, pas une boîte de dialogue', async ({
  page,
}) => {
  await visiter(page, '/admin/referentiels');
  /**
   * ── LA VILLE ET LE NOMBRE SONT DEVENUS DES DONNÉES ───────────────────────
   *
   * Ce cas attendait « Activer Nantes ? » et « les 190 membres », mot pour mot.
   * Ce sont les valeurs que la MAQUETTE dessine ; le cadre les lit maintenant du
   * serveur — `Activer {activation.ville} ?` et `{activation.membres} membres`.
   * Le cas rougissait donc sur une liaison réussie, en disant « élément
   * introuvable ».
   *
   * CE QU'IL DOIT TENIR N'A PAS CHANGÉ, et c'est écrit dans son titre : la
   * confirmation est une CARTE DANS LA PAGE, pas une boîte de dialogue. On vérifie
   * donc la FORME — l'invite, sa phrase d'explication, et l'absence de `dialog` —
   * sans réclamer la ville de l'exemple.
   */
  await expect(page.getByText(/^Activer .+ \?$/)).toBeVisible();
  await expect(
    page.getByText(/Un réseau de ville sera créé et les .+ membres y seront rattachés/),
  ).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

/**
 * 15 §4.1 — publier les conditions ou la confidentialité redemande le consentement.
 *
 * L'avertissement est écrit SOUS l'éditeur, à côté du bouton qui déclencherait la
 * chose. C'est la seule garantie qu'un écran peut offrir avant que la route soit
 * branchée, et elle vaut d'être tenue.
 */
test('15 §4.1 — l’écran de contenu prévient avant de republier les conditions', async ({ page }) => {
  await visiter(page, '/admin/contenu');
  await expect(
    page.getByText('Publier cette version redemandera le consentement de tous les membres.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publier la v4' })).toBeVisible();
});

/**
 * 15 §2.3 — le journal d'audit porte ses quatre filtres et son export.
 *
 * « Page “Journal d'audit” filtrable par acteur, action, cible, période ; export
 * CSV. Aucune suppression possible ; rétention 5 ans. » Les quatre filtres et
 * l'export sont dessinés ; aucun bouton de suppression ne l'est, et ce test le dit
 * dans les deux sens.
 */
test('15 §2.3 — le journal d’audit se filtre, s’exporte, et ne se supprime pas', async ({ page }) => {
  await visiter(page, '/admin/reglages');
  const journal = page.locator('[data-frame="desktop"]');
  for (const filtre of ['Acteur ▾', 'Action ▾', 'Cible ▾', 'Période ▾']) {
    await expect(journal.getByText(filtre, { exact: true })).toBeVisible();
  }
  await expect(journal.getByText('Exporter', { exact: true })).toBeVisible();
  await expect(journal.getByText(/Supprimer|Effacer/)).toHaveCount(0);
});
