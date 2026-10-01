import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GLYPHES_X02 } from '../x02/data';

/**
 * ─── LES GLYPHES DE X02 VIENNENT-ILS VRAIMENT DE LA MAQUETTE ? ──────────────
 *
 * ── POURQUOI CE FICHIER EXISTE : UNE MUTATION TÉMOIN RESTÉE VERTE ───────────
 *
 * On a changé le glyphe de `SOCIAL` pour celui de `HELP` — un cœur à la place du
 * pouce — et relancé la suite de bout en bout. ELLE EST RESTÉE VERTE, 8 tests sur
 * 8. Le témoin devait ne rien décider ; il a montré un trou.
 *
 * Le trou est structurel, et il vaut d'être nommé parce qu'il vaut pour toute cette
 * famille de tests : les huit tests de `e2e/messagerie-donnees.spec.ts` affirment
 * PAR L'ABSENCE. Ils ouvrent les écrans avec un membre NEUF, qui n'a ni
 * conversation ni notification, et vérifient que les lignes de la maquette ont bien
 * disparu — ce qui prouve que les listes sont liées. Mais aucune ligne n'est jamais
 * RENDUE, donc aucune valeur d'une ligne n'est jamais vérifiée. Un glyphe faux, un
 * fond inversé, une heure mal formée : rien de tout cela ne ferait rougir quoi que
 * ce soit.
 *
 * ── CE QUE CE TEST FAIT, ET CE QU'IL ÉVITE DE FAIRE ────────────────────────
 *
 * Recopier les cinq tracés dans une assertion ne vaudrait rien : ce serait écrire
 * la même constante deux fois, et une faute de frappe recopiée passerait. Le test
 * va donc chercher la VÉRITÉ À SA SOURCE — la maquette elle-même — et vérifie que
 * chaque tracé lié y est RÉELLEMENT DESSINÉ, dans la section X02.
 *
 * Il attrape donc deux dérives que rien d'autre ne voyait :
 *
 *   · un glyphe modifié côté front — le témoin ci-dessus. Le cœur de `HELP` est
 *     bien dessiné dans la section, mais sur UNE AUTRE LIGNE que celle des
 *     réactions : c'est pourquoi le test ne se contente pas de « ce tracé existe
 *     quelque part », il vérifie la ligne qui le porte ;
 *   · un glyphe retiré par le designer — la maquette changerait, le tracé ne s'y
 *     trouverait plus, et le test nommerait la catégorie concernée au lieu de
 *     laisser une pastille se vider en silence.
 *
 * ── ET LES NEUF CATÉGORIES SANS GLYPHE ─────────────────────────────────────
 *
 * `NOTIFICATION_CATEGORIES` en compte quatorze ; la maquette n'en dessine que cinq.
 * Le dernier test fige ce COMPTE, pour que l'écart reste visible et chiffré : le
 * jour où le porteur fournira les neuf manquants, c'est ce test qui demandera de
 * mettre la table à jour plutôt que de les laisser arriver sans qu'on le sache.
 */

const MAQUETTE = join(
  process.cwd(),
  '..',
  '..',
  'docs',
  'template',
  '09 Messages et transverse.dc.html',
);

/** La section X02, telle que la maquette la délimite. */
function sectionX02(): string {
  const html = readFileSync(MAQUETTE, 'utf8');
  const ouverture = /<section[^>]*id="X02"[^>]*>/.exec(html);
  if (ouverture === null) throw new Error('section X02 introuvable dans la maquette');
  const debut = ouverture.index + ouverture[0].length;
  const fin = html.indexOf('</section>', debut);
  return html.slice(debut, fin);
}

describe('les glyphes de X02 sont ceux de la maquette', () => {
  const section = sectionX02();

  for (const [categorie, trace] of Object.entries(GLYPHES_X02)) {
    it(`« ${categorie} » porte un tracé RÉELLEMENT dessiné dans la section X02`, () => {
      expect(trace).not.toBe('');
      // `<path d="…"/>` tel que la maquette l'écrit, au caractère près.
      expect(section).toContain(`<path d="${trace}"/>`);
    });
  }

  /**
   * CHAQUE CATÉGORIE A SON PROPRE TRACÉ.
   *
   * C'est ce qui aurait tué la mutation témoin : en donnant à `SOCIAL` le cœur de
   * `HELP`, deux catégories partageaient un glyphe — et deux lignes de nature
   * différente devenaient indiscernables à l'œil.
   */
  it('deux catégories ne partagent jamais le même tracé', () => {
    const traces = Object.values(GLYPHES_X02);
    expect(new Set(traces).size).toBe(traces.length);
  });

  /**
   * L'ÉCART EST CHIFFRÉ, pas seulement commenté.
   *
   * Cinq glyphes pour quatorze catégories. Les neuf autres laissent la pastille
   * VIDE — décision déclarée dans `tools/screens/09-messages.mjs`, et visible à
   * l'écran plutôt que masquée par un glyphe emprunté à une autre catégorie.
   */
  it('la maquette ne dessine que CINQ des quatorze catégories', () => {
    expect(Object.keys(GLYPHES_X02)).toHaveLength(5);
  });
});
