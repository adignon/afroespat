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
 * AUCUNE DÉCISION SUR LE NIVEAU. Pas de `if (level === 'L2')` avant de créer un
 * réseau : on TENTE, et le serveur répond `403 LEVEL_REQUIRED`. Ce bloc annonçait
 * `requiredLevel: "L1"` — périmé depuis la refonte des niveaux : la table fait
 * foi, et elle dit `community.create → minLevel 'L2'`.
 *
 *     { "error": { "code": "LEVEL_REQUIRED",
 *                  "details": { "capability": "community.create",
 *                               "requiredLevel": "L2", "currentLevel": "L0",
 *                               "labelFr": "créer un réseau" } } }
 *
 * C'est exactement de quoi afficher l'INVITATION de §7.3 — et c'est pourquoi on
 * n'a pas besoin de lire le niveau pour savoir s'il faut la montrer.
 */
import {
  addAlbumPhotoSchema,
  albumsResponseSchema,
  announcementsResponseSchema,
  communityReportDecisionResponseSchema,
  communityReportDecisionSchema,
  communityReportsResponseSchema,
  communitiesResponseSchema,
  communityDetailResponseSchema,
  communityFeedResponseSchema,
  communityMapResponseSchema,
  communityMembersResponseSchema,
  eventsResponseSchema,
  pendingPostDecisionResponseSchema,
  pendingPostDecisionSchema,
  pendingPostsResponseSchema,
  rsvpSchema,
  createAlbumResponseSchema,
  createAlbumSchema,
  createAnnouncementResponseSchema,
  createAnnouncementSchema,
  createCommunitySchema,
  createTopicSchema,
  inviteMembersResponseSchema,
  inviteMembersSchema,
  mediaAssetSchema,
  memberMutationResponseSchema,
  moderatorsConversationResponseSchema,
  pollDetailResponseSchema,
  pollsResponseSchema,
  requestDecisionResponseSchema,
  topicDetailResponseSchema,
  topicsResponseSchema,
  transferCommunitySchema,
  updateCommunitySchema,
  updateAnnouncementResponseSchema,
  updateAnnouncementSchema,
  updateMemberSchema,
  updateTopicSchema,
  type AlbumsResponse,
  type AnnouncementsResponse,
  type CommunitiesResponse,
  type CommunityDetailResponse,
  type CommunityFeedResponse,
  type CommunityMapResponse,
  type CommunityMembersResponse,
  type CommunityReportDecision,
  type CommunityReportDecisionResponse,
  type CommunityReportsResponse,
  type CreateAnnouncement,
  type CreateAnnouncementResponse,
  type CreateCommunity,
  type CreateTopic,
  type EventsResponse,
  type InviteMembers,
  type InviteMembersResponse,
  type MediaAssetView,
  type MemberMutationResponse,
  type ModeratorsConversationResponse,
  type PendingPostDecisionResponse,
  type PendingPostsResponse,
  type PollDetailResponse,
  type PollsResponse,
  type TopicDetailResponse,
  type TopicsResponse,
  type UpdateCommunity,
  type UpdateAnnouncementResponse,
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
 * `z.unknown()` POUR LA SEULE ROUTE DONT LA RÉPONSE N'EST PAS LUE — le RSVP.
 *
 * Voir l'en-tête de `rsvpEvent` : `packages/shared` n'expose aucun schéma de
 * réponse pour `PUT /events/:id/rsvp`, et en inventer un ici serait une seconde
 * source (00 §4). On recharge la liste à la place.
 */
import { z } from 'zod';

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

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║ `POST /communities/:id/albums` — CRÉER UN ALBUM                          ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Ensuite on peut ajouter un album et y ajouter des photos (les
 * modérateurs). »
 *
 * `eventId` N'EST PAS ENVOYÉ, et c'est un relevé : la planche ne dessine aucun
 * choisisseur d'événement, et un album créé par un modérateur est précisément
 * celui qui N'EST PAS automatique — les albums d'événement, eux, naissent avec
 * leur événement. Lier l'un à un événement depuis ce bouton inventerait un
 * contrôle. REMONTÉ.
 */
export function createAlbum(
  idOrSlug: string,
  title: string,
): Promise<z.infer<typeof createAlbumResponseSchema>> {
  return memberApi.post(
    `/communities/${encodeURIComponent(idOrSlug)}/albums`,
    createAlbumResponseSchema,
    { body: createAlbumSchema.parse({ title }) },
  );
}

/**
 * `POST /albums/:id/photos` — accrocher une image DÉJÀ DÉPOSÉE à un album.
 *
 * DEUX APPELS, ET DANS CET ORDRE : `uploadAlbumImage` d'abord (`POST /media`
 * avec `kind=ALBUM`), celui-ci ensuite avec l'identifiant rendu. Le service
 * vérifie que l'image appartient à celui qui la pose ET que son genre est
 * `ALBUM` — relevé dans `addPhoto` : `kind: 'ALBUM', status: 'READY',
 * ownerUserId: userId`. Un média déposé avec un autre genre tomberait sur le
 * même `404` qu'un identifiant inconnu.
 *
 * `caption` N'EST PAS ENVOYÉE : la planche ne dessine aucun champ de légende —
 * exactement le même manque que l'éditeur de guide consigne pour ses images.
 * REMONTÉ.
 */
export function addAlbumPhoto(albumId: string, mediaAssetId: string): Promise<unknown> {
  return memberApi.post(`/albums/${encodeURIComponent(albumId)}/photos`, z.unknown(), {
    body: addAlbumPhotoSchema.parse({ mediaAssetId }),
  });
}

/**
 * `POST /media` avec `kind=ALBUM` — le dépôt, avant l'accrochage.
 *
 * ⚠ `kind: 'ALBUM'` N'EST PAS UN DÉFAUT : `MEDIA_KIND_POLICIES.ALBUM` le
 * déclare `memberUploadable` avec la capacité `post.create`, et `addPhoto`
 * refuse tout autre genre. C'est le même chemin que `deposerImage` de
 * l'éditeur de guide, qui envoie `kind=GUIDE` pour la même raison — imité, pas
 * réinventé.
 *
 * `FormData` ET NON JSON : la route est multipart (`@UseInterceptors(FileInterceptor)`),
 * et `kind` y arrive en champ texte du MÊME corps.
 */
export function uploadAlbumImage(fichier: File): Promise<MediaAssetView> {
  const corps = new FormData();
  corps.append('file', fichier);
  corps.append('kind', 'ALBUM');
  return memberApi.post('/media', mediaAssetSchema, { body: corps });
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

/**
 * REMETTRE un sujet masqué. Sept jours après le masquage, le serveur refuse
 * (`UNHIDE_WINDOW_CLOSED`) : au-delà, seule l'équipe peut.
 *
 * La réponse est le sujet ENTIER remis à jour — avec `hidden`, `canUnhide` et ses
 * trois `can*` recalculés — comme `PATCH /topics/:id`. On la range telle quelle
 * plutôt que de corriger à la main l'état qu'on avait.
 */
export function restoreTopic(topicId: string): Promise<TopicDetailResponse> {
  return memberApi.post(`/topics/${topicId}/restore`, topicDetailResponseSchema);
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

/**
 * « CONTACTER LES MODÉRATEURS » — ouvre, ou ROUVRE, le fil de groupe.
 *
 * AUCUN CORPS, et c'est l'écart notable avec `POST /conversations/direct`, qui
 * exige un `firstMessage` : la planche « À propos » ne dessine aucun formulaire,
 * seulement un bouton. Le fil naît donc vide — comme naît une conversation de
 * parcours — et le membre écrit dedans sur `/messages/:id`.
 *
 * IDEMPOTENT, et la réponse le dit : un second appel rend le MÊME
 * `conversationId` avec `created: false`. L'écran n'a donc rien à mémoriser
 * pour éviter les doublons — c'est le serveur qui tient l'unicité, par un index
 * sur (réseau, demandeur).
 *
 * ⚠ CE N'EST PAS `POST /reports`, que le bouton voisin « Signaler le réseau »
 * sert : celui-là va à l'équipe de la PLATEFORME et ouvre un dossier de
 * modération. Celui-ci parle aux bénévoles d'UN réseau.
 */
export function openModeratorsConversation(
  idOrSlug: string,
): Promise<ModeratorsConversationResponse> {
  return memberApi.post(
    `/communities/${encodeURIComponent(idOrSlug)}/moderators-conversation`,
    moderatorsConversationResponseSchema,
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

/**
 * LA SOURDINE — §2.5, par la MÊME route que le rôle et le bannissement.
 *
 * `PATCH /communities/:id/members/:userId` avec `{ muted }`, et l'identifiant
 * passé est CELUI DU LECTEUR : §4 écrit « `muted` (soi-même) », et le serveur
 * refuse tout autre rang en `403 MUTE_SELF_ONLY`. L'appelant doit donc lui
 * donner son propre identifiant, et c'est pourquoi ce raccourci existe plutôt
 * qu'un `updateMember(slug, moi, { muted })` écrit à la main dans le hook : le
 * nom de la fonction dit la règle.
 *
 * ⚠ `muted` NE VOYAGE JAMAIS AVEC `role` NI `status` : le serveur refuse le
 * mélange (`422 MUTE_ALONE`), parce que les deux gestes n'ont ni le même acteur
 * légitime ni la même nature. Ce raccourci ne passe que `muted`.
 */
export function setCommunityMuted(
  idOrSlug: string,
  myUserId: string,
  muted: boolean,
): Promise<MemberMutationResponse> {
  return updateMember(idOrSlug, myUserId, { muted });
}

/**
 * RETIRER un membre — et ce n'est PAS `updateMember({ status: 'BANNED' })`.
 *
 * Le porteur : « Retirer, il peut rejoindre à nouveau. Mais banni, il ne peut
 * plus rejoindre. » L'adhésion DISPARAÎT, donc il n'y a aucun état d'adhésion à
 * renvoyer : la route répond `204`, comme `POST /leave`, et c'est pour cela
 * qu'elle rend `void` là où le bannissement rend `{ status: 'BANNED' }`.
 */
export function removeMember(idOrSlug: string, userId: string): Promise<void> {
  return memberApi.del(
    `/communities/${encodeURIComponent(idOrSlug)}/members/${userId}`,
    voidResponse,
  );
}

export function decideRequest(idOrSlug: string, userId: string, decision: 'accept' | 'reject') {
  return memberApi.post(
    `/communities/${encodeURIComponent(idOrSlug)}/requests/${userId}/${decision}`,
    requestDecisionResponseSchema,
  );
}

/**
 * `POST /communities/:id/announcements` — LES QUATRE CHAMPS, VALIDÉS ICI.
 *
 * Elle ne prenait qu'un `body: string`, et c'était juste tant que le schéma
 * partagé n'acceptait que ça. La planche dessine QUATRE contrôles — titre, corps,
 * épinglage, notification — et `createAnnouncementSchema` les porte depuis ce
 * lot : l'appel passe donc le corps entier.
 *
 * `createAnnouncementSchema.parse` avant l'envoi, pour la même raison que
 * `createCommunity` : il fait échouer ICI, avec le nom du champ, ce qui échouerait
 * sinon en `400` anonyme — et il APPLIQUE les deux défauts (`pinned: false`,
 * `notify: true`), qui sont ceux de l'API. Deux défauts recopiés côté front
 * finiraient par diverger des siens.
 */
export function createAnnouncement(
  idOrSlug: string,
  input: CreateAnnouncement,
): Promise<CreateAnnouncementResponse> {
  return memberApi.post(
    `/communities/${encodeURIComponent(idOrSlug)}/announcements`,
    createAnnouncementResponseSchema,
    { body: createAnnouncementSchema.parse(input) },
  );
}

/**
 * ÉPINGLER OU DÉSÉPINGLER UNE ANNONCE — arbitrage du 2026-10-11.
 *
 * `PATCH /communities/:id/announcements/:announcementId` avec `{ pinned }`.
 * L'épinglage reste EXCLUSIF — épingler une annonce déépingle la courante, côté
 * serveur — et c'est le DÉSÉPINGLAGE qui manquait : sans lui, on ne pouvait que
 * remplacer l'épinglée par une autre, en publiant, avec un budget de deux
 * annonces par semaine.
 *
 * La réponse ne porte que `{ id, pinnedAt }` : le seul fait que la requête
 * change. Renvoyer `title` et `body` inchangés inviterait l'écran à les
 * réécrire depuis une réponse qui ne les décide pas.
 */
export function setAnnouncementPinned(
  idOrSlug: string,
  announcementId: string,
  pinned: boolean,
): Promise<UpdateAnnouncementResponse> {
  return memberApi.patch(
    `/communities/${encodeURIComponent(idOrSlug)}/announcements/${announcementId}`,
    updateAnnouncementResponseSchema,
    { body: updateAnnouncementSchema.parse({ pinned }) },
  );
}

/**
 * LA FILE DE SIGNALEMENTS DU RÉSEAU — §2.4, et elle n'existait nulle part.
 *
 * `GET /communities/:id/reports`. UNE RANGÉE PAR CONTENU et non par
 * signalement : la planche « Gérer » écrit « Demande d'argent · 5
 * signalements » sur une seule rangée, avec une seule paire de boutons.
 *
 * ⚠ `meta.open` EST LE NOMBRE À AFFICHER, jamais `items.length` : la carte
 * « SIGNALEMENTS · 2 », la tuile « 2 signalements ouverts » et la pastille du
 * rail disent toutes trois ce nombre, et la réponse est bornée à cinquante
 * rangées. C'est le défaut déjà payé quatre fois sur cette maquette avec
 * « DEMANDES D'ADHÉSION · 4 ».
 *
 * ⚠ ELLE RÉPOND `403 MODERATOR_REQUIRED` À UN MEMBRE ORDINAIRE : le hook ne
 * l'appelle que si le lecteur est propriétaire ou modérateur, non pour remplacer
 * la garde du serveur mais pour ne pas provoquer un refus à chaque visite.
 */
export function fetchCommunityReports(
  idOrSlug: string,
  signal?: AbortSignal,
): Promise<CommunityReportsResponse> {
  return memberApi.get(
    `/communities/${encodeURIComponent(idOrSlug)}/reports`,
    communityReportsResponseSchema,
    opts(signal),
  );
}

/**
 * « Masquer » et « Conserver » — les DEUX décisions de §2.4, et rien de plus.
 *
 * ⚠ LA CIBLE EST DANS LE CORPS, pas dans l'URL : la décision porte sur le
 * COUPLE `(subjectType, subjectId)` et clôt TOUS les signalements ouverts de ce
 * contenu. Une URL par signalement aurait désigné l'un des cinq pour une
 * décision qui les clôt tous.
 *
 * `communityReportDecisionSchema.parse` avant l'envoi : il fait échouer ici,
 * avec le nom du champ, ce qui échouerait sinon en `400` anonyme — et son enum à
 * deux valeurs est la limite de pouvoir elle-même (§2.4 : « Ils ne peuvent pas
 * suspendre un compte »).
 */
export function decideCommunityReport(
  idOrSlug: string,
  input: CommunityReportDecision,
): Promise<CommunityReportDecisionResponse> {
  return memberApi.post(
    `/communities/${encodeURIComponent(idOrSlug)}/reports/decide`,
    communityReportDecisionResponseSchema,
    { body: communityReportDecisionSchema.parse(input) },
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

// ── Les deux gestes LOURDS du propriétaire ─────────────────────────────────

/**
 * `POST /communities/:id/transfer` et `POST /communities/:id/reactivate`.
 *
 * ⚠ CES DEUX ROUTES MANQUAIENT À CE FICHIER, et son en-tête affirmait pourtant
 * que « toutes celles qui suivent existent dans `communities.controller.ts` ».
 * C'était vrai dans ce sens-là ; l'inverse ne l'était pas — le contrôleur en
 * porte deux que le front n'appelait pas. Relevé dans
 * `communities.controller.ts` (`transfer()` ligne 191, `reactivate()` ligne 393)
 * et dans le service : les DEUX finissent par `return this.detail(...)`, donc la
 * réponse est la fiche ENTIÈRE, exactement comme `join`. C'est pourquoi elles
 * partagent `communityDetailResponseSchema` et non un schéma de leur cru.
 *
 * `transferCommunitySchema` valide le corps ICI, avant l'envoi, pour la même
 * raison que `createCommunity` : un identifiant mal formé échoue avec le nom du
 * champ plutôt qu'en `400` anonyme. Le service refuse en plus le transfert vers
 * soi-même (`SELF_TRANSFER`) et vers un non-membre (`404`) — deux règles qu'on
 * ne recopie pas côté front : on tente, il tranche.
 *
 * ⚠ AUCUNE DES DEUX N'EST DESSINÉE sur A08 ni sur les vingt-cinq planches
 * d'onglet de A08T — vérifié en comptant les octets de la maquette : ni
 * « Transférer », ni « Réactiver », ni « Archiver » n'y figurent une seule fois.
 * Elles sont donc écrites, et appelables par `useReseau`, mais aucun cadre ne
 * les déclenche. REMONTÉ : il manque la planche.
 */
export function transferCommunity(
  idOrSlug: string,
  toUserId: string,
): Promise<CommunityDetailResponse> {
  return memberApi.post(
    `/communities/${encodeURIComponent(idOrSlug)}/transfer`,
    communityDetailResponseSchema,
    { body: transferCommunitySchema.parse({ toUserId }) },
  );
}

export function reactivateCommunity(idOrSlug: string): Promise<CommunityDetailResponse> {
  return memberApi.post(
    `/communities/${encodeURIComponent(idOrSlug)}/reactivate`,
    communityDetailResponseSchema,
  );
}

// ── A08T · l'onglet « Événements » du réseau ────────────────────────────────

/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║ LES ÉVÉNEMENTS DU RÉSEAU VIENNENT DE `GET /events`, FILTRÉ                   ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * ⚠ ET NON DE `GET /communities/:id/events`, QUI N'EXISTE PAS. Mesuré avant ce
 * lot : `communities.controller.ts` déclare trente-quatre routes et aucune
 * d'événement, et `GET /events?communityId=…` répondait `400 UNRECOGNIZED_KEYS`
 * parce qu'`eventsQuerySchema` est `.strict()`. Le lot a donc ajouté
 * `communityId` au schéma et au `visibleWhere` du service, et c'est cette route
 * — LA MÊME que l'agenda — qui nourrit l'onglet.
 *
 * C'est le même chemin que le FIL du réseau (`GET /feed?communityId=…`) et que
 * l'onglet « Fil » d'un profil public (`?authorHandle=`), pour la raison que
 * `eventsQuerySchema` écrit : la carte se dessine à partir du schéma ENTIER de
 * cette route, et le filtre s'ajoute aux règles de visibilité sans en remplacer
 * aucune.
 *
 * ── LES DEUX PASTILLES SONT DANS LA REQUÊTE, PAS DANS L'ÉCRAN ────────────────
 *
 * « Passés » envoie `to` = HIER, « À venir » n'envoie aucune borne. La frontière
 * est donc le DÉBUT D'AUJOURD'HUI, et les deux listes ne se recouvrent pas :
 * sans borne, `windowOf` part de MAINTENANT côté serveur, donc un événement de
 * ce matin déjà commencé ne serait dans AUCUNE des deux si « Passés » s'arrêtait
 * à avant-hier. Trier côté écran était impossible : la réponse sans borne ne
 * contient aucun événement passé.
 *
 * ⚠ `to` SANS `from` REGARDE 62 JOURS EN ARRIÈRE, et c'est le serveur qui le
 * décide (`windowOf` : `Date.now() - 62 * 86_400_000`). L'onglet « Passés » ne
 * montre donc pas l'histoire entière du réseau. REMONTÉ : la planche ne dessine
 * aucun « voir plus loin », et le curseur de la route pagine dans le TEMPS, pas
 * en arrière.
 */
export function fetchCommunityEvents(
  communityId: string,
  filters: { readonly from?: string; readonly to?: string; readonly limit?: number } = {},
  signal?: AbortSignal,
): Promise<EventsResponse> {
  return memberApi.get(
    `/events${query({
      communityId,
      ...(filters.from === undefined ? {} : { from: filters.from }),
      ...(filters.to === undefined ? {} : { to: filters.to }),
      ...(filters.limit === undefined ? {} : { limit: String(filters.limit) }),
    })}`,
    eventsResponseSchema,
    opts(signal),
  );
}

/**
 * « JE VIENS » — `PUT /events/:id/rsvp`, capacité `event.attend`, N2.
 *
 * ⚠ AUCUN CONTRÔLE DE NIVEAU AVANT L'APPEL : le front PRÉVIENT, il n'autorise
 * pas (00 §5). On tente, le serveur répond `403 LEVEL_REQUIRED` avec de quoi
 * écrire l'invitation de §7.3, et `components/fenetre-niveau.tsx` l'explique.
 *
 * ── LA RÉPONSE N'EST PAS LUE, ET C'EST ASSUMÉ ───────────────────────────────
 *
 * Le service rend `{ status, waitlistPosition, attendeeCount }` — trois champs
 * qui ne suffisent pas à redessiner la carte : la pastille « Vous y allez », la
 * couleur de la pastille de date et le libellé du bouton se lisent tous sur
 * `myStatus`, que seule la LISTE porte. `packages/shared` n'expose d'ailleurs
 * aucun schéma de réponse pour cette route, et en inventer un ici serait une
 * seconde source (00 §4). On recharge donc la liste, ce qui est aussi ce qui
 * remet `attendeeCount` à jour pour tout le monde.
 *
 * ⚠ CONSÉQUENCE CONSIGNÉE : quand l'événement est COMPLET, le serveur répond
 * `WAITLIST` et non `GOING` (§3.2). La liste rechargée le dit — `myStatus:
 * 'WAITLIST'` allume la même pastille « Vous y allez » que `GOING` — mais la
 * maquette de cet onglet ne dessine AUCUN mot pour la file d'attente. REMONTÉ :
 * un membre en file lit « Vous y allez » comme un inscrit. La fiche de
 * l'événement, elle, le dit.
 */
export function rsvpEvent(eventId: string): Promise<unknown> {
  return memberApi.put(`/events/${encodeURIComponent(eventId)}/rsvp`, z.unknown(), {
    body: rsvpSchema.parse({ status: 'GOING' }),
  });
}

// ── La file de validation — « Validation des nouvelles publications » ──────

/**
 * `GET /communities/:id/pending-posts` — les publications qui attendent l'équipe.
 * `403 MODERATOR_REQUIRED` pour un membre ordinaire : l'écran ne l'appelle que
 * pour l'équipe, pour ne pas provoquer un refus certain à chaque visite.
 */
export function fetchPendingPosts(
  idOrSlug: string,
  signal?: AbortSignal,
): Promise<PendingPostsResponse> {
  return memberApi.get(
    `/communities/${encodeURIComponent(idOrSlug)}/pending-posts${query({ limit: '50' })}`,
    pendingPostsResponseSchema,
    opts(signal),
  );
}

export function decidePendingPost(
  idOrSlug: string,
  postId: string,
  decision: 'APPROVE' | 'REJECT',
): Promise<PendingPostDecisionResponse> {
  return memberApi.post(
    `/communities/${encodeURIComponent(idOrSlug)}/pending-posts/${encodeURIComponent(postId)}/decide`,
    pendingPostDecisionResponseSchema,
    { body: pendingPostDecisionSchema.parse({ decision }) },
  );
}
