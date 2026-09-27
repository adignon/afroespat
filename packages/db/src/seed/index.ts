import { resolve } from 'node:path';
import { PrismaClient } from '../../generated/client/index.js';
import { newId } from '../uuid.js';
import { CITIES, COUNTRIES, LANGUAGES, PROFESSIONS, SKILLS } from './referentials.js';

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

  const france = await prisma.country.findUniqueOrThrow({ where: { iso2: 'FR' } });

  // ── Villes ──────────────────────────────────────────────────────────────
  for (const c of CITIES) {
    await prisma.city.upsert({
      where: { slug: c.slug },
      update: { name: c.name, region: c.region, latitude: c.latitude, longitude: c.longitude },
      create: {
        id: newId(),
        countryId: france.id,
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
