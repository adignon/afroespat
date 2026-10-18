'use client';

/**
 * AJOUT HORS MAQUETTE — « OÙ EN ÊTES-VOUS ? » ET « LA PROCÉDURE A ÉVOLUÉ ».
 *
 * Deux cartes que la maquette ne dessine pas et que la spec exige :
 *
 *   · §3.9 — après soixante jours sans activité, UNE notification « Où en êtes-vous ? »
 *     avec quatre réponses : *je continue* (rien), *j'ai mis en pause*, *j'ai fini*,
 *     *j'ai abandonné*. Aucune relance ensuite : la carte se tait dès qu'on répond ;
 *   · §2.2 — quand une nouvelle version du modèle est publiée, les parcours en cours
 *     RESTENT sur la leur et le membre en est informé, avec le résumé des changements
 *     (`changelog`). Migrer est SON geste : les étapes de même définition gardent leur
 *     état, les nouvelles arrivent « à faire », les retirées sont conservées comme
 *     étapes personnelles. La carte dit exactement cela avant de demander.
 *
 * Même langage que les cartes voisines : fond #EFF7F3, bord #E3F0EB, rayon 16 ; aucun
 * mot d'échec (« j'ai abandonné » est la réponse nommée par la spec, c'est le membre
 * qui la dit).
 */

import { useState } from 'react';
import type { JourneyFullResponse, JourneyMigrationResponse } from '@app/shared';
import { LevelInvitation } from '@/components/level-invitation';
import { answerInactivity, migrateJourney } from '@/screens/parcours/api';
import { Avis, Bouton, C } from './ui';
import { useGeste } from './donnees';

const CARTE = {
  background: C.vertPale,
  border: `1px solid ${C.vertPale2}`,
  borderRadius: '16px',
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
} as const;

export function BandeauRelance({
  parcours,
  onParcours,
}: {
  readonly parcours: JourneyFullResponse;
  readonly onParcours: (p: JourneyFullResponse) => void;
}) {
  const geste = useGeste();
  if (parcours.journey.inactivityPromptPending !== true) return null;
  const repondre = (reponse: 'CONTINUE' | 'PAUSED' | 'COMPLETED' | 'ABANDONED') => {
    void geste.executer(
      async () => {
        onParcours(await answerInactivity(parcours.journey.id, reponse));
      },
      { majPanneau: true },
    );
  };
  return (
    <section aria-label="Où en êtes-vous ?" style={CARTE}>
      <div style={{ fontSize: '15px', fontWeight: 800 }}>Où en êtes-vous ?</div>
      <div style={{ fontSize: '13px', color: C.gris, lineHeight: 1.5 }}>
        Votre parcours n’a pas bougé depuis {parcours.meta.inactivityDays} jours. Dites-nous où vous en
        êtes — nous ne vous le redemanderons pas.
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <Bouton compact disabled={geste.occupe} onClick={() => repondre('CONTINUE')}>
          Je continue
        </Bouton>
        <Bouton compact ton="calme" disabled={geste.occupe} onClick={() => repondre('PAUSED')}>
          J’ai mis en pause
        </Bouton>
        <Bouton compact ton="calme" disabled={geste.occupe} onClick={() => repondre('COMPLETED')}>
          J’ai fini
        </Bouton>
        <Bouton compact ton="calme" disabled={geste.occupe} onClick={() => repondre('ABANDONED')}>
          J’ai abandonné
        </Bouton>
      </div>
      <Avis texte={geste.erreur} ton="erreur" />
      <LevelInvitation details={geste.niveau} onClose={geste.effacer} />
    </section>
  );
}

export function BandeauVersion({
  parcours,
  onParcours,
}: {
  readonly parcours: JourneyFullResponse;
  readonly onParcours: (p: JourneyFullResponse) => void;
}) {
  const geste = useGeste();
  const [bilan, setBilan] = useState<JourneyMigrationResponse['migration'] | null>(null);
  const nouvelle = parcours.journey.newerVersion;

  if (bilan !== null) {
    return (
      <section aria-label="Parcours mis à jour" role="status" style={CARTE}>
        <div style={{ fontSize: '15px', fontWeight: 800 }}>Votre parcours est à jour</div>
        <div style={{ fontSize: '13px', color: C.gris, lineHeight: 1.5 }}>
          {bilan.kept} étape{bilan.kept > 1 ? 's' : ''} conservée{bilan.kept > 1 ? 's' : ''} avec leur état ·{' '}
          {bilan.added} nouvelle{bilan.added > 1 ? 's' : ''} à faire · {bilan.madeCustom} gardée
          {bilan.madeCustom > 1 ? 's' : ''} comme étape{bilan.madeCustom > 1 ? 's' : ''} personnelle
          {bilan.madeCustom > 1 ? 's' : ''}.
        </div>
        <div>
          <Bouton compact ton="calme" onClick={() => setBilan(null)}>
            Compris
          </Bouton>
        </div>
      </section>
    );
  }
  if (nouvelle === null || nouvelle === undefined) return null;

  const migrer = () => {
    void geste.executer(
      async () => {
        const reponse = await migrateJourney(parcours.journey.id);
        onParcours(reponse);
        setBilan(reponse.migration);
      },
      { majPanneau: true },
    );
  };
  return (
    <section aria-label="La procédure a évolué" style={CARTE}>
      <div style={{ fontSize: '15px', fontWeight: 800 }}>La procédure a évolué</div>
      <div style={{ fontSize: '13px', color: C.gris, lineHeight: 1.5 }}>
        {nouvelle.changelog ?? 'Une nouvelle version de ce parcours est disponible.'}
      </div>
      <div style={{ fontSize: '12.5px', color: C.gris, lineHeight: 1.5 }}>
        Votre parcours reste tel qu’il est tant que vous ne le mettez pas à jour. En le mettant à jour,
        les étapes qui existent encore gardent leur état, les nouvelles arrivent « à faire », et celles
        qui disparaissent sont conservées comme étapes personnelles : vous ne perdez rien.
      </div>
      <div>
        <Bouton compact disabled={geste.occupe} onClick={migrer}>
          {geste.occupe ? 'Mise à jour…' : 'Mettre mon parcours à jour'}
        </Bouton>
      </div>
      <Avis texte={geste.erreur} ton="erreur" />
      <LevelInvitation details={geste.niveau} onClose={geste.effacer} />
    </section>
  );
}
