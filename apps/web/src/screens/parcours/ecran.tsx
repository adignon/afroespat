'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { Modal } from '@/components/modal';
import { ScreenFrames } from '@/screens/frames';
import { MODALES, VOLETS_BLOCAGE, type NomModale, type ParcoursData } from './data';

/**
 * La coquille commune aux douze écrans du module Parcours.
 *
 * Elle ne dessine RIEN : tout le pixel vient des composants transcodés. Elle
 * apporte les deux choses qu'une image ne peut pas contenir — la bascule
 * ordinateur/mobile au seuil de 1024 px (§10.1) et l'ouverture des fenêtres.
 *
 * L'OUVERTURE EST DÉLÉGUÉE, comme la fermeture l'est dans `Modal`, et pour la
 * même raison : le bouton « Je suis bloqué·e » est enfoui au milieu de la carte
 * de l'étape en cours, et lui passer un `onClick` demanderait de modifier le JSX
 * transcodé — donc de renoncer à ce qui fait la valeur du transcodage. Le
 * transcodeur pose `data-modal-open` sur les déclencheurs ; un seul écouteur
 * suffit ici.
 *
 * Conséquence à connaître, la même que pour le fil : sur J01, les DEUX boutons
 * « Je suis bloqué·e » — celui du panneau et celui de l'étape en cours —
 * ouvrent la même feuille, sur la même étape. La maquette ne fournit qu'un jeu
 * de textes pré-remplis, et en inventer un par étape serait inventer de la
 * donnée. À brancher sur `POST /journeys/:id/steps/:stepId/blocker` au lot 3.
 *
 * LA COQUILLE NE TIENT AUCUN ÉTAT : c'est la page qui appelle `useParcours()`.
 * Une coquille qui l'aurait tenu aurait dû rendre `fermer` à la page pour que
 * J03 puisse recâbler « Annuler » — un aller-retour qui se paie toujours en
 * abstraction qui fuit.
 */

/** Une fenêtre que l'écran sait ouvrir : ses deux formes, telles que transcodées. */
export type PlancheModale = {
  /** Absent quand la maquette ne dessine pas de fenêtre — voir `Modal`. */
  readonly desktop?: ReactNode;
  readonly mobile: ReactNode;
  /** Cette forme n'existe qu'en mobile : sur grand écran l'état est ailleurs. */
  readonly mobileOnly?: boolean;
  /**
   * Le volet courant, pour une fenêtre qui en a plusieurs (J03).
   *
   * À partir de 1, le panneau joue `moments.panelAdvance` au lieu de rejouer son
   * ouverture : la feuille AVANCE d'un cran. Sans cela, chaque « Suivant »
   * refaisait remonter toute la feuille depuis le bas — le membre voyait une
   * nouvelle feuille au lieu de la même, un cran plus loin.
   */
  readonly phase?: number;
};

export function EcranParcours({
  screen,
  desktop,
  mobile,
  ouverte,
  onOuvrir,
  onFermer,
  modales,
}: {
  readonly screen: string;
  readonly desktop: ReactNode;
  /** Absent quand la maquette ne donne pas de cadre mobile pour cet écran. */
  readonly mobile?: ReactNode;
  readonly ouverte: NomModale | null;
  readonly onOuvrir: (event: React.MouseEvent<HTMLDivElement>) => void;
  readonly onFermer: () => void;
  /**
   * Les fenêtres de cet écran. Une fenêtre déclarée ici mais dont AUCUN bouton
   * ne porte le `data-modal-open` correspondant ne s'ouvrira jamais : le journal
   * de `node tools/generate-screens.mjs` le signale cadre par cadre.
   */
  readonly modales?: Partial<Record<NomModale, PlancheModale>>;
}) {
  return (
    <div onClick={onOuvrir}>
      <ScreenFrames
        screen={screen}
        desktop={desktop}
        {...(mobile === undefined ? {} : { mobile })}
      />
      {Object.entries(modales ?? {}).map(([nom, planche]) => (
        <Modal
          key={nom}
          open={ouverte === nom}
          onClose={onFermer}
          titleId={MODALES[nom as NomModale].titleId}
          name={nom}
          {...(planche.desktop === undefined ? {} : { desktop: planche.desktop })}
          {...(planche.mobileOnly === undefined ? {} : { mobileOnly: planche.mobileOnly })}
          {...(planche.phase === undefined ? {} : { phase: planche.phase })}
          mobile={planche.mobile}
        />
      ))}
    </div>
  );
}

