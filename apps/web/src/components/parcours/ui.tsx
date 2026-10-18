'use client';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT HORS MAQUETTE — LES PRIMITIVES VISUELLES DU MODULE PARCOURS           ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La maquette `04 Parcours` dessine chaque écran en image : ni champ, ni état de
 * chargement, ni état d'erreur. Les composants de ce dossier (`vue-*.tsx`,
 * `feuille-*.tsx`) donnent à ces écrans de VRAIS contrôles, dans le langage visuel
 * exact des planches voisines. Aucune couleur n'est inventée : chaque teinte ci-dessous
 * est relevée dans `tools/screens/04-parcours.mjs` et dans les `.generated.tsx` de
 * J01, J02, J05 et J08 ; aucun rouge (règle du dépôt : « aucun état d'échec »).
 *
 * Relevés (ordinateur ET mobile, identiques sauf mention) :
 *   · carte        fond #fff, bord 1px #E6EBE9, rayon 22, retrait 14 à 24 ;
 *   · étiquette    10,5 px, 700, interlettrage 1px, #8A958F ;
 *   · bouton       hauteur 42 (ordinateur) / 48 (mobile), rayon 12 / 14, #16785E ;
 *   · bouton calme fond #F2F5F4, texte #16211D ;
 *   · bouton fort  fond #E0733A (« Je suis bloqué·e ») ;
 *   · champ        hauteur mini 48, rayon 14, bord 1px #E6EBE9, 1,5px #16785E au focus ;
 *   · pastille     rayon 999, 11 px, 700, retrait 4/10.
 */

import { useState, type CSSProperties, type ReactNode } from 'react';

export const C = {
  vert: '#16785E',
  vertFonce: '#0F5C48',
  orange: '#E0733A',
  texte: '#16211D',
  gris: '#5D6B66',
  grisClair: '#8A958F',
  bord: '#E6EBE9',
  fond: '#F2F5F4',
  barre: '#EEF2F0',
  vertPale: '#EFF7F3',
  vertPale2: '#E3F0EB',
  orangePale: '#F0C3A4',
  jalon: '#CBD5D1',
} as const;

export const carte = (padding = 20): CSSProperties => ({
  background: '#fff',
  border: `1px solid ${C.bord}`,
  borderRadius: '22px',
  padding: `${padding}px`,
});

export const etiquette: CSSProperties = {
  fontSize: '10.5px',
  fontWeight: 700,
  letterSpacing: '1px',
  color: C.grisClair,
};

export function Etiquette({ children }: { readonly children: ReactNode }) {
  return <div style={etiquette}>{children}</div>;
}

const BASE_BOUTON: CSSProperties = {
  border: 'none',
  font: 'inherit',
  fontSize: '13.5px',
  fontWeight: 700,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  cursor: 'pointer',
  flexShrink: 0,
};

type Ton = 'principal' | 'calme' | 'fort' | 'contour';

export function Bouton({
  children,
  onClick,
  ton = 'principal',
  disabled = false,
  compact = false,
  plein = false,
  type = 'button',
  label,
}: {
  readonly children: ReactNode;
  readonly onClick?: () => void;
  readonly ton?: Ton;
  readonly disabled?: boolean;
  readonly compact?: boolean;
  readonly plein?: boolean;
  readonly type?: 'button' | 'submit';
  readonly label?: string;
}) {
  const fond =
    ton === 'principal' ? C.vert : ton === 'fort' ? C.orange : ton === 'calme' ? C.fond : '#fff';
  const texte = ton === 'calme' || ton === 'contour' ? C.texte : '#fff';
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        ...BASE_BOUTON,
        height: compact ? '42px' : '48px',
        padding: '0 18px',
        borderRadius: compact ? '12px' : '14px',
        background: disabled ? C.grisClair : fond,
        color: texte,
        border: ton === 'contour' ? `1.5px solid ${C.bord}` : 'none',
        cursor: disabled ? 'default' : 'pointer',
        ...(plein ? { width: '100%' } : {}),
      }}
    >
      {children}
    </button>
  );
}

