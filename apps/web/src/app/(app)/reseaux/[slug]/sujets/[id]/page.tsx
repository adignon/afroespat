'use client';

import { ScreenFrames } from '@/screens/frames';
import { A09Desktop } from '@/screens/a09/desktop.generated';
import { A09Mobile } from '@/screens/a09/mobile.generated';
import { accueilData } from '@/screens/accueil/props';

/**
 * A09 — un sujet du réseau. `/reseaux/:slug/sujets/:id`
 *
 * « vue auteur + modérateur », dit la maquette : les actions de modération —
 * épingler, clore, masquer — sont dessinées dans le même cadre. Un membre ordinaire
 * ne les verra pas, mais c'est le lot 3 qui le décidera, à partir du rôle renvoyé
 * par l'API. La maquette ne dessine qu'un seul état, et on ne lui en invente pas
 * un second.
 */
export default function SujetPage() {
  const data = accueilData();
  return (
    <ScreenFrames screen="A09" desktop={<A09Desktop {...data} />} mobile={<A09Mobile {...data} />} />
  );
}
