'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE RUBAN DE STORIES SE PARCOURT AU CHEVRON, PLUS À LA MOLETTE             ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Pour le scroll de liste des stories il faut plutôt utiliser des
 * boutons prev et next bien présentés. »
 *
 * CE QUI PRÉCÉDAIT. La grille de `Fil d'actualité v2` dessine CINQ cases pour une
 * ligne de 198 px. Le fil réel porte plus de quatre stories : elles débordaient
 * sur une deuxième ligne et les 198 px se partageaient entre les rangs — relevé
 * 79 px par carte. La parade d'alors était de n'en montrer que quatre, ce qui
 * rendait les autres inatteignables sur l'ordinateur. Les chevrons lèvent les
 * deux : une seule ligne, et toutes les stories.
 *
 * ── LE DESSIN DE LA GRILLE EST CONSERVÉ ───────────────────────────────────
 *
 * Cinq cartes visibles, 198 px de haut, 12 px d'écart : c'est la planche, au
 * pixel près. Seul le DÉBORDEMENT change de nature — un rang de plus devient un
 * cran de défilement.
 *
 * ── LES CHEVRONS SONT CEUX DU DÉPÔT ───────────────────────────────────────
 *
 * Ronds de 44 px — T1 §2.3, et un chevron est une cible tactile — sur
 * `rgba(255,255,255,.92)`, tracé `#16211D`. Ce sont ceux de `CarrouselPhotos`,
 * qui les tient eux-mêmes de la planche de lecture de story (A13). AUCUNE OMBRE
 * PORTÉE : T1 §2.3 l'interdit, et le garde-fou la mesure.
 *
 * ── ILS DISPARAISSENT QUAND IL N'Y A RIEN À PARCOURIR ─────────────────────
 *
 * Deux stories tiennent dans la largeur : afficher deux flèches éteintes
 * occuperait la place de deux cartes pour ne rien promettre. On les MONTE
 * seulement quand le ruban déborde, et on les éteint à chaque bout.
 */
export function RubanStories({ children }: { readonly children: ReactNode }) {
  const rail = useRef<HTMLDivElement>(null);
  const [debut, setDebut] = useState(true);
  const [fin, setFin] = useState(true);

  /**
   * ON RELIT LES BORNES PLUTÔT QUE DE COMPTER LES CARTES. Le nombre visible
   * dépend de la largeur réelle de la colonne, que ce composant ne connaît pas —
   * et qui change avec la fenêtre. `scrollLeft` et `scrollWidth` le savent, eux.
   */
  const relire = useCallback(() => {
    const n = rail.current;
    if (n === null) return;
    const reste = n.scrollWidth - n.clientWidth;
    setDebut(n.scrollLeft <= 1);
    setFin(reste <= 1 || n.scrollLeft >= reste - 1);
  }, []);

  useEffect(() => {
    relire();
    const n = rail.current;
    if (n === null) return undefined;
    n.addEventListener('scroll', relire, { passive: true });
    /**
     * `ResizeObserver` ET PAS SEULEMENT `resize` : la colonne du fil change aussi
     * quand le rail de gauche se replie, sans que la fenêtre bouge.
     */
    const oeil = new ResizeObserver(relire);
    oeil.observe(n);
    return () => {
      n.removeEventListener('scroll', relire);
      oeil.disconnect();
    };
  }, [relire, children]);

  const pousser = (sens: -1 | 1): void => {
    const n = rail.current;
    if (n === null) return;
    /**
     * UNE VUE ENTIÈRE MOINS UNE CARTE : on garde la dernière carte lue à l'écran,
     * ce qui dit où l'on en était. Sauter une vue pleine fait perdre le fil.
     */
    n.scrollBy({ left: sens * Math.max(n.clientWidth - 140, 160), behavior: 'smooth' });
  };

  const chevron = (sens: -1 | 1, eteint: boolean): ReactNode => (
    <button
      type="button"
      onClick={() => {
        pousser(sens);
      }}
      disabled={eteint}
      aria-label={sens === -1 ? 'Stories précédentes' : 'Stories suivantes'}
      data-ruban-stories={sens === -1 ? 'prev' : 'suiv'}
      style={{
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-50%)',
        ...(sens === -1 ? { left: '6px' } : { right: '6px' }),
        zIndex: 2,
        width: '44px',
        height: '44px',
        borderRadius: '999px',
        background: 'rgba(255,255,255,.92)',
        border: 'none',
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: eteint ? 'default' : 'pointer',
        opacity: eteint ? 0.45 : 1,
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#16211D"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={sens === -1 ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
      </svg>
    </button>
  );

  /** Déborde-t-il ? Si les deux bouts sont atteints en même temps, non. */
  const deborde = !(debut && fin);

  return (
    <div style={{ position: 'relative' }} data-ruban-stories-boite="">
      <div
        ref={rail}
        data-ruban-stories-rail=""
        style={{
          display: 'flex',
          gap: '12px',
          height: '198px',
          overflowX: 'auto',
          /**
           * LA BARRE DU NAVIGATEUR EST MASQUÉE, pas le défilement : les chevrons
           * sont la commande, et une barre grise sous les cartes doublerait le
           * message. Le geste tactile et la molette continuent de marcher.
           */
          scrollbarWidth: 'none',
          scrollSnapType: 'x proximity',
        }}
      >
        {children}
      </div>
      {deborde ? chevron(-1, debut) : null}
      {deborde ? chevron(1, fin) : null}
    </div>
  );
}
