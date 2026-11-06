'use client';

import { useEffect, useState } from 'react';
import {
  ADMIN_CONTENT_EDIT_FIELDS,
  ADMIN_CONTENT_TYPES,
  MAX_PAGE_LIMIT,
  adminContentActionResultSchema,
  adminContentDetailSchema,
  adminContentPageSchema,
  type AdminContentActionResult,
  type AdminContentField,
  type AdminContentRow,
  type AdminContentType,
} from '@app/shared';
import { staffApi } from '@/lib/api/index';
import { useDroit } from '../session-equipe';
import { Bandeau, Bouton, C, Carte, Champ, FenetreMotif, Lecture, Message, Pastille, Selecteur, Vide, ZoneTexte, dateCourte, useCharge, useGeste } from '../ui';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT — LES CONTENUS DES MEMBRES, GÉRÉS PAR L'ADMINISTRATION (15 §4)        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Avant : un contenu ne se retirait que par un dossier de modération (masquage logique), et rien ne se
 * supprimait. Ici, un type à la fois (les champs diffèrent), filtrable par texte, par ORIGINE DE L'AUTEUR et par
 * état, on peut :
 *
 *   · RETIRER      — logique et réversible (la ligne reste, l'application ne la montre plus) ;
 *   · RÉTABLIR     — ce qui a été retiré ;
 *   · SUPPRIMER    — définitivement, SUPER_ADMIN seul, avec un aperçu et la saisie du nombre d'éléments.
 *
 * Chaque geste demande un motif et laisse une trace au journal d'audit. Le serveur reste seul juge des droits : le
 * rôle de la session ÉTEINT ici ce qu'il ne peut pas employer.
 */

const TYPES: Record<AdminContentType, string> = {
  GUIDE: 'Guides',
  EVENT: 'Événements',
  POST: 'Publications',
  HELP_REQUEST: 'Entraide',
  HOUSING: 'Logements',
  JOB: 'Emplois',
  PRO: 'Professionnels',
  COMMUNITY: 'Réseaux',
};

const ORIGINES = [
  { valeur: '', libelle: 'Toutes les origines' },
  { valeur: 'MEMBER', libelle: 'Auteur inscrit par lui-même' },
  { valeur: 'SEED', libelle: 'Auteur de départ' },
];
const ETATS = [
  { valeur: 'active', libelle: 'En ligne' },
  { valeur: 'removed', libelle: 'Retirés' },
  { valeur: 'all', libelle: 'Tous' },
];

interface Filtres {
  readonly q: string;
  readonly origine: string;
  readonly etat: string;
  readonly du: string;
  readonly au: string;
}
const SANS_FILTRE: Filtres = { q: '', origine: '', etat: 'active', du: '', au: '' };

function requete(type: AdminContentType, f: Filtres, curseur?: string | null): string {
  const p = new URLSearchParams();
  p.set('type', type);
  if (f.q.trim().length >= 2) p.set('q', f.q.trim());
  if (f.origine !== '') p.set('origin', f.origine);
  p.set('state', f.etat);
  if (f.du !== '') p.set('createdFrom', f.du);
  if (f.au !== '') p.set('createdTo', f.au);
  p.set('limit', String(MAX_PAGE_LIMIT));
  if (curseur !== undefined && curseur !== null) p.set('cursor', curseur);
  return `/contents?${p.toString()}`;
}

type Geste = 'retirer' | 'retablir' | 'supprimer';
const CHEMINS: Record<Geste, 'remove' | 'restore' | 'erase'> = { retirer: 'remove', retablir: 'restore', supprimer: 'erase' };

function resumer(r: AdminContentActionResult, geste: Geste): string {
  const n = r.done;
  const mot = r.dryRun
    ? `Aperçu — rien n’est changé. Seraient ${geste === 'supprimer' ? 'supprimés définitivement' : geste === 'retirer' ? 'retirés' : 'rétablis'} : `
    : `${geste === 'supprimer' ? 'Supprimés définitivement' : geste === 'retirer' ? 'Retirés' : 'Rétablis'} : `;
  const refus = r.refused.length === 0 ? '' : ` ${r.refused.length} refusé${r.refused.length > 1 ? 's' : ''} : ${[...new Set(r.refused.map((x) => x.message))].join(' ; ')}`;
  return `${mot}${n} contenu${n > 1 ? 's' : ''}.${refus}`;
}

export function ContenusMembres() {
  const peutGerer = useDroit('content');
  const peutEffacer = useDroit('erase');
  const [type, setType] = useState<AdminContentType>('POST');
  const [saisie, setSaisie] = useState<Filtres>(SANS_FILTRE);
  const [filtres, setFiltres] = useState<Filtres>(SANS_FILTRE);
  const [coches, setCoches] = useState<ReadonlySet<string>>(new Set());
  const [dialogue, setDialogue] = useState<Geste | null>(null);
  const [nombre, setNombre] = useState('');
  const [rapport, setRapport] = useState<string | null>(null);
  const [aModifier, setAModifier] = useState<AdminContentRow | null>(null);
  const [plus, setPlus] = useState<{ readonly cle: string; readonly items: readonly AdminContentRow[]; readonly curseur: string | null } | null>(null);
  const geste = useGeste();
  const suite = useGeste();

  const cle = `${type}|${JSON.stringify(filtres)}`;
  const premiere = useCharge(() => staffApi.get(requete(type, filtres), adminContentPageSchema), cle);
  const page = premiere.etat.phase === 'pret' ? premiere.etat.donnees : null;
  const ajoutes = plus !== null && plus.cle === cle ? plus : null;
  const lignes = page === null ? [] : [...page.items, ...(ajoutes?.items ?? [])];
  const curseur = page === null ? null : ajoutes !== null ? ajoutes.curseur : page.nextCursor;

  const repartir = () => {
    setCoches(new Set());
    setPlus(null);
    setRapport(null);
  };
  const basculer = (id: string) =>
    setCoches((c) => {
      const n = new Set(c);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const chargerPlus = async () => {
    if (curseur === null) return;
    await suite.lancer(async () => {
      const p = await staffApi.get(requete(type, filtres, curseur), adminContentPageSchema);
      setPlus({ cle, items: [...(ajoutes?.items ?? []), ...p.items], curseur: p.nextCursor });
    });
  };

  const agir = async (g: Geste, dryRun: boolean, motif: string): Promise<boolean> =>
    geste.lancer(async () => {
      const r = await staffApi.post(`/contents/${CHEMINS[g]}`, adminContentActionResultSchema, {
        body: { items: [...coches].map((id) => ({ type, id })), reason: motif, confirmCount: coches.size, dryRun },
      });
      setRapport(resumer(r, g));
      if (!dryRun) {
        setCoches(new Set());
        setPlus(null);
        premiere.recharger();
      }
    });

  const TITRES: Record<Geste, string> = {
    retirer: `Retirer ${coches.size} contenu${coches.size > 1 ? 's' : ''}`,
    retablir: `Rétablir ${coches.size} contenu${coches.size > 1 ? 's' : ''}`,
    supprimer: `Supprimer définitivement ${coches.size} contenu${coches.size > 1 ? 's' : ''}`,
  };
  const CONSIGNES: Record<Geste, string> = {
    retirer: 'Le contenu n’est plus montré aux membres ; la ligne reste et peut être rétablie. Le motif est conservé au journal d’audit.',
    retablir: 'Le contenu redevient visible. S’il était indexé par la recherche, la réindexation de l’administration le rétablit.',
    supprimer: `Suppression définitive : le contenu et ce qui en dépend (commentaires, inscriptions…) disparaissent, rien ne se défait. Saisissez ${coches.size} pour confirmer, et lancez d’abord l’aperçu si vous avez un doute.`,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setFiltres(saisie);
          repartir();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
          <Selecteur
            libelle="Type de contenu"
            valeur={type}
            onChange={(v) => {
              setType(v as AdminContentType);
              repartir();
            }}
            options={ADMIN_CONTENT_TYPES.map((t) => ({ valeur: t, libelle: TYPES[t] }))}
          />
          <Selecteur libelle="Origine de l’auteur" valeur={saisie.origine} onChange={(origine) => setSaisie((s) => ({ ...s, origine }))} options={ORIGINES} />
          <Selecteur libelle="État" valeur={saisie.etat} onChange={(etat) => setSaisie((s) => ({ ...s, etat }))} options={ETATS} />
          <Champ libelle="Titre ou texte contient" valeur={saisie.q} onChange={(q) => setSaisie((s) => ({ ...s, q }))} placeholder="deux caractères au moins" />
          <Champ libelle="Créé du" type="date" valeur={saisie.du} onChange={(du) => setSaisie((s) => ({ ...s, du }))} />
          <Champ libelle="au" type="date" valeur={saisie.au} onChange={(au) => setSaisie((s) => ({ ...s, au }))} />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Bouton type="submit" ton="principal" disabled={saisie.q.trim().length === 1}>
            Appliquer
          </Bouton>
          <Bouton
            ton="contour"
            onClick={() => {
              setSaisie(SANS_FILTRE);
              setFiltres(SANS_FILTRE);
              repartir();
            }}
          >
            Réinitialiser
          </Bouton>
        </div>
      </form>

      {!peutGerer ? null : (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Bouton petit onClick={() => setCoches(new Set(lignes.map((l) => l.id)))} disabled={lignes.length === 0}>
            Tout sélectionner
          </Bouton>
          <Bouton petit ton="contour" onClick={() => setCoches(new Set())} disabled={coches.size === 0}>
            Tout désélectionner
          </Bouton>
          <span style={{ fontSize: '12.5px', color: C.gris }}>
            {coches.size} sélectionné{coches.size > 1 ? 's' : ''}
          </span>
          <Bouton petit disabled={coches.size === 0 || geste.occupe} onClick={() => setDialogue('retirer')}>
            Retirer
          </Bouton>
          <Bouton petit disabled={coches.size === 0 || geste.occupe} onClick={() => setDialogue('retablir')}>
            Rétablir
          </Bouton>
          {!peutEffacer ? null : (
            <>
              <Bouton
                petit
                disabled={coches.size === 0 || geste.occupe}
                onClick={() => void agir('supprimer', true, 'Aperçu avant suppression définitive (simulation).')}
              >
                Aperçu de la suppression
              </Bouton>
              <Bouton
                petit
                ton="sombre"
                disabled={coches.size === 0 || geste.occupe}
                onClick={() => {
                  setNombre('');
                  setDialogue('supprimer');
                }}
              >
                Supprimer définitivement
              </Bouton>
            </>
          )}
        </div>
      )}
      {rapport === null ? null : <Bandeau role="status">{rapport}</Bandeau>}
      <Message message={dialogue === null ? geste.message : null} />

      <Carte style={{ padding: '6px 0', overflow: 'hidden' }}>
        <Lecture etat={premiere.etat} recharger={premiere.recharger}>
          {() =>
            lignes.length === 0 ? (
              <Vide>Aucun contenu ne correspond.</Vide>
            ) : (
              <>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {lignes.map((l) => (
                    <li key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderBottom: `1px solid ${C.traitLeger}` }}>
                      {!peutGerer ? null : (
                        <input type="checkbox" checked={coches.has(l.id)} onChange={() => basculer(l.id)} aria-label={`Sélectionner « ${l.title} »`} />
                      )}
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</span>
                        <span style={{ display: 'block', fontSize: '12px', color: C.gris }}>
                          {l.authorHandle === null ? 'auteur supprimé' : `@${l.authorHandle}`} · {l.cityName ?? 'sans ville'} · {dateCourte(l.createdAt)}
                        </span>
                      </span>
                      {l.authorOrigin === 'SEED' ? <Pastille ton="sombre">Départ</Pastille> : null}
                      {!peutGerer ? null : (
                        <Bouton petit ton="contour" onClick={() => setAModifier(l)}>
                          Modifier
                        </Bouton>
                      )}
                      {l.removed ? <Pastille ton="terre">Retiré</Pastille> : null}
                    </li>
                  ))}
                </ul>
                <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12.5px', color: C.gris }}>
                    {lignes.length} contenu{lignes.length > 1 ? 's' : ''} affiché{lignes.length > 1 ? 's' : ''}
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

      <FenetreModification
        ligne={aModifier}
        onFermer={() => setAModifier(null)}
        onEnregistre={() => {
          setAModifier(null);
          setRapport('Contenu modifié. La correction est tracée au journal d’audit.');
          setPlus(null);
          premiere.recharger();
        }}
      />

      <FenetreMotif
        ouverte={dialogue !== null}
        titre={dialogue === null ? '' : TITRES[dialogue]}
        consigne={dialogue === null ? undefined : CONSIGNES[dialogue]}
        min={dialogue === 'supprimer' ? 20 : 10}
        libelleConfirmer={dialogue === 'supprimer' ? 'Supprimer définitivement' : dialogue === 'retablir' ? 'Rétablir' : 'Retirer'}
        onConfirmer={(motif) => {
          if (dialogue === null) return;
          void agir(dialogue, false, motif).then((ok) => {
            if (ok) setDialogue(null);
          });
        }}
        onFermer={() => {
          setDialogue(null);
          geste.effacer();
        }}
        occupe={geste.occupe || (dialogue === 'supprimer' && nombre.trim() !== String(coches.size))}
        message={geste.message}
        enfants={
          dialogue === 'supprimer' ? <Champ libelle={`Nombre de contenus (${coches.size})`} valeur={nombre} onChange={setNombre} inputMode="numeric" /> : undefined
        }
      />
    </div>
  );
}

// ── La correction d'un contenu ─────────────────────────────────────────────

type Valeurs = Record<string, string>;

/** « 2026-11-06T17:30:00.000Z » → « 2026-11-06T18:30 » (heure locale, pour un champ datetime-local). */
function versChampDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const deux = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}T${deux(d.getHours())}:${deux(d.getMinutes())}`;
}

function Formulaire({
  champs,
  valeurs,
  onChange,
}: {
  readonly champs: readonly AdminContentField[];
  readonly valeurs: Valeurs;
  readonly onChange: (cle: string, v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {champs.map((c) => {
        const v = valeurs[c.key] ?? '';
        const libelle = c.optional === true ? `${c.label} (facultatif)` : c.label;
        if (c.kind === 'textarea') {
          return <ZoneTexte key={c.key} libelle={libelle} valeur={v} onChange={(x) => onChange(c.key, x)} lignes={c.key === 'body' ? 8 : 4} {...(c.max === undefined ? {} : { maxLength: c.max })} />;
        }
        if (c.kind === 'select') {
          return (
            <Selecteur
              key={c.key}
              libelle={libelle}
              valeur={v}
              onChange={(x) => onChange(c.key, x)}
              options={(c.options ?? []).map((o) => ({ valeur: o.value, libelle: o.label }))}
            />
          );
        }
        return (
          <Champ
            key={c.key}
            libelle={libelle}
            valeur={v}
            onChange={(x) => onChange(c.key, x)}
            type={c.kind === 'datetime' ? 'datetime-local' : c.kind === 'number' ? 'number' : 'text'}
            {...(c.kind === 'number' ? { inputMode: 'numeric' as const } : {})}
            {...(c.kind === 'text' && c.max !== undefined ? { maxLength: c.max } : {})}
          />
        );
      })}
    </div>
  );
}

function FenetreModification({
  ligne,
  onFermer,
  onEnregistre,
}: {
  readonly ligne: AdminContentRow | null;
  readonly onFermer: () => void;
  readonly onEnregistre: () => void;
}) {
  const champs = ligne === null ? [] : ADMIN_CONTENT_EDIT_FIELDS[ligne.type];
  const [initiales, setInitiales] = useState<Valeurs | null>(null);
  const [valeurs, setValeurs] = useState<Valeurs>({});
  const lecture = useGeste();
  const envoi = useGeste();

  useEffect(() => {
    if (ligne === null) {
      setInitiales(null);
      setValeurs({});
      return;
    }
    let annule = false;
    void lecture.lancer(async () => {
      const d = await staffApi.get(`/contents/${ligne.type}/${ligne.id}`, adminContentDetailSchema);
      if (annule) return;
      const v: Valeurs = {};
      for (const c of ADMIN_CONTENT_EDIT_FIELDS[ligne.type]) {
        const brut = d.values[c.key];
        v[c.key] = brut === null || brut === undefined ? '' : c.kind === 'datetime' ? versChampDate(String(brut)) : String(brut);
      }
      setInitiales(v);
      setValeurs(v);
    });
    return () => {
      annule = true;
    };
  }, [ligne]);

  const enregistrer = (motif: string) => {
    if (ligne === null || initiales === null) return;
    const changes: Record<string, string | number | null> = {};
    for (const c of champs) {
      const nouveau = valeurs[c.key] ?? '';
      if (nouveau === (initiales[c.key] ?? '')) continue;
      if (nouveau.trim() === '') changes[c.key] = null;
      else if (c.kind === 'number') changes[c.key] = Number(nouveau);
      else if (c.kind === 'datetime') changes[c.key] = new Date(nouveau).toISOString();
      else changes[c.key] = nouveau;
    }
    if (Object.keys(changes).length === 0) {
      envoi.prevenir('Aucune modification à enregistrer.');
      return;
    }
    void envoi
      .lancer(() => staffApi.patch(`/contents/${ligne.type}/${ligne.id}`, adminContentDetailSchema, { body: { reason: motif, changes } }))
      .then((ok) => {
        if (ok) onEnregistre();
      });
  };

  return (
    <FenetreMotif
      ouverte={ligne !== null}
      titre={ligne === null ? '' : `Modifier : ${ligne.title}`}
      consigne="La correction s'applique tout de suite. Le motif est conservé au journal d'audit avec les anciennes et nouvelles valeurs."
      min={10}
      libelleConfirmer="Enregistrer"
      onConfirmer={enregistrer}
      onFermer={() => {
        envoi.effacer();
        onFermer();
      }}
      occupe={envoi.occupe || initiales === null}
      message={envoi.message ?? lecture.message}
      enfants={
        initiales === null ? (
          <div style={{ fontSize: '13px', color: C.gris }}>Chargement…</div>
        ) : (
          <Formulaire champs={champs} valeurs={valeurs} onChange={(cle, v) => setValeurs((x) => ({ ...x, [cle]: v }))} />
        )
      }
    />
  );
}
