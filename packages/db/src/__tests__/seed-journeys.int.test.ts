import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../../generated/client/index.js';
import { JOURNEY_TEMPLATES, STEP_DEFINITIONS } from '../seed/journeys.js';
import { seedJourneyTemplates } from '../seed/templates.js';
import { newId } from '../uuid.js';

/**
 * Seed des modèles de parcours — T3 partie A.
 *
 * Chaque propriété affirmée ici a été ÉPROUVÉE PAR MUTATION : la propriété a été
 * cassée dans le seed, le test est tombé, la propriété a été rétablie. La mutation
 * est notée en tête de chaque test. « Le test passe » ne prouve rien tant qu'on
 * n'a pas vu le test ÉCHOUER pour la bonne raison.
 *
 * Ces tests écrivent dans la base de développement. Le seul qui la modifie
 * durablement — la republication — restaure l'état qu'il a trouvé dans `afterAll`,
 * et le dernier test vérifie que la restauration a bien eu lieu.
 */

const prisma = new PrismaClient();

/**
 * L'état complet des tables du modèle : identifiants COMPRIS.
 *
 * Compter les lignes ne suffirait pas à prouver l'idempotence : un seed qui
 * supprime et réécrit tout garde le même compte, et pourtant chaque
 * `journeys.template_version_id` figé pointerait dans le vide.
 */
async function snapshot(): Promise<string> {
  const definitions = await prisma.stepDefinition.findMany({
    orderBy: { code: 'asc' },
    select: { id: true, code: true, nameFr: true, documentChecklist: true },
  });
  const templates = await prisma.journeyTemplate.findMany({
    orderBy: { code: 'asc' },
    select: { id: true, code: true, nameFr: true, sortOrder: true, isActive: true },
  });
  const versions = await prisma.journeyTemplateVersion.findMany({
    orderBy: [{ templateId: 'asc' }, { version: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      templateId: true,
      version: true,
      originCountryId: true,
      status: true,
      steps: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          position: true,
          isOptional: true,
          daysBeforeArrival: true,
          stepDefinitionId: true,
          overrides: true,
        },
      },
      stepDependencies: {
        orderBy: [{ stepId: 'asc' }, { dependsOnStepId: 'asc' }],
        select: { id: true, stepId: true, dependsOnStepId: true },
      },
    },
  });
  return JSON.stringify({ definitions, templates, versions });
}

/** Les versions publiées, par (code de type, pays d'origine). */
async function publishedVersions() {
  return prisma.journeyTemplateVersion.findMany({
    where: { status: 'PUBLISHED' },
    select: {
      id: true,
      version: true,
      originCountryId: true,
      template: { select: { code: true } },
    },
  });
}

async function templateByCode(code: string) {
  return prisma.journeyTemplate.findUniqueOrThrow({
    where: { code },
    select: { id: true },
  });
}

/** Les étapes d'une version, en position croissante, avec le code de leur définition. */
async function stepsOf(versionId: string) {
  return prisma.templateStep.findMany({
    where: { templateVersionId: versionId },
    orderBy: { position: 'asc' },
    select: {
      id: true,
      position: true,
      isOptional: true,
      daysBeforeArrival: true,
      stepDefinition: { select: { code: true } },
    },
  });
}

