'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { hasAccessToken, resumeSession } from '@/lib/api/index';
import { BandeAttente, BandeEchec, useDonnees } from '@/screens/compte/ecran-donnees';
import { EcranParcours, useParcours, type PlancheModale } from './ecran';
import type { NomModale, ParcoursData } from './data';
import type { ContexteParcours } from './use-parcours-api';

/**
 * LA COQUILLE QUI CHARGE, POUR LES DOUZE ÉCRANS DE PARCOURS.
 *
 * ── CE QUI EST RÉEMPLOYÉ, ET CE QUI NE POUVAIT PAS L'ÊTRE ───────────────────
 *
 * `useDonnees` vient de `screens/compte/ecran-donnees.tsx`, à l'identique : c'est
 * le crochet éprouvé du module Compte, avec son garde de double montage (React
 * monte deux fois en développement) et sa dépendance `charger` assumée — un
 * appelant qui passerait une fonction anonyme boucle, et c'est une propriété qu'on
 * veut VISIBLE plutôt que masquée. Les onze pages de ce module passent donc une
 * fonction de MODULE (`chargerJ06`) ou un `useCallback` mémoïsé sur l'identifiant
 * de route.
 *
 * `EcranDonnees`, en revanche, n'a pas pu l'être tel quel, et pour deux raisons
 * qui sont dans son code et non dans une préférence :
 *
 *   1. il écrit « Chargement de votre compte… ». Afficher cela sur « Checklist de
 *      documents » serait un mensonge court mais un mensonge ;
 *   2. il rend `children(donnees)` et rien d'autre. Les écrans de parcours ont
 *      BESOIN de `EcranParcours` par-dessus — la bascule 1024 px, l'ouverture des
 *      fenêtres par `data-modal-open`, la bannière de refus et l'invitation de
 *      §7.3. Les imbriquer aurait demandé à chaque page de recâbler les six
 *      propriétés de `useParcours`, onze fois.
 *
 * ── LES DEUX ÉTATS QUE LA MAQUETTE NE DESSINE PAS ───────────────────────────
 *
 * `04 Parcours` NE DESSINE NI ATTENTE NI ÉCHEC : aucune de ses quarante-quatre
 * planches ne montre un squelette, un sablier ou un bandeau de chargement. Les
 * deux états ci-dessous sont donc la seule chose de ces écrans qui ne soit pas
 * transcodée, et il faut le dire — c'est la même exigence d'honnêteté que le `⚠`
 * du générateur pour un texte fourni par le porteur.
 *
 * Ils n'emploient QUE des jetons de la maquette : le fond `#F6F8F7` de
 * `ScreenFrames`, le gris de texte `#5D6B66` et le vert `#0F5C48` de ses liens.
 * Aucune couleur n'est assombrie. Et ils sont ANNONCÉS — `role="status"` pour
 * l'attente, `role="alert"` pour l'échec — parce qu'un écran qui change sans le
 * dire est un écran qu'un lecteur d'écran ne suit pas.
 *
 * ── LES HOOKS SONT APPELÉS AVANT TOUT RETOUR ANTICIPÉ ───────────────────────
 *
 * `useDonnees` et `useParcours` sont appelés tous les deux, inconditionnellement,
 * AVANT le premier `return`. Un `return` placé entre eux aurait changé le nombre
 * de crochets entre deux rendus — React refuse, et le message qu'il donne
 * (« Rendered fewer hooks than expected ») ne nomme pas la cause.
 */

type Etat = 'attente' | 'échec';

/**
 * ─── NI L'ATTENTE NI L'ÉCHEC NE SONT PLUS ÉCRITS ICI ───────────────────────
 *
 * Ce fichier portait les deux : un `CADRE` de 60 vh, une fonction `Attente` et
 * une fonction `Echec` identiques au caractère près à celles de
 * `screens/compte/ecran-donnees.tsx` — même fond, même `displayMessageFor`, même
 * garde 401/403, même `role="alert"`. Les deux copies portaient donc le MÊME
 * DÉFAUT : elles REMPLAÇAIENT le cadre entier, rail compris, et le membre
 * n'avait plus aucune navigation. Corriger une seule des deux aurait laissé les
 * douze écrans de Parcours exactement aussi fermés qu'avant.
 *
 * `BandeAttente` et `BandeEchec` viennent maintenant du module Compte, et ce
 * fichier n'a plus de chemin où le cadre disparaît : un seul panneau à relire,
 * une seule sortie à tenir. Leur en-tête porte le raisonnement, la mesure qui
 * l'a imposé, et ce qui n'était PAS atteignable.
 *
 * Ce fichier portait sa propre fonction `Echec`, identique au caractère près à
 * celle de `screens/compte/ecran-donnees.tsx` : même `CADRE`, même
 * `displayMessageFor`, même garde 401/403, même `role="alert"`. Les deux
 * portaient donc le MÊME DÉFAUT — un chargement raté rendait un `<div>` qui
 * remplaçait le cadre entier, rail compris, et le membre n'avait plus aucune
 * navigation.
 *
 * Le corriger dans une seule des deux copies aurait laissé les douze écrans de
 * Parcours exactement aussi fermés qu'avant. `PanneauEchec` est donc exporté
 * par le module Compte et employé par les deux : un seul panneau à relire, une
 * seule sortie à tenir. Son en-tête porte le raisonnement et dit ce qui n'était
 * PAS atteignable — rendre le rail demanderait les données qui viennent de
 * manquer.
 */

