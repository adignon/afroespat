import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  feedResponseSchema,
  feedSidebarResponseSchema,
  storyBandResponseSchema,
  commentsResponseSchema,
} from '@app/shared';
import {
  arrivalsFrom,
  avatarColor,
  eventsFrom,
  feedPostsFrom,
  initials,
  onlineFrom,
  storiesFrom,
  threadFrom,
} from './from-api';

/**
 * LE BRANCHEMENT DU FIL, ÉPROUVÉ SUR DES CHARGES RÉELLES.
 *
 * Les fixtures sont celles de `packages/shared/src/__tests__/fixtures/` : des
 * réponses relevées OCTET POUR OCTET sur une API qui tournait. Elles sont PARSÉES
 * par le schéma partagé avant d'entrer dans les convertisseurs, et l'ordre compte —
 * c'est ce qui fait que ce fichier éprouve la chaîne complète (charge réelle →
 * schéma partagé → prises du cadre) plutôt que les convertisseurs seuls contre un
 * objet que l'auteur du test aurait façonné à leur mesure.
 *
 * ── CE QUE CE FICHIER GARDE ─────────────────────────────────────────────────
 *
 * Trois choses, et la troisième est celle qu'on oublie :
 *
 *   1. le vocabulaire affiché vient du SERVEUR, pas d'une table recopiée ici —
 *      règle dure §9, « le vocabulaire de réaction renvoyé correspond au type » ;
 *   2. aucun compteur de VUES n'atteint l'écran (§2.6, `00` §49) ;
 *   3. les champs que l'API NE PEUT PAS remplir restent VIDES au lieu d'être
 *      inventés. Un sondage vide ou un `likes: 0` mettrait à l'écran une
 *      affordance morte, et le défaut ne se verrait qu'au clic.
 */

const FIXTURES = resolve(
  import.meta.dirname,
  '../../../../../packages/shared/src/__tests__/fixtures',
);

const charge = (nom: string): unknown =>
  JSON.parse(readFileSync(resolve(FIXTURES, `${nom}.json`), 'utf8'));

/** Parsé par le schéma PARTAGÉ : si le contrat bouge, ce fichier le sait aussi. */
const fil = feedResponseSchema.parse(charge('feed'));
const bandeau = storyBandResponseSchema.parse(charge('stories_band'));
const colonne = feedSidebarResponseSchema.parse(charge('feed_sidebar'));
const commentaires = commentsResponseSchema.parse(charge('comments'));

describe('les publications, converties pour le cadre transcodé', () => {
  const cartes = feedPostsFrom(fil);

  it('la fixture porte de quoi éprouver — sinon tout ce qui suit est creux', () => {
    expect(cartes.length).toBeGreaterThan(0);
    expect(fil.items.map((p) => p.type)).toContain('QUESTION');
  });

  /**
   * RÈGLE DURE §9 — « le vocabulaire de réaction renvoyé correspond au type de
   * publication ».
   *
   * On compare au vocabulaire que LE SERVEUR a envoyé, et non à une liste écrite
   * ici. Une liste écrite ici serait une seconde table de vocabulaire : elle
   * passerait au vert en restant d'accord avec elle-même pendant que l'API dirait
   * autre chose — exactement la divergence que `00` §4 interdit.
   */
  it('le vocabulaire affiché est celui que le serveur a envoyé, jamais une table recopiée', () => {
    cartes.forEach((carte, i) => {
      const source = fil.items[i]!;
      expect(carte.action).toBe(source.reaction.actionLabel);
      expect(carte.word).toBe(source.counter.word);
      expect(carte.comment).toBe(source.commentLabel);
      expect(carte.type).toBe(source.typeLabel);
      expect(carte.n).toBe(source.counter.displayCount);
    });
  });

  /**
   * §2.1 : une QUESTION compte des RÉPONSES (donc ses commentaires), les autres
   * types comptent leurs réactions. C'est le serveur qui tranche par
   * `displayCount` ; on vérifie que le convertisseur ne substitue pas `count`.
   */
  it('une question affiche ses réponses, pas ses réactions', () => {
    const iQuestion = fil.items.findIndex((p) => p.type === 'QUESTION');
    expect(iQuestion).toBeGreaterThanOrEqual(0);
    const source = fil.items[iQuestion]!;
    expect(cartes[iQuestion]!.n).toBe(source.commentCount);
    expect(cartes[iQuestion]!.word).toContain('répons');
  });

  /** §2.2 : le NOM DU TYPE de parcours, jamais le titre personnel du membre. */
  it('la ligne de contexte est celle composée par le serveur', () => {
    cartes.forEach((carte, i) => {
      expect(carte.ctx).toBe(fil.items[i]!.context.text);
    });
  });

  /**
   * CE QUE L'API NE PEUT PAS REMPLIR RESTE VIDE.
   *
   * `poll`, `tags` et `tip` sont dessinés par la maquette et n'ont AUCUNE source :
   * ni `createPostSchema` (qui est `.strict()`), ni `model Post`, ni 04 §2.4 ne
   * connaissent de sondage, de mots-clés ou d'encadré sur une publication. Les
   * remplir d'une valeur par défaut afficherait une affordance qui ne peut pas
   * fonctionner ; ce test fige le choix de ne rien inventer.
   */
  it('n’invente ni sondage, ni mots-clés, ni encadré — le back ne les porte pas', () => {
    for (const carte of cartes) {
      expect(carte.poll).toBeUndefined();
      expect(carte.pollMeta).toBeUndefined();
      expect(carte.tags).toBeUndefined();
      expect(carte.tip).toBeUndefined();
    }
  });

  /** §2.4 : quatre images au plus — et une seule est dessinée par le cadre. */
  it('ne dessine jamais plus d’une image par carte, comme la maquette', () => {
    for (const carte of cartes) {
      if (carte.photo !== undefined) expect(typeof carte.photo).toBe('string');
    }
  });
});

