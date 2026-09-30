import type { ZodError } from 'zod';
import {
  isKnownErrorCode,
  levelRequiredDetailsSchema,
  messageForErrorCode,
  rateLimitedDetailsSchema,
  validationFailedDetailsSchema,
  type LevelRequiredDetailsParsed,
  type RateLimitedDetails,
  type ValidationFailedDetails,
} from '@app/shared';

/**
 * Les trois échecs d'un appel d'API, et pourquoi ils sont TROIS CLASSES.
 *
 *   · `ApiError`      — le serveur a répondu, et il a dit non. C'est une règle
 *                       métier ou une permission : `code` la nomme, `message` est
 *                       affichable.
 *   · `ApiShapeError` — le serveur a répondu OUI, mais pas ce qu'il promet. La
 *                       réponse n'a pas la forme du schéma.
 *   · `ApiNetworkError` — le serveur n'a pas répondu du tout.
 *
 * LA SÉPARATION EST LE POINT. Le réflexe est un `catch (e) { afficher(e.message) }`
 * unique, et il transforme alors un CHANGEMENT DE CONTRAT en message d'erreur
 * métier : le membre lit « une erreur est survenue » sur un écran vide, et
 * personne ne sait que l'API a changé de forme. `ApiShapeError` n'hérite donc PAS
 * d'`ApiError` — un `instanceof ApiError` ne l'attrape pas, et le code qui traite
 * les règles métier ne peut pas l'avaler par accident.
 *
 * Toutes trois héritent d'`ApiFailure`, pour le rare appelant qui veut dire
 * « n'importe quel échec d'appel » sans confondre les trois.
 */
export abstract class ApiFailure extends Error {
  /**
   * La phrase à montrer au membre.
   *
   * ABSTRAITE, donc chaque échec DOIT répondre à la question « qu'est-ce que le
   * membre lit ? ». Une implémentation par défaut sur la classe de base aurait
   * laissé passer un échec qui affiche un message technique — ou la pile — faute
   * d'y avoir pensé.
   */
  abstract get displayMessage(): string;
}

/**
 * Le serveur a répondu par un refus — §5.2 `error { code, message, details }`.
 *
 * LE FRONT DÉCIDE SUR `code`, JAMAIS SUR `message` (§5.2, et `00` §4). Le message
 * est une phrase à montrer, pas une donnée à comparer : il est relu, retouché,
 * traduit, et un `if (message === '…')` casse au premier passage de l'équipe des
 * textes.
 */
export class ApiError extends ApiFailure {
  override readonly name = 'ApiError';

  constructor(
    /** Constante stable en SCREAMING_SNAKE (§5.2). */
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details: Readonly<Record<string, unknown>>,
    /**
     * Secondes à attendre avant de réessayer, ou `null`.
     *
     * EN SECONDES, toujours, et jamais en minutes — voir `formatRetryAfter`.
     */
    readonly retryAfterSeconds: number | null,
  ) {
    super(message);
  }

  /** Le dépôt connaît-il ce code ? Faux = l'API est plus récente que ce client. */
  get isKnown(): boolean {
    return isKnownErrorCode(this.code);
  }

  /**
   * La phrase à afficher.
   *
   * Celle du serveur d'abord : §5.2 la promet « française, affichable telle
   * quelle », et le module peut l'avoir précisée pour son cas. Le catalogue
   * partagé ensuite, pour le cas — rare mais réel — d'un intermédiaire qui
   * répondrait un code sans message. Et une phrase neutre en dernier recours.
   *
   * EXCEPTION, `RATE_LIMITED` : voir `rateLimitMessage`. Le message du serveur dit
   * « Patientez un instant » et l'attente réelle peut être d'une HEURE.
   */
  get displayMessage(): string {
    /**
     * `isRateLimited` et non `code === 'RATE_LIMITED'`.
     *
     * Un test l'a corrigé : un `429` produit par un PROXY n'a pas le format §5.2,
     * donc son code est `UNPARSEABLE_ERROR`. La condition sur le code laissait alors
     * afficher « une erreur est survenue » là où l'en-tête `Retry-After` disait
     * exactement combien attendre. C'est le statut qui fait la limite de débit, pas
     * le code — et c'est justement le cas où le serveur n'a pas pu se nommer qu'il
     * faut savoir traiter.
     */
    if (this.isRateLimited) return this.rateLimitMessage;
    if (this.message.length > 0) return this.message;
    return messageForErrorCode(this.code) ?? 'Une erreur est survenue. Réessayez dans un instant.';
  }

