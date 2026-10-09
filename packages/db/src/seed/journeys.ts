/**
 * Données de départ — modèles de parcours (T3 partie A).
 *
 * « C'est de la donnée, pas du code ; elle est administrée ensuite en
 * back-office. » Ce fichier porte la bibliothèque des 30 définitions d'étapes
 * (A.1), la composition des quatre types (A.2) et la déclinaison Bénin (A.3).
 *
 * Trois choses ne sont PAS écrites ici, et c'est délibéré :
 *
 * 1. `description` des définitions. T3 A.1 n'en donne aucune, et une étape
 *    administrative décrite ici serait une source d'autorité concurrente des
 *    guides communautaires — or T3 A.3 dit l'inverse : les montants et les délais
 *    « renvoient aux guides communautaires, seuls à être mis à jour ». La colonne
 *    reste nulle, comme `guide_id` : l'interface affiche « guide à venir ».
 * 2. `blocker_template`. T3 A.1 donne QUATRE gabarits, un par CIBLE — pas trente,
 *    un par étape. Ils vivent dans `@app/shared` (`BLOCKER_TEMPLATES`) et
 *    `JourneysService.createBlockerDraft` y retombe quand la colonne est nulle.
 *    Les recopier trente fois en base créerait une seconde source de vérité qui
 *    dériverait au premier ajustement du texte. La colonne reste donc le point de
 *    SURCHARGE du back-office, pas le porteur du défaut.
 * 3. `risk_message`. Même raison : T3 A.1 donne UN message pour toutes les étapes
 *    à risque (`STEP_RISK_MESSAGE` dans `@app/shared`), et le service y retombe.
 */

export type StepCategorySeed = 'PRE_DEPARTURE' | 'ARRIVAL' | 'SETTLEMENT';
export type BlockerTargetSeed = 'HELP' | 'HOUSING' | 'JOBS' | 'MENTORSHIP' | 'NONE';

export interface StepDefinitionSeed {
  code: string;
  nameFr: string;
  category: StepCategorySeed;
  /** Durée indicative en jours (T3 A.1), corrigée ensuite par les délais observés. */
  defaultDurationDays: number;
  blockerTarget: BlockerTargetSeed;
  /** Jalon majeur : déclenche la proposition de partage à la clôture (03 §3.6). */
  isMajorMilestone: boolean;
  /** Étape à fort taux de blocage : le message de risque s'affiche avant de commencer. */
  isRisky: boolean;
  /** Libellés cochables. AUCUN document n'est stocké (03 §3.3). */
  documentChecklist: string[];
}

/**
 * T3 A.1 — la bibliothèque des 30 définitions, dans l'ordre du tableau.
 *
 * Les définitions sont RÉUTILISÉES entre types : `VISA` sert à Études, Travail et
 * Regroupement familial ; `SOCIAL_SECURITY` aux quatre. Quatre définitions ne sont
 * composées par aucune version 1 (`PREPARE_DEPARTURE`, `PHONE_PLAN`,
 * `STATUS_CHANGE`, `RENEWAL`) : la bibliothèque existe pour être plus large que
 * les modèles du jour.
 */
