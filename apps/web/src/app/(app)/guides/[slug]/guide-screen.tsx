'use client';

import { ScreenFrames } from '@/screens/frames';
import { A04Desktop } from '@/screens/a04/desktop.generated';
import { A04Mobile } from '@/screens/a04/mobile.generated';
import { A04AuteurDesktop } from '@/screens/a04/auteurdesktop.generated';
import { A04AuteurMobile } from '@/screens/a04/auteurmobile.generated';
import { accueilData } from '@/screens/accueil/props';

/**
 * A04 — la lecture d'un guide. `/guides/:slug`
 *
 * DEUX VUES, et ce sont deux états du même écran, pas deux pages : la maquette les
 * nomme « VUE LECTEUR » et « VUE AUTEUR — “Proposer une correction” laisse place à
 * Modifier et aux propositions reçues ; le passage visé par une proposition est
 * souligné en pointillé ». C'est le même guide, lu par deux personnes différentes,
 * donc la même URL : `?vue=auteur` change la vue, pas la ressource.
 *
 * SEUL ÉCRAN DE CETTE MAQUETTE à écrire son `<h1>` lui-même — le titre du guide.
 * Ses `<h2>` sont les sections du guide, et le générateur ne les promeut pas :
 * voir la garde de `promoteFirstHeading`.
 */
export function GuideScreen({ auteur }: { readonly auteur: boolean }) {
  const data = accueilData();

  return auteur ? (
    <ScreenFrames
      screen="A04-auteur"
      desktop={<A04AuteurDesktop {...data} />}
      mobile={<A04AuteurMobile {...data} />}
    />
  ) : (
    <ScreenFrames
      screen="A04"
      desktop={<A04Desktop {...data} />}
      mobile={<A04Mobile {...data} />}
    />
  );
}
