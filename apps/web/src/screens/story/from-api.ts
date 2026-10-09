/**
 * DE L'API VERS LES PRISES DE A13 — la story en lecture.
 *
 * Tout ce que le cadre affiche vient du serveur : l'auteur, le texte, la ligne
 * d'état (« 1er des conseils Logement aujourd'hui · 31 trouvent utile »), les deux
 * libellés de vote et leurs compteurs. Ce qui reste ici est du DESSIN — la couleur
 * de la pastille par type, et la palette d'avatars — parce qu'un code couleur n'a
 * rien à faire dans une réponse JSON.
 *
 * ── LES DEUX LIBELLÉS DE VOTE VIENNENT DU SERVEUR, ET C'EST UNE RÈGLE DURE ──
 *
 * §2.6 accepte DEUX `kind` par type de story, et le serveur refuse
 * `KIND_NOT_ALLOWED_FOR_TYPE` (mesuré 422) si l'on se trompe. On lit donc
 * `votes.positiveKind` / `votes.negativeKind` et leurs libellés plutôt que de tenir
 * une seconde table de vocabulaire dans le front — deux tables divergent toujours,
 * et celle-ci ferait proposer « Je confirme » sur une découverte.
 *
 * ── AUCUN COMPTEUR DE VUES ─────────────────────────────────────────────────
 *
 * `n1` et `n2` sont des compteurs de VOTES. Il n'existe pas de compteur de vues sur
 * une story, sur aucune route, pas même pour l'auteur (`00` §49, 04 §2.6), et
 * `storyBubbleSchema` est `.strict()` pour que l'ajout d'un `viewCount` soit refusé
 * À LA FRONTIÈRE au lieu d'arriver jusqu'à un écran qui l'afficherait.
 *
 * ── LE MUR : UNE STORY À FOND IMAGE EST INDESSINABLE ───────────────────────
 *
 * `backgroundUrl` vaut TOUJOURS `null` — le service ne résout jamais
 * `backgroundAssetId` en URL. `photo` est donc toujours faux et le fond retombe sur
 * la couleur. C'est du back, et c'est remonté : rien n'est fabriqué ici pour le
 * masquer, et surtout pas une image tirée d'ailleurs.
 */
import type { StoryDetailResponse } from '@app/shared';
import { fondAvatar } from '@/lib/avatar';
import { avatarColor, initials } from '../accueil/from-api';
import type { StoryReadView } from '../a13/data';
import { photoFondFor } from '../a14/data';
import { urlMedia } from '../../lib/api/base';

/** Les couleurs de pastille par type, telles que la maquette les fixe. */
const STORY_PILL_FG = {
  CONSEIL: '#16785E',
  DECOUVERTE: '#16785E',
  INFORMATION: '#1F2A44',
} as const;

/**
 * Le fond quand le serveur n'en donne aucun.
 *
 * `backgroundColor` est `nullable` : une story créée avec une image de fond n'a pas
 * de couleur, et son image n'est pas résolue (voir plus haut). Plutôt qu'un cadre
 * transparent où le texte blanc deviendrait illisible, on retombe sur le PREMIER
 * ton de la palette de la maquette — celui que le composeur propose par défaut.
 * Aucune teinte n'est assombrie (T1 §1.2).
 */
const FOND_PAR_DEFAUT = '#16785E';

/** « Écrire à Aïcha… » — le PRÉNOM seul, comme la maquette l'écrit. */
/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ UN CHAMP DÉSACTIVÉ QUI INVITE À ÉCRIRE NE DIT PAS POURQUOI                ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Vérifie que le contrôle est bien appliqué au niveau des story
 * display. » Il l'est — MESURÉ : une story publiée avec « Autoriser les messages »
 * éteint rend `canMessage: false`, et le champ sort `disabled`.
 *
 * Mais il gardait l'invite « Écrire à Kofi… ». Un champ grisé qui propose
 * d'écrire est un demi-geste : le membre voit une invitation à laquelle il ne
 * peut pas répondre, et rien ne lui dit que c'est l'AUTEUR qui a fermé — il peut
 * croire que c'est son propre compte qui est en cause, ce qui est faux.
 *
 * ── LE SECOND CAS, QUI SE LIT PAREIL ET N'EST PAS LE MÊME ────────────────
 *
 * `canMessage` vaut aussi `false` sur SA PROPRE story (`allowMessages && !isAuthor`,
 * côté serveur). « L'auteur a fermé les messages » serait alors absurde : on ne
 * s'écrit pas à soi-même. D'où deux phrases, décidées sur ce que le serveur dit
 * de l'auteur.
 *
 * ⚠ AUCUNE PLANCHE NE DESSINE CES DEUX ÉTATS : la maquette ne connaît que
 * l'invitation. Les deux phrases sont donc des textes d'interface écrits ici, et
 * REMONTÉS au porteur comme les autres.
 */
