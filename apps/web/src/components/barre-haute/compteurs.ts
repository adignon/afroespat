'use client';

import { useEffect, useState } from 'react';
import { conversationsResponseSchema, notificationsResponseSchema } from '@app/shared';
import { hasAccessToken, memberApi, resumeSession } from '@/lib/api/member';
import { RESYNCHRONISER } from '@/lib/temps-reel';
import { useEvenements, useRepliPolling } from '@/lib/use-temps-reel';
import { diffuserCompteurs, useAutresOnglets } from '@/lib/entre-onglets';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES DEUX COMPTEURS DE LA BARRE HAUTE — DEMANDÉS UNE SEULE FOIS PAR PAGE   ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Corrige la top bar qui n'est pas du tout dynamique en termes de
 * données, de liens et autres, donc simplement non fonctionnelle. »
 *
 * MESURÉ avant : la barre ne contenait QU'UN SEUL nœud nommé — le mot
 * « Diaspora ». Le champ de recherche était un `<div>` portant un texte en dur, le
 * `+` et les deux icônes étaient des `<span>` sans geste, et la pastille orange
 * d'alerte était peinte en permanence — elle annonçait des messages non lus à qui
 * n'en avait aucun.
 *
 * ── POURQUOI UN MODULE, ET PAS UN APPEL DANS CHAQUE ICÔNE ─────────────────
 *
 * La barre porte DEUX icônes qui veulent chacune leur compte. Montées côte à
 * côte, elles demanderaient chacune sa route à chaque page, et la barre est sur
 * soixante-cinq planches. Le compte est donc mémoïsé LE TEMPS DE LA PAGE : la
 * première icône déclenche l'appel, la seconde s'abonne à la même promesse.
 *
 * ── LE RAFRAÎCHISSEMENT ────────────────────────────────────────────────────
 *
 * Voir `useCompteursBarre` plus bas : les comptes suivent le temps réel, avec le
 * polling de 15 s (§5.3) comme filet quand la socket est coupée.
 */
export interface CompteursBarre {
  /** Conversations non lues — `meta.unreadTotal` de `GET /conversations`. */
  readonly messages: number;
  /** Notifications non lues — `meta.unread` de `GET /notifications`. */
  readonly notifications: number;
}

const VIDE: CompteursBarre = { messages: 0, notifications: 0 };

/** La promesse en cours, partagée par les deux icônes de la même page. */
let enCours: Promise<CompteursBarre> | null = null;

