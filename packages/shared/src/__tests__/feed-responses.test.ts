import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  commentMutationResponseSchema,
  commentsResponseSchema,
  feedResponseSchema,
  feedSidebarResponseSchema,
  myStoriesResponseSchema,
  postDetailResponseSchema,
  postReactionStateSchema,
  storyBandResponseSchema,
  storyDetailResponseSchema,
  storyVotesResponseSchema,
} from '../index.js';

/**
 * LES SCHÉMAS DE RÉPONSE DU FIL, ÉPROUVÉS SUR DES CHARGES RÉELLES.
 *
 * ── CE QUE SONT LES FIXTURES, ET POURQUOI ELLES NE SONT PAS ÉCRITES À LA MAIN ──
 *
 * `fixtures/*.json` n'a pas été rédigé : chaque fichier est la réponse OCTET POUR
 * OCTET d'une API qui tournait, sur la base de développement, membre L1 ouvert par
 * le vrai parcours OTP (`POST /auth/otp/request` puis `verify`), contenu publié par
 * les vraies routes (`POST /posts`, `POST /stories`, `POST /comments`).
 *
 * La distinction est tout l'intérêt du fichier. Une fixture écrite à la main décrit
 * ce que l'auteur du schéma CROYAIT que l'API renvoyait, et un schéma validé contre
 * elle ne prouve que la cohérence de l'auteur avec lui-même. Trois écarts que ce
 * lot a réellement trouvés ne pouvaient sortir que d'une charge vraie :
 *
 *   · `greetingHint` est ABSENT du JSON quand le membre n'a pas de ville — pas
 *     `null`. Un schéma `.nullable()` aurait refusé la charge de tout membre sans
 *     ville, et l'aurait refusée en la nommant « contrat cassé » ;
 *   · le `votes` de `GET /me/stories` n'a QUE QUATRE clés : le service écrase celui
 *     de la bulle après l'étalement, et les deux `kind` disparaissent ;
 *   · `sortKey` existe dans le code qui construit le bandeau mais est retiré avant
 *     l'envoi. Le lire dans le service et l'écrire dans le schéma aurait produit un
 *     champ requis qui n'arrive jamais.
 *
 * ── CE QUE CE FICHIER GARDE ─────────────────────────────────────────────────
 *
 * Deux choses, et la seconde est la seule qui rende la première utile :
 *
 *   1. les schémas ACCEPTENT ce que l'API renvoie vraiment — sans quoi chaque écran
 *      branché lèverait `ApiShapeError` sur une charge parfaitement valide ;
 *   2. les schémas REFUSENT une charge qui enfreint une règle dure — sans quoi ils
 *      ne garderaient rien et ce fichier serait décoratif.
 *
 * Le second bloc est écrit en MUTATIONS : on part de la charge réelle, on casse un
 * point précis, on exige le refus. Trois de ces mutations sont passées AU VERT la
 * première fois, et c'est ce qui a fait ajouter `.strict()` aux formes de contenu —
 * `viewCount: 412` greffé sur une story passait la validation sans un mot, alors
 * que `00` §49 et 04 §2.6 interdisent tout compteur de vues. Le test a donc changé
 * le code, ce qui est le seul ordre acceptable.
 *
 * ── LES TÉMOINS ──────────────────────────────────────────────────────────────
 *
 * Le dernier bloc mute des endroits qui ne DÉCIDENT de rien — un libellé, une ligne
 * de contexte — et exige que la validation reste VERTE. Sans eux, un schéma
 * accidentellement trop strict passerait pour un schéma qui garde bien : tout
 * rougirait, y compris ce qui doit passer, et on appellerait ça de la rigueur.
 */

const FIXTURES = resolve(import.meta.dirname, 'fixtures');

function charge(nom: string): Noeud {
  return JSON.parse(readFileSync(resolve(FIXTURES, `${nom}.json`), 'utf8')) as Noeud;
}

/** Copie profonde : une mutation ne doit pas contaminer le cas suivant. */
const copie = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/**
 * NAVIGATION MUTABLE DANS UNE CHARGE JSON, SANS `any`.
 *
 * Les mutations ci-dessous cassent des points précis d'une charge dont la forme
 * n'est, par construction, PAS celle qu'on attend — c'est tout leur objet. Il faut
 * donc écrire sans le typage nominal, et `any` serait la façon paresseuse de le
 * faire : il désactive la vérification partout où il se propage, y compris là où
 * on ne le voulait pas.
 *
 * Ces deux fonctions concentrent la conversion en DEUX endroits nommés. Le reste du
 * fichier reste vérifié, et un `obj(x).champ` dit franchement « ici je sors du
 * typage », ce qu'un `any` disséminé ne dit plus.
 */
