'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { z } from 'zod';
import {
  ACTION_REASON_MIN,
  SANCTIONING_ACTIONS,
  SANCTION_REASON_MIN,
  adminModerationCaseDetailSchema,
  okResponseSchema,
  type AdminModerationCaseDetail,
} from '@app/shared';
import { staffApi } from '@/lib/api/index';
import { useEquipe } from '../session-equipe';
import { libelleSujet } from './file-moderation';
import { Bandeau, Bouton, C, Carte, Colonnes, Etiquette, Lecture, Message, Pastille, Titre, ZoneTexte, dateCourte, useCharge, useGeste } from '../ui';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT — D05 · LE DOSSIER, AVEC SON CONTENU ET SES ACTIONS (13 §4.2)         ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le défaut le plus lourd que ce module relevait : l'écran qui sert à décider d'une
 * sanction ne montrait pas ce qu'il sanctionnait. La route rend maintenant l'EXTRAIT du
 * contenu visé et les NOMS d'affichage (jamais un numéro) ; l'écran les montre avec le
 * contexte (sanctions, dossiers, signalements) et le verdict de l'IA.
 *
 * Les actions de la maquette — Conserver, Masquer, Retirer, Avertir, Suspendre 1/7/30 j,
 * Bannir — appellent `POST /moderation/cases/:id/actions`. Le MOTIF est obligatoire :
 * 3 caractères pour classer ou masquer, 20 pour toute sanction (le plancher vient de
 * `@app/shared`). « Bannir » est réservé au super-administrateur : le bouton s'éteint
 * pour les autres, et le serveur le refuse de toute façon.
 *
 * Un message privé n'est pas déchiffré ici (voir `ModerationService.subjectText`) : le
 * dossier dit que la conversation est jointe et combien de messages elle compte.
 */

type Choix = { action: string; duree?: 1 | 7 | 30 };
const ACTIONS: readonly { id: string; libelle: string; duree?: 1 | 7 | 30; action: string; superAdmin?: boolean }[] = [
  { id: 'dismiss', libelle: 'Conserver', action: 'DISMISS' },
  { id: 'hide', libelle: 'Masquer', action: 'HIDE' },
  { id: 'remove', libelle: 'Retirer', action: 'REMOVE' },
  { id: 'warn', libelle: 'Avertir', action: 'WARN' },
  { id: 's1', libelle: 'Suspendre 1 j', action: 'SUSPEND_USER', duree: 1 },
  { id: 's7', libelle: 'Suspendre 7 j', action: 'SUSPEND_USER', duree: 7 },
  { id: 's30', libelle: 'Suspendre 30 j', action: 'SUSPEND_USER', duree: 30 },
  { id: 'ban', libelle: 'Bannir · super-admin', action: 'BAN_USER', superAdmin: true },
];

const SLA: Record<string, string> = { OK: 'dans les temps', WARNING: 'à surveiller', OVERDUE: 'dépassé' };
const RAISONS: Record<string, string> = {
  SCAM: 'Arnaque',
  MONEY_REQUEST: 'Demande d’argent',
  HARASSMENT: 'Harcèlement',
  SPAM: 'Indésirable',
  INAPPROPRIATE: 'Inapproprié',
  OTHER: 'Autre',
};
const rapportsSchema = z.array(z.object({ reason: z.string() }).passthrough());
const conversationSchema = z.object({ messages: z.array(z.unknown()) }).passthrough();
const historiqueSchema = z.object({ sanctions: z.array(z.unknown()), cases: z.array(z.unknown()) }).passthrough();

export function ContenuDossierModeration() {
  const { id } = useParams<{ id: string }>();
  const { etat, recharger } = useCharge(() => staffApi.get(`/moderation/cases/${id}`, adminModerationCaseDetailSchema), id);
  return (
    <Lecture etat={etat} recharger={recharger}>
      {(d) => <Dossier d={d} recharger={recharger} />}
    </Lecture>
  );
}

