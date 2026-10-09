import { describe, expect, it } from 'vitest';
import {
  groupedSearchResponseSchema,
  suggestResponseSchema,
  typedSearchResponseSchema,
} from '@app/shared';
import { cartesGroupees, cartesPlates, filtresDe, suggestionsDe, videDe } from './from-api';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA RECHERCHE AFFICHAIT LA MAQUETTE — CE FICHIER MESURE QU'ELLE NE LE FAIT   ║
 * ║ PLUS, ET QUE CE QUI NE DEVAIT PAS BOUGER N'A PAS BOUGÉ                     ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur, capture à l'appui : « La recherche ne marche pas bien. Regarde
 * l'URL, est-ce qui est sur la page ? » MESURÉ sur `/recherche?q=simple` :
 * « Tout · 24 », « Guides · 5 », quatre cartes sur Visale — les exemples de la
 * planche. Puis : « il faut que la left side bar contienne plutôt les filtres
 * (guide, actualité, événement, etc.) avec le nombre matché dans ces catégories »,
 * et « les propositions doivent permettre d'aller directement sur un élément ».
 *
 * ── LES CHARGES SONT PARSÉES PAR LES SCHÉMAS PARTAGÉS ─────────────────────
 *
 * Pas d'objets façonnés à la mesure des convertisseurs : chaque charge passe par
 * le schéma de `@app/shared` que le socle d'appel emploie. Un champ que le serveur
 * cesserait de rendre fait donc tomber ces cas AU PARSE, et non trois écrans plus
 * loin.
 *
 * ── MUTATIONS APPLIQUÉES ─────────────────────────────────────────────────────
 *
 *   · `ORDRE_TYPES` remplacé par `groupes.items.map(g => g.type)` → le cas de
 *     l'ordre stable tombe ;
 *   · un type à zéro recevant quand même `&type=` → le cas du filtre mort tombe ;
 *   · `peint` rendant le même jeu dans les deux branches → le cas de la pastille
 *     mobile tombe (blanc sur blanc), et lui seul ;
 *   · `TRACE[t]` remplacé par un tracé unique → le cas des cinq glyphes tombe ;
 *   · `url ?? …` remplacé par `url!` → le cas de la source disparue tombe.
 */

const GROUPES = groupedSearchResponseSchema.parse({
  items: [
    {
      type: 'TOPIC',
      label: 'Sujets de réseau',
      count: 7,
      capped: false,
      items: [
        {
          id: 'd1',
          subjectType: 'TOPIC',
          subjectId: 't1',
          title: 'Sujet trouvé',
          excerpt: 'Un extrait du serveur.',
          cityId: null,
          countryId: null,
          communityId: '01999999-0000-7000-8000-000000000001',
          rank: 0.4,
          updatedAt: '2026-01-02T10:00:00.000Z',
          url: '/reseaux/benin-lyon/sujets/t1',
        },
      ],
    },
    {
      type: 'GUIDE',
      label: 'Guides',
      count: 2,
      capped: false,
      items: [
        {
          id: 'd2',
          subjectType: 'GUIDE',
          subjectId: 'g1',
          title: 'Guide trouvé',
          excerpt: 'Un autre extrait.',
          cityId: null,
          countryId: null,
          communityId: null,
          rank: 0.3,
          updatedAt: '2026-01-01T10:00:00.000Z',
          url: '/guides/visale-sans-cdi',
        },
      ],
    },
  ],
  nextCursor: null,
  meta: { q: 'simple', normalized: 'simple' },
});

const PLATS = typedSearchResponseSchema.parse({
  items: [
    {
      id: 'd3',
      subjectType: 'GUIDE',
      subjectId: 'g2',
      title: 'Second guide',
      excerpt: 'Extrait plat.',
      cityId: null,
      countryId: null,
      communityId: null,
      rank: 0.2,
      updatedAt: '2026-01-03T10:00:00.000Z',
      url: null,
    },
  ],
  nextCursor: null,
  meta: { q: 'simple', normalized: 'simple' },
});

const SUGGESTIONS = suggestResponseSchema.parse({
  items: [
    { title: 'Visale sans CDI', subjectType: 'GUIDE', subjectId: 'g1', url: '/guides/visale-sans-cdi' },
    { title: 'Autre piste', subjectType: 'HELP_REQUEST', subjectId: 'h9', url: null },
  ],
});

