'use client';

import { useEffect } from 'react';
import { hasAccessToken, resumeSession } from '@/lib/api/index';

/**
 * REPRENDRE LA SESSION AU CHARGEMENT DE L'APPLICATION.
 *
 * Le socle le demande en une ligne — « `resumeSession()` au chargement de
 * l'application » — et personne ne l'appelait. Ce composant est cet appel, et il
 * n'affiche rien.
 *
 * ── POURQUOI IL FAUT LE FAIRE, ALORS QUE TOUT MARCHAIT ──────────────────────
 *
 * Le jeton d'accès vit en MÉMOIRE et meurt avec l'onglet (voir `api/session.ts` :
 * l'écrire dans `localStorage` annulerait le soin pris à mettre le jeton de
 * rafraîchissement en cookie `httpOnly`). Le cookie, lui, dure trente jours. Un
 * rechargement laisse donc une session parfaitement valide SANS jeton en main.
 *
 * Ça « marchait » quand même, parce que le transport rafraîchit sur `401` puis
 * rejoue l'appel. Mais cela veut dire qu'après chaque rechargement, le PREMIER
 * appel de chaque page part sans jeton, prend un `401`, déclenche une rotation du
 * jeton de rafraîchissement, et repart. Trois défauts en découlent :
 *
 *   1. un `401` dans le journal du serveur à chaque rechargement, sur une session
 *      valide — donc un signal qui ne veut plus rien dire ;
 *   2. les appels qui NE rejouent pas sont perdus. Un `GET` public s'en moque ;
 *      un écran qui lit `/me` au montage affiche l'état « déconnecté » le temps
 *      d'un aller-retour, et les écrans branchés sur `.catch(() => undefined)`
 *      avalent l'échec sans jamais réessayer ;
 *   3. plusieurs appels au montage prenaient chacun leur `401`. Le
 *      rafraîchissement est partagé en vol, donc la chaîne n'est pas révoquée —
 *      mais c'est le partage qui sauve, pas la conception.
 *
 * ── CE QUE CETTE CORRECTION OUVRE, PARCE QU'IL FAUT SE LE DEMANDER ──────────
 *
 * L'histoire de ce projet est une correction d'authentification qui a ouvert une
 * élévation de privilège (`api/session.ts`, point 3). Alors : que fait celle-ci ?
 *
 *   · elle n'installe aucun droit. `resumeSession()` échange un cookie contre un
 *     jeton d'accès NEUF, émis par le serveur, avec le niveau lu en base à cet
 *     instant. C'est l'inverse d'un niveau gardé ;
 *   · elle ne CONTOURNE pas `level_refresh_required`. Le drapeau est lu par le
 *     garde à chaque appel, et le jeton neuf porte le niveau courant. Un membre
 *     rétrogradé qui recharge la page obtient un jeton de son NOUVEAU niveau ;
 *   · elle ne ressuscite pas une session morte : `refreshOnce` sort d'emblée si
 *     `isSessionDead()`, et une session révoquée reçoit `401` puis reste morte ;
 *   · elle ne peut pas marteler `/auth/refresh` (`@RateLimit(30)`) : elle
 *     n'appelle qu'une fois, et seulement si aucun jeton n'est en main.
 *
 * Le garde `hasAccessToken()` est ce dernier point. Sans lui, un remontage —
 * Fast Refresh, un changement de mise en page — ferait TOURNER le jeton de
 * rafraîchissement alors qu'un jeton d'accès valide est déjà là. Or la rotation
 * n'est pas gratuite : chaque usage incrémente `token_generation`, et c'est
 * précisément la mécanique qui détecte les rejeux.
 */
export function SessionBoot() {
  useEffect(() => {
    // Un jeton déjà en main : rien à reprendre. Le rafraîchir ferait tourner le
    // jeton de rafraîchissement pour rien.
    if (hasAccessToken()) return;
    // Le résultat n'est pas lu : `false` peut vouloir dire « pas connecté »
    // comme « réseau coupé », et cet appel n'a pas à trancher. Les écrans qui ont
    // besoin de la réponse appellent `fetchMe()`, qui la leur donnera.
    void resumeSession().catch(() => undefined);
  }, []);

  return null;
}
