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
  /**
   * L'ADRESSE DU PROFIL PUBLIC — `/@handle`, ou absente.
   *
   * Le porteur : « ajoute l'accès au profil public d'un utilisateur […] partout
   * où le nom est affiché ». Les noms dessinés dans les cadres étaient des
   * `<span>` et aucun ne menait au profil.
   *
   * FACULTATIVE : le cadre ne pose le lien que si la ligne porte une adresse.
   * Sans elle, le nom reste nu — exactement le dessin d'avant.
   */
  readonly profil?: string;
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
  /**
   * ╔════════════════════════════════════════════════════════════════════════╗
   * ║ LES DEUX BOUTONS DE VOTE — ILS N'ÉTAIENT PAS CLIQUABLES               ║
   * ╚════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Les boutons utile et pas utile permettent à l'utilisateur de
   * voter donc ils doivent être cliquables. Donc selon le clic de l'utilisateur
   * une icône check ou close s'affiche sur le bouton cliqué ainsi que le
   * background blanc. L'autre bouton n'a donc plus de background ou d'icône
   * affiché. Juste le texte et le nombre. »
   *
   * MESURÉ avant : zéro `<button>` dans A13. Les deux étaient des `<span>`.
   *
   * ── LES DEUX APPARENCES SONT DESSINÉES, ON NE FAIT QUE LES ÉCHANGER ──────
   *
   * La planche dessine DÉJÀ les deux états, un sur chaque bouton : « Utile » en
   * fond blanc avec son encre `#0F5C48` — l'état RETENU — et « Pas utile » en
   * trait `1.5px solid rgba(255,255,255,.7)` sans fond — l'état NON RETENU. Rien
   * n'est inventé : ces valeurs changent simplement de bouton selon le vote.
   *
   * ── TANT QU'ON N'A PAS VOTÉ, AUCUN DES DEUX N'EST BLANC ─────────────────
   *
   * C'est le seul écart avec la planche, et il est voulu : elle montre « Utile »
   * en blanc, c'est-à-dire l'écran d'un membre QUI A DÉJÀ VOTÉ utile. Le laisser
   * tel quel ferait croire à chacun qu'il a voté avant d'avoir cliqué.
   */
  readonly voteUtileBg: string;
  readonly voteUtileFg: string;
  readonly voteUtileBd: string;
  readonly voteUtileIcone: boolean;
  readonly votePasUtileBg: string;
  readonly votePasUtileFg: string;
  readonly votePasUtileBd: string;
  readonly votePasUtileIcone: boolean;
  /** Le compte, dans la teinte qui va avec l'état du bouton. */
  readonly voteUtileCompteFg: string;
  readonly votePasUtileCompteFg: string;
  readonly onVoteUtile: () => void;
  readonly onVotePasUtile: () => void;

  /**
   * ╔════════════════════════════════════════════════════════════════════════╗
   * ║ ÉCRIRE À L'AUTEUR — « implémente l'envoi de message avec l'input »     ║
   * ╚════════════════════════════════════════════════════════════════════════╝
   *
   * La planche dessine « Écrire à Awa… » dans un `<span>` : une invite, pas un
   * champ. Il devient un vrai `<input>`, et la touche Entrée envoie — c'est le
   * geste que la forme appelle, et la planche ne dessine aucun bouton d'envoi.
   *
   * `messageBloque` : pendant l'envoi, et quand l'auteur n'accepte pas les
   * messages (`canMessage`, servi par le détail). Un champ qu'on peut remplir
   * pour rien est pire qu'un champ grisé.
   */
  readonly messageTexte: string;
  readonly onMessageTexte: (event: { target: { value: string } }) => void;
  readonly onMessageTouche: (event: { key: string }) => void;
  readonly messageBloque: boolean;
  /**
   * ── LE BOUTON D'ENVOI, FLOTTANT ──────────────────────────────────────────
   *
   * Le porteur : « dès que l'input est focus il faut afficher un bouton d'icône
   * d'envoi rounded blanc flottant dans le coin droit de l'input ».
   *
   * Visible quand le champ est ACTIF ou DÉJÀ REMPLI : un champ qu'on a rempli
   * puis quitté doit garder son bouton, sinon le texte reste sans issue.
   */
  readonly messageEnvoiVisible: boolean;
  readonly onMessageFocus: () => void;
  readonly onMessageBlur: () => void;
  readonly onMessageEnvoyer: () => void;

  /**
   * ── LE SIGNET ────────────────────────────────────────────────────────────
   *
   * « Le bouton de bookmark permet d'enregistrer la stories. » Il était un
   * `<span>`. `signetFill` remplit le tracé quand la story est gardée — c'est
   * ainsi qu'un signet dit « plein » partout —, et `signetNom` dit l'ÉTAT, parce
   * que le même bouton pose et retire.
   */
  readonly signetActif: boolean;
  readonly signetNom: string;
  readonly signetFill: string;
  readonly onSignet: () => void;
  readonly write: string;
  /** Les segments de progression, en largeurs déjà calculées. */
  readonly bars: readonly string[];
  /**
   * `'active'` quand la barre doit se remplir, chaîne vide sinon.
   *
   * Le porteur : « La barre de progression doit progresser pendant 15 s ». Elle
   * était peinte pleine et immobile — deux segments dessinés, aucun minuteur,
   * mesuré. Le repère déclenche `dp-story-progress` (`packages/ui/src/styles.css`),
   * et un minuteur de même durée passe à la story suivante.
   */
  readonly barre: string;
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ CE QUI FAIT REJOUER LA BARRE — ET SEULEMENT ELLE                        ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * L'identifiant de la story affichée. Il ne s'affiche nulle part : il sert de
   * `key` React à la barre de progression.
   *
   * POURQUOI. Une animation CSS ne rejoue que si le nœud est RECRÉÉ. Le cadre
   * entier était donc remonté à chaque changement de story — et c'est ce
   * remontage qui empêchait le fond de se fondre dans le suivant : on ne
   * transitionne pas la couleur d'un nœud qui vient de naître. En posant la clé
   * sur la seule barre, elle repart de zéro quand on change de story, et tout le
   * reste du cadre — le fond compris — reste en place et peut se fondre.
   */
  readonly cle: string;
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LA BARRE S'ARRÊTE PENDANT QU'ON ÉCRIT                                   ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Le focus dans l'input de message doit stopper temporairement
   * la progress bar. » Et c'est plus qu'un détail de mouvement : la barre pleine
   * fait PASSER à la story suivante au bout de quinze secondes. Sans cette pause,
   * un message à moitié écrit disparaissait sous les doigts.
   *
   * `'oui'` pendant que le champ a le focus, chaîne vide sinon. La valeur est un
   * MOT et non un booléen parce qu'elle devient un attribut HTML, que la feuille
   * de style lit (`[data-story-pause="oui"]`) : un `false` s'écrirait « false »,
   * qui est une chaîne non vide, et mettrait la barre en pause pour toujours.
   */
  readonly barrePause: string;
  /**
   * FERMER LA STORY. La croix de l'en-tête était un `<span>` dans les deux
   * planches — aucun geste, aucun nom accessible, ni cliquable ni atteignable au
   * clavier. Le porteur : « Le bouton close ne fonctionne pas ? »
   */
  readonly onFermer: () => void;
  readonly align: string;
  readonly photo: boolean;
  /**
   * LE FOND DE L'EMPLACEMENT PHOTO — le hachurage de la maquette, ou l'image.
   *
   * `repeating-linear-gradient(135deg,#46564F …)` est le motif que cette maquette
   * emploie PARTOUT pour dire « ici il y a une image ». Sur A13 il était rendu
   * tel quel, donc une story publiée avec une photo se relisait en HACHURAGE :
   * le membre composait son image, le serveur la stockait et la servait, et
   * l'écran de lecture montrait un rectangle rayé.
   *
   * La valeur par défaut EST le hachurage, mot pour mot : sans photo, l'écran
   * rend exactement ce que la maquette dessine. C'est le même mécanisme que la
   * variante photo du composeur (`photoFond` de `a14/data.ts`), et c'est
   * délibérément le même — deux façons de peindre le même emplacement
   * divergeraient.
   */
  readonly photoFond: string;
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
  /**
   * LE FOND DE L'ÉCRAN — `#101A17` sur une page entière, `transparent` en fenêtre.
   *
   * Le porteur : « Le background n'est pas transparent […] il doit couvrir toute
   * la page et être transparent pour voir le contenu derrière. » L'aplat de la
   * planche est juste pour une page ; posé par-dessus le fil, il recouvrait le
   * voile et donc la page de dessous.
   */
  fondEcran: string;
  storyMain: readonly StoryReadView[];
  st: StoryReadView;
  /**
   * ── LA NAVIGATION ENTRE STORIES ──────────────────────────────────────────
   *
   * Le porteur : « Je parle des boutons next […] le clic sur les écrans gauche ou
   * droite ou sur les boutons next ou preview doivent animer parfaitement les
   * stories et afficher celui sélectionné. »
   *
   * MESURÉ avant : `0` bouton et `0` lien dans tout l'écran. Les deux chevrons de
   * 52 px et les deux panneaux de voisins — à `opacity: .55`, comme la planche
   * les dessine — existaient en `<span>` et `<div>`.
   *
   * Les voisins viennent du RUBAN (`GET /stories`), pas du détail : celui-ci ne
   * les porte pas. Voir `screens/story/use-voisins.ts`.
   */
  onPrecedent: () => void;
  onSuivant: () => void;
  /** Le nom accessible du bouton : « Story de Aïcha D. », ou son absence. */
  precedentNom: string;
  suivantNom: string;
  /**
   * CE QUE LES DEUX CARTES MONTRENT — « les cartes left et right doivent afficher
   * le contenu des story qui suivent dynamiquement selon le filtre appliqué ».
   *
   * Elles étaient deux rectangles `#0F5C48` écrits en dur, avec « Aïcha D. » et
   * « Kofi B. » en exemple. Le fond, le texte et l'auteur viennent du ruban, filtré
   * sur le TYPE de la story lue : en lisant un conseil, on voisine entre conseils.
   */
  precedentFond: string;
  precedentTexte: string;
  precedentAuteur: string;
  /**
   * LA VIGNETTE EST LA CARTE EN PETIT — « c'est le composant du story qu'il faut
   * afficher en taille petite ». Elle montrait une couleur et une ligne au fond ;
   * elle porte maintenant la MÊME composition : pastille, étiquette, corps.
   */
  precedentPastille: string;
  precedentEtiquette: string;
  suivantFond: string;
  suivantTexte: string;
  suivantAuteur: string;
  suivantPastille: string;
  suivantEtiquette: string;
}