export const STEP_DEFINITIONS: StepDefinitionSeed[] = [
  {
    code: 'CHOOSE_PROGRAM',
    nameFr: 'Choisir sa formation',
    category: 'PRE_DEPARTURE',
    defaultDurationDays: 21,
    blockerTarget: 'HELP',
    isMajorMilestone: false,
    isRisky: false,
    documentChecklist: [],
  },
  {
    code: 'CAMPUS_FRANCE_FILE',
    nameFr: 'Constituer le dossier Campus France',
    category: 'PRE_DEPARTURE',
    defaultDurationDays: 42,
    blockerTarget: 'HELP',
    isMajorMilestone: false,
    isRisky: true,
    documentChecklist: [
      'Passeport valide',
      'Relevés de notes',
      'Diplômes',
      'Lettre de motivation',
      'CV',
      'Photo d’identité',
    ],
  },
  {
    code: 'CAMPUS_FRANCE_INTERVIEW',
    nameFr: 'Passer l’entretien Campus France',
    category: 'PRE_DEPARTURE',
    defaultDurationDays: 14,
    blockerTarget: 'HELP',
    isMajorMilestone: false,
    isRisky: false,
    documentChecklist: ['Convocation', 'Dossier imprimé'],
  },
  {
    code: 'ADMISSION',
    nameFr: 'Obtenir l’admission',
    category: 'PRE_DEPARTURE',
    defaultDurationDays: 30,
    blockerTarget: 'HELP',
    isMajorMilestone: true,
    isRisky: false,
    documentChecklist: ['Lettre d’admission'],
  },
  {
    code: 'FIND_JOB_OFFER',
    nameFr: 'Trouver une offre et signer un contrat',
    category: 'PRE_DEPARTURE',
    defaultDurationDays: 60,
    blockerTarget: 'JOBS',
    isMajorMilestone: true,
    isRisky: true,
    documentChecklist: ['CV français', 'Contrat ou promesse d’embauche'],
  },
  {
    code: 'WORK_PERMIT',
    nameFr: 'Obtenir l’autorisation de travail',
    category: 'PRE_DEPARTURE',
    defaultDurationDays: 30,
    blockerTarget: 'HELP',
    isMajorMilestone: false,
    isRisky: true,
    documentChecklist: ['Contrat', 'Demande de l’employeur'],
  },
  {
    code: 'FAMILY_FILE',
    nameFr: 'Déposer le dossier de regroupement familial',
    category: 'PRE_DEPARTURE',
    defaultDurationDays: 30,
    blockerTarget: 'HELP',
    isMajorMilestone: false,
    isRisky: true,
    documentChecklist: ['Actes d’état civil', 'Justificatifs du regroupant'],
  },
  {
    code: 'FAMILY_INQUIRY',
    nameFr: 'Enquête logement et ressources',
    category: 'PRE_DEPARTURE',
    defaultDurationDays: 90,
    blockerTarget: 'HELP',
    isMajorMilestone: false,
    isRisky: true,
    documentChecklist: ['Bail', 'Fiches de paie', 'Attestation de surface'],
  },
  {
    code: 'FAMILY_DECISION',
    nameFr: 'Recevoir la décision',
    category: 'PRE_DEPARTURE',
    defaultDurationDays: 60,
    blockerTarget: 'MENTORSHIP',
    isMajorMilestone: true,
    isRisky: false,
    documentChecklist: [],
  },
  {
    code: 'VISA',
    nameFr: 'Obtenir le visa',
    category: 'PRE_DEPARTURE',
    defaultDurationDays: 28,
    blockerTarget: 'HELP',
    isMajorMilestone: true,
    isRisky: true,
    documentChecklist: [
      'Passeport',
      'Admission ou contrat',
      'Justificatif de ressources',
      'Assurance',
      'Hébergement',
      'Photos',
      'Formulaire',
    ],
  },
  {
    code: 'HEALTH_INSURANCE',
    nameFr: 'Souscrire l’assurance santé du visa',
    category: 'PRE_DEPARTURE',
    defaultDurationDays: 3,
    blockerTarget: 'NONE',
    isMajorMilestone: false,
    isRisky: false,
    documentChecklist: ['Attestation d’assurance'],
  },
  {
    code: 'PROOF_OF_FUNDS',
    nameFr: 'Réunir le justificatif de ressources',
    category: 'PRE_DEPARTURE',
    defaultDurationDays: 30,
    blockerTarget: 'HELP',
    isMajorMilestone: false,
    isRisky: true,
    documentChecklist: ['Attestation bancaire ou prise en charge'],
  },
  {
    code: 'HOUSING_BEFORE',
    nameFr: 'Trouver un logement avant l’arrivée',
    category: 'PRE_DEPARTURE',
    defaultDurationDays: 45,
    blockerTarget: 'HOUSING',
    isMajorMilestone: true,
    isRisky: true,
    documentChecklist: ['Dossier locatif', 'Garantie Visale', 'Attestation d’hébergement'],
  },
  {
    code: 'FLIGHT',
    nameFr: 'Réserver le billet',
    category: 'PRE_DEPARTURE',
    defaultDurationDays: 7,
    blockerTarget: 'NONE',
    isMajorMilestone: false,
    isRisky: false,
    documentChecklist: ['Billet'],
  },
  {
    code: 'PREPARE_DEPARTURE',
    nameFr: 'Préparer le départ',
    category: 'PRE_DEPARTURE',
    defaultDurationDays: 14,
    blockerTarget: 'HELP',
    isMajorMilestone: false,
    isRisky: false,
    documentChecklist: [
      'Documents originaux et copies',
      'Ordonnances',
      'Argent des premiers jours',
    ],
  },
  {
    code: 'ARRIVAL',
    nameFr: 'Arriver en France',
    category: 'ARRIVAL',
    defaultDurationDays: 1,
    blockerTarget: 'MENTORSHIP',
    isMajorMilestone: true,
    isRisky: false,
    documentChecklist: [],
  },
  {
    code: 'OFII_VALIDATION',
    nameFr: 'Valider le visa (OFII)',
    category: 'ARRIVAL',
    defaultDurationDays: 30,
    blockerTarget: 'HELP',
    isMajorMilestone: false,
    isRisky: true,
    documentChecklist: ['Visa', 'Adresse', 'Timbre'],
  },
  {
    code: 'HOUSING_AFTER',
    nameFr: 'Trouver un logement stable',
    category: 'ARRIVAL',
    defaultDurationDays: 45,
    blockerTarget: 'HOUSING',
    isMajorMilestone: true,
    isRisky: true,
    documentChecklist: ['Dossier locatif', 'Visale'],
  },
  {
    code: 'BANK_ACCOUNT',
    nameFr: 'Ouvrir un compte bancaire',
    category: 'ARRIVAL',
    defaultDurationDays: 14,
    blockerTarget: 'HELP',
    isMajorMilestone: false,
    isRisky: true,
    documentChecklist: ['Passeport', 'Visa', 'Justificatif de domicile ou attestation'],
  },
  {
    code: 'PHONE_PLAN',
    nameFr: 'Prendre un forfait mobile',
    category: 'ARRIVAL',
    defaultDurationDays: 2,
    blockerTarget: 'NONE',
    isMajorMilestone: false,
    isRisky: false,
    documentChecklist: ['RIB'],
  },
  {
    code: 'SOCIAL_SECURITY',
    nameFr: 'S’inscrire à la sécurité sociale',
    category: 'ARRIVAL',
    defaultDurationDays: 60,
    blockerTarget: 'HELP',
    isMajorMilestone: false,
    isRisky: false,
    documentChecklist: ['Acte de naissance traduit', 'Passeport', 'Titre', 'RIB'],
  },
  {
    code: 'CAF',
    nameFr: 'Demander l’aide au logement (CAF)',
    category: 'ARRIVAL',
    defaultDurationDays: 30,
    blockerTarget: 'HELP',
    isMajorMilestone: false,
    isRisky: false,
    documentChecklist: ['Bail', 'RIB', 'Attestation de loyer'],
  },
  {
    code: 'SCHOOL_ENROLL',
    nameFr: 'Inscrire les enfants à l’école',
    category: 'ARRIVAL',
    defaultDurationDays: 14,
    blockerTarget: 'HELP',
    isMajorMilestone: false,
    isRisky: false,
    documentChecklist: ['Carnet de santé', 'Justificatif de domicile', 'Livret de famille'],
  },
  {
    code: 'RESIDENCE_PERMIT',
    nameFr: 'Obtenir la carte de séjour',
    category: 'SETTLEMENT',
    defaultDurationDays: 90,
    blockerTarget: 'HELP',
    isMajorMilestone: true,
    isRisky: true,
    documentChecklist: ['Titre précédent', 'Justificatifs', 'Photos', 'Timbre'],
  },
  {
    code: 'STATUS_CHANGE',
    nameFr: 'Changer de statut',
    category: 'SETTLEMENT',
    defaultDurationDays: 120,
    blockerTarget: 'HELP',
    isMajorMilestone: true,
    isRisky: true,
    documentChecklist: ['Contrat', 'Diplôme', 'Titre'],
  },
  {
    code: 'REGULARIZATION',
    nameFr: 'Régulariser sa situation',
    category: 'SETTLEMENT',
    defaultDurationDays: 180,
    blockerTarget: 'MENTORSHIP',
    isMajorMilestone: true,
    isRisky: true,
    documentChecklist: ['Preuves de présence', 'Fiches de paie', 'Attestations'],
  },
  {
    code: 'DIPLOMA_RECOGNITION',
    nameFr: 'Faire reconnaître son diplôme',
    category: 'SETTLEMENT',
    defaultDurationDays: 90,
    blockerTarget: 'HELP',
    isMajorMilestone: false,
    isRisky: false,
    documentChecklist: ['Diplôme', 'Relevés', 'Traductions'],
  },
  {
    code: 'FIND_JOB_AFTER',
    nameFr: 'Trouver un emploi',
    category: 'SETTLEMENT',
    defaultDurationDays: 90,
    blockerTarget: 'JOBS',
    isMajorMilestone: true,
    isRisky: true,
    documentChecklist: ['CV français', 'Lettre', 'Titre'],
  },
  {
    code: 'LOCAL_INTEGRATION',
    nameFr: 'S’intégrer localement',
    category: 'SETTLEMENT',
    defaultDurationDays: 90,
    blockerTarget: 'MENTORSHIP',
    isMajorMilestone: false,
    isRisky: false,
    documentChecklist: [],
  },
  {
    code: 'RENEWAL',
    nameFr: 'Renouveler le titre de séjour',
    category: 'SETTLEMENT',
    defaultDurationDays: 60,
    blockerTarget: 'HELP',
    isMajorMilestone: false,
    isRisky: true,
    documentChecklist: ['Titre', 'Justificatifs', 'Photos'],
  },
];

