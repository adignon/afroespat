'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Modal } from '@/components/modal';
import { PanneauFenetre } from '@/components/panneau-fenetre';

/**
 * AJOUT — les pièces de formulaire de l'entraide et du parrainage.
 *
 * RIEN N'EST INVENTÉ : chaque valeur est relevée sur le cadre H03 de la maquette
 * (`05 Entraide`) — champ de 48 px, rayon 14, trait `1px solid #E6EBE9` (vert
 * `#16785E` à 1,5 px au focus), libellé 12,5 px / 700, pastille de type 12,5 px,
 * bouton plein 13,5 px / 700 au rayon 14. Aucune couleur nouvelle, aucun rouge :
 * une erreur s'écrit en terre cuite `#B4581F` sur `#FDF0E7`, comme le bandeau de
 * règle de la même planche.
 */

export const LIBELLE: CSSProperties = { fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' };

export const CHAMP: CSSProperties = {
  minHeight: '48px',
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: '14px',
  border: '1px solid #E6EBE9',
  background: '#fff',
  padding: '13px 14px',
  fontSize: '14px',
  lineHeight: 1.5,
  fontFamily: 'inherit',
  color: '#16211D',
  outline: 'none',
};

export const BOUTON_PLEIN: CSSProperties = {
  height: '44px',
  padding: '0 18px',
  borderRadius: '14px',
  background: '#16785E',
  color: '#fff',
  border: 'none',
  font: 'inherit',
  fontSize: '13.5px',
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  whiteSpace: 'nowrap',
  flexShrink: 0,
  cursor: 'pointer',
};

export const BOUTON_DISCRET: CSSProperties = {
  ...BOUTON_PLEIN,
  background: '#F2F5F4',
  color: '#16211D',
};

export const BOUTON_ECLAT: CSSProperties = {
  ...BOUTON_PLEIN,
  background: '#fff',
  color: '#0F5C48',
  border: '1.5px solid #CFE3DA',
};

/** Un bouton éteint garde sa forme : seule sa teinte et son curseur changent. */
export function eteint(style: CSSProperties, eteintOui: boolean): CSSProperties {
  return eteintOui ? { ...style, opacity: 0.55, cursor: 'default' } : style;
}

export function Pastille({
  actif,
  children,
  onClick,
  eteinte = false,
}: {
  readonly actif: boolean;
  readonly children: ReactNode;
  readonly onClick: () => void;
  readonly eteinte?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={eteinte}
      aria-pressed={actif}
      style={{
        padding: '8px 13px',
        borderRadius: '999px',
        fontSize: '12.5px',
        fontWeight: 700,
        whiteSpace: 'nowrap',
        font: 'inherit',
        cursor: eteinte ? 'default' : 'pointer',
        background: actif ? '#16785E' : '#fff',
        color: actif ? '#fff' : '#16211D',
        border: `1px solid ${actif ? '#16785E' : '#E6EBE9'}`,
      }}
    >
      {children}
    </button>
  );
}

/** Le bascule à deux positions de la maquette (« Demande » / « Offre »). */
export function Segments<T extends string>({
  valeur,
  options,
  onChoisir,
}: {
  readonly valeur: T;
  readonly options: readonly { readonly cle: T; readonly libelle: string }[];
  readonly onChoisir: (cle: T) => void;
}) {
  return (
    <div
      role="group"
      style={{
        display: 'flex',
        gap: '4px',
        background: '#EEF2F0',
        borderRadius: '14px',
        padding: '4px',
        flexShrink: 0,
        alignSelf: 'flex-start',
      }}
    >
      {options.map((o) => (
        <button
          key={o.cle}
          type="button"
          aria-pressed={valeur === o.cle}
          onClick={() => {
            onChoisir(o.cle);
          }}
          style={{
            padding: '9px 16px',
            borderRadius: '11px',
            fontSize: '13px',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            border: 'none',
            font: 'inherit',
            cursor: 'pointer',
            background: valeur === o.cle ? '#fff' : 'transparent',
            color: valeur === o.cle ? '#16211D' : '#5D6B66',
          }}
        >
          {o.libelle}
        </button>
      ))}
    </div>
  );
}

export function Alerte({ children }: { readonly children: ReactNode }) {
  return (
    <div
      role="alert"
      style={{
        background: '#FDF0E7',
        borderRadius: '14px',
        padding: '12px 14px',
        fontSize: '12.5px',
        color: '#B4581F',
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}

/** Le compteur « 12 / 120 » sous un champ borné. */
export function Compteur({ n, min, max }: { readonly n: number; readonly min: number; readonly max: number }) {
  return (
    <div
      style={{
        fontSize: '11.5px',
        color: n > max ? '#B4581F' : n < min ? '#8A958F' : '#0F5C48',
        marginTop: '4px',
        textAlign: 'right',
      }}
    >
      {n} / {max}
    </div>
  );
}

/**
 * Une feuille de saisie : fenêtre centrée à 1440 px, feuille du bas à 390 px — les
 * deux formes que `PanneauFenetre` dessine déjà pour les autres fenêtres du dépôt.
 * `nom` désigne la planche pour les épreuves ; `titreId` est dérivé de lui.
 */
export function Feuille({
  ouverte,
  onFermer,
  nom,
  titre,
  actions,
  children,
}: {
  readonly ouverte: boolean;
  readonly onFermer: () => void;
  readonly nom: string;
  readonly titre: string;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
}) {
  const titreId = `${nom.toLowerCase()}-titre`;
  const panneau = (mobile: boolean) => (
    <PanneauFenetre titreId={titreId} titre={titre} feuille={mobile} largeur="480px" actions={actions}>
      {children}
    </PanneauFenetre>
  );
  return (
    <Modal
      open={ouverte}
      onClose={onFermer}
      titleId={titreId}
      name={nom}
      desktop={panneau(false)}
      mobile={panneau(true)}
    />
  );
}

export function initiales(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter((m) => m !== '');
  if (mots.length === 0) return '?';
  return mots.slice(0, 2).map((m) => [...m][0] ?? '').join('').toUpperCase();
}

/**
 * Les trois états d'une liste qui se charge elle-même : attente, échec avec
 * « Réessayer », vide. Une liste vide n'est JAMAIS affichée pendant le chargement
 * (« Aucune demande » avant la réponse serait faux), ni après une panne.
 */
export function EtatListe({
  etat,
  vide,
  onReessayer,
}: {
  readonly etat: 'attente' | 'echec' | 'vide';
  readonly vide: ReactNode;
  readonly onReessayer: () => void;
}) {
  const boite: CSSProperties = {
    background: '#fff',
    border: '1px solid #E6EBE9',
    borderRadius: '22px',
    padding: '24px',
    textAlign: 'center',
    fontSize: '13.5px',
    color: '#5D6B66',
    flexShrink: 0,
  };
  if (etat === 'attente') {
    return (
      <div style={boite} role="status">
        Chargement…
      </div>
    );
  }
  if (etat === 'echec') {
    return (
      <div style={boite} role="alert">
        <div>La liste n’a pas pu être chargée.</div>
        <button type="button" onClick={onReessayer} style={{ ...BOUTON_DISCRET, margin: '12px auto 0' }}>
          Réessayer
        </button>
      </div>
    );
  }
  return <div style={boite}>{vide}</div>;
}