function invitationEcriture(displayName: string, canMessage: boolean, estMoi: boolean): string {
  const prenom = displayName.trim().split(/\s+/)[0] ?? displayName;
  if (canMessage) return `Écrire à ${prenom}…`;
  return estMoi ? 'Votre story' : 'L’auteur a fermé les messages';
}

/**
 * Le vocabulaire de vote, DÉRIVÉ du schéma partagé (`z.infer`) et jamais réécrit.
 * Un type recopié dans le front serait une seconde table, et le serveur répondrait
 * `KIND_NOT_ALLOWED_FOR_TYPE` le jour où les deux divergeraient.
 */
export type VoteKind = StoryDetailResponse['story']['votes']['positiveKind'];

/** Les prises de A13, plus ce que la page doit connaître pour agir. */
export interface StoryLue extends StoryReadView {
  readonly storyId: string;
  /**
   * LE TYPE DE LA STORY — `CONSEIL`, `DECOUVERTE`, `INFORMATION`.
   *
   * Il sert à voisiner : « les cartes left et right doivent afficher le contenu
   * des story qui suivent dynamiquement SELON LE FILTRE APPLIQUÉ ». Le ruban
   * accepte ce filtre, donc on lui demande les stories du MÊME type.
   */
  readonly typeStory: string;
  /** Les deux seuls `kind` que le serveur acceptera pour CETTE story (§2.6). */
  readonly positiveKind: VoteKind;
  readonly negativeKind: VoteKind;
  /** Mon vote, ou `null`. Jamais déduit du compteur. */
  readonly mine: VoteKind | null;
  /** §2.6 : le serveur dit si l'auteur accepte les messages. On ne le devine pas. */
  readonly canMessage: boolean;
  /** Le pseudo de l'auteur — `POST /conversations/direct` l'exige, pas son id. */
  readonly auteurHandle: string;
  /** La story est-elle déjà enregistrée ? Servi par `GET /stories/:id`. */
  readonly signet: boolean;
  readonly expired: boolean;
  readonly isAuthor: boolean;
}

/** L'apparence RETENUE, telle que la planche la dessine sur « Utile ». */
const VOTE_RETENU = {
  bg: '#fff',
  fg: '#0F5C48',
  bd: 'none',
  compteFg: '#6FA893',
} as const;

/**
 * L'apparence RETENUE DU REFUS — « Le pas utile et son icône doivent être en
 * rouge quand coché ».
 *
 * Même pastille blanche que l'accord, pour que la paire reste cohérente : seule
 * l'ENCRE change. `#9C2A2A` est le rouge du dossier — il est dessiné dans la
 * palette de fonds de cette maquette même (`STORY_BACKGROUND_COLORS`), donc il
 * n'est pas inventé. Le compte prend un rouge éclairci de la même famille, comme
 * `#6FA893` éclaircit le vert de l'accord.
 */
const VOTE_REFUS = {
  bg: '#fff',
  fg: '#9C2A2A',
  bd: 'none',
  compteFg: '#C77A7A',
} as const;

/** L'apparence NON RETENUE, telle que la planche la dessine sur « Pas utile ». */
const VOTE_LIBRE = {
  bg: 'transparent',
  fg: '#fff',
  bd: '1.5px solid rgba(255,255,255,.7)',
  compteFg: 'rgba(255,255,255,.55)',
} as const;

function apparencesDeVote(
  mien: string | null,
  positif: string,
  negatif: string,
): {
  voteUtileBg: string;
  voteUtileFg: string;
  voteUtileBd: string;
  voteUtileIcone: boolean;
  voteUtileCompteFg: string;
  votePasUtileBg: string;
  votePasUtileFg: string;
  votePasUtileBd: string;
  votePasUtileIcone: boolean;
  votePasUtileCompteFg: string;
} {
  const utile = mien === positif;
  const pasUtile = mien === negatif;
  const a = utile ? VOTE_RETENU : VOTE_LIBRE;
  // Le refus retenu est ROUGE, l'accord retenu est vert : la couleur dit le sens.
  const b = pasUtile ? VOTE_REFUS : VOTE_LIBRE;
  return {
    voteUtileBg: a.bg,
    voteUtileFg: a.fg,
    voteUtileBd: a.bd,
    voteUtileIcone: utile,
    voteUtileCompteFg: a.compteFg,
    votePasUtileBg: b.bg,
    votePasUtileFg: b.fg,
    votePasUtileBd: b.bd,
    votePasUtileIcone: pasUtile,
    votePasUtileCompteFg: b.compteFg,
  };
}

