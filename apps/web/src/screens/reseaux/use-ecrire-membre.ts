'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { notifyError } from '@/components/notifications';
import { conversationAvec, ouvrirConversation, prenomDe } from '@/components/ecrire';
import { ApiError } from '@/lib/api/index';
import type { MembreAdminRowView } from '../a08t/data';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « ON NE PEUT PAS ÉCRIRE AUX MEMBRES » — LE GESTE DES SIX BOUTONS           ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur, capture à l'appui. RELEVÉ sur les quatre cadres produits de
 * l'onglet « Membres » avant ce lot : « Écrire » y figure SIX fois, et pas un
 * `onClick` — cinq boutons sur les lignes de la vue membre à 1 036 px, une
 * entrée dans le menu de rôle de la vue propriétaire, une dans sa feuille
 * mobile. La vue membre de 390 px n'en dessine aucun (compté : zéro
 * occurrence) — c'est la maquette, pas un oubli, et on n'y ajoute rien.
 *
 * ── POURQUOI UN CROCHET À PART DE `useReseau` ─────────────────────────────
 *
 * Même arbitrage que `use-annonce.ts`, et sa note le dit déjà : `useReseau`
 * porte la fiche, les sujets, les membres, les demandes et la modération — il
 * est la chose la plus chargée du module. L'état d'une FENÊTRE n'a rien à voir
 * avec le chargement d'un réseau, et celui-ci ne fait AUCUN appel au montage :
 * le monter sur les vingt-cinq onglets ne coûte rien.
 *
 * ── LA FENÊTRE EST MONTÉE UNE SEULE FOIS, ET C'EST MESURÉ ─────────────────
 *
 * ⚠ ELLE NE DOIT PAS ÊTRE POSÉE DANS LE CADRE GÉNÉRÉ. `ScreenFrames` rend les
 * DEUX cadres et n'en masque qu'un par `display: none`, et `Modal` se PORTALISE
 * vers `document.body` : deux copies s'ouvriraient ENSEMBLE sur le même état, et
 * le voile de celle du cadre masqué intercepterait les clics de l'autre —
 * « subtree intercepts pointer events », cinquante-sept tentatives de clic. La
 * leçon est déjà écrite au-dessus de `FenetreConfirmation` dans
 * `reseau-screen.tsx`, et c'est pour cela que ce crochet rend l'ÉTAT de la
 * fenêtre et non la fenêtre : l'écran en pose UNE.
 *
 * ── LE FRONT PRÉVIENT, IL N'AUTORISE PAS (mémo §5) ────────────────────────
 *
 * `message.send` et `conversation.create` ne sont pas arbitrés ici : on tente,
 * et le serveur refuse s'il doit refuser. Aucun `if (niveau >= …)`. `occupe`
 * n'éteint les boutons que le temps d'un appel EN VOL, pour ne pas ouvrir deux
 * fois le même fil.
 */
export interface EcrireMembreEtat {
  /** Le bouton d'une ligne : la rangée connaît son membre. */
  readonly onEcrire: (userId: string) => void;
  /**
   * L'entrée du menu de rôle. Sans argument, pour la raison déjà écrite
   * au-dessus de `onNommerModerateur` : la maquette dessine UN menu posé HORS de
   * la boucle des membres, donc aucune variable de rang n'est à sa portée. C'est
   * `menu` qui dit sur qui il est ouvert.
   */
  readonly onEcrireMenu: () => void;
  /** Le membre à qui la fenêtre va écrire — `null` = fenêtre fermée. */
  readonly cible: MembreAdminRowView | null;
  /** Le prénom que `FenetreEcrire` met dans son titre. */
  readonly prenom: string;
  /** Un appel est en vol : les six boutons s'éteignent. */
  readonly occupe: boolean;
  readonly onFermer: () => void;
  readonly onEnvoyer: (message: string) => void;
}

export function useEcrireMembre(
  membres: readonly MembreAdminRowView[],
  menu: string | null,
): EcrireMembreEtat {
  const router = useRouter();
  const [cibleId, setCibleId] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  /**
   * LA CIBLE EST UN IDENTIFIANT, PAS UNE LIGNE COPIÉE.
   *
   * Même raison que `menu` et `aBannir` dans `useReseau` : la liste se recharge
   * après chaque geste de modération, et une ligne figée ici garderait le nom —
   * et le pseudo — d'avant le rechargement. On retrouve la ligne à chaque rendu.
   */
  const cible = useMemo(
    () => membres.find((m) => m.userId === cibleId) ?? null,
    [membres, cibleId],
  );

  /**
   * ON CHERCHE AVANT D'OUVRIR, et c'est la route qui l'impose : elle est unique
   * par paire, donc lui demander un premier message sur un fil qui existe déjà
   * enverrait un message de plus pour rien. La fenêtre ne s'ouvre que quand il
   * n'y a vraiment rien.
   */
  const ouvrir = useCallback(
    (userId: string) => {
      if (occupe) return;
      const ligne = membres.find((m) => m.userId === userId);
      if (ligne === undefined) return;
      setOccupe(true);
      conversationAvec(ligne.handle)
        .then((existante) => {
          if (existante === null) {
            setCibleId(userId);
            return;
          }
          router.push(`/messages/${existante}`);
        })
        .catch((cause: unknown) => {
          /**
           * UNE LISTE ILLISIBLE N'EMPÊCHE PAS D'ÉCRIRE : on ouvre la fenêtre.
           * Le pire cas est un message de plus dans un fil existant — très loin
           * devant un bouton qui ne répond pas. C'est le même arbitrage que le
           * profil public, et il est écrit là-bas aussi.
           */
          void cause;
          setCibleId(userId);
        })
        .finally(() => {
          setOccupe(false);
        });
    },
    [membres, occupe, router],
  );

  const onEcrireMenu = useCallback(() => {
    if (menu === null) return;
    ouvrir(menu);
  }, [menu, ouvrir]);

  const onEnvoyer = useCallback(
    (message: string) => {
      if (cible === null) return;
      setOccupe(true);
      ouvrirConversation(cible.handle, message)
        .then((conversationId) => {
          setCibleId(null);
          router.push(`/messages/${conversationId}`);
        })
        .catch((cause: unknown) => {
          notifyError(
            cause instanceof ApiError ? cause.displayMessage : 'Le message n’a pas pu partir.',
          );
        })
        .finally(() => {
          setOccupe(false);
        });
    },
    [cible, router],
  );

  const onFermer = useCallback(() => {
    setCibleId(null);
  }, []);

  return {
    onEcrire: ouvrir,
    onEcrireMenu,
    cible,
    prenom: cible === null ? '' : prenomDe(cible.name, cible.handle),
    occupe,
    onFermer,
    onEnvoyer,
  };
}
