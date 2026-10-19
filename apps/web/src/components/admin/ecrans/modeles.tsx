'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  adminCorrectionsResponseSchema,
  adminPreviewSchema,
  adminMigrationsResponseSchema,
  adminPublishResponseSchema,
  adminTemplatesResponseSchema,
  adminVersionSchema,
  okResponseSchema,
} from '@app/shared';
import { staffApi } from '@/lib/api/index';
import { toutesLesDefinitions } from '../donnees';
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
  Interrupteur,
  Lecture,
  Message,
  Pastille,
  Selecteur,
  Titre,
  Vide,
  useCharge,
  useGeste,
} from '../ui';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT — D06 · LES MODÈLES DE PARCOURS ET LEURS VERSIONS (03 §5.2)           ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La maquette dessine un brouillon « Études · v2026 » de sept étapes, un panneau de
 * propriétés et un bouton « Publier » inerte. Ici, chaque geste est réel :
 *
 *   · les onglets listent les versions réelles (type · numéro · statut) ;
 *   · « Nouveau brouillon » copie la version publiée (ou part de zéro) ;
 *   · l'éditeur recompose le brouillon — ajout depuis la bibliothèque, retrait,
 *     ordre (▲ ▼), nom affiché, « jours avant l'arrivée », optionnel, dépendances —
 *     et « Enregistrer » envoie la composition entière (`PUT /versions/:id/steps`) ;
 *   · « Prévisualiser » montre le rendu tel que le voit un membre ;
 *   · « Publier » vérifie côté serveur (au moins une étape, pas de boucle) et ARCHIVE la
 *     version précédente.
 *
 * ⚠ ÉCART REMONTÉ : la maquette promet « 142 parcours en cours seront notifiés à la
 * publication ». La notification « la procédure a évolué » n'existe pas côté serveur
 * (aucun type de notification ni consommateur d'événement). L'écran dit donc ce qui est
 * VRAI : les parcours en cours RESTENT sur leur version (règle dure 03 §2.2), avec leur
 * nombre réel — et le suivi « parcours restés sur une version archivée » (15 §5.2) est
 * affiché en bas.
 *
 * Le glisser-déposer que T5 décrit n'est pas transcodable (une image ne dessine pas un
 * geste) : l'ordre se change par ▲ ▼, au clavier comme au toucher.
 */

interface EtapeLocale {
  readonly uid: string;
  readonly stepDefinitionId: string;
  readonly code: string;
  readonly nomBiblio: string;
  readonly nom: string;
  readonly optionnelle: boolean;
  readonly jours: string;
  readonly risque: boolean;
}

let compteur = 0;
const uid = () => `e${(compteur += 1)}`;

const STATUTS = { DRAFT: 'brouillon', PUBLISHED: 'publiée', ARCHIVED: 'archivée' } as const;

function libelleJours(j: string): string {
  if (j.trim() === '') return '—';
  const n = Number(j);
  if (Number.isNaN(n)) return '—';
  return n >= 0 ? `J-${n}` : `J+${Math.abs(n)}`;
}

