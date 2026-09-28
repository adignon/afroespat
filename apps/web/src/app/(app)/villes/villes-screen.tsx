'use client';

import { ScreenFrames } from '@/screens/frames';
import { A11Desktop } from '@/screens/a11/desktop.generated';
import { A11Mobile } from '@/screens/a11/mobile.generated';
import { A11MobileCarte } from '@/screens/a11/mobilecarte.generated';
import { accueilData } from '@/screens/accueil/props';

/**
 * A11 — Villes et Membres. `/villes`
 *
 * « Carte (ordinateur) et Annuaire (mobile) », écrit la maquette. Le cadre mobile de
 * la section est donc l'ANNUAIRE, et la carte mobile vit dans la dernière planche de
 * « Versions mobiles réseau et ville » (MOB2). Sur ordinateur la carte est toujours
 * là : les deux vues ne diffèrent que sous 1024 px.
 *
 * SEUIL DE CONFIDENTIALITÉ (§9) : `cities.member_count` ne se rend pas sous trois
 * membres. Les sept villes dessinées vont de 190 à 2 100, aucune n'en approche — la
 * maquette ne montre donc pas ce cas, et il n'y a rien à masquer ici. La règle
 * s'appliquera à la requête du lot 3.
 */
export function VillesScreen({ carte }: { readonly carte: boolean }) {
  const data = accueilData();

  return (
    <ScreenFrames
      screen={carte ? 'A11-carte' : 'A11'}
      desktop={<A11Desktop {...data} />}
      mobile={carte ? <A11MobileCarte {...data} /> : <A11Mobile {...data} />}
    />
  );
}
