import { createHmac } from 'node:crypto';
import type { APIRequestContext, BrowserContext } from '@playwright/test';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ MONTER UN MEMBRE EN L1 — PAR LE CHEMIN DU PRODUIT, PAS PAR LA BASE        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * POURQUOI CE FICHIER EXISTE, et ce qu'il corrige.
 *
 * `e2e/entraide-api.spec.ts` écrit, en commentaire : « Le niveau vient d'un KYC qui
 * n'existe pas en local (`KYC_PROVIDER=fake`). La suite ne peut donc PAS créer un
 * parrain par l'API seule, et c'est un écart signalé : il n'existe aucun chemin de
 * test pour `mentor.become`. »
 *
 * LA MESURE L'A DÉMENTI POUR L1. Il existe bien un chemin, et c'est celui du
 * produit — deux appels, tous deux publics :
 *
 *   1. `POST /me/kyc/session` : avec `KYC_PROVIDER=fake`, le serveur rend un
 *      `sessionId` de la forme `fake-kyc-…`. Mesuré : `201` ;
 *   2. `POST /webhooks/didit` avec un corps signé en HMAC-SHA256 par
 *      `DIDIT_WEBHOOK_SECRET` : le verdict `APPROVED` est appliqué. Mesuré :
 *      `200 {"received":true,"applied":true}`.
 *
 * AUCUNE ÉCRITURE DIRECTE EN BASE, et c'est le point : le niveau est calculé par le
 * même code qu'en production, à partir du même verdict. Un `UPDATE` sur la colonne
 * aurait produit un membre L1 que le produit n'aurait jamais fabriqué — et un test
 * vert qui ne prouve rien.
 *
 * ── LE PIÈGE QUI COÛTE UNE HEURE SI ON NE LE SAIT PAS ──────────────────────
 *
 * CHANGER DE NIVEAU INVALIDE LE JETON D'ACCÈS. Le serveur répond alors
 * `401 TOKEN_STALE`, détail « niveau de vérification modifié » — sur TOUTE route,
 * y compris celles qui marchaient la seconde d'avant. Mesuré.
 *
 * Dans le NAVIGATEUR ce n'est pas un problème : le socle d'appel rafraîchit une
 * fois et rejoue (`lib/api/member.ts`), donc la page ne voit rien. Mais un test qui
 * continue d'employer le jeton d'AVANT reçoit des `401` et accuse l'écran. D'où le
 * `POST /auth/refresh` ci-dessous, et le jeton frais rendu à l'appelant.
 *
 * Le cookie `dp_refresh` est repris du contexte d'API et réinstallé dans le
 * navigateur APRÈS le rafraîchissement : celui qui y était avait été émis pour un
 * membre L0.
 */

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1';

/**
 * Le secret de signature du webhook. Le MÊME que celui du `.env` de l'API, et il
 * n'est pas inventé : c'est la valeur de développement que `.env.example` publie,
 * expressément « pour le développement et les tests ».
 */
const SECRET = process.env['DIDIT_WEBHOOK_SECRET'] ?? 'dev-didit-webhook-secret-change-me';

/**
 * Fait passer le membre déjà connecté en L1, et rend son jeton d'accès FRAIS.
 *
 * `accessToken` est celui d'APRÈS le changement de niveau : l'ancien est mort.
 */
export async function monterEnL1(
  context: BrowserContext,
  request: APIRequestContext,
  accessTokenActuel: string,
): Promise<{ readonly accessToken: string }> {
  const auth = { authorization: `Bearer ${accessTokenActuel}` };

  const session = await request.post(`${API}/me/kyc/session`, { headers: auth, data: {} });
  if (!session.ok()) {
    throw new Error(`POST /me/kyc/session ${session.status()} : ${await session.text()}`);
  }
  const { sessionId } = (await session.json()) as { sessionId: string };

  /**
   * LE CORPS EST SIGNÉ TEL QU'IL PART, octet pour octet. Le service le dit :
   * « la signature porte sur les octets reçus, et `JSON.stringify` d'un objet déjà
   * analysé ne les reproduit pas ». On signe donc la chaîne, et on envoie la MÊME
   * chaîne — jamais un objet que Playwright ré-sérialiserait.
   */
  const corps = JSON.stringify({ sessionId, status: 'APPROVED', isAdult: true });
  const verdict = await request.post(`${API}/webhooks/didit`, {
    headers: {
      'content-type': 'application/json',
      'x-signature': createHmac('sha256', SECRET).update(corps).digest('hex'),
    },
    data: corps,
  });
  if (!verdict.ok()) {
    throw new Error(`POST /webhooks/didit ${verdict.status()} : ${await verdict.text()}`);
  }
  const applique = (await verdict.json()) as { applied: boolean; reason?: string };
  if (!applique.applied) {
    throw new Error(
      `le verdict KYC n’a pas été appliqué (${applique.reason ?? '?'}) : le membre resterait L0 ` +
        'et `post.create` répondrait 403 LEVEL_REQUIRED.',
    );
  }

  // Le jeton d'avant est mort : voir « LE PIÈGE » dans l'en-tête.
  const frais = await request.post(`${API}/auth/refresh`, { data: {} });
  if (!frais.ok()) throw new Error(`POST /auth/refresh ${frais.status()} : ${await frais.text()}`);
  const { accessToken } = (await frais.json()) as { accessToken: string };

  const cookies = await request.storageState();
  const refresh = cookies.cookies.find((c) => c.name === 'dp_refresh');
  if (refresh === undefined) throw new Error('dp_refresh absent après rafraîchissement.');
  await context.clearCookies();
  await context.addCookies([refresh]);

  return { accessToken };
}
