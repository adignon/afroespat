/**
 * Les PRISES de l'écran A08 — « un réseau, onglet Sujets ».
 *
 * Déclarées et non déduites d'un exemple : voir l'en-tête de `a07/data.ts`.
 *
 * ── CE QUE CET ÉCRAN DOIT SAVOIR AVANT DE DESSINER ─────────────────────────
 *
 * A08 est le seul écran du lot qui peut être regardé par quelqu'un QUI N'EST PAS
 * MEMBRE. L'en-tête du réseau lui est renvoyé — un réseau public se découvre —
 * mais les sept routes de contenu lui répondent `403 NOT_A_MEMBER`, et les
 * compteurs de l'en-tête arrivent MASQUÉS à zéro.
 *
 * `topics` vide n'a donc pas un sens unique : il veut dire « aucun sujet » pour
 * un membre, et « je ne vous le dirai pas » pour un passant. C'est pourquoi
 * `isMember` est une prise à part entière de cet écran, et pourquoi
 * `use-reseau.ts` la remplit depuis `myStatus` plutôt que de la déduire d'une
 * liste vide.
 */
export { CHAT, I, PIN, netTabsFor, panel, panelReseaux, rail, tab } from '../reseaux/chrome';
import { netTabsFor, panel, panelReseaux, rail } from '../reseaux/chrome';
import { enteteVide, type ReseauEnteteView } from '../a08t/data';

/**
 * Une ligne de sujet.
 *
 * `pinned` change le fond de la ligne ET la couleur de son icône — deux marques,
 * pas une, parce qu'un fond très clair seul ne se voit pas à contraste réduit.
 *
 * `topicId` n'est jamais dessiné : il voyage avec la ligne pour que la page
 * puisse ouvrir A09, épingler ou clore sans tenir un second tableau indexé par
 * rang, qui se désynchroniserait au premier filtre appliqué.
 */
export interface TopicRowView {
  readonly title: string;
  readonly last: string;
  readonly state: string;
  readonly n: number;
  readonly icon: string;
  readonly pinned: boolean;
  /**
   * LES CINQ PRISES DE COULEUR, ET CE QU'ELLES ONT RÉVÉLÉ.
   *
   * Le JSX transcodé lit `t.bg`, `t.iconBg`, `t.iconFg`, `t.stBg` et `t.stFg`.
   * Le jeu de données partagé ne les a JAMAIS posées : elles arrivaient donc à
   * `undefined`, et les styles en ligne se rendaient sans fond ni couleur — un
   * sujet épinglé ne se distinguait d'aucune façon d'un sujet ordinaire, ce qui
   * est exactement ce que la maquette prend soin de marquer DEUX fois.
   *
   * Personne ne l'avait vu, parce qu'une prise absente ne casse rien : elle
   * dessine seulement moins bien. C'est le premier bénéfice mesuré des prises
   * déclarées — `tsc` a nommé les cinq champs dès que le type a cessé d'être
   * déduit d'un exemple qui ne les contenait pas.
   *
   * Les valeurs sont reprises À L'IDENTIQUE du `renderVals()` de la maquette :
   *   bg:t.pinned?'#FAFBFB':'transparent'
   *   iconBg:t.pinned?'#E3F0EB':'#F2F5F4'  iconFg:t.pinned?'#0F5C48':'#5D6B66'
   *   stBg:t.state==='Ouvert'?'#E3F0EB':'#F2F5F4'
   *   stFg:t.state==='Ouvert'?'#0F5C48':'#5D6B66'
   * Aucune n'est assombrie.
   */
  readonly bg: string;
  readonly iconBg: string;
  readonly iconFg: string;
  readonly stBg: string;
  readonly stFg: string;
  readonly topicId: string;
}

/**
 * Les cinq couleurs d'une ligne, telles que la maquette les calcule.
 *
 * `pinned` marque DEUX fois — le fond de la ligne et le fond de l'icône — parce
 * qu'un fond très clair seul ne se voit pas à contraste réduit. On garde les
 * deux marques.
 */
export function topicRowTint(pinned: boolean, state: string) {
  const ouvert = state === 'Ouvert';
  return {
    bg: pinned ? '#FAFBFB' : 'transparent',
    iconBg: pinned ? '#E3F0EB' : '#F2F5F4',
    iconFg: pinned ? '#0F5C48' : '#5D6B66',
    stBg: ouvert ? '#E3F0EB' : '#F2F5F4',
    stFg: ouvert ? '#0F5C48' : '#5D6B66',
  };
}

export const netTabs = netTabsFor(1);

/** Les trois actions du bandeau propriétaire, telles que la maquette les nomme. */
export const ownerActions = ['Annonce', 'Épingler', 'Gérer'];

export const topics: readonly TopicRowView[] = [];

export interface A08Data {
  /**
   * L'EN-TÊTE DU RÉSEAU, ajouté au contrat après avoir REGARDÉ l'écran.
   *
   * A08 lisait déjà six prises — rail, panneau, onglets, actions, sujets — et
   * n'était donc pas dans le lot des cadres sourds. Mais son en-tête restait
   * écrit en dur, et cela donnait, sur `/reseaux/pays-bj?onglet=sujets` :
   *
   *     BN · Béninois en France · 890 membres · réseau de pays · vous êtes membre
   *     Rejoignez ce réseau pour voir ses sujets et ses membres.
   *
   * Les deux phrases dans la même page. L'onglet par DÉFAUT du réseau nommait un
   * autre réseau que celui de l'URL et déclarait membre un lecteur à qui le
   * serveur venait de refuser le contenu, pendant que les cinq autres onglets
   * affichaient « Bénin · 99 membres ». C'est le même type que celui des
   * planches d'onglet (`a08t/data.ts`), rempli par le même convertisseur.
   */
  reseau: ReseauEnteteView;
  rail: typeof rail;
  shortcuts: readonly { name: string; sub: string; i: string; bg: string }[];
  panelReseaux: ReturnType<typeof panel>;
  netTabs: ReturnType<typeof netTabsFor>;
  ownerActions: typeof ownerActions;
  topics: readonly TopicRowView[];
}

export const shortcuts: readonly { name: string; sub: string; i: string; bg: string }[] = [];

export const a08Fallback: A08Data = {
  reseau: enteteVide,
  rail,
  shortcuts,
  panelReseaux,
  netTabs,
  ownerActions,
  topics,
};
