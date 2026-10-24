import { resolve } from 'node:path';
import { PrismaClient } from '../../generated/client/index.js';
import { newId } from '../uuid.js';
import { seedBilling } from './billing.js';
import { resolvePilotCityActivation } from './pilot-city.js';
import {
  CITIES,
  COUNTRIES,
  LANGUAGES,
  PROFESSIONS,
  SKILLS,
  STATIC_PAGES,
} from './referentials.js';
import { demoStoriesAsked, seedDemoStories } from './stories.js';
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
  await activateOriginCities(log);

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
    // Un gabarit encore en version « 0 » reçoit le brouillon à jour ; une page dont le porteur
    // a publié une vraie version (≥ 1) n'est JAMAIS touchée.
    await prisma.staticPage.updateMany({ where: { slug: page.slug, version: '0' }, data: { body: page.body } });
    const row = await prisma.staticPage.findUniqueOrThrow({ where: { slug: page.slug }, select: { id: true, title: true, body: true, version: true, publishedAt: true } });
    if (/^[0-9]+$/.test(row.version) && row.publishedAt !== null) {
      await prisma.staticPageVersion.upsert({
        where: { pageId_version: { pageId: row.id, version: Number(row.version) } },
        update: row.version === '0' ? { body: row.body } : {},
        create: { id: newId(), pageId: row.id, version: Number(row.version), title: row.title, body: row.body, publishedAt: row.publishedAt },
      });
    }
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

  /**
   * ── STORIES DE DÉMONSTRATION (opt-in) ────────────────────────────────────
   *
   * Hors du chargement T3 et derrière un interrupteur, pour la raison écrite en
   * tête de `stories.ts` : des stories sont des CONTENUS signés par des membres
   * fictifs, pas des données de départ.
   */
  if (demoStoriesAsked(process.env)) {
    const demo = await seedDemoStories(prisma);
    if (demo === null) {
      log('  stories de démonstration : aucune ville active — rien n’a été semé');
    } else {
      log(
        `  stories de démonstration : ${demo.stories} sur ${demo.auteurs} membres fictifs ` +
          `(${demo.ville}) — visibles 24 h`,
      );
    }
  }
}

/**
 * Active la ville pilote — et SEULEMENT si on la lui demande explicitement.
 *
 * T3 B.2 est catégorique : « toutes inactives au lancement sauf la ville pilote »,
 * et « la ville pilote est activée à la main le jour du lancement ». Le seed ne
 * choisit donc toujours AUCUNE ville de lui-même : une carte peuplée d'office par
 * un chargement de données serait une décision produit prise par un script.
 *
 * CE QUI A CHANGÉ : la pilote est désormais NOMMÉE — `PILOT_CITY_SLUG` dans
 * `@app/shared`, arbitrage du porteur. Le seed n'a plus à se la faire dicter par
 * une variable d'environnement ; il lui reste seulement à demander la permission
 * de l'ouvrir. Le « qui » et le « si » sont séparés, et `resolvePilotCityActivation`
 * porte cette séparation — à lire pour les deux interrupteurs de développement.
 *
 * LIMITE ASSUMÉE : l'activation réelle doit créer le `community` CITY et y
 * inscrire les membres, via l'événement `city.activated` (02 §6). Le seed n'a pas
 * de boîte d'envoi. Cette activation-ci ne fait donc que poser `is_active` et
 * `activated_at` : elle rend la ville visible, pas son réseau. Le jour J passe par
 * `POST /v1/admin/ref/cities/:id/activate` (02 §4.2), qui existe désormais.
 */
