'use client';

import { Modal } from '@/components/modal';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ UNE VRAIE FENÊTRE DE CONFIRMATION — ET CHAQUE PIÈCE EST EMPRUNTÉE          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Pour les confirmations inspire-toi du design pour créer un modal
 * bien fait. »
 *
 * CE QUI PRÉCÉDAIT : `window.confirm`, à deux endroits — supprimer une
 * publication, et bloquer un membre. La boîte du navigateur ne porte ni la
 * typographie du dépôt, ni ses couleurs, ni sa langue sur certains systèmes, et
 * sur téléphone elle s'affiche en haut de l'écran, loin du geste.
 *
 * ── RIEN N'EST INVENTÉ ICI, ET C'EST LE POINT ─────────────────────────────
 *
 * `08 Compte` DESSINE DÉJÀ une fenêtre de confirmation : K08 · suppression de
 * compte, cadre de 440 px. Tout le châssis en vient, mot pour mot :
 *
 *   · le voile `rgba(22,33,29,.55)` ;
 *   · le panneau — 440 px, `#fff`, trait `1px solid #DDE3E0`, rayon 28,
 *     retrait 24, colonne, écart 16, `maxHeight: calc(100vh - 48px)` ;
 *   · l'en-tête — `<h2>` 20 px / 800 / `-0.5px`, et la croix dans un rond de
 *     40 px sur `#F2F5F4` ;
 *   · la zone de contenu `data-fenetre-contenu` qui DÉFILE, elle seule ;
 *   · l'encart d'avertissement — `#F6F8F7`, rayon 14, retrait 12, 12,5 px ;
 *   · le bouton d'action — 44 px, retrait `0 18px`, rayon 14, `#16211D`, encre
 *     blanche, 13,5 px / 700.
 *
 * Le bouton « Annuler » vient d'ailleurs, et il est dessiné lui aussi : D08 en
 * écrit un, même géométrie exactement, sur l'aplat `#F2F5F4` avec l'encre
 * `#16211D`. C'est le bouton secondaire du dépôt.
 *
 * ⚠ LE SEUL ÉCART, et il faut le dire : la planche de K08 ne dessine QU'UN
 * bouton — la croix y tient lieu d'annulation. On en pose deux, parce qu'une
 * croix de 40 px en haut à droite est une cible lointaine pour un pouce quand la
 * question est posée en bas de l'écran. REMONTÉ au porteur.
 *
 * ⚠ ET LE BOUTON DE CONFIRMATION RESTE `#16211D`, PAS ROUGE. C'est ce que la
 * planche dessine sur « Confirmer la suppression », l'action la plus destructive
 * du produit. Le rouge `#C2453B` du dépôt est réservé au LIBELLÉ d'une entrée
 * dangereuse — « Supprimer », « Bloquer » dans un menu — et non à l'aplat d'un
 * bouton. On ne change pas cette grammaire pour une fenêtre.
 *
 * ── CE QUE CE COMPOSANT NE FAIT PAS ───────────────────────────────────────
 *
 * Ni Échap, ni le piège de tabulation, ni le retour du focus : c'est `Modal` qui
 * les porte, pour les huit fenêtres transcodées comme pour celle-ci. Ce fichier
 * n'est que la COQUE qu'on lui donne à rendre.
 */
export function FenetreConfirmation({
  ouverte,
  titre,
  question,
  precision,
  libelleConfirmer,
  onConfirmer,
  onAnnuler,
  occupe = false,
  nom = 'CONFIRMATION',
}: {
  readonly ouverte: boolean;
  readonly titre: string;
  /** La phrase principale — ce qui va se passer, en une ligne. */
  readonly question: string;
  /** L'encart gris : ce qu'on ne pourra pas défaire. Absent, rien n'est dessiné. */
  readonly precision?: string;
  readonly libelleConfirmer: string;
  readonly onConfirmer: () => void;
  readonly onAnnuler: () => void;
  /** Vrai pendant l'appel : les deux boutons s'éteignent plutôt que de partir deux fois. */
  readonly occupe?: boolean;
  /** Le nom de la planche, pour que les épreuves désignent la bonne fenêtre. */
  readonly nom?: string;
}) {
  const titreId = `${nom.toLowerCase()}-titre`;

  const panneau = (
    <>
      <div
        style={{ position: 'fixed', inset: '0', background: 'rgba(22,33,29,.55)' }}
        data-modal-overlay=""
      />
      <div
        data-modal-panel=""
        data-fenetre-confirmation=""
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%,-50%)',
          width: '440px',
          /** La planche fige 440 px ; un téléphone de 390 px déborderait. */
          maxWidth: 'calc(100vw - 24px)',
          background: '#fff',
          border: '1px solid #DDE3E0',
          borderRadius: '28px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          flexShrink: 0,
          maxHeight: 'calc(100vh - 48px)',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: '1' }}>
            <h2
              id={titreId}
              style={{ margin: '0', fontSize: '20px', fontWeight: 800, letterSpacing: '-0.5px' }}
            >
              {titre}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Fermer"
            data-modal-close=""
            onClick={onAnnuler}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '999px',
              background: '#F2F5F4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              padding: '0',
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
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div
          data-fenetre-contenu=""
          style={{
            flex: '1',
            /** Sans `minHeight: 0`, un enfant de flex refuse de rétrécir et déborde. */
            minHeight: '0',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ fontSize: '13px', lineHeight: '1.55', color: '#16211D' }}>{question}</div>
          {precision === undefined ? null : (
            <div
              style={{
                background: '#F6F8F7',
                borderRadius: '14px',
                padding: '12px',
                fontSize: '12.5px',
                color: '#5D6B66',
                lineHeight: '1.55',
              }}
            >
              {precision}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={onAnnuler}
            disabled={occupe}
            data-confirmation-annuler=""
            style={{ ...BOUTON, background: '#F2F5F4', color: '#16211D', flex: '1' }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirmer}
            disabled={occupe}
            data-confirmation-confirmer=""
            style={{
              ...BOUTON,
              background: occupe ? '#8A958F' : '#16211D',
              color: '#fff',
              flex: '1',
              cursor: occupe ? 'default' : 'pointer',
            }}
          >
            {libelleConfirmer}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <Modal open={ouverte} onClose={onAnnuler} titleId={titreId} name={nom} mobile={panneau} />
  );
}

/** La géométrie que K08 et D08 dessinent tous deux, à l'identique. */
const BOUTON = {
  height: '44px',
  padding: '0 18px',
  borderRadius: '14px',
  border: 'none',
  font: 'inherit',
  fontSize: '13.5px',
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  whiteSpace: 'nowrap' as const,
  cursor: 'pointer',
};
