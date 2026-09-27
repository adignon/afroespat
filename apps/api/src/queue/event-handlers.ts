import { Injectable, Logger } from '@nestjs/common';
import type { DomainEventType } from '../common/outbox.service';

/**
 * Le registre des consommateurs d'événements — 00-fondations.md §9.1 et §9.2.
 *
 * Sans lui, le relais déposait les travaux dans la file `events` et PERSONNE ne
 * les retirait : toute l'architecture d'événements écrivait sans que rien ne
 * lise. Aucune règle qui passe par un événement ne fonctionnait, dans aucun
 * module — les modules émettaient correctement, et la moitié « consommateur »
 * n'existait pas. Relevé en écrivant le module réseaux, qui a dû contourner.
 *
 * Le registre est un ANNUAIRE, pas un aiguillage : le worker ne connaît aucun
 * module, et chaque module déclare ce qu'il écoute. C'est la seule forme qui
 * survive à vingt-quatre modules — un `switch` dans le worker devrait importer
 * les vingt-quatre, et chaque nouveau module le ferait grossir.
 *
 * TROIS PROPRIÉTÉS que tout gestionnaire doit respecter, parce que la file les
 * impose :
 *
 *   · **idempotent**. La livraison est « au moins une fois » : un gestionnaire
 *     sera rejoué. Il doit pouvoir l'être sans rien dupliquer.
 *   · **indépendant**. Plusieurs gestionnaires du même événement ne se voient
 *     pas ; l'échec de l'un ne doit pas empêcher les autres de travailler.
 *   · **qui lève pour réessayer**. Une erreur avalée fait disparaître le travail
 *     en silence ; lever le confie aux dix tentatives de `EVENT_JOB_OPTIONS`.
 */

export interface DomainEventJob {
  readonly id: string;
  readonly type: DomainEventType;
  readonly aggregateId: string;
  readonly payload: unknown;
  readonly occurredAt: string;
}

export type EventHandler = (job: DomainEventJob) => Promise<void>;

interface Registration {
  readonly type: DomainEventType;
  /** Nom du module, pour les journaux : « communities », « help »… */
  readonly module: string;
  readonly handle: EventHandler;
}

@Injectable()
export class EventHandlerRegistry {
  private readonly logger = new Logger(EventHandlerRegistry.name);
  private readonly handlers: Registration[] = [];

  /**
   * Abonne un gestionnaire. À appeler dans le `onModuleInit` du module, pour que
   * l'abonnement existe avant que le consommateur ne démarre.
   */
  on(type: DomainEventType, module: string, handle: EventHandler): void {
    this.handlers.push({ type, module, handle });
  }

  /** Ce qui écoute ce type. Vide est un cas normal : tout n'a pas de lecteur. */
  for(type: DomainEventType): readonly Registration[] {
    return this.handlers.filter((h) => h.type === type);
  }

  /**
   * Distribue un événement à tous ses gestionnaires.
   *
   * Chacun est isolé : un module qui lève ne doit pas empêcher les autres de
   * travailler. Mais la méthode lève À LA FIN si au moins un a échoué, pour que
   * BullMQ rejoue le travail — les gestionnaires étant idempotents, rejouer ceux
   * qui avaient réussi ne coûte rien, alors que perdre celui qui a échoué
   * casserait la chaîne.
   */
  async dispatch(job: DomainEventJob): Promise<void> {
    const registered = this.for(job.type);
    if (registered.length === 0) return;

    const failures: { module: string; error: unknown }[] = [];

    for (const registration of registered) {
      try {
        await registration.handle(job);
      } catch (error) {
        failures.push({ module: registration.module, error });
        this.logger.error(
          `${registration.module} a échoué sur ${job.type} (${job.aggregateId}) : ` +
            `${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (failures.length > 0) {
      throw new Error(
        `${failures.length} gestionnaire(s) en échec sur ${job.type} : ` +
          failures.map((f) => f.module).join(', '),
      );
    }
  }

  /** Ce qui est abonné, pour le journal de démarrage du worker. */
  describe(): string[] {
    const byType = new Map<DomainEventType, string[]>();
    for (const h of this.handlers) {
      byType.set(h.type, [...(byType.get(h.type) ?? []), h.module]);
    }
    return [...byType.entries()].map(([type, modules]) => `${type} → ${modules.join(', ')}`);
  }
}
