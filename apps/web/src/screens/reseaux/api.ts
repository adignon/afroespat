/**
 * LES APPELS DU MODULE RÉSEAUX — et rien d'autre.
 *
 * Un fichier par domaine d'écrans, et il ne contient que des appels : pas de
 * transformation, pas d'état, pas de composant. Ce qui arrive ici est ce que
 * l'API a dit, validé par le schéma que `@app/shared` en donne.
 *
 * ── LES ROUTES SONT LUES DANS LE CONTRÔLEUR, PAS DEVINÉES ──────────────────
 *
 * Toutes celles qui suivent existent dans `communities.controller.ts` et ont été
 * APPELÉES : les charges de réponse de chacune ont été relevées octet pour octet
 * sur l'API qui tourne, et ce sont elles qui ont produit les schémas. Aucun
 * point d'entrée n'a été inventé.
 *
 * Deux remarques sur les chemins, parce qu'elles surprennent :
 *
 *   · la fiche accepte un SLUG **ou** un identifiant (`:slug` dans §4, `:id`
 *     partout ailleurs) — le service normalise, donc on passe ce qu'on a ;
 *   · `GET /topics/:id`, `PATCH /topics/:id`, `DELETE /topics/:id` et
 *     `POST /polls/:id/vote` ne sont PAS sous `/communities` : ce sont des
 *     ressources de premier rang. Le réseau est retrouvé par le service à partir
 *     du sujet, et c'est lui qui applique la garde.
 *
 * ── CE QUI N'EST PAS ÉCRIT ICI, ET POURQUOI ────────────────────────────────
 *
 * AUCUN SCHÉMA. Ils viennent tous de `@app/shared`, écrits à côté des schémas de
 * requête du MÊME module (`00` §4). Un schéma de réponse recopié dans le front
 * serait une seconde source, et deux sources divergent toujours.
 *
 * AUCUN TYPE DE RÉPONSE ÉCRIT À LA MAIN : tous dérivés par `z.infer` là-bas.
 *
 * AUCUNE GESTION DE JETON. Le socle le porte, le rafraîchit une fois et rejoue.
 *
 * AUCUNE DÉCISION SUR LE NIVEAU. Pas de `if (level === 'L1')` avant de créer un
 * réseau : on TENTE, et le serveur répond `403 LEVEL_REQUIRED`. Mesuré, mot pour
 * mot, sur `POST /communities` avec un compte L0 :
 *
 *     { "error": { "code": "LEVEL_REQUIRED",
 *                  "details": { "capability": "community.create",
 *                               "requiredLevel": "L1", "currentLevel": "L0",
 *                               "labelFr": "créer un réseau" } } }
 *
 * C'est exactement de quoi afficher l'INVITATION de §7.3 — et c'est pourquoi on
 * n'a pas besoin de lire le niveau pour savoir s'il faut la montrer.
 */
import {
  albumsResponseSchema,
  announcementsResponseSchema,
  communitiesResponseSchema,
  communityDetailResponseSchema,
  communityFeedResponseSchema,
  communityMapResponseSchema,
  communityMembersResponseSchema,
  createAnnouncementResponseSchema,
  createCommunitySchema,
  createTopicSchema,
  inviteMembersResponseSchema,
  inviteMembersSchema,
  memberMutationResponseSchema,
  pollDetailResponseSchema,
  pollsResponseSchema,
  requestDecisionResponseSchema,
  topicDetailResponseSchema,
  topicsResponseSchema,
  updateCommunitySchema,
  updateMemberSchema,
  updateTopicSchema,
  type AlbumsResponse,
  type AnnouncementsResponse,
  type CommunitiesResponse,
  type CommunityDetailResponse,
  type CommunityFeedResponse,
  type CommunityMapResponse,
  type CommunityMembersResponse,
  type CreateCommunity,
  type CreateTopic,
  type InviteMembers,
  type InviteMembersResponse,
  type MemberMutationResponse,
  type PollDetailResponse,
  type PollsResponse,
  type TopicDetailResponse,
  type TopicsResponse,
  type UpdateCommunity,
  type UpdateMember,
  type UpdateTopic,
} from '@app/shared';
/**
 * `@/lib/api/index` ET NON `@/lib/api`.
 *
 * Les deux existent : `lib/api.ts` est un module de compatibilité qui ne
 * réexporte qu'une PARTIE du socle, et c'est lui que `@/lib/api` résout — la
 * résolution préfère le fichier au dossier. `voidResponse` n'y figure pas.
 */
