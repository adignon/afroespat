import { resolve } from 'node:path';
import { PrismaClient } from '../../generated/client/index.js';
import { newId } from '../uuid.js';
import { seedBilling } from './billing.js';
import {
  CITIES,
  COUNTRIES,
  LANGUAGES,
  PROFESSIONS,
  SKILLS,
  STATIC_PAGES,
} from './referentials.js';
import { seedJourneyTemplates } from './templates.js';

/**
 * Chargement des données de départ (T3).
 *
 * IDEMPOTENT : relancer ne duplique rien et n'écrase aucune donnée administrée
 * depuis le back-office. On crée ce qui manque, on met à jour ce qui est
 * structurel (nom, indicatif, coordonnées), et on ne touche JAMAIS à `isActive`
 * ni à `memberCount` — ce sont des décisions produit, pas des données de départ.
 */
// Le .env de la racine (§11.2). En CI, les variables sont déjà là.
try {
  process.loadEnvFile(resolve(import.meta.dirname, '..', '..', '..', '..', '.env'));
} catch {
  /* rien à charger */
}

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const log = (s: string) => process.stdout.write(`${s}\n`);

  // ── Pays ────────────────────────────────────────────────────────────────
  for (const c of COUNTRIES) {
    await prisma.country.upsert({
      where: { iso2: c.iso2 },
      // isActive absent de l'update : activer un pays est une décision prise en
      // back-office (02 §2.1), qu'un rechargement ne doit pas annuler.
      update: { nameFr: c.nameFr, dialCode: c.dialCode, kind: c.kind, sortOrder: c.sortOrder },
      create: { id: newId(), ...c },
    });
  }
  log(`  pays : ${COUNTRIES.length}`);

  /**
   * Les pays des villes, lus UNE fois.
   *
   * La liste ne portait que la France ; elle porte désormais aussi le Bénin et le
   * Togo (décision du porteur, voir `referentials.ts`). Le pays est donc résolu par
   * son code plutôt que supposé — et `countryId` entre dans l'`update`, sans quoi
   * une ville dont on corrigerait le pays resterait rattachée à l'ancien.
   */
  const countryIds = new Map<string, string>();
  for (const iso2 of ['FR', 'BJ', 'TG']) {
    const row = await prisma.country.findUniqueOrThrow({ where: { iso2 } });
    countryIds.set(iso2, row.id);
  }
  const countryIdOf = (iso2: string): string => {
    const id = countryIds.get(iso2);
    if (id === undefined) throw new Error(`Pays « ${iso2} » absent : la liste des pays est incomplète.`);
    return id;
  };

  // ── Villes ──────────────────────────────────────────────────────────────
  for (const c of CITIES) {
    const countryId = countryIdOf(c.countryIso2 ?? 'FR');
    await prisma.city.upsert({
      where: { slug: c.slug },
      update: {
        name: c.name,
        region: c.region,
        latitude: c.latitude,
        longitude: c.longitude,
        countryId,
      },
      create: {
        id: newId(),
        countryId,
        name: c.name,
        slug: c.slug,
        region: c.region,
        latitude: c.latitude,
        longitude: c.longitude,
        // Toutes inactives : la ville pilote est activée à la main le jour du
        // lancement (T3 B.2). Une carte vide partout tue la confiance.
        isActive: false,
      },
    });
  }
  log(`  villes : ${CITIES.length} (toutes inactives — la ville pilote s’active en back-office)`);

  await activatePilotCity(log);

  // ── Pages statiques référencées par les consentements (01 §2.10) ────────
  for (const page of STATIC_PAGES) {
    await prisma.staticPage.upsert({
      where: { slug: page.slug },
      // Le CORPS et la VERSION ne sont pas mis à jour : le jour où le porteur
      // publie son texte en version 1, un rechargement du seed ne doit pas le
      // ramener à la version 0 — ce qui redemanderait le consentement à tout le
      // monde, pour rien.
      update: { title: page.title },
      create: { id: newId(), ...page, publishedAt: new Date() },
    });
  }
  log(`  pages statiques : ${STATIC_PAGES.length} (gabarits en version 0 — texte à venir)`);

  // ── Listes fermées du profil ────────────────────────────────────────────
  for (const l of LANGUAGES) {
    await prisma.language.upsert({
      where: { code: l.code },
      update: { nameFr: l.nameFr },
      create: { id: newId(), ...l },
    });
  }
  log(`  langues : ${LANGUAGES.length}`);

  for (const s of SKILLS) {
    await prisma.skill.upsert({
      where: { nameFr: s.nameFr },
      update: { category: s.category },
      create: { id: newId(), ...s, isActive: true },
    });
  }
  log(`  compétences : ${SKILLS.length}`);

  for (const p of PROFESSIONS) {
    await prisma.profession.upsert({
      where: { nameFr: p.nameFr },
      update: { category: p.category },
      create: { id: newId(), ...p, isActive: true },
    });
  }
  log(`  métiers : ${PROFESSIONS.length}`);

  // ── Modèles de parcours (T3 partie A) ───────────────────────────────────
  const templates = await seedJourneyTemplates(prisma);
  log(`  définitions d’étapes : ${templates.definitions}`);
  log(`  types de parcours : ${templates.templates}`);
  for (const version of templates.versions) {
    const origin = version.originIso2 === null ? 'générique' : `pays ${version.originIso2}`;
    log(`    ${version.templateCode} (${origin}) : ${version.outcome}`);
  }

  // ── Monétisation (14 §3) ────────────────────────────────────────────────
  //
  // `plans.limits` est la source unique des quotas, et quatre modules livrés la
  // lisent déjà. Sans cet amorçage, ils retombent chacun sur une constante de
  // leur propre code — voir src/seed/billing.ts.
  const billing = await seedBilling(prisma);
  log(
    `  plans : ${billing.plans} · ancre partenaire Logement ${billing.housingAnchor} · ` +
      `prix annuels ${billing.yearPrices}`,
  );
}

