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
  // §8.3 — en-têtes de sécurité. La CSP stricte viendra avec les domaines réels
  // des fournisseurs (Didit, Stripe, S3) ; ceux-ci sont déjà indépendants.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'geolocation=(), camera=(), microphone=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
