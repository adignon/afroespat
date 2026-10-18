import { z } from 'zod';
import { memberApi } from '@/lib/api/index';
import { voidResponse } from '@/lib/api/void-response';

/**
 * Web Push côté navigateur (12 §2.4).
 *
 * « Demande de permission UNIQUEMENT après une action explicite » : rien ici ne
 * s'exécute au chargement. `activerPush()` est appelée par un clic, et c'est elle —
 * et elle seule — qui appelle `Notification.requestPermission()`.
 *
 * Le service worker est `public/sw.js`. L'abonnement navigateur (`endpoint` + clés)
 * est envoyé à `POST /me/push-subscriptions` ; la clé publique VAPID vient de
 * `GET /me/push-subscriptions`, jamais d'une variable de build : une rotation de clé
 * ne demande alors pas de reconstruire le front.
 */
const etatSchema = z.object({
  publicKey: z.string().nullable(),
  subscriptions: z.array(z.object({ id: z.string() }).passthrough()),
});
const creationSchema = z.object({ id: z.string(), created: z.boolean() });

export type EtatPush =
  | { readonly etat: 'indisponible' } // navigateur sans push, ou serveur sans clé
  | { readonly etat: 'bloque' } // permission refusée dans le navigateur
  | { readonly etat: 'inactif' } // possible, pas encore activé sur cet appareil
  | { readonly etat: 'actif' };

export function pushPrisEnCharge(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** base64url → octets, le format que `applicationServerKey` attend. */
export function cleVapid(base64url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const brut = atob((base64url + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(brut, (c) => c.charCodeAt(0));
}

async function registration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
}

export async function lireEtatPush(): Promise<EtatPush> {
  if (!pushPrisEnCharge()) return { etat: 'indisponible' };
  const serveur = await memberApi.get('/me/push-subscriptions', etatSchema);
  if (serveur.publicKey === null) return { etat: 'indisponible' };
  if (Notification.permission === 'denied') return { etat: 'bloque' };
  if (Notification.permission !== 'granted') return { etat: 'inactif' };
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  const abonnement = (await reg?.pushManager.getSubscription()) ?? null;
  return { etat: abonnement === null ? 'inactif' : 'actif' };
}

/** Rend `bloque` si le membre refuse la permission. À appeler depuis un clic. */
export async function activerPush(): Promise<EtatPush> {
  if (!pushPrisEnCharge()) return { etat: 'indisponible' };
  const serveur = await memberApi.get('/me/push-subscriptions', etatSchema);
  if (serveur.publicKey === null) return { etat: 'indisponible' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { etat: permission === 'denied' ? 'bloque' : 'inactif' };

  const reg = await registration();
  const existant = await reg.pushManager.getSubscription();
  const abonnement =
    existant ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: cleVapid(serveur.publicKey) as BufferSource,
    }));
  const json = abonnement.toJSON();
  if (json.endpoint === undefined || json.keys?.['p256dh'] === undefined || json.keys['auth'] === undefined) {
    throw new Error('Le navigateur a rendu un abonnement incomplet.');
  }
  await memberApi.post('/me/push-subscriptions', creationSchema, {
    body: {
      endpoint: json.endpoint,
      keys: { p256dh: json.keys['p256dh'], auth: json.keys['auth'] },
      userAgent: navigator.userAgent.slice(0, 400),
    },
  });
  return { etat: 'actif' };
}

/**
 * Retire l'abonnement de CET appareil, côté serveur puis côté navigateur.
 *
 * L'identifiant serveur n'est pas conservé : `POST` est idempotent sur l'`endpoint`
 * et le rend (`created: false`), ce qui évite de ranger un identifiant dans le
 * navigateur — qui pourrait diverger du serveur.
 */
export async function desactiverPush(): Promise<EtatPush> {
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  const abonnement = (await reg?.pushManager.getSubscription()) ?? null;
  if (abonnement === null) return { etat: 'inactif' };
  const json = abonnement.toJSON();
  if (json.endpoint !== undefined && json.keys?.['p256dh'] !== undefined && json.keys['auth'] !== undefined) {
    const { id } = await memberApi.post('/me/push-subscriptions', creationSchema, {
      body: { endpoint: json.endpoint, keys: { p256dh: json.keys['p256dh'], auth: json.keys['auth'] } },
    });
    await memberApi.del(`/me/push-subscriptions/${id}`, voidResponse);
  }
  await abonnement.unsubscribe();
  return { etat: 'inactif' };
}
