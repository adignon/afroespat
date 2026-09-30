import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  guideDetailResponseSchema,
  guideListResponseSchema,
  guideVersionsResponseSchema,
  type GuideListItemView,
  type GuideVersionsResponse,
} from '@app/shared';
import {
  contributorsFrom,
  delaiAvantEscalade,
  guideCardFrom,
  guideCardsFrom,
  updatedLabel,
  versionsFrom,
} from './from-api';

/**
 * LE CONVERTISSEUR DES GUIDES, ÉPROUVÉ SUR LA CHARGE RÉELLE.
 *
 * Les fixtures sont celles de `@app/shared` : la réponse OCTET POUR OCTET des
 * lectures publiques de 05 §4, relevée sur l'API qui tournait. On les fait passer
 * par le SCHÉMA avant de les convertir, exactement comme le socle le fait — un
 * test qui convertirait un objet littéral écrit à la main ne prouverait que la
 * cohérence de son auteur avec lui-même.
 *
 * Ce fichier garde trois choses, dans cet ordre d'importance :
 *
 *   1. les RÈGLES DURES de 05 §9 que le front peut enfreindre tout seul ;
 *   2. les cas normaux que le front pourrait prendre pour des pannes — un guide
 *      anonymisé, un guide sans ville, une version sans résumé ;
 *   3. des MUTATIONS TÉMOINS : on mute un endroit qui ne décide de RIEN et on
 *      exige que le résultat ne bouge pas. Sans elles, un convertisseur qui lirait
 *      la bonne valeur par accident — parce qu'elle est au bon rang — passerait
 *      pour un convertisseur correct.
 */

const FIXTURES = resolve(
  import.meta.dirname,
  '../../../../../packages/shared/src/__tests__/fixtures',
);

function charge(nom: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURES, `${nom}.json`), 'utf8'));
}

/** La liste réelle, validée par le schéma — donc exactement ce que le socle rend. */
const liste = guideListResponseSchema.parse(charge('guides_list'));
const detail = guideDetailResponseSchema.parse(charge('guide_detail'));

/** Le 30 septembre 2026 : la date à laquelle les fixtures ont été relevées. */
const MAINTENANT = new Date('2026-09-30T19:15:07.903Z');

// ─── 1. Les règles dures ────────────────────────────────────────────────────

describe('règle dure §9 — la date de mise à jour est sur CHAQUE guide de liste', () => {
  /**
   * « Date de mise à jour aussi visible que le titre » (T1 §6). Le front peut
   * enfreindre cette règle tout seul, en omettant le champ ou en le laissant vide
   * quand la date est vieille — ce qui est précisément le cas où elle compte.
   */
  it('chaque carte porte une date non vide', () => {
    const cartes = guideCardsFrom(liste, MAINTENANT);
    expect(cartes.length).toBeGreaterThanOrEqual(2);
    for (const c of cartes) {
      expect(c.updated).toMatch(/^Mis à jour le \d/);
    }
  });

  /**
   * Y COMPRIS SUR LE GUIDE LE PLUS VIEUX. C'est le contre-exemple qui rend le cas
   * précédent concluant : un convertisseur qui masquerait la date au-delà d'un
   * certain âge — « c'est trop vieux, ça fait mauvais effet » — passerait le test
   * ci-dessus tant que la fixture n'a que des guides récents.
   */
  it('le guide de 30 mois porte SA date, et l’année puisqu’elle n’est pas l’année courante', () => {
    const vieux = liste.items.find((g) => g.banners.some((b) => b.kind === 'TO_VERIFY'));
    expect(vieux).toBeDefined();
    const carte = guideCardFrom(vieux as GuideListItemView, MAINTENANT);
    expect(carte.updated).toBe('Mis à jour le 30 mars 2024');
  });

  /** L'année est TUE quand c'est l'année courante — ce que la maquette écrit. */
  it('un guide de l’année courante n’affiche pas l’année', () => {
    expect(updatedLabel('2026-08-21T19:15:07.903Z', MAINTENANT)).toBe('Mis à jour le 21 août');
  });
});

