import { Injectable, Logger } from '@nestjs/common';
import { newId, Prisma } from '@app/db';
import {
  BLOCKER_TEMPLATES,
  CHECKLIST_NOTICE,
  JOURNEY_ERROR_CODES,
  JOURNEY_ERROR_MESSAGES,
  JOURNEY_FREE_ACTIVE_LIMIT,
  JOURNEY_INACTIVITY_DAYS,
  JOURNEY_MAX_MEMBERS,
  JOURNEY_REMINDER_DAYS,
  PUBLIC_JOURNEYS_MAX_LIMIT,
  STEP_RISK_MESSAGE,
  renderBlockerTemplate,
  type AddJourneyMember,
  type CreateJourney,
  type CreateJourneyStep,
  type InactivityResponse,
  type JourneyActivitiesQuery,
  type JourneyErrorCode,
  type Page,
  type PublicJourneysQuery,
  type PublishBlocker,
  type ReorderSteps,
  type ReplaceChecklist,
  type ReportTemplateError,
  type ShareMilestone,
  type UpdateJourney,
  type UpdateJourneyStep,
  type VerificationLevel,
} from '@app/shared';
import { ApiError } from '../../common/api-error';
import { AuditService } from '../../common/audit.service';
import { buildPage, decodeCursor } from '../../common/cursor';
import { CryptoService } from '../../common/crypto.service';
import { OutboxService } from '../../common/outbox.service';
import { PrismaService } from '../../common/prisma.service';
import { VisibilityService } from '../../common/visibility.service';
import { loadEnv } from '../../config/env';
import { ConsentsService } from '../consents/consents.service';
import { FeedService } from '../feed/feed.service';
import { HelpService } from '../help/help.service';
import { MessagingService } from '../messaging/messaging.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Parcours — 03-parcours.md.
 *
 * Quatre principes gouvernent ce fichier, et il vaut mieux les avoir en tête
 * avant de le lire :
 *
 * 1. **UN PARCOURS NE PUBLIE JAMAIS RIEN TOUT SEUL** (§1.2, §3.5). Franchir une
 *    étape, en marquer un jalon, être bloqué : rien de tout cela n'écrit une
 *    ligne dans `posts`, `stories`, `help_requests` ou `housing_listings`. Le
 *    service rend une PROPOSITION — un objet de données que l'écran affiche — et
 *    attend un second appel, explicite, portant le texte du membre. C'est la
 *    tentation principale de ce module : `completeStep` aurait « naturellement »
 *    créé la publication de victoire. Le test
 *    `rule: franchir une étape ne publie rien` compte les lignes créées dans les
 *    quatre tables et échoue au premier raccourci.
 *
 * 2. **LE TITRE PERSONNEL NE SORT PAS DU PARCOURS** (§3.7, 04 §2, 06 §2.5). Le
 *    membre appelle son parcours « Ma galère de visa » ; ce qui sort, c'est le
 *    nom du TYPE (« Études »). Cela vaut pour la vue publique, pour le gabarit de
 *    blocage pré-rempli, et pour tout ce qui part vers un autre module.
 *
 * 3. **LE PARCOURS ORCHESTRE, IL N'IMPLÉMENTE PAS.** La conversation du parcours
 *    est créée par la messagerie qui écoute `journey.created` ; la demande
 *    d'entraide est créée par `HelpService`, avec ses règles de modération et de
 *    quota ; la publication de victoire par `FeedService`. Ce module ne recopie
 *    aucune de ces règles — il les appelle.
 *
 * 4. **AUCUN ÉTAT D'ÉCHEC** (§3.2). Ni en base, ni dans un libellé, ni dans un
 *    code d'erreur. Une étape se met en pause ; un parcours s'arrête, et le mot
 *    employé partout est « arrêté », pas « échoué ».
 */

/** Le membre qui agit. Le NIVEAU voyage : la victoire partagée est une publication (L1). */
export interface JourneyActor {
  readonly userId: string;
  readonly level: VerificationLevel;
}

/** Ce qu'un lecteur est autorisé à voir d'un parcours (§3.4). */
type ViewerRole = 'OWNER' | 'SUPPORTER' | 'OBSERVER';

const STEP_SELECT = {
  id: true,
  title: true,
  description: true,
  position: true,
  status: true,
  dueDate: true,
  dueDateManual: true,
  startedAt: true,
  completedAt: true,
  pausedAt: true,
  durationDays: true,
  isCustom: true,
  sharePromptDismissedAt: true,
  notesEncrypted: true,
  stepDefinitionId: true,
  templateStepId: true,
  templateStep: { select: { isOptional: true, daysBeforeArrival: true } },
  stepDefinition: {
    select: {
      code: true,
      category: true,
      defaultDurationDays: true,
      guideId: true,
      blockerTarget: true,
      blockerTemplate: true,
      isMajorMilestone: true,
      isRisky: true,
      riskMessage: true,
    },
  },
} as const satisfies Prisma.JourneyStepSelect;

type StepRow = Prisma.JourneyStepGetPayload<{ select: typeof STEP_SELECT }>;

const MEMBER_USER_SELECT = {
  id: true,
  handle: true,
  displayName: true,
  verificationLevel: true,
  avatarAsset: { select: { storageKey: true } },
} as const satisfies Prisma.UserSelect;

