import {
  SELF_CHECKIN_WINDOW_MS,
  USAGE_METRIC_LIMIT_KEYS,
  type CalendarResponse,
  type EventCardResponse,
  type EventDetailResponse,
  type EventsResponse,
  type MySubscriptionResponse,
  type OrganizerAttendeesResponse,
  type PublicAttendeesResponse,
} from '@app/shared';
import { fondAvatar } from '@/lib/avatar';

/**
 * Données des écrans E01 à E04, et ce que la maquette `07 Agenda.dc.html` en dit.
 *
 * ── CE FICHIER A CHANGÉ DE NATURE, ET IL FAUT SAVOIR POURQUOI ───────────────
 *
 * Il disait, et c'était exact : « IL N'Y EN A AUCUNE ». Cette maquette n'emploie
 * pas le dialecte — son `renderVals()` rend `{}`, zéro `{{ … }}`, zéro `<sc-for>`,
 * comptés — et ses huit cadres recevaient donc `_props` : ils IGNORAIENT leurs
 * données, faute d'avoir où les mettre.
 *
 * Il annonçait aussi la suite : « c'est ici que les champs arriveront quand ces
 * écrans seront branchés sur `apps/api/src/modules/events` ». C'est fait, et le
 * JSX transcodé n'a PAS bougé : la prise a été DÉCLARÉE dans
 * `tools/screens/07-agenda.mjs`, sous la clé `donnees`.
 *
 * ── LA RÉPARTITION, QUI EST LA MOITIÉ DU CONTRAT ────────────────────────────
 *
 * La FORME est transcodée de la maquette ; la DONNÉE et le COMPORTEMENT vivent
 * ici. Ce fichier porte les TYPES et les CONSTRUCTEURS — des fonctions pures, de
 * la charge de l'API vers ce que les cadres lisent — et `appels.ts` ne porte que
 * les appels. La séparation n'est pas cosmétique : elle rend les règles de cet
 * écran éprouvables sans réseau, et `agenda.test.ts` s'en sert pour vérifier que
 * la case « Présent·e » se décide sur `checkedIn` et sur rien d'autre.
 *
 * ── LES COULEURS QUI SONT DES DONNÉES VIENNENT DE LA MAQUETTE ───────────────
 *
 * Le fond `#E3F0EB` du jour sélectionné, le `transparent` des autres, le point
 * vert `#16785E` « près de moi » et le terre cuite `#E0733A` « j'y participe », les
 * deux paires des boutons de RSVP, la palette des avatars : toutes sont RELEVÉES
 * sur les planches de `07 Agenda`. Aucune n'est assombrie — le garde-fou de
 * contraste du dépôt tient à 16/24, et c'est une décision assumée du porteur.
 *
 * ── LES FUSEAUX, ET POURQUOI ILS SONT PARTOUT DANS CE FICHIER ───────────────
 *
 * Un agenda sans fuseau est un agenda faux. 09 §3.5 lit un événement « dans le
 * fuseau de sa ville » : un événement de 23 h se rangerait un jour trop tôt ou
 * trop tard selon la machine qui l'affiche. Le serveur l'a déjà résolu — chaque
 * fiche porte son `timeZone` et son `localDate`, et le calendrier annonce le sien
 * dans `meta.timeZone`. Ce fichier ne RECALCULE donc jamais un jour : il formate
 * dans le fuseau qu'on lui donne.
 */

// ─── Ce que les cadres lisent ────────────────────────────────────────────────

/** L'identité de la barre haute. Le niveau n'y est pas : la maquette ne l'écrit pas. */
export interface MoiAgenda {
  /**
   * LE FOND DU ROND D'AVATAR : la photo du membre, ou rien.
   *
   * FACULTATIVE : seul le module Compte la remplit aujourd'hui, parce que lui seul
   * lit `GET /me`. Absente, le cadre reprend l'aplat de la maquette et écrit les
   * initiales — exactement ce qu'il faisait avant. Le jour où ce module lira
   * `avatarUrl`, il suffira de la poser.
   */
  readonly photo?: string | null;
  readonly initiales: string;
  readonly prenom: string;
}

/**
 * Une ligne du calendrier vertical (§3.5).
 *
 * Les trois variantes de la maquette sont dans ces champs : jour vide (atténué,
 * sans point), jour avec événements (point vert), jour sélectionné (fond vert
 * doux, numéro vert foncé, titre en gras) — et le point terre cuite quand j'y
 * participe, qui l'emporte sur le vert parce que §3.5 le veut distinct.
 */
/**
 * LE FILTRE DE LA PAGE (09 §3.5) : « Tous · Mes participations · Mes
 * organisations ». Les mots du serveur (`scope`), pas ceux de l'écran.
 */
export type ScopeAgenda = 'all' | 'mine' | 'organized';

export const SCOPES_AGENDA: readonly ScopeAgenda[] = ['all', 'mine', 'organized'];

/** Le filtre demandé par l'URL, ou « tous » si le paramètre est absent ou inconnu. */
export function scopeDeUrl(valeur: string | null): ScopeAgenda {
  return (SCOPES_AGENDA as readonly (string | null)[]).includes(valeur)
    ? (valeur as ScopeAgenda)
    : 'all';
}

/**
 * L'adresse d'un état de l'agenda. Tout vit dans l'URL — jour, mois, filtre —
 * pour qu'un jour, un mois et un filtre se partagent, se rechargent et se
 * retrouvent avec le bouton Retour.
 */
export function hrefAgenda(etat: {
  readonly jour?: string | null;
  readonly mois?: string | null;
  readonly scope?: ScopeAgenda;
}): string {
  const requete = new URLSearchParams();
  if (etat.jour !== undefined && etat.jour !== null) requete.set('jour', etat.jour);
  if (etat.mois !== undefined && etat.mois !== null) requete.set('mois', etat.mois);
  if (etat.scope !== undefined && etat.scope !== 'all') requete.set('scope', etat.scope);
  const texte = requete.toString();
  return texte === '' ? '/agenda' : `/agenda?${texte}`;
}

