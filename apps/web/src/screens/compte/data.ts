/**
 * Données des écrans K01 à K10, et ce que la maquette `08 Compte.dc.html` en dit.
 *
 * ── CE FICHIER A CHANGÉ DE NATURE, ET IL FAUT SAVOIR POURQUOI ───────────────
 *
 * Il disait, et c'était exact : « IL N'Y EN A AUCUNE — ce fichier existe pour le
 * dire, pas pour combler un vide ». `08 Compte` n'emploie pas le dialecte des
 * maquettes `01` et `03` : son `renderVals()` rend `{}`, zéro `{{ … }}`, zéro
 * `<sc-for>`, comptés. Les vingt-cinq cadres recevaient donc `_props` — ils
 * IGNORAIENT leurs données, faute d'avoir où les mettre.
 *
 * Il annonçait aussi la suite : « quand ces écrans seront branchés sur
 * `apps/api/src/modules/{users,auth,kyc,consents,blocks,billing}`, c'est ici que
 * les champs arriveront, et le JSX transcodé n'aura pas à bouger ». C'est
 * exactement ce qui vient d'arriver, et le JSX n'a PAS bougé : la prise a été
 * DÉCLARÉE dans `tools/screens/08-compte.mjs`, sous la clé `donnees`, et le
 * générateur a produit des cadres qui lisent leurs propriétés.
 *
 * ── LA RÉPARTITION, QUI EST LA MOITIÉ DU CONTRAT ────────────────────────────
 *
 * La FORME est transcodée de la maquette ; la DONNÉE et le COMPORTEMENT vivent
 * ici. C'est la même séparation que `screens/a01/data.ts`, et ce fichier converge
 * vers elle plutôt que d'en inventer une seconde : des types par écran, des
 * valeurs d'affichage prêtes à poser, et aucune décision dans le JSX.
 *
 * LES COULEURS QUI SONT DES DONNÉES viennent de la maquette, pas d'un choix fait
 * ici. Les deux pastilles de K03 — fond `#E3F0EB` et texte `#0F5C48` pour un
 * niveau acquis, `#F2F5F4` et `#5D6B66` pour un niveau à faire — sont celles que
 * `08 Compte` dessine, relevées sur ses propres planches. Aucune n'est assombrie :
 * huit paires de ce projet passent sous le seuil AA, et c'est une décision assumée
 * du porteur que le garde-fou de contraste tient à 16/24.
 *
 * ── CE QUI N'EST PAS BRANCHÉ, ET POURQUOI ───────────────────────────────────
 *
 * Deux écrans sur dix ne lisent que le bandeau de compte, et ce n'est pas un
 * renoncement :
 *
 *   · K08 « Mes données » — sa planche ne dessine AUCUNE donnée. Ses trois blocs
 *     sont du texte de RÈGLE (« Préparé sous 48 h. Lien valable 7 jours. »,
 *     « Définitif après 7 jours. »), c'est-à-dire les bornes de 01 §2.7 et §2.8,
 *     vraies pour tout le monde. `GET /me/export/latest` sait dire où en est
 *     l'archive du membre — la maquette n'a nulle part où l'écrire. Signalé.
 *   · K10 « Enregistrés » — AUCUNE ROUTE n'existe. `apps/api/src/modules/bookmarks/`
 *     ne contient qu'un service : ni contrôleur, ni `GET /me/bookmarks`, et le mot
 *     n'apparaît dans aucun `*.controller.ts`. Signalé.
 *
 * ── AUCUN BOUTON DE CE MODULE N'EST BRANCHÉ, et c'est délibéré ──────────────
 *
 * Trois d'entre eux portent une conséquence irréversible ou financière :
 *
 *   · « Confirmer la suppression » (K08) — 01 §5 : suppression définitive après
 *     7 jours, confirmée par un code SMS. Un `onClick` qui refermerait la fenêtre
 *     ferait CROIRE au membre que son compte est supprimé.
 *   · « Payer 2 600 F » (K06) — 14 §4.2 : le paiement part chez l'agrégateur, et
 *     rien ne part ici. Faire avancer la fenêtre au volet « attente » annoncerait
 *     un paiement qui n'a pas été demandé.
 *   · « Envoyer la demande » (K02) — une demande de contact est un message à un
 *     autre membre.
 *
 * C'est la même règle que « Publier » dans le module Parcours : un bouton inerte
 * est moins nuisible qu'un bouton qui ment. Les volets de K06 restent atteignables
 * par l'URL, qui n'affirme rien.
 */

/**
 * LE BANDEAU DE COMPTE — les dix planches d'ordinateur dessinent le même.
 *
 * `niveau` est un NOMBRE affiché (« niveau 2 »), et c'est tout ce qu'il est. Il ne
 * sert JAMAIS à autoriser : la règle du socle est sans exception, et son histoire
 * est écrite dans `lib/api/session.ts`. On tente l'action, et c'est le serveur qui
 * répond `403 LEVEL_REQUIRED` avec de quoi afficher l'invitation du §7.3.
 */
import type { PublicProfileResponse } from '@app/shared';
import type { FeedPostView } from '../a01/data';
import type { GuideCardView } from '../a03/data';
import type { CarteEvenement } from '../agenda/data';
import type { CarteAnnonce } from '../s01/data';
import type { CarteParcours } from '../parcours/data';

