# Serveur démo des fournisseurs

Décision du porteur : *« un serveur démo qui implémente toutes les routes nécessaires chez les
providers avec des clés d'accès de test pour le moment. En production on change juste les clés et
le serveur. »*

`apps/provider-demo` (`@app/provider-demo`) est un serveur Node autonome (`node:http` + `node:net`,
**aucune dépendance d'exécution**) qui répond comme Twilio, Brevo, Didit, Cloudflare Turnstile, S3,
ClamAV, un service Web Push et l'API Anthropic — avec les **mêmes chemins, en-têtes d'authentification,
formats et codes d'erreur** que les vraies API, pour les seules routes que NOS adaptateurs
(`apps/api/src/providers/*.provider.ts`) appellent. L'API tourne avec ses adaptateurs **réels** ; rien
n'est substitué côté code.

## Lancer

```sh
# 1. le serveur démo (port 3077 ; HTTP et clamd partagent ce port)
pnpm demo:providers

# 2. l'API en mode démo : le même fichier de clés/URLs sert aux deux côtés
set -a; . ./.env.demo.example; set +a        # PROVIDER_MODE=demo + clés de test + URLs de base
cd apps/api && node -r @swc-node/register src/main.ts
```

`PROVIDER_MODE=demo` (`apps/api/src/config/provider-demo-profile.ts`) choisit les adaptateurs réels et
fournit des valeurs **par défaut** pour toutes les variables de fournisseurs. Précédence :
**variable posée dans le shell > profil démo > `.env`** (le `.env` de développement porte des
`*_PROVIDER=fake` et un MinIO local qui supplanteraient sinon le mode). Le **paiement** n'est pas touché
(toujours fictif). `PROVIDER_MODE=demo` est **refusé** quand `NODE_ENV=production`.

Variables du serveur démo seul : `DEMO_PORT` (3077), `DEMO_HOST` (127.0.0.1), `DEMO_PUBLIC_URL`,
`DEMO_STATE_FILE` (JSON : boîte, objets S3 et sessions survivent au redémarrage ; sinon mémoire seule),
`DEMO_DIDIT_WEBHOOK_URL` (défaut `http://localhost:$API_PORT/v1/webhooks/didit`).

## Lire ce que le démo a « envoyé »

| route | rôle |
|---|---|
| `GET /__demo/inbox?kind=sms\|email\|push\|kyc\|scan\|moderation\|captcha&to=&limit=` | du plus récent au plus ancien ; chaque entrée porte `code` (6 chiffres lu dans le texte : OTP), `links`, `subject`, `body`, `meta` |
| `POST /__demo/reset` | vide boîte, objets, sessions KYC, abonnements push |
| `GET /__demo/health` | sonde |

`to` se compare sans « + » ni espaces. Exemple : `curl 'localhost:3077/__demo/inbox?kind=sms&limit=1'`.

## Routes émulées, par fournisseur

La liste de référence est `apps/provider-demo/src/contracts.ts` (partagée avec le test de parité).

| fournisseur | route | appelée par | authentification / contrôles |
|---|---|---|---|
| Twilio | `POST /2010-04-01/Accounts/{sid}/Messages.json` | `TwilioSmsProvider.send` | Basic `sid:jeton` (401 / 20003), `To`, `Body`, `From` ou `MessagingServiceSid` ; 201 `{sid:"SM…"}` |
| Twilio | `GET /2010-04-01/Accounts/{sid}/Messages/{msid}.json` | — (statut) | queued → delivered, ou undelivered/30003 |
| Brevo | `POST /v3/smtp/email` | `BrevoEmailProvider.send` | en-tête `api-key` (401), `sender`, `to[]`, `subject`, `htmlContent`/`textContent` ; 201 `{messageId}` |
| Brevo | `GET /v3/account` | — | vérifie la clé |
| Didit | `POST /v2/session/` | `DiditKycProvider.createSession` | `x-api-key` (401), `workflow_id` (404 si inconnu), 201 `{session_id,url,…}` |
| Didit | `GET /v2/session/{id}/decision/` | `DiditKycProvider.getStatus` | statut + `id_verification.age/date_of_birth` |
| Didit | `GET`/`POST /__demo/kyc/{id}` | — | page hébergée simulée (le NOM décide), redirige vers `callback` |
| Didit | webhook sortant → `POST {API}/v1/webhooks/didit` | `KycService.applyWebhook` | `X-Signature` = HMAC-SHA256 hex du corps brut (`DIDIT_WEBHOOK_SECRET`), `X-Timestamp` |
| Turnstile | `POST /turnstile/v0/siteverify` | `TurnstileCaptchaProvider.verify` | formulaire `secret`/`response`/`remoteip`, toujours 200 + `success`/`error-codes` |
| S3 | `PUT /{seau}/{clé}` | `put`, `createUploadUrl` | SigV4 vérifiée (en-tête ou URL pré-signée avec expiration), corps `aws-chunked` décodé |
| S3 | `GET`/`HEAD /{seau}/{clé}` | `get`, `createDownloadUrl` | 404 `NoSuchKey` (XML) |
| S3 | `DELETE /{seau}/{clé}` | `delete` | 204, idempotent |
| ClamAV | clamd `zINSTREAM` (TCP, même port) | `ClamAvAntivirusProvider.scan` | + `PING`, `VERSION` ; réponses `stream: OK` / `… FOUND` / `… ERROR` |
| Web Push | `POST /push/{id}` | `WebPushProvider.send` | VAPID `vapid t=JWT,k=clé` vérifié, `TTL`, `aes128gcm` déchiffré ; 201 / 404 / 410 / 401 / 403 / 413 |
| Web Push | `POST /__demo/push/subscriptions`, `POST /__demo/push/{id}/revoke` | — | crée un « appareil » (endpoint + clés ECDH), le révoque (→ 410) |
| Anthropic | `POST /v1/messages` | `AnthropicModerationProvider.classify` | `x-api-key` (401), `anthropic-version` (400), verdict déterministe |

## Cas d'essai (échecs compris)

- **Twilio** (`To`) : `+15005550001` → 400/21211 numéro invalide ; `…0002` → 21612 ; `…0003` → 21408 ;
  `…0004` → 21610 (désabonné) ; `…0429` → 429 ; `…0500` → 503 (réessayable) ; `…5559999` → accepté puis
  `undelivered`. `From=+15005550001` → 21212. Jeton faux → 401.
- **Brevo** (partie locale du destinataire) : `fail@…` → 400 ; `ratelimit@…` → 429 ; `down@…` → 503.
- **Didit** (le NOM saisi sur la page hébergée, ou `POST /__demo/kyc/{id}/decide {"name":…}`) :
  « refus »/« decline » → Declined ; « mineur »/« minor » → Approved, 15 ans (L1 refusé) ;
  « revue »/« review » → In Review ; « abandon » → Abandoned ; tout autre nom → Approved, 34 ans.
  `POST /__demo/kyc/{id}/redeliver` renvoie le webhook.
- **Turnstile** : secrets de test Cloudflare `1x…AA` (accepte), `2x…AA` (refuse), `3x…AA` (jeton déjà
  utilisé) ; avec la clé du démo, `XXXX.DUMMY.TOKEN.XXXX` passe et tout jeton commençant par `fail` échoue.
- **S3** : mauvais secret → 403 `SignatureDoesNotMatch` ; clé inconnue → `InvalidAccessKeyId` ; seau
  inconnu → `NoSuchBucket` ; URL pré-signée expirée → 403.
- **ClamAV** : la chaîne EICAR → `Win.Test.EICAR_HDB-1 FOUND` ; `DEMO-VIRUS-TEST` → `Demo.Test.Signature` ;
  `DEMO-CLAMD-ERROR` → `ERROR` (l'adaptateur lève : une panne refuse) ; > 25 Mio → `size limit exceeded`.
- **Web Push** : abonnement révoqué → 410 (l'API supprime l'abonnement) ; autre clé VAPID que celle de
  l'abonnement → 403.
- **Anthropic** : mots-clés (`garantie`, `acompte`, `envoie`, `western union` → SCAM/MONEY_REQUEST, score
  0,85 ; `connard` → HARASSMENT ; sinon OK, 0,05) ; `DEMO_REFUSAL` → `stop_reason: refusal` ;
  `DEMO_OVERLOADED` → 529 ; `DEMO_RATE_LIMIT` → 429 ; `DEMO_BAD_JSON` ; `DEMO_UNKNOWN_LABEL`.

## Passer en production : changer les clés et les URLs, rien d'autre

1. **Retirer** `PROVIDER_MODE=demo` (et `DEMO_BASE_URL`).
2. **Remplacer les clés** par les vraies : `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` (ou
   `TWILIO_MESSAGING_SERVICE_SID`), `BREVO_API_KEY`, `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`
   (`npx web-push generate-vapid-keys`), `DIDIT_API_KEY`, `DIDIT_WORKFLOW_ID`, `DIDIT_WEBHOOK_SECRET`,
   `ANTHROPIC_API_KEY`, `TURNSTILE_SECRET_KEY` (+ `NEXT_PUBLIC_TURNSTILE_SITE_KEY` côté web),
   `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY`.
3. **Supprimer ou remplacer les URLs** : `TWILIO_BASE_URL`, `BREVO_BASE_URL`, `DIDIT_BASE_URL`,
   `TURNSTILE_BASE_URL`, `ANTHROPIC_BASE_URL` (leurs défauts sont les adresses de production),
   `S3_ENDPOINT` (+ `S3_REGION`, `S3_BUCKET`, région UE), `ANTIVIRUS_HOST`/`ANTIVIRUS_PORT` (clamd réel).
4. Dans la console Didit, déclarer le webhook `https://<api>/v1/webhooks/didit`.

`NODE_ENV=production` continue de refuser tout fournisseur `fake` et `PROVIDER_MODE=demo`. Les valeurs
`*_PROVIDER` sans implémentation (paiement) échouent toujours au démarrage (`pick()`).

## Ce qui n'est PAS fidèle

- Les formats sont ceux des documentations publiques pour les champs que nos adaptateurs lisent ; les
  champs ignorés sont approximés. Aucun test ne remplace une première recette avec de vrais comptes
  (délivrabilité SMS par pays et 10DLC, SPF/DKIM, parcours Didit réel, quotas, latences).
- **Twilio** : pas de rappels de statut, pas de segments facturés, pas de listes ni de média ; tout numéro
  E.164 valide est « joignable ».
- **Brevo** : pas de rebonds ni de webhooks d'événements ; pas de modèles hébergés ; le contenu n'est pas
  analysé (spam).
- **Didit** : la page hébergée est une pauvre simulation (un champ « nom ») ; aucun document n'est lu ;
  seuls `status`, `age`, `date_of_birth`, `warnings[].risk` sont produits dans la décision.
- **Turnstile** : pas de `hostname`/`action` vérifiés, pas de jeton à usage unique (sauf la clé de test `3x`).
- **S3** : seulement le mode path-style et PUT/GET/HEAD/DELETE d'objet — pas de `ListObjectsV2`, multipart,
  versionnement, plages d'octets, `CopyObject`, politiques ni chiffrement réel (`AES256` n'est que renvoyé).
- **ClamAV** : détection par chaînes de test, pas de base de signatures ; pas d'`IDSESSION`.
- **Web Push** : un vrai navigateur ne peut pas s'abonner auprès du démo (l'abonnement vient de son service
  push) ; les abonnements de démo se créent par `/__demo/push/subscriptions`. Pas de limitation de débit.
- **Anthropic** : pas de modèle : un verdict par mots-clés ; pas de flux, pas d'outils, `usage` approximé.
- Le démo n'a **aucune authentification** sur `/__demo/*` et écoute sur `127.0.0.1` : ne l'exposez pas.

## Tests

- `apps/api/src/providers/__tests__/demo-adapters.test.ts` — chaque adaptateur réel contre le démo (port
  aléatoire), succès et erreurs.
- `apps/api/src/providers/__tests__/demo-parity.test.ts` — **parité** : échoue si un adaptateur appelle une
  route que le démo n'implémente pas (liste `CONTRACTS` partagée), ou si un adaptateur gagne une méthode
  publique sans contrat.
- `apps/api/src/providers/__tests__/demo-flow.int.test.ts` — parcours API complet en mode démo.
- `apps/api/src/config/provider-demo.test.ts` — profil, précédence, refus en production, cohérence avec
  `.env.demo.example` et les clés du démo.
