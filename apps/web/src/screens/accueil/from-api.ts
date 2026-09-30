/**
 * DE L'API VERS LES PRISES DU JSX TRANSCODÉ.
 *
 * Ce fichier est la charnière du lot, et il vaut de dire exactement ce qu'il fait,
 * parce que c'est la seule façon de ne pas le confondre avec du dessin.
 *
 * Le JSX de `screens/a01/*.generated.tsx` ne bouge pas d'une virgule : il lit
 * `p.name`, `p.bg`, `p.tFg`, `p.action`… c'est-à-dire la FORME que la maquette
 * calcule dans son `renderVals()`. L'API, elle, renvoie `author.displayName`,
 * `type`, `reaction.actionLabel`. Les deux vocabulaires sont différents et doivent
 * le rester : la maquette est une source de DESSIN, l'API une source de DONNÉE.
 *
 * Ce fichier traduit le second dans le premier. Il ne décide rien : chaque libellé
 * qu'il pose vient soit de l'API (`typeLabel`, `actionLabel`, `counter.word`,
 * `context.text`), soit de la table de COULEURS de la maquette — laquelle est du
 * dessin, donc reste ici.
 *
 * ── CE QUE L'API NE PEUT PAS REMPLIR, ET QU'ON NE FABRIQUE PAS ──────────────
 *
 * La maquette dessine, sur ses cartes de fil, quatre affordances dont AUCUNE n'a
 * de source côté API — vérifié route par route, schéma par schéma, et dans le
 * schéma Prisma :
 *
 *   · `poll` / `pollMeta` — un sondage DANS une publication. `createPostSchema` est
 *     `.strict()` et n'a pas de champ sondage ; `POST /communities/:id/polls` en
 *     crée bien, mais rattachés à un RÉSEAU, pas à une publication. 04 §2.4 ne
 *     mentionne aucun sondage ;
 *   · `tags` — aucun champ de mots-clés sur `Post` ;
 *   · `tip` — l'encadré « conseil » sous une info : aucun champ ;
 *   · `likes` sur un commentaire — aucune réaction de commentaire n'existe, ni en
 *     base ni dans aucune réponse.
 *
 * Ces champs sont donc OMIS, et c'est un choix : les remplir d'une valeur inventée
 * — un sondage vide, `likes: 0` — mettrait à l'écran une affordance qui ne peut
 * pas fonctionner, et le défaut ne se verrait qu'au clic. Les quatre sont remontés
 * au rapport de lot pour que le back les tranche.
 *
 * ── LES COULEURS PAR PERSONNE ───────────────────────────────────────────────
 *
 * La maquette donne une couleur d'avatar à chaque membre. L'API n'en renvoie
 * aucune — et ne devrait pas : c'est du dessin. On la DÉRIVE du `handle`, de façon
 * stable, dans la palette de la maquette. Stable importe : une couleur tirée au
 * hasard changerait à chaque rendu, et le même membre serait de deux couleurs
 * entre le fil et la colonne droite. Aucune couleur n'est assombrie (T1 §1.2 et la
 * décision assumée du propriétaire sur les huit paires sous AA).
 */
import type {
  CommentThread,
  FeedResponse,
  FeedSidebarResponse,
  MemberSummary,
  PostCard,
  StoryBandResponse,
} from '@app/shared';
import type { CommentView, EventView, FeedPostView, PersonView, StoryView } from '../a01/data';

/**
 * Les prises du cadre, PLUS ce dont la page a besoin pour agir.
 *
 * Le JSX transcodé ne lit que `FeedPostView` ; `postId`, `isAuthor` et `mine` ne
 * sont jamais dessinés. Ils voyagent pourtant avec la carte parce que la page en a
 * besoin pour réagir, ouvrir le détail ou proposer la modification — et les
 * transporter à côté, dans un second tableau indexé par rang, se désynchroniserait
 * au premier filtre appliqué.
 *
 * Les déclarer explicitement plutôt que de les laisser inférer a un effet qu'on
 * veut : le convertisseur est désormais VÉRIFIÉ contre la prise du cadre. S'il
 * cessait de poser `action` ou `word`, `tsc` le dirait ici plutôt que de laisser un
 * `undefined` traverser le JSX jusqu'à un bouton sans libellé.
 */
export interface FeedPostCarte extends FeedPostView {
  readonly postId: string;
  readonly isAuthor: boolean;
  readonly mine: string | null;
}

export interface StoryBulle extends StoryView {
  readonly storyId: string;
  readonly hasUnseen: boolean;
}

