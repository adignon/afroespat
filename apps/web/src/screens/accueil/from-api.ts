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
  CommentRow,
  FeedResponse,
  FeedSidebarResponse,
  MemberSummary,
  PostCard,
  StoryBandResponse,
} from '@app/shared';
import type { CommentView, EventView, FeedPostView, PersonView, StoryView } from '../a01/data';
import { urlMedia } from '../../lib/api/base';
import { fondAvatar } from '@/lib/avatar';
import { photoFondFor } from '../a14/data';

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

/**
 * Une ligne du fil de A01C, plus ce que la page doit connaître pour agir.
 *
 * ⚠ `commentId` ET `canEdit` SONT FACULTATIFS DEPUIS LES EMPLACEMENTS RETIRÉS, et
 * ce n'est pas un relâchement du contrat : un emplacement « retiré par la
 * modération » N'A PAS d'identifiant — `commentRemovedSchema` ne le sert pas, et
 * son en-tête écrit pourquoi (l'identifiant est précisément ce qui permettrait de
 * retrouver le message). Il n'a pas non plus de fenêtre de modification.
 *
 * Les rendre facultatifs plutôt que de poser `commentId: ''` était le choix
 * honnête : une chaîne vide est une valeur, et une valeur se recopie — un
 * `data-commentaire-signaler=""` serait parti signaler un commentaire sans
 * identifiant. Absents, les deux ne peuvent pas être lus par mégarde, et `tsc`
 * nomme l'appelant qui essaierait.
 */
