import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { newId, Prisma } from '@app/db';
import {
  ACTION_REASON_MIN,
  AI_BLOCK_SCORE,
  AI_BLOCKING_LABELS,
  AI_QUEUE_SCORE,
  APPEAL_CASE_PRIORITY,
  CONTENT_IN_REVIEW_NOTICE,
  MODERATION_ASSIGNMENT_STALE_MS,
  MODERATION_ERROR_CODES,
  MODERATION_ERROR_MESSAGES,
  MODERATION_THRESHOLD_DEFAULTS,
  MODERATION_THRESHOLDS_SETTING_KEY,
  REPORT_CONFIRMATION,
  REPORT_RETENTION_DAYS,
  SANCTION_REASON_MIN,
  SANCTIONING_ACTIONS,
  SELF_HARM_CASE_NOTE,
  SELF_HARM_RESOURCE_PAGE_SLUG,
  escalatedPriority,
  matchLocalRule,
  reportPriority,
  slaDueAt,
  slaState,
  type Appeal,
  type CaseAction,
  type CasesQuery,
  type CreateReport,
  type ModerationErrorCode,
  type ModerationLabelValue,
  type ModerationThresholds,
  type Page,
  type ScamAlertWrite,
  type ScamAlertsQuery,
  STAFF_SCOPES,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { AuditService } from '../../common/audit.service';
import { buildPage, decodeCursor } from '../../common/cursor';
import { OutboxService } from '../../common/outbox.service';
import { PrismaService } from '../../common/prisma.service';
import { assertRedacted, redactForModeration } from '../../common/redact';
import { loadEnv } from '../../config/env';
import { AI_MODERATION_PROVIDER, type AiModerationProvider } from '../../providers/providers';

/**
 * Modération et sécurité — 13-moderation.md.
 *
 * Ce module est CONSOMMÉ par tous les autres. Ce qui compte donc n'est pas sa
 * surface de routes mais son API interne, et trois méthodes la portent :
 *
 *   · `check()`      — le pipeline à la publication (§2). Synchrone, appelée
 *                      AVANT que le contenu existe, elle seule peut refuser une
 *                      publication.
 *   · `openCase()`   — l'ouverture d'un dossier, dédoublonnée, que les règles
 *                      automatiques des autres modules appellent (§4.4).
 *   · `analyze()`    — l'étape IA, asynchrone, appelée par le consommateur de la
 *                      file `moderation`. Elle masque, met en file, et
 *                      n'applique jamais qu'un masquage.
 *
 * TROIS PRINCIPES expliquent la forme du reste, et chacun a coûté une décision :
 *
 * 1. CE SERVICE N'ÉCRIT DANS AUCUNE TABLE D'UN AUTRE MODULE DE CONTENU. Masquer
 *    un post, un guide, une annonce demanderait de connaître douze tables, dont
 *    la moitié n'existe pas encore. Le masquage passe donc par l'événement
 *    `moderation.content_hidden`, que §10 confie justement à « tous les modules
 *    de contenu ». La seule exception est `users.status` sur une suspension :
 *    §4.2 l'exige explicitement, et la sanction n'aurait aucun effet sans elle.
 *
 * 2. LES DEUX TABLES D'AJOUT SEUL SONT TRAITÉES COMME TELLES. `moderation_actions`
 *    et `audit_logs` refusent UPDATE, DELETE et TRUNCATE par déclencheur
 *    (migrations 20260927050000 et 20260927051000). Aucune méthode ici ne les
 *    modifie, et une conséquence en découle qu'il vaut mieux connaître que
 *    découvrir : un `moderation_cases` qui porte une action NE PEUT PLUS ÊTRE
 *    SUPPRIMÉ, la cascade butant sur le déclencheur. La purge du §12 anonymise,
 *    elle ne supprime pas — et c'est heureux.
 *
 * 3. L'IA NE TRANCHE JAMAIS. `recordAction` refuse toute action autre que `HIDE`,
 *    `UNHIDE` et `NOTE` lorsqu'aucun compte équipe ne la porte. La règle dure du
 *    §2 n'est donc pas une intention de conception : c'est une garde au centre du
 *    chemin d'écriture, que tout appel automatique franchit.
 */

// ── Contextes ───────────────────────────────────────────────────────────────

/** Les quatre rôles de `staff_users.role` (15 §…). */
export type StaffRoleValue = 'SUPER_ADMIN' | 'CONTENT_ADMIN' | 'MODERATOR' | 'SUPPORT';

/**
 * Le contexte d'un membre de l'équipe.
 *
 * Il est passé en PARAMÈTRE et non lu d'un garde, parce que le garde n'existe
 * pas : le tronc commun n'a ni `StaffUser` dans la requête ni `@RequiresStaffRole`
 * (voir le rapport de livraison). Le jour où il arrivera, il n'aura qu'à
 * construire cet objet — la logique de rôle, elle, est déjà ici et déjà testée.
 */
export interface StaffContext {
  readonly staffId: string;
  readonly role: StaffRoleValue;
}

/** §2 : ce que `check()` reçoit. Le texte est le titre ET le corps, concaténés. */
export interface ModerationCheckInput {
  readonly subjectType: SubjectType;
  readonly subjectId: string;
  readonly authorUserId: string | null;
  readonly text: string;
}

export type SubjectType =
  | 'POST' | 'COMMENT' | 'TOPIC' | 'GUIDE' | 'HELP_REQUEST' | 'HELP_RESPONSE'
  | 'HOUSING' | 'JOB' | 'PRO' | 'EVENT' | 'MESSAGE' | 'USER' | 'COMMUNITY';

/**
 * Ce que `check()` rend. `blocked` est redondant avec `verdict` : c'est
 * volontaire, l'appelant n'a qu'une chose à lire pour décider s'il publie.
 */
export interface ModerationCheckResult {
  readonly verdict: 'ALLOW' | 'QUEUE' | 'BLOCK';
  readonly blocked: boolean;
  readonly source: 'LOCAL' | 'AI' | 'NONE';
  readonly labels: readonly ModerationLabelValue[];
  readonly score: number | null;
  readonly caseId: string | null;
  /**
   * Ce que l'appelant doit dire au membre, et rien d'autre :
   *   · `IN_REVIEW`            le contenu est masqué « en vérification » (§2.3) ;
   *   · `SELF_HARM_RESOURCES`  afficher l'encart de ressources (§2, dernier §).
   */
  readonly notice: 'IN_REVIEW' | 'SELF_HARM_RESOURCES' | null;
}

/**
 * Le travail déposé dans la file `moderation` — §2.3.
 *
 * Il ne transporte QUE du texte masqué. Le masquage est l'étape 2 du §2, donc
 * avant la mise en file : le texte brut ne quitte jamais la requête qui l'a reçu,
 * et rien de nominatif n'attend dans Redis.
 */
export interface AiAnalysisJob {
  readonly subjectType: SubjectType;
  readonly subjectId: string;
  readonly authorUserId: string | null;
  /** DÉJÀ passé par `redactForModeration` (§2.2). */
  readonly redactedText: string;
}

/**
 * Le port de mise en file. Une interface et non `QueueService` directement :
 * les tests d'intégration de ce module tournent alors sans Redis, comme ceux des
 * autres modules, et peuvent VÉRIFIER ce qui a été mis en file — c'est là qu'on
 * prouve qu'aucun numéro de téléphone n'y entre.
 */
export interface ModerationQueuePort {
  enqueue(job: AiAnalysisJob): Promise<void>;
}

export const MODERATION_QUEUE = Symbol('ModerationQueue');

// ── Sélections ──────────────────────────────────────────────────────────────

const CASE_LIST_SELECT = {
  id: true,
  createdAt: true,
  subjectType: true,
  subjectId: true,
  subjectAuthorUserId: true,
  source: true,
  priority: true,
  status: true,
  aiVerdict: true,
  aiLabels: true,
  aiScore: true,
  assignedStaffId: true,
  slaDueAt: true,
  resolution: true,
  resolvedAt: true,
} as const satisfies Prisma.ModerationCaseSelect;

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);
  private readonly cursorSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    @Inject(AI_MODERATION_PROVIDER) private readonly ai: AiModerationProvider,
    @Optional() @Inject(MODERATION_QUEUE) private readonly queue: ModerationQueuePort | null = null,
  ) {
    this.cursorSecret = loadEnv().CURSOR_SECRET;
  }

  private fail(code: ModerationErrorCode, details?: Record<string, unknown>): never {
    throw new ApiError(code, MODERATION_ERROR_MESSAGES[code], MODERATION_ERROR_CODES[code], details);
  }

  // ════════════════════════════════════════════════════════════════════════
  // §2 — Le pipeline à la publication. L'API que les autres modules appellent.
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Le point d'entrée de tout contenu textuel créé par un membre (§2).
   *
   * Trois étapes, dans l'ordre du §2, et l'ordre est le sujet :
   *
   *   1. RÈGLES LOCALES, synchrones. Seules elles peuvent refuser une
   *      publication : `BLOCK` immédiat, dossier priorité 1, et l'appelant lève
   *      `CONTENT_BLOCKED`. C'est la seule barrière qui agit avant que le
   *      contenu existe, donc la seule qui puisse l'empêcher d'exister.
   *   2. MASQUAGE (`redactForModeration`), ici et non plus loin : ce qui part en
   *      file est déjà masqué.
   *   3. MISE EN FILE de l'analyse IA. L'appelant n'attend pas : §2.3 la veut
   *      asynchrone, et une publication ne doit pas dépendre de la latence d'un
   *      sous-traitant.
   *
   * RÈGLE DURE (§2) : le texte n'atteint jamais l'IA sans masquage.
   * `assertRedacted` est appelée ici, à la mise en file, ET dans `analyze()`,
   * juste avant l'envoi réseau. Deux fois, parce qu'une seule suffit à protéger
   * le chemin qu'on a en tête et pas celui qu'on oublie.
   *
   * Un échec de mise en file NE BLOQUE PAS la publication : §2 veut une
   * modération, pas un point de panne unique. Le dossier est ouvert pour que
   * l'équipe relise — c'est le choix que `guides.service.ts` avait retenu, et il
   * est repris tel quel.
   */
  async check(input: ModerationCheckInput): Promise<ModerationCheckResult> {
    // ── 1. Règles locales ────────────────────────────────────────────────
    const rule = matchLocalRule(input.text);
    if (rule !== null) {
      this.logger.warn(`Publication bloquée par la règle locale ${rule} (13 §2.1)`);
      const caseId = await this.openCase({
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        subjectAuthorUserId: input.authorUserId,
        source: 'AI',
        // §3 : « contenu bloqué par l'IA » est en priorité 1.
        priority: 1,
        aiVerdict: 'BLOCK',
        labels: ['SCAM'],
        note: `Règle locale ${rule} (§2.1).`,
      });
      return {
        verdict: 'BLOCK',
        blocked: true,
        source: 'LOCAL',
        labels: [],
        score: null,
        caseId,
        notice: null,
      };
    }

    // ── 2. Masquage, AVANT la mise en file ───────────────────────────────
    const redacted = redactForModeration(input.text);
    // Ceinture de sécurité : si le masquage a laissé passer un numéro ou un
    // email, RIEN ne part. Le contenu est publié et un dossier est ouvert — un
    // contenu non analysé se relit, une donnée personnelle envoyée ne se reprend
    // pas.
    try {
      assertRedacted(redacted.text);
    } catch (error) {
      this.logger.error(`Masquage incomplet, analyse abandonnée : ${String(error)}`);
      const caseId = await this.openCase({
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        subjectAuthorUserId: input.authorUserId,
        source: 'AI',
        priority: 3,
        note: 'Masquage incomplet : analyse IA non effectuée, relecture humaine.',
      });
      return { verdict: 'QUEUE', blocked: false, source: 'NONE', labels: [], score: null, caseId, notice: null };
    }

    // ── 3. Analyse IA, asynchrone ────────────────────────────────────────
    if (this.queue === null) {
      // Aucun port de file : le contenu part, et l'équipe relira. Silencieux
      // serait pire — un module entier cesserait d'être analysé sans trace.
      this.logger.warn('File de modération absente : analyse IA non planifiée.');
      return { verdict: 'ALLOW', blocked: false, source: 'NONE', labels: [], score: null, caseId: null, notice: null };
    }

    try {
      await this.queue.enqueue({
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        authorUserId: input.authorUserId,
        redactedText: redacted.text,
      });
    } catch (error) {
      this.logger.warn(`Mise en file impossible, publication laissée passer : ${String(error)}`);
      const caseId = await this.openCase({
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        subjectAuthorUserId: input.authorUserId,
        source: 'AI',
        priority: 3,
        note: 'File de modération indisponible : relecture humaine.',
      });
      return { verdict: 'ALLOW', blocked: false, source: 'NONE', labels: [], score: null, caseId, notice: null };
    }

    return { verdict: 'ALLOW', blocked: false, source: 'NONE', labels: [], score: null, caseId: null, notice: null };
  }

  /**
   * Les règles locales seules, sans effet de bord (§2.1).
   *
   * Utile à un appelant qui valide un brouillon sans encore rien créer : il n'a
   * alors pas d'identifiant de sujet à donner à `check()`.
   */
  checkLocal(text: string): { blocked: boolean; rule: string | null } {
    const rule = matchLocalRule(text);
    return { blocked: rule !== null, rule };
  }

  /**
   * L'étape IA (§2.3 et §2.4). Appelée par le consommateur de la file
   * `moderation`, ou directement par un test.
   *
   * RÈGLE DURE (§2) : `assertRedacted` juste avant l'appel réseau. Le travail
   * arrive déjà masqué de `check()`, mais un travail rejoué, forgé, ou déposé par
   * un appelant futur ne le serait peut-être pas — et cette ligne est la
   * dernière avant la frontière.
   *
   * RÈGLE DURE (§2) : « L'IA ne suspend jamais un compte et ne supprime jamais
   * définitivement un contenu. » Ce qui suit ne fait que trois choses : écrire une
   * trace, ouvrir un dossier, et émettre `moderation.content_hidden`. Aucune
   * sanction, aucun `users.status`, aucun `REMOVED`.
   *
   * IDEMPOTENT : `openCase` dédoublonne sur le sujet, donc un rejeu ne crée pas
   * un second dossier. Il ajoute une ligne de trace dans `ai_moderation_checks`,
   * ce qui est correct — deux analyses ont réellement eu lieu.
   */
  async analyze(job: AiAnalysisJob): Promise<ModerationCheckResult> {
    // Lève si un numéro ou un email a survécu : le contenu N'EST PAS envoyé.
    assertRedacted(job.redactedText);

    let verdict: { labels: string[]; score: number; model: string; latencyMs: number };
    try {
      verdict = await this.ai.classify(job.redactedText);
    } catch (error) {
      // Un fournisseur indisponible ne doit pas être un point de panne unique :
      // le contenu reste publié et l'équipe relit. C'est le choix des guides, et
      // je le reprends — l'inverse (bloquer) rendrait toute publication
      // dépendante d'un service tiers, et une panne de dix minutes ferait
      // apparaître la plateforme comme cassée.
      this.logger.warn(`Modération IA indisponible, contenu laissé publié : ${String(error)}`);
      const caseId = await this.openCase({
        subjectType: job.subjectType,
        subjectId: job.subjectId,
        subjectAuthorUserId: job.authorUserId,
        source: 'AI',
        priority: 3,
        note: 'Fournisseur d’analyse indisponible : relecture humaine.',
      });
      return { verdict: 'QUEUE', blocked: false, source: 'AI', labels: [], score: null, caseId, notice: null };
    }

    const labels = verdict.labels.filter((l): l is ModerationLabelValue =>
      (
        ['SCAM', 'MONEY_REQUEST', 'HARASSMENT', 'HATE', 'SEXUAL', 'SPAM', 'SELF_HARM', 'OFF_TOPIC', 'OK'] as const
      ).includes(l as ModerationLabelValue),
    );
    const score = verdict.score;

    const selfHarm = labels.includes('SELF_HARM');
    const blocking = labels.filter((l) => AI_BLOCKING_LABELS.includes(l));

    // §2.3 : BLOCK au-delà de 0,8 SUR CES ÉTIQUETTES seulement. Un score élevé
    // sur `SPAM` ou `HARASSMENT` met en file, il ne masque pas.
    const aiVerdict: 'ALLOW' | 'QUEUE' | 'BLOCK' =
      score > AI_BLOCK_SCORE && blocking.length > 0
        ? 'BLOCK'
        : score >= AI_QUEUE_SCORE
          ? 'QUEUE'
          : 'ALLOW';

    // §2.4 : trace SANS le texte masqué — seulement étiquettes, score, latence.
    await this.prisma.aiModerationCheck.create({
      data: {
        id: newId(),
        subjectType: job.subjectType,
        subjectId: job.subjectId,
        model: verdict.model,
        verdict: aiVerdict,
        labels,
        score,
        // Vrai par construction : `assertRedacted` ci-dessus a laissé passer.
        redacted: true,
        latencyMs: verdict.latencyMs,
      },
    });

    // §2, dernier paragraphe : SELF_HARM ne bloque pas, dossier priorité 1 avec
    // consigne de bienveillance, et un encart de ressources pour l'auteur.
    // « Aucune autre action automatique » — donc pas de masquage, même si le
    // score est élevé et même si une autre étiquette bloquante l'accompagne.
    if (selfHarm) {
      const caseId = await this.openCase({
        subjectType: job.subjectType,
        subjectId: job.subjectId,
        subjectAuthorUserId: job.authorUserId,
        source: 'AI',
        priority: 1,
        aiVerdict,
        labels,
        score,
        note: SELF_HARM_CASE_NOTE,
      });
      return {
        verdict: 'QUEUE',
        blocked: false,
        source: 'AI',
        labels,
        score,
        caseId,
        notice: 'SELF_HARM_RESOURCES',
      };
    }

    if (aiVerdict === 'ALLOW') {
      return { verdict: 'ALLOW', blocked: false, source: 'AI', labels, score, caseId: null, notice: null };
    }

    const caseId = await this.openCase({
      subjectType: job.subjectType,
      subjectId: job.subjectId,
      subjectAuthorUserId: job.authorUserId,
      source: 'AI',
      // §3 : « contenu bloqué par l'IA » → priorité 1. Un QUEUE est en 2.
      priority: aiVerdict === 'BLOCK' ? 1 : 2,
      aiVerdict,
      labels,
      score,
    });

    if (aiVerdict === 'BLOCK') {
      // Le contenu est MASQUÉ, pas retiré, pas supprimé. C'est l'unique effet
      // automatique que la règle dure du §2 autorise.
      await this.hideAutomatically(caseId, job, labels);
      return { verdict: 'BLOCK', blocked: true, source: 'AI', labels, score, caseId, notice: 'IN_REVIEW' };
    }

    return { verdict: 'QUEUE', blocked: false, source: 'AI', labels, score, caseId, notice: null };
  }

  /**
   * Le masquage automatique : une action `HIDE` SANS compte équipe, plus
   * l'événement que les modules de contenu consomment (§10).
   *
   * `recordAction` refuse tout le reste quand le staff est nul : c'est la garde
   * de la règle dure, et elle est franchie ici à chaque analyse bloquante.
   */
  private async hideAutomatically(
    caseId: string,
    job: AiAnalysisJob,
    labels: readonly ModerationLabelValue[],
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.recordAction(tx, caseId, null, 'HIDE', `Masquage automatique : ${labels.join(', ')} (§2.3).`);
      await this.outbox.emit(tx, {
        type: 'moderation.content_hidden',
        aggregateId: job.subjectId,
        payload: {
          subjectType: job.subjectType,
          subjectId: job.subjectId,
          authorUserId: job.authorUserId,
          caseId,
          automatic: true,
          notice: CONTENT_IN_REVIEW_NOTICE,
        },
      });
    });
    await this.audit.recordSystem('moderation.content_hidden', 'moderation_case', caseId, {
      subjectType: job.subjectType,
      subjectId: job.subjectId,
      labels: [...labels],
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // §3, §4.4 — Dossiers : ouverture dédoublonnée
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Ouvre un dossier, ou rejoint celui qui est déjà ouvert sur le même sujet.
   *
   * §3 : « un dossier par sujet ouvert ». Le dédoublonnage porte sur le SUJET et
   * non sur la source : cinq signalements, une détection IA et une règle
   * automatique sur le même guide doivent aboutir au même dossier, sinon la file
   * du §4.1 devient illisible exactement quand elle sert le plus.
   *
   * La PRIORITÉ d'un dossier existant est relevée, jamais abaissée : un
   * signalement « Autre » arrivé après une détection d'arnaque ne doit pas
   * dégrader l'urgence. Et relever la priorité RECALCULE le délai (§4.1), sinon
   * un dossier promu en priorité 1 garderait ses 24 heures.
   */
  async openCase(input: {
    subjectType: SubjectType;
    subjectId: string;
    subjectAuthorUserId: string | null;
    source: 'REPORT' | 'AI' | 'RISK_SCORE' | 'AUTO_RULE';
    priority: number;
    aiVerdict?: 'ALLOW' | 'QUEUE' | 'BLOCK';
    labels?: readonly string[];
    score?: number;
    note?: string;
  }): Promise<string> {
    const existing = await this.prisma.moderationCase.findFirst({
      where: {
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        status: { in: ['OPEN', 'IN_REVIEW'] },
      },
      select: { id: true, priority: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    if (existing !== null) {
      if (input.priority < existing.priority) {
        await this.prisma.moderationCase.update({
          where: { id: existing.id },
          data: {
            priority: input.priority,
            // Recalculé depuis la création du dossier, non depuis maintenant :
            // le délai court depuis l'arrivée du sujet dans la file.
            slaDueAt: slaDueAt(input.priority, existing.createdAt),
          },
        });
      }
      if (input.note !== undefined) {
        await this.prisma.$transaction(async (tx) => {
          await this.recordAction(tx, existing.id, null, 'NOTE', input.note as string);
        });
      }
      return existing.id;
    }

    const id = newId();
    const createdAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.moderationCase.create({
        data: {
          id,
          createdAt,
          subjectType: input.subjectType,
          subjectId: input.subjectId,
          subjectAuthorUserId: input.subjectAuthorUserId,
          source: input.source,
          priority: input.priority,
          status: 'OPEN',
          aiLabels: [...(input.labels ?? [])],
          ...(input.aiVerdict === undefined ? {} : { aiVerdict: input.aiVerdict }),
          ...(input.score === undefined ? {} : { aiScore: input.score }),
          // RÈGLE DURE (§4.1) : priorité 1 → 4 h, tout le reste → 24 h.
          slaDueAt: slaDueAt(input.priority, createdAt),
        },
      });

      if (input.note !== undefined) {
        await this.recordAction(tx, id, null, 'NOTE', input.note);
      }

      await this.outbox.emit(tx, {
        type: 'moderation.case_opened',
        aggregateId: id,
        payload: {
          caseId: id,
          subjectType: input.subjectType,
          subjectId: input.subjectId,
          subjectAuthorUserId: input.subjectAuthorUserId,
          source: input.source,
          priority: input.priority,
        },
      });
    });

    return id;
  }

  // ════════════════════════════════════════════════════════════════════════
  // §3 — Signalements
  // ════════════════════════════════════════════════════════════════════════

  /**
   * `POST /reports` (§8.1).
   *
   * Un signalement par membre et par sujet : la contrainte d'unicité
   * `(reporter_user_id, subject_type, subject_id)` la porte, et le code
   * l'ANTICIPE par une lecture pour rendre `ALREADY_REPORTED` plutôt qu'une
   * erreur de base — mais attrape aussi la violation, parce que deux clics
   * simultanés passent tous les deux la lecture.
   *
   * ABUS DE SIGNALEMENT (§3) : « un membre dont 10 signalements consécutifs sont
   * classés DISMISSED voit ses signalements suivants rétrogradés en priorité 5 ».
   * Le calcul se fait AVANT l'insertion — le nouveau signalement ne doit pas
   * compter dans sa propre série.
   */
  async report(reporterUserId: string, input: CreateReport) {
    if (input.subjectType === 'USER' && input.subjectId === reporterUserId) {
      this.fail('SELF_REPORT');
    }

    // Signaler UN message précis (bulle) : il faut en être un lecteur légitime. Sans
    // ce contrôle, n'importe quel membre pouvait ouvrir un dossier sur un message
    // dont il ne connaît que l'identifiant — et la modération, qui peut lire la
    // conversation signalée (08 §5.2), l'aurait ouverte. 404, jamais 403 (T4 §3).
    // Son propre message ne se signale pas : il se supprime.
    if (input.subjectType === 'MESSAGE') {
      const message = await this.prisma.message.findUnique({
        where: { id: input.subjectId },
        select: { senderUserId: true, conversation: { select: { members: { select: { userId: true } } } } },
      });
      if (message === null || !message.conversation.members.some((m) => m.userId === reporterUserId)) {
        throw ApiError.notFound();
      }
      if (message.senderUserId === reporterUserId) this.fail('SELF_REPORT');
    }

    const already = await this.prisma.report.findUnique({
      where: {
        reporterUserId_subjectType_subjectId: {
          reporterUserId,
          subjectType: input.subjectType,
          subjectId: input.subjectId,
        },
      },
      select: { id: true },
    });
    if (already !== null) this.fail('ALREADY_REPORTED');

    const thresholds = await this.thresholds();
    const streak = await this.dismissedStreak(reporterUserId);
    const abusive = streak >= thresholds.dismissedStreak;

    const subjectAuthorUserId = await this.subjectAuthor(input.subjectType, input.subjectId);
    const priority = abusive ? 5 : reportPriority(input.reason, input.subjectType);

    const caseId = await this.openCase({
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      subjectAuthorUserId,
      source: 'REPORT',
      priority,
    });

    const reportId = newId();
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.report.create({
          data: {
            id: reportId,
            reporterUserId,
            subjectType: input.subjectType,
            subjectId: input.subjectId,
            reason: input.reason,
            details: input.details ?? null,
            // Rattaché dès la création : `NEW` décrirait un signalement sans
            // dossier, état qui n'existe pas ici puisque `openCase` précède.
            status: 'ATTACHED',
            caseId,
          },
        });

        await this.audit.record(tx, {
          actor: { type: 'MEMBER', id: reporterUserId },
          action: 'report.created',
          targetType: 'moderation_case',
          targetId: caseId,
          metadata: { reason: input.reason, subjectType: input.subjectType, priority },
        });

        await this.outbox.emit(tx, {
          type: 'report.created',
          aggregateId: reportId,
          payload: {
            reportId,
            caseId,
            reporterUserId,
            subjectType: input.subjectType,
            subjectId: input.subjectId,
            reason: input.reason,
            priority,
          },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        this.fail('ALREADY_REPORTED');
      }
      throw error;
    }

    if (abusive) await this.openReportAbuseCase(reporterUserId, streak);

    return { id: reportId, caseId, message: REPORT_CONFIRMATION };
  }

  /**
   * §6 : un modérateur bénévole « signale avec priorité +1 » vers l'équipe.
   *
   * DEUX refus explicites, et ils sont la règle dure du §6 : le bénévole ne
   * signale pas un message privé — « ils n'accèdent pas aux messages privés » —
   * et il doit être `MODERATOR` sur un réseau. Sans le premier refus, le
   * signalement d'un message joindrait la conversation à un dossier qu'il
   * pourrait ensuite demander à lire.
   */
  async reportAsVolunteerModerator(userId: string, input: CreateReport) {
    if (input.subjectType === 'MESSAGE') this.fail('OUT_OF_SCOPE', { subjectType: 'MESSAGE' });

    const isModerator = await this.prisma.communityMember.findFirst({
      where: { userId, role: 'MODERATOR', status: 'ACTIVE' },
      select: { id: true },
    });
    if (isModerator === null) this.fail('OUT_OF_SCOPE');

    const created = await this.report(userId, input);
    const escalated = escalatedPriority(reportPriority(input.reason, input.subjectType));
    const current = await this.prisma.moderationCase.findUniqueOrThrow({
      where: { id: created.caseId },
      select: { priority: true, createdAt: true },
    });
    if (escalated < current.priority) {
      await this.prisma.moderationCase.update({
        where: { id: created.caseId },
        data: { priority: escalated, slaDueAt: slaDueAt(escalated, current.createdAt) },
      });
    }
    return created;
  }

  /**
   * La série de signalements REJETÉS les plus récents (§3).
   *
   * « Consécutifs » se lit depuis le plus récent : on remonte tant que le
   * signalement est `DISMISSED`, et le premier qui ne l'est pas arrête le
   * compte. `reports.dismissed_streak` n'est pas stockée (§7) — c'est donc bien
   * un calcul, et il est fait sur une fenêtre bornée pour ne pas relire trois ans
   * de signalements.
   */
  async dismissedStreak(reporterUserId: string): Promise<number> {
    const recent = await this.prisma.report.findMany({
      where: { reporterUserId },
      select: { status: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    let streak = 0;
    for (const report of recent) {
      if (report.status !== 'DISMISSED') break;
      streak += 1;
    }
    return streak;
  }

  /** §3 et §4.4 : la série de rejets ouvre un dossier AUTO_RULE sur le signaleur. */
  private async openReportAbuseCase(reporterUserId: string, streak: number): Promise<void> {
    await this.openCase({
      subjectType: 'USER',
      subjectId: reporterUserId,
      subjectAuthorUserId: reporterUserId,
      source: 'AUTO_RULE',
      priority: 3,
      note: `Abus de signalement : ${streak} signalements consécutifs rejetés (§4.4).`,
    });
  }

  /**
   * L'auteur du sujet, quand ce module peut le connaître.
   *
   * Il ne lit QUE les tables des modules livrés. Un sujet dont le module n'existe
   * pas encore donne `null`, et le dossier s'ouvre sans auteur : c'est
   * `subject_author_user_id` nullable qui rend cela possible, et le modérateur
   * voit alors le sujet sans son historique — dégradé, mais pas bloqué.
   */
  private async subjectAuthor(subjectType: SubjectType, subjectId: string): Promise<string | null> {
    switch (subjectType) {
      case 'USER':
        return subjectId;
      case 'GUIDE': {
        const row = await this.prisma.guide.findUnique({
          where: { id: subjectId },
          select: { authorUserId: true },
        });
        return row?.authorUserId ?? null;
      }
      case 'HELP_REQUEST': {
        const row = await this.prisma.helpRequest.findUnique({
          where: { id: subjectId },
          select: { authorUserId: true },
        });
        return row?.authorUserId ?? null;
      }
      case 'HELP_RESPONSE': {
        const row = await this.prisma.helpResponse.findUnique({
          where: { id: subjectId },
          select: { authorUserId: true },
        });
        return row?.authorUserId ?? null;
      }
      case 'EVENT': {
        const row = await this.prisma.event.findUnique({
          where: { id: subjectId },
          select: { organizerUserId: true },
        });
        return row?.organizerUserId ?? null;
      }
      case 'TOPIC': {
        const row = await this.prisma.topic.findUnique({
          where: { id: subjectId },
          select: { authorUserId: true },
        });
        return row?.authorUserId ?? null;
      }
      case 'MESSAGE': {
        const row = await this.prisma.message.findUnique({
          where: { id: subjectId },
          select: { senderUserId: true },
        });
        return row?.senderUserId ?? null;
      }
      case 'COMMUNITY': {
        // « Signaler le réseau » : le créateur répond du réseau qu'il a ouvert.
        // Un réseau automatique n'en a pas — le dossier part sans auteur.
        const row = await this.prisma.community.findUnique({
          where: { id: subjectId },
          select: { createdByUserId: true },
        });
        return row?.createdByUserId ?? null;
      }
      default:
        return null;
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // §4.1 — La file
  // ════════════════════════════════════════════════════════════════════════

  /**
   * `GET /admin/moderation/cases` (§8.2). File unique, « triée par priorité puis
   * `sla_due_at` » (§4.1).
   *
   * LE `where` EST CONSTRUIT EN UN SEUL OBJET, et les conditions qui portent sur
   * la même clé sont rassemblées sous `AND`. Deux diffusions conditionnelles
   * posant chacune un `OR` s'écraseraient silencieusement — le second gagne, le
   * premier disparaît, et la liste devient fausse sans rien dire. C'est arrivé à
   * deux modules sur quatre ; le test `combinaison de filtres` est ici pour ça.
   */
  async listCases(staff: StaffContext, query: CasesQuery): Promise<Page<unknown>> {
    this.assertRole(staff, STAFF_SCOPES.moderation);
    const now = new Date();

    const and: Prisma.ModerationCaseWhereInput[] = [];
    if (query.assigned === 'me') and.push({ assignedStaffId: staff.staffId });
    if (query.assigned === 'nobody') and.push({ assignedStaffId: null });
    if (query.overdue === true) and.push({ slaDueAt: { lt: now }, status: { not: 'RESOLVED' } });
    if (query.overdue === false) and.push({ slaDueAt: { gte: now } });

    const where: Prisma.ModerationCaseWhereInput = {
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.priority === undefined ? {} : { priority: query.priority }),
      ...(query.subjectType === undefined ? {} : { subjectType: query.subjectType }),
      ...(and.length === 0 ? {} : { AND: and }),
    };

    const scope = `moderation:cases:${query.status ?? ''}:${query.priority ?? ''}:${query.assigned}:${query.subjectType ?? ''}:${String(query.overdue)}`;

    // Tri sur (priorité, délai, id) : `id` clôt le tri pour que la pagination
    // soit déterministe. Sans lui, deux dossiers de même priorité et même délai
    // pourraient s'échanger d'une page à l'autre, et l'un des deux ne serait
    // jamais vu.
    const rows = await this.prisma.moderationCase.findMany({
      where: this.withCursor(where, query.cursor, scope),
      orderBy: [{ priority: 'asc' }, { slaDueAt: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
      select: CASE_LIST_SELECT,
    });

    // `sortOf` est INDISPENSABLE : sans lui, `buildPage` n'encode que
    // l'identifiant, et la page suivante repart d'un `id >` — faux dès que le tri
    // n'est pas sur l'identifiant. Le test de pagination l'a montré en répétant
    // des lignes d'une page à l'autre, donc en en sautant d'autres.
    const page = buildPage(
      rows,
      query.limit,
      scope,
      this.cursorSecret,
      (row) => `${row.priority}|${row.slaDueAt.getTime()}`,
    );
    return {
      items: page.items.map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        subjectType: row.subjectType,
        subjectId: row.subjectId,
        source: row.source,
        priority: row.priority,
        status: row.status,
        assignedStaffId: row.assignedStaffId,
        slaDueAt: row.slaDueAt,
        // Calculé côté serveur (§9) : l'horloge d'un navigateur est réglable.
        sla: slaState(row.createdAt, row.slaDueAt, now),
        aiVerdict: row.aiVerdict,
        aiLabels: row.aiLabels,
        aiScore: row.aiScore === null ? null : Number(row.aiScore),
      })),
      nextCursor: page.nextCursor,
    };
  }

  /**
   * Le curseur, appliqué au TRI RÉEL de la file.
   *
   * Un `id > curseur` seul serait faux ici : le tri est (priorité, délai, id), et
   * la page suivante commence à la première ligne qui suit le triplet du dernier
   * élément — pas au premier identifiant supérieur. D'où le `sort` du curseur,
   * qui porte le couple priorité/délai encodé.
   */
  private withCursor(
    where: Prisma.ModerationCaseWhereInput,
    cursor: string | undefined,
    scope: string,
  ): Prisma.ModerationCaseWhereInput {
    if (cursor === undefined) return where;
    const decoded = decodeCursor(cursor, this.cursorSecret, scope);
    const [priorityPart, duePart] = String(decoded.sort ?? '').split('|');
    const priority = Number(priorityPart);
    const dueAt = new Date(Number(duePart));
    if (!Number.isFinite(priority) || Number.isNaN(dueAt.getTime())) {
      return { AND: [where, { id: { gt: decoded.id } }] };
    }
    return {
      AND: [
        where,
        {
          OR: [
            { priority: { gt: priority } },
            { priority, slaDueAt: { gt: dueAt } },
            { priority, slaDueAt: dueAt, id: { gt: decoded.id } },
          ],
        },
      ],
    };
  }

  /**
   * `GET /admin/moderation/cases/:id` (§8.2) : le sujet, les signalements,
   * l'analyse IA, l'historique de l'auteur, et la conversation SI le sujet est un
   * message.
   *
   * RÈGLE DURE (§6) : un modérateur bénévole ne lit pas une conversation privée.
   * Ici, cela se traduit par une garde de rôle sur un `StaffUser` : un bénévole
   * est un MEMBRE (`community_members.role`), il n'a pas de `staff_id`, et cette
   * méthode ne lui est donc pas accessible — c'est `reportAsVolunteerModerator`
   * qui borne ce qu'il peut faire.
   *
   * `moderation_cases.conversation_id` du §7 n'existe pas dans le schéma figé :
   * la conversation est RETROUVÉE depuis le message. Le résultat est le même et
   * ne demande aucune migration.
   */
  async caseDetail(staff: StaffContext, caseId: string) {
    this.assertRole(staff, STAFF_SCOPES.moderation);

    const found = await this.prisma.moderationCase.findUnique({
      where: { id: caseId },
      include: {
        reports: {
          select: { id: true, createdAt: true, reporterUserId: true, reason: true, details: true, status: true },
          orderBy: { createdAt: 'asc' },
        },
        actions: {
          select: { id: true, createdAt: true, staffId: true, action: true, reason: true },
          orderBy: { createdAt: 'asc' },
        },
        sanctions: { select: { id: true, type: true, reason: true, startsAt: true, endsAt: true } },
      },
    });
    if (found === null) throw ApiError.notFound();

    const checks = await this.prisma.aiModerationCheck.findMany({
      where: { subjectId: found.subjectId },
      select: { id: true, createdAt: true, model: true, verdict: true, labels: true, score: true, redacted: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const conversation =
      found.subjectType === 'MESSAGE' ? await this.conversationOf(found.subjectId) : null;

    return {
      id: found.id,
      createdAt: found.createdAt,
      subjectType: found.subjectType,
      subjectId: found.subjectId,
      subjectAuthorUserId: found.subjectAuthorUserId,
      source: found.source,
      priority: found.priority,
      status: found.status,
      assignedStaffId: found.assignedStaffId,
      slaDueAt: found.slaDueAt,
      sla: slaState(found.createdAt, found.slaDueAt),
      resolution: found.resolution,
      resolvedAt: found.resolvedAt,
      aiVerdict: found.aiVerdict,
      aiLabels: found.aiLabels,
      aiScore: found.aiScore === null ? null : Number(found.aiScore),
      reports: found.reports,
      actions: found.actions,
      sanctions: found.sanctions,
      aiChecks: checks.map((c) => ({ ...c, score: c.score === null ? null : Number(c.score) })),
      authorHistory:
        found.subjectAuthorUserId === null
          ? null
          : await this.authorHistory(found.subjectAuthorUserId, found.id),
      conversation,
    };
  }

  /**
   * La conversation jointe à un dossier dont le sujet est un message (§3).
   *
   * Les corps sont CHIFFRÉS au repos (08 §8.1) et ne sont pas déchiffrés ici : ce
   * service rend les métadonnées et les identifiants de messages. Le
   * déchiffrement appartient au module messagerie, qui possède la clé et le
   * contrôle d'accès — et qui n'est pas livré. La contrainte est signalée, pas
   * contournée par un déchiffrement posé au passage.
   */
  private async conversationOf(messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { conversationId: true },
    });
    if (message === null) return null;

    const messages = await this.prisma.message.findMany({
      where: { conversationId: message.conversationId },
      select: { id: true, senderUserId: true, sentAt: true, deletedAt: true },
      orderBy: { sentAt: 'asc' },
      take: 200,
    });
    return {
      conversationId: message.conversationId,
      messages,
      bodiesAvailable: false,
      note: 'Corps chiffrés au repos : le déchiffrement appartient au module messagerie (08 §8.1).',
    };
  }

  /** §8.2 : `GET /users/:id/moderation-history` — sanctions et dossiers. */
  async userModerationHistory(staff: StaffContext, userId: string) {
    this.assertRole(staff, STAFF_SCOPES.moderation);
    return this.authorHistory(userId, null);
  }

  private async authorHistory(userId: string, exceptCaseId: string | null) {
    const [sanctions, cases] = await Promise.all([
      this.prisma.sanction.findMany({
        where: { userId },
        select: {
          id: true, type: true, reason: true, startsAt: true, endsAt: true, liftedAt: true,
          createdAt: true, issuedByStaffId: true, caseId: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.moderationCase.findMany({
        where: {
          subjectAuthorUserId: userId,
          ...(exceptCaseId === null ? {} : { id: { not: exceptCaseId } }),
        },
        select: {
          id: true, createdAt: true, subjectType: true, source: true, priority: true,
          status: true, resolution: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);
    return { userId, sanctions, cases };
  }

  /**
   * `POST /cases/:id/assign` (§8.2).
   *
   * RÈGLE DURE (§4.3) : « rouvre le dossier en priorité 3 pour un AUTRE
   * modérateur ». Un dossier contesté refuse donc de s'assigner à quiconque a
   * déjà agi dessus. La table `moderation_actions` porte la réponse — elle est en
   * ajout seul, donc l'historique des décideurs est intact par construction, et
   * `appeal_reviewer_staff_id` du §7 (absente du schéma) n'est pas nécessaire.
   */
  async assignCase(staff: StaffContext, caseId: string) {
    this.assertRole(staff, STAFF_SCOPES.moderation);

    const found = await this.prisma.moderationCase.findUnique({
      where: { id: caseId },
      select: { id: true, status: true, assignedStaffId: true },
    });
    if (found === null) throw ApiError.notFound();
    if (found.status === 'RESOLVED') this.fail('CASE_RESOLVED');
    if (found.assignedStaffId !== null && found.assignedStaffId !== staff.staffId) {
      this.fail('CASE_ASSIGNED');
    }

    if (await this.isAppealed(caseId)) {
      const previous = await this.decidersOf(caseId);
      if (previous.includes(staff.staffId)) this.fail('SAME_REVIEWER');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.moderationCase.update({
        where: { id: caseId },
        data: { assignedStaffId: staff.staffId, status: 'IN_REVIEW' },
      });
      await this.audit.record(tx, {
        actor: { type: 'STAFF', id: staff.staffId },
        action: 'moderation.case_assigned',
        targetType: 'moderation_case',
        targetId: caseId,
      });
    });
    return { id: caseId, assignedStaffId: staff.staffId };
  }

  /** `POST /cases/:id/release` (§8.2) : le dossier revient en file. */
  async releaseCase(staff: StaffContext, caseId: string) {
    this.assertRole(staff, STAFF_SCOPES.moderation);
    const found = await this.prisma.moderationCase.findUnique({
      where: { id: caseId },
      select: { assignedStaffId: true, status: true },
    });
    if (found === null) throw ApiError.notFound();
    if (found.assignedStaffId !== null && found.assignedStaffId !== staff.staffId) {
      this.fail('CASE_ASSIGNED');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.moderationCase.update({
        where: { id: caseId },
        data: { assignedStaffId: null, status: found.status === 'RESOLVED' ? 'RESOLVED' : 'OPEN' },
      });
      await this.audit.record(tx, {
        actor: { type: 'STAFF', id: staff.staffId },
        action: 'moderation.case_released',
        targetType: 'moderation_case',
        targetId: caseId,
      });
    });
    return { id: caseId, assignedStaffId: null };
  }

  /** Les comptes équipe qui ont déjà TRANCHÉ sur ce dossier (§4.3). */
  private async decidersOf(caseId: string): Promise<string[]> {
    const actions = await this.prisma.moderationAction.findMany({
      where: { caseId, staffId: { not: null }, action: { not: 'NOTE' } },
      select: { staffId: true },
    });
    return [...new Set(actions.map((a) => a.staffId).filter((id): id is string => id !== null))];
  }

  /**
   * Le dossier porte-t-il une contestation ?
   *
   * `moderation_cases.appealed_at` du §7 n'existe pas dans le schéma figé. La
   * contestation est donc écrite comme une `NOTE` préfixée, dans la table
   * d'ajout seul : elle ne peut être ni effacée ni réécrite, ce qui est plus fort
   * que la colonne demandée. Le préfixe est le contrat entre `appeal()` et ici.
   */
  private async isAppealed(caseId: string): Promise<boolean> {
    const note = await this.prisma.moderationAction.findFirst({
      where: { caseId, action: 'NOTE', reason: { startsWith: APPEAL_NOTE_PREFIX } },
      select: { id: true },
    });
    return note !== null;
  }

  // ════════════════════════════════════════════════════════════════════════
  // §4.2 — Actions
  // ════════════════════════════════════════════════════════════════════════

  /**
   * `POST /cases/:id/actions` (§8.2). Le geste humain, et le seul qui sanctionne.
   *
   * TROIS RÈGLES DURES se rencontrent ici :
   *
   *   · §4.2 : « Une suspension ou un bannissement exige un motif d'au moins
   *     20 caractères. » Vérifié ici et pas seulement dans le schéma zod : une
   *     règle dure ne doit pas dépendre du chemin d'entrée, et ce service est
   *     appelé par la file et par les tâches autant que par HTTP.
   *   · §4.2 : `BAN_USER` est réservé au `SUPER_ADMIN`.
   *   · §4.3 : une contestation est tranchée par un AUTRE modérateur.
   *
   * Tout est dans UNE transaction avec `moderation_actions` et `audit_logs` : §4.2
   * veut la trace, et 15 §… veut qu'elle soit écrite avant le commit. Une
   * suspension sans trace, ou une trace sans suspension, sont toutes deux des
   * états dont on ne veut pas.
   */
  async act(staff: StaffContext, caseId: string, input: CaseAction) {
    this.assertRole(
      staff,
      input.action === 'BAN_USER' ? ['SUPER_ADMIN'] : STAFF_SCOPES.moderation,
      input.action === 'BAN_USER' ? 'BAN_REQUIRES_SUPER_ADMIN' : 'OUT_OF_SCOPE',
    );

    // RÈGLE DURE §4.2 : le motif long, revérifié hors du schéma.
    if (SANCTIONING_ACTIONS.includes(input.action) && input.reason.trim().length < SANCTION_REASON_MIN) {
      this.fail('REASON_TOO_SHORT', { min: SANCTION_REASON_MIN });
    }
    if (input.reason.trim().length < ACTION_REASON_MIN) {
      this.fail('REASON_TOO_SHORT', { min: ACTION_REASON_MIN });
    }
    if (input.action === 'SUSPEND_USER' && input.durationDays === undefined) {
      throw ApiError.validation([{ path: 'durationDays', code: 'REQUIRED' }]);
    }

    const found = await this.prisma.moderationCase.findUnique({
      where: { id: caseId },
      select: {
        id: true, status: true, assignedStaffId: true, subjectType: true, subjectId: true,
        subjectAuthorUserId: true, createdAt: true,
      },
    });
    if (found === null) throw ApiError.notFound();
    if (found.assignedStaffId !== null && found.assignedStaffId !== staff.staffId) {
      this.fail('CASE_ASSIGNED');
    }
    if (found.status === 'RESOLVED' && input.action !== 'NOTE') this.fail('CASE_RESOLVED');

    // RÈGLE DURE §4.3 : « pour un AUTRE modérateur ». Vérifié à l'action et pas
    // seulement à l'assignation : un dossier peut être traité sans assignation.
    if (input.action !== 'NOTE' && (await this.isAppealed(caseId))) {
      const previous = await this.decidersOf(caseId);
      if (previous.includes(staff.staffId)) this.fail('SAME_REVIEWER');
    }

    const target = found.subjectAuthorUserId;
    const sanctioning = SANCTIONING_ACTIONS.includes(input.action);
    if (sanctioning && target === null) {
      // Sanctionner exige de savoir QUI. Un dossier sans auteur connu (module de
      // contenu pas encore livré) ne peut porter qu'une action de contenu.
      this.fail('OUT_OF_SCOPE', { reason: 'auteur du sujet inconnu' });
    }

    const resolution = RESOLUTION_BY_ACTION[input.action];
    const now = new Date();
    let sanctionId: string | null = null;

    await this.prisma.$transaction(async (tx) => {
      await this.recordAction(tx, caseId, staff.staffId, input.action, input.reason.trim());

      // ── Sanctions (§4.2) ────────────────────────────────────────────────
      if (input.action === 'WARN' || input.action === 'SUSPEND_USER' || input.action === 'BAN_USER') {
        sanctionId = newId();
        const endsAt =
          input.action === 'SUSPEND_USER' && input.durationDays !== undefined
            ? new Date(now.getTime() + input.durationDays * 86_400_000)
            : null;
        await tx.sanction.create({
          data: {
            id: sanctionId,
            userId: target as string,
            type: input.action === 'WARN' ? 'WARNING' : input.action === 'SUSPEND_USER' ? 'SUSPENSION' : 'BAN',
            reason: input.reason.trim(),
            startsAt: now,
            endsAt,
            // NON NUL dans le schéma : la décision humaine est structurelle.
            issuedByStaffId: staff.staffId,
            caseId,
          },
        });
      }

      // §4.2 : suspension et bannissement changent le statut du compte et
      // révoquent les sessions. C'est la SEULE table d'un autre module que ce
      // service écrit, et §4.2 l'exige mot pour mot.
      if (input.action === 'SUSPEND_USER' || input.action === 'BAN_USER') {
        await tx.user.update({
          where: { id: target as string },
          data: { status: input.action === 'SUSPEND_USER' ? 'SUSPENDED' : 'DEACTIVATED' },
        });
        await tx.authSession.updateMany({
          where: { userId: target as string, revokedAt: null },
          data: { revokedAt: now },
        });
      }

      /**
       * LES NUMÉROS DU BANNI PASSENT EN LISTE NOIRE — 13 §4.2, et c'est ce qui
       * rend la règle « un banni ne peut pas se réinscrire » réellement tenue.
       *
       * Sans cette liste, la règle ne tenait qu'à `phone_numbers.phone_hmac`, qui
       * est unique : tant que le compte banni existe, une réinscription retombe
       * dessus et se fait refuser. Mais `users.status` vaut `DEACTIVATED` sur un
       * bannissement — la valeur `BANNED` n'existe pas dans l'énumération — et le
       * jour où ce compte est SUPPRIMÉ, `phone_numbers` est vidée : l'empreinte
       * redevient libre et le banni revient avec le même téléphone. Vérifié en
       * base avant d'écrire ces lignes.
       *
       * L'écriture est DANS la transaction de la sanction. Un bannissement dont la
       * liste noire n'aurait pas été écrite serait un bannissement contournable, et
       * rien ne le signalerait — c'est exactement le genre d'écart qu'on ne
       * découvre que le jour où quelqu'un l'exploite.
       *
       * `createMany` + `skipDuplicates` : l'empreinte est la clé primaire, et un
       * même numéro peut avoir déjà été banni sur un autre compte. Bannir deux fois
       * le même numéro est le même fait, pas une erreur.
       */
      if (input.action === 'BAN_USER') {
        const phones = await tx.phoneNumber.findMany({
          where: { userId: target as string },
          select: { phoneHmac: true },
        });
        if (phones.length > 0) {
          await tx.bannedPhoneHash.createMany({
            data: phones.map((phone) => ({ phoneHmac: phone.phoneHmac, sanctionId })),
            skipDuplicates: true,
          });
        }
      }

      // ── Contenu : un événement, jamais une écriture directe (§10) ────────
      const contentEvent = CONTENT_EVENT_BY_ACTION[input.action];
      if (contentEvent !== null) {
        await this.outbox.emit(tx, {
          type: contentEvent,
          aggregateId: found.subjectId,
          payload: {
            subjectType: found.subjectType,
            subjectId: found.subjectId,
            authorUserId: target,
            caseId,
            automatic: false,
            // Le motif n'accompagne QUE le retrait : §4.2 veut que l'auteur d'un
            // contenu retiré en soit informé « avec motif ». Un masquage, lui, ne
            // dit que « en vérification » (§2.3) — détailler apprendrait à
            // contourner.
            ...(input.action === 'REMOVE' ? { reason: input.reason.trim() } : {}),
          },
        });
      }

      if (input.action === 'SUSPEND_USER' || input.action === 'BAN_USER') {
        await this.outbox.emit(tx, {
          type: input.action === 'SUSPEND_USER' ? 'moderation.user_suspended' : 'moderation.user_banned',
          aggregateId: target as string,
          payload: {
            userId: target,
            caseId,
            sanctionId,
            ...(input.durationDays === undefined ? {} : { durationDays: input.durationDays }),
          },
        });
      }

      // ── Clôture (§4.1, §3) ──────────────────────────────────────────────
      if (resolution !== null) {
        await tx.moderationCase.update({
          where: { id: caseId },
          data: { status: 'RESOLVED', resolution, resolvedAt: now, assignedStaffId: staff.staffId },
        });
        // §3 : les signalements du dossier sont classés. `DISMISSED` sur un KEEP
        // — c'est ce classement que compte la série d'abus de signalement.
        await tx.report.updateMany({
          where: { caseId },
          data: { status: resolution === 'KEEP' ? 'DISMISSED' : 'RESOLVED' },
        });
        await this.outbox.emit(tx, {
          type: 'moderation.case_resolved',
          aggregateId: caseId,
          payload: { caseId, resolution, action: input.action, subjectId: found.subjectId },
        });
      }

      // RÈGLE DURE (15) : la trace d'audit AVANT le commit.
      await this.audit.record(tx, {
        actor: { type: 'STAFF', id: staff.staffId },
        action: `moderation.${input.action.toLowerCase()}`,
        targetType: 'moderation_case',
        targetId: caseId,
        metadata: {
          action: input.action,
          subjectType: found.subjectType,
          subjectId: found.subjectId,
          targetUserId: target,
          ...(input.durationDays === undefined ? {} : { durationDays: input.durationDays }),
          reason: input.reason.trim(),
        },
      });
    });

    return { caseId, action: input.action, resolution, sanctionId };
  }

  /**
   * L'écriture d'une ligne de `moderation_actions` — table en AJOUT SEUL.
   *
   * RÈGLE DURE (§2) : « L'IA ne suspend jamais un compte et ne supprime jamais
   * définitivement un contenu. Elle masque et met en file ; un humain tranche. »
   *
   * La garde est ICI, au point de passage obligé, et non à l'appelant : tout
   * chemin automatique (analyse IA, règle du §4.4, tâche planifiée) écrit par
   * cette méthode avec `staffId = null`, et n'a donc accès qu'à `HIDE`, `UNHIDE`
   * et `NOTE`. Une action sans compte équipe qui ne serait pas l'une des trois
   * est un bogue de programmation : elle lève, elle ne s'exécute pas à moitié.
   */
  private async recordAction(
    tx: Prisma.TransactionClient,
    caseId: string,
    staffId: string | null,
    action: ActionValue,
    reason: string,
  ): Promise<void> {
    if (staffId === null && !AUTOMATIC_ACTIONS.includes(action)) {
      throw new Error(
        `Règle dure 13 §2 : l'action ${action} exige une décision humaine. ` +
          'Une action automatique ne peut que masquer, rétablir ou annoter.',
      );
    }
    await tx.moderationAction.create({
      data: { id: newId(), caseId, staffId, action, reason },
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // §4.3 — Recours
  // ════════════════════════════════════════════════════════════════════════

  /** `GET /me/sanctions` (§8.1) : « Mes avertissements et suspensions ». */
  async mySanctions(userId: string) {
    const rows = await this.prisma.sanction.findMany({
      where: { userId },
      select: {
        id: true, createdAt: true, type: true, reason: true, startsAt: true, endsAt: true,
        liftedAt: true, caseId: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const appealed = await this.appealedSanctionIds(rows.map((r) => r.id));

    return {
      items: rows.map((row) => ({
        id: row.id,
        type: row.type,
        // La « règle enfreinte » du §8.1 : c'est le motif du modérateur, qui est
        // écrit pour être lu par le membre (§4.2 : « notification avec règle
        // enfreinte »).
        rule: row.reason,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        liftedAt: row.liftedAt,
        active: row.liftedAt === null && (row.endsAt === null || row.endsAt.getTime() > Date.now()),
        // §4.3 : « contester UNE FOIS ». Le front n'affiche le formulaire que si
        // c'est encore possible — et l'API refuse de toute façon.
        appealable: row.caseId !== null && !appealed.has(row.id),
      })),
      nextCursor: null,
    };
  }

  /**
   * `POST /sanctions/:id/appeal` (§8.1, §4.3).
   *
   * « Le membre sanctionné peut contester UNE FOIS → rouvre le dossier en
   * priorité 3 pour un AUTRE modérateur. Décision finale non contestable. »
   *
   * DEUX COLONNES DU §7 MANQUENT au schéma figé : `moderation_cases.appeal_text`,
   * `appealed_at`, et `sanctions.appealed`. La contestation est donc écrite en
   * `moderation_actions` — table en ajout seul — sous une `NOTE` préfixée. Elle y
   * est plus solide que dans une colonne : personne ne peut l'effacer ni la
   * réécrire. `ALREADY_APPEALED` se lit sur la présence de cette note.
   */
  async appeal(userId: string, sanctionId: string, input: Appeal) {
    const sanction = await this.prisma.sanction.findUnique({
      where: { id: sanctionId },
      select: { id: true, userId: true, caseId: true, type: true },
    });
    // 404 et non 403 : ne pas révéler l'existence d'une sanction d'un autre
    // membre (T4 §3).
    if (sanction === null || sanction.userId !== userId) throw ApiError.notFound();
    if (sanction.caseId === null) throw ApiError.notFound();

    const caseId = sanction.caseId;
    if (await this.isAppealed(caseId)) this.fail('ALREADY_APPEALED');

    const existing = await this.prisma.moderationCase.findUniqueOrThrow({
      where: { id: caseId },
      select: { createdAt: true },
    });

    await this.prisma.$transaction(async (tx) => {
      await this.recordAction(
        tx,
        caseId,
        null,
        'NOTE',
        `${APPEAL_NOTE_PREFIX}${input.text.trim()}`,
      );
      await tx.moderationCase.update({
        where: { id: caseId },
        data: {
          // Rouvert, et DÉSASSIGNÉ : le modérateur qui a tranché ne doit pas le
          // retrouver dans « mes dossiers » — §4.3 veut un autre examinateur.
          status: 'OPEN',
          assignedStaffId: null,
          priority: APPEAL_CASE_PRIORITY,
          slaDueAt: slaDueAt(APPEAL_CASE_PRIORITY, existing.createdAt),
          resolution: null,
          resolvedAt: null,
        },
      });
      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: userId },
        action: 'sanction.appealed',
        targetType: 'sanction',
        targetId: sanctionId,
        metadata: { caseId, sanctionType: sanction.type },
      });
    });

    return { sanctionId, caseId, status: 'OPEN' as const, priority: APPEAL_CASE_PRIORITY };
  }

  /** Les sanctions déjà contestées, parmi celles-ci. */
  private async appealedSanctionIds(sanctionIds: readonly string[]): Promise<Set<string>> {
    if (sanctionIds.length === 0) return new Set();
    const sanctions = await this.prisma.sanction.findMany({
      where: { id: { in: [...sanctionIds] }, caseId: { not: null } },
      select: { id: true, caseId: true },
    });
    const caseIds = sanctions.map((s) => s.caseId).filter((id): id is string => id !== null);
    if (caseIds.length === 0) return new Set();
    const notes = await this.prisma.moderationAction.findMany({
      where: { caseId: { in: caseIds }, action: 'NOTE', reason: { startsWith: APPEAL_NOTE_PREFIX } },
      select: { caseId: true },
    });
    const appealedCases = new Set(notes.map((n) => n.caseId));
    return new Set(sanctions.filter((s) => s.caseId !== null && appealedCases.has(s.caseId)).map((s) => s.id));
  }

  // ════════════════════════════════════════════════════════════════════════
  // §5 — Alertes arnaques
  // ════════════════════════════════════════════════════════════════════════

  /**
   * `GET /scam-alerts?cityId&countryId` (§8.1) : « Alertes actives ».
   *
   * DEUX PIÈGES SE CROISENT DANS CE `where`, et c'est la requête la plus
   * dangereuse du module :
   *
   * 1. `city_id` et `country_id` sont NULLABLES, et une alerte GLOBALE les a tous
   *    deux à `NULL`. Un `cityId: { in: [...] }` l'éliminerait — or une alerte
   *    globale doit apparaître partout. D'où `OR: [{ cityId: null }, { cityId }]`.
   * 2. Les deux filtres veulent chacun un `OR`. Deux diffusions conditionnelles
   *    posant la MÊME clé `OR` s'écrasent SILENCIEUSEMENT — la seconde gagne, et
   *    filtrer par ville ET par pays ne filtrerait plus que par pays. Les deux
   *    conditions sont donc empilées dans un `AND`, et le test
   *    `combinaison de deux filtres` vérifie précisément ce cas.
   */
  async listScamAlerts(query: ScamAlertsQuery): Promise<Page<unknown>> {
    const now = new Date();
    const and: Prisma.ScamAlertWhereInput[] = [
      // « Actives » : publiées, et non expirées.
      { publishedAt: { not: null, lte: now } },
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    ];

    if (query.cityId !== undefined) {
      and.push({ OR: [{ cityId: null }, { cityId: query.cityId }] });
    }
    if (query.countryId !== undefined) {
      and.push({ OR: [{ countryId: null }, { countryId: query.countryId }] });
    }
    if (query.pinnedOnly === true) and.push({ isPinned: true });

    const scope = `moderation:scam-alerts:${query.cityId ?? ''}:${query.countryId ?? ''}:${String(query.pinnedOnly)}`;
    const where: Prisma.ScamAlertWhereInput = { AND: and };

    const rows = await this.prisma.scamAlert.findMany({
      where:
        query.cursor === undefined
          ? where
          : { AND: [where, { id: { lt: decodeCursor(query.cursor, this.cursorSecret, scope).id } }] },
      // Les épinglées d'abord (§5 : « en tête »), puis les plus récentes.
      orderBy: [{ isPinned: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      select: {
        id: true, title: true, body: true, severity: true, cityId: true, countryId: true,
        isPinned: true, publishedAt: true, expiresAt: true,
      },
    });

    const page = buildPage(rows, query.limit, scope, this.cursorSecret);
    return { items: page.items, nextCursor: page.nextCursor };
  }

  /** §8.2 : CRUD des alertes, rôle `CONTENT_ADMIN`. */
  async createScamAlert(staff: StaffContext, input: ScamAlertWrite) {
    this.assertRole(staff, ['CONTENT_ADMIN', 'SUPER_ADMIN']);
    const id = newId();
    const publishedAt = input.publishedAt === undefined ? new Date() : new Date(input.publishedAt);

    await this.prisma.$transaction(async (tx) => {
      await tx.scamAlert.create({
        data: {
          id,
          title: input.title,
          body: input.body,
          severity: input.severity,
          cityId: input.cityId ?? null,
          countryId: input.countryId ?? null,
          isPinned: input.isPinned,
          publishedAt,
          expiresAt: input.expiresAt === undefined ? null : new Date(input.expiresAt),
          createdByStaffId: staff.staffId,
          relatedCaseId: input.relatedCaseId ?? null,
        },
      });
      await this.audit.record(tx, {
        actor: { type: 'STAFF', id: staff.staffId },
        action: 'scam_alert.published',
        targetType: 'scam_alert',
        targetId: id,
        metadata: { severity: input.severity, cityId: input.cityId ?? null, countryId: input.countryId ?? null },
      });
      await this.outbox.emit(tx, {
        type: 'scam_alert.published',
        aggregateId: id,
        payload: {
          scamAlertId: id,
          severity: input.severity,
          cityId: input.cityId ?? null,
          countryId: input.countryId ?? null,
        },
      });
    });
    return { id };
  }

  async updateScamAlert(staff: StaffContext, id: string, input: ScamAlertWrite) {
    this.assertRole(staff, ['CONTENT_ADMIN', 'SUPER_ADMIN']);
    const found = await this.prisma.scamAlert.findUnique({ where: { id }, select: { id: true } });
    if (found === null) throw ApiError.notFound();

    await this.prisma.$transaction(async (tx) => {
      await tx.scamAlert.update({
        where: { id },
        data: {
          title: input.title,
          body: input.body,
          severity: input.severity,
          cityId: input.cityId ?? null,
          countryId: input.countryId ?? null,
          isPinned: input.isPinned,
          ...(input.publishedAt === undefined ? {} : { publishedAt: new Date(input.publishedAt) }),
          expiresAt: input.expiresAt === undefined ? null : new Date(input.expiresAt),
          relatedCaseId: input.relatedCaseId ?? null,
        },
      });
      await this.audit.record(tx, {
        actor: { type: 'STAFF', id: staff.staffId },
        action: 'scam_alert.updated',
        targetType: 'scam_alert',
        targetId: id,
      });
    });
    return { id };
  }

  /**
   * §8.2 : la suppression d'une alerte. DÉPUBLICATION et non effacement :
   * l'historique public des alertes du §5 est une page dédiée, et une alerte
   * effacée en sortirait — ce qui reviendrait à réécrire l'histoire des arnaques
   * signalées. Elle est dépubliée et désépinglée.
   */
  async retireScamAlert(staff: StaffContext, id: string) {
    this.assertRole(staff, ['CONTENT_ADMIN', 'SUPER_ADMIN']);
    const found = await this.prisma.scamAlert.findUnique({ where: { id }, select: { id: true } });
    if (found === null) throw ApiError.notFound();

    await this.prisma.$transaction(async (tx) => {
      await tx.scamAlert.update({
        where: { id },
        data: { isPinned: false, expiresAt: new Date() },
      });
      await this.audit.record(tx, {
        actor: { type: 'STAFF', id: staff.staffId },
        action: 'scam_alert.retired',
        targetType: 'scam_alert',
        targetId: id,
      });
    });
    return { id, retired: true };
  }

  // ════════════════════════════════════════════════════════════════════════
  // §4.4 — Règles automatiques (consommateurs d'événements)
  // ════════════════════════════════════════════════════════════════════════

  /**
   * `user.blocked` → « Abus de blocage : 20 blocages / 30 jours → dossier
   * priorité 3 » (§4.4).
   *
   * IDEMPOTENT : `openCase` dédoublonne sur le sujet, donc un rejeu de
   * l'événement ne crée pas un second dossier. Le seuil vient de
   * `system_settings` (§4.4 : « modifiables sans déploiement »).
   *
   * `blocks.service.ts` se contentait de journaliser en attendant ce module —
   * l'abonnement à `user.blocked` rend la règle réelle sans le modifier.
   */
  async handleUserBlocked(blockerUserId: string): Promise<void> {
    const thresholds = await this.thresholds();
    const since = new Date(Date.now() - thresholds.blockAbuseWindowDays * 86_400_000);
    const count = await this.prisma.block.count({
      where: { blockerUserId, createdAt: { gte: since } },
    });
    if (count < thresholds.blockAbuseCount) return;

    await this.openCase({
      subjectType: 'USER',
      subjectId: blockerUserId,
      subjectAuthorUserId: blockerUserId,
      source: 'AUTO_RULE',
      priority: 3,
      note: `Abus de blocage : ${count} blocages en ${thresholds.blockAbuseWindowDays} jours (§4.4).`,
    });
  }

  /**
   * `report.created` → la règle d'abus de signalement (§3, §4.4).
   *
   * Elle est appliquée à la CRÉATION (dans `report()`) pour rétrograder le
   * signalement en cours, et ici pour le cas où un classement `DISMISSED`
   * ultérieur franchit le seuil sans qu'un nouveau signalement arrive.
   * Idempotent des deux côtés grâce au dédoublonnage de `openCase`.
   */
  async handleReportCreated(reportId: string): Promise<void> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: { reporterUserId: true },
    });
    if (report === null) return;
    const thresholds = await this.thresholds();
    const streak = await this.dismissedStreak(report.reporterUserId);
    if (streak >= thresholds.dismissedStreak) {
      await this.openReportAbuseCase(report.reporterUserId, streak);
    }
  }

  /**
   * `help_request.published`, `guide.published`, `event.published`… → l'analyse
   * du §10 (« Consommés : tout `*.published` »).
   *
   * Le TEXTE n'est pas dans l'événement — et ne doit pas y être : `domain_events`
   * est une table, et y écrire le corps d'un contenu en ferait une seconde copie
   * durable de ce que le membre a écrit. Le contenu est donc RELU depuis sa table.
   * Un type dont le module n'est pas livré est ignoré, sans lever : lever ferait
   * rejouer l'événement dix fois pour rien.
   */
  async handleContentPublished(subjectType: SubjectType, subjectId: string): Promise<void> {
    const content = await this.contentText(subjectType, subjectId);
    if (content === null) return;
    await this.check({
      subjectType,
      subjectId,
      authorUserId: content.authorUserId,
      text: content.text,
    });
  }

  private async contentText(
    subjectType: SubjectType,
    subjectId: string,
  ): Promise<{ text: string; authorUserId: string | null } | null> {
    if (subjectType === 'HELP_REQUEST') {
      const row = await this.prisma.helpRequest.findUnique({
        where: { id: subjectId },
        select: { title: true, body: true, authorUserId: true },
      });
      return row === null ? null : { text: `${row.title}\n\n${row.body}`, authorUserId: row.authorUserId };
    }
    if (subjectType === 'HELP_RESPONSE') {
      const row = await this.prisma.helpResponse.findUnique({
        where: { id: subjectId },
        select: { body: true, authorUserId: true },
      });
      return row === null ? null : { text: row.body, authorUserId: row.authorUserId };
    }
    if (subjectType === 'EVENT') {
      const row = await this.prisma.event.findUnique({
        where: { id: subjectId },
        select: { title: true, description: true, organizerUserId: true },
      });
      return row === null
        ? null
        : { text: `${row.title}\n\n${row.description ?? ''}`, authorUserId: row.organizerUserId };
    }
    return null;
  }

  /** §4.4 : les seuils, lus dans `system_settings`, défauts de `@app/shared`. */
  async thresholds(): Promise<ModerationThresholds> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: MODERATION_THRESHOLDS_SETTING_KEY },
      select: { value: true },
    });
    const stored = setting?.value;
    const out: ModerationThresholds = { ...MODERATION_THRESHOLD_DEFAULTS };
    if (stored === null || typeof stored !== 'object' || Array.isArray(stored)) return out;
    for (const key of Object.keys(out) as (keyof ModerationThresholds)[]) {
      const value = (stored as Record<string, unknown>)[key];
      // Un réglage partiel est accepté : l'équipe pose une clé, pas les six.
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) out[key] = value;
    }
    return out;
  }

  /** `GET/PUT /admin/moderation/settings` (§8.2). */
  async updateThresholds(staff: StaffContext, input: ModerationThresholds) {
    this.assertRole(staff, ['SUPER_ADMIN', 'CONTENT_ADMIN']);
    await this.prisma.$transaction(async (tx) => {
      await tx.systemSetting.upsert({
        where: { key: MODERATION_THRESHOLDS_SETTING_KEY },
        create: { key: MODERATION_THRESHOLDS_SETTING_KEY, value: input, updatedByStaffId: staff.staffId },
        update: { value: input, updatedByStaffId: staff.staffId },
      });
      // `audit_logs.target_id` est de type UUID : la clé d'un `system_settings`
      // — qui est une CHAÎNE — ne peut pas y entrer, et Postgres refuse
      // l'écriture. Elle passe donc par les métadonnées. Découvert en exécutant
      // le test, pas en relisant le schéma ; signalé dans le rapport.
      await this.audit.record(tx, {
        actor: { type: 'STAFF', id: staff.staffId },
        action: 'moderation.settings_updated',
        targetType: 'system_setting',
        metadata: { key: MODERATION_THRESHOLDS_SETTING_KEY, ...input },
      });
    });
    return input;
  }

  // ════════════════════════════════════════════════════════════════════════
  // §11 — Tâches planifiées
  // ════════════════════════════════════════════════════════════════════════

  /**
   * `moderation.release_stale`, horaire (§11) : « dossiers assignés sans action
   * depuis 2 h ».
   *
   * « Sans action » se lit dans `moderation_actions` : un dossier assigné dont
   * aucune action ne suit l'assignation revient en file. Comparer à `updatedAt`
   * serait faux — `updatedAt` bouge à chaque changement de priorité, et un
   * dossier promu garderait son assignation indéfiniment.
   */
  async releaseStaleAssignments(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - MODERATION_ASSIGNMENT_STALE_MS);
    const candidates = await this.prisma.moderationCase.findMany({
      where: { assignedStaffId: { not: null }, status: 'IN_REVIEW' },
      select: { id: true, updatedAt: true, assignedStaffId: true },
    });

    let released = 0;
    for (const found of candidates) {
      const lastAction = await this.prisma.moderationAction.findFirst({
        where: { caseId: found.id, staffId: found.assignedStaffId },
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
      });
      const lastTouch = lastAction?.createdAt ?? found.updatedAt;
      if (lastTouch.getTime() > cutoff.getTime()) continue;

      await this.prisma.moderationCase.update({
        where: { id: found.id },
        data: { assignedStaffId: null, status: 'OPEN' },
      });
      await this.audit.recordSystem('moderation.case_released_stale', 'moderation_case', found.id, {
        previousStaffId: found.assignedStaffId,
      });
      released += 1;
    }
    return released;
  }

  /**
   * `sanctions.expire`, horaire (§11) : « fin de suspension → ACTIVE +
   * notification ».
   *
   * Un membre ne repasse `ACTIVE` que si AUCUNE autre sanction active ne pèse sur
   * lui : deux suspensions qui se chevauchent, et la première à expirer
   * réactiverait le compte pendant la seconde.
   */
  async expireSanctions(now: Date = new Date()): Promise<number> {
    const expired = await this.prisma.sanction.findMany({
      where: { type: 'SUSPENSION', liftedAt: null, endsAt: { not: null, lte: now } },
      select: { id: true, userId: true },
    });

    let reinstated = 0;
    for (const sanction of expired) {
      const stillSanctioned = await this.prisma.sanction.findFirst({
        where: {
          userId: sanction.userId,
          id: { not: sanction.id },
          liftedAt: null,
          OR: [{ type: 'BAN' }, { type: 'SUSPENSION', endsAt: { gt: now } }],
        },
        select: { id: true },
      });

      await this.prisma.$transaction(async (tx) => {
        await tx.sanction.update({ where: { id: sanction.id }, data: { liftedAt: now } });
        if (stillSanctioned !== null) return;
        const user = await tx.user.findUnique({
          where: { id: sanction.userId },
          select: { status: true },
        });
        // Un compte supprimé ou en attente de suppression ne se réactive pas :
        // la fin d'une suspension ne doit pas annuler une demande de suppression.
        if (user === null || user.status !== 'SUSPENDED') return;
        await tx.user.update({ where: { id: sanction.userId }, data: { status: 'ACTIVE' } });
        await this.outbox.emit(tx, {
          type: 'moderation.user_reinstated',
          aggregateId: sanction.userId,
          payload: { userId: sanction.userId, sanctionId: sanction.id },
        });
      });
      reinstated += 1;
    }
    return reinstated;
  }

  /** `scam_alerts.expire`, quotidienne (§11) : les expirées sont désépinglées. */
  async expireScamAlerts(now: Date = new Date()): Promise<number> {
    const result = await this.prisma.scamAlert.updateMany({
      where: { isPinned: true, expiresAt: { not: null, lte: now } },
      data: { isPinned: false },
    });
    return result.count;
  }

  /**
   * `moderation.sla_alert`, toutes les 15 min (§11) : « alerte équipe si un
   * dossier priorité 1 dépasse 4 h ».
   *
   * Rend la liste plutôt que d'envoyer l'email : l'envoi appartient au module
   * notifications, et le planificateur n'existe pas encore. La règle, elle, est
   * ici et testée — c'est la partie qui ne doit pas attendre.
   */
  async overdueUrgentCases(now: Date = new Date()) {
    return this.prisma.moderationCase.findMany({
      where: { priority: 1, status: { in: ['OPEN', 'IN_REVIEW'] }, slaDueAt: { lt: now } },
      select: { id: true, createdAt: true, slaDueAt: true, subjectType: true, subjectId: true },
      orderBy: { slaDueAt: 'asc' },
    });
  }

  /** `GET /admin/moderation/stats` (§8.2) : délai moyen, file, respect du SLA. */
  async stats(staff: StaffContext, now: Date = new Date()) {
    this.assertRole(staff, STAFF_SCOPES.moderation);

    const byPriority = await this.prisma.moderationCase.groupBy({
      by: ['priority'],
      where: { status: { in: ['OPEN', 'IN_REVIEW'] } },
      _count: { _all: true },
    });

    const resolved = await this.prisma.moderationCase.findMany({
      where: { status: 'RESOLVED', resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true, slaDueAt: true },
      orderBy: { resolvedAt: 'desc' },
      take: 500,
    });

    const delays = resolved.map((r) => (r.resolvedAt as Date).getTime() - r.createdAt.getTime());
    const withinSla = resolved.filter((r) => (r.resolvedAt as Date).getTime() <= r.slaDueAt.getTime());

    return {
      openByPriority: Object.fromEntries(byPriority.map((r) => [r.priority, r._count._all])),
      overdueCount: await this.prisma.moderationCase.count({
        where: { status: { in: ['OPEN', 'IN_REVIEW'] }, slaDueAt: { lt: now } },
      }),
      resolvedSampleSize: resolved.length,
      averageResolutionMs:
        delays.length === 0 ? null : Math.round(delays.reduce((a, b) => a + b, 0) / delays.length),
      slaComplianceRate: resolved.length === 0 ? null : withinSla.length / resolved.length,
    };
  }

  /**
   * `moderation.purge_reports`, quotidienne (§11, §12).
   *
   * ANONYMISE, ne supprime pas. §12 : « Signalements émis : conservés
   * anonymisés. » Et techniquement, supprimer serait de toute façon impossible :
   * `reports.reporter_user_id` est NON NUL et la suppression du dossier
   * cascaderait sur `moderation_actions`, table en ajout seul dont le déclencheur
   * refuse le DELETE. La contrainte de base et la règle de conservation disent la
   * même chose — c'est rassurant.
   */
  async purgeOldReportDetails(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - REPORT_RETENTION_DAYS * 86_400_000);
    const result = await this.prisma.report.updateMany({
      where: { createdAt: { lt: cutoff }, details: { not: null } },
      data: { details: null },
    });
    return result.count;
  }

  /**
   * `user.deleted` (§12) : « Signalements émis : conservés anonymisés. Dossiers où
   * le membre est l'auteur : conservés anonymisés (obligation de traçabilité). »
   *
   * Le DÉTAIL rédigé par le membre part — c'est son texte. Le lien reste : la
   * ligne `reports.reporter_user_id` est NON NULLE, et la cascade de
   * `users` la supprimera de toute façon quand la ligne du membre disparaîtra. Ce
   * qui doit survivre est le DOSSIER, et `subject_author_user_id` est en
   * `SetNull` : l'anonymisation est structurelle.
   *
   * IDEMPOTENT : rejouable sans effet supplémentaire.
   */
  async handleUserDeleted(userId: string): Promise<void> {
    await this.prisma.report.updateMany({
      where: { reporterUserId: userId, details: { not: null } },
      data: { details: null },
    });
    await this.prisma.moderationCase.updateMany({
      where: { subjectAuthorUserId: userId },
      data: { subjectAuthorUserId: null },
    });
    this.logger.log(`Modération : signalements et dossiers anonymisés pour ${userId.slice(0, 8)}…`);
  }

  // ── Gardes ────────────────────────────────────────────────────────────────

  /**
   * La garde de rôle.
   *
   * Elle est DANS le service et non dans un décorateur, parce que
   * `@RequiresStaffRole` n'existe pas dans le tronc commun. Ce n'est pas un choix
   * : c'est une dépendance non satisfaite, signalée dans le rapport. La logique
   * étant ici, le garde à venir n'aura rien à dupliquer.
   */
  private assertRole(
    staff: StaffContext,
    allowed: readonly StaffRoleValue[],
    code: ModerationErrorCode = 'OUT_OF_SCOPE',
  ): void {
    if (!allowed.includes(staff.role)) this.fail(code, { role: staff.role, allowed: [...allowed] });
  }

  /**
   * Le compte équipe existe-t-il et est-il actif ?
   *
   * À appeler par le garde à venir, pas à chaque action : le contexte est censé
   * venir d'une session vérifiée. Exposé pour que le garde n'ait pas à écrire
   * cette requête.
   */
  async resolveStaff(staffId: string): Promise<StaffContext | null> {
    const staff = await this.prisma.staffUser.findUnique({
      where: { id: staffId },
      select: { id: true, role: true, isActive: true },
    });
    if (staff === null || !staff.isActive) return null;
    return { staffId: staff.id, role: staff.role };
  }
}

// ── Tables de correspondance ────────────────────────────────────────────────

/**
 * Les trois seules actions qu'un chemin AUTOMATIQUE peut écrire (règle dure §2).
 *
 * `UNHIDE` y figure pour la tâche qui rétablit un contenu dont le dossier expire
 * sans décision : rétablir est le geste sûr, masquer était le geste prudent.
 */
const AUTOMATIC_ACTIONS: readonly ActionValue[] = ['HIDE', 'UNHIDE', 'NOTE'];

/** Les huit valeurs de `moderation_action_type`. */
type ActionValue = CaseAction['action'];

/** §4.2 : ce que chaque action fait du dossier. `null` = le dossier reste ouvert. */
const RESOLUTION_BY_ACTION: Record<ActionValue, 'KEEP' | 'HIDE' | 'REMOVE' | 'WARN' | 'SUSPEND' | null> = {
  DISMISS: 'KEEP',
  HIDE: 'HIDE',
  UNHIDE: 'KEEP',
  REMOVE: 'REMOVE',
  WARN: 'WARN',
  SUSPEND_USER: 'SUSPEND',
  // `moderation_resolution` n'a pas de valeur `BAN` : le schéma est figé, et
  // `SUSPEND` est la seule qui décrive « compte privé d'accès ». Signalé.
  BAN_USER: 'SUSPEND',
  NOTE: null,
};

/** §10 : l'événement de contenu qu'une action émet, s'il y en a un. */
const CONTENT_EVENT_BY_ACTION: Record<
  ActionValue,
  'moderation.content_hidden' | 'moderation.content_restored' | 'moderation.content_removed' | null
> = {
  HIDE: 'moderation.content_hidden',
  UNHIDE: 'moderation.content_restored',
  DISMISS: 'moderation.content_restored',
  REMOVE: 'moderation.content_removed',
  WARN: null,
  SUSPEND_USER: null,
  // §4.2 : « contenus conservés » sur une suspension, et le bannissement
  // désactive le compte — ni l'un ni l'autre ne touche un contenu.
  BAN_USER: null,
  NOTE: null,
};

/**
 * Le préfixe qui identifie une contestation dans `moderation_actions.reason`.
 *
 * Substitut aux colonnes `appeal_text` / `appealed_at` du §7, absentes du schéma
 * figé. Un préfixe dans une table d'ajout seul est un contrat fragile — il est
 * déclaré ici, en un seul endroit, et signalé comme dette dans le rapport.
 */
export const APPEAL_NOTE_PREFIX = '[CONTESTATION] ';

/** Exporté pour le test : la page de ressources que l'encart du §2 doit viser. */
export { SELF_HARM_RESOURCE_PAGE_SLUG };
