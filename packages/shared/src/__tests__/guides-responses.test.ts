import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  guideDetailResponseSchema,
  guideListResponseSchema,
  guideProposalsResponseSchema,
  guideVersionsResponseSchema,
} from '../index.js';

/**
 * LES SCHÉMAS DE RÉPONSE DES GUIDES, ÉPROUVÉS SUR DES CHARGES RÉELLES.
 *
 * ── D'OÙ VIENNENT LES FIXTURES ──────────────────────────────────────────────
 *
 * `fixtures/guide*.json` n'a pas été rédigé : chaque fichier est la réponse OCTET
 * POUR OCTET des quatre lectures publiques de 05 §4, appelées sur l'API qui
 * tournait contre la base de développement. Les routes sont `@PublicRead()`, donc
 * la charge est celle d'un visiteur anonyme — ce qui explique `myVote: null` et
 * `myOutdatedFlag: null` dans le détail, et l'absence de toute proposition
 * `PENDING` dans la liste des propositions.
 *
 * La distinction compte. Une fixture écrite à la main décrit ce que l'auteur du
 * schéma CROYAIT que l'API renvoyait, et un schéma validé contre elle ne prouve
 * que la cohérence de l'auteur avec lui-même. Trois écarts n'ont pu sortir que
 * d'une charge vraie :
 *
 *   · `banners[].months` est ABSENT sur `COMMUNITY_MAINTAINED` — pas `null`.
 *     `bannersFor` pousse `{ kind }` sans la clé. Un `.nullable()` aurait refusé
 *     la charge de TOUT guide maintenu par la communauté, en la nommant
 *     « contrat cassé » ;
 *   · `freshnessScore` arrive `31` et `2.4` — un nombre JSON ordinaire — alors
 *     que la colonne est `numeric(10,4)`. Ni `"31.0000"`, ni une chaîne ;
 *   · la version courante de `GET /guides/:slug` porte SIX champs, celle que
 *     rendent les écritures de l'auteur (`byIdForAuthor`) n'en porte que QUATRE.
 *     Deux formes voisines pour deux routes voisines.
 *
 * ── CE QUE CE FICHIER GARDE ─────────────────────────────────────────────────
 *
 *   1. les schémas ACCEPTENT ce que l'API renvoie vraiment — sans quoi A03 à A06
 *      lèveraient `ApiShapeError` sur une charge parfaitement valide ;
 *   2. les schémas REFUSENT une charge qui enfreint une règle dure — sans quoi
 *      ils ne garderaient rien et ce fichier serait décoratif.
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

/** Copie profonde : une mutation ne doit pas contaminer le cas suivant. */
const copie = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Le premier guide de la liste, dans une copie mutable. */
const premierGuide = (d: Noeud): Noeud => obj(tab(d['items'])[0]);

// ─── 1. Les schémas acceptent la charge réelle ───────────────────────────────

