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
 * · `missing` (« Recherché sans résultat ce mois-ci ») — aucune route ne donne
 *   les recherches infructueuses. Les valeurs de la maquette restent dans
 *   `a03/data.ts` et le manque est remonté ;
 * · les options des trois filtres `Catégorie / Pays / Ville` — `GET /guides` les
 *   accepte, mais la maquette ne dessine aucune liste d'options ;
 * · le NOM d'un contributeur — le cadre ne dessine que sa pastille d'initiales.
 *
 * On n'invente aucune de ces valeurs : une affordance remplie d'une donnée
 * fabriquée ne se voit défaillante qu'au clic.
 */
import type {
  GuideDetailResponse,
  GuideListItemView,
  GuideListResponse,
  GuideProposalView,
  GuideVersionsResponse,
} from '@app/shared';
import type { GuideCardView } from '../a03/data';
import type { ContributorView, VersionRowView } from '../a04/data';

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
const CATEGORY_LABEL: Readonly<Record<string, string>> = {
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
  const d = new Date(iso);
  const mois = MOIS[d.getMonth()] ?? '';
  const annee = d.getFullYear() === now.getFullYear() ? '' : ` ${d.getFullYear()}`;
  return `Mis à jour le ${d.getDate()} ${mois}${annee}`;
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
    excerpt: `${CATEGORY_LABEL[g.category] ?? g.category} · ${scopeLabel(g)}`,
    guideId: g.id,
    slug: g.slug,
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
export function contributorsFrom(detail: GuideDetailResponse): readonly ContributeurPastille[] {
  return detail.contributors.map((c) => ({
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

// ─── A06 · les propositions ─────────────────────────────────────────────────

/**
 * Une proposition prête à afficher : l'avant/après de §2.4 et le délai restant
 * avant escalade.
 *
 * Le cadre transcodé de A06 ne lit AUCUNE de ces valeurs — sa planche avant/après
 * est du balisage statique dans la maquette. Cette fonction existe quand même, et
 * elle est éprouvée : le jour où le cadre expose ses prises, le calcul du délai
 * est le seul endroit où l'on pouvait se tromper, et il est déjà figé par un test.
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
    i: initials(p.proposer.displayName),
    bg: avatarColor(p.proposer.handle),
    delai: delaiAvantEscalade(p.escalateAt, now),
    /** Seules `PENDING` et `ESCALATED` attendent encore une décision (§2.4). */
    enAttente: p.status === 'PENDING' || p.status === 'ESCALATED',
  };
}
