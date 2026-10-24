import type { z } from 'zod';
import { apiErrorBodySchema } from '@app/shared';
import { ApiError, ApiNetworkError, ApiShapeError, parseRetryAfter } from './errors';

/**
 * Le cœur du client : un `fetch` qui VALIDE ce qu'il reçoit.
 *
 * Il est partagé par les deux domaines, et il ne sait rien d'eux. Ce qui les
 * distingue est passé en paramètre à la construction et jamais après : le préfixe
 * de base, la manière de s'identifier, et ce qu'il faut faire d'un `401`. Un
 * domaine ne peut donc pas emprunter le comportement de l'autre au détour d'un
 * appel — il n'y a pas d'argument pour ça.
 *
 * LA VALIDATION N'EST PAS FACULTATIVE. `request` exige un schéma. Il n'existe
 * aucune surcharge « sans schéma », aucun `any`, aucun `as T` : c'est ce qui fait
 * qu'une route branchée à la va-vite ne peut pas contourner la frontière. Une
 * réponse sans corps se déclare `z.void()`, ce qui est une déclaration, pas une
 * omission.
 */

/**
 * Comment le domaine s'identifie.
 *
 * DEUX FORMES, et la différence est structurelle, pas conditionnelle :
 *
 *   · `bearer` porte une FONCTION qui rend l'en-tête, et une autre pour
 *     rafraîchir. Le client membre la fournit depuis `session.ts`.
 *   · `cookie` ne porte RIEN. Le client équipe la passe, et il n'a donc aucun
 *     moyen — pas même involontaire — d'ajouter un `Authorization`. C'est le
 *     troisième fait de l'étanchéité (voir `domains.ts`) : le mélange n'est pas
 *     interdit, il est inexprimable.
 */
export type Credentials =
  | {
      readonly kind: 'bearer';
      /** L'en-tête à joindre, ou `null` si aucun jeton n'est en mémoire. */
      readonly header: () => Readonly<Record<string, string>> | null;
      /**
       * Tenter d'obtenir un jeton frais. `true` si le prochain essai a une chance.
       *
       * Partagé et unique en vol : c'est au fournisseur de l'assurer, pas au
       * transport (voir `member.ts`).
       */
      readonly refresh: () => Promise<boolean>;
      /** La session est-elle définitivement morte ? Si oui, on ne rafraîchit plus. */
      readonly isDead: () => boolean;
      /**
       * Avant d'envoyer un appel SANS jeton : reprendre la session s'il y a lieu.
       *
       * Rend quand la reprise est terminée (réussie ou non) ; ne lève jamais. Sans
       * cette porte, le premier appel de chaque page part sans jeton, prend un
       * `401` et n'est rejoué qu'après coup — voir `session.ts`, « une session est
       * attendue ».
       */
      readonly before?: (path: string) => Promise<void>;
      /** Appelé quand le serveur dit que les droits ont changé (`TOKEN_STALE`). */
      readonly onRightsChanged: () => void;
    }
  | { readonly kind: 'cookie' };

export interface Transport {
  /**
   * @param schema Le schéma de la réponse. OBLIGATOIRE — voir l'en-tête.
   */
  request<S extends z.ZodTypeAny>(
    method: HttpMethod,
    path: string,
    schema: S,
    options?: RequestOptions,
  ): Promise<z.infer<S>>;
}

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface RequestOptions {
  readonly body?: unknown;
  /** T4 §5 : `Idempotency-Key` sur les créations sensibles, rejouable 24 h. */
  readonly idempotencyKey?: string;
  readonly signal?: AbortSignal;
}

export interface TransportConfig {
  /** Origine + version, p. ex. `http://localhost:3001/v1`. Sans barre finale. */
  readonly base: string;
  /**
   * Le préfixe du domaine, ajouté à CHAQUE chemin et jamais contournable.
   *
   * `''` pour le domaine membre, `'/admin'` pour celui de l'équipe. C'est le
   * deuxième fait de l'étanchéité : le client d'équipe n'a aucun moyen d'exprimer
   * un chemin qui n'atterrisse pas sous `/v1/admin`.
   */
  readonly domainPrefix: string;
  readonly credentials: Credentials;
  /** Refuse un chemin qui sortirait du domaine. Voir `domains.ts`. */
  readonly assertPath: (path: string) => void;
}

