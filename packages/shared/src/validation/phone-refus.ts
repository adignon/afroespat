/**
 * Les trois raisons de refuser un numéro avant tout envoi de SMS.
 *
 * Le fichier est à part pour que `auth.ts` (codes d'erreur de l'API) et
 * `referentials.ts` (analyse du numéro, côté écran) partagent les MÊMES phrases
 * sans s'importer l'un l'autre : un membre voit le même texte qu'il soit arrêté
 * par l'écran ou par le serveur.
 */
export const PHONE_REFUS_CODES = [
  'PHONE_INVALID',
  'PHONE_COUNTRY_MISMATCH',
  'PHONE_NOT_MOBILE',
] as const;
export type PhoneRefusCode = (typeof PHONE_REFUS_CODES)[number];

export const PHONE_REFUS_MESSAGES: Record<PhoneRefusCode, string> = {
  PHONE_INVALID: 'Ce numéro ne correspond pas au format du pays choisi.',
  PHONE_COUNTRY_MISMATCH: 'Ce numéro n’appartient pas au pays choisi. Choisissez son pays.',
  PHONE_NOT_MOBILE: 'Ce numéro n’est pas un mobile : il ne peut pas recevoir de SMS.',
};
