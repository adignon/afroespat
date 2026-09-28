'use client';

import { ScreenFrames } from '@/screens/frames';
import { A13Desktop } from '@/screens/a13/desktop.generated';
import { A13Mobile } from '@/screens/a13/mobile.generated';
import { accueilData } from '@/screens/accueil/props';

/**
 * A13 — une story en lecture plein écran. `/stories/:id`
 *
 * AUCUN COMPTEUR DE VUES, et c'est la maquette elle-même qui l'écrit sous sa
 * planche : « un composant, trois types · aucun compteur de vues ». Elle tient la
 * règle dure §1.2 sans qu'on ait à la corriger. Ce qui se compte est la RÉACTION —
 * « 31 trouvent utile », « 2 confirment » — un jugement donné volontairement, et non
 * une mesure d'attention subie.
 *
 * Le fond est sombre (`#101A17`) : une story se lit comme une photo, pas comme une
 * page. C'est la maquette qui le fixe, sur ses deux cadres.
 */
export default function StoryPage() {
  const data = accueilData();
  return (
    <ScreenFrames
      screen="A13"
      background="#101A17"
      desktop={<A13Desktop {...data} />}
      mobile={<A13Mobile {...data} />}
    />
  );
}
