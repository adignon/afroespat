import { STAFF_SCOPES, type StaffRoleValue } from '@app/shared';

/**
 * LA NAVIGATION DE L'ADMINISTRATION — UNE SEULE LISTE, groupée par métier.
 *
 * Avant : quinze entrées à plat, dans l'ordre où la maquette les dessine. Un membre de l'équipe cherchait « Alertes
 * arnaques » entre « Guides » et « Référentiels ». Elles sont maintenant rangées par ce qu'on y fait :
 *
 *   · Pilotage        — voir où en est la plateforme ;
 *   · Communauté      — les personnes et ce qui demande une décision humaine ;
 *   · Contenu         — ce que la plateforme publie ;
 *   · Offre           — services, partenaires, revenus ;
 *   · Configuration   — référentiels et réglages.
 *
 * Le rail, la barre haute (fil d'Ariane) et le titre de page lisent tous cette liste : une page ajoutée ici apparaît
 * partout, et un titre ne se dit qu'à un endroit.
 *
 * ── QUI VOIT QUOI ──────────────────────────────────────────────────────────
 * `scope` est la liste de rôles de `STAFF_SCOPES` qui peut TRAITER la page (celle que l'API exige pour ses routes
 * principales). Un rôle qui ne l'a pas ne voit pas l'entrée : un modérateur n'a pas à ouvrir « Réglages » pour y
 * lire un refus. Les pages dont les lectures sont ouvertes aux quatre rôles (`dashboard`) restent visibles de tous ;
 * l'API reste le seul juge, ce filtre ne fait qu'éviter les impasses.
 */
export type CleCompteur = 'moderation' | 'alertesEquipe' | 'justificatifsPro' | 'villesAActiver';

export interface EntreeNavigation {
  readonly href: string;
  readonly libelle: string;
  /** Description courte, sous le titre de la page et en infobulle du rail replié. */
  readonly description: string;
  readonly scope: keyof typeof STAFF_SCOPES;
  /**
   * Les rôles qui ouvrent la page quand l'API ne la sert pas à un périmètre de `STAFF_SCOPES` mais à une liste à elle
   * (`GET /admin/moderation/alerts` : modération, contenu, administrateurs — pas le support). Prime sur `scope`.
   */
  readonly roles?: readonly StaffRoleValue[];
  /** Tracé d'icône (viewBox 24, trait de 1,8). */
  readonly icone: string;
  /** Le compteur « à traiter » que l'API de pilotage donne déjà pour cette page. */
  readonly compteur?: CleCompteur;
}

export interface GroupeNavigation {
  readonly cle: string;
  readonly titre: string;
  readonly entrees: readonly EntreeNavigation[];
}

const ICONES = {
  tableau: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  courbe: 'M4 19V5M4 19h16M8 15l3-4 3 2 5-7',
  membres: 'M9 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 11a2.5 2.5 0 1 0 0-5M16 20h5a5 5 0 0 0-4-5',
  bouclier: 'M12 3 4 6v6c0 4.5 3.5 8 8 9 4.5-1 8-4.5 8-9V6z',
  cloche: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0',
  alerte: 'M12 4 3 20h18zM12 10v4M12 17v.5',
  parcours: 'M5 5h6a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h10',
  etapes: 'M4 6h12M4 12h16M4 18h8',
  livre: 'M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  page: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5',
  sac: 'M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2',
  lien: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  piece: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v10M9.5 9.5C9.5 8.5 10.5 8 12 8s2.5.7 2.5 1.8-1 1.6-2.5 2-2.5.9-2.5 2.2S10.5 16 12 16s2.5-.5 2.5-1.5',
  carte: 'M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  reglages: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4',
} as const;

