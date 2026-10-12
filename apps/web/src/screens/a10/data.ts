/**
 * Les PRISES de l'écran A10 — « créer un réseau d'intérêt ».
 *
 * Déclarées et non déduites d'un exemple : voir l'en-tête de `a07/data.ts`.
 *
 * ── LES DEUX PORTES DE CET ÉCRAN, ET AUCUNE N'EST GARDÉE PAR LE FRONT ──────
 *
 * Créer un réseau franchit deux refus possibles, et l'écran ne DEVANCE ni l'un
 * ni l'autre :
 *
 *   1. LE NIVEAU. `community.create` est **L2** (N2) — et cet en-tête disait L1,
 *      ce qui était périmé : la table des capacités fait foi
 *      (`packages/shared/src/capabilities/capabilities.ts`, « 'community.create':
 *      { minLevel: 'L2' } »), et c'est l'arbitrage du porteur sur la refonte des
 *      niveaux (mémo §5 : « N2 — tout le reste, sans exception »).
 *
 *      On ne lit PAS le niveau pour griser le bouton — un niveau lu une fois et
 *      gardé, c'est la faille de quinze minutes rejouée dans le front. On TENTE,
 *      et le serveur répond :
 *
 *        403 LEVEL_REQUIRED · requiredLevel "L2" · currentLevel "L0"
 *                           · labelFr "créer un réseau"
 *
 *      C'est de quoi afficher l'INVITATION à monter de niveau que §7.3 exige —
 *      une invitation, jamais une erreur sèche. `GardeNiveau` la montre dès
 *      l'arrivée sur la page, parce qu'une page de création a une ADRESSE : sans
 *      elle, on remplit le formulaire entier avant d'apprendre le refus.
 *
 *   2. LE SEUIL DE LA VILLE. `creationGate` arrive dans `GET /communities` et
 *      porte `canCreate`, `required`, `current`, `cityName`. Il est RECALCULÉ à
 *      chaque appel côté serveur, donc il ne périme pas ; il sert à écrire la
 *      phrase entière — « Les réseaux d'intérêt ouvrent à partir de 50 membres à
 *      Lyon (34 aujourd'hui) » — et non à autoriser. Le service revérifie le
 *      seuil à la création, sinon un appel direct suffirait à le contourner.
 *
 * LA RÈGLE DES CINQ INVITATIONS, elle, est dans le SCHÉMA PARTAGÉ
 * (`COMMUNITY_MIN_INVITES`). Le compteur « 3 sur 5 » de cet écran lit la même
 * constante que l'API refuse : c'est ce qui empêche l'écran d'autoriser quatre
 * invités là où le serveur en exige cinq.
 *
 * ── LA LISTE DES CANDIDATS EST PEUPLÉE DEPUIS CE LOT ───────────────────────
 *
 * Elle arrivait VIDE, et cet en-tête l'annonçait comme un manque : sans candidat,
 * le compteur ne pouvait pas atteindre cinq et « Créer le réseau » ne s'allumait
 * jamais. `useContactsInvitables` (`screens/reseaux/`) la remplit depuis
 * `GET /me/connections`, en RÉEMPLOYANT l'appel que trois autres écrans font
 * déjà. Les deux écarts de maquette qui restent — la ville sous chaque nom, et la
 * pastille de vérification — sont nommés dans l'en-tête de ce crochet.
 */
import {
  COMMUNITY_CATEGORIES,
  COMMUNITY_CATEGORY_LABELS,
  COMMUNITY_MIN_INVITES,
  communityDescriptionSchema,
  communityNameSchema,
  type CommunityCategory,
} from '@app/shared';

export { I, panel, panelReseaux, rail } from '../reseaux/chrome';
import { panel, panelReseaux, rail } from '../reseaux/chrome';

/**
 * La première catégorie du contrat partagé — la valeur par défaut du menu.
 *
 * `COMMUNITY_CATEGORIES[0]` sous `noUncheckedIndexedAccess` est
 * `CommunityCategory | undefined` : le repli nommé est donc explicite, et il est
 * pris DANS la liste plutôt qu'écrit à la main.
 */
