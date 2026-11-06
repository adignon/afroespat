'use client';

import { useCallback, useRef, useState } from 'react';
import { Bouton, C, Message, useCharge, useGeste, type Charge } from './ui';

/**
 * LA PAGINATION « AFFICHER LA SUITE » DES ÉCRANS D'ÉQUIPE.
 *
 * Avant : chaque liste lisait la première page (50 lignes) et s'arrêtait là, sans le dire. Ici, une liste garde la
 * première page, puis ajoute les suivantes au curseur du serveur à chaque « Afficher la suite ». Un rechargement (ou
 * un changement de clé) repart de la première page : les pages ajoutées sont liées à CETTE première page et
 * deviennent caduques dès qu'elle est relue.
 */
export interface PageCurseur<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

/** Les lignes affichées et le curseur de la suite, à partir de la première page et des pages ajoutées. */
export function fusionnerPages<T>(
  premiere: PageCurseur<T>,
  ajoutees: { readonly base: PageCurseur<T>; readonly items: readonly T[]; readonly curseur: string | null } | null,
): { readonly items: readonly T[]; readonly curseur: string | null } {
  if (ajoutees === null || ajoutees.base !== premiere) return { items: premiere.items, curseur: premiere.nextCursor };
  return { items: [...premiere.items, ...ajoutees.items], curseur: ajoutees.curseur };
}

export function useListeCurseur<T>(charger: (curseur: string | null) => Promise<PageCurseur<T>>, cle: string) {
  const chargerRef = useRef(charger);
  chargerRef.current = charger;
  const premier = useCharge(() => chargerRef.current(null), cle);
  const [ajoutees, setAjoutees] = useState<{ base: PageCurseur<T>; items: readonly T[]; curseur: string | null } | null>(null);
  const geste = useGeste();

  const etat: Charge<{ readonly items: readonly T[]; readonly curseur: string | null }> =
    premier.etat.phase === 'pret' ? { phase: 'pret', donnees: fusionnerPages(premier.etat.donnees, ajoutees) } : premier.etat;

  const suite = useCallback(async () => {
    if (premier.etat.phase !== 'pret') return;
    const base = premier.etat.donnees;
    const courant = fusionnerPages(base, ajoutees);
    if (courant.curseur === null) return;
    const curseur = courant.curseur;
    await geste.lancer(async () => {
      const page = await chargerRef.current(curseur);
      setAjoutees({ base, items: [...(ajoutees?.base === base ? ajoutees.items : []), ...page.items], curseur: page.nextCursor });
    });
  }, [premier.etat, ajoutees, geste]);

  return { etat, recharger: premier.recharger, suite, occupe: geste.occupe, message: geste.message };
}

/** Le pied de liste : « N affichés — il en reste » et le bouton. Rien quand tout est affiché. */
export function AfficherLaSuite({
  curseur,
  affiches,
  occupe,
  message,
  onSuite,
}: {
  readonly curseur: string | null;
  readonly affiches: number;
  readonly occupe: boolean;
  readonly message: { ton: 'info' | 'attention'; texte: string } | null;
  readonly onSuite: () => void;
}) {
  if (curseur === null && message === null) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', padding: '10px 14px' }}>
      <span style={{ fontSize: '12.5px', color: C.gris }}>
        {affiches} affiché{affiches > 1 ? 's' : ''}
        {curseur === null ? '' : ' — il en reste'}
      </span>
      {curseur === null ? null : (
        <Bouton petit onClick={onSuite} disabled={occupe}>
          {occupe ? 'Un instant…' : 'Afficher la suite'}
        </Bouton>
      )}
      <Message message={message} />
    </div>
  );
}
