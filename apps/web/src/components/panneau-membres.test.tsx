import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MembreAdminRowView } from '@/screens/a08t/data';

vi.mock('@/screens/reseaux/api', () => ({
  fetchProfilMembre: vi.fn(() =>
    Promise.resolve({
      userId: null,
      handle: 'aicha-d',
      displayName: 'Aïcha Diop',
      avatarUrl: null,
      phase: 'SETTLED',
      verificationLevel: 'L1',
      country: { iso2: 'BJ', nameFr: 'Bénin' },
      city: { id: 'c1', name: 'Lyon' },
      languages: [{ code: 'fr', nameFr: 'Français' }],
      skills: [{ id: 's1', nameFr: 'Infirmière' }],
      bio: 'Arrivée en 2019.',
      occupationStatus: 'EMPLOYEE',
      availableToHelp: true,
      helpTypes: ['PAPERWORK'],
      memberSince: '2024-01-01T00:00:00.000Z',
      stats: null,
      relation: null,
    }),
  ),
}));

import { PanneauMembres } from './panneau-membres';

/**
 * L'onglet « Membres » : la liste, l'aperçu du membre choisi, « Retour » et Échap.
 *
 * Le panneau est posé par l'adaptation `RV_MEMBRES_PANNEAU` autour de la liste dessinée ; ici la liste est un
 * simple bouton, et l'état du choix (`?membre=`) est tenu par un harnais — dans l'écran il vit dans l'URL.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LIGNE: MembreAdminRowView = {
  userId: 'u1',
  handle: 'aicha-d',
  i: 'AD',
  bg: '#16785E',
  name: 'Aïcha Diop',
  sub: 'Installé·e · Lyon',
  roleNom: 'Modérateur',
  roleBg: '#E3F0EB',
  roleFg: '#0F5C48',
  nommable: false,
  revocable: true,
};

function Harnais({
  onEcrire = () => undefined,
  initial = null,
}: {
  readonly onEcrire?: (id: string) => void;
  readonly initial?: string | null;
}) {
  const [handle, setHandle] = useState<string | null>(initial);
  return (
    <PanneauMembres
      variante="ordinateur"
      choix={{ handle, onOuvrir: setHandle, onRetour: () => setHandle(null) }}
      membres={[LIGNE]}
      occupe={false}
      onEcrire={onEcrire}
      liste={
        <button data-membre-ligne="aicha-d" onClick={() => setHandle('aicha-d')}>
          Aïcha Diop
        </button>
      }
    />
  );
}

let conteneur: HTMLDivElement;
let racine: Root;

const vue = () => conteneur.querySelector('[data-membres-panneau]')?.getAttribute('data-vue');
const touche = (key: string) =>
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  });
const attendre = () => act(async () => { await Promise.resolve(); });

beforeEach(() => {
  // jsdom n'a pas `matchMedia` : un écran d'ordinateur.
  window.matchMedia = ((q: string) => ({
    matches: q.includes('min-width'),
    media: q,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
  conteneur = document.createElement('div');
  document.body.appendChild(conteneur);
  racine = createRoot(conteneur);
});
afterEach(() => {
  act(() => racine.unmount());
  conteneur.remove();
});

describe('PanneauMembres', () => {
  it('montre la liste, puis l’aperçu du membre cliqué avec son profil', async () => {
    act(() => racine.render(<Harnais />));
    expect(vue()).toBe('liste');
    act(() => conteneur.querySelector<HTMLElement>('[data-membre-ligne]')?.click());
    await attendre();
    expect(vue()).toBe('profil');
    const texte = conteneur.textContent ?? '';
    expect(texte).toContain('Aïcha Diop');
    expect(texte).toContain('Identité vérifiée');
    expect(texte).toContain('Modérateur');
    expect(texte).toContain('Lyon · Bénin');
    expect(texte).toContain('Infirmière');
    expect(texte).toContain('Français');
    expect(texte).toContain('Disponible pour aider : Démarches');
    expect(conteneur.querySelector('[data-membre-apercu-profil]')?.getAttribute('href')).toBe('/@aicha-d');
  });

  it('« Retour » ramène la liste et rend le focus à la ligne cliquée', async () => {
    act(() => racine.render(<Harnais />));
    const ligne = conteneur.querySelector<HTMLElement>('[data-membre-ligne]');
    act(() => ligne?.click());
    await attendre();
    // Le focus est passé sur « Retour » à l'ouverture.
    expect(document.activeElement?.hasAttribute('data-membres-retour')).toBe(true);
    act(() => conteneur.querySelector<HTMLElement>('[data-membres-retour]')?.click());
    expect(vue()).toBe('liste');
    expect(document.activeElement?.getAttribute('data-membre-ligne')).toBe('aicha-d');
    // La liste revient en glissant (le mouvement est dans `globals.css`).
    expect(conteneur.querySelector('[data-membres-vue="liste"]')?.hasAttribute('data-membres-retour-anime')).toBe(true);
  });

  it('Échap est « Retour », sauf si une fenêtre est ouverte par-dessus', async () => {
    act(() => racine.render(<Harnais initial="aicha-d" />));
    await attendre();
    expect(vue()).toBe('profil');
    const fenetre = document.createElement('div');
    fenetre.setAttribute('role', 'dialog');
    document.body.appendChild(fenetre);
    touche('Escape');
    expect(vue()).toBe('profil');
    fenetre.remove();
    touche('Escape');
    expect(vue()).toBe('liste');
  });

  it('la liste ne glisse pas au premier affichage', () => {
    act(() => racine.render(<Harnais />));
    expect(conteneur.querySelector('[data-membres-vue="liste"]')?.hasAttribute('data-membres-retour-anime')).toBe(false);
  });

  it('« Écrire » passe par le geste existant avec l’identifiant du membre', async () => {
    const onEcrire = vi.fn();
    act(() => racine.render(<Harnais initial="aicha-d" onEcrire={onEcrire} />));
    await attendre();
    act(() => conteneur.querySelector<HTMLElement>('[data-membre-apercu-ecrire]')?.click());
    expect(onEcrire).toHaveBeenCalledWith('u1');
  });
});
