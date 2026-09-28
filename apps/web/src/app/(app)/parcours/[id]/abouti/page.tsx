'use client';

import { EcranParcours, useParcours } from '@/screens/parcours/ecran';
import { J10Desktop } from '@/screens/j10/desktop.generated';
import { J10Mobile } from '@/screens/j10/mobile.generated';

/**
 * J10 — la fin de parcours. `/parcours/:id/abouti`, « plein écran calme ».
 *
 * §3.9 : « écran de félicitations, puis les trois propositions : devenir parrain
 * (si L2), écrire un guide à partir de l'étape la plus longue, organiser un
 * événement ». La maquette dessine les trois, et cette planche n'a ni rail ni
 * panneau — c'est la seule du module dans ce cas, et le générateur y pose donc
 * lui-même le repère `main`.
 *
 * Aucune fenêtre ne s'ouvre d'ici : la carte du panneau, et donc son bouton
 * « Je suis bloqué·e », n'existe pas sur cette planche. Un parcours abouti n'a
 * plus d'étape où l'on bute.
 */
export default function Page() {
  const { ouverte, onOuvrir, onFermer, data } = useParcours();

  return (
    <EcranParcours
      screen="J10"
      desktop={<J10Desktop {...data} />}
      mobile={<J10Mobile {...data} />}
      ouverte={ouverte}
      onOuvrir={onOuvrir}
      onFermer={onFermer}
    />
  );
}