/**
 * Les codes de `401` sur lesquels un rafraîchissement a un SENS, et ceux sur
 * lesquels il n'en a aucun.
 *
 * `TOKEN_STALE` (T4 §2) : « le client rafraîchit et rejoue ». C'est la consigne,
 * mot pour mot.
 *
 * `UNAUTHENTICATED` : à rafraîchir AUSSI, et c'est le point délicat. Le serveur
 * l'emploie pour deux situations qu'il ne distingue pas — vérifié dans
 * `auth.guard.ts` et à l'appel :
 *
 *   · le jeton d'accès a EXPIRÉ (`TokenService.verify` rend `null` au-delà de 15
 *     min, et `claims === null` donne `UNAUTHENTICATED`). C'est le cas courant, et
 *     il se répare exactement par un rafraîchissement ;
 *   · la session est RÉVOQUÉE, ou le compte est `DELETED`/`DEACTIVATED`. Là, rien à
 *     réparer.
 *
 * Comme le code ne les sépare pas, on rafraîchit UNE FOIS et on laisse
 * `/auth/refresh` trancher : c'est lui qui a la vérité, et il répond
 * `SESSION_REVOKED` sur une chaîne coupée. L'essai est donc borné et son verdict
 * est autoritaire — voir `markSessionDead` pour ce qui empêche la boucle.
 *
 * `SESSION_REVOKED` sur un appel ordinaire : décision prise, on ne rafraîchit pas.
 *
 * `CROSS_DOMAIN_TOKEN` et `STAFF_SESSION_REQUIRED` : jamais rafraîchis. Le premier
 * est un DÉFAUT DE CODE — un jeton de membre est parti sur une route d'équipe — et
 * le rejouer masquerait le bogue au lieu de le montrer. Le second appelle une
 * connexion d'équipe, que le client membre ne sait pas faire.
 */
const REFRESHABLE_401 = new Set(['TOKEN_STALE', 'UNAUTHENTICATED']);

