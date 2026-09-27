/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
