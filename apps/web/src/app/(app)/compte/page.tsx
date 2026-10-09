import { redirect } from 'next/navigation';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ `/compte` N'EXISTAIT PAS — LA BARRE D'ONGLETS MENAIT À UN 404             ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Le bouton compte dans le menu sur mobile au niveau du bottom bar
 * ne marche pas. »
 *
 * MESURÉ : `GET /compte` répondait **404**. Le dossier ne contenait que des
 * sous-pages — `profil`, `verification`, `securite`… — et aucune racine. La
 * cinquième entrée de la barre d'onglets, dessinée sur cinquante-quatre cadres
 * mobiles, ne menait donc nulle part.
 *
 * C'était même CONSIGNÉ comme un refus, dans `e2e/sous-liens-acces-messages-
 * compte.spec.ts` : « LA CINQUIÈME ENTRÉE, "COMPTE", N'EST PAS DANS LA LISTE, et
 * c'est un refus : il n'existe aucune route `/compte`. Le test le CONSTATE, pour
 * que le trou ne se referme pas en silence. » Il s'est vu, et c'est le porteur
 * qui l'a vu.
 *
 * ── UNE REDIRECTION, ET NON UNE PAGE DE PLUS ──────────────────────────────
 *
 * Aucune maquette ne dessine un écran « Compte » : `08 Compte` ouvre sur K01, le
 * PROFIL, et les huit autres sont ses sœurs. En inventer un sommaire ajouterait
 * un écran que personne n'a dessiné, et une page de plus à traverser avant
 * d'arriver là où l'on va de toute façon.
 *
 * `redirect` CÔTÉ SERVEUR : la redirection part avec la réponse, sans monter un
 * composant client ni faire clignoter un écran vide. C'est aussi ce qui fait que
 * `GET /compte` rend un `307` plutôt qu'un `200` sur une page qui s'en irait.
 */
export default function ComptePage(): never {
  redirect('/compte/profil');
}
