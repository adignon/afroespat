'use client';

/**
 * AJOUT HORS MAQUETTE — J01S « ÉTAPE EN COURS » : ÉCHÉANCE, NOTES, DOCUMENTS.
 *
 * La maquette dessine l'étape avec « MES NOTES » (un texte d'exemple et un faux bouton
 * « Ajouter une note »), « DISCUSSION DE L'ÉTAPE » (deux bulles inventées) et « ÉTAPE
 * SUIVANTE » (« Étape 8 · Assurance habitation »). Ici :
 *
 *   · les notes sont un vrai champ, enregistré par `PATCH …/steps/:stepId` (`notes`),
 *     chiffrées au repos et visibles par le propriétaire SEUL (§3.4, §8.1) ;
 *   · les documents sont la checklist de l'étape (`PUT …/checklist`) : des libellés
 *     cochables, AUCUN fichier — « Les documents restent chez vous » (§3.3) ;
 *   · l'échéance se saisit à la main (`dueDate`, qui n'est plus écrasée par le
 *     rétro-planning) ou se rend au rétro-planning ;
 *   · « Signaler une erreur dans ce modèle » (§2.4) ouvre la feuille dédiée ;
 *   · l'étape suivante est la suivante DU PARCOURS, pas une phrase écrite.
 * La discussion de l'étape renvoie à la discussion du parcours (page J01D).
 */

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { JourneyFullResponse, JourneyStep } from '@app/shared';
import { CHECKLIST_LABEL_MAX, CHECKLIST_MAX_ITEMS, JOURNEY_NOTES_MAX } from '@app/shared';
import { LevelInvitation } from '@/components/level-invitation';
import { replaceChecklist, updateStep } from '@/screens/parcours/api';
import { Avis, Bouton, C, Case, Champ, Etiquette, Icone, ICONES, ZoneTexte, carte } from './ui';
import { Chargeur, EnteteParcours, OngletsMobile } from './commun';
import { CorpsEtape, etatPastille } from './etape';
import { ouvrirFeuille } from './feuilles-store';
import { UUID, signalerMaj, useGeste } from './donnees';
import { CadreActif } from './cadre-actif';

export function EditeurChecklist({
  parcours,
  etape,
  onParcours,
}: {
  readonly parcours: JourneyFullResponse;
  readonly etape: JourneyStep;
  readonly onParcours: (p: JourneyFullResponse) => void;
}) {
  const geste = useGeste();
  const [nouveau, setNouveau] = useState('');
  const items = etape.checklist ?? [];

  const enregistrer = (suite: readonly { label: string; isChecked: boolean }[]) => {
    void geste.executer(async () => {
      onParcours(await replaceChecklist(parcours.journey.id, etape.id, { items: [...suite] }));
    });
  };
  const brut = items.map((i) => ({ label: i.label, isChecked: i.isChecked }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {items.length === 0 ? (
        <div style={{ fontSize: '13px', color: C.gris }}>Aucun document listé pour cette étape.</div>
      ) : null}
      {items.map((item, i) => (
        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0' }}>
          <Case
            cochee={item.isChecked}
            label={item.label}
            onBascule={() => enregistrer(brut.map((b, k) => (k === i ? { ...b, isChecked: !b.isChecked } : b)))}
          />
          <span style={{ flex: 1, fontSize: '14px', color: item.isChecked ? C.grisClair : C.texte, textDecoration: item.isChecked ? 'line-through' : 'none' }}>
            {item.label}
          </span>
          <button
            type="button"
            aria-label={`Retirer « ${item.label} »`}
            onClick={() => enregistrer(brut.filter((_, k) => k !== i))}
            style={{ border: 'none', background: 'none', color: C.jalon, cursor: 'pointer', display: 'flex', padding: 0 }}
          >
            <Icone d={ICONES.poubelle} taille={14} />
          </button>
        </div>
      ))}
      {items.length >= CHECKLIST_MAX_ITEMS ? null : (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginTop: '6px' }}>
          <div style={{ flex: 1 }}>
            <Champ id={`doc-${etape.id}`} etiquette="Ajouter un document" valeur={nouveau} maxLength={CHECKLIST_LABEL_MAX} onChange={setNouveau} placeholder="Ex. Passeport valide" />
          </div>
          <Bouton
            compact
            disabled={geste.occupe || nouveau.trim().length < 1}
            onClick={() => {
              enregistrer([...brut, { label: nouveau.trim(), isChecked: false }]);
              setNouveau('');
            }}
          >
            Ajouter
          </Bouton>
        </div>
      )}
      <div style={{ fontSize: '12px', color: C.gris, marginTop: '4px' }}>{parcours.meta.checklistNotice}</div>
      <Avis texte={geste.erreur} ton="erreur" />
      <LevelInvitation details={geste.niveau} onClose={geste.effacer} />
    </div>
  );
}

function Notes({
  parcours,
  etape,
  onParcours,
}: {
  readonly parcours: JourneyFullResponse;
  readonly etape: JourneyStep;
  readonly onParcours: (p: JourneyFullResponse) => void;
}) {
  const [texte, setTexte] = useState(etape.notes ?? '');
  const geste = useGeste();
  const [ok, setOk] = useState(false);
  const sale = texte !== (etape.notes ?? '');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <ZoneTexte id={`notes-${etape.id}`} etiquette="Mes notes" valeur={texte} maxLength={JOURNEY_NOTES_MAX} lignes={5} onChange={(v) => { setTexte(v); setOk(false); }} aide="Visibles par vous seul·e. Elles sont chiffrées et ne sont jamais partagées, même avec votre équipe." />
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <Bouton
          compact
          disabled={geste.occupe || !sale}
          onClick={() =>
            void geste.executer(async () => {
              onParcours(await updateStep(parcours.journey.id, etape.id, { notes: texte.trim() === '' ? null : texte.trim() }));
              setOk(true);
            })
          }
        >
          Enregistrer la note
        </Bouton>
        {ok ? <span role="status" style={{ fontSize: '12.5px', color: C.vert, fontWeight: 700 }}>Enregistré</span> : null}
      </div>
      <Avis texte={geste.erreur} ton="erreur" />
    </div>
  );
}

