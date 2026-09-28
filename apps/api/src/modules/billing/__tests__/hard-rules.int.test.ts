import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { newId } from '@app/db';
import { CAPABILITIES, NEVER_PAID_CAPABILITIES, helpListQuerySchema } from '@app/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditService } from '../../../common/audit.service';
import { CryptoService } from '../../../common/crypto.service';
import { OutboxService } from '../../../common/outbox.service';
import { PrismaService } from '../../../common/prisma.service';
import { TokenService } from '../../../common/token.service';
import { VisibilityService } from '../../../common/visibility.service';
import { FakeCaptchaProvider, FakeSmsProvider } from '../../../providers/providers';
import { AuthService } from '../../auth/auth.service';
import { ConsentsService } from '../../consents/consents.service';
import { HelpService } from '../../help/help.service';

/**
 * Les règles dures du §2 de 14-monetisation.md — celles que TIENT UNE ABSENCE DE
 * CODE.
 *
 * « L'entraide, les guides, le parrainage, les réseaux, la participation aux
 * événements ne sont jamais conditionnés à un plan. AUCUNE ROUTE de ces modules ne
 * vérifie `users.plan`. »
 * « Un plan ne donne JAMAIS de priorité dans l'affichage de l'entraide, du
 * parrainage ni des guides. »
 * « Aucun encart partenaire dans le fil, l'entraide, les guides, les réseaux, la
 * messagerie. »
 *
 * LE PROBLÈME QUE CE FICHIER RÉSOUT. Une règle qui interdit d'écrire quelque chose
 * ne lève jamais : le code conforme et le code fautif passent tous les deux les
 * tests fonctionnels, puisque le fautif fait simplement PLUS. Les tests ci-dessous
 * lisent donc la SOURCE, et une liste fermée se compte. Ils tombent le jour où
 * quelqu'un ajoute la ligne interdite — c'est leur seule raison d'être, et c'est
 * ainsi qu'ils ont été éprouvés (mutation notée en tête de chacun).
 *
 * Un test statique n'est pas un test de style : il porte sur des fichiers NOMMÉS,
 * pas sur un motif général, et chaque nom est là parce que la spec le cite.
 */

/** La racine de `apps/api/src`, trouvée sans `import.meta` (module CommonJS). */
function apiSrc(): string {
  let dir = process.cwd();
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(join(dir, 'src', 'app.module.ts'))) return join(dir, 'src');
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`apps/api/src introuvable depuis ${process.cwd()}`);
}

function sourceOf(relative: string): string {
  const path = resolve(apiSrc(), relative);
  if (!existsSync(path)) throw new Error(`Fichier attendu absent : ${relative}`);
  return readFileSync(path, 'utf8');
}

/**
 * La source, COMMENTAIRES RETIRÉS.
 *
 * Indispensable : les fichiers de ce dépôt expliquent longuement les règles, et
 * « ce fichier ne lit jamais `users.plan` » contient littéralement `users.plan`.
 * Un test qui chercherait le motif dans le texte brut échouerait sur les
 * commentaires qui le documentent — donc on le retire, et la recherche porte sur
 * le CODE.
 */
function codeOf(relative: string): string {
  return sourceOf(relative)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * Les modules dont la spec dit qu'ils ne sont JAMAIS payants (§2, première règle
 * dure). La liste est écrite, et non déduite : c'est la transcription de la phrase.
 */
const NEVER_PAID_FILES = [
  'modules/help/help.service.ts',
  'modules/help/help.controller.ts',
  'modules/guides/guides.service.ts',
  'modules/guides/guides.controller.ts',
  'modules/mentorship/mentorship.service.ts',
  'modules/mentorship/mentorship.controller.ts',
  'modules/communities/communities.service.ts',
  'modules/communities/communities.controller.ts',
  'modules/feed/feed.service.ts',
  'modules/messaging/messaging.service.ts',
] as const;

