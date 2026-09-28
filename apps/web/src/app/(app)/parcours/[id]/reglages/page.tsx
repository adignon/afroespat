'use client';

import { EcranParcours, useParcours } from '@/screens/parcours/ecran';
import { plancheBlocage } from '@/screens/parcours/modales';
import { J08Desktop } from '@/screens/j08/desktop.generated';
import { J08Mobile } from '@/screens/j08/mobile.generated';
import { J08MobileArret } from '@/screens/j08arret/mobilearret.generated';

/**
 * J08 — les réglages du parcours. `/parcours/:id/reglages`.
 *
 * §3.7 : la visibilité en TROIS choix, avec « l'explication exacte de ce qui est
 * visible et invisible en public ». La maquette écrit cette phrase, et elle est
 * transcodée telle quelle : « Ils verront vos étapes franchies et leur durée.
 * Jamais vos notes, vos documents, votre équipe ni votre discussion. »
 *
 * §3.9 : l'arrêt se confirme « sans vocabulaire d'échec ». La confirmation est
 * une FEUILLE sur mobile et une carte DANS LA PAGE sur ordinateur — la planche
 * de 1440 px la dessine en ligne, avec ses boutons Garder et Arrêter. D'où
 * `mobileOnly` : on ne superpose pas une fenêtre à une carte qui dit déjà la
 * même chose.
 */
export default function Page() {
  const { ouverte, onOuvrir, onFermer, volet, data } = useParcours();

  return (
    <EcranParcours
      screen="J08"
      desktop={<J08Desktop {...data} />}
      mobile={<J08Mobile {...data} />}
      ouverte={ouverte}
      onOuvrir={onOuvrir}
      onFermer={onFermer}
      modales={{
        J03: plancheBlocage(volet, data),
        J08A: { mobile: <J08MobileArret {...data} />, mobileOnly: true },
      }}
    />
  );
}
