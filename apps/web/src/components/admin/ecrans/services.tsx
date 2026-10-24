'use client';

import { useState } from 'react';
import {
  HOUSING_PRICE_BOUNDS_DEFAULT,
  PRO_REJECTION_REASON_MIN,
  adminModerationCasesResponseSchema,
  adminProProfilesResponseSchema,
  adminSettingSchema,
  okResponseSchema,
  type AdminProProfile,
} from '@app/shared';
import { z } from 'zod';
import { API_BASE, staffApi } from '@/lib/api/index';
import { useDroit, useEquipe } from '../session-equipe';
import { Bandeau, Bouton, C, Carte, Champ, Colonnes, Etiquette, FenetreMotif, Lecture, Message, Pastille, Titre, Vide, ZoneTexte, useCharge, useGeste } from '../ui';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ AJOUT — D10 · SERVICES : JUSTIFICATIFS PRO, ANNONCES À RISQUE, BORNES (10 §4)║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Trois cartes, trois gestes réels :
 *
 *   · JUSTIFICATIFS PRO — la file des fiches en attente (`GET /pro-profiles`), avec la
 *     fiche, le justificatif (type et taille du fichier : le fichier lui-même n'est jamais
 *     servi dans le navigateur, 00 §8.1), « Approuver » et « Rejeter » avec motif
 *     (`PRO_REJECTION_REASON_MIN`). Rôles : SUPER_ADMIN, CONTENT_ADMIN, SUPPORT ;
 *   · ANNONCES LOGEMENT À RISQUE — les dossiers de modération ouverts sur une annonce de
 *     logement ; « Publier » les classe (DISMISS), « Retirer » les retire, chacun avec un
 *     motif. Réservé à la modération (lot A : CONTENT_ADMIN n'a pas la file) ;
 *   · BORNES DE PRIX — `housing.price_bounds`. ⚠ ÉCART : la maquette dessine un tableau
 *     par ville et par type (chambre, studio, T2). Le réglage du serveur est UNE paire
 *     globale (minimum, maximum) : six cases par ville inventeraient des bornes que rien
 *     ne lit. L'écran édite la paire réelle. Écriture : SUPER_ADMIN.
 */

const euros = (cents: number) => String(Math.round(cents / 100));
const boundsSchema = z.object({ minCents: z.number(), maxCents: z.number() });

export function ContenuServices() {
  return (
    <>
      <Titre titre="Services" />
      <Colonnes gabarit="minmax(0,1fr) minmax(0,1fr)">
        <Justificatifs />
        <AnnoncesARisque />
      </Colonnes>
      <Bornes />
    </>
  );
}

function Justificatifs() {
  const peut = useDroit('proReview');
  const { etat, recharger } = useCharge(() => staffApi.get('/pro-profiles?status=PENDING&limit=20', adminProProfilesResponseSchema), 'pros');
  const [rejet, setRejet] = useState<AdminProProfile | null>(null);
  const geste = useGeste();
  const approuver = async (p: AdminProProfile) => {
    const ok = await geste.lancer(() => staffApi.post(`/pro-profiles/${p.id}/approve`, okResponseSchema, { body: {} }), 'Fiche approuvée.');
    if (ok) recharger();
  };
  const rejeter = async (motif: string) => {
    if (rejet === null) return;
    const ok = await geste.lancer(() => staffApi.post(`/pro-profiles/${rejet.id}/reject`, okResponseSchema, { body: { reason: motif } }), 'Fiche rejetée : le professionnel est prévenu.');
    if (ok) {
      setRejet(null);
      recharger();
    }
  };
  return (
    <Carte style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <Lecture etat={etat} recharger={recharger}>
        {(d) => (
          <>
            <Etiquette>Justificatifs pro · {d.items.length}{d.nextCursor === null ? '' : '+'}</Etiquette>
            <Message message={geste.message} />
            {d.items.length === 0 ? <Vide>Aucune fiche en attente de validation.</Vide> : null}
            {d.items.map((p) => (
              <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: `1px solid ${C.traitLeger}`, paddingTop: '12px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '999px', background: C.vertFonce, color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {p.member.displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '15px', fontWeight: 700 }}>{p.businessName ?? p.member.displayName}</div>
                    <div style={{ fontSize: '12.5px', color: C.gris }}>
                      {p.profession?.nameFr ?? 'Métier non précisé'} · {p.cities.map((c) => c.name).join(', ') || 'sans ville'}
                    </div>
                  </div>
                </div>
                {p.description === null ? null : <div style={{ fontSize: '13px' }}>{p.description}</div>}
                <div style={{ fontSize: '12.5px', color: C.gris }}>
                  {p.siret === null ? 'Pas de SIRET' : `SIRET ${p.siret}`} · justificatif :{' '}
                  {p.proof === null ? 'aucun' : `${p.proof.mime} · ${Math.max(1, Math.round(p.proof.sizeBytes / 1024))} Ko`}
                  {p.proof === null ? null : (
                    <>
                      {' · '}
                      <a
                        href={`${API_BASE}/admin/pro-profiles/${p.id}/proof`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: C.vertFonce, fontWeight: 700 }}
                      >
                        Voir le justificatif
                      </a>
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Bouton ton="principal" disabled={!peut || geste.occupe} onClick={() => void approuver(p)}>
                    Approuver
                  </Bouton>
                  <Bouton disabled={!peut || geste.occupe} onClick={() => setRejet(p)}>
                    Rejeter
                  </Bouton>
                </div>
              </div>
            ))}
          </>
        )}
      </Lecture>
      <FenetreMotif
        ouverte={rejet !== null}
        titre="Rejeter la fiche"
        consigne={rejet === null ? '' : `${rejet.businessName ?? rejet.member.displayName} — le motif est communiqué au professionnel.`}
        min={PRO_REJECTION_REASON_MIN}
        libelleConfirmer="Rejeter"
        onConfirmer={(m) => void rejeter(m)}
        onFermer={() => setRejet(null)}
        occupe={geste.occupe}
        message={geste.message}
      />
    </Carte>
  );
}

function AnnoncesARisque() {
  const peut = useDroit('moderation');
  const { equipe } = useEquipe();
  const { etat, recharger } = useCharge(
    () => (peut ? staffApi.get('/moderation/cases?subjectType=HOUSING&status=OPEN&limit=20', adminModerationCasesResponseSchema) : Promise.resolve(null)),
    `${String(peut)}|${equipe?.role ?? ''}`,
  );
  const [cible, setCible] = useState<{ id: string; action: 'DISMISS' | 'REMOVE'; titre: string } | null>(null);
  const geste = useGeste();
  const appliquer = async (motif: string) => {
    if (cible === null) return;
    const ok = await geste.lancer(() => staffApi.post(`/moderation/cases/${cible.id}/actions`, okResponseSchema, { body: { action: cible.action, reason: motif } }), cible.action === 'DISMISS' ? 'Annonce publiée (dossier classé).' : 'Annonce retirée.');
    if (ok) {
      setCible(null);
      recharger();
    }
  };
  return (
    <Carte style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <Etiquette>Annonces logement à risque</Etiquette>
      {!peut ? (
        <Bandeau>La file des annonces à risque est réservée à la modération.</Bandeau>
      ) : (
        <Lecture etat={etat} recharger={recharger}>
          {(d) =>
            d === null || d.items.length === 0 ? (
              <Vide>Aucune annonce en attente d’examen.</Vide>
            ) : (
              <>
                <Message message={geste.message} />
                {d.items.map((c) => (
                  <div key={c.id} style={{ borderTop: `1px solid ${C.traitLeger}`, paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <div style={{ flex: 1, fontSize: '14.5px', fontWeight: 700 }}>{c.title ?? 'Annonce de logement'}</div>
                      {c.aiScore === null ? null : <Pastille ton={c.aiScore >= 0.7 ? 'sombre' : 'terre'}>Score {Math.round(c.aiScore * 100)}</Pastille>}
                    </div>
                    {c.aiLabels.length === 0 ? null : <div style={{ fontSize: '12.5px', color: C.gris }}>{c.aiLabels.join(' · ')}</div>}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Bouton petit disabled={geste.occupe} onClick={() => setCible({ id: c.id, action: 'DISMISS', titre: c.title ?? 'cette annonce' })}>
                        Publier
                      </Bouton>
                      <Bouton petit ton="sombre" disabled={geste.occupe} onClick={() => setCible({ id: c.id, action: 'REMOVE', titre: c.title ?? 'cette annonce' })}>
                        Retirer
                      </Bouton>
                    </div>
                  </div>
                ))}
              </>
            )
          }
        </Lecture>
      )}
      <FenetreMotif
        ouverte={cible !== null}
        titre={cible?.action === 'DISMISS' ? 'Publier l’annonce' : 'Retirer l’annonce'}
        consigne={cible?.titre ?? ''}
        min={3}
        libelleConfirmer="Confirmer"
        onConfirmer={(m) => void appliquer(m)}
        onFermer={() => setCible(null)}
        occupe={geste.occupe}
        message={geste.message}
      />
    </Carte>
  );
}

function Bornes() {
  const peut = useDroit('staffAdmin');
  const { etat, recharger } = useCharge(() => staffApi.get('/settings/housing.price_bounds', adminSettingSchema), 'bornes');
  const geste = useGeste();
  const [min, setMin] = useState<string | null>(null);
  const [max, setMax] = useState<string | null>(null);
  const [motif, setMotif] = useState('');
  return (
    <Carte style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <Etiquette>Bornes de prix des annonces de logement</Etiquette>
      <Lecture etat={etat} recharger={recharger}>
        {(s) => {
          const b = boundsSchema.safeParse(s.value);
          const courant = b.success ? b.data : HOUSING_PRICE_BOUNDS_DEFAULT;
          const vMin = min ?? euros(courant.minCents);
          const vMax = max ?? euros(courant.maxCents);
          const enregistrer = async () => {
            const ok = await geste.lancer(
              () =>
                staffApi.put('/settings/housing.price_bounds', okResponseSchema, {
                  body: { value: { minCents: Math.round(Number(vMin) * 100), maxCents: Math.round(Number(vMax) * 100) }, ...(motif.trim() === '' ? {} : { reason: motif.trim() }) },
                }),
              'Bornes enregistrées.',
            );
            if (ok) {
              setMin(null);
              setMax(null);
              setMotif('');
              recharger();
            }
          };
          return (
            <>
              <div style={{ fontSize: '13px', color: C.gris }}>{s.description} Une annonce hors de ces bornes passe en examen.</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                <Champ libelle="Prix minimum accepté (€)" valeur={vMin} onChange={(v) => setMin(v.replace(/\D/g, ''))} inputMode="numeric" disabled={!peut} />
                <Champ libelle="Prix maximum accepté (€)" valeur={vMax} onChange={(v) => setMax(v.replace(/\D/g, ''))} inputMode="numeric" disabled={!peut} />
              </div>
              {peut ? <ZoneTexte libelle="Motif (facultatif)" valeur={motif} onChange={setMotif} lignes={2} maxLength={1000} /> : <Bandeau>Les bornes se modifient avec le rôle super-administrateur.</Bandeau>}
              <Message message={geste.message} />
              <div>
                <Bouton ton="principal" disabled={!peut || geste.occupe || Number(vMin) >= Number(vMax)} onClick={() => void enregistrer()}>
                  Enregistrer
                </Bouton>
              </div>
            </>
          );
        }}
      </Lecture>
    </Carte>
  );
}
