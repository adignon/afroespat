import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { adminDashboardOverviewSchema, type AdminDashboardOverview } from '@app/shared';
import { SQUELETTE_D02 } from '@/screens/administration/data';
import { Alertes, Carte, IndicateurCle, TableauDeBord } from './tableau-de-bord';
import {
  ABSENT,
  cartesOverview,
  courbe,
  entier,
  lignesAlertes,
  note,
  objectif,
  pourcentage,
  proportion,
  variation,
} from './tableau-de-bord-vue';

/**
 * D02 — le tableau de bord d'équipe, entièrement branché (15 §5.1).
 *
 * Ce qu'on garde ici, et que `tsc` ne voit pas :
 *
 *   1. UNE MESURE ABSENTE N'EST JAMAIS UN NOMBRE : `null` → « — » et « Pas encore de mesure »,
 *      alors que `0` reste « 0 » (zéro est un fait) ;
 *   2. LES ALERTES NE FONT UNE LIGNE QUE SI ELLES ONT QUELQUE CHOSE À DIRE, et chaque ligne mène à
 *      l'écran qui la traite ;
 *   3. LA COURBE tient dans son cadre, contient toujours l'objectif, et son abscisse suit le TEMPS
 *      (une semaine sans mesure laisse un trou) ;
 *   4. LES REVENUS restent à « — » : le paiement est hors périmètre, la carte le dit.
 */

const VIDE: AdminDashboardOverview = {
  generatedAt: '2026-10-24T12:00:00.000Z',
  alerts: {
    moderationOverdue: { count: 0 },
    proPending: { count: 0 },
    citiesToActivate: { count: 0, names: [] },
    unreadStaffAlerts: 0,
  },
  keyIndicator: { percent: null, target: 30, variationPoints: null, members: null, present: null, measuredAt: null, byCity: [], weekly: [] },
  moderation: { queue: 0, slaComplianceRate: null, resolvedSampleSize: 0 },
  mentorship: { active: 0, averageRating: null, ratingCount: 0 },
  events: { thisMonth: 0, checkedInThisMonth: 0 },
  communities: { active: 0, interest: 0 },
};

const PLEIN: AdminDashboardOverview = {
  generatedAt: '2026-10-24T12:00:00.000Z',
  alerts: {
    moderationOverdue: { count: 3 },
    proPending: { count: 5 },
    citiesToActivate: { count: 3, names: ['Nantes', 'Rennes'] },
    unreadStaffAlerts: 1,
  },
  keyIndicator: {
    percent: 27.4,
    target: 30,
    variationPoints: 2.1,
    members: 1000,
    present: 274,
    measuredAt: '2026-10-24T00:00:00.000Z',
    byCity: [
      { cityId: 'c1', name: 'Lyon', members: 400, present: 124, percent: 31 },
      { cityId: 'c2', name: 'Paris', members: 300, present: 72, percent: 24 },
      { cityId: 'c3', name: 'Marseille', members: 300, present: 57, percent: 19 },
    ],
    weekly: [
      { weekStart: '2026-10-05T00:00:00.000Z', percent: 25.1 },
      { weekStart: '2026-10-12T00:00:00.000Z', percent: 26.3 },
      { weekStart: '2026-10-19T00:00:00.000Z', percent: 27.4 },
    ],
  },
  moderation: { queue: 46, slaComplianceRate: 0.93, resolvedSampleSize: 200 },
  mentorship: { active: 148, averageRating: 4.7, ratingCount: 90 },
  events: { thisMonth: 94, checkedInThisMonth: 2310 },
  communities: { active: 72, interest: 31 },
};

describe('la charge servie respecte le schéma partagé', () => {
  it('les deux charges d’essai sont des réponses valides', () => {
    expect(adminDashboardOverviewSchema.safeParse(VIDE).success).toBe(true);
    expect(adminDashboardOverviewSchema.safeParse(PLEIN).success).toBe(true);
  });

  it('un champ de plus est REFUSÉ (strict) : un identifiant de membre ne passerait pas en silence', () => {
    expect(adminDashboardOverviewSchema.safeParse({ ...PLEIN, membres: [{ userId: 'x' }] }).success).toBe(false);
  });
});

