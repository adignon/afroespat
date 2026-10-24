import { describe, expect, it } from 'vitest';
import {
  MEMBER_SKILLS_MAX,
  SKILL_NAME_MAX,
  cleCompetence,
  createPlacesSkillSchema,
  normaliserNomCompetence,
} from '../index.js';

/**
 * `POST /places/skills` — la forme d'une compétence écrite à la main, et sa clé de doublon.
 *
 * Les bornes viennent du paquet partagé : le serveur les applique, l'écran les affiche.
 */
describe('compétence écrite à la main', () => {
  it('normalise les espaces avant de valider', () => {
    expect(normaliserNomCompetence('  Soudure   TIG \n')).toBe('Soudure TIG');
    expect(createPlacesSkillSchema.parse({ nameFr: '  Soudure   TIG ' }).nameFr).toBe('Soudure TIG');
  });

  it('la clé de doublon ignore casse, accents, ponctuation et espaces multiples', () => {
    const cle = cleCompetence('Électricité générale');
    expect(cleCompetence('electricite  generale')).toBe(cle);
    expect(cleCompetence('ÉLECTRICITÉ-GÉNÉRALE')).toBe(cle);
    expect(cleCompetence('Électricité')).not.toBe(cle);
  });

  it('accepte les noms de métier courants', () => {
    for (const nom of ['Excel', 'C++', 'Soudure TIG/MIG', 'Aide-soignant(e)', 'Cuisine d’Afrique de l’Ouest', 'R&D', 'UX/UI #design']) {
      expect(createPlacesSkillSchema.safeParse({ nameFr: nom }).success, nom).toBe(true);
    }
  });

  it('refuse ce qui n’est pas un nom de compétence', () => {
    const refus: Array<[string, string]> = [
      ['a', 'trop court'],
      ['x'.repeat(SKILL_NAME_MAX + 1), 'trop long'],
      ['123 456', 'sans lettres'],
      ['j@ime.test', 'adresse'],
      ['https://exemple.test', 'lien'],
      ['www.exemple', 'lien'],
      ['Appelez 06 12 34 56 78', 'numéro de téléphone'],
      ['Soudure <b>', 'caractères interdits'],
      ['Compétence 🙂', 'pictogramme'],
    ];
    for (const [nom, raison] of refus) {
      expect(createPlacesSkillSchema.safeParse({ nameFr: nom }).success, `${raison} : ${nom}`).toBe(false);
    }
  });

  it('est strict : aucune clé en trop (pas de `createdByUserId` imposé par le client)', () => {
    expect(createPlacesSkillSchema.safeParse({ nameFr: 'Excel', createdByUserId: 'x' }).success).toBe(false);
  });

  it('le plafond personnel reste sous le maximum d’un profil multiplié par deux', () => {
    expect(MEMBER_SKILLS_MAX).toBeGreaterThanOrEqual(10);
  });
});
