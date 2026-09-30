/**
 * DE L'API VERS LES PRISES DU JSX TRANSCODÉ — réseaux.
 *
 * Le JSX de `screens/a0{7,8,9},a10/*.generated.tsx` ne bouge pas d'une virgule :
 * il lit `n.name`, `n.i`, `n.bg`, `t.pinned`… c'est-à-dire la FORME que la
 * maquette calcule dans son `renderVals()`. L'API, elle, renvoie
 * `memberCount`, `pinKind`, `author.displayName`. Les deux vocabulaires sont
 * différents et doivent le rester : la maquette est une source de DESSIN, l'API
 * une source de DONNÉE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LA RÈGLE LA PLUS GRAVE DU MODULE, ET CE FICHIER EST L'ENDROIT OÙ ON POURRAIT
 * LA DÉFAIRE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * « Le contenu d'un réseau PUBLIC n'est pas renvoyé à un non-membre, même quand
 * l'en-tête l'est. » Le serveur la tient par deux gardes successives, et il faut
 * savoir laquelle fait quoi :
 *
 *   · `load()` répond 404 sur un réseau `INVITE_ONLY` — son existence même est
 *     un secret ;
 *   · `assertMember()` répond 403 `NOT_A_MEMBER` sur le CONTENU d'un réseau
 *     auquel on n'appartient pas, quelle que soit sa visibilité.
 *
 * Relevé sur le MÊME réseau PUBLIC, à la même seconde, pour un membre puis pour
 * un passant :
 *
 *                        membre              non-membre
 *   GET /communities/:s   200                 200      ← l'en-tête PASSE
 *   myStatus              "ACTIVE"            null
 *   counters.topics       1                   0        ← MASQUÉ, pas vide
 *   pinned                [1 sujet + TITRE]   []       ← MASQUÉ, pas vide
 *   …/topics              200                 403 NOT_A_MEMBER
 *   …/feed                200                 403
 *   …/members             200                 403
 *   …/announcements       200                 403
 *   …/polls               200                 403
 *   …/albums              200                 403
 *   …/map                 200                 403
 *   GET /topics/:id       200                 403      ← la porte de derrière
 *
 * CE QUE CE FICHIER NE FAIT DONC PAS, ET NE DOIT JAMAIS FAIRE :
 *
 *   1. il ne FABRIQUE aucun contenu pour combler un 403. Pas de liste de sujets
 *      vide présentée comme « ce réseau n'a pas encore de sujet » : un refus
 *      n'est pas une absence, et le confondre apprendrait au lecteur que le
 *      réseau est mort alors qu'il est seulement fermé ;
 *   2. il ne DÉDUIT aucun compteur. `counters.topics` à 0 chez un passant est un
 *      zéro MASQUÉ. `communityIsOpen()` ci-dessous existe pour que l'écran sache
 *      qu'il regarde une façade, et non pour l'aider à la remplir ;
 *   3. il ne va PAS chercher les titres des sujets épinglés ailleurs. Il n'y a
 *      pas d'ailleurs — `pinned` est la seule source, et elle est vide pour un
 *      passant. C'est précisément ce que la garde protège.
 *
 * ── CE QUE L'API NE PEUT PAS REMPLIR, ET QU'ON NE FABRIQUE PAS ─────────────
 *
 * La maquette dessine, sur ses cartes de réseau et ses lignes de sujet, quatre
 * affordances dont aucune n'a de source — vérifié route par route, charge par
 * charge :
 *
 *   · `unread` sur « Mes réseaux » — aucun compteur de non-lus n'existe, ni en
 *     base ni dans aucune réponse ;
 *   · `muted` — la colonne `community_members.muted` que §3 annonce « ajoutée »
 *     n'existe pas dans le schéma, qui est figé. Le service le dit lui-même ;
 *   · le compteur de vues d'un sujet — interdit (`00` §49), et `.strict()` le
 *     refuserait à la frontière si on l'ajoutait ;
 *   · l'avatar d'un auteur de sujet — l'auteur n'a que trois champs ici
 *     (`id`, `handle`, `displayName`), sans `avatarUrl`.
 *
 * `unread` et `muted` sont donc posés à `null` et `false` — la maquette les
 * exige sur les quatre entrées pour que `n.muted` reste accessible sur l'union —
 * et ils sont REMONTÉS au rapport de lot. Les remplir d'un nombre inventé
 * mettrait à l'écran une pastille qui ne bougerait jamais.
 *
 * ── LES COULEURS ───────────────────────────────────────────────────────────
 *
 * L'API n'en renvoie aucune, et ne devrait pas : c'est du dessin. On les DÉRIVE
 * d'une clé stable — le `slug` d'un réseau, le `handle` d'un membre — dans la
 * palette de la maquette. Stable importe : une couleur tirée au hasard changerait
 * à chaque rendu, et le même réseau serait de deux couleurs entre « Mes réseaux »
 * et « Découvrir ». Aucune couleur n'est assombrie (T1 §1.2).
 */
