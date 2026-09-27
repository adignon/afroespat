import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar, Button, Chips, Pill, ProgressBar, Toggle, RoundButton } from '../primitives/primitives.js';
import { EmptyState, LevelUpPrompt, Skeleton } from '../states/states.js';
import { IconRail, MobileTabBar } from '../navigation/navigation.js';
import { ICON_NAMES, ICON_PATHS } from '../icons/paths.js';
import { VerifiedBadge } from '../icons/Icon.js';

// Les règles dures de T1 vérifiées sur les composants réels, pas sur les jetons.
describe('règles du design system', () => {
  it('les 51 icônes du design sont portées et toutes non vides', () => {
    expect(ICON_NAMES.length).toBe(51);
    for (const name of ICON_NAMES) {
      expect(ICON_PATHS[name].length).toBeGreaterThan(5);
    }
  });

  // T1 §2.3 — cible tactile 44 × 44 px minimum sur tout élément cliquable.
  it('les boutons font 44 px de haut', () => {
    const { container } = render(<Button>Publier</Button>);
    expect(container.querySelector('button')?.className).toContain('h-touch');
  });

  it('un bouton rond est carré de 44 px et porte un nom accessible', () => {
    render(<RoundButton icon="bell" label="Notifications" count={3} />);
    const btn = screen.getByRole('button', { name: 'Notifications' });
    expect(btn.className).toContain('h-touch');
    expect(btn.className).toContain('w-touch');
  });

  // T1 §2.3 — jamais d'ombre portée.
  it('aucun composant ne porte d’ombre', () => {
    const { container } = render(
      <div>
        <Pill tone="green">Ouverte</Pill>
        <Avatar initials="AD" />
        <Button>Envoyer</Button>
      </div>,
    );
    expect(container.innerHTML).not.toMatch(/shadow-(?!none)/);
  });

  // T1 §6 — une pastille d'état est toujours texte + fond, jamais couleur seule.
  it('une pastille porte toujours du texte', () => {
    render(<Pill tone="journey">En cours</Pill>);
    expect(screen.getByText('En cours')).toBeDefined();
  });

  // §1.2 — aucun rouge. Vérifié sur le HTML rendu, classes comprises.
  it('aucun composant ne rend de classe rouge ni de rouge en dur', () => {
    const { container } = render(
      <div>
        <Button variant="destructiveNeutral">Supprimer mon compte</Button>
        <ProgressBar value={58} />
        <Chips items={[{ label: 'Tous', value: 'all' }]} active="all" />
        <EmptyState title="Rien ici" actionLabel="Créer" />
      </div>,
    );
    expect(container.innerHTML).not.toMatch(/\b(?:bg|text|border)-red-/);
    expect(container.innerHTML).not.toMatch(/#(?:D9|E5|F4|FF)[0-3][0-9]{3}/i);
  });

  // §1.2 — l'action destructive existe mais n'est PAS rouge.
  it('l’action destructive est neutre', () => {
    const { container } = render(<Button variant="destructiveNeutral">Supprimer</Button>);
    const cls = container.querySelector('button')?.className ?? '';
    expect(cls).toContain('bg-control-alt');
    expect(cls).not.toContain('journey');
  });

  it('la barre de progression annonce sa valeur aux lecteurs d’écran', () => {
    render(<ProgressBar value={58} />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('58');
  });

  it('la progression est bornée à 0–100 même si on lui passe n’importe quoi', () => {
    render(<ProgressBar value={140} label="trop" />);
    expect(screen.getByRole('progressbar', { name: 'trop' }).getAttribute('aria-valuenow')).toBe('100');
  });

  it('l’interrupteur est un switch accessible', () => {
    render(<Toggle label="Résumé hebdomadaire" checked onChange={() => {}} />);
    const sw = screen.getByRole('switch', { name: 'Résumé hebdomadaire' });
    expect(sw.getAttribute('aria-checked')).toBe('true');
  });

  // §1.2 — le mot « certifié » n'apparaît nulle part. La coche dit « vérifiée ».
  it('la coche de vérification ne dit jamais « certifié »', () => {
    const { container } = render(
      <div>
        <VerifiedBadge level="L1" />
        <VerifiedBadge level="L2" />
      </div>,
    );
    expect(container.innerHTML.toLowerCase()).not.toContain('certifi');
    expect(screen.getAllByRole('img')[0]?.getAttribute('aria-label')).toContain('vérifiée');
  });

  // §7.3 — une permission manquante donne une invitation, jamais une erreur sèche.
  it('la permission insuffisante propose une action, pas un message d’erreur', () => {
    render(<LevelUpPrompt capabilityLabel="publier dans le fil" requiredLevel="L1" />);
    expect(screen.getByRole('button', { name: 'Vérifier mon identité' })).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  // T1 §5 — chargement par squelettes, jamais de roue qui tourne.
  it('le chargement est un squelette annoncé, sans spinner', () => {
    const { container } = render(<Skeleton lines={3} />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(container.innerHTML).not.toMatch(/animate-spin|spinner/i);
  });

  // §10.1 et T1 §3.1 — la navigation principale n'est jamais horizontale en haut.
  it('le rail est une navigation verticale', () => {
    const { container } = render(<IconRail active="home" />);
    const nav = container.querySelector('nav');
    expect(nav?.className).toContain('flex-col');
    expect(nav?.className).toContain('w-rail');
    expect(nav?.getAttribute('aria-label')).toBe('Navigation principale');
  });

  it('le rail marque la section active', () => {
    render(<IconRail active="help" />);
    expect(screen.getByRole('link', { current: 'page' }).textContent).toContain('Entraide');
  });

  it('la barre d’onglets mobile a exactement cinq entrées, Compte à la place d’Agenda', () => {
    const { container } = render(<MobileTabBar active="home" />);
    const links = container.querySelectorAll('a');
    expect(links.length).toBe(5);
    const labels = [...links].map((l) => l.textContent);
    expect(labels).toEqual(['Accueil', 'Parcours', 'Entraide', 'Services', 'Compte']);
  });
});