type Noeud = Record<string, unknown>;
const obj = (v: unknown): Noeud => v as Noeud;
const tab = (v: unknown): unknown[] => v as unknown[];

/** Ce qu'une mutation reçoit : la charge, à casser. */
type Mutation = (d: Noeud) => void;

// ─── 1. Les schémas acceptent la charge réelle ────────────────────────────────

describe('les schémas de réponse acceptent ce que l’API renvoie vraiment', () => {
  const cas = [
    ['GET /feed', feedResponseSchema, 'feed'],
    ['GET /feed?type=QUESTION', feedResponseSchema, 'feed_question'],
    ['GET /feed/sidebar', feedSidebarResponseSchema, 'feed_sidebar'],
    ['GET /posts/:id', postDetailResponseSchema, 'post_detail'],
    ['POST /posts', postDetailResponseSchema, 'post_create'],
    ['GET /comments', commentsResponseSchema, 'comments'],
    ['GET /stories', storyBandResponseSchema, 'stories_band'],
    ['GET /stories/:id', storyDetailResponseSchema, 'story_detail'],
    ['POST /stories', storyDetailResponseSchema, 'story_create'],
    ['GET /me/stories', myStoriesResponseSchema, 'me_stories'],
    ['PUT /posts/:id/reaction', postReactionStateSchema, 'reaction_put'],
    ['POST /comments', commentMutationResponseSchema, 'comment_create'],
    ['PUT /stories/:id/reaction', storyVotesResponseSchema, 'story_vote_ok'],
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
   * NON-VACUITÉ DES FIXTURES.
   *
   * Un fichier réduit à `{}` passerait plusieurs des schémas ci-dessus sans rien
   * prouver, et la suite resterait verte. On exige donc que la charge du fil porte
   * vraiment des publications, et celle du bandeau vraiment des stories.
   */
  it('les fixtures portent du contenu, sinon elles ne prouvent rien', () => {
    const fil = feedResponseSchema.parse(charge('feed'));
    expect(fil.items.length).toBeGreaterThan(0);
    expect(fil.items.map((p) => p.type)).toContain('QUESTION');

    const bandeau = storyBandResponseSchema.parse(charge('stories_band'));
    expect(bandeau.items.length).toBeGreaterThan(0);
    expect(bandeau.items[0]?.stories.length).toBeGreaterThan(0);

    const fils = commentsResponseSchema.parse(charge('comments'));
    expect(fils.items.length).toBeGreaterThan(0);
  });
});

// ─── 2. Les règles dures, figées par mutation ────────────────────────────────

describe('les règles dures que le contrat de réponse doit refuser', () => {
  const mutations: readonly (readonly [
    string,
    { safeParse: (v: unknown) => { success: boolean } },
    string,
    Mutation,
  ])[] = [
    /**
     * §5.3 : « nextCursor null en fin de liste ». Un champ ABSENT n'est pas une fin
     * de liste, c'est une pagination muette — et le fil s'arrêterait sans raison
     * visible, ce qui est le pire des deux comportements possibles.
     */
    [
      'fil — `nextCursor` absent n’est pas une fin de liste',
      feedResponseSchema,
      'feed',
      (d) => {
        delete obj(d).nextCursor;
      },
    ],
    /** §2.4 : « Jusqu'à 4 images ». La cinquième est un défaut de produit. */
    [
      'fil — une 5e image sur une carte est refusée',
      feedResponseSchema,
      'feed',
      (d) => {
        obj(tab(obj(d).items)[0]).media = [1, 2, 3, 4, 5].map((p) => ({
          position: p,
          url: `/media/x${p}`,
        }));
      },
    ],
    /**
     * §2.4 : « Liens sortants rendus `rel="noopener nofollow ugc"` ». La consigne
     * vient du SERVEUR précisément pour ne pas vivre dans un composant qu'on oublie
     * de brancher ; l'accepter affaiblie reviendrait à la laisser se perdre en route.
     */
    [
      'fil — un `linkRel` affaibli est refusé',
      feedResponseSchema,
      'feed',
      (d) => {
        obj(tab(obj(d).items)[0]).linkRel = 'noopener';
      },
    ],
    /**
     * §2.4 : le composeur est ouvert ou grisé selon `canPost`. Sans lui, un écran
     * retomberait sur le niveau qu'il croit connaître — exactement la faute que
     * `lib/api/session.ts` interdit.
     */
    [
      'fil — `meta.canPost` disparu est refusé',
      feedResponseSchema,
      'feed',
      (d) => {
        delete obj(obj(d).meta).canPost;
      },
    ],
    /** §2.6 et `00` §49 : aucun compteur de vues, sur aucun contenu, jamais. */
    [
      'story — un compteur de vues est refusé',
      storyBandResponseSchema,
      'stories_band',
      (d) => {
        obj(tab(obj(tab(obj(d).items)[0]).stories)[0]).viewCount = 412;
      },
    ],
    [
      'publication — un compteur de vues est refusé',
      feedResponseSchema,
      'feed',
      (d) => {
        obj(tab(obj(d).items)[0]).viewCount = 87;
      },
    ],
    /** §2.6 : une story fait 280 caractères au plus. */
    [
      'story — 281 caractères sont refusés',
      storyBandResponseSchema,
      'stories_band',
      (d) => {
        obj(tab(obj(tab(obj(d).items)[0]).stories)[0]).body = 'x'.repeat(281);
      },
    ],
    /** §2.6 : `seen` est l'ANNEAU, un booléen — pas un compteur déguisé. */
    [
      'story — `seen` transformé en nombre est refusé',
      storyBandResponseSchema,
      'stories_band',
      (d) => {
        obj(tab(obj(tab(obj(d).items)[0]).stories)[0]).seen = 3;
      },
    ],
    /**
     * §2.5 : « non nul → pas de réponse à une réponse ». Le service répond
     * `DEPTH_EXCEEDED` (mesuré : 422). Un schéma qui accepterait un troisième
     * niveau dirait possible ce que l'API refuse.
     */
    [
      'commentaires — une réponse de réponse est refusée',
      commentsResponseSchema,
      'comments',
      (d) => {
        const racine = obj(tab(obj(d).items)[0]);
        tab(racine.replies)[0] = { ...obj(tab(racine.replies)[0]), replies: [] };
      },
    ],
    /** Le fil tronque à 400 caractères ; le détail doit porter le corps entier. */
    [
      'détail — un `body` manquant est refusé',
      postDetailResponseSchema,
      'post_detail',
      (d) => {
        delete obj(obj(d).post).body;
      },
    ],
    /** §2.7 : « trois prochains événements », « trois nouveaux arrivants ». */
    [
      'colonne droite — un 4e événement est refusé',
      feedSidebarResponseSchema,
      'feed_sidebar',
      (d) => {
        obj(d).cityEvents = [1, 2, 3, 4].map((i) => ({
          id: `01a0e1b0-0413-7000-b5cf-0e03a8ff5e1${i}`,
          title: `Événement ${i}`,
          type: 'PICNIC',
          startsAt: '2026-10-01T10:00:00.000Z',
          venueName: null,
          attendeeCount: 0,
        }));
      },
    ],
    /** `me/stories` n'a que quatre clés de `votes` : ce n'est pas l'autre forme. */
    [
      'me/stories — un `votes` à six clés est refusé',
      myStoriesResponseSchema,
      'me_stories',
      (d) => {
        const premier = tab(obj(d).items)[0];
        if (premier !== undefined) {
          obj(premier).votes = {
            positive: 0,
            positiveKind: 'USEFUL',
            positiveLabel: 'Utile',
            negative: 0,
            negativeKind: 'NOT_USEFUL',
            negativeLabel: 'Pas utile',
          };
        }
      },
    ],
    /** §2.1 : le vocabulaire de réaction est fermé. */
    [
      'réaction — un `kind` hors vocabulaire est refusé',
      postReactionStateSchema,
      'reaction_put',
      (d) => {
        obj(d).kind = 'HEART';
      },
    ],
    /** `01` §2.1 : le numéro ne sort jamais en clair de l'API. */
    [
      'auteur — un numéro de téléphone greffé sur l’auteur est refusé',
      feedResponseSchema,
      'feed',
      (d) => {
        obj(obj(tab(obj(d).items)[0]).author).phone = '+22961000000';
      },
    ],
  ];

  for (const [nom, schema, fixture, casse] of mutations) {
    it(nom, () => {
      const avant = copie(charge(fixture));
      // La charge INTACTE passe : sans cette ligne, un schéma cassé ferait rougir
      // la mutation pour la mauvaise raison et le test se croirait satisfait.
      expect(schema.safeParse(avant).success).toBe(true);

      const apres = copie(avant);
      casse(apres);
      expect(schema.safeParse(apres).success).toBe(false);
    });
  }
});

// ─── 3. Les témoins : ce qui ne décide de rien doit rester vert ──────────────

describe('témoins — muter une étiquette ne doit RIEN faire rougir', () => {
  /**
   * Ces trois mutations touchent des champs que le serveur COMPOSE librement : un
   * libellé de bouton, une ligne de contexte, un temps relatif. Aucune règle dure
   * n'en dépend, et le jour où l'un change de formulation, aucun test ne doit
   * s'y opposer.
   *
   * Leur rôle est de prouver que le bloc précédent ne rougit pas « par principe ».
   * Un schéma qui refuserait tout passerait les quinze mutations ci-dessus en
   * paraissant exemplaire ; ces trois-là le démasqueraient aussitôt.
   */
  const temoins: readonly (readonly [string, Mutation])[] = [
    [
      'le libellé du bouton de réaction',
      (d) => {
        obj(obj(tab(obj(d).items)[0]).reaction).actionLabel = 'Formulation différente';
      },
    ],
    [
      'la ligne de contexte composée par le serveur',
      (d) => {
        obj(tab(obj(d).items)[0]).context = {
          text: 'Ailleurs · hier',
          parts: ['Ailleurs', 'hier'],
        };
      },
    ],
    [
      'le mot du compteur',
      (d) => {
        obj(obj(tab(obj(d).items)[0]).counter).word = 'appréciations';
      },
    ],
  ];

  for (const [nom, muter] of temoins) {
    it(`${nom} — reste vert`, () => {
      const d = copie(charge('feed'));
      muter(d);
      const r = feedResponseSchema.safeParse(d);
      const echecs = r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
      expect(echecs).toEqual([]);
    });
  }
});

// ─── 4. Les refus du serveur, figés eux aussi ────────────────────────────────

describe('ce que le serveur a REFUSÉ, et qu’aucun écran ne doit contourner', () => {
  /**
   * Ces quatre fixtures ne sont pas des réponses de succès : ce sont les REFUS
   * qu'une API qui tournait a opposés à des requêtes délibérément fautives. Elles
   * sont conservées parce qu'un branchement décide sur `error.code`, jamais sur le
   * message (§5.2), et qu'un code qui change sans qu'on le voie ferait afficher une
   * phrase générique là où une invitation précise est due.
   */
  const refus = [
    ['un L0 ne peut pas publier', 'l0_post_refus', 403, 'LEVEL_REQUIRED'],
    ['pas de réponse à une réponse', 'comment_depth', 422, 'DEPTH_EXCEEDED'],
    ['une story avec lien ou numéro', 'story_lien_refus', 422, 'CONTENT_BLOCKED'],
    ['la 4e story du jour', 'story_limite_4', 429, 'STORY_LIMIT'],
    [
      'un vote hors du type de la story',
      'story_vote_mauvais_kind',
      422,
      'KIND_NOT_ALLOWED_FOR_TYPE',
    ],
  ] as const;

  for (const [nom, fixture, statut, code] of refus) {
    it(`${nom} → ${statut} ${code}`, () => {
      const r = charge(fixture) as { status: number; json: { error: { code: string } } };
      expect(r.status).toBe(statut);
      expect(r.json.error.code).toBe(code);
    });
  }

  /**
   * `LEVEL_REQUIRED` doit porter de quoi afficher l'INVITATION de §7.3, pas
   * seulement un refus sec. Si ces détails disparaissaient, l'écran n'aurait plus
   * que le choix entre un message générique et un niveau lu d'avance — et la
   * consigne du socle interdit le second.
   */
  it('le refus L0 porte de quoi afficher l’invitation à monter de niveau', () => {
    const r = charge('l0_post_refus') as {
      json: { error: { details?: Record<string, unknown> } };
    };
    const details = r.json.error.details ?? {};
    expect(Object.keys(details)).toContain('requiredLevel');
    expect(details['currentLevel']).toBe('L0');
  });
});