/**
 * Les modules qui ONT le droit de lire `users.plan`, parce que la matrice des
 * capacités leur donne une limite de plan (00 §7.3) : parcours, agenda, annuaire
 * pro, offres d'emploi — et la facturation elle-même.
 */
const PLAN_AWARE_FILES = [
  'modules/journeys/journeys.service.ts',
  'modules/events/events.service.ts',
  'modules/pros/pros.service.ts',
  'modules/jobs/jobs.service.ts',
] as const;

describe('règles dures de monétisation tenues par une absence de code (14 §2, §12)', () => {
  // ── Fixtures ──────────────────────────────────────────────────────────────

  let prisma: PrismaService;
  let help: HelpService;
  let auth: AuthService;
  const sms = new FakeSmsProvider();
  const createdUserIds: string[] = [];
  let premiumUserId = '';
  let freeUserId = '';
  let cityLyon = '';
  let counter = 0;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    const outbox = new OutboxService(prisma);
    const audit = new AuditService(prisma);
    const visibility = new VisibilityService(prisma);
    help = new HelpService(prisma, outbox, audit, visibility);
    auth = new AuthService(
      prisma,
      new CryptoService(),
      outbox,
      new TokenService(),
      new ConsentsService(prisma),
      sms,
      new FakeCaptchaProvider(),
    );

    const city = await prisma.city.findUniqueOrThrow({ where: { slug: 'lyon' } });
    cityLyon = city.id;
    // §4 de 06 filtre sur la ville : la ville pilote est inactive au seed, mais
    // l'entraide ne le vérifie pas — c'est bien la même ville pour les deux auteurs
    // qui compte ici.

    const member = async (plan: 'FREE' | 'PREMIUM'): Promise<string> => {
      const { challengeId } = await auth.requestOtp({
        phone: `07${String(Date.now()).slice(-6)}${String(counter++).padStart(2, '0')}`,
        countryIso2: 'BJ',
        captchaToken: 'test',
        purpose: 'SIGNUP',
        ip: undefined,
      });
      const session = await auth.verifyOtp({
        challengeId,
        code: sms.lastCodeSent() as string,
        ip: undefined,
        userAgent: undefined,
      });
      createdUserIds.push(session.userId);
      await prisma.user.update({
        where: { id: session.userId },
        data: { verificationLevel: 'L1', plan, cityId: cityLyon, displayName: `Recette ${newId().slice(0, 6)}` },
      });
      return session.userId;
    };

    premiumUserId = await member('PREMIUM');
    freeUserId = await member('FREE');
  });

  afterAll(async () => {
    // `help_requests` est en CASCADE sur `users` : supprimer les membres retire
    // leurs demandes avec eux.
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // « L'aide n'est jamais payante »
  // ══════════════════════════════════════════════════════════════════════════

  describe('RÈGLE DURE — aucune route d’entraide, guides, parrainage, réseaux ne lit users.plan', () => {
    /**
     * MUTATION : ajouter `select: { plan: true }` dans `HelpService.list` → ce test
     * tombe. Éprouvé sur les dix fichiers.
     */
    it('les dix fichiers concernés ne lisent jamais le plan du membre', () => {
      const offenders: string[] = [];
      for (const file of NEVER_PAID_FILES) {
        const code = codeOf(file);
        // Les cinq formes qu'une lecture de plan peut prendre en Prisma ou en TS.
        const patterns = [
          /\bplan\s*:\s*true\b/,
          /\bplan\s*!==?\s*['"]/,
          /\bplan\s*===?\s*['"]/,
          /\.plan\b/,
          /\bUserPlan\b/,
          /\bPLAN_LIMIT_REACHED\b/,
          /\bplanLimit\b/,
        ];
        for (const pattern of patterns) {
          if (pattern.test(code)) offenders.push(`${file} → ${String(pattern)}`);
        }
      }
      expect(
        offenders,
        `Ces fichiers lisent un plan, ce que la règle dure du §2 interdit :\n  ${offenders.join('\n  ')}`,
      ).toEqual([]);
    });

    /**
     * L'autre moitié de la règle, côté matrice des capacités.
     *
     * MUTATION : donner `planLimit: 'maxActiveJourneys'` à `help.ask` dans
     * `capabilities.ts` → ce test tombe.
     */
    it('les capacités de l’aide, des guides et du parrainage portent planLimit: null', () => {
      const mustBeFree = [
        'help.ask',
        'help.offer',
        'guide.write',
        'guide.vote',
        'guide.propose_revision',
        'mentorship.request',
        'mentor.become',
        'community.create',
        'message.send',
        'connection.request',
        'event.attend',
        'comment.create',
        'post.create',
        'content.read',
        'report.create',
        'sanction.appeal',
        'housing.publish',
        'journey.manage',
      ] as const;

      for (const capability of mustBeFree) {
        expect(CAPABILITIES[capability].planLimit, capability).toBeNull();
        expect(NEVER_PAID_CAPABILITIES).toContain(capability);
      }
    });

    /**
     * Et les modules qui ONT le droit de lire un plan doivent lire la LIMITE en base
     * — `plans.limits` est « la source unique des quotas » (§3).
     *
     * MUTATION : remplacer le `prisma.plan.findUnique` de `EventsService` par la
     * constante `FREE_EVENTS_PER_MONTH` → ce test tombe. C'est ce qui vérifie que
     * l'amorçage de `plans` sert réellement à quelque chose : sans lecture en base,
     * amorcer la table ne changerait rien.
     */
    it('les quatre modules à quota lisent leur limite DEPUIS plans.limits', () => {
      const expectedKey: Record<string, string> = {
        'modules/journeys/journeys.service.ts': 'maxActiveJourneys',
        'modules/events/events.service.ts': 'eventsPerMonth',
        'modules/pros/pros.service.ts': 'proContactsPerMonth',
        'modules/jobs/jobs.service.ts': 'sponsoredJobsPerMonth',
      };

      for (const file of PLAN_AWARE_FILES) {
        const code = codeOf(file);
        expect(code, `${file} ne lit pas la table plans`).toMatch(
          /\bplan\.findUnique\s*\(\s*\{\s*\n?\s*where:\s*\{\s*code/,
        );
        expect(code, `${file} ne lit pas la bonne clé de limite`).toContain(
          expectedKey[file] as string,
        );
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // « Un plan ne donne jamais de priorité d'affichage »
  // ══════════════════════════════════════════════════════════════════════════

  describe('RÈGLE DURE — un plan ne donne aucune priorité d’affichage (§2)', () => {
    /**
     * Le verrou STATIQUE : aucun `orderBy` du dépôt ne nomme un plan, un niveau
     * d'abonnement ou un palier pro dans l'entraide, le parrainage ou les guides.
     *
     * MUTATION : écrire `orderBy: [{ author: { plan: 'desc' } }, { id: 'desc' }]`
     * dans `HelpService.list` → ce test tombe. C'est la seule façon d'attraper une
     * règle qui interdit d'ÉCRIRE quelque chose : rien ne lève quand on l'écrit.
     */
    it('aucun tri de l’entraide, du parrainage ou des guides ne mentionne un plan', () => {
      const scoped = [
        'modules/help/help.service.ts',
        'modules/guides/guides.service.ts',
        'modules/mentorship/mentorship.service.ts',
      ] as const;

      const offenders: string[] = [];
      for (const file of scoped) {
        const code = codeOf(file);
        // Chaque `orderBy: …` du fichier, jusqu'à la fin de sa ligne ou de son bloc.
        for (const match of code.matchAll(/orderBy:\s*(\[[^\]]*\]|\{[^}]*\})/g)) {
          const clause = match[1] ?? '';
          if (/\bplan\b|\bpremium\b|\btier\b|\bisSponsored\b|\bsponsored/i.test(clause)) {
            offenders.push(`${file} → ${clause.replace(/\s+/g, ' ')}`);
          }
        }
      }
      expect(
        offenders,
        `Un tri fondé sur le plan a été trouvé, ce que la règle dure du §2 interdit :\n  ${offenders.join('\n  ')}`,
      ).toEqual([]);
    });

    /**
     * Et le verrou FONCTIONNEL, sur la même règle : deux demandes d'entraide, l'une
     * d'un membre Premium, l'autre d'un membre gratuit, sortent dans l'ordre
     * CHRONOLOGIQUE et dans aucun autre.
     *
     * MUTATION : la même que ci-dessus (`orderBy: [{ author: { plan: 'desc' } }]`) →
     * ce test tombe AUSSI. Les deux verrous ne sont pas redondants : le statique
     * attrape la ligne, le fonctionnel attrape un tri fait en mémoire après la
     * requête, que le premier ne verrait pas.
     */
    it('une demande d’un membre Premium ne passe pas devant celle d’un membre gratuit', async () => {
      const premiumCreated = await help.create(
        { userId: premiumUserId, level: 'L1' },
        {
          kind: 'REQUEST',
          type: 'PAPERWORK',
          title: 'Demande d’un membre Premium pour la recette',
          body: 'Texte suffisamment long pour passer les contrôles de publication du module 06.',
          cityId: cityLyon,
        },
      );
      const freeCreated = await help.create(
        { userId: freeUserId, level: 'L1' },
        {
          kind: 'REQUEST',
          type: 'PAPERWORK',
          title: 'Demande d’un membre gratuit pour la recette',
          body: 'Texte suffisamment long pour passer les contrôles de publication du module 06.',
          cityId: cityLyon,
        },
      );

      // PRÉMISSE : les deux auteurs ont bien des plans différents, et la gratuite
      // est la PLUS RÉCENTE — donc première en tri chronologique descendant.
      const plans = await prisma.user.findMany({
        where: { id: { in: [premiumUserId, freeUserId] } },
        select: { id: true, plan: true },
      });
      expect(plans.find((p) => p.id === premiumUserId)?.plan).toBe('PREMIUM');
      expect(plans.find((p) => p.id === freeUserId)?.plan).toBe('FREE');

      const listed = await help.list(
        { userId: freeUserId, level: 'L1' },
        helpListQuerySchema.parse({ cityId: cityLyon, radiusKm: '0', limit: '50' }),
      );
      const ids = listed.items.map((i) => i.id);
      const premiumIndex = ids.indexOf(premiumCreated.request.id);
      const freeIndex = ids.indexOf(freeCreated.request.id);
      expect(premiumIndex).toBeGreaterThanOrEqual(0);
      expect(freeIndex).toBeGreaterThanOrEqual(0);
      // La plus récente d'abord, quel que soit le plan de son auteur.
      expect(freeIndex).toBeLessThan(premiumIndex);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // « Aucun encart partenaire ailleurs »
  // ══════════════════════════════════════════════════════════════════════════

  describe('RÈGLE DURE — aucun encart partenaire hors étape et pied de Logement (§2)', () => {
    /**
     * MUTATION : ajouter `import { PartnersService } from '../partners/partners.service'`
     * à `FeedService` → ce test tombe. Un encart ne peut pas apparaître dans un
     * module qui ne connaît pas le service qui les résout.
     */
    it('aucun module de contenu ne connaît le service des partenaires', () => {
      const forbidden = [
        'modules/feed/feed.service.ts',
        'modules/feed/feed.controller.ts',
        'modules/help/help.service.ts',
        'modules/help/help.controller.ts',
        'modules/guides/guides.service.ts',
        'modules/guides/guides.controller.ts',
        'modules/communities/communities.service.ts',
        'modules/communities/communities.controller.ts',
        'modules/messaging/messaging.service.ts',
        'modules/messaging/messaging.controller.ts',
        'modules/search/search.service.ts',
        'modules/cities/cities.service.ts',
        'modules/events/events.service.ts',
      ] as const;

      const offenders: string[] = [];
      for (const file of forbidden) {
        const code = codeOf(file);
        if (/PartnersService|partnerPlacement|partner_placements|affiliateClick/i.test(code)) {
          offenders.push(file);
        }
      }
      expect(
        offenders,
        `Ces modules touchent aux encarts partenaires, ce que la règle dure du §2 interdit :\n  ${offenders.join('\n  ')}`,
      ).toEqual([]);
    });

    /**
     * L'inverse aussi : le service des partenaires ne doit être injecté QUE là où il
     * a le droit de l'être. Un balayage de tout `src` plutôt qu'une liste, parce
     * qu'ici c'est l'exhaustivité qui compte — un nouveau module ne doit pas pouvoir
     * s'y brancher sans que ce test le voie.
     */
    it('PartnersService n’est référencé que par son propre module et le câblage', () => {
      const allowed = new Set([
        'modules/partners/partners.service.ts',
        'modules/partners/partners.controller.ts',
        'modules/billing/billing-admin.controller.ts',
        'app.module.ts',
      ]);

      const offenders: string[] = [];
      for (const file of walk(apiSrc())) {
        if (file.includes('__tests__')) continue;
        if (allowed.has(file)) continue;
        if (/\bPartnersService\b/.test(codeOf(file))) offenders.push(file);
      }
      expect(offenders).toEqual([]);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // « Aucune donnée de carte sur le serveur »
  // ══════════════════════════════════════════════════════════════════════════

  describe('RÈGLE DURE — aucune donnée de carte ne transite par le serveur (§4.1)', () => {
    /**
     * Le verrou le plus fort possible : la BASE n'a aucune colonne où la mettre.
     *
     * MUTATION : ajouter une colonne `card_last4` au schéma Prisma → ce test tombe.
     * Un test sur le schéma et non sur le code : une donnée de carte qui ne peut
     * être écrite nulle part ne peut pas fuir, quel que soit le code écrit demain.
     */
    it('aucune table du schéma ne peut stocker une donnée de carte', () => {
      const schemaDir = resolve(apiSrc(), '..', '..', '..', 'packages', 'db', 'prisma', 'schema');
      expect(existsSync(schemaDir), schemaDir).toBe(true);

      const forbidden =
        /\b(card_number|cardNumber|card_last4|cardLast4|pan|cvc|cvv|exp_month|expMonth|exp_year|expYear|card_holder|cardHolder|card_token|cardToken)\b/i;

      const offenders: string[] = [];
      for (const file of readdirSync(schemaDir).filter((f) => f.endsWith('.prisma'))) {
        const content = readFileSync(join(schemaDir, file), 'utf8')
          .replace(/^\s*\/\/.*$/gm, '')
          .replace(/^\s*\/\/\/.*$/gm, '');
        const match = forbidden.exec(content);
        if (match !== null) offenders.push(`${file} → ${match[0]}`);
      }
      expect(offenders).toEqual([]);
    });

    /**
     * Et rien n'arrive en base par un autre chemin : la base entière est balayée à
     * la recherche d'un numéro de carte de test. C'est le contrôle qu'on refait après
     * un exercice au curl, et il vaut mieux qu'une relecture.
     */
    it('aucune ligne de paiement ne contient une suite de 16 chiffres', async () => {
      const rows = await prisma.$queryRaw<{ line: string }[]>`
        SELECT row_to_json(p)::text AS line FROM payments p
      `;
      for (const row of rows) {
        expect(row.line).not.toMatch(/\d{16}/);
      }
    });
  });

});

/** Tous les `.ts` sous `dir`, en chemins relatifs à `dir`. */
function walk(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walk(join(dir, entry.name), relative));
    else if (entry.name.endsWith('.ts')) out.push(relative);
  }
  return out;
}
