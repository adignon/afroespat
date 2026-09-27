import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const nextConfig = {
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