export interface EvenementCarte extends EventView {
  readonly eventId: string;
}

export interface PersonneCarte extends PersonView {
  readonly handle: string;
}

export interface CommentaireLigne extends CommentView {
  readonly commentId: string;
  readonly canEdit: boolean;
}

// ─── Identité visuelle d'un membre ──────────────────────────────────────────

/** La palette d'avatars de la maquette, dans son ordre. Aucune teinte ajoutée. */
const AVATAR_COLORS = ['#0F5C48', '#16785E', '#B4581F', '#2FA37D', '#E0733A'] as const;

/**
 * Les initiales, comme la maquette les dessine : une ou deux lettres majuscules.
 *
 * `Array.from` et non `split('')` : un prénom comme « Émile » commence par un
 * caractère qui tient sur deux unités de code dans certaines compositions, et
 * `split('')` le couperait en deux moitiés invalides.
 */
export function initials(displayName: string): string {
  const mots = displayName
    .trim()
    .split(/\s+/)
    .filter((m) => m.length > 0);
  if (mots.length === 0) return '·';
  const lettre = (m: string): string => (Array.from(m)[0] ?? '').toLocaleUpperCase('fr-FR');
  return mots.length === 1
    ? lettre(mots[0] as string)
    : `${lettre(mots[0] as string)}${lettre(mots[1] as string)}`;
}

/** Couleur STABLE dérivée du handle : le même membre garde la sienne partout. */
export function avatarColor(handle: string): string {
  let somme = 0;
  for (const c of handle) somme = (somme + c.codePointAt(0)!) % 9973;
  return AVATAR_COLORS[somme % AVATAR_COLORS.length] as string;
}

/** Ce que tout avatar de la maquette demande : deux lettres et un fond. */
function avatar(m: MemberSummary): { readonly i: string; readonly bg: string } {
  return { i: initials(m.displayName), bg: avatarColor(m.handle) };
}

// ─── Le fil ─────────────────────────────────────────────────────────────────

/**
 * Les couleurs de la pastille de type, telles que la maquette les fixe.
 *
 * Indexées par le `type` de l'API et non par un rang : la maquette range ses
 * quatre types dans un ordre, et un tableau indexé par position se décalerait au
 * premier type ajouté. `reactBg` est la couleur du bouton de réaction, que la
 * maquette fait varier — terre cuite sur une victoire et une question, vert
 * ailleurs.
 */
const TYPE_STYLE = {
  VICTORY: {
    tBg: '#E3F0EB',
    tFg: '#0F5C48',
    tDot: '#16785E',
    reactBg: '#E0733A',
    aBg: '#E3F0EB',
    aFg: '#0F5C48',
  },
  QUESTION: {
    tBg: '#FBE3D4',
    tFg: '#B4581F',
    tDot: '#E0733A',
    reactBg: '#E0733A',
    aBg: '#FBE3D4',
    aFg: '#B4581F',
  },
  INFO: {
    tBg: '#F2F5F4',
    tFg: '#5D6B66',
    tDot: '#8A958F',
    reactBg: '#16785E',
    aBg: '#E3F0EB',
    aFg: '#0F5C48',
  },
  DISCUSSION: {
    tBg: '#E8EEEC',
    tFg: '#0F5C48',
    tDot: '#0F5C48',
    reactBg: '#0F5C48',
    aBg: '#E8EEEC',
    aFg: '#0F5C48',
  },
} as const;

/**
 * L'icône du bouton d'action, par type. Du DESSIN, donc de la maquette.
 *
 * Elle ne peut pas venir de l'API — un chemin SVG n'a rien à faire dans une
 * réponse JSON — mais elle est choisie d'après le `type` que l'API renvoie, jamais
 * d'après le libellé : traduire le libellé changerait l'icône.
 */
const ACTION_ICON = {
  VICTORY: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8',
  QUESTION: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  INFO: 'M7 11v9M7 11l4-7c1.5 0 2.5 1 2.5 2.5V10h5a2 2 0 0 1 2 2l-1.5 6a2 2 0 0 1-2 2H7',
  DISCUSSION: 'M4 5h12v8H8l-4 3zM20 9v8l-3-2h-6',
} as const;

