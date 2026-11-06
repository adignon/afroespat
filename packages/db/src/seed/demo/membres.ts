import type { Prisma } from '../../../generated/client/index.js';
import { newId } from '../../uuid.js';
import { ilYa } from './prng.js';
import { JOUR, incr, paquets, type Contexte, type Membre, type Phase, type Ville } from './types.js';

/**
 * LES MEMBRES — et ce qui les rend cohérents entre eux : villes ouvertes, réseaux de ville et de pays, adhésions,
 * compteurs dénormalisés. Aucun compte généré n'a de numéro de téléphone (`phone_numbers` est une table à part) : ils
 * sont INCONNECTABLES, comme les comptes de `seed/stories.ts` — personne ne peut ouvrir une session dessus. Ils portent
 * `origin = SEED`, ce que l'administration filtre et supprime en lot.
 */

export const VOLUME_MEMBRES = 120;

/** Les villes ouvertes, avec le nombre de membres qu'elles reçoivent (somme = 120). */
const VILLES: readonly { readonly slug: string; readonly membres: number }[] = [
  { slug: 'paris', membres: 30 },
  { slug: 'lyon', membres: 20 },
  { slug: 'marseille', membres: 14 },
  { slug: 'bordeaux', membres: 12 },
  { slug: 'toulouse', membres: 12 },
  { slug: 'strasbourg', membres: 12 },
  { slug: 'lille', membres: 10 },
  { slug: 'nantes', membres: 10 },
];

/** Pays d'origine, avec leur poids. Les deux premiers sont les pays de départ ouverts. */
const ORIGINES: readonly (readonly [string, number])[] = [
  ['BJ', 52],
  ['TG', 24],
  ['CI', 6],
  ['SN', 5],
  ['CM', 5],
  ['ML', 3],
  ['GN', 3],
  ['BF', 2],
];

const PRENOMS_F = [
  'Amina', 'Fatou', 'Awa', 'Aïcha', 'Mariam', 'Nadège', 'Pélagie', 'Rachelle', 'Sènami', 'Éliane', 'Joëlle', 'Carine',
  'Estelle', 'Prisca', 'Ginette', 'Sandrine', 'Yasmine', 'Aminata', 'Khadija', 'Rokia', 'Mireille', 'Flora', 'Laurette',
  'Odette', 'Zeinab', 'Bintou', 'Ines', 'Hortense', 'Clarisse', 'Dorcas', 'Fanta', 'Habiba', 'Nafissatou', 'Reine',
];
const PRENOMS_M = [
  'Kofi', 'Samuel', 'Moussa', 'Ibrahim', 'Romuald', 'Serge', 'Yannick', 'Cédric', 'Fidèle', 'Gildas', 'Hervé', 'Judicaël',
  'Léandre', 'Mathias', 'Narcisse', 'Olivier', 'Prosper', 'Rodrigue', 'Thierry', 'Ulrich', 'Alassane', 'Boubacar',
  'Mamadou', 'Ousmane', 'Sékou', 'Dieudonné', 'Éric', 'Franck', 'Gaston', 'Armand', 'Wilfried', 'Landry', 'Séraphin',
];
const NOMS = [
  'Dossou', 'Adjovi', 'Agbodjan', 'Ahouansou', 'Akpovi', 'Amoussou', 'Azonhoumon', 'Boko', 'Codjo', 'Dansou', 'Fassinou',
  'Gbaguidi', 'Hounkpatin', 'Houngbo', 'Kiki', 'Lokossou', 'Mensah', 'Noudjenoume', 'Sagbo', 'Tchibozo', 'Zinsou',
  'Agbéko', 'Amegah', 'Attiogbé', 'Kpodar', 'Lawson', 'Mawuli', 'Sossou', 'Tomety', 'Diallo', 'Konaté', 'Traoré',
  'Coulibaly', 'Ndiaye', 'Sow', 'Ba', 'Camara', 'Barry', 'Ouédraogo', 'Sawadogo', 'Kouassi', 'Yao', 'Koffi', 'Bamba',
  'Fofana', 'Touré', 'Nkoulou', 'Mballa', 'Essomba', 'Biyong', 'Fotso', 'Tchoumi', 'Ngassa', 'Sidibé', 'Keita', 'Cissé',
  'Doumbia', 'Sanogo', 'Soumaré', 'Sylla', 'Bah', 'Baldé',
];

