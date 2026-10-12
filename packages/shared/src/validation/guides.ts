import { z } from 'zod';
import {
  GuideCategory,
  GuideProposalStatus,
  GuideScope,
  GuideStatus,
  GuideVoteValue,
  VerificationLevel,
} from '../enums/generated.js';
import { MEDIA_IMAGE_MIMES, MEDIA_MIME_EXTENSIONS } from './media.js';
import { cursorQuerySchema, handleSchema, pageSchema, slugSchema, uuidSchema } from './pagination.js';

/**
 * Guides et démarches — 05-guides.md §2 et §4.
 *
 * SOURCE UNIQUE (00-fondations.md §4) : ces schémas valident l'API ET les
 * formulaires de l'éditeur. Les bornes du §2.1 (titre 10–120, corps
 * 300–20 000), les seuils du §2.4 et du §2.6 et la table de fraîcheur du §2.3
 * vivent donc ici — le bandeau « À vérifier » affiché par le front et le
 * classement calculé par l'API emploient le MÊME coefficient, faute de quoi
 * l'écran et le tri finiraient par ne plus dire la même chose.
 *
 * Le mot « certifié » n'est PAS vérifié par ces schémas : §4 exige un code
 * d'erreur propre, `FORBIDDEN_WORD`, et non un `VALIDATION_FAILED` noyé dans la
 * liste des champs. Le service appelle `containsForbiddenWord` (constants/product).
 */

// ── Codes d'erreur (§4) ─────────────────────────────────────────────────────

export const GUIDE_ERROR_CODES = {
  /** Le mot « certifié » ou un dérivé, dans un titre (règle dure §2.1). */
  FORBIDDEN_WORD: 422,
  /** Bloqué par la modération à la publication (§2.1). */
  CONTENT_BLOCKED: 422,
  /** Trois guides publiés dans la journée (§2.1). */
  GUIDE_LIMIT_REACHED: 422,
  /** On ne vote pas, on ne signale pas et on ne propose pas sur son propre guide. */
  OWN_GUIDE: 422,
  /** Un signalement d'obsolescence par membre et par guide (§2.6). */
  ALREADY_FLAGGED: 409,
  /** Le passage visé n'existe plus, ou plus une seule fois (§2.4). */
  EXCERPT_NOT_FOUND: 409,
  /** Trois propositions en attente par membre et par guide (§2.4). */
  PROPOSAL_LIMIT: 422,
  /** Seul le créateur décide d'une proposition (§4). */
  NOT_AUTHOR: 403,
  /** Proposition déjà acceptée, refusée ou escaladée (§4). */
  ALREADY_DECIDED: 409,
  /** La conversion en guide demande un parcours terminé (§2.8). */
  JOURNEY_NOT_COMPLETED: 422,
  /**
   * Le corps cite l'adresse d'un média qui n'est pas rattachable : inconnu,
   * encore en analyse, refusé par l'antivirus, d'un autre genre que `GUIDE`, ou
   * appartenant à quelqu'un d'autre.
   *
   * 422 ET NON 404 : le membre VIENT de déposer ce fichier et sait qu'il existe.
   * Lui rendre « introuvable » l'enverrait chercher un identifiant perdu alors
   * que l'image est seulement en cours d'analyse — c'est le raisonnement que
   * `apps/api/src/common/media-attachment.ts` tient déjà pour les mêmes refus,
   * et le détail de la réponse nomme les clés fautives une par une.
   */
  IMAGE_NOT_ATTACHABLE: 422,
  /**
   * On ne retire pas la DERNIÈRE page d'un guide.
   *
   * 409 et non 422 : la demande est bien formée, c'est l'ÉTAT du guide qui la
   * refuse — il n'en a plus qu'une. Un guide sans page n'a pas de corps : ni
   * `GET /guides/:slug` ni la publication ne sauraient quoi en faire, et
   * `guides.current_version_id` pointerait vers une version orpheline. Supprimer
   * le guide entier est un autre geste (`DELETE`), que l'auteur doit choisir
   * explicitement.
   */
  LAST_PAGE: 409,
   /**
   * ─── L'ÉCRITURE NE PART PAS DE LA VERSION COURANTE ───────────────────────
   *
   * Arbitrage du porteur : « le serveur refuse une écriture qui ne part pas de la
   * version courante, avec un message clair — ce guide a été modifié ailleurs,
   * rechargez ».
   *
   * MESURÉ AVANT L'ARBITRAGE, deux onglets sur le MÊME brouillon, service appelé
   * en direct : le guide finit avec UNE seule version, portant le texte du second
   * onglet ; le texte du premier n'est retrouvable dans AUCUNE version. Sur un
   * guide publié la perte se répare — l'historique est en ajout seul — mais sur un
   * brouillon `update()` modifie la version 1 SUR PLACE, et la perte est
   * définitive.
   *
   * `409` et non `422` : c'est un conflit d'état, exactement comme
   * `EXCERPT_NOT_FOUND` ci-dessus, et le geste de réparation est le même —
   * recharger puis reprendre. La même famille de refus mérite le même statut.
   */
  EDITED_ELSEWHERE: 409,
} as const;

export type GuideErrorCode = keyof typeof GUIDE_ERROR_CODES;

export const GUIDE_ERROR_MESSAGES: Record<GuideErrorCode, string> = {
  FORBIDDEN_WORD:
    'Le mot « certifié » n’est pas autorisé dans un titre : la plateforme ne vérifie aucun dossier administratif.',
  CONTENT_BLOCKED: 'Ce contenu ne peut pas être publié en l’état. Notre équipe le relit.',
  GUIDE_LIMIT_REACHED: 'Vous avez publié trois guides aujourd’hui. Reprenez demain.',
  OWN_GUIDE: 'Il s’agit de votre guide : vous pouvez le modifier directement.',
  ALREADY_FLAGGED: 'Vous avez déjà signalé ce guide comme dépassé.',
  EXCERPT_NOT_FOUND:
    'Le passage visé a changé depuis votre sélection. Rechargez le guide et sélectionnez-le à nouveau.',
  PROPOSAL_LIMIT: 'Vous avez trois propositions en attente sur ce guide. Attendez une réponse.',
  NOT_AUTHOR: 'Seul l’auteur du guide peut répondre à cette proposition.',
  ALREADY_DECIDED: 'Cette proposition a déjà reçu une réponse.',
  JOURNEY_NOT_COMPLETED: 'Ce parcours n’est pas encore terminé.',
  IMAGE_NOT_ATTACHABLE:
    'Une image de ce guide n’est pas disponible. Déposez-la par le bouton image de l’éditeur, et attendez la fin de l’analyse avant de publier.',
  LAST_PAGE:
    'Un guide garde au moins une page. Ajoutez-en une autre avant de retirer celle-ci, ou supprimez le guide.',
  /**
   * La phrase dit D'ABORD ce qui s'est passé, PUIS le geste — comme
   * `EXCERPT_NOT_FOUND`. « Rechargez » seul laisserait croire à un incident
   * technique, et le membre rechargerait en perdant son texte sans savoir qu'un
   * autre onglet le détient.
   */
  EDITED_ELSEWHERE:
    'Ce guide a été modifié ailleurs depuis l’ouverture de l’éditeur. Rechargez-le pour repartir de la dernière version — votre texte n’a pas été enregistré.',
};

// ── Bornes et seuils (§2) ───────────────────────────────────────────────────

export const GUIDE_TITLE_MIN = 10;
export const GUIDE_TITLE_MAX = 120;
/** Le minimum ne s'applique qu'à la PUBLICATION : un brouillon s'enregistre à tout moment. */
export const GUIDE_BODY_MIN = 300;
export const GUIDE_BODY_MAX = 20_000;

/** §2.1 — trois guides publiés par jour. */
export const GUIDE_DAILY_PUBLISH_LIMIT = 3;
/** §2.4 — trois propositions PENDING par membre et par guide. */
export const GUIDE_PENDING_PROPOSAL_LIMIT = 3;
/** §2.4 — motif d'une proposition : 20 caractères minimum. */
export const GUIDE_PROPOSAL_REASON_MIN = 20;
/** §2.4 — sans décision au bout de 14 jours, la proposition est escaladée. */
export const GUIDE_PROPOSAL_ESCALATION_DAYS = 14;
/** §2.6 — trois signalements font passer le guide en FLAGGED. */
export const GUIDE_OUTDATED_FLAG_THRESHOLD = 3;
/** §2.6 — 30 jours pour corriger, puis dépublication. */
export const GUIDE_UNPUBLISH_DELAY_DAYS = 30;
/** §2.2 — cinq votes négatifs en sept jours ouvrent un dossier de modération. */
export const GUIDE_NEGATIVE_VOTE_THRESHOLD = 5;
export const GUIDE_NEGATIVE_VOTE_WINDOW_DAYS = 7;
/** §2.2 — priorité du dossier ouvert par la règle automatique. */
export const GUIDE_NEGATIVE_VOTE_CASE_PRIORITY = 4;
/** §2.4 — priorité du dossier ouvert par l'escalade d'une proposition. */
export const GUIDE_ESCALATION_CASE_PRIORITY = 3;
/** §2.5 — six mois sans session font basculer le guide en maintenance communautaire. */
export const GUIDE_AUTHOR_INACTIVITY_MONTHS = 6;
/** §2.3 — au-delà, bandeau « À vérifier » et entrée dans l'onglet du même nom. */
export const GUIDE_STALE_MONTHS = 24;

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║ LE TITRE D'UNE PAGE N'A PAS LES BORNES DU TITRE D'UN GUIDE               ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * 2 caractères au minimum, et non les 10 du §2.1. Les deux titres ne font pas le
 * même travail : celui du GUIDE est ce qu'on lit dans une liste, hors de tout
 * contexte — « Visa » n'y voudrait rien dire, et les 10 caractères l'imposent.
 * Celui d'une PAGE est un intertitre, lu SOUS le titre du guide : « Visa », « Le
 * dossier », « Après l'entretien » sont exactement ce que la maquette A05 dessine
 * dans son plan, et les refuser obligerait l'auteur à meubler.
 *
 * Le MAXIMUM reste celui du guide : au-delà, le plan des pages ne tient plus sur
 * une ligne, à 390 px comme à 1440 px.
 */
