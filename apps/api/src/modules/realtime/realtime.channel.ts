/**
 * Le canal Redis du temps réel, et le vocabulaire qui y circule.
 *
 * DANS SON PROPRE FICHIER pour une raison mécanique : le PUBLICATEUR
 * (`RealtimeRelayService`, qui tourne dans le worker) et l'ABONNÉ
 * (`RealtimeGateway`, qui tourne dans l'API) ont tous deux besoin de ces deux
 * déclarations. Les poser dans l'un des deux ferait importer la passerelle par le
 * relais — donc chargerait `@nestjs/websockets` dans le worker, où il n'a rien à
 * faire, et où sa seule présence empêche `createApplicationContext` de démarrer.
 */

import { REALTIME_EVENTS, type RealtimeEventName } from '@app/shared';

/** Le canal. Préfixé comme les clés du verrou planifié, pour la même raison. */
export const REALTIME_CHANNEL = 'afroespat:realtime';

/**
 * Ce que la passerelle accepte de pousser. FERMÉ, et aligné sur 08 §7.3
 * (`message.new`, `message.read`, `conversation.updated`) et T4 §7, qui ajoute
 * `notification.new`. `conversation.typing` est l'indicateur de frappe, éphémère
 * et jamais stocké. La liste vient de `@app/shared` (`REALTIME_EVENTS`) : le
 * client du navigateur la lit aussi, et deux copies divergeraient en silence. Un
 * type ouvert laisserait pousser n'importe quoi à un navigateur — y compris, un
 * jour, un contenu que le destinataire n'a pas le droit de voir.
 */
export type RealtimeEvent = RealtimeEventName;

/** Le message transporté sur le canal. */
export interface RelayMessage {
  readonly userId: string;
  readonly event: RealtimeEvent;
  readonly payload: Record<string, unknown>;
}

/** Le salon d'un membre. Un seul par membre, quel que soit le nombre d'onglets. */
export function userRoom(userId: string): string {
  return `u:${userId}`;
}

/** Relit un message du canal. `null` si illisible — jamais une exception. */
export function parseRelayMessage(raw: string): RelayMessage | null {
  try {
    const value = JSON.parse(raw) as Partial<RelayMessage>;
    if (typeof value.userId !== 'string' || typeof value.event !== 'string') return null;
    // Le type est FERMÉ aussi à l'exécution : un producteur d'une autre version
    // pourrait publier un nom que cette passerelle ne connaît pas, et le pousser
    // tel quel à un navigateur serait pousser n'importe quoi.
    if (!(REALTIME_EVENTS as readonly string[]).includes(value.event)) return null;
    return { userId: value.userId, event: value.event, payload: value.payload ?? {} };
  } catch {
    return null;
  }
}
