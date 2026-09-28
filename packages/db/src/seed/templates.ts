import { Prisma, type PrismaClient } from '../../generated/client/index.js';
import { newId } from '../uuid.js';
import {
  JOURNEY_TEMPLATES,
  STEP_DEFINITIONS,
  type JourneyTemplateSeed,
  type StepOverridesSeed,
} from './journeys.js';

/**
 * Chargement des modèles de parcours (T3 partie A) — la partie du seed qui a de
 * la STRUCTURE, et donc des règles à respecter.
 *
 * ─── Pourquoi ce n'est pas un `upsert` de plus ───────────────────────────────
 *
 * Deux index uniques PARTIELS existent en base, posés par la migration
 * `20260927050000_hard_rules_constraints` et ABSENTS des fichiers
 * `prisma/schema/*.prisma` (Prisma ne sait pas les décrire) :
 *
 *   journey_template_versions_one_published_per_country
 *     ON (template_id, origin_country_id) WHERE status = 'PUBLISHED' AND origin_country_id IS NOT NULL
 *   journey_template_versions_one_published_generic
 *     ON (template_id)                    WHERE status = 'PUBLISHED' AND origin_country_id IS NULL
 *
 * Ils tiennent la règle dure 03 §2.2 (« une seule version publiée par (type,
 * pays) »). Conséquence directe sur ce fichier : on ne peut JAMAIS avoir deux
 * lignes PUBLISHED pour un même couple, même une fraction de seconde. Publier une
 * nouvelle version se fait donc en une seule transaction — archiver, puis publier.
 * L'ordre inverse, ou deux transactions, donne un `P2002`.
 *
 * ─── Pourquoi une signature de composition ──────────────────────────────────
 *
 * Rejouer le seed ne doit ni dupliquer ni faire TOURNER les identifiants : un
 * `journeys.template_version_id` figé pointe sur une version précise (règle dure
 * 03 §2.2, « publier une version ne modifie jamais un journey existant »), et
 * republier pour rien ferait croire à tous les parcours en cours que « la
 * procédure a évolué ». On compare donc la composition attendue à celle en base ;
 * identiques, on ne touche à rien.
 */

/** Une étape de version, prête à écrire. */
interface CompositionStep {
  definitionCode: string;
  isOptional: boolean;
  daysBeforeArrival: number | null;
  /** Surcharge locale (T3 A.3), ou null. */
  overrides: StepOverridesSeed | null;
}

/** Une dépendance, exprimée en POSITIONS — les identifiants n'existent pas encore. */
interface CompositionDependency {
  position: number;
  dependsOnPosition: number;
}

interface Composition {
  steps: CompositionStep[];
  dependencies: CompositionDependency[];
}

export type VersionOutcome = 'inchangée' | 'publiée' | 'republiée';

export interface TemplatesSeedReport {
  definitions: number;
  templates: number;
  versions: { templateCode: string; originIso2: string | null; outcome: VersionOutcome }[];
}

/**
 * La composition d'une version : la liste ordonnée des étapes et les dépendances
 * en positions. `overrides` n'est posé que sur les étapes que la déclinaison
 * surcharge (T3 A.3) ; les autres restent identiques à la version générique.
 */
function compose(
  template: JourneyTemplateSeed,
  overridesByCode: Record<string, StepOverridesSeed>,
): Composition {
  const steps: CompositionStep[] = template.steps.map((step) => ({
    definitionCode: step.code,
    isOptional: step.isOptional,
    daysBeforeArrival: step.daysBeforeArrival,
    overrides: overridesByCode[step.code] ?? null,
  }));

  const dependencies: CompositionDependency[] = [];
  for (const [index, step] of template.steps.entries()) {
    for (const dependsOnPosition of step.dependsOn) {
      dependencies.push({ position: index + 1, dependsOnPosition });
    }
  }
  return { steps, dependencies };
}

/**
 * La description portée par un `overrides` en base, ou null.
 *
 * Lu défensivement : la colonne est un `jsonb` administrable, et une forme
 * inattendue doit donner « pas de surcharge », pas une exception au milieu du
 * chargement.
 */
function overrideDescription(value: Prisma.JsonValue | null): string | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const description = (value as Record<string, unknown>)['description'];
  return typeof description === 'string' && description.length > 0 ? description : null;
}

/**
 * La signature canonique d'une composition. Deux versions de même signature ont
 * les mêmes étapes, dans le même ordre, avec les mêmes décalages, les mêmes
 * caractères optionnels, les mêmes surcharges et les mêmes dépendances.
 *
 * Les dépendances sont TRIÉES : `step_dependencies` n'a pas d'ordre, et une
 * signature sensible à l'ordre de lecture republierait au hasard.
 */
