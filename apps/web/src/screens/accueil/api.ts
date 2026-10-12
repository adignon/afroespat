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
import { z } from 'zod';
import {
  commentMutationResponseSchema,
  commentsResponseSchema,
  createCommentSchema,
  type CommentSubjectType,
  createPostSchema,
  updatePostSchema,
  pollDetailResponseSchema,
  pollVoteSchema,
  type PollDetailResponse,
  createStorySchema,
  feedResponseSchema,
  feedSidebarResponseSchema,
  mediaAssetSchema,
  myStoriesResponseSchema,
  postDetailResponseSchema,
  postReactionStateSchema,
  storyBandResponseSchema,
  storyDetailResponseSchema,
  storyVotesResponseSchema,
  type CommentsResponse,
  type CommentSort,
  type CreateComment,
  type CreatePost,
  type UpdatePost,
  type CreateStory,
  type FeedResponse,
  type FeedSidebarResponse,
  type MediaAssetView,
  type MyStoriesResponse,
  type PostDetailResponse,
  type PostReactionState,
  type StoryBandResponse,
  type StoryDetailResponse,
  type StoryVotesResponse,
  createDirectConversationSchema,
  uuidSchema,
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
  /**
   * LES PUBLICATIONS D'UN MEMBRE — l'onglet « Fil » de son profil public.
   *
   * Le profil montre la CARTE du fil, pas une ligne de titre : seule cette route
   * sert `postCardSchema` entier. Le filtre s'ajoute aux règles de visibilité du
   * fil, il n'en remplace aucune.
   */
  readonly authorHandle?: string;
  /** La route borne elle-même ; on demande moins pour un onglet de profil. */
  readonly limit?: number;
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
  return memberApi.get(
    `/feed${query({ ...filters, limit: filters.limit === undefined ? undefined : String(filters.limit) })}`,
    feedResponseSchema,
    opts(signal),
  );
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
 * sert les publications, les sujets de réseau, les PAGES de guide et les événements.
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE TYPE VIENT DE L'ÉNUMÉRATION PARTAGÉE, IL N'EST PLUS RECOPIÉ             ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Il valait `'POST' | 'TOPIC' | 'GUIDE' | 'EVENT'`, écrit à la main — une SECONDE
 * SOURCE pour une énumération que `packages/shared` tient déjà
 * (`CommentSubjectType`, dérivée du schéma Prisma). Et elle a divergé : le lot des
 * pages a ajouté `GUIDE_PAGE`, que le serveur accepte depuis, et cette union-ci
 * ne le connaissait pas — un commentaire de page ne pouvait pas être demandé
 * depuis le front, avec pour seul symptôme une erreur de compilation au premier
 * appelant.
 *
 * `GUIDE` Y RESTE, et ce n'est pas par prudence : l'énumération le porte toujours,
 * parce que les commentaires déjà écrits sur un guide existent en base. Les
 * ÉCRIRE et les LIRE sur ce sujet répond désormais `404` côté serveur — un
 * commentaire s'attache à une PAGE — et c'est au `subjectType` que l'appelant
 * passe de le dire, pas à ce type-ci.
 */
export function fetchComments(
  subjectType: CommentSubjectType,
  subjectId: string,
  cursor?: string,
  signal?: AbortSignal,
  /**
   * LE TRI DES DEUX ONGLETS DE LA PLANCHE A01C. Absent, le serveur retombe sur
   * `RELEVANT` — l'onglet que la maquette dessine actif. On ne l'envoie donc que
   * lorsqu'il a été changé, ce qui garde l'adresse courte et lisible au journal.
   */
  sort?: CommentSort,
): Promise<CommentsResponse> {
  return memberApi.get(
    `/comments${query({ subjectType, subjectId, cursor, sort })}`,
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

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║ PARTAGER DANS UN RÉSEAU — une publication dans le fil de ce réseau           ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Aucune route de partage n'existe. `POST /posts` avec `communityId` en porte
 * déjà toutes les règles — §2.3 : « renseigné = fil du réseau, visible de ses
 * membres seuls » — appartenance et quotas compris. Une route de partage les
 * aurait redites, et la copie aurait divergé.
 *
 * LE CORPS PORTE LE LIEN ET RIEN D'AUTRE D'INVENTÉ : la phrase est celle déjà
 * employée pour le partage à un contact, pour qu'un même geste produise le même
 * texte où qu'il aille.
 */
export function publierDansReseau(communityId: string, lien: string): Promise<PostDetailResponse> {
  return createPost({
    type: 'DISCUSSION',
    body: `Je partage cette publication avec le réseau : ${lien}`,
    communityId,
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
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE FOND PHOTO D'UNE STORY — `POST /media`, ET LE GENRE EST `POST`          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * C'est le téléversement qui MANQUAIT, et son absence était la cause profonde des
 * trois boutons morts du composeur : « Changer » n'avait rien à changer et
 * « Recadrer » recadrait l'image d'exemple de la maquette, parce qu'il n'existait
 * aucun sélecteur de fichier dans tout l'écran et que `backgroundAssetId` ne
 * partait jamais.
 *
 * `kind: 'POST'` N'EST PAS UN CHOIX PAR DÉFAUT, et il ne fallait pas le deviner :
 * `apps/api/src/common/media-attachment.ts` déclare `ATTACHABLE_KINDS.feed = ['POST']`
 * et explique pourquoi — « Publication et story partagent `POST`. 04-fil.md §2.1 et
 * §2.6 ne nomment pas de genre distinct, et l'énumération de 00 §6.3 n'en offre
 * pas ». Il n'existe donc pas de genre `STORY`, et en inventer un serait toucher à
 * une énumération partagée.
 *
 * Et c'est bien le genre que le SERVEUR exigera : `feed.service.ts` passe le
 * `backgroundAssetId` à `resolveMedia`, qui filtre par `ownedAttachableWhere('feed', …)`
 * — propriétaire, non supprimé, genre recevable, statut prêt, EXIF retirées. Un
 * média d'un autre genre tombe sur le même 404 qu'un identifiant inconnu.
 *
 * LE SCHÉMA DE RÉPONSE VIENT DE `@app/shared` (`mediaAssetSchema`), comme tous les
 * autres : l'en-tête de ce fichier l'exige, et un schéma recopié serait une seconde
 * source.
 */
export function uploadStoryBackground(file: File, signal?: AbortSignal): Promise<MediaAssetView> {
  const corps = new FormData();
  corps.append('file', file);
  corps.append('kind', 'POST');
  return memberApi.post('/media', mediaAssetSchema, { body: corps, ...opts(signal) });
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA CAPTURE D'UNE STORY, DÉPOSÉE COMME PIÈCE JOINTE DE MESSAGE              ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * `kind: 'MESSAGE'` ET NON `'POST'`, et ce n'est pas interchangeable : le genre
 * décide de la capacité exigée, du plafond d'octets, des types acceptés — et
 * surtout de ce à quoi le média pourra être ATTACHÉ. `media-attachment.ts` déclare
 * `ATTACHABLE_KINDS.message = ['MESSAGE']` ; un média `POST` passé à
 * `POST /conversations/direct` tomberait sur le même `404` qu'un identifiant
 * inconnu, et l'écran annoncerait « introuvable » pour une image qu'il vient
 * lui-même de déposer.
 *
 * La capacité de ce genre est `message.send` (L1) : c'est exactement celle de la
 * route qui enverra le message. Un membre qui peut écrire peut donc joindre, et un
 * L0 est refusé AU DÉPÔT plutôt qu'après — ce qui est le bon ordre, puisqu'il n'a
 * pas écrit de texte pour rien.
 */
/**
 * UNE IMAGE DE PUBLICATION.
 *
 * `kind: 'POST'` — le même genre que le fond d'une story, et ce n'est pas un
 * raccourci : `apps/api/src/common/media-attachment.ts` déclare
 * `ATTACHABLE_KINDS.feed = ['POST']` et explique pourquoi — « Publication et story
 * partagent `POST`. 04-fil.md §2.1 et §2.6 ne nomment pas de genre distinct, et
 * l'énumération de 00 §6.3 n'en offre pas. »
 */
export function uploadPostImage(fichier: File, signal?: AbortSignal): Promise<MediaAssetView> {
  const corps = new FormData();
  corps.append('file', fichier);
  corps.append('kind', 'POST');
  return memberApi.post('/media', mediaAssetSchema, { body: corps, ...opts(signal) });
}

export function uploadStoryCapture(fichier: File, signal?: AbortSignal): Promise<MediaAssetView> {
  const corps = new FormData();
  corps.append('file', fichier);
  corps.append('kind', 'MESSAGE');
  return memberApi.post('/media', mediaAssetSchema, { body: corps, ...opts(signal) });
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

/**
 * VOTER SUR LE SONDAGE D'UNE PUBLICATION.
 *
 * `POST /polls/:id/vote` — LA ROUTE DU MODULE 07, celle qui existait déjà. Un
 * sondage de publication et un sondage de réseau sont le MÊME modèle depuis que
 * `polls.community_id` est devenu facultatif : écrire une seconde route aurait
 * dupliqué le vote modifiable, le compte par option et le masquage des résultats.
 *
 * `pollVoteSchema.parse` avant l'envoi : un tableau vide ou une neuvième option
 * échoue ici, avec le nom du champ, plutôt qu'en `400` qui ne dit pas lequel.
 */
export function votePoll(pollId: string, optionIds: readonly string[]): Promise<PollDetailResponse> {
  return memberApi.post(`/polls/${pollId}/vote`, pollDetailResponseSchema, {
    body: pollVoteSchema.parse({ optionIds: [...optionIds] }),
  });
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

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ ENREGISTRER UNE STORY — « Le bouton de bookmark […] Tu peux l'implémenter ? » ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La table `bookmarks`, son enum `STORY`, la tâche horaire qui rafraîchit l'état
 * et le champ `bookmarked` de `GET /stories/:id` existaient TOUS. Il manquait les
 * deux routes d'écriture — le mot n'apparaissait dans aucun contrôleur du dépôt —
 * et elles viennent d'être posées (`PUT`/`DELETE /stories/:id/bookmark`).
 *
 * CE QUE LE SIGNET CHANGE : une story expire en vingt-quatre heures, et
 * `storyDetail` refuse alors de la servir SAUF à son auteur et à qui l'a
 * enregistrée. C'est exactement ce que la planche promet — « 24 heures, puis gardé
 * par ceux qui l'enregistrent ».
 */
const reponseSignet = z.object({ bookmarked: z.boolean() }).strict();

export function bookmarkStory(storyId: string): Promise<{ bookmarked: boolean }> {
  return memberApi.put(`/stories/${storyId}/bookmark`, reponseSignet);
}

export function unbookmarkStory(storyId: string): Promise<{ bookmarked: boolean }> {
  return memberApi.del(`/stories/${storyId}/bookmark`, reponseSignet);
}

/**
 * ÉCRIRE À L'AUTEUR D'UNE STORY — « implémente l'envoi de message avec l'input et
 * le serveur ».
 *
 * UN SEUL APPEL, et c'est le serveur qui le veut ainsi : `POST
 * /conversations/direct` prend le pseudo du destinataire ET le premier message.
 * Ouvrir la conversation puis envoyer séparément ferait deux allers-retours pour
 * un geste, et laisserait une conversation vide si le second échouait.
 *
 * `message.send` est une capacité L1 : un membre non vérifié reçoit
 * `LEVEL_REQUIRED`, que l'écran montre comme n'importe quel refus. La planche
 * dessine d'ailleurs cette invite sur TOUTES les stories ; c'est `canMessage`,
 * servi par le détail, qui dit si l'auteur l'accepte.
 */
export function ecrireAAuteur(
  toHandle: string,
  firstMessage: string,
  /**
   * L'IMAGE VOYAGE AVEC LE PREMIER MESSAGE, et c'est §5.2 qui l'impose.
   *
   * Envoyer le texte puis l'image en second message serait le réflexe. Le serveur
   * le REFUSE : `409 PENDING_CONVERSATION` tant que la demande n'est pas acceptée
   * — et écrire à l'auteur d'une story qu'on ne connaît pas est exactement ce cas.
   * `createDirectConversationSchema` porte donc `mediaId`, comme
   * `sendMessageSchema` le portait déjà.
   */
  mediaId?: string,
  /**
   * LA STORY D'OÙ LE MESSAGE PART, pour que sa vignette y ramène.
   *
   * Le porteur : « Il faut qu'on puisse cliquer sur [la vignette] et aller vers la
   * story si toujours en ligne. Sinon ça affirme que la story a expiré. »
   *
   * La capture est un média AUTONOME : elle survit à la story et ne dit pas d'où
   * elle vient. Sans cet identifiant, la messagerie ne peut rien proposer d'autre
   * qu'une image muette.
   */
  storyId?: string,
): Promise<{ conversationId: string; messageId: string; pending: boolean }> {
  /**
   * ── LA FORME EST CELLE DU SERVEUR, RELEVÉE SUR LUI ────────────────────────
   *
   * Première version : `{ id }`. La route rend `{ conversationId, messageId,
   * pending }`, et le schéma a donc REFUSÉ une réponse parfaitement valide — le
   * `201` partait, le message était bien créé, et l'écran croyait à un échec.
   *
   * C'est exactement ce que ces schémas sont là pour attraper, et ils l'ont fait :
   * mieux vaut un refus bruyant qu'un champ qui se vide sur une réponse qu'on n'a
   * pas lue. Relevé sur `messaging.service.ts`, pas deviné.
   *
   * `pending` dit que le premier message EST une demande, tant que la relation est
   * froide (§5.2). L'écran ne s'en sert pas encore — REMONTÉ : il annonce
   * « envoyé » sans dire « en attente d'acceptation ».
   */
  return memberApi.post(
    '/conversations/direct',
    z
      .object({
        conversationId: uuidSchema,
        messageId: uuidSchema,
        pending: z.boolean(),
      })
      .strict(),
    {
      body: createDirectConversationSchema.parse({
        toHandle,
        firstMessage,
        ...(mediaId === undefined ? {} : { mediaId }),
        ...(storyId === undefined ? {} : { storyId }),
      }),
    },
  );
}

export function deletePost(postId: string): Promise<void> {
  return memberApi.del(`/posts/${postId}`, voidResponse);
}

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║ ENREGISTRER UNE PUBLICATION — les routes n'existaient que pour les stories  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * MÊME RÉPONSE que pour une story — `{ bookmarked }` — donc même schéma. Le
 * réemployer plutôt que d'en écrire un second n'est pas une économie : deux
 * schémas pour une seule forme divergent au premier champ ajouté.
 */
export function bookmarkPost(postId: string): Promise<{ bookmarked: boolean }> {
  return memberApi.put(`/posts/${postId}/bookmark`, reponseSignet);
}

export function unbookmarkPost(postId: string): Promise<{ bookmarked: boolean }> {
  return memberApi.del(`/posts/${postId}/bookmark`, reponseSignet);
}

/**
 * MODIFIER UNE PUBLICATION, avec ce qu'elle porte.
 *
 * `updatePostSchema.parse` AVANT l'envoi, comme `createPost` : un corps hors
 * bornes échoue ici, avec le nom du champ, plutôt qu'en `400` qui ne dit pas
 * lequel. Et comme c'est le schéma du serveur, la fenêtre ne peut pas envoyer un
 * champ que l'API refuserait.
 */
export function updatePost(postId: string, input: UpdatePost): Promise<PostDetailResponse> {
  return memberApi.patch(`/posts/${postId}`, postDetailResponseSchema, {
    body: updatePostSchema.parse(input),
  });
}
