'use client';

import { ScreenFrames } from '@/screens/frames';
import { A10Desktop } from '@/screens/a10/desktop.generated';
import { A10Mobile } from '@/screens/a10/mobile.generated';
import { accueilData } from '@/screens/accueil/props';

/**
 * A10 — créer un réseau. `/reseaux/nouveau`
 *
 * Les trois visibilités de §7 y sont dessinées, « Sur invitation » comprise, dont la
 * maquette rappelle qu'elle est invisible dans Découvrir.
 */
export default function NouveauReseauPage() {
  const data = accueilData();
  return (
    <ScreenFrames screen="A10" desktop={<A10Desktop {...data} />} mobile={<A10Mobile {...data} />} />
  );
}
