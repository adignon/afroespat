import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { newId, type Prisma } from '@app/db';
import {
  ADMIN_ERROR_CODES,
  ADMIN_ERROR_MESSAGES,
  type AdminErrorCode,
  AUDIT_ACTIONS,
  STAFF_CHALLENGE_SECONDS,
  STAFF_IDLE_MINUTES,
  STAFF_LOCKOUT_MINUTES,
  STAFF_MAX_FAILED_ATTEMPTS,
  type StaffLogin,
  type StaffRoleValue,
  TOTP_STEP_SECONDS,
  TOTP_WINDOW_STEPS,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { AuditService } from '../../common/audit.service';
import { CryptoService, type Sealed } from '../../common/crypto.service';
import { PrismaService } from '../../common/prisma.service';
import { loadEnv } from '../../config/env';
import { EMAIL_PROVIDER, type EmailProvider } from '../../providers/providers';
import { hashStaffPassword, needsRehash, verifyStaffPassword } from './staff-password';
import { generateTotpSecret, totpUri, verifyTotp } from './totp';

/**
 * Sessions d'équipe — 15-administration.md §2.1.
 *
 * Trois règles dures se rencontrent ici, et elles dictent tout le fichier :
 *
 *   1. **hermétisme** (§2.1, 00 §7.4). Rien dans ce service n'écrit ni ne lit
 *      `auth_sessions`, `users`, ni `TokenService`. Le jeton d'équipe est un
 *      secret opaque, le cookie s'appelle autrement, le chemin est autre. Voir
 *      `staff.guard.ts` pour les quatre faits qui le tiennent ;
 *   2. **TOTP obligatoire** (§2.1, 00 §7.4). Il n'existe AUCUN chemin qui crée
 *      une `staff_sessions` sans avoir vérifié un code : `/auth/login` ne rend
 *      qu'un défi, et seuls `/auth/totp` et `/auth/totp/confirm` appellent
 *      `openSession`, tous deux après `verifyTotp`. C'est structurel, pas
 *      conditionnel — il n'y a pas de branche « si TOTP activé » à oublier ;
 *   3. **tout est audité** (§2.3, 00 §7.4). Connexion, échec, verrouillage,
 *      enrôlement, déconnexion : chacun laisse sa ligne.
 *
 * ── Ce que le schéma figé ne permet pas, et comment on s'en passe ───────────
 *
 * §6 annonce `staff_users.failed_attempts`, `locked_until`, `totp_enrolled_at` et
 * `created_by_staff_id` comme « ajoutées ». Elles NE SONT PAS dans le schéma, qui
 * est figé. Aucune migration : trois contournements, tous lisibles.
 *
 *   · **verrouillage** : compté dans `audit_logs`, table qui existe, qui est en
 *     ajout seul, et qu'on alimente de toute façon. Le compte des
 *     `staff.login_failed` postérieurs au dernier `staff.logged_in` et récents de
 *     moins de quinze minutes remplace exactement `failed_attempts` +
 *     `locked_until`. Mieux, même : c'est durable et partagé entre instances, là
 *     où deux colonnes auraient demandé une écriture par échec — et une carte en
 *     mémoire n'aurait rien verrouillé sur un second processus ;
 *   · **enrôlement** : `totp_secret_encrypted` est `Bytes` NON NUL. Un secret de
 *     LONGUEUR NULLE signifie « pas encore enrôlé ». C'est détectable sans
 *     ambiguïté (un secret chiffré fait au minimum 28 octets : 12 d'IV, 16
 *     d'étiquette) et ne peut pas être confondu avec un secret valide ;
 *   · **créateur du compte** : la ligne `staff.created` d'`audit_logs` porte
 *     `actor_id`. La colonne aurait dit la même chose, en double.
 *
 * ── Le défi de premier facteur ──────────────────────────────────────────────
 *
 * Aucune table ne peut porter un état « mot de passe validé, TOTP en attente ».
 * Le défi est donc SANS ÉTAT : une charge signée, valable cinq minutes. Sa clé
 * est DÉRIVÉE de `JWT_ACCESS_SECRET` par un label propre, ce qui est le contraire
 * d'une passerelle : la dérivation est à sens unique, un défi ne peut pas être
 * relu comme un jeton membre, et un jeton membre ne peut pas être relu comme un
 * défi. Son format à deux parties le distingue déjà d'un JWT, qui en a trois.
 */

/** Étiquette de dérivation. La changer invalide tous les défis en cours — sans dommage. */
const CHALLENGE_LABEL = 'disaporyplus/staff-challenge/v1';

type ChallengeMode = 'TOTP' | 'CONFIRM';

interface ChallengePayload {
  readonly sid: string;
  readonly mode: ChallengeMode;
  readonly exp: number;
  /**
   * Le secret en cours d'enrôlement, mode `CONFIRM` uniquement.
   *
   * Il voyage dans le défi parce qu'il ne doit PAS être écrit en base avant
   * d'être confirmé : un secret posé puis jamais confirmé laisserait un compte
   * réputé enrôlé sans que personne ne détienne le second facteur — donc un
   * compte définitivement inaccessible. Le défi n'est pas chiffré, seulement
   * signé : il n'y a là rien de neuf à protéger, puisque la même réponse rend
   * déjà le secret et son URI à la personne qui s'enrôle.
   */
  readonly secret?: string;
}

export interface StaffSessionResult {
  readonly token: string;
  readonly staff: { readonly id: string; readonly role: StaffRoleValue; readonly displayName: string };
  readonly expiresAt: Date;
}

function fail(code: AdminErrorCode, details?: Record<string, unknown>): never {
  throw new ApiError(code, ADMIN_ERROR_MESSAGES[code], ADMIN_ERROR_CODES[code], details);
}

@Injectable()
export class StaffAuthService {
  private readonly logger = new Logger(StaffAuthService.name);
  private readonly challengeKey: Buffer;
  private readonly issuer: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
  ) {
    const env = loadEnv();
    this.challengeKey = createHmac('sha256', env.JWT_ACCESS_SECRET).update(CHALLENGE_LABEL).digest();
    this.issuer = env.APP_NAME;
  }

  // ════════════════════════════════════════════════════════════════════════
  // §2.1 — Connexion en deux temps
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Premier facteur. Rend un DÉFI, jamais une session.
   *
   * Le refus est le même pour un email inconnu, un mot de passe faux et un compte
   * désactivé (`STAFF_CREDENTIALS_INVALID`) — principe de discrétion de T4 §3
   * appliqué à l'équipe : la réponse ne doit pas dire si l'adresse correspond à
   * un compte. Le verrouillage, lui, est annoncé : c'est une information que la
   * personne légitime a besoin d'avoir pour comprendre pourquoi elle est bloquée,
   * et elle n'apprend rien à qui a déjà cinq échecs à son actif.
   */
  async login(input: StaffLogin, ip: string | null): Promise<{
    readonly challenge: string;
    readonly expiresInSeconds: number;
    /** Vrai à la première connexion : l'enrôlement TOTP est FORCÉ avant toute session. */
    readonly enrollmentRequired: boolean;
  }> {
    const staff = await this.prisma.staffUser.findUnique({
      where: { email: input.email },
      select: { id: true, passwordHash: true, isActive: true, totpSecretEncrypted: true },
    });

    // Compte inconnu : aucune trace nominative possible (`actor_id` est un UUID,
    // et l'email est masqué par le nettoyeur d'`audit.service.ts`). On refuse
    // sans journaliser plutôt que d'écrire une ligne anonyme et inexploitable.
    if (staff === null) fail('STAFF_CREDENTIALS_INVALID');

    await this.assertNotLocked(staff.id);

    const ok = await verifyStaffPassword(input.password, staff.passwordHash);
    if (!ok || !staff.isActive) {
      await this.recordFailure(staff.id, ip, ok ? 'compte désactivé' : 'mot de passe');
      fail('STAFF_CREDENTIALS_INVALID');
    }

    // Réhachage opportun : le format porte ses paramètres, donc une montée de
    // coût — ou le passage à argon2id — s'applique au fil des connexions, sans
    // invalider quoi que ce soit. Fait hors transaction et sans bloquer le refus
    // en cas d'échec : ce n'est pas la connexion qui doit en souffrir.
    if (needsRehash(staff.passwordHash)) {
      try {
        await this.prisma.staffUser.update({
          where: { id: staff.id },
          data: { passwordHash: await hashStaffPassword(input.password) },
        });
      } catch (error) {
        this.logger.warn(`Réhachage du mot de passe équipe impossible : ${String(error)}`);
      }
    }

    const enrollmentRequired = staff.totpSecretEncrypted.length === 0;
    return {
      challenge: this.signChallenge({
        sid: staff.id,
        mode: enrollmentRequired ? 'CONFIRM' : 'TOTP',
        exp: Math.floor(Date.now() / 1000) + STAFF_CHALLENGE_SECONDS,
        // Mode CONFIRM sans secret : c'est `/auth/totp/enroll` qui en pose un.
      }),
      expiresInSeconds: STAFF_CHALLENGE_SECONDS,
      enrollmentRequired,
    };
  }

  /** Second facteur, compte déjà enrôlé. Le SEUL chemin ordinaire vers une session. */
  async totp(challenge: string, code: string, ip: string | null): Promise<StaffSessionResult> {
    const payload = this.readChallenge(challenge);
    if (payload.mode !== 'TOTP') fail('STAFF_TOTP_ENROLLMENT_REQUIRED');

    const staff = await this.loadActive(payload.sid);
    if (staff.totpSecretEncrypted.length === 0) fail('STAFF_TOTP_ENROLLMENT_REQUIRED');

    const secret = this.crypto.decryptContent(staff.totpSecretEncrypted);
    const verified = verifyTotp(secret, code);
    if (verified === null) {
      await this.recordFailure(staff.id, ip, 'code TOTP');
      fail('STAFF_TOTP_INVALID');
    }
    await this.assertCounterUnused(staff.id, verified.counter);

    return this.openSession(staff, ip, verified.counter);
  }

  /**
   * §2.1 : « enrôlement forcé à la première connexion ».
   *
   * Rend le secret et son URI, et un nouveau défi qui les PORTE. Rien n'est écrit
   * en base : tant que la personne n'a pas prouvé qu'elle lit les codes, le compte
   * reste non enrôlé et l'enrôlement peut être recommencé.
   */
  async enroll(challenge: string, email: string | null = null): Promise<{
    readonly secret: string;
    readonly otpauthUri: string;
    readonly challenge: string;
  }> {
    const payload = this.readChallenge(challenge);
    if (payload.mode !== 'CONFIRM') fail('STAFF_TOTP_ALREADY_ENROLLED');

    const staff = await this.loadActive(payload.sid);
    // Deuxième garde, en base : le défi dit « à enrôler », la base doit le
    // confirmer. Sans elle, un défi d'enrôlement rejoué après coup permettrait de
    // REMPLACER le second facteur d'un compte déjà enrôlé — la pire faille
    // possible sur une authentification à deux facteurs.
    if (staff.totpSecretEncrypted.length > 0) fail('STAFF_TOTP_ALREADY_ENROLLED');

    const secret = generateTotpSecret();
    return {
      secret,
      otpauthUri: totpUri({
        secretBase32: secret,
        accountEmail: email ?? staff.email,
        issuer: this.issuer,
      }),
      challenge: this.signChallenge({
        sid: staff.id,
        mode: 'CONFIRM',
        exp: Math.floor(Date.now() / 1000) + STAFF_CHALLENGE_SECONDS,
        secret,
      }),
    };
  }

  /** Confirme l'enrôlement par un code, écrit le secret CHIFFRÉ, et ouvre la session. */
  async confirmEnrollment(
    challenge: string,
    code: string,
    ip: string | null,
  ): Promise<StaffSessionResult> {
    const payload = this.readChallenge(challenge);
    if (payload.mode !== 'CONFIRM' || payload.secret === undefined) fail('STAFF_CHALLENGE_INVALID');

    const staff = await this.loadActive(payload.sid);
    if (staff.totpSecretEncrypted.length > 0) fail('STAFF_TOTP_ALREADY_ENROLLED');

    const verified = verifyTotp(payload.secret, code);
    if (verified === null) {
      await this.recordFailure(staff.id, ip, 'code TOTP (enrôlement)');
      fail('STAFF_TOTP_INVALID');
    }

    const sealed = this.crypto.encryptContent(payload.secret);
    return this.openSession(staff, ip, verified.counter, { enrolled: true, sealedSecret: sealed });
  }

  /** §7 : `POST /auth/logout`. Révoque la session courante et laisse sa trace. */
  async logout(staffId: string, sessionId: string, ip: string | null): Promise<{ loggedOut: true }> {
    await this.prisma.$transaction(async (tx) => {
      await tx.staffSession.updateMany({
        // `updateMany` et non `update` : une session déjà révoquée ne doit pas
        // faire échouer une déconnexion. Se déconnecter deux fois est anodin.
        where: { id: sessionId, staffId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(tx, {
        actor: { type: 'STAFF', id: staffId },
        action: AUDIT_ACTIONS.staffLoggedOut,
        targetType: 'staff_session',
        targetId: sessionId,
        ...(ip === null ? {} : { ip }),
      });
    });
    return { loggedOut: true };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Interne
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Ouvre la session : l'unique endroit du service qui écrit `staff_sessions`.
   *
   * Session, secret TOTP éventuel et ligne d'audit dans UNE transaction (§2.3 :
   * « avant validation de la transaction »). Une session sans trace, ou un secret
   * enrôlé sans session, sont deux états dont on ne veut pas.
   */
  private async openSession(
    staff: { id: string; role: StaffRoleValue; displayName: string },
    ip: string | null,
    totpCounter: number,
    enrollment?: { enrolled: true; sealedSecret: Sealed },
  ): Promise<StaffSessionResult> {
    // 32 octets : un secret opaque, jamais un JWT. Rien à en déduire, rien à
    // vérifier hors de la base — et donc rien qui puisse valoir ailleurs.
    const token = randomBytes(32).toString('base64url');
    const sessionId = newId();
    const now = new Date();
    // L'échéance d'INACTIVITÉ (§2.1, 30 min). La borne absolue de 8 h se déduit de
    // `created_at`, faute de seconde colonne — voir `StaffGuard.slideExpiry`.
    const expiresAt = new Date(now.getTime() + STAFF_IDLE_MINUTES * 60_000);

    await this.prisma.$transaction(async (tx) => {
      if (enrollment !== undefined) {
        await tx.staffUser.update({
          where: { id: staff.id },
          data: { totpSecretEncrypted: enrollment.sealedSecret },
        });
        await this.audit.record(tx, {
          actor: { type: 'STAFF', id: staff.id },
          action: AUDIT_ACTIONS.staffTotpEnrolled,
          targetType: 'staff_user',
          targetId: staff.id,
          ...(ip === null ? {} : { ip }),
        });
      }

      await tx.staffSession.create({
        data: {
          id: sessionId,
          staffId: staff.id,
          tokenHash: this.crypto.hashToken(token),
          expiresAt,
          ip,
        },
      });
      await tx.staffUser.update({ where: { id: staff.id }, data: { lastLoginAt: now } });

      // `totpCounter` en métadonnées : c'est ce qui permet de refuser le rejeu du
      // même code (RFC 6238 §5.2). Voir `assertCounterUnused`.
      await this.audit.record(tx, {
        actor: { type: 'STAFF', id: staff.id },
        action: AUDIT_ACTIONS.staffLoggedIn,
        targetType: 'staff_session',
        targetId: sessionId,
        metadata: { totpCounter },
        ...(ip === null ? {} : { ip }),
      });
    });

    return {
      token,
      staff: { id: staff.id, role: staff.role, displayName: staff.displayName },
      expiresAt,
    };
  }

  private async loadActive(staffId: string): Promise<{
    id: string;
    role: StaffRoleValue;
    displayName: string;
    email: string;
    totpSecretEncrypted: Uint8Array;
  }> {
    const staff = await this.prisma.staffUser.findUnique({
      where: { id: staffId },
      select: {
        id: true,
        role: true,
        displayName: true,
        email: true,
        isActive: true,
        totpSecretEncrypted: true,
      },
    });
    if (staff === null || !staff.isActive) fail('STAFF_CREDENTIALS_INVALID');
    return staff;
  }

  /**
   * §2.1 : « 5 échecs → verrouillage 15 minutes ».
   *
   * Compté dans `audit_logs`, faute de colonnes (voir l'en-tête). La fenêtre part
   * du PLUS RÉCENT entre « il y a quinze minutes » et le dernier succès : une
   * connexion réussie remet le compteur à zéro, ce qu'aucune suppression de ligne
   * ne pourrait faire dans une table en ajout seul.
   *
   * Une seule condition sur `created_at`, calculée avant la requête. Deux
   * diffusions conditionnelles portant la même clé s'écrasent en silence — la
   * seconde gagne, la première disparaît, et le verrouillage se relâcherait sans
   * que rien ne le dise.
   */
  private async assertNotLocked(staffId: string): Promise<void> {
    const lastSuccess = await this.prisma.auditLog.findFirst({
      where: { actorId: staffId, action: AUDIT_ACTIONS.staffLoggedIn },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const windowStart = Date.now() - STAFF_LOCKOUT_MINUTES * 60_000;
    const since = new Date(Math.max(windowStart, lastSuccess?.createdAt.getTime() ?? 0));

    const failures = await this.prisma.auditLog.count({
      where: {
        actorId: staffId,
        action: AUDIT_ACTIONS.staffLoginFailed,
        createdAt: { gt: since },
      },
    });
    if (failures < STAFF_MAX_FAILED_ATTEMPTS) return;

    // §9 : `staff.locked`. La trace d'audit est écrite ici, puis `notifyLock`
    // prévient les SUPER_ADMIN par e-mail (§2.1).
    await this.audit.record(this.prisma, {
      actor: { type: 'SYSTEM' },
      action: AUDIT_ACTIONS.staffLocked,
      targetType: 'staff_user',
      targetId: staffId,
      metadata: { failures, windowMinutes: STAFF_LOCKOUT_MINUTES },
    });
    await this.notifyLock(staffId, failures);
    fail('STAFF_LOCKED', { retryAfterMinutes: STAFF_LOCKOUT_MINUTES });
  }

  /**
   * §2.1 : « verrouillage 15 minutes ; notification email à l'équipe SUPER_ADMIN ».
   *
   * Par le port e-mail existant (`EMAIL_PROVIDER`) vers les SUPER_ADMIN actifs. Le
   * compte visé est désigné par son NOM D'AFFICHAGE, jamais par son adresse : le
   * message part vers plusieurs boîtes, et une adresse n'a pas à y circuler. Une
   * panne d'envoi ne doit JAMAIS changer la réponse à la tentative de connexion :
   * elle est consignée et on continue.
   */
  /** Le nom d'affichage d'un compte équipe — pour la barre de l'application d'équipe. */
  async displayNameOf(staffId: string): Promise<string> {
    const row = await this.prisma.staffUser.findUnique({ where: { id: staffId }, select: { displayName: true } });
    return row?.displayName ?? '';
  }

  private async notifyLock(staffId: string, failures: number): Promise<void> {
    try {
      const [target, admins] = await Promise.all([
        this.prisma.staffUser.findUnique({ where: { id: staffId }, select: { displayName: true } }),
        this.prisma.staffUser.findMany({ where: { role: 'SUPER_ADMIN', isActive: true }, select: { email: true } }),
      ]);
      for (const admin of admins) {
        await this.email.send(admin.email, 'staff.locked', {
          displayName: target?.displayName ?? '',
          failures,
          lockoutMinutes: STAFF_LOCKOUT_MINUTES,
        });
      }
    } catch (error) {
      this.logger.error(`Notification de verrouillage non envoyée : ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** La trace d'un échec. Le motif reste GÉNÉRIQUE côté réponse, précis côté journal. */
  private async recordFailure(staffId: string, ip: string | null, reason: string): Promise<void> {
    await this.audit.record(this.prisma, {
      actor: { type: 'STAFF', id: staffId },
      action: AUDIT_ACTIONS.staffLoginFailed,
      targetType: 'staff_user',
      targetId: staffId,
      metadata: { reason },
      ...(ip === null ? {} : { ip }),
    });
  }

  /**
   * RFC 6238 §5.2 : un code accepté ne doit l'être qu'une fois.
   *
   * Sans cela, un code capturé dans les trente secondes rouvre une session, ce
   * qui annule une bonne part de l'intérêt du second facteur. L'état nécessaire —
   * « quel pas a déjà servi » — n'a pas de colonne, et se lit dans les
   * `staff.logged_in` récents du compte, dont les métadonnées le portent.
   *
   * La fenêtre interrogée couvre la tolérance de vérification (±1 pas) plus un
   * pas de marge, soit quatre-vingt-dix secondes : au-delà, aucun code accepté
   * aujourd'hui ne peut correspondre au même compteur.
   */
  private async assertCounterUnused(staffId: string, counter: number): Promise<void> {
    const horizonMs = (2 * TOTP_WINDOW_STEPS + 2) * TOTP_STEP_SECONDS * 1000;
    const recent = await this.prisma.auditLog.findMany({
      where: {
        actorId: staffId,
        action: AUDIT_ACTIONS.staffLoggedIn,
        createdAt: { gt: new Date(Date.now() - horizonMs) },
      },
      select: { metadata: true },
    });
    const used = recent.some((row) => {
      const metadata = row.metadata;
      if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) return false;
      return (metadata as Record<string, unknown>)['totpCounter'] === counter;
    });
    if (used) fail('STAFF_TOTP_INVALID', { reason: 'code déjà employé' });
  }

  // ── Le défi ───────────────────────────────────────────────────────────────

  /** `base64url(charge).base64url(signature)` — DEUX parties, un JWT en a trois. */
  private signChallenge(payload: ChallengePayload): string {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${body}.${this.challengeSignature(body)}`;
  }

  private readChallenge(challenge: string): ChallengePayload {
    const parts = challenge.split('.');
    if (parts.length !== 2) fail('STAFF_CHALLENGE_INVALID');
    const [body, signature] = parts as [string, string];

    const expected = Buffer.from(this.challengeSignature(body));
    const provided = Buffer.from(signature);
    if (expected.length !== provided.length) fail('STAFF_CHALLENGE_INVALID');
    if (!timingSafeEqual(expected, provided)) fail('STAFF_CHALLENGE_INVALID');

    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    } catch {
      fail('STAFF_CHALLENGE_INVALID');
    }
    if (!isChallengePayload(parsed)) fail('STAFF_CHALLENGE_INVALID');
    if (parsed.exp * 1000 <= Date.now()) fail('STAFF_CHALLENGE_INVALID');
    return parsed;
  }

  private challengeSignature(body: string): string {
    return createHmac('sha256', this.challengeKey).update(body).digest('base64url');
  }

  // ════════════════════════════════════════════════════════════════════════
  // §10 — Tâches planifiées
  // ════════════════════════════════════════════════════════════════════════

  /**
   * `staff.session_cleanup`, horaire (§10).
   *
   * SUPPRIME les sessions échues, là où la conservation de 30 jours de 00 §8.4
   * vaut pour les sessions de MEMBRES. Une session d'équipe expirée n'a aucune
   * valeur d'enquête : la trace de la connexion est dans `audit_logs`, pour cinq
   * ans, et elle y est plus complète.
   */
  async cleanupSessions(now: Date = new Date()): Promise<number> {
    const result = await this.prisma.staffSession.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    return result.count;
  }

  /**
   * Révoque toutes les sessions d'un compte équipe.
   *
   * Appelée à la désactivation d'un compte. `StaffGuard` refuserait déjà un
   * compte inactif, mais laisser des lignes vivantes en base ferait dépendre la
   * sécurité d'un seul contrôle — et il n'y a aucune raison de s'en priver.
   */
  async revokeAllSessions(
    writer: PrismaService | Prisma.TransactionClient,
    staffId: string,
  ): Promise<number> {
    const result = await writer.staffSession.updateMany({
      where: { staffId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }
}

function isChallengePayload(value: unknown): value is ChallengePayload {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  if (typeof c['sid'] !== 'string' || typeof c['exp'] !== 'number') return false;
  if (c['mode'] !== 'TOTP' && c['mode'] !== 'CONFIRM') return false;
  return c['secret'] === undefined || typeof c['secret'] === 'string';
}