/** Surcharge locale d'une étape dans une version (lue par `readOverrides`, 03 §2.1). */
export interface StepOverridesSeed {
  description: string;
}

export interface TemplateStepSeed {
  /** Code de la définition composée. */
  code: string;
  /** Rétro-planning : jours AVANT la date d'arrivée cible. Négatif = après. Null = pas de rétro-planning. */
  daysBeforeArrival: number | null;
  isOptional: boolean;
  /** Positions (1..n) dont cette étape dépend, dans la MÊME version. */
  dependsOn: number[];
}

/** Déclinaison d'une version par pays d'origine (T3 A.3). */
export interface CountryVariantSeed {
  countryIso2: string;
  /** Surcharges par code de définition. Le reste est identique à la version générique. */
  overrides: Record<string, StepOverridesSeed>;
}

export interface JourneyTemplateSeed {
  code: string;
  nameFr: string;
  /** Phase attendue à la création (00 §6.3). */
  targetPhase: 'PRE_DEPARTURE' | 'RECENT_ARRIVAL' | 'SETTLED';
  /**
   * LE TRACÉ DE L'ICÔNE, SERVI PAR L'API AVEC LE TYPE.
   *
   * Le porteur : « Les objectifs de la première section doivent être les
   * différents parcours disponibles du coup viennent du backend avec leur icon et
   * tout. »
   *
   * La colonne `journey_templates.icon` existait et restait VIDE sur les quatre
   * types — compté en base. L'écran d'objectif tirait donc ses icônes d'une table
   * LOCALE indexée par `code` (`screens/onboarding/from-api.ts`), ce qui marche
   * tant que les types sont ces quatre-là et cesse de marcher le jour où un
   * cinquième est créé en back-office : il arriverait sans icône.
   *
   * Les quatre tracés viennent de `docs/template/01 Accès et Onboarding.dc.html`,
   * recopiés à l'identique depuis la table locale qui les avait transcrits. Rien
   * n'est redessiné ; la donnée change seulement de côté.
   *
   * La table locale RESTE, comme repli : un type sans icône en base doit encore
   * s'afficher.
   */
  icon: string;
  /**
   * CE TYPE OUVRE-T-IL UN PARCOURS ?
   *
   * Faux pour les deux objectifs que T5 §O03 dessine sous « sans créer de
   * parcours ». Ils sont des OBJECTIFS — la même page pose que « les deux groupes
   * ont le même rang visuel de choix » — mais ils n'ouvrent rien.
   *
   * Un type non développable n'a aucune étape, et sa version publiée en compte
   * donc zéro : c'est elle qui le rend PROPOSABLE, puisque « un type sans version
   * publiée n'est pas proposé ». C'est le booléen, pas l'absence de version, qui
   * dit de ne rien créer.
   */
  createsJourney?: boolean;
  sortOrder: number;
  steps: TemplateStepSeed[];
  variants: CountryVariantSeed[];
}

