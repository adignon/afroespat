'use client';

import type { ReactNode } from 'react';
import { ScreenFrames } from '@/screens/frames';
import { A12Desktop } from '@/screens/a12/desktop.generated';
import { A12Mobile } from '@/screens/a12/mobile.generated';
import { A12TBonsPlans } from '@/screens/a12t/bonsplans.generated';
import { A12TProduits } from '@/screens/a12t/produits.generated';
import { A12TTemoignages } from '@/screens/a12t/temoignages.generated';
import { A12TBonsPlansMobile } from '@/screens/a12t/bonsplansmobile.generated';
import { A12TProduitsMobile } from '@/screens/a12t/produitsmobile.generated';
import { A12TTemoignagesMobile } from '@/screens/a12t/temoignagesmobile.generated';
import { accueilData } from '@/screens/accueil/props';
import type { AccueilData } from '@/screens/accueil/data';

/**
 * A12 et ses quatre onglets. `/villes/:slug`
 *
 * Même arbitrage qu'en A08 : A12T n'est pas un écran mais la ZONE DE CONTENU de
 * cette fiche, dessinée une fois par onglet en 1036 px. Les quatre planches sont
 * donc des variantes d'état, montées sur cette route.
 *
 * « Budgets réels » est l'onglet que A12 dessine dans son cadre complet — c'est lui
 * qui garde le rail. Les trois autres remplacent le cadre, comme en A08, et le coût
 * est le même : voir le long commentaire de `/reseaux/[slug]/page.tsx`.
 */
const SLUGS = ['bons-plans', 'produits', 'budgets', 'temoignages'] as const;

type Tab = {
  readonly desktop: (d: AccueilData) => ReactNode;
  readonly mobile: (d: AccueilData) => ReactNode;
};

const TABS: Record<string, Tab> = {
  'bons-plans': {
    desktop: (d) => <A12TBonsPlans {...d} />,
    mobile: (d) => <A12TBonsPlansMobile {...d} />,
  },
  produits: {
    desktop: (d) => <A12TProduits {...d} />,
    mobile: (d) => <A12TProduitsMobile {...d} />,
  },
  // « Budgets réels » est l'onglet que A12 dessine dans son CADRE COMPLET, rail
  // compris : c'est lui qu'on rend, et A12T n'en porte donc pas de copie.
  budgets: { desktop: (d) => <A12Desktop {...d} />, mobile: (d) => <A12Mobile {...d} /> },
  temoignages: {
    desktop: (d) => <A12TTemoignages {...d} />,
    mobile: (d) => <A12TTemoignagesMobile {...d} />,
  },
};

/**
 * Les planches A12T de 1036 px portent leur propre mise en page dans le conteneur
 * que le générateur retire — `display: flex; flex-direction: column; gap: 14px`.
 * C'est l'espacement entre les cartes de l'onglet, et il vient de la maquette : il
 * est recopié ici, tel quel, plutôt que réinventé dans le JSX généré.
 *
 * `padding: 24px` et la bordure ne sont PAS repris : ils dessinent la planche de
 * documentation, pas l'écran.
 */
const BOARD: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
  width: '100%',
};

export function VilleScreen({ onglet }: { readonly onglet: string }) {
  const slug = onglet;
  const tab = TABS[slug] ?? TABS['budgets'];
  if (tab === undefined) return null;

  const index = SLUGS.indexOf(slug as (typeof SLUGS)[number]);
  const data = accueilData({ cityTab: index < 0 ? 2 : index });
  const plain = slug === 'budgets';

  return (
    <ScreenFrames
      screen={plain ? 'A12' : `A12T-${slug}`}
      desktop={plain ? tab.desktop(data) : <div style={BOARD}>{tab.desktop(data)}</div>}
      mobile={tab.mobile(data)}
    />
  );
}
