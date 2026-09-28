'use client';

import { EcranParcours, useParcours } from '@/screens/parcours/ecran';
import { plancheBlocage } from '@/screens/parcours/modales';
import { J11Desktop } from '@/screens/j11/desktop.generated';
import { J11Mobile } from '@/screens/j11/mobile.generated';
import { J11MobileVide } from '@/screens/j11/mobilevide.generated';
import { J01EDesktopVide } from '@/screens/j01e/desktopvide.generated';

/**
 * J11 — « Mes parcours ». `/parcours`.
 *
 * §3.1 : « un seul parcours ACTIVE ou PAUSED en gratuit ». La maquette affiche
 * l'encart « 1 parcours actif sur 1 avec le plan gratuit » sans rien bloquer, et
 * range les parcours aboutis dans une section à part — §3.9 : « un parcours
 * terminé ne compte plus dans la limite du plan gratuit ».
 *
 * L'ÉTAT VIDE EMPRUNTE SON CADRE D'ORDINATEUR À J01E, et il faut le dire : la
 * maquette ne dessine « aucun parcours » en 1440 px qu'UNE FOIS, sous J01E
 * (« ORDINATEUR · AUCUN PARCOURS »). C'est la même chose — la section Parcours
 * quand le membre n'en a aucun — dessinée une seule fois. Reprendre cette
 * planche est donc encore du transcodage ; en dessiner une seconde serait
 * réécrire la maquette.
 */
export function MesParcoursEcran({ vide }: { readonly vide: boolean }) {
  const { ouverte, onOuvrir, onFermer, volet, data } = useParcours();

  return (
    <EcranParcours
      screen="J11"
      desktop={vide ? <J01EDesktopVide {...data} /> : <J11Desktop {...data} />}
      mobile={vide ? <J11MobileVide {...data} /> : <J11Mobile {...data} />}
      ouverte={ouverte}
      onOuvrir={onOuvrir}
      onFermer={onFermer}
      modales={{ J03: plancheBlocage(volet, data) }}
    />
  );
}
