'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { GuideProposalView } from '@app/shared';
import { EtatVide } from '@/components/etat-vide';
import { diffMots, type SegmentDiff } from '@/lib/diff-mots';
import { avatarColor, initials } from '@/screens/accueil/from-api';
import { delaiAvantEscalade, joursAvantEscalade } from '@/screens/guides/from-api';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ A06 — LES PROPOSITIONS REÇUES, EN NOMBRE RÉEL (AJOUT, lot G)              ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La planche dessine DEUX emplacements fixes — une proposition dépliée, une
 * repliée — dont le texte « AVANT / APRÈS » (« quel que soit leur pays
 * d'origine… »), le nom de section (« Section 1 · Vérifier votre éligibilité ») et
 * l'onglet « Refusées · 1 » sont écrits en dur. Avec zéro proposition l'écran
 * montrait deux cartes « Aucune proposition » ; avec une, une carte vide ; avec
 * trois ou plus, les deux premières seulement.
 *
 * Cette liste rend AUTANT de cartes que le serveur en donne, dans le dessin exact
 * des cartes de la planche (rayon 22, retraits, pastilles de délai, boutons
 * Accepter / Accepter en modifiant / Refuser), avec :
 *
 *   · le DIFF réel : les mots retirés barrés à gauche, les mots ajoutés surlignés à
 *     droite (`diffMots`, testé) — avec les teintes `#EDF1EF` et `#CFE3DA` de la
 *     planche ;
 *   · un état VIDE par onglet ;
 *   · les trois onglets en gestes réels (« En attente », « Acceptées », « Refusées »).
 *
 * ── CE QUE LA ROUTE NE DONNE PAS, ET QUI N'EST PAS INVENTÉ ───────────────────
 *
 *   · LE NOM DE SECTION : `GuideProposalView` ne porte que l'extrait visé, jamais
 *     la page ou la section — la ligne est donc absente, pas remplacée par une
 *     donnée plausible. REMONTÉ ;
 *   · LES REFUSÉES : `GET /guides/:id/proposals` ne les rend à personne d'autre que
 *     leur auteur (05 §4). L'onglet existe, dit pourquoi il est vide, et n'affiche
 *     aucun compteur — la planche en dessinait un en dur.
 *
 * Le front PRÉVIENT, le serveur DÉCIDE : les trois boutons ouvrent les fenêtres de
 * la page, qui appellent les routes de décision.
 */
export type OngletProposition = 'ATTENTE' | 'ACCEPTEES' | 'REFUSEES';

type Decision = 'ACCEPT' | 'AMEND' | 'REJECT';

interface Contexte {
  readonly items: readonly GuideProposalView[];
  readonly onglet: OngletProposition;
  readonly setOnglet: (o: OngletProposition) => void;
  readonly decidable: boolean;
  readonly onDecision: (kind: Decision, proposition: GuideProposalView) => void;
  readonly chargement: boolean;
}

const Ctx = createContext<Contexte | null>(null);

function utiliser(): Contexte {
  const c = useContext(Ctx);
  if (c === null) throw new Error('PropositionsRecues : hors de PropositionsProvider.');
  return c;
}

const enAttente = (p: GuideProposalView): boolean => p.status === 'PENDING' || p.status === 'ESCALATED';
const acceptee = (p: GuideProposalView): boolean => p.status === 'ACCEPTED' || p.status === 'AMENDED';

export function PropositionsProvider({
  items,
  decidable,
  chargement,
  onDecision,
  children,
}: {
  readonly items: readonly GuideProposalView[];
  readonly decidable: boolean;
  readonly chargement: boolean;
  readonly onDecision: (kind: Decision, proposition: GuideProposalView) => void;
  readonly children: ReactNode;
}) {
  const [onglet, setOnglet] = useState<OngletProposition>('ATTENTE');
  const valeur = useMemo(
    () => ({ items, onglet, setOnglet, decidable, onDecision, chargement }),
    [items, onglet, decidable, onDecision, chargement],
  );
  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>;
}

// ─── Les onglets ───────────────────────────────────────────────────────────

export function OngletsPropositions({ largeur }: { readonly largeur: 'desktop' | 'mobile' }) {
  const c = utiliser();
  const mobile = largeur === 'mobile';
  const nAttente = c.items.filter(enAttente).length;
  const nAcceptees = c.items.filter(acceptee).length;
  const onglets: readonly { id: OngletProposition; libelle: string }[] = [
    { id: 'ATTENTE', libelle: `En attente · ${String(nAttente)}` },
    { id: 'ACCEPTEES', libelle: `Acceptées · ${String(nAcceptees)}` },
    { id: 'REFUSEES', libelle: 'Refusées' },
  ];

  return (
    <div
      role="tablist"
      aria-label="Propositions"
      data-onglets-propositions=""
      style={
        mobile
          ? { display: 'flex', gap: '6px', marginTop: '12px' }
          : {
              display: 'flex',
              gap: '4px',
              background: '#EEF2F0',
              borderRadius: '14px',
              padding: '4px',
              alignSelf: 'flex-start',
            }
      }
    >
      {onglets.map((o) => {
        const actif = c.onglet === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={actif}
            data-onglet-proposition={o.id}
            onClick={() => {
              c.setOnglet(o.id);
            }}
            style={
              mobile
                ? {
                    padding: '8px 13px',
                    borderRadius: '999px',
                    background: actif ? '#16785E' : '#fff',
                    color: actif ? '#fff' : '#16211D',
                    border: actif ? 'none' : '1px solid #E6EBE9',
                    font: 'inherit',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }
                : {
                    padding: '9px 16px',
                    borderRadius: '11px',
                    border: 'none',
                    font: 'inherit',
                    fontSize: '13px',
                    fontWeight: 700,
                    background: actif ? '#fff' : 'transparent',
                    color: actif ? '#16211D' : '#5D6B66',
                    cursor: 'pointer',
                  }
            }
          >
            {o.libelle}
          </button>
        );
      })}
    </div>
  );
}