describe('X01 — la colonne de filtres', () => {
  it('la charge porte de quoi éprouver — sinon tout ce qui suit est creux', () => {
    expect(GROUPES.items).toHaveLength(2);
    expect(GROUPES.items[0]?.count).toBe(7);
    expect(GROUPES.items.map((g) => g.type)).toEqual(['TOPIC', 'GUIDE']);
  });

  /**
   * LES COMPTEURS VIENNENT DU SERVEUR. « Tout · 24 » et « Guides · 5 » étaient
   * dessinés : ici la somme vaut 9, qui est 7 + 2, et rien d'autre.
   */
  it('« Tout » est la somme des comptes du serveur, pas un nombre dessiné', () => {
    const filtres = filtresDe(GROUPES, 'simple', null);
    const tout = filtres[0];
    expect(tout?.libelle).toBe('Tout');
    expect(tout?.compte).toBe(9);
    expect(filtres.find((f) => f.libelle === 'Guides')?.compte).toBe(2);
    expect(filtres.find((f) => f.libelle === 'Sujets')?.compte).toBe(7);
  });

  /**
   * L'ORDRE NE SUIT PAS LE SERVEUR, et c'est voulu : il ordonne par pertinence,
   * donc l'ordre change d'une requête à l'autre. La charge met TOPIC avant GUIDE ;
   * la colonne garde son ordre à elle.
   */
  it('l’ordre de la colonne est stable, même quand le serveur en change', () => {
    const filtres = filtresDe(GROUPES, 'simple', null);
    const sansTout = filtres.slice(1).map((f) => f.libelle);
    expect(sansTout.indexOf('Guides')).toBeLessThan(sansTout.indexOf('Sujets'));
    expect(sansTout).toHaveLength(9);
  });

  it('les mots sont ceux de la planche, pas ceux du serveur', () => {
    const filtres = filtresDe(GROUPES, 'simple', null);
    const mots = filtres.map((f) => f.libelle);
    // Le serveur dit « Sujets de réseau » et « Professionnels ».
    expect(mots).toContain('Sujets');
    expect(mots).toContain('Pros');
    expect(mots).not.toContain('Sujets de réseau');
    expect(mots).not.toContain('Professionnels');
  });

  /** UN FILTRE À ZÉRO NE FILTRE PAS : il mènerait à une page vide. */
  it('un type sans résultat est montré, et ne porte pas de filtre', () => {
    const filtres = filtresDe(GROUPES, 'simple', null);
    const villes = filtres.find((f) => f.libelle === 'Villes');
    expect(villes?.compte).toBe(0);
    expect(villes?.href).toBe('/recherche?q=simple');
    expect(filtres.find((f) => f.libelle === 'Guides')?.href).toBe('/recherche?q=simple&type=GUIDE');
  });

  /**
   * LE PORTEUR, devant dix filtres à zéro : « on peut pas cliquer ? » Non — et
   * c'est le point : rien ne le disait, le filtre mort était peint comme ses
   * voisins vivants.
   */
  it('un filtre à zéro est atténué, et un filtre qui porte des résultats ne l’est pas', () => {
    const filtres = filtresDe(GROUPES, 'simple', null);
    expect(filtres.find((f) => f.libelle === 'Villes')?.encre).toBe('#8A958F');
    expect(filtres.find((f) => f.libelle === 'Guides')?.encre).toBe('#16211D');
  });

  it('la requête est échappée dans l’adresse du filtre', () => {
    const filtres = filtresDe(GROUPES, 'visa & séjour', 'GUIDE');
    expect(filtres[0]?.href).toBe('/recherche?q=visa%20%26%20s%C3%A9jour');
  });

  /**
   * LES DEUX APPARENCES SONT DISTINCTES, et le cas le dit explicitement : la
   * colonne peint un vert PÂLE sans bordure, la pastille du téléphone un vert
   * PLEIN bordé. Réemployer les mêmes trois valeurs peignait une pastille blanche
   * sur fond blanc — c'est exactement le défaut que ce cas garde.
   */
  it('le filtre retenu est peint en colonne ET en pastille, de deux façons', () => {
    const filtres = filtresDe(GROUPES, 'simple', 'GUIDE');
    const guides = filtres.find((f) => f.libelle === 'Guides');
    expect(guides?.active).toBe(true);
    expect(guides?.fond).toBe('#E3F0EB');
    expect(guides?.encre).toBe('#0F5C48');
    expect(guides?.piluleFond).toBe('#16785E');
    expect(guides?.piluleEncre).toBe('#fff');
    expect(filtres[0]?.active).toBe(false);
    expect(filtres[0]?.piluleFond).toBe('#fff');
  });

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ CE CAS DISAIT L'INVERSE, ET C'EST LE PORTEUR QUI A TRANCHÉ              ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Il affirmait « sans réponse du serveur, la colonne est vide — elle ne prétend
   * rien », et le raisonnement semblait juste : ne rien afficher plutôt que des
   * zéros qu'on n'a pas comptés.
   *
   * MESURÉ par le porteur sur `/recherche?q=s` : « caractère n'affiche même pas
   * les filtres, pourquoi ça ? Pourtant c'est une recherche. » Il a raison, et la
   * confusion était à moi : les COMPTES viennent du serveur, la LISTE DES TYPES
   * n'en vient pas — c'est une constante du produit. Masquer la colonne faisait
   * disparaître la seule navigation de la page exactement quand on ne trouve pas
   * ce qu'on cherche.
   *
   * Le cas garde donc les DEUX moitiés : la liste est là, et aucun de ses filtres
   * ne prétend mener quelque part.
   */
  it('sans réponse du serveur, la colonne existe mais ne mène nulle part', () => {
    const filtres = filtresDe(null, 's', null);
    expect(filtres).toHaveLength(10);
    expect(filtres[0]?.libelle).toBe('Tout');
    expect(filtres.every((f) => f.compte === 0)).toBe(true);
    /** Aucun `&type=` : un filtre sans compte mènerait à une page vide. */
    expect(filtres.every((f) => !f.href.includes('type='))).toBe(true);
    /** Et ils sont atténués, sauf « Tout » qui porte la page courante. */
    expect(filtres.find((f) => f.libelle === 'Guides')?.encre).toBe('#8A958F');
  });
});

