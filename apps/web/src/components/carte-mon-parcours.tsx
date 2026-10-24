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

/**
 * LE PARCOURS ACTIF DU MEMBRE — `undefined` avant la réponse, `null` sans parcours.
 *
 * Partagé par la carte de l'ordinateur et par celle du téléphone (A01) : une seule
 * lecture de `GET /journeys` par page, une seule façon de dire « étape 3 : … ».
 */
export function useMonParcours(): Parcours | null | undefined {
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

  return parcours;
}

/** La ligne « Étape 7 : Logement », ou l'invitation à commencer. `''` avant la réponse. */
export function libelleEtape(parcours: Parcours | null | undefined): string {
  if (parcours === undefined) return '';
  if (parcours === null) return 'Lancez votre premier parcours';
  if (parcours.currentStep === null) {
    return parcours.status === 'COMPLETED' ? 'Parcours terminé' : 'Toutes les étapes sont faites';
  }
  return `Étape ${String(Math.min(parcours.doneCount + 1, parcours.stepCount))} : ${parcours.currentStep.title}`;
}

export function CarteMonParcours() {
  const parcours = useMonParcours();

  const pct = parcours === undefined || parcours === null ? 0 : Math.round(parcours.progressPct);
  const titre =
    parcours === undefined ? '' : parcours === null ? 'Aucun parcours en cours' : parcours.title;
  const etape = libelleEtape(parcours);

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

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA MÊME CARTE, AU FORMAT DU TÉLÉPHONE (A01, 390 px)                        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La planche mobile de l'accueil dessinait « Mes études à Lyon · 58 % · Étape 7 :
 * Logement » et un « Continuer » sans destination (`<span>`), pour tout le monde —
 * y compris un membre sans parcours. Mesuré : identique pour un compte à 0 % et
 * pour un compte sans aucun parcours.
 *
 * Elle lit la même source que la carte de l'ordinateur et dit la même chose :
 * « Aucun parcours en cours » + « Commencer » sans parcours, sinon le titre, le
 * pourcentage, l'étape courante et « Continuer » vers le parcours. Le dessin est
 * celui de la planche (fond `#0F5C48`, rayon 20, barre de 6 px).
 */
export function CarteParcoursTelephone() {
  const parcours = useMonParcours();
  const pct = parcours === undefined || parcours === null ? 0 : Math.round(parcours.progressPct);
  const titre =
    parcours === undefined ? '' : parcours === null ? 'Aucun parcours en cours' : parcours.title;

  return (
    <div
      data-carte-mon-parcours=""
      style={{ background: '#0F5C48', borderRadius: '20px', padding: '14px 16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '14px' }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, minWidth: 0 }}>{titre}</span>
          {parcours === null || parcours === undefined ? null : (
            <span style={{ fontSize: '16px', fontWeight: 800 }}>{`${String(pct)}%`}</span>
          )}
        </div>
        <div style={{ height: '6px', borderRadius: '999px', background: 'rgba(255,255,255,.18)', marginTop: '8px', overflow: 'hidden' }}>
          <div style={{ width: `${String(pct)}%`, height: '100%', background: '#E0733A', borderRadius: '999px' }} />
        </div>
        <div style={{ fontSize: '12px', color: '#F0C3A4', fontWeight: 600, marginTop: '8px' }}>{libelleEtape(parcours)}</div>
      </div>
      {parcours === undefined ? null : (
        <Link
          href={parcours === null ? '/parcours/nouveau' : `/parcours/${parcours.id}`}
          style={{ background: '#fff', color: '#0F5C48', fontWeight: 700, fontSize: '12.5px', padding: '9px 14px', borderRadius: '999px', textDecoration: 'none', whiteSpace: 'nowrap' }}
        >
          {parcours === null ? 'Commencer' : 'Continuer'}
        </Link>
      )}
    </div>
  );
}