/**
 * Une carte de publication, prête pour le JSX transcodé.
 *
 * Tous les LIBELLÉS viennent du serveur : `typeLabel`, `counter.word`,
 * `reaction.actionLabel`, `commentLabel`, `context.text`. C'est la règle dure
 * « le vocabulaire de réaction renvoyé correspond au type de publication » — si le
 * front recomposait « félicitations » d'après le type, il existerait deux tables
 * de vocabulaire et elles divergeraient.
 *
 * `meta` est la ligne sous les compteurs. La maquette y met « N commentaires ·
 * N partages » ; l'API ne compte pas les partages, donc on n'écrit que ce qu'on
 * sait — et au singulier quand il n'y en a qu'un.
 */
export function feedPostFrom(p: PostCard): FeedPostCarte {
  const style = TYPE_STYLE[p.type];
  return {
    ...avatar(p.author),
    name: p.author.displayName,
    type: p.typeLabel,
    ...style,
    /** §2.2 : le NOM DU TYPE de parcours, jamais le titre personnel. Composé serveur. */
    ctx: p.context.text,
    body: p.excerpt,
    n: p.counter.displayCount,
    word: p.counter.word,
    meta: `${p.commentCount} ${p.commentCount === 1 ? 'commentaire' : 'commentaires'}`,
    action: p.reaction.actionLabel,
    actionIcon: ACTION_ICON[p.type],
    comment: p.commentLabel,
    /** L'encart « Étape franchie · N sur M » (§2.2), absent s'il n'y a pas d'étape. */
    ...(p.stepBadge === null ? {} : { step: p.stepBadge.stepName }),
    /**
     * La première image, comme la maquette la dessine. Les quatre arrivent dans
     * `media`, mais le cadre transcodé n'en place qu'une — ne pas en dessiner
     * quatre là où la maquette en montre une serait redessiner.
     */
    ...(p.media.length === 0 ? {} : { photo: p.media[0]?.url ?? '', photoH: '260px' }),
    /** Ce que l'écran doit rouvrir : le détail, les commentaires, la réaction. */
    postId: p.id,
    isAuthor: p.isAuthor,
    mine: p.reaction.mine,
  };
}

export function feedPostsFrom(page: FeedResponse): readonly FeedPostCarte[] {
  return page.items.map(feedPostFrom);
}

// ─── Le bandeau de stories ──────────────────────────────────────────────────

/** Les couleurs de pastille par type, de la maquette. */
const STORY_PILL = { CONSEIL: '#16785E', DECOUVERTE: '#2FA37D', INFORMATION: '#0F5C48' } as const;

/** La clé de filtre de la maquette : 0 conseil, 1 découverte, 2 information. */
const STORY_FILTER_KEY = { CONSEIL: 0, DECOUVERTE: 1, INFORMATION: 2 } as const;

/**
 * Une bulle du bandeau.
 *
 * `count` est un compteur de VOTES du type, composé depuis `votes.positive` et
 * `votes.positiveLabel` que le serveur donne — JAMAIS un compteur de vues : la
 * règle dure de §2.6 l'interdit, et l'API ne l'expose sur aucune route, pas même
 * à l'auteur. Le schéma de réponse est `.strict()` pour que l'ajout d'un
 * `viewCount` soit refusé à la frontière plutôt que dessiné ici.
 *
 * `type` affiche le SUJET quand il y en a un — la maquette met « LOGEMENT » sur un
 * conseil dont la pastille dit le sujet plutôt que le type, parce que savoir de
 * quoi parle une story vaut mieux que savoir de quel type elle est. On suit ce
 * choix : `categoryLabel` s'il existe, `typeLabel` sinon.
 */
export function storiesFrom(band: StoryBandResponse): readonly StoryBulle[] {
  return band.items.flatMap((entry) =>
    entry.stories.map((s) => ({
      ...avatar(s.author),
      name: s.author.displayName,
      type: (s.categoryLabel ?? s.typeLabel).toLocaleUpperCase('fr-FR'),
      k: STORY_FILTER_KEY[s.type],
      pillBg: STORY_PILL[s.type],
      /** La légende sous la bulle : le début du texte, comme la maquette. */
      caption: s.placeLabel ?? s.categoryLabel ?? s.typeLabel,
      count: `${s.votes.positive} ${s.votes.positiveLabel.toLocaleLowerCase('fr-FR')}`,
      /** L'ANNEAU (§2.6). Épais vert si non vue, fin gris sinon — jamais de dégradé. */
      seen: s.seen,
      ring: s.seen ? '1.5px solid #CBD5D1' : '3px solid #16785E',
      pad: '3px',
      storyId: s.id,
      /** L'anneau de l'AUTEUR : vert tant qu'une de ses stories n'est pas vue. */
      hasUnseen: entry.hasUnseen,
    })),
  );
}

