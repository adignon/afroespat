'use client';

import { useCallback } from 'react';
import { chargerMesParcours } from '@/screens/parcours/appels';
import { EcranParcoursDonnees } from '@/screens/parcours/ecran-donnees';
import { plancheBlocage } from '@/screens/parcours/modales';
import { J11Desktop } from '@/screens/j11/desktop.generated';
import { J11Mobile } from '@/screens/j11/mobile.generated';
import { J11MobileVide } from '@/screens/j11/mobilevide.generated';
import { J01EDesktopVide } from '@/screens/j01e/desktopvide.generated';

/**
 * J11 — « Mes parcours ». `/parcours`.
 *
 * BRANCHÉ SUR `GET /journeys` (§5.1) — LA FORME DE LA LISTE, et pas celle du
 * détail : `currentStep { id, title }`, `stepCount`, `isOwner`, `memberCount`,
 * `lastActivityAt`. Réutiliser le schéma du détail ici lèverait sur toute réponse
 * NON VIDE, et ne se verrait pas sur une liste vide.
 *
 * ── LA LIMITE DU PLAN EST AFFICHÉE, JAMAIS APPLIQUÉE ICI ───────────────────
 *
 * §3.1 : « un seul parcours ACTIVE ou PAUSED en gratuit ». La maquette affiche
 * l'encart « 1 parcours actif sur 1 avec le plan gratuit » SANS RIEN BLOQUER, et
 * range les parcours aboutis dans une section à part — §3.9 : « un parcours terminé
 * ne compte plus dans la limite du plan gratuit ».
 *
 * Le dénominateur vient de `JOURNEY_FREE_ACTIVE_LIMIT` dans `@app/shared`, la MÊME
 * constante que le serveur applique avant de répondre `422 PLAN_LIMIT_REACHED`.
 * L'écrire à la main ici aurait divergé le jour où le plan change, et l'écran
 * aurait annoncé une limite que le serveur n'applique plus. Et le numérateur ne
 * compte que MES parcours actifs ou en pause : un parcours dont je suis
 * accompagnant ne compte pas, ce que `isOwner` permet de distinguer.
 *
 * L'ÉCRAN N'EMPÊCHE RIEN sur cette base. C'est la règle du socle, sans exception :
 * on tente la création, et c'est le refus du serveur qui décide. Afficher la limite
 * est de l'information, pas de l'autorisation.
 *
 * ── L'ÉTAT VIDE EMPRUNTE SON CADRE D'ORDINATEUR À J01E ─────────────────────
 *
 * Il faut le dire : la maquette ne dessine « aucun parcours » en 1440 px qu'UNE
 * FOIS, sous J01E (« ORDINATEUR · AUCUN PARCOURS »). C'est la même chose — la
 * section Parcours quand le membre n'en a aucun — dessinée une seule fois.
 * Reprendre cette planche est donc encore du transcodage ; en dessiner une seconde
 * serait réécrire la maquette.
 *
 * Cette planche-là LIT `GET /journey-templates` (§2.1), et son nombre d'étapes vient
 * de `version.stepCount` : la maquette écrit « Étudier · 12 étapes », l'API répond
 * 15 pour `STUDIES` version 3. Le cadre MOBILE de l'état vide, lui, ne lit rien —
 * c'est le propre d'un état vide.
 */
export function MesParcoursEcran({ vide }: { readonly vide: boolean }) {
  /**
   * MÉMOÏSÉ SUR L'ÉTAT, et `vide` doit vraiment entrer dans les dépendances :
   * passer de `/parcours` à `/parcours?etat=vide` change ce qu'il y a à lire. Une
   * fonction anonyme, elle, rechargerait en boucle — `useDonnees` a `charger` dans
   * ses dépendances, exprès.
   */
  const charger = useCallback(() => chargerMesParcours(vide), [vide]);

  return (
    <EcranParcoursDonnees
      screen="J11"
      charger={charger}
      desktop={(d) => (vide ? <J01EDesktopVide {...d} /> : <J11Desktop {...d} />)}
      mobile={(d) => (vide ? <J11MobileVide {...d} /> : <J11Mobile {...d} />)}
      modales={(d, volet) => ({ J03: plancheBlocage(volet, d) })}
    />
  );
}
