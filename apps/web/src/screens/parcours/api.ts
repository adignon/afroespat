'use client';

/**
 * LES APPELS DU MODULE PARCOURS — et rien d'autre.
 *
 * Un fichier par domaine d'écrans, et il ne contient que des appels : pas de
 * transformation, pas d'état, pas de composant. Ce qui arrive ici est ce que l'API
 * a dit, validé par le schéma que `@app/shared` en donne. La conversion vers les
 * prises du JSX et l'état vivent à côté, chacun dans son fichier — c'est la forme
 * que le branchement de A01 a posée.
 *
 * ── CE QUI N'EST PAS ÉCRIT ICI ──────────────────────────────────────────────
 *
 * AUCUN SCHÉMA. Ils viennent tous de `@app/shared` (`00` §4) : un schéma de
 * réponse recopié dans le front serait une seconde source, et deux sources
 * divergent toujours. Les onze de ce lot ont donc été écrits là-bas, à côté des
 * schémas de requête du même module — et éprouvés sur des charges relevées octet
 * pour octet (`packages/shared/src/__tests__/journeys-responses.test.ts`).
 *
 * AUCUN TYPE DE RÉPONSE ÉCRIT À LA MAIN : tous sont dérivés par `z.infer`. Un type
 * écrit à la main à côté d'un schéma est un commentaire que le compilateur croit.
 *
 * AUCUNE GESTION DE JETON. Le socle le porte, le rafraîchit une fois et rejoue.
 *
 * AUCUNE DÉCISION SUR LE NIVEAU. Pas de `if (level === 'L1')` : on tente l'action,
 * et le serveur répond `403 LEVEL_REQUIRED` avec de quoi afficher l'invitation de
 * §7.3. `partage_refus_niveau.json` est cette réponse, relevée telle quelle.
 *
 * ── CE QUI MANQUE, ET POURQUOI ON NE LE FORCE PAS ───────────────────────────
 *
 * `POST /blockers/:id/publish` et `POST /journeys/:id/steps/:stepId/share` n'ont
 * PAS de fonction ici. Ce n'est pas un oubli : les cadres J03 et J04 transcodés ne
 * portent aucune prise sur leurs boutons « Publier » et « Partager » — le
 * générateur n'écrit `onClick` que sur les libellés qu'il reconnaît, et ces
 * deux-là n'en font pas partie. Ajouter les fonctions sans le bouton qui les
 * appelle donnerait du code mort qui aurait l'air branché.
 *
 * Il se trouve que cette limite TIENT la règle dure de §3.5 — « le brouillon n'est
 * jamais promu sans cet appel ». Ce lot crée le brouillon et sait l'annuler ; il ne
 * publie rien. Ce n'est pas une garantie sur laquelle se reposer, c'est un état de
 * fait à connaître.
 */

import {
  blockerCancelledResponseSchema,
  blockerDraftResponseSchema,
  createJourneySchema,
  dismissShareResponseSchema,
  journeyActivitiesResponseSchema,
  journeyDetailResponseSchema,
  journeyFullResponseSchema,
  journeyTemplatesResponseSchema,
  journeysListResponseSchema,
  publicJourneyDetailResponseSchema,
  publicJourneysResponseSchema,
  PUBLIC_JOURNEYS_PANEL_LIMIT,
  type BlockerCancelledResponse,
  type BlockerDraftResponse,
  type CreateJourney,
  type DismissShareResponse,
  type JourneyActivitiesResponse,
  type JourneyDetailResponse,
  type JourneyFullResponse,
  type JourneyTemplatesResponse,
  type JourneysListResponse,
  type PublicJourneyDetailResponse,
  type PublicJourneysResponse,
} from '@app/shared';
/**
 * `@/lib/api/index` ET NON `@/lib/api`.
 *
 * Les deux existent : `lib/api.ts` est un module de compatibilité qui ne réexporte
 * qu'une PARTIE du socle, et c'est lui que `@/lib/api` résout — la résolution
 * préfère le fichier au dossier. Il le dit lui-même en commentaire : « à ne plus
 * employer dans du code neuf ».
 */
