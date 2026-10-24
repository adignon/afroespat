'use client';

import { useEffect, useState } from 'react';
import { adminStatsPointsSchema, okResponseSchema, stepDefinitionWriteSchema, type AdminStepDefinition } from '@app/shared';
import { staffApi } from '@/lib/api/index';
import { toutesLesDefinitions } from '../donnees';
import { useDroit } from '../session-equipe';
import { Bandeau, Bouton, C, Carte, Champ, Colonnes, Etiquette, Fenetre, Interrupteur, Lecture, Message, Pastille, Selecteur, Titre, Vide, ZoneTexte, useCharge, useGeste } from '../ui';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT — D07 · LA BIBLIOTHÈQUE D'ÉTAPES ET SES STATISTIQUES (03 §2.1, 15 §5.2)║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La maquette dessinait trois définitions (« 84 définitions »), un éditeur de gabarit
 * et une carte de statistiques (« 4,6 sem. », « 21 % », « Appliquer comme durée
 * indicative »). Tout vient maintenant des routes :
 *
 *   · le tableau : `GET /journey-templates/step-definitions` (le total est celui du
 *     serveur, pas « 84 ») ;
 *   · l'éditeur : `PATCH /step-definitions/:id` — description, gabarit de blocage,
 *     checklist (un libellé par ligne, jamais un document : 03 §3.3), message de risque,
 *     durée indicative, jalon, risque, cible du bouton « Je suis bloqué » ;
 *   · les statistiques OBSERVÉES : `GET /stats/steps` et `/stats/blockers` (agrégés,
 *     jamais nominatifs — 15 §5.3), par définition. Le délai est en JOURS côté serveur ;
 *     l'écran l'écrit en semaines comme la maquette quand il dépasse sept jours.
 *   · « Appliquer comme durée indicative » écrit le délai médian dans
 *     `default_duration_days` : c'est la proposition de §5.2, tracée.
 *
 * Les statistiques ne sont JAMAIS montrées aux membres (règle dure 15 §5.2) : cet écran
 * est dans l'application d'équipe, derrière la session d'équipe.
 */

const CATEGORIES = [
  { valeur: 'PRE_DEPARTURE', libelle: 'Avant le départ' },
  { valeur: 'ARRIVAL', libelle: 'Arrivée' },
  { valeur: 'SETTLEMENT', libelle: 'Installation' },
];
const CIBLES = [
  { valeur: 'NONE', libelle: 'Aucune' },
  { valeur: 'HELP', libelle: 'Entraide' },
  { valeur: 'HOUSING', libelle: 'Annonces logement' },
  { valeur: 'JOBS', libelle: 'Emploi' },
  { valeur: 'MENTORSHIP', libelle: 'Parrainage' },
];
const libCat = (c: string) => CATEGORIES.find((x) => x.valeur === c)?.libelle ?? c;
const libCible = (c: string) => CIBLES.find((x) => x.valeur === c)?.libelle ?? c;

function duree(jours: number | null): string {
  if (jours === null) return '—';
  return jours >= 14 ? `${String(Math.round((jours / 7) * 10) / 10).replace('.', ',')} sem.` : `${jours} j`;
}

