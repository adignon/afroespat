'use client';

import { useCallback, type ReactNode } from 'react';
import { ApiError, displayMessageFor, hasAccessToken, resumeSession } from '@/lib/api/index';
import { useDonnees } from '@/screens/compte/ecran-donnees';
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

const CADRE: React.CSSProperties = {
  minHeight: '60vh',
  background: '#F6F8F7',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  textAlign: 'center',
};

function Attente() {
  return (
    <div style={CADRE} role="status" aria-live="polite">
      <span style={{ fontSize: '14px', color: '#5D6B66' }}>Chargement de votre parcours…</span>
    </div>
  );
}

/**
 * L'échec, décidé sur `error.code` et jamais sur le message.
 *
 * `displayMessageFor` sait déjà ce que le front ne doit pas refaire : sur un
 * `429` elle n'affiche PAS le message du serveur — il dit « patientez un instant »
 * pour une heure d'attente — et rien ne réessaie ici, parce qu'un `429` rejoué
 * n'est qu'un second `429`. `ApiShapeError` n'hérite PAS d'`ApiError`, ce qui
 * interdit structurellement de prendre un contrat cassé pour une règle métier.
 */
function Echec({ erreur }: { readonly erreur: unknown }) {
  const perdue = erreur instanceof ApiError && (erreur.status === 401 || erreur.status === 403);
  return (
    <div style={CADRE} role="alert">
      <span style={{ fontSize: '14px', color: '#5D6B66' }}>
        {displayMessageFor(erreur)}
        {perdue ? (
          <>
            {' '}
            <a href="/connexion" style={{ color: '#0F5C48', fontWeight: 700 }}>
              Se reconnecter
            </a>
          </>
        ) : null}
      </span>
    </div>
  );
}

/**
 * Un écran de parcours qui LIT ses données.
 *
 * `desktop` et `mobile` reçoivent les données ET les gestes, fusionnés : les
 * cadres transcodés déclarent la forme dont ils ont besoin (`J06Data`), qui étend
 * `ParcoursData`. La fusion se fait ICI, une fois, plutôt que dans onze pages.
 */
export function EcranParcoursDonnees<T>({
  screen,
  charger,
  contexte = {},
  modaleInitiale = null,
  desktop,
  mobile,
  modales,
}: {
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
}) {
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

  if (etat.phase === 'attente') return <Attente />;
  if (etat.phase === 'échec') return <Echec erreur={etat.erreur} />;

  const donnees = { ...vue.data, ...etat.donnees } as T & ParcoursData;

  return (
    <EcranParcours
      screen={screen}
      desktop={desktop(donnees)}
      {...(mobile === undefined ? {} : { mobile: mobile(donnees) })}
      ouverte={vue.ouverte}
      onOuvrir={vue.onOuvrir}
      onFermer={vue.onFermer}
      {...(modales === undefined ? {} : { modales: modales(donnees, vue.volet) })}
      erreur={vue.erreur}
      niveauRequis={vue.niveauRequis}
      oublierNiveauRequis={vue.oublierNiveauRequis}
    />
  );
}

export type { Etat };