describe('X01 — les cartes de résultat', () => {
  /**
   * LA CARTE DESSINE UN CHEVRON DEPUIS LE PREMIER JOUR : elle promettait d'ouvrir
   * quelque chose. L'adresse vient du serveur, parce que quatre des neuf types ne
   * s'ouvrent pas par leur identifiant.
   */
  it('chaque carte porte l’adresse que le serveur a composée', () => {
    const cartes = cartesGroupees(GROUPES);
    expect(cartes.map((c) => c.url)).toEqual([
      '/reseaux/benin-lyon/sujets/t1',
      '/guides/visale-sans-cdi',
    ]);
  });

  /** UNE SOURCE DISPARUE NE DEVIENT PAS UN LIEN MORT : la carte reste inerte. */
  it('une adresse nulle reste nulle — pas de lien inventé', () => {
    const cartes = cartesPlates(PLATS, 'GUIDE');
    expect(cartes[0]?.url).toBeNull();
  });

  it('la pastille dit le type au singulier, et l’extrait vient du serveur', () => {
    const cartes = cartesGroupees(GROUPES);
    expect(cartes[0]?.pastille).toBe('Sujet');
    expect(cartes[1]?.pastille).toBe('Guide');
    expect(cartes[0]?.extrait).toBe('Un extrait du serveur.');
  });

  /**
   * CINQ TYPES PORTAIENT L'ICÔNE D'UN SIXIÈME. La planche ne dessine que quatre
   * tracés ; les cinq autres recevaient tous celui du sujet — une bulle de message
   * pour un membre, une ville, un emploi, un événement, une fiche pro. Ils ont
   * maintenant le leur, pris dans Feather.
   */
  it('les neuf types ont neuf tracés distincts', () => {
    const faux = { id: 'x', title: 't', excerpt: 'e', url: null };
    const traces = (['GUIDE', 'TOPIC', 'HELP_REQUEST', 'HOUSING', 'JOB', 'EVENT', 'USER', 'CITY', 'PRO'] as const).map(
      (t) => cartesPlates({ ...PLATS, items: [{ ...PLATS.items[0]!, ...faux, subjectType: t }] }, t)[0]?.trace,
    );
    expect(new Set(traces).size).toBe(9);
  });
});