/**
 * Active la ville pilote — et SEULEMENT si on la lui demande explicitement.
 *
 * T3 B.2 est catégorique : « toutes inactives au lancement sauf la ville pilote »,
 * et « la ville pilote est activée à la main le jour du lancement ». Le seed ne
 * choisit donc AUCUNE ville : la spec ne nomme pas la pilote, et une carte
 * peuplée d'office par un chargement de données serait une décision produit prise
 * par un script.
 *
 * Reste qu'en développement une base sans aucune ville active rend la carte,
 * l'annuaire des villes et leur indexation intestables. D'où cet interrupteur,
 * explicite et refusé en production :
 *
 *     SEED_PILOT_CITY_SLUG=lyon pnpm db:seed
 *
 * LIMITE ASSUMÉE : l'activation réelle doit créer le `community` CITY et y
 * inscrire les membres, via l'événement `city.activated` (02 §6). Le seed n'a pas
 * de boîte d'envoi, et la route `POST /v1/admin/ref/cities/:id/activate` (02 §4.2)
 * n'existe pas encore. Cette activation-ci ne fait donc que poser `is_active` et
 * `activated_at` : elle rend la ville visible, pas son réseau.
 */
async function activatePilotCity(log: (s: string) => void): Promise<void> {
  const slug = process.env['SEED_PILOT_CITY_SLUG']?.trim();
  if (slug === undefined || slug.length === 0) return;

  if (process.env['NODE_ENV'] === 'production') {
    throw new Error(
      'SEED_PILOT_CITY_SLUG est refusé en production : la ville pilote s’active à la main, ' +
        'en back-office, pour que son réseau soit créé (02 §6).',
    );
  }

  const city = await prisma.city.findUnique({
    where: { slug },
    select: { id: true, name: true, isActive: true, activatedAt: true },
  });
  if (city === null) {
    throw new Error(`Aucune ville au slug « ${slug} » : rien n’a été activé.`);
  }

  // Idempotent, et l'horodatage d'activation n'est pas RÉÉCRIT : la date à
  // laquelle une ville s'est ouverte est un fait, pas une valeur de seed.
  if (city.isActive && city.activatedAt !== null) {
    log(`  ville pilote : ${city.name} (déjà active)`);
    return;
  }
  await prisma.city.update({
    where: { id: city.id },
    data: { isActive: true, activatedAt: city.activatedAt ?? new Date() },
  });
  log(`  ville pilote : ${city.name} activée (développement — réseau NON créé)`);
}

main()
  .then(async () => {
    process.stdout.write('Données de départ chargées.\n');
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    process.stderr.write(`Échec du chargement : ${String(error)}\n`);
    await prisma.$disconnect();
    process.exit(1);
  });
