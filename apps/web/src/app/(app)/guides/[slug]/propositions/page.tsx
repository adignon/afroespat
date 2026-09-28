'use client';

import { ScreenFrames } from '@/screens/frames';
import { A06Desktop } from '@/screens/a06/desktop.generated';
import { A06Mobile } from '@/screens/a06/mobile.generated';
import { accueilData } from '@/screens/accueil/props';

/**
 * A06 · planche 2 — « Propositions reçues » de l'auteur. `/guides/:slug/propositions`
 *
 * C'est la page où l'auteur d'un guide accepte ou refuse les corrections proposées
 * par les membres. La planche 1 de la même section est la feuille de proposition
 * elle-même : voir `/guides/:slug/corriger`.
 */
export default function PropositionsPage() {
  const data = accueilData();
  return (
    <ScreenFrames screen="A06" desktop={<A06Desktop {...data} />} mobile={<A06Mobile {...data} />} />
  );
}
