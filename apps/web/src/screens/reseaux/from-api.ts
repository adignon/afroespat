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
 *   · le compteur de vues d'un sujet — interdit (`00` §49), et `.strict()` le
 *     refuserait à la frontière si on l'ajoutait ;
 *   · l'avatar d'un auteur de sujet — l'auteur n'a que trois champs ici
 *     (`id`, `handle`, `displayName`), sans `avatarUrl`.
 *
 * `unread` est donc posé à `null` — la maquette l'exige sur les quatre entrées
 * pour que la prise reste accessible sur l'union — et il est REMONTÉ au rapport
 * de lot. Le remplir d'un nombre inventé mettrait à l'écran une pastille qui ne
 * bougerait jamais.
 *
 * ⚠ `muted` ÉTAIT DANS CETTE LISTE, ET IL N'Y EST PLUS. Il y figurait à juste
 * titre : la colonne `community_members.muted` que §3 annonce « ajoutée »
 * n'était pas dans le schéma. Elle y est depuis la migration
 * `reseaux_sourdine_inviteur_avertissement`, `myCommunitySchema` porte le champ,
 * et `myNetFrom` le LIT — la pastille « En sourdine » de A07 dit donc la vérité.
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
  Album,
  Announcement,
  CommunityDetailResponse,
  EventCardResponse,
  CommunityReport,
  CommunityFeedPost,
  CommunityMember,
  CommunityPublic,
  DiscoverCommunity,
  MyCommunity,
  PinnedTopic,
  Poll,
  PostCard,
  TopicDetailResponse,
  TopicListItem,
  TopicReply,
} from '@app/shared';
import { CHAT, PIN, initials, tint } from './chrome';
import type { DiscoverView, MyNetView } from '../a07/data';
import { topicRowTint, type TopicRowView } from '../a08/data';
import type { CommentRowView, SujetTeteView } from '../a09/data';
import type { InviteeView } from '../a10/data';
import {
  APPARTENANCE,
  GENRE,
  ROLE,
  VISIBILITE,
  type AlbumPastilleView,
  type AlbumVignetteView,
  type DemandeRowView,
  type EvenementReseauView,
  type PhotoAlbumView,
  type MembreAdminRowView,
  type SignalementRowView,
  type ReseauEnteteView,
} from '../a08t/data';
/**
 * LES FORMATEURS DE DATE ET LA TABLE DES TYPES, EMPRUNTÉS À L'AGENDA.
 *
 * `screens/agenda/data.ts` est le module de l'écran d'ORIGINE de cette donnée :
 * `GET /events` nourrit E01 depuis le premier jour, et `TYPES_FR` y porte déjà
 * l'écart signalé au porteur sur les huit valeurs de `EventType`. Recopier ici
 * une seconde table de libellés, ou un second formateur de mois, ferait deux
 * sources pour la même phrase — et la seule chose dont on est sûr, c'est qu'un
 * jour les deux divergeront.
 */
import { abbrMois, numeroJour, pluriel, TYPES_FR } from '../agenda/data';

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
 * L'adresse d'un réseau, composée EN UN SEUL ENDROIT.
 *
 * `/reseaux/:slug` est la route de A08 (`app/(app)/reseaux/[slug]`). Elle est
 * écrite ici et non dans les cadres : un cadre transcodé ne calcule rien, et
 * deux copies de la même route divergent au premier renommage. `slug` vient du
 * serveur et est déjà sûr pour une URL, mais on l'échappe quand même — c'est la
 * même discipline que `api.ts` applique à ses chemins.
 */
const hrefReseau = (slug: string): string => `/reseaux/${encodeURIComponent(slug)}`;

/**
 * Une entrée de « Mes réseaux ».
 *
 * `unread` est OMIS de l'API et posé ici à `null` : voir l'en-tête. Il est écrit
 * sur toutes les entrées, y compris la valeur neutre, parce que quatre formes
 * d'objet différentes rendraient la prise inaccessible sur l'union — c'est la
 * note que la maquette porte elle-même.
 *
 * `muted` VIENT MAINTENANT DU SERVEUR (§2.5, `myCommunitySchema.muted`). Il était
 * posé à `false` en dur, ce qui donnait une pastille « En sourdine » que RIEN ne
 * pouvait allumer : un membre qui mettait un réseau en sourdine ne pouvait plus
 * savoir lequel. §2.5 dit « le réseau reste dans sa liste » — c'est donc dans la
 * liste qu'il faut pouvoir lire qu'il est silencieux.
 */
