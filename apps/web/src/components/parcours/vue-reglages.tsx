'use client';

/**
 * AJOUT HORS MAQUETTE — J08 « RÉGLAGES » : TITRE, DATE, VISIBILITÉ, PAUSE, ARRÊT, MIGRATION.
 *
 * Les champs de la maquette (« Nom », date cible, trois choix de visibilité) étaient
 * dessinés, et « Mettre à jour », « Mettre en pause », « Arrêter » n'avaient aucun
 * geste. Tout passe par `PATCH /journeys/:id` ; le passage en PUBLIC enregistre le
 * consentement `JOURNEY_VISIBILITY` (§3.7) côté serveur, avec l'IP.
 *
 * L'explication de chaque visibilité est celle de la maquette, au mot près.
 * « Arrêter » ouvre la feuille de confirmation (§3.9, sans vocabulaire d'échec) ;
 * « Reprendre » passe par le même PATCH et est refusé par le serveur si le plan
 * gratuit a déjà un parcours actif (`PLAN_LIMIT_REACHED`).
 */

import { useState } from 'react';
import { JOURNEY_TITLE_MAX, JOURNEY_TITLE_MIN, type JourneyFullResponse } from '@app/shared';
import { LevelInvitation } from '@/components/level-invitation';
import { updateJourney } from '@/screens/parcours/api';
import { ApiError } from '@/lib/api/index';
import { Avis, Bouton, C, Champ, Etiquette, carte } from './ui';
import { BandeauVersion } from './bandeaux';
import { Chargeur, EnteteParcours, OngletsMobile } from './commun';
import { ouvrirFeuille } from './feuilles-store';
import { signalerMaj, useGeste } from './donnees';
import { CadreActif } from './cadre-actif';

const VISIBILITES = [
  ['PRIVATE', 'Privé', 'Vous seul·e et les personnes que vous invitez voient votre parcours.'],
  ['SHARED', 'Partagé', 'Vos invités voient l’avancement. Personne d’autre.'],
  ['PUBLIC', 'Public', 'Ils verront vos étapes franchies et leur durée. Jamais vos notes, vos documents, votre équipe ni votre discussion.'],
] as const;

