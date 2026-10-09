'use client';

import { useCallback, useState } from 'react';
import { EcranDonnees } from '@/screens/compte/ecran-donnees';
import { ScreenFrames } from '@/screens/frames';
import type { BarreHaute } from './data';
import type { M01Data } from '@/screens/m01/data';
import type { EtatVideRecherche, X01Data } from '@/screens/x01/data';
import type { X02Data } from '@/screens/x02/data';
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
import {
  chargerM01,
  chargerM01Bloque,
  chargerX01,
  chargerX02,
  filtresNotifications,
} from './appels';
import { EcranMessages } from './ecran';
import { ConversationVivante } from './conversation-vivante';
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
  /**
   * ── RECHARGER APRÈS UN ENVOI ─────────────────────────────────────────────
   *
   * `useDonnees` n'expose aucun rappel de rechargement : il relance son effet
   * quand `charger` CHANGE D'IDENTITÉ, et c'est écrit en toutes lettres dans son
   * en-tête (« `charger` doit être stable »). On fait donc dépendre le
   * `useCallback` d'un compteur : l'incrémenter donne une nouvelle fonction, donc
   * un nouveau chargement, et c'est le seul mécanisme que ce crochet offre.
   *
   * LES DONNÉES AFFICHÉES NE CLIGNOTENT PAS : `useDonnees` ne repasse pas en
   * « attente », il remplace l'état quand la réponse arrive. Le fil reste donc
   * lisible pendant le rechargement, au lieu de retomber sur le squelette à
   * chaque message envoyé.
   */
  const [recharge, setRecharge] = useState(0);
  const charger = useCallback(
    () => (bloque ? chargerM01Bloque(conversationId) : chargerM01(conversationId)),
    /** `recharge` n'est lu par personne : il est là POUR changer l'identité. */
    [bloque, conversationId, recharge],
  );
  const recharger = useCallback(() => {
    setRecharge((n) => n + 1);
  }, []);

  return (
    <EcranDonnees
      charger={charger}
      attente="Chargement de vos messages…"
      /*
       * LE CADRE EST SERVI AVANT LA DONNEE : `/messages` repondait 200 avec
       * QUATRE mots et zero entree de rail. Voir `SQUELETTE_M01`.
       */
      squelette={SQUELETTE_M01}
    >
      {(donnees) => (
        <ConversationVivante
          donnees={donnees}
          conversationId={conversationId}
          onRecharger={recharger}
        >
          {(vivantes, menu, signalement) => (
            <EcranMessages
              desktop={
                bloque ? <M01BloqueDesktop {...vivantes} /> : <M01Desktop {...vivantes} />
              }
              mobile={
                vue === 'liste' ? (
                  <M01Mobile {...vivantes} />
                ) : bloque ? (
                  <M01BloqueMobileConversation {...vivantes} />
                ) : (
                  <M01MobileConversation {...vivantes} />
                )
              }
              ouverte={ouverte}
              menu={menu}
              signalement={signalement}
            />
          )}
        </ConversationVivante>
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
export function EcranRecherche({ requete, type }: {
  readonly requete: string;
  /**
   * LE FILTRE DE TYPE, de `?type=` — « il faut que la left side bar contienne
   * plutôt les filtres […] avec le nombre matché ». Il voyage par l'URL et non par
   * un état local, pour trois raisons qui se tiennent : le filtre est PARTAGEABLE,
   * il survit au rechargement, et il reste mesurable au HTML servi. C'est le même
   * choix que `?q=`, que `?vue=` pour les notifications et que `?etat=` dans
   * Parcours.
   */
  readonly type: string | null;
}) {
  const charger = useCallback(() => chargerX01(requete, type), [requete, type]);

  return (
    <EcranDonnees
      charger={charger}
      attente="Recherche en cours…"
      /**
       * ╔══════════════════════════════════════════════════════════════════════╗
       * ║ « LE LOADER EST PLACÉ EN BAS. MAL PLACÉ. »                          ║
       * ╚══════════════════════════════════════════════════════════════════════╝
       *
       * Le porteur, et il a raison pour CET écran. La bande fixe au bas de la
       * fenêtre est le bon compromis sur les quarante autres — une attente dans le
       * flux descendrait tout le cadre de sa hauteur — mais la recherche a un
       * endroit qui attend justement cette réponse : la colonne de résultats. La
       * phrase y va, et la bande se tait.
       *
       * ELLE EST PORTÉE PAR LE SQUELETTE, donc par le MÊME emplacement que
       * « Aucun résultat » : une seule place dans le cadre pour « ce qui se passe
       * ici », qu'on attende ou qu'on n'ait rien trouvé.
       */
      bandeAttente={false}
      /*
       * LE CADRE EST SERVI AVANT LA DONNEE : `/recherche` repondait 200 avec
       * QUATRE mots et zero entree de rail. Voir `SQUELETTE_X01`.
       */
      squelette={{ ...SQUELETTE_X01, vide: ATTENTE_X01 }}
    >
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
/**
 * `type` VIENT DE L'URL, et la page le passe ici — composant SERVEUR oblige :
 * `useSearchParams()` servirait un HTML vide, c'est écrit dans sa page.
 *
 * `useCallback` sur `charger` : `useDonnees` relance son effet quand l'identité
 * de cette fonction change, et c'est le seul mécanisme qu'il offre. Sans lui, un
 * changement de filtre ne rechargerait rien.
 */
export function EcranNotifications({
  panneau,
  filtre = '*',
}: {
  readonly panneau: boolean;
  readonly filtre?: string;
}) {
  const charger = useCallback(() => chargerX02(filtre), [filtre]);
  return (
    <EcranDonnees
      charger={charger}
      attente="Chargement de vos notifications…"
      /*
       * LE CADRE EST SERVI AVANT LA DONNEE : `/notifications` repondait 200 avec
       * CINQ mots et zero entree de rail. Voir `SQUELETTE_X02`.
       */
      squelette={SQUELETTE_X02}
    >
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

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE DESSIN SANS LA DONNÉE — MESSAGERIE, RECHERCHE, NOTIFICATIONS            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Mesuré au HTML servi, avec le détecteur du dépôt (`motsVisibles`, qui retire
 * les `<script>` — sans quoi on compte la charge RSC de Next comme du texte) :
 *
 *     /messages       200  4 mots  rail 0/5  « DisaporyPlus Chargement de vos messages… »
 *     /recherche      200  4 mots  rail 0/5  « DisaporyPlus Recherche en cours… »
 *     /notifications  200  5 mots  rail 0/5  « DisaporyPlus Chargement de vos notifications… »
 *
 * CES TROIS ÉCRANS NE SONT PAS DE MON PÉRIMÈTRE DE DÉCLARATION, et c'est
 * délibéré de les corriger quand même : la correction est dans du CODE ÉCRIT À LA
 * MAIN (`squelette`, une propriété de la coquille partagée), pas dans un
 * `tools/screens/*.mjs`. Elle ne peut donc entrer en conflit avec le lot de
 * personne, et laisser trois routes du rail servir une coquille vide pendant que
 * les quatre autres sont réparées aurait fait un produit à moitié visible.
 *
 * Tout est vide ou à zéro : un écran qui n'a pas encore ses conversations n'en
 * affiche aucune, et `nonLusTotal: 0` est le seul nombre qu'on puisse écrire sans
 * mentir — annoncer des non-lus qu'on n'a pas comptés serait pire.
 */
const SOCLE_BARRE: BarreHaute = { initiales: '', prenom: '' };

export const SQUELETTE_M01: M01Data = {
  moi: SOCLE_BARRE,
  conversations: [],
  demandes: { total: 0, liste: [] },
  entete: { nom: '', sousTitre: '', estParcours: false, photo: null, initiales: '', fond: '#E0733A', profil: null },
  messages: [],
};

/**
 * `requete: ''` et NON la requête tapée : ce squelette est une CONSTANTE de
 * module, donc il ne peut pas la porter. Conséquence assumée : pendant l'appel,
 * le champ de recherche est vide à l'écran, puis se remplit. Le faire autrement
 * demanderait un squelette par rendu, donc une fabrique — et `useDonnees` exige
 * une référence STABLE, ce qui est précisément le piège que la fonction anonyme
 * tend (rechargement en boucle).
 */
export const SQUELETTE_X01: X01Data = {
  moi: SOCLE_BARRE,
  requete: '',
  suggestions: [],
  /** Aucun filtre et aucun résultat : le squelette ne PRÉTEND rien. */
  filtres: [],
  resultats: [],
  /**
   * AUCUN ÉTAT VIDE DANS LA CONSTANTE ELLE-MÊME.
   *
   * C'est le piège exact de ce squelette : « aucun résultat » est VRAI au moment
   * où il est rendu — la réponse n'est pas là — et FAUX une demi-seconde plus
   * tard. Afficher « Aucun résultat » pendant le chargement ferait repartir le
   * membre avant que la page ait répondu.
   *
   * `EcranRecherche` y substitue `ATTENTE_X01`, qui dit la seule chose vraie à ce
   * moment-là : qu'on cherche.
   */
  vide: null,
};

/**
 * CE QUE LA COLONNE DE RÉSULTATS DIT PENDANT QU'ON CHERCHE.
 *
 * Même emplacement que « Aucun résultat », parce que c'est le même endroit de
 * l'écran qui répond à la même question — « que se passe-t-il ici ? ». Aucun
 * bouton : il n'y a rien à faire pendant une attente, et proposer un geste qui
 * disparaîtra dans une demi-seconde est un geste qu'on rate.
 */
export const ATTENTE_X01: EtatVideRecherche = {
  titre: 'Recherche en cours…',
  invite: '',
  bouton: '',
  href: '',
};

export const SQUELETTE_X02: X02Data = {
  moi: SOCLE_BARRE,
  lignes: [],
  nonLusTotal: 0,
  /**
   * LES PASTILLES SONT LÀ AVANT LA LISTE : elles ne dépendent d'aucune réponse,
   * et une rangée de filtres qui apparaît après coup fait sauter la page.
   */
  filtres: filtresNotifications('*'),
};
