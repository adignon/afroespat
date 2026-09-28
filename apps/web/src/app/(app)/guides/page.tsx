'use client';

import { ScreenFrames } from '@/screens/frames';
import { A03Desktop } from '@/screens/a03/desktop.generated';
import { A03Mobile } from '@/screens/a03/mobile.generated';
import { accueilData } from '@/screens/accueil/props';

/**
 * A03 — Guides et Démarches, la liste. `/guides`
 *
 * Le JSX vient du TRANSCODAGE de `docs/template/03 Accueil v2.dc.html` : les styles
 * en ligne sont ceux de la maquette, à l'identique. Rien n'est réécrit.
 *
 * LE CADRE MOBILE VIENT DE LA PLANCHE « Versions mobiles » (MOB), première position,
 * que la maquette annonce « A03 · Guides — liste ». A03 n'a pas de cadre de 390 px
 * dans sa propre section : voir `tools/screens/03-accueil.mjs`.
 */
export default function GuidesPage() {
  const data = accueilData();
  return (
    <ScreenFrames screen="A03" desktop={<A03Desktop {...data} />} mobile={<A03Mobile {...data} />} />
  );
}