/**
 * `Omit` SUR LES DEUX GESTES, et c'est volontaire : cette fonction CONVERTIT une
 * réponse, elle ne connaît aucune action. `use-story.ts` y ajoute `onVoteUtile`
 * et `onVotePasUtile`, parce que c'est lui qui tient `basculerVote`.
 */
export function storyLueFrom(
  reponse: StoryDetailResponse,
): Omit<
  StoryLue,
  | 'onVoteUtile'
  | 'onVotePasUtile'
  | 'messageTexte'
  | 'onMessageTexte'
  | 'onMessageTouche'
  | 'messageBloque'
  | 'messageEnvoiVisible'
  | 'onMessageFocus'
  | 'onMessageBlur'
  | 'onMessageEnvoyer'
  | 'signetActif'
  | 'signetNom'
  | 'signetFill'
  | 'onSignet'
  /**
   * `onFermer` vient de L'ÉCRAN, pas de la réponse : fermer dépend d'où la story
   * a été ouverte — une fenêtre posée sur le fil, ou une page atteinte par son
   * adresse — et ce fichier ne traduit que ce que le serveur rend.
   */
  | 'onFermer'
  /**
   * `barrePause` dépend du FOCUS du champ de message, qui est un état d'écran :
   * la réponse du serveur ne sait rien de ce que le membre est en train d'écrire.
   */
  | 'barrePause'
