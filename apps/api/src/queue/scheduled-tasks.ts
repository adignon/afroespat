import { Injectable, Logger } from '@nestjs/common';

/**
 * Le registre des tâches planifiées — 00-fondations.md §9.3.
 *
 * Sans lui, les vingt-six méthodes de balayage écrites dans les modules
 * (`expireStories`, `archiveDue`, `expireSanctions`…) étaient PUBLIQUES, TESTÉES
 * et appelées par personne. Chaque module avait fait sa part en exposant une
 * méthode idempotente et sans dépendance à l'heure système ; la moitié
 * « déclencheur » n'existait pas. Une sanction expirée n'était donc jamais levée,
 * une story ne mourait jamais, et rien dans les journaux ne le disait.
 *
 * Le registre est un ANNUAIRE, pas un aiguillage, exactement comme
 * `EventHandlerRegistry` : le planificateur ne connaît AUCUN module. Il lit ce
 * registre, pose un travail répétable par entrée et rappelle le gestionnaire. Un
 * `switch` dans le worker devrait importer les vingt-quatre modules, et chaque
 * nouveau module le ferait grossir.
 *
 * TROIS PROPRIÉTÉS que toute tâche enregistrée doit respecter :
 *
 *   · **idempotente**. Le verrou réduit les doubles passages, il ne les supprime
 *     pas : une reprise BullMQ, un travail « bloqué » redistribué ou un
 *     redémarrage en pleine exécution peuvent rejouer le créneau. Une tâche qui
 *     compte au lieu de recalculer finirait par dériver.
 *   · **sans dépendance à l'heure système**. Le `now` du contexte est celui que
 *     la tâche doit employer. C'est ce qui rend éprouvable une règle « 45 jours
 *     sans réponse » sans attendre 45 jours.
 *   · **bornée**. Une tâche qui balaie une table entière sans `take` tiendra son
 *     verrou pendant tout le balayage, et bloquera son propre créneau suivant.
 *
 * CE QUI DISTINGUE UNE TÂCHE D'UN ÉVÉNEMENT, et donc le choix de reprise (voir
 * `retryPolicy` plus bas) : un événement de domaine porte un travail UNIQUE, et
 * le perdre le perd pour toujours. Une tâche planifiée ne porte aucun travail
 * propre — elle demande « qu'est-ce qui est échu ? ». Le créneau suivant reposera
 * la même question, augmentée de ce qui est devenu échu entre-temps. Un échec
 * retarde, il ne perd pas.
 */

/** Ce qu'une tâche reçoit. Volontairement minimal : un instant, et son nom. */
export interface ScheduledTaskContext {
  /**
   * L'instant de référence du créneau. À passer TEL QUEL aux méthodes des
   * services : c'est le seul paramètre qui rend leurs règles temporelles
   * éprouvables, et une tâche qui rappellerait `new Date()` elle-même reprendrait
   * la dépendance qu'ils ont pris soin de couper.
   */
  readonly now: Date;
  /** Le nom de la tâche, pour les journaux d'un gestionnaire composite. */
  readonly task: string;
}

/**
 * Le retour d'un gestionnaire, résumé dans le journal.
 *
 * `unknown` et non un type fermé : les méthodes des modules rendent déjà ce
 * qu'elles rendent — un nombre, `{ archived: 3 }`, une liste de dossiers — et
 * leur imposer une forme commune signifierait modifier vingt-six signatures de
 * services métier pour le confort du planificateur.
 */
export type ScheduledTaskHandler = (ctx: ScheduledTaskContext) => Promise<unknown>;

/**
 * La cadence d'une tâche.
 *
 * `intervalMs` est déclaré à côté du patron cron plutôt que déduit de lui : le
 * planificateur en a besoin pour dimensionner le bail du verrou et choisir la
 * politique de reprise, et interpréter un patron cron pour cela demanderait
 * d'embarquer un analyseur syntaxique là où une constante suffit.
 */
interface ScheduleBase {
  /** Ce que la spec annonce, pour le journal de démarrage : « quotidienne ». */
  readonly label: string;
  /** Période nominale, en millisecondes. */
  readonly intervalMs: number;
}

/**
 * Une UNION DISCRIMINÉE, et non deux champs optionnels.
 *
 * BullMQ refuse `pattern` et `every` ensemble — à l'exécution, ce qui veut dire
 * au démarrage du worker. Deux champs optionnels laissaient écrire les deux, ou
 * aucun, et `tsc` n'avait rien à dire. Ici le compilateur l'interdit, et le
 * planificateur peut distinguer les deux cas sans vérifier de `undefined`.
 */
