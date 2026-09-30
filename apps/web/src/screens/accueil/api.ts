/**
 * LES APPELS DU MODULE ACCUEIL — et rien d'autre.
 *
 * Un fichier par domaine d'écrans, et il ne contient que des appels : pas de
 * transformation, pas d'état, pas de composant. Ce qui arrive ici est ce que l'API
 * a dit, validé par le schéma que `@app/shared` en donne.
 *
 * ── CE QUI N'EST PAS ÉCRIT ICI, ET POURQUOI ─────────────────────────────────
 *
 * AUCUN SCHÉMA. Ils viennent tous de `@app/shared` (`00` §4) : un schéma de
 * réponse recopié dans le front serait une seconde source, et deux sources
 * divergent toujours. Si un schéma manque, il s'écrit LÀ-BAS, à côté du schéma de
 * requête du même module — c'est ce qui a été fait pour les treize de ce lot.
 *
 * AUCUN TYPE DE RÉPONSE ÉCRIT À LA MAIN. Tous sont dérivés par `z.infer` dans
 * `@app/shared` et importés. Un type écrit à la main à côté d'un schéma est un
 * commentaire que le compilateur croit.
 *
 * AUCUNE GESTION DE JETON. Le socle le porte, le rafraîchit une fois et rejoue
 * (`lib/api/member.ts`). Rien ici ne le lit, ne le range, ne le passe.
 *
 * AUCUNE DÉCISION SUR LE NIVEAU. Pas de `if (level === 'L1')` : on tente l'action,
 * et le serveur répond `403 LEVEL_REQUIRED` avec de quoi afficher l'invitation de
 * §7.3. Le niveau d'affichage arrive d'ailleurs déjà dans les réponses —
 * `meta.canPost` pour le composeur, `meta.canCreate` pour les stories — et ces
 * deux booléens sont calculés par le serveur à chaque requête, donc ils ne peuvent
 * pas périmer comme une copie gardée le ferait.
 */
import {
  commentMutationResponseSchema,
  commentsResponseSchema,
  createCommentSchema,
  createPostSchema,
  createStorySchema,
  feedResponseSchema,
  feedSidebarResponseSchema,
  myStoriesResponseSchema,
  postDetailResponseSchema,
  postReactionStateSchema,
  storyBandResponseSchema,
  storyDetailResponseSchema,
  storyVotesResponseSchema,
  type CommentsResponse,
  type CreateComment,
  type CreatePost,
  type CreateStory,
  type FeedResponse,
  type FeedSidebarResponse,
  type MyStoriesResponse,
  type PostDetailResponse,
  type PostReactionState,
  type StoryBandResponse,
  type StoryDetailResponse,
  type StoryVotesResponse,
} from '@app/shared';
/**
 * `@/lib/api/index` ET NON `@/lib/api`.
 *
 * Les deux existent : `lib/api.ts` est un module de compatibilité qui ne
 * réexporte qu'une PARTIE du socle, et c'est lui que `@/lib/api` résout — la
 * résolution préfère le fichier au dossier. Il le dit lui-même en commentaire :
 * « À ne plus employer dans du code neuf ». `voidResponse` n'y figure pas, et
 * l'erreur qu'on obtient alors — « has no exported member » sur un nom qui est
 * bel et bien exporté par le socle — ne nomme pas la cause.
 */
import { memberApi, voidResponse } from '@/lib/api/index';

/**
 * Les options d'appel, construites SANS clé absente.
 *
 * `exactOptionalPropertyTypes` est actif : `{ signal: undefined }` n'est pas la
 * même chose que `{}`, et `RequestOptions.signal` est `AbortSignal` et non
 * `AbortSignal | undefined`. Passer la clé à `undefined` est donc une erreur de
 * type — à raison : le transport recevrait une propriété présente et vide.
 */
function opts(signal?: AbortSignal): { readonly signal?: AbortSignal } {
  return signal === undefined ? {} : { signal };
}

/** Les filtres que `GET /feed` accepte (§4). Aucun n'est appliqué par défaut (§2.3). */
export interface FeedFilters {
  readonly type?: 'VICTORY' | 'QUESTION' | 'INFO' | 'DISCUSSION';
  readonly cityId?: string;
  readonly communityId?: string;
  readonly cursor?: string;
}

/**
 * Construit la requête SANS clé vide.
 *
 * `?type=` (valeur vide) n'est pas « pas de filtre » pour `zodPipe` : c'est une
 * chaîne vide soumise à `z.enum(PostType)`, donc un `400`. Une page qui remet son
 * filtre à « Tout » enverrait exactement cela.
 */
function query(filters: Readonly<Record<string, string | undefined>>): string {
  const pairs = Object.entries(filters).filter((e): e is [string, string] => {
    const v = e[1];
    return typeof v === 'string' && v !== '';
  });
  if (pairs.length === 0) return '';
  return `?${new URLSearchParams(pairs).toString()}`;
}

