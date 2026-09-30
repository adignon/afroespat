'use client';

import { EcranParcours, useParcours } from '@/screens/parcours/ecran';
import { CODE_REGULARISER } from '@/screens/parcours/use-parcours-api';
import { plancheBlocage } from '@/screens/parcours/modales';
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

export function NouveauEcran({ etape }: { readonly etape: EtapeCreation }) {
  /**
   * « CONTINUER » DE LA VARIANTE RÉGULARISER CRÉE LE PARCOURS (§3.1, T5).
   *
   * C'est le seul bouton de J02 que le générateur branche : la maquette dessine
   * bien « Créer le parcours » sur la planche des types, mais ce libellé n'est pas
   * dans les actions que le transcodeur reconnaît, donc aucun `onClick` n'y est
   * posé. Et les quatre cartes de type sont des `<div>`, pas des boutons.
   *
   * Le code du modèle n'est donné QUE sur cette variante. Sur la planche des
   * types, « Continuer » n'existe pas ; sur celle du plan atteint, créer serait
   * absurde — c'est précisément l'écran qui dit que la limite est atteinte.
   *
   * Un CODE et non un identifiant : `journey_templates.code` est le contrat, un
   * identifiant est propre à une base. Coder l'identifiant en dur aurait marché en
   * développement et créé un parcours inexistant en production.
   */
  const { ouverte, onOuvrir, onFermer, volet, data, erreur, niveauRequis, oublierNiveauRequis } =
    useParcours(null, etape === 'regulariser' ? { creerCode: CODE_REGULARISER } : {});

  const mobile =
    etape === 'regulariser' ? (
      <J02MobileRegulariser {...data} />
    ) : etape === 'plan' ? (
      <J02MobilePlanAtteint {...data} />
    ) : (
      <J02Mobile {...data} />
    );

  return (
    <EcranParcours
      screen="J02"
      desktop={<J02Desktop {...data} />}
      mobile={mobile}
      ouverte={ouverte}
      onOuvrir={onOuvrir}
      onFermer={onFermer}
      modales={{ J03: plancheBlocage(volet, data) }}
      erreur={erreur}
      niveauRequis={niveauRequis}
      oublierNiveauRequis={oublierNiveauRequis}
    />
  );
}
