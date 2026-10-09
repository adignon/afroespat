import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { STORY_BACKGROUND_COLORS, STORY_DISCOVERY_CATEGORIES, STORY_SUBJECTS } from '@app/shared';
import { demoStoriesAsked } from '../seed/stories.js';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES STORIES DE DÉMONSTRATION : L'INTERRUPTEUR, ET CE QU'ELLES CONTIENNENT  ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Deux choses, et elles sont distinctes — c'est la leçon de `pilot-city.ts`.
 *
 *   1. LE DROIT DE SEMER. Un chargement de données ne doit pas publier des
 *      contenus signés par des membres qui n'existent pas. L'interrupteur est
 *      donc explicite, et refusé en production ;
 *   2. CE QU'ON SÈME. Les fonds et les sujets sortent des listes fermées de
 *      `@app/shared`. Une couleur écrite au jugé passerait la base — la colonne
 *      est un `String` — mais le composeur ne la proposerait jamais, et le jour
 *      où un membre rouvrirait la story pour l'éditer, sa palette n'aurait rien
 *      à cocher. C'est le genre d'écart qu'on ne voit qu'à l'usage.
 */
describe('stories de démonstration (seed)', () => {
  describe('l’interrupteur', () => {
    it('ne sème RIEN par défaut', () => {
      expect(demoStoriesAsked({})).toBe(false);
      expect(demoStoriesAsked({ SEED_DEMO_STORIES: '' })).toBe(false);
      expect(demoStoriesAsked({ SEED_DEMO_STORIES: 'false' })).toBe(false);
      expect(demoStoriesAsked({ SEED_DEMO_STORIES: 'non' })).toBe(false);
    });

    it('accepte les mêmes mots que l’activation de la ville pilote', () => {
      for (const mot of ['1', 'true', 'TRUE', 'yes', 'oui', 'on', ' true ']) {
        expect(demoStoriesAsked({ SEED_DEMO_STORIES: mot }), mot).toBe(true);
      }
    });

    it('REFUSE en production, même demandé explicitement', () => {
      expect(() =>
        demoStoriesAsked({ SEED_DEMO_STORIES: 'true', NODE_ENV: 'production' }),
      ).toThrow(/production/);
    });

    it('ne regarde pas l’environnement quand personne n’a rien demandé', () => {
      // Pas d'exception : ne rien faire en production est le comportement normal.
      expect(demoStoriesAsked({ NODE_ENV: 'production' })).toBe(false);
    });
  });

  /**
   * On relit le FICHIER plutôt que d'exporter la liste : ces données n'ont aucune
   * raison d'être publiques, et les exporter pour un test en ferait une interface.
   */
  describe('ce que la liste contient', () => {
    const source = readFileSync(fileURLToPath(new URL('../seed/stories.ts', import.meta.url)), 'utf8');

    it('n’emploie que des fonds de la palette', () => {
      const fonds = [...source.matchAll(/backgroundColor: '(#[0-9A-F]{6})'/g)].map((m) => m[1]);
      expect(fonds.length).toBeGreaterThan(5);
      for (const fond of fonds) {
        expect(STORY_BACKGROUND_COLORS as readonly string[], fond).toContain(fond);
      }
    });

    it('n’emploie que des sujets et des catégories du référentiel', () => {
      const sujets = [...source.matchAll(/category: '([A-Z_]+)'/g)].map((m) => m[1]);
      const connus = [...STORY_SUBJECTS, ...STORY_DISCOVERY_CATEGORIES] as readonly string[];
      expect(sujets.length).toBeGreaterThan(5);
      for (const sujet of sujets) {
        expect(connus, sujet).toContain(sujet);
      }
    });

    /**
     * §2.6 : « ni lien, ni numéro ». Le composeur l'impose aux membres ; des
     * contenus de démonstration qui l'enfreindraient montreraient une story que
     * le produit aurait refusée.
     */
    it('ne contient ni lien ni chiffre dans les corps', () => {
      const corps = [...source.matchAll(/body:\s*\n?\s*'([^']+)'/g)].map((m) => m[1] ?? '');
      expect(corps.length).toBeGreaterThan(10);
      for (const ligne of corps) {
        expect(ligne, ligne).not.toMatch(/https?:|www\.|\d/);
      }
    });
  });
});