describe('règle dure 00 §49 — aucun compteur de vues', () => {
  /**
   * `guides.view_count` EXISTE en base et une tâche horaire le remplit. La règle
   * est tenue à la FRONTIÈRE par les schémas `.strict()` de `@app/shared` — dont
   * la preuve est dans `guides-responses.test.ts`. Ici on garde le maillon d'après :
   * que `useful` soit bien le compteur de VOTES et non autre chose.
   *
   * La fixture rend ce test concluant : le guide seedé porte `view_count = 412` en
   * base et `helpful_count = 31`. Si le convertisseur lisait le mauvais champ, le
   * chiffre le dirait.
   */
  it('`useful` est le compteur de votes d’utilité, pas un compteur de vues', () => {
    const carte = guideCardFrom(liste.items[0] as GuideListItemView, MAINTENANT);
    expect(carte.useful).toBe(31);
    expect(carte.useful).not.toBe(412);
  });

  /** Aucune carte ne porte de champ dont le nom évoque une vue. */
  it('aucune prise de carte ne s’appelle `views` ou `viewCount`', () => {
    const carte = guideCardFrom(liste.items[0] as GuideListItemView, MAINTENANT);
    const cles = Object.keys(carte).map((k) => k.toLowerCase());
    expect(cles.filter((k) => k.includes('view') || k.includes('vue'))).toEqual([]);
  });
});

describe('§2.3 — le bandeau « À vérifier » vient du SERVEUR', () => {
  /**
   * Le seuil de 24 mois est une règle métier. Un front qui recalculerait l'âge
   * afficherait un jour un bandeau que le serveur ne pose plus, ou l'inverse — et
   * les deux ne se verraient que sur les guides de bord.
   */
  it('le guide porteur du bandeau TO_VERIFY a `verify` vrai, l’autre faux', () => {
    const cartes = guideCardsFrom(liste, MAINTENANT);
    const avec = liste.items.map((g) => g.banners.some((b) => b.kind === 'TO_VERIFY'));
    expect(cartes.map((c) => c.verify)).toEqual(avec);
    // CONTRE-EXEMPLE : sans au moins un `true` et un `false`, l'égalité ci-dessus
    // serait satisfaite par un convertisseur qui renverrait toujours la même chose.
    expect(new Set(cartes.map((c) => c.verify)).size).toBe(2);
  });

  /**
   * MUTATION TÉMOIN — l'ÂGE ne décide de rien.
   *
   * On rajeunit la date du guide signalé de trente mois : s'il restait un calcul
   * d'âge dans le convertisseur, le bandeau disparaîtrait. Il doit rester, parce
   * que c'est le bandeau du serveur qui le pose.
   */
  it('TÉMOIN : rajeunir la date ne retire pas le bandeau (il vient du serveur)', () => {
    const vieux = liste.items.find((g) =>
      g.banners.some((b) => b.kind === 'TO_VERIFY'),
    ) as GuideListItemView;
    const rajeuni: GuideListItemView = {
      ...vieux,
      lastContentUpdateAt: '2026-09-01T00:00:00.000Z',
    };
    expect(guideCardFrom(rajeuni, MAINTENANT).verify).toBe(true);
  });

  /**
   * MUTATION TÉMOIN inverse — vieillir un guide SANS bandeau ne doit rien poser.
   */
  it('TÉMOIN : vieillir un guide sans bandeau ne fait pas apparaître « À vérifier »', () => {
    const frais = liste.items.find((g) => g.banners.length === 0) as GuideListItemView;
    const vieilli: GuideListItemView = {
      ...frais,
      lastContentUpdateAt: '2015-01-01T00:00:00.000Z',
    };
    expect(guideCardFrom(vieilli, MAINTENANT).verify).toBe(false);
  });
});

