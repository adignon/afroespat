'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/modal';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « AJOUTER UN ALBUM » — IL FALLAIT UN TITRE, ET AUCUNE PLANCHE N'EN DESSINE ║
 * ║ LE CHAMP                                                                   ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Ensuite on peut ajouter un album et y ajouter des photos (les
 * modérateurs). » La route l'exige : `POST /communities/:id/albums` prend un
 * `title` OBLIGATOIRE, borné de 3 à 80 caractères (`albumTitleSchema`). Il n'y a
 * donc aucune façon de créer un album SANS titre, et un bouton qui en
 * inventerait un (« Nouvel album », « Album du 11 octobre ») nommerait à la place
 * du modérateur.
 *
 * ── CE QUI EST MESURÉ, ET POURQUOI CETTE FENÊTRE EXISTE ────────────────────
 *
 * Relevé sur les quatre cadres de l'onglet « Album » : ZÉRO champ de saisie. La
 * maquette dessine la rangée de pastilles, la grille, le bouton vert et — sur la
 * vue propriétaire — la bande de sélection « 1 photo sélectionnée · Couverture ·
 * Masquer ». Elle ne dessine nulle part le formulaire d'un nouvel album.
 * REMONTÉ : il manque une planche « nouvel album ».
 *
 * ── LE CHÂSSIS EST CELUI DE `FenetreEcrire`, QUI EST CELUI DE K08 ──────────
 *
 * Voile `rgba(22,33,29,.55)`, panneau de 440 px, trait `#DDE3E0`, rayon 28,
 * retrait 24, en-tête à croix de 40 px sur `#F2F5F4`, boutons de 44 px au rayon
 * 14. Rien de neuf, et rien d'inventé : la maquette a déjà décidé à quoi
 * ressemble une fenêtre de ce produit, et on ne lui en dessine pas une seconde.
 * Le seul écart avec `FenetreEcrire` est la nature du champ — un `<input>` d'une
 * ligne au lieu d'une zone de texte, parce qu'un titre n'a pas de paragraphes —
 * et il reprend les mesures de la zone de texte, hauteur mise à part.
 *
 * ── LES BORNES ARRIVENT EN PRISE, ELLES NE SONT PAS LUES ICI ───────────────
 *
 * `titreMin` et `titreMax` viennent de `use-reseau.ts`, qui les lit sur
 * `albumTitleSchema` — le schéma même que le serveur applique. Deux nombres
 * recopiés dans ce fichier deviendraient faux au premier ajustement, et le
 * symptôme serait un `400` que l'écran afficherait comme une panne : ce dépôt
 * l'a déjà payé quatre fois.
 *
 * ⚠ `ouverte` ET `occupe` SONT DEUX CHOSES : `occupe` éteint les deux boutons
 * pendant l'appel, et `ouverte` reste vrai — c'est le crochet qui ferme la
 * fenêtre quand la création a réussi, et qui la laisse ouverte sur un refus,
 * avec le titre déjà saisi.
 */
export function FenetreAlbum({
  ouverte,
  titreMin,
  titreMax,
  occupe = false,
  onCreer,
  onFermer,
}: {
  readonly ouverte: boolean;
  readonly titreMin: number;
  readonly titreMax: number;
  readonly occupe?: boolean;
  readonly onCreer: (titre: string) => void;
  readonly onFermer: () => void;
}) {
  const [titre, setTitre] = useState('');

  /**
   * LE CHAMP SE VIDE À CHAQUE OUVERTURE. `useState` ne lit sa valeur initiale
   * qu'au montage, et la fenêtre reste montée entre deux ouvertures : sans cet
   * effet, le titre abandonné réapparaîtrait au prochain album.
   */
  useEffect(() => {
    if (ouverte) setTitre('');
  }, [ouverte]);

  const longueur = titre.trim().length;
  const bloque = occupe || longueur < titreMin || longueur > titreMax;

  const panneau = (
    <>
      <div
        style={{ position: 'fixed', inset: '0', background: 'rgba(22,33,29,.55)' }}
        data-modal-overlay=""
      />
      <div
        data-modal-panel=""
        data-fenetre-album=""
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
              id="album-titre"
              style={{ margin: '0', fontSize: '20px', fontWeight: 800, letterSpacing: '-0.5px' }}
            >
              Nouvel album
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

        <input
          type="text"
          value={titre}
          onChange={(event) => setTitre(event.target.value)}
          maxLength={titreMax}
          placeholder="Fête de fin d’année…"
          aria-label="Le nom de l’album"
          data-album-titre=""
          style={{
            width: '100%',
            height: '44px',
            background: '#F2F5F4',
            border: '1px solid #E6EBE9',
            borderRadius: '14px',
            padding: '0 12px',
            font: 'inherit',
            fontSize: '13.5px',
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
            data-album-annuler=""
            style={{ ...BOUTON, background: '#F2F5F4', color: '#16211D', flex: '1' }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => onCreer(titre.trim())}
            disabled={bloque}
            data-album-creer=""
            style={{
              ...BOUTON,
              background: bloque ? '#8A958F' : '#16785E',
              color: '#fff',
              flex: '1',
              cursor: bloque ? 'default' : 'pointer',
            }}
          >
            Créer l’album
          </button>
        </div>
      </div>
    </>
  );

  return (
    <Modal open={ouverte} onClose={onFermer} titleId="album-titre" name="ALBUM" mobile={panneau} />
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
