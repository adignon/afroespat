import { Injectable, Logger } from '@nestjs/common';
import { newId, type Prisma } from '@app/db';
import {
  ACCOUNT_ERROR_CODES,
  ACCOUNT_ERROR_MESSAGES,
  ACCOUNT_LIMITS,
  SYSTEM_AUDIT_ACTIONS,
  type AccountErrorCode,
  type DeletionStatusResponse,
  type OtpConfirm,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { AuditService } from '../../common/audit.service';
import { OutboxService } from '../../common/outbox.service';
import { PrismaService } from '../../common/prisma.service';
import { AuthService } from '../auth/auth.service';

/**
 * Cycle de vie du compte — 01-identite.md §2.8, §8 et §9.
 *
 * Quatre gestes, et la moitié du travail est de ne PAS les confondre :
 *
 *   · DÉSACTIVER — réversible, les contenus restent, l'auteur devient « Membre
 *     désactivé ». Une simple connexion OTP ramène le membre.
 *   · SUPPRIMER — irréversible, après sept jours de rétractation. C'est la tâche
 *     `account.deletion_execute` qui tranche, jamais la route.
 *   · ANNULER la suppression, ce qu'une connexion OTP fait aussi (§2.8, dans
 *     `AuthService`).
 *   · PURGER — six mois après une désactivation, §2.8 supprime automatiquement.
 *
 * LE PIÈGE DE LA PURGE, et il vaut d'être écrit ici : 13 §4.2 écrit
 * `status = DEACTIVATED` sur un bannissement, faute de valeur `BANNED` dans l'enum.
 * Un balayage naïf des comptes désactivés depuis six mois supprimerait donc les
 * BANNIS — et comme la suppression vide `phone_numbers`, elle libère l'empreinte de
 * leur numéro. Le banni n'aurait plus qu'à se réinscrire avec le même téléphone. La
 * purge exclut donc explicitement les bannissements non levés.
 */

/**
 * `account.deletion_execute` et `account.deactivated_purge` sont BORNÉES.
 *
 * Cinquante comptes par passage : chaque compte est une transaction qui touche une
 * douzaine de tables, et la tâche horaire ne doit pas tenir son verrou pendant tout
 * un balayage (§9.3). Un retard se rattrape au créneau suivant, une heure plus tard.
 */
const BATCH = 50;

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  private fail(code: AccountErrorCode, details?: Record<string, unknown>): never {
    throw new ApiError(code, ACCOUNT_ERROR_MESSAGES[code], ACCOUNT_ERROR_CODES[code], details);
  }

  // ── POST /me/deactivate (§2.8) ────────────────────────────────────────────

  /**
   * Désactive le compte : sessions révoquées, contenus conservés.
   *
   * ÉCART ASSUMÉ AVEC §4.2, signalé plutôt que contourné. Le tableau du §4.2 note
   * « confirmation par OTP » pour cette route, mais l'enum figé `otp_challenges.purpose`
   * ne compte que `SIGNUP`, `LOGIN`, `ADD_PHONE`, `DELETE_ACCOUNT` et `REACTIVATE` :
   * il n'existe AUCUNE valeur pour une désactivation. Les deux contournements
   * possibles sont pires que l'écart :
   *   · réemployer `DELETE_ACCOUNT` ferait qu'un code demandé « pour supprimer »
   *     désactive, et réciproquement — exactement le brouillage que le contrôle du
   *     `purpose` existe pour empêcher ;
   *   · ajouter une valeur à l'enum est une migration, et le schéma est gelé.
   * La désactivation restant entièrement réversible par une connexion OTP, le pire
   * cas d'un appel non voulu est une déconnexion que le membre annule en se
   * reconnectant. La suppression, elle, exige bien l'OTP.
   */
  async deactivate(userId: string, now: Date = new Date()): Promise<{ status: 'DEACTIVATED' }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { status: true, deletedAt: true },
    });
    if (user.deletedAt !== null || user.status === 'DELETED') throw ApiError.notFound();
    if (user.status === 'DEACTIVATED') this.fail('ALREADY_DEACTIVATED');
    if (user.status === 'DELETION_PENDING') this.fail('DELETION_ALREADY_PENDING');

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        // `deactivated_at` est POSÉ, et ce n'est pas décoratif : c'est la seule
        // donnée qui permette à `account.deactivated_purge` de compter six mois.
        // Laissée nulle, le compte ne serait jamais purgé — et §2.8 ne serait pas
        // tenu, sans que rien ne le signale.
        data: { status: 'DEACTIVATED', deactivatedAt: now },
      });
      await tx.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: userId },
        action: SYSTEM_AUDIT_ACTIONS.accountDeactivatedBySelf,
        targetType: 'user',
        targetId: userId,
      });
      await this.outbox.emit(tx, {
        type: 'user.deactivated',
        aggregateId: userId,
        payload: { userId, reason: 'SELF' },
      });
    });

    this.logger.log(`Compte ${userId} désactivé à la demande du membre (§2.8)`);
    return { status: 'DEACTIVATED' };
  }

  // ── POST /me/deletion (§2.8) ──────────────────────────────────────────────

  /**
   * Demande de suppression : `DELETION_PENDING`, une ligne
   * `account_deletion_requests`, sessions révoquées immédiatement.
   *
   * L'OTP est EXIGÉ, avec `purpose = DELETE_ACCOUNT` et sur un numéro du membre
   * (§2.8). C'est la seule action irréversible du module : un jeton d'accès volé ne
   * doit pas suffire, il faut aussi le téléphone.
   */
  async requestDeletion(
    userId: string,
    confirm: OtpConfirm,
    now: Date = new Date(),
  ): Promise<DeletionStatusResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { status: true, deletedAt: true },
    });
    if (user.deletedAt !== null || user.status === 'DELETED') throw ApiError.notFound();

    const pending = await this.prisma.accountDeletionRequest.findFirst({
      where: { userId, cancelledAt: null, executedAt: null },
      select: { id: true },
    });
    if (pending !== null) this.fail('DELETION_ALREADY_PENDING');

    // Le code est éprouvé AVANT toute écriture, et consommé par cet appel.
    await this.auth.confirmWithOtp({
      challengeId: confirm.challengeId,
      code: confirm.code,
      purpose: 'DELETE_ACCOUNT',
      ownedBy: userId,
    });

    const executeAfter = new Date(now.getTime() + ACCOUNT_LIMITS.deletionGraceDays * 86_400_000);
    const requestId = newId();

    await this.prisma.$transaction(async (tx) => {
      await tx.accountDeletionRequest.create({
        data: { id: requestId, userId, requestedAt: now, executeAfter },
      });
      await tx.user.update({ where: { id: userId }, data: { status: 'DELETION_PENDING' } });
      await tx.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: userId },
        action: SYSTEM_AUDIT_ACTIONS.accountDeletionRequested,
        targetType: 'user',
        targetId: userId,
        metadata: { requestId, executeAfter: executeAfter.toISOString() },
      });
      await this.outbox.emit(tx, {
        type: 'user.deletion_requested',
        aggregateId: userId,
        payload: { userId, requestId, executeAfter: executeAfter.toISOString() },
      });
    });

    return { requestedAt: now.toISOString(), executeAfter: executeAfter.toISOString() };
  }

  /**
   * PAS de méthode d'annulation, et c'est un choix — voir `account.controller.ts`.
   *
   * §4.2 liste `DELETE /me/deletion`, mais §2.8 révoque toutes les sessions à la
   * demande : après elle, le membre ne peut plus atteindre aucune route `/me`. Le
   * chemin d'annulation réel est celui que §2.8 nomme — une connexion OTP pendant les
   * sept jours — et il vit dans `AuthService.resumeAccount`, où il est éprouvé.
   *
   * Garder ici une méthode que rien n'appelle ferait croire la chaîne branchée, comme
   * un gestionnaire de tâche vide.
   */

  // ── Tâche `account.deletion_execute` (§8) ─────────────────────────────────

  /**
   * « Exécute les suppressions dont `execute_after` est dépassé et non annulées »
   * (§8). C'est LA méthode que plusieurs modules citaient comme leur déclencheur de
   * nettoyage et qui n'existait pas : `user.deleted` avait dix consommateurs et
   * aucun producteur.
   *
   * ORDRE — ÉCART ASSUMÉ AVEC §9, et il faut le dire. §9 veut que le gestionnaire
   * du module 01 soit « appelé en dernier, après tous les autres », et §8.6 veut
   * « tous les gestionnaires dans une même transaction ». Ni l'un ni l'autre n'est
   * possible avec l'architecture livrée, et ce n'est pas un raccourci :
   *   · §9.1 impose la boîte d'envoi TRANSACTIONNELLE — l'événement s'écrit dans la
   *     transaction qui change l'état, sinon il est perdu ou émis pour rien ;
   *   · les dix gestionnaires `handleUserDeleted` déjà livrés ouvrent CHACUN leur
   *     transaction, et le registre d'événements les isole exprès pour que l'échec
   *     de l'un n'empêche pas les autres.
   * Une transaction unique entre dix modules asynchrones n'existe donc pas. Ce qui
   * est fait ici : le module 01 anonymise `users` et vide SES tables, puis
   * `user.deleted` part dans la même transaction. Les autres modules suivent. Rien
   * ne se perd, parce qu'aucun d'eux ne lit une donnée personnelle de `users` — ils
   * ne connaissent que `user_id`, et la ligne `users` reste (§2.8 l'exige, comme
   * clé étrangère des contenus anonymisés).
   *
   * IDEMPOTENTE : `executed_at` est posé par un `updateMany` CONDITIONNEL, qui sert
   * de prise. Deux passages concurrents ne peuvent pas exécuter la même demande —
   * le second voit `count === 0` et passe.
   */
  async executeDueDeletions(
    now: Date = new Date(),
  ): Promise<{ examined: number; executed: number; failed: number }> {
    const due = await this.prisma.accountDeletionRequest.findMany({
      where: { cancelledAt: null, executedAt: null, executeAfter: { lte: now } },
      orderBy: { executeAfter: 'asc' },
      take: BATCH,
      select: { id: true, userId: true },
    });

    let executed = 0;
    let failed = 0;

    for (const request of due) {
      try {
        const done = await this.prisma.$transaction(async (tx) => {
          const claimed = await tx.accountDeletionRequest.updateMany({
            where: { id: request.id, cancelledAt: null, executedAt: null },
            data: { executedAt: now },
          });
          if (claimed.count === 0) return false;

          await this.anonymise(tx, request.userId, now);
          await this.audit.record(tx, {
            actor: { type: 'SYSTEM' },
            action: SYSTEM_AUDIT_ACTIONS.accountDeletionExecuted,
            targetType: 'user',
            targetId: request.userId,
            metadata: { requestId: request.id },
          });
          await this.outbox.emit(tx, {
            type: 'user.deleted',
            aggregateId: request.userId,
            payload: { userId: request.userId, requestId: request.id, reason: 'REQUESTED' },
          });
          return true;
        });
        if (done) executed += 1;
      } catch (error) {
        // Une demande en échec ne doit pas emporter les quarante-neuf autres.
        // `executed_at` a été annulé avec la transaction : le créneau suivant
        // réessaiera, et c'est ce qu'on veut d'une suppression.
        failed += 1;
        this.logger.error(
          `Suppression ${request.id} (membre ${request.userId}) en échec : ` +
            `${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return { examined: due.length, executed, failed };
  }

  // ── Tâche `account.deactivated_purge` (§8) ────────────────────────────────

  /**
   * « Suppression des comptes désactivés depuis plus de 6 mois » (§8, §2.8 :
   * « Réactivation par simple connexion OTP dans les 6 mois ; au-delà, suppression
   * automatique »).
   *
   * DEUX EXCLUSIONS, et chacune évite un dégât réel :
   *
   *   · les BANNISSEMENTS non levés. 13 §4.2 écrit `DEACTIVATED` sur un ban, faute
   *     de valeur `BANNED` dans l'enum : sans cette exclusion, tout banni serait
   *     supprimé six mois plus tard, et la suppression vidant `phone_numbers`, son
   *     empreinte de numéro redeviendrait libre. Il se réinscrirait avec le même
   *     téléphone. C'est le seul rempart disponible : la table
   *     `banned_phone_hashes` que 13 §4.2 nomme n'existe PAS dans le schéma figé.
   *   · `deactivated_at IS NULL`. La colonne est nullable, et `<= cutoff` sur NULL
   *     rend NULL, donc faux : ces comptes ne sont jamais purgés. C'est le bon
   *     comportement — sans date de désactivation, on ne sait pas depuis quand — et
   *     il est écrit ici pour qu'on ne le « corrige » pas un jour en `OR NULL`.
   */
  async purgeDeactivated(
    now: Date = new Date(),
  ): Promise<{ examined: number; purged: number; failed: number }> {
    const cutoff = new Date(now);
    cutoff.setUTCMonth(cutoff.getUTCMonth() - ACCOUNT_LIMITS.deactivatedPurgeMonths);

    const candidates = await this.prisma.user.findMany({
      where: {
        status: 'DEACTIVATED',
        deletedAt: null,
        deactivatedAt: { lte: cutoff },
        sanctions: { none: { type: 'BAN', liftedAt: null } },
      },
      orderBy: { deactivatedAt: 'asc' },
      take: BATCH,
      select: { id: true },
    });

    let purged = 0;
    let failed = 0;

    for (const user of candidates) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await this.anonymise(tx, user.id, now);
          await this.audit.record(tx, {
            actor: { type: 'SYSTEM' },
            action: SYSTEM_AUDIT_ACTIONS.accountDeactivatedPurged,
            targetType: 'user',
            targetId: user.id,
            metadata: { afterMonths: ACCOUNT_LIMITS.deactivatedPurgeMonths },
          });
          await this.outbox.emit(tx, {
            type: 'user.deleted',
            aggregateId: user.id,
            payload: { userId: user.id, reason: 'DEACTIVATED_SIX_MONTHS' },
          });
        });
        purged += 1;
      } catch (error) {
        failed += 1;
        this.logger.error(
          `Purge du compte ${user.id} en échec : ` +
            `${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return { examined: candidates.length, purged, failed };
  }

  // ── Tâche `user.phase_progression` (§8) ───────────────────────────────────

  /**
   * « `RECENT_ARRIVAL` → `SETTLED` si `arrival_date` + 6 mois et pas de réglage
   * manuel postérieur » (§8).
   *
   * Le second critère ne s'exprime pas dans un `where` Prisma : il compare DEUX
   * COLONNES (`phase_set_manually_at > arrival_date`). Les candidats sont donc
   * filtrés en mémoire, ce qui est sans risque parce que le premier critère — six
   * mois d'ancienneté d'arrivée et phase `RECENT_ARRIVAL` — borne déjà fortement
   * l'ensemble.
   *
   * §2.2 : « l'automatisme n'écrase JAMAIS une correction manuelle faite après
   * lui. » Sans ce filtre, un membre qui se remet lui-même en `RECENT_ARRIVAL`
   * serait repassé en `SETTLED` la nuit suivante, indéfiniment.
   */
  async progressPhases(now: Date = new Date()): Promise<{ examined: number; promoted: number }> {
    const cutoff = new Date(now);
    cutoff.setUTCMonth(cutoff.getUTCMonth() - ACCOUNT_LIMITS.settledAfterArrivalMonths);

    const candidates = await this.prisma.user.findMany({
      where: {
        phase: 'RECENT_ARRIVAL',
        deletedAt: null,
        status: { in: ['ACTIVE', 'SUSPENDED'] },
        arrivalDate: { lte: cutoff },
      },
      orderBy: { arrivalDate: 'asc' },
      take: 500,
      select: { id: true, arrivalDate: true, phaseSetManuallyAt: true },
    });

    const due = candidates.filter((u) => {
      if (u.phaseSetManuallyAt === null) return true;
      if (u.arrivalDate === null) return false;
      return u.phaseSetManuallyAt.getTime() <= u.arrivalDate.getTime();
    });

    for (const user of due) {
      await this.prisma.$transaction(async (tx) => {
        // `updateMany` avec la phase attendue : deux passages concurrents
        // n'émettent alors qu'un seul événement.
        const changed = await tx.user.updateMany({
          where: { id: user.id, phase: 'RECENT_ARRIVAL' },
          data: { phase: 'SETTLED' },
        });
        if (changed.count === 0) return;
        await this.outbox.emit(tx, {
          type: 'user.phase_changed',
          aggregateId: user.id,
          payload: { userId: user.id, from: 'RECENT_ARRIVAL', to: 'SETTLED', manual: false },
        });
      });
    }

    return { examined: candidates.length, promoted: due.length };
  }

  // ── Tâche `otp.purge` (§8) ────────────────────────────────────────────────

  /**
   * « Défis expirés depuis plus de 24 h » (§8, §8.4).
   *
   * C'est la seule tâche du module qui efface une donnée personnelle sans passer
   * par un compte : `otp_challenges` porte le numéro CHIFFRÉ (colonne ajoutée, pour
   * pouvoir le masquer plus tard) et l'IP. Les laisser s'accumuler transformerait
   * une table de travail en archive de numéros.
   */
  async purgeOtpChallenges(now: Date = new Date()): Promise<{ purged: number }> {
    const cutoff = new Date(now.getTime() - ACCOUNT_LIMITS.otpRetentionHours * 3_600_000);
    const removed = await this.prisma.otpChallenge.deleteMany({
      where: { expiresAt: { lte: cutoff } },
    });
    return { purged: removed.count };
  }

  /**
   * `retention.purge` — quotidienne, TRANSVERSE (00-fondations.md §9.3 et §8.4).
   *
   * ── CE QU'ELLE PURGE, ET CE QUE D'AUTRES PURGENT DÉJÀ ───────────────────────
   *
   * §8.4 donne SEPT durées de conservation, et six ont déjà leur tâche ou n'ont
   * rien à purger. Il ne reste qu'une ligne pour celle-ci, et c'est celle que
   * personne ne tenait :
   *
   *   · « Défis OTP : 24 h » → `otp.purge`, horaire, juste au-dessus ;
   *   · « **Sessions expirées : 30 jours** » → ICI. Aucune tâche ne les touchait :
   *     `staff.session_cleanup` ne voit que `staff_sessions`, et le gestionnaire de
   *     suppression de compte ne vide `auth_sessions` que du membre supprimé. Les
   *     sessions expirées de tous les autres s'accumulaient donc sans fin ;
   *   · « Signalements traités : 3 ans » → `moderation.purge_reports`, quotidienne ;
   *   · « Journal d'audit : 5 ans » → `audit.retention`, ABSENTE : `audit_logs` est
   *     en ajout seul, protégée par deux déclencheurs PostgreSQL, et §2.3 du module
   *     15 dit « Aucune suppression possible ». La contradiction avec §10
   *     appartient au propriétaire ; cette tâche ne l'arbitre pas et ne touche pas
   *     la table ;
   *   · « Journaux applicatifs : 90 jours » → ils ne sont pas en base (pino, sortie
   *     standard). Rien à purger ici ;
   *   · « Contenus d'un compte supprimé » → les gestionnaires de suppression de
   *     §8.6, pas une rétention par durée ;
   *   · « Données de paiement : 10 ans » → aucune facture n'a dix ans, et la
   *     conservation est une OBLIGATION, pas une échéance de purge.
   *
   * Elle ne touche donc qu'UNE table, et le dire vaut mieux que de lui faire
   * balayer six tables dont cinq sont déjà tenues : deux tâches qui purgent la même
   * ligne se battent pour le même verrou et se cachent l'une l'autre.
   *
   * ── CE QU'ELLE NE PURGE PAS, ET QUE LA SPEC NE DIT PAS ─────────────────────
   *
   * `domain_events` publiés. La boîte d'envoi n'est jamais vidée : le relais marque
   * `published_at` et la ligne reste pour toujours. C'est la table qui grossit le
   * plus vite du produit, et §8.4 ne lui donne AUCUNE durée. On ne l'invente pas —
   * un événement effacé est une piste d'audit effacée — mais c'est remonté.
   *
   * IDEMPOTENTE : un `deleteMany` borné par une date. Au second passage, au même
   * instant, plus aucune ligne n'est dans la fenêtre.
   *
   * RÉVOQUÉE COMPTE COMME EXPIRÉE : §8.4 dit « sessions expirées », et une session
   * révoquée depuis plus de trente jours est au moins aussi morte. Les deux bornes
   * sont dans le même `OR` plutôt que dans deux balayages, parce que c'est une seule
   * règle : « cette session ne peut plus servir depuis trente jours ».
   */
  async purgeExpiredSessions(now: Date = new Date()): Promise<{ sessions: number }> {
    const cutoff = new Date(now.getTime() - ACCOUNT_LIMITS.sessionRetentionDays * 86_400_000);
    const removed = await this.prisma.authSession.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }],
      },
    });
    return { sessions: removed.count };
  }

  // ── Gestionnaire de suppression du module 01 (§9) ─────────────────────────

  /**
   * Vide les tables du module et anonymise `users` — §9, mot pour mot :
   *
   *   « Il vide `phone_numbers`, `auth_sessions`, `kyc_verifications`,
   *     `user_profiles`, `user_languages`, `user_skills`, `consents` (conservés
   *     3 ans comme preuve, sans lien exploitable), `data_exports`, `bookmarks`,
   *     l'avatar ; anonymise `users` comme décrit en §2.8. »
   *
   * DEUX ÉCARTS, tous deux imposés par le schéma figé et signalés plutôt que
   * masqués :
   *
   *   · `consents` : la ligne est CONSERVÉE (preuve RGPD, 3 ans) mais son
   *     `user_id` est `NOT NULL` et sa clé étrangère en cascade. « Sans lien
   *     exploitable » demanderait une colonne nullable ou un pseudonyme : aucune
   *     des deux n'existe. Le lien demeure donc — vers une ligne `users` qui, elle,
   *     ne porte plus aucune donnée personnelle.
   *   · l'avatar est SOFT-supprimé (`media_assets.deleted_at`) et son propriétaire
   *     effacé, au lieu d'un `DELETE`. Un `media_assets` peut être référencé par
   *     `post_media`, `album_photos` ou `messages` selon l'ordre dans lequel les
   *     autres modules passent : un `DELETE` ferait échouer toute la transaction sur
   *     une clé étrangère, donc empêcherait la suppression du compte. Le fichier
   *     lui-même reste dans le stockage objet — aucune tâche de purge des médias
   *     n'est livrée, c'est signalé dans le rapport.
   *
   * IDEMPOTENTE : tous les `deleteMany` et l'`update` peuvent se rejouer.
   */
  async anonymise(tx: Prisma.TransactionClient, userId: string, now: Date): Promise<void> {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { avatarAssetId: true },
    });
    if (user === null) return;

    await tx.phoneNumber.deleteMany({ where: { userId } });
    await tx.authSession.deleteMany({ where: { userId } });
    await tx.kycVerification.deleteMany({ where: { userId } });
    await tx.userLanguage.deleteMany({ where: { userId } });
    await tx.userSkill.deleteMany({ where: { userId } });
    await tx.userProfile.deleteMany({ where: { userId } });
    await tx.dataExport.deleteMany({ where: { userId } });
    await tx.bookmark.deleteMany({ where: { userId } });
    // 15 §11 : « `member_notes` : supprimées » — les notes internes ne survivent pas au membre.
    await tx.memberNote.deleteMany({ where: { userId } });

    /**
     * L'anonymisation de `users` (§2.8) : « `handle` remplacé par
     * `deleted_<uuid court>`, `display_name = "Membre supprimé"`, tout le reste
     * vidé. La ligne `users` RESTE. »
     *
     * `origin_country_id` et `phase` sont `NOT NULL` : ils ne peuvent pas être
     * vidés. Ni l'un ni l'autre n'identifie une personne — un pays et une phase sont
     * partagés par des milliers de membres — et c'est ce que le §2.8 tolère en
     * gardant la ligne comme clé étrangère des contenus anonymisés.
     */
    await tx.user.update({
      where: { id: userId },
      data: {
        handle: `deleted_${newId().replace(/-/g, '').slice(0, 12)}`,
        displayName: 'Membre supprimé',
        avatarAssetId: null,
        cityId: null,
        arrivalDate: null,
        plannedDepartureDate: null,
        lastSeenAt: null,
        deactivatedAt: null,
        handleChangedAt: null,
        originCountryLockedAt: null,
        phaseSetManuallyAt: null,
        onboardingStep: 0,
        plan: 'FREE',
        verificationLevel: 'L0',
        status: 'DELETED',
        deletedAt: now,
      },
    });

    // Les médias du membre perdent leur propriétaire (§8.1 : minimisation), et
    // l'avatar est retiré de la circulation.
    await tx.mediaAsset.updateMany({ where: { ownerUserId: userId }, data: { ownerUserId: null } });
    if (user.avatarAssetId !== null) {
      await tx.mediaAsset.updateMany({
        where: { id: user.avatarAssetId, deletedAt: null },
        data: { deletedAt: now },
      });
    }
  }
}
