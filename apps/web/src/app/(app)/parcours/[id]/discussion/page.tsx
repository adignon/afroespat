'use client';

import { EcranParcours, useParcours } from '@/screens/parcours/ecran';
import { plancheBlocage } from '@/screens/parcours/modales';
import { J01DDesktop } from '@/screens/j01d/desktop.generated';
import { J01DMobile } from '@/screens/j01d/mobile.generated';

/**
 * J01D — la discussion du parcours. `/parcours/:id/discussion`.
 *
 * §3.4 : la discussion n'est PAS visible d'un observateur — « OBSERVER : voir
 * les étapes et leur état, la progression ; ne peut pas commenter, voir les
 * notes, la checklist, la discussion ». Le filtrage est côté serveur (`403` sur
 * `GET /journeys/:id` pour qui n'est ni propriétaire ni membre) ; cet écran ne
 * décide de rien, il affiche la planche.
 */
export default function Page() {
  const { ouverte, onOuvrir, onFermer, volet, data } = useParcours();

  return (
    <EcranParcours
      screen="J01D"
      desktop={<J01DDesktop {...data} />}
      mobile={<J01DMobile {...data} />}
      ouverte={ouverte}
      onOuvrir={onOuvrir}
      onFermer={onFermer}
      modales={{ J03: plancheBlocage(volet, data) }}
    />
  );
}
