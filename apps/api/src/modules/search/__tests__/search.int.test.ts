import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import {
  SEARCH_NEVER_INDEXED,
  SEARCH_ZERO_MIN_DISTINCT_SEEKERS,
  SearchSubjectType,
  normalizeQuery,
} from '@app/shared';
import { PrismaService } from '../../../common/prisma.service';
import { VisibilityService } from '../../../common/visibility.service';
import { EventHandlerRegistry, type DomainEventJob } from '../../../queue/event-handlers';
import { registerSearchSubscriptions } from '../../../queue/event-subscriptions.service';
import { SearchService } from '../search.service';

/**
 * Recherche — 11-recherche.md §6.
 *
 * ── CE QUE CES TESTS ÉPROUVENT, ET COMMENT ───────────────────────────────────
 *
 * L'indexation passe par l'ÉVÉNEMENT quand un producteur existe : les tests posent
 * les vrais abonnements (`registerSearchSubscriptions`) sur un registre neuf et
 * dispatchent un `DomainEventJob`. Sans port de file, `enqueueReindex` réindexe sur
 * place — le même appel que celui du consommateur du worker, donc rien ne diverge.
 *
 * La REQUÊTE, elle, est éprouvée en base réelle : tout le travail est du SQL
 * (`websearch_to_tsquery`, `immutable_unaccent`, `ts_rank_cd`, le déclencheur de
 * `tsv`), et une doublure ne prouverait rien de la pondération ni de l'insensibilité
 * aux accents.
 *
 * ── LA COMBINAISON DE DEUX FILTRES ───────────────────────────────────────────
 *
 * Un test vérifie les deux volets de la règle dure ENSEMBLE, et pas seulement l'un
 * puis l'autre : un document `COMMUNITY` d'un réseau dont je SUIS membre, écrit par
 * quelqu'un qui m'a bloqué. Trois modules sur six sont tombés sur ce piège — deux
 * diffusions conditionnelles posant la même clé, la seconde écrasant la première.
 * Ici les deux filtres vivent à des endroits différents (SQL pour le réseau,
 * application pour l'auteur), ce qui est justement la configuration où l'on oublie
 * de les composer.
 *
 * ── MUTATIONS APPLIQUÉES ─────────────────────────────────────────────────────
 *
 *   · filtre de réseau remplacé par `d.community_id IS NULL OR d.community_id = ANY(...)`
 *     → le test du non-membre tombe ;
 *   · `myCommunityIds` sans `status: 'ACTIVE'` → le test du membre BANNI tombe ;
 *   · `dropBlockedAuthors` rendant `rows` tel quel → les tests de l'auteur bloqué et
 *     de la combinaison tombent ;
 *   · `immutable_unaccent` retiré de la requête (mais gardé dans le déclencheur)
 *     → le test des accents tombe ;
 *   · `buildPage` sans `sortOf` → le test de pagination tombe (lignes répétées).
 */
