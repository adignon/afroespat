import {
  ACCOUNT_LIMITS,
  GUIDE_PROPOSAL_ESCALATION_DAYS,
  HANDLE_CHANGE_INTERVAL_DAYS,
  NEWCOMER_WINDOW_DAYS,
} from '@app/shared';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES DÉLAIS ANNONCÉS À L'ÉCRAN VIENNENT DES RÈGLES, PAS DE LA MAQUETTE      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Lot W2A, phase 2.5, 2.6 et 2.9. La maquette écrit ses délais en toutes lettres :
 * « Sous 48 h, lien 7 jours » (K08), « Réversible 6 mois », « Définitif après 7
 * jours », « Vous avez 14 jours pour répondre » (A06), « Pendant 3 mois après votre
 * arrivée » (K01). Chacun est une RÈGLE que le serveur applique — et deux étaient
 * fausses : le fil des nouveaux arrivants dure 14 jours (`NEWCOMER_WINDOW_DAYS`),
 * pas trois mois, et rien dans le dépôt ne tient la promesse « sous 48 h » de
 * l'archive (la génération est asynchrone ; le membre est prévenu quand elle est
 * prête).
 *
 * Toutes les phrases sont composées ICI, une fois, depuis `@app/shared` : un délai
 * qui change côté serveur change à l'écran sans qu'on y touche, et le test de ce
 * fichier fige les phrases pour que ce soit visible.
 */

export function jours(n: number): string {
  return `${String(n)} jour${n > 1 ? 's' : ''}`;
}

export function mois(n: number): string {
  return `${String(n)} mois`;
}

/** Les phrases, par clé. `Texte` (components/valeurs-vives) les rend. */
export const TEXTES_DELAIS = {
  /** K08 ordinateur, avant toute demande. */
  exportAucune: `Aucune archive demandée. Nous vous prévenons dès qu’elle est prête ; le lien reste valable ${jours(ACCOUNT_LIMITS.exportLinkValidityDays)}.`,
  /** K08 ordinateur, archive prête. */
  exportPrete: `Votre archive est prête. Le lien reste valable ${jours(ACCOUNT_LIMITS.exportLinkValidityDays)}.`,
  /** K08 téléphone. */
  exportMobile: `Lien valable ${jours(ACCOUNT_LIMITS.exportLinkValidityDays)}`,
  desactiverDesktop: `Votre profil est masqué. Reconnectez-vous dans les ${mois(ACCOUNT_LIMITS.deactivatedPurgeMonths)} pour le retrouver.`,
  desactiverMobile: `Réversible ${mois(ACCOUNT_LIMITS.deactivatedPurgeMonths)}`,
  supprimerDesktop: `Définitif après ${jours(ACCOUNT_LIMITS.deletionGraceDays)}.`,
  supprimerMobile: `Définitif après ${jours(ACCOUNT_LIMITS.deletionGraceDays)}`,
  /** K08SUPPRESSION : l'encadré de la confirmation. */
  suppressionRepit: `Vous avez ${jours(ACCOUNT_LIMITS.deletionGraceDays)} pour changer d’avis.`,
  /** A06 « Propositions reçues » : l'encart « Comment ça marche ». */
  propositionsDelai: `Vous avez ${jours(GUIDE_PROPOSAL_ESCALATION_DAYS)} pour répondre à chaque proposition. Sans réponse, elle est transmise à la modération. Chaque proposition acceptée crédite son auteur comme contributeur.`,
  /** A06 « Corriger » : la bande sous le formulaire. */
  correctionDelai: `L’auteur a ${jours(GUIDE_PROPOSAL_ESCALATION_DAYS)} pour répondre. Sans réponse, la modération tranche.`,
  /** K01 : la ligne sous « Apparaître dans les nouveaux arrivants ». */
  nouvelArrivant: `Pendant ${jours(NEWCOMER_WINDOW_DAYS)} après votre arrivée`,
} as const;

export type CleTexteDelai = keyof typeof TEXTES_DELAIS;

const MOIS_COURTS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const;

/** « 2 janvier » ou « 2 janvier 2025 » quand l'année n'est pas l'année en cours. */
export function dateLongue(iso: string, maintenant: Date = new Date()): string {
  const d = new Date(iso);
  const annee = d.getFullYear() === maintenant.getFullYear() ? '' : ` ${String(d.getFullYear())}`;
  return `${String(d.getDate())} ${MOIS_COURTS[d.getMonth()] ?? ''}${annee}`;
}

/**
 * K01, sous le champ « Pseudo ».
 *
 * Jamais modifié : la règle seule. Modifié : la date du dernier changement ET celle
 * du prochain possible (dernier + 30 jours), ou « modifiable maintenant » une fois
 * le délai écoulé. Aucune date n'est écrite en dur.
 */
export function phrasePseudo(handleChangedAt: string | null, maintenant: Date = new Date()): string {
  const regle = `Modifiable une fois tous les ${jours(HANDLE_CHANGE_INTERVAL_DAYS)}`;
  if (handleChangedAt === null) return `${regle}.`;
  const prochain = new Date(
    new Date(handleChangedAt).getTime() + HANDLE_CHANGE_INTERVAL_DAYS * 86_400_000,
  );
  const dernier = `Modifié le ${dateLongue(handleChangedAt, maintenant)}`;
  return prochain.getTime() <= maintenant.getTime()
    ? `${dernier} · modifiable à nouveau maintenant`
    : `${dernier} · prochain changement possible le ${dateLongue(prochain.toISOString(), maintenant)}`;
}

/**
 * K01, sous « Pays d'origine » : la ligne n'existe QUE si le pays est figé
 * (`originCountryLocked`, tiré de `users.origin_country_locked_at`). Un pays
 * encore corrigeable ne porte aucune phrase : la planche dessine le champ
 * verrouillé, et lui faire promettre une modification qu'elle ne propose pas serait
 * une seconde promesse non tenue.
 */
export function phrasePaysOrigine(figee: boolean): string {
  return figee ? 'Déjà modifié une fois. Contactez le support pour le changer.' : '';
}

/** K01, sous « Apparaître dans les nouveaux arrivants », avec la fin de la fenêtre si l'arrivée est connue. */
export function phraseNouvelArrivant(arrivalDate: string | null, maintenant: Date = new Date()): string {
  if (arrivalDate === null) return TEXTES_DELAIS.nouvelArrivant;
  const fin = new Date(new Date(`${arrivalDate}T00:00:00Z`).getTime() + NEWCOMER_WINDOW_DAYS * 86_400_000);
  return fin.getTime() <= maintenant.getTime()
    ? `${TEXTES_DELAIS.nouvelArrivant} · fenêtre close le ${dateLongue(fin.toISOString(), maintenant)}`
    : `${TEXTES_DELAIS.nouvelArrivant}, soit jusqu’au ${dateLongue(fin.toISOString(), maintenant)}`;
}
