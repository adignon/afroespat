import { expect, test, type APIRequestContext, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { monterParcours } from './parcours-session';
import { monterJalonPartageable } from './aide-w5a';

/**
 * ─── « LES SOUS LIENS », ÉPROUVÉS EN CLIQUANT ────────────────────────────────
 *
 * Verbatim du porteur, en ouvrant le produit : « Les modals aussi ne sont pas
 * fait. Pareil sur les autres pages comme parcours, entraide, services etc...
 * Aucun sous lien aussi ne fonctionne. »
 *
 * `e2e/navigation-rail.spec.ts` garde le rail D'ÉQUIPE. Ce fichier garde la
 * SOUS-NAVIGATION des quatre modules membre — Parcours, Entraide, Services,
 * Agenda — et les fenêtres qu'ils ouvrent.
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ CE QUE LE COMPTEUR DE LA GÉNÉRATION NE VOIT PAS                            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le récapitulatif « ── NAVIGATION ── » compte les `href="#"`. La MOITIÉ du
 * problème lui échappe, parce qu'elle n'est pas faite de liens cassés :
 *
 *   · les 7 entrées du panneau d'Entraide et les 6 de Services sont des `<span>` ;
 *   · les 7 entrées du panneau « MON PARCOURS » aussi ;
 *   · et la BARRE D'ONGLETS BASSE du mobile — la seule navigation d'un téléphone,
 *     puisqu'il n'y a pas de rail — est faite de cinq `<div>`.
 *
 * Aucun de ces contrôles ne portait de `href="#"`, donc aucun n'était compté. Et
 * c'est exactement ce sur quoi le porteur a cliqué. D'où ce fichier : il CLIQUE, et
 * il vérifie l'URL obtenue. Une assertion sur un `href` ne prouverait rien — un
 * parent qui avale le clic, un `pointer-events: none` ou un `preventDefault`
 * passeraient tous.
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ CHAQUE DÉPART N'EST PAS SA DESTINATION, ET C'EST VÉRIFIÉ AVANT LE CLIC     ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Sans cela, un clic parfaitement inerte passerait pour une navigation réussie :
 * l'URL serait « déjà bonne ». C'est le faux vert que `navigation-rail.spec.ts`
 * décrit, et il est ici rendu impossible de la même façon — le chemin de départ est
 * lu et comparé à la destination avant qu'on ne touche à quoi que ce soit.
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA SESSION EST INTERCEPTÉE, PAS OUVERTE                                    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Les écrans de `(app)` sont derrière `GardeSession`, qui redirige vers
 * `/connexion` sans jeton. Ouvrir de vraies sessions coûterait un code OTP par
 * test, et `@RateLimit(10, 'hour', 'ip')` sur `otp/request` n'est PAS exempté en
 * local : dix sessions par heure et tout s'arrête. On intercepte donc
 * `auth/refresh`, idiome de `e2e/shell.spec.ts`.
 *
 * L'ORDRE DES `page.route` EST L'INVERSE DE L'ENREGISTREMENT : un fourre-tout sur
 * tout « /v1/ » posé APRÈS une route précise l'avale. Ici il est enregistré
 * D'ABORD et la route précise ensuite, donc c'est la précise qui gagne. Un agent a
 * eu douze tests verts pour avoir fait l'inverse — la garde redirigeait, les pages
 * mesurées n'étaient pas les bonnes, et le clic partait quand même dans la fraction
 * de seconde où la garde rend ses enfants.
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ UNE ANCRE AVANT TOUTE MESURE                                               ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * `page.evaluate` ne réessaie pas et `boundingBox()` n'a aucune attente intégrée.
 * On attend donc le CADRE (`[data-screen]`) avant de mesurer ou de cliquer — sinon
 * on conclut « le contrôle n'est pas rendu » sur un cadre qui arrive une frame plus
 * tard. Et `toHaveURL` plutôt que `waitForURL` : ce dernier attend `load`, que
 * `next dev` ne rend jamais puisqu'il garde une connexion ouverte.
 */

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA BORNE DE TEMPS EST LARGE, ET C'EST LA MESURE QUI L'A IMPOSÉE            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Un test de NAVIGATION visite forcément une route qu'il n'a jamais visitée — c'est
 * tout son objet. En `next dev`, la PREMIÈRE compilation d'une route prend jusqu'à
 * une minute et demie, et l'URL ne change qu'une fois la charge de la route
 * d'arrivée reçue. Avec les 30 s par défaut, « clic sur Équipe » a échoué sur une
 * route froide et passé sur la même route chaude : un test intermittent, donc un
 * test qu'on finit par ne plus lire.
 *
 * Relever la borne de `toHaveURL` ne suffisait pas — la borne QUI MORD est celle
 * du TEST, et elle plafonne l'autre. Les deux sont donc relevées ensemble.
 *
 * ELLE NE MASQUE RIEN : un clic inerte n'arrive JAMAIS, quelle que soit l'attente.
 * La borne ne change que ce qu'on appelle « trop long », pas ce qu'on appelle
 * « faux ».
 */
test.describe.configure({ timeout: 180_000 });

/** Le jeton que `resumeSession()` reçoit : la garde ouvre, et rien n'est en base. */
const JETON = { accessToken: 'jeton-de-test', isNewUser: false };

test.beforeEach(async ({ page }) => {
  /**
   * LE FOURRE-TOUT D'ABORD, LA ROUTE PRÉCISE ENSUITE — voir l'en-tête.
   *
   * Tout appel non intercepté reçoit un `503` : c'est volontaire. Les écrans
   * mesurés ici rendent leur CADRE avant leur donnée (c'est le `squelette` de
   * `EcranDonnees`), donc le rail, les panneaux et la barre basse sont là même
   * quand l'API ne répond pas — et le test ne dépend d'aucune base semée.
   */
  await page.route('**/v1/**', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"hors test"}' }),
  );
  await page.route('**/v1/auth/refresh', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(JETON) }),
  );
});

