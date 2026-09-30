'use client';

import { ScreenFrames } from '@/screens/frames';
import { A06CorrigerDesktop } from '@/screens/a06/corrigerdesktop.generated';
import { A06CorrigerMobile } from '@/screens/a06/corrigermobile.generated';
import { panelGuides, rail, shortcuts, type A06Data } from '@/screens/a06/data';

/**
 * A06 · planche 1 — proposer une correction. `/guides/:slug/corriger`
 *
 * « PANNEAU LATÉRAL SUR LA PAGE DU GUIDE (WEB) · FEUILLE DU BAS (MOBILE) », dit la
 * maquette. Ce n'est donc PAS une modale au sens du composant `Modal`, et la
 * déclaration l'explique en détail (`tools/screens/03-accueil.mjs`) :
 *
 *   · sur ordinateur, le voile et le panneau sont imbriqués DANS la colonne de
 *     contenu, à droite du rail — qui reste utilisable. C'est un panneau latéral sur
 *     une page, et la page entière est transcodée telle quelle ;
 *   · sur mobile c'est bien une feuille du bas, mais son fond est l'esquisse que la
 *     maquette dessine à `opacity: .6`, pas le vrai guide.
 *
 * CE QU'IL FAUT SAVOIR : sur mobile, le contenu derrière la feuille est donc cette
 * esquisse. La brancher sur la vraie lecture demande un état partagé entre A04 et
 * A06 — du travail de lot 3, pas quelque chose que le transcodage puisse deviner.
 */
export default function CorrigerPage() {
  const data: A06Data = { rail, panelGuides, shortcuts };
  return (
    <ScreenFrames
      screen="A06-corriger"
      desktop={<A06CorrigerDesktop {...data} />}
      mobile={<A06CorrigerMobile {...data} />}
    />
  );
}
