import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import { AuditService } from '../../../common/audit.service';
import { CryptoService } from '../../../common/crypto.service';
import { OutboxService } from '../../../common/outbox.service';
import { PrismaService } from '../../../common/prisma.service';
import { VisibilityService } from '../../../common/visibility.service';
import { BlocksService } from '../../blocks/blocks.service';
import { ConnectionsService } from '../../connections/connections.service';
import { MessagingService } from '../messaging.service';

/**
 * Lot F2 — la conversation bloquée et les messages système.
 *
 * ── LA CONVERSATION BLOQUÉE (M01BLOQUE, « Débloquer ») ──────────────────────
 *
 * Le blocage ferme la DIRECT des deux membres (`left_at`, 08 §4). Sans exception, la
 * conversation disparaissait de la liste de celui qui venait de bloquer, et le
 * bouton « Débloquer » de l'écran n'avait nulle part où vivre. Elle reste donc
 * listée POUR LUI SEUL, avec `blockedByMe`, et le déblocage la rouvre.
 *
 * ── LES MESSAGES SYSTÈME ────────────────────────────────────────────────────
 *
 * « X a rejoint le parcours » et ses trois frères s'écrivent par les événements du
 * parcours (03 §7), jamais par un membre : `system_kind` les distingue, et ils ne
 * comptent ni comme non-lu, ni comme supprimable, ni comme signalable.
 */
