import { describe, expect, it } from 'vitest';
import { METIERS_PUCES_MAX, pastillesMetiers, phraseAnnonces } from './appels';
import { evenementTermine, statutDeLigne } from '../agenda/data';

/**
 * Lot W2A, phase 2 — trois convertisseurs qui remplacent des littéraux de maquette :
 * les pastilles de métier (S06), la phrase de S01 et le statut d'une ligne de E04.
 */
const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const metiers = (n: number) =>
  Array.from({ length: n }, (_v, i) => ({ id: uuid(i + 1), nameFr: `Métier ${String(i + 1)}` }));

describe('S06 — les pastilles de métier viennent du référentiel (2.14)', () => {
  it('sans métier ayant une fiche, il n’y a aucune pastille', () => {
    expect(pastillesMetiers([], { actif: '', plus: false, ville: '' })).toEqual([]);
  });

  it('jamais « Auto-école » : on ne dessine que les noms reçus', () => {
    const p = pastillesMetiers(metiers(3), { actif: '', plus: false, ville: '' });
    expect(p.map((x) => x.libelle)).toEqual(['Métier 1', 'Métier 2', 'Métier 3']);
  });

  it('chaque pastille filtre par identifiant de métier, en gardant la ville', () => {
    const [premier] = pastillesMetiers(metiers(2), { actif: '', plus: false, ville: uuid(99) });
    expect(premier?.href).toBe(`/services/annuaire?ville=${uuid(99)}&metier=${uuid(1)}`);
    expect(premier?.actif).toBe(false);
  });

  it('la pastille active se rappuie pour se retirer', () => {
    const [premier] = pastillesMetiers(metiers(2), { actif: uuid(1), plus: false, ville: '' });
    expect(premier?.actif).toBe(true);
    expect(premier?.href).toBe('/services/annuaire');
  });

  it('au-delà de la coupe, « Plus » ouvre toute la liste puis « Moins » la referme', () => {
    const tous = metiers(METIERS_PUCES_MAX + 3);
    const replie = pastillesMetiers(tous, { actif: '', plus: false, ville: '' });
    expect(replie).toHaveLength(METIERS_PUCES_MAX + 1);
    expect(replie.at(-1)).toMatchObject({ libelle: 'Plus', href: '/services/annuaire?plus=1' });

    const deplie = pastillesMetiers(tous, { actif: '', plus: true, ville: '' });
    expect(deplie).toHaveLength(tous.length + 1);
    expect(deplie.at(-1)).toMatchObject({ libelle: 'Moins', href: '/services/annuaire' });
  });

  it('le métier actif reste visible même au-delà de la coupe', () => {
    const tous = metiers(METIERS_PUCES_MAX + 3);
    const actif = tous.at(-1)!.id;
    const replie = pastillesMetiers(tous, { actif, plus: false, ville: '' });
    expect(replie.some((p) => p.actif)).toBe(true);
  });
});

describe('S01 — « 0 annonces à France » nommait un pays à la place d’une ville (2.16)', () => {
  it('une ville commune est nommée, et le pluriel suit le nombre', () => {
    expect(phraseAnnonces(3, 'Évry')).toBe('3 annonces à Évry');
    expect(phraseAnnonces(1, 'Évry')).toBe('1 annonce à Évry');
  });

  it('sans ville commune, on dit « dans votre pays » — jamais le nom du pays', () => {
    expect(phraseAnnonces(4, null)).toBe('4 annonces dans votre pays');
    expect(phraseAnnonces(4, null)).not.toMatch(/France/);
  });

  it('sans annonce, aucun lieu', () => {
    expect(phraseAnnonces(0, null)).toBe('0 annonce');
    expect(phraseAnnonces(0, 'Évry')).toBe('0 annonce');
  });
});

describe('E04 — le statut de chaque inscrit est réel (2.18)', () => {
  it('une présence enregistrée est « Présent·e »', () => {
    expect(statutDeLigne({ figee: true, coche: true, connue: true }, false)).toBe('Présent·e');
  });

  it('une case cochée mais pas envoyée n’est pas encore un fait', () => {
    expect(statutDeLigne({ figee: false, coche: true, connue: true }, false)).toBe('À enregistrer');
  });

  it('un inscrit non pointé est « Inscrit·e » avant la fin, « Absent·e » après', () => {
    expect(statutDeLigne({ figee: false, coche: false, connue: true }, false)).toBe('Inscrit·e');
    expect(statutDeLigne({ figee: false, coche: false, connue: true }, true)).toBe('Absent·e');
  });

  it('une présence inconnue (lecteur non organisateur) ne devient jamais « Absent·e »', () => {
    expect(statutDeLigne({ figee: false, coche: false, connue: false }, true)).toBe('Inscrit·e');
  });

  it('l’événement est terminé à sa fin déclarée, ou à début + fenêtre de pointage', () => {
    const maintenant = new Date('2026-10-24T12:00:00Z');
    expect(evenementTermine({ startsAt: '2026-10-24T08:00:00Z', endsAt: '2026-10-24T10:00:00Z' }, maintenant)).toBe(true);
    expect(evenementTermine({ startsAt: '2026-10-24T08:00:00Z', endsAt: '2026-10-24T13:00:00Z' }, maintenant)).toBe(false);
    expect(evenementTermine({ startsAt: '2026-10-25T08:00:00Z', endsAt: null }, maintenant)).toBe(false);
    expect(evenementTermine({ startsAt: '2026-10-20T08:00:00Z', endsAt: null }, maintenant)).toBe(true);
  });
});
