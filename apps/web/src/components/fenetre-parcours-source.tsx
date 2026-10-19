'use client';

import { useEffect, useRef, useState } from 'react';
import type { JourneyListItem } from '@app/shared';
import { hasAccessToken, resumeSession } from '@/lib/api/index';
import { EtatVide } from '@/components/etat-vide';
import { Modal } from '@/components/modal';
import { PanneauFenetre } from '@/components/panneau-fenetre';
import { listJourneys } from '@/screens/parcours/api';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « PARTIR D'UN PARCOURS » — CHOISIR LE PARCOURS SOURCE (AJOUT, lot G)       ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * `POST /journeys/:id/to-guide` (05 §2.8) pré-remplit un brouillon de guide depuis
 * un parcours TERMINÉ — une section par étape franchie. L'appel existait
 * (`draftFromJourney`) et aucun geste ne le déclenchait : la planche A05 dessine le
 * résultat (« Une section par étape de “Mes études à Lyon” a été pré-remplie »), pas
 * le choix du parcours de départ.
 *
 * Cette fenêtre le dessine, dans le châssis des autres fenêtres de choix
 * (`PanneauFenetre`, lignes de 48 px, bords `#E6EBE9`) : la liste de MES parcours
 * terminés — les seuls que le serveur accepte (`JOURNEY_NOT_COMPLETED` sinon) —, un
 * état vide qui dit pourquoi, et un état d'erreur. Le serveur décide ; la liste
 * prévient.
 */
export function FenetreParcoursSource({
  ouverte,
  occupe,
  onChoisir,
  onFermer,
}: {
  readonly ouverte: boolean;
  readonly occupe: boolean;
  readonly onChoisir: (parcours: JourneyListItem) => void;
  readonly onFermer: () => void;
}) {
  const [parcours, setParcours] = useState<readonly JourneyListItem[] | null>(null);
  const [echec, setEchec] = useState<string | null>(null);
  const reprise = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    if (!ouverte || parcours !== null) return undefined;
    let actif = true;
    void (async () => {
      try {
        if (!hasAccessToken()) {
          reprise.current ??= resumeSession();
          await reprise.current;
        }
        const liste = await listJourneys();
        if (!actif) return;
        // Seuls MES parcours terminés : le serveur refuse les autres.
        setParcours(liste.items.filter((p) => p.isOwner && p.status === 'COMPLETED'));
      } catch {
        if (actif) setEchec('Vos parcours n’ont pas pu être chargés. Réessayez dans un instant.');
      }
    })();
    return () => {
      actif = false;
    };
  }, [ouverte, parcours]);

  const corps = (feuille: boolean) => (
    <PanneauFenetre titreId="parcours-source-titre" titre="Partir d’un parcours" feuille={feuille}>
      <div style={{ padding: feuille ? '12px 18px 20px' : '12px 24px 24px', display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
        <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.5, color: '#5D6B66' }}>
          Le guide est pré-rempli avec une section par étape franchie. Rien n’est publié : vous relisez et vous
          complétez avant.
        </p>
        {echec !== null ? <EtatVide texte={echec} /> : null}
        {echec === null && parcours === null ? <EtatVide texte="Chargement de vos parcours…" /> : null}
        {parcours !== null && parcours.length === 0 ? (
          <EtatVide texte="Aucun parcours terminé pour l’instant. Un guide se tire d’un parcours dont toutes les étapes sont franchies." />
        ) : null}
        {(parcours ?? []).map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={occupe}
            data-choix-parcours={p.id}
            onClick={() => {
              onChoisir(p);
            }}
            style={{
              minHeight: '48px',
              padding: '8px 16px',
              borderRadius: '14px',
              border: '1px solid #E6EBE9',
              background: '#fff',
              font: 'inherit',
              textAlign: 'left',
              cursor: occupe ? 'default' : 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#16211D' }}>{p.title}</span>
            <span style={{ fontSize: '12px', color: '#8A958F' }}>
              {p.template.nameFr} · {p.destinationCity.name} · {String(p.doneCount)} étape
              {p.doneCount > 1 ? 's' : ''}
            </span>
          </button>
        ))}
      </div>
    </PanneauFenetre>
  );

  return (
    <Modal
      open={ouverte}
      onClose={onFermer}
      titleId="parcours-source-titre"
      name="PARCOURS-SOURCE"
      desktop={corps(false)}
      mobile={corps(true)}
    />
  );
}
