/**
 * LES APPELS DU MODULE GUIDES — et rien d'autre.
 *
 * Un fichier par domaine d'écrans, et il ne contient que des appels : pas de
 * transformation, pas d'état, pas de composant. Ce qui arrive ici est ce que
 * l'API a dit, validé par le schéma que `@app/shared` en donne.
 *
 * ── CE QUI N'EST PAS ÉCRIT ICI, ET POURQUOI ─────────────────────────────────
 *
 * AUCUN SCHÉMA. Les seize de ce lot ont été écrits dans
 * `packages/shared/src/validation/guides.ts`, à côté des schémas de requête du
 * même module (`00` §4). Un schéma de réponse recopié dans le front serait une
 * seconde source, et deux sources divergent toujours.
 *
 * AUCUN TYPE DE RÉPONSE ÉCRIT À LA MAIN. Tous sont dérivés par `z.infer` là-bas
 * et importés ici. Un type écrit à la main à côté d'un schéma est un commentaire
 * que le compilateur croit.
 *
 * AUCUNE GESTION DE JETON. Le socle le porte, le rafraîchit une fois et rejoue.
 * Rien ici ne le lit, ne le range, ne le passe — et rien n'entre dans
 * `localStorage`.
 *
 * AUCUNE DÉCISION SUR LE NIVEAU. Pas de `if (level === 'L1')` avant d'appeler
 * `createProposal` : on tente, et le serveur répond `403 LEVEL_REQUIRED` avec de
 * quoi afficher l'invitation de §7.3.
 *
 * UN SEUL CLIENT : `memberApi`. Aucune route de ce module n'est du domaine
 * `staff` — l'administration des guides vit sous `/v1/admin/guides` (05 §4) et
 * n'est pas de ce périmètre. `staffApi` n'a donc rien à faire dans ce fichier, et
 * le type l'empêcherait de toute façon.
 */
import { z } from 'zod';
import {
  amendProposalSchema,
  bookmarkStatesResponseSchema,
  createGuidePageSchema,
  createGuideSchema,
  createProposalSchema,
  GUIDE_BODY_MAX,
  guideAuthorEditorResponseSchema,
  guideCommunityMaintenanceResponseSchema,
  guideCommunityMaintenanceSchema,
  guideDetailResponseSchema,
  guideEditorResponseSchema,
  guideListResponseSchema,
  guideOutdatedFlagSchema,
  guideOutdatedFlagsResponseSchema,
  guideOutdatedResponseSchema,
  guideProposalDetailSchema,
  guideProposalsResponseSchema,
  guideRevertSchema,
  guideVersionDetailSchema,
  guideVersionsResponseSchema,
  guideVoteResponseSchema,
  guideVoteSchema,
  myGuidesResponseSchema,
  myProposalsResponseSchema,
  putBookmarkSchema,
  rejectProposalSchema,
  updateGuidePageSchema,
  updateGuideSchema,
  uuidSchema,
  type CreateGuide,
  type CreateGuidePage,
  type CreateProposal,
  type GuideAuthorEditorResponse,
  type GuideCommunityMaintenanceResponse,
  type GuideDetailResponse,
  type GuideEditorResponse,
  type GuideListResponse,
  type GuideOutdatedFlagsResponse,
  type GuideOutdatedResponse,
  type GuideProposalDetail,
  type GuideProposalsResponse,
  type GuideVersionDetail,
  type GuideVersionsResponse,
  type GuideVoteResponse,
  type MyGuidesResponse,
  type MyProposalsResponse,
  type UpdateGuide,
  type UpdateGuidePage,
} from '@app/shared';
/**
 * `@/lib/api/index` ET NON `@/lib/api`.
 *
 * Les deux existent : `lib/api.ts` est un module de compatibilité qui ne
 * réexporte qu'une PARTIE du socle, et c'est lui que `@/lib/api` résout — la
 * résolution préfère le fichier au dossier.
 */
