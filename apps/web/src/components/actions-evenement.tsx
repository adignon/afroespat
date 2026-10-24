'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { rangFr } from '@/lib/rang';
import type { ActionsEvenement, FicheEvenement } from '@/screens/agenda/data';

/**
 * AJOUT — les cartes d'action de la fiche d'un événement (E02), aux DEUX largeurs.
 *
 * La maquette `07 Agenda` dessine, à 1 440 px, une colonne de droite : « PENDANT
 * L'ÉVÉNEMENT » (Je suis là), « COMPLET » (liste d'attente), « VUE ORGANISATEUR »
 * (cocher les présents, modifier, annuler) et « Signaler ». La planche de 390 px
 * n'en dessine AUCUNE : un téléphone n'avait ni « Je suis là », ni moyen d'annuler
 * son événement, ni de signaler. Plutôt que de câbler la colonne à 1 440 px et de
 * laisser le téléphone sans, la colonne devient CE composant, monté dans les deux
 * cadres par `tools/adaptations/agenda-vivant.mjs`.
 *
 * Aucune mesure n'est inventée : chaque style est relevé, tel quel, sur la
 * colonne de droite de E02 (carte blanche au liseré `#E6EBE9`, rayon 22, retrait
 * 18 ; titre 10,5 px / 700 / `1px` ; boutons de 44 px au rayon 14, vert `#16785E`,
 * gris `#F2F5F4` ou blanc au liseré). Le seul état que la maquette ne dessine pas
 * est « annulé » : il réemploie le terre cuite `#FBE3D4` / `#B4581F` des
 * pastilles « Vous y allez » — aucune couleur nouvelle, aucun rouge.
 *
 * LE FRONT PRÉVIENT, LE SERVEUR DÉCIDE : « Je suis là » est toujours cliquable
 * (la fenêtre H−0 → H+6 est une règle du serveur, `CHECKIN_WINDOW_CLOSED`, dont la
 * phrase s'affiche), et aucun niveau n'est lu ici.
 */
const CARTE: CSSProperties = {
  background: '#fff',
  border: '1px solid #E6EBE9',
  borderRadius: '22px',
  padding: '18px',
  flexShrink: 0,
};

const TITRE: CSSProperties = {
  fontSize: '10.5px',
  fontWeight: 700,
  letterSpacing: '1px',
  color: '#8A958F',
};

const BOUTON: CSSProperties = {
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
  whiteSpace: 'nowrap',
  flexShrink: 0,
  width: '100%',
  cursor: 'pointer',
  textDecoration: 'none',
  boxSizing: 'border-box',
};

const VERT: CSSProperties = { ...BOUTON, background: '#16785E', color: '#fff' };
const GRIS: CSSProperties = { ...BOUTON, background: '#F2F5F4', color: '#16211D' };
const BLANC: CSSProperties = { ...BOUTON, background: '#fff', color: '#16211D', border: '1px solid #E6EBE9' };

const NOTE: CSSProperties = { fontSize: '11.5px', color: '#8A958F', marginTop: '6px' };

const COCHE = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 12 4.5 4.5L19 7" />
  </svg>
);

const CRAYON = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20h4L19 9l-4-4L4 16z" />
  </svg>
);

const DRAPEAU = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5D6B66" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 21V4h12l-2 4 2 4H5" />
  </svg>
);