/**
 * Déclinaison Bénin → France (T3 A.3). Les textes ne portent NI montant NI délai :
 * « ils renvoient aux guides communautaires, seuls à être mis à jour. » Écrire
 * « 615 € par mois » ici, c'est publier une valeur périmée que personne ne
 * corrigera.
 */
const BENIN_OVERRIDES: Record<string, StepOverridesSeed> = {
  CAMPUS_FRANCE_FILE: {
    description:
      'Depuis le Bénin, le dossier passe par la plateforme Études en France et par ' +
      'l’Espace Campus France Bénin, à Cotonou. Le calendrier de la campagne change ' +
      'chaque année : consultez les guides de la communauté, ce sont eux qui sont à jour.',
  },
  VISA: {
    description:
      'Depuis le Bénin, le dépôt se fait au centre prestataire de Cotonou (TLScontact ' +
      'ou VFS selon la campagne). Les délais réellement observés et la liste des pièces ' +
      'demandées au guichet sont dans les guides de la communauté.',
  },
  PROOF_OF_FUNDS: {
    description:
      'Le montant mensuel de référence et les banques dont l’attestation est acceptée ' +
      'évoluent d’une campagne à l’autre. Ils ne sont pas inscrits ici : les guides de ' +
      'la communauté en portent la version courante.',
  },
};

