import type { VivantProfils } from '../services/use-contacter-membre';
import type { Onglet } from '../services/navigation';
import type { Moi, Quotas } from '../services/data';

/**
 * S04 — « Bourses et emploi » (`/services/emploi`, 10 §3).
 *
 * DEUX ROUTES POUR UN ÉCRAN, et c'est la maquette qui le veut : la planche
 * d'ordinateur montre les offres au centre (`GET /jobs`) et « PROFILS
 * DISPONIBLES » dans la colonne de contexte (`GET /job-seekers`). Ce ne sont pas
 * deux onglets mais deux cartes, dessinées côte à côte.
 *
 * ── RÈGLE DURE 10 §3.1 et §11 : « SPONSORISÉE », TOUJOURS VISIBLE ───────────
 *
 * `sponsorisee` et `pastille` arrivent ENSEMBLE, parce que `GET /jobs` les rend
 * ensemble (`isSponsored`, `sponsoredLabel`). Le libellé vient du SERVEUR : un
 * front qui le posséderait pourrait l'« oublier », et la mise en avant cesserait
 * d'être signalée sans que rien ne le dise.
 *
 * `isSponsored` est calculé par le serveur SUR LA DATE et non recopié de la
 * colonne — une mise en avant expirée doit cesser d'être annoncée, même si la
 * tâche `sponsored.expire` a du retard. Le recalculer ici demanderait de comparer
 * `sponsoredUntil` à l'horloge du navigateur.
 *
 * ── LE SOUS-TITRE ET LES TROIS ONGLETS (lot E2) ─────────────────────────────
 *
 * « 8 offres à Lyon et en télétravail » est lié à `GET /jobs` → `meta.total`, qui
 * existe désormais comme celui de `GET /housing` : « N offres en ligne ». « Lyon »
 * était la ville de l'exemple et la requête ne filtre sur aucune.
 *
 * La bande « Offres | Profils disponibles | Mon profil de recherche » devient trois
 * liens (`?onglet=`) : `onglet` dit lequel est montré. « Mon profil de recherche »
 * est le formulaire `PUT /me/job-seeker-profile` (ajout hors maquette, composant
 * `FormulaireProfilRecherche`) ; « Profils disponibles » montre `GET /job-seekers`
 * en pleine colonne avec « Voir plus ».
 */
export type OngletEmploi = 'offres' | 'profils' | 'recherche';

export interface S04Data {
  /** Lequel des trois onglets est montré — posé par la page, lu dans `?onglet=`. */
  readonly onglet: OngletEmploi;
  /**
   * Faux pour le SQUELETTE affiché pendant le chargement. Les états vides (« Aucune
   * offre », « Aucun profil ») et le formulaire ne se montrent que quand il est vrai :
   * annoncer « aucun profil disponible » le temps d'un appel serait mentir.
   */
  readonly pret: boolean;
  readonly moi: Moi;
  readonly quotas: Quotas;
  /** « Contacter » un profil : posé par la page. */
  readonly vivant: VivantProfils;
  readonly onglets: readonly Onglet[];
  readonly offres: {
    /** La TÊTE sponsorisée d'abord (au plus deux, §11), puis le classement naturel. */
    readonly liste: readonly CarteOffre[];
    /** `meta.total` : toute la recherche, pas la page. */
    readonly total: number;
    /** « 8 offres en ligne », écrit à partir du total. */
    readonly sousTitre: string;
  };
  readonly profils: {
    readonly liste: readonly CarteProfil[];
    /** Le curseur de la page suivante, ou `null` quand il n'y en a plus. */
    readonly suite: string | null;
  };
}

export interface CarteOffre {
  readonly id: string;
  /** `/services/emploi/:id` — la fiche de l'offre. */
  readonly href: string;
  /** `isSponsored` — décidé par le serveur sur la date, jamais recalculé ici. */
  readonly sponsorisee: boolean;
  /** `sponsoredLabel` — « Sponsorisée », et c'est le serveur qui l'écrit (§11). */
  readonly pastille: string;
  /** Le kind de l'offre (§3.1) dans les mots de la maquette. */
  readonly genre: string;
  readonly titre: string;
  /** « Cabinet Arvel · Lyon 3e », ou « · Télétravail » quand `city` est `null`. */
  readonly ou: string;
  readonly contrat: string;
  readonly secteur: string;
  /** `sharedBy` — « Partagée par Sandra M. », composée par le SERVEUR (§3.1). */
  readonly partage: string;
}

/**
 * Un profil de recherche (§3.2).
 *
 * §3.2 : « Aucun CV stocké en V1 ; le membre l'envoie lui-même en message. » Ce
 * type n'a donc aucun champ de fichier, et `jobSeekerCardSchema` est `.strict()` —
 * un champ de CV qui apparaîtrait dans la réponse ferait refuser la charge.
 */
export interface CarteProfil {
  /** Le pseudo du membre : « Contacter » ouvre une conversation avec lui. */
  readonly handle: string;
  readonly prenom: string;
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
  /** `headline` — « Assistante RH · alternance », écrite par le membre. */
  readonly titre: string;
  /** Les secteurs recherchés, tels que le membre les a écrits (§3.2). */
  readonly secteurs: readonly string[];
  /** Les types de contrat recherchés. */
  readonly contrats: readonly string[];
  /** La ville du membre (`member.city`), ou `null`. */
  readonly ville: string | null;
}

/** Ce que `chargerS04` lit de l'API ; la page y ajoute `vivant` et `onglet`. */
export type S04Charge = Omit<S04Data, 'vivant' | 'onglet'>;