export interface JourCalendrier {
  /** La destination du jour : `/agenda?jour=…`. */
  readonly href: string;
  readonly abbr: string;
  readonly numero: string;
  readonly titre: string;
  readonly fond: string;
  readonly opacite: string;
  readonly couleur: string;
  readonly poids: string;
  /** `null` pour un jour sans événement : la ligne ne dessine alors aucun point. */
  readonly point: string | null;
}

export interface SemaineCalendrier {
  readonly numero: number;
  /** Le remplissage de l'intitulé : la maquette en écrit DEUX, selon le rang. */
  readonly marge: string;
  readonly jours: readonly JourCalendrier[];
}

/** Le quota mensuel d'événements (§3.1), de `GET /me/subscription`. */
export interface QuotaEvenements {
  readonly utilise: number;
  /** Un nombre, ou « illimité » en Premium — jamais « null » affiché à l'écran. */
  readonly plafond: string;
  /** « 1er novembre » : la remise à zéro, de `usage.resetsAt`. */
  readonly reset: string;
  /** Tout est gratuit (réglage serveur) : le compteur et « Découvrir Premium » sont masqués. */
  readonly gratuit: boolean;
}

/** Le panneau de gauche, dessiné à l'identique sur les quatre cadres d'ordinateur. */
export interface PanneauAgenda {
  /** Les flèches du mois (09 §3.5 : « Navigation par mois »). */
  readonly precedent: string;
  readonly suivant: string;
  readonly mois: string;
  readonly aujourdhui: string;
  readonly totalMois: number;
  readonly semaines: readonly SemaineCalendrier[];
  readonly quota: QuotaEvenements;
}

/** Une carte d'événement du jour (E01), aux deux largeurs. */
export interface CarteEvenement {
  /**
   * L'ADRESSE DU DÉTAIL, ou absente.
   *
   * Le porteur, après avoir vu les gestes revenir sur la carte du fil : « c'est
   * bon aussi pour les autres ? » Non : mesuré au navigateur, ces cartes ne
   * menaient nulle part, même sur leur propre page. Elles portent maintenant
   * leur adresse, et `CadreCliquable` rend un `<div>` quand elle manque — ce qui
   * est le cas des cartes DESSINÉES par la maquette, qui n'ont pas d'identifiant.
   */
  readonly href?: string;

  readonly fondDate: string;
  readonly numero: string;
  readonly abbr: string;
  readonly jyVais: boolean;
  readonly type: string;
  readonly reseau: string | null;
  readonly titre: string;
  readonly lieu: string;
  readonly lieuCourt: string;
  readonly heure: string;
  readonly participants: number;
  /** La marque du pluriel : « 1 participant », « 27 participants ». */
  readonly pluriel: string;
}

/** Une pastille de la bande de dates du mobile (§3.5). */
export interface JourBande {
  /** La destination de la pastille : `/agenda?jour=…`. */
  readonly href: string;
  readonly abbr: string;
  readonly numero: string;
  readonly fond: string;
  readonly bord: string;
  readonly couleur: string;
  readonly opacite: string;
  /** Jamais nul : la maquette dessine un point `transparent` sur un jour vide. */
  readonly point: string;
}

/** Une ligne de la carte « CE WEEK-END ». */
export interface LigneWeekEnd {
  readonly titre: string;
  readonly quand: string;
}

/** Une pastille de filtre : sa destination et ses trois couleurs (fond, encre, liseré). */
export interface FiltreAgenda {
  readonly href: string;
  readonly bg: string;
  readonly fg: string;
  readonly bd: string;
}

export interface FiltresAgenda {
  readonly tous: FiltreAgenda;
  readonly mes: FiltreAgenda;
  readonly organises: FiltreAgenda;
}

export interface E01Data {
  /** « Voir la fiche ville » : `/villes/:slug`, ou `null` si la ville n'a pas de fiche. */
  readonly villeHref: string | null;
  /** Ce que dit la page quand le jour est vide, selon le filtre. */
  readonly videTexte: string;
  readonly filtres: FiltresAgenda;
  readonly moi: MoiAgenda;
  readonly panneau: PanneauAgenda;
  readonly jour: string;
  readonly nombre: number;
  readonly pluriel: string;
  readonly evenements: readonly CarteEvenement[];
  readonly weekEnd: readonly LigneWeekEnd[];
  readonly ville: string;
  readonly bande: readonly JourBande[];
}

/** L'état d'un des trois boutons de RSVP : les deux paires que la maquette dessine. */
export interface EtatBouton {
  readonly fond: string;
  readonly texte: string;
}

export interface ChoixRsvp {
  readonly vient: EtatBouton;
  readonly peutEtre: EtatBouton;
  readonly refuse: EtatBouton;
}

export interface AvatarEmpile {
  readonly fond: string;
  readonly initiales: string;
}

/**
 * LES GESTES DE E02, tels que la fiche les appelle (09 §3.2, §3.3, §3.4).
 *
 * Tous passent par le serveur, qui décide : le front n'allume ni n'éteint rien
 * d'après le niveau ou l'horloge. `occupe` éteint les boutons pendant un appel
 * (jamais deux fois le même RSVP), `retour` porte la phrase du dernier refus ou
 * succès (en français, celle du serveur).
 */
export interface ActionsEvenement {
  readonly occupe: boolean;
  readonly retour: string;
  readonly onRsvp: (statut: 'GOING' | 'MAYBE' | 'DECLINED') => void;
  readonly onRetirer: () => void;
  readonly onPresent: () => void;
  readonly onSignaler: () => void;
  readonly onAnnuler: () => void;
  readonly onModifier: () => void;
  /** Vers la feuille de présence : `/agenda/:id/presence`. */
  readonly presenceHref: string;
}

const AUCUN_GESTE = (): void => {};

/** Les gestes d'un squelette : tous sans effet. */
export const actionsVides: ActionsEvenement = {
  occupe: false,
  retour: '',
  onRsvp: AUCUN_GESTE,
  onRetirer: AUCUN_GESTE,
  onPresent: AUCUN_GESTE,
  onSignaler: AUCUN_GESTE,
  onAnnuler: AUCUN_GESTE,
  onModifier: AUCUN_GESTE,
  presenceHref: '#',
};

