'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { Modal } from '@/components/modal';
import { notifySuccess } from '@/components/notifications';
import { A12CMobile } from '@/screens/a12c/mobile.generated';
import { A12CDesktop } from '@/screens/a12c/desktop.generated';
import { A12CDesktopProduit } from '@/screens/a12c/desktopproduit.generated';
import { A12CDesktopBudget } from '@/screens/a12c/desktopbudget.generated';
import { A12Desktop } from '@/screens/a12/desktop.generated';
import { A12Mobile } from '@/screens/a12/mobile.generated';
import { A12TBonsPlans } from '@/screens/a12t/bonsplans.generated';
import { A12TProduits } from '@/screens/a12t/produits.generated';
import { A12TTemoignages } from '@/screens/a12t/temoignages.generated';
import { A12TBonsPlansMobile } from '@/screens/a12t/bonsplansmobile.generated';
import { A12TProduitsMobile } from '@/screens/a12t/produitsmobile.generated';
import { A12TTemoignagesMobile } from '@/screens/a12t/temoignagesmobile.generated';
import type { VoletContribution } from '@/screens/accueil/data';
import {
  SQUELETTE_VILLE,
  chargerVille,
  type OngletVille,
  type VilleBase,
} from '@/screens/villes/appels';
import type { TypeContribution, VilleData } from '@/screens/villes/data';
import { useContribution, useGestesVille } from '@/screens/villes/use-ville';

/**
 * A12 et ses quatre onglets. `/villes/:slug`
 *
 * Même arbitrage qu'en A08 : A12T n'est pas un écran mais la ZONE DE CONTENU de
 * cette fiche, dessinée une fois par onglet en 1036 px. Les quatre planches sont
 * donc des variantes d'état, montées sur cette route. « Budgets réels » est
 * l'onglet que A12 dessine dans son cadre complet — c'est lui qui garde le rail.
 *
 * TOUT VIENT DE L'API : `GET /cities/:slug` (en-tête, pays, arrivants, événements,
 * médiane) et `GET /cities/:slug/tips?kind=` (la liste de l'onglet). Voir
 * `screens/villes/appels.ts`. La démonstration (`accueilData()`) n'est plus appelée.
 */
type Planche = {
  readonly desktop: (d: VilleData) => ReactNode;
  readonly mobile: (d: VilleData) => ReactNode;
};

const PLANCHES: Record<OngletVille, Planche> = {
  'bons-plans': {
    desktop: (d) => <A12TBonsPlans {...d} />,
    mobile: (d) => <A12TBonsPlansMobile {...d} />,
  },
  produits: {
    desktop: (d) => <A12TProduits {...d} />,
    mobile: (d) => <A12TProduitsMobile {...d} />,
  },
  budgets: { desktop: (d) => <A12Desktop {...d} />, mobile: (d) => <A12Mobile {...d} /> },
  temoignages: {
    desktop: (d) => <A12TTemoignages {...d} />,
    mobile: (d) => <A12TTemoignagesMobile {...d} />,
  },
};

/**
 * Les planches A12T de 1036 px portent leur propre mise en page dans le conteneur
 * que le générateur retire — `display: flex; flex-direction: column; gap: 14px`.
 * Recopié de la maquette, tel quel. `padding: 24px` et la bordure ne sont PAS repris.
 */
const BOARD: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
  width: '100%',
};

/** L'URL `?contribution=` ouvre la fenêtre sur un genre et une étape. */
const OUVERTURE: Record<VoletContribution, { type: TypeContribution; etape: 'type' | 'detail' }> = {
  type: { type: 'TIP', etape: 'type' },
  produit: { type: 'SHOP', etape: 'detail' },
  budget: { type: 'BUDGET', etape: 'detail' },
};

