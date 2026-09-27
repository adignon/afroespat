/**
 * Motifs de renvoi à l'écran du numéro, portés par l'URL.
 *
 * Ce module n'est PAS `'use client'`, et c'est tout son intérêt : il est lu par
 * la page serveur de `/connexion` comme par le parcours côté client.
 *
 * La leçon a coûté une recherche. Ces constantes vivaient d'abord dans
 * `use-onboarding-flow.ts`, qui commence par `'use client'`. Un composant serveur
 * qui importe une valeur d'un tel module n'obtient pas l'objet mais une
 * référence client — la recherche rendait donc `undefined`, sans le moindre
 * message, et le membre était renvoyé à l'écran du numéro sans explication :
 * exactement le défaut qu'on cherchait à corriger.
 *
 * Ce sont des CODES, pas des messages : l'URL n'a pas à véhiculer du texte
 * d'interface, et le front choisit son affichage sur le code (§5.2).
 */

export const REASON_EXPIRED = 'defi-expire';

export const RESUME_MESSAGES: Record<string, string> = {
  [REASON_EXPIRED]: 'Votre demande a expiré. Entrez à nouveau votre numéro.',
};