describe('§2.7 — la version COURANTE est celle que `meta` désigne', () => {
  /**
   * LE PIÈGE, et la raison d'être de ce bloc.
   *
   * L'historique est trié par numéro DÉCROISSANT, donc la version courante est
   * presque toujours au rang 0. Un convertisseur qui écrirait `i === 0` passerait
   * tous les tests écrits sur une charge ordinaire.
   *
   * Sauf qu'un RETOUR ARRIÈRE (§2.7) crée une version PLUS RÉCENTE dont le corps
   * est ancien — et c'est elle la courante. « Presque toujours » est exactement ce
   * qui rend ce défaut invisible. On construit donc le cas où les deux divergent.
   */
  const troisVersions: GuideVersionsResponse = guideVersionsResponseSchema.parse({
    items: [
      {
        id: '11111111-0000-4000-8000-000000000003',
        version: 3,
        summary: 'Retour arrière',
        createdAt: '2026-09-20T10:00:00.000Z',
        sourceProposalId: null,
        createdBy: { handle: 'marc-k', displayName: 'Marc Koudou' },
      },
      {
        id: '11111111-0000-4000-8000-000000000002',
        version: 2,
        summary: 'Délais mis à jour',
        createdAt: '2026-08-10T10:00:00.000Z',
        sourceProposalId: null,
        createdBy: { handle: 'fatou-n', displayName: 'Fatou Ndiaye' },
      },
      {
        id: '11111111-0000-4000-8000-000000000001',
        version: 1,
        summary: null,
        createdAt: '2026-07-01T10:00:00.000Z',
        sourceProposalId: null,
        createdBy: { handle: 'aicha-d', displayName: 'Aïcha Diop' },
      },
    ],
    nextCursor: null,
    // La COURANTE est la version 2, PAS celle du rang 0.
    meta: { currentVersionId: '11111111-0000-4000-8000-000000000002' },
  });

  it('la pastille verte suit `meta.currentVersionId`, pas le rang 0', () => {
    const lignes = versionsFrom(troisVersions);
    expect(lignes.map((l) => l.isCurrent)).toEqual([false, true, false]);
    expect(lignes[1]?.dot).toBe('#16785E');
    expect(lignes[0]?.dot).toBe('#CBD5D1');
  });

  /**
   * MUTATION TÉMOIN — l'ORDRE des lignes ne décide de rien.
   *
   * On renverse la liste. La pastille doit rester sur la MÊME version, ce qui ne
   * peut être vrai que si elle est choisie par l'identifiant. Un `i === 0`
   * changerait de ligne, un `.at(-1)` aussi.
   */
  it('TÉMOIN : renverser l’ordre ne déplace pas la pastille verte', () => {
    const renverse: GuideVersionsResponse = {
      ...troisVersions,
      items: [...troisVersions.items].reverse(),
    };
    const courante = versionsFrom(renverse).find((l) => l.isCurrent);
    expect(courante?.versionId).toBe('11111111-0000-4000-8000-000000000002');
    expect(versionsFrom(renverse).filter((l) => l.isCurrent)).toHaveLength(1);
  });

  it('le titre reprend le résumé, ou se réduit au numéro quand il n’y en a pas', () => {
    const lignes = versionsFrom(troisVersions);
    expect(lignes[0]?.t).toBe('Version 3 — Retour arrière');
    expect(lignes[2]?.t).toBe('Version 1');
  });

  it('l’auteur d’une version est abrégé « Prénom N. », comme la maquette', () => {
    expect(versionsFrom(troisVersions)[0]?.s).toBe('20 sept. · Marc K.');
  });
});

describe('§2.4 — le délai avant escalade est arrondi au jour SUPÉRIEUR', () => {
  /**
   * À onze jours et deux heures, il reste « 12 jours » dans le langage courant.
   * Un arrondi vers le bas afficherait « 0 jour » pendant les vingt-trois
   * dernières heures : un délai dépassé qui ne l'est pas, sur l'écran même où
   * l'auteur décide s'il a le temps de répondre.
   */
  const t0 = new Date('2026-09-30T12:00:00.000Z');

  it('onze jours et deux heures restants s’annoncent « 12 jours »', () => {
    expect(delaiAvantEscalade('2026-10-11T14:00:00.000Z', t0)).toBe('12 jours restants');
  });

  it('moins d’un jour reste « 1 jour », au singulier', () => {
    expect(delaiAvantEscalade('2026-09-30T23:00:00.000Z', t0)).toBe('1 jour restant');
  });

  it('une échéance passée dit « Délai dépassé », jamais un nombre négatif', () => {
    expect(delaiAvantEscalade('2026-09-29T12:00:00.000Z', t0)).toBe('Délai dépassé');
  });

  /** La borne exacte : à l'instant pile, le délai est dépassé, pas « 0 jour ». */
  it('à l’instant pile de l’escalade, « Délai dépassé »', () => {
    expect(delaiAvantEscalade('2026-09-30T12:00:00.000Z', t0)).toBe('Délai dépassé');
  });
});