export const NAVIGATION_ADMIN: readonly GroupeNavigation[] = [
  {
    cle: 'pilotage',
    titre: 'Pilotage',
    entrees: [
      { href: '/admin', libelle: 'Tableau de bord', description: 'Ce qui demande une action, et l’état de la plateforme', scope: 'dashboard', icone: ICONES.tableau },
      { href: '/admin/impact', libelle: 'Rapport d’impact', description: 'Les chiffres du trimestre, à imprimer ou à enregistrer en PDF', scope: 'dashboard', icone: ICONES.courbe },
    ],
  },
  {
    cle: 'communaute',
    titre: 'Communauté',
    entrees: [
      { href: '/admin/membres', libelle: 'Membres', description: 'Rechercher, filtrer, modérer, supprimer des comptes et leurs contenus', scope: 'memberRead', icone: ICONES.membres },
      { href: '/admin/moderation', libelle: 'Modération', description: 'La file des signalements et des annonces à vérifier', scope: 'moderation', icone: ICONES.bouclier, compteur: 'moderation' },
      { href: '/admin/alertes-equipe', libelle: 'Alertes d’équipe', description: 'Ce que la plateforme remonte à l’équipe', scope: 'dashboard', roles: ['SUPER_ADMIN', 'CONTENT_ADMIN', 'MODERATOR'], icone: ICONES.cloche, compteur: 'alertesEquipe' },
      { href: '/admin/alertes', libelle: 'Alertes arnaques', description: 'Les arnaques signalées et les alertes publiées aux membres', scope: 'dashboard', icone: ICONES.alerte },
    ],
  },
  {
    cle: 'contenu',
    titre: 'Contenu',
    entrees: [
      { href: '/admin/contenu', libelle: 'Contenu et annonces', description: 'Pages légales, annonces d’équipe, contenus des membres', scope: 'dashboard', icone: ICONES.page },
      { href: '/admin/guides', libelle: 'Guides', description: 'Relire, publier et suivre les guides', scope: 'dashboard', icone: ICONES.livre },
      { href: '/admin/parcours', libelle: 'Parcours', description: 'Les modèles de parcours et leurs versions', scope: 'dashboard', icone: ICONES.parcours },
      { href: '/admin/etapes', libelle: 'Bibliothèque d’étapes', description: 'Les étapes réutilisables des parcours', scope: 'content', icone: ICONES.etapes },
    ],
  },
  {
    cle: 'offre',
    titre: 'Offre',
    entrees: [
      { href: '/admin/services', libelle: 'Services', description: 'Annonces, fiches professionnelles et justificatifs', scope: 'proReview', icone: ICONES.sac, compteur: 'justificatifsPro' },
      { href: '/admin/partenaires', libelle: 'Partenaires', description: 'Partenaires et emplacements', scope: 'content', icone: ICONES.lien },
      { href: '/admin/revenus', libelle: 'Paiements et offres', description: 'Monétisation, moyens de paiement, formules et options payantes', scope: 'staffAdmin', icone: ICONES.piece },
    ],
  },
  {
    cle: 'configuration',
    titre: 'Configuration',
    entrees: [
      { href: '/admin/referentiels', libelle: 'Référentiels', description: 'Pays, villes, métiers, langues', scope: 'content', icone: ICONES.carte, compteur: 'villesAActiver' },
      { href: '/admin/reglages', libelle: 'Réglages', description: 'Paramètres, fonctions activables, équipe, rôles et journal d’audit', scope: 'dashboard', icone: ICONES.reglages },
    ],
  },
];

const NOM_ROLE_COURT: Record<StaffRoleValue, string> = {
  SUPER_ADMIN: 'administrateurs',
  CONTENT_ADMIN: 'contenu',
  MODERATOR: 'modération',
  SUPPORT: 'support',
};

const NOM_ROLE_COURT_ORDRE = (a: StaffRoleValue, b: StaffRoleValue): number => Number(a === 'SUPER_ADMIN') - Number(b === 'SUPER_ADMIN');

/** Les rôles qui ouvrent cette entrée : sa liste propre si elle en a une, sinon ceux de son périmètre. */
export function rolesDeLEntree(e: Pick<EntreeNavigation, 'scope' | 'roles'>): readonly StaffRoleValue[] {
  return e.roles !== undefined ? [...e.roles].sort(NOM_ROLE_COURT_ORDRE) : rolesDuScope(e.scope);
}

/** Les rôles d'un périmètre, dans un ordre stable : métiers d'abord, administrateurs en dernier. */
export function rolesDuScope(scope: keyof typeof STAFF_SCOPES): readonly StaffRoleValue[] {
  const liste = [...(STAFF_SCOPES[scope] as readonly StaffRoleValue[])];
  return liste.sort((a, b) => Number(a === 'SUPER_ADMIN') - Number(b === 'SUPER_ADMIN'));
}

/** « support et administrateurs » : qui peut employer ce périmètre, en français. */
export function quiPeut(scope: keyof typeof STAFF_SCOPES | readonly StaffRoleValue[]): string {
  const noms = (typeof scope === 'string' ? rolesDuScope(scope) : [...scope].sort(NOM_ROLE_COURT_ORDRE)).map((r) => NOM_ROLE_COURT[r]);
  if (noms.length <= 1) return noms.join('');
  return `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1] ?? ''}`;
}

/** Le texte d'un bouton ou d'une page éteints par le rôle : « Réservé : support et administrateurs ». */
export const reservePour = (scope: keyof typeof STAFF_SCOPES): string => `Réservé : ${quiPeut(scope)}`;

/** Le rôle peut-il traiter cette page ? */
export function peutOuvrir(role: StaffRoleValue | null, e: EntreeNavigation): boolean {
  return role !== null && (rolesDeLEntree(e) as readonly string[]).includes(role);
}

/** Les groupes visibles pour ce rôle ; un groupe sans entrée disparaît. */
export function navigationPour(role: StaffRoleValue | null): readonly GroupeNavigation[] {
  return NAVIGATION_ADMIN.map((g) => ({ ...g, entrees: g.entrees.filter((e) => peutOuvrir(role, e)) })).filter((g) => g.entrees.length > 0);
}

/**
 * L'entrée qui porte ce chemin : la plus SPÉCIFIQUE gagne (`/admin/alertes-equipe` n'est pas « Alertes arnaques »,
 * `/admin/moderation/ab12…` est « Modération », `/admin` seul est le tableau de bord).
 */
export function entreeDuChemin(chemin: string): { readonly groupe: GroupeNavigation; readonly entree: EntreeNavigation } | null {
  let meilleur: { groupe: GroupeNavigation; entree: EntreeNavigation } | null = null;
  for (const groupe of NAVIGATION_ADMIN) {
    for (const entree of groupe.entrees) {
      const dessus = chemin === entree.href || (entree.href !== '/admin' && chemin.startsWith(`${entree.href}/`));
      if (dessus && (meilleur === null || entree.href.length > meilleur.entree.href.length)) meilleur = { groupe, entree };
    }
  }
  return meilleur;
}
