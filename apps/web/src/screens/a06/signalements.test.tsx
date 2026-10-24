import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { A06SignalementsDesktop } from './signalementsdesktop.generated';
import { A06SignalementsMobile } from './signalementsmobile.generated';
import {
  correction,
  guide,
  panelGuides,
  rail,
  shortcuts,
  type A06Data,
} from './data';

/**
 * `/guides/:slug/signalements` RÉPONDAIT 500 — W1A, phase 0.3.
 *
 * Cause mesurée : les deux cadres « Signalements » (copies retournées de la planche
 * « Propositions reçues ») montaient `OngletsPropositions` / `ListePropositions`,
 * qui lisent un contexte que la page ne posait pas — « PropositionsRecues : hors de
 * PropositionsProvider ». À 390 px, la liste des PROPOSITIONS remplaçait en plus la
 * carte des signalements. Ces cas rendent les deux cadres SANS fournisseur, avec de
 * vrais signalements, et exigent (1) qu'ils ne lèvent pas, (2) qu'ils montrent les
 * signalements, (3) qu'ils n'aient aucun reste des onglets de propositions.
 */
const data: A06Data = {
  rail,
  panelGuides,
  shortcuts,
  guide: {
    title: 'Étudier en France',
    href: '/guides/etudier-en-france',
    misAJour: 'Mis à jour le 3 oct.',
    utiles: '4 membres ont trouvé utile',
  },
  correction,
  signalements: {
    titre: 'Signalements « a changé »',
    libelle: 'SIGNALEMENTS « A CHANGÉ »',
    compte: '2 signalements',
    aide: 'Au troisième signalement, le guide est marqué à vérifier.',
    items: [
      { dot: '#E0733A', quand: 'Il y a 3 jours', dit: 'Le formulaire a changé de nom.' },
      { dot: '#E0733A', quand: 'Il y a 5 jours', dit: 'Le délai est passé à 30 jours.' },
    ],
  },
};

describe.each([
  ['ordinateur', A06SignalementsDesktop],
  ['téléphone', A06SignalementsMobile],
])('A06 signalements — cadre %s', (_nom, Cadre) => {
  it('se rend sans fournisseur de propositions', () => {
    expect(() => renderToStaticMarkup(<Cadre {...data} />)).not.toThrow();
  });

  it('montre les signalements, pas des propositions', () => {
    const html = renderToStaticMarkup(<Cadre {...data} />);
    expect(html).toContain('Le formulaire a changé de nom.');
    expect(html).toContain('Le délai est passé à 30 jours.');
    expect(html).toContain('2 signalements');
    expect(html).not.toContain('data-onglets-propositions');
    expect(html).not.toContain('Fatou Ndiaye');
  });

  it('garde le titre du guide dans le retour', () => {
    const html = renderToStaticMarkup(<Cadre {...data} guide={guide} />);
    expect(html).toContain('data-a06-retour');
  });
});
