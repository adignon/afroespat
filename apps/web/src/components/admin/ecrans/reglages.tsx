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
import { staffApi } from '@/lib/api/index';
import { PHASES, telechargerCsv, toutesLesVilles } from '../donnees';
import { useDroit, useEquipe } from '../session-equipe';
import { premierDefaut, Bandeau, Bouton, C, Carte, Champ, Etiquette, Fenetre, FenetreMotif, Interrupteur, Lecture, Message, Onglets, Pastille, Selecteur, Titre, Vide, ZoneTexte, dateCourte, useCharge, useGeste } from '../ui';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT — D15 · RÉGLAGES (15 §2.2, §2.3, §4.3, §4.4)                          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Les quatre onglets de la maquette — Feature flags, Paramètres système, Équipe, Journal
 * d'audit — plus un cinquième que la maquette ne dessine pas, « Seuils de modération »
 * (13 §4.4), parce que le porteur l'a demandé et qu'il a sa propre route.
 *
 *   · FLAGS (SUPER_ADMIN) : créer, activer, régler le pourcentage et les conditions
 *     (villes, phases), supprimer. Lus par l'API ET par le web (`GET /me/flags`).
 *   · PARAMÈTRES (registre fermé) : chaque clé a son schéma ; l'écran édite la valeur en
 *     JSON et le SERVEUR valide. Le rôle requis est affiché et éteint le bouton.
 *   · ÉQUIPE (SUPER_ADMIN) : comptes, rôles, activation ; jamais de secret affiché. Le
 *     compte ne change pas son propre rôle, le dernier SUPER_ADMIN ne se retire pas
 *     (règles du serveur, leurs messages sont affichés tels quels).
 *   · JOURNAL : filtrable, paginé, export CSV — l'export est celui du serveur, mêmes filtres.
 */

type Onglet = 'flags' | 'parametres' | 'moderation' | 'equipe' | 'audit';

export function ContenuReglages() {
  const [onglet, setOnglet] = useState<Onglet>('flags');
  return (
    <>
      <Titre titre="Réglages" />
      <Onglets
        actif={onglet}
        onChange={setOnglet}
        onglets={[
          { id: 'flags', libelle: 'Feature flags' },
          { id: 'parametres', libelle: 'Paramètres système' },
          { id: 'moderation', libelle: 'Seuils de modération' },
          { id: 'equipe', libelle: 'Équipe' },
          { id: 'audit', libelle: 'Journal d’audit' },
        ]}
      />
      {onglet === 'flags' ? <Flags /> : null}
      {onglet === 'parametres' ? <Parametres /> : null}
      {onglet === 'moderation' ? <Seuils /> : null}
      {onglet === 'equipe' ? <Equipe /> : null}
      {onglet === 'audit' ? <Audit /> : null}
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
  const noms = new Map(villes.etat.phase === 'pret' ? villes.etat.donnees.map((v) => [v.id, v.name]) : []);

  const basculer = async (f: AdminFlag, v: boolean) => {
    const ok = await geste.lancer(() => staffApi.patch(`/flags/${f.id}`, okResponseSchema, { body: { isEnabled: v } }));
    if (ok) liste.recharger();
  };
  return (
    <>
      <Message message={geste.message} />
      <Carte style={{ padding: 0, overflow: 'hidden' }}>
        <Lecture etat={liste.etat} recharger={liste.recharger}>
          {(d) =>
            d.items.length === 0 ? (
              <Vide>Aucun feature flag. Les fonctionnalités sans flag suivent le défaut du code.</Vide>
            ) : (
              <div data-admin-defile="" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: '720px', borderCollapse: 'collapse', fontSize: '13px' }}>
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
                        <td style={{ padding: '10px 14px', fontWeight: 700 }}>{f.key}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <Interrupteur actif={f.isEnabled} onChange={(v) => void basculer(f, v)} libelle={`Activer ${f.key}`} disabled={!peut || geste.occupe} />
                        </td>
                        <td style={{ padding: '10px 14px' }}>{f.rolloutPct} %</td>
                        <td style={{ padding: '10px 14px' }}>{resume(f, noms)}</td>
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
      <div>
        <Bouton ton="principal" disabled={!peut} titre={peut ? undefined : 'Réservé : super-administrateur'} onClick={() => setEdition('nouveau')}>
          + Nouveau flag
        </Bouton>
      </div>
      {edition === null ? null : (
        <EditionFlag
          key={edition === 'nouveau' ? 'nouveau' : edition.id}
          flag={edition === 'nouveau' ? null : edition}
          villes={villes.etat.phase === 'pret' ? villes.etat.donnees.filter((v) => v.isActive) : []}
          onFermer={() => setEdition(null)}
          onFait={() => { setEdition(null); liste.recharger(); }}
        />
      )}
    </>
  );
}

function EditionFlag({ flag, villes, onFermer, onFait }: { readonly flag: AdminFlag | null; readonly villes: readonly { id: string; name: string }[]; readonly onFermer: () => void; readonly onFait: () => void }) {
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
    if (ok) onFait();
  };
  const supprimer = async () => {
    if (flag === null) return;
    const ok = await geste.lancer(() => staffApi.del(`/flags/${flag.id}`, okResponseSchema));
    if (ok) onFait();
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
        {flag === null ? null : <Bouton onClick={() => void supprimer()} disabled={geste.occupe}>Supprimer</Bouton>}
        <Bouton onClick={onFermer}>Annuler</Bouton>
        <Bouton ton="principal" disabled={geste.occupe || (flag === null && cle.trim() === '')} onClick={() => void enregistrer()}>Enregistrer</Bouton>
      </div>
    </Fenetre>
  );
}

