'use client';

import { useMemo, useState } from 'react';
import { okResponseSchema, type AdminCity } from '@app/shared';
import { staffApi } from '@/lib/api/index';
import { toutesLesVilles } from '../donnees';
import { useDroit } from '../session-equipe';
import { Bouton, C, Carte, Champ, Etiquette, Fenetre, FenetreMotif, Lecture, Message, Pastille, Selecteur, Titre, ZoneTexte, nombreFr, useCharge, useGeste } from '../ui';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT — D08 · LES VILLES : ACTIVER, FERMER, FUSIONNER (02 §4.2)             ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La maquette dessinait trois villes et trois boutons inertes. Ici le tableau est le
 * référentiel complet (`GET /admin/ref/cities`, curseur suivi jusqu'au bout), et les trois
 * gestes de 02 §4.2 appellent leurs routes :
 *
 *   · « Activer » : crée le réseau de la ville et y inscrit les membres déjà rattachés ;
 *   · « Fermer » : referme la ville, son réseau est conservé ;
 *   · « Fusionner » : IRRÉVERSIBLE — exige le slug de la ville absorbée en confirmation.
 *
 * Chaque geste exige un motif (10 caractères) et est tracé. La carte du haut reprend la
 * « ville candidate » de la maquette : la plus peuplée des villes fermées (02 §4.2 ouvre
 * une ville « en général à 20 membres »), avec son nombre réel de membres.
 *
 * Statuts, dans les couleurs de la maquette : Active (vert), Bientôt (terre cuite),
 * Doublon (gris). La ville pilote porte « Pilote » à la place d'« Active ».
 */

type Geste = { kind: 'activer' | 'fermer' | 'fusionner'; ville: AdminCity } | null;

function Statut({ v }: { readonly v: AdminCity }) {
  if (v.mergedIntoCityId !== null) return <Pastille>Doublon</Pastille>;
  if (v.isActive) return <Pastille ton="vert">{v.isPilot ? 'Pilote' : 'Active'}</Pastille>;
  return <Pastille ton="terre">Bientôt</Pastille>;
}

export function ContenuVilles() {
  const peut = useDroit('content');
  const { etat, recharger } = useCharge(() => toutesLesVilles(), 'villes');
  const [filtre, setFiltre] = useState('');
  const [vue, setVue] = useState('actives');
  const [geste, setGeste] = useState<Geste>(null);
  const action = useGeste();
  /** Ouvre une fenêtre : le message du geste précédent ne doit pas s'y afficher. */
  const ouvrir = (g: NonNullable<typeof geste>) => {
    action.effacer();
    setGeste(g);
  };
  const [cible, setCible] = useState('');
  const [slug, setSlug] = useState('');

  const villes = etat.phase === 'pret' ? etat.donnees : [];
  const candidate = useMemo(
    () => [...villes].filter((v) => !v.isActive && v.mergedIntoCityId === null).sort((a, b) => b.memberCount - a.memberCount)[0] ?? null,
    [villes],
  );
  const affichees = villes.filter((v) => {
    if (filtre.trim() !== '' && !v.name.toLowerCase().includes(filtre.trim().toLowerCase())) return false;
    if (vue === 'actives') return v.isActive && v.mergedIntoCityId === null;
    if (vue === 'fermees') return !v.isActive && v.mergedIntoCityId === null;
    if (vue === 'doublons') return v.mergedIntoCityId !== null;
    return true;
  });
  const nActives = villes.filter((v) => v.isActive).length;
  const nomDe = (id: string | null) => villes.find((v) => v.id === id)?.name ?? '—';

  const actionsDe = (v: AdminCity) =>
    v.mergedIntoCityId !== null ? (
      <span style={{ fontWeight: 700 }}>Fusionnée avec {nomDe(v.mergedIntoCityId)}</span>
    ) : (
      <span style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {v.isActive ? (
          <>
            <Bouton petit disabled={!peut} onClick={() => ouvrir({ kind: 'fusionner', ville: v })}>
              Fusionner
            </Bouton>
            {v.isPilot ? null : (
              <Bouton petit ton="contour" disabled={!peut} onClick={() => ouvrir({ kind: 'fermer', ville: v })}>
                Fermer
              </Bouton>
            )}
          </>
        ) : (
          <Bouton petit ton="principal" disabled={!peut} onClick={() => ouvrir({ kind: 'activer', ville: v })}>
            Activer
          </Bouton>
        )}
      </span>
    );

  /** Ferme la fenêtre ; après un SUCCÈS on garde le message de confirmation. */
  const fermer = (garderMessage = false) => {
    setGeste(null);
    if (!garderMessage) action.effacer();
    setCible('');
    setSlug('');
  };
  const confirmer = async (motif: string) => {
    if (geste === null) return;
    const { kind, ville } = geste;
    const ok = await action.lancer(async () => {
      if (kind === 'fusionner') {
        await staffApi.post(`/ref/cities/${ville.id}/merge`, okResponseSchema, { body: { targetCityId: cible, confirmSlug: slug.trim(), reason: motif } });
      } else {
        await staffApi.post(`/ref/cities/${ville.id}/${kind === 'activer' ? 'activate' : 'deactivate'}`, okResponseSchema, { body: { reason: motif } });
      }
    }, kind === 'fusionner' ? `${ville.name} est fusionnée.` : kind === 'activer' ? `${ville.name} est ouverte : son réseau est créé.` : `${ville.name} est fermée ; son réseau est conservé.`);
    if (ok) {
      fermer(true);
      recharger();
    }
  };

  return (
    <>
      <Titre titre="Référentiels" sous={etat.phase === 'pret' ? `${villes.length} villes · ${nActives} ${nActives > 1 ? 'actives' : 'active'}` : 'Villes'} />
      {geste === null ? <Message message={action.message} /> : null}
      <Lecture etat={etat} recharger={recharger}>
        {() => (
          <>
            {candidate === null ? null : (
              <Carte style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <Etiquette>Ville à ouvrir</Etiquette>
                  <div style={{ fontSize: '18px', fontWeight: 800, marginTop: '2px' }}>Activer {candidate.name} ?</div>
                  <div style={{ fontSize: '13px', color: C.gris, marginTop: '2px' }}>
                    Un réseau de ville sera créé et les {nombreFr(candidate.memberCount)} membres y seront rattachés automatiquement.
                  </div>
                </div>
                <Bouton ton="principal" disabled={!peut} titre={peut ? undefined : 'Réservé : contenu'} onClick={() => ouvrir({ kind: 'activer', ville: candidate })}>
                  Activer la ville
                </Bouton>
              </Carte>
            )}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <Champ libelle="Chercher une ville" valeur={filtre} onChange={setFiltre} />
              </div>
              <div style={{ minWidth: '170px' }}>
                <Selecteur libelle="Afficher" valeur={vue} onChange={setVue} options={[{ valeur: 'actives', libelle: 'Actives' }, { valeur: 'fermees', libelle: 'À activer' }, { valeur: 'doublons', libelle: 'Doublons' }, { valeur: 'toutes', libelle: 'Toutes' }]} />
              </div>
            </div>
            {/* Sous 1 024 px : une carte par ville, les gestes visibles sans défilement (admin.css). */}
            <div className="admin-cartes-mobile" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {affichees.length === 0 ? (
                <Carte>
                  <div style={{ textAlign: 'center', color: C.gris }}>Aucune ville ne correspond.</div>
                </Carte>
              ) : null}
              {affichees.map((v) => (
                <Carte key={v.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontWeight: 700, fontSize: '15px' }}>
                      {v.name} <span style={{ color: C.grisClair, fontWeight: 400 }}>· {v.country.iso2}</span>
                    </div>
                    <Statut v={v} />
                  </div>
                  <div style={{ fontSize: '13px', color: C.gris }}>
                    {v.region ?? '—'} · {nombreFr(v.memberCount)} {v.memberCount > 1 ? 'membres' : 'membre'}
                  </div>
                  {actionsDe(v)}
                </Carte>
              ))}
            </div>
            <Carte className="admin-table-bureau" style={{ padding: 0, overflow: 'hidden' }}>
              <div data-admin-defile="" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: '640px', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: C.grisClair, fontSize: '10.5px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                      {['Ville', 'Région', 'Membres', 'Statut', 'Action'].map((h) => (
                        <th key={h} style={{ padding: '12px 14px', fontWeight: 700 }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {affichees.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '22px', textAlign: 'center', color: C.gris }}>
                          Aucune ville ne correspond.
                        </td>
                      </tr>
                    ) : null}
                    {affichees.map((v) => (
                      <tr key={v.id} style={{ borderTop: `1px solid ${C.traitLeger}` }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                          {v.name} <span style={{ color: C.grisClair, fontWeight: 400 }}>· {v.country.iso2}</span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>{v.region ?? '—'}</td>
                        <td style={{ padding: '10px 14px' }}>{nombreFr(v.memberCount)}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <Statut v={v} />
                        </td>
                        <td style={{ padding: '6px 14px' }}>
                          {actionsDe(v)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Carte>
            <FenetreMotif
              ouverte={geste !== null && geste.kind !== 'fusionner'}
              titre={geste?.kind === 'fermer' ? `Fermer ${geste.ville.name}` : `Activer ${geste?.ville.name ?? ''}`}
              consigne={
                geste?.kind === 'fermer'
                  ? 'La ville se referme ; son réseau est conservé, pas supprimé.'
                  : `Le réseau de la ville est créé et les ${nombreFr(geste?.ville.memberCount ?? 0)} membres déjà rattachés y sont inscrits.`
              }
              min={10}
              max={500}
              libelleConfirmer={geste?.kind === 'fermer' ? 'Fermer la ville' : 'Activer la ville'}
              onConfirmer={(m) => void confirmer(m)}
              onFermer={() => fermer()}
              occupe={action.occupe}
              message={action.message}
            />
            <Fenetre ouverte={geste?.kind === 'fusionner'} titre={`Fusionner ${geste?.ville.name ?? ''}`} onFermer={() => fermer()}>
              <div style={{ fontSize: '14px', color: C.gris }}>
                IRRÉVERSIBLE : les membres de la ville absorbée passent dans la ville choisie, et la première devient un doublon.
              </div>
              <Selecteur
                libelle="Ville qui absorbe"
                valeur={cible}
                onChange={setCible}
                options={[{ valeur: '', libelle: 'Choisir…' }, ...villes.filter((v) => v.isActive && v.mergedIntoCityId === null && v.id !== geste?.ville.id).map((v) => ({ valeur: v.id, libelle: v.name }))]}
              />
              <Champ libelle={`Saisissez « ${geste?.ville.slug ?? ''} » pour confirmer`} valeur={slug} onChange={setSlug} />
              <FusionMotif occupe={action.occupe || cible === '' || slug.trim() !== (geste?.ville.slug ?? '')} message={action.message} onConfirmer={(m) => void confirmer(m)} onAnnuler={() => fermer()} />
            </Fenetre>
          </>
        )}
      </Lecture>
    </>
  );
}

function FusionMotif({ occupe, message, onConfirmer, onAnnuler }: { readonly occupe: boolean; readonly message: { ton: 'info' | 'attention'; texte: string } | null; readonly onConfirmer: (m: string) => void; readonly onAnnuler: () => void }) {
  const [motif, setMotif] = useState('');
  const ok = motif.trim().length >= 10;
  return (
    <>
      <ZoneTexte libelle="Motif · 10 caractères minimum" valeur={motif} onChange={setMotif} lignes={3} maxLength={500} />
      <Message message={message} />
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <Bouton onClick={onAnnuler}>Annuler</Bouton>
        <Bouton ton="sombre" disabled={occupe || !ok} onClick={() => onConfirmer(motif.trim())}>
          Fusionner
        </Bouton>
      </div>
    </>
  );
}
