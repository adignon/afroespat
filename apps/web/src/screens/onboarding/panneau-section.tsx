'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA COQUE D'UN PANNEAU QUI RECOUVRE SA SECTION                             ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur, pour le pays d'origine : « il faut afficher un slide left modal
 * quand on clique sur le pays […] IL NE FAUT PAS QUE CE SOIT COMME LES AUTRES
 * MODALS mais plutôt un modal dans la section qui cache tout le contenu de la
 * section. » Puis, pour l'indicatif : « Utilise le modal de sélection du pays ici
 * aussi. » Puis, pour la ville : « utilise le panneau aussi ».
 *
 * TROIS EMPLOIS, UNE SEULE COQUE. Ce fichier est né de l'extraction de
 * `selecteur-pays.tsx` au troisième emploi : trois copies auraient divergé au
 * premier ajustement, et le porteur aurait eu trois panneaux qui ne se
 * ressemblent plus.
 *
 * Ce qu'elle apporte, et rien d'autre : la géométrie empruntée à la maquette, le
 * glissement, le focus, le piège au clavier, Échap, et le titre. Ce qu'elle
 * contient — des pays, des villes — ne la regarde pas.
 *
 * ── D'OÙ VIENT CHAQUE VALEUR ──────────────────────────────────────────────
 *
 * De `docs/template/01 Accès et Onboarding.dc.html`, c'est-à-dire des sections
 * que ces panneaux recouvrent :
 *
 *   · la coque d'ordinateur — la carte blanche, `background:#fff;
 *     border-radius:22px;padding:22px` ;
 *   · la coque de téléphone — la planche n'y dessine AUCUNE carte, donc le fond
 *     du cadre, `#F6F8F7`, et aucun retrait : sinon les lignes se décaleraient de
 *     tout ce qu'elles recouvrent ;
 *   · le bouton de retour — le chevron de l'en-tête de ces écrans,
 *     `width:44px;height:44px;border-radius:999px;background:#EEF2F0`, tracé
 *     `m15 18-6-6 6-6` en `#16211D` ;
 *   · le titre — l'étiquette du champ remplacé, avec SON style : 13,5 px / 700 sur
 *     ordinateur, 13 px sur téléphone ;
 *   · la liste — la liste de villes de O02, verbatim
 *     (`border:1px solid #EAEEEC;border-radius:16px;padding:6px`).
 *
 * ── LE MOUVEMENT EST DÉCLARÉ ──────────────────────────────────────────────
 *
 * `sectionPanelIn` dans `packages/config/motion.js` : 220 ms — la durée de
 * `sheet`, parce que c'est le même geste, couché — courbe `out`, depuis
 * `translateX(100%)`.
 *
 * ── LES DEUX CADRES EXISTENT TOUS LES DEUX ────────────────────────────────
 *
 * `ScreenFrames` rend le cadre d'ordinateur ET celui de téléphone, et masque
 * l'un en CSS. Deux panneaux sont donc montés. D'où deux précautions :
 *
 *   · le nom de la boîte de dialogue passe par `aria-label`, jamais par
 *     `aria-labelledby` : deux fois le même `id` rendrait le nom ambigu, et c'est
 *     l'écueil que `modal.tsx` documente ;
 *   · le focus, le piège au clavier et Échap sont pris par le SEUL panneau
 *     visible, reconnu à son `offsetParent`. Sans ce filtre, le panneau masqué
 *     volait le focus à celui qu'on regarde.
 */

/** Les éléments du panneau qui peuvent recevoir le focus. */
const FOCUSABLES = 'button:not([disabled]), input:not([disabled])';

/** Ce qui change entre la carte d'ordinateur et la page de téléphone. */
export interface GeometriePanneau {
  readonly coque: CSSProperties;
  readonly titre: CSSProperties;
  readonly liste: CSSProperties;
  readonly ligne: CSSProperties;
}

export const GEOMETRIES: Record<'desktop' | 'mobile', GeometriePanneau> = {
  /** La carte blanche de 22 px de rayon, recouverte de bord à bord. */
  desktop: {
    coque: { background: '#fff', borderRadius: '22px', padding: '22px' },
    titre: { fontSize: '13.5px', fontWeight: 700 },
    liste: {
      marginTop: '10px',
      border: '1px solid #EAEEEC',
      borderRadius: '16px',
      padding: '6px',
    },
    ligne: { height: '48px', gap: '12px', padding: '0 12px' },
  },
  /**
   * Sur téléphone la maquette ne dessine AUCUNE carte : le contenu est posé à
   * plat dans le cadre. La coque prend donc le fond du cadre et aucun retrait,
   * sinon les lignes se décaleraient de tout ce qu'elles recouvrent.
   */
  mobile: {
    coque: { background: '#F6F8F7', padding: 0 },
    titre: { fontSize: '13px', fontWeight: 700 },
    liste: {
      marginTop: '8px',
      background: '#fff',
      border: '1px solid #EAEEEC',
      borderRadius: '16px',
      padding: '6px',
    },
    ligne: { height: '46px', gap: '10px', padding: '0 10px' },
  },
};

