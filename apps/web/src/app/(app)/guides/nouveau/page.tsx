'use client';

import { ScreenFrames } from '@/screens/frames';
import { A05Desktop } from '@/screens/a05/desktop.generated';
import { A05Mobile } from '@/screens/a05/mobile.generated';
import { accueilData } from '@/screens/accueil/props';

/**
 * A05 — l'éditeur de guide. `/guides/nouveau`
 *
 * `direction="column"` : la maquette met `flex-direction: column` dans le conteneur
 * du cadre, que le générateur retire parce qu'il portait aussi la taille fixe. C'est
 * le SEUL cadre d'ordinateur de cette maquette en colonne — tous les autres ont le
 * rail à gauche — et sans cette bascule la barre d'outils se retrouve à côté du
 * corps du guide au lieu d'être au-dessus.
 */
export default function NouveauGuidePage() {
  const data = accueilData();
  return (
    <ScreenFrames
      screen="A05"
      direction="column"
      desktop={<A05Desktop {...data} />}
      mobile={<A05Mobile {...data} />}
    />
  );
}
