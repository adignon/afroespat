import { urlMedia } from '@/lib/api/base';
import { photoFondFor } from '@/screens/a14/data';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE FOND DU ROND D'AVATAR — UNE SEULE RECETTE, CINQ MODULES                ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « l'image profil ne s'applique pas sur toutes les pages. »
 *
 * MESURÉ : la liaison du rond était bien posée sur les quarante cadres, mais
 * SEUL le module Compte remplissait `moi.photo`. Sur le fil, l'entraide, les
 * services, l'agenda et la messagerie, la prise restait vide — donc l'aplat et
 * les initiales, exactement comme avant.
 *
 * CINQ MODULES CONSTRUISENT LEUR PROPRE BANDEAU, et c'est délibéré : chacun lit
 * `GET /me` pour son écran. Ce qu'ils ne doivent pas faire, c'est recomposer
 * l'adresse CHACUN À SA MANIÈRE — deux recettes divergeraient au premier
 * changement, et le défaut ne se verrait que sur l'un des cinq.
 *
 * ── LES DEUX PIÈGES QUE CETTE FONCTION ÉVITE ──────────────────────────────
 *
 *   · `urlMedia` : l'API rend `/media/…`, une adresse RELATIVE que le navigateur
 *     résoudrait contre le serveur WEB et non contre l'API ;
 *   · `photoFondFor(…, false)` : « couvrir ». Sans `cover` et `no-repeat`, le
 *     navigateur pose l'image à sa taille naturelle et la répète — un portrait de
 *     téléphone remplirait le rond d'un coin agrandi.
 *
 * `null` quand le membre n'a pas de photo : le cadre reprend alors l'aplat de la
 * maquette et écrit ses initiales, mot pour mot.
 */
export function fondAvatar(avatarUrl: string | null): string | null {
  return avatarUrl === null ? null : photoFondFor(urlMedia(avatarUrl), false);
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES DEUX MOITIÉS D'UN ROND DE MEMBRE, EN UNE FOIS                         ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « Le display affiche réellement l'avatar de l'utilisateur ? » —
 * non, et pas davantage les commentaires d'une publication, l'auteur d'un guide,
 * ses contributeurs ni ses proposants. Tous écrivaient `avatarColor(handle)` et
 * les initiales, sans jamais lire `avatarUrl`.
 *
 * `i: ''` QUAND IL Y A UNE PHOTO, ET C'EST LE POINT. Les cadres transcodés
 * écrivent les initiales À L'INTÉRIEUR du rond dont `bg` est le fond : poser la
 * photo sans les vider les dessinerait par-dessus le visage, en blanc sur une
 * image claire. Les initiales sont le REPLI d'une photo absente, pas une
 * étiquette.
 *
 * Les deux valeurs voyagent donc ENSEMBLE. Les séparer, c'est exactement
 * l'oubli qui a laissé six modules peindre un aplat pendant tout un lot.
 */
export function rondDe(
  membre: { readonly displayName: string; readonly handle: string; readonly avatarUrl: string | null },
  initiales: (nom: string) => string,
  teinte: (cle: string) => string,
): { readonly i: string; readonly bg: string } {
  const photo = fondAvatar(membre.avatarUrl);
  return photo === null
    ? { i: initiales(membre.displayName), bg: teinte(membre.handle) }
    : { i: '', bg: photo };
}
