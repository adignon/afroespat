import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { PRODUCT_NAME, PWA_THEME_COLOR } from '@app/shared';
import { Notifications } from '@/components/notifications';
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
         * LA REPRISE DE SESSION MEMBRE N'EST PLUS ICI, et c'est une correction.
         *
         * `<SessionBoot />` vivait dans ce layout, avec cette raison écrite : « ici
         * plutôt que dans chaque groupe de routes : la session se reprend une fois
         * par chargement, pas une fois par zone de l'application ». Le raisonnement
         * était juste quand il n'existait qu'une zone. Il est devenu FAUX le jour où
         * `(admin)` a existé : ce layout enveloppe les trois groupes, donc la reprise
         * de session MEMBRE s'exécutait sur chaque page d'ÉQUIPE.
         *
         * Mesuré au navigateur par l'agent qui branchait l'administration : toute
         * page d'admin émettait `POST /v1/auth/refresh` et prenait un 401. Un membre
         * de l'équipe qui a aussi un compte membre dans le même navigateur faisait
         * donc ACQUÉRIR UN JETON D'ACCÈS MEMBRE EN MÉMOIRE À UNE PAGE
         * D'ADMINISTRATION — une contamination entre deux domaines que 15 §2.1
         * déclare hermétiques, et que le serveur tient si strictement qu'il refuse
         * toute route déclarant les deux.
         *
         * La reprise vit maintenant là où elle appartient, zone par zone :
         *   · `(app)` — par `GardeSession`, qui l'appelle déjà pour décider ;
         *   · `(onboarding)` — par `<SessionBoot />`, parce qu'un membre déjà
         *     identifié ne doit pas refaire son inscription ;
         *   · `(admin)` — RIEN, et c'est tout le point. Son propre layout l'avait
         *     écrit : « le jour où une coquille d'équipe existera, elle vivra ici et
         *     nulle part ailleurs ».
         */}
        {children}
        {/**
         * LE RÉCEPTACLE DES NOTIFICATIONS, LUI, EST BIEN À SA PLACE ICI.
         *
         * La note ci-dessus explique pourquoi `SessionBoot` a dû quitter ce layout :
         * il ÉMETTAIT une requête, donc il contaminait les pages d'équipe. Celui-ci
         * n'émet rien, ne lit aucune session, et ne rend aucun nœud tant qu'aucune
         * notification n'existe. Il n'y a rien à cloisonner — et un réceptacle par
         * zone donnerait trois files pour une seule.
         */}
        <Notifications />
      </body>
    </html>
  );
}
