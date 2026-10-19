'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { MESSAGE_BODY_MAX, publicProfileResponseSchema } from '@app/shared';
import { FenetreConfirmation } from '@/components/fenetre-confirmation';
import { FenetreSignalement } from '@/components/fenetre-signalement';
import { notifyError, notifySuccess } from '@/components/notifications';
import { ApiError, memberApi } from '@/lib/api/index';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ S02 — UNE ANNONCE : CONTACTER, SIGNALER, MASQUER À UN MEMBRE (10 §2.3)      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * « Contacter » ouvrait la feuille « Présentez-vous » et « Envoyer » ne partait
 * nulle part. Il fait maintenant ce que 10 §2.3 décrit :
 *
 *   1. `POST /housing/:id/contact` ouvre (ou rouvre) la conversation directe avec
 *      l'auteur et compte le contact ;
 *   2. `POST /conversations/:id/messages` y dépose le message saisi ;
 *   3. l'écran suit vers `/messages/:id`.
 *
 * LE NIVEAU N'EST JAMAIS LU POUR DÉCIDER (mémo §5) : on tente, et c'est le
 * `403 LEVEL_REQUIRED` du serveur — avec `suggestMentorship` — qui fait apparaître
 * l'état L0 de la maquette (« Contacter demande une identité vérifiée », avec
 * « Vérifier mon identité » et « Ou demandez à un parrain de visiter pour vous »).
 * Avant ce lot, cet état était atteignable seulement par `?niveau=l0`, qui ne
 * prouve rien : il est maintenant la CONSÉQUENCE d'un refus réel.
 *
 * « Masquer à un membre » (10 §2.3, `POST /housing/:id/hide-from`) : l'auteur désigne
 * un pseudo ; l'écran en tire l'identifiant (`GET /users/:handle`) puis masque. Ce
 * n'est PAS un blocage : la messagerie et le profil de ce membre ne bougent pas.
 */
export interface VivantAnnonce {
  readonly occupe: boolean;
  /** L'état « identité à vérifier » : posé par un refus réel du serveur. */
  readonly refuseNiveau: boolean;
  readonly message: string;
  readonly onMessage: (e: { readonly target: { readonly value: string } }) => void;
  readonly messageMax: number;
  readonly echec: string;
  readonly onEnvoyer: () => void;
  readonly onSignaler: () => void;
  /** L'auteur voit « Masquer à un membre » à la place de « Contacter ». */
  readonly estMienne: boolean;
  readonly masque: string;
  readonly onMasque: (e: { readonly target: { readonly value: string } }) => void;
  readonly onMasquer: () => void;
  readonly hrefVerification: string;
  readonly hrefParrain: string;
}

const RIEN = (): void => {};

export const vivantAnnonceVide: VivantAnnonce = {
  occupe: false,
  refuseNiveau: false,
  message: '',
  onMessage: RIEN,
  messageMax: MESSAGE_BODY_MAX,
  echec: '',
  onEnvoyer: RIEN,
  onSignaler: RIEN,
  estMienne: false,
  masque: '',
  onMasque: RIEN,
  onMasquer: RIEN,
  hrefVerification: '/compte/verification',
  hrefParrain: '/parrainage',
};