export function createTransport(config: TransportConfig): Transport {
  const { base, domainPrefix, credentials, assertPath } = config;

  async function attempt(
    method: HttpMethod,
    path: string,
    options: RequestOptions,
  ): Promise<Response> {
    const headers: Record<string, string> = {};
    /**
     * ╔══════════════════════════════════════════════════════════════════════════╗
     * ║ UN CORPS `FormData` N'EST PAS DU JSON, ET IL NE FAUT SURTOUT PAS LE DIRE ║
     * ╚══════════════════════════════════════════════════════════════════════════╝
     *
     * `POST /media` (00 §8.1) est la seule route du socle qui attend du
     * `multipart/form-data`, et c'est elle que le composeur de story appelle pour
     * téléverser le fond choisi par le membre. Deux choses devaient changer ici, et
     * aucune n'est optionnelle :
     *
     *   · NE PAS POSER `content-type`. Un multipart porte une FRONTIÈRE
     *     (`boundary=…`) que seul le navigateur connaît, puisqu'il la tire au sort en
     *     sérialisant le corps. Poser l'en-tête à la main — même à
     *     `multipart/form-data` — l'envoie SANS frontière, et multer ne trouve alors
     *     aucun champ : la route répond `MEDIA_EMPTY` pour un fichier bel et bien
     *     joint. C'est le piège classique de `fetch`, et il est silencieux ;
     *   · NE PAS SÉRIALISER. `JSON.stringify(formData)` rend `"{}"` — pas une
     *     erreur, une chaîne vide de sens. Le fichier serait parti dans le vide.
     *
     * `typeof FormData !== 'undefined'` : ce module est importé par des composants
     * que Next rend aussi côté serveur, où le constructeur peut manquer. La garde
     * évite un `ReferenceError` au lieu d'une requête.
     */
    const estFormulaire =
      typeof FormData !== 'undefined' && options.body instanceof FormData;
    if (options.body !== undefined && !estFormulaire) {
      headers['content-type'] = 'application/json';
    }
    if (options.idempotencyKey !== undefined) {
      headers['idempotency-key'] = options.idempotencyKey;
    }
    // Le seul endroit où un en-tête d'identification peut naître. Sur
    // `{ kind: 'cookie' }`, il n'y a rien à joindre — pas de branche à oublier.
    if (credentials.kind === 'bearer') {
      Object.assign(headers, credentials.header() ?? {});
    }

    try {
      return await fetch(`${base}${domainPrefix}${path}`, {
        method,
        headers,
        /**
         * TOUJOURS `include`, dans les deux domaines.
         *
         * Le front et l'API sont sur des ORIGINES DIFFÉRENTES (3000 et 3001) : sans
         * ce drapeau, le navigateur n'envoie ni `dp_refresh` ni `dp_staff`, et
         * aucune des deux sessions ne fonctionne. Le symptôme est trompeur — tout
         * ressemble à une session expirée.
         *
         * Il suppose que l'API répond `Access-Control-Allow-Credentials` et une
         * origine EXACTE, ce que `main.ts` fait (`credentials: true`). Et il rend
         * `WEB_PORT` critique : l'API construit sa liste CORS avec, donc le web et
         * l'API doivent porter la MÊME valeur, sans quoi le navigateur rejette tout
         * en silence.
         */
        credentials: 'include',
        /**
         * ╔══════════════════════════════════════════════════════════════════════╗
         * ║ AUCUNE RÉPONSE DE MEMBRE NE SORT D'UN CACHE                         ║
         * ╚══════════════════════════════════════════════════════════════════════╝
         *
         * Le porteur : « Je clique sur un story mais ça ne montre pas que c'est lu
         * même quand je rafraîchis la page. »
         *
         * MESURÉ : `GET /v1/stories` rend un `ETag` et AUCUN `Cache-Control`. Une
         * réponse ainsi faite est « heuristiquement fraîche » — le navigateur a le
         * droit de la resservir SANS redemander, et la durée qu'il s'accorde ne
         * dépend que de lui. Le ruban revenait donc tel qu'il était avant la
         * lecture, anneaux verts compris, et un rafraîchissement n'y changeait
         * rien puisque rien n'était redemandé.
         *
         * Ces réponses sont PERSONNELLES : ce qu'un membre a vu, ses signets, ses
         * messages. Elles n'ont rien à faire dans un cache, ici ni ailleurs — d'où
         * aussi le `Cache-Control: no-store` posé côté API, qui vaut pour tous les
         * clients et pas seulement pour celui-ci.
         */
        cache: 'no-store',
        ...(options.signal === undefined ? {} : { signal: options.signal }),
        /**
         * AUCUNE ASSERTION DE TYPE ICI, ET CE N'EST PAS UN OUBLI.
         *
         * `options.body` est `unknown`, donc `as FormData` semblait nécessaire.
         * Il ne l'est pas : TypeScript déduit du `const estFormulaire = … instanceof
         * FormData` une garde réutilisable, et dans cette branche `options.body` est
         * DÉJÀ un `FormData`. L'assertion était donc redondante, et
         * `@typescript-eslint/no-unnecessary-type-assertion` la refuse — mesuré :
         * elle a fait échouer `pnpm build`, là où `eslint src` seul ne l'avait pas
         * relevée. La porte de lint de ce dépôt n'est pas la seule qui compte.
         */
        ...(options.body === undefined
          ? {}
          : { body: estFormulaire ? options.body : JSON.stringify(options.body) }),
      });
    } catch (cause) {
      // `fetch` ne lève que si la requête n'a pas abouti : réseau, DNS, CORS,
      // annulation. Un statut d'erreur HTTP n'est PAS une exception, et c'est
      // pourquoi ce `catch` ne peut pas avaler un refus du serveur.
      throw new ApiNetworkError(`${domainPrefix}${path}`, cause);
    }
  }

  async function request<S extends z.ZodTypeAny>(
    method: HttpMethod,
    path: string,
    schema: S,
    options: RequestOptions = {},
  ): Promise<z.infer<S>> {
    assertPath(path);

    // La reprise de session se fait AVANT le premier appel authentifié.
    if (credentials.kind === 'bearer' && credentials.before !== undefined) {
      await credentials.before(path);
    }

    let response = await attempt(method, path, options);

    if (response.status === 401 && credentials.kind === 'bearer' && !credentials.isDead()) {
      const failure = await readErrorBody(response);
      if (REFRESHABLE_401.has(failure.code)) {
        /**
         * REJOUER UNE ÉCRITURE EST-IL SÛR ? Oui, et il faut savoir pourquoi.
         *
         * Le refus vient de `AuthGuard.canActivate`, donc d'un GARDE : Nest
         * l'exécute AVANT le gestionnaire de route. Un `401 TOKEN_STALE` prouve
         * donc que le contrôleur n'a pas tourné, et qu'aucun effet n'a eu lieu. Un
         * `POST` rejoué ne crée pas un doublon.
         *
         * CE QUE LE REJEU COÛTE QUAND MÊME : `RateLimitGuard` s'exécute, lui, et
         * COMPTE la tentative refusée. Un rejeu consomme donc deux unités de
         * budget. Sur une route à 10/h — l'envoi d'un code par SMS — cela fait cinq
         * envois au lieu de dix dans le pire cas. Assumé, et à connaître : c'est
         * une raison de plus pour qu'il y ait UN SEUL rejeu.
         */
        if (await credentials.refresh()) {
          // `TOKEN_STALE` veut dire que les droits ont changé, pas seulement que le
          // jeton est vieux. Tout ce que le front croit savoir du niveau, du plan
          // et du statut est périmé — voir `session.ts`.
          credentials.onRightsChanged();
          response = await attempt(method, path, options);
        }
      }
      /**
       * Un seul essai : on ne rappelle pas `refresh()` après le rejeu, même s'il
       * répond encore 401. Sans cette borne, un serveur qui persiste à dire
       * `TOKEN_STALE` ferait tourner le client en rond sur `/auth/refresh`.
       *
       * L'erreur remontée est RELUE sur la réponse COURANTE, et non reprise de
       * `failure`. La première version reprenait `failure` — le refus initial — avec
       * le statut de la seconde réponse : un rejeu refusé pour une autre raison
       * (`SESSION_REVOKED` après une révocation entre les deux appels) aurait été
       * rapporté comme `TOKEN_STALE`, et l'appelant aurait cru devoir réessayer là où
       * il fallait renvoyer à la connexion. Deux réponses, deux corps.
       */
      if (response.status === 401) throw toApiError(response, await readErrorBody(response));
    }

    if (!response.ok) {
      const failure = await readErrorBody(response);

      /**
       * `403 LEVEL_REQUIRED` DÉMENT le niveau que le front croyait connaître.
       *
       * Il ne déclenche aucun rafraîchissement — c'est un `403`, le jeton est bon —
       * mais il PROUVE que la copie locale est fausse : le serveur vient de refuser
       * une action que le niveau connu aurait permise. La garder laisserait
       * l'interface promettre ce que l'API refuse, ce qui est la même erreur de
       * raisonnement que la faille de quinze minutes (voir `session.ts`).
       *
       * Oublié ICI plutôt que dans l'appelant : cent vingt-quatre écrans qui doivent
       * penser à invalider un cache, ce sont cent vingt-quatre occasions d'oublier.
       *
       * C'est un test qui a signalé l'absence de ces trois lignes, alors que le
       * commentaire de `session.ts` les décrivait déjà comme existantes.
       */
      if (credentials.kind === 'bearer' && failure.code === 'LEVEL_REQUIRED') {
        credentials.onRightsChanged();
      }

      throw toApiError(response, failure);
    }

    return await decode(path, response, schema);
  }

  return { request };
}