const BIOS: Readonly<Record<Phase, readonly string[]>> = {
  PRE_DEPARTURE: [
    'Je prépare mon départ pour la France : visa, logement, banque. J’avance étape par étape.',
    'Admis en master, je cherche à comprendre les démarches avant d’arriver.',
    'En préparation de mon installation. Toute expérience sur le logement étudiant m’intéresse.',
    'Je pars dans quelques mois et je veux éviter les erreurs que d’autres ont faites.',
  ],
  RECENT_ARRIVAL: [
    'Arrivé·e il y a quelques mois. J’apprends encore les démarches mais ça se débloque.',
    'Nouvelle dans la ville, je cherche des gens du pays et des bons plans.',
    'Étudiant·e en première année. Je partage ce que je découvre au fil de l’eau.',
    'J’ai enfin mon titre de séjour ; je raconte le parcours pour ceux qui viennent après.',
  ],
  SETTLED: [
    'Installé·e depuis plusieurs années. Je réponds volontiers aux questions sur les démarches.',
    'J’ai traversé le parcours et j’aide les nouveaux arrivants, surtout sur le logement et l’emploi.',
    'Parrain / marraine dans ma ville. Je préfère l’échange simple à la théorie.',
    'En poste depuis quelques années. Je partage ce qui m’aurait fait gagner du temps.',
  ],
};

const SANS_ACCENT = (t: string): string =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

export interface ResultatMembres {
  readonly nombre: number;
}