  /** `error.is('TOKEN_STALE')` — plus lisible qu'une comparaison de chaînes. */
  is(code: string): boolean {
    return this.code === code;
  }

  /** `429` — la limite de débit, distincte de tout autre refus (§5.5). */
  get isRateLimited(): boolean {
    return this.status === 429 || this.code === 'RATE_LIMITED';
  }

  /**
   * Le membre doit-il monter de niveau ? §7.3 : le front affiche une INVITATION,
   * jamais une simple erreur — d'où les détails typés plutôt qu'un `unknown`.
   */
  get levelRequired(): LevelRequiredDetailsParsed | null {
    if (this.code !== 'LEVEL_REQUIRED') return null;
    const parsed = levelRequiredDetailsSchema.safeParse(this.details);
    return parsed.success ? parsed.data : null;
  }

  /** Les détails du `429`, tels que `RateLimitGuard` les émet. */
  get rateLimit(): RateLimitedDetails | null {
    if (!this.isRateLimited) return null;
    const parsed = rateLimitedDetailsSchema.safeParse(this.details);
    return parsed.success ? parsed.data : {};
  }

  /**
   * Les champs refusés d'un `400 VALIDATION_FAILED` (T4 §3).
   *
   * Un tableau VIDE quand le code n'est pas `VALIDATION_FAILED`, et non `null` :
   * l'appelant boucle dessus pour marquer ses champs, et une boucle sur un tableau
   * vide ne marque rien — ce qui est exactement le comportement voulu.
   */
  get fieldErrors(): ValidationFailedDetails['fields'] {
    if (this.code !== 'VALIDATION_FAILED') return [];
    const parsed = validationFailedDetailsSchema.safeParse(this.details);
    return parsed.success ? parsed.data.fields : [];
  }

  /**
   * « Trop de tentatives. Réessayez dans une heure. »
   *
   * POURQUOI ON NE REPREND PAS LE MESSAGE DU SERVEUR. Il dit « Patientez un
   * instant avant de réessayer » (`TRANSVERSE_ERROR_MESSAGES.RATE_LIMITED`), ce
   * qui est juste pour une limite à la minute et FAUX pour celles à l'heure.
   * Mesuré sur l'API : dépasser `POST /auth/otp/request` (10/h) renvoie
   * `Retry-After: 3600`. « Un instant » pour une heure d'attente, c'est un membre
   * qui réessaie en boucle, épuise le budget des autres derrière le même NAT, et
   * finit par croire que l'inscription est cassée.
   */
  get rateLimitMessage(): string {
    const delay = this.retryAfterSeconds;
    if (delay === null) return 'Trop de tentatives. Patientez un instant avant de réessayer.';
    return `Trop de tentatives. Réessayez dans ${formatRetryAfter(delay)}.`;
  }
}

/**
 * La réponse n'a pas la forme promise — la frontière a refusé.
 *
 * C'EST LA RAISON D'ÊTRE DU CLIENT. Sans validation, une API qui change de forme
 * ne produit aucune erreur : `items` devient `undefined`, le `.map` qui suit lève
 * « cannot read properties of undefined » dans un composant qui n'a rien fait de
 * mal, et la pile ne nomme ni la route ni le champ. Avec elle, l'échec est ici,
 * sur l'appel, avec le chemin du champ fautif.
 *
 * `issues` porte les chemins zod, `path` la route appelée. Les deux sont
 * nécessaires : « `nextCursor` : attendu string|null, reçu undefined » ne sert à
 * rien si l'on ne sait pas de quelle route il vient.
 */