export function ContenuEtapes() {
  const peut = useDroit('content');
  const liste = useCharge(() => toutesLesDefinitions(), 'defs');
  const stats = useCharge(async () => {
    const [etapes, blocages] = await Promise.all([
      staffApi.get('/stats/steps', adminStatsPointsSchema),
      staffApi.get('/stats/blockers', adminStatsPointsSchema),
    ]);
    return [...etapes.items, ...blocages.items];
  }, 'stats');
  const [sel, setSel] = useState<string | null>(null);
  const [creer, setCreer] = useState(false);

  useEffect(() => {
    if (sel === null && liste.etat.phase === 'pret') setSel(liste.etat.donnees[0]?.id ?? null);
  }, [sel, liste.etat]);

  return (
    <>
      <Lecture etat={liste.etat} recharger={liste.recharger}>
        {(defs) => (
          <>
            <Titre
              titre="Bibliothèque d’étapes"
              sous={`${defs.length} définition${defs.length > 1 ? 's' : ''}`}
              action={
                <Bouton ton="principal" disabled={!peut} titre={peut ? undefined : 'Réservé : contenu'} onClick={() => setCreer(true)}>
                  + Nouvelle étape
                </Bouton>
              }
            />
            <Carte style={{ padding: 0, overflow: 'hidden' }}>
              <div data-admin-defile="" style={{ overflowX: 'auto' }}>
                <table data-admin-pile="" style={{ width: '100%', minWidth: '820px', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: C.grisClair, fontSize: '10.5px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                      {['Code', 'Nom', 'Catégorie', 'Durée', 'Blocage', 'Jalon', 'Risque', 'Guide lié'].map((h) => (
                        <th key={h} style={{ padding: '12px 14px', fontWeight: 700 }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {defs.map((d) => (
                      <tr
                        key={d.id}
                        onClick={() => setSel(d.id)}
                        aria-selected={d.id === sel}
                        style={{ borderTop: `1px solid ${C.traitLeger}`, cursor: 'pointer', background: d.id === sel ? C.fond : '#fff' }}
                      >
                        <td style={{ padding: '10px 14px', fontWeight: 700 }}>{d.code}</td>
                        <td style={{ padding: '10px 14px' }}>{d.nameFr}</td>
                        <td data-etiquette="Catégorie" style={{ padding: '10px 14px' }}>{libCat(d.category)}</td>
                        <td data-etiquette="Durée" style={{ padding: '10px 14px' }}>{duree(d.defaultDurationDays)}</td>
                        <td data-etiquette="Blocage" style={{ padding: '10px 14px' }}>{libCible(d.blockerTarget)}</td>
                        <td data-etiquette="Jalon" style={{ padding: '10px 14px' }}>{d.isMajorMilestone ? 'Oui' : 'Non'}</td>
                        <td style={{ padding: '10px 14px' }}>{d.isRisky ? <Pastille ton="terre">À risque</Pastille> : <Pastille>—</Pastille>}</td>
                        <td data-etiquette="Guide" style={{ padding: '10px 14px' }}>{d.guideTitle ?? 'guide à venir'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Carte>
            {sel === null ? null : (
              <Editeur
                key={sel}
                def={defs.find((d) => d.id === sel) ?? null}
                peut={peut}
                points={stats.etat.phase === 'pret' ? stats.etat.donnees : null}
                onChange={liste.recharger}
              />
            )}
            <Creation ouverte={creer} onFermer={() => setCreer(false)} onFait={(id) => { setCreer(false); setSel(id); liste.recharger(); }} />
          </>
        )}
      </Lecture>
    </>
  );
}

function Editeur({ def, peut, points, onChange }: { readonly def: AdminStepDefinition | null; readonly peut: boolean; readonly points: readonly { metric: string; dimension: string; value: number }[] | null; readonly onChange: () => void }) {
  const geste = useGeste();
  const [nom, setNom] = useState(def?.nameFr ?? '');
  const [description, setDescription] = useState(def?.description ?? '');
  const [gabarit, setGabarit] = useState(def?.blockerTemplate ?? '');
  const [checklist, setChecklist] = useState((def?.documentChecklist ?? []).join('\n'));
  const [message, setMessage] = useState(def?.riskMessage ?? '');
  const [dureeJ, setDureeJ] = useState(def?.defaultDurationDays === null || def === null ? '' : String(def.defaultDurationDays));
  const [jalon, setJalon] = useState(def?.isMajorMilestone ?? false);
  const [risque, setRisque] = useState(def?.isRisky ?? false);
  const [categorie, setCategorie] = useState(def?.category ?? 'ARRIVAL');
  const [cible, setCible] = useState(def?.blockerTarget ?? 'NONE');
  if (def === null) return null;

  const lire = (metric: string) => points?.find((p) => p.metric === metric && p.dimension === def.id)?.value ?? null;
  const mediane = lire('stats.step.median_days');
  const effectif = lire('stats.step.effectif');
  const blocage = lire('stats.step.blocker_ratio');
  const sautees = lire('stats.step.skipped');

  const enregistrer = async () => {
    const d = dureeJ.trim() === '' ? null : Number(dureeJ);
    const corps = {
      nameFr: nom.trim(),
      description: description.trim() === '' ? null : description.trim(),
      category: categorie,
      defaultDurationDays: d === null || Number.isNaN(d) ? null : Math.trunc(d),
      blockerTarget: cible,
      blockerTemplate: gabarit.trim() === '' ? null : gabarit.trim(),
      isMajorMilestone: jalon,
      isRisky: risque,
      riskMessage: message.trim() === '' ? null : message.trim(),
      documentChecklist: checklist.split('\n').map((l) => l.trim()).filter((l) => l.length > 0),
    };
    const ok = await geste.lancer(() => staffApi.patch(`/journey-templates/step-definitions/${def.id}`, okResponseSchema, { body: corps }), 'Étape enregistrée.');
    if (ok) onChange();
  };
  const appliquer = async () => {
    if (mediane === null) return;
    const jours = Math.max(1, Math.round(mediane));
    const ok = await geste.lancer(() => staffApi.patch(`/journey-templates/step-definitions/${def.id}`, okResponseSchema, { body: { defaultDurationDays: jours } }), `Durée indicative fixée à ${jours} jours.`);
    if (ok) {
      setDureeJ(String(jours));
      onChange();
    }
  };

  return (
    <Colonnes gabarit="minmax(0,1.5fr) minmax(0,1fr)">
      <Carte style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Etiquette>Éditeur · {def.code}</Etiquette>
        <Champ libelle="Nom" valeur={nom} onChange={setNom} disabled={!peut} />
        <ZoneTexte libelle="Description" valeur={description} onChange={setDescription} lignes={2} disabled={!peut} />
        <ZoneTexte libelle="Gabarit du message « Je suis bloqué » ({etape} {parcours} {ville} {echeance})" valeur={gabarit} onChange={setGabarit} lignes={2} disabled={!peut} />
        <ZoneTexte libelle="Checklist de documents (un libellé par ligne — aucun document n’est stocké)" valeur={checklist} onChange={setChecklist} lignes={3} disabled={!peut} />
        <ZoneTexte libelle="Message de risque" valeur={message} onChange={setMessage} lignes={2} disabled={!peut} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          <Champ libelle="Durée indicative (jours)" valeur={dureeJ} onChange={(v) => setDureeJ(v.replace(/\D/g, ''))} inputMode="numeric" disabled={!peut} />
          <Selecteur libelle="Catégorie" valeur={categorie} onChange={setCategorie} options={CATEGORIES} disabled={!peut} />
          <Selecteur libelle="Cible du bouton « bloqué »" valeur={cible} onChange={setCible} options={CIBLES} disabled={!peut} />
        </div>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '13.5px', fontWeight: 700 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            Jalon majeur <Interrupteur actif={jalon} onChange={setJalon} libelle="Jalon majeur" disabled={!peut} />
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            À risque <Interrupteur actif={risque} onChange={setRisque} libelle="À risque" disabled={!peut} />
          </span>
        </div>
        <Message message={geste.message} />
        <div>
          <Bouton ton="principal" disabled={!peut || geste.occupe || nom.trim() === ''} onClick={() => void enregistrer()}>
            Enregistrer
          </Bouton>
        </div>
      </Carte>
      <Carte style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Etiquette>Statistiques observées</Etiquette>
        {points === null ? (
          <Vide>Statistiques non disponibles.</Vide>
        ) : mediane === null && blocage === null ? (
          <Bandeau>Pas encore assez de parcours passés par cette étape : les statistiques sont recalculées chaque semaine.</Bandeau>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '10px' }}>
            <div style={{ border: `1px solid ${C.trait}`, borderRadius: '16px', padding: '12px' }}>
              <div style={{ fontSize: '22px', fontWeight: 800 }}>{mediane === null ? '—' : duree(Math.round(mediane))}</div>
              <div style={{ fontSize: '11.5px', color: C.gris }}>délai réel médian{effectif === null ? '' : ` · ${effectif} parcours`}</div>
            </div>
            <div style={{ background: C.terrePale, borderRadius: '16px', padding: '12px' }}>
              <div style={{ fontSize: '22px', fontWeight: 800, color: C.terre }}>{blocage === null ? '—' : `${Math.round(blocage * 100)} %`}</div>
              <div style={{ fontSize: '11.5px', color: C.gris }}>taux de blocage</div>
            </div>
          </div>
        )}
        {sautees === null ? null : <div style={{ fontSize: '12.5px', color: C.gris }}>{sautees} étape{sautees > 1 ? 's' : ''} sautée{sautees > 1 ? 's' : ''} par les membres{sautees > 3 ? ' : à rendre optionnelle ?' : '.'}</div>}
        <Bouton ton="principal" plein disabled={!peut || mediane === null || geste.occupe} onClick={() => void appliquer()}>
          Appliquer comme durée indicative
        </Bouton>
      </Carte>
    </Colonnes>
  );
}

function Creation({ ouverte, onFermer, onFait }: { readonly ouverte: boolean; readonly onFermer: () => void; readonly onFait: (id: string) => void }) {
  const [code, setCode] = useState('');
  const [nom, setNom] = useState('');
  const [categorie, setCategorie] = useState('ARRIVAL');
  const geste = useGeste();
  const creer = async () => {
    const corps = stepDefinitionWriteSchema.safeParse({ code: code.trim().toUpperCase(), nameFr: nom.trim(), category: categorie });
    if (!corps.success) {
      geste.prevenir('Le code s’écrit en majuscules, chiffres et soulignés (p. ex. OUVRIR_COMPTE).');
      return;
    }
    let id = '';
    const ok = await geste.lancer(async () => {
      const r = await staffApi.post('/journey-templates/step-definitions', okResponseSchema, { body: corps.data });
      id = String((r as { id?: string }).id ?? '');
    });
    if (ok) {
      setCode('');
      setNom('');
      onFait(id);
    }
  };
  return (
    <Fenetre ouverte={ouverte} titre="Nouvelle étape" onFermer={onFermer}>
      <Champ libelle="Code (majuscules et soulignés)" valeur={code} onChange={setCode} />
      <Champ libelle="Nom" valeur={nom} onChange={setNom} />
      <Selecteur libelle="Catégorie" valeur={categorie} onChange={setCategorie} options={CATEGORIES} />
      <Message message={geste.message} />
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <Bouton onClick={onFermer}>Annuler</Bouton>
        <Bouton ton="principal" disabled={geste.occupe || code.trim() === '' || nom.trim() === ''} onClick={() => void creer()}>
          Créer
        </Bouton>
      </div>
    </Fenetre>
  );
}