// ─── La liste ──────────────────────────────────────────────────────────────

function Segments({ segments, retire }: { readonly segments: readonly SegmentDiff[]; readonly retire: boolean }) {
  return (
    <>
      {segments.map((s, i) =>
        s.change ? (
          <span
            key={i}
            data-diff={retire ? 'retire' : 'ajoute'}
            style={
              retire
                ? { background: '#EDF1EF', textDecoration: 'line-through', color: '#5D6B66' }
                : { background: '#CFE3DA', borderRadius: '3px' }
            }
          >
            {s.texte}
          </span>
        ) : (
          <span key={i}>{s.texte}</span>
        ),
      )}
    </>
  );
}

function CarteProposition({
  p,
  mobile,
}: {
  readonly p: GuideProposalView;
  readonly mobile: boolean;
}) {
  const c = utiliser();
  const rond = { i: initials(p.proposer.displayName), bg: avatarColor(p.proposer.handle) };
  const diff = useMemo(() => diffMots(p.targetExcerpt, p.replacement), [p.targetExcerpt, p.replacement]);
  const attend = enAttente(p);
  const delai = attend
    ? mobile
      ? joursAvantEscalade(p.escalateAt) === 0
        ? 'Dépassé'
        : `${String(joursAvantEscalade(p.escalateAt))} j`
      : delaiAvantEscalade(p.escalateAt)
    : p.status === 'AMENDED'
      ? 'Acceptée avec modifications'
      : 'Acceptée';
  const pastille = attend
    ? { background: '#FBE3D4', color: '#B4581F' }
    : { background: '#E3F0EB', color: '#0F5C48' };
  const taille = mobile ? 30 : 34;
  const decider = (kind: Decision) => () => {
    c.onDecision(kind, p);
  };
  const bouton = (kind: Decision, repere: string, libelle: string, style: Record<string, string | number>) => (
    <button
      type="button"
      onClick={decider(kind)}
      disabled={!c.decidable}
      data-proposition-repere={repere}
      style={{
        font: 'inherit',
        ...style,
        border: style['border'] ?? 'none',
        cursor: c.decidable ? 'pointer' : 'default',
        opacity: c.decidable ? 1 : 0.55,
      }}
    >
      {libelle}
    </button>
  );

  return (
    <div
      data-proposition={p.id}
      style={{
        background: '#fff',
        border: '1px solid #E6EBE9',
        borderRadius: mobile ? '20px' : '22px',
        padding: mobile ? '16px' : '20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: mobile ? '8px' : '10px' }}>
        <span
          style={{
            width: `${String(taille)}px`,
            height: `${String(taille)}px`,
            borderRadius: '999px',
            background: rond.bg,
            color: '#fff',
            fontSize: mobile ? '10px' : '10.5px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {rond.i}
        </span>
        <span style={{ fontSize: mobile ? '13.5px' : '14px', fontWeight: 700, flex: mobile ? 1 : undefined }}>
          {p.proposer.displayName}
        </span>
        {mobile ? null : <span style={{ flex: 1 }} />}
        <span
          style={{
            ...pastille,
            fontSize: mobile ? '11px' : '11.5px',
            fontWeight: 700,
            padding: mobile ? '4px 9px' : '5px 11px',
            borderRadius: '999px',
          }}
        >
          {delai}
        </span>
      </div>
      <div
        style={
          mobile
            ? { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }
            : { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '14px' }
        }
      >
        <div style={{ background: '#F6F8F7', borderRadius: mobile ? '14px' : '16px', padding: mobile ? '12px' : '14px' }}>
          <div style={{ fontSize: mobile ? '10px' : '10.5px', fontWeight: 700, letterSpacing: '1px', color: '#8A958F' }}>
            AVANT
          </div>
          <div style={{ fontSize: mobile ? '13.5px' : '14px', lineHeight: mobile ? 1.55 : 1.6, marginTop: mobile ? '4px' : '6px', whiteSpace: 'pre-wrap' }}>
            <Segments segments={diff.avant} retire />
          </div>
        </div>
        <div style={{ background: '#EFF7F3', borderRadius: mobile ? '14px' : '16px', padding: mobile ? '12px' : '14px' }}>
          <div style={{ fontSize: mobile ? '10px' : '10.5px', fontWeight: 700, letterSpacing: '1px', color: '#16785E' }}>
            APRÈS
          </div>
          <div style={{ fontSize: mobile ? '13.5px' : '14px', lineHeight: mobile ? 1.55 : 1.6, marginTop: mobile ? '4px' : '6px', whiteSpace: 'pre-wrap' }}>
            {p.replacement === '' ? (
              <em style={{ color: '#5D6B66' }}>Passage retiré du guide.</em>
            ) : (
              <Segments segments={diff.apres} retire={false} />
            )}
          </div>
        </div>
      </div>
      <div style={{ fontSize: mobile ? '12.5px' : '13px', color: '#5D6B66', marginTop: mobile ? '10px' : '12px' }}>
        <strong style={{ color: '#16211D' }}>Motif :</strong> {p.reason}
        {p.sourceUrl === null ? null : (
          <>
            {' · '}
            <a href={p.sourceUrl} target="_blank" rel="nofollow ugc noopener noreferrer" style={{ fontWeight: 700 }}>
              Source
            </a>
          </>
        )}
      </div>
      {attend ? (
        <div
          style={
            mobile
              ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px' }
              : { display: 'flex', gap: '8px', marginTop: '16px' }
          }
        >
          {bouton('ACCEPT', 'accepter', 'Accepter', {
            height: '44px',
            ...(mobile ? { borderRadius: '12px' } : { padding: '0 18px', borderRadius: '14px' }),
            background: '#16785E',
            color: '#fff',
            fontSize: '13.5px',
            fontWeight: 700,
          })}
          {mobile
            ? bouton('REJECT', 'refuser', 'Refuser', {
                height: '44px',
                borderRadius: '12px',
                background: '#F2F5F4',
                color: '#5D6B66',
                fontSize: '13.5px',
                fontWeight: 700,
              })
            : bouton('AMEND', 'amender', 'Accepter en modifiant', {
                height: '44px',
                padding: '0 18px',
                borderRadius: '14px',
                background: '#fff',
                color: '#0F5C48',
                border: '1.5px solid #CFE3DA',
                fontSize: '13.5px',
                fontWeight: 700,
              })}
          {mobile
            ? null
            : bouton('REJECT', 'refuser', 'Refuser', {
                height: '44px',
                padding: '0 18px',
                borderRadius: '14px',
                background: '#F2F5F4',
                color: '#5D6B66',
                fontSize: '13.5px',
                fontWeight: 700,
              })}
        </div>
      ) : null}
      {attend && mobile
        ? bouton('AMEND', 'amender', 'Accepter en modifiant', {
            width: '100%',
            height: '42px',
            marginTop: '8px',
            borderRadius: '12px',
            background: '#fff',
            color: '#0F5C48',
            border: '1.5px solid #CFE3DA',
            fontSize: '13px',
            fontWeight: 700,
          })
        : null}
    </div>
  );
}

export function ListePropositions({ largeur }: { readonly largeur: 'desktop' | 'mobile' }) {
  const c = utiliser();
  const mobile = largeur === 'mobile';
  const lignes =
    c.onglet === 'ATTENTE'
      ? c.items.filter(enAttente)
      : c.onglet === 'ACCEPTEES'
        ? c.items.filter(acceptee)
        : [];
  const vide =
    c.onglet === 'ATTENTE'
      ? 'Aucune proposition en attente. Les corrections que d’autres membres suggèrent pour votre guide arrivent ici.'
      : c.onglet === 'ACCEPTEES'
        ? 'Aucune proposition acceptée pour l’instant.'
        : 'Les propositions refusées ne sont visibles que de leur auteur, qui en lit le motif.';

  const contenu = (
    <>
      {c.chargement && c.items.length === 0 ? <EtatVide texte="Chargement des propositions…" /> : null}
      {!c.chargement && lignes.length === 0 ? <EtatVide texte={vide} /> : null}
      {lignes.map((p) => (
        <CarteProposition key={p.id} p={p} mobile={mobile} />
      ))}
    </>
  );

  if (mobile) {
    return (
      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: '14px 16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {contenu}
      </div>
    );
  }
  return <>{contenu}</>;
}
