'use client';

import { useEffect, useMemo, useState } from 'react';
import { adminScamAlertsResponseSchema, okResponseSchema, scamAlertWriteSchema } from '@app/shared';
import { staffApi } from '@/lib/api/index';
import { toutesLesVilles } from '../donnees';
import { useDroit } from '../session-equipe';
import { Bandeau, Bouton, C, Carte, Champ, Colonnes, Etiquette, Interrupteur, Lecture, Message, Onglets, Pastille, Selecteur, Titre, Vide, ZoneTexte, dateLongue, useCharge, useGeste } from '../ui';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT — D11 · LES ALERTES ARNAQUES (13 §5)                                  ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La maquette dessine UN formulaire figé (« Faux sites de rendez-vous préfecture »).
 * Ici : la liste réelle des alertes (publiées, programmées, terminées — lecture équipe
 * `GET /admin/moderation/scam-alerts`), l'éditeur de la maquette — titre, texte, gravité
 * (Info · Vigilance · Urgente), ciblage (Global, une ville, un pays), expiration, dossier
 * lié, épinglage — et l'aperçu membre, qui montre l'alerte telle que la verront les
 * membres. Créer, modifier, retirer : `POST`, `PUT`, `POST …/retire`, rôles CONTENT_ADMIN
 * et SUPER_ADMIN.
 *
 * Le ciblage est exclusif (13 §5) : une ville OU un pays OU rien (global). Les bornes
 * (titre ≥ 5, texte ≥ 20 caractères) viennent de `scamAlertWriteSchema` : l'écran vérifie
 * avec le MÊME schéma avant d'appeler, le serveur reste juge.
 */

const GRAVITES = [
  { id: 'INFO', libelle: 'Info' },
  { id: 'WARNING', libelle: 'Vigilance' },
  { id: 'CRITICAL', libelle: 'Urgente' },
] as const;
type Gravite = (typeof GRAVITES)[number]['id'];
const ETATS = { draft: 'Programmée', active: 'Active', ended: 'Terminée' } as const;

