/**
 * Identité du produit. Une seule constante, un seul fichier de traduction :
 * changer le nom affiché est un changement d'une ligne (décision D3).
 */
export const PRODUCT_NAME = 'DisaporyPlus';
export const PRODUCT_DOMAIN = 'afroexpates.com';

/** Fuseau d'affichage par défaut ; le fuseau du membre l'emporte s'il est renseigné (§4). */
export const DEFAULT_TIMEZONE = 'Europe/Paris';

/** Couleur de thème du manifeste PWA (§10.4) : le vert fort du rail. */
export const PWA_THEME_COLOR = '#0F5C48';

/**
 * Mots interdits dans l'interface (T2, règle dure §1.2).
 * « certifié » et ses dérivés : la plateforme ne vérifie aucun dossier
 * administratif, et le mot créerait une exposition juridique.
 */
export const FORBIDDEN_UI_WORDS = [
  'certifié',
  'certifie',
  'certifiée',
  'certifiés',
  'certifiées',
  'certification',
  'certifier',
  'certifiant',
] as const;

/**
 * `certificat` et `certificats` sont explicitement ÉPARGNÉS.
 *
 * 05-guides.md §2 précise la règle : le mot est rejeté « dans le titre et dans
 * les libellés d'interface (PAS DANS LE CORPS, qui peut citer un document
 * officiel) ». « Le certificat Visale » est un document réel, que les membres
 * doivent pouvoir nommer — l'interdire rendrait la plateforme incapable de
 * parler des démarches qu'elle accompagne.
 *
 * `certification` reste rejeté : c'est l'acte de certifier, pas un document.
 * D'où la négation, qui exige une fin de mot juste après `certificat`.
 */
const FORBIDDEN_PATTERN = /certifi(?!cats?\b)/;

/**
 * Vrai si un texte emploie « certifié » ou un dérivé. Insensible aux accents et
 * à la casse.
 *
 * À employer sur les TITRES et les LIBELLÉS d'interface, jamais sur le corps
 * d'un contenu rédigé par un membre.
 */
export function containsForbiddenWord(text: string): boolean {
  const normalized = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  return FORBIDDEN_PATTERN.test(normalized);
}
