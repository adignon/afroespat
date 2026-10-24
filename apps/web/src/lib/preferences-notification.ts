import {
  notificationPreferencesResponseSchema,
  type NotificationPreferencesResponse,
} from '@app/shared';
import { memberApi } from '@/lib/api/index';

/**
 * LES RÉGLAGES DE NOTIFICATION — UN SEUL APPEL PARTAGÉ.
 *
 * MESURÉ au navigateur (lot W1A, phase 0.6) : `/compte/notifications` appelait
 * `GET /me/notification-preferences` SIX fois au chargement. La page rend les
 * deux cadres (ordinateur et téléphone) ; chacun monte `ReglageHeuresCalmes` et
 * `ReglageResume`, qui lisaient chacun la route, et `chargerK07` la lisait une
 * fois de plus pour la grille. Six lectures de la MÊME réponse, qui n'a aucune
 * raison de changer entre elles.
 *
 * LE PARTAGE EST EN VOL, PAS EN MÉMOIRE LONGUE : tant qu'une lecture est en
 * route, tout appelant reçoit la même promesse. Dès qu'elle est réglée, elle est
 * OUBLIÉE — la lecture suivante repart du serveur. Un cache à durée de vie
 * ferait mentir l'écran après un enregistrement fait ailleurs (autre onglet,
 * autre appareil), ce que le serveur ne ferait pas ; le partage en vol, lui, ne
 * peut pas servir une réponse périmée de plus que la durée d'un aller-retour.
 */
let enVol: Promise<NotificationPreferencesResponse> | null = null;

export function lireReglagesNotification(): Promise<NotificationPreferencesResponse> {
  enVol ??= memberApi
    .get('/me/notification-preferences', notificationPreferencesResponseSchema)
    .finally(() => {
      enVol = null;
    });
  return enVol;
}

/** Après une écriture : la lecture en vol (s'il y en a une) date d'avant. */
export function oublierReglagesNotification(): void {
  enVol = null;
}
