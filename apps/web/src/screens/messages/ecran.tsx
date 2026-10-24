'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Modal } from '@/components/modal';
import { ScreenFrames } from '@/screens/frames';
import { M01Menu } from '@/screens/m01menu/menu.generated';
import { TITRES_DE_FEUILLE, type FeuilleMessages } from '@/screens/messages/feuilles';
import type { MenuConversation, SignalementVue } from './data';
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
 * LE SIGNALEMENT PART, ET LA CONFIRMATION SUIT. « Envoyer le signalement » écrit
 * `POST /reports` (module 13) — sur le MEMBRE depuis l'entrée du menu, sur UN MESSAGE
 * précis depuis « Signaler » sous sa bulle (`subjectType: MESSAGE`) — puis pousse
 * `?feuille=merci`. (Ce paragraphe disait l'inverse tant que rien ne partait : « le
 * rendre actif sans que rien ne parte mentirait au membre ». Cela a été branché, et
 * la règle d'origine reste vraie : la confirmation n'apparaît qu'APRÈS l'écriture.)
 * Les quatre entrées du menu sont des gestes réels (profil, sourdine, blocage,
 * signalement) ; la fenêtre porte maintenant une croix de fermeture (`MV_MENU_CROIX`).
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
  menu,
  signalement,
}: {
  readonly desktop: ReactNode;
  readonly mobile: ReactNode;
  /** La fenêtre que l'URL demande, s'il y en a une. */
  readonly ouverte?: FeuilleMessages | null;
  /**
   * LES GESTES DU MENU DE CONVERSATION — profil, sourdine, blocage.
   *
   * Le menu est monté ICI, pas dans le cadre : c'est `Modal` qui le rend, et il
   * ne recevait aucune prise. Ses quatre entrées étaient des `<span>` inertes.
   */
  readonly menu?: MenuConversation;
  /**
   * LES GESTES DE LA FEUILLE « SIGNALER ».
   *
   * Même raison que `menu` : la feuille est montée ICI, par `Modal`, et ne
   * recevait aucune prise. Ses six motifs étaient des `<div>`, son champ de
   * détails était la phrase d'exemple de la planche, et son bouton n'avait pas de
   * geste.
   */
  readonly signalement?: SignalementVue;
}) {
  const [courante, setCourante] = useState<FeuilleMessages | null>(ouverte);

  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ L'URL CHANGEAIT, LA FENÊTRE NE S'OUVRAIT PAS                            ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Le signalement quand on clique sur signaler n'affiche pas
   * automatiquement le modal. L'URL change mais le modal ne vient pas. »
   *
   * MESURÉ : `useState(ouverte)` ne lit sa valeur QU'AU MONTAGE. L'entrée
   * « Signaler » du menu est un lien vers `?feuille=signaler` ; Next rerend la
   * page avec la nouvelle prise, mais le composant n'est pas remonté — donc
   * `courante` gardait `null`, et la fenêtre restait fermée. Seule une arrivée
   * DIRECTE sur l'URL l'ouvrait, ce qui est exactement le cas que les épreuves
   * exerçaient.
   *
   * ON SUIT DONC LA PRISE. Et on ne remplace pas l'état par elle : `fermer()`
   * doit pouvoir refermer la fenêtre sans toucher à l'URL — la croix et le voile
   * ferment, le paramètre reste, et rouvrir par le menu doit remarcher. C'est
   * pourquoi l'état existe en plus de la prise, et pourquoi il la suit au lieu de
   * s'y substituer.
   */
  useEffect(() => {
    setCourante(ouverte);
  }, [ouverte]);
  const onFermee = signalement?.onFermee;
  const fermer = useCallback((): void => {
    setCourante(null);
    onFermee?.();
  }, [onFermee]);

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

  /**
   * « BLOQUER » FERME LE MENU (lot F2). La confirmation s'ouvre depuis le menu ; sans
   * cette fermeture le menu restait ouvert dessous, puis encore ouvert APRÈS le
   * blocage — maintenant qu'on reste sur la conversation, au lieu de partir sur la
   * liste, il aurait masqué le bandeau « Débloquer ».
   */
  const menuQuiSeFerme: MenuConversation | undefined =
    menu === undefined
      ? undefined
      : {
          ...menu,
          onBloquer: () => {
            menu.onBloquer?.();
            setCourante(null);
          },
        };

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
        mobile={<M01Menu menu={menuQuiSeFerme} />}
      />
      <Modal
        open={courante === 'signaler'}
        onClose={fermer}
        titleId={TITRES_DE_FEUILLE.signaler}
        name="X03"
        desktop={<X03Desktop signalement={signalement} />}
        mobile={<X03Mobile signalement={signalement} />}
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