@Injectable()
export class JourneysService {
  private readonly logger = new Logger(JourneysService.name);
  private readonly cursorSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly visibility: VisibilityService,
    private readonly crypto: CryptoService,
    private readonly consents: ConsentsService,
    private readonly help: HelpService,
    private readonly feed: FeedService,
    private readonly messaging: MessagingService,
    private readonly notifications: NotificationsService,
  ) {
    this.cursorSecret = loadEnv().CURSOR_SECRET;
  }

  private fail(code: JourneyErrorCode, details?: Record<string, unknown>): never {
    throw new ApiError(code, JOURNEY_ERROR_MESSAGES[code], JOURNEY_ERROR_CODES[code], details);
  }

  private meta(): Record<string, unknown> {
    // T4 §4 : les règles affichées voyagent avec la réponse plutôt que d'être
    // recopiées dans le front — ici le texte imposé de la checklist (§3.3), la
    // taille d'équipe et les jours de rappel.
    return {
      checklistNotice: CHECKLIST_NOTICE,
      maxMembers: JOURNEY_MAX_MEMBERS,
      reminderDays: [...JOURNEY_REMINDER_DAYS],
      inactivityDays: JOURNEY_INACTIVITY_DAYS,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Modèles (§2.1)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * `GET /journey-templates` — les types proposés au membre, RÉSOLUS pour son
   * pays d'origine (§2.1).
   *
   * « Version publiée la plus récente pour (type, pays d'origine du membre),
   * sinon version générique. Un type sans version publiée n'est pas proposé. »
   *
   * La résolution se fait en mémoire sur les versions publiées du type : elles se
   * comptent par unités, et le faire en SQL demanderait une fenêtre que Prisma ne
   * compose pas avec le reste.
   */
  async templates(userId: string) {
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { originCountryId: true },
    });

    const templates = await this.prisma.journeyTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      select: {
        id: true,
        code: true,
        nameFr: true,
        description: true,
        targetPhase: true,
        icon: true,
        createsJourney: true,
        versions: {
          where: {
            status: 'PUBLISHED',
            // Piège des colonnes NULLABLES : `originCountryId: { in: [...] }`
            // n'attrape JAMAIS les lignes à NULL en SQL, et la version générique
            // est précisément celle dont le pays est nul. Le `OR` explicite est
            // ce qui la garde dans le jeu.
            OR: [{ originCountryId: null }, { originCountryId: me.originCountryId }],
          },
          select: {
            id: true,
            version: true,
            originCountryId: true,
            changelog: true,
            _count: { select: { steps: true } },
          },
        },
      },
    });

    const items = [];
    for (const template of templates) {
      const resolved = this.pickVersion(template.versions, me.originCountryId);
      // « Un type sans version publiée n'est pas proposé » — pas même grisé.
      if (resolved === null) continue;
      items.push({
        id: template.id,
        code: template.code,
        nameFr: template.nameFr,
        description: template.description,
        targetPhase: template.targetPhase,
        icon: template.icon,
        createsJourney: template.createsJourney,
        version: {
          id: resolved.id,
          version: resolved.version,
          stepCount: resolved._count.steps,
          isCountrySpecific: resolved.originCountryId !== null,
          changelog: resolved.changelog,
        },
      });
    }
    return { items, meta: this.meta() };
  }

  /**
   * `GET /journey-templates/:id/steps` — les étapes d'un type, résolues pour le
   * pays du membre.
   *
   * ── POURQUOI ELLE EXISTE ───────────────────────────────────────────────────
   *
   * `templates()` au-dessus rend `stepCount` et rien de plus : de quoi écrire
   * « 15 étapes », pas de quoi en nommer une. Jusqu'ici les étapes n'existaient
   * pour un membre QU'APRÈS l'ouverture d'un parcours, parce que `start()` les
   * COPIE dans `journey_steps`.
   *
   * Or `POST /stories` accepte un `stepDefinitionId` — c'est ce qui, dit §2.6,
   * « rend un conseil réutilisable ». Un membre doit donc pouvoir désigner une
   * étape AVANT d'avoir ouvert quoi que ce soit, et sans cette route l'écran ne
   * peut proposer qu'une liste écrite en dur : sans identifiant, donc
   * inenvoyable.
   *
   * ── LA RÉSOLUTION EST CELLE DE `templates()`, PAS UNE SECONDE ─────────────
   *
   * Même `where` sur les versions publiées, même `pickVersion`, même piège des
   * colonnes NULLABLES évité par le `OR` explicite. Deux résolutions
   * indépendantes finiraient par diverger, et le membre lirait les étapes d'une
   * version que son parcours n'emploierait pas.
   *
   * ── LE NOM ET LA DESCRIPTION SUIVENT LES SURCHARGES ──────────────────────
   *
   * `readOverrides` est celui de `start()`, à la lettre. §2.1 : la version
   * « assemble et ordonne des définitions » et peut les surcharger localement.
   * Servir ici la définition brute ferait lire un intitulé que le parcours
   * n'emploiera pas — la déclinaison Bénin de T3 A.3 est faite pour qu'ils
   * diffèrent.
   *
   * ── CE QU'ELLE NE FAIT PAS ───────────────────────────────────────────────
   *
   * Elle ne pagine pas : une version publiée compte quinze étapes, et les couper
   * ferait de l'ordre une illusion. Elle n'expose pas l'identifiant de
   * `template_steps` : c'est `stepDefinitionId` qui part dans une story, parce
   * que deux versions d'un même type réutilisent la même définition et qu'un
   * rattachement à la ligne de version deviendrait caduc à la publication
   * suivante.
   */
  async templateSteps(userId: string, templateId: string) {
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { originCountryId: true },
    });

    const template = await this.prisma.journeyTemplate.findFirst({
      where: { id: templateId, isActive: true },
      select: {
        versions: {
          where: {
            status: 'PUBLISHED',
            // Le piège des colonnes NULLABLES, comme dans `templates()` : un
            // `in: [...]` n'attrape jamais la ligne à NULL, qui est précisément
            // la version générique.
            OR: [{ originCountryId: null }, { originCountryId: me.originCountryId }],
          },
          select: {
            id: true,
            version: true,
            originCountryId: true,
            changelog: true,
            _count: { select: { steps: true } },
          },
        },
      },
    });

    /**
     * UN TYPE INCONNU, INACTIF OU SANS VERSION PUBLIÉE REND LE MÊME REFUS.
     *
     * `TEMPLATE_UNAVAILABLE` (422) existe déjà dans `JOURNEY_ERROR_CODES`, et son
     * commentaire est la phrase même de §2.1 : « Un type sans version publiée
     * n'est pas proposé. » Un type qui n'est pas proposé n'est pas davantage
     * consultable — et réutiliser ce code plutôt qu'en inventer un évite au front
     * d'avoir deux refus à distinguer pour la même cause.
     *
     * Les trois cas rendent le MÊME refus, à dessein : les séparer dirait à qui
     * tâtonne lesquels existent.
     */
    const resolved =
      template === null ? null : this.pickVersion(template.versions, me.originCountryId);
    if (resolved === null) this.fail('TEMPLATE_UNAVAILABLE');

    const steps = await this.prisma.templateStep.findMany({
      where: { templateVersionId: resolved.id },
      orderBy: { position: 'asc' },
      select: {
        position: true,
        isOptional: true,
        overrides: true,
        stepDefinition: {
          select: { id: true, code: true, nameFr: true, description: true, category: true },
        },
      },
    });

    return {
      items: steps.map((step) => {
        const overrides = readOverrides(step.overrides);
        return {
          stepDefinitionId: step.stepDefinition.id,
          code: step.stepDefinition.code,
          nameFr: overrides.name ?? step.stepDefinition.nameFr,
          description: overrides.description ?? step.stepDefinition.description,
          category: step.stepDefinition.category,
          position: step.position,
          isOptional: step.isOptional,
        };
      }),
      version: {
        id: resolved.id,
        version: resolved.version,
        stepCount: resolved._count.steps,
        isCountrySpecific: resolved.originCountryId !== null,
        changelog: resolved.changelog,
      },
      meta: this.meta(),
    };
  }

  /**
   * La version qui s'applique : celle du pays d'abord, la générique ensuite, et
   * dans les deux cas la plus récente.
   *
   * §2.2 promet « une seule version publiée par (type, pays) », mais la
   * résolution ne s'y FIE pas : si deux versions publiées coexistaient à la suite
   * d'un incident d'administration, prendre la plus récente reste le comportement
   * attendu, alors qu'un `findFirst` sans ordre rendrait l'une ou l'autre au
   * hasard.
   */
  private pickVersion<T extends { version: number; originCountryId: string | null }>(
    versions: readonly T[],
    originCountryId: string | null,
  ): T | null {
    const sorted = [...versions].sort((a, b) => b.version - a.version);
    const specific =
      originCountryId === null
        ? undefined
        : sorted.find((v) => v.originCountryId === originCountryId);
    return specific ?? sorted.find((v) => v.originCountryId === null) ?? null;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Création (§3.1)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * `POST /journeys` (§3.1).
   *
   * RÈGLE DURE (§10, 14 §2) : « la limite d'un parcours actif en gratuit est
   * appliquée côté serveur. » Elle l'est DANS la transaction, après un verrou sur
   * la ligne du membre : deux requêtes simultanées se sérialisent alors, et la
   * seconde voit le parcours de la première. Compter avant d'ouvrir la
   * transaction laisserait passer les deux — un quota de un est la course la plus
   * facile à gagner.
   *
   * Aucune conversation n'est créée ici : `journey.created` est écouté par la
   * messagerie, qui la recalcule (08 §5.1). Un appel direct recréerait le
   * couplage que la boîte d'envoi existe pour défaire (00 §3.3).
   */
  async create(actor: JourneyActor, input: CreateJourney) {
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: actor.userId },
      select: { originCountryId: true, cityId: true, plan: true },
    });
    // La ville est extraite dans une CONSTANTE : TypeScript ne garde pas le
    // rétrécissement d'un accès de propriété à l'intérieur de la fonction de
    // transaction, et `destination_city_id` est NOT NULL.
    const destinationCityId = me.cityId;
    if (destinationCityId === null) this.fail('LOCATION_REQUIRED');

    const template = await this.prisma.journeyTemplate.findUnique({
      where: { id: input.templateId },
      select: {
        id: true,
        code: true,
        nameFr: true,
        isActive: true,
        versions: {
          where: {
            status: 'PUBLISHED',
            OR: [{ originCountryId: null }, { originCountryId: me.originCountryId }],
          },
          select: { id: true, version: true, originCountryId: true },
        },
      },
    });
    if (template === null || !template.isActive) this.fail('TEMPLATE_UNAVAILABLE');

    const version = this.pickVersion(template.versions, me.originCountryId);
    if (version === null) this.fail('TEMPLATE_UNAVAILABLE');

    const templateSteps = await this.prisma.templateStep.findMany({
      where: { templateVersionId: version.id },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        position: true,
        isOptional: true,
        daysBeforeArrival: true,
        overrides: true,
        stepDefinition: {
          select: { id: true, nameFr: true, description: true, documentChecklist: true },
        },
      },
    });

    const targetArrivalDate =
      input.targetArrivalDate === undefined ? null : new Date(input.targetArrivalDate);
    const journeyId = newId();
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await this.assertJourneyQuota(tx, actor.userId, me.plan);

      await tx.journey.create({
        data: {
          id: journeyId,
          ownerUserId: actor.userId,
          templateVersionId: version.id,
          // §3.1 : « `title` proposé = nom du type ; le membre le modifie
          // librement. » Ce titre ne sortira jamais du parcours.
          title: input.title ?? template.nameFr,
          status: 'ACTIVE',
          visibility: 'PRIVATE',
          originCountryId: me.originCountryId,
          destinationCityId,
          ...(targetArrivalDate === null ? {} : { targetArrivalDate }),
          progressPct: 0,
          lastActivityAt: now,
        },
      });

      for (const step of templateSteps) {
        // §2.1 : la version « assemble et ordonne des définitions » et peut les
        // surcharger localement (`template_steps.overrides`, T3 A.3 pour la
        // déclinaison Bénin). La surcharge l'emporte, la définition sert de repli.
        const overrides = readOverrides(step.overrides);
        const description = overrides.description ?? step.stepDefinition.description;
        const stepId = newId();
        const dueDate =
          targetArrivalDate === null || step.daysBeforeArrival === null
            ? null
            : minusDays(targetArrivalDate, step.daysBeforeArrival);

        await tx.journeyStep.create({
          data: {
            id: stepId,
            journeyId,
            templateStepId: step.id,
            stepDefinitionId: step.stepDefinition.id,
            title: overrides.name ?? step.stepDefinition.nameFr,
            ...(description === null ? {} : { description }),
            position: step.position,
            status: 'TODO',
            ...(dueDate === null ? {} : { dueDate }),
            dueDateManual: false,
            isCustom: false,
          },
        });

        // §3.3 : la checklist est COPIÉE, puis modifiable. La copie est ce qui
        // permet au membre d'ajouter ses propres lignes sans toucher au modèle.
        const labels = step.stepDefinition.documentChecklist;
        if (labels.length > 0) {
          await tx.journeyStepChecklistItem.createMany({
            data: labels.map((label, index) => ({
              id: newId(),
              journeyStepId: stepId,
              label,
              position: index + 1,
              isChecked: false,
            })),
          });
        }
      }

      await this.audit.record(tx, {
        actor: { type: 'MEMBER', id: actor.userId },
        action: 'journey.created',
        targetType: 'journey',
        targetId: journeyId,
        // Le TITRE n'est pas journalisé : il est personnel, et un journal
        // conservé cinq ans n'est pas l'endroit où le faire vivre.
        metadata: { templateCode: template.code, templateVersionId: version.id },
      });

      await this.outbox.emit(tx, {
        type: 'journey.created',
        aggregateId: journeyId,
        payload: {
          journeyId,
          ownerUserId: actor.userId,
          templateId: template.id,
          templateCode: template.code,
          templateVersionId: version.id,
          destinationCityId,
          originCountryId: me.originCountryId,
          stepCount: templateSteps.length,
        },
      });
    });

    // L'état dérivé se calcule après la copie : la première étape non franchie
    // devient l'étape en cours de la carte d'accueil.
    await this.recomputeState(journeyId);
    return this.detail(actor.userId, journeyId);
  }

  /**
   * §3.1 : « un seul parcours `ACTIVE` ou `PAUSED` en gratuit. Les parcours
   * `COMPLETED`, `ABANDONED`, `ARCHIVED` ne comptent pas. »
   *
   * Le verrou `FOR UPDATE` sur la ligne du membre sérialise les créations
   * concurrentes du MÊME membre, et d'aucun autre : c'est le grain le plus fin qui
   * rende le compte fiable.
   */
  private async assertJourneyQuota(
    tx: Prisma.TransactionClient,
    userId: string,
    plan: string,
  ): Promise<void> {
    if (plan !== 'FREE') return;

    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;

    const max = await this.freeActiveJourneys(tx);
    const current = await tx.journey.count({
      where: { ownerUserId: userId, deletedAt: null, status: { in: ['ACTIVE', 'PAUSED'] } },
    });
    if (current >= max) throw ApiError.planLimit('maxActiveJourneys', current, max);
  }

  /**
   * La limite lue dans `plans.limits` quand la ligne existe, la valeur de la spec
   * sinon. Ne pas retomber signifierait qu'aucune limite ne s'applique tant que
   * la facturation (module 14) n'est pas livrée — or c'est une règle dure.
   */
  private async freeActiveJourneys(tx: Prisma.TransactionClient): Promise<number> {
    const plan = await tx.plan.findUnique({ where: { code: 'FREE' }, select: { limits: true } });
    const limits = plan?.limits;
    if (limits !== null && limits !== undefined && typeof limits === 'object' && !Array.isArray(limits)) {
      const raw = (limits as Record<string, unknown>)['maxActiveJourneys'];
      if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0) return raw;
    }
    return JOURNEY_FREE_ACTIVE_LIMIT;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Lectures
  // ══════════════════════════════════════════════════════════════════════════

  /** `GET /journeys` : les miens, et ceux où je suis membre accepté (§5.1). */
  async list(userId: string) {
    const journeys = await this.prisma.journey.findMany({
      where: {
        deletedAt: null,
        OR: [
          { ownerUserId: userId },
          { members: { some: { userId, status: 'ACTIVE', removedAt: null } } },
        ],
      },
      orderBy: [{ lastActivityAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        title: true,
        status: true,
        visibility: true,
        progressPct: true,
        currentStepId: true,
        targetArrivalDate: true,
        lastActivityAt: true,
        ownerUserId: true,
        groupConversationId: true,
        templateVersion: {
          select: { version: true, template: { select: { code: true, nameFr: true, icon: true } } },
        },
        destinationCity: { select: { id: true, name: true } },
        originCountry: { select: { id: true, iso2: true, nameFr: true } },
        steps: {
          select: {
            id: true,
            title: true,
            // La description de l'étape EN COURS : O05 l'affiche sous son titre, et
            // elle est sur la ligne déjà lue — pas un aller-retour de plus.
            description: true,
            status: true,
            position: true,
            dueDate: true,
          },
        },
        _count: { select: { members: true } },
      },
    });

    return {
      items: journeys.map((journey) => {
        const current = journey.steps.find((s) => s.id === journey.currentStepId) ?? null;
        const nextDue = journey.steps
          .filter((s) => s.status !== 'DONE' && s.dueDate !== null)
          .sort((a, b) => (a.dueDate as Date).getTime() - (b.dueDate as Date).getTime())[0];
        return {
          id: journey.id,
          // Le titre personnel EST rendu ici : c'est mon parcours, ou celui dont
          // je suis accompagnant — jamais une liste publique.
          title: journey.title,
          isOwner: journey.ownerUserId === userId,
          status: journey.status,
          visibility: journey.visibility,
          progressPct: journey.progressPct,
          template: journey.templateVersion.template,
          destinationCity: journey.destinationCity,
          originCountry: journey.originCountry,
          targetArrivalDate: journey.targetArrivalDate,
          currentStep:
            current === null
              ? null
              : { id: current.id, title: current.title, description: current.description },
          nextDueDate: nextDue?.dueDate ?? null,
          memberCount: journey._count.members,
          stepCount: journey.steps.length,
          doneCount: journey.steps.filter((s) => s.status === 'DONE').length,
          lastActivityAt: journey.lastActivityAt,
        };
      }),
      meta: this.meta(),
    };
  }

  /**
   * `GET /journeys/:id` (§5.1) : « Parcours complet : étapes, checklist, membres,
   * progression, prochaine échéance ».
   *
   * RÈGLE DURE (§10) : « les notes et la checklist ne sont jamais renvoyées à un
   * observateur. » Le §3.4 va plus loin : le SUPPORTER non plus ne les voit pas —
   * il gagne la discussion, pas l'intimité du dossier. Le filtrage est donc fait
   * sur le RÔLE, une seule fois, à la construction de la réponse.
   */
  async detail(userId: string, journeyId: string) {
    const journey = await this.loadForViewer(userId, journeyId);
    const role = journey.viewerRole;

    const steps = [...journey.steps].sort((a, b) => a.position - b.position);
    const checklists =
      role === 'OWNER'
        ? await this.prisma.journeyStepChecklistItem.findMany({
            where: { journeyStep: { journeyId } },
            orderBy: [{ journeyStepId: 'asc' }, { position: 'asc' }],
            select: { id: true, journeyStepId: true, label: true, position: true, isChecked: true, checkedAt: true },
          })
        : [];

    const members = await this.prisma.journeyMember.findMany({
      where: { journeyId, status: { in: ['INVITED', 'ACTIVE'] }, removedAt: null },
      select: { userId: true, role: true, status: true, acceptedAt: true, user: { select: MEMBER_USER_SELECT } },
    });

    const nonOptional = steps.filter((s) => this.countsForProgress(s));
    const nextDue = steps
      .filter((s) => s.status !== 'DONE' && s.dueDate !== null)
      .sort((a, b) => (a.dueDate as Date).getTime() - (b.dueDate as Date).getTime())[0];

    return {
      journey: {
        id: journey.id,
        title: journey.title,
        status: journey.status,
        visibility: journey.visibility,
        progressPct: journey.progressPct,
        currentStepId: journey.currentStepId,
        targetArrivalDate: journey.targetArrivalDate,
        completedAt: journey.completedAt,
        owner: journey.owner,
        template: journey.templateVersion.template,
        templateVersion: journey.templateVersion.version,
        destinationCity: journey.destinationCity,
        originCountry: journey.originCountry,
        // La discussion n'est offerte qu'à ceux qui peuvent y écrire (§3.4).
        groupConversationId: role === 'OBSERVER' ? null : journey.groupConversationId,
        doneCount: nonOptional.filter((s) => s.status === 'DONE').length,
        totalCount: nonOptional.length,
        nextDueDate: nextDue?.dueDate ?? null,
        inactivityPromptSentAt: journey.inactivityPromptSentAt,
      },
      viewerRole: role,
      steps: steps.map((step) =>
        this.stepView(step, role, checklists.filter((c) => c.journeyStepId === step.id)),
      ),
      members: members.map((member) => ({
        userId: member.userId,
        role: member.role,
        status: member.status,
        acceptedAt: member.acceptedAt,
        user: member.user,
      })),
      meta: this.meta(),
    };
  }

  /**
   * Une étape, vue par ce rôle.
   *
   * Les notes et la checklist ne sont pas « vidées » après coup : elles ne sont
   * pas MISES dans l'objet quand le lecteur n'est pas le propriétaire. La
   * différence compte — un champ mis puis supprimé finit par survivre à une
   * refonte, et c'est ainsi qu'une note privée sort un jour.
   */
  private stepView(
    step: StepRow,
    role: ViewerRole,
    checklist: readonly { id: string; label: string; position: number; isChecked: boolean; checkedAt: Date | null }[],
  ) {
    const definition = step.stepDefinition;
    const base = {
      id: step.id,
      title: step.title,
      description: step.description,
      position: step.position,
      status: step.status,
      startedAt: step.startedAt,
      completedAt: step.completedAt,
      pausedAt: step.pausedAt,
      durationDays: step.durationDays,
      isCustom: step.isCustom,
      isOptional: step.templateStep?.isOptional ?? false,
      stepDefinitionCode: definition?.code ?? null,
      category: definition?.category ?? null,
      guideId: definition?.guideId ?? null,
      blockerTarget: definition?.blockerTarget ?? 'HELP',
      isMajorMilestone: definition?.isMajorMilestone ?? false,
      isRisky: definition?.isRisky ?? false,
      riskMessage: definition?.isRisky === true ? (definition.riskMessage ?? STEP_RISK_MESSAGE) : null,
      indicativeDurationDays: definition?.defaultDurationDays ?? null,
    };

    if (role !== 'OWNER') return base;

    return {
      ...base,
      dueDate: step.dueDate,
      dueDateManual: step.dueDateManual,
      sharePromptDismissedAt: step.sharePromptDismissedAt,
      notes: step.notesEncrypted === null ? null : this.crypto.decryptContent(step.notesEncrypted),
      checklist: checklist.map((item) => ({
        id: item.id,
        label: item.label,
        position: item.position,
        isChecked: item.isChecked,
        checkedAt: item.checkedAt,
      })),
    };
  }

  /**
   * `GET /journeys/public` (§3.7).
   *
   * RÈGLE DURE : « Un parcours `PAUSED` ou `ABANDONED` n'apparaît jamais comme
   * public, même si `visibility = PUBLIC`. » La clause est dans la REQUÊTE, et
   * non appliquée après coup sur les lignes rendues : un filtre en mémoire saute
   * dès qu'on ajoute une pagination.
   *
   * Les conditions sont accumulées dans un TABLEAU passé à `AND`. Deux clauses
   * posées sur la même clé d'un même objet — `owner` ici, une fois pour les
   * blocages, une fois pour les comptes éteints — s'écrasent silencieusement, et
   * la seconde gagne : c'est par là qu'un module voisin a laissé fuir des profils
   * privés.
   */
  async publicList(userId: string, query: PublicJourneysQuery) {
    const separated = await this.visibility.separatedFrom(userId);

    const conditions: Prisma.JourneyWhereInput[] = [
      { deletedAt: null },
      { visibility: 'PUBLIC' },
      // Ni en pause, ni arrêté, ni archivé : la règle dure, en SQL.
      { status: { in: ['ACTIVE', 'COMPLETED'] } },
      /**
       * ╔══════════════════════════════════════════════════════════════════╗
       * ║ DEUX RÈGLES SUR `ownerUserId`, ÉCRITES EN UNE SEULE CLAUSE       ║
       * ╚══════════════════════════════════════════════════════════════════╝
       *
       * 1. « 5 parcours publics d'AUTRES membres » (§3.7) — SAUF quand on
       *    demande ceux d'une personne précise. L'onglet « Parcours publics »
       *    d'un profil pose une autre question : non « que découvrir ? », mais
       *    « qu'a publié cette personne ? ». Garder l'exclusion y viderait
       *    VOTRE propre profil de vos propres parcours.
       *
       * 2. Les membres séparés, dans les deux sens. `owner_user_id` est NOT
       *    NULL : le `notIn` est sûr ici, ce qui ne serait pas le cas sur une
       *    colonne d'auteur nullable comme celle des guides anonymisés.
       *
       * LES DEUX TIENNENT DANS UN SEUL FILTRE, et c'est voulu :
       * `check-duplicate-spread-keys.mjs` relève toute clé posée deux fois par
       * deux diffusions conditionnelles. Ici le tableau devient un `AND`, donc
       * les deux clauses auraient bien coexisté — mais le garde-fou ne peut pas
       * le savoir, et une alerte qu'on apprend à ignorer ne garde plus rien.
       */
      {
        ownerUserId: {
          ...(query.authorHandle === undefined ? { not: userId } : {}),
          ...(separated.length === 0 ? {} : { notIn: separated }),
        },
      },
      ...(query.authorHandle === undefined
        ? []
        : [{ owner: { handle: query.authorHandle } }]),
      // Un compte éteint ou banni n'expose plus rien.
      { owner: { deletedAt: null, status: 'ACTIVE' } },
    ];

    if (query.templateCode !== undefined) {
      conditions.push({ templateVersion: { template: { code: query.templateCode } } });
    }
    if (query.cityId !== undefined) conditions.push({ destinationCityId: query.cityId });

    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { originCountryId: true, cityId: true },
    });

    // Le tri de §3.7 — « avancement proche du mien d'abord, puis aboutis », après
    // priorité au même type, à la même ville, puis au même pays — n'est pas un
    // `ORDER BY` : il dépend de mon propre avancement. On prend donc une réserve
    // bornée, et on classe en mémoire. `take` reste borné pour qu'une base pleine
    // de parcours publics ne charge pas la table.
    const rows = await this.prisma.journey.findMany({
      where: { AND: conditions },
      orderBy: [{ lastActivityAt: 'desc' }, { id: 'desc' }],
      take: Math.min(query.limit * 8, PUBLIC_JOURNEYS_MAX_LIMIT * 8),
      select: {
        id: true,
        status: true,
        progressPct: true,
        currentStepId: true,
        destinationCityId: true,
        originCountryId: true,
        lastActivityAt: true,
        owner: { select: MEMBER_USER_SELECT },
        templateVersion: { select: { template: { select: { code: true, nameFr: true, icon: true } } } },
        destinationCity: { select: { id: true, name: true } },
        originCountry: { select: { id: true, iso2: true, nameFr: true } },
        steps: {
          where: { status: 'DONE' },
          orderBy: { position: 'asc' },
          select: { id: true, title: true, position: true, durationDays: true, completedAt: true },
        },
      },
    });

    // Mon parcours de référence : il donne le type à mettre en avant (« même
    // `journey_templates.code` en priorité ») et l'avancement dont on cherche la
    // proximité. `progressNear` passé par le client l'emporte sur le second.
    const mine = await this.prisma.journey.findFirst({
      where: { ownerUserId: userId, deletedAt: null, status: { in: ['ACTIVE', 'PAUSED'] } },
      orderBy: { lastActivityAt: 'desc' },
      select: {
        progressPct: true,
        templateVersion: { select: { template: { select: { code: true } } } },
      },
    });
    const reference = query.progressNear ?? mine?.progressPct ?? 0;
    const myTemplateCode = mine?.templateVersion.template.code ?? null;

    const scored = rows
      .map((row) => ({
        row,
        rank: [
          // §3.7, dans l'ordre : même type d'abord, puis même ville de
          // destination, puis même pays d'origine ; ensuite l'avancement proche du
          // mien, et les parcours aboutis en dernier.
          myTemplateCode !== null && row.templateVersion.template.code === myTemplateCode ? 0 : 1,
          row.destinationCityId === me.cityId ? 0 : 1,
          row.originCountryId === me.originCountryId ? 0 : 1,
          Math.abs(row.progressPct - reference),
          row.status === 'COMPLETED' ? 1 : 0,
        ] as const,
      }))
      .sort((a, b) => compareRanks(a.rank, b.rank))
      .slice(0, query.limit)
      .map(({ row }) => this.publicView(row));

    return { items: scored, meta: this.meta() };
  }

  /**
   * `GET /journeys/public/:id` (§5.1) : « 404 si non public, en pause, arrêté ou
   * bloqué ».
   *
   * RÈGLE DURE (§3.7) : ce que voit un membre connecté est une LISTE FERMÉE —
   * handle, avatar, niveau, type, ville, pays, étape en cours, étapes franchies
   * avec leur durée, progression. Jamais le titre personnel, ni les notes, ni la
   * checklist, ni l'équipe, ni la discussion, ni les dates cibles.
   */
  async publicDetail(userId: string, journeyId: string) {
    const journey = await this.prisma.journey.findFirst({
      where: {
        id: journeyId,
        deletedAt: null,
        visibility: 'PUBLIC',
        status: { in: ['ACTIVE', 'COMPLETED'] },
        owner: { deletedAt: null, status: 'ACTIVE' },
      },
      select: {
        id: true,
        status: true,
        progressPct: true,
        currentStepId: true,
        destinationCityId: true,
        originCountryId: true,
        lastActivityAt: true,
        ownerUserId: true,
        owner: { select: MEMBER_USER_SELECT },
        templateVersion: { select: { template: { select: { code: true, nameFr: true, icon: true } } } },
        destinationCity: { select: { id: true, name: true } },
        originCountry: { select: { id: true, iso2: true, nameFr: true } },
        steps: {
          where: { status: 'DONE' },
          orderBy: { position: 'asc' },
          select: { id: true, title: true, position: true, durationDays: true, completedAt: true },
        },
      },
    });
    if (journey === null) throw ApiError.notFound();
    // Un blocage, dans un sens ou l'autre, rend le parcours introuvable (08 §4).
    if (await this.visibility.isSeparated(userId, journey.ownerUserId)) throw ApiError.notFound();

    const current =
      journey.currentStepId === null
        ? null
        : await this.prisma.journeyStep.findUnique({
            where: { id: journey.currentStepId },
            select: { id: true, title: true, position: true },
          });

    return { journey: { ...this.publicView(journey), currentStep: current }, meta: this.meta() };
  }

  /** La projection publique, en un seul endroit — donc impossible à oublier. */
  private publicView(row: {
    id: string;
    status: string;
    progressPct: number;
    owner: { handle: string; displayName: string | null; verificationLevel: string; avatarAsset: { storageKey: string } | null };
    templateVersion: { template: { code: string; nameFr: string; icon: string | null } };
    destinationCity: { id: string; name: string };
    originCountry: { id: string; iso2: string; nameFr: string };
    steps: readonly { id: string; title: string; position: number; durationDays: number | null; completedAt: Date | null }[];
  }) {
    return {
      id: row.id,
      status: row.status,
      progressPct: row.progressPct,
      member: {
        handle: row.owner.handle,
        displayName: row.owner.displayName,
        verificationLevel: row.owner.verificationLevel,
        avatarKey: row.owner.avatarAsset?.storageKey ?? null,
      },
      template: row.templateVersion.template,
      destinationCity: row.destinationCity,
      originCountry: row.originCountry,
      completedSteps: row.steps.map((step) => ({
        id: step.id,
        title: step.title,
        position: step.position,
        durationDays: step.durationDays,
        completedAt: step.completedAt,
      })),
    };
  }

  /**
   * `GET /journeys/:id/activities` (§3.8) : le journal, en chronologie inversée.
   *
   * Réservé au PROPRIÉTAIRE. §3.4 donne aux accompagnants les étapes et la
   * progression, pas le journal — qui porte les blocages privés, les notes et
   * les motifs. En cas de doute, la règle du module est de ne pas montrer.
   *
   * `buildPage` est appelé SANS `sortOf` parce que le tri EST l'identifiant : les
   * UUID v7 sont chronologiques, donc `id desc` est l'ordre du journal. Avec un
   * autre tri, omettre `sortOf` casserait la page suivante en silence.
   */
  async activities(userId: string, journeyId: string, query: JourneyActivitiesQuery): Promise<Page<unknown>> {
    await this.assertOwned(userId, journeyId);

    const scope = `journey-activities:${journeyId}`;
    const cursor =
      query.cursor === undefined ? null : decodeCursor(query.cursor, this.cursorSecret, scope);

    const rows = await this.prisma.journeyActivity.findMany({
      where: {
        journeyId,
        ...(cursor === null ? {} : { id: { lt: cursor.id } }),
      },
      orderBy: { id: 'desc' },
      take: query.limit + 1,
      select: {
        id: true,
        type: true,
        journeyStepId: true,
        refType: true,
        refId: true,
        payload: true,
        createdAt: true,
        actor: { select: { handle: true, displayName: true } },
        journeyStep: { select: { title: true } },
      },
    });

    const page = buildPage(rows, query.limit, scope, this.cursorSecret);
    return {
      items: page.items.map((row) => ({
        id: row.id,
        type: row.type,
        stepId: row.journeyStepId,
        stepTitle: row.journeyStep?.title ?? null,
        refType: row.refType,
        refId: row.refId,
        payload: row.payload,
        actor: row.actor,
        createdAt: row.createdAt,
      })),
      nextCursor: page.nextCursor,
      meta: this.meta(),
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Réglages du parcours (§3.1, §3.7, §3.9)
  // ══════════════════════════════════════════════════════════════════════════

  /** `PATCH /journeys/:id` : titre, date cible, statut, visibilité (§5.1). */
  async update(userId: string, journeyId: string, patch: UpdateJourney, ip?: string) {
    const journey = await this.assertOwned(userId, journeyId);

    const data: Prisma.JourneyUpdateInput = {};
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.status !== undefined && patch.status !== journey.status) {
      data.status = patch.status;
      // §3.9 : la relance est UNIQUE. Répondre en changeant l'état ne la
      // réarme pas — c'est le sens de « Aucune relance ensuite ».
    }
    if (patch.visibility !== undefined) data.visibility = patch.visibility;
    if (patch.targetArrivalDate !== undefined) {
      data.targetArrivalDate =
        patch.targetArrivalDate === null ? null : new Date(patch.targetArrivalDate);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.journey.update({ where: { id: journeyId }, data: { ...data, lastActivityAt: new Date() } });

      // §3.7 : le passage en PUBLIC « enregistre le consentement
      // JOURNEY_VISIBILITY », et il est « réversible à tout moment » — d'où la
      // ligne de RETRAIT quand on en sort. La table est en ajout seul : c'est
      // l'historique qui fait la preuve (01 §2.10).
      if (patch.visibility !== undefined && patch.visibility !== journey.visibility) {
        if (patch.visibility === 'PUBLIC' || journey.visibility === 'PUBLIC') {
          await this.consents.record(tx, {
            userId,
            type: 'JOURNEY_VISIBILITY',
            granted: patch.visibility === 'PUBLIC',
            ...(ip === undefined ? {} : { ip }),
          });
        }
      }

      if (patch.targetArrivalDate !== undefined) {
        await this.applyRetroPlanning(
          tx,
          journeyId,
          patch.targetArrivalDate === null ? null : new Date(patch.targetArrivalDate),
        );
      }

      if (patch.status !== undefined && patch.status !== journey.status) {
        await this.audit.record(tx, {
          actor: { type: 'MEMBER', id: userId },
          action: `journey.${patch.status.toLowerCase()}`,
          targetType: 'journey',
          targetId: journeyId,
        });
        // `journey.completed` est le seul état de fin qui ait un consommateur
        // déclaré ET un producteur possible ici : §5.1 ne laisse pas le membre
        // poser COMPLETED par cette route, donc rien n'est émis pour PAUSED ni
        // ABANDONED — un type d'événement sans lecteur ferait croire la chaîne
        // branchée (voir le catalogue de `outbox.service.ts`).
      }
    });

    return this.detail(userId, journeyId);
  }

  /**
   * §2.3 : « À la saisie ou modification de `journeys.target_arrival_date`, chaque
   * étape NON FRANCHIE reçoit `due_date = target_arrival_date − days_before_arrival`
   * (si la valeur est définie). Une `due_date` saisie à la main par le membre
   * n'est pas écrasée. »
   *
   * Trois conditions, donc, et la troisième est celle qu'on oublie : `dueDateManual`.
   */
  private async applyRetroPlanning(
    tx: Prisma.TransactionClient,
    journeyId: string,
    targetArrivalDate: Date | null,
  ): Promise<void> {
    const steps = await tx.journeyStep.findMany({
      where: { journeyId, status: { not: 'DONE' }, dueDateManual: false },
      select: { id: true, templateStep: { select: { daysBeforeArrival: true } } },
    });

    for (const step of steps) {
      const offset = step.templateStep?.daysBeforeArrival ?? null;
      if (offset === null) continue;
      await tx.journeyStep.update({
        where: { id: step.id },
        data: {
          dueDate: targetArrivalDate === null ? null : minusDays(targetArrivalDate, offset),
        },
      });
    }
  }

  /** `POST /journeys/:id/inactivity-response` (§3.9). */
  async inactivityResponse(userId: string, journeyId: string, input: InactivityResponse) {
    await this.assertOwned(userId, journeyId);

    const status =
      input.answer === 'CONTINUE'
        ? null
        : input.answer === 'PAUSED'
          ? ('PAUSED' as const)
          : input.answer === 'COMPLETED'
            ? ('COMPLETED' as const)
            : ('ABANDONED' as const);

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.journey.update({
        where: { id: journeyId },
        data: {
          lastActivityAt: now,
          ...(status === null ? {} : { status }),
          ...(status === 'COMPLETED' ? { completedAt: now } : {}),
        },
      });
      if (status === 'COMPLETED') {
        await this.outbox.emit(tx, {
          type: 'journey.completed',
          aggregateId: journeyId,
          payload: { journeyId, ownerUserId: userId, via: 'INACTIVITY_RESPONSE' },
        });
      }
    });

    return this.detail(userId, journeyId);
  }

  /** `POST /journeys/:id/report-template-error` (§2.4). */
  async reportTemplateError(userId: string, journeyId: string, input: ReportTemplateError) {
    const journey = await this.assertOwned(userId, journeyId);

    let stepDefinitionId: string | null = null;
    if (input.stepId !== undefined) {
      const step = await this.prisma.journeyStep.findFirst({
        where: { id: input.stepId, journeyId },
        select: { stepDefinitionId: true },
      });
      if (step === null) throw ApiError.notFound();
      stepDefinitionId = step.stepDefinitionId;
    }

    const id = newId();
    await this.prisma.templateCorrectionProposal.create({
      data: {
        id,
        templateVersionId: journey.templateVersionId,
        ...(stepDefinitionId === null ? {} : { stepDefinitionId }),
        userId,
        message: input.message,
        status: 'PENDING',
      },
    });
    return { id, status: 'PENDING' as const, meta: this.meta() };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Étapes (§3.2)
  // ══════════════════════════════════════════════════════════════════════════

  /** `POST /journeys/:id/steps` : une étape personnelle, sans définition (§3.2). */
  async addStep(userId: string, journeyId: string, input: CreateJourneyStep) {
    await this.assertOwned(userId, journeyId);

    const id = newId();
    await this.prisma.$transaction(async (tx) => {
      const last = await tx.journeyStep.aggregate({
        where: { journeyId },
        _max: { position: true },
      });
      // La position demandée est BORNÉE à la fin de la liste : accepter 40 sur un
      // parcours de trois étapes laisserait un trou, et les positions ne seraient
      // plus contiguës — ce dont dépend le décalage à la suppression.
      const next = (last._max.position ?? 0) + 1;
      const target = input.position === undefined ? next : Math.min(input.position, next);

      // Insérer au milieu décale les suivantes. `@@unique([journeyId, position])`
      // interdit de le faire dans le désordre : on repousse d'abord, en
      // descendant, puis on insère.
      const toShift = await tx.journeyStep.findMany({
        where: { journeyId, position: { gte: target } },
        orderBy: { position: 'desc' },
        select: { id: true, position: true },
      });
      for (const step of toShift) {
        await tx.journeyStep.update({
          where: { id: step.id },
          data: { position: step.position + 1 },
        });
      }

      await tx.journeyStep.create({
        data: {
          id,
          journeyId,
          title: input.title,
          ...(input.description === undefined ? {} : { description: input.description }),
          position: target,
          status: 'TODO',
          ...(input.dueDate === undefined
            ? {}
            : { dueDate: new Date(input.dueDate), dueDateManual: true }),
          isCustom: true,
        },
      });
      await tx.journey.update({ where: { id: journeyId }, data: { lastActivityAt: new Date() } });
    });

    await this.recomputeState(journeyId);
    return this.detail(userId, journeyId);
  }

  /**
   * `PATCH /journeys/:id/steps/:stepId` (§3.2) — le cœur du module.
   *
   * RÈGLE DURE (§1.2) : franchir une étape NE PUBLIE RIEN. La méthode rend une
   * `shareProposal` — de la donnée, que l'écran affiche — et c'est un second
   * appel, `shareMilestone`, qui crée la publication avec le texte du membre.
   *
   * RÈGLE DURE (§3.2) : aucun état d'échec. Les transitions permises sont celles
   * du tableau, plus `TODO → DONE` que la règle de durée du même paragraphe
   * suppose (« ou depuis la clôture de l'étape précédente si jamais démarrée »).
   * Tout le reste lève `INVALID_TRANSITION`.
   */
  async updateStep(
    actor: JourneyActor,
    journeyId: string,
    stepId: string,
    patch: UpdateJourneyStep,
  ) {
    const journey = await this.assertOwned(actor.userId, journeyId);
    const step = await this.prisma.journeyStep.findFirst({
      where: { id: stepId, journeyId },
      select: {
        id: true,
        status: true,
        position: true,
        startedAt: true,
        completedAt: true,
        sharePromptDismissedAt: true,
        stepDefinition: { select: { isMajorMilestone: true } },
      },
    });
    if (step === null) throw ApiError.notFound();

    const data: Prisma.JourneyStepUpdateInput = {};
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.description !== undefined) data.description = patch.description;
    if (patch.notes !== undefined) {
      // §8.1 : les notes sont chiffrées au repos. Elles ne sont jamais rendues à
      // quiconque d'autre que le propriétaire (§3.7).
      data.notesEncrypted = patch.notes === null ? null : this.crypto.encryptContent(patch.notes);
    }
    if (patch.dueDate !== undefined) {
      if (patch.dueDate === null) {
        // Rendre l'échéance au rétro-planning : elle redevient calculée.
        data.dueDate = null;
        data.dueDateManual = false;
      } else {
        data.dueDate = new Date(patch.dueDate);
        // §2.3 : une échéance saisie à la main n'est plus écrasée.
        data.dueDateManual = true;
      }
    }

    const nextStatus =
      patch.status === undefined || patch.status === step.status ? null : patch.status;
    if (nextStatus !== null && !isAllowedTransition(step.status, nextStatus)) {
      this.fail('INVALID_TRANSITION', { from: step.status, to: nextStatus });
    }
    // On ne fait pas AVANCER un parcours arrêté ou terminé : §3.9 propose de le
    // reprendre, ce qui passe par `PATCH /journeys/:id`.
    if (nextStatus !== null && journey.status !== 'ACTIVE' && journey.status !== 'COMPLETED') {
      this.fail('JOURNEY_STATE', { status: journey.status });
    }

    const now = new Date();
    let durationDays: number | null = null;

    await this.prisma.$transaction(async (tx) => {
      if (nextStatus === 'IN_PROGRESS') {
        data.status = 'IN_PROGRESS';
        // Rouvrir une étape franchie efface sa clôture et sa durée : la
        // progression doit redescendre, sinon le parcours resterait « terminé »
        // avec une étape en cours.
        data.completedAt = null;
        data.durationDays = null;
        data.pausedAt = null;
        if (step.startedAt === null) data.startedAt = now;
      } else if (nextStatus === 'DONE') {
        data.status = 'DONE';
        data.completedAt = now;
        data.pausedAt = null;
        durationDays = await this.durationFor(tx, journeyId, step, now);
        data.durationDays = durationDays;
      } else if (nextStatus === 'PAUSED') {
        data.status = 'PAUSED';
        data.pausedAt = now;
      } else if (nextStatus === 'TODO') {
        data.status = 'TODO';
      }

      await tx.journeyStep.update({ where: { id: stepId }, data });
      await tx.journey.update({ where: { id: journeyId }, data: { lastActivityAt: now } });

      if (nextStatus === 'IN_PROGRESS' && step.status === 'TODO') {
        await this.logActivity(tx, { journeyId, actorUserId: actor.userId, stepId, type: 'STEP_STARTED' });
        await this.outbox.emit(tx, {
          type: 'journey.step_started',
          aggregateId: stepId,
          payload: { journeyId, journeyStepId: stepId, ownerUserId: actor.userId },
        });
      }

      if (nextStatus === 'DONE') {
        await this.logActivity(tx, {
          journeyId,
          actorUserId: actor.userId,
          stepId,
          type: 'STEP_DONE',
          payload: { durationDays },
        });
        // Le fil s'y abonne pour l'encart « Étape franchie · N sur M » et pour
        // recalculer le score des conseils rattachés à l'étape (04 §6).
        await this.outbox.emit(tx, {
          type: 'journey.step_completed',
          aggregateId: stepId,
          payload: {
            journeyId,
            journeyStepId: stepId,
            stepId,
            ownerUserId: actor.userId,
            durationDays,
          },
        });
      }

      if (nextStatus === 'PAUSED') {
        // « Aucune connotation d'échec » (§3.2) : l'activité s'appelle
        // STEP_PAUSED, et rien d'autre n'en est déduit.
        await this.logActivity(tx, { journeyId, actorUserId: actor.userId, stepId, type: 'STEP_PAUSED' });
      }
    });

    const state = await this.recomputeState(journeyId);
    const detail = await this.detail(actor.userId, journeyId);

    return {
      ...detail,
      /**
       * §3.6 : les PROPOSITIONS. Ce sont des données, pas des publications — rien
       * n'a été écrit dans `posts` ni dans `stories`, et rien ne le sera sans
       * `POST /journeys/:id/steps/:stepId/share` ou `POST /stories`.
       */
      proposals:
        nextStatus === 'DONE'
          ? {
              tip: { kind: 'STORY_TIP' as const, stepId },
              milestone:
                step.stepDefinition?.isMajorMilestone === true &&
                step.sharePromptDismissedAt === null
                  ? { kind: 'VICTORY' as const, stepId, text: '' }
                  : null,
              // §3.7 : le passage en public est proposé À LA PREMIÈRE ÉTAPE
              // FRANCHIE, jamais à la création.
              goPublic:
                journey.visibility === 'PRIVATE' && state.doneCount === 1
                  ? { kind: 'GO_PUBLIC' as const }
                  : null,
            }
          : null,
    };
  }

  /**
   * §3.2 : « `duration_days` = jours depuis `started_at` (ou depuis la clôture de
   * l'étape précédente si jamais démarrée). »
   *
   * Le second cas est ce qui autorise `TODO → DONE` : une étape qu'on n'a jamais
   * « démarrée » mais qu'on coche en passant a quand même une durée, comptée
   * depuis le moment où l'on a franchi celle d'avant.
   */
  private async durationFor(
    tx: Prisma.TransactionClient,
    journeyId: string,
    step: { position: number; startedAt: Date | null },
    now: Date,
  ): Promise<number> {
    if (step.startedAt !== null) return daysBetween(step.startedAt, now);

    const previous = await tx.journeyStep.findFirst({
      where: { journeyId, position: { lt: step.position }, completedAt: { not: null } },
      orderBy: { position: 'desc' },
      select: { completedAt: true },
    });
    const from = previous?.completedAt ?? null;
    return from === null ? 0 : daysBetween(from, now);
  }

  /** `PUT /journeys/:id/steps/order` (§3.2) : glisser-déposer. */
  async reorderSteps(userId: string, journeyId: string, input: ReorderSteps) {
    await this.assertOwned(userId, journeyId);

    const steps = await this.prisma.journeyStep.findMany({
      where: { journeyId },
      select: { id: true },
    });
    const known = new Set(steps.map((s) => s.id));
    if (input.stepIds.length !== known.size || input.stepIds.some((id) => !known.has(id))) {
      // La liste doit être COMPLÈTE : une liste partielle laisserait des positions
      // en double, que la contrainte d'unicité refuserait à mi-chemin.
      throw ApiError.validation([{ path: 'stepIds', code: 'INCOMPLETE_ORDER' }]);
    }
    if (new Set(input.stepIds).size !== input.stepIds.length) {
      throw ApiError.validation([{ path: 'stepIds', code: 'DUPLICATE_ID' }]);
    }

    await this.prisma.$transaction(async (tx) => {
      // Deux passes : les positions transitoires sont négatives, hors de portée de
      // la contrainte d'unicité. Sans cela, réordonner A↔B échoue au premier
      // `update`, puisque la position visée est encore occupée.
      for (const [index, id] of input.stepIds.entries()) {
        await tx.journeyStep.update({ where: { id }, data: { position: -(index + 1) } });
      }
      for (const [index, id] of input.stepIds.entries()) {
        await tx.journeyStep.update({ where: { id }, data: { position: index + 1 } });
      }
      await tx.journey.update({ where: { id: journeyId }, data: { lastActivityAt: new Date() } });
    });

    await this.recomputeState(journeyId);
    return this.detail(userId, journeyId);
  }

  /**
   * `DELETE /journeys/:id/steps/:stepId` (§5.1).
   *
   * §3.2 demande une « suppression logique » — mais `journey_steps` n'a AUCUNE
   * colonne `deleted_at` dans le schéma figé, et la consigne est de signaler
   * plutôt que de migrer. La suppression est donc PHYSIQUE, et ses conséquences
   * sont assumées : la checklist part en cascade, les activités et les blocages
   * gardent leur `journey_step_id` à NULL (`onDelete: SetNull`), donc le journal
   * survit à l'étape.
   */
  async deleteStep(userId: string, journeyId: string, stepId: string) {
    await this.assertOwned(userId, journeyId);
    const step = await this.prisma.journeyStep.findFirst({
      where: { id: stepId, journeyId },
      select: { id: true, position: true },
    });
    if (step === null) throw ApiError.notFound();

    await this.prisma.$transaction(async (tx) => {
      // `journeys.current_step_id` pointe peut-être cette étape : la clé étrangère
      // est en `SetNull`, mais on recalcule juste après de toute façon.
      await tx.journeyStep.delete({ where: { id: stepId } });
      const after = await tx.journeyStep.findMany({
        where: { journeyId, position: { gt: step.position } },
        orderBy: { position: 'asc' },
        select: { id: true, position: true },
      });
      for (const row of after) {
        await tx.journeyStep.update({ where: { id: row.id }, data: { position: row.position - 1 } });
      }
      await tx.journey.update({ where: { id: journeyId }, data: { lastActivityAt: new Date() } });
    });

    await this.recomputeState(journeyId);
    return this.detail(userId, journeyId);
  }

  /**
   * `PUT /journeys/:id/steps/:stepId/checklist` (§3.3) : la liste COMPLÈTE
   * remplace la précédente.
   *
   * Aucun fichier n'est attaché, et aucun ne le sera en V1 : ce sont des libellés
   * cochables. L'horodatage de la coche est conservé quand le libellé ne change
   * pas — remplacer la liste ne doit pas « décocher » ce qui reste vrai.
   */
  async replaceChecklist(
    userId: string,
    journeyId: string,
    stepId: string,
    input: ReplaceChecklist,
  ) {
    await this.assertOwned(userId, journeyId);
    const step = await this.prisma.journeyStep.findFirst({
      where: { id: stepId, journeyId },
      select: { id: true },
    });
    if (step === null) throw ApiError.notFound();

    const existing = await this.prisma.journeyStepChecklistItem.findMany({
      where: { journeyStepId: stepId },
      select: { label: true, isChecked: true, checkedAt: true },
    });
    const previous = new Map(existing.map((item) => [item.label, item]));
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.journeyStepChecklistItem.deleteMany({ where: { journeyStepId: stepId } });
      if (input.items.length > 0) {
        await tx.journeyStepChecklistItem.createMany({
          data: input.items.map((item, index) => {
            const before = previous.get(item.label);
            const keptCheckedAt =
              item.isChecked && before?.isChecked === true ? before.checkedAt : null;
            return {
              id: newId(),
              journeyStepId: stepId,
              label: item.label,
              position: index + 1,
              isChecked: item.isChecked,
              checkedAt: item.isChecked ? (keptCheckedAt ?? now) : null,
            };
          }),
        });
      }
      await tx.journey.update({ where: { id: journeyId }, data: { lastActivityAt: now } });
    });

    return this.detail(userId, journeyId);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Équipe du parcours (§3.4)
  // ══════════════════════════════════════════════════════════════════════════

  /** `POST /journeys/:id/members` (§3.4) : invitation par handle. */
  async addMember(userId: string, journeyId: string, input: AddJourneyMember) {
    await this.assertOwned(userId, journeyId);

    const invited = await this.prisma.user.findUnique({
      where: { handle: input.userHandle },
      select: { id: true, deletedAt: true, status: true },
    });
    if (invited === null || invited.deletedAt !== null || invited.status === 'DELETED') {
      throw ApiError.notFound();
    }
    if (invited.id === userId) {
      throw ApiError.validation([{ path: 'userHandle', code: 'SELF_INVITE' }]);
    }
    // §5.1 nomme `BLOCKED_RELATIONSHIP` sur cette route. Dans les DEUX sens.
    if (await this.visibility.isSeparated(userId, invited.id)) {
      throw ApiError.transverse('BLOCKED_RELATIONSHIP');
    }

    const existing = await this.prisma.journeyMember.findUnique({
      where: { journeyId_userId: { journeyId, userId: invited.id } },
      select: { id: true, status: true, role: true },
    });

    // §3.4 : « Maximum 10 membres par parcours. » Les retirés ne comptent pas,
    // sinon retirer quelqu'un ne libérerait jamais la place.
    if (existing === null || existing.status === 'REMOVED') {
      const count = await this.prisma.journeyMember.count({
        where: { journeyId, status: { in: ['INVITED', 'ACTIVE'] }, removedAt: null },
      });
      if (count >= JOURNEY_MAX_MEMBERS) this.fail('MAX_MEMBERS', { max: JOURNEY_MAX_MEMBERS });
    }

    if (existing === null) {
      await this.prisma.journeyMember.create({
        data: {
          id: newId(),
          journeyId,
          userId: invited.id,
          role: input.role,
          invitedByUserId: userId,
          status: 'INVITED',
        },
      });
    } else {
      // Réinviter quelqu'un qu'on avait retiré, ou changer son rôle avant qu'il
      // accepte : la même ligne sert, la contrainte d'unicité l'impose.
      await this.prisma.journeyMember.update({
        where: { journeyId_userId: { journeyId, userId: invited.id } },
        data: {
          role: input.role,
          ...(existing.status === 'ACTIVE' ? {} : { status: 'INVITED' as const }),
          removedAt: null,
        },
      });
    }

    return this.detail(userId, journeyId);
  }

  /**
   * `POST /journeys/:id/members/accept` (§5.1), par l'invité.
   *
   * IDEMPOTENT : un second appel ne réémet ni l'événement ni l'activité. La
   * messagerie recalcule l'appartenance à la conversation sur
   * `journey.member_joined` (08 §5.1) — d'où l'événement, et non un appel direct.
   */
  async acceptInvite(userId: string, journeyId: string) {
    const invitation = await this.prisma.journeyMember.findFirst({
      where: { journeyId, userId, journey: { deletedAt: null } },
      select: { id: true, status: true, role: true },
    });
    if (invitation === null || invitation.status === 'REMOVED') throw ApiError.notFound();
    if (invitation.status === 'ACTIVE') return this.detail(userId, journeyId);

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const moved = await tx.journeyMember.updateMany({
        where: { journeyId, userId, status: 'INVITED' },
        data: { status: 'ACTIVE', acceptedAt: now, removedAt: null },
      });
      // Conditionné au statut : deux acceptations concurrentes n'écrivent qu'une
      // activité et n'émettent qu'un événement.
      if (moved.count === 0) return;

      await this.logActivity(tx, {
        journeyId,
        actorUserId: userId,
        type: 'MEMBER_JOINED',
        payload: { userId, role: invitation.role },
      });
      await this.outbox.emit(tx, {
        type: 'journey.member_joined',
        aggregateId: journeyId,
        payload: { journeyId, userId, role: invitation.role },
      });
    });

    return this.detail(userId, journeyId);
  }

  /**
   * `POST /journeys/:id/members/decline` (§5.1).
   *
   * `journey_members.status` ne porte pas de valeur `DECLINED` dans le schéma
   * figé : le refus est donc enregistré comme un retrait (`REMOVED` +
   * `removed_at`), ce qui a le bon effet — la personne n'est ni dans l'équipe, ni
   * relancée — mais ne distingue pas un refus d'une exclusion. Signalé, non migré.
   */
  async declineInvite(userId: string, journeyId: string) {
    const updated = await this.prisma.journeyMember.updateMany({
      where: { journeyId, userId, status: 'INVITED' },
      data: { status: 'REMOVED', removedAt: new Date() },
    });
    if (updated.count === 0) throw ApiError.notFound();
    return { declined: true };
  }

  /** `DELETE /journeys/:id/members/:userId` (§3.4) : retrait par le propriétaire. */
  async removeMember(userId: string, journeyId: string, memberUserId: string) {
    await this.assertOwned(userId, journeyId);

    const now = new Date();
    const removed = await this.prisma.$transaction(async (tx) => {
      const moved = await tx.journeyMember.updateMany({
        where: { journeyId, userId: memberUserId, removedAt: null },
        data: { status: 'REMOVED', removedAt: now },
      });
      if (moved.count === 0) return false;
      // La messagerie sort la personne de la conversation du parcours en
      // recalculant sur cet événement (§7 : consommateur `messaging`).
      await this.outbox.emit(tx, {
        type: 'journey.member_removed',
        aggregateId: journeyId,
        payload: { journeyId, userId: memberUserId, removedByUserId: userId },
      });
      return true;
    });

    if (!removed) throw ApiError.notFound();
    return this.detail(userId, journeyId);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // « Je suis bloqué » (§3.5)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * `POST /journeys/:id/steps/:stepId/blocker` (§3.5, temps 1 et 2) : crée le
   * BROUILLON et rend le texte pré-rempli.
   *
   * RÈGLE DURE (§3.5) : rien n'est publié ici. Aucune ligne dans `help_requests`,
   * `housing_listings`, `job_seeker_profiles` ni `mentorships` — seul un
   * `blocker_requests` en `DRAFT`.
   *
   * Le gabarit interpole `{parcours}` avec le NOM DU TYPE. Écrire
   * `journey.title` ici enverrait « Ma galère de visa » dans une demande
   * d'entraide publique, ce que 06 §2.5 interdit mot pour mot.
   */
  async createBlockerDraft(userId: string, journeyId: string, stepId: string) {
    const journey = await this.assertOwned(userId, journeyId);
    const step = await this.prisma.journeyStep.findFirst({
      where: { id: stepId, journeyId },
      select: {
        id: true,
        title: true,
        dueDate: true,
        stepDefinition: { select: { blockerTarget: true, blockerTemplate: true } },
      },
    });
    if (step === null) throw ApiError.notFound();

    // §3.5 : « `target` = `step_definitions.blocker_target` (ou `HELP` pour une
    // étape personnalisée) ».
    const target = step.stepDefinition?.blockerTarget ?? 'HELP';
    if (target === 'NONE') this.fail('BLOCKER_NOT_AVAILABLE');

    const template = step.stepDefinition?.blockerTemplate ?? BLOCKER_TEMPLATES[target];
    const draftText = renderBlockerTemplate(template, {
      etape: step.title,
      // Le NOM DU TYPE, jamais `journey.title`.
      parcours: journey.templateName,
      ville: journey.destinationCityName,
      echeance: formatDueDate(step.dueDate),
    });

    // Un second clic sur le même bouton ne crée pas un second brouillon : il
    // rafraîchit celui qui existe. Sans cela, hésiter trois fois laisserait trois
    // lignes et trois identifiants publiables.
    const existing = await this.prisma.blockerRequest.findFirst({
      where: { journeyStepId: stepId, status: 'DRAFT' },
      select: { id: true },
    });

    const id = existing?.id ?? newId();
    if (existing === null) {
      await this.prisma.blockerRequest.create({
        data: {
          id,
          journeyId,
          journeyStepId: stepId,
          target,
          isPrivate: false,
          draftText,
          status: 'DRAFT',
        },
      });
    } else {
      await this.prisma.blockerRequest.update({
        where: { id },
        data: { target, draftText },
      });
    }

    return {
      blocker: {
        id,
        journeyId,
        journeyStepId: stepId,
        target,
        status: 'DRAFT' as const,
        /** Pré-rempli ET ÉDITABLE. C'est le texte renvoyé par le client qui sera publié. */
        draftText,
      },
      meta: this.meta(),
    };
  }

  /**
   * `POST /blockers/:id/publish` (§3.5, temps 3 et 4).
   *
   * RÈGLE DURE : « L'objet cible n'est créé qu'à l'appel explicite de la route de
   * publication, AVEC LE TEXTE TEL QUE RENVOYÉ PAR LE CLIENT. Le brouillon n'est
   * jamais promu sans cet appel. » Le gabarit n'est donc plus lu ici : `input.text`
   * est le seul texte qui part.
   *
   * Portée privée : rien de public. Le texte part dans la discussion du parcours,
   * que la messagerie sait construire, et que l'on s'assure d'avoir avant
   * d'écrire — la conversation est créée par un consommateur d'événement, qui
   * peut n'être pas encore passé.
   */
  async publishBlocker(actor: JourneyActor, blockerId: string, input: PublishBlocker) {
    const blocker = await this.prisma.blockerRequest.findFirst({
      where: { id: blockerId, journey: { ownerUserId: actor.userId, deletedAt: null } },
      select: {
        id: true,
        journeyId: true,
        journeyStepId: true,
        target: true,
        status: true,
        journey: {
          select: {
            destinationCityId: true,
            groupConversationId: true,
            templateVersion: { select: { template: { select: { nameFr: true } } } },
          },
        },
      },
    });
    if (blocker === null) throw ApiError.notFound();
    if (blocker.status === 'PUBLISHED') this.fail('BLOCKER_ALREADY_PUBLISHED');
    if (blocker.status === 'CANCELLED') this.fail('BLOCKER_CANCELLED');

    let refType: string;
    let refId: string;

    if (input.isPrivate) {
      // §3.5 : « envoi aux SUPPORTER et au parrain via la discussion du parcours,
      // rien de public ». La conversation est recalculée d'abord : elle naît d'un
      // événement, et le relais n'est pas forcément passé.
      const conversationId =
        blocker.journey.groupConversationId ??
        (await this.messaging.syncJourneyConversation(blocker.journeyId));
      if (conversationId === null) throw ApiError.transverse('CONFLICT', { reason: 'NO_CONVERSATION' });

      const sent = await this.messaging.sendMessage({ userId: actor.userId, level: actor.level }, conversationId, {
        body: input.text,
      });
      refType = 'message';
      refId = sent.messageId;
    } else if (blocker.target === 'HELP') {
      // L'entraide applique SES règles — modération, quota, ville fusionnée,
      // échéance héritée de l'étape (06 §2.5). Les recopier ici les ferait
      // diverger.
      const created = await this.help.create(
        { userId: actor.userId, level: actor.level },
        {
          kind: 'REQUEST',
          type: input.helpType ?? 'PAPERWORK',
          title: input.title as string,
          body: input.text,
          cityId: input.cityId ?? blocker.journey.destinationCityId,
          originJourneyStepId: blocker.journeyStepId,
        },
      );
      refType = 'help_request';
      refId = created.request.id;
    } else {
      // HOUSING, JOBS et MENTORSHIP : la publication publique demande des champs
      // que le flux de blocage ne recueille pas (annonce de logement complète,
      // profil de recherche, choix d'un parrain). Non livré, et dit franchement
      // plutôt que publié à moitié.
      this.fail('BLOCKER_TARGET_UNSUPPORTED', { target: blocker.target });
    }

    const now = new Date();
    const promoted = await this.prisma.$transaction(async (tx) => {
      // Conditionné à `DRAFT` : deux publications concurrentes ne peuvent pas
      // marquer deux fois le même brouillon.
      const moved = await tx.blockerRequest.updateMany({
        where: { id: blockerId, status: 'DRAFT' },
        data: {
          status: 'PUBLISHED',
          isPrivate: input.isPrivate,
          draftText: input.text,
          publishedRefType: refType,
          publishedRefId: refId,
          publishedAt: now,
        },
      });
      if (moved.count === 0) return false;

      await this.logActivity(tx, {
        journeyId: blocker.journeyId,
        actorUserId: actor.userId,
        stepId: blocker.journeyStepId,
        type: 'BLOCKER_PUBLISHED',
        refType,
        refId,
        payload: { target: blocker.target, isPrivate: input.isPrivate },
      });
      await tx.journey.update({
        where: { id: blocker.journeyId },
        data: { lastActivityAt: now },
      });

      await this.outbox.emit(tx, {
        type: 'blocker.published',
        aggregateId: blockerId,
        payload: {
          blockerId,
          journeyId: blocker.journeyId,
          journeyStepId: blocker.journeyStepId,
          ownerUserId: actor.userId,
          target: blocker.target,
          isPrivate: input.isPrivate,
          // L'objet cible EXISTE déjà : un consommateur qui voudrait le créer
          // (06 §6, 10 §8 nomment `blocker.published` « création ») verrait ici
          // qu'il n'y a rien à faire. Sans cette référence, un rejeu créerait un
          // doublon.
          publishedRefType: refType,
          publishedRefId: refId,
        },
      });
      return true;
    });

    if (!promoted) this.fail('BLOCKER_ALREADY_PUBLISHED');

    return {
      blocker: {
        id: blockerId,
        status: 'PUBLISHED' as const,
        target: blocker.target,
        isPrivate: input.isPrivate,
        publishedRefType: refType,
        publishedRefId: refId,
        publishedAt: now,
      },
      meta: this.meta(),
    };
  }

  /** `POST /blockers/:id/cancel` (§3.5) : « Annuler » → `CANCELLED`. */
  async cancelBlocker(userId: string, blockerId: string) {
    const cancelled = await this.prisma.blockerRequest.updateMany({
      where: { id: blockerId, status: 'DRAFT', journey: { ownerUserId: userId, deletedAt: null } },
      data: { status: 'CANCELLED' },
    });
    if (cancelled.count === 0) {
      const exists = await this.prisma.blockerRequest.findFirst({
        where: { id: blockerId, journey: { ownerUserId: userId } },
        select: { status: true },
      });
      if (exists === null) throw ApiError.notFound();
      if (exists.status === 'PUBLISHED') this.fail('BLOCKER_ALREADY_PUBLISHED');
    }
    return { id: blockerId, status: 'CANCELLED' as const };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Partage de jalon (§3.6)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * `POST /journeys/:id/steps/:stepId/share` (§3.6) : la publication de victoire,
   * avec le texte du MEMBRE.
   *
   * Aucun texte n'est pré-rédigé, ici ni ailleurs : §3.6 veut « un champ de texte
   * VIDE — c'est le membre qui écrit ». Le corps est donc obligatoire, et il n'y a
   * pas de valeur par défaut à laquelle se rabattre.
   *
   * La publication passe par `FeedService` : quota, modération et rattachement au
   * parcours sont ses règles (04 §2.4).
   */
  async shareMilestone(
    actor: JourneyActor,
    journeyId: string,
    stepId: string,
    input: ShareMilestone,
  ) {
    await this.assertOwned(actor.userId, journeyId);
    const step = await this.prisma.journeyStep.findFirst({
      where: { id: stepId, journeyId },
      select: {
        id: true,
        status: true,
        stepDefinition: { select: { isMajorMilestone: true } },
      },
    });
    if (step === null) throw ApiError.notFound();
    if (step.status !== 'DONE') this.fail('STEP_NOT_DONE');
    // Une étape personnelle n'a pas de définition, donc n'est pas un jalon majeur.
    if (step.stepDefinition?.isMajorMilestone !== true) this.fail('NOT_A_MILESTONE');

    const post = await this.feed.createPost(
      { userId: actor.userId, level: actor.level },
      { type: 'VICTORY', body: input.text, journeyId, journeyStepId: stepId },
    );

    const postId = readPostId(post);
    await this.prisma.$transaction(async (tx) => {
      await this.logActivity(tx, {
        journeyId,
        actorUserId: actor.userId,
        stepId,
        type: 'MILESTONE_SHARED',
        refType: 'post',
        ...(postId === null ? {} : { refId: postId }),
      });
      await tx.journey.update({ where: { id: journeyId }, data: { lastActivityAt: new Date() } });
    });

    return post;
  }

  /**
   * `POST /journeys/:id/steps/:stepId/dismiss-share` (§3.6) : « Décliner →
   * `share_prompt_dismissed_at`, PLUS JAMAIS REPROPOSÉ pour cette étape. »
   *
   * Idempotent, et la date n'est pas réécrite : le premier refus est celui qui
   * compte.
   */
  async dismissShare(userId: string, journeyId: string, stepId: string) {
    await this.assertOwned(userId, journeyId);
    const updated = await this.prisma.journeyStep.updateMany({
      where: { id: stepId, journeyId, sharePromptDismissedAt: null },
      data: { sharePromptDismissedAt: new Date() },
    });
    if (updated.count === 0) {
      const step = await this.prisma.journeyStep.findFirst({
        where: { id: stepId, journeyId },
        select: { sharePromptDismissedAt: true },
      });
      if (step === null) throw ApiError.notFound();
    }
    return { dismissed: true };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Consommateurs d'événements (§7)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * `mentorship.accepted` → le parrain devient SUPPORTER (§3.4, 08 §2.3).
   *
   * IDEMPOTENT : un rejeu ne crée ni seconde ligne, ni seconde activité, ni
   * second événement. La livraison est « au moins une fois », et l'événement
   * `journey.member_joined` que ce gestionnaire émet fait recalculer la
   * conversation du parcours par la messagerie — un doublon y serait visible.
   *
   * La charge est lue DÉFENSIVEMENT : `journeyId` peut être nul (un parrainage
   * sans parcours est permis), et la charge vient du JSON de la base.
   */
  async handleMentorshipAccepted(payload: unknown): Promise<{ added: boolean }> {
    const journeyId = readString(payload, 'journeyId');
    const mentorUserId = readString(payload, 'mentorUserId');
    if (journeyId === null || mentorUserId === null) return { added: false };

    const journey = await this.prisma.journey.findFirst({
      where: { id: journeyId, deletedAt: null },
      select: { id: true, ownerUserId: true },
    });
    if (journey === null) return { added: false };
    if (journey.ownerUserId === mentorUserId) return { added: false };
    // Un blocage survenu entre-temps interdit l'entrée dans l'équipe (§3.4 :
    // « un blocage retire automatiquement »).
    if (await this.visibility.isSeparated(journey.ownerUserId, mentorUserId)) {
      return { added: false };
    }

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.journeyMember.findUnique({
        where: { journeyId_userId: { journeyId, userId: mentorUserId } },
        select: { status: true, role: true },
      });

      if (existing?.status === 'ACTIVE' && existing.role === 'SUPPORTER') {
        return { added: false };
      }

      if (existing === null) {
        await tx.journeyMember.create({
          data: {
            id: newId(),
            journeyId,
            userId: mentorUserId,
            role: 'SUPPORTER',
            // §4 : « Le parrain actif est inséré avec `role = SUPPORTER`,
            // `invited_by_user_id` = propriétaire. »
            invitedByUserId: journey.ownerUserId,
            status: 'ACTIVE',
            acceptedAt: now,
          },
        });
      } else {
        await tx.journeyMember.update({
          where: { journeyId_userId: { journeyId, userId: mentorUserId } },
          data: { role: 'SUPPORTER', status: 'ACTIVE', acceptedAt: now, removedAt: null },
        });
      }

      await this.logActivity(tx, {
        journeyId,
        actorUserId: mentorUserId,
        type: 'MEMBER_JOINED',
        payload: { userId: mentorUserId, role: 'SUPPORTER', via: 'MENTORSHIP' },
      });
      await this.outbox.emit(tx, {
        type: 'journey.member_joined',
        aggregateId: journeyId,
        payload: { journeyId, userId: mentorUserId, role: 'SUPPORTER', via: 'MENTORSHIP' },
      });
      return { added: true };
    });
  }

  /**
   * `user.blocked` → §3.4 : « Un blocage retire automatiquement. »
   *
   * Dans les DEUX sens : celui qui a bloqué ne doit pas rester dans l'équipe de
   * l'autre, et réciproquement. `updateMany` conditionné à `removed_at: null`
   * rend le gestionnaire idempotent, et l'événement de retrait n'est émis que pour
   * les parcours réellement touchés.
   */
  async handleUserBlocked(blockerUserId: string, blockedUserId: string): Promise<{ removed: number }> {
    const memberships = await this.prisma.journeyMember.findMany({
      where: {
        removedAt: null,
        OR: [
          { userId: blockedUserId, journey: { ownerUserId: blockerUserId } },
          { userId: blockerUserId, journey: { ownerUserId: blockedUserId } },
        ],
      },
      select: { journeyId: true, userId: true },
    });
    if (memberships.length === 0) return { removed: 0 };

    const now = new Date();
    let removed = 0;
    for (const membership of memberships) {
      await this.prisma.$transaction(async (tx) => {
        const moved = await tx.journeyMember.updateMany({
          where: { journeyId: membership.journeyId, userId: membership.userId, removedAt: null },
          data: { status: 'REMOVED', removedAt: now },
        });
        if (moved.count === 0) return;
        removed += moved.count;
        await this.outbox.emit(tx, {
          type: 'journey.member_removed',
          aggregateId: membership.journeyId,
          payload: {
            journeyId: membership.journeyId,
            userId: membership.userId,
            reason: 'BLOCKED',
          },
        });
      });
    }
    return { removed };
  }

  /**
   * `help_request.resolved` → activité HELP_RECEIVED sur l'étape (§3.5, 06 §2.5).
   *
   * « Quand la demande d'entraide issue d'un blocage est résolue, l'étape reçoit
   * une activité `HELP_RECEIVED` et l'interface propose "Marquer l'étape comme
   * franchie ?" » — la PROPOSITION est portée par l'activité, jamais appliquée
   * ici : ce module ne franchit pas une étape au nom du membre.
   *
   * IDEMPOTENT par une recherche d'activité de même `ref_id` : la table n'a pas de
   * contrainte d'unicité sur laquelle s'appuyer.
   */
  async handleHelpRequestResolved(helpRequestId: string): Promise<{ logged: boolean }> {
    const request = await this.prisma.helpRequest.findUnique({
      where: { id: helpRequestId },
      select: {
        id: true,
        originJourneyStepId: true,
        originJourneyStep: { select: { journeyId: true } },
      },
    });
    if (request === null || request.originJourneyStepId === null) return { logged: false };
    const journeyId = request.originJourneyStep?.journeyId;
    if (journeyId === undefined) return { logged: false };

    const already = await this.prisma.journeyActivity.findFirst({
      where: { journeyId, type: 'HELP_RECEIVED', refType: 'help_request', refId: helpRequestId },
      select: { id: true },
    });
    if (already !== null) return { logged: false };

    await this.prisma.$transaction(async (tx) => {
      await this.logActivity(tx, {
        journeyId,
        stepId: request.originJourneyStepId as string,
        type: 'HELP_RECEIVED',
        refType: 'help_request',
        refId: helpRequestId,
        payload: { proposeStepDone: true },
      });
    });
    return { logged: true };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Outils
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Le parcours, s'il est à moi. `404` et non `403` : un identifiant de parcours
   * qui n'est pas le mien ne doit même pas révéler qu'il existe (T4 §3).
   */
  // ══ Les trois tâches planifiées du §8 ═════════════════════════════════════
  //
  // Elles sont PUBLIQUES, prennent `now` en paramètre et ne connaissent pas
  // l'ordonnanceur : c'est le contrat que `queue/scheduled-tasks.ts` impose, et
  // c'est ce qui les rend éprouvables sans Redis ni BullMQ.
  //
  // POURQUOI ELLES APPELLENT `NotificationsService` EN DIRECT, alors que §3.3
  // interdit l'appel direct pour les effets de bord : la règle vise un service qui
  // MODIFIE L'ÉTAT et voudrait notifier dans la foulée — là, l'événement de domaine
  // est le seul moyen de ne rien perdre si la transaction échoue. Ici, il n'y a
  // aucun changement d'état à accompagner : §8 attribue la notification À LA TÂCHE
  // elle-même (« Notifications J−14, J−7, J−1 »), et §7 ne déclare AUCUN événement
  // pour une échéance. Émettre un type inventé, sans consommateur, est exactement ce
  // que le catalogue de `outbox.service.ts` refuse ligne après ligne. C'est aussi la
  // forme que `notifications.weekly_digest` et `notifications.quiet_hours_flush`
  // emploient déjà : une tâche dont le travail EST l'envoi.

  /**
   * `journey.reminders` — horaire (§8) : « Notifications J−14, J−7, J−1 sur `due_date` ».
   *
   * L'IDEMPOTENCE NE VIENT PAS D'UNE COLONNE, et c'est un choix qu'il faut dire :
   * elle vient de `NotificationsService.deliver()`, qui déduplique sur
   * (membre, type, `ref_type`, `ref_id`) SANS fenêtre quand la catégorie n'a pas de
   * règle de regroupement — ce qui est le cas de `JOURNEY_DEADLINE`. Le second
   * passage rend `DUPLICATE`, n'écrit ni notification ni `outbound_message`, et ne
   * met rien en file. Une colonne `reminder_sent_at` aurait fait la même chose en
   * moins bien : elle aurait porté UNE date pour TROIS échéances, et il aurait fallu
   * la remettre à zéro à chaque changement d'échéance.
   *
   * D'où le TYPE distinct par échéance (`journey.step_due_j14`, `_j7`, `_j1`) : c'est
   * lui qui porte la distinction dans la clé de déduplication. Un type unique aurait
   * fait taire J−7 et J−1 après l'envoi de J−14.
   *
   * `journey.step_due_j1` n'est pas un nom libre : c'est celui que la matrice du
   * §2.1 de 12-notifications donne à la SEULE échéance qui part aussi par courriel
   * (`CATEGORY_CHANNELS.JOURNEY_DEADLINE.email`). Le renommer couperait l'envoi
   * sans rien casser d'autre — donc en silence.
   *
   * Le destinataire est le PROPRIÉTAIRE seul. L'équipe du parcours (§3.6) a sa
   * propre catégorie, `JOURNEY_TEAM`, et une échéance de checklist n'est pas son
   * affaire : la spec ne lui promet rien ici, et on ne lui invente pas d'envoi.
   */
  async sendDueReminders(now: Date = new Date()): Promise<{ notified: number; skipped: number }> {
    let notified = 0;
    let skipped = 0;

    for (const days of JOURNEY_REMINDER_DAYS) {
      // `due_date` est un `DATE` : la comparaison porte sur la JOURNÉE, pas sur
      // l'instant. La borne est donc [minuit du jour visé, minuit du lendemain), et
      // les vingt-quatre tirs horaires de la journée visent le même ensemble — ce
      // qui est exactement ce qu'on veut, la déduplication faisant le reste.
      const target = startOfUtcDay(new Date(now.getTime() + days * 86_400_000));
      const nextDay = new Date(target.getTime() + 86_400_000);

      const steps = await this.prisma.journeyStep.findMany({
        where: {
          dueDate: { gte: target, lt: nextDay },
          // Une étape franchie n'a plus d'échéance qui vaille, et une étape en pause
          // non plus : §3.2 en fait un état assumé, pas un retard à rappeler.
          status: { in: ['TODO', 'IN_PROGRESS'] },
          journey: { status: 'ACTIVE', deletedAt: null },
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          journeyId: true,
          journey: { select: { ownerUserId: true, title: true } },
        },
        // Bornée (`scheduled-tasks.ts`) : un balayage sans `take` tiendrait son
        // verrou pendant toute la table.
        take: 500,
      });

      for (const step of steps) {
        const result = await this.notifications.deliver({
          userId: step.journey.ownerUserId,
          category: 'JOURNEY_DEADLINE',
          type: `journey.step_due_j${days}`,
          title:
            days === 1
              ? `« ${step.title} » est à faire demain`
              : `« ${step.title} » est à faire dans ${days} jours`,
          body: formatDueDate(step.dueDate, now),
          refType: 'JOURNEY_STEP',
          refId: step.id,
          url: `/parcours/${step.journeyId}`,
        });
        if (result.outcome === 'CREATED') notified += 1;
        else skipped += 1;
      }
    }

    return { notified, skipped };
  }

  /**
   * `journey.inactivity_check` — quotidienne (§8) : « Relance unique à 60 jours
   * sans activité ».
   *
   * « UNIQUE » est le mot qui porte tout, et il a déjà sa colonne :
   * `journeys.inactivity_prompt_sent_at`. §3.9 : « une notification unique “Où en
   * êtes-vous ?” […] Aucune relance ensuite. » Le filtre
   * `inactivityPromptSentAt: null` la relit : un second passage ne trouve plus le
   * parcours, quel que soit le `now`.
   *
   * ELLE NE TOUCHE PAS `last_activity_at`. C'est le piège de cette tâche : marquer
   * l'envoi comme une activité remettrait le compteur des soixante jours à zéro, et
   * la relance repartirait pour un tour dans deux mois — c'est-à-dire l'inverse
   * exact de « aucune relance ensuite ». Seule la RÉPONSE du membre
   * (`POST /inactivity-response`) est une activité.
   *
   * La réponse, elle, existait déjà ; c'est son DÉCLENCHEUR qui manquait. Sans lui,
   * l'écran de relance n'était jamais montré à personne et les quatre réponses de
   * §3.9 étaient injoignables.
   */
  async runInactivityCheck(now: Date = new Date()): Promise<{ prompted: number }> {
    const cutoff = new Date(now.getTime() - JOURNEY_INACTIVITY_DAYS * 86_400_000);

    const stale = await this.prisma.journey.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        inactivityPromptSentAt: null,
        lastActivityAt: { lt: cutoff },
      },
      select: { id: true, ownerUserId: true, title: true },
      take: 500,
    });

    let prompted = 0;
    for (const journey of stale) {
      // Le MARQUAGE d'abord, l'envoi ensuite. Dans l'autre ordre, un échec entre les
      // deux renverrait la relance au passage suivant — et « unique » ne tiendrait
      // qu'aussi longtemps que la base et la file restent debout ensemble.
      //
      // La condition `null` est REPRISE dans le `where` de l'écriture : deux workers
      // qui liraient le même lot n'écriraient qu'une fois, et seul celui dont
      // `count` vaut 1 notifie.
      const { count } = await this.prisma.journey.updateMany({
        where: { id: journey.id, inactivityPromptSentAt: null },
        data: { inactivityPromptSentAt: now },
      });
      if (count === 0) continue;

      await this.notifications.deliver({
        userId: journey.ownerUserId,
        category: 'JOURNEY_DEADLINE',
        type: 'journey.inactivity_prompt',
        title: 'Où en êtes-vous ?',
        body: `Votre parcours « ${journey.title} » n’a pas bougé depuis ${JOURNEY_INACTIVITY_DAYS} jours.`,
        refType: 'JOURNEY',
        refId: journey.id,
        url: `/parcours/${journey.id}`,
      });
      prompted += 1;
    }

    return { prompted };
  }

  /**
   * `journey.progress_recompute` — quotidienne (§8) : « Sécurité : recalcule
   * `progress_pct` et `current_step_id` ».
   *
   * « SÉCURITÉ » dit ce qu'elle est : les deux colonnes sont déjà écrites par
   * `recomputeState` à chaque action d'étape. Cette tâche existe pour le cas où une
   * écriture a manqué — une transaction annulée après l'étape mais avant le
   * recalcul, une donnée corrigée à la main, une migration.
   *
   * ELLE NE PEUT DONC PAS COMPTER : elle RECALCULE depuis les étapes, exactement
   * comme `recomputeState`, et réécrit. C'est la propriété que le test d'idempotence
   * de l'ordonnanceur traque — « un balayage qui recalcule une valeur dérivée du
   * temps écoulé et l'AJOUTE au lieu de la remplacer ». Ici rien ne dérive du temps :
   * `progress_pct` est un rapport d'étapes, et deux passages au même instant comme à
   * un instant plus tard rendent la même valeur.
   *
   * `now` sert à UNE chose, et il faut la nommer : la date de complétion d'un
   * parcours que le recalcul achève. `recomputeState` y mettait `new Date()`, ce qui
   * est acceptable dans une requête HTTP et ne l'est pas dans une tâche — l'instant
   * du créneau est celui que le planificateur passe, et une tâche qui lit l'horloge
   * murale n'est plus éprouvable.
   *
   * Les parcours sont traités UN PAR UN, une transaction chacun : un `UPDATE` unique
   * en SQL brut serait plus rapide et devrait répliquer la règle des étapes
   * optionnelles, celle de l'étape en cours et l'émission de `journey.completed` —
   * trois règles en double, dont la copie divergerait au premier ajustement.
   */
  async recomputeAllProgress(now: Date = new Date()): Promise<{ scanned: number; changed: number }> {
    const journeys = await this.prisma.journey.findMany({
      where: { deletedAt: null, status: { in: ['ACTIVE', 'COMPLETED', 'PAUSED'] } },
      select: { id: true, progressPct: true, currentStepId: true },
      orderBy: { createdAt: 'asc' },
      take: 1_000,
    });

    let changed = 0;
    for (const journey of journeys) {
      const after = await this.recomputeState(journey.id, now);
      if (
        after.progressPct !== journey.progressPct ||
        after.currentStepId !== journey.currentStepId
      ) {
        changed += 1;
      }
    }

    return { scanned: journeys.length, changed };
  }

  private async assertOwned(userId: string, journeyId: string) {
    const journey = await this.prisma.journey.findFirst({
      where: { id: journeyId, ownerUserId: userId, deletedAt: null },
      select: {
        id: true,
        status: true,
        visibility: true,
        templateVersionId: true,
        destinationCityId: true,
        destinationCity: { select: { name: true } },
        templateVersion: { select: { template: { select: { nameFr: true, code: true } } } },
      },
    });
    if (journey === null) throw ApiError.notFound();
    return {
      ...journey,
      templateName: journey.templateVersion.template.nameFr,
      destinationCityName: journey.destinationCity.name,
    };
  }

  /**
   * Le parcours vu par ce lecteur, avec son rôle.
   *
   * §5.1 annonce `403` « si ni propriétaire ni membre » ; on ne le donne qu'à un
   * lecteur qui n'est SÉPARÉ de personne — un blocage rend le parcours
   * introuvable (404), parce que répondre 403 confirmerait son existence à
   * quelqu'un dont on s'est séparé.
   */
  private async loadForViewer(userId: string, journeyId: string) {
    const journey = await this.prisma.journey.findFirst({
      where: { id: journeyId, deletedAt: null },
      select: {
        id: true,
        title: true,
        status: true,
        visibility: true,
        progressPct: true,
        currentStepId: true,
        targetArrivalDate: true,
        completedAt: true,
        groupConversationId: true,
        inactivityPromptSentAt: true,
        ownerUserId: true,
        owner: { select: MEMBER_USER_SELECT },
        templateVersion: {
          select: { version: true, template: { select: { code: true, nameFr: true, icon: true } } },
        },
        destinationCity: { select: { id: true, name: true } },
        originCountry: { select: { id: true, iso2: true, nameFr: true } },
        steps: { select: STEP_SELECT },
        members: {
          where: { userId, removedAt: null },
          select: { role: true, status: true },
        },
      },
    });
    if (journey === null) throw ApiError.notFound();

    if (journey.ownerUserId === userId) return { ...journey, viewerRole: 'OWNER' as const };

    if (await this.visibility.isSeparated(userId, journey.ownerUserId)) throw ApiError.notFound();

    const membership = journey.members.find((m) => m.status === 'ACTIVE');
    if (membership === undefined) throw ApiError.transverse('FORBIDDEN');
    return { ...journey, viewerRole: membership.role as ViewerRole };
  }

  /** Une étape compte dans la progression sauf si le modèle la dit optionnelle (§3.2). */
  private countsForProgress(step: { templateStep: { isOptional: boolean } | null }): boolean {
    return step.templateStep?.isOptional !== true;
  }

  /**
   * Recalcule `progress_pct`, `current_step_id` et l'état de fin — la tâche
   * `journey.progress_recompute` (§8) fait la même chose, par sécurité.
   *
   * `progress_pct` = étapes DONE / étapes NON OPTIONNELLES × 100, arrondi (§3.2).
   * Le numérateur ne compte que les étapes non optionnelles : sinon cocher trois
   * étapes facultatives donnerait 120 %, et la barre du panneau d'accueil
   * dépasserait.
   *
   * Recalculer plutôt qu'incrémenter est délibéré : un compteur dénormalisé
   * incrémenté hors de la transaction qui crée la ligne finit toujours par
   * compter deux fois (deux modules s'y sont pris).
   *
   * `now` EST UN PARAMÈTRE, avec l'heure système par défaut. Il ne sert qu'à une
   * chose — dater la complétion d'un parcours que ce recalcul achève — mais cette
   * chose est écrite en base, et une TÂCHE PLANIFIÉE doit pouvoir la dater à
   * l'instant de son créneau. Un `new Date()` en dur ici faisait de
   * `recomputeAllProgress` une tâche qui lit l'horloge murale, c'est-à-dire une
   * tâche qu'aucun test ne peut mettre à l'épreuve à un instant choisi.
   */
  private async recomputeState(
    journeyId: string,
    now: Date = new Date(),
  ): Promise<{ progressPct: number; doneCount: number; currentStepId: string | null }> {
    return this.prisma.$transaction(async (tx) => {
      const journey = await tx.journey.findUnique({
        where: { id: journeyId },
        select: { status: true, completedAt: true },
      });
      if (journey === null) return { progressPct: 0, doneCount: 0, currentStepId: null };

      const steps = await tx.journeyStep.findMany({
        where: { journeyId },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          status: true,
          position: true,
          templateStep: { select: { isOptional: true } },
        },
      });

      const counted = steps.filter((s) => this.countsForProgress(s));
      const done = counted.filter((s) => s.status === 'DONE');
      const progressPct =
        counted.length === 0 ? 0 : Math.round((done.length / counted.length) * 100);

      // §3.2 : l'étape en cours est celle qui l'est ; à défaut, la première qui
      // reste à faire — c'est elle que la carte du panneau met en avant.
      const current =
        steps.find((s) => s.status === 'IN_PROGRESS') ??
        steps.find((s) => s.status === 'TODO') ??
        steps.find((s) => s.status === 'PAUSED') ??
        null;

      // « Si dernière étape : `journeys.status = COMPLETED` » (§3.2). Lu comme :
      // toutes les étapes qui comptent sont franchies. Le parcours ne se
      // ré-ouvre pas tout seul s'il était arrêté — seul un ACTIVE s'achève.
      const shouldComplete = counted.length > 0 && done.length === counted.length;
      const status =
        shouldComplete && journey.status === 'ACTIVE'
          ? ('COMPLETED' as const)
          : !shouldComplete && journey.status === 'COMPLETED'
            ? ('ACTIVE' as const)
            : null;

      await tx.journey.update({
        where: { id: journeyId },
        data: {
          progressPct,
          currentStepId: current?.id ?? null,
          ...(status === null ? {} : { status }),
          ...(status === 'COMPLETED' ? { completedAt: journey.completedAt ?? now } : {}),
          ...(status === 'ACTIVE' ? { completedAt: null } : {}),
        },
      });

      if (status === 'COMPLETED') {
        await this.outbox.emit(tx, {
          type: 'journey.completed',
          aggregateId: journeyId,
          payload: { journeyId, progressPct, stepCount: counted.length },
        });
      }

      return { progressPct, doneCount: done.length, currentStepId: current?.id ?? null };
    });
  }

  /** Une ligne de journal (§3.8). Toujours dans la transaction de l'action. */
  private async logActivity(
    tx: Prisma.TransactionClient,
    entry: {
      journeyId: string;
      type: 'STEP_STARTED' | 'STEP_DONE' | 'STEP_PAUSED' | 'BLOCKER_PUBLISHED' | 'HELP_RECEIVED' | 'MEMBER_JOINED' | 'MILESTONE_SHARED' | 'NOTE';
      actorUserId?: string;
      stepId?: string;
      refType?: string;
      refId?: string;
      payload?: Prisma.InputJsonValue;
    },
  ): Promise<void> {
    await tx.journeyActivity.create({
      data: {
        id: newId(),
        journeyId: entry.journeyId,
        ...(entry.actorUserId === undefined ? {} : { actorUserId: entry.actorUserId }),
        ...(entry.stepId === undefined ? {} : { journeyStepId: entry.stepId }),
        type: entry.type,
        ...(entry.refType === undefined ? {} : { refType: entry.refType }),
        ...(entry.refId === undefined ? {} : { refId: entry.refId }),
        ...(entry.payload === undefined ? {} : { payload: entry.payload }),
      },
    });
  }
}

