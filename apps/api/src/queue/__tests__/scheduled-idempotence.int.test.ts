import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { newId } from '@app/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../common/prisma.service';
import { ScheduledTaskRegistry, leaseMs, retryPolicy } from '../scheduled-tasks';

/**
 * Idempotence des vingt-sept tâches de §9.3, contre la VRAIE base.
 *
 * « Toutes les tâches sont idempotentes », dit §9.3. Chaque module l'a écrit dans
 * ses propres tests, sur son propre balayage, avec ses propres données. Ce
 * fichier éprouve autre chose, et c'est ce que seul l'ordonnanceur peut éprouver :
 * que les vingt-sept, LANCÉES ENSEMBLE et DEUX FOIS DE SUITE, ne bougent plus rien
 * au second passage.
 *
 * Deux défauts que cette forme attrape et que les tests par module ne peuvent pas :
 *
 *   · un COMPTEUR DÉNORMALISÉ qu'un second passage réincrémente. Une insertion
 *     protégée par un `skipDuplicates` ne duplique pas la ligne, et incrémente
 *     tout de même le compteur si l'incrément est hors de la même condition. Le
 *     test par module ne le voit pas, parce qu'il ne relance pas ;
 *   · une tâche qui CASSE en vrai. Plusieurs de ces balayages sont du SQL brut
 *     (`$executeRaw`) : `tsc` ne le relit pas, et un nom de colonne faux ne se
 *     découvre qu'à l'exécution — c'est-à-dire, sans ce test, la nuit, dans un
 *     worker que personne ne regarde.
 *
 * LE `now` EST DÉCALÉ DE CENT JOURS, volontairement. Avec l'heure courante, la
 * plupart des balayages ne trouveraient rien à faire, et un test qui compare deux
 * passages sans travail ne prouve rien. À cent jours, les délais de §9.3 (45
 * jours sans réponse, 60 jours d'inactivité, 30 jours de demande de contact) sont
 * tous franchis : le premier passage TRAVAILLE, et c'est seulement alors que le
 * second devient une mesure.
 *
 * Conséquence assumée : cette suite MODIFIE la base de développement — elle
 * archive, expire et dépublie pour de vrai. C'est le prix d'un test qui parle à
 * la vraie base ; les autres suites créent leurs propres données.
 */

/** Ce qu'on surveille : le nombre de lignes et la somme de chaque compteur. */
interface Empreinte {
  readonly lignes: Record<string, number>;
  readonly compteurs: Record<string, number>;
}

