'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FenetreConfirmation } from '@/components/fenetre-confirmation';
import { notifyError, notifySuccess } from '@/components/notifications';
import { convertStory, deleteStory } from '@/screens/accueil/api';
import { echecDe } from '@/screens/publication/echec';

/**
 * La conversion qu'une story peut recevoir, selon son TYPE (04 §2.6) :
 *
 *   · un conseil — ou une information de sujet démarches — devient une demande
 *     d'entraide ;
 *   · une découverte devient une astuce de ville.
 *
 * Le SERVEUR tranche (`INVALID_CONVERSION_TARGET`) : l'information hors démarches
 * est refusée avec un message, ce que ce bouton relaie. Le front prévient, il
 * n'autorise pas.
 */
export function cibleDeConversion(
  type: string,
): { cible: 'HELP_REQUEST' | 'CITY_TIP'; question: string; succes: string } | null {
  if (type === 'DECOUVERTE') {
    return {
      cible: 'CITY_TIP',
      question: 'Elle devient une astuce de la ville, lisible après son expiration.',
      succes: 'Story gardée comme astuce de ville.',
    };
  }
  if (type === 'CONSEIL' || type === 'INFORMATION') {
    return {
      cible: 'HELP_REQUEST',
      question: 'Elle devient une demande d’entraide, lisible après son expiration.',
      succes: 'Story gardée comme demande d’entraide.',
    };
  }
  return null;
}

/**
 * Les gestes de l'AUTEUR sur sa story, posés sur la lecture plein écran (A13) —
 * AJOUT hors maquette : la planche ne dessine ni « Garder » ni « Supprimer ».
 * Fixés sous l'en-tête (le bas porte les votes et la zone de réponse), en pastilles du dessin des boutons voisins (rayon 999, `#16785E`).
 */
export function ActionsStoryAuteur({
  storyId,
  type,
  expiree,
  onSupprimee,
}: {
  readonly storyId: string;
  readonly type: string;
  readonly expiree: boolean;
  readonly onSupprimee: () => void;
}) {
  const [confirmation, setConfirmation] = useState<'garder' | 'supprimer' | null>(null);
  const [occupe, setOccupe] = useState(false);
  const cible = cibleDeConversion(type);

  const garder = (): void => {
    if (cible === null) return;
    setOccupe(true);
    void convertStory(storyId, cible.cible)
      .then(() => {
        notifySuccess(cible.succes);
        setConfirmation(null);
      })
      .catch((cause: unknown) => {
        setConfirmation(null);
        notifyError(echecDe(cause).message);
      })
      .finally(() => {
        setOccupe(false);
      });
  };

  const supprimer = (): void => {
    setOccupe(true);
    void deleteStory(storyId)
      .then(() => {
        notifySuccess('Story supprimée.');
        setConfirmation(null);
        onSupprimee();
      })
      .catch((cause: unknown) => {
        setConfirmation(null);
        notifyError(echecDe(cause).message);
      })
      .finally(() => {
        setOccupe(false);
      });
  };

  const pastille = { height: '34px', padding: '0 14px', borderRadius: '999px', font: 'inherit', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' } as const;

  return (
    <>
      <div
        data-actions-story-auteur=""
        style={{ position: 'fixed', left: 0, right: 0, top: '156px', padding: '0 16px', display: 'flex', justifyContent: 'center', gap: '8px', zIndex: 40, pointerEvents: 'none' }}
      >
        <span style={{ display: 'flex', gap: '8px', pointerEvents: 'auto' }}>
          {cible !== null && !expiree ? (
            <button
              type="button"
              data-garder-story=""
              onClick={() => {
                setConfirmation('garder');
              }}
              style={{ ...pastille, border: 'none', background: '#16785E', color: '#fff' }}
            >
              Garder
            </button>
          ) : null}
          <Link href="/stories/mes-stories" style={{ ...pastille, border: '1px solid #E6EBE9', background: '#fff', color: '#16211D' }}>
            Mes stories
          </Link>
          <button
            type="button"
            data-supprimer-story=""
            onClick={() => {
              setConfirmation('supprimer');
            }}
            style={{ ...pastille, border: '1px solid #E6EBE9', background: '#fff', color: '#5D6B66' }}
          >
            Supprimer
          </button>
        </span>
      </div>
      <FenetreConfirmation
        ouverte={confirmation === 'garder'}
        nom="GARDER-STORY"
        titre="Garder cette story ?"
        question={cible?.question ?? ''}
        precision="Ce n’est jamais automatique : la story reste en ligne jusqu’à son expiration."
        libelleConfirmer="Garder"
        occupe={occupe}
        onConfirmer={garder}
        onAnnuler={() => {
          setConfirmation(null);
        }}
      />
      <FenetreConfirmation
        ouverte={confirmation === 'supprimer'}
        nom="SUPPRESSION-STORY"
        titre="Supprimer cette story ?"
        question="Elle disparaîtra de votre historique et du ruban."
        precision="Ce geste est définitif : les membres qui l’avaient enregistrée verront « Contenu retiré »."
        libelleConfirmer="Supprimer"
        occupe={occupe}
        onConfirmer={supprimer}
        onAnnuler={() => {
          setConfirmation(null);
        }}
      />
    </>
  );
}
