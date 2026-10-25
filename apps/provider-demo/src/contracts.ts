/**
 * LES CONTRATS : la liste, partagée, des routes que NOS adaptateurs appellent.
 *
 * Une seule source pour trois usages :
 *   · le serveur démo ne route QUE ce qui est ici (`server.ts` refuse de démarrer si un
 *     contrat n'a pas de gestionnaire) ;
 *   · le test de parité (`apps/api/src/providers/__tests__/demo-parity.test.ts`) lance
 *     chaque adaptateur réel sur un serveur-témoin, relève les requêtes émises et exige
 *     que chacune corresponde à un contrat — donc à une route du démo ;
 *   · `docs/provider-demo.md` en tire la liste des routes.
 *
 * Ajouter un appel dans un adaptateur sans l'ajouter ici (et dans le démo) fait échouer
 * le test de parité : c'est le but.
 */
export type DemoProvider =
  | 'twilio' | 'brevo' | 'didit' | 'turnstile' | 's3' | 'clamav' | 'webpush' | 'anthropic';

export interface RouteContract {
  readonly provider: DemoProvider;
  readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD';
  /** Gabarit lisible ; `:x` = un segment, `*` = le reste du chemin. */
  readonly path: string;
  /** Qui l'appelle : `Classe.méthode` de l'adaptateur réel, ou `null` si documenté seulement. */
  readonly usedBy: string | null;
  readonly summary: string;
}

export const CONTRACTS: readonly RouteContract[] = [
  { provider: 'twilio', method: 'POST', path: '/2010-04-01/Accounts/:sid/Messages.json', usedBy: 'TwilioSmsProvider.send', summary: 'Envoi d’un SMS (Basic sid:token, formulaire To/Body/From|MessagingServiceSid, 201)' },
  { provider: 'twilio', method: 'GET', path: '/2010-04-01/Accounts/:sid/Messages/:msid.json', usedBy: null, summary: 'Statut d’un message (queued → delivered | undelivered)' },
  { provider: 'brevo', method: 'POST', path: '/v3/smtp/email', usedBy: 'BrevoEmailProvider.send', summary: 'Email transactionnel (en-tête api-key, JSON, 201 {messageId})' },
  { provider: 'brevo', method: 'GET', path: '/v3/account', usedBy: null, summary: 'Compte (vérifie la clé)' },
  { provider: 'didit', method: 'POST', path: '/v2/session/', usedBy: 'DiditKycProvider.createSession', summary: 'Création de session KYC (x-api-key, 201 {session_id,url})' },
  { provider: 'didit', method: 'GET', path: '/v2/session/:id/decision/', usedBy: 'DiditKycProvider.getStatus', summary: 'Décision d’une session' },
  { provider: 'didit', method: 'GET', path: '/__demo/kyc/:id', usedBy: null, summary: 'Page hébergée de vérification (formulaire : le NOM décide du verdict)' },
  { provider: 'turnstile', method: 'POST', path: '/turnstile/v0/siteverify', usedBy: 'TurnstileCaptchaProvider.verify', summary: 'Vérification serveur du jeton (formulaire secret/response/remoteip)' },
  { provider: 's3', method: 'PUT', path: '/:bucket/*', usedBy: 'S3StorageProvider.put', summary: 'Dépôt d’objet (SigV4 en-tête ou URL pré-signée)' },
  { provider: 's3', method: 'GET', path: '/:bucket/*', usedBy: 'S3StorageProvider.get', summary: 'Lecture d’objet (404 NoSuchKey en XML)' },
  { provider: 's3', method: 'DELETE', path: '/:bucket/*', usedBy: 'S3StorageProvider.delete', summary: 'Suppression idempotente (204)' },
  { provider: 's3', method: 'HEAD', path: '/:bucket/*', usedBy: null, summary: 'Métadonnées d’objet' },
  { provider: 'clamav', method: 'POST', path: 'tcp:INSTREAM', usedBy: 'ClamAvAntivirusProvider.scan', summary: 'clamd INSTREAM sur TCP (même port que HTTP, détecté au premier octet) ; PING et VERSION aussi' },
  { provider: 'webpush', method: 'POST', path: '/push/:id', usedBy: 'WebPushProvider.send', summary: 'Service push : VAPID vérifié, charge aes128gcm déchiffrée, 201 ; 410 si révoqué' },
  { provider: 'anthropic', method: 'POST', path: '/v1/messages', usedBy: 'AnthropicModerationProvider.classify', summary: 'Messages : verdict de modération déterministe selon des mots-clés' },
];

/** Routes propres au démo (pas des fournisseurs). */
export const DEMO_ROUTES = [
  'GET /__demo/health',
  'GET /__demo/inbox?kind=&to=&limit=',
  'POST /__demo/reset',
  'POST /__demo/kyc/:id',
  'POST /__demo/kyc/:id/decide',
  'POST /__demo/kyc/:id/redeliver',
  'POST /__demo/push/subscriptions',
  'POST /__demo/push/:id/revoke',
] as const;

export function templateToRegExp(path: string): RegExp {
  const source = path
    .split('/')
    .map((seg) => {
      if (seg === '*') return '.+';
      if (seg.startsWith(':')) {
        return seg.endsWith('.json') ? '[^/]+\\.json' : '[^/]+';
      }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return new RegExp(`^${source}$`);
}

/** Le contrat qui couvre cette requête, ou `undefined`. Les routes précises passent avant S3. */
export function matchContract(method: string, pathname: string): RouteContract | undefined {
  const specific = CONTRACTS.filter((c) => c.provider !== 's3');
  for (const c of [...specific, ...CONTRACTS.filter((c2) => c2.provider === 's3')]) {
    if (c.method === method && !c.path.startsWith('tcp:') && templateToRegExp(c.path).test(pathname)) return c;
  }
  return undefined;
}