export interface Bandeau {
  readonly nom: string;
  readonly initiales: string;
  /**
   * LE FOND DU ROND D'AVATAR : la photo du membre, ou `null`.
   *
   * `null` et non la chaîne vide : c'est ce que le cadre teste pour décider s'il
   * écrit les initiales. Une chaîne vide poserait un `background` vide ET
   * effacerait les lettres — un rond blanc, sans rien.
   *
   * Composé par `photoFondFor`, la même recette que la story, le composeur et le
   * carrousel : un fond CSS prêt, jamais une adresse nue.
   */
  readonly photo: string | null;
  readonly pseudo: string;
  readonly niveau: number;
  readonly prenom: string;
  /** Demandes de contact REÇUES. `0` fait disparaître la pastille (`<sc-if>`). */
  readonly demandes: number;
}

/** K01 — mon profil. `profil` mêle `GET /me` et `GET /users/{pseudo}` : voir `appels.ts`. */
/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║ CE QUE LA PAGE « MON PROFIL » PERMET D'ÉCRIRE                               ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * `profil` reste la LECTURE — ce que la page affiche avant qu'on y touche, et ce
 * que les boîtes non modifiables (compétences, langues, pays) continuent de
 * montrer. `edition` est l'ÉCRITURE, et les deux coexistent parce que la page
 * fait les deux : elle affiche un profil ET le modifie.
 *
 * `phases` et `villes` SONT DES LISTES FERMÉES : la phase est un enum généré
 * depuis la base, la ville un identifiant de référentiel. Les passer en options
 * plutôt qu'en texte libre est ce qui empêche la page d'envoyer une valeur que
 * l'API refuserait.
 */
export interface EditionProfil {
  readonly nom: string;
  readonly onNom: (event: { target: { value: string } }) => void;
  readonly pseudo: string;
  readonly onPseudo: (event: { target: { value: string } }) => void;
  readonly bio: string;
  readonly onBio: (event: { target: { value: string } }) => void;
  readonly phase: string;
  readonly onPhase: (event: { target: { value: string } }) => void;
  readonly phases: readonly { readonly valeur: string; readonly libelle: string }[];
  readonly ville: string;
  readonly onVille: (event: { target: { value: string } }) => void;
  readonly villes: readonly { readonly valeur: string; readonly libelle: string }[];
  /** `YYYY-MM-DD` — la forme que `updateMeSchema.arrivalDate` attend. */
  readonly arrivee: string;
  readonly onArrivee: (event: { target: { value: string } }) => void;
  readonly statuts: readonly {
    readonly valeur: string;
    readonly libelle: string;
    readonly choisi: boolean;
    readonly onChoisir: () => void;
  }[];
  readonly aide: boolean;
  readonly onAide: () => void;
  readonly visible: boolean;
  readonly onVisible: () => void;
  readonly onPhoto: () => void;
  readonly onEnregistrer: () => void;
  readonly bloque: boolean;
  readonly libelle: string;
}

export interface K01Data {
  readonly moi: Bandeau;
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ « COMPÉTENCES ET LANGUES NE SONT PAS MODIFIABLES ? »                    ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Non — c'étaient deux boîtes de TEXTE. `PATCH /me/profile` accepte pourtant
   * `skillIds` et `languageIds` depuis le début, et `GET /places/skills` /
   * `GET /places/languages` servent les référentiels aux membres.
   *
   * LES IDENTIFIANTS VOYAGENT À CÔTÉ DES LIBELLÉS : la boîte affiche
   * « Relecture de CV, Démarches CAF » — une phrase composée — et la fenêtre de
   * choix a besoin de savoir lesquels sont cochés.
   */
  readonly competencesIds?: readonly string[];
  readonly languesIds?: readonly string[];
  readonly onCompetences?: () => void;
  readonly onLangues?: () => void;
  readonly profilOccupe?: boolean;
  readonly profil: {
    readonly statut: string;
    readonly ville: string;
    readonly pays: string;
    readonly bio: string;
    readonly phase: string;
    readonly competences: string;
    readonly langues: string;
    readonly aides: string;
  };
  readonly edition: EditionProfil;
}

/**
 * CE QUE LE CHARGEUR REND, SANS LES GESTES.
 *
 * `edition` porte des RAPPELS et de l'état de formulaire : rien de cela ne sort
 * d'un appel à l'API, et le demander au chargeur l'obligerait à fabriquer des
 * fonctions vides. L'écran compose les deux — la lecture vient du réseau,
 * l'écriture vit dans la page.
 */
export type K01Lecture = Omit<K01Data, 'edition'>;

/** K02 — le profil public d'un autre membre (`GET /users/{pseudo}`). */
/** Le bouton de contact du profil visité — voir `K02Data.contact`. */
export interface ContactProfilView {
  readonly etat: 'aucune' | 'envoyee' | 'recue' | 'contact' | 'soi';
  /** « Ajouter aux contacts » · « Demande envoyée » · « Accepter la demande » · « Dans vos contacts ». */
  readonly libelle: string;
  /** La forme courte du bouton mobile : « Ajouter » · « Envoyée » · « Accepter » · « Contact ». */
  readonly libelleCourt: string;
  readonly inactif: boolean;
  readonly onAction: () => void;
}

/**
 * Le bouton AU REPOS — squelette et lecture du serveur, avant que
 * `ProfilContactVivant` n'y attache la relation et son geste. « aucune » montre
 * le bouton de la maquette tel qu'il est dessiné.
 */
