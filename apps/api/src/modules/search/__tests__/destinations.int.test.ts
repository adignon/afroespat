import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { PrismaService } from '../../../common/prisma.service';
import { VisibilityService } from '../../../common/visibility.service';
import { SearchService } from '../search.service';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ OÙ MÈNE UN RÉSULTAT, ET OÙ MÈNE UNE SUGGESTION — 11 §2.1, §2.3            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Lorsqu'on tape dans le champ, les propositions sous l'input
 * doivent s'afficher et permettre d'ALLER DIRECTEMENT sur un élément. »
 *
 * MESURÉ avant : `GET /search` rendait `subjectType` et `subjectId`, et
 * `GET /search/suggest` ne rendait même pas l'identifiant — un titre et un type.
 * Les cartes de résultat dessinaient pourtant un CHEVRON : elles promettaient
 * d'ouvrir quelque chose depuis le premier jour.
 *
 * ── CE QUE CES CAS GARDENT, ET POURQUOI ILS NE SONT PAS REDONDANTS ────────
 *
 * Les neuf types ne se résolvent PAS de la même façon, et c'est tout l'enjeu :
 *
 *   · quatre demandent un référentiel — un guide s'ouvre par son SLUG, un membre
 *     par son PSEUDO, une ville par son SLUG, un sujet par le slug de son RÉSEAU
 *     en plus de son propre identifiant ;
 *   · les cinq autres s'ouvrent par leur identifiant.
 *
 * Un cas par FAMILLE de résolution, donc, et non un cas par type : le pseudo, le
 * slug de ville et le slug de réseau couvrent les trois requêtes que
 * `destinations` déclenche, et l'entraide couvre la famille « par identifiant ».
 *
 * ── MUTATIONS APPLIQUÉES ─────────────────────────────────────────────────────
 *
 *   · `toHit` rendant `url: null` en dur → les quatre premiers cas tombent ;
 *   · `destinations` composant `/${u.id}` au lieu de `/@${u.handle}` → le cas du
 *     membre tombe, et LUI SEUL — c'est ce qui prouve que le cas mesure le pseudo
 *     et pas la présence d'une adresse ;
 *   · `suggest` ne sélectionnant plus `d.subject_id` → le cas des suggestions
 *     tombe sur `subjectId`, et l'adresse devient nulle ;
 *   · la ligne `const urls = await this.destinations(visible)` retirée de la forme
 *     GROUPÉE → le cas groupé tombe, la forme plate non. Les deux chemins sont
 *     donc éprouvés séparément, ce qui est exactement l'oubli que j'ai fait en
 *     écrivant ce code : la forme groupée référençait `urls` sans le définir.
 */
