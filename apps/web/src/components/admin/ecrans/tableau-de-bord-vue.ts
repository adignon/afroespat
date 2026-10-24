import { type AdminDashboardOverview } from '@app/shared';

/**
 * D02 — la mise en forme du tableau de bord, SANS appel : des fonctions pures, éprouvées
 * sur des charges (`tableau-de-bord.test.ts`).
 *
 * RÈGLE : UNE MESURE ABSENTE EST « — », JAMAIS UN NOMBRE. `null` (le serveur dit « pas
 * mesuré ») devient un tiret ; `0` (le serveur dit « zéro ») reste « 0 ». Les confondre
 * donnerait un tableau de bord crédible et faux.
 */

export const ABSENT = '—';

const nombreFr = new Intl.NumberFormat('fr-FR');
const dixiemeFr = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** « 1 400 » — l'espace fine insécable du français, jamais une coupure au milieu d'un nombre. */
export const entier = (n: number | null): string => (n === null ? ABSENT : nombreFr.format(n));

/** « 27,4 % » (un dixième) — le pourcentage de l'indicateur clé. */
export const pourcentage = (n: number | null): string => (n === null ? ABSENT : `${dixiemeFr.format(n)} %`);

/** « 33 % » — les pastilles de villes, arrondies à l'entier comme la planche l'écrit (« Lyon · 31 % »). */
export const pourcentageEntier = (n: number): string => `${nombreFr.format(Math.round(n))} %`;

/** « 30 % » (entier) ou « 32,5 % » : l'objectif, écrit comme on le dirait. */
export const objectif = (n: number): string => (Number.isInteger(n) ? `${nombreFr.format(n)} %` : pourcentage(n));

/** « 93 % » (entier) — une PROPORTION [0, 1] rendue en pourcentage. */
export function proportion(p: number | null): string {
  if (p === null) return ABSENT;
  return `${nombreFr.format(Math.round(p * 100))} %`;
}

/** « 4,7 / 5 » — la note moyenne d'un parrainage, au dixième. */
export const note = (n: number | null): string => (n === null ? ABSENT : `${dixiemeFr.format(n)} / 5`);

/** « +2,1 pts », « −0,4 pt », « ±0 pt » : l'écart en POINTS ; `null` quand il n'y a pas de période de comparaison. */
export function variation(points: number | null): string | null {
  if (points === null) return null;
  if (points === 0) return '±0 pt';
  const abs = dixiemeFr.format(Math.abs(points));
  const unite = Math.abs(points) > 1 ? 'pts' : 'pt';
  return `${points > 0 ? '+' : '−'}${abs} ${unite}`;
}

export interface AlerteLigne {
  readonly cle: string;
  /** Le ton de la pastille : `encre` (urgent), `terre` (à traiter), `vert` (à décider). */
  readonly ton: 'encre' | 'terre' | 'vert';
  readonly titre: string;
  readonly detail: string;
  readonly vers: string;
}

const pluriel = (n: number, un: string, plusieurs: string): string => `${entier(n)} ${n > 1 ? plusieurs : un}`;

/**
 * Les lignes du bandeau d'alertes : celles qui ont quelque chose à dire. Une alerte à zéro
 * est un FAIT (rien à traiter) et ne fait pas de ligne ; si toutes sont à zéro, la liste est
 * vide et l'écran écrit « Rien à signaler ».
 */
