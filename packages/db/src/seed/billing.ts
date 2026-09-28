import {
  BILLING_YEAR_PRICES_SETTING_KEY,
  HOUSING_SECTION_STEP_CODE,
  PLAN_SEED,
  PLAN_YEAR_PRICES_DEFAULT,
} from '@app/shared';
import type { PrismaClient } from '../../generated/client/index.js';
import { newId } from '../uuid.js';

/**
 * Amorçage de la monétisation — 14-monetisation.md §3 et §5.1.
 *
 * POURQUOI CE FICHIER EXISTE. `plans.limits` est « la source unique des quotas »
 * (§3), et quatre modules déjà livrés — parcours, agenda, annuaire pro, offres
 * d'emploi — la lisent avant d'appliquer une limite. Or la table était VIDE : les
 * quatre retombaient donc sur une constante recopiée dans leur propre code, ce
 * qui faisait quatre sources là où la spec en veut une. Amorcer la table est ce
 * qui fait taire ce repli, et c'est la seule chose qui le fasse.
 *
 * IDEMPOTENT, comme le reste du seed : `upsert` par `code`. Ce qui est MIS À JOUR
 * est ce qui vient de la spec (le nom, la période) ; ce qui est ADMINISTRÉ depuis
 * le back-office — le PRIX, les LIMITES, `is_active` — n'est écrit qu'à la
 * création. Recharger le seed ne doit pas annuler un prix qu'un SUPER_ADMIN vient
 * de changer pour tester une variante (§3, dernière phrase) : ce serait
 * exactement le contraire de ce que ce paramètre existe pour permettre.
 */
export async function seedBilling(prisma: PrismaClient): Promise<{
  plans: number;
  housingAnchor: 'créée' | 'déjà présente';
  yearPrices: 'écrits' | 'déjà présents';
}> {
  for (const plan of PLAN_SEED) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      // Ni `priceCents`, ni `limits`, ni `isActive` : voir le préambule.
      update: { nameFr: plan.nameFr, interval: plan.interval, currency: plan.currency },
      create: {
        id: newId(),
        code: plan.code,
        nameFr: plan.nameFr,
        priceCents: plan.priceCents,
        currency: plan.currency,
        interval: plan.interval,
        // `PlanLimits` est une interface, pas un index signé : Prisma exige un
        // `InputJsonValue`. La diffusion en objet nu le donne sans perdre le
        // contrôle de type à l'écriture, qui a lieu dans PLAN_SEED.
        limits: { ...plan.limits },
        isActive: true,
      },
    });
  }

  /**
   * L'ancrage du pied de Logement (§5.1).
   *
   * La spec parle d'un `step_definition_id` « virtuel » ; la colonne est NOT NULL
   * et référence `step_definitions`, donc le virtuel doit être une VRAIE ligne.
   * Elle n'est rattachée à aucune version de modèle (`template_steps` ne la cite
   * pas), donc aucun parcours ne la contient jamais et aucune étape ne s'en
   * déduit — elle ne sert que d'ancre au placement.
   *
   * `blockerTarget: NONE` volontairement : une ancre ne propose pas de bouton
   * « Je suis bloqué ».
   */
  const existingAnchor = await prisma.stepDefinition.findUnique({
    where: { code: HOUSING_SECTION_STEP_CODE },
    select: { id: true },
  });
  if (existingAnchor === null) {
    await prisma.stepDefinition.create({
      data: {
        id: newId(),
        code: HOUSING_SECTION_STEP_CODE,
        nameFr: 'Pied de la section Logement',
        description:
          'Ancre technique du second emplacement partenaire (14 §5.1). ' +
          'N’appartient à aucun modèle de parcours.',
        category: 'SETTLEMENT',
        blockerTarget: 'NONE',
        isMajorMilestone: false,
        isRisky: false,
        documentChecklist: [],
      },
    });
  }

  // Les prix annuels : une valeur par défaut posée une seule fois. Le registre des
  // paramètres (15 §4.4) porte déjà la même valeur par défaut côté code, donc
  // l'absence de ligne n'est pas un défaut — l'écrire rend juste le réglage
  // visible dans le back-office dès le premier jour.
  const existingPrices = await prisma.systemSetting.findUnique({
    where: { key: BILLING_YEAR_PRICES_SETTING_KEY },
    select: { key: true },
  });
  if (existingPrices === null) {
    await prisma.systemSetting.create({
      data: { key: BILLING_YEAR_PRICES_SETTING_KEY, value: { ...PLAN_YEAR_PRICES_DEFAULT } },
    });
  }

  return {
    plans: PLAN_SEED.length,
    housingAnchor: existingAnchor === null ? 'créée' : 'déjà présente',
    yearPrices: existingPrices === null ? 'écrits' : 'déjà présents',
  };
}
