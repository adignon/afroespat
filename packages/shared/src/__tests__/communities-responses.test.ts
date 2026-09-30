import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  albumsResponseSchema,
  announcementsResponseSchema,
  communitiesResponseSchema,
  communityDetailResponseSchema,
  communityFeedResponseSchema,
  communityMapResponseSchema,
  communityMembersResponseSchema,
  inviteMembersResponseSchema,
  pollDetailResponseSchema,
  pollSchema,
  pollsResponseSchema,
  topicDetailResponseSchema,
  topicsResponseSchema,
} from '../validation/communities.js';

/**
 * LES SCHÉMAS DE RÉPONSE DES RÉSEAUX, ÉPROUVÉS CONTRE LES CHARGES RÉELLES.
 *
 * ── D'OÙ VIENNENT LES FIXTURES ──────────────────────────────────────────────
 *
 * `fixtures/community_*.json` et `topic_*.json` n'ont pas été RÉDIGÉS. Chacun est
 * la réponse OCTET POUR OCTET d'une route appelée sur l'API qui tourne, sur une
 * base réelle : un réseau `PUBLIC` créé, un sujet ouvert puis ÉPINGLÉ, une
 * annonce, un sondage, un album, une publication — puis les MÊMES routes
 * rappelées par un compte qui n'a pas rejoint ce réseau.
 *
 * La différence compte. Un schéma écrit d'après le service décrit ce que le code
 * a l'air de faire ; un schéma écrit d'après la charge décrit ce que l'API
 * ENVOIE. Les deux ont divergé trois fois ici, et les trois sont figées plus bas :
 * `communityId` présent sur le sondage détaillé et absent du même sondage en
 * liste, `map` sans `nextCursor`, et le sujet épinglé présent DANS `items` autant
 * que dans `meta.pinned`.
 *
 * ── CE QUE CE FICHIER GARDE VRAIMENT ───────────────────────────────────────
 *
 * La règle la plus grave du module : LE CONTENU D'UN RÉSEAU PUBLIC N'EST PAS
 * RENVOYÉ À UN NON-MEMBRE, MÊME QUAND L'EN-TÊTE L'EST. Le back la tient et la
 * fige déjà dans `communities.int.test.ts`. Ce que CE fichier fige, c'est la
 * FORME de cette différence — ce que la frontière du front laisse passer — parce
 * que c'est là que la garde pourrait être défaite sans que le back bouge d'une
 * ligne : il suffirait d'un schéma qui accepte un `pinned` non vide chez un
 * passant sans que rien ne le signale.
 *
 * ── LES TÉMOINS ─────────────────────────────────────────────────────────────
 *
 * Le dernier bloc mute des endroits qui ne DÉCIDENT de rien et exige que la
 * validation reste VERTE. Sans eux, un schéma accidentellement trop strict
 * passerait pour un schéma qui garde bien : tout rougirait, y compris ce qui doit
 * passer, et on appellerait ça de la rigueur.
 */

const FIXTURES = resolve(import.meta.dirname, 'fixtures');

type Noeud = Record<string, unknown>;
const obj = (v: unknown): Noeud => v as Noeud;
const tab = (v: unknown): unknown[] => v as unknown[];

function charge(nom: string): Noeud {
  return JSON.parse(readFileSync(resolve(FIXTURES, `${nom}.json`), 'utf8')) as Noeud;
}

const copie = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

// ─── 1. Les schémas acceptent la charge réelle ──────────────────────────────

