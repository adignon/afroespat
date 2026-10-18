'use client';

/**
 * AJOUT HORS MAQUETTE — LA COLONNE DE DROITE DES PAGES DE PARCOURS.
 *
 * Elle remplace les trois cartes dessinées sous J01 — « ÉQUIPE » (quatre initiales en
 * dur), « VISIBILITÉ » et « PARTAGER UN JALON » (« Visa étudiant franchi en 4 semaines »,
 * une phrase écrite) — par les mêmes cartes, lues sur le parcours. « Inviter » et
 * « Discussion » mènent enfin quelque part ; « Partager » ouvre la feuille sur le
 * DERNIER jalon franchi, et se tait s'il n'y en a pas (§3.6 : on ne partage pas une
 * étape qu'on n'a pas franchie).
 */

import Link from 'next/link';
import type { JourneyFullResponse } from '@app/shared';
import { VISIBILITE_TITRE } from '@/screens/parcours/appels';
import { Bouton, C, Etiquette, Icone, ICONES, Pastille, carte } from './ui';
import { CadreActif } from './cadre-actif';
import { Chargeur } from './commun';
import { ouvrirFeuille } from './feuilles-store';

const nom = (n: string | null, h: string) => (n === null || n.trim() === '' ? `@${h}` : n);
const initiales = (n: string) => n.split(/\s+/).slice(0, 2).map((m) => m[0] ?? '').join('').toUpperCase();

function Corps({ parcours }: { readonly parcours: JourneyFullResponse }) {
  const proprietaire = parcours.viewerRole === 'OWNER';
  const jalon = [...parcours.steps].reverse().find((s) => s.status === 'DONE' && s.isMajorMilestone && (s.sharePromptDismissedAt ?? null) === null);
  const rond = (texte: string) => (
    <span style={{ width: '34px', height: '34px', borderRadius: '999px', background: C.vert, color: '#fff', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{texte}</span>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={carte(18)}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
          <div style={{ flex: 1 }}><Etiquette>ÉQUIPE</Etiquette></div>
          {proprietaire ? (
            <button type="button" onClick={() => ouvrirFeuille('inviter')} style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', fontSize: '12px', fontWeight: 700, color: C.vertFonce, cursor: 'pointer' }}>Inviter</button>
          ) : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
          {rond(initiales(nom(parcours.journey.owner.displayName, parcours.journey.owner.handle)))}
          <span style={{ flex: 1, fontSize: '13px', fontWeight: 700 }}>{nom(parcours.journey.owner.displayName, parcours.journey.owner.handle)}</span>
          <Pastille>Propriétaire</Pastille>
        </div>
        {parcours.members.map((m) => (
          <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
            {rond(initiales(nom(m.user.displayName, m.user.handle)))}
            <span style={{ flex: 1, fontSize: '13px', fontWeight: 700 }}>{nom(m.user.displayName, m.user.handle)}</span>
            <Pastille fond={C.fond} texte={C.gris}>{m.status === 'INVITED' ? 'Invité·e' : m.role === 'SUPPORTER' ? 'Accompagnant' : 'Observateur'}</Pastille>
          </div>
        ))}
        {parcours.journey.groupConversationId === null ? null : (
          <Link href={`/parcours/${parcours.journey.id}/discussion`} style={{ marginTop: '14px', height: '42px', borderRadius: '12px', background: C.fond, color: C.texte, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 700, textDecoration: 'none' }}>
            <Icone d={ICONES.discussion} /> Discussion
          </Link>
        )}
      </div>
      <div style={carte(18)}>
        <Etiquette>VISIBILITÉ</Etiquette>
        <div style={{ marginTop: '8px', fontSize: '13.5px' }}>
          <strong>{VISIBILITE_TITRE[parcours.journey.visibility] ?? parcours.journey.visibility}</strong>
          <div style={{ color: C.gris, fontSize: '12.5px' }}>vous et {parcours.members.length} invité{parcours.members.length > 1 ? 's' : ''}</div>
        </div>
        {proprietaire ? (
          <Link href={`/parcours/${parcours.journey.id}/reglages`} style={{ display: 'inline-block', marginTop: '8px', fontSize: '12.5px', fontWeight: 700, color: C.vertFonce }}>Modifier la visibilité</Link>
        ) : null}
      </div>
      {proprietaire && jalon !== undefined ? (
        <div style={carte(18)}>
          <Etiquette>PARTAGER UN JALON</Etiquette>
          <div style={{ fontSize: '13.5px', fontWeight: 700, margin: '8px 0 4px' }}>{jalon.title}{jalon.durationDays === null ? '' : ` — franchi en ${String(jalon.durationDays)} j`}</div>
          <div style={{ fontSize: '12.5px', color: C.gris, marginBottom: '10px' }}>Cela encourage ceux qui préparent leur départ.</div>
          <Bouton compact ton="calme" onClick={() => ouvrirFeuille('partage', jalon.id)}>Partager</Bouton>
        </div>
      ) : null}
    </div>
  );
}

export function ColonneParcours() {
  return (
    <CadreActif compact={false}>
      <Chargeur sansParcours={<div />} enfants={(parcours) => <Corps parcours={parcours} />} />
    </CadreActif>
  );
}
