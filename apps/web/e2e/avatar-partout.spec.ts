import { expect, test } from '@playwright/test';
import { connecter } from './session';
import { monterEnL1 } from './niveau';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « L'IMAGE PROFIL NE S'APPLIQUE PAS SUR TOUTES LES PAGES »                  ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * MESURÉ avant, une photo posée par `PUT /me/avatar`, sur six routes : le rond
 * d'identité portait la photo sur DEUX d'entre elles. L'agenda rendait encore
 * l'aplat de la maquette — son chargeur appelait `construireMoi(displayName)` et
 * le paramètre `avatarUrl` avait une valeur par défaut de `null`, donc le
 * compilateur ne disait rien. Sur le fil, les ronds des publications gardaient
 * les initiales : `avatar()` dans `screens/accueil/from-api.ts` ne lisait pas
 * `memberSummarySchema.avatarUrl`, pourtant servi depuis le début.
 *
 * ── LE RELEVÉ EST GÉOMÉTRIQUE, PAS PAR MARQUEUR ───────────────────────────
 *
 * Les six modules construisent CHACUN leur bandeau — c'est délibéré, chacun lit
 * `GET /me` pour son écran — et aucun ne pose le même attribut. Une première
 * sonde cherchait `[data-carte-membre]` et `[data-k01-photo]` : elle ne trouvait
 * AUCUN rond sur quatre des six routes et concluait à tort qu'il n'y en avait
 * pas. On cherche donc ce qu'un rond d'avatar EST : une boîte carrée, au rayon
 * complet, portant soit l'aplat `#B4581F` de la maquette, soit une image.
 */
const ROUTES = [
  '/accueil',
  '/entraide',
  '/services/logement',
  '/agenda',
  '/compte/profil',
  '/messages',
] as const;