function Echeance({
  parcours,
  etape,
  onParcours,
}: {
  readonly parcours: JourneyFullResponse;
  readonly etape: JourneyStep;
  readonly onParcours: (p: JourneyFullResponse) => void;
}) {
  const [date, setDate] = useState(etape.dueDate?.slice(0, 10) ?? '');
  const geste = useGeste();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <Champ id={`echeance-${etape.id}`} etiquette="Échéance" type="date" valeur={date} onChange={setDate} aide={etape.dueDateManual === true ? 'Saisie à la main : le rétro-planning ne la modifie plus.' : 'Calculée à partir de votre date d’arrivée cible.'} />
      <div style={{ display: 'flex', gap: '8px' }}>
        <Bouton compact disabled={geste.occupe || date === (etape.dueDate?.slice(0, 10) ?? '') || date === ''} onClick={() => void geste.executer(async () => { onParcours(await updateStep(parcours.journey.id, etape.id, { dueDate: date })); }, { majPanneau: true })}>
          Fixer l’échéance
        </Bouton>
        {etape.dueDateManual === true ? (
          <Bouton compact ton="calme" disabled={geste.occupe} onClick={() => void geste.executer(async () => { onParcours(await updateStep(parcours.journey.id, etape.id, { dueDate: null })); setDate(''); }, { majPanneau: true })}>
            Rendre au rétro-planning
          </Bouton>
        ) : null}
      </div>
      <Avis texte={geste.erreur} ton="erreur" />
    </div>
  );
}

function VueEtapeInterne({ compact }: { readonly compact: boolean }) {
  const params = useParams<{ etape?: string }>();
  const demandee = typeof params.etape === 'string' && UUID.test(params.etape) ? params.etape : null;
  return (
    <Chargeur
      enfants={(parcours, vue) => {
        const onParcours = (p: JourneyFullResponse) => {
          vue.appliquer(p);
          signalerMaj();
        };
        const etape =
          parcours.steps.find((s) => s.id === demandee) ??
          parcours.steps.find((s) => s.id === parcours.journey.currentStepId) ??
          parcours.steps[0];
        const suivante = etape === undefined ? undefined : parcours.steps.find((s) => s.position > etape.position && s.status !== 'DONE');
        const proprietaire = parcours.viewerRole === 'OWNER';
        const corps = (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <EnteteParcours parcours={parcours} compact={compact} />
            {etape === undefined ? (
              <div style={{ ...carte(20), color: C.gris }}>Ce parcours n’a pas d’étape.</div>
            ) : (
              <>
                <article style={{ background: '#FDF6F1', border: `1.5px solid ${C.orangePale}`, borderRadius: '22px', padding: compact ? '16px' : '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ flex: 1, fontSize: '16px', fontWeight: 800 }}>Étape {etape.position} · {etape.title}</div>
                    {etatPastille(etape)}
                  </div>
                  <CorpsEtape parcours={parcours} etape={etape} onParcours={onParcours} detail />
                </article>
                {proprietaire ? (
                  <>
                    <div style={{ ...carte(18), display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <Etiquette>ÉCHÉANCE</Etiquette>
                      <Echeance parcours={parcours} etape={etape} onParcours={onParcours} />
                    </div>
                    <div style={{ ...carte(18), display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <Etiquette>MES NOTES</Etiquette>
                      <Notes key={etape.id} parcours={parcours} etape={etape} onParcours={onParcours} />
                    </div>
                    <div style={{ ...carte(18), display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <Etiquette>DOCUMENTS À RÉUNIR</Etiquette>
                      <EditeurChecklist parcours={parcours} etape={etape} onParcours={onParcours} />
                    </div>
                    <div>
                      <Bouton ton="contour" compact onClick={() => ouvrirFeuille('signaler', etape.id)}>
                        Signaler une erreur dans ce modèle
                      </Bouton>
                    </div>
                  </>
                ) : null}
                {parcours.journey.groupConversationId === null ? null : (
                  <Link href={`/parcours/${parcours.journey.id}/discussion`} style={{ ...carte(16), display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: C.texte, fontSize: '14px', fontWeight: 700 }}>
                    <Icone d={ICONES.discussion} /> Ouvrir la discussion du parcours
                  </Link>
                )}
                {suivante === undefined ? null : (
                  <Link href={`/parcours/${parcours.journey.id}/etapes/${suivante.id}`} style={{ ...carte(16), textDecoration: 'none', color: C.texte }}>
                    <Etiquette>ÉTAPE SUIVANTE</Etiquette>
                    <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '4px' }}>Étape {suivante.position} · {suivante.title}</div>
                  </Link>
                )}
              </>
            )}
          </div>
        );
        return compact ? (
          <>
            <OngletsMobile id={vue.id} actif="/etapes" />
            <div style={{ padding: '12px 16px 90px', flexGrow: 1 }}>{corps}</div>
          </>
        ) : (
          corps
        );
      }}
    />
  );
}

export function VueEtape(props: Parameters<typeof VueEtapeInterne>[0]) {
  return (
    <CadreActif compact={props.compact}>
      <VueEtapeInterne {...props} />
    </CadreActif>
  );
}
