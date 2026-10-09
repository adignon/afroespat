'use client';

import type { ReactNode } from 'react';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE PANNEAU D'UNE FENÊTRE — L'EN-TÊTE ET LES ACTIONS NE DÉFILENT PAS       ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Le modal de sélection des parcours au niveau de la création
 * d'une story a l'en-tête qui se cache et n'est pas bien affiché, ainsi que le
 * bas. C'est la même erreur qu'on avait corrigée sur les publications. Je veux
 * que tu crées un composant réutilisé qui est le modal. Les actions du modal, le
 * titre et le bouton de fermeture ne doivent pas scroller. Seul le contenu du
 * modal scrolle. »
 *
 * ── POURQUOI LA CORRECTION PRÉCÉDENTE N'A PAS COUVERT CELLE-CI ────────────
 *
 * `FENETRE_QUI_DEBORDE`, dans le générateur, pose `maxHeight` et `overflowY` sur
 * les panneaux TRANSCODÉS — trente-huit d'un coup. Ce panneau-ci est ÉCRIT À LA
 * MAIN : la maquette de A14 ne dessine ni le sélecteur de parcours ni sa fenêtre,
 * donc le transcodeur n'avait rien à transformer. Le défaut est le même, la cause
 * est que la règle ne passait pas par là.
 *
 * ── ET POURQUOI `overflow: auto` SUR LE PANNEAU NE SUFFIT PAS ─────────────
 *
 * C'est ce que fait la correction du générateur, et c'est juste pour un panneau
 * COURT : tout défile ensemble, titre compris. Dès que le contenu est long — six
 * parcours et leur description — le titre part vers le haut, et le bouton du bas
 * n'est atteignable qu'après avoir tout déroulé. Le porteur décrit exactement
 * cela : « l'en-tête qui se cache […] ainsi que le bas ».
 *
 * TROIS ZONES, DONC, et une seule défile :
 *
 *   · l'en-tête — titre et croix — en `flexShrink: 0` ;
 *   · le contenu — `flex: 1; minHeight: 0; overflowY: auto`. `minHeight: 0` est
 *     indispensable : un enfant de `flex` a `min-height: auto` par défaut, donc il
 *     refuse de rétrécir sous sa hauteur naturelle et déborde au lieu de défiler ;
 *   · les actions, en `flexShrink: 0` elles aussi.
 *
 * ── LE DESSIN EST EMPRUNTÉ, PAS INVENTÉ ───────────────────────────────────
 *
 * Tout vient du panneau de A01P (« Partager »), dessiné dans
 * `docs/template/03 Accueil v2.dc.html` : 520 px de large, rayon 28, retrait 24,
 * écart 18 ; titre 20 px / 800 / `-0.5px` ; croix dans un rond de 40 px sur
 * `#F2F5F4`. La forme de téléphone est celle des feuilles du même fichier :
 * collée en bas, pleine largeur, rayon `28px 28px 0 0`, titre 18 px.
 *
 * AUCUNE OMBRE PORTÉE : T1 §2.3.
 *
 * ── CE QUE CE COMPOSANT NE FAIT PAS ───────────────────────────────────────
 *
 * Il ne gère NI l'ouverture, NI Échap, NI le piège de tabulation, NI le retour du
 * focus : c'est `Modal` qui les porte, pour les huit fenêtres transcodées comme
 * pour celles-ci. Ce fichier n'est que la COQUE qu'on lui donne à rendre, et les
 * deux se composent — `<Modal desktop={<PanneauFenetre …>} mobile={…} />`.
 */
export function PanneauFenetre({
  titreId,
  titre,
  enTete,
  actions,
  feuille = false,
  largeur = '520px',
  children,
}: {
  readonly titreId: string;
  readonly titre: string;
  /** Posé à droite du titre, avant la croix — un onglet, un compte, un filtre. */
  readonly enTete?: ReactNode;
  /** Le pied FIXE. Absent, rien n'est dessiné en bas — et rien ne prend de place. */
  readonly actions?: ReactNode;
  /** Vrai = la feuille du téléphone ; faux = la fenêtre centrée de l'ordinateur. */
  readonly feuille?: boolean;
  readonly largeur?: string;
  readonly children: ReactNode;
}) {
  const retrait = feuille ? '18px' : '24px';

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(22,33,29,.55)' }}
        data-modal-overlay=""
      />
      <div
        data-modal-panel=""
        style={{
          position: 'fixed',
          ...(feuille
            ? {
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: '28px 28px 0 0',
                /**
                 * 24 px DE MARGE EN HAUT, pas plus : une feuille peut occuper
                 * presque tout l'écran, c'est ce que les planches de 390 px
                 * dessinent (`height: 88%`). Ce qui compte est qu'elle ne le
                 * DÉPASSE pas.
                 */
                maxHeight: 'calc(100vh - 24px)',
              }
            : {
                left: '50%',
                top: '50%',
                transform: 'translate(-50%,-50%)',
                width: largeur,
                maxWidth: 'calc(100vw - 24px)',
                borderRadius: '28px',
                maxHeight: 'calc(100vh - 48px)',
              }),
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          /**
           * `overflow: hidden` SUR LE PANNEAU : le contenu défile DANS sa zone, et
           * le rayon de 28 px doit rogner ce qui passe dessous. Sans lui, une
           * carte défilée dépasserait des coins arrondis.
           */
          overflow: 'hidden',
        }}
      >
        <div
          data-fenetre-entete=""
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: `${retrait} ${retrait} 0`,
          }}
        >
          <h2
            id={titreId}
            style={{
              margin: 0,
              fontSize: feuille ? '18px' : '20px',
              fontWeight: 800,
              letterSpacing: feuille ? undefined : '-0.5px',
              flex: 1,
              minWidth: 0,
            }}
          >
            {titre}
          </h2>
          {enTete}
          <button
            type="button"
            aria-label="Fermer"
            data-modal-close=""
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '999px',
              background: '#F2F5F4',
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
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#16211D"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div
          data-fenetre-contenu=""
          style={{
            flex: 1,
            /** Voir l'en-tête : sans `minHeight: 0`, un enfant de flex déborde. */
            minHeight: 0,
            overflowY: 'auto',
            padding: `${retrait}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {children}
        </div>

        {actions === undefined ? null : (
          <div
            data-fenetre-actions=""
            style={{
              flexShrink: 0,
              display: 'flex',
              gap: '8px',
              padding: `0 ${retrait} ${feuille ? 'calc(env(safe-area-inset-bottom, 0px) + 18px)' : retrait}`,
            }}
          >
            {actions}
          </div>
        )}
      </div>
    </>
  );
}
