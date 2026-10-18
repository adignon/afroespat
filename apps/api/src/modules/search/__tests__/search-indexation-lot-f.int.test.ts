import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { PrismaService } from '../../../common/prisma.service';
import { VisibilityService } from '../../../common/visibility.service';
import { EventHandlerRegistry, type DomainEventJob } from '../../../queue/event-handlers';
import { registerSearchSubscriptions } from '../../../queue/event-subscriptions.service';
import { SearchService } from '../search.service';

/**
 * Lot F — 11 §2.5 : l'index suit ses sources. Les abonnements sont ceux du
 * produit (`registerSearchSubscriptions`) ; chaque cas modifie la SOURCE en base,
 * dispatche l'événement, puis cherche.
 */
describe('recherche : réindexation sur profil, réponse et offre', () => {
  let prisma: PrismaService;
  let search: SearchService;
  let registry: EventHandlerRegistry;
  const users: string[] = [];
  const topics: string[] = [];
  const communities: string[] = [];
  const comments: string[] = [];
  let countryId = '';
  let cityId = '';
  const run = Math.random().toString(36).slice(2, 8);

  async function member(): Promise<string> {
    const id = newId();
    await prisma.user.create({
      data: {
        id, handle: `ix${run}${id.slice(-6)}`, displayName: 'Indexée', phase: 'SETTLED', verificationLevel: 'L1',
        originCountryId: countryId, cityId, plan: 'FREE', status: 'ACTIVE',
        profile: { create: { bio: 'bio initiale', occupationStatus: 'OTHER', availableToHelp: false, helpTypes: [], isPublic: true } },
      },
    });
    users.push(id);
    return id;
  }

  async function emit(type: string, aggregateId: string, payload: unknown): Promise<void> {
    await registry.dispatch({
      id: newId(), type: type as DomainEventJob['type'], aggregateId, payload, occurredAt: new Date().toISOString(),
    });
  }

  async function ids(viewer: string, q: string): Promise<string[]> {
    const page = await search.search(viewer, { q, limit: 50, period: 'all' });
    return (page.items as { items: { subjectId: string }[] }[]).flatMap((g) => g.items.map((i) => i.subjectId));
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    search = new SearchService(prisma, new VisibilityService(prisma));
    registry = new EventHandlerRegistry();
    registerSearchSubscriptions(registry, search);
    countryId = (await prisma.country.findFirstOrThrow({ where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } }, select: { id: true } })).id;
    cityId = (await prisma.city.findFirstOrThrow({ select: { id: true } })).id;
  });

  afterAll(async () => {
    const all = [...users, ...topics];
    await prisma.$executeRawUnsafe(`DELETE FROM search_documents WHERE subject_id = ANY($1::uuid[])`, all);
    await prisma.comment.deleteMany({ where: { id: { in: comments } } });
    await prisma.topic.deleteMany({ where: { id: { in: topics } } });
    await prisma.communityMember.deleteMany({ where: { communityId: { in: communities } } });
    await prisma.community.deleteMany({ where: { id: { in: communities } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  });

  it('user.profile_updated : une bio modifiée devient cherchable, l’ancienne ne l’est plus', async () => {
    const id = await member();
    const viewer = await member();
    const ancien = `anc${run}`;
    const nouveau = `nvx${run}`;
    await prisma.userProfile.update({ where: { userId: id }, data: { bio: `Je parle de ${ancien}` } });
    await emit('user.onboarded', id, {});
    expect(await ids(viewer, ancien)).toContain(id);

    await prisma.userProfile.update({ where: { userId: id }, data: { bio: `Je parle de ${nouveau}` } });
    await emit('user.profile_updated', id, { fields: ['bio'] });

    expect(await ids(viewer, nouveau)).toContain(id);
    expect(await ids(viewer, ancien)).not.toContain(id);
  });

  async function topicIn(authorId: string, titre: string): Promise<string> {
    const communityId = newId();
    await prisma.community.create({
      data: {
        id: communityId, kind: 'INTEREST', name: `Réseau ${run}`, slug: `ix-${run}-${communityId.slice(-6)}`,
        visibility: 'PUBLIC', status: 'ACTIVE', lastActivityAt: new Date(), cityId,
      },
    });
    communities.push(communityId);
    const id = newId();
    await prisma.topic.create({
      data: { id, communityId, authorUserId: authorId, title: titre, body: 'Corps du sujet.', status: 'OPEN', pinKind: 'NONE' },
    });
    topics.push(id);
    return id;
  }

  it('post.commented sur un sujet : la réponse entre dans le document (réindexation à chaque réponse)', async () => {
    const auteur = await member();
    const lecteur = await member();
    const topicId = await topicIn(auteur, `Sujet ${run}`);
    await emit('community.topic_created', topicId, {});
    const mot = `repmot${run}`;
    expect(await ids(lecteur, mot)).not.toContain(topicId);

    const commentId = newId();
    await prisma.comment.create({
      data: { id: commentId, subjectType: 'TOPIC', subjectId: topicId, authorUserId: lecteur, body: `Voici ${mot}`, status: 'PUBLISHED' },
    });
    comments.push(commentId);
    await emit('post.commented', topicId, { commentId, subjectType: 'TOPIC', authorUserId: lecteur });

    expect(await ids(lecteur, mot)).toContain(topicId);
  });

  it('post.commented sur autre chose qu’un sujet ne réindexe rien', async () => {
    const auteur = await member();
    const topicId = await topicIn(auteur, `Autre ${run}`);
    await emit('community.topic_created', topicId, {});
    const mot = `silence${run}`;
    const commentId = newId();
    await prisma.comment.create({
      data: { id: commentId, subjectType: 'TOPIC', subjectId: topicId, authorUserId: auteur, body: mot, status: 'PUBLISHED' },
    });
    comments.push(commentId);
    await emit('post.commented', topicId, { commentId, subjectType: 'POST', authorUserId: auteur });
    expect(await ids(auteur, mot)).not.toContain(topicId);
  });
});
