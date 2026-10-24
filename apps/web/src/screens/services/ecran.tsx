'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { Modal } from '@/components/modal';
import { ScreenFrames } from '@/screens/frames';
import { MODALES, type NomModale } from './data';

/**
 * La coquille commune aux écrans du module Services qui ouvrent une fenêtre.
 *
 * Elle ne dessine RIEN : tout le pixel vient des composants transcodés de
 * `docs/template/06 Services.dc.html`. Elle apporte les deux choses qu'une image
 * ne peut pas contenir — la bascule ordinateur/mobile au seuil de 1024 px
 * (§10.1), que `ScreenFrames` porte, et l'ouverture des fenêtres.
 *
 * HUIT DES DIX ÉCRANS NE L'EMPLOIENT PAS, et c'est voulu : S01, S03, S04, S06,
 * S07, S08, S09 et S10 n'ouvrent aucune fenêtre, donc leur page est un composant
 * SERVEUR qui appelle `ScreenFrames` directement. Envelopper une page inerte dans
 * un composant client lui coûterait son rendu serveur pour rien.
 *
 * L'OUVERTURE EST DÉLÉGUÉE, comme la fermeture l'est dans `Modal`, et pour la
 * même raison : le bouton « Contacter » est enfoui au milieu de la fiche, et lui
 * passer un `onClick` demanderait de modifier le JSX transcodé — donc de renoncer
 * à ce qui fait la valeur du transcodage. Le transcodeur pose `data-modal-open`
 * sur les déclencheurs ; un seul écouteur suffit ici.
 *
 * C'est la même coquille que `@/screens/compte/ecran` et `@/screens/parcours/
 * ecran`. Les trois se ressemblent beaucoup, et les fusionner est un lot en soi :
 * chacune est indexée sur SA table de fenêtres, et une table partagée serait un
 * conflit de fusion à chaque contribution — la raison même pour laquelle les
 * déclarations d'écran vivent dans un fichier par maquette.
 */

/** Une fenêtre que l'écran sait ouvrir : ses formes, telles que transcodées. */
export type PlancheModale = {
  /**
   * Absent quand la maquette ne dessine pas de fenêtre distincte pour
   * l'ordinateur — c'est le cas de trois des quatre fenêtres de ce module. La
   * même planche sert alors aux deux largeurs, ce que `Modal` prévoit dans son
   * type.
   */
  readonly desktop?: ReactNode;
  readonly mobile: ReactNode;
  /**
   * `true` quand la maquette dessine cet état AUTREMENT sur grand écran.
   *
   * L'état L0 de S02 est le seul cas : sa feuille n'existe qu'en mobile, et le
   * cadre d'ordinateur porte le même message EN PLACE dans sa colonne de
   * contexte. Superposer la feuille par-dessus l'afficherait deux fois.
   */
  readonly mobileOnly?: boolean;
};

export function EcranServices({
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
          mobile={planche.mobile}
        />
      ))}
    </div>
  );
}

/**
 * L'état d'un écran Services : la fenêtre ouverte, et rien d'autre.
 *
 * LE NOM LU DANS L'ATTRIBUT EST VÉRIFIÉ contre la table. Sans cette garde, une
 * faute de frappe dans une déclaration d'écran donnerait un bouton qui n'ouvre
 * rien, en silence, et qui aurait pourtant l'air branché — le générateur, lui,
 * ne voit que la maquette et ne peut pas savoir ce que la page attend.
 *
 * `ouverteInitiale` sert au lien profond : `/services/logement/:id?niveau=l0`
 * doit montrer l'état L0 dès l'arrivée, sans qu'on ait à cliquer — c'est le
 * NIVEAU DU MEMBRE qui en décide, et ce lot ne le connaît pas (voir
 * `niveauContact` dans `./data`). `Modal` sait le faire depuis le premier rendu
 * client : il lit la largeur dès l'initialisation de son état pour cette raison
 * exacte.
 */
export function useServices(ouverteInitiale: NomModale | null = null) {
  const [ouverte, setOuverte] = useState<NomModale | null>(ouverteInitiale);

  const onOuvrir = useCallback((event: React.MouseEvent<HTMLDivElement>): void => {
    const cible = event.target;
    if (!(cible instanceof Element)) return;
    const bouton = cible.closest('[data-modal-open]');
    if (bouton === null) return;
    const nom = bouton.getAttribute('data-modal-open');
    if (nom !== null && nom in MODALES) setOuverte(nom as NomModale);
  }, []);

  const onFermer = useCallback((): void => setOuverte(null), []);

  return { ouverte, onOuvrir, onFermer, ouvrir: setOuverte };
}