describe('seed des modèles de parcours (T3 partie A)', () => {
  /** Trace laissée par le test de republication, défaite dans `afterAll`. */
  let republished: { templateId: string; mutatedStepId: string; originalDays: number } | null =
    null;

  beforeAll(async () => {
    await prisma.$connect();
    // Le seed est le SUJET du test : on le charge ici, pour que le fichier passe
    // sur une base neuve comme sur une base déjà chargée.
    await seedJourneyTemplates(prisma);
  });

  afterAll(async () => {
    // Restauration de l'état trouvé : la version 2 créée par le test de
    // republication est supprimée, la version 1 redevient publiée. L'ORDRE
    // compte — supprimer d'abord, republier ensuite : deux PUBLISHED simultanées
    // seraient refusées par l'index partiel.
    if (republished !== null) {
      // La composition de la version 1 redevient celle de la spec AVANT le
      // rechargement final : la laisser altérée ferait republier une version 3 à
      // chaque exécution, et le test d'idempotence tomberait au prochain passage
      // pour une raison qui n'aurait rien à voir avec le seed.
      await prisma.templateStep.update({
        where: { id: republished.mutatedStepId },
        data: { daysBeforeArrival: republished.originalDays },
      });
      await prisma.journeyTemplateVersion.deleteMany({
        where: { templateId: republished.templateId, version: { gt: 1 } },
      });
      await prisma.journeyTemplateVersion.updateMany({
        where: { templateId: republished.templateId, version: 1, originCountryId: null },
        data: { status: 'PUBLISHED', changelog: null },
      });
      // Contrôle : le seed ne doit plus rien avoir à republier.
      const report = await seedJourneyTemplates(prisma);
      const republishing = report.versions.filter((v) => v.outcome !== 'inchangée');
      if (republishing.length > 0) {
        throw new Error(
          `Restauration incomplète : ${republishing.map((v) => v.templateCode).join(', ')}`,
        );
      }
    }
    await prisma.$disconnect();
  });

  // ══ Idempotence ═══════════════════════════════════════════════════════════

  describe('idempotence', () => {
    /**
     * MUTATION : dans `templates.ts`, `publishVersion`, supprimer le
     * court-circuit `if (signature(current) === signature(composition)) return
     * 'inchangée'`. Chaque exécution archive et republie : le compte de versions
     * grimpe, tous les identifiants d'étapes changent, le test tombe.
     */
    it('rejouer le seed ne change ni le nombre de lignes ni les identifiants', async () => {
      // PRÉMISSE : le modèle est bien chargé. Un test d'idempotence sur des
      // tables vides passerait sans rien vérifier.
      expect(await prisma.stepDefinition.count()).toBeGreaterThanOrEqual(STEP_DEFINITIONS.length);
      expect(await prisma.journeyTemplate.count()).toBeGreaterThanOrEqual(JOURNEY_TEMPLATES.length);

      const before = await snapshot();
      await seedJourneyTemplates(prisma);
      await seedJourneyTemplates(prisma);
      const after = await snapshot();

      expect(after).toBe(before);
    });

    /**
     * MUTATION : dans `templates.ts`, `seedStepDefinitions`, remplacer l'`upsert`
     * par un `create`. La deuxième exécution lève sur la contrainte d'unicité de
     * `code` — et si l'on retirait aussi l'unicité, les définitions doubleraient.
     */
    it('les 30 définitions de A.1 existent une fois chacune', async () => {
      const codes = STEP_DEFINITIONS.map((d) => d.code);
      expect(new Set(codes).size).toBe(STEP_DEFINITIONS.length);

      const rows = await prisma.stepDefinition.findMany({
        where: { code: { in: codes } },
        select: { code: true },
      });
      expect(rows).toHaveLength(STEP_DEFINITIONS.length);
    });
  });

  // ══ RÈGLE DURE 03 §2.2 — une seule version publiée par (type, pays) ═══════

  describe('rule: une seule version PUBLISHED par (type, pays d’origine)', () => {
    /**
     * MUTATION : dans `publishVersion`, déplacer l'archivage APRÈS le `create`.
     * Le seed lève `P2002` sur `journey_template_versions_one_published_generic`
     * dès la première republication — exactement le symptôme qui a coûté du temps.
     */
    it('la base n’en contient qu’une par couple', async () => {
      const rows = await publishedVersions();
      // PRÉMISSE : il y a bien des versions publiées à compter.
      expect(rows.length).toBeGreaterThanOrEqual(JOURNEY_TEMPLATES.length);

      const seen = new Map<string, number>();
      for (const row of rows) {
        const key = `${row.template.code}|${row.originCountryId ?? 'GENERIQUE'}`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
      expect([...seen.entries()].filter(([, count]) => count > 1)).toEqual([]);
    });

    /**
     * L'index est PARTIEL et posé par migration : il n'apparaît dans aucun
     * `schema/*.prisma`, donc rien dans le code ne le rappelle. Ce test est le
     * seul endroit où sa présence est vérifiée.
     *
     * MUTATION : `DROP INDEX journey_template_versions_one_published_generic` puis
     * relancer — l'insertion passe et le test tombe. (Vérifié sur `app_a1`, index
     * recréé aussitôt.)
     */
    it('la base REFUSE une seconde version publiée (index unique partiel)', async () => {
      const studies = await templateByCode('STUDIES');
      await expect(
        prisma.journeyTemplateVersion.create({
          data: {
            id: newId(),
            templateId: studies.id,
            originCountryId: null,
            version: 9_999,
            status: 'PUBLISHED',
            publishedAt: new Date(),
          },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });

      // Et rien n'a été écrit : l'insertion refusée ne laisse pas de trace.
      expect(
        await prisma.journeyTemplateVersion.count({
          where: { templateId: studies.id, version: 9_999 },
        }),
      ).toBe(0);
    });

    /**
     * La version générique et la déclinaison par pays coexistent, toutes deux
     * publiées : les deux index sont DISJOINTS (l'un exige `origin_country_id IS
     * NULL`, l'autre `IS NOT NULL`).
     *
     * MUTATION : dans `publishVersion`, retirer `originCountryId` du `where` du
     * `findFirst`. La publication de la déclinaison BJ trouve alors la version
     * GÉNÉRIQUE, la juge différente et l'archive : la générique disparaît des
     * publiées, le test tombe. C'est le piège de la colonne NULLABLE, pris à
     * l'envers — ici c'est l'OUBLI du filtre qui nuit.
     */
    it('la générique et la déclinaison BJ sont publiées en même temps', async () => {
      const benin = await prisma.country.findUnique({
        where: { iso2: 'BJ' },
        select: { id: true },
      });
      // PRÉMISSE : sans le Bénin au référentiel, la déclinaison n'existe pas et
      // le test n'aurait rien à vérifier.
      expect(benin).not.toBeNull();

      const studies = await templateByCode('STUDIES');
      const rows = await prisma.journeyTemplateVersion.findMany({
        where: { templateId: studies.id, status: 'PUBLISHED' },
        select: { originCountryId: true },
      });
      expect(rows).toHaveLength(2);
      expect(rows.some((r) => r.originCountryId === null)).toBe(true);
      expect(rows.some((r) => r.originCountryId === benin?.id)).toBe(true);
    });
  });

  // ══ Conformité à T3 A.2 ═══════════════════════════════════════════════════

  describe('composition des types (T3 A.2)', () => {
    /**
     * Le document annonce « 12 étapes » puis en liste 15, et le reconnaît. On
     * suit la LISTE.
     *
     * MUTATION : intervertir deux étapes dans `JOURNEY_TEMPLATES` (STUDIES), ou
     * changer un `daysBeforeArrival`. Le test tombe sur la ligne concernée.
     */
    it('STUDIES pose les 15 étapes de la liste, dans l’ordre, avec leur rétro-planning', async () => {
      const studies = await templateByCode('STUDIES');
      const generic = await prisma.journeyTemplateVersion.findFirstOrThrow({
        where: { templateId: studies.id, originCountryId: null, status: 'PUBLISHED' },
        select: { id: true },
      });
      const steps = await stepsOf(generic.id);

      expect(
        steps.map((s) => [s.position, s.stepDefinition.code, s.daysBeforeArrival, s.isOptional]),
      ).toEqual([
        [1, 'CHOOSE_PROGRAM', 240, false],
        [2, 'CAMPUS_FRANCE_FILE', 200, false],
        [3, 'CAMPUS_FRANCE_INTERVIEW', 170, false],
        [4, 'ADMISSION', 120, false],
        [5, 'PROOF_OF_FUNDS', 100, false],
        [6, 'VISA', 60, false],
        [7, 'HEALTH_INSURANCE', 50, false],
        [8, 'HOUSING_BEFORE', 30, false],
        [9, 'FLIGHT', 21, false],
        [10, 'ARRIVAL', 0, false],
        [11, 'OFII_VALIDATION', -30, false],
        [12, 'BANK_ACCOUNT', -21, false],
        [13, 'SOCIAL_SECURITY', -60, false],
        [14, 'CAF', -45, true],
        [15, 'RESIDENCE_PERMIT', -270, false],
      ]);
    });

    /**
     * ARBITRAGE : T3 A.2 fait dépendre CAF de « 8 ou HOUSING_AFTER ».
     * `step_dependencies` est une table de paires, donc CONJONCTIVE : deux lignes
     * diraient « 8 ET HOUSING_AFTER », plus contraignant que la spec. Et
     * HOUSING_AFTER n'est pas composée par STUDIES v1, donc la seconde branche n'a
     * même pas de cible possible. On garde la 8 seule.
     *
     * MUTATION : ajouter `HOUSING_AFTER` aux étapes de STUDIES et une seconde
     * dépendance à CAF. Le test tombe sur le compte de dépendances.
     */
    it('CAF ne porte que la branche représentable de « 8 ou HOUSING_AFTER »', async () => {
      const studies = await templateByCode('STUDIES');
      const generic = await prisma.journeyTemplateVersion.findFirstOrThrow({
        where: { templateId: studies.id, originCountryId: null, status: 'PUBLISHED' },
        select: { id: true },
      });
      const steps = await stepsOf(generic.id);
      const caf = steps.find((s) => s.stepDefinition.code === 'CAF');
      expect(caf).toBeDefined();
      // PRÉMISSE : HOUSING_AFTER n'est PAS une étape de STUDIES — c'est ce qui
      // rend la seconde branche irreprésentable.
      expect(steps.some((s) => s.stepDefinition.code === 'HOUSING_AFTER')).toBe(false);

      const dependencies = await prisma.stepDependency.findMany({
        where: { stepId: caf?.id ?? '' },
        select: { dependsOnStep: { select: { stepDefinition: { select: { code: true } } } } },
      });
      expect(dependencies.map((d) => d.dependsOnStep.stepDefinition.code)).toEqual([
        'HOUSING_BEFORE',
      ]);
    });

    /**
     * MUTATION : donner un `daysBeforeArrival` à une étape de SETTLEMENT. Le test
     * tombe.
     */
    it('SETTLEMENT est sans rétro-planning et compte 7 étapes', async () => {
      const settlement = await templateByCode('SETTLEMENT');
      const generic = await prisma.journeyTemplateVersion.findFirstOrThrow({
        where: { templateId: settlement.id, originCountryId: null, status: 'PUBLISHED' },
        select: { id: true },
      });
      const steps = await stepsOf(generic.id);
      expect(steps).toHaveLength(7);
      expect(steps.map((s) => s.daysBeforeArrival)).toEqual([
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      ]);
      expect(steps[0]?.stepDefinition.code).toBe('REGULARIZATION');
    });

    /**
     * T3 A.3 : la déclinaison BJ surcharge la DESCRIPTION de trois étapes, et rien
     * d'autre. Les montants et les délais n'y figurent pas : ils « renvoient aux
     * guides communautaires ».
     *
     * MUTATION : vider `BENIN_OVERRIDES`. Le test tombe sur le compte de
     * surcharges. Écrire un montant dans une surcharge le fait tomber aussi.
     */
    it('la déclinaison BJ surcharge trois descriptions, sans montant ni délai', async () => {
      const studies = await templateByCode('STUDIES');
      const benin = await prisma.journeyTemplateVersion.findFirstOrThrow({
        where: {
          templateId: studies.id,
          status: 'PUBLISHED',
          originCountry: { iso2: 'BJ' },
        },
        select: { id: true },
      });
      const steps = await prisma.templateStep.findMany({
        where: { templateVersionId: benin.id },
        orderBy: { position: 'asc' },
        select: { overrides: true, stepDefinition: { select: { code: true } } },
      });

      const overridden = steps.filter((s) => s.overrides !== null);
      expect(overridden.map((s) => s.stepDefinition.code)).toEqual([
        'CAMPUS_FRANCE_FILE',
        'PROOF_OF_FUNDS',
        'VISA',
      ]);
      // La déclinaison a les MÊMES étapes que la générique : « identiques à la
      // version générique, avec des surcharges de description ».
      expect(steps).toHaveLength(15);

      for (const step of overridden) {
        const text = JSON.stringify(step.overrides);
        // Ni euro, ni « jours », ni chiffre de montant : la valeur vieillirait ici
        // sans que personne ne la corrige.
        expect(text).not.toMatch(/€|EUR|\bXOF\b|\d+\s*(?:jours|mois|€)/i);
      }
    });
  });

  // ══ Republication ═════════════════════════════════════════════════════════

  /**
   * Ce test DOIT rester le dernier : il laisse une version 2 que `afterAll`
   * nettoie.
   *
   * MUTATION : retirer le `$transaction` de `publishVersion` et faire les deux
   * écritures à la suite — l'archivage passe, la publication passe, mais si la
   * seconde échoue le type se retrouve SANS version publiée et disparaît de
   * `GET /journey-templates`. Pour l'observer, inverser les deux écritures : on
   * obtient `P2002` et le seed lève.
   */
  it('republier archive l’ancienne version et publie la suivante', async () => {
    const studies = await templateByCode('STUDIES');

    const before = await prisma.journeyTemplateVersion.findFirstOrThrow({
      where: { templateId: studies.id, originCountryId: null, status: 'PUBLISHED' },
      select: { id: true, version: true },
    });
    // PRÉMISSE : on part bien de la version 1 publiée.
    expect(before.version).toBe(1);

    // On rend la composition en base DIFFÉRENTE de celle de la spec : c'est ce
    // qu'un correctif de modèle produirait.
    const firstStep = await prisma.templateStep.findFirstOrThrow({
      where: { templateVersionId: before.id, position: 1 },
      select: { id: true, daysBeforeArrival: true },
    });
    republished = {
      templateId: studies.id,
      mutatedStepId: firstStep.id,
      originalDays: firstStep.daysBeforeArrival ?? 240,
    };
    await prisma.templateStep.update({
      where: { id: firstStep.id },
      data: { daysBeforeArrival: 999 },
    });

    await seedJourneyTemplates(prisma);

    const after = await prisma.journeyTemplateVersion.findMany({
      where: { templateId: studies.id, originCountryId: null },
      orderBy: { version: 'asc' },
      select: { id: true, version: true, status: true, changelog: true },
    });
    expect(after.map((v) => [v.version, v.status])).toEqual([
      [1, 'ARCHIVED'],
      [2, 'PUBLISHED'],
    ]);
    // « Les parcours existants continuent dessus » (§2.2) : la version 1 garde ses
    // étapes, elle n'est pas vidée.
    expect(await prisma.templateStep.count({ where: { templateVersionId: before.id } })).toBe(15);
    // Et la nouvelle porte un changelog — « la procédure a évolué » a un contenu.
    expect(after[1]?.changelog).toBeTruthy();

    const version2 = after[1];
    if (version2 === undefined) throw new Error('version 2 absente');
    const steps = await stepsOf(version2.id);
    expect(steps[0]?.daysBeforeArrival).toBe(240);
  });

  /** Dernier filet : la restauration d'`afterAll` est vérifiée à l'exécution suivante. */
  it('laisse la base dans un état à une seule version publiée par couple', async () => {
    const rows = await publishedVersions();
    const seen = new Set<string>();
    for (const row of rows) {
      const key = `${row.template.code}|${row.originCountryId ?? 'GENERIQUE'}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});