export const GUIDE_PAGE_TITLE_MIN = 2;
export const GUIDE_PAGE_TITLE_MAX = GUIDE_TITLE_MAX;

// ── Fraîcheur (§2.3) ────────────────────────────────────────────────────────

/**
 * `freshness_score = helpful_count × coeff(âge de last_content_update_at)`.
 *
 * Les tranches sont données par leur borne BASSE, en mois révolus, dans l'ordre
 * croissant : le coefficient est celui de la dernière tranche atteinte.
 *
 * Le tableau du §2.3 se recouvre à ses bornes (« < 6 mois », « 6–12 »,
 * « 12–24 », « > 24 »). Les deux bornes strictes de la spec tranchent :
 * « < 6 mois » exclut 6, « > 24 mois » exclut 24 — d'où 25 comme borne basse de
 * la dernière tranche, et un guide de 24 mois pile encore à 0,4. Le même choix
 * vaut pour l'onglet « À vérifier », qui retient « > 24 mois ».
 */
export const GUIDE_FRESHNESS_BRACKETS = [
  { fromMonths: 0, coefficient: 1 },
  { fromMonths: 6, coefficient: 0.7 },
  { fromMonths: 12, coefficient: 0.4 },
  { fromMonths: 25, coefficient: 0.2 },
] as const;

/**
 * Nombre de mois RÉVOLUS depuis une date.
 *
 * Calculé en mois calendaires, et non en tranches de 30 jours : le bandeau dit
 * « dernière mise à jour il y a N mois », et un membre qui compare à son
 * calendrier ne doit pas trouver un mois d'écart.
 */
export function monthsSince(date: Date, now: Date = new Date()): number {
  const months =
    (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
  const notYetReached = now.getDate() < date.getDate();
  return Math.max(0, notYetReached ? months - 1 : months);
}

export function freshnessCoefficient(monthsOld: number): number {
  let coefficient: number = GUIDE_FRESHNESS_BRACKETS[0].coefficient;
  for (const bracket of GUIDE_FRESHNESS_BRACKETS) {
    if (monthsOld >= bracket.fromMonths) coefficient = bracket.coefficient;
  }
  return coefficient;
}

/**
 * Le score de classement. Arrondi à quatre décimales, comme la colonne
 * `guides.freshness_score` (numeric(10,4)) : arrondir ici plutôt que de laisser
 * PostgreSQL tronquer évite qu'un test comparant les deux échoue pour un chiffre
 * de rang cinq.
 */
export function computeFreshnessScore(
  helpfulCount: number,
  lastContentUpdateAt: Date,
  now: Date = new Date(),
): number {
  const raw = helpfulCount * freshnessCoefficient(monthsSince(lastContentUpdateAt, now));
  return Math.round(raw * 10_000) / 10_000;
}

/** §2.3 — un guide dont le contenu n'a pas bougé depuis plus de 24 mois. */
export function isStaleGuide(lastContentUpdateAt: Date, now: Date = new Date()): boolean {
  return monthsSince(lastContentUpdateAt, now) > GUIDE_STALE_MONTHS;
}

// ── Slug (§2.1) ─────────────────────────────────────────────────────────────

/**
 * Slug depuis le titre. Translittéré, tronqué à 80 caractères pour laisser la
 * place au suffixe d'unicité. JAMAIS recalculé après publication (§2.1) : un
 * lien partagé dans une conversation doit continuer de fonctionner.
 */
export function slugifyGuideTitle(title: string): string {
  const base = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return base.length >= 2 ? base : 'guide';
}

// ── Markdown restreint (§2.1 et 00 §8.1) ────────────────────────────────────

/**
 * « Texte des membres : stocké brut, jamais du HTML. Formatage autorisé :
 * sous-ensemble Markdown (gras, italique, listes, liens) » (00 §8.1), auquel
 * §2.1 ajoute ICI les titres de niveau 2 et 3, ET les images déposées par
 * l'application.
 *
 * Le niveau 1 reste interdit : le titre du guide est déjà le `h1` de la page, et
 * un second briserait la structure du document pour un lecteur d'écran.
 *
 * ═══ LES IMAGES : CE QUI A CHANGÉ, ET CE QUI NE CHANGE PAS ════════════════
 *
 * CE PARAGRAPHE REMPLACE CELUI QUI DISAIT « les guides n'ont pas de table de
 * médias ». Il était vrai et il ne l'est plus — `guide_media` existe
 * (05-guides.prisma, modèle `GuideMedia`) — et une documentation qui survit à ce
 * qu'elle décrit est exactement ce qui fait chercher une règle dans le code au
 * lieu de la lire ici.
 *
 * Le RAISONNEMENT de l'ancien refus, lui, tenait : une image n'était alors
 * forcément qu'un lien externe, donc hors du pipeline média (antivirus, retrait
 * des EXIF) qu'exige 00 §8.2. Ce qui manquait n'était pas la permission, c'était
 * le pipeline. La maquette le disait de son côté : l'éditeur A05 mobile écrit
 * `![Capture](image-1.jpg)` et porte un bouton image, et le lecteur A04
 * ordinateur dessine une `<figure>` de 220 px avec sa légende.
 *
 * EST ACCEPTÉE, et seulement elle : une image dont la cible est l'adresse rendue
 * par `POST /media`, c'est-à-dire `/media/<storage_key>` (mesuré :
 * `apps/api/src/modules/media/media.service.ts`, `MediaService.view`). Cette
 * adresse ne s'obtient qu'en ayant DÉPOSÉ le fichier par l'application — donc en
 * étant passé par le contrôle du type réel aux octets magiques, l'antivirus et le
 * retrait des EXIF.
 *
 * RESTE REFUSÉE toute autre cible — `https://…`, `//…`, un chemin relatif, un
 * `data:` — et pour trois raisons distinctes, aucune cosmétique :
 *
 *   1. UNE URL EXTERNE FUIT LE LECTEUR. Le navigateur de chaque membre qui ouvre
 *      le guide va chercher l'octet chez le tiers, et lui donne son adresse IP,
 *      son agent utilisateur et l'adresse du guide en référent. Le lecteur n'a
 *      rien choisi : c'est l'AUTEUR qui l'a envoyé là ;
 *   2. ELLE ÉCHAPPE À L'ANTIVIRUS ET AU RETRAIT DES EXIF (00 §8.2 et §8.1) — le
 *      fichier n'a jamais traversé l'API, et son contenu peut changer APRÈS la
 *      modération du guide, ce qu'aucune relecture ne verrait ;
 *   3. ELLE N'EST RETENUE PAR RIEN. Elle casse le jour où le tiers la retire, et
 *      le guide garde un cadre vide que personne ne peut réparer — pas même
 *      l'auteur, s'il a quitté la plateforme.
 *
 * LA CIBLE NE PEUT PAS PORTER DE TITRE (`![alt](/media/… "titre")`) : aucun écran
 * ne dessine d'infobulle, la légende de la maquette se compose de l'ALT et du nom
 * du contributeur, et accepter une seconde source de texte en créerait une
 * deuxième vérité pour la même phrase. Toute espace dans la cible est donc un
 * refus.
 *
 * ⚠ CE QUI N'EST PAS VÉRIFIÉ ICI, ET NE PEUT PAS L'ÊTRE : que la clé citée
 * désigne un média EXISTANT, PRÊT (`READY`) et appartenant à l'auteur. Un schéma
 * ne lit pas la base. C'est `GuidesService` qui le fait, à la création et à la
 * mise à jour, et qui refuse avec `IMAGE_NOT_ATTACHABLE`.
 */
const HTML_TAG = /<\/?[a-zA-Z][^>]*>/;
const HEADING_OUT_OF_RANGE = /^[ \t]*(?:#|#{4,})[ \t]/m;

/** Toutes les images du corps, leur cible capturée. `g` : il peut y en avoir plusieurs. */
const MARKDOWN_IMAGE = /!\[[^\]]*\]\(([^)]*)\)/g;