> {
  const s = reponse.story;
  return {
    bg: s.backgroundColor ?? FOND_PAR_DEFAUT,
    /**
     * ╔══════════════════════════════════════════════════════════════════════╗
     * ║ L'ÉCRAN DE LECTURE NE MONTRAIT PAS LA PHOTO DE L'AUTEUR             ║
     * ╚══════════════════════════════════════════════════════════════════════╝
     *
     * Le porteur : « Le display affiche réellement l'avatar de l'utilisateur ? »
     * — Non. `avBg` valait `avatarColor(handle)`, un aplat de palette tiré du
     * pseudo, et `i` ses initiales. La photo n'était jamais lue, alors que
     * `memberSummarySchema.avatarUrl` la sert depuis le début.
     *
     * C'est la même famille que les six modules corrigés plus tôt — « l'image
     * profil ne s'applique pas sur toutes les pages » — et le dernier endroit du
     * dépôt qui l'ignorait.
     *
     * `i: ''` QUAND IL Y A UNE PHOTO, et c'est indispensable : le cadre écrit
     * `{st.i}` À L'INTÉRIEUR du rond dont `avBg` est le fond. Poser la photo sans
     * vider les initiales les dessinerait par-dessus le visage, en blanc sur une
     * image claire. Les initiales sont le REPLI d'une photo absente.
     *
     * La teinte stable reste pour qui n'a pas de photo : c'est le dessin de la
     * maquette, inchangé.
     */
    avBg: fondAvatar(s.author.avatarUrl) ?? avatarColor(s.author.handle),
    i: s.author.avatarUrl === null ? initials(s.author.displayName) : '',
    /**
     * LE NOM DE L'AUTEUR MÈNE À SON PROFIL. Le porteur : « ajoute l'accès au
     * profil public d'un utilisateur […] story […] partout où le nom est
     * affiché ». L'arobase est OBLIGATOIRE — la route `(app)/[handle]` rend
     * `notFound()` sans elle.
     */
    profil: `/@${s.author.handle}`,
    name: s.author.displayName,
    /** « Lyon · il y a 3 h · expire dans 21 h » — COMPOSÉ PAR LE SERVEUR. */
    sub: s.context.text,
    /**
     * La pastille dit le SUJET quand il y en a un — « CONSEIL · LOGEMENT ». C'est
     * ce que la maquette montre, et c'est le bon choix : savoir de quoi parle une
     * story vaut mieux que savoir de quel type elle est.
     */
    pill:
      s.categoryLabel === null
        ? s.typeLabel.toLocaleUpperCase('fr-FR')
        : `${s.typeLabel.toLocaleUpperCase('fr-FR')} · ${s.categoryLabel.toLocaleUpperCase('fr-FR')}`,
    pillFg: STORY_PILL_FG[s.type],
    label: s.typeLabel.toLocaleUpperCase('fr-FR'),
    text: s.body,
    /** §2.6 : « 1er des conseils Logement aujourd'hui · 31 trouvent utile ». */
    state: s.stateLine,
    a1: s.votes.positiveLabel,
    /** Le bouton est ACTIF quand c'est MON vote — jamais quand le compteur est haut. */
    useful: s.myReaction === s.votes.positiveKind,
    n1: String(s.votes.positive),
    a2: s.votes.negativeLabel,
    n2: String(s.votes.negative),
    write: invitationEcriture(s.author.displayName, s.canMessage, s.isAuthor),
    /**
     * LES SEGMENTS DE PROGRESSION. `GET /stories/:id` rend UNE story, pas la série
     * de son auteur : on n'en dessine donc qu'un, plein. La maquette en dessine
     * trois parce qu'elle illustre une série ; en fabriquer trois ici laisserait
     * croire qu'il y a deux stories de plus à faire défiler.
     */
    bars: ['100%'],
    /**
     * La barre de la story AFFICHÉE se remplit : il n'y en a qu'une, puisque
     * `GET /stories/:id` rend une story et non la série de son auteur.
     */
    barre: 'active',
    /** La clé de rejeu de la barre — voir `StoryReadView.cle`. */
    cle: s.id,
    align: 'center',
    /**
     * `backgroundUrl` EST RÉSOLU DEPUIS QUE LE SERVICE LE REND. Le commentaire
     * d'avant disait « toujours faux aujourd'hui : `backgroundUrl` n'est jamais
     * résolu » — c'était exact, et ça ne l'est plus : `feed.service.ts` le compose
     * maintenant sur les trois lectures, et `GET /media/*` sert les octets.
     */
    photo: s.backgroundUrl !== null,
    /**
     * ET L'EMPLACEMENT REÇOIT L'IMAGE, pas seulement le drapeau.
     *
     * `photo` ne faisait qu'allumer le HACHURAGE de la maquette — le motif qu'elle
     * emploie partout pour dire « ici il y a une image ». Une story publiée avec
     * une photo se relisait donc en rectangle rayé : composée, stockée, servie, et
     * jamais vue. Mesuré de bout en bout dans un seul navigateur, c'est ce cas qui
     * l'a montré.
     *
     * Sans photo, la valeur EST le hachurage, mot pour mot : l'écran rend alors
     * exactement ce que la maquette dessine. `HACHURAGE_PHOTO` vient de
     * `a14/data.ts` plutôt que d'être recopié — le composeur et le lecteur
     * peignent le même emplacement, et deux littéraux finiraient par diverger.
     */
    /**
     * ── LE CADRAGE VIENT DU COMPOSEUR, IL N'EST PAS RÉÉCRIT ICI ─────────────
     *
     * La valeur était `url("…")` toute nue : sans `center/cover no-repeat`, le
     * navigateur pose l'image à sa TAILLE NATURELLE et la répète. Une photo de
     * téléphone remplissait donc la carte d'un coin agrandi, et une petite image
     * s'y répétait en damier.
     *
     * `photoFondFor` est la fonction que le COMPOSEUR emploie pour le même
     * emplacement : on relit une story comme on l'a composée, sans deuxième
     * recette. `recadre: false` — « couvrir » — parce que la carte de lecture n'a
     * pas le bouton de recadrage de l'éditeur.
     */
    photoFond: photoFondFor(
      s.backgroundUrl === null ? null : urlMedia(s.backgroundUrl),
      false,
    ),
    /**
     * LES AVATARS DE CEUX QUI CONFIRMENT : aucune route ne les donne. Le serveur
     * rend le NOMBRE (`votes.positive`), jamais la liste. On laisse `null` — la
     * maquette n'affiche alors rien — plutôt que d'inventer des visages. Remonté.
     */
    confirmers: null,

    /**
     * ── LES DEUX APPARENCES DE VOTE, ÉCHANGÉES SELON LE VOTE ───────────────
     *
     * Le porteur : « selon le clic de l'utilisateur une icône check ou close
     * s'affiche sur le bouton cliqué ainsi que le background blanc. L'autre
     * bouton n'a donc plus de background ou d'icône affiché. »
     *
     * Les deux apparences sont CELLES DE LA PLANCHE : le fond blanc avec l'encre
     * `#0F5C48` et le compte en `#6FA893` (dessinés sur « Utile »), et le trait
     * `1.5px solid rgba(255,255,255,.7)` sans fond (dessiné sur « Pas utile »).
     * On ne fait que les attribuer au bon bouton.
     *
     * AUCUN DES DEUX N'EST BLANC tant qu'on n'a pas voté — voir le long
     * commentaire de `StoryReadView`.
     */
    ...apparencesDeVote(s.myReaction, s.votes.positiveKind, s.votes.negativeKind),

    storyId: s.id,
    typeStory: s.type,
    positiveKind: s.votes.positiveKind,
    negativeKind: s.votes.negativeKind,
    mine: s.myReaction,
    canMessage: s.canMessage,
    auteurHandle: s.author.handle,
    signet: s.bookmarked,
    expired: s.expired,
    isAuthor: s.isAuthor,
  };
}
