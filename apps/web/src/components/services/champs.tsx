'use client';

import type { CSSProperties, ReactNode } from 'react';

/**
 * AJOUT — les pièces des formulaires du module Services (S03, S05, S08, S10).
 *
 * Les maquettes `06 Services` dessinent leurs champs en `<div>` d'exemple (« Studio
 * meublé Lyon 7e », « 620 € ») : on n'y saisit rien. Les formulaires qui en font des
 * contrôles (`champs-annonce.tsx`, `champs-offre.tsx`, `champs-fiche-pro.tsx`,
 * `champs-alerte.tsx`) partagent ces pièces, et chacune est RELEVÉE sur le dessin :
 *
 *   · étiquette : 12,5 px / 700, 6 px de marge basse ;
 *   · champ : 48 px au moins, rayon 14, liseré `1px solid #E6EBE9` (`#16785E` en
 *     1,5 px pour le champ actif), retrait `13px 14px`, 14 px / 1,5 ;
 *   · pastille de choix : retrait `8px 13px`, rayon 999, 12,5 px / 700 — vert plein
 *     `#16785E` quand elle est retenue, blanche au liseré `#E6EBE9` sinon ;
 *   · interrupteur : 46 × 26, pastille de 20 px, `#16785E` allumé, `#CBD5D1` éteint.
 *
 * Aucune couleur nouvelle, aucun rouge : un refus s'écrit en terre cuite `#B4581F`,
 * comme partout dans le dépôt.
 */
export const ETIQUETTE: CSSProperties = { fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' };

export const CHAMP: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: '48px',
  borderRadius: '14px',
  border: '1px solid #E6EBE9',
  background: '#fff',
  padding: '13px 14px',
  fontSize: '14px',
  lineHeight: 1.5,
  font: 'inherit',
  color: '#16211D',
  outline: 'none',
};

export function Bloc({ libelle, children }: { readonly libelle: string; readonly children: ReactNode }) {
  return (
    <div style={{ flexShrink: 0 }}>
      <div style={ETIQUETTE}>{libelle}</div>
      {children}
    </div>
  );
}

export function Pastilles<T extends string>({
  valeurs,
  valeur,
  onChoisir,
  libelle,
}: {
  readonly valeurs: readonly { readonly valeur: T; readonly libelle: string }[];
  readonly valeur: T;
  readonly onChoisir: (v: T) => void;
  readonly libelle: string;
}) {
  return (
    <div role="group" aria-label={libelle} style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', flexShrink: 0 }}>
      {valeurs.map((v) => {
        const on = v.valeur === valeur;
        return (
          <button
            key={v.valeur}
            type="button"
            aria-pressed={on}
            onClick={() => {
              onChoisir(v.valeur);
            }}
            style={{
              padding: '8px 13px',
              borderRadius: '999px',
              fontSize: '12.5px',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              background: on ? '#16785E' : '#fff',
              color: on ? '#fff' : '#16211D',
              border: `1px solid ${on ? '#16785E' : '#E6EBE9'}`,
              font: 'inherit',
              cursor: 'pointer',
            }}
          >
            {v.libelle}
          </button>
        );
      })}
    </div>
  );
}

export function Interrupteur({
  libelle,
  allume,
  onBascule,
}: {
  readonly libelle: string;
  readonly allume: boolean;
  readonly onBascule: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0' }}>
      <div style={{ flex: 1, fontSize: '13.5px', fontWeight: 700 }}>{libelle}</div>
      <button
        type="button"
        role="switch"
        aria-checked={allume}
        aria-label={libelle}
        onClick={onBascule}
        style={{
          width: '46px',
          height: '26px',
          borderRadius: '999px',
          backgroundColor: allume ? '#16785E' : '#CBD5D1',
          position: 'relative',
          flexShrink: 0,
          border: 'none',
          padding: 0,
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: '3px',
            left: allume ? '23px' : '3px',
            width: '20px',
            height: '20px',
            borderRadius: '999px',
            background: '#fff',
          }}
        />
      </button>
    </div>
  );
}

export function Refus({ texte }: { readonly texte: string }) {
  if (texte === '') return null;
  return (
    <p role="alert" data-formulaire-echec="" style={{ margin: 0, fontSize: '12.5px', fontWeight: 700, color: '#B4581F' }}>
      {texte}
    </p>
  );
}

/** Un encart d'état — terre cuite clair, comme la carte « APRÈS ENVOI » de S03. */
export function Encart({ titre, children }: { readonly titre: string; readonly children: ReactNode }) {
  return (
    <div style={{ background: '#FBE3D4', borderRadius: '18px', padding: '14px 16px', color: '#B4581F', flexShrink: 0 }}>
      <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '1px' }}>{titre}</div>
      <div style={{ fontSize: '13px', lineHeight: 1.5, fontWeight: 600, marginTop: '6px' }}>{children}</div>
    </div>
  );
}