export function lignesAlertes(a: AdminDashboardOverview['alerts']): AlerteLigne[] {
  const out: AlerteLigne[] = [];
  if (a.moderationOverdue.count > 0) {
    out.push({
      cle: 'sla',
      ton: 'encre',
      titre: 'SLA dépassé',
      detail: pluriel(a.moderationOverdue.count, 'dossier de modération', 'dossiers de modération'),
      vers: '/admin/moderation',
    });
  }
  if (a.proPending.count > 0) {
    out.push({
      cle: 'pro',
      ton: 'terre',
      titre: 'Justificatifs pro',
      detail: `${entier(a.proPending.count)} en attente`,
      vers: '/admin/services',
    });
  }
  if (a.citiesToActivate.count > 0) {
    const reste = a.citiesToActivate.count - a.citiesToActivate.names.length;
    out.push({
      cle: 'villes',
      ton: 'vert',
      titre: 'Villes à activer',
      detail: `${a.citiesToActivate.names.join(', ')}${reste > 0 ? ` et ${entier(reste)} autre${reste > 1 ? 's' : ''}` : ''}`,
      vers: '/admin/referentiels',
    });
  }
  if (a.unreadStaffAlerts > 0) {
    out.push({
      cle: 'equipe',
      ton: 'encre',
      titre: 'Alertes d’équipe',
      detail: `${entier(a.unreadStaffAlerts)} non lue${a.unreadStaffAlerts > 1 ? 's' : ''}`,
      vers: '/admin/alertes-equipe',
    });
  }
  return out;
}

export interface Rangee {
  readonly libelle: string;
  readonly valeur: string;
}

/** Les cartes de l'`overview` (modération, parrainage, événements, réseaux), prêtes à afficher. */
export function cartesOverview(o: AdminDashboardOverview): {
  readonly moderation: readonly Rangee[];
  readonly parrainage: readonly Rangee[];
  readonly evenements: readonly Rangee[];
  readonly reseaux: readonly Rangee[];
} {
  return {
    moderation: [
      { libelle: 'File', valeur: entier(o.moderation.queue) },
      { libelle: 'SLA respecté', valeur: proportion(o.moderation.slaComplianceRate) },
    ],
    parrainage: [
      { libelle: 'En cours', valeur: entier(o.mentorship.active) },
      { libelle: 'Note', valeur: note(o.mentorship.averageRating) },
    ],
    evenements: [
      { libelle: 'Ce mois', valeur: entier(o.events.thisMonth) },
      { libelle: 'Présences', valeur: entier(o.events.checkedInThisMonth) },
    ],
    reseaux: [
      { libelle: 'Actifs', valeur: entier(o.communities.active) },
      { libelle: 'Intérêt', valeur: entier(o.communities.interest) },
    ],
  };
}

/**
 * Les points de la courbe hebdomadaire dans un cadre de 600 × 120.
 *
 *   · x est PROPORTIONNEL AU TEMPS (début de semaine) : une semaine sans instantané laisse un
 *     trou visible plutôt qu'un segment qui ferait croire à une mesure continue ;
 *   · y est proportionnel au pourcentage, sur une échelle qui contient TOUJOURS l'objectif
 *     (sinon la ligne pointillée sortirait du cadre).
 *
 * Retourne aussi l'ordonnée de l'objectif.
 */
export function courbe(
  weekly: readonly { readonly weekStart: string; readonly percent: number }[],
  target: number,
  largeur = 600,
  hauteur = 120,
): { readonly points: string; readonly yObjectif: number; readonly echelleMax: number } {
  const haut = Math.max(target, ...weekly.map((w) => w.percent), 1);
  // Une marge de 25 % au-dessus du plus haut, arrondie à la dizaine : la courbe ne colle pas au bord.
  const echelleMax = Math.ceil((haut * 1.25) / 10) * 10;
  const marge = 6;
  const y = (v: number): number => Math.round((hauteur - marge - (v / echelleMax) * (hauteur - 2 * marge)) * 10) / 10;
  const temps = weekly.map((w) => Date.parse(w.weekStart));
  const debut = Math.min(...temps);
  const fin = Math.max(...temps);
  const x = (t: number): number => (fin === debut ? largeur / 2 : Math.round(((t - debut) / (fin - debut)) * largeur * 10) / 10);
  const points = weekly.map((w, i) => `${x(temps[i] ?? debut)},${y(w.percent)}`).join(' ');
  return { points, yObjectif: y(target), echelleMax };
}
