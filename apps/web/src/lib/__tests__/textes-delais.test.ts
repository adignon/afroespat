import { describe, expect, it } from 'vitest';
import {
  TEXTES_DELAIS,
  phraseNouvelArrivant,
  phrasePaysOrigine,
  phrasePseudo,
} from '../textes-delais';

const MAINTENANT = new Date('2026-10-24T12:00:00Z');

describe('textes-delais — les délais viennent des règles (lot W2A)', () => {
  it('les phrases de K08 reprennent les délais de ACCOUNT_LIMITS', () => {
    expect(TEXTES_DELAIS.exportMobile).toBe('Lien valable 7 jours');
    expect(TEXTES_DELAIS.desactiverMobile).toBe('Réversible 6 mois');
    expect(TEXTES_DELAIS.supprimerMobile).toBe('Définitif après 7 jours');
    expect(TEXTES_DELAIS.suppressionRepit).toBe('Vous avez 7 jours pour changer d’avis.');
  });

  it('ne promet plus « sous 48 h » : rien ne tient cette promesse', () => {
    expect(TEXTES_DELAIS.exportAucune).not.toMatch(/48/);
    expect(TEXTES_DELAIS.exportAucune).toMatch(/7 jours/);
  });

  it('A06 : le délai de 14 jours est celui de GUIDE_PROPOSAL_ESCALATION_DAYS', () => {
    expect(TEXTES_DELAIS.propositionsDelai).toMatch(/^Vous avez 14 jours/);
    expect(TEXTES_DELAIS.correctionDelai).toMatch(/14 jours/);
  });

  it('K01 : la fenêtre des nouveaux arrivants dure 14 jours, pas trois mois', () => {
    expect(TEXTES_DELAIS.nouvelArrivant).toBe('Pendant 14 jours après votre arrivée');
    expect(TEXTES_DELAIS.nouvelArrivant).not.toMatch(/mois/);
  });

  it('K01 : un pseudo jamais changé ne porte aucune date', () => {
    expect(phrasePseudo(null, MAINTENANT)).toBe('Modifiable une fois tous les 30 jours.');
  });

  it('K01 : un pseudo changé dit la date du changement ET celle du prochain', () => {
    expect(phrasePseudo('2026-10-10T09:00:00Z', MAINTENANT)).toBe(
      'Modifié le 10 octobre · prochain changement possible le 9 novembre',
    );
  });

  it('K01 : le délai écoulé, le pseudo est de nouveau modifiable', () => {
    expect(phrasePseudo('2026-08-01T09:00:00Z', MAINTENANT)).toBe(
      'Modifié le 1 août · modifiable à nouveau maintenant',
    );
  });

  it('K01 : la ligne du pays d’origine ne dit « Déjà modifié » que si le pays est figé', () => {
    expect(phrasePaysOrigine(true)).toMatch(/^Déjà modifié une fois/);
    expect(phrasePaysOrigine(false)).toBe('');
  });

  it('K01 : la fin de la fenêtre des nouveaux arrivants se déduit de la date d’arrivée', () => {
    expect(phraseNouvelArrivant('2026-10-20', MAINTENANT)).toBe(
      'Pendant 14 jours après votre arrivée, soit jusqu’au 3 novembre',
    );
    expect(phraseNouvelArrivant('2026-09-01', MAINTENANT)).toMatch(/fenêtre close le 15 septembre/);
    expect(phraseNouvelArrivant(null, MAINTENANT)).toBe('Pendant 14 jours après votre arrivée');
  });
});
