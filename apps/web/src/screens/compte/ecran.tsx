'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { Modal } from '@/components/modal';
import { ScreenFrames } from '@/screens/frames';
import { MODALES, type NomModale } from './data';

/**
 * La coquille commune aux écrans du module Compte qui ouvrent une fenêtre.
 *
 * Elle ne dessine RIEN : tout le pixel vient des composants transcodés de
 * `docs/template/08 Compte.dc.html`. Elle apporte les deux choses qu'une image ne
 * peut pas contenir — la bascule ordinateur/mobile au seuil de 1024 px (§10.1),
 * que `ScreenFrames` porte, et l'ouverture des fenêtres.
 *
 * SEPT DES DIX ÉCRANS NE L'EMPLOIENT PAS, et c'est voulu : K01, K03, K04, K05,
 * K07, K09 et K10 n'ouvrent aucune fenêtre, donc leur page est un composant
 * SERVEUR qui appelle `ScreenFrames` directement. Envelopper une page inerte dans
 * un composant client lui coûterait son rendu serveur pour rien.
 *
 * L'OUVERTURE EST DÉLÉGUÉE, comme la fermeture l'est dans `Modal`, et pour la
 * même raison : le bouton « Ajouter aux contacts » est enfoui au milieu de la
 * fiche, et lui passer un `onClick` demanderait de modifier le JSX transcodé —
 * donc de renoncer à ce qui fait la valeur du transcodage. Le transcodeur pose
 * `data-modal-open` sur les déclencheurs ; un seul écouteur suffit ici.
 */

/** Une fenêtre que l'écran sait ouvrir : ses formes, telles que transcodées. */
export type PlancheModale = {
  /**
   * Absent quand la maquette ne dessine pas de fenêtre distincte pour
   * l'ordinateur — c'est le cas des TROIS fenêtres de ce module, qui n'ont
   * qu'une planche chacune (420, 380 et 440 px). La même sert aux deux largeurs,
   * ce que `Modal` prévoit dans son type.
   */
  readonly desktop?: ReactNode;
  readonly mobile: ReactNode;
  /**
   * Le volet courant, pour la fenêtre qui en a plusieurs (K06, 14 §4.2).
   *
   * À partir de 1, le panneau joue `moments.panelAdvance` au lieu de rejouer son
   * ouverture : la feuille AVANCE d'un cran au lieu de se rouvrir.
   */
  readonly phase?: number;
};

export function EcranCompte({
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
          {...(planche.phase === undefined ? {} : { phase: planche.phase })}
          mobile={planche.mobile}
        />
      ))}
    </div>
  );
}

/**
 * L'état d'un écran Compte : la fenêtre ouverte, et rien d'autre.
 *
 * LE NOM LU DANS L'ATTRIBUT EST VÉRIFIÉ contre la table. Sans cette garde, une
 * faute de frappe dans une déclaration d'écran donnerait un bouton qui n'ouvre
 * rien, en silence, et qui aurait pourtant l'air branché — le générateur, lui,
 * ne voit que la maquette et ne peut pas savoir ce que la page attend.
 *
 * `ouverteInitiale` sert au lien profond : `/compte/abonnement?paiement=attente`
 * doit montrer le volet d'attente du paiement dès l'arrivée, sans qu'on ait à
 * cliquer. `Modal` sait le faire depuis le premier rendu client — il lit la
 * largeur dès l'initialisation de son état pour cette raison exacte.
 */
export function useCompte(ouverteInitiale: NomModale | null = null) {
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

  return { ouverte, onOuvrir, onFermer };
}
