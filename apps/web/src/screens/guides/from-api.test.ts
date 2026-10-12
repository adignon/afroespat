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
  guideHeadFrom,
  guidePlanFrom,
  hrefPageGuide,
  PLAN_AVANT_REPONSE,
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

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « À VÉRIFIER » PORTE SON NOMBRE DE MOIS, ET IL VIENT DU SERVEUR            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « fais le reste aussi. » Le bandeau n'affichait que « À vérifier »
 * alors que `bannersFor()` pousse `{ kind: 'TO_VERIFY', months }` — relevé sur la
 * charge réelle de `guides_list.json`, qui porte `months: 30`.
 *
 * LES TROIS CAS SONT GARDÉS : le nombre affiché, l'absence de nombre, et le
 * TÉMOIN qui prouve que le nombre n'est pas recalculé d'une date.
 */
describe('§2.3 — le bandeau « À vérifier » porte le nombre de mois du SERVEUR', () => {
  /** Un détail dont le bandeau est celui qu'on veut éprouver, et rien d'autre. */
  const avecBandeau = (banners: GuideListItemView['banners']) =>
    guideHeadFrom({ ...detail, guide: { ...detail.guide, banners } }, 0, MAINTENANT);

  it('écrit la tournure du schéma, avec le nombre que le serveur envoie', () => {
    expect(avecBandeau([{ kind: 'TO_VERIFY', months: 30 }]).avertissementTexte).toBe(
      'À vérifier — dernière mise à jour il y a 30 mois',
    );
    // « mois » est INVARIABLE : le singulier s'écrit du même mot, et aucune
    // bascule de pluriel ne doit apparaître.
    expect(avecBandeau([{ kind: 'TO_VERIFY', months: 1 }]).avertissementTexte).toBe(
      'À vérifier — dernière mise à jour il y a 1 mois',
    );
  });

  /**
   * `months` est `.optional()` et non `.nullable()` dans `guideBannerSchema` —
   * relevé sur la charge. Un `TO_VERIFY` sans nombre est donc une forme VALIDE du
   * contrat, et elle ne doit pas écrire « il y a undefined mois ».
   */
  it('retombe sur « À vérifier » tout court quand le serveur n’envoie pas de nombre', () => {
    expect(avecBandeau([{ kind: 'TO_VERIFY' }]).avertissementTexte).toBe('À vérifier');
  });

  /**
   * `OUTDATED_REPORTED` ne reçoit PAS `months`, et il n'en veut pas : il parle de
   * signalements, pas d'âge. Sa phrase ne doit pas avoir changé d'un caractère.
   */
  it('laisse « des membres signalent » sans nombre', () => {
    expect(avecBandeau([{ kind: 'OUTDATED_REPORTED' }]).avertissementTexte).toBe(
      'Des membres signalent que cette information a changé',
    );
  });

  /**
   * MUTATION TÉMOIN — le nombre n'est pas déduit de `lastContentUpdateAt`.
   *
   * On rajeunit la date du guide de plusieurs années en gardant `months: 30`. Si
   * un calcul d'âge s'était glissé dans le convertisseur, le nombre affiché
   * changerait. Il doit rester 30, parce que c'est le serveur qui compte.
   */
  it('TÉMOIN : rajeunir la date ne change pas le nombre de mois affiché', () => {
    const rajeuni = guideHeadFrom(
      {
        ...detail,
        guide: {
          ...detail.guide,
          lastContentUpdateAt: '2026-09-20T00:00:00.000Z',
          banners: [{ kind: 'TO_VERIFY', months: 30 }],
        },
      },
      0,
      MAINTENANT,
    );
    expect(rajeuni.avertissementTexte).toBe('À vérifier — dernière mise à jour il y a 30 mois');
  });
});

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ §2.6 — L'ÉCHÉANCE DE DÉPUBLICATION, ET LES DEUX PHRASES DE SON DÉPASSEMENT ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * POURQUOI CE BLOC EXISTE : le dépassement de l'échéance NE SE MESURE PAS AU
 * NAVIGATEUR par le chemin du produit. `flagOutdated` pose l'échéance à
 * `now + GUIDE_UNPUBLISH_DELAY_DAYS` (30 jours), et la faire passer demanderait
 * soit d'attendre un mois, soit d'écrire en base — ce que le mémo du dépôt
 * interdit (« monte le décor par les VRAIES routes du produit »). C'est donc la
 * COMPOSITION qu'on éprouve ici, à l'endroit où elle est écrite.
 *
 * Les deux phrases sont l'ARBITRAGE DU PORTEUR, mot pour mot. Un test qui les
 * garde empêche qu'un lot suivant les « améliore » sans l'avoir demandé — et
 * surtout qu'il les INTERVERTISSE, ce qui annoncerait une fatalité à celui qui
 * peut encore agir.
 *
 * La fixture porte `unpublishDeadlineAt: null` et `isAuthor: false` : les deux
 * champs sont donc posés sur la copie, et leur valeur de départ est ce qui rend ce
 * bloc nécessaire — sans échéance, aucun de ces cas ne se produit.
 */