function signature(composition: Composition): string {
  const steps = composition.steps.map((step, index) => [
    index + 1,
    step.definitionCode,
    step.isOptional,
    step.daysBeforeArrival,
    step.overrides?.description ?? null,
  ]);
  const dependencies = composition.dependencies
    .map((dependency) => [dependency.position, dependency.dependsOnPosition] as const)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return JSON.stringify({ steps, dependencies });
}

/** La composition réellement en base pour une version, relue pour comparaison. */
async function readComposition(prisma: PrismaClient, versionId: string): Promise<Composition> {
  const rows = await prisma.templateStep.findMany({
    where: { templateVersionId: versionId },
    orderBy: { position: 'asc' },
    select: {
      id: true,
      position: true,
      isOptional: true,
      daysBeforeArrival: true,
      overrides: true,
      stepDefinition: { select: { code: true } },
    },
  });
  const dependencyRows = await prisma.stepDependency.findMany({
    where: { templateVersionId: versionId },
    select: { stepId: true, dependsOnStepId: true },
  });

  const positionById = new Map(rows.map((row) => [row.id, row.position]));
  const dependencies: CompositionDependency[] = [];
  for (const dependency of dependencyRows) {
    const position = positionById.get(dependency.stepId);
    const dependsOnPosition = positionById.get(dependency.dependsOnStepId);
    // Une dépendance qui sort de la version relue est une incohérence : on la
    // laisse manquer, la signature différera et la version sera republiée.
    if (position === undefined || dependsOnPosition === undefined) continue;
    dependencies.push({ position, dependsOnPosition });
  }

  return {
    steps: rows.map((row) => {
      const description = overrideDescription(row.overrides);
      return {
        definitionCode: row.stepDefinition.code,
        isOptional: row.isOptional,
        daysBeforeArrival: row.daysBeforeArrival,
        overrides: description === null ? null : { description },
      };
    }),
    dependencies,
  };
}

/**
 * La bibliothèque des définitions (T3 A.1), par `code`.
 *
 * `description` et `guide_id` sont ABSENTS de l'`update` : T3 ne donne aucune
 * description (les procédures vivent dans les guides communautaires) et le guide
 * lié est posé par le back-office. Les écraser à chaque rechargement effacerait
 * le seul travail éditorial fait sur ces lignes. Tout le reste vient du tableau
 * A.1 et doit se propager : corriger une durée dans la spec doit corriger la base.
 */
export async function seedStepDefinitions(prisma: PrismaClient): Promise<Map<string, string>> {
  const idByCode = new Map<string, string>();
  for (const definition of STEP_DEFINITIONS) {
    const row = await prisma.stepDefinition.upsert({
      where: { code: definition.code },
      update: {
        nameFr: definition.nameFr,
        category: definition.category,
        defaultDurationDays: definition.defaultDurationDays,
        blockerTarget: definition.blockerTarget,
        isMajorMilestone: definition.isMajorMilestone,
        isRisky: definition.isRisky,
        documentChecklist: definition.documentChecklist,
      },
      create: { id: newId(), ...definition },
      select: { id: true },
    });
    idByCode.set(definition.code, row.id);
  }
  return idByCode;
}

/**
 * Publie une version si, et seulement si, sa composition diffère de celle
 * publiée. L'archivage et la publication se font dans la MÊME transaction, sans
 * quoi les index uniques partiels refusent l'écriture (`P2002`).
 */
