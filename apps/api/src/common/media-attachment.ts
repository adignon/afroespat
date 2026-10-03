import type { MediaKind, MediaStatus } from '@app/shared';

/**
 * RATTACHEMENT D'UN MÉDIA — le genre et le statut exigés, en UN SEUL ENDROIT.
 *
 * ═══ POURQUOI CE FICHIER EXISTE ═══════════════════════════════════════════
 *
 * Quatre routes rattachent un `media_assets` à une ligne, et chacune avait sa
 * propre idée de ce qu'elle devait vérifier :
 *
 *   | point de rattachement              | propriétaire | genre | statut |
 *   |------------------------------------|--------------|-------|--------|
 *   | `feed.resolveMedia`                | oui          | NON   | oui    |
 *   | `messaging.assertOwnedMedia`       | oui          | oui   | NON    |
 *   | `events` (couverture, création)    | NON          | NON   | NON    |
 *   | `events` (couverture, mise à jour) | NON          | NON   | NON    |
 *   | `communities.addAlbumMedia`        | oui          | oui   | (voir) |
 *
 * Un seul de ces cinq contrôlait les trois choses. Les trous n'étaient pas les
 * mêmes d'un point à l'autre, et c'est exactement ce qui les a rendus invisibles :
 * chaque route, lue seule, a l'air de vérifier « quelque chose ».
 *
 * ═══ LE TROU LE PLUS GRAVE, ET CE QU'IL OUVRAIT ════════════════════════════
 *
 * `feed.resolveMedia` ne regardait AUCUN genre. Un membre pouvait donc passer
 * l'identifiant de son PROPRE justificatif professionnel (`kind = 'PROOF'`) comme
 * image de publication, ou comme fond de story, et le PUBLIER.
 *
 * 00-fondations.md §8.1 en décide autrement, et sans réserve :
 *
 *   | Justificatif d'activité pro | Stocké, **accès équipe uniquement, jamais
 *   | affiché** |
 *
 * « Jamais affiché » ne souffre pas l'exception du propriétaire : le document
 * porte un numéro de SIRET, une adresse, parfois une pièce d'identité annexée.
 * Le membre qui le publie ne mesure pas ce qu'il expose, et la règle est écrite
 * pour le protéger lui AUSSI, pas seulement les autres de lui.
 *
 * ═══ LE REFUS EST UN 404, ET C'EST VOULU ═══════════════════════════════════
 *
 * Le genre est porté par la ligne, pas par l'identifiant : un 403 « mauvais
 * genre » apprendrait à l'appelant qu'un média de genre protégé EXISTE sous cet
 * identifiant. On filtre donc dans la clause `where` et on rend le même
 * `NOT_FOUND` que pour un identifiant inconnu — l'identifiant ne devient pas un
 * oracle d'existence.
 */

/** §6.3 : un média n'est servable et rattachable qu'en `READY`. */
export const REQUIRED_MEDIA_STATUS: MediaStatus = 'READY';

/**
 * Les genres recevables par point de rattachement.
 *
 * Volontairement LIMITÉ aux points que ce lot corrige. Une entrée que personne
 * ne lit est une entrée qui dérive sans que rien ne le dise ; les autres points
 * (`housing`, `pros`, `communities`) portent déjà leur genre dans leur propre
 * requête, et leur regroupement ici demande de toucher des fichiers que ce lot
 * ne touche pas.
 *
 * `satisfies` et non `:` — la valeur reste littérale pour le type, et un genre
 * absent de l'énumération `MediaKind` casse la compilation.
 */
export const ATTACHABLE_KINDS = {
  /**
   * Publication et story partagent `POST`.
   *
   * 04-fil.md §2.1 (« Jusqu'à 4 images (`post_media`), passées par le pipeline
   * média ») et §2.6 (story : « fond couleur ou image ») ne nomment pas de genre
   * distinct, et l'énumération de 00 §6.3 n'en offre pas : `ALBUM` est le genre
   * de l'album de réseau (`communities.service.ts`), pas celui du fil.
   */
  feed: ['POST'],

  /** 08 §6 : une pièce jointe de message, et rien d'autre. */
  message: ['MESSAGE'],

  /**
   * 09 §3.1 : la couverture d'un événement.
   *
   * REMONTÉ — l'énumération de 00 §6.3 ne contient pas de `COMMUNITY_COVER`, si
   * bien que la couverture d'un RÉSEAU emprunte aussi `EVENT_COVER`. Le genre ne
   * peut donc pas, à lui seul, distinguer la couverture d'un événement public de
   * celle d'un réseau sur invitation : cette distinction doit se lire sur la
   * LIGNE qui référence le média, pas sur son genre.
   */
  eventCover: ['EVENT_COVER'],
} as const satisfies Record<string, readonly MediaKind[]>;

