import { createHmac } from 'node:crypto';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Prisma, newId } from '@app/db';
import {
  SEARCH_BODY_MAX_CHARS,
  SEARCH_FRESHNESS_BOOST,
  SEARCH_FRESHNESS_DAYS,
  SEARCH_GROUP_PREVIEW_SIZE,
  SEARCH_GUIDE_FLAGGED_MAX_AGE_DAYS,
  SEARCH_HELP_RESOLVED_MAX_AGE_DAYS,
  SEARCH_LOCAL_BOOST,
  SEARCH_TOPIC_REPLIES_INDEXED,
  SEARCH_TYPE_LABELS_FR,
  SEARCH_ZERO_CTA_FR,
  SEARCH_ZERO_MIN_DISTINCT_SEEKERS,
  SEARCH_ZERO_PROMPT_FR,
  SUGGEST_CACHE_TTL_MS,
  SUGGEST_MAX_RESULTS,
  type SearchPeriod,
  type SearchQuery,
  type SearchState,
  type SearchSubjectType,
  hasMeaningfulTerms,
  joinGuidePageBodies,
  normalizeQuery,
} from '@app/shared';
import { buildPage, decodeCursor } from '../../common/cursor';
import { PrismaService } from '../../common/prisma.service';
import { VisibilityService } from '../../common/visibility.service';
import { loadEnv } from '../../config/env';

/**
 * Recherche globale — 11-recherche.md.
 *
 * ── CE QUI EXISTAIT DÉJÀ, ET QU'ON NE REFAIT PAS ─────────────────────────────
 *
 * La migration `20260927050000_hard_rules_constraints` pose :
 *   · `immutable_unaccent(text)`, enveloppe déterministe d'`unaccent` ;
 *   · un DÉCLENCHEUR `search_documents_tsv` qui recalcule `tsv` à chaque INSERT et
 *     à chaque UPDATE de `title` ou `body_text`, en pondérant le titre `A` et le
 *     corps `B` ;
 *   · un index GIN sur `tsv` et un index trigram sur `immutable_unaccent(title)`.
 *
 * Ce service ne recalcule donc JAMAIS de `tsvector` : il écrit `title` et
 * `body_text`, et la base fait le reste. Refaire la pondération en SQL applicatif
 * créerait deux définitions du même vecteur, et la seconde divergerait au premier
 * ajustement du dictionnaire.
 *
 * Corollaire technique : `tsv` est `Unsupported("tsvector")` et NON NULLABLE, donc
 * le client Prisma ne peut ni créer ni modifier une ligne de `search_documents`.
 * L'écriture passe par du SQL brut — ce n'est pas un contournement, c'est la seule
 * voie, et elle a l'avantage de laisser le déclencheur travailler.
 *
 * ── LA RÈGLE DURE DE VISIBILITÉ, ET CE QUE LE SCHÉMA NE PERMET PAS ───────────
 *
 * §2.1 : « Une requête ne renvoie jamais un document COMMUNITY d'un réseau dont le
 * demandeur n'est pas membre, ni un document dont l'auteur est bloqué dans un sens
 * ou l'autre. »
 *
 * Le PREMIER volet est tenu en SQL, sur `community_id`. Le SECOND ne peut pas
 * l'être : `search_documents` n'a AUCUNE colonne d'auteur. Il est donc tenu par un
 * filtre applicatif qui résout les auteurs des lignes candidates depuis leurs
 * tables sources, et la requête sur-cueille pour que le filtre ne vide pas la page.
 * Voir le rapport : une colonne `author_user_id` rendrait le filtre gratuit.
 *
 * LES DEUX FILTRES SONT TESTÉS ENSEMBLE, et pas seulement l'un puis l'autre : un
 * document `COMMUNITY` d'un réseau dont je suis membre ET dont l'auteur m'a bloqué
 * doit disparaître. C'est la combinaison qui a piégé trois modules sur six.
 */

/** Une ligne de résultat, telle que l'API la rend. */
export interface SearchHit {
  readonly id: string;
  readonly subjectType: SearchSubjectType;
  readonly subjectId: string;
  readonly title: string;
  readonly excerpt: string;
  readonly cityId: string | null;
  readonly countryId: string | null;
  readonly communityId: string | null;
  readonly rank: number;
  readonly updatedAt: Date;
  /** Où mène ce résultat — composé par `destinations`, `null` si la source a disparu. */
  readonly url: string | null;
  /** Le fait écrit sous le titre — composé par `sublines`. */
  readonly subline: string | null;
}

/** Une suggestion de titre, telle que `GET /search/suggest` la rend. */
export interface Suggestion {
  readonly title: string;
  readonly subjectType: SearchSubjectType;
  readonly subjectId: string;
  readonly url: string | null;
}

interface RawHit {
  id: string;
  subject_type: SearchSubjectType;
  subject_id: string;
  title: string;
  body_text: string;
  city_id: string | null;
  country_id: string | null;
  community_id: string | null;
  updated_at: Date;
  rank: number;
  type_count?: bigint;
}

/**
 * Le port de la file `search-index` (§2.5 : « traitement asynchrone, délai cible
 * < 30 s »).
 *
 * `@Optional()` : sans lui, `enqueueReindex` réindexe SUR PLACE. Les deux chemins
 * appellent exactement `reindexSubject`, donc rien ne diverge entre l'API, le
 * worker et une suite d'intégration — la file ne change que le MOMENT, jamais le
 * résultat. C'est ce qui permet de tester la chaîne sans Redis tout en gardant le
 * comportement de production.
 */
export interface SearchIndexQueuePort {
  enqueue(job: SearchIndexJob): Promise<void>;
}

export const SEARCH_INDEX_QUEUE = Symbol('SearchIndexQueue');

export interface SearchIndexJob {
  readonly subjectType: SearchSubjectType;
  readonly subjectId: string;
}

/** Ce qu'on indexe pour un sujet, ou `null` quand il ne doit plus l'être. */
export interface IndexableDocument {
  readonly subjectType: SearchSubjectType;
  readonly subjectId: string;
  readonly title: string;
  readonly bodyText: string;
  readonly cityId: string | null;
  readonly countryId: string | null;
  readonly communityId: string | null;
  readonly visibility: 'PUBLIC' | 'COMMUNITY';
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly cursorSecret = loadEnv().CURSOR_SECRET;

