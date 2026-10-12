/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES PRISES DU LOT « RÉSEAU VIVANT » — CE QUE LES VINGT-CINQ PLANCHES        ║
 * ║ LISENT EN PLUS DE L'EN-TÊTE, DE LA GESTION ET DES ONGLETS DÉJÀ BRANCHÉS     ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur a relevé, onglet par onglet, ce qui restait DESSINÉ sur le réseau :
 * le bouton « Réseau automatique » montré à tout le monde, la bande
 * « Propriétaire du réseau » montrée à tout le monde, le composeur du fil, les
 * colonnes de droite du fil et des événements, la recherche et les filtres des
 * membres, l'onglet « À propos » et son édition, la vue d'ensemble de « Gérer ».
 *
 * Ces prises sont déclarées dans un fichier À PART plutôt qu'au bout de
 * `data.ts` — qui en compte déjà mille quatre cents lignes — mais elles font
 * partie du MÊME contrat : `A08TData` les reprend toutes, et c'est toujours
 * `useReseau` qui les remplit. Aucune n'est inventée par un cadre : chacune
 * répond à un nœud que la maquette dessine, et l'adaptation qui la lit est
 * nommée sur sa prise.
 *
 * ── LE FRONT PRÉVIENT, IL N'AUTORISE PAS (mémo §5) ──────────────────────────
 *
 * `equipe` et `etat` décident de ce qu'on MONTRE — un bouton « Gérer » à qui ne
 * peut pas gérer serait une invitation à un refus certain —, jamais de ce qu'on
 * PERMET : chaque geste part vers le serveur, qui tranche et dont le refus
 * s'affiche tel quel.
 */

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES ACTIONS DE L'EN-TÊTE — REJOINDRE, OPTIONS, GÉRER                        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Remplace le bouton "Réseau automatique" par Rejoindre pour les
 * nouveaux, et quand on est déjà dans le groupe c'est un bouton "Options"
 * dropdown qui va afficher sourdine et quitter le réseau […] Si c'est un
 * modérateur le bouton gérer à côté. »
 *
 * `etat` dit QUELLE porte le lecteur a devant lui — c'est la fiche du serveur
 * qui le décide (`myStatus`, `canJoin`, `visibility`), jamais un calcul d'ici :
 *
 *   · `passant`  — aucune adhésion, et le réseau se rejoint librement ;
 *   · `demande`  — aucune adhésion, et le réseau est « Sur demande » ;
 *   · `attente`  — une demande est partie, un modérateur doit l'accepter ;
 *   · `invite`   — une invitation attend d'être acceptée ;
 *   · `membre`   — adhésion active : le bouton devient « Options » ;
 *   · `ferme`    — ni rejoignable ni membre (banni, archivé, sur invitation) ;
 *   · `chargement` — la fiche n'est pas revenue : rien n'est montré.
 *
 * LA SOURDINE ET LE DÉPART SONT CONFIRMÉS. Le porteur : « Le bouton mettre le
 * groupe en sourdine ne demande pas confirmation. » `onSourdine` et `onQuitter`
 * n'envoient donc rien : ils OUVRENT la fenêtre de confirmation, que l'écran pose
 * une seule fois hors des deux cadres (leçon `ScreenFrames` + portail, déjà
 * mesurée sur la confirmation de retrait).
 */
