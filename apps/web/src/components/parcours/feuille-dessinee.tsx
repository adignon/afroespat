'use client';

/**
 * AJOUT HORS MAQUETTE — LE TROUSSEAU DES FEUILLES DESSINÉES (J03, J04, J05, J07, J08, J01M).
 *
 * ── POURQUOI CE FICHIER ─────────────────────────────────────────────────────
 *
 * Les feuilles du module Parcours étaient rendues par `feuilles.tsx`, écrit à la main :
 * un panneau centré de 440 px sur les deux largeurs, qui ne ressemblait pas aux planches
 * de la maquette (un décompte « 1 · 2 · 3 », des cartes de portée à pastille, un aperçu
 * en carte terre cuite, une carte « étape franchie »…). Le porteur : « Monte les dessins
 * de la maquette et rends-les dynamiques. »
 *
 * Les planches transcodées (`screens/j03/*.generated.tsx`, `j04`, `j05invitation`,
 * `j07export`, `j08arret`, `j01mfeuille`) sont donc MONTÉES, et c'est leur dessin qui
 * s'affiche. Ce qu'une image ne peut pas contenir — le texte saisi, la liste de contacts
 * réelle, le titre du parcours, les gestes — est branché par l'adaptation
 * `tools/adaptations/feuilles-dessinees.mjs`, qui remplace UN NŒUD DESSINÉ à la fois par
 * l'une des quatre pièces ci-dessous. La pièce reprend le `style` du nœud qu'elle remplace
 * (relevé sur CHAQUE cadre, ordinateur et mobile — piège n° 1 du mémo) : aucune mesure
 * n'est écrite ici.
 *
 *   · `FVal`   un texte dynamique (même balise, même style que le nœud dessiné) ;
 *   · `FAct`   un bouton qui fait quelque chose (même style, désactivable) ;
 *   · `FLien`  un lien (même style) ; ferme la feuille au clic ;
 *   · `FSlot`  une région vivante (champ de saisie, liste de contacts, cartes de portée…) dont
 *              le contrôleur reçoit les styles du dessin, dans l'ordre du document.
 *
 * Un CONTRÔLEUR (`Controleur`) est fourni par chaque feuille (voir `feuilles.tsx`) : il tient
 * l'état et les appels serveur. Le front prévient, le serveur décide.
 */

import { createContext, useContext, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import type { ParcoursData } from '@/screens/parcours/data';

export type Styles = readonly CSSProperties[];

export interface ActionFeuille {
  readonly onClick?: () => void;
  readonly href?: string;
  readonly disabled?: boolean;
  /** Remplace le libellé dessiné (« Exporter » à la place de « Découvrir Premium »). */
  readonly libelle?: string;
}

export interface Controleur {
  /** Le texte d'une valeur ; `null` = rien à montrer, le nœud disparaît. */
  readonly val: (cle: string) => string | null;
  readonly act: (cle: string) => ActionFeuille;
  readonly slot: (cle: string, styles: Styles) => ReactNode;
  /** Ferme la feuille (clic sur un lien qui change de page). */
  readonly fermer: () => void;
}

const Contexte = createContext<Controleur | null>(null);

export function FeuilleDessinee({
  controleur,
  children,
}: {
  readonly controleur: Controleur;
  readonly children: ReactNode;
}) {
  return <Contexte.Provider value={controleur}>{children}</Contexte.Provider>;
}

function useControleur(): Controleur {
  const c = useContext(Contexte);
  if (c === null) throw new Error('Une pièce de feuille dessinée est montée hors de <FeuilleDessinee>.');
  return c;
}

/**
 * Les cadres générés reçoivent un `ParcoursData` dont ils ne lisent plus rien : toutes leurs
 * valeurs et leurs gestes viennent du contrôleur. Le cast est donc sans effet, et il est
 * écrit ICI plutôt que dans cinq feuilles.
 */
export const SANS_DONNEES = {} as ParcoursData;

export function FVal({
  k,
  tag = 'div',
  style,
}: {
  readonly k: string;
  readonly tag?: 'div' | 'span';
  readonly style?: CSSProperties;
}) {
  const c = useControleur();
  const texte = c.val(k);
  if (texte === null) return null;
  // Un texte saisi garde ses retours à la ligne (l'aperçu de « Je suis bloqué·e »).
  const rendu = texte.includes('\n') ? { ...style, whiteSpace: 'pre-wrap' as const } : style;
  return tag === 'span' ? <span style={rendu}>{texte}</span> : <div style={rendu}>{texte}</div>;
}

const ETEINT: CSSProperties = { opacity: 0.5, cursor: 'default' };

export function FAct({
  k,
  style,
  children,
}: {
  readonly k: string;
  readonly style?: CSSProperties;
  readonly children?: ReactNode;
}) {
  const c = useControleur();
  const a = c.act(k);
  const contenu = a.libelle ?? children;
  if (a.href !== undefined) {
    return (
      <Link
        href={a.href}
        onClick={c.fermer}
        style={{ ...style, textDecoration: 'none', boxSizing: 'border-box' }}
      >
        {contenu}
      </Link>
    );
  }
  return (
    <button
      type="button"
      disabled={a.disabled === true}
      onClick={a.onClick}
      style={{ ...style, cursor: 'pointer', ...(a.disabled === true ? ETEINT : {}) }}
    >
      {contenu}
    </button>
  );
}

export function FLien({
  href,
  style,
  children,
}: {
  readonly href: string;
  readonly style?: CSSProperties;
  readonly children?: ReactNode;
}) {
  const c = useControleur();
  return (
    <Link
      href={href}
      onClick={c.fermer}
      style={{ textDecoration: 'none', color: 'inherit', boxSizing: 'border-box', ...style }}
    >
      {children}
    </Link>
  );
}

export function FSlot({ k, s = [] }: { readonly k: string; readonly s?: Styles }) {
  const c = useControleur();
  return <>{c.slot(k, s)}</>;
}
