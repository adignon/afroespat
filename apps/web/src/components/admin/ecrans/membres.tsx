'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import {
  MAX_PAGE_LIMIT,
  adminMemberDetailSchema,
  adminMembersResponseSchema,
  memberNoteSchema,
  okResponseSchema,
  type AdminMemberDetail,
  type AdminMemberRow,
} from '@app/shared';
import { staffApi } from '@/lib/api/index';
import { libellePhase, libellePlan, PHASES, toutesLesVilles } from '../donnees';
import { useDroit } from '../session-equipe';
import {
  Bandeau,
  Bouton,
  C,
  Carte,
  Champ,
  Colonnes,
  Etiquette,
  Fenetre,
  FenetreMotif,
  Lecture,
  Message,
  Pastille,
  Selecteur,
  Titre,
  Vide,
  ZoneTexte,
  dateCourte,
  dateLongue,
  useCharge,
  useGeste,
} from '../ui';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT — D03 · LA FICHE MEMBRE, VIVANTE (15 §3)                              ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La maquette dessine la liste ET la fiche dans le même cadre. Cette route (`GET
 * /admin/users?q=`) est une RECHERCHE, pas une liste : `q` fait deux caractères au
 * minimum, et le tableau ne se remplit donc qu'après une recherche — l'écran le dit au
 * lieu d'inventer une requête.
 *
 * RÈGLE DURE (§3.1) : aucun numéro en clair. Les numéros viennent MASQUÉS du serveur
 * (« +33 6 •• •• •• 18 ») ; la recherche par numéro passe par l'empreinte HMAC.
 *
 * LES ACTIONS (§3.2) suivent le tableau des rôles : le rôle de la session ÉTEINT ce
 * qu'il ne peut pas employer (avec la raison en titre) — le serveur reste seul juge.
 *
 *   rétrograder (MODERATOR) · corriger phase/ville, révoquer, exporter, supprimer
 *   (SUPPORT) · désactiver/réactiver (MODERATOR) · note interne (tous les rôles).
 */

type Action = 'retrograder' | 'corriger' | 'revoquer' | 'desactiver' | 'reactiver' | 'exporter' | 'supprimer';

export function ContenuMembres() {
  return (
    <Suspense fallback={null}>
      <Interne />
    </Suspense>
  );
}

function Interne() {
  const params = useSearchParams();
  const initial = params.get('q') ?? '';
  const [saisie, setSaisie] = useState(initial);
  const [q, setQ] = useState(initial);
  const [choisi, setChoisi] = useState<string | null>(null);

  useEffect(() => {
    setSaisie(initial);
    setQ(initial);
    setChoisi(null);
  }, [initial]);

  const recherche = useCharge(
    () =>
      q.trim().length < 2
        ? Promise.resolve(null)
        : staffApi.get(`/users?q=${encodeURIComponent(q.trim())}&limit=${MAX_PAGE_LIMIT}`, adminMembersResponseSchema),
    q,
  );

  return (
    <>
      <Titre titre="Membres" sous="Recherche par pseudo, nom, e-mail ou numéro (empreinte, jamais affiché)." />
      <Colonnes gabarit="minmax(0,5fr) minmax(0,7fr)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              setQ(saisie);
              setChoisi(null);
            }}
            style={{ display: 'flex', gap: '8px' }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <Champ libelle="Rechercher" valeur={saisie} onChange={setSaisie} placeholder="@pseudo, nom, +33 6 12…" />
            </div>
            <div style={{ alignSelf: 'flex-end' }}>
              <Bouton type="submit" ton="principal" disabled={saisie.trim().length < 2}>
                Chercher
              </Bouton>
            </div>
          </form>
          <Carte style={{ padding: '6px 0', overflow: 'hidden' }}>
            <Lecture etat={recherche.etat} recharger={recherche.recharger}>
              {(page) =>
                page === null ? (
                  <Vide>Saisissez au moins deux caractères pour chercher un membre.</Vide>
                ) : page.items.length === 0 ? (
                  <Vide>Aucun membre ne correspond.</Vide>
                ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {page.items.map((m) => (
                      <Ligne key={m.id} m={m} actif={m.id === choisi} onChoisir={() => setChoisi(m.id)} />
                    ))}
                  </ul>
                )
              }
            </Lecture>
          </Carte>
        </div>
        {choisi === null ? (
          <Carte>
            <Vide>Choisissez un membre pour ouvrir sa fiche.</Vide>
          </Carte>
        ) : (
          <Fiche key={choisi} id={choisi} />
        )}
      </Colonnes>
    </>
  );
}