async function publishVersion(
  prisma: PrismaClient,
  options: {
    templateId: string;
    originCountryId: string | null;
    composition: Composition;
    definitionIds: Map<string, string>;
  },
): Promise<VersionOutcome> {
  const { templateId, originCountryId, composition, definitionIds } = options;

  // `originCountryId: null` est écrit EXPLICITEMENT : Prisma le traduit en
  // `IS NULL`. Un filtre qui l'omettrait rendrait la version générique ET les
  // déclinaisons, et la première version publiée trouvée serait tirée au sort.
  const published = await prisma.journeyTemplateVersion.findFirst({
    where: { templateId, originCountryId, status: 'PUBLISHED' },
    orderBy: { version: 'desc' },
    select: { id: true, version: true },
  });

  if (published !== null) {
    const current = await readComposition(prisma, published.id);
    if (signature(current) === signature(composition)) return 'inchangée';
  }

  const highest = await prisma.journeyTemplateVersion.aggregate({
    where: { templateId, originCountryId },
    _max: { version: true },
  });
  const nextVersion = (highest._max.version ?? 0) + 1;
  const publishedAt = new Date();

  await prisma.$transaction(async (tx) => {
    // Archiver D'ABORD. L'index partiel ne tolère pas deux PUBLISHED, même le
    // temps d'une instruction : insérer avant d'archiver donne `P2002`.
    if (published !== null) {
      await tx.journeyTemplateVersion.update({
        where: { id: published.id },
        data: { status: 'ARCHIVED' },
      });
    }

    const version = await tx.journeyTemplateVersion.create({
      data: {
        id: newId(),
        templateId,
        originCountryId,
        version: nextVersion,
        status: 'PUBLISHED',
        publishedAt,
        // Aucun changelog en version 1 : personne n'est sur une version
        // antérieure, et « la procédure a évolué » serait faux.
        ...(published === null
          ? {}
          : {
              changelog:
                'Modèle rechargé depuis les données de départ (T3 partie A). ' +
                'Les parcours en cours restent sur leur version.',
            }),
      },
      select: { id: true },
    });

    const stepIdByPosition = new Map<number, string>();
    const stepRows = composition.steps.map((step, index) => {
      const position = index + 1;
      const stepDefinitionId = definitionIds.get(step.definitionCode);
      if (stepDefinitionId === undefined) {
        throw new Error(`Définition d’étape inconnue : ${step.definitionCode}`);
      }
      const id = newId();
      stepIdByPosition.set(position, id);
      return {
        id,
        templateVersionId: version.id,
        stepDefinitionId,
        position,
        isOptional: step.isOptional,
        daysBeforeArrival: step.daysBeforeArrival,
        // `Prisma.DbNull` et non `null` : sur une colonne `Json?`, `null` désigne
        // le JSON `null` et non l'absence de valeur.
        overrides: step.overrides === null ? Prisma.DbNull : { ...step.overrides },
      };
    });
    await tx.templateStep.createMany({ data: stepRows });

    const dependencyRows = composition.dependencies.map((dependency) => {
      const stepId = stepIdByPosition.get(dependency.position);
      const dependsOnStepId = stepIdByPosition.get(dependency.dependsOnPosition);
      if (stepId === undefined || dependsOnStepId === undefined) {
        throw new Error(
          `Dépendance hors bornes : ${dependency.position} ← ${dependency.dependsOnPosition}`,
        );
      }
      return { id: newId(), templateVersionId: version.id, stepId, dependsOnStepId };
    });
    if (dependencyRows.length > 0) {
      await tx.stepDependency.createMany({ data: dependencyRows });
    }
  });

  return published === null ? 'publiée' : 'republiée';
}

/**
 * Charge la bibliothèque, les quatre types et leurs versions publiées.
 *
 * IDEMPOTENT : `is_active`, `description` et `icon` des types ne sont pas mis à
 * jour — activer ou masquer un type est une décision produit prise en
 * back-office, qu'un rechargement ne doit pas annuler (même règle que les pays,
 * 02 §2.1).
 */
export async function seedJourneyTemplates(prisma: PrismaClient): Promise<TemplatesSeedReport> {
  const definitionIds = await seedStepDefinitions(prisma);

  const report: TemplatesSeedReport = {
    definitions: definitionIds.size,
    templates: JOURNEY_TEMPLATES.length,
    versions: [],
  };

  for (const template of JOURNEY_TEMPLATES) {
    const row = await prisma.journeyTemplate.upsert({
      where: { code: template.code },
      update: {
        nameFr: template.nameFr,
        targetPhase: template.targetPhase,
        sortOrder: template.sortOrder,
      },
      create: {
        id: newId(),
        code: template.code,
        nameFr: template.nameFr,
        targetPhase: template.targetPhase,
        isActive: true,
        sortOrder: template.sortOrder,
      },
      select: { id: true },
    });

    // La version générique d'abord : c'est le repli de la résolution (03 §2.1).
    report.versions.push({
      templateCode: template.code,
      originIso2: null,
      outcome: await publishVersion(prisma, {
        templateId: row.id,
        originCountryId: null,
        composition: compose(template, {}),
        definitionIds,
      }),
    });

    // Puis les déclinaisons par pays d'origine (T3 A.3).
    for (const variant of template.variants) {
      const country = await prisma.country.findUnique({
        where: { iso2: variant.countryIso2 },
        select: { id: true },
      });
      if (country === null) {
        // Le pays n'est pas au référentiel : on n'en fabrique pas un. La
        // déclinaison manquera, la version générique s'applique (03 §2.1).
        continue;
      }
      report.versions.push({
        templateCode: template.code,
        originIso2: variant.countryIso2,
        outcome: await publishVersion(prisma, {
          templateId: row.id,
          originCountryId: country.id,
          composition: compose(template, variant.overrides),
          definitionIds,
        }),
      });
    }
  }

  return report;
}