export function ContenuModeles() {
  const peut = useDroit('content');
  const modeles = useCharge(() => staffApi.get('/journey-templates/templates', adminTemplatesResponseSchema), 'modeles');
  const [choisie, setChoisie] = useState<string | null>(null);

  const versions = useMemo(
    () =>
      modeles.etat.phase === 'pret'
        ? modeles.etat.donnees.items.flatMap((t) => t.versions.map((v) => ({ ...v, modele: t })))
        : [],
    [modeles.etat],
  );

  useEffect(() => {
    if (choisie === null && versions.length > 0) {
      const premier = versions.find((v) => v.status === 'DRAFT') ?? versions.find((v) => v.status === 'PUBLISHED') ?? versions[0];
      if (premier !== undefined) setChoisie(premier.id);
    }
  }, [choisie, versions]);

  return (
    <>
      <Lecture etat={modeles.etat} recharger={modeles.recharger}>
        {(donnees) => (
          <>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }} role="tablist" aria-label="Versions">
              {versions.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  role="tab"
                  aria-selected={v.id === choisie}
                  onClick={() => setChoisie(v.id)}
                  style={{ height: '36px', padding: '0 14px', borderRadius: '999px', border: v.id === choisie ? 'none' : `1px solid ${C.trait}`, background: v.id === choisie ? C.encre : '#fff', color: v.id === choisie ? '#fff' : C.encre, font: 'inherit', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
                >
                  {v.modele.nameFr} · v{v.version} {STATUTS[v.status]}
                </button>
              ))}
              {peut ? <NouveauBrouillon modeles={donnees.items} onFait={(id) => { setChoisie(id); modeles.recharger(); }} /> : null}
            </div>
            {choisie === null ? (
              <Carte>
                <Vide>Aucune version. Créez un brouillon pour commencer.</Vide>
              </Carte>
            ) : (
              <Editeur key={choisie} versionId={choisie} peut={peut} onChange={modeles.recharger} journeysOnCurrent={versions.find((v) => v.id === choisie)?.journeyCount ?? 0} />
            )}
          </>
        )}
      </Lecture>
      <Corrections peut={peut} />
      <Migrations />
    </>
  );
}

function NouveauBrouillon({ modeles, onFait }: { readonly modeles: readonly { id: string; nameFr: string }[]; readonly onFait: (id: string) => void }) {
  const [ouverte, setOuverte] = useState(false);
  const [modele, setModele] = useState(modeles[0]?.id ?? '');
  const [copier, setCopier] = useState(true);
  const geste = useGeste();
  const creer = async () => {
    let id = '';
    const ok = await geste.lancer(async () => {
      const v = await staffApi.post(`/journey-templates/templates/${modele}/versions`, adminVersionSchema, { body: { copyPublished: copier } });
      id = v.id;
    });
    if (ok) {
      setOuverte(false);
      onFait(id);
    }
  };
  return (
    <>
      <Bouton petit ton="principal" onClick={() => setOuverte(true)} disabled={modeles.length === 0}>
        + Nouveau brouillon
      </Bouton>
      <Fenetre ouverte={ouverte} titre="Nouveau brouillon" onFermer={() => setOuverte(false)}>
        <Selecteur libelle="Type de parcours" valeur={modele} onChange={setModele} options={modeles.map((m) => ({ valeur: m.id, libelle: m.nameFr }))} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', fontWeight: 600 }}>
          <Interrupteur actif={copier} onChange={setCopier} libelle="Partir de la version publiée" />
          Partir de la version publiée
        </div>
        <Message message={geste.message} />
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Bouton onClick={() => setOuverte(false)}>Annuler</Bouton>
          <Bouton ton="principal" onClick={() => void creer()} disabled={geste.occupe}>
            Créer le brouillon
          </Bouton>
        </div>
      </Fenetre>
    </>
  );
}

