import { JOB_SEEKER_LIMITS, jobSeekerProfileSchema } from '@app/shared';

/**
 * Les convertisseurs PURS du formulaire « Mon profil de recherche » (S04) : sans React,
 * donc éprouvés en vitest (`profil-recherche.test.ts`). Le front prévient avec le schéma
 * PARTAGÉ et ses bornes `JOB_SEEKER_LIMITS` ; le serveur décide.
 */

/** Le brouillon, tel que le schéma partagé le lit. */
export function brouillon(titre: string, secteurs: readonly string[], contrats: readonly string[], visible: boolean) {
  return { headline: titre, sectors: [...secteurs], contractTypes: [...contrats], isVisible: visible };
}

/** La phrase de prévention : celle du premier champ refusé, en français. */
export function refusDuBrouillon(
  titre: string,
  secteurs: readonly string[],
  contrats: readonly string[],
): string {
  const t = titre.trim();
  if (t.length < JOB_SEEKER_LIMITS.headlineMin) {
    return `Le titre de votre recherche doit faire au moins ${JOB_SEEKER_LIMITS.headlineMin} caractères.`;
  }
  if (t.length > JOB_SEEKER_LIMITS.headlineMax) {
    return `Le titre de votre recherche ne peut pas dépasser ${JOB_SEEKER_LIMITS.headlineMax} caractères.`;
  }
  const verdict = jobSeekerProfileSchema.safeParse(brouillon(titre, secteurs, contrats, true));
  return verdict.success ? '' : 'Votre profil de recherche n’est pas valide.';
}

/** Ajoute une entrée à une liste : coupée, sans doublon (casse ignorée), bornée. */
export function ajouterEntree(
  liste: readonly string[],
  valeur: string,
): { readonly liste: readonly string[]; readonly ajoutee: boolean } {
  const v = valeur.trim();
  if (v.length < JOB_SEEKER_LIMITS.itemMin || v.length > JOB_SEEKER_LIMITS.itemMax) {
    return { liste, ajoutee: false };
  }
  if (liste.length >= JOB_SEEKER_LIMITS.listMax) return { liste, ajoutee: false };
  if (liste.some((e) => e.toLowerCase() === v.toLowerCase())) return { liste, ajoutee: false };
  return { liste: [...liste, v], ajoutee: true };
}
