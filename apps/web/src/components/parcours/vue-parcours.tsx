'use client';

/**
 * AJOUT HORS MAQUETTE — J01, LA PAGE D'UN PARCOURS : FRISE, GESTES, ÉDITION.
 *
 * La maquette dessine la frise en image : « 3 étapes franchies » repliées, UNE étape en
 * cours dépliée, trois lignes grises « Étape 8 · Assurance habitation… » écrites en dur.
 * Cette vue lit les étapes du parcours (`GET /journeys/:id`) et les rend dans le même
 * ordre : franchies repliées derrière « N étapes franchies », l'étape en cours dépliée
 * (carte terre cuite), les suivantes dépliables.
 *
 * « Modifier les étapes » (mobile : la planche « édition ») ouvre l'ÉDITION : renommer,
 * réordonner, ajouter une étape personnelle, retirer. Le glisser-déposer de la maquette
 * est remplacé par des flèches haut/bas — la même opération
 * (`PUT /journeys/:id/steps/order`), accessible au clavier. Écart remonté.
 *
 * Les deux cartes « Où en êtes-vous ? » et « La procédure a évolué » (`bandeaux.tsx`)
 * s'affichent AU-DESSUS de la frise quand elles ont lieu d'être.
 */

import { useState } from 'react';
import type { JourneyFullResponse, JourneyStep } from '@app/shared';
import { JOURNEY_STEP_TITLE_MAX } from '@app/shared';
import { LevelInvitation } from '@/components/level-invitation';
import { addStep, deleteStep, reorderSteps, updateStep } from '@/screens/parcours/api';
import { Avis, Bouton, C, Champ, Icone, ICONES, carte } from './ui';
import { BandeauRelance, BandeauVersion } from './bandeaux';
import { Chargeur, EnteteParcours, OngletsMobile, type VueParcours as Vue } from './commun';
import { CorpsEtape, dateCourte, etatPastille } from './etape';
import { ouvrirFeuille } from './feuilles-store';
import { signalerMaj, useGeste } from './donnees';
import { CadreActif } from './cadre-actif';

function LigneEdition({
  parcours,
  etape,
  rang,
  total,
  onParcours,
}: {
  readonly parcours: JourneyFullResponse;
  readonly etape: JourneyStep;
  readonly rang: number;
  readonly total: number;
  readonly onParcours: (p: JourneyFullResponse) => void;
}) {
  const geste = useGeste();
  const [titre, setTitre] = useState(etape.title);
  const [confirme, setConfirme] = useState(false);
  const ids = parcours.steps.map((s) => s.id);

  const deplacer = (delta: -1 | 1) => {
    const copie = [...ids];
    const cible = rang + delta;
    const a = copie[rang];
    const b = copie[cible];
    if (a === undefined || b === undefined) return;
    copie[rang] = b;
    copie[cible] = a;
    void geste.executer(async () => {
      onParcours(await reorderSteps(parcours.journey.id, { stepIds: copie }));
    }, { majPanneau: true });
  };
  const renommer = () => {
    const propre = titre.trim();
    if (propre === etape.title || propre.length < 2) return;
    void geste.executer(async () => {
      onParcours(await updateStep(parcours.journey.id, etape.id, { title: propre }));
    }, { majPanneau: true });
  };
  const retirer = () => {
    void geste.executer(async () => {
      onParcours(await deleteStep(parcours.journey.id, etape.id));
    }, { majPanneau: true });
  };

  const rond = { width: '34px', height: '34px', borderRadius: '999px', background: C.fond, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: C.texte, padding: 0, flexShrink: 0 } as const;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 0', borderTop: rang === 0 ? 'none' : `1px solid #F0F3F2` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button type="button" aria-label={`Monter « ${etape.title} »`} disabled={rang === 0 || geste.occupe} onClick={() => deplacer(-1)} style={{ ...rond, opacity: rang === 0 ? 0.4 : 1 }}>
          <Icone d={ICONES.haut} taille={15} />
        </button>
        <button type="button" aria-label={`Descendre « ${etape.title} »`} disabled={rang === total - 1 || geste.occupe} onClick={() => deplacer(1)} style={{ ...rond, opacity: rang === total - 1 ? 0.4 : 1 }}>
          <Icone d={ICONES.bas} taille={15} />
        </button>
        <input
          aria-label={`Nom de l’étape ${String(rang + 1)}`}
          value={titre}
          maxLength={JOURNEY_STEP_TITLE_MAX}
          onChange={(e) => setTitre(e.target.value)}
          onBlur={renommer}
          onKeyDown={(e) => {
            if (e.key === 'Enter') renommer();
          }}
          style={{ flex: 1, minWidth: 0, height: '40px', borderRadius: '12px', border: `1px solid ${C.bord}`, padding: '0 12px', font: 'inherit', fontSize: '14px', fontWeight: 600 }}
        />
        {confirme ? (
          <>
            <Bouton compact ton="calme" onClick={() => setConfirme(false)}>
              Garder
            </Bouton>
            <Bouton compact ton="fort" disabled={geste.occupe} onClick={retirer}>
              Retirer
            </Bouton>
          </>
        ) : (
          <button type="button" aria-label={`Retirer « ${etape.title} »`} onClick={() => setConfirme(true)} style={rond}>
            <Icone d={ICONES.poubelle} taille={15} />
          </button>
        )}
      </div>
      <Avis texte={geste.erreur} ton="erreur" />
      <LevelInvitation details={geste.niveau} onClose={geste.effacer} />
    </div>
  );
}