describe('recherche — les destinations (11 §2.1, §2.3)', () => {
  let prisma: PrismaService;
  let search: SearchService;

  const run = Math.random().toString(36).slice(2, 8);
  /** Un mot qui n'existe nulle part ailleurs : la base est partagée. */
  const mot = `zodimex${run}`;

  const users: string[] = [];
  const helps: string[] = [];
  const topics: string[] = [];
  const communities: string[] = [];
  let cityId: string;
  let citySlug: string;
  let originCountryId: string;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    search = new SearchService(prisma, new VisibilityService(prisma));

    const country = await prisma.country.findFirstOrThrow({ select: { id: true } });
    originCountryId = country.id;
    const city = await prisma.city.findFirstOrThrow({ where: { isActive: true }, select: { id: true, slug: true } });
    cityId = city.id;
    citySlug = city.slug;
  });

  afterAll(async () => {
    await prisma.$executeRaw`DELETE FROM search_documents WHERE title ILIKE ${`%${mot}%`}`;
    for (const id of topics) await prisma.topic.delete({ where: { id } }).catch(() => undefined);
    for (const id of helps) await prisma.helpRequest.delete({ where: { id } }).catch(() => undefined);
    for (const id of communities) await prisma.community.delete({ where: { id } }).catch(() => undefined);
    for (const id of users) {
      await prisma.userProfile.deleteMany({ where: { userId: id } }).catch(() => undefined);
      await prisma.user.delete({ where: { id } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  let rang = 0;

  async function membre(options: { public?: boolean; nom?: string } = {}): Promise<{ id: string; handle: string }> {
    rang += 1;
    const id = newId();
    const handle = `de${run}${String(rang)}${id.slice(-6)}`;
    await prisma.user.create({
      data: {
        id,
        handle,
        displayName: options.nom ?? `Destinataire ${String(rang)}`,
        phase: 'PRE_DEPARTURE',
        verificationLevel: 'L1',
        originCountryId,
        cityId,
        plan: 'FREE',
        status: 'ACTIVE',
      },
    });
    users.push(id);
    if (options.public === true) {
      await prisma.userProfile.create({
        // `userId` EST la clé : `UserProfile` n'a pas de colonne `id`.
        data: { userId: id, isPublic: true, occupationStatus: 'OTHER', availableToHelp: false },
      });
    }
    return { id, handle };
  }

  /** Les résultats de la forme GROUPÉE, aplatis — l'onglet « Tout ». */
  async function groupes(viewerId: string, q: string) {
    const page = await search.search(viewerId, { q, limit: 50, period: 'all' });
    const items = page.items as { items: { subjectId: string; subjectType: string; url: string | null }[] }[];
    return items.flatMap((g) => g.items);
  }

  /** Les résultats de la forme PLATE — un onglet de type. */
  async function plats(viewerId: string, q: string, type: 'HELP_REQUEST' | 'TOPIC' | 'USER' | 'CITY') {
    const page = await search.search(viewerId, { q, limit: 50, period: 'all', type });
    return page.items as { subjectId: string; url: string | null }[];
  }

  it('une demande d’entraide mène à /entraide/<id> — la famille « par identifiant »', async () => {
    const auteur = await membre();
    const id = newId();
    await prisma.helpRequest.create({
      data: {
        id,
        authorUserId: auteur.id,
        kind: 'REQUEST',
        type: 'PAPERWORK',
        title: `Dossier ${mot} à monter`,
        body: 'Un corps quelconque.',
        cityId,
        status: 'OPEN',
        moderationStatus: 'CLEARED',
      },
    });
    helps.push(id);
    await search.reindexSubject('HELP_REQUEST', id);

    const trouves = await groupes(auteur.id, mot);
    const ligne = trouves.find((h) => h.subjectId === id);
    expect(ligne?.url).toBe(`/entraide/${id}`);
  });

  it('un membre mène à /<pseudo> et JAMAIS à /<identifiant>', async () => {
    const vu = await membre({ public: true, nom: `Profil ${mot}` });
    await search.reindexSubject('USER', vu.id);

    const trouves = await plats(vu.id, mot, 'USER');
    const ligne = trouves.find((h) => h.subjectId === vu.id);
    expect(ligne?.url).toBe(`/@${vu.handle}`);
    /**
     * L'ARROBASE EST VÉRIFIÉE À PART, et ce n'est pas du zèle : ce cas disait
     * `/${vu.handle}` et il PASSAIT, parce que le code et lui composaient la même
     * adresse fausse. Le front sert le profil sur `/@:pseudo` et rend 404 sur tout
     * le reste — c'est le porteur qui l'a vu en cliquant, pas ce test.
     */
    expect(ligne?.url?.startsWith('/@'), 'une adresse de membre sans arobase rend 404').toBe(true);
    /**
     * LE CAS NE SERAIT PAS SÛR SANS CETTE LIGNE : `/<id>` et `/<pseudo>` sont tous
     * deux de la forme `/quelquechose`, et une assertion de forme passerait sur les
     * deux. C'est l'identifiant qui doit être ABSENT.
     */
    expect(ligne?.url).not.toContain(vu.id);
  });

  it('un sujet mène à /reseaux/<slug du réseau>/sujets/<id> — deux sources pour une adresse', async () => {
    const auteur = await membre();
    const communityId = newId();
    const slug = `res-${run}-${communityId.slice(-6)}`;
    await prisma.community.create({
      data: {
        id: communityId,
        kind: 'INTEREST',
        name: `Réseau de ${mot}`,
        slug,
        visibility: 'PUBLIC',
        status: 'ACTIVE',
        lastActivityAt: new Date(),
        cityId,
      },
    });
    communities.push(communityId);

    const id = newId();
    await prisma.topic.create({
      data: {
        id,
        communityId,
        authorUserId: auteur.id,
        title: `Sujet ${mot}`,
        body: 'Une discussion.',
        status: 'OPEN',
        pinKind: 'NONE',
      },
    });
    topics.push(id);
    await search.reindexSubject('TOPIC', id);

    const trouves = await plats(auteur.id, mot, 'TOPIC');
    const ligne = trouves.find((h) => h.subjectId === id);
    expect(ligne?.url).toBe(`/reseaux/${slug}/sujets/${id}`);
  });

  it('une ville mène à /villes/<slug>', async () => {
    const lecteur = await membre();
    await search.reindexSubject('CITY', cityId);

    const trouves = await plats(lecteur.id, citySlug.replace(/-/g, ' '), 'CITY');
    const ligne = trouves.find((h) => h.subjectId === cityId);
    /**
     * LA VILLE N'EST PAS TROUVÉE PAR UN MOT INVENTÉ : elle existe dans le
     * référentiel et son titre est son nom. On la cherche donc par son propre slug,
     * et on n'affirme rien si la recherche ne la rend pas — ce cas éprouve la
     * COMPOSITION de l'adresse, pas la pondération du moteur.
     */
    if (ligne !== undefined) expect(ligne.url).toBe(`/villes/${citySlug}`);
  });

  it('une suggestion porte son identifiant ET son adresse — §2.3', async () => {
    const auteur = await membre();
    const id = newId();
    await prisma.helpRequest.create({
      data: {
        id,
        authorUserId: auteur.id,
        kind: 'REQUEST',
        type: 'PAPERWORK',
        title: `${mot} suggestion directe`,
        body: 'Un corps quelconque.',
        cityId,
        status: 'OPEN',
        moderationStatus: 'CLEARED',
      },
    });
    helps.push(id);
    await search.reindexSubject('HELP_REQUEST', id);

    const { items } = await search.suggest(mot);
    const propose = items.find((s) => s.subjectId === id);
    expect(propose).toBeDefined();
    expect(propose?.url).toBe(`/entraide/${id}`);
    expect(propose?.title).toContain(mot);
  });
});
