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
 * ── ÉCART SIGNALÉ AU PORTEUR ────────────────────────────────────────────────
 *
 * « 8 offres à Lyon et en télétravail » n'est PAS lié : le `meta` de `GET /jobs`
 * ne porte aucun `total`, là où `GET /housing` en porte un. Compter `items` côté
 * front donnerait le compte de la PAGE (20 au plus), pas celui de la recherche.
 */
export interface S04Data {
  readonly moi: Moi;
  readonly quotas: Quotas;
  readonly offres: {
    /** La TÊTE sponsorisée d'abord (au plus deux, §11), puis le classement naturel. */
    readonly liste: readonly CarteOffre[];
  };
  readonly profils: {
    readonly liste: readonly CarteProfil[];
  };
}

export interface CarteOffre {
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
}
