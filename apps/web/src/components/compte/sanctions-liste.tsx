'use client';

import { useState, type CSSProperties } from 'react';
import {
  APPEAL_RESPONSE_HOURS,
  APPEAL_TEXT_MAX,
  APPEAL_TEXT_MIN,
  type Capability,
} from '@app/shared';
import { z } from 'zod';
import { FenetreNiveau } from '@/components/fenetre-niveau';
import { notifySuccess } from '@/components/notifications';
import { ApiError, memberApi } from '@/lib/api/index';
import { useCapacites } from '@/lib/capacites';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT (hors maquette) — LA LISTE DES SANCTIONS DE K09, ET « CONTESTER »    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Constat de l'audit (K09, 1440 et 390 px) : la planche dessinait une carte
 * « Avertissement · Pas de publicité sans accord · 3 mars 2026 » ÉCRITE EN DUR
 * (donc affichée à un compte sans sanction), un bouton « Contester » sans
 * gestionnaire, une seconde carte alimentée par la seule dernière sanction, et —
 * sur ordinateur seulement — une carte de contestation unique, détachée des
 * sanctions. Deux états contradictoires se côtoyaient (« Aucune sanction » et
 * « Rien à contester »).
 *
 * Ce composant les remplace par UNE carte par sanction de `GET /me/sanctions`, aux
 * mesures de la carte dessinée (rayon 22, trait `#E6EBE9`, rond d'icône de 40 px,
 * pastille d'état orange `#FBE3D4`/`#B4581F`, bouton gris `#F2F5F4` de 38 px — 34
 * px à 390 px), et le formulaire de contestation s'ouvre DANS la carte :
 *
 *   · « Contester » n'est offert que si le SERVEUR dit `appealable` (13 §4.3 : un
 *     seul recours par sanction) — le front ne le déduit pas ;
 *   · le texte est borné par `APPEAL_TEXT_MIN` / `APPEAL_TEXT_MAX` de
 *     `@app/shared`, comme `appealSchema` côté serveur : le bouton « Envoyer »
 *     reste éteint en dessous du minimum, plutôt que de gâcher dans l'esprit du
 *     membre l'unique tentative sur un refus ;
 *   · « Réponse d'un modérateur sous 72 h » est la promesse de la maquette
 *     (`APPEAL_RESPONSE_HOURS`) ;
 *   · une fois envoyée, la carte affiche « Recours en cours » (le serveur le dit
 *     ensuite lui-même via `appeal: 'PENDING'`), puis « Recours examiné » quand
 *     un autre modérateur a retranché : « décision finale non contestable » ;
 *   · États : envoi en cours, erreur du serveur dite dans la carte (jamais en
 *     rouge : la maquette n'en a pas), niveau insuffisant → l'invitation de
 *     `FenetreNiveau` (contester demande N2, `sanction.appeal`).
 *
 * Aucune sanction est le cas normal : la carte le dit, une fois, et ne propose
 * rien.
 */
export interface SanctionCarte {
  readonly id: string;
  readonly type: string;
  readonly regle: string;
  readonly date: string;
  readonly active: boolean;
  readonly appealable: boolean;
  readonly appeal: 'NONE' | 'PENDING' | 'DECIDED';
}

const CARTE: CSSProperties = {
  background: '#fff',
  border: '1px solid #E6EBE9',
  borderRadius: '22px',
  padding: '18px',
  flexShrink: 0,
};

const PASTILLE: CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  padding: '4px 10px',
  borderRadius: '999px',
  whiteSpace: 'nowrap',
};

function IconeSanction() {
  return (
    <span
      style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#F2F5F4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16211D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 21V4h12l-2 4 2 4H5" />
      </svg>
    </span>
  );
}

