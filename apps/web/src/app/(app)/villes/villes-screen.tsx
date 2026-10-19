'use client';

import { ScreenFrames } from '@/screens/frames';
import { A11Desktop } from '@/screens/a11/desktop.generated';
import { A11Mobile } from '@/screens/a11/mobile.generated';
import { A11MobileCarte } from '@/screens/a11/mobilecarte.generated';
import { panelVilles, rail, shortcuts } from '@/screens/accueil/data';
import type { VillesData, VueVilles } from '@/screens/villes/data';
import { useVilles } from '@/screens/villes/use-villes';

/**
 * A11 — Villes et Membres. `/villes`
 *
 * « Carte (ordinateur) et Annuaire (mobile) », écrit la maquette : la carte est la vue
 * par défaut sur ordinateur, l'annuaire sur téléphone. `?vue=carte|annuaire` impose
 * la même vue aux deux largeurs ; `?pays=<id>` filtre la carte (les compteurs sont
 * recalculés PAR LE SERVEUR, avec le seuil de 3 : 09 §2.1) et l'annuaire.
 *
 * Tout ce que l'écran affiche vient de `GET /cities/map` et `GET /members` (voir
 * `useVilles`). Il n'y a plus de démonstration : `accueilData()` n'est plus appelée,
 * et la carte est un SVG local, sans aucune requête vers un service de cartes.
 *
 * La fenêtre « Saluer » est rendue UNE fois, ici : `ScreenFrames` monte les deux
 * cadres et une fenêtre posée dans un cadre s'ouvrirait en double.
 */
export function VillesScreen({
  vue,
  pays,
}: {
  readonly vue: VueVilles | null;
  readonly pays: string;
}) {
  const { vivant, vueMobile, fenetre } = useVilles({
    vueDemandee: vue,
    pays,
    hrefVue: (v, p) => `/villes?vue=${v}${p === '' ? '' : `&pays=${encodeURIComponent(p)}`}`,
  });

  const data: VillesData = {
    rail,
    panelVilles,
    shortcuts,
    dirFilters: vivant.filtres,
    directory: vivant.annuaire,
    vivant,
  };

  return (
    <>
      <ScreenFrames
        screen={vue === 'carte' ? 'A11-carte' : 'A11'}
        desktop={<A11Desktop {...data} />}
        mobile={vueMobile === 'carte' ? <A11MobileCarte {...data} /> : <A11Mobile {...data} />}
      />
      {fenetre}
    </>
  );
}