describe('les schémas de réponse acceptent ce que l’API renvoie vraiment', () => {
  const cas = [
    ['GET /guides?tab=helpful', guideListResponseSchema, 'guides_list'],
    ['GET /guides/:slug', guideDetailResponseSchema, 'guide_detail'],
    ['GET /guides/:slug/versions', guideVersionsResponseSchema, 'guide_versions'],
    ['GET /guides/:id/proposals', guideProposalsResponseSchema, 'guide_proposals'],
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
   * Un fichier réduit à `{ items: [], nextCursor: null, meta: … }` passerait
   * plusieurs des schémas ci-dessus sans rien prouver, et tout le bloc de
   * mutations plus bas deviendrait vacant — on ne peut pas casser un champ d'un
   * élément qui n'existe pas.
   */
  it('les fixtures portent vraiment des guides, des versions et une proposition', () => {
    expect(tab(charge('guides_list')['items']).length).toBeGreaterThanOrEqual(2);
    expect(tab(charge('guide_versions')['items']).length).toBeGreaterThanOrEqual(1);
    expect(tab(charge('guide_proposals')['items']).length).toBeGreaterThanOrEqual(1);
  });

  /**
   * LA CHARGE PORTE BIEN LES DEUX FORMES DE BANDEAU.
   *
   * C'est ce qui rend le premier cas ci-dessus concluant : si aucun guide de la
   * fixture n'avait de bandeau, `months` facultatif contre `months` nullable
   * passeraient exactement pareil, et le piège relevé ne serait gardé par rien.
   */
  it('la charge porte un bandeau AVEC `months` et un bandeau SANS', () => {
    const bandeaux = tab(charge('guides_list')['items']).flatMap((g) =>
      tab(obj(g)['banners']).map(obj),
    );
    expect(bandeaux.some((b) => 'months' in b)).toBe(true);
    // ABSENTE, et non posée à `null` — c'est le point exact que `.optional()` tient.
    expect(bandeaux.some((b) => !('months' in b))).toBe(true);
    expect(bandeaux.every((b) => b['months'] !== null)).toBe(true);
  });
});

// ─── 2. Les schémas refusent ce que les règles dures interdisent ─────────────

describe('les règles dures sont tenues À LA FRONTIÈRE', () => {
  type Cas = readonly [string, { safeParse: (v: unknown) => { success: boolean } }, string, (d: Noeud) => void];

  const refus: readonly Cas[] = [
    /**
     * `commentCount` EST REQUIS sur le détail du guide, et ce cas existe pour que
     * sa disparition se voie.
     *
     * La carte affichait « COMMENTAIRES » sans nombre parce que la route ne le
     * rendait pas ; le front le lit maintenant à cet emplacement exact
     * (`guide.commentCount`). Le déplacer à la racine, ou le rendre facultatif,
     * ramènerait l'intitulé sans chiffre — et personne ne saurait dire si c'est
     * l'API ou l'écran qui l'a perdu.
     */
    [
      'un détail de guide sans compteur de commentaires',
      guideDetailResponseSchema,
      'guide_detail',
      (d) => {
        delete obj(d['guide'])['commentCount'];
      },
    ],
    /**
     * RÈGLE DURE 00 §49 — « aucun compteur de vues n'est exposé à personne, sur
     * aucun contenu ».
     *
     * C'est LA règle à tenir ici, et pas une précaution théorique : `guides.view_count`
     * EXISTE (05 §3), une tâche horaire le remplit depuis Redis, et le guide est le
     * seul contenu du produit à en porter un. Un `select` élargi d'une ligne dans
     * `LIST_INCLUDE` le ferait sortir. `.strict()` est ce qui le refuse.
     */
    [
      'un compteur de vues greffé sur une carte de liste',
      guideListResponseSchema,
      'guides_list',
      (d) => {
        premierGuide(d)['viewCount'] = 412;
      },
    ],
    [
      'un compteur de vues greffé sur le détail du guide',
      guideDetailResponseSchema,
      'guide_detail',
      (d) => {
        obj(d['guide'])['viewCount'] = 412;
      },
    ],

    /**
     * ╔══════════════════════════════════════════════════════════════════════╗
     * ║ LE PLAN DES PAGES EST REQUIS, ET LA PAGE LUE AVEC                    ║
     * ╚══════════════════════════════════════════════════════════════════════╝
     *
     * Décision du porteur : un guide peut avoir plusieurs pages, et les
     * commentaires portent sur UNE page. Le front a donc besoin de `currentPage`
     * pour savoir à quoi attacher le fil — sans elle, il devrait deviner
     * `pages[0]` et commenterait sous la première page même quand le lecteur en
     * lit une autre.
     *
     * Les rendre facultatifs les ferait oublier par une route un jour, et ce
     * jour-là l'écran poserait les commentaires au mauvais endroit SANS ERREUR :
     * la page existe, le commentaire s'écrit, et il paraît ailleurs que là où le
     * lecteur l'a tapé. C'est pour cela que ces deux cas existent.
     */
    [
      'un détail de guide sans le plan de ses pages',
      guideDetailResponseSchema,
      'guide_detail',
      (d) => {
        delete d['pages'];
      },
    ],
    [
      'un détail de guide sans la page LUE',
      guideDetailResponseSchema,
      'guide_detail',
      (d) => {
        delete d['currentPage'];
      },
    ],
    /**
     * Et le compteur d'une PAGE est requis sur chaque page du plan : c'est lui
     * qui permet d'annoncer où la conversation a lieu, et sa SOMME est le total
     * que la carte de liste porte. Facultatif, il rendrait les deux nombres
     * incomparables.
     */
    [
      'une page du plan sans son compteur de commentaires',
      guideDetailResponseSchema,
      'guide_detail',
      (d) => {
        delete obj(tab(d['pages'])[0])['commentCount'];
      },
    ],
    /**
     * `pageCount` sur la carte de liste : c'est ce qui dit « 4 pages » sur A03.
     * Le déduire de `pages` est impossible — la LISTE ne porte pas le plan, et
     * c'est volontaire : cinquante plans pour afficher cinquante nombres.
     */
    [
      'une carte de liste sans son nombre de pages',
      guideListResponseSchema,
      'guides_list',
      (d) => {
        delete premierGuide(d)['pageCount'];
      },
    ],
    [
      'une carte de liste sans le TOTAL de ses commentaires',
      guideListResponseSchema,
      'guides_list',
      (d) => {
        delete premierGuide(d)['commentCount'];
      },
    ],

    /**
     * RÈGLE DURE §9 — « la date de dernière mise à jour est renvoyée sur chaque
     * guide de liste » (T1 §6 : « aussi visible que le titre »).
     *
     * Le champ est REQUIS au schéma. Le rendre facultatif suffirait à ce qu'une
     * route l'omette un jour sans que rien ne le dise, et l'écran afficherait une
     * carte sans date — exactement ce que la règle interdit.
     */
    [
      'une carte de liste SANS date de dernière mise à jour',
      guideListResponseSchema,
      'guides_list',
      (d) => {
        delete premierGuide(d)['lastContentUpdateAt'];
      },
    ],

    /**
     * §2.7 — l'historique ne porte PAS le corps des versions : « il sert à choisir
     * une version, pas à télécharger le guide vingt fois ». Le service ne le
     * sélectionne pas ; `.strict()` fait que son retour serait vu.
     */
    [
      'le corps d’une version greffé dans l’historique',
      guideVersionsResponseSchema,
      'guide_versions',
      (d) => {
        obj(tab(d['items'])[0])['body'] = 'le corps entier du guide';
      },
    ],

    /**
     * §4 — « pour l'auteur : en attente ; pour tous : acceptées ». Une proposition
     * REFUSÉE ne se montre à personne d'autre qu'à son proposant, et son motif de
     * refus encore moins : l'afficher publiquement exposerait un désaccord réglé.
     * `rejectReason` n'est donc pas dans `guideProposalSchema`, et il ne peut pas
     * y entrer par accident.
     */
    [
      'un motif de refus greffé sur la liste publique des propositions',
      guideProposalsResponseSchema,
      'guide_proposals',
      (d) => {
        obj(tab(d['items'])[0])['rejectReason'] = 'motif privé du refus';
      },
    ],

    /**
     * §2.3 — le score de fraîcheur est un NOMBRE. La colonne est `numeric(10,4)`,
     * et un service qui cesserait d'appeler `.toNumber()` enverrait la chaîne
     * `"31.0000"` : le classement du front la trierait alphabétiquement, donc
     * « 9 » après « 31 », sans erreur visible nulle part.
     */
    [
      'un score de fraîcheur envoyé en chaîne',
      guideListResponseSchema,
      'guides_list',
      (d) => {
        premierGuide(d)['freshnessScore'] = '31.0000';
      },
    ],

    /**
     * §2.6 — le seuil des bandeaux vient du SERVEUR. `meta.staleAfterMonths` est
     * requis : sans lui le front retomberait sur une constante codée en dur, et
     * les deux divergeraient le jour où le produit change de seuil.
     */
    [
      'une liste sans le seuil de fraîcheur dans `meta`',
      guideListResponseSchema,
      'guides_list',
      (d) => {
        delete obj(d['meta'])['staleAfterMonths'];
      },
    ],

    /**
     * §5.3 — `nextCursor` est requis et nullable. Une réponse SANS le champ ferait
     * prendre une pagination muette pour une fin de liste : la liste des guides
     * s'arrêterait à la première page, sans raison visible.
     */
    [
      'une liste sans `nextCursor`',
      guideListResponseSchema,
      'guides_list',
      (d) => {
        delete d['nextCursor'];
      },
    ],
  ];

  for (const [nom, schema, fixture, mutation] of refus) {
    it(`REFUSE : ${nom}`, () => {
      const charge_ = copie(charge(fixture));
      // On vérifie d'abord que la charge passait AVANT la mutation : sans ce
      // point, un schéma qui refuserait déjà la fixture ferait passer ce test
      // pour la bonne raison alors qu'il échoue pour une autre.
      expect(schema.safeParse(charge_).success).toBe(true);
      mutation(charge_);
      expect(schema.safeParse(charge_).success).toBe(false);
    });
  }
});

// ─── 3. Les témoins : muter ce qui ne décide de rien doit rester VERT ────────

describe('témoins — ce qui ne décide de rien passe toujours', () => {
  type Temoin = readonly [string, { safeParse: (v: unknown) => { success: boolean } }, string, (d: Noeud) => void];

  const temoins: readonly Temoin[] = [
    [
      'le titre d’un guide est du texte libre',
      guideListResponseSchema,
      'guides_list',
      (d) => {
        premierGuide(d)['title'] = 'Un titre entièrement différent, et plus long';
      },
    ],
    [
      'le nom affiché de l’auteur est du texte libre',
      guideListResponseSchema,
      'guides_list',
      (d) => {
        obj(premierGuide(d)['author'])['displayName'] = 'Quelqu’un d’autre';
      },
    ],
    /**
     * §8 — l'anonymisation met `author_user_id` à null et CONSERVE le guide. Un
     * guide sans auteur est un cas NORMAL, et le schéma doit le dire. Ce témoin
     * est le plus utile du lot : un `author` requis aurait fait disparaître de
     * l'écran tous les guides des comptes supprimés, avec pour seul symptôme un
     * « contrat cassé ».
     */
    [
      'un guide anonymisé (auteur nul) reste une charge valide',
      guideListResponseSchema,
      'guides_list',
      (d) => {
        premierGuide(d)['author'] = null;
      },
    ],
    [
      'le seuil de fraîcheur peut valoir autre chose que 24',
      guideListResponseSchema,
      'guides_list',
      (d) => {
        obj(d['meta'])['staleAfterMonths'] = 36;
      },
    ],
    [
      'une ville absente est un cas normal (guide sans ville)',
      guideListResponseSchema,
      'guides_list',
      (d) => {
        premierGuide(d)['city'] = null;
      },
    ],
    [
      'le motif d’une proposition est du texte libre',
      guideProposalsResponseSchema,
      'guide_proposals',
      (d) => {
        obj(tab(d['items'])[0])['reason'] = 'Un motif tout à fait différent du précédent.';
      },
    ],
    /**
     * `sourceUrl` est FACULTATIVE côté requête (§2.4) et arrive donc `null` très
     * souvent. Si ce témoin rougissait, toute proposition sans source serait
     * refusée — c'est-à-dire la majorité d'entre elles.
     */
    [
      'une proposition sans source reste une charge valide',
      guideProposalsResponseSchema,
      'guide_proposals',
      (d) => {
        obj(tab(d['items'])[0])['sourceUrl'] = null;
      },
    ],
    [
      'une version sans résumé reste une charge valide',
      guideVersionsResponseSchema,
      'guide_versions',
      (d) => {
        obj(tab(d['items'])[0])['summary'] = null;
      },
    ],
  ];

  for (const [nom, schema, fixture, mutation] of temoins) {
    it(`VERT : ${nom}`, () => {
      const charge_ = copie(charge(fixture));
      mutation(charge_);
      const r = schema.safeParse(charge_);
      expect(r.success).toBe(true);
    });
  }
});