import type {
  Announcement,
  CommunityDetailResponse,
  CommunityFeedPost,
  CommunityMember,
  CommunityPublic,
  DiscoverCommunity,
  MyCommunity,
  PinnedTopic,
  Poll,
  TopicListItem,
  TopicReply,
} from '@app/shared';
import { CHAT, PIN, initials, tint } from './chrome';
import type { DiscoverView, MyNetView } from '../a07/data';
import { topicRowTint, type TopicRowView } from '../a08/data';
import type { CommentRowView } from '../a09/data';
import type { InviteeView } from '../a10/data';

// ═══ Ce que la garde impose à l'écran ══════════════════════════════════════

/**
 * Le lecteur est-il DEDANS ?
 *
 * `myStatus === 'ACTIVE'` et rien d'autre : `INVITED` et `PENDING` sont des
 * antichambres, et le serveur leur refuse le contenu exactement comme à un
 * inconnu. Un écran qui lirait `myRole !== null` se tromperait sur un invité.
 *
 * C'est LA question que A08 doit poser avant de dessiner. Tant qu'elle répond
 * non, les compteurs de l'en-tête sont masqués et les sept routes de contenu
 * répondront 403 : il faut montrer l'invitation à rejoindre, pas un réseau vide.
 */
export function communityIsOpen(c: CommunityDetailResponse): boolean {
  return c.myStatus === 'ACTIVE';
}

/**
 * Les compteurs de l'en-tête sont-ils DIGNES DE FOI ?
 *
 * Exactement la même condition, mais nommée à part parce que la confusion qu'on
 * veut éviter est différente : `counters.topics === 0` peut vouloir dire « aucun
 * sujet » ou « je ne vous le dirai pas », et seul `myStatus` distingue les deux.
 * L'écran doit donc écrire « Rejoignez pour voir » et jamais « 0 sujet ».
 */
export const countersAreVisible = communityIsOpen;

// ═══ A07 · mes réseaux et la découverte ════════════════════════════════════

/** Le sous-titre d'une carte : « 1 400 membres », comme la maquette l'écrit. */
function membersLabel(n: number): string {
  return `${n.toLocaleString('fr-FR')} ${n === 1 ? 'membre' : 'membres'}`;
}

/** Le mot de la catégorie affichée en pastille — le KIND, puis la catégorie. */
const KIND_LABEL = { CITY: 'Ville', COUNTRY: 'Pays', INTEREST: 'Intérêt' } as const;

/**
 * Une entrée de « Mes réseaux ».
 *
 * `unread` et `muted` sont OMIS de l'API et posés ici à `null` / `false` : voir
 * l'en-tête. Ils sont écrits sur toutes les entrées, y compris les valeurs
 * neutres, parce que quatre formes d'objet différentes rendraient `n.muted`
 * inaccessible sur l'union — c'est la note que la maquette porte elle-même.
 */
export function myNetFrom(c: MyCommunity): MyNetView {
  return {
    i: initials(c.name),
    name: c.name,
    bg: tint(c.slug),
    members: membersLabel(c.memberCount),
    unread: null,
    muted: false,
  };
}

export function myNetsFrom(items: readonly MyCommunity[]): readonly MyNetView[] {
  return items.map(myNetFrom);
}