import { memberApi } from '@/lib/api/index';

/** §2.1 — les types de parcours proposés, résolus pour mon pays d'origine. */
export function listJourneyTemplates(): Promise<JourneyTemplatesResponse> {
  return memberApi.get('/journey-templates', journeyTemplatesResponseSchema);
}

/** §5.1 — mes parcours. Liste bornée : un seul en gratuit (§3.1). */
export function listJourneys(): Promise<JourneysListResponse> {
  return memberApi.get('/journeys', journeysListResponseSchema);
}

/**
 * §3.1 — créer un parcours.
 *
 * Le corps passe par `createJourneySchema`, LE MÊME schéma que l'API applique en
 * entrée. Un identifiant de modèle mal formé devient donc une erreur ici, sur le
 * champ, au lieu d'un aller-retour qui rend `400 VALIDATION_FAILED`.
 *
 * Trois refus attendus, et ils se distinguent sur `error.code` — jamais sur le
 * message (§5.2) :
 *
 *   · `LOCATION_REQUIRED`   — la ville d'arrivée n'est pas renseignée. Mesuré :
 *     l'API refuse la création avant l'écran O02, ce qui est l'ordre de §5 ;
 *   · `PLAN_LIMIT_REACHED`  — un parcours actif existe déjà en gratuit (§3.1).
 *     La maquette en fait une PLANCHE, pas une erreur : « Vous avez déjà un
 *     parcours actif », sans bloquer la lecture ;
 *   · `LEVEL_REQUIRED`      — la capacité `journey.create` demande un niveau.
 *     §7.3 veut une INVITATION à monter de niveau, pas une erreur sèche.
 */
export function createJourney(input: CreateJourney): Promise<JourneyDetailResponse> {
  return memberApi.post('/journeys', journeyDetailResponseSchema, {
    body: createJourneySchema.parse(input),
  });
}

/** §5.1 — un parcours complet. Employé pour retrouver l'ÉTAPE EN COURS. */
export function getJourney(journeyId: string): Promise<JourneyDetailResponse> {
  return memberApi.get(`/journeys/${journeyId}`, journeyDetailResponseSchema);
}

/**
 * §3.5, premier temps — crée le BROUILLON et rend le texte pré-rempli.
 *
 * Rien n'est publié par cet appel, et c'est tout l'intérêt de sa séparation : le
 * brouillon existe pour être relu et réécrit. Le texte publié sera celui du corps
 * de `POST /blockers/:id/publish`, jamais ce gabarit (§3.5, règle dure).
 */
export function createBlockerDraft(
  journeyId: string,
  stepId: string,
): Promise<BlockerDraftResponse> {
  return memberApi.post(
    `/journeys/${journeyId}/steps/${stepId}/blocker`,
    blockerDraftResponseSchema,
  );
}

/**
 * §3.5 — « Annuler » : le brouillon passe en `CANCELLED`.
 *
 * La réponse est PLATE (`{ id, status }`) là où la création enveloppe dans
 * `blocker`. C'est mesuré sur l'API, et le schéma le dit : supposer l'enveloppe
 * ferait lever `ApiShapeError` sur une annulation qui a pourtant réussi.
 */
export function cancelBlocker(blockerId: string): Promise<BlockerCancelledResponse> {
  return memberApi.post(`/blockers/${blockerId}/cancel`, blockerCancelledResponseSchema);
}

/**
 * §3.6 — « Plus tard » : le partage n'est PLUS JAMAIS reproposé pour cette étape.
 *
 * Idempotent côté serveur, et le premier refus est celui qui compte. C'est une
 * décision du membre, pas un report d'interface : la refermer sans l'appeler
 * ferait reproposer le partage au rechargement suivant.
 */
export function dismissShare(journeyId: string, stepId: string): Promise<DismissShareResponse> {
  return memberApi.post(
    `/journeys/${journeyId}/steps/${stepId}/dismiss-share`,
    dismissShareResponseSchema,
  );
}