/**
 * T3 A.2 — la composition des quatre types, version 1.
 *
 * DEUX ÉCARTS DE LA SPEC AVEC ELLE-MÊME, tranchés ici :
 *
 * 1. STUDIES annonce « 12 étapes » et en liste 15 — le document le reconnaît
 *    lui-même (« 15 étapes en réalité »). On suit la LISTE.
 * 2. STUDIES étape 14 (CAF) dépend de « 8 ou HOUSING_AFTER » : une DISJONCTION.
 *    `step_dependencies` est une table de paires (`step_id`, `depends_on_step_id`),
 *    donc conjonctive : deux lignes signifieraient « 8 ET HOUSING_AFTER », ce qui
 *    est plus contraignant que la spec. Et `HOUSING_AFTER` n'est pas composée par
 *    STUDIES v1 : la clé étrangère pointe sur `template_steps` de la MÊME version,
 *    la branche n'a donc littéralement pas de cible. On garde la seule branche
 *    représentable — la 8 (HOUSING_BEFORE) — et on ne fabrique rien d'autre.
 *
 * SETTLEMENT position 1 : la spec place « REGULARIZATION ou STATUS_CHANGE ou
 * RENEWAL (le membre choisit à la création) » dans UNE ligne, et compte 7 étapes.
 * `template_steps` a un index unique sur (version, position) : trois alternatives
 * exclusives sur une position ne s'y écrivent pas, et `createJourneySchema` est
 * `.strict()` sans paramètre de variante — le choix à la création n'existe pas
 * encore côté API. On compose donc REGULARIZATION, celle qui donne son nom au type,
 * et le total reste 7. Les deux autres définitions restent en bibliothèque.
 */
