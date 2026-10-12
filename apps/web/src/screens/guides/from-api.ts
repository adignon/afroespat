/**
 * DE L'API VERS LES PRISES DU JSX TRANSCODÉ — guides (A03 à A06).
 *
 * Le JSX de `screens/a0{3,4,5,6}/*.generated.tsx` ne bouge pas d'une virgule : il
 * lit `g.title`, `g.updated`, `g.cat`, `g.useful`… c'est-à-dire la FORME que la
 * maquette calcule dans son `renderVals()`. L'API, elle, renvoie
 * `lastContentUpdateAt`, `category`, `helpfulCount`, `banners`. Les deux
 * vocabulaires sont différents et doivent le rester : la maquette est une source
 * de DESSIN, l'API une source de DONNÉE.
 *
 * Ce fichier traduit le second dans le premier. Il ne décide rien de métier :
 * chaque valeur qu'il pose vient soit de l'API, soit de la table de COULEURS de
 * la maquette — laquelle est du dessin, donc reste ici.
 *
 * ── CE QUE L'API NE PEUT PAS REMPLIR, ET QU'ON NE FABRIQUE PAS ──────────────
 *
 * · ⚠ `missing` (« Recherché sans résultat ce mois-ci ») N'EST PLUS DE CETTE
 *   LISTE. Cette ligne disait qu'aucune route n'exposait les recherches
 *   infructueuses : `GET /search/zero-results` le fait depuis ce lot, et c'est
 *   `use-guides-manquants.ts` qui le lit — pas ce fichier, parce que la route
 *   appartient au module de recherche et non à celui des guides ;
 * · les options des trois filtres `Catégorie / Pays / Ville` — `GET /guides` les
 *   accepte, mais la maquette ne dessine aucune liste d'options ;
 * · le NOM d'un contributeur — le cadre ne dessine que sa pastille d'initiales.
 *
 * On n'invente aucune de ces valeurs : une affordance remplie d'une donnée
 * fabriquée ne se voit défaillante qu'au clic.
 */
import {
  GUIDE_OUTDATED_FLAG_THRESHOLD,
  GUIDE_UNPUBLISH_DELAY_DAYS,
  type GuideDetailResponse,
  type GuideListItemView,
  type GuideListResponse,
  type GuideOutdatedFlagsResponse,
  type GuideProposalView,
  type GuideVersionsResponse,
} from '@app/shared';
import type { GuideCardView } from '../a03/data';
import type {
  ContributorView,
  GuidePlanPageView,
  GuideHeadView,
  VersionRowView,
} from '../a04/data';
import type {
  PropositionEnTeteDonnees,
  PropositionsCompteView,
  SignalementRowView,
  SignalementsView,
} from '../a06/data';
import type { GuideLiableView } from '../a01g/data';

/**
 * Les prises du cadre, PLUS ce dont la page a besoin pour agir.
 *
 * Le JSX transcodé ne lit que `GuideCardView` ; `guideId` et `slug` ne sont
 * jamais dessinés. Ils voyagent pourtant avec la carte parce que la page en a
 * besoin pour ouvrir le guide ou voter — et les transporter à côté, dans un
 * second tableau indexé par rang, se désynchroniserait au premier filtre appliqué.
 *
 * Les déclarer explicitement plutôt que de les laisser inférer a un effet qu'on
 * veut : le convertisseur est VÉRIFIÉ contre la prise du cadre. S'il cessait de
 * poser `updated`, `tsc` le dirait ici plutôt que de laisser un `undefined`
 * traverser le JSX jusqu'à une carte sans date.
 */
export interface GuideCarte extends GuideCardView {
  readonly guideId: string;
  readonly slug: string;
  /**
   * L'adresse de la carte — `/guides/:slug` — OBLIGATOIRE ici alors qu'elle est
   * facultative sur `GuideCardView`. C'est voulu : les trois cartes de la maquette
   * n'ont pas de slug et n'en auront pas (voir la note de `GuideCardView.href`),
   * mais un guide venu de l'API en a toujours un, donc `tsc` doit refuser un
   * convertisseur qui cesserait de poser l'adresse.
   */
  readonly href: string;
}

export interface ContributeurPastille extends ContributorView {
  readonly handle: string;
}

export interface VersionLigne extends VersionRowView {
  readonly versionId: string;
  readonly isCurrent: boolean;
}

// ─── Identité visuelle d'un membre ──────────────────────────────────────────

/** La palette d'avatars de la maquette, dans son ordre. Aucune teinte ajoutée. */
const AVATAR_COLORS = ['#0F5C48', '#16785E', '#B4581F', '#2FA37D', '#E0733A'] as const;

/**
 * Les initiales, comme la maquette les dessine : une ou deux lettres majuscules.
 *
 * `Array.from` et non `split('')` : un prénom comme « Émile » commence par un
 * caractère qui tient sur deux unités de code dans certaines compositions, et
 * `split('')` le couperait en deux moitiés invalides.
 */
export function initials(displayName: string): string {
  const mots = displayName
    .trim()
    .split(/\s+/)
    .filter((m) => m.length > 0);
  if (mots.length === 0) return '·';
  const lettre = (m: string): string => (Array.from(m)[0] ?? '').toLocaleUpperCase('fr-FR');
  return mots.length === 1
    ? lettre(mots[0] as string)
    : `${lettre(mots[0] as string)}${lettre(mots[1] as string)}`;
}

/**
 * Couleur STABLE dérivée du handle : le même membre garde la sienne partout.
 *
 * Stable importe : une couleur tirée au hasard changerait à chaque rendu, et le
 * même auteur serait de deux couleurs entre la liste et la fiche du guide.
 */
export function avatarColor(handle: string): string {
  let somme = 0;
  for (const c of handle) somme = (somme + c.codePointAt(0)!) % 9973;
  return AVATAR_COLORS[somme % AVATAR_COLORS.length] as string;
}

// ─── Libellés ───────────────────────────────────────────────────────────────

/**
 * Les six catégories de §2.1, en français.
 *
 * Cette table est du LIBELLÉ D'INTERFACE, pas de la règle : l'API renvoie
 * l'énumération brute (`HOUSING`), et rien dans 05 §4 ne donne de libellé
 * traduit — contrairement au fil, dont les réponses portent `typeLabel`. C'est
 * une différence réelle entre les deux modules, et elle est remontée : tant
 * qu'elle dure, la traduction vit ici.
 *
 * AUCUNE de ces étiquettes ne contient « certifié » ni un dérivé. C'est une RÈGLE
 * DURE (§2.1) : le mot est interdit dans les titres ET dans les libellés
 * d'interface, parce que la plateforme ne vérifie aucun dossier administratif.
 */
export const CATEGORY_LABEL: Readonly<Record<string, string>> = {
  PRE_DEPARTURE: 'Avant le départ',
  ARRIVAL: 'Arrivée',
  HOUSING: 'Logement',
  DAILY_LIFE: 'Vie quotidienne',
  WORK_STUDIES: 'Travail et études',
  SCAM_ALERTS: 'Alertes arnaques',
};

/**
 * La portée, telle que la maquette l'écrit : « Universel », ou le NOM DU PAYS.
 *
 * La maquette met « Bénin » et non « Pays » sur son troisième guide. On suit ce
 * choix — dire de quel pays il s'agit vaut mieux que dire qu'il y en a un — et on
 * retombe sur « Pays » si le pays manque, ce qui ne devrait pas arriver
 * (`guides_country_scope` l'impose en base) mais qui n'a pas à produire un vide.
 */
function scopeLabel(g: GuideListItemView): string {
  if (g.scope === 'UNIVERSAL') return 'Universel';
  return g.country?.nameFr ?? 'Pays';
}

const MOIS = [
  'janv.',
  'févr.',
  'mars',
  'avril',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
] as const;

/**
 * « Mis à jour le 12 mars », et « le 3 oct. 2025 » quand l'année n'est pas
 * l'année courante — c'est exactement ce que la maquette écrit sur ses trois
 * cartes, et ce n'est pas une coquetterie : l'année sur une date récente est du
 * bruit, son absence sur une date ancienne est une erreur de lecture.
 *
 * RÈGLE DURE (§9, T1 §6) : cette date est sur CHAQUE carte, « aussi visible que
 * le titre ». Elle n'est jamais omise, quelle que soit sa valeur.
 *
 * Le fuseau est celui du NAVIGATEUR : la date affichée est celle que le membre
 * lirait sur son propre calendrier.
 */
export function updatedLabel(iso: string, now: Date = new Date()): string {
  return `Mis à jour le ${dateCourte(iso, now)}`;
}

/**
 * « 12 mars », « 3 oct. 2025 » — LA DATE SEULE, SANS SON VERBE.
 *
 * EXTRAITE D'`updatedLabel` ET NON RECOMPOSÉE À CÔTÉ, et c'est la seule raison de
 * cette fonction : l'échéance de dépublication a besoin de la MÊME forme de date
 * (voir `texteBandeau`), et une seconde composition aurait fini par écrire
 * « 9 novembre » là où les cartes écrivent « 9 nov. » — le mois abrégé, l'année
 * tue quand elle est celle qu'on vit. `updatedLabel` garde exactement son
 * résultat : elle lui ajoute son préfixe, c'est tout.
 */
function dateCourte(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const mois = MOIS[d.getMonth()] ?? '';
  const annee = d.getFullYear() === now.getFullYear() ? '' : ` ${d.getFullYear()}`;
  return `${d.getDate()} ${mois}${annee}`;
}

