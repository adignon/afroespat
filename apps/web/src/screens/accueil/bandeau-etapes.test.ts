import { describe, expect, it, vi } from 'vitest';
import { webFrameFor } from './data';

/**
 * LE BANDEAU « 1 · Écrire / 2 · Rattacher / 3 · Publier » (A14, 1440 px).
 *
 * Vague 1 : trois boutons sans gestionnaire. Ils deviennent la navigation entre
 * étapes — retour sur une étape FRANCHIE, étape courante marquée, étapes futures
 * verrouillées. `webFrameFor` est le seul endroit qui le décide : le JSX transcodé
 * ne fait que lire `current`, `locked` et `onGo`.
 */
describe('webFrameFor — le bandeau d’étapes', () => {
  const noop = (): void => undefined;

  it('marque l’étape courante, verrouille la courante et les futures', () => {
    const { steps } = webFrameFor(1, false, noop);
    expect(steps.map((s) => s.current)).toEqual([false, true, false]);
    expect(steps.map((s) => s.locked)).toEqual([false, true, true]);
  });

  it('ne laisse revenir QUE sur une étape déjà franchie', () => {
    const onStep = vi.fn();
    const { steps } = webFrameFor(2, false, noop, { onStep });
    steps[0]?.onGo();
    steps[1]?.onGo();
    expect(onStep.mock.calls).toEqual([[0], [1]]);

    onStep.mockClear();
    const depart = webFrameFor(0, false, noop, { onStep }).steps;
    depart.forEach((s) => {
      s.onGo();
    });
    expect(onStep).not.toHaveBeenCalled();
  });

  it('garde les barres et les encres de la maquette (aucune couleur neuve)', () => {
    const { steps } = webFrameFor(1, false, noop);
    expect(steps.map((s) => s.bar)).toEqual(['#16785E', '#16785E', '#E6EBE9']);
    expect(steps.map((s) => s.fg)).toEqual(['#8A958F', '#16211D', '#8A958F']);
  });
});