/**
 * Une carte de « Découvrir ».
 *
 * LE BOUTON DIT LA VISIBILITÉ, et sa couleur porte l'information : « Rejoindre »
 * sur fond vert pour un réseau `PUBLIC`, « Demander » sur fond clair pour un
 * `ON_REQUEST`. La maquette fait cette différence, et elle n'est pas décorative —
 * les deux n'aboutissent pas au même état (`ACTIVE` contre `PENDING`).
 *
 * `INVITE_ONLY` n'apparaît jamais ici : le service l'exclut du `WHERE` de la
 * découverte (`visibility: { not: 'INVITE_ONLY' }`). On ne prévoit donc pas de
 * troisième bouton pour un cas que la route ne rend pas — et s'il arrivait, ce
 * serait une fuite à remonter, pas un libellé à ajouter.
 *
 * `joined` fait retomber le bouton sur « Ouvrir » : proposer « Rejoindre » un
 * réseau déjà rejoint enverrait un appel idempotent qui ne changerait rien, et
 * l'écran mentirait sur l'état.
 */
export function discoverFrom(c: DiscoverCommunity): DiscoverView {
  const demande = c.visibility === 'ON_REQUEST';
  return {
    name: c.name,
    cat: KIND_LABEL[c.kind],
    /** `description` est NULLABLE — les réseaux de ville et de pays n'en ont pas. */
    desc: c.description ?? '',
    members: membersLabel(c.memberCount),
    cta: c.joined ? 'Ouvrir' : demande ? 'Demander' : 'Rejoindre',
    cover: tint(c.slug),
    btnBg: c.joined || demande ? '#F2F5F4' : '#16785E',
    btnFg: c.joined || demande ? '#0F5C48' : '#fff',
    slug: c.slug,
    joined: c.joined,
  };
}

export function discoversFrom(items: readonly DiscoverCommunity[]): readonly DiscoverView[] {
  return items.map(discoverFrom);
}

// ═══ A08 · les sujets du réseau ════════════════════════════════════════════

/**
 * Les états qu'un sujet affiche, tels que la maquette les nomme.
 *
 * ILS SONT TROIS, ET NON QUATRE. `TopicStatus` vaut `OPEN | RESOLVED |
 * ARCHIVED` — il n'existe AUCUN état « clos » en base, alors que la maquette
 * dessine une action « Clore le sujet » et que le service annonce en commentaire
 * qu'« un modérateur clôt ». La table s'arrête donc à ce que l'enum offre ;
 * inventer une quatrième clé ferait compiler un état que l'API refuserait.
 * Remonté.
 */
const TOPIC_STATE = {
  OPEN: 'Ouvert',
  RESOLVED: 'Résolu',
  ARCHIVED: 'Archivé',
} as const;

/**
 * « il y a 2 h », comme la maquette l'écrit.
 *
 * Composé ICI et non reçu composé : contrairement au fil, `GET /…/topics` ne
 * renvoie AUCUN libellé relatif — ni `relativeTime` ni rien d'approchant. C'est
 * un écart avec le fil global, où le serveur compose tout ; il est remonté.
 *
 * Le fuseau est celui du NAVIGATEUR, ce qui est le bon choix pour une durée
 * écoulée : elle ne dépend d'aucun fuseau.
 */
function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  return j === 1 ? 'hier' : `il y a ${j} j`;
}

/**
 * Une ligne de sujet.
 *
 * `pinned` change le fond de la ligne ET la couleur de son icône — deux marques,
 * pas une, parce qu'un fond très clair seul ne se voit pas à contraste réduit.
 * C'est la maquette qui l'impose, et on la suit.
 *
 * `last` dit le dernier message quand il y en a un, et retombe sur l'auteur et
 * l'ouverture sinon : `lastReplyAt` est `null` tant que personne n'a répondu, et
 * l'écrire quand même donnerait « Dernier message il y a … » sur un sujet sans
 * aucune réponse.
 */
