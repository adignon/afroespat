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
] as const;

/** Vrai si un texte d'interface emploie un mot interdit. Insensible aux accents et à la casse. */
export function containsForbiddenWord(text: string): boolean {
  const normalized = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  return normalized.includes('certifi');
}