export interface FicheEvenement {
  readonly id: string;
  /** Posé quand l'événement est annulé : le motif (facultatif) et le jour. */
  readonly annule: { readonly motif: string | null; readonly quand: string } | null;
  /** Mon RSVP (`GOING`, `MAYBE`, `DECLINED`, `WAITLIST`) ou `null`. */
  readonly monStatut: 'GOING' | 'MAYBE' | 'DECLINED' | 'WAITLIST' | null;
  /** Vrai une fois l'événement terminé ou commencé : plus de RSVP, mais la présence. */
  readonly commence: boolean;
  /** La ville de l'événement : `/villes/:slug` (la fiche n'existe que si la ville est active). */
  readonly villeNom: string;
  readonly titre: string;
  readonly type: string;
  /** Le nom du réseau réservé, ou `null` : la pastille disparaît alors. */
  readonly reseau: string | null;
  readonly quand: string;
  readonly quandCourt: string;
  readonly lieu: string;
  readonly lieuCourt: string;
  readonly adresse: string;
  readonly description: string | null;
  readonly organisateur: { readonly nom: string; readonly initiales: string };
  readonly avatars: readonly AvatarEmpile[];
  /** Les participants au-delà des avatars montrés, ou `null` s'il n'y en a pas. */
  readonly reste: number | null;
  readonly inscrits: number;
  /** La capacité, ou `null` : « sur N places » disparaît alors. */
  readonly places: number | null;
  /**
   * La marque du pluriel de « place ».
   *
   * Vue au navigateur sur un événement d'UNE place : « 1 sur 1 places ». La
   * maquette écrit « 40 places » et ne pouvait pas le montrer — c'est le test de
   * la liste d'attente, qui a besoin d'un événement plein, qui l'a révélé.
   */
  readonly plurielPlaces: string;
}

export interface E02Data {
  readonly actions: ActionsEvenement;
  readonly moi: MoiAgenda;
  readonly panneau: PanneauAgenda;
  readonly evenement: FicheEvenement;
  readonly choix: ChoixRsvp;
  readonly presence: { readonly debut: string; readonly fin: string };
  /** Ma position sur la liste d'attente, décidée par le SERVEUR. */
  readonly attente: number | null;
  /**
   * LES DEUX CARTES D'ÉTAT DE LA COLONNE DE DROITE.
   *
   * `complet` : la capacité est atteinte (§3.2). `organisateur` : le serveur dit
   * `isOrganizer`, et c'est la seule source — aucune comparaison d'identifiants
   * n'est faite ici. Sans ces deux champs, « VUE ORGANISATEUR » s'affichait à
   * n'importe quel membre, avec « Annuler l'événement » dedans ; c'est le test de
   * bout en bout qui l'a montré.
   */
  readonly complet: boolean;
  readonly organisateur: boolean;
}

