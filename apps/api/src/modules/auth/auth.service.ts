import { randomInt } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { newId } from '@app/db';
import {
  analyserNumero,
  ACCOUNT_ERROR_CODES,
  ACCOUNT_ERROR_MESSAGES,
  AUTH_ERROR_MESSAGES,
  AUTH_ERROR_CODES,
  RATE_LIMITS,
  type AuthErrorCode,
  type OtpPurpose,
} from '@app/shared';
import { ProviderError } from '../../providers/http';
import { ApiError } from '../../common/api-error';
import { TokenService } from '../../common/token.service';
import { ConsentsService } from '../consents/consents.service';
import { loadEnv } from '../../config/env';
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
/**
 * Pseudo provisoire, remplacé à l'écran O04 de l'onboarding.
 *
 * Il prend l'identifiant ENTIER, moins ce qui dépasse les 30 caractères permis
 * (§2.6). Une version antérieure n'en gardait que 14 en affirmant qu'il était
 * « unique par construction » — c'était faux : un UUID v7 commence par 48 bits
 * d'horodatage, soit douze caractères hexadécimaux. Deux comptes créés dans la
 * même milliseconde partageaient donc le même pseudo, et la création échouait sur
 * la contrainte d'unicité. Trouvé quand deux tests ont inscrit deux membres en
 * parallèle — jamais en relisant.
 *
 * Le `m` initial n'est pas décoratif : §2.6 interdit de commencer par un chiffre,
 * et un identifiant hexadécimal commence par un chiffre une fois sur deux.
 */
export function provisionalHandle(userId: string): string {
  return `m${userId.replace(/-/g, '').slice(0, 29)}`;
}

/** L'environnement, isolé pour que le service reste testable sans config. */
function loadEnvOrDefault(): string {
  try {
    return loadEnv().NODE_ENV;
  } catch {
    return 'development';
  }
}

/**
 * LE CODE OTP FIXE DU FOURNISSEUR FICTIF — `SMS_FAKE_FIXED_CODE`.
 *
 * Ce réglage EXISTAIT et ne servait à rien. Il est déclaré dans `envSchema`
 * (`/^\d{6}$/`, défaut `123456`), documenté dans `.env.example` en ces termes —
 * « En local et en test : FAKE partout (§11.3) » — et il n'était lu par PERSONNE :
 * `FakeSmsProvider` ne reçoit aucune configuration, et le code était tiré au hasard
 * ici puis seulement JOURNALISÉ. C'est la même famille de défaut que
 * `cities.member_count`, écrit par personne : un réglage qui a l'air branché et ne
 * l'est pas.
 *
 * Il coûtait quelque chose de concret : aucun test de bout en bout ne pouvait se
 * connecter. Il fallait relire le journal du serveur pour trouver le code, ce qu'un
 * navigateur piloté ne sait pas faire — donc les dix écrans du module Compte, qui
 * exigent une session depuis qu'ils lisent l'API, étaient inéprouvables à l'écran.
 *
 * TROIS CONDITIONS, et aucune n'est superflue :
 *   · `SMS_PROVIDER === 'fake'` — un vrai SMS porte un vrai code ;
 *   · `NODE_ENV !== 'production'` — ceinture ET bretelles. `loadEnv` refuse déjà de
 *     démarrer en production avec un fournisseur fictif, mais un OTP prédictible est
 *     la clé de tous les comptes : la garde doit être ici AUSSI, là où le code est
 *     fabriqué, et pas seulement dans le chargement de la configuration ;
 *   · la configuration doit se charger. Sans elle, on retombe sur le hasard.
 *
 * `randomInt` reste le chemin par défaut, et le commentaire d'origine reste vrai :
 * « un OTP prédictible ne protège rien, et c'est exactement le genre de raccourci
 * qui survit ». Celui-ci ne survit pas à la production, par construction.
 */
function otpCodeFixe(): string | null {
  try {
    const env = loadEnv();
    if (env.NODE_ENV === 'production') return null;
    if (env.SMS_PROVIDER !== 'fake') return null;
    return env.SMS_FAKE_FIXED_CODE;
  } catch {
    return null;
  }
}

