import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  guideListItemSchema,
  guideListResponseSchema,
  guideProposalsResponseSchema,
  type GuideProposalView,
} from '@app/shared';
import {
  guideLiableDe,
  guidesLiablesDe,
  joursAvantEscalade,
  propositionEnTeteDe,
  propositionsCompteDe,
} from './from-api';

/**
 * LES DEUX MOITIÉS QUE LE LOT AVAIT DÉCLARÉES SANS LES SERVIR — A01G et A06.
 *
 * `tools/screens/03-accueil.mjs` liait `guidesSuggeres`/`guidesTrouves` sur les
 * deux cadres de A01G, et quatre prises sur la planche mobile de A06. Les types et
 * les appels n'avaient pas suivi : les cadres lisaient des propriétés que personne
 * ne leur passait. Ce fichier garde les convertisseurs qui les alimentent.
 *
 * LES FIXTURES SONT CELLES DE `@app/shared` — la réponse OCTET POUR OCTET de l'API
 * qui tournait — et elles passent par le SCHÉMA avant d'être converties, comme le
 * socle le fait. Un test qui convertirait un objet littéral écrit à la main ne
 * prouverait que la cohérence de son auteur avec lui-même.
 *
 * Chaque bloc porte au moins une RÈGLE DURE, et les derniers sont des TÉMOINS : on
 * mute un champ qui ne décide de RIEN et on exige que le résultat ne bouge pas.
 * Sans eux, un convertisseur qui lirait la bonne valeur par accident — parce
 * qu'elle se trouve au bon rang — passerait pour correct.
 */

const FIXTURES = resolve(
  import.meta.dirname,
  '../../../../../packages/shared/src/__tests__/fixtures',
);

function charge(nom: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURES, `${nom}.json`), 'utf8'));
}

const liste = guideListResponseSchema.parse(charge('guides_list'));
const propositions = guideProposalsResponseSchema.parse(charge('guide_proposals'));

/** Le premier élément, nommé une fois : `noUncheckedIndexedAccess` est actif. */
function item(rang: number) {
  const g = liste.items[rang];
  if (g === undefined) throw new Error(`la fixture n'a pas d'élément au rang ${rang}`);
  return g;
}

function proposition(rang: number): GuideProposalView {
  const p = propositions.items[rang];
  if (p === undefined) throw new Error(`la fixture n'a pas de proposition au rang ${rang}`);
  return p;
}

// ─── A01G · la ligne de contexte d'une carte de guide liable ────────────────

describe('A01G — les cartes de « Lier un guide »', () => {
  /**
   * LA VILLE PASSE DEVANT LA PORTÉE, et la fixture le prouve sans qu'on l'arrange :
   * son premier guide est `scope: UNIVERSAL` ET `city: Nantes`. La maquette écrit
   * « Santé · Lyon · 57 utiles » — une VILLE — donc c'est elle qu'on lit quand elle
   * est là, et non « Universel ».
   */
  it('préfère la VILLE à la portée, même sur un guide universel', () => {
    const g = item(0);
    expect(g.scope).toBe('UNIVERSAL');
    expect(g.city?.name).toBe('Nantes');
    expect(guideLiableDe(g).meta).toBe('Arrivée · Nantes · 31 utiles');
  });

  /** Sans ville, c'est le NOM DU PAYS — « Bénin », pas « Pays ». */
  it('retombe sur le nom du PAYS quand le guide ne nomme pas de ville', () => {
    const g = item(1);
    expect(g.city).toBeNull();
    expect(guideLiableDe(g).meta).toBe('Travail et études · Bénin · 12 utiles');
  });

  it('porte le titre du guide VERBATIM', () => {
    expect(guideLiableDe(item(0)).titre).toBe('Ouvrir un compte bancaire en arrivant en France');
  });

  it('accorde « utile » au singulier', () => {
    const un = guideListItemSchema.parse({ ...item(0), helpfulCount: 1 });
    expect(guideLiableDe(un).meta).toBe('Arrivée · Nantes · 1 utile');
    const zero = guideListItemSchema.parse({ ...item(0), helpfulCount: 0 });
    expect(guideLiableDe(zero).meta).toBe('Arrivée · Nantes · 0 utile');
  });

  it('convertit la page entière, dans l’ordre que l’API donne', () => {
    const cartes = guidesLiablesDe(liste);
    expect(cartes.map((c) => c.titre)).toEqual(liste.items.map((g) => g.title));
  });

  /**
   * RÈGLE DURE (`00` §49) : le compteur affiché est un compteur de VOTES d'utilité,
   * jamais de VUES. `guides.view_count` existe en base et n'a pas le droit de
   * sortir — et le schéma `.strict()` le refuse À LA FRONTIÈRE, donc il ne peut pas
   * même atteindre le convertisseur. On le vérifie plutôt que de l'affirmer.
   */
  it('RÈGLE DURE — un compteur de VUES ne franchit pas la frontière', () => {
    expect(() => guideListItemSchema.parse({ ...item(0), viewCount: 4200 })).toThrow();
  });
});

