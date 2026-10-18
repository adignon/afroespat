import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { matchLocalRule } from '@app/shared';
import { AuditService } from '../../../common/audit.service';
import { OutboxService } from '../../../common/outbox.service';
import { PrismaService } from '../../../common/prisma.service';
import { VisibilityService } from '../../../common/visibility.service';
import type { AiModerationProvider, ModerationLabel } from '../../../providers/providers';
import { FeedService } from '../../feed/feed.service';
import { ModerationEffectsService } from '../moderation-effects.service';
import {
  type AiAnalysisJob,
  type ModerationQueuePort,
  ModerationService,
  type StaffContext,
  type SubjectType,
} from '../moderation.service';

/**
 * Le pipeline de modération sur TOUS les contenus publiés — lot G, 13 §2 et §6.
 *
 * Avant ce lot, `handleContentPublished` ne connaissait que l'entraide et
 * l'agenda : un guide, une annonce, une offre, une fiche, une astuce, un sujet de
 * réseau, une publication, un commentaire ou une story n'étaient jamais relus,
 * et même masqués par l'équipe ils restaient visibles (aucun module de contenu
 * ne consommait `moderation.content_hidden`, sauf le fil).
 *
 * Pour CHAQUE type, le test suit le chemin réel, sans réseau ni Redis :
 *   1. un contenu est écrit, comme son module le ferait ;
 *   2. `handleContentPublished` le relit et l'envoie au pipeline (file en
 *      mémoire qui exécute l'analyse tout de suite) ;
 *   3. l'IA fictive dit « arnaque, 0,9 » : dossier de priorité 1 + masquage
 *      automatique, c'est-à-dire un événement `moderation.content_hidden` ;
 *   4. cet événement est APPLIQUÉ (le fil pour POST/STORY/COMMENT, le service
 *      d'effets pour le reste) : le contenu sort de la lecture publique ;
 *   5. `content_restored` le rend ; `content_removed` le retire pour de bon.
 *
 * Chaque test vérifie d'abord sa PRÉMISSE (le contenu est visible avant) : un
 * test de masquage qui ne l'établit pas passerait aussi sur un contenu déjà
 * invisible.
 */
const TEST_TIMEOUT_MS = 120_000;

class SpyAi implements AiModerationProvider {
  next: { labels: ModerationLabel[]; score: number } = { labels: ['SCAM'], score: 0.9 };
  seen: string[] = [];
  classify(text: string) {
    this.seen.push(text);
    return Promise.resolve({ ...this.next, model: 'spy-v1', latencyMs: 2 });
  }
}

/** Une file qui exécute l'analyse sur-le-champ : le test n'attend ni worker ni Redis. */
class InlineQueue implements ModerationQueuePort {
  moderation: ModerationService | null = null;
  async enqueue(job: AiAnalysisJob): Promise<void> {
    await this.moderation?.analyze(job);
  }
}

const SCAM_TEXT = 'Paiement garanti à 100 % pour tout le monde, venez vite.';

