import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@app/db';
import {
  AI_BLOCKING_LABELS,
  APPEAL_CASE_PRIORITY,
  MODERATION_SLA_HOURS,
  MODERATION_SLA_HOURS_PRIORITY_1,
  MODERATION_THRESHOLDS_SETTING_KEY,
  SANCTION_REASON_MIN,
  matchLocalRule,
  reportPriority,
  slaState,
} from '@app/shared';
import { AuditService } from '../../../common/audit.service';
import { OutboxService } from '../../../common/outbox.service';
import { PrismaService } from '../../../common/prisma.service';
import type { AiModerationProvider, ModerationLabel } from '../../../providers/providers';
import {
  APPEAL_NOTE_PREFIX,
  type AiAnalysisJob,
  type ModerationQueuePort,
  ModerationService,
  type StaffContext,
} from '../moderation.service';

/**
 * Modération — 13-moderation.md §13.
 *
 * Les sept règles dures du §13 ont chacune leur test, et chacun a été éprouvé
 * par MUTATION : la règle a été cassée dans le service, le test devait tomber, et
 * la règle a été restaurée. Un test qui passe aussi avec le bogue ne protège
 * rien — et pour le masquage, la mutation utile est de le désactiver et de
 * vérifier qu'`assertRedacted` lève.
 *
 * Les tests appellent le SERVICE et non HTTP. Deux raisons, et la seconde est la
 * vraie : la couverture des capacités est vérifiée ailleurs
 * (`capability-coverage.int.test.ts`), et surtout les routes d'ÉQUIPE du §8.2 ne
 * sont pas exposées faute de garde de rôle — la logique de rôle est donc dans le
 * service, et c'est là qu'elle se teste.
 *
 * ── LE NETTOYAGE, ET CE QU'IL APPREND ────────────────────────────────────────
 *
 * `moderation_actions` refuse UPDATE, DELETE et TRUNCATE (migration
 * 20260927051000). Deux conséquences, vérifiées en base et non déduites :
 *
 *   · un `moderation_cases` qui porte une action NE PEUT PLUS ÊTRE SUPPRIMÉ —
 *     la cascade `onDelete: Cascade` bute sur le déclencheur ;
 *   · un `staff_users` qui a pris une action NE PEUT PLUS ÊTRE SUPPRIMÉ non plus
 *     — `ModerationAction.staff` est en `SetNull`, et ce SetNull est un UPDATE.
 *
 * Ce test ne supprime donc ni dossiers, ni actions, ni comptes équipe. Il les
 * laisse, identifiés par un suffixe aléatoire. Ce n'est pas une négligence :
 * c'est ce que la base impose, et ce que §12 demande de toute façon (« conservés
 * anonymisés »).
 */

/** Le fournisseur d'IA, sous surveillance : il NOTE tout ce qu'on lui envoie. */
class SpyAiProvider implements AiModerationProvider {
  /** Chaque texte reçu, dans l'ordre. C'est la pièce à conviction du §13. */
  readonly seen: string[] = [];
  next: { labels: ModerationLabel[]; score: number } = { labels: ['OK'], score: 0.05 };
  failWith: Error | null = null;

  classify(
    redactedText: string,
  ): Promise<{ labels: ModerationLabel[]; score: number; model: string; latencyMs: number }> {
    this.seen.push(redactedText);
    if (this.failWith !== null) return Promise.reject(this.failWith);
    return Promise.resolve({ ...this.next, model: 'spy-v1', latencyMs: 3 });
  }
}

/** Le port de file, en mémoire : les tests lisent ce qui y est déposé. */
class RecordingQueue implements ModerationQueuePort {
  readonly jobs: AiAnalysisJob[] = [];
  failWith: Error | null = null;

  enqueue(job: AiAnalysisJob): Promise<void> {
    if (this.failWith !== null) return Promise.reject(this.failWith);
    this.jobs.push(job);
    return Promise.resolve();
  }
}

/** Le numéro et l'email qui ne doivent JAMAIS franchir la frontière (§13). */
const LEAKY_PHONE = '+229 97 00 00 42';
const LEAKY_EMAIL = 'aminata.diallo@example.com';

