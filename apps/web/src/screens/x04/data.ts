/**
 * X04 — les encarts de refus (T5 « composants », 14 §4.5 et 00 §7.3).
 *
 * ── UN SEUL DES DEUX ENCARTS SE LIT, ET C'EST MESURÉ ────────────────────────
 *
 * La planche de 390 px montre les deux l'un sous l'autre, sur un écran « Créer un
 * événement » dont la barre d'onglets reste en place — c'est la démonstration de
 * ce que la maquette annonce en légende : « ne bloquent jamais la navigation ».
 *
 *   · L'ENCART « NIVEAU » attend un REFUS d'écriture. Ses phrases sont le
 *     `labelFr` et le texte de 00 §7.3 que `403 LEVEL_REQUIRED` porte, et rien
 *     d'autre ne les produit : aucune LECTURE ne dit « il vous manque le niveau
 *     N1 pour créer un événement ». Il reste donc dessiné, et c'est l'écriture
 *     refusée qui le remplira — la règle du socle est sans exception, on tente
 *     l'action et le serveur décide ;
 *   · L'ENCART « PLAN » est un COMPTEUR, et un compteur se lit. C'est ce que ce
 *     fichier porte.
 *
 * ⚠ AUCUNE PAGE NE MONTE CE CADRE. Son composant est généré et importé par
 * personne — T5 range ces encarts en « composants » et ne leur donne aucune route.
 * Lier le quota ne le fait pas apparaître : cela garantit qu'il n'affichera pas
 * « 1 événement sur 1 » à un membre qui en a créé trois, le jour où une page
 * l'affichera.
 */

/**
 * Le quota d'événements du mois (14 §4.5).
 *
 * `utilises` est un NOMBRE et `plafond` une CHAÎNE, et l'asymétrie est celle de
 * `Quotas` dans le module Services, pour la même raison : `limit` est nullable
 * côté API et « illimité » n'est pas un nombre. §4.4 est explicite — « l'écran
 * affiche illimité, jamais 0 sur null ».
 *
 * `reinitialise` vient de `usage.resetsAt`, l'instant que le SERVEUR annonce. Le
 * recalculer en prenant le premier du mois suivant sur l'horloge du navigateur
 * afficherait « Réinitialisé le 30 septembre » à un membre décalé d'un fuseau,
 * pour un quota qui repart le 1er octobre.
 */
export interface QuotaEvenements {
  readonly utilises: number;
  readonly plafond: string;
  readonly reinitialise: string;
}

export interface X04Data {
  readonly quota: QuotaEvenements;
}