const PREMIERE_CATEGORIE: CommunityCategory = COMMUNITY_CATEGORIES[0] ?? 'autre';

/**
 * LES DEUX ÉTATS DU BOUTON « CRÉER LE RÉSEAU », et d'où viennent leurs couleurs.
 *
 * ÉTEINT : exactement ce que la maquette dessine sur les deux planches —
 * `#CFE3DA` sur `#5D8A79`. C'est le seul état qu'elle montre.
 *
 * ALLUMÉ : EMPRUNTÉ à A07, l'écran voisin du même module, qui peint son action
 * principale « Créer un réseau d'intérêt » en `#16785E` sur `#fff`. C'est la
 * paire d'action primaire de cette maquette ; aucune couleur n'est assombrie ni
 * inventée.
 */
const CREER_ETEINT = { fond: '#CFE3DA', encre: '#5D8A79' } as const;
export const CREER_ALLUME = { fond: '#16785E', encre: '#fff' } as const;
export const CREER_INACTIF = CREER_ETEINT;

/**
 * Une ligne de la liste d'invitation.
 *
 * `handle` n'est jamais dessiné : c'est pourtant lui que `POST /communities`
 * attend — `inviteHandles` est une liste de HANDLES, pas d'identifiants. Il
 * voyage donc avec la ligne, faute de quoi il faudrait le retrouver par le nom
 * affiché, qui n'est pas unique.
 *
 * `invited` pilote les trois prises de bouton ensemble. Elles sont posées par le
 * convertisseur plutôt que calculées dans le JSX, parce que le JSX transcodé ne
 * décide de rien.
 */
export interface InviteeView {
  /**
   * L'ADRESSE DU PROFIL PUBLIC — `/@handle`, ou absente.
   *
   * Le porteur : « ajoute l'accès au profil public d'un utilisateur à partir des
   * publications (quand on clique sur son nom […]) partout où le nom est
   * affiché ». Les trente-sept noms dessinés dans les cadres étaient des `<span>`
   * et aucun ne menait au profil.
   *
   * FACULTATIVE, ET C'EST LA GARDE : tous les noms ne sont pas des membres — un
   * réseau, une ville, un partenaire en portent un aussi — et le cadre ne pose le
   * lien que si la ligne porte une adresse. Sans elle, le nom reste nu, c'est-à-
   * dire exactement le dessin d'avant.
   */
  readonly profil?: string;
  readonly i: string;
  readonly name: string;
  readonly sub: string;
  readonly bg: string;
  readonly invited: boolean;
  readonly btn: string;
  readonly btnBg: string;
  readonly btnFg: string;
  readonly handle: string;
}

/**
 * Les trois visibilités de §7.
 *
 * « Sur invitation » est INVISIBLE dans Découvrir — la maquette l'écrit, et
 * c'est la règle du dossier, pas un détail d'affichage : le service l'exclut du
 * `WHERE` de la découverte. Le libellé dit donc une conséquence réelle.
 */
export const visibilityFor = (active: number) =>
  [
    { t: 'Public', s: 'Tout membre peut voir et rejoindre.', v: 'PUBLIC' as const },
    {
      t: 'Sur demande',
      s: 'Les membres demandent à rejoindre, vous acceptez.',
      v: 'ON_REQUEST' as const,
    },
    {
      t: 'Sur invitation',
      s: 'Invisible dans Découvrir. Accès par invitation seulement.',
      v: 'INVITE_ONLY' as const,
    },
  ].map((x, i) => {
    const on = i === active;
    return {
      t: x.t,
      s: x.s,
      v: x.v,
      on,
      bg: on ? '#EFF7F3' : '#fff',
      bd: on ? '1.5px solid #16785E' : '1px solid #E6EBE9',
      radio: on ? '6px solid #16785E' : '1.5px solid #CBD5D1',
    };
  });

export const visibility = visibilityFor(0);

export const invitees: readonly InviteeView[] = [];

/**
 * Une entrée du menu de catégorie.
 *
 * `value` est la clé que `POST /communities` attend, `label` le mot français.
 * Les deux viennent de `COMMUNITY_CATEGORIES` et `COMMUNITY_CATEGORY_LABELS` —
 * la liste est FERMÉE côté serveur, et la recopier ici la ferait divorcer.
 */