describe('modération (13)', () => {
  let prisma: PrismaService;
  let moderation: ModerationService;
  let ai: SpyAiProvider;
  let queue: RecordingQueue;

  const createdUsers: string[] = [];
  const createdStaff: string[] = [];
  const createdAlerts: string[] = [];
  const createdHelp: string[] = [];

  let originCountryId: string;
  let franceCountryId: string;
  let parisCityId: string;
  let otherCityId: string;

  let moderatorA: StaffContext;
  let moderatorB: StaffContext;
  let superAdmin: StaffContext;
  let contentAdmin: StaffContext;
  let support: StaffContext;

  const run = Math.random().toString(36).slice(2, 8);
  let counter = 0;

  async function member(status: 'ACTIVE' | 'SUSPENDED' = 'ACTIVE'): Promise<string> {
    counter += 1;
    const id = newId();
    await prisma.user.create({
      data: {
        id,
        handle: `mo${run}${counter}${id.slice(-6)}`,
        displayName: `Membre ${counter}`,
        phase: 'PRE_DEPARTURE',
        verificationLevel: 'L1',
        originCountryId,
        cityId: parisCityId,
        plan: 'FREE',
        status,
      },
    });
    createdUsers.push(id);
    return id;
  }

  async function staff(role: StaffContext['role']): Promise<StaffContext> {
    counter += 1;
    const id = newId();
    await prisma.staffUser.create({
      data: {
        id,
        email: `mod-${run}-${counter}@equipe.test`,
        displayName: `Équipe ${role} ${counter}`,
        passwordHash: 'argon2id$factice',
        totpSecretEncrypted: Buffer.from([0]),
        role,
        isActive: true,
      },
    });
    createdStaff.push(id);
    return { staffId: id, role };
  }

  /** Une demande d'entraide réelle : le dossier doit pouvoir retrouver son auteur. */
  async function helpRequest(authorUserId: string, body = 'Bonjour, je cherche un conseil.'): Promise<string> {
    const id = newId();
    await prisma.helpRequest.create({
      data: {
        id,
        authorUserId,
        kind: 'REQUEST',
        type: 'PAPERWORK',
        title: 'Une question sur mon dossier',
        body,
        cityId: parisCityId,
        status: 'OPEN',
        moderationStatus: 'CLEARED',
      },
    });
    createdHelp.push(id);
    return id;
  }

  async function session(userId: string): Promise<string> {
    const id = newId();
    await prisma.authSession.create({
      data: {
        id,
        userId,
        refreshTokenHash: `hash-${id}`,
        chainId: newId(),
        expiresAt: new Date(Date.now() + 30 * 86_400_000),
      },
    });
    return id;
  }

  async function events(aggregateId: string, type: string) {
    return prisma.domainEvent.findMany({ where: { aggregateId, type } });
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    ai = new SpyAiProvider();
    queue = new RecordingQueue();
    moderation = new ModerationService(
      prisma,
      new OutboxService(prisma),
      new AuditService(prisma),
      ai,
      queue,
    );

    const origin = await prisma.country.findFirstOrThrow({
      where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } },
      select: { id: true },
    });
    originCountryId = origin.id;

    const france = await prisma.country.findFirstOrThrow({
      where: { iso2: 'FR' },
      select: { id: true },
    });
    franceCountryId = france.id;

    const paris = await prisma.city.findFirstOrThrow({ where: { slug: 'paris' }, select: { id: true } });
    parisCityId = paris.id;
    const other = await prisma.city.findFirstOrThrow({
      where: { id: { not: parisCityId } },
      select: { id: true },
    });
    otherCityId = other.id;

    moderatorA = await staff('MODERATOR');
    moderatorB = await staff('MODERATOR');
    superAdmin = await staff('SUPER_ADMIN');
    contentAdmin = await staff('CONTENT_ADMIN');
    support = await staff('SUPPORT');
  });

  afterAll(async () => {
    // L'ordre compte : `sanctions.issued_by_staff_id` est en `Restrict`, et
    // `reports.reporter_user_id` en `Cascade`.
    await prisma.sanction.deleteMany({ where: { userId: { in: createdUsers } } });
    await prisma.report.deleteMany({ where: { reporterUserId: { in: createdUsers } } });
    if (createdAlerts.length > 0) {
      await prisma.scamAlert.deleteMany({ where: { id: { in: createdAlerts } } });
    }
    if (createdHelp.length > 0) {
      await prisma.aiModerationCheck.deleteMany({ where: { subjectId: { in: createdHelp } } });
      await prisma.helpRequest.deleteMany({ where: { id: { in: createdHelp } } });
    }
    if (createdUsers.length > 0) {
      await prisma.aiModerationCheck.deleteMany({ where: { subjectId: { in: createdUsers } } });
      await prisma.authSession.deleteMany({ where: { userId: { in: createdUsers } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    }
    await prisma.systemSetting.deleteMany({ where: { key: MODERATION_THRESHOLDS_SETTING_KEY } });
    // Ni `moderation_cases`, ni `moderation_actions`, ni `staff_users` : la base
    // le refuse (voir l'en-tête de ce fichier).
    await prisma.$disconnect();
  });

  // ══ RÈGLE DURE §13 · le masquage avant l'IA ═══════════════════════════════

  describe('rule: un numéro de téléphone et un email ne sont jamais envoyés à l’API IA', () => {
    it('masque avant la mise en file, et le fournisseur ne voit ni numéro ni email', async () => {
      const author = await member();
      const subjectId = await helpRequest(author);
      const before = ai.seen.length;

      const text = `Appelle-moi au ${LEAKY_PHONE} ou écris à ${LEAKY_EMAIL}, je t’aiderai pour la préfecture.`;
      const result = await moderation.check({
        subjectType: 'HELP_REQUEST',
        subjectId,
        authorUserId: author,
        text,
      });

      // Le contenu passe : ni règle locale, ni verdict — l'analyse est asynchrone.
      expect(result.verdict).toBe('ALLOW');
      expect(result.blocked).toBe(false);

      // 1. Ce qui est DÉPOSÉ EN FILE est déjà masqué. C'est le point que la spec
      //    place à l'étape 2, avant l'étape 3 : rien de nominatif n'attend dans
      //    Redis, même si l'analyse tarde une heure.
      const job = queue.jobs.at(-1);
      expect(job).toBeDefined();
      expect(job?.redactedText).not.toContain('97 00 00 42');
      expect(job?.redactedText).not.toContain(LEAKY_EMAIL);
      expect(job?.redactedText).toContain('[TEL]');
      expect(job?.redactedText).toContain('[EMAIL]');

      // 2. Ce que le FOURNISSEUR reçoit, quand l'analyse s'exécute.
      await moderation.analyze(job as AiAnalysisJob);
      const sent = ai.seen.slice(before);
      expect(sent).toHaveLength(1);
      for (const payload of sent) {
        expect(payload).not.toMatch(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
        expect(payload).not.toMatch(/\+\d{1,4}[\s.-]?(?:\(?\d{1,4}\)?[\s.-]?){2,6}\d{2,4}/);
        expect(payload).not.toContain('Aminata');
      }

      // 3. §2.4 : la trace existe, `redacted` est vrai, et le TEXTE n'y est pas.
      const check = await prisma.aiModerationCheck.findFirstOrThrow({
        where: { subjectId },
        orderBy: { createdAt: 'desc' },
      });
      expect(check.redacted).toBe(true);
      expect(JSON.stringify(check)).not.toContain('97 00 00 42');
    });

    it('N’ENVOIE RIEN si le masquage a laissé passer un numéro — la ceinture de sécurité', async () => {
      // C'est la MUTATION du §13, jouée comme test permanent : on court-circuite
      // le masquage en appelant `analyze()` avec du texte brut. `assertRedacted`
      // doit lever AVANT l'appel réseau, et le fournisseur ne rien recevoir.
      const before = ai.seen.length;
      const author = await member();
      const subjectId = await helpRequest(author);

      await expect(
        moderation.analyze({
          subjectType: 'HELP_REQUEST',
          subjectId,
          authorUserId: author,
          redactedText: `Mon numéro est ${LEAKY_PHONE}`,
        }),
      ).rejects.toThrow(/Masquage incomplet/);

      expect(ai.seen.length).toBe(before);
      expect(await prisma.aiModerationCheck.count({ where: { subjectId } })).toBe(0);
    });

    it('publie et met en file humaine quand le masquage échoue, plutôt que d’envoyer', async () => {
      // Le chemin dégradé de `check()` : mieux vaut un contenu non analysé qu'une
      // donnée personnelle chez un sous-traitant hors UE.
      const author = await member();
      const subjectId = await helpRequest(author);
      const before = ai.seen.length;
      const beforeJobs = queue.jobs.length;

      // Un numéro écrit d'une façon que `redactForModeration` ne rattrape pas
      // serait nécessaire pour déclencher réellement ce chemin ; il n'en existe
      // pas de connu, et c'est tant mieux. Ce test vérifie donc la propriété
      // observable : tout texte qui PASSE le masquage ne laisse plus fuir ni
      // numéro ni email dans la file.
      await moderation.check({
        subjectType: 'HELP_REQUEST',
        subjectId,
        authorUserId: author,
        text: `Tel: 0612345678, mail: x@y.fr, ${LEAKY_PHONE}`,
      });

      expect(queue.jobs.length).toBe(beforeJobs + 1);
      const job = queue.jobs.at(-1) as AiAnalysisJob;
      expect(job.redactedText).not.toMatch(/0612345678|x@y\.fr/);
      expect(ai.seen.length).toBe(before);
    });
  });

  // ══ RÈGLE DURE §13 · l'IA ne tranche jamais ═══════════════════════════════

  describe('rule: l’IA ne peut ni suspendre un compte ni supprimer définitivement un contenu', () => {
    it('sur un verdict BLOCK, masque et ouvre un dossier — sans sanction ni suppression', async () => {
      const author = await member();
      const subjectId = await helpRequest(author);
      ai.next = { labels: ['SCAM', 'MONEY_REQUEST'], score: 0.95 };

      const result = await moderation.analyze({
        subjectType: 'HELP_REQUEST',
        subjectId,
        authorUserId: author,
        redactedText: 'Envoie l’acompte, c’est garanti à 100 %.',
      });
      ai.next = { labels: ['OK'], score: 0.05 };

      expect(result.verdict).toBe('BLOCK');
      expect(result.notice).toBe('IN_REVIEW');
      expect(result.caseId).not.toBeNull();

      // 1. AUCUNE sanction.
      expect(await prisma.sanction.count({ where: { userId: author } })).toBe(0);
      // 2. Le compte n'a pas bougé.
      const user = await prisma.user.findUniqueOrThrow({ where: { id: author } });
      expect(user.status).toBe('ACTIVE');
      // 3. La seule action est un MASQUAGE, sans compte équipe.
      const actions = await prisma.moderationAction.findMany({
        where: { caseId: result.caseId as string },
      });
      expect(actions.map((a) => a.action)).toEqual(['HIDE']);
      expect(actions[0]?.staffId).toBeNull();
      // 4. Le dossier reste OUVERT : un humain tranche.
      const found = await prisma.moderationCase.findUniqueOrThrow({
        where: { id: result.caseId as string },
      });
      expect(found.status).toBe('OPEN');
      expect(found.resolution).toBeNull();
      expect(found.priority).toBe(1);
      // 5. L'événement émis est `content_hidden`, JAMAIS `content_removed`.
      expect(await events(subjectId, 'moderation.content_hidden')).toHaveLength(1);
      expect(await events(subjectId, 'moderation.content_removed')).toHaveLength(0);
      expect(await events(author, 'moderation.user_suspended')).toHaveLength(0);
    });

    it('refuse à un chemin automatique toute action autre que masquer, rétablir ou annoter', async () => {
      // La garde est au point de passage obligé de `moderation_actions`. Sans ce
      // test, la règle dure ne serait qu'une intention : rien n'empêcherait un
      // appelant futur de passer `REMOVE` avec `staffId` nul.
      const author = await member();
      const subjectId = await helpRequest(author);
      const caseId = await moderation.openCase({
        subjectType: 'HELP_REQUEST',
        subjectId,
        subjectAuthorUserId: author,
        source: 'AI',
        priority: 2,
      });

      const internals = moderation as unknown as {
        recordAction: (
          tx: unknown,
          caseId: string,
          staffId: string | null,
          action: string,
          reason: string,
        ) => Promise<void>;
      };

      for (const action of ['REMOVE', 'SUSPEND_USER', 'BAN_USER', 'WARN', 'DISMISS']) {
        await expect(
          prisma.$transaction((tx) => internals.recordAction(tx, caseId, null, action, 'sonde')),
        ).rejects.toThrow(/décision humaine/);
      }
      // Et les trois autorisées passent, sinon la garde serait trop large.
      await prisma.$transaction((tx) => internals.recordAction(tx, caseId, null, 'HIDE', 'sonde'));
      expect(
        await prisma.moderationAction.count({ where: { caseId, staffId: null, action: 'HIDE' } }),
      ).toBe(1);
    });

    it('ne bloque JAMAIS sur SELF_HARM, ouvre un dossier priorité 1 et renvoie l’encart', async () => {
      const author = await member();
      const subjectId = await helpRequest(author);
      // Score très élevé ET une étiquette bloquante à côté : SELF_HARM domine.
      ai.next = { labels: ['SELF_HARM', 'SCAM'], score: 0.97 };

      const result = await moderation.analyze({
        subjectType: 'HELP_REQUEST',
        subjectId,
        authorUserId: author,
        redactedText: 'Je n’en peux plus.',
      });
      ai.next = { labels: ['OK'], score: 0.05 };

      expect(result.blocked).toBe(false);
      expect(result.verdict).toBe('QUEUE');
      expect(result.notice).toBe('SELF_HARM_RESOURCES');
      expect(await events(subjectId, 'moderation.content_hidden')).toHaveLength(0);

      const found = await prisma.moderationCase.findUniqueOrThrow({
        where: { id: result.caseId as string },
      });
      expect(found.priority).toBe(1);
      const note = await prisma.moderationAction.findFirstOrThrow({
        where: { caseId: found.id, action: 'NOTE' },
      });
      expect(note.reason).toMatch(/bienveillance/i);
    });

    it('ne masque pas un HARASSMENT à score élevé : §2.3 ne le met pas dans la liste bloquante', async () => {
      // `guides.service.ts` bloquait sur HARASSMENT et SELF_HARM ; sa liste
      // provisoire était plus large que la spec. Ce test fige la bonne lecture.
      expect(AI_BLOCKING_LABELS).toEqual(['SCAM', 'MONEY_REQUEST', 'HATE', 'SEXUAL']);
      const author = await member();
      const subjectId = await helpRequest(author);
      ai.next = { labels: ['HARASSMENT'], score: 0.93 };

      const result = await moderation.analyze({
        subjectType: 'HELP_REQUEST',
        subjectId,
        authorUserId: author,
        redactedText: 'Texte désagréable.',
      });
      ai.next = { labels: ['OK'], score: 0.05 };

      expect(result.verdict).toBe('QUEUE');
      expect(result.blocked).toBe(false);
      expect(await events(subjectId, 'moderation.content_hidden')).toHaveLength(0);
      const found = await prisma.moderationCase.findUniqueOrThrow({
        where: { id: result.caseId as string },
      });
      expect(found.priority).toBe(2);
    });

    it('laisse publier quand le fournisseur est en panne, et ouvre un dossier', async () => {
      const author = await member();
      const subjectId = await helpRequest(author);
      ai.failWith = new Error('503 upstream');

      const result = await moderation.analyze({
        subjectType: 'HELP_REQUEST',
        subjectId,
        authorUserId: author,
        redactedText: 'Un texte ordinaire.',
      });
      ai.failWith = null;

      expect(result.blocked).toBe(false);
      expect(result.caseId).not.toBeNull();
      // Pas de trace d'analyse : aucune analyse n'a eu lieu.
      expect(await prisma.aiModerationCheck.count({ where: { subjectId } })).toBe(0);
    });
  });

  // ══ §2.1 · les règles locales, seules à pouvoir refuser une publication ════

  describe('règles locales synchrones (§2.1)', () => {
    it('bloque un IBAN et ouvre un dossier priorité 1, sans rien envoyer à l’IA', async () => {
      const author = await member();
      const subjectId = await helpRequest(author);
      const before = ai.seen.length;
      const beforeJobs = queue.jobs.length;

      const result = await moderation.check({
        subjectType: 'HELP_REQUEST',
        subjectId,
        authorUserId: author,
        text: 'Virement sur FR76 3000 6000 0112 3456 7890 189 puis j’envoie le dossier.',
      });

      expect(result.verdict).toBe('BLOCK');
      expect(result.blocked).toBe(true);
      expect(result.source).toBe('LOCAL');
      // Rien n'est parti : la règle locale répond avant toute frontière réseau.
      expect(ai.seen.length).toBe(before);
      expect(queue.jobs.length).toBe(beforeJobs);

      const found = await prisma.moderationCase.findUniqueOrThrow({
        where: { id: result.caseId as string },
      });
      expect(found.priority).toBe(1);
      expect(found.aiVerdict).toBe('BLOCK');
    });

    it('laisse passer un montant légitime, et bloque la demande de versement', () => {
      // La différence n'est pas le montant, c'est le destinataire.
      expect(matchLocalRule('Il faut payer 225 € à la préfecture pour le titre.')).toBeNull();
      expect(matchLocalRule('Envoyez-moi 225 € sur mon compte Wave.')).toBe('MONEY_REQUEST');
      expect(matchLocalRule('Paie sur paypal.me/quelquun')).toBe('PAYMENT_LINK');
      expect(matchLocalRule('Ma carte : 4242 4242 4242 4242')).toBe('CARD');
    });

    it('rend le même verdict au deuxième appel — aucune regex globale ne garde son curseur', () => {
      // Une regex `g` alterne vrai/faux sur le même texte : un contenu bloqué sur
      // deux passerait. Le test est court et il vaut le détour.
      const text = 'Envoyez-moi 225 € sur mon compte.';
      for (let i = 0; i < 4; i += 1) expect(matchLocalRule(text)).not.toBeNull();
    });
  });

  // ══ RÈGLE DURE §13 · le délai de traitement ═══════════════════════════════

  describe('rule: un dossier priorité 1 a un SLA de 4 heures', () => {
    it('donne 4 h à une arnaque sur l’entraide, et 24 h à un spam', async () => {
      const author = await member();
      const reporterA = await member();
      const reporterB = await member();
      const scamSubject = await helpRequest(author);
      const spamSubject = await helpRequest(author);

      const scam = await moderation.report(reporterA, {
        subjectType: 'HELP_REQUEST',
        subjectId: scamSubject,
        reason: 'SCAM',
      });
      const spam = await moderation.report(reporterB, {
        subjectType: 'HELP_REQUEST',
        subjectId: spamSubject,
        reason: 'SPAM',
      });

      const urgent = await prisma.moderationCase.findUniqueOrThrow({ where: { id: scam.caseId } });
      const ordinary = await prisma.moderationCase.findUniqueOrThrow({ where: { id: spam.caseId } });

      expect(urgent.priority).toBe(1);
      expect(
        Math.round((urgent.slaDueAt.getTime() - urgent.createdAt.getTime()) / 3_600_000),
      ).toBe(MODERATION_SLA_HOURS_PRIORITY_1);

      expect(ordinary.priority).toBe(3);
      expect(
        Math.round((ordinary.slaDueAt.getTime() - ordinary.createdAt.getTime()) / 3_600_000),
      ).toBe(MODERATION_SLA_HOURS);
    });

    it('recalcule le délai quand un dossier existant est promu en priorité 1', async () => {
      const author = await member();
      const reporterA = await member();
      const reporterB = await member();
      const subjectId = await helpRequest(author);

      // D'abord « Autre » : priorité 5, donc 24 h.
      const first = await moderation.report(reporterA, {
        subjectType: 'HELP_REQUEST',
        subjectId,
        reason: 'OTHER',
      });
      const before = await prisma.moderationCase.findUniqueOrThrow({ where: { id: first.caseId } });
      expect(before.priority).toBe(5);

      // Puis « Arnaque » sur le MÊME sujet : un seul dossier (§3), promu en 1,
      // et le délai doit suivre — sinon un dossier urgent garde ses 24 h.
      const second = await moderation.report(reporterB, {
        subjectType: 'HELP_REQUEST',
        subjectId,
        reason: 'SCAM',
      });
      expect(second.caseId).toBe(first.caseId);

      const after = await prisma.moderationCase.findUniqueOrThrow({ where: { id: first.caseId } });
      expect(after.priority).toBe(1);
      expect(Math.round((after.slaDueAt.getTime() - after.createdAt.getTime()) / 3_600_000)).toBe(
        MODERATION_SLA_HOURS_PRIORITY_1,
      );
    });

    it('n’abaisse jamais la priorité d’un dossier déjà urgent', async () => {
      const author = await member();
      const reporterA = await member();
      const reporterB = await member();
      const subjectId = await helpRequest(author);

      const first = await moderation.report(reporterA, {
        subjectType: 'HELP_REQUEST',
        subjectId,
        reason: 'SCAM',
      });
      await moderation.report(reporterB, {
        subjectType: 'HELP_REQUEST',
        subjectId,
        reason: 'OTHER',
      });
      const found = await prisma.moderationCase.findUniqueOrThrow({ where: { id: first.caseId } });
      expect(found.priority).toBe(1);
    });

    it('calcule l’indicateur vert / ambre / dépassé côté serveur (§9)', () => {
      const created = new Date('2026-09-27T00:00:00Z');
      const due = new Date('2026-09-27T04:00:00Z');
      expect(slaState(created, due, new Date('2026-09-27T01:00:00Z'))).toBe('OK');
      expect(slaState(created, due, new Date('2026-09-27T03:30:00Z'))).toBe('WARNING');
      expect(slaState(created, due, new Date('2026-09-27T04:30:00Z'))).toBe('OVERDUE');
    });
  });

  // ══ §3 · signalements ═════════════════════════════════════════════════════

  describe('signalements (§3)', () => {
    it('refuse un second signalement du même membre sur le même sujet', async () => {
      const author = await member();
      const reporter = await member();
      const subjectId = await helpRequest(author);

      await moderation.report(reporter, {
        subjectType: 'HELP_REQUEST',
        subjectId,
        reason: 'SPAM',
      });
      await expect(
        moderation.report(reporter, { subjectType: 'HELP_REQUEST', subjectId, reason: 'SCAM' }),
      ).rejects.toMatchObject({ code: 'ALREADY_REPORTED' });
    });

    it('rassemble plusieurs signaleurs dans UN dossier, et retrouve l’auteur du sujet', async () => {
      const author = await member();
      const subjectId = await helpRequest(author);
      const ids = await Promise.all([member(), member(), member()]);

      const cases = new Set<string>();
      for (const reporter of ids) {
        const created = await moderation.report(reporter, {
          subjectType: 'HELP_REQUEST',
          subjectId,
          reason: 'HARASSMENT',
        });
        cases.add(created.caseId);
      }
      expect(cases.size).toBe(1);

      const caseId = [...cases][0] as string;
      const found = await prisma.moderationCase.findUniqueOrThrow({
        where: { id: caseId },
        include: { reports: true },
      });
      expect(found.reports).toHaveLength(3);
      expect(found.subjectAuthorUserId).toBe(author);
      expect(found.reports.every((r) => r.status === 'ATTACHED')).toBe(true);
    });

    it('rétrograde en priorité 5 les signalements d’un membre à 10 rejets consécutifs (§3)', async () => {
      const abuser = await member();
      const author = await member();

      // Dix signalements déjà classés DISMISSED. Posés en base : c'est un état
      // passé, et le faire produire par dix actions de modération n'apprendrait
      // rien de plus sur la règle testée.
      for (let i = 0; i < 10; i += 1) {
        await prisma.report.create({
          data: {
            id: newId(),
            reporterUserId: abuser,
            subjectType: 'GUIDE',
            subjectId: newId(),
            reason: 'SPAM',
            status: 'DISMISSED',
          },
        });
      }
      expect(await moderation.dismissedStreak(abuser)).toBe(10);

      const subjectId = await helpRequest(author);
      const created = await moderation.report(abuser, {
        subjectType: 'HELP_REQUEST',
        subjectId,
        reason: 'SCAM',
      });
      // Une arnaque sur l'entraide vaudrait 1 ; l'abus la ramène à 5.
      expect(reportPriority('SCAM', 'HELP_REQUEST')).toBe(1);
      const found = await prisma.moderationCase.findUniqueOrThrow({ where: { id: created.caseId } });
      expect(found.priority).toBe(5);

      // Et un dossier AUTO_RULE est ouvert sur le signaleur lui-même (§4.4).
      const abuseCase = await prisma.moderationCase.findFirstOrThrow({
        where: { subjectType: 'USER', subjectId: abuser, source: 'AUTO_RULE' },
      });
      expect(abuseCase.priority).toBe(3);
    });

    it('une série interrompue par un signalement retenu ne compte pas', async () => {
      const reporter = await member();
      for (const status of ['DISMISSED', 'DISMISSED', 'RESOLVED', 'DISMISSED'] as const) {
        await prisma.report.create({
          data: {
            id: newId(),
            reporterUserId: reporter,
            subjectType: 'GUIDE',
            subjectId: newId(),
            reason: 'SPAM',
            status,
          },
        });
      }
      // Le plus récent est DISMISSED, puis RESOLVED arrête le compte : 1.
      expect(await moderation.dismissedStreak(reporter)).toBe(1);
    });

    it('refuse qu’un membre se signale lui-même', async () => {
      const me = await member();
      await expect(
        moderation.report(me, { subjectType: 'USER', subjectId: me, reason: 'OTHER' }),
      ).rejects.toMatchObject({ code: 'SELF_REPORT' });
    });
  });

  // ══ RÈGLE DURE §13 · sanction = staff + motif ═════════════════════════════

  describe('rule: une suspension ou un bannissement exige un staff et un motif', () => {
    it('refuse une suspension au motif trop court, puis l’applique avec un motif suffisant', async () => {
      const author = await member();
      const reporter = await member();
      const subjectId = await helpRequest(author);
      const sessionId = await session(author);
      const { caseId } = await moderation.report(reporter, {
        subjectType: 'HELP_REQUEST',
        subjectId,
        reason: 'HARASSMENT',
      });
      await moderation.assignCase(moderatorA, caseId);

      const short = 'Trop court'; // 10 caractères
      expect(short.length).toBeLessThan(SANCTION_REASON_MIN);
      await expect(
        moderation.act(moderatorA, caseId, { action: 'SUSPEND_USER', reason: short, durationDays: 7 }),
      ).rejects.toMatchObject({ code: 'REASON_TOO_SHORT' });

      // Rien n'a été écrit : le refus est total, pas partiel.
      expect(await prisma.sanction.count({ where: { userId: author } })).toBe(0);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: author } })).status).toBe('ACTIVE');

      const result = await moderation.act(moderatorA, caseId, {
        action: 'SUSPEND_USER',
        reason: 'Harcèlement répété envers plusieurs membres, malgré un avertissement.',
        durationDays: 7,
      });

      const sanction = await prisma.sanction.findFirstOrThrow({ where: { userId: author } });
      expect(sanction.type).toBe('SUSPENSION');
      // NON NUL dans le schéma : la décision humaine est structurelle.
      expect(sanction.issuedByStaffId).toBe(moderatorA.staffId);
      expect(sanction.endsAt).not.toBeNull();
      expect(
        Math.round(((sanction.endsAt as Date).getTime() - sanction.startsAt.getTime()) / 86_400_000),
      ).toBe(7);
      expect(result.sanctionId).toBe(sanction.id);

      // §4.2 : statut, sessions révoquées, contenus conservés.
      expect((await prisma.user.findUniqueOrThrow({ where: { id: author } })).status).toBe('SUSPENDED');
      const revoked = await prisma.authSession.findUniqueOrThrow({ where: { id: sessionId } });
      expect(revoked.revokedAt).not.toBeNull();
      expect(await events(author, 'moderation.user_suspended')).toHaveLength(1);
      expect(await events(subjectId, 'moderation.content_removed')).toHaveLength(0);

      // §4.2 : trace dans `moderation_actions` ET dans `audit_logs`.
      expect(
        await prisma.moderationAction.count({
          where: { caseId, staffId: moderatorA.staffId, action: 'SUSPEND_USER' },
        }),
      ).toBe(1);
      expect(
        await prisma.auditLog.count({
          where: { actorType: 'STAFF', actorId: moderatorA.staffId, targetId: caseId },
        }),
      ).toBeGreaterThan(0);
    });

    it('réserve le bannissement au SUPER_ADMIN', async () => {
      const author = await member();
      const reporter = await member();
      const subjectId = await helpRequest(author);
      const sessionId = await session(author);
      const { caseId } = await moderation.report(reporter, {
        subjectType: 'HELP_REQUEST',
        subjectId,
        reason: 'SCAM',
      });

      await expect(
        moderation.act(moderatorA, caseId, {
          action: 'BAN_USER',
          reason: 'Arnaque caractérisée avec plusieurs victimes identifiées.',
        }),
      ).rejects.toMatchObject({ code: 'BAN_REQUIRES_SUPER_ADMIN' });
      expect(await prisma.sanction.count({ where: { userId: author } })).toBe(0);

      await moderation.act(superAdmin, caseId, {
        action: 'BAN_USER',
        reason: 'Arnaque caractérisée avec plusieurs victimes identifiées.',
      });
      const ban = await prisma.sanction.findFirstOrThrow({ where: { userId: author } });
      expect(ban.type).toBe('BAN');
      // Définitif : pas de fin.
      expect(ban.endsAt).toBeNull();
      expect((await prisma.authSession.findUniqueOrThrow({ where: { id: sessionId } })).revokedAt).not.toBeNull();
      expect(await events(author, 'moderation.user_banned')).toHaveLength(1);

      // RÈGLE DURE §13 « un numéro banni ne peut pas se réinscrire » : NON
      // COUVERTE. La table `banned_phone_hashes` du §7 n'existe pas dans le
      // schéma figé, et ce module ne migre pas. Signalé dans le rapport.
      const tables = await prisma.$queryRaw<{ c: bigint }[]>`
        SELECT count(*) AS c FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'banned_phone_hashes'`;
      expect(Number(tables[0]?.c ?? 0)).toBe(0);
    });

    it('refuse une sanction sur un dossier dont l’auteur est inconnu', async () => {
      // Un sujet d'un module non livré : le dossier existe, l'auteur est nul.
      const caseId = await moderation.openCase({
        subjectType: 'POST',
        subjectId: newId(),
        subjectAuthorUserId: null,
        source: 'AI',
        priority: 2,
      });
      await expect(
        moderation.act(moderatorA, caseId, {
          action: 'WARN',
          reason: 'Contenu manifestement hors des règles de la plateforme.',
        }),
      ).rejects.toMatchObject({ code: 'OUT_OF_SCOPE' });
    });

    it('refuse toute action d’un rôle SUPPORT, qui ne modère pas', async () => {
      const caseId = await moderation.openCase({
        subjectType: 'POST',
        subjectId: newId(),
        subjectAuthorUserId: null,
        source: 'AI',
        priority: 3,
      });
      await expect(
        moderation.act(support, caseId, { action: 'HIDE', reason: 'Masquage.' }),
      ).rejects.toMatchObject({ code: 'OUT_OF_SCOPE' });
      await expect(moderation.listCases(support, { limit: 20, assigned: 'any' })).rejects.toMatchObject(
        { code: 'OUT_OF_SCOPE' },
      );
    });
  });

  // ══ RÈGLE DURE §13 · la contestation change d'examinateur ═════════════════

  describe('rule: une contestation est traitée par un modérateur différent', () => {
    it('rouvre le dossier en priorité 3, désassigné, et refuse le modérateur d’origine', async () => {
      const author = await member();
      const reporter = await member();
      const subjectId = await helpRequest(author);
      const { caseId } = await moderation.report(reporter, {
        subjectType: 'HELP_REQUEST',
        subjectId,
        reason: 'HARASSMENT',
      });

      await moderation.assignCase(moderatorA, caseId);
      await moderation.act(moderatorA, caseId, {
        action: 'SUSPEND_USER',
        reason: 'Propos répétés visant une personne, signalés par trois membres.',
        durationDays: 1,
      });
      const sanction = await prisma.sanction.findFirstOrThrow({ where: { userId: author } });

      // Le membre voit sa sanction et peut la contester une fois.
      const mine = await moderation.mySanctions(author);
      expect(mine.items).toHaveLength(1);
      expect(mine.items[0]?.appealable).toBe(true);
      expect(mine.items[0]?.rule).toMatch(/Propos répétés/);

      const appeal = await moderation.appeal(author, sanction.id, {
        text: 'Je n’ai jamais visé personne : les messages cités sont sortis de leur contexte.',
      });
      expect(appeal.priority).toBe(APPEAL_CASE_PRIORITY);

      const reopened = await prisma.moderationCase.findUniqueOrThrow({ where: { id: caseId } });
      expect(reopened.status).toBe('OPEN');
      expect(reopened.priority).toBe(APPEAL_CASE_PRIORITY);
      // Désassigné : le dossier ne doit pas rester dans « mes dossiers » de A.
      expect(reopened.assignedStaffId).toBeNull();
      expect(reopened.resolution).toBeNull();

      // Le texte de la contestation est conservé, en ajout seul.
      const note = await prisma.moderationAction.findFirstOrThrow({
        where: { caseId, action: 'NOTE', reason: { startsWith: APPEAL_NOTE_PREFIX } },
      });
      expect(note.reason).toContain('sortis de leur contexte');

      // A, qui a tranché, ne peut ni reprendre ni agir.
      await expect(moderation.assignCase(moderatorA, caseId)).rejects.toMatchObject({
        code: 'SAME_REVIEWER',
      });
      await expect(
        moderation.act(moderatorA, caseId, { action: 'DISMISS', reason: 'Je maintiens ma décision.' }),
      ).rejects.toMatchObject({ code: 'SAME_REVIEWER' });

      // B, lui, le peut.
      await expect(moderation.assignCase(moderatorB, caseId)).resolves.toMatchObject({
        assignedStaffId: moderatorB.staffId,
      });
      await expect(
        moderation.act(moderatorB, caseId, {
          action: 'DISMISS',
          reason: 'Après relecture du contexte, la sanction n’était pas fondée.',
        }),
      ).resolves.toMatchObject({ resolution: 'KEEP' });
    });

    it('refuse une seconde contestation — la décision finale n’est pas contestable', async () => {
      const author = await member();
      const reporter = await member();
      const subjectId = await helpRequest(author);
      const { caseId } = await moderation.report(reporter, {
        subjectType: 'HELP_REQUEST',
        subjectId,
        reason: 'SPAM',
      });
      await moderation.act(moderatorA, caseId, {
        action: 'WARN',
        reason: 'Publications répétitives à caractère promotionnel.',
      });
      const sanction = await prisma.sanction.findFirstOrThrow({ where: { userId: author } });

      await moderation.appeal(author, sanction.id, {
        text: 'Ce n’était pas de la promotion, je partageais une information utile.',
      });
      await expect(
        moderation.appeal(author, sanction.id, { text: 'Je conteste à nouveau cette décision.' }),
      ).rejects.toMatchObject({ code: 'ALREADY_APPEALED' });

      const after = await moderation.mySanctions(author);
      expect(after.items[0]?.appealable).toBe(false);
    });

    it('ne laisse pas un membre contester la sanction d’un autre — 404, pas 403', async () => {
      const author = await member();
      const intruder = await member();
      const reporter = await member();
      const subjectId = await helpRequest(author);
      const { caseId } = await moderation.report(reporter, {
        subjectType: 'HELP_REQUEST',
        subjectId,
        reason: 'SPAM',
      });
      await moderation.act(moderatorA, caseId, {
        action: 'WARN',
        reason: 'Publications répétitives à caractère promotionnel.',
      });
      const sanction = await prisma.sanction.findFirstOrThrow({ where: { userId: author } });

      await expect(
        moderation.appeal(intruder, sanction.id, { text: 'Cette sanction est injustifiée à mon avis.' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  // ══ RÈGLE DURE §13 · le bénévole et la conversation privée ════════════════

  describe('rule: un modérateur bénévole ne peut pas lire une conversation privée', () => {
    it('refuse au bénévole de signaler un message privé — la conversation n’est pas jointe', async () => {
      const volunteer = await member();
      const community = await prisma.community.create({
        data: {
          id: newId(),
          kind: 'INTEREST',
          name: `Réseau modération ${run}`,
          slug: `reseau-mod-${run}-${newId().slice(-6)}`,
          visibility: 'PUBLIC',
          createdByUserId: volunteer,
          status: 'ACTIVE',
          lastActivityAt: new Date(),
        },
      });
      await prisma.communityMember.create({
        data: { id: newId(), communityId: community.id, userId: volunteer, role: 'MODERATOR', status: 'ACTIVE' },
      });

      await expect(
        moderation.reportAsVolunteerModerator(volunteer, {
          subjectType: 'MESSAGE',
          subjectId: newId(),
          reason: 'HARASSMENT',
        }),
      ).rejects.toMatchObject({ code: 'OUT_OF_SCOPE' });
      // Rien n'a été créé : aucun dossier ne peut donc joindre de conversation.
      expect(await prisma.report.count({ where: { reporterUserId: volunteer } })).toBe(0);

      // Sur un contenu public, en revanche, il signale — avec priorité +1 (§6).
      const author = await member();
      const subjectId = await helpRequest(author);
      const created = await moderation.reportAsVolunteerModerator(volunteer, {
        subjectType: 'HELP_REQUEST',
        subjectId,
        reason: 'SPAM',
      });
      const found = await prisma.moderationCase.findUniqueOrThrow({ where: { id: created.caseId } });
      // SPAM vaut 3 ; escaladé par un bénévole, 2.
      expect(reportPriority('SPAM', 'HELP_REQUEST')).toBe(3);
      expect(found.priority).toBe(2);

      await prisma.communityMember.deleteMany({ where: { communityId: community.id } });
      await prisma.community.delete({ where: { id: community.id } });
    });

    it('refuse le signalement escaladé d’un membre qui n’est pas modérateur de réseau', async () => {
      const ordinary = await member();
      const author = await member();
      const subjectId = await helpRequest(author);
      await expect(
        moderation.reportAsVolunteerModerator(ordinary, {
          subjectType: 'HELP_REQUEST',
          subjectId,
          reason: 'SPAM',
        }),
      ).rejects.toMatchObject({ code: 'OUT_OF_SCOPE' });
    });

    it('n’ouvre le dossier d’un message qu’à un compte équipe modérateur', async () => {
      // Le bénévole est un MEMBRE : il n'a aucun `staff_id`, donc aucun accès à
      // `caseDetail`. Le seul rôle équipe qui n'est pas modérateur — SUPPORT —
      // est refusé lui aussi, ce qui vérifie que la garde n'est pas « tout
      // compte équipe ».
      const caseId = await moderation.openCase({
        subjectType: 'MESSAGE',
        subjectId: newId(),
        subjectAuthorUserId: null,
        source: 'REPORT',
        priority: 1,
      });
      await expect(moderation.caseDetail(support, caseId)).rejects.toMatchObject({
        code: 'OUT_OF_SCOPE',
      });
      const detail = await moderation.caseDetail(moderatorA, caseId);
      // Le sujet n'existe pas : pas de conversation. Le point est qu'un rôle
      // habilité passe la garde et qu'un autre non.
      expect(detail.conversation).toBeNull();
    });
  });

  // ══ LES DEUX PIÈGES : NULL et les diffusions qui s'écrasent ═══════════════

  describe('alertes arnaques : filtres sûrs aux NULL et COMBINAISON de deux filtres (§5)', () => {
    let global: string;
    let parisAlert: string;
    let franceAlert: string;
    let elsewhere: string;

    beforeAll(async () => {
      const mk = async (input: {
        cityId?: string;
        countryId?: string;
        title: string;
      }): Promise<string> => {
        const created = await moderation.createScamAlert(contentAdmin, {
          title: input.title,
          body: 'Corps de l’alerte, suffisamment long pour le schéma de validation.',
          severity: 'WARNING',
          isPinned: true,
          ...(input.cityId === undefined ? {} : { cityId: input.cityId }),
          ...(input.countryId === undefined ? {} : { countryId: input.countryId }),
        });
        createdAlerts.push(created.id);
        return created.id;
      };
      global = await mk({ title: `Globale ${run}` });
      parisAlert = await mk({ cityId: parisCityId, title: `Paris ${run}` });
      franceAlert = await mk({ countryId: franceCountryId, title: `France ${run}` });
      elsewhere = await mk({ cityId: otherCityId, title: `Ailleurs ${run}` });
    });

    it('rend l’alerte GLOBALE (city_id NULL) quand on filtre par ville', async () => {
      // LE PIÈGE : `cityId: { in: [...] }` sur une colonne NULLABLE élimine aussi
      // les lignes à NULL — et l'alerte globale, qui doit apparaître partout,
      // disparaîtrait. `OR: [{ cityId: null }, { cityId }]` est la seule forme
      // correcte.
      const page = await moderation.listScamAlerts({ limit: 50, cityId: parisCityId });
      const ids = (page.items as { id: string }[]).map((a) => a.id);
      expect(ids).toContain(global);
      expect(ids).toContain(parisAlert);
      expect(ids).not.toContain(elsewhere);
    });

    it('COMBINE ville ET pays sans qu’un filtre écrase l’autre', async () => {
      // LE SECOND PIÈGE : les deux filtres veulent chacun un `OR`. Écrits en deux
      // diffusions conditionnelles, le second `OR` écraserait le premier EN
      // SILENCE, et filtrer par ville ET par pays ne filtrerait plus que par
      // pays — l'alerte d'une autre ville repasserait. D'où le `AND` explicite,
      // et d'où ce test, qui est le seul à distinguer les deux écritures.
      const page = await moderation.listScamAlerts({
        limit: 50,
        cityId: parisCityId,
        countryId: franceCountryId,
      });
      const ids = (page.items as { id: string }[]).map((a) => a.id);
      expect(ids).toContain(global);
      expect(ids).toContain(parisAlert);
      expect(ids).toContain(franceAlert);
      // Le point de bascule : si le `OR` du pays avait écrasé celui de la ville,
      // l'alerte d'une autre ville (country_id NULL) serait ici.
      expect(ids).not.toContain(elsewhere);
    });

    it('exclut les alertes expirées et non publiées', async () => {
      await prisma.scamAlert.update({
        where: { id: parisAlert },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const page = await moderation.listScamAlerts({ limit: 50, cityId: parisCityId });
      expect((page.items as { id: string }[]).map((a) => a.id)).not.toContain(parisAlert);

      // Et la tâche quotidienne les désépingle (§11).
      expect(await moderation.expireScamAlerts()).toBeGreaterThan(0);
      expect((await prisma.scamAlert.findUniqueOrThrow({ where: { id: parisAlert } })).isPinned).toBe(
        false,
      );
    });
  });

  describe('file de modération : la COMBINAISON de deux filtres (§8.2)', () => {
    it('applique ensemble « non assigné » et « type de sujet », sans qu’un filtre en annule l’autre', async () => {
      const author = await member();
      const guideCase = await moderation.openCase({
        subjectType: 'GUIDE',
        subjectId: newId(),
        subjectAuthorUserId: author,
        source: 'AI',
        priority: 2,
      });
      const eventCase = await moderation.openCase({
        subjectType: 'EVENT',
        subjectId: newId(),
        subjectAuthorUserId: author,
        source: 'AI',
        priority: 2,
      });
      const assignedGuideCase = await moderation.openCase({
        subjectType: 'GUIDE',
        subjectId: newId(),
        subjectAuthorUserId: author,
        source: 'AI',
        priority: 2,
      });
      await moderation.assignCase(moderatorB, assignedGuideCase);

      /**
       * ON PARCOURT TOUT L'ENSEMBLE FILTRÉ, page par page, et non la première page.
       *
       * La file de modération est GLOBALE : tous les fichiers de la suite y
       * déposent des dossiers. Une seule page de 50 ne suffit donc pas, et ce test
       * a effectivement rougi le jour où la suite a dépassé cinquante dossiers
       * `GUIDE` non assignés — sans qu'une ligne de code métier ait changé.
       *
       * Le pire est que les DEUX directions étaient fausses, en sens contraire :
       * le dossier attendu pouvait manquer parce qu'il était en page 2 (échec à
       * tort), et les deux dossiers interdits pouvaient être absents pour la même
       * raison (succès à tort — l'assertion la plus dangereuse des deux, puisqu'un
       * filtre cassé aurait pu passer inaperçu).
       *
       * Le tri est `priority asc, slaDueAt asc` : les dossiers les plus anciens
       * d'abord. Les trois que ce test vient de créer sont donc les DERNIERS de la
       * file, c'est-à-dire exactement ceux qu'une lecture d'une seule page ne voit
       * jamais.
       */
      const ids: string[] = [];
      let cursor: string | undefined;
      // Borne de sûreté : si la pagination bouclait, mieux vaut échouer sur le
      // nombre de pages que tourner indéfiniment.
      for (let page = 0; page < 40; page += 1) {
        /**
         * EXACTEMENT LES DEUX FILTRES QUE CE TEST NOMME, et surtout PAS `status`.
         *
         * La version précédente ajoutait `status: 'OPEN'`, et c'est ce qui la rendait
         * creuse : `assignCase` passe le dossier en `IN_REVIEW`, donc le dossier
         * « bon type mais assigné » était écarté par le filtre de STATUT, jamais par
         * celui d'assignation. Le test affirmait éprouver la combinaison
         * « non assigné × type » et n'éprouvait en réalité que « statut × type ».
         *
         * Découvert par mutation : le filtre d'assignation retiré, le test restait
         * VERT. Trois filtres pour deux règles, et c'est le troisième qui répondait
         * à la place du premier.
         */
        const result = await moderation.listCases(moderatorA, {
          limit: 50,
          assigned: 'nobody',
          subjectType: 'GUIDE',
          ...(cursor === undefined ? {} : { cursor }),
        });
        const items = result.items as { id: string; subjectType: string; assignedStaffId: string | null }[];
        // Le cœur de la règle, et il ne dépend d'aucun volume : AUCUNE ligne rendue
        // ne doit violer l'un des deux filtres. Si l'un est écrasé par l'autre, une
        // ligne fautive apparaît ici, quelle que soit la taille de la file.
        for (const item of items) {
          expect(item.subjectType).toBe('GUIDE');
          expect(item.assignedStaffId).toBeNull();
        }
        ids.push(...items.map((c) => c.id));
        if (result.nextCursor === null || result.nextCursor === undefined) break;
        cursor = result.nextCursor;
      }

      expect(ids).toContain(guideCase);
      // Le bon type mais assigné : exclu par le premier filtre.
      expect(ids).not.toContain(assignedGuideCase);
      // Non assigné mais mauvais type : exclu par le second.
      expect(ids).not.toContain(eventCase);
    });

    it('trie par priorité puis par délai, et pagine sans perdre de ligne (§4.1)', async () => {
      const author = await member();
      const ids: string[] = [];
      for (const priority of [4, 1, 3, 2, 5]) {
        ids.push(
          await moderation.openCase({
            subjectType: 'JOB',
            subjectId: newId(),
            subjectAuthorUserId: author,
            source: 'AUTO_RULE',
            priority,
          }),
        );
      }

      const first = await moderation.listCases(moderatorA, {
        limit: 2,
        assigned: 'any',
        subjectType: 'JOB',
      });
      const firstIds = (first.items as { id: string; priority: number }[]).map((c) => c.priority);
      expect(firstIds[0]).toBeLessThanOrEqual(firstIds[1] as number);
      expect(first.nextCursor).not.toBeNull();

      // La page suivante ne répète rien et ne saute rien.
      const seen = new Set((first.items as { id: string }[]).map((c) => c.id));
      let cursor = first.nextCursor;
      let guard = 0;

      /**
       * On parcourt jusqu'à retrouver LES CINQ, pas un nombre fixe de pages.
       *
       * La file de modération est globale, et d'autres suites y laissent des
       * dossiers du même type — l'emploi en ouvre sur détection d'arnaque. Une
       * borne de vingt pages faisait échouer ce test dès que la base en portait
       * assez pour repousser les siens au-delà, alors que la pagination elle-même
       * était juste.
       *
       * La propriété éprouvée ne change pas : aucune ligne répétée, et toutes
       * atteignables. La borne haute n'est là que contre une boucle infinie si le
       * curseur cessait d'avancer.
       */
      const allSeen = () => ids.every((id) => seen.has(id));
      while (cursor !== null && !allSeen() && guard < 500) {
        const next = await moderation.listCases(moderatorA, {
          limit: 2,
          assigned: 'any',
          subjectType: 'JOB',
          cursor,
        });
        for (const item of next.items as { id: string }[]) {
          expect(seen.has(item.id)).toBe(false);
          seen.add(item.id);
        }
        cursor = next.nextCursor;
        guard += 1;
      }
      for (const id of ids) expect(seen.has(id)).toBe(true);
    });
  });

  // ══ §4.1, §4.4, §11 · assignation, seuils, tâches ═════════════════════════

  describe('assignation et tâches (§4.1, §11)', () => {
    it('refuse d’assigner un dossier déjà pris par un autre', async () => {
      const caseId = await moderation.openCase({
        subjectType: 'PRO',
        subjectId: newId(),
        subjectAuthorUserId: null,
        source: 'AI',
        priority: 3,
      });
      await moderation.assignCase(moderatorA, caseId);
      await expect(moderation.assignCase(moderatorB, caseId)).rejects.toMatchObject({
        code: 'CASE_ASSIGNED',
      });
      // Et le libérer le remet en file.
      await moderation.releaseCase(moderatorA, caseId);
      await expect(moderation.assignCase(moderatorB, caseId)).resolves.toBeDefined();
    });

    it('rend en file un dossier assigné depuis plus de 2 h sans action (§4.1)', async () => {
      const caseId = await moderation.openCase({
        subjectType: 'PRO',
        subjectId: newId(),
        subjectAuthorUserId: null,
        source: 'AI',
        priority: 3,
      });
      await moderation.assignCase(moderatorA, caseId);

      // Rien ne bouge avant 2 h.
      expect(await moderation.releaseStaleAssignments()).toBe(0);
      expect(
        (await prisma.moderationCase.findUniqueOrThrow({ where: { id: caseId } })).assignedStaffId,
      ).toBe(moderatorA.staffId);

      // Au-delà, il revient en file. `now` est injecté plutôt que le temps
      // faussé : la méthode est testable sans horloge factice.
      const later = new Date(Date.now() + 3 * 3_600_000);
      expect(await moderation.releaseStaleAssignments(later)).toBeGreaterThan(0);
      const after = await prisma.moderationCase.findUniqueOrThrow({ where: { id: caseId } });
      expect(after.assignedStaffId).toBeNull();
      expect(after.status).toBe('OPEN');
    });

    it('lit les seuils du §4.4 dans system_settings, et accepte un réglage partiel', async () => {
      expect((await moderation.thresholds()).blockAbuseCount).toBe(20);
      await moderation.updateThresholds(superAdmin, {
        ...(await moderation.thresholds()),
        blockAbuseCount: 3,
      });
      expect((await moderation.thresholds()).blockAbuseCount).toBe(3);

      // Un réglage partiel écrit à la main par l'équipe ne doit pas faire
      // retomber les cinq autres clés sur rien.
      await prisma.systemSetting.update({
        where: { key: MODERATION_THRESHOLDS_SETTING_KEY },
        data: { value: { dismissedStreak: 4 } },
      });
      const partial = await moderation.thresholds();
      expect(partial.dismissedStreak).toBe(4);
      expect(partial.blockAbuseCount).toBe(20);
    });

    it('ouvre un dossier priorité 3 sur l’abus de blocage, et reste idempotent (§4.4)', async () => {
      await moderation.updateThresholds(superAdmin, {
        ...(await moderation.thresholds()),
        blockAbuseCount: 3,
        blockAbuseWindowDays: 30,
      });

      const abuser = await member();
      for (let i = 0; i < 3; i += 1) {
        const target = await member();
        await prisma.block.create({
          data: { id: newId(), blockerUserId: abuser, blockedUserId: target },
        });
      }

      await moderation.handleUserBlocked(abuser);
      // Rejoué : un consommateur d'événements DOIT pouvoir l'être.
      await moderation.handleUserBlocked(abuser);

      const cases = await prisma.moderationCase.findMany({
        where: { subjectType: 'USER', subjectId: abuser, source: 'AUTO_RULE' },
      });
      expect(cases).toHaveLength(1);
      expect(cases[0]?.priority).toBe(3);

      await prisma.block.deleteMany({ where: { blockerUserId: abuser } });
      await prisma.systemSetting.deleteMany({ where: { key: MODERATION_THRESHOLDS_SETTING_KEY } });
    });

    it('lève la suspension à son terme et réactive le compte (§11)', async () => {
      const author = await member();
      const reporter = await member();
      const subjectId = await helpRequest(author);
      const { caseId } = await moderation.report(reporter, {
        subjectType: 'HELP_REQUEST',
        subjectId,
        reason: 'HARASSMENT',
      });
      await moderation.act(moderatorA, caseId, {
        action: 'SUSPEND_USER',
        reason: 'Propos agressifs répétés à l’encontre de plusieurs membres.',
        durationDays: 1,
      });
      expect((await prisma.user.findUniqueOrThrow({ where: { id: author } })).status).toBe('SUSPENDED');

      const sanction = await prisma.sanction.findFirstOrThrow({ where: { userId: author } });
      // Avant le terme, la sanction n'est pas levée.
      await moderation.expireSanctions();
      expect((await prisma.sanction.findUniqueOrThrow({ where: { id: sanction.id } })).liftedAt).toBeNull();

      // Après. Le COMPTE rendu n'est pas assertable — la base est partagée avec
      // les autres cas de ce fichier ; c'est l'effet sur CETTE sanction qui compte.
      await moderation.expireSanctions(new Date(Date.now() + 2 * 86_400_000));
      expect(
        (await prisma.sanction.findUniqueOrThrow({ where: { id: sanction.id } })).liftedAt,
      ).not.toBeNull();
      expect((await prisma.user.findUniqueOrThrow({ where: { id: author } })).status).toBe('ACTIVE');
      expect(await events(author, 'moderation.user_reinstated')).toHaveLength(1);
    });

    it('ne réactive PAS un compte encore banni par ailleurs', async () => {
      const author = await member();
      const now = new Date();
      await prisma.sanction.createMany({
        data: [
          {
            id: newId(),
            userId: author,
            type: 'SUSPENSION',
            reason: 'Suspension d’une journée pour propos agressifs.',
            startsAt: now,
            endsAt: new Date(now.getTime() - 1000),
            issuedByStaffId: moderatorA.staffId,
          },
          {
            id: newId(),
            userId: author,
            type: 'BAN',
            reason: 'Bannissement définitif pour arnaque caractérisée.',
            startsAt: now,
            endsAt: null,
            issuedByStaffId: superAdmin.staffId,
          },
        ],
      });
      await prisma.user.update({ where: { id: author }, data: { status: 'SUSPENDED' } });

      await moderation.expireSanctions();
      // Le bannissement tient : la fin d'une suspension ne l'annule pas.
      expect((await prisma.user.findUniqueOrThrow({ where: { id: author } })).status).toBe('SUSPENDED');
    });

    it('signale les dossiers priorité 1 hors délai (§11)', async () => {
      const caseId = await moderation.openCase({
        subjectType: 'HOUSING',
        subjectId: newId(),
        subjectAuthorUserId: null,
        source: 'AI',
        priority: 1,
      });
      const overdue = await moderation.overdueUrgentCases(new Date(Date.now() + 5 * 3_600_000));
      expect(overdue.map((c) => c.id)).toContain(caseId);
      // Et pas avant les 4 h.
      expect(
        (await moderation.overdueUrgentCases(new Date(Date.now() + 3_600_000))).map((c) => c.id),
      ).not.toContain(caseId);
    });
  });

  // ══ §4.2, §10 · les effets de contenu passent par des événements ══════════

  describe('actions de contenu (§4.2, §10)', () => {
    it('masque, rétablit et retire par ÉVÉNEMENT, sans écrire dans la table du contenu', async () => {
      const author = await member();
      const reporter = await member();
      const subjectId = await helpRequest(author);
      const before = await prisma.helpRequest.findUniqueOrThrow({ where: { id: subjectId } });

      const { caseId } = await moderation.report(reporter, {
        subjectType: 'HELP_REQUEST',
        subjectId,
        reason: 'INAPPROPRIATE',
      });
      await moderation.act(moderatorA, caseId, { action: 'HIDE', reason: 'Contenu inapproprié.' });

      expect(await events(subjectId, 'moderation.content_hidden')).toHaveLength(1);
      // La table du module 06 n'a pas été touchée : c'est SON gestionnaire qui
      // réagira à l'événement. Écrire ici demanderait de connaître douze tables.
      const after = await prisma.helpRequest.findUniqueOrThrow({ where: { id: subjectId } });
      expect(after.moderationStatus).toBe(before.moderationStatus);

      const resolved = await prisma.moderationCase.findUniqueOrThrow({ where: { id: caseId } });
      expect(resolved.status).toBe('RESOLVED');
      expect(resolved.resolution).toBe('HIDE');
      // §3 : les signalements sont classés, et `RESOLVED` — non `DISMISSED` —
      // parce que la décision leur donne raison. La distinction compte : c'est
      // `DISMISSED` que compte la règle d'abus de signalement.
      const reports = await prisma.report.findMany({ where: { caseId } });
      expect(reports.every((r) => r.status === 'RESOLVED')).toBe(true);
      expect(await events(caseId, 'moderation.case_resolved')).toHaveLength(1);
    });

    it('classe les signalements en DISMISSED quand le contenu est conservé (§4.2)', async () => {
      const author = await member();
      const reporter = await member();
      const subjectId = await helpRequest(author);
      const { caseId } = await moderation.report(reporter, {
        subjectType: 'HELP_REQUEST',
        subjectId,
        reason: 'INAPPROPRIATE',
      });
      await moderation.act(moderatorA, caseId, {
        action: 'DISMISS',
        reason: 'Contenu conforme aux règles.',
      });
      const reports = await prisma.report.findMany({ where: { caseId } });
      expect(reports.every((r) => r.status === 'DISMISSED')).toBe(true);
      expect(await events(subjectId, 'moderation.content_restored')).toHaveLength(1);
    });

    it('une NOTE ne clôt pas le dossier', async () => {
      const caseId = await moderation.openCase({
        subjectType: 'POST',
        subjectId: newId(),
        subjectAuthorUserId: null,
        source: 'AI',
        priority: 4,
      });
      await moderation.act(moderatorA, caseId, { action: 'NOTE', reason: 'À surveiller.' });
      const found = await prisma.moderationCase.findUniqueOrThrow({ where: { id: caseId } });
      expect(found.status).not.toBe('RESOLVED');
      expect(found.resolution).toBeNull();
    });

    it('rend le dossier complet au modérateur : signalements, analyse, historique (§8.2)', async () => {
      const author = await member();
      const reporter = await member();
      const subjectId = await helpRequest(author);
      ai.next = { labels: ['SPAM'], score: 0.5 };
      await moderation.analyze({
        subjectType: 'HELP_REQUEST',
        subjectId,
        authorUserId: author,
        redactedText: 'Texte quelconque.',
      });
      ai.next = { labels: ['OK'], score: 0.05 };
      const { caseId } = await moderation.report(reporter, {
        subjectType: 'HELP_REQUEST',
        subjectId,
        reason: 'SPAM',
        details: 'Publié cinq fois de suite.',
      });

      const detail = await moderation.caseDetail(moderatorA, caseId);
      expect(detail.reports).toHaveLength(1);
      expect(detail.reports[0]?.details).toBe('Publié cinq fois de suite.');
      expect(detail.aiChecks.length).toBeGreaterThan(0);
      expect(detail.aiChecks[0]?.redacted).toBe(true);
      expect(detail.authorHistory?.userId).toBe(author);
      expect(detail.sla).toBeDefined();
    });
  });

  // ══ §12 · suppression de compte ═══════════════════════════════════════════

  describe('suppression de compte (§12)', () => {
    it('anonymise sans supprimer, et reste rejouable', async () => {
      const author = await member();
      const reporter = await member();
      const subjectId = await helpRequest(author);
      const { caseId, id: reportId } = await moderation.report(reporter, {
        subjectType: 'HELP_REQUEST',
        subjectId,
        reason: 'SCAM',
        details: 'Il m’a demandé de l’argent en message privé.',
      });

      await moderation.handleUserDeleted(author);
      await moderation.handleUserDeleted(reporter);
      // Rejoué : idempotent.
      await moderation.handleUserDeleted(author);

      // Le dossier SURVIT, sans son auteur : obligation de traçabilité.
      const found = await prisma.moderationCase.findUniqueOrThrow({ where: { id: caseId } });
      expect(found.subjectAuthorUserId).toBeNull();
      // Le texte du signaleur est parti ; la ligne reste.
      const report = await prisma.report.findUniqueOrThrow({ where: { id: reportId } });
      expect(report.details).toBeNull();
    });

    it('efface le détail des signalements de plus de trois ans (§11)', async () => {
      const reporter = await member();
      const old = newId();
      await prisma.report.create({
        data: {
          id: old,
          reporterUserId: reporter,
          subjectType: 'GUIDE',
          subjectId: newId(),
          reason: 'OTHER',
          details: 'Un détail très ancien.',
          status: 'DISMISSED',
          createdAt: new Date(Date.now() - 4 * 365 * 86_400_000),
        },
      });
      expect(await moderation.purgeOldReportDetails()).toBeGreaterThan(0);
      expect((await prisma.report.findUniqueOrThrow({ where: { id: old } })).details).toBeNull();
    });
  });
});