function Ligne({ m, actif, onChoisir }: { readonly m: AdminMemberRow; readonly actif: boolean; readonly onChoisir: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onChoisir}
        aria-current={actif}
        style={{ width: '100%', textAlign: 'left', border: 'none', borderBottom: `1px solid ${C.traitLeger}`, background: actif ? C.fond : '#fff', padding: '12px 16px', font: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.displayName}</span>
          <span style={{ display: 'block', fontSize: '12px', color: C.gris, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            @{m.handle} · {m.verificationLevel.replace('L', 'N')} · {m.city?.name ?? 'sans ville'}
          </span>
        </span>
        {m.status === 'ACTIVE' ? null : <Pastille ton="terre">{m.status === 'DEACTIVATED' ? 'Désactivé' : m.status === 'SUSPENDED' ? 'Suspendu' : m.status}</Pastille>}
      </button>
    </li>
  );
}

function Fiche({ id }: { readonly id: string }) {
  const { etat, recharger } = useCharge(() => staffApi.get(`/users/${id}`, adminMemberDetailSchema), id);
  return (
    <Lecture etat={etat} recharger={recharger}>
      {(m) => <FicheMembre m={m} recharger={recharger} />}
    </Lecture>
  );
}

function Case({ titre, children }: { readonly titre: string; readonly children: React.ReactNode }) {
  return (
    <div style={{ background: C.fond, borderRadius: '14px', padding: '10px 14px', minWidth: 0 }}>
      <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '1px', color: C.grisClair, textTransform: 'uppercase' }}>{titre}</div>
      <div style={{ fontSize: '13.5px', marginTop: '3px', wordBreak: 'break-word' }}>{children}</div>
    </div>
  );
}