export type Schedule =
  | (ScheduleBase & { readonly every: number })
  | (ScheduleBase & { readonly pattern: string });

export interface ScheduledTaskDefinition {
  /** Le nom de §9.3 — `story.expire`, `sanctions.expire`. C'est la clé. */
  readonly name: string;
  /** Le module d'où vient le travail, pour les journaux : « feed », « help ». */
  readonly module: string;
  readonly schedule: Schedule;
  readonly handle: ScheduledTaskHandler;
}

export interface ScheduledRun {
  readonly task: string;
  readonly module: string;
  readonly durationMs: number;
  /** Ce que la tâche a traité, mis en forme. Le runbook §4 demande de le savoir. */
  readonly summary: string;
}

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Une période glissante, pour les cadences courtes.
 *
 * `every` et non un patron cron sous la minute : un patron cron impose une
 * granularité d'une minute et un fuseau, dont une tâche « toutes les 5 minutes »
 * n'a que faire.
 */
export function every(minutes: number): Schedule {
  return { label: `toutes les ${minutes} min`, intervalMs: minutes * MINUTE, every: minutes * MINUTE };
}

/**
 * À heure fixe, chaque heure.
 *
 * La MINUTE est un paramètre pour pouvoir étaler : trois tâches horaires toutes
 * posées à la minute 0 ouvrent trois balayages simultanés sur la même base.
 */
export function hourlyAt(minute: number): Schedule {
  return { label: 'horaire', intervalMs: HOUR, pattern: `${minute} * * * *` };
}

/** Quotidienne, à heure fixe dans le fuseau du planificateur. */
export function dailyAt(hour: number, minute: number): Schedule {
  return { label: 'quotidienne', intervalMs: DAY, pattern: `${minute} ${hour} * * *` };
}

/** Hebdomadaire. `weekday` : 0 = dimanche, 1 = lundi (convention cron). */
export function weeklyAt(weekday: number, hour: number, minute: number): Schedule {
  return { label: 'hebdomadaire', intervalMs: 7 * DAY, pattern: `${minute} ${hour} * * ${weekday}` };
}

/**
 * Le premier jour du trimestre — 15 §10, `impact.quarterly_prepare`.
 *
 * `1,4,7,10` en champ MOIS, et le premier jour en champ jour : c'est la seule
 * façon d'écrire « 1er jour du trimestre » en cron, qui ne connaît pas les
 * trimestres.
 *
 * `intervalMs` vaut QUATRE-VINGT-DIX JOURS, ce qui est faux de un à deux jours
 * selon le trimestre — et sans conséquence, parce que cette valeur ne sert qu'à
 * dimensionner le bail du verrou et à choisir la politique de reprise, tous deux
 * plafonnés (`MAX_LEASE_MS`, douze heures). La date de tir, elle, vient du patron
 * cron, qui est exact.
 */
export function quarterlyAt(hour: number, minute: number): Schedule {
  return { label: 'trimestrielle', intervalMs: 90 * DAY, pattern: `${minute} ${hour} 1 1,4,7,10 *` };
}

/** Borne haute d'un bail, quelle que soit la cadence. Voir `leaseMs`. */
export const MAX_LEASE_MS = 12 * HOUR;
/** Borne basse : un bail plus court qu'un balayage ne protégerait rien. */
export const MIN_LEASE_MS = 30 * SECOND;

/**
 * La durée du bail du verrou Redis, pour une cadence donnée.
 *
 * Le verrou n'est PAS un mutex relâché en fin d'exécution : c'est un marqueur de
 * créneau, gardé jusqu'à son expiration naturelle après un succès. Les deux
 * propriétés de §9.3 en découlent d'une seule clé :
 *
 *   · pendant l'exécution, personne d'autre ne l'obtient — pas de concurrence ;
 *   · après l'exécution, personne ne le reprend avant la fin du bail — pas de
 *     second passage dans le même créneau, même si BullMQ redistribue le travail.
 *
 * 80 % de la période, et non 100 % : à 100 %, l'horloge du créneau suivant et
 * l'expiration de la clé courent l'une contre l'autre, et un décalage de
 * quelques millisecondes ferait sauter un créneau sur dix. La marge est du côté
 * qui ne perd rien — au pire, la tâche repasse un peu tôt, et elle est idempotente.
 *
 * Plafonné à douze heures : garder une clé dix-neuf heures pour une tâche
 * quotidienne ne protège rien de plus (le tir suivant est à vingt-quatre heures)
 * et, si le processus meurt en la tenant, bloque la tâche pour l'après-midi
 * entier.
 */
