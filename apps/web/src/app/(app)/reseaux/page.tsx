'use client';

import { ScreenFrames } from '@/screens/frames';
import { A07Desktop } from '@/screens/a07/desktop.generated';
import { A07Mobile } from '@/screens/a07/mobile.generated';
import { accueilData } from '@/screens/accueil/props';

/**
 * A07 — mes réseaux, et ceux à découvrir. `/reseaux`
 *
 * Le cadre mobile vient de la planche « Versions mobiles » (MOB), cinquième
 * position — « A07 · Réseaux ».
 */
export default function ReseauxPage() {
  const data = accueilData();
  return (
    <ScreenFrames screen="A07" desktop={<A07Desktop {...data} />} mobile={<A07Mobile {...data} />} />
  );
}