export function Pastille({
  children,
  fond = C.vertPale2,
  texte = C.vert,
}: {
  readonly children: ReactNode;
  readonly fond?: string;
  readonly texte?: string;
}) {
  return (
    <span
      style={{
        background: fond,
        color: texte,
        fontSize: '11px',
        fontWeight: 700,
        padding: '4px 10px',
        borderRadius: '999px',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

const STYLE_CHAMP: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: '48px',
  borderRadius: '14px',
  background: '#fff',
  padding: '13px 14px',
  fontSize: '14px',
  font: 'inherit',
  color: C.texte,
  outline: 'none',
};

export function Champ({
  etiquette: libelle,
  valeur,
  onChange,
  type = 'text',
  placeholder,
  maxLength,
  aide,
  id,
  min,
}: {
  readonly etiquette: string;
  readonly valeur: string;
  readonly onChange: (valeur: string) => void;
  readonly type?: 'text' | 'date';
  readonly placeholder?: string;
  readonly maxLength?: number;
  readonly aide?: string;
  readonly id: string;
  readonly min?: string;
}) {
  const [focus, setFocus] = useState(false);
  return (
    <div style={{ flexShrink: 0 }}>
      <label htmlFor={id} style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' }}>
        {libelle}
      </label>
      <input
        id={id}
        type={type}
        value={valeur}
        min={min}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          ...STYLE_CHAMP,
          fontSize: '14px',
          border: focus ? `1.5px solid ${C.vert}` : `1px solid ${C.bord}`,
        }}
      />
      {aide === undefined ? null : (
        <div style={{ fontSize: '12px', color: C.gris, marginTop: '6px', lineHeight: 1.5 }}>{aide}</div>
      )}
    </div>
  );
}

export function ZoneTexte({
  etiquette: libelle,
  valeur,
  onChange,
  placeholder,
  maxLength,
  lignes = 4,
  id,
  aide,
}: {
  readonly etiquette: string;
  readonly valeur: string;
  readonly onChange: (valeur: string) => void;
  readonly placeholder?: string;
  readonly maxLength?: number;
  readonly lignes?: number;
  readonly id: string;
  readonly aide?: string;
}) {
  const [focus, setFocus] = useState(false);
  return (
    <div style={{ flexShrink: 0 }}>
      <label htmlFor={id} style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' }}>
        {libelle}
      </label>
      <textarea
        id={id}
        value={valeur}
        rows={lignes}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          ...STYLE_CHAMP,
          resize: 'vertical',
          lineHeight: 1.55,
          border: focus ? `1.5px solid ${C.vert}` : `1px solid ${C.bord}`,
        }}
      />
      {aide === undefined ? null : (
        <div style={{ fontSize: '12px', color: C.gris, marginTop: '6px', lineHeight: 1.5 }}>{aide}</div>
      )}
    </div>
  );
}

/** Une case à cocher ronde-carrée de J06 : 22 px, rayon 7, verte et cochée, ou bordée. */
export function Case({
  cochee,
  onBascule,
  label,
}: {
  readonly cochee: boolean;
  readonly onBascule: () => void;
  readonly label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={cochee}
      aria-label={label}
      onClick={onBascule}
      style={{
        width: '22px',
        height: '22px',
        borderRadius: '7px',
        background: cochee ? C.vert : '#fff',
        border: cochee ? 'none' : `1.5px solid ${C.jalon}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      {cochee ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m5 12 4.5 4.5L19 7" />
        </svg>
      ) : null}
    </button>
  );
}

/** Un message sous un geste : jamais rouge — la maquette n'en dessine aucun. */
export function Avis({
  texte,
  ton = 'info',
}: {
  readonly texte: string | null;
  readonly ton?: 'info' | 'erreur';
}) {
  if (texte === null) return null;
  return (
    <div
      role={ton === 'erreur' ? 'alert' : 'status'}
      style={{
        background: ton === 'erreur' ? '#FDF1EA' : C.vertPale,
        border: `1px solid ${ton === 'erreur' ? C.orangePale : C.vertPale2}`,
        color: C.texte,
        borderRadius: '14px',
        padding: '10px 14px',
        fontSize: '13px',
        lineHeight: 1.5,
      }}
    >
      {texte}
    </div>
  );
}

export function Attente({ texte = 'Chargement…' }: { readonly texte?: string }) {
  return (
    <div role="status" style={{ ...carte(24), color: C.gris, fontSize: '14px' }}>
      {texte}
    </div>
  );
}

export function Icone({ d, taille = 17, couleur = 'currentColor' }: { readonly d: string; readonly taille?: number; readonly couleur?: string }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke={couleur} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export const ICONES = {
  plus: 'M12 5v14M5 12h14',
  coche: 'm5 12 4.5 4.5L19 7',
  croix: 'M18 6 6 18M6 6l12 12',
  discussion: 'M4 5h16v11H9l-5 4z',
  equipe: 'M9 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 11a2.5 2.5 0 1 0 0-5M16 20h5a5 5 0 0 0-4-5',
  poubelle: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  drapeau: 'M5 21V4h12l-2 4 2 4H5',
  calendrier: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  crayon: 'M4 20h4L19 9l-4-4L4 16z',
  parcours: 'M5 5h6a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h10',
  fleche: 'm9 6 6 6-6 6',
  haut: 'm6 15 6-6 6 6',
  bas: 'm6 9 6 6 6-6',
} as const;
