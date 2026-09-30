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
import {
  amendProposalSchema,
  createGuideSchema,
  createProposalSchema,
  guideDetailResponseSchema,
  guideEditorResponseSchema,
  guideListResponseSchema,
  guideOutdatedFlagSchema,
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
  rejectProposalSchema,
  updateGuideSchema,
  type CreateGuide,
  type CreateProposal,
  type GuideDetailResponse,
  type GuideEditorResponse,
  type GuideListResponse,
  type GuideOutdatedResponse,
  type GuideProposalDetail,
  type GuideProposalsResponse,
  type GuideVersionDetail,
  type GuideVersionsResponse,
  type GuideVoteResponse,
  type MyGuidesResponse,
  type MyProposalsResponse,
  type UpdateGuide,
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
export function fetchGuide(slug: string, signal?: AbortSignal): Promise<GuideDetailResponse> {
  return memberApi.get(
    `/guides/${encodeURIComponent(slug)}`,
    guideDetailResponseSchema,
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

/** Refuser : motif OBLIGATOIRE (§2.4), le proposant en est notifié. */
export function rejectProposal(
  proposalId: string,
  reason: string,
): Promise<GuideProposalDetail> {
  return memberApi.post(`/proposals/${proposalId}/reject`, guideProposalDetailSchema, {
    body: rejectProposalSchema.parse({ reason }),
  });
}