export const CONTACT_AU_REPOS: ContactProfilView = {
  etat: 'aucune',
  libelle: 'Ajouter aux contacts',
  libelleCourt: 'Ajouter',
  inactif: false,
  onAction: () => undefined,
};

/** Une entrée du menu « ··· » du profil visité (la forme de `MenuRond`). */
export interface EntreeOptionProfil {
  readonly label: string;
  readonly onClick?: (() => void) | undefined;
}

export interface K02Data {
  readonly moi: Bandeau;
  readonly membre: {
    readonly nom: string;
    /**
     * Le PRÉNOM, pour la fenêtre « Ajouter Fatou aux contacts ».
     *
     * Premier mot du nom affiché, comme `Bandeau.prenom` l'est du mien : aucune
     * route ne sépare prénom et nom (`displayName` est un seul champ), et c'est
     * exactement la découpe que la maquette fait — elle écrit « Amina » dans sa
     * barre haute et « Fatou » dans ce titre.
     */
    readonly prenom: string;
    readonly initiales: string;
    /**
     * LA PHOTO DU MEMBRE VISITÉ, en valeur CSS de fond — `null` sans photo.
     *
     * Le porteur : « la section de l'avatar a un souci ». Le grand rond écrivait
     * « FN » EN DUR sur la planche d'ordinateur — les initiales de l'exemple — et
     * ne lisait jamais `avatarUrl`, que `publicProfileResponseSchema` sert depuis
     * le début.
     */
    readonly photo: string | null;
    readonly pseudo: string;
    readonly niveau: number;
    readonly phase: string;
    readonly ville: string;
    readonly pays: string;
    readonly depuis: string;
    readonly bio: string;
    readonly aides: string;
    readonly entraides: number;
    /**
     * LES TROIS AUTRES COMPTEURS, de `publicProfileResponseSchema.stats`.
     *
     * Le porteur : « la page desktop marche ? » Sur les quatre cartes de
     * chiffres, UNE SEULE était liée : « 3 guides utiles », « 2 parrainages » et
     * « 9 événements » étaient les nombres de la maquette, servis à tout le
     * monde. Les trois champs existaient dans la réponse depuis le début.
     */
    readonly guides: number;
    readonly parrainages: number;
    readonly evenements: number;
    /**
     * LES ÉTIQUETTES DU PROFIL — compétences PUIS langues, de `skills` et
     * `languages`. La maquette écrivait « RH · CAF · Français · Wolof » en dur,
     * servi à tous les membres.
     */
    readonly etiquettes: readonly string[];
    /** `availableToHelp` : la pastille « Disponible pour aider » n'existe que s'il est vrai. */
    readonly disponible: boolean;
    /**
     * « Connecté·e à 3 de vos contacts · 2 réseaux en commun », composé depuis
     * `GET /users/:handle/mutual-connections` — chaîne VIDE quand il n'y a rien en
     * commun, et la ligne disparaît alors. La maquette l'écrivait en dur.
     */
    readonly commun: string;
    /** L'identifiant, pour « Signaler » et « Retirer des contacts ». `null` sur le squelette. */
    readonly userId: string | null;
  };
  /**
   * LE BOUTON « AJOUTER AUX CONTACTS », SELON MA RELATION AVEC CE MEMBRE.
   *
   * Le porteur : « même quand la demande est envoyée, le bouton affiche toujours
   * “Envoyer une demande” ». `etat` vient de `relation` (profil public) :
   * `aucune` ouvre la fenêtre de la maquette ; `envoyee` et `contact` sont
   * éteints ; `recue` accepte la demande qu'il m'a faite.
   */
  readonly contact: ContactProfilView;
  /** `relation` du profil public, que `ProfilContactVivant` traduit en `contact`. */
  readonly relation?: PublicProfileResponse['relation'];
  /** Les entrées du menu « ··· » (ordinateur) — signaler, bloquer, retirer. */
  readonly options: readonly EntreeOptionProfil[];
  /** Les mêmes, précédées de « Recommander » : le téléphone ne dessine pas ce bouton. */
  readonly optionsMobile: readonly EntreeOptionProfil[];
  /** « Recommander » — `POST /recommendations/members`. */
  readonly onRecommander?: () => void;
  readonly recommandeBloque?: boolean;
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ CE QUE CE MEMBRE A PUBLIÉ — LES SEPT ONGLETS                            ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « des tabs (guides, fil d'actualités, stories, entraides,
   * services, évènements, parcours publics) qui montrent ce que l'utilisateur a
   * publié ». La carte « GUIDES PUBLIÉS » de la planche d'ordinateur affichait
   * deux titres écrits en dur, et le cadre mobile n'en dessinait aucune.
   *
   * De `GET /users/:handle/content` — la route qui manquait, et qui porte la
   * même visibilité que le profil lui-même.
   */
  readonly contenuOnglets?: readonly OngletContenu[];
  readonly contenus?: readonly CarteContenu[];
  /** `'STORY'` fait dessiner des aperçus côte à côte plutôt que des lignes. */
  readonly contenuEspece?: string;
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LES VRAIES CARTES DU FIL, SUR LE PROFIL                                 ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur, capture à l'appui : « Sur le profil le fil d'actualité devrait
   * s'afficher comme ceci. Pareil pour les autres, ils doivent prendre leur
   * design respectif. C'est ce que j'ai demandé. »
   *
   * Il avait raison et j'avais contourné : une ligne de titre n'est pas la
   * carte. `CartePublication` est maintenant EXTRAITE du cadre du fil par le
   * générateur (`composants:`), donc montable ici — une seule source, deux
   * emplois — et ces cartes viennent de `GET /feed?authorHandle=…`, c'est-à-dire
   * de la même route, du même schéma et de la même composition que la page
   * d'accueil.
   */
  readonly contenuPublications?: readonly FeedPostView[];
  /** Les guides du membre, dans la carte de `/guides`. */
  readonly contenuGuides?: readonly GuideCardView[];
  /** Ses événements organisés, dans la carte de `/agenda`. */
  readonly contenuEvenements?: readonly CarteEvenement[];
  /** Ses annonces, dans la carte de `/services/logement`. */
  readonly contenuAnnonces?: readonly CarteAnnonce[];
  /** Ses parcours publics, dans la carte de `/parcours`. */
  readonly contenuParcours?: readonly CarteParcours[];
  /** Le titre de la carte, qui suit l'onglet : « GUIDES », « STORIES »… */
  readonly contenuTitre?: string;
  readonly contenuVide?: boolean;
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LES DEUX BOUTONS DU PROFIL, ET LA FENÊTRE QUI NE FAISAIT QUE S'OUVRIR    ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Sur le profil, le bouton écrire et ajouter ne marche pas. Le
   * bouton ajouter affiche un modal qui ne marche pas. »
   *
   * Tout ce qui suit est FACULTATIF, et c'est voulu : le squelette sert le cadre
   * avant la donnée, et un bouton qui n'a pas encore son geste ne doit pas faire
   * tomber le rendu.
   */
  readonly onEcrire?: () => void;
  /** Les quatre motifs de la fenêtre K02C — une vraie sélection. */
  readonly motifs?: readonly MotifDemande[];
  readonly demandeTexte?: string;
  readonly onDemandeTexte?: (event: { target: { value: string } }) => void;
  readonly onEnvoyerDemande?: () => void;
  /**
   * Vrai tant que la demande ne peut pas partir.
   *
   * ⚠ ÉCART SIGNALÉ : la planche écrit « Message (facultatif) », mais
   * `createConnectionRequestSchema` EXIGE le message — « c'est la moitié de
   * l'anti-spam de §3.1 ». Le bouton reste donc éteint tant que rien n'est
   * écrit, plutôt que d'échouer en 400 après le clic. C'est l'ÉTIQUETTE qu'il
   * faut corriger, et c'est au porteur.
   */
  readonly demandeBloque?: boolean;
}