/** Une phrase d'état dans la liste — attente, absence, refus. Même gris partout. */
export function PhrasePanneau({
  children,
  alerte = false,
}: {
  readonly children: ReactNode;
  readonly alerte?: boolean;
}) {
  return (
    <p
      style={{ margin: 0, padding: '12px', fontSize: '13px', color: '#5D6B66' }}
      {...(alerte ? { role: 'alert' as const } : {})}
    >
      {children}
    </p>
  );
}

export function PanneauDeSection({
  ouvert,
  titre,
  variante,
  repere,
  onFermer,
  entete,
  children,
}: {
  readonly ouvert: boolean;
  /** Le nom de la boîte de dialogue ET son titre visible — le même mot. */
  readonly titre: string;
  readonly variante: 'desktop' | 'mobile';
  /** La valeur de `data-panneau-section`, pour que les tests sachent lequel. */
  readonly repere: string;
  readonly onFermer: () => void;
  /** Posé entre le titre et la liste — une recherche, par exemple. */
  readonly entete?: ReactNode;
  readonly children: ReactNode;
}) {
  const racine = useRef<HTMLDivElement | null>(null);
  /**
   * Faux au premier rendu, vrai à l'image suivante : c'est ce décalage qui donne
   * la transition. Sans lui, le panneau naîtrait déjà en place — le navigateur
   * n'anime que ce qui CHANGE après la peinture.
   */
  const [entre, setEntre] = useState(false);

  useEffect(() => {
    if (!ouvert) {
      setEntre(false);
      return;
    }
    const image = requestAnimationFrame(() => setEntre(true));
    return () => cancelAnimationFrame(image);
  }, [ouvert]);

  /**
   * Focus, Échap et piège au clavier — pour le SEUL cadre visible.
   *
   * `offsetParent` vaut `null` sur un élément dont un ancêtre porte
   * `display: none`, ce qui est l'état du cadre que `ScreenFrames` masque. Le
   * panneau masqué ne touche donc ni au focus ni au clavier.
   */
  useEffect(() => {
    const boite = racine.current;
    if (!ouvert || boite === null || boite.offsetParent === null) return;

    const revenirA = document.activeElement;
    boite.querySelector<HTMLElement>(FOCUSABLES)?.focus();

    const surTouche = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onFermer();
        return;
      }
      if (event.key !== 'Tab') return;
      const cibles = [...boite.querySelectorAll<HTMLElement>(FOCUSABLES)];
      if (cibles.length === 0) {
        event.preventDefault();
        return;
      }
      const premier = cibles[0];
      const dernier = cibles[cibles.length - 1];
      if (premier === undefined || dernier === undefined) return;
      if (event.shiftKey && document.activeElement === premier) {
        event.preventDefault();
        dernier.focus();
      } else if (!event.shiftKey && document.activeElement === dernier) {
        event.preventDefault();
        premier.focus();
      }
    };

    document.addEventListener('keydown', surTouche);
    return () => {
      document.removeEventListener('keydown', surTouche);
      /**
       * `isConnected` : le bouton d'où l'on venait peut avoir disparu avec le
       * panneau. Rendre le focus à un élément détaché le renvoie sur `<body>`,
       * donc au début du document — ce que `modal.tsx` documente déjà.
       */
      if (revenirA instanceof HTMLElement && revenirA.isConnected) revenirA.focus();
    };
  }, [ouvert, onFermer]);

  if (!ouvert) return null;

  const g = GEOMETRIES[variante];

  return (
    <div
      ref={racine}
      role="dialog"
      aria-modal="true"
      aria-label={titre}
      data-panneau-section={repere}
      style={{
        ...g.coque,
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        transform: entre ? 'translateX(0)' : 'translateX(100%)',
        // motion:sectionPanelIn — 220 ms, easing.out. Voir packages/config/motion.js.
        transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <button
          type="button"
          onClick={onFermer}
          aria-label="Fermer"
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '999px',
            background: '#EEF2F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            padding: 0,
            font: 'inherit',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#16211D"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <span style={g.titre}>{titre}</span>
      </div>
      {entete}
      <div style={{ ...g.liste, flex: '1', minHeight: '0', overflowY: 'auto' }}>{children}</div>
    </div>
  );
}
