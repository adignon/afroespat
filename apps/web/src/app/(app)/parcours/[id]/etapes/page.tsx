/**
 * `/parcours/:id/etapes` — « Étape en cours » dans le panneau de gauche. La route
 * n'existait pas (seule `etapes/:etape` répondait) : l'entrée du panneau menait à un 404.
 * Même page, sans identifiant d'étape : la vue prend l'étape en cours du serveur.
 */
export { default } from './[etape]/page';
