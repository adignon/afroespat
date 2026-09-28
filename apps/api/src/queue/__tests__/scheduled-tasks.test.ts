import { describe, expect, it } from 'vitest';
import {
  MAX_LEASE_MS,
  MIN_LEASE_MS,
  ScheduledTaskRegistry,
  dailyAt,
  every,
  hourlyAt,
  leaseMs,
  retryPolicy,
  summarize,
  weeklyAt,
  type ScheduledTaskDefinition,
} from '../scheduled-tasks';

/**
 * Le registre des tâches planifiées — §9.3.
 *
 * Trois choses qu'aucune relecture de code ne démontre, et que ce fichier
 * éprouve : qu'un nom en double est REFUSÉ (sinon une tâche disparaît sans
 * erreur), que l'échec d'une tâche n'empêche pas les autres de passer, et que le
 * bail du verrou comme la politique de reprise SUIVENT LA CADENCE — c'est de là
 * que vient tout le comportement du planificateur.
 */

const task = (over: Partial<ScheduledTaskDefinition> = {}): ScheduledTaskDefinition => ({
  name: 'test.tache',
  module: 'test',
  schedule: every(5),
  handle: () => Promise.resolve(1),
  ...over,
});

describe('registre des tâches planifiées (§9.3)', () => {
  it('enregistre et retrouve une tâche par son nom', () => {
    const registry = new ScheduledTaskRegistry();
    registry.register(task({ name: 'story.expire' }));

    expect(registry.get('story.expire')?.name).toBe('story.expire');
    expect(registry.all()).toHaveLength(1);
  });

  it('rend `undefined` pour une tâche inconnue', () => {
    // Cas RÉEL et non défensif : un planificateur BullMQ resté d'un déploiement
    // antérieur dépose un travail dont plus aucune tâche ne porte le nom.
    expect(new ScheduledTaskRegistry().get('tache.disparue')).toBeUndefined();
  });

  /**
   * LE test de l'enregistrement.
   *
   * Le nom sert de clé de planificateur BullMQ. Deux définitions du même nom ne
   * donneraient pas deux travaux répétables mais UN SEUL, et la seconde tâche ne
   * tournerait jamais — sans erreur, sans ligne de journal, sans rien. Refuser au
   * démarrage est la seule façon de le rendre visible.
   */
  it('REFUSE un nom en double, en nommant le module déjà enregistré', () => {
    const registry = new ScheduledTaskRegistry();
    registry.register(task({ name: 'listing.expire', module: 'housing' }));

    expect(() => registry.register(task({ name: 'listing.expire', module: 'jobs' }))).toThrow(
      /housing/,
    );
    expect(registry.all()).toHaveLength(1);
  });

  it('transmet le `now` du créneau au gestionnaire, et non l’heure système', async () => {
    const registry = new ScheduledTaskRegistry();
    let received: Date | null = null;
    registry.register(
      task({
        handle: (ctx) => {
          received = ctx.now;
          return Promise.resolve(0);
        },
      }),
    );

    // C'est ce paramètre qui rend éprouvable une règle « 45 jours sans réponse ».
    // Un gestionnaire qui rappellerait `new Date()` reprendrait la dépendance que
    // les services ont pris soin de couper.
    const slot = new Date('2026-03-01T03:00:00.000Z');
    await registry.run('test.tache', slot);
    expect(received).toStrictEqual(slot);
  });

  it('rend la durée et le résumé de ce qui a été traité', async () => {
    const registry = new ScheduledTaskRegistry();
    registry.register(task({ name: 'help.archive', handle: () => Promise.resolve({ archived: 3 }) }));

    const run = await registry.run('help.archive');
    // Le runbook §4 demande de savoir si une tâche a tourné ET ce qu'elle a fait.
    expect(run.summary).toBe('archived=3');
    expect(run.durationMs).toBeGreaterThanOrEqual(0);
    expect(run.module).toBe('test');
  });

  it('lève pour une tâche inconnue plutôt que de ne rien faire', async () => {
    await expect(new ScheduledTaskRegistry().run('inexistante')).rejects.toThrow(/inconnue/);
  });

  /**
   * L'erreur PORTE LE NOM de la tâche.
   *
   * Sans lui, un échec dans le journal du worker ou dans Sentry ne dit pas où
   * chercher : vingt-sept balayages qui écrivent « connexion refusée » se
   * ressemblent beaucoup.
   */
  it('nomme la tâche fautive dans l’erreur, et conserve la cause', async () => {
    const registry = new ScheduledTaskRegistry();
    const cause = new Error('base indisponible');
    registry.register(task({ name: 'sanctions.expire', handle: () => Promise.reject(cause) }));

    await expect(registry.run('sanctions.expire')).rejects.toThrow(/sanctions\.expire/);
    await expect(registry.run('sanctions.expire')).rejects.toThrow(/base indisponible/);
    await expect(registry.run('sanctions.expire')).rejects.toMatchObject({ cause });
  });

  /**
   * LE test de `runAll` : l'isolation.
   *
   * Même raisonnement que pour le registre d'événements. Rien ne lie
   * `guide.freshness_recompute` à `sanctions.expire`, et une boucle naïve
   * s'arrêterait à la première exception — privant de leur passage toutes les
   * tâches enregistrées après la fautive.
   */
  it('isole les tâches : une qui échoue n’empêche pas les suivantes', async () => {
    const registry = new ScheduledTaskRegistry();
    const passed: string[] = [];

    registry.register(task({ name: 'a', handle: () => Promise.resolve(void passed.push('a')) }));
    registry.register(task({ name: 'b', handle: () => Promise.reject(new Error('boum')) }));
    registry.register(task({ name: 'c', handle: () => Promise.resolve(void passed.push('c')) }));

    const { runs, failures } = await registry.runAll();

    expect(passed).toEqual(['a', 'c']);
    expect(failures).toEqual(['b']);
    expect(runs.map((r) => r.task)).toEqual(['a', 'c']);
  });

  it('décrit ses tâches avec leur cadence, pour le journal de démarrage', () => {
    const registry = new ScheduledTaskRegistry();
    registry.register(task({ name: 'story.expire', module: 'feed', schedule: every(5) }));
    registry.register(task({ name: 'help.archive', module: 'help', schedule: dailyAt(3, 0) }));

    expect(registry.describe()).toEqual([
      'story.expire — toutes les 5 min (feed)',
      'help.archive — quotidienne (help)',
    ]);
  });
});

