import { describe, expect, it } from 'vitest';
import { fusionner, resumeListe, SuiteCurseur, type PageSuivante } from './use-pages-curseur';

interface Ligne {
  readonly id: string;
}
const ligne = (id: string): Ligne => ({ id });
const idDe = (l: Ligne): string => l.id;

function differe<V>(): { promesse: Promise<V>; resoudre: (v: V) => void; rejeter: (e: unknown) => void } {
  let resoudre!: (v: V) => void;
  let rejeter!: (e: unknown) => void;
  const promesse = new Promise<V>((ok, ko) => {
    resoudre = ok;
    rejeter = ko;
  });
  return { promesse, resoudre, rejeter };
}

describe('fusionner', () => {
  it('ajoute les nouveaux à la suite, dans l’ordre', () => {
    expect(fusionner([ligne('a'), ligne('b')], [ligne('c')], idDe).map(idDe)).toEqual(['a', 'b', 'c']);
  });
  it('ne répète pas un élément déjà affiché (curseur décalé par une publication récente)', () => {
    expect(fusionner([ligne('a'), ligne('b')], [ligne('b'), ligne('c'), ligne('c')], idDe).map(idDe)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
  it('garde la version déjà affichée (mise à jour optimiste)', () => {
    const actuel = { id: 'a', v: 2 };
    expect(fusionner([actuel], [{ id: 'a', v: 1 }], idDe)[0]).toBe(actuel);
  });
});

describe('resumeListe', () => {
  it('annonce « 20 sur 134 » quand le total dépasse ce qui est affiché', () => {
    expect(resumeListe(20, 134)).toBe('20 sur 134');
  });
  it('se tait quand le total est inconnu ou atteint', () => {
    expect(resumeListe(20, null)).toBeNull();
    expect(resumeListe(20, undefined)).toBeNull();
    expect(resumeListe(20, 20)).toBeNull();
  });
});

describe('SuiteCurseur', () => {
  it('rend la page à l’écran qui la fusionne, puis revient au repos', async () => {
    const recues: PageSuivante<Ligne>[] = [];
    const suite = new SuiteCurseur<Ligne>(
      () => Promise.resolve({ items: [ligne('c')], nextCursor: null }),
      (p) => recues.push(p),
    );
    await suite.lancer('curseur-1');
    expect(recues).toHaveLength(1);
    expect(suite.etat.chargement).toBe(false);
    expect(suite.etat.aEchoue).toBe(false);
  });

  it('s’arrête quand nextCursor est nul : aucune requête', async () => {
    let appels = 0;
    const suite = new SuiteCurseur<Ligne>(
      () => {
        appels += 1;
        return Promise.resolve({ items: [], nextCursor: null });
      },
      () => undefined,
    );
    await suite.lancer(null);
    expect(appels).toBe(0);
  });

  it('ignore un second appel tant que le premier est en vol', async () => {
    const d = differe<PageSuivante<Ligne>>();
    let appels = 0;
    const suite = new SuiteCurseur<Ligne>(
      () => {
        appels += 1;
        return d.promesse;
      },
      () => undefined,
    );
    const premier = suite.lancer('x');
    void suite.lancer('x');
    expect(suite.etat.chargement).toBe(true);
    d.resoudre({ items: [], nextCursor: null });
    await premier;
    expect(appels).toBe(1);
  });

  it('garde l’erreur et rejoue la même page sur « Réessayer »', async () => {
    const curseurs: string[] = [];
    let essai = 0;
    const recues: PageSuivante<Ligne>[] = [];
    const suite = new SuiteCurseur<Ligne>(
      (c) => {
        curseurs.push(c);
        essai += 1;
        return essai === 1
          ? Promise.reject(new Error('réseau'))
          : Promise.resolve({ items: [ligne('z')], nextCursor: null });
      },
      (p) => recues.push(p),
    );
    await suite.lancer('page-2');
    expect(suite.etat.aEchoue).toBe(true);
    expect(recues).toHaveLength(0);
    await suite.reessayer();
    expect(curseurs).toEqual(['page-2', 'page-2']);
    expect(recues).toHaveLength(1);
    expect(suite.etat.aEchoue).toBe(false);
  });

  it('annule au changement de filtre : la réponse tardive n’est pas appliquée', async () => {
    const d = differe<PageSuivante<Ligne>>();
    let signalVu: AbortSignal | null = null;
    const recues: PageSuivante<Ligne>[] = [];
    const suite = new SuiteCurseur<Ligne>(
      (_c, signal) => {
        signalVu = signal;
        return d.promesse;
      },
      (p) => recues.push(p),
    );
    const vol = suite.lancer('x');
    suite.annuler();
    d.resoudre({ items: [ligne('tard')], nextCursor: null });
    await vol;
    expect((signalVu as AbortSignal | null)?.aborted).toBe(true);
    expect(recues).toHaveLength(0);
    expect(suite.etat.chargement).toBe(false);
  });

  it('une erreur tardive d’une requête annulée ne s’affiche pas', async () => {
    const d = differe<PageSuivante<Ligne>>();
    const suite = new SuiteCurseur<Ligne>(
      () => d.promesse,
      () => undefined,
    );
    const vol = suite.lancer('x');
    suite.annuler();
    d.rejeter(new Error('annulée'));
    await vol;
    expect(suite.etat.aEchoue).toBe(false);
  });

  it('suit les pages l’une après l’autre jusqu’à la fin', async () => {
    const pages: Record<string, PageSuivante<Ligne>> = {
      p2: { items: [ligne('3'), ligne('4')], nextCursor: 'p3' },
      p3: { items: [ligne('4'), ligne('5')], nextCursor: null },
    };
    let liste: Ligne[] = [ligne('1'), ligne('2')];
    let curseur: string | null = 'p2';
    const suite = new SuiteCurseur<Ligne>(
      (c) => Promise.resolve(pages[c] ?? { items: [], nextCursor: null }),
      (p) => {
        liste = fusionner(liste, p.items, idDe);
        curseur = p.nextCursor;
      },
    );
    await suite.lancer(curseur);
    await suite.lancer(curseur);
    await suite.lancer(curseur);
    expect(liste.map(idDe)).toEqual(['1', '2', '3', '4', '5']);
    expect(curseur).toBeNull();
  });
});
