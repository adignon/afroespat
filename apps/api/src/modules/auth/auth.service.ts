import { randomInt } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { newId } from '@app/db';
import {
  AUTH_ERROR_MESSAGES,
  AUTH_ERROR_CODES,
  RATE_LIMITS,
  type AuthErrorCode,
  type OtpPurpose,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { TokenService } from '../../common/token.service';
import { CryptoService } from '../../common/crypto.service';
import { OutboxService } from '../../common/outbox.service';
import { PrismaService } from '../../common/prisma.service';
import { CAPTCHA_PROVIDER, SMS_PROVIDER, type CaptchaProvider, type SmsProvider } from '../../providers/providers';

/**
 * Authentification — 01-identite.md §2.1.
 *
 * Aucun mot de passe membre : l'identifiant est le numéro de téléphone, vérifié
 * par OTP. Les mots de passe n'existent que pour l'équipe (§7.4), et les deux
 * domaines sont hermétiques.
 *
 * Le fil conducteur de tout ce service est le principe de discrétion de T4 §3 :
 * **ne jamais révéler l'existence d'un compte avant vérification du code**.
 * C'est pourquoi `SIGNUP` sur un numéro connu bascule silencieusement en
 * `LOGIN`, et pourquoi les messages d'erreur ne distinguent jamais « numéro
 * inconnu » de « code faux ».
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly outbox: OutboxService,
    private readonly tokens: TokenService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
    @Inject(CAPTCHA_PROVIDER) private readonly captcha: CaptchaProvider,
  ) {}

  private fail(code: AuthErrorCode, details?: Record<string, unknown>): never {
    throw new ApiError(code, AUTH_ERROR_MESSAGES[code], AUTH_ERROR_CODES[code], details);
  }

  // ── Envoi d'un code ───────────────────────────────────────────────────────

  /**
   * Crée un défi OTP et envoie le code.
   *
   * L'ordre des contrôles compte, et il est dicté par le coût : on vérifie le
   * PAYS avant le captcha, et le captcha avant la limite de débit, pour ne
   * jamais envoyer un SMS — qui coûte — sur une requête qu'on aurait refusée
   * de toute façon.
   */
  async requestOtp(input: {
    phone: string;
    countryIso2: string;
    captchaToken: string;
    purpose: OtpPurpose;
    // `| undefined` explicite plutôt que `?` : l'appelant DOIT décider s'il a
    // une IP, au lieu de l'oublier et de désactiver une limite de débit sans
    // s'en apercevoir.
    ip: string | undefined;
  }): Promise<{ challengeId: string; expiresAt: Date }> {
    // 1. Le pays est-il ouvert ? Refusé AVANT tout envoi (§2.1).
    const country = await this.prisma.country.findUnique({
      where: { iso2: input.countryIso2 },
      select: { id: true, dialCode: true, isActive: true },
    });
    if (country === null || !country.isActive) this.fail('COUNTRY_NOT_SUPPORTED');

    const e164 = this.toE164(input.phone, country.dialCode);
    const fingerprint = this.crypto.phoneFingerprint(e164);

    // 2. Captcha obligatoire (§2.1). Turnstile en production, fictif en local.
    if (!(await this.captcha.verify(input.captchaToken, input.ip))) {
      this.fail('CAPTCHA_FAILED');
    }

    // 3. Limites de débit : 3 par numéro et par heure, 10 par IP.
    await this.assertWithinRateLimits(fingerprint, input.ip);

    // 4. Le code. `randomInt` et non `Math.random` : un OTP prédictible ne
    //    protège rien, et c'est exactement le genre de raccourci qui survit.
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const expiresAt = new Date(Date.now() + RATE_LIMITS.otpTtlSeconds * 1000);
    const challengeId = newId();

    await this.prisma.otpChallenge.create({
      data: {
        id: challengeId,
        phoneHmac: fingerprint,
        // Le pays choisi et le numéro chiffré voyagent avec le défi : à la
        // vérification, l'empreinte seule ne permettrait ni de recréer le
        // numéro (elle est irréversible) ni de retrouver le bon pays.
        countryId: country.id,
        phoneEncrypted: this.crypto.encryptPhone(e164),
        // SIGNUP sur un numéro connu bascule en LOGIN à la VÉRIFICATION, pas
        // ici : décider maintenant révélerait l'existence du compte par le
        // temps de réponse.
        purpose: input.purpose,
        codeHash: this.crypto.hashToken(code),
        attempts: 0,
        expiresAt,
        ip: input.ip ?? null,
      },
    });

    await this.sms.send(e164, `Votre code de connexion : ${code}`);

    return { challengeId, expiresAt };
  }

  /** 3 envois par numéro et par heure, 10 par IP (§2.1). */
  private async assertWithinRateLimits(fingerprint: string, ip: string | undefined): Promise<void> {
    const since = new Date(Date.now() - 3_600_000);

    const byPhone = await this.prisma.otpChallenge.count({
      where: { phoneHmac: fingerprint, createdAt: { gte: since } },
    });
    if (byPhone >= RATE_LIMITS.otpPerPhonePerHour) {
      this.fail('OTP_ATTEMPTS_EXCEEDED', { retryAfterSeconds: 3600 });
    }

    if (ip !== undefined) {
      const byIp = await this.prisma.otpChallenge.count({
        where: { ip, createdAt: { gte: since } },
      });
      if (byIp >= RATE_LIMITS.otpPerIpPerHour) {
        this.fail('OTP_ATTEMPTS_EXCEEDED', { retryAfterSeconds: 3600 });
      }
    }
  }

  // ── Vérification ──────────────────────────────────────────────────────────

  /**
   * Vérifie le code, crée le compte si le numéro est inconnu, ouvre une session.
   *
   * `isNewUser` est renvoyé pour que le front sache s'il doit enchaîner sur
   * l'onboarding — c'est la seule information sur l'existence du compte, et
   * elle n'arrive qu'APRÈS un code valide.
   */
  async verifyOtp(input: {
    challengeId: string;
    code: string;
    ip: string | undefined;
    userAgent: string | undefined;
  }): Promise<{ accessToken: string; refreshToken: string; isNewUser: boolean; userId: string }> {
    const challenge = await this.prisma.otpChallenge.findUnique({
      where: { id: input.challengeId },
    });

    // Un défi inconnu et un défi consommé donnent la MÊME erreur : distinguer
    // les deux dirait à un attaquant qu'il a trouvé un identifiant valide.
    if (challenge === null || challenge.consumedAt !== null) this.fail('OTP_INVALID');
    if (challenge.expiresAt.getTime() < Date.now()) this.fail('OTP_EXPIRED');

    if (challenge.attempts >= RATE_LIMITS.otpAttempts) {
      this.fail('OTP_ATTEMPTS_EXCEEDED');
    }

    if (!this.crypto.verifyToken(input.code, challenge.codeHash)) {
      // On incrémente AVANT de répondre : sinon un attaquant coupe la connexion
      // après chaque essai et le compteur ne monte jamais.
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      this.fail('OTP_INVALID', { attemptsLeft: RATE_LIMITS.otpAttempts - challenge.attempts - 1 });
    }

    // Code bon : le défi est consommé, quoi qu'il arrive ensuite.
    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    const existing = await this.prisma.phoneNumber.findUnique({
      where: { phoneHmac: challenge.phoneHmac },
      select: { userId: true },
    });

    const { userId, isNewUser } =
      existing === null
        ? { userId: await this.createAccount(challenge), isNewUser: true }
        : { userId: existing.userId, isNewUser: false };

    const session = await this.openSession(userId, input.ip, input.userAgent);
    return { ...session, isNewUser, userId };
  }

  /**
   * Crée le compte à la première vérification réussie.
   *
   * Le membre arrive en L0 : numéro vérifié, rien d'autre. C'est assez pour
   * créer son parcours et demander de l'aide (§7.3) — un pré-départ doit
   * pouvoir commencer sans pièce d'identité.
   *
   * Le pays du NUMÉRO et le pays d'ORIGINE sont deux choses différentes, et les
   * confondre est une erreur qui se voit mal : un membre déjà installé en France,
   * avec un numéro français, se verrait attribuer la France comme pays d'origine
   * — un pays `DESTINATION` (02 §2.1), donc sans réseau automatique ni modèle de
   * parcours — et le choix étant modifiable une seule fois (§2.7), il y resterait.
   *
   * Le pays d'origine n'est demandé qu'à l'écran 3 de l'onboarding (§5). Ici on
   * ne pose qu'une valeur provisoire, non figée, que cet écran remplacera.
   */
  private async createAccount(challenge: {
    phoneHmac: string;
    countryId: string;
    phoneEncrypted: Uint8Array<ArrayBuffer> | null;
  }): Promise<string> {
    // Un défi sans numéro chiffré ne peut pas créer de compte : le membre ne
    // pourrait plus jamais voir son propre numéro masqué. Mieux vaut échouer
    // ici que fabriquer un compte estropié.
    const phoneEncrypted = challenge.phoneEncrypted;
    if (phoneEncrypted === null) {
      throw new Error('Défi OTP sans numéro chiffré : compte non créable.');
    }

    const originCountryId = await this.provisionalOriginCountry(challenge.countryId);
    const userId = newId();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: userId,
          // Handle provisoire : l'onboarding le remplace à l'écran O04. Il est
          // unique par construction et jamais montré avant d'être choisi.
          handle: `m${userId.replace(/-/g, '').slice(0, 14)}`,
          displayName: '',
          phase: 'PRE_DEPARTURE',
          verificationLevel: 'L0',
          originCountryId,
          plan: 'FREE',
          status: 'ACTIVE',
          timezone: 'Europe/Paris',
          // L'écran 1 de §5 — téléphone et OTP — vient d'être franchi. Laisser 0
          // renverrait le membre sur l'écran qu'il vient de terminer.
          onboardingStep: 1,
          // `userId` est implicite : Prisma le déduit de la relation parente.
          stats: { create: { computedAt: new Date() } },
        },
      });

      await tx.phoneNumber.create({
        data: {
          id: newId(),
          userId,
          countryId: challenge.countryId,
          phoneEncrypted,
          phoneHmac: challenge.phoneHmac,
          isPrimary: true,
          isDestination: false,
          verifiedAt: new Date(),
        },
      });

      await this.outbox.emit(tx, {
        type: 'user.registered',
        aggregateId: userId,
        payload: { level: 'L0' },
      });
    });

    return userId;
  }

  /**
   * Valeur provisoire pour `origin_country_id`, qui est NOT NULL.
   *
   * Le pays du numéro convient s'il peut être un pays d'origine. Sinon — cas du
   * numéro français — on prend le pays `ORIGIN` ouvert : au lancement il n'y en a
   * qu'un (02 §2.1), et l'écran 3 de l'onboarding fait de toute façon choisir.
   *
   * `origin_country_locked_at` reste nul : ce n'est pas un choix du membre, et le
   * figer ici lui volerait l'unique modification que §2.7 lui accorde.
   */
  private async provisionalOriginCountry(phoneCountryId: string): Promise<string> {
    const phoneCountry = await this.prisma.country.findUnique({
      where: { id: phoneCountryId },
      select: { id: true, kind: true },
    });
    if (phoneCountry !== null && phoneCountry.kind !== 'DESTINATION') return phoneCountry.id;

    const origin = await this.prisma.country.findFirstOrThrow({
      where: { isActive: true, kind: { in: ['ORIGIN', 'BOTH'] } },
      orderBy: { sortOrder: 'asc' },
      select: { id: true },
    });
    return origin.id;
  }

  // ── Sessions ──────────────────────────────────────────────────────────────

  /**
   * Ouvre une session. Le jeton de rafraîchissement est STOCKÉ HACHÉ : une fuite
   * de la base ne donne alors aucune session utilisable.
   */
  private async openSession(
    userId: string,
    ip: string | undefined,
    userAgent: string | undefined,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const chainId = newId();
    const refreshToken = formatRefreshToken(chainId, 0);
    const expiresAt = new Date(Date.now() + RATE_LIMITS.refreshTokenDays * 86_400_000);
    const sessionId = newId();

    await this.prisma.authSession.create({
      data: {
        id: sessionId,
        userId,
        chainId,
        tokenGeneration: 0,
        refreshTokenHash: this.crypto.hashToken(refreshToken),
        expiresAt,
        lastUsedAt: new Date(),
        ip: ip ?? null,
        userAgent: userAgent ?? null,
        deviceLabel: null,
      },
    });

    return { accessToken: await this.issueAccessToken(userId, sessionId), refreshToken };
  }

  /**
   * Jeton d'accès de 15 minutes portant `sub`, `level`, `plan`, `status`, `sid`
   * (T4 §2). Court, parce que le NIVEAU y figure : un membre qui passe L1 ne
   * doit pas attendre.
   */
  private async issueAccessToken(userId: string, sessionId: string): Promise<string> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { verificationLevel: true, plan: true, status: true },
    });

    return this.tokens.sign({
      sub: userId,
      sid: sessionId,
      level: user.verificationLevel,
      plan: user.plan,
      status: user.status,
      exp: Math.floor(Date.now() / 1000) + RATE_LIMITS.accessTokenSeconds,
    });
  }

  /**
   * Rafraîchit. ROTATION à chaque usage, et RÉVOCATION DE LA CHAÎNE si un jeton
   * d'une génération déjà dépassée réapparaît (§2.1).
   *
   * Le jeton porte sa chaîne et son numéro de génération. C'est ce qui rend la
   * détection possible : la rotation écrase le hachage, donc un ancien jeton ne
   * correspond plus à rien — et sans le numéro de génération, son rejeu serait
   * indistinguable d'un jeton inventé. On retrouve la session par la CHAÎNE, qui
   * elle ne bouge pas, et toute génération inférieure à la courante est un rejeu,
   * quel que soit son âge et sans conserver aucun historique.
   *
   * Le rejeu révoque la CHAÎNE, et non toutes les sessions du membre : c'est ce
   * que dit §2.1, et c'est plus juste — un appareil compromis ne doit pas
   * déconnecter les deux autres, sur lesquels le membre est peut-être en train
   * de lire la notification qui l'en avertit.
   */
  async refresh(
    refreshToken: string,
    ip: string | undefined,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const parsed = parseRefreshToken(refreshToken);
    if (parsed === null) this.fail('SESSION_REVOKED');

    const session = await this.prisma.authSession.findUnique({
      where: { chainId: parsed.chainId },
    });
    if (session === null) this.fail('SESSION_REVOKED');

    if (session.revokedAt !== null) this.fail('SESSION_REVOKED');

    if (parsed.generation < session.tokenGeneration) {
      // Une génération dépassée qui revient : quelqu'un rejoue un jeton. On
      // coupe la chaîne, des deux côtés — le porteur légitime comme l'autre.
      this.logger.warn(
        `Rejeu de jeton sur la chaîne ${parsed.chainId} (génération ${parsed.generation} ` +
          `contre ${session.tokenGeneration}) — chaîne révoquée`,
      );
      await this.prisma.authSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      this.fail('SESSION_REVOKED');
    }

    // Une génération SUPÉRIEURE à la courante n'a jamais été émise : c'est un
    // jeton fabriqué. Le contrôle du hachage le rejetterait de toute façon,
    // mais autant le dire ici plutôt que de le laisser passer pour un hasard.
    if (parsed.generation !== session.tokenGeneration) this.fail('SESSION_REVOKED');

    if (!this.crypto.verifyToken(refreshToken, session.refreshTokenHash)) {
      this.fail('SESSION_REVOKED');
    }

    if (session.expiresAt.getTime() < Date.now()) this.fail('SESSION_REVOKED');

    const nextGeneration = session.tokenGeneration + 1;
    const next = formatRefreshToken(session.chainId, nextGeneration);
    await this.prisma.authSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: this.crypto.hashToken(next),
        tokenGeneration: nextGeneration,
        lastUsedAt: new Date(),
        ip: ip ?? session.ip,
        // Le niveau a été rafraîchi : le drapeau retombe.
        levelRefreshRequired: false,
      },
    });

    return {
      accessToken: await this.issueAccessToken(session.userId, session.id),
      refreshToken: next,
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async listSessions(userId: string, currentSessionId: string) {
    const sessions = await this.prisma.authSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
      select: { id: true, deviceLabel: true, userAgent: true, lastUsedAt: true, createdAt: true },
    });

    // L'IP n'est PAS renvoyée : elle approche une position, et §8.1 ne collecte
    // aucune position plus fine que la ville.
    return sessions.map((s) => ({
      id: s.id,
      deviceLabel: s.deviceLabel ?? this.describeDevice(s.userAgent),
      lastUsedAt: s.lastUsedAt,
      createdAt: s.createdAt,
      isCurrent: s.id === currentSessionId,
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Toutes sauf la courante — l'action « déconnecter partout ailleurs ». */
  async revokeOtherSessions(userId: string, keepSessionId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null, id: { not: keepSessionId } },
      data: { revokedAt: new Date() },
    });
  }

  // ── Outils ────────────────────────────────────────────────────────────────

  private toE164(phone: string, dialCode: string): string {
    const digits = phone.replace(/[\s.\-–—()]/g, '');
    if (digits.startsWith('+')) return digits;
    return `${dialCode}${digits.replace(/^0+/, '')}`;
  }

  /** Libellé lisible, sans empreinte de navigateur : « Chrome sur Android ». */
  private describeDevice(userAgent: string | null): string {
    if (userAgent === null) return 'Appareil inconnu';
    const browser = /Firefox/.test(userAgent)
      ? 'Firefox'
      : /Edg\//.test(userAgent)
        ? 'Edge'
        : /Chrome/.test(userAgent)
          ? 'Chrome'
          : /Safari/.test(userAgent)
            ? 'Safari'
            : 'Navigateur';
    const os = /Android/.test(userAgent)
      ? 'Android'
      : /iPhone|iPad/.test(userAgent)
        ? 'iOS'
        : /Mac OS/.test(userAgent)
          ? 'Mac'
          : /Windows/.test(userAgent)
            ? 'Windows'
            : 'appareil';
    return `${browser} sur ${os}`;
  }
}

/**
 * `chainId.génération.secret`.
 *
 * La chaîne et la génération sont EN CLAIR, et c'est sans danger : elles ne
 * donnent aucun accès. Seul le secret le fait, et il n'est stocké que haché.
 */
function formatRefreshToken(chainId: string, generation: number): string {
  return `${chainId}.${generation}.${newId()}${newId().replace(/-/g, '')}`;
}

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseRefreshToken(token: string): { chainId: string; generation: number } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [chainId, generationText] = parts as [string, string, string];

  // La forme de l'UUID est vérifiée ICI, avant la requête : `chain_id` est une
  // colonne uuid, et Postgres lèverait sur une valeur mal formée. On répondrait
  // alors 500 à ce qui n'est qu'un jeton invalide — et on distinguerait, par le
  // code HTTP, un jeton mal formé d'un jeton inconnu.
  if (!UUID_SHAPE.test(chainId)) return null;

  const generation = Number(generationText);
  if (!Number.isInteger(generation) || generation < 0) return null;
  return { chainId, generation };
}
