import { Injectable } from '@nestjs/common';
import { Prisma, newId } from '@app/db';
import {
  CONNECTION_REQUEST_EXPIRY_MS,
  AUTH_ERROR_CODES,
  AUTH_ERROR_MESSAGES,
  MEMBER_CONTENT_TYPES,
  STORY_TYPE_VOCABULARY,
  type MemberContentItem,
  type MemberContentType,
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

/** L'écran du lieu, troisième des six de §5. */
const PLACE_STEP = 3;

/**
 * L'extrait d'un corps libre, pour une carte de profil : la maquette n'y dessine
 * qu'UNE ligne, et un corps de trois mille caractères y entrerait en entier.
 *
 * 90 caractères, coupés au dernier espace pour ne pas trancher un mot, et une
 * ellipse. Le même arbitrage que `preview()` de la messagerie.
 */
function extrait(corps: string): string {
  const propre = corps.replace(/\s+/g, ' ').trim();
  if (propre.length <= 90) return propre;
  const coupe = propre.slice(0, 90);
  const espace = coupe.lastIndexOf(' ');
  return `${espace > 40 ? coupe.slice(0, espace) : coupe}…`;
}

const LIBELLE_POST: Record<string, string> = {
  VICTORY: 'Victoire',
  QUESTION: 'Question',
  INFO: 'Info',
  DISCUSSION: 'Discussion',
};

const JOUR_ET_MOIS = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });
const jourEtMois = (d: Date): string => JOUR_ET_MOIS.format(d);

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
        /**
         * `YYYY-MM-DD`, découpé de l'horodatage. La colonne est une `DateTime` et
         * le champ de saisie de K01 n'accepte que la date nue ; rendre l'ISO
         * complet obligerait chaque écran à le recouper, et l'un d'eux oublierait.
         */
        arrivalDate:
          user.arrivalDate === null ? null : user.arrivalDate.toISOString().slice(0, 10),
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

    /**
     * ╔══════════════════════════════════════════════════════════════════════════╗
     * ║ LE PSEUDO PEUT ÊTRE PRIS ENTRE LE CONTRÔLE ET L'ÉCRITURE                ║
     * ╚══════════════════════════════════════════════════════════════════════════╝
     *
     * `assertHandleAvailable` lit, puis on écrit : entre les deux, une autre
     * requête peut prendre le même pseudo. L'index unique de `users.handle` fait
     * alors son travail, et la P2002 remontait BRUTE.
     *
     * MESURÉ : `PATCH /me` répondait `500 INTERNAL_ERROR` — « Une erreur est
     * survenue de notre côté. Réessayez dans un instant. » Le membre lisait donc
     * une panne serveur là où la seule chose à lui dire est que ce pseudo est
     * déjà pris. Trouvé par la suite d'épreuves, dont deux ouvriers inscrivaient
     * un membre au même instant.
     *
     * La réponse est celle que le contrôle aurait donnée une milliseconde plus
     * tôt : 409, `field: 'handle'`, `reason: 'HANDLE_TAKEN'`. Aucune autre
     * contrainte unique n'est touchée par cette écriture ; tout autre P2002
     * remonte donc tel quel, parce qu'il voudrait dire autre chose.
     */
    try {
      await this.writeMe(userId, data, current.phase);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        JSON.stringify(error.meta?.['target'] ?? '').includes('handle')
      ) {
        throw ApiError.transverse('CONFLICT', { field: 'handle', reason: 'HANDLE_TAKEN' });
      }
      throw error;
    }

    return this.me(userId);
  }

  /** L'écriture de `PATCH /me` : la mise à jour, le journal, l'événement. */
  private async writeMe(
    userId: string,
    data: Record<string, unknown>,
    phaseAvant: string,
  ): Promise<void> {
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
          payload: { from: phaseAvant, to: data['phase'] as string, manual: true },
        });
      }
    });
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

    const place = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { originCountryId: true, cityId: true },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { onboardingStep: step } });

      /**
       * L'écran 3 de §5 — pays d'origine et ville — déclenche l'adhésion
       * automatique aux réseaux CITY et COUNTRY (07 §6).
       *
       * Cet événement était DÉCLARÉ au catalogue mais émis par personne : je
       * l'avais annoncé comme existant au module réseaux, qui a vérifié plutôt
       * que de me croire. Sans lui, un membre passait l'écran du lieu sans
       * rejoindre aucun réseau — le contraire de ce que cet écran promet.
       */
      if (step === PLACE_STEP) {
        await this.outbox.emit(tx, {
          type: 'user.onboarded_location',
          aggregateId: userId,
          payload: {
            originCountryId: place.originCountryId,
            cityId: place.cityId,
          },
        });
      }

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

  // ── Ce qu'un membre a publié (§4.4, onglets du profil) ───────────────────

  /**
   * ╔════════════════════════════════════════════════════════════════════════╗
   * ║ `GET /users/:handle/content` — LES SEPT ONGLETS DU PROFIL PUBLIC       ║
   * ╚════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Je propose qu'il y ait des tabs (guides, fil d'actualités,
   * stories, entraides, services, évènements, parcours publics) qui montrent ce
   * que l'utilisateur a publié dans ces choses. »
   *
   * CE QUI MANQUAIT : aucune route du dépôt ne sait filtrer par auteur. La
   * planche d'ordinateur dessine pourtant « GUIDES PUBLIÉS » depuis le premier
   * jour, avec deux titres écrits en dur — « Déclarer son médecin traitant »,
   * « Monter son dossier CAF » — servis à tout le monde.
   *
   * ── LA MÊME PORTE QUE LE PROFIL LUI-MÊME ────────────────────────────────
   *
   * `profilVisible` applique mot pour mot les quatre refus de `publicProfile` :
   * compte supprimé, désactivé, profil non public lu sans jeton, blocage dans un
   * sens ou dans l'autre. Tous rendent `404` — T4 §3 interdit de révéler
   * l'existence d'un compte à qui n'a pas à la connaître, et une liste de
   * contenus vide contre un 404 est déjà une réponse.
   *
   * ── SEPT RÈGLES DE VISIBILITÉ, ÉCRITES UNE FOIS CHACUNE ─────────────────
   *
   * Un profil public montre ce qui est PUBLIÉ. Jamais un brouillon, jamais ce
   * que la modération a retiré, jamais un parcours privé, jamais une story
   * périmée. Chaque espèce porte sa condition dans `OU_PUBLIE` ; les relire d'un
   * coup d'œil est le seul moyen de ne pas en oublier une.
   *
   * ── LA PAGINATION EST PAR ESPÈCE, ET C'EST UN ÉCART ASSUMÉ ──────────────
   *
   * Sans `type`, on rend les premières cartes de CHAQUE espèce plutôt qu'un
   * mélange trié dans le temps : sept tables n'ont pas de curseur commun, et un
   * tri global demanderait une vue matérialisée. Les onglets, eux, demandent
   * toujours une espèce — c'est le cas qui compte. `nextCursor` reste `null`
   * tant que ce tri global n'existe pas, plutôt que de promettre une suite qui
   * ne viendrait pas. REMONTÉ.
   */
  private async profilVisible(handle: string, viewerId: string | null) {
    const user = await this.prisma.user.findUnique({
      where: { handle },
      select: { id: true, status: true, deletedAt: true, profile: { select: { isPublic: true } } },
    });
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
        select: { blockerUserId: true },
      });
      if (blocked !== null) throw ApiError.notFound();
    }
    return user.id;
  }

  async publishedContent(
    handle: string,
    viewerId: string | null,
    query: { readonly type?: MemberContentType | undefined; readonly limit: number },
  ) {
    const userId = await this.profilVisible(handle, viewerId);
    const take = query.limit;

    /** Une story vit 24 heures (§2.6) : au-delà, elle n'est plus publiée. */
    const vivanteDepuis = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const lecteurs: Record<MemberContentType, () => Promise<MemberContentItem[]>> = {
      GUIDE: async () => {
        const lignes = await this.prisma.guide.findMany({
          where: { authorUserId: userId, deletedAt: null, status: 'PUBLISHED' },
          orderBy: { createdAt: 'desc' },
          take,
          select: { id: true, title: true, slug: true, category: true, createdAt: true, helpfulCount: true },
        });
        return lignes.map((g) => ({
          id: g.id,
          type: 'GUIDE' as const,
          title: g.title,
          subtitle: `${g.helpfulCount} ${g.helpfulCount > 1 ? 'votes utiles' : 'vote utile'}`,
          href: `/guides/${g.slug}`,
          createdAt: g.createdAt.toISOString(),
        }));
      },
      POST: async () => {
        const lignes = await this.prisma.post.findMany({
          where: {
            authorUserId: userId,
            deletedAt: null,
            status: 'PUBLISHED',
            /**
             * `FLAGGED` SEUL : `ModerationStatus` ne connaît que `PENDING`,
             * `CLEARED` et `FLAGGED` — le retrait, lui, s'écrit dans `status`
             * (`ContentStatus.REMOVED`) et dans `deletedAt`, que la condition
             * au-dessus couvre déjà. Vérifié à l'énumération, pas supposé.
             */
            moderationStatus: { not: 'FLAGGED' },
          },
          orderBy: { createdAt: 'desc' },
          take,
          select: { id: true, body: true, type: true, createdAt: true },
        });
        return lignes.map((p) => ({
          id: p.id,
          type: 'POST' as const,
          title: extrait(p.body),
          subtitle: LIBELLE_POST[p.type] ?? 'Publication',
          href: `/publications/${p.id}`,
          createdAt: p.createdAt.toISOString(),
        }));
      },
      /**
       * ╔══════════════════════════════════════════════════════════════════╗
       * ║ UNE STORY SE REDESSINE, ELLE NE SE RÉSUME PAS                    ║
       * ╚══════════════════════════════════════════════════════════════════╝
       *
       * Le porteur : « Les stories c'est les previews l'un à côté de l'autre. »
       * La carte porte donc `apercu` — fond, étiquette, texte — c'est-à-dire ce
       * dont `ApercuStory` a besoin pour la dessiner comme le bandeau du fil la
       * dessine. Le fond suit la même règle que `storyBubble` : la photo quand
       * il y en a une, l'aplat sinon.
       */
      STORY: async () => {
        const lignes = await this.prisma.story.findMany({
          where: { authorUserId: userId, deletedAt: null, createdAt: { gte: vivanteDepuis } },
          orderBy: { createdAt: 'desc' },
          take,
          select: {
            id: true,
            body: true,
            type: true,
            createdAt: true,
            backgroundColor: true,
            backgroundAsset: { select: { storageKey: true } },
          },
        });
        return lignes.map((st) => {
          const photo = st.backgroundAsset?.storageKey ?? null;
          return {
            id: st.id,
            type: 'STORY' as const,
            title: extrait(st.body),
            subtitle: 'Visible 24 h',
            href: `/stories/${st.id}`,
            createdAt: st.createdAt.toISOString(),
            apercu: {
              fond: photo === null ? (st.backgroundColor ?? '#0F5C48') : `/media/${photo}`,
              photo: photo !== null,
              etiquette: STORY_TYPE_VOCABULARY[st.type].label,
              texte: st.body,
            },
          };
        });
      },
      HELP: async () => {
        const lignes = await this.prisma.helpRequest.findMany({
          where: {
            authorUserId: userId,
            deletedAt: null,
            status: { in: ['OPEN', 'RESOLVED'] },
            /**
             * `FLAGGED` SEUL : `ModerationStatus` ne connaît que `PENDING`,
             * `CLEARED` et `FLAGGED` — le retrait, lui, s'écrit dans `status`
             * (`ContentStatus.REMOVED`) et dans `deletedAt`, que la condition
             * au-dessus couvre déjà. Vérifié à l'énumération, pas supposé.
             */
            moderationStatus: { not: 'FLAGGED' },
          },
          orderBy: { createdAt: 'desc' },
          take,
          select: { id: true, title: true, status: true, createdAt: true },
        });
        return lignes.map((h) => ({
          id: h.id,
          type: 'HELP' as const,
          title: h.title,
          subtitle: h.status === 'RESOLVED' ? 'Résolue' : 'Ouverte',
          href: `/entraide/${h.id}`,
          createdAt: h.createdAt.toISOString(),
        }));
      },
      /**
       * « SERVICES » EST UN ONGLET POUR TROIS TABLES — logement, emploi, fiche
       * pro — exactement comme la feuille « Créer » les range sous une seule
       * entrée. Elles sont lues ensemble et triées ici.
       */
      SERVICE: async () => {
        const [logements, emplois] = await Promise.all([
          this.prisma.housingListing.findMany({
            where: { authorUserId: userId, deletedAt: null, status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            take,
            select: { id: true, title: true, createdAt: true },
          }),
          this.prisma.jobListing.findMany({
            where: { authorUserId: userId, deletedAt: null, status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            take,
            select: { id: true, title: true, createdAt: true },
          }),
        ]);
        const cartes: MemberContentItem[] = [
          ...logements.map((l) => ({
            id: l.id,
            type: 'SERVICE' as const,
            title: l.title,
            subtitle: 'Logement',
            href: `/services/logement/${l.id}`,
            createdAt: l.createdAt.toISOString(),
          })),
          ...emplois.map((e) => ({
            id: e.id,
            type: 'SERVICE' as const,
            title: e.title,
            subtitle: 'Emploi',
            href: `/services/emploi/${e.id}`,
            createdAt: e.createdAt.toISOString(),
          })),
        ];
        return cartes.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, take);
      },
      EVENT: async () => {
        const lignes = await this.prisma.event.findMany({
          where: {
            organizerUserId: userId,
            deletedAt: null,
            status: { in: ['SCHEDULED', 'DONE'] },
            /** Réservé à un réseau = pas sur un profil public (§2.3). */
            communityId: null,
          },
          orderBy: { startsAt: 'desc' },
          take,
          select: { id: true, title: true, startsAt: true, createdAt: true, status: true },
        });
        return lignes.map((ev) => ({
          id: ev.id,
          type: 'EVENT' as const,
          title: ev.title,
          subtitle: ev.status === 'DONE' ? 'Passé' : jourEtMois(ev.startsAt),
          href: `/agenda/${ev.id}`,
          createdAt: ev.createdAt.toISOString(),
        }));
      },
      /**
       * ⚠ `PUBLIC` SEULEMENT. `SHARED` veut dire « partagé avec son équipe », pas
       * « visible de tous » : le confondre publierait le parcours d'installation
       * de quelqu'un sur son profil. C'est la règle dure de 04 §2.
       */
      JOURNEY: async () => {
        const lignes = await this.prisma.journey.findMany({
          where: { ownerUserId: userId, visibility: 'PUBLIC' },
          orderBy: { createdAt: 'desc' },
          take,
          select: { id: true, title: true, status: true, createdAt: true },
        });
        return lignes.map((j) => ({
          id: j.id,
          type: 'JOURNEY' as const,
          title: j.title,
          subtitle: 'Parcours public',
          href: `/parcours/${j.id}`,
          createdAt: j.createdAt.toISOString(),
        }));
      },
    };

    const especes =
      query.type === undefined ? MEMBER_CONTENT_TYPES : ([query.type] as const);

    const lots = await Promise.all(especes.map((t) => lecteurs[t]()));
    const items = lots.flat();

    /**
     * LES COMPTES DES ONGLETS PORTENT TOUJOURS LA COLLECTION ENTIÈRE, quel que
     * soit le filtre demandé — sinon l'onglet « Guides · 3 » afficherait 3 parce
     * qu'on en a lu 3, et non parce qu'il y en a 3.
     */
    const parType = Object.fromEntries(
      await Promise.all(
        MEMBER_CONTENT_TYPES.map(async (t) => {
          const lot =
            query.type === undefined
              ? lots[MEMBER_CONTENT_TYPES.indexOf(t)]
              : t === query.type
                ? items
                : await lecteurs[t]();
          return [t, (lot ?? []).length] as const;
        }),
      ),
    ) as Record<MemberContentType, number>;

    return {
      items,
      nextCursor: null,
      meta: {
        total: Object.values(parType).reduce((somme, n) => somme + n, 0),
        parType,
      },
    };
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
      userId: user.id,
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
      relation: viewerId === null ? null : await this.relationAvec(viewerId, user.id),
    };
  }

  /**
   * Ma relation avec un membre, pour le bouton « Ajouter aux contacts » du profil
   * — voir `relation` dans `publicProfileResponseSchema`.
   *
   * Les deux lectures sont celles de `ConnectionsService` (`areConnected`, la
   * recherche de demande en attente de `request`), sur la paire ORDONNÉE en base
   * (`user_a_id < user_b_id`) et la même fenêtre d'expiration : une demande plus
   * vieille que `CONNECTION_REQUEST_EXPIRY_MS` n'est plus « en attente », et le
   * bouton se rouvre — exactement ce que la route accepterait.
   */
  private async relationAvec(
    viewerId: string,
    otherId: string,
  ): Promise<{
    status: 'SELF' | 'CONNECTED' | 'REQUEST_SENT' | 'REQUEST_RECEIVED' | 'NONE';
    requestId: string | null;
  }> {
    if (viewerId === otherId) return { status: 'SELF', requestId: null };
    const [userAId, userBId] = viewerId < otherId ? [viewerId, otherId] : [otherId, viewerId];
    const contact = await this.prisma.connection.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
      select: { removedAt: true },
    });
    if (contact !== null && contact.removedAt === null) return { status: 'CONNECTED', requestId: null };

    const demande = await this.prisma.connectionRequest.findFirst({
      where: {
        status: 'PENDING',
        createdAt: { gte: new Date(Date.now() - CONNECTION_REQUEST_EXPIRY_MS) },
        OR: [
          { fromUserId: viewerId, toUserId: otherId },
          { fromUserId: otherId, toUserId: viewerId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, fromUserId: true },
    });
    if (demande === null) return { status: 'NONE', requestId: null };
    return demande.fromUserId === viewerId
      ? { status: 'REQUEST_SENT', requestId: null }
      : { status: 'REQUEST_RECEIVED', requestId: demande.id };
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