/**
 * Un motif de demande de contact — « Entraide », « Parrainage », « Rencontre »,
 * « Réseau », les quatre que la planche de 420 px dessine.
 *
 * ⚠ CE CHOIX NE QUITTE PAS L'ÉCRAN. `createConnectionRequestSchema` est
 * `.strict()` et ne porte que `toHandle` et `message` ; la table
 * `connection_requests` n'a pas de colonne pour le motif. Le glisser dans le
 * texte du message écrirait à la place du membre. REMONTÉ : il manque un champ
 * `reason` à la route.
 */
export interface OngletContenu {
  readonly cle: string;
  readonly libelle: string;
  readonly fond: string;
  readonly texte: string;
  readonly bord: string;
  readonly actif: boolean;
  readonly onChoisir: () => void;
}

/**
 * Une ligne de contenu publié.
 *
 * Le porteur : « pour tous les tabs il reprend le design des éléments présentés
 * de la façon dont ils sont présentés sur les pages d'origine ». `apercu` porte
 * ce qu'il faut pour redessiner une STORY telle que le bandeau du fil la
 * dessine ; `sous` porte la ligne de contexte que l'espèce a d'utile à dire —
 * la catégorie d'un guide, l'état d'une demande, la ville d'un événement.
 */
export interface CarteContenu {
  readonly id: string;
  readonly titre: string;
  readonly sous: string;
  readonly href: string;
  readonly apercu?: {
    readonly fond: string;
    readonly photo: boolean;
    readonly etiquette: string;
    readonly texte: string;
  };
}

export interface MotifDemande {
  readonly cle: string;
  readonly libelle: string;
  readonly fond: string;
  readonly texte: string;
  readonly bord: string;
  readonly actif: boolean;
  readonly onChoisir: () => void;
}

/**
 * K03 — une pastille d'état par niveau.
 *
 * Le libellé ET les deux couleurs sont des données : lier le seul libellé
 * laisserait « À faire » sur le fond vert d'un niveau acquis, ce qui serait pire
 * que la maquette figée.
 */
export interface PastilleNiveau {
  readonly etat: string;
  readonly fond: string;
  readonly texte: string;
}