describe('pipeline de modération — tous les contenus (13 §2, §6)', () => {
  let prisma: PrismaService;
  let moderation: ModerationService;
  let effects: ModerationEffectsService;
  let feed: FeedService;
  let ai: SpyAi;

  const run = Math.random().toString(36).slice(2, 8);
  let counter = 0;
  let countryId: string;
  let cityId: string;
  let authorId: string;
  let communityId: string;
  let professionId: string;

  const createdUsers: string[] = [];
  const createdStaff: string[] = [];
  const created: Record<string, string[]> = {};
  const track = (table: string, id: string): string => {
    (created[table] ??= []).push(id);
    return id;
  };

  async function member(): Promise<string> {
    counter += 1;
    const id = newId();
    await prisma.user.create({
      data: {
        id,
        handle: `pl${run}${counter}${id.slice(-6)}`,
        displayName: `Membre ${counter}`,
        phase: 'SETTLED',
        verificationLevel: 'L2',
        originCountryId: countryId,
        cityId,
        plan: 'FREE',
        status: 'ACTIVE',
      },
    });
    createdUsers.push(id);
    return id;
  }

  async function staffAccount(role: StaffContext['role'], isActive = true): Promise<StaffContext> {
    counter += 1;
    const id = newId();
    await prisma.staffUser.create({
      data: {
        id,
        email: `pl-${run}-${counter}@equipe.test`,
        displayName: `Équipe ${role} ${counter}`,
        passwordHash: 'argon2id$factice',
        totpSecretEncrypted: Buffer.from([0]),
        role,
        isActive,
      },
    });
    createdStaff.push(id);
    return { staffId: id, role };
  }

  /** Écrit un contenu du type demandé, tel que son module l'écrirait. */
  const makers: Record<string, (text: string) => Promise<string>> = {
    POST: async (text) => {
      const id = newId();
      await prisma.post.create({
        data: { id, authorUserId: authorId, type: 'DISCUSSION', body: text, status: 'PUBLISHED', moderationStatus: 'PENDING' },
      });
      return track('post', id);
    },
    STORY: async (text) => {
      const id = newId();
      await prisma.story.create({
        data: {
          id,
          authorUserId: authorId,
          type: 'CONSEIL',
          body: text,
          textStyle: 'BOLD',
          cityId,
          expiresAt: new Date(Date.now() + 86_400_000),
          audience: 'ALL',
          allowMessages: false,
          status: 'ACTIVE',
          moderationStatus: 'PENDING',
        },
      });
      return track('story', id);
    },
    COMMENT: async (text) => {
      const postId = await makers['POST']!('Une publication saine pour recevoir un commentaire.');
      const id = newId();
      await prisma.comment.create({
        data: { id, subjectType: 'POST', subjectId: postId, authorUserId: authorId, body: text, status: 'PUBLISHED' },
      });
      return track('comment', id);
    },
    GUIDE: async (text) => {
      const id = newId();
      await prisma.guide.create({
        data: {
          id,
          authorUserId: authorId,
          title: `Guide de test ${run}${counter++}`,
          slug: `guide-test-${run}-${id.slice(-8)}`,
          category: 'ARRIVAL',
          scope: 'UNIVERSAL',
          status: 'PUBLISHED',
          lastContentUpdateAt: new Date(),
        },
      });
      const pageId = newId();
      await prisma.guidePage.create({
        data: { id: pageId, guideId: id, position: 1, title: 'Page', slug: `page-${id.slice(-8)}` },
      });
      const versionId = newId();
      await prisma.guideVersion.create({ data: { id: versionId, guideId: id, version: 1, body: text } });
      await prisma.guidePage.update({ where: { id: pageId }, data: { currentVersionId: versionId } });
      return track('guide', id);
    },
    HOUSING: async (text) => {
      const id = newId();
      await prisma.housingListing.create({
        data: {
          id,
          authorUserId: authorId,
          kind: 'RENT',
          title: 'Studio à louer',
          description: text,
          cityId,
          status: 'ACTIVE',
          moderationStatus: 'CLEARED',
          expiresAt: new Date(Date.now() + 30 * 86_400_000),
        },
      });
      return track('housing', id);
    },
    JOB: async (text) => {
      const id = newId();
      await prisma.jobListing.create({
        data: {
          id,
          authorUserId: authorId,
          kind: 'JOB',
          title: 'Aide à domicile',
          description: text,
          status: 'ACTIVE',
          expiresAt: new Date(Date.now() + 30 * 86_400_000),
        },
      });
      return track('job', id);
    },
    PRO: async (text) => {
      const owner = await member();
      const id = newId();
      await prisma.proProfile.create({
        data: {
          id,
          userId: owner,
          professionId,
          description: text,
          contactMethod: 'PLATFORM_MESSAGE',
          verificationStatus: 'APPROVED',
          tier: 'FREE',
          status: 'ACTIVE',
        },
      });
      return track('pro', id);
    },
    CITY_TIP: async (text) => {
      const id = newId();
      await prisma.cityTip.create({
        data: { id, cityId, authorUserId: authorId, kind: 'TIP', body: text, status: 'PUBLISHED' },
      });
      return track('tip', id);
    },
    TOPIC: async (text) => {
      const id = newId();
      await prisma.topic.create({
        data: {
          id,
          communityId,
          authorUserId: authorId,
          title: 'Un sujet de réseau',
          body: text,
          status: 'OPEN',
          pinKind: 'NONE',
        },
      });
      return track('topic', id);
    },
  };

  /** Ce que la lecture publique de chaque type regarde pour DIRE « visible ». */
  async function visible(type: string, id: string): Promise<boolean> {
    switch (type) {
      case 'POST': return (await prisma.post.findUniqueOrThrow({ where: { id } })).status === 'PUBLISHED';
      case 'STORY': return (await prisma.story.findUniqueOrThrow({ where: { id } })).status === 'ACTIVE';
      case 'COMMENT': return (await prisma.comment.findUniqueOrThrow({ where: { id } })).status === 'PUBLISHED';
      case 'GUIDE': return (await prisma.guide.findUniqueOrThrow({ where: { id } })).status === 'PUBLISHED';
      case 'HOUSING': {
        const r = await prisma.housingListing.findUniqueOrThrow({ where: { id } });
        return r.status !== 'REMOVED' && r.moderationStatus !== 'PENDING';
      }
      case 'JOB': return (await prisma.jobListing.findUniqueOrThrow({ where: { id } })).status === 'ACTIVE';
      case 'PRO': return (await prisma.proProfile.findUniqueOrThrow({ where: { id } })).status === 'ACTIVE';
      case 'CITY_TIP': return (await prisma.cityTip.findUniqueOrThrow({ where: { id } })).status === 'PUBLISHED';
      case 'TOPIC': return (await prisma.topic.findUniqueOrThrow({ where: { id } })).deletedAt === null;
      default: throw new Error(`type inconnu ${type}`);
    }
  }

  /** Applique un événement comme le relais le ferait : le fil d'abord, puis les effets. */
  async function applyEvent(effect: 'hidden' | 'restored' | 'removed', payload: unknown): Promise<void> {
    if (effect === 'hidden') await feed.handleContentHidden(payload);
    await effects.apply(effect, payload);
  }

  async function lastEvent(type: string, id: string) {
    const rows = await prisma.domainEvent.findMany({
      where: { aggregateId: id, type },
      orderBy: { occurredAt: 'desc' },
    });
    return rows[0] ?? null;
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    ai = new SpyAi();
    const queue = new InlineQueue();
    moderation = new ModerationService(prisma, new OutboxService(prisma), new AuditService(prisma), ai, queue);
    queue.moderation = moderation;
    effects = new ModerationEffectsService(prisma);
    feed = new FeedService(prisma, new OutboxService(prisma), new AuditService(prisma), new VisibilityService(prisma));

    const country = await prisma.country.findFirstOrThrow({
      where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } },
      select: { id: true },
    });
    countryId = country.id;
    cityId = (await prisma.city.findFirstOrThrow({ where: { slug: 'paris' }, select: { id: true } })).id;
    authorId = await member();
    professionId = (await prisma.profession.findFirstOrThrow({ select: { id: true } })).id;
    communityId = newId();
    await prisma.community.create({
      data: {
        id: communityId,
        kind: 'INTEREST',
        name: `Réseau pipeline ${run}`,
        slug: `reseau-pipeline-${run}`,
        visibility: 'PUBLIC',
        status: 'ACTIVE',
        lastActivityAt: new Date(),
      },
    });
  }, TEST_TIMEOUT_MS);

  afterAll(async () => {
    const del = async (fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch {
        /* le nettoyage ne doit pas masquer l'échec d'un test */
      }
    };
    await del(() => prisma.comment.deleteMany({ where: { id: { in: created['comment'] ?? [] } } }));
    await del(() => prisma.post.deleteMany({ where: { id: { in: created['post'] ?? [] } } }));
    await del(() => prisma.story.deleteMany({ where: { id: { in: created['story'] ?? [] } } }));
    await del(() => prisma.guidePage.updateMany({ where: { guideId: { in: created['guide'] ?? [] } }, data: { currentVersionId: null } }));
    await del(() => prisma.guideVersion.deleteMany({ where: { guideId: { in: created['guide'] ?? [] } } }));
    await del(() => prisma.guidePage.deleteMany({ where: { guideId: { in: created['guide'] ?? [] } } }));
    await del(() => prisma.guide.deleteMany({ where: { id: { in: created['guide'] ?? [] } } }));
    await del(() => prisma.housingListing.deleteMany({ where: { id: { in: created['housing'] ?? [] } } }));
    await del(() => prisma.jobListing.deleteMany({ where: { id: { in: created['job'] ?? [] } } }));
    await del(() => prisma.proProfile.deleteMany({ where: { id: { in: created['pro'] ?? [] } } }));
    await del(() => prisma.cityTip.deleteMany({ where: { id: { in: created['tip'] ?? [] } } }));
    await del(() => prisma.topic.deleteMany({ where: { id: { in: created['topic'] ?? [] } } }));
    await del(() => prisma.community.deleteMany({ where: { id: communityId } }));
    await del(() => prisma.moderationHide.deleteMany({}));
    await del(() => prisma.user.deleteMany({ where: { id: { in: createdUsers } } }));
    // Ni `moderation_cases` ni `moderation_actions` ni `staff_users` : la base le refuse.
    await prisma.$disconnect();
  });

  // ══ UN TEST PAR TYPE DE CONTENU ═══════════════════════════════════════════

  const TYPES = ['POST', 'COMMENT', 'STORY', 'GUIDE', 'HOUSING', 'JOB', 'PRO', 'CITY_TIP', 'TOPIC'] as const;

  for (const type of TYPES) {
    describe(`${type}`, () => {
      it(
        'relu depuis sa table, analysé, masqué, rétabli puis retiré',
        async () => {
          ai.next = { labels: ['SCAM'], score: 0.9 };
          const id = await makers[type]!(SCAM_TEXT);
          // PRÉMISSE : visible avant tout.
          expect(await visible(type, id)).toBe(true);

          ai.seen = [];
          await moderation.handleContentPublished(type as SubjectType, id);

          // Le texte a bien été relu et envoyé à l'IA (masqué, §2.2).
          expect(ai.seen.some((t) => t.includes('garanti'))).toBe(true);
          const dossier = await prisma.moderationCase.findFirst({
            where: { subjectType: type, subjectId: id },
          });
          expect(dossier, 'un dossier doit exister').not.toBeNull();
          expect(dossier?.priority).toBe(1);

          const hidden = await lastEvent('moderation.content_hidden', id);
          expect(hidden, 'l’événement de masquage doit être émis').not.toBeNull();
          expect((hidden!.payload as { automatic?: boolean }).automatic).toBe(true);

          // APPLIQUER l'événement : le contenu sort de la lecture publique.
          await applyEvent('hidden', hidden!.payload);
          expect(await visible(type, id)).toBe(false);
          // Idempotent : un rejeu ne casse rien.
          await applyEvent('hidden', hidden!.payload);
          expect(await visible(type, id)).toBe(false);

          // Rétablir : le contenu revient.
          await applyEvent('restored', hidden!.payload);
          expect(await visible(type, id)).toBe(true);

          // Retirer : définitif, et un rétablissement ne le ressuscite pas.
          await applyEvent('hidden', hidden!.payload);
          await applyEvent('removed', hidden!.payload);
          expect(await visible(type, id)).toBe(false);
          await applyEvent('restored', hidden!.payload);
          expect(await visible(type, id)).toBe(false);
        },
        TEST_TIMEOUT_MS,
      );

      it(
        'laisse en paix un texte sain : ni dossier, ni masquage',
        async () => {
          ai.next = { labels: ['OK'], score: 0.05 };
          const id = await makers[type]!('Bonjour à toutes et à tous, voici une information utile et sans danger.');
          await moderation.handleContentPublished(type as SubjectType, id);
          expect(await prisma.moderationCase.count({ where: { subjectType: type, subjectId: id } })).toBe(0);
          expect(await lastEvent('moderation.content_hidden', id)).toBeNull();
          expect(await visible(type, id)).toBe(true);
        },
        TEST_TIMEOUT_MS,
      );
    });
  }

  // ══ LES RÈGLES TRANSVERSES ════════════════════════════════════════════════

  it(
    'une règle locale qui mord APRÈS la publication ouvre un dossier de priorité 1 ET masque',
    async () => {
      const text = 'Envoyez-moi 50 € sur mon compte et je vous réponds.';
      expect(matchLocalRule(text)).toBe('MONEY_REQUEST');
      const id = await makers['CITY_TIP']!(text);
      expect(await visible('CITY_TIP', id)).toBe(true);

      await moderation.handleContentPublished('CITY_TIP', id);

      const dossier = await prisma.moderationCase.findFirst({ where: { subjectType: 'CITY_TIP', subjectId: id } });
      expect(dossier?.priority).toBe(1);
      const hidden = await lastEvent('moderation.content_hidden', id);
      expect(hidden).not.toBeNull();
      await applyEvent('hidden', hidden!.payload);
      expect(await visible('CITY_TIP', id)).toBe(false);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'rétablir un contenu que LA MODÉRATION n’a pas masqué ne le ressuscite pas',
    async () => {
      // Un sujet supprimé par son auteur (`deleted_at`), puis un `DISMISS`
      // (qui émet `content_restored`) : aucune note dans `moderation_hides`.
      const id = await makers['TOPIC']!('Un sujet que son auteur supprime lui-même.');
      await prisma.topic.update({ where: { id }, data: { deletedAt: new Date() } });
      const changed = await effects.apply('restored', { subjectType: 'TOPIC', subjectId: id });
      expect(changed.changed).toBe(0);
      expect((await prisma.topic.findUniqueOrThrow({ where: { id } })).deletedAt).not.toBeNull();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'un blocage de risque posé AVANT n’est pas levé par un rétablissement (annonce)',
    async () => {
      const id = await makers['HOUSING']!(SCAM_TEXT);
      await prisma.housingListing.update({ where: { id }, data: { moderationStatus: 'PENDING' } });
      const payload = { subjectType: 'HOUSING', subjectId: id };
      // Masquer note l'état d'avant (`PENDING` : déjà retenue pour risque)…
      expect((await effects.apply('hidden', payload)).changed).toBe(1);
      // … et rétablir remet CET état, pas `CLEARED`.
      await effects.apply('restored', payload);
      expect((await prisma.housingListing.findUniqueOrThrow({ where: { id } })).moderationStatus).toBe('PENDING');
    },
    TEST_TIMEOUT_MS,
  );

  it('ignore sans lever un type de sujet sans champ de masquage et une charge illisible', async () => {
    expect((await effects.apply('hidden', { subjectType: 'MESSAGE', subjectId: newId() })).changed).toBe(0);
    expect((await effects.apply('hidden', { subjectType: 'GUIDE', subjectId: 'pas-un-uuid' })).changed).toBe(0);
    expect((await effects.apply('hidden', null)).changed).toBe(0);
  });

  // ══ moderation.sla_alert : l'équipe est réellement prévenue ═══════════════

  it(
    'moderation.sla_alert écrit UNE alerte par compte actif habilité et par dossier en retard',
    async () => {
      const modA = await staffAccount('MODERATOR');
      const admin = await staffAccount('CONTENT_ADMIN');
      const support = await staffAccount('SUPPORT');
      const inactive = await staffAccount('MODERATOR', false);

      // Un dossier de priorité 1 qui dépasse son délai de 4 h.
      const subjectId = newId();
      const caseId = await moderation.openCase({
        subjectType: 'CITY_TIP',
        subjectId,
        subjectAuthorUserId: authorId,
        source: 'AUTO_RULE',
        priority: 1,
        note: 'Alerte SLA (test).',
      });
      const later = new Date(Date.now() + 5 * 3_600_000);

      const overdue = await moderation.alertOverdueUrgentCases(later);
      expect(overdue.map((c) => c.id)).toContain(caseId);

      const mine = await moderation.listStaffAlerts(modA);
      const alert = mine.items.find((a) => a.caseId === caseId);
      expect(alert, 'le modérateur doit avoir son alerte').toBeDefined();
      expect(alert?.kind).toBe('SLA_BREACH');
      expect(alert?.read).toBe(false);
      expect(mine.unread).toBeGreaterThanOrEqual(1);
      expect((await moderation.listStaffAlerts(admin)).items.some((a) => a.caseId === caseId)).toBe(true);
      // Le support n'est pas habilité (rôle refusé) ; un compte inactif n'est pas prévenu.
      await expect(moderation.listStaffAlerts(support)).rejects.toBeDefined();
      expect(await prisma.staffAlert.count({ where: { staffId: inactive.staffId } })).toBe(0);

      // Rejouable : un second passage n'écrit pas de doublon.
      const before = await prisma.staffAlert.count({ where: { refId: caseId } });
      await moderation.alertOverdueUrgentCases(later);
      expect(await prisma.staffAlert.count({ where: { refId: caseId } })).toBe(before);

      // Lire SON alerte la marque ; celle d'un autre compte est introuvable.
      await moderation.markStaffAlertRead(modA, alert!.id);
      expect((await moderation.listStaffAlerts(modA)).items.find((a) => a.id === alert!.id)?.read).toBe(true);
      await expect(moderation.markStaffAlertRead(admin, alert!.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });

      // Hors délai : rien de nouveau avant l'échéance.
      const fresh = await moderation.openCase({
        subjectType: 'CITY_TIP',
        subjectId: newId(),
        subjectAuthorUserId: authorId,
        source: 'AUTO_RULE',
        priority: 1,
        note: 'Pas encore en retard.',
      });
      await moderation.alertOverdueUrgentCases(new Date());
      expect(await prisma.staffAlert.count({ where: { refId: fresh } })).toBe(0);
    },
    TEST_TIMEOUT_MS,
  );
});