/** Ce qu'on a pu tirer d'une réponse d'erreur. */
interface FailureBody {
  readonly code: string;
  readonly message: string;
  readonly details: Readonly<Record<string, unknown>>;
}

/**
 * Lit `error { code, message, details }` (§5.2), ou dit qu'il n'y était pas.
 *
 * `ApiErrorFilter` garantit cette forme sur TOUTE réponse d'erreur de l'API, y
 * compris les 404 de routage — mesuré à l'appel. Mais une réponse d'erreur peut
 * aussi venir d'ailleurs : un proxy, un équilibreur, une page d'erreur de
 * l'hébergeur. D'où le repli.
 *
 * LE REPLI N'INVENTE PAS DE CODE MÉTIER. `UNPARSEABLE_ERROR` n'est dans aucune des
 * vingt tables, donc `isKnownErrorCode` le dit inconnu et personne ne le confondra
 * avec une règle. Choisir `INTERNAL_ERROR` à sa place ferait passer « je n'ai pas
 * compris la réponse » pour « le serveur a planté » — deux incidents différents,
 * qu'on ne cherche pas au même endroit.
 */
async function readErrorBody(response: Response): Promise<FailureBody> {
  // Cloné : le corps d'une `Response` ne se lit qu'une fois, et l'appelant relit la
  // réponse quand le rejeu échoue. Sans le clone, le second `text()` rend vide et
  // le message d'erreur se perd — exactement au moment où on en a besoin.
  let text: string;
  try {
    text = await response.clone().text();
  } catch {
    text = '';
  }

  let raw: unknown = null;
  if (text.length > 0) {
    try {
      raw = JSON.parse(text);
    } catch {
      raw = null;
    }
  }

  const parsed = apiErrorBodySchema.safeParse(raw);
  if (parsed.success) {
    return {
      code: parsed.data.error.code,
      message: parsed.data.error.message,
      details: parsed.data.error.details ?? {},
    };
  }

  return {
    code: 'UNPARSEABLE_ERROR',
    message: '',
    details: text.length === 0 ? {} : { bodyExcerpt: text.slice(0, 200) },
  };
}

