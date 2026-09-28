'use client';

import { EcranParcours, useParcours } from '@/screens/parcours/ecran';
import { plancheBlocage } from '@/screens/parcours/modales';
import { J09Desktop } from '@/screens/j09/desktop.generated';
import { J09Mobile } from '@/screens/j09/mobile.generated';

/**
 * J09 — les parcours publics. `/parcours/publics` (§3.7).
 *
 * RÈGLE DURE : la vue publique ne contient NI titre personnel, NI notes, NI
 * checklist, NI équipe, NI discussion. La maquette le dit à l'écran — « Lecture
 * seule · aucune note, checklist, équipe ni discussion » — et c'est le serveur
 * qui la tient : `GET /journeys/public/:id` ne renvoie que les champs de §3.7.
 * Cet écran n'a donc rien à filtrer ; il n'a jamais les champs en main.
 *
 * De même, « un parcours en pause ou arrêté n'apparaît jamais comme public » est
 * une exclusion de requête, pas un masquage d'affichage.
 */
export default function Page() {
  const { ouverte, onOuvrir, onFermer, volet, data } = useParcours();

  return (
    <EcranParcours
      screen="J09"
      desktop={<J09Desktop {...data} />}
      mobile={<J09Mobile {...data} />}
      ouverte={ouverte}
      onOuvrir={onOuvrir}
      onFermer={onFermer}
      modales={{ J03: plancheBlocage(volet, data) }}
    />
  );
}