/**
 * Un écran de parcours qui LIT ses données.
 *
 * `desktop` et `mobile` reçoivent les données ET les gestes, fusionnés : les
 * cadres transcodés déclarent la forme dont ils ont besoin (`J06Data`), qui étend
 * `ParcoursData`. La fusion se fait ICI, une fois, plutôt que dans onze pages.
 */
export function EcranParcoursDonnees<T>(
  proprietes: ProprietesEcranParcours<T>,
) {
  /**
   * LA CLÉ D'ESSAI DE « RÉESSAYER », posée sur le composant qui tient
   * `useDonnees` : la changer le démonte et le remonte, donc le chargement repart
   * par le chemin normal. Même mécanisme que `EcranDonnees` du module Compte, et
   * pour la même raison — un second chemin de chargement serait un second code à
   * tenir à jour, donc un des deux faux. Voir `PanneauEchec`.
   */
  const [essai, setEssai] = useState(0);
  const reessayer = useCallback(() => setEssai((n) => n + 1), []);
  return <Chargement<T> key={essai} {...proprietes} onReessayer={reessayer} />;
}

type ProprietesEcranParcours<T> = {
  readonly screen: string;
  /** DOIT être stable : fonction de module, ou `useCallback` mémoïsé. */
  readonly charger: () => Promise<T>;
  readonly contexte?: ContexteParcours;
  readonly modaleInitiale?: NomModale | null;
  readonly desktop: (donnees: T & ParcoursData) => ReactNode;
  readonly mobile?: (donnees: T & ParcoursData) => ReactNode;
  /**
   * `volet` EST PASSÉ À LA FABRIQUE, et non lu par la page.
   *
   * J03 a trois volets, et c'est `useParcours` qui tient lequel est ouvert. Si la
   * page devait le lire, elle devrait appeler `useParcours` elle aussi — donc
   * tenir DEUX états de fenêtre pour un écran, dont un seul serait celui que la
   * coquille emploie. Le bouton « Suivant » avancerait alors un volet que personne
   * ne regarde.
   */
  readonly modales?: (
    donnees: T & ParcoursData,
    volet: number,
  ) => Partial<Record<NomModale, PlancheModale>>;
  /**
   * LE DESSIN, DISPONIBLE AVANT LA DONNÉE — ET IL EST OBLIGATOIRE.
   *
   * Le cadre est donc rendu dès le premier rendu : le rail, le panneau
   * « MON PARCOURS » et la barre basse sont dans le HTML SERVI, et ils cliquent.
   * L'attente et l'échec deviennent une bande en `position: fixed`.
   *
   * OBLIGATOIRE, et pas facultatif : une coquille vide répond `200`, donc aucun
   * test de statut ne la voit et rien ne rougit. `tsc` refuse l'oubli au prochain
   * écran branché. Les onze pages de ce module passent `VUE_NEUTRE`, qui existait
   * déjà pour les planches d'illustration — rien n'a été inventé pour cela. Le
   * raisonnement complet est dans `screens/compte/ecran-donnees.tsx`.
   */
  readonly squelette: T;
};

