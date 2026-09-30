import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * LES TROIS RÈGLES DU COMPOSEUR, telles que la maquette les ÉCRIT.
 *
 * La planche « COMPOSANTS » de la section A01S de `docs/template/03 Accueil v2.dc.html`
 * énonce trois règles en toutes lettres, sous trois cartes nommées :
 *
 *   · Images  — « Jusqu’à 4. Miniatures avec croix, case « + » pour en ajouter. »
 *   · Sondage — « Un seul par publication. Aperçu compact avec Modifier et retirer. »
 *   · Guides  — « Jusqu’à 3. Étiquettes vertes avec croix. »
 *
 * Ce ne sont pas des intentions : ce sont des bornes, et une publication qui les
 * dépasse est un défaut de produit. Elles sont donc figées ici.
 *
 * ── POURQUOI CE TEST LIT LA MAQUETTE, ET NON L'APPLICATION ────────────────────
 *
 * Il faut le dire franchement, parce que c'est la limite de ce qu'il garde. Le
 * composeur N'A AUCUN ÉTAT dans l'application : la planche transcodée est
 * entièrement statique — zéro interpolation `{{ }}`, compté — et l'application ne
 * connaît aujourd'hui ni liste d'images, ni sondage, ni guides liés. Un test qui
 * compterait les miniatures d'une page figée ne pourrait JAMAIS rougir : il serait
 * exactement le test creux que ce dépôt a déjà reçu six fois.
 *
 * Le seul endroit où ces trois nombres existent vraiment aujourd'hui, c'est la
 * maquette elle-même. Ce test y lit donc le composeur DESSINÉ et vérifie qu'il
 * respecte les bornes que la même maquette énonce deux blocs plus bas. Il attrape
 * la contradiction à sa source : le jour où quelqu'un dessine une cinquième
 * miniature, le transcodage la reproduirait fidèlement dans l'application, et
 * personne ne verrait que la règle vient d'être enfreinte.
 *
 * Quand le composeur aura un état — lot 3, quand `POST /posts` acceptera des pièces
 * jointes — les trois constantes ci-dessous déménagent dans le garde-fou d'exécution
 * et ce test devient sa doublure côté design. Les nombres, eux, ne changent pas.
 *
 * ── LE PIÈGE, ET POURQUOI IL EST NOMMÉ ICI ───────────────────────────────────
 *
 * Le nombre d'images est dessiné TROIS FOIS dans le même composeur :
 *
 *   1. les miniatures elles-mêmes (« Photo 1 », « Photo 2 ») ;
 *   2. le compteur de la case « + » (« 2 / 4 ») ;
 *   3. la pastille de l'icône (« 2 images »).
 *
 * Deux de ces trois ne décident de RIEN : ce sont des étiquettes. Un test qui
 * compterait « 2 images » resterait vert alors même que la maquette dessinerait
 * cinq miniatures — la pastille, elle, n'aurait pas bougé. C'est précisément ainsi
 * qu'une mutation passe au vert sans que le test garde quoi que ce soit.
 *
 * On compte donc LES MINIATURES, les étiquettes vertes et les aperçus de sondage :
 * ce qui est réellement affiché, jamais ce qui prétend le décrire.
 */

const MAQUETTE = resolve(import.meta.dirname, '../../../../../docs/template/03 Accueil v2.dc.html');

/** Les trois bornes, recopiées de la planche « COMPOSANTS » sans être arrondies. */
const MAX_IMAGES = 4;
const MAX_SONDAGES = 1;
const MAX_GUIDES = 3;

/**
 * Les signatures STRUCTURELLES de chaque pièce jointe, prises sur le dessin.
 *
 * Elles ne visent aucun texte : « Photo 1 » est un contenu d'exemple, alors qu'une
 * miniature de 92 px au fond hachuré est ce que la maquette dessine POUR une image.
 * Un test qui compterait « Photo \d » manquerait la sixième photo si elle
 * s'appelait autrement.
 */
const MINIATURE = /width:92px;height:92px;border-radius:14px/g;
const ETIQUETTE_GUIDE = /background:#EFF7F3;color:#0F5C48;[^"]*padding:6px 8px 6px 12px;border-radius:999px/g;
/** L'aperçu compact du sondage : sa barre d'histogramme, suivie de « Modifier ». */
const APERCU_SONDAGE = /M4 20V10M10 20V4M16 20v-7M22 20H2[\s\S]{0,400}?>Modifier</g;

/**
 * Le composeur REMPLI, isolé des deux autres dessins de la même colonne.
 *
 * La colonne de 760 px de A01S contient six blocs : la légende, le composeur
 * rempli, la légende « COMPOSANTS », la grille des trois règles, la phrase sur
 * l'icône, la légende « ÉTAT VIDE » et le composeur vide. Compter sur la colonne
 * entière mélangerait le composeur rempli et le composeur vide — et les icônes de
 * la grille des règles, qui dessinent elles aussi un livre et un histogramme.
 *
 * On isole donc l'enfant direct qui porte le composeur rempli, et lui seul.
 */