// ─── 2. Les cas normaux qu'on pourrait prendre pour des pannes ──────────────

describe('les cas normaux de §8 et §2.1 ne cassent rien', () => {
  /**
   * §8 — l'anonymisation met `author_user_id` à null et CONSERVE le guide. Si le
   * convertisseur levait ici, tous les guides des comptes supprimés
   * disparaîtraient de la liste, et le symptôme serait « contrat cassé ».
   */
  it('un guide anonymisé rend une carte lisible', () => {
    const anonyme: GuideListItemView = { ...(liste.items[0] as GuideListItemView), author: null };
    const carte = guideCardFrom(anonyme, MAINTENANT);
    expect(carte.author).toBe('Auteur anonymisé');
    expect(carte.i).toBe('·');
    expect(carte.updated).toMatch(/^Mis à jour le /);
  });

  it('un guide UNIVERSAL affiche « Universel », un guide COUNTRY affiche le PAYS', () => {
    const cartes = guideCardsFrom(liste, MAINTENANT);
    expect(cartes.map((c) => c.scope)).toEqual(['Universel', 'Bénin']);
  });

  it('les six catégories sont traduites, sans jamais le mot « certifié » (§2.1)', () => {
    const cartes = guideCardsFrom(liste, MAINTENANT);
    expect(cartes.map((c) => c.cat)).toEqual(['Arrivée', 'Travail et études']);
    for (const c of cartes) {
      expect(c.cat.toLowerCase()).not.toContain('certifi');
    }
  });

  it('les contributeurs deviennent des pastilles d’initiales', () => {
    const pastilles = contributorsFrom(detail);
    expect(pastilles).toHaveLength(1);
    expect(pastilles[0]?.i).toBe('AD');
    expect(pastilles[0]?.bg).toMatch(/^#[0-9A-F]{6}$/i);
  });
});

// ─── 3. Témoins de stabilité ────────────────────────────────────────────────

describe('témoins — ce qui ne décide de rien ne change rien', () => {
  /**
   * La couleur d'avatar est dérivée du HANDLE et doit être STABLE : le même membre
   * garde la sienne entre la liste et la fiche du guide. Si elle dépendait du nom
   * affiché — que le membre peut changer — il changerait de couleur en se
   * renommant, et de deux couleurs différentes selon l'écran.
   */
  it('TÉMOIN : changer le nom affiché ne change pas la couleur d’avatar', () => {
    const g = liste.items[0] as GuideListItemView;
    const avant = guideCardFrom(g, MAINTENANT).bg;
    const renomme: GuideListItemView = {
      ...g,
      author: { ...(g.author as NonNullable<GuideListItemView['author']>), displayName: 'Tout Autre Nom' },
    };
    expect(guideCardFrom(renomme, MAINTENANT).bg).toBe(avant);
  });

  /** Et elle CHANGE quand le handle change — sans quoi le témoin serait vacant. */
  it('CONTRE-ÉPREUVE : deux handles différents ne donnent pas toujours la même couleur', () => {
    const g = liste.items[0] as GuideListItemView;
    const couleurs = new Set(
      ['aa', 'bb', 'cc', 'dd', 'ee', 'ff', 'gg', 'hh'].map(
        (h) =>
          guideCardFrom(
            { ...g, author: { ...(g.author as NonNullable<GuideListItemView['author']>), handle: h } },
            MAINTENANT,
          ).bg,
      ),
    );
    expect(couleurs.size).toBeGreaterThan(1);
  });

  /**
   * TÉMOIN — le compteur d'utilité ne touche pas à la date, et réciproquement.
   * Deux champs voisins sur la carte, qu'un convertisseur maladroit pourrait
   * croiser.
   */
  it('TÉMOIN : changer `helpfulCount` ne change pas la date affichée', () => {
    const g = liste.items[0] as GuideListItemView;
    const avant = guideCardFrom(g, MAINTENANT).updated;
    expect(guideCardFrom({ ...g, helpfulCount: 9999 }, MAINTENANT).updated).toBe(avant);
  });
});
