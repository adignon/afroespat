import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { adminImpactReportSchema } from '@app/shared';
import { Temoignages } from './impact';
import { extraitProposable, libelleTrimestre, nomFichierCsv, optionsTrimestres } from './impact-vue';

/**
 * D16 — le rapport d'impact : sélecteur de trimestre, témoignages, export.
 *
 * Ce que ces cas gardent, et que ni `tsc` ni la génération ne voient :
 *
 *   1. LE TRIMESTRE VIENT DU SERVEUR (« 2026-T3 ») et se LIT en français sans jamais passer par l'horloge ;
 *   2. LE SÉLECTEUR liste tout l'HISTORIQUE conservé (« il faut tout conserver »), avec la révision quand
 *      il y en a eu plusieurs, et n'oublie pas le trimestre affiché s'il n'est pas encore calculé ;
 *   3. LES TÉMOIGNAGES n'affichent NI nom NI identifiant d'auteur : « agrégé, jamais nominatif » ;
 *   4. L'EXTRAIT proposé à la citation ne coupe pas un mot et ne reprend pas un titre.
 */

describe('libellés de trimestre', () => {
  it('se lisent en français, sans horloge', () => {
    expect(libelleTrimestre('2026-T3')).toBe('T3 2026 · juillet – septembre');
    expect(libelleTrimestre('2025-T1')).toBe('T1 2025 · janvier – mars');
    expect(libelleTrimestre('2026-T4')).toBe('T4 2026 · octobre – décembre');
    // Une valeur inattendue n'est pas inventée : elle est rendue telle quelle.
    expect(libelleTrimestre('n’importe quoi')).toBe('n’importe quoi');
  });

  it('le fichier exporté porte le trimestre : on n’écrase pas l’export précédent', () => {
    expect(nomFichierCsv('2026-T3')).toBe('rapport-impact-2026-T3.csv');
  });
});

describe('le sélecteur de trimestre', () => {
  const conserves = [
    { quarter: '2026-T3', revision: 2 },
    { quarter: '2026-T2', revision: 1 },
  ];

  it('liste chaque trimestre conservé, la révision seulement quand elle dépasse la première', () => {
    expect(optionsTrimestres(conserves, '2026-T3')).toEqual([
      { valeur: '2026-T3', libelle: 'T3 2026 · juillet – septembre · révision 2' },
      { valeur: '2026-T2', libelle: 'T2 2026 · avril – juin' },
    ]);
  });

  it('garde le trimestre affiché même s’il n’est pas calculé, en le disant', () => {
    const o = optionsTrimestres(conserves, '2026-T1');
    expect(o[0]).toEqual({ valeur: '2026-T1', libelle: 'T1 2026 · janvier – mars · pas encore calculé' });
    expect(o).toHaveLength(3);
  });

  it('un historique vide ne casse pas le sélecteur', () => {
    expect(optionsTrimestres([], '2026-T3')).toHaveLength(1);
  });
});

describe('les témoignages', () => {
  const t = [
    { id: 'a', quote: 'Le marché du dimanche matin, tout le monde s’y retrouve.', kind: 'CITY_TIP' as const, cityName: 'Lyon' },
    { id: 'b', quote: 'Un guide qui m’a fait gagner trois semaines.', kind: 'GUIDE' as const, cityName: null },
  ];

  it('montrent la citation, son type et sa ville — rien d’autre', () => {
    const html = renderToStaticMarkup(<Temoignages temoignages={t} />);
    expect(html).toContain('« Le marché du dimanche matin, tout le monde s’y retrouve. »');
    expect(html).toContain('Conseil de ville · Lyon');
    expect(html).toContain('Extrait de guide');
    expect(html).not.toMatch(/auteur|userId|handle|prénom/i);
  });

  it('sans témoignage approuvé : une phrase, pas une carte inventée', () => {
    const html = renderToStaticMarkup(<Temoignages temoignages={[]} />);
    expect(html).toContain('Aucun témoignage approuvé pour ce trimestre.');
    expect(html).not.toContain('<blockquote');
  });

  it('les cartes ne se coupent pas entre deux pages à l’impression', () => {
    expect(renderToStaticMarkup(<Temoignages temoignages={t} />)).toContain('admin-print-carte');
  });

  it('le schéma partagé refuse un témoignage qui porterait un auteur', () => {
    const rapport = {
      trimestre: '2026-T3', revision: 1, computedAt: '2026-10-01T06:00:00.000Z', items: [], quarters: [],
      temoignages: [{ id: 'a', quote: 'x', kind: 'GUIDE', cityName: null, authorUserId: 'u-1' }],
    };
    expect(adminImpactReportSchema.safeParse(rapport).success).toBe(false);
  });
});

describe('l’extrait proposé à la citation', () => {
  it('ne reprend pas les titres de section', () => {
    const e = extraitProposable('## Le guichet\n\nVenez avant l’ouverture, la file s’allonge vite.\n\n### Ce qui a coûté du temps\n\nLa mauvaise adresse.', 300);
    expect(e).toBe('Venez avant l’ouverture, la file s’allonge vite. La mauvaise adresse.');
  });

  it('plafonne sans couper un mot et finit par une ellipse', () => {
    const e = extraitProposable('mot '.repeat(200), 50);
    expect(e.length).toBeLessThanOrEqual(50);
    expect(e.endsWith('…')).toBe(true);
    expect(e).not.toMatch(/mo…$/);
  });

  it('un texte court est rendu tel quel', () => {
    expect(extraitProposable('Court.', 300)).toBe('Court.');
  });
});
