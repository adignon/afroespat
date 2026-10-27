'use client';

/**
 * AJOUT HORS MAQUETTE — LE SOCLE COMMUN DES VUES DU PARCOURS.
 *
 * `Chargeur` rend les quatre états que la maquette ne dessine pas (absent, attente,
 * échec, prêt) AVEC la même sobriété que `BandeAttente` / `BandeEchec` du module
 * Compte : une carte, le gris de texte et le vert de lien des planches, aucune couleur
 * nouvelle. `EnteteMobile` et `OngletsMobile` sont l'en-tête et la rangée d'onglets de
 * la planche mobile de J01, dont les six onglets étaient des `<span>` : ce sont ici de
 * vrais liens.
 */

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { displayMessageFor } from '@/lib/api/index';
import type { JourneyFullResponse } from '@app/shared';
import { VISIBILITE, typeCourt } from '@/screens/parcours/appels';
import { useIdParcours, useParcoursComplet, type EtatParcours } from './donnees';
import { Attente, C, Pastille, carte } from './ui';

export type VueParcours = ReturnType<typeof useParcoursComplet> & { readonly id: string };

export function Chargeur({
  enfants,
  sansParcours,
}: {
  readonly enfants: (parcours: JourneyFullResponse, vue: VueParcours) => ReactNode;
  /** Ce que la vue montre quand l'URL ne désigne aucun parcours (planche d'illustration). */
  readonly sansParcours?: ReactNode;
}) {
  const id = useIdParcours();
  const vue = useParcoursComplet(id);
  return <Etats etat={vue.etat} sansParcours={sansParcours} rendu={(p) => enfants(p, { ...vue, id: id as string })} onReessayer={vue.recharger} />;
}

/**
 * ── « AUCUN PARCOURS », ET LE GESTE QUI MANQUAIT ────────────────────────────
 *
 * `/parcours` sans parcours montre le cadre J01E « ORDINATEUR · AUCUN PARCOURS » :
 * la colonne de gauche propose « Commencer », mais le centre disait seulement
 * « Ouvrez un de vos parcours pour voir cette page. Mes parcours » — un lien
 * VERS LA PAGE OÙ L'ON EST, et aucun moyen d'en créer un depuis le contenu
 * (audit de la vague 1, J01 desktopvide). Sur `/parcours` lui-même la carte dit donc
 * qu'il n'y en a pas et mène à la création, comme le « Nouveau parcours » de J11 ;
 * sur une adresse de parcours introuvable, elle garde son renvoi vers la liste ET
 * propose la création.
 */
function AucunParcours() {
  const surLaListe = usePathname() === '/parcours';
  const lien = { color: C.vertFonce, fontWeight: 700 } as const;
  return (
    <div style={{ ...carte(24), color: C.gris, fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }} data-aucun-parcours="">
      <div>
        {surLaListe
          ? 'Vous n’avez pas encore de parcours. Créez-en un pour découper votre projet en étapes.'
          : 'Ce parcours n’est pas ouvert. Ouvrez un de vos parcours pour voir cette page.'}
      </div>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <Link href="/parcours/nouveau" style={lien}>
          Créer un parcours
        </Link>
        {surLaListe ? null : (
          <Link href="/parcours" style={lien}>
            Mes parcours
          </Link>
        )}
      </div>
    </div>
  );
}