export interface K03Data {
  readonly moi: Bandeau;
  readonly niveaux: {
    readonly n0: PastilleNiveau;
    readonly n1: PastilleNiveau;
    readonly n2: PastilleNiveau;
  };
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LES GESTES DE « VÉRIFICATION ET NIVEAUX »                               ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « La page vérification est faite totalement ? Le bouton pour
   * faire la vérification d'identité est là ? Et l'ajout du numéro marche ? »
   *
   * Le bouton était là et ne faisait RIEN — deux `<button>` sans `onClick`.
   * `POST /me/kyc/session` et `POST /me/phones` répondaient déjà ; il manquait le
   * branchement.
   *
   * `kycLibelle` SUIT L'ÉTAT. La planche écrit « Commencer », ce qui est juste
   * pour qui n'a jamais essayé. `GET /me/kyc` rend aussi `IN_REVIEW`, `APPROVED`
   * et `DECLINED` : dire « Commencer » à qui est déjà en revue l'inviterait à
   * recommencer une démarche en cours.
   */
  readonly onVerifierIdentite?: () => void;
  readonly onAjouterNumero?: () => void;
  /** Vrai pendant un appel : les deux boutons s'éteignent. */
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LA CARTE « ÉTATS KYC » ALLUMAIT « EN REVUE » POUR TOUT LE MONDE         ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur, en désignant la carte : « l'état KYC est juste ? »
   *
   * MESURÉ : non. Quatre pavés écrits EN DUR, et le deuxième peint sur l'aplat
   * orange `#FBE3D4` — l'exemple de la maquette. Un membre qui n'a jamais ouvert
   * de vérification lisait qu'il était en revue.
   *
   * Les quatre pavés RESTENT : la carte est une légende, elle dit ce qui peut
   * arriver. Ce qui devient une donnée, c'est LEQUEL est allumé, et la seconde
   * ligne de celui-là — « Nouvel essai possible dans 7 jours » est un exemple,
   * `retryAvailableAt` dit la vraie date.
   */
  readonly etatsKyc?: {
    readonly enCours?: boolean;
    readonly enCoursSous?: string;
    readonly enRevue?: boolean;
    readonly enRevueSous?: string;
    readonly refusee?: boolean;
    readonly refuseeSous?: string;
    readonly mineur?: boolean;
    readonly mineurSous?: string;
  };
  readonly verificationOccupe?: boolean;
  /**
   * VRAI QUAND IL N'Y A RIEN À VÉRIFIER — identité déjà validée, ou démarche en
   * revue. À DISTINGUER de `verificationOccupe` : mesuré, les confondre éteignait
   * aussi le bouton d'ajout de numéro pour un membre déjà vérifié.
   */
  readonly kycBloque?: boolean;
  readonly kycLibelle?: string;
}

/**
 * K04 — téléphones et sessions.
 *
 * 01 §2.1, RÈGLE DURE : aucun numéro en clair. `masque` reçoit `phones[].masked`,
 * le SEUL champ de numéro que `meResponseSchema` décrive — un `e164` qui
 * apparaîtrait un jour dans la réponse serait dépouillé à la validation, avant
 * d'atteindre cet écran.
 */
export interface LigneTelephone {
  /**
   * L'IDENTIFIANT, et il manquait : `DELETE /me/phones/:id` ne prend pas un
   * masque. Facultatif, parce que les lignes d'exemple de ce fichier sont des
   * dessins — on ne retire pas un dessin.
   */
  readonly id?: string;
  /** Le geste est sur la LIGNE : le cadre dessine un « Retirer » par numéro. */
  readonly onRetirer?: () => void;
  readonly masque: string;
  readonly role: string;
  /**
   * LES DEUX VARIANTES QUE LE CADRE MOBILE DESSINE, et pourquoi il en faut DEUX
   * champs plutôt qu'un booléen et sa négation.
   *
   * La planche de 390 px écrit « Dernier numéro, non retirable » sur la première
   * ligne et un bouton « Retirer » sur la seconde. Le cadre porte les deux sous
   * `<sc-if>`, et chacune a sa condition — exactement comme la pastille
   * « Actuelle » et le bouton « Révoquer » d'une session. Une seule variante liée
   * mentirait sur l'autre ligne.
   *
   * ÉCART SIGNALÉ : `meResponseSchema` ne porte AUCUN champ qui dise « ce numéro
   * se retire ». Ses `phones[]` s'arrêtent à `{ id, masked, isDestination }`. La
   * condition est donc calculée dans `appels.ts`, et elle recopie MOT POUR MOT
   * celle du serveur — `phones.length <= 1` refuse la suppression avec
   * `LAST_PHONE` (`phones.service.ts`, 01 §2.5 : sans numéro, plus aucune
   * connexion possible, il n'y a pas de mot de passe). Recopier une règle est un
   * risque de dérive, et c'est pour ça qu'on le DIT : le jour où le serveur ajoute
   * une seconde raison de refuser, l'écran proposera un bouton que l'API refusera.
   * Un `canRemove` dans la réponse de `/me` fermerait l'écart — demandé.
   *
   * Les deux ne sont jamais vrais ensemble ; la planche ne dessine pas les deux
   * côte à côte.
   */
  readonly retirable: boolean;
  readonly dernier: boolean;
}

export interface K04Data {
  readonly moi: Bandeau;
  readonly telephones: readonly LigneTelephone[];
  readonly sessions: readonly {
    readonly appareil: string;
    readonly vu: string;
    readonly courante: boolean;
    readonly revocable: boolean;
    /** L'identifiant : `DELETE /sessions/:id` ne prend pas un libellé d'appareil. */
    readonly id?: string;
    /**
     * LE GESTE EST SUR LA LIGNE, pas sur l'écran : le cadre dessine un bouton
     * « Révoquer » PAR SESSION, et une prise unique ne saurait pas laquelle.
     * Facultatif, parce que les lignes d'exemple de ce fichier sont des dessins.
     */
    readonly onRevoquer?: () => void;
  }[];
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LES GESTES DE « TÉLÉPHONES ET SESSIONS »                                ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Niveau page sécurité, l'ajout de numéro marche et la
   * révocation de SESSIONS ? » — ni l'un ni l'autre : les quatre contrôles
   * étaient dessinés, et « Révoquer toutes les autres » était même un
   * `<a href="#">`.
   *
   * Les routes existaient toutes : `POST /me/phones`, `DELETE /me/phones/:id`,
   * `DELETE /sessions/:id`, `DELETE /sessions`.
   */
  readonly onAjouterNumero?: () => void;
  readonly onRevoquerTout?: () => void;
  /** Vrai pendant un appel : les boutons s'éteignent plutôt que de partir deux fois. */
  readonly securiteOccupe?: boolean;
}

