import { ScreenFrames } from '@/screens/frames';
import { K04Desktop } from '@/screens/k04/desktop.generated';
import { K04Mobile } from '@/screens/k04/mobile.generated';

/**
 * K04 — « Téléphones et sessions » (`/compte/securite`, 01 §2).
 *
 * 01 §2.1, RÈGLE DURE : **aucun numéro de téléphone en clair**, jamais, et
 * seulement un masque à son propriétaire. La maquette la tient par le DESSIN —
 * « +229 •• •• •• 42 », « +33 6 •• •• •• 18 » — et le transcodage la conserve par
 * construction, puisqu'il ne réécrit rien.
 *
 * C'est la propriété la plus facile à perdre d'un écran qui parle de téléphones :
 * il suffirait qu'un lot branche l'API et interpole `user.phone`. `e2e/compte.spec.ts`
 * l'éprouve donc à l'écran, sur les deux cadres, plutôt que de la supposer tenue.
 *
 * Le rôle de chaque numéro est dessiné à côté : « Bénin · principal » et
 * « France · destination ». Le second est celui que N2 exige (01 §3) — le pays de
 * DESTINATION.
 *
 * LES DEUX CADRES NE DISENT PAS LA MÊME CHOSE du numéro principal, et c'est la
 * maquette : le cadre mobile écrit « Dernier numéro, non retirable » à sa droite
 * — ce que T5 K04 demande — là où le cadre d'ordinateur lui laisse un bouton
 * « Retirer ». Les deux planches montrent pourtant le même compte, avec deux
 * numéros. L'écart est transcodé tel quel et signalé au porteur : le corriger ici
 * serait redessiner une des deux planches à sa place.
 */
export default function SecuritePage() {
  return <ScreenFrames screen="K04" desktop={<K04Desktop />} mobile={<K04Mobile />} />;
}
