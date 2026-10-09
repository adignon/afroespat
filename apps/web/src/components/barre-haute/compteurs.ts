'use client';

import { useEffect, useState } from 'react';
import { conversationsResponseSchema, notificationsResponseSchema } from '@app/shared';
import { hasAccessToken, memberApi, resumeSession } from '@/lib/api/member';

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
 * ── CE QUI N'EST PAS FAIT, ET POURQUOI ────────────────────────────────────
 *
 * Aucun rafraîchissement en boucle. §5.3 décrit un repli en polling toutes les
 * quinze secondes pour la MESSAGERIE OUVERTE ; la barre, elle, n'a pas d'état de
 * rafraîchissement dessiné, et faire clignoter une pastille sans le dire serait
 * pire que de la laisser juste au chargement. Le compte se met à jour en changeant
 * de page, ce qui est le geste qui l'amène à regarder.
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
 * Les compteurs, pour la page courante.
 *
 * Rend `0` tant que la réponse n'est pas là — donc AUCUNE pastille. C'est le sens
 * juste de l'attente : annoncer du non-lu qu'on n'a pas encore compté serait
 * exactement le défaut qu'on corrige.
 */
export function useCompteursBarre(): CompteursBarre {
  const [compteurs, setCompteurs] = useState<CompteursBarre>(VIDE);

  useEffect(() => {
    let vivant = true;
    enCours ??= demander();
    void enCours
      .then((valeurs) => {
        if (vivant) setCompteurs(valeurs);
      })
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  }, []);

  return compteurs;
}

/** Pour les épreuves : oublie ce qui a été demandé. */
export function oublierCompteursBarre(): void {
  enCours = null;
}