describe('recherche (11)', () => {
  let prisma: PrismaService;
  let search: SearchService;
  let registry: EventHandlerRegistry;

  const createdUsers: string[] = [];
  const createdHelp: string[] = [];
  const createdTopics: string[] = [];
  const createdCommunities: string[] = [];
  const createdPosts: string[] = [];
  const createdZero: string[] = [];

  let originCountryId: string;
  let cityId: string;
  let otherCityId: string;

  const run = Math.random().toString(36).slice(2, 8);
  /** Un marqueur unique : la base est partagée entre fichiers de test. */
  const tag = `zx${run}`;
  let counter = 0;

  async function member(city = cityId): Promise<string> {
    counter += 1;
    const id = newId();
    await prisma.user.create({
      data: {
        id,
        handle: `se${run}${counter}${id.slice(-6)}`,
        displayName: `Chercheur ${counter}`,
        phase: 'PRE_DEPARTURE',
        verificationLevel: 'L1',
        originCountryId,
        cityId: city,
        plan: 'FREE',
        status: 'ACTIVE',
      },
    });
    createdUsers.push(id);
    return id;
  }

  async function helpRequest(
    authorUserId: string,
    title: string,
    body = 'Un corps quelconque.',
    status: 'OPEN' | 'RESOLVED' = 'OPEN',
    city = cityId,
  ): Promise<string> {
    const id = newId();
    await prisma.helpRequest.create({
      data: {
        id,
        authorUserId,
        kind: 'REQUEST',
        type: 'PAPERWORK',
        title,
        body,
        cityId: city,
        status,
        moderationStatus: 'CLEARED',
        ...(status === 'RESOLVED' ? { resolvedAt: new Date() } : {}),
      },
    });
    createdHelp.push(id);
    return id;
  }

  async function community(visibility: 'PUBLIC' | 'ON_REQUEST' | 'INVITE_ONLY'): Promise<string> {
    counter += 1;
    const id = newId();
    await prisma.community.create({
      data: {
        id,
        kind: 'INTEREST',
        name: `Réseau ${counter} ${tag}`,
        slug: `res-${run}-${counter}-${id.slice(-6)}`,
        visibility,
        status: 'ACTIVE',
        lastActivityAt: new Date(),
        cityId,
      },
    });
    createdCommunities.push(id);
    return id;
  }

  async function join(
    communityId: string,
    userId: string,
    status: 'ACTIVE' | 'PENDING' | 'BANNED' = 'ACTIVE',
  ): Promise<void> {
    await prisma.communityMember.create({
      data: { id: newId(), communityId, userId, role: 'MEMBER', status, joinedAt: new Date() },
    });
  }

  async function topic(communityId: string, authorUserId: string, title: string): Promise<string> {
    const id = newId();
    await prisma.topic.create({
      data: {
        id,
        communityId,
        authorUserId,
        title,
        body: `Discussion ${tag}.`,
        status: 'OPEN',
        pinKind: 'NONE',
      },
    });
    createdTopics.push(id);
    return id;
  }

  async function block(blockerUserId: string, blockedUserId: string): Promise<void> {
    await prisma.block.create({
      data: { id: newId(), blockerUserId, blockedUserId },
    });
  }

  /** Le chemin RÉEL : un travail de la file `events`, distribué par le registre. */
  async function emit(type: string, aggregateId: string, payload: unknown): Promise<void> {
    await registry.dispatch({
      id: newId(),
      type: type as DomainEventJob['type'],
      aggregateId,
      payload,
      occurredAt: new Date().toISOString(),
    });
  }

  /** Les identifiants de sujets trouvés, pour une requête donnée et un onglet donné. */
  async function findIds(viewerId: string, q: string, type?: 'HELP_REQUEST' | 'TOPIC') {
    const page = await search.search(viewerId, {
      q,
      limit: 50,
      period: 'all',
      ...(type === undefined ? {} : { type }),
    });
    if (type === undefined) {
      const groups = page.items as { items: { subjectId: string }[] }[];
      return groups.flatMap((g) => g.items.map((i) => i.subjectId));
    }
    return (page.items as { subjectId: string }[]).map((i) => i.subjectId);
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    search = new SearchService(prisma, new VisibilityService(prisma));

    registry = new EventHandlerRegistry();
    // LE VRAI câblage de la recherche.
    registerSearchSubscriptions(registry, search);

    const country = await prisma.country.findFirstOrThrow({
      where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } },
      select: { id: true },
    });
    originCountryId = country.id;
    // Sans filtre `is_active` : aucune ville n'est active dans la base de
    // développement, et l'indexation des villes n'est pas ce qui se joue ici.
    cityId = (await prisma.city.findFirstOrThrow({ select: { id: true } })).id;
    otherCityId = (
      await prisma.city.findFirstOrThrow({ where: { id: { not: cityId } }, select: { id: true } })
    ).id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      `DELETE FROM search_documents WHERE subject_id = ANY($1::uuid[])`,
      [...createdHelp, ...createdTopics, ...createdUsers, ...createdPosts],
    );
    if (createdZero.length > 0) {
      await prisma.searchZeroResult.deleteMany({ where: { id: { in: createdZero } } });
    }
    await prisma.searchZeroResult.deleteMany({ where: { queryNormalized: { contains: tag } } });
    // Les pseudonymes portent la MÊME requête normalisée que le compteur : le marqueur
    // du fichier suffit à les retrouver, et aucune autre table n'y renvoie.
    await prisma.searchZeroResultSeeker.deleteMany({
      where: { queryNormalized: { contains: tag } },
    });
    if (createdTopics.length > 0) await prisma.topic.deleteMany({ where: { id: { in: createdTopics } } });
    if (createdPosts.length > 0) await prisma.post.deleteMany({ where: { id: { in: createdPosts } } });
    if (createdHelp.length > 0) {
      await prisma.helpRequest.deleteMany({ where: { id: { in: createdHelp } } });
    }
    if (createdCommunities.length > 0) {
      await prisma.communityMember.deleteMany({ where: { communityId: { in: createdCommunities } } });
      await prisma.community.deleteMany({ where: { id: { in: createdCommunities } } });
    }
    if (createdUsers.length > 0) {
      await prisma.block.deleteMany({ where: { blockerUserId: { in: createdUsers } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    }
    await prisma.$disconnect();
  });

  // ══ RÈGLE DURE §6 · l'insensibilité aux accents ═══════════════════════════

  describe('rule: la recherche est insensible aux accents', () => {
    it('trouve « sécurité sociale » en tapant « securite sociale », et l’inverse', async () => {
      const author = await member();
      const id = await helpRequest(author, `Sécurité sociale ${tag}`, 'Comment obtenir un numéro ?');
      await emit('help_request.published', id, { authorUserId: author, kind: 'REQUEST', cityId });

      // Le document existe, et son `tsv` a été calculé par le DÉCLENCHEUR — ce
      // service n'écrit jamais de tsvector.
      const [doc] = await prisma.$queryRawUnsafe<{ tsv: string }[]>(
        `SELECT tsv::text AS tsv FROM search_documents WHERE subject_id = $1::uuid`,
        id,
      );
      expect(doc?.tsv).toBeDefined();
      // Le titre est pondéré A, le corps B : c'est le déclencheur qui le fait.
      expect(doc?.tsv).toMatch(/:\d+A/);

      expect(await findIds(author, `securite sociale ${tag}`)).toContain(id);
      expect(await findIds(author, `Sécurité ${tag}`)).toContain(id);
      expect(await findIds(author, `SECURITE ${tag}`)).toContain(id);
    });

    it('le stemming français rattrache le singulier et le pluriel', async () => {
      const author = await member();
      const id = await helpRequest(author, `Démarches administratives ${tag}`);
      await emit('help_request.published', id, { authorUserId: author, kind: 'REQUEST', cityId });
      expect(await findIds(author, `demarche administrative ${tag}`)).toContain(id);
    });
  });

  // ══ RÈGLE DURE §6 · visibilité par réseau ═════════════════════════════════

  describe('rule: un document COMMUNITY n’est pas renvoyé à un non-membre', () => {
    it('le membre trouve le sujet, le non-membre ne le trouve pas', async () => {
      const author = await member();
      const stranger = await member();
      const communityId = await community('ON_REQUEST');
      await join(communityId, author);

      const topicId = await topic(communityId, author, `Titre de sujet ${tag}`);
      await emit('community.topic_created', topicId, { communityId, topicId, authorUserId: author });

      const doc = await prisma.searchDocument.findFirstOrThrow({
        where: { subjectType: 'TOPIC', subjectId: topicId },
      });
      expect(doc.visibility).toBe('COMMUNITY');
      expect(doc.communityId).toBe(communityId);

      expect(await findIds(author, `sujet ${tag}`, 'TOPIC')).toContain(topicId);
      expect(await findIds(stranger, `sujet ${tag}`, 'TOPIC')).not.toContain(topicId);
      // Et l'onglet « Tout » ne le laisse pas filtrer non plus.
      expect(await findIds(stranger, `sujet ${tag}`)).not.toContain(topicId);
    });

    it('un membre BANNI ou EN ATTENTE est un non-membre', async () => {
      // LE DÉFAUT QUE CECI ATTRAPE : `community_members` porte quatre statuts, et
      // une jointure sans filtre laisse un membre banni lire les sujets par la
      // recherche alors que la page du réseau les lui refuse.
      const author = await member();
      const banned = await member();
      const pending = await member();
      const communityId = await community('ON_REQUEST');
      await join(communityId, author);
      await join(communityId, banned, 'BANNED');
      await join(communityId, pending, 'PENDING');

      const topicId = await topic(communityId, author, `Sujet réservé ${tag}`);
      await emit('community.topic_created', topicId, { communityId, topicId, authorUserId: author });

      expect(await findIds(author, `réservé ${tag}`, 'TOPIC')).toContain(topicId);
      expect(await findIds(banned, `réservé ${tag}`, 'TOPIC')).not.toContain(topicId);
      expect(await findIds(pending, `réservé ${tag}`, 'TOPIC')).not.toContain(topicId);
    });

    it('un réseau PUBLIC rend ses sujets publics, et un réseau INVITE_ONLY n’est jamais indexé', async () => {
      const author = await member();
      const stranger = await member();

      const openId = await community('PUBLIC');
      await join(openId, author);
      const openTopic = await topic(openId, author, `Sujet ouvert ${tag}`);
      await emit('community.topic_created', openTopic, { communityId: openId, topicId: openTopic, authorUserId: author });
      expect(await findIds(stranger, `ouvert ${tag}`, 'TOPIC')).toContain(openTopic);

      // §2.1, « Jamais indexés » : « réseaux INVITE_ONLY (ni leurs sujets ni leurs
      // événements) ». Le document n'est pas seulement invisible : il n'existe pas.
      const secretId = await community('INVITE_ONLY');
      await join(secretId, author);
      const secretTopic = await topic(secretId, author, `Sujet secret ${tag}`);
      await emit('community.topic_created', secretTopic, { communityId: secretId, topicId: secretTopic, authorUserId: author });

      expect(
        await prisma.searchDocument.count({ where: { subjectType: 'TOPIC', subjectId: secretTopic } }),
      ).toBe(0);
      expect(await findIds(author, `secret ${tag}`, 'TOPIC')).not.toContain(secretTopic);
    });
  });

  // ══ RÈGLE DURE §6 · l'auteur bloqué ══════════════════════════════════════

  describe('rule: un document d’un auteur bloqué n’est pas renvoyé', () => {
    it('dans les deux sens, et pour les tiers rien ne change', async () => {
      const author = await member();
      const blocker = await member();
      const blocked = await member();
      const third = await member();

      const byAuthor = await helpRequest(author, `Annonce visible ${tag}`);
      await emit('help_request.published', byAuthor, { authorUserId: author, kind: 'REQUEST', cityId });

      // `blocker` bloque `author` : le document de `author` disparaît pour lui.
      await block(blocker, author);
      expect(await findIds(blocker, `visible ${tag}`, 'HELP_REQUEST')).not.toContain(byAuthor);
      expect(await findIds(third, `visible ${tag}`, 'HELP_REQUEST')).toContain(byAuthor);

      // DANS L'AUTRE SENS : `blocked` est bloqué PAR `author`, et le document de
      // `author` doit aussi disparaître pour lui. Un filtre à sens unique laisserait
      // passer ce cas.
      await block(author, blocked);
      expect(await findIds(blocked, `visible ${tag}`, 'HELP_REQUEST')).not.toContain(byAuthor);
    });

    it('un document USER est filtré aussi — son `subject_id` EST le membre', async () => {
      const subject = await member();
      const blocker = await member();
      await prisma.userProfile.create({
        data: { userId: subject, occupationStatus: 'OTHER', availableToHelp: false, isPublic: true },
      });
      await search.reindexSubject('USER', subject);

      const handle = (await prisma.user.findUniqueOrThrow({ where: { id: subject }, select: { handle: true } })).handle;
      const others = await member();
      expect(await findIds(others, handle, 'HELP_REQUEST')).toEqual([]);
      const foundByOther = await search.search(others, { q: handle, type: 'USER', limit: 20, period: 'all' });
      expect((foundByOther.items as { subjectId: string }[]).map((i) => i.subjectId)).toContain(subject);

      await block(blocker, subject);
      const foundByBlocker = await search.search(blocker, { q: handle, type: 'USER', limit: 20, period: 'all' });
      expect((foundByBlocker.items as { subjectId: string }[]).map((i) => i.subjectId)).not.toContain(subject);
    });
  });

  // ══ LA COMBINAISON DES DEUX FILTRES ═══════════════════════════════════════

  describe('rule: réseau ET blocage se composent', () => {
    it('membre du réseau mais bloqué par l’auteur : le sujet reste invisible', async () => {
      // LE PIÈGE : deux filtres écrits à deux endroits — l'un en SQL sur
      // `community_id`, l'autre en application sur l'auteur. Chacun testé seul
      // passe ; c'est leur COMPOSITION qui casse, et c'est ce que ce test tient.
      const author = await member();
      const viewer = await member();
      const communityId = await community('ON_REQUEST');
      await join(communityId, author);
      await join(communityId, viewer);

      const topicId = await topic(communityId, author, `Sujet partagé ${tag}`);
      await emit('community.topic_created', topicId, { communityId, topicId, authorUserId: author });

      // Étape 1 : membre du réseau, aucun blocage → il voit.
      expect(await findIds(viewer, `partagé ${tag}`, 'TOPIC')).toContain(topicId);

      // Étape 2 : l'auteur le bloque. Il est TOUJOURS membre du réseau, donc le
      // filtre SQL le laisse passer — seul le filtre d'auteur peut l'arrêter.
      await block(author, viewer);
      expect(await findIds(viewer, `partagé ${tag}`, 'TOPIC')).not.toContain(topicId);
      expect(await findIds(viewer, `partagé ${tag}`)).not.toContain(topicId);
    });

    it('non-membre ET auteur bloqué : rien ne fuit par l’un ni par l’autre', async () => {
      const author = await member();
      const viewer = await member();
      const communityId = await community('ON_REQUEST');
      await join(communityId, author);
      await block(author, viewer);

      const topicId = await topic(communityId, author, `Doublement caché ${tag}`);
      await emit('community.topic_created', topicId, { communityId, topicId, authorUserId: author });

      expect(await findIds(viewer, `doublement ${tag}`, 'TOPIC')).not.toContain(topicId);
      expect(await findIds(viewer, `doublement ${tag}`)).not.toContain(topicId);
    });
  });

  // ══ RÈGLE DURE §6 · ce qui n'est jamais indexé ════════════════════════════

  describe('rule: les parcours et les messages ne sont jamais indexés', () => {
    it('aucun type de document ne les désigne, et publier n’en crée aucun', async () => {
      // 1. Le TYPE ne peut pas les exprimer : `SearchSubjectType` ne contient
      //    aucune des sources interdites du §2.1. Ce qu'un type ne peut pas dire ne
      //    peut pas être indexé par erreur — et le jour où quelqu'un ajoute
      //    `MESSAGE` à l'enum, ce test tombe, ce qui est l'effet voulu.
      for (const forbidden of SEARCH_NEVER_INDEXED) {
        expect(SearchSubjectType as readonly string[]).not.toContain(forbidden);
      }

      // 2. Le CHEMIN : une publication de fil et un message envoyé ne créent
      //    aucune ligne. Les événements sont dispatchés pour de vrai ; s'ils
      //    trouvaient un abonné d'indexation, il apparaîtrait ici.
      const author = await member();
      const postId = newId();
      await prisma.post.create({
        data: {
          id: postId,
          authorUserId: author,
          type: 'QUESTION',
          body: `Publication ${tag} sur la préfecture.`,
          cityId,
          status: 'PUBLISHED',
          moderationStatus: 'CLEARED',
        },
      });
      createdPosts.push(postId);

      const before = await prisma.searchDocument.count();
      await emit('post.published', postId, { authorUserId: author, type: 'QUESTION' });
      await emit('message.sent', newId(), {
        messageId: newId(),
        conversationId: newId(),
        kind: 'DIRECT',
        senderUserId: author,
        recipientUserIds: [author],
      });
      expect(await prisma.searchDocument.count()).toBe(before);
      expect(await findIds(author, `publication ${tag}`)).not.toContain(postId);
    });
  });

  // ══ RÈGLE DURE §6 · le zéro résultat sans identité ════════════════════════

  describe('rule: search_zero_results ne contient aucun identifiant de membre', () => {
    it('n’enregistre que requête normalisée, ville et jour, et incrémente au lieu de dupliquer', async () => {
      const q = `Introuvable ${tag}`;

      // UN SEUL membre, trois recherches. C'est tout le relevé qui a motivé
      // l'arbitrage : le compteur monte à trois pour une personne seule.
      const seul = await member();
      const first = await search.recordZeroResult(seul, { q });
      const second = await search.recordZeroResult(seul, { q });
      const third = await search.recordZeroResult(seul, { q });

      expect(first.count).toBe(1);
      expect(second.count).toBe(2);
      expect(third.count).toBe(3);

      const rows = await prisma.searchZeroResult.findMany({
        where: { queryNormalized: normalizeQuery(q) },
      });
      // LE DÉFAUT QUE CECI ATTRAPE : `@@unique([queryNormalized, cityId, occurredOn])`
      // porte sur une colonne NULLABLE, et PostgreSQL considère deux NULL comme
      // distincts. Un `upsert` aurait inséré TROIS lignes à `count: 1`, et l'agrégat
      // produit aurait été faux sans que rien ne le signale.
      expect(rows).toHaveLength(1);
      expect(rows[0]?.count).toBe(3);
      expect(rows[0]?.cityId).toBeNull();
      for (const id of rows.map((r) => r.id)) createdZero.push(id);

      // AUCUN identifiant de membre, et la table ne peut même pas en porter : on le
      // vérifie sur les COLONNES, pas sur la ligne — une ligne sans membre pourrait
      // n'être qu'un oubli d'écriture.
      const columns = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'search_zero_results'`,
      );
      const names = columns.map((c) => c.column_name);
      expect(names).toEqual(
        expect.arrayContaining(['query_normalized', 'city_id', 'occurred_on', 'count']),
      );
      expect(names.some((n) => n.includes('user'))).toBe(false);
      expect(JSON.stringify(rows)).not.toContain('user');
    });

    it('la ville sépare les lignes, sans jamais les confondre avec l’absence de ville', async () => {
      const q = `Rienici ${tag}`;
      const qui = await member();
      await search.recordZeroResult(qui, { q });
      await search.recordZeroResult(qui, { q, cityId });
      await search.recordZeroResult(qui, { q, cityId });

      const rows = await prisma.searchZeroResult.findMany({
        where: { queryNormalized: normalizeQuery(q) },
        orderBy: { count: 'asc' },
      });
      expect(rows).toHaveLength(2);
      expect(rows[0]?.count).toBe(1);
      expect(rows[0]?.cityId).toBeNull();
      expect(rows[1]?.count).toBe(2);
      expect(rows[1]?.cityId).toBe(cityId);
      for (const id of rows.map((r) => r.id)) createdZero.push(id);
    });

    it('une requête faite de mots vides n’est pas enregistrée (§2.4)', async () => {
      const result = await search.recordZeroResult(await member(), { q: 'de la' });
      expect(result.recorded).toBe(false);
      expect(await prisma.searchZeroResult.count({ where: { queryNormalized: 'de la' } })).toBe(0);
      // Et pas de pseudonyme non plus : une requête non enregistrée ne doit rien
      // laisser derrière elle, pas même une ligne qui dit que quelqu'un a cherché.
      expect(
        await prisma.searchZeroResultSeeker.count({ where: { queryNormalized: 'de la' } }),
      ).toBe(0);
    });

    it('l’état vide porte la proposition « Posez la question à la communauté ? »', async () => {
      const viewer = await member();
      const page = await search.search(viewer, {
        q: `absolumentrien${tag}`,
        limit: 20,
        period: 'all',
      });
      expect(page.items).toHaveLength(0);
      expect((page.meta as { zeroResult?: { prompt: string } }).zeroResult?.prompt).toBe(
        'Aucun résultat. Posez la question à la communauté ?',
      );
    });

    // ══ ARBITRAGE DU PORTEUR — un seuil de PERSONNES DISTINCTES ═════════════

    /**
     * LE RELEVÉ QUI A MOTIVÉ L'ARBITRAGE, ET SA CORRECTION, DANS UN SEUL TEST.
     *
     * `count` compte les RECHERCHES : un membre seul qui cherche trois fois y
     * inscrit `count: 3`. Un seuil posé sur `count` l'aurait donc laissé passer, et
     * c'est exactement ce que l'arbitrage veut empêcher — une recherche nominative
     * est presque toujours le fait d'une personne seule.
     *
     * LE CONTRE-EXEMPLE EST DANS LE TEST, et il est indispensable : la requête
     * d'une personne seule doit être ABSENTE, puis la MÊME requête doit apparaître
     * dès que le seuil est atteint. Sans le second temps, un `zeroResults` qui ne
     * rendrait jamais rien satisferait le premier.
     */
    it('[ARBITRAGE] n’affiche pas une requête cherchée par une seule personne, quel que soit `count`', async () => {
      const q = `Nominatif ${tag} Lyon`;
      const normalisee = normalizeQuery(q);
      const seul = await member();

      // Trois recherches, UNE personne.
      for (let i = 0; i < 3; i += 1) await search.recordZeroResult(seul, { q });

      const ligne = await prisma.searchZeroResult.findFirstOrThrow({
        where: { queryNormalized: normalisee },
        select: { count: true },
      });
      // Le relevé : le compteur de RECHERCHES est à trois…
      expect(ligne.count).toBe(3);
      // …et le nombre de PERSONNES est à un. Les deux faits sont distincts, et
      // les confondre est le défaut que ce lot a corrigé.
      expect(
        await prisma.searchZeroResultSeeker.count({ where: { queryNormalized: normalisee } }),
      ).toBe(1);

      const avant = await search.zeroResults({ weeks: 1, limit: 50 });
      expect(avant.items.map((i) => i.query)).not.toContain(normalisee);

      // On complète jusqu'au seuil, avec des membres DISTINCTS.
      for (let i = 1; i < SEARCH_ZERO_MIN_DISTINCT_SEEKERS; i += 1) {
        await search.recordZeroResult(await member(), { q });
      }

      const apres = await search.zeroResults({ weeks: 1, limit: 50 });
      const trouvee = apres.items.find((i) => i.query === normalisee);
      expect(trouvee).toBeDefined();
      expect(trouvee?.seekers).toBe(SEARCH_ZERO_MIN_DISTINCT_SEEKERS);
      // `count` garde son sens : trois recherches du premier membre, plus une par
      // membre ajouté.
      expect(trouvee?.count).toBe(3 + (SEARCH_ZERO_MIN_DISTINCT_SEEKERS - 1));
    });

    /**
     * LA TABLE DES PSEUDONYMES NE PORTE AUCUN IDENTIFIANT DE MEMBRE, et on le
     * vérifie sur les COLONNES — une ligne sans membre pourrait n'être qu'un oubli
     * d'écriture, une colonne absente ne peut rien porter.
     *
     * ET LES PSEUDONYMES NE SE RECOLLENT PAS EN PROFIL : la requête entre dans le
     * condensat, donc le MÊME membre porte deux pseudonymes différents sur deux
     * requêtes différentes. C'est ce qui distingue un pseudonyme d'un identifiant
     * déguisé, et c'est la seule assertion qui le dit.
     */
    it('[RÈGLE DURE] les pseudonymes ne nomment personne et ne se recollent pas entre requêtes', async () => {
      const colonnes = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'search_zero_result_seekers'`,
      );
      const noms = colonnes.map((c) => c.column_name);
      expect(noms).toEqual(
        expect.arrayContaining(['query_normalized', 'city_id', 'occurred_on', 'seeker_hash']),
      );
      expect(noms.some((n) => n.includes('user'))).toBe(false);
      expect(noms.some((n) => n.includes('member'))).toBe(false);

      const qui = await member();
      const unQ = `Premiere ${tag} requete`;
      const autreQ = `Seconde ${tag} requete`;
      await search.recordZeroResult(qui, { q: unQ });
      await search.recordZeroResult(qui, { q: autreQ });

      const un = await prisma.searchZeroResultSeeker.findFirstOrThrow({
        where: { queryNormalized: normalizeQuery(unQ) },
        select: { seekerHash: true },
      });
      const autre = await prisma.searchZeroResultSeeker.findFirstOrThrow({
        where: { queryNormalized: normalizeQuery(autreQ) },
        select: { seekerHash: true },
      });
      expect(un.seekerHash).not.toBe(autre.seekerHash);
      // Un HMAC-SHA256 en hexadécimal, et surtout pas l'identifiant du membre.
      expect(un.seekerHash).toMatch(/^[0-9a-f]{64}$/);
      expect(un.seekerHash).not.toContain(qui);
    });

    /**
     * LE PANNEAU DISPARAÎT QUAND IL NE RESTE RIEN. Une fenêtre sans aucune requête
     * au seuil rend une liste VIDE — et non la liste complète, ni une erreur. C'est
     * la réponse normale d'une semaine calme, et c'est le cas que le seuil rend
     * fréquent.
     */
    it('[ARBITRAGE] rend une liste vide quand aucune requête n’atteint le seuil', async () => {
      const seul = await member();
      await search.recordZeroResult(seul, { q: `Isolee ${tag} ${Date.now()}` });

      // Une ville sans aucun chercheur : le filtre ne peut rien trouver, et c'est
      // la forme vide qu'on éprouve — `items: []`, `nextCursor: null`.
      const vide = await search.zeroResults({ weeks: 1, cityId: otherCityId, limit: 50 });
      expect(vide.items).toEqual([]);
      expect(vide.nextCursor).toBeNull();
    });
  });

  // ══ Filtres, classement et pagination ════════════════════════════════════

  describe('filtres et pagination (§2.3)', () => {
    it('filtre par état, pour l’entraide seulement', async () => {
      const author = await member();
      const open = await helpRequest(author, `Etatouvert ${tag}`, 'corps', 'OPEN');
      const resolved = await helpRequest(author, `Etatouvert ${tag} bis`, 'corps', 'RESOLVED');
      await emit('help_request.published', open, { authorUserId: author, kind: 'REQUEST', cityId });
      await emit('help_request.resolved', resolved, { authorUserId: author, responseId: null, helperUserId: null });

      const openOnly = await search.search(author, {
        q: `Etatouvert ${tag}`,
        type: 'HELP_REQUEST',
        state: 'open',
        limit: 20,
        period: 'all',
      });
      const ids = (openOnly.items as { subjectId: string }[]).map((i) => i.subjectId);
      expect(ids).toContain(open);
      expect(ids).not.toContain(resolved);

      const resolvedOnly = await search.search(author, {
        q: `Etatouvert ${tag}`,
        type: 'HELP_REQUEST',
        state: 'resolved',
        limit: 20,
        period: 'all',
      });
      const ids2 = (resolvedOnly.items as { subjectId: string }[]).map((i) => i.subjectId);
      expect(ids2).toContain(resolved);
      expect(ids2).not.toContain(open);
    });

    it('filtre par ville, et le boost local ne FILTRE pas (§2.2)', async () => {
      const local = await member(cityId);
      const elsewhere = await member(otherCityId);
      const here = await helpRequest(local, `Villetest ${tag} ici`, 'corps', 'OPEN', cityId);
      const there = await helpRequest(elsewhere, `Villetest ${tag} ailleurs`, 'corps', 'OPEN', otherCityId);
      for (const id of [here, there]) {
        await emit('help_request.published', id, { authorUserId: local, kind: 'REQUEST', cityId });
      }

      // Sans filtre : LES DEUX sont là — le boost local classe, il n'exclut pas.
      const all = await findIds(local, `Villetest ${tag}`, 'HELP_REQUEST');
      expect(all).toContain(here);
      expect(all).toContain(there);
      // …et celui de la ville du lecteur passe devant.
      expect(all[0]).toBe(here);

      // Avec filtre de ville : seul celui de la ville.
      const filtered = await search.search(local, {
        q: `Villetest ${tag}`,
        type: 'HELP_REQUEST',
        cityId,
        limit: 20,
        period: 'all',
      });
      const ids = (filtered.items as { subjectId: string }[]).map((i) => i.subjectId);
      expect(ids).toEqual([here]);
    });

    it('pagine un onglet sans répéter ni perdre de ligne', async () => {
      const author = await member();
      const created: string[] = [];
      for (let i = 0; i < 9; i += 1) {
        const id = await helpRequest(author, `Pagination ${tag} numero ${i}`, `corps ${i}`);
        await emit('help_request.published', id, { authorUserId: author, kind: 'REQUEST', cityId });
        created.push(id);
      }

      // LE DÉFAUT QUE CECI ATTRAPE : le tri est le RANG, pas l'identifiant. Un
      // `buildPage` sans `sortOf` produit un curseur sur l'identifiant seul, et la
      // page suivante repart d'un mauvais endroit — des lignes se répètent, donc
      // d'autres se perdent.
      const seen = new Set<string>();
      let cursor: string | null = null;
      for (let page = 0; page < 10; page += 1) {
        const result = await search.search(author, {
          q: `Pagination ${tag}`,
          type: 'HELP_REQUEST',
          limit: 3,
          period: 'all',
          ...(cursor === null ? {} : { cursor }),
        });
        for (const item of result.items as { subjectId: string }[]) {
          expect(seen.has(item.subjectId)).toBe(false);
          seen.add(item.subjectId);
        }
        cursor = result.nextCursor;
        if (cursor === null) break;
      }
      for (const id of created) expect(seen.has(id)).toBe(true);
    });

    it('l’onglet « Tout » rend au plus trois résultats par type, avec un compteur', async () => {
      const author = await member();
      for (let i = 0; i < 5; i += 1) {
        const id = await helpRequest(author, `Groupetest ${tag} ${i}`);
        await emit('help_request.published', id, { authorUserId: author, kind: 'REQUEST', cityId });
      }
      const communityId = await community('PUBLIC');
      await join(communityId, author);
      const topicId = await topic(communityId, author, `Groupetest ${tag} sujet`);
      await emit('community.topic_created', topicId, { communityId, topicId, authorUserId: author });

      const page = await search.search(author, { q: `Groupetest ${tag}`, limit: 20, period: 'all' });
      const groups = page.items as { type: string; count: number; items: unknown[] }[];
      const help = groups.find((g) => g.type === 'HELP_REQUEST');
      expect(help?.items).toHaveLength(3);
      expect(help?.count).toBe(5);
      expect(groups.find((g) => g.type === 'TOPIC')?.count).toBe(1);
    });
  });

  // ══ Suggestions (§2.3) ═══════════════════════════════════════════════════

  describe('suggestions', () => {
    it('propose par préfixe, sans accent, et jamais un titre de réseau fermé', async () => {
      const author = await member();
      const id = await helpRequest(author, `Prefecture ${tag} rendez-vous`);
      await emit('help_request.published', id, { authorUserId: author, kind: 'REQUEST', cityId });

      const communityId = await community('ON_REQUEST');
      await join(communityId, author);
      const topicId = await topic(communityId, author, `Prefecture ${tag} sujet ferme`);
      await emit('community.topic_created', topicId, { communityId, topicId, authorUserId: author });

      const suggestions = await search.suggest(`Préfecture ${tag}`);
      const titles = suggestions.items.map((i) => i.title);
      expect(titles).toContain(`Prefecture ${tag} rendez-vous`);
      // Les suggestions sont MISES EN CACHE, donc partagées : un titre de réseau
      // fermé n'y entre jamais, même pour un membre. C'est le compromis assumé du
      // §2.3 — cache et visibilité par réseau sont incompatibles.
      expect(titles).not.toContain(`Prefecture ${tag} sujet ferme`);
      expect(suggestions.items.length).toBeLessThanOrEqual(6);
    });
  });

  // ══ Indexation : le cycle de vie du document ══════════════════════════════

  describe('indexation (§2.5)', () => {
    it('relit la SOURCE, donc supprime le document quand la source n’est plus éligible', async () => {
      const author = await member();
      const id = await helpRequest(author, `Cyclevie ${tag}`);
      await emit('help_request.published', id, { authorUserId: author, kind: 'REQUEST', cityId });
      expect(await prisma.searchDocument.count({ where: { subjectId: id } })).toBe(1);

      // La source devient inéligible : résolue depuis plus de 90 jours (§2.1).
      await prisma.helpRequest.update({
        where: { id },
        data: { status: 'RESOLVED', resolvedAt: new Date(Date.now() - 100 * 86_400_000) },
      });
      await emit('help_request.resolved', id, { authorUserId: author, responseId: null, helperUserId: null });
      expect(await prisma.searchDocument.count({ where: { subjectId: id } })).toBe(0);

      // Rejouer l'événement ne casse rien : la suppression est idempotente.
      await emit('help_request.resolved', id, { authorUserId: author, responseId: null, helperUserId: null });
      expect(await prisma.searchDocument.count({ where: { subjectId: id } })).toBe(0);
    });

    it('un rejeu ne crée pas de doublon — la contrainte d’unicité porte sur (type, sujet)', async () => {
      const author = await member();
      const id = await helpRequest(author, `Rejeu ${tag}`);
      for (let i = 0; i < 3; i += 1) {
        await emit('help_request.published', id, { authorUserId: author, kind: 'REQUEST', cityId });
      }
      expect(await prisma.searchDocument.count({ where: { subjectId: id } })).toBe(1);
    });

    it('un contenu masqué par la modération sort de l’index, et y revient rétabli', async () => {
      const author = await member();
      const id = await helpRequest(author, `Modere ${tag}`);
      await emit('help_request.published', id, { authorUserId: author, kind: 'REQUEST', cityId });

      // La modération n'écrit pas dans `help_requests` : le module 06 le fait en
      // s'abonnant. On simule donc son effet, puis on dispatche l'événement.
      await prisma.helpRequest.update({ where: { id }, data: { deletedAt: new Date() } });
      await emit('moderation.content_hidden', id, {
        subjectType: 'HELP_REQUEST',
        subjectId: id,
        authorUserId: author,
        caseId: newId(),
        automatic: true,
      });
      expect(await prisma.searchDocument.count({ where: { subjectId: id } })).toBe(0);

      await prisma.helpRequest.update({ where: { id }, data: { deletedAt: null } });
      await emit('moderation.content_restored', id, {
        subjectType: 'HELP_REQUEST',
        subjectId: id,
        authorUserId: author,
        caseId: newId(),
      });
      expect(await prisma.searchDocument.count({ where: { subjectId: id } })).toBe(1);
    });

    it('archiver un réseau retire ses sujets de l’index public', async () => {
      const author = await member();
      const stranger = await member();
      const communityId = await community('PUBLIC');
      await join(communityId, author);
      const topicId = await topic(communityId, author, `Archivetest ${tag}`);
      await emit('community.topic_created', topicId, { communityId, topicId, authorUserId: author });
      expect(await findIds(stranger, `archivetest ${tag}`, 'TOPIC')).toContain(topicId);

      await prisma.community.update({
        where: { id: communityId },
        data: { status: 'ARCHIVED', archivedAt: new Date() },
      });
      // La CASCADE : aucun événement ne concerne les sujets eux-mêmes, c'est
      // `community.archived` qui les fait tous relire.
      await emit('community.archived', communityId, { reason: 'INACTIVE', ownerUserId: author });
      expect(await prisma.searchDocument.count({ where: { subjectId: topicId } })).toBe(0);
    });

    it('la suppression de compte retire le document USER, et lui seul', async () => {
      const subject = await member();
      await prisma.userProfile.create({
        data: { userId: subject, occupationStatus: 'OTHER', availableToHelp: false, isPublic: true },
      });
      await search.reindexSubject('USER', subject);
      const helpId = await helpRequest(subject, `Survit ${tag}`);
      await emit('help_request.published', helpId, { authorUserId: subject, kind: 'REQUEST', cityId });

      await emit('user.deleted', subject, {});

      expect(await prisma.searchDocument.count({ where: { subjectType: 'USER', subjectId: subject } })).toBe(0);
      // §5 : « les autres documents de l'auteur suivent le sort de leur source ». Le
      // guide anonymisé reste publié (05 §2.8), donc le document reste — c'est au
      // module source de décider, pas à la recherche.
      expect(await prisma.searchDocument.count({ where: { subjectId: helpId } })).toBe(1);
    });

    it('la réindexation complète d’un type nettoie aussi les fantômes', async () => {
      const author = await member();
      const id = await helpRequest(author, `Reindex ${tag}`);
      await emit('help_request.published', id, { authorUserId: author, kind: 'REQUEST', cityId });

      // Un document ORPHELIN, comme en laisserait une source supprimée sans
      // événement (un script, une migration).
      const ghostId = newId();
      await search.upsertDocument({
        subjectType: 'HELP_REQUEST',
        subjectId: ghostId,
        title: `Fantome ${tag}`,
        bodyText: '',
        cityId: null,
        countryId: null,
        communityId: null,
        visibility: 'PUBLIC',
      });
      expect(await prisma.searchDocument.count({ where: { subjectId: ghostId } })).toBe(1);

      const result = await search.reindexType('HELP_REQUEST');
      expect(result.indexed).toBeGreaterThanOrEqual(1);
      expect(await prisma.searchDocument.count({ where: { subjectId: ghostId } })).toBe(0);
      expect(await prisma.searchDocument.count({ where: { subjectId: id } })).toBe(1);
    });
  });
});
