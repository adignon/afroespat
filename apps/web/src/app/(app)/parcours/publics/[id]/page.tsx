'use client';

import { EcranParcours, useParcours } from '@/screens/parcours/ecran';
import { J09MobileFiche } from '@/screens/j09/mobilefiche.generated';

/**
 * `/parcours/publics/:id` — la vue publique d'un parcours (§3.7).
 *
 * UNE SEULE PLANCHE, et c'est un manque de la maquette, pas un choix : elle ne
 * dessine cette vue qu'en 390 px. On ne lui invente pas un cadre d'ordinateur —
 * la planche unique s'étire, comme `ScreenFrames` le fait déjà pour O05, qui n'a
 * pas non plus de cadre mobile. Consigné dans `docs/decisions.md`.
 *
 * RÈGLE DURE §3.7 : jamais le titre personnel. La maquette titre « Parcours de
 * Fatou » — le PRÉNOM du membre, pas le nom que Fatou a donné à son parcours —
 * et affiche « Parcours Études · Lyon ». Elle tient donc la règle, et le
 * transcodage la conserve puisqu'il ne réécrit rien. C'est aussi ce qu'éprouve
 * `e2e/parcours-public.spec.ts`.
 */
export default function Page() {
  const { ouverte, onOuvrir, onFermer, data } = useParcours();

  return (
    <EcranParcours
      screen="J09F"
      desktop={<J09MobileFiche {...data} />}
      ouverte={ouverte}
      onOuvrir={onOuvrir}
      onFermer={onFermer}
    />
  );
}