export class ApiShapeError extends ApiFailure {
  override readonly name = 'ApiShapeError';

  constructor(
    /** La route appelée, telle que l'appelant l'a écrite. */
    readonly path: string,
    readonly issues: readonly { readonly path: string; readonly message: string }[],
  ) {
    super(
      `La réponse de ${path} n’a pas la forme attendue : ` +
        issues.map((i) => `${i.path === '' ? '(racine)' : i.path} — ${i.message}`).join(' ; '),
    );
  }

  static from(path: string, error: ZodError): ApiShapeError {
    return new ApiShapeError(
      path,
      error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  }

  /**
   * Ce qu'on montre au membre.
   *
   * Surtout PAS le détail technique : il ne lui dit rien et révèle la structure
   * interne (§8.3). Le détail part dans `message`, donc dans la console et dans
   * Sentry, où il est utile.
   */
  get displayMessage(): string {
    return 'Une erreur est survenue de notre côté. Réessayez dans un instant.';
  }
}

/** Le serveur n'a pas répondu : réseau coupé, DNS, CORS, appel interrompu. */
export class ApiNetworkError extends ApiFailure {
  override readonly name = 'ApiNetworkError';

  constructor(
    readonly path: string,
    override readonly cause: unknown,
  ) {
    super(`Impossible de joindre l’API (${path}).`);
  }

  get displayMessage(): string {
    return 'Connexion impossible. Vérifiez votre réseau et réessayez.';
  }
}

/**
 * Une attente en français, depuis un nombre de SECONDES.
 *
 * L'unité est le piège de ce projet : §5.5 raisonne par minute, mais `01` §2.4
 * chiffre l'HEURE sur trois routes (`POST /auth/otp/request` 10/h, `PATCH /me`
 * 20/h, `PATCH /me/profile` 20/h). Un client qui lirait `3600` comme des minutes
 * annoncerait soixante heures ; un client qui supposerait la minute annoncerait
 * une minute pour une heure. On arrondit vers le HAUT — annoncer moins que la
 * réalité fait réessayer trop tôt, donc reprendre un `429`.
 */
export function formatRetryAfter(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  if (s < 60) return s <= 1 ? 'une seconde' : `${s} secondes`;
  const minutes = Math.ceil(s / 60);
  if (minutes < 60) return minutes === 1 ? 'une minute' : `${minutes} minutes`;
  const hours = Math.ceil(minutes / 60);
  return hours === 1 ? 'une heure' : `${hours} heures`;
}

/**
 * `Retry-After` — secondes, ou date HTTP (RFC 9110 §10.2.3).
 *
 * Les deux formes sont admises par la norme. `RateLimitGuard` envoie des secondes,
 * mais un proxy ou un hébergeur devant l'API peut envoyer une date, et la lire
 * comme un nombre donnerait `NaN` — donc aucune attente annoncée là où il en faut
 * une. `null` quand l'en-tête est absent ou illisible.
 */
export function parseRetryAfter(header: string | null): number | null {
  if (header === null) return null;
  const trimmed = header.trim();
  if (trimmed.length === 0) return null;

  if (/^\d+$/.test(trimmed)) return Number(trimmed);

  const at = Date.parse(trimmed);
  if (Number.isNaN(at)) return null;
  return Math.max(0, Math.ceil((at - Date.now()) / 1000));
}

/** Vrai pour les trois échecs de ce module. */
export function isApiFailure(value: unknown): value is ApiFailure {
  return value instanceof ApiFailure;
}

/**
 * La phrase à afficher pour n'importe quel échec, y compris un `unknown`.
 *
 * Écrit une fois ici plutôt que recopié dans chaque écran : cent vingt-quatre
 * écrans qui écrivent chacun leur `catch` finissent par en avoir cent vingt-quatre
 * variantes, dont certaines montrent la pile au membre.
 */
export function displayMessageFor(error: unknown): string {
  if (isApiFailure(error)) return error.displayMessage;
  return 'Une erreur est survenue. Réessayez dans un instant.';
}