export async function genererMembres(c: Contexte): Promise<void> {
  const { tx, rng, now } = c;

  // ── Les villes : on les OUVRE (le produit le fait en back-office) et on crée leur réseau, comme `ensureAutoCommunity`.
  const slugs = VILLES.map((v) => v.slug);
  const lignes = await tx.city.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true, name: true } });
  if (lignes.length < slugs.length) {
    throw new Error('Les villes du référentiel manquent : lancez d’abord « pnpm --filter @app/db seed » (pays, villes, modèles).');
  }
  const villes: Ville[] = [];
  for (const l of lignes) {
    await tx.city.update({ where: { id: l.id }, data: { isActive: true, activatedAt: new Date(now.getTime() - 150 * JOUR) } });
    const existant = await tx.community.findFirst({ where: { kind: 'CITY', cityId: l.id }, select: { id: true } });
    const communauteId = existant?.id ?? newId();
    if (existant === null) {
      await tx.community.create({
        data: {
          id: communauteId,
          kind: 'CITY',
          cityId: l.id,
          name: l.name,
          slug: `ville-${l.slug}`,
          visibility: 'PUBLIC',
          status: 'ACTIVE',
          lastActivityAt: now,
        },
      });
    }
    villes.push({ id: l.id, slug: l.slug, name: l.name, communauteId });
  }
  c.villes.push(...villes);

  // ── Les pays d'origine (identifiants) et les réseaux de pays des deux pays ouverts.
  const pays = await tx.country.findMany({ where: { iso2: { in: ORIGINES.map(([i]) => i) } }, select: { id: true, iso2: true, isActive: true } });
  const idPays = new Map(pays.map((p) => [p.iso2, p.id]));
  const reseauxPays = new Map<string, string>();
  for (const p of pays.filter((x) => x.isActive)) {
    const existant = await tx.community.findFirst({ where: { kind: 'COUNTRY', countryId: p.id }, select: { id: true } });
    if (existant !== null) {
      reseauxPays.set(p.iso2, existant.id);
      continue;
    }
    const id = newId();
    const nom = p.iso2 === 'BJ' ? 'Bénin' : p.iso2 === 'TG' ? 'Togo' : p.iso2;
    await tx.community.create({
      data: { id, kind: 'COUNTRY', countryId: p.id, name: nom, slug: `pays-${p.iso2.toLowerCase()}`, visibility: 'PUBLIC', status: 'ACTIVE', lastActivityAt: now },
    });
    reseauxPays.set(p.iso2, id);
  }

  // ── Les membres.
  const langues = new Map((await tx.language.findMany({ select: { id: true, code: true } })).map((l) => [l.code, l.id]));
  const competences = await tx.skill.findMany({ select: { id: true } });
  const pris = new Set<string>();
  const membres: Membre[] = [];

  const profils: Prisma.UserProfileCreateManyInput[] = [];
  const liensLangues: Prisma.UserLanguageCreateManyInput[] = [];
  const liensCompetences: Prisma.UserSkillCreateManyInput[] = [];
  const statistiques: Prisma.UserStatsCreateManyInput[] = [];
  const lignes2: Prisma.UserCreateManyInput[] = [];

  for (const v of VILLES) {
    const ville = villes.find((x) => x.slug === v.slug);
    if (ville === undefined) continue;
    for (let i = 0; i < v.membres; i++) {
      const feminin = rng.chance(0.52);
      const prenom = rng.pick(feminin ? PRENOMS_F : PRENOMS_M);
      const nom = rng.pick(NOMS);
      let handle = `${SANS_ACCENT(prenom)}.${SANS_ACCENT(nom)}`;
      let n = 1;
      while (pris.has(handle)) handle = `${SANS_ACCENT(prenom)}.${SANS_ACCENT(nom)}${++n}`;
      pris.add(handle);

      const phase = rng.weighted<Phase>([
        ['PRE_DEPARTURE', 14],
        ['RECENT_ARRIVAL', 36],
        ['SETTLED', 50],
      ]);
      const origine = rng.weighted(ORIGINES);
      const jours = phase === 'SETTLED' ? rng.int(60, 170) : phase === 'RECENT_ARRIVAL' ? rng.int(10, 120) : rng.int(3, 90);
      const creeLe = ilYa(now, jours, rng);
      const ancien = phase === 'SETTLED' && jours > 60;
      const niveau = ancien && rng.chance(0.4) ? 'L2' : 'L1';
      const id = newId();
      const countryId = idPays.get(origine);
      if (countryId === undefined) throw new Error(`Pays d’origine « ${origine} » absent du référentiel.`);

      membres.push({
        id,
        handle,
        displayName: `${prenom} ${nom}`,
        cityId: ville.id,
        cityName: ville.name,
        citySlug: ville.slug,
        countryId,
        originIso2: origine,
        phase,
        niveau,
        creeLe,
        ancien,
      });

      lignes2.push({
        id,
        createdAt: creeLe,
        handle,
        displayName: `${prenom} ${nom}`,
        phase,
        verificationLevel: niveau,
        originCountryId: countryId,
        cityId: ville.id,
        arrivalDate: phase === 'PRE_DEPARTURE' ? null : new Date(now.getTime() - rng.int(20, phase === 'SETTLED' ? 1400 : 150) * JOUR),
        plannedDepartureDate: phase === 'PRE_DEPARTURE' ? new Date(now.getTime() + rng.int(20, 150) * JOUR) : null,
        plan: 'FREE',
        status: 'ACTIVE',
        origin: 'SEED',
        lastSeenAt: new Date(now.getTime() - rng.int(0, 6 * 24 * 60) * 60_000),
        onboardingStep: 6,
      });

      const aide = ancien && rng.chance(0.6);
      profils.push({
        userId: id,
        bio: rng.pick(BIOS[phase]),
        occupationStatus: rng.weighted([
          ['STUDENT', phase === 'SETTLED' ? 20 : 60],
          ['EMPLOYEE', phase === 'SETTLED' ? 50 : 15],
          ['ENTREPRENEUR', 8],
          ['JOB_SEEKER', 15],
          ['OTHER', 5],
        ]),
        availableToHelp: aide,
        helpTypes: aide ? rng.sample(['PAPERWORK', 'HOUSING', 'JOB', 'WELCOME', 'SERVICE'] as const, rng.int(1, 3)) : [],
        isPublic: rng.chance(0.7),
        showAsNewcomer: phase !== 'SETTLED',
      });

      const fr = langues.get('fr');
      if (fr !== undefined) liensLangues.push({ userId: id, languageId: fr });
      const locale = langues.get(origine === 'BJ' ? rng.pick(['fon', 'yo', 'goun']) : origine === 'TG' ? 'ee' : origine === 'SN' ? 'wo' : origine === 'ML' ? 'bm' : 'en');
      if (locale !== undefined) liensLangues.push({ userId: id, languageId: locale });
      for (const s of rng.sample(competences, rng.int(1, 3))) liensCompetences.push({ userId: id, skillId: s.id });

      statistiques.push({
        userId: id,
        computedAt: now,
        helpValidatedCount: 0,
        guideHelpfulVotes: 0,
        guideContributions: 0,
        mentorshipsCompleted: 0,
        eventsOrganized: 0,
      });
    }
  }

  for (const lot of paquets(lignes2, 100)) await tx.user.createMany({ data: lot });
  for (const lot of paquets(profils)) await tx.userProfile.createMany({ data: lot });
  for (const lot of paquets(liensLangues)) await tx.userLanguage.createMany({ data: lot, skipDuplicates: true });
  for (const lot of paquets(liensCompetences)) await tx.userSkill.createMany({ data: lot, skipDuplicates: true });
  for (const lot of paquets(statistiques)) await tx.userStats.createMany({ data: lot });
  c.membres.push(...membres);
  incr(c, 'membres', membres.length);

  // ── Adhésions automatiques : réseau de la ville, réseau du pays (s'il est ouvert) — comme `syncAutoMemberships`.
  const adhesions: Prisma.CommunityMemberCreateManyInput[] = [];
  for (const m of membres) {
    const ville = villes.find((v) => v.id === m.cityId);
    if (ville !== undefined) adhesions.push({ id: newId(), communityId: ville.communauteId, userId: m.id, role: 'MEMBER', status: 'ACTIVE', joinedAt: m.creeLe });
    const reseauPays = reseauxPays.get(m.originIso2);
    if (reseauPays !== undefined) adhesions.push({ id: newId(), communityId: reseauPays, userId: m.id, role: 'MEMBER', status: 'ACTIVE', joinedAt: m.creeLe });
  }
  for (const lot of paquets(adhesions)) await tx.communityMember.createMany({ data: lot, skipDuplicates: true });

  // ── Compteurs dénormalisés, recalculés sur TOUS les comptes et adhésions actifs (de vrais membres peuvent déjà
  //    habiter ces villes : on ne remplace pas leur compte par celui des seuls comptes de départ).
  for (const v of villes) {
    const effectif = await tx.user.count({ where: { cityId: v.id, status: 'ACTIVE', deletedAt: null } });
    await tx.city.update({ where: { id: v.id }, data: { memberCount: effectif } });
  }
  for (const id of [...villes.map((v) => v.communauteId), ...reseauxPays.values()]) {
    await tx.community.update({ where: { id }, data: { memberCount: await tx.communityMember.count({ where: { communityId: id, status: 'ACTIVE' } }) } });
  }
  incr(c, 'adhésions aux réseaux de ville et de pays', adhesions.length);
  c.log(`  membres : ${membres.length} dans ${villes.length} villes (réseaux de ville ouverts, adhésions automatiques)`);
}