export function VilleScreen({
  slug,
  onglet,
  contribution = null,
}: {
  readonly slug: string;
  readonly onglet: OngletVille;
  readonly contribution?: VoletContribution | null;
}) {
  // Un geste réussi relit la fiche (compteurs, listes) sans vider l'écran.
  const [version, setVersion] = useState(0);
  const recharger = useCallback(() => {
    setVersion((n) => n + 1);
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` relance la lecture
  const charger = useCallback(() => chargerVille(slug, onglet), [slug, onglet, version]);

  return (
    <EcranDonnees
      charger={charger}
      attente="Chargement de la fiche…"
      /* LE CADRE EST SERVI AVANT LA DONNÉE : voir `SQUELETTE_VILLE`. */
      squelette={SQUELETTE_VILLE}
    >
      {(base) => (
        <FicheVille
          slug={slug}
          onglet={onglet}
          base={base}
          recharger={recharger}
          ouverture={contribution === null ? null : OUVERTURE[contribution]}
        />
      )}
    </EcranDonnees>
  );
}

function FicheVille({
  slug,
  onglet,
  base,
  recharger,
  ouverture,
}: {
  readonly slug: string;
  readonly onglet: OngletVille;
  readonly base: VilleBase;
  readonly recharger: () => void;
  readonly ouverture: { type: TypeContribution; etape: 'type' | 'detail' } | null;
}) {
  /**
   * La fenêtre s'ouvre au CLIC sur « Contribuer » (étape 1, le choix du genre) ou
   * DÈS L'ARRIVÉE quand l'URL nomme un volet. Le générateur pose
   * `data-modal-open="A12C"` sur les déclencheurs ; un seul écouteur suffit.
   */
  const [ouverte, setOuverte] = useState(ouverture !== null);

  const { gestes, fenetres } = useGestesVille(recharger);
  const surPublie = useCallback(() => {
    setOuverte(false);
    notifySuccess('Merci ! Votre contribution est publiée.');
    recharger();
  }, [recharger]);
  const formulaire = useContribution(slug, surPublie, ouverture);

  const onOuvrir = useCallback((event: React.MouseEvent<HTMLDivElement>): void => {
    const cible = event.target;
    if (!(cible instanceof Element)) return;
    const bouton = cible.closest('[data-modal-open]');
    if (bouton?.getAttribute('data-modal-open') === 'A12C') setOuverte(true);
  }, []);

  const onFermer = useCallback((): void => {
    setOuverte(false);
    formulaire.reinitialiser();
  }, [formulaire]);

  const data: VilleData = {
    ...base,
    vivant: {
      entete: base.ville,
      gestes,
      contribution: formulaire,
      videTips: '',
    },
  };

  const planche = PLANCHES[onglet];
  const complet = onglet === 'budgets';

  // Ordinateur : l'étape 1 choisit le genre ; l'étape 2 est celle du genre choisi.
  const etape2 = formulaire.type === 'BUDGET' ? (
    <A12CDesktopBudget {...data} />
  ) : (
    <A12CDesktopProduit {...data} />
  );

  return (
    <div onClick={onOuvrir}>
      <ScreenFrames
        screen={complet ? 'A12' : `A12T-${onglet}`}
        desktop={complet ? planche.desktop(data) : <div style={BOARD}>{planche.desktop(data)}</div>}
        mobile={planche.mobile(data)}
      />
      <Modal
        open={ouverte}
        onClose={onFermer}
        titleId="a12c-titre"
        name="A12C"
        /**
         * La maquette ne dessine qu'UNE feuille mobile, qui met le choix du genre ET
         * les champs sur la même vue (les champs suivent le genre : voir
         * `ChampsContribution`). Sur ordinateur, deux étapes.
         */
        desktop={formulaire.etape === 'type' ? <A12CDesktop {...data} /> : etape2}
        mobile={<A12CMobile {...data} />}
        phase={!ouverte || formulaire.etape === 'type' ? 0 : formulaire.type === 'BUDGET' ? 2 : 1}
      />
      {fenetres}
    </div>
  );
}
