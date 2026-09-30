/**
 * Les PRISES de l'écran A09 — « un sujet du réseau ».
 *
 * Déclarées et non déduites d'un exemple : voir l'en-tête de `a07/data.ts`.
 *
 * ── LA PORTE DE DERRIÈRE ───────────────────────────────────────────────────
 *
 * Cet écran lit `GET /topics/:id`, qui atteint un sujet par son identifiant
 * propre SANS passer par son réseau. C'est le chemin qu'une fuite emprunte,
 * parce qu'il ne ressemble pas à une lecture de réseau — et c'est justement
 * celui-là qu'on oublie de garder.
 *
 * Il EST gardé : mesuré, à un non-membre d'un réseau `PUBLIC`, la route répond
 * `403 FORBIDDEN` / `NOT_A_MEMBER`, comme les sept routes de contenu. L'écran ne
 * doit donc jamais s'en servir pour afficher un sujet qu'il n'a pas pu obtenir
 * par la liste du réseau, et `use-sujet.ts` laisse remonter le refus au lieu de
 * le convertir en page vide.
 */
export { EYE, I, LOCK, PIN, panel, panelReseaux, rail } from '../reseaux/chrome';
import { EYE, LOCK, PIN, panel, panelReseaux, rail } from '../reseaux/chrome';

/**
 * Une réponse au sujet.
 *
 * `indent` / `indentM` portent l'unique niveau de réponse autorisé — 48 px sur
 * ordinateur, 34 px sur mobile. Ils se lisent de `parentCommentId`, que le
 * service renvoie ; les réponses arrivent À PLAT et l'imbrication n'est pas
 * donnée.
 *
 * `canReply` suit la PROFONDEUR et non un droit : on répond à une racine, jamais
 * à une réponse.
 *
 * `guide` est `null` partout. La maquette dessine la prise d'un guide lié sous
 * une réponse, mais aucune réponse de sujet n'en porte dans aucune charge
 * relevée. Remonté plutôt que rempli d'un guide inventé.
 */
export interface CommentRowView {
  readonly i: string;
  readonly bg: string;
  readonly name: string;
  readonly text: string;
  readonly time: string;
  readonly indent: string;
  readonly indentM: string;
  readonly canReply: boolean;
  readonly guide: null;
  readonly commentId: string;
}

/**
 * Les trois actions de modération, telles que la maquette les dessine.
 *
 * Elles sont MONTRÉES d'après `canPin` et `canResolve`, que le serveur recalcule
 * à chaque lecture du sujet — jamais d'après un rôle que l'écran aurait gardé.
 * Et le geste est TENTÉ : si le droit a changé entre-temps, c'est le serveur qui
 * refuse, pas une copie périmée.
 */
export const modActions = [
  { label: 'Épingler', icon: PIN },
  { label: 'Clore le sujet', icon: LOCK },
  { label: 'Masquer', icon: EYE },
];

export const comments: readonly CommentRowView[] = [];

export interface A09Data {
  rail: typeof rail;
  shortcuts: readonly { name: string; sub: string; i: string; bg: string }[];
  panelReseaux: ReturnType<typeof panel>;
  comments: readonly CommentRowView[];
  modActions: typeof modActions;
}

export const shortcuts: readonly { name: string; sub: string; i: string; bg: string }[] = [];

export const a09Fallback: A09Data = { rail, shortcuts, panelReseaux, comments, modActions };