describe('idempotence des tâches planifiées (§9.3)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let registry: ScheduledTaskRegistry;

  /** Cent jours devant : assez pour franchir tous les délais de §9.3. */
  const creneau = new Date(Date.now() + 100 * 86_400_000);
  const marque = `ordo-${Date.now().toString(36)}`;
  const ids = {
    auteur: newId(),
    membre: newId(),
    reseau: newId(),
    sujet: newId(),
    storyEchue: newId(),
    storyVivante: newId(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    // `init()` déclenche les `onModuleInit`, donc le câblage des tâches. Le
    // PLANIFICATEUR, lui, ne démarre pas : `APP_ROLE` vaut `api` en test, et c'est
    // exactement ce qu'on veut — on veut le registre, pas l'horloge.
    await app.init();
    prisma = app.get(PrismaService);
    registry = app.get(ScheduledTaskRegistry);
    await semer(prisma, ids, marque);
  });

  afterAll(async () => {
    // Le réseau emporte ses membres et ses sujets en cascade ; les stories non
    // purgées et les deux membres partent à la main.
    await prisma.story.deleteMany({ where: { id: { in: [ids.storyEchue, ids.storyVivante] } } });
    await prisma.community.deleteMany({ where: { id: ids.reseau } });
    await prisma.user.deleteMany({ where: { id: { in: [ids.auteur, ids.membre] } } });
    await prisma.domainEvent.deleteMany({
      where: { aggregateId: { in: [ids.reseau, ids.storyEchue, ids.storyVivante] } },
    });
    await app?.close();
  });

  /**
   * Le câblage est-il complet ? La question a l'air bête et c'est celle qui a
   * motivé tout ce travail : dix-huit méthodes écrites, testées, et appelées par
   * personne.
   */
  it('les tâches des modules sont TOUTES enregistrées', () => {
    const attendues = [
      'story.expire',
      'story.score_recompute',
      'story.purge_history',
      'event.reminders',
      'event.mark_done',
      'event.hide_cancelled',
      'moderation.release_stale',
      'sanctions.expire',
      'moderation.sla_alert',
      'scam_alerts.expire',
      'moderation.purge_reports',
      'help.archive',
      'guide.freshness_recompute',
      'guide.proposal_escalation',
      'guide.outdated_unpublish',
      'guide.author_inactivity',
      'community.archive_inactive',
      'community.topic_archive',
      'community.member_count_recompute',
      'listing.expire.housing',
      'listing.expire.jobs',
      'sponsored.expire',
      'pro.tier_expire',
      'mentorship.end_due',
      'mentorship.expire_requests',
      'connection.expire_requests',
      'mentor.rating_recompute',
      // Ajoutées quand les modules qui les portent sont arrivés. La liste est
      // écrite EN DUR, et c'est voulu : la comparer au registre lui-même ne
      // prouverait rien. Une tâche qui disparaît doit faire rougir ce test, et
      // une tâche qui apparaît doit obliger à venir l'inscrire ici — donc à
      // vérifier son nom contre §9.3, puisque c'est sous ce nom qu'on la
      // cherchera dans le journal et dans le runbook.
      'city.member_count_recompute',
      'notifications.quiet_hours_flush',
      'notifications.weekly_digest',
      'notifications.purge',
      'push.cleanup',
      'staff.session_cleanup',
      // Module 14 (§10). `billing.expiry_reminders` figurait dans la liste
      // « ce qui manque encore » de `task-registrations.service.ts` : elle en est
      // sortie avec la livraison du module. `affiliate.reconcile` y reste, faute de
      // partenaire exposant une API à interroger.
      'billing.expiry_reminders',
      'billing.expire_subscriptions',
      'billing.trial_end',
      'usage.reset',
      // ── Module 01 : compte et identité (01 §8) ──────────────────────────────
      //
      // `account.deletion_execute` est la tâche que dix modules attendaient : leur
      // gestionnaire `handleUserDeleted` était abonné à `user.deleted`, et personne
      // n'émettait cet événement. Aucune suppression de compte n'aboutissait, dans
      // aucun module.
      'account.deletion_execute',
      'account.deactivated_purge',
      'user.phase_progression',
      'otp.purge',
      'kyc.expire_sessions',
    ];

    expect(registry.all().map((t) => t.name).sort()).toEqual([...attendues].sort());
  });

  it('chaque tâche a une cadence exploitable : un bail borné et une reprise décidée', () => {
    for (const task of registry.all()) {
      const bail = leaseMs(task.schedule);
      // Un bail qui dépasserait la période bloquerait le créneau suivant.
      expect(bail, task.name).toBeLessThan(task.schedule.intervalMs);
      expect(bail, task.name).toBeGreaterThan(0);
      expect(retryPolicy(task.schedule).attempts, task.name).toBeGreaterThanOrEqual(1);
      expect(task.module, task.name).not.toBe('');
    }
  });

  /**
   * ═══ LE TEST ═══
   *
   * Premier passage : il travaille. Second passage, même `now` : il ne doit plus
   * rien changer — ni une ligne, ni un compteur.
   *
   * On compare l'empreinte d'APRÈS le premier passage à celle d'après le second.
   * Comparer avant/après le premier n'aurait aucun sens : le premier passage est
   * censé changer les choses.
   */
  it('deux passages de suite : le second ne bouge AUCUN compteur', async () => {
    const premier = await registry.runAll(creneau);
    // Une tâche qui lève n'est pas seulement non idempotente : elle est cassée.
    expect(premier.failures, 'tâches en échec au premier passage').toEqual([]);
    expect(premier.runs).toHaveLength(registry.all().length);

    // PRÉMISSE. Un test qui compare deux passages sans travail passerait aussi sur
    // une base vide, c'est-à-dire pour rien. On vérifie donc que le premier
    // passage a VRAIMENT balayé les données semées.
    const reseau = await prisma.community.findUnique({ where: { id: ids.reseau } });
    expect(reseau?.status, 'le réseau inactif n’a pas été archivé').toBe('ARCHIVED');
    // Le compteur était volontairement faux (99) pour un seul membre actif.
    expect(reseau?.memberCount, 'le compteur de membres n’a pas été recalculé').toBe(1);
    expect((await prisma.topic.findUnique({ where: { id: ids.sujet } }))?.status).toBe('ARCHIVED');
    // Expirée puis purgée dans le même passage : 30 jours après expiration, et
    // aucun signet ne la retient.
    expect(await prisma.story.findUnique({ where: { id: ids.storyEchue } })).toBeNull();
    const vivante = await prisma.story.findUnique({ where: { id: ids.storyVivante } });
    // 7 avis utiles − 2 inutiles : le score était resté à 0.
    expect(Number(vivante?.score), 'le score de story n’a pas été recalculé').toBe(5);

    const apresPremier = await empreinte(prisma);

    const second = await registry.runAll(creneau);
    expect(second.failures, 'tâches en échec au second passage').toEqual([]);

    const apresSecond = await empreinte(prisma);

    // Diffé explicitement plutôt que par `toEqual` sur l'objet entier : sur cent
    // trente valeurs, le rapport d'échec de vitest est illisible, et ce qu'on veut
    // lire est « quelle table, et de combien ».
    expect(differences(apresPremier, apresSecond)).toEqual([]);
  });

  /**
   * Et un troisième passage, avec un `now` qui AVANCE.
   *
   * Un balayage peut être idempotent à `now` fixe et faux dès que le temps passe —
   * typiquement s'il recalcule une valeur dérivée du temps écoulé et l'ajoute au
   * lieu de la remplacer. C'est le défaut que `freshness_score` et `score`
   * pourraient avoir, et le seul moyen de le voir est de bouger l'horloge.
   */
  it('avancer l’horloge d’une heure ne rejoue pas le travail déjà fait', async () => {
    const avant = await empreinte(prisma);
    const { failures } = await registry.runAll(new Date(creneau.getTime() + 3_600_000));
    expect(failures).toEqual([]);

    expect(differences(avant, await empreinte(prisma))).toEqual([]);
  });
});

