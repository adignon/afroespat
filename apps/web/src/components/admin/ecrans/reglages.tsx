'use client';

import { useEffect, useState } from 'react';
import {
  MODERATION_THRESHOLD_DEFAULTS,
  adminAuditResponseSchema,
  adminFlagSchema,
  adminFlagsResponseSchema,
  adminSettingsResponseSchema,
  adminStaffResponseSchema,
  flagWriteSchema,
  moderationThresholdsSchema,
  okResponseSchema,
  staffCreateSchema,
  type AdminFlag,
  type AdminSetting,
} from '@app/shared';
import { displayMessageFor, staffApi } from '@/lib/api/index';
import { PHASES, telechargerCsv, toutesLesVilles } from '../donnees';
import { reservePour } from '../navigation-admin';
import { AfficherLaSuite, useListeCurseur } from '../pagination-admin';
import { Confirmation } from '../confirmation';
import { useDroit, useEquipe } from '../session-equipe';
import { premierDefaut, Bandeau, Bouton, C, Carte, Champ, Etiquette, Fenetre, FenetreMotif, Interrupteur, Lecture, Message, Onglets, PanneauOnglet, Pastille, Selecteur, Titre, Vide, ZoneTexte, dateCourte, useCharge, useGeste } from '../ui';
import { MatriceRoles } from './matrice-roles';
import { texteVersValeur, typeSaisie, valeurAffichee, valeurVersTexte } from './reglages-saisie';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT — D15 · RÉGLAGES (15 §2.2, §2.3, §4.3, §4.4)                          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Les quatre onglets de la maquette — Feature flags, Paramètres système, Équipe, Journal
 * d'audit — plus « Seuils de modération » (13 §4.4) et « Rôles et droits » (la matrice de 15 §2.2, en lecture seule).
 *
 *   · FLAGS (SUPER_ADMIN) : créer, activer, régler le pourcentage et les conditions
 *     (villes, phases), supprimer. Lus par l'API ET par le web (`GET /me/flags`). Activer, désactiver et supprimer
 *     passent par une fenêtre de confirmation.
 *   · PARAMÈTRES (registre fermé) : la saisie suit la forme de la valeur (nombre, booléen, liste, CIDR) ; le SERVEUR
 *     valide selon le schéma de la clé et l'erreur nomme la clé fautive. Le serveur ne rend à un rôle que les clés
 *     qu'il peut régler.
 *   · ÉQUIPE (SUPER_ADMIN) : comptes, rôles, activation (désactiver demande confirmation) ; jamais de secret affiché.
 *     Paginé au curseur.
 *   · JOURNAL : OUVERT AUX QUATRE RÔLES comme l'API ; filtrable (action, acteur, cible, dates), paginé, export CSV.
 *     Les acteurs d'équipe sont nommés.
 *
 * Chaque onglet n'apparaît que pour les rôles qui peuvent l'employer ; les autres rôles voient les Rôles et le Journal.
 */

type Onglet = 'flags' | 'parametres' | 'moderation' | 'equipe' | 'roles' | 'audit';

export function ContenuReglages() {
  const staffAdmin = useDroit('staffAdmin');
  const reglages = useDroit('settings');
  const { equipe } = useEquipe();
  const moderation = reglages || equipe?.role === 'MODERATOR';
  const tous: readonly { id: Onglet; libelle: string; visible: boolean }[] = [
    { id: 'flags', libelle: 'Feature flags', visible: true },
    { id: 'parametres', libelle: 'Paramètres système', visible: reglages },
    { id: 'moderation', libelle: 'Seuils de modération', visible: moderation },
    { id: 'equipe', libelle: 'Équipe', visible: staffAdmin },
    { id: 'roles', libelle: 'Rôles et droits', visible: true },
    { id: 'audit', libelle: 'Journal d’audit', visible: true },
  ];
  const onglets = tous.filter((o) => o.visible);
  const [choisi, setOnglet] = useState<Onglet>('flags');
  const onglet = onglets.some((o) => o.id === choisi) ? choisi : (onglets[0]?.id ?? 'audit');
  return (
    <>
      <Titre titre="Réglages" />
      <Onglets base="reglages" libelle="Sections des réglages" actif={onglet} onChange={setOnglet} onglets={onglets.map((o) => ({ id: o.id, libelle: o.libelle }))} />
      <PanneauOnglet base="reglages" id={onglet}>
        {onglet === 'flags' ? <Flags /> : null}
        {onglet === 'parametres' ? <Parametres /> : null}
        {onglet === 'moderation' ? <Seuils /> : null}
        {onglet === 'equipe' ? <Equipe /> : null}
        {onglet === 'roles' ? <MatriceRoles /> : null}
        {onglet === 'audit' ? <Audit /> : null}
      </PanneauOnglet>
    </>
  );
}

