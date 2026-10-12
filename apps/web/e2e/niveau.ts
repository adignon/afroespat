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

/** Le code de développement, celui de `SMS_FAKE_FIXED_CODE`. Jamais inventé. */
const CODE_OTP = process.env['SMS_FAKE_FIXED_CODE'] ?? '123456';

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

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ MONTER UN MEMBRE EN L2 — ET POURQUOI CETTE FONCTION N'EXISTAIT PAS ENCORE  ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * `AMORCAGE-AGENT.md` §4 l'écrit noir sur blanc : « `apps/web/e2e/niveau.ts` porte
 * `monterEnL1`. **Il n'y a pas encore de `monterEnL2`** — si ton lot en a besoin,
 * c'est l'occasion de l'écrire une fois pour toutes. » MESURÉ : les mêmes
 * quarante lignes sont déjà recopiées dans `accueil-guides-branchement.spec.ts`,
 * et chaque lot qui a eu besoin de N2 les a repayées. Les voici une fois.
 *
 * ── CE QUE N2 EXIGE, ET POURQUOI ON NE PEUT PAS L'ÉCRIRE EN BASE ───────────
 *
 * Le niveau est DÉRIVÉ, jamais déclaré : `VerificationLevelService.levelFor()` le
 * recalcule depuis deux faits, et `auth.guard` relance le calcul dès qu'un jeton
 * est périmé. Un `UPDATE users SET verification_level = 'L2'` ne tient donc pas —
 * il produirait un membre que le produit n'a jamais fabriqué, et un test vert qui
 * ne prouve rien.
 *
 * Les deux faits (§7.2) :
 *
 *   1. KYC approuvé et majeur — c'est `monterEnL1`, réemployée telle quelle ;
 *   2. un numéro vérifié d'un pays de DESTINATION actif. **La France**, et
 *      SURTOUT PAS le Bénin : le Bénin est un pays d'ORIGINE, et
 *      `PhonesService.start` refuse en `PHONE_NOT_DESTINATION` — c'est le piège
 *      qui coûte un quart d'heure si on ne le sait pas, parce que le numéro
 *      d'inscription du décor EST béninois et qu'on croit naturellement pouvoir
 *      le réemployer.
 *
 * Le numéro est TIRÉ AU HASARD à chaque appel : `phone_numbers.phone_hmac` est
 * unique, et un numéro figé ferait échouer le second test de la journée en
 * `PHONE_ALREADY_USED` (il appartiendrait déjà au membre du test précédent).
 *
 * ── LE BUDGET OTP, QUI EST LA RESSOURCE LA PLUS RARE DU DÉPÔT ─────────────
 *
 * ⚠ CE PARAGRAPHE DISAIT L'INVERSE DE LA VÉRITÉ, et le conseil qu'il donnait était
 * exactement celui qui épuise le quota. Il affirmait : « la limite de 10 demandes
 * par heure et par IP […] montez-en UN et réutilisez-le. »
 *
 * MESURÉ DANS LE CODE (`AuthService.assertWithinRateLimits` + `RATE_LIMITS`), et
 * `AMORCAGE-AGENT.md` §4 porte la correction :
 *
 *   · `otpPerIpPerHour` = 10 — NE MORD PAS en local : `isExemptLocalIp` exempte
 *     `127.0.0.1` et `::1` hors production ;
 *   · `otpPerPhonePerHour` = **3** — c'est la SEULE qui morde, et elle est par
 *     NUMÉRO.
 *
 * DONC : TIREZ UN NUMÉRO NEUF À CHAQUE COMPTE. C'est ce que `connecter()` fait
 * déjà (`numeroNeuf()`) et ce que cette fonction fait pour le numéro français.
 * Réutiliser un numéro est précisément ce qui bloque.
 *
 * ── LE MÊME PIÈGE DE JETON QUE POUR L1, ET IL FRAPPE DEUX FOIS ────────────
 *
 * Chaque changement de niveau périme le jeton d'accès (`401 TOKEN_STALE`). Il y
 * en a deux ici — L0→L1 puis L1→L2 — donc deux rafraîchissements. `monterEnL1`
 * fait le premier et rend son jeton ; celui-ci fait le second. Le cookie
 * `dp_refresh` est réinstallé dans le navigateur APRÈS, comme pour L1 : celui qui
 * y était avait été émis pour un membre L1.
 */
export async function monterEnL2(
  context: BrowserContext,
  request: APIRequestContext,
  accessTokenActuel: string,
): Promise<{ readonly accessToken: string }> {
  const { accessToken: jetonL1 } = await monterEnL1(context, request, accessTokenActuel);
  const auth = { authorization: `Bearer ${jetonL1}` };

  const numero = `+336${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
  const depot = await request.post(`${API}/me/phones`, {
    headers: auth,
    // `countryIso2: 'FR'` — un pays de DESTINATION actif. Voir l'en-tête.
    data: { phone: numero, countryIso2: 'FR', captchaToken: 'fake' },
  });
  if (!depot.ok()) {
    throw new Error(`POST /me/phones ${depot.status()} : ${await depot.text()}`);
  }
  const { challengeId } = (await depot.json()) as { challengeId: string };

  const confirme = await request.post(`${API}/me/phones/verify`, {
    headers: auth,
    data: { challengeId, code: CODE_OTP },
  });
  if (!confirme.ok()) {
    throw new Error(`POST /me/phones/verify ${confirme.status()} : ${await confirme.text()}`);
  }
  const { isDestination, level } = (await confirme.json()) as {
    isDestination: boolean;
    level: string;
  };
  // Le contrôle est ICI et pas dans le test appelant : `is_destination` est la
  // colonne qui DÉCIDE de L2, et elle est calculée depuis le pays, jamais reçue du
  // client. Un `false` voudrait dire que le pays a été fermé entre-temps, et
  // l'appelant verrait un `403 LEVEL_REQUIRED` sans comprendre d'où il vient.
  if (!isDestination || level !== 'L2') {
    throw new Error(
      `le numéro de destination n’a pas porté le membre en L2 (isDestination=${String(
        isDestination,
      )}, niveau=${level}) : les capacités N2 — dont \`guide.write\` — répondraient ` +
        '403 LEVEL_REQUIRED.',
    );
  }

  // Le jeton L1 est mort à son tour : voir « LE PIÈGE » dans l'en-tête de L1.
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
