'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  MAX_PAGE_LIMIT,
  ReportSubjectType,
  adminModerationCasesResponseSchema,
  adminModerationStatsResponseSchema,
  okResponseSchema,
  type AdminModerationCaseRow,
} from '@app/shared';
import { staffApi } from '@/lib/api/index';
import { useDroit } from '../session-equipe';
import { Bandeau, Bouton, C, Carte, Lecture, Message, Pastille, Selecteur, Titre, Vide, useCharge, useGeste } from '../ui';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT — D04 · LA FILE DE MODÉRATION, RÉELLE ET PAGINÉE (13 §4.1)            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La maquette gardait 46 lignes d'exemple et ne menait nulle part. Ici : la file réelle
 * (`GET /admin/moderation/cases`), triée par le SERVEUR (priorité, puis échéance du
 * SLA), paginée par curseur, avec les trois filtres que la maquette dessine
 * (priorité, type, assigné) plus l'état. Chaque ligne ouvre le dossier (D05) ; « Prendre »
 * s'assigne le dossier.
 *
 * Droits (lot A) : la file est ouverte à SUPER_ADMIN et MODERATOR — `CONTENT_ADMIN` n'y a
 * pas accès, et l'écran le dit au lieu d'afficher une erreur brute.
 *
 * L'état du SLA (« dépassé », « 2 h ») est calculé par le SERVEUR (`sla`) : l'horloge du
 * navigateur est réglable. La couleur des pastilles reprend celle de la maquette
 * (sombre = dépassé, terre cuite = attention, vert = dans les temps).
 */

const TYPES: Record<string, string> = {
  POST: 'Publication',
  COMMENT: 'Commentaire',
  TOPIC: 'Sujet',
  GUIDE: 'Guide',
  HELP_REQUEST: 'Demande d’aide',
  HELP_RESPONSE: 'Réponse d’aide',
  HOUSING: 'Annonce logement',
  JOB: 'Offre d’emploi',
  PRO: 'Fiche pro',
  EVENT: 'Événement',
  MESSAGE: 'Message',
  USER: 'Profil',
  COMMUNITY: 'Réseau',
};
const SOURCES: Record<string, string> = { REPORT: 'Signalement', AI: 'IA', RISK_SCORE: 'Score de risque', AUTO_RULE: 'Règle auto' };

export function libelleSujet(c: Pick<AdminModerationCaseRow, 'subjectType' | 'title' | 'excerpt'>): string {
  const base = TYPES[c.subjectType] ?? c.subjectType;
  const detail = c.title ?? c.excerpt ?? null;
  return detail === null ? base : `${base} · ${detail}`;
}

function PastilleSla({ sla, due }: { readonly sla: string; readonly due: string }) {
  const restant = Math.max(0, Math.round((new Date(due).getTime() - Date.now()) / 3_600_000));
  if (sla === 'OVERDUE') return <Pastille ton="sombre">dépassé</Pastille>;
  if (sla === 'WARNING') return <Pastille ton="terre">{restant} h</Pastille>;
  return <Pastille ton="vert">{restant} h</Pastille>;
}