function Dossier({ d, recharger }: { readonly d: AdminModerationCaseDetail; readonly recharger: () => void }) {
  const { equipe } = useEquipe();
  const geste = useGeste();
  const [choix, setChoix] = useState<Choix | null>(null);
  const [motif, setMotif] = useState('');
  const [conversation, setConversation] = useState(false);

  const sanctionnante = choix !== null && (SANCTIONING_ACTIONS as readonly string[]).includes(choix.action);
  const min = sanctionnante ? SANCTION_REASON_MIN : ACTION_REASON_MIN;
  const suffisant = choix !== null && motif.trim().length >= min;
  const resolu = d.status === 'RESOLVED';

  const rapports = rapportsSchema.safeParse(d.reports);
  const raisons = new Map<string, number>();
  if (rapports.success) for (const r of rapports.data) raisons.set(r.reason, (raisons.get(r.reason) ?? 0) + 1);
  const conv = conversationSchema.safeParse(d.conversation);
  const histo = historiqueSchema.safeParse(d.authorHistory);

  const appliquer = async () => {
    if (choix === null || !suffisant) return;
    const ok = await geste.lancer(
      () =>
        staffApi.post(`/moderation/cases/${d.id}/actions`, okResponseSchema, {
          body: { action: choix.action, reason: motif.trim(), ...(choix.duree === undefined ? {} : { durationDays: choix.duree }) },
        }),
      'Action appliquée et tracée.',
    );
    if (ok) {
      setChoix(null);
      setMotif('');
      recharger();
    }
  };
  const assigner = async (chemin: 'assign' | 'release') => {
    const ok = await geste.lancer(() => staffApi.post(`/moderation/cases/${d.id}/${chemin}`, okResponseSchema), chemin === 'assign' ? 'Dossier pris.' : 'Dossier rendu à la file.');
    if (ok) recharger();
  };

  return (
    <>
      <Titre
        titre="Dossier de modération"
        sous={`${libelleSujet({ subjectType: d.subjectType, title: null, excerpt: null })} · priorité ${d.priority} · SLA ${SLA[d.sla] ?? d.sla} · ${resolu ? 'résolu' : d.status === 'IN_REVIEW' ? 'en cours' : 'ouvert'}`}
        action={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link href="/admin/moderation" style={{ alignSelf: 'center', fontSize: '13px', fontWeight: 700, color: C.vertFonce }}>
              ← La file
            </Link>
            {resolu ? null : d.assignedStaffId === null ? (
              <Bouton ton="principal" onClick={() => void assigner('assign')} disabled={geste.occupe}>
                Prendre
              </Bouton>
            ) : (
              <Bouton onClick={() => void assigner('release')} disabled={geste.occupe}>
                Rendre à la file
              </Bouton>
            )}
          </div>
        }
      />
      <Colonnes gabarit="minmax(0,1.15fr) minmax(0,1fr) minmax(0,1fr)">
        <Carte style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Etiquette>Contenu</Etiquette>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '999px', background: '#8A958F', color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {(d.authorName ?? '?').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{d.authorName ?? 'Auteur inconnu'}</div>
              <div style={{ fontSize: '12px', color: C.gris }}>
                {d.authorHandle === null || d.authorHandle === undefined ? '' : `@${d.authorHandle} · `}
                {d.authorCity ?? 'sans ville'} · {dateCourte(d.createdAt)}
              </div>
            </div>
          </div>
          {d.title !== null && d.title !== undefined ? <div style={{ fontWeight: 700 }}>{d.title}</div> : null}
          {d.excerpt !== null && d.excerpt !== undefined ? (
            <div style={{ fontSize: '15px', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{d.excerpt}</div>
          ) : d.title === null || d.title === undefined ? (
            <div style={{ fontSize: '13.5px', color: C.gris }}>Le contenu n’est plus disponible (supprimé ou non affichable à l’équipe).</div>
          ) : null}
          {conv.success ? (
            <div style={{ background: C.fond, borderRadius: '14px', padding: '10px 14px' }}>
              <button type="button" onClick={() => setConversation((v) => !v)} style={{ border: 'none', background: 'none', font: 'inherit', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer', padding: 0 }}>
                Conversation jointe ({conv.data.messages.length} message{conv.data.messages.length > 1 ? 's' : ''}) {conversation ? '▴' : '▾'}
              </button>
              {conversation ? <div style={{ fontSize: '12.5px', color: C.gris, marginTop: '6px' }}>Les corps de messages sont chiffrés : l’équipe voit leur nombre, pas leur texte (08 §8.1).</div> : null}
            </div>
          ) : null}
        </Carte>

        <Carte style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Etiquette>Contexte</Etiquette>
          <div>
            <Etiquette>Sanctions</Etiquette>
            <div style={{ fontSize: '13.5px' }}>{histo.success && histo.data.sanctions.length > 0 ? `${histo.data.sanctions.length} sanction${histo.data.sanctions.length > 1 ? 's' : ''}` : 'Aucune'}</div>
          </div>
          <div>
            <Etiquette>Dossiers</Etiquette>
            <div style={{ fontSize: '13.5px' }}>{histo.success ? `${histo.data.cases.length} autre${histo.data.cases.length > 1 ? 's' : ''} dossier${histo.data.cases.length > 1 ? 's' : ''}` : '—'}</div>
          </div>
          <div>
            <Etiquette>Signalements</Etiquette>
            <div style={{ fontSize: '13.5px' }}>
              {raisons.size === 0 ? (d.source === 'REPORT' ? '0' : `Aucun · ouvert par ${d.source === 'AI' ? 'l’IA' : 'une règle'}`) : `${rapports.success ? rapports.data.length : 0} · ${[...raisons].map(([r, n]) => `${RAISONS[r] ?? r} (${n})`).join(', ')}`}
            </div>
          </div>
          <div style={{ background: C.encre, color: '#fff', borderRadius: '16px', padding: '12px 14px' }}>
            <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '1px', opacity: 0.8 }}>VERDICT IA</div>
            <div style={{ fontSize: '14px', marginTop: '4px' }}>
              {d.aiVerdict === 'ALLOW' ? 'Autorisé' : d.aiVerdict === 'QUEUE' ? 'À examiner' : 'Bloqué'}
              {d.aiScore === null ? ' · pas d’analyse' : ` · confiance ${d.aiScore.toFixed(2).replace('.', ',')}`}
            </div>
            {d.aiLabels.length === 0 ? null : (
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                {d.aiLabels.map((l) => (
                  <span key={l} style={{ background: '#fff', color: C.encre, borderRadius: '999px', padding: '3px 10px', fontSize: '11.5px', fontWeight: 700 }}>
                    {l}
                  </span>
                ))}
              </div>
            )}
          </div>
          {d.actions.length === 0 ? null : (
            <div>
              <Etiquette>Historique du dossier</Etiquette>
              <ul style={{ margin: '6px 0 0', padding: 0, listStyle: 'none', fontSize: '12.5px', color: C.gris, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {d.actions.map((a) => (
                  <li key={a.id}>
                    {dateCourte(a.createdAt)} · {a.action} · {a.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Carte>

        <Carte style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Etiquette>Actions</Etiquette>
          {resolu ? <Bandeau>Dossier résolu{d.resolution === null ? '' : ` · ${d.resolution}`}.</Bandeau> : null}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
            {ACTIONS.map((a) => {
              const actif = choix?.action === a.action && choix.duree === a.duree;
              const interdit = a.superAdmin === true && equipe?.role !== 'SUPER_ADMIN';
              return (
                <button
                  key={a.id}
                  type="button"
                  disabled={interdit || resolu}
                  aria-pressed={actif}
                  title={interdit ? 'Réservé au super-administrateur' : undefined}
                  onClick={() => setChoix(a.duree === undefined ? { action: a.action } : { action: a.action, duree: a.duree })}
                  style={{ height: '38px', borderRadius: '12px', border: 'none', font: 'inherit', fontSize: '13px', fontWeight: 700, cursor: interdit || resolu ? 'default' : 'pointer', opacity: interdit || resolu ? 0.5 : 1, background: actif ? C.encre : C.aplat, color: actif ? '#fff' : C.encre }}
                >
                  {a.libelle}
                </button>
              );
            })}
          </div>
          <ZoneTexte libelle={`Motif · ${min} caractères minimum`} valeur={motif} onChange={setMotif} lignes={3} maxLength={1000} disabled={resolu} />
          <div style={{ fontSize: '12px', fontWeight: 700, color: suffisant ? C.vertFonce : C.gris }}>
            {motif.trim().length} / {min}
          </div>
          <Bouton ton="principal" plein disabled={!suffisant || geste.occupe || resolu} onClick={() => void appliquer()}>
            {geste.occupe ? 'Un instant…' : 'Appliquer'}
          </Bouton>
          <Message message={geste.message} />
          {choix === null ? <div style={{ fontSize: '12.5px', color: C.grisClair }}>Choisissez une action, puis écrivez le motif.</div> : null}
          <Pastille ton="neutre">{d.status === 'RESOLVED' ? 'Résolu' : d.assignedName === null || d.assignedName === undefined ? 'Non assigné' : `Assigné à ${d.assignedName}`}</Pastille>
        </Carte>
      </Colonnes>
    </>
  );
}