async function demander(): Promise<CompteursBarre> {
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ ON ATTEND QUE LA SESSION SOIT REPRISE AVANT DE DEMANDER QUOI QUE CE SOIT ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * MESURÉ au navigateur, sur `/entraide` : trois `401` au premier rendu —
   * `/conversations`, `/notifications` et `/me` — puis un `/auth/refresh`, puis les
   * trois mêmes appels en `200`. SIX requêtes pour en servir trois.
   *
   * La cause n'est pas un défaut : le jeton d'accès vit en MÉMOIRE (voir
   * `api/session.ts`), donc il n'existe pas au premier rendu d'un onglet. La garde
   * de session le reprend, mais elle rend ses enfants PENDANT la reprise — et c'est
   * délibéré, sans quoi le HTML servi redeviendrait vide.
   *
   * Le socle rattrape ces `401` et rejoue, donc rien n'était cassé. Ce qui l'était :
   * chaque page du produit partait avec trois requêtes vouées au refus, et le nom
   * du membre clignotait le temps d'un aller-retour de plus. On attend donc la
   * reprise — `resumeSession` est la MÊME promesse partagée que la garde emploie
   * (`refreshOnce`, unique en vol), donc attendre ici ne déclenche aucune rotation
   * de plus : on s'abonne à celle qui tourne déjà.
   */
  if (!hasAccessToken()) await resumeSession();

  /**
   * `allSettled` et non `all` : une pastille est un ACCESSOIRE. Si les
   * notifications échouent, la barre doit quand même dire les messages — et
   * surtout, elle ne doit pas disparaître parce qu'un compteur manque.
   */
  const [conversations, notifications] = await Promise.allSettled([
    memberApi.get('/conversations', conversationsResponseSchema),
    memberApi.get('/notifications', notificationsResponseSchema),
  ]);
  return {
    messages: conversations.status === 'fulfilled' ? conversations.value.meta.unreadTotal : 0,
    notifications: notifications.status === 'fulfilled' ? notifications.value.meta.unread : 0,
  };
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES COMPTEURS SONT MAINTENANT EN DIRECT (08 §7.3, T4 §7)                   ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le paragraphe « ce qui n'est pas fait » plus haut disait : aucun rafraîchissement.
 * C'était vrai tant que le front n'avait aucun client temps réel. Il en a un
 * (`lib/temps-reel`), et la barre s'y abonne :
 *
 *   · `notification.new` porte le compte de non-lues — la cloche le prend TEL
 *     QUEL, sans relire la liste ;
 *   · `message.new`, `message.read`, `conversation.updated` obligent à relire
 *     `GET /conversations` (le total de non-lus est une somme que le client ne
 *     peut pas deviner) — au plus une relecture par rafale, d'où le délai ;
 *   · à chaque (re)connexion, tout est relu : un événement manqué pendant la
 *     coupure n'est jamais rejoué ;
 *   · socket coupée : le polling de 15 s prend le relais (`useRepliPolling`).
 *
 * L'état est UN, au niveau du module, et chaque icône s'y abonne : la cloche et
 * la bulle de la même page restent cohérentes, et la barre de la page suivante
 * repart de la dernière valeur connue au lieu de clignoter à zéro.
 */
let courants: CompteursBarre = VIDE;
const abonnes = new Set<(c: CompteursBarre) => void>();
let relecture: ReturnType<typeof setTimeout> | null = null;

function publier(suite: CompteursBarre): void {
  if (suite.messages === courants.messages && suite.notifications === courants.notifications) return;
  courants = suite;
  abonnes.forEach((a) => {
    a(suite);
  });
}

/** Relit les deux comptes, au plus une fois par rafale d'événements. */
function relireBientot(): void {
  if (relecture !== null) return;
  relecture = setTimeout(() => {
    relecture = null;
    const aDiffuser = diffuserApresRelecture;
    diffuserApresRelecture = false;
    enCours = demander();
    void enCours
      .then((suite) => {
        publier(suite);
        // Lot F2 : le geste vient de CET onglet, les autres doivent suivre (voir `lib/entre-onglets`).
        if (aDiffuser) diffuserCompteurs(suite);
      })
      .catch(() => undefined);
  }, 250);
}

/** Vrai quand la prochaine relecture suit un geste local (marquer lu) : on la diffuse. */
let diffuserApresRelecture = false;

/**
 * Les écrans qui changent un compte (marquer lu) demandent à la barre de le relire,
 * puis les AUTRES ONGLETS du navigateur reçoivent le résultat (lot F2).
 */
export function relireCompteursBarre(): void {
  diffuserApresRelecture = true;
  relireBientot();
}

export function useCompteursBarre(): CompteursBarre {
  const [compteurs, setCompteurs] = useState<CompteursBarre>(courants);

  useEffect(() => {
    abonnes.add(setCompteurs);
    enCours ??= demander();
    void enCours.then(publier).catch(() => undefined);
    return () => {
      abonnes.delete(setCompteurs);
    };
  }, []);

  useEvenements(
    ['notification.new', 'message.new', 'message.read', 'conversation.updated', RESYNCHRONISER],
    (evenement, payload) => {
      if (evenement === 'notification.new') {
        const unread = (payload as { unread?: unknown } | null)?.unread;
        if (typeof unread === 'number') {
          publier({ ...courants, notifications: unread });
          return;
        }
      }
      relireBientot();
    },
  );
  useRepliPolling(relireBientot);
  // Un autre onglet vient de marquer lu : on prend ses comptes tels quels.
  useAutresOnglets(publier);

  return compteurs;
}

/** Pour les épreuves : oublie ce qui a été demandé. */
export function oublierCompteursBarre(): void {
  enCours = null;
  courants = VIDE;
  if (relecture !== null) clearTimeout(relecture);
  relecture = null;
}
