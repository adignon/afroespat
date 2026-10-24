'use client';

import { useState } from 'react';
import { FenetreSignalement } from '@/components/fenetre-signalement';

/**
 * AJOUT hors maquette — « Signaler » SUR LA LECTURE D'UNE STORY (A13).
 *
 * Constat de la vague 1 : la visionneuse permettait de voter, d'écrire à l'auteur
 * et d'enregistrer, mais PAS de signaler une story — alors que `STORY` est un
 * sujet de signalement (13 §3, `ReportSubjectType`) et que l'auteur, lui, dispose
 * de ses gestes (`ActionsStoryAuteur`). Un lecteur qui tombe sur une story
 * abusive n'avait aucun recours depuis l'écran où il la voit.
 *
 * Même emplacement et même pastille que les gestes de l'auteur (sous l'en-tête,
 * `top: 156px`, rayon 999, trait `#E6EBE9`) : c'est l'un OU l'autre, jamais les
 * deux, puisque l'on ne signale pas sa propre story. La feuille est
 * `FenetreSignalement` — X03, celle de tout le produit.
 */
export function ActionsStoryLecteur({ storyId }: { readonly storyId: string }) {
  const [ouverte, setOuverte] = useState(false);
  return (
    <>
      <div
        data-actions-story-lecteur=""
        style={{ position: 'fixed', left: 0, right: 0, top: '156px', padding: '0 16px', display: 'flex', justifyContent: 'center', zIndex: 40, pointerEvents: 'none' }}
      >
        <button
          type="button"
          data-signaler-story=""
          onClick={() => {
            setOuverte(true);
          }}
          style={{ pointerEvents: 'auto', height: '34px', padding: '0 14px', borderRadius: '999px', border: '1px solid #E6EBE9', background: '#fff', color: '#5D6B66', font: 'inherit', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
        >
          Signaler
        </button>
      </div>
      <FenetreSignalement
        sujet={ouverte ? { type: 'STORY', id: storyId } : null}
        onFermer={() => {
          setOuverte(false);
        }}
      />
    </>
  );
}