export function leaseMs(schedule: Schedule): number {
  return Math.min(MAX_LEASE_MS, Math.max(MIN_LEASE_MS, Math.round(schedule.intervalMs * 0.8)));
}

/**
 * Combien de tentatives BullMQ accorde à une tâche, et à quel rythme.
 *
 * LE RAISONNEMENT, et il diffère de celui des événements (`EVENT_JOB_OPTIONS` :
 * dix tentatives) :
 *
 *   · **cadence courte (< 1 jour) → UNE tentative.** Le créneau suivant est à
 *     cinq, quinze ou soixante minutes, et il refera exactement le même travail
 *     augmenté de ce qui est devenu échu. Réessayer n'avance donc à rien, et
 *     coûte : la cause d'un échec de balayage est presque toujours la base ou
 *     Redis, c'est-à-dire une cause COMMUNE aux vingt-six tâches. Dix tentatives
 *     exponentielles chacune, pendant une indisponibilité de base de dix
 *     minutes, produisent deux cent soixante échecs dans Sentry et une ruée sur
 *     le premier instant où la base répond. Attendre le créneau suivant est plus
 *     sûr ET plus lisible.
 *
 *   · **cadence longue (≥ 1 jour) → TROIS tentatives, dix minutes d'écart.** Ici
 *     le créneau suivant est à vingt-quatre heures ou à une semaine, et certaines
 *     de ces tâches ont un effet visible par les membres : `guide.outdated_unpublish`
 *     dépublie, `mentorship.end_due` termine un parrainage, `sanctions.expire`
 *     REND l'accès à un compte suspendu. Un redémarrage du connecteur de base à
 *     3 h ne doit pas retarder cela d'une journée. Trois tentatives sur une demi-heure
 *     couvrent la panne passagère sans jamais ressembler à une boucle.
 *
 * Le verrou est cohérent avec ce choix : il est RELÂCHÉ sur échec (le créneau
 * n'a pas été fait, une reprise doit pouvoir passer) et GARDÉ sur succès. Sans
 * cela, la reprise à dix minutes se heurterait au bail de douze heures posé par
 * la tentative qui vient d'échouer, et les trois tentatives seraient une fiction.
 */
export function retryPolicy(schedule: Schedule): { attempts: number; backoffMs: number } {
  return schedule.intervalMs >= DAY
    ? { attempts: 3, backoffMs: 10 * MINUTE }
    : { attempts: 1, backoffMs: 0 };
}

@Injectable()
export class ScheduledTaskRegistry {
  private readonly logger = new Logger(ScheduledTaskRegistry.name);
  private readonly tasks = new Map<string, ScheduledTaskDefinition>();

  /**
   * Enregistre une tâche. À appeler dans le `onModuleInit` du câblage, pour que
   * le registre soit complet avant que le planificateur ne pose ses travaux
   * répétables — il démarre, lui, sur `onApplicationBootstrap`.
   *
   * Un nom en DOUBLE est refusé, et ce n'est pas du zèle : le nom sert de clé de
   * planificateur BullMQ. Deux définitions du même nom ne donneraient pas deux
   * travaux mais un seul, dont le gestionnaire serait celui que la carte a gardé.
   * L'autre tâche ne tournerait jamais, sans erreur ni trace — précisément le
   * défaut que ce registre existe pour rendre impossible.
   */
  register(definition: ScheduledTaskDefinition): void {
    const existing = this.tasks.get(definition.name);
    if (existing !== undefined) {
      throw new Error(
        `Tâche planifiée en double : « ${definition.name} » est déjà enregistrée par ` +
          `${existing.module}. Deux tâches ne peuvent pas partager un nom — il sert de clé ` +
          'de planificateur, et la seconde ne tournerait jamais.',
      );
    }
    this.tasks.set(definition.name, definition);
  }

  /** Les tâches, dans l'ordre d'enregistrement. */
  all(): readonly ScheduledTaskDefinition[] {
    return [...this.tasks.values()];
  }

