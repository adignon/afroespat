'use client';

/**
 * AJOUT HORS MAQUETTE — « PARCOURS PUBLICS » ET « RAPPELS » DU PANNEAU DE GAUCHE.
 *
 * Les dix planches d'ordinateur du module dessinent, sous la carte « Mon parcours »,
 * deux cartes écrites en dur : cinq membres inventés (« Fatou N. · Études · Lyon »,
 * « Kofi B. »…) avec leur barre de progression, et trois rappels inventés (« Dossier
 * Visale — dans 9 jours », « RDV banque — jeudi 10 h »). Elles deviennent :
 *
 *   · PARCOURS PUBLICS — les cinq parcours publics d'AUTRES membres que
 *     `GET /journeys/public?limit=5` classe (même type d'abord, même ville, avancement
 *     proche du mien — §3.7), chacun menant à sa fiche. Rien à montrer : la carte se tait ;
 *   · RAPPELS — les trois prochaines ÉCHÉANCES de mon parcours (étapes non franchies avec
 *     `dueDate`), la rubrique « RAPPELS » du panneau de §6. Aucune échéance : la carte se tait.
 *
 * Géométrie relevée sur la planche : carte `#fff`, bord `#E6EBE9`, rayon 22, retrait 14 ;
 * rond 30 px ; mini-barre 54 × 5 ; point de rappel 8 px.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { PublicJourney } from '@app/shared';
import { PUBLIC_JOURNEYS_PANEL_LIMIT } from '@app/shared';
import { avatarColor, initials } from '@/screens/accueil/from-api';
import { listPublicJourneys } from '@/screens/parcours/api';
import { echeance, typeCourt } from '@/screens/parcours/appels';
import { CadreActif } from './cadre-actif';
import { C, etiquette } from './ui';
import { usePathname } from 'next/navigation';
import { useParcoursComplet, useIdParcours } from './donnees';

const CARTE = { background: '#fff', border: `1px solid ${C.bord}`, borderRadius: '22px', padding: '14px' } as const;

function PanneauPublicsInterne() {
  const [items, setItems] = useState<readonly PublicJourney[]>([]);
  useEffect(() => {
    let annule = false;
    listPublicJourneys(PUBLIC_JOURNEYS_PANEL_LIMIT).then(
      (r) => {
        if (!annule) setItems(r.items);
      },
      () => undefined,
    );
    return () => {
      annule = true;
    };
  }, []);
  if (items.length === 0) return null;
  return (
    <div style={CARTE}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 6px 8px' }}>
        <div style={etiquette}>PARCOURS PUBLICS</div>
        <Link href="/parcours/publics" style={{ fontSize: '12px', fontWeight: 700 }}>
          Voir tous
        </Link>
      </div>
      {items.map((p) => {
        const nom = p.member.displayName === null || p.member.displayName.trim() === '' ? p.member.handle : p.member.displayName;
        return (
          <Link
            key={p.id}
            href={`/parcours/publics/${p.id}`}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 6px', textDecoration: 'none', color: C.texte }}
          >
            <span style={{ width: '30px', height: '30px', borderRadius: '999px', background: avatarColor(p.member.handle), color: '#fff', fontSize: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {initials(nom)}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 700 }}>{nom}</span>
              <span style={{ display: 'block', fontSize: '11px', color: C.grisClair }}>
                {typeCourt(p.template.code, p.template.nameFr)} · {p.destinationCity.name}
              </span>
            </span>
            <span style={{ width: '54px' }}>
              <div style={{ height: '5px', borderRadius: '999px', background: C.barre, overflow: 'hidden' }}>
                <div style={{ width: `${p.progressPct}%`, height: '100%', background: p.status === 'COMPLETED' ? C.vert : C.orange, borderRadius: '999px' }} />
              </div>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function PanneauRappelsInterne() {
  /**
   * SUR `/parcours/publics/:id`, L'IDENTIFIANT DE L'URL EST CELUI D'UN AUTRE MEMBRE.
   *
   * Mesuré (lot W1A, phase 0.4) : à 1 440 px la fiche d'un parcours public montait
   * ce panneau, qui lisait `GET /journeys/:id` sur le parcours d'autrui et prenait un
   * `403` (deux, avec le rejeu) dans la console. Les rappels sont ceux de MON
   * parcours : sur une fiche publique, il n'y en a aucun à montrer.
   */
  const chemin = usePathname();
  const idUrl = useIdParcours();
  const id = chemin !== null && chemin.startsWith('/parcours/publics') ? null : idUrl;
  const { etat } = useParcoursComplet(id);
  if (etat.phase !== 'pret' || etat.parcours.viewerRole !== 'OWNER') return null;
  const prochains = etat.parcours.steps
    .filter((s) => s.status !== 'DONE' && s.dueDate !== undefined && s.dueDate !== null)
    .sort((a, b) => new Date(a.dueDate as string).getTime() - new Date(b.dueDate as string).getTime())
    .slice(0, 3);
  if (prochains.length === 0) return null;
  return (
    <div style={CARTE}>
      <div style={{ padding: '0 6px 8px' }}>
        <div style={etiquette}>RAPPELS</div>
      </div>
      {prochains.map((s, i) => (
        <Link
          key={s.id}
          href={`/parcours/${etat.parcours.journey.id}/etapes/${s.id}`}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 6px', textDecoration: 'none', color: C.texte }}
        >
          <span style={{ width: '8px', height: '8px', borderRadius: '999px', background: i < 2 ? C.orange : C.jalon }} />
          <span style={{ flex: 1, fontSize: '12.5px', fontWeight: 600 }}>{s.title}</span>
          <span style={{ fontSize: '11.5px', color: C.grisClair }}>{echeance(s.dueDate as string)}</span>
        </Link>
      ))}
    </div>
  );
}

export function PanneauPublics() {
  return (
    <CadreActif compact={false}>
      <PanneauPublicsInterne />
    </CadreActif>
  );
}

export function PanneauRappels() {
  return (
    <CadreActif compact={false}>
      <PanneauRappelsInterne />
    </CadreActif>
  );
}
