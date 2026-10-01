'use client';

import { useCallback } from 'react';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import { M01Desktop } from '@/screens/m01/desktop.generated';
import { M01Mobile } from '@/screens/m01/mobile.generated';
import { M01MobileConversation } from '@/screens/m01/mobileconversation.generated';
import { M01BloqueDesktop } from '@/screens/m01bloque/bloquedesktop.generated';
import { M01BloqueMobileConversation } from '@/screens/m01bloque/bloquemobileconversation.generated';
import { X01Desktop } from '@/screens/x01/desktop.generated';
import { X01Mobile } from '@/screens/x01/mobile.generated';
import { X02Desktop } from '@/screens/x02/desktop.generated';
import { X02DesktopPanneau } from '@/screens/x02/desktoppanneau.generated';
import { X02Mobile } from '@/screens/x02/mobile.generated';
import { chargerM01, chargerM01Bloque, chargerX01, chargerX02 } from './appels';
import { EcranMessages } from './ecran';
import type { FeuilleMessages } from './feuilles';

/**
 * LES COQUILLES QUI CHARGENT — messagerie, recherche, notifications.
 *
 * ── POURQUOI CE FICHIER EXISTE, ET C'EST UN DÉFAUT DÉJÀ PAYÉ ICI ────────────
 *
 * Une fonction exportée d'un module `'use client'` et appelée depuis un composant
 * SERVEUR n'est pas une fonction : c'est une RÉFÉRENCE client. L'appeler pendant le
 * rendu jette, et la route répond `500`. C'est arrivé sur `/messages/:id` — le
 * symptôme visible était « aucune boîte de dialogue », qui ne nommait pas la cause
 * — et c'est pour cela que `./feuilles.ts` n'est PAS un module client.
 *
 * La règle qui en découle, et que ce fichier respecte : les pages restent des
 * composants SERVEUR qui lisent `searchParams` et RENDENT des composants clients.
 * Elles n'appellent aucune fonction de ce module ni de `./appels.ts` — elles
 * passent des valeurs simples en propriétés. Le chargement, lui, est forcément
 * client : le jeton d'accès vit en MÉMOIRE, dans la clôture de
 * `lib/api/session.ts`, et n'existe que dans le navigateur.
 *
 * ── `charger` DOIT ÊTRE STABLE ──────────────────────────────────────────────
 *
 * `useDonnees` a `charger` dans ses dépendances, et c'est voulu : un appelant qui
 * fournirait une fonction anonyme rechargerait en boucle, et c'est une propriété
 * qu'on veut VISIBLE plutôt que masquée. Les coquilles ci-dessous passent donc soit
 * une fonction de module (`chargerX02`), soit un `useCallback` mémoïsé sur la seule
 * valeur dont l'appel dépend.
 *
 * ── LA PHRASE D'ATTENTE EST LA NÔTRE ───────────────────────────────────────
 *
 * `EcranDonnees` vient du module Compte et dit « Chargement de votre compte… » par
 * défaut. On le réemploie — le mécanisme est éprouvé, et en écrire un second
 * donnerait deux traitements d'erreur à tenir à jour — mais avec notre propre
 * phrase : annoncer « votre compte » sur `/messages` serait un texte d'interface
 * faux, et un lecteur d'écran l'annoncerait tel quel.
 *
 * ⚠ CES DEUX ÉTATS NE SONT TRANSCODÉS DE RIEN. `09 Messages et transverse` ne
 * dessine ni attente ni échec — aucune de ses planches ne montre un squelette, un
 * sablier ou un bandeau d'erreur. Ils viennent donc de `EcranDonnees`, qui n'emploie
 * que des jetons de la maquette et le dit dans son propre en-tête.
 */

/** Quelle paire de cadres M01 sert cette route. C'est la maquette qui en décide. */
export type VueMessagerie = 'liste' | 'conversation' | 'bloque';