describe('mise en forme : l’absence n’est jamais un nombre', () => {
  it('null → « — », zéro → « 0 »', () => {
    expect(entier(null)).toBe(ABSENT);
    expect(entier(0)).toBe('0');
    expect(proportion(null)).toBe(ABSENT);
    expect(proportion(0)).toBe('0 %');
    expect(pourcentage(null)).toBe(ABSENT);
    expect(note(null)).toBe(ABSENT);
  });

  it('les nombres sont dits comme la maquette les écrit', () => {
    expect(entier(2310).replace(/\s/g, ' ')).toBe('2 310');
    expect(pourcentage(27.4)).toBe('27,4 %');
    expect(proportion(0.93)).toBe('93 %');
    expect(note(4.7)).toBe('4,7 / 5');
    expect(objectif(30)).toBe('30 %');
    expect(objectif(32.5)).toBe('32,5 %');
  });

  it('l’écart est en POINTS, signé, et absent sans période de comparaison', () => {
    expect(variation(2.1)).toBe('+2,1 pts');
    expect(variation(-0.4)).toBe('−0,4 pt');
    expect(variation(0)).toBe('±0 pt');
    expect(variation(null)).toBeNull();
  });
});

describe('le bandeau d’alertes', () => {
  it('ne fait une ligne que pour une alerte à traiter, et nomme où la traiter', () => {
    expect(lignesAlertes(VIDE.alerts)).toEqual([]);
    const lignes = lignesAlertes(PLEIN.alerts);
    expect(lignes.map((l) => [l.titre, l.vers])).toEqual([
      ['SLA dépassé', '/admin/moderation'],
      ['Justificatifs pro', '/admin/services'],
      ['Villes à activer', '/admin/referentiels'],
      ['Alertes d’équipe', '/admin/alertes-equipe'],
    ]);
    expect(lignes[0]?.detail).toBe('3 dossiers de modération');
    expect(lignes[1]?.detail).toBe('5 en attente');
    // 3 villes, 2 nommées : la troisième est comptée, pas oubliée.
    expect(lignes[2]?.detail).toBe('Nantes, Rennes et 1 autre');
    expect(lignes[3]?.detail).toBe('1 non lue');
  });

  it('le singulier s’accorde', () => {
    const l = lignesAlertes({ ...VIDE.alerts, moderationOverdue: { count: 1 } });
    expect(l[0]?.detail).toBe('1 dossier de modération');
  });

  it('rend « Rien à signaler » sans alerte, et des liens vers l’écran de traitement sinon', () => {
    expect(renderToStaticMarkup(<Alertes alertes={VIDE.alerts} />)).toContain('Rien à signaler.');
    const html = renderToStaticMarkup(<Alertes alertes={PLEIN.alerts} />);
    expect(html).toContain('href="/admin/moderation"');
    expect(html).toContain('href="/admin/alertes-equipe"');
    expect(html).not.toContain('Rien à signaler');
  });
});

describe('la courbe de l’indicateur clé', () => {
  it('tient dans son cadre et contient toujours l’objectif', () => {
    const c = courbe(PLEIN.keyIndicator.weekly, 30);
    for (const pt of c.points.split(' ')) {
      const [x, y] = pt.split(',').map(Number) as [number, number];
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(600);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(120);
    }
    expect(c.yObjectif).toBeGreaterThan(0);
    expect(c.yObjectif).toBeLessThan(120);
    // Un objectif plus haut que toute mesure reste dans le cadre.
    expect(courbe([{ weekStart: '2026-10-05T00:00:00.000Z', percent: 2 }], 90).yObjectif).toBeGreaterThanOrEqual(0);
  });

  it('l’abscisse suit le TEMPS : une semaine sans mesure laisse un trou', () => {
    const c = courbe(
      [
        { weekStart: '2026-10-05T00:00:00.000Z', percent: 10 },
        { weekStart: '2026-10-12T00:00:00.000Z', percent: 10 },
        { weekStart: '2026-10-26T00:00:00.000Z', percent: 10 },
      ],
      30,
    );
    const xs = c.points.split(' ').map((p) => Number(p.split(',')[0]));
    expect(xs[0]).toBe(0);
    expect(xs[2]).toBe(600);
    // Deux semaines d'écart au lieu d'une : le troisième point est à 2/3, pas à 1/2.
    expect(xs[1]).toBeCloseTo(600 / 3, 0);
  });
});

