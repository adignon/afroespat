'use client';

import { useState } from 'react';
import {
  adminEscalatedResponseSchema,
  adminGuideCountsSchema,
  adminGuideVersionsSchema,
  adminGuidesResponseSchema,
  okResponseSchema,
} from '@app/shared';
import { staffApi } from '@/lib/api/index';
import { useDroit } from '../session-equipe';
import { Bouton, C, Carte, Etiquette, FenetreMotif, Interrupteur, Lecture, Message, Onglets, Pastille, Selecteur, Titre, Vide, dateCourte, useCharge, useGeste } from '../ui';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT — D09 · LES GUIDES CÔTÉ ÉQUIPE (05 §4)                                ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * AUCUNE RÉDACTION INTERNE (05 §1) : l'équipe modère, elle n'écrit pas. Cet écran ne
 * contient donc aucun éditeur de guide — seulement ce que 05 §4 donne à l'équipe :
 *
 *   · « Propositions escaladées » : passé 14 jours sans réponse du créateur, l'équipe
 *     accepte ou refuse À SA PLACE (avant / après côte à côte) ;
 *   · « Signalés obsolètes » : forcer la publication, ou un retour arrière (nouvelle
 *     version au corps d'une version passée — jamais de suppression d'historique) ;
 *   · « Tous » : la liste par statut, avec « maintenu par la communauté » et le forçage de
 *     statut.
 *
 * Tout forçage de statut et tout retour arrière exige un motif (10 caractères), tracé.
 * Les actions d'écriture sont réservées à CONTENT_ADMIN et SUPER_ADMIN ; les autres rôles
 * lisent.
 */

type Onglet = 'escaladees' | 'signales' | 'tous';
type Geste =
  | { kind: 'refuser'; id: string }
  | { kind: 'statut'; id: string; statut: 'PUBLISHED' | 'UNPUBLISHED' | 'FLAGGED'; titre: string }
  | { kind: 'retour'; id: string; titre: string }
  | null;

const STATUTS: Record<string, string> = { DRAFT: 'Brouillon', PUBLISHED: 'Publié', FLAGGED: 'Signalé', UNPUBLISHED: 'Dépublié', ARCHIVED: 'Archivé' };

