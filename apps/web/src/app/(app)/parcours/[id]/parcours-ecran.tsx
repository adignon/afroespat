'use client';

import { useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { VUE_NEUTRE, chargerEcranParcours } from '@/screens/parcours/appels';
import { EcranParcoursDonnees } from '@/screens/parcours/ecran-donnees';
import { ouvrirFeuille } from '@/components/parcours/feuilles-store';
import { useContexteParcours } from '@/screens/parcours/use-parcours-api';
import { J01Desktop } from '@/screens/j01/desktop.generated';
import { J01Mobile } from '@/screens/j01/mobile.generated';
import { J01MobileEdition } from '@/screens/j01/mobileedition.generated';
import { J01MDesktop } from '@/screens/j01m/desktop.generated';
import { J01EDesktopVide } from '@/screens/j01e/desktopvide.generated';
import { J01EMobileVide } from '@/screens/j01e/mobilevide.generated';
import { J01EDesktopAbouti } from '@/screens/j01e/desktopabouti.generated';
import { J01EMobileAbouti } from '@/screens/j01e/mobileabouti.generated';

/**
 * J01 — la page d'un parcours, et les cinq états que la maquette lui dessine.
 *
 * `/parcours/:id` · T5 §5. Le JSX vient du TRANSCODAGE de
 * `docs/template/04 Parcours.dc.html` : les styles en ligne sont ceux de la
 * maquette, à l'identique. Rien n'est réécrit — et rien ne l'a été pour brancher
 * l'API : les valeurs affichées sont devenues des interpolations par une
 * DÉCLARATION dans `tools/screens/04-parcours.mjs`, sous la clé `donnees`.
 *
 * CINQ PLANCHES POUR UNE ROUTE, parce que la maquette dessine chaque état :
 *
 *   · `normal`   J01   — la vue d'ensemble, frise et étape en cours ;
 *   · `vide`     J01E  — « aucun parcours » (§6, « états communs ») ;
 *   · `abouti`   J01E  — « un parcours abouti, aucun actif » (§3.9) ;
 *   · `parcours` J01M  — le sélecteur ouvert. DEUX FORMES DIFFÉRENTES : page
 *                        complète sur ordinateur, où il se déplie dans la carte
 *                        du panneau ; feuille du bas sur mobile. D'où
 *                        `mobileOnly` sur la feuille — la superposer au grand
 *                        écran afficherait deux fois la liste des parcours ;
 *   · `edition`  J01   — « Modifier les étapes », MOBILE SEULEMENT : la maquette
 *                        dessine sur ordinateur un bouton « Modifier les étapes »
 *                        sans planche d'arrivée. On garde donc la vue d'ensemble
 *                        sur ordinateur plutôt que d'inventer l'écran manquant.
 *
 * ── UN SEUL CHARGEUR POUR CINQ ÉTATS, ET POURQUOI ──────────────────────────
 *
 * Les cinq planches n'attendent pas la même prise — J01 veut l'équipe et la frise,
 * J01E vide veut les TYPES de parcours, J01M veut la liste de MES parcours. Or le
 * générateur attache un `dataType` par ÉCRAN et non par cadre : une seule forme
 * doit donc satisfaire les cinq. `chargerEcranParcours` la rend, et n'appelle que
 * ce que l'état demande — les types ne sont demandés que pour `vide`, la liste que
 * pour `parcours`.
 *
 * ── LE SEGMENT DOIT ÊTRE UN IDENTIFIANT ────────────────────────────────────
 *
 * `/parcours/1` est l'URL des planches d'illustration. `chargerEcranParcours`
 * n'appelle rien quand le segment n'est pas un UUID : l'écran reste INERTE, ses
 * données vides, et aucune bannière d'erreur n'apparaît pour avoir ouvert une
 * démonstration.
 *
 * ── CE QUI RESTE INERTE, ET CE QUE CELA TIENT ──────────────────────────────
 *
 * « Modifier les étapes » ne réordonne rien (`PUT /journeys/:id/steps/order` n'a
 * aucune prise), et le cadre `MobileEdition` est le seul de cet écran à ne lire
 * aucune donnée : sa planche montre un GLISSEMENT EN COURS
 * (`transform:rotate(-1.2deg)`), qui est un état d'interaction et non une donnée.
 *
 * « Publier » (J03, troisième volet) et « Partager » (J04) NE PORTENT TOUJOURS
 * AUCUN `onClick` : le générateur ne reconnaît pas ces libellés, et ce lot n'y a
 * pas touché. La règle dure de §3.5 — « le brouillon n'est jamais promu sans cet
 * appel » — reste donc tenue PAR ABSENCE DE PRISE, et non par conception. C'est un
 * état de fait à connaître, pas une garantie sur laquelle se reposer.
 */
export type EtatParcours = 'normal' | 'vide' | 'abouti' | 'parcours' | 'edition';

export function ParcoursEcran({ etat }: { readonly etat: EtatParcours }) {
  const params = useParams<{ id?: string }>();
  const journeyId = typeof params.id === 'string' ? params.id : '';
  const contexte = useContexteParcours();
  const charger = useCallback(() => chargerEcranParcours(journeyId, etat), [journeyId, etat]);

  // `?etat=parcours` ouvre le sélecteur « Mes parcours » dès l'arrivée (J01M).
  useEffect(() => {
    if (etat === 'parcours') ouvrirFeuille('selecteur');
  }, [etat]);

  return (
    <EcranParcoursDonnees
      /*
       * LE CADRE EST SERVI AVANT LA DONNEE. `VUE_NEUTRE` est le DESSIN sans la
       * donnee, et il existait deja pour les planches d'illustration : rien n'est
       * invente ici. Sans lui, cette route repond 200 en servant « DisaporyPlus
       * Chargement de votre parcours... » et RIEN d'autre — ni rail, ni panneau,
       * ni barre basse. Voir `screens/compte/ecran-donnees.tsx`.
       */
      squelette={VUE_NEUTRE}
      screen="J01"
      charger={charger}
      contexte={contexte}
      /**
       * La feuille du sélecteur est ouverte DÈS L'ARRIVÉE quand l'URL le demande.
       *
       * La planche mobile de J01 ne dessine AUCUN sélecteur à cliquer — celui
       * qu'on voit dans la planche J01M appartient au décor, c'est-à-dire à
       * l'écran de dessous, que le transcodeur retire. Inventer ce contrôle serait
       * réécrire la maquette ; laisser l'état inatteignable serait livrer une
       * planche morte.
       */
      desktop={(d) =>
        etat === 'vide' ? (
          <J01EDesktopVide {...d} />
        ) : etat === 'abouti' ? (
          <J01EDesktopAbouti {...d} />
        ) : etat === 'parcours' ? (
          <J01MDesktop {...d} />
        ) : (
          <J01Desktop {...d} />
        )
      }
      mobile={(d) =>
        etat === 'vide' ? (
          <J01EMobileVide {...d} />
        ) : etat === 'abouti' ? (
          <J01EMobileAbouti {...d} />
        ) : etat === 'edition' ? (
          <J01MobileEdition {...d} />
        ) : (
          <J01Mobile {...d} />
        )
      }
    />
  );
}