function toApiError(response: Response, failure: FailureBody): ApiError {
  /**
   * L'en-tête `Retry-After` PASSE AVANT `details.retryAfterSeconds`.
   *
   * Les deux portent la même valeur quand c'est `RateLimitGuard` qui répond
   * (mesuré : 3600 et 3600 sur l'OTP). Mais l'en-tête est la forme normalisée —
   * RFC 9110 §10.2.3 — donc la seule qu'un intermédiaire sait produire. Un `429`
   * d'un proxy aura l'en-tête et pas les détails ; l'inverse n'arrive pas.
   */
  const fromHeader = parseRetryAfter(response.headers.get('retry-after'));
  const fromDetails = failure.details['retryAfterSeconds'];
  const retryAfter =
    fromHeader ?? (typeof fromDetails === 'number' && Number.isFinite(fromDetails) ? fromDetails : null);

  return new ApiError(failure.code, failure.message, response.status, failure.details, retryAfter);
}

/**
 * La FRONTIÈRE : le corps est validé, ou l'appel lève.
 *
 * `204` et `205` n'ont pas de corps par définition (les `DELETE` et les actions
 * sans retour de T4 §1). On valide `undefined` contre le schéma plutôt que de
 * renvoyer directement : une route déclarée `z.object({…})` qui répond `204` est un
 * désaccord entre le client et l'API, et le taire donnerait `undefined` à un
 * appelant qui attend un objet — le défaut même qu'on cherche à rendre impossible.
 */
async function decode<S extends z.ZodTypeAny>(
  path: string,
  response: Response,
  schema: S,
): Promise<z.infer<S>> {
  let value: unknown;

  if (response.status === 204 || response.status === 205) {
    value = undefined;
  } else {
    const text = await response.text();
    if (text.length === 0) {
      value = undefined;
    } else {
      try {
        value = JSON.parse(text);
      } catch {
        // Un `200` dont le corps n'est pas du JSON : page d'erreur d'un proxy,
        // redirection vers un portail captif, HTML d'une page 502. C'est bien une
        // erreur de FORME, et pas une erreur métier — le serveur a dit oui.
        throw new ApiShapeError(path, [
          { path: '', message: `réponse ${response.status} qui n’est pas du JSON` },
        ]);
      }
    }
  }

  const parsed = schema.safeParse(value);
  if (!parsed.success) throw ApiShapeError.from(path, parsed.error);
  return parsed.data as z.infer<S>;
}
