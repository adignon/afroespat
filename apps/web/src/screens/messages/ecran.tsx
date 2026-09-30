'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { Modal } from '@/components/modal';
import { ScreenFrames } from '@/screens/frames';
import { M01Menu } from '@/screens/m01menu/menu.generated';
import { TITRES_DE_FEUILLE, type FeuilleMessages } from '@/screens/messages/feuilles';
import { X03Desktop } from '@/screens/x03/desktop.generated';
import { X03Mobile } from '@/screens/x03/mobile.generated';
import { X03MobileConfirmation } from '@/screens/x03confirmation/mobileconfirmation.generated';

/**
 * M01 — la coquille des deux routes de messagerie, et les trois fenêtres qu'elles
 * ouvrent.
 *
 * Elle ne dessine RIEN : tout le pixel vient du transcodage de
 * `docs/template/09 Messages et transverse.dc.html`. Elle apporte ce qu'une image
 * ne peut pas contenir — la bascule ordinateur/mobile (que `ScreenFrames` porte),
 * l'ouverture et la fermeture.
 *
 * L'OUVERTURE EST DÉLÉGUÉE, comme la fermeture l'est dans `Modal`, et pour la même
 * raison : le « ··· » de l'en-tête de conversation est enfoui dans le cadre
 * transcodé, et lui passer un `onClick` demanderait de modifier ce JSX — donc de
 * renoncer à ce qui fait la valeur du transcodage. Le générateur pose
 * `data-modal-open="M01MENU"` sur ce bouton ; un seul écouteur suffit ici. C'est le
 * mécanisme de `EcranParcours` et `EcranCompte`, à l'identique.
 *
 * LE MENU S'OUVRE AUSSI PAR L'URL (`?feuille=menu`), pour la même raison que les
 * deux feuilles X03 : un contrôle automatisé (axe-core) doit pouvoir le voir ouvert
 * au chargement, et une boîte de dialogue montée dans un portail n'existe pas au
 * rendu serveur.
 *
 * « ENVOYER LE SIGNALEMENT » RESTE INERTE, et la confirmation n'est donc PAS
 * enchaînée derrière lui. Le signalement part par `POST /reports` (module 13), que
 * ce lot ne branche pas ; faire apparaître « Merci. Nous regardons sous 24 heures. »
 * sans que rien ne soit parti serait mentir au membre — la même règle que pour le
 * « Publier » de J03. Les quatre entrées du menu sont inertes pour la même raison,
 * et parce que la maquette les dessine en `<span>`, pas en boutons.
 *
 * CE QUI TRAVERSE LA FRONTIÈRE CLIENT/SERVEUR — le type d'une feuille, la table des
 * `titleId`, la lecture du paramètre d'URL — vit dans `./feuilles.ts`, qui n'est PAS
 * un module client. Voir l'en-tête de ce fichier-là : une fonction exportée d'un
 * module `'use client'` et appelée depuis un composant serveur n'est pas une
 * fonction mais une référence, et la route répondait 500.
 */

/** Ce que le générateur écrit sur le déclencheur, et la fenêtre que cela ouvre. */
const PAR_DECLENCHEUR: Readonly<Record<string, FeuilleMessages>> = {
  M01MENU: 'menu',
};

export function EcranMessages({
  desktop,
  mobile,
  ouverte = null,
}: {
  readonly desktop: ReactNode;
  readonly mobile: ReactNode;
  /** La fenêtre que l'URL demande, s'il y en a une. */
  readonly ouverte?: FeuilleMessages | null;
}) {
  const [courante, setCourante] = useState<FeuilleMessages | null>(ouverte);
  const fermer = useCallback((): void => setCourante(null), []);

  /**
   * LE NOM LU DANS L'ATTRIBUT EST VÉRIFIÉ contre la table. Sans cette garde, une
   * faute de frappe dans une déclaration d'écran donnerait un bouton qui n'ouvre
   * rien, en silence, et qui aurait pourtant l'air branché.
   */
  const ouvrir = useCallback((event: React.MouseEvent<HTMLDivElement>): void => {
    const cible = event.target;
    if (!(cible instanceof Element)) return;
    const bouton = cible.closest('[data-modal-open]');
    if (bouton === null) return;
    const nom = bouton.getAttribute('data-modal-open');
    const feuille = nom === null ? undefined : PAR_DECLENCHEUR[nom];
    if (feuille !== undefined) setCourante(feuille);
  }, []);

  return (
    <div onClick={ouvrir}>
      <ScreenFrames screen="M01" desktop={desktop} mobile={mobile} />
      {/*
        LE MENU N'A QU'UNE PLANCHE — la carte de 300 px — et la maquette ne lui en
        dessine pas de seconde : la même sert aux deux largeurs, comme la feuille
        d'invitation de J05.

        SON VOILE EST UN EMPRUNT, et il faut le savoir en le lisant : `09 Messages`
        ne dessine aucun voile dans la section M01 (compté : zéro), et il est
        emprunté à `03 Accueil v2` par `adaptModalFrame`. Sans lui, `Modal` ne
        verrait qu'un panneau et un clic à côté ne fermerait rien — or le menu n'a ni
        croix ni poignée, donc le voile est la seule fermeture à la souris. Voir
        `tools/screens/09-messages.mjs`, `VOILE_DE_M01`.
      */}
      <Modal
        open={courante === 'menu'}
        onClose={fermer}
        titleId={TITRES_DE_FEUILLE.menu}
        name="M01MENU"
        mobile={<M01Menu />}
      />
      <Modal
        open={courante === 'signaler'}
        onClose={fermer}
        titleId={TITRES_DE_FEUILLE.signaler}
        name="X03"
        desktop={<X03Desktop />}
        mobile={<X03Mobile />}
      />
      {/*
        La confirmation n'a qu'une seule planche — une carte nue de 360 px — et la
        maquette ne lui en dessine pas de seconde. La même sert donc aux deux
        largeurs, comme la feuille d'invitation de J05.

        SA CROIX EST UN EMPRUNT : la maquette ne lui en dessine aucune, et celle de
        la fenêtre « Signaler » — même maquette, même section X03 — lui a été
        recopiée mot pour mot. Voir `CROIX_DE_X03` dans
        `tools/screens/09-messages.mjs` pour ce qui est emprunté et pour le
        garde-fou qui lève si ce motif disparaît de X03.
      */}
      <Modal
        open={courante === 'merci'}
        onClose={fermer}
        titleId={TITRES_DE_FEUILLE.merci}
        name="X03M"
        mobile={<X03MobileConfirmation />}
      />
    </div>
  );
}
