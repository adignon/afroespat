/**
 * L'adresse de l'API — `00` §5.1 : préfixe `/v1` pour les membres, `/v1/admin`
 * pour l'équipe. Le `/admin` est ajouté par le client d'équipe, pas ici.
 *
 * `NEXT_PUBLIC_…` parce que la valeur doit exister dans le NAVIGATEUR : Next
 * n'expose au client que les variables ainsi préfixées, et une variable de serveur
 * lue dans un composant client vaut `undefined` sans le moindre message.
 *
 * ── LE PIÈGE CORS, QUI A COÛTÉ UNE HEURE SUR CE PROJET ──────────────────────
 *
 * L'API construit sa liste d'origines autorisées depuis `WEB_PORT` (`main.ts`).
 * Lancer le web sur un port et l'API sans le MÊME `WEB_PORT` fait rejeter chaque
 * réponse par le navigateur, alors que le serveur répond 200. Et le symptôme ne
 * nomme jamais la cause : on voit un menu déroulant vide, un écran sans données,
 * jamais un refus CORS. `WEB_PORT` va donc sur les DEUX commandes.
 */
export const API_BASE = (process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/v1').replace(
  /\/+$/,
  '',
);
