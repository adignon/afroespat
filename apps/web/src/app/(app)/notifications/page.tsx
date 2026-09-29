import { ScreenFrames } from '@/screens/frames';
import { X02Desktop } from '@/screens/x02/desktop.generated';
import { X02DesktopPanneau } from '@/screens/x02/desktoppanneau.generated';
import { X02Mobile } from '@/screens/x02/mobile.generated';

/**
 * X02 — Notifications (`/notifications`, 12 §2.7 et §5, T5 §10).
 *
 * Transcodé de `docs/template/09 Messages et transverse.dc.html`.
 *
 * Composant SERVEUR : il reçoit `searchParams` en propriété et n'emploie donc pas
 * `useSearchParams()`, qui forcerait un rendu client et servirait un HTML vide.
 *
 * DEUX PLANCHES D'ORDINATEUR, parce que 12 §2.7 décrit deux formes — « panneau
 * déroulant » et « page complète » — et que la maquette les dessine toutes les deux :
 *
 *   · la PAGE COMPLÈTE, par défaut : titre, filtres par catégorie, lignes ;
 *   · le PANNEAU DÉROULANT, sur `?vue=panneau` : la même liste dans une carte
 *     posée sous la cloche, avec « Tout marquer lu » et « Voir tout ».
 *
 * POURQUOI UN PARAMÈTRE D'URL plutôt qu'un clic sur la cloche : aucun cadre de ce lot
 * ne dessine de cloche cliquable — c'est un `<span>` d'icône dans la barre haute, et
 * la planche du panneau représente son état OUVERT sur un contenu principal VIDE.
 * Inventer le contrôle serait réécrire la maquette ; laisser la planche inatteignable
 * serait la livrer morte. Même choix que pour le sélecteur de parcours de J01M.
 *
 * Le panneau n'a pas de forme mobile dessinée : sur téléphone, la maquette ne montre
 * que la page complète. Le cadre mobile ne change donc pas — même raisonnement que
 * l'état « Modifier les étapes » de J01, qui n'existe que sur téléphone.
 *
 * 12 §2.1 ET 12 §2.4 — AUCUNE NOTIFICATION DE MESSAGE N'EST DESSINÉE ICI, et c'est
 * une bonne nouvelle : les cinq lignes de la maquette portent une réaction groupée,
 * des réponses d'entraide, une échéance de parcours, un événement et une acceptation
 * de parrainage. Pas un corps de message, pas même un « Nouveau message de X ». La
 * règle « un push MESSAGE ne contient jamais le corps du message » n'est donc
 * contredite par aucun pixel — vérifié ligne à ligne, pas supposé. La pastille de
 * filtre « Messages » existe bien, mais elle ne filtre, dans cette planche, aucune
 * ligne dessinée.
 */
const VUES = { panneau: 'panneau' } as const;

type VueNotifications = 'page' | (typeof VUES)[keyof typeof VUES];

export default async function NotificationsPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const demande = params['vue'];
  // Une vue inconnue est IGNORÉE plutôt qu'affichée : l'URL est publique.
  const vue: VueNotifications =
    typeof demande === 'string' ? (VUES[demande as keyof typeof VUES] ?? 'page') : 'page';

  return (
    <ScreenFrames
      screen="X02"
      desktop={vue === 'panneau' ? <X02DesktopPanneau /> : <X02Desktop />}
      mobile={<X02Mobile />}
    />
  );
}
