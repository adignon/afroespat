import type { ReactNode } from 'react';
import { SessionBoot } from '@/components/session-boot';

/**
 * LE GROUPE DE ROUTES DE L'ACCÈS ET DE L'ONBOARDING.
 *
 * Il ne faisait rien jusqu'ici — il n'existait même pas. Il porte désormais la
 * reprise de session membre, déplacée du layout RACINE.
 *
 * ── POURQUOI ELLE A DÛ DÉMÉNAGER ───────────────────────────────────────────
 *
 * Le layout racine enveloppe les trois groupes, `(admin)` compris. La reprise de
 * session MEMBRE s'exécutait donc sur chaque page d'ÉQUIPE : mesuré au navigateur,
 * toute page d'administration émettait `POST /v1/auth/refresh`. Un membre de
 * l'équipe qui a aussi un compte membre dans le même navigateur faisait acquérir un
 * jeton d'accès membre en mémoire à une page d'administration — une contamination
 * entre deux domaines que 15 §2.1 déclare hermétiques.
 *
 * ── POURQUOI ICI, ET PAS SEULEMENT DANS `(app)` ────────────────────────────
 *
 * `(app)` n'en a pas besoin : `GardeSession` appelle déjà la reprise pour décider
 * s'il faut rediriger. Ce groupe-ci, lui, en a besoin pour la raison inverse — un
 * membre DÉJÀ identifié qui arrive sur `/connexion` ne doit pas refaire son
 * inscription, et le flux d'onboarding reprend là où il s'est arrêté.
 *
 * Le composant ne rend rien et n'empêche aucun rendu serveur : la page part
 * complète, la reprise se fait après.
 */
export default function LayoutOnboarding({ children }: { readonly children: ReactNode }) {
  return (
    <>
      <SessionBoot />
      {children}
    </>
  );
}