export interface CommentaireLigne extends CommentView {
  readonly commentId?: string;
  readonly canEdit?: boolean;
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
/**
 * LE ROND D'UN RÉSEAU, dans la fenêtre de partage.
 *
 * La maquette dessine « LY » et « BN » : deux lettres tirées du nom. On réemploie
 * donc `initials`, qui produit exactement cette forme pour un nom de personne, et
 * `avatarColor`, dont la teinte est stable pour une clé donnée — un réseau garde
 * ainsi sa couleur d'une ouverture à l'autre. L'identifiant sert de clé : deux
 * réseaux homónymes n'auraient pas la même couleur, ce qui est préférable à deux
 * ronds identiques.
 */
export function initialesDeReseau(nom: string, id: string): { readonly i: string; readonly bg: string } {
  return { i: initials(nom), bg: avatarColor(id) };
}

/**
 * Les initiales et la teinte d'un membre. EXPORTÉE depuis que la fenêtre de
 * commentaires dessine la carte de la publication commentée : elle a besoin du
 * même rond que le fil, et le recopier ferait deux palettes à la première
 * retouche.
 */
export function avatarDe(m: MemberSummary): { readonly i: string; readonly bg: string } {
  return avatar(m);
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE SEUL ENDROIT OÙ UN ROND DE MEMBRE SE FABRIQUE, POUR TOUT LE FIL        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « l'image profil ne s'applique pas sur toutes les pages. »
 *
 * MESURÉ sur `/accueil`, une photo posée par `PUT /me/avatar` : onze ronds
 * d'avatar, DEUX avec la photo. Les neuf autres étaient des aplats, et quatre
 * portaient `AK` — les initiales du lecteur lui-même, sur SES publications.
 * `memberSummarySchema.avatarUrl` était pourtant servi depuis le début ; cette
 * fonction ne le lisait pas, et c'est elle que traversent les HUIT familles de
 * ronds du fil : publications, stories, nouveaux arrivants, membres en ligne,
 * commentaires, réponses, la carte de rappel de la fenêtre de commentaires et
 * l'aperçu de la fenêtre de partage. Un seul correctif les couvre tous.
 *
 * ── `i: ''` QUAND IL Y A UNE PHOTO, ET C'EST INDISPENSABLE ────────────────
 *
 * Les cadres transcodés écrivent `{p.i}` À L'INTÉRIEUR du rond dont `p.bg` est
 * le fond. Poser la photo sans vider les initiales les dessinerait PAR-DESSUS le
 * visage, en blanc sur une image claire — illisible. Les initiales sont le
 * REPLI d'une photo absente, pas une étiquette : quand la photo est là, elles
 * n'ont plus d'objet.
 *
 * La teinte stable de `avatarColor` reste pour tous ceux qui n'ont pas de photo,
 * et c'est le dessin de la maquette, inchangé.
 */
function avatar(m: MemberSummary): {
  readonly i: string;
  readonly bg: string;
  readonly profil: string;
} {
  const photo = fondAvatar(m.avatarUrl);
  /**
   * ── L'ADRESSE DU PROFIL VOYAGE AVEC LE ROND ──────────────────────────────
   *
   * Le porteur : « ajoute l'accès au profil public d'un utilisateur à partir des
   * publications (quand on clique sur son nom […]) partout où le nom est
   * affiché ».
   *
   * CETTE FONCTION EST LE POINT DE PASSAGE de HUIT familles de ronds du fil —
   * publications, stories, nouveaux arrivants, membres en ligne, commentaires,
   * réponses, la carte de rappel de la fenêtre de commentaires et l'aperçu de la
   * fenêtre de partage. Y poser l'adresse les couvre toutes d'un coup, comme la
   * photo l'a été.
   *
   * `/@handle` AVEC L'AROBASE : la route `(app)/[handle]` l'EXIGE — son segment
   * commence par `@`, et sans elle elle rend `notFound()`. L'oubli a déjà coûté
   * une page blanche sur « Voir le profil » du menu de conversation.
   */
  const profil = `/@${m.handle}`;
  return photo === null
    ? { i: initials(m.displayName), bg: avatarColor(m.handle), profil }
    : { i: '', bg: photo, profil };
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
export const TYPE_STYLE = {
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
    /**
     * LE NOMBRE, À CÔTÉ DU LIBELLÉ. `comment` est le MOT du bouton
     * (« Commenter », « Répondre ») ; celui-ci est le compteur du serveur, posé
     * pour la feuille A01C que ce bouton ouvre. Voir sa prise dans
     * `screens/a01/data.ts` : sans lui, la feuille ouverte depuis le profil
     * n'avait pas de compteur.
     */
    commentCount: p.commentCount,
    /** L'encart « Étape franchie · N sur M » (§2.2), absent s'il n'y a pas d'étape. */
    ...(p.stepBadge === null ? {} : { step: p.stepBadge.stepName }),
    /**
     * La première image, comme la maquette la dessine. Les quatre arrivent dans
     * `media`, mais le cadre transcodé n'en place qu'une — ne pas en dessiner
     * quatre là où la maquette en montre une serait redessiner.
     */
    /**
     * `urlMedia` : l'API rend `/media/<clé>`, une adresse RELATIVE que le
     * navigateur résoudrait contre le serveur WEB et non contre l'API. Voir son
     * en-tête dans `lib/api/base.ts`.
     */
    ...(p.media.length === 0
      ? {}
      : {
          /**
           * `photo` RESTE LA CONDITION — la maquette écrit `<sc-if value="{{ photo }}">`
           * — et `photoFond` porte l'image. Avant, `photo` était AUSSI le contenu du
           * bloc : la carte affichait l'adresse du média en gris sur le hachurage.
           *
           * `photoFondFor(url, false)` : « couvrir ». Sans `cover` et `no-repeat`, le
           * navigateur pose l'image à sa taille naturelle et la répète — une photo de
           * téléphone remplissait la carte d'un coin agrandi. C'est la même fonction
           * que la story et que le composeur, et c'est délibérément la même.
           */
          photo: urlMedia(p.media[0]?.url ?? ''),
          photoFond: photoFondFor(urlMedia(p.media[0]?.url ?? ''), false),
          /**
           * ╔════════════════════════════════════════════════════════════════╗
           * ║ LES QUATRE, ET PLUS SEULEMENT LA PREMIÈRE                         ║
           * ╚════════════════════════════════════════════════════════════════╝
           *
           * `media` en porte jusqu'à quatre (§2.4) et l'écran en jetait trois : un
           * membre qui joignait quatre photos en voyait une, sans que rien ne dise
           * que les autres existaient. Le porteur l'a demandé « en slide » ; c'est
           * `CarrouselPhotos` qui le rend, et lui seul sait s'il faut un rail.
           *
           * ON TRIE SUR `position` : l'ordre d'arrivée des lignes n'est pas garanti
           * par le serveur, et c'est `position` qui porte l'ordre choisi par le
           * membre. `photoFond` et `photo` restent la PREMIÈRE — d'autres cadres les
           * lisent encore, et les retirer dépasserait ce lot.
           */
          /**
           * LES ADRESSES, PAS LES FONDS. `CarrouselPhotos` compose lui-même les
           * deux rendus — « couvrir » dans la carte, « contenir » en grand — et
           * lui passer un fond déjà composé l'enfermerait dans l'un des deux.
           */
          photoUrls: [...p.media]
            .sort((a, b) => a.position - b.position)
            .map((m) => urlMedia(m.url)),
          photoH: '260px',
        }),
    /**
     * ── LE SONDAGE, MIS EN FORME COMME LA PLANCHE LE DESSINE ───────────────
     *
     * Elle dessine trois barres remplies à un pourcentage, l'option choisie en
     * gras et bordée de vert. Les pourcentages viennent du serveur — ou n'y sont
     * PAS : tant qu'on n'a pas voté et que le sondage n'est pas clos, `voteCount`
     * vaut `null` (§2.3 du module 07). On affiche alors une barre VIDE et aucun
     * pourcentage, jamais « 0 % » : un zéro affirmerait que personne n'a voté.
     */
    ...(p.poll === null
      ? {}
      : {
          poll: p.poll.options.map((o) => {
            const total = p.poll?.totalVotes ?? 0;
            const choisie = (p.poll?.myOptionIds ?? []).includes(o.id);
            const part =
              o.voteCount === null || total === 0 ? null : Math.round((o.voteCount / total) * 100);
            return {
              t: o.label,
              p: part === null ? '' : `${String(part)} %`,
              w: part === null ? '0%' : `${String(part)}%`,
              fill: choisie ? '#E3F0EB' : '#F2F5F4',
              bd: choisie ? '1.5px solid #16785E' : '1px solid #E6EBE9',
              fw: choisie ? 700 : 500,
              optionId: o.id,
              pollId: p.poll?.id ?? '',
              /**
               * ╔════════════════════════════════════════════════════════════╗
               * ║ UN SONDAGE TERMINÉ N'A PLUS À ÊTRE CLIQUABLE                  ║
               * ╚════════════════════════════════════════════════════════════╝
               *
               * Le porteur : « Lorsque les votes se terminent, les clics sur les
               * choix sont désactivés ? » Ils ne l'étaient pas. Le SERVEUR, lui,
               * refuse déjà (`POLL_CLOSED`) : l'écran offrait donc un geste dont
               * la seule issue était un message d'erreur.
               *
               * `closed` EST CALCULÉ PAR LE SERVEUR, pas ici : le schéma le dit
               * « calculé serveur : `closesAt` dépassé ». Comparer `closesAt` à
               * l'horloge du navigateur ferait diverger l'écran du service dès
               * qu'une machine est mal réglée.
               */
              clos: p.poll?.closed ?? false,
            };
          }),
          /**
           * LA QUESTION, que la maquette ne dessinait pas : sa publication
           * d'exemple l'écrit dans le corps. Le composeur, lui, la demande à part —
           * une carte pouvait donc montrer trois réponses sans dire à quoi.
           */
          pollQuestion: p.poll.question,
          pollMeta: pollMetaDe(p.poll),
        }),
    /** Les guides liés, dans l'ordre choisi par l'auteur. */
    ...(p.guides.length === 0 ? {} : { guides: p.guides.map((g) => ({ slug: g.slug, title: g.title })) }),
    /** Ce que l'écran doit rouvrir : le détail, les commentaires, la réaction. */
    postId: p.id,
    enAttente: p.awaitingApproval,
    isAuthor: p.isAuthor,
    /** « Enregistrer » : l'état vient du SERVEUR, jamais d'une bascule locale. */
    enregistre: p.bookmarked,
    mine: p.reaction.mine,
    /**
     * LE BOUTON SE REMPLIT — et il lui faut un BOOLÉEN, pas le genre de la
     * réaction. `mine` reste tel quel au-dessus : la page s'en sert pour savoir
     * s'il faut poser ou retirer.
     */
    reagi: p.reaction.mine !== null,
  };
}

/**
 * LA LIGNE SOUS LE SONDAGE — « 86 votes · se termine dans 3 jours · vous avez voté ».
 *
 * Elle est COMPOSÉE DE CE QUI EST VRAI, et chaque morceau n'apparaît que s'il
 * l'est : le nombre de votes seulement quand on a le droit de le connaître, la
 * clôture seulement si elle est fixée, « vous avez voté » seulement si c'est le
 * cas. La maquette écrit les trois d'un coup parce qu'elle montre UN exemple.
 */
function pollMetaDe(poll: NonNullable<PostCard['poll']>): string {
  const morceaux: string[] = [];
  if (poll.totalVotes !== null) {
    morceaux.push(`${String(poll.totalVotes)} vote${poll.totalVotes > 1 ? 's' : ''}`);
  }
  if (poll.closed) morceaux.push('terminé');
  else if (poll.closesAt !== null) {
    /**
     * LA DATE, ET NON UN DÉLAI RELATIF. Le serveur rend `closesAt` en ISO et
     * AUCUNE route ne compose « dans 3 jours » pour un sondage — contrairement
     * aux publications, dont `relativeTime` vient du serveur. Le calculer ici
     * demanderait l'horloge du navigateur, qui peut être décalée : « se termine
     * dans 3 jours » deviendrait faux sans que rien ne le dise. Une date est
     * vraie quelle que soit l'horloge qui la lit.
     */
    morceaux.push(
      `se termine le ${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(new Date(poll.closesAt))}`,
    );
  }
  if (poll.myOptionIds.length > 0) morceaux.push('vous avez voté');
  return morceaux.join(' · ');
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
      lien: `/stories/${s.id}`,
      /** Le CORPS de la story — voir `StoryView.apercu`. */
      apercu: s.body,
      estPhoto: s.backgroundUrl !== null,
      /**
       * ╔══════════════════════════════════════════════════════════════════════╗
       * ║ LE FOND DE LA CARTE — LA STORY ELLE-MÊME                            ║
       * ╚══════════════════════════════════════════════════════════════════════╝
       *
       * Le porteur a demandé la bande de « Fil d'actualité v2 » : ses cartes
       * montrent la story EN FOND, derrière un voile dégradé, et non plus un rond
       * d'initiales.
       *
       * L'IMAGE D'ABORD, LA COULEUR ENSUITE. `storyBubbleSchema` porte les deux et
       * la composition en impose exactement UNE — son `refine` l'écrit :
       * « (backgroundColor === undefined) !== (backgroundAssetId === undefined) ».
       * On lit donc l'image, puis l'aplat, puis le vert du dépôt en dernier
       * recours : une carte sans fond serait un rectangle blanc au milieu de
       * quatre photos.
       *
       * `photoFondFor(url, false)` — « couvrir ». Sans `cover` et `no-repeat`, le
       * navigateur poserait l'image à sa taille naturelle et la répéterait ; une
       * story est un portrait de téléphone, elle remplirait la carte d'un coin
       * agrandi.
       */
      fond:
        s.backgroundUrl !== null
          ? photoFondFor(urlMedia(s.backgroundUrl), false)
          : (s.backgroundColor ?? '#0F5C48'),
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
 * L'alerte de vigilance de la colonne de droite (lot W2A) : `scamAlert` de
 * `GET /feed/sidebar`, ou `null` quand le serveur n'en publie aucune pour ce lieu.
 */
export function alerteFrom(sidebar: FeedSidebarResponse): { titre: string; corps: string } | null {
  const a = sidebar.scamAlert;
  if (a === null) return null;
  return { titre: a.title, corps: a.body };
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

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE FILTRE DE « RECHERCHER UN CONTACT » — ET POURQUOI IL REND LES RANGS    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La fenêtre de partage dessine une barre de recherche au-dessus des ronds de
 * contacts. Elle était un `<div>` de texte : on ne pouvait rien y saisir, et la
 * liste des contacts en ligne s'affichait entière.
 *
 * LE RANG D'ORIGINE EST RENDU AVEC LE CONTACT, et c'est la seule façon juste : la
 * sélection est une liste de RANGS dans la liste complète, et l'envoi relit
 * `online[rang]`. Filtrer puis remapper de 0 décalerait tout — on cocherait Awa et
 * le lien partirait à Bintou. Mesuré en pensée avant d'écrire, et c'est exactement
 * le genre de décalage silencieux que ce dépôt a déjà payé ailleurs.
 *
 * SANS ACCENT NI CASSE : « amina » doit trouver « Amina », et « ndiaye » trouver
 * « Ndiayé ». `normalize('NFD')` puis retrait des diacritiques — la même recette
 * que le serveur applique à la recherche, et non une comparaison naïve qui ferait
 * échouer un nom sur deux dans cette diaspora.
 */
export function contactsFiltres<T extends { readonly name: string }>(
  contacts: readonly T[],
  recherche: string,
): readonly { readonly contact: T; readonly rang: number }[] {
  const nu = sansAccent(recherche.trim());
  return contacts
    .map((contact, rang) => ({ contact, rang }))
    .filter(({ contact }) => nu === '' || sansAccent(contact.name).includes(nu));
}

/** Minuscules, sans diacritiques. Exportée pour être éprouvée seule. */
export function sansAccent(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
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
export function threadFrom(
  items: readonly CommentRow[],
  /**
   * « Répondre » — la FABRIQUE, pas la prise.
   *
   * On la reçoit plutôt que de poser l'identifiant et de laisser la page recoudre :
   * le nom de l'auteur, que la bande « En réponse à » affiche, est ici et nulle
   * part ailleurs. Le passer à part obligerait la page à rechercher la racine par
   * identifiant à chaque clic.
   *
   * FACULTATIVE : `A02` lit la même fonction pour une page qui ne répond pas.
   */
  onRepondre?: (commentId: string, nom: string) => void,
  /**
   * « Signaler » — la FABRIQUE elle aussi, et pour la même raison.
   *
   * Le porteur : « sur les publications le signalement des commentaires ne
   * marche pas non plus. » La planche dessine `<a href="#">Signaler</a>` sous
   * chaque commentaire, racine comme réponse — un lien mort.
   *
   * ELLE S'APPLIQUE AUX RÉPONSES AUSSI : un commentaire abusif l'est autant à
   * deux niveaux qu'à un. La planche dessine le lien sur les deux, et
   * `ReportSubjectType.COMMENT` ne distingue pas.
   */
  onSignaler?: (commentId: string) => void,
): readonly CommentaireLigne[] {
  const signalerDe = (id: string) =>
    onSignaler === undefined
      ? {}
      : {
          onSignaler: (): void => {
            onSignaler(id);
          },
        };
  return items.flatMap((racine) =>
    'removed' in racine
      ? [{ ...LIGNE_RETIREE, indent: '0px', indentM: '0px' }]
      : [
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
      ...(onRepondre === undefined
        ? {}
        : {
            onRepondre: (): void => {
              onRepondre(racine.id, racine.author.displayName);
            },
          }),
      ...signalerDe(racine.id),
    },
    ...racine.replies.map((r) =>
      'removed' in r
        ? { ...LIGNE_RETIREE, indent: '50px', indentM: '44px' }
        : {
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
            ...signalerDe(r.id),
          },
    ),
        ],
  );
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ L'EMPLACEMENT « RETIRÉ » — UNE LIGNE QUI NE PORTE AUCUNE DONNÉE            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La colonne « ÉTATS » de A01C dessine un bloc gris : « Ce commentaire a été
 * retiré par la modération. » Le cadre transcodé le pose À LA PLACE DE LA LIGNE
 * ENTIÈRE quand `c.retire` est vrai — avatar, nom, phase, bulle et pied compris —
 * parce qu'un emplacement qui garderait le rond d'initiales nommerait l'auteur que
 * le retrait a ôté.
 *
 * ⚠ CES DIX CHAMPS NE SONT PAS DES VALEURS D'EXEMPLE, et la distinction est celle
 * que ce dépôt tient partout ailleurs (« mieux vaut rien qu'un exemple ») : ce sont
 * des VIDES. Aucun n'atteint l'écran, puisque la branche qui les lit n'est pas
 * rendue. Ils existent parce que `CommentView` est le contrat d'une LIGNE DESSINÉE
 * et que ses onze champs sont requis pour tout vrai commentaire ; les rendre
 * facultatifs pour ce seul cas affaiblirait le contrat des centaines de lignes qui
 * en portent une vraie valeur, et laisserait passer un commentaire sans nom.
 *
 * `retire` est la SEULE information de cette ligne, et c'est exactement ce que
 * `commentRemovedSchema` sert : `{ removed: true }`, sans corps, sans auteur, sans
 * date et sans identifiant.
 *
 * `indent` / `indentM` NE SONT PAS ICI : ils disent la PROFONDEUR, et une réponse
 * retirée se décale comme la réponse qu'elle remplace (50 px, 44 px sur mobile).
 * Les figer à zéro aurait ramené toutes les réponses retirées à la marge gauche, et
 * le fil se serait réordonné à l'œil.
 */
const LIGNE_RETIREE = {
  retire: true,
  i: '',
  bg: '',
  name: '',
  phase: '',
  author: false,
  text: '',
  time: '',
  canReply: false,
  av: '0px',
} as const satisfies Omit<CommentView, 'indent' | 'indentM'>;