describe('les cartes', () => {
  it('une carte sans mesure le dit ; une carte mesurée (même à zéro) ne le dit pas', () => {
    const vide = renderToStaticMarkup(<Carte titre="Guides" rangees={[{ libelle: 'Publiés', valeur: ABSENT }]} />);
    expect(vide).toContain('Pas encore de mesure');
    const zero = renderToStaticMarkup(<Carte titre="Guides" rangees={[{ libelle: 'Publiés', valeur: '0' }]} />);
    expect(zero).not.toContain('Pas encore de mesure');
  });

  it('les cartes de l’overview : SLA et note absents → « — », présents → chiffrés', () => {
    const v = cartesOverview(VIDE);
    expect(v.moderation).toEqual([{ libelle: 'File', valeur: '0' }, { libelle: 'SLA respecté', valeur: ABSENT }]);
    expect(v.parrainage[1]?.valeur).toBe(ABSENT);
    const p = cartesOverview(PLEIN);
    expect(p.moderation[1]?.valeur).toBe('93 %');
    expect(p.parrainage[1]?.valeur).toBe('4,7 / 5');
    expect(p.reseaux).toEqual([{ libelle: 'Actifs', valeur: '72' }, { libelle: 'Intérêt', valeur: '31' }]);
  });
});

describe('le tableau de bord entier', () => {
  it('base vierge : des tirets et « Pas encore de mesure », jamais un nombre d’exemple de la maquette', () => {
    const html = renderToStaticMarkup(<TableauDeBord blocs={{ ...SQUELETTE_D02, aucuneMesure: true }} overview={VIDE} />);
    expect(html).toContain('Pas encore de mesure');
    for (const exemple of ['27,4', '3 420', '2 310', '5 820', '1 212', '93 %', '4,7']) expect(html).not.toContain(exemple);
    expect(html).toContain('objectif 30 %');
    expect(html).toContain('Pas encore de mesure par ville.');
  });

  it('les REVENUS restent à « — » : le paiement est hors périmètre, la carte le dit', () => {
    const html = renderToStaticMarkup(<TableauDeBord blocs={SQUELETTE_D02} overview={PLEIN} />);
    const revenus = html.slice(html.indexOf('REVENUS'));
    expect(revenus.slice(0, revenus.indexOf('GUIDES'))).toContain('Tout est gratuit pour le moment.');
    expect(revenus.slice(0, 600)).not.toMatch(/€/);
  });

  it('charge pleine : l’indicateur, l’écart, l’objectif et les villes', () => {
    const html = renderToStaticMarkup(<IndicateurCle k={PLEIN.keyIndicator} />);
    expect(html).toContain('27,4 %');
    expect(html).toContain('+2,1 pts');
    expect(html).toContain('objectif 30 %');
    expect(html).toContain('Lyon · 31 %');
    expect(html).toContain('<polyline');
    expect(html).not.toContain('Pas encore de mesure');
  });

  it('une seule semaine mesurée : pas de courbe inventée', () => {
    const k = { ...PLEIN.keyIndicator, weekly: [{ weekStart: '2026-10-19T00:00:00.000Z', percent: 27.4 }] };
    const html = renderToStaticMarkup(<IndicateurCle k={k} />);
    expect(html).not.toContain('<polyline');
    expect(html).toContain('Une seule semaine mesurée');
  });

  it('porte les repères que admin.css replie sous 1 024 px (le tableau de bord ne déborde pas à 390 px)', () => {
    const html = renderToStaticMarkup(<TableauDeBord blocs={SQUELETTE_D02} overview={PLEIN} />);
    expect(html).toContain('data-admin-d02-haut');
    expect((html.match(/data-admin-d02-cartes/g) ?? []).length).toBe(2);
  });
});
