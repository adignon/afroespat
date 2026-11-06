'use client';

import { useEffect, useRef } from 'react';
import { displayMessageFor } from '@/lib/api/index';
import { resumeListe, type SuiteVue } from '@/lib/use-pages-curseur';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « VOIR PLUS » — LA SUITE D'UNE LISTE QUE LE SERVEUR A COUPÉE                ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le serveur rend 20 lignes et un curseur. Sans ce bouton, la vingt-et-unième
 * n'existait pas pour le membre, et rien ne le lui disait. Le composant :
 *
 *  - n'apparaît que s'il reste une page (`visible`) ;
 *  - annonce « 20 sur 134 » quand le total est connu, dans une zone `aria-live`
 *    qui dit aussi « Chargement… » et l'échec ;
 *  - se désactive pendant la requête (pas de double page) ;
 *  - propose « Réessayer » quand la page a échoué, sans effacer les lignes déjà là ;
 *  - peut, en option (`auto`), se déclencher tout seul à l'approche du bas de page
 *    (IntersectionObserver). Le bouton reste là : c'est lui qui rend la suite
 *    accessible au clavier et sans défilement.
 *
 * Le dessin est celui des boutons secondaires de la maquette : fond `#F2F5F4`,
 * 44 px, rayon 14 px, texte 13.5 px gras (voir `liste-profils-emploi.tsx`). Pas de
 * rouge : l'échec est en ambre `#B4581F`, comme les autres erreurs de liste.
 */
export interface PlusListe {
  readonly visible: boolean;
  readonly chargement: boolean;
  readonly echec: string | null;
  readonly resume: string | null;
  readonly onPlus: () => void;
  readonly onReessayer: () => void;
}

/** Ce que les écrans transcodés reçoivent quand aucune suite n'est branchée. */
export const AUCUNE_SUITE: PlusListe = {
  visible: false,
  chargement: false,
  echec: null,
  resume: null,
  onPlus: () => undefined,
  onReessayer: () => undefined,
};

/** Assemble la vue du composant depuis le crochet, le curseur courant et le décompte affiché. */
export function plusDe(
  suite: SuiteVue,
  options: {
    readonly curseur: string | null;
    readonly affiches: number;
    readonly total?: number | null;
  },
): PlusListe {
  return {
    visible: options.curseur !== null,
    chargement: suite.chargement,
    echec: suite.aEchoue ? displayMessageFor(suite.echec) : null,
    resume: resumeListe(options.affiches, options.total),
    onPlus: suite.suivante,
    onReessayer: suite.reessayer,
  };
}

const BOUTON = {
  height: '44px',
  padding: '0 18px',
  borderRadius: '14px',
  background: '#F2F5F4',
  color: '#16211D',
  border: 'none',
  font: 'inherit',
  fontSize: '13.5px',
  fontWeight: 700,
} as const;

export function VoirPlus({
  plus,
  libelle = 'Voir plus',
  auto = false,
}: {
  readonly plus: PlusListe | undefined;
  readonly libelle?: string;
  readonly auto?: boolean;
}) {
  const sentinelle = useRef<HTMLDivElement | null>(null);
  const actuel = useRef(plus);
  actuel.current = plus;
  const surveille = auto && plus?.visible === true && plus.echec === null;

  useEffect(() => {
    const noeud = sentinelle.current;
    if (!surveille || noeud === null || typeof IntersectionObserver === 'undefined') return;
    const observateur = new IntersectionObserver(
      (entrees) => {
        const p = actuel.current;
        if (entrees.some((e) => e.isIntersecting) && p !== undefined && !p.chargement) p.onPlus();
      },
      { rootMargin: '240px 0px' },
    );
    observateur.observe(noeud);
    return () => {
      observateur.disconnect();
    };
  }, [surveille]);

  if (plus === undefined || (!plus.visible && plus.resume === null)) return null;

  const etat = plus.chargement ? 'Chargement…' : (plus.echec ?? plus.resume ?? '');

  return (
    <div
      data-voir-plus=""
      ref={sentinelle}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '10px 0' }}
    >
      <span
        role="status"
        aria-live="polite"
        data-voir-plus-etat=""
        style={{
          fontSize: '12.5px',
          lineHeight: 1.5,
          color: plus.echec !== null && !plus.chargement ? '#B4581F' : '#5D6B66',
          fontWeight: plus.echec !== null && !plus.chargement ? 700 : 400,
        }}
      >
        {etat}
      </span>
      {!plus.visible ? null : plus.echec !== null && !plus.chargement ? (
        <button
          type="button"
          onClick={plus.onReessayer}
          data-voir-plus-reessayer=""
          style={{ ...BOUTON, cursor: 'pointer' }}
        >
          Réessayer
        </button>
      ) : (
        <button
          type="button"
          onClick={plus.onPlus}
          disabled={plus.chargement}
          aria-busy={plus.chargement}
          data-voir-plus-bouton=""
          style={{ ...BOUTON, cursor: plus.chargement ? 'default' : 'pointer', opacity: plus.chargement ? 0.6 : 1 }}
        >
          {plus.chargement ? 'Chargement…' : libelle}
        </button>
      )}
    </div>
  );
}
