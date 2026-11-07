'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { z } from 'zod';
import {
  MAX_PAGE_LIMIT,
  VerificationLevel,
  adminMemberDetailSchema,
  adminMembersResponseSchema,
  memberBulkEraseResultSchema,
  memberNoteSchema,
  okResponseSchema,
  type AdminMemberDetail,
  type AdminMemberSanction,
  type AdminMemberRow,
  type MemberBulkEraseResult,
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
  nombreFr,
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

type Action = 'retrograder' | 'corriger' | 'revoquer' | 'desactiver' | 'reactiver' | 'exporter' | 'supprimer' | 'debannir';

/** `POST /admin/users/:id/unban` rend la sanction levée, pas `{ ok }`. */
const debannissementSchema = z.object({ userId: z.string(), sanctionId: z.string() }).passthrough();

/** Ce que l'équipe lit une fois la fenêtre de motif refermée. */
const CONFIRMATIONS: Record<Action, string> = {
  debannir: 'Bannissement levé : le compte est réactivé et le numéro retiré de la liste noire.',
  retrograder: 'Niveau rétrogradé : le KYC est marqué refusé et le niveau recalculé.',
  revoquer: 'Sessions révoquées : le membre devra se reconnecter.',
  desactiver: 'Compte désactivé.',
  reactiver: 'Compte réactivé.',
  exporter: 'Export généré : le membre le retrouve dans son compte.',
  supprimer: 'Compte supprimé.',
  corriger: 'Phase ou ville corrigée.',
};

export function ContenuMembres() {
  return (
    <Suspense fallback={null}>
      <Interne />
    </Suspense>
  );
}

/** Les filtres de la liste. Une chaîne vide = pas de filtre. */
interface Filtres {
  readonly q: string;
  readonly origine: string;
  readonly niveau: string;
  readonly statut: string;
  readonly du: string;
  readonly au: string;
}

const SANS_FILTRE: Filtres = { q: '', origine: '', niveau: '', statut: '', du: '', au: '' };

const ORIGINES = [
  { valeur: '', libelle: 'Toutes les origines' },
  { valeur: 'MEMBER', libelle: 'Inscrits par eux-mêmes' },
  { valeur: 'SEED', libelle: 'Données de départ' },
];
const NIVEAUX = [
  { valeur: '', libelle: 'Tous les niveaux' },
  ...VerificationLevel.map((v) => ({ valeur: v, libelle: v.replace('L', 'N') })),
];
const STATUTS = [
  { valeur: '', libelle: 'Tous les statuts' },
  { valeur: 'ACTIVE', libelle: 'Actifs' },
  { valeur: 'DEACTIVATED', libelle: 'Désactivés' },
  { valeur: 'SUSPENDED', libelle: 'Suspendus' },
  { valeur: 'DELETED', libelle: 'Supprimés' },
];

function requete(f: Filtres, curseur?: string | null): string {
  const p = new URLSearchParams();
  if (f.q.trim().length >= 2) p.set('q', f.q.trim());
  if (f.statut !== '') p.set('status', f.statut);
  if (f.niveau !== '') p.set('level', f.niveau);
  if (f.origine !== '') p.set('origin', f.origine);
  if (f.du !== '') p.set('createdFrom', f.du);
  if (f.au !== '') p.set('createdTo', f.au);
  p.set('limit', String(MAX_PAGE_LIMIT));
  if (curseur !== undefined && curseur !== null) p.set('cursor', curseur);
  return `/users?${p.toString()}`;
}

/** Ce que l'équipe lit après un aperçu ou une suppression : les comptes, ce qui part avec eux, les refus. */
function resumer(r: MemberBulkEraseResult): string {
  const total: Record<string, number> = {};
  for (const e of r.erased) {
    for (const [nom, n] of Object.entries(e.removed)) {
      if (nom !== 'compte') total[nom] = (total[nom] ?? 0) + n;
    }
  }
  const detail = Object.entries(total)
    .map(([nom, n]) => `${n} ${nom}`)
    .join(', ');
  const refus =
    r.refused.length === 0
      ? ''
      : ` ${r.refused.length} refusé${r.refused.length > 1 ? 's' : ''} : ${[...new Set(r.refused.map((x) => x.message))].join(' ; ')}`;
  const n = r.erased.length;
  return `${r.dryRun ? 'Aperçu — rien n’est supprimé. Seraient supprimés : ' : 'Supprimé définitivement : '}${n} compte${n > 1 ? 's' : ''}${detail === '' ? '' : `, avec ${detail}`}.${refus}`;
}

function Interne() {
  const params = useSearchParams();
  const initial = params.get('q') ?? '';
  const [saisie, setSaisie] = useState<Filtres>({ ...SANS_FILTRE, q: initial });
  const [filtres, setFiltres] = useState<Filtres>({ ...SANS_FILTRE, q: initial });
  const [choisi, setChoisi] = useState<string | null>(null);
  const peutEffacer = useDroit('erase');
  const [coches, setCoches] = useState<ReadonlySet<string>>(new Set());
  const [confirmer, setConfirmer] = useState(false);
  const [nombre, setNombre] = useState('');
  const [rapport, setRapport] = useState<string | null>(null);
  const effacement = useGeste();

  useEffect(() => {
    setSaisie((s) => ({ ...s, q: initial }));
    setFiltres((f) => ({ ...f, q: initial }));
    setChoisi(null);
  }, [initial]);

  // Sans `q`, la route est une LISTE filtrée, la plus récente d'abord : l'écran n'est plus vide à l'ouverture.
  const cle = JSON.stringify(filtres);
  const premiere = useCharge(() => staffApi.get(requete(filtres), adminMembersResponseSchema), cle);
  const [plus, setPlus] = useState<{ readonly cle: string; readonly items: readonly AdminMemberRow[]; readonly curseur: string | null } | null>(null);
  const suite = useGeste();
  const page = premiere.etat.phase === 'pret' ? premiere.etat.donnees : null;
  const ajoutes = plus !== null && plus.cle === cle ? plus : null;
  const lignes = page === null ? [] : [...page.items, ...(ajoutes?.items ?? [])];
  const curseur = page === null ? null : ajoutes !== null ? ajoutes.curseur : page.nextCursor;

  const chargerPlus = async () => {
    if (curseur === null) return;
    await suite.lancer(async () => {
      const p = await staffApi.get(requete(filtres, curseur), adminMembersResponseSchema);
      setPlus({ cle, items: [...(ajoutes?.items ?? []), ...p.items], curseur: p.nextCursor });
    });
  };

  const basculer = (id: string) =>
    setCoches((c) => {
      const n = new Set(c);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  // Un compte déjà supprimé (anonymisé) ne se coche pas : il porte des preuves à conserver.
  const toutCocher = () => setCoches(new Set(lignes.filter((m) => m.status !== 'DELETED').map((m) => m.id)));

  const effacer = async (dryRun: boolean, motif: string): Promise<boolean> =>
    effacement.lancer(async () => {
      const r = await staffApi.post('/users/bulk-erase', memberBulkEraseResultSchema, {
        body: { ids: [...coches], reason: motif, confirmCount: coches.size, dryRun },
      });
      setRapport(resumer(r));
      if (!dryRun) {
        setCoches(new Set());
        setPlus(null);
        setChoisi(null);
        premiere.recharger();
      }
    });

  const maj = (patch: Partial<Filtres>) => setSaisie((s) => ({ ...s, ...patch }));
  const filtre = saisie.origine !== '' || saisie.niveau !== '' || saisie.statut !== '' || saisie.du !== '' || saisie.au !== '' || saisie.q !== '';

  return (
    <>
      <Titre titre="Membres" sous="Liste filtrable, la plus récente d'abord. Recherche par pseudo, nom ou numéro (empreinte, jamais affiché)." />
      <Colonnes gabarit="minmax(0,5fr) minmax(0,7fr)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              setFiltres(saisie);
              setPlus(null);
              setChoisi(null);
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
          >
            <Champ libelle="Rechercher" valeur={saisie.q} onChange={(q) => maj({ q })} placeholder="@pseudo, nom, +33 6 12…" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
              <Selecteur libelle="Origine" valeur={saisie.origine} onChange={(origine) => maj({ origine })} options={ORIGINES} />
              <Selecteur libelle="Niveau" valeur={saisie.niveau} onChange={(niveau) => maj({ niveau })} options={NIVEAUX} />
              <Selecteur libelle="Statut" valeur={saisie.statut} onChange={(statut) => maj({ statut })} options={STATUTS} />
              <span />
              <Champ libelle="Inscrit du" type="date" valeur={saisie.du} onChange={(du) => maj({ du })} />
              <Champ libelle="au" type="date" valeur={saisie.au} onChange={(au) => maj({ au })} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Bouton type="submit" ton="principal" disabled={saisie.q.trim().length === 1}>
                Appliquer
              </Bouton>
              <Bouton
                ton="contour"
                disabled={!filtre}
                onClick={() => {
                  setSaisie(SANS_FILTRE);
                  setFiltres(SANS_FILTRE);
                  setPlus(null);
                  setChoisi(null);
                }}
              >
                Réinitialiser
              </Bouton>
            </div>
          </form>
          {!peutEffacer ? null : (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <Bouton petit onClick={toutCocher} disabled={lignes.length === 0}>
                Tout sélectionner
              </Bouton>
              <Bouton petit ton="contour" onClick={() => setCoches(new Set())} disabled={coches.size === 0}>
                Tout désélectionner
              </Bouton>
              <span style={{ fontSize: '12.5px', color: C.gris }}>
                {coches.size} sélectionné{coches.size > 1 ? 's' : ''}
              </span>
              <Bouton
                petit
                disabled={coches.size === 0 || effacement.occupe}
                onClick={() => void effacer(true, 'Aperçu avant suppression définitive (simulation, rien n’est supprimé).')}
              >
                Aperçu de la suppression
              </Bouton>
              <Bouton
                petit
                ton="sombre"
                disabled={coches.size === 0 || effacement.occupe}
                onClick={() => {
                  setNombre('');
                  setConfirmer(true);
                }}
              >
                Supprimer définitivement
              </Bouton>
            </div>
          )}
          {rapport === null ? null : <Bandeau role="status">{rapport}</Bandeau>}
          <Message message={confirmer ? null : effacement.message} />
          <Carte style={{ padding: '6px 0', overflow: 'hidden' }}>
            <Lecture etat={premiere.etat} recharger={premiere.recharger}>
              {() =>
                lignes.length === 0 ? (
                  <Vide>Aucun membre ne correspond.</Vide>
                ) : (
                  <>
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                      {lignes.map((m) => (
                        <Ligne
                          key={m.id}
                          m={m}
                          actif={m.id === choisi}
                          onChoisir={() => setChoisi(m.id)}
                          selection={peutEffacer && m.status !== 'DELETED' ? { coche: coches.has(m.id), basculer: () => basculer(m.id) } : undefined}
                        />
                      ))}
                    </ul>
                    <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12.5px', color: C.gris }}>
                        {lignes.length} membre{lignes.length > 1 ? 's' : ''} affiché{lignes.length > 1 ? 's' : ''}
                        {curseur === null ? '' : ' — il en reste'}
                      </span>
                      {curseur === null ? null : (
                        <Bouton petit onClick={() => void chargerPlus()} disabled={suite.occupe}>
                          Afficher la suite
                        </Bouton>
                      )}
                      <Message message={suite.message} />
                    </div>
                  </>
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
      <FenetreMotif
        ouverte={confirmer}
        titre={`Supprimer définitivement ${coches.size} compte${coches.size > 1 ? 's' : ''}`}
        consigne={`Chaque compte part avec ses publications, événements, parcours, annonces et conversations privées. Rien ne se défait. Un compte qui porte des preuves à conserver (consentements, sanctions) est refusé : il se supprime par l’anonymisation RGPD. Saisissez ${coches.size} pour confirmer, et lancez d’abord l’aperçu si vous avez un doute.`}
        min={20}
        libelleConfirmer="Supprimer définitivement"
        onConfirmer={(motif) => {
          void effacer(false, motif).then((ok) => {
            if (ok) setConfirmer(false);
          });
        }}
        onFermer={() => {
          setConfirmer(false);
          effacement.effacer();
        }}
        occupe={effacement.occupe || nombre.trim() !== String(coches.size)}
        message={effacement.message}
        enfants={<Champ libelle={`Nombre de comptes (${coches.size})`} valeur={nombre} onChange={setNombre} inputMode="numeric" />}
      />
    </>
  );
}

function Ligne({
  m,
  actif,
  onChoisir,
  selection,
}: {
  readonly m: AdminMemberRow;
  readonly actif: boolean;
  readonly onChoisir: () => void;
  readonly selection?: { readonly coche: boolean; readonly basculer: () => void } | undefined;
}) {
  return (
    <li style={{ display: 'flex', alignItems: 'stretch', borderBottom: `1px solid ${C.traitLeger}` }}>
      {selection === undefined ? null : (
        <label style={{ display: 'flex', alignItems: 'center', padding: '0 4px 0 16px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={selection.coche}
            onChange={selection.basculer}
            aria-label={`Sélectionner @${m.handle}`}
          />
        </label>
      )}
      <button
        type="button"
        onClick={onChoisir}
        aria-current={actif}
        style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 'none', background: actif ? C.fond : '#fff', padding: '12px 16px', font: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.displayName}</span>
          <span style={{ display: 'block', fontSize: '12px', color: C.gris, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            @{m.handle} · {m.verificationLevel.replace('L', 'N')} · {m.city?.name ?? 'sans ville'}
          </span>
        </span>
        {m.origin === 'SEED' ? <Pastille ton="sombre">Départ</Pastille> : null}
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

const LIBELLE_SANCTION: Record<AdminMemberSanction['type'], string> = { WARNING: 'Avertissement', SUSPENSION: 'Suspension', BAN: 'Bannissement' };

/** En cours : ni levée, ni échue. Un bannissement (fin nulle) l'est tant qu'il n'est pas levé ; un avertissement n'a pas de durée. */
export function sanctionEnCours(x: Pick<AdminMemberSanction, 'type' | 'endsAt' | 'liftedAt'>, maintenant: number = Date.now()): boolean {
  return x.liftedAt === null && (x.endsAt === null ? x.type !== 'WARNING' : new Date(x.endsAt).getTime() > maintenant);
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
  /** Lever un bannissement : SUPER_ADMIN seul, comme `POST /admin/users/:id/unban`. */
  const peutDebannir = useDroit('staffAdmin');
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

  const [retour, setRetour] = useState<string | null>(null);
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
        case 'debannir':
          await staffApi.post(`/users/${m.id}/unban`, debannissementSchema, { body: { reason: motif } });
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
      // La confirmation vit HORS de la fenêtre (qui se ferme) : sans elle, l'équipe ne savait pas si le geste avait abouti.
      setRetour(CONFIRMATIONS[action]);
      noteGeste.effacer();
      recharger();
    }
  };

  const ajouterNote = async () => {
    const corps = memberNoteSchema.safeParse({ body: note });
    if (!corps.success) return;
    setRetour(null);
    const ok = await noteGeste.lancer(() => staffApi.post(`/users/${m.id}/note`, okResponseSchema, { body: corps.data }), 'Note ajoutée.');
    if (ok) {
      setNote('');
      recharger();
    }
  };

  const titreDroit = (ok: boolean, role: string) => (ok ? undefined : `Réservé : ${role}`);
  const kyc = m.kycVerifications.length;
  const sanctions = m.sanctions.length;
  const enCours = m.sanctions.filter((x) => sanctionEnCours(x));
  const banActif = m.sanctions.some((x) => x.type === 'BAN' && x.liftedAt === null);

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
        <Case titre="Sanctions">{sanctions === 0 ? 'Aucune' : `${enCours.length} en cours · ${sanctions} au total`}</Case>
        <Case titre="Sessions">{m.activeSessions.length} active{m.activeSessions.length > 1 ? 's' : ''}</Case>
        <Case titre="Consentements">
          {m.consents.length === 0 ? '—' : [...new Map(m.consents.map((c) => [c.type, c])).values()].map((c) => `${c.type === 'TERMS' ? 'CGU' : c.type === 'PRIVACY' ? 'confidentialité' : c.type} v${c.version}${c.granted ? '' : ' (refusé)'}`).join(' · ')}
        </Case>
        <Case titre="Inscription">{dateLongue(m.createdAt)}</Case>
      </div>

      {m.counts === undefined ? null : (
        <div data-compteurs-membre="" className="admin-cases" style={{ display: 'grid', gap: '8px' }}>
          <Case titre="Publications">{nombreFr(m.counts.posts)}</Case>
          <Case titre="Commentaires">{nombreFr(m.counts.comments)}</Case>
          <Case titre="Demandes d’aide">{nombreFr(m.counts.helpRequests)}</Case>
          <Case titre="Réponses d’aide">{nombreFr(m.counts.helpResponses)}</Case>
          <Case titre="Guides">{nombreFr(m.counts.guides)}</Case>
          <Case titre="Messages signalés">{nombreFr(m.counts.reportedMessages)}</Case>
          <Case titre="Dossiers de modération">
            {nombreFr(m.counts.moderationCases)}
            {m.counts.openModerationCases > 0 ? ` · ${nombreFr(m.counts.openModerationCases)} ouvert${m.counts.openModerationCases > 1 ? 's' : ''}` : ''}
          </Case>
          <Case titre="Signalements faits">{nombreFr(m.counts.reportsMade)}</Case>
        </div>
      )}

      <div data-sanctions-membre="" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Etiquette>Sanctions · en cours et historique</Etiquette>
        {sanctions === 0 ? (
          <div style={{ fontSize: '13px', color: C.gris }}>Aucune sanction.</div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {m.sanctions.map((x) => (
              <li key={x.id} style={{ background: C.fond, borderRadius: '12px', padding: '8px 12px', fontSize: '13px', display: 'flex', gap: '10px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <Pastille ton={sanctionEnCours(x) ? 'terre' : 'neutre'}>{sanctionEnCours(x) ? 'En cours' : x.liftedAt !== null ? 'Levée' : 'Terminée'}</Pastille>
                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                  <strong>{LIBELLE_SANCTION[x.type]}</strong> · {x.reason}
                  <div style={{ fontSize: '11.5px', color: C.grisClair, marginTop: '2px' }}>
                    Du {dateCourte(x.startsAt)} {x.endsAt === null ? '· définitive' : `au ${dateCourte(x.endsAt)}`}
                    {x.liftedAt === null ? '' : ` · levée le ${dateCourte(x.liftedAt)}`}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {banActif ? (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Bouton petit disabled={!peutDebannir || supprime} titre={titreDroit(peutDebannir, 'administrateurs')} onClick={() => setAction('debannir')}>
              Lever le bannissement
            </Bouton>
            {peutDebannir ? null : <span style={{ fontSize: '12px', color: C.gris }}>Réservé : administrateurs</span>}
          </div>
        ) : null}
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
      {retour === null ? null : <Bandeau role="status">{retour}</Bandeau>}
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
            debannir: 'Lever le bannissement',
            corriger: '',
            supprimer: '',
          }[action ?? 'exporter']
        }
        consigne={
          action === 'retrograder'
            ? 'Le KYC est marqué refusé et le niveau recalculé. Le motif est conservé au journal d’audit.'
            : action === 'exporter'
              ? 'L’archive est préparée sans le délai de 30 jours ; le membre la retrouve dans son compte.'
              : action === 'debannir'
                ? 'Le bannissement est levé, le compte redevient actif et son numéro quitte la liste noire : il pourra se réinscrire. L’action est tracée au journal d’audit.'
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
