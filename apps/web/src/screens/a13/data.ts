/**
 * A13 — une story en lecture plein écran. LES PRISES DÉCLARÉES.
 *
 * Contrairement à A02, ce cadre est ENTIÈREMENT piloté par la donnée : les dix-sept
 * champs de `st` portent l'auteur, le texte, la pastille, les deux votes et la
 * barre de progression. Une story lue ici est donc une vraie story.
 *
 * ── DEUX RÈGLES DURES QUE CE FICHIER TIENT ─────────────────────────────────
 *
 * 1. AUCUN COMPTEUR DE VUES (`00` §49, 04 §2.6). Ce contrat n'a pas de champ où en
 *    mettre un, et `storyBubbleSchema` est `.strict()` : un `viewCount` greffé sur
 *    la réponse est refusé À LA FRONTIÈRE, avant d'arriver jusqu'ici. Ce qui se
 *    compte — `n1`, `n2` — ce sont les VOTES : un jugement donné volontairement,
 *    pas une mesure d'attention subie. La maquette dit la même chose sous sa
 *    planche : « un composant, trois types · aucun compteur de vues ».
 *
 * 2. LE TEXTE EST BORNÉ à 280 caractères (`FEED_LIMITS.storyBodyMax`), et c'est le
 *    schéma partagé qui le tient, à l'écriture comme à la lecture. Le cadre ne
 *    tronque pas : il n'a pas à le faire, parce que rien de plus long ne peut
 *    exister.
 *
 * ── LE MUR CONNU : UNE STORY À FOND IMAGE EST INDESSINABLE ─────────────────
 *
 * `backgroundUrl` vaut TOUJOURS `null` sur l'API d'aujourd'hui — le service ne
 * résout jamais `backgroundAssetId` en URL. `bg` retombe donc sur la couleur de
 * fond, et `photo` reste faux. C'est du back, et c'est remonté : rien n'est
 * fabriqué ici pour le masquer.
 */

export { storyMain, storyViewFor, storyViews } from '../accueil/data';

/**
 * La story qu'on lit, telle que les DEUX cadres la lisent.
 *
 * `useful`, `photo` et `confirmers` sont écrits sur toutes les stories, `false` et
 * `null` compris : trois formes d'objet différentes rendraient `st.confirmers`
 * inaccessible sur l'union, ce que `tsc` signale. Une absence et un `null` ne
 * disent pas la même chose à un compilateur.
 *
 * `n1` et `n2` sont des CHAÎNES : le cadre les affiche telles quelles, et le
 * serveur donne déjà `votes.positive` / `votes.negative` prêts à lire.
 */
export interface StoryReadView {
  /** Le fond : la couleur choisie par l'auteur. Jamais assombrie (T1 §1.2). */
  readonly bg: string;
  readonly avBg: string;
  readonly i: string;
  readonly name: string;
  /** « Lyon · il y a 3 h · expire dans 21 h » — COMPOSÉ PAR LE SERVEUR. */
  readonly sub: string;
  readonly pill: string;
  readonly pillFg: string;
  readonly label: string;
  readonly text: string;
  /** « 1er des conseils Logement aujourd'hui · 31 trouvent utile » — serveur. */
  readonly state: string;
  /** Le libellé du vote POSITIF du type — `votes.positiveLabel`, jamais deviné. */
  readonly a1: string;
  readonly useful: boolean;
  readonly n1: string;
  /** Le libellé du vote NÉGATIF du type — `votes.negativeLabel`. */
  readonly a2: string;
  readonly n2: string;
  readonly write: string;
  /** Les segments de progression, en largeurs déjà calculées. */
  readonly bars: readonly string[];
  readonly align: string;
  readonly photo: boolean;
  readonly confirmers: readonly { readonly i: string; readonly bg: string }[] | null;
}

/**
 * Ce que les deux cadres de A13 lisent.
 *
 * `storyMain` est un TABLEAU d'une seule story : le cadre d'ordinateur boucle
 * dessus, le cadre mobile reçoit `st` seul. C'est la maquette qui en décide ainsi —
 * elle range ses trois types côte à côte sur la planche mobile — et le contrat suit
 * la maquette plutôt que de la corriger.
 */
export interface A13Data {
  storyMain: readonly StoryReadView[];
  st: StoryReadView;
}