function Etats({
  etat,
  sansParcours,
  rendu,
  onReessayer,
}: {
  readonly etat: EtatParcours;
  readonly sansParcours: ReactNode;
  readonly rendu: (parcours: JourneyFullResponse) => ReactNode;
  readonly onReessayer: () => void;
}) {
  if (etat.phase === 'absent') {
    return <>{sansParcours ?? <AucunParcours />}</>;
  }
  if (etat.phase === 'attente') return <Attente texte="Chargement de votre parcours…" />;
  if (etat.phase === 'echec') {
    return (
      <div role="alert" style={{ ...carte(24), color: C.texte, fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div>{displayMessageFor(etat.erreur)}</div>
        <div>
          <button
            type="button"
            onClick={onReessayer}
            style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', fontWeight: 700, color: C.vertFonce, cursor: 'pointer' }}
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }
  return <>{rendu(etat.parcours)}</>;
}

/** Les six onglets de la rangée mobile — chacun mène à la route de sa planche. */
const ONGLETS = [
  ['Vue d’ensemble', ''],
  ['Étape en cours', '/etapes'],
  ['Discussion', '/discussion'],
  ['Équipe', '/equipe'],
  ['Checklist', '/documents'],
  ['Historique', '/historique'],
  ['Réglages', '/reglages'],
] as const;

export function OngletsMobile({ id, actif }: { readonly id: string; readonly actif: string }) {
  return (
    <div
      role="navigation"
      aria-label="Sections du parcours"
      style={{ display: 'flex', gap: '6px', padding: '10px 16px', overflowX: 'auto', flexShrink: 0, background: '#fff', borderBottom: `1px solid ${C.bord}` }}
    >
      {ONGLETS.map(([libelle, suffixe]) => {
        const sur = suffixe === actif;
        return (
          <Link
            key={libelle}
            href={`/parcours/${id}${suffixe}`}
            aria-current={sur ? 'page' : undefined}
            style={{
              flexShrink: 0,
              // 44 px : cible tactile minimale (T1 §2.3) — les pastilles de section mesuraient 36.
              height: '44px',
              padding: '0 14px',
              borderRadius: '999px',
              display: 'flex',
              alignItems: 'center',
              fontSize: '13px',
              fontWeight: 700,
              textDecoration: 'none',
              background: sur ? C.vertFonce : C.fond,
              color: sur ? '#fff' : C.texte,
            }}
          >
            {libelle}
          </Link>
        );
      })}
    </div>
  );
}

export function BarreProgression({ pourcent }: { readonly pourcent: number }) {
  return (
    <div style={{ height: '8px', borderRadius: '999px', background: C.barre, overflow: 'hidden', flex: 1 }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pourcent))}%`, height: '100%', background: C.orange, borderRadius: '999px' }} />
    </div>
  );
}

/** L'en-tête de la page parcours : type, visibilité, titre, trajet, avancement. */
export function EnteteParcours({
  parcours,
  actions,
  compact,
}: {
  readonly parcours: JourneyFullResponse;
  readonly actions?: ReactNode;
  readonly compact: boolean;
}) {
  const j = parcours.journey;
  const type = typeCourt(j.template.code, j.template.nameFr).toUpperCase();
  return (
    <div style={{ ...carte(compact ? 16 : 24), display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '1px', color: C.grisClair }}>PARCOURS {type}</span>
        <Pastille>{VISIBILITE[j.visibility] ?? j.visibility}</Pastille>
        {j.status === 'PAUSED' ? <Pastille fond={C.fond} texte={C.gris}>EN PAUSE</Pastille> : null}
        {j.status === 'COMPLETED' ? <Pastille>ABOUTI</Pastille> : null}
        {j.status === 'ABANDONED' ? <Pastille fond={C.fond} texte={C.gris}>ARRÊTÉ</Pastille> : null}
      </div>
      <h1 style={{ margin: 0, fontSize: compact ? '22px' : '28px', fontWeight: 800, letterSpacing: '-0.8px' }}>{j.title}</h1>
      <div style={{ fontSize: '13.5px', color: C.gris }}>
        {j.originCountry.nameFr} → {j.destinationCity.name}
        {j.targetArrivalDate === null
          ? ''
          : ` · départ prévu le ${new Date(j.targetArrivalDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <BarreProgression pourcent={j.progressPct} />
        <span style={{ fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap' }}>
          {j.doneCount} / {j.totalCount} étapes
        </span>
      </div>
      {actions === undefined ? null : <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>{actions}</div>}
    </div>
  );
}

/**
 * Un lien vers une page du parcours COURANT (`/parcours/:id{suffixe}`), pour les cadres
 * transcodés qui ne connaissent pas l'identifiant : J10 « Voir mon parcours ». Sans
 * identifiant (planche d'illustration), il mène à la liste.
 */
export function LienParcours({
  suffixe,
  style,
  children,
}: {
  readonly suffixe: string;
  readonly style?: React.CSSProperties;
  readonly children: ReactNode;
}) {
  const id = useIdParcours();
  return (
    <Link href={id === null ? '/parcours' : `/parcours/${id}${suffixe}`} {...(style === undefined ? {} : { style })}>
      {children}
    </Link>
  );
}
