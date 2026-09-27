/**
 * Accès aux données. Le client Prisma est généré depuis prisma/schema/*.prisma,
 * un fichier par module du modèle relationnel (00-fondations.md §6.3).
 *
 * Aucun service d'un module ne touche le dépôt d'un autre module (§3.3) :
 * ce paquet expose le client, les modules exposent leurs dépôts.
 */
export * from '../generated/client/index.js';
export { newId, newIdAt } from './uuid.js';
