import { Injectable, Logger } from '@nestjs/common';
import { newId } from '@app/db';
import {
  ACCOUNT_ERROR_CODES,
  ACCOUNT_ERROR_MESSAGES,
  AUTH_ERROR_CODES,
  AUTH_ERROR_MESSAGES,
  type AccountErrorCode,
  type AddPhoneStart,
  type OtpConfirm,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { CryptoService } from '../../common/crypto.service';
import { OutboxService } from '../../common/outbox.service';
import { PrismaService } from '../../common/prisma.service';
import { AuthService } from '../auth/auth.service';
import { VerificationLevelService } from './verification-level.service';

/**
 * Numéros de téléphone du compte — 01-identite.md §2.5.
 *
 * C'est le second axe du niveau de vérification : L2 = L1 + « un numéro de
 * téléphone d'un pays de DESTINATION actif vérifié par OTP » (§7.2). Sans ces trois
 * routes, `phone_numbers.is_destination` n'était écrit par personne et le niveau L2
 * était inatteignable — donc le logement, le parrainage et l'annuaire pro étaient
 * fermés à tout le monde.
 *
 * RÈGLE DURE (§2.1) : le numéro n'est jamais renvoyé en clair. Ce service ne rend
 * aucun numéro du tout — c'est `GET /me` qui expose les masques.
 */

@Injectable()
export class PhonesService {
  private readonly logger = new Logger(PhonesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly outbox: OutboxService,
    private readonly auth: AuthService,
    private readonly levels: VerificationLevelService,
  ) {}

  private fail(code: AccountErrorCode, details?: Record<string, unknown>): never {
    throw new ApiError(code, ACCOUNT_ERROR_MESSAGES[code], ACCOUNT_ERROR_CODES[code], details);
  }

  // ── POST /me/phones (§2.5) ────────────────────────────────────────────────

  /**
   * Démarre l'ajout : même flux OTP, `purpose = ADD_PHONE`.
   *
   * DEUX CONTRÔLES AVANT LE SMS, et un SEUL après — ce partage est le point délicat
   * de cette méthode :
   *
   *   · AVANT : le niveau du membre (L1 exigé, §2.5) et la nature du pays (§2.5 :
   *     « l'indicatif d'un pays DESTINATION ou BOTH actif »). Les deux sont des
   *     propriétés publiques de la demande, et les refuser tôt évite un SMS payant.
   *   · APRÈS seulement : « le numéro appartient-il déjà à un autre compte ». §2.5
   *     l'exige « sans révéler à quel compte », mais le refuser AVANT l'envoi en
   *     ferait un oracle : un membre connecté pourrait éprouver mille numéros à la
   *     minute et apprendre lesquels ont un compte. Attendre la vérification du code
   *     rend l'information inaccessible à qui ne détient pas le téléphone. Le prix
   *     est un SMS envoyé pour rien, et il est bien inférieur à celui d'un annuaire
   *     de membres reconstitué.
   */
  async start(
    userId: string,
    input: AddPhoneStart,
    ip: string | undefined,
  ): Promise<{ challengeId: string; expiresAt: Date }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { verificationLevel: true },
    });

    // §2.5 : « Uniquement depuis un compte L1. » Un L0 doit d'abord vérifier son
    // identité — un numéro français seul ne prouve pas qui l'on est (décision T4).
    if (user.verificationLevel === 'L0') {
      throw ApiError.transverse('LEVEL_REQUIRED', {
        requiredLevel: 'L1',
        currentLevel: user.verificationLevel,
        reason: 'ADD_DESTINATION_PHONE',
      });
    }

    const country = await this.prisma.country.findUnique({
      where: { iso2: input.countryIso2 },
      select: { isActive: true, kind: true },
    });
    if (country === null || !country.isActive) {
      throw new ApiError(
        'COUNTRY_NOT_SUPPORTED',
        AUTH_ERROR_MESSAGES.COUNTRY_NOT_SUPPORTED,
        AUTH_ERROR_CODES.COUNTRY_NOT_SUPPORTED,
      );
    }
    if (country.kind === 'ORIGIN') this.fail('PHONE_NOT_DESTINATION');

    return this.auth.requestOtp({
      phone: input.phone,
      countryIso2: input.countryIso2,
      captchaToken: input.captchaToken,
      purpose: 'ADD_PHONE',
      ip,
    });
  }

  // ── POST /me/phones/verify (§2.5) ─────────────────────────────────────────

  /** Confirme le code et crée la ligne `phone_numbers`. Fait passer L1 → L2. */
  async verify(
    userId: string,
    confirm: OtpConfirm,
    now: Date = new Date(),
  ): Promise<{ id: string; masked: string; isDestination: boolean; level: string }> {
    // `ownedBy: null` : c'est un numéro NEUF, il n'appartient pas encore au membre.
    const challenge = await this.auth.confirmWithOtp({
      challengeId: confirm.challengeId,
      code: confirm.code,
      purpose: 'ADD_PHONE',
      ownedBy: null,
    });

    if (challenge.phoneEncrypted === null) {
      // Un défi sans numéro chiffré ne peut pas produire de ligne masquable plus
      // tard : mieux vaut refuser que fabriquer un numéro que le membre ne pourra
      // plus jamais reconnaître dans sa liste.
      throw ApiError.transverse('CONFLICT', { reason: 'défi OTP sans numéro chiffré' });
    }

    const country = await this.prisma.country.findUniqueOrThrow({
      where: { id: challenge.countryId },
      select: { id: true, kind: true, isActive: true, dialCode: true },
    });
    // Revérifié : le pays a pu être fermé entre l'envoi du code et sa saisie, et
    // c'est ce pays-là qui décide de `is_destination`, donc du niveau L2.
    if (!country.isActive || country.kind === 'ORIGIN') this.fail('PHONE_NOT_DESTINATION');

    const existing = await this.prisma.phoneNumber.findUnique({
      where: { phoneHmac: challenge.phoneHmac },
      select: { id: true, userId: true, isDestination: true },
    });
    if (existing !== null) {
      // Déjà le sien : la route est idempotente, un double clic ne doit pas échouer.
      if (existing.userId !== userId) {
        throw new ApiError(
          'PHONE_ALREADY_USED',
          AUTH_ERROR_MESSAGES.PHONE_ALREADY_USED,
          AUTH_ERROR_CODES.PHONE_ALREADY_USED,
        );
      }
      const level = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { verificationLevel: true },
      });
      return {
        id: existing.id,
        masked: this.crypto.maskPhone(
          this.crypto.decryptPhone(challenge.phoneEncrypted),
          country.dialCode,
        ),
        isDestination: existing.isDestination,
        level: level.verificationLevel,
      };
    }

    const phoneId = newId();
    const phoneEncrypted = challenge.phoneEncrypted;

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.phoneNumber.create({
        data: {
          id: phoneId,
          userId,
          countryId: country.id,
          phoneEncrypted,
          phoneHmac: challenge.phoneHmac,
          // Le numéro d'inscription reste le principal : c'est celui par lequel le
          // membre se connecte, et le déplacer lui ferait chercher un code sur le
          // mauvais téléphone.
          isPrimary: false,
          // LA colonne qui décide de L2 (§7.2). Elle est calculée depuis le pays,
          // jamais reçue du client.
          isDestination: true,
          verifiedAt: now,
        },
      });

      await this.outbox.emit(tx, {
        type: 'phone.added',
        aggregateId: userId,
        payload: { userId, phoneId, isDestination: true, countryIso2: country.id },
      });

      // Dans la MÊME transaction : le niveau, les sessions à rafraîchir et
      // `user.level_changed` doivent vivre ou mourir avec le numéro qui les cause.
      return this.levels.recompute(userId, 'phone.added', tx);
    });

    this.logger.log(`Numéro de destination ajouté à ${userId} → ${result.level}`);

    return {
      id: phoneId,
      masked: this.crypto.maskPhone(this.crypto.decryptPhone(phoneEncrypted), country.dialCode),
      isDestination: true,
      level: result.level,
    };
  }

  // ── DELETE /me/phones/:id (§2.5) ──────────────────────────────────────────

  /**
   * Retire un numéro. « Refus si dernier numéro (`LAST_PHONE`) » (§4.2) — sans
   * numéro, le membre ne pourrait plus jamais se connecter : il n'y a pas de mot de
   * passe (§1).
   *
   * « Retirer le numéro de destination fait retomber à L1 » (§2.5) : ce n'est pas
   * une ligne de code de plus, c'est le recalcul qui le déduit tout seul.
   */
  async remove(
    userId: string,
    phoneId: string,
  ): Promise<{ removed: string; level: string }> {
    const phones = await this.prisma.phoneNumber.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, isPrimary: true },
    });

    const target = phones.find((p) => p.id === phoneId);
    // 404 et non 403 : le numéro d'un autre membre ne doit pas se laisser deviner.
    if (target === undefined) throw ApiError.notFound();
    if (phones.length <= 1) {
      throw new ApiError(
        'LAST_PHONE',
        AUTH_ERROR_MESSAGES.LAST_PHONE,
        AUTH_ERROR_CODES.LAST_PHONE,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.phoneNumber.delete({ where: { id: phoneId } });

      /**
       * Si le numéro retiré était le PRINCIPAL, un autre le devient.
       *
       * `is_primary` est `NOT NULL` mais rien ne garantit son unicité au niveau du
       * schéma : un compte sans aucun principal est donc possible, et c'est ce que
       * lit l'ordre d'affichage de `GET /me` (`isPrimary: 'desc'`). Le membre verrait
       * ses numéros dans un ordre arbitraire, et rien ne dirait plus lequel reçoit
       * les codes de connexion.
       */
      if (target.isPrimary) {
        const next = phones.find((p) => p.id !== phoneId);
        if (next !== undefined) {
          await tx.phoneNumber.update({ where: { id: next.id }, data: { isPrimary: true } });
        }
      }

      await this.outbox.emit(tx, {
        type: 'phone.removed',
        aggregateId: userId,
        payload: { userId, phoneId },
      });

      return this.levels.recompute(userId, 'phone.removed', tx);
    });

    return { removed: phoneId, level: result.level };
  }
}
