/**
 * Matrice des capacités — SOURCE UNIQUE (00-fondations.md §7.3).
 *
 * Le back l'applique par un décorateur sur chaque route ; le front l'utilise pour
 * afficher ou masquer, JAMAIS comme seule protection.
 *
 * RÈGLE DURE : toute route d'écriture déclare une capacité requise. Un test
 * d'intégration parcourt toutes les routes et échoue si une route non-GET n'en
 * déclare pas.
 *
 * RÈGLE DURE (14 §2) : l'entraide, les guides, le parrainage, les réseaux et la
 * participation aux événements ne sont jamais conditionnés à un plan. Les
 * capacités de ces modules portent `planLimit: null` et un test statique vérifie
 * que leurs services ne lisent jamais `users.plan`.
 */

// Les niveaux et les plans viennent du schéma, jamais d'une copie : ils sont
// générés depuis les enums PostgreSQL (voir scripts/generate-enums.mjs).
import { UserPlan, VerificationLevel } from '../enums/generated.js';

export { UserPlan, VerificationLevel };

/** Ordre pour la comparaison : L0 < L1 < L2. Les niveaux sont cumulatifs (§7.2). */
const LEVEL_RANK: Record<VerificationLevel, number> = { L0: 0, L1: 1, L2: 2 };

/** Clé de quota dans `plans.limits`. `null` = la capacité n'est jamais limitée par un plan. */
export type PlanLimitKey =
  | 'maxActiveJourneys'
  | 'eventsPerMonth'
  | 'proContactsPerMonth'
  | 'sponsoredJobsPerMonth';

export interface CapabilityDefinition {
  /** Niveau de vérification minimum. */
  readonly minLevel: VerificationLevel;
  /** Quota du plan gratuit, ou null si la capacité n'est jamais payante. */
  readonly planLimit: PlanLimitKey | null;
  /** Libellé français, affiché dans l'invitation à monter de niveau. */
  readonly labelFr: string;
}

export const CAPABILITIES = {
  // ── Lecture — ouverte à tous, dès L0 ──────────────────────────────────────
  'content.read': {
    minLevel: 'L0',
    planLimit: null,
    labelFr: 'lire le fil, les guides, l’entraide, les réseaux et les annonces',
  },

  // ── Parcours — ouvert dès L0 : un pré-départ doit pouvoir créer son parcours ─
  'journey.create': {
    minLevel: 'L0',
    planLimit: 'maxActiveJourneys',
    labelFr: 'créer un parcours',
  },
  'journey.manage': {
    minLevel: 'L0',
    planLimit: null,
    labelFr: 'modifier vos étapes, cocher, inviter',
  },

  // ── Interactions de base — L0 ─────────────────────────────────────────────
  'comment.create': { minLevel: 'L0', planLimit: null, labelFr: 'commenter et réagir' },
  /** Une QUESTION d'entraide est ouverte dès L0 : demander de l'aide n'attend pas. */
  'help.ask': { minLevel: 'L0', planLimit: null, labelFr: 'publier une question d’entraide' },
  /** La demande de parrain est ouverte dès L0 : créer le lien avant l'avion (décision T4). */
  'mentorship.request': { minLevel: 'L0', planLimit: null, labelFr: 'demander un parrain' },
  /**
   * Signaler (13 §3) est ouvert dès L0 et ne sera JAMAIS payant.
   *
   * Un pré-départ non encore vérifié est la cible privilégiée des arnaques
   * (13 §1) : exiger L1 pour signaler reviendrait à fermer l'alerte à ceux qui en
   * ont le plus besoin, et à laisser l'arnaque vivre le temps d'une vérification
   * d'identité.
   */
  'report.create': { minLevel: 'L0', planLimit: null, labelFr: 'signaler un contenu ou un profil' },
  /** Contester une sanction (13 §4.3). Un droit, donc jamais conditionné. */
  'sanction.appeal': { minLevel: 'L0', planLimit: null, labelFr: 'contester une sanction' },

  // ── Publication — exige une identité vérifiée (L1) ────────────────────────
  'post.create': { minLevel: 'L1', planLimit: null, labelFr: 'publier dans le fil' },
  'help.offer': { minLevel: 'L1', planLimit: null, labelFr: 'publier une offre d’entraide' },
  'guide.write': { minLevel: 'L1', planLimit: null, labelFr: 'rédiger un guide' },
  'guide.vote': { minLevel: 'L1', planLimit: null, labelFr: 'voter « ça m’a aidé »' },
  'guide.propose_revision': {
    minLevel: 'L1',
    planLimit: null,
    labelFr: 'proposer une mise à jour',
  },
  'event.create': { minLevel: 'L1', planLimit: 'eventsPerMonth', labelFr: 'créer un événement' },
  'event.attend': { minLevel: 'L1', planLimit: null, labelFr: 'indiquer votre participation' },
  'community.create': { minLevel: 'L1', planLimit: null, labelFr: 'créer un réseau' },
  'message.send': { minLevel: 'L1', planLimit: null, labelFr: 'envoyer un message privé' },
  'connection.request': { minLevel: 'L1', planLimit: null, labelFr: 'demander un contact' },
  'job.publish': {
    minLevel: 'L1',
    planLimit: 'sponsoredJobsPerMonth',
    labelFr: 'publier une offre d’emploi',
  },
  'pro.contact': {
    minLevel: 'L1',
    planLimit: 'proContactsPerMonth',
    labelFr: 'contacter une fiche professionnelle',
  },

  // ── Présence sur le territoire — exige L2 ─────────────────────────────────
  /** Le logement est la surface d'attaque principale des arnaques (10 §2). */
  'housing.publish': {
    minLevel: 'L2',
    planLimit: null,
    labelFr: 'publier une annonce de logement',
  },
  'mentor.become': { minLevel: 'L2', planLimit: null, labelFr: 'devenir parrain' },
  /** + justificatif d'activité, vérifié par l'équipe. */
  'pro.register': {
    minLevel: 'L2',
    planLimit: null,
    labelFr: 'vous référencer dans l’annuaire professionnel',
  },
} as const satisfies Record<string, CapabilityDefinition>;

export type Capability = keyof typeof CAPABILITIES;

export const CAPABILITY_KEYS = Object.keys(CAPABILITIES) as Capability[];

/** Les capacités qui ne doivent JAMAIS dépendre du plan (règle dure 14 §2). */
export const NEVER_PAID_CAPABILITIES: readonly Capability[] = CAPABILITY_KEYS.filter(
  (k) => CAPABILITIES[k].planLimit === null,
);

/** Vrai si `level` atteint le niveau requis par la capacité. */
export function levelSatisfies(level: VerificationLevel, capability: Capability): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[CAPABILITIES[capability].minLevel];
}

/** Le niveau manquant, pour composer l'invitation à monter de niveau. */
export function requiredLevel(capability: Capability): VerificationLevel {
  return CAPABILITIES[capability].minLevel;
}

/**
 * Détails renvoyés avec un `403 LEVEL_REQUIRED`. Le front affiche alors une
 * invitation à monter de niveau, JAMAIS une simple erreur (§7.3).
 */
export interface LevelRequiredDetails {
  readonly capability: Capability;
  readonly requiredLevel: VerificationLevel;
  readonly currentLevel: VerificationLevel;
  readonly labelFr: string;
}

export function levelRequiredDetails(
  capability: Capability,
  currentLevel: VerificationLevel,
): LevelRequiredDetails {
  return {
    capability,
    requiredLevel: CAPABILITIES[capability].minLevel,
    currentLevel,
    labelFr: CAPABILITIES[capability].labelFr,
  };
}