function Formulaire({
  parcours,
  onParcours,
}: {
  readonly parcours: JourneyFullResponse;
  readonly onParcours: (p: JourneyFullResponse) => void;
}) {
  const j = parcours.journey;
  const [titre, setTitre] = useState(j.title);
  const [date, setDate] = useState(j.targetArrivalDate?.slice(0, 10) ?? '');
  const [visibilite, setVisibilite] = useState(j.visibility);
  const [ok, setOk] = useState(false);
  const geste = useGeste();

  const titreValide = titre.trim().length >= JOURNEY_TITLE_MIN && titre.trim().length <= JOURNEY_TITLE_MAX;
  const change =
    titre.trim() !== j.title || date !== (j.targetArrivalDate?.slice(0, 10) ?? '') || visibilite !== j.visibility;

  const enregistrer = () => {
    void geste.executer(
      async () => {
        const reponse = await updateJourney(j.id, {
          ...(titre.trim() !== j.title ? { title: titre.trim() } : {}),
          ...(date !== (j.targetArrivalDate?.slice(0, 10) ?? '') ? { targetArrivalDate: date === '' ? null : date } : {}),
          ...(visibilite !== j.visibility ? { visibility: visibilite } : {}),
        });
        onParcours(reponse);
        setOk(true);
      },
      { majPanneau: true },
    );
  };

  const statut = (status: 'ACTIVE' | 'PAUSED') => {
    void geste.executer(
      async () => {
        try {
          onParcours(await updateJourney(j.id, { status }));
        } catch (cause) {
          if (cause instanceof ApiError && cause.code === 'PLAN_LIMIT_REACHED') {
            geste.signaler('Vous avez déjà un parcours actif : terminez-le ou arrêtez-le avant de reprendre celui-ci.');
            return;
          }
          throw cause;
        }
      },
      { majPanneau: true },
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ ...carte(20), display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <Etiquette>LE PARCOURS</Etiquette>
        <Champ id="reglage-titre" etiquette="Nom du parcours" valeur={titre} maxLength={JOURNEY_TITLE_MAX} onChange={(v) => { setTitre(v); setOk(false); }} />
        <Champ id="reglage-date" etiquette="Date d’arrivée cible" type="date" valeur={date} onChange={(v) => { setDate(v); setOk(false); }} aide="Modifier la date recalcule les échéances des étapes — sauf celles que vous avez fixées à la main." />
        <fieldset style={{ border: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <legend style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '6px', padding: 0 }}>Qui peut le voir ?</legend>
          {VISIBILITES.map(([valeur, libelle, aide]) => (
            <label key={valeur} style={{ display: 'flex', gap: '10px', padding: '12px 14px', borderRadius: '14px', border: visibilite === valeur ? `2px solid ${C.vert}` : `1px solid ${C.bord}`, background: visibilite === valeur ? C.vertPale : '#fff', cursor: 'pointer' }}>
              <input type="radio" name="visibilite" checked={visibilite === valeur} onChange={() => { setVisibilite(valeur); setOk(false); }} style={{ accentColor: C.vert, marginTop: '3px' }} />
              <span>
                <span style={{ display: 'block', fontSize: '14px', fontWeight: 700 }}>{libelle}</span>
                <span style={{ display: 'block', fontSize: '12.5px', color: C.gris, lineHeight: 1.45 }}>{aide}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <Avis texte={geste.erreur} ton="erreur" />
        {ok ? <Avis texte="Réglages enregistrés." /> : null}
        <LevelInvitation details={geste.niveau} onClose={geste.effacer} />
        <div><Bouton disabled={geste.occupe || !change || !titreValide} onClick={enregistrer}>Mettre à jour</Bouton></div>
      </div>

      <div style={{ ...carte(20), display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Etiquette>ÉTAT DU PARCOURS</Etiquette>
        <div style={{ fontSize: '13.5px', color: C.gris, lineHeight: 1.5 }}>
          {j.status === 'ACTIVE' ? 'Votre parcours est actif.' : j.status === 'PAUSED' ? 'Votre parcours est en pause.' : j.status === 'COMPLETED' ? 'Votre parcours est abouti.' : 'Votre parcours est arrêté.'}{' '}
          Version du modèle : {j.templateVersion}.
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {j.status === 'ACTIVE' ? <Bouton compact ton="calme" disabled={geste.occupe} onClick={() => statut('PAUSED')}>Mettre en pause</Bouton> : null}
          {j.status === 'PAUSED' || j.status === 'ABANDONED' || j.status === 'COMPLETED' ? (
            <Bouton compact disabled={geste.occupe} onClick={() => statut('ACTIVE')}>{j.status === 'PAUSED' ? 'Reprendre' : 'Rouvrir le parcours'}</Bouton>
          ) : null}
          {j.status === 'ACTIVE' || j.status === 'PAUSED' ? (
            <Bouton compact ton="contour" onClick={() => ouvrirFeuille('arreter')}>Arrêter ce parcours</Bouton>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function VueReglagesInterne({ compact }: { readonly compact: boolean }) {
  return (
    <Chargeur
      enfants={(parcours, vue) => {
        const onParcours = (p: JourneyFullResponse) => {
          vue.appliquer(p);
          signalerMaj();
        };
        const corps = (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <EnteteParcours parcours={parcours} compact={compact} />
            {parcours.viewerRole !== 'OWNER' ? (
              <div style={{ ...carte(20), color: C.gris, fontSize: '14px' }}>Seul le propriétaire règle ce parcours.</div>
            ) : (
              <>
                <BandeauVersion parcours={parcours} onParcours={onParcours} />
                <Formulaire parcours={parcours} onParcours={onParcours} />
              </>
            )}
          </div>
        );
        return compact ? (
          <>
            <OngletsMobile id={vue.id} actif="/reglages" />
            <div style={{ padding: '12px 16px 90px', flexGrow: 1 }}>{corps}</div>
          </>
        ) : (
          corps
        );
      }}
    />
  );
}

export function VueReglages(props: Parameters<typeof VueReglagesInterne>[0]) {
  return (
    <CadreActif compact={props.compact}>
      <VueReglagesInterne {...props} />
    </CadreActif>
  );
}