import { memberApi, voidResponse } from '@/lib/api/index';

/**
 * Les options d'appel, construites SANS clé absente.
 *
 * `exactOptionalPropertyTypes` est actif : `{ signal: undefined }` n'est pas la
 * même chose que `{}`, et `RequestOptions.signal` est `AbortSignal` et non
 * `AbortSignal | undefined`.
 */
function opts(signal?: AbortSignal): { readonly signal?: AbortSignal } {
  return signal === undefined ? {} : { signal };
}

/**
 * Construit la requête SANS clé vide.
 *
 * `?category=` (valeur vide) n'est pas « pas de filtre » pour `zodPipe` : c'est
 * une chaîne vide soumise à `z.enum(COMMUNITY_CATEGORIES)`, donc un `400`. Un
 * écran qui remet son filtre à « Toutes » enverrait exactement cela.
 */
function query(filters: Readonly<Record<string, string | undefined>>): string {
  const pairs = Object.entries(filters).filter((e): e is [string, string] => {
    const v = e[1];
    return typeof v === 'string' && v !== '';
  });
  if (pairs.length === 0) return '';
  return `?${new URLSearchParams(pairs).toString()}`;
}

/** Les filtres que `GET /communities` accepte (§4). Aucun n'est appliqué par défaut. */
export interface CommunityFilters {
  readonly kind?: 'CITY' | 'COUNTRY' | 'INTEREST';
  readonly category?: string;
  readonly cityId?: string;
  readonly q?: string;
  readonly cursor?: string;
}

// ── A07 · mes réseaux, la découverte, le seuil de création ─────────────────

/**
 * `GET /communities` — la seule route de A07, et elle rend TOUT l'écran.
 *
 * Cinq clés à la racine, dont `creationGate` : c'est lui qui décide si le bouton
 * « Créer » s'affiche, et il porte le seuil, le compte et le nom de la ville pour
 * écrire la phrase entière. Recalculé à chaque appel côté serveur, donc il ne
 * périme pas — le garder en mémoire le ferait.
 */
export function fetchCommunities(
  filters: CommunityFilters = {},
  signal?: AbortSignal,
): Promise<CommunitiesResponse> {
  return memberApi.get(`/communities${query({ ...filters })}`, communitiesResponseSchema, opts(signal));
}

// ── A08 · un réseau et ses onglets ─────────────────────────────────────────

/** `GET /communities/:slug` — l'en-tête. Passe pour un non-membre ; le contenu non. */
export function fetchCommunity(
  idOrSlug: string,
  signal?: AbortSignal,
): Promise<CommunityDetailResponse> {
  return memberApi.get(
    `/communities/${encodeURIComponent(idOrSlug)}`,
    communityDetailResponseSchema,
    opts(signal),
  );
}

export function fetchTopics(
  idOrSlug: string,
  filters: { readonly status?: string; readonly q?: string; readonly cursor?: string } = {},
  signal?: AbortSignal,
): Promise<TopicsResponse> {
  return memberApi.get(
    `/communities/${encodeURIComponent(idOrSlug)}/topics${query({ ...filters })}`,
    topicsResponseSchema,
    opts(signal),
  );
}

export function fetchCommunityFeed(
  idOrSlug: string,
  cursor?: string,
  signal?: AbortSignal,
): Promise<CommunityFeedResponse> {
  return memberApi.get(
    `/communities/${encodeURIComponent(idOrSlug)}/feed${query({ cursor })}`,
    communityFeedResponseSchema,
    opts(signal),
  );
}

export function fetchMembers(
  idOrSlug: string,
  filters: { readonly q?: string; readonly role?: string; readonly cursor?: string } = {},
  signal?: AbortSignal,
): Promise<CommunityMembersResponse> {
  return memberApi.get(
    `/communities/${encodeURIComponent(idOrSlug)}/members${query({ ...filters })}`,
    communityMembersResponseSchema,
    opts(signal),
  );
}

