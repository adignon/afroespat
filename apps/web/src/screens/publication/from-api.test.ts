import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { commentsResponseSchema, postDetailResponseSchema } from '@app/shared';
import type { CommentRow, CommentThread } from '@app/shared';
import { commentairesA02From, relGuidesDe } from './from-api';

/**
 * LE FIL DE RÉPONSES DE A02, ÉPROUVÉ SUR DES CHARGES RÉELLES.
 *
 * Les fixtures sont celles de `packages/shared/src/__tests__/fixtures/` — des
 * réponses relevées OCTET POUR OCTET sur une API qui tournait — et elles sont
 * PARSÉES par le schéma partagé avant d'entrer dans le convertisseur. L'ordre
 * compte : c'est ce qui fait que ce fichier éprouve la chaîne complète (charge
 * réelle → schéma partagé → prises du cadre) plutôt que le convertisseur seul
 * contre un objet façonné à sa mesure.
 */

const FIXTURES = resolve(
  import.meta.dirname,
  '../../../../../packages/shared/src/__tests__/fixtures',
);

const charge = (nom: string): unknown =>
  JSON.parse(readFileSync(resolve(FIXTURES, `${nom}.json`), 'utf8'));

const detail = postDetailResponseSchema.parse(charge('post_detail'));
const fil = commentsResponseSchema.parse(charge('comments'));

/**
 * LES LIGNES LISIBLES D'UN FIL, séparées des emplacements retirés.
 *
 * `GET /comments` rend une UNION depuis que la colonne « ÉTATS » de A01C est
 * montée : un commentaire, ou `{ removed: true }`. Les charges de
 * `packages/shared/src/__tests__/fixtures/` n'en portent aucun — relevé, zéro
 * occurrence de `"removed"` — donc ces deux fonctions ne retirent rien
 * aujourd'hui. Elles sont là pour que `tsc` cesse de supposer : un emplacement
 * n'a NI `replies`, NI `relativeTime`, NI `canEdit`, et un cas qui les lirait sur
 * lui mentirait sur ce que le serveur sert.
 */
const racinesLisibles = (
  items: readonly CommentRow[],
): readonly CommentThread[] => items.filter((r): r is CommentThread => !('removed' in r));

const reponsesLisibles = (
  racine: CommentThread,
): readonly Exclude<CommentThread['replies'][number], { removed: true }>[] =>
  racine.replies.filter(
    (r): r is Exclude<CommentThread['replies'][number], { removed: true }> =>
      !('removed' in r),
  );

describe('les commentaires d’une publication, convertis pour A02', () => {
  const lignes = commentairesA02From(fil.items);

  it('la fixture porte une racine ET une réponse — sinon tout ce qui suit est creux', () => {
    const racines = racinesLisibles(fil.items).length;
    const reponses = racinesLisibles(fil.items).reduce(
      (n, r) => n + reponsesLisibles(r).length,
      0,
    );
    expect(racines).toBeGreaterThanOrEqual(1);
    expect(reponses).toBeGreaterThanOrEqual(1);
    expect(lignes.length).toBe(racines + reponses);
  });

  /**
   * §2.5 N'AUTORISE QU'UNE SEULE PROFONDEUR, et le cadre la dessine par un
   * DÉCALAGE, pas par un arbre. Les deux valeurs — 48 px, 34 px sur mobile — sont
   * celles de la maquette de A02, et elles ne sont pas celles de A01C (50 et 44).
   * Les confondre ferait glisser les réponses de deux pixels sur l'un des deux
   * écrans, et personne ne saurait lequel est juste.
   */
  it('une réponse est décalée, une racine ne l’est pas — et jamais un troisième niveau', () => {
    const racines = lignes.filter((l) => l.indent === '0px');
    const reponses = lignes.filter((l) => l.indent !== '0px');
    expect(racines.length).toBe(fil.items.length);
    for (const r of reponses) {
      expect(r.indent).toBe('48px');
      expect(r.indentM).toBe('34px');
    }
    // Deux décalages possibles, jamais trois : le troisième niveau n'existe pas.
    expect(new Set(lignes.map((l) => l.indent))).toEqual(new Set(['0px', '48px']));
  });

  /**
   * `canReply` SUIT LA PROFONDEUR, PAS UN DROIT. On répond à une racine, jamais à
   * une réponse — le service répond `DEPTH_EXCEEDED` (mesuré 422). Proposer
   * « Répondre » sous une réponse offrirait une action qui échoue toujours.
   */
  it('on ne propose de répondre qu’aux racines', () => {
    for (const l of lignes) expect(l.canReply).toBe(l.indent === '0px');
  });

  /**
   * L'HORODATAGE VIENT DU SERVEUR. « il y a 2 h » est composé côté API
   * (`relativeTime`) ; le recalculer ici l'exposerait à l'horloge du navigateur, et
   * un poste décalé afficherait « dans 3 h » sur un commentaire d'hier.
   */
  it('l’heure affichée est celle que le serveur compose, jamais une horloge locale', () => {
    const attendus = racinesLisibles(fil.items).flatMap((r) => [
      r.relativeTime,
      ...reponsesLisibles(r).map((x) => x.relativeTime),
    ]);
    expect(lignes.map((l) => l.time)).toEqual(attendus);
  });

  /**
   * LA CARTE « GUIDE » EST MORTE DANS LA MAQUETTE ELLE-MÊME — son balisage la
   * dessine sous un `sc-if`, son `renderVals()` ne pose jamais le champ — et l'API
   * n'a aucun champ pour la remplir. Elle arrive donc `null` : une carte affichée
   * serait une affirmation sur le commentaire, et le clic ne mènerait nulle part.
   */
  it('aucune carte de guide n’est fabriquée sous un commentaire', () => {
    for (const l of lignes) expect(l.guide).toBeNull();
  });

  /**
   * AUCUN COMPTEUR DE « J'AIME » NE S'INVENTE. Aucune réaction de commentaire
   * n'existe, ni en base ni dans aucune réponse. `commentThreadSchema` étant
   * `.strict()`, un champ ajouté serait refusé à la frontière ; ici on vérifie que
   * le convertisseur n'en fabrique pas un de son côté.
   */
  it('le convertisseur ne pose aucun compteur que l’API ne donne pas', () => {
    for (const l of lignes) {
      expect(Object.keys(l)).not.toContain('likes');
      expect(Object.keys(l)).not.toContain('likeFg');
    }
  });

  /**
   * §2.5 : la modification est ouverte QUINZE MINUTES, et c'est le SERVEUR qui
   * tranche. Le front ne recalcule pas l'écart entre `createdAt` et maintenant —
   * il recopie `canEdit`.
   */
  it('le droit de modifier est celui du serveur, jamais un calcul d’ici', () => {
    const attendus = racinesLisibles(fil.items).flatMap((r) => [
      r.canEdit,
      ...reponsesLisibles(r).map((x) => x.canEdit),
    ]);
    expect(lignes.map((l) => l.canEdit)).toEqual(attendus);
  });
});