function LigneSanction({
  s,
  compact,
  onRecharger,
  onNiveau,
}: {
  readonly s: SanctionCarte;
  readonly compact: boolean;
  readonly onRecharger: () => void;
  readonly onNiveau: (c: Capability) => void;
}) {
  const [ouverte, setOuverte] = useState(false);
  const [texte, setTexte] = useState('');
  const [enVol, setEnVol] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoyee, setEnvoyee] = useState(false);
  const { peut } = useCapacites();

  const appeal = envoyee && s.appeal === 'NONE' ? 'PENDING' : s.appeal;
  const longueur = texte.trim().length;
  const trop = longueur < APPEAL_TEXT_MIN;

  const envoyer = () => {
    if (enVol || trop) return;
    if (!peut('sanction.appeal')) {
      onNiveau('sanction.appeal');
      return;
    }
    setEnVol(true);
    setErreur(null);
    memberApi
      .post(`/sanctions/${s.id}/appeal`, z.unknown(), { body: { text: texte.trim() } })
      .then(() => {
        setEnvoyee(true);
        setOuverte(false);
        setTexte('');
        notifySuccess(`Recours envoyé. Réponse d’un modérateur sous ${APPEAL_RESPONSE_HOURS} h.`);
        onRecharger();
      })
      .catch((cause: unknown) => {
        if (cause instanceof ApiError && cause.code === 'LEVEL_REQUIRED') {
          onNiveau('sanction.appeal');
        } else if (cause instanceof ApiError && cause.code === 'ALREADY_APPEALED') {
          setEnvoyee(true);
          setOuverte(false);
          onRecharger();
        } else {
          setErreur(
            cause instanceof ApiError ? cause.displayMessage : 'Le recours n’a pas pu être envoyé. Réessayez.',
          );
        }
      })
      .finally(() => {
        setEnVol(false);
      });
  };

  const pastille =
    appeal === 'PENDING'
      ? { libelle: 'Recours en cours', fond: '#FBE3D4', encre: '#B4581F' }
      : appeal === 'DECIDED'
        ? { libelle: 'Recours examiné', fond: '#F2F5F4', encre: '#5D6B66' }
        : s.active
          ? { libelle: 'En vigueur', fond: '#FBE3D4', encre: '#B4581F' }
          : { libelle: 'Terminée', fond: '#F2F5F4', encre: '#5D6B66' };

  const actions = (
    <>
        <span style={{ ...PASTILLE, background: pastille.fond, color: pastille.encre }} data-sanction-etat="">
          {pastille.libelle}
        </span>
        {s.appealable && !envoyee ? (
          <button
            type="button"
            onClick={() => {
              setOuverte((o) => !o);
            }}
            aria-expanded={ouverte}
            data-sanction-contester=""
            style={{ height: compact ? '34px' : '38px', padding: compact ? '0 10px' : '0 18px', borderRadius: '14px', background: '#F2F5F4', color: '#16211D', border: 'none', font: 'inherit', fontSize: '13.5px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap', flexShrink: 0, cursor: 'pointer' }}
          >
            {ouverte ? 'Fermer' : 'Contester'}
          </button>
        ) : null}
    </>
  );

  return (
    <div style={CARTE} data-sanction="" data-sanction-appeal={appeal}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <IconeSanction />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '15px', fontWeight: 700 }}>{s.type}</div>
          <div style={{ fontSize: '12.5px', color: '#5D6B66' }}>
            Règle : {s.regle} · {s.date}
          </div>
        </div>
        {compact ? null : actions}
      </div>
      {compact ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', justifyContent: 'space-between' }}>{actions}</div>
      ) : null}
      {ouverte && s.appealable && !envoyee ? (
        <div style={{ marginTop: '14px', borderTop: '1px solid #E6EBE9', paddingTop: '14px' }} data-sanction-formulaire="">
          <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '1px', color: '#8A958F' }}>
            CONTESTER · UNE SEULE FOIS
          </div>
          <label htmlFor={`recours-${s.id}`} style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, margin: '10px 0 6px' }}>
            Expliquez votre point de vue
          </label>
          <textarea
            id={`recours-${s.id}`}
            value={texte}
            onChange={(e) => {
              setTexte(e.target.value);
            }}
            rows={4}
            maxLength={APPEAL_TEXT_MAX}
            disabled={enVol}
            data-sanction-texte=""
            style={{ minHeight: '48px', borderRadius: '14px', border: '1.5px solid #16785E', background: '#fff', padding: '13px 14px', fontSize: '14px', lineHeight: '1.5', width: '100%', boxSizing: 'border-box', resize: 'vertical', outline: 'none', fontFamily: 'inherit', color: '#16211D' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '12px', color: '#8A958F', marginTop: '6px' }}>
            <span>{trop ? `Au moins ${APPEAL_TEXT_MIN} caractères.` : ' '}</span>
            <span>
              {longueur} / {APPEAL_TEXT_MAX}
            </span>
          </div>
          {erreur === null ? null : (
            <div role="alert" style={{ marginTop: '8px', fontSize: '12.5px', fontWeight: 700, color: '#B4581F' }} data-sanction-erreur="">
              {erreur}
            </div>
          )}
          <button
            type="button"
            onClick={envoyer}
            disabled={enVol || trop}
            data-sanction-envoyer=""
            style={{ height: '44px', padding: '0 18px', borderRadius: '14px', color: '#fff', border: 'none', font: 'inherit', fontSize: '13.5px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap', width: '100%', marginTop: '12px', background: enVol || trop ? '#8A958F' : '#16785E', cursor: enVol || trop ? 'default' : 'pointer' }}
          >
            {enVol ? 'Envoi…' : 'Envoyer ma contestation'}
          </button>
          <div style={{ fontSize: '12px', color: '#8A958F', marginTop: '8px' }}>
            Réponse d’un modérateur sous {APPEAL_RESPONSE_HOURS} h.
          </div>
        </div>
      ) : null}
      {appeal === 'PENDING' ? (
        <div style={{ fontSize: '12.5px', color: '#5D6B66', marginTop: '10px' }} data-sanction-note="">
          Un autre modérateur relit votre dossier : réponse sous {APPEAL_RESPONSE_HOURS} h.
        </div>
      ) : appeal === 'DECIDED' ? (
        <div style={{ fontSize: '12.5px', color: '#5D6B66', marginTop: '10px' }} data-sanction-note="">
          Votre recours a été examiné. La décision est définitive.
        </div>
      ) : null}
    </div>
  );
}

/** Les cartes de K09, ou l'unique état vide. `compact` : le cadre de 390 px. */
export function SanctionsListe({
  sanctions,
  compact,
  onRecharger,
}: {
  readonly sanctions: readonly SanctionCarte[];
  readonly compact: boolean;
  readonly onRecharger: () => void;
}) {
  const [niveauRefuse, setNiveauRefuse] = useState<Capability | null>(null);
  return (
    <>
      <FenetreNiveau
        capacite={niveauRefuse}
        onFermer={() => {
          setNiveauRefuse(null);
        }}
      />
      {sanctions.length === 0 ? (
        <div style={CARTE} data-sanctions-vide="">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <IconeSanction />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '15px', fontWeight: 700 }}>Aucune sanction</div>
              <div style={{ fontSize: '12.5px', color: '#5D6B66' }}>
                Votre compte est en règle : il n’y a rien à contester.
              </div>
            </div>
          </div>
        </div>
      ) : (
        sanctions.map((s) => (
          <LigneSanction
            key={s.id}
            s={s}
            compact={compact}
            onRecharger={onRecharger}
            onNiveau={setNiveauRefuse}
          />
        ))
      )}
    </>
  );
}