/**
 * Les demandes d'adhésion en attente — écran de gestion.
 *
 * `pending=true` exige d'être MODÉRATEUR, et le serveur le vérifie. On n'essaie
 * donc pas de deviner le droit avant d'appeler : un `403` porte `reason:
 * 'MODERATOR_REQUIRED'`, qui dit exactement quoi afficher.
 */
export function fetchPendingMembers(
  idOrSlug: string,
  cursor?: string,
  signal?: AbortSignal,
): Promise<CommunityMembersResponse> {
  return memberApi.get(
    `/communities/${encodeURIComponent(idOrSlug)}/members${query({ pending: 'true', cursor })}`,
    communityMembersResponseSchema,
    opts(signal),
  );
}

export function fetchAnnouncements(
  idOrSlug: string,
  cursor?: string,
  signal?: AbortSignal,
): Promise<AnnouncementsResponse> {
  return memberApi.get(
    `/communities/${encodeURIComponent(idOrSlug)}/announcements${query({ cursor })}`,
    announcementsResponseSchema,
    opts(signal),
  );
}

export function fetchPolls(
  idOrSlug: string,
  cursor?: string,
  signal?: AbortSignal,
): Promise<PollsResponse> {
  return memberApi.get(
    `/communities/${encodeURIComponent(idOrSlug)}/polls${query({ cursor })}`,
    pollsResponseSchema,
    opts(signal),
  );
}

export function fetchAlbums(idOrSlug: string, signal?: AbortSignal): Promise<AlbumsResponse> {
  return memberApi.get(
    `/communities/${encodeURIComponent(idOrSlug)}/albums`,
    albumsResponseSchema,
    opts(signal),
  );
}

export function fetchCommunityMap(
  idOrSlug: string,
  signal?: AbortSignal,
): Promise<CommunityMapResponse> {
  return memberApi.get(
    `/communities/${encodeURIComponent(idOrSlug)}/map`,
    communityMapResponseSchema,
    opts(signal),
  );
}

// ── A09 · un sujet ─────────────────────────────────────────────────────────

/**
 * `GET /topics/:id` — LA PORTE DE DERRIÈRE, et elle est gardée.
 *
 * Elle atteint un sujet sans passer par son réseau. Mesuré : à un non-membre
 * d'un réseau `PUBLIC`, elle répond `403 FORBIDDEN` / `NOT_A_MEMBER`, exactement
 * comme les sept routes de contenu. L'écran ne doit donc surtout pas s'en servir
 * pour afficher un sujet qu'il n'a pas pu obtenir autrement.
 */
export function fetchTopic(topicId: string, signal?: AbortSignal): Promise<TopicDetailResponse> {
  return memberApi.get(`/topics/${topicId}`, topicDetailResponseSchema, opts(signal));
}

/**
 * `PATCH /topics/:id` — trois droits distincts dans un même corps.
 *
 * `status` par l'auteur ou un modérateur, `pinKind` par un modérateur seulement,
 * `title`/`body` par l'auteur dans les quinze minutes. Le front n'arbitre RIEN :
 * il envoie ce que l'écran demande et lit `canResolve` / `canPin` / `canEdit`,
 * que le serveur recalcule à chaque lecture du sujet.
 */
export function updateTopic(topicId: string, patch: UpdateTopic): Promise<TopicDetailResponse> {
  return memberApi.patch(`/topics/${topicId}`, topicDetailResponseSchema, {
    body: updateTopicSchema.parse(patch),
  });
}

export function deleteTopic(topicId: string): Promise<void> {
  return memberApi.del(`/topics/${topicId}`, voidResponse);
}

export function createTopic(idOrSlug: string, input: CreateTopic): Promise<TopicDetailResponse> {
  return memberApi.post(
    `/communities/${encodeURIComponent(idOrSlug)}/topics`,
    topicDetailResponseSchema,
    { body: createTopicSchema.parse(input) },
  );
}

// ── A10 · créer un réseau ──────────────────────────────────────────────────