describe('X01 — ce que la page dit quand elle ne montre rien', () => {
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LA PAGE NE DISAIT RIEN — LE PORTEUR L'A VU SUR UNE CAPTURE               ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * « ça ne met pas qu'il n'a rien trouvé » (`/recherche?q=siple`) et « La
   * recherche n'affiche rien avec "s" ? ». Deux captures, deux états distincts que
   * la page confondait en un seul : une page blanche.
   *
   * ── MUTATIONS APPLIQUÉES ──────────────────────────────────────────────────
   *
   *   · `videDe` rendant toujours `null` → les quatre cas tombent ;
   *   · le découpage au premier point retiré → le cas des deux lignes tombe, et
   *     le titre porterait la phrase entière, dédoublée sous elle ;
   *   · `bouton` posé même sans `zeroResult` → le cas « le serveur se tait »
   *     tombe : on proposerait de poser une question qu'on ne sait pas nommer ;
   *   · `resultats.length > 0` retiré → le premier cas tombe, et la carte
   *     s'afficherait SOUS des résultats.
   */
  it('aucune carte quand il y a des résultats — sinon elle s’afficherait sous eux', () => {
    expect(videDe(GROUPES, 'simple', cartesGroupees(GROUPES))).toBeNull();
  });

  it('une requête trop courte explique la borne, et ne propose rien', () => {
    const vide = videDe(null, 's', []);
    expect(vide?.titre).toBe('Aucun résultat');
    expect(vide?.invite).toContain('2');
    /** Aucun bouton : le serveur n'a pas cherché, il n'a rien à proposer. */
    expect(vide?.bouton).toBe('');
  });

  it('une requête vide invite à taper, plutôt que d’annoncer un échec', () => {
    expect(videDe(null, '', [])?.invite).toContain('Tapez');
  });

  /**
   * LES MOTS SONT CEUX DU SERVEUR. `SEARCH_ZERO_PROMPT_FR` vit dans `@app/shared`
   * pour que l'API et l'écran disent la même chose ; le recopier ici en ferait une
   * seconde source, et ce cas le vérifie en MUTANT la charge.
   */
  it('quand le serveur a cherché sans rien trouver, ses mots remplissent les deux lignes', () => {
    const zero = {
      ...GROUPES,
      items: [],
      meta: {
        q: 'siple',
        normalized: 'siple',
        zeroResult: {
          prompt: 'Aucun résultat. Posez la question à la communauté ?',
          cta: 'Poser la question',
          helpTitle: 'siple',
        },
      },
    };
    const vide = videDe(zero, 'siple', []);
    expect(vide?.titre).toBe('Aucun résultat');
    expect(vide?.invite).toBe('Posez la question à la communauté ?');
    expect(vide?.bouton).toBe('Poser la question');
    expect(vide?.href).toBe('/entraide/nouveau');

    // La phrase CHANGE côté serveur : les deux lignes suivent.
    const autre = videDe(
      { ...zero, meta: { ...zero.meta, zeroResult: { ...zero.meta.zeroResult, prompt: 'Rien ici. Essayez autrement ?' } } },
      'siple',
      [],
    );
    expect(autre?.titre).toBe('Rien ici');
    expect(autre?.invite).toBe('Essayez autrement ?');
  });

  /**
   * §2.4 : le serveur ne rend `zeroResult` que si la requête porte des TERMES
   * UTILES — « de la » ne dit rien d'un contenu manquant. Sans sa proposition, la
   * carte garde son titre et perd son bouton.
   */
  it('quand le serveur se tait, la carte garde son titre et perd son bouton', () => {
    const vide = videDe({ ...GROUPES, items: [], meta: { q: 'de la', normalized: 'de la' } }, 'de la', []);
    expect(vide?.titre).toBe('Aucun résultat');
    expect(vide?.invite).toBe('');
    expect(vide?.bouton).toBe('');
  });
});

describe('X01 — les suggestions', () => {
  /**
   * « LES PROPOSITIONS DOIVENT PERMETTRE D'ALLER DIRECTEMENT SUR UN ÉLÉMENT. »
   * Avant, une suggestion était un titre et un type : il n'y avait rien à quoi
   * accrocher un lien.
   */
  it('chaque proposition mène à son élément', () => {
    const s = suggestionsDe(SUGGESTIONS.items, 'vis');
    expect(s[0]?.vers).toBe('/guides/visale-sans-cdi');
  });

  it('sans adresse, elle mène à la recherche sur son titre — jamais nulle part', () => {
    const s = suggestionsDe(SUGGESTIONS.items, 'vis');
    expect(s[1]?.vers).toBe('/recherche?q=Autre%20piste');
  });

  it('le préfixe saisi est mis en gras, et seulement s’il commence le titre', () => {
    const s = suggestionsDe(SUGGESTIONS.items, 'Vis');
    expect(s[0]?.prefixe).toBe('Vis');
    expect(s[0]?.suite).toBe('ale sans CDI');
    expect(s[1]?.prefixe).toBe('');
    expect(s[1]?.suite).toBe('Autre piste');
  });
});
