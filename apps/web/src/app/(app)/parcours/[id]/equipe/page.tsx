'use client';

import { EcranParcours, useParcours } from '@/screens/parcours/ecran';
import { useContexteParcours } from '@/screens/parcours/use-parcours-api';
import { plancheBlocage } from '@/screens/parcours/modales';
import { J05Desktop } from '@/screens/j05/desktop.generated';
import { J05Mobile } from '@/screens/j05/mobile.generated';
import { J05MobileInvitation } from '@/screens/j05invitation/mobileinvitation.generated';

/**
 * J05 — l'équipe du parcours. `/parcours/:id/equipe`.
 *
 * §3.4 : deux rôles seulement, `OBSERVER` et `SUPPORTER`, dix membres au plus,
 * et « le co-porteur n'existe pas en V1 ». La maquette s'y tient — elle nomme
 * « Observateur » et « Accompagnant », et explique ce que chacun peut faire.
 *
 * La feuille d'invitation n'a PAS de planche d'ordinateur : la maquette ne la
 * dessine qu'en mobile. Elle sert donc aux deux largeurs (voir `Modal`), et le
 * manque est consigné dans `docs/decisions.md`.
 */
export default function Page() {
  const { ouverte, onOuvrir, onFermer, volet, data, erreur, niveauRequis, oublierNiveauRequis } = useParcours(null, useContexteParcours());

  return (
    <EcranParcours
      screen="J05"
      desktop={<J05Desktop {...data} />}
      mobile={<J05Mobile {...data} />}
      ouverte={ouverte}
      onOuvrir={onOuvrir}
      onFermer={onFermer}
      modales={{
        J03: plancheBlocage(volet, data),
        J05I: { mobile: <J05MobileInvitation {...data} /> },
      }}
      erreur={erreur}
      niveauRequis={niveauRequis}
      oublierNiveauRequis={oublierNiveauRequis}
    />
  );
}
