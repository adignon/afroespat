'use client';

import { useMemo } from 'react';
import { VUE_NEUTRE, chargerJ02 } from '@/screens/parcours/appels';
import { EcranParcoursDonnees } from '@/screens/parcours/ecran-donnees';
import { CODE_REGULARISER } from '@/screens/parcours/use-parcours-api';
import { J02Desktop } from '@/screens/j02/desktop.generated';
import { J02Mobile } from '@/screens/j02/mobile.generated';
import { J02MobileRegulariser } from '@/screens/j02/mobileregulariser.generated';
import { J02MobilePlanAtteint } from '@/screens/j02/mobileplanatteint.generated';

/**
 * J02 — créer un parcours. `/parcours/nouveau`.
 *
 * TROIS PLANCHES MOBILES pour une seule planche d'ordinateur, et c'est la
 * maquette qui en décide :
 *
 *   · `type`         — les quatre types, le nom proposé, la date cible ;
 *   · `regulariser`  — §3.1 et T5 : « variante Régulariser : choix entre
 *                      régularisation / changement de statut / renouvellement » ;
 *   · `plan`         — §3.1, `PLAN_LIMIT_REACHED` : « encart "Vous avez déjà un
 *                      parcours actif" avec bouton Premium, SANS BLOQUER LA
 *                      LECTURE ». La planche le respecte : les types restent
 *                      lisibles sous l'encart.
 *
 * Le cadre d'ordinateur ne change pas d'un état à l'autre : la maquette n'en
 * dessine qu'un. On n'en invente pas deux autres.
 */
export type EtapeCreation = 'type' | 'regulariser' | 'plan';

/**
 * ── CET ÉCRAN LIT MAINTENANT SES DONNÉES, et ce n'était pas le cas ──────────
 *
 * Il appelait `useParcours` seul, c'est-à-dire des GESTES sans lecture : ses
 * quatre cadres recevaient `ParcoursData` — quatre fonctions — et écrivaient
 * « Étudier · 12 étapes » en dur. Le commentaire de `journeyTemplateVersionSchema`
 * mesure exactement ce que ça coûte : l'API répond 15 pour `STUDIES`, et
 * « recopier le nombre de la maquette afficherait un engagement faux au moment
 * précis où le membre choisit son parcours ».
 *
 * `EcranParcoursDonnees` fusionne les gestes et la donnée, comme pour les onze
 * autres écrans du module : `chargerJ02` est une fonction de MODULE, donc une
 * référence stable — `useDonnees` a `charger` dans ses dépendances, exprès, et une
 * fonction anonyme y bouclerait.
 *
 * LE CONTEXTE DÉPEND DE L'ÉTAPE, et il doit rester le même objet d'un rendu à
 * l'autre pour la même étape : `useMemo` plutôt qu'un littéral écrit en ligne.
 */
export function NouveauEcran({ etape }: { readonly etape: EtapeCreation }) {
  /**
   * « CONTINUER » DE LA VARIANTE RÉGULARISER CRÉE LE PARCOURS (§3.1, T5).
   *
   * C'est le seul bouton de J02 que le générateur branche : la maquette dessine
   * bien « Créer le parcours » sur la planche des types, mais ce libellé n'est pas
   * dans les actions que le transcodeur reconnaît, donc aucun `onClick` n'y est
   * posé. Et les quatre cartes de type sont des `<div>`, pas des boutons — c'est
   * aussi pourquoi `modeles[i].choisi` reproduit le choix que la maquette montre
   * et ne suit aucun clic : il n'y en a pas à suivre.
   *
   * Le code du modèle n'est donné QUE sur cette variante. Sur la planche des
   * types, « Continuer » n'existe pas ; sur celle du plan atteint, créer serait
   * absurde — c'est précisément l'écran qui dit que la limite est atteinte.
   *
   * Un CODE et non un identifiant : `journey_templates.code` est le contrat, un
   * identifiant est propre à une base. Coder l'identifiant en dur aurait marché en
   * développement et créé un parcours inexistant en production.
   */
  const contexte = useMemo(
    () => (etape === 'regulariser' ? { creerCode: CODE_REGULARISER } : {}),
    [etape],
  );

  return (
    <EcranParcoursDonnees
      /*
       * LE CADRE EST SERVI AVANT LA DONNEE. `VUE_NEUTRE` est le DESSIN sans la
       * donnee, et il existait deja pour les planches d'illustration : rien n'est
       * invente ici. Sans lui, cette route repond 200 en servant « DisaporyPlus
       * Chargement de votre parcours... » et RIEN d'autre — ni rail, ni panneau,
       * ni barre basse. Voir `screens/compte/ecran-donnees.tsx`.
       */
      /*
       * J02 ATTEND UN TYPE PLUS RICHE, et `tsc` l'a dit : ses modeles sont des
       * `ModeleProposé` (avec `choisi` et `autre`), pas les `ModeleAffiche` de
       * `VUE_NEUTRE`. La liste vide suffit — un ecran qui n'a pas encore ses
       * modeles n'en propose aucun — et le type redevient juste.
       */
      squelette={{ ...VUE_NEUTRE, modeles: [] }}
      screen="J02"
      charger={chargerJ02}
      contexte={contexte}
      desktop={(d) => <J02Desktop {...d} />}
      mobile={(d) =>
        etape === 'regulariser' ? (
          <J02MobileRegulariser {...d} />
        ) : etape === 'plan' ? (
          <J02MobilePlanAtteint {...d} />
        ) : (
          <J02Mobile {...d} />
        )
      }
    />
  );
}
