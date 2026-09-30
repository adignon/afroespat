/**
 * CE QU'UN ÉCRAN DE RÉSEAU DOIT SAVOIR D'UN ÉCHEC POUR LE MONTRER CORRECTEMENT.
 *
 * Écrit une fois pour les quatre écrans : A07, A08, A09 et A10 tombent sur les
 * mêmes refus, et quatre traductions du même `error.code` finiraient par en
 * oublier une.
 *
 * ── ON DÉCIDE SUR `error.code`, JAMAIS SUR LE MESSAGE ──────────────────────
 *
 * Le message est fait pour être lu par un humain ; il change avec le ton, la
 * langue et les relectures. Le code est le contrat.
 *
 * ── LES TROIS REFUS QUI DESSINENT UN ÉCRAN DIFFÉRENT ───────────────────────
 *
 *   · `FORBIDDEN` + `reason: 'NOT_A_MEMBER'` — le lecteur n'est pas dans ce
 *     réseau. CE N'EST PAS UNE ERREUR à montrer, c'est l'invitation à rejoindre.
 *     Mesuré sur les sept routes de contenu d'un réseau PUBLIC, plus
 *     `GET /topics/:id` ;
 *   · `FORBIDDEN` + `reason: 'MODERATOR_REQUIRED'` / `'OWNER_REQUIRED'` — le
 *     lecteur est dedans mais pas au bon rang. L'action se retire, la page reste ;
 *   · `LEVEL_REQUIRED` — l'invitation à monter de niveau de §7.3, avec de quoi
 *     l'écrire (`requiredLevel`, `currentLevel`, `labelFr`).
 *
 * Un `NOT_FOUND` sur un réseau ne veut PAS dire « il n'existe pas » : sur un
 * réseau `INVITE_ONLY`, c'est le refus lui-même, choisi pour ne pas confirmer
 * son existence. L'écran doit donc écrire « introuvable », jamais « accès
 * refusé » — dire le second annulerait tout le bénéfice du 404.
 */
/**
 * CHEMIN RELATIF, ET NON `@/lib/api/index`.
 *
 * L'alias `@/` est déclaré dans `tsconfig.json` mais PAS dans
 * `vitest.config.ts` : un test qui importe ce module échoue alors à la
 * résolution, avant d'exécuter la moindre assertion — « Failed to resolve
 * import », zéro test lancé, et la suite paraît passer si on ne lit que le
 * nombre de fichiers.
 *
 * Ce module est justement celui que les tests importent, puisqu'il porte la
 * lecture des refus. Le chemin relatif le rend éprouvable sans toucher à la
 * configuration partagée de Vitest, sur laquelle trois autres lots travaillent
 * en parallèle.
 */
import { ApiError, ApiShapeError, displayMessageFor } from '../../lib/api/index';

export interface ReseauEchec {
  /**
   * La phrase française, composée par le socle.
   *
   * JAMAIS le message brut du serveur sur un `429` : il dit « patientez un
   * instant » pour une attente qui peut valoir une heure.
   */
  readonly message: string;
  /** §7.3 : de quoi composer l'INVITATION à monter de niveau. */
  readonly levelRequired: NonNullable<ApiError['levelRequired']> | null;
  /** Vrai quand le CONTRAT est cassé — un incident, pas une règle métier. */
  readonly incident: boolean;
  /** EN SECONDES, et peut valoir 3600. On ne rejoue jamais un `429`. */
  readonly retryAfterSeconds: number | null;
  /**
   * Le lecteur n'est pas membre de ce réseau.
   *
   * La prise la plus importante du fichier : elle fait afficher « Rejoignez pour
   * voir les sujets » au lieu d'une erreur, ET elle empêche de présenter un
   * refus comme une absence de contenu.
   */
  readonly notMember: boolean;
  /** Le lecteur est membre, mais pas modérateur ou propriétaire. */
  readonly rankTooLow: boolean;
  /** Le réseau est introuvable — ou `INVITE_ONLY` et on ne le dira pas. */
  readonly notFound: boolean;
}

/** Le `reason` que le service pose dans `details`, quand il en pose un. */
function reasonOf(error: ApiError): string | null {
  const d: unknown = error.details;
  if (d === null || typeof d !== 'object') return null;
  const r: unknown = (d as Record<string, unknown>)['reason'];
  return typeof r === 'string' ? r : null;
}

export function echecDe(error: unknown): ReseauEchec {
  /**
   * `ApiShapeError` EN PREMIER, et il n'hérite PAS d'`ApiError` — c'est voulu
   * par le socle : un `catch (e) { if (e instanceof ApiError) }` ne peut pas
   * transformer une rupture de contrat en message métier rassurant. Un schéma
   * qui ne colle plus est un INCIDENT, pas une règle qui s'applique.
   */
  if (error instanceof ApiShapeError) {
    return {
      message: displayMessageFor(error),
      levelRequired: null,
      incident: true,
      retryAfterSeconds: null,
      notMember: false,
      rankTooLow: false,
      notFound: false,
    };
  }
  if (error instanceof ApiError) {
    const reason = reasonOf(error);
    return {
      message: displayMessageFor(error),
      levelRequired: error.levelRequired,
      incident: false,
      retryAfterSeconds: error.retryAfterSeconds,
      notMember: error.code === 'FORBIDDEN' && reason === 'NOT_A_MEMBER',
      rankTooLow:
        error.code === 'FORBIDDEN' &&
        (reason === 'MODERATOR_REQUIRED' || reason === 'OWNER_REQUIRED'),
      notFound: error.code === 'NOT_FOUND',
    };
  }
  return {
    message: displayMessageFor(error),
    levelRequired: null,
    incident: false,
    retryAfterSeconds: null,
    notMember: false,
    rankTooLow: false,
    notFound: false,
  };
}