function Editeur({ versionId, peut, onChange, journeysOnCurrent }: { readonly versionId: string; readonly peut: boolean; readonly onChange: () => void; readonly journeysOnCurrent: number }) {
  const version = useCharge(() => staffApi.get(`/journey-templates/versions/${versionId}`, adminVersionSchema), versionId);
  const biblio = useCharge(() => toutesLesDefinitions(), 'biblio');
  const [etapes, setEtapes] = useState<readonly EtapeLocale[]>([]);
  const [deps, setDeps] = useState<readonly (readonly [string, string])[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [ajout, setAjout] = useState('');
  const [sale, setSale] = useState(false);
  const [apercu, setApercu] = useState(false);
  const [publier, setPublier] = useState(false);
  const geste = useGeste();
  const publication = useGeste();

  useEffect(() => {
    if (version.etat.phase !== 'pret') return;
    const v = version.etat.donnees;
    const locales = v.steps.map<EtapeLocale>((s) => ({
      uid: uid(),
      stepDefinitionId: s.stepDefinitionId,
      code: s.code,
      nomBiblio: s.nameFr,
      nom: s.nameFr,
      optionnelle: s.isOptional,
      jours: s.daysBeforeArrival === null ? '' : String(s.daysBeforeArrival),
      risque: s.isRisky,
    }));
    setEtapes(locales);
    setDeps(v.dependencies.flatMap((d) => {
      const a = locales[d.step];
      const b = locales[d.dependsOn];
      return a === undefined || b === undefined ? [] : [[a.uid, b.uid] as const];
    }));
    setSel(locales[0]?.uid ?? null);
    setSale(false);
  }, [version.etat]);

  const brouillon = version.etat.phase === 'pret' && version.etat.donnees.status === 'DRAFT';
  const editable = brouillon && peut;
  const etapeSel = etapes.find((e) => e.uid === sel) ?? null;
  const maj = (id: string, patch: Partial<EtapeLocale>) => {
    setEtapes((l) => l.map((e) => (e.uid === id ? { ...e, ...patch } : e)));
    setSale(true);
  };
  const deplacer = (i: number, delta: -1 | 1) => {
    setEtapes((l) => {
      const j = i + delta;
      if (j < 0 || j >= l.length) return l;
      const copie = [...l];
      const a = copie[i];
      const b = copie[j];
      if (a === undefined || b === undefined) return l;
      copie[i] = b;
      copie[j] = a;
      return copie;
    });
    setSale(true);
  };
  const retirer = (id: string) => {
    setEtapes((l) => l.filter((e) => e.uid !== id));
    setDeps((d) => d.filter(([a, b]) => a !== id && b !== id));
    setSel((s) => (s === id ? null : s));
    setSale(true);
  };
  const ajouter = () => {
    if (biblio.etat.phase !== 'pret') return;
    const def = biblio.etat.donnees.find((d) => d.id === ajout);
    if (def === undefined) return;
    const e: EtapeLocale = { uid: uid(), stepDefinitionId: def.id, code: def.code, nomBiblio: def.nameFr, nom: def.nameFr, optionnelle: false, jours: '', risque: def.isRisky };
    setEtapes((l) => [...l, e]);
    setSel(e.uid);
    setSale(true);
  };
  const basculerDep = (de: string, vers: string) => {
    setDeps((d) => (d.some(([a, b]) => a === de && b === vers) ? d.filter(([a, b]) => !(a === de && b === vers)) : [...d, [de, vers] as const]));
    setSale(true);
  };

  const corps = () => ({
    steps: etapes.map((e) => ({
      stepDefinitionId: e.stepDefinitionId,
      isOptional: e.optionnelle,
      daysBeforeArrival: e.jours.trim() === '' || Number.isNaN(Number(e.jours)) ? null : Math.trunc(Number(e.jours)),
      overrides: e.nom.trim() !== e.nomBiblio ? { nameFr: e.nom.trim() } : null,
    })),
    dependencies: deps.flatMap(([a, b]) => {
      const i = etapes.findIndex((e) => e.uid === a);
      const j = etapes.findIndex((e) => e.uid === b);
      return i < 0 || j < 0 ? [] : [{ step: i, dependsOn: j }];
    }),
  });

  const enregistrer = async (): Promise<boolean> => {
    const ok = await geste.lancer(() => staffApi.put(`/journey-templates/versions/${versionId}/steps`, adminVersionSchema, { body: corps() }), 'Brouillon enregistré.');
    if (ok) {
      setSale(false);
      onChange();
    }
    return ok;
  };

  const confirmerPublication = async () => {
    if (sale && !(await enregistrer())) return;
    const ok = await publication.lancer(() => staffApi.post(`/journey-templates/versions/${versionId}/publish`, adminPublishResponseSchema, { body: {} }), 'Version publiée.');
    if (ok) {
      setPublier(false);
      version.recharger();
      onChange();
    }
  };

  return (
    <Lecture etat={version.etat} recharger={version.recharger}>
      {(v) => (
        <>
          <Titre
            titre={`Parcours ${v.template.nameFr} · version ${v.version}`}
            sous={`${STATUTS[v.status][0]?.toUpperCase() ?? ''}${STATUTS[v.status].slice(1)} · ${v.originCountry?.nameFr ?? 'générique (tous pays)'} · ${v.journeyCount} parcours en cours sur cette version`}
            action={
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <Bouton ton="secondaire" onClick={() => setApercu(true)}>
                  Prévisualiser
                </Bouton>
                {editable ? (
                  <Bouton ton="contour" onClick={() => void enregistrer()} disabled={!sale || geste.occupe}>
                    Enregistrer
                  </Bouton>
                ) : null}
                {editable ? (
                  <Bouton ton="principal" onClick={() => setPublier(true)} disabled={etapes.length === 0}>
                    Publier
                  </Bouton>
                ) : null}
              </div>
            }
          />
          <Message message={geste.message} />
          {!brouillon ? <Bandeau>Cette version est {STATUTS[v.status]} : elle est figée. Créez un brouillon pour la faire évoluer.</Bandeau> : null}
          <Colonnes gabarit="minmax(0,1.5fr) minmax(0,1fr)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {etapes.length === 0 ? (
                <Carte>
                  <Vide>Aucune étape : ajoutez-en depuis la bibliothèque.</Vide>
                </Carte>
              ) : null}
              {etapes.map((e, i) => (
                <div
                  key={e.uid}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', border: e.uid === sel ? `1.5px solid ${C.vert}` : `1px solid ${C.trait}`, borderRadius: '16px', padding: '8px 12px', minWidth: 0 }}
                >
                  <button type="button" onClick={() => setSel(e.uid)} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '10px', border: 'none', background: 'none', font: 'inherit', textAlign: 'left', cursor: 'pointer', padding: '6px 0' }}>
                    <span style={{ width: '20px', color: C.grisClair, fontSize: '12px', fontWeight: 700 }}>{i + 1}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: '14px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.nom}</span>
                    {e.optionnelle ? <Pastille>Optionnel</Pastille> : null}
                    {e.risque ? <Pastille ton="terre">À risque</Pastille> : null}
                    <span style={{ fontSize: '12px', color: C.gris, minWidth: '52px', textAlign: 'right' }}>{libelleJours(e.jours)}</span>
                  </button>
                  {editable ? (
                    <span style={{ display: 'flex', gap: '2px' }}>
                      <Bouton petit ton="contour" titre="Monter" disabled={i === 0} onClick={() => deplacer(i, -1)}>
                        ▲
                      </Bouton>
                      <Bouton petit ton="contour" titre="Descendre" disabled={i === etapes.length - 1} onClick={() => deplacer(i, 1)}>
                        ▼
                      </Bouton>
                      <Bouton petit ton="contour" titre="Retirer l’étape" onClick={() => retirer(e.uid)}>
                        ×
                      </Bouton>
                    </span>
                  ) : null}
                </div>
              ))}
              {editable ? (
                <Carte style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <Selecteur
                      libelle="Ajouter une étape de la bibliothèque"
                      valeur={ajout}
                      onChange={setAjout}
                      options={[{ valeur: '', libelle: 'Choisir…' }, ...(biblio.etat.phase === 'pret' ? biblio.etat.donnees.map((d) => ({ valeur: d.id, libelle: `${d.code} · ${d.nameFr}` })) : [])]}
                    />
                  </div>
                  <Bouton ton="principal" disabled={ajout === ''} onClick={ajouter}>
                    Ajouter
                  </Bouton>
                </Carte>
              ) : null}
            </div>

            <Carte style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Etiquette>Propriétés{etapeSel === null ? '' : ` · ${etapeSel.code}`}</Etiquette>
              {etapeSel === null ? (
                <Vide>Choisissez une étape.</Vide>
              ) : (
                <>
                  <Champ libelle="Nom affiché" valeur={etapeSel.nom} onChange={(x) => maj(etapeSel.uid, { nom: x })} disabled={!editable} />
                  <Champ libelle="Jours avant l’arrivée (négatif : après)" valeur={etapeSel.jours} onChange={(x) => maj(etapeSel.uid, { jours: x.replace(/[^\d-]/g, '') })} inputMode="numeric" disabled={!editable} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', fontWeight: 700 }}>
                    <span style={{ flex: 1 }}>Optionnel</span>
                    <Interrupteur actif={etapeSel.optionnelle} onChange={(x) => maj(etapeSel.uid, { optionnelle: x })} libelle="Optionnel" disabled={!editable} />
                  </div>
                  <div>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' }}>Dépend de</div>
                    {etapes.filter((e) => e.uid !== etapeSel.uid).length === 0 ? (
                      <div style={{ fontSize: '13px', color: C.gris }}>Aucune autre étape.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {etapes
                          .filter((e) => e.uid !== etapeSel.uid)
                          .map((e) => (
                            <label key={e.uid} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px' }}>
                              <input type="checkbox" disabled={!editable} checked={deps.some(([a, b]) => a === etapeSel.uid && b === e.uid)} onChange={() => basculerDep(etapeSel.uid, e.uid)} />
                              {e.nom}
                            </label>
                          ))}
                      </div>
                    )}
                  </div>
                </>
              )}
              {brouillon ? (
                <Bandeau ton="attention">
                  {journeysOnCurrent > 0 || v.journeyCount > 0
                    ? 'Publier n’efface rien : les parcours en cours restent sur leur version actuelle.'
                    : 'Publier archive la version publiée ; les parcours déjà créés restent sur leur version.'}
                </Bandeau>
              ) : null}
            </Carte>
          </Colonnes>

          <Apercu versionId={versionId} ouverte={apercu} onFermer={() => setApercu(false)} />
          <FenetreMotif
            ouverte={publier}
            titre={`Publier la version ${v.version}`}
            consigne={`La version devient celle que prennent les nouveaux parcours ; la précédente est archivée. Les parcours en cours restent sur leur version.${sale ? ' Les modifications non enregistrées le seront d’abord.' : ''}`}
            min={0}
            motifRequis={false}
            libelleConfirmer="Publier"
            onConfirmer={() => void confirmerPublication()}
            onFermer={() => setPublier(false)}
            occupe={publication.occupe || geste.occupe}
            message={publication.message ?? geste.message}
          />
        </>
      )}
    </Lecture>
  );
}