// ─── Flags ───────────────────────────────────────────────────────────────────

function resume(f: AdminFlag, villes: ReadonlyMap<string, string>): string {
  const c = f.conditions;
  const parts: string[] = [];
  if (c?.cityIds !== undefined && c.cityIds.length > 0) parts.push(c.cityIds.map((id) => villes.get(id) ?? '?').join(', '));
  if (c?.phases !== undefined && c.phases.length > 0) parts.push(c.phases.map((p) => PHASES.find((x) => x.valeur === p)?.libelle ?? p).join(', '));
  return parts.length === 0 ? 'Toutes villes, toutes phases' : parts.join(' · ');
}

function Flags() {
  const peut = useDroit('staffAdmin');
  const liste = useCharge(() => staffApi.get('/flags', adminFlagsResponseSchema), 'flags');
  const villes = useCharge(() => toutesLesVilles(), 'villes');
  const geste = useGeste();
  const [edition, setEdition] = useState<AdminFlag | 'nouveau' | null>(null);
  /** La bascule attend une confirmation : activer ou désactiver un flag change ce que voient les membres. */
  const [bascule, setBascule] = useState<{ flag: AdminFlag; valeur: boolean } | null>(null);
  const noms = new Map(villes.etat.phase === 'pret' ? villes.etat.donnees.map((v) => [v.id, v.name]) : []);

  const confirmerBascule = async () => {
    if (bascule === null) return;
    const { flag: f, valeur: v } = bascule;
    const ok = await geste.lancer(() => staffApi.patch(`/flags/${f.id}`, okResponseSchema, { body: { isEnabled: v } }), v ? `${f.key} activé.` : `${f.key} désactivé.`);
    if (ok) {
      setBascule(null);
      liste.recharger();
    }
  };
  return (
    <>
      <Message message={bascule === null ? geste.message : null} />
      <Carte style={{ padding: 0, overflow: 'hidden' }}>
        <Lecture etat={liste.etat} recharger={liste.recharger}>
          {(d) =>
            d.items.length === 0 ? (
              <Vide>Aucun feature flag. Les fonctionnalités sans flag suivent le défaut du code.</Vide>
            ) : (
              <div data-admin-defile="" style={{ overflowX: 'auto' }}>
                <table data-admin-pile="" style={{ width: '100%', minWidth: '720px', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: C.grisClair, fontSize: '10.5px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                      {['Clé', 'Activé', 'Pourcentage', 'Conditions', ''].map((h) => (
                        <th key={h} style={{ padding: '12px 14px', fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.items.map((f) => (
                      <tr key={f.id} style={{ borderTop: `1px solid ${C.traitLeger}` }}>
                        <td data-etiquette="Clé" style={{ padding: '10px 14px', fontWeight: 700 }}>{f.key}</td>
                        <td data-etiquette="Activé" style={{ padding: '10px 14px' }}>
                          <Interrupteur actif={f.isEnabled} onChange={(v) => { geste.effacer(); setBascule({ flag: f, valeur: v }); }} libelle={`Activer ${f.key}`} disabled={!peut || geste.occupe} />
                        </td>
                        <td data-etiquette="Pourcentage" style={{ padding: '10px 14px' }}>{f.rolloutPct} %</td>
                        <td data-etiquette="Conditions" style={{ padding: '10px 14px' }}>{resume(f, noms)}</td>
                        <td style={{ padding: '6px 14px', textAlign: 'right' }}>
                          <Bouton petit disabled={!peut} onClick={() => setEdition(f)}>Modifier</Bouton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </Lecture>
      </Carte>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <Bouton ton="principal" disabled={!peut} onClick={() => setEdition('nouveau')}>
          + Nouveau flag
        </Bouton>
        {peut ? null : <span style={{ fontSize: '12.5px', color: C.gris }}>{reservePour('staffAdmin')}</span>}
      </div>
      <FenetreMotif
        ouverte={bascule !== null}
        titre={bascule === null ? '' : bascule.valeur ? `Activer ${bascule.flag.key}` : `Désactiver ${bascule.flag.key}`}
        consigne={bascule === null ? undefined : `${bascule.valeur ? 'Activer' : 'Désactiver'} ce flag change ce que voient les membres concernés (${bascule.flag.rolloutPct} % du déploiement). L’action est tracée dans le journal d’audit.`}
        min={0}
        motifRequis={false}
        libelleConfirmer={bascule?.valeur === true ? 'Activer' : 'Désactiver'}
        onConfirmer={() => void confirmerBascule()}
        onFermer={() => setBascule(null)}
        occupe={geste.occupe}
        message={geste.message}
      />
      {edition === null ? null : (
        <EditionFlag
          key={edition === 'nouveau' ? 'nouveau' : edition.id}
          flag={edition === 'nouveau' ? null : edition}
          villes={villes.etat.phase === 'pret' ? villes.etat.donnees.filter((v) => v.isActive) : []}
          onFermer={() => setEdition(null)}
          onFait={(texte) => { setEdition(null); liste.recharger(); geste.annoncer(texte); }}
        />
      )}
    </>
  );
}

function EditionFlag({ flag, villes, onFermer, onFait }: { readonly flag: AdminFlag | null; readonly villes: readonly { id: string; name: string }[]; readonly onFermer: () => void; readonly onFait: (texte: string) => void }) {
  const geste = useGeste();
  const [cle, setCle] = useState(flag?.key ?? '');
  const [actif, setActif] = useState(flag?.isEnabled ?? false);
  const [pct, setPct] = useState(String(flag?.rolloutPct ?? 100));
  const [ids, setIds] = useState<readonly string[]>(flag?.conditions?.cityIds ?? []);
  const [phases, setPhases] = useState<readonly string[]>(flag?.conditions?.phases ?? []);
  const bascule = (l: readonly string[], v: string) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]);
  const conditions = ids.length === 0 && phases.length === 0 ? null : { ...(ids.length === 0 ? {} : { cityIds: ids }), ...(phases.length === 0 ? {} : { phases }) };

  const enregistrer = async () => {
    const n = Math.min(100, Math.max(0, Math.round(Number(pct) || 0)));
    const ok = await geste.lancer(async () => {
      if (flag === null) {
        const corps = flagWriteSchema.parse({ key: cle.trim(), isEnabled: actif, rolloutPct: n, conditions });
        await staffApi.post('/flags', adminFlagSchema, { body: corps });
      } else {
        await staffApi.patch(`/flags/${flag.id}`, okResponseSchema, { body: { isEnabled: actif, rolloutPct: n, conditions } });
      }
    });
    if (ok) onFait(flag === null ? `Flag ${cle.trim()} créé.` : `Flag ${flag.key} enregistré.`);
  };
  const [suppression, setSuppression] = useState(false);
  const supprimer = async () => {
    if (flag === null) return;
    const ok = await geste.lancer(() => staffApi.del(`/flags/${flag.id}`, okResponseSchema));
    if (ok) onFait(`Flag ${flag.key} supprimé.`);
  };
  return (
    <Fenetre ouverte titre={flag === null ? 'Nouveau flag' : flag.key} onFermer={onFermer} large>
      {flag === null ? <Champ libelle="Clé (minuscules, points, tirets)" valeur={cle} onChange={setCle} /> : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', fontWeight: 700 }}>
        <span style={{ flex: 1 }}>Activé</span>
        <Interrupteur actif={actif} onChange={setActif} libelle="Activé" />
      </div>
      <Champ libelle="Pourcentage de déploiement (0 à 100)" valeur={pct} onChange={(v) => setPct(v.replace(/\D/g, '').slice(0, 3))} inputMode="numeric" />
      <div>
        <div style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' }}>Phases · vide = toutes</div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {PHASES.map((p) => (
            <button key={p.valeur} type="button" aria-pressed={phases.includes(p.valeur)} onClick={() => setPhases((l) => bascule(l, p.valeur))} style={{ height: '32px', padding: '0 12px', borderRadius: '999px', border: phases.includes(p.valeur) ? 'none' : `1px solid ${C.trait}`, background: phases.includes(p.valeur) ? C.vert : '#fff', color: phases.includes(p.valeur) ? '#fff' : C.encre, font: 'inherit', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              {p.libelle}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' }}>Villes · vide = toutes</div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', maxHeight: '140px', overflowY: 'auto' }}>
          {villes.map((v) => (
            <button key={v.id} type="button" aria-pressed={ids.includes(v.id)} onClick={() => setIds((l) => bascule(l, v.id))} style={{ height: '30px', padding: '0 12px', borderRadius: '999px', border: ids.includes(v.id) ? 'none' : `1px solid ${C.trait}`, background: ids.includes(v.id) ? C.vert : '#fff', color: ids.includes(v.id) ? '#fff' : C.encre, font: 'inherit', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              {v.name}
            </button>
          ))}
        </div>
      </div>
      <Message message={geste.message} />
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {flag === null ? null : <Bouton onClick={() => { geste.effacer(); setSuppression(true); }} disabled={geste.occupe}>Supprimer</Bouton>}
        <Bouton onClick={onFermer}>Annuler</Bouton>
        <Bouton ton="principal" disabled={geste.occupe || (flag === null && cle.trim() === '')} onClick={() => void enregistrer()}>Enregistrer</Bouton>
      </div>
      <FenetreMotif
        ouverte={suppression}
        titre={`Supprimer ${flag?.key ?? ''}`}
        consigne="Supprimer ce flag renvoie la fonctionnalité à son défaut dans le code, pour tous les membres. L’action est tracée et ne se défait pas : il faudrait recréer le flag."
        min={0}
        motifRequis={false}
        libelleConfirmer="Supprimer le flag"
        onConfirmer={() => void supprimer()}
        onFermer={() => setSuppression(false)}
        occupe={geste.occupe}
        message={geste.message}
      />
    </Fenetre>
  );
}

// ─── Paramètres ──────────────────────────────────────────────────────────────

function Parametres() {
  const { equipe } = useEquipe();
  const liste = useCharge(() => staffApi.get('/settings', adminSettingsResponseSchema), 'parametres');
  const [cible, setCible] = useState<AdminSetting | null>(null);
  const [texte, setTexte] = useState('');
  const [booleen, setBooleen] = useState(false);
  const geste = useGeste();
  const type = cible === null ? 'json' : typeSaisie(cible.key, cible.value);
  const ouvrir = (s: AdminSetting) => {
    setCible(s);
    setTexte(valeurVersTexte(s.value, typeSaisie(s.key, s.value)));
    setBooleen(s.value === true);
    geste.effacer();
  };
  const enregistrer = async (motif: string) => {
    if (cible === null) return;
    const lu = texteVersValeur(texte, type, booleen);
    if (!lu.ok) {
      geste.prevenir(`Paramètre « ${cible.key} » : ${lu.erreur}`);
      return;
    }
    // Le serveur valide selon le schéma de la clé : son refus est dit AVEC la clé fautive.
    const refus: { texte: string | null } = { texte: null };
    const ok = await geste.lancer(async () => {
      try {
        await staffApi.put(`/settings/${cible.key}`, okResponseSchema, { body: { value: lu.valeur, ...(motif === '' ? {} : { reason: motif }) } });
      } catch (erreur) {
        refus.texte = `Paramètre « ${cible.key} » refusé : ${displayMessageFor(erreur)}`;
      }
    });
    if (refus.texte !== null) {
      geste.prevenir(refus.texte);
      return;
    }
    if (ok) {
      setCible(null);
      liste.recharger();
      geste.annoncer(`Paramètre ${cible.key} enregistré.`);
    }
  };
  return (
    <>
    {cible === null ? <Message message={geste.message} /> : null}
    <Lecture etat={liste.etat} recharger={liste.recharger}>
      {(d) => (
        <Carte style={{ padding: 0, overflow: 'hidden' }}>
          {d.items.length === 0 ? <Vide>Aucun paramètre n’est réglable avec votre rôle.</Vide> : null}
          {d.items.map((s) => {
            const droit = equipe !== null && s.requiredRole.includes(equipe.role);
            return (
              <div key={s.key} style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', padding: '12px 16px', borderTop: `1px solid ${C.traitLeger}` }}>
                <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 700 }}>{s.key} {s.isDefault ? <Pastille>défaut</Pastille> : <Pastille ton="vert">modifié</Pastille>}</div>
                  <div style={{ fontSize: '12.5px', color: C.gris }}>{s.description}</div>
                  <div style={{ fontSize: '12px', color: C.grisClair, marginTop: '2px', fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all', overflowWrap: 'anywhere' }}>{valeurAffichee(s.value)}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <Bouton petit disabled={!droit} onClick={() => ouvrir(s)}>
                    Modifier
                  </Bouton>
                  {droit ? null : <span style={{ fontSize: '11.5px', color: C.gris }}>Réservé : {s.requiredRole.length === 1 ? 'administrateurs' : 'contenu et administrateurs'}</span>}
                </div>
              </div>
            );
          })}
          <FenetreMotif
            ouverte={cible !== null}
            titre={cible?.key ?? ''}
            consigne="La valeur est validée par le serveur selon le schéma de la clé. Le changement est tracé."
            min={0}
            motifRequis
            libelleConfirmer="Enregistrer"
            onConfirmer={(m) => void enregistrer(m)}
            onFermer={() => setCible(null)}
            occupe={geste.occupe}
            message={geste.message}
            enfants={
              type === 'booleen' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', fontWeight: 700 }}>
                  <span style={{ flex: 1 }}>{cible?.key}</span>
                  <Interrupteur actif={booleen} onChange={setBooleen} libelle={`Valeur de ${cible?.key ?? ''}`} />
                </div>
              ) : type === 'nombre' ? (
                <Champ libelle="Valeur (nombre)" valeur={texte} onChange={setTexte} inputMode="numeric" />
              ) : type === 'liste' || type === 'cidr' ? (
                <ZoneTexte
                  libelle={type === 'cidr' ? 'Adresses ou blocs réseau autorisés (CIDR), un par ligne — vide = aucune restriction' : 'Valeurs, une par ligne'}
                  valeur={texte}
                  onChange={setTexte}
                  lignes={8}
                  mono
                />
              ) : (
                <ZoneTexte libelle="Valeur (JSON)" valeur={texte} onChange={setTexte} lignes={8} mono />
              )
            }
          />
        </Carte>
      )}
    </Lecture>
    </>
  );
}

// ─── Seuils de modération ────────────────────────────────────────────────────

const SEUILS: readonly { cle: keyof typeof MODERATION_THRESHOLD_DEFAULTS; libelle: string; aide: string; decimal?: boolean }[] = [
  { cle: 'blockAbuseCount', libelle: 'Signalements pour masquer', aide: 'Nombre de signalements qui masquent automatiquement un contenu.' },
  { cle: 'blockAbuseWindowDays', libelle: 'Fenêtre de ces signalements (jours)', aide: 'Période sur laquelle ils sont comptés.' },
  { cle: 'dismissedStreak', libelle: 'Signalements classés d’affilée', aide: 'Au-delà, les signalements d’un même auteur cessent de compter.' },
  { cle: 'newAccountBurstCount', libelle: 'Publications d’un compte neuf', aide: 'Seuil de rafale pour un compte récent.' },
  { cle: 'housingRiskQueue', libelle: 'Score de risque : mise en file (0 à 1)', aide: 'Une annonce au-delà passe en examen.', decimal: true },
  { cle: 'housingRiskBlock', libelle: 'Score de risque : blocage (0 à 1)', aide: 'Une annonce au-delà est bloquée. Au moins égal au seuil de mise en file.', decimal: true },
];

function Seuils() {
  const peut = useDroit('content');
  const { etat, recharger } = useCharge(() => staffApi.get('/moderation/settings', moderationThresholdsSchema), 'seuils');
  const [vals, setVals] = useState<Record<string, string>>({});
  const geste = useGeste();
  useEffect(() => {
    if (etat.phase === 'pret') setVals(Object.fromEntries(Object.entries(etat.donnees).map(([k, v]) => [k, String(v)])));
  }, [etat]);
  const corps = Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, Number(v.replace(',', '.'))]));
  const valide = moderationThresholdsSchema.safeParse(corps);
  const enregistrer = async () => {
    if (!valide.success) return;
    const ok = await geste.lancer(() => staffApi.put('/moderation/settings', okResponseSchema, { body: valide.data }), 'Seuils enregistrés.');
    if (ok) {
      setConfirmerSeuils(false);
      recharger();
    }
  };
  const [confirmerSeuils, setConfirmerSeuils] = useState(false);
  return (
    <Lecture etat={etat} recharger={recharger}>
      {() => (
        <Carte style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Etiquette>Seuils de modération</Etiquette>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
            {SEUILS.map((s) => (
              <div key={s.cle}>
                <Champ libelle={s.libelle} valeur={vals[s.cle] ?? ''} onChange={(v) => setVals((x) => ({ ...x, [s.cle]: v.replace(s.decimal === true ? /[^\d.,]/g : /\D/g, '') }))} inputMode="numeric" disabled={!peut} />
                <div style={{ fontSize: '12px', color: C.grisClair, marginTop: '4px' }}>{s.aide}</div>
              </div>
            ))}
          </div>
          {!valide.success ? <Bandeau ton="attention">{premierDefaut(valide.error.issues, Object.fromEntries(SEUILS.map((x) => [x.cle, x.libelle])))}</Bandeau> : null}
          {peut ? null : <Bandeau>Les seuils se modifient avec le rôle contenu ou super-administrateur.</Bandeau>}
          <Message message={confirmerSeuils ? null : geste.message} />
          <div>
            <Bouton ton="principal" disabled={!peut || !valide.success || geste.occupe} onClick={() => { geste.effacer(); setConfirmerSeuils(true); }}>Enregistrer</Bouton>
          </div>
          <Confirmation
            ouverte={confirmerSeuils}
            titre="Modifier les seuils de modération"
            consigne="Les nouveaux seuils s’appliquent tout de suite à ce qui est bloqué, mis en file ou publié automatiquement. L’action est tracée dans le journal d’audit."
            libelle="Enregistrer les seuils"
            onConfirmer={() => void enregistrer()}
            onFermer={() => { if (!geste.occupe) setConfirmerSeuils(false); }}
            occupe={geste.occupe}
            message={geste.message}
          />
        </Carte>
      )}
    </Lecture>
  );
}

// ─── Équipe ──────────────────────────────────────────────────────────────────

const ROLES = [
  { valeur: 'SUPER_ADMIN', libelle: 'Super-administrateur' },
  { valeur: 'CONTENT_ADMIN', libelle: 'Contenu' },
  { valeur: 'MODERATOR', libelle: 'Modération' },
  { valeur: 'SUPPORT', libelle: 'Support' },
];

function Equipe() {
  const peut = useDroit('staffAdmin');
  const { equipe } = useEquipe();
  const liste = useListeCurseur(
    (curseur) => (peut ? staffApi.get(`/staff?limit=50${curseur === null ? '' : `&cursor=${encodeURIComponent(curseur)}`}`, adminStaffResponseSchema) : Promise.resolve({ items: [], nextCursor: null })),
    String(peut),
  );
  const [creer, setCreer] = useState(false);
  /** Désactiver un compte coupe l'accès de la personne : confirmation avant l'appel. */
  const [aDesactiver, setADesactiver] = useState<{ id: string; nom: string } | null>(null);
  const geste = useGeste();
  const patcher = async (id: string, corps: Record<string, unknown>, succes = 'Compte mis à jour.') => {
    const ok = await geste.lancer(() => staffApi.patch(`/staff/${id}`, okResponseSchema, { body: corps }), succes);
    if (ok) liste.recharger();
    return ok;
  };
  if (!peut) return <Bandeau>La gestion des comptes équipe est {reservePour('staffAdmin').toLowerCase()}.</Bandeau>;
  return (
    <>
      <Message message={aDesactiver === null ? geste.message : null} />
      <Carte style={{ padding: 0, overflow: 'hidden' }}>
        <Lecture etat={liste.etat} recharger={liste.recharger}>
          {(d) => (
            <>
              <div data-admin-defile="" style={{ overflowX: 'auto' }}>
                <table data-admin-pile="" style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: C.grisClair, fontSize: '10.5px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                      {['Nom', 'E-mail', 'Rôle', 'Double auth.', 'Dernière connexion', 'Actif'].map((h) => (
                        <th key={h} style={{ padding: '12px 14px', fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.items.map((m) => (
                      <tr key={m.id} style={{ borderTop: `1px solid ${C.traitLeger}` }}>
                        <td data-etiquette="Nom" style={{ padding: '10px 14px', fontWeight: 700 }}>{m.displayName}</td>
                        <td data-etiquette="E-mail" style={{ padding: '10px 14px' }}>{m.email}</td>
                        <td data-etiquette="Rôle" style={{ padding: '6px 14px', minWidth: '170px' }}>
                          <select aria-label={`Rôle de ${m.displayName}`} value={m.role} disabled={m.id === equipe?.staffId || geste.occupe} onChange={(e) => void patcher(m.id, { role: e.target.value })} style={{ height: '34px', borderRadius: '10px', border: `1px solid ${C.trait}`, font: 'inherit', fontSize: '13px', padding: '0 8px', background: '#fff' }}>
                            {ROLES.map((r) => <option key={r.valeur} value={r.valeur}>{r.libelle}</option>)}
                          </select>
                        </td>
                        <td data-etiquette="Double auth." style={{ padding: '10px 14px' }}>{m.totpEnrolled ? <Pastille ton="vert">Enrôlée</Pastille> : <Pastille ton="terre">À enrôler</Pastille>}</td>
                        <td data-etiquette="Dernière connexion" style={{ padding: '10px 14px' }}>{m.lastLoginAt === null ? 'jamais' : dateCourte(m.lastLoginAt)}</td>
                        <td data-etiquette="Actif" style={{ padding: '10px 14px' }}>
                          <Interrupteur
                            actif={m.isActive}
                            onChange={(v) => {
                              if (v) void patcher(m.id, { isActive: true }, 'Compte réactivé.');
                              else {
                                geste.effacer();
                                setADesactiver({ id: m.id, nom: m.displayName });
                              }
                            }}
                            libelle={`Actif : ${m.displayName}`}
                            disabled={m.id === equipe?.staffId || geste.occupe}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <AfficherLaSuite curseur={d.curseur} affiches={d.items.length} occupe={liste.occupe} message={liste.message} onSuite={() => void liste.suite()} />
            </>
          )}
        </Lecture>
      </Carte>
      <div>
        <Bouton ton="principal" onClick={() => setCreer(true)}>+ Nouveau compte</Bouton>
      </div>
      <FenetreMotif
        ouverte={aDesactiver !== null}
        titre={`Désactiver ${aDesactiver?.nom ?? ''}`}
        consigne="Cette personne ne pourra plus se connecter à l’administration et ses sessions en cours sont coupées. L’action est tracée dans le journal d’audit ; le compte peut être réactivé."
        min={0}
        motifRequis={false}
        libelleConfirmer="Désactiver le compte"
        onConfirmer={() => {
          if (aDesactiver !== null) void patcher(aDesactiver.id, { isActive: false }, `Compte de ${aDesactiver.nom} désactivé.`).then((ok) => ok && setADesactiver(null));
        }}
        onFermer={() => setADesactiver(null)}
        occupe={geste.occupe}
        message={geste.message}
      />
      <CreationCompte ouverte={creer} onFermer={() => setCreer(false)} onFait={() => { setCreer(false); liste.recharger(); geste.annoncer('Compte créé : la double authentification est à enrôler à sa première connexion.'); }} />
    </>
  );
}

function CreationCompte({ ouverte, onFermer, onFait }: { readonly ouverte: boolean; readonly onFermer: () => void; readonly onFait: () => void }) {
  const [email, setEmail] = useState('');
  const [nom, setNom] = useState('');
  const [mdp, setMdp] = useState('');
  const [role, setRole] = useState('MODERATOR');
  const geste = useGeste();
  const creer = async () => {
    const corps = staffCreateSchema.safeParse({ email: email.trim(), displayName: nom.trim(), password: mdp, role });
    if (!corps.success) {
      geste.prevenir(premierDefaut(corps.error.issues, { email: 'E-mail', displayName: 'Nom affiché', password: 'Mot de passe (12 caractères minimum)', role: 'Rôle' }));
      return;
    }
    const ok = await geste.lancer(() => staffApi.post('/staff', okResponseSchema, { body: corps.data }));
    if (ok) {
      setEmail('');
      setNom('');
      setMdp('');
      onFait();
    }
  };
  return (
    <Fenetre ouverte={ouverte} titre="Nouveau compte équipe" onFermer={onFermer}>
      <Champ libelle="Nom affiché" valeur={nom} onChange={setNom} />
      <Champ libelle="E-mail professionnel" valeur={email} onChange={setEmail} type="email" />
      <Champ libelle="Mot de passe initial (12 caractères minimum)" valeur={mdp} onChange={setMdp} type="password" autoComplete="new-password" />
      <Selecteur libelle="Rôle" valeur={role} onChange={setRole} options={ROLES} />
      <div style={{ fontSize: '12.5px', color: C.gris }}>La double authentification sera à enrôler à la première connexion.</div>
      <Message message={geste.message} />
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <Bouton onClick={onFermer}>Annuler</Bouton>
        <Bouton ton="principal" disabled={geste.occupe} onClick={() => void creer()}>Créer</Bouton>
      </div>
    </Fenetre>
  );
}

// ─── Journal d'audit ─────────────────────────────────────────────────────────

function Audit() {
  const [action, setAction] = useState('');
  const [acteur, setActeur] = useState('');
  const [typeCible, setTypeCible] = useState('');
  const [cible, setCible] = useState('');
  const [de, setDe] = useState('');
  const [a, setA] = useState('');
  const estUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());
  const cibleFautive = cible.trim() !== '' && !estUuid(cible);
  const requete = () => {
    const p = new URLSearchParams();
    if (action.trim() !== '') p.set('action', action.trim());
    if (acteur !== '') p.set('actor', acteur);
    if (typeCible.trim() !== '') p.set('targetType', typeCible.trim());
    if (cible.trim() !== '' && estUuid(cible)) p.set('target', cible.trim());
    if (de !== '') p.set('from', new Date(`${de}T00:00:00`).toISOString());
    if (a !== '') p.set('to', new Date(`${a}T23:59:59`).toISOString());
    return p;
  };
  const cle = `${action}|${acteur}|${typeCible}|${cible}|${de}|${a}`;
  const liste = useListeCurseur((curseur) => {
    const p = requete();
    p.set('limit', '50');
    if (curseur !== null) p.set('cursor', curseur);
    return staffApi.get(`/audit?${p.toString()}`, adminAuditResponseSchema);
  }, cle);
  const geste = useGeste();
  // Les acteurs d'équipe connus : les comptes (si le rôle peut les lister) sinon ceux déjà vus dans le journal.
  const peutListerEquipe = useDroit('staffAdmin');
  const comptes = useCharge(() => (peutListerEquipe ? staffApi.get('/staff?limit=100', adminStaffResponseSchema) : Promise.resolve(null)), `acteurs-${peutListerEquipe}`);
  const vus = new Map<string, string>();
  if (liste.etat.phase === 'pret') for (const e of liste.etat.donnees.items) if (e.actorType === 'STAFF' && e.actorId !== null) vus.set(e.actorId, e.actorName ?? 'Compte équipe');
  if (comptes.etat.phase === 'pret' && comptes.etat.donnees !== null) for (const m of comptes.etat.donnees.items) vus.set(m.id, m.displayName);
  const optionsActeur = [{ valeur: '', libelle: 'Tous les acteurs' }, { valeur: 'SYSTEM', libelle: 'Système' }, ...[...vus].map(([id, nom]) => ({ valeur: id, libelle: nom }))];
  const exporter = () => void geste.lancer(() => telechargerCsv(`/audit/export?${requete().toString()}`, 'audit.csv'), 'Export téléchargé.');
  const nomActeur = (e: { actorType: string; actorId: string | null; actorName?: string | null | undefined }) =>
    e.actorType === 'SYSTEM' ? 'Système' : e.actorType === 'STAFF' ? (e.actorName ?? 'Compte équipe supprimé') : 'Membre';
  return (
    <>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 200px' }}><Champ libelle="Action (p. ex. page.published)" valeur={action} onChange={setAction} /></div>
        <div style={{ flex: '1 1 200px' }}><Selecteur libelle="Acteur" valeur={acteur} onChange={setActeur} options={optionsActeur} /></div>
        <div style={{ flex: '1 1 160px' }}><Champ libelle="Type de cible (p. ex. user)" valeur={typeCible} onChange={setTypeCible} /></div>
        <div style={{ flex: '1 1 240px' }}><Champ libelle="Identifiant de la cible" valeur={cible} onChange={setCible} erreur={cibleFautive ? 'Un identifiant a la forme 0190…-…-…' : undefined} /></div>
        <div style={{ minWidth: '160px' }}><Champ libelle="Du" valeur={de} onChange={setDe} type="date" /></div>
        <div style={{ minWidth: '160px' }}><Champ libelle="Au" valeur={a} onChange={setA} type="date" /></div>
        <Bouton ton="secondaire" onClick={exporter} disabled={geste.occupe}>Exporter (CSV)</Bouton>
      </div>
      <Message message={geste.message} />
      <Carte style={{ padding: 0, overflow: 'hidden' }}>
        <Lecture etat={liste.etat} recharger={liste.recharger}>
          {(d) =>
            d.items.length === 0 ? (
              <Vide>Aucune entrée.</Vide>
            ) : (
              <>
                <div data-admin-defile="" style={{ overflowX: 'auto' }}>
                  <table data-admin-pile="" style={{ width: '100%', minWidth: '720px', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: C.grisClair, fontSize: '10.5px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                        {['Date', 'Acteur', 'Action', 'Cible'].map((h) => (
                          <th key={h} style={{ padding: '12px 14px', fontWeight: 700 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {d.items.map((e) => (
                        <tr key={e.id} style={{ borderTop: `1px solid ${C.traitLeger}` }}>
                          <td data-etiquette="Date" style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{dateCourte(e.createdAt)}</td>
                          <td data-etiquette="Acteur" style={{ padding: '10px 14px' }}>{nomActeur(e)}</td>
                          <td data-etiquette="Action" style={{ padding: '10px 14px', fontWeight: 700 }}>{e.action}</td>
                          <td data-etiquette="Cible" style={{ padding: '10px 14px' }}>{e.targetType}{e.targetId === null ? '' : ` · ${e.targetId}`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <AfficherLaSuite curseur={d.curseur} affiches={d.items.length} occupe={liste.occupe} message={liste.message} onSuite={() => void liste.suite()} />
              </>
            )
          }
        </Lecture>
      </Carte>
    </>
  );
}