export interface ActionsReseauView {
  readonly etat: 'chargement' | 'passant' | 'demande' | 'attente' | 'invite' | 'membre' | 'ferme';
  /** Propriétaire ou modérateur : « Gérer » paraît à côté d'« Options ». */
  readonly equipe: boolean;
  readonly hrefGerer: string;
  /** Un appel est en vol : les boutons s'éteignent plutôt que de partir deux fois. */
  readonly occupe: boolean;
  /**
   * Le lecteur n'est pas membre ACTIF : les onglets de contenu disparaissent et
   * seul « À propos » reste. Le porteur : « Quand on n'est pas encore membre d'un
   * réseau, uniquement afficher l'onglet À propos. » Le serveur refuse déjà ces
   * contenus (`403 NOT_A_MEMBER`) : montrer leurs onglets n'ouvrait que des
   * pages vides.
   */
  readonly ongletsFermes: boolean;
  /** La pastille à côté du nom, sur les planches de l'équipe : le rôle RÉEL. */
  readonly badge: string;
  readonly onRejoindre: () => void;
  /** `myMuted` du serveur : le libellé de l'entrée dit l'inverse de l'état. */
  readonly sourdineActive: boolean;
  readonly onSourdine: () => void;
  /**
   * « Quitter le réseau » n'a de sens que si le serveur le permet — `canLeave`
   * est faux pour un réseau de ville ou de pays (§2.1) et pour le propriétaire,
   * qui doit d'abord transférer. L'entrée disparaît alors plutôt que de mener à
   * un refus certain.
   */
  readonly peutQuitter: boolean;
  readonly onQuitter: () => void;
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES OUTILS DE L'ÉQUIPE — « Annonce · Épingler · Événement »                 ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Dessinés deux fois : la rangée « Outils du propriétaire » du fil et la bande
 * « Propriétaire du réseau » de l'onglet « Sujets ». Les trois étaient inertes.
 *
 *   · « Annonce »   — une DESTINATION : la planche « ADMIN · ANNONCE », qui
 *     existe et dont le formulaire est déjà branché (`useAnnonce`) ;
 *   · « Épingler »  — ouvre la fenêtre des sujets à épingler en tête (§2.3 :
 *     « épinglés en tête, 5 maximum ») ;
 *   · « Événement » — ouvre « Créer un événement » en fenêtre, sur ce réseau.
 */
export interface OutilsReseauView {
  readonly visibles: boolean;
  /** « Propriétaire du réseau » ou « Modération du réseau » — le rôle réel. */
  readonly libelle: string;
  /** « Outils du propriétaire » ou « Outils de modération ». */
  readonly titre: string;
  readonly hrefAnnonce: string;
  readonly onEpingler: () => void;
  readonly onEvenement: () => void;
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE COMPOSEUR DU FIL DU RÉSEAU                                               ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Composeur du fil ». Le champ était un `<div>`, les quatre
 * pastilles des `<span>`, « Publier » un bouton sans geste. Le contrat est celui
 * du composeur de l'accueil (`A01`), réduit à ce que la planche du réseau
 * dessine : le texte, le type, les images, l'envoi — avec `communityId`, qui
 * fait de la publication une publication DU RÉSEAU (§2.3, visible de ses
 * membres seuls).
 *
 * ⚠ LE SONDAGE ET LE GUIDE NE SONT PAS REPRIS ICI. Leurs deux icônes ouvrent,
 * sur l'accueil, deux fenêtres (A01S, A01G) dont l'état vit dans la page de
 * l'accueil et nulle part ailleurs. Les monter ici demanderait de déplacer cet
 * état dans un crochet partagé — un lot à part. REMONTÉ : les deux icônes
 * restent visibles, et un clic dit pourquoi elles ne servent pas encore ici.
 */
export interface ComposeurReseauView {
  readonly texte: string;
  readonly onTexte: (event: { readonly target: { readonly value: string } }) => void;
  readonly types: readonly {
    readonly label: string;
    readonly bg: string;
    readonly fg: string;
    readonly dot: string;
    readonly onPick: () => void;
  }[];
  readonly onAjouterImage: () => void;
  /** « 2 images » — vide quand aucune n'est jointe. */
  readonly images: string;
  readonly onIndisponible: () => void;
  readonly bloque: boolean;
  readonly onPublier: () => void;
  /**
   * La dernière publication attend la validation d'un modérateur
   * (« Validation des nouvelles publications »). L'écran le dit à l'auteur,
   * qui sinon croirait sa publication perdue.
   */
  readonly enAttente: boolean;
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES COLONNES DE DROITE — CE QU'ELLES PEIGNAIENT EN DUR                     ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « la section de droite aussi statique » (fil), « les sections de
 * droite sont statiques » (événements). Relevé : « PROCHAIN ÉVÉNEMENT · 01 AOÛT
 * · Fête de l'indépendance », « SUJETS ÉPINGLÉS · Renouveler son passeport »,
 * « CE MOIS-CI · 3 · 132 inscrits » et la pastille « Pays » — tout était écrit
 * dans la maquette et montré sur TOUS les réseaux.
 *
 * Toutes ces données existent déjà dans les réponses : `GET /events?communityId=`
 * pour l'événement et le mois, `pinned` de la fiche pour les sujets épinglés.
 * Aucune route n'a été ajoutée pour elles.
 */
export interface ColonneReseauView {
  readonly prochain: {
    readonly numero: string;
    readonly mois: string;
    readonly titre: string;
    readonly sous: string;
    readonly href: string;
  } | null;
  readonly epingles: readonly { readonly titre: string; readonly href: string }[];
  /** Les événements du réseau dans le mois civil en cours, et leurs inscrits. */
  readonly moisNombre: string;
  readonly moisSous: string;
}

/**
 * LA RECHERCHE ET LES FILTRES DE L'ONGLET « MEMBRES ».
 *
 * Le porteur : « la recherche ne marche pas et on a un filtre Lyon je ne
 * comprends pas. Aussi les filtres. » Le champ était un `<div>`, les trois
 * pastilles des `<span>`. `memberListQuerySchema` porte `q` et `role` : le champ
 * nourrit `q` (pseudo OU nom affiché, voir le service), « Tous » et
 * « Modérateurs » choisissent `role`.
 *
 * ⚠ « LYON » EST RETIRÉ, et c'est la demande du porteur : c'était le nom de
 * ville de la maquette, écrit en dur, sans aucun filtre derrière.
 */
export interface FiltreMembresView {
  readonly q: string;
  readonly onQ: (event: { readonly target: { readonly value: string } }) => void;
  readonly moderateurs: boolean;
  readonly onTous: () => void;
  readonly onModerateurs: () => void;
  /** Les deux pastilles, dans les couleurs que la maquette donne à l'active. */
  readonly tousBg: string;
  readonly tousFg: string;
  readonly tousBd: string;
  readonly modBg: string;
  readonly modFg: string;
  readonly modBd: string;
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ L'ONGLET « À PROPOS » — SES RÈGLES, SON ÉQUIPE, ET SON ÉDITION             ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « À propos vu modérateur : les champs ne sont pas modifiables et
 * l'option Modifier n'affiche pas les champs. » Relevé sur la planche : la
 * description montrait le texte de la maquette, les trois règles et l'équipe
 * (« Aïcha Diop, Marc Koudou, Sandra M. ») étaient écrites en dur, et les deux
 * « Modifier » ne menaient nulle part.
 *
 * Les règles et l'équipe viennent maintenant de la fiche (`rules`, `team`),
 * l'édition écrit par `PATCH /communities/:id` — description et règles, que le
 * service ouvre aux modérateurs.
 */
export interface AProposReseauView {
  readonly regles: readonly { readonly n: string; readonly texte: string }[];
  readonly equipe: readonly {
    readonly i: string;
    readonly bg: string;
    readonly nom: string;
    readonly role: string;
  }[];
  /** `?onglet=a-propos-edition` — la planche d'édition. */
  readonly hrefModifier: string;
  /** L'équipe du réseau : les deux « Modifier » paraissent. */
  readonly modifiable: boolean;
  readonly edition: EditionAProposView;
}

export interface EditionAProposView {
  readonly description: string;
  readonly onDescription: (event: { readonly target: { readonly value: string } }) => void;
  readonly longueur: number;
  readonly descriptionMax: number;
  readonly regles: readonly {
    readonly n: string;
    readonly texte: string;
    readonly onTexte: (event: { readonly target: { readonly value: string } }) => void;
    readonly onRetirer: () => void;
  }[];
  readonly reglesMax: number;
  /** « 4 SUR 8 » — composé ici, la planche l'écrit en capitales. */
  readonly reglesCompte: string;
  readonly onAjouterRegle: () => void;
  readonly peutAjouter: boolean;
  readonly modifie: boolean;
  /**
   * « Prévenir les membres du changement de règles » — la case que la barre
   * d'enregistrement dessine (cochée). Cochée, l'enregistrement publie une
   * ANNONCE du réseau avec les nouvelles règles : c'est le seul canal qui
   * notifie tous les membres (§2.3), et il compte dans les deux annonces par
   * semaine — le refus `ANNOUNCEMENT_LIMIT` s'affiche alors, les règles étant
   * déjà enregistrées.
   */
  readonly prevenir: boolean;
  readonly onPrevenir: () => void;
  readonly occupe: boolean;
  readonly onEnregistrer: () => void;
  readonly onAnnuler: () => void;
  /** Un réseau automatique : catégorie et visibilité sont fixées (§2.1). */
  readonly automatique: boolean;
  readonly categorie: string;
  readonly visibilite: string;
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « GÉRER » — SES SECTIONS, SES PARAMÈTRES, ET LA FILE DE VALIDATION         ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Vue d'ensemble : la page est dessinée et les boutons ou options
 * ne marchent pas. Je parle de la liste des demandes d'adhésion (3 ou plus et un
 * voir plus qui va maintenant dans son onglet), l'acceptation ou le rejet, liste
 * des signalements (3 ou plus et un voir plus qui va maintenant dans son
 * onglet), voir le signalement et les paramètres et leur réel application dans
 * le réseau. »
 *
 * `section` est l'entrée du rail de gestion (et de la rangée de pastilles du
 * téléphone) — « Vue d'ensemble », « Demandes d'adhésion », « Signalements »,
 * « Paramètres ». Dans la vue d'ensemble, les deux listes s'arrêtent à TROIS
 * rangées et « Voir plus » ouvre leur section, où elles sont entières.
 */
export type SectionGestion = 'ensemble' | 'demandes' | 'signalements' | 'parametres';

export interface PilotageReseauView {
  readonly section: SectionGestion;
  readonly hrefSection: (section: SectionGestion) => string;
  /** Les couleurs de l'entrée active du rail, telles que la maquette les dessine. */
  readonly railBg: (section: SectionGestion) => string;
  readonly railFg: (section: SectionGestion) => string;
  readonly railPoids: (section: SectionGestion) => string;
  readonly voirPlusDemandes: boolean;
  readonly voirPlusSignalements: boolean;
  /** Les rangs affichés : trois dans la vue d'ensemble, tous dans leur section. */
  readonly bornerDemandes: number;
  readonly bornerSignalements: number;
  readonly montrer: (carte: 'tuiles' | 'demandes' | 'signalements' | 'attente' | 'parametres') => boolean;
  /**
   * « +34 ce mois » et « 61 % actifs sur 30 jours » — dessinés en dur. Ils
   * viennent maintenant de `stats` de la fiche (équipe seulement) ; « — » tant
   * qu'elle ne les porte pas, jamais un nombre inventé.
   */
  readonly tuiles: { readonly nouveaux: string; readonly actifs: string };