/**
 * Pose la page, attend le CADRE, puis attend que REACT L'AIT HYDRATÉ.
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ CE QUE LE RENDU SERVEUR A CHANGÉ POUR CE FICHIER, ET LA MESURE QUI L'A DIT ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Depuis que le cadre est SERVI (voir `screens/compte/ecran-donnees.tsx`), les
 * contrôles EXISTENT dans le HTML avant de FONCTIONNER : le `<button>` du panneau
 * est là, visible, activé, il reçoit les événements — et React ne lui a pas encore
 * attaché son `onClick`. Un clic y tombe dans le vide, sans erreur.
 *
 * Mesuré, et c'est ce qui a coûté cinq échecs identiques : une sonde qui attendait
 * 2,5 s avant de cliquer naviguait bien (`pushState` appelé avec
 * `/parcours/1/equipe`) ; les mêmes cas, qui cliquaient dès que `[data-screen]`
 * était attaché, ne naviguaient jamais. Ce n'était ni la destination, ni le
 * gestionnaire, ni la compilation de la route — c'était l'HYDRATATION.
 *
 * AVANT la correction, ce piège n'existait pas : le cadre n'apparaissait qu'une
 * fois la donnée arrivée, donc toujours après l'hydratation. Le rendre servi l'a
 * créé. C'est le prix du rendu serveur, et le MEMBRE ne le paie pas — pour lui la
 * fenêtre fait quelques dizaines de millisecondes et le clic suivant marche.
 *
 * `__reactFiber$…` est la clé que React pose sur un nœud du DOM qu'il a pris en
 * charge. C'est un détail d'implémentation de React, assumé ICI et nulle part
 * ailleurs : c'est le seul signal d'hydratation qui ne demande pas d'ajouter un
 * marqueur au produit pour les besoins d'un test.
 */
async function visiter(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-screen]').first().waitFor({ state: 'attached' });
  await page.waitForFunction(() => {
    const cadre = document.querySelector('[data-screen]');
    return cadre !== null && Object.keys(cadre).some((k) => k.startsWith('__reactFiber$'));
  });
}

/** Le cadre d'ordinateur, et lui seul. */
const cadreOrdinateur = (page: Page): Locator => page.locator('[data-frame="desktop"]');
/** Le cadre mobile, et lui seul. */
const cadreMobile = (page: Page): Locator => page.locator('[data-frame="mobile"]');

/**
 * Le geste complet : partir d'ailleurs, cliquer, et lire l'URL OBTENUE.
 *
 * Elle est rendue, pas seulement affirmée : les cas la journalisent dans leur
 * assertion, pour que le rapport puisse citer la mesure et pas la promesse.
 */
async function cliquerEtLireLUrl(
  page: Page,
  depart: string,
  controle: Locator,
  destination: string,
): Promise<string> {
  await visiter(page, depart);
  // LE DÉPART N'EST PAS L'ARRIVÉE : sans cela, un clic inerte passerait.
  expect(new URL(page.url()).pathname).toBe(depart);
  expect(depart, 'le départ ne doit pas être la destination').not.toBe(destination);

  await expect(controle).toHaveCount(1);
  await controle.click();
  /**
   * LA BORNE EST LARGE, ET C'EST MESURÉ : en `next dev`, la PREMIÈRE compilation
   * d'une route peut prendre plus d'une minute, et l'URL ne change qu'une fois la
   * charge de la route d'arrivée reçue. Avec les 5 s par défaut, « clic sur Équipe »
   * a échoué sur une route froide et passé sur la même route chaude — un test
   * intermittent, donc un test qu'on finit par ne plus lire. La borne ne masque
   * rien : un clic inerte n'arrive jamais, quelle que soit l'attente.
   */
  await expect(page).toHaveURL(destination, { timeout: 120_000 });
  return new URL(page.url()).pathname;
}