export interface E03Data {
  readonly moi: MoiAgenda;
  readonly panneau: PanneauAgenda;
  readonly ville: string;
  /**
   * LE FORMULAIRE, BRANCHÉ. Voir `FormulaireEvenementView`. Le porteur : « Créer
   * un événement (qui est actuellement dessiné) » — les dix champs étaient des
   * `<div>`, « Publier l'événement » un bouton sans geste.
   */
  readonly formulaire: FormulaireEvenementView;
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE FORMULAIRE DE « CRÉER UN ÉVÉNEMENT » — E03 ET LA FENÊTRE DU RÉSEAU       ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * UN SEUL CONTRAT POUR DEUX PORTES : la page `/agenda/nouveau` et la fenêtre que
 * l'onglet « Événements » d'un réseau ouvre (« Créer un événement du réseau »).
 * Le porteur : « On peut faire le contrôleur des événements et le réutiliser en
 * précisant le réseau id si dans un réseau. » `POST /events` porte DÉJÀ
 * `communityId` (`createEventSchema`) et le service vérifie l'adhésion : il n'y
 * avait rien à ajouter côté serveur, seulement à donner des champs à la planche.
 *
 * ── LES TYPES : LES HUIT DE `EventType`, PAS LES CINQ DESSINÉS ─────────────
 *
 * La maquette dessine cinq pastilles (Rencontre, Atelier, Sport, Fête,
 * Démarches) qui ne recouvrent pas les huit valeurs du serveur, et l'en-tête de
 * `07-agenda.mjs` le relevait déjà. La rangée lit donc les huit, dans les mots
 * de `TYPES_FR` — les mots que l'agenda emploie déjà sur ses cartes. Aucun
 * libellé n'est inventé, aucune correspondance devinée.
 *
 * ── LES DATES SONT SAISIES EN HEURE LOCALE DU NAVIGATEUR ──────────────────
 *
 * `datetime-local` rend « 2026-10-21T12:00 », sans fuseau. Le serveur attend un
 * instant avec décalage (`instantSchema`) : la conversion se fait par
 * `new Date(…)`, c'est-à-dire dans le fuseau du navigateur — celui de la
 * personne qui organise, ce qui est le sens d'une heure saisie à la main.
 */
export interface FormulaireEvenementView {
  readonly types: readonly {
    readonly label: string;
    readonly bg: string;
    readonly fg: string;
    readonly bd: string;
    readonly onPick: () => void;
  }[];
  readonly titre: string;
  readonly onTitre: (event: { readonly target: { readonly value: string } }) => void;
  readonly description: string;
  readonly onDescription: (event: { readonly target: { readonly value: string } }) => void;
  /** Les villes ouvertes, et celle qui est choisie — ma ville par défaut. */
  readonly villes: readonly { readonly id: string; readonly nom: string }[];
  readonly villeId: string;
  readonly onVille: (event: { readonly target: { readonly value: string } }) => void;
  readonly lieu: string;
  readonly onLieu: (event: { readonly target: { readonly value: string } }) => void;
  readonly adresse: string;
  readonly onAdresse: (event: { readonly target: { readonly value: string } }) => void;
  readonly debut: string;
  readonly onDebut: (event: { readonly target: { readonly value: string } }) => void;
  readonly fin: string;
  readonly onFin: (event: { readonly target: { readonly value: string } }) => void;
  readonly capacite: string;
  readonly onCapacite: (event: { readonly target: { readonly value: string } }) => void;
  /** Mes réseaux ; `''` = ouvert à tous. FIGÉ quand on vient d'un réseau. */
  readonly reseaux: readonly { readonly id: string; readonly nom: string }[];
  readonly reseauId: string;
  readonly onReseau: (event: { readonly target: { readonly value: string } }) => void;
  readonly reseauFige: boolean;
  /** « Ajouter une couverture » — le nom du fichier déposé, ou `''`. */
  readonly couverture: string;
  readonly onCouverture: (e: { target: { files: FileList | null; value: string } }) => void;
  readonly bloque: boolean;
  readonly onPublier: () => void;
  /** Vrai en modification : le titre devient « Modifier l'événement », le bouton « Enregistrer ». */
  readonly modification: boolean;
  /** Le refus du serveur, déjà en français — `TOO_SOON`, `TOO_FAR`, le quota. */
  readonly echec: string;
}

const RIEN = (): void => {};

/** Le formulaire inerte, pour les squelettes : tous les gestes sont sans effet. */
export const formulaireVide: FormulaireEvenementView = {
  types: [],
  titre: '',
  onTitre: RIEN,
  description: '',
  onDescription: RIEN,
  villes: [],
  villeId: '',
  onVille: RIEN,
  lieu: '',
  onLieu: RIEN,
  adresse: '',
  onAdresse: RIEN,
  debut: '',
  onDebut: RIEN,
  fin: '',
  onFin: RIEN,
  capacite: '',
  onCapacite: RIEN,
  reseaux: [],
  reseauId: '',
  onReseau: RIEN,
  reseauFige: false,
  couverture: '',
  onCouverture: RIEN,
  bloque: true,
  onPublier: RIEN,
  echec: '',
  modification: false,
};

/**
 * Une ligne de la feuille de présence (E04).
 *
 * `coche` ET `vide` SONT FAUX TOUS LES DEUX quand la présence est INCONNUE — ce
 * qui arrive dès que le lecteur n'est pas l'organisateur, puisque §5 ne lui
 * envoie alors pas `checkedIn`. La ligne ne dessine alors aucune case, plutôt
 * qu'une case vide qui affirmerait « absent ». Ne pas savoir n'est pas dire non.
 */
export interface LignePresence {
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
  readonly fond: string;
  readonly initiales: string;
  readonly nom: string;
  readonly coche: boolean;
  readonly vide: boolean;
  /** L'identifiant du membre, pour `POST /check-in` (organisateur seulement). */
  readonly userId?: string;
  /** Vrai si la présence est DÉJÀ enregistrée côté serveur : la case ne se décoche plus. */
  readonly figee?: boolean;
}

/** La feuille de présence vivante (E04) : cases, recherche, enregistrement. */
export interface PresenceView {
  readonly recherche: string;
  readonly onRecherche: (event: { readonly target: { readonly value: string } }) => void;
  readonly onBascule: (userId: string) => void;
  readonly onEnregistrer: () => void;
  readonly occupe: boolean;
  /** Le nombre de nouvelles cases cochées, pas encore enregistrées. */
  readonly enAttente: number;
  readonly retour: string;
  readonly estOrganisateur: boolean;
  /** Les lignes visibles après la recherche, cases à jour. */
  readonly lignes: readonly LignePresence[];
}

export const presenceVide: PresenceView = {
  recherche: '',
  onRecherche: AUCUN_GESTE,
  onBascule: AUCUN_GESTE,
  onEnregistrer: AUCUN_GESTE,
  occupe: false,
  enAttente: 0,
  retour: '',
  estOrganisateur: false,
  lignes: [],
};

export interface E04Data {
  readonly presence: PresenceView;
  /** Cet événement est-il celui de l'organisateur ? Sinon la feuille est en lecture. */
  readonly moi: MoiAgenda;
  readonly panneau: PanneauAgenda;
  readonly evenement: { readonly titre: string; readonly quand: string };
  /** Faux pour qui n'est pas l'organisateur : la pastille de compteur disparaît. */
  readonly compteur: boolean;
  readonly presents: number;
  readonly plurielPresents: string;
  readonly inscrits: number;
  readonly plurielInscrits: string;
  readonly participants: readonly LignePresence[];
}

// ─── Jetons relevés sur la maquette ──────────────────────────────────────────

/** Le jour sélectionné, et les autres : fond, couleur du numéro, graisse du titre. */
const JOUR_CHOISI = { fond: '#E3F0EB', couleur: '#0F5C48', poids: '700' } as const;
const JOUR_AUTRE = { fond: 'transparent', couleur: '#16211D', poids: '500' } as const;

/** Les deux points du calendrier : « près de moi » et « j'y participe » (§3.5). */
const POINT_PRES = '#16785E';
const POINT_JY_VAIS = '#E0733A';

/** Le fond du bloc de date d'une carte : terre cuite clair quand j'y participe. */
const DATE_JY_VAIS = '#FBE3D4';
const DATE_AUTRE = '#E3F0EB';

/** Les deux paires de couleurs d'un bouton de RSVP, telles que la maquette les dessine. */
const BOUTON_ACTIF: EtatBouton = { fond: '#16785E', texte: '#fff' };
const BOUTON_INACTIF: EtatBouton = { fond: '#F2F5F4', texte: '#16211D' };

/**
 * La palette des avatars, relevée sur CETTE maquette (E02 et E04).
 *
 * Le choix est DÉTERMINISTE — l'index dans la liste — et non aléatoire : un
 * avatar qui change de couleur à chaque rendu est un défaut visible, et un tirage
 * par identifiant donnerait deux couleurs différentes au même membre selon
 * l'écran.
 */
const PALETTE_AVATARS = ['#2FA37D', '#E0733A', '#0F5C48', '#B4581F'] as const;

/**
 * Le rond gris qui compte les participants non montrés (E02) est DESSINÉ par la
 * maquette, pas choisi ici : la liaison l'écrit en clair dans
 * `tools/screens/07-agenda.mjs` (`#8A958F`), et seul son NOMBRE est une donnée.
 * Le déclarer ici serait une seconde source pour une couleur que personne ne lit.
 */

/** La maquette empile QUATRE ronds : trois avatars, puis le compteur du reste. */
const AVATARS_MONTRES = 3;

/**
 * Les cinq types d'événement que les maquettes nomment (09 §3.1 et T5 E03).
 *
 * EXPORTÉE depuis le lot de l'onglet « Événements » d'un réseau (A08T), qui
 * dessine la même pastille de type sur ses quatre cadres. Une seconde table y
 * aurait nommé « Pique-nique » autrement dès la première relecture.
 */
export const TYPES_FR: Record<string, string> = {
  PICNIC: 'Pique-nique',
  SPORT: 'Sport',
  CV_WORKSHOP: 'Atelier',
  COOKING: 'Cuisine',
  NETWORKING: 'Rencontre',
  OUTING: 'Sortie',
  CONFERENCE: 'Conférence',
  OTHER: 'Autre',
};

/**
 * ÉCART SIGNALÉ AU PORTEUR : les huit valeurs de `EventType` n'ont de libellé
 * français NI dans les maquettes NI dans `T2`. `07 Agenda` dessine cinq chips —
 * Rencontre, Atelier, Sport, Fête, Démarches — qui ne recouvrent pas les huit
 * valeurs, et dont deux (« Fête », « Démarches ») n'ont aucune valeur
 * correspondante. Les huit mots ci-dessus sont donc à faire valider ; trois
 * seulement (« Sport », « Atelier », « Rencontre ») viennent de la maquette.
 */

// ─── Formatage, toujours dans un fuseau DONNÉ ────────────────────────────────

const capitale = (texte: string): string =>
  texte.length === 0 ? texte : texte[0]!.toUpperCase() + texte.slice(1);

/** La marque du pluriel français : « s » à partir de deux. */
export const pluriel = (n: number): string => (n > 1 ? 's' : '');

/**
 * Un jour civil `YYYY-MM-DD` devient un instant de MIDI UTC.
 *
 * Midi, et formaté en UTC : un jour civil n'a pas d'heure, donc le prendre à
 * minuit dans un fuseau quelconque le ferait basculer d'un jour selon le décalage.
 * C'est la même précaution que `daysBetween` dans `packages/shared`.
 */
const midiUtc = (jourCivil: string): Date => new Date(`${jourCivil}T12:00:00Z`);

const fmt = (options: Intl.DateTimeFormatOptions, zone: string): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat('fr-FR', { ...options, timeZone: zone });

/** « SAM » — l'abréviation de la maquette, en capitales et sans point. */
export const abbrJour = (jourCivil: string): string =>
  fmt({ weekday: 'short' }, 'UTC')
    .format(midiUtc(jourCivil))
    .replace('.', '')
    .slice(0, 3)
    .toUpperCase();

/** « 21 » — le numéro du jour dans le mois. */
export const numeroJour = (jourCivil: string): string =>
  fmt({ day: 'numeric' }, 'UTC').format(midiUtc(jourCivil));

/**
 * « MARS », « AOÛT » — le MOIS en capitales, sous le numéro du jour.
 *
 * ── POURQUOI UN SECOND ABRÉGÉ, À CÔTÉ DE `abbrJour` ───────────────────────
 *
 * Les pastilles de date ne portent pas tous la même chose : celle de l'agenda
 * (E01) écrit le JOUR DE LA SEMAINE sous le numéro — « 21 / SAM » —, celle de
 * l'onglet « Événements » d'un réseau (A08T) écrit le MOIS — « 14 / MARS ».
 * Relevé sur les quatre cadres de l'onglet, aux deux largeurs : jamais un
 * abrégé de jour.
 *
 * ── `month: 'short'` ET NON `'long'`, MESURÉ ─────────────────────────────
 *
 * La maquette ne dessine que « MARS » et « AOÛT », deux mois dont la forme
 * courte et la forme longue sont IDENTIQUES en français : le dessin ne tranche
 * donc pas. Ce qui tranche est la place — 10 px de haut dans une pastille de
 * 62 px (54 à 390 px) — et `'long'` y mettrait « SEPTEMBRE », qui déborde.
 * `'short'` rend « sept. », d'où le point retiré, exactement comme `abbrJour`
 * retire celui de « sam. ».
 *
 * ⚠ PAS DE `.slice(0, 3)` ICI, et c'est la différence avec `abbrJour` : « JUIL »
 * et « SEPT » sont lisibles, « JUI » et « SEP » le sont moins, et rien dans la
 * maquette ne demande trois caractères — les deux mois qu'elle dessine en font
 * quatre.
 */
export const abbrMois = (jourCivil: string): string =>
  fmt({ month: 'short' }, 'UTC')
    .format(midiUtc(jourCivil))
    .replace('.', '')
    .toUpperCase();

/** « Samedi 21 septembre » — le titre du jour sélectionné (§3.5). */
export const jourLong = (jourCivil: string): string =>
  capitale(fmt({ weekday: 'long', day: 'numeric', month: 'long' }, 'UTC').format(midiUtc(jourCivil)));

/** « samedi 21 septembre » — le même, en sous-titre. */
export const jourLongBas = (jourCivil: string): string =>
  fmt({ weekday: 'long', day: 'numeric', month: 'long' }, 'UTC').format(midiUtc(jourCivil));

/** « Samedi 21 sept. » — la forme abrégée du cadre mobile de E02. */
export const jourAbrege = (jourCivil: string): string =>
  capitale(fmt({ weekday: 'long', day: 'numeric', month: 'short' }, 'UTC').format(midiUtc(jourCivil)));

/** « samedi 26 » — le jour courant, dans l'encart du panneau. */
export const jourEtNumero = (jourCivil: string): string =>
  fmt({ weekday: 'long', day: 'numeric' }, 'UTC').format(midiUtc(jourCivil));

/** « Septembre 2026 » — le mois du panneau. */
export const moisLong = (jourCivil: string): string =>
  capitale(fmt({ month: 'long', year: 'numeric' }, 'UTC').format(midiUtc(jourCivil)));

/** « 1er octobre » — la date de remise à zéro du quota. */
export const dateCourte = (iso: string, zone: string): string => {
  const jour = Number(fmt({ day: 'numeric' }, zone).format(new Date(iso)));
  const mois = fmt({ month: 'long' }, zone).format(new Date(iso));
  return `${jour === 1 ? '1er' : String(jour)} ${mois}`;
};

/**
 * « 12 h », « 12 h 30 » — l'heure telle que la maquette l'écrit.
 *
 * Les parties plutôt que la chaîne formatée : `fr-FR` rend « 12:00 », et la
 * maquette écrit « 12 h ». On lit donc l'heure et les minutes DANS LE FUSEAU
 * demandé, et on compose les deux mots que la maquette emploie.
 */
export const heure = (iso: string, zone: string): string => {
  const parties = fmt({ hour: '2-digit', minute: '2-digit', hour12: false }, zone).formatToParts(
    new Date(iso),
  );
  const valeur = (type: string): number =>
    Number(parties.find((p) => p.type === type)?.value ?? '0');
  const h = valeur('hour');
  const m = valeur('minute');
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
};

/**
 * Le jour civil d'un instant, DANS UN FUSEAU DONNÉ — « 2026-10-02 ».
 *
 * `toISOString().slice(0, 10)` donnerait le jour en UTC, et ce n'est pas le même :
 * à 00 h 30 à Paris on est encore la veille en UTC. C'est exactement le décalage
 * d'un jour que §3.5 veut éviter, et il ne se voit qu'une heure par jour — donc
 * jamais en développement, toujours chez un membre.
 *
 * `en-CA` rend « 2026-10-02 » : c'est le seul usage de cette étiquette ici, et il
 * ne sert qu'au format, jamais à des mots affichés.
 */
export const jourCivilDe = (quand: Date, zone: string): string =>
  new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: zone,
  }).format(quand);