/** K05 — contacts, demandes et bloqués. */
export interface K05Data {
  readonly moi: Bandeau;
  readonly contacts: {
    readonly total: number;
    readonly demandes: number;
    readonly liste: readonly {
      readonly fond: string;
      readonly initiales: string;
      readonly nom: string;
      readonly depuis: string;
      readonly origine: string;
      /**
       * L'ADRESSE DU PROFIL PUBLIC — `/@handle`, ou absente. Le porteur :
       * « ajoute l'accès au profil public […] partout où le nom est affiché ».
       */
      readonly profil?: string;
    }[];
  };
  readonly bloque: { readonly nom: string; readonly date: string };
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LES TROIS SECTIONS ÉTAIENT DES LIGNES UNIQUES                           ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « La page des contacts est faite ? Les demandes, suggestions et
   * bloqués ? »
   *
   * MESURÉ : la maquette dessine UNE ligne par section — « Yasmine Benali »,
   * « Théo Adjovi », « Paul A. » — et le transcodage l'avait prise pour la liste.
   * Un membre avec trois demandes n'en voyait qu'une, et toujours la même. Les
   * quatre boutons — Accepter, Refuser, Ajouter, Débloquer — étaient en plus sans
   * geste.
   *
   * Les trois routes existaient : `GET /me/connection-requests`,
   * `GET /me/connection-suggestions`, `GET /me/blocks`.
   */
  readonly demandesRecues: readonly LigneContact[];
  readonly suggestions: readonly LigneContact[];
  readonly bloques: readonly LigneContact[];
  /** Vrai pendant un appel : les boutons s'éteignent plutôt que de partir deux fois. */
  readonly contactsOccupe?: boolean;
}

/**
 * Une ligne des trois sections de K05.
 *
 * `message`, `raison` et `date` occupent la MÊME place dans le dessin — la
 * seconde ligne grise — et ne diffèrent que par ce qu'elles disent. Un seul champ
 * `sous` aurait été plus court ; trois noms disent ce qu'on lit, et les trois
 * sections ne se mélangent pas quand on relit le chargeur.
 */
export interface LigneContact {
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
  /** La seconde ligne : le message d'une demande, la raison d'une suggestion… */
  readonly message: string;
  readonly raison: string;
  /** …ou « Bloqué le 3 mars » pour un blocage. */
  readonly date: string;
  /**
   * L'IDENTIFIANT DE LA LIGNE — celui de la demande, de la suggestion ou du
   * membre bloqué. Les trois routes en ont besoin, et un nom d'affichage n'en
   * est pas un.
   */
  readonly cle: string;
  /** `POST /blocks` et `POST /connection-suggestions/accept` prennent un HANDLE. */
  readonly handle: string;
  /** L'origine d'une suggestion — `acceptSuggestionSchema` l'exige. */
  readonly origine?: string;
  /** Accepter une demande, ajouter une suggestion, débloquer. */
  readonly onPrincipal?: () => void;
  /** Refuser une demande. Absent ailleurs : les deux autres n'ont qu'un geste. */
  readonly onSecondaire?: () => void;
}

/** K06 — abonnement, prix et factures. */
export interface K06Data {
  readonly moi: Bandeau;
  readonly abonnement: {
    readonly plan: string;
    readonly essai: number;
    readonly contactsPro: string;
  };
  /**
   * Les prix de Premium, et pourquoi il en faut TROIS formes et non deux.
   *
   * `prixMois` et `prixXof` portent la période (« 4 €/mois », « 2 600 F/mois ») :
   * c'est ce que la planche K06 écrit, dans une phrase. `montantXof` est le même
   * franc SANS période — « Payer 2 600 F », le libellé du bouton de la fenêtre
   * Mobile Money, qui nomme une somme à payer maintenant et non un tarif.
   *
   * Trois champs plutôt qu'un découpage fait dans le JSX : retirer « /mois » d'une
   * chaîne déjà formatée est le genre de manipulation qui casse à la première
   * devise sans suffixe. Les trois viennent du même `GET /plans`.
   */
  readonly premium: {
    readonly prixMois: string;
    readonly prixXof: string;
    readonly montantXof: string;
  };
  readonly factures: { readonly derniere: string; readonly precedente: string };
}

/** K07 — réglages de notification. */
export interface K07Data {
  readonly moi: Bandeau;
  readonly prefs: {
    readonly email: string;
    readonly calmeDebut: string;
    readonly calmeFin: string;
    readonly resume: string;
  };
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ LES CATÉGORIES — SIX RANGS DESSINÉS DEVENAIENT LA LISTE DE TOUT LE MONDE ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Le porteur : « Les configurations des notifications ? »
   *
   * MESURÉ : la planche dessine six catégories EN DUR avec leurs dix-huit
   * interrupteurs, tous des `<span>`. `GET /me/notification-preferences` rend
   * pourtant la vraie liste, avec les libellés composés par le serveur.
   *
   * LES TROIS VALEURS DE DESSIN VOYAGENT EN DONNÉES — fond, position du bouton,
   * opacité — plutôt que d'être recalculées dans le cadre. C'est la règle du
   * dépôt : le cadre dessine, il ne décide pas.
   */
  readonly categories: readonly CategorieNotification[];
  /** Vrai pendant l'enregistrement : les interrupteurs s'éteignent. */
  readonly notificationsOccupe?: boolean;
}

