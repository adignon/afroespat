'use client';

import type { CSSProperties } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { Modal } from '@/components/modal';
import { PanneauFenetre } from '@/components/panneau-fenetre';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES TROIS FENÊTRES DU RÉSEAU QUE LA MAQUETTE NE DESSINE PAS EN PLANCHE      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * « Nouveau sujet », « Épingler » et « Voir » un signalement sont dessinés comme
 * BOUTONS sur les planches du réseau, et aucune planche ne dessine ce qu'ils
 * ouvrent. Les trois gestes ont pourtant une route — `POST
 * /communities/:id/topics`, `PATCH /topics/:id { pinKind }`, et l'extrait que
 * `GET /communities/:id/reports` rend déjà. Le porteur a demandé qu'ils marchent.
 *
 * Elles sont donc bâties sur le CHÂSSIS de fenêtre du dépôt — `PanneauFenetre`,
 * déjà employé par « Choisir » et « Numéro » — et non dessinées ici : voile,
 * rayon 28, en-tête et croix sont les siens. Les champs reprennent ceux de
 * `FenetreAlbum` (fond `#F2F5F4`, rayon 14), les boutons ceux de ses actions.
 * REMONTÉ : une planche par fenêtre serait plus juste.
 *
 * ⚠ CHACUNE EST POSÉE UNE SEULE FOIS PAR L'ÉCRAN, hors des deux cadres — la
 * leçon `ScreenFrames` + portail déjà mesurée sur `FenetreConfirmation`.
 */

const CHAMP: CSSProperties = {
  width: '100%',
  background: '#F2F5F4',
  border: '1px solid #E6EBE9',
  borderRadius: '14px',
  padding: '12px',
  font: 'inherit',
  fontSize: '13.5px',
  color: '#16211D',
  outline: 'none',
  boxSizing: 'border-box',
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
  cursor: 'pointer',
  flex: '1',
};

// ── « Nouveau sujet » ─────────────────────────────────────────────────────────

/**
 * Les bornes viennent de `topicTitleSchema` / `topicBodySchema` — lues par
 * l'appelant, jamais recopiées ici.
 */
export function FenetreSujet({
  ouverte,
  titreMin,
  titreMax,
  corpsMax,
  occupe,
  onCreer,
  onFermer,
}: {
  readonly ouverte: boolean;
  readonly titreMin: number;
  readonly titreMax: number;
  readonly corpsMax: number;
  readonly occupe: boolean;
  readonly onCreer: (titre: string, corps: string) => void;
  readonly onFermer: () => void;
}) {
  const [titre, setTitre] = useState('');
  const [corps, setCorps] = useState('');
  const [vue, setVue] = useState(ouverte);
  if (vue !== ouverte) {
    setVue(ouverte);
    if (ouverte) {
      setTitre('');
      setCorps('');
    }
  }
  const bloque = occupe || titre.trim().length < titreMin || corps.trim() === '';

  const panneau = (
    <PanneauFenetre
      titreId="sujet-titre"
      titre="Nouveau sujet"
      largeur="520px"
      actions={
        <>
          <button
            type="button"
            onClick={onFermer}
            style={{ ...BOUTON, background: '#F2F5F4', color: '#16211D' }}
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={bloque}
            data-sujet-creer=""
            onClick={() => {
              onCreer(titre.trim(), corps.trim());
            }}
            style={{
              ...BOUTON,
              background: bloque ? '#8A958F' : '#16785E',
              color: '#fff',
              cursor: bloque ? 'default' : 'pointer',
            }}
          >
            Publier le sujet
          </button>
        </>
      }
    >
      <input
        type="text"
        value={titre}
        maxLength={titreMax}
        onChange={(e) => {
          setTitre(e.target.value);
        }}
        placeholder="Votre question ou le sujet à ouvrir"
        aria-label="Le titre du sujet"
        data-sujet-titre=""
        style={{ ...CHAMP, height: '46px' }}
      />
      <textarea
        value={corps}
        maxLength={corpsMax}
        onChange={(e) => {
          setCorps(e.target.value);
        }}
        placeholder="Donnez le contexte : ce que vous avez déjà essayé, ce que vous cherchez…"
        aria-label="Le détail du sujet"
        data-sujet-corps=""
        style={{ ...CHAMP, minHeight: '140px', resize: 'vertical', lineHeight: 1.55 }}
      />
    </PanneauFenetre>
  );

  return <Modal open={ouverte} onClose={onFermer} titleId="sujet-titre" name="SUJET" mobile={panneau} />;
}

// ── « Épingler » ──────────────────────────────────────────────────────────────

export interface SujetEpinglable {
  readonly id: string;
  readonly titre: string;
  readonly epingle: boolean;
}

/**
 * §2.3 : « épinglés en tête, 5 maximum ». Le plafond est celui du serveur
 * (`COMMUNITY_MAX_PINNED_TOPICS`), passé par l'appelant ; au-delà, le serveur
 * répond `PIN_LIMIT` et son message s'affiche.
 */
