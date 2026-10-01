import type { Moi, Quotas } from '../services/data';

/**
 * S10 — « Mes alertes » (`/services/alertes`, 10 §2.4).
 *
 * BRANCHÉ SUR `GET /me/alerts`, qui vit dans `housing.controller.ts` et NON dans
 * un module `alerts` — celui-ci n'existe pas. §2.4 définit l'alerte avec la
 * recherche de logement, et la même table sert les deux kinds (`HOUSING`, `JOB`).
 * Chercher le dossier plutôt que le contrôleur fait chercher une route absente.
 *
 * ── LE PLAN EST UNE DÉCISION DU SERVEUR ────────────────────────────────────
 *
 * `sansPremium` vient de `meta.isPremium`, que le serveur calcule. Relire
 * `users.plan` dans le front se tromperait le jour où un essai, une grâce Mobile
 * Money ou un plan Pro change la réponse — et c'est la même règle que partout
 * ailleurs dans ce module : le front affiche, il ne décide pas.
 *
 * §2.4 fait des alertes une fonction payante, et la règle dure 14 §2 ne protège
 * que l'entraide, les guides, le parrainage, les réseaux et la participation aux
 * événements : les alertes peuvent donc être payantes sans contradiction.
 *
 * LE FORMULAIRE « NOUVELLE ALERTE » N'EST PAS LIÉ : ses champs sont des exemples
 * de saisie, pas les critères d'un objet existant. Même raison que S03.
 */
export interface S10Data {
  readonly moi: Moi;
  readonly quotas: Quotas;
  readonly alertes: {
    readonly liste: readonly LigneAlerte[];
    /** `!meta.isPremium` — l'encart disparaît pour un membre Premium (§2.4). */
    readonly sansPremium: boolean;
  };
}

/**
 * Une alerte enregistrée.
 *
 * `active` et `enPause` sont deux booléens EXCLUSIFS, parce que la maquette dessine
 * DEUX interrupteurs — vert à droite, gris à gauche — et que le dialecte n'a pas de
 * `else`. Les deux sont gardés : n'en garder qu'un aurait montré toutes les alertes
 * allumées, ou toutes éteintes.
 *
 * `criteres` est composé des critères RÉELS, relus par `alertCriteriaSchema` — le
 * même schéma qui les a écrits à la création. Un `z.record(z.unknown())` aurait
 * laissé cet écran lire des champs qui n'existent pas.
 */
export interface LigneAlerte {
  /** « Logement · Colocation » — le kind de l'alerte et celui de son critère. */
  readonly titre: string;
  /** « Lyon 7e, 3e · jusqu'à 500 € · meublé » — les critères, dans l'ordre de §2.4. */
  readonly criteres: string;
  /** « Dernier envoi : hier », de `lastNotifiedAt`, ou « En pause ». */
  readonly etat: string;
  readonly active: boolean;
  readonly enPause: boolean;
}