function Apercu({ versionId, ouverte, onFermer }: { readonly versionId: string; readonly ouverte: boolean; readonly onFermer: () => void }) {
  const { etat, recharger } = useCharge(
    () => (ouverte ? staffApi.get(`/journey-templates/versions/${versionId}/preview`, adminPreviewSchema) : Promise.resolve(null)),
    `${versionId}:${String(ouverte)}`,
  );
  return (
    <Fenetre ouverte={ouverte} titre="Aperçu · tel que le voit un membre" onFermer={onFermer} large>
      <Lecture etat={etat} recharger={recharger}>
        {(p) =>
          p === null ? null : (
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {p.steps.map((s) => (
                <li key={s.position} style={{ border: `1px solid ${C.trait}`, borderRadius: '16px', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '14px' }}>
                      {s.position}. {s.nameFr}
                    </strong>
                    {s.isOptional ? <Pastille>Optionnel</Pastille> : null}
                    {s.daysBeforeArrival === null ? null : <Pastille ton="vert">{libelleJours(String(s.daysBeforeArrival))}</Pastille>}
                  </div>
                  {s.description === null ? null : <div style={{ fontSize: '13px', color: C.gris, marginTop: '4px' }}>{s.description}</div>}
                  {s.riskMessage === null ? null : <div style={{ marginTop: '6px' }}><Bandeau ton="attention">{s.riskMessage}</Bandeau></div>}
                  {s.documentChecklist.length === 0 ? null : <div style={{ fontSize: '12.5px', marginTop: '6px' }}>Documents : {s.documentChecklist.join(' · ')}</div>}
                  {s.dependsOn.length === 0 ? null : <div style={{ fontSize: '12.5px', color: C.grisClair, marginTop: '4px' }}>Après l’étape {s.dependsOn.join(', ')}</div>}
                </li>
              ))}
            </ol>
          )
        }
      </Lecture>
    </Fenetre>
  );
}