export function FenetreEpingler({
  ouverte,
  sujets,
  max,
  occupe,
  onBasculer,
  onFermer,
}: {
  readonly ouverte: boolean;
  readonly sujets: readonly SujetEpinglable[];
  readonly max: number;
  readonly occupe: boolean;
  readonly onBasculer: (id: string, epingler: boolean) => void;
  readonly onFermer: () => void;
}) {
  const nombre = sujets.filter((s) => s.epingle).length;
  const panneau = (
    <PanneauFenetre
      titreId="epingler-titre"
      titre="Épingler en tête"
      enTete={
        <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#8A958F' }}>
          {nombre} / {max}
        </span>
      }
    >
      {sujets.length === 0 ? (
        <p style={{ margin: 0, fontSize: '13px', color: '#5D6B66' }}>
          Aucun sujet dans ce réseau pour le moment : ouvrez-en un depuis l’onglet « Sujets ».
        </p>
      ) : (
        sujets.map((s) => (
          <div
            key={s.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 0',
              borderBottom: '1px solid #F0F3F2',
            }}
          >
            <span style={{ flex: '1', minWidth: 0, fontSize: '13.5px', fontWeight: 700 }}>
              {s.titre}
            </span>
            <button
              type="button"
              disabled={occupe || (!s.epingle && nombre >= max)}
              data-sujet-epingler=""
              aria-pressed={s.epingle}
              onClick={() => {
                onBasculer(s.id, !s.epingle);
              }}
              style={{
                height: '36px',
                padding: '0 14px',
                borderRadius: '12px',
                border: s.epingle ? 'none' : '1px solid #E6EBE9',
                background: s.epingle ? '#16785E' : '#fff',
                color: s.epingle ? '#fff' : '#16211D',
                font: 'inherit',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: occupe ? 'default' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {s.epingle ? 'Épinglé' : 'Épingler'}
            </button>
          </div>
        ))
      )}
    </PanneauFenetre>
  );
  return (
    <Modal open={ouverte} onClose={onFermer} titleId="epingler-titre" name="EPINGLER" mobile={panneau} />
  );
}

// ── « Voir » un signalement ───────────────────────────────────────────────────

export interface ContenuSignale {
  readonly subjectType: string;
  readonly subjectId: string;
  readonly titre: string;
  readonly sous: string;
  readonly extrait: string;
  readonly href: string;
  readonly masque: boolean;
}

/**
 * « Voir » menait au sujet quand c'en était un, et s'éteignait pour une
 * publication ou un commentaire — il n'existe aucune page pour eux (relevé
 * sur l'arborescence de `app/(app)`). La fenêtre montre l'EXTRAIT que la file
 * de signalements porte déjà (`extrait`), et la décision se prend d'ici.
 */
export function FenetreContenuSignale({
  contenu,
  occupe,
  onMasquer,
  onConserver,
  onFermer,
}: {
  readonly contenu: ContenuSignale | null;
  readonly occupe: boolean;
  readonly onMasquer: (subjectType: string, subjectId: string) => void;
  readonly onConserver: (subjectType: string, subjectId: string) => void;
  readonly onFermer: () => void;
}) {
  const panneau =
    contenu === null ? (
      <span />
    ) : (
      <PanneauFenetre
        titreId="signale-titre"
        titre="Contenu signalé"
        actions={
          <>
            <button
              type="button"
              disabled={occupe}
              onClick={() => {
                onConserver(contenu.subjectType, contenu.subjectId);
                onFermer();
              }}
              style={{
                ...BOUTON,
                background: '#fff',
                color: '#16211D',
                border: '1px solid #E6EBE9',
              }}
            >
              Conserver
            </button>
            <button
              type="button"
              disabled={occupe || contenu.masque}
              onClick={() => {
                onMasquer(contenu.subjectType, contenu.subjectId);
                onFermer();
              }}
              style={{
                ...BOUTON,
                background: '#16211D',
                color: '#fff',
                cursor: occupe || contenu.masque ? 'default' : 'pointer',
                opacity: contenu.masque ? 0.55 : 1,
              }}
            >
              {contenu.masque ? 'Déjà masqué' : 'Masquer'}
            </button>
          </>
        }
      >
        <div style={{ fontSize: '13.5px', fontWeight: 700 }}>{contenu.titre}</div>
        <div style={{ fontSize: '12px', color: '#5D6B66' }}>{contenu.sous}</div>
        <blockquote
          style={{
            margin: 0,
            background: '#F6F8F7',
            borderRadius: '16px',
            padding: '14px 16px',
            fontSize: '14px',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
          }}
        >
          {contenu.extrait === '' ? 'Le contenu n’est plus disponible.' : contenu.extrait}
        </blockquote>
        {contenu.href === '' ? null : (
          <Link
            href={contenu.href}
            style={{ fontSize: '13px', fontWeight: 700, color: '#16785E', textDecoration: 'none' }}
          >
            Ouvrir le sujet
          </Link>
        )}
      </PanneauFenetre>
    );
  return (
    <Modal
      open={contenu !== null}
      onClose={onFermer}
      titleId="signale-titre"
      name="SIGNALE"
      mobile={panneau}
    />
  );
}
