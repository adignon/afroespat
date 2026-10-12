import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { newId } from '@app/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../common/prisma.service';
import {
  GUIDE_VIEW_COUNTER,
  GuidesService,
  type GuideViewCounterPort,
} from '../../modules/guides/guides.service';
import { ScheduledTaskRegistry } from '../scheduled-tasks';

/**
 * LES NEUF TÂCHES QUE CE LOT AJOUTE, ÉPROUVÉES UNE PAR UNE, AVEC DES DONNÉES.
 *
 * Pourquoi ce fichier existe alors que `scheduled-idempotence.int.test.ts` lance
 * déjà tout deux fois : parce qu'il lance tout sur la base de DÉVELOPPEMENT, qui
 * ne contient ni parcours, ni guide, ni annonce, ni signet. Les neuf tâches y
 * passaient donc au vert en ne trouvant RIEN À FAIRE — et un test qui compare deux
 * passages sans travail ne prouve rien, ce que ce fichier-là dit lui-même de sa
 * propre prémisse.
 *
 * Chaque tâche est donc éprouvée en trois temps, et les trois sont nécessaires :
 *
 *   1. ELLE TRAVAILLE. Sans cette assertion, les deux suivantes passent sur une
 *      table vide.
 *   2. RELANCÉE AU MÊME INSTANT, elle ne change plus rien.
 *   3. RELANCÉE UNE HEURE PLUS TARD, elle ne rejoue pas ce qui est fait. C'est là
 *      qu'un balayage qui lit l'horloge murale, ou qui ajoute au lieu de remplacer,
 *      se trahit.
 *
 * ELLES SONT LANCÉES PAR LE REGISTRE, `registry.run(nom, instant)`, et jamais en
 * appelant la méthode du service : c'est le CÂBLAGE qu'on veut éprouver autant que
 * la méthode. Une tâche dont la méthode est juste et dont l'entrée manque dans
 * `task-registrations.service.ts` ne tourne pas, et c'est précisément le défaut que
 * tout ce dispositif existe pour rendre impossible.
 *
 * Le résumé rendu par le registre est lu, et il le mérite : c'est la ligne qui part
 * dans le journal du worker, donc la seule chose qu'un incident de production
 * laissera voir. Un test qui ne l'inspecte jamais laisse passer un résumé qui dit
 * « rien à signaler » alors que la tâche a travaillé.
 */

/** Ce que les tables touchées valent, pour diffé ligne à ligne. */
interface Empreinte {
  readonly [cle: string]: string | number | null;
}

