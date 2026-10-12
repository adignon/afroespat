'use client';

import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { useEffect, useState } from 'react';

/**
 * LE ROND « ··· » D'UN EN-TÊTE DE 390 PX, DEVENU UN MENU.
 *
 * Sur la planche mobile d'un sujet (A09), le rond du coin haut droit est le seul
 * accès aux gestes que l'ordinateur range dans sa carte « MODÉRATION » — la
 * maquette ne dessine pas cette carte à 390 px. Le rond garde son dessin (il est
 * passé en `rondStyle` et en enfant), et ouvre la liste des mêmes entrées.
 *
 * Le menu est `fixed`, ancré sous le rond au clic, pour la raison mesurée sur
 * `ActionsReseau` : un en-tête `overflow: hidden` coupe un menu `absolute`. Sans
 * entrée, le rond est rendu tel quel, inerte — c'est le lecteur qui n'a aucun
 * geste à faire ici, pas un bouton cassé.
 */
export function MenuRond({
  entrees,
  rondStyle,
  libelle,
  children,
}: {
  readonly entrees: readonly {
    readonly label: string;
    readonly onClick?: (() => void) | undefined;
  }[];
  readonly rondStyle: CSSProperties;
  readonly libelle: string;
  readonly children: ReactNode;
}) {
  const [ancre, setAncre] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    if (ancre === null) return;
    const fermer = (): void => {
      setAncre(null);
    };
    const surTouche = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setAncre(null);
    };
    window.addEventListener('scroll', fermer, { passive: true });
    window.addEventListener('keydown', surTouche);
    return () => {
      window.removeEventListener('scroll', fermer);
      window.removeEventListener('keydown', surTouche);
    };
  }, [ancre]);

  if (entrees.length === 0) return <span style={rondStyle}>{children}</span>;

  const basculer = (e: MouseEvent<HTMLButtonElement>): void => {
    if (ancre !== null) {
      setAncre(null);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    setAncre({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
  };

  return (
    <>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={ancre !== null}
        aria-label={libelle}
        onClick={basculer}
        style={{ ...rondStyle, border: 'none', padding: 0, font: 'inherit', cursor: 'pointer' }}
      >
        {children}
      </button>
      {ancre === null ? null : (
        <>
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => {
              setAncre(null);
            }}
            style={{
              position: 'fixed',
              inset: '0',
              zIndex: 39,
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'default',
            }}
          />
          {/* Le menu de rôle de l'onglet « Membres » : 240 px, rayon 18, entrées de 42 px. */}
          <div
            role="menu"
            style={{
              position: 'fixed',
              zIndex: 40,
              top: `${String(ancre.top)}px`,
              right: `${String(ancre.right)}px`,
              width: '240px',
              background: '#fff',
              border: '1px solid #E6EBE9',
              borderRadius: '18px',
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}
          >
            {entrees.map((e) => (
              <button
                key={e.label}
                type="button"
                role="menuitem"
                disabled={e.onClick === undefined}
                onClick={() => {
                  setAncre(null);
                  e.onClick?.();
                }}
                style={{
                  height: '42px',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 12px',
                  borderRadius: '12px',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  color: e.onClick === undefined ? '#8A958F' : '#16211D',
                  cursor: e.onClick === undefined ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                  border: 'none',
                  width: '100%',
                  background: 'none',
                  textAlign: 'left',
                }}
              >
                {e.label}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
