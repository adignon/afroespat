'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/modal';
import { MESSAGE_BODY_MAX, MESSAGE_BODY_MIN } from '@app/shared';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « SUR LE PROFIL, LE BOUTON ÉCRIRE NE MARCHE PAS »                         ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur, mot pour mot. MESURÉ : le bouton « Écrire » de K02 n'avait aucun
 * geste — ni sur la planche d'ordinateur, ni sur celle de 390 px. Zéro `onClick`
 * dans les deux cadres.
 *
 * ── POURQUOI UNE FENÊTRE, ET NON UN LIEN VERS `/messages` ─────────────────
 *
 * Parce que la route l'exige : `POST /conversations/direct` prend un
 * `firstMessage` OBLIGATOIRE (`createDirectConversationSchema`, min
 * `MESSAGE_BODY_MIN`). Il n'existe aucune façon d'ouvrir une conversation VIDE —
 * et c'est un choix du produit, pas un oubli : §5.2 veut qu'une conversation
 * commence par un message, sinon n'importe qui ouvrirait des fils muets.
 *
 * Un lien vers `/messages` n'aurait donc rien ouvert du tout. L'écran demande ce
 * que la route demande, et pas un champ de plus.
 *
 * ── LE CHÂSSIS EST CELUI DE `FenetreConfirmation`, QUI EST CELUI DE K08 ───
 *
 * Voile `rgba(22,33,29,.55)`, panneau de 440 px, trait `#DDE3E0`, rayon 28,
 * retrait 24, en-tête à croix de 40 px sur `#F2F5F4`, boutons de 44 px au rayon
 * 14. Rien de neuf : la maquette a déjà décidé à quoi ressemble une fenêtre de
 * ce produit, et on ne lui en dessine pas une seconde.
 *
 * ── LA BORNE VIENT DE `@app/shared` ───────────────────────────────────────
 *
 * `MESSAGE_BODY_MIN` et `MESSAGE_BODY_MAX` sont lues là où le serveur les lit.
 * Un nombre recopié ici deviendrait faux au premier ajustement, et le symptôme
 * serait un 400 que l'écran afficherait comme une panne — ce dépôt l'a déjà payé
 * quatre fois.
 */
export function FenetreEcrire({
  ouverte,
  prenom,
  onEnvoyer,
  onFermer,
  occupe = false,
}: {
  readonly ouverte: boolean;
  readonly prenom: string;
  readonly onEnvoyer: (message: string) => void;
  readonly onFermer: () => void;
  readonly occupe?: boolean;
}) {
  const [texte, setTexte] = useState('');

  /**
   * LE CHAMP SE VIDE À CHAQUE OUVERTURE. `useState` ne lit sa valeur initiale
   * qu'au montage, et la fenêtre reste montée entre deux ouvertures : sans cet
   * effet, le brouillon abandonné réapparaîtrait sur le profil suivant.
   */
  useEffect(() => {
    if (ouverte) setTexte('');
  }, [ouverte]);

  const trop = texte.trim().length;
  const bloque = occupe || trop < MESSAGE_BODY_MIN || trop > MESSAGE_BODY_MAX;

  const panneau = (
    <>
      <div
        style={{ position: 'fixed', inset: '0', background: 'rgba(22,33,29,.55)' }}
        data-modal-overlay=""
      />
      <div
        data-modal-panel=""
        data-fenetre-ecrire=""
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
              id="ecrire-titre"
              style={{ margin: '0', fontSize: '20px', fontWeight: 800, letterSpacing: '-0.5px' }}
            >
              Écrire à {prenom}
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

        <textarea
          value={texte}
          onChange={(event) => setTexte(event.target.value)}
          maxLength={MESSAGE_BODY_MAX}
          placeholder="Votre premier message…"
          aria-label={`Votre premier message à ${prenom}`}
          data-ecrire-message=""
          style={{
            width: '100%',
            minHeight: '120px',
            resize: 'vertical',
            background: '#F2F5F4',
            border: '1px solid #E6EBE9',
            borderRadius: '14px',
            padding: '12px',
            font: 'inherit',
            fontSize: '13.5px',
            lineHeight: '1.55',
            color: '#16211D',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />

        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={onFermer}
            disabled={occupe}
            data-ecrire-annuler=""
            style={{ ...BOUTON, background: '#F2F5F4', color: '#16211D', flex: '1' }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => onEnvoyer(texte.trim())}
            disabled={bloque}
            data-ecrire-envoyer=""
            style={{
              ...BOUTON,
              background: bloque ? '#8A958F' : '#16785E',
              color: '#fff',
              flex: '1',
              cursor: bloque ? 'default' : 'pointer',
            }}
          >
            Envoyer
          </button>
        </div>
      </div>
    </>
  );

  return (
    <Modal open={ouverte} onClose={onFermer} titleId="ecrire-titre" name="ECRIRE" mobile={panneau} />
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