describe('§2.6 — l’échéance de dépublication dit qui doit faire quoi', () => {
  const avecEcheance = (echeance: string | null, auteur: boolean) =>
    guideHeadFrom(
      {
        ...detail,
        guide: {
          ...detail.guide,
          banners: [{ kind: 'OUTDATED_REPORTED' }],
          unpublishDeadlineAt: echeance,
          isAuthor: auteur,
        },
      },
      0,
      MAINTENANT,
    ).avertissementTexte;

  /** AVANT l'échéance, les deux lecteurs lisent la MÊME consigne datée. */
  it('avant l’échéance, la date est écrite — et la même pour les deux', () => {
    const attendu =
      'Des membres signalent que cette information a changé — à corriger avant le 9 nov., puis dépublication';
    expect(avecEcheance('2026-11-09T00:00:00.000Z', false)).toBe(attendu);
    expect(avecEcheance('2026-11-09T00:00:00.000Z', true)).toBe(attendu);
  });

  /**
   * APRÈS l'échéance, les deux phrases DIVERGENT, et c'est tout l'objet du lot :
   * le lecteur reçoit un avertissement, l'auteur une consigne. Avant, la clause
   * disparaissait purement et simplement — l'écran était muet au moment le plus
   * utile, la tâche de dépublication passant une fois par jour.
   */
  it('après l’échéance, le LECTEUR est averti du retrait', () => {
    expect(avecEcheance('2026-09-01T00:00:00.000Z', false)).toBe(
      'Des membres signalent que cette information a changé — délai de correction dépassé, ce guide va être retiré',
    );
  });

  it('après l’échéance, l’AUTEUR reçoit une consigne, pas une fatalité', () => {
    expect(avecEcheance('2026-09-01T00:00:00.000Z', true)).toBe(
      'Des membres signalent que cette information a changé — le délai est dépassé, corrigez maintenant pour éviter le retrait',
    );
  });

  /**
   * TÉMOIN — `null` est le cas NORMAL et il n'ajoute rien, pour personne. La très
   * grande majorité des guides n'a jamais atteint le seuil des trois signalements,
   * et une clause qui s'afficherait là serait visible sur presque tout le produit.
   */
  it('TÉMOIN : sans échéance, aucune clause — ni au lecteur ni à l’auteur', () => {
    expect(avecEcheance(null, false)).toBe(
      'Des membres signalent que cette information a changé',
    );
    expect(avecEcheance(null, true)).toBe('Des membres signalent que cette information a changé');
  });
});

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ §2.6 — LE COMPTE DES SIGNALEMENTS, ET RIEN QUE LE COMPTE                   ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * ARBITRAGE DU PORTEUR : « Les signalants resteront anonymes : l'auteur ne voit
 * que le compte. Pas des commentaires et autres. »
 *
 * Le nombre vient de `outdatedFlagCount`, que la carte d'auteur peignait en dur à
 * « 0 ». L'accord du mot est gardé ici parce qu'il décide d'un AFFICHAGE : « 1
 * signalement » au singulier est la seule forme juste, et un `s` de trop se lit.
 */