describe('`GET /posts/:id` sert déjà le fil, et A02 s’en sert', () => {
  it('le détail porte la publication ET ses premiers commentaires', () => {
    expect(detail.post.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Array.isArray(detail.comments.items)).toBe(true);
  });

  it('les commentaires du détail se convertissent par le même chemin', () => {
    const lignes = commentairesA02From(detail.comments.items);
    const racines = racinesLisibles(detail.comments.items);
    expect(lignes.length).toBe(
      racines.length + racines.reduce((n, r) => n + reponsesLisibles(r).length, 0),
    );
  });
});

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ CE BLOC GARDAIT UN MANQUE — IL GARDE MAINTENANT CE QUI LE COMBLE         ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Il affirmait deux choses, et les deux étaient vraies : les guides rattachés
 * arrivaient vides, et la réponse de détail n'en portait aucun. Le porteur a
 * demandé que cela cesse — `post_guides` existe, `createPostSchema` accepte
 * `guideIds`, et `postCardSchema` rend `guides`.
 *
 * LE CAS EST DONC RETOURNÉ, pas supprimé : il mesure maintenant que la réponse
 * PORTE le champ, et que le convertisseur en fait des rattachements. Supprimer un
 * cas qui garde un manque comblé, c'est perdre la trace du jour où il l'a été.
 */
describe('les guides rattachés à une publication', () => {
  it('la réponse de détail porte maintenant le champ', () => {
    expect(Object.keys(detail.post)).toContain('guides');
    expect(Array.isArray(detail.post.guides)).toBe(true);
  });

  it('chaque guide lié devient un rattachement nommé, choisi par l’auteur', () => {
    const lignes = relGuidesDe([{ title: 'Visale sans CDI', slug: 'visale-sans-cdi' }]);
    expect(lignes).toHaveLength(1);
    expect(lignes[0]?.t).toBe('Visale sans CDI');
    /** Choisi dans la fenêtre par l'auteur — jamais suggéré automatiquement. */
    expect(lignes[0]?.auto).toBe(false);
  });

  /**
   * ⚠ LE VOTE SUR UN RATTACHEMENT N'A TOUJOURS AUCUNE SOURCE, et ce cas garde CE
   * manque-là : `guide_votes` porte un vote sur LE GUIDE, pas sur son
   * rattachement, et aucune réponse ne rend « ce rattachement a été jugé utile N
   * fois ». Les deux boutons restent au repos et ne retiennent rien.
   */
  it('mais le vote sur le rattachement n’en a aucune, et ne prétend pas en avoir', () => {
    const ligne = relGuidesDe([{ title: 'Visale sans CDI', slug: 'visale-sans-cdi' }])[0];
    expect(ligne?.voted).toBe(false);
    expect(ligne?.upBg).toBe('#F2F5F4');
    expect(ligne?.downBg).toBe('#F2F5F4');
  });
});