export function ContenuAlertes() {
  const peut = useDroit('content');
  const liste = useCharge(() => staffApi.get('/moderation/scam-alerts', adminScamAlertsResponseSchema), 'alertes');
  const villes = useCharge(() => toutesLesVilles(), 'villes');
  const [sel, setSel] = useState<string | 'nouvelle' | null>(null);

  useEffect(() => {
    if (sel === null && liste.etat.phase === 'pret') setSel(liste.etat.donnees.items[0]?.id ?? 'nouvelle');
  }, [sel, liste.etat]);

  const pays = useMemo(() => {
    if (villes.etat.phase !== 'pret') return [];
    const m = new Map<string, string>();
    for (const v of villes.etat.donnees) m.set(v.country.id, v.country.nameFr);
    return [...m].map(([valeur, libelle]) => ({ valeur, libelle }));
  }, [villes.etat]);
  const optionsVilles = villes.etat.phase === 'pret' ? villes.etat.donnees.filter((v) => v.isActive).map((v) => ({ valeur: v.id, libelle: v.name })) : [];

  return (
    <>
      <Lecture etat={liste.etat} recharger={liste.recharger}>
        {(d) => {
          const courante = d.items.find((a) => a.id === sel) ?? null;
          return (
            <>
              <Titre
                titre="Alertes arnaques"
                action={
                  <Bouton ton="principal" disabled={!peut} titre={peut ? undefined : 'Réservé : contenu'} onClick={() => setSel('nouvelle')}>
                    + Nouvelle alerte
                  </Bouton>
                }
              />
              <Colonnes gabarit="minmax(0,1.5fr) minmax(0,1fr)">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <Editeur
                    key={sel ?? 'rien'}
                    alerte={courante}
                    peut={peut}
                    villes={optionsVilles}
                    pays={pays}
                    onFait={(id) => {
                      if (id !== null) setSel(id);
                      liste.recharger();
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Etiquette>Alertes</Etiquette>
                  {d.items.length === 0 ? (
                    <Carte>
                      <Vide>Aucune alerte.</Vide>
                    </Carte>
                  ) : (
                    d.items.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setSel(a.id)}
                        style={{ textAlign: 'left', border: a.id === sel ? `1.5px solid ${C.vert}` : `1px solid ${C.trait}`, background: '#fff', borderRadius: '16px', padding: '12px 14px', font: 'inherit', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '4px' }}
                      >
                        <span style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '14px', flex: 1, minWidth: 0 }}>{a.title}</strong>
                          <Pastille ton={a.state === 'active' ? 'vert' : 'neutre'}>{ETATS[a.state]}</Pastille>
                        </span>
                        <span style={{ fontSize: '12px', color: C.gris }}>
                          {GRAVITES.find((g) => g.id === a.severity)?.libelle} · {a.cityName ?? a.countryName ?? 'Global'}
                          {a.expiresAt === null ? '' : ` · jusqu’au ${dateLongue(a.expiresAt)}`}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </Colonnes>
            </>
          );
        }}
      </Lecture>
    </>
  );
}

function Editeur({
  alerte,
  peut,
  villes,
  pays,
  onFait,
}: {
  readonly alerte: { id: string; title: string; body: string; severity: Gravite; cityId: string | null; countryId: string | null; isPinned: boolean; expiresAt: string | null; publishedAt: string | null; state: 'draft' | 'active' | 'ended' } | null;
  readonly peut: boolean;
  readonly villes: readonly { valeur: string; libelle: string }[];
  readonly pays: readonly { valeur: string; libelle: string }[];
  readonly onFait: (id: string | null) => void;
}) {
  const geste = useGeste();
  const [titre, setTitre] = useState(alerte?.title ?? '');
  const [texte, setTexte] = useState(alerte?.body ?? '');
  const [gravite, setGravite] = useState<Gravite>(alerte?.severity ?? 'WARNING');
  const [portee, setPortee] = useState<'global' | 'ville' | 'pays'>(alerte?.cityId != null ? 'ville' : alerte?.countryId != null ? 'pays' : 'global');
  const [ville, setVille] = useState(alerte?.cityId ?? '');
  const [paysId, setPaysId] = useState(alerte?.countryId ?? '');
  const [expire, setExpire] = useState(alerte?.expiresAt?.slice(0, 10) ?? '');
  const [dossier, setDossier] = useState('');
  const [epingle, setEpingle] = useState(alerte?.isPinned ?? false);

  const corps = () => ({
    title: titre.trim(),
    body: texte.trim(),
    severity: gravite,
    ...(portee === 'ville' && ville !== '' ? { cityId: ville } : {}),
    ...(portee === 'pays' && paysId !== '' ? { countryId: paysId } : {}),
    isPinned: epingle,
    ...(expire === '' ? {} : { expiresAt: new Date(`${expire}T23:59:00`).toISOString() }),
    ...(dossier.trim() === '' ? {} : { relatedCaseId: dossier.trim() }),
  });
  const valide = scamAlertWriteSchema.safeParse(corps());
  const enregistrer = async () => {
    if (!valide.success) return;
    let id: string | null = alerte?.id ?? null;
    const ok = await geste.lancer(async () => {
      if (alerte === null) {
        const r = await staffApi.post('/moderation/scam-alerts', okResponseSchema, { body: valide.data });
        id = String((r as { id?: string }).id ?? '') || null;
      } else {
        await staffApi.put(`/moderation/scam-alerts/${alerte.id}`, okResponseSchema, { body: valide.data });
      }
    }, alerte === null ? 'Alerte publiée.' : 'Alerte enregistrée.');
    if (ok) onFait(id);
  };
  const retirer = async () => {
    if (alerte === null) return;
    const ok = await geste.lancer(() => staffApi.post(`/moderation/scam-alerts/${alerte.id}/retire`, okResponseSchema), 'Alerte retirée de l’affichage.');
    if (ok) onFait(null);
  };

  return (
    <>
      <Carte style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Etiquette>{alerte === null ? 'Nouvelle alerte' : 'Modifier l’alerte'}</Etiquette>
        <Champ libelle="Titre" valeur={titre} onChange={setTitre} disabled={!peut} maxLength={160} />
        <ZoneTexte libelle="Texte" valeur={texte} onChange={setTexte} lignes={3} disabled={!peut} maxLength={5000} />
        <div>
          <div style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' }}>Gravité</div>
          <Onglets onglets={GRAVITES.map((g) => ({ id: g.id, libelle: g.libelle }))} actif={gravite} onChange={setGravite} />
        </div>
        <div>
          <div style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' }}>Ciblage</div>
          <Onglets onglets={[{ id: 'global', libelle: 'Global' }, { id: 'ville', libelle: 'Une ville' }, { id: 'pays', libelle: 'Un pays' }]} actif={portee} onChange={setPortee} />
          {portee === 'ville' ? <div style={{ marginTop: '8px' }}><Selecteur libelle="Ville" valeur={ville} onChange={setVille} options={[{ valeur: '', libelle: 'Choisir…' }, ...villes]} /></div> : null}
          {portee === 'pays' ? <div style={{ marginTop: '8px' }}><Selecteur libelle="Pays" valeur={paysId} onChange={setPaysId} options={[{ valeur: '', libelle: 'Choisir…' }, ...pays]} /></div> : null}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <Champ libelle="Expiration" valeur={expire} onChange={setExpire} type="date" disabled={!peut} />
          <Champ libelle="Dossier lié (identifiant)" valeur={dossier} onChange={setDossier} disabled={!peut} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', fontWeight: 700 }}>
          <span style={{ flex: 1 }}>Épinglée en haut des fils</span>
          <Interrupteur actif={epingle} onChange={setEpingle} libelle="Épinglée en haut des fils" disabled={!peut} />
        </div>
        {!valide.success && (titre !== '' || texte !== '') ? <Bandeau ton="attention">{valide.error.issues[0]?.message ?? 'Alerte incomplète.'}</Bandeau> : null}
        <Message message={geste.message} />
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Bouton ton="principal" disabled={!peut || !valide.success || geste.occupe} onClick={() => void enregistrer()}>
            {alerte === null ? 'Publier l’alerte' : 'Enregistrer'}
          </Bouton>
          {alerte !== null && alerte.state !== 'ended' ? (
            <Bouton disabled={!peut || geste.occupe} onClick={() => void retirer()}>
              Retirer
            </Bouton>
          ) : null}
        </div>
      </Carte>
      <div>
        <Etiquette>Aperçu membre</Etiquette>
        <div style={{ background: C.terrePale, borderRadius: '18px', padding: '14px 16px', marginTop: '6px' }}>
          <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '1px', color: C.terre }}>ALERTE {GRAVITES.find((g) => g.id === gravite)?.libelle.toUpperCase()}</div>
          <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '4px' }}>{titre === '' ? 'Titre de l’alerte' : titre}</div>
          <div style={{ fontSize: '13.5px', marginTop: '2px' }}>{texte === '' ? 'Le texte s’affichera ici.' : texte}</div>
        </div>
      </div>
    </>
  );
}