// ── Lectures ────────────────────────────────────────────────────────────────

export function fetchFeed(filters: FeedFilters = {}, signal?: AbortSignal): Promise<FeedResponse> {
  return memberApi.get(`/feed${query({ ...filters })}`, feedResponseSchema, opts(signal));
}

/** §2.7 : les quatre blocs de la colonne droite, tous calculés par le serveur. */
export function fetchSidebar(signal?: AbortSignal): Promise<FeedSidebarResponse> {
  return memberApi.get('/feed/sidebar', feedSidebarResponseSchema, opts(signal));
}

/**
 * §2.6 : le bandeau. `type` filtre, et il n'y a PAS de curseur — c'est un bandeau
 * borné d'auteurs, pas une archive.
 */
export function fetchStoryBand(
  filters: { readonly type?: string; readonly cityId?: string } = {},
  signal?: AbortSignal,
): Promise<StoryBandResponse> {
  return memberApi.get(`/stories${query({ ...filters })}`, storyBandResponseSchema, opts(signal));
}

export function fetchStory(id: string, signal?: AbortSignal): Promise<StoryDetailResponse> {
  return memberApi.get(`/stories/${id}`, storyDetailResponseSchema, opts(signal));
}

export function fetchMyStories(signal?: AbortSignal): Promise<MyStoriesResponse> {
  return memberApi.get('/me/stories', myStoriesResponseSchema, opts(signal));
}

export function fetchPost(id: string, signal?: AbortSignal): Promise<PostDetailResponse> {
  return memberApi.get(`/posts/${id}`, postDetailResponseSchema, opts(signal));
}

/**
 * Les commentaires d'un sujet. `subjectType` est POLYMORPHE (§2.5) : la même route
 * sert les publications, les sujets de réseau, les guides et les événements.
 */
export function fetchComments(
  subjectType: 'POST' | 'TOPIC' | 'GUIDE' | 'EVENT',
  subjectId: string,
  cursor?: string,
  signal?: AbortSignal,
): Promise<CommentsResponse> {
  return memberApi.get(
    `/comments${query({ subjectType, subjectId, cursor })}`,
    commentsResponseSchema,
    opts(signal),
  );
}

// ── Écritures ───────────────────────────────────────────────────────────────

/**
 * `POST /posts` — le corps est validé PAR LE MÊME SCHÉMA que l'API (`00` §4).
 *
 * `createPostSchema.parse` avant l'envoi n'est pas une précaution redondante : il
 * fait échouer ici, avec le nom du champ, ce qui échouerait sinon en `400` sans
 * dire lequel. Et comme c'est le schéma du serveur, le composeur ne peut pas
 * laisser rédiger un texte que l'API refusera ensuite.
 */
export function createPost(input: CreatePost): Promise<PostDetailResponse> {
  return memberApi.post('/posts', postDetailResponseSchema, {
    body: createPostSchema.parse(input),
  });
}

export function createComment(input: CreateComment) {
  return memberApi.post('/comments', commentMutationResponseSchema, {
    body: createCommentSchema.parse(input),
  });
}

export function createStory(input: CreateStory): Promise<StoryDetailResponse> {
  return memberApi.post('/stories', storyDetailResponseSchema, {
    body: createStorySchema.parse(input),
  });
}

/**
 * Réagir, et retirer sa réaction.
 *
 * AUCUN `kind` n'est envoyé : §4 dit « le serveur déduit le `kind` du type », et
 * c'est la règle dure « le vocabulaire de réaction renvoyé correspond au type de
 * publication ». Un client qui choisirait le `kind` pourrait mettre « Bravo » sur
 * une question.
 */
export function reactToPost(postId: string): Promise<PostReactionState> {
  return memberApi.put(`/posts/${postId}/reaction`, postReactionStateSchema);
}

export function unreactToPost(postId: string): Promise<PostReactionState> {
  return memberApi.del(`/posts/${postId}/reaction`, postReactionStateSchema);
}

/**
 * Voter sur une story. Ici le `kind` EST envoyé — §2.6 en accepte deux par type —
 * et le serveur refuse `KIND_NOT_ALLOWED_FOR_TYPE` si l'on se trompe (mesuré : 422).
 * L'écran lit `votes.positiveKind` / `negativeKind` de la story pour ne proposer
 * que les deux bons, plutôt que de connaître la table lui-même.
 */
export function voteStory(storyId: string, kind: string): Promise<StoryVotesResponse> {
  return memberApi.put(`/stories/${storyId}/reaction`, storyVotesResponseSchema, {
    body: { kind },
  });
}

export function unvoteStory(storyId: string): Promise<StoryVotesResponse> {
  return memberApi.del(`/stories/${storyId}/reaction`, storyVotesResponseSchema);
}

export function deletePost(postId: string): Promise<void> {
  return memberApi.del(`/posts/${postId}`, voidResponse);
}