/**
 * L'état d'un écran Parcours : la fenêtre ouverte, et le volet de J03.
 *
 * LE NOM LU DANS L'ATTRIBUT EST VÉRIFIÉ contre la table. Sans cette garde, une
 * faute de frappe dans une déclaration d'écran donnerait un bouton qui n'ouvre
 * rien, en silence, et qui aurait pourtant l'air branché — le générateur, lui,
 * ne voit que la maquette et ne peut pas savoir ce que la page attend.
 *
 * LE VOLET REVIENT À UN, à la fermeture ET à l'ouverture. Ce n'est pas du
 * confort : rouvrir la feuille directement sur l'aperçu, à un clic de
 * « Publier », contredirait §3.5 — « flux en quatre temps, sans jamais publier
 * automatiquement ». Le membre doit relire son texte et rechoisir sa portée.
 *
 * LES DEUX REMISES À ZÉRO SE COUVRENT L'UNE L'AUTRE, et c'est la mutation qui
 * l'a montré : retirer l'une OU l'autre laisse le test passer, parce que la
 * seconde suffit. Il a fallu les retirer TOUTES LES DEUX pour le faire tomber.
 * Elles restent, parce que la propriété — « une feuille rouverte commence au
 * premier volet » — vaut mieux qu'une seule ligne bien placée, et que le jour où
 * une fenêtre s'ouvrira autrement qu'au clic, celle de l'ouverture ne s'appliquera
 * plus. Le test mesure la PROPRIÉTÉ, pas la ligne.
 */
export function useParcours(ouverteInitiale: NomModale | null = null) {
  const [ouverte, setOuverte] = useState<NomModale | null>(ouverteInitiale);
  const [volet, setVolet] = useState(0);

  const onOuvrir = useCallback((event: React.MouseEvent<HTMLDivElement>): void => {
    const cible = event.target;
    if (!(cible instanceof Element)) return;
    const bouton = cible.closest('[data-modal-open]');
    if (bouton === null) return;
    const nom = bouton.getAttribute('data-modal-open');
    if (nom !== null && nom in MODALES) {
      setOuverte(nom as NomModale);
      setVolet(0);
    }
  }, []);

  const onFermer = useCallback((): void => {
    setOuverte(null);
    setVolet(0);
  }, []);

  const suivant = useCallback((): void => {
    setVolet((n) => Math.min(n + 1, VOLETS_BLOCAGE - 1));
  }, []);
  const precedent = useCallback((): void => setVolet((n) => Math.max(n - 1, 0)), []);

  /**
   * Ce que les composants transcodés reçoivent.
   *
   * `busy` est toujours `false` dans ce lot : aucune requête ne part encore. Il
   * est déclaré parce que le générateur écrit `disabled={busy}` sur les boutons
   * qu'il reconnaît, et un composant ne doit pas inventer la valeur qu'il rend.
   *
   * `onContinue` NE FAIT RIEN, et il faut le dire plutôt que de le maquiller :
   * sur J02 « Régulariser », « Continuer » mène à l'étape suivante de la
   * création, que la maquette ne dessine pas et que §3.1 fait aboutir à
   * `POST /journeys` — une route que ce lot ne branche pas. Lui faire changer
   * d'écran inventerait une étape de flux absente du design ; lui faire refermer
   * quelque chose serait un effet arbitraire. Il reste donc inerte, comme
   * « Publier », comme « Créer un parcours » : tous les boutons de ce lot qui
   * attendent l'API le sont.
   *
   * Il est branché tout de même, parce que le générateur écrit `onClick=
   * {onContinue}` sur ce libellé ; ne pas fournir la fonction ferait échouer la
   * compilation, pas un bouton plus vivant.
   */
  const data: ParcoursData = {
    busy: false,
    onContinue: () => undefined,
    onNext: suivant,
    onBack: precedent,
    onCancel: onFermer,
  };

  return { ouverte, onOuvrir, onFermer, volet, data };
}