/** Le préfixe de l'adresse d'un média — `MediaService.view` : `/media/<clé>`. */
const MEDIA_URL_PREFIX = '/media/';

/**
 * Les extensions d'IMAGE, DÉRIVÉES de la politique de média et non recopiées :
 * le jour où `MEDIA_IMAGE_MIMES` accueille un format, cette grammaire le suit
 * sans qu'on ait à y penser.
 */
const MEDIA_IMAGE_EXTENSIONS = MEDIA_IMAGE_MIMES.map(
  (mime) => MEDIA_MIME_EXTENSIONS[mime] ?? '',
).filter((extension) => extension.length > 0);

/**
 * La grammaire EXACTE d'une adresse de média d'image, telle que `keyFor` la
 * fabrique : `<genre>/<année>/<mois>/<uuid>-<32 hexa>.<ext>`.
 *
 * Elle est serrée EXPRÈS. Accepter « tout ce qui commence par `/media/` »
 * laisserait passer `/media/../..%2f…` et ferait de cette validation une
 * invitation à essayer ; ici, une cible qui n'est pas littéralement une clé de
 * stockage est refusée avant d'atteindre la base.
 */
const MEDIA_IMAGE_URL = new RegExp(
  `^${MEDIA_URL_PREFIX}[a-z_]+/\\d{4}/\\d{2}/` +
    '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[0-9a-f]{32}' +
    `\\.(?:${MEDIA_IMAGE_EXTENSIONS.join('|')})$`,
);

/**
 * Les CLÉS DE STOCKAGE citées par le corps, dans l'ordre de PREMIÈRE apparition
 * et sans doublon.
 *
 * L'ordre compte : c'est celui que le lecteur voit, et c'est lui qui donne
 * `guide_media.position`. Il ne se déduit d'aucun identifiant. Le dédoublonnage
 * compte aussi : un long guide peut citer deux fois le même visuel, et deux
 * lignes pour un même actif feraient compter l'image deux fois.
 *
 * Le service s'en sert pour VÉRIFIER chaque clé en base puis synchroniser
 * `guide_media` — ce qui veut dire que l'extraction et la validation lisent la
 * MÊME grammaire, dans le même fichier. Deux expressions voisines auraient fini
 * par diverger, et le symptôme aurait été un média accepté puis jamais rattaché.
 */
export function guideBodyMediaKeys(body: string): string[] {
  const keys: string[] = [];
  for (const match of body.matchAll(MARKDOWN_IMAGE)) {
    const target = (match[1] ?? '').trim();
    if (!MEDIA_IMAGE_URL.test(target)) continue;
    const key = target.slice(MEDIA_URL_PREFIX.length);
    if (!keys.includes(key)) keys.push(key);
  }
  return keys;
}

export function restrictedMarkdownIssue(
  body: string,
): 'HTML' | 'HEADING_LEVEL' | 'IMAGE_EXTERNAL' | null {
  if (HTML_TAG.test(body)) return 'HTML';
  if (HEADING_OUT_OF_RANGE.test(body)) return 'HEADING_LEVEL';
  for (const match of body.matchAll(MARKDOWN_IMAGE)) {
    // Une image EST autorisée ; une image qui ne vient pas du pipeline média ne
    // l'est pas. Le code le dit : `IMAGE_EXTERNAL`, et non plus `IMAGE`.
    if (!MEDIA_IMAGE_URL.test((match[1] ?? '').trim())) return 'IMAGE_EXTERNAL';
  }
  return null;
}

const restrictedMarkdown = (schema: z.ZodString) =>
  schema.superRefine((value, ctx) => {
    const issue = restrictedMarkdownIssue(value);
    if (issue === null) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      params: { reason: issue },
      message:
        issue === 'HTML'
          ? 'Le HTML n’est pas autorisé : employez le Markdown.'
          : issue === 'HEADING_LEVEL'
            ? 'Seuls les titres de niveau 2 (##) et 3 (###) sont autorisés.'
            : // Le message DIT QUOI FAIRE : le membre a collé une adresse, et il
              // n'a aucun moyen de deviner qu'il existe un bouton pour cela.
              'Une image doit être déposée par le bouton image de l’éditeur : une adresse copiée depuis un autre site n’est pas acceptée.',
    });
  });

// ── Champs ──────────────────────────────────────────────────────────────────

const enumOf = <T extends string>(values: readonly T[]) =>
  z.enum(values as unknown as [T, ...T[]]);

export const guideCategorySchema = enumOf(GuideCategory);
export const guideScopeSchema = enumOf(GuideScope);
export const guideVoteValueSchema = enumOf(GuideVoteValue);

export const guideTitleSchema = z.string().trim().min(GUIDE_TITLE_MIN).max(GUIDE_TITLE_MAX);

/**
 * Corps d'un BROUILLON : le maximum s'applique, le minimum non.
 *
 * L'éditeur enregistre automatiquement (§5) ; refuser un brouillon de
 * 299 caractères perdrait le texte du membre au moment précis où il écrit.
 * Les 300 caractères du §2.1 sont exigés à la PUBLICATION.
 */
export const guideDraftBodySchema = restrictedMarkdown(z.string().min(1).max(GUIDE_BODY_MAX));

/**
 * Corps publiable d'UNE page : les deux bornes du §2.1.
 *
 * Reste le schéma d'une page prise seule. La publication, elle, mesure le TOTAL —
 * voir `guidePublishableGuideBodySchema` juste en dessous, qui dit pourquoi.
 */
export const guidePublishableBodySchema = restrictedMarkdown(
  z.string().min(GUIDE_BODY_MIN).max(GUIDE_BODY_MAX),
);

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║ LES 300 CARACTÈRES S'APPLIQUENT AU TOTAL, PAS PAGE PAR PAGE              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * LA DÉCISION, ET SA RAISON. Un guide de cinq pages courtes mais riche — « Le
 * dossier », « Le rendez-vous », « L'attente », « Le retrait », « Ce qui m'a
 * surpris » — serait REFUSÉ si chaque page devait faire 300 caractères, alors
 * qu'il en totalise 1 200 et qu'il est exactement ce que la fonctionnalité sert à
 * écrire. Et la règle page-par-page serait CONTOURNABLE dans l'autre sens : un
 * auteur pressé n'a qu'à tout mettre sur une page de 300 caractères pour passer.
 * Le minimum existe pour refuser un guide VIDE ; le total est la seule mesure qui
 * dise s'il l'est.
 *
 * LE MAXIMUM, LUI, RESTE PAR PAGE — et c'est le pendant exact du même
 * raisonnement. `GUIDE_BODY_MAX` borne ce qu'une seule requête écrit et ce qu'un
 * seul écran rend ; l'appliquer au total ramènerait un guide de dix pages à la
 * taille d'un guide d'une page, ce qui annulerait l'intérêt des pages. Chaque
 * page l'a déjà subi à l'écriture (`guideDraftBodySchema`, sur CHAQUE `PATCH`), et
 * ce schéma n'a donc plus qu'un minimum à exiger.
 *
 * LA GRAMMAIRE EST REPASSÉE SUR LE TOTAL, et ce n'est pas redondant : une page
 * écrite avant qu'une règle du Markdown restreint ne se durcisse serait passée à
 * l'époque. La publication est le dernier moment où la refuser coûte moins qu'un
 * guide publié hors règle.
 */
export const guidePublishableGuideBodySchema = restrictedMarkdown(
  z.string().min(GUIDE_BODY_MIN),
);

/**
 * Le texte sur lequel la publication et la modération travaillent : les corps des
 * pages, dans l'ordre de `position`, séparés par une ligne vide.
 *
 * Une FONCTION PARTAGÉE, et non deux concaténations voisines : le serveur mesure
 * la longueur publiable et l'éditeur annonce « il vous reste N caractères ». Deux
 * assemblages différents donneraient deux nombres différents pour la même règle,
 * et c'est l'écran qui mentirait.
 */
export function joinGuidePageBodies(bodies: readonly string[]): string {
  return bodies.filter((body) => body.length > 0).join('\n\n');
}

// ── Requêtes (§4) ───────────────────────────────────────────────────────────

/**
 * `scope = COUNTRY` exige `originCountryId` (§2.1, et la contrainte
 * `guides_country_scope` en base). Le refus est donc une VALIDATION propre, et
 * non une violation de contrainte remontée depuis PostgreSQL.
 */
const countryScopeCoherent = (
  value: { scope?: string | undefined; originCountryId?: string | undefined },
  ctx: z.RefinementCtx,
): void => {
  if (value.scope === 'COUNTRY' && value.originCountryId === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['originCountryId'],
      message: 'Un guide de portée « pays » doit indiquer son pays d’origine.',
    });
  }
};