describe('les schémas acceptent ce que l’API des réseaux renvoie vraiment', () => {
  const cas = [
    ['GET /communities', communitiesResponseSchema, 'communities_list'],
    ['GET /communities/:slug (membre)', communityDetailResponseSchema, 'community_detail_membre'],
    [
      'GET /communities/:slug (non-membre)',
      communityDetailResponseSchema,
      'community_detail_nonmembre',
    ],
    ['GET /communities/:id/topics', topicsResponseSchema, 'community_topics'],
    ['GET /topics/:id', topicDetailResponseSchema, 'topic_detail'],
    ['GET /communities/:id/members', communityMembersResponseSchema, 'community_members'],
    ['GET /communities/:id/feed', communityFeedResponseSchema, 'community_feed'],
    [
      'GET /communities/:id/announcements',
      announcementsResponseSchema,
      'community_announcements',
    ],
    ['GET /communities/:id/polls', pollsResponseSchema, 'community_polls'],
    ['POST /polls/:id/vote', pollDetailResponseSchema, 'poll_vote'],
    ['GET /communities/:id/albums', albumsResponseSchema, 'community_albums'],
    ['GET /communities/:id/map', communityMapResponseSchema, 'community_map'],
    ['POST /communities/:id/invite', inviteMembersResponseSchema, 'community_invite'],
  ] as const;

  for (const [route, schema, fixture] of cas) {
    it(`${route} — la charge réelle passe`, () => {
      const r = schema.safeParse(charge(fixture));
      // Le message nomme le CHAMP fautif : un « invalid_type » nu ferait relire
      // trois cents lignes de schéma pour trouver lequel.
      const echecs = r.success
        ? []
        : r.error.issues.map((i) => `${i.path.join('.')} → ${i.message}`);
      expect(echecs).toEqual([]);
    });
  }

  /**
   * NON-VACUITÉ. Un fichier réduit à `{ "items": [], "nextCursor": null }`
   * passerait plusieurs schémas ci-dessus sans rien prouver — et surtout, les
   * assertions de masquage plus bas deviendraient creuses : un `pinned` vide chez
   * le non-membre ne dirait rien si le membre l'avait vide lui aussi.
   */
  it('les fixtures portent du contenu, sinon elles ne prouvent rien', () => {
    const sujets = topicsResponseSchema.parse(charge('community_topics'));
    expect(sujets.items.length).toBeGreaterThan(0);
    expect(sujets.meta.pinned.length).toBeGreaterThan(0);

    const membre = communityDetailResponseSchema.parse(charge('community_detail_membre'));
    expect(membre.pinned.length).toBeGreaterThan(0);
    // ET LE SUJET ÉPINGLÉ PORTE SON TITRE. C'est CE titre que la garde protège ;
    // si `pinned` ne portait qu'un identifiant, la fuite n'aurait pas d'objet.
    expect(membre.pinned[0]?.title.length).toBeGreaterThan(0);
    expect(membre.pinned[0]?.pinKind).not.toBe('NONE');

    const sondages = pollsResponseSchema.parse(charge('community_polls'));
    expect(sondages.items.length).toBeGreaterThan(0);
  });
});

// ─── 2. LA RÈGLE : le réseau PUBLIC vu par un non-membre ────────────────────

describe('règle dure — le contenu d’un réseau PUBLIC ne sort pas à un non-membre', () => {
  /**
   * LES DEUX CHARGES SONT LE MÊME RÉSEAU, À LA MÊME SECONDE.
   *
   * `community_detail_membre` et `community_detail_nonmembre` ont le même `id`,
   * le même `name`, le même `createdAt` : seule l'identité du lecteur diffère.
   * Sans cela, la comparaison ne prouverait rien — deux réseaux différents
   * peuvent parfaitement avoir l'un un épinglé et l'autre pas.
   */
  it('les deux fixtures décrivent bien LE MÊME réseau', () => {
    const membre = communityDetailResponseSchema.parse(charge('community_detail_membre'));
    const passant = communityDetailResponseSchema.parse(charge('community_detail_nonmembre'));
    expect(passant.id).toBe(membre.id);
    expect(passant.createdAt).toBe(membre.createdAt);
    expect(passant.visibility).toBe('PUBLIC');
  });

  it('l’en-tête PASSE — un réseau public se découvre, sinon on ne pourrait pas le rejoindre', () => {
    const passant = communityDetailResponseSchema.parse(charge('community_detail_nonmembre'));
    expect(passant.name.length).toBeGreaterThan(0);
    expect(passant.canJoin).toBe(true);
    expect(passant.myRole).toBeNull();
    expect(passant.myStatus).toBeNull();
  });

  it('… mais AUCUN TITRE de sujet épinglé ne franchit l’en-tête', () => {
    const membre = communityDetailResponseSchema.parse(charge('community_detail_membre'));
    const passant = communityDetailResponseSchema.parse(charge('community_detail_nonmembre'));

    // Le membre voit un épinglé AVEC son titre …
    const titre = membre.pinned[0]?.title;
    expect(titre).toBeTruthy();

    // … et le passant n'en voit aucun. C'est l'assertion centrale du fichier :
    // sans le masquage du service, `pinned` porterait carrément des TITRES de
    // sujets à quelqu'un qui n'a pas rejoint le réseau.
    expect(passant.pinned).toEqual([]);
    expect(JSON.stringify(passant)).not.toContain(titre as string);
  });

  it('les COMPTEURS de l’en-tête sont masqués, et pas seulement les listes', () => {
    const membre = communityDetailResponseSchema.parse(charge('community_detail_membre'));
    const passant = communityDetailResponseSchema.parse(charge('community_detail_nonmembre'));

    // Un `counters.topics` à 1 dirait déjà à un passant qu'il se dit quelque
    // chose ici — c'est une fuite plus discrète qu'un titre, et tout aussi réelle.
    expect(membre.counters.topics).toBeGreaterThan(0);
    expect(passant.counters.topics).toBe(0);
    expect(membre.counters.announcements).toBeGreaterThan(0);
    expect(passant.counters.announcements).toBe(0);

    // `members`, lui, PASSE : c'est de l'information de découverte, et la
    // maquette l'affiche sur les cartes de « Découvrir ».
    expect(passant.counters.members).toBe(membre.counters.members);
  });

  it('le CONTENU est refusé par un 403 NOT_A_MEMBER, et non par une liste vide', () => {
    /**
     * LA DISTINCTION QUE TOUT LE MODULE REPOSE DESSUS.
     *
     * Un refus n'est pas une absence. Si la route rendait `{ items: [] }` avec un
     * 200, le front afficherait « aucun sujet » et apprendrait au lecteur que le
     * réseau est mort alors qu'il est seulement fermé. Le code de refus est donc
     * une donnée d'affichage, pas un détail de transport — et il est figé ici.
     */
    const refus = charge('community_topics_refus');
    const err = obj(refus['error']);
    expect(err['code']).toBe('FORBIDDEN');
    expect(obj(err['details'])['reason']).toBe('NOT_A_MEMBER');
    // Et surtout : la charge de refus ne porte AUCUN `items`.
    expect(refus['items']).toBeUndefined();
  });

  it('la PORTE DE DERRIÈRE — le sujet par son identifiant propre — est gardée aussi', () => {
    /**
     * `GET /topics/:id` n'a pas l'air d'une lecture de réseau : elle ne contient
     * pas le mot `communities` dans son chemin. C'est exactement pour cela qu'on
     * oublie de la garder, et c'est le chemin qu'une fuite emprunterait.
     */
    const err = obj(charge('topic_refus')['error']);
    expect(err['code']).toBe('FORBIDDEN');
    expect(obj(err['details'])['reason']).toBe('NOT_A_MEMBER');

    // NON-VACUITÉ : le sujet EXISTE et porte un titre pour qui a le droit.
    const vu = topicDetailResponseSchema.parse(charge('topic_detail'));
    expect(vu.title.length).toBeGreaterThan(0);
    expect(vu.body.length).toBeGreaterThan(0);
  });
});