export interface CategorieOption {
  readonly value: CommunityCategory;
  readonly label: string;
}

/**
 * Les onze catégories, dans l'ordre du contrat partagé.
 *
 * `COMMUNITY_CATEGORIES` fixe l'ordre, pas nous : un tri alphabétique ici ferait
 * que la première entrée — celle qu'un menu natif présente par défaut — ne serait
 * plus la même que celle que le schéma énumère en premier.
 */
export const categorieOptions: readonly CategorieOption[] = COMMUNITY_CATEGORIES.map((v) => ({
  value: v,
  label: COMMUNITY_CATEGORY_LABELS[v],
}));

export interface A10Data {
  rail: typeof rail;
  shortcuts: readonly { name: string; sub: string; i: string; bg: string }[];
  panelReseaux: ReturnType<typeof panel>;
  visibility: ReturnType<typeof visibilityFor>;
  invitees: readonly InviteeView[];

  // ── Le nom, et sa borne ───────────────────────────────────────────────────
  nomValue: string;
  onNomChange: (event: { readonly target: { readonly value: string } }) => void;
  /**
   * La borne du serveur, posée en `maxLength` par le transcodeur.
   *
   * Elle est LUE sur `communityNameSchema` et non recopiée : `@app/shared`
   * n'exporte pas de constante pour ce champ, mais Zod expose `.maxLength`. C'est
   * la même source que l'API applique — la seule façon de ne pas en avoir deux.
   */
  nomMax: number;

  // ── La couverture : « Ajouter une couverture », sur les deux planches ──────
  /**
   * L'adresse ABSOLUE de l'image déposée, pour l'aperçu dans la zone pointillée,
   * ou `null` tant que rien n'est choisi. Le porteur : « Ajouter une couverture
   * ne marche pas ? » — la zone était un `<div>` inerte.
   */
  couvertureUrl: string | null;
  /** Le dépôt est en cours : la zone dit « Envoi… » et ne se rouvre pas. */
  couvertureOccupee: boolean;
  onCouverture: (event: { target: { files: FileList | null; value: string } }) => void;

  // ── La description : la planche de 390 px ne la dessine pas ───────────────
  descriptionValue: string;
  onDescriptionChange: (event: { readonly target: { readonly value: string } }) => void;
  descriptionMax: number;

  // ── La recherche de candidats : ORDINATEUR SEULEMENT ─────────────────────
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ « RECHERCHER PAR PSEUDO » ÉTAIT UN `<div>` INERTE                       ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * La planche de 1 440 px dessine un champ arrondi de 46 px portant une loupe et
   * le texte « Rechercher par pseudo », en `<div>` : aucune frappe possible. Il
   * est vivant depuis ce lot (`A10_RECHERCHE`), et il filtre la liste des
   * candidats sur le PSEUDO **et** sur le NOM — le libellé ne promet que le
   * pseudo, mais c'est le nom qui est affiché en gros sur chaque ligne, et
   * chercher « Sandra » sans rien trouver serait une surprise.
   *
   * ⚠ LA PLANCHE DE 390 PX NE DESSINE PAS CE CHAMP, vérifié dans la maquette : le
   * téléphone passe de la pastille « 3 sur 5 » directement aux quatre lignes de
   * candidats. On choisit donc ses invités au pouce en PARCOURANT la liste et en
   * touchant « Inviter » sur chaque ligne — ce qui marche, puisque la planche
   * mobile dessine bien la liste et ses boutons. Aucun champ n'est AJOUTÉ sur le
   * téléphone : ce serait dessiner à la place du porteur. REMONTÉ.
   */
  rechercheValue: string;
  onRechercheChange: (event: { readonly target: { readonly value: string } }) => void;

