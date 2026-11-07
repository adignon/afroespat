import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Fenetre } from './ui';

/**
 * Le piège du focus des fenêtres de l'administration : le focus ENTRE dans la fenêtre, Tab et Maj+Tab y restent,
 * Échap la ferme (sauf pendant un envoi), le focus REVIENT à l'élément qui l'avait, le reste de la page est inerte.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Page({ occupe = false }: { readonly occupe?: boolean }) {
  const [ouverte, setOuverte] = useState(false);
  return (
    <div data-admin="">
      <button id="avant">Avant</button>
      <button id="ouvrir" onClick={() => setOuverte(true)}>
        Ouvrir
      </button>
      <Fenetre ouverte={ouverte} titre="Une fenêtre" onFermer={() => setOuverte(false)} occupe={occupe}>
        <input id="champ" aria-label="Champ" />
        <button id="valider">Valider</button>
      </Fenetre>
    </div>
  );
}

let conteneur: HTMLDivElement;
let racine: Root;

const touche = (key: string, shiftKey = false) =>
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }));
  });
const el = (id: string) => document.getElementById(id) as HTMLElement;

function monter(occupe = false) {
  act(() => {
    racine.render(<Page occupe={occupe} />);
  });
  el('ouvrir').focus();
  act(() => {
    el('ouvrir').click();
  });
}

beforeEach(() => {
  conteneur = document.createElement('div');
  document.body.appendChild(conteneur);
  racine = createRoot(conteneur);
});
afterEach(() => {
  act(() => racine.unmount());
  conteneur.remove();
  document.body.style.overflow = '';
});

describe('Fenetre — focus trap', () => {
  it('place le focus dans la fenêtre à l’ouverture (premier champ) et rend le reste inerte', () => {
    monter();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.activeElement).toBe(el('champ'));
    expect(el('avant').closest('[inert]') ?? el('avant').hasAttribute('inert')).toBeTruthy();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('Tab boucle du dernier élément au premier, Maj+Tab du premier au dernier', () => {
    monter();
    const panneau = document.querySelector('[role="dialog"]') as HTMLElement;
    const focalisables = Array.from(panneau.querySelectorAll<HTMLElement>('button:not([disabled]), input, [href], select, textarea'));
    const premier = focalisables[0] as HTMLElement;
    const dernier = focalisables[focalisables.length - 1] as HTMLElement;
    dernier.focus();
    touche('Tab');
    expect(document.activeElement).toBe(premier);
    premier.focus();
    touche('Tab', true);
    expect(document.activeElement).toBe(dernier);
  });

  it('Échap ferme la fenêtre et le focus revient au bouton qui l’avait ouverte', () => {
    monter();
    touche('Escape');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(el('ouvrir'));
    expect(document.body.style.overflow).toBe('');
    expect(el('avant').hasAttribute('inert')).toBe(false);
  });

  it('pendant un envoi, Échap ne ferme pas', () => {
    monter(true);
    touche('Escape');
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });
});
