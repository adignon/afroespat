'use client';

/**
 * AJOUT HORS MAQUETTE — J05 « ÉQUIPE » : INVITER PAR PSEUDO, RETIRER, ET LES RÔLES.
 *
 * La maquette dessine quatre lignes d'équipe, un « Pseudo ou contact » en `<div>` et
 * deux suggestions inventées (« Sandra M. », « Yasmine B. »). Ici : la liste réelle
 * (`members` : invités et acceptés, jamais les retirés), « Inviter » qui ouvre la
 * feuille (pseudo OU contact, rôle), « Retirer » pour le propriétaire (`DELETE
 * …/members/:userId`), le plafond de dix membres, et l'explication des rôles — mot
 * pour mot celle de la maquette.
 */

import type { JourneyFullResponse } from '@app/shared';
import { removeMember } from '@/screens/parcours/api';
import { Avis, Bouton, C, Etiquette, Pastille, carte } from './ui';
import { Chargeur, EnteteParcours, OngletsMobile } from './commun';
import { ouvrirFeuille } from './feuilles-store';
import { signalerMaj, useGeste } from './donnees';
import { LevelInvitation } from '@/components/level-invitation';

const ROLE: Record<string, string> = { OBSERVER: 'Observateur', SUPPORTER: 'Accompagnant' };

function Rond({ nom }: { readonly nom: string }) {
  return (
    <span style={{ width: '40px', height: '40px', borderRadius: '999px', background: C.vert, color: '#fff', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {nom.split(/\s+/).slice(0, 2).map((m) => m[0] ?? '').join('').toUpperCase()}
    </span>
  );
}

export function RolesEquipe() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', lineHeight: 1.5 }}>
      <div><strong>Observateur</strong> — voit la progression.</div>
      <div><strong>Accompagnant</strong> — peut échanger et recevoir vos demandes privées.</div>
      <div><strong>Parrain</strong> — accompagnant désigné par le parrainage.</div>
    </div>
  );
}

export function VueEquipe({ compact }: { readonly compact: boolean }) {
  return (
    <Chargeur
      enfants={(parcours, vue) => <Corps parcours={parcours} compact={compact} id={vue.id} appliquer={vue.appliquer} />}
    />
  );
}

function Corps({
  parcours,
  compact,
  id,
  appliquer,
}: {
  readonly parcours: JourneyFullResponse;
  readonly compact: boolean;
  readonly id: string;
  readonly appliquer: (p: JourneyFullResponse) => void;
}) {
  const geste = useGeste();
  const proprietaire = parcours.viewerRole === 'OWNER';
  const proprio = parcours.journey.owner;
  const retirer = (userId: string) => {
    void geste.executer(async () => {
      appliquer(await removeMember(parcours.journey.id, userId));
      signalerMaj();
    });
  };
  const nom = (n: string | null, h: string) => (n === null || n.trim() === '' ? `@${h}` : n);
  const corps = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <EnteteParcours parcours={parcours} compact={compact} />
      <div style={{ ...carte(compact ? 14 : 20), display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
          <div style={{ flex: 1 }}><Etiquette>ÉQUIPE · {parcours.members.length + 1} / {parcours.meta.maxMembers + 1}</Etiquette></div>
          {proprietaire ? <Bouton compact onClick={() => ouvrirFeuille('inviter')}>Inviter</Bouton> : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0' }}>
          <Rond nom={nom(proprio.displayName, proprio.handle)} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 700 }}>{nom(proprio.displayName, proprio.handle)}{proprietaire ? ' (vous)' : ''}</div>
            <div style={{ fontSize: '12px', color: C.grisClair }}>@{proprio.handle}</div>
          </div>
          <Pastille>Propriétaire</Pastille>
        </div>
        {parcours.members.map((m) => (
          <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderTop: '1px solid #F0F3F2' }}>
            <Rond nom={nom(m.user.displayName, m.user.handle)} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>{nom(m.user.displayName, m.user.handle)}</div>
              <div style={{ fontSize: '12px', color: C.grisClair }}>
                @{m.user.handle}{m.status === 'INVITED' ? ' · invitation en attente' : ''}
              </div>
            </div>
            <Pastille fond={m.role === 'SUPPORTER' ? C.vertPale2 : C.fond} texte={m.role === 'SUPPORTER' ? C.vert : C.gris}>
              {ROLE[m.role] ?? m.role}
            </Pastille>
            {proprietaire ? (
              <Bouton compact ton="calme" disabled={geste.occupe} onClick={() => retirer(m.userId)} label={`Retirer @${m.user.handle}`}>
                Retirer
              </Bouton>
            ) : null}
          </div>
        ))}
        <Avis texte={geste.erreur} ton="erreur" />
        <LevelInvitation details={geste.niveau} onClose={geste.effacer} />
      </div>
      <div style={{ ...carte(compact ? 14 : 20), display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <Etiquette>LES RÔLES</Etiquette>
        <RolesEquipe />
      </div>
    </div>
  );
  return compact ? (
    <>
      <OngletsMobile id={id} actif="/equipe" />
      <div style={{ padding: '12px 16px 90px', flexGrow: 1 }}>{corps}</div>
    </>
  ) : (
    corps
  );
}
