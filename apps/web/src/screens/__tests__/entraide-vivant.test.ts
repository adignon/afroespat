import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ligneParcours } from '../entraide/appels';

/**
 * Lot D — entraide et parrainage vivants (H01 à H10).
 *
 * Deux choses se prouvent ici : la ligne d'étape que les listes écrivent, et que les
 * cadres générés posent bien les composants de geste à la place du dessin.
 */
describe('ligne d’étape de parcours (06 §2.5)', () => {
  it('compose « Étape N · nom · parcours type »', () => {
    expect(
      ligneParcours({ journeyStep: { stepName: 'Logement', stepNumber: 7, journeyTypeName: 'Études' } }),
    ).toBe('Étape 7 · Logement · parcours Études');
  });

  it('retombe sur la phrase sûre quand la carte ne porte pas d’étape', () => {
    expect(ligneParcours({ journeyStep: null })).toBe('Demande issue d’un parcours');
  });
});

const lire = (f: string): string => readFileSync(join(__dirname, '..', f), 'utf8');

describe('cadres générés : les gestes remplacent le dessin', () => {
  const regions: [string, string][] = [
    ['h03/desktop.generated.tsx', '<FormulaireDemande'],
    ['h03/mobile.generated.tsx', '<FormulaireDemande'],
    ['h05/desktop.generated.tsx', '<ListeParrains'],
    ['h05/mobile.generated.tsx', '<ListeParrains'],
    ['h07/desktop.generated.tsx', '<MesParrainagesVivants'],
    ['h07/mobile.generated.tsx', '<MesParrainagesVivants'],
    ['h08/desktop.generated.tsx', '<FormulaireParrain'],
    ['h08/mobile.generated.tsx', '<FormulaireParrain'],
    ['h09/desktop.generated.tsx', '<MesDemandes'],
    ['h09/mobile.generated.tsx', '<MesDemandes'],
    ['h10/desktop.generated.tsx', '<MesReponses'],
    ['h10/mobile.generated.tsx', '<MesReponses'],
    ['h02/desktop.generated.tsx', '<ActionsReponse'],
    ['h02/mobile.generated.tsx', '<BarreReponse'],
    ['h06/desktop.generated.tsx', '<BoutonDemander'],
  ];
  it.each(regions)('%s pose %s', (fichier, composant) => {
    expect(lire(fichier)).toContain(composant);
  });

  it('plus aucun « Signaler » du bandeau n’est un lien mort sur H01 à H10', () => {
    for (const h of ['h01', 'h02', 'h03', 'h04', 'h05', 'h06', 'h07', 'h08', 'h09', 'h10']) {
      expect(lire(`${h}/desktop.generated.tsx`), h).not.toMatch(/<a href="#"[^>]*>Signaler<\/a>/);
      expect(lire(`${h}/desktop.generated.tsx`), h).toContain('<SignalerArgent');
    }
  });

  it('les valeurs dessinées en dur ont disparu des listes', () => {
    expect(lire('h05/desktop.generated.tsx')).not.toContain('Aïcha Diop');
    expect(lire('h05/mobile.generated.tsx')).not.toContain('>Lyon<');
    expect(lire('h09/desktop.generated.tsx')).not.toContain('Un lit et une table');
    expect(lire('h07/desktop.generated.tsx')).not.toContain('Yasmine B.');
  });
});