// ══════════════════════════════════════════════════════════════════════════════
// LES PANNEAUX DE SECTION — invisibles au compteur, et pourtant morts
// ══════════════════════════════════════════════════════════════════════════════

test.describe('les panneaux de section NAVIGUENT (ordinateur)', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'le panneau n’existe qu’en 1440 px');

  /**
   * Les destinations sont celles que `tools/screens/05-entraide.mjs` et
   * `06-services.mjs` DÉCLARENT, recopiées ici plutôt que déduites du libellé :
   * c'est la même discipline que la déclaration, et pour la même raison — « Mes
   * annonces » est écrit dans DEUX modules et ne mène pas au même endroit.
   */
  const ENTREES = [
    { depart: '/entraide', libelle: 'Vous pouvez aider', vers: '/entraide/aider' },
    { depart: '/entraide', libelle: 'Mes réponses', vers: '/entraide/mes-reponses' },
    { depart: '/entraide', libelle: 'Devenir parrain', vers: '/parrainage/devenir' },
    { depart: '/entraide', libelle: 'Mes parrainages', vers: '/parrainage/mes-parrainages' },
    { depart: '/services/logement', libelle: 'Bourses et emploi', vers: '/services/emploi' },
    { depart: '/services/logement', libelle: 'Mes alertes', vers: '/services/alertes' },
    { depart: '/services/logement', libelle: 'Ma fiche pro', vers: '/services/annuaire/ma-fiche' },
    { depart: '/services/logement', libelle: 'Mes annonces', vers: '/services/mes-annonces' },
  ] as const;

  for (const { depart, libelle, vers } of ENTREES) {
    test(`${depart} · clic sur « ${libelle} » → ${vers}`, async ({ page }) => {
      /**
       * LE NOM ACCESSIBLE N'EST PAS LE LIBELLÉ SEUL, et c'est la mesure qui l'a
       * dit : la maquette colle une PASTILLE dans la ligne — « Bourses et emploi 8 »,
       * « Mes alertes PREMIUM », « Mes annonces 2 », « Toutes les demandes 41 ». Un
       * `exact: true` rendait zéro élément sur quatre entrées, et c'était un VRAI
       * signal : la pastille fait partie du nom que lit un lecteur d'écran.
       * L'ancrage au début garde la précision sans inventer le compte.
       */
      const lien = cadreOrdinateur(page).getByRole('link', {
        name: new RegExp(`^${libelle}`),
      });
      expect(await cliquerEtLireLUrl(page, depart, lien, vers)).toBe(vers);
    });
  }
});

/**
 * ─── LE PANNEAU « MON PARCOURS » — DES BOUTONS, ET IL FAUT DIRE POURQUOI ────
 *
 * Sa destination dépend du `:id` de la route, et `markLinks` n'accepte un `vers`
 * interpolé que DANS une boucle (garde-fou mesuré : « aucune boucle
 * <sc-for as="…"> n'englobe l'élément promu »). Ces sept entrées passent donc par
 * un gestionnaire, donc par un `<button>` — ce qui clique, mais ne s'ouvre pas dans
 * un nouvel onglet. Le manque est remonté au porteur.
 *
 * `/parcours/1` est l'URL des planches d'illustration : le segment n'est pas un
 * UUID, donc `chargerJ01` n'appelle rien et le cadre est servi tel quel. La
 * navigation, elle, est bien réelle — `/parcours/1/equipe` est une route servie.
 */