// ─── 3. `.strict()` refuse ce qu'aucune règle n'autorise ────────────────────

describe('`.strict()` refuse à la frontière ce que les règles dures interdisent', () => {
  /**
   * Ce bloc est le seul endroit où l'on peut tenir `00` §49 — aucun compteur de
   * vues sur aucun contenu — pour TOUS les écrans à la fois. Un schéma permissif
   * accepterait `viewCount` en silence le jour où une requête mal écrite
   * l'ajoute, et le compteur se retrouverait à l'écran sans que personne ne
   * l'ait décidé.
   */
  const greffes = [
    ['un compteur de vues sur un sujet', 'topic_detail', topicDetailResponseSchema, (d: Noeud) => {
      d['viewCount'] = 412;
    }],
    ['un compteur de vues sur une ligne de sujet', 'community_topics', topicsResponseSchema, (d: Noeud) => {
      obj(tab(d['items'])[0])['viewCount'] = 412;
    }],
    ['un téléphone sur un membre', 'community_members', communityMembersResponseSchema, (d: Noeud) => {
      obj(tab(d['items'])[0])['phone'] = '+33600000000';
    }],
    ['un champ inconnu sur l’en-tête', 'community_detail_membre', communityDetailResponseSchema, (d: Noeud) => {
      d['secret'] = 'x';
    }],
    ['un champ inconnu sur un épinglé', 'community_detail_membre', communityDetailResponseSchema, (d: Noeud) => {
      obj(tab(d['pinned'])[0])['authorHandle'] = 'quelqu-un';
    }],
  ] as const;

  for (const [quoi, fixture, schema, muter] of greffes) {
    it(`refuse ${quoi}`, () => {
      const d = copie(charge(fixture));
      muter(d);
      expect(schema.safeParse(d).success).toBe(false);
    });
  }

  /**
   * L'ÉCART DU SONDAGE, FIGÉ.
   *
   * Le même sondage n'a pas la même forme en liste et seul : `POST
   * /polls/:id/vote` ajoute `communityId`. C'est `.strict()` qui l'a rendu
   * visible — sans lui, employer le schéma de liste sur la réponse d'un vote
   * aurait « marché », en ignorant un champ, jusqu'au jour où l'on aurait compté
   * dessus.
   */
  it('le sondage DÉTAILLÉ ne se lit pas avec le schéma de LISTE', () => {
    expect(pollSchema.safeParse(charge('poll_vote')).success).toBe(false);
    expect(pollDetailResponseSchema.safeParse(charge('poll_vote')).success).toBe(true);
  });

  /**
   * LES RÉSULTATS CACHÉS SONT `null`, PAS ZÉRO.
   *
   * « Résultats visibles après vote ou clôture » : le service RETIRE les
   * compteurs plutôt que de demander au front de ne pas les afficher — les
   * laisser dans la réponse HTTP reviendrait à les publier. Le schéma doit donc
   * accepter `null`, et le front ne doit jamais écrire `?? 0`.
   */
  it('un sondage non voté porte des compteurs à `null`, jamais à 0', () => {
    const p = pollsResponseSchema.parse(charge('community_polls')).items[0];
    expect(p?.resultsVisible).toBe(false);
    expect(p?.totalVotes).toBeNull();
    expect(p?.options.every((o) => o.voteCount === null)).toBe(true);

    // Après le vote, ils apparaissent — sinon l'assertion du dessus serait vraie
    // d'un schéma qui refuserait tout nombre.
    const vote = pollDetailResponseSchema.parse(charge('poll_vote'));
    expect(vote.resultsVisible).toBe(true);
    expect(vote.totalVotes).toBeGreaterThan(0);
  });

  /**
   * `map` N'EST PAS UNE PAGE. Elle ne porte pas `nextCursor`, pas même à `null`.
   * L'avoir traitée comme une page aurait échoué à la première lecture.
   */
  it('la carte des membres n’est pas une page paginée', () => {
    const d = communityMapResponseSchema.parse(charge('community_map'));
    expect('nextCursor' in d).toBe(false);
    expect(d.items.length).toBeGreaterThan(0);
  });
});

