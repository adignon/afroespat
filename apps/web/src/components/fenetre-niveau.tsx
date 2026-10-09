'use client';

import Link from 'next/link';
import { Modal } from '@/components/modal';
import { requiredLevel, type Capability } from '@app/shared';
import { CONDITIONS_NIVEAU, libelleCapacite, niveauEcrit } from '@/lib/capacites';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « IL FAUT ÊTRE DE TEL NIVEAU » — L'INVITATION À MONTER                    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Quand il clique un pop-up doit apparaître pour lui dire que
 * pour accéder à cette fonctionnalité il faut être de tel niveau avec les
 * conditions et un bouton pour passer à niveau dans ses paramètres. »
 *
 * Les trois morceaux sont là, et aucun n'est écrit à la main :
 *
 *   · LE NIVEAU EXIGÉ vient de `requiredLevel(capacite)`, donc de la table que
 *     le serveur applique. Un déplacement dans la table change la phrase ;
 *   · LA FONCTIONNALITÉ est `labelFr`, de la même table — « publier dans le fil
 *     d'actualité et les stories », « rédiger un guide » ;
 *   · LES CONDITIONS sont celles du module Vérification (`CONDITIONS_NIVEAU`),
 *     dans ses mots.
 *
 * Le bouton mène à `/compte/verification`, la page qui fait franchir la marche —
 * « ses paramètres », dans les mots du porteur.
 *
 * ── LE CHÂSSIS EST CELUI DE K08, COMME LES AUTRES FENÊTRES ────────────────
 *
 * Voile `rgba(22,33,29,.55)`, panneau de 440 px, trait `#DDE3E0`, rayon 28,
 * retrait 24, croix de 40 px sur `#F2F5F4`, boutons de 44 px au rayon 14. Rien
 * de neuf : la maquette a déjà décidé à quoi ressemble une fenêtre ici.
 */
export function FenetreNiveau({
  capacite,
  onFermer,
}: {
  /** `null` = fermée. La capacité refusée décide de tout le contenu. */
  readonly capacite: Capability | null;
  readonly onFermer: () => void;
}) {
  const exige = capacite === null ? 'L1' : requiredLevel(capacite);

  const panneau = (
    <>
      <div
        style={{ position: 'fixed', inset: '0', background: 'rgba(22,33,29,.55)' }}
        data-modal-overlay=""
      />
      <div
        data-modal-panel=""
        data-fenetre-niveau={capacite ?? ''}
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%,-50%)',
          width: '440px',
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
              id="niveau-titre"
              style={{ margin: '0', fontSize: '20px', fontWeight: 800, letterSpacing: '-0.5px' }}
            >
              Niveau {niveauEcrit(exige)} requis
            </h2>
          </div>
          <button
            type="button"
            aria-label="Fermer"
            data-modal-close=""
            onClick={onFermer}
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
            minHeight: '0',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ fontSize: '13px', lineHeight: '1.55', color: '#16211D' }}>
            Pour {capacite === null ? 'cette action' : libelleCapacite(capacite)}, il faut être de
            niveau {niveauEcrit(exige)}.
          </div>
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
            {CONDITIONS_NIVEAU[exige]}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={onFermer}
            data-niveau-plus-tard=""
            style={{ ...BOUTON, background: '#F2F5F4', color: '#16211D', flex: '1' }}
          >
            Plus tard
          </button>
          <Link
            href="/compte/verification"
            data-niveau-monter=""
            onClick={onFermer}
            style={{
              ...BOUTON,
              background: '#16785E',
              color: '#fff',
              flex: '1',
              textDecoration: 'none',
            }}
          >
            Passer au niveau {niveauEcrit(exige)}
          </Link>
        </div>
      </div>
    </>
  );

  return (
    <Modal
      open={capacite !== null}
      onClose={onFermer}
      titleId="niveau-titre"
      name="NIVEAU"
      mobile={panneau}
    />
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
  cursor: 'pointer',
} as const;