  /** §2.3 : « 6 max, mis en cache ». Une minute suffit : les titres bougent peu. */
  private readonly suggestCache = new Map<string, { at: number; value: Suggestion[] }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly visibility: VisibilityService,
    @Optional() @Inject(SEARCH_INDEX_QUEUE) private readonly queue: SearchIndexQueuePort | null = null,
  ) {}

  /**
   * Le point d'entrée de tous les gestionnaires d'événements : met en file quand la
   * file existe, réindexe sur place sinon.
   *
   * Une mise en file qui échoue LÈVE : l'événement sera rejoué par les dix
   * tentatives d'`EVENT_JOB_OPTIONS`, et `reindexSubject` étant idempotent, un rejeu
   * ne coûte rien. C'est l'inverse du choix fait pour les envois sortants, et pour
   * une bonne raison : là, la décision était déjà écrite en base ; ici, rien ne
   * l'est — un document non indexé est simplement introuvable, sans trace.
   */
  async enqueueReindex(subjectType: SearchSubjectType, subjectId: string): Promise<void> {
    if (this.queue === null) {
      await this.reindexSubject(subjectType, subjectId);
      return;
    }
    await this.queue.enqueue({ subjectType, subjectId });
  }

  /**
   * Un réseau qui s'archive ou se réactive change la visibilité de TOUS ses sujets
   * et événements — §2.1 fait dépendre leur `visibility` de celle du réseau.
   *
   * Sans cette cascade, archiver un réseau laisserait ses sujets trouvables : la
   * ligne `search_documents` ne changerait pas, puisque aucun événement ne concerne
   * les sujets eux-mêmes.
   */
  async reindexCommunityChildren(communityId: string): Promise<void> {
    const [topics, events] = await Promise.all([
      this.prisma.topic.findMany({ where: { communityId }, select: { id: true }, take: 1_000 }),
      this.prisma.event.findMany({ where: { communityId }, select: { id: true }, take: 1_000 }),
    ]);
    for (const topic of topics) await this.enqueueReindex('TOPIC', topic.id);
    for (const event of events) await this.enqueueReindex('EVENT', event.id);
  }

  /**
   * Le type de document correspondant à un sujet de modération, ou `null`.
   *
   * `moderation.content_hidden` porte des `subject_type` qui ne sont pas tous
   * indexés (`POST`, `COMMENT`, `MESSAGE`, `STORY`) : rendre `null` pour ceux-là est
   * le comportement juste, et non un oubli — ils ne sont JAMAIS indexés (§2.1).
   */
  static searchTypeOfModerationSubject(subjectType: string | null): SearchSubjectType | null {
    switch (subjectType) {
      case 'GUIDE':
        return 'GUIDE';
      case 'HELP_REQUEST':
        return 'HELP_REQUEST';
      case 'HOUSING':
      case 'HOUSING_LISTING':
        return 'HOUSING';
      case 'JOB':
      case 'JOB_LISTING':
        return 'JOB';
      case 'EVENT':
        return 'EVENT';
      case 'TOPIC':
        return 'TOPIC';
      case 'USER':
      case 'PROFILE':
        return 'USER';
      case 'PRO_PROFILE':
        return 'PRO';
      default:
        return null;
    }
  }

  // ══ Requête (§2.3) ════════════════════════════════════════════════════════

  /**
   * `GET /search`.
   *
   * Sans `type` : l'onglet « Tout » — les trois meilleurs de chaque type et les
   * compteurs (§2.3). Avec `type` : l'onglet du type, paginé par curseur.
   */
  async search(viewerId: string, query: SearchQuery) {
    const [communityIds, separated] = await Promise.all([
      this.myCommunityIds(viewerId),
      this.visibility.separatedFrom(viewerId),
    ]);
    const viewerCityId = await this.viewerCityId(viewerId);

    return query.type === undefined
      ? this.searchGrouped(query, communityIds, separated, viewerCityId)
      : this.searchOneType(query, query.type, communityIds, separated, viewerCityId);
  }

  private async searchGrouped(
    query: SearchQuery,
    communityIds: string[],
    separated: string[],
    viewerCityId: string | null,
  ) {
    // On cueille bien plus que trois par type : le filtre d'auteur bloqué
    // s'applique APRÈS le SQL, et prendre exactement trois rendrait deux résultats
    // dès qu'un auteur est bloqué.
    const perType = SEARCH_GROUP_PREVIEW_SIZE * 8;
    const rows = await this.rawSearch(query, communityIds, separated, viewerCityId, {
      mode: 'GROUPED',
      perType,
    });
    const visible = await this.dropBlockedAuthors(rows, separated);
    /**
     * LES DESTINATIONS SONT RÉSOLUES AVANT DE COMPOSER LES GROUPES — une requête
     * par type présent, et non une par ligne. Voir `destinations`.
     */
    const urls = await this.destinations(visible);
    const lignes = await this.sublines(visible);

    const groups = new Map<string, { type: string; label: string; count: number; capped: boolean; items: SearchHit[] }>();
    for (const row of visible) {
      const key = row.subject_type;
      const group =
        groups.get(key) ??
        {
          type: key,
          label: SEARCH_TYPE_LABELS_FR[key] ?? key,
          count: 0,
          // Le compteur est CUEILLI, donc borné : au-delà de `perType`, il est
          // annoncé comme tronqué plutôt que faussement précis. Un COUNT(*) exact
          // par type serait exact avant le filtre d'auteur, donc faux après — et
          // il divulguerait l'existence de contenus d'un auteur qui m'a bloqué.
          capped: false,
          items: [],
        };
      group.count += 1;
      if (group.items.length < SEARCH_GROUP_PREVIEW_SIZE) {
        group.items.push(this.toHit(row, urls.get(row.subject_id) ?? null, lignes.get(row.subject_id) ?? null));
      }
      groups.set(key, group);
    }

    for (const group of groups.values()) {
      if (group.count >= perType) group.capped = true;
    }

    return {
      items: [...groups.values()].sort((a, b) => b.count - a.count),
      nextCursor: null,
      meta: this.meta(query, visible.length === 0),
    };
  }

  private async searchOneType(
    query: SearchQuery,
    type: SearchSubjectType,
    communityIds: string[],
    separated: string[],
    viewerCityId: string | null,
  ) {
    const scope = this.scopeOf(query);
    const cursor = query.cursor === undefined ? null : decodeCursor(query.cursor, this.cursorSecret, scope);

    // Sur-cueillette : trois fois la page, pour que le filtre d'auteur bloqué
    // laisse assez de lignes. `limit + 1` seul rendrait une page trouée.
    const rows = await this.rawSearch(query, communityIds, separated, viewerCityId, {
      mode: 'TYPE',
      type,
      take: (query.limit + 1) * 3,
      ...(cursor === null ? {} : { afterRank: Number(cursor.sort), afterId: cursor.id }),
    });

    const visible = await this.dropBlockedAuthors(rows, separated);
    const urls = await this.destinations(visible);
    const lignes = await this.sublines(visible);
    const hits = visible.map((row) =>
      this.toHit(row, urls.get(row.subject_id) ?? null, lignes.get(row.subject_id) ?? null),
    );

    const page = buildPage(hits, query.limit, scope, this.cursorSecret, (hit) => hit.rank);
    return { ...page, meta: this.meta(query, hits.length === 0) };
  }

  /**
   * La requête SQL, unique pour les deux modes.
   *
   * Tout y est paramétré : `websearch_to_tsquery` tolère n'importe quelle saisie —
   * guillemets déséquilibrés, opérateurs — là où `to_tsquery` lèverait une erreur
   * de syntaxe sur une apostrophe. C'est ce qui permet de passer la requête du
   * membre telle quelle.
   *
   * `immutable_unaccent` est appliqué à la REQUÊTE aussi, parce que le déclencheur
   * l'applique au document : sans cela, « sécurité » ne trouverait pas
   * « securite », et la règle dure d'insensibilité aux accents tomberait.
   */
  private async rawSearch(
    query: SearchQuery,
    communityIds: string[],
    separated: string[],
    viewerCityId: string | null,
    mode:
      | { mode: 'GROUPED'; perType: number }
      | { mode: 'TYPE'; type: SearchSubjectType; take: number; afterRank?: number; afterId?: string },
  ): Promise<RawHit[]> {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`d.tsv @@ q`,
      // RÈGLE DURE (§2.1), premier volet : un document COMMUNITY n'est rendu
      // qu'aux membres du réseau. La forme est EXPLICITE et non un `notIn` :
      // `community_id` est NULLABLE, et un `NOT IN` sur une colonne nullable
      // élimine aussi les lignes à NULL — donc tous les documents publics.
      Prisma.sql`(
        d.visibility = 'PUBLIC'::"SearchVisibility"
        OR (d.visibility = 'COMMUNITY'::"SearchVisibility" AND d.community_id = ANY(${communityIds}::uuid[]))
      )`,
      // Les documents `USER` portent l'identifiant du membre comme `subject_id` :
      // le blocage se filtre donc en SQL pour ce type, gratuitement. Les autres
      // types passent par `dropBlockedAuthors`.
      Prisma.sql`NOT (d.subject_type = 'USER'::"SearchSubjectType" AND d.subject_id = ANY(${separated}::uuid[]))`,
    ];

    if (query.cityId !== undefined && query.radiusKm === undefined) {
      conditions.push(Prisma.sql`d.city_id = ${query.cityId}::uuid`);
    }
    if (query.cityId !== undefined && query.radiusKm !== undefined) {
      // Rayon : distance sphérique depuis la ville demandée. Les villes portent
      // latitude et longitude ; aucun besoin de PostGIS pour 43 villes.
      conditions.push(Prisma.sql`d.city_id IN (
        SELECT c.id FROM cities c, cities ref
        WHERE ref.id = ${query.cityId}::uuid
          AND 6371 * acos(least(1, greatest(-1,
              sin(radians(ref.latitude)) * sin(radians(c.latitude))
            + cos(radians(ref.latitude)) * cos(radians(c.latitude))
              * cos(radians(c.longitude) - radians(ref.longitude))
          ))) <= ${query.radiusKm}
      )`);
    }
    if (query.countryId !== undefined) {
      conditions.push(Prisma.sql`d.country_id = ${query.countryId}::uuid`);
    }

    const periodSince = this.periodSince(query.period);
    if (periodSince !== null) {
      conditions.push(Prisma.sql`d.updated_at >= ${periodSince}`);
    }

    const stateCondition = this.stateCondition(query.state);
    if (stateCondition !== null) conditions.push(stateCondition);

    if (mode.mode === 'TYPE') {
      conditions.push(Prisma.sql`d.subject_type = ${mode.type}::"SearchSubjectType"`);
    }

    // §2.2 : « boost de fraîcheur léger (documents de moins de 30 jours) ; boost
    // local (même ville) appliqué au classement, pas au filtrage. » D'où deux
    // termes ADDITIONNÉS au rang, et aucune condition WHERE correspondante.
    const fresh = new Date(Date.now() - SEARCH_FRESHNESS_DAYS * 86_400_000);
    const rank = Prisma.sql`(
      ts_rank_cd(d.tsv, q)
      + CASE WHEN d.updated_at >= ${fresh} THEN ${SEARCH_FRESHNESS_BOOST}::float8 ELSE 0 END
      + CASE WHEN ${viewerCityId}::uuid IS NOT NULL AND d.city_id = ${viewerCityId}::uuid
             THEN ${SEARCH_LOCAL_BOOST}::float8 ELSE 0 END
    )`;

    const where = Prisma.join(conditions, ' AND ');
    const base = Prisma.sql`
      SELECT d.id, d.subject_type, d.subject_id, d.title, d.body_text,
             d.city_id, d.country_id, d.community_id, d.updated_at,
             ${rank} AS rank
      FROM search_documents d, websearch_to_tsquery('french', immutable_unaccent(${query.q})) q
      WHERE ${where}
    `;

    if (mode.mode === 'GROUPED') {
      return this.prisma.$queryRaw<RawHit[]>(Prisma.sql`
        WITH matched AS (${base}),
        ranked AS (
          SELECT m.*, row_number() OVER (PARTITION BY m.subject_type ORDER BY m.rank DESC, m.id DESC) AS rn
          FROM matched m
        )
        SELECT * FROM ranked WHERE rn <= ${mode.perType} ORDER BY subject_type, rank DESC, id DESC
      `);
    }

    const keyset =
      mode.afterRank === undefined || mode.afterId === undefined
        ? Prisma.empty
        : Prisma.sql`WHERE (m.rank < ${mode.afterRank}::float8
             OR (m.rank = ${mode.afterRank}::float8 AND m.id < ${mode.afterId}::uuid))`;

    return this.prisma.$queryRaw<RawHit[]>(Prisma.sql`
      WITH matched AS (${base})
      SELECT m.* FROM matched m
      ${keyset}
      ORDER BY m.rank DESC, m.id DESC
      LIMIT ${mode.take}
    `);
  }

  /**
   * §2.3 : « état (ouvert / résolu pour l'entraide et les sujets) ».
   *
   * L'état N'EST PAS dans `search_documents` — la table ne porte pas de statut.
   * Il est donc vérifié dans la table SOURCE par un `EXISTS`, et le filtre ne
   * s'applique QU'aux deux types que la spec nomme : appliquer « ouvert » à un
   * guide ou à une ville ne voudrait rien dire et viderait ces onglets.
   */
  private stateCondition(state: SearchState | undefined): Prisma.Sql | null {
    if (state === undefined) return null;
    const status = state === 'open' ? 'OPEN' : 'RESOLVED';
    return Prisma.sql`(
      d.subject_type NOT IN ('HELP_REQUEST'::"SearchSubjectType", 'TOPIC'::"SearchSubjectType")
      OR (d.subject_type = 'HELP_REQUEST'::"SearchSubjectType"
          AND EXISTS (SELECT 1 FROM help_requests h WHERE h.id = d.subject_id AND h.status::text = ${status}))
      OR (d.subject_type = 'TOPIC'::"SearchSubjectType"
          AND EXISTS (SELECT 1 FROM topics t WHERE t.id = d.subject_id AND t.status::text = ${status}))
    )`;
  }

  private periodSince(period: SearchPeriod): Date | null {
    if (period === 'all') return null;
    const days = period === '7d' ? 7 : 30;
    return new Date(Date.now() - days * 86_400_000);
  }

  /**
   * RÈGLE DURE (§2.1), second volet : aucun document d'un auteur séparé du
   * demandeur.
   *
   * `search_documents` n'a pas de colonne d'auteur, donc les auteurs sont résolus
   * depuis les tables sources, en un lot par type. Les documents `USER` sont déjà
   * écartés en SQL, et `CITY` n'a pas d'auteur.
   */
  private async dropBlockedAuthors(rows: RawHit[], separated: string[]): Promise<RawHit[]> {
    if (separated.length === 0 || rows.length === 0) return rows;
    const blocked = new Set(separated);

    const idsByType = new Map<string, string[]>();
    for (const row of rows) {
      idsByType.set(row.subject_type, [...(idsByType.get(row.subject_type) ?? []), row.subject_id]);
    }

    /** subjectId → auteur. Absent = pas d'auteur, donc rien à filtrer. */
    const authorOf = new Map<string, string | null>();

    const collect = async (
      type: string,
      load: (ids: string[]) => Promise<{ id: string; author: string | null }[]>,
    ): Promise<void> => {
      const ids = idsByType.get(type);
      if (ids === undefined || ids.length === 0) return;
      for (const row of await load(ids)) authorOf.set(`${type}:${row.id}`, row.author);
    };

    await Promise.all([
      collect('GUIDE', async (ids) =>
        (await this.prisma.guide.findMany({ where: { id: { in: ids } }, select: { id: true, authorUserId: true } })).map(
          (r) => ({ id: r.id, author: r.authorUserId }),
        ),
      ),
      collect('TOPIC', async (ids) =>
        (await this.prisma.topic.findMany({ where: { id: { in: ids } }, select: { id: true, authorUserId: true } })).map(
          (r) => ({ id: r.id, author: r.authorUserId }),
        ),
      ),
      collect('HELP_REQUEST', async (ids) =>
        (
          await this.prisma.helpRequest.findMany({
            where: { id: { in: ids } },
            select: { id: true, authorUserId: true },
          })
        ).map((r) => ({ id: r.id, author: r.authorUserId })),
      ),
      collect('HOUSING', async (ids) =>
        (
          await this.prisma.housingListing.findMany({
            where: { id: { in: ids } },
            select: { id: true, authorUserId: true },
          })
        ).map((r) => ({ id: r.id, author: r.authorUserId })),
      ),
      collect('JOB', async (ids) =>
        (
          await this.prisma.jobListing.findMany({ where: { id: { in: ids } }, select: { id: true, authorUserId: true } })
        ).map((r) => ({ id: r.id, author: r.authorUserId })),
      ),
      collect('EVENT', async (ids) =>
        (
          await this.prisma.event.findMany({ where: { id: { in: ids } }, select: { id: true, organizerUserId: true } })
        ).map((r) => ({ id: r.id, author: r.organizerUserId })),
      ),
      collect('PRO', async (ids) =>
        (await this.prisma.proProfile.findMany({ where: { id: { in: ids } }, select: { id: true, userId: true } })).map(
          (r) => ({ id: r.id, author: r.userId }),
        ),
      ),
    ]);

    return rows.filter((row) => {
      const author = authorOf.get(`${row.subject_type}:${row.subject_id}`);
      return author === undefined || author === null || !blocked.has(author);
    });
  }

  private toHit(row: RawHit, url: string | null = null, subline: string | null = null): SearchHit {
    return {
      id: row.id,
      subjectType: row.subject_type,
      subjectId: row.subject_id,
      title: row.title,
      excerpt: row.body_text.slice(0, 220),
      cityId: row.city_id,
      countryId: row.country_id,
      communityId: row.community_id,
      rank: Number(row.rank),
      updatedAt: row.updated_at,
      url,
      subline,
    };
  }

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ OÙ MÈNE UN RÉSULTAT — ET POURQUOI C'EST LE SERVEUR QUI LE DIT            ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « les propositions sous l'input doivent s'afficher et permettre
   * d'aller directement sur un élément ».
   *
   * L'index ne porte que `subject_type` et `subject_id`. Or quatre des neuf types
   * ne s'ouvrent PAS par leur identifiant : un guide s'ouvre par son SLUG, un
   * membre par son PSEUDO, une ville par son SLUG, et un sujet par le slug de son
   * RÉSEAU en plus de son identifiant. Un client qui composerait les adresses
   * devrait donc connaître neuf règles de routage ET savoir résoudre trois
   * référentiels — c'est-à-dire refaire ici ce que la base sait déjà.
   *
   * On résout donc côté serveur, EN UNE REQUÊTE PAR TYPE PRÉSENT : les résultats
   * arrivent groupés, et un aller-retour par ligne serait trente requêtes pour une
   * page de recherche.
   *
   * `null` quand la source a disparu entre l'indexation et la lecture : l'écran
   * affiche alors le résultat sans le rendre cliquable, plutôt que de mener à une
   * page absente.
   */
  private async destinations(
    rows: readonly { readonly subject_type: string; readonly subject_id: string }[],
  ): Promise<Map<string, string>> {
    const parType = new Map<string, string[]>();
    for (const row of rows) {
      const liste = parType.get(row.subject_type) ?? [];
      liste.push(row.subject_id);
      parType.set(row.subject_type, liste);
    }

    const urls = new Map<string, string>();
    const poser = (id: string, url: string): void => {
      urls.set(id, url);
    };

    for (const [type, ids] of parType) {
      switch (type) {
        case 'GUIDE': {
          const lignes = await this.prisma.guide.findMany({
            where: { id: { in: ids } },
            select: { id: true, slug: true },
          });
          for (const g of lignes) poser(g.id, `/guides/${g.slug}`);
          break;
        }
        case 'USER': {
          const lignes = await this.prisma.user.findMany({
            where: { id: { in: ids } },
            select: { id: true, handle: true },
          });
          /**
           * L'ARROBASE FAIT PARTIE DE L'ADRESSE, et son absence rend 404.
           *
           * Le front sert le profil d'un membre sur `/@:pseudo` — jamais sur
           * `/:pseudo`. Le segment dynamique porte l'arobase DANS SA VALEUR et
           * refuse tout le reste, pour qu'un pseudo ne puisse pas masquer
           * `/accueil` ou `/parcours`. Un résultat de recherche de type `USER`
           * menait donc à une page introuvable, et l'épreuve ne l'avait pas vu :
           * elle comparait l'adresse obtenue à l'adresse attendue, toutes deux
           * fausses de la même façon. Elle vérifie maintenant la forme AUSSI.
           */
          for (const u of lignes) poser(u.id, `/@${u.handle}`);
          break;
        }
        case 'CITY': {
          const lignes = await this.prisma.city.findMany({
            where: { id: { in: ids } },
            select: { id: true, slug: true },
          });
          for (const c of lignes) poser(c.id, `/villes/${c.slug}`);
          break;
        }
        case 'TOPIC': {
          const lignes = await this.prisma.topic.findMany({
            where: { id: { in: ids } },
            select: { id: true, community: { select: { slug: true } } },
          });
          for (const t of lignes) poser(t.id, `/reseaux/${t.community.slug}/sujets/${t.id}`);
          break;
        }
        // Les quatre derniers s'ouvrent par leur identifiant : rien à résoudre.
        case 'HELP_REQUEST':
          for (const id of ids) poser(id, `/entraide/${id}`);
          break;
        case 'HOUSING':
          for (const id of ids) poser(id, `/services/logement/${id}`);
          break;
        case 'JOB':
          for (const id of ids) poser(id, `/services/emploi/${id}`);
          break;
        case 'EVENT':
          for (const id of ids) poser(id, `/agenda/${id}`);
          break;
        case 'PRO':
          for (const id of ids) poser(id, `/services/annuaire/${id}`);
          break;
        default:
          break;
      }
    }

    return urls;
  }

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LA SOUS-LIGNE D'UNE CARTE — LES FAITS QUE L'INDEX NE PORTE PAS            ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * La maquette écrit sous chaque titre un fait : « 84 utiles » (guide), « 14
   * réponses » (entraide), « Ouverte · Lyon 7e », « 620 € ». L'index ne porte que
   * du texte ; ces faits sont des colonnes des sources. Comme `destinations`, la
   * résolution se fait EN UNE REQUÊTE PAR TYPE PRÉSENT, jamais une par ligne.
   *
   * Seuls des champs DÉJÀ PUBLICS sur la carte de la source (un compte, un prix, un
   * statut, une ville) y entrent : la sous-ligne n'ouvre rien que la page du
   * résultat ne montrerait pas à celui qui peut déjà ouvrir le résultat.
   */
  private async sublines(
    rows: readonly { readonly subject_type: string; readonly subject_id: string }[],
  ): Promise<Map<string, string>> {
    const parType = new Map<string, string[]>();
    for (const row of rows) {
      const liste = parType.get(row.subject_type) ?? [];
      liste.push(row.subject_id);
      parType.set(row.subject_type, liste);
    }
    const lignes = new Map<string, string>();
    const pluriel = (n: number, un: string, plusieurs: string): string =>
      `${String(n)} ${n > 1 ? plusieurs : un}`;
    const joindre = (...morceaux: (string | null | undefined)[]): string =>
      morceaux.filter((m): m is string => m !== null && m !== undefined && m !== '').join(' · ');
    const jour = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });

    for (const [type, ids] of parType) {
      switch (type) {
        case 'GUIDE': {
          for (const g of await this.prisma.guide.findMany({
            where: { id: { in: ids } },
            select: { id: true, helpfulCount: true },
          })) {
            lignes.set(g.id, pluriel(g.helpfulCount, 'utile', 'utiles'));
          }
          break;
        }
        case 'HELP_REQUEST': {
          for (const h of await this.prisma.helpRequest.findMany({
            where: { id: { in: ids } },
            select: { id: true, status: true, responseCount: true, city: { select: { name: true } } },
          })) {
            lignes.set(
              h.id,
              joindre(
                pluriel(h.responseCount, 'réponse', 'réponses'),
                h.status === 'OPEN' ? 'Ouverte' : h.status === 'RESOLVED' ? 'Résolue' : 'Archivée',
                h.city.name,
              ),
            );
          }
          break;
        }
        case 'HOUSING': {
          for (const h of await this.prisma.housingListing.findMany({
            where: { id: { in: ids } },
            select: { id: true, priceCents: true, currency: true, city: { select: { name: true } } },
          })) {
            const prix =
              h.priceCents === null
                ? null
                : `${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: h.currency, maximumFractionDigits: 0 }).format(h.priceCents / 100)}`;
            lignes.set(h.id, joindre(prix, h.city.name));
          }
          break;
        }
        case 'JOB': {
          for (const j of await this.prisma.jobListing.findMany({
            where: { id: { in: ids } },
            select: { id: true, companyName: true, contractType: true, city: { select: { name: true } } },
          })) {
            lignes.set(j.id, joindre(j.companyName, j.contractType, j.city?.name));
          }
          break;
        }
        case 'EVENT': {
          for (const e of await this.prisma.event.findMany({
            where: { id: { in: ids } },
            select: { id: true, startsAt: true, attendeeCount: true, city: { select: { name: true } } },
          })) {
            lignes.set(
              e.id,
              joindre(jour.format(e.startsAt), e.city.name, pluriel(e.attendeeCount, 'inscrit', 'inscrits')),
            );
          }
          break;
        }
        case 'TOPIC': {
          for (const t of await this.prisma.topic.findMany({
            where: { id: { in: ids } },
            select: { id: true, replyCount: true, community: { select: { name: true } } },
          })) {
            lignes.set(t.id, joindre(pluriel(t.replyCount, 'réponse', 'réponses'), t.community.name));
          }
          break;
        }
        case 'USER': {
          for (const u of await this.prisma.user.findMany({
            where: { id: { in: ids } },
            select: { id: true, handle: true, city: { select: { name: true } } },
          })) {
            lignes.set(u.id, joindre(`@${u.handle}`, u.city?.name));
          }
          break;
        }
        default:
          break;
      }
    }
    return lignes;
  }

  private meta(query: SearchQuery, empty: boolean) {
    return {
      q: query.q,
      normalized: normalizeQuery(query.q),
      /** §2.4 : la proposition d'état vide, renvoyée par l'API et non codée en dur. */
      ...(empty && hasMeaningfulTerms(query.q)
        ? { zeroResult: { prompt: SEARCH_ZERO_PROMPT_FR, cta: SEARCH_ZERO_CTA_FR, helpTitle: query.q.trim() } }
        : {}),
    };
  }

  private scopeOf(query: SearchQuery): string {
    return [
      'search',
      normalizeQuery(query.q),
      query.type ?? '*',
      query.cityId ?? '*',
      query.radiusKm ?? '*',
      query.countryId ?? '*',
      query.period,
      query.state ?? '*',
    ].join('|');
  }

  /**
   * Les réseaux dont le demandeur est membre ACTIF.
   *
   * `status: 'ACTIVE'` n'est pas un détail : `community_members` porte aussi
   * `PENDING`, `INVITED` et `BANNED`. Sans ce filtre, une adhésion en attente — ou
   * pire, un membre BANNI — continuerait de voir les sujets du réseau par la
   * recherche, alors que la page du réseau les lui refuse. C'est exactement la
   * fuite que la règle dure du §2.1 interdit, par une porte que personne ne
   * regarde.
   */
  private async myCommunityIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.communityMember.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { communityId: true },
    });
    return rows.map((r) => r.communityId);
  }

  private async viewerCityId(userId: string): Promise<string | null> {
    const row = await this.prisma.user.findUnique({ where: { id: userId }, select: { cityId: true } });
    return row?.cityId ?? null;
  }

  // ══ Suggestions (§2.3) ════════════════════════════════════════════════════

  /**
   * `GET /search/suggest`.
   *
   * PUBLIC UNIQUEMENT, et c'est une décision de sécurité : les suggestions sont
   * MISES EN CACHE (§2.3), donc partagées entre membres. Une suggestion issue d'un
   * document `COMMUNITY` fuirait le titre d'un sujet de réseau vers un non-membre
   * — exactement ce que la règle dure interdit. Le cache et la visibilité par
   * réseau sont incompatibles ; on garde le cache et on restreint au public.
   *
   * Préfixe ET trigram : le préfixe sert la frappe en cours, la similarité
   * rattrape la faute (« secutire » → « sécurité »).
   *
   * ── CHAQUE SUGGESTION MÈNE À SON ÉLÉMENT ──────────────────────────────────
   *
   * Le porteur : « les propositions sous l'input doivent s'afficher et permettre
   * d'ALLER DIRECTEMENT sur un élément ». Avant, une suggestion ne portait qu'un
   * titre et un type : la choisir ne pouvait que relancer la recherche sur son
   * texte — un détour par une page de résultats dont on connaissait déjà la
   * réponse. Elle porte maintenant son identifiant et son adresse, résolus comme
   * ceux des résultats (voir `destinations`).
   *
   * LA RÉSOLUTION EST DANS LE CACHE, et pas devant : les adresses d'une page de
   * recherche se recalculeraient à chaque touche frappée. Un slug qui change
   * laisse donc une adresse morte pendant au plus la minute du cache, ce qui est
   * le même risque que le titre affiché à côté.
   */
  async suggest(q: string): Promise<{ items: Suggestion[] }> {
    const key = normalizeQuery(q);
    const cached = this.suggestCache.get(key);
    if (cached !== undefined && Date.now() - cached.at < SUGGEST_CACHE_TTL_MS) {
      return { items: cached.value };
    }

    const rows = await this.prisma.$queryRaw<{ title: string; subject_type: SearchSubjectType; subject_id: string }[]>(Prisma.sql`
      SELECT DISTINCT ON (d.title) d.title, d.subject_type::text AS subject_type, d.subject_id,
             similarity(immutable_unaccent(d.title), immutable_unaccent(${q})) AS sim
      FROM search_documents d
      WHERE d.visibility = 'PUBLIC'::"SearchVisibility"
        AND (
          immutable_unaccent(d.title) ILIKE immutable_unaccent(${q}) || '%'
          OR immutable_unaccent(d.title) % immutable_unaccent(${q})
        )
      ORDER BY d.title, sim DESC
      LIMIT ${SUGGEST_MAX_RESULTS}
    `);

    const urls = await this.destinations(rows);
    const items: Suggestion[] = rows.map((r) => ({
      title: r.title,
      subjectType: r.subject_type,
      subjectId: r.subject_id,
      url: urls.get(r.subject_id) ?? null,
    }));
    this.suggestCache.set(key, { at: Date.now(), value: items });
    return { items };
  }

  // ══ Recherche infructueuse (§2.4) ═════════════════════════════════════════

  /**
   * Le PSEUDONYME d'un chercheur, pour une requête donnée.
   *
   * HMAC-SHA256 sous une sous-clé dérivée du secret applicatif par un libellé —
   * la même construction que le lien de désabonnement des notifications
   * (`signUnsubscribe`), reprise plutôt que réinventée. Deux propriétés voulues :
   *
   *   · LA REQUÊTE ENTRE DANS LE CONDENSAT. Le même membre porte donc un
   *     pseudonyme DIFFÉRENT sur chaque requête, et les lignes de
   *     `search_zero_result_seekers` ne se recollent pas en profil de recherche.
   *     C'est ce qui distingue un pseudonyme d'un identifiant déguisé.
   *   · LE SECRET N'EST PAS EN BASE. Une fuite de la base seule ne remonte à
   *     personne ; il faut les deux.
   *
   * Ce n'est PAS une protection contre qui détient le secret ET la liste des
   * membres : l'espace des identifiants est énumérable, comme pour
   * `phoneFingerprint`, et c'est dit là-bas dans les mêmes termes. Ce que la
   * construction garantit, c'est qu'on peut COMPTER des personnes sans en NOMMER
   * aucune, et c'est tout ce que le seuil demande.
   */
  private seekerPseudonym(queryNormalized: string, userId: string): string {
    const key = createHmac('sha256', this.cursorSecret).update('search:zero-seeker').digest();
    return createHmac('sha256', key).update(`${queryNormalized}|${userId}`).digest('hex');
  }

  /**
   * `POST /search/zero`.
   *
   * RÈGLE DURE (§2.4) : « requête normalisée, ville, jour — SANS identifiant de
   * membre ». `search_zero_results` n'a donc toujours AUCUNE colonne de membre, et
   * le schéma zod du corps n'en porte aucune : ce qu'un type ne peut pas
   * transporter ne peut pas fuir en base, et un client ne peut pas se faire passer
   * pour un autre chercheur.
   *
   * ─── POURQUOI UN `userId` ARRIVE MAINTENANT, ET D'OÙ ────────────────────────
   *
   * Arbitrage du porteur : le panneau des « guides manquants » n'affiche qu'une
   * requête cherchée par PLUSIEURS PERSONNES DISTINCTES. Or `count` compte les
   * RECHERCHES — mesuré : trois appels du MÊME membre donnent une ligne à
   * `count: 3`. Un seuil posé sur `count` aurait donc été franchi par une personne
   * seule, et le but de l'arbitrage manqué.
   *
   * Compter des personnes demande une ligne par personne, donc une table — et
   * l'identité, le temps du calcul d'un pseudonyme. Elle vient du JETON, par le
   * contrôleur, et jamais du corps de la requête : c'est la différence entre « le
   * serveur sait qui appelle » et « le client déclare qui il est ». Rien de cette
   * identité n'est écrit : seul le HMAC de `seekerPseudonym` l'est.
   *
   * LE VERROU, et pourquoi un `upsert` Prisma ne suffit pas : la contrainte
   * `@@unique([queryNormalized, cityId, occurredOn])` porte sur une colonne
   * NULLABLE, et PostgreSQL considère deux NULL comme distincts. Un `upsert` sur
   * une recherche sans ville ne trouverait donc jamais la ligne de la veille et en
   * insérerait une par appel — le compteur resterait à 1 et l'agrégat produit
   * serait faux. Le verrou consultatif rend l'incrément sûr sans colonne nouvelle,
   * et il couvre maintenant les DEUX écritures : le compteur de recherches et la
   * ligne de pseudonyme ont le même périmètre (requête, ville, jour), donc le même
   * verrou les sérialise toutes deux.
   *
   * CE QUE LA RÉPONSE NE DIT PAS. Ni le nombre de personnes, ni le franchissement
   * du seuil : la route est appelée par n'importe quel membre après un écran vide,
   * et lui rendre « vous êtes le troisième à chercher ceci » serait publier
   * l'agrégat à l'endroit où il est le moins contrôlé. Elle garde donc exactement
   * la forme d'avant, `{ recorded, count }`.
   */
  async recordZeroResult(
    userId: string,
    input: { q: string; cityId?: string | undefined },
  ): Promise<{ recorded: boolean; count: number }> {
    const queryNormalized = normalizeQuery(input.q);

    // §2.4 : « après suppression des mots vides ». « de la » ne dit rien d'un
    // guide manquant, et l'enregistrer polluerait la revue hebdomadaire.
    if (!hasMeaningfulTerms(input.q)) return { recorded: false, count: 0 };

    const occurredOn = new Date();
    occurredOn.setUTCHours(0, 0, 0, 0);
    const cityId = input.cityId ?? null;

    const seekerHash = this.seekerPseudonym(queryNormalized, userId);

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`zero:${queryNormalized}:${cityId ?? ''}:${occurredOn.toISOString()}`}, 0))`;

      /**
       * Le pseudonyme d'abord, et dédoublonné à la main pour la raison déjà écrite
       * plus haut : l'unicité de la table porte sur `city_id`, qui est nullable, et
       * deux NULL ne s'y reconnaissent pas. Sans ce `findFirst`, un membre qui
       * cherche dix fois sans ville inscrirait dix lignes — `COUNT(DISTINCT)` les
       * recollerait, mais la table grossirait pour rien.
       */
      const seen = await tx.searchZeroResultSeeker.findFirst({
        where: { queryNormalized, cityId, occurredOn, seekerHash },
        select: { id: true },
      });
      if (seen === null) {
        await tx.searchZeroResultSeeker.create({
          data: { id: newId(), queryNormalized, cityId, occurredOn, seekerHash },
        });
      }

      const existing = await tx.searchZeroResult.findFirst({
        where: { queryNormalized, cityId, occurredOn },
        select: { id: true, count: true },
      });

      if (existing !== null) {
        const row = await tx.searchZeroResult.update({
          where: { id: existing.id },
          data: { count: { increment: 1 } },
          select: { count: true },
        });
        return { recorded: true, count: row.count };
      }

      await tx.searchZeroResult.create({
        data: { id: newId(), queryNormalized, cityId, occurredOn, count: 1 },
      });
      return { recorded: true, count: 1 };
    });
  }

  /**
   * Top des requêtes restées sans résultat, agrégé par requête normalisée.
   *
   * ⚠ CE COMMENTAIRE DISAIT « `/v1/admin/search/zero-results` (§3) », et c'était
   * devenu faux : la route admin n'existe toujours pas (aucune garde de RÔLE dans
   * l'application), mais cette méthode est désormais SERVIE — par
   * `GET /search/zero-results`, en lecture membre, pour le panneau « GUIDES
   * MANQUANTS » d'A03. Voir `search.controller.ts` et
   * `searchZeroResultRowSchema`.
   *
   * ⚠ `cityId` FILTRE SUR L'ÉGALITÉ, donc une ville EXCLUT les lignes sans ville —
   * et `recordZeroResult` écrit `null` dès que le chercheur n'a pas choisi de
   * filtre de ville. C'est mesuré, c'est voulu pour un outil de revue par ville, et
   * c'est la raison pour laquelle le panneau d'A03 ne passe pas de ville.
   /**
   * `/v1/admin/search/zero-results` — les requêtes sans résultat (§3).
   *
   * ─── LE SEUIL DE PERSONNES DISTINCTES, ET CE QU'IL REMPLACE ─────────────────
   *
   * Arbitrage du porteur : « n'afficher qu'une requête cherchée par PLUSIEURS
   * PERSONNES DISTINCTES ». Le classement partait de `SUM(count)`, c'est-à-dire du
   * nombre de RECHERCHES ; il part maintenant du nombre de PERSONNES, et
   * `SEARCH_ZERO_MIN_DISTINCT_SEEKERS` en est le plancher.
   *
   * CE QUE LE SEUIL FAIT TOMBER, sans lire une seule fois le texte de la requête :
   * « docteur awa diallo lyon » ou « rappeler 0612345678 » sont le fait d'un membre
   * et d'un seul, et n'atteignent jamais trois personnes. L'alternative — deviner
   * un nom ou un numéro dans une requête libre — se trompe dans les deux sens et se
   * trompe en silence.
   *
   * POURQUOI DU SQL BRUT ICI. `COUNT(DISTINCT …)` n'existe pas dans le `groupBy`
   * de Prisma, et c'est précisément l'opération dont tout dépend : agréger côté
   * TypeScript voudrait dire rapatrier une ligne par personne et par jour pour
   * toutes les requêtes de la fenêtre, puis compter — le travail que la base fait
   * avec son index.
   *
   * DEUX REQUÊTES ET NON UNE JOINTURE : la première décide QUI passe le seuil, la
   * seconde ne somme les recherches que pour ces quelques requêtes. Une jointure
   * aurait sommé `count` sur toutes, pour n'en garder que `limit`.
   */
  async zeroResults(query: { weeks: number; cityId?: string | undefined; limit: number }) {
    const since = new Date(Date.now() - query.weeks * 7 * 86_400_000);
    since.setUTCHours(0, 0, 0, 0);
    // `undefined` ne peut pas être lié à un paramètre SQL ; `null` l'est, et c'est
    // lui qui fait basculer la condition en « toutes les villes ».
    const cityFilter = query.cityId ?? null;

    const passing = await this.prisma.$queryRaw<{ query_normalized: string; seekers: number }[]>`
      SELECT query_normalized, COUNT(DISTINCT seeker_hash)::int AS seekers
      FROM search_zero_result_seekers
      WHERE occurred_on >= ${since}::date
        AND (${cityFilter}::uuid IS NULL OR city_id = ${cityFilter}::uuid)
      GROUP BY query_normalized
      HAVING COUNT(DISTINCT seeker_hash) >= ${SEARCH_ZERO_MIN_DISTINCT_SEEKERS}
      ORDER BY seekers DESC, query_normalized ASC
      LIMIT ${query.limit}
    `;

    /**
     * Le panneau DISPARAÎT quand il ne reste rien, et c'est ici que ça se décide :
     * une liste vide est la réponse normale d'une semaine calme, pas un incident.
     * On sort tout de suite plutôt que d'envoyer un `IN ()` vide à la base.
     */
    if (passing.length === 0) return { items: [], nextCursor: null };

    const queries = passing.map((row) => row.query_normalized);
    const searches = await this.prisma.searchZeroResult.groupBy({
      by: ['queryNormalized'],
      where: {
        queryNormalized: { in: queries },
        occurredOn: { gte: since },
        ...(query.cityId === undefined ? {} : { cityId: query.cityId }),
      },
      _sum: { count: true },
    });
    const countByQuery = new Map(searches.map((row) => [row.queryNormalized, row._sum.count ?? 0]));

    return {
      /**
       * `count` garde son sens — des RECHERCHES — et `seekers` dit le nombre de
       * PERSONNES. Les deux sont rendus parce que ce sont deux faits différents, et
       * que les confondre est exactement l'erreur que ce lot a corrigée. L'ordre est
       * celui des personnes : c'est le nombre de personnes qui dit qu'un guide
       * manque, pas le nombre de fois qu'on l'a cherché.
       */
      items: passing.map((row) => ({
        query: row.query_normalized,
        count: countByQuery.get(row.query_normalized) ?? 0,
        seekers: row.seekers,
      })),
      nextCursor: null,
    };
  }

  // ══ Indexation (§2.5) ═════════════════════════════════════════════════════

  /**
   * Écrit ou met à jour un document.
   *
   * SQL brut, et non `prisma.searchDocument.upsert` : `tsv` est
   * `Unsupported("tsvector")` NON NULLABLE, donc absent du client Prisma et
   * impossible à renseigner par lui. Le déclencheur `search_documents_tsv` le
   * calcule — d'où l'importance que `title` et `body_text` figurent dans le `SET`
   * du `ON CONFLICT` : c'est leur présence qui déclenche le recalcul.
   */
  async upsertDocument(doc: IndexableDocument): Promise<void> {
    const body = doc.bodyText.slice(0, SEARCH_BODY_MAX_CHARS);
    await this.prisma.$executeRaw`
      INSERT INTO search_documents
        (id, created_at, updated_at, subject_type, subject_id, title, body_text,
         city_id, country_id, community_id, visibility)
      VALUES (
        ${newId()}::uuid, now(), now(),
        ${doc.subjectType}::"SearchSubjectType", ${doc.subjectId}::uuid,
        ${doc.title}, ${body},
        ${doc.cityId}::uuid, ${doc.countryId}::uuid, ${doc.communityId}::uuid,
        ${doc.visibility}::"SearchVisibility"
      )
      ON CONFLICT (subject_type, subject_id) DO UPDATE SET
        title = EXCLUDED.title,
        body_text = EXCLUDED.body_text,
        city_id = EXCLUDED.city_id,
        country_id = EXCLUDED.country_id,
        community_id = EXCLUDED.community_id,
        visibility = EXCLUDED.visibility,
        updated_at = now()
    `;
  }

  async removeDocument(subjectType: SearchSubjectType, subjectId: string): Promise<void> {
    await this.prisma.$executeRaw`
      DELETE FROM search_documents
      WHERE subject_type = ${subjectType}::"SearchSubjectType" AND subject_id = ${subjectId}::uuid
    `;
  }

  /**
   * Le point d'entrée de TOUS les gestionnaires d'événements d'indexation.
   *
   * IDEMPOTENT par construction : il relit la source et décide — indexer ou
   * supprimer. Un rejeu donne le même résultat, et un événement `*.unpublished`
   * arrivé avant son `*.published` (ce qui est possible : la livraison est « au
   * moins une fois », pas « dans l'ordre ») se corrige au rejeu suivant, puisque
   * c'est la SOURCE qui tranche et non l'événement.
   *
   * C'est pour cela qu'aucun gestionnaire ne reçoit de titre dans sa charge utile :
   * un titre porté par l'événement serait celui du moment de l'émission.
   */
  async reindexSubject(subjectType: SearchSubjectType, subjectId: string): Promise<void> {
    const doc = await this.readSource(subjectType, subjectId);
    if (doc === null) {
      await this.removeDocument(subjectType, subjectId);
      return;
    }
    await this.upsertDocument(doc);
  }

  /** Réindexation complète par type — `/v1/admin/search/reindex` (§2.5). */
  async reindexType(subjectType: SearchSubjectType): Promise<{ indexed: number; removed: number }> {
    const ids = await this.sourceIds(subjectType);
    let indexed = 0;
    for (const id of ids) {
      const doc = await this.readSource(subjectType, id);
      if (doc === null) continue;
      await this.upsertDocument(doc);
      indexed += 1;
    }

    // Les documents dont la source n'est plus éligible disparaissent : sans cette
    // passe, une réindexation « complète » laisserait en place les lignes des
    // sujets dépubliés depuis la dernière, et l'index grossirait de fantômes.
    const removed = await this.prisma.$executeRaw`
      DELETE FROM search_documents
      WHERE subject_type = ${subjectType}::"SearchSubjectType"
        AND subject_id <> ALL(${ids}::uuid[])
    `;

    return { indexed, removed };
  }

  /**
   * Les sujets ÉLIGIBLES d'un type, selon le tableau du §2.1.
   *
   * La même condition sert la réindexation et `readSource` : une seule définition
   * de « ce qui est indexable », sinon la tâche d'admin et les événements
   * divergeraient et l'index dépendrait du chemin par lequel on y est arrivé.
   */
  private async sourceIds(subjectType: SearchSubjectType): Promise<string[]> {
    const flaggedSince = new Date(Date.now() - SEARCH_GUIDE_FLAGGED_MAX_AGE_DAYS * 86_400_000);
    const resolvedSince = new Date(Date.now() - SEARCH_HELP_RESOLVED_MAX_AGE_DAYS * 86_400_000);

    switch (subjectType) {
      case 'GUIDE': {
        const rows = await this.prisma.guide.findMany({
          where: {
            deletedAt: null,
            OR: [{ status: 'PUBLISHED' }, { status: 'FLAGGED', updatedAt: { gte: flaggedSince } }],
          },
          select: { id: true },
        });
        return rows.map((r) => r.id);
      }
      case 'TOPIC': {
        const rows = await this.prisma.topic.findMany({
          where: {
            deletedAt: null,
            status: { not: 'ARCHIVED' },
            community: { status: 'ACTIVE', visibility: { not: 'INVITE_ONLY' } },
          },
          select: { id: true },
        });
        return rows.map((r) => r.id);
      }
      case 'HELP_REQUEST': {
        const rows = await this.prisma.helpRequest.findMany({
          where: {
            deletedAt: null,
            OR: [{ status: 'OPEN' }, { status: 'RESOLVED', resolvedAt: { gte: resolvedSince } }],
          },
          select: { id: true },
        });
        return rows.map((r) => r.id);
      }
      case 'HOUSING': {
        const rows = await this.prisma.housingListing.findMany({
          where: { deletedAt: null, status: 'ACTIVE' },
          select: { id: true },
        });
        return rows.map((r) => r.id);
      }
      case 'JOB': {
        const rows = await this.prisma.jobListing.findMany({
          where: { deletedAt: null, status: 'ACTIVE' },
          select: { id: true },
        });
        return rows.map((r) => r.id);
      }
      case 'EVENT': {
        const rows = await this.prisma.event.findMany({
          where: {
            status: 'SCHEDULED',
            // §2.1, « Jamais indexés » : les réseaux INVITE_ONLY, « ni leurs
            // sujets ni leurs événements ». `community_id` est NULLABLE, donc la
            // condition est écrite en `OR` explicite : un filtre `community:
            // { visibility: { not } }` seul écarterait aussi les événements
            // publics, qui n'ont pas de réseau.
            OR: [{ communityId: null }, { community: { visibility: { not: 'INVITE_ONLY' } } }],
          },
          select: { id: true },
        });
        return rows.map((r) => r.id);
      }
      case 'USER': {
        const rows = await this.prisma.user.findMany({
          where: { status: 'ACTIVE', deletedAt: null, profile: { isPublic: true } },
          select: { id: true },
        });
        return rows.map((r) => r.id);
      }
      case 'CITY': {
        const rows = await this.prisma.city.findMany({ where: { isActive: true }, select: { id: true } });
        return rows.map((r) => r.id);
      }
      case 'PRO': {
        const rows = await this.prisma.proProfile.findMany({
          where: { deletedAt: null, verificationStatus: 'APPROVED', status: 'ACTIVE' },
          select: { id: true },
        });
        return rows.map((r) => r.id);
      }
      default:
        return [];
    }
  }

  /** Le document d'un sujet, ou `null` s'il ne doit pas (ou plus) être indexé. */
  private async readSource(
    subjectType: SearchSubjectType,
    subjectId: string,
  ): Promise<IndexableDocument | null> {
    const flaggedSince = new Date(Date.now() - SEARCH_GUIDE_FLAGGED_MAX_AGE_DAYS * 86_400_000);
    const resolvedSince = new Date(Date.now() - SEARCH_HELP_RESOLVED_MAX_AGE_DAYS * 86_400_000);

    switch (subjectType) {
      case 'GUIDE': {
        const guide = await this.prisma.guide.findFirst({
          where: {
            id: subjectId,
            deletedAt: null,
            OR: [{ status: 'PUBLISHED' }, { status: 'FLAGGED', updatedAt: { gte: flaggedSince } }],
          },
          select: {
            id: true,
            title: true,
            cityId: true,
            originCountryId: true,
            /**
             * ╔══════════════════════════════════════════════════════════════════╗
             * ║ L'INDEX PORTE LE CORPS DE TOUTES LES PAGES                        ║
             * ╚══════════════════════════════════════════════════════════════════╝
             *
             * Il lisait `guide.currentVersion.body`, c'est-à-dire la version
             * courante DU GUIDE. Depuis les pages (05 `GuidePage`), cette colonne
             * ne reflète plus que la PREMIÈRE page : un guide de cinq pages
             * n'aurait été cherchable que par sa première, et les quatre autres —
             * donc l'essentiel d'une longue démarche — auraient été INTROUVABLES
             * sans que rien ne l'explique. Ce n'est pas un ajout : c'est la
             * régression que les pages auraient causée ici.
             *
             * Les pages retirées sont exclues : leur texte n'est plus lisible, et
             * l'indexer mènerait un chercheur vers une page qu'aucune route ne
             * rend. L'ordre de `position` est celui de la lecture — il ne change
             * rien au classement plein texte, mais il rend l'extrait affiché
             * cohérent avec le guide.
             */
            pages: {
              where: { deletedAt: null },
              orderBy: { position: 'asc' },
              select: { currentVersion: { select: { body: true } } },
            },
          },
        });
        if (guide === null) return null;
        return {
          subjectType,
          subjectId: guide.id,
          title: guide.title,
          bodyText: joinGuidePageBodies(
            guide.pages.map((page) => page.currentVersion?.body ?? ''),
          ),
          cityId: guide.cityId,
          countryId: guide.originCountryId,
          communityId: null,
          visibility: 'PUBLIC',
        };
      }

      case 'TOPIC': {
        const topic = await this.prisma.topic.findFirst({
          where: {
            id: subjectId,
            deletedAt: null,
            status: { not: 'ARCHIVED' },
            community: { status: 'ACTIVE', visibility: { not: 'INVITE_ONLY' } },
          },
          select: {
            id: true,
            title: true,
            body: true,
            communityId: true,
            community: { select: { visibility: true, cityId: true, countryId: true } },
            // §2.1 : « corps + 3 premières réponses ». Les réponses d'un sujet
            // sont les publications déplacées vers lui : la table de réponses de
            // sujet n'existe pas dans le schéma figé (07 §6 le note aussi).
            postsMovedHere: {
              select: { body: true, createdAt: true },
              orderBy: { createdAt: 'asc' },
              take: SEARCH_TOPIC_REPLIES_INDEXED,
            },
          },
        });
        if (topic === null) return null;
        // Les réponses d'un sujet sont de DEUX origines : les publications déplacées
        // vers lui, et les commentaires posés dessus (`POST /comments`,
        // `subjectType: 'TOPIC'`). Seul le premier chemin était lu ; une réponse
        // directe ne faisait donc jamais partie du document, et la réindexer à
        // chaque réponse n'aurait rien changé. Les `SEARCH_TOPIC_REPLIES_INDEXED`
        // premières, toutes origines confondues, dans l'ordre d'arrivée.
        const comments = await this.prisma.comment.findMany({
          where: { subjectType: 'TOPIC', subjectId: topic.id, deletedAt: null, status: 'PUBLISHED' },
          orderBy: { createdAt: 'asc' },
          take: SEARCH_TOPIC_REPLIES_INDEXED,
          select: { body: true, createdAt: true },
        });
        const replies = [
          ...topic.postsMovedHere.map((p) => ({ body: p.body, at: p.createdAt })),
          ...comments.map((c) => ({ body: c.body, at: c.createdAt })),
        ]
          .sort((a, b) => a.at.getTime() - b.at.getTime())
          .slice(0, SEARCH_TOPIC_REPLIES_INDEXED)
          .map((r) => r.body)
          .join('\n');
        return {
          subjectType,
          subjectId: topic.id,
          title: topic.title,
          bodyText: `${topic.body}\n${replies}`,
          cityId: topic.community.cityId,
          countryId: topic.community.countryId,
          communityId: topic.communityId,
          // §2.1 : « COMMUNITY (réseau) ou PUBLIC si réseau PUBLIC ».
          visibility: topic.community.visibility === 'PUBLIC' ? 'PUBLIC' : 'COMMUNITY',
        };
      }

      case 'HELP_REQUEST': {
        const help = await this.prisma.helpRequest.findFirst({
          where: {
            id: subjectId,
            deletedAt: null,
            OR: [{ status: 'OPEN' }, { status: 'RESOLVED', resolvedAt: { gte: resolvedSince } }],
          },
          select: { id: true, title: true, body: true, cityId: true, city: { select: { countryId: true } } },
        });
        if (help === null) return null;
        return {
          subjectType,
          subjectId: help.id,
          title: help.title,
          bodyText: help.body,
          cityId: help.cityId,
          countryId: help.city.countryId,
          communityId: null,
          visibility: 'PUBLIC',
        };
      }

      case 'HOUSING': {
        const listing = await this.prisma.housingListing.findFirst({
          where: { id: subjectId, deletedAt: null, status: 'ACTIVE' },
          select: {
            id: true,
            title: true,
            description: true,
            cityId: true,
            city: { select: { countryId: true } },
          },
        });
        if (listing === null) return null;
        return {
          subjectType,
          subjectId: listing.id,
          title: listing.title,
          bodyText: listing.description,
          cityId: listing.cityId,
          countryId: listing.city.countryId,
          communityId: null,
          visibility: 'PUBLIC',
        };
      }

      case 'JOB': {
        const job = await this.prisma.jobListing.findFirst({
          where: { id: subjectId, deletedAt: null, status: 'ACTIVE' },
          select: {
            id: true,
            title: true,
            description: true,
            companyName: true,
            cityId: true,
            city: { select: { countryId: true } },
          },
        });
        if (job === null) return null;
        return {
          subjectType,
          subjectId: job.id,
          // §2.1 : « titre + entreprise » dans le TITRE, donc pondéré A —
          // chercher le nom d'une entreprise doit remonter ses offres.
          title: job.companyName === null ? job.title : `${job.title} — ${job.companyName}`,
          bodyText: job.description,
          cityId: job.cityId,
          countryId: job.city?.countryId ?? null,
          communityId: null,
          visibility: 'PUBLIC',
        };
      }

      case 'EVENT': {
        const event = await this.prisma.event.findFirst({
          where: {
            id: subjectId,
            status: 'SCHEDULED',
            OR: [{ communityId: null }, { community: { visibility: { not: 'INVITE_ONLY' } } }],
          },
          select: {
            id: true,
            title: true,
            description: true,
            venueName: true,
            cityId: true,
            communityId: true,
            city: { select: { countryId: true } },
            community: { select: { visibility: true } },
          },
        });
        if (event === null) return null;
        return {
          subjectType,
          subjectId: event.id,
          title: event.title,
          bodyText: `${event.description ?? ''}\n${event.venueName ?? ''}`,
          cityId: event.cityId,
          countryId: event.city.countryId,
          communityId: event.communityId,
          visibility:
            event.communityId === null || event.community?.visibility === 'PUBLIC' ? 'PUBLIC' : 'COMMUNITY',
        };
      }

      case 'USER': {
        const user = await this.prisma.user.findFirst({
          where: { id: subjectId, status: 'ACTIVE', deletedAt: null, profile: { isPublic: true } },
          select: {
            id: true,
            handle: true,
            displayName: true,
            cityId: true,
            originCountryId: true,
            profile: { select: { bio: true } },
            skills: { select: { skill: { select: { nameFr: true } } } },
            languages: { select: { language: { select: { nameFr: true } } } },
          },
        });
        if (user === null) return null;
        return {
          subjectType,
          subjectId: user.id,
          title: `${user.handle} ${user.displayName}`,
          bodyText: [
            user.profile?.bio ?? '',
            user.skills.map((s) => s.skill.nameFr).join(' '),
            user.languages.map((l) => l.language.nameFr).join(' '),
          ].join('\n'),
          cityId: user.cityId,
          countryId: user.originCountryId,
          communityId: null,
          visibility: 'PUBLIC',
        };
      }

      case 'CITY': {
        const city = await this.prisma.city.findFirst({
          where: { id: subjectId, isActive: true },
          select: { id: true, name: true, region: true, countryId: true },
        });
        if (city === null) return null;
        return {
          subjectType,
          subjectId: city.id,
          title: city.region === null ? city.name : `${city.name} ${city.region}`,
          // §2.1 : corps « — ». Une ville n'a pas de texte à indexer.
          bodyText: '',
          cityId: city.id,
          countryId: city.countryId,
          communityId: null,
          visibility: 'PUBLIC',
        };
      }

      case 'PRO': {
        const pro = await this.prisma.proProfile.findFirst({
          where: { id: subjectId, deletedAt: null, verificationStatus: 'APPROVED', status: 'ACTIVE' },
          select: {
            id: true,
            businessName: true,
            description: true,
            profession: { select: { nameFr: true } },
            user: { select: { displayName: true, cityId: true, originCountryId: true } },
            cities: { select: { cityId: true }, take: 1 },
          },
        });
        if (pro === null) return null;
        return {
          subjectType,
          subjectId: pro.id,
          // §2.1 : « nom + métier ».
          title: `${pro.businessName ?? pro.user.displayName} ${pro.profession.nameFr}`,
          bodyText: pro.description ?? '',
          cityId: pro.cities[0]?.cityId ?? pro.user.cityId,
          countryId: pro.user.originCountryId,
          communityId: null,
          visibility: 'PUBLIC',
        };
      }

      default:
        return null;
    }
  }

  /**
   * §5 : « Documents `USER` supprimés ; les autres documents de l'auteur suivent le
   * sort de leur source. »
   *
   * Le document `USER` part tout de suite. Les autres sont réindexés par les
   * gestionnaires des modules concernés — chacun anonymise ou supprime SA source, et
   * `reindexSubject` relisant la source suit ce qu'ils décident. Supprimer ici tous
   * les documents d'un auteur serait faux : un guide anonymisé reste publié et doit
   * rester trouvable (05 §2.8).
   */
  async handleUserDeleted(userId: string): Promise<void> {
    await this.removeDocument('USER', userId);
  }
}