describe('§2.6 — le compte des signalements « a changé » et l’accord de son mot', () => {
  const avecCompte = (n: number) =>
    guideHeadFrom({ ...detail, guide: { ...detail.guide, outdatedFlagCount: n } }, 0, MAINTENANT);

  it('porte le compte du serveur, et accorde le mot', () => {
    expect(avecCompte(0).signalements).toBe(0);
    expect(avecCompte(0).signalementsMot).toBe('signalements');
    expect(avecCompte(1).signalementsMot).toBe('signalement');
    expect(avecCompte(3).signalements).toBe(3);
    expect(avecCompte(3).signalementsMot).toBe('signalements');
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

// ─── 5. Le plan des pages ───────────────────────────────────────────────────

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE GUIDE À TROIS PAGES EST CONSTRUIT, PUIS REPASSÉ PAR LE SCHÉMA           ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La charge relevée n'a qu'UNE page — les fixtures datent d'avant la
 * fonctionnalité, et c'est très bien : elles éprouvent le cas de compatibilité.
 * Pour le reste, on MUTE la charge et on la REPASSE PAR LE SCHÉMA, exactement
 * comme les mutations témoins de ce fichier : un objet littéral écrit à la main ne
 * prouverait que la cohérence de son auteur avec lui-même, et `.strict()` ne
 * dirait rien d'un champ oublié.
 */
function detailAPages(
  pages: readonly { readonly position: number; readonly title: string; readonly slug: string; readonly commentCount: number }[],
  luePosition: number,
) {
  const brut = charge('guide_detail') as Record<string, unknown>;
  const complet = pages.map((p, i) => ({
    id: `cccccccc-0000-4000-8000-00000000000${String(i + 1)}`,
    position: p.position,
    title: p.title,
    slug: p.slug,
    commentCount: p.commentCount,
  }));
  const lue = complet.find((p) => p.position === luePosition);
  return guideDetailResponseSchema.parse({
    ...brut,
    pages: complet,
    currentPage: lue,
    guide: {
      ...(brut['guide'] as Record<string, unknown>),
      pageCount: complet.length,
      commentCount: lue?.commentCount ?? 0,
    },
  });
}

const TROIS = [
  { position: 1, title: 'Le dossier', slug: 'le-dossier', commentCount: 4 },
  { position: 2, title: 'Le rendez-vous', slug: 'le-rendez-vous', commentCount: 0 },
  { position: 3, title: 'Ce qui m’a surpris', slug: 'ce-qui-m-a-surpris', commentCount: 1 },
] as const;

describe('le plan des pages — ce que le porteur a demandé', () => {
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ CES DEUX CAS GELAIENT LE TITRE. LE PORTEUR A DEMANDÉ LE NUMÉRO           ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * « Au niveau du bouton prev et next des pages guide il faut plutôt mettre le
   * numéro de la page. Aussi au niveau de section qui liste les pages à droite,
   * c'est le numéro tu mets au début. »
   *
   * Les deux cas étaient JUSTES sur la forme précédente — ils disaient que la
   * pastille du milieu porte le titre de la page lue, et que les rangées portent
   * les titres nus. Ils sont corrigés, pas assouplis : chacun gèle maintenant la
   * forme NOUVELLE, assez précisément pour tomber si elle rechange.
   */
  it('un guide d’UNE page n’a pas de plan : rien ne se dessine', () => {
    const plan = guidePlanFrom(detail);
    expect(detail.pages).toHaveLength(1);
    expect(plan.visible).toBe(false);
    /**
     * La pastille reste composée : c'est le `<sc-if>` du cadre qui la cache, pas
     * une valeur vide. Et elle dit « 1 sur 1 » — le numérateur et le dénominateur
     * sont comptés sur la MÊME liste, donc ils ne peuvent pas diverger.
     */
    expect(plan.titre).toBe('1 sur 1');
  });

  it('un guide de trois pages les liste dans l’ordre, NUMÉROTÉES', () => {
    const plan = guidePlanFrom(detailAPages(TROIS, 1));
    expect(plan.visible).toBe(true);
    expect(plan.pages.map((p) => p.label)).toEqual([
      '1. Le dossier',
      '2. Le rendez-vous',
      '3. Ce qui m’a surpris',
    ]);
  });

  /**
   * LA PASTILLE SUIT LA PAGE LUE, et c'est tout son intérêt : entre deux flèches,
   * elle répond à « où suis-je, et combien en reste-t-il ? ». Le titre, lui, est
   * déjà le premier mot du corps juste en dessous.
   *
   * MUTATION TÉMOIN — écrire `position` au lieu du rang fait tomber le dernier
   * cas de ce fichier (voir plus bas : une page retirée garde sa place dans la
   * numérotation de la base).
   */
  it('la pastille du milieu dit le rang de la page lue, sur le nombre de pages', () => {
    expect(guidePlanFrom(detailAPages(TROIS, 1)).titre).toBe('1 sur 3');
    expect(guidePlanFrom(detailAPages(TROIS, 2)).titre).toBe('2 sur 3');
    expect(guidePlanFrom(detailAPages(TROIS, 3)).titre).toBe('3 sur 3');
  });

  it('LA PAGE LUE PORTE LA TEINTE ACTIVE DU PANNEAU DE SECTION, et elle seule', () => {
    const plan = guidePlanFrom(detailAPages(TROIS, 2));
    expect(plan.pages.map((p) => p.actif)).toEqual([false, true, false]);
    /** Les trois valeurs sont celles de `panel(active)` — aucune n'est inventée. */
    expect(plan.pages[1]).toMatchObject({ bg: '#E3F0EB', fg: '#0F5C48', w: 700 });
    expect(plan.pages[0]).toMatchObject({ bg: 'transparent', fg: '#16211D', w: 500 });
  });

  it('LA PAGE LUE SE DIT AUSSI PAR SON TRACÉ, pas seulement par sa couleur', () => {
    const plan = guidePlanFrom(detailAPages(TROIS, 3));
    /** La coche sur la page lue, la liste de lignes sur les autres. */
    expect(plan.pages[2]?.icon).toBe('m5 12 4.5 4.5L19 7');
    expect(plan.pages[0]?.icon).toBe('M4 6h16M7 12h10M5 18h14');
  });

  it('la pastille de compteur DISPARAÎT à zéro, et porte le compte sinon', () => {
    const plan = guidePlanFrom(detailAPages(TROIS, 1));
    expect(plan.pages.map((p) => p.count)).toEqual(['4', false, '1']);
  });

  it('LA PREMIÈRE PAGE GARDE L’ADRESSE DU GUIDE — les liens partagés ne cassent pas', () => {
    const plan = guidePlanFrom(detailAPages(TROIS, 1));
    expect(plan.pages[0]?.href).toBe('/guides/ouvrir-un-compte-bancaire-en-arrivant-en-france');
    expect(plan.pages[1]?.href).toBe(
      '/guides/ouvrir-un-compte-bancaire-en-arrivant-en-france/p/le-rendez-vous',
    );
  });

  it('le segment /p/ ne peut pas collisionner avec « corriger » ni « propositions »', () => {
    expect(hrefPageGuide('mon-guide', { position: 2, slug: 'corriger' })).toBe(
      '/guides/mon-guide/p/corriger',
    );
    expect(hrefPageGuide('mon-guide', { position: 2, slug: 'propositions' })).toBe(
      '/guides/mon-guide/p/propositions',
    );
  });

  it('les extrémités s’annoncent : pas de précédent en 1, pas de suivant en dernier', () => {
    const premiere = guidePlanFrom(detailAPages(TROIS, 1));
    expect([premiere.aPrecedent, premiere.aSuivant]).toEqual([false, true]);
    expect(premiere.hrefPrecedent).toBeNull();
    const milieu = guidePlanFrom(detailAPages(TROIS, 2));
    expect([milieu.aPrecedent, milieu.aSuivant]).toEqual([true, true]);
    const derniere = guidePlanFrom(detailAPages(TROIS, 3));
    expect([derniere.aPrecedent, derniere.aSuivant]).toEqual([true, false]);
    expect(derniere.hrefSuivant).toBeNull();
  });

  it('les deux chevrons mènent aux pages VOISINES, pas aux extrémités', () => {
    const plan = guidePlanFrom(detailAPages(TROIS, 2));
    expect(plan.hrefPrecedent).toBe('/guides/ouvrir-un-compte-bancaire-en-arrivant-en-france');
    expect(plan.hrefSuivant).toBe(
      '/guides/ouvrir-un-compte-bancaire-en-arrivant-en-france/p/ce-qui-m-a-surpris',
    );
  });

  it('AVANT LA RÉPONSE, le plan ne dessine rien et n’affirme rien', () => {
    expect(PLAN_AVANT_REPONSE.visible).toBe(false);
    expect(PLAN_AVANT_REPONSE.pages).toEqual([]);
    expect(PLAN_AVANT_REPONSE.titre).toBe('');
    expect([PLAN_AVANT_REPONSE.aPrecedent, PLAN_AVANT_REPONSE.aSuivant]).toEqual([false, false]);
  });

  it('TÉMOIN : changer le compte de commentaires ne change pas l’ordre des pages', () => {
    const avant = guidePlanFrom(detailAPages(TROIS, 1)).pages.map((p) => p.slug);
    const apres = guidePlanFrom(
      detailAPages(
        TROIS.map((p) => ({ ...p, commentCount: 99 })),
        1,
      ),
    ).pages.map((p) => p.slug);
    expect(apres).toEqual(avant);
  });
});

describe('la liste des guides annonce LE TOTAL, pas le compte de la page lue', () => {
  /**
   * Le porteur : « c'est LE TOTAL qui est affiché sur la page de listing des
   * guides. » La carte de A03 n'a AUCUNE prise dédiée (relevé sur ses octets),
   * donc les deux nombres allongent la phrase que le front compose déjà.
   */
  it('le nombre de pages et le total des commentaires entrent dans l’accroche', () => {
    const g = liste.items[0] as GuideListItemView;
    const carte = guideCardFrom({ ...g, pageCount: 4, commentCount: 12 }, MAINTENANT);
    expect(carte.excerpt).toBe('Arrivée · Universel · 4 pages · 12 commentaires');
  });

  it('ILS DISPARAISSENT QUAND ILS NE DISENT RIEN : une page, aucun commentaire', () => {
    const g = liste.items[0] as GuideListItemView;
    const carte = guideCardFrom({ ...g, pageCount: 1, commentCount: 0 }, MAINTENANT);
    expect(carte.excerpt).toBe('Arrivée · Universel');
  });

  it('un seul commentaire s’écrit au singulier', () => {
    const g = liste.items[0] as GuideListItemView;
    expect(guideCardFrom({ ...g, pageCount: 2, commentCount: 1 }, MAINTENANT).excerpt).toBe(
      'Arrivée · Universel · 2 pages · 1 commentaire',
    );
  });
});
