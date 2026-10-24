'use client';

import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

/**
 * AJOUTS HORS MAQUETTE — les gestes de la page « Notifications » (X02, 12 §2.7).
 *
 * La maquette dessine des lignes sans destination, un « Tout marquer lu » qui est un
 * lien mort (`href="#"`) et aucun compteur. Trois composants, dans le langage visuel
 * de la page (mêmes fonds, mêmes tailles, aucune couleur nouvelle) :
 *
 *   · `LigneNotification` — la ligne devient un LIEN vers sa cible quand elle en a
 *     une (la colonne `url` posée par le serveur) ; sinon elle reste un bloc qui se
 *     contente de se marquer lue. Ouvrir une ligne la marque lue.
 *   · `ToutMarquerLu` — `POST /notifications/read { all: true }`.
 *   · `CompteurNonLues` — « 3 non lues », que 12 §2.7 demande et qu'aucune planche
 *     ne dessinait.
 */
export function LigneNotification({
  href,
  onOuvrir,
  style,
  children,
}: {
  readonly href: string | null;
  /** Appelé à l'ouverture : marque la ligne lue (sans attendre la navigation). */
  readonly onOuvrir: () => void;
  readonly style: CSSProperties;
  readonly children: ReactNode;
}) {
  if (href === null) {
    return (
      <div
        data-notif-ligne=""
        style={{ ...style, cursor: 'default' }}
        onClick={onOuvrir}
      >
        {children}
      </div>
    );
  }
  return (
    <Link
      href={href}
      data-notif-ligne=""
      onClick={onOuvrir}
      style={{ ...style, textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
    >
      {children}
    </Link>
  );
}

export function ToutMarquerLu({
  onClick,
  desactive,
  taille,
}: {
  readonly onClick: (() => void) | undefined;
  readonly desactive: boolean;
  readonly taille: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desactive}
      data-notif-tout-lire=""
      style={{
        border: 'none',
        background: 'none',
        font: 'inherit',
        fontSize: taille,
        fontWeight: 700,
        color: '#16785E',
        padding: '0 4px',
        minHeight: '44px',
        cursor: desactive ? 'default' : 'pointer',
        opacity: desactive ? 0.45 : 1,
      }}
    >
      Tout marquer lu
    </button>
  );
}

export function CompteurNonLues({ n }: { readonly n: number }) {
  return (
    <span
      data-notif-compteur=""
      role="status"
      style={{ fontSize: '12.5px', fontWeight: 600, color: n > 0 ? '#0F5C48' : '#8A958F' }}
    >
      {n === 0 ? 'Tout est lu' : n === 1 ? '1 non lue' : `${n} non lues`}
    </span>
  );
}
