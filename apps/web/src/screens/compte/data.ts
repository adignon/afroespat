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
export interface Bandeau {
  readonly nom: string;
  readonly initiales: string;
  readonly pseudo: string;
  readonly niveau: number;
  readonly prenom: string;
  /** Demandes de contact REÇUES. `0` fait disparaître la pastille (`<sc-if>`). */
  readonly demandes: number;
}

/** K01 — mon profil. `profil` mêle `GET /me` et `GET /users/{pseudo}` : voir `appels.ts`. */
export interface K01Data {
  readonly moi: Bandeau;
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
}

/** K02 — le profil public d'un autre membre (`GET /users/{pseudo}`). */
export interface K02Data {
  readonly moi: Bandeau;
  readonly membre: {
    readonly nom: string;
    readonly initiales: string;
    readonly pseudo: string;
    readonly niveau: number;
    readonly phase: string;
    readonly ville: string;
    readonly pays: string;
    readonly depuis: string;
    readonly bio: string;
    readonly aides: string;
    readonly entraides: number;
  };
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
}

/**
 * K04 — téléphones et sessions.
 *
 * 01 §2.1, RÈGLE DURE : aucun numéro en clair. `masque` reçoit `phones[].masked`,
 * le SEUL champ de numéro que `meResponseSchema` décrive — un `e164` qui
 * apparaîtrait un jour dans la réponse serait dépouillé à la validation, avant
 * d'atteindre cet écran.
 */
export interface K04Data {
  readonly moi: Bandeau;
  readonly telephones: readonly { readonly masque: string; readonly role: string }[];
  readonly sessions: readonly {
    readonly appareil: string;
    readonly vu: string;
    readonly courante: boolean;
    readonly revocable: boolean;
  }[];
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
    }[];
  };
  readonly bloque: { readonly nom: string; readonly date: string };
}

/** K06 — abonnement, prix et factures. */
export interface K06Data {
  readonly moi: Bandeau;
  readonly abonnement: {
    readonly plan: string;
    readonly essai: number;
    readonly contactsPro: string;
  };
  readonly premium: { readonly prixMois: string; readonly prixXof: string };
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
}

/** K08 — mes données. Le bandeau seul : la planche ne dessine aucun état. */
export interface K08Data {
  readonly moi: Bandeau;
}

/** K09 — sanctions. `etat` et la date viennent du SERVEUR, jamais de l'horloge locale. */
export interface K09Data {
  readonly moi: Bandeau;
  readonly sanction: {
    readonly type: string;
    readonly regle: string;
    readonly date: string;
    readonly etat: string;
  };
}

/** K10 — enregistrés. Le bandeau seul : aucune route n'existe (voir l'en-tête). */
export interface K10Data {
  readonly moi: Bandeau;
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