import { memberApi } from '@/lib/api/index';

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
 * une chaîne vide soumise à `z.enum(GuideCategory)`, donc un `400`. Une page qui
 * remet son filtre à « Toutes » enverrait exactement cela.
 */
function query(filters: Readonly<Record<string, string | undefined>>): string {
  const pairs = Object.entries(filters).filter((e): e is [string, string] => {
    const v = e[1];
    return typeof v === 'string' && v !== '';
  });
  if (pairs.length === 0) return '';
  return `?${new URLSearchParams(pairs).toString()}`;
}

/** Les filtres que `GET /guides` accepte (§4). */
export interface GuideListFilters {
  /** §2.3 — `helpful` (défaut), `recent`, `review`. */
  readonly tab?: 'helpful' | 'recent' | 'review';
  readonly category?: string;
  readonly countryId?: string;
  readonly cityId?: string;
  readonly cursor?: string;
  /**
   * LES GUIDES D'UN MEMBRE — l'onglet « Guides » de son profil public.
   *
   * La carte de guide se dessine à partir de `guideCardSchema` entier ; seule
   * cette route le sert. Le filtre s'ajoute aux règles de visibilité, il n'en
   * remplace aucune.
   */
  readonly authorHandle?: string;
}

// ── Lectures ────────────────────────────────────────────────────────────────

/** `GET /guides` — A03. */
export function fetchGuides(
  filters: GuideListFilters = {},
  signal?: AbortSignal,
): Promise<GuideListResponse> {
  return memberApi.get(`/guides${query({ ...filters })}`, guideListResponseSchema, opts(signal));
}

/**
 * `GET /guides/:slug` — A04.
 *
 * Par le SLUG et non par l'identifiant : §2.1 fige le slug à la publication —
 * « jamais modifié » — précisément pour qu'un lien partagé dans une conversation
 * continue de fonctionner. C'est donc lui la clé d'URL.
 */
/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ `?page=<slug de page>` — ABSENT, C'EST LA PREMIÈRE PAGE                    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le paramètre est FACULTATIF, et c'est la garantie de compatibilité que §2.1
 * protège en figeant le slug du guide : `/guides/mon-guide` répondait avant les
 * pages, il répond pareil après. Un lien partagé dans une conversation continue
 * donc d'ouvrir le guide — sur sa première page.
 *
 * ⚠ UN SLUG DE PAGE INCONNU DONNE UN `404`, ET C'EST VOULU côté serveur : rendre
 * la première page ferait croire au lecteur qu'il lit celle du lien. L'appelant le
 * traite comme n'importe quel guide introuvable — `useGuide` affiche l'échec.
 *
 * LA CLÉ EST OMISE ET NON POSÉE À `undefined` : `query()` filtre déjà les valeurs
 * vides, mais le dire ici évite qu'un `?page=` nu parte vers `zodPipe`, qui
 * répondrait `400` sur une chaîne vide.
 */