/**
 * `POST /communities` — le corps est validé PAR LE MÊME SCHÉMA que l'API.
 *
 * `createCommunitySchema.parse` avant l'envoi n'est pas une précaution
 * redondante : il fait échouer ici, avec le nom du champ, ce qui échouerait
 * sinon en `400`. Et comme c'est le schéma du serveur, l'écran de création ne
 * peut pas laisser envoyer quatre invitations là où l'API en exige cinq — la
 * règle des cinq est DANS le schéma (`COMMUNITY_MIN_INVITES`), et le compteur
 * « 3 sur 5 » de l'écran lit la même constante.
 *
 * Mesuré avec trois invités : `400 VALIDATION_FAILED`, `fields[0].path`
 * `inviteHandles`, message « Invitez au moins 5 membres. »
 */
export function createCommunity(input: CreateCommunity): Promise<CommunityDetailResponse> {
  return memberApi.post('/communities', communityDetailResponseSchema, {
    body: createCommunitySchema.parse(input),
  });
}

export function updateCommunity(
  idOrSlug: string,
  patch: UpdateCommunity,
): Promise<CommunityDetailResponse> {
  return memberApi.patch(
    `/communities/${encodeURIComponent(idOrSlug)}`,
    communityDetailResponseSchema,
    { body: updateCommunitySchema.parse(patch) },
  );
}

// ── Adhésion et modération ─────────────────────────────────────────────────

/**
 * Rejoindre — ou DEMANDER à rejoindre. La route est la même.
 *
 * C'est le serveur qui tranche d'après la visibilité, et la réponse est la fiche
 * entière : `myStatus` y vaut `ACTIVE` sur un réseau public et `PENDING` sur un
 * réseau sur demande. L'écran lit ce champ plutôt que de deviner ce qui vient de
 * se passer — mesuré, la réponse de `join` est bien la fiche complète.
 */
export function joinCommunity(idOrSlug: string): Promise<CommunityDetailResponse> {
  return memberApi.post(
    `/communities/${encodeURIComponent(idOrSlug)}/join`,
    communityDetailResponseSchema,
  );
}

export function leaveCommunity(idOrSlug: string): Promise<void> {
  return memberApi.post(`/communities/${encodeURIComponent(idOrSlug)}/leave`, voidResponse);
}

export function inviteMembers(
  idOrSlug: string,
  input: InviteMembers,
): Promise<InviteMembersResponse> {
  return memberApi.post(
    `/communities/${encodeURIComponent(idOrSlug)}/invite`,
    inviteMembersResponseSchema,
    { body: inviteMembersSchema.parse(input) },
  );
}

export function updateMember(
  idOrSlug: string,
  userId: string,
  patch: UpdateMember,
): Promise<MemberMutationResponse> {
  return memberApi.patch(
    `/communities/${encodeURIComponent(idOrSlug)}/members/${userId}`,
    memberMutationResponseSchema,
    { body: updateMemberSchema.parse(patch) },
  );
}

export function decideRequest(idOrSlug: string, userId: string, decision: 'accept' | 'reject') {
  return memberApi.post(
    `/communities/${encodeURIComponent(idOrSlug)}/requests/${userId}/${decision}`,
    requestDecisionResponseSchema,
  );
}

export function createAnnouncement(idOrSlug: string, body: string) {
  return memberApi.post(
    `/communities/${encodeURIComponent(idOrSlug)}/announcements`,
    createAnnouncementResponseSchema,
    { body: { body } },
  );
}

/**
 * Voter, et clore.
 *
 * Les deux rendent le sondage SEUL — `pollDetailResponseSchema`, qui porte un
 * champ de plus (`communityId`) que le même sondage vu en liste. Employer le
 * schéma de liste ici ferait échouer la validation sur un vote parfaitement
 * réussi ; c'est `.strict()` qui a rendu cet écart visible plutôt que de le
 * laisser passer en silence.
 */
export function votePoll(pollId: string, optionIds: readonly string[]): Promise<PollDetailResponse> {
  return memberApi.post(`/polls/${pollId}/vote`, pollDetailResponseSchema, {
    body: { optionIds: [...optionIds] },
  });
}

export function closePoll(pollId: string): Promise<PollDetailResponse> {
  return memberApi.post(`/polls/${pollId}/close`, pollDetailResponseSchema);
}