export function ActionsEvenementCartes({
  evenement,
  actions,
  complet,
  attente,
  organisateur,
  presence,
  mobile = false,
}: {
  readonly evenement: FicheEvenement;
  readonly actions: ActionsEvenement;
  readonly complet: boolean;
  readonly attente: number | null;
  readonly organisateur: boolean;
  readonly presence: { readonly debut: string; readonly fin: string };
  /** À 390 px, les cartes se posent sous la fiche, dans la gouttière de 16 px. */
  readonly mobile?: boolean;
}) {
  const annule = evenement.annule !== null;
  const participe =
    evenement.monStatut === 'GOING' ||
    evenement.monStatut === 'MAYBE' ||
    evenement.monStatut === 'WAITLIST';
  const surListe = evenement.monStatut === 'WAITLIST';

  return (
    <div
      data-actions-evenement=""
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        ...(mobile ? { padding: '14px 0 0' } : {}),
      }}
    >
      {evenement.annule === null ? null : (
        <div
          role="status"
          data-evenement-annule=""
          style={{ ...CARTE, background: '#FBE3D4', border: 'none' }}
        >
          <div style={{ ...TITRE, color: '#B4581F' }}>ÉVÉNEMENT ANNULÉ</div>
          <div style={{ fontSize: '13px', lineHeight: 1.5, color: '#16211D', marginTop: '8px' }}>
            {evenement.annule.motif === null
              ? 'L’organisateur a annulé cet événement.'
              : evenement.annule.motif}
          </div>
        </div>
      )}

      {actions.retour === '' ? null : (
        <div role="status" data-evenement-retour="" style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F5C48' }}>
          {actions.retour}
        </div>
      )}

      {annule || !participe || organisateur ? null : (
        <div style={CARTE}>
          <div style={TITRE}>PENDANT L’ÉVÉNEMENT</div>
          <button
            type="button"
            onClick={actions.onPresent}
            disabled={actions.occupe}
            data-evenement-present=""
            style={{ ...VERT, marginTop: '10px', opacity: actions.occupe ? 0.6 : 1 }}
          >
            {COCHE}Je suis là
          </button>
          <div style={NOTE}>
            Actif de {presence.debut} à {presence.fin}
          </div>
        </div>
      )}

      {annule || !complet || evenement.monStatut === 'GOING' ? null : (
        <div style={CARTE}>
          <div style={TITRE}>COMPLET</div>
          <div style={{ marginTop: '10px' }}>
            <button
              type="button"
              onClick={surListe ? actions.onRetirer : () => actions.onRsvp('GOING')}
              disabled={actions.occupe}
              data-evenement-attente=""
              style={{ ...GRIS, opacity: actions.occupe ? 0.6 : 1 }}
            >
              {surListe ? 'Quitter la liste d’attente' : 'Rejoindre la liste d’attente'}
            </button>
          </div>
          {attente === null ? null : <div style={NOTE}>Vous êtes {rangFr(attente)} sur la liste d’attente</div>}
        </div>
      )}

      {organisateur && !annule ? (
        <div style={CARTE}>
          <div style={TITRE}>VUE ORGANISATEUR</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
            <Link href={actions.presenceHref} data-evenement-presences="" style={VERT}>
              {COCHE}Cocher les présents
            </Link>
            {evenement.commence ? null : (
              <button type="button" onClick={actions.onModifier} data-evenement-modifier="" style={GRIS}>
                {CRAYON}Modifier
              </button>
            )}
            <button
              type="button"
              onClick={actions.onAnnuler}
              disabled={actions.occupe}
              data-evenement-annuler=""
              style={BLANC}
            >
              Annuler l’événement
            </button>
          </div>
        </div>
      ) : null}

      {!annule && participe && !organisateur && !evenement.commence ? (
        <button
          type="button"
          onClick={actions.onRetirer}
          disabled={actions.occupe}
          data-evenement-retirer=""
          style={{
            border: 'none',
            background: 'none',
            padding: 0,
            font: 'inherit',
            fontSize: '12.5px',
            fontWeight: 700,
            color: '#5D6B66',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          Retirer ma participation
        </button>
      ) : null}

      {organisateur ? null : (
        <button
          type="button"
          onClick={actions.onSignaler}
          data-evenement-signaler=""
          style={{
            border: 'none',
            background: 'none',
            padding: 0,
            font: 'inherit',
            fontSize: '12.5px',
            fontWeight: 700,
            color: '#5D6B66',
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
            cursor: 'pointer',
          }}
        >
          {DRAPEAU}Signaler
        </button>
      )}
    </div>
  );
}