function Corrections({ peut }: { readonly peut: boolean }) {
  const { etat, recharger } = useCharge(() => staffApi.get('/journey-templates/correction-proposals?limit=20', adminCorrectionsResponseSchema), 'corrections');
  const [cible, setCible] = useState<string | null>(null);
  const geste = useGeste();
  const decider = async (id: string, corps: { decision: 'ACCEPT' } | { decision: 'REJECT'; reason: string }) => {
    const ok = await geste.lancer(() => staffApi.post(`/journey-templates/correction-proposals/${id}`, okResponseSchema, { body: corps }), corps.decision === 'ACCEPT' ? 'Correction acceptée : à reporter dans le brouillon.' : 'Correction rejetée.');
    if (ok) {
      setCible(null);
      recharger();
    }
  };
  return (
    <Carte style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <Etiquette>Corrections proposées par les membres</Etiquette>
      <Message message={geste.message} />
      <Lecture etat={etat} recharger={recharger}>
        {(d) =>
          d.items.length === 0 ? (
            <Vide>Aucune correction en attente.</Vide>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {d.items.map((c) => (
                <li key={c.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', borderTop: `1px solid ${C.traitLeger}`, paddingTop: '8px' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ fontSize: '13.5px', fontWeight: 700 }}>
                      {c.template} · v{c.version}
                      {c.step === null ? '' : ` · ${c.step.nameFr}`}
                    </div>
                    <div style={{ fontSize: '13px', color: C.gris }}>{c.message}</div>
                  </div>
                  <Bouton petit ton="principal" disabled={!peut || geste.occupe} onClick={() => void decider(c.id, { decision: 'ACCEPT' })}>
                    Accepter
                  </Bouton>
                  <Bouton petit disabled={!peut || geste.occupe} onClick={() => setCible(c.id)}>
                    Rejeter
                  </Bouton>
                </li>
              ))}
            </ul>
          )
        }
      </Lecture>
      <FenetreMotif
        ouverte={cible !== null}
        titre="Rejeter la correction"
        consigne="Le motif est conservé ; la proposition est classée."
        min={10}
        max={500}
        libelleConfirmer="Rejeter"
        onConfirmer={(motif) => (cible === null ? undefined : void decider(cible, { decision: 'REJECT', reason: motif }))}
        onFermer={() => setCible(null)}
        occupe={geste.occupe}
        message={geste.message}
      />
    </Carte>
  );
}

function Migrations() {
  const { etat, recharger } = useCharge(() => staffApi.get('/stats/migrations', adminMigrationsResponseSchema), 'migrations');
  return (
    <Carte style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <Etiquette>Parcours restés sur une version archivée</Etiquette>
      <Lecture etat={etat} recharger={recharger}>
        {(d) =>
          d.items.length === 0 ? (
            <Vide>Aucun parcours en cours sur une version archivée.</Vide>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {d.items.map((m) => (
                <li key={`${m.templateCode}-${m.version}`} style={{ display: 'flex', gap: '10px', padding: '8px 0', borderTop: `1px solid ${C.traitLeger}`, fontSize: '13.5px', flexWrap: 'wrap' }}>
                  <strong style={{ flex: 1, minWidth: '160px' }}>
                    {m.templateName} · v{m.version}
                  </strong>
                  <span>{m.journeys} parcours</span>
                  <span style={{ color: C.gris }}>{m.currentVersion === null ? 'aucune version publiée' : `version courante : v${m.currentVersion}`}</span>
                </li>
              ))}
            </ul>
          )
        }
      </Lecture>
    </Carte>
  );
}