function Edition({
  parcours,
  onParcours,
  onTerminer,
}: {
  readonly parcours: JourneyFullResponse;
  readonly onParcours: (p: JourneyFullResponse) => void;
  readonly onTerminer: () => void;
}) {
  const geste = useGeste();
  const [titre, setTitre] = useState('');
  const [date, setDate] = useState('');
  const ajouter = () => {
    if (titre.trim().length < 2) return;
    void geste.executer(async () => {
      onParcours(await addStep(parcours.journey.id, { title: titre.trim(), ...(date === '' ? {} : { dueDate: date }) }));
      setTitre('');
      setDate('');
    }, { majPanneau: true });
  };
  return (
    <section aria-label="Modifier les étapes" style={{ ...carte(16), display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: 1, fontSize: '15px', fontWeight: 800 }}>Modifier les étapes</div>
        <Bouton compact onClick={onTerminer}>
          Terminer
        </Bouton>
      </div>
      <div style={{ fontSize: '12.5px', color: C.gris }}>
        Renommez, réordonnez ou retirez : seules vos étapes de parcours changent, le modèle reste le même.
      </div>
      <div>
        {parcours.steps.map((etape, rang) => (
          <LigneEdition key={etape.id} parcours={parcours} etape={etape} rang={rang} total={parcours.steps.length} onParcours={onParcours} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: `1px solid ${C.bord}`, paddingTop: '12px' }}>
        <Champ id="ajout-titre" etiquette="Ajouter une étape personnelle" valeur={titre} maxLength={JOURNEY_STEP_TITLE_MAX} onChange={setTitre} placeholder="Ex. Prendre rendez-vous au consulat" />
        <Champ id="ajout-date" etiquette="Échéance (facultatif)" type="date" valeur={date} onChange={setDate} />
        <div>
          <Bouton compact disabled={geste.occupe || titre.trim().length < 2} onClick={ajouter}>
            <Icone d={ICONES.plus} taille={15} couleur="#fff" />
            Ajouter
          </Bouton>
        </div>
      </div>
      <Avis texte={geste.erreur} ton="erreur" />
      <LevelInvitation details={geste.niveau} onClose={geste.effacer} />
    </section>
  );
}

function Frise({
  parcours,
  onParcours,
  compact,
}: {
  readonly parcours: JourneyFullResponse;
  readonly onParcours: (p: JourneyFullResponse) => void;
  readonly compact: boolean;
}) {
  const [franchiesOuvertes, setFranchiesOuvertes] = useState(false);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const etapes = parcours.steps;
  const franchies = etapes.filter((e) => e.status === 'DONE');
  const courante =
    etapes.find((e) => e.id === parcours.journey.currentStepId) ?? etapes.find((e) => e.status !== 'DONE');
  const suivantes = etapes.filter((e) => e.status !== 'DONE' && e.id !== courante?.id);

  if (etapes.length === 0) {
    return (
      <div style={{ ...carte(20), color: C.gris, fontSize: '14px' }}>
        Ce parcours n’a pas encore d’étape. Utilisez « Modifier les étapes » pour en ajouter une.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {franchies.length === 0 ? null : (
        <div style={carte(compact ? 14 : 18)}>
          <button
            type="button"
            aria-expanded={franchiesOuvertes}
            onClick={() => setFranchiesOuvertes((v) => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer', textAlign: 'left' }}
          >
            <span style={{ width: '24px', height: '24px', borderRadius: '999px', background: C.vert, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icone d={ICONES.coche} taille={13} couleur="#fff" />
            </span>
            <span style={{ flex: 1, fontSize: '14px', fontWeight: 700 }}>
              {franchies.length} étape{franchies.length > 1 ? 's' : ''} franchie{franchies.length > 1 ? 's' : ''}
            </span>
            <Icone d={franchiesOuvertes ? ICONES.haut : ICONES.bas} taille={16} />
          </button>
          {franchiesOuvertes ? (
            <div style={{ marginTop: '8px' }}>
              {franchies.map((e) => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0' }}>
                  <span style={{ width: '20px', height: '20px', borderRadius: '999px', background: C.vert, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icone d={ICONES.coche} taille={11} couleur="#fff" />
                  </span>
                  <span style={{ flex: 1, fontSize: '13.5px', fontWeight: 600 }}>{e.title}</span>
                  {e.durationDays === null ? null : (
                    <span style={{ fontSize: '12px', color: C.grisClair }}>
                      {e.durationDays === 0 ? 'le jour même' : `${String(e.durationDays)} j`}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => ouvrirFeuille('partage', e.id)}
                    hidden={!e.isMajorMilestone || e.sharePromptDismissedAt !== null}
                    style={{ background: 'none', border: 'none', font: 'inherit', fontSize: '12px', fontWeight: 700, color: C.vertFonce, cursor: 'pointer' }}
                  >
                    Partager
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {courante === undefined ? null : (
        <article
          aria-label={`Étape ${String(courante.position)} : ${courante.title}`}
          style={{ background: '#FDF6F1', border: `1.5px solid ${C.orangePale}`, borderRadius: '22px', padding: compact ? '16px' : '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ flex: 1, fontSize: '16px', fontWeight: 800 }}>
              Étape {courante.position} · {courante.title}
            </div>
            {etatPastille(courante)}
          </div>
          <CorpsEtape parcours={parcours} etape={courante} onParcours={onParcours} />
        </article>
      )}

      {suivantes.length === 0 ? null : (
        <div style={{ ...carte(compact ? 8 : 10), padding: compact ? '4px 14px' : '6px 18px' }}>
          {suivantes.map((e, i) => {
            const sur = ouverte === e.id;
            return (
              <div key={e.id} style={{ borderTop: i === 0 ? 'none' : '1px solid #F0F3F2', padding: '10px 0' }}>
                <button
                  type="button"
                  aria-expanded={sur}
                  onClick={() => setOuverte(sur ? null : e.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer', textAlign: 'left', color: C.texte }}
                >
                  <span style={{ width: '14px', height: '14px', borderRadius: '999px', background: e.status === 'PAUSED' ? C.grisClair : C.jalon, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: '13.5px', fontWeight: 600, color: C.gris }}>
                    Étape {e.position} · {e.title}
                  </span>
                  {e.status === 'PAUSED' ? etatPastille(e) : null}
                  {e.dueDate === undefined || e.dueDate === null ? null : (
                    <span style={{ fontSize: '12px', color: C.grisClair }}>{dateCourte(e.dueDate)}</span>
                  )}
                </button>
                {sur ? (
                  <div style={{ marginTop: '10px', paddingLeft: '26px' }}>
                    <CorpsEtape parcours={parcours} etape={e} onParcours={onParcours} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Corps({
  parcours,
  vue,
  compact,
  edition,
}: {
  readonly parcours: JourneyFullResponse;
  readonly vue: Vue;
  readonly compact: boolean;
  readonly edition: boolean;
}) {
  const [modif, setModif] = useState(edition);
  const proprietaire = parcours.viewerRole === 'OWNER';
  const onParcours = (p: JourneyFullResponse) => {
    vue.appliquer(p);
    signalerMaj();
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <EnteteParcours
        compact={compact}
        parcours={parcours}
        actions={
          proprietaire ? (
            <>
              <Bouton compact ton="calme" onClick={() => setModif((v) => !v)}>
                <Icone d={ICONES.crayon} taille={15} />
                Modifier les étapes
              </Bouton>
              <Bouton compact ton="calme" onClick={() => ouvrirFeuille('inviter')}>
                <Icone d={ICONES.equipe} taille={15} />
                Inviter
              </Bouton>
            </>
          ) : undefined
        }
      />
      {proprietaire ? <BandeauRelance parcours={parcours} onParcours={onParcours} /> : null}
      {proprietaire ? <BandeauVersion parcours={parcours} onParcours={onParcours} /> : null}
      {modif && proprietaire ? (
        <Edition parcours={parcours} onParcours={onParcours} onTerminer={() => setModif(false)} />
      ) : (
        <Frise parcours={parcours} onParcours={onParcours} compact={compact} />
      )}
    </div>
  );
}

function VueParcoursInterne({
  compact,
  edition = false,
}: {
  readonly compact: boolean;
  readonly edition?: boolean;
}) {
  return (
    <Chargeur
      enfants={(parcours, vue) =>
        compact ? (
          <>
            <OngletsMobile id={vue.id} actif="" />
            <div style={{ padding: '12px 16px 90px', flexGrow: 1 }}>
              <Corps parcours={parcours} vue={vue} compact edition={edition} />
            </div>
          </>
        ) : (
          <Corps parcours={parcours} vue={vue} compact={false} edition={edition} />
        )
      }
    />
  );
}

export function VueParcours(props: Parameters<typeof VueParcoursInterne>[0]) {
  return (
    <CadreActif compact={props.compact}>
      <VueParcoursInterne {...props} />
    </CadreActif>
  );
}