export function ContenuFileModeration() {
  const peut = useDroit('moderation');
  const [statut, setStatut] = useState('OPEN');
  const [priorite, setPriorite] = useState('');
  const [type, setType] = useState('');
  const [assigne, setAssigne] = useState('any');
  const [suivantes, setSuivantes] = useState<readonly AdminModerationCaseRow[]>([]);
  const [curseur, setCurseur] = useState<string | null>(null);
  const geste = useGeste();

  const filtres = `${statut}|${priorite}|${type}|${assigne}`;
  const requete = useCallback(
    (cursor?: string) => {
      const p = new URLSearchParams({ limit: String(MAX_PAGE_LIMIT), assigned: assigne });
      if (statut !== '') p.set('status', statut);
      if (priorite !== '') p.set('priority', priorite);
      if (type !== '') p.set('subjectType', type);
      if (cursor !== undefined) p.set('cursor', cursor);
      return staffApi.get(`/moderation/cases?${p.toString()}`, adminModerationCasesResponseSchema);
    },
    [statut, priorite, type, assigne],
  );

  const liste = useCharge(() => requete(), filtres);
  const stats = useCharge(() => staffApi.get('/moderation/stats', adminModerationStatsResponseSchema), 'stats');

  useEffect(() => {
    setSuivantes([]);
    setCurseur(null);
  }, [filtres]);

  const premiere = liste.etat.phase === 'pret' ? liste.etat.donnees : null;
  const prochain = curseur ?? premiere?.nextCursor ?? null;

  const chargerPlus = async () => {
    if (prochain === null) return;
    await geste.lancer(async () => {
      const page = await requete(prochain);
      setSuivantes((s) => [...s, ...page.items]);
      setCurseur(page.nextCursor);
    });
  };

  const prendre = async (id: string) => {
    const ok = await geste.lancer(() => staffApi.post(`/moderation/cases/${id}/assign`, okResponseSchema), 'Dossier pris.');
    if (ok) liste.recharger();
  };

  const ouverts = stats.etat.phase === 'pret' ? Object.values(stats.etat.donnees.openByPriority).reduce((t, n) => t + n, 0) : null;
  const lignes = premiere === null ? [] : [...premiere.items, ...suivantes];

  if (liste.etat.phase === 'echec' && liste.etat.erreur instanceof Error && 'code' in liste.etat.erreur && (liste.etat.erreur as { code?: string }).code === 'STAFF_ROLE_REQUIRED') {
    return (
      <>
        <Titre titre="Modération" />
        <Bandeau>La file de modération est réservée aux modérateurs et au super-administrateur.</Bandeau>
      </>
    );
  }

  return (
    <>
      <Titre titre="Modération" sous={ouverts === null ? 'Dossiers ouverts' : `${ouverts} dossier${ouverts > 1 ? 's' : ''} ouvert${ouverts > 1 ? 's' : ''}`} />
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ minWidth: '150px' }}>
          <Selecteur libelle="État" valeur={statut} onChange={setStatut} options={[{ valeur: 'OPEN', libelle: 'Ouverts' }, { valeur: 'IN_REVIEW', libelle: 'En cours' }, { valeur: 'RESOLVED', libelle: 'Résolus' }, { valeur: '', libelle: 'Tous' }]} />
        </div>
        <div style={{ minWidth: '130px' }}>
          <Selecteur libelle="Priorité" valeur={priorite} onChange={setPriorite} options={[{ valeur: '', libelle: 'Toutes' }, ...[1, 2, 3, 4, 5].map((n) => ({ valeur: String(n), libelle: `Priorité ${n}` }))]} />
        </div>
        <div style={{ minWidth: '170px' }}>
          <Selecteur libelle="Type" valeur={type} onChange={setType} options={[{ valeur: '', libelle: 'Tous' }, ...ReportSubjectType.map((t) => ({ valeur: t, libelle: TYPES[t] ?? t }))]} />
        </div>
        <div style={{ minWidth: '150px' }}>
          <Selecteur libelle="Assigné" valeur={assigne} onChange={setAssigne} options={[{ valeur: 'any', libelle: 'Tous' }, { valeur: 'me', libelle: 'À moi' }, { valeur: 'nobody', libelle: 'Personne' }]} />
        </div>
      </div>
      <Message message={geste.message} />
      <Lecture etat={liste.etat} recharger={liste.recharger}>
        {() =>
          lignes.length === 0 ? (
            <Carte>
              <Vide>Aucun dossier ne correspond à ces filtres.</Vide>
            </Carte>
          ) : (
            <Carte style={{ padding: 0, overflow: 'hidden' }}>
              <div data-admin-defile="" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: '860px', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: C.grisClair, fontSize: '10.5px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                      {['Prio', 'Sujet', 'Auteur', 'Source', 'Sign.', 'Assigné', 'SLA', ''].map((h) => (
                        <th key={h} style={{ padding: '12px 14px', fontWeight: 700 }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map((c) => (
                      <tr key={c.id} style={{ borderTop: `1px solid ${C.traitLeger}` }}>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ display: 'inline-flex', width: '26px', height: '26px', borderRadius: '8px', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '12px', background: c.priority === 1 ? C.encre : c.priority <= 3 ? C.terrePale : C.aplat, color: c.priority === 1 ? '#fff' : c.priority <= 3 ? C.terre : C.gris }}>
                            {c.priority}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', maxWidth: '340px' }}>
                          <Link href={`/admin/moderation/${c.id}`} style={{ color: C.encre, textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <strong>{TYPES[c.subjectType] ?? c.subjectType}</strong>
                            {c.title ?? c.excerpt ? <span style={{ color: C.gris }}> · {c.title ?? c.excerpt}</span> : null}
                          </Link>
                        </td>
                        <td style={{ padding: '12px 14px' }}>{c.authorName ?? '—'}</td>
                        <td style={{ padding: '12px 14px' }}>{SOURCES[c.source] ?? c.source}</td>
                        <td style={{ padding: '12px 14px' }}>{c.reportCount ?? 0}</td>
                        <td style={{ padding: '12px 14px' }}>{c.assignedName ?? '—'}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <PastilleSla sla={c.sla} due={c.slaDueAt} />
                        </td>
                        <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                          {c.assignedStaffId === null && c.status !== 'RESOLVED' ? (
                            <Bouton petit ton="principal" disabled={!peut || geste.occupe} onClick={() => void prendre(c.id)}>
                              Prendre
                            </Bouton>
                          ) : (
                            <Link href={`/admin/moderation/${c.id}`} style={{ fontSize: '12.5px', fontWeight: 700, color: C.vertFonce }}>
                              Ouvrir
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {prochain === null ? null : (
                <div style={{ padding: '12px', textAlign: 'center', borderTop: `1px solid ${C.traitLeger}` }}>
                  <Bouton ton="contour" onClick={() => void chargerPlus()} disabled={geste.occupe}>
                    Charger la suite
                  </Bouton>
                </div>
              )}
            </Carte>
          )
        }
      </Lecture>
    </>
  );
}