// ── Fonctions libres ────────────────────────────────────────────────────────

/**
 * Les transitions du tableau de §3.2, plus `TODO → DONE`.
 *
 * `TODO → DONE` n'est pas dans le tableau, mais la règle de durée du même
 * paragraphe la suppose explicitement (« ou depuis la clôture de l'étape
 * précédente si JAMAIS DÉMARRÉE ») : un membre qui coche une étape sans l'avoir
 * ouverte est le cas courant, pas l'exception.
 *
 * Aucune transition ne mène à un état d'échec : il n'en existe pas (règle dure).
 */
function isAllowedTransition(from: string, to: string): boolean {
  const allowed: Record<string, readonly string[]> = {
    TODO: ['IN_PROGRESS', 'DONE'],
    IN_PROGRESS: ['DONE', 'PAUSED', 'TODO'],
    PAUSED: ['IN_PROGRESS'],
    DONE: ['IN_PROGRESS'],
  };
  return (allowed[from] ?? []).includes(to);
}

/** Jours entiers écoulés, jamais négatifs. */
function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
}

/** `target − days`, en date pure (la colonne est un `DATE`). */
function minusDays(date: Date, days: number): Date {
  return new Date(date.getTime() - days * 86_400_000);
}

/**
 * Minuit UTC du jour de cet instant.
 *
 * `journey_steps.due_date` est un `DATE` : PostgreSQL le rend à minuit UTC, et
 * Prisma compare donc un instant à un instant. Sans cette troncature, la borne
 * d'un « J−14 » serait « dans exactement 14 × 86 400 secondes », c'est-à-dire une
 * borne qui GLISSE d'heure en heure — et `journey.reminders` tourne toutes les
 * heures. Une étape échue le 14 mars serait alors rappelée à 9 h et plus à 10 h,
 * selon l'heure du tir. Tronquer au jour rend les vingt-quatre tirs de la journée
 * équivalents, ce qui est la seule lecture cohérente d'une échéance en jours.
 */