test.describe('le panneau « MON PARCOURS » NAVIGUE (ordinateur)', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'le panneau n’existe qu’en 1440 px');

  const ENTREES = [
    { libelle: 'Équipe', vers: '/parcours/1/equipe' },
    { libelle: 'Checklist de documents', vers: '/parcours/1/documents' },
    { libelle: 'Historique', vers: '/parcours/1/historique' },
    { libelle: 'Réglages', vers: '/parcours/1/reglages' },
    { libelle: 'Discussion', vers: '/parcours/1/discussion' },
    { libelle: 'Étape en cours', vers: '/parcours/1/etapes' },
  ] as const;

  for (const { libelle, vers } of ENTREES) {
    test(`/parcours/1 · clic sur « ${libelle} » → ${vers}`, async ({ page }) => {
      const bouton = cadreOrdinateur(page)
        .getByRole('button', { name: new RegExp(`^${libelle}`) })
        .first();
      expect(await cliquerEtLireLUrl(page, '/parcours/1', bouton, vers)).toBe(vers);
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// LES `href="#"` QUE LA MAQUETTE BALISAIT SANS LES ADRESSER
// ══════════════════════════════════════════════════════════════════════════════

test.describe('les liens balisés mais non adressés NAVIGUENT (ordinateur)', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'cadre d’ordinateur');

  const CAS = [
    { depart: '/parcours/1', libelle: 'Nouveau parcours', vers: '/parcours/nouveau' },
  ] as const;

  for (const { depart, libelle, vers } of CAS) {
    test(`${depart} · clic sur « ${libelle} » → ${vers}`, async ({ page }) => {
      const lien = cadreOrdinateur(page)
        .getByRole('link', { name: new RegExp(`^${libelle}$`) })
        .first();
      expect(await cliquerEtLireLUrl(page, depart, lien, vers)).toBe(vers);
    });
  }
});

test.describe('deux liens qui ont changé de nature avec les données vives (ordinateur)', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'cadre d’ordinateur');

  test('un vrai parcours · clic sur « Voir tous » → /parcours/publics', async ({ page, context, request }) => {
    /**
     * `/parcours/1` (planche d'illustration) répond « Ce parcours n'est pas ouvert » et ne
     * dessine plus la colonne des parcours publics : « Voir tous » n'existe que sur un
     * VRAI parcours. Le décor est donc réel (`monterParcours`), et les interceptions de ce
     * fichier — qui répondent 503 à toute l'API — sont retirées pour ce cas.
     */
    await page.unroute('**/v1/**');
    await page.unroute('**/v1/auth/refresh');
    const m = await monterParcours(context, request);
    const lien = cadreOrdinateur(page).getByRole('link', { name: /^Voir tous$/ }).first();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/parcours/${m.journeyId}`, { waitUntil: 'load' });
    await expect(lien).toHaveCount(1, { timeout: 20_000 });
    await lien.click();
    await expect(page).toHaveURL(/\/parcours\/publics$/, { timeout: 60_000 });
  });

  test('/services/logement · aucune offre « Premium » n’est promue : tout est gratuit', async ({ page }) => {
    /**
     * ATTENTE RETOURNÉE PAR DÉCISION DU PORTEUR (« Tout sera gratuit pour le moment »).
     * Le lien « Premium » → /premium de la colonne des services était une promotion de
     * plan payant ; elle a été retirée avec les limites de plan. Le cas garde sa valeur
     * dans l'autre sens : s'il revenait, l'écran se remettrait à vendre un plan que
     * personne ne peut acheter.
     */
    await visiter(page, '/services/logement');
    await expect(cadreOrdinateur(page).getByRole('link', { name: /^Premium$/ })).toHaveCount(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// LA BARRE D'ONGLETS BASSE — LA SEULE NAVIGATION D'UN TÉLÉPHONE
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Elle était faite de cinq `<div>`. Sur un téléphone il n'y a PAS de rail : ces
 * cadres n'avaient donc aucune sortie, et aucun `href="#"` ne le signalait.
 *
 * « Compte » reste un `<div>` et ce n'est pas un oubli : il n'existe aucune route
 * `/compte` — seulement des sous-pages. Le cas ci-dessous le MESURE, pour que le
 * jour où le porteur tranche, le test rougisse au lieu de laisser le trou.
 */
test.describe('la barre d’onglets basse NAVIGUE (mobile)', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 1024, 'la barre n’existe qu’en 390 px');

  const CAS = [
    { depart: '/agenda', libelle: 'Parcours', vers: '/parcours' },
    { depart: '/agenda', libelle: 'Entraide', vers: '/entraide' },
    { depart: '/entraide', libelle: 'Accueil', vers: '/accueil' },
    { depart: '/entraide', libelle: 'Services', vers: '/services/logement' },
  ] as const;

  for (const { depart, libelle, vers } of CAS) {
    test(`${depart} · clic sur « ${libelle} » → ${vers}`, async ({ page }) => {
      const lien = cadreMobile(page).getByRole('link', { name: libelle, exact: true }).first();
      expect(await cliquerEtLireLUrl(page, depart, lien, vers)).toBe(vers);
    });
  }

  test('« Compte » n’est PAS un lien : aucune route /compte n’existe', async ({ page }) => {
    await visiter(page, '/agenda');
    const barre = cadreMobile(page);
    await expect(barre.getByRole('link', { name: 'Accueil', exact: true })).toHaveCount(1);
    /**
     * L'absence est la mesure. `app/(app)/compte/` n'a que des sous-pages et pas de
     * `page.tsx` : poser un lien demanderait de choisir laquelle EST « Compte », ce
     * qui est l'arbitrage du porteur. Le jour où il tranchera, ce cas rougira — et
     * c'est précisément ce qu'on veut d'un trou connu.
     */
    await expect(barre.getByRole('link', { name: 'Compte', exact: true })).toHaveCount(0);
    await expect(barre.getByText('Compte', { exact: true })).toHaveCount(1);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// LES FENÊTRES — OUVERTURE, FERMETURE, PIÈGE À TAB, RETOUR DU FOCUS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ UN TEST DE PIÈGE À TAB SE MESURE SUR LE FOCUS, PAS SUR LA STRUCTURE        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Ce dépôt a déjà hébergé un test creux exactement là : il mesurait la POSITION DU
 * PORTAIL dans le DOM au lieu du parcours réel du focus. Le portail peut être au
 * bon endroit et le focus sortir quand même — un `tabindex` oublié, un
 * `aria-hidden` mal posé, un `focusable` hors du panneau. Les cas ci-dessous lisent
 * donc `document.activeElement` après chaque `Tab`, et vérifient qu'il est TOUJOURS
 * dans le panneau.
 *
 * `/parcours/1` ouvre J03 « Je suis bloqué·e » : le déclencheur est marqué par le
 * générateur (`data-modal-open="J03"`), et l'ouverture n'appelle rien puisque le
 * segment n'est pas un UUID.
 */
const panneau = (page: Page): Locator => page.locator('[data-modal-panel]');

/**
 * LES FENÊTRES MESURÉES, et le contrôle que LA MAQUETTE dessine pour chacune.
 *
 * Les déclencheurs sont ceux que `tools/screens/04-parcours.mjs` DÉCLARE
 * (`triggers`), et le générateur les marque `data-modal-open` — rien n'est posé à
 * la main dans le JSX, que la régénération effacerait.
 *
 * `/parcours/1` est l'URL des planches d'illustration : le segment n'est pas un
 * UUID, donc l'ouverture de J03 n'appelle AUCUNE route (`ouvrirBlocage` reste
 * inerte sans `journeyId`). La fenêtre est donc mesurée pour ce qu'elle est — une
 * fenêtre — et pas pour ce que le réseau fait.
 */
const FENETRES = [
  { nom: 'J03 · Je suis bloqué·e', depart: '/parcours/1', controle: /Je suis bloqué/ },
  /**
   * VAGUE 5 — J04 N'EST PLUS UNE PLANCHE D'ILLUSTRATION : « Partager » n'est proposé que
   * pour une étape MAJEURE franchie, sur un VRAI parcours (`colonne.tsx`). `depart: null`
   * veut dire « décor réel » : `monterJalonPartageable`, et les interceptions 503 de ce
   * fichier sont retirées pour ce cas.
   */
  { nom: 'J04 · Partager un jalon', depart: null, controle: /^Partager$/ },
] as const;

for (const { nom, depart, controle } of FENETRES) {
  test.describe(`la fenêtre « ${nom} »`, () => {
    test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, 'mesurée sur le cadre d’ordinateur');

    /** Le déclencheur que la maquette dessine, et celui-là seulement. */
    const declencheur = (page: Page): Locator =>
      cadreOrdinateur(page).getByRole('button', { name: controle }).first();

    const aller = async (page: Page, context: BrowserContext, request: APIRequestContext): Promise<void> => {
      if (depart !== null) return visiter(page, depart);
      await page.unroute('**/v1/**');
      await page.unroute('**/v1/auth/refresh');
      const jalon = await monterJalonPartageable(context, request);
      await visiter(page, `/parcours/${jalon.journeyId}`);
      await expect(declencheur(page)).toHaveCount(1, { timeout: 20_000 });
    };

    test('elle s’OUVRE au clic sur le contrôle que la maquette dessine', async ({ page, context, request }) => {
      await aller(page, context, request);
      await expect(panneau(page)).toHaveCount(0);
      await declencheur(page).click();
      await expect(panneau(page).first()).toBeVisible();
    });

    test('elle se FERME par la croix', async ({ page, context, request }) => {
      await aller(page, context, request);
      await declencheur(page).click();
      await expect(panneau(page).first()).toBeVisible();
      await page.locator('[data-modal-close]').first().click();
      await expect(panneau(page)).toHaveCount(0);
    });

    test('elle se FERME par Échap', async ({ page, context, request }) => {
      await aller(page, context, request);
      await declencheur(page).click();
      await expect(panneau(page).first()).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(panneau(page)).toHaveCount(0);
    });

    /**
     * LE CLIC HORS DU PANNEAU FERME, et il est visé par la GÉOMÉTRIE : on lit la
     * boîte du panneau, puis on clique au coin haut-gauche de la fenêtre, là où le
     * voile est seul — ce que l'assertion sur la boîte vérifie d'abord. Un
     * sélecteur de voile passerait même si le panneau le recouvrait entièrement.
     */
    test('elle se FERME au clic hors du panneau', async ({ page, context, request }) => {
      await aller(page, context, request);
      await declencheur(page).click();
      await expect(panneau(page).first()).toBeVisible();
      const boite = await panneau(page).first().boundingBox();
      expect(boite, 'le panneau doit avoir une boîte mesurable').not.toBeNull();
      expect(boite!.x, 'le coin haut-gauche doit être HORS du panneau').toBeGreaterThan(10);
      await page.mouse.click(6, 6);
      await expect(panneau(page)).toHaveCount(0);
    });

    /**
     * LE PIÈGE À TAB, MESURÉ SUR LE FOCUS RÉEL.
     *
     * On tabule plus de fois qu'il n'y a d'éléments focalisables dans le panneau —
     * ce qui force au moins un tour complet — et on lit `document.activeElement` à
     * CHAQUE coup. Sortir une seule fois suffit à faire rougir.
     */
    test('elle PIÈGE le Tab à l’intérieur', async ({ page, context, request }) => {
      await aller(page, context, request);
      await declencheur(page).click();
      await expect(panneau(page).first()).toBeVisible();

      const focalisables = await page.evaluate(() => {
        const p = document.querySelector('[data-modal-panel]');
        if (p === null) return -1;
        return p.querySelectorAll(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ).length;
      });
      expect(
        focalisables,
        'le panneau doit contenir au moins un élément focalisable',
      ).toBeGreaterThan(0);

      for (let i = 0; i < focalisables + 3; i += 1) {
        await page.keyboard.press('Tab');
        const dedans = await page.evaluate(() => {
          const p = document.querySelector('[data-modal-panel]');
          const actif = document.activeElement;
          return p !== null && actif !== null && (p === actif || p.contains(actif));
        });
        expect(dedans, `au ${i + 1}e Tab, le focus est SORTI du panneau`).toBe(true);
      }
    });

    /**
     * LE FOCUS REVIENT AU CONTRÔLE QUI A OUVERT. C'est la moitié qu'on oublie :
     * sans elle, refermer renvoie le focus au début du document et un membre au
     * clavier doit re-parcourir toute la page.
     */
    test('elle REND le focus au contrôle qui l’a ouverte', async ({ page, context, request }) => {
      await aller(page, context, request);
      const bouton = declencheur(page);
      await bouton.focus();
      await expect(bouton).toBeFocused();
      await bouton.click();
      await expect(panneau(page).first()).toBeVisible();
      // Le focus est ENTRÉ dans le panneau : sans cela, le retour ne prouverait rien.
      await expect(bouton).not.toBeFocused();

      await page.keyboard.press('Escape');
      await expect(panneau(page)).toHaveCount(0);
      await expect(bouton).toBeFocused();
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// UN CHARGEMENT EN ÉCHEC LAISSE UNE NAVIGATION AU MEMBRE
// ══════════════════════════════════════════════════════════════════════════════

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE DÉFAUT GELÉ PAR CE CAS                                                  ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * `screens/compte/ecran-donnees.tsx` rendait, sur échec, un `<div>` qui remplaçait
 * LE CADRE ENTIER — rail compris. Le membre lisait « Une erreur est survenue de
 * notre côté » et n'avait plus aucune sortie hors du bouton retour du navigateur.
 * Le lien « Se reconnecter » n'apparaît que sur 401/403, donc jamais sur une erreur
 * serveur ni sur une coupure réseau. Et `screens/parcours/ecran-donnees.tsx`
 * portait LA MÊME fonction, dupliquée — sept modules enfermés, pas six.
 *
 * L'échec est PROVOQUÉ (`500` sur la lecture de la liste) plutôt qu'attendu : un
 * test qui espère une panne ne la mesure jamais.
 *
 * `/entraide` sert maintenant son cadre avant sa donnée, donc le rail est là ET la
 * bande dit l'échec. Le cas vérifie les deux, et qu'un clic MARCHE — parce qu'un
 * rail visible dans un cadre figé ne serait pas une sortie.
 */
/**
 * L'annonce de l'échec, et SEULEMENT elle.
 *
 * `getByRole('alert')` seul rend DEUX éléments : la bande, et
 * `#__next-route-announcer__` que Next pose sur chaque page avec le même rôle.
 * Playwright refuse alors en mode strict — ce qui est juste, et c'est un signal
 * utile : un test qui aurait pris l'annonceur de Next pour la bande serait resté
 * vert sans rien mesurer. On la distingue par son CONTENU, pas par une classe.
 */
const bandeEchec = (page: Page): Locator =>
  page.getByRole('alert').filter({ hasText: 'Réessayer' });

test.describe('un chargement en échec laisse une navigation au membre', () => {
  test.beforeEach(async ({ page, context, request }) => {
    // Posée APRÈS celles du `beforeEach` global, donc elle gagne : l'ordre des
    // `page.route` est l'inverse de l'enregistrement.
    await page.route('**/v1/help*', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'INTERNAL', message: 'panne simulée' } }),
      }),
    );
  });

  test('l’échec est annoncé, et le rail reste à l’écran', async ({ page, context, request }) => {
    await visiter(page, '/entraide');
    // L'échec est ANNONCÉ : `role="alert"`, pas un texte muet.
    await expect(bandeEchec(page)).toBeVisible();
    // Et le cadre est TOUJOURS là : c'est ce que le défaut retirait.
    await expect(page.locator('[data-screen="H01"]')).toBeVisible();
  });

  test('le membre peut PARTIR : un clic change l’URL', async ({ page, viewport }) => {
    await visiter(page, '/entraide');
    await expect(bandeEchec(page)).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/entraide');

    /**
     * On clique la sortie que la LARGEUR donne : le rail en 1440 px, la barre basse
     * en 390 px. Mesurer le rail sur un téléphone n'aurait aucun sens — la maquette
     * n'y en dessine pas — et c'est précisément la largeur où le membre était le
     * plus enfermé.
     */
    const cadre = (viewport?.width ?? 0) >= 1024 ? cadreOrdinateur(page) : cadreMobile(page);
    const sortie = cadre.getByRole('link', { name: 'Accueil', exact: true }).first();
    await expect(sortie).toHaveCount(1);
    await sortie.click();
    await expect(page).toHaveURL('/accueil');
  });

  /**
   * « RÉESSAYER » EXISTE ET RELANCE. Sans lui, la seule issue d'une coupure réseau
   * serait de quitter la page — donc de perdre le contexte pour une panne d'une
   * seconde.
   */
  test('« Réessayer » relance le chargement', async ({ page, context, request }) => {
    /**
     * ON COMPTE SUR LE FOURRE-TOUT, ET LA MESURE L'A IMPOSÉ.
     *
     * Première version : le compteur était posé sur « /v1/help ». Il est resté à
     * ZÉRO alors que la bande d'échec s'affichait — parce que `chargerH01` lit
     * `/me` AVANT la liste, et que c'est ce premier appel qui échoue. Compter la
     * route que l'on croit appelée aurait fait un test vert sur un `avant = 0`
     * si l'assertion de non-vacuité n'avait pas été là. Elle y était, et c'est
     * elle qui a trouvé la cause.
     *
     * `auth/refresh` est RÉ-ENREGISTRÉ après le compteur : l'ordre des
     * `page.route` est l'inverse de l'enregistrement, donc sans cela le compteur
     * avalerait le rafraîchissement, la garde redirigerait vers `/connexion`, et
     * le test mesurerait une page qui n'est pas la bonne.
     */
    let lectures = 0;
    await page.route('**/v1/**', (route) => {
      lectures += 1;
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'INTERNAL', message: 'panne simulée' } }),
      });
    });
    await page.route('**/v1/auth/refresh', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(JETON) }),
    );

    await visiter(page, '/entraide');
    await expect(bandeEchec(page)).toBeVisible();
    const avant = lectures;
    expect(avant, 'la lecture doit avoir été tentée au moins une fois').toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Réessayer' }).click();
    await expect
      .poll(() => lectures, { message: '« Réessayer » n’a relancé aucune lecture' })
      .toBeGreaterThan(avant);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ZÉRO DÉRIVE DE DESSIN — MESURÉE PAR LE NAVIGATEUR, PAS RELUE