// ─── Paramètres ──────────────────────────────────────────────────────────────

function Parametres() {
  const { equipe } = useEquipe();
  const liste = useCharge(() => staffApi.get('/settings', adminSettingsResponseSchema), 'parametres');
  const [cible, setCible] = useState<AdminSetting | null>(null);
  const [json, setJson] = useState('');
  const geste = useGeste();
  const ouvrir = (s: AdminSetting) => {
    setCible(s);
    setJson(JSON.stringify(s.value, null, 2));
    geste.effacer();
  };
  const enregistrer = async (motif: string) => {
    if (cible === null) return;
    let valeur: unknown;
    try {
      valeur = JSON.parse(json);
    } catch {
      geste.prevenir('La valeur n’est pas du JSON valide.');
      return;
    }
    const ok = await geste.lancer(() => staffApi.put(`/settings/${cible.key}`, okResponseSchema, { body: { value: valeur, ...(motif === '' ? {} : { reason: motif }) } }));
    if (ok) {
      setCible(null);
      liste.recharger();
    }
  };
  return (
    <Lecture etat={liste.etat} recharger={liste.recharger}>
      {(d) => (
        <Carte style={{ padding: 0, overflow: 'hidden' }}>
          {d.items.map((s) => {
            const droit = equipe !== null && s.requiredRole.includes(equipe.role);
            return (
              <div key={s.key} style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', padding: '12px 16px', borderTop: `1px solid ${C.traitLeger}` }}>
                <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 700 }}>{s.key} {s.isDefault ? <Pastille>défaut</Pastille> : <Pastille ton="vert">modifié</Pastille>}</div>
                  <div style={{ fontSize: '12.5px', color: C.gris }}>{s.description}</div>
                  <div style={{ fontSize: '12px', color: C.grisClair, marginTop: '2px', fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all' }}>{JSON.stringify(s.value).slice(0, 160)}</div>
                </div>
                <Bouton petit disabled={!droit} titre={droit ? undefined : `Réservé : ${s.requiredRole.join(', ')}`} onClick={() => ouvrir(s)}>
                  Modifier
                </Bouton>
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
            enfants={<ZoneTexte libelle="Valeur (JSON)" valeur={json} onChange={setJson} lignes={8} mono />}
          />
        </Carte>
      )}
    </Lecture>
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
    if (ok) recharger();
  };
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
          {!valide.success ? <Bandeau ton="attention">{valide.error.issues[0]?.message ?? 'Valeur hors bornes.'}</Bandeau> : null}
          {peut ? null : <Bandeau>Les seuils se modifient avec le rôle contenu ou super-administrateur.</Bandeau>}
          <Message message={geste.message} />
          <div>
            <Bouton ton="principal" disabled={!peut || !valide.success || geste.occupe} onClick={() => void enregistrer()}>Enregistrer</Bouton>
          </div>
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
  const liste = useCharge(() => (peut ? staffApi.get('/staff?limit=50', adminStaffResponseSchema) : Promise.resolve(null)), String(peut));
  const [creer, setCreer] = useState(false);
  const geste = useGeste();
  const patcher = async (id: string, corps: Record<string, unknown>) => {
    const ok = await geste.lancer(() => staffApi.patch(`/staff/${id}`, okResponseSchema, { body: corps }));
    if (ok) liste.recharger();
  };
  if (!peut) return <Bandeau>La gestion des comptes équipe est réservée au super-administrateur.</Bandeau>;
  return (
    <>
      <Message message={geste.message} />
      <Carte style={{ padding: 0, overflow: 'hidden' }}>
        <Lecture etat={liste.etat} recharger={liste.recharger}>
          {(d) =>
            d === null ? null : (
              <div data-admin-defile="" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse', fontSize: '13px' }}>
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
                        <td style={{ padding: '10px 14px', fontWeight: 700 }}>{m.displayName}</td>
                        <td style={{ padding: '10px 14px' }}>{m.email}</td>
                        <td style={{ padding: '6px 14px', minWidth: '170px' }}>
                          <select aria-label={`Rôle de ${m.displayName}`} value={m.role} disabled={m.id === equipe?.staffId || geste.occupe} onChange={(e) => void patcher(m.id, { role: e.target.value })} style={{ height: '34px', borderRadius: '10px', border: `1px solid ${C.trait}`, font: 'inherit', fontSize: '13px', padding: '0 8px', background: '#fff' }}>
                            {ROLES.map((r) => <option key={r.valeur} value={r.valeur}>{r.libelle}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '10px 14px' }}>{m.totpEnrolled ? <Pastille ton="vert">Enrôlée</Pastille> : <Pastille ton="terre">À enrôler</Pastille>}</td>
                        <td style={{ padding: '10px 14px' }}>{m.lastLoginAt === null ? 'jamais' : dateCourte(m.lastLoginAt)}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <Interrupteur actif={m.isActive} onChange={(v) => void patcher(m.id, { isActive: v })} libelle={`Actif : ${m.displayName}`} disabled={m.id === equipe?.staffId || geste.occupe} />
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
      <div>
        <Bouton ton="principal" onClick={() => setCreer(true)}>+ Nouveau compte</Bouton>
      </div>
      <CreationCompte ouverte={creer} onFermer={() => setCreer(false)} onFait={() => { setCreer(false); liste.recharger(); }} />
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
  const [de, setDe] = useState('');
  const [a, setA] = useState('');
  const requete = () => {
    const p = new URLSearchParams();
    if (action.trim() !== '') p.set('action', action.trim());
    if (de !== '') p.set('from', new Date(`${de}T00:00:00`).toISOString());
    if (a !== '') p.set('to', new Date(`${a}T23:59:59`).toISOString());
    return p;
  };
  const liste = useCharge(() => {
    const p = requete();
    p.set('limit', '50');
    return staffApi.get(`/audit?${p.toString()}`, adminAuditResponseSchema);
  }, `${action}|${de}|${a}`);
  const geste = useGeste();
  const exporter = () => void geste.lancer(() => telechargerCsv(`/audit/export?${requete().toString()}`, 'audit.csv'), 'Export téléchargé.');
  return (
    <>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 200px' }}><Champ libelle="Action (p. ex. page.published)" valeur={action} onChange={setAction} /></div>
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
              <div data-admin-defile="" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: '720px', borderCollapse: 'collapse', fontSize: '13px' }}>
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
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{dateCourte(e.createdAt)}</td>
                        <td style={{ padding: '10px 14px' }}>{e.actorType === 'STAFF' ? 'Équipe' : e.actorType === 'SYSTEM' ? 'Système' : 'Membre'} {e.actorId === null ? '' : `· ${String(e.actorId).slice(-6)}`}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 700 }}>{e.action}</td>
                        <td style={{ padding: '10px 14px' }}>{e.targetType}{e.targetId === null ? '' : ` · ${String(e.targetId).slice(-6)}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </Lecture>
      </Carte>
    </>
  );
}