async function activatePilotCity(log: (s: string) => void): Promise<void> {
  const asked = resolvePilotCityActivation(process.env);
  if (asked === null) return;
  const { slug } = asked;

  const city = await prisma.city.findUnique({
    where: { slug },
    select: { id: true, name: true, isActive: true, activatedAt: true },
  });
  if (city === null) {
    throw new Error(`Aucune ville au slug « ${slug} » : rien n’a été activé.`);
  }
  const label = asked.overridden ? 'ville ouverte (essai)' : 'ville pilote';

  // Idempotent, et l'horodatage d'activation n'est pas RÉÉCRIT : la date à
  // laquelle une ville s'est ouverte est un fait, pas une valeur de seed.
  if (city.isActive && city.activatedAt !== null) {
    log(`  ${label} : ${city.name} (déjà active)`);
    return;
  }
  await prisma.city.update({
    where: { id: city.id },
    data: { isActive: true, activatedAt: city.activatedAt ?? new Date() },
  });
  log(`  ${label} : ${city.name} activée (développement — réseau NON créé)`);
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES VILLES DU PAYS DE DÉPART, OUVERTES POUR LE LANCEMENT                  ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Pour le départ active toutes les villes du pays de départ. »
 *
 * Le constat qui l'a amené là : sur l'écran O02, Cotonou portait « bientôt »
 * — mesuré, `is_active = false`. Le Bénin comptait DOUZE villes au référentiel et
 * UNE SEULE ouverte. Un membre qui part de Cotonou ne pouvait donc pas rattacher
 * son compte à sa propre ville.
 *
 * ── CE QUE CET INTERRUPTEUR NE CHANGE PAS ─────────────────────────────────
 *
 * La doctrine de `pilot-city.ts` tient toujours, et pour la même raison :
 * « confondre les deux ferait d'un chargement de données une décision produit ».
 * L'ouverture reste un OPT-IN EXPLICITE, refusé en production, et elle ne pose que
 * `is_active` et `activated_at`. Le réseau de la ville — le `community` CITY et
 * l'inscription des membres — naît de l'événement `city.activated`, que le seed
 * n'a pas de boîte d'envoi pour émettre. Le jour J passe par
 * `POST /v1/admin/ref/cities/:id/activate`.
 *
 * ── POURQUOI « LE PAYS DE DÉPART » ET NON « TOUS LES PAYS » ───────────────
 *
 * Ouvrir les villes d'un pays d'ORIGINE actif, c'est ouvrir le départ. Les villes
 * de DESTINATION, elles, restent gouvernées par la ville pilote : ouvrir Lyon ou
 * Marseille d'office déciderait du déploiement à la place du porteur. La
 * distinction est celle que `countries.kind` porte déjà.
 *
 *     SEED_ACTIVATE_ORIGIN_CITIES=true pnpm --filter @app/db seed
 */
async function activateOriginCities(log: (s: string) => void): Promise<void> {
  const demande = (process.env['SEED_ACTIVATE_ORIGIN_CITIES'] ?? '').trim().toLowerCase();
  if (!['1', 'true', 'yes', 'oui', 'on'].includes(demande)) return;

  if (process.env['NODE_ENV'] === 'production') {
    throw new Error(
      'Ouvrir les villes d’un pays depuis le seed est refusé en production : ' +
        'elles s’ouvrent en back-office, pour que leurs réseaux soient créés (02 §6).',
    );
  }

  const villes = await prisma.city.findMany({
    where: { isActive: false, country: { kind: 'ORIGIN', isActive: true } },
    select: { id: true, name: true, country: { select: { nameFr: true } } },
    orderBy: { name: 'asc' },
  });
  if (villes.length === 0) {
    log('  villes de départ : toutes déjà ouvertes');
    return;
  }

  const maintenant = new Date();
  for (const ville of villes) {
    // `activatedAt` n'est posé QUE s'il est vide : la date à laquelle une ville
    // s'est ouverte est un fait, pas une valeur de seed. Même règle que la pilote.
    await prisma.city.update({
      where: { id: ville.id },
      data: { isActive: true, activatedAt: maintenant },
    });
  }
  const pays = [...new Set(villes.map((v) => v.country.nameFr))].join(', ');
  log(`  villes de départ : ${villes.length} ouverte(s) — ${pays} (réseaux NON créés)`);
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