/**
 * De quoi donner du travail au premier passage.
 *
 * Écrit avec Prisma et non par les vrais parcours d'écriture, à dessein : ce
 * fichier n'éprouve ni la publication d'une story ni la création d'un réseau —
 * les modules le font déjà. Il lui faut des lignes DANS UN ÉTAT donné, y compris
 * un état que l'API n'accepterait pas d'écrire (un `member_count` faux), parce
 * que c'est justement ce qu'un recalcul doit réparer.
 */
async function semer(
  prisma: PrismaService,
  ids: Record<string, string>,
  marque: string,
): Promise<void> {
  const pays = await prisma.country.findFirstOrThrow({ select: { id: true } });
  const ville = await prisma.city.findFirstOrThrow({ select: { id: true } });
  const maintenant = new Date();

  for (const [cle, id] of [
    ['auteur', ids['auteur']],
    ['membre', ids['membre']],
  ] as const) {
    await prisma.user.create({
      data: {
        id: id as string,
        handle: `${marque}-${cle}`,
        displayName: `${marque} ${cle}`,
        phase: 'SETTLED',
        verificationLevel: 'L0',
        originCountryId: pays.id,
        cityId: ville.id,
        plan: 'FREE',
        status: 'ACTIVE',
        lastSeenAt: maintenant,
      },
    });
  }

  await prisma.community.create({
    data: {
      id: ids['reseau'] as string,
      kind: 'INTEREST',
      name: `Réseau ${marque}`,
      slug: `reseau-${marque}`,
      category: 'cuisine',
      visibility: 'PUBLIC',
      createdByUserId: ids['auteur'] as string,
      status: 'ACTIVE',
      // Dernière activité aujourd'hui : à `now + 100 jours`, les 60 jours de §7
      // sont franchis et l'archivage doit se déclencher.
      lastActivityAt: maintenant,
      // FAUX exprès : un seul membre actif. C'est ce que
      // `community.member_count_recompute` doit corriger — et ce qu'un second
      // passage ne doit pas réincrémenter.
      memberCount: 99,
      members: {
        create: [
          {
            id: newId(),
            userId: ids['auteur'] as string,
            role: 'OWNER',
            status: 'ACTIVE',
            joinedAt: maintenant,
          },
          // En attente : ne doit PAS être compté. Un recalcul qui compterait tous
          // les membres rendrait 2, et le test le verrait.
          { id: newId(), userId: ids['membre'] as string, role: 'MEMBER', status: 'PENDING' },
        ],
      },
      topics: {
        create: [
          {
            id: ids['sujet'] as string,
            authorUserId: ids['auteur'] as string,
            title: `Sujet ${marque}`,
            body: 'Corps du sujet de test.',
            status: 'OPEN',
            pinKind: 'NONE',
            lastReplyAt: maintenant,
          },
        ],
      },
    },
  });

  const storyCommune = {
    authorUserId: ids['auteur'] as string,
    type: 'CONSEIL' as const,
    textStyle: 'BOLD' as const,
    cityId: ville.id,
    audience: 'ALL' as const,
    allowMessages: false,
    status: 'ACTIVE' as const,
    moderationStatus: 'CLEARED' as const,
  };

  await prisma.story.create({
    data: {
      ...storyCommune,
      id: ids['storyEchue'] as string,
      body: `Story échue ${marque}`,
      // Déjà passée au créneau : `story.expire` la passe EXPIRED, puis
      // `story.purge_history` la supprime (30 jours après expiration).
      expiresAt: new Date(maintenant.getTime() + 3_600_000),
    },
  });

  await prisma.story.create({
    data: {
      ...storyCommune,
      id: ids['storyVivante'] as string,
      body: `Story vivante ${marque}`,
      // Toujours active au créneau : c'est elle qui éprouve le recalcul de score.
      expiresAt: new Date(maintenant.getTime() + 200 * 86_400_000),
      positiveCount: 7,
      negativeCount: 2,
      score: 0,
    },
  });
}

