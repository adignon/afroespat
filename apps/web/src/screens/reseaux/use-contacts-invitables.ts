'use client';

import { useEffect, useRef, useState } from 'react';
import { myConnectionsResponseSchema } from '@app/shared';
import { memberApi } from '@/lib/api/index';
import { avatarColor, initials } from '../accueil/from-api';
import type { InviteeView } from '../a10/data';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES CANDIDATS À L'INVITATION DE A10 — ENFIN UNE LISTE                      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Créer un réseau : oui fais-le. »
 *
 * ── CE QUI BLOQUAIT, MESURÉ ─────────────────────────────────────────────────
 *
 * `POST /communities` exige `COMMUNITY_MIN_INVITES` = 5 invitations
 * (`createCommunitySchema`, et le service revérifie). L'écran A10 avait son geste
 * d'invitation branché — `A10_INVITER` bascule vraiment — mais la page lui
 * passait `AUCUN_CANDIDAT`, un tableau vide figé. Le compteur restait donc à
 * « 0 sur 5 », `creerPret` à faux, et le bouton « Créer le réseau » ne s'allumait
 * JAMAIS. Créer un réseau depuis l'interface était impossible, pas seulement
 * incomplet.
 *
 * ── POURQUOI AUCUNE ROUTE DU MODULE NE POUVAIT LA REMPLIR ───────────────────
 *
 * `GET /communities/:id/members` rend les membres d'un RÉSEAU, pas les relations
 * du lecteur — et il faut un réseau pour l'appeler, alors qu'ici on n'en a pas
 * encore. Les contacts vivent dans le module `connections` :
 * `GET /me/connections`.
 *
 * ── L'APPEL EST RÉEMPLOYÉ, PAS RÉÉCRIT ─────────────────────────────────────
 *
 * `memberApi.get('/me/connections', myConnectionsResponseSchema)` est exactement
 * l'appel que la fenêtre de partage (`components/fenetre-partage.tsx`), la
 * fenêtre « Créer » de la barre haute (`components/barre-haute/raccourcis.tsx`) et
 * la page des contacts (`screens/compte/appels.ts`, `chargerK05`) font déjà. Le
 * schéma vient de `@app/shared` ; rien n'est inventé ici, et il n'y a pas de
 * second point d'entrée.
 *
 * `GET /me/connections` REND LE MEMBRE À PLAT — `userId`, `handle`, `displayName`,
 * `avatarUrl`, `origin`, `connectedAt` — et non sous une clé `member`. Vérifié
 * au schéma (`myConnectionsResponseSchema`), pas supposé.
 *
 * ── ÉCART DE MAQUETTE, REMONTÉ PLUTÔT QUE COMBLÉ ───────────────────────────
 *
 * La planche écrit sous chaque nom une VILLE — « Lyon 3e », « Lyon 7e »,
 * « Bordeaux » — et cette route n'en rend aucune : son `MEMBER_SELECT` s'arrête
 * à l'identifiant, au pseudo, au nom et à l'avatar. C'est le MÊME écart que
 * `chargerK05` signale déjà pour la page des contacts, et pour la même route.
 *
 * La ligne porte donc le PSEUDO (`@handle`), qui est une donnée réelle de la même
 * route — et qui est en plus ce que le champ « Rechercher par pseudo » de la
 * planche promet de chercher, et ce que `inviteHandles` envoie. Composer une
 * ville qu'on n'a pas reçue serait pire qu'un sous-titre différent.
 *
 * La planche dessine aussi une PASTILLE DE VÉRIFICATION (le rond vert à coche)
 * après chaque nom. Elle n'est pas liée : `myConnectionsResponseSchema` ne porte
 * aucun niveau de vérification, et le rendre conditionnel demanderait un champ
 * que la route n'a pas. Le rond reste donc dessiné sur toutes les lignes, comme
 * avant. REMONTÉ.
 *
 * ── LE CHARGEMENT, ET POURQUOI C'EST UN `useRef` ───────────────────────────
 *
 * Une liste VIDE est une RÉPONSE, pas une absence de réponse : décider « faut-il
 * demander ? » sur `contacts.length === 0` repart en boucle pour un membre sans
 * contact. C'est le défaut mesuré au navigateur sur `FenetreRaccourcis`, et son
 * en-tête le raconte en entier. On retient donc qu'on a DEMANDÉ, dans un `useRef`
 * qui ne relance pas l'effet.
 */
export interface ContactsInvitables {
  /** Les candidats, prêts pour `useCreation` — qui n'y pose que l'état choisi. */
  readonly candidats: readonly InviteeView[];
  /** Vrai tant que la route n'a pas répondu. L'écran n'en dessine rien aujourd'hui. */
  readonly chargement: boolean;
  /**
   * La route a-t-elle répondu une liste VIDE ?
   *
   * C'est le seul état qu'il faut DIRE à l'écran : sans aucun contact, les cinq
   * invitations sont hors d'atteinte et le bouton ne s'allumera pas. Laisser une
   * carte « Invitez au moins 5 membres » vide sans un mot ferait chercher la
   * panne dans le bouton.
   */
  readonly aucun: boolean;
}

/**
 * Le repli, en CONSTANTE DE MODULE et non en `[]` écrit dans le `useState` : un
 * tableau neuf à chaque rendu change l'identité de la dépendance et refait tous
 * les `useMemo` de `useCreation` à chaque frappe dans le champ du nom. C'est la
 * raison pour laquelle `AUCUN_CANDIDAT` existait déjà dans la page.
 */
const VIDE: readonly InviteeView[] = [];

export function useContactsInvitables(): ContactsInvitables {
  const [candidats, setCandidats] = useState<readonly InviteeView[]>(VIDE);
  const [chargement, setChargement] = useState(true);
  const demande = useRef(false);

  useEffect(() => {
    if (demande.current) return;
    demande.current = true;
    void memberApi
      .get('/me/connections', myConnectionsResponseSchema)
      .then((page) => {
        setCandidats(
          page.items.map((c) => ({
            /**
             * LE NOM MÈNE AU PROFIL PUBLIC. Le porteur : « ajoute l'accès au
             * profil public d'un utilisateur […] partout où le nom est
             * affiché ». Ici le handle est connu et c'est bien un membre, donc
             * l'adresse est posée — c'est la garde que `profil` facultatif sert.
             */
            profil: `/@${c.handle}`,
            i: initials(c.displayName),
            name: c.displayName,
            /** Le pseudo, faute de ville : voir l'en-tête de ce fichier. */
            sub: `@${c.handle}`,
            bg: avatarColor(c.handle),
            /**
             * LES QUATRE PRISES DE BOUTON SONT CELLES DU REPOS, et c'est
             * `useCreation` qui les repeint selon ce qui est choisi. Les composer
             * ici aussi ferait deux endroits qui décident de la même couleur.
             */
            invited: false,
            btn: 'Inviter',
            btnBg: '#16785E',
            btnFg: '#fff',
            handle: c.handle,
          })),
        );
      })
      /**
       * UN REFUS NE VIDE PAS L'ÉCRAN. La page affiche déjà les refus de la
       * CRÉATION (`echec`) ; un échec de chargement de contacts laisse la carte
       * d'invitation vide, ce que `aucun` dit. Une notification de plus à
       * l'arrivée sur un formulaire serait du bruit.
       */
      .catch(() => undefined)
      .finally(() => setChargement(false));
  }, []);

  return { candidats, chargement, aucun: !chargement && candidats.length === 0 };
}