/** Un rang de la matrice : la catégorie et ses trois canaux. */
export interface CategorieNotification {
  readonly titre: string;
  readonly sous: string;
  readonly appliFond: string;
  readonly appliGauche: string;
  readonly appliOpacite: string;
  readonly appliActif: boolean;
  readonly appliVerrouille: boolean;
  readonly appliNom: string;
  readonly onAppli?: () => void;
  readonly pushFond: string;
  readonly pushGauche: string;
  readonly pushOpacite: string;
  readonly pushActif: boolean;
  readonly pushVerrouille: boolean;
  readonly pushNom: string;
  readonly onPush?: () => void;
  readonly emailFond: string;
  readonly emailGauche: string;
  readonly emailOpacite: string;
  readonly emailActif: boolean;
  readonly emailVerrouille: boolean;
  readonly emailNom: string;
  readonly onEmail?: () => void;
  /** La clé serveur (`NotificationCategory`), pour `PUT`. */
  readonly cle: string;
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ K08 — MES DONNÉES : TROIS BOUTONS, ZÉRO GESTE                             ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « La page des sanctions et ses options ? (suppression de compte,
 * désactivation et lancement de téléchargement de données). Pour le
 * téléchargement on prépare et dès que prêt on l'informe pour qu'il vienne
 * télécharger. »
 *
 * `exportEtat` REMPLACE UNE PROMESSE PAR UN ÉTAT. La planche écrit « Préparé sous
 * 48 h. Lien valable 7 jours. » — une phrase vraie en général et fausse pour qui
 * attend. `GET /me/export/latest` rend le vrai : jamais demandé, en préparation,
 * prêt, ou périmé.
 *
 * `exportLien` NON NUL = l'archive est là. Le bouton « Demander » se change alors
 * en lien « Télécharger » : télécharger est une destination, demander est un
 * geste, et un seul contrôle pour les deux mentirait à l'un des deux moments.
 */
export interface K08Data {
  readonly moi: Bandeau;
  readonly exportEtat?: string;
  readonly exportLien?: string | null;
  readonly onDemanderExport?: () => void;
  readonly onDesactiver?: () => void;
  readonly donneesOccupe?: boolean;
}

/**
 * K09 — sanctions. `etat` et la date viennent du SERVEUR, jamais de l'horloge
 * locale.
 *
 * ── LA CONTESTATION ÉTAIT UN TEXTE D'EXEMPLE ──────────────────────────────
 *
 * Le porteur : « La page des sanctions et ses options ? »
 *
 * MESURÉ : zéro champ sur le cadre. La boîte « Expliquez votre point de vue »
 * portait la phrase d'exemple de la maquette, et « Envoyer ma contestation »
 * n'avait aucun geste. `POST /sanctions/:id/appeal` répondait déjà.
 *
 * `contestationBloquee` : `appealSchema` exige VINGT caractères. Le bouton reste
 * éteint en dessous plutôt que de prendre un refus — « une seule fois », dit la
 * planche, et un échec gâcherait l'unique tentative dans l'esprit du membre même
 * si le serveur ne la compte pas.
 */
export interface K09Data {
  readonly moi: Bandeau;
  /** `null` quand aucune sanction : il n'y a alors rien à contester. */
  readonly sanctionId?: string | null;
  readonly contestationTexte?: string;
  readonly onContestationTexte?: (e: { readonly target: { readonly value: string } }) => void;
  readonly onContester?: () => void;
  readonly contestationBloquee?: boolean;
  readonly sanction: {
    readonly type: string;
    readonly regle: string;
    readonly date: string;
    readonly etat: string;
  };
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ K10 — LES ENREGISTRÉS, ET LES ROUTES QUI MANQUAIENT                       ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Finalise les routes bookmarks et branche-les. »
 *
 * Cet écran a longtemps été LE SEUL des dix sans source : `apps/api/src/modules/
 * bookmarks/` ne contenait qu'un service et sa tâche horaire, sans contrôleur.
 * Les quatre routes de §2.9 existent maintenant et répondent — mesuré sur un
 * compte neuf : quatre `PUT` acceptés, `GET` qui rend les quatre avec
 * `meta.parType`, `DELETE` qui fait tomber le total de 4 à 3.
 */
export interface K10Data {
  readonly moi: Bandeau;
  /** « 14 enregistrés » — de `meta.total`, jamais compté sur la page courante. */
  readonly compte: string;
  readonly onglets: readonly OngletEnregistres[];
  readonly lignes: readonly LigneEnregistree[];
  /**
   * Vrai quand il n'y a RIEN À MONTRER — pas « zéro signet », mais « zéro dans
   * l'onglet courant ». Le bloc vide de la planche « ÉTATS » prend alors la place
   * de la liste. C'est le premier état que voit un compte neuf.
   */
  readonly vide: boolean;
  /** Vrai pendant un retrait : le signet s'éteint plutôt que de partir deux fois. */
  readonly enregistresOccupe?: boolean;
}

/**
 * Un onglet de filtre — « Tout », puis un par espèce de sujet.
 *
 * LE FOND, LA COULEUR ET LA BORDURE SONT DES DONNÉES parce que la maquette
 * dessine les DEUX variantes, choisie et non choisie, avec leurs six valeurs. Les
 * recopier dans le cadre figerait « Tout » comme choisi pour toujours.
 */
export interface OngletEnregistres {
  /** `'*'` pour « Tout », sinon un `BookmarkSubjectType`. */
  readonly cle: string;
  readonly libelle: string;
  readonly fond: string;
  readonly texte: string;
  readonly bord: string;
  readonly actif: boolean;
  readonly onChoisir: () => void;
}

/** Une ligne d'enregistré, telle que la maquette en dessine six. */
export interface LigneEnregistree {
  /** `TYPE:id` — ce que `DELETE /me/bookmarks/:type/:id` demande, en un morceau. */
  readonly cle: string;
  /**
   * LE TRACÉ SVG DE L'ICÔNE, dicté par le type du sujet.
   *
   * La maquette dessine six tracés différents sur ses six lignes : un livre pour
   * le guide, une étoile pour la story, un cœur pour l'entraide, un calendrier
   * pour l'événement, un toit pour l'annonce, une bulle pour la publication. Ce
   * n'est pas de la décoration — une fois la pastille d'état posée, c'est la
   * SEULE chose qui dise de quoi la ligne parle.
   */
  readonly icone: string;
  readonly titre: string;
  /**
   * LE LIBELLÉ D'ÉTAT, OU LA CHAÎNE VIDE.
   *
   * `BookmarkState` le dit dans sa propre documentation : « `AVAILABLE` n'a PAS
   * de libellé : c'est l'absence de pastille, le cas normal ». Vide, le cadre ne
   * dessine pas la pastille.
   */
  readonly etat: string;
  readonly etatFond: string;
  readonly etatTexte: string;
  /** « enregistré hier » — relatif, comme la maquette l'écrit. */
  readonly depuis: string;
  /** `'.55'` quand le contenu a disparu, `'1'` sinon. La maquette dessine les deux. */
  readonly opacite: string;
  /** L'adresse du contenu, ou la chaîne vide : un contenu retiré n'en a plus. */
  readonly href: string;
  readonly onRetirer: () => void;
}

/**
 * Les cadres qui ne consomment RIEN — les cinq planches de fenêtre.
 *
 * `Record<string, never>` plutôt qu'un alias de `{}` : `{}` accepte n'importe
 * quelle valeur non nulle en TypeScript, y compris un nombre ou une chaîne. Un
 * type qui n'interdit rien ne dirait pas que le cadre ne consomme rien.
 */
export type CompteData = Record<string, never>;

/**
 * LES FENÊTRES QUE CE MODULE OUVRE.
 *
 * Le nom est celui que le transcodeur pose en `data-modal-open` sur le bouton
 * déclencheur, et que `Modal` reçoit en `name`. L'identifiant de titre est celui
 * que le transcodeur dérive de la SECTION de la maquette — `k02-titre` pour la
 * fenêtre d'ajout aux contacts, parce qu'elle est dessinée dans la section K02.
 */
export const MODALES = {
  /** K02 — « Ajouter Fatou aux contacts », avec le motif (T5 K02). */
  K02C: { titleId: 'k02-titre' },
  /** K06 — « Payer avec Mobile Money », trois volets (14 §4.2). */
  K06M: { titleId: 'k06-titre' },
  /** K08 — « Supprimer mon compte », la confirmation détaillée (T5 K08). */
  K08S: { titleId: 'k08-titre' },
} as const;

export type NomModale = keyof typeof MODALES;

/**
 * LES TROIS VOLETS DU PAIEMENT MOBILE MONEY, et pourquoi ils passent par l'URL.
 *
 * 14 §4.2 : « choix du plan → saisie du numéro → notification USSD/push de
 * l'opérateur → webhook de confirmation → activation. Timeout 5 minutes ». Les
 * deux derniers volets n'ont AUCUN contrôle dans la maquette : « attente » est un
 * sablier, « succès » une confirmation. Ce qui les fait avancer, c'est le réseau —
 * et ce lot ne branche aucune route de paiement.
 *
 * Le paramètre d'URL les rend atteignables sans rien affirmer, exactement comme
 * `?etat=` le fait dans le module Parcours pour les états dont la maquette ne
 * dessine pas le contrôle. Il n'ajoute aucun pixel et se teste.
 *
 * L'ordre est celui de la maquette — « Étape 1 sur 3 », « 2 · ATTENTE »,
 * « 3 · SUCCÈS » — et l'index sert aussi de `phase` à `Modal` : la feuille AVANCE
 * d'un cran au lieu de se rouvrir.
 */
export const VOLETS_PAIEMENT = ['numero', 'attente', 'succes'] as const;

export type VoletPaiement = (typeof VOLETS_PAIEMENT)[number];

/** Le volet demandé par l'URL, ou `null` si le paramètre est absent ou inconnu. */
export function voletPaiement(valeur: string | string[] | undefined): VoletPaiement | null {
  if (typeof valeur !== 'string') return null;
  return (VOLETS_PAIEMENT as readonly string[]).includes(valeur) ? (valeur as VoletPaiement) : null;
}