export function fetchGuide(
  slug: string,
  pageSlug?: string,
  signal?: AbortSignal,
): Promise<GuideDetailResponse> {
  return memberApi.get(
    `/guides/${encodeURIComponent(slug)}${query({ page: pageSlug })}`,
    guideDetailResponseSchema,
    opts(signal),
  );
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ `GET /guides/:slug/editor` — CE QUE L'ÉDITEUR LIT POUR S'OUVRIR            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * LA SEULE ROUTE DE LECTURE DE CE FICHIER QUI N'EST PAS PUBLIQUE, et la seule qui
 * rende LE CORPS DE TOUTES LES PAGES. `fetchGuide` juste au-dessus ne rend que le
 * corps de la page lue et ne sert jamais un brouillon : un éditeur ouvert sur un
 * guide existant n'avait donc aucun moyen de montrer la page 3 sans écrire
 * dedans.
 *
 * ⚠ ON NE TESTE RIEN AVANT D'APPELER. `guide.write` est en N2 et seul l'auteur
 * passe : on tente, et le serveur répond `403 LEVEL_REQUIRED`, `404` (brouillon
 * d'autrui) ou `NOT_AUTHOR` (guide public d'autrui). Le front PRÉVIENT, il
 * n'autorise pas — c'est `GardeNiveau` qui explique plus tôt, sans rien garder.
 */
export function fetchGuideEditeur(
  slug: string,
  signal?: AbortSignal,
): Promise<GuideAuthorEditorResponse> {
  return memberApi.get(
    `/guides/${encodeURIComponent(slug)}/editor`,
    guideAuthorEditorResponseSchema,
    opts(signal),
  );
}

/** `GET /guides/:slug/versions` — l'historique de §2.7. */
export function fetchVersions(
  slug: string,
  signal?: AbortSignal,
): Promise<GuideVersionsResponse> {
  return memberApi.get(
    `/guides/${encodeURIComponent(slug)}/versions`,
    guideVersionsResponseSchema,
    opts(signal),
  );
}

/** `GET /guides/:slug/versions/:versionId` — une version, corps compris. */
export function fetchVersion(
  slug: string,
  versionId: string,
  signal?: AbortSignal,
): Promise<GuideVersionDetail> {
  return memberApi.get(
    `/guides/${encodeURIComponent(slug)}/versions/${versionId}`,
    guideVersionDetailSchema,
    opts(signal),
  );
}

/**
 * `GET /guides/:id/proposals` — A06.
 *
 * Par l'IDENTIFIANT et non par le slug : c'est la seule route de lecture du
 * module qui prend un `:id`, et le contrôleur le valide par `uuidSchema`. Lui
 * passer un slug donne un `400`, pas un `404` — ce qui se lit mal quand on
 * cherche pourquoi la liste est vide.
 */
export function fetchProposals(
  guideId: string,
  signal?: AbortSignal,
): Promise<GuideProposalsResponse> {
  return memberApi.get(
    `/guides/${guideId}/proposals`,
    guideProposalsResponseSchema,
    opts(signal),
  );
}

/** `GET /me/guides` — mes guides, tous statuts (§4). */
export function fetchMyGuides(signal?: AbortSignal): Promise<MyGuidesResponse> {
  return memberApi.get('/me/guides', myGuidesResponseSchema, opts(signal));
}

/** `GET /me/proposals` — mes propositions envoyées (§4). */
export function fetchMyProposals(signal?: AbortSignal): Promise<MyProposalsResponse> {
  return memberApi.get('/me/proposals', myProposalsResponseSchema, opts(signal));
}

// ── Écritures — rédaction (A05) ─────────────────────────────────────────────

/**
 * `POST /guides` — le corps est validé PAR LE MÊME SCHÉMA que l'API (`00` §4).
 *
 * `createGuideSchema.parse` avant l'envoi n'est pas une précaution redondante :
 * il fait échouer ici, avec le nom du champ, ce qui échouerait sinon en `400`
 * sans dire lequel. Et comme c'est le schéma du serveur, l'éditeur ne peut pas
 * laisser rédiger un guide que l'API refusera ensuite — y compris la cohérence
 * `scope = COUNTRY ⇒ originCountryId`, qui est un `superRefine` du schéma.
 */
export function createDraft(input: CreateGuide): Promise<GuideEditorResponse> {
  return memberApi.post('/guides', guideEditorResponseSchema, {
    body: createGuideSchema.parse(input),
  });
}

/**
 * `PATCH /guides/:id` — l'enregistrement automatique du brouillon (§5).
 *
 * Le corps passe par `guideDraftBodySchema` (via `updateGuideSchema`), dont le
 * MINIMUM est 1 et non 300 : refuser un brouillon de 299 caractères perdrait le
 * texte du membre au moment précis où il écrit. Les 300 du §2.1 sont exigés à la
 * PUBLICATION, par le serveur.
 *
 * Cette route est limitée à 60 appels par minute et non 30 — l'éditeur
 * enregistre tout seul. Un `429` n'est JAMAIS rejoué.
 */
export function updateGuide(guideId: string, patch: UpdateGuide): Promise<GuideEditorResponse> {
  return memberApi.patch(`/guides/${guideId}`, guideEditorResponseSchema, {
    body: updateGuideSchema.parse(patch),
  });
}

// ── Écritures — les pages d'un guide (A05, barre latérale de l'auteur) ──────

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES TROIS ROUTES DE PAGE SONT CELLES DE L'AUTEUR, ET DE LUI SEUL           ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Les trois exigent `guide.write`, donc N2, et `loadOwned` refuse à quiconque
 * n'est pas l'auteur. ⚠ ON NE TESTE RIEN ICI : le front PRÉVIENT, il n'autorise
 * pas (00 §5). On tente, le serveur répond `403 LEVEL_REQUIRED` ou `404`, et
 * `components/fenetre-niveau.tsx` explique.
 *
 * Les trois rendent `guideEditorResponseSchema` — la forme PLATE de
 * `byIdForAuthor`, avec `pages` et `currentPage`. C'est ce qui évite à l'éditeur de
 * relire le guide après chaque geste : la réponse dit déjà l'état des pages.
 */

/**
 * `POST /guides/:id/pages` — la page naît EN DERNIÈRE POSITION.
 *
 * `position` n'est pas accepté : insérer au milieu, c'est créer puis déplacer, et
 * le déplacement a sa route (`updateGuidePage`). Le `title` est OBLIGATOIRE
 * (`GUIDE_PAGE_TITLE_MIN` = 2) ; `body` est facultatif, et l'éditeur ne l'envoie
 * pas — on ajoute un cadre, puis on le remplit.
 *
 * La réponse porte `currentPage` = LA PAGE CRÉÉE et `currentVersion: null` : une
 * page neuve n'a pas de version courante, et c'est un cas prévu par le contrat.
 */
export function createGuidePage(
  guideId: string,
  input: CreateGuidePage,
): Promise<GuideEditorResponse> {
  return memberApi.post(`/guides/${guideId}/pages`, guideEditorResponseSchema, {
    body: createGuidePageSchema.parse(input),
  });
}

/**
 * `PATCH /guides/:id/pages/:pageId` — renommer, déplacer.
 *
 * ⚠ LE CORPS NE PASSE PAS PAR ICI : il passe par `updateGuide` avec `pageId`.
 * Une seule route écrit du contenu, et c'est elle qui porte la cadence de 60
 * appels par minute de l'éditeur auto-enregistré.
 *
 * `position` est la position VOULUE, comptée à partir de 1, bornée par le serveur
 * au nombre de pages : l'écran n'a pas à connaître ce nombre pour demander « mets
 * cette page en dernier ».
 */
export function updateGuidePage(
  guideId: string,
  pageId: string,
  patch: UpdateGuidePage,
): Promise<GuideEditorResponse> {
  return memberApi.patch(`/guides/${guideId}/pages/${pageId}`, guideEditorResponseSchema, {
    body: updateGuidePageSchema.parse(patch),
  });
}

/**
 * `DELETE /guides/:id/pages/:pageId` — jamais la dernière.
 *
 * ⚠ ELLE RÉPOND `409 { code: 'LAST_PAGE' }` SUR LA DERNIÈRE PAGE, et l'appelant
 * DOIT le dire avec les mots du produit : un guide sans page n'a pas de corps, et
 * supprimer le guide entier est un AUTRE geste. Voir `use-editeur-guide.ts`, qui
 * décide sur le CODE et jamais sur le message (00 §5.2).
 *
 * La suppression est LOGIQUE côté serveur (`deleted_at`) : l'historique de §2.7
 * reste intact, et les commentaires de la page retirée dorment au lieu d'être
 * effacés — un auteur ne peut pas faire disparaître la critique d'un lecteur en
 * retirant la page où elle est écrite.
 */
export function removeGuidePage(
  guideId: string,
  pageId: string,
): Promise<GuideEditorResponse> {
  return memberApi.del(`/guides/${guideId}/pages/${pageId}`, guideEditorResponseSchema);
}

export function publishGuide(guideId: string): Promise<GuideEditorResponse> {
  return memberApi.post(`/guides/${guideId}/publish`, guideEditorResponseSchema);
}

export function unpublishGuide(guideId: string): Promise<GuideEditorResponse> {
  return memberApi.post(`/guides/${guideId}/unpublish`, guideEditorResponseSchema);
}

/** §2.7 — le retour arrière CRÉE une version, il n'efface jamais l'historique. */
export function revertGuide(guideId: string, versionId: string): Promise<GuideEditorResponse> {
  return memberApi.post(`/guides/${guideId}/revert`, guideEditorResponseSchema, {
    body: guideRevertSchema.parse({ versionId }),
  });
}

/** §2.8 — pré-remplit un brouillon depuis un parcours terminé. Ne publie rien. */
export function draftFromJourney(journeyId: string): Promise<GuideEditorResponse> {
  return memberApi.post(`/journeys/${journeyId}/to-guide`, guideEditorResponseSchema);
}

// ── Écritures — vote et obsolescence (A04) ──────────────────────────────────

/**
 * `PUT /guides/:id/vote` — « Ce guide vous a-t-il aidé ? Oui / Non » (§2.2).
 *
 * Le `value` EST envoyé, contrairement au `kind` d'une réaction de publication :
 * ici les deux valeurs ont des effets DIFFÉRENTS et voulus — `HELPFUL`
 * incrémente `helpful_count`, `NOT_HELPFUL` ne décrémente rien et n'affecte pas
 * le classement (règle dure §9). Le serveur ne peut pas le déduire.
 */
export function voteGuide(
  guideId: string,
  value: 'HELPFUL' | 'NOT_HELPFUL',
): Promise<GuideVoteResponse> {
  return memberApi.put(`/guides/${guideId}/vote`, guideVoteResponseSchema, {
    body: guideVoteSchema.parse({ value }),
  });
}

export function unvoteGuide(guideId: string): Promise<GuideVoteResponse> {
  return memberApi.del(`/guides/${guideId}/vote`, guideVoteResponseSchema);
}

/**
 * `POST /guides/:id/outdated` — « L'information a changé » (§2.6).
 *
 * DISTINCT du signalement d'abus : celui-ci dit que le contenu a vieilli, pas
 * qu'il est fautif. Trois signalements font passer le guide en `FLAGGED` et
 * ouvrent un délai de 30 jours pour corriger.
 *
 * Le commentaire est FACULTATIF, et la clé est omise plutôt que posée à
 * `undefined` : `guideOutdatedFlagSchema` est `.strict()`, et le corps part en
 * JSON où `undefined` n'existe pas.
 */
export function flagOutdated(guideId: string, comment?: string): Promise<GuideOutdatedResponse> {
  return memberApi.post(`/guides/${guideId}/outdated`, guideOutdatedResponseSchema, {
    body: guideOutdatedFlagSchema.parse(comment === undefined ? {} : { comment }),
  });
}

export function removeOutdatedFlag(guideId: string): Promise<GuideOutdatedResponse> {
  return memberApi.del(`/guides/${guideId}/outdated`, guideOutdatedResponseSchema);
}

/**
 * `GET /guides/:id/outdated` — CE QUI A ÉTÉ SIGNALÉ, POUR L'AUTEUR.
 *
 * Le porteur, revenant sur son arbitrage de la veille : « Il faut faire ceci,
 * l'auteur doit voir les signalements "a changé". » Ce qui reste du précédent,
 * c'est l'ANONYMAT — la route ne rend que `{ createdAt, comment }`, et son schéma
 * `.strict()` refuserait tout champ de plus à la frontière.
 *
 * Par l'IDENTIFIANT et non par le slug, comme `fetchProposals` et pour la même
 * raison : le contrôleur valide `:id` par `uuidSchema`, donc un slug donnerait un
 * `400` et non un `404` — « ce qui se lit mal quand on cherche pourquoi la liste
 * est vide ».
 *
 * ⚠ RÉSERVÉE À L'AUTEUR (`loadOwned`, capacité `guide.write`). Un lecteur reçoit
 * `403 NOT_AUTHOR` sur un guide public et `404` sur un brouillon. Le front ne
 * l'appelle donc que depuis l'écran de l'auteur — mais il ne décide rien : c'est
 * le serveur qui refuse.
 */
export function fetchOutdatedFlags(
  guideId: string,
  signal?: AbortSignal,
): Promise<GuideOutdatedFlagsResponse> {
  return memberApi.get(
    `/guides/${guideId}/outdated`,
    guideOutdatedFlagsResponseSchema,
    opts(signal),
  );
}

/**
 * `PUT /guides/:id/community` — « Ouvrir à la communauté », et le retour.
 *
 * Le porteur : « le bouton ouvrir à la communauté ne marche pas. » MESURÉ : un
 * `<a href="#">` mort sur `auteurdesktop`, et AUCUNE route derrière —
 * `maintainedByCommunity` n'était écrit que par la tâche d'inactivité du §2.5 et
 * par l'anonymisation du §8.
 *
 * LE BOOLÉEN PART DANS LE CORPS, et ce n'est pas une bascule : §2.5 veut le geste
 * « réversible », et une bascule sans valeur aurait rendu le double clic
 * destructeur. Le pourquoi au long est sur `guideCommunityMaintenanceSchema`.
 *
 * ⚠ CE QUE L'AUTEUR PERD EN OUVRANT, et que l'écran doit dire avant : §2.4, ligne
 * 52 — « les propositions vont directement en file de modération, sans passer par
 * le créateur ». Il renonce à valider les corrections de son propre guide.
 */
export function setCommunityMaintenance(
  guideId: string,
  maintained: boolean,
): Promise<GuideCommunityMaintenanceResponse> {
  return memberApi.put(
    `/guides/${guideId}/community`,
    guideCommunityMaintenanceResponseSchema,
    { body: guideCommunityMaintenanceSchema.parse({ maintained }) },
  );
}

/**
 * LA LONGUEUR MAXIMALE DU COMMENTAIRE — LUE SUR LE SCHÉMA, PAS RECOPIÉE.
 *
 * `packages/shared` est la seule source des bornes (règle du dépôt), et écrire
 * `500` ici l'aurait dédoublée : le jour où §2.6 passe à 800, le champ de l'écran
 * refuserait silencieusement ce que la route accepte, et personne ne saurait
 * pourquoi. Zod porte la borne sur l'instance — `maxLength` sur un `ZodString` —
 * donc elle se LIT.
 *
 * `unwrap()` parce que la clé est `.optional()` : la chaîne est enveloppée dans un
 * `ZodOptional`. Le repli à 500 n'est pas une seconde source mais un garde-fou de
 * type : `maxLength` est typé `number | null`, et un `null` donnerait un
 * `maxLength` d'attribut invalide. Mesuré sur la version livrée : 500.
 */
export const OBSOLETE_COMMENTAIRE_MAX: number =
  guideOutdatedFlagSchema.shape.comment.unwrap().maxLength ?? 500;

// ── Écritures — propositions de correction (A06) ────────────────────────────

/**
 * `POST /guides/:id/proposals` — §2.4.
 *
 * `targetExcerpt` est COPIÉ TEL QUEL depuis la version courante, sans retouche :
 * le serveur vérifie qu'il existe EXACTEMENT UNE FOIS dans le corps de
 * `base_version_id`, sinon `EXCERPT_NOT_FOUND` (409). Un passage « nettoyé » par
 * le front — apostrophe droite au lieu de typographique, espaces normalisés —
 * ne serait plus retrouvé, et le refus se lirait comme un bogue du serveur.
 */
export function createProposal(
  guideId: string,
  input: CreateProposal,
): Promise<GuideProposalDetail> {
  return memberApi.post(`/guides/${guideId}/proposals`, guideProposalDetailSchema, {
    body: createProposalSchema.parse(input),
  });
}

/** Accepter : nouvelle version, contributeur crédité (§2.4). */
export function acceptProposal(proposalId: string): Promise<GuideProposalDetail> {
  return memberApi.post(`/proposals/${proposalId}/accept`, guideProposalDetailSchema);
}

/** Accepter EN MODIFIANT : le contributeur est crédité quand même (§2.4). */
export function amendProposal(
  proposalId: string,
  replacement: string,
): Promise<GuideProposalDetail> {
  return memberApi.post(`/proposals/${proposalId}/amend`, guideProposalDetailSchema, {
    body: amendProposalSchema.parse({ replacement }),
  });
}

/**
 * LES BORNES DU MOTIF DE REFUS — LUES SUR LE SCHÉMA, PAS RECOPIÉES.
 *
 * Même règle et même raison qu'`OBSOLETE_COMMENTAIRE_MAX` ci-dessus :
 * `packages/shared` est la seule source des bornes, et un `10` écrit dans un écran
 * serait une seconde source. `rejectProposalSchema` porte les deux sur son
 * `ZodString`, donc elles se LISENT — `minLength` et `maxLength`.
 *
 * ⚠ LE MINIMUM N'EST PAS CELUI DU MOTIF D'UNE PROPOSITION. Mesuré :
 * `createProposalSchema.reason` exige `GUIDE_PROPOSAL_REASON_MIN` (20), le refus en
 * exige 10. Deux bornes voisines, deux valeurs — c'est précisément le genre d'écart
 * qu'une recopie « raisonnable » aurait effacé.
 *
 * Le champ est TRIMÉ par le schéma (`z.string().trim()`), donc l'écran doit compter
 * sur la valeur trimée lui aussi, sinon un bouton s'allumerait sur des espaces.
 * Les replis à 10 et 1 000 sont un garde-fou de type (`minLength` est
 * `number | null`), pas une seconde source : mesuré sur la version livrée, 10 et
 * 1 000.
 */
export const REFUS_MOTIF_MIN: number = rejectProposalSchema.shape.reason.minLength ?? 10;
export const REFUS_MOTIF_MAX: number = rejectProposalSchema.shape.reason.maxLength ?? 1_000;

/**
 * LA LONGUEUR MAXIMALE D'UN REMPLACEMENT AMENDÉ, lue sur `amendProposalSchema`.
 *
 * ⚠ ELLE PASSE PAR `restrictedMarkdown`, qui enveloppe le `ZodString` dans un
 * `ZodEffects` (`superRefine`) : `maxLength` n'est donc PAS lisible sur la clé.
 * C'est pourquoi la borne vient de `GUIDE_BODY_MAX`, la constante que le schéma
 * lui-même emploie — toujours une seule source, simplement prise une étape plus
 * haut.
 *
 * ⚠ ET LE VIDE EST LICITE : §2.4 prévoit le RETRAIT d'un passage, donc un
 * remplacement vide n'est pas une erreur de saisie. Aucun plancher n'est posé sur
 * ce champ.
 */
export const AMENDEMENT_MAX: number = GUIDE_BODY_MAX;

/** Refuser : motif OBLIGATOIRE (§2.4), le proposant en est notifié. */
export function rejectProposal(
  proposalId: string,
  reason: string,
): Promise<GuideProposalDetail> {
  return memberApi.post(`/proposals/${proposalId}/reject`, guideProposalDetailSchema, {
    body: rejectProposalSchema.parse({ reason }),
  });
}

// ── Écritures — le signet d'un guide (A04, barre haute mobile) ──────────────

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « LES ICON DU HEADER NE MARCHENT PAS » — LE SIGNET DU GUIDE                ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur, capture à l'appui. Le signet de la barre haute mobile était un
 * `<span>` inerte.
 *
 * ── TOUT EXISTAIT, ET RIEN N'APPELAIT ───────────────────────────────────────
 *
 * `BookmarkSubjectType` porte `GUIDE` depuis le début
 * (`packages/db/prisma/schema/t-transverse.prisma`), et les quatre routes de §2.9
 * sont livrées : `GET /me/bookmarks`, `PUT /me/bookmarks`,
 * `DELETE /me/bookmarks/:type/:id`, `GET /me/bookmarks/states`. L'écran K10
 * « Enregistrés » les emploie déjà pour LIRE la collection ; personne n'y
 * ÉCRIVAIT un guide.
 *
 * ── POURQUOI CE N'EST PAS `PUT /guides/:id/bookmark` ────────────────────────
 *
 * Parce que cette route n'existe pas, et qu'il ne faut pas la créer. Le signet de
 * publication et celui de story ont chacun la leur (`PUT /posts/:id/bookmark`,
 * `PUT /stories/:id/bookmark`) — ce sont des routes HISTORIQUES, antérieures au
 * module `bookmarks`, et elles rendent `{ bookmarked }`. Les routes de §2.9 sont
 * la forme GÉNÉRALE, avec le sujet dans le corps, et c'est elle qui sert les sept
 * espèces de la collection. En ajouter une par espèce multiplierait les chemins
 * vers la même table.
 *
 * ⚠ CONSÉQUENCE SUR LA RÉPONSE, et il faut la dire : `PUT /me/bookmarks` rend
 * `{ id, state }`, PAS `{ bookmarked }`. Il n'y a donc rien à lire pour savoir si
 * le geste a pris — la route est IDEMPOTENTE (`upsert` sur la clé unique), donc
 * « elle a répondu » VAUT « c'est enregistré ». Le `DELETE`, lui, rend un `204`
 * et `deleteMany` : retirer un signet qu'on n'a pas vaut succès, « c'est l'état
 * voulu ». L'appelant pose donc l'état qu'il a DEMANDÉ, et non un état lu —
 * contrairement au signet d'une publication, où `{ bookmarked }` est la valeur
 * posée. La différence est dans la route, pas dans un choix d'écran.
 */
const etatSignetSchema = z
  .object({ id: uuidSchema, state: z.string() })
  .strict();

export function bookmarkGuide(guideId: string): Promise<{ readonly id: string }> {
  return memberApi.put('/me/bookmarks', etatSignetSchema, {
    body: putBookmarkSchema.parse({ subjectType: 'GUIDE', subjectId: guideId }),
  });
}

/**
 * `DELETE /me/bookmarks/GUIDE/:id` — le type EST dans le chemin, et il le doit :
 * la table est unique sur `(userId, subjectType, subjectId)`, donc un identifiant
 * seul ne désigne pas une ligne. C'est écrit sur le contrôleur.
 */
export function unbookmarkGuide(guideId: string): Promise<unknown> {
  return memberApi.del(`/me/bookmarks/GUIDE/${guideId}`, z.unknown());
}

/**
 * L'ÉTAT DU SIGNET DE CE GUIDE-CI, par la route de LOT.
 *
 * Elle est faite pour vingt cartes, et on ne lui en donne qu'une — ce qui est
 * exactement son travail à l'échelle 1, et c'est la SEULE route qui réponde à la
 * question : `GET /guides/:slug` ne rend PAS de champ `bookmarked`
 * (`guideDetailResponseSchema` est `.strict()`, vérifié au schéma et non supposé).
 *
 * ⚠ L'ABSENCE EST LA RÉPONSE. Le service le dit : « Les absents ne sont pas
 * rendus. Un identifiant sans ligne n'est pas enregistré ; l'écran le déduit de
 * son absence. » On ne lit donc pas `state` — un guide enregistré puis supprimé
 * porte `REMOVED`, et il est toujours dans la collection. La question posée ici
 * est « est-il enregistré ? », et la ligne existe ou non.
 */
export function fetchSignetGuide(guideId: string): Promise<boolean> {
  return memberApi
    .get(
      `/me/bookmarks/states?subjectType=GUIDE&ids=${encodeURIComponent(guideId)}`,
      bookmarkStatesResponseSchema,
    )
    .then((page) => page.items.some((l) => l.subjectId === guideId));
}