export function ContenuGuidesEquipe() {
  const peut = useDroit('content');
  const [onglet, setOnglet] = useState<Onglet>('escaladees');
  const [filtre, setFiltre] = useState('');
  const compteurs = useCharge(() => staffApi.get('/guides/counts', adminGuideCountsSchema), 'compteurs');
  const escaladees = useCharge(() => staffApi.get('/guides/proposals/escalated', adminEscalatedResponseSchema), 'escaladees');
  const liste = useCharge(
    () => staffApi.get(onglet === 'signales' ? '/guides?view=flagged&limit=50' : `/guides?limit=50${filtre === '' ? '' : `&status=${filtre}`}`, adminGuidesResponseSchema),
    `${onglet}|${filtre}`,
  );
  const [geste, setGeste] = useState<Geste>(null);
  const action = useGeste();
  /** Ouvre une fenêtre : le message du geste précédent ne doit pas s'y afficher. */
  const ouvrir = (g: NonNullable<typeof geste>) => {
    action.effacer();
    setGeste(g);
  };
  const [versionId, setVersionId] = useState('');
  const versions = useCharge(
    () => (geste?.kind === 'retour' ? staffApi.get(`/guides/${geste.id}/versions`, adminGuideVersionsSchema) : Promise.resolve(null)),
    geste?.kind === 'retour' ? geste.id : '',
  );

  const tout = () => {
    compteurs.recharger();
    escaladees.recharger();
    liste.recharger();
  };
  /** Ferme la fenêtre. Après un SUCCÈS on garde le message (« Proposition refusée. »). */
  const fermer = (garderMessage = false) => {
    setGeste(null);
    setVersionId('');
    if (!garderMessage) action.effacer();
  };
  const decider = async (id: string, corps: { decision: 'ACCEPT' } | { decision: 'REJECT'; reason: string }) => {
    const ok = await action.lancer(() => staffApi.post(`/guides/proposals/${id}/decide`, okResponseSchema, { body: corps }), corps.decision === 'ACCEPT' ? 'Proposition acceptée : nouvelle version créée.' : 'Proposition refusée.');
    if (ok) {
      fermer(true);
      tout();
    }
  };
  const maintenu = async (id: string, valeur: boolean) => {
    const ok = await action.lancer(
      () => staffApi.put(`/guides/${id}/maintained`, okResponseSchema, { body: { maintainedByCommunity: valeur } }),
      valeur ? 'Guide marqué « maintenu par la communauté ».' : 'Guide repris par l’équipe : « maintenu par la communauté » retiré.',
    );
    if (ok) tout();
  };
  const confirmer = async (motif: string) => {
    if (geste === null) return;
    const g = geste;
    const ok = await action.lancer(async () => {
      if (g.kind === 'statut') await staffApi.post(`/guides/${g.id}/status`, okResponseSchema, { body: { status: g.statut, reason: motif } });
      else if (g.kind === 'retour') await staffApi.post(`/guides/${g.id}/revert`, okResponseSchema, { body: { versionId, reason: motif } });
      else if (g.kind === 'refuser') await staffApi.post(`/guides/proposals/${g.id}/decide`, okResponseSchema, { body: { decision: 'REJECT', reason: motif } });
    }, g.kind === 'retour' ? 'Retour arrière fait : une nouvelle version reprend le corps choisi.' : g.kind === 'refuser' ? 'Proposition refusée : le proposant est prévenu.' : g.statut === 'PUBLISHED' ? 'Guide publié.' : 'Guide dépublié.');
    if (ok) {
      fermer(true);
      tout();
    }
  };

  const c = compteurs.etat.phase === 'pret' ? compteurs.etat.donnees : null;
  const lib = (base: string, n: number | undefined) => (n === undefined ? base : `${base} · ${n}`);

  return (
    <>
      <Titre titre="Guides" />
      <Onglets
        actif={onglet}
        onChange={setOnglet}
        onglets={[
          { id: 'escaladees', libelle: lib('Propositions escaladées', c?.escalated) },
          { id: 'signales', libelle: lib('Signalés obsolètes', c?.flagged) },
          { id: 'tous', libelle: 'Tous' },
        ]}
      />
      <Message message={action.message} />

      {onglet === 'escaladees' ? (
        <Lecture etat={escaladees.etat} recharger={escaladees.recharger}>
          {(d) =>
            d.items.length === 0 ? (
              <Carte>
                <Vide>Aucune proposition escaladée : les créateurs répondent dans les délais.</Vide>
              </Carte>
            ) : (
              <>
                {d.items.map((p) => (
                  <Carte key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, fontSize: '16px', fontWeight: 700, minWidth: '200px' }}>{p.guideTitle}</div>
                      <Pastille ton="terre">Auteur sans réponse · {p.daysOverdue} j dépassés</Pastille>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                      <div style={{ background: C.fond, borderRadius: '14px', padding: '10px 14px' }}>
                        <Etiquette>Avant</Etiquette>
                        <div style={{ fontSize: '14px', marginTop: '4px', textDecoration: 'line-through', textDecorationColor: C.terre }}>{p.before}</div>
                      </div>
                      <div style={{ background: C.vertPale, borderRadius: '14px', padding: '10px 14px' }}>
                        <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '1px', color: C.vertFonce }}>APRÈS</div>
                        <div style={{ fontSize: '14px', marginTop: '4px' }}>{p.after}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <Bouton ton="principal" disabled={!peut || action.occupe} onClick={() => void decider(p.id, { decision: 'ACCEPT' })}>
                        Accepter
                      </Bouton>
                      <Bouton disabled={!peut || action.occupe} onClick={() => ouvrir({ kind: 'refuser', id: p.id })}>
                        Refuser
                      </Bouton>
                      <span style={{ flex: 1 }} />
                      <span style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', fontWeight: 700 }}>
                        Maintenu par la communauté
                        <Interrupteur actif={p.maintainedByCommunity} onChange={(v) => void maintenu(p.guideId, v)} libelle="Maintenu par la communauté" disabled={!peut || action.occupe} />
                      </span>
                    </div>
                    <div style={{ fontSize: '12.5px', color: C.gris }}>Motif du proposant : {p.reason}</div>
                  </Carte>
                ))}
              </>
            )
          }
        </Lecture>
      ) : (
        <Carte style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Etiquette>{onglet === 'signales' ? 'Signalés obsolètes' : 'Tous les guides'}</Etiquette>
            {onglet === 'tous' ? (
              <div style={{ minWidth: '180px' }}>
                <Selecteur libelle="Statut" valeur={filtre} onChange={setFiltre} options={[{ valeur: '', libelle: 'Tous' }, ...Object.entries(STATUTS).map(([valeur, libelle]) => ({ valeur, libelle }))]} />
              </div>
            ) : null}
          </div>
          <Lecture etat={liste.etat} recharger={liste.recharger}>
            {(d) =>
              d.items.length === 0 ? (
                <Vide>{onglet === 'signales' ? 'Aucun guide signalé.' : 'Aucun guide.'}</Vide>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {d.items.map((g) => (
                    <li key={g.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', padding: '12px 0', borderTop: `1px solid ${C.traitLeger}` }}>
                      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                        <div style={{ fontSize: '14.5px', fontWeight: 700 }}>{g.title}</div>
                        <div style={{ fontSize: '12.5px', color: C.gris }}>
                          {STATUTS[g.status] ?? g.status}
                          {g.outdatedFlagCount > 0 ? ` · ${g.outdatedFlagCount} signalement${g.outdatedFlagCount > 1 ? 's' : ''}` : ''}
                          {g.unpublishInDays === null ? '' : ` · dépublication dans ${g.unpublishInDays} jour${g.unpublishInDays > 1 ? 's' : ''}`}
                        </div>
                      </div>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', fontWeight: 700 }}>
                        Communauté
                        <Interrupteur actif={g.maintainedByCommunity} onChange={(v) => void maintenu(g.id, v)} libelle={`Maintenu par la communauté : ${g.title}`} disabled={!peut || action.occupe} />
                      </span>
                      {g.status === 'PUBLISHED' ? null : (
                        <Bouton petit disabled={!peut} onClick={() => ouvrir({ kind: 'statut', id: g.id, statut: 'PUBLISHED', titre: g.title })}>
                          Forcer la publication
                        </Bouton>
                      )}
                      {g.status === 'PUBLISHED' || g.status === 'FLAGGED' ? (
                        <Bouton petit ton="contour" disabled={!peut} onClick={() => ouvrir({ kind: 'statut', id: g.id, statut: 'UNPUBLISHED', titre: g.title })}>
                          Dépublier
                        </Bouton>
                      ) : null}
                      <Bouton petit ton="contour" disabled={!peut || !g.hasAuthor} titre={g.hasAuthor ? undefined : 'Guide sans auteur : retour arrière impossible'} onClick={() => ouvrir({ kind: 'retour', id: g.id, titre: g.title })}>
                        Retour arrière
                      </Bouton>
                    </li>
                  ))}
                </ul>
              )
            }
          </Lecture>
        </Carte>
      )}

      <FenetreMotif
        ouverte={geste !== null && geste.kind !== 'retour'}
        titre={geste?.kind === 'refuser' ? 'Refuser la proposition' : geste?.kind === 'statut' ? (geste.statut === 'PUBLISHED' ? `Forcer la publication` : 'Dépublier le guide') : ''}
        consigne={geste?.kind === 'statut' ? geste.titre : 'Le proposant est prévenu du motif.'}
        min={10}
        max={500}
        libelleConfirmer="Confirmer"
        onConfirmer={(m) => void confirmer(m)}
        onFermer={() => fermer()}
        occupe={action.occupe}
        message={action.message}
      />
      <FenetreMotif
        ouverte={geste?.kind === 'retour'}
        titre="Retour arrière"
        consigne={`${geste?.kind === 'retour' ? geste.titre : ''} — une nouvelle version reprend le corps de la version choisie ; l’historique reste intact.`}
        min={10}
        max={500}
        libelleConfirmer="Revenir à cette version"
        onConfirmer={(m) => (versionId === '' ? undefined : void confirmer(m))}
        onFermer={() => fermer()}
        occupe={action.occupe || versionId === ''}
        message={action.message}
        enfants={
          <Lecture etat={versions.etat} recharger={versions.recharger}>
            {(v) =>
              v === null ? null : (
                <Selecteur
                  libelle="Version à retrouver"
                  valeur={versionId}
                  onChange={setVersionId}
                  options={[{ valeur: '', libelle: 'Choisir…' }, ...v.items.map((x) => ({ valeur: x.id, libelle: `v${x.version} · ${dateCourte(x.createdAt)}${x.summary === null ? '' : ` · ${x.summary}`}` }))]}
                />
              )
            }
          </Lecture>
        }
      />
    </>
  );
}