describe('cadences et bail du verrou', () => {
  it('une cadence courte emploie `every`, une heure fixe un patron cron', () => {
    // Les deux sont exclusifs côté BullMQ, et l'union discriminée l'impose au
    // compilateur — ce test vérifie la FORME produite, que le planificateur lit.
    expect(every(5)).toMatchObject({ every: 300_000, intervalMs: 300_000 });
    expect(hourlyAt(5)).toMatchObject({ pattern: '5 * * * *', intervalMs: 3_600_000 });
    expect(dailyAt(4, 30)).toMatchObject({ pattern: '30 4 * * *', intervalMs: 86_400_000 });
    expect(weeklyAt(1, 5, 0)).toMatchObject({ pattern: '0 5 * * 1' });
  });

  /**
   * LE bail, et sa raison d'être.
   *
   * Il vaut 80 % de la période : assez pour couvrir tout le créneau (donc
   * interdire un second passage), pas assez pour déborder sur le suivant (donc
   * sans jamais faire SAUTER un créneau). Les deux bornes sont ce qui rend le
   * verrou utilisable de cinq minutes à une semaine avec une seule formule.
   */
  it('le bail couvre le créneau sans déborder sur le suivant', () => {
    expect(leaseMs(every(5))).toBe(4 * 60_000);
    expect(leaseMs(every(15))).toBe(12 * 60_000);
    expect(leaseMs(hourlyAt(0))).toBe(48 * 60_000);

    for (const schedule of [every(5), every(15), hourlyAt(0), dailyAt(3, 0), weeklyAt(1, 5, 0)]) {
      expect(leaseMs(schedule)).toBeLessThan(schedule.intervalMs);
      expect(leaseMs(schedule)).toBeGreaterThanOrEqual(MIN_LEASE_MS);
      expect(leaseMs(schedule)).toBeLessThanOrEqual(MAX_LEASE_MS);
    }
  });

  it('plafonne le bail des cadences longues à douze heures', () => {
    // 80 % de 24 h feraient 19 h. Garder la clé si longtemps ne protège rien de
    // plus — le tir suivant est à 24 h — et bloquerait la tâche tout l'après-midi
    // si le processus mourait en la tenant.
    expect(leaseMs(dailyAt(3, 0))).toBe(MAX_LEASE_MS);
    expect(leaseMs(weeklyAt(1, 5, 0))).toBe(MAX_LEASE_MS);
  });

  /**
   * La politique de reprise, qui n'est PAS celle des événements (dix tentatives).
   *
   * Une tâche ne porte aucun travail propre : le créneau suivant refait le même
   * balayage. À cinq ou quinze minutes, réessayer n'avance à rien et transforme
   * une panne de base en deux cent soixante échecs Sentry. À vingt-quatre heures,
   * en revanche, attendre le créneau suivant laisserait un compte suspendu
   * suspendu un jour de trop.
   */
  it('une cadence courte ne réessaie pas, une cadence longue trois fois', () => {
    expect(retryPolicy(every(5))).toEqual({ attempts: 1, backoffMs: 0 });
    expect(retryPolicy(every(15))).toEqual({ attempts: 1, backoffMs: 0 });
    expect(retryPolicy(hourlyAt(0))).toEqual({ attempts: 1, backoffMs: 0 });
    expect(retryPolicy(dailyAt(3, 0))).toEqual({ attempts: 3, backoffMs: 600_000 });
    expect(retryPolicy(weeklyAt(1, 5, 0)).attempts).toBe(3);
  });

  /**
   * La cohérence entre le bail et les reprises.
   *
   * Si le bail n'était pas relâché sur échec, la reprise à dix minutes d'une tâche
   * quotidienne se heurterait au bail de douze heures posé par la tentative qui
   * vient d'échouer : les trois tentatives seraient une fiction. Ce test fixe
   * l'inégalité qui rend le relâchement NÉCESSAIRE — c'est lui qui tombera si
   * quelqu'un raccourcit le bail en pensant pouvoir s'en passer.
   */
  it('le bail d’une tâche quotidienne survit à sa fenêtre de reprise', () => {
    const daily = dailyAt(3, 0);
    const { attempts, backoffMs } = retryPolicy(daily);
    expect(leaseMs(daily)).toBeGreaterThan(attempts * backoffMs);
  });
});

describe('résumé du journal', () => {
  it('met en forme les quatre formes que rendent les modules', () => {
    // Les vingt-sept méthodes rendent ce qu'elles rendaient avant que le
    // planificateur existe. C'est ici qu'on les rend lisibles, pas dans les modules.
    expect(summarize(12)).toBe('12');
    expect(summarize({ archived: 3 })).toBe('archived=3');
    expect(summarize({ purged: 2, keptForBookmark: 1 })).toBe('purged=2, keptForBookmark=1');
    expect(summarize({ archived: ['a', 'b'], warned: ['c'] })).toBe('archived=2, warned=1');
    expect(summarize([{ id: 'x' }, { id: 'y' }])).toBe('2 élément(s)');
    expect(summarize(undefined)).toBe('rien à signaler');
    expect(summarize({})).toBe('rien à signaler');
  });

  it('ne lève JAMAIS, quelle que soit la valeur rendue', () => {
    // Une ligne de journal qui lève ferait échouer une tâche qui a réussi — et
    // `unknown` n'interdit ni un symbole ni un grand entier.
    for (const value of [Symbol('x'), 10n, true, 'texte', () => 0, null]) {
      expect(() => summarize(value)).not.toThrow();
    }
  });
});