// ─── A06 · le délai avant escalade, et les compteurs d'onglets ──────────────

describe('A06 — le délai avant escalade', () => {
  /**
   * ARRONDI AU JOUR SUPÉRIEUR (§2.4). À onze jours et deux heures il reste
   * « 12 j » : un arrondi vers le bas afficherait « 0 j » pendant les vingt-trois
   * dernières heures, c'est-à-dire un délai dépassé qui ne l'est pas.
   */
  it('arrondit au jour SUPÉRIEUR', () => {
    const maintenant = new Date('2026-03-01T00:00:00.000Z');
    const dans11j2h = new Date('2026-03-12T02:00:00.000Z').toISOString();
    expect(joursAvantEscalade(dans11j2h, maintenant)).toBe(12);
  });

  it('rend 0 quand l’escalade est due, et jamais un nombre négatif', () => {
    const maintenant = new Date('2026-03-01T00:00:00.000Z');
    expect(joursAvantEscalade(new Date('2026-02-20T00:00:00.000Z').toISOString(), maintenant)).toBe(
      0,
    );
  });

  /**
   * LA PASTILLE DIT « 11 j », PAS « 11 jours restants ».
   *
   * Deux dessins de la même donnée : `delaiAvantEscalade` rend la phrase longue de
   * la carte dépliée d'ordinateur, `propositionEnTeteDe` la pastille étroite de la
   * planche mobile. Le NOMBRE, lui, est calculé une seule fois — sinon les deux
   * finiraient par se contredire d'un jour.
   */
  it('écrit le délai dans la forme COURTE de la pastille', () => {
    const p = proposition(0);
    const maintenant = new Date(new Date(p.escalateAt).getTime() - 3 * 86_400_000);
    expect(propositionEnTeteDe(p, maintenant).delai).toBe('3 j');
  });

  it('dit « Dépassé » plutôt que « 0 j »', () => {
    const p = proposition(0);
    const maintenant = new Date(new Date(p.escalateAt).getTime() + 86_400_000);
    expect(propositionEnTeteDe(p, maintenant).delai).toBe('Dépassé');
  });

  it('porte le proposant et son motif tels que l’API les rend', () => {
    const p = proposition(0);
    const vue = propositionEnTeteDe(p, new Date('2026-09-20T00:00:00.000Z'));
    expect(vue.proposant).toBe('Amina Diallo');
    expect(vue.i).toBe('AD');
    expect(vue.motif).toBe(p.reason);
  });
});