export function topicRowFrom(t: TopicListItem): TopicRowView {
  const epingle = t.pinKind !== 'NONE';
  const auteur = t.author.displayName === '' ? `@${t.author.handle}` : t.author.displayName;
  const state = TOPIC_STATE[t.status];
  return {
    title: t.title,
    last:
      t.lastReplyAt === null
        ? `Ouvert ${ago(t.createdAt)} · ${auteur}`
        : `Dernier message ${ago(t.lastReplyAt)} · ${auteur}`,
    state,
    n: t.replyCount,
    icon: epingle ? PIN : CHAT,
    pinned: epingle,
    ...topicRowTint(epingle, state),
    topicId: t.id,
  };
}

export function topicRowsFrom(items: readonly TopicListItem[]): readonly TopicRowView[] {
  return items.map(topicRowFrom);
}

/**
 * Les sujets ÉPINGLÉS, pour la tête de liste.
 *
 * Ils arrivent dans `meta.pinned` ET dans `items` — mesuré : le sujet épinglé
 * figure aux deux endroits. Un écran qui dessinerait les deux listes à la suite
 * afficherait donc deux fois le même sujet. `withoutPinned` ci-dessous existe
 * pour cela.
 */
export function pinnedRowsFrom(pinned: readonly PinnedTopic[]): readonly TopicRowView[] {
  return pinned.map((p) => {
    const state = TOPIC_STATE[p.status];
    return {
      title: p.title,
      last: 'Épinglé par les modérateurs',
      state,
      n: p.replyCount,
      icon: PIN,
      pinned: true,
      ...topicRowTint(true, state),
      topicId: p.id,
    };
  });
}

/** Retire des `items` ceux qui sont déjà dessinés en tête comme épinglés. */
export function withoutPinned(
  rows: readonly TopicRowView[],
  pinned: readonly PinnedTopic[],
): readonly TopicRowView[] {
  const deja = new Set(pinned.map((p) => p.id));
  return rows.filter((r) => !deja.has(r.topicId));
}

// ═══ A09 · un sujet et ses réponses ════════════════════════════════════════

/**
 * Le fil de réponses, aplati avec INDENTATION — c'est la forme que le JSX
 * transcodé attend, la maquette dessinant un décalage de 48 px (34 px sur
 * mobile) pour l'unique niveau de réponse autorisé.
 *
 * Le service renvoie les réponses À PLAT, dans l'ordre de création, avec
 * `parentCommentId` : l'imbrication se lit donc de ce champ, elle n'est pas
 * donnée. `canReply` suit la profondeur et non un droit — on répond à une
 * racine, jamais à une réponse (`DEPTH_EXCEEDED`).
 *
 * `guide` est posé à `null` : la maquette dessine la prise d'un guide lié sous
 * une réponse, mais aucune réponse de sujet ne porte de guide dans aucune
 * charge. Remonté plutôt que rempli.
 */
export function repliesFrom(replies: readonly TopicReply[]): readonly CommentRowView[] {
  return replies.map((r) => {
    const enfant = r.parentCommentId !== null;
    const nom = r.author.displayName === '' ? `@${r.author.handle}` : r.author.displayName;
    return {
      i: initials(nom),
      bg: tint(r.author.handle),
      name: nom,
      text: r.body,
      time: ago(r.createdAt),
      indent: enfant ? '48px' : '0px',
      indentM: enfant ? '34px' : '0px',
      canReply: !enfant,
      guide: null,
      commentId: r.id,
    };
  });
}

// ═══ A10 · les invités ═════════════════════════════════════════════════════

/**
 * Une ligne de la liste d'invitation.
 *
 * `sub` dit la PHASE et la ville, parce que c'est ce que la liste des membres
 * renvoie — la maquette écrit « Installée · Lyon 3e », et l'API ne descend pas
 * à l'arrondissement. On dit ce qu'on sait, pas ce que la maquette a dessiné.
 */
const PHASE_LABEL: Record<string, string> = {
  PRE_DEPARTURE: 'Avant le départ',
  RECENT_ARRIVAL: 'Vient d’arriver',
  SETTLING: 'En installation',
  SETTLED: 'Installé·e',
  RETURNED: 'Reparti·e',
};