export function useAnnonceLogement(
  id: string,
  annonce: { readonly prenomAuteur: string; readonly estMienne: boolean },
  options: { readonly ouvrir: (nom: 'S02C' | 'S02V') => void; readonly fermer: () => void },
): { readonly vivant: VivantAnnonce; readonly fenetres: ReactNode } {
  const router = useRouter();
  const { ouvrir, fermer } = options;
  const [saisie, setSaisie] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [refuseNiveau, setRefuseNiveau] = useState(false);
  const [echec, setEchec] = useState('');
  const [signalement, setSignalement] = useState(false);
  const [masque, setMasque] = useState('');
  const [confirmerMasque, setConfirmerMasque] = useState<{ userId: string; nom: string } | null>(null);

  const message =
    saisie ??
    `Bonjour ${annonce.prenomAuteur}, votre annonce m’intéresse. Serait-il possible de la visiter cette semaine ?`;

  const onEnvoyer = useCallback((): void => {
    const corps = message.trim();
    if (corps === '' || occupe) return;
    setOccupe(true);
    setEchec('');
    void (async () => {
      try {
        const contact = await memberApi.post(
          `/housing/${id}/contact`,
          z.object({ conversationId: z.string().uuid() }).passthrough(),
        );
        await memberApi.post(`/conversations/${contact.conversationId}/messages`, z.unknown(), {
          body: { body: corps },
        });
        fermer();
        router.push(`/messages/${contact.conversationId}`);
      } catch (cause: unknown) {
        if (cause instanceof ApiError && cause.code === 'LEVEL_REQUIRED') {
          // Le serveur a refusé : c'est lui qui dit que l'identité doit être vérifiée.
          setRefuseNiveau(true);
          ouvrir('S02V');
          return;
        }
        setEchec(cause instanceof ApiError ? cause.displayMessage : 'Le message n’a pas pu partir.');
      } finally {
        setOccupe(false);
      }
    })();
  }, [fermer, id, message, occupe, ouvrir, router]);

  const onMasquer = useCallback((): void => {
    const pseudo = masque.trim().replace(/^@/, '');
    if (pseudo === '' || occupe) return;
    setOccupe(true);
    void memberApi
      .get(`/users/${encodeURIComponent(pseudo)}`, publicProfileResponseSchema)
      .then((p) => {
        if (p.userId === null) {
          notifyError('Ce membre est introuvable.');
          return;
        }
        setConfirmerMasque({ userId: p.userId, nom: p.displayName });
      })
      .catch((cause: unknown) => {
        notifyError(cause instanceof ApiError ? cause.displayMessage : 'Ce membre est introuvable.');
      })
      .finally(() => {
        setOccupe(false);
      });
  }, [masque, occupe]);

  const confirmerMasquage = useCallback((): void => {
    if (confirmerMasque === null) return;
    setOccupe(true);
    void memberApi
      .post(`/housing/${id}/hide-from`, z.unknown(), { body: { userId: confirmerMasque.userId } })
      .then(() => {
        notifySuccess(`L’annonce est masquée pour ${confirmerMasque.nom}.`);
        setConfirmerMasque(null);
        setMasque('');
      })
      .catch((cause: unknown) => {
        notifyError(cause instanceof ApiError ? cause.displayMessage : 'L’annonce n’a pas pu être masquée.');
      })
      .finally(() => {
        setOccupe(false);
      });
  }, [confirmerMasque, id]);

  const vivant = useMemo<VivantAnnonce>(
    () => ({
      occupe,
      refuseNiveau,
      message,
      onMessage: (e) => {
        setSaisie(e.target.value);
        setEchec('');
      },
      messageMax: MESSAGE_BODY_MAX,
      echec,
      onEnvoyer,
      onSignaler: () => {
        setSignalement(true);
      },
      estMienne: annonce.estMienne,
      masque,
      onMasque: (e) => {
        setMasque(e.target.value);
      },
      onMasquer,
      hrefVerification: '/compte/verification',
      hrefParrain: '/parrainage',
    }),
    [annonce.estMienne, echec, message, masque, occupe, onEnvoyer, onMasquer, refuseNiveau],
  );

  const fenetres = (
    <>
      <FenetreSignalement
        sujet={signalement ? { type: 'HOUSING', id } : null}
        onFermer={() => {
          setSignalement(false);
        }}
      />
      <FenetreConfirmation
        ouverte={confirmerMasque !== null}
        nom="MASQUER-ANNONCE"
        titre="Masquer cette annonce"
        question={`Cette annonce n’apparaîtra plus pour ${confirmerMasque?.nom ?? 'ce membre'}.`}
        precision="Ce n’est pas un blocage : vos messages et son profil ne changent pas, et vos autres annonces restent visibles."
        libelleConfirmer="Masquer"
        occupe={occupe}
        onConfirmer={confirmerMasquage}
        onAnnuler={() => {
          setConfirmerMasque(null);
        }}
      />
    </>
  );

  return { vivant, fenetres };
}