/**
 * Le numéro de semaine ISO 8601 d'un jour civil.
 *
 * La maquette intitule ses groupes « SEMAINE 38 », et c'est bien la semaine ISO :
 * ses deux groupes couvrent lundi 16 → dimanche 22 (38) puis lundi 23 → (39).
 * Calculé en UTC sur le seul jour civil : aucun fuseau n'entre en jeu.
 */
export const semaineIso = (jourCivil: string): number => {
  // ISO : la semaine d'un jour est celle de son JEUDI, et la semaine 1 est celle
  // qui contient le 4 janvier.
  const jeudi = midiUtc(jourCivil);
  jeudi.setUTCDate(jeudi.getUTCDate() - ((jeudi.getUTCDay() + 6) % 7) + 3);

  const premierJeudi = new Date(Date.UTC(jeudi.getUTCFullYear(), 0, 4, 12));
  premierJeudi.setUTCDate(
    premierJeudi.getUTCDate() - ((premierJeudi.getUTCDay() + 6) % 7) + 3,
  );

  /**
   * La première version de ce calcul mêlait les deux corrections en une seule
   * expression et rendait 38 pour le lundi 21 septembre 2026, qui ouvre la
   * semaine 39. Le défaut ne décalait pas le calendrier d'un jour — seulement son
   * INTITULÉ —, donc rien à l'écran ne l'aurait montré : c'est le test qui l'a vu.
   */
  return 1 + Math.round((jeudi.getTime() - premierJeudi.getTime()) / (7 * 86_400_000));
};

