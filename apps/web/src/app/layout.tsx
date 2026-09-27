import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { PRODUCT_NAME, PWA_THEME_COLOR } from '@app/shared';
import './globals.css';

/** Plus Jakarta Sans, les graisses employées par le design (T1 §2.2). */
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-jakarta',
});

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description:
    'La plateforme communautaire de la diaspora africaine en France : préparer son départ, s’installer, s’intégrer.',
  // Aucun parcours public, aucun profil privé n'est indexable (règles dures).
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: PWA_THEME_COLOR,
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <html lang="fr" className={jakarta.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