// ─── La colonne droite (§2.7) ───────────────────────────────────────────────

const MOIS = [
  'JANV',
  'FÉVR',
  'MARS',
  'AVR',
  'MAI',
  'JUIN',
  'JUIL',
  'AOÛT',
  'SEPT',
  'OCT',
  'NOV',
  'DÉC',
] as const;

/**
 * Les trois prochains événements de ma ville.
 *
 * La date est formatée ICI et non reçue formatée, parce que `startsAt` est une
 * instant ISO et que la maquette en dessine le jour et le mois séparément. Le
 * fuseau est celui du NAVIGATEUR : un événement à 19 h à Lyon doit s'afficher
 * 19 h pour un membre à Lyon, et c'est ce que `toLocaleString` sans fuseau fait.
 */
export function eventsFrom(sidebar: FeedSidebarResponse): readonly EvenementCarte[] {
  return sidebar.cityEvents.map((e) => {
    const d = new Date(e.startsAt);
    const heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return {
      d: String(d.getDate()).padStart(2, '0'),
      m: MOIS[d.getMonth()] ?? '',
      t: e.title,
      /** `venueName` est nullable : on n'écrit pas « null · 19h00 ». */
      s: e.venueName === null ? heure : `${e.venueName} · ${heure}`,
      eventId: e.id,
    };
  });
}

/**
 * Les nouveaux arrivants. `canGreet` vient du SERVEUR (§2.7 : « bouton Saluer […]
 * si L1 ») et n'est qu'un affichage : le bouton tente l'envoi, et c'est le serveur
 * qui refuse avec l'invitation à monter de niveau s'il le faut.
 */
export function arrivalsFrom(sidebar: FeedSidebarResponse): readonly PersonneCarte[] {
  return sidebar.newArrivals.items.map((m) => ({
    ...avatar(m),
    name: m.displayName,
    /** La maquette écrit « Arrivé il y a 3 jours ». L'API ne datant pas l'arrivée
     *  dans ce bloc, on dit la PHASE, qui est ce qu'elle renvoie. */
    sub: m.phase === 'RECENT_ARRIVAL' ? 'Vient d’arriver' : 'Nouveau membre',
    handle: m.handle,
  }));
}

/** Les contacts en ligne — `last_seen_at` < 10 min, calculé serveur. */
export function onlineFrom(sidebar: FeedSidebarResponse): readonly PersonneCarte[] {
  return sidebar.onlineContacts.map((m) => ({
    ...avatar(m),
    name: m.isMentor ? `${m.displayName} (Parrain·e)` : m.displayName,
    handle: m.handle,
  }));
}

// ─── Les commentaires (§2.5) ────────────────────────────────────────────────

/**
 * Le fil de commentaires, aplati en une liste avec INDENTATION — c'est la forme
 * que le JSX transcodé attend, la maquette dessinant un décalage de 50 px (44 px
 * sur mobile) pour l'unique niveau de réponse que §2.5 autorise.
 *
 * `likes` est OMIS : aucune réaction de commentaire n'existe, ni en base ni dans
 * aucune réponse. La maquette en dessine un compteur, donc la prise existe — mais
 * la remplir de `0` afficherait un compteur qui ne bougera jamais. Remonté.
 *
 * `canReply` suit la profondeur, pas un droit : on répond à une racine, jamais à
 * une réponse (§2.5, `DEPTH_EXCEEDED` — mesuré 422).
 */
export function threadFrom(items: readonly CommentThread[]): readonly CommentaireLigne[] {
  return items.flatMap((racine) => [
    {
      ...avatar(racine.author),
      name: racine.author.displayName,
      phase: racine.author.cityName === null ? '' : racine.author.cityName,
      author: racine.isAuthor,
      text: racine.body,
      time: racine.relativeTime,
      indent: '0px',
      indentM: '0px',
      canReply: true,
      av: '38px',
      commentId: racine.id,
      canEdit: racine.canEdit,
    },
    ...racine.replies.map((r) => ({
      ...avatar(r.author),
      name: r.author.displayName,
      phase: r.author.cityName === null ? '' : r.author.cityName,
      author: r.isAuthor,
      text: r.body,
      time: r.relativeTime,
      indent: '50px',
      indentM: '44px',
      canReply: false,
      av: '32px',
      commentId: r.id,
      canEdit: r.canEdit,
    })),
  ]);
}
