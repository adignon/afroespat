import { randomInt } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { newId } from '@app/db';
import {
  ACCOUNT_ERROR_CODES,
  ACCOUNT_ERROR_MESSAGES,
  ACCOUNT_LIMITS,
  type AccountErrorCode,
  type EmailState,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { CryptoService } from '../../common/crypto.service';
import { PrismaService } from '../../common/prisma.service';
import { EMAIL_PROVIDER, type EmailProvider } from '../../providers/providers';
import type { EmailAddressPort } from './notifications.service';

/**
 * L'adresse email du membre — 12-notifications.md §3 et §4.
 *
 * Ce service est à la fois le FOURNISSEUR d'adresses du moteur de notifications
 * (`EmailAddressPort`, qui remplace `NoEmailAddressPort`) et le propriétaire des
 * routes `POST /me/email`, `POST /me/email/verify`, `GET /me/email` et
 * `DELETE /me/email`.
 *
 * ── RÈGLES ──────────────────────────────────────────────────────────────────
 *
 *   · CHIFFRÉE comme le téléphone (`CryptoService.encryptEmail`), jamais renvoyée en
 *     clair : l'API ne rend qu'un masque, `j•••••••@gmail.com`.
 *   · « SANS EMAIL, PAS DE CANAL EMAIL » : `has()` ne rend vrai qu'une adresse
 *     VÉRIFIÉE. Envoyer des notifications à une adresse saisie par n'importe qui
 *     reviendrait à laisser un membre inonder la boîte d'un tiers.
 *   · LE CODE (6 chiffres, 15 min, 5 essais) est tiré avec `randomInt`, conservé
 *     HACHÉ (`hashToken` lié au membre et à l'adresse) et JAMAIS écrit au journal.
 *   · UN CHANGEMENT NE COUPE PAS LE CANAL : la nouvelle adresse reste « en attente »
 *     dans `email_verifications` ; l'ancienne reste active jusqu'à confirmation.
 *   · PAS D'ORACLE : on n'indique jamais qu'une adresse appartient déjà à un autre
 *     compte (rien ne l'interdit d'ailleurs : l'adresse ne sert pas à se connecter).
 */
@Injectable()
export class EmailAddressService implements EmailAddressPort {
  private readonly logger = new Logger(EmailAddressService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    @Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider,
  ) {}

  private fail(code: AccountErrorCode, details?: Record<string, unknown>): never {
    throw new ApiError(code, ACCOUNT_ERROR_MESSAGES[code], ACCOUNT_ERROR_CODES[code], details);
  }

  // ── EmailAddressPort ──────────────────────────────────────────────────────

  async has(userId: string): Promise<boolean> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailEncrypted: true, emailVerifiedAt: true },
    });
    return row !== null && row.emailEncrypted !== null && row.emailVerifiedAt !== null;
  }

  async resolve(userId: string): Promise<string | null> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailEncrypted: true, emailVerifiedAt: true },
    });
    if (row === null || row.emailEncrypted === null || row.emailVerifiedAt === null) return null;
    return this.crypto.decryptEmail(row.emailEncrypted);
  }

  // ── GET /me/email ─────────────────────────────────────────────────────────

  async state(userId: string, now: Date = new Date()): Promise<EmailState> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { emailEncrypted: true, emailVerifiedAt: true, emailVerification: true },
    });
    const pending = user.emailVerification;
    return {
      email:
        user.emailEncrypted === null
          ? null
          : {
              masked: this.crypto.maskEmail(this.crypto.decryptEmail(user.emailEncrypted)),
              verified: user.emailVerifiedAt !== null,
            },
      pending:
        pending === null || pending.expiresAt <= now
          ? null
          : {
              masked: this.crypto.maskEmail(this.crypto.decryptEmail(pending.emailEncrypted)),
              expiresAt: pending.expiresAt.toISOString(),
              resendAvailableAt: this.resendAt(pending.sentAt).toISOString(),
            },
    };
  }

  // ── POST /me/email ────────────────────────────────────────────────────────

  /** Enregistre l'adresse « en attente » et envoie le code. Ajout comme changement. */
  async start(userId: string, email: string, now: Date = new Date()): Promise<EmailState> {
    const current = await this.prisma.emailVerification.findUnique({ where: { userId } });
    if (current !== null && this.resendAt(current.sentAt) > now) {
      this.fail('EMAIL_RESEND_TOO_SOON', {
        retryAt: this.resendAt(current.sentAt).toISOString(),
      });
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const expiresAt = new Date(now.getTime() + ACCOUNT_LIMITS.emailCodeTtlMinutes * 60_000);
    const data = {
      emailEncrypted: this.crypto.encryptEmail(email),
      codeHash: this.codeHash(userId, email, code),
      attempts: 0,
      expiresAt,
      sentAt: now,
    };
    await this.prisma.emailVerification.upsert({
      where: { userId },
      create: { id: newId(), userId, ...data },
      update: data,
    });

    try {
      await this.provider.send(email, 'email_verification', { code });
    } catch (error) {
      // La ligne reste (le membre peut redemander), mais le délai de renvoi est
      // levé : un échec d'envoi ne doit pas le faire attendre une minute de plus.
      await this.prisma.emailVerification.update({
        where: { userId },
        data: { sentAt: new Date(now.getTime() - ACCOUNT_LIMITS.emailResendSeconds * 1000) },
      });
      // Ni l'adresse ni le code dans le journal : seulement la nature de l'erreur.
      this.logger.warn(`Envoi du code email impossible : ${error instanceof Error ? error.name : 'erreur'}`);
      this.fail('EMAIL_SEND_FAILED');
    }
    return this.state(userId, now);
  }

  // ── POST /me/email/verify ─────────────────────────────────────────────────

  async verify(userId: string, code: string, now: Date = new Date()): Promise<EmailState> {
    const pending = await this.prisma.emailVerification.findUnique({ where: { userId } });
    if (pending === null) this.fail('EMAIL_NO_PENDING');
    if (pending.expiresAt <= now || pending.attempts >= ACCOUNT_LIMITS.emailCodeMaxAttempts) {
      this.fail('EMAIL_CODE_EXPIRED');
    }

    const email = this.crypto.decryptEmail(pending.emailEncrypted);
    // Le compteur monte AVANT la comparaison : deux requêtes simultanées ne
    // doivent pas obtenir chacune « quatre essais restants ».
    const updated = await this.prisma.emailVerification.update({
      where: { userId },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    if (updated.attempts > ACCOUNT_LIMITS.emailCodeMaxAttempts) this.fail('EMAIL_CODE_EXPIRED');

    if (!this.crypto.verifyToken(this.codePreimage(userId, email, code), pending.codeHash)) {
      this.fail('EMAIL_CODE_INVALID', {
        attemptsLeft: Math.max(0, ACCOUNT_LIMITS.emailCodeMaxAttempts - updated.attempts),
      });
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { emailEncrypted: pending.emailEncrypted, emailVerifiedAt: now },
      }),
      this.prisma.emailVerification.delete({ where: { userId } }),
    ]);
    return this.state(userId, now);
  }

  // ── DELETE /me/email ──────────────────────────────────────────────────────

  /** Retire l'adresse ET la vérification en cours : le canal email s'éteint. */
  async remove(userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { emailEncrypted: null, emailVerifiedAt: null } }),
      this.prisma.emailVerification.deleteMany({ where: { userId } }),
    ]);
  }

  // ── Internes ──────────────────────────────────────────────────────────────

  private resendAt(sentAt: Date): Date {
    return new Date(sentAt.getTime() + ACCOUNT_LIMITS.emailResendSeconds * 1000);
  }

  /** Le code est lié au membre ET à l'adresse : il ne vaut pas pour une autre. */
  private codePreimage(userId: string, email: string, code: string): string {
    return `email:${userId}:${email}:${code}`;
  }

  private codeHash(userId: string, email: string, code: string): string {
    return this.crypto.hashToken(this.codePreimage(userId, email, code));
  }
}