/** Les initiales d'un nom affiché : deux lettres au plus, jamais vide. */
export const initialesDe = (nom: string): string => {
  const mots = nom.trim().split(/\s+/).filter((m) => m !== '');
  if (mots.length === 0) return '?';
  return mots
    .slice(0, 2)
    .map((m) => [...m][0] ?? '')
    .join('')
    .toUpperCase();
};

/** Le prénom : le premier mot du nom affiché. */
export const prenomDe = (nom: string): string => nom.trim().split(/\s+/)[0] ?? nom;

// ─── Constructeurs — de la charge de l'API vers ce que les cadres lisent ─────

/**
 * Le panneau de gauche, à partir du calendrier et de l'abonnement.
 *
 * `jourChoisi` est mis en évidence, `aujourdhuiCivil` est écrit dans l'encart, et
 * les deux viennent du fuseau que l'API annonce — jamais de l'horloge locale.
 */
export function construirePanneau(
  calendrier: CalendarResponse,
  abonnement: MySubscriptionResponse,
  jourChoisi: string,
  aujourdhuiCivil: string,
  gratuit = false,
  nav: { readonly mois?: string; readonly scope?: ScopeAgenda } = {},
): PanneauAgenda {
  // Le mois AFFICHÉ : celui que l'URL demande, sinon le mois courant. « Aujourd'hui »
  // reste le vrai jour, même quand on feuillette un autre mois.
  const mois = nav.mois ?? aujourdhuiCivil.slice(0, 7);
  const scope = nav.scope ?? 'all';
  const duMois = calendrier.items.filter((j) => j.date.startsWith(mois));

  const semaines: SemaineCalendrier[] = [];
  for (const jour of calendrier.items) {
    const numero = semaineIso(jour.date);
    let semaine = semaines.find((s) => s.numero === numero);
    if (semaine === undefined) {
      semaine = {
        numero,
        // La maquette écrit DEUX remplissages : le premier intitulé est plus haut
        // que les suivants, qui prennent une marge au-dessus.
        marge: semaines.length === 0 ? '6px 10px' : '10px 10px 6px',
        jours: [],
      };
      semaines.push(semaine);
    }
    const choisi = jour.date === jourChoisi;
    const jetons = choisi ? JOUR_CHOISI : JOUR_AUTRE;
    (semaine.jours as JourCalendrier[]).push({
      abbr: abbrJour(jour.date),
      numero: numeroJour(jour.date),
      titre: jour.firstTitle ?? '',
      fond: jetons.fond,
      opacite: jour.total === 0 ? '.45' : '1',
      couleur: jetons.couleur,
      poids: choisi ? '700' : jetons.poids,
      point: jour.attending > 0 ? POINT_JY_VAIS : jour.total > 0 ? POINT_PRES : null,
      href: hrefAgenda({ jour: jour.date, mois: jour.date.startsWith(mois) ? null : jour.date.slice(0, 7), scope }),
    });
  }

  /**
   * La métrique est nommée par `USAGE_METRIC_LIMIT_KEYS` de `packages/shared` —
   * `EVENTS_CREATED` → `eventsPerMonth` — et non par une chaîne écrite ici : le
   * jour où l'énumération change, la compilation le dit.
   */
  const usage = abonnement.usage.items.find(
    (i) => USAGE_METRIC_LIMIT_KEYS[i.metric] === USAGE_METRIC_LIMIT_KEYS.EVENTS_CREATED,
  );

  return {
    precedent: hrefAgenda({ mois: moisVoisin(mois, -1), scope }),
    suivant: hrefAgenda({ mois: moisVoisin(mois, 1), scope }),
    mois: moisLong(`${mois}-01`),
    aujourdhui: jourEtNumero(aujourdhuiCivil),
    totalMois: duMois.reduce((n, j) => n + j.total, 0),
    semaines,
    quota: {
      utilise: usage?.used ?? 0,
      // `limit` nul veut dire « illimité » (14 §4.5) : l'écran l'écrit, et
      // n'affiche jamais « sur null ».
      plafond:
        usage === undefined || usage.limit === null ? 'illimité' : String(usage.limit),
      reset: dateCourte(abonnement.usage.resetsAt, calendrier.meta.timeZone),
      gratuit,
    },
  };
}