// ─── A03 · la liste ─────────────────────────────────────────────────────────

/**
 * Une carte de guide, prête pour le JSX transcodé.
 *
 * `verify` vient du BANDEAU que le serveur calcule, jamais d'un âge recalculé
 * ici. Le seuil de 24 mois est une règle métier (§2.3) ; le front qui le
 * recomposerait afficherait un jour un bandeau que le serveur ne pose plus, ou
 * l'inverse. `meta.staleAfterMonths` voyage d'ailleurs AVEC la liste pour cette
 * raison même.
 *
 * `OUTDATED_REPORTED` compte aussi : un guide `FLAGGED` porte « des membres
 * signalent que l'information a changé », qui est le texte exact du bandeau
 * dessiné. La maquette n'en dessine qu'un, on n'en invente pas un second.
 *
 * `useful` est `helpfulCount` — un compteur de VOTES d'utilité. Jamais de vues :
 * `guides.view_count` existe en base, et la règle dure `00` §49 interdit qu'il
 * sorte. Le schéma `.strict()` de `@app/shared` le refuse à la frontière, donc
 * il ne peut même pas arriver jusqu'ici.
 */
export function guideCardFrom(g: GuideListItemView, now: Date = new Date()): GuideCarte {
  const auteur = g.author;
  return {
    title: g.title,
    updated: updatedLabel(g.lastContentUpdateAt, now),
    cat: CATEGORY_LABEL[g.category] ?? g.category,
    scope: scopeLabel(g),
    /** §8 — un guide anonymisé garde son contenu et perd son auteur. */
    author: auteur === null ? 'Auteur anonymisé' : auteur.displayName,
    /**
     * ⚠ PAS DE PHOTO ICI, ET CE N'EST PAS UN OUBLI : L'API NE LA SERT PAS.
     *
     * Le porteur a demandé que la photo du membre s'applique partout, et elle le
     * fait maintenant sur le fil, les stories, les commentaires d'une
     * publication, la messagerie, l'entraide, les services, l'agenda et le
     * compte. Le module Guides est le dernier, et il est bloqué EN AMONT : son
     * auteur arrive en `{ handle, displayName, verificationLevel }`, sans
     * `avatarUrl`. Même chose pour ses contributeurs et ses proposants.
     *
     * Le réparer demande d'élargir les schémas de `guides` côté serveur, ce qui
     * dépasse ce lot. REMONTÉ au porteur.
     *
     * §8 : un guide anonymisé n'a PAS d'auteur — ni photo, ni initiales.
     */
    i: auteur === null ? '·' : initials(auteur.displayName),
    bg: auteur === null ? '#8A958F' : avatarColor(auteur.handle),
    useful: g.helpfulCount,
    verify: g.banners.some((b) => b.kind === 'TO_VERIFY' || b.kind === 'OUTDATED_REPORTED'),
    /**
     * L'accroche. L'API ne renvoie PAS d'extrait sur une carte de liste — le
     * corps vit dans `guide_versions` et la liste ne le charge pas, à raison.
     * On écrit donc ce que la carte sait dire : la catégorie et la portée, sous
     * forme de phrase. Inventer un extrait en tronquant un corps qu'on n'a pas
     * demanderait de charger tous les corps pour en afficher trois lignes.
     * Remonté : §5 attend une accroche sur la carte.
     */
    /**
     * ╔══════════════════════════════════════════════════════════════════════╗
     * ║ LE TOTAL DES COMMENTAIRES ET LE NOMBRE DE PAGES SONT DANS CETTE PHRASE ║
     * ╚══════════════════════════════════════════════════════════════════════╝
     *
     * Le porteur : « c'est LE TOTAL qui est affiché sur la page de listing des
     * guides ».
     *
     * ⚠ LA MAQUETTE N'OFFRE AUCUNE PRISE DÉDIÉE, et il faut le dire plutôt que
     * d'ajouter du dessin. Relevé sur les octets de la carte de A03 (ligne 613-615)
     * : son pied ne porte QUE l'auteur et « N ont trouvé utile » ; il n'y a ni
     * compteur de commentaires, ni compteur de pages, ni place pour l'un des deux.
     * En dessiner un serait décider de la carte à la place du designer. REMONTÉ :
     * il manque à la carte de A03 une ligne de compteurs.
     *
     * CE QU'ON EMPLOIE À LA PLACE EST LA SEULE PRISE DE CETTE CARTE QUE LE FRONT
     * COMPOSE DÉJÀ : `excerpt`. L'API ne rend pas d'accroche (voir juste au-dessus),
     * et cette ligne est depuis le début une PHRASE écrite ici — « Logement ·
     * Universel ». On l'allonge de ce que le porteur demande, avec le même
     * séparateur, au lieu d'inventer un emplacement.
     *
     * LES DEUX NOMBRES VIENNENT DU SERVEUR et ne sont pas recalculés :
     * `pageCount` est le nombre de pages vivantes, `commentCount` est LE TOTAL du
     * guide toutes pages confondues (`guideListItemSchema` le dit, avec sa raison).
     * Ils sont donc différents de ceux de la page de lecture, qui compte la PAGE
     * LUE — et c'est juste des deux côtés.
     *
     * ILS DISPARAISSENT QUAND ILS NE DISENT RIEN : un guide d'une seule page
     * n'annonce pas « 1 page », et un guide sans commentaire n'annonce pas
     * « 0 commentaire » — ce serait occuper la place d'une information absente,
     * exactement ce que `EN_TETE_AVANT_REPONSE` corrige sur A04.
     */
    excerpt: [
      CATEGORY_LABEL[g.category] ?? g.category,
      scopeLabel(g),
      ...(g.pageCount > 1 ? [`${String(g.pageCount)} pages`] : []),
      ...(g.commentCount > 0
        ? [`${String(g.commentCount)} commentaire${g.commentCount > 1 ? 's' : ''}`]
        : []),
    ].join(' · '),
    guideId: g.id,
    slug: g.slug,
    /**
     * L'adresse du guide, composée du SLUG QUE LE SERVEUR REND et de la route que
     * `app/(app)/guides/[slug]/` sert. Rien n'est déduit du titre : deux guides
     * peuvent porter le même titre, et c'est le slug qui les distingue.
     */
    href: `/guides/${g.slug}`,
  };
}

export function guideCardsFrom(
  page: GuideListResponse,
  now: Date = new Date(),
): readonly GuideCarte[] {
  return page.items.map((g) => guideCardFrom(g, now));
}

// ─── A04 · la lecture ───────────────────────────────────────────────────────

/**
 * Les pastilles de contributeurs. L'API les rend triés par nombre de
 * contributions acceptées ; on garde cet ordre, qui est celui du mérite.
 */
/**
 * L'EN-TÊTE DU GUIDE : titre, catégorie, portée, date, bandeau et trois compteurs.
 *
 * `propositionsEnAttente` est passé À PART et non lu du détail, parce que le détail
 * ne le porte pas : les propositions viennent de `GET /guides/:id/proposals`, une
 * SECONDE requête que `useGuide` lance après le détail (elle prend l'identifiant,
 * que seule la première donne). Le compter ici à partir de rien aurait produit un
 * zéro qui ressemble à une donnée.
 *
 * `updated` passe par `updatedLabel`, le MÊME convertisseur que les cartes de A03 :
 * deux formats de date pour la même donnée finiraient par se contredire, et cette
 * date est une RÈGLE DURE (§9, T1 §6) — « aussi visible que le titre ».
 */
