'use client';

import { EcranParcours, useParcours } from '@/screens/parcours/ecran';
import { plancheBlocage, plancheJalon } from '@/screens/parcours/modales';
import { J01SDesktop } from '@/screens/j01s/desktop.generated';
import { J01SMobile } from '@/screens/j01s/mobile.generated';

/**
 * J01S — l'étape en cours. `/parcours/:id/etapes/:etape`, comme la maquette
 * l'écrit sous sa planche.
 *
 * DEUX FENÊTRES S'OUVRENT D'ICI, et la seconde est une règle du dossier plutôt
 * qu'un choix d'écran :
 *
 *   · « Je suis bloqué·e » → J03, §3.5. Le bouton est dessiné deux fois sur
 *     ordinateur — carte du panneau et carte de l'étape — et les deux ouvrent
 *     la même feuille ;
 *   · « Marquer comme franchie » (mobile : « Franchie ») → J04, §3.6 : « à
 *     `step_completed` … proposition de partage » sur une étape majeure. Ce
 *     n'est PAS une publication : la proposition s'ouvre, le champ est vide, et
 *     rien ne part sans un appel explicite (§3.5, règle dure).
 *
 * Le franchissement lui-même — `PATCH /journeys/:id/steps/:stepId` — n'est pas
 * appelé : ce lot ne branche aucune route. C'est aussi pourquoi le moment
 * `journeyProgress` de `packages/config/motion.js` n'est pas encore employé :
 * aucune barre ne bouge tant qu'aucune étape ne change d'état.
 */
export default function Page() {
  const { ouverte, onOuvrir, onFermer, volet, data } = useParcours();

  return (
    <EcranParcours
      screen="J01S"
      desktop={<J01SDesktop {...data} />}
      mobile={<J01SMobile {...data} />}
      ouverte={ouverte}
      onOuvrir={onOuvrir}
      onFermer={onFermer}
      modales={{ J03: plancheBlocage(volet, data), J04: plancheJalon(data) }}
    />
  );
}