/** Le mois d'avant (−1) ou d'après (+1) un mois `AAAA-MM`. Arithmétique civile pure. */
export function moisVoisin(mois: string, sens: -1 | 1): string {
  const [an, m] = mois.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(an, m - 1 + sens, 1));
  return d.toISOString().slice(0, 7);
}

/** Le premier jour d'un mois `AAAA-MM`, au format civil. */
export const premierDuMois = (mois: string): string => `${mois}-01`;

const FILTRE_ACTIF = { bg: '#16785E', fg: '#fff', bd: '#16785E' } as const;
const FILTRE_REPOS = { bg: '#fff', fg: '#16211D', bd: '#E6EBE9' } as const;

/**
 * Les trois pastilles de filtre de E01. Les couleurs sont CELLES de la maquette
 * (la première pastille active, les autres blanches au liseré gris) ; seul
 * change celle qui est active.
 */
export function construireFiltres(jour: string, mois: string | null, scope: ScopeAgenda): FiltresAgenda {
  const fait = (valeur: ScopeAgenda): FiltreAgenda => ({
    href: hrefAgenda({ jour, mois, scope: valeur }),
    ...(valeur === scope ? FILTRE_ACTIF : FILTRE_REPOS),
  });
  return { tous: fait('all'), mes: fait('mine'), organises: fait('organized') };
}

/** Ce que dit un jour sans événement, selon le filtre. */
export function texteJourVide(scope: ScopeAgenda): string {
  if (scope === 'mine') return 'Vous ne participez à aucun événement ce jour-là.';
  if (scope === 'organized') return 'Vous n’organisez aucun événement ce jour-là.';
  return 'Aucun événement ce jour-là près de chez vous.';
}

/** La bande de dates du mobile : les mêmes jours, autour du jour sélectionné. */
export function construireBande(
  calendrier: CalendarResponse,
  jourChoisi: string,
  scope: ScopeAgenda = 'all',
): JourBande[] {
  const jours = calendrier.items;
  const at = jours.findIndex((j) => j.date === jourChoisi);
  // La maquette dessine sept pastilles, le jour choisi en troisième position.
  const debut = Math.max(0, (at < 0 ? 0 : at) - 2);
  return jours.slice(debut, debut + 7).map((j) => {
    const choisi = j.date === jourChoisi;
    return {
      href: hrefAgenda({ jour: j.date, scope }),
      abbr: abbrJour(j.date),
      numero: numeroJour(j.date),
      fond: choisi ? '#16785E' : '#fff',
      bord: choisi ? '#16785E' : '#E6EBE9',
      couleur: choisi ? '#fff' : '#16211D',
      opacite: j.total === 0 ? '.5' : '1',
      // Un jour vide garde son point, en `transparent` : c'est la maquette.
      point: j.attending > 0 ? POINT_JY_VAIS : j.total > 0 ? POINT_PRES : 'transparent',
    };
  });
}

/** Une carte d'événement du jour (E01). `reseaux` nomme mes réseaux (§10). */
export function construireCarte(
  carte: EventCardResponse,
  reseaux: ReadonlyMap<string, string>,
): CarteEvenement {
  const jyVais = carte.myStatus === 'GOING' || carte.myStatus === 'WAITLIST';
  return {
    /** `/agenda/:id` — la route que `app/(app)/agenda/[id]/` sert. */
    href: `/agenda/${carte.id}`,
    fondDate: jyVais ? DATE_JY_VAIS : DATE_AUTRE,
    numero: numeroJour(carte.localDate),
    abbr: abbrJour(carte.localDate),
    jyVais,
    type: TYPES_FR[carte.type] ?? carte.type,
    reseau: carte.communityId === null ? null : (reseaux.get(carte.communityId) ?? null),
    titre: carte.title,
    lieu: carte.venueName === null ? carte.city.name : `${carte.venueName}, ${carte.city.name}`,
    lieuCourt: carte.city.name,
    heure: heure(carte.startsAt, carte.timeZone),
    participants: carte.attendeeCount,
    pluriel: pluriel(carte.attendeeCount),
  };
}

/** La fiche de E02, telle que la maquette la dessine aux deux largeurs. */
export function construireFiche(
  detail: EventDetailResponse,
  reseaux: ReadonlyMap<string, string>,
): FicheEvenement {
  const zone = detail.timeZone;
  const fin = detail.endsAt === null ? null : heure(detail.endsAt, zone);
  const plage = `${heure(detail.startsAt, zone)}${fin === null ? '' : ` – ${fin}`}`;
  const montres = detail.attendees.slice(0, AVATARS_MONTRES);
  const reste = detail.attendeeCount - montres.length;

  return {
    id: detail.id,
    annule:
      detail.status === 'CANCELLED'
        ? {
            motif: detail.cancelReason,
            quand: detail.cancelledAt === null ? '' : dateCourte(detail.cancelledAt, detail.timeZone),
          }
        : null,
    monStatut: detail.myStatus,
    commence: new Date(detail.startsAt).getTime() <= Date.now(),
    villeNom: detail.city.name,
    titre: detail.title,
    type: TYPES_FR[detail.type] ?? detail.type,
    reseau: detail.communityId === null ? null : (reseaux.get(detail.communityId) ?? null),
    quand: `${jourLong(detail.localDate)} · ${plage}`,
    quandCourt: `${jourAbrege(detail.localDate)} · ${plage}`,
    lieu: detail.venueName ?? detail.city.name,
    lieuCourt: detail.venueName === null ? detail.city.name : `${detail.venueName}, ${detail.city.name}`,
    adresse: detail.addressText ?? detail.city.name,
    description: detail.description,
    organisateur: {
      nom: detail.organizer.displayName,
      initiales: initialesDe(detail.organizer.displayName),
    },
    avatars: montres.map((a, i) => ({
      fond: PALETTE_AVATARS[i % PALETTE_AVATARS.length]!,
      initiales: initialesDe(a.displayName),
    })),
    reste: reste > 0 ? reste : null,
    inscrits: detail.attendeeCount,
    places: detail.capacity,
    plurielPlaces: detail.capacity === null ? '' : pluriel(detail.capacity),
  };
}