function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** `{echeance}` du gabarit : « dans 9 jours », « aujourd'hui », « sans échéance ». */
function formatDueDate(dueDate: Date | null, now: Date = new Date()): string {
  if (dueDate === null) return 'sans échéance';
  const days = Math.round((dueDate.getTime() - now.getTime()) / 86_400_000);
  if (days === 0) return 'aujourd’hui';
  if (days < 0) return 'déjà dépassée';
  if (days === 1) return 'demain';
  return `dans ${days} jours`;
}

/** Comparaison lexicographique de deux vecteurs de rang. */
function compareRanks(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Les surcharges d'un `template_step` (colonne `Json?`), lues défensivement. */
function readOverrides(value: Prisma.JsonValue | null): { name?: string; description?: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const name = record['name'] ?? record['nameFr'];
  const description = record['description'];
  return {
    ...(typeof name === 'string' && name.length > 0 ? { name } : {}),
    ...(typeof description === 'string' && description.length > 0 ? { description } : {}),
  };
}

/**
 * L'identifiant de la publication rendue par le fil. Lu défensivement : la forme
 * de `postDetail` appartient au module 04, et une clé renommée là-bas ne doit pas
 * faire échouer un partage de jalon déjà publié.
 */
function readPostId(detail: unknown): string | null {
  if (typeof detail !== 'object' || detail === null) return null;
  const record = detail as Record<string, unknown>;
  const direct = record['id'];
  if (typeof direct === 'string') return direct;
  const post = record['post'];
  if (typeof post === 'object' && post !== null) {
    const nested = (post as Record<string, unknown>)['id'];
    if (typeof nested === 'string') return nested;
  }
  return null;
}

/** Une chaîne d'une charge d'événement, ou `null`. Le JSON de la base est `unknown`. */
function readString(payload: unknown, key: string): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