function Chargement<T>({
  screen,
  charger,
  contexte = {},
  modaleInitiale = null,
  desktop,
  mobile,
  modales,
  squelette,
  onReessayer,
}: ProprietesEcranParcours<T> & { readonly onReessayer: () => void }) {
  /**
   * ─── LA SESSION EST REPRISE AVANT LA PREMIÈRE LECTURE, ET C'EST MESURÉ ────
   *
   * Sans cette ligne, la visite au navigateur donnait DIX `401` dans la console
   * pour douze écrans : le jeton d'accès vit en mémoire et meurt au rechargement,
   * `SessionBoot` le reprend dans un `useEffect` du gabarit, et le premier appel de
   * chaque page partait AVANT. Le transport rafraîchit sur `401` puis rejoue, donc
   * les écrans s'affichaient quand même — c'est le genre de « ça marche » qui cache
   * trois défauts :
   *
   *   1. un `401` par page dans le journal du serveur, sur une session parfaitement
   *      valide. Un signal qui crie tout le temps ne veut plus rien dire ;
   *   2. les appels qui NE rejouent pas sont perdus. Le socle rejoue, mais c'est le
   *      socle qui sauve, pas la conception ;
   *   3. et sur une route `@PublicRead` — ce que `/journeys/public` N'EST PAS, mais
   *      ce qu'une refonte pourrait en faire — il n'y aurait même pas de `401` : le
   *      serveur répondrait `200` avec la VUE VISITEUR, l'écran l'afficherait, et il
   *      changerait d'avis au rechargement suivant. Un défaut qu'aucun `401` ne
   *      signalerait.
   *
   * `hasAccessToken()` garde l'appel : avec un jeton en main, rien n'est repris —
   * faire tourner le jeton de rafraîchissement pour rien incrémente
   * `token_generation`, et c'est la mécanique qui détecte les rejeux.
   * `refreshOnce` est partagé en vol, donc douze pages montées ensemble ne lancent
   * qu'une rotation.
   */
  const lire = useCallback(async () => {
    if (!hasAccessToken()) await resumeSession();
    return charger();
  }, [charger]);

  const etat = useDonnees(lire);
  const vue = useParcours(modaleInitiale, contexte);

  /**
   * ─── LE CADRE PASSE AVANT, LA DONNÉE REMPLIT ENSUITE ──────────────────────
   *
   * `squelette` fourni, les deux états qui n'ont pas de donnée rendent QUAND MÊME
   * le cadre — donc le rail, le panneau et la barre basse sont servis et cliquent —
   * et se contentent d'une bande par-dessus. C'est le motif de `/accueil`, et la
   * mesure qui l'a imposé est dans `screens/compte/ecran-donnees.tsx`.
   *
   * LES GESTES SONT FUSIONNÉS DANS LE SQUELETTE AUSSI (`vue.data`), et il le faut :
   * sans eux le cadre référencerait sept gestionnaires de panneau indéfinis, et
   * cliquer « Équipe » pendant le chargement lèverait. Le squelette que la page
   * fournit ne porte donc QUE les champs de son propre type.
   */
  /**
   * UN SEUL CHEMIN DE RENDU : le cadre est rendu avec la donnée si elle est là, et
   * avec le squelette sinon. Plus de retour anticipé, donc plus de branche où le
   * cadre pourrait disparaître.
   *
   * LES GESTES SONT FUSIONNÉS DANS LES DEUX CAS (`vue.data`), et il le faut : sans
   * eux le cadre référencerait sept gestionnaires de panneau indéfinis, et cliquer
   * « Équipe » pendant le chargement lèverait. Le squelette que la page fournit ne
   * porte donc QUE les champs de son propre type.
   *
   * LA FENÊTRE RESTE FERMÉE tant que la donnée n'est pas là : `ouverte` vaut `null`
   * et aucune `modales` n'est passée. Ouvrir une fenêtre sur un squelette
   * afficherait une feuille vide — et `modales(inerte, …)` construirait des
   * planches sur des valeurs absentes.
   */
  const pret = etat.phase === 'prêt';
  const donnees = { ...vue.data, ...(pret ? etat.donnees : squelette) } as T & ParcoursData;

  return (
    <>
      <EcranParcours
        screen={screen}
        desktop={desktop(donnees)}
        {...(mobile === undefined ? {} : { mobile: mobile(donnees) })}
        ouverte={pret ? vue.ouverte : null}
        onOuvrir={vue.onOuvrir}
        onFermer={vue.onFermer}
        {...(pret && modales !== undefined ? { modales: modales(donnees, vue.volet) } : {})}
        erreur={vue.erreur}
        niveauRequis={vue.niveauRequis}
        oublierNiveauRequis={vue.oublierNiveauRequis}
      />
      {etat.phase === 'attente' ? (
        <BandeAttente texte="Chargement de votre parcours…" />
      ) : null}
      {etat.phase === 'échec' ? (
        <BandeEchec erreur={etat.erreur} onReessayer={onReessayer} />
      ) : null}
    </>
  );
}

export type { Etat };