// ─── 4. Les refus qui font un ÉCRAN, pas un message ─────────────────────────

describe('les refus portent de quoi composer l’écran, et non un texte à afficher tel quel', () => {
  it('`LEVEL_REQUIRED` porte l’INVITATION de §7.3, pas une erreur sèche', () => {
    const err = obj(charge('community_create_refus_niveau')['error']);
    expect(err['code']).toBe('LEVEL_REQUIRED');
    const d = obj(err['details']);
    // Les trois champs que §7.3 exige pour écrire l'invitation. Sans eux, le
    // front ne pourrait qu'afficher « accès refusé », ce que §7.3 interdit.
    expect(d['requiredLevel']).toBe('L1');
    expect(d['currentLevel']).toBe('L0');
    expect(typeof d['labelFr']).toBe('string');
  });

  it('la règle des cinq invitations refuse par le CHAMP, pas par une phrase', () => {
    const err = obj(charge('community_create_refus_invites')['error']);
    expect(err['code']).toBe('VALIDATION_FAILED');
    const champs = tab(obj(err['details'])['fields']);
    expect(obj(champs[0])['path']).toBe('inviteHandles');
  });
});

// ─── 5. LES TÉMOINS — muter ce qui ne décide rien doit rester VERT ──────────

describe('témoins — un schéma trop strict n’est pas un schéma qui garde bien', () => {
  /**
   * Ces mutations changent des valeurs qui ne portent AUCUNE règle : un titre,
   * un nom, un nombre de réponses. La validation doit rester verte.
   *
   * Sans ce bloc, un schéma qui refuserait tout — y compris les charges
   * légitimes — passerait pour rigoureux : toutes les assertions de refus
   * seraient vertes, et personne ne verrait que plus rien ne passe.
   */
  const temoins = [
    ['le titre d’un sujet', 'topic_detail', topicDetailResponseSchema, (d: Noeud) => {
      d['title'] = 'Un tout autre titre, parfaitement valide';
    }],
    ['le nombre de réponses', 'topic_detail', topicDetailResponseSchema, (d: Noeud) => {
      d['replyCount'] = 9999;
    }],
    ['le nom du réseau', 'community_detail_membre', communityDetailResponseSchema, (d: Noeud) => {
      d['name'] = 'Un autre nom';
    }],
    ['la description, mise à null', 'community_detail_membre', communityDetailResponseSchema, (d: Noeud) => {
      d['description'] = null;
    }],
    ['le libellé d’une option de sondage', 'community_polls', pollsResponseSchema, (d: Noeud) => {
      obj(tab(obj(tab(d['items'])[0])['options'])[0])['label'] = 'Autre chose';
    }],
    ['la ville d’un membre, mise à null', 'community_members', communityMembersResponseSchema, (d: Noeud) => {
      obj(tab(d['items'])[0])['city'] = null;
    }],
  ] as const;

  for (const [quoi, fixture, schema, muter] of temoins) {
    it(`muter ${quoi} laisse la validation VERTE`, () => {
      const d = copie(charge(fixture));
      muter(d);
      const r = schema.safeParse(d);
      const echecs = r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
      expect(echecs).toEqual([]);
    });
  }
});
