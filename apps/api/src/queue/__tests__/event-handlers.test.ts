import { describe, expect, it } from 'vitest';
import { type DomainEventJob, EventHandlerRegistry } from '../event-handlers';

/**
 * Le registre des consommateurs d'événements — §9.1 et §9.2.
 *
 * Ce qu'il garantit n'est pas visible en le lisant : que l'échec d'un module
 * n'empêche pas les autres de travailler, et que le travail soit tout de même
 * rejoué. Les deux ensemble, c'est ce qui rend la chaîne d'événements fiable ; l'un
 * sans l'autre la casse silencieusement.
 */

const job = (type: string, aggregateId = 'a'): DomainEventJob => ({
  id: 'job-1',
  type: type as DomainEventJob['type'],
  aggregateId,
  payload: {},
  occurredAt: new Date().toISOString(),
});

describe('registre des consommateurs d’événements (§9.2)', () => {
  it('ne fait rien quand personne n’écoute', async () => {
    const registry = new EventHandlerRegistry();
    // Cas NORMAL, pas une erreur : tous les événements n'ont pas de lecteur, et
    // 00 §9.1 n'en exige aucun.
    await expect(registry.dispatch(job('user.registered'))).resolves.toBeUndefined();
  });

  it('appelle TOUS les gestionnaires du même type', async () => {
    const registry = new EventHandlerRegistry();
    const called: string[] = [];

    registry.on('user.deleted', 'help', () => Promise.resolve(void called.push('help')));
    registry.on('user.deleted', 'guides', () => Promise.resolve(void called.push('guides')));

    await registry.dispatch(job('user.deleted'));
    expect(called.sort()).toEqual(['guides', 'help']);
  });

  it('n’appelle que les gestionnaires du bon type', async () => {
    const registry = new EventHandlerRegistry();
    const called: string[] = [];

    registry.on('user.deleted', 'help', () => Promise.resolve(void called.push('help')));
    registry.on('user.blocked', 'communities', () => Promise.resolve(void called.push('communities')));

    await registry.dispatch(job('user.blocked'));
    expect(called).toEqual(['communities']);
  });

  /**
   * LE test qui compte.
   *
   * Un module qui lève ne doit pas priver les autres de leur travail : ils sont
   * indépendants, et rien ne justifie qu'une anonymisation de guides échoue parce
   * que l'entraide a eu un problème de base.
   */
  it('isole les gestionnaires : un échec n’empêche pas les autres', async () => {
    const registry = new EventHandlerRegistry();
    const called: string[] = [];

    registry.on('user.deleted', 'premier', () =>
      Promise.reject(new Error('base indisponible')),
    );
    registry.on('user.deleted', 'second', () => Promise.resolve(void called.push('second')));

    await expect(registry.dispatch(job('user.deleted'))).rejects.toThrow();
    // Le second a bien travaillé, malgré l'échec du premier.
    expect(called).toEqual(['second']);
  });

  /**
   * Et le pendant indispensable du précédent.
   *
   * Isoler les échecs sans LEVER à la fin ferait marquer le travail « terminé »
   * par BullMQ : le gestionnaire en échec ne serait jamais rejoué, et son travail
   * disparaîtrait sans trace. Les gestionnaires étant idempotents, rejouer ceux
   * qui avaient réussi ne coûte rien — perdre celui qui a échoué casse la chaîne.
   */
  it('lève À LA FIN pour que le travail soit rejoué', async () => {
    const registry = new EventHandlerRegistry();
    registry.on('user.deleted', 'fragile', () => Promise.reject(new Error('boum')));

    await expect(registry.dispatch(job('user.deleted'))).rejects.toThrow(/fragile/);
  });

  it('ne lève pas quand tout réussit', async () => {
    const registry = new EventHandlerRegistry();
    registry.on('user.deleted', 'ok', () => Promise.resolve());
    await expect(registry.dispatch(job('user.deleted'))).resolves.toBeUndefined();
  });

  it('nomme le module fautif dans l’erreur', async () => {
    const registry = new EventHandlerRegistry();
    registry.on('user.deleted', 'guides', () => Promise.reject(new Error('boum')));

    // Sans le nom, un échec dans le journal du worker ne dit pas où chercher.
    await expect(registry.dispatch(job('user.deleted'))).rejects.toThrow(/guides/);
  });

  it('décrit ses abonnements, regroupés par type', () => {
    const registry = new EventHandlerRegistry();
    registry.on('user.deleted', 'help', () => Promise.resolve());
    registry.on('user.deleted', 'guides', () => Promise.resolve());
    registry.on('user.blocked', 'communities', () => Promise.resolve());

    const described = registry.describe();
    expect(described).toHaveLength(2);
    expect(described).toContain('user.deleted → help, guides');
    expect(described).toContain('user.blocked → communities');
  });

  it('transmet l’événement complet au gestionnaire', async () => {
    const registry = new EventHandlerRegistry();
    let received: DomainEventJob | null = null;
    registry.on('user.onboarded_location', 'communities', (j) => {
      received = j;
      return Promise.resolve();
    });

    await registry.dispatch(job('user.onboarded_location', 'membre-42'));
    // L'identifiant de l'agrégat est ce dont un gestionnaire a besoin en premier :
    // sans lui, il ne sait pas de qui on parle.
    expect(received).not.toBeNull();
    expect((received as unknown as DomainEventJob).aggregateId).toBe('membre-42');
  });
});
