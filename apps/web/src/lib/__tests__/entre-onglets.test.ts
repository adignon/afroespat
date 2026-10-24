import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Le signal des compteurs entre onglets (lot F2). Deux onglets sont simulés par
 * deux instances de module (`vi.resetModules`) reliées par un faux canal commun :
 * un `BroadcastChannel` réel ne remet pas un message à son propre émetteur, et le
 * faux ci-dessous respecte cette règle.
 */
class FauxCanal {
  static tous: FauxCanal[] = [];
  private ecouteurs = new Set<(e: MessageEvent<unknown>) => void>();
  constructor(readonly nom: string) {
    FauxCanal.tous.push(this);
  }
  postMessage(data: unknown): void {
    for (const autre of FauxCanal.tous) {
      if (autre === this || autre.nom !== this.nom) continue;
      autre.ecouteurs.forEach((e) => {
        e({ data } as MessageEvent<unknown>);
      });
    }
  }
  addEventListener(_: string, e: (m: MessageEvent<unknown>) => void): void {
    this.ecouteurs.add(e);
  }
  removeEventListener(_: string, e: (m: MessageEvent<unknown>) => void): void {
    this.ecouteurs.delete(e);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  FauxCanal.tous = [];
  window.localStorage.clear();
});

describe('entre-onglets', () => {
  it('un onglet qui diffuse est entendu par l’autre, jamais par lui-même', async () => {
    vi.stubGlobal('BroadcastChannel', FauxCanal);
    const a = await import('../entre-onglets');
    vi.resetModules();
    const b = await import('../entre-onglets');

    const recuB = vi.fn();
    const recuA = vi.fn();
    const stopB = b.ecouterAutresOnglets(recuB);
    const stopA = a.ecouterAutresOnglets(recuA);

    a.diffuserCompteurs({ messages: 2, notifications: 0 });
    expect(recuB).toHaveBeenCalledWith({ messages: 2, notifications: 0 });
    expect(recuA).not.toHaveBeenCalled();

    stopB();
    a.diffuserCompteurs({ messages: 2, notifications: 1 });
    expect(recuB).toHaveBeenCalledTimes(1);
    stopA();
  });

  it('une charge qui n’a pas la forme attendue est ignorée', async () => {
    vi.stubGlobal('BroadcastChannel', FauxCanal);
    const a = await import('../entre-onglets');
    const recu = vi.fn();
    a.ecouterAutresOnglets(recu);
    new FauxCanal('afroespat:compteurs').postMessage({ notifications: 'beaucoup' });
    new FauxCanal('afroespat:compteurs').postMessage(null);
    expect(recu).not.toHaveBeenCalled();
  });

  it('sans BroadcastChannel : l’événement `storage` prend le relais', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    const a = await import('../entre-onglets');
    const recu = vi.fn();
    a.ecouterAutresOnglets(recu);

    a.diffuserCompteurs({ messages: 0, notifications: 4 });
    const ecrit = window.localStorage.getItem('afroespat:compteurs');
    expect(ecrit).not.toBeNull();
    // Le navigateur ne déclenche `storage` que dans les AUTRES onglets : on le joue.
    window.dispatchEvent(new StorageEvent('storage', { key: 'afroespat:compteurs', newValue: ecrit }));
    expect(recu).toHaveBeenCalledWith({ messages: 0, notifications: 4 });

    window.dispatchEvent(new StorageEvent('storage', { key: 'autre', newValue: ecrit }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'afroespat:compteurs', newValue: '{pas du json' }));
    expect(recu).toHaveBeenCalledTimes(1);
  });
});