/**
 * Lequel des trois boutons de RSVP est actif (§3.2).
 *
 * `WAITLIST` compte comme « Je viens » : c'est la réponse du MEMBRE, et c'est le
 * serveur qui l'a basculée en liste d'attente faute de place. Afficher « Je ne
 * viens pas » dans ce cas dirait l'inverse de ce que le membre a demandé.
 */
export function construireChoix(statut: EventCardResponse['myStatus']): ChoixRsvp {
  return {
    vient: statut === 'GOING' || statut === 'WAITLIST' ? BOUTON_ACTIF : BOUTON_INACTIF,
    peutEtre: statut === 'MAYBE' ? BOUTON_ACTIF : BOUTON_INACTIF,
    refuse: statut === 'DECLINED' ? BOUTON_ACTIF : BOUTON_INACTIF,
  };
}

/**
 * La fenêtre d'activité du bouton « Je suis là ».
 *
 * Bornée par les heures RÉELLES de l'événement, et par `SELF_CHECKIN_WINDOW_MS`
 * — la constante de `packages/shared` — quand la fin n'est pas renseignée : §3.3
 * dit « actif de H−0 à H+6 ». On AFFICHE la fenêtre ; on ne décide pas si elle est
 * ouverte. Cette décision est au serveur (`CHECKIN_WINDOW_CLOSED`), et la prendre
 * ici la ferait dépendre de l'horloge du navigateur.
 */
export function construirePresence(detail: EventDetailResponse): {
  readonly debut: string;
  readonly fin: string;
} {
  const zone = detail.timeZone;
  const finIso =
    detail.endsAt ??
    new Date(new Date(detail.startsAt).getTime() + SELF_CHECKIN_WINDOW_MS).toISOString();
  return { debut: heure(detail.startsAt, zone), fin: heure(finIso, zone) };
}

/** Les statuts qu'on peut cocher présents (§3.3) : `POST /check-in` refuse les autres. */
const COCHABLES = ['GOING', 'MAYBE', 'WAITLIST'] as const;

/**
 * La feuille de présence de E04.
 *
 * `feuille` est la réponse de `GET /events/:id/attendees`, validée par le contrat
 * qui correspond à ce que le serveur a dit du lecteur. Une ligne n'a de case QUE
 * si la présence est connue, c'est-à-dire si `checkedIn` est là.
 *
 * LES DÉCLINÉS SONT ÉCARTÉS : `POST /check-in` n'accepte que GOING, MAYBE et
 * WAITLIST, donc une ligne `DECLINED` serait une case que personne ne peut
 * cocher, et elle gonflerait « sur N inscrits » d'un membre qui a dit non.
 */
export function construireFeuille(
  feuille: OrganizerAttendeesResponse | PublicAttendeesResponse,
): {
  readonly participants: LignePresence[];
  readonly presents: number;
  readonly inscrits: number;
  readonly compteur: boolean;
} {
  const lignes = feuille.items.filter((p) =>
    (COCHABLES as readonly string[]).includes(p.status),
  );
  const coches = 'meta' in feuille && 'checkedIn' in feuille.meta ? feuille.meta.checkedIn : null;

  return {
    participants: lignes.map((p, i) => {
      const connue = 'checkedIn' in p;
      /**
       * `coche` SE DÉCIDE SUR `checkedIn`, ET SUR RIEN D'AUTRE.
       *
       * Le statut de RSVP est le champ voisin, et il ment : un inscrit `GOING`
       * n'est pas un présent. C'est `checked_in` qui alimente l'indicateur clé de
       * la plateforme (§3.3) et le crédit `EVENT_ORGANIZED` (≥ 3 présents cochés).
       */
      const presente = connue ? (p as { checkedIn: boolean }).checkedIn : null;
      return {
        fond: PALETTE_AVATARS[i % PALETTE_AVATARS.length]!,
        initiales: initialesDe(p.displayName),
        nom: p.displayName,
        coche: presente === true,
        vide: presente === false,
        ...(p.handle === null ? {} : { profil: `/@${p.handle}` }),
        ...('userId' in p ? { userId: (p as { userId: string }).userId } : {}),
        figee: presente === true,
      };
    }),
    presents: coches ?? 0,
    inscrits: lignes.length,
    compteur: coches !== null,
  };
}

/**
 * Le bandeau d'identité de la barre haute.
 *
 * `avatarUrl` EST OBLIGATOIRE, ET C'EST LE CORRECTIF. Ce paramètre avait une
 * valeur par défaut de `null` : l'unique appelant l'omettait, le compilateur ne
 * disait rien, et l'agenda était le seul des six modules à dessiner encore
 * l'aplat de la maquette alors que la photo du membre était posée partout
 * ailleurs. MESURÉ : « /agenda : ronds = 1 | avec photo = 0 ». Sans valeur par
 * défaut, le prochain oubli ne compile pas.
 */
export function construireMoi(nomAffiche: string, avatarUrl: string | null): MoiAgenda {
  return {
    initiales: initialesDe(nomAffiche),
    prenom: prenomDe(nomAffiche),
    photo: fondAvatar(avatarUrl),
  };
}

/** Les lignes de la carte « CE WEEK-END » : titre, puis « samedi 12 h ». */
export function construireWeekEnd(liste: EventsResponse): LigneWeekEnd[] {
  return liste.items.map((e) => ({
    titre: e.title,
    quand: `${fmt({ weekday: 'long' }, 'UTC').format(midiUtc(e.localDate))} ${heure(e.startsAt, e.timeZone)}`,
  }));
}
