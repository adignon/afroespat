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
 * ── « TOUT LE RESTE » N'A PLUS AUCUNE EXCEPTION ─────────────────────────────
 *
 * `report.create` et `sanction.appeal` étaient les deux seules à y échapper. Je
 * l'avais signalé et argumenté — ce sont des recours, pas des fonctionnalités —
 * et le porteur a tranché : « corrige ceci ». Elles sont en L2, et ce que ça
 * coûte est écrit sur elles, dans la table, pour qu'on puisse y revenir.
 *
 * `content.read` reste L0 : sans lecture il n'y a pas d'application, et aucun des
 * trois niveaux n'aurait de sens.
 *
 * ── PUIS LE PORTEUR A SORTI `guide.vote` DE « TOUT LE RESTE » — 2026-10-10 ──
 *
 * « "Ce guide vous a-t-il aidé ?" Ceci peut être voté même avec N0. »
 *
 * Cet en-tête affirmait, la veille, que `content.read` était la SEULE exception
 * restante. Elle ne l'est plus, et la phrase a été corrigée plutôt que gardée :
 * une documentation qui survit à l'arbitrage qu'elle décrit est ce qui fait qu'on
 * cherche une règle dans le code au lieu de la lire ici. Le pourquoi et le coût du
 * mouvement sont écrits SUR la capacité, dans la table.
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
  /**
   * N0 : « "Ce guide vous a-t-il aidé ?" Ceci peut être voté même avec N0 »
   * (porteur, 2026-10-10). ⚠ RENVERSE LE RANGEMENT DU 2026-10-09, qui la laissait
   * tomber dans « faire tout le reste » — donc en N2.
   *
   * CE QUE CE VOTE EST, ET CE QU'IL N'EST PAS. Il n'écrit rien que personne ne
   * lise : il alimente `helpfulCount`, donc `freshnessScore` (§2.3), donc l'ordre
   * des guides. C'est la SEULE boucle de retour qu'un lecteur ait sur un guide, et
   * un lecteur est exactement ce qu'un N0 est. Le fermer demandait au nouvel
   * arrivant — celui que le guide vise — de se taire sur son utilité jusqu'à
   * produire un justificatif de domicile.
   *
   * CE QUE ÇA COÛTE, ÉCRIT POUR QU'ON PUISSE REVENIR DESSUS : la note de
   * fraîcheur devient poussable par des comptes à un SMS. Trois choses la
   * retiennent, et aucune n'est le niveau — `@@unique([guideId, userId])` en base
   * (un vote par membre et par guide), la réputation qui n'est créditée qu'à
   * l'AUTEUR du guide, et le coefficient de §2.3 qui fait fondre un score ancien.
   * Revenir en arrière tient en un mot : `minLevel: 'L2'`.
   */
  'guide.vote': { minLevel: 'L0', planLimit: null, labelFr: 'voter « ça m’a aidé »' },
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
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║ SIGNALER ET CONTESTER PASSENT EN N2 — DÉCISION DU PORTEUR, 2026-10-09   ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   *
   * Ces deux capacités étaient les SEULES à ne pas suivre « N2 : faire tout le
   * reste ». Je l'avais signalé et argumenté ; le porteur a tranché : « corrige
   * ceci : report.create et sanction.appeal ». Elles rejoignent donc la règle.
   *
   * ── CE QUE ÇA CHANGE, ÉCRIT POUR QU'ON PUISSE Y REVENIR ──────────────────
   *
   * 1. SIGNALER DEMANDE MAINTENANT N2, c'est-à-dire une identité vérifiée ET un
   *    numéro de destination. 13 §1 dit qu'« un pré-départ non encore vérifié est
   *    la cible privilégiée des arnaques » : ce sont donc précisément les comptes
   *    les plus exposés qui ne peuvent plus alerter, et une arnaque vit le temps
   *    que sa victime franchisse deux marches de vérification.
   *
   * 2. CONTESTER UNE SANCTION DEMANDE N2. Un membre sanctionné AVANT d'atteindre
   *    N2 ne peut plus contester — et selon la sanction, il ne peut pas non plus
   *    monter de niveau. 13 §4.3 prévoit la contestation comme un recours ; elle
   *    devient inatteignable pour ceux-là.
   *
   * Revenir en arrière tient en deux mots : `minLevel: 'L0'` sur chacune.
   *
   * ⚠ LE SIGNALEMENT N'EST JAMAIS PAYANT, et ça n'a pas bougé : `planLimit:
   * null` sur les deux, et la règle dure 14 §2 le vérifie par test.
   */
  'report.create': { minLevel: 'L2', planLimit: null, labelFr: 'signaler un contenu ou un profil' },
  'sanction.appeal': { minLevel: 'L2', planLimit: null, labelFr: 'contester une sanction' },

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
