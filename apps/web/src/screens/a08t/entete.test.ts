import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CommunityDetailResponse } from '@app/shared';
import { enteteReseauFrom } from '../reseaux/from-api';
import { enteteVide } from './data';

/**
 * LES RÈGLES DURES DE L'EN-TÊTE DE RÉSEAU, FIGÉES SUR CE QUI EST VRAIMENT RENDU.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUE CE FICHIER GARDE, ET LA RAISON DE CHAQUE FORME
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Quatre règles, et pour chacune il a fallu choisir SUR QUOI porter l'assertion.
 * Le choix n'est pas cosmétique : trois agents de ce dépôt ont trouvé hier un
 * trou dans leurs propres témoins, et les trois trous avaient la même forme —
 * le test affirmait sur quelque chose qui ne décidait de rien.
 *
 *   · un glyphe échangé entre deux catégories ne cassait rien, parce que les
 *     tests affirmaient PAR L'ABSENCE : aucune ligne n'était jamais rendue, donc
 *     aucune valeur n'était vérifiée ;
 *   · retirer la reprise de session laissait 43 tests verts, parce que le socle
 *     rafraîchit sur 401 et REJOUE ;
 *   · un harnais ajoutait `.passthrough()` AVANT le `.strict()` existant, qui
 *     gagnait — l'empreinte du fichier changeait, donc le harnais se croyait
 *     appliqué.
 *
 * D'où deux principes appliqués ici. D'abord, les assertions de non-présence
 * sont TOUJOURS doublées d'une assertion de présence sur le même objet : « le
 * nom du réseau n'est pas écrit en dur » ne vaut rien sans « et la prise qui le
 * remplace EST là ». Ensuite, chaque règle est accompagnée d'un compte EXACT et
 * non d'un `toBeGreaterThan(0)` : vingt-cinq cadres, et la mutation qui en
 * retire un doit rougir.
 *
 * Les nombres sont ÉCRITS EN DUR exprès. Une borne lue depuis la chose qu'elle
 * borne est une tautologie, et ce dépôt en a déjà vu trois devenir fausses par
 * accumulation.
 */

const A08T = import.meta.dirname;

/** Les vingt-cinq cadres d'onglet, lus sur le disque. */
function cadres(): readonly { readonly nom: string; readonly jsx: string }[] {
  return readdirSync(A08T)
    .filter((f) => f.endsWith('.generated.tsx'))
    .sort()
    .map((f) => ({ nom: f, jsx: readFileSync(resolve(A08T, f), 'utf8') }));
}

/**
 * Un réseau de réponse, pour éprouver le convertisseur.
 *
 * `counters` porte des valeurs DIFFÉRENTES de `memberCount`, et c'est tout
 * l'intérêt : un convertisseur qui lirait `counters.members` rendrait 7 là où il
 * doit rendre 890, et l'assertion le nommerait. Deux champs qui portent le même
 * nombre ne distinguent rien.
 */
const RESEAU: CommunityDetailResponse = {
  id: '11111111-1111-4111-8111-111111111111',
  kind: 'COUNTRY',
  name: 'Béninois en France',
  slug: 'beninois-en-france',
  description: 'Le réseau des Béninoises et Béninois installés en France.',
  category: null,
  visibility: 'PUBLIC',
  status: 'ACTIVE',
  cityId: null,
  countryId: '22222222-2222-4222-8222-222222222222',
  memberCount: 890,
  coverAssetId: null,
  lastActivityAt: '2026-09-01T10:00:00.000Z',
  createdAt: '2025-01-01T10:00:00.000Z',
  myRole: 'MEMBER',
  myStatus: 'ACTIVE',
  canJoin: false,
  canLeave: true,
  counters: { members: 7, topics: 3, announcements: 1 },
  pinned: [],
};

