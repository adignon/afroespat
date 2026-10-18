import webpush from 'web-push';
import type { PushProvider } from './providers';
import { callProvider, ProviderError, type HttpOptions } from './http';

/**
 * Push réel — Web Push (VAPID), 12 §2.4.
 *
 * La bibliothèque `web-push` fait ce qui ne s'improvise pas : le chiffrement de la
 * charge (RFC 8291, `aes128gcm`) et la signature VAPID (RFC 8292). On lui demande
 * la REQUÊTE (`generateRequestDetails`) et on l'envoie nous-mêmes avec `fetch`,
 * plutôt que `sendNotification` qui passe par `https.request` : c'est ce qui donne
 * un délai borné et un adaptateur éprouvable avec un `fetch` simulé, comme les
 * autres.
 *
 * ── 404 ET 410 : L'ABONNEMENT N'EXISTE PLUS ─────────────────────────────────
 *
 * Le service push le dit explicitement (le membre a révoqué la permission, le
 * navigateur a été réinstallé). On rend `gone: true` et l'appelant SUPPRIME
 * l'abonnement tout de suite : attendre cinq échecs (§2.4) enverrait quatre
 * requêtes de plus vers une adresse dont on sait qu'elle est morte.
 *
 * ── CHARGE MINIMALE ─────────────────────────────────────────────────────────
 *
 * Titre, corps court, lien — c'est tout ce que §2.4 autorise, et c'est ce que lit
 * le service worker (`apps/web/public/sw.js`). Le corps d'un message privé n'y
 * entre jamais : `notifications.service.ts` compose le titre avant d'arriver ici.
 */
export interface WebPushConfig {
  readonly publicKey: string;
  readonly privateKey: string;
  readonly subject: string;
  /** Durée de vie côté service push, en secondes. 12 h : un push plus vieux n'a plus de sens. */
  readonly ttlSeconds?: number | undefined;
}

export class WebPushProvider implements PushProvider {
  constructor(
    private readonly config: WebPushConfig,
    private readonly http: HttpOptions = {},
  ) {}

  async send(
    subscription: { endpoint: string; p256dh: string; auth: string },
    payload: { title: string; body: string; url?: string },
  ): Promise<{ delivered: boolean; gone?: boolean }> {
    const details = webpush.generateRequestDetails(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify(payload),
      {
        vapidDetails: {
          subject: this.config.subject,
          publicKey: this.config.publicKey,
          privateKey: this.config.privateKey,
        },
        TTL: this.config.ttlSeconds ?? 43_200,
        contentEncoding: 'aes128gcm',
      },
    );

    try {
      await callProvider(
        'webpush',
        details.endpoint,
        {
          method: details.method,
          headers: details.headers,
          body: new Uint8Array(details.body),
        },
        this.http,
      );
      return { delivered: true };
    } catch (error) {
      if (error instanceof ProviderError && (error.status === 404 || error.status === 410)) {
        return { delivered: false, gone: true };
      }
      throw error;
    }
  }
}

/**
 * La clé publique VAPID que le navigateur doit recevoir, ou `null`.
 *
 * Hors production et sans clé configurée, une paire ÉPHÉMÈRE est tirée au premier
 * appel : le geste « Activer les notifications » reste éprouvable en
 * développement avec la doublure — l'abonnement est enregistré, le push fictif le
 * journalise. Elle change à chaque redémarrage, ce qui ne gêne que le
 * développement : le navigateur se réabonne au geste suivant.
 */
let ephemeral: { publicKey: string; privateKey: string } | null = null;

export function vapidPublicKeyFor(input: {
  nodeEnv: string;
  configured: string | undefined;
}): string | null {
  if (input.configured !== undefined) return input.configured;
  if (input.nodeEnv === 'production') return null;
  ephemeral ??= webpush.generateVAPIDKeys();
  return ephemeral.publicKey;
}
