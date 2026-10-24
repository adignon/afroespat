'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { PRO_RECOMMENDATION_COMMENT_MAX } from '@app/shared';
import { useGeste } from '@/components/entraide/geste';
import { FenetreConfirmation } from '@/components/fenetre-confirmation';
import { FenetreSignalement } from '@/components/fenetre-signalement';
import { notifyError } from '@/components/notifications';
import { memberApi } from '@/lib/api/index';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ S07 — UNE FICHE PRO : CONTACTER, RECOMMANDER, SIGNALER (10 §4.3, §4.4)       ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * « Contacter » consomme un des trois contacts du mois en gratuit (§4.4) ; le
 * serveur tient le compteur, et c'est lui qui répond `PLAN_LIMIT_REACHED` quand il
 * est épuisé — sa phrase s'affiche, le front ne recalcule rien. Le contact RÉPÉTÉ
 * avec le même professionnel dans le mois ne consomme rien de plus (§4.4).
 *
 *   `POST /pros/:id/contact` → { conversationId } → l'écran suit vers
 *   `/messages/:conversationId`.
 *
 * « Recommander » (`POST /pros/:id/recommend`) exige un contact existant (§4.3) :
 * le bouton n'apparaît que si `canRecommend` (relevé par le serveur) est vrai.
 * « Signaler » ouvre la fenêtre commune (`{ type: 'PRO' }`).
 */
export interface VivantFichePro {
  readonly occupe: boolean;
  readonly onContacter: () => void;
  readonly onSignaler: () => void;
  readonly onRecommander: () => void;
}

const RIEN = (): void => {};

export const vivantFicheProVide: VivantFichePro = {
  occupe: false,
  onContacter: RIEN,
  onSignaler: RIEN,
  onRecommander: RIEN,
};

export function useFichePro(id: string, recharger: () => void): { readonly vivant: VivantFichePro; readonly fenetres: ReactNode } {
  const router = useRouter();
  const { occupe, lancer, fenetre } = useGeste();
  const [signalement, setSignalement] = useState(false);
  const [recommande, setRecommande] = useState(false);
  const [commentaire, setCommentaire] = useState('');

  const onContacter = useCallback((): void => {
    let conversation = '';
    void lancer(
      async () => {
        const r = await memberApi.post(`/pros/${id}/contact`, z.object({ conversationId: z.string().uuid() }).passthrough());
        conversation = r.conversationId;
      },
      { recharger: false, echecRepli: 'Le contact n’a pas pu s’ouvrir.' },
    ).then((ok) => {
      if (ok) router.push(`/messages/${conversation}`);
    });
  }, [id, lancer, router]);

  const confirmerRecommandation = useCallback((): void => {
    const texte = commentaire.trim();
    if (texte !== '' && texte.length < 5) {
      notifyError('Un commentaire compte au moins 5 caractères.');
      return;
    }
    void lancer(
      () => memberApi.post(`/pros/${id}/recommend`, z.unknown(), { body: texte === '' ? {} : { comment: texte } }),
      { recharger: false, succes: 'Merci, votre recommandation est publiée.' },
    ).then((ok) => {
      if (ok) {
        setRecommande(false);
        setCommentaire('');
        recharger();
      }
    });
  }, [commentaire, id, lancer, recharger]);

  const vivant = useMemo<VivantFichePro>(
    () => ({
      occupe,
      onContacter,
      onSignaler: () => {
        setSignalement(true);
      },
      onRecommander: () => {
        setRecommande(true);
      },
    }),
    [occupe, onContacter],
  );

  const fenetres = (
    <>
      {fenetre}
      <FenetreSignalement
        sujet={signalement ? { type: 'PRO', id } : null}
        onFermer={() => {
          setSignalement(false);
        }}
      />
      <FenetreConfirmation
        ouverte={recommande}
        nom="RECOMMANDER-PRO"
        titre="Recommander ce professionnel"
        question="Votre recommandation s’affiche avec votre pseudo sur sa fiche."
        precision="Vous pouvez recommander un professionnel avec qui vous avez déjà échangé."
        champ={{ libelle: 'Commentaire (facultatif)', valeur: commentaire, onChange: setCommentaire, max: PRO_RECOMMENDATION_COMMENT_MAX }}
        libelleConfirmer="Recommander"
        occupe={occupe}
        onConfirmer={confirmerRecommandation}
        onAnnuler={() => {
          setRecommande(false);
        }}
      />
    </>
  );

  return { vivant, fenetres };
}
