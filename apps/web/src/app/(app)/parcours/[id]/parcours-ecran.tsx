'use client';

import { EcranParcours, useParcours } from '@/screens/parcours/ecran';
import { useContexteParcours } from '@/screens/parcours/use-parcours-api';
import { plancheBlocage, plancheJalon } from '@/screens/parcours/modales';
import { J01Desktop } from '@/screens/j01/desktop.generated';
import { J01Mobile } from '@/screens/j01/mobile.generated';
import { J01MobileEdition } from '@/screens/j01/mobileedition.generated';
import { J01MDesktop } from '@/screens/j01m/desktop.generated';
import { J01MMobile } from '@/screens/j01mfeuille/mobile.generated';
import { J01EDesktopVide } from '@/screens/j01e/desktopvide.generated';
import { J01EMobileVide } from '@/screens/j01e/mobilevide.generated';
import { J01EDesktopAbouti } from '@/screens/j01e/desktopabouti.generated';
import { J01EMobileAbouti } from '@/screens/j01e/mobileabouti.generated';
import { J05MobileInvitation } from '@/screens/j05invitation/mobileinvitation.generated';

/**
 * J01 — la page d'un parcours, et les cinq états que la maquette lui dessine.
 *
 * `/parcours/:id` · T5 §5. Le JSX vient du TRANSCODAGE de
 * `docs/template/04 Parcours.dc.html` : les styles en ligne sont ceux de la
 * maquette, à l'identique. Rien n'est réécrit.
 *
 * CINQ PLANCHES POUR UNE ROUTE, parce que la maquette dessine chaque état :
 *
 *   · `normal`   J01   — la vue d'ensemble, timeline et étape en cours ;
 *   · `vide`     J01E  — « aucun parcours » (§6, « états communs ») ;
 *   · `abouti`   J01E  — « un parcours abouti, aucun actif » (§3.9) ;
 *   · `parcours` J01M  — le sélecteur ouvert. DEUX FORMES DIFFÉRENTES : page
 *                        complète sur ordinateur, où il se déplie dans la carte
 *                        du panneau ; feuille du bas sur mobile. D'où
 *                        `mobileOnly` sur la feuille — la superposer au grand
 *                        écran afficherait deux fois la liste des parcours ;
 *   · `edition`  J01   — « Modifier les étapes », MOBILE SEULEMENT : la maquette
 *                        dessine sur ordinateur un bouton « Modifier les
 *                        étapes » sans planche d'arrivée. On garde donc la vue
 *                        d'ensemble sur ordinateur plutôt que d'inventer
 *                        l'écran manquant.
 *
 * Le glisser-déposer des étapes que T5 décrit (« Maintenez et glissez pour
 * réordonner ») n'est PAS implémenté : il demande `PUT /journeys/:id/steps/order`
 * et une donnée d'étapes que la maquette n'expose pas. L'écran est transcodé, la
 * manipulation viendra avec l'API.
 */
export type EtatParcours = 'normal' | 'vide' | 'abouti' | 'parcours' | 'edition';

export function ParcoursEcran({ etat }: { readonly etat: EtatParcours }) {
  /**
   * La feuille du sélecteur est ouverte DÈS L'ARRIVÉE quand l'URL le demande.
   *
   * La planche mobile de J01 ne dessine AUCUN sélecteur à cliquer — celui qu'on
   * voit dans la planche J01M appartient au décor, c'est-à-dire à l'écran de
   * dessous, que le transcodeur retire. Inventer ce contrôle serait réécrire la
   * maquette ; laisser l'état inatteignable serait livrer une planche morte.
   */
  const { ouverte, onOuvrir, onFermer, volet, data, erreur, niveauRequis, oublierNiveauRequis } = useParcours(etat === 'parcours' ? 'J01M' : null, useContexteParcours());

  const desktop =
    etat === 'vide' ? (
      <J01EDesktopVide {...data} />
    ) : etat === 'abouti' ? (
      <J01EDesktopAbouti {...data} />
    ) : etat === 'parcours' ? (
      <J01MDesktop {...data} />
    ) : (
      <J01Desktop {...data} />
    );

  const mobile =
    etat === 'vide' ? (
      <J01EMobileVide {...data} />
    ) : etat === 'abouti' ? (
      <J01EMobileAbouti {...data} />
    ) : etat === 'edition' ? (
      <J01MobileEdition {...data} />
    ) : (
      <J01Mobile {...data} />
    );

  return (
    <EcranParcours
      screen="J01"
      desktop={desktop}
      mobile={mobile}
      ouverte={ouverte}
      onOuvrir={onOuvrir}
      onFermer={onFermer}
      modales={{
        J03: plancheBlocage(volet, data),
        J04: plancheJalon(data),
        // §3.4 — l'équipe s'invite depuis la colonne de droite de J01.
        J05I: { mobile: <J05MobileInvitation {...data} /> },
        J01M: { mobile: <J01MMobile {...data} />, mobileOnly: true },
      }}
      erreur={erreur}
      niveauRequis={niveauRequis}
      oublierNiveauRequis={oublierNiveauRequis}
    />
  );
}