export function inviteeFrom(m: CommunityMember, invited: boolean): InviteeView {
  const nom = m.displayName === '' ? `@${m.handle}` : m.displayName;
  const phase = PHASE_LABEL[m.phase] ?? m.phase;
  return {
    i: initials(nom),
    name: nom,
    sub: m.city === null ? phase : `${phase} · ${m.city.name}`,
    bg: tint(m.handle),
    invited,
    btn: invited ? 'Invité·e' : 'Inviter',
    btnBg: invited ? '#E3F0EB' : '#16785E',
    btnFg: invited ? '#0F5C48' : '#fff',
    handle: m.handle,
  };
}

// ═══ Formes secondaires, pour les onglets que la maquette laisse statiques ══

/**
 * Ces trois convertisseurs existent et ne sont branchés sur AUCUN cadre.
 *
 * Les douze planches A08T — Fil, Événements, Membres, Album, À propos et leurs
 * variantes propriétaire — ne consomment AUCUNE donnée : le générateur leur
 * écrit `_props`, parce que la maquette les dessine entièrement en dur. Les
 * brancher demanderait de REDESSINER ces planches, ce qui est interdit.
 *
 * Ils sont donc écrits, éprouvés par les charges relevées, et laissés prêts pour
 * le lot qui transcodera ces planches en cadres à prises. Les supprimer
 * obligerait à refaire le travail de mesure ; les brancher obligerait à réécrire
 * la maquette. On documente, et on remonte.
 */
export function feedPostFrom(p: CommunityFeedPost) {
  return {
    name: p.author.displayName === '' ? `@${p.author.handle}` : p.author.displayName,
    i: initials(p.author.displayName === '' ? p.author.handle : p.author.displayName),
    bg: tint(p.author.handle),
    body: p.body,
    time: ago(p.createdAt),
    /**
     * AUCUN LIBELLÉ N'EST COMPOSÉ ICI. Le fil du réseau ne renvoie ni
     * `typeLabel`, ni `counter.word`, ni `reaction.actionLabel` — contrairement
     * au fil global. Déduire « Félicitations » de `type === 'VICTORY'` créerait
     * une SECONDE table de vocabulaire, et deux tables divergent toujours. On
     * expose donc le `type` brut, et l'écart est remonté au back.
     */
    type: p.type,
    n: p.reactionCount,
    comments: p.commentCount,
    postId: p.id,
  };
}

export function memberRowFrom(m: CommunityMember) {
  const nom = m.displayName === '' ? `@${m.handle}` : m.displayName;
  return {
    i: initials(nom),
    name: nom,
    bg: tint(m.handle),
    sub: m.city === null ? (PHASE_LABEL[m.phase] ?? m.phase) : m.city.name,
    role: m.role,
    userId: m.userId,
  };
}

export function announcementFrom(a: Announcement) {
  const nom = a.author.displayName === '' ? `@${a.author.handle}` : a.author.displayName;
  return { i: initials(nom), name: nom, bg: tint(a.author.handle), text: a.body, time: ago(a.createdAt) };
}

/**
 * Un sondage.
 *
 * `voteCount` et `totalVotes` valent `null` TANT QUE LES RÉSULTATS SONT CACHÉS —
 * ils ne valent pas zéro. On ne écrit donc JAMAIS `?? 0` : « résultats visibles
 * après vote ou clôture » est une règle, et le serveur retire les compteurs de
 * la réponse plutôt que de demander au front de ne pas les afficher. Un `?? 0`
 * transformerait une information retirée en une information fausse.
 */
export function pollFrom(p: Poll) {
  return {
    question: p.question,
    closed: p.closed,
    revealed: p.resultsVisible,
    total: p.totalVotes,
    options: p.options.map((o) => ({ id: o.id, label: o.label, count: o.voteCount })),
    mine: p.myOptionIds,
    pollId: p.id,
  };
}

/** Le nom d'un réseau, en pastille — employé par l'en-tête de A08. */
export function communityBadge(c: CommunityPublic): { readonly i: string; readonly bg: string } {
  return { i: initials(c.name), bg: tint(c.slug) };
}
