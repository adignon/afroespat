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
 * ── LES ÉCRITURES (LOT « PARCOURS VIVANT ») ────────────────────────────────
 *
 * Toutes les routes d'écriture de `journeys` ont maintenant leur fonction ici, et un
 * geste à l'écran qui les appelle. `POST /blockers/:id/publish` et
 * `POST /journeys/:id/steps/:stepId/share` ne sont appelées QUE par le bouton
 * « Publier » / « Partager » de leur feuille, avec le texte que le membre a écrit
 * (règle dure de §3.5 et §3.6) : aucune autre fonction de ce fichier ne publie.
 */

import {
  blockerPublishedResponseSchema,
  journeyDeclineResponseSchema,
  journeyInvitationsResponseSchema,
  journeyMigrationResponseSchema,
  journeyStepUpdateResponseSchema,
  reportTemplateErrorResponseSchema,
  type AddJourneyMember,
  type BlockerPublishedResponse,
  type InactivityResponse,
  type JourneyInvitationsResponse,
  type JourneyMigrationResponse,
  type JourneyStepUpdateResponse,
  type PublishBlocker,
  type ReorderSteps,
  type ReplaceChecklist,
  type ReportTemplateError,
  type ShareMilestone,
  type UpdateJourney,
  type UpdateJourneyStep,
  type CreateJourneyStep,
  blockerCancelledResponseSchema,
  blockerDraftResponseSchema,
  createJourneySchema,
  dismissShareResponseSchema,
  journeyActivitiesResponseSchema,
  journeyDetailResponseSchema,
  journeyFullResponseSchema,
  journeyTemplateStepsResponseSchema,
  journeyTemplatesResponseSchema,
  journeysListResponseSchema,
  publicJourneyDetailResponseSchema,
  publicJourneysResponseSchema,
  PUBLIC_JOURNEYS_PANEL_LIMIT,
  PUBLIC_JOURNEYS_MAX_LIMIT,
  type BlockerCancelledResponse,
  type BlockerDraftResponse,
  type CreateJourney,
  type DismissShareResponse,
  type JourneyActivitiesResponse,
  type JourneyDetailResponse,
  type JourneyFullResponse,
  type JourneyTemplateStepsResponse,
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
import { z } from 'zod';
import { memberApi } from '@/lib/api/index';

/** §2.1 — les types de parcours proposés, résolus pour mon pays d'origine. */
export function listJourneyTemplates(): Promise<JourneyTemplatesResponse> {
  return memberApi.get('/journey-templates', journeyTemplatesResponseSchema);
}

/**
 * `GET /journey-templates/:id/steps` — LES ÉTAPES D'UN TYPE DE PARCOURS (§2.1).
 *
 * Elle existe pour le composeur de story, et c'est son seul appelant aujourd'hui.
 * `GET /journey-templates` rend le NOMBRE d'étapes (`version.stepCount`) et rien
 * d'autre : de quoi écrire « 15 étapes » sous un type, pas de quoi en nommer une
 * seule. Or `createStorySchema.stepDefinitionId` attend un UUID — donc sans cette
 * route, l'étape 2 de A14 ne pouvait proposer qu'une liste écrite en dur, sans
 * identifiant, donc impossible à envoyer. C'est exactement ce qu'elle faisait.
 *
 * `stepDefinitionId` est la clé qui part dans `POST /stories` : l'identifiant de la
 * DÉFINITION, pas celui de la ligne de version. La route résout elle-même la version
 * publiée pour le pays du membre et applique ses surcharges d'intitulé, de sorte que
 * le nom proposé ici est celui que le parcours du membre emploiera vraiment.
 *
 * Pas de curseur : une version publiée compte une quinzaine d'étapes, et les
 * paginer ferait de l'ordre une illusion.
 */
export function listJourneyTemplateSteps(
  templateId: string,
  signal?: AbortSignal,
): Promise<JourneyTemplateStepsResponse> {
  return memberApi.get(
    `/journey-templates/${templateId}/steps`,
    journeyTemplateStepsResponseSchema,
    signal === undefined ? {} : { signal },
  );
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


// ─── LES ÉCRITURES ──────────────────────────────────────────────────────────

/** §3.4 — les invitations qui attendent MA réponse. */
export function listJourneyInvitations(): Promise<JourneyInvitationsResponse> {
  return memberApi.get('/journeys/invitations', journeyInvitationsResponseSchema);
}

/** §5.1 `PATCH /journeys/:id` — titre, date cible, pause/reprise/arrêt, visibilité. */
export function updateJourney(journeyId: string, patch: UpdateJourney): Promise<JourneyFullResponse> {
  return memberApi.patch(`/journeys/${journeyId}`, journeyFullResponseSchema, { body: patch });
}

/** §2.2 — migrer vers la version publiée courante du modèle. `ALREADY_CURRENT` sinon. */
export function migrateJourney(journeyId: string): Promise<JourneyMigrationResponse> {
  return memberApi.post(`/journeys/${journeyId}/migrate`, journeyMigrationResponseSchema);
}

/** §3.9 — la réponse à « Où en êtes-vous ? ». */
export function answerInactivity(
  journeyId: string,
  answer: InactivityResponse['answer'],
): Promise<JourneyFullResponse> {
  return memberApi.post(`/journeys/${journeyId}/inactivity-response`, journeyFullResponseSchema, {
    body: { answer },
  });
}

/** §2.4 — « Signaler une erreur dans ce modèle ». */
export function reportTemplateError(journeyId: string, input: ReportTemplateError) {
  return memberApi.post(`/journeys/${journeyId}/report-template-error`, reportTemplateErrorResponseSchema, {
    body: input,
  });
}

/** §3.2 — démarrer, franchir, mettre en pause, rouvrir ; échéance ; notes ; titre. */
export function updateStep(
  journeyId: string,
  stepId: string,
  patch: UpdateJourneyStep,
): Promise<JourneyStepUpdateResponse> {
  return memberApi.patch(`/journeys/${journeyId}/steps/${stepId}`, journeyStepUpdateResponseSchema, {
    body: patch,
  });
}

/** §3.2 — une étape personnelle. */
export function addStep(journeyId: string, input: CreateJourneyStep): Promise<JourneyFullResponse> {
  return memberApi.post(`/journeys/${journeyId}/steps`, journeyFullResponseSchema, { body: input });
}

/** §3.2 — retirer une étape. */
export function deleteStep(journeyId: string, stepId: string): Promise<JourneyFullResponse> {
  return memberApi.del(`/journeys/${journeyId}/steps/${stepId}`, journeyFullResponseSchema);
}

/** §3.2 — la liste COMPLÈTE des identifiants, dans le nouvel ordre. */
export function reorderSteps(journeyId: string, input: ReorderSteps): Promise<JourneyFullResponse> {
  return memberApi.put(`/journeys/${journeyId}/steps/order`, journeyFullResponseSchema, { body: input });
}

/** §3.3 — la checklist COMPLÈTE remplace la précédente. Aucun fichier. */
export function replaceChecklist(
  journeyId: string,
  stepId: string,
  input: ReplaceChecklist,
): Promise<JourneyFullResponse> {
  return memberApi.put(`/journeys/${journeyId}/steps/${stepId}/checklist`, journeyFullResponseSchema, {
    body: input,
  });
}

/** §3.4 — inviter par pseudo. */
export function inviteMember(journeyId: string, input: AddJourneyMember): Promise<JourneyFullResponse> {
  return memberApi.post(`/journeys/${journeyId}/members`, journeyFullResponseSchema, { body: input });
}

export function removeMember(journeyId: string, userId: string): Promise<JourneyFullResponse> {
  return memberApi.del(`/journeys/${journeyId}/members/${userId}`, journeyFullResponseSchema);
}

export function acceptInvitation(journeyId: string): Promise<JourneyFullResponse> {
  return memberApi.post(`/journeys/${journeyId}/members/accept`, journeyFullResponseSchema);
}

export function declineInvitation(journeyId: string) {
  return memberApi.post(`/journeys/${journeyId}/members/decline`, journeyDeclineResponseSchema);
}

/**
 * §3.5, quatrième temps — LA seule fonction qui promeut un brouillon.
 *
 * Appelée par le bouton « Publier » de la dernière feuille, avec le texte que le
 * membre a relu et écrit. Le gabarit du brouillon n'est jamais renvoyé tel quel
 * par ce module : c'est le champ de la feuille qui part.
 */
export function publishBlocker(
  blockerId: string,
  input: PublishBlocker,
): Promise<BlockerPublishedResponse> {
  return memberApi.post(`/blockers/${blockerId}/publish`, blockerPublishedResponseSchema, {
    body: input,
  });
}

/** §3.6 — « Publier » sur la feuille de partage : le texte est CELUI DU MEMBRE. */
export function shareMilestone(journeyId: string, stepId: string, input: ShareMilestone) {
  return memberApi.post(`/journeys/${journeyId}/steps/${stepId}/share`, z.unknown(), { body: input });
}

/** §3.8 — une page du journal, à partir d'un curseur. */
export function listJourneyActivitiesPage(
  journeyId: string,
  cursor: string | null,
  limit = 20,
): Promise<JourneyActivitiesResponse> {
  const suite = cursor === null ? '' : `&cursor=${encodeURIComponent(cursor)}`;
  return memberApi.get(
    `/journeys/${journeyId}/activities?limit=${limit}${suite}`,
    journeyActivitiesResponseSchema,
  );
}

/** §3.7 — les parcours publics, filtrés (type, ville, avancement). */
export function listPublicJourneysFiltered(filtres: {
  readonly templateCode?: string;
  readonly cityId?: string;
  readonly progressNear?: number;
  readonly limit?: number;
}): Promise<PublicJourneysResponse> {
  const q = new URLSearchParams();
  if (filtres.templateCode !== undefined) q.set('templateCode', filtres.templateCode);
  if (filtres.cityId !== undefined) q.set('cityId', filtres.cityId);
  if (filtres.progressNear !== undefined) q.set('progressNear', String(filtres.progressNear));
  q.set('limit', String(filtres.limit ?? PUBLIC_JOURNEYS_MAX_LIMIT));
  return memberApi.get(`/journeys/public?${q.toString()}`, publicJourneysResponseSchema);
}