/**
 * Le nombre de lignes de chaque table, et la somme de chaque colonne dénormalisée.
 *
 * Les colonnes sont trouvées dans `information_schema` plutôt qu'écrites à la
 * main : le schéma compte 106 tables et une trentaine de compteurs, et une liste
 * recopiée ici serait fausse au premier ajout — ce qui ferait passer le test pour
 * la mauvaise raison.
 */
async function empreinte(prisma: PrismaService): Promise<Empreinte> {
  const tables = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      AND table_name <> '_prisma_migrations'
    ORDER BY table_name`;

  const colonnes = await prisma.$queryRaw<{ table_name: string; column_name: string }[]>`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type IN ('integer', 'bigint', 'smallint', 'numeric', 'double precision')
      AND (column_name LIKE '%count%' OR column_name LIKE '%score%' OR column_name LIKE '%rating%')
      AND table_name <> '_prisma_migrations'
    ORDER BY table_name, column_name`;

  const lignes: Record<string, number> = {};
  for (const { table_name } of tables) {
    // `$queryRawUnsafe` avec un nom de table venu d'`information_schema` : la
    // valeur ne vient pas d'une entrée utilisateur, et un identifiant ne peut pas
    // être passé en paramètre lié.
    const [row] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT COUNT(*)::bigint AS n FROM "${table_name}"`,
    );
    lignes[table_name] = Number(row?.n ?? 0);
  }

  const compteurs: Record<string, number> = {};
  for (const { table_name, column_name } of colonnes) {
    const [row] = await prisma.$queryRawUnsafe<{ s: string | null }[]>(
      `SELECT COALESCE(SUM("${column_name}"), 0)::text AS s FROM "${table_name}"`,
    );
    compteurs[`${table_name}.${column_name}`] = Number(row?.s ?? 0);
  }

  return { lignes, compteurs };
}

/** Ce qui a bougé, sous une forme lisible dans un rapport d'échec. */
function differences(avant: Empreinte, apres: Empreinte): string[] {
  const out: string[] = [];
  for (const groupe of ['lignes', 'compteurs'] as const) {
    for (const [cle, valeur] of Object.entries(apres[groupe])) {
      const precedente = avant[groupe][cle];
      if (precedente !== valeur) out.push(`${groupe}:${cle} ${String(precedente)} → ${valeur}`);
    }
  }
  return out;
}