/**
 * M01 — les deux routes de messagerie et les trois fenêtres qu'elles ouvrent.
 *
 * LE CADRE D'ORDINATEUR EST LE MÊME POUR LES TROIS VUES, parce que la maquette n'en
 * dessine qu'un : deux volets côte à côte, liste à gauche et conversation à droite.
 * Seul le cadre MOBILE change — « MOBILE · LISTE » sur `/messages`, « MOBILE ·
 * CONVERSATION » sur `/messages/:id`.
 *
 * `{...donnees}` PLUTÔT QU'UNE PROPRIÉTÉ PAR CHAMP : les cadres transcodés reçoivent
 * leur type entier (`M01Data`), et c'est le générateur qui a déduit lesquels de ses
 * champs chacun lit. Les énumérer ici dupliquerait cette déduction, et la copie
 * serait fausse à la première liaison ajoutée.
 */
export function EcranMessagerie({
  vue,
  conversationId,
  ouverte = null,
}: {
  readonly vue: VueMessagerie;
  readonly conversationId: string | null;
  readonly ouverte?: FeuilleMessages | null;
}) {
  const bloque = vue === 'bloque';
  const charger = useCallback(
    () => (bloque ? chargerM01Bloque(conversationId) : chargerM01(conversationId)),
    [bloque, conversationId],
  );

  return (
    <EcranDonnees charger={charger} attente="Chargement de vos messages…">
      {(donnees) => (
        <EcranMessages
          desktop={bloque ? <M01BloqueDesktop {...donnees} /> : <M01Desktop {...donnees} />}
          mobile={
            vue === 'liste' ? (
              <M01Mobile {...donnees} />
            ) : bloque ? (
              <M01BloqueMobileConversation {...donnees} />
            ) : (
              <M01MobileConversation {...donnees} />
            )
          }
          ouverte={ouverte}
        />
      )}
    </EcranDonnees>
  );
}

/**
 * X01 — la recherche.
 *
 * LA REQUÊTE VIENT DE L'URL (`?q=`), et c'est la seule façon honnête de la lui
 * donner : la maquette dessine un CHAMP de recherche, pas un formulaire branché, et
 * le rendre actif demanderait de modifier le JSX transcodé. L'URL la rend
 * atteignable et éprouvable sans ajouter un pixel — même choix que `?vue=` pour le
 * panneau des notifications et que `?etat=` dans le module Parcours.
 *
 * ⚠ AUCUNE SAISIE N'EST BRANCHÉE, donc. Le champ reste ce que la maquette en
 * dessine, comme le composeur du fil et comme « Publier ».
 */
export function EcranRecherche({ requete }: { readonly requete: string }) {
  const charger = useCallback(() => chargerX01(requete), [requete]);

  return (
    <EcranDonnees charger={charger} attente="Recherche en cours…">
      {(donnees) => (
        <ScreenFrames
          screen="X01"
          desktop={<X01Desktop {...donnees} />}
          mobile={<X01Mobile {...donnees} />}
        />
      )}
    </EcranDonnees>
  );
}

/**
 * X02 — les notifications, page complète ou panneau déroulant (12 §2.7).
 *
 * `chargerX02` est une fonction de MODULE : elle ne dépend d'aucun paramètre, donc
 * elle est stable par construction et n'a pas besoin d'être mémoïsée.
 *
 * LE PANNEAU N'A PAS DE FORME MOBILE DESSINÉE : sur téléphone, la maquette ne montre
 * que la page complète. Le cadre mobile ne change donc pas selon la vue.
 */
export function EcranNotifications({ panneau }: { readonly panneau: boolean }) {
  return (
    <EcranDonnees charger={chargerX02} attente="Chargement de vos notifications…">
      {(donnees) => (
        <ScreenFrames
          screen="X02"
          desktop={
            panneau ? <X02DesktopPanneau {...donnees} /> : <X02Desktop {...donnees} />
          }
          mobile={<X02Mobile {...donnees} />}
        />
      )}
    </EcranDonnees>
  );
}
