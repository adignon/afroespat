'use client';

import Link from 'next/link';
import { useState } from 'react';
import { adminStaffAlertsResponseSchema, okResponseSchema, type AdminStaffAlerts } from '@app/shared';
import { staffApi } from '@/lib/api/index';
import { useEquipe } from '../session-equipe';
import { Bandeau, Bouton, C, Carte, Lecture, Message, Onglets, Pastille, Titre, Vide, dateCourte, useCharge, useGeste } from '../ui';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT — D17 · LES ALERTES D'ÉQUIPE (13 §4.4, 15 §2.1)                       ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La maquette ne dessine aucune page pour `staff_alerts` : l'alerte « dossier prioritaire hors délai »
 * (`moderation.sla_alert`, toutes les 15 minutes) et, depuis la phase 5, l'alerte « compte équipe verrouillé »
 * (5 échecs de connexion, 15 §2.1) s'écrivaient sans qu'aucun écran les lise. Cette page les LIT et les
 * MARQUE LUES — chacune est PROPRE au compte connecté (`GET /admin/moderation/alerts`).
 *
 * Réservée à la modération, au contenu et à l'administration (la route refuse `SUPPORT` en 403 ; l'écran le
 * dit au lieu d'afficher une erreur). Le CHÂSSIS est celui de la planche D04 (`frame.section`), le contenu
 * est ce composant ; l'entrée « Alertes d'équipe » du rail est un AJOUT du générateur.
 */

const GENRES: Record<string, string> = { SLA_BREACH: 'Délai de modération', STAFF_LOCKED: 'Verrouillage' };
const ROLES_LECTEURS = ['SUPER_ADMIN', 'CONTENT_ADMIN', 'MODERATOR'];

type Filtre = 'non-lues' | 'toutes';

export function ContenuEquipeAlertes() {
  const { equipe } = useEquipe();
  if (equipe !== null && !ROLES_LECTEURS.includes(equipe.role)) {
    return (
      <>
        <Titre titre="Alertes d’équipe" />
        <Bandeau>Les alertes d’équipe sont réservées à la modération, au contenu et à l’administration.</Bandeau>
      </>
    );
  }
  return <Liste />;
}

function Liste() {
  const [filtre, setFiltre] = useState<Filtre>('non-lues');
  const { etat, recharger } = useCharge(
    () => staffApi.get(filtre === 'non-lues' ? '/moderation/alerts?unread=true' : '/moderation/alerts', adminStaffAlertsResponseSchema),
    `alertes-${filtre}`,
  );
  const geste = useGeste();

  const lire = async (id: string) => {
    const ok = await geste.lancer(() => staffApi.post(`/moderation/alerts/${id}/read`, okResponseSchema, { body: {} }));
    if (ok) recharger();
  };
  const toutLire = async (alertes: AdminStaffAlerts['items']) => {
    const ok = await geste.lancer(async () => {
      for (const a of alertes.filter((x) => !x.read)) await staffApi.post(`/moderation/alerts/${a.id}/read`, okResponseSchema, { body: {} });
    }, 'Toutes les alertes sont marquées lues.');
    if (ok) recharger();
  };

  return (
    <Lecture etat={etat} recharger={recharger}>
      {(d) => (
        <>
          <Titre
            titre="Alertes d’équipe"
            sous={d.unread === 0 ? 'Aucune alerte non lue' : `${d.unread} alerte${d.unread > 1 ? 's' : ''} non lue${d.unread > 1 ? 's' : ''}`}
            action={
              d.unread > 0 ? (
                <Bouton petit ton="contour" disabled={geste.occupe} onClick={() => void toutLire(d.items)}>
                  Tout marquer comme lu
                </Bouton>
              ) : undefined
            }
          />
          <Onglets<Filtre>
            actif={filtre}
            onChange={setFiltre}
            onglets={[
              { id: 'non-lues', libelle: 'Non lues' },
              { id: 'toutes', libelle: 'Toutes' },
            ]}
          />
          <Message message={geste.message} />
          {d.items.length === 0 ? (
            <Carte>
              <Vide>{filtre === 'non-lues' ? 'Rien à lire : toutes vos alertes sont traitées.' : 'Aucune alerte pour l’instant.'}</Vide>
            </Carte>
          ) : (
            <Carte style={{ padding: '4px 18px' }}>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {d.items.map((a, i) => (
                  <li
                    key={a.id}
                    data-alerte={a.id}
                    style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap', padding: '14px 0', borderBottom: i === d.items.length - 1 ? 'none' : `1px solid ${C.traitLeger}` }}
                  >
                    <span aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '999px', marginTop: '6px', flexShrink: 0, background: a.read ? 'transparent' : C.terre, border: a.read ? `1px solid ${C.trait}` : 'none' }} />
                    <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: a.read ? 500 : 800 }}>{a.title}</span>
                        <Pastille ton={a.kind === 'STAFF_LOCKED' ? 'terre' : 'neutre'}>{GENRES[a.kind] ?? a.kind}</Pastille>
                        {a.read ? <Pastille ton="vert">Lue</Pastille> : null}
                      </div>
                      {a.body === null ? null : <div style={{ fontSize: '13px', color: C.gris, marginTop: '4px' }}>{a.body}</div>}
                      <div style={{ fontSize: '12px', color: C.grisClair, marginTop: '4px' }}>
                        {dateCourte(a.createdAt)}
                        {a.caseId !== null ? (a.caseOpen === true ? ' · dossier encore ouvert' : ' · dossier clos') : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {a.caseId === null ? null : (
                        <Link href={`/admin/moderation/${a.caseId}`} style={{ display: 'inline-flex', alignItems: 'center', height: '34px', padding: '0 14px', borderRadius: '12px', border: `1px solid ${C.trait}`, color: C.encre, fontSize: '12.5px', fontWeight: 700, textDecoration: 'none' }}>
                          Ouvrir le dossier
                        </Link>
                      )}
                      {a.read ? null : (
                        <Bouton petit disabled={geste.occupe} onClick={() => void lire(a.id)}>
                          Marquer lu
                        </Bouton>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Carte>
          )}
        </>
      )}
    </Lecture>
  );
}
