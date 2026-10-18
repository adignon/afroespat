import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Relais de l'API pour l'accès à distance (`tools/tunnel.sh`). Activé seulement si
 * `API_PROXY` est posé : le navigateur appelle alors `/v1/…` sur l'origine de la
 * page, et Next transmet à l'API. Un seul tunnel suffit, sans CORS, et le cookie de
 * rafraîchissement (`SameSite=Strict`, chemin `/v1/auth`) reste de première partie
 * — deux tunnels ngrok seraient deux sites distincts, et ce cookie ne partirait pas.
 */
const API_PROXY = process.env['API_PROXY']?.replace(/\/+$/, '');

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ CSP ET HSTS — 00-fondations.md §8.3 (lot A)                                ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Avant : ni CSP ni HSTS côté web, alors que la spec les exige (« CSP stricte,
 * HSTS »). Ce que la politique AUTORISE, et pourquoi :
 *
 *   · `connect-src` / `img-src` / `media-src` : l'origine de l'API
 *     (`NEXT_PUBLIC_API_URL`, 3001 par défaut), son WebSocket (`/ws`, socket.io) et
 *     ses médias (`/media/<clé>` — l'API rend des adresses relatives que
 *     `urlMedia` rend absolues sur l'origine de l'API). Sans elle le navigateur
 *     bloquerait chaque appel et chaque avatar. `data:` et `blob:` servent aux
 *     aperçus de fichiers avant envoi (`URL.createObjectURL`, stories) ;
 *   · `style-src 'unsafe-inline'` : les écrans transcodés des maquettes portent
 *     leurs styles EN LIGNE (attributs `style`), à des milliers d'endroits. Un
 *     `style-src` sans `'unsafe-inline'` les ferait tous tomber ;
 *   · `script-src 'unsafe-inline'` : Next injecte des scripts en ligne pour
 *     l'hydratation. La parade stricte est un NONCE par requête, posé par un
 *     middleware — mais il oblige chaque page à un rendu dynamique et perd le rendu
 *     statique ; ce n'est pas un réglage de configuration. ÉCART ASSUMÉ ET
 *     REMONTÉ : les autres directives restent strictes (`object-src 'none'`,
 *     `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`), ce qui
 *     ferme les injections de balises, les formulaires détournés et l'encadrement.
 *     `'unsafe-eval'` n'est accordé qu'en DÉVELOPPEMENT : le rechargement à chaud de
 *     Next évalue du code, la production non ;
 *   · les polices viennent de `next/font/google`, auto-hébergées sous `/_next` :
 *     `font-src 'self'` suffit, aucun appel à fonts.googleapis.com.
 *
 * HSTS : en PRODUCTION seulement. Sur `http://localhost` l'en-tête est ignoré par
 * les navigateurs, mais l'envoyer depuis un serveur de développement derrière un
 * tunnel HTTPS le ferait mémoriser pour le domaine du tunnel.
 */
const ESTPROD = process.env['NODE_ENV'] === 'production';

function originesApi() {
  const brut = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1';
  try {
    const url = new URL(brut);
    const ws = `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}`;
    return { http: url.origin, ws };
  } catch {
    // Adresse relative (relais `API_PROXY`) : même origine, déjà couverte par 'self'.
    return { http: '', ws: '' };
  }
}

function politiqueDeSecurite() {
  const api = originesApi();
  const avecApi = (...base) => [...base, api.http].filter(Boolean).join(' ');
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${ESTPROD ? '' : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${avecApi("'self'", 'data:', 'blob:')}`,
    `media-src ${avecApi("'self'", 'blob:')}`,
    "font-src 'self' data:",
    // Développement : le rechargement à chaud de Next parle en WebSocket sur la page.
    `connect-src ${[
      "'self'",
      api.http,
      api.ws,
      ...(ESTPROD ? [] : ['ws://localhost:*', 'ws://127.0.0.1:*']),
    ]
      .filter(Boolean)
      .join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(ESTPROD ? ['upgrade-insecure-requests'] : []),
  ];
  return directives.join('; ');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(API_PROXY && {
    async rewrites() {
      return [{ source: '/v1/:path*', destination: `${API_PROXY}/v1/:path*` }];
    },
    // Next refuse par défaut les ressources de développement (HMR, /_next) demandées
    // depuis une autre origine que localhost.
    allowedDevOrigins: ['*.ngrok-free.app', '*.ngrok-free.dev', '*.ngrok.app'],
  }),
  reactStrictMode: true,
  // Un package-lock.json existe au-dessus du projet : sans cela, Next infère la
  // mauvaise racine et trace des fichiers hors du dépôt.
  outputFileTracingRoot: resolve(dirname(fileURLToPath(import.meta.url)), '..', '..'),
  // @app/ui est publié en source : Next le transpile comme le reste de l'application.
  transpilePackages: ['@app/ui', '@app/shared'],
  // §8.3 — en-têtes de sécurité, CSP et HSTS compris (voir `politiqueDeSecurite`).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'geolocation=(), camera=(), microphone=()' },
          { key: 'Content-Security-Policy', value: politiqueDeSecurite() },
          ...(ESTPROD
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