export type AttachmentPoint = keyof typeof ATTACHABLE_KINDS;

/**
 * Le fragment de clause `where` : propriétaire, non supprimé, genre recevable.
 *
 * Rendu comme un objet à étaler (`...`) plutôt qu'appliqué par la fonction :
 * `feed` interroge plusieurs identifiants d'un coup (`findMany` + `in`), les
 * autres un seul (`findUnique`), et leur imposer une forme unique obligerait l'un
 * des deux à une requête qu'il ne veut pas.
 *
 * LE PROPRIÉTAIRE EST DANS LE FRAGMENT. C'était le seul contrôle présent partout,
 * donc le seul qu'on risquait de croire acquis — et `events` ne l'avait pas.
 *
 * ═══ POURQUOI LE STATUT N'EST PAS ICI ══════════════════════════════════════
 *
 * Parce que les deux refus ne portent pas le même sens, et que le dépôt a déjà
 * tranché pour le fil :
 *
 *   - **mauvais genre → 404.** Le genre est une PROPRIÉTÉ CACHÉE de la ligne ;
 *     dire « mauvais genre » révélerait qu'un média protégé existe sous cet
 *     identifiant. Il appartient donc à la clause `where`.
 *   - **mauvais statut → une erreur de VALIDATION, pas une absence.** Le membre
 *     VIENT d'envoyer ce fichier et sait qu'il existe ; lui rendre 404
 *     l'enverrait chercher un identifiant perdu alors que le fichier est
 *     seulement en cours d'analyse, ou refusé par l'antivirus.
 *
 * Mettre `status` dans le fragment transformerait donc ce refus utile en 404
 * trompeur. Chaque appelant compare le statut à `REQUIRED_MEDIA_STATUS` après la
 * requête, avec l'erreur que son module expose.
 *
 * ═══ ET CES ERREURS N'ONT PAS LE MÊME CODE HTTP — À REMONTER ═══════════════
 *
 *   | point              | code applicatif      | HTTP | d'où vient le chiffre |
 *   |--------------------|----------------------|------|-----------------------|
 *   | `message`, `event` | `VALIDATION_FAILED`  | 400  | MESURÉ par HTTP (`events-cover-http.int.test.ts`) |
 *   | `feed`             | `INVALID_ATTACHMENT` | 422  | LU dans `validation/feed.ts`, non mesuré ici |
 *
 * La distinction entre les deux dernières colonnes est volontaire : le 400 sort
 * d'un appel réel, le 422 d'une table de correspondance que personne n'a encore
 * exercée sur le fil (ses tests sont au niveau du SERVICE, donc aveugles au code
 * HTTP). Le second reste donc à mesurer.
 *
 * Le 422 du fil est ANTÉRIEUR à ce lot et figé par `feed.int.test.ts`
 * (`validation/feed.ts` associe `INVALID_ATTACHMENT` à 422) ; les deux autres
 * passent par `ApiError.validation`, que le catalogue associe à 400. Un même
 * refus — « ce média n'est pas prêt » — sort donc en 422 ici et en 400 là.
 *
 * Ce n'est PAS un choix : c'est ce que le dépôt fait, et il faudrait un code
 * d'erreur commun pour l'unifier. J'avais d'abord écrit 422 partout de tête, et
 * le premier appel réel l'a démenti — un code de retour ne se raisonne pas.
 * L'arbitrage (unifier sur 400 ou sur 422) appartient au propriétaire.
 */
export function ownedAttachableWhere(
  point: AttachmentPoint,
  ownerUserId: string,
): {
  ownerUserId: string;
  deletedAt: null;
  kind: { in: MediaKind[] };
} {
  return {
    ownerUserId,
    deletedAt: null,
    // COPIE, et non la constante elle-même : Prisma exige un tableau mutable
    // (`MediaKind[]`, pas `readonly MediaKind[]`), et lui passer la constante
    // partagée lui donnerait de quoi la vider pour tous les appelants suivants.
    kind: { in: [...ATTACHABLE_KINDS[point]] },
  };
}
