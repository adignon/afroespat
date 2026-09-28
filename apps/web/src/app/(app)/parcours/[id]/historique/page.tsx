'use client';

import { EcranParcours, useParcours } from '@/screens/parcours/ecran';
import { plancheBlocage } from '@/screens/parcours/modales';
import { J07Desktop } from '@/screens/j07/desktop.generated';
import { J07Mobile } from '@/screens/j07/mobile.generated';
import { J07MobileExport } from '@/screens/j07export/mobileexport.generated';

/**
 * J07 — le journal du parcours. `/parcours/:id/historique`.
 *
 * §3.8 : `journey_activities` en chronologie inversée. L'export PDF est réservé
 * à Premium (T5 J07) — la maquette dessine « Exporter en PDF » sur ordinateur et
 * un encart « Export PDF réservé à Premium. » avec un lien « Découvrir » sur
 * mobile. Les deux ouvrent la même feuille.
 */
export default function Page() {
  const { ouverte, onOuvrir, onFermer, volet, data } = useParcours();

  return (
    <EcranParcours
      screen="J07"
      desktop={<J07Desktop {...data} />}
      mobile={<J07Mobile {...data} />}
      ouverte={ouverte}
      onOuvrir={onOuvrir}
      onFermer={onFermer}
      modales={{
        J03: plancheBlocage(volet, data),
        J07X: { mobile: <J07MobileExport {...data} /> },
      }}
    />
  );
}