export function myNetFrom(c: MyCommunity): MyNetView {
  return {
    i: initials(c.name),
    name: c.name,
    bg: tint(c.slug),
    members: membersLabel(c.memberCount),
    unread: null,
    muted: c.muted,
    href: hrefReseau(c.slug),
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
    href: hrefReseau(c.slug),
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

/**
 * LA TÊTE D'UN SUJET — titre, corps, auteur, état, fil d'Ariane.
 *
 * Elle n'existait pas : `A09Data` ne portait que `comments`, et tout le haut de
 * la page était un littéral du transcodage. Voir `a09/data.ts` pour ce qui était
 * mesuré à l'écran, et pour les deux morceaux que la maquette dessine sans que
 * l'API les porte (la phase et la ville de l'auteur).
 *
 * `etatBg` / `etatFg` viennent de `topicRowTint`, la MÊME table que les lignes de
 * sujets de A08 : le même `status` ne peut pas prendre deux couleurs selon
 * l'écran qui le montre.
 *
 * `reseauHref` emploie le SLUG que le serveur renvoie dans `community`, et non
 * celui de l'URL : les deux coïncident presque toujours, mais la route accepte
 * aussi un identifiant (voir l'en-tête d'`api.ts`), et le fil d'Ariane doit
 * mener à l'adresse canonique.
 */
export function sujetTeteFrom(t: TopicDetailResponse): SujetTeteView {
  const nom = t.author.displayName === '' ? `@${t.author.handle}` : t.author.displayName;
  const etat = TOPIC_STATE[t.status];
  const teinte = topicRowTint(t.pinKind !== 'NONE', etat);
  return {
    titre: t.title,
    corps: t.body,
    etat,
    etatBg: teinte.stBg,
    etatFg: teinte.stFg,
    epingle: t.pinKind !== 'NONE',
    auteurI: initials(nom),
    auteurNom: nom,
    auteurBg: tint(t.author.handle),
    auteurQuand: ago(t.createdAt),
    reseauNom: t.community.name,
    reseauHref: `/reseaux/${t.community.slug}`,
  };
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
 * variantes propriétaire — lisent MAINTENANT une prise, et une seule : `reseau`,
 * l'en-tête du réseau que les vingt-et-une planches répètent. Ce commentaire
 * affirmait qu'elles ne consommaient RIEN et que le générateur leur écrivait
 * `_props` ; c'était vrai avant le branchement, et les cadres destructurent
 * aujourd'hui `const { reseau }`.
 *
 * Ce qui reste vrai, et c'est ce qui compte ici : le CORPS de ces planches — les
 * publications du fil, les cartes d'événement, la grille de l'album — est dessiné
 * en dur. Les brancher demanderait de REDESSINER ces planches, ce qui est
 * interdit.
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

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ ⚠ CE CONVERTISSEUR N'EST BRANCHÉ SUR AUCUN CADRE — C'EST                   ║
 * ║   `membreAdminRowFrom` QUI SERT LES QUATRE PLANCHES « MEMBRES »            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Son en-tête disait « et ce convertisseur est enfin branché ». COMPTÉ :
 * `memberRowFrom` figure UNE fois dans tout le dépôt — ici, à sa déclaration.
 * Aucun cadre, aucun crochet, aucun test ne l'appelle. Le lot qui l'a écrit a
 * finalement branché les lignes de membres par `membreAdminRowFrom`, juste en
 * dessous, et l'en-tête a survécu à la décision qu'il décrivait — ce que le
 * mémo §2 nomme « un piège pour le prochain lecteur ».
 *
 * IL EST GARDÉ, PAS SUPPRIMÉ, et c'est un choix mesuré : il porte DEUX choses
 * que `membreAdminRowFrom` n'a pas, et les deux correspondent à du dessin réel.
 *
 *   · `subM` — « Lyon 7e » seul, le sous-titre que la planche de 390 px écrit
 *     là où celle de 1 036 px écrit « Installée · Lyon 7e ». ⚠ ÉCART ASSUMÉ ET
 *     REMONTÉ : les quatre cadres lisent aujourd'hui `sub`, donc le téléphone
 *     affiche la forme longue. Un champ de plus sur `MembreAdminRowView` et une
 *     liaison de plus sur les deux cadres mobiles le corrigeraient ;
 *   · `profil` — `/@handle`, l'adresse que `NOM_VERS_PROFIL` transforme en lien
 *     dès que le nom cesse d'être un littéral. Aucune des quatre planches
 *     « Membres » ne le fait encore : les noms y sont du texte, pas des liens.
 *     REMONTÉ — c'est la demande du porteur « partout où le nom est affiché ».
 *
 * Qui branche l'un des deux : relever le champ sur `MembreAdminRowView` plutôt
 * que d'appeler ce convertisseur-ci, sinon la liste aura DEUX formes.
 */
export function memberRowFrom(m: CommunityMember) {
  const nom = m.displayName === '' ? `@${m.handle}` : m.displayName;
  const phase = PHASE_LABEL[m.phase] ?? m.phase;
  return {
    userId: m.userId,
    /**
     * `NOM_VERS_PROFIL` change le nom ET l'avatar d'une ligne en liens dès qu'ils
     * cessent d'être des littéraux — c'est la demande du porteur, « partout où le
     * nom est affiché ». Le cadre produit lit donc `m.profil`, et `/@handle` est
     * l'adresse que tout le dépôt emploie pour un profil public.
     */
    profil: `/@${m.handle}`,
    i: initials(nom),
    name: nom,
    bg: tint(m.handle),
    sub: m.city === null ? phase : `${phase} · ${m.city.name}`,
    subM: m.city === null ? phase : m.city.name,
    proprietaire: m.role === 'OWNER',
    moderateur: m.role === 'MODERATOR',
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

// ═══ A08T · l'en-tête que les vingt-cinq planches d'onglet lisent ══════════

/**
 * L'en-tête du réseau, pour les vingt-cinq planches d'onglet de A08T.
 *
 * ── `memberCount` ET NON `counters.members` ────────────────────────────────
 *
 * C'est la seule décision de cette fonction, et c'est la règle la plus grave du
 * module. `counters` arrive MASQUÉ à qui n'est pas membre ACTIF — relevé sur le
 * même réseau PUBLIC à la même seconde : `counters.topics` vaut 1 pour un membre
 * et 0 pour un passant. `memberCount`, lui, est dans `communityPublicSchema` :
 * il est rendu à tout le monde et il est vrai. Lire `counters.members`
 * afficherait « 0 membre » sur un réseau de 890 personnes dès qu'on le regarde
 * de l'extérieur — un zéro masqué présenté comme un compte.
 *
 * ── LES DEUX COMPTEURS QUE LE BACK NE TOTALISE PAS ────────────────────────
 *
 * `moderateurs` et `demandes` arrivent en argument, et non d'un champ de `c` :
 * `communityDetailResponseSchema` ne les porte pas, et la route des membres est
 * un `pageSchema` SANS `meta` — aucun total. L'appelant les compte sur la
 * première page et ne les passe que si elle est ENTIÈRE (`nextCursor === null`).
 * Zéro veut donc dire « aucun, ou inconnu », et c'est ce que le dialecte attend :
 * la pastille disparaît plutôt que d'afficher un nombre faux. REMONTÉ.
 */
/**
 * LA LIGNE DE RÉSUMÉ DE A08, séparateurs compris.
 *
 * Elle ne joint que les morceaux PRÉSENTS, et c'est tout l'intérêt d'en faire
 * une seule prise. A08 est le seul écran du module qu'un passant peut ouvrir :
 * `myRole` y est nul, donc l'appartenance est inconnue. Avec trois
 * interpolations — la forme employée sur les planches A08T, où l'on n'arrive
 * qu'en étant membre — l'écran d'un passant aurait montré
 * « 99 membres · réseau de pays · » avec un séparateur en l'air.
 *
 * Les « · » sont du DESSIN dans le cadre transcodé ; la seule façon de les faire
 * dépendre de la donnée est de leur faire traverser la donnée. C'est ce que fait
 * cette fonction, et c'est un défaut vu À L'ÉCRAN, pas déduit du code.
 */
function resumeReseau(c: CommunityDetailResponse): string {
  const role = c.myRole;
  return [membersLabel(c.memberCount), GENRE[c.kind], role === null ? null : APPARTENANCE[role]]
    .filter((m): m is string => m !== null && m !== '')
    .join(' \u00b7 ');
}

/**
 * LA MÊME LIGNE SANS LE GENRE — la planche de 390 px de A08, et elle seule.
 *
 * Elle dessine « 890 membres \u00b7 vous \u00eates membre » : DEUX morceaux, l\u2019appartenance
 * tout de suite apr\u00e8s le compte, sans « r\u00e9seau de pays » entre les deux. Ce n\u2019est
 * pas un raccourci qu\u2019on s\u2019autorise \u2014 c\u2019est ce que la maquette \u00e9crit, et lui servir
 * `resume` y ajouterait un mot qu\u2019elle ne porte pas.
 *
 * Le filtre est le m\u00eame que celui de `resumeReseau`, pour la m\u00eame raison : un
 * passant n\u2019a pas d\u2019appartenance, et le s\u00e9parateur ne doit pas rester seul en
 * bout de ligne.
 */
function resumeCourtReseau(c: CommunityDetailResponse): string {
  const role = c.myRole;
  return [membersLabel(c.memberCount), role === null ? null : APPARTENANCE[role]]
    .filter((m): m is string => m !== null && m !== '')
    .join(' \u00b7 ');
}

/**
 * La même ligne, en vue PROPRIÉTAIRE.
 *
 * `moderateurs` à zéro veut dire « aucun, OU inconnu » — la route des membres est
 * un `pageSchema` SANS `meta`, donc on ne compte que lorsque la première page est
 * entière. Les deux cas se lisent pareil dans une phrase, et « vous gérez ce
 * réseau avec 0 modérateurs » est alors une affirmation fausse. On n'écrit donc
 * la clause que lorsqu'elle est connue, et on s'arrête avant sinon.
 *
 * Mesuré à l'écran, pas déduit : `/reseaux/pays-bj?onglet=gerer` l'affichait.
 */
function resumeProprietaireReseau(c: CommunityDetailResponse, moderateurs: number): string {
  const base = `${membersLabel(c.memberCount)} · ${GENRE[c.kind]}`;
  if (moderateurs <= 0) return base;
  const mot = moderateurs === 1 ? 'modérateur' : 'modérateurs';
  return `${base} · vous gérez ce réseau avec ${moderateurs} ${mot}`;
}

export function enteteReseauFrom(
  c: CommunityDetailResponse,
  compteurs: { readonly moderateurs: number; readonly demandes: number } = {
    moderateurs: 0,
    demandes: 0,
  },
): ReseauEnteteView {
  const role = c.myRole;
  return {
    nom: c.name,
    initiales: initials(c.name),
    membres: membersLabel(c.memberCount),
    membresNombre: c.memberCount.toLocaleString('fr-FR'),
    genre: GENRE[c.kind],
    genreCourt: KIND_LABEL[c.kind],
    /**
     * L'ANNÉE VIENT DE LA CHAÎNE ISO DU SERVEUR, jamais d'un `new Date()`.
     *
     * `createdAt` est `z.string().datetime()` — « 2023-04-12T09:31:00.000Z » — et
     * ses quatre premiers caractères SONT l'année en UTC. La passer par `Date`
     * la rendrait dans le fuseau du navigateur, ce qui décale d'un an toute
     * création faite le 31 décembre en soirée. C'est le même principe que
     * `active` et `appealable` sur K09 : on affiche ce que le serveur dit.
     */
    creeEn: c.createdAt.slice(0, 4),
    resume: resumeReseau(c),
    resumeCourt: resumeCourtReseau(c),
    resumeProprietaire: resumeProprietaireReseau(c, compteurs.moderateurs),
    monAppartenance: role === null ? '' : APPARTENANCE[role],
    monRole: role === null ? '' : ROLE[role],
    visibilite: VISIBILITE[c.visibility],
    /** NULLABLE côté serveur : les réseaux automatiques de ville et de pays n'en ont pas. */
    description: c.description ?? '',
    /** Compté sur le texte même : `Array.from` pour ne pas couper un caractère combiné en deux. */
    descriptionLongueur: Array.from(c.description ?? '').length,
    moderateurs: compteurs.moderateurs,
    demandes: compteurs.demandes,
  };
}

// ═══ LA GESTION ET LA MODÉRATION DU RÉSEAU (A08T, vue propriétaire) ════════

/**
 * Une DEMANDE D'ADHÉSION, telle que la planche « Gérer » la dessine.
 *
 * La source est `GET /communities/:id/members?pending=true`, c'est-à-dire des
 * `communityMemberSchema` ordinaires : neuf champs, et PAS un de plus. La FORME
 * est déclarée dans `a08t/data.ts`, avec la note sur le champ que l'API ne
 * porte pas — et là plutôt qu'ici pour ne pas rendre réciproque le cycle de
 * modules que ce fichier a déjà vers celui-là.
 *
 * `sub` reprend la forme que la planche dessine (« Prépare son départ ·
 * Cotonou ») : phase, puis ville. Les mots de phase viennent de `PHASE_LABEL`,
 * la table déjà employée par `inviteeFrom` — une seconde table divergerait au
 * premier ajout d'enum.
 */
export function demandeRowFrom(m: CommunityMember): DemandeRowView {
  const nom = m.displayName === '' ? `@${m.handle}` : m.displayName;
  const phase = PHASE_LABEL[m.phase] ?? m.phase;
  return {
    userId: m.userId,
    i: initials(nom),
    bg: tint(m.handle),
    name: nom,
    sub: m.city === null ? phase : `${phase} · ${m.city.name}`,
    mot: '',
  };
}

/**
 * Une LIGNE DE MEMBRE de l'onglet « Membres » — LES QUATRE PLANCHES.
 *
 * ⚠ IL DISAIT « de la planche « Membres — propriétaire » », et ce n'est plus
 * vrai : depuis ce lot, les deux planches de la vue MEMBRE lisent la même liste,
 * par la même fonction. Elles peignaient leurs cinq et quatre lignes en dur.
 *
 * Trois des cinq lignes dessinées portent une pastille de rôle et deux n'en
 * portent pas : c'est `role` qui en décide, et non le rang dans la liste. Les
 * deux couleurs de pastille sont relevées À L'IDENTIQUE sur la planche —
 * `#0F5C48` sur encre blanche pour « Propriétaire », `#E3F0EB` / `#0F5C48` pour
 * « Modérateur ». Aucune n'est assombrie, et aucune n'est inventée : un
 * `MEMBER` n'a pas de pastille, exactement comme les lignes 4 et 5 du dessin.
 *
 * Ses deux drapeaux — `nommable`, et le vide de `roleNom` — sont documentés avec
 * la forme, dans `a08t/data.ts`.
 */
const ROLE_PASTILLE = {
  OWNER: { nom: 'Propriétaire', bg: '#0F5C48', fg: '#fff' },
  MODERATOR: { nom: 'Modérateur', bg: '#E3F0EB', fg: '#0F5C48' },
  MEMBER: { nom: '', bg: 'transparent', fg: 'inherit' },
} as const;

export function membreAdminRowFrom(m: CommunityMember): MembreAdminRowView {
  const nom = m.displayName === '' ? `@${m.handle}` : m.displayName;
  const pastille = ROLE_PASTILLE[m.role];
  const phase = PHASE_LABEL[m.phase] ?? m.phase;
  return {
    userId: m.userId,
    /**
     * LE PSEUDO VOYAGE AVEC LA LIGNE, parce que « Écrire » en a besoin et que
     * `userId` ne le donne pas : `POST /conversations/direct` prend `toHandle`.
     * Le chercher plus tard demanderait un appel de plus par ligne — la route
     * des membres le rend déjà.
     */
    handle: m.handle,
    i: initials(nom),
    bg: tint(m.handle),
    name: nom,
    /**
     * LA FORME LONGUE, « phase · ville », qui est celle de la planche
     * d'ordinateur (« Installée · Lyon 7e »). Celle de 390 px n'écrit que la
     * ville ; un seul champ ne peut pas porter les deux formes, et c'est la
     * planche d'ordinateur qui porte la liste entière. L'API ne descend de
     * toute façon pas à l'arrondissement — on dit ce qu'on sait.
     */
    sub: m.city === null ? phase : `${phase} · ${m.city.name}`,
    roleNom: pastille.nom,
    roleBg: pastille.bg,
    roleFg: pastille.fg,
    nommable: m.role === 'MEMBER',
  };
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ UNE RANGÉE DE LA CARTE « SIGNALEMENTS » — ET SES DEUX PHRASES COMPOSÉES    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La planche écrit, sur deux lignes :
 *
 *     Publication de Joël K. · « Vends attestation d’hébergement »
 *     Demande d’argent · 5 signalements · transmis à la modération de la plateforme
 *
 * Les deux sont COMPOSÉES ICI, séparateurs compris, et pour la raison déjà
 * établie par `resume` sur A08 : les points médians sont du DESSIN, et un
 * morceau manquant les laisserait orphelins. Ici cela arrive vraiment — un
 * contenu dont l'auteur a supprimé son compte n'a plus de nom (`author` est
 * nullable côté serveur), et un contenu non escaladé n'a pas de troisième
 * morceau. On joint donc ce qui existe.
 *
 * ── LE GENRE EN MOT, ET POURQUOI CE SONT CES TROIS MOTS ───────────────────
 *
 * « Publication », « Commentaire », « Sujet ». Les deux premiers sont ceux que
 * la planche écrit elle-même (« Publication de Joël K. », « Commentaire de Paul
 * A. ») ; le troisième suit la même grammaire et c'est le mot que tout le module
 * emploie pour un `topic`. Aucun mot nouveau n'est inventé.
 *
 * ── LE MOTIF VIENT DU SERVEUR EN `enum`, ET LA TABLE EST ICI ──────────────
 *
 * `ReportReason` porte des symboles (`MONEY_REQUEST`), la planche écrit des mots
 * (« Demande d'argent »). La table est côté écran parce que c'est du LIBELLÉ, et
 * `00` §5 le dit : « le back ne fabrique pas de texte ». Un motif inconnu
 * retombe sur son symbole plutôt que sur une chaîne vide — mieux vaut
 * « HARASSMENT » affiché que rien du tout, et cela se voit tout de suite.
 */
const MOTIF_LABEL: Record<string, string> = {
  SCAM: 'Arnaque',
  MONEY_REQUEST: 'Demande d’argent',
  HARASSMENT: 'Harcèlement',
  SPAM: 'Indésirable',
  INAPPROPRIATE: 'Contenu inapproprié',
  SELF_HARM: 'Mise en danger',
  OTHER: 'Autre',
};

const GENRE_SIGNALE: Record<'POST' | 'COMMENT' | 'TOPIC', string> = {
  POST: 'Publication',
  COMMENT: 'Commentaire',
  TOPIC: 'Sujet',
};

/**
 * Le NOM ABRÉGÉ que la planche écrit : « Joël K. », « Paul A. ».
 *
 * Relevé sur la maquette, pas inventé : les deux rangées de la carte écrivent le
 * prénom suivi de l'initiale du nom. Un nom d'un seul mot reste tel quel, et un
 * nom affiché vide retombe sur le handle — c'est la même règle que
 * `demandeRowFrom` et `membreAdminRowFrom` appliquent déjà.
 */
function nomAbrege(handle: string, displayName: string): string {
  const nom = displayName.trim();
  if (nom === '') return `@${handle}`;
  const mots = nom.split(/\s+/);
  const premier = mots[0] ?? nom;
  const suivant = mots[1];
  return suivant === undefined ? premier : `${premier} ${suivant.slice(0, 1)}.`;
}

export function signalementRowFrom(r: CommunityReport): SignalementRowView {
  const genre = GENRE_SIGNALE[r.subjectType];
  const auteur = r.author === null ? null : nomAbrege(r.author.handle, r.author.displayName);
  const extrait = r.extrait.trim();

  const titre = [
    auteur === null ? genre : `${genre} de ${auteur}`,
    extrait === '' ? null : `« ${extrait} »`,
  ]
    .filter((m): m is string => m !== null)
    .join(' · ');

  const sous = [
    MOTIF_LABEL[r.reason] ?? r.reason,
    `${r.count} signalement${r.count > 1 ? 's' : ''}`,
    r.escalated ? 'transmis à la modération de la plateforme' : null,
    r.hidden ? 'déjà masqué' : null,
  ]
    .filter((m): m is string => m !== null)
    .join(' · ');

  return {
    subjectType: r.subjectType,
    subjectId: r.subjectId,
    titre,
    sous,
    /**
     * ⚠ SEUL UN SUJET A UNE PAGE. Vérifié sur l'arborescence de `app/(app)` : il
     * existe `/reseaux/[slug]/sujets/[id]`, et AUCUNE page de publication ni de
     * commentaire dans tout le produit. « Voir » n'a donc nulle part où aller
     * pour deux des trois genres, et le bouton s'éteint au lieu de mener à un
     * 404. REMONTÉ : il faudrait une page de publication.
     *
     * ⚠ ET LE SLUG N'EST PAS CONNU D'ICI — la rangée vient de la file, pas de la
     * fiche. L'adresse est donc composée par le HOOK, qui l'a. On laisse `''` et
     * `use-reseau.ts` la remplit : voir son appel.
     */
    href: '',
    masque: r.hidden,
  };
}

// ═══ L'onglet « Événements » d'un réseau ═══════════════════════════════════

/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║ LES DEUX PAIRES DE COULEURS DE LA PASTILLE DE DATE, RELEVÉES SUR LA PLANCHE  ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * La maquette dessine la pastille de la première carte — celle qui porte
 * « Vous y allez » — en terre cuite sur sable (`#FBE3D4` / `#B4581F`), et celles
 * des deux autres en vert sur vert (`#E3F0EB` / `#0F5C48`). Relevé identique sur
 * les quatre cadres de l'onglet, aux deux largeurs.
 *
 * C'est la MÊME paire que l'agenda emploie pour la même distinction
 * (`DATE_JY_VAIS` / `DATE_AUTRE` dans `screens/agenda/data.ts`) — la couleur ne
 * se décide donc pas ici, elle se lit sur deux maquettes qui s'accordent. La
 * couleur du TEXTE, elle, n'existe que sur cette maquette : la pastille de
 * l'agenda n'en déclare pas.
 */
const DATE_JY_VAIS = { fond: '#FBE3D4', couleur: '#B4581F' } as const;
const DATE_AUTRE = { fond: '#E3F0EB', couleur: '#0F5C48' } as const;

/**
 * Une carte de l'onglet « Événements » d'un réseau, depuis `GET /events`.
 *
 * ── CE QUI VIENT DE L'AGENDA, ET POURQUOI ────────────────────────────────────
 *
 * `numeroJour`, `abbrMois`, `TYPES_FR` et `pluriel` sont IMPORTÉS de
 * `screens/agenda/data.ts`, qui est le module de l'écran d'origine de cette
 * donnée. Un mois écrit de deux façons dans la même application, ou deux tables
 * de libellés de type, divergent toujours — et `TYPES_FR` porte déjà l'écart
 * signalé au porteur sur les huit valeurs de `EventType`.
 *
 * ── LE JOUR EST CELUI DE LA VILLE DE L'ÉVÉNEMENT ─────────────────────────────
 *
 * `localDate` est calculé par le SERVEUR dans le fuseau de la ville (§3.5), et ce
 * fichier ne le recalcule jamais : un événement de 23 h se rangerait un jour trop
 * tôt ou trop tard selon le fuseau du navigateur.
 */
export function evenementReseauFrom(e: EventCardResponse): EvenementReseauView {
  const jyVais = e.myStatus === 'GOING' || e.myStatus === 'WAITLIST';
  const date = jyVais ? DATE_JY_VAIS : DATE_AUTRE;
  return {
    id: e.id,
    numero: numeroJour(e.localDate),
    mois: abbrMois(e.localDate),
    fondDate: date.fond,
    couleurDate: date.couleur,
    type: TYPES_FR[e.type] ?? e.type,
    jyVais,
    reserve: e.communityId !== null,
    titre: e.title,
    lieu: e.venueName === null ? e.city.name : `${e.venueName}, ${e.city.name}`,
    lieuCourt: e.venueName ?? e.city.name,
    participants: e.attendeeCount,
    pluriel: pluriel(e.attendeeCount),
    /** `/agenda/:id` — la page que `app/(app)/agenda/[id]/` sert déjà. */
    href: `/agenda/${e.id}`,
  };
}

export function evenementsReseauFrom(
  items: readonly EventCardResponse[],
): readonly EvenementReseauView[] {
  return items.map(evenementReseauFrom);
}

// ══ L'ONGLET « ALBUM » (§2.3) ═══════════════════════════════════════════════

/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║ LES TROIS ONGLETS PAR DÉFAUT SE DÉRIVENT — AUCUNE COLONNE N'A ÉTÉ AJOUTÉE   ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * MESURÉ AVANT D'ÉCRIRE UNE LIGNE, et c'est ce qui a décidé qu'il n'y aurait pas
 * de migration : le modèle `Album` (`packages/db/prisma/schema/07-communities.prisma`,
 * l. 372) porte `communityId`, `eventId?`, `title`, `createdByUserId` — et AUCUN
 * champ de genre. Les trois onglets que le porteur demande tiennent donc sur ce
 * qui existe :
 *
 *   · « Événements » = `eventId !== null`. C'est ce que le service écrit déjà
 *     dans `albumSchema.eventId`, donc rien à ajouter côté API non plus ;
 *   · « Partagés »  = les images des PUBLICATIONS du réseau, qui ne sont pas des
 *     albums du tout : elles vivent dans `PostMedia` et arrivent par
 *     `postCardSchema.media`. C'est une VUE, pas une ligne d'`albums` ;
 *   · « Tout »      = l'ensemble.
 *
 * ⚠ LE LIBELLÉ EST « Tout », PAS « Tous » : c'est le mot que la maquette dessine
 * sur les trois cadres qui portent cette rangée (1 036 px vue membre, 1 036 px
 * vue propriétaire, 390 px vue membre). Le porteur a écrit « tous » ; on
 * transcode le dessin au lieu de le réécrire, et c'est REMONTÉ.
 */
export const ALBUM_TOUT = 'tout';
export const ALBUM_PARTAGES = 'partages';
export const ALBUM_EVENEMENTS = 'evenements';

const ALBUM_PASTILLES_PAR_DEFAUT: readonly AlbumPastilleView[] = [
  { clef: ALBUM_TOUT, libelle: 'Tout' },
  { clef: ALBUM_PARTAGES, libelle: 'Partagés' },
  { clef: ALBUM_EVENEMENTS, libelle: 'Événements' },
];

/**
 * Les pastilles : les trois par défaut, puis UN ALBUM DE MODÉRATEUR par
 * pastille.
 *
 * ⚠ LES ALBUMS D'ÉVÉNEMENT N'ONT PAS LEUR PASTILLE, et c'est le porteur qui le
 * dit : ils sont « des albums automatiques remplis par […] les images ajoutées
 * lors de la publication des événements », et l'onglet « Événements » les montre
 * tous ensemble. Leur donner en plus une pastille chacune ferait lire deux fois
 * la même photo dans deux onglets voisins — et la rangée de pastilles, que la
 * maquette dessine en trois éléments, deviendrait une liste sans fin sur un
 * réseau qui annonce vingt événements.
 */
export function albumPastillesFrom(albums: readonly Album[]): readonly AlbumPastilleView[] {
  return [
    ...ALBUM_PASTILLES_PAR_DEFAUT,
    ...albums.filter((a) => a.eventId === null).map((a) => ({ clef: a.id, libelle: a.title })),
  ];
}

/**
 * Les tuiles d'UN album.
 *
 * `p.url === null` EST FILTRÉ, et le schéma dit pourquoi : « `null` tant que
 * l'image est en traitement ». Une tuile sans adresse afficherait le hachuré de
 * la maquette à la place d'une photo — c'est-à-dire un trou qui se lit comme un
 * défaut d'affichage. Mieux vaut douze tuiles de moins qu'une tuile qui mente.
 * REMONTÉ : le pipeline média ne tourne pas encore, donc ce filtre est celui
 * qui décide de ce qui s'affiche aujourd'hui.
 */
function tuilesDe(a: Album): readonly PhotoAlbumView[] {
  const vues: PhotoAlbumView[] = [];
  for (const p of a.photos) {
    if (p.url === null) continue;
    vues.push({ id: p.id, url: p.url, legende: p.caption ?? '' });
  }
  return vues;
}

/**
 * « Partagés » — les images des publications du fil du réseau.
 *
 * ⚠ ON NE PASSE PAS PAR `GET /communities/:id/feed`, et c'est la même raison que
 * pour l'onglet « Fil » (voir `A08TData.publications`) :
 * `communityFeedPostSchema` ne porte que sept champs bruts, SANS `media`. C'est
 * donc `GET /feed?communityId=…` qu'on lit, dont `postCardSchema.media` rend
 * `{ id, position, url }` — l'`url` y est une chaîne, jamais `null`, parce que
 * le service du fil ne met en carte que les médias prêts.
 *
 * `position` DÉCIDE DE L'ORDRE DANS UNE PUBLICATION : une publication porte
 * jusqu'à quatre images (§2.4), et leur ordre est celui que l'auteur a choisi.
 * L'ordre ENTRE publications est celui du fil, c'est-à-dire du plus récent au
 * plus ancien — le même que la grille d'un album.
 *
 * `legende` RESTE VIDE : une publication n'a pas de légende par image, elle a un
 * corps. Y mettre l'extrait du texte écrirait un paragraphe dans une tuile de
 * 150 px. REMONTÉ : la maquette ne dessine de texte que sur la première tuile.
 */
export function photosPartageesFrom(posts: readonly PostCard[]): readonly PhotoAlbumView[] {
  const vues: PhotoAlbumView[] = [];
  for (const p of posts) {
    for (const m of [...p.media].sort((a, b) => a.position - b.position)) {
      vues.push({ id: m.id, url: m.url, legende: '' });
    }
  }
  return vues;
}

/**
 * La grille de l'onglet choisi.
 *
 * `partagees` est passée toute faite plutôt que recalculée ici : le crochet la
 * tient d'un appel distinct (`GET /feed?communityId=`), et la recalculer à
 * chaque bascule de pastille demanderait de garder les publications brutes dans
 * l'état pour rien.
 */
export function albumPhotosFrom(
  albums: readonly Album[],
  partagees: readonly PhotoAlbumView[],
  onglet: string,
): readonly PhotoAlbumView[] {
  if (onglet === ALBUM_PARTAGES) return partagees;
  if (onglet === ALBUM_EVENEMENTS) {
    return albums.filter((a) => a.eventId !== null).flatMap(tuilesDe);
  }
  if (onglet === ALBUM_TOUT) return [...albums.flatMap(tuilesDe), ...partagees];
  const un = albums.find((a) => a.id === onglet);
  return un === undefined ? [] : tuilesDe(un);
}

/**
 * Les rangées de la carte « ALBUMS » de la colonne de droite.
 *
 * ⚠ LES ALBUMS D'ÉVÉNEMENT EN SONT ABSENTS, pour la même raison que leurs
 * pastilles : l'onglet « Événements » les montre tous ensemble, et la carte en
 * listerait un par événement du réseau — trois rangées dessinées, vingt
 * possibles.
 *
 * `photoCount` ET `photos[0].url` VIENNENT DU SERVEUR, tous les deux : rien à
 * compter ici, rien à deviner. `photos` est trié du plus récent au plus ancien
 * par le service (`orderBy: { createdAt: 'desc' }`), donc la couverture est la
 * DERNIÈRE photo ajoutée — c'est ce que le service rend, et choisir autrement
 * demanderait une colonne de couverture, qui n'existe pas. REMONTÉ.
 */
export function albumVignettesFrom(albums: readonly Album[]): readonly AlbumVignetteView[] {
  return albums
    .filter((a) => a.eventId === null)
    .map((a) => ({
      id: a.id,
      titre: a.title,
      compte:
        a.photoCount === 0
          ? 'Aucune photo'
          : `${a.photoCount} photo${a.photoCount > 1 ? 's' : ''}`,
      couverture: a.photos.find((p) => p.url !== null)?.url ?? null,
    }));
}
