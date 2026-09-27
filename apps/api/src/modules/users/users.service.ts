import { Injectable } from '@nestjs/common';
import { newId } from '@app/db';
import {
  AUTH_ERROR_CODES,
  AUTH_ERROR_MESSAGES,
  type MeResponse,
  ONBOARDING_LAST_STEP,
  type UpdateMe,
  type UpdateProfile,
  type AuthErrorCode,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { AuditService } from '../../common/audit.service';
import { CryptoService } from '../../common/crypto.service';
import { OutboxService } from '../../common/outbox.service';
import { PrismaService } from '../../common/prisma.service';
import { ConsentsService } from '../consents/consents.service';

/**
 * Compte et profil — 01-identite.md §2.6, §2.7 et §4.2.
 *
 * Trois règles de ce module ne sont PAS de simples validations de champ, et
 * c'est pour elles que ce service existe plutôt qu'un `update` direct :
 *
 *   · le pays d'origine n'est modifiable qu'UNE fois (§2.7), puis figé, parce
 *     qu'il pilote les réseaux automatiques et les modèles de parcours ;
 *   · le handle n'est modifiable qu'une fois par 30 jours (§2.6), et certains
 *     mots sont réservés ;
 *   · une correction MANUELLE de phase ne doit jamais être écrasée par la
 *     progression automatique (§2.2), ce qui demande d'horodater la correction.
 */

/** §2.6. La liste s'étend par `system_settings.reserved_handles`. */
const RESERVED_HANDLES = new Set([
  'admin',
  'support',
  'afroexpates',
  'aide',
  'moderation',
  // Noms des sections : un membre nommé « guides » rendrait les liens ambigus.
  'accueil',
  'parcours',
  'guides',
  'entraide',
  'reseaux',
  'annonces',
  'evenements',
  'logement',
  'emploi',
  'messages',
  'profil',
  'compte',
  'recherche',
  'notifications',
]);

const THIRTY_DAYS_MS = 30 * 86_400_000;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly consents: ConsentsService,
  ) {}

  private fail(code: AuthErrorCode, details?: Record<string, unknown>): never {
    throw new ApiError(code, AUTH_ERROR_MESSAGES[code], AUTH_ERROR_CODES[code], details);
  }

  // ── GET /me ───────────────────────────────────────────────────────────────

  /**
   * Le compte complet du membre courant (§4.2).
   *
   * RÈGLE DURE (§2.1) : les numéros ne sortent que MASQUÉS. Le masque est
   * calculé ici, à partir du chiffré, et le clair ne quitte jamais cette
   * méthode — c'est le seul endroit du code où il existe en lecture.
   */
  async me(userId: string): Promise<MeResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        profile: true,
        stats: true,
        avatarAsset: { select: { storageKey: true } },
        phoneNumbers: {
          orderBy: { isPrimary: 'desc' },
          include: { country: { select: { dialCode: true } } },
        },
        kycVerifications: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    const latestKyc = user.kycVerifications[0];

    return {
      user: {
        id: user.id,
        handle: user.handle,
        displayName: user.displayName,
        avatarUrl: user.avatarAsset === null ? null : `/media/${user.avatarAsset.storageKey}`,
        phase: user.phase,
        verificationLevel: user.verificationLevel,
        plan: user.plan,
        status: user.status,
        originCountryId: user.originCountryId,
        cityId: user.cityId,
        // Le front en a besoin pour griser le sélecteur AVANT l'appel : laisser
        // le membre choisir puis refuser serait une mauvaise manière de le dire.
        originCountryLocked: user.originCountryLockedAt !== null,
      },
      profile:
        user.profile === null
          ? null
          : {
              bio: user.profile.bio,
              occupationStatus: user.profile.occupationStatus,
              availableToHelp: user.profile.availableToHelp,
              helpTypes: user.profile.helpTypes,
              isPublic: user.profile.isPublic,
            },
      phones: user.phoneNumbers.map((phone) => ({
        id: phone.id,
        masked: this.crypto.maskPhone(
          this.crypto.decryptPhone(phone.phoneEncrypted),
          phone.country.dialCode,
        ),
        isDestination: phone.isDestination,
      })),
      kyc: latestKyc === undefined ? null : { status: latestKyc.status },
      stats:
        user.stats === null
          ? null
          : {
              helpValidatedCount: user.stats.helpValidatedCount,
              guideHelpfulVotes: user.stats.guideHelpfulVotes,
              guideContributions: user.stats.guideContributions,
              mentorshipsCompleted: user.stats.mentorshipsCompleted,
              eventsOrganized: user.stats.eventsOrganized,
            },
      // §2.10 : une nouvelle version des CGU redemande le consentement « sans
      // bloquer la lecture ». Le front a donc besoin de la liste ICI, dans la
      // réponse qu'il lit à chaque chargement.
      consents: { outstanding: await this.consents.outstanding(userId) },
      onboarding: {
        step: user.onboardingStep,
        complete: user.onboardingStep >= ONBOARDING_LAST_STEP,
      },
    };
  }

  // ── PATCH /me ─────────────────────────────────────────────────────────────

  async updateMe(userId: string, patch: UpdateMe): Promise<MeResponse> {
    const current = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        handle: true,
        handleChangedAt: true,
        originCountryId: true,
        originCountryLockedAt: true,
        phase: true,
        arrivalDate: true,
      },
    });

    const data: Record<string, unknown> = {};

    if (patch.displayName !== undefined) data['displayName'] = patch.displayName;
    if (patch.timezone !== undefined) data['timezone'] = patch.timezone;

    if (patch.handle !== undefined && patch.handle !== current.handle) {
      await this.assertHandleAvailable(patch.handle, current.handleChangedAt);
      data['handle'] = patch.handle;
      data['handleChangedAt'] = new Date();
    }

    if (patch.originCountryId !== undefined && patch.originCountryId !== current.originCountryId) {
      // §2.7 : modifiable UNE fois, puis figé.
      if (current.originCountryLockedAt !== null) {
        throw ApiError.transverse('FORBIDDEN', {
          field: 'originCountryId',
          reason: 'ORIGIN_COUNTRY_LOCKED',
        });
      }
      await this.assertUsableAsOrigin(patch.originCountryId);
      data['originCountryId'] = patch.originCountryId;
      data['originCountryLockedAt'] = new Date();
    }

    if (patch.cityId !== undefined) {
      await this.prisma.city.findUniqueOrThrow({ where: { id: patch.cityId } }).catch(() => {
        throw ApiError.notFound();
      });
      data['cityId'] = patch.cityId;
    }

    if (patch.phase !== undefined && patch.phase !== current.phase) {
      data['phase'] = patch.phase;
      // §2.2 : « l'automatisme n'écrase jamais une correction manuelle faite
      // après lui ». Sans cet horodatage, la tâche `user.phase_progression`
      // repasserait le membre en SETTLED six mois après son arrivée, en
      // annulant la correction qu'il vient de faire.
      data['phaseSetManuallyAt'] = new Date();
    }

    if (patch.arrivalDate !== undefined) data['arrivalDate'] = new Date(patch.arrivalDate);
    if (patch.plannedDepartureDate !== undefined) {
      data['plannedDepartureDate'] = new Date(patch.plannedDepartureDate);
    }

    if (Object.keys(data).length === 0) return this.me(userId);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data });

      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: userId },
        action: 'user.profile_updated',
        targetType: 'user',
        targetId: userId,
        // Les NOMS des champs modifiés, pas leurs valeurs : le journal dit ce
        // qui a changé sans devenir l'endroit où les données finissent en clair.
        metadata: { fields: Object.keys(data) },
      });

      // Un changement de phase concerne d'autres modules (§7 : journeys, feed,
      // communities). Le changement de handle, lui, n'a AUCUN consommateur dans
      // §7 : le journal d'audit suffit, et inventer un événement créerait une
      // file que personne ne lit.
      if (data['phase'] !== undefined) {
        await this.outbox.emit(tx, {
          type: 'user.phase_changed',
          aggregateId: userId,
          payload: { from: current.phase, to: data['phase'] as string, manual: true },
        });
      }
    });

    return this.me(userId);
  }

  // ── POST /me/arrived ──────────────────────────────────────────────────────

  /**
   * « Je suis arrivé » (§2.2). Passe en `RECENT_ARRIVAL`.
   *
   * Ce n'est PAS une correction manuelle de phase : c'est une déclaration de
   * fait, et la progression automatique vers `SETTLED` six mois plus tard doit
   * continuer de s'appliquer. `phase_set_manually_at` reste donc intact.
   */
  async declareArrival(userId: string, arrivalDate: string): Promise<MeResponse> {
    const date = new Date(arrivalDate);
    if (date.getTime() > Date.now()) {
      throw ApiError.validation([{ path: 'arrivalDate', code: 'TOO_BIG' }]);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { phase: 'RECENT_ARRIVAL', arrivalDate: date },
      });
      await this.outbox.emit(tx, {
        type: 'user.phase_changed',
        aggregateId: userId,
        // `manual: false` : c'est une déclaration de fait, pas une correction.
        // La progression automatique vers SETTLED doit continuer de s'appliquer.
        payload: { from: 'PRE_DEPARTURE', to: 'RECENT_ARRIVAL', manual: false, arrivalDate },
      });
    });

    return this.me(userId);
  }

  // ── PATCH /me/profile ─────────────────────────────────────────────────────

  // Le type vient du SCHÉMA zod, pas d'une redéclaration : §4 fait des schémas
  // de `packages/shared` la source unique, et recopier la forme ici garantit
  // qu'un champ ajouté au schéma sera oublié de ce côté.
  async updateProfile(userId: string, patch: UpdateProfile): Promise<MeResponse> {
    await this.prisma.$transaction(async (tx) => {
      // Le profil peut ne pas exister encore : l'onboarding le crée à l'écran 5,
      // et il est passable. `upsert` plutôt que `update` — sinon un membre qui a
      // sauté cet écran ne pourrait plus jamais remplir son profil.
      await tx.userProfile.upsert({
        where: { userId },
        create: {
          userId,
          bio: patch.bio ?? null,
          occupationStatus: patch.occupationStatus ?? 'OTHER',
          availableToHelp: patch.availableToHelp ?? false,
          helpTypes: patch.helpTypes ?? [],
          isPublic: patch.isPublic ?? false,
        },
        update: {
          ...(patch.bio === undefined ? {} : { bio: patch.bio }),
          ...(patch.occupationStatus === undefined
            ? {}
            : { occupationStatus: patch.occupationStatus }),
          ...(patch.availableToHelp === undefined
            ? {}
            : { availableToHelp: patch.availableToHelp }),
          ...(patch.helpTypes === undefined ? {} : { helpTypes: patch.helpTypes }),
          ...(patch.isPublic === undefined ? {} : { isPublic: patch.isPublic }),
        },
      });

      if (patch.languageIds !== undefined) {
        await tx.userLanguage.deleteMany({ where: { userId } });
        if (patch.languageIds.length > 0) {
          await tx.userLanguage.createMany({
            data: patch.languageIds.map((languageId) => ({ userId, languageId })),
            skipDuplicates: true,
          });
        }
      }

      if (patch.skillIds !== undefined) {
        await tx.userSkill.deleteMany({ where: { userId } });
        if (patch.skillIds.length > 0) {
          await tx.userSkill.createMany({
            data: patch.skillIds.map((skillId) => ({ userId, skillId })),
            skipDuplicates: true,
          });
        }
      }
    });

    return this.me(userId);
  }

  // ── Onboarding (§5) ───────────────────────────────────────────────────────

  /**
   * Enregistre l'écran franchi. Ne RECULE jamais : le membre peut revenir en
   * arrière pour corriger une réponse, et enregistrer alors un avancement
   * inférieur lui ferait refaire le chemin déjà parcouru.
   */
  async advanceOnboarding(userId: string, step: number): Promise<{ step: number }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { onboardingStep: true },
    });

    if (step <= user.onboardingStep) return { step: user.onboardingStep };

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { onboardingStep: step } });
      if (step >= ONBOARDING_LAST_STEP) {
        await this.outbox.emit(tx, {
          type: 'user.onboarded',
          aggregateId: userId,
          payload: {},
        });
      }
    });

    return { step };
  }

  // ── Profil public (§4.4) ──────────────────────────────────────────────────

  /**
   * Le profil vu par un autre membre (§2.7).
   *
   * La liste des champs est un ALLOW-LIST explicite, et non un `omit` : avec un
   * `omit`, toute colonne ajoutée plus tard à `users` serait publiée par défaut.
   * §2.7 interdit nommément téléphone, email, dates de naissance, notes et
   * parcours privés — et l'oubli se ferait en silence.
   */
  async publicProfile(handle: string, viewerId: string | null) {
    const user = await this.prisma.user.findUnique({
      where: { handle },
      include: {
        profile: true,
        stats: true,
        avatarAsset: { select: { storageKey: true } },
        originCountry: { select: { iso2: true, nameFr: true } },
        city: { select: { id: true, name: true } },
        languages: { include: { language: { select: { code: true, nameFr: true } } } },
        skills: { include: { skill: { select: { id: true, nameFr: true } } } },
      },
    });

    // 404 — et non 403 — si désactivé, supprimé ou bloqué : T4 §3 interdit de
    // révéler l'existence d'un compte à qui n'a pas à la connaître.
    if (user === null || user.deletedAt !== null) throw ApiError.notFound();
    if (user.status === 'DEACTIVATED' || user.status === 'DELETED') throw ApiError.notFound();
    if (!(user.profile?.isPublic ?? false) && viewerId === null) throw ApiError.notFound();

    if (viewerId !== null && viewerId !== user.id) {
      const blocked = await this.prisma.block.findFirst({
        where: {
          OR: [
            { blockerUserId: viewerId, blockedUserId: user.id },
            { blockerUserId: user.id, blockedUserId: viewerId },
          ],
        },
        select: { id: true },
      });
      // Dans UN SENS OU L'AUTRE (§4.4) : celui qui a bloqué ne doit pas non plus
      // retrouver le profil par hasard dans une liste.
      if (blocked !== null) throw ApiError.notFound();
    }

    return {
      handle: user.handle,
      displayName: user.displayName,
      avatarUrl: user.avatarAsset === null ? null : `/media/${user.avatarAsset.storageKey}`,
      phase: user.phase,
      verificationLevel: user.verificationLevel,
      country: user.originCountry,
      city: user.city,
      languages: user.languages.map((l) => l.language),
      skills: user.skills.map((s) => s.skill),
      bio: user.profile?.bio ?? null,
      occupationStatus: user.profile?.occupationStatus ?? null,
      availableToHelp: user.profile?.availableToHelp ?? false,
      helpTypes: user.profile?.helpTypes ?? [],
      memberSince: user.createdAt,
      stats:
        user.stats === null
          ? null
          : {
              helpValidatedCount: user.stats.helpValidatedCount,
              guideHelpfulVotes: user.stats.guideHelpfulVotes,
              guideContributions: user.stats.guideContributions,
              mentorshipsCompleted: user.stats.mentorshipsCompleted,
              eventsOrganized: user.stats.eventsOrganized,
            },
    };
  }

  // ── Outils ────────────────────────────────────────────────────────────────

  /**
   * Handle disponible ? Trois refus distincts, dans cet ordre.
   *
   * Le délai de 30 jours est vérifié AVANT la disponibilité : refuser pour
   * cause de délai après avoir annoncé « ce pseudo est pris » ferait deux
   * allers-retours pour une seule réponse.
   */
  private async assertHandleAvailable(handle: string, lastChangedAt: Date | null): Promise<void> {
    if (lastChangedAt !== null && Date.now() - lastChangedAt.getTime() < THIRTY_DAYS_MS) {
      const nextAt = new Date(lastChangedAt.getTime() + THIRTY_DAYS_MS);
      throw ApiError.transverse('FORBIDDEN', {
        field: 'handle',
        reason: 'HANDLE_CHANGE_TOO_SOON',
        nextChangeAllowedAt: nextAt.toISOString(),
      });
    }

    const reserved = await this.isReserved(handle);
    if (reserved) {
      throw ApiError.transverse('CONFLICT', { field: 'handle', reason: 'HANDLE_RESERVED' });
    }

    // `handle` est une colonne citext : la comparaison est déjà insensible à la
    // casse côté base, sans `toLowerCase()` ici (§2.6).
    const taken = await this.prisma.user.findUnique({ where: { handle }, select: { id: true } });
    if (taken !== null) {
      throw ApiError.transverse('CONFLICT', { field: 'handle', reason: 'HANDLE_TAKEN' });
    }
  }

  private async isReserved(handle: string): Promise<boolean> {
    if (RESERVED_HANDLES.has(handle.toLowerCase())) return true;

    // §2.6 : « toute chaîne listée dans system_settings.reserved_handles ».
    // La liste en dur ne suffit pas — elle doit pouvoir être complétée sans
    // déploiement quand un mot se révèle problématique.
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'reserved_handles' },
      select: { value: true },
    });
    if (setting === null) return false;

    const extra = setting.value;
    if (!Array.isArray(extra)) return false;
    return extra.some((v) => typeof v === 'string' && v.toLowerCase() === handle.toLowerCase());
  }

  /**
   * Le pays doit être ouvert ET pouvoir servir de pays d'ORIGINE.
   *
   * `kind` compte autant que `isActive` : la France est active, mais elle est
   * `DESTINATION` (02 §2.1). L'accepter comme pays d'origine donnerait au membre
   * un pays qui ne pilote ni réseau automatique ni modèle de parcours — et comme
   * ce choix n'est modifiable qu'une fois (§2.7), il resterait figé dessus.
   */
  private async assertUsableAsOrigin(countryId: string): Promise<void> {
    const country = await this.prisma.country.findUnique({
      where: { id: countryId },
      select: { isActive: true, kind: true },
    });
    if (country === null || !country.isActive) this.fail('COUNTRY_NOT_SUPPORTED');
    if (country.kind === 'DESTINATION') this.fail('COUNTRY_NOT_SUPPORTED');
  }

  /**
   * Génère un handle depuis le nom affiché (§2.6) : translittéré, suffixe
   * numérique si pris. Employé par l'onboarding, écran 5.
   */
  async generateHandle(displayName: string): Promise<string> {
    const base =
      displayName
        .normalize('NFD')
        // On retire les diacritiques : « Aïcha Sègbédji » donne « aicha-segbedji ».
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-')
        .slice(0, 24) || 'membre';

    const candidate = base.length < 3 ? `${base}${newId().slice(0, 3)}` : base;

    for (let suffix = 0; suffix < 100; suffix += 1) {
      const handle = suffix === 0 ? candidate : `${candidate}${suffix}`;
      const taken = await this.prisma.user.findUnique({
        where: { handle },
        select: { id: true },
      });
      if (taken === null && !(await this.isReserved(handle))) return handle;
    }

    // Cent homonymes : on cesse de compter et on prend de l'aléatoire, plutôt
    // que de boucler ou de rendre un handle déjà pris.
    return `${candidate}${newId().replace(/-/g, '').slice(0, 6)}`;
  }
}