describe('lot F2 — conversation bloquée, déblocage, messages système', () => {
  let prisma: PrismaService;
  let messaging: MessagingService;
  let blocks: BlocksService;

  const createdUsers: string[] = [];
  const createdTemplates: string[] = [];
  let originCountryId: string;
  let cityId: string;
  let counter = 0;

  async function member(): Promise<{ id: string; handle: string }> {
    counter += 1;
    const id = newId();
    const handle = `f2${counter}${id.slice(-8)}`;
    await prisma.user.create({
      data: {
        id,
        handle,
        displayName: `Membre ${String(counter)}`,
        phase: 'SETTLED',
        verificationLevel: 'L1',
        originCountryId,
        cityId,
        plan: 'FREE',
        status: 'ACTIVE',
      },
    });
    createdUsers.push(id);
    return { id, handle };
  }

  /** Une DIRECT acceptée (sinon « sans réponse, pas de second message »). */
  async function conversationAcceptee(a: { id: string; handle: string }, b: { id: string; handle: string }) {
    const ouverte = await messaging.openDirect(
      { userId: a.id, level: 'L1' },
      { toHandle: b.handle, firstMessage: 'Bonjour, on peut échanger un instant ?' },
    );
    await messaging.acceptDirect(b.id, ouverte.conversationId);
    return ouverte.conversationId;
  }

  const liste = (userId: string) => messaging.listConversations(userId, { limit: 50 });

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const outbox = new OutboxService(prisma);
    const audit = new AuditService(prisma);
    const visibility = new VisibilityService(prisma);
    const connections = new ConnectionsService(prisma, outbox, audit, visibility);
    messaging = new MessagingService(prisma, new CryptoService(), outbox, audit, visibility, connections);
    blocks = new BlocksService(prisma, outbox, audit);
    originCountryId = (
      await prisma.country.findFirstOrThrow({ where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } }, select: { id: true } })
    ).id;
    cityId = (await prisma.city.findFirstOrThrow({ select: { id: true } })).id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    await prisma.journeyTemplate.deleteMany({ where: { id: { in: createdTemplates } } });
    await prisma.$disconnect();
  });

  // ══ Conversation bloquée ══════════════════════════════════════════════════

  it('après un blocage, la DIRECT reste listée pour celui qui a bloqué (blockedByMe), pas pour l’autre', async () => {
    const a = await member();
    const b = await member();
    const conversationId = await conversationAcceptee(a, b);
    expect((await liste(a.id)).items.find((c) => c.id === conversationId)?.blockedByMe).toBe(false);

    await blocks.block(a.id, b.handle);
    // La cascade d'outbox (consommateur `messaging`) ferme les deux lignes.
    await messaging.handleUserBlocked(a.id, b.id);

    const chezMoi = (await liste(a.id)).items.find((c) => c.id === conversationId);
    expect(chezMoi?.blockedByMe).toBe(true);
    expect(chezMoi?.unreadCount).toBe(0);
    // L'autre ne la voit plus : il n'a rien à y faire et ne doit pas deviner.
    expect((await liste(b.id)).items.some((c) => c.id === conversationId)).toBe(false);
  });

  it('écrire dans une conversation bloquée est refusé', async () => {
    const a = await member();
    const b = await member();
    const conversationId = await conversationAcceptee(a, b);
    await blocks.block(a.id, b.handle);
    await messaging.handleUserBlocked(a.id, b.id);

    await expect(
      messaging.sendMessage({ userId: a.id, level: 'L1' }, conversationId, { body: 'Je me ravise ?' }),
    ).rejects.toBeDefined();
  });

  it('débloquer rouvre la DIRECT : elle n’est plus blockedByMe et l’on peut y écrire', async () => {
    const a = await member();
    const b = await member();
    const conversationId = await conversationAcceptee(a, b);
    await blocks.block(a.id, b.handle);
    await messaging.handleUserBlocked(a.id, b.id);

    await blocks.unblock(a.id, b.id);

    const lignes = await prisma.conversationMember.findMany({ where: { conversationId }, select: { leftAt: true } });
    expect(lignes.every((l) => l.leftAt === null)).toBe(true);
    expect((await liste(a.id)).items.find((c) => c.id === conversationId)?.blockedByMe).toBe(false);
    expect((await liste(b.id)).items.some((c) => c.id === conversationId)).toBe(true);
    await expect(
      messaging.sendMessage({ userId: a.id, level: 'L1' }, conversationId, { body: 'Content de reprendre.' }),
    ).resolves.toBeDefined();
  });

  it('débloquer ne rouvre rien si l’autre a aussi bloqué', async () => {
    const a = await member();
    const b = await member();
    const conversationId = await conversationAcceptee(a, b);
    await blocks.block(a.id, b.handle);
    await blocks.block(b.id, a.handle);
    await messaging.handleUserBlocked(a.id, b.id);

    await blocks.unblock(a.id, b.id);

    const fermees = await prisma.conversationMember.count({ where: { conversationId, leftAt: { not: null } } });
    expect(fermees).toBe(2);
  });

  it('une demande IGNORÉE avant le blocage reste fermée après le déblocage', async () => {
    const a = await member();
    const b = await member();
    const ouverte = await messaging.openDirect(
      { userId: a.id, level: 'L1' },
      { toHandle: b.handle, firstMessage: 'Bonjour, je me permets de vous écrire.' },
    );
    await messaging.ignoreDirect(b.id, ouverte.conversationId);

    await blocks.block(a.id, b.handle);
    await messaging.handleUserBlocked(a.id, b.id);
    await blocks.unblock(a.id, b.id);

    const ligneB = await prisma.conversationMember.findFirstOrThrow({
      where: { conversationId: ouverte.conversationId, userId: b.id },
      select: { leftAt: true },
    });
    expect(ligneB.leftAt).not.toBeNull();
  });

  it('le consommateur du blocage ne ferme rien si le membre a déjà débloqué (livraison tardive)', async () => {
    const a = await member();
    const b = await member();
    const conversationId = await conversationAcceptee(a, b);
    await blocks.block(a.id, b.handle);
    await blocks.unblock(a.id, b.id);

    await messaging.handleUserBlocked(a.id, b.id);

    expect(await prisma.conversationMember.count({ where: { conversationId, leftAt: { not: null } } })).toBe(0);
  });

  // ══ Messages système ══════════════════════════════════════════════════════

  async function parcours(owner: { id: string }, supporter: { id: string }) {
    const templateId = newId();
    await prisma.journeyTemplate.create({
      data: { id: templateId, code: `f2-${templateId.slice(-8)}`, nameFr: 'Modèle F2', targetPhase: 'PRE_DEPARTURE', isActive: true, sortOrder: 1 },
    });
    createdTemplates.push(templateId);
    const versionId = newId();
    await prisma.journeyTemplateVersion.create({ data: { id: versionId, templateId, version: 1, status: 'PUBLISHED' } });
    const journeyId = newId();
    await prisma.journey.create({
      data: {
        id: journeyId,
        ownerUserId: owner.id,
        templateVersionId: versionId,
        title: 'Mes études à Lyon',
        status: 'ACTIVE',
        originCountryId,
        destinationCityId: cityId,
        lastActivityAt: new Date(),
      },
    });
    await prisma.journeyMember.create({
      data: { id: newId(), journeyId, userId: supporter.id, role: 'SUPPORTER', invitedByUserId: owner.id, status: 'ACTIVE', acceptedAt: new Date() },
    });
    const conversationId = (await messaging.syncJourneyConversation(journeyId)) as string;
    const etapeId = newId();
    const definition = await prisma.stepDefinition.create({
      data: {
        id: newId(),
        code: `f2-def-${etapeId.slice(-8)}`,
        nameFr: 'Dossier Campus France',
        description: 'x',
        category: 'PRE_DEPARTURE',
        defaultDurationDays: 10,
        blockerTarget: 'NONE',
        isMajorMilestone: false,
        isRisky: false,
        documentChecklist: [],
      },
    });
    await prisma.journeyStep.create({
      data: { id: etapeId, journeyId, stepDefinitionId: definition.id, title: 'Dossier Campus France', position: 1, status: 'DONE', completedAt: new Date() },
    });
    return { journeyId, conversationId, etapeId, definitionId: definition.id };
  }

  const evenement = (type: string, aggregateId: string, payload: Record<string, unknown>) => ({
    id: newId(),
    type,
    aggregateId,
    payload,
  });

  it('« X a rejoint le parcours » : une ligne SYSTEM, ni non-lue ni supprimable ni signalable', async () => {
    const owner = await member();
    const supporter = await member();
    const { journeyId, conversationId } = await parcours(owner, supporter);

    const job = evenement('journey.member_joined', journeyId, { journeyId, userId: supporter.id, role: 'SUPPORTER' });
    await messaging.annoncerEvenementParcours(job);
    // Livraison « au moins une fois » : le rejeu n'écrit pas une seconde ligne.
    await messaging.annoncerEvenementParcours(job);

    const fil = await messaging.listMessages(owner.id, conversationId, { limit: 20 });
    const systeme = fil.items.filter((m) => m.kind === 'SYSTEM');
    expect(systeme).toHaveLength(1);
    expect(systeme[0]?.body).toMatch(/ a rejoint le parcours$/);

    const chez = (await liste(owner.id)).items.find((c) => c.id === conversationId);
    expect(chez?.unreadCount).toBe(0);
    expect(chez?.lastMessagePreview).toMatch(/a rejoint le parcours/);

    // Le membre concerné ne peut pas supprimer la ligne qui le nomme.
    await expect(messaging.deleteMessage(supporter.id, systeme[0]?.id as string)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('un retrait décidé par le blocage n’est pas annoncé ; un départ ordinaire l’est', async () => {
    const owner = await member();
    const supporter = await member();
    const { journeyId, conversationId } = await parcours(owner, supporter);

    await messaging.annoncerEvenementParcours(
      evenement('journey.member_removed', journeyId, { journeyId, userId: supporter.id, reason: 'BLOCKED' }),
    );
    await messaging.annoncerEvenementParcours(
      evenement('journey.member_removed', journeyId, { journeyId, userId: supporter.id, removedByUserId: owner.id }),
    );

    const textes = (await messaging.listMessages(owner.id, conversationId, { limit: 20 })).items
      .filter((m) => m.kind === 'SYSTEM')
      .map((m) => m.body);
    expect(textes).toHaveLength(1);
    expect(textes[0]).toMatch(/ne fait plus partie du parcours$/);
  });

  it('l’étape franchie et le parcours terminé s’écrivent avec le titre de l’étape', async () => {
    const owner = await member();
    const supporter = await member();
    const { journeyId, conversationId, etapeId } = await parcours(owner, supporter);

    await messaging.annoncerEvenementParcours(
      evenement('journey.step_completed', etapeId, { journeyId, stepId: etapeId, ownerUserId: owner.id }),
    );
    await messaging.annoncerEvenementParcours(
      evenement('journey.completed', journeyId, { journeyId, ownerUserId: owner.id }),
    );

    const textes = (await messaging.listMessages(supporter.id, conversationId, { limit: 20 })).items
      .filter((m) => m.kind === 'SYSTEM')
      .map((m) => m.body ?? '');
    expect(textes.some((t) => t.includes('a terminé l’étape « Dossier Campus France »'))).toBe(true);
    expect(textes.some((t) => t.endsWith('a terminé le parcours'))).toBe(true);
  });

  it('un type d’événement inconnu, ou sans parcours, n’écrit rien', async () => {
    const owner = await member();
    const supporter = await member();
    const { journeyId, conversationId } = await parcours(owner, supporter);

    await messaging.annoncerEvenementParcours(evenement('journey.created', journeyId, { journeyId }));
    await messaging.annoncerEvenementParcours(evenement('journey.member_joined', newId(), { userId: supporter.id }));

    const systemes = (await messaging.listMessages(owner.id, conversationId, { limit: 20 })).items.filter((m) => m.kind === 'SYSTEM');
    expect(systemes).toHaveLength(0);
  });
});
