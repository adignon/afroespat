'use client';

/**
 * AJOUT HORS MAQUETTE — J11 « MES PARCOURS », L'ÉTAT SANS PARCOURS, ET LES INVITATIONS.
 *
 * La liste vient de `GET /journeys` (les miens et ceux où je suis accompagnant). Les
 * deux cartes d'exemple de la planche « vide » (« Études · 82 % », « Travail · 46 % »)
 * étaient des parcours INVENTÉS : l'état vide montre maintenant l'explication « Comment
 * ça marche » et le bouton de création, rien d'autre. Les INVITATIONS reçues (§3.4)
 * s'affichent au-dessus, avec « Accepter » / « Refuser » — c'est là que mène la
 * notification d'invitation.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { JourneyInvitation, JourneyListItem } from '@app/shared';
import { displayMessageFor } from '@/lib/api/index';
import { acceptInvitation, declineInvitation, listJourneyInvitations, listJourneys } from '@/screens/parcours/api';
import { Avis, Attente, Bouton, C, Etiquette, Pastille, carte } from './ui';
import { signalerMaj, useGeste } from './donnees';

export function Invitations({ onChange }: { readonly onChange?: () => void }) {
  const [liste, setListe] = useState<readonly JourneyInvitation[] | null>(null);
  const geste = useGeste();
  const charger = useCallback(() => {
    listJourneyInvitations().then((r) => setListe(r.items), () => setListe([]));
  }, []);
  useEffect(charger, [charger]);

  if (liste === null || liste.length === 0) return null;
  const repondre = (id: string, accepter: boolean) => {
    void geste.executer(async () => {
      if (accepter) await acceptInvitation(id);
      else await declineInvitation(id);
      charger();
      signalerMaj();
      onChange?.();
    });
  };
  return (
    <section aria-label="Invitations" style={{ ...carte(18), background: C.vertPale, border: `1px solid ${C.vertPale2}`, display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <Etiquette>INVITATIONS</Etiquette>
      {liste.map((i) => (
        <div key={i.journeyId} style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700 }}>
              {i.invitedBy.displayName === null || i.invitedBy.displayName.trim() === '' ? `@${i.invitedBy.handle}` : i.invitedBy.displayName} vous invite
            </div>
            <div style={{ fontSize: '12.5px', color: C.gris }}>
              Parcours {i.template.nameFr} · {i.destinationCity.name} · {i.role === 'SUPPORTER' ? 'accompagnant·e' : 'observateur·rice'}
            </div>
          </div>
          <Bouton compact disabled={geste.occupe} onClick={() => repondre(i.journeyId, true)}>Accepter</Bouton>
          <Bouton compact ton="calme" disabled={geste.occupe} onClick={() => repondre(i.journeyId, false)}>Refuser</Bouton>
        </div>
      ))}
      <Avis texte={geste.erreur} ton="erreur" />
    </section>
  );
}

export function CommentCaMarche() {
  return (
    <div style={{ ...carte(20), display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <Etiquette>COMMENT ÇA MARCHE</Etiquette>
      {['Choisissez un type de parcours', 'Donnez-lui un nom et une date cible', 'Avancez étape par étape, avec l’aide des membres'].map((t, i) => (
        <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px' }}>
          <span style={{ width: '24px', height: '24px', borderRadius: '999px', background: C.vertPale2, color: C.vert, fontSize: '12px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
          {t}
        </div>
      ))}
      <div style={{ fontSize: '13px', color: C.gris }}>Votre parcours reste privé : vous choisissez qui le voit.</div>
    </div>
  );
}

const STATUT: Record<string, string> = { ACTIVE: 'ACTIF', PAUSED: 'EN PAUSE', COMPLETED: 'ABOUTI', ABANDONED: 'ARRÊTÉ', ARCHIVED: 'ARCHIVÉ' };

export function VueListe({ compact, vide = false }: { readonly compact: boolean; readonly vide?: boolean }) {
  const [liste, setListe] = useState<readonly JourneyListItem[] | null>(null);
  const [echec, setEchec] = useState<string | null>(null);
  const charger = useCallback(() => {
    listJourneys().then((r) => setListe(r.items), (cause: unknown) => setEchec(displayMessageFor(cause)));
  }, []);
  useEffect(charger, [charger]);

  const aucun = liste !== null && liste.length === 0;
  const corps = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ ...carte(compact ? 16 : 24), display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, flex: 1, fontSize: compact ? '20px' : '26px', fontWeight: 800, letterSpacing: '-0.8px' }}>Mes parcours</h1>
        <Link href="/parcours/nouveau" style={{ height: '42px', padding: '0 18px', borderRadius: '12px', background: C.vert, color: '#fff', fontSize: '13.5px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Nouveau parcours</Link>
      </div>
      <Invitations onChange={charger} />
      {liste === null && echec === null ? <Attente texte="Chargement de vos parcours…" /> : null}
      <Avis texte={echec} ton="erreur" />
      {aucun || vide ? (
        <>
          <div style={{ ...carte(20), color: C.gris, fontSize: '14px', lineHeight: 1.5 }}>Vous n’avez pas encore de parcours. Créez-en un pour découper votre projet en étapes.</div>
          <CommentCaMarche />
        </>
      ) : null}
      {(liste ?? []).map((p) => (
        <Link key={p.id} href={`/parcours/${p.id}`} style={{ ...carte(18), textDecoration: 'none', color: C.texte, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '15px', fontWeight: 800 }}>{p.title}</div>
              <div style={{ fontSize: '12.5px', color: C.gris }}>{p.template.nameFr} · {p.destinationCity.name}{p.isOwner ? '' : ' · vous accompagnez'}</div>
            </div>
            <Pastille fond={p.status === 'ACTIVE' ? C.vertPale2 : C.fond} texte={p.status === 'ACTIVE' ? C.vert : C.gris}>{STATUT[p.status] ?? p.status}</Pastille>
            <span style={{ fontSize: '16px', fontWeight: 800 }}>{Math.round(p.progressPct)}%</span>
          </div>
          <div style={{ height: '6px', borderRadius: '999px', background: C.barre, overflow: 'hidden' }}>
            <div style={{ width: `${p.progressPct}%`, height: '100%', background: C.orange }} />
          </div>
          <div style={{ fontSize: '12.5px', color: C.gris }}>
            {p.doneCount} / {p.stepCount} étapes{p.currentStep === null ? '' : ` · en cours : ${p.currentStep.title}`}
          </div>
        </Link>
      ))}
    </div>
  );
  return compact ? <div style={{ padding: '12px 16px 90px', flexGrow: 1 }}>{corps}</div> : corps;
}
