'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { JourneysListResponse } from '@app/shared';
import { listJourneys } from '@/screens/parcours/api';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA CARTE « MON PARCOURS » DE LA COLONNE DE GAUCHE                          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La colonne de gauche de l'ordinateur — commune à une trentaine d'écrans, dont
 * tout le module réseaux — dessinait « Mes études à Lyon · 58 % · Étape 7 :
 * Logement · Continuer » EN DUR, et « Continuer » menait à `#`. Le porteur l'a
 * relevé parmi les défauts du module réseaux.
 *
 * Elle lit maintenant `GET /journeys` (mes parcours, §5.1) et montre le PREMIER
 * parcours actif dont je suis propriétaire — à défaut, le premier de la liste :
 * son titre, son avancement, l'étape en cours (rang = étapes faites + 1) et un
 * « Continuer » qui ouvre le parcours. Sans parcours, la même carte propose
 * « Commencer » vers `/parcours/nouveau`.
 *
 * Le DESSIN est celui de la maquette, recopié valeur pour valeur (vert
 * `#0F5C48`, rayon 22, barre orange de 8 px) : seules les valeurs changent.
 * La liste est demandée UNE FOIS par page, partagée entre les cadres (comme
 * `CarteMembre` le fait pour le membre courant).
 */
type Parcours = JourneysListResponse['items'][number];

let enCours: Promise<Parcours | null> | null = null;

function demander(): Promise<Parcours | null> {
  return listJourneys()
    .then((page) => {
      const actifs = page.items.filter((j) => j.status === 'ACTIVE');
      return actifs.find((j) => j.isOwner) ?? actifs[0] ?? page.items[0] ?? null;
    })
    .catch(() => {
      // Une liste illisible ne casse pas la colonne : la carte invite à commencer.
      enCours = null;
      return null;
    });
}

export function CarteMonParcours() {
  const [parcours, setParcours] = useState<Parcours | null | undefined>(undefined);

  useEffect(() => {
    let vivant = true;
    enCours ??= demander();
    void enCours.then((p) => {
      if (vivant) setParcours(p);
    });
    return () => {
      vivant = false;
    };
  }, []);

  const pct = parcours === undefined || parcours === null ? 0 : Math.round(parcours.progressPct);
  const titre =
    parcours === undefined ? '' : parcours === null ? 'Aucun parcours en cours' : parcours.title;
  const etape =
    parcours === undefined || parcours === null
      ? parcours === null
        ? 'Lancez votre premier parcours'
        : ''
      : parcours.currentStep === null
        ? parcours.status === 'COMPLETED'
          ? 'Parcours terminé'
          : 'Toutes les étapes sont faites'
        : `Étape ${String(Math.min(parcours.doneCount + 1, parcours.stepCount))} : ${parcours.currentStep.title}`;

  return (
    <div style={{ background: '#0F5C48', borderRadius: '22px', padding: '18px', color: '#fff' }} data-carte-mon-parcours="">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '1px', color: '#A9CDBF' }}>MON PARCOURS</div>
          <div style={{ fontSize: '14.5px', fontWeight: 700, marginTop: '5px', letterSpacing: '-0.2px' }}>{titre}</div>
        </div>
        {parcours === null || parcours === undefined ? null : (
          <span style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.8px' }}>{`${String(pct)}%`}</span>
        )}
      </div>
      <div style={{ height: '8px', borderRadius: '999px', background: 'rgba(255,255,255,.18)', marginTop: '14px', overflow: 'hidden' }}>
        <div style={{ width: `${String(pct)}%`, height: '100%', background: '#E0733A', borderRadius: '999px' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', gap: '8px' }}>
        <span style={{ fontSize: '12.5px', color: '#F0C3A4', fontWeight: 600, minWidth: 0 }}>{etape}</span>
        {parcours === undefined ? null : (
          <Link
            href={parcours === null ? '/parcours/nouveau' : `/parcours/${parcours.id}`}
            style={{ background: '#fff', color: '#0F5C48', fontWeight: 700, fontSize: '12.5px', padding: '7px 14px', borderRadius: '999px', textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            {parcours === null ? 'Commencer' : 'Continuer'}
          </Link>
        )}
      </div>
    </div>
  );
}