// ══════════════════════════════════════════════════════════════════════════════

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ C'EST LA MOITIÉ DU CONTRAT DE CE MÉCANISME                                 ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Promouvoir un `<span>` ou un `<div>` en `<a>` apporte trois valeurs du
 * NAVIGATEUR que l'élément d'origine n'avait pas : `color: -webkit-link`,
 * `text-decoration: underline`, `cursor: pointer`. Les deux premières
 * CHANGERAIENT LE DESSIN — du bleu souligné dans un panneau vert.
 *
 * `markLinks` les PRÉFIXE au style de la maquette, pour que celui-ci gagne la
 * fusion par propriété (`styleToJsx` garde la dernière déclaration). Ce cas mesure
 * le résultat CALCULÉ par le navigateur, qui est le seul juge : une relecture du
 * JSX ne verrait pas une feuille de style globale, un `:link` hérité ou un
 * `all: revert` posé plus haut.
 *
 * Les valeurs attendues sont celles de la maquette, relevées sur ses octets — pas
 * recopiées du JSX produit, ce qui ne prouverait que la cohérence du générateur
 * avec lui-même.
 */
test.describe('la promotion en lien ne change NI la couleur NI la géométrie', () => {
  const lu = (l: Locator) =>
    l.evaluate((n) => {
      const s = getComputedStyle(n as Element);
      return {
        color: s.color,
        background: s.backgroundColor,
        decoration: s.textDecorationLine,
        cursor: s.cursor,
        height: s.height,
        padding: s.paddingLeft,
        weight: s.fontWeight,
        size: s.fontSize,
      };
    });

  test('le panneau d’Entraide garde ses teintes et ses 44 px', async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) < 1024, 'le panneau n’existe qu’en 1440 px');
    await visiter(page, '/entraide');
    const actif = cadreOrdinateur(page).getByRole('link', { name: /^Toutes les demandes/ });
    const repos = cadreOrdinateur(page).getByRole('link', { name: /^Devenir parrain/ });
    await expect(actif).toHaveCount(1);

    const a = await lu(actif);
    const r = await lu(repos);

    // Les teintes de la maquette, intactes. Aucune n'est assombrie.
    expect(a.color).toBe('rgb(15, 92, 72)'); // #0F5C48 — l'entrée que la maquette PEINT
    expect(a.background).toBe('rgb(227, 240, 235)'); // #E3F0EB
    expect(r.color).toBe('rgb(22, 33, 29)'); // #16211D — une entrée au repos
    expect(r.background).toBe('rgba(0, 0, 0, 0)'); // transparent
    // Aucun soulignement : la valeur par défaut du `<a>` est neutralisée.
    expect(a.decoration).toBe('none');
    expect(r.decoration).toBe('none');
    // Le clic est ANNONCÉ, ce que le `<span>` ne faisait pas.
    expect(a.cursor).toBe('pointer');
    // La géométrie de la maquette ne bouge pas d'un pixel : 44 px de haut,
    // 12 px de retrait — c'est `padding: 0 12px` que le préfixe aurait écrasé.
    expect(a.height).toBe('44px');
    expect(a.padding).toBe('12px');
    expect(a.weight).toBe('700');
    expect(r.weight).toBe('500');
    expect(a.size).toBe('13.5px');
  });

  test('la barre d’onglets basse garde ses teintes et ses 54 px', async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) >= 1024, 'la barre n’existe qu’en 390 px');
    await visiter(page, '/entraide');
    const actif = cadreMobile(page).getByRole('link', { name: 'Entraide', exact: true }).first();
    const repos = cadreMobile(page).getByRole('link', { name: 'Accueil', exact: true }).first();
    await expect(actif).toHaveCount(1);

    const a = await lu(actif);
    const r = await lu(repos);

    expect(a.color).toBe('rgb(15, 92, 72)'); // #0F5C48 — l'onglet de la page courante
    expect(a.background).toBe('rgb(227, 240, 235)'); // #E3F0EB
    expect(r.color).toBe('rgb(138, 149, 143)'); // #8A958F — un onglet au repos
    expect(a.decoration).toBe('none');
    expect(r.decoration).toBe('none');
    expect(a.cursor).toBe('pointer');
    expect(a.height).toBe('54px');
    expect(a.size).toBe('10px');
    expect(a.weight).toBe('700');
  });

  /**
   * LE PANNEAU « MON PARCOURS » EST PROMU EN BOUTONS, et un `<button>` apporte
   * PLUS qu'un `<a>` : une bordure, un remplissage, une police et un alignement
   * du navigateur. `markLinks` les préfixe aussi — ce cas le mesure, parce que
   * c'est là que la dérive serait la plus visible (un bouton gris à bord épais
   * dans une carte blanche).
   */
  test('le panneau « MON PARCOURS » garde ses teintes et ses 44 px', async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) < 1024, 'le panneau n’existe qu’en 1440 px');
    await visiter(page, '/parcours/1');
    const actif = cadreOrdinateur(page).getByRole('button', { name: /^Vue d’ensemble/ }).first();
    const repos = cadreOrdinateur(page).getByRole('button', { name: /^Historique/ }).first();
    await expect(actif).toHaveCount(1);

    const a = await lu(actif);
    const r = await lu(repos);

    expect(a.color).toBe('rgb(15, 92, 72)'); // #0F5C48
    expect(a.background).toBe('rgb(227, 240, 235)'); // #E3F0EB
    expect(r.color).toBe('rgb(22, 33, 29)'); // #16211D
    expect(a.cursor).toBe('pointer');
    expect(a.height).toBe('44px');
    // `padding: 0 12px` de la maquette, QUE le `padding: 0` du bouton aurait écrasé.
    expect(a.padding).toBe('12px');
    expect(a.weight).toBe('700');
    expect(r.weight).toBe('500');
    expect(a.size).toBe('13.5px');
    // Et aucune bordure de bouton : la maquette n'en dessine pas.
    const bordure = await actif.evaluate((n) => getComputedStyle(n as Element).borderTopWidth);
    expect(bordure).toBe('0px');
  });
});
