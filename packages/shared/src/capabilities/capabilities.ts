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

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES TROIS NIVEAUX, REFONDUS PAR LE PORTEUR — 2026-10-09                   ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * « Pour les niveaux on va revoir.
 *
 *   N0 : commenter des publications, créer des demandes d'entraide, ajouter des
 *        contacts et discuter avec eux, créer et gérer les parcours
 *   N1 : publier dans le fil d'actualité et stories, répondre à l'entraide,
 *        demander un parrain
 *   N2 : faire tout le reste »
 *
 * Chaque capacité porte désormais le niveau que cette liste lui donne, et la
 * colonne « pourquoi » de chacune est réécrite en conséquence. Trois mouvements
 * valent d'être nommés, parce qu'ils RENVERSENT un arbitrage antérieur :
 *
 *   · `post.create` repasse de L0 à L1. Le porteur avait ouvert les stories à
 *     tout le monde (« autorise pour tout le monde la possibilité de publier des
 *     stories avec tout ce qui va avec ») ; la nouvelle liste range explicitement
 *     « publier dans le fil d'actualité et stories » en N1. L'instruction la plus
 *     récente l'emporte. ⚠ CONSÉQUENCE MESURÉE : `post.create` garde aussi
 *     `POST /media`, donc un L0 ne peut plus déposer d'image ;
 *   · `connection.request` passe de L1 à L0 — « ajouter des contacts » est en N0 ;
 *   · `mentorship.request` passe de L0 à L1 — « demander un parrain » est en N1,
 *     alors qu'une décision T4 l'avait ouvert à L0 pour « créer le lien avant
 *     l'avion ».
 *
 * ── DEUX CAPACITÉS NE SUIVENT PAS « TOUT LE RESTE », ET IL FAUT LE DIRE ─────
 *
 * `report.create` et `sanction.appeal` restent L0. Ce ne sont pas des
 * fonctionnalités, ce sont des DROITS : signaler une arnaque et contester une
 * sanction. 13 §1 est explicite — « un pré-départ non encore vérifié est la cible
 * privilégiée des arnaques » — et les passer en L2 fermerait l'alerte à ceux qui
 * en ont le plus besoin, tout en laissant une sanction incontestable à un compte
 * qui ne peut plus monter de niveau. L'énumération du porteur liste ce qu'on
 * PEUT FAIRE, pas ce qu'on a le droit de défendre. ÉCART REMONTÉ.
 *
 * `content.read` reste L0 de même : sans lecture il n'y a pas d'application.
 *
 * ── LE FRONT PRÉVIENT, LE SERVEUR REFUSE ───────────────────────────────────
 *
 * Le porteur : « les boutons […] doivent être désactivés et on vérifie aussi côté
 * serveur s'il peut faire les actions ». Les deux moitiés existent :
 *
 *   · côté serveur, `@RequiresCapability` garde chaque route d'écriture, et un
 *     test d'intégration échoue si une route non-GET n'en déclare pas ;
 *   · côté front, cette même table est lue pour ÉTEINDRE le bouton et expliquer
 *     — jamais pour autoriser. Un niveau lu une fois peut être périmé ; c'est le
 *     403 qui tranche, et `forgetRights()` jette alors la copie.
 */
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
  /**
   * N1 : « demander un parrain ».
   *
   * ⚠ RENVERSE LA DÉCISION T4, qui l'ouvrait à L0 pour « créer le lien avant
   * l'avion ». La liste du porteur la range en N1 ; l'instruction la plus récente
   * l'emporte, et l'écart est consigné ici pour qu'on puisse y revenir.
   */
  'mentorship.request': { minLevel: 'L1', planLimit: null, labelFr: 'demander un parrain' },
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
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ ÉCART ASSUMÉ AVEC 04 §2.4 — ARBITRAGE DU PORTEUR                        ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * La spec est explicite : « Capacité `post.create` (L1). Un L0 voit le composeur
   * grisé avec l'invitation à monter de niveau. » Cette capacité valait donc `L1`.
   *
   * Le porteur : « L'ajout de photo au niveau des stories n'est pas autorisé ?
   * Autorise pour tout le monde la possibilité de publier des stories avec tout ce
   * qui va avec. » Mesuré avant : `POST /stories` répondait 403 à un compte non
   * vérifié, et `POST /media` aussi — c'est la MÊME capacité qui garde les deux,
   * d'où la photo refusée en même temps que la publication.
   *
   * ── CE QUE ÇA OUVRE EXACTEMENT, PARCE QUE C'EST PLUS QUE LES STORIES ───────
   *
   * `post.create` garde onze routes, et toutes s'ouvrent ensemble : publier une
   * story, publier dans le fil, envoyer un média, publier dans un réseau (sujet,
   * annonce, sondage), recommander un pro, contribuer à une fiche ville. Il n'y a
   * pas de capacité propre aux stories dans la table de la spec, et en inventer
   * une ici créerait une règle que les specs ne connaissent pas.
   *
   * ── CE QUI RETIENT ENCORE ─────────────────────────────────────────────────
   *
   *   · les quotas de §2.4 — trois stories par jour, dix publications par heure,
   *     et ils ne dépendent pas du niveau ;
   *   · la modération : une story part en file de vérification comme les autres ;
   *   · pour les médias, le format, la taille, l'antivirus et le retrait des EXIF.
   *
   * CE QUE ÇA COÛTE, ÉCRIT POUR QU'ON PUISSE REVENIR DESSUS : un compte non
   * vérifié coûte un SMS, et il peut désormais publier du texte et DES IMAGES.
   * C'est la charge de modération et le stockage qui s'ouvrent avec. Revenir en
   * arrière tient en un mot : `minLevel: 'L1'`.
   */
  'post.create': {
    minLevel: 'L1',
    planLimit: null,
    labelFr: 'publier dans le fil d’actualité et les stories',
  },
  'help.offer': { minLevel: 'L1', planLimit: null, labelFr: 'publier une offre d’entraide' },
  // ── « Faire tout le reste » — N2 ──────────────────────────────────────────
  'guide.write': { minLevel: 'L2', planLimit: null, labelFr: 'rédiger un guide' },
  'guide.vote': { minLevel: 'L2', planLimit: null, labelFr: 'voter « ça m’a aidé »' },
  'guide.propose_revision': {
    minLevel: 'L2',
    planLimit: null,
    labelFr: 'proposer une mise à jour',
  },
  'event.create': { minLevel: 'L2', planLimit: 'eventsPerMonth', labelFr: 'créer un événement' },
  'event.attend': { minLevel: 'L2', planLimit: null, labelFr: 'indiquer votre participation' },
  'community.create': { minLevel: 'L2', planLimit: null, labelFr: 'créer un réseau' },
  /**
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ ÉCART ASSUMÉ AVEC 08 §5.2 — ARBITRAGE DU PORTEUR                        ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * La spec écrit, tableau « Qui peut écrire à qui » : « L0 → Personne (sauf
   * conversation MENTORSHIP et JOURNEY dont il fait partie) ». Cette capacité
   * valait donc `L1`.
   *
   * Le porteur, après avoir rencontré le refus en lisant une story : « Il faut
   * corriger et permettre l'envoie de message même pour les utilisateurs
   * niveau [0]. » Question posée, écart nommé, décision prise : on ouvre.
   *
   * ── CE QUI RETIENT ENCORE, ET QUI N'A PAS BOUGÉ ────────────────────────────
   *
   * Le niveau n'était pas la seule barrière, et les autres tiennent toujours :
   *
   *   · PREMIER MESSAGE = DEMANDE (§5.2). Écrire à quelqu'un qu'on ne connaît pas
   *     ouvre une conversation EN ATTENTE : l'autre accepte ou ignore, et sans
   *     réponse il n'y a pas de second message. C'est ce qui borne le mal qu'un
   *     compte non vérifié peut faire ;
   *   · 20 NOUVELLES CONVERSATIONS PAR JOUR et 60 MESSAGES PAR MINUTE (§5.3) ;
   *   · un blocage ferme la conversation, et un signalement la rend lisible à la
   *     modération.
   *
   * CE QUE ÇA COÛTE, ÉCRIT ICI POUR QU'ON PUISSE REVENIR DESSUS : un compte non
   * vérifié coûte un SMS. La vérification était la barrière qui rendait le
   * démarchage de masse cher ; elle ne l'est plus. Revenir en arrière tient en un
   * mot — `minLevel: 'L1'` — et le garde du service qui l'accompagnait est nommé
   * dans `messaging.service.ts`.
   */
  'message.send': { minLevel: 'L0', planLimit: null, labelFr: 'envoyer un message privé' },
  /** N0 : « ajouter des contacts et discuter avec eux ». */
  'connection.request': { minLevel: 'L0', planLimit: null, labelFr: 'demander un contact' },
  'job.publish': {
    minLevel: 'L2',
    planLimit: 'sponsoredJobsPerMonth',
    labelFr: 'publier une offre d’emploi',
  },
  'pro.contact': {
    minLevel: 'L2',
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