/** Les finalités d'un défi qui peuvent ouvrir une session (`verifyOtp`). */
const PURPOSES_DE_CONNEXION: readonly OtpPurpose[] = ['SIGNUP', 'LOGIN', 'REACTIVATE'];

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly outbox: OutboxService,
    private readonly tokens: TokenService,
    private readonly consents: ConsentsService,
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
      select: { id: true, dialCode: true, isActive: true, phoneNationalLength: true },
    });
    if (country === null || !country.isActive) this.fail('COUNTRY_NOT_SUPPORTED');

    /**
     * ╔══════════════════════════════════════════════════════════════════════╗
     * ║ LE NUMÉRO EST-IL BIEN FORMÉ POUR CE PAYS ? — RIEN NE LE REGARDAIT   ║
     * ╚══════════════════════════════════════════════════════════════════════╝
     *
     * Le porteur : « il faut la validation du numéro selon le pays. Backend et
     * frontend aussi pour valider le format. »
     *
     * MESURÉ AVANT : `{"phone":"12345678901234567","countryIso2":"BJ"}` était
     * ACCEPTÉ, et un SMS partait. Le schéma ne bornait que la longueur brute de
     * la chaîne (4 à 24), ce qui ne dit rien d'un plan de numérotation.
     *
     * La règle vient du RÉFÉRENTIEL (`countries.phone_national_length`), et c'est
     * la MÊME fonction que l'écran emploie pour griser son bouton. Deux
     * implémentations divergeraient, et le membre paierait l'écart : un bouton
     * actif suivi d'un refus.
     *
     * ── DEUX REFUS DE PLUS (lot A) ──────────────────────────────────────────
     * `PHONE_COUNTRY_MISMATCH` : `+2290190000000` choisi avec « FR » passait et
     * comptait comme destination française, donc ouvrait le niveau L2 avec un
     * numéro béninois. `PHONE_NOT_MOBILE` : un fixe ne reçoit pas de SMS. Les
     * deux règles vivent dans `analyserNumero` (shared), que l'écran appelle aussi.
     *
     * Le refus arrive AVANT le captcha et avant tout envoi : un numéro mal formé
     * ne doit coûter ni vérification ni SMS.
     */
    const analyse = analyserNumero(input.phone, input.countryIso2);
    if (!analyse.ok) {
      this.fail(analyse.code, { dialCode: country.dialCode });
    }

    /**
     * ── LE NUMÉRO ENREGISTRÉ EST CELUI DE LA BIBLIOTHÈQUE ──────────────────
     *
     * Le porteur : « il faut que ce soit le format international qu'il faut
     * enregistrer ». `toE164` le faisait déjà à la main — concaténer l'indicatif
     * au numéro débarrassé de son zéro — et c'était juste pour les cas simples.
     * `libphonenumber` connaît les exceptions : préfixes de service, longueurs
     * par type de ligne, plans renumérotés. On enregistre donc CE qu'elle rend,
     * et plus ce qu'on déduisait.
     */
    const e164 = analyse.e164;
    const fingerprint = this.crypto.phoneFingerprint(e164);

    // 2. Captcha obligatoire (§2.1). Turnstile en production, fictif en local.
    if (!(await this.captcha.verify(input.captchaToken, input.ip))) {
      this.fail('CAPTCHA_FAILED');
    }

    // 3. Limites de débit : 3 par numéro et par heure, 10 par IP.
    await this.assertWithinRateLimits(fingerprint, input.ip);

    // 4. Le code. `randomInt` et non `Math.random` : un OTP prédictible ne
    //    protège rien, et c'est exactement le genre de raccourci qui survit.
    //    `otpCodeFixe()` ne rend un code que hors production ET avec le
    //    fournisseur SMS fictif — voir son commentaire, et pourquoi ce réglage
    //    déclaré n'était branché à rien.
    const code = otpCodeFixe() ?? String(randomInt(0, 1_000_000)).padStart(6, '0');
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

    /**
     * ── POURQUOI L'ENVOI RESTE DIRECT, ET PAS DANS LA FILE `sms` ───────────────
     *
     * La file `sms` (réessais exponentiels) a été envisagée et écartée pour l'OTP :
     *   · le code devrait voyager EN CLAIR dans la charge du travail, donc dans
     *     Redis : le défi ne conserve que son empreinte, précisément pour qu'aucun
     *     support de stockage ne détienne un code valide ;
     *   · le membre attend ce SMS, écran ouvert : un réessai à +30 s, +1 min…
     *     arriverait après qu'il a redemandé un code, et chaque envoi tardif est un
     *     SMS payant de plus pour un code déjà remplacé ;
     *   · le membre dispose du renvoi, et le défi vit 10 minutes.
     * À la place : UN réessai immédiat sur une panne transitoire (réseau, 429, 5xx),
     * et, si l'envoi échoue quand même, le défi est SUPPRIMÉ — il ne doit pas
     * consommer l'un des trois envois horaires du membre pour un SMS jamais parti.
     */
    try {
      await this.sendWithOneRetry(e164, `Votre code de connexion : ${code}`);
    } catch (error) {
      await this.prisma.otpChallenge.delete({ where: { id: challengeId } }).catch(() => undefined);
      this.logger.warn(`SMS non envoyé : ${error instanceof Error ? error.message : 'erreur'}`);
      this.fail('SMS_SEND_FAILED');
    }

    return { challengeId, expiresAt };
  }

  private async sendWithOneRetry(to: string, body: string): Promise<void> {
    try {
      await this.sms.send(to, body);
    } catch (error) {
      const retryable = error instanceof ProviderError ? error.retryable : false;
      if (!retryable) throw error;
      await this.sms.send(to, body);
    }
  }

  /**
   * La boucle locale échappe à la limite par IP, HORS PRODUCTION uniquement.
   *
   * En développement tout part de `127.0.0.1` : la limite de dix par heure et par
   * IP y épuise le quota en quelques essais, et l'inscription devient intestable
   * — le serveur refuse pour une raison juste, mais qui n'a aucun rapport avec ce
   * qu'on éprouve. La limite par NUMÉRO, elle, reste appliquée : c'est celle qui
   * protège un membre du harcèlement.
   *
   * En production la fonction rend toujours `false`. Une exemption ouverte là-bas
   * suffirait à énumérer les numéros derrière un en-tête forgé.
   */
  private isExemptLocalIp(ip: string): boolean {
    if (loadEnvOrDefault() === 'production') return false;
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  }

  /** 3 envois par numéro et par heure, 10 par IP (§2.1). */
  private async assertWithinRateLimits(fingerprint: string, ip: string | undefined): Promise<void> {
    const since = new Date(Date.now() - 3_600_000);

    // `RATE_LIMITED` et non `OTP_ATTEMPTS_EXCEEDED` : §4.1 donne le premier à
    // l'ENVOI et le second à la VÉRIFICATION. Les confondre faisait lire au
    // membre « Trop de tentatives, demandez un nouveau code » au moment précis
    // où on venait de lui refuser un nouveau code.
    const tooMany = () =>
      ApiError.transverse('RATE_LIMITED', { retryAfterSeconds: 3600 });

    const byPhone = await this.prisma.otpChallenge.count({
      where: { phoneHmac: fingerprint, createdAt: { gte: since } },
    });
    if (byPhone >= RATE_LIMITS.otpPerPhonePerHour) throw tooMany();

    if (ip !== undefined && !this.isExemptLocalIp(ip)) {
      const byIp = await this.prisma.otpChallenge.count({
        where: { ip, createdAt: { gte: since } },
      });
      if (byIp >= RATE_LIMITS.otpPerIpPerHour) throw tooMany();
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
    const challenge = await this.consumeChallenge(input.challengeId, input.code);

    /**
     * ╔══════════════════════════════════════════════════════════════════════╗
     * ║ UN CODE D'AJOUT DE NUMÉRO OU DE SUPPRESSION N'OUVRE PAS DE SESSION  ║
     * ╚══════════════════════════════════════════════════════════════════════╝
     *
     * `confirmWithOtp` contrôlait déjà le `purpose` ; la connexion, non. Un code
     * reçu pour `ADD_PHONE` ou `DELETE_ACCOUNT` — demandé sur la route publique
     * `POST /auth/otp/request`, qui accepte tout `purpose` — ouvrait donc une
     * session complète sur le numéro. Seuls les défis de connexion le font :
     * `SIGNUP` (bascule en connexion si le numéro est connu), `LOGIN` et
     * `REACTIVATE` (reconnexion d'un compte désactivé). Le défi est déjà
     * consommé : un refus brûle le code, comme dans `confirmWithOtp`.
     */
    if (!PURPOSES_DE_CONNEXION.includes(challenge.purpose)) {
      throw new ApiError(
        'OTP_PURPOSE_MISMATCH',
        ACCOUNT_ERROR_MESSAGES.OTP_PURPOSE_MISMATCH,
        ACCOUNT_ERROR_CODES.OTP_PURPOSE_MISMATCH,
        { expected: 'LOGIN', given: challenge.purpose },
      );
    }

    const existing = await this.prisma.phoneNumber.findUnique({
      where: { phoneHmac: challenge.phoneHmac },
      select: { userId: true },
    });

    let userId: string;
    let isNewUser: boolean;
    if (existing === null) {
      /**
       * UN NUMÉRO BANNI NE SE RÉINSCRIT PAS — 13 §4.2, et §11 : « un banni supprimé
       * reste banni ».
       *
       * Le contrôle est ICI, sur la branche « aucun compte ne porte ce numéro »,
       * et c'est précisément la branche que rien ne protégeait. Quand le compte
       * banni EXISTE encore, on ne passe jamais par là : `phone_numbers.phone_hmac`
       * est unique, la recherche juste au-dessus le trouve, et `resumeAccount`
       * refuse avec `ACCOUNT_BANNED`. La faille était l'autre cas — un compte banni
       * SUPPRIMÉ vide `phone_numbers`, l'empreinte redevient libre, et le banni
       * revenait avec le même téléphone. Vérifié en base.
       *
       * On refuse avec le MÊME code et le MÊME message que le compte banni
       * existant. Deux refus distincts diraient à qui tâtonne si le compte a été
       * supprimé ou non, et cela ne regarde personne.
       */
      const banned = await this.prisma.bannedPhoneHash.findUnique({
        where: { phoneHmac: challenge.phoneHmac },
        select: { phoneHmac: true },
      });
      if (banned !== null) {
        throw new ApiError(
          'ACCOUNT_BANNED',
          ACCOUNT_ERROR_MESSAGES.ACCOUNT_BANNED,
          ACCOUNT_ERROR_CODES.ACCOUNT_BANNED,
        );
      }
      userId = await this.createAccount(challenge);
      isNewUser = true;
    } else {
      userId = existing.userId;
      isNewUser = false;
      // §2.8 : une connexion OTP réveille un compte désactivé et ANNULE une
      // suppression en attente. Elle refuse en revanche un mineur et un banni.
      await this.resumeAccount(userId);
    }

    const session = await this.openSession(userId, input.ip, input.userAgent);
    return { ...session, isNewUser, userId };
  }

  /**
   * Éprouve un code et CONSOMME le défi. Extrait de `verifyOtp` parce que trois
   * autres actions en dépendent — ajout de numéro (§2.5), suppression de compte et
   * désactivation (§2.8) — et qu'une seconde copie de ces cinq contrôles finirait
   * par en oublier un.
   *
   * Le défi est consommé dès que le code est bon, AVANT toute suite : un code
   * valide ne doit jamais pouvoir servir deux fois, même si l'action qu'il autorise
   * échoue ensuite.
   */
  private async consumeChallenge(challengeId: string, code: string) {
    const challenge = await this.prisma.otpChallenge.findUnique({ where: { id: challengeId } });

    // Un défi inconnu et un défi consommé donnent la MÊME erreur : distinguer
    // les deux dirait à un attaquant qu'il a trouvé un identifiant valide.
    if (challenge === null || challenge.consumedAt !== null) this.fail('OTP_INVALID');
    if (challenge.expiresAt.getTime() < Date.now()) this.fail('OTP_EXPIRED');

    if (challenge.attempts >= RATE_LIMITS.otpAttempts) {
      this.fail('OTP_ATTEMPTS_EXCEEDED');
    }

    if (!this.crypto.verifyToken(code, challenge.codeHash)) {
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

    return challenge;
  }

  /**
   * Confirme une action du compte par OTP — §2.8 (« confirmation par OTP
   * `purpose = DELETE_ACCOUNT` ») et §2.5 (ajout d'un numéro).
   *
   * DEUX CONTRÔLES qu'un simple `consumeChallenge` n'a pas :
   *
   *   · le `purpose`. Sans lui, le code de connexion que le membre vient de
   *     recevoir confirmerait la suppression de son compte — et une page piégée
   *     n'aurait plus qu'à le lui demander sous un autre prétexte.
   *   · le PROPRIÉTAIRE, quand `ownedBy` est fourni. Le défi doit porter
   *     l'empreinte d'un numéro du membre : sans cela, n'importe qui pourrait
   *     confirmer la suppression du compte d'autrui avec un code reçu sur SON
   *     propre téléphone.
   *
   * Rend l'empreinte et le pays du défi, dont l'ajout de numéro a besoin.
   */
  async confirmWithOtp(input: {
    challengeId: string;
    code: string;
    purpose: OtpPurpose;
    /** Identifiant du membre dont le défi doit porter un numéro, ou `null`. */
    ownedBy: string | null;
  }): Promise<{ phoneHmac: string; countryId: string; phoneEncrypted: Uint8Array<ArrayBuffer> | null }> {
    const challenge = await this.consumeChallenge(input.challengeId, input.code);

    if (challenge.purpose !== input.purpose) {
      throw new ApiError(
        'OTP_PURPOSE_MISMATCH',
        ACCOUNT_ERROR_MESSAGES.OTP_PURPOSE_MISMATCH,
        ACCOUNT_ERROR_CODES.OTP_PURPOSE_MISMATCH,
        { expected: input.purpose, given: challenge.purpose },
      );
    }

    if (input.ownedBy !== null) {
      const owned = await this.prisma.phoneNumber.findFirst({
        where: { userId: input.ownedBy, phoneHmac: challenge.phoneHmac },
        select: { id: true },
      });
      // 404 et non 403 : T4 §3 interdit de dire à qui appartient un numéro.
      if (owned === null) throw ApiError.notFound();
    }

    return {
      phoneHmac: challenge.phoneHmac,
      countryId: challenge.countryId,
      phoneEncrypted: challenge.phoneEncrypted,
    };
  }

  /**
   * Ce qu'une connexion OTP fait à un compte qui n'est pas simplement `ACTIVE` —
   * §2.8, et la règle dure « un membre mineur est désactivé et ne peut pas se
   * reconnecter » (§10).
   *
   * C'EST LE PIÈGE DE CE MODULE, et il ne se voit qu'au SECOND tour. Le webhook
   * Didit désactive le compte d'un mineur et révoque ses sessions ; le membre
   * relance simplement l'inscription, tombe sur son numéro déjà connu, et §2.8
   * promet « réactivation par simple connexion OTP ». Sans le contrôle ci-dessous,
   * la désactivation était donc annulée par la victime elle-même en deux écrans, et
   * rien dans les journaux ne le disait. Le même raisonnement vaut pour un banni :
   * 13 §4.2 écrit `status = DEACTIVATED` sur un `BAN_USER`, ce qui rend un banni
   * indistinguable d'un désactivé si l'on ne regarde que `users.status`.
   *
   * La distinction se lit ailleurs, et dans les deux cas sur une donnée que la
   * suppression RGPD ne touche pas tant que le compte existe :
   *   · mineur → une ligne `kyc_verifications` avec `is_adult = false` ;
   *   · banni → une `sanctions` de type `BAN` non levée.
   */
  private async resumeAccount(userId: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { status: true, deletedAt: true, deactivatedAt: true },
    });

    // Un compte supprimé n'a plus de numéro (§9 vide `phone_numbers`), donc on ne
    // devrait jamais arriver ici par son empreinte. Si cela se produit, la ligne
    // `phone_numbers` a survécu à une suppression incomplète : on refuse plutôt que
    // de rouvrir un compte anonymisé.
    if (user.status === 'DELETED' || user.deletedAt !== null) {
      throw ApiError.transverse('CONFLICT', { reason: 'compte supprimé' });
    }

    const minor = await this.prisma.kycVerification.findFirst({
      where: { userId, isAdult: false },
      select: { id: true },
    });
    if (minor !== null) this.fail('ACCOUNT_MINOR');

    /**
     * `liftedAt: null` est écrit EXPLICITEMENT.
     *
     * Un `liftedAt: { not: … }` ou une comparaison sur une colonne NULLABLE rend
     * NULL — donc faux — pour les lignes non levées, c'est-à-dire exactement celles
     * qu'on cherche. Le bannissement serait alors invisible et le banni reviendrait.
     */
    const ban = await this.prisma.sanction.findFirst({
      where: { userId, type: 'BAN', liftedAt: null },
      select: { id: true },
    });
    if (ban !== null) {
      throw new ApiError(
        'ACCOUNT_BANNED',
        ACCOUNT_ERROR_MESSAGES.ACCOUNT_BANNED,
        ACCOUNT_ERROR_CODES.ACCOUNT_BANNED,
      );
    }

    if (user.status === 'DEACTIVATED') {
      /**
       * On réveille SANS regarder les six mois de §2.8.
       *
       * Le délai est tenu par la tâche `account.deactivated_purge`, pas ici. Si
       * elle a du retard, refuser la connexion laisserait le membre dehors pour une
       * raison qui n'est pas la sienne ; l'accepter le remet en `ACTIVE`, ce qui le
       * SORT du balayage de la tâche. L'inverse — accueillir puis supprimer à 3 h du
       * matin — serait le pire des deux.
       */
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { status: 'ACTIVE', deactivatedAt: null },
        });
        await this.outbox.emit(tx, {
          type: 'user.reactivated',
          aggregateId: userId,
          payload: { userId, deactivatedAt: user.deactivatedAt?.toISOString() ?? null },
        });
      });
      this.logger.log(`Compte ${userId} réactivé par connexion OTP (§2.8)`);
      return;
    }

    if (user.status === 'DELETION_PENDING') {
      const pending = await this.prisma.accountDeletionRequest.findFirst({
        where: { userId, cancelledAt: null, executedAt: null },
        orderBy: { requestedAt: 'desc' },
        select: { id: true, executeAfter: true },
      });

      /**
       * « PENDANT 7 JOURS, une connexion OTP annule la demande » (§2.8). Au-delà,
       * non : l'échéance est passée, la tâche horaire va exécuter, et accueillir le
       * membre pour lui prendre son compte une heure plus tard serait un mensonge.
       */
      if (pending === null || pending.executeAfter.getTime() <= Date.now()) {
        throw ApiError.transverse('CONFLICT', { reason: 'suppression en cours d’exécution' });
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.accountDeletionRequest.update({
          where: { id: pending.id },
          data: { cancelledAt: new Date() },
        });
        await tx.user.update({ where: { id: userId }, data: { status: 'ACTIVE' } });
        await this.outbox.emit(tx, {
          type: 'user.reactivated',
          aggregateId: userId,
          payload: { userId, cancelledDeletionRequestId: pending.id },
        });
      });
      this.logger.log(`Suppression du compte ${userId} annulée par connexion OTP (§2.8)`);
    }
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
  private async createAccount(
    challenge: {
      phoneHmac: string;
      countryId: string;
      phoneEncrypted: Uint8Array<ArrayBuffer> | null;
      /** L'IP du moment où la case a été cochée — la preuve porte celle-là. */
      ip: string | null;
    },
  ): Promise<string> {
    // Un défi sans numéro chiffré ne peut pas créer de compte : le membre ne
    // pourrait plus jamais voir son propre numéro masqué. Mieux vaut échouer
    // ici que fabriquer un compte estropié.
    const phoneEncrypted = challenge.phoneEncrypted;
    if (phoneEncrypted === null) {
      throw new Error('Défi OTP sans numéro chiffré : compte non créable.');
    }

    const originCountryId = await this.provisionalOriginCountry(challenge.countryId);
    const userId = newId();

    /**
     * `is_destination` DÉDUIT du pays du numéro, et non posé à `false`.
     *
     * BOGUE CORRIGÉ : la colonne était câblée à `false` pour tous les comptes
     * créés. C'est la condition du niveau L2 (§7.2) — « un numéro d'un pays de
     * destination actif vérifié par OTP » — et la fausser signifiait qu'un membre
     * inscrit DIRECTEMENT avec un numéro français restait bloqué en L1 quoi qu'il
     * fasse : logement, parrainage et annuaire professionnel fermés, sans aucun
     * message pour le lui dire, et sans recours puisque §2.5 refuse d'ajouter un
     * numéro déjà lié à un compte — le sien.
     */
    const phoneCountry = await this.prisma.country.findUnique({
      where: { id: challenge.countryId },
      select: { kind: true, isActive: true },
    });
    const isDestination =
      phoneCountry !== null &&
      phoneCountry.isActive &&
      (phoneCountry.kind === 'DESTINATION' || phoneCountry.kind === 'BOTH');

    await this.prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: userId,
          handle: provisionalHandle(userId),
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
          isDestination,
          verifiedAt: new Date(),
        },
      });

      // §5 : `TERMS` et `PRIVACY` sont recueillis à l'écran 1, case obligatoire.
      // Ils s'écrivent DANS la transaction de création : un compte sans preuve de
      // consentement serait un compte qu'on n'a pas le droit d'avoir ouvert.
      // L'IP du DÉFI, c'est-à-dire du moment où le membre a coché la case, et non
      // celle de la vérification quelques secondes plus tard. La preuve doit dire
      // quand et d'où l'acceptation a eu lieu.
      await this.consents.recordSignupConsents(tx, userId, challenge.ip ?? undefined);

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