describe('le bandeau de stories', () => {
  const bulles = storiesFrom(bandeau);

  it('la fixture porte des stories', () => {
    expect(bulles.length).toBeGreaterThan(0);
  });

  /**
   * RÈGLE DURE §2.6 et `00` §49 — AUCUN COMPTEUR DE VUES.
   *
   * On vérifie la chose et son ombre : `seen` est un BOOLÉEN (l'anneau), et le
   * compteur affiché est composé depuis `votes.positive` et son libellé serveur.
   * Une bulle qui porterait un nombre de vues le porterait forcément dans `count`.
   */
  it('le compteur est un compteur de VOTES, et l’anneau un booléen', () => {
    const toutes = bandeau.items.flatMap((e) => e.stories);
    bulles.forEach((bulle, i) => {
      const s = toutes[i]!;
      expect(typeof bulle.seen).toBe('boolean');
      expect(bulle.count).toBe(
        `${s.votes.positive} ${s.votes.positiveLabel.toLocaleLowerCase('fr-FR')}`,
      );
      expect(bulle.count.startsWith(String(s.votes.positive))).toBe(true);
    });
  });

  /** T1 §4.2 : anneau épais vert si non vue, fin gris sinon. Jamais de dégradé. */
  it('l’anneau suit `seen`, et ne dégrade jamais', () => {
    for (const bulle of bulles) {
      expect(bulle.ring).toBe(bulle.seen ? '1.5px solid #CBD5D1' : '3px solid #16785E');
      expect(bulle.ring).not.toContain('gradient');
    }
  });
});

describe('la colonne droite (§2.7)', () => {
  it('les événements portent un jour, un mois et une heure lisibles', () => {
    for (const e of eventsFrom(colonne)) {
      expect(e.d).toMatch(/^\d{2}$/);
      expect(e.m).toMatch(/^[A-ZÉÛ]+$/);
      // `venueName` est nullable : on n'écrit jamais « null · 19:00 ».
      expect(e.s).not.toContain('null');
    }
  });

  it('les nouveaux arrivants et les contacts en ligne ont un avatar et un nom', () => {
    const gens = [...arrivalsFrom(colonne), ...onlineFrom(colonne)];
    expect(gens.length).toBeGreaterThan(0);
    for (const g of gens) {
      expect(g.name.length).toBeGreaterThan(0);
      expect(g.i.length).toBeGreaterThanOrEqual(1);
      expect(g.bg).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });
});

describe('les commentaires (§2.5)', () => {
  const lignes = threadFrom(commentaires.items);

  it('la fixture porte un fil avec au moins une réponse', () => {
    expect(lignes.length).toBeGreaterThan(0);
    expect(commentaires.items.some((c) => c.replies.length > 0)).toBe(true);
  });

  /**
   * §2.5 : UNE SEULE profondeur. Les racines ne sont pas indentées, les réponses
   * le sont d'un cran — et il n'existe pas de troisième valeur d'indentation,
   * parce qu'il n'existe pas de troisième niveau (`DEPTH_EXCEEDED`, mesuré 422).
   */
  it('n’a que deux niveaux d’indentation, jamais un troisième', () => {
    const niveaux = new Set(lignes.map((l) => l.indent));
    expect([...niveaux].sort()).toEqual(['0px', '50px'].filter((n) => niveaux.has(n)).sort());
    expect(niveaux.size).toBeLessThanOrEqual(2);
    for (const l of lignes) {
      if (l.indent === '50px') expect(l.canReply).toBe(false);
    }
  });

  /** Aucune réaction de commentaire n'existe côté API : on n'invente pas `likes`. */
  it('n’invente pas de compteur de « j’aime » sur un commentaire', () => {
    for (const l of lignes) expect(l).not.toHaveProperty('likes');
  });
});

describe('l’identité visuelle dérivée', () => {
  it('les initiales suivent le nom, accents compris', () => {
    expect(initials('Amina Diallo')).toBe('AD');
    expect(initials('Émile')).toBe('É');
    expect(initials('  Kofi   Boateng ')).toBe('KB');
    expect(initials('')).toBe('·');
  });

  /**
   * La couleur doit être STABLE : tirée au hasard, le même membre serait de deux
   * couleurs entre le fil et la colonne droite, et d'une autre à chaque rendu.
   */
  it('la couleur d’un membre est stable et vient de la palette de la maquette', () => {
    const palette = ['#0F5C48', '#16785E', '#B4581F', '#2FA37D', '#E0733A'];
    for (const h of ['amina-diallo', 'kofi', 'm01a0f10dd6867000b3c91290b7242', 'z']) {
      const a = avatarColor(h);
      expect(palette).toContain(a);
      expect(avatarColor(h)).toBe(a);
    }
  });
});