export const createGuideSchema = z
  .object({
    title: guideTitleSchema,
    body: guideDraftBodySchema,
    category: guideCategorySchema,
    scope: guideScopeSchema,
    originCountryId: uuidSchema.optional(),
    cityId: uuidSchema.optional(),
  })
  .strict()
  .superRefine(countryScopeCoherent);

export type CreateGuide = z.infer<typeof createGuideSchema>;

/**
 * §4 : `body`, `title` si DRAFT, `category`, `scope`, `cityId`.
 *
 * ─── `baseRevision` — DE QUELLE VERSION LE CLIENT PART ──────────────────────
 *
 * Arbitrage du porteur : « le serveur refuse une écriture qui ne part pas de la
 * version courante ». C'est ce champ qui porte la question ; `EDITED_ELSEWHERE`
 * porte la réponse.
 *
 * CE QUI EXISTAIT ET NE POUVAIT PAS SERVIR, mesuré sur deux enregistrements
 * successifs d'un brouillon, service appelé en direct :
 *
 *   · `currentVersion.version` ne bouge pas — un brouillon reste en version 1,
 *     modifiée sur place ;
 *   · `currentVersion.id` ne bouge pas non plus, pour la même raison ;
 *   · `guides.updated_at` ne bouge PAS : le chemin « brouillon » n'écrit que
 *     `guide_versions.body`, et `tx.guide.update` n'est appelé que
 *     `if (Object.keys(data).length > 0)` — donc jamais pour un corps seul.
 *     Les trois relevés d'horodatage étaient identiques à la milliseconde.
 *
 * Aucun champ déjà rendu par l'API ne distingue donc deux états d'un brouillon.
 * D'où `guides.revision`, un compteur d'écritures de CONTENU que l'API rend dans
 * `guideEditorResponseSchema` et que le client renvoie tel quel.
 *
 * EXIGÉ AVEC `body`, ET AVEC `body` SEULEMENT. C'est le corps qui se perd : il
 * est long, il est écrit en continu, et sur un brouillon il s'écrase sans trace.
 * Un changement de catégorie ou de portée écrase un choix d'un clic, que l'on
 * refait sans rien relire — exiger une version attendue y ajouterait des refus
 * sans rien sauver. Le titre reste hors garde pour la même raison, et c'est
 * nommé plutôt que sous-entendu.
 */
export const updateGuideSchema = z
  .object({
    /**
     * LA PAGE QUE `body` MODIFIE. Absent → LA PREMIÈRE page.
     *
     * FACULTATIF, et c'est la garantie de compatibilité : l'éditeur d'un guide à
     * une page continue d'envoyer `{ body }` seul, et il atteint la seule page
     * qu'il y a. Rendre ce champ obligatoire aurait cassé tous les
     * enregistrements automatiques en cours au moment du déploiement.
     *
     * Il ne vaut que pour `body`. `title`, `category`, `scope`, `cityId` et
     * `originCountryId` décrivent le GUIDE : ils ne sont pas par page. Le titre
     * d'une page se change par `PATCH /guides/:id/pages/:pageId`.
     */
    pageId: uuidSchema.optional(),
    title: guideTitleSchema.optional(),
    body: guideDraftBodySchema.optional(),
    category: guideCategorySchema.optional(),
    scope: guideScopeSchema.optional(),
    originCountryId: uuidSchema.nullable().optional(),
    cityId: uuidSchema.nullable().optional(),
    /** La `revision` que le client a lue. Entier, et jamais négatif : `@default(0)` en base. */
    baseRevision: z.number().int().min(0).optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, { message: 'Aucune modification.' })
  .superRefine((patch, ctx) => {
    if (patch.scope === 'COUNTRY' && patch.originCountryId === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['originCountryId'],
        message: 'Un guide de portée « pays » doit indiquer son pays d’origine.',
      });
    }
    /**
     * REFUSÉ ICI, et pas seulement toléré par le service.
     *
     * Un `baseRevision` facultatif que le serveur ignorerait quand il est absent
     * laisserait exactement le défaut mesuré en place : il suffirait qu'un client
     * oublie le champ pour que les deux onglets s'écrasent à nouveau, sans qu'un
     * seul test échoue. Le schéma est la SEULE source de validation (00 §4) : la
     * règle vit donc ici, et le client la voit avant l'envoi.
     */
    if (patch.body !== undefined && patch.baseRevision === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['baseRevision'],
        message:
          'Indiquez la révision dont vous partez : sans elle, deux éditeurs du même guide s’écrasent.',
      });
    }
  });

export type UpdateGuide = z.infer<typeof updateGuideSchema>;

// ── Les pages d'un guide (§2.1, décision du porteur) ────────────────────────

/**
 * Le titre d'une page. Mêmes caractères que celui d'un guide, bornes différentes
 * — voir `GUIDE_PAGE_TITLE_MIN`.
 */
export const guidePageTitleSchema = z
  .string()
  .trim()
  .min(GUIDE_PAGE_TITLE_MIN)
  .max(GUIDE_PAGE_TITLE_MAX);

/**
 * `POST /guides/:id/pages` — ajouter une page.
 *
 * `body` est FACULTATIF : la maquette A05 ajoute une section puis la remplit, et
 * exiger 1 caractère obligerait l'éditeur à inventer un texte pour créer le
 * cadre. Une page sans corps n'a pas de version courante — c'est un cas prévu
 * (`currentVersion: null`), et elle ne compte pour rien dans le total publiable.
 *
 * La page naît TOUJOURS EN DERNIÈRE POSITION. `position` n'est pas accepté ici :
 * insérer au milieu, c'est créer puis déplacer, et le déplacement a sa route. Un
 * `position` à la création aurait dupliqué toute la logique de renumérotation
 * dans un second endroit.
 */
export const createGuidePageSchema = z
  .object({ title: guidePageTitleSchema, body: guideDraftBodySchema.optional() })
  .strict();

export type CreateGuidePage = z.infer<typeof createGuidePageSchema>;

/**
 * `PATCH /guides/:id/pages/:pageId` — renommer, déplacer.
 *
 * `position` est la position VOULUE, comptée à partir de 1, bornée par le serveur
 * au nombre de pages : l'écran n'a pas à connaître ce nombre pour déplacer une
 * page en dernier.
 *
 * Le corps ne passe PAS par ici — il passe par `PATCH /guides/:id` avec
 * `pageId`. Une seule route écrit du contenu, et c'est elle qui porte la limite
 * d'écriture relevée (60/min) de l'éditeur auto-enregistré ; dédoubler le chemin
 * aurait dédoublé les versions et les resynchronisations d'images.
 */