  // ── « Voir » un signalement ──────────────────────────────────────────────
  readonly onVoirSignalement: (subjectType: string, subjectId: string) => void;

  // ── La file de validation ────────────────────────────────────────────────
  readonly enAttente: readonly {
    readonly postId: string;
    readonly i: string;
    readonly bg: string;
    readonly nom: string;
    readonly sous: string;
    readonly extrait: string;
  }[];
  readonly onValider: (postId: string) => void;
  readonly onRefuserPublication: (postId: string) => void;

  // ── Les trois interrupteurs et la visibilité ─────────────────────────────
  readonly parametres: {
    readonly validation: boolean;
    readonly sondages: boolean;
    readonly album: boolean;
    readonly onValidation: () => void;
    readonly onSondages: () => void;
    readonly onAlbum: () => void;
    /** « Public », « Sur demande », « Privé ». */
    readonly visibilite: string;
    readonly visibiliteSous: string;
    /**
     * Un réseau automatique est toujours public (§2.1), et seul le
     * PROPRIÉTAIRE change la visibilité d'un réseau d'intérêt (le service le
     * tient : `assertOwner` sur les champs fondateurs).
     */
    readonly visibiliteFixe: boolean;
    /** La valeur du serveur — `PUBLIC`, `ON_REQUEST`, `INVITE_ONLY`. */
    readonly visibiliteValeur: string;
    readonly visibilites: readonly { readonly valeur: string; readonly libelle: string }[];
    readonly onVisibilite: (event: { readonly target: { readonly value: string } }) => void;
    readonly occupe: boolean;
  };
}

/** Les couleurs d'un interrupteur dessiné, relevées sur la planche « Gérer ». */
export function interrupteur(on: boolean): {
  readonly piste: string;
  readonly bouton: string;
} {
  return on ? { piste: '#16785E', bouton: 'flex-end' } : { piste: '#DDE3E0', bouton: 'flex-start' };
}

export const actionsVides: ActionsReseauView = {
  etat: 'chargement',
  equipe: false,
  hrefGerer: '?onglet=gerer',
  occupe: true,
  ongletsFermes: false,
  badge: '',
  onRejoindre: () => {},
  sourdineActive: false,
  onSourdine: () => {},
  peutQuitter: false,
  onQuitter: () => {},
};

export const outilsVides: OutilsReseauView = {
  visibles: false,
  libelle: '',
  titre: '',
  hrefAnnonce: '?onglet=annonce',
  onEpingler: () => {},
  onEvenement: () => {},
};

export const composeurVide: ComposeurReseauView = {
  texte: '',
  onTexte: () => {},
  types: [],
  onAjouterImage: () => {},
  images: '',
  onIndisponible: () => {},
  bloque: true,
  onPublier: () => {},
  enAttente: false,
};

export const colonneVide: ColonneReseauView = {
  prochain: null,
  epingles: [],
  moisNombre: '—',
  moisSous: '',
};

export const filtreMembresVide: FiltreMembresView = {
  q: '',
  onQ: () => {},
  moderateurs: false,
  onTous: () => {},
  onModerateurs: () => {},
  tousBg: '#16785E',
  tousFg: '#fff',
  tousBd: '#16785E',
  modBg: '#fff',
  modFg: '#16211D',
  modBd: '#E6EBE9',
};

export const editionVide: EditionAProposView = {
  description: '',
  onDescription: () => {},
  longueur: 0,
  descriptionMax: 500,
  regles: [],
  reglesMax: 8,
  reglesCompte: '0 SUR 8',
  onAjouterRegle: () => {},
  peutAjouter: false,
  modifie: false,
  prevenir: true,
  onPrevenir: () => {},
  occupe: true,
  onEnregistrer: () => {},
  onAnnuler: () => {},
  automatique: false,
  categorie: '',
  visibilite: '',
};

export const aproposVide: AProposReseauView = {
  regles: [],
  equipe: [],
  hrefModifier: '?onglet=a-propos-edition',
  modifiable: false,
  edition: editionVide,
};

export const pilotageVide: PilotageReseauView = {
  section: 'ensemble',
  hrefSection: (section) => `?onglet=gerer&section=${section}`,
  railBg: () => 'transparent',
  railFg: () => '#16211D',
  railPoids: () => '500',
  voirPlusDemandes: false,
  voirPlusSignalements: false,
  bornerDemandes: 3,
  bornerSignalements: 3,
  montrer: () => false,
  tuiles: { nouveaux: '', actifs: '—' },
  onVoirSignalement: () => {},
  enAttente: [],
  onValider: () => {},
  onRefuserPublication: () => {},
  parametres: {
    validation: false,
    sondages: true,
    album: true,
    onValidation: () => {},
    onSondages: () => {},
    onAlbum: () => {},
    visibilite: '',
    visibiliteSous: '',
    visibiliteFixe: true,
    visibiliteValeur: 'PUBLIC',
    visibilites: [],
    onVisibilite: () => {},
    occupe: true,
  },
};

/**
 * LES PHRASES D'ÉTAT VIDE DES LISTES, posées DANS les cadres (`EtatVide`).
 *
 * Elles disent laquelle des vues est vide quand l'onglet en a plusieurs :
 * « aucun événement passé » sous « Passés » ne doit pas laisser croire que le
 * réseau n'a jamais rien organisé. C'est la grammaire des bandes que
 * `reseau-screen.tsx` posait hors du cadre, et qu'elles remplacent.
 */
export interface VidesReseauView {
  readonly fil: string;
  readonly evenements: string;
  readonly membres: string;
  readonly album: string;
}

export const videsVides: VidesReseauView = { fil: '', evenements: '', membres: '', album: '' };

/** L'onglet « Sujets » de A08 : la liste vide et le geste « Nouveau sujet ». */
export interface SujetsReseauView {
  readonly vide: string;
  readonly nouveauVisible: boolean;
  readonly onNouveau: () => void;
}

export const sujetsVides: SujetsReseauView = { vide: '', nouveauVisible: false, onNouveau: () => {} };