test.describe('la photo de profil suit le membre', () => {
  test('les six modules peignent la photo, et plus l’aplat de la maquette', async ({
    page,
    request,
  }) => {
    const telephone = (page.viewportSize()?.width ?? 0) < 1024;
    const ouvert = await connecter(page.context(), request, { displayName: 'Awa Konaté' });
    /**
     * LE JETON DOIT ÊTRE CELUI DE L'APRÈS-MONTÉE. `monterEnL1` en rend un FRAIS :
     * l'ancien meurt au changement de niveau. Une première sonde passait celui
     * d'avant et lisait un `401` sur `PUT /me/avatar` — donc aucune photo n'était
     * jamais posée, et les six routes montraient légitimement zéro.
     */
    const l1 = await monterEnL1(page.context(), request, ouvert.accessToken);

    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
      'base64',
    );
    const pose = await request.fetch(`${API}/me/avatar`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${l1.accessToken}` },
      multipart: { file: { name: 'moi.png', mimeType: 'image/png', buffer: png } },
    });
    expect(pose.status(), 'la photo n’a pas pu être posée').toBe(200);

    for (const route of ROUTES) {
      await page.goto(route, { waitUntil: 'load' });
      const bande = page.locator('[role="status"]').filter({ hasText: /Chargement/ });
      try {
        await bande.first().waitFor({ state: 'detached', timeout: 20_000 });
      } catch {
        /** Un écran entièrement dessiné n'émet aucune bande : ce n'est pas un échec. */
      }

      /**
       * ── POURQUOI UN SONDAGE RÉPÉTÉ ET NON UNE MESURE UNIQUE ───────────────
       *
       * La bande d'attente dit que `EcranDonnees` a SA donnée. Elle ne dit rien
       * des trois composants d'identité — `CarteMembre`, `PastilleMembre` et
       * `RondMoi` — qui demandent `GET /me` POUR EUX-MÊMES, par une promesse
       * partagée. Mesuré : trois ronds de A01 revenaient « aplat, texte vide »,
       * c'est-à-dire leur état d'attente — « tant qu'on ne sait pas, on n'écrit
       * pas de nom ». Ce n'était pas un défaut d'affichage, c'était une mesure
       * prise un souffle trop tôt.
       *
       * `expect.poll` relève donc jusqu'à ce que plus aucun rond ne soit à la
       * fois sans photo et sans initiales. Un rond qui reste dans cet état est un
       * VRAI défaut — un disque de couleur vide — et l'attente finit par le dire.
       */
      await expect
        .poll(
          async () =>
            page.evaluate(() =>
              [...document.querySelectorAll<HTMLElement>('*')]
                .map((n) => {
                  const s = getComputedStyle(n);
                  if (!s.borderRadius.startsWith('999')) return null;
                  const r = n.getBoundingClientRect();
                  const l = Math.round(r.width);
                  if (l < 28 || l > 96 || Math.abs(l - Math.round(r.height)) > 2) return null;
                  /**
                   * L'aplat `#B4581F` de la maquette, ou une image : rien d'autre
                   * n'est un rond d'avatar. Les ronds des AUTRES membres portent
                   * leurs initiales et une teinte de la palette — ils ne sont donc
                   * ni vides ni, pour la plupart, de cette couleur-ci.
                   */
                  const aplat = s.backgroundColor === 'rgb(180, 88, 31)';
                  const photo = s.backgroundImage.startsWith('url(');
                  if (!aplat && !photo) return null;
                  return {
                    photo,
                    vide: (n.textContent ?? '').trim() === '',
                    taille: l,
                  };
                })
                .filter(
                  (x): x is { photo: boolean; vide: boolean; taille: number } => x !== null,
                )
                /**
                 * LE PRÉDICAT EST ÉVALUÉ DANS LA PAGE et rend un booléen :
                 * `expect.poll` n'offre que les matchers ordinaires, et `toSatisfy`
                 * n'en est pas un — la première version l'employait et jetait.
                 */
                .reduce(
                  (bon, r, _i, tous) => bon && tous.length > 0 && (r.photo || !r.vide),
                  true,
                ),
            ),
          {
            timeout: 20_000,
            message: `${route} : un rond d’avatar reste sans photo ET sans initiales`,
          },
        )
        .toBe(true);

      /**
       * ── ET AU MOINS UN PORTE LA PHOTO — LÀ OÙ LA MAQUETTE EN DESSINE UN ───
       *
       * Sans cette seconde assertion, une page qui n'afficherait que les
       * initiales passerait : c'est exactement l'état d'avant la correction sur
       * `/agenda`.
       *
       * MAIS ELLE NE VAUT PAS PARTOUT SUR LA PLANCHE DE TÉLÉPHONE, et c'est un
       * fait de maquette, pas un défaut. Relevé sur les cadres produits : des
       * quarante-et-un qui dessinent le rond d'identité du membre, UN SEUL est
       * une planche de 390 px — celle du profil (K01). Les autres écrans mobiles
       * n'ont pas de « pastille moi » : la maquette y met une barre d'onglets
       * basse à la place. S'y ajoute le fil (A01), dont le composeur dessine le
       * rond de qui écrit sur les deux planches.
       *
       * Exiger une photo sur `/entraide` à 390 px reviendrait donc à exiger un
       * rond que personne n'a dessiné. On exige ce qui EXISTE, et le premier
       * relevé ci-dessus couvre le reste : aucun rond ne doit rester sans photo
       * NI initiales, sur aucune des six routes et aucune des deux planches.
       */
      const planchesDuRond: readonly string[] = ['/accueil', '/compte/profil'];
      if (telephone && !planchesDuRond.includes(route)) continue;
      const avecPhoto = await page.evaluate(
        () =>
          [...document.querySelectorAll<HTMLElement>('*')].filter((n) => {
            const s = getComputedStyle(n);
            if (!s.borderRadius.startsWith('999')) return false;
            const r = n.getBoundingClientRect();
            const l = Math.round(r.width);
            return (
              l >= 28 &&
              l <= 96 &&
              Math.abs(l - Math.round(r.height)) <= 2 &&
              s.backgroundImage.startsWith('url(')
            );
          }).length,
      );
      expect(avecPhoto, `${route} ne peint la photo du membre nulle part`).toBeGreaterThan(0);
    }
  });
});