export const JOURNEY_TEMPLATES: JourneyTemplateSeed[] = [
  {
    code: 'STUDIES',
    nameFr: 'Étudier en France',
    targetPhase: 'PRE_DEPARTURE',
    icon: 'M2 9 12 4l10 5-10 5zM6 11v5c3 2 9 2 12 0v-5',
    sortOrder: 1,
    steps: [
      { code: 'CHOOSE_PROGRAM', daysBeforeArrival: 240, isOptional: false, dependsOn: [] },
      { code: 'CAMPUS_FRANCE_FILE', daysBeforeArrival: 200, isOptional: false, dependsOn: [1] },
      {
        code: 'CAMPUS_FRANCE_INTERVIEW',
        daysBeforeArrival: 170,
        isOptional: false,
        dependsOn: [2],
      },
      { code: 'ADMISSION', daysBeforeArrival: 120, isOptional: false, dependsOn: [3] },
      { code: 'PROOF_OF_FUNDS', daysBeforeArrival: 100, isOptional: false, dependsOn: [] },
      { code: 'VISA', daysBeforeArrival: 60, isOptional: false, dependsOn: [4, 5] },
      { code: 'HEALTH_INSURANCE', daysBeforeArrival: 50, isOptional: false, dependsOn: [6] },
      { code: 'HOUSING_BEFORE', daysBeforeArrival: 30, isOptional: false, dependsOn: [6] },
      { code: 'FLIGHT', daysBeforeArrival: 21, isOptional: false, dependsOn: [6] },
      { code: 'ARRIVAL', daysBeforeArrival: 0, isOptional: false, dependsOn: [9] },
      { code: 'OFII_VALIDATION', daysBeforeArrival: -30, isOptional: false, dependsOn: [10] },
      { code: 'BANK_ACCOUNT', daysBeforeArrival: -21, isOptional: false, dependsOn: [10] },
      { code: 'SOCIAL_SECURITY', daysBeforeArrival: -60, isOptional: false, dependsOn: [12] },
      // « 8 ou HOUSING_AFTER » → la 8 seule, cf. l'en-tête de ce tableau.
      { code: 'CAF', daysBeforeArrival: -45, isOptional: true, dependsOn: [8] },
      { code: 'RESIDENCE_PERMIT', daysBeforeArrival: -270, isOptional: false, dependsOn: [11] },
    ],
    variants: [{ countryIso2: 'BJ', overrides: BENIN_OVERRIDES }],
  },
  {
    code: 'WORK',
    nameFr: 'Travailler en France',
    targetPhase: 'PRE_DEPARTURE',
    icon: 'M3 7h18v13H3zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
    sortOrder: 2,
    steps: [
      { code: 'FIND_JOB_OFFER', daysBeforeArrival: 150, isOptional: false, dependsOn: [] },
      { code: 'WORK_PERMIT', daysBeforeArrival: 90, isOptional: false, dependsOn: [1] },
      { code: 'VISA', daysBeforeArrival: 60, isOptional: false, dependsOn: [2] },
      { code: 'HEALTH_INSURANCE', daysBeforeArrival: 50, isOptional: false, dependsOn: [3] },
      { code: 'HOUSING_BEFORE', daysBeforeArrival: 30, isOptional: true, dependsOn: [3] },
      { code: 'FLIGHT', daysBeforeArrival: 21, isOptional: false, dependsOn: [3] },
      { code: 'ARRIVAL', daysBeforeArrival: 0, isOptional: false, dependsOn: [6] },
      { code: 'OFII_VALIDATION', daysBeforeArrival: -30, isOptional: false, dependsOn: [7] },
      { code: 'BANK_ACCOUNT', daysBeforeArrival: -14, isOptional: false, dependsOn: [7] },
      { code: 'SOCIAL_SECURITY', daysBeforeArrival: -60, isOptional: false, dependsOn: [9] },
      { code: 'RESIDENCE_PERMIT', daysBeforeArrival: -270, isOptional: false, dependsOn: [8] },
    ],
    variants: [{ countryIso2: 'BJ', overrides: BENIN_OVERRIDES }],
  },
  {
    code: 'FAMILY',
    nameFr: 'Rejoindre ma famille',
    targetPhase: 'PRE_DEPARTURE',
    icon: 'M9 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 11a2.5 2.5 0 1 0 0-5M16 20h5a5 5 0 0 0-4-5',
    sortOrder: 3,
    steps: [
      { code: 'FAMILY_FILE', daysBeforeArrival: 300, isOptional: false, dependsOn: [] },
      { code: 'FAMILY_INQUIRY', daysBeforeArrival: 210, isOptional: false, dependsOn: [1] },
      { code: 'FAMILY_DECISION', daysBeforeArrival: 120, isOptional: false, dependsOn: [2] },
      { code: 'VISA', daysBeforeArrival: 60, isOptional: false, dependsOn: [3] },
      { code: 'FLIGHT', daysBeforeArrival: 21, isOptional: false, dependsOn: [4] },
      { code: 'ARRIVAL', daysBeforeArrival: 0, isOptional: false, dependsOn: [5] },
      { code: 'OFII_VALIDATION', daysBeforeArrival: -30, isOptional: false, dependsOn: [6] },
      { code: 'SCHOOL_ENROLL', daysBeforeArrival: -14, isOptional: true, dependsOn: [6] },
      { code: 'SOCIAL_SECURITY', daysBeforeArrival: -60, isOptional: false, dependsOn: [6] },
    ],
    variants: [],
  },
  {
    code: 'SETTLEMENT',
    nameFr: 'Régulariser ma situation',
    // Le membre est DÉJÀ en France (T3 A.2). Entre `RECENT_ARRIVAL` et `SETTLED`,
    // on retient `SETTLED` : régulariser demande des preuves de présence, donc de
    // l'ancienneté. `target_phase` n'est aujourd'hui LU par rien côté API — il est
    // seulement rendu au client — l'enjeu reste donc éditorial.
    targetPhase: 'SETTLED',
    icon: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5',
    sortOrder: 4,
    // « sans rétro-planning » : `days_before_arrival` nul partout. Le membre est
    // arrivé, il n'y a plus de date d'arrivée à décompter.
    steps: [
      { code: 'REGULARIZATION', daysBeforeArrival: null, isOptional: false, dependsOn: [] },
      { code: 'HOUSING_AFTER', daysBeforeArrival: null, isOptional: true, dependsOn: [] },
      { code: 'BANK_ACCOUNT', daysBeforeArrival: null, isOptional: true, dependsOn: [] },
      { code: 'SOCIAL_SECURITY', daysBeforeArrival: null, isOptional: true, dependsOn: [] },
      { code: 'DIPLOMA_RECOGNITION', daysBeforeArrival: null, isOptional: true, dependsOn: [] },
      { code: 'FIND_JOB_AFTER', daysBeforeArrival: null, isOptional: true, dependsOn: [1] },
      { code: 'LOCAL_INTEGRATION', daysBeforeArrival: null, isOptional: false, dependsOn: [] },
    ],
    variants: [],
  },
  /**
   * ── LES DEUX OBJECTIFS QUI N'OUVRENT PAS DE PARCOURS ──────────────────────
   *
   * T5 §O03 : « Séparateur “sans créer de parcours”. Deux cartes plus légères :
   * “M'intégrer, rencontrer du monde”, “Aider les autres”. LES DEUX GROUPES ONT
   * LE MÊME RANG VISUEL DE CHOIX. » Et la règle dure de §5 : « Le parcours n'est
   * jamais imposé. »
   *
   * Ils étaient ÉCRITS EN DUR dans le cadre transcodé, donc ni cliquables ni
   * connus du serveur. Le porteur a tranché : « seuls les sans parcours doivent
   * être cliquables aussi. Je pense qu'il faut enregistrer ça comme étant un
   * parcours non développable. Donc ils viennent de la base aussi. »
   *
   * `steps: []` — et c'est le point : la version publiée existe, et elle compte
   * ZÉRO étape. Sans version, le type serait exclu de `GET /journey-templates`
   * (« un type sans version publiée n'est pas proposé ») ; avec une version vide,
   * la règle de résolution reste intacte et c'est `createsJourney` qui porte la
   * différence.
   *
   * Les deux tracés d'icône viennent de `docs/template/01 Accès et
   * Onboarding.dc.html`, planche O03, recopiés à l'identique.
   */
  {
    code: 'INTEGRATE',
    nameFr: 'M’intégrer, rencontrer du monde',
    targetPhase: 'SETTLED',
    icon: 'M17 20a5 5 0 0 0-10 0M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 19a4 4 0 0 0-3-3.8M18 10.5a2.5 2.5 0 1 0 0-5',
    createsJourney: false,
    sortOrder: 90,
    steps: [],
    variants: [],
  },
  {
    code: 'HELP_OTHERS',
    nameFr: 'Aider les autres',
    targetPhase: 'SETTLED',
    icon: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
    createsJourney: false,
    sortOrder: 91,
    steps: [],
    variants: [],
  },
];
