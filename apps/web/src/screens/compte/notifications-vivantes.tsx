'use client';

import { useState, type ReactNode } from 'react';
import { notifyError } from '@/components/notifications';
import { ApiError, memberApi } from '@/lib/api/index';
import { oublierReglagesNotification } from '@/lib/preferences-notification';
import { z } from 'zod';
import type { CategorieNotification, K07Data } from './data';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES INTERRUPTEURS DE NOTIFICATION ENREGISTRENT                            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Les configurations des notifications ? »
 *
 * MESURÉ, deux défauts l'un sur l'autre : la matrice était SIX RANGS DESSINÉS —
 * les mêmes catégories pour tout le monde — et ses dix-huit interrupteurs étaient
 * des `<span>`. Le premier est corrigé dans la déclaration d'écran, le second
 * ici.
 *
 * ── `PUT` ENVOIE TOUT, PAS LA SEULE CASE TOUCHÉE ──────────────────────────
 *
 * `notificationPreferencesSchema` décrit un ÉTAT COMPLET : `categories` est un
 * tableau, pas un delta. On renvoie donc l'ensemble avec la case retournée. Ce
 * n'est pas un détour : c'est ce que la route attend, et envoyer un delta ferait
 * tomber les autres préférences au silence.
 *
 * ── AUCUN TOAST DE SUCCÈS ─────────────────────────────────────────────────
 *
 * Un interrupteur dit son état par son dessin : il passe au vert, le bouton
 * glisse. Annoncer « enregistré » à chaque case ferait dix-huit bandeaux pour une
 * page de réglages. L'ÉCHEC, lui, s'annonce — sinon la case reviendrait à sa
 * place sans que personne ne sache pourquoi.
 */
export function NotificationsVivantes({
  donnees,
  onRecharger,
  children,
}: {
  readonly donnees: K07Data;
  readonly onRecharger: () => void;
  readonly children: (enrichies: K07Data) => ReactNode;
}) {
  const [enVol, setEnVol] = useState(false);

  const enregistrer = (cle: string, canal: 'push' | 'email', voulu: boolean): void => {
    if (enVol) return;
    setEnVol(true);
    oublierReglagesNotification();
    memberApi
      .put('/me/notification-preferences', z.unknown(), {
        body: {
          categories: donnees.categories.map((c) => ({
            category: c.cle,
            push: c.cle === cle && canal === 'push' ? voulu : c.pushActif,
            email: c.cle === cle && canal === 'email' ? voulu : c.emailActif,
          })),
        },
      })
      .then(() => {
        onRecharger();
      })
      .catch((cause: unknown) => {
        notifyError(
          cause instanceof ApiError
            ? cause.displayMessage
            : 'Le réglage n’a pas pu être enregistré.',
        );
      })
      .finally(() => {
        setEnVol(false);
      });
  };

  const enrichies: K07Data = {
    ...donnees,
    notificationsOccupe: enVol,
    categories: donnees.categories.map(
      (c): CategorieNotification => ({
        ...c,
        /**
         * PAS DE GESTE SUR L'IN-APP : il est toujours verrouillé, l'API le dit —
         * « l'in-app n'est pas une préférence : il est toujours là, ou jamais ».
         * Le bouton est déjà éteint ; ne pas lui donner de geste rend la règle
         * vraie à deux endroits plutôt qu'à un.
         */
        onPush: () => {
          enregistrer(c.cle, 'push', !c.pushActif);
        },
        onEmail: () => {
          enregistrer(c.cle, 'email', !c.emailActif);
        },
      }),
    ),
  };

  return <>{children(enrichies)}</>;
}
