import { describe, expect, it } from 'vitest';
import { evenementDepuis, membresDepuis, parrainDepuis } from './atterrissage';

/**
 * L'ATTERRISSAGE SANS PARCOURS — W1A, phase 0.1. Les converters seuls : l'écran lit
 * l'API, jamais la maquette (« Aïcha Diop », « 1 400 membres », « 24 FÉV »).
 */
describe('atterrissage sans parcours', () => {
  it('un événement : jour, mois en lettres, lieu et heure DE LA VILLE', () => {
    expect(
      evenementDepuis({
        title: 'Apéro des étudiants',
        venueName: 'Berges du Rhône',
        addressText: null,
        // 17h00 UTC = 19h00 à Paris en été.
        startsAt: '2027-06-24T17:00:00.000Z',
        timeZone: 'Europe/Paris',
        localDate: '2027-06-24',
      }),
    ).toEqual({ d: '24', m: 'JUN', t: 'Apéro des étudiants', s: 'Berges du Rhône · 19h00' });
  });

  it('un événement sans lieu ne garde que l’heure', () => {
    const e = evenementDepuis({
      title: 'Visio',
      venueName: null,
      addressText: null,
      startsAt: '2027-02-02T10:30:00.000Z',
      timeZone: 'Europe/Paris',
      localDate: '2027-02-02',
    });
    expect(e.s).toBe('11h30');
    expect(e.m).toBe('FÉV');
  });

  it('les membres : réseau ouvert, bientôt ouvert, rejoint ou non', () => {
    expect(membresDepuis({ isActive: true, memberCount: 1400 }, true)).toBe('1400 membres · vous avez rejoint ce réseau');
    expect(membresDepuis({ isActive: true, memberCount: 1 }, false)).toBe('1 membre');
    expect(membresDepuis({ isActive: false, memberCount: 0 }, false)).toBe('Réseau bientôt ouvert');
    expect(membresDepuis(undefined, true)).toBe('Vous avez rejoint ce réseau');
    expect(membresDepuis(undefined, false)).toBe('');
  });

  it('le parrain suggéré : initiales du nom, aucune déduction de genre', () => {
    const p = parrainDepuis(
      {
        userId: 'u',
        handle: 'aicha',
        displayName: 'Aïcha Diop',
        avatarUrl: null,
        city: null,
        bio: null,
        journeyTemplateIds: [],
        maxMentees: 2,
        activeMenteeCount: 0,
        completedCount: 0,
        avgRating: null,
        availability: 'AVAILABLE',
        isAvailable: true,
      },
      'Lyon',
    );
    expect(p).toMatchObject({ handle: 'aicha', initiales: 'AD', detail: 'Parrain·e suggéré·e · Lyon' });
  });
});
