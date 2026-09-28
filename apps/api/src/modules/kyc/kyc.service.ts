import { createHmac, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { newId, type Prisma } from '@app/db';
import {
  ACCOUNT_ERROR_CODES,
  ACCOUNT_ERROR_MESSAGES,
  ACCOUNT_LIMITS,
  AUDIT_ACTIONS,
  AUTH_ERROR_CODES,
  AUTH_ERROR_MESSAGES,
  type AccountErrorCode,
  type KycStatusResponse,
  diditWebhookSchema,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { AuditService } from '../../common/audit.service';
import { OutboxService } from '../../common/outbox.service';
import { PrismaService } from '../../common/prisma.service';
import { loadEnv } from '../../config/env';
import { KYC_PROVIDER, type KycProvider } from '../../providers/providers';
import { VerificationLevelService } from '../users/verification-level.service';

/**
 * Vérification d'identité — 01-identite.md §2.3, §2.4 et §4.3.
 *
 * RÈGLE DURE (§1.2, §8.1) : aucune pièce d'identité n'est reçue ni stockée. Didit
 * les traite ; on ne conserve QUE le statut, la date de décision et `is_adult`.
 * Cette règle n'est pas défendue ici par de la vigilance mais par le TYPE : le
 * corps du webhook passe par `diditWebhookSchema`, qui dépouille toute clé
 * inconnue, et l'objet qui atteint l'`update` ne porte physiquement aucun nom, ni
 * date de naissance, ni document. C'est la seule forme de garantie qui survive à
 * une relecture distraite.
 *
 * DEUX CHEMINS mènent à un statut, et le deuxième n'est pas un luxe :
 *   · le WEBHOOK signé, qui fait foi (§4.3) ;
 *   · l'interrogation directe du fournisseur, que §2.3 autorise (« le client peut
 *     aussi interroger l'état ») — mais qui n'est PAS branchée ici : voir le
 *     rapport, `GET /me/kyc` lit la base et non le fournisseur, pour que la
 *     lecture du membre ne dépende pas de la disponibilité de Didit.
 *
 * Le passage de niveau n'est PAS calculé ici : §7.2 en fait une fonction de l'état
 * complet (KYC + numéros), et `VerificationLevelService` en est le seul auteur.
 */

/** Ce que Didit envoie comme en-tête de signature (T4 §8 : « en-tête HMAC »). */
const SIGNATURE_HEADERS = ['x-signature', 'x-didit-signature'] as const;

/** Les statuts qui closent une session : ils portent `decided_at`. */
const DECIDED_STATUSES = ['APPROVED', 'DECLINED'] as const;

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly levels: VerificationLevelService,
    @Inject(KYC_PROVIDER) private readonly provider: KycProvider,
  ) {}

  private fail(code: AccountErrorCode, details?: Record<string, unknown>): never {
    throw new ApiError(code, ACCOUNT_ERROR_MESSAGES[code], ACCOUNT_ERROR_CODES[code], details);
  }

  // ── POST /me/kyc/session (§4.3) ───────────────────────────────────────────

  /**
   * Ouvre une session Didit et rend l'URL hébergée que le membre suit.
   *
   * L'ORDRE DES REFUS est le seul choix discutable de cette méthode, et il est
   * délibéré : la limite des 30 jours est éprouvée AVANT le délai de 24 h.
   * L'inverse dirait « revenez dans 24 heures » à un membre qui, 24 heures plus
   * tard, se verrait refuser pour un mois. On annonce la contrainte qui borne
   * réellement, jamais la plus proche.
   */
  async createSession(
    userId: string,
    now: Date = new Date(),
  ): Promise<{ sessionId: string; verificationUrl: string; expiresAt: Date }> {
    const history = await this.prisma.kycVerification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        isAdult: true,
        createdAt: true,
        decidedAt: true,
      },
    });

    // §2.3 : un mineur est écarté définitivement. Le garde refuse déjà son jeton
    // (compte désactivé), mais la règle se redit ici : ce service est aussi appelé
    // par la file et par l'équipe.
    if (history.some((v) => v.isAdult === false)) {
      throw new ApiError(
        'ACCOUNT_MINOR',
        AUTH_ERROR_MESSAGES.ACCOUNT_MINOR,
        AUTH_ERROR_CODES.ACCOUNT_MINOR,
      );
    }

    const latest = history[0];
    if (latest !== undefined) {
      if (latest.status === 'APPROVED') this.fail('KYC_ALREADY_APPROVED');
      if (latest.status === 'IN_REVIEW') this.fail('KYC_IN_REVIEW');
    }

    const windowStart = new Date(
      now.getTime() - ACCOUNT_LIMITS.kycAttemptWindowDays * 86_400_000,
    );
    const attemptsUsed = history.filter((v) => v.createdAt.getTime() >= windowStart.getTime()).length;
    if (attemptsUsed >= ACCOUNT_LIMITS.kycMaxAttempts) {
      this.fail('KYC_MAX_ATTEMPTS', {
        attemptsUsed,
        attemptsMax: ACCOUNT_LIMITS.kycMaxAttempts,
        windowDays: ACCOUNT_LIMITS.kycAttemptWindowDays,
      });
    }

    const retryAt = this.retryAvailableAt(latest ?? null);
    if (retryAt !== null && retryAt.getTime() > now.getTime()) {
      this.fail('KYC_RETRY_TOO_SOON', { retryAvailableAt: retryAt.toISOString() });
    }

    const created = await this.provider.createSession(userId);
    const expiresAt = new Date(now.getTime() + ACCOUNT_LIMITS.kycSessionExpiryHours * 3_600_000);

    await this.prisma.$transaction(async (tx) => {
      /**
       * Une session laissée en route devient `ABANDONED`, et non `EXPIRED`.
       *
       * Les deux existent dans l'enum et ne disent pas la même chose : `EXPIRED`
       * est le verdict de la tâche horaire après 48 h sans résultat, `ABANDONED`
       * est le constat qu'un membre a recommencé. Confondre les deux ferait perdre
       * la seule information utile — combien de membres repartent à zéro plutôt que
       * de finir le parcours Didit.
       */
      if (latest !== undefined && latest.status === 'IN_PROGRESS') {
        await tx.kycVerification.update({
          where: { id: latest.id },
          data: { status: 'ABANDONED' },
        });
      }

      await tx.kycVerification.create({
        data: {
          id: newId(),
          userId,
          provider: 'DIDIT',
          providerSessionId: created.providerSessionId,
          status: 'IN_PROGRESS',
          expiresAt,
        },
      });
    });

    /**
     * AUCUN `kyc.status_changed` ici, et c'est voulu.
     *
     * §7 attache cet événement au WEBHOOK. Son consommateur notifie le membre
     * (« votre vérification d'identité a avancé ») : l'émettre à l'ouverture
     * enverrait une notification à quelqu'un qui vient de cliquer sur le bouton et
     * qui a l'écran sous les yeux. Aucun recalcul de niveau non plus — `APPROVED`
     * bloque l'ouverture, donc ouvrir une session ne peut jamais faire retomber un
     * membre d'un niveau.
     */
    this.logger.log(`Session KYC ouverte pour ${userId} : ${created.providerSessionId}`);

    return {
      sessionId: created.providerSessionId,
      verificationUrl: created.verificationUrl,
      expiresAt,
    };
  }

  // ── GET /me/kyc (§4.3) ────────────────────────────────────────────────────

  /** Le statut courant, et de quoi afficher les six états de §6. */
  async status(userId: string, now: Date = new Date()): Promise<KycStatusResponse> {
    const history = await this.prisma.kycVerification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        providerSessionId: true,
        status: true,
        isAdult: true,
        declineReasonCode: true,
        decidedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    const latest = history[0];
    const windowStart = new Date(
      now.getTime() - ACCOUNT_LIMITS.kycAttemptWindowDays * 86_400_000,
    );
    const attemptsUsed = history.filter((v) => v.createdAt.getTime() >= windowStart.getTime()).length;

    if (latest === undefined) {
      return {
        status: 'NOT_STARTED',
        sessionId: null,
        decidedAt: null,
        expiresAt: null,
        declineReasonCode: null,
        retryAvailableAt: null,
        attemptsUsed: 0,
        attemptsMax: ACCOUNT_LIMITS.kycMaxAttempts,
        isMinor: false,
      };
    }

    const retryAt = this.retryAvailableAt(latest);

    return {
      status: latest.status,
      sessionId: latest.providerSessionId,
      decidedAt: latest.decidedAt?.toISOString() ?? null,
      expiresAt: latest.expiresAt?.toISOString() ?? null,
      declineReasonCode: latest.declineReasonCode,
      retryAvailableAt: retryAt?.toISOString() ?? null,
      attemptsUsed,
      attemptsMax: ACCOUNT_LIMITS.kycMaxAttempts,
      // Sur TOUT l'historique : un membre déclaré mineur une fois l'est pour
      // toujours, et son compte ne se rouvre pas (§2.3).
      isMinor: history.some((v) => v.isAdult === false),
    };
  }

  /**
   * Quand une nouvelle tentative devient possible (§2.3 : « délai 24 h » après un
   * `DECLINED`).
   *
   * `EXPIRED` et `ABANDONED` n'ouvrent AUCUN délai : §2.3 ne l'impose qu'après un
   * refus. Un membre dont la session a expiré parce qu'il a fermé l'onglet n'a rien
   * à purger — le faire attendre un jour pour cela serait une punition sans motif.
   */
  private retryAvailableAt(
    latest: { status: string; decidedAt: Date | null; createdAt: Date } | null,
  ): Date | null {
    if (latest === null || latest.status !== 'DECLINED') return null;
    const from = latest.decidedAt ?? latest.createdAt;
    return new Date(from.getTime() + ACCOUNT_LIMITS.kycRetryDelayHours * 3_600_000);
  }

  // ── POST /webhooks/didit (§4.3, T4 §8) ────────────────────────────────────

  /**
   * Le webhook signé. « Idempotent sur `provider_session_id` + statut » (§4.3).
   *
   * Rend TOUJOURS 200 dès que la signature est bonne, même pour une session
   * inconnue ou un statut déjà appliqué : T4 §8 demande « réponse 200 rapide », et
   * un 404 ferait réessayer Didit indéfiniment pour une session que nous n'avons
   * pas — par exemple celle d'un compte supprimé entre-temps.
   */
  async applyWebhook(
    rawBody: Buffer | undefined,
    headers: Record<string, unknown>,
    now: Date = new Date(),
  ): Promise<{ received: true; applied: boolean; reason?: string }> {
    const secret = loadEnv().DIDIT_WEBHOOK_SECRET;
    if (secret === undefined) {
      // Pas un refus du fournisseur mais un défaut de configuration : il est dit
      // en toutes lettres dans le journal, et la route refuse plutôt que d'accepter
      // un « KYC approuvé » de n'importe qui.
      this.logger.error(
        'DIDIT_WEBHOOK_SECRET absent : aucun webhook KYC ne peut être vérifié (§4.3).',
      );
      this.fail('WEBHOOK_SIGNATURE_INVALID');
    }

    if (rawBody === undefined) {
      /**
       * Le corps BRUT est indispensable : la signature porte sur les octets reçus,
       * et `JSON.stringify` d'un objet déjà analysé ne les reproduit pas (ordre des
       * clés, espaces, échappements Unicode). Son absence signifie que
       * l'application a été construite sans `rawBody: true` — un défaut de câblage,
       * pas une requête invalide.
       */
      this.logger.error(
        'Corps brut indisponible : l’application doit être créée avec `rawBody: true` ' +
          '(voir main.ts), sinon la signature du webhook ne peut pas être vérifiée.',
      );
      this.fail('WEBHOOK_SIGNATURE_INVALID');
    }

    if (!this.signatureMatches(rawBody, headers, secret)) {
      this.fail('WEBHOOK_SIGNATURE_INVALID');
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw ApiError.validation([{ path: 'body', code: 'INVALID_JSON' }]);
    }

    /**
     * Ici, et seulement ici, la règle dure devient structurelle : ce que zod rend
     * ne contient QUE les quatre champs autorisés par §2.3.
     *
     * `safeParse` et NON `parse`. BOGUE TROUVÉ AU CURL : un `parse` laisse remonter
     * une `ZodError` brute, que le filtre d'erreurs ne connaît pas — la route
     * répondait `500 INTERNAL_ERROR` sur un corps mal formé. Deux conséquences, et
     * la seconde est la pire : la réponse ne respectait pas le format de T4 §3, et
     * un `5xx` fait RÉESSAYER le fournisseur indéfiniment sur une charge qu'on
     * n'acceptera jamais. Un `400` dit « ne renvoyez pas celle-là ».
     */
    const parsed = diditWebhookSchema.safeParse(parsedJson);
    if (!parsed.success) {
      throw ApiError.validation(
        parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          code: issue.code.toUpperCase(),
        })),
      );
    }
    const payload = parsed.data;

    const existing = await this.prisma.kycVerification.findUnique({
      where: { providerSessionId: payload.sessionId },
      select: { id: true, userId: true, status: true, isAdult: true },
    });
    if (existing === null) {
      this.logger.warn(`Webhook Didit pour une session inconnue : ${payload.sessionId}`);
      return { received: true, applied: false, reason: 'SESSION_UNKNOWN' };
    }

    /**
     * L'IDEMPOTENCE, sur la paire (session, statut) que §4.3 nomme.
     *
     * `is_adult` entre dans la comparaison parce qu'un fournisseur peut confirmer
     * le même statut en précisant la majorité au second envoi. Sans lui, le
     * deuxième message serait ignoré et un mineur resterait actif.
     */
    const adultUnchanged =
      payload.isAdult === undefined || payload.isAdult === existing.isAdult;
    if (existing.status === payload.status && adultUnchanged) {
      return { received: true, applied: false, reason: 'ALREADY_APPLIED' };
    }

    await this.applyStatus({
      verificationId: existing.id,
      userId: existing.userId,
      from: existing.status,
      status: payload.status,
      isAdult: payload.isAdult,
      declineReasonCode: payload.declineReasonCode,
      now,
      source: 'webhook',
    });

    return { received: true, applied: true };
  }

  /**
   * Vérifie la signature HMAC-SHA256 du corps brut, en temps constant.
   *
   * Deux en-têtes acceptés : Didit a documenté `x-signature`, et certaines
   * intégrations envoient `x-didit-signature`. Accepter les deux coûte une boucle ;
   * n'en accepter qu'un se découvre en production, quand le premier webhook réel
   * repart en 401 et qu'aucun membre ne passe L1.
   */
  private signatureMatches(
    rawBody: Buffer,
    headers: Record<string, unknown>,
    secret: string,
  ): boolean {
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    for (const name of SIGNATURE_HEADERS) {
      const given = headers[name];
      if (typeof given !== 'string' || given.length === 0) continue;
      const a = Buffer.from(expected, 'utf8');
      const b = Buffer.from(given.trim().toLowerCase(), 'utf8');
      if (a.length === b.length && timingSafeEqual(a, b)) return true;
    }
    return false;
  }

  // ── Application d'un statut ───────────────────────────────────────────────

  /**
   * Écrit le statut, en déduit les conséquences, et n'oublie rien — le tout dans
   * UNE transaction, avec l'événement dans la boîte d'envoi.
   *
   * Trois conséquences, et la deuxième est la règle dure de §2.3 :
   *   1. `kyc.status_changed` part (consommé par les notifications) ;
   *   2. `is_adult = false` DÉSACTIVE le compte et révoque ses sessions ;
   *   3. le niveau est recalculé, ce qui marque les sessions à rafraîchir.
   */
  private async applyStatus(input: {
    verificationId: string;
    userId: string;
    from: string;
    status: (typeof diditWebhookSchema)['_output']['status'];
    isAdult?: boolean | undefined;
    declineReasonCode?: string | undefined;
    now: Date;
    source: 'webhook' | 'staff' | 'task';
    staffId?: string;
    staffIp?: string | null;
    reason?: string;
  }): Promise<void> {
    const decided = (DECIDED_STATUSES as readonly string[]).includes(input.status);

    await this.prisma.$transaction(async (tx) => {
      /**
       * L'objet de mise à jour est assemblé par AFFECTATIONS SUCCESSIVES, jamais par
       * diffusions conditionnelles.
       *
       * Deux raisons, et la seconde a déjà coûté cher dans ce dépôt :
       *   · `exactOptionalPropertyTypes` interdit d'écrire `isAdult: undefined` pour
       *     dire « ne touche pas » — Prisma comprendrait la clé comme présente ;
       *   · deux `...(cond ? { k } : {})` qui posent la MÊME clé s'écrasent en
       *     silence, la seconde gagnant, sans erreur de `tsc` ni d'ESLint. Une
       *     affectation en double, elle, se voit à la relecture et le contrôle
       *     `guardrails` la cherche dans les diffusions.
       */
      const data: Prisma.KycVerificationUpdateInput = { status: input.status };
      if (input.isAdult !== undefined) data.isAdult = input.isAdult;
      if (input.status === 'DECLINED') {
        data.declineReasonCode = input.declineReasonCode ?? 'UNSPECIFIED';
      }
      if (decided) data.decidedAt = input.now;
      await tx.kycVerification.update({ where: { id: input.verificationId }, data });

      await this.outbox.emit(tx, {
        type: 'kyc.status_changed',
        aggregateId: input.userId,
        payload: {
          userId: input.userId,
          from: input.from,
          to: input.status,
          status: input.status,
          source: input.source,
        },
      });

      // RÈGLE DURE §2.3 : « Un membre mineur : compte DÉSACTIVÉ avec message
      // explicite. La plateforme est réservée aux majeurs. »
      if (input.isAdult === false) {
        await tx.user.updateMany({
          where: { id: input.userId, status: { not: 'DELETED' } },
          data: { status: 'DEACTIVATED', deactivatedAt: input.now },
        });
        // Les sessions partent avec : laisser un jeton de rafraîchissement valide
        // trente jours ferait revenir le compte au premier appel du front.
        await tx.authSession.updateMany({
          where: { userId: input.userId, revokedAt: null },
          data: { revokedAt: input.now },
        });
        await this.outbox.emit(tx, {
          type: 'user.deactivated',
          aggregateId: input.userId,
          payload: { userId: input.userId, reason: 'KYC_MINOR' },
        });
        await this.audit.record(tx, {
          actor: { type: 'SYSTEM' },
          action: 'user.deactivated',
          targetType: 'user',
          targetId: input.userId,
          metadata: { reason: 'KYC_MINOR' },
        });
      }

      if (input.staffId !== undefined) {
        // L'IP est portée jusqu'ici : 15 §2.3 l'exige dans `audit_logs`, et une
        // trace d'action d'équipe sans adresse ne permet pas l'audit des accès.
        await this.audit.record(tx, {
          actor: { type: 'STAFF', id: input.staffId },
          action: AUDIT_ACTIONS.userKycDowngraded,
          targetType: 'user',
          targetId: input.userId,
          metadata: { reason: input.reason, before: input.from, after: input.status },
          ...(input.staffIp === undefined || input.staffIp === null ? {} : { ip: input.staffIp }),
        });
      }

      // DANS la même transaction : le niveau, les sessions à rafraîchir et
      // `user.level_changed` doivent vivre ou mourir avec le statut qui les cause.
      await this.levels.recompute(input.userId, 'kyc.status_changed', tx);
    });
  }

  // ── Tâche `kyc.expire_sessions` (§8) ──────────────────────────────────────

  /**
   * « `IN_PROGRESS` → `EXPIRED` après 48 h sans résultat » (§8).
   *
   * BORNÉE (`take`) et IDEMPOTENTE : un second passage dans le même créneau ne
   * trouve plus rien, puisque le statut a changé.
   *
   * `expires_at` est NULLABLE, et une ligne posée avant que cette colonne ne soit
   * renseignée existerait avec `NULL`. En SQL, `expires_at <= now` est NULL — donc
   * faux — sur ces lignes : elles resteraient `IN_PROGRESS` pour toujours. D'où le
   * second membre de l'`OR`, qui retombe sur `created_at`.
   */
  async expireStaleSessions(now: Date = new Date()): Promise<{ expired: number }> {
    const cutoff = new Date(now.getTime() - ACCOUNT_LIMITS.kycSessionExpiryHours * 3_600_000);

    const stale = await this.prisma.kycVerification.findMany({
      where: {
        status: 'IN_PROGRESS',
        OR: [{ expiresAt: { lte: now } }, { expiresAt: null, createdAt: { lte: cutoff } }],
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
      select: { id: true, userId: true },
    });

    for (const row of stale) {
      await this.applyStatus({
        verificationId: row.id,
        userId: row.userId,
        from: 'IN_PROGRESS',
        status: 'EXPIRED',
        now,
        source: 'task',
      });
    }

    return { expired: stale.length };
  }

  // ── 15 §3.2 : « Rétrograder le niveau » ───────────────────────────────────

  /**
   * L'action d'équipe du §3.2 du module 15 : « Marque le KYC `DECLINED` avec
   * motif ; recalcul. »
   *
   * Elle n'INVENTE pas de ligne : elle refuse une vérification approuvée. Sans
   * `APPROVED` à rétrograder, il n'y a rien à faire — le membre est déjà L0, et
   * créer une ligne `DECLINED` de toutes pièces ferait croire à une décision de
   * Didit qui n'a pas eu lieu.
   */
  async downgrade(
    staff: { staffId: string; ip: string | null },
    userId: string,
    reason: string,
    now: Date = new Date(),
  ): Promise<{ userId: string; level: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, deletedAt: true },
    });
    if (user === null || user.deletedAt !== null) throw ApiError.notFound();

    const latest = await this.prisma.kycVerification.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true },
    });
    if (latest === null || latest.status !== 'APPROVED') {
      throw ApiError.transverse('CONFLICT', {
        reason: 'aucune vérification approuvée à rétrograder',
        status: latest?.status ?? 'NOT_STARTED',
      });
    }

    await this.applyStatus({
      verificationId: latest.id,
      userId,
      from: latest.status,
      status: 'DECLINED',
      declineReasonCode: 'STAFF_REVIEW',
      now,
      source: 'staff',
      staffId: staff.staffId,
      staffIp: staff.ip,
      reason,
    });

    const after = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { verificationLevel: true },
    });
    return { userId, level: after.verificationLevel };
  }

  /**
   * PAS de gestionnaire de suppression ici, et c'est délibéré.
   *
   * §9 confie `kyc_verifications` au gestionnaire du module 01, qui l'exécute DANS
   * la transaction d'anonymisation (`AccountService.anonymise`). Un second
   * gestionnaire abonné à `user.deleted` supprimerait les mêmes lignes dans une
   * transaction ultérieure : il ne trouverait rien, et sa ligne de journal ferait
   * croire qu'il sert à quelque chose.
   */
}
