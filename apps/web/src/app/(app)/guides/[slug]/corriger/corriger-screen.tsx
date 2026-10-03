'use client';

import { ScreenFrames } from '@/screens/frames';
import { A06CorrigerDesktop } from '@/screens/a06/corrigerdesktop.generated';
import { A06CorrigerMobile } from '@/screens/a06/corrigermobile.generated';
import {
  guide as guideMaquette,
  panelGuides,
  propositionDepliee,
  propositionRepliee,
  propositionsCompte,
  rail,
  shortcuts,
  type A06Data,
} from '@/screens/a06/data';
import { useGuide } from '@/screens/guides/use-guides';

/**
 * A06 · planche 1 — proposer une correction. BRANCHÉE SUR L'API.
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
 * ── CE QUI EST BRANCHÉ ICI, ET C'EST UNE SEULE CHOSE ────────────────────────
 *
 * LE TITRE DU GUIDE VISÉ. La feuille annonçait « Obtenir la garantie Visale sans
 * CDI » quelle que soit la correction proposée : c'était un littéral, et c'est la
 * seule prise que le cadre « CorrigerMobile » expose (`{{ guide.title }}`).
 *
 * Les trois autres propriétés de `A06Data` — les deux propositions et les
 * compteurs — ne sont lues par AUCUN des deux cadres de cette planche. Elles sont
 * dans le type parce que les quatre cadres de A06 partagent une signature, et on
 * leur passe le DESSIN de la maquette : y mettre une donnée d'API serait faire un
 * appel que rien n'affiche.
 *
 * ── CE QUE CET ÉCRAN NE SAIT PAS FAIRE, ET QU'ON NE SIMULE PAS ──────────────
 *
 * ENVOYER. `createProposal` existe (`screens/guides/api.ts`, §2.4) mais le
 * formulaire de la maquette — passage visé, remplacement, motif, source — est du
 * balisage statique : aucun de ses champs n'a de prise, donc rien à lire au clic.
 * Le bouton reste dessiné. REMONTÉ : il faut que la planche pose ses marqueurs,
 * puis une régénération.
 *
 * Sur mobile, le contenu derrière la feuille reste l'esquisse de la maquette. La
 * brancher sur la vraie lecture demande un état partagé entre A04 et A06.
 */
export function CorrigerScreen({ slug }: { readonly slug: string }) {
  const { detail, enTete } = useGuide(slug);

  const data: A06Data = {
    rail,
    panelGuides,
    shortcuts,
    /**
     * Le guide que la feuille vise. Avant la réponse, le DESSIN de la maquette —
     * même choix que `guide-screen.tsx` pour l'en-tête de A04.
     */
    guide: detail !== null && enTete !== null ? { title: enTete.title } : guideMaquette,
    /** Non lues par les deux cadres de cette planche : le dessin, tel quel. */
    propositionDepliee,
    propositionRepliee,
    propositionsCompte,
  };

  return (
    <ScreenFrames
      screen="A06-corriger"
      desktop={<A06CorrigerDesktop {...data} />}
      mobile={<A06CorrigerMobile {...data} />}
    />
  );
}
