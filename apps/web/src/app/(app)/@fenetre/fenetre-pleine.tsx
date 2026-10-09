'use client';

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA COQUE DES FENÊTRES DE STORY — PAR-DESSUS LA PAGE, PAS À SA PLACE       ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur, mot pour mot : « En fait la création et le display des stories sont
 * en fait des modals qui couvrent tout l'écran et non des nouvelles pages de lien.
 * Donc lors de la création le backdrop du modal de création ou de display doit être
 * un peu assombri comme dans les maquettes, on pourrait même voir le contenu de la
 * page légèrement car le background sera un peu transparent aussi. »
 *
 * ── COMMENT UNE PAGE DEVIENT UNE FENÊTRE SANS CESSER D'ÊTRE UNE PAGE ──────
 *
 * Par l'INTERCEPTION DE ROUTE de Next : `@fenetre/(.)stories/…` prend la main
 * quand on arrive sur `/stories/…` DEPUIS une page du groupe, et la page d'origine
 * reste montée dessous. Tapée directement, collée, ou rechargée, la même adresse
 * sert la page entière — `app/(app)/stories/…` — et rien n'est perdu.
 *
 * C'est ce qui permet d'avoir les deux à la fois : une story a une adresse qu'on
 * partage, ET elle s'ouvre sans quitter le fil.
 *
 * ── LE VOILE EST CELUI DU DOSSIER ────────────────────────────────────────
 *
 * `rgba(22,33,29,.55)` — la valeur que les huit fenêtres des maquettes écrivent,
 * et `components/modal.tsx` avec elles. Elle est opaque à 55 %, donc « on voit le
 * contenu de la page légèrement », exactement comme le porteur le décrit. Aucune
 * teinte n'est inventée.
 *
 * ── CE QUE CETTE COQUE NE FAIT PAS ───────────────────────────────────────
 *
 * Elle ne piège PAS le clavier et ne pose pas `aria-modal`. L'écran qu'elle porte
 * EST l'écran entier — A13 et A14 occupent déjà toute la surface, croix de
 * fermeture comprise —, et le déclarer boîte de dialogue ferait annoncer deux fois
 * la même chose. Elle n'apporte que trois choses : le voile, la fermeture par
 * Échap, et le blocage du défilement derrière.
 */
export function FenetrePleine({ children }: { readonly children: ReactNode }) {
  const router = useRouter();
  const voile = useRef<HTMLDivElement | null>(null);

  /**
   * ── IL N'Y A PLUS DE SEUIL DE LARGEUR ICI ────────────────────────────────
   *
   * Cette coque distinguait le téléphone du grand écran pour poser une marge de
   * 28 px et borner la boîte à 1384 px. Le porteur a demandé que la fenêtre
   * COUVRE TOUT L'ÉCRAN : il n'y a plus de boîte, donc plus rien à distinguer, et
   * le `matchMedia` qui suivait ce seuil est parti avec. `ScreenFrames` garde le
   * sien, qui choisit la planche — c'est une autre question.
   */

  /**
   * `router.back()` et non `push` : on revient d'où l'on vient, et l'entrée
   * d'historique créée par le lien disparaît. Pousser une adresse laisserait la
   * story dans l'historique, et le bouton « précédent » la rouvrirait.
   */
  const fermer = useCallback(() => router.back(), [router]);

  useEffect(() => {
    const surTouche = (event: KeyboardEvent) => {
      if (event.key === 'Escape') fermer();
    };
    document.addEventListener('keydown', surTouche);

    /**
     * LA PAGE DE DESSOUS NE DÉFILE PAS PENDANT QU'UNE FENÊTRE EST OUVERTE. Sans
     * cela, la molette traverse le voile et le fil bouge derrière — ce que
     * `modal.tsx` corrige déjà pour les huit autres fenêtres.
     */
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', surTouche);
      document.body.style.overflow = avant;
    };
  }, [fermer]);

  return (
    <div
      ref={voile}
      data-fenetre-story=""
      onClick={(event) => {
        // Le voile seul referme : un clic DANS l'écran ne doit rien fermer.
        if (event.target === voile.current) fermer();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        /**
         * NEUF DIXIÈMES, ET C'EST UN ARBITRAGE DU PORTEUR.
         *
         * Les huit fenêtres des maquettes écrivent `.55`, et c'est ce qui était
         * posé. Le porteur, capture à l'appui : « le background doit être avec une
         * opacité à 90% ». Sur une story — une surface de couleur pleine qui occupe
         * le milieu de l'écran — le fil resté lisible derrière entrait en
         * concurrence avec elle.
         *
         * La valeur de la maquette est donc remplacée ICI, à un seul endroit, et
         * pas dans les planches : les fenêtres des autres écrans gardent la leur.
         */
        background: 'rgba(22,33,29,.9)',
        overflowY: 'auto',
      }}
    >
      <div
        /**
         * ╔══════════════════════════════════════════════════════════════════════╗
         * ║ LA FENÊTRE COUVRE TOUT L'ÉCRAN — ARBITRAGE DU PORTEUR               ║
         * ╚══════════════════════════════════════════════════════════════════════╝
         *
         * Elle était une BOÎTE : 28 px de marge tout autour, 1384 px au plus, des
         * coins arrondis de 28 px. C'est ce que les planches dessinent pour une
         * fenêtre posée sur une page.
         *
         * Le porteur : « Le create story doit couvrir tout l'écran […] pareil pour
         * le display. » MESURÉ sur 1700 px : la boîte faisait 1440 px à x+130, donc
         * deux bandes de la page restaient visibles de part et d'autre — ce que sa
         * capture montre en vert.
         *
         * Il n'y a donc plus de boîte : le voile EST la fenêtre, et l'écran la
         * remplit. Le voile à neuf dixièmes reste ce qu'on voit du dessous — à
         * travers l'écran quand il est transparent, comme A13 l'est.
         *
         * `minHeight: 100%` et non `height` : l'écran garde son `min-h-screen` et
         * peut dépasser — c'est alors le VOILE qui défile, pas la page de dessous,
         * qui est bloquée.
         */
        style={{ width: '100%', minHeight: '100%' }}
      >
        {children}
      </div>
    </div>
  );
}