describe('les neuf tâches ajoutées par ce lot', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let registry: ScheduledTaskRegistry;
  let guides: GuidesService;
  let compteur: GuideViewCounterPort;

  const marque = `lot-${Date.now().toString(36)}`;
  /**
   * L'INSTANT DE RÉFÉRENCE, figé une fois.
   *
   * Tronqué à la minute : les échéances semées sont des `DATE` (minuit UTC), et un
   * instant à la milliseconde près rendrait les assertions sensibles au moment où la
   * suite démarre sans rien éprouver de plus.
   */
  const T = new Date(Math.floor(Date.now() / 60_000) * 60_000);
  const plusUneHeure = new Date(T.getTime() + 3_600_000);

  const jours = (n: number): Date => new Date(T.getTime() + n * 86_400_000);
  /** Minuit UTC du jour de `T + n jours` — la forme que prend une colonne `DATE`. */
  const echeance = (n: number): Date => {
    const d = jours(n);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  };

  const ids = {
    proprietaire: newId(),
    autre: newId(),
    villeDormante: newId(),
    parcours: newId(),
    etapeJ14: newId(),
    etapeJ7: newId(),
    etapeJ1: newId(),
    etapeFaite: newId(),
    etapeLoin: newId(),
    parcoursInactif: newId(),
    etapeInactive: newId(),
    guide: newId(),
    guideVersion: newId(),
    guidePage: newId(),
    alerte: newId(),
    annonceA: newId(),
    annonceB: newId(),
    annonceC: newId(),
    alerteA: newId(),
    alerteB: newId(),
    alerteC: newId(),
    session: newId(),
    storyExpiree: newId(),
    demandeResolue: newId(),
    evenementPasse: newId(),
    annoncePrise: newId(),
    signetStory: newId(),
    signetDemande: newId(),
    signetEvenement: newId(),
    signetAnnonce: newId(),
    signetGuide: newId(),
    signetFantome: newId(),
  };

  let paysId = '';
  let villeId = '';
  let versionId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    registry = app.get(ScheduledTaskRegistry);
    guides = app.get(GuidesService);
    compteur = app.get<GuideViewCounterPort>(GUIDE_VIEW_COUNTER);
    await semer();
  });

  afterAll(async () => {
    // Dans l'ordre des dépendances : les signets et les sujets, puis les membres
    // (qui emportent en cascade parcours, annonces, alertes et sessions).
    await prisma.bookmark.deleteMany({ where: { userId: { in: [ids.proprietaire, ids.autre] } } });
    await prisma.housingPriceMedian.deleteMany({ where: { cityId: villeId } });
    await prisma.event.deleteMany({ where: { id: ids.evenementPasse } });
    await prisma.helpRequest.deleteMany({ where: { id: ids.demandeResolue } });
    await prisma.story.deleteMany({ where: { id: ids.storyExpiree } });
    await prisma.guide.deleteMany({ where: { id: ids.guide } });
    await prisma.notification.deleteMany({
      where: { userId: { in: [ids.proprietaire, ids.autre] } },
    });
    await prisma.outboundMessage.deleteMany({
      where: { userId: { in: [ids.proprietaire, ids.autre] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: [ids.proprietaire, ids.autre] } } });
    await prisma.city.deleteMany({ where: { id: ids.villeDormante } });
    await prisma.domainEvent.deleteMany({
      where: { aggregateId: { in: [ids.parcours, ids.parcoursInactif] } },
    });
    await app?.close();
  });

  // ══ 03 §8 — les trois tâches du module Parcours ═══════════════════════════

  /**
   * `journey.reminders` — J−14, J−7, J−1.
   *
   * Ce que le test éprouve, et que le seul décompte ne dirait pas : les TROIS
   * échéances sortent, et une QUATRIÈME étape à J−30 ne sort pas. Sans cette
   * dernière, un balayage qui prendrait « toute échéance à venir » passerait.
   */
  it('journey.reminders notifie les trois échéances, et une seule fois chacune', async () => {
    const premier = await registry.run('journey.reminders', T);
    expect(premier.summary, 'le résumé du journal doit dire ce qui est parti').toContain(
      'notified=3',
    );

    const types = (await notificationsDu(ids.proprietaire)).map((n) => n.type).sort();
    expect(types).toEqual(['journey.step_due_j1', 'journey.step_due_j14', 'journey.step_due_j7']);

    // L'étape à J−30 n'est PAS annoncée : une échéance lointaine n'est pas un rappel.
    const lointaine = await prisma.notification.count({
      where: { userId: ids.proprietaire, refId: ids.etapeLoin },
    });
    expect(lointaine, 'une étape à J−30 ne doit déclencher aucun rappel').toBe(0);

    // L'étape DONE non plus, même si son échéance tombe pile à J−7.
    const faite = await prisma.notification.count({
      where: { userId: ids.proprietaire, refId: ids.etapeFaite },
    });
    expect(faite, 'une étape franchie ne se rappelle pas').toBe(0);

    const avant = await empreinteNotifications();
    const second = await registry.run('journey.reminders', T);
    expect(second.summary, 'le second passage doit tout trouver déjà envoyé').toContain(
      'notified=0',
    );
    expect(await empreinteNotifications()).toEqual(avant);

    await registry.run('journey.reminders', plusUneHeure);
    expect(
      await empreinteNotifications(),
      'une heure plus tard, les mêmes échéances ne se renvoient pas',
    ).toEqual(avant);
  });

  /**
   * `journey.inactivity_check` — relance UNIQUE à 60 jours.
   *
   * Le piège éprouvé ici est celui que la méthode nomme : la relance ne doit PAS
   * compter comme une activité. Si elle touchait `last_activity_at`, le parcours
   * repartirait pour soixante jours et la relance reviendrait — « aucune relance
   * ensuite » (§3.9) ne tiendrait pas.
   */
  it('journey.inactivity_check relance une fois, marque, et ne touche pas l’activité', async () => {
    const avantActivite = await prisma.journey.findUniqueOrThrow({
      where: { id: ids.parcoursInactif },
      select: { lastActivityAt: true },
    });

    const premier = await registry.run('journey.inactivity_check', T);
    expect(premier.summary).toContain('prompted=1');

    const apres = await prisma.journey.findUniqueOrThrow({
      where: { id: ids.parcoursInactif },
      select: { inactivityPromptSentAt: true, lastActivityAt: true },
    });
    expect(apres.inactivityPromptSentAt?.getTime()).toBe(T.getTime());
    expect(
      apres.lastActivityAt.getTime(),
      'la relance n’est pas une activité : sinon elle reviendrait dans 60 jours',
    ).toBe(avantActivite.lastActivityAt.getTime());

    expect(
      await prisma.notification.count({
        where: { userId: ids.autre, type: 'journey.inactivity_prompt' },
      }),
    ).toBe(1);

    const second = await registry.run('journey.inactivity_check', T);
    expect(second.summary).toContain('prompted=0');

    // Et cent jours plus tard non plus : « aucune relance ensuite ».
    await registry.run('journey.inactivity_check', jours(100));
    expect(
      await prisma.notification.count({
        where: { userId: ids.autre, type: 'journey.inactivity_prompt' },
      }),
      'une seconde relance, cent jours plus tard, contredirait §3.9',
    ).toBe(1);
  });

  /**
   * `journey.progress_recompute` — la tâche « de sécurité » du §8.
   *
   * Le parcours est semé avec un `progress_pct` FAUX (0 pour une étape franchie sur
   * cinq comptées) et un `current_step_id` nul. C'est exactement l'état qu'une
   * écriture manquée laisse derrière elle, et ce que la tâche doit réparer.
   */
  it('journey.progress_recompute répare un pourcentage faux, et ne le rejoue pas', async () => {
    const premier = await registry.run('journey.progress_recompute', T);
    expect(premier.summary).toContain('changed=');

    const apres = await prisma.journey.findUniqueOrThrow({
      where: { id: ids.parcours },
      select: { progressPct: true, currentStepId: true },
    });
    // Cinq étapes comptées, une franchie → 20 %.
    expect(apres.progressPct, 'un cinquième des étapes est franchi').toBe(20);
    // §3.2 : « l'étape en cours est CELLE QUI L'EST » — l'étape `IN_PROGRESS`
    // d'abord, et seulement à défaut la première qui reste à faire. Le semis en pose
    // une en position 3, et c'est elle qui doit sortir : attendre la première `TODO`
    // (position 1) reviendrait à éprouver le repli plutôt que la règle.
    expect(apres.currentStepId).toBe(ids.etapeJ1);

    const second = await registry.run('journey.progress_recompute', T);
    expect(second.summary, 'rien ne change au second passage').toContain('changed=0');

    const troisieme = await registry.run('journey.progress_recompute', plusUneHeure);
    expect(
      troisieme.summary,
      'un pourcentage ne dérive pas avec le temps : il se recalcule identique',
    ).toContain('changed=0');
    expect(
      (
        await prisma.journey.findUniqueOrThrow({
          where: { id: ids.parcours },
          select: { progressPct: true },
        })
      ).progressPct,
    ).toBe(20);
  });

  // ══ 02 §7 — suggestion d'activation ══════════════════════════════════════

  it('city.activation_suggest signale la ville dormante SANS l’activer', async () => {
    const run = await registry.run('city.activation_suggest', T);
    expect(run.summary).toContain('villes=1');

    const ville = await prisma.city.findUniqueOrThrow({
      where: { id: ids.villeDormante },
      select: { isActive: true, activatedAt: true },
    });
    // LA RÈGLE DURE DE CETTE TÂCHE : elle signale, elle n'active pas. Activer
    // créerait un réseau CITY et y inscrirait des membres, ce qu'aucune route ne
    // défait — et §2.2 réserve la décision à l'équipe.
    expect(ville.isActive, 'la tâche ne doit JAMAIS activer une ville').toBe(false);
    expect(ville.activatedAt).toBeNull();

    // Aucun réseau n'a été créé pour cette ville.
    expect(await prisma.community.count({ where: { cityId: ids.villeDormante } })).toBe(0);

    const second = await registry.run('city.activation_suggest', plusUneHeure);
    expect(second.summary, 'une lecture rend la même liste').toContain('villes=1');
  });

  // ══ 05 §7 — le vidage du compteur de vues ════════════════════════════════

  /**
   * `guide.view_count_flush`.
   *
   * DEUX CHOSES SONT ÉPROUVÉES, et la première est celle qui manquait le plus : que
   * quelqu'un INCRÉMENTE. Une tâche de vidage branchée sur un compteur que personne
   * ne remplit vide éternellement du vide, et son journal dirait « 0 » sans que rien
   * ne soit cassé. On passe donc par le VRAI chemin de lecture, `bySlug`.
   *
   * La seconde est l'idempotence : le prélèvement est atomique, donc le second
   * passage n'ajoute pas une seconde fois — c'est le « compteur vidé deux fois ».
   */
  it('guide.view_count_flush verse les vues une fois, et pas deux', async () => {
    // Le vrai chemin : deux lectures publiques du guide.
    await guides.bySlug(`guide-${marque}`, null);
    await guides.bySlug(`guide-${marque}`, ids.autre);

    // Avant le vidage, la base ne sait rien : les vues sont dans Redis.
    expect(
      (
        await prisma.guide.findUniqueOrThrow({
          where: { id: ids.guide },
          select: { viewCount: true },
        })
      ).viewCount,
      'la lecture ne doit pas écrire en base : c’est tout l’objet du tampon Redis',
    ).toBe(0);

    const premier = await registry.run('guide.view_count_flush', T);
    expect(premier.summary).toContain('vues=2');
    expect(
      (
        await prisma.guide.findUniqueOrThrow({
          where: { id: ids.guide },
          select: { viewCount: true },
        })
      ).viewCount,
    ).toBe(2);

    const second = await registry.run('guide.view_count_flush', T);
    expect(second.summary, 'le tampon a été prélevé, il est vide').toContain('vues=0');
    expect(
      (
        await prisma.guide.findUniqueOrThrow({
          where: { id: ids.guide },
          select: { viewCount: true },
        })
      ).viewCount,
      'un second vidage ne doit PAS recompter les mêmes vues',
    ).toBe(2);

    // Une vue de plus après le vidage s'ajoute, elle : le compteur continue.
    await compteur.increment(ids.guide);
    await registry.run('guide.view_count_flush', plusUneHeure);
    expect(
      (
        await prisma.guide.findUniqueOrThrow({
          where: { id: ids.guide },
          select: { viewCount: true },
        })
      ).viewCount,
    ).toBe(3);
  });

  // ══ 10 §9 — médiane de prix et répartition des alertes ═══════════════════

  it('housing.price_median_recompute écrit une ligne par couple, et la corrige', async () => {
    /**
     * ON N'AFFIRME PAS LE TOTAL GLOBAL DE LA TÂCHE, et c'est une correction.
     *
     * Ce test disait `expect(premier.summary).toContain('ecrits=1')`. L'attendu
     * était écrit en dur — ce qui est la bonne discipline — mais il portait sur le
     * nombre de lignes que la tâche écrit DANS TOUTE LA BASE. La base de
     * développement est partagée : dès qu'un autre lot a publié une annonce dans
     * une seconde ville, la tâche a écrit deux lignes et le test a rougi sans qu'un
     * seul de ses défauts soit revenu.
     *
     * La distinction qui compte : on écrit en dur ce qu'on attend de SES PROPRES
     * données, jamais le total d'une base que d'autres remplissent. Les assertions
     * ci-dessous le font déjà, et plus précisément que le résumé — médiane, taille
     * d'échantillon, horodatage, et un décompte filtré sur la ville du test.
     *
     * Troisième borne de ce dépôt devenue fausse par accumulation, après un délai
     * de Playwright et un plafond de pagination.
     */
    await registry.run('housing.price_median_recompute', T);

    const ligne = await prisma.housingPriceMedian.findUniqueOrThrow({
      where: { cityId_kind: { cityId: villeId, kind: 'RENT' } },
    });
    // 700 € / 900 € / 1 100 € → médiane 900 €.
    expect(ligne.medianCents).toBe(90_000);
    expect(ligne.sampleSize).toBe(3);
    expect(ligne.computedAt.getTime()).toBe(T.getTime());

    // AUCUNE écriture au second passage : ni une ligne de plus, ni un `computed_at`
    // rafraîchi. C'est ce qui distingue « la tâche a tourné » de « la tâche a
    // réécrit », et sans cette borne un test ne peut pas faire la différence.
    // Même raison qu'au-dessus : « la tâche n'a rien écrit du tout » n'est pas ce
    // que ce test garde. Ce qu'il garde est « MA ligne n'a pas été réécrite », et
    // c'est l'`computedAt` inchangé juste en dessous qui le dit.
    await registry.run('housing.price_median_recompute', plusUneHeure);
    const inchangee = await prisma.housingPriceMedian.findUniqueOrThrow({
      where: { cityId_kind: { cityId: villeId, kind: 'RENT' } },
    });
    expect(
      inchangee.computedAt.getTime(),
      'une valeur inchangée ne se réécrit pas, même une heure plus tard',
    ).toBe(T.getTime());
    expect(await prisma.housingPriceMedian.count({ where: { cityId: villeId } })).toBe(1);

    // Une annonce prise sort de l'échantillon : la médiane REMPLACE, elle ne
    // s'ajoute pas.
    await prisma.housingListing.update({ where: { id: ids.annonceA }, data: { status: 'TAKEN' } });
    const troisieme = await registry.run('housing.price_median_recompute', plusUneHeure);
    expect(troisieme.summary).toContain('ecrits=1');
    const corrigee = await prisma.housingPriceMedian.findUniqueOrThrow({
      where: { cityId_kind: { cityId: villeId, kind: 'RENT' } },
    });
    // Restent 900 € et 1 100 € → médiane 1 000 €.
    expect(corrigee.medianCents).toBe(100_000);
    expect(corrigee.sampleSize).toBe(2);
    expect(
      await prisma.housingPriceMedian.count({ where: { cityId: villeId } }),
      'une ligne par couple, jamais une par exécution',
    ).toBe(1);
  });

  it('alerts.dispatch regroupe les correspondances et compte ce qu’il a signalé', async () => {
    /**
     * MÊME CORRECTION QUE POUR LA MÉDIANE : `notifiees=1` et `correspondances=3`
     * étaient les totaux de la tâche SUR TOUTE LA BASE. Une seconde alerte créée
     * par un autre lot les fait passer à 2, et le test rougit sans qu'un seul de
     * ses défauts soit revenu.
     *
     * Ce que ce test garde — « trois annonces dans la fenêtre, UNE notification »,
     * le regroupement de §9 — est éprouvé juste en dessous sur l'alerte et le
     * membre du test : une seule notification, son titre, et le compteur à trois.
     * C'est plus précis que le résumé, et ça ne dépend que de ses propres données.
     */
    await registry.run('alerts.dispatch', T);

    const notifications = await prisma.notification.findMany({
      where: { userId: ids.proprietaire, type: 'services.alert_match' },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.title).toContain('3 nouvelles annonces');

    const apres = await prisma.savedAlert.findUniqueOrThrow({ where: { id: ids.alerte } });
    expect(apres.matchCount, 'trois correspondances signalées').toBe(3);
    expect(apres.lastNotifiedAt?.getTime()).toBe(T.getTime());

    // « La tâche n'a notifié personne » n'est pas ce que ce test garde : une autre
    // alerte peut légitimement être notifiée. Ce qu'il garde est « MON compteur ne
    // double pas », et c'est l'assertion juste en dessous.
    await registry.run('alerts.dispatch', T);
    expect(
      (await prisma.savedAlert.findUniqueOrThrow({ where: { id: ids.alerte } })).matchCount,
      'le compteur ne doit pas doubler : c’est LE défaut que l’empreinte traque',
    ).toBe(3);

    // Une heure plus tard, rien de nouveau non plus.
    await registry.run('alerts.dispatch', plusUneHeure);
    expect(
      (await prisma.savedAlert.findUniqueOrThrow({ where: { id: ids.alerte } })).matchCount,
    ).toBe(3);

    /**
     * QUATRIÈME PASSAGE, À DEUX HEURES — et celui-ci n'est pas une répétition.
     *
     * Les trois précédents ne prouvaient PAS ce qu'on croyait. Le répartiteur ne
     * retient que les alertes dont `last_notified_at` a plus d'une heure (« au plus
     * une notification par heure et par alerte », 10 §4.1) : à `T` comme à `T + 1 h`,
     * l'alerte venait d'être servie et était donc écartée AVANT toute recherche de
     * correspondance. Les deux passages éprouvaient le filtre d'éligibilité, pas la
     * borne basse de la fenêtre.
     *
     * C'est une mutation qui l'a montré : remplacer `last_notified_at ?? created_at`
     * par `created_at` seul — ce qui fait recompter éternellement les mêmes annonces
     * — laissait le test VERT. À deux heures, l'alerte est de nouveau éligible, la
     * recherche a vraiment lieu, et c'est là seulement que `match_count` est en
     * danger de doubler.
     */
    const aDeuxHeures = new Date(T.getTime() + 2 * 3_600_000);
    const quatrieme = await registry.run('alerts.dispatch', aDeuxHeures);

    /**
     * « AU MOINS UNE » et non « exactement une », et ces deux assertions ne peuvent
     * PAS être retirées comme les autres totaux globaux l'ont été.
     *
     * Elles sont ce qui distingue « examinée, et rien de nouveau à dire » de
     * « écartée sans être examinée » — et les deux laissent `match_count` à trois.
     * C'est exactement le test creux que ce quatrième passage existe pour refermer :
     * sans elles, une alerte jamais regardée passerait pour une alerte à jour.
     *
     * Mais `alertes=1` affirmait un total sur une base PARTAGÉE : une seconde alerte
     * créée par un autre lot le fait passer à deux. On lit donc le compte dans le
     * résumé et on exige que la nôtre y soit, ce qui survit à une base qui grossit.
     *
     * Et « rien de nouveau » se vérifie sur NOTRE membre : une notification de plus
     * pour quelqu'un d'autre n'est pas notre affaire.
     */
    const examinees = Number(/alertes=(\d+)/.exec(quatrieme.summary)?.[1] ?? '0');
    expect(examinees, 'l’alerte est de nouveau éligible : elle doit être examinée').toBeGreaterThan(
      0,
    );
    expect(
      await prisma.notification.count({
        where: { userId: ids.proprietaire, type: 'services.alert_match' },
      }),
      'examinée, mais sans rien de nouveau à annoncer pour CE membre',
    ).toBe(1);
    expect(
      (await prisma.savedAlert.findUniqueOrThrow({ where: { id: ids.alerte } })).matchCount,
      'une correspondance déjà signalée ne se compte pas deux fois',
    ).toBe(3);
  });

  // ══ Transverse — rétention et état des signets ═══════════════════════════

  it('retention.purge efface les sessions expirées depuis plus de 30 jours, pas les autres', async () => {
    const vivante = newId();
    await prisma.authSession.create({
      data: {
        id: vivante,
        userId: ids.proprietaire,
        refreshTokenHash: `${marque}-vivante`,
        chainId: newId(),
        expiresAt: jours(20),
      },
    });

    const premier = await registry.run('retention.purge', T);
    expect(premier.summary).toContain('sessions=1');
    expect(await prisma.authSession.findUnique({ where: { id: ids.session } })).toBeNull();
    expect(
      await prisma.authSession.findUnique({ where: { id: vivante } }),
      'une session encore valable n’est pas une session expirée depuis 30 jours',
    ).not.toBeNull();

    const second = await registry.run('retention.purge', T);
    expect(second.summary).toContain('sessions=0');

    const troisieme = await registry.run('retention.purge', plusUneHeure);
    expect(troisieme.summary).toContain('sessions=0');
    expect(await prisma.authSession.findUnique({ where: { id: vivante } })).not.toBeNull();

    await prisma.authSession.deleteMany({ where: { id: vivante } });
  });

  /**
   * `bookmark.state_refresh`.
   *
   * Six signets, six états attendus, et le sixième est celui qui compte le plus :
   * un sujet qui n'existe pas doit devenir `REMOVED` et non rester `AVAILABLE`.
   *
   * Le guide éprouve le SEUL état qui dépende de la date du signet : « mis à jour »
   * se compare au moment de l'enregistrement, pas à l'heure courante.
   */
  it('bookmark.state_refresh calcule les six états, puis ne réécrit plus rien', async () => {
    const premier = await registry.run('bookmark.state_refresh', T);
    expect(premier.summary).toContain('changes=6');

    expect(await etatDu(ids.signetStory)).toBe('EXPIRED');
    expect(await etatDu(ids.signetDemande)).toBe('RESOLVED');
    expect(await etatDu(ids.signetEvenement)).toBe('PAST');
    expect(await etatDu(ids.signetAnnonce)).toBe('UNAVAILABLE');
    expect(await etatDu(ids.signetGuide)).toBe('UPDATED');
    expect(await etatDu(ids.signetFantome)).toBe('REMOVED');

    // LE POINT QUI A FAIT ÉCHOUER UNE PREMIÈRE VERSION : deux passes se
    // contredisaient sur le signet de guide, l'une remettant AVAILABLE ce que
    // l'autre venait de mettre à UPDATED. La tâche écrivait donc à chaque créneau et
    // l'état oscillait, sans jamais converger.
    const second = await registry.run('bookmark.state_refresh', T);
    expect(second.summary, 'rien à changer : les six états sont justes').toContain('changes=0');

    const troisieme = await registry.run('bookmark.state_refresh', plusUneHeure);
    expect(
      troisieme.summary,
      'une heure plus tard, les mêmes sujets donnent les mêmes états',
    ).toContain('changes=0');
    expect(await etatDu(ids.signetGuide)).toBe('UPDATED');

    // Et quand le sujet CHANGE, l'état suit — sinon le test ci-dessus passerait
    // aussi sur une tâche qui n'écrit jamais rien.
    await prisma.housingListing.update({
      where: { id: ids.annoncePrise },
      data: { status: 'ACTIVE' },
    });
    const quatrieme = await registry.run('bookmark.state_refresh', plusUneHeure);
    expect(quatrieme.summary).toContain('changes=1');
    expect(await etatDu(ids.signetAnnonce)).toBe('AVAILABLE');
  });

  // ── Outils ────────────────────────────────────────────────────────────────

  async function etatDu(bookmarkId: string): Promise<string> {
    const row = await prisma.bookmark.findUniqueOrThrow({
      where: { id: bookmarkId },
      select: { state: true },
    });
    return row.state;
  }

  async function notificationsDu(userId: string) {
    return prisma.notification.findMany({
      where: { userId, type: { startsWith: 'journey.step_due' } },
      select: { id: true, type: true, refId: true },
    });
  }

  /** Les notifications de parcours ET leurs traces sortantes, pour diffé. */
  async function empreinteNotifications(): Promise<Empreinte> {
    const notifications = await prisma.notification.count({
      where: { userId: { in: [ids.proprietaire, ids.autre] } },
    });
    const outbound = await prisma.outboundMessage.count({
      where: { userId: { in: [ids.proprietaire, ids.autre] } },
    });
    return { notifications, outbound };
  }

  // ── Semis ─────────────────────────────────────────────────────────────────

  async function semer(): Promise<void> {
    const pays = await prisma.country.findFirstOrThrow({
      where: { isActive: true },
      select: { id: true },
    });
    paysId = pays.id;
    const ville = await prisma.city.findFirstOrThrow({
      where: { isActive: true },
      select: { id: true },
    });
    villeId = ville.id;
    const version = await prisma.journeyTemplateVersion.findFirstOrThrow({ select: { id: true } });
    versionId = version.id;

    for (const [cle, id] of [
      ['proprietaire', ids.proprietaire],
      ['autre', ids.autre],
    ] as const) {
      await prisma.user.create({
        data: {
          id,
          handle: `${marque}-${cle}`,
          displayName: `${marque} ${cle}`,
          phase: 'SETTLED',
          verificationLevel: 'L2',
          originCountryId: paysId,
          cityId: villeId,
          plan: 'PREMIUM',
          status: 'ACTIVE',
          lastSeenAt: T,
        },
      });
    }

    // ── 02 §7 : une ville dormante au-dessus du seuil ──────────────────────
    await prisma.city.create({
      data: {
        id: ids.villeDormante,
        countryId: (
          await prisma.city.findUniqueOrThrow({
            where: { id: villeId },
            select: { countryId: true },
          })
        ).countryId,
        name: `Ville ${marque}`,
        slug: `ville-${marque}`,
        latitude: 45,
        longitude: 4,
        isActive: false,
        // Au-dessus des vingt membres de §2.2. Écrit à la main : c'est
        // `city.member_count_recompute` qui l'écrit en vrai, et cette tâche-ci ne
        // fait que le LIRE.
        memberCount: 42,
      },
    });

    // ── 03 §8 : un parcours avec échéances et un pourcentage faux ──────────
    await prisma.journey.create({
      data: {
        id: ids.parcours,
        ownerUserId: ids.proprietaire,
        templateVersionId: versionId,
        title: `Parcours ${marque}`,
        status: 'ACTIVE',
        originCountryId: paysId,
        destinationCityId: villeId,
        lastActivityAt: T,
        // FAUX exprès : une étape sur cinq est franchie, donc 20 %. Et aucune étape
        // en cours, alors qu'il en reste quatre à faire.
        progressPct: 0,
        steps: {
          create: [
            { id: ids.etapeJ14, title: 'Visa', position: 1, status: 'TODO', dueDate: echeance(14) },
            {
              id: ids.etapeJ7,
              title: 'Logement',
              position: 2,
              status: 'TODO',
              dueDate: echeance(7),
            },
            {
              id: ids.etapeJ1,
              title: 'Billet',
              position: 3,
              status: 'IN_PROGRESS',
              dueDate: echeance(1),
            },
            // Franchie ET échue à J−7 : elle ne doit rien déclencher.
            {
              id: ids.etapeFaite,
              title: 'Passeport',
              position: 4,
              status: 'DONE',
              dueDate: echeance(7),
              completedAt: T,
            },
            // Trop lointaine : hors des trois échéances de §8.
            {
              id: ids.etapeLoin,
              title: 'Banque',
              position: 5,
              status: 'TODO',
              dueDate: echeance(30),
            },
          ],
        },
      },
    });

    // Le parcours inactif appartient à l'AUTRE membre : ainsi les notifications de
    // relance et celles de rappel ne se mêlent pas dans les assertions.
    await prisma.journey.create({
      data: {
        id: ids.parcoursInactif,
        ownerUserId: ids.autre,
        templateVersionId: versionId,
        title: `Parcours dormant ${marque}`,
        status: 'ACTIVE',
        originCountryId: paysId,
        destinationCityId: villeId,
        // Soixante et un jours : au-delà des soixante de §3.9.
        lastActivityAt: jours(-61),
        steps: { create: [{ id: ids.etapeInactive, title: 'Étape', position: 1, status: 'TODO' }] },
      },
    });

    // ── 05 : un guide publié, lisible, mis à jour APRÈS le signet ──────────
    await prisma.guide.create({
      data: {
        id: ids.guide,
        authorUserId: ids.proprietaire,
        title: `Guide ${marque}`,
        slug: `guide-${marque}`,
        category: 'HOUSING',
        scope: 'UNIVERSAL',
        status: 'PUBLISHED',
        lastContentUpdateAt: jours(-1),
        versions: {
          create: [{ id: ids.guideVersion, version: 1, body: 'Corps du guide de test.' }],
        },
      },
    });
    /**
     * SA PAGE 1, et elle est OBLIGATOIRE depuis que les guides ont des pages
     * (05 `GuidePage`).
     *
     * MESURÉ : sans elle, `GuidesService.bySlug` répond 404 — le corps d'un guide
     * vit dans ses pages, et un guide sans page n'a rien à rendre. Le décor écrit
     * donc ce que `POST /guides` écrirait : une page 1 portant le titre du guide,
     * son slug dérivé, et la version courante. `guides.current_version_id` reste
     * renseignée : elle est dépréciée mais tenue à jour sur la première page.
     */
    await prisma.guidePage.create({
      data: {
        id: ids.guidePage,
        guideId: ids.guide,
        position: 1,
        title: `Guide ${marque}`,
        slug: `guide-${marque}`,
        currentVersionId: ids.guideVersion,
      },
    });
    await prisma.guideVersion.update({
      where: { id: ids.guideVersion },
      data: { pageId: ids.guidePage },
    });
    await prisma.guide.update({
      where: { id: ids.guide },
      data: { currentVersionId: ids.guideVersion },
    });

    // ── 10 : trois annonces à prix connu dans la même ville et le même kind ─
    for (const [id, prix] of [
      [ids.annonceA, 70_000],
      [ids.annonceB, 90_000],
      [ids.annonceC, 110_000],
    ] as const) {
      await prisma.housingListing.create({
        data: {
          id,
          authorUserId: ids.autre,
          kind: 'RENT',
          title: `Annonce ${marque}`,
          description: 'Description de test.',
          cityId: villeId,
          priceCents: prix,
          status: 'ACTIVE',
          moderationStatus: 'CLEARED',
          expiresAt: jours(60),
          // HORS de la fenêtre d'`alerts.dispatch` — publiées AVANT la création de
          // l'alerte. Les deux tâches de 10 §9 partagent la table des annonces, et le
          // test de la médiane fait passer l'une de celles-ci en `TAKEN` : si l'alerte
          // les comptait, son décompte dépendrait de l'ORDRE DES TESTS. Chaque tâche a
          // donc son propre lot, et c'est l'unique raison de cette date.
          createdAt: new Date(T.getTime() - 3 * 3_600_000),
        },
      });
    }

    // Les annonces que l'ALERTE doit voir : dans sa fenêtre, et SANS prix, pour
    // qu'elles n'entrent pas dans la médiane (le couple `SUBLET` n'a alors aucune
    // annonce à prix connu, donc aucune ligne de médiane).
    for (const id of [ids.alerteA, ids.alerteB, ids.alerteC] as const) {
      await prisma.housingListing.create({
        data: {
          id,
          authorUserId: ids.autre,
          kind: 'SUBLET',
          title: `Sous-location ${marque}`,
          description: 'Description de test.',
          cityId: villeId,
          status: 'ACTIVE',
          moderationStatus: 'CLEARED',
          expiresAt: jours(60),
          createdAt: new Date(T.getTime() - 30 * 60_000),
        },
      });
    }

    await prisma.savedAlert.create({
      data: {
        id: ids.alerte,
        userId: ids.proprietaire,
        kind: 'HOUSING',
        criteria: { cityId: villeId },
        isActive: true,
        // Jamais signalée : la borne basse est donc `created_at`, posé avant les
        // annonces pour qu'elles entrent dans la fenêtre.
        lastNotifiedAt: null,
        createdAt: new Date(T.getTime() - 2 * 3_600_000),
      },
    });

    // ── Transverse : une session expirée depuis plus de 30 jours ────────────
    await prisma.authSession.create({
      data: {
        id: ids.session,
        userId: ids.proprietaire,
        refreshTokenHash: `${marque}-expiree`,
        chainId: newId(),
        expiresAt: jours(-31),
      },
    });

    // ── Transverse : six signets, six états attendus ────────────────────────
    await prisma.story.create({
      data: {
        id: ids.storyExpiree,
        authorUserId: ids.autre,
        type: 'CONSEIL',
        textStyle: 'BOLD',
        body: `Story ${marque}`,
        cityId: villeId,
        audience: 'ALL',
        allowMessages: false,
        status: 'ACTIVE',
        moderationStatus: 'CLEARED',
        // Échue avant `T` : `EXPIRED` par la DATE, sans attendre `story.expire`.
        expiresAt: new Date(T.getTime() - 3_600_000),
      },
    });

    await prisma.helpRequest.create({
      data: {
        id: ids.demandeResolue,
        authorUserId: ids.autre,
        kind: 'REQUEST',
        type: 'PAPERWORK',
        title: `Demande ${marque}`,
        body: 'Corps de la demande.',
        cityId: villeId,
        status: 'RESOLVED',
        resolvedAt: jours(-2),
        moderationStatus: 'CLEARED',
      },
    });

    await prisma.event.create({
      data: {
        id: ids.evenementPasse,
        organizerUserId: ids.autre,
        type: 'PICNIC',
        title: `Événement ${marque}`,
        cityId: villeId,
        startsAt: jours(-3),
        status: 'SCHEDULED',
      },
    });

    await prisma.housingListing.create({
      data: {
        id: ids.annoncePrise,
        authorUserId: ids.autre,
        kind: 'FLATSHARE',
        title: `Annonce prise ${marque}`,
        description: 'Description de test.',
        cityId: villeId,
        // SANS prix : elle ne doit pas entrer dans la médiane, dont le kind diffère
        // de toute façon.
        status: 'TAKEN',
        moderationStatus: 'CLEARED',
        expiresAt: jours(60),
        // Datée explicitement, et loin : sans cela `created_at` vaudrait l'instant
        // du semis, c'est-à-dire quelques millisecondes APRÈS `T`, et elle
        // tomberait dans la fenêtre du troisième passage d'`alerts.dispatch`.
        createdAt: jours(-5),
      },
    });

    for (const [id, subjectType, subjectId] of [
      [ids.signetStory, 'STORY', ids.storyExpiree],
      [ids.signetDemande, 'HELP_REQUEST', ids.demandeResolue],
      [ids.signetEvenement, 'EVENT', ids.evenementPasse],
      [ids.signetAnnonce, 'HOUSING', ids.annoncePrise],
      [ids.signetGuide, 'GUIDE', ids.guide],
      // Un sujet qui n'existe pas : « contenu retiré ».
      [ids.signetFantome, 'POST', newId()],
    ] as const) {
      await prisma.bookmark.create({
        data: {
          id,
          userId: ids.proprietaire,
          subjectType,
          subjectId,
          // Enregistré AVANT la dernière mise à jour du guide (J−1) : c'est ce qui
          // fait « mis à jour le … » pour le signet de guide, et rien pour les autres.
          createdAt: jours(-5),
        },
      });
    }
  }
});