function enfantsDirects(html: string): readonly string[] {
  const enfants: string[] = [];
  let profondeur = 0;
  let debut: number | null = null;
  for (const m of html.matchAll(/<div\b[^>]*>|<\/div>/g)) {
    if (m[0] === '</div>') {
      if (profondeur === 0) break;
      profondeur -= 1;
      if (profondeur === 0 && debut !== null) {
        enfants.push(html.slice(debut, m.index + m[0].length));
        debut = null;
      }
      continue;
    }
    if (profondeur === 0) debut = m.index;
    profondeur += 1;
  }
  return enfants;
}

function composeurs(): { readonly web: string; readonly mobile: string } {
  const html = readFileSync(MAQUETTE, 'utf8');
  const debut = html.indexOf('<section id="A01S"');
  const section = html.slice(debut, html.indexOf('</section>', debut));

  const colonne = section.indexOf('<div style="width:760px');
  expect(colonne, 'la colonne « COMPOSEUR AVEC PIÈCES JOINTES — WEB » doit exister').toBeGreaterThan(0);
  const enfants = enfantsDirects(section.slice(section.indexOf('>', colonne) + 1));

  /**
   * Le composeur rempli est le bloc qui suit la légende, reconnu à son contenu et
   * non à son rang : un bloc ajouté à la planche décalerait un index en silence.
   */
  const web = enfants.find((e) => e.includes('Photo 1') && e.includes('Publier'));
  expect(web, 'le composeur rempli (web) doit être trouvé dans la colonne').toBeDefined();

  // Le cadre mobile de 390 px, second de la section : le composeur en plein écran.
  const cadres = [...section.matchAll(/<div style="width:390px/g)].map((m) => m.index);
  expect(cadres.length, 'A01S dessine deux cadres de 390 px').toBe(2);
  const apres = section.slice(cadres[1] ?? 0);
  const mobile = enfantsDirects(apres.slice(apres.indexOf('>') + 1)).join('');

  return { web: web ?? '', mobile };
}

describe('les trois règles de la planche « COMPOSANTS » (A01S)', () => {
  const { web, mobile } = composeurs();
  const cadres = [
    { nom: 'composeur web', html: web },
    { nom: 'composeur mobile', html: mobile },
  ];

  for (const { nom, html } of cadres) {
    /** « Images — Jusqu’à 4. Miniatures avec croix, case « + » pour en ajouter. » */
    it(`${nom} — au plus ${MAX_IMAGES} miniatures d’image`, () => {
      const miniatures = html.match(MINIATURE)?.length ?? 0;
      expect(miniatures, 'le composeur doit dessiner au moins une miniature').toBeGreaterThan(0);
      expect(miniatures).toBeLessThanOrEqual(MAX_IMAGES);
    });

    /** « Sondage — Un seul par publication. Aperçu compact avec Modifier et retirer. » */
    it(`${nom} — au plus ${MAX_SONDAGES} sondage`, () => {
      const apercus = html.match(APERCU_SONDAGE)?.length ?? 0;
      expect(apercus, 'le composeur rempli doit dessiner son aperçu de sondage').toBeGreaterThan(0);
      expect(apercus).toBeLessThanOrEqual(MAX_SONDAGES);
    });

    /** « Guides — Jusqu’à 3. Étiquettes vertes avec croix. » */
    it(`${nom} — au plus ${MAX_GUIDES} étiquettes de guide`, () => {
      const etiquettes = html.match(ETIQUETTE_GUIDE)?.length ?? 0;
      expect(etiquettes, 'le composeur doit dessiner son étiquette de guide').toBeGreaterThan(0);
      expect(etiquettes).toBeLessThanOrEqual(MAX_GUIDES);
    });
  }

  /**
   * LES TROIS RÈGLES SONT TOUJOURS ÉCRITES DANS LA MAQUETTE.
   *
   * Sans cette garde, les trois bornes ci-dessus deviendraient des nombres orphelins
   * le jour où quelqu'un réécrit la planche « COMPOSANTS » : le test continuerait de
   * passer en gardant une règle que la maquette n'énonce plus. Le texte est donc
   * recopié au caractère près, apostrophes typographiques comprises.
   */
  it('la planche « COMPOSANTS » énonce toujours les trois règles, mot pour mot', () => {
    const html = readFileSync(MAQUETTE, 'utf8');
    expect(html).toContain('Jusqu’à 4. Miniatures avec croix, case « + » pour en ajouter.');
    expect(html).toContain('Un seul par publication. Aperçu compact avec Modifier et retirer.');
    expect(html).toContain('Jusqu’à 3. Étiquettes vertes avec croix.');
  });
});