export function guideHeadFrom(
  detail: GuideDetailResponse,
  propositionsEnAttente: number,
  now: Date = new Date(),
): GuideHeadView {
  const g = detail.guide;
  return {
    title: g.title,
    cat: CATEGORY_LABEL[g.category] ?? g.category,
    scope: scopeLabel(g),
    updated: updatedLabel(g.lastContentUpdateAt, now),
    /**
     * ╔══════════════════════════════════════════════════════════════════════╗
     * ║ LE BANDEAU VIENT DE `banners`, PAS D'UNE CONDITION RECOMPOSÉE        ║
     * ╚══════════════════════════════════════════════════════════════════════╝
     *
     * Le porteur : « Lier le bandeau du guide aux banners du serveur. »
     *
     * `community` LISAIT `g.maintainedByCommunity` — le même booléen que le
     * serveur emploie pour POSER `COMMUNITY_MAINTAINED`. Le résultat était juste
     * par coïncidence, et il l'aurait cessé au premier changement de §2.3 : le
     * front refaisait la condition au lieu de lire la décision. C'est exactement
     * ce que l'en-tête de `guideCardFrom` interdit vingt lignes plus haut pour
     * `verify`, et pour la même raison — « deux implémentations de la même règle
     * divergent toujours ».
     *
     * LA LISTE ET LE DÉTAIL LISENT MAINTENANT LA MÊME SOURCE : `g.banners`.
     *
     * ── UN SEUL BANDEAU, ET C'EST LE SERVEUR QUI DIT LEQUEL ────────────────
     *
     * `bannersFor()` les empile dans CET ordre : `TO_VERIFY`,
     * `OUTDATED_REPORTED`, `COMMUNITY_MAINTAINED`. On prend LE PREMIER, et c'est
     * tout l'arbitrage — on ne classe rien ici, on lit l'ordre du serveur.
     *
     * Deux raisons de n'en montrer qu'un, et la seconde est la plus forte :
     *
     *   · LA MAQUETTE N'EN DESSINE JAMAIS DEUX. Le cadre de A04 porte une bande,
     *     la carte de A03 porte une bande sous un `<sc-if>` unique. Empiler deux
     *     bandes serait un dessin que personne n'a dessiné ;
     *   · UN AVERTISSEMENT PASSE AVANT UN CONFORT. Un guide à la fois signalé et
     *     maintenu par la communauté doit d'abord dire au lecteur de se méfier.
     *     Afficher « Maintenu par la communauté » sur un contenu périmé est pire
     *     que de ne rien afficher : ça affirme une surveillance.
     *
     * L'ordre du serveur donne déjà ce résultat, donc il n'y a pas de second
     * classement à tenir. Si `bannersFor()` changeait son ordre, cet écran
     * suivrait — ce qui est le comportement voulu.
     */
    community: premierBandeau(g.banners)?.kind === 'COMMUNITY_MAINTAINED',
    avertissement: estAvertissement(premierBandeau(g.banners)),
    /**
     * L'ÉCHÉANCE DE DÉPUBLICATION S'Y AJOUTE — voir `phraseEcheance`. Elle passe
     * par le TEXTE du bandeau et non par un dessin neuf : la bande ambre existe
     * déjà sur les quatre cadres de A04, avec sa paire ocre et sa géométrie
     * relevée cadre par cadre. Une seconde ligne aurait demandé une maquette que
     * personne n'a dessinée.
     *
     * ⚠ `g.isAuthor` EST LU ICI, ET CE N'EST PAS UNE AUTORISATION. La phrase de
     * l'échéance DÉPASSÉE n'est pas la même selon qui lit (voir `phraseEcheance`),
     * et le serveur recalcule ce booléen à chaque requête — `guide-screen.tsx` s'en
     * sert déjà pour choisir la vue AUTEUR. On le lit de la même réponse plutôt que
     * de le passer en paramètre : un appelant qui l'oublierait écrirait la phrase du
     * lecteur à l'auteur, c'est-à-dire précisément le défaut qu'on corrige.
     */
    avertissementTexte: texteBandeau(
      premierBandeau(g.banners),
      g.unpublishDeadlineAt,
      now,
      g.isAuthor,
    ),
    useful: g.helpfulCount,
    contributorCount: detail.contributors.length,
    proposals: propositionsEnAttente,
    /**
     * ╔══════════════════════════════════════════════════════════════════════╗
     * ║ LE COMPTE DES SIGNALEMENTS « A CHANGÉ » — LE NOMBRE, ET RIEN DE PLUS ║
     * ╚══════════════════════════════════════════════════════════════════════╝
     *
     * ARBITRAGE DU PORTEUR, mot pour mot : « Les signalants resteront anonymes :
     * l'auteur ne voit que le compte. Pas des commentaires et autres. »
     *
     * MESURÉ avant ce lot : la carte d'auteur de 1 440 px écrivait un `0` PEINT EN
     * DUR dans une rangée `<a href="#">` qui ne menait nulle part, et le cadre de
     * 390 px ne portait ce compte NULLE PART. `outdatedFlagCount` était dans
     * `guideDetailResponseSchema` depuis le début.
     *
     * `signalementsMot` PORTE L'ACCORD, et il est une donnée parce que le mot
     * change : « 1 signalement », « 3 signalements ». La planche mobile bolde le
     * NOMBRE seul et laisse le mot en encre normale (voir la rangée des deux
     * compteurs de sa barre basse) ; une seule prise portant « 3 signalements »
     * aurait mis le mot en gras avec le nombre, ce que le dessin ne fait pas.
     */
    signalements: g.outdatedFlagCount,
    signalementsMot: g.outdatedFlagCount === 1 ? 'signalement' : 'signalements',
    /**
     * L'ADRESSE DE L'ÉDITEUR, composée du SLUG QUE LE SERVEUR VIENT DE RENDRE et
     * non de celui de l'URL courante : les deux coïncident, mais c'est la réponse
     * qui fait foi — §2.1 fige le slug à la publication, et un jour où l'API
     * redirigerait un ancien slug vers le nouveau, c'est le nouveau qu'il faut
     * suivre. `encodeURIComponent` parce qu'un slug est du texte, pas une
     * promesse.
     */
    hrefModifier: `/guides/${encodeURIComponent(g.slug)}/modifier`,
    /**
     * LA PAGE DES SIGNALEMENTS, à côté de `modifier` et de `propositions` —
     * `/guides/:slug/signalements`, par le SLUG comme les deux autres (§2.1 le
     * fige à la publication, précisément pour que l'adresse reste bonne).
     */
    hrefSignalements: `/guides/${encodeURIComponent(g.slug)}/signalements`,
    /**
     * LA PAGE DES PROPOSITIONS REÇUES, la troisième page fille du guide.
     *
     * MESURÉ : elle existait depuis plusieurs lots et les deux affordances qui
     * devaient y mener étaient mortes — `<a href="#">` dans la carte d'auteur de
     * 1 440 px, `<button>` sans geste dans la barre basse de 390 px. Voir
     * `A04_PROPOSITIONS` et `hrefPropositions` dans `a04/data.ts`.
     */
    hrefPropositions: `/guides/${encodeURIComponent(g.slug)}/propositions`,
    /**
     * ╔══════════════════════════════════════════════════════════════════════╗
     * ║ LE LIBELLÉ DE LA BASCULE « MAINTENU PAR LA COMMUNAUTÉ »              ║
     * ╚══════════════════════════════════════════════════════════════════════╝
     *
     * §2.5 : « Réversible si l'auteur revient et le demande. » La rangée dit donc
     * ce qu'elle FERA, et c'est `g.maintainedByCommunity` qui tranche — l'état du
     * guide tel que le serveur le rend, jamais une bascule locale.
     *
     * ⚠ IL LIT LE BOOLÉEN, ET NON LE BANDEAU. `community` juste au-dessus veut
     * dire « c'est le bandeau VERT qu'il faut dessiner », et ce n'est pas la même
     * question : un guide maintenu par la communauté ET périmé affiche
     * l'avertissement ambre, donc `community` y est FAUX alors que le guide EST
     * ouvert. Un libellé calé sur `community` aurait alors proposé « Ouvrir » un
     * guide déjà ouvert. Mesuré en lisant `bannersFor`, pas supposé.
     *
     * ⚠ « REPRENDRE LA MAIN » N'EST DANS AUCUNE MAQUETTE. La planche ne dessine
     * que le sens « Ouvrir à la communauté », et la phrase de §2.5 — « réversible
     * si l'auteur revient et le demande » — n'est pas un libellé de bouton. Le mot
     * retenu reprend la métaphore que la spécification emploie (« l'auteur
     * revient »), comme « Retirer mon signalement » reprenait le résumé de sa
     * route. REMONTÉ au porteur.
     */
    communauteLabel: g.maintainedByCommunity
      ? 'Reprendre la main'
      : 'Ouvrir à la communauté',
    /**
     * ⚠ LE GESTE EST UN REPLI, ET IL NE DOIT RIEN FAIRE. Ouvrir un guide à la
     * communauté demande une CONFIRMATION (§2.4 ligne 52 : l'auteur renonce à
     * valider les corrections de son propre guide), donc un état de fenêtre qui
     * vit dans la page. `guide-screen.tsx` le remplace ; c'est le même partage que
     * `guidePlanFrom`, qui ne porte pas ses gestes non plus.
     */
    onCommunaute: () => undefined,
    /**
     * ── LES TROIS PHRASES QUE LA PLANCHE ÉCRIVAIT EN DUR ──────────────────
     *
     * « 84 membres ont trouvé utile », « Marc Koudou et 3 contributeurs »,
     * « 14 COMMENTAIRES » : les trois sont composées ici, de ce que
     * `GET /guides/:slug` rend.
     *
     * ── CE QUE CE BLOC DISAIT, ET QUI N'EST PLUS VRAI ─────────────────────
     *
     * Il disait : « ⚠ LE COMPTE DES COMMENTAIRES N'A PAS DE SOURCE sur cette
     * route : `guideDetailResponseSchema` ne le porte pas […] La ligne dit donc
     * "COMMENTAIRES" sans nombre plutôt que d'en inventer un — le manque se voit,
     * et il est REMONTÉ. » Le manque est comblé : `guide.commentCount` est dans le
     * schéma, et il compte CE QUE LA LISTE AFFICHE — même critère de visibilité
     * que le fil (`commentVisibilityWhere`), donc jamais « 12 commentaires »
     * au-dessus d'un fil qui en montre neuf.
     */
    utiles: phraseUtiles(g.helpfulCount),
    contributeurs: phraseContributeurs(detail.contributors, false),
    contributeursCourt: phraseContributeurs(detail.contributors, true),
    /**
     * ╔══════════════════════════════════════════════════════════════════════╗
     * ║ LA LIGNE DES CONTRIBUTEURS N'EXISTE QUE S'IL Y EN A                  ║
     * ╚══════════════════════════════════════════════════════════════════════╝
     *
     * Le porteur, capture à l'appui : sous le titre d'un guide fraîchement publié
     * s'affichait un tiret cadratin « — » seul, sans avatars. C'est le repli de
     * `phraseContributeurs(…, court = true)` ; la planche d'ordinateur avait le
     * même défaut sous une autre forme, « Aucun contributeur ».
     *
     * CE QUI EST CALCULÉ ICI, ET PAS DANS LE CADRE : la condition est
     * `contributors.length > 0`, c'est-à-dire exactement ce que les deux phrases
     * testent pour choisir leur repli. L'écrire au même endroit qu'elles est la
     * seule façon qu'elles ne se contredisent jamais — un cadre qui déciderait
     * tout seul afficherait une rangée vide le jour où la règle de la phrase
     * changerait.
     *
     * ⚠ C'EST LA LISTE, PAS LE COMPTEUR. `g.contributorCount` est le nombre que
     * la carte « VOUS ÊTES L'AUTEUR » écrit, et il peut être non nul alors que la
     * liste est vide (elle est tronquée par le dessin, voir `contributorCount`).
     * La ligne dessine LA LISTE : c'est elle qui décide si on a quelque chose à
     * montrer.
     */
    aContributeurs: detail.contributors.length > 0,
    commentaires: phraseCommentaires(g.commentCount),
    /**
     * L'AUTEUR, ABRÉGÉ. Celui de la VERSION COURANTE d'abord — c'est la personne
     * qui a écrit le corps affiché, donc celle dont le nom est le plus juste sous
     * une image de ce corps — puis celui du guide, puis `null`.
     */
    auteurCourt:
      detail.currentVersion?.createdBy?.displayName !== undefined
        ? abrege(detail.currentVersion.createdBy.displayName)
        : g.author === null
          ? null
          : abrege(g.author.displayName),
  };
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES TROIS BANDEAUX DU SERVEUR, ET CE QUE LA MAQUETTE ÉCRIT POUR CHACUN     ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * `premierBandeau` ne classe rien : il prend le PREMIER de la pile que
 * `bannersFor()` a construite. L'ordre est une décision du serveur
 * (`TO_VERIFY`, `OUTDATED_REPORTED`, `COMMUNITY_MAINTAINED`) et la recopier ici
 * serait la dédoubler. Voir `guideHeadFrom`, qui écrit pourquoi un seul
 * s'affiche.
 */
function premierBandeau(
  banners: GuideListItemView['banners'],
): GuideListItemView['banners'][number] | undefined {
  return banners[0];
}

/** Les deux bandeaux AMBRE. `COMMUNITY_MAINTAINED` est vert, et il n'avertit pas. */
function estAvertissement(bandeau: GuideListItemView['banners'][number] | undefined): boolean {
  return bandeau?.kind === 'TO_VERIFY' || bandeau?.kind === 'OUTDATED_REPORTED';
}

/**
 * LE TEXTE DU BANDEAU AMBRE — RECOPIÉ DE LA MAQUETTE, PAS RÉDIGÉ.
 *
 * ── OÙ CES DEUX PHRASES SONT DESSINÉES ──────────────────────────────────────
 *
 * `docs/template/03 Accueil v2.dc.html`, lignes 740-741, la rangée de
 * spécification des bandeaux : « Bandeau · À vérifier » et « Bandeau · Des
 * membres signalent que cette information a changé », toutes deux en #8A5A0B sur
 * #FDF1D8.
 *
 * LE PRÉFIXE « Bandeau · » EST RETIRÉ, et ce n'est pas une réécriture : c'est le
 * NOM que la rangée de spécification donne à chaque pastille. La preuve est dans
 * la rangée elle-même — sa troisième pastille dit « Bandeau · Maintenu par la
 * communauté » alors que le cadre de A04 dessine « Maintenu par la communauté »
 * tout court. Le même texte, avec et sans le préfixe, selon qu'il est légendé ou
 * rendu. Le préfixe est donc de la légende, démontré et non supposé.
 *
 * ── CE QU'ON N'A PAS RETENU, ET POURQUOI ────────────────────────────────────
 *
 * La CARTE DE LISTE de A03 (ligne 611) FUSIONNE les deux en une phrase :
 * « À vérifier — des membres signalent que l'information a changé ». On ne la
 * reprend PAS ici, et la raison est factuelle : `TO_VERIFY` se déclenche sur
 * l'ÂGE du contenu (plus de `GUIDE_STALE_MONTHS` sans modification), sans que
 * personne n'ait rien signalé. Écrire « des membres signalent » sur un guide
 * simplement immobile serait AFFIRMER UN SIGNALEMENT QUI N'EXISTE PAS.
 *
 * La carte de A03, elle, a raison de fusionner : elle ne reçoit qu'un booléen
 * (`verify`, qui est `TO_VERIFY || OUTDATED_REPORTED`) et ne peut donc pas
 * distinguer. A04 reçoit `banners` en entier, donc il peut être exact — et quand
 * on peut être exact, on l'est.
 *
 * ── `months` EST MAINTENANT AFFICHÉ, ET LA TOURNURE A UNE SOURCE ───────────
 *
 * Ce bloc disait : « AUCUNE MAQUETTE N'ÉCRIT CETTE FORME […] On n'invente donc
 * pas la tournure, et le nombre reste inemployé. REMONTÉ au porteur. » Le constat
 * tient toujours — cherché sur les dix fichiers de `docs/template/`, le mot
 * « mois » n'apparaît dans AUCUN bandeau, ni avec un nombre ni sans ; les seules
 * formes voisines sont des temps relatifs d'autres écrans (« il y a 1 mois »,
 * `04 Parcours`). C'est la CONCLUSION qui a changé : le porteur a tranché —
 * « fais le reste aussi » — donc la décision de rédaction est prise.
 *
 * LA PHRASE EST CELLE DU SCHÉMA DU DÉPÔT, PAS UNE RÉDACTION DE CE FICHIER.
 * `guideBannerSchema` (`packages/shared/src/validation/guides.ts`) l'écrit
 * lui-même en commentant `months` : « Seul `TO_VERIFY` la porte, parce que seul
 * lui l'affiche (*dernière mise à jour il y a N mois*). » C'est la seule source
 * INTERNE qui propose une tournure, et la prendre vaut mieux que d'en composer une
 * onzième — le dépôt a déjà payé des libellés qui existaient à deux endroits.
 *
 * ── TROIS DÉTAILS, ET AUCUN N'EST DU CONFORT ───────────────────────────────
 *
 *   · LE NOMBRE EST UNE DONNÉE, PAS DU DESSIN. Le nœud du bandeau garde sa paire
 *     ocre (`#FDF1D8` / `#8A5A0B`) et la géométrie relevée sur chaque cadre ;
 *     seule la phrase est liée. Rien n'est redessiné ;
 *   · LE SINGULIER EST ACCORDÉ, ET IL NE DEMANDE AUCUN `if` : « mois » est
 *     INVARIABLE en français — « il y a 1 mois », « il y a 26 mois », le même mot.
 *     C'est relevé plutôt que supposé, et c'est pourquoi aucune bascule de pluriel
 *     n'est écrite ici, contrairement à `phraseCommentaires` plus bas, dont le mot
 *     prend bien un `s`. Une bascule `mois === 1 ? 'mois' : 'mois'` aurait annoncé
 *     une règle qui n'existe pas ;
 *   · `months` ABSENT RETOMBE SUR « À vérifier » TOUT COURT. Le schéma le déclare
 *     `.optional()` et non `.nullable()` — relevé sur la charge — donc un
 *     `TO_VERIFY` sans nombre est une forme VALIDE du contrat. Écrire « il y a
 *     undefined mois » ou « il y a 0 mois » serait pire que de ne rien dire.
 *
 * `OUTDATED_REPORTED` GARDE SA PHRASE SANS NOMBRE : il n'en reçoit pas, et il n'en
 * veut pas — il parle de signalements, pas d'âge.
 *
 * ⚠ ON NE RECALCULE NI LE SEUIL NI LE NOMBRE. `months` est LU tel que le serveur
 * l'envoie ; le déduire de `lastContentUpdateAt` recomposerait côté écran une règle
 * métier (§2.3) que l'en-tête de `guideCardFrom` interdit vingt lignes plus haut,
 * pour la raison qui y est écrite — « deux implémentations de la même règle
 * divergent toujours ». La date de mise à jour reste par ailleurs affichée en
 * toutes lettres sous le titre, et c'est une RÈGLE DURE (§9, T1 §6).
 */
function texteBandeau(
  bandeau: GuideListItemView['banners'][number] | undefined,
  /**
   * L'ÉCHÉANCE QUE LE SERVEUR A POSÉE, en ISO, ou `null`. Elle n'est PAS
   * facultative dans cette signature : la rendre omissible aurait laissé un
   * appelant l'oublier, et c'est exactement ce qui vient d'arriver pendant un an
   * — le champ existait dans le contrat et personne ne le passait.
   */
  unpublishDeadlineAt: string | null,
  now: Date,
  /**
   * QUI LIT. `g.isAuthor`, recalculé par le serveur à chaque requête. Il ne change
   * QUE la phrase de l'échéance dépassée — voir `phraseEcheance` — et il n'est pas
   * facultatif, pour la raison écrite juste au-dessus pour `unpublishDeadlineAt`.
   * `now` a d'ailleurs perdu son défaut avec lui : un paramètre facultatif ne peut
   * pas précéder un obligatoire, et c'est le bon sens du refus — les deux valeurs
   * décident ensemble de la phrase, donc les deux se passent.
   */
  auteur: boolean,
): string {
  const echeance = phraseEcheance(unpublishDeadlineAt, now, auteur);
  if (bandeau?.kind === 'TO_VERIFY') {
    const mois = bandeau.months;
    if (mois === undefined) return `À vérifier${echeance}`;
    return `À vérifier — dernière mise à jour il y a ${String(mois)} mois${echeance}`;
  }
  if (bandeau?.kind === 'OUTDATED_REPORTED') {
    return `Des membres signalent que cette information a changé${echeance}`;
  }
  return '';
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ « À CORRIGER AVANT LE 9 NOV., PUIS DÉPUBLICATION » — ET PERSONNE NE LE VOYAIT ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * MESURÉ avant ce lot : `grep -rn unpublishDeadline apps/web/src` ne trouvait
 * RIEN. `guideDetailResponseSchema` rend `unpublishDeadlineAt` (date ou `null`)
 * depuis le début, le serveur la pose dès le troisième signalement
 * (`flagOutdated`), la tâche `guide.outdated_unpublish` la fait tomber à
 * l'échéance — et un auteur dont le guide sera dépublié dans trente jours n'en
 * était averti NULLE PART dans le produit.
 *
 * ── LA TOURNURE N'EST PAS RÉDIGÉE ICI, ELLE EST EMPRUNTÉE ──────────────────
 *
 * Même procédé que pour le nombre de mois de « À vérifier », vingt lignes plus
 * haut : la maquette ne dessine aucune échéance — cherché, le mot
 * « dépublication » n'apparaît dans AUCUN bandeau de `docs/template/` — donc on
 * prend la seule formulation que le dépôt porte déjà, au lieu d'en composer une
 * onzième :
 *
 *   · `packages/shared/src/validation/guides.ts` ligne 115, qui commente
 *     `GUIDE_UNPUBLISH_DELAY_DAYS` : « §2.6 — 30 jours pour corriger, puis
 *     dépublication. » C'est de là que viennent le verbe CORRIGER et le mot
 *     DÉPUBLICATION, dans cet ordre ;
 *   · `docs/specs/T5-pages-et-prompts.md` ligne 414, qui nomme l'onglet
 *     d'administration « Signalés obsolètes (délai avant dépublication) » — même
 *     vocabulaire, pour la même donnée.
 *
 * ── TROIS DÉCISIONS, ET CHACUNE A SA RAISON ───────────────────────────────
 *
 *   · ON NE RECALCULE AUCUN SEUIL. Ni les 3 signalements, ni les 30 jours : la
 *     DATE est lue telle que le serveur l'envoie. La déduire d'un compteur et
 *     d'un délai aurait été la seconde implémentation que `guideCardFrom`
 *     interdit vingt lignes plus haut ;
 *   · ELLE S'AJOUTE AU BANDEAU DÉJÀ AMBRE, QUEL QU'IL SOIT, et pas seulement à
 *     `OUTDATED_REPORTED`. C'est une conséquence de la règle « un seul bandeau » :
 *     `bannersFor()` empile `TO_VERIFY` AVANT `OUTDATED_REPORTED`, donc un guide à
 *     la fois immobile depuis deux ans ET signalé n'affiche que le premier — et
 *     accrocher l'échéance au second l'aurait fait disparaître précisément sur les
 *     guides les plus en danger. L'échéance est un FAIT du guide, pas une
 *     propriété d'un bandeau ;
 *   · UNE ÉCHÉANCE PASSÉE DIT MAINTENANT QUELQUE CHOSE, ET CE N'EST PAS LA MÊME
 *     PHRASE SELON QUI LIT. Voir le bloc ci-dessous : c'est le seul endroit de
 *     cette fonction qui a changé, et l'arbitrage est du porteur.
 *
 * `null` est le cas NORMAL et il ne dessine rien : la très grande majorité des
 * guides n'a jamais atteint le seuil.
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ L'ÉCHÉANCE DÉPASSÉE ÉTAIT MUETTE AU MOMENT LE PLUS UTILE                  ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * CE QUE CE BLOC DISAIT, ET QUI N'EST PLUS VRAI : « UNE ÉCHÉANCE PASSÉE NE DIT
 * RIEN […] On se taît alors plutôt que d'inventer une phrase (“délai dépassé”) que
 * rien dans le dépôt n'écrit pour ce bandeau. REMONTÉ au porteur : si cet état doit
 * se lire, c'est une phrase à arbitrer, pas à deviner. » LE PORTEUR A ARBITRÉ, et
 * les deux phrases ci-dessous sont les siennes, mot pour mot — elles ne sont donc
 * ni rédigées ici, ni devinées.
 *
 * MESURÉ : au passage de l'échéance, la clause disparaissait et le bandeau ne
 * disait plus que « Des membres signalent que cette information a changé ». Or
 * c'est l'instant le plus utile des trente jours : la tâche `guide.outdated_
 * unpublish` passe UNE FOIS PAR JOUR (planifiée dans la file), donc le retrait
 * n'est pas « bientôt », il est à quelques heures.
 *
 * ── DEUX LECTEURS, DEUX PHRASES, ET CE N'EST PAS UNE NUANCE ────────────────
 *
 *   · AU LECTEUR, un AVERTISSEMENT : « — délai de correction dépassé, ce guide va
 *     être retiré ». Il n'a rien à faire ; ce qu'il doit savoir, c'est que le
 *     contenu qu'il lit n'est plus tenu et qu'il va disparaître ;
 *   · À L'AUTEUR, une CONSIGNE : « — le délai est dépassé, corrigez maintenant pour
 *     éviter le retrait ». Lui PEUT encore agir — les deux boutons « Modifier » de
 *     sa vue y mènent — et lui servir la phrase du lecteur serait lui annoncer une
 *     fatalité alors qu'il tient le remède.
 *
 * ⚠ AUCUN SEUIL N'EST RECALCULÉ, et c'est la même discipline qu'au-dessus : on LIT
 * la date du serveur et on la compare à maintenant. Ni les 3 signalements, ni les
 * 30 jours, ni la période de la tâche n'apparaissent ici — les déduire aurait été
 * la seconde implémentation que `guideCardFrom` interdit.
 *
 * ⚠ CE QUE CES DEUX PHRASES NE PROMETTENT PAS : une HEURE. Le dépôt ne connaît pas
 * l'instant du prochain passage de la tâche, donc écrire « retiré demain » aurait
 * été une affirmation sans source. « Va être retiré » et « éviter le retrait »
 * disent l'imminence sans la dater.
 */
function phraseEcheance(
  unpublishDeadlineAt: string | null,
  now: Date,
  auteur: boolean,
): string {
  if (unpublishDeadlineAt === null) return '';
  if (new Date(unpublishDeadlineAt).getTime() <= now.getTime()) {
    return auteur
      ? ' — le délai est dépassé, corrigez maintenant pour éviter le retrait'
      : ' — délai de correction dépassé, ce guide va être retiré';
  }
  return ` — à corriger avant le ${dateCourte(unpublishDeadlineAt, now)}, puis dépublication`;
}

/**
 * « 14 COMMENTAIRES », « 1 COMMENTAIRE », « 0 COMMENTAIRE ».
 *
 * L'étiquette de la planche est en CAPITALES et porte son nombre — le singulier à
 * un, et le ZÉRO au singulier aussi, comme le français l'écrit (« 0 commentaire »).
 * La planche ne dessine pas la forme vide ; elle n'en a pas besoin, le nombre la
 * dit.
 *
 * EXPORTÉE DEPUIS QU'ON PEUT COMMENTER UN GUIDE. La page du guide doit recomposer
 * cette étiquette quand le membre vient d'envoyer un commentaire — `GET
 * /guides/:slug` ne sera pas rejoué, et laisser « 3 COMMENTAIRES » au-dessus d'un
 * fil qui en montre quatre serait, à l'écran, le mensonge exact que
 * `commentVisibilityWhere` existe pour empêcher côté serveur. Elle est exportée
 * plutôt que recopiée : deux façons d'écrire le même compteur finissent par
 * s'accorder le singulier différemment.
 */
export function phraseCommentaires(compte: number): string {
  return `${String(compte)} COMMENTAIRE${compte > 1 ? 'S' : ''}`;
}

/** « 84 membres ont trouvé utile », « 1 membre a trouvé utile », « Personne encore ». */
function phraseUtiles(compte: number): string {
  if (compte === 0) return 'Personne ne l’a encore marqué utile';
  if (compte === 1) return '1 membre a trouvé utile';
  return `${String(compte)} membres ont trouvé utile`;
}

/**
 * « Marc Koudou et 3 contributeurs », ou « Marc K. et 3 » sur le cadre mobile.
 *
 * LE PREMIER EST NOMMÉ, les autres sont comptés : c'est ce que la planche
 * dessine, et c'est aussi ce qui tient dans la ligne. Sans contributeur, la
 * phrase dit l'état plutôt que de laisser un vide.
 */
function phraseContributeurs(
  contributeurs: GuideDetailResponse['contributors'],
  court: boolean,
): string {
  const premier = contributeurs[0]?.user.displayName ?? null;
  if (premier === null) return court ? '—' : 'Aucun contributeur';
  const autres = contributeurs.length - 1;
  const nom = court ? nomCourtGuide(premier) : premier;
  if (autres <= 0) return nom;
  if (court) return `${nom} et ${String(autres)}`;
  return `${nom} et ${String(autres)} contributeur${autres > 1 ? 's' : ''}`;
}

/** « Marc Koudou » → « Marc K. », la forme courte que le cadre de 390 px écrit. */
function nomCourtGuide(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter((m) => m !== '');
  const prenom = mots[0] ?? nom;
  const initiale = mots[1]?.[0];
  return initiale === undefined ? prenom : `${prenom} ${initiale}.`;
}

export function contributorsFrom(detail: GuideDetailResponse): readonly ContributeurPastille[] {
  return detail.contributors.map((c) => ({
    /** Voir plus haut : l'API des guides ne sert pas `avatarUrl`. */
    i: initials(c.user.displayName),
    bg: avatarColor(c.user.handle),
    handle: c.user.handle,
  }));
}

/**
 * L'historique des versions (§2.7).
 *
 * `dot` marque la version COURANTE en vert et les autres en gris, et c'est
 * `meta.currentVersionId` qui tranche — JAMAIS « la première de la liste ». Les
 * versions sont triées par numéro décroissant, donc les deux coïncident presque
 * toujours ; mais un retour arrière crée une version PLUS RÉCENTE dont le corps
 * est ancien, et c'est elle la courante. « Presque toujours » est exactement ce
 * qui rend ce défaut invisible en développement.
 *
 * Le titre reprend le RÉSUMÉ quand il existe — « Version 6 — Délais mis à jour »,
 * comme la maquette — et se réduit au numéro sinon, ce qu'elle dessine aussi sur
 * sa « Version 4 ».
 */
export function versionsFrom(page: GuideVersionsResponse): readonly VersionLigne[] {
  const courante = page.meta.currentVersionId;
  return page.items.map((v) => {
    const d = new Date(v.createdAt);
    const auteur = v.createdBy === null ? 'anonymisé' : abrege(v.createdBy.displayName);
    return {
      t: v.summary === null ? `Version ${v.version}` : `Version ${v.version} — ${v.summary}`,
      s: `${d.getDate()} ${MOIS[d.getMonth()] ?? ''} · ${auteur}`,
      dot: v.id === courante ? '#16785E' : '#CBD5D1',
      versionId: v.id,
      isCurrent: v.id === courante,
    };
  });
}

/** « Marc Koudou » devient « Marc K. », comme la maquette l'écrit sous ses versions. */
function abrege(displayName: string): string {
  const mots = displayName.trim().split(/\s+/).filter((m) => m.length > 0);
  const premier = mots[0];
  if (premier === undefined) return '·';
  const second = mots[1];
  if (second === undefined) return premier;
  return `${premier} ${(Array.from(second)[0] ?? '').toLocaleUpperCase('fr-FR')}.`;
}

// ─── A04 · le plan des pages ────────────────────────────────────────────────

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LE TITRE DE LA CARTE DU PLAN — DU TEXTE DE PRODUIT, PAS DE MAQUETTE        ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * La carte est empruntée au panneau de section « COMMUNAUTÉ », dont le titre ne
 * convient évidemment pas. Le libellé vit ICI, avec les autres phrases du module
 * (`phraseCommentaires`, `phraseUtiles`) : le transcodeur pose du DESSIN, il
 * n'écrit pas d'interface.
 */
const PLAN_LIBELLE = 'PAGES DU GUIDE';

/**
 * LES DEUX TRACÉS DU PLAN, pris dans la maquette et jamais inventés — comme
 * `EDIT`, `FLAG` et `ALERT` de `a04/data.ts`.
 *
 * `PAGE` est la liste de lignes (`M4 6h16M7 12h10M5 18h14`, 2 occurrences dans
 * `03 Accueil v2`), `LUE` la coche (`m5 12 4.5 4.5L19 7`, 19 occurrences).
 *
 * ⚠ LE TRACÉ EST CE QUI DIT LA PAGE LUE AUTREMENT QUE PAR LA COULEUR, et c'est
 * indispensable sur la feuille de 390 px : la rangée empruntée au « menu de rôle »
 * ne dessine AUCUN fond de rangée, donc il n'y a rien à teindre là-bas.
 */
const TRACE_PAGE = 'M4 6h16M7 12h10M5 18h14';
const TRACE_PAGE_LUE = 'm5 12 4.5 4.5L19 7';

/**
 * LES TROIS TEINTES DE LA RANGÉE ACTIVE, qui sont celles de `panel(active)` —
 * la même carte, donc la même surbrillance. Rien n'est inventé ici.
 */
const PLAN_ACTIF = { bg: '#E3F0EB', fg: '#0F5C48', w: 700 } as const;
const PLAN_REPOS = { bg: 'transparent', fg: '#16211D', w: 500 } as const;

/**
 * L'ADRESSE D'UNE PAGE.
 *
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LA PREMIÈRE PAGE EST `/guides/:slug`, ET C'EST UNE GARANTIE, PAS UN CHOIX  ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * §2.1 fige le slug du guide « jamais modifié » pour que les liens déjà partagés
 * continuent de fonctionner, et le serveur rend la PREMIÈRE page quand `?page=` est
 * absent. Donner une adresse `/p/<slug>` à la première page aurait créé DEUX
 * adresses pour un même contenu, dont une seule circule — et un lien reçu avant
 * les pages aurait pointé vers l'autre.
 *
 * LE SEGMENT EST `/p/`, et il est choisi par élimination : `/guides/:slug/corriger`
 * et `/guides/:slug/propositions` existent déjà, donc une page qui s'appellerait
 * « corriger » volerait l'adresse du panneau de correction. Un segment d'un
 * caractère ne peut entrer en collision avec aucun slug, puisqu'il n'est pas
 * ambigu : `/p/` est une CLASSE d'adresse, pas un nom de page.
 */
export function hrefPageGuide(slugGuide: string, page: { readonly position: number; readonly slug: string }): string {
  const base = `/guides/${encodeURIComponent(slugGuide)}`;
  return page.position <= 1 ? base : `${base}/p/${encodeURIComponent(page.slug)}`;
}

/**
 * LE PLAN DU GUIDE, tel que les trois surfaces de A04 le rendent.
 *
 * ── CE QUE CE CONVERTISSEUR NE FAIT PAS ───────────────────────────────────
 *
 * Il ne porte AUCUN geste : `onChoisir`, `onPrecedent`, `onSuivant`, `onNom` et
 * `onFermerFeuille` demandent le routeur et l'état d'ouverture de la feuille, qui
 * vivent dans la page. Ce fichier rend donc les champs de DESSIN et les deux
 * booléens d'extrémité, et `guide-screen.tsx` y accroche les fonctions — le même
 * partage que `guideHeadFrom` et les actions.
 *
 * `visible` SUIT `pages.length > 1`, ce que le contrat annonce.
 */
export interface GuidePlanDonnees {
  readonly visible: boolean;
  readonly libelle: string;
  readonly titre: string;
  readonly pages: readonly Omit<GuidePlanPageView, 'onChoisir'>[];
  readonly aPrecedent: boolean;
  readonly aSuivant: boolean;
  /** `null` à la première page : il n'y a rien avant elle. */
  readonly hrefPrecedent: string | null;
  readonly hrefSuivant: string | null;
}

export function guidePlanFrom(detail: GuideDetailResponse): GuidePlanDonnees {
  const slug = detail.guide.slug;
  const lue = detail.currentPage.id;
  const rang = detail.pages.findIndex((page) => page.id === lue);
  const precedente = rang > 0 ? detail.pages[rang - 1] : undefined;
  const suivante = rang >= 0 ? detail.pages[rang + 1] : undefined;

  return {
    visible: detail.pages.length > 1,
    libelle: PLAN_LIBELLE,
    /**
     * ╔══════════════════════════════════════════════════════════════════════╗
     * ║ ENTRE LES DEUX CHEVRONS : LE NUMÉRO, PLUS LE TITRE                  ║
     * ╚══════════════════════════════════════════════════════════════════════╝
     *
     * Le porteur : « Au niveau du bouton prev et next des pages guide il faut
     * plutôt mettre le numéro de la page. »
     *
     * CE QUI ÉTAIT ÉCRIT LÀ, et pourquoi c'était un mauvais choix : le TITRE de
     * la page. Entre deux flèches, un titre ne répond pas à la question qu'on se
     * pose en les voyant — « où suis-je, et combien en reste-t-il ? ». Il la
     * masque même : le titre de la page lue est déjà le premier mot du corps
     * juste en dessous, donc la pastille répétait l'information d'à côté au lieu
     * d'apporter la seule qui manquait. Et un titre long déforme la rangée, là où
     * un numéro ne bouge jamais.
     *
     * ── « 2 sur 3 » ET NON « 2 », ET C'EST LA FORME DU DÉPÔT ──────────────
     *
     * Un numéro seul entre deux flèches dit où l'on est sans dire jusqu'où l'on
     * va : le lecteur ne sait pas s'il lui reste une page ou douze, et c'est
     * précisément ce qu'une pagination sert à dire. La tournure n'est pas
     * inventée — la Bibliothèque UI et `07 Agenda` écrivent déjà « N sur M »
     * (relevé : « 4 sur 8 », « 1 sur 1 »). On emprunte, comme pour le reste.
     *
     * ⚠ LE RANG, PAS `position`. `position` est la colonne de la base, et une
     * page retirée garde une place dans la numérotation (elle passe en négatif,
     * les autres sont renumérotées). Le dénominateur, lui, est `pages.length` —
     * les pages VISIBLES. Lire l'un et compter l'autre donnerait « 4 sur 3 » le
     * jour où les deux divergeraient. On compte donc les deux au même endroit.
     */
    titre: `${String(rang + 1)} sur ${String(detail.pages.length)}`,
    pages: detail.pages.map((page, index) => {
      const actif = page.id === lue;
      const teinte = actif ? PLAN_ACTIF : PLAN_REPOS;
      return {
        /**
         * LE NUMÉRO EN TÊTE DE RANGÉE — « c'est le numéro tu mets au début »
         * (porteur).
         *
         * Il est COMPOSÉ DANS LE LIBELLÉ plutôt qu'ajouté au dessin, et c'est
         * délibéré : la rangée est empruntée au panneau de section, et sa seule
         * prise de texte est `{{ m.label }}`. Y glisser une colonne de numéros
         * demanderait de modifier le nœud emprunté, donc de s'écarter de la
         * planche — pour un gain nul, le numéro se lisant aussi bien dans le
         * libellé.
         *
         * `index + 1` et non `page.position`, même raison qu'au-dessus : le
         * numéro affiché doit s'accorder avec le « sur N » de la rangée de
         * chevrons, et les deux se comptent donc sur la même liste.
         */
        label: `${String(index + 1)}. ${page.title}`,
        href: hrefPageGuide(slug, page),
        slug: page.slug,
        icon: actif ? TRACE_PAGE_LUE : TRACE_PAGE,
        /**
         * LA PASTILLE DISPARAÎT À ZÉRO : elle est sous `<sc-if>` dans la rangée
         * empruntée, et un rond orange vide n'apprendrait rien. `false` et non
         * `'0'` — c'est ce que la condition du cadre attend.
         */
        count: page.commentCount > 0 ? String(page.commentCount) : (false as const),
        bg: teinte.bg,
        fg: teinte.fg,
        w: teinte.w,
        actif,
      };
    }),
    aPrecedent: precedente !== undefined,
    aSuivant: suivante !== undefined,
    hrefPrecedent: precedente === undefined ? null : hrefPageGuide(slug, precedente),
    hrefSuivant: suivante === undefined ? null : hrefPageGuide(slug, suivante),
  };
}

/**
 * LE PLAN D'UN GUIDE QUI N'A PAS ENCORE RÉPONDU.
 *
 * Même raisonnement que `EN_TETE_AVANT_REPONSE` : la mise en page de la planche
 * reste, ses AFFIRMATIONS tombent. `visible: false` retire le panneau, la rangée
 * de chevrons et la feuille — avant la réponse on ne sait pas combien le guide a de
 * pages, et deux chevrons autour d'un titre vide ne seraient pas un espace
 * réservé, ce serait une navigation qui ne mène nulle part.
 */
export const PLAN_AVANT_REPONSE: GuidePlanDonnees = {
  visible: false,
  libelle: PLAN_LIBELLE,
  titre: '',
  pages: [],
  aPrecedent: false,
  aSuivant: false,
  hrefPrecedent: null,
  hrefSuivant: null,
};

// ─── A06 · les propositions ─────────────────────────────────────────────────

/**
 * Une proposition prête à afficher : l'avant/après de §2.4 et le délai restant
 * avant escalade.
 *
 * `PropositionVue` porte la proposition ENTIÈRE. Le cadre MOBILE de A06, lui, n'en
 * lit que l'EN-TÊTE — avatar, nom, délai, motif — servi par `propositionEnTeteDe`
 * plus bas. Ce commentaire affirmait qu'AUCUN cadre ne lisait ces valeurs : c'était
 * vrai avant que la planche mobile expose ses prises, et faux depuis.
 *
 * Ce qui reste sans preneur, et c'est dit là où ça se décide : `avant`, `apres` et
 * `source`. La maquette dessine un DIFF (mot barré, mots surlignés) là où l'API rend
 * deux chaînes nues — les lier ferait disparaître la différence, c'est-à-dire la
 * seule chose que ces blocs montrent. Il faut un composant de différence.
 */
export interface PropositionVue {
  readonly proposalId: string;
  readonly avant: string;
  readonly apres: string;
  readonly motif: string;
  readonly source: string | null;
  readonly proposant: string;
  readonly i: string;
  readonly bg: string;
  /** « 11 jours restants », ou « Délai dépassé » quand l'escalade est due. */
  readonly delai: string;
  readonly enAttente: boolean;
}

/**
 * Le délai avant escalade (§2.4 : `escalate_at = created_at + 14 jours`).
 *
 * Arrondi au jour SUPÉRIEUR : à onze jours et deux heures, il reste « 12 jours »
 * dans le langage courant, et un arrondi vers le bas ferait afficher « 0 jour »
 * pendant les vingt-trois dernières heures — c'est-à-dire un délai dépassé qui ne
 * l'est pas.
 *
 * Le calcul est fait ICI et non reçu du serveur parce que l'API renvoie
 * `escalateAt` en ISO et rien d'autre. C'est le seul calcul de date de ce fichier
 * qui porte une décision, d'où son test.
 */
export function delaiAvantEscalade(escalateAt: string, now: Date = new Date()): string {
  const restant = new Date(escalateAt).getTime() - now.getTime();
  if (restant <= 0) return 'Délai dépassé';
  const jours = Math.ceil(restant / 86_400_000);
  return `${jours} jour${jours > 1 ? 's' : ''} restant${jours > 1 ? 's' : ''}`;
}

export function propositionFrom(
  p: GuideProposalView,
  now: Date = new Date(),
): PropositionVue {
  return {
    proposalId: p.id,
    avant: p.targetExcerpt,
    apres: p.replacement,
    motif: p.reason,
    source: p.sourceUrl,
    proposant: p.proposer.displayName,
    /** Voir plus haut : l'API des guides ne sert pas `avatarUrl`. */
    i: initials(p.proposer.displayName),
    bg: avatarColor(p.proposer.handle),
    delai: delaiAvantEscalade(p.escalateAt, now),
    /** Seules `PENDING` et `ESCALATED` attendent encore une décision (§2.4). */
    enAttente: p.status === 'PENDING' || p.status === 'ESCALATED',
  };
}

// ─── A06 · l'en-tête d'une proposition, et les compteurs d'onglets ──────────
//
// `PropositionVue` ci-dessus porte la proposition ENTIÈRE — avant, après, motif,
// source. Les deux cartes de la planche mobile de A06, elles, ne lisent que son
// EN-TÊTE : l'avatar, le nom, le délai et le motif. D'où une seconde forme, et
// non un élargissement de la première : ce que le cadre lit est ce qu'on lui
// déclare.
//
// ── POURQUOI UN DÉLAI COURT, ET PAS CELUI DE `delaiAvantEscalade` ──────────
//
// La maquette écrit « 11 j » dans une pastille de quelques pixels, là où
// `delaiAvantEscalade` rend « 11 jours restants » pour la carte dépliée de la
// planche d'ordinateur. Ce sont DEUX dessins de la même donnée, et le nombre de
// jours est calculé UNE FOIS, par la fonction ci-dessous, que les deux appellent :
// deux arrondis indépendants finiraient par se contredire d'un jour.

/**
 * Le nombre de jours avant escalade, arrondi au jour SUPÉRIEUR (§2.4 :
 * `escalate_at = created_at + 14 jours`), ou `0` quand le délai est dépassé.
 *
 * L'arrondi vers le haut est la même décision que `delaiAvantEscalade` documente :
 * vers le bas, la pastille afficherait « 0 j » pendant les vingt-trois dernières
 * heures, c'est-à-dire un délai dépassé qui ne l'est pas.
 */
export function joursAvantEscalade(escalateAt: string, now: Date = new Date()): number {
  const restant = new Date(escalateAt).getTime() - now.getTime();
  if (restant <= 0) return 0;
  return Math.ceil(restant / 86_400_000);
}

/**
 * L'en-tête d'une proposition, dans la forme que les deux cartes de A06 lisent.
 *
 * « Dépassé » plutôt que « 0 j » quand l'escalade est due : la pastille dit alors
 * ce qui s'est passé, et non un nombre qui se lirait comme un délai restant.
 */
export function propositionEnTeteDe(
  p: GuideProposalView,
  now: Date = new Date(),
): PropositionEnTeteDonnees {
  const jours = joursAvantEscalade(p.escalateAt, now);
  return {
    i: initials(p.proposer.displayName),
    bg: avatarColor(p.proposer.handle),
    proposant: p.proposer.displayName,
    delai: jours === 0 ? 'Dépassé' : `${jours} j`,
    /**
     * LA MÊME DONNÉE, DANS LE MOT QUE L'ORDINATEUR DESSINE.
     *
     * Relevé sur les deux cadres : 1 440 px écrit « 11 jours restants » dans une
     * pastille large, 390 px abrège « 11 j » dans une pastille de quelques pixels.
     * Les deux formes sortent d'ICI, du même appel, parce que le CADRE n'a pas à
     * choisir un format — et parce que `delaiAvantEscalade` et `joursAvantEscalade`
     * appliquent le même arrondi aux mêmes entrées, donc les deux pastilles ne
     * peuvent pas se contredire d'un jour.
     *
     * ⚠ CE QUI A CHANGÉ : cette fonction rendait `PropositionEnTeteView`, c'est-à-
     * dire la forme que le CADRE lit, gestes compris. Elle rend maintenant
     * `PropositionEnTeteDonnees` — les six valeurs d'affichage — et c'est la page
     * qui ajoute les trois décisions, parce qu'elles demandent son état. Le
     * pourquoi au long est sur `PropositionEnTeteDonnees`.
     */
    delaiLong: delaiAvantEscalade(p.escalateAt, now),
    motif: p.reason,
  };
}

/**
 * Les compteurs des deux onglets chiffrés.
 *
 * Ils sont DÉRIVÉS de la liste par statut : `guideProposalsResponseSchema` ne
 * porte aucun `meta` de comptage — vérifié. « Refusées » n'a pas de compteur dans
 * la maquette, et on ne lui en invente pas un.
 *
 * ÉCART REMONTÉ : la liste est PAGINÉE (`nextCursor`). Ces deux nombres comptent
 * donc la PAGE reçue, pas le total — exactement le piège d'un compteur qui a l'air
 * global. Tant qu'aucun `meta` ne vient du serveur, c'est le seul compte honnête
 * que le front puisse faire, et il faut le savoir.
 */
export function propositionsCompteDe(
  items: readonly GuideProposalView[],
): PropositionsCompteView {
  return {
    attente: items.filter((p) => p.status === 'PENDING' || p.status === 'ESCALATED').length,
    acceptees: items.filter((p) => p.status === 'ACCEPTED' || p.status === 'AMENDED').length,
  };
}

// ─── A01G · les cartes de la fenêtre « Lier un guide » ──────────────────────
//
// La fenêtre dessine deux sections nommées : « SUGGÉRÉS POUR VOTRE PUBLICATION »
// et « RÉSULTATS ». UNE SEULE des deux a une source, et c'est la raison d'être du
// commentaire qui suit.
//
// ── « RÉSULTATS » : DE VRAIS GUIDES, SANS LA RECHERCHE ─────────────────────
//
// `GET /guides` rend les guides publiés, et ce sont eux que cette liste porte. Ce
// qui n'existe PAS, c'est la RECHERCHE TEXTE : `guideListQuerySchema` accepte
// `tab`, `category`, `countryId`, `cityId` et `cursor` — pas de `q`. Le champ
// « médecin » que la maquette dessine n'a donc aucune route à appeler, et il reste
// dessiné. Les résultats sont la liste non filtrée, dans l'ordre que l'API donne.
//
// ── « SUGGÉRÉS » : AUCUNE SOURCE, DONC AUCUNE CARTE ────────────────────────
//
// Rien dans 05 §4 ne rend des guides « suggérés pour cette publication ». La
// section arrive donc VIDE, et c'est un choix contre celui du lot repris, qui
// prévoyait de la remplir des mêmes cartes que « RÉSULTATS ». Servir deux fois la
// même liste afficherait chaque guide deux fois, dont une sous une pastille
// « Suggéré » que rien ne justifie — une donnée fabriquée a l'air branchée et ne
// l'est pas. Une section vide sous son titre se voit ; une fausse suggestion, non.
// REMONTÉ : il manque une route de suggestion.
//
// Le jour où elle existe, le `meta` d'une carte suggérée est celui que la maquette
// dessine — « Santé · mis à jour le 2 février », soit la catégorie puis
// `updatedLabel` en minuscule initiale — et non celui des résultats.

/** « 57 utiles », « 1 utile ». Un compteur de VOTES d'utilité, jamais de vues. */
function utilesLabel(n: number): string {
  return `${n} utile${n > 1 ? 's' : ''}`;
}

/**
 * Une carte de « RÉSULTATS » : son titre, et sa ligne de contexte.
 *
 * `meta` est « Santé · Lyon · 57 utiles », exactement ce que la maquette écrit : la
 * catégorie, la PORTÉE, puis le compteur d'utilité.
 *
 * La portée préfère la VILLE quand le guide en nomme une — la maquette met « Lyon »
 * sur son premier résultat et « Universel » sur le second, donc les deux formes
 * sont de la maquette et non un choix d'ici. `GuideScope` ne vaut que `UNIVERSAL`
 * ou `COUNTRY` ; la ville est un champ à part (`city`), et c'est lui qui porte
 * « Lyon ».
 */
export function guideLiableDe(g: GuideListItemView): GuideLiableView {
  const portee = g.city?.name ?? scopeLabel(g);
  return {
    titre: g.title,
    meta: `${CATEGORY_LABEL[g.category] ?? g.category} · ${portee} · ${utilesLabel(g.helpfulCount)}`,
  };
}

/**
 * LES GUIDES LIABLES, AVEC DE QUOI LES CHOISIR.
 *
 * `choisis` et `onToggle` viennent de l'écran : la fenêtre ne décide pas de ce
 * qui est retenu, elle le montre. Sans eux la liste reste affichable telle quelle
 * — c'est ce que font les deux listes d'exemple de la maquette.
 */
export function guidesLiablesDe(
  page: GuideListResponse,
  choisis: readonly string[] = [],
  onToggle?: (id: string) => void,
): readonly GuideLiableView[] {
  return page.items.map((g) => ({
    ...guideLiableDe(g),
    guideId: g.id,
    choisi: choisis.includes(g.id),
    ...(onToggle === undefined ? {} : { onPick: () => onToggle(g.id) }),
  }));
}

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║ LES SIGNALEMENTS « A CHANGÉ », VUS PAR L'AUTEUR                            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Le porteur, revenant sur son arbitrage de la veille : « Il faut faire ceci,
 * l'auteur doit voir les signalements "a changé". » Ce qui RESTE du précédent,
 * c'est l'ANONYMAT — et il est tenu à la SOURCE : `GET /guides/:id/outdated` ne
 * rend que `{ createdAt, comment }`, son schéma est `.strict()`, et il n'y a donc
 * rien à cacher ici. Cette fabrique ne peut pas nommer un signalant même si
 * quelqu'un le lui demandait.
 *
 * ── LA DATE PASSE PAR `dateCourte`, LA MÊME QUE PARTOUT ─────────────────────
 *
 * « 12 mars », « 3 oct. 2025 » : le MÊME convertisseur que la ligne « Mis à jour
 * le … » des cartes et que l'échéance de dépublication. Une seconde composition
 * aurait fini par écrire « 9 novembre » là où le reste du module écrit « 9 nov. »
 * — c'est écrit en toutes lettres sur `dateCourte`, et ça vaut ici aussi.
 *
 * ── UN SIGNALEMENT SANS COMMENTAIRE EST UN CAS NORMAL ───────────────────────
 *
 * Le champ est FACULTATIF à la saisie (`guideOutdatedFlagSchema` :
 * `.min(1).max(500).optional()`), donc `comment: null` n'est PAS une donnée
 * manquante — c'est un membre qui a signalé sans rien dire. La sous-ligne porte
 * alors les mots du produit, et non le vide : une rangée à moitié rendue se lit
 * comme un défaut d'affichage, exactement comme le « — » seul sous le titre d'un
 * guide sans contributeur que ce module a déjà corrigé.
 *
 * ⚠ TEXTE HORS MAQUETTE : « Signalé sans commentaire ». La planche ne dessine pas
 * cette page, donc aucun de ses mots n'en vient — ni celui-là, ni la phrase de la
 * carte « COMMENT ÇA MARCHE », ni « Aucun signalement ». Les trois sont REMONTÉS,
 * et les trois disent un FAIT plutôt qu'un jugement.
 *
 * ── LA LISTE VIDE REÇOIT UNE RANGÉE, ET C'EST LA CONVENTION DU MODULE ───────
 *
 * Une carte avec son titre et rien dessous se lit comme un chargement qui n'a pas
 * abouti. `propositions-screen.tsx` tient déjà cette convention pour un
 * emplacement sans proposition (`EMPLACEMENT_VIDE`), pastille grise comprise : on
 * la reprend plutôt que d'en inventer une seconde.
 *
 * ── LES DEUX TEINTES VIENNENT DE LA PLANCHE EMPRUNTÉE ───────────────────────
 *
 * `#CBD5D1` est la pastille des versions NON courantes de la carte « HISTORIQUE
 * DES VERSIONS » — celle dont cette rangée est empruntée. `#8A958F` est le gris
 * d'identité absente que `guideCardFrom` et `EMPLACEMENT_VIDE` emploient déjà.
 * Aucune teinte n'est choisie ici : un signalement n'a pas de « courant » à
 * distinguer, donc toutes les rangées portent la même.
 */
const SIGNALEMENT_DOT = '#CBD5D1';
const SIGNALEMENT_DOT_VIDE = '#8A958F';

/** « 1 signalement », « 3 signalements » — l'accord, au même endroit que le nombre. */
function phraseSignalements(n: number): string {
  return `${n} ${n === 1 ? 'signalement' : 'signalements'}`;
}

export function signalementsFrom(
  titre: string,
  reponse: GuideOutdatedFlagsResponse,
  now: Date = new Date(),
): SignalementsView {
  const items: readonly SignalementRowView[] =
    reponse.items.length === 0
      ? [
          {
            dot: SIGNALEMENT_DOT_VIDE,
            quand: 'Aucun signalement',
            dit: 'Personne ne dit que l’information de ce guide a changé.',
          },
        ]
      : reponse.items.map((f) => ({
          dot: SIGNALEMENT_DOT,
          quand: dateCourte(f.createdAt, now),
          dit: f.comment ?? 'Signalé sans commentaire.',
        }));

  return {
    titre,
    libelle: 'SIGNALEMENTS « A CHANGÉ »',
    compte: phraseSignalements(reponse.items.length),
    /**
     * LA CARTE « COMMENT ÇA MARCHE » DIT LES DEUX NOMBRES DE §2.6, et ils sont
     * IMPORTÉS : `GUIDE_OUTDATED_FLAG_THRESHOLD` (3) et
     * `GUIDE_UNPUBLISH_DELAY_DAYS` (30) vivent dans `@app/shared`, qui est la seule
     * source des bornes métier. Les écrire en chiffres ici aurait dédoublé la règle
     * que le serveur applique — et la phrase aurait menti le jour où §2.6 change.
     */
    aide:
      `À ${String(GUIDE_OUTDATED_FLAG_THRESHOLD)} signalements, votre guide passe en ` +
      `« à vérifier » et vous avez ${String(GUIDE_UNPUBLISH_DELAY_DAYS)} jours pour le ` +
      'corriger. Une proposition acceptée pendant ce délai le remet en ligne et efface ' +
      'les signalements. Les signalants restent anonymes.',
    items,
  };
}