  /** `undefined` est un cas RÉEL : un travail répétable resté d'un déploiement antérieur. */
  get(name: string): ScheduledTaskDefinition | undefined {
    return this.tasks.get(name);
  }

  /** Pour le journal de démarrage du worker : ce qui tournera, et quand. */
  describe(): string[] {
    return this.all().map((t) => `${t.name} — ${t.schedule.label} (${t.module})`);
  }

  /**
   * Exécute UNE tâche et journalise ce qu'il faut pour répondre à la question du
   * runbook §4 : « est-ce que cette tâche a tourné, et qu'a-t-elle fait ? »
   *
   * Le début est journalisé AUSSI, et pas seulement la fin. Une tâche qui se
   * bloque ne produirait autrement aucune ligne, et on ne pourrait pas
   * distinguer « bloquée depuis trois heures » de « jamais déclenchée » — deux
   * incidents dont les causes n'ont rien à voir.
   *
   * Lève en cas d'échec, après avoir journalisé, et l'erreur PORTE LE NOM de la
   * tâche : sans lui, un échec dans le journal du worker ou dans Sentry ne dit
   * pas où chercher, et vingt-six balayages se ressemblent beaucoup.
   */
  async run(name: string, now: Date = new Date()): Promise<ScheduledRun> {
    const task = this.tasks.get(name);
    if (task === undefined) throw new Error(`Tâche planifiée inconnue : ${name}`);

    const startedAt = Date.now();
    this.logger.log(`${task.name} — début`);

    try {
      const result = await task.handle({ now, task: task.name });
      const durationMs = Date.now() - startedAt;
      const summary = summarize(result);
      this.logger.log(`${task.name} — fin en ${durationMs} ms : ${summary}`);
      return { task: task.name, module: task.module, durationMs, summary };
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`${task.name} (${task.module}) a échoué après ${durationMs} ms : ${message}`);
      throw new Error(`Tâche ${task.name} en échec : ${message}`, { cause: error });
    }
  }

  /**
   * Exécute TOUTES les tâches, chacune isolée.
   *
   * N'est pas le chemin normal — en production, chaque tâche est son propre
   * travail BullMQ, et l'isolation vient de là. C'est le chemin d'une relance
   * manuelle, et surtout celui des tests d'idempotence : « tout lancer deux fois
   * et vérifier qu'aucun compteur ne bouge ».
   *
   * Isolée veut dire ce qu'elle dit : l'échec de `guide.freshness_recompute` ne
   * doit pas priver `sanctions.expire` de son passage. Rien ne les lie, et une
   * boucle naïve les enchaînerait à la première exception.
   */
  async runAll(now: Date = new Date()): Promise<{ runs: ScheduledRun[]; failures: string[] }> {
    const runs: ScheduledRun[] = [];
    const failures: string[] = [];

    for (const task of this.all()) {
      try {
        runs.push(await this.run(task.name, now));
      } catch {
        // Déjà journalisé, avec le nom, par `run`. On retient le nom pour l'appelant.
        failures.push(task.name);
      }
    }
    return { runs, failures };
  }
}

/**
 * Met en forme ce qu'une tâche a rendu.
 *
 * Les vingt-six méthodes rendent quatre formes différentes — un nombre, un objet
 * de compteurs, une liste de dossiers, rien — parce qu'elles ont été écrites pour
 * leurs propres tests avant qu'un planificateur existe. Les uniformiser
 * demanderait de modifier des services métier ; les mettre en forme ici coûte
 * quinze lignes et ne touche personne.
 */
export function summarize(result: unknown): string {
  if (result === undefined || result === null) return 'rien à signaler';
  if (typeof result === 'number') return `${result}`;
  if (Array.isArray(result)) return `${result.length} élément(s)`;
  if (typeof result === 'object') {
    const parts = Object.entries(result).map(([key, value]) =>
      Array.isArray(value) ? `${key}=${value.length}` : `${key}=${String(value)}`,
    );
    return parts.length === 0 ? 'rien à signaler' : parts.join(', ');
  }
  // Chaîne, booléen, grand entier… Aucune méthode n'en rend aujourd'hui, mais le
  // type d'entrée est `unknown`, et une ligne de journal ne doit JAMAIS lever :
  // `String()` sur un symbole lève, et `JSON.stringify` sur un grand entier aussi.
  if (typeof result === 'string') return result;
  if (typeof result === 'boolean' || typeof result === 'bigint') return `${result}`;
  return typeof result;
}
