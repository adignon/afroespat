import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { announcementWriteSchema } from '@app/shared';
import { PLANS, SELECTION_VIDE, SelecteursCiblage, depuisCible, resumeCiblage, versCible } from './ciblage';

/**
 * D12 — les sélecteurs de ciblage d'une annonce : pays, villes, phases, plans.
 * Le serveur calculait déjà les quatre ; l'écran n'en offrait que deux.
 */
const UUID = '01a16c8a-18c3-7000-aad3-753dd99c54f8';

describe('la sélection → le `target` du serveur', () => {
  it('rien de coché = aucun ciblage (tous les membres), jamais des tableaux vides', () => {
    expect(versCible(SELECTION_VIDE)).toBeNull();
  });

  it('n’envoie que les dimensions cochées', () => {
    expect(versCible({ ...SELECTION_VIDE, plans: ['PREMIUM'] })).toEqual({ plans: ['PREMIUM'] });
    expect(versCible({ countryIds: [UUID], cityIds: [], phases: ['SETTLED'], plans: ['PRO', 'PRO_PLUS'] })).toEqual({
      countryIds: [UUID],
      phases: ['SETTLED'],
      plans: ['PRO', 'PRO_PLUS'],
    });
  });

  it('le résultat passe le schéma PARTAGÉ de l’annonce (celui du serveur)', () => {
    const cible = versCible({ countryIds: [UUID], cityIds: [UUID], phases: ['PRE_DEPARTURE'], plans: ['FREE'] });
    const r = announcementWriteSchema.safeParse({ title: 'Titre', body: 'Texte', target: cible, startsAt: '2026-10-24T10:00:00.000Z' });
    expect(r.success).toBe(true);
  });

  it('chaque plan proposé est accepté par le serveur', () => {
    for (const plan of PLANS) {
      expect(announcementWriteSchema.safeParse({ title: 't', body: 'b', target: { plans: [plan] }, startsAt: '2026-10-24T10:00:00.000Z' }).success).toBe(true);
    }
  });
});

describe('le `target` relu → la sélection (l’éditeur rouvre l’annonce à l’identique)', () => {
  it('aller-retour sans perte', () => {
    const cible = { countryIds: [UUID], phases: ['SETTLED'], plans: ['PREMIUM'] };
    expect(versCible(depuisCible(cible))).toEqual(cible);
  });
  it('null ou absent = sélection vide', () => {
    expect(depuisCible(null)).toEqual(SELECTION_VIDE);
    expect(depuisCible(undefined)).toEqual(SELECTION_VIDE);
  });
});

describe('le résumé du ciblage', () => {
  const noms = { pays: new Map([[UUID, 'Bénin']]), villes: new Map([['v1', 'Lyon'], ['v2', 'Paris']]) };
  it('« Tous les membres » sans ciblage', () => {
    expect(resumeCiblage(SELECTION_VIDE, noms)).toBe('Tous les membres');
  });
  it('nomme chaque dimension cochée', () => {
    expect(resumeCiblage({ countryIds: [UUID], cityIds: ['v1', 'v2'], phases: ['SETTLED'], plans: ['PREMIUM'] }, noms)).toBe('Bénin · Lyon, Paris · Installé·e · Premium');
  });
});

describe('les sélecteurs', () => {
  it('proposent les quatre groupes, et le rendu initial (avant chargement) porte les phases et les plans', () => {
    const html = renderToStaticMarkup(<SelecteursCiblage valeur={SELECTION_VIDE} onChange={() => undefined} peut />);
    for (const g of ['Pays d’origine', 'Villes', 'Phases', 'Plans']) expect(html).toContain(`aria-label="${g}"`);
    for (const l of ['Avant le départ', 'Installé·e', 'Gratuit', 'Premium', 'Pro+']) expect(html).toContain(l);
    expect(html).toContain('rien de coché = tous les membres');
  });
  it('les choix cochés sont annoncés (aria-pressed) et désactivés sans droit d’écriture', () => {
    const html = renderToStaticMarkup(<SelecteursCiblage valeur={{ ...SELECTION_VIDE, plans: ['PREMIUM'] }} onChange={() => undefined} peut={false} />);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Premium|disabled=""[^>]*aria-pressed="true"/);
    expect(html).toContain('disabled=""');
  });
});