function FicheMembre({ m, recharger }: { readonly m: AdminMemberDetail; readonly recharger: () => void }) {
  const peutModerer = useDroit('moderation');
  const peutRgpd = useDroit('rgpd');
  const geste = useGeste();
  const [action, setAction] = useState<Action | null>(null);
  const [note, setNote] = useState('');
  const noteGeste = useGeste();
  const [phase, setPhase] = useState<string>(m.phase);
  const [villeId, setVilleId] = useState<string>(m.city?.id ?? '');
  const [confirmation, setConfirmation] = useState('');
  const villes = useCharge(() => toutesLesVilles(), 'villes');

  const supprime = m.deletedAt !== null || m.status === 'DELETED';
  const suspendu = m.status === 'DEACTIVATED';
  const fermer = () => {
    setAction(null);
    geste.effacer();
    setConfirmation('');
  };

  const executer = async (motif: string) => {
    if (action === null) return;
    const ok = await geste.lancer(async () => {
      switch (action) {
        case 'retrograder':
          await staffApi.post(`/users/${m.id}/kyc/downgrade`, okResponseSchema, { body: { reason: motif } });
          break;
        case 'revoquer':
          await staffApi.post(`/users/${m.id}/revoke-sessions`, okResponseSchema, { body: { reason: motif } });
          break;
        case 'desactiver':
          await staffApi.post(`/users/${m.id}/deactivate`, okResponseSchema, { body: { reason: motif } });
          break;
        case 'reactiver':
          await staffApi.post(`/users/${m.id}/reactivate`, okResponseSchema, { body: { reason: motif } });
          break;
        case 'exporter':
          await staffApi.post(`/users/${m.id}/export`, okResponseSchema, { body: { reason: motif } });
          break;
        case 'supprimer':
          await staffApi.post(`/users/${m.id}/delete-now`, okResponseSchema, { body: { reason: motif, confirmHandle: confirmation } });
          break;
        case 'corriger':
          if (phase !== m.phase) await staffApi.post(`/users/${m.id}/phase`, okResponseSchema, { body: { phase, reason: motif } });
          if ((villeId === '' ? null : villeId) !== (m.city?.id ?? null)) {
            await staffApi.post(`/users/${m.id}/city`, okResponseSchema, { body: { cityId: villeId === '' ? null : villeId, reason: motif } });
          }
          break;
      }
    });
    if (ok) {
      fermer();
      recharger();
    }
  };

  const ajouterNote = async () => {
    const corps = memberNoteSchema.safeParse({ body: note });
    if (!corps.success) return;
    const ok = await noteGeste.lancer(() => staffApi.post(`/users/${m.id}/note`, okResponseSchema, { body: corps.data }), 'Note ajoutée.');
    if (ok) {
      setNote('');
      recharger();
    }
  };

  const titreDroit = (ok: boolean, role: string) => (ok ? undefined : `Réservé : ${role}`);
  const kyc = m.kycVerifications.length;
  const sanctions = m.sanctions.length;

  return (
    <Carte style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <div style={{ width: '52px', height: '52px', borderRadius: '999px', background: '#8A958F', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>
          {m.displayName.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '18px', fontWeight: 800 }}>{m.displayName}</div>
          <div style={{ fontSize: '12.5px', color: C.gris }}>
            @{m.handle} · {m.verificationLevel.replace('L', 'N')} · {libellePhase(m.phase)} · {m.city?.name ?? 'sans ville'} · {libellePlan(m.plan)}
          </div>
        </div>
        {m.moderationCases.length > 0 ? <Pastille ton="terre">{m.moderationCases.length} dossier{m.moderationCases.length > 1 ? 's' : ''}</Pastille> : null}
        {m.status === 'ACTIVE' ? null : <Pastille ton="sombre">{suspendu ? 'Désactivé' : m.status}</Pastille>}
      </div>

      <div className="admin-cases" style={{ display: 'grid', gap: '8px' }}>
        <Case titre="Numéros">{m.phones.length === 0 ? '—' : m.phones.map((p) => p.masked).join(' · ')}</Case>
        <Case titre="KYC">{kyc === 0 ? 'Aucune vérification' : `${m.kycVerifications.length} vérification${kyc > 1 ? 's' : ''}`}</Case>
        <Case titre="Sanctions">{sanctions === 0 ? 'Aucune' : `${sanctions} sanction${sanctions > 1 ? 's' : ''}`}</Case>
        <Case titre="Sessions">{m.activeSessions.length} active{m.activeSessions.length > 1 ? 's' : ''}</Case>
        <Case titre="Consentements">
          {m.consents.length === 0 ? '—' : [...new Map(m.consents.map((c) => [c.type, c])).values()].map((c) => `${c.type === 'TERMS' ? 'CGU' : c.type === 'PRIVACY' ? 'confidentialité' : c.type} v${c.version}${c.granted ? '' : ' (refusé)'}`).join(' · ')}
        </Case>
        <Case titre="Inscription">{dateLongue(m.createdAt)}</Case>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Etiquette>Notes internes · équipe seulement</Etiquette>
        {m.notes === undefined || m.notes.length === 0 ? (
          <div style={{ fontSize: '13px', color: C.gris }}>Aucune note.</div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {m.notes.map((n) => (
              <li key={n.id} style={{ background: C.fond, borderRadius: '12px', padding: '8px 12px', fontSize: '13px' }}>
                {n.body}
                <div style={{ fontSize: '11.5px', color: C.grisClair, marginTop: '2px' }}>
                  {n.author.displayName} · {dateCourte(n.createdAt)}
                </div>
              </li>
            ))}
          </ul>
        )}
        <ZoneTexte libelle="Ajouter une note interne" valeur={note} onChange={setNote} lignes={2} maxLength={2000} />
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Bouton ton="principal" onClick={() => void ajouterNote()} disabled={noteGeste.occupe || note.trim().length === 0 || supprime}>
            Ajouter la note
          </Bouton>
          <Message message={noteGeste.message} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <Bouton petit disabled={!peutModerer || supprime} titre={titreDroit(peutModerer, 'modération')} onClick={() => setAction('retrograder')}>
          Rétrograder
        </Bouton>
        <Bouton petit disabled={!peutRgpd || supprime} titre={titreDroit(peutRgpd, 'support')} onClick={() => setAction('corriger')}>
          Corriger phase / ville
        </Bouton>
        <Bouton petit disabled={!peutRgpd || supprime} titre={titreDroit(peutRgpd, 'support')} onClick={() => setAction('revoquer')}>
          Révoquer les sessions
        </Bouton>
        {suspendu ? (
          <Bouton petit disabled={!peutModerer || supprime} titre={titreDroit(peutModerer, 'modération')} onClick={() => setAction('reactiver')}>
            Réactiver
          </Bouton>
        ) : (
          <Bouton petit disabled={!peutModerer || supprime} titre={titreDroit(peutModerer, 'modération')} onClick={() => setAction('desactiver')}>
            Désactiver
          </Bouton>
        )}
        <Bouton petit disabled={!peutRgpd || supprime} titre={titreDroit(peutRgpd, 'support')} onClick={() => setAction('exporter')}>
          Générer un export
        </Bouton>
        <Bouton petit ton="sombre" disabled={!peutRgpd || supprime} titre={titreDroit(peutRgpd, 'support')} onClick={() => setAction('supprimer')}>
          Supprimer maintenant
        </Bouton>
      </div>
      <div style={{ fontSize: '12px', color: C.grisClair }}>Chaque action demande un motif. Aucun numéro n’est affiché en clair.</div>
      {supprime ? <Bandeau>Ce compte est supprimé : aucune action n’est possible.</Bandeau> : null}

      <FenetreMotif
        ouverte={action !== null && action !== 'corriger' && action !== 'supprimer'}
        titre={
          {
            retrograder: 'Rétrograder le niveau',
            revoquer: 'Révoquer les sessions',
            desactiver: 'Désactiver le compte',
            reactiver: 'Réactiver le compte',
            exporter: 'Générer un export',
            corriger: '',
            supprimer: '',
          }[action ?? 'exporter']
        }
        consigne={
          action === 'retrograder'
            ? 'Le KYC est marqué refusé et le niveau recalculé. Le motif est conservé au journal d’audit.'
            : action === 'exporter'
              ? 'L’archive est préparée sans le délai de 30 jours ; le membre la retrouve dans son compte.'
              : undefined
        }
        min={action === 'retrograder' ? 20 : 10}
        libelleConfirmer="Confirmer"
        onConfirmer={(motif) => void executer(motif)}
        onFermer={fermer}
        occupe={geste.occupe}
        message={geste.message}
      />
      <FenetreMotif
        ouverte={action === 'corriger'}
        titre="Corriger la phase ou la ville"
        consigne="Correction à la demande du membre. Le changement est tracé."
        min={10}
        libelleConfirmer="Appliquer"
        onConfirmer={(motif) => void executer(motif)}
        onFermer={fermer}
        occupe={geste.occupe}
        message={geste.message}
        enfants={
          <>
            <Selecteur libelle="Phase" valeur={phase} onChange={setPhase} options={PHASES} />
            <Selecteur
              libelle="Ville"
              valeur={villeId}
              onChange={setVilleId}
              options={[
                { valeur: '', libelle: 'Aucune ville' },
                ...(villes.etat.phase === 'pret' ? villes.etat.donnees.filter((v) => v.isActive || v.id === m.city?.id).map((v) => ({ valeur: v.id, libelle: v.name })) : []),
              ]}
            />
          </>
        }
      />
      <FenetreMotif
        ouverte={action === 'supprimer'}
        titre="Supprimer maintenant"
        consigne={`Suppression immédiate, sur demande écrite du membre : elle saute le délai de 7 jours et ne se défait pas. Saisissez son pseudo (@${m.handle}) pour confirmer.`}
        min={20}
        libelleConfirmer="Supprimer le compte"
        onConfirmer={(motif) => void executer(motif)}
        onFermer={fermer}
        occupe={geste.occupe || confirmation.trim().toLowerCase() !== m.handle.toLowerCase()}
        message={geste.message}
        enfants={<Champ libelle="Pseudo du membre" valeur={confirmation} onChange={setConfirmation} />}
      />
    </Carte>
  );
}
