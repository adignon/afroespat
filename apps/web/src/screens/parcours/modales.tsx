'use client';

import type { PlancheModale } from './ecran';
import type { ParcoursData } from './data';
import { J03Desktop1 } from '@/screens/j03/desktop1.generated';
import { J03Desktop2 } from '@/screens/j03/desktop2.generated';
import { J03Desktop3 } from '@/screens/j03/desktop3.generated';
import { J03Mobile1 } from '@/screens/j03/mobile1.generated';
import { J03Mobile2 } from '@/screens/j03/mobile2.generated';
import { J03Mobile3 } from '@/screens/j03/mobile3.generated';
import { J04Desktop } from '@/screens/j04/desktop.generated';
import { J04Mobile } from '@/screens/j04/mobile.generated';

/**
 * Les deux fenêtres que PLUSIEURS écrans du module ouvrent.
 *
 * « Je suis bloqué·e » est joignable depuis la carte du panneau de gauche, donc
 * depuis tous les écrans d'ordinateur du module ; « Partager un jalon » depuis
 * la colonne de droite de J01 et depuis « Marquer comme franchie » sur J01S.
 * Les décrire une fois évite que chaque page choisisse son propre volet de
 * départ — et c'est le volet de départ qui porte la règle dure de §3.5.
 */

/**
 * LES TROIS VOLETS DE « JE SUIS BLOQUÉ·E » (§3.5).
 *
 * Chaque volet est une PLANCHE de la maquette, pas un état de composant : la
 * maquette en dessine trois, sur les deux formes. Le volet hors bornes retombe
 * sur le premier — `noUncheckedIndexedAccess` l'exige, et c'est de toute façon
 * le repli qu'on veut : jamais l'aperçu, qui est à un clic de « Publier ».
 */
const VOLETS_DESKTOP = [J03Desktop1, J03Desktop2, J03Desktop3] as const;
const VOLETS_MOBILE = [J03Mobile1, J03Mobile2, J03Mobile3] as const;

export function plancheBlocage(volet: number, data: ParcoursData): PlancheModale {
  const Desktop = VOLETS_DESKTOP[volet] ?? J03Desktop1;
  const Mobile = VOLETS_MOBILE[volet] ?? J03Mobile1;
  return {
    desktop: <Desktop {...data} />,
    mobile: <Mobile {...data} />,
    // `moments.panelAdvance` : « vous avancez dans une démarche, vous ne sautez
    // pas d'un écran à l'autre ». Le premier volet reste une ouverture.
    phase: volet,
  };
}

/** §3.6 — « Partager un jalon », champ VIDE : c'est le membre qui écrit. */
export function plancheJalon(data: ParcoursData): PlancheModale {
  return { desktop: <J04Desktop {...data} />, mobile: <J04Mobile {...data} /> };
}