/**
 * ─── LES QUATRE LECTURES QUE J01 ET J05 À J11 AJOUTENT ──────────────────────
 *
 * `getJourney` ci-dessus ne décrit QUE de quoi naviguer : l'identifiant, le titre,
 * l'étape en cours. C'était suffisant pour J03 et J04, qui ne font que résoudre
 * l'étape sur laquelle porte un geste. Les vingt-huit cadres de ce lot affichent
 * autre chose — la liste des étapes, la checklist, l'équipe, le journal, les
 * parcours publics d'autres membres.
 *
 * `readJourney` lit DONC LA MÊME ROUTE avec un schéma plus large, et ce n'est pas
 * une seconde source : `journeyFullResponseSchema` ÉTEND
 * `journeyDetailResponseSchema` dans `@app/shared`, les deux sont éprouvés sur la
 * MÊME fixture relevée, et une clé qui disparaîtrait côté serveur ferait rougir
 * les deux cas d'un coup. `getJourney` reste employé par les gestes de J02 à J04,
 * qu'on ne rebranche pas.
 */

/** §5.1 — le parcours COMPLET : étapes, checklist (au propriétaire), équipe. */
export function readJourney(journeyId: string): Promise<JourneyFullResponse> {
  return memberApi.get(`/journeys/${journeyId}`, journeyFullResponseSchema);
}

/**
 * §3.7 — les parcours publics d'AUTRES membres.
 *
 * `limit` par défaut à `PUBLIC_JOURNEYS_PANEL_LIMIT`, la constante de
 * `@app/shared` que §3.7 fixe à cinq (« la liste du panneau en montre cinq »).
 * L'écrire à la main ici l'aurait fait diverger de la borne du serveur.
 *
 * AUCUNE DE CES ROUTES N'EST `@PublicRead` : le contrôleur le dit, et §3.7 avec
 * lui — « un parcours public n'est jamais visible hors connexion ni indexé ».
 * « Public » veut dire « visible des MEMBRES CONNECTÉS ». Un appel parti sans
 * jeton prend donc un `401`, le transport rafraîchit UNE fois et rejoue ; il ne
 * reçoit pas, en silence, une vue de visiteur qui changerait d'avis au
 * rechargement.
 */
export function listPublicJourneys(
  limit: number = PUBLIC_JOURNEYS_PANEL_LIMIT,
): Promise<PublicJourneysResponse> {
  return memberApi.get(`/journeys/public?limit=${limit}`, publicJourneysResponseSchema);
}

/**
 * §3.7 — la FICHE d'un parcours public, et elle n'a pas la forme de la liste.
 *
 * Elle porte `currentStep`, que la liste ne rend pas. Réutiliser le schéma de la
 * liste ici lèverait sur toute fiche, et réutiliser celui de la fiche pour la
 * liste lèverait sur toute liste NON VIDE — invisible, puisque `z.array` accepte
 * `[]`. Les deux schémas existent dans `@app/shared` ; on ne les confond pas.
 */
export function getPublicJourney(journeyId: string): Promise<PublicJourneyDetailResponse> {
  return memberApi.get(`/journeys/public/${journeyId}`, publicJourneyDetailResponseSchema);
}

/**
 * §3.8 — le journal du parcours, paginé PAR CURSEUR.
 *
 * La seule liste de ce module qui porte `nextCursor`. Réservée au PROPRIÉTAIRE :
 * un accompagnant prend un `404`, et NON le `403` qu'on attendrait. MESURÉ au
 * navigateur sur un accompagnant ACTIF : `assertOwned` lève `notFound()`, donc le
 * serveur ne confirme même pas que ce journal existe — ce qui est plus prudent
 * qu'un refus qui, lui, avoue l'existence. C'est la règle de §3.4, et l'écran
 * affiche le refus plutôt qu'un journal vide : la différence entre « pas pour
 * vous » et « rien ».
 */
export function listJourneyActivities(
  journeyId: string,
  limit = 20,
): Promise<JourneyActivitiesResponse> {
  return memberApi.get(
    `/journeys/${journeyId}/activities?limit=${limit}`,
    journeyActivitiesResponseSchema,
  );
}