export const updateGuidePageSchema = z
  .object({
    title: guidePageTitleSchema.optional(),
    position: z.coerce.number().int().min(1).optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, { message: 'Aucune modification.' });

export type UpdateGuidePage = z.infer<typeof updateGuidePageSchema>;

/**
 * `GET /guides/:slug?page=<slug de page>` — la page lue.
 *
 * ABSENT → LA PREMIÈRE PAGE, et c'est la règle qui garde les liens déjà partagés
 * en état : `/guides/mon-guide` répondait avant les pages, il répond pareil
 * après. Un slug de page INCONNU donne un `404` et non la première page : rendre
 * autre chose que ce qui est demandé ferait croire au lecteur qu'il lit la page
 * du lien.
 */
export const guideDetailQuerySchema = z.object({ page: slugSchema.optional() }).strict();

export type GuideDetailQuery = z.infer<typeof guideDetailQuerySchema>;

export const guideListTabSchema = z.enum(['helpful', 'recent', 'review']).default('helpful');

export type GuideListTab = z.infer<typeof guideListTabSchema>;

export const guideListQuerySchema = cursorQuerySchema.extend({
  tab: guideListTabSchema,
  category: guideCategorySchema.optional(),
  countryId: uuidSchema.optional(),
  cityId: uuidSchema.optional(),
  /**
   * LES GUIDES D'UN MEMBRE — l'onglet « Guides » de son profil public.
   *
   * Le porteur : « pour tous les tabs il reprend le design des éléments présentés
   * de la façon dont ils sont présentés sur les pages d'origine ». La carte de
   * guide se dessine à partir de `guideCardSchema` entier — catégorie, portée,
   * fraîcheur, votes utiles, auteur. Une route résumée ne peut pas la nourrir :
   * on filtre donc LA LISTE elle-même, et le profil reçoit ce que `/guides`
   * reçoit.
   *
   * Le filtre s'ajoute aux règles existantes — statut publié, portée, ville — il
   * n'en remplace aucune.
   */
  authorHandle: handleSchema.optional(),
});

export type GuideListQuery = z.infer<typeof guideListQuerySchema>;

export const guideVoteSchema = z.object({ value: guideVoteValueSchema }).strict();

export const guideOutdatedFlagSchema = z
  .object({ comment: z.string().trim().min(1).max(500).optional() })
  .strict();

export const guideRevertSchema = z.object({ versionId: uuidSchema }).strict();

/**
 * §2.4 — le passage visé est COPIÉ TEL QUEL depuis la version courante : le
 * proposant ne le retouche pas, sinon le serveur ne pourrait plus le retrouver.
 */
export const createProposalSchema = z
  .object({
    targetExcerpt: z.string().min(3).max(4_000),
    /**
     * LE REMPLACEMENT PASSE PAR LA MÊME GRAMMAIRE QUE LE CORPS, et il ne le
     * faisait pas.
     *
     * Le texte accepté est RECOPIÉ DANS LE CORPS du guide (`decideProposal` :
     * `currentBody.replace(targetExcerpt, replacement)`). Tant que le corps
     * refusait toute image, l'oubli était une incohérence ; maintenant que les
     * images déposées par l'application sont acceptées, c'était une PORTE : une
     * proposition pouvait écrire `![x](https://…)` dans le guide d'un autre, et
     * l'auteur l'acceptait sans voir qu'il envoyait l'adresse IP de chacun de ses
     * lecteurs chez un tiers. Les mêmes trois refus s'appliquent donc ici.
     */
    replacement: restrictedMarkdown(z.string().max(GUIDE_BODY_MAX)),
    reason: z.string().trim().min(GUIDE_PROPOSAL_REASON_MIN).max(1_000),
    sourceUrl: z.string().url().max(500).optional(),
  })
  .strict();

export type CreateProposal = z.infer<typeof createProposalSchema>;

/**
 * « Accepter en modifiant » (§2.4) : le créateur ajuste le texte proposé.
 *
 * Même grammaire que `createProposalSchema.replacement`, et pour la même raison :
 * ce texte finit dans le corps du guide. Que la main soit celle de l'auteur ne
 * change rien à ce qu'une URL externe coûte à ses lecteurs.
 */
export const amendProposalSchema = z
  .object({ replacement: restrictedMarkdown(z.string().max(GUIDE_BODY_MAX)) })
  .strict();

/** Refus : motif OBLIGATOIRE (§2.4), le proposant en est notifié. */
export const rejectProposalSchema = z
  .object({ reason: z.string().trim().min(10).max(1_000) })
  .strict();

// ── Réponses ────────────────────────────────────────────────────────────────

/**
 * Bandeaux du §2.3 et du §2.6. Renvoyés par l'API, et non recomposés par le
 * front : le seuil de 24 mois et celui de 3 signalements sont des règles
 * métier, pas des détails d'affichage.
 */
export type GuideBannerKind = 'TO_VERIFY' | 'OUTDATED_REPORTED' | 'COMMUNITY_MAINTAINED';

export interface GuideBanner {
  readonly kind: GuideBannerKind;
  /** Renseigné pour `TO_VERIFY` : « dernière mise à jour il y a N mois ». */
  readonly months?: number;
}

/**
 * Une carte de liste (§5).
 *
 * RÈGLE (T1 §6, règle dure §9) : `lastContentUpdateAt` figure sur CHAQUE guide
 * de liste — « date de mise à jour aussi visible que le titre ». Le type
 * l'impose : un champ facultatif serait oublié un jour.
 */
export interface GuideListItem {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly category: GuideCategory;
  readonly scope: GuideScope;
  readonly status: string;
  readonly lastContentUpdateAt: Date;
  readonly helpfulCount: number;
  readonly freshnessScore: number;
  readonly maintainedByCommunity: boolean;
  readonly author: { readonly handle: string; readonly displayName: string; readonly verificationLevel: string } | null;
  readonly country: { readonly id: string; readonly iso2: string; readonly nameFr: string } | null;
  readonly city: { readonly id: string; readonly name: string } | null;
  readonly banners: readonly GuideBanner[];
  /** Combien de pages vivantes. Toujours ≥ 1. */
  readonly pageCount: number;
  /**
   * LE TOTAL du guide sur une liste, CELUI DE LA PAGE LUE sur le détail —
   * `guideListItemSchema` et `guideDetailResponseSchema` disent chacun lequel,
   * avec sa raison.
   */
  readonly commentCount: number;
}

// ── Schémas de réponse (§4) ─────────────────────────────────────────────────
//
// CHAQUE CHAMP CI-DESSOUS A ÉTÉ RELEVÉ SUR UNE CHARGE RÉELLE, pas déduit du
// code. Les quatre lectures publiques de §4 ont été appelées sur l'API qui
// tourne, et c'est leur JSON qui a tranché les trois points qu'une lecture du
// service aurait manqués :
//
//   1. `banners[].months` est ABSENT sur `COMMUNITY_MAINTAINED` et sur
//      `OUTDATED_REPORTED` — pas `null`. `bannersFor` pousse `{ kind }` sans la
//      clé, et `JSON.stringify` n'écrit pas les clés absentes. Un `.nullable()`
//      aurait refusé TOUT guide maintenu par la communauté en le nommant
//      « contrat cassé » ;
//   2. `freshnessScore` arrive en NOMBRE JSON ordinaire — `31` et `2.4` — bien
//      que la colonne soit `numeric(10,4)` : `toListItem` appelle `.toNumber()`
//      sur le Decimal. Ni chaîne, ni `31.0000` ;
//   3. les dates sont des CHAÎNES ISO (`"2026-08-21T19:15:07.903Z"`), jamais des
//      `Date`. L'interface `GuideListItem` ci-dessus décrit l'objet CÔTÉ
//      SERVEUR, avant sérialisation, et ses `Date` ne décrivent donc PAS ce que
//      le front reçoit. C'est précisément pourquoi ces schémas existent à part
//      plutôt que d'être dérivés d'elle.
//
// `.strict()` PARTOUT SUR LES FORMES DE CONTENU, et c'est structurel, pas un
// goût pour la rigueur : `guides.view_count` EXISTE — §3 l'ajoute, une tâche
// horaire le remplit depuis Redis — et la règle dure `00` §49 interdit qu'il
// soit exposé à quiconque, sur aucun contenu. Le guide est le seul contenu du
// produit à porter un tel compteur ; c'est donc ici que la règle est la plus
// facile à enfreindre. Sans `.strict()`, un `select` élargi d'une ligne le
// ferait sortir sans qu'aucun test ne bronche. Avec, la frontière le refuse pour
// TOUS les écrans à la fois.

/** Les trois bandeaux de §2.3 et §2.6, calculés par le serveur. */
export const guideBannerSchema = z
  .object({
    kind: z.enum(['TO_VERIFY', 'OUTDATED_REPORTED', 'COMMUNITY_MAINTAINED']),
    /**
     * `.optional()` ET NON `.nullable()` — relevé sur la charge : le bandeau
     * `COMMUNITY_MAINTAINED` arrive `{"kind":"COMMUNITY_MAINTAINED"}`, sans la
     * clé. Seul `TO_VERIFY` la porte, parce que seul lui l'affiche
     * (« dernière mise à jour il y a N mois »).
     */
    months: z.number().int().optional(),
  })
  .strict();

/** L'auteur d'un guide, tel que `LIST_INCLUDE` le sélectionne : TROIS champs. */
export const guideAuthorRefSchema = z
  .object({
    handle: z.string(),
    displayName: z.string(),
    verificationLevel: z.enum(VerificationLevel),
  })
  .strict();

/** L'auteur d'une VERSION et le proposant d'une correction : deux champs seulement. */
export const guidePersonRefSchema = z
  .object({ handle: z.string(), displayName: z.string() })
  .strict();

export const guideCountryRefSchema = z
  .object({ id: uuidSchema, iso2: z.string().length(2), nameFr: z.string() })
  .strict();

export const guideCityRefSchema = z.object({ id: uuidSchema, name: z.string() }).strict();

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║ UNE PAGE, TELLE QUE LE PLAN DU GUIDE LA MONTRE                           ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * CINQ CHAMPS, et pas le corps : `pages` est le PLAN du guide — ce que le lecteur
 * parcourt pour choisir où aller. Y mettre les corps ferait voyager dix fois
 * 20 000 caractères pour en afficher un seul.
 *
 * `commentCount` EST ICI, sur chaque page, et c'est ce qui permet au plan
 * d'annoncer où la conversation a lieu (« Le dossier · 4 »). Il compte, pour
 * CETTE page, exactement ce que le fil rendrait — même critère que partout
 * ailleurs (`commentCountWhere`, `apps/api/src/common/comment-visibility.ts`),
 * donc dépendant du lecteur et jamais mis en cache.
 *
 * Pas de `status` : la publication est d'un BLOC, décidée par le porteur. Une
 * page n'a pas d'état propre — voir l'en-tête du modèle `GuidePage`.
 */
export const guidePageRefSchema = z
  .object({
    id: uuidSchema,
    /** 1 pour la première. Les pages arrivent par `position` CROISSANTE. */
    position: z.number().int(),
    title: z.string(),
    /** Ce qui voyage dans `GET /guides/:slug?page=…`. Figé à la création. */
    slug: z.string(),
    commentCount: z.number().int(),
  })
  .strict();

export type GuidePageRef = z.infer<typeof guidePageRefSchema>;

/**
 * Une carte de liste — `GET /guides`, `GET /me/guides`.
 *
 * RÈGLE DURE (§9, T1 §6) : `lastContentUpdateAt` est REQUIS, sur chaque guide de
 * liste, « aussi visible que le titre ». Le rendre facultatif ici suffirait à ce
 * qu'un jour une route l'omette sans que rien ne le dise.
 *
 * `author` est nullable : l'anonymisation (§8) met `author_user_id` à null et
 * CONSERVE le guide. Un guide sans auteur est donc un cas normal, pas une panne.
 */
export const guideListItemSchema = z
  .object({
    id: uuidSchema,
    slug: z.string(),
    title: z.string(),
    category: z.enum(GuideCategory),
    scope: z.enum(GuideScope),
    status: z.enum(GuideStatus),
    lastContentUpdateAt: z.string().datetime(),
    helpfulCount: z.number().int(),
    freshnessScore: z.number(),
    maintainedByCommunity: z.boolean(),
    author: guideAuthorRefSchema.nullable(),
    country: guideCountryRefSchema.nullable(),
    city: guideCityRefSchema.nullable(),
    banners: z.array(guideBannerSchema),
    /**
     * COMBIEN DE PAGES. Toujours ≥ 1 : un guide sans page n'existe pas
     * (`LAST_PAGE` l'interdit, et la reprise de données en a donné une à chacun
     * des 127 guides qui existaient avant la fonctionnalité).
     */
    pageCount: z.number().int(),
    /**
     * ╔════════════════════════════════════════════════════════════════════════╗
     * ║ SUR LA LISTE, C'EST LE TOTAL DU GUIDE — SUR LE DÉTAIL, CELUI DE LA PAGE ║
     * ╚════════════════════════════════════════════════════════════════════════╝
     *
     * Le porteur : « Les commentaires concernent donc une page du guide, et c'est
     * LE TOTAL qui est affiché sur la page de listing des guides. »
     *
     * LES DEUX NOMBRES SONT JUSTES, chacun là où il est, et ce n'est pas une
     * incohérence : la carte de liste parle du guide ENTIER — un lecteur qui
     * choisit un guide veut savoir s'il a fait parler, toutes pages confondues.
     * La page de lecture, elle, coiffe un fil : son nombre est la LONGUEUR DE LA
     * LISTE RENDUE juste en dessous, règle que `chargerH02` tient déjà pour
     * l'entraide et que `comment-visibility.ts` existe pour garantir.
     * `guideDetailResponseSchema` redit donc ce champ, avec son propre
     * commentaire, pour que personne n'ait à deviner lequel il tient en main.
     */
    commentCount: z.number().int(),
  })
  .strict();

export type GuideListItemView = z.infer<typeof guideListItemSchema>;

/**
 * `GET /guides` — A03.
 *
 * `meta.staleAfterMonths` voyage AVEC la liste (T4 §4) : le seuil de 24 mois est
 * une règle métier, et le front qui le coderait en dur finirait par afficher un
 * bandeau que le serveur ne pose plus.
 */
export const guideListResponseSchema = pageSchema(guideListItemSchema).extend({
  meta: z.object({ tab: guideListTabSchema, staleAfterMonths: z.number().int() }).strict(),
});

export type GuideListResponse = z.infer<typeof guideListResponseSchema>;

/** `GET /me/guides` — tous statuts, sans `meta`. */
export const myGuidesResponseSchema = pageSchema(guideListItemSchema);

export type MyGuidesResponse = z.infer<typeof myGuidesResponseSchema>;

/** La version courante telle que `GET /guides/:slug` la porte : SIX champs. */
export const guideCurrentVersionSchema = z
  .object({
    id: uuidSchema,
    version: z.number().int(),
    body: z.string(),
    summary: z.string().nullable(),
    createdAt: z.string().datetime(),
    createdBy: guidePersonRefSchema.nullable(),
  })
  .strict();

/**
 * `GET /guides/:slug` — A04.
 *
 * Le guide reprend la carte de liste et lui ajoute cinq champs. `myVote` et
 * `myOutdatedFlag` valent `null` pour un visiteur anonyme — relevé : la route
 * est `@PublicRead()`, et le service court-circuite les deux requêtes quand il
 * n'y a pas de lecteur.
 *
 * `isAuthor` vient du SERVEUR et ne sert qu'à l'AFFICHAGE : les gestes de
 * l'auteur (modifier, dépublier) sont tentés, et c'est l'API qui refuse. Le lire
 * pour AUTORISER serait la faille de quinze minutes rejouée dans le front.
 */
export const guideDetailResponseSchema = z
  .object({
    guide: guideListItemSchema
      .extend({
        originCountryId: uuidSchema.nullable(),
        outdatedFlagCount: z.number().int(),
        /**
         * ╔══════════════════════════════════════════════════════════════════╗
         * ║ SUR LE DÉTAIL, C'EST LE COMPTE DE LA PAGE LUE                    ║
         * ╚══════════════════════════════════════════════════════════════════╝
         *
         * Le champ est HÉRITÉ de `guideListItemSchema`, où il porte le TOTAL du
         * guide ; il est REDÉCLARÉ ici pour une seule raison : sur cette route il
         * ne vaut pas la même chose, et un lecteur du contrat ne doit pas avoir à
         * le découvrir à l'usage. Décision du porteur : « sur la page d'un guide,
         * N COMMENTAIRES compte CEUX DE LA PAGE LUE ».
         *
         * C'est la règle de `chargerH02` : le nombre annoncé est la LONGUEUR DE
         * LA LISTE MONTRÉE. Le fil rendu sous le guide est celui de
         * `currentPage` — `GET /comments?subjectType=GUIDE_PAGE&subjectId=
         * <currentPage.id>` — donc le nombre qui le coiffe est le sien. Le total
         * du guide reste lisible : c'est la somme des `pages[].commentCount`,
         * et c'est ce que la carte de liste porte.
         *
         * IL EST DANS `guide`, et pas à la racine, parce qu'il décrit le contenu
         * lu comme `helpfulCount` et `outdatedFlagCount` le font : les trois
         * compteurs de la même carte vivent au même endroit, sinon le front
         * apprend deux chemins pour trois chiffres voisins.
         *
         * IL COMPTE CE QUE LA LISTE AFFICHE, et c'est tout l'enjeu : le critère
         * est celui de `commentCountWhere`
         * (`apps/api/src/common/comment-visibility.ts`, extrait de
         * `FeedService` pour que les deux le lisent) —
         * `deletedAt: null`, `status: PUBLISHED` ou `HIDDEN`, auteur vivant et
         * non séparé du lecteur. Un compteur qui compterait autre chose serait un
         * mensonge à l'écran : « 12 commentaires » puis un fil qui en montre neuf.
         *
         * Il DÉPEND donc du lecteur (les blocages ne sont pas les mêmes pour
         * tous), ce qui interdit de le mettre en cache sur le guide.
         */
        commentCount: z.number().int(),
        unpublishDeadlineAt: z.string().datetime().nullable(),
        createdAt: z.string().datetime(),
        isAuthor: z.boolean(),
      })
      .strict(),
    /**
     * LE PLAN DU GUIDE — toutes ses pages, par `position` CROISSANTE.
     *
     * Toujours au moins un élément. Un guide à UNE page rend donc un tableau d'un
     * élément, et c'est la forme qui garantit l'autre règle : le front dessine le
     * plan quand `pages.length > 1` et ne change rien sinon, sans avoir à
     * distinguer « pas de pages » de « une seule ».
     */
    pages: z.array(guidePageRefSchema),
    /**
     * LA PAGE LUE. Celle que `?page=<slug>` désigne, ou la PREMIÈRE si le
     * paramètre est absent. Toujours l'un des éléments de `pages`.
     *
     * Elle est renvoyée EN ENTIER plutôt que par son index : l'écran a besoin de
     * son `id` pour charger et poster les commentaires
     * (`subjectType: 'GUIDE_PAGE'`), de son `title` pour l'intertitre et de son
     * `slug` pour l'adresse canonique. Lui faire chercher l'élément dans `pages`
     * aurait créé deux façons de se tromper de page.
     */
    currentPage: guidePageRefSchema,
    /**
     * `null` tant qu'aucune version n'est courante (brouillon en cours d'écriture,
     * ou page ajoutée et pas encore remplie).
     *
     * ⚠ C'EST LA VERSION COURANTE DE `currentPage`, PAS CELLE DU GUIDE. Le champ
     * existait avant les pages et porte désormais le corps de la page lue — c'est
     * ce que l'écran A04 rend, et c'est le seul corps qu'il affiche. La version
     * courante « du guide » n'a plus de sens : un guide de trois pages en a trois.
     */
    currentVersion: guideCurrentVersionSchema.nullable(),
    contributors: z.array(
      z
        .object({
          acceptedCount: z.number().int(),
          firstAt: z.string().datetime(),
          user: guidePersonRefSchema,
        })
        .strict(),
    ),
    myVote: z.enum(GuideVoteValue).nullable(),
    myOutdatedFlag: z
      .object({ id: uuidSchema, comment: z.string().nullable() })
      .strict()
      .nullable(),
  })
  .strict();

export type GuideDetailResponse = z.infer<typeof guideDetailResponseSchema>;

/**
 * `GET /guides/:slug/versions` — l'historique de §2.7.
 *
 * Le CORPS n'y est pas, et c'est voulu côté service : l'historique sert à
 * choisir une version, pas à télécharger le guide vingt fois. `.strict()` le
 * tient : si `body` y revenait, la validation le dirait.
 */
export const guideVersionRowSchema = z
  .object({
    id: uuidSchema,
    version: z.number().int(),
    summary: z.string().nullable(),
    createdAt: z.string().datetime(),
    sourceProposalId: uuidSchema.nullable(),
    createdBy: guidePersonRefSchema.nullable(),
  })
  .strict();

export const guideVersionsResponseSchema = pageSchema(guideVersionRowSchema).extend({
  meta: z.object({ currentVersionId: uuidSchema.nullable() }).strict(),
});

export type GuideVersionsResponse = z.infer<typeof guideVersionsResponseSchema>;

/** `GET /guides/:slug/versions/:versionId` — la même ligne, corps compris. */
export const guideVersionDetailSchema = guideVersionRowSchema.extend({ body: z.string() });

export type GuideVersionDetail = z.infer<typeof guideVersionDetailSchema>;

/**
 * Ce que rendent les NEUF écritures de l'auteur — `POST /guides`,
 * `PATCH /guides/:id`, `publish`, `unpublish`, `revert`,
 * `journeys/:id/to-guide`, et les trois routes de pages (`POST`, `PATCH`,
 * `DELETE /guides/:id/pages…`).
 *
 * Elles partagent toutes `byIdForAuthor`, et sa forme n'est PAS celle de
 * `GET /guides/:slug` : l'objet est PLAT (aucune enveloppe `guide`), il n'a pas
 * de `createdAt`, et sa `currentVersion` ne porte que QUATRE champs — ni
 * `createdAt`, ni `createdBy`. Deux formes voisines pour deux routes voisines :
 * les confondre donnerait un `ApiShapeError` à la première sauvegarde de
 * l'éditeur, et `.strict()` fait que le message nommerait le champ en trop.
 *
 * ── POURQUOI LES PAGES SONT ICI AUSSI ─────────────────────────────────────
 *
 * Parce que les trois routes de pages rendent cette forme, et qu'une réponse qui
 * ne dit pas l'état des pages après avoir ajouté, déplacé ou retiré une page
 * obligerait l'éditeur à relire le guide juste après chaque geste. `currentPage`
 * nomme la page à laquelle `currentVersion` appartient : sans elle, l'éditeur
 * aurait un corps sans savoir où il va.
 */
export const guideEditorResponseSchema = guideListItemSchema
  .extend({
    originCountryId: uuidSchema.nullable(),
    outdatedFlagCount: z.number().int(),
    unpublishDeadlineAt: z.string().datetime().nullable(),
    isAuthor: z.boolean(),
    /** Le plan du guide, par `position` croissante. Au moins un élément. */
    pages: z.array(guidePageRefSchema),
    /**
     * La page que `currentVersion` décrit : celle que le `PATCH` visait, celle
     * qui vient d'être ajoutée, ou la PREMIÈRE après un retrait et pour les
     * écritures qui ne nomment pas de page.
     */
    currentPage: guidePageRefSchema,
    /**
     * Le compteur d'écritures de CONTENU — ce que l'éditeur renvoie en
     * `baseRevision` à l'enregistrement suivant.
     *
     * Il est sur CETTE forme et pas sur `guideListItemSchema` : seul l'auteur
     * écrit, et une liste publique n'a rien à faire d'un jeton d'écriture
     * concurrente. Le voir ailleurs voudrait dire qu'on l'a mis trop haut.
     */
    revision: z.number().int(),
    currentVersion: z
      .object({
        id: uuidSchema,
        version: z.number().int(),
        body: z.string(),
        summary: z.string().nullable(),
      })
      .strict()
      .nullable(),
  })
  .strict();

export type GuideEditorResponse = z.infer<typeof guideEditorResponseSchema>;

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ UNE PAGE AVEC SON CORPS — ET POURQUOI CE N'EST PAS `guidePageRefSchema`    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * `guidePageRefSchema` dit, noir sur blanc, pourquoi il n'a PAS de corps : « Y
 * mettre les corps ferait voyager dix fois 20 000 caractères pour en afficher un
 * seul. » Cet argument tient pour LE PLAN — ce que le lecteur parcourt pour
 * choisir où aller — et il tombe pour L'ÉDITEUR, qui a besoin de TOUS les corps
 * en même temps : c'est exactement ce qu'un auteur ouvre quand il reprend un
 * guide de trois pages, et sans quoi passer d'une page à l'autre demanderait une
 * requête — ou, pire, une ÉCRITURE déguisée en lecture.
 *
 * Le schéma du plan reste donc intact, et celui-ci L'ÉTEND pour la SEULE route
 * qui en a l'usage (`GET /guides/:slug/editor`). Deux formes pour deux besoins,
 * dérivées l'une de l'autre : un jour où le plan gagne un champ, l'éditeur le
 * reçoit sans qu'on y pense.
 *
 * `body` VAUT `''` ET N'EST PAS NULLABLE quand la page n'a pas encore de version
 * courante — ce qui arrive à toute page créée par `POST /guides/:id/pages`, dont
 * le corps est facultatif. Un `null` aurait obligé chaque lecteur à écrire
 * `?? ''` ; la chaîne vide EST la bonne description d'une page vide, et c'est la
 * valeur que le `<textarea>` de l'éditeur montre de toute façon.
 */
export const guideEditorPageSchema = guidePageRefSchema
  .extend({ body: z.string() })
  .strict();

export type GuideEditorPage = z.infer<typeof guideEditorPageSchema>;

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ `GET /guides/:slug/editor` — CE QUE L'AUTEUR RELIT POUR REPRENDRE SON GUIDE ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * LA SEULE DIFFÉRENCE AVEC `guideEditorResponseSchema` EST `pages[].body`, et
 * c'est tout l'objet de la route : les NEUF écritures de l'auteur rendent le plan
 * SANS corps plus le corps de LA page visée, ce qui suffit à un éditeur qui vient
 * de créer ses pages lui-même (il connaît les autres corps, il les a tapés) et ne
 * suffit PAS à un éditeur qui s'ouvre sur un guide EXISTANT. C'était l'écart
 * remonté par le lot précédent, à l'endroit même où il est corrigé.
 *
 * ── POURQUOI ÉTENDRE PLUTÔT QUE DÉCLARER UNE FORME VOISINE ─────────────────
 *
 * Parce que l'éditeur adopte les deux de la MÊME façon (`adopterReponse`), et que
 * deux objets littéraux voisins auraient divergé au premier champ ajouté. Le
 * `.strict()` est redit par prudence : `.extend()` le conserve, mais le relire
 * ici évite d'avoir à le savoir.
 *
 * `currentPage` et `currentVersion` RESTENT, et ils désignent la PREMIÈRE page —
 * celle que la route de lecture publique rend aussi par défaut. L'éditeur ouvre
 * donc sur la page 1, et la barre latérale sert à aller ailleurs.
 */
export const guideAuthorEditorResponseSchema = guideEditorResponseSchema
  .extend({ pages: z.array(guideEditorPageSchema) })
  .strict();

export type GuideAuthorEditorResponse = z.infer<typeof guideAuthorEditorResponseSchema>;

/**
 * Une proposition telle que `GET /guides/:id/proposals` la rend — A06.
 *
 * `sourceUrl` est NULLABLE et non facultatif : c'est une colonne nullable
 * SÉLECTIONNÉE, et Prisma rend `null` pour une colonne vide — jamais une clé
 * manquante. C'est l'inverse exact de `banners[].months`, et les deux ont été
 * relevés plutôt que devinés.
 *
 * `rejectReason` N'EST PAS dans cette liste : le service ne le sélectionne pas
 * ici, parce que cette route ne montre jamais de proposition refusée à un tiers
 * (§4 : « pour l'auteur : en attente ; pour tous : acceptées »). Il n'apparaît
 * que dans `/me/proposals`, où le proposant a le droit de lire le motif de son
 * propre refus.
 */
export const guideProposalSchema = z
  .object({
    id: uuidSchema,
    status: z.enum(GuideProposalStatus),
    targetExcerpt: z.string(),
    replacement: z.string(),
    reason: z.string(),
    sourceUrl: z.string().nullable(),
    /** §2.4 : `created_at + 14 jours`. L'écran en tire le délai restant. */
    escalateAt: z.string().datetime(),
    decidedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    proposer: guidePersonRefSchema,
  })
  .strict();

export type GuideProposalView = z.infer<typeof guideProposalSchema>;

export const guideProposalsResponseSchema = pageSchema(guideProposalSchema);

export type GuideProposalsResponse = z.infer<typeof guideProposalsResponseSchema>;

/**
 * Ce que rendent `POST /guides/:id/proposals` et les trois décisions
 * (`accept`, `amend`, `reject`) : `proposalView`, qui ajoute `guideId` et
 * `rejectReason` à la ligne ci-dessus.
 */
export const guideProposalDetailSchema = guideProposalSchema.extend({
  guideId: uuidSchema,
  rejectReason: z.string().nullable(),
});

export type GuideProposalDetail = z.infer<typeof guideProposalDetailSchema>;

/**
 * `GET /me/proposals` — mes propositions envoyées.
 *
 * Le proposant voit `rejectReason` (§2.4 : « proposant notifié », motif
 * obligatoire), et le guide visé y est réduit à ses trois champs de lien. Il n'y
 * a PAS de `proposer` : c'est moi.
 */
export const myProposalRowSchema = z
  .object({
    id: uuidSchema,
    status: z.enum(GuideProposalStatus),
    targetExcerpt: z.string(),
    replacement: z.string(),
    reason: z.string(),
    sourceUrl: z.string().nullable(),
    rejectReason: z.string().nullable(),
    escalateAt: z.string().datetime(),
    decidedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    guide: z.object({ id: uuidSchema, slug: z.string(), title: z.string() }).strict(),
  })
  .strict();

export const myProposalsResponseSchema = pageSchema(myProposalRowSchema);

export type MyProposalsResponse = z.infer<typeof myProposalsResponseSchema>;

/**
 * `PUT /guides/:id/vote` et `DELETE` — §2.2.
 *
 * `helpfulCount` est RELU du serveur et remplace le compteur affiché. Pas
 * d'incrément local : `NOT_HELPFUL` ne le bouge PAS (règle dure §9), et un front
 * qui incrémenterait « de son côté » inventerait le seul chiffre que la règle
 * interdit de bouger.
 */
export const guideVoteResponseSchema = z
  .object({ value: z.enum(GuideVoteValue).nullable(), helpfulCount: z.number().int() })
  .strict();

export type GuideVoteResponse = z.infer<typeof guideVoteResponseSchema>;

/** `POST /guides/:id/outdated` et `DELETE` — §2.6. */
export const guideOutdatedResponseSchema = z
  .object({ outdatedFlagCount: z.number().int(), status: z.enum(GuideStatus) })
  .strict();

export type GuideOutdatedResponse = z.infer<typeof guideOutdatedResponseSchema>;

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ `GET /guides/:id/outdated` — CE QUI A ÉTÉ SIGNALÉ, JAMAIS PAR QUI          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * ── LES DEUX ARBITRAGES DU PORTEUR, ET COMMENT ILS SE COMPOSENT ────────────
 *
 * 1. « Les signalants resteront anonymes : l'auteur ne voit que le compte. Pas
 *    des commentaires et autres. » — c'était la réponse à « faut-il NOMMER les
 *    signalants à l'auteur ? ».
 * 2. « Il faut faire ceci, l'auteur doit voir les signalements "a changé". »
 *
 * Le second ouvre la LECTURE ; le premier garde l'ANONYMAT. L'auteur voit donc
 * ce qui a été signalé — la date, et le commentaire quand il y en a un — et rien
 * qui permette de remonter au membre.
 *
 * ── CE QUE CE SCHÉMA NE PORTE PAS, ET CE N'EST PAS UN OUBLI ────────────────
 *
 * Ni `userId`, ni `handle`, ni `displayName`, ni avatar, ni initiales, NI MÊME
 * L'IDENTIFIANT DU SIGNALEMENT. `guide_outdated_flags.id` est un `uuid` v4 — il
 * ne dit rien de personne — mais l'écran de l'auteur n'en a aucun usage : il
 * n'offre ni retrait ni réponse. Une clé rendue « au cas où » est une clé qu'un
 * lot suivant croisera avec autre chose, et `.strict()` ne protège que ce qu'on
 * ne déclare pas. L'ANONYMAT TIENT DONC AU SCHÉMA, pas à la discipline de
 * l'appelant.
 *
 * ⚠ CE QUE L'ANONYMAT NE PEUT PAS CACHER, ET IL FAUT LE DIRE : un guide qui
 * n'a reçu QU'UN signalement, et dont l'auteur sait qui l'a lu, laisse deviner.
 * Aucun schéma ne corrige cela — c'est la limite de l'anonymat sur un petit
 * nombre, et elle est remontée plutôt que couverte par une fausse garantie.
 *
 * `comment` est NULLABLE parce que le champ est FACULTATIF à la saisie
 * (`guideOutdatedFlagSchema`, 1 à 500 caractères, `.optional()`). Un signalement
 * sans commentaire est un cas NORMAL, pas une donnée manquante : l'écran le dit
 * avec les mots du produit plutôt que de laisser une ligne vide.
 */
export const guideOutdatedFlagRowSchema = z
  .object({ createdAt: z.string().datetime(), comment: z.string().nullable() })
  .strict();

export type GuideOutdatedFlagRow = z.infer<typeof guideOutdatedFlagRowSchema>;

/**
 * La liste, par date DÉCROISSANTE — le dernier signalement d'abord, qui est
 * celui qui vient de déclencher la notification.
 *
 * PAS DE CURSEUR, et c'est borné par la règle métier : §2.6 impose UN signalement
 * par membre et par guide, et le guide bascule en `FLAGGED` à TROIS. Une liste qui
 * demanderait une page serait un guide que des centaines de membres contestent —
 * cas dans lequel l'écran de l'auteur n'est plus le sujet. Le jour où il faudra
 * paginer, `pageSchema` est là et la forme `{ items }` l'accueille sans rupture.
 */
export const guideOutdatedFlagsResponseSchema = z
  .object({ items: z.array(guideOutdatedFlagRowSchema) })
  .strict();

export type GuideOutdatedFlagsResponse = z.infer<typeof guideOutdatedFlagsResponseSchema>;

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « OUVRIR À LA COMMUNAUTÉ » — UN BOOLÉEN, ET POURQUOI PAS DEUX ROUTES       ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur : « le bouton ouvrir à la communauté ne marche pas. » MESURÉ : le
 * `<a href="#">` de la carte d'auteur à 1 440 px ne menait nulle part, et
 * `maintained_by_community` n'était écrit QUE par la tâche
 * `guide.author_inactivity` et par l'anonymisation — aucune route ne le touchait.
 *
 * ── POURQUOI UN `PUT` AVEC UN BOOLÉEN, ET NON `POST` + `DELETE` ────────────
 *
 * §2.5 : « Réversible si l'auteur revient et le demande. » La réversibilité est
 * donc dans la spécification, pas une commodité — et elle décide de la FORME :
 *
 *   · UN SEUL CHEMIN, DONC UNE SEULE RÈGLE D'ACCÈS. `POST` + `DELETE` auraient
 *     fait deux décorateurs de capacité, deux appels à `loadOwned`, deux
 *     endroits à tenir d'accord. Le dépôt a déjà payé cela : la paire
 *     `POST`/`DELETE /guides/:id/outdated` porte deux fois la même capacité, et
 *     le jour où l'une des deux change, rien ne le dit.
 *   · IDEMPOTENT PAR CONSTRUCTION. Ouvrir un guide déjà ouvert est un `PUT` qui
 *     ne change rien, pas un `409`. L'écran de l'auteur affiche l'état qu'il a lu
 *     à la dernière réponse ; un double clic, ou un second onglet, ne doit pas
 *     produire d'erreur pour un état déjà atteint.
 *   · L'INTENTION EST DANS LE CORPS, DONC LISIBLE. `{ maintained: false }` dit
 *     « je reprends la main » ; un `DELETE /guides/:id/community` aurait laissé
 *     croire qu'on supprime quelque chose du guide.
 *
 * ⚠ CE N'EST PAS UN RÉGLAGE D'AFFICHAGE, et le schéma ne peut pas le dire — c'est
 * à la confirmation de l'écran de le faire. §2.4, ligne 52 : « Si le guide est
 * `maintained_by_community` : les propositions vont directement en file de
 * modération, sans passer par le créateur. » L'auteur qui bascule ce booléen
 * RENONCE à valider les corrections de son propre guide.
 */
export const guideCommunityMaintenanceSchema = z.object({ maintained: z.boolean() }).strict();

export type GuideCommunityMaintenance = z.infer<typeof guideCommunityMaintenanceSchema>;

/**
 * La réponse rend l'état ATTEINT, relu de la ligne écrite — jamais l'écho du
 * corps reçu. C'est la même règle que `guideVoteResponseSchema` applique au
 * compteur d'utilité : le front recale sur ce que le serveur a, pas sur ce qu'il
 * a demandé.
 */
export const guideCommunityMaintenanceResponseSchema = z
  .object({ maintainedByCommunity: z.boolean() })
  .strict();

export type GuideCommunityMaintenanceResponse = z.infer<
  typeof guideCommunityMaintenanceResponseSchema
>;
