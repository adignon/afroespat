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

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ L'ADRESSE ABSOLUE D'UN MÉDIA — LE SERVEUR N'EN REND QUE DES RELATIVES     ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * L'API rend `/media/<clé>` : neuf endroits de six modules la composent à la main
 * (avatars du fil, des villes, des réseaux et des fiches pro, images de
 * publication, photos de logement, albums, fond de story). C'est une adresse
 * RELATIVE, et le navigateur la résout contre l'ORIGINE DE LA PAGE — c'est-à-dire
 * le serveur web, pas l'API. En développement cela fait demander
 * `http://localhost:3000/media/…` à Next, qui n'a jamais entendu parler de ce
 * chemin ; en production cela dépend de la façon dont les deux sont servis.
 *
 * Le défaut ne se voit pas : une image dont l'adresse ne répond pas laisse
 * simplement un cadre vide, et aucune erreur n'est affichée. Il est resté invisible
 * tant qu'AUCUNE route ne servait `/media/…` — on ne remarque pas qu'une adresse
 * pointe au mauvais endroit quand elle ne pointe nulle part.
 *
 * ── POURQUOI ICI ET NON DANS L'API ────────────────────────────────────────
 *
 * Le serveur ne connaît pas l'origine publique sous laquelle il est servi, et la
 * lui faire deviner (en-têtes `Host`, `X-Forwarded-*`) est une source classique de
 * failles. Le client, lui, SAIT où il appelle : `API_BASE`. Rendre l'adresse
 * absolue est donc le travail du client, et d'un seul endroit.
 *
 * Une adresse DÉJÀ absolue traverse inchangée : le jour où un stockage objet rend
 * des URL signées complètes, rien ici ne les abîmera.
 */
export function urlMedia(chemin: string): string {
  if (/^(https?:)?\/\//.test(chemin) || chemin.startsWith('data:') || chemin.startsWith('blob:')) {
    return chemin;
  }
  return `${API_BASE}${chemin.startsWith('/') ? '' : '/'}${chemin}`;
}