  // ── La catégorie : le seul dessin EMPRUNTÉ de l'écran ────────────────────
  /**
   * `createCommunitySchema` l'exige et A10 ne la dessine NULLE PART — ni sur la
   * planche de 1 440 px, ni sur celle de 390 px. La pastille « Catégorie ▾ » est
   * empruntée à la planche MOB d'A03 de la MÊME maquette, et un menu natif
   * transparent est posé dessus. Remonté : c'est un manque de la maquette, pas
   * un choix.
   */
  categorie: CommunityCategory;
  /** Le mot écrit DANS la pastille — le libellé de la catégorie choisie. */
  categorieLabel: string;
  categorieOptions: readonly CategorieOption[];
  onCategorie: (event: { readonly target: { readonly value: string } }) => void;

  // ── Les gestes ────────────────────────────────────────────────────────────
  /** Le RANG de la visibilité choisie, qui est ce que `choisirVisibilite` attend. */
  onVisibilite: (index: number) => void;
  /** Le HANDLE, et non le rang : `inviteHandles` est une liste de pseudos. */
  onInviter: (handle: string) => void;
  onCreer: () => void;
  onFermer: () => void;

  /**
   * ── LE BOUTON « CRÉER LE RÉSEAU » ───────────────────────────────────────
   *
   * `creerPret` l'éteint, et n'autorise RIEN : la règle des cinq invitations est
   * dans `createCommunitySchema`, que le serveur revérifie. Éteindre évite un
   * aller-retour dont la seule issue serait un refus.
   *
   * `creerFond` et `creerEncre` existent parce que la maquette ne dessine QUE
   * l'état éteint (`#CFE3DA` sur `#5D8A79`, avec « Invitez encore 2 membres »
   * dessous). La paire allumée est EMPRUNTÉE à A07, qui peint son action
   * principale « Créer un réseau d'intérêt » en `#16785E` sur `#fff`.
   */
  creerPret: boolean;
  creerFond: string;
  creerEncre: string;

  /**
   * ── LE COMPTEUR D'INVITATIONS, QUI ÉTAIT PEINT EN DUR ───────────────────
   *
   * « 3 sur 5 », une barre à 60 % et « Invitez encore 2 membres » étaient
   * dessinés sur un écran où aucune invitation n'était choisie. Les trois sont
   * maintenant des prises, et `invitesReste` porte la PHRASE ENTIÈRE pour pouvoir
   * disparaître quand le compte est atteint.
   */
  invitesTexte: string;
  invitesBarre: string;
  invitesReste: string;
  /** La forme raccourcie que la planche de 390 px écrit faute de place. */
  invitesResteCourt: string;
}

export const shortcuts: readonly { name: string; sub: string; i: string; bg: string }[] = [];

/**
 * Le repli : la maquette SANS ses exemples, et sans aucun geste.
 *
 * Il sert au rendu serveur, avant que `useCreation` ne prenne la main. Les
 * gestes y sont des fonctions vides — pas une erreur, pas un `throw` : ce cadre
 * n'est à l'écran que le temps d'un rendu, et un `throw` au clic serait la seule
 * chose plus inutile que de ne rien faire.
 */
export const a10Fallback: A10Data = {
  rail,
  shortcuts,
  panelReseaux,
  visibility,
  invitees,
  nomValue: '',
  onNomChange: () => {},
  couvertureUrl: null,
  couvertureOccupee: false,
  onCouverture: () => {},
  nomMax: communityNameSchema.maxLength ?? 0,
  descriptionValue: '',
  onDescriptionChange: () => {},
  descriptionMax: communityDescriptionSchema.maxLength ?? 0,
  rechercheValue: '',
  onRechercheChange: () => {},
  categorie: PREMIERE_CATEGORIE,
  categorieLabel: COMMUNITY_CATEGORY_LABELS[PREMIERE_CATEGORIE],
  categorieOptions,
  onCategorie: () => {},
  onVisibilite: () => {},
  onInviter: () => {},
  onCreer: () => {},
  onFermer: () => {},
  creerPret: false,
  creerFond: CREER_ETEINT.fond,
  creerEncre: CREER_ETEINT.encre,
  invitesTexte: `0 sur ${COMMUNITY_MIN_INVITES}`,
  invitesBarre: '0%',
  invitesReste: '',
  invitesResteCourt: '',
};
