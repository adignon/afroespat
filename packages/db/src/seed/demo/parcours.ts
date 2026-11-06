import { newId } from '../../uuid.js';
import { ilYa } from './prng.js';
import { JOUR, incr, paquets, type Contexte } from './types.js';

/**
 * LES PARCOURS — vingt-deux, construits comme le produit le fait : une version publiée d'un modèle, ses étapes copiées,
 * des échéances calculées à rebours depuis la date d'arrivée, une progression plausible. Si aucun modèle n'est publié
 * (base sans `pnpm db:seed`), ce domaine est sauté et on le dit.
 */

export async function genererParcours(c: Contexte): Promise<void> {
  const { tx, rng, now } = c;
  const versions = await tx.journeyTemplateVersion.findMany({
    where: { status: 'PUBLISHED' },
    select: {
      id: true,
      originCountryId: true,
      template: { select: { nameFr: true, targetPhase: true, createsJourney: true, isActive: true } },
      steps: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          position: true,
          daysBeforeArrival: true,
          stepDefinition: { select: { id: true, nameFr: true, defaultDurationDays: true, documentChecklist: true } },
        },
      },
    },
  });
  const utilisables = versions.filter((v) => v.template.createsJourney && v.template.isActive && v.steps.length > 0);
  if (utilisables.length === 0) {
    c.log('  parcours : aucun modèle publié — domaine sauté (lancez d’abord « pnpm --filter @app/db seed »)');
    return;
  }

  const proprietaires = rng.sample(c.membres, 22);
  let nbEtapes = 0;
  let publics = 0;

  for (const m of proprietaires) {
    const memePhase = utilisables.filter((v) => v.template.targetPhase === m.phase);
    const base = memePhase.length > 0 ? memePhase : utilisables;
    const version = base.find((v) => v.originCountryId === m.countryId) ?? base.find((v) => v.originCountryId === null) ?? rng.pick(base);
    const arrivee =
      m.phase === 'PRE_DEPARTURE' ? new Date(now.getTime() + rng.int(25, 140) * JOUR) : new Date(now.getTime() - rng.int(5, 90) * JOUR);
    const termine = m.phase === 'SETTLED' && rng.chance(0.35);
    const visibilite = rng.weighted<'PRIVATE' | 'SHARED' | 'PUBLIC'>([
      ['PRIVATE', 55],
      ['SHARED', 15],
      ['PUBLIC', 30],
    ]);
    if (visibilite === 'PUBLIC') publics += 1;
    const total = version.steps.length;
    const faites = termine ? total : m.phase === 'PRE_DEPARTURE' ? rng.int(0, Math.ceil(total / 3)) : rng.int(Math.floor(total / 4), Math.ceil(total * 0.8));
    const journeyId = newId();
    const creeLe = ilYa(now, rng.int(10, 110), rng);

    const lignes = version.steps.map((s, i) => {
      const fait = i < faites;
      const enCours = i === faites && !termine;
      const echeance = new Date(arrivee.getTime() - (s.daysBeforeArrival ?? (total - i) * 5) * JOUR);
      return {
        id: newId(),
        journeyId,
        templateStepId: s.id,
        stepDefinitionId: s.stepDefinition.id,
        title: s.stepDefinition.nameFr,
        position: s.position,
        status: fait ? ('DONE' as const) : enCours ? ('IN_PROGRESS' as const) : ('TODO' as const),
        dueDate: echeance,
        startedAt: fait || enCours ? new Date(Math.min(now.getTime(), echeance.getTime()) - 5 * JOUR) : null,
        completedAt: fait ? new Date(Math.min(now.getTime(), echeance.getTime()) - 1 * JOUR) : null,
        durationDays: s.stepDefinition.defaultDurationDays,
        checklist: s.stepDefinition.documentChecklist,
        enCours,
      };
    });
    const courante = lignes.find((l) => l.enCours) ?? null;

    await tx.journey.create({
      data: {
        id: journeyId,
        createdAt: creeLe,
        ownerUserId: m.id,
        templateVersionId: version.id,
        title: version.template.nameFr,
        status: termine ? 'COMPLETED' : 'ACTIVE',
        visibility: visibilite,
        originCountryId: m.countryId,
        destinationCityId: m.cityId,
        targetArrivalDate: arrivee,
        progressPct: Math.round((100 * faites) / total),
        lastActivityAt: new Date(now.getTime() - rng.int(0, 9) * JOUR),
        ...(termine ? { completedAt: new Date(now.getTime() - rng.int(1, 30) * JOUR) } : {}),
      },
    });
    for (const lot of paquets(lignes, 60)) {
      await tx.journeyStep.createMany({
        data: lot.map(({ checklist: _k, enCours: _e, ...ligne }) => {
          void _k;
          void _e;
          return ligne;
        }),
      });
    }
    if (courante !== null) {
      await tx.journey.update({ where: { id: journeyId }, data: { currentStepId: courante.id } });
      const items = courante.checklist.slice(0, 6);
      if (items.length > 0) {
        await tx.journeyStepChecklistItem.createMany({
          data: items.map((label, k) => ({
            id: newId(),
            journeyStepId: courante.id,
            label,
            position: k + 1,
            isChecked: k < Math.floor(items.length / 2),
            checkedAt: k < Math.floor(items.length / 2) ? ilYa(now, rng.int(0, 6), rng) : null,
          })),
        });
      }
    }
    nbEtapes += lignes.length;
  }

  incr(c, 'parcours', proprietaires.length);
  incr(c, 'étapes de parcours', nbEtapes);
  c.log(`  parcours : ${proprietaires.length} (dont ${publics} publics), ${nbEtapes} étapes`);
}
