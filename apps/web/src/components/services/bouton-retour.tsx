'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

/**
 * AJOUT — la flèche de retour des cadres mobiles d'une page de détail ou de
 * formulaire (S02, S03, S05, S07, S08).
 *
 * La maquette la dessine en `<span>` (un rond de 40 px, une flèche) : on ne revenait
 * donc jamais en arrière que par le geste du navigateur. Elle revient à la page
 * précédente quand il y en a une, et mène sinon à la liste du module (cas d'un lien
 * profond ouvert dans un onglet neuf).
 */
export function BoutonRetour({
  style,
  children,
  repli = '/services/logement',
  nom = 'Retour',
}: {
  readonly style: CSSProperties;
  readonly children: ReactNode;
  readonly repli?: string;
  readonly nom?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label={nom}
      data-retour=""
      onClick={() => {
        if (typeof window !== 'undefined' && window.history.length > 1) router.back();
        else router.push(repli);
      }}
      style={style}
    >
      {children}
    </button>
  );
}