describe('A08T — les vingt-cinq cadres lisent leur réseau', () => {
  /**
   * RÈGLE DURE — AUCUNE FUITE ENTRE RÉSEAUX, le versant affichage.
   *
   * Le serveur tient la règle : les sept routes de contenu répondent
   * `403 NOT_A_MEMBER`, et `counters` arrive MASQUÉ à zéro pour un passant.
   * Mesuré sur le même réseau PUBLIC à la même seconde : `counters.topics` vaut
   * 1 pour un membre et 0 pour un passant.
   *
   * Le front peut DÉFAIRE cette garde de deux façons, et les deux sont ici :
   *
   *   1. en lisant `counters.members` au lieu de `memberCount`. Ce n'est pas une
   *      fuite, c'est l'inverse — un réseau de 890 personnes s'afficherait à
   *      « 0 membre » pour qui le regarde de l'extérieur, et le zéro masqué
   *      passerait pour un compte. L'écran mentirait dans l'autre sens.
   *   2. en écrivant le nom d'un réseau EN DUR dans le cadre. C'est la fuite
   *      réelle, et c'était l'état du dépôt : les vingt-cinq cadres écrivaient
   *      « Béninois en France », donc un membre de « Sénégalais à Paris »
   *      lisait le nom d'un réseau qui n'est pas le sien.
   */
  it('lit memberCount, qui est public — jamais counters.members, qui arrive masqué', () => {
    const entete = enteteReseauFrom(RESEAU);
    // PRÉSENCE : la valeur publique est bien celle qui sort.
    expect(entete.membres).toBe('890 membres');
    expect(entete.membresNombre).toBe('890');
    // ABSENCE : et ce n'est pas le compteur masqué qui a servi.
    expect(entete.membres).not.toContain('7');
    expect(entete.membresNombre).not.toBe('7');
  });

  it('aucun des vingt-cinq cadres n’écrit un nom de réseau en dur', () => {
    const tous = cadres();
    // Les vingt-cinq, comptés : un cadre qui disparaîtrait de la génération ne
    // doit pas faire passer ce test pour l'avoir vérifié.
    expect(tous).toHaveLength(25);

    const enDur = tous.filter((c) => c.jsx.includes('Béninois en France'));
    expect(enDur.map((c) => c.nom)).toEqual([]);

    // PRÉSENCE — et c'est la moitié qui manquait aux témoins d'hier : vingt-et-un
    // cadres portent l'en-tête, et chacun doit LIRE le nom. Les quatre autres
    // sont des formulaires pleine page que la maquette dessine sans en-tête.
    const lisentLeNom = tous.filter((c) => c.jsx.includes('{reseau.nom}'));
    expect(lisentLeNom).toHaveLength(21);
  });

  it('les vingt-cinq cadres lisent tous au moins une prise', () => {
    const sourds = cadres().filter((c) => /\(_props:/.test(c.jsx));
    expect(sourds.map((c) => c.nom)).toEqual([]);
  });

  /**
   * RÈGLE DURE — AUCUN COMPTEUR DE VUES (00 §49).
   *
   * Elle se tient d'abord côté serveur : `communityPublicSchema` est `.strict()`
   * et ne décrit aucun `viewCount`, donc un champ greffé serait dépouillé à la
   * validation de réponse. Ici on garde le versant affichage — qu'aucune liaison
   * n'ait introduit une prise de vues dans un cadre.
   *
   * L'assertion porte sur les PRISES (`{reseau.…}`) et non sur le texte des
   * cadres : « vues » apparaît dans des mots français ordinaires, et un test qui
   * chercherait le mot rougirait sur « revues ».
   */
  it('aucune prise de compteur de vues dans les cadres d’onglet', () => {
    const prises = new Set<string>();
    for (const c of cadres()) {
      for (const m of c.jsx.matchAll(/\{reseau\.([A-Za-z]+)\}/g)) prises.add(m[1] as string);
    }
    // PRÉSENCE : on a bien relevé des prises — sinon l'absence ne prouve rien.
    expect(prises.size).toBeGreaterThanOrEqual(9);
    expect([...prises].filter((p) => /vue|view|lecture|read/i.test(p))).toEqual([]);
  });

  /**
   * LA PASTILLE DISPARAÎT À ZÉRO, elle n'affiche pas un rond orange vide.
   *
   * Le dialecte la met sous `<sc-if value="{{ reseau.demandes }}">`, donc le JSX
   * produit doit porter un ternaire sur cette prise — et non la pastille nue.
   * C'est exactement ce que la pastille « Contacts » de K01 fait, et pour la même
   * raison : un rond de couleur sans nombre est un défaut qui se voit.
   */
  it('la pastille des demandes est conditionnelle partout où elle est dessinée', () => {
    /**
     * DOUZE ET NON ONZE, et ce nombre a été corrigé PAR CE TEST.
     *
     * Onze cadres portent la PASTILLE de l'onglet « Membres » — sept planches
     * d'ordinateur et quatre planches mobiles de la vue propriétaire. Le
     * douzième est « Gérer » en mobile, qui ne dessine aucun en-tête mais écrit
     * « Demandes · 4 » dans sa barre d'onglets interne : la même donnée, à un
     * autre endroit. Écrire onze était une erreur de comptage, et c'est
     * exactement le genre de chiffre qu'un `toBeGreaterThan(0)` aurait laissé
     * passer sans rien garder.
     */
    const avecPastille = cadres().filter((c) => c.jsx.includes('{reseau.demandes}'));
    expect(avecPastille).toHaveLength(12);

    /**
     * ET LA CONDITION, qui est la règle elle-même : à zéro la pastille DISPARAÎT.
     *
     * Elle ne vaut que pour les onze cadres qui dessinent le ROND. « Gérer »
     * mobile écrit le nombre dans du texte (« Demandes · 4 ») : il n'y a pas de
     * rond vide à éviter, donc pas de condition à exiger.
     */
    const avecRond = avecPastille.filter((c) => c.jsx.includes('#E0733A'));
    expect(avecRond).toHaveLength(11);
    for (const c of avecRond) {
      expect(c.jsx, c.nom).toContain('reseau.demandes ?');
    }
  });

  /**
   * LE REPLI N'INVENTE AUCUN NOM, et c'est la contrepartie directe de la règle
   * de fuite. Un repli qui porterait « Béninois en France » referait exactement
   * le défaut que ce lot corrige, mais seulement pendant le chargement — donc de
   * façon intermittente, c'est-à-dire invisible aux tests et visible à l'œil.
   */
  it('l’en-tête de repli est vide, et ne nomme aucun réseau', () => {
    expect(enteteVide.nom).toBe('');
    expect(enteteVide.membres).toBe('');
    expect(enteteVide.demandes).toBe(0);
    expect(JSON.stringify(enteteVide)).not.toContain('Béninois');
  });

  /**
   * ── MUTATION TÉMOIN ──────────────────────────────────────────────────────
   *
   * Elle mute un endroit qui NE DÉCIDE DE RIEN et doit rester VERTE : la phrase
   * du journal (`why`) d'une liaison, et le libellé de rôle affiché. Ni l'une ni
   * l'autre n'entre dans une règle dure — un `why` est de la prose, et
   * « modérateur » contre « Modérateur » ne change aucune garde.
   *
   * Si l'un de ces deux changements faisait rougir un test ci-dessus, c'est que
   * ce test affirme sur la forme et non sur la règle : il serait solide par
   * accident et rougirait au premier reformulage. La mutation témoin est donc
   * une QUESTION posée aux cinq assertions du dessus, pas un succès.
   *
   * Elle est écrite ici, et non appliquée à la main dans les fichiers, pour une
   * raison mesurée dans ce dépôt : un harnais qui réécrit un fichier peut se
   * croire appliqué sans l'être (l'empreinte change, mais le `.strict()` déjà là
   * gagne). Muter l'ENTRÉE du convertisseur ne peut pas échouer en silence.
   */
  it('TÉMOIN — un réseau au nom et au rôle différents ne change aucune règle', () => {
    const autre = enteteReseauFrom({
      ...RESEAU,
      name: 'Sénégalais à Paris',
      slug: 'senegalais-a-paris',
      kind: 'CITY',
      myRole: 'OWNER',
    });
    // Le nom et le rôle changent — c'est le but d'une prise.
    expect(autre.nom).toBe('Sénégalais à Paris');
    expect(autre.monRole).toBe('propriétaire');
    expect(autre.genre).toBe('réseau de ville');
    // Et la règle dure NE bouge pas : c'est toujours `memberCount` qui sort.
    expect(autre.membres).toBe('890 membres');
    expect(autre.membres).not.toContain('7');
  });
});