describe('A06 — les compteurs des onglets', () => {
  /** Un petit atelier : la fixture n'a qu'UNE proposition, et il en faut cinq statuts. */
  function avecStatut(status: GuideProposalView['status']): GuideProposalView {
    return { ...proposition(0), status };
  }

  /**
   * SEULES `PENDING` ET `ESCALATED` ATTENDENT UNE DÉCISION (§2.4).
   *
   * C'est la règle que ce compteur porte, et la seule chose qu'il puisse se
   * tromper : compter `REJECTED` dans « En attente » donnerait un onglet qui
   * réclame une décision déjà prise.
   */
  it('« En attente » ne compte que PENDING et ESCALATED', () => {
    const compte = propositionsCompteDe([
      avecStatut('PENDING'),
      avecStatut('ESCALATED'),
      avecStatut('REJECTED'),
      avecStatut('ACCEPTED'),
    ]);
    expect(compte.attente).toBe(2);
  });

  it('« Acceptées » compte ACCEPTED et AMENDED, et REJECTED dans NI l’un NI l’autre', () => {
    const compte = propositionsCompteDe([
      avecStatut('ACCEPTED'),
      avecStatut('AMENDED'),
      avecStatut('REJECTED'),
    ]);
    expect(compte.acceptees).toBe(2);
    expect(compte.attente).toBe(0);
  });

  /**
   * Ce test ne peut PAS être satisfait par accident : une liste vide doit rendre
   * deux zéros, et non les « 2 » et « 7 » que la maquette dessine. C'est exactement
   * le défaut qu'on répare — un compteur de maquette servi pour une donnée absente.
   */
  it('rend deux zéros sur une liste vide, et non les nombres de la maquette', () => {
    expect(propositionsCompteDe([])).toEqual({ attente: 0, acceptees: 0 });
  });

  /** La charge réelle : une seule proposition, acceptée. */
  it('compte la charge réelle de la fixture', () => {
    expect(propositionsCompteDe(propositions.items)).toEqual({ attente: 0, acceptees: 1 });
  });
});

// ─── TÉMOINS — muter ce qui ne décide de rien ne doit RIEN changer ──────────

describe('témoins', () => {
  /**
   * `freshnessScore` et `status` ne sont PAS lus par la ligne de contexte de A01G.
   * Les muter doit laisser le `meta` identique — sinon le convertisseur lit une
   * valeur par sa position et non par son nom.
   */
  it('TÉMOIN — muter `freshnessScore` ne change pas la carte liable', () => {
    const attendu = guideLiableDe(item(0));
    const mute = guideListItemSchema.parse({ ...item(0), freshnessScore: 0.01 });
    expect(guideLiableDe(mute)).toEqual(attendu);
  });

  it('TÉMOIN — muter le `slug` ne change pas la carte liable', () => {
    const attendu = guideLiableDe(item(0));
    const mute = guideListItemSchema.parse({ ...item(0), slug: 'un-slug-tout-autre' });
    expect(guideLiableDe(mute)).toEqual(attendu);
  });

  /**
   * TÉMOIN — le STATUT ne touche pas l'en-tête d'une proposition.
   *
   * Il décide des COMPTEURS (ci-dessus) et de rien d'autre : l'avatar, le nom, le
   * délai et le motif sont les mêmes qu'elle soit en attente ou refusée.
   */
  it('TÉMOIN — muter le statut ne change pas l’en-tête de la proposition', () => {
    const p = proposition(0);
    const maintenant = new Date('2026-09-20T00:00:00.000Z');
    const attendu = propositionEnTeteDe(p, maintenant);
    expect(propositionEnTeteDe({ ...p, status: 'REJECTED' }, maintenant)).toEqual(attendu);
    expect(propositionEnTeteDe({ ...p, status: 'PENDING' }, maintenant)).toEqual(attendu);
  });

  /** TÉMOIN — l'ordre des propositions ne change pas les compteurs. */
  it('TÉMOIN — l’ordre de la liste ne change pas les compteurs', () => {
    const a = { ...proposition(0), status: 'PENDING' as const };
    const b = { ...proposition(0), status: 'ACCEPTED' as const };
    expect(propositionsCompteDe([a, b])).toEqual(propositionsCompteDe([b, a]));
  });
});
