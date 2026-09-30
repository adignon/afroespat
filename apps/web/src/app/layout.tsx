import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { PRODUCT_NAME, PWA_THEME_COLOR } from '@app/shared';
import { SessionBoot } from '@/components/session-boot';
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
      <body className="font-sans antialiased">
        {/**
         * Le jeton d'accès meurt avec l'onglet ; le cookie de rafraîchissement
         * dure trente jours. Sans cet appel, le premier appel de chaque page
         * après un rechargement part sans jeton et prend un `401`.
         *
         * Ici plutôt que dans chaque groupe de routes : la session se reprend une
         * fois par chargement, pas une fois par zone de l'application. Le
         * composant ne rend rien et n'empêche AUCUN rendu serveur — la page part
         * complète, et la reprise se fait après.
         */}
        <SessionBoot />
        {children}
      </body>
    </html>
  );
}
